const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { parse, stringify } = require('smol-toml');

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:48730';

function normalizeGatewayUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Gateway URL is required.');
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Gateway URL must be a valid HTTP or HTTPS URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Gateway URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Gateway URL cannot contain credentials, a query, or a fragment.');
  }

  return url.toString().replace(/\/$/, '');
}

function loadAppConfig(configFile, env = process.env) {
  const stored = readDocument(configFile);
  const debugStudioEnabled = readDebugStudioEnabled(stored);
  const managedUrl = env.TINADEC_GATEWAY_URL?.trim();
  if (managedUrl) {
    return { gateway_url: normalizeGatewayUrl(managedUrl), source: 'environment', managed: true, path: configFile,
      debug_studio_enabled: debugStudioEnabled };
  }

  return { gateway_url: stored.gateway_url ? normalizeGatewayUrl(stored.gateway_url) : DEFAULT_GATEWAY_URL,
    source: stored.gateway_url ? 'user' : 'default', managed: false, path: configFile,
    debug_studio_enabled: debugStudioEnabled };
}

function readDocumentSource(configFile) {
  try { return fs.readFileSync(configFile, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

function readDocument(configFile) {
  return parse(readDocumentSource(configFile));
}

function readDebugStudioEnabled(document) {
  const developer = document.developer;
  if (developer !== undefined && (!developer || typeof developer !== 'object'
      || Array.isArray(developer) || developer instanceof Date)) {
    throw new Error('desktop.toml developer must be a table.');
  }
  const value = developer?.debug_studio_enabled;
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error('desktop.toml developer.debug_studio_enabled must be a boolean.');
  }
  return value ?? false;
}

function writeDocumentSource(configFile, source) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  const temporary = `${configFile}.${process.pid}.tmp`;
  try { fs.writeFileSync(temporary, source, { encoding: 'utf8', mode: 0o600 }); fs.renameSync(temporary, configFile); }
  finally { fs.rmSync(temporary, { force: true }); }
}

function writeDocument(configFile, document) {
  writeDocumentSource(configFile, stringify(document));
}

/** Keep surrounding TOML/comments when a narrow edit has the exact expected meaning. */
function debugStudioDocumentSource(source, expected, enabled) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const setting = `debug_studio_enabled = ${enabled}`;
  const matchesExpected = (candidate) => {
    try { return isDeepStrictEqual(parse(candidate), expected); }
    catch { return false; }
  };

  // Parsing the result protects against matching another table, a comment, or a multiline string.
  const scalar = /((?:debug_studio_enabled|"debug_studio_enabled"|'debug_studio_enabled')[ \t]*=[ \t]*)(true|false)\b/g;
  for (const match of source.matchAll(scalar)) {
    const position = match.index + match[1].length;
    const candidate = source.slice(0, position) + enabled + source.slice(position + match[2].length);
    if (matchesExpected(candidate)) return candidate;
  }

  const table = /^[ \t]*\[[ \t]*(?:developer|"developer"|'developer')[ \t]*\][ \t]*(?:#[^\r\n]*)?(?:\r?\n|$)/gm;
  for (const match of source.matchAll(table)) {
    const position = match.index + match[0].length;
    const separator = match[0].endsWith('\n') ? '' : newline;
    const candidate = source.slice(0, position) + separator + setting + newline + source.slice(position);
    if (matchesExpected(candidate)) return candidate;
  }

  const inline = /(^[ \t]*(?:developer|"developer"|'developer')[ \t]*=[ \t]*\{)([^\r\n]*)(\})/gm;
  for (const match of source.matchAll(inline)) {
    const position = match.index + match[1].length;
    const candidate = source.slice(0, position) + ` ${setting}${match[2].trim() ? ', ' : ' '}` + source.slice(position);
    if (matchesExpected(candidate)) return candidate;
  }

  const separator = !source || source.endsWith('\n') ? '' : newline;
  const appended = `${source}${separator}[developer]${newline}${setting}${newline}`;
  if (matchesExpected(appended)) return appended;
  const dotted = `developer.${setting}${newline}${source}`;
  if (matchesExpected(dotted)) return dotted;

  // Unusual valid TOML forms still preserve all fields through the existing serializer.
  return stringify(expected);
}

function saveDebugStudioEnabled(configFile, enabled, env = process.env) {
  if (typeof enabled !== 'boolean') throw new Error('Debug Studio enabled must be a boolean.');
  const source = readDocumentSource(configFile);
  const document = parse(source);
  readDebugStudioEnabled(document);
  document.developer ??= Object.create(null);
  document.developer.debug_studio_enabled = enabled;
  writeDocumentSource(configFile, debugStudioDocumentSource(source, document, enabled));
  return loadAppConfig(configFile, env);
}

function saveGatewayUrl(configFile, value, env = process.env) {
  if (env.TINADEC_GATEWAY_URL?.trim()) {
    throw new Error('Gateway URL is managed by TINADEC_GATEWAY_URL.');
  }

  const gatewayUrl = normalizeGatewayUrl(value);
  const document = readDocument(configFile);
  document.gateway_url = gatewayUrl;
  writeDocument(configFile, document);
  return loadAppConfig(configFile, env);
}

function resetGatewayUrl(configFile, env = process.env) {
  if (env.TINADEC_GATEWAY_URL?.trim()) {
    return loadAppConfig(configFile, env);
  }
  const document = readDocument(configFile);
  delete document.gateway_url;
  writeDocument(configFile, document);
  return loadAppConfig(configFile, env);
}

function saveUserStorageRoot(configFile, root, env = process.env) {
  if (env.TINADEC_HOME?.trim()) throw new Error('User storage root is managed by TINADEC_HOME.');
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('User storage root must be an absolute path.');
  const document = readDocument(configFile);
  document.user_root = path.resolve(root);
  writeDocument(configFile, document);
  return { user_root: document.user_root, path: configFile, restart_required: true };
}

module.exports = {
  DEFAULT_GATEWAY_URL,
  loadAppConfig,
  normalizeGatewayUrl,
  resetGatewayUrl,
  saveGatewayUrl,
  saveDebugStudioEnabled,
  saveUserStorageRoot,
};
