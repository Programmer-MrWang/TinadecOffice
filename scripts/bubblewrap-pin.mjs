import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const BUBBLEWRAP_VERSION = "0.13.0";
export const BUBBLEWRAP_COMMIT = "719a4fd474d44b26906bcf2b1b0fb6eddd8d56d0";
export const BUBBLEWRAP_SOURCE_SHA256 = "e55bdb06f051664ecd3297d449a8b679b7cd1c73adb292b73a81d9b03c5fc462";
export const BUBBLEWRAP_SOURCE_URL = `https://codeload.github.com/containers/bubblewrap/tar.gz/${BUBBLEWRAP_COMMIT}`;

export function verifyBubblewrap(binary, run = spawnSync) {
	if (!existsSync(binary) || !statSync(binary).isFile() || statSync(binary).size === 0) {
		throw new Error(`Linux runtime needs bubblewrap ${BUBBLEWRAP_VERSION}: missing executable ${binary}. Run npm run setup:bwrap on Linux or set TINADEC_TOOLS_BWRAP_PATH to the reviewed binary.`);
	}
	const env = { ...process.env }; delete env.TINADEC_HOST_CONTROL_TOKEN;
	const result = run(binary, ["--version"], { encoding: "utf8", timeout: 5_000, windowsHide: true, env });
	if (result.error || result.status !== 0 || result.stdout?.trim() !== `bubblewrap ${BUBBLEWRAP_VERSION}`) {
		throw new Error(`Linux runtime requires the reviewed bubblewrap ${BUBBLEWRAP_VERSION}; ${binary} failed its version check. Run npm run setup:bwrap on Linux or provide TINADEC_TOOLS_BWRAP_PATH.`);
	}
	return binary;
}

/** Packaging only copies a previously built binary. It never downloads or installs dependencies. */
export function stageBubblewrap({ rootDir, destinationDirectory, platform = process.platform, env = process.env, run = spawnSync }) {
	if (platform !== "linux") return null;
	const binary = env.TINADEC_TOOLS_BWRAP_PATH ? resolve(env.TINADEC_TOOLS_BWRAP_PATH) : join(rootDir, "native", "bwrap", "bwrap");
	verifyBubblewrap(binary, run);
	mkdirSync(destinationDirectory, { recursive: true });
	const target = join(destinationDirectory, "bwrap");
	copyFileSync(binary, target); chmodSync(target, 0o755);
	verifyBubblewrap(target, run);
	return target;
}
