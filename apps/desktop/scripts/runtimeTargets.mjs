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
	},
};

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
