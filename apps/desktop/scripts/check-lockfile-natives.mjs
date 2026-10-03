import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hostRuntimeTarget, resolveRuntimeTarget, runtimeTargetKeys } from "./runtimeTargets.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = resolve(desktopDir, "..", "..");

/// Toolchains whose loader requires a platform-specific binary package at startup. `npm ci`
/// installs exactly the packages the lockfile lists, and a lockfile generated on Windows by the
/// bug in npm/cli#4828 lists only the Windows variants — so on a Linux or macOS runner the
/// require() fails at startup and the log says "Cannot find module @rollup/rollup-linux-x64-gnu"
/// instead of "this lockfile is incomplete".
const NATIVE_FAMILIES = [
	{
		parent: "rollup",
		// The exact name dist/native.js requires. The musl and mingw alternates are deliberately not
		// here: no target builds on them, and requiring them would let a glibc runner pass on a lock
		// that only carries the musl binary.
		nameFor: (os, cpu) => ROLLUP_BASE[`${os}-${cpu}`] && `@rollup/rollup-${ROLLUP_BASE[`${os}-${cpu}`]}`,
	},
	{
		parent: "esbuild",
		nameFor: (os, cpu) => `@esbuild/${os}-${cpu}`,
	},
];

const ROLLUP_BASE = {
	"win32-x64": "win32-x64-msvc",
	"linux-x64": "linux-x64-gnu",
	"darwin-arm64": "darwin-arm64",
};

function packageEntries(lock) {
	return Object.entries(lock.packages ?? {});
}

function parentScopes(entries, parent) {
	return entries.filter(([key]) => key === `node_modules/${parent}` || key.endsWith(`/node_modules/${parent}`));
}

function nativeEntry(entries, name) {
	return entries.find(
		([key, entry]) => (key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`)) && entry.os && entry.cpu,
	);
}

/// Returns the list of problems; empty means this host's `npm ci` will have every native the build
/// loads. A family whose parent is no longer in the tree is skipped, so an upgrade that drops
/// rollup doesn't leave this script demanding a package nothing imports.
export function missingNativePackages(lock, target) {
	const entries = packageEntries(lock);
	const problems = [];

	for (const family of NATIVE_FAMILIES) {
		const parents = parentScopes(entries, family.parent);
		if (parents.length === 0) continue;

		const required = family.nameFor(target.platform, target.arch);
		if (!required) {
			// A new row in RUNTIME_TARGETS has to be added to the name table above, not quietly
			// excused: an unchecked native is a startup crash on that runner.
			problems.push(`no known ${family.parent} native name for ${target.key}`);
			continue;
		}
		const declared = parents.every(([, entry]) => (entry.optionalDependencies ?? {})[required] !== undefined);
		if (!declared) {
			problems.push(`${family.parent} does not declare '${required}' as an optional dependency`);
			continue;
		}

		const found = nativeEntry(entries, required);
		if (!found) {
			problems.push(`package-lock.json has no entry for '${required}'`);
			continue;
		}
		const [key, entry] = found;
		if (!entry.os.includes(target.platform) || !entry.cpu.includes(target.arch)) {
			problems.push(
				`'${required}' is locked as os=${entry.os.join("|")} cpu=${entry.cpu.join("|")}, ` +
					`which cannot serve ${target.key} (${key})`,
			);
		}
	}

	return problems;
}

export function readLockfile(path = join(rootDir, "package-lock.json")) {
	return JSON.parse(readFileSync(path, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const raw = process.argv[2];
	const target = raw ? resolveRuntimeTarget(raw) : hostRuntimeTarget();
	const problems = missingNativePackages(readLockfile(), target);
	if (problems.length > 0) {
		console.error(
			`The lockfile cannot install the native packages ${target.key} needs:\n` +
				problems.map((p) => `  - ${p}`).join("\n") +
				`\nRegenerate it from a clean tree: npm ci fails on this platform until the missing ` +
				`variants are listed (npm/cli#4828 prunes them on the host that generated the lockfile).`,
		);
		process.exit(1);
	}
	console.log(`${target.key}: every build-time native package is in the lockfile.`);
	console.log(`Checked families for ${runtimeTargetKeys().join(", ")} targets.`);
}
