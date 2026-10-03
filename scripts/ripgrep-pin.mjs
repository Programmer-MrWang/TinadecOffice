// The one ripgrep pin shared by dev setup (scripts/setup-ripgrep.mjs) and the packaged
// runtime (apps/desktop/scripts/stage-runtime.mjs): file_search must run the same rg in
// both, so the version and its checksums live here and nowhere else.
//
// Linux uses the musl builds: the packaged runtime ships rg to arbitrary user distros,
// and a statically-linked musl binary does not care about the host's glibc version.
export const RIPGREP_VERSION = "15.2.0";

/**
 * target key (electron-builder / .NET RID style) → download and extraction facts.
 * `binary` is the path inside the extracted top-level directory (`<asset-without-ext>/`).
 */
export const RIPGREP_TARGETS = {
	"win-x64": {
		asset: `ripgrep-${RIPGREP_VERSION}-x86_64-pc-windows-msvc.zip`,
		sha256: "71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5",
		binary: "rg.exe",
	},
	"linux-x64": {
		asset: `ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz`,
		sha256: "33e15bcf1624b25cdd2a55813a47a2f95dbe126268203e76aa6a585d1e7b149c",
		binary: "rg",
	},
	"linux-arm64": {
		asset: `ripgrep-${RIPGREP_VERSION}-aarch64-unknown-linux-musl.tar.gz`,
		sha256: "800b1e7206afe799dfb5a6901f23147cfaabe0e52210538100f61e86e1740915",
		binary: "rg",
	},
	"osx-x64": {
		asset: `ripgrep-${RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz`,
		sha256: "af7825fcc69a2afc7a7aea55fc9af90e26421d8f20fe59df32e233c0b8a231c1",
		binary: "rg",
	},
	"osx-arm64": {
		asset: `ripgrep-${RIPGREP_VERSION}-aarch64-apple-darwin.tar.gz`,
		sha256: "3750b2e93f37e0c692657da574d7019a101c0084da05a790c83fd335bad973e4",
		binary: "rg",
	},
};

export function ripgrepTarget(target) {
	const entry = RIPGREP_TARGETS[target];
	if (!entry) throw new Error(`no ripgrep pin for target '${target}' (known: ${Object.keys(RIPGREP_TARGETS).join(", ")})`);
	return {
		...entry,
		url: `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${entry.asset}`,
	};
}

/** The pin key matching the machine running this script, or null for unsupported ones. */
export function currentRipgrepTarget(platform = process.platform, arch = process.arch) {
	if (platform === "win32" && arch === "x64") return "win-x64";
	if (platform === "linux" && arch === "x64") return "linux-x64";
	if (platform === "linux" && arch === "arm64") return "linux-arm64";
	if (platform === "darwin" && arch === "x64") return "osx-x64";
	if (platform === "darwin" && arch === "arm64") return "osx-arm64";
	return null;
}

// The local file name each staged binary gets under native/rg/ (dev) and
// resources/runtime/ (packaged). TinadecTools.csproj and RipgrepRunner.ResolveRgPath
// already look for exactly these two names (`rg.exe` win / `rg` POSIX) next to the
// tool binary — so per-platform staging needs no C# change.
export function ripgrepStagedName(target) {
	return target.startsWith("win-") ? "rg.exe" : "rg";
}

// Legacy win-x64-only exports; consumers migrate to ripgrepTarget(target) in phases.
export const RIPGREP_ASSET = RIPGREP_TARGETS["win-x64"].asset;
export const RIPGREP_SHA256 = RIPGREP_TARGETS["win-x64"].sha256;
export const RIPGREP_URL = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${RIPGREP_ASSET}`;
