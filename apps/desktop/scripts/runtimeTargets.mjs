/// Per-platform staging table for the packaged runtime, extracted so the shape is assertable
/// without a Windows-only machine, a Linux runner, or a macOS runner.
///
/// Staging always runs natively: `dotnet publish -r <rid>` cross-compiles fine, but the Bun
/// standalone and the electron-builder step do not, and a runtime assembled on the wrong OS is a
/// runtime nobody has ever executed. So a target is only buildable on its own host platform.
export const RUNTIME_TARGETS = {
	"win-x64": {
		key: "win-x64",
		platform: "win32",
		arch: "x64",
		rid: "win-x64",
		bunTarget: "bun-windows-x64",
		exe: ".exe",
		format: "pe",
		// PortableGit is a Windows packaging artifact: Linux and macOS ship system git, and the
		// service host checks for it through PATH (see electron/serviceManager.cjs).
		portableGit: true,
		managerPlatform: "windows",
		// electron-builder lands the extraResources tree at `<target unpacked>/resources` on Windows
		// and Linux, and inside the bundle at `Contents/Resources` on macOS. The mac leg proved it by
		// looking for the Windows spelling and finding nothing.
		unpackedResources: ["win-unpacked", "resources"],
		// A zip is written by System32 bsdtar and read by the Manager's bsdtar on Windows.
		channelArchive: { format: "zip", ext: ".zip" },
		installerAssets: [
			{ buildKey: "nsis", idSuffix: "setup", suffix: "-win-x64-setup.exe" },
			{ buildKey: "portable", idSuffix: "portable", suffix: "-win-x64-portable.exe" },
		],
	},
	"linux-x64": {
		key: "linux-x64",
		platform: "linux",
		arch: "x64",
		rid: "linux-x64",
		bunTarget: "bun-linux-x64",
		exe: "",
		format: "elf",
		portableGit: false,
		managerPlatform: "linux",
		unpackedResources: ["linux-unpacked", "resources"],
		channelArchive: { format: "tar-gz", ext: ".tar.gz" },
		installerAssets: [{ buildKey: "linux", idSuffix: "deb", suffix: "-linux-x64.deb" }],
	},
	"osx-arm64": {
		key: "osx-arm64",
		platform: "darwin",
		arch: "arm64",
		rid: "osx-arm64",
		bunTarget: "bun-darwin-arm64",
		exe: "",
		format: "macho",
		portableGit: false,
		managerPlatform: "macos",
		unpackedResources: ["mac-arm64", "TinadecOffice.app", "Contents", "Resources"],
		channelArchive: { format: "tar-gz", ext: ".tar.gz" },
		installerAssets: [{ buildKey: "mac", idSuffix: "dmg", suffix: "-osx-arm64.dmg" }],
	},
};

/// Channel archives are `zip` on Windows and `tar.gz` everywhere else, and the reason is a
/// measured trap rather than taste: GNU tar (which is `/usr/bin/tar` on a Linux runner) accepts
/// `-a -cf module.zip` and writes a **tar** archive under that name — first bytes `2e 2f 00 00`,
/// not `50 4b 03 04` — and then refuses to read a real zip with "This does not look like a tar
/// archive". A zip module built and verified on the same Linux host would therefore be green in CI
/// and uninstallable by the Manager, whose `extractArchive` also calls plain `tar`. GNU tar writes
/// the execute bit into tar.gz (`-rwxr-xr-x`, read back by bsdtar on macOS and by the Manager on
/// either host), so tar.gz costs nothing the zip would have bought.

const HOSTS = {
	win32: { x64: "win-x64" },
	linux: { x64: "linux-x64" },
	darwin: { arm64: "osx-arm64" },
};

export function runtimeTargetKeys() {
	return Object.keys(RUNTIME_TARGETS);
}

export function resolveRuntimeTarget(target) {
	const found = RUNTIME_TARGETS[target];
	if (!found) {
		throw new Error(
			`Unknown runtime target '${target}'. Known targets: ${runtimeTargetKeys().join(", ")}.`,
		);
	}
	return found;
}

/// The target this machine can honestly build and verify. Anything else is a loud stop rather than
/// a half-staged runtime that only ever gets executed on a different OS.
export function hostRuntimeTarget(platform = process.platform, arch = process.arch) {
	const key = HOSTS[platform]?.[arch];
	if (!key) {
		throw new Error(
			`No runtime target for ${platform}/${arch}. ` +
				`Staging runs natively; supported hosts: ${runtimeTargetKeys().join(", ")}.`,
		);
	}
	return RUNTIME_TARGETS[key];
}

export function runtimeBinaryName(base, target) {
	return `${base}${target.exe}`;
}
