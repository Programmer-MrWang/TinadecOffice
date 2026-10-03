import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
	RUNTIME_TARGETS,
	hostRuntimeTarget,
	resolveRuntimeTarget,
	runtimeBinaryName,
	runtimeTargetKeys,
} from "./runtimeTargets.mjs";
import { assertBinaryFormat, readBinaryFormat } from "./binaryFormat.mjs";

const dir = mkdtempSync(join(tmpdir(), "tinadec-runtime-targets-"));
const write = (name, bytes) => {
	const path = join(dir, name);
	writeFileSync(path, Buffer.concat([bytes, Buffer.alloc(Math.max(0, 700 - bytes.length))]));
	return path;
};

function elf({ classBits = 2, machine = 62 } = {}) {
	const head = Buffer.alloc(64);
	head.writeUInt32BE(0x7f454c46, 0);
	// The real e_ident layout, so a reader that grabs EI_DATA (5) instead of EI_CLASS (4) cannot
	// pass by agreeing with this fixture the way it did on a Windows host.
	head[4] = classBits;
	head[5] = 1; // EI_DATA: little endian
	head[6] = 1; // EI_VERSION
	head.writeUInt16LE(machine, 18);
	return head;
}

function macho(cputype) {
	const head = Buffer.alloc(64);
	head.writeUInt32LE(0xfeedfacf, 0);
	head.writeUInt32LE(cputype, 4);
	return head;
}

test("The matrix is exactly the three shipping targets", () => {
	assert.deepEqual(runtimeTargetKeys(), ["win-x64", "linux-x64", "osx-arm64"]);
	// osx-x64 was dropped on purpose (no non-deprecated x64 macOS runner), not forgotten.
	assert.equal(RUNTIME_TARGETS["osx-x64"], undefined);
});

test("Only Windows stages PortableGit and carries an exe suffix", () => {
	const win = resolveRuntimeTarget("win-x64");
	assert.equal(win.exe, ".exe");
	assert.equal(win.portableGit, true);
	assert.equal(runtimeBinaryName("TinadecTools", win), "TinadecTools.exe");

	for (const key of ["linux-x64", "osx-arm64"]) {
		const target = resolveRuntimeTarget(key);
		assert.equal(target.exe, "", `${key} must not invent an .exe suffix`);
		assert.equal(target.portableGit, false, `${key} uses system git`);
		assert.equal(runtimeBinaryName("TinadecTools", target), "TinadecTools");
	}
});

test("Every target names a rid, a bun target and a binary format", () => {
	for (const key of runtimeTargetKeys()) {
		const target = resolveRuntimeTarget(key);
		assert.ok(target.rid, `${key} needs a dotnet rid`);
		assert.equal(`${target.key.split("-")[0]}-${target.arch}`, target.rid, `${key} rid must match its arch`);
		assert.match(target.bunTarget, /^bun-/, `${key} compiles through Bun`);
		assert.ok(["pe", "elf", "macho"].includes(target.format), `${key} needs a header check`);
	}
});

test("An unknown target is refused by name and lists what exists", () => {
	assert.throws(() => resolveRuntimeTarget("linux-arm64"), /Unknown runtime target 'linux-arm64'.*win-x64, linux-x64, osx-arm64/s);
});

test("Staging is native-only, and the dropped hosts say so", () => {
	assert.equal(hostRuntimeTarget("win32", "x64").key, "win-x64");
	assert.equal(hostRuntimeTarget("linux", "x64").key, "linux-x64");
	assert.equal(hostRuntimeTarget("darwin", "arm64").key, "osx-arm64");
	assert.throws(() => hostRuntimeTarget("darwin", "x64"), /No runtime target for darwin\/x64/);
	assert.throws(() => hostRuntimeTarget("freebsd", "x64"), /Staging runs natively/);
});

test("A Linux x64 ELF binary is accepted and an ARM one is refused", async () => {
	const good = write("linux-x64", elf());
	assert.deepEqual(await readBinaryFormat(good), { format: "elf", detail: "class 2, machine 62" });
	await assertBinaryFormat(good, resolveRuntimeTarget("linux-x64"), "Core executable");

	// The whole point of reading e_machine: a linux-arm64 publish staged for a linux-x64 package
	// is otherwise indistinguishable at the file level.
	const wrongArch = write("linux-arm64", elf({ machine: 183 }));
	await assert.rejects(
		assertBinaryFormat(wrongArch, resolveRuntimeTarget("linux-x64"), "Core executable"),
		/Core executable is not elf \(elf: class 2, machine 183\)/,
	);
	const thirtyTwoBit = write("elf32", elf({ classBits: 1 }));
	await assert.rejects(assertBinaryFormat(thirtyTwoBit, resolveRuntimeTarget("linux-x64"), "Gateway"), /class 1/);
});

test("An arm64 Mach-O is accepted and an x86_64 one is refused", async () => {
	const good = write("osx-arm64", macho(0x0100000c));
	await assertBinaryFormat(good, resolveRuntimeTarget("osx-arm64"), "TinadecTools executable");

	const intel = write("osx-x64", macho(0x01000007));
	await assert.rejects(
		assertBinaryFormat(intel, resolveRuntimeTarget("osx-arm64"), "TinadecTools executable"),
		/cputype 0x1000007/,
	);
});

test("The header reader classifies the running host's own executable", async () => {
	// Portable and not vacuous: node/dotnet on this machine is a real binary of this platform's
	// format, so a reader that stops recognizing PE/ELF/Mach-O fails here even without fixtures.
	const target = hostRuntimeTarget();
	const { format } = await readBinaryFormat(process.execPath);
	assert.equal(format, target.format);
	await assertBinaryFormat(process.execPath, target, "host executable");
});

test("A file too short to hold a header is unknown, not silently accepted", async () => {
	const path = join(dir, "tiny");
	writeFileSync(path, Buffer.from("nope"));
	assert.deepEqual(await readBinaryFormat(path), { format: "unknown", detail: "file shorter than 64 bytes" });
	await assert.rejects(assertBinaryFormat(path, resolveRuntimeTarget("linux-x64"), "Core executable"), /is not elf/);
});
