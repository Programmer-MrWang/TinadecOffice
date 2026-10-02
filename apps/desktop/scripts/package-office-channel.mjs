import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptsDir, "..");
const rootDir = resolve(desktopDir, "..", "..");
const releaseDir = join(desktopDir, "release");
const channelDir = join(releaseDir, "office-channel");
const runtimeDir = join(desktopDir, "runtime");
const agentPackManifestPath = join(
	desktopDir,
	"src",
	"agentPacks",
	"GraphSeedPack",
	"manifest.json",
);
const defaultRepository = "Tinadec/TinadecOffice";

function fail(message) {
	throw new Error(message);
}

function requireFile(path, label) {
	if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) {
		fail(`${label} is missing or empty: ${path}`);
	}
	return path;
}

function requireDirectory(path, label) {
	if (!existsSync(path) || !statSync(path).isDirectory()) {
		fail(`${label} is missing: ${path}`);
	}
	return path;
}

function removeTree(path) {
	rmSync(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
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

function readJson(path, label) {
	try {
		return JSON.parse(readFileSync(requireFile(path, label), "utf8"));
	} catch (error) {
		fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function releaseVersion() {
	const requested =
		process.env.OFFICE_RELEASE_VERSION ??
		(process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
	const raw = (requested ?? readJson(join(desktopDir, "package.json"), "Desktop package.json").version)
		.replace(/^v/u, "");
	if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(raw)) {
		fail(`Invalid Office release version: ${raw}`);
	}
	return raw;
}

function packageRoot(name) {
	const path = join(channelDir, name);
	removeTree(path);
	mkdirSync(path, { recursive: true });
	return path;
}

function copyTree(source, destination) {
	requireDirectory(source, `Source directory for ${relative(rootDir, source)}`);
	mkdirSync(destination, { recursive: true });
	for (const entry of readdirSync(source, { withFileTypes: true })) {
		const sourcePath = join(source, entry.name);
		const destinationPath = join(destination, entry.name);
		if (entry.isDirectory()) copyTree(sourcePath, destinationPath);
		else if (entry.isFile()) copyFileSync(sourcePath, destinationPath);
	}
}

function writeJson(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function zipDirectory(source, output) {
	removeTree(output);
	mkdirSync(dirname(output), { recursive: true });
	// Windows runners provide bsdtar, which keeps the ZIP implementation shared
	// with the Manager's archive tests and supports the native x64 build.
	execFileSync("tar", ["-a", "-cf", output, "-C", source, "."], {
		cwd: rootDir,
		stdio: "inherit",
		windowsHide: true,
	});
	requireFile(output, `Office channel archive ${output}`);
}

function packageMetadata({ productId, component, packageVersion, entrypoint, expectedFiles, agentPack }) {
	return {
		schemaVersion: 1,
		kind: agentPack ? "agent-pack" : "runtime-module",
		productLine: "office",
		productId,
		component,
		releaseVersion: VERSION,
		packageVersion,
		platform: "windows",
		architecture: "x64",
		...(entrypoint ? { entrypoint } : {}),
		...(expectedFiles ? { expectedFiles } : {}),
		...(agentPack ? { agentPack } : {}),
	};
}

function artifactMetadata({ id, file, format = "zip", sourceDir = channelDir }) {
	const sourcePath = join(sourceDir, file);
	return {
		id,
		platform: "windows",
		architecture: "x64",
		format,
		url: `${releaseBaseUrl}/${encodeURIComponent(file)}`,
		sizeBytes: statSync(sourcePath).size,
		sha256: sha256(sourcePath),
	};
}

function runtimePackage({ name, productId, component, packageVersion, source, extraSources, entrypoint, expectedFiles }) {
	const root = packageRoot(name);
	copyTree(source, root);
	for (const [directory, sourcePath] of extraSources ?? []) {
		copyTree(sourcePath, join(root, directory));
	}
	writeJson(
		join(root, "tinadec-package.json"),
		packageMetadata({ productId, component, packageVersion, entrypoint, expectedFiles }),
	);
	const file = `${name}-${VERSION}-win-x64.zip`;
	zipDirectory(root, join(channelDir, file));
	return { file, metadata: readJson(join(root, "tinadec-package.json"), "package metadata") };
}

function agentPackPackage() {
	const root = packageRoot("agentpack");
	const manifest = readJson(agentPackManifestPath, "GraphSeedPack manifest");
	const digest = createHash("sha256").update(canonicalize(manifest)).digest("hex");
	const packId = manifest?.metadata?.pack_id;
	const packVersion = manifest?.metadata?.version;
	const minimumCoreVersion = manifest?.compatibility?.minimum_core_version;
	if (typeof packId !== "string" || typeof packVersion !== "string" || typeof minimumCoreVersion !== "string") {
		fail("GraphSeedPack manifest is missing pack identity or Core compatibility.");
	}
	copyFileSync(agentPackManifestPath, join(root, "manifest.json"));
	writeJson(join(root, "envelope.json"), {
		manifest,
		integrity: { algorithm: "sha256", digest },
	});
	writeJson(
		join(root, "tinadec-package.json"),
		packageMetadata({
			productId: "tinadec-office-agentpack",
			component: "agentpack",
			packageVersion: packVersion,
			agentPack: {
				packId,
				digest,
				minimumCoreVersion,
				manifestPath: "manifest.json",
				envelopePath: "envelope.json",
			},
		}),
	);
	const file = `tinadec-office-agentpack-${VERSION}-win-x64.zip`;
	zipDirectory(root, join(channelDir, file));
	return {
		file,
		metadata: readJson(join(root, "tinadec-package.json"), "AgentPack metadata"),
		packId,
		packVersion,
		digest,
		minimumCoreVersion,
	};
}

function findReleaseArtifact(suffix, label) {
	const matches = readdirSync(releaseDir).filter(
		(name) => name.endsWith(suffix) && statSync(join(releaseDir, name)).isFile(),
	);
	if (matches.length !== 1) fail(`Expected one ${label}, found ${matches.length}.`);
	return matches[0];
}

const VERSION = releaseVersion();
const repository = process.env.GITHUB_REPOSITORY ?? defaultRepository;
const releaseBaseUrl = `https://github.com/${repository}/releases/download/v${VERSION}`;
requireDirectory(runtimeDir, "Staged desktop runtime");
requireDirectory(releaseDir, "Desktop release directory");
removeTree(channelDir);
mkdirSync(channelDir, { recursive: true });

const desktopPackage = readJson(join(desktopDir, "package.json"), "Desktop package.json");
if (desktopPackage.version !== VERSION) {
	fail(`Desktop package version ${desktopPackage.version} does not match Office release ${VERSION}.`);
}
const corePackage = runtimePackage({
	name: "tinadec-office-core",
	productId: "tinadec-office-core",
	component: "core",
	packageVersion: VERSION,
	source: join(runtimeDir, "core"),
	entrypoint: "TinadecCore.Api.exe",
	expectedFiles: ["TinadecCore.Api.exe", "appsettings.json", "Configuration/default-agent-runtime.toml"],
});
const gatewayPackage = runtimePackage({
	name: "tinadec-office-gateway",
	productId: "tinadec-office-gateway",
	component: "gateway",
	packageVersion: VERSION,
	source: join(runtimeDir, "gateway"),
	entrypoint: "TinadecGateway.exe",
	expectedFiles: ["TinadecGateway.exe"],
});
const toolsPackage = runtimePackage({
	name: "tinadec-office-tools",
	productId: "tinadec-office-tools",
	component: "tools",
	packageVersion: VERSION,
	source: join(runtimeDir, "tools"),
	extraSources: [
		["native", join(runtimeDir, "native")],
		["git", join(runtimeDir, "git")],
	],
	entrypoint: "TinadecTools.exe",
	expectedFiles: [
		"TinadecTools.exe",
		"Nlog.config",
		"rg.exe",
		"native/rg/rg.exe",
		"git/cmd/git.exe",
		"git/bin/bash.exe",
	],
});
const agentPack = agentPackPackage();
const setupFile = findReleaseArtifact("-win-x64-setup.exe", "NSIS setup");
const portableFile = findReleaseArtifact("-win-x64-portable.exe", "portable package");

const products = [
	{
		id: "tinadec-office-desktop",
		name: "TinadecOffice Desktop",
		family: "app",
		productLine: "office",
		packageKind: "full-installer",
		description: "完整 TinadecOffice 工作台，一键安装 Core、Gateway、Tools 和桌面端。",
		delivery: "portable-exe",
		probe: "process-name",
		probeTarget: "TinadecOffice",
		expectedArtifact: `TinadecOffice-${VERSION}-win-x64-portable.exe`,
		allowMultipleInstances: true,
		supportsStandaloneLaunch: true,
		installable: true,
		releases: [{
			id: `tinadec-office-desktop-${VERSION}`,
			version: VERSION,
			channel: "stable",
			publishedAt: new Date().toISOString(),
			artifacts: [
				artifactMetadata({ id: `tinadec-office-desktop-${VERSION}-setup`, file: setupFile, format: "executable", sourceDir: releaseDir }),
				artifactMetadata({ id: `tinadec-office-desktop-${VERSION}-portable`, file: portableFile, format: "executable", sourceDir: releaseDir }),
			],
			dependencies: [],
			packageMetadata: {
				schemaVersion: 1,
				kind: "full-installer",
				productLine: "office",
				productId: "tinadec-office-desktop",
				component: "desktop",
				releaseVersion: VERSION,
				packageVersion: desktopPackage.version,
			},
		}],
	},
	{
		id: "tinadec-office-tools",
		name: "TinadecOffice Tools",
		family: "tools",
		productLine: "office",
		packageKind: "runtime-module",
		runtimeRole: "tools",
		description: "Office 渠道的工具宿主、ripgrep 和 PortableGit 运行时。",
		delivery: "native-exe",
		probe: "process-name",
		probeTarget: "TinadecTools",
		expectedArtifact: "TinadecTools.exe",
		allowMultipleInstances: false,
		supportsStandaloneLaunch: false,
		installable: true,
		releases: [{
			id: `tinadec-office-tools-${VERSION}`,
			version: VERSION,
			channel: "stable",
			publishedAt: new Date().toISOString(),
			artifacts: [artifactMetadata({ id: `tinadec-office-tools-${VERSION}-win-x64`, file: toolsPackage.file })],
			dependencies: [],
			packageMetadata: toolsPackage.metadata,
		}],
	},
	{
		id: "tinadec-office-core",
		name: "TinadecOffice Core",
		family: "core",
		productLine: "office",
		packageKind: "runtime-module",
		runtimeRole: "core",
		description: "Office 渠道的 TinadecCore 本地服务运行时。",
		delivery: "dotnet-publish-dir",
		probe: "http-health",
		probeTarget: "http://127.0.0.1:48731/api/v1/health",
		expectedArtifact: "TinadecCore.Api.exe",
		allowMultipleInstances: false,
		supportsStandaloneLaunch: true,
		installable: true,
		releases: [{
			id: `tinadec-office-core-${VERSION}`,
			version: VERSION,
			channel: "stable",
			publishedAt: new Date().toISOString(),
			artifacts: [artifactMetadata({ id: `tinadec-office-core-${VERSION}-win-x64`, file: corePackage.file })],
			dependencies: [{ productId: "tinadec-office-tools", versionRange: `>=${VERSION}`, optional: false }],
			packageMetadata: corePackage.metadata,
		}],
	},
	{
		id: "tinadec-office-gateway",
		name: "TinadecOffice Gateway",
		family: "gateway",
		productLine: "office",
		packageKind: "runtime-module",
		runtimeRole: "gateway",
		description: "Office 渠道的 Gateway 本地代理运行时。",
		delivery: "native-exe",
		probe: "http-health",
		probeTarget: "http://127.0.0.1:48730/api/v1/health",
		expectedArtifact: "TinadecGateway.exe",
		allowMultipleInstances: false,
		supportsStandaloneLaunch: true,
		installable: true,
		releases: [{
			id: `tinadec-office-gateway-${VERSION}`,
			version: VERSION,
			channel: "stable",
			publishedAt: new Date().toISOString(),
			artifacts: [artifactMetadata({ id: `tinadec-office-gateway-${VERSION}-win-x64`, file: gatewayPackage.file })],
			dependencies: [{ productId: "tinadec-office-core", versionRange: `>=${VERSION}`, optional: false }],
			packageMetadata: gatewayPackage.metadata,
		}],
	},
	{
		id: "tinadec-office-agentpack",
		name: "TinadecOffice AgentPack",
		family: "agent-pack",
		productLine: "office",
		packageKind: "agent-pack",
		description: "Office 渠道的 GraphSeed AgentPack，安装后由 TinadecOffice 交给 Core 工作区安装。",
		delivery: "agent-pack",
		probe: "file-only",
		probeTarget: "",
		expectedArtifact: "manifest.json",
		allowMultipleInstances: false,
		supportsStandaloneLaunch: false,
		installable: true,
		releases: [{
			id: `tinadec-office-agentpack-${VERSION}`,
			version: VERSION,
			channel: "stable",
			publishedAt: new Date().toISOString(),
			artifacts: [artifactMetadata({ id: `tinadec-office-agentpack-${VERSION}-win-x64`, file: agentPack.file })],
			dependencies: [{ productId: "tinadec-office-core", versionRange: `>=${agentPack.minimumCoreVersion}`, optional: false }],
			packageMetadata: agentPack.metadata,
		}],
	},
];

writeJson(join(channelDir, "catalog.json"), {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	managerMinimumVersion: "0.1.0",
	products,
});
writeFileSync(
	join(channelDir, "SHA256SUMS"),
	readdirSync(channelDir)
		.filter((name) => name.endsWith(".zip") || name === "catalog.json")
		.sort()
		.map((name) => `${sha256(join(channelDir, name))}  ${name}`)
		.join("\n") + "\n",
	"utf8",
);
console.log(`Created Office channel artifacts for ${VERSION} in ${channelDir}.`);
for (const name of readdirSync(channelDir).filter((entry) => entry.endsWith(".zip") || entry === "catalog.json")) {
	console.log(`  ${name}: ${statSync(join(channelDir, name)).size} bytes`);
}
