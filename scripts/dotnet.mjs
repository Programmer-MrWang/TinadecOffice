#!/usr/bin/env node
// Cross-platform dotnet launcher.
//
// Windows keeps going through scripts/setup-dotnet-env.ps1 via pwsh.exe: that wrapper
// clears the `Version`/`Ice-Version` environment variables that break child dotnet
// processes on the developer machine, and this is the only sanctioned Windows path.
//
// POSIX platforms call dotnet directly — the wrapper only exists for a local-machine
// quirk that does not exist on Linux/macOS (and pwsh is not installed there anyway).
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const wrapper = resolve(scriptDir, "setup-dotnet-env.ps1");
const args = process.argv.slice(2);

if (args.length === 0) {
	console.error("[dotnet] no arguments provided; usage: node scripts/dotnet.mjs <dotnet args...>");
	process.exit(1);
}

let command;
let commandArgs;
if (process.platform === "win32") {
	// pwsh.exe when available (PowerShell 7+), else powershell.exe (Windows PowerShell 5).
	const pwsh = spawnSync("pwsh.exe", ["-NoProfile", "-Command", "exit 0"], { windowsHide: true });
	if (pwsh.error === undefined) {
		command = "pwsh.exe";
	} else {
		command = "powershell.exe";
	}
	commandArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", wrapper, ...args];
} else {
	command = "dotnet";
	commandArgs = args;
}

const result = spawnSync(command, commandArgs, { stdio: "inherit", windowsHide: true });
if (result.error) {
	console.error(`[dotnet] failed to launch '${command}': ${result.error.message}`);
	process.exit(1);
}
process.exit(result.status ?? 1);
