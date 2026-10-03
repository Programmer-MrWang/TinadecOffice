import { open } from "node:fs/promises";

/// The headers are read in bounded pieces, never by slurping the file: a self-contained
/// TinadecTools is over 60 MB, and `readFileSync` of it blew the pipe buffer while this project
/// was still on the whole-file version of this check.

const PROBE = 64;

async function peek(path, position, length) {
	const handle = await open(path, "r");
	try {
		const buffer = Buffer.alloc(length);
		const { bytesRead } = await handle.read(buffer, 0, length, position);
		return bytesRead === length ? buffer : null;
	} finally {
		await handle.close();
	}
}

/// Returns `{ format, detail }` where format is pe | elf | macho | unknown, and detail names the
/// machine/class field so a wrong-arch binary is reported rather than merely refused.
export async function readBinaryFormat(path) {
	const head = await peek(path, 0, PROBE);
	if (!head) return { format: "unknown", detail: "file shorter than 64 bytes" };

	if (head.readUInt16LE(0) === 0x5a4d) {
		const peOffset = head.readUInt32LE(0x3c);
		// The PE header sits wherever the DOS stub says, typically ~0xf0: read that window too.
		const pe = await peek(path, peOffset, 6);
		if (!pe || pe.readUInt32LE(0) !== 0x00004550) {
			return { format: "pe", detail: "no PE signature at the declared header offset" };
		}
		return { format: "pe", detail: `machine 0x${pe.readUInt16LE(4).toString(16)}` };
	}

	if (head[0] === 0x7f && head.readUInt32BE(0) === 0x7f454c46) {
		return {
			format: "elf",
			detail: `class ${head[5]}, machine ${head.readUInt16LE(18)}`,
		};
	}

	const magic = head.readUInt32LE(0);
	if (magic === 0xfeedfacf || magic === 0xfeedface) {
		return { format: "macho", detail: `cputype 0x${head.readUInt32LE(4).toString(16)}` };
	}
	if (magic === 0xcafebabe || magic === 0xbebafeca) {
		return { format: "macho", detail: "fat binary" };
	}

	return { format: "unknown", detail: `first bytes ${head.subarray(0, 4).toString("hex")}` };
}

const EXPECTED = {
	pe: (detail) => detail === "machine 0x8664",
	elf: (detail) => detail === "class 2, machine 62",
	macho: (detail) => detail === "cputype 0x100000c",
};

/// Throws unless the file is the machine code the target platform executes. `label` is the human
/// name used in the message, because "not Windows x64" tells a builder nothing without the file.
export async function assertBinaryFormat(path, target, label) {
	const { format, detail } = await readBinaryFormat(path);
	const expected = target.format;
	if (format !== expected || !EXPECTED[expected]?.(detail)) {
		throw new Error(
			`${label} is not ${expected} (${format}: ${detail}): ${path}`,
		);
	}
	return { format, detail };
}
