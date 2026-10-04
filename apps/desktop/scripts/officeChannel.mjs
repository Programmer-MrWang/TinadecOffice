import { join } from "node:path";

import { RUNTIME_TARGETS, runtimeBinaryName } from "./runtimeTargets.mjs";

/// The Office channel model in one place: what a module is called for a target, what has to be
/// inside it, and how three legs' catalog fragments become the single `catalog.json` the Manager
/// reads. The packager and the verifier both import this file, so "what we shipped" and "what we
/// demand" cannot drift the way two hand-copied expected-file lists did before they were merged.

export const CHANNEL_COMPONENTS = {
	core: {
		productId: "tinadec-office-core",
		binary: "TinadecCore.Api",
		resourceFiles: ["appsettings.json", "Configuration/default-agent-runtime.toml"],
	},
	gateway: {
		productId: "tinadec-office-gateway",
		binary: "TinadecGateway",
		resourceFiles: [],
	},
	tools: {
		productId: "tinadec-office-tools",
		binary: "TinadecTools",
		resourceFiles: ["Nlog.config"],
	},
};

export const AGENT_PACK_PRODUCT_ID = "tinadec-office-agentpack";

/// Leading bytes that decide what an archive actually is. `format` in the catalog is a promise to
/// the consumer, and GNU tar breaks it silently: `tar -a -cf module.zip` exits 0 having written a
/// **tar** archive (first bytes `2e 2f 00 00`, not `50 4b 03 04`), then refuses to read a real zip
/// with "This does not look like a tar archive". Hence tar.gz on the POSIX legs.
export const ARCHIVE_MAGIC = {
	zip: [0x50, 0x4b, 0x03, 0x04],
	"tar-gz": [0x1f, 0x8b],
};

export function matchesArchiveMagic(bytes, format) {
	const expected = ARCHIVE_MAGIC[format];
	if (!expected) return false;
	return expected.every((byte, index) => bytes[index] === byte);
}

/// Per-target channel facts. Everything the two scripts must agree on is derived here rather than
/// spelled out per platform, because the Windows name of an entry point (`rg.exe`) is a Linux
/// install failure and the POSIX name is one on Windows.
export function channelFacts(target) {
	const rgName = runtimeBinaryName("rg", target);
	const entrypoint = (component) => runtimeBinaryName(CHANNEL_COMPONENTS[component].binary, target);

	return {
		key: target.key,
		platform: target.managerPlatform,
		architecture: target.arch,
		archiveFormat: target.channelArchive.format,
		archiveExt: target.channelArchive.ext,
		tarCreateArgs: target.channelArchive.format === "zip" ? ["-a", "-cf"] : ["-czf"],
		moduleFile: (component, version) =>
			`${CHANNEL_COMPONENTS[component].productId}-${version}-${target.key}${target.channelArchive.ext}`,
		agentPackFile: (version) =>
			`${AGENT_PACK_PRODUCT_ID}-${version}-${target.key}${target.channelArchive.ext}`,
		entrypoint,
		// Tools merges the native staging directory into its archive root and, on Windows only, the
		// PortableGit tree — so its entry list is the one that has to know about both.
		expectedFiles: (component) => {
			if (component === "tools") {
				const files = [
					entrypoint("tools"),
					...CHANNEL_COMPONENTS.tools.resourceFiles,
					rgName,
					`native/rg/${rgName}`,
				];
				if (target.portableGit) files.push("git/cmd/git.exe", "git/bin/bash.exe");
				return files;
			}
			return [entrypoint(component), ...CHANNEL_COMPONENTS[component].resourceFiles];
		},
		/// Entries whose bytes must carry this target's machine code. Text resources are excluded, and
		/// PortableGit's binaries only exist on the leg that ships them.
		executables: (component) => {
			if (component === "tools") {
				const files = [entrypoint("tools"), rgName, `native/rg/${rgName}`];
				if (target.portableGit) files.push("git/cmd/git.exe", "git/bin/bash.exe");
				return files;
			}
			return [entrypoint(component)];
		},
		extraSources: (component) => {
			if (component !== "tools") return [];
			return target.portableGit
				? [
						["native", "native"],
						["git", "git"],
					]
				: [["native", "native"]];
		},
		installerAssets: target.installerAssets,
		unpackedRuntimeDir: (releaseDir) => join(releaseDir, ...target.unpackedResources, "runtime"),
	};
}

/// Fields a product must state identically on every leg. Anything outside this list is allowed to
/// differ per target — `expectedArtifact` is the deliberate one, resolved by the merge rule below.
export const PLATFORM_NEUTRAL_PRODUCT_FIELDS = [
	"name",
	"family",
	"productLine",
	"packageKind",
	"runtimeRole",
	"description",
	"delivery",
	"probe",
	"probeTarget",
	"allowMultipleInstances",
	"supportsStandaloneLaunch",
	"installable",
];

export const PLATFORM_NEUTRAL_RELEASE_FIELDS = ["id", "version", "channel", "dependencies"];

function describe(value) {
	return JSON.stringify(value) ?? "undefined";
}

/// Three legs have to agree or the merge names the pair and both readings: "products differ" is a
/// useless build failure when the fix is one literal in one leg's script.
function requireAgreement(samples, label, issues) {
	const first = samples[0];
	for (const sample of samples.slice(1)) {
		if (JSON.stringify(sample.value) !== JSON.stringify(first.value)) {
			issues.push(
				`${label} differs between ${first.target} (${describe(first.value)}) and ${sample.target} (${describe(sample.value)}).`,
			);
		}
	}
	return first.value;
}

/// A product-level `expectedArtifact` is checked after extraction, where one path has to serve every
/// operating system. Entry points differ only by an extension (`.exe` on Windows), so the merged
/// value is the shared name plus the wildcard form the Manager already matches in its own builtin
/// catalog. A product with no platform-neutral marker opts out with an empty string — which is what
/// `artifactExists()` treats as "no gate", and strictly better than today's Windows-only asset name,
/// which the Manager's staging copy (`staging/<artifact.id>`) can never satisfy.
export function mergeExpectedArtifact(samples, issues, label) {
	const absent = samples.filter((sample) => typeof sample.value !== "string").map((sample) => sample.target);
	if (absent.length !== 0) {
		issues.push(`${label} is missing on ${absent.join(", ")}.`);
		return "";
	}
	if (samples.some((sample) => sample.value.trim().length === 0)) return "";
	const values = [...new Set(samples.map((sample) => sample.value))];
	if (values.length === 1) return values[0];

	const prefix = values.reduce((common, value) => {
		let index = 0;
		while (index < common.length && index < value.length && common[index] === value[index]) index += 1;
		return common.slice(0, index);
	});
	for (const value of values) {
		const remainder = value.slice(prefix.length);
		if (remainder !== "" && !/^\.[A-Za-z0-9]+$/u.test(remainder)) {
			issues.push(
				`${label} differs by more than an extension across targets: ${values.join(", ")}. ` +
					`Set an empty expectedArtifact if no platform-neutral marker exists.`,
			);
			return "";
		}
	}
	return `${prefix}*`;
}

/// Merge the per-leg fragments into the published `catalog.json`.
///
/// Each fragment is the complete product list for one target: no leg can build another platform's
/// runtime, so no leg can write a whole catalog. The merged shape keeps one product per id and one
/// release per version — which is what the Manager's `pickArtifact()` selects from — and moves the
/// archive-root metadata mirror onto the artifact it describes, because three platforms now ship
/// three different archive roots and a release can only hold one `packageMetadata`.
export function mergeChannelCatalogs(fragments, { version, generatedAt, requiredTargets }) {
	const issues = [];
	const byTarget = new Map();
	for (const fragment of fragments) {
		const key = fragment.catalog?.target;
		if (!key) {
			issues.push(`${fragment.file} has no target field.`);
			continue;
		}
		if (!requiredTargets.includes(key)) {
			issues.push(`${fragment.file} claims target ${key}, which is not in the shipping matrix (${requiredTargets.join(", ")}).`);
			continue;
		}
		if (byTarget.has(key)) {
			issues.push(`Two fragments claim target ${key}: ${byTarget.get(key).file} and ${fragment.file}.`);
			continue;
		}
		byTarget.set(key, fragment);
	}

	const missing = requiredTargets.filter((key) => !byTarget.has(key));
	if (missing.length !== 0) {
		issues.push(`Channel fragments are missing for: ${missing.join(", ")}. Every shipping platform needs its own leg.`);
		return { catalog: null, issues };
	}

	const ordered = requiredTargets.map((key) => byTarget.get(key));
	for (const fragment of ordered) {
		if (fragment.catalog.schemaVersion !== 1) {
			issues.push(`${fragment.file} has schemaVersion ${describe(fragment.catalog.schemaVersion)}, expected 1.`);
		}
		if (fragment.catalog.officeReleaseVersion !== version) {
			issues.push(
				`${fragment.file} was packaged for release ${describe(fragment.catalog.officeReleaseVersion)}, merging into ${describe(version)}.`,
			);
		}
		if (!Array.isArray(fragment.catalog.products)) issues.push(`${fragment.file} has no products array.`);
	}
	if (issues.length !== 0) return { catalog: null, issues };

	const managerMinimumVersion = requireAgreement(
		ordered.map((fragment) => ({ target: fragment.catalog.target, value: fragment.catalog.managerMinimumVersion })),
		"managerMinimumVersion",
		issues,
	);
	const releaseBaseUrl = requireAgreement(
		ordered.map((fragment) => ({ target: fragment.catalog.target, value: fragment.catalog.releaseBaseUrl })),
		"releaseBaseUrl",
		issues,
	);

	const productIds = requireAgreement(
		ordered.map((fragment) => ({
			target: fragment.catalog.target,
			value: fragment.catalog.products.map((product) => product.id),
		})),
		"the product id list",
		issues,
	);

	const products = [];
	for (const [index, productId] of productIds.entries()) {
		const perTarget = ordered.map((fragment) => ({
			target: fragment.catalog.target,
			product: fragment.catalog.products[index],
		}));
		if (perTarget.some((entry) => entry.product?.id !== productId)) {
			issues.push(`${productId} is not at position ${index} of every fragment.`);
			continue;
		}

		const product = { id: productId };
		for (const field of PLATFORM_NEUTRAL_PRODUCT_FIELDS) {
			product[field] = requireAgreement(
				perTarget.map((entry) => ({ target: entry.target, value: entry.product[field] })),
				`${productId}.${field}`,
				issues,
			);
		}
		product.expectedArtifact = mergeExpectedArtifact(
			perTarget.map((entry) => ({ target: entry.target, value: entry.product.expectedArtifact })),
			issues,
			`${productId}.expectedArtifact`,
		);

		requireAgreement(
			perTarget.map((entry) => ({ target: entry.target, value: entry.product.releases?.length })),
			`${productId}.releases length`,
			issues,
		);
		const releases = perTarget.map((entry) => entry.product.releases?.[0]).filter(Boolean);
		if (releases.length !== perTarget.length) {
			issues.push(`${productId} does not carry exactly one release in every fragment.`);
			continue;
		}

		const releaseSamples = perTarget.map((entry) => ({ target: entry.target, value: entry.product.releases[0] }));
		const release = {};
		for (const field of PLATFORM_NEUTRAL_RELEASE_FIELDS) {
			release[field] = requireAgreement(
				releaseSamples.map((entry) => ({ target: entry.target, value: entry.value[field] })),
				`${productId}.${field}`,
				issues,
			);
		}
		if (release.version !== version) {
			issues.push(
				`${productId} release version ${describe(release.version)} does not match the merged release ${describe(version)}.`,
			);
		}
		const publishedTimes = releaseSamples
			.map((entry) => entry.value.publishedAt)
			.filter((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)))
			.sort();
		if (publishedTimes.length !== releaseSamples.length) {
			issues.push(`${productId} has a fragment without a parseable publishedAt.`);
		}
		release.publishedAt = publishedTimes.at(-1);

		const artifacts = [];
		const artifactIds = new Set();
		for (const entry of releaseSamples) {
			const metadata = entry.value.packageMetadata;
			if (!metadata) {
				issues.push(
					`${productId} fragment ${entry.target} has no release packageMetadata to mirror onto its artifacts.`,
				);
				continue;
			}
			const listed = Array.isArray(entry.value.artifacts) ? entry.value.artifacts : [];
			if (listed.length === 0) issues.push(`${productId} fragment ${entry.target} lists no artifacts.`);
			for (const artifact of listed) {
				if (artifactIds.has(artifact.id)) issues.push(`${productId} repeats artifact id ${describe(artifact.id)}.`);
				artifactIds.add(artifact.id);
				if (artifact.platform !== metadata.platform || artifact.architecture !== metadata.architecture) {
					issues.push(
						`${productId} artifact ${describe(artifact.id)} claims ${describe(artifact.platform)}/${describe(artifact.architecture)} ` +
							`while ${entry.target}'s package metadata says ${describe(metadata.platform)}/${describe(metadata.architecture)}.`,
					);
				}
				artifacts.push({ ...artifact, packageMetadata: metadata });
			}
		}
		for (const targetKey of requiredTargets) {
			const platform = RUNTIME_TARGETS[targetKey].managerPlatform;
			if (!artifacts.some((artifact) => artifact.platform === platform)) {
				issues.push(`${productId} has no artifact usable by ${targetKey} (${platform}).`);
			}
		}
		release.artifacts = artifacts;
		product.releases = [release];
		products.push(product);
	}

	if (issues.length !== 0) return { catalog: null, issues };
	return {
		catalog: {
			schemaVersion: 1,
			generatedAt,
			managerMinimumVersion,
			releaseBaseUrl,
			products,
		},
		issues,
	};
}
