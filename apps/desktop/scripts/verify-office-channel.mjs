import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptsDir, "..");
const releaseDir = resolve(process.argv[2] ?? join(desktopDir, "release"));
const channelDir = join(releaseDir, "office-channel");
// bsdtar (libarchive) reads the channel ZIPs. Resolve it explicitly on Windows:
// System32 always ships it, while GNU tar from Git Bash sits earlier on PATH and
// cannot read zip archives at all.
const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
const bsdTar =
	process.platform === "win32" && existsSync(join(systemRoot, "System32", "tar.exe"))
		? join(systemRoot, "System32", "tar.exe")
		: "tar";
const HASH_RE = /^[a-f0-9]{64}$/u;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/u;
const VERSION = (
	process.env.OFFICE_RELEASE_VERSION?.trim() ||
	(process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined) ||
	JSON.parse(readFileSync(join(desktopDir, "package.json"), "utf8")).version
).replace(/^v/u, "");

function fail(message) {
	throw new Error(message);
}

function requireFile(path, label) {
	if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) {
		fail(`${label} is missing or empty: ${path}`);
	}
	return path;
}

function readJson(path, label) {
	try {
		return JSON.parse(readFileSync(requireFile(path, label), "utf8"));
	} catch (error) {
		fail(`${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function sha256(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function canonicalize(value) {
	if (value === null || typeof value === "boolean" || typeof value === "string") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) fail("AgentPack manifest contains a non-finite number.");
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
		.join(",")}}`;
}

function archiveEntries(archive) {
	const output = execFileSync(bsdTar, ["-tf", archive], { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
	return output.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean);
}

// bsdtar archives created with `-C <dir> .` prefix entries with "./" (e.g.
// "./TinadecTools.exe" and the "./" root). Normalize that form away so safety and
// membership checks see the plain relative path a consumer extracts.
function normalizeEntry(entry) {
	let normalized = entry.replaceAll("\\", "/");
	while (normalized.startsWith("./")) normalized = normalized.slice(2);
	return normalized.replace(/\/+$/u, "");
}

function isSafeEntry(entry) {
	const normalized = normalizeEntry(entry);
	if (!normalized || normalized === ".") return true;
	if (normalized.startsWith("/") || /^[A-Za-z]:/u.test(normalized)) return false;
	return normalized.split("/").every((part) => part !== ".." && part.length > 0);
}

function requireEntry(entries, expected, archive) {
	const normalized = entries.map(normalizeEntry);
	if (!normalized.includes(expected)) fail(`${archive} is missing required entry ${expected}.`);
}

function peMachineBytes(bytes) {
	if (bytes.length < 0x40 || bytes.readUInt16LE(0) !== 0x5a4d) return 0;
	const offset = bytes.readUInt32LE(0x3c);
	if (offset + 6 > bytes.length || bytes.readUInt32LE(offset) !== 0x00004550) return 0;
	return bytes.readUInt16LE(offset + 4);
}

function requireAmd64Bytes(bytes, label) {
	if (peMachineBytes(bytes) !== 0x8664) fail(`${label} is not a Windows x64 PE.`);
}

function validateRuntimeArchive(archive, packageMetadata) {
	const entries = archiveEntries(archive);
	for (const entry of entries) {
		if (!isSafeEntry(entry)) fail(`${archive} contains an unsafe archive entry: ${entry}`);
	}
	requireEntry(entries, "tinadec-package.json", archive);
	const metadata = readJsonFromArchive(archive, "tinadec-package.json");
	for (const key of ["schemaVersion", "kind", "productLine", "productId", "component", "releaseVersion", "packageVersion", "platform", "architecture", "entrypoint", "expectedFiles"]) {
		if (JSON.stringify(metadata[key]) !== JSON.stringify(packageMetadata[key])) {
			fail(`${archive} metadata field ${key} does not match its expected value.`);
		}
	}
	if (metadata.kind !== "runtime-module" || metadata.productLine !== "office" || metadata.platform !== "windows" || metadata.architecture !== "x64") {
		fail(`${archive} is not an Office Windows x64 runtime module.`);
	}
	for (const expected of metadata.expectedFiles) requireEntry(entries, expected, archive);
	return { entries, metadata };
}

function validateAgentPackArchive(archive, packageMetadata) {
	const entries = archiveEntries(archive);
	for (const entry of entries) {
		if (!isSafeEntry(entry)) fail(`${archive} contains an unsafe archive entry: ${entry}`);
	}
	for (const expected of ["tinadec-package.json", "manifest.json", "envelope.json"]) requireEntry(entries, expected, archive);
	const metadata = readJsonFromArchive(archive, "tinadec-package.json");
	const manifest = readJsonFromArchive(archive, "manifest.json");
	const envelope = readJsonFromArchive(archive, "envelope.json");
	const digest = createHash("sha256").update(canonicalize(manifest)).digest("hex");
	if (metadata.kind !== "agent-pack" || metadata.productLine !== "office") fail(`${archive} is not an Office AgentPack archive.`);
	if (metadata.agentPack?.digest !== digest || envelope.integrity?.digest !== digest) fail(`${archive} AgentPack digest does not match manifest.json.`);
	if (metadata.agentPack?.packId !== manifest.metadata?.pack_id) fail(`${archive} AgentPack pack id does not match manifest.json.`);
	if (metadata.packageVersion !== manifest.metadata?.version) fail(`${archive} AgentPack version does not match manifest.json.`);
	if (!HASH_RE.test(digest) || !SEMVER_RE.test(String(metadata.packageVersion))) fail(`${archive} AgentPack identity is malformed.`);
	return { entries, metadata, digest };
}

function readJsonFromArchive(archive, entry) {
	try {
		return JSON.parse(execFileSync(bsdTar, ["-xOf", archive, entry], { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 }));
	} catch (error) {
		fail(`Unable to read ${entry} from ${archive}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function verifyArtifactHash(artifact, archive) {
	const actualSize = statSync(archive).size;
	const actualHash = sha256(archive);
	if (actualSize !== artifact.sizeBytes) fail(`${archive} size ${actualSize} does not match catalog ${artifact.sizeBytes}.`);
	if (actualHash !== artifact.sha256) fail(`${archive} SHA-256 ${actualHash} does not match catalog ${artifact.sha256}.`);
}

function catalogArtifact(catalog, productId, archiveName) {
	const product = catalog.products.find((candidate) => candidate.id === productId);
	if (!product) fail(`Catalog is missing product ${productId}.`);
	const release = product.releases.find((candidate) => candidate.version === VERSION);
	if (!release) fail(`Catalog is missing ${productId}@${VERSION}.`);
	const artifact = release.artifacts.find((candidate) => decodeURIComponent(candidate.url).endsWith(archiveName));
	if (!artifact) fail(`Catalog is missing artifact ${archiveName} for ${productId}.`);
	return { product, release, artifact };
}

function verifyExpectedFiles(archive, expected) {
	const entries = archiveEntries(archive);
	for (const file of expected) requireEntry(entries, file, archive);
}

function walkFileHashes(root) {
	const files = new Map();
	const visit = (directory, prefix) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			const full = join(directory, entry.name);
			if (entry.isDirectory()) visit(full, relative);
			else if (entry.isFile()) files.set(relative, sha256(full));
		}
	};
	visit(root, "");
	return files;
}

// Map a runtime-module ZIP entry onto its path inside the full app's bundled
// runtime. Tools merges the native/ and git/ staging directories into its root;
// core and gateway map one-to-one onto their component directory.
function bundledRuntimePath(component, entry) {
	if (component === "tools") {
		const segments = entry.split("/");
		if (segments[0] === "native" || segments[0] === "git") return entry;
		return `tools/${entry}`;
	}
	return `${component}/${entry}`;
}

// The module ZIPs and the full installer's bundled runtime must carry identical
// bytes: a file present in one and not the other is exactly the "full build runs,
// module package is missing files" drift this channel cannot ship.
function verifyRuntimeModulesMatchBundledApp(bundledRuntimeDir, archives) {
	const bundled = walkFileHashes(bundledRuntimeDir);
	const covered = new Set();
	for (const { archive, component } of archives) {
		const extractDir = mkdtempSync(join(tmpdir(), "office-channel-verify-"));
		try {
			execFileSync(bsdTar, ["-xf", archive, "-C", extractDir], { windowsHide: true, maxBuffer: 1024 });
			const packaged = walkFileHashes(extractDir);
			packaged.delete("tinadec-package.json");
			for (const [entry, digest] of packaged) {
				const bundledEntry = bundledRuntimePath(component, entry);
				if (!bundled.has(bundledEntry)) {
					fail(`${archive} ships ${entry}, which the full app's bundled runtime does not carry.`);
				}
				if (bundled.get(bundledEntry) !== digest) {
					fail(`${archive} file ${entry} differs from the full app's bundled runtime copy.`);
				}
				covered.add(bundledEntry);
			}
		} finally {
			rmSync(extractDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
		}
	}
	const missing = [...bundled.keys()].filter((entry) => !covered.has(entry)).sort();
	if (missing.length !== 0) {
		fail(`Bundled runtime files missing from the module ZIPs: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` (+${missing.length - 10} more)` : ""}`);
	}
	return bundled.size;
}

if (!existsSync(channelDir) || !statSync(channelDir).isDirectory()) fail(`Office channel directory is missing: ${channelDir}`);
if (!SEMVER_RE.test(VERSION)) fail(`Office release version is missing or invalid: ${VERSION}`);
const catalog = readJson(join(channelDir, "catalog.json"), "Office channel catalog");
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.products)) fail("Office channel catalog schema is invalid.");
const packageNames = [
	`tinadec-office-tools-${VERSION}-win-x64.zip`,
	`tinadec-office-core-${VERSION}-win-x64.zip`,
	`tinadec-office-gateway-${VERSION}-win-x64.zip`,
	`tinadec-office-agentpack-${VERSION}-win-x64.zip`,
];
const checksums = readFileSync(requireFile(join(channelDir, "SHA256SUMS"), "Office channel checksums"), "utf8");
for (const name of packageNames) {
	const archive = requireFile(join(channelDir, name), "Office channel archive");
	if (!checksums.includes(`${sha256(archive)}  ${name}`)) fail(`SHA256SUMS does not contain ${name}.`);
}

const tools = catalogArtifact(catalog, "tinadec-office-tools", packageNames[0]);
const core = catalogArtifact(catalog, "tinadec-office-core", packageNames[1]);
const gateway = catalogArtifact(catalog, "tinadec-office-gateway", packageNames[2]);
const agentPack = catalogArtifact(catalog, "tinadec-office-agentpack", packageNames[3]);
for (const [archiveName, artifact] of [[packageNames[0], tools.artifact], [packageNames[1], core.artifact], [packageNames[2], gateway.artifact], [packageNames[3], agentPack.artifact]]) {
	verifyArtifactHash(artifact, join(channelDir, archiveName));
}
const toolsValidation = validateRuntimeArchive(join(channelDir, packageNames[0]), tools.release.packageMetadata);
validateRuntimeArchive(join(channelDir, packageNames[1]), core.release.packageMetadata);
validateRuntimeArchive(join(channelDir, packageNames[2]), gateway.release.packageMetadata);
const agentPackValidation = validateAgentPackArchive(join(channelDir, packageNames[3]), agentPack.release.packageMetadata);
verifyExpectedFiles(join(channelDir, packageNames[0]), ["TinadecTools.exe", "Nlog.config", "rg.exe", "native/rg/rg.exe", "git/cmd/git.exe", "git/bin/bash.exe"]);
verifyExpectedFiles(join(channelDir, packageNames[1]), ["TinadecCore.Api.exe", "appsettings.json", "Configuration/default-agent-runtime.toml"]);
verifyExpectedFiles(join(channelDir, packageNames[2]), ["TinadecGateway.exe"]);
const bundledRuntimeDir = join(releaseDir, "win-unpacked", "resources", "runtime");
if (!existsSync(bundledRuntimeDir)) {
	fail(`Full app bundled runtime is missing, so module ZIPs cannot be cross-checked: ${bundledRuntimeDir}`);
}
const bundledFileCount = verifyRuntimeModulesMatchBundledApp(bundledRuntimeDir, [
	{ archive: join(channelDir, packageNames[0]), component: "tools" },
	{ archive: join(channelDir, packageNames[1]), component: "core" },
	{ archive: join(channelDir, packageNames[2]), component: "gateway" },
]);
// The PE architecture check only needs the first bytes, but entrypoints like the
// self-contained TinadecTools.exe exceed 60 MB — buffering the whole `tar -xOf`
// output dies with ENOBUFS. Stream instead and stop reading once the head is in.
async function readEntryHead(archive, entry, length = 4096) {
	return await new Promise((resolveHead, reject) => {
		const child = spawn(bsdTar, ["-xOf", archive, entry], {
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const chunks = [];
		let received = 0;
		let settled = false;
		child.stdout.on("data", (chunk) => {
			if (received < length) {
				chunks.push(chunk);
				received += chunk.length;
			}
			if (received >= length) {
				settled = true;
				resolveHead(Buffer.concat(chunks).subarray(0, length));
				child.kill();
			}
		});
		child.stderr.resume();
		child.on("error", reject);
		child.on("close", () => {
			if (!settled) resolveHead(Buffer.concat(chunks).subarray(0, length));
		});
	});
}

if (process.platform === "win32") {
	const peChecks = [
		[packageNames[0], "TinadecTools.exe"],
		[packageNames[0], "rg.exe"],
		[packageNames[0], "native/rg/rg.exe"],
		[packageNames[0], "git/cmd/git.exe"],
		[packageNames[0], "git/bin/bash.exe"],
		[packageNames[1], "TinadecCore.Api.exe"],
		[packageNames[2], "TinadecGateway.exe"],
	];
	for (const [archiveName, expected] of peChecks) {
		const head = await readEntryHead(join(channelDir, archiveName), expected);
		requireAmd64Bytes(head, `${archiveName}:${expected}`);
	}
}
if (tools.release.dependencies.length !== 0) fail("Tools must not have runtime dependencies.");
if (!core.release.dependencies.some((dependency) => dependency.productId === "tinadec-office-tools")) fail("Core must depend on Office Tools.");
if (!gateway.release.dependencies.some((dependency) => dependency.productId === "tinadec-office-core")) fail("Gateway must depend on Office Core.");
if (!agentPack.release.dependencies.some((dependency) => dependency.productId === "tinadec-office-core")) fail("AgentPack must declare a Core dependency.");
console.log(`Office channel verification passed for v${VERSION}: ${toolsValidation.entries.length} Tools entries, AgentPack ${agentPackValidation.digest}, ${bundledFileCount} bundled runtime files matched byte-for-byte.`);
