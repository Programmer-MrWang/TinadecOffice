/**
 * Local media scheme: `tinadec-media://local/<base64url path>`.
 *
 * Why this exists: the packaged renderer used to load its bundle from `file://`, so a
 * user-picked background was addressed with a `file:///...` URL and the only way to let a
 * page read a `file://` subresource was to switch same-origin policy off globally
 * (`webSecurity: false`). Once the bundle moved to `app://bundle` and `webSecurity` went
 * back to its default, those URLs stop working — a scheme registered here carries exactly
 * the one resource type the background feature needs.
 *
 * Properties this deliberately has:
 *   - only image/video extensions are served, from an existing regular file;
 *   - the path is base64url-encoded in the URL, so the renderer builds it synchronously and
 *     a persisted setting keeps working across restarts;
 *   - **no CORS headers are sent**. A cross-origin `fetch()` of one of these URLs therefore
 *     fails, while `<img>`, `<video>` and CSS `url()` (all no-cors) still load. Under
 *     `webSecurity: false` a page could have read the pixels of any local image through a
 *     canvas; now it cannot.
 *   - Range requests are honoured, which `<video>` seeking relies on.
 *
 * Residual capability, stated plainly: the renderer can still name any media-extension path
 * on disk. That is the same reach `tinadec:read-image-data-url` already had, and narrowing it
 * (a grant list populated only by the file dialog) needs the renderer to round-trip at
 * startup, which is a product decision rather than part of closing the command-execution
 * chain. See the note in `#33`.
 */

const path = require('node:path');
const fs = require('node:fs/promises');
const fssync = require('node:fs');

const MEDIA_SCHEME = 'tinadec-media';
const MEDIA_HOST = 'local';
const MEDIA_ORIGIN = `${MEDIA_SCHEME}://${MEDIA_HOST}`;

/** Extension → MIME. Anything absent is refused rather than guessed. */
const MEDIA_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
};

/** Privileges the scheme needs. `corsEnabled` is intentionally false — see the header. */
const MEDIA_SCHEME_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  stream: true,
};

/**
 * MIME for a media path, or `null` when the extension is not a servable media type.
 * @param {string} filePath
 * @returns {string|null}
 */
function mediaMimeFor(filePath) {
  if (typeof filePath !== 'string' || !filePath) return null;
  return MEDIA_TYPES[path.extname(filePath).toLowerCase()] ?? null;
}

/**
 * Encode an absolute path for the URL pathname.
 * @param {string} filePath
 * @returns {string}
 */
function encodePathToken(filePath) {
  return Buffer.from(String(filePath), 'utf8').toString('base64url');
}

/**
 * Decode a URL pathname back into a path, rejecting anything that is not a media file.
 * @param {string} token
 * @returns {string|null}
 */
function decodePathToken(token) {
  if (typeof token !== 'string' || !token) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  // A round trip must reproduce the token exactly: that rejects both malformed base64 and
  // input that decoded to something other than the bytes the sender meant.
  if (!decoded || decoded.includes('\0') || encodePathToken(decoded) !== token) return null;
  if (!mediaMimeFor(decoded)) return null;
  return decoded;
}

/**
 * Media URL for a local file, or `null` when the extension is not servable.
 * @param {string} filePath
 * @returns {string|null}
 */
function mediaUrlFor(filePath) {
  if (!mediaMimeFor(filePath)) return null;
  return `${MEDIA_ORIGIN}/${encodePathToken(filePath)}`;
}

/**
 * Inverse of {@link mediaUrlFor} for a full URL (used by the background-image read path).
 * @param {string} url
 * @returns {string|null}
 */
function mediaPathFromUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(`${MEDIA_ORIGIN}/`)) return null;
  const rest = url.slice(MEDIA_ORIGIN.length + 1);
  const token = rest.split(/[?#]/)[0];
  return decodePathToken(token);
}

/**
 * Parse a single-range `Range` header.
 *
 * @param {string|undefined|null} header
 * @param {number} size
 * @returns {{start: number, end: number}|null|'invalid'} `null` = serve the whole body
 */
function parseRange(header, size) {
  if (!header || typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;
  if (rawStart === '') {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return 'invalid';
    const start = Math.max(0, size - suffixLength);
    return { start, end: size - 1 };
  }
  const start = Number(rawStart);
  if (!Number.isFinite(start) || start >= size) return 'invalid';
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (!Number.isFinite(end) || end < start) return 'invalid';
  return { start, end };
}

/**
 * Read `length` bytes from an offset.
 * @param {string} filePath
 * @param {number} start
 * @param {number} length
 * @returns {Promise<Buffer>}
 */
async function readChunk(filePath, start, length) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Serve local media. Must run after `app.whenReady()`.
 * @param {{protocol: {handle: Function}}} options
 */
function registerLocalMediaProtocol({ protocol }) {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Not found', { status: 404 });
    }
    if (url.hostname !== MEDIA_HOST) return new Response('Not found', { status: 404 });

    const filePath = decodePathToken(decodeURIComponent(url.pathname).replace(/^\/+/, ''));
    if (!filePath) return new Response('Not found', { status: 404 });

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return new Response('Not found', { status: 404 });
    }
    if (!stat.isFile()) return new Response('Not found', { status: 404 });

    const headers = {
      'content-type': MEDIA_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      'accept-ranges': 'bytes',
    };

    const range = parseRange(request.headers.get('range'), stat.size);
    if (range === 'invalid') {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${stat.size}` } });
    }
    if (range) {
      const length = range.end - range.start + 1;
      return new Response(await readChunk(filePath, range.start, length), {
        status: 206,
        headers: { ...headers, 'content-range': `bytes ${range.start}-${range.end}/${stat.size}` },
      });
    }
    return new Response(await fs.readFile(filePath), { status: 200, headers });
  });
}

/**
 * `file://` URL → filesystem path.
 *
 * The slash after the authority is not always part of the path: `file:///tmp/a.png` is
 * `/tmp/a.png` on POSIX but `file:///C:/a.png` is `C:/a.png` on Windows. Stripping
 * `file:///` drops a real leading slash on POSIX, so the drive-letter case is the only one
 * that loses its separator.
 *
 * @param {string} url
 * @returns {string|null}
 */
function fileUrlToPath(url) {
  if (typeof url !== 'string' || !url.startsWith('file://')) return null;
  let rest;
  try {
    rest = decodeURIComponent(url.slice('file://'.length));
  } catch {
    return null;
  }
  if (/^\/[a-zA-Z]:/.test(rest)) return rest.slice(1);
  return rest;
}

/**
 * Turn whatever the settings hold into a path, without touching the disk.
 * Accepts a media URL, a `file://` URL, or a plain path.
 * @param {string} source
 * @returns {string|null}
 */
function sourceToMediaPath(source) {
  if (typeof source !== 'string' || !source) return null;
  const fromUrl = mediaPathFromUrl(source);
  if (fromUrl) return fromUrl;
  const fromFile = fileUrlToPath(source);
  if (fromFile) return fromFile;
  if (fssync.existsSync(source)) return source;
  return null;
}

module.exports = {
  MEDIA_HOST,
  MEDIA_ORIGIN,
  MEDIA_SCHEME,
  MEDIA_SCHEME_PRIVILEGES,
  decodePathToken,
  encodePathToken,
  fileUrlToPath,
  mediaMimeFor,
  mediaPathFromUrl,
  mediaUrlFor,
  parseRange,
  registerLocalMediaProtocol,
  sourceToMediaPath,
};
