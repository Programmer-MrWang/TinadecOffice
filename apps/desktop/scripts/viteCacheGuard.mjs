import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Packages whose installed versions decide what the Vite dep cache contains and how SFCs are
// compiled. Vite's own lockfile check does not invalidate after a dependency upgrade: a cache
// pre-bundled with vue 3.6.0-rc.2 was served against rc.10-compiled Vapor components, and the
// window came up blank with "insertBefore ... parameter 2 is not of type 'Node'".
export const GUARDED_PACKAGES = [
  "vue",
  "@vue/runtime-dom",
  "@vue/runtime-vapor",
  "@vue/compiler-sfc",
  "@vue/compiler-vapor",
  "vite",
  "@vitejs/plugin-vue",
  "vue-router",
  "pinia",
  "electron",
];

export const STAMP_FILE = ".tinadec-vite-deps.json";

const nodeFs = {
  exists: (path) => existsSync(path),
  read: (path) => readFileSync(path, "utf8"),
  remove: (path) => rmSync(path, { recursive: true, force: true }),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  write: (path, body) => writeFileSync(path, body, "utf8"),
};

export function installedVersionResolver(appRoot) {
  const require = createRequire(join(appRoot, "package.json"));
  return (name) => {
    try {
      return require(`${name}/package.json`).version ?? null;
    } catch {
      return null;
    }
  };
}

/// Ordered [[package, version]] pairs; an uninstalled package is recorded as "absent" so a
/// resolver that cannot find it produces a stable stamp instead of wiping the cache every start.
export function dependencyStamp(resolveVersion, packages = GUARDED_PACKAGES) {
  return packages.map((name) => [name, resolveVersion(name) ?? "absent"]);
}

/// Drops node_modules/.vite unless the recorded stamp still matches what is installed.
/// Returns { action: 'kept' | 'wiped', reason } for logging and tests.
export function ensureFreshViteCache({ appRoot, resolveVersion, fs = nodeFs, packages = GUARDED_PACKAGES }) {
  const cacheDir = join(appRoot, "node_modules", ".vite");
  // The stamp lives beside the cache dir, not inside it: Vite empties the cache dir when it
  // re-optimizes, which would delete a stamp written there before the dev server starts.
  const stampPath = join(appRoot, "node_modules", STAMP_FILE);
  const stamp = dependencyStamp(resolveVersion, packages);

  let previous = null;
  if (fs.exists(stampPath)) {
    try {
      previous = JSON.parse(fs.read(stampPath));
    } catch {
      previous = null; // unreadable stamp is a mismatch, not a reason to keep an unknown cache
    }
  }

  const reason = previous === null ? "no-stamp" : sameEntries(previous, stamp) ? "match" : "mismatch";
  if (reason === "match") {
    return { action: "kept", reason };
  }

  if (fs.exists(cacheDir)) fs.remove(cacheDir);
  fs.mkdir(dirname(stampPath));
  fs.write(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
  return { action: "wiped", reason };
}

function sameEntries(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((entry, index) => entry?.[0] === b[index][0] && entry?.[1] === b[index][1]);
}

export function devAppRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}
