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
///
/// Hand-writing the missing entries is not enough either: an entry nested under its parent
/// (`node_modules/vite/node_modules/@esbuild/linux-x64`) is silently dropped by `npm ci` on every
/// host that did not generate the lockfile, while a hoisted one survives. Verified by installing
/// all three views from the same lock. The shape that survives on all of them is a declaration in
/// the root package.json — which is also the only shape npm keeps correct when somebody on another
/// OS regenerates the lock.
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

/// Returns the list of problems; empty means a real `npm ci` on that target's host installs every
/// native the build loads. A family whose parent is no longer in the tree is skipped, so an upgrade
/// that drops rollup doesn't leave this script demanding a package nothing imports.
export function missingNativePackages(lock, target, rootOptionalDependencies) {
	const entries = packageEntries(lock);
	const declaredAtRoot = rootOptionalDependencies ?? {};
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

		if (declaredAtRoot[required] === undefined) {
			problems.push(
				`'${required}' is not in the root package.json optionalDependencies, so npm ci drops ` +
					`it on every host that did not generate this lockfile`,
			);
		} else if (entry.version !== declaredAtRoot[required]) {
			// esbuild refuses to start when its JS side and the binary disagree about the version, so
			// a pin that drifts from what vite resolved is a build failure with a confusing message.
			problems.push(
				`'${required}' is pinned at ${declaredAtRoot[required]} but the lockfile carries ` +
					`${entry.version}; pin the version ${family.parent} actually resolved`,
			);
		}
	}

	return problems;
}

export function readLockfile(path = join(rootDir, "package-lock.json")) {
	return JSON.parse(readFileSync(path, "utf8"));
}

export function readRootOptionalDependencies(path = join(rootDir, "package.json")) {
	return JSON.parse(readFileSync(path, "utf8")).optionalDependencies ?? {};
}

/// Every native the matrix needs across every target — exactly what the root package.json has to
/// declare, so a new RUNTIME_TARGETS row can't quietly stop being covered.
export function requiredNativePackages(targetKeys = runtimeTargetKeys()) {
	const names = new Set();
	for (const key of targetKeys) {
		const target = resolveRuntimeTarget(key);
		for (const family of NATIVE_FAMILIES) {
			const required = family.nameFor(target.platform, target.arch);
			if (required) names.add(required);
		}
	}
	return [...names].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const raw = process.argv[2];
	const target = raw ? resolveRuntimeTarget(raw) : hostRuntimeTarget();
	const problems = missingNativePackages(readLockfile(), target, readRootOptionalDependencies());
	if (problems.length > 0) {
		console.error(
			`The lockfile cannot install the native packages ${target.key} needs:\n` +
				problems.map((p) => `  - ${p}`).join("\n") +
				`\nDeclare them in the root package.json's optionalDependencies, then run ` +
				`npm install --package-lock-only (npm/cli#4828 prunes undeclared platform binaries).`,
		);
		process.exit(1);
	}
	console.log(`${target.key}: every build-time native package is declared, locked and installable.`);
}
