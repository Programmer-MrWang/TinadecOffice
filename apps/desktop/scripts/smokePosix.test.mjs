import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { RUNTIME_TARGETS } from "./runtimeTargets.mjs";
import {
	electronSmokeArgs,
	packagedExecutablePath,
	parseHdiutilOutput,
	posixDataRoot,
	sanitizedPosixEnvironment,
} from "./smoke-packaged-posix.mjs";
import { smokeChecks, smokePorts, validateGatewayHealth, validateHarnessManifest, validateToolsManifest } from "./smokeAssertions.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const posixScript = readFileSync(join(desktopDir, "scripts", "smoke-packaged-posix.mjs"), "utf8");
const windowsScript = readFileSync(join(desktopDir, "scripts", "smoke-packaged-windows.mjs"), "utf8");
const pkg = JSON.parse(readFileSync(join(desktopDir, "package.json"), "utf8"));

const linux = RUNTIME_TARGETS["linux-x64"];
const mac = RUNTIME_TARGETS["osx-arm64"];

test("Each POSIX target's packaged binary is found where its packager puts it", () => {
	assert.equal(
		packagedExecutablePath("/r", linux),
		join("/r", "linux-unpacked", "TinadecOffice"),
	);
	assert.equal(
		packagedExecutablePath("/r", mac),
		join("/r", "mac-arm64", "TinadecOffice.app", "Contents", "MacOS", "TinadecOffice"),
	);
	// The Windows layout is a different script's business; a POSIX smoke that guessed at it would
	// report "executable missing" on a build that packaged fine.
	assert.throws(() => packagedExecutablePath("/r", RUNTIME_TARGETS["win-x64"]), /No packaged layout/);
});

test("The log directory follows the data root the app itself would choose", () => {
	// Mirrors officeRootFor() in electron/serviceManager.cjs. If the two disagree the smoke still
	// fails, but with no logs attached — which is the failure mode this file exists to avoid.
	const serviceManager = readFileSync(join(desktopDir, "electron", "serviceManager.cjs"), "utf8");
	const linuxRoot = posixDataRoot("/p", linux);
	const macRoot = posixDataRoot("/p", mac);

	assert.equal(linuxRoot, join("/p", ".local", "share", "TinadecOffice"));
	assert.equal(macRoot, join("/p", "Library", "Application Support", "TinadecOffice"));
	assert.match(serviceManager, /Library/, "serviceManager still names the macOS location");
	assert.match(serviceManager, /\.local/, "serviceManager still names the XDG fallback location");
});

test("Only Linux is started without the renderer sandbox", () => {
	const linuxArgs = electronSmokeArgs("/u", linux);
	const macArgs = electronSmokeArgs("/u", mac);

	assert.ok(linuxArgs.includes("--no-sandbox"), "a root runner cannot start Chromium's setuid sandbox");
	assert.ok(!macArgs.includes("--no-sandbox"), "macOS runs with its real privileges or the smoke proves nothing");
	for (const args of [linuxArgs, macArgs]) {
		assert.ok(args.some((arg) => arg.startsWith("--user-data-dir=")), "the smoke owns its profile");
		assert.ok(args.includes("--disable-gpu"), "build machines have no GPU");
		assert.ok(args.includes("--no-first-run"));
	}
});

test("The child sees a throwaway profile and the loopback topology", () => {
	const env = sanitizedPosixEnvironment({ profile: "/p", temporary: "/t", inheritedPath: "/usr/bin:/bin", display: ":99" });

	assert.equal(env.HOME, "/p");
	assert.equal(env.XDG_DATA_HOME, join("/p", ".local", "share"));
	assert.equal(env.TMPDIR, "/t");
	assert.equal(env.TINADEC_GATEWAY_URL, "http://127.0.0.1:48730", "the packaged app only owns services on that exact URL");
	assert.equal(env.PATH, "/usr/bin:/bin", "git is probed from PATH on POSIX, so a stripped PATH lies about the product");
	assert.equal(env.DISPLAY, ":99");
	assert.equal(sanitizedPosixEnvironment({ profile: "/p", temporary: "/t" }).DISPLAY, undefined);
});

test("The mounted volume is read out of hdiutil's own output", () => {
	// Real hdiutil columns, and a volume name that contains the version — the mount point is the
	// last column, not the last whitespace-separated word.
	assert.equal(
		parseHdiutilOutput("/dev/disk4s1\tGUID_partition_scheme\n/dev/disk4s2\tApple_HFS\t/Volumes/TinadecOffice 0.1.1\n"),
		"/Volumes/TinadecOffice 0.1.1",
	);
	assert.equal(parseHdiutilOutput("nothing useful here"), null);
});

test("The shared predicates accept what Core and Gateway send and refuse what they do not", () => {
	assert.equal(validateGatewayHealth({ gateway: "ok", core_status: "ready" }), true);
	// The degraded answer is the one that matters: Gateway is up, Core is not, and a smoke that only
	// checked HTTP 200 would call that a pass.
	assert.equal(validateGatewayHealth({ gateway: "ok", core_status: "unreachable" }), false);
	assert.equal(validateToolsManifest([]), false, "an empty manifest means the tool child never answered");
	assert.equal(validateToolsManifest([{ id: "read_file" }]), true);
	assert.equal(validateHarnessManifest({ runtime: "tinadec", tool_registry: {}, modules: [] }), true);
	assert.equal(validateHarnessManifest({ runtime: "tinadec", tool_registry: {} }), false);
});

test("Both smokes read the contract from one module, and it covers every service endpoint", () => {
	for (const [name, source] of [["windows", windowsScript], ["posix", posixScript]]) {
		assert.match(source, /from "\.\/smokeAssertions\.mjs"/, `${name} must not re-fork the smoke contract`);
	}
	assert.equal(new Set(smokeChecks.map((check) => check.url)).size, smokeChecks.length);
	assert.deepEqual(
		smokeChecks.map((check) => check.label),
		[
			"Core health",
			"Gateway health",
			"Core readiness",
			"bundled tools manifest",
			"bundled tools readiness",
			"bundled harness manifest",
		],
	);
	assert.deepEqual(smokePorts, [48730, 48731, 48732]);
});

test("The POSIX smoke is wired for both legs and refuses Windows", () => {
	assert.match(pkg.scripts["smoke:packaged:posix"] ?? "", /node scripts\/smoke-packaged-posix\.mjs/);
	assert.match(posixScript, /The POSIX smoke does not run on Windows/);
	assert.equal(existsSync(join(desktopDir, "scripts", "smokeAssertions.mjs")), true);

	// The ubuntu runner died with "Authorization required, but no authorization protocol specified"
	// then SIGSEGV: an X server alone is not enough when HOME has been redirected, because Xlib's
	// cookie lookup follows $HOME/.Xauthority.
	const workflow = readFileSync(resolve(desktopDir, "..", "..", ".github", "workflows", "desktop-release.yml"), "utf8");
	assert.match(workflow, /xvfb-run[^\n]*-ac/, "the Linux smoke needs an X server that accepts the redirected profile");
});

test("A desktop session's X authority survives the redirected HOME", () => {
	const env = sanitizedPosixEnvironment({ profile: "/p", temporary: "/t", xauthority: "/run/user/1000/mcookie" });

	assert.equal(env.XAUTHORITY, "/run/user/1000/mcookie");
	assert.equal(env.HOME, "/p", "the two are not in conflict: the app's data stays in the profile");
	assert.equal(sanitizedPosixEnvironment({ profile: "/p", temporary: "/t" }).XAUTHORITY, undefined);
});
