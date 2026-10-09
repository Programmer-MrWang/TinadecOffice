const fs = require('node:fs');
const path = require('node:path');
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
  const managedUrl = env.TINADEC_GATEWAY_URL?.trim();
  if (managedUrl) {
    return { gateway_url: normalizeGatewayUrl(managedUrl), source: 'environment', managed: true, path: configFile };
  }

  const stored = readDocument(configFile);
  return { gateway_url: stored.gateway_url ? normalizeGatewayUrl(stored.gateway_url) : DEFAULT_GATEWAY_URL,
    source: stored.gateway_url ? 'user' : 'default', managed: false, path: configFile };
}

function readDocument(configFile) {
  try { return parse(fs.readFileSync(configFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

function writeDocument(configFile, document) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  const temporary = `${configFile}.${process.pid}.tmp`;
  try { fs.writeFileSync(temporary, stringify(document), { encoding: 'utf8', mode: 0o600 }); fs.renameSync(temporary, configFile); }
  finally { fs.rmSync(temporary, { force: true }); }
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
  saveUserStorageRoot,
};
