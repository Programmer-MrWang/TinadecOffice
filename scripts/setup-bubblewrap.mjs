// Explicit Linux development/release setup. Windows and macOS perform no network or filesystem work.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUBBLEWRAP_VERSION, BUBBLEWRAP_COMMIT, BUBBLEWRAP_SOURCE_SHA256, BUBBLEWRAP_SOURCE_URL, verifyBubblewrap } from "./bubblewrap-pin.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function main() {
	if (process.platform !== "linux") { console.log(`[setup-bubblewrap] ${process.platform} does not use bubblewrap; skipped.`); return; }
	if (process.env.TINADEC_TOOLS_BWRAP_PATH) { verifyBubblewrap(resolve(process.env.TINADEC_TOOLS_BWRAP_PATH)); return; }
	const destination = join(rootDir, "native", "bwrap");
	const binary = join(destination, "bwrap");
	if (existsSync(binary) && !process.argv.includes("--force")) { verifyBubblewrap(binary); return; }
	mkdirSync(destination, { recursive: true });
	const archive = join(destination, `source-${BUBBLEWRAP_COMMIT}.tar.gz`);
	const work = join(destination, `.build-${process.pid}`);
	const env = { ...process.env }; delete env.TINADEC_HOST_CONTROL_TOKEN;
	function run(command, args) {
		const result = spawnSync(command, args, { stdio: "inherit", env, timeout: 300_000 });
		if (result.error || result.status !== 0) throw new Error(`${command} failed. Install a C compiler, meson, ninja-build, pkg-config and libcap-dev, then rerun npm run setup:bwrap. ${result.error?.message ?? ""}`);
	}
	try {
		if (existsSync(archive) && createHash("sha256").update(readFileSync(archive)).digest("hex") !== BUBBLEWRAP_SOURCE_SHA256) rmSync(archive);
		if (!existsSync(archive)) {
			const response = await fetch(BUBBLEWRAP_SOURCE_URL, { signal: AbortSignal.timeout(120_000) });
			if (!response.ok) throw new Error(`Source download returned HTTP ${response.status}`);
			const bytes = Buffer.from(await response.arrayBuffer());
			if (createHash("sha256").update(bytes).digest("hex") !== BUBBLEWRAP_SOURCE_SHA256) throw new Error("Bubblewrap source SHA256 does not match the reviewed pin.");
			writeFileSync(archive, bytes);
		}
		mkdirSync(work, { recursive: true }); run("tar", ["-xzf", archive, "-C", work]);
		const build = join(work, "build");
		run("meson", ["setup", build, join(work, `bubblewrap-${BUBBLEWRAP_COMMIT}`), "-Dtests=false"]);
		run("ninja", ["-C", build]); verifyBubblewrap(join(build, "bwrap"));
		copyFileSync(join(build, "bwrap"), binary); chmodSync(binary, 0o755); verifyBubblewrap(binary);
		writeFileSync(join(destination, "VERSION"), `${BUBBLEWRAP_VERSION}\n${BUBBLEWRAP_COMMIT}\n${BUBBLEWRAP_SOURCE_SHA256}\n`);
		console.log(`[setup-bubblewrap] reviewed ${BUBBLEWRAP_VERSION} staged at ${binary}`);
	} finally { rmSync(work, { recursive: true, force: true }); }
}
main().catch(error => { console.error(`[setup-bubblewrap] ${error.message}`); process.exitCode = 1; });
