import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { missingNativePackages } from "./check-lockfile-natives.mjs";
import { RUNTIME_TARGETS, runtimeTargetKeys } from "./runtimeTargets.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const lock = JSON.parse(readFileSync(join(rootDir, "package-lock.json"), "utf8"));

const ROLLUP_LINUX = "@rollup/rollup-linux-x64-gnu";
const ROLLUP_OSX = "@rollup/rollup-darwin-arm64";

// Lock keys are either hoisted ("node_modules/x") or nested ("node_modules/vite/node_modules/x");
// both spellings have to match, or a filter silently keeps the entry it meant to drop.
const isNative = (key, name) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`);

function without(name) {
	const packages = Object.fromEntries(Object.entries(lock.packages).filter(([key]) => !isNative(key, name)));
	return { packages };
}

test("The committed lockfile can install a working build for every target", () => {
	// This is the assertion that would have caught the npm/cli#4828 pruning: the lock only listed
	// the Windows rollup and esbuild binaries, so `vitest run` died at startup on both POSIX legs.
	for (const key of runtimeTargetKeys()) {
		assert.deepEqual(missingNativePackages(lock, RUNTIME_TARGETS[key]), [], `${key} lacks a native build dep`);
	}
});

test("Both native families are still in the tree, so the check above is not vacuous", () => {
	// A guard that silently skips a family nobody imports goes green forever. Pinning the parents
	// means an upgrade has to touch this test on purpose.
	for (const parent of ["node_modules/rollup", "node_modules/vite/node_modules/esbuild"]) {
		assert.ok(lock.packages[parent], `${parent} disappeared from the lockfile`);
	}
});

test("A pruned variant is reported for the target that needs it, and only that one", () => {
	const trimmed = without(ROLLUP_LINUX);

	assert.deepEqual(
		missingNativePackages(trimmed, RUNTIME_TARGETS["linux-x64"]),
		[`package-lock.json has no entry for '${ROLLUP_LINUX}'`],
	);
	assert.deepEqual(missingNativePackages(trimmed, RUNTIME_TARGETS["osx-arm64"]), []);
	assert.deepEqual(missingNativePackages(trimmed, RUNTIME_TARGETS["win-x64"]), []);
});

test("An entry labelled for the wrong platform is not enough", () => {
	// Hand-editing a lockfile can put the right name on the wrong body; npm ci would then install a
	// binary the loader refuses to require.
	const mislabelled = {
		packages: Object.fromEntries(
			Object.entries(lock.packages).map(([key, entry]) =>
				isNative(key, ROLLUP_OSX) ? [key, { ...entry, os: ["win32"], cpu: ["x64"] }] : [key, entry],
			),
		),
	};

	const problems = missingNativePackages(mislabelled, RUNTIME_TARGETS["osx-arm64"]);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /cannot serve osx-arm64/);
});

test("A parent that no longer declares the variant is caught before the entry is looked up", () => {
	// If rollup changes its variant naming, an entry that merely exists proves nothing — the loader
	// asks for the name the parent declares.
	const stale = {
		packages: Object.fromEntries(
			Object.entries(lock.packages).map(([key, entry]) =>
				key === "node_modules/rollup"
					? [key, { ...entry, optionalDependencies: Object.fromEntries(
							Object.entries(entry.optionalDependencies).filter(([name]) => name !== ROLLUP_OSX),
						) }]
					: [key, entry],
			),
		),
	};

	assert.match(
		missingNativePackages(stale, RUNTIME_TARGETS["osx-arm64"])[0],
		/does not declare '@rollup\/rollup-darwin-arm64'/,
	);
});
