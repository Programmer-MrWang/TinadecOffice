const { randomBytes } = require('node:crypto');
const { canonicalLocalGatewayUrl } = require('./serviceManager.cjs');
/** Lives in the trusted main process and child service environment, never the renderer. */
function createHostControl({ fetchImpl = globalThis.fetch, startupToken, isTrustedHost = () => false } = {}) {
  if (startupToken !== undefined && (typeof startupToken !== 'string' || !/^[A-Za-z0-9_-]{43,256}$/.test(startupToken)))
    throw new Error('The trusted startup host credential is invalid.');
  const token = startupToken ?? randomBytes(32).toString('base64url');
  async function storageAction(gatewayUrl, storageId, action, input) {
    if (!canonicalLocalGatewayUrl(gatewayUrl)) throw new Error('Storage changes require the managed local host with a trusted host-control credential.');
    if (!isTrustedHost()) throw new Error('The local host identity has not been verified. Restart the trusted host before accessing storage.');
    if (typeof storageId !== 'string' || !/^(user|[a-f0-9]{32})$/.test(storageId)) throw new Error('Invalid storage identity.');
    const actions = { 'write-policy': 'POST', configure: 'POST', cleanup: 'POST', 'content-collect': 'POST', 'storage-delete': 'POST', unregister: 'DELETE' };
    if (!Object.hasOwn(actions, action)) throw new Error('Unknown trusted storage action.');
    let body;
    if (action === 'write-policy') {
      if (typeof input?.allow_storage_write !== 'boolean') throw new Error('Storage write policy must be a boolean.');
      body = { allow_storage_write: input.allow_storage_write };
    } else if (action === 'configure') {
      if (!['sqlite', 'postgresql'].includes(input?.backend)) throw new Error('Invalid storage backend.');
      for (const key of ['storage_root', 'postgres_connection_reference']) if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > 4096)) throw new Error(`Invalid ${key}.`);
      body = { backend: input.backend, ...(input.storage_root === undefined ? {} : { storage_root: input.storage_root }), ...(input.postgres_connection_reference === undefined ? {} : { postgres_connection_reference: input.postgres_connection_reference }) };
    } else if (action !== 'unregister') {
      if (typeof input?.preview_id !== 'string' || !/^[a-zA-Z\d_-]{1,128}$/.test(input.preview_id)) throw new Error('Invalid storage preview identity.');
      body = { preview_id: input.preview_id };
    }
    const suffix = action === 'unregister' ? '' : `/${action}`;
    const response = await fetchImpl(`http://127.0.0.1:48730/api/v1/storage/scopes/${storageId}${suffix}`, {
      method: actions[action], headers: { accept: 'application/json', 'content-type': 'application/json', 'x-tinadec-storage-id': 'user', 'x-tinadec-host-control': token },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120_000), redirect: 'error',
    });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) throw new Error(result.detail || result.message || `Host control returned ${response.status}`);
    return result;
  }
  const setStorageWritePolicy = (gatewayUrl, storageId, allow) => storageAction(gatewayUrl, storageId, 'write-policy', { allow_storage_write: allow });
  return { serviceToken: token, setStorageWritePolicy, storageAction };
}
module.exports = { createHostControl };
