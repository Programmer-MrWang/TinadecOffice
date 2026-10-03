import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertBinaryFormat } from "./binaryFormat.mjs";
import {
	hostRuntimeTarget,
	resolveRuntimeTarget,
	runtimeBinaryName,
} from "./runtimeTargets.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(desktopDir, "runtime");
const core = join(runtimeDir, "core");
const gateway = join(runtimeDir, "gateway");
const tools = join(runtimeDir, "tools");
const native = join(runtimeDir, "native");

const target = (() => {
	const argument = process.argv.find((entry) => entry.startsWith("--target="));
	if (!argument) return hostRuntimeTarget();
	return resolveRuntimeTarget(argument.slice("--target=".length));
})();

function requireFile(path, label) {
	if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) {
		throw new Error(`${label} is missing or empty: ${path}`);
	}
	return path;
}

function requireDirectory(path, label) {
	if (!existsSync(path) || !statSync(path).isDirectory()) {
		throw new Error(`${label} is missing: ${path}`);
	}
	return path;
}

function readJson(path, label) {
	try {
		return JSON.parse(readFileSync(requireFile(path, label), "utf8"));
	} catch (error) {
		throw new Error(
			`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/// A staged binary that cannot be executed is the one failure mode a Windows build never shows:
/// tar extraction and Bun's standalone output both land without the owner-execute bit on some
/// hosts, and the packaged app then dies at spawn with a message about permissions.
function requireExecutableBit(path, label) {
	if (target.platform === "win32") return;
	const mode = statSync(path).mode;
	if ((mode & 0o100) === 0) {
		throw new Error(`${label} is not executable (mode ${mode.toString(8)}): ${path}`);
	}
}

function runProbe(command, args, label, allowTimeout = false) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		input: "",
		timeout: 10_000,
		windowsHide: true,
	});
	if (result.error?.code === "ETIMEDOUT" && allowTimeout) {
		console.warn(`${label} did not exit within 10 seconds and was stopped.`);
		return "";
	}
	if (result.error) {
		throw new Error(`${label} could not run: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new Error(`${label} exited with code ${result.status}: ${result.stderr.trim()}`);
	}
	return result.stdout.trim();
}

requireDirectory(runtimeDir, "Staged runtime");
requireDirectory(core, "Staged Core runtime");
requireDirectory(gateway, "Staged Gateway runtime");
requireDirectory(tools, "Staged Tools runtime");
requireDirectory(native, "Staged native runtime");

const rgName = runtimeBinaryName("rg", target);
const binaries = [
	[requireFile(join(core, runtimeBinaryName("TinadecCore.Api", target)), "Core executable"), "Core executable"],
	[requireFile(join(gateway, runtimeBinaryName("TinadecGateway", target)), "Gateway executable"), "Gateway executable"],
	[requireFile(join(tools, runtimeBinaryName("TinadecTools", target)), "TinadecTools executable"), "TinadecTools executable"],
	[requireFile(join(native, "rg", rgName), "Native ripgrep executable"), "Native ripgrep executable"],
	[requireFile(join(tools, rgName), "Tools ripgrep executable"), "Tools ripgrep executable"],
];

// PortableGit is a Windows packaging artifact; on Linux and macOS git comes from the system and is
// probed by the service host at runtime. Requiring this directory on a POSIX package would reject a
// complete build for a file that must not be there.
if (target.portableGit) {
	const git = requireDirectory(join(runtimeDir, "git"), "Staged Git runtime");
	binaries.push(
		[requireFile(join(git, "cmd", "git.exe"), "PortableGit git executable"), "PortableGit git executable"],
		[requireFile(join(git, "bin", "bash.exe"), "PortableGit Bash executable"), "PortableGit Bash executable"],
	);
}

for (const [path, label] of binaries) {
	requireExecutableBit(path, label);
	// Headers are read in bounded pieces: TinadecTools is over 60 MB and slurping it here was a
	// real failure of an earlier version of this check.
	const { detail } = await assertBinaryFormat(path, target, label);
	console.log(`${label}: ${target.format} ${detail}`);
}

readJson(join(core, "appsettings.json"), "Core appsettings");
requireFile(join(core, "Configuration", "default-agent-runtime.toml"), "Core runtime TOML");
requireFile(join(tools, "Nlog.config"), "TinadecTools config");

const toolsExe = binaries[2][0];
const gatewayExe = binaries[1][0];
const toolsVersion = runProbe(toolsExe, ["--version"], "TinadecTools --version");
const gatewayVersion = runProbe(gatewayExe, ["--version"], "Gateway --version", true);
console.log(`TinadecTools --version exited successfully${toolsVersion ? `: ${toolsVersion}` : ""}.`);
console.log(
	`Gateway --version ${gatewayVersion ? `returned: ${gatewayVersion}` : "is not a version-only command; executable launch was checked without keeping a service running"}.`,
);
console.log(`Staged ${target.key} runtime passed its path, resource, format, and entry checks.`);
