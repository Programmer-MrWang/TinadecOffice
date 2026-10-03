import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { RUNTIME_TARGETS, runtimeTargetKeys } from "./runtimeTargets.mjs";
import { builderArgs } from "./package.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(desktopDir, "package.json"), "utf8"));
const build = pkg.build;
const script = (name) => pkg.scripts[name] ?? "";

// node-pty picks its binary from prebuilds/<platform>-<arch> at require() time, and the directory
// names are its own vocabulary, not the runtime matrix's.
const PREBUILD_DIR = {
	"win-x64": "win32-x64",
	"linux-x64": "linux-x64",
	"osx-arm64": "darwin-arm64",
};

test("Every shipping target has an electron-builder mapping and nothing else does", () => {
	const archFlag = { x64: "--x64", arm64: "--arm64" };
	for (const key of runtimeTargetKeys()) {
		const args = builderArgs(key);
		assert.ok(["--win", "--linux", "--mac"].includes(args[0]), `${key} needs a builder platform flag`);
		assert.equal(args[1], archFlag[RUNTIME_TARGETS[key].arch], `${key} builds for its own arch`);
		assert.deepEqual(args.slice(2), ["--publish", "never"], `${key} must not try to publish from CI build`);
	}
	// osx-x64 is deliberately out of the matrix; a mapping for it would stage a runtime nobody runs.
	assert.throws(() => builderArgs("osx-x64"), /No electron-builder mapping/);
});

test("macOS ships an unsigned dmg and Linux an AppImage, each named after its platform", () => {
	assert.deepEqual(build.mac.target, [{ target: "dmg", arch: ["arm64"] }]);
	assert.deepEqual(build.linux.target, [{ target: "AppImage", arch: ["x64"] }]);

	// One release collects every asset in one directory: two platforms sharing an artifact name is
	// how a Windows installer ended up labelled as the Linux one.
	assert.match(build.mac.artifactName, /osx-arm64/);
	assert.match(build.linux.artifactName, /linux-x64/);
	assert.match(build.nsis.artifactName, /win-x64/);
	assert.equal(build.mac.identity, null, "unsigned by decision: no Apple Developer identity yet");
});

test("The node-pty filter ships each host its own prebuild", () => {
	const mapping = build.files.find((entry) => typeof entry === "object" && entry.from?.endsWith("node-pty"));
	assert.ok(mapping, "node-pty is mapped in from the hoisted root install");

	const exclusions = mapping.filter.filter((pattern) => pattern.startsWith("!"));
	for (const [key, dir] of Object.entries(PREBUILD_DIR)) {
		assert.equal(
			exclusions.some((pattern) => pattern.includes(dir)),
			false,
			`${key} would package without ${dir}, and the terminal dies at spawn`,
		);
	}
	// The one exclusion is the arch nobody targets; asserting it stays keeps the list from silently
	// growing back to the Windows-only shape it had before.
	assert.deepEqual(exclusions, ["!prebuilds/win32-arm64/**"]);
});

test("Packaging scripts go through the one parameterized entry", () => {
	for (const name of ["package:win", "package:portable", "package:linux", "package:mac"]) {
		assert.ok(script(name), `${name} exists`);
		assert.match(script(name), /node scripts\/package\.mjs/, `${name} must not grow its own builder call`);
		assert.doesNotMatch(script(name), /package-win\.mjs/);
	}
	assert.equal(existsSync(join(desktopDir, "scripts", "package-win.mjs")), false);
});

test("Linux and macOS staging is what the runtime table knows, not a Windows default", () => {
	// package:linux/mac run stage:runtime on their own runner, and the stager picks the target from
	// the host. If a script ever pins --target by hand, the guard here is the mismatch it would hide.
	for (const name of ["package:win", "package:portable", "package:linux", "package:mac"]) {
		assert.doesNotMatch(script(name), /--target=/, `${name} lets the stager resolve its own host`);
	}
	assert.ok(runtimeTargetKeys().every((key) => key in RUNTIME_TARGETS));
});
