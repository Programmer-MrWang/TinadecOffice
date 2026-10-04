import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
	ARCHIVE_MAGIC,
	channelFacts,
	mergeChannelCatalogs,
	mergeExpectedArtifact,
	matchesArchiveMagic,
	PLATFORM_NEUTRAL_PRODUCT_FIELDS,
} from "./officeChannel.mjs";
import { RUNTIME_TARGETS, resolveRuntimeTarget, runtimeTargetKeys } from "./runtimeTargets.mjs";

const scriptsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const VERSION = "9.9.9";
const TARGETS = runtimeTargetKeys();

function facts(key) {
	return channelFacts(resolveRuntimeTarget(key));
}

/// A runtime-module product exactly as the packager writes it, with every platform-dependent string
/// taken from the shared table. If the table and the merge ever disagree about what a target claims,
/// these fixtures stop building a catalog that merges.
function moduleProduct(targetKey, component) {
	const target = facts(targetKey);
	const productId = `tinadec-office-${component}`;
	const packageMetadata = {
		schemaVersion: 1,
		kind: "runtime-module",
		productLine: "office",
		productId,
		component,
		releaseVersion: VERSION,
		packageVersion: VERSION,
		platform: target.platform,
		architecture: target.architecture,
		entrypoint: target.entrypoint(component),
		expectedFiles: target.expectedFiles(component),
	};
	return {
		id: productId,
		name: `TinadecOffice ${component}`,
		family: component,
		productLine: "office",
		packageKind: "runtime-module",
		runtimeRole: component,
		description: "shared description",
		delivery: "native-exe",
		probe: "process-name",
		probeTarget: "TinadecComponent",
		expectedArtifact: target.entrypoint(component),
		allowMultipleInstances: false,
		supportsStandaloneLaunch: false,
		installable: true,
		releases: [
			{
				id: `${productId}-${VERSION}`,
				version: VERSION,
				channel: "stable",
				publishedAt: `2026-10-0${TARGETS.indexOf(targetKey) + 1}T00:00:00.000Z`,
				artifacts: [
					{
						id: `${productId}-${VERSION}-${targetKey}`,
						platform: target.platform,
						architecture: target.architecture,
						format: target.archiveFormat,
						url: `https://example.invalid/releases/${encodeURIComponent(target.moduleFile(component, VERSION))}`,
						sizeBytes: 100 + TARGETS.indexOf(targetKey),
						sha256: "0".repeat(64),
					},
				],
				dependencies: [],
				packageMetadata,
			},
		],
	};
}

function desktopProduct(targetKey) {
	const target = facts(targetKey);
	const productId = "tinadec-office-desktop";
	const packageMetadata = {
		schemaVersion: 1,
		kind: "full-installer",
		productLine: "office",
		productId,
		component: "desktop",
		releaseVersion: VERSION,
		packageVersion: VERSION,
		platform: target.platform,
		architecture: target.architecture,
	};
	return {
		id: productId,
		name: "TinadecOffice Desktop",
		family: "app",
		productLine: "office",
		packageKind: "full-installer",
		runtimeRole: undefined,
		description: "shared description",
		delivery: "portable-exe",
		probe: "process-name",
		probeTarget: "TinadecOffice",
		// No platform-neutral marker: the Manager stages a single-file installer as `artifact.id`.
		expectedArtifact: "",
		allowMultipleInstances: true,
		supportsStandaloneLaunch: true,
		installable: true,
		releases: [
			{
				id: `${productId}-${VERSION}`,
				version: VERSION,
				channel: "stable",
				publishedAt: `2026-10-0${TARGETS.indexOf(targetKey) + 1}T00:00:00.000Z`,
				artifacts: target.installerAssets.map((asset) => ({
					id: `${productId}-${VERSION}-${asset.idSuffix}`,
					platform: target.platform,
					architecture: target.architecture,
					format: "executable",
					url: `https://example.invalid/releases/TinadecOffice-${VERSION}${asset.suffix}`,
					sizeBytes: 1000,
					sha256: "1".repeat(64),
				})),
				dependencies: [],
				packageMetadata,
			},
		],
	};
}

function fragment(targetKey) {
	const target = facts(targetKey);
	return {
		file: `catalog-${targetKey}.json`,
		catalog: {
			schemaVersion: 1,
			kind: "office-channel-fragment",
			target: targetKey,
			officeReleaseVersion: VERSION,
			generatedAt: "2026-10-04T00:00:00.000Z",
			managerMinimumVersion: "0.1.0",
			releaseBaseUrl: "https://example.invalid/releases/download/v" + VERSION,
			products: [moduleProduct(targetKey, "core"), desktopProduct(targetKey)],
		},
	};
}

function allFragments() {
	return TARGETS.map(fragment);
}

function merged(fragments = allFragments()) {
	return mergeChannelCatalogs(fragments, { version: VERSION, generatedAt: "2026-10-04T12:00:00.000Z", requiredTargets: TARGETS });
}

test("Each target archives its modules in the format its own tar can read back", () => {
	assert.deepEqual(facts("win-x64").tarCreateArgs, ["-a", "-cf"]);
	assert.equal(facts("win-x64").archiveFormat, "zip");
	for (const key of ["linux-x64", "osx-arm64"]) {
		const target = facts(key);
		// GNU tar writes a *tar* archive when told to make a zip and exits 0, then refuses to read a
		// real zip — so a POSIX leg that shipped `.zip` would verify green on its own host and be
		// uninstallable by the Manager, which calls the same `tar`.
		assert.deepEqual(target.tarCreateArgs, ["-czf"], `${key} must not ask tar for a zip`);
		assert.equal(target.archiveFormat, "tar-gz");
		assert.equal(target.archiveExt, ".tar.gz");
	}
	assert.equal(
		new Set(TARGETS.map((key) => facts(key).archiveFormat)).size,
		2,
		"one format for Windows, one for POSIX: a single shared format would be unreadable somewhere",
	);
});

test("Module file names, entry points and executable lists follow the target", () => {
	assert.equal(facts("win-x64").moduleFile("core", VERSION), "tinadec-office-core-9.9.9-win-x64.zip");
	assert.equal(facts("linux-x64").agentPackFile(VERSION), "tinadec-office-agentpack-9.9.9-linux-x64.tar.gz");
	assert.equal(facts("osx-arm64").entrypoint("tools"), "TinadecTools");
	assert.equal(facts("win-x64").entrypoint("tools"), "TinadecTools.exe");

	assert.deepEqual(facts("linux-x64").expectedFiles("core"), [
		"TinadecCore.Api",
		"appsettings.json",
		"Configuration/default-agent-runtime.toml",
	]);
	// `rg.exe` in a Linux module is a missing file twice over: the entry never extracts, and the
	// byte-for-byte comparison against the staged runtime cannot line up.
	assert.deepEqual(facts("linux-x64").expectedFiles("tools"), [
		"TinadecTools",
		"Nlog.config",
		"rg",
		"native/rg/rg",
	]);
	assert.deepEqual(facts("win-x64").expectedFiles("tools"), [
		"TinadecTools.exe",
		"Nlog.config",
		"rg.exe",
		"native/rg/rg.exe",
		"git/cmd/git.exe",
		"git/bin/bash.exe",
	]);
	assert.deepEqual(facts("osx-arm64").executables("tools"), ["TinadecTools", "rg", "native/rg/rg"]);
});

test("PortableGit is a Windows module concern only", () => {
	assert.deepEqual(facts("win-x64").extraSources("tools"), [
		["native", "native"],
		["git", "git"],
	]);
	for (const key of ["linux-x64", "osx-arm64"]) {
		assert.deepEqual(facts(key).extraSources("tools"), [["native", "native"]], `${key} uses system git`);
		assert.equal(
			facts(key)
				.expectedFiles("tools")
				.some((file) => file.startsWith("git/")),
			false,
			`${key} must not demand a git tree it never staged`,
		);
	}
});

test("The channel speaks the Manager's platform names and finds this target's unpacked runtime", () => {
	assert.deepEqual(
		TARGETS.map((key) => `${facts(key).platform}/${facts(key).architecture}`),
		["windows/x64", "linux/x64", "macos/arm64"],
	);
	assert.deepEqual(
		TARGETS.map((key) => facts(key).unpackedRuntimeDir("/r").replaceAll("\\", "/")),
		[
			"/r/win-unpacked/resources/runtime",
			"/r/linux-unpacked/resources/runtime",
			"/r/mac-arm64/resources/runtime",
		],
	);
});

test("Only Windows declares two installer assets", () => {
	assert.deepEqual(
		facts("win-x64").installerAssets.map((asset) => asset.suffix),
		["-win-x64-setup.exe", "-win-x64-portable.exe"],
	);
	assert.deepEqual(facts("linux-x64").installerAssets.map((asset) => asset.suffix), ["-linux-x64.deb"]);
	assert.deepEqual(facts("osx-arm64").installerAssets.map((asset) => asset.suffix), ["-osx-arm64.dmg"]);
});

test("The archive magic separates a zip from the tar a `.zip` name can hide", () => {
	assert.equal(matchesArchiveMagic(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "zip"), true);
	// What GNU tar actually writes for `-a -cf module.zip`: "./" then NULs, i.e. a ustar header.
	assert.equal(matchesArchiveMagic(Buffer.from([0x2e, 0x2f, 0x00, 0x00]), "zip"), false);
	assert.equal(matchesArchiveMagic(Buffer.from([0x1f, 0x8b, 0x08, 0x00]), "tar-gz"), true);
	assert.equal(matchesArchiveMagic(Buffer.from([0x1f, 0x8b, 0x08, 0x00]), "zip"), false);
	assert.deepEqual(ARCHIVE_MAGIC.zip, [0x50, 0x4b, 0x03, 0x04]);
});

test("Three fragments merge into one release per product with one artifact per platform", () => {
	const result = merged();
	assert.deepEqual(result.issues, []);
	const catalog = result.catalog;
	assert.equal(catalog.schemaVersion, 1);
	assert.equal(catalog.managerMinimumVersion, "0.1.0");
	assert.deepEqual(catalog.products.map((product) => product.id), ["tinadec-office-core", "tinadec-office-desktop"]);

	const core = catalog.products[0];
	assert.equal(core.releases.length, 1);
	const release = core.releases[0];
	assert.deepEqual(
		release.artifacts.map((artifact) => `${artifact.platform}/${artifact.architecture} ${artifact.format}`),
		["windows/x64 zip", "linux/x64 tar-gz", "macos/arm64 tar-gz"],
	);
	// The archive-root metadata can no longer live on the release: three platforms have three
	// different roots, and the artifact is what says which bytes those roots belong to.
	assert.equal(release.packageMetadata, undefined);
	assert.deepEqual(release.artifacts.map((artifact) => artifact.packageMetadata?.platform), ["windows", "linux", "macos"]);
	assert.deepEqual(release.artifacts.map((artifact) => artifact.packageMetadata?.entrypoint), [
		"TinadecCore.Api.exe",
		"TinadecCore.Api",
		"TinadecCore.Api",
	]);

	const desktop = catalog.products[1].releases[0];
	assert.equal(desktop.artifacts.length, 4, "setup + portable + deb + dmg");
	assert.deepEqual([...new Set(desktop.artifacts.map((artifact) => artifact.id))].length, 4);
});

test("An entry point that differs only by an extension merges into one wildcard marker", () => {
	const result = merged();
	assert.deepEqual(result.issues, []);
	assert.equal(result.catalog.products[0].expectedArtifact, "TinadecCore.Api*");
	// A product that declares no marker anywhere keeps declaring none, rather than inheriting one
	// leg's platform-specific name that the other two legs' installs would fail.
	assert.equal(result.catalog.products[1].expectedArtifact, "");
});

test("A marker that differs by more than an extension is refused, not globbed", () => {
	const fragments = allFragments();
	// One leg that ships a differently named launcher is a build mistake, not a naming style: globbing
	// it would produce a marker that matches files that are not the entry point.
	fragments[1].catalog.products[0].expectedArtifact = "TinadecCore";
	const result = merged(fragments);
	assert.equal(result.catalog, null);
	assert.match(
		result.issues.join("\n"),
		/differs by more than an extension/s,
		"a naming surprise must not become a wildcard that matches anything",
	);
});

test("Merging reports which two legs disagree, with both readings", () => {
	const fragments = allFragments();
	fragments[2].catalog.products[0].description = "another description";
	const result = merged(fragments);
	assert.equal(result.catalog, null);
	assert.equal(result.issues.length, 1, result.issues.join("\n"));
	assert.match(result.issues[0], /tinadec-office-core\.description differs between win-x64 \(.*shared description.*\) and osx-arm64 \(.*another description.*\)/);
});

test("A missing leg fails the merge by name", () => {
	const result = merged(allFragments().filter((entry) => entry.catalog.target !== "linux-x64"));
	assert.equal(result.catalog, null);
	assert.match(result.issues.join("\n"), /Channel fragments are missing for: linux-x64/);
});

test("Two fragments for the same target, or an unknown one, are refused", () => {
	const duplicated = [...allFragments(), fragment("linux-x64")];
	assert.match(merged(duplicated).issues.join("\n"), /Two fragments claim target linux-x64/);

	// A leftover file from a runner image that no longer ships (osx-x64) must not be merged: it would
	// publish an artifact for a platform no leg built in this release.
	const stale = allFragments();
	const orphan = structuredClone(stale[1]);
	orphan.catalog.target = "osx-x64";
	orphan.file = "catalog-osx-x64.json";
	const result = merged([...stale.slice(0, 2), orphan]);
	assert.equal(result.catalog, null);
	assert.match(result.issues.join("\n"), /catalog-osx-x64\.json claims target osx-x64, which is not in the shipping matrix/);
});

test("Every product must carry an artifact usable by every shipping target", () => {
	const fragments = allFragments();
	fragments[1].catalog.products[0].releases[0].artifacts = [];
	const result = merged(fragments);
	assert.equal(result.catalog, null);
	// This is the check that a half-declared channel fails: an office install on Linux would only
	// discover the gap at `pickArtifact()` time, after the download.
	assert.match(result.issues.join("\n"), /tinadec-office-core has no artifact usable by linux-x64 \(linux\)/);
});

test("An artifact cannot claim a platform its own archive metadata denies", () => {
	const fragments = allFragments();
	fragments[0].catalog.products[0].releases[0].artifacts[0].platform = "linux";
	const result = merged(fragments);
	assert.equal(result.catalog, null);
	assert.match(
		result.issues.join("\n"),
		/claims "linux"\/"x64" while win-x64's package metadata says "windows"\/"x64"/,
	);
});

test("A fragment from another release, or without metadata, stops the merge", () => {
	const wrongVersion = allFragments();
	wrongVersion[2].catalog.officeReleaseVersion = "9.9.8";
	assert.match(merged(wrongVersion).issues.join("\n"), /was packaged for release "9\.9\.8", merging into "9\.9\.9"/);

	const noMetadata = allFragments();
	delete noMetadata[0].catalog.products[0].releases[0].packageMetadata;
	assert.match(merged(noMetadata).issues.join("\n"), /has no release packageMetadata to mirror onto its artifacts/);
});

test("Products present on one leg and absent on another are reported", () => {
	const fragments = allFragments();
	fragments[2].catalog.products.pop();
	const result = merged(fragments);
	assert.equal(result.catalog, null);
	assert.match(result.issues.join("\n"), /the product id list differs between win-x64 .*and osx-arm64/);
});

test("The merged release is published once, at the newest fragment's timestamp", () => {
	const result = merged();
	assert.equal(result.catalog.products[0].releases[0].publishedAt, "2026-10-03T00:00:00.000Z");
	assert.equal(result.catalog.generatedAt, "2026-10-04T12:00:00.000Z");
});

test("The merge rule covers every field the Manager compares across platforms", () => {
	// If a product field is added to the packager and not to the neutral list, the merge would let one
	// leg's Windows-only value into a catalog that macOS installs from.
	const packager = readFileSync(join(scriptsDir, "package-office-channel.mjs"), "utf8");
	const productKeys = [...packager.matchAll(/^\t\t([a-zA-Z]+): /gmu)].map((match) => match[1]);
	for (const field of ["name", "family", "description", "delivery", "probe", "probeTarget", "installable"]) {
		assert.ok(productKeys.includes(field), `package-office-channel.mjs is expected to set ${field}`);
		assert.ok(
			PLATFORM_NEUTRAL_PRODUCT_FIELDS.includes(field),
			`${field} is product-level and must be compared across legs by the merge`,
		);
	}
	assert.ok(PLATFORM_NEUTRAL_PRODUCT_FIELDS.includes("expectedArtifact") === false, "expectedArtifact is merged, not compared");
});

test("Channel scripts take their platform facts from the table instead of hardcoding one leg", () => {
	for (const name of ["package-office-channel.mjs", "verify-office-channel.mjs", "merge-office-channel-catalog.mjs"]) {
		const source = readFileSync(join(scriptsDir, name), "utf8");
		assert.match(source, /from "\.\/officeChannel\.mjs"/, `${name} must use the shared channel model`);
		assert.doesNotMatch(source, /["']win-x64["']/u, `${name} must not name a target: it takes the host's from the table`);
		assert.doesNotMatch(source, /platform:\s*"windows"/u, `${name} must not hardcode a platform`);
		assert.doesNotMatch(source, /["'](?:Tinadec|rg|git)[A-Za-z.-]*\.exe/u, `${name} must not name a payload binary: the table spells it per target`);
	}
	assert.ok(
		Object.values(RUNTIME_TARGETS).every((target) => target.channelArchive && target.installerAssets && target.managerPlatform),
		"the runtime table has to carry the channel facts the scripts read",
	);

	// A tree copy has to state the mode it carries: `stage-runtime.mjs` chmods every staged binary to
	// 0755, an archive records whatever mode the file has when the archiver runs, and whether a plain
	// file copy keeps that bit over is host-dependent. Windows cannot show either half of this, so the
	// packager copies the mode explicitly and the verifier demands the bit from the extracted bytes.
	const packager = readFileSync(join(scriptsDir, "package-office-channel.mjs"), "utf8");
	const verifier = readFileSync(join(scriptsDir, "verify-office-channel.mjs"), "utf8");
	assert.match(packager, /chmodSync\(destinationPath, statSync\(sourcePath\)\.mode\)/, "the channel copy must carry the staged mode");
	assert.match(verifier, /mode & 0o100/, "the verifier must check the execute bit it is asking for");
});

test("The release job's channel gates match what the legs actually upload", () => {
	// The release job runs only on a tag, so a typo in its counts would surface as a failed publish
	// rather than as a red build. Derive every number from the target table instead, and compare.
	const workflow = readFileSync(resolve(scriptsDir, "..", "..", "..", ".github", "workflows", "desktop-release.yml"), "utf8");
	const archivesPerLeg = 4; // core, gateway, tools, agentpack
	const zipTargets = TARGETS.filter((key) => facts(key).archiveFormat === "zip").length;
	const tarTargets = TARGETS.length - zipTargets;
	assert.ok(zipTargets > 0 && tarTargets > 0);
	assert.match(workflow, new RegExp(`-name '\\*\\.zip' \\| wc -l\\)" -eq ${zipTargets * archivesPerLeg}`));
	assert.match(workflow, new RegExp(`-name '\\*\\.tar\\.gz' \\| wc -l\\)" -eq ${tarTargets * archivesPerLeg}`));
	assert.match(workflow, new RegExp(`-name 'catalog-\\*\\.json' \\| wc -l\\)" -eq ${TARGETS.length}`));

	// Every leg hands over its own archives and its own fragment; the leg-local SHA256SUMS stays
	// behind, because three files with one name in one artifact set keep only the last.
	const uploads = [...workflow.matchAll(/- name: Upload (\w+) package\n([\s\S]*?)if-no-files-found/gu)].map((match) => ({
		label: match[1].toLowerCase(),
		block: match[2],
	}));
	assert.equal(uploads.length, TARGETS.length, "one upload step per shipping target");
	for (const key of TARGETS) {
		const target = facts(key);
		const upload = uploads.find((entry) => entry.block.includes(`matrix.label == '${key}'`));
		assert.ok(upload, `${key} has no upload step`);
		assert.ok(
			upload.block.includes(`office-channel/*${target.archiveExt}`),
			`${key} must upload its ${target.archiveExt} channel archives`,
		);
		assert.ok(
			upload.block.includes(`office-channel/catalog-${key}.json`),
			`${key} must upload the fragment the release job merges`,
		);
		assert.equal(upload.block.includes("office-channel/SHA256SUMS"), false, `${key} must not publish a leg-local sums file`);
		assert.equal(upload.block.includes("office-channel/catalog.json"), false, `${key} must not write the merged catalog alone`);
	}

	// The two channel steps run for every leg: the window between them and the first upload step must
	// carry no `if:`, which is how the Windows-only channel was once the only channel.
	const channelSteps = workflow.slice(
		workflow.indexOf("- name: Package Office channel artifacts"),
		workflow.indexOf("- name: Upload Windows package"),
	);
	assert.ok(channelSteps.length > 0 && channelSteps.includes("Verify Office channel artifacts"));
	assert.equal(channelSteps.includes("if:"), false, "channel packaging and verification must not be pinned to one leg");

	// The release job is the only place all three exist, so it downloads all three and merges.
	for (const key of TARGETS) {
		assert.ok(workflow.includes(`name: TinadecOffice-${key}`), `release job must download ${key}`);
	}
	assert.match(workflow, /node apps\/desktop\/scripts\/merge-office-channel-catalog\.mjs release-artifacts\/office-channel/);
});

test("mergeExpectedArtifact keeps an identical value verbatim", () => {
	const issues = [];
	const samples = [
		{ target: "win-x64", value: "manifest.json" },
		{ target: "linux-x64", value: "manifest.json" },
	];
	assert.equal(mergeExpectedArtifact(samples, issues, "agentpack.expectedArtifact"), "manifest.json");
	assert.deepEqual(issues, []);
});

/// Stage a release directory the way the release job receives it: installers flat at the top, module
/// archives inside `office-channel/`, and each fragment pointing at bytes that exist. Only the leading
/// magic and the hashes matter to the merge, so the payloads are synthetic — which also keeps this
/// runnable on any one host, without bsdtar and GNU tar side by side.
function stageRelease(root) {
	mkdirSync(join(root, "office-channel"), { recursive: true });
	for (const key of TARGETS) {
		const entry = fragment(key);
		for (const product of entry.catalog.products) {
			for (const release of product.releases) {
				for (const artifact of release.artifacts) {
					const name = decodeURIComponent(artifact.url.split("/").pop());
					const moduleArchive = artifact.format !== "executable";
					const directory = moduleArchive ? join(root, "office-channel") : root;
					const head = moduleArchive
						? ARCHIVE_MAGIC[artifact.format]
						: [0x4d, 0x5a, 0x90, 0x00];
					const bytes = Buffer.concat([Buffer.from(head), Buffer.from(`${key}:${name}`)]);
					artifact.sizeBytes = bytes.length;
					artifact.sha256 = createHash("sha256").update(bytes).digest("hex");
					writeFileSync(join(directory, name), bytes);
				}
			}
		}
		writeFileSync(join(root, "office-channel", `catalog-${key}.json`), JSON.stringify(entry.catalog, null, 2));
	}
	return root;
}

function runMerge(root) {
	try {
		const output = execFileSync(
			process.execPath,
			[join(scriptsDir, "merge-office-channel-catalog.mjs"), join(root, "office-channel")],
			{ encoding: "utf8", env: { ...process.env, OFFICE_RELEASE_VERSION: VERSION } },
		);
		return { status: 0, output };
	} catch (error) {
		return { status: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
	}
}

function tempRoot() {
	return mkdtempSync(join(tmpdir(), "tinadec-office-channel-"));
}

test("The merge command writes a catalog that names every artifact on disk", () => {
	const root = tempRoot();
	try {
		stageRelease(root);
		const result = runMerge(root);
		assert.equal(result.status, 0, result.output);
		assert.match(result.output, /Merged 3 channel fragments/);
		assert.match(result.output, /7 artifacts verified on disk/);
		const listedPlatforms = result.output.match(/across (.*)\./u)[1].split(", ");
		assert.deepEqual(listedPlatforms, ["linux/x64", "macos/arm64", "windows/x64"]);
		const catalog = JSON.parse(readFileSync(join(root, "office-channel", "catalog.json"), "utf8"));
		assert.deepEqual(catalog.products.map((product) => product.id), ["tinadec-office-core", "tinadec-office-desktop"]);
		assert.equal(catalog.products[0].releases[0].artifacts.length, 3);
		// The merge command is the only writer of catalog.json, so a leg cannot publish one alone.
		assert.equal(existsSync(join(root, "office-channel", "catalog-win-x64.json")), true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("A module archive whose bytes moved is refused by name", () => {
	const root = tempRoot();
	try {
		stageRelease(root);
		writeFileSync(join(root, "office-channel", "tinadec-office-core-9.9.9-linux-x64.tar.gz"), Buffer.concat([Buffer.from([0x1f, 0x8b, 0x08, 0x00]), Buffer.from("tampered")]));
		const result = runMerge(root);
		assert.equal(result.status, 1);
		assert.match(result.output, /tinadec-office-core-9\.9\.9-linux-x64\.tar\.gz SHA-256 does not match/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("A `.zip` holding a tar header is refused instead of published", () => {
	const root = tempRoot();
	try {
		stageRelease(root);
		// Exactly what GNU tar produces when a POSIX leg is told to make a zip: a ustar header under a
		// `.zip` name. Re-hashed so only the format gate can catch it.
		const path = join(root, "office-channel", "tinadec-office-core-9.9.9-win-x64.zip");
		const bytes = Buffer.concat([Buffer.from([0x2e, 0x2f, 0x00, 0x00]), Buffer.from("not a zip")]);
		writeFileSync(path, bytes);
		const fragmentPath = join(root, "office-channel", "catalog-win-x64.json");
		const catalog = JSON.parse(readFileSync(fragmentPath, "utf8"));
		const artifact = catalog.products[0].releases[0].artifacts[0];
		artifact.sizeBytes = bytes.length;
		artifact.sha256 = createHash("sha256").update(bytes).digest("hex");
		writeFileSync(fragmentPath, JSON.stringify(catalog, null, 2));

		const result = runMerge(root);
		assert.equal(result.status, 1);
		assert.match(result.output, /declared as zip but starts with 2e2f0000/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("A catalog that names a file the release does not carry is refused", () => {
	const root = tempRoot();
	try {
		stageRelease(root);
		rmSync(join(root, "TinadecOffice-9.9.9-osx-arm64.dmg"));
		const result = runMerge(root);
		assert.equal(result.status, 1);
		assert.match(result.output, /TinadecOffice-9\.9\.9-osx-arm64\.dmg, which is not in this release/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
