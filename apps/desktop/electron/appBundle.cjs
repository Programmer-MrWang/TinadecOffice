/**
 * Packaged renderer transport: `app://bundle/...`.
 *
 * The packaged app used to load `dist/index.html` through `loadFile`, which gives the page
 * an opaque `file://` origin. Requests from that origin carried `Origin: null`, so the
 * Gateway CORS allowlist could never accept them, and the answer at the time was to switch
 * same-origin policy off for every window (`webSecurity: false`). That also handed any page
 * the app embeds — the preview panel loads arbitrary http(s) URLs in an iframe — the same
 * privilege as the app itself, including the `contextBridge` surface.
 *
 * Serving the bundle over a registered standard scheme restores a real origin
 * (`app://bundle`) that the Gateway can allowlist, so `webSecurity` can stay at its default.
 */

const path = require('node:path');
const fs = require('node:fs/promises');

const APP_SCHEME = 'app';
const APP_HOST = 'bundle';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Privileges the scheme needs to behave like a normal secure origin. */
const APP_SCHEME_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  stream: true,
  corsEnabled: true,
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Content type for a bundle asset. Unknown extensions fall back to
 * `application/octet-stream` rather than guessing.
 * @param {string} filePath
 * @returns {string}
 */
function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Map a request pathname onto a file inside the bundle directory.
 *
 * Returns `null` for anything that escapes the bundle root, so a crafted
 * `app://bundle/../../etc/passwd` (or a Windows drive-absolute segment) cannot read
 * outside `dist/`. The check is on the resolved path, not on the raw string, because
 * `..` can also arrive percent-encoded or with mixed separators.
 *
 * @param {string} distDir
 * @param {string} pathname - decoded URL pathname
 * @returns {string|null}
 */
function resolveBundleAsset(distDir, pathname) {
  const raw = typeof pathname === 'string' ? pathname : '';
  if (raw.includes('\0')) return null;
  const normalised = raw.replace(/\\/g, '/');
  const relative = normalised.replace(/^\/+/, '') || 'index.html';
  // A drive-qualified first segment (`/C:/Windows/win.ini`, `C:/Windows/win.ini`) is absolute
  // under win32 and relative under posix, so `path.resolve` below would return a path outside
  // the bundle on Windows and `<dist>/C:/Windows/win.ini` — *inside* it — on Linux and macOS.
  // The pathname is attacker-controlled, so the shape is rejected outright instead of being
  // interpreted by whichever flavour of `path` happens to be loaded. (Measured in CI: the
  // posix legs returned a path for this input while the win-x64 leg returned null.)
  if (/^[a-zA-Z]:/.test(relative)) return null;
  const root = path.resolve(distDir);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

/**
 * Build the URL a window should load for a given SPA route.
 *
 * `hash` is the hash-router path (`/pet?instanceId=...`), `query` becomes the real
 * query string (`?splash=0`), matching what `loadFile`'s `{ hash, query }` options did.
 *
 * @param {{hash?: string, query?: Record<string, string|number|undefined|null>}} [options]
 * @returns {string}
 */
function appBundleUrl(options = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const suffix = search.toString();
  const hash = options.hash ? `#${options.hash}` : '';
  return `${APP_ORIGIN}/index.html${suffix ? `?${suffix}` : ''}${hash}`;
}

/**
 * Serve the bundle. Must run after `app.whenReady()`.
 *
 * @param {{protocol: {handle: Function}, distDir: string}} options
 */
function registerAppBundleProtocol({ protocol, distDir }) {
  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== APP_HOST) return new Response('Not found', { status: 404 });
      const filePath = resolveBundleAsset(distDir, decodeURIComponent(url.pathname));
      if (!filePath) return new Response('Not found', { status: 404 });
      const body = await fs.readFile(filePath);
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': contentTypeFor(filePath),
          // The renderer is replaced wholesale on every release; hashed asset names already
          // carry cache busting, so revalidation is cheaper than a stale bundle.
          'cache-control': 'no-cache',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

module.exports = {
  APP_SCHEME,
  APP_HOST,
  APP_ORIGIN,
  APP_SCHEME_PRIVILEGES,
  appBundleUrl,
  contentTypeFor,
  registerAppBundleProtocol,
  resolveBundleAsset,
};
