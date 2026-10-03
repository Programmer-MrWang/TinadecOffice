import assert from "node:assert/strict";
import { join, sep } from "node:path";
import { test } from "node:test";

import { GUARDED_PACKAGES, STAMP_FILE, dependencyStamp, ensureFreshViteCache } from "./viteCacheGuard.mjs";

const APP_ROOT = join("/work", "desktop");
const CACHE_DIR = join(APP_ROOT, "node_modules", ".vite");
const STAMP_PATH = join(APP_ROOT, "node_modules", STAMP_FILE);
const VUE_CHUNK = join(CACHE_DIR, "deps", "vue.js");

/// A Map-backed filesystem: the guard only touches a stamp file and one cache directory, and a
/// fake lets the tests assert removal instead of hoping a real wipe happened.
function createFs(seed = {}) {
  const files = new Map(Object.entries(seed));
  return {
    files,
    exists: (path) => files.has(path) || [...files.keys()].some((key) => key.startsWith(`${path}${sep}`)),
    read: (path) => {
      if (!files.has(path)) throw Object.assign(new Error(`ENOENT ${path}`), { code: "ENOENT" });
      return files.get(path);
    },
    remove: (path) => {
      for (const key of [...files.keys()]) if (key === path || key.startsWith(`${path}${sep}`)) files.delete(key);
    },
    mkdir: () => {},
    write: (path, body) => files.set(path, body),
  };
}

const VUE_RC10 = (name) => (name === "vue" ? "3.6.0-rc.10" : "1.0.0");
const VUE_RC2 = (name) => (name === "vue" ? "3.6.0-rc.2" : "1.0.0");

function run({ fs, resolveVersion }) {
  return ensureFreshViteCache({ appRoot: APP_ROOT, resolveVersion, fs });
}

test("A first run wipes a cache nothing vouches for", () => {
  const fs = createFs({ [VUE_CHUNK]: "pre-bundled vue" });

  const decision = run({ fs, resolveVersion: VUE_RC10 });

  assert.equal(decision.action, "wiped");
  assert.equal(decision.reason, "no-stamp");
  assert.equal(fs.files.has(VUE_CHUNK), false, "the pre-bundled runtime must be gone");
  assert.ok(fs.files.get(STAMP_PATH).includes("3.6.0-rc.10"), "the wipe records what is installed now");
});

test("A matching dependency stamp keeps the cache", () => {
  const fs = createFs({ [VUE_CHUNK]: "pre-bundled vue" });
  run({ fs, resolveVersion: VUE_RC10 });
  fs.write(VUE_CHUNK, "re-optimized vue"); // what Vite leaves behind after the wiped first run

  const second = run({ fs, resolveVersion: VUE_RC10 });

  assert.equal(second.action, "kept");
  assert.equal(second.reason, "match");
  assert.equal(fs.files.get(VUE_CHUNK), "re-optimized vue");
});

test("An upgraded Vue wipes the cache that was bundled with the old one", () => {
  // The 2026-10-03 incident: a .vite/deps built from rc.2 kept serving its runtime to
  // rc.10-compiled Vapor SFCs, and the window came up blank with an insertBefore TypeError.
  const fs = createFs({ [VUE_CHUNK]: "pre-bundled vue" });
  run({ fs, resolveVersion: VUE_RC2 });
  fs.write(VUE_CHUNK, "pre-bundled vue");

  const decision = run({ fs, resolveVersion: VUE_RC10 });

  assert.equal(decision.action, "wiped");
  assert.equal(decision.reason, "mismatch");
  assert.equal(fs.files.has(VUE_CHUNK), false);
});

test("An unresolvable package is recorded as absent so the stamp stays stable", () => {
  const resolveVersion = (name) => (name === "electron" ? null : VUE_RC10(name));
  const fs = createFs({ [VUE_CHUNK]: "pre-bundled vue" });

  run({ fs, resolveVersion });
  const second = run({ fs, resolveVersion });

  assert.equal(second.action, "kept", "a missing package must not wipe the cache on every start");
  assert.ok(fs.files.get(STAMP_PATH).includes('"absent"'));
});

test("An unreadable stamp counts as a mismatch, not as permission to keep the cache", () => {
  const fs = createFs({ [STAMP_PATH]: "{ not json", [VUE_CHUNK]: "pre-bundled vue" });

  const decision = run({ fs, resolveVersion: VUE_RC10 });

  assert.equal(decision.action, "wiped");
  assert.equal(fs.files.has(VUE_CHUNK), false);
});

test("The guard covers the runtime and the compiler that produced the crash", () => {
  // Vacuous-guard check: if these fall out of the list the stamp stops seeing the upgrade that
  // actually broke the window.
  for (const required of ["vue", "@vue/runtime-vapor", "@vue/compiler-sfc", "@vitejs/plugin-vue", "vite"]) {
    assert.ok(GUARDED_PACKAGES.includes(required), `${required} must be guarded`);
  }

  const stamp = dependencyStamp(VUE_RC10);
  assert.deepEqual(stamp.find((entry) => entry[0] === "vue"), ["vue", "3.6.0-rc.10"]);
  assert.equal(stamp.length, GUARDED_PACKAGES.length);
});
