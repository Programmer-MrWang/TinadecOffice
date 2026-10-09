import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BUBBLEWRAP_COMMIT, BUBBLEWRAP_SOURCE_SHA256, BUBBLEWRAP_VERSION, stageBubblewrap, verifyBubblewrap } from "./bubblewrap-pin.mjs";

test("the reviewed source pin is exact", () => {
	assert.equal(BUBBLEWRAP_VERSION, "0.13.0"); assert.match(BUBBLEWRAP_COMMIT, /^[a-f0-9]{40}$/); assert.match(BUBBLEWRAP_SOURCE_SHA256, /^[a-f0-9]{64}$/);
});
test("Windows and macOS staging do no binary work", () => {
	for (const platform of ["win32", "darwin"]) assert.equal(stageBubblewrap({ platform, run: () => { throw Error("must not execute"); } }), null);
});
test("Linux packaging refuses a missing or unreviewed binary", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "tinadec-bwrap-test-"));
	try {
		assert.throws(() => stageBubblewrap({ rootDir, platform: "linux", env: {}, destinationDirectory: join(rootDir, "tools") }), /setup:bwrap/);
		const binary = join(rootDir, "wrong"); writeFileSync(binary, "wrong version");
		assert.throws(() => verifyBubblewrap(binary, () => ({ status: 0, stdout: "bubblewrap 0.11.0" })), /reviewed bubblewrap 0.13.0/);
	} finally { rmSync(rootDir, { recursive: true, force: true }); }
});
test("Linux staging copies and rechecks the selected actual bytes", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "tinadec-bwrap-test-"));
	try {
		const native = join(rootDir, "native", "bwrap"); mkdirSync(native, { recursive: true }); writeFileSync(join(native, "bwrap"), "native bytes");
		let checks = 0;
		const run = (_binary, args, options) => { checks++; assert.deepEqual(args, ["--version"]); assert.equal(options.env.TINADEC_HOST_CONTROL_TOKEN, undefined); return { status: 0, stdout: "bubblewrap 0.13.0\n" }; };
		const destinationDirectory = join(rootDir, "tools");
		assert.equal(readFileSync(stageBubblewrap({ rootDir, destinationDirectory, platform: "linux", env: {}, run }), "utf8"), "native bytes");
		const selected = join(rootDir, "selected"); writeFileSync(selected, "explicit bytes");
		assert.equal(readFileSync(stageBubblewrap({ rootDir, destinationDirectory, platform: "linux", env: { TINADEC_TOOLS_BWRAP_PATH: selected }, run }), "utf8"), "explicit bytes");
		assert.equal(checks, 4);
	} finally { rmSync(rootDir, { recursive: true, force: true }); }
});
