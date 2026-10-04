/// The facts a packaged build has to prove, shared by the Windows and POSIX smokes.
///
/// These predicates are the smoke's contract with Core and Gateway. Two copies of them would drift
/// the same way the platform paths did: one leg keeps passing while the other asserts something
/// subtly different, and the difference only shows up as a red run on the platform nobody built on.
///
/// The URLs are the same on every platform because the packaged app owns the loopback topology:
/// Gateway on 48730, Core on 48731, and the tool runtime on 48732.

export const coreHealthUrl = "http://127.0.0.1:48731/api/v1/health";
export const coreReadinessUrl = "http://127.0.0.1:48731/api/v1/readiness";
export const gatewayHealthUrl = "http://127.0.0.1:48730/api/v1/health";
export const toolsManifestUrl = "http://127.0.0.1:48730/api/v1/tools";
export const toolsReadinessUrl = "http://127.0.0.1:48730/api/v1/tool-layer-readiness";
export const harnessManifestUrl = "http://127.0.0.1:48730/api/v1/harness/manifest";

/// The ports a smoke run must have to itself, and must hand back when it is done. 48732 is the tool
/// runtime the packaged app spawns, so "ports freed" is only a real teardown proof if it is in the
/// list.
export const smokePorts = [48730, 48731, 48732];

export function validateCoreHealth(value) {
	return (
		value?.name === "tinadec-core" &&
		value?.status === "ok" &&
		value?.version === "0.1.0"
	);
}

export function validateGatewayHealth(value) {
	return value?.gateway === "ok" && value?.core_status === "ready";
}

export function validateCoreReadiness(value) {
	return (
		["ready", "degraded", "blocked"].includes(value?.status) &&
		Array.isArray(value?.items)
	);
}

export function validateToolsManifest(value) {
	return Array.isArray(value) && value.length > 0;
}

export function validateToolsReadiness(value) {
	return (
		Array.isArray(value?.tools) &&
		value.tools.length > 0 &&
		Number(value?.tool_count) > 0 &&
		value?.status === "ready"
	);
}

export function validateHarnessManifest(value) {
	return (
		typeof value?.runtime === "string" &&
		value.runtime.length > 0 &&
		value?.tool_registry &&
		typeof value.tool_registry === "object" &&
		Array.isArray(value?.modules)
	);
}

/// The ordered checks, so a new leg cannot skip one by forgetting to copy a call. Each entry names
/// itself the way the log should, because "timeout waiting for HTTP 200" tells a builder nothing.
export const smokeChecks = [
	{ url: coreHealthUrl, validate: validateCoreHealth, label: "Core health", key: "coreHealth" },
	{ url: gatewayHealthUrl, validate: validateGatewayHealth, label: "Gateway health", key: "gatewayHealth" },
	{ url: coreReadinessUrl, validate: validateCoreReadiness, label: "Core readiness", key: "coreReadiness" },
	{ url: toolsManifestUrl, validate: validateToolsManifest, label: "bundled tools manifest", key: "toolsManifest" },
	{ url: toolsReadinessUrl, validate: validateToolsReadiness, label: "bundled tools readiness", key: "toolsReadiness" },
	{ url: harnessManifestUrl, validate: validateHarnessManifest, label: "bundled harness manifest", key: "harnessManifest" },
];
