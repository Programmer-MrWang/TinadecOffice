const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

function identityError(code, message) { return Object.assign(new Error(message), { code }); }

async function verifyHostIdentity(baseUrl, role, token, { fetchImpl = globalThis.fetch, timeoutMs = 2000, signal, nonceFactory = () => randomBytes(32).toString('base64url') } = {}) {
  const endpoint = new URL(baseUrl);
  const expectedPort = role === 'core' ? '48731' : role === 'gateway' ? '48730' : undefined;
  if (!expectedPort || endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(endpoint.hostname)
    || endpoint.port !== expectedPort || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash)
    throw identityError('host_endpoint_invalid', 'Host identity is limited to the managed local Core/Gateway endpoints.');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43,256}$/.test(token)) throw identityError('host_credential_invalid', 'A trusted startup credential is required to verify the local host.');
  const nonce = nonceFactory();
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw identityError('host_nonce_invalid', 'Invalid host identity nonce.');
  const challenge = new URL('/api/v1/host-challenge', endpoint); challenge.searchParams.set('nonce', nonce);
  // The public challenge never receives the credential itself, even before endpoint identity is known.
  const response = await fetchImpl(challenge.href, { headers: { accept: 'application/json' }, redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw identityError([400, 401, 403, 404].includes(response.status) ? 'host_identity_rejected' : 'host_identity_unavailable', `The local ${role} cannot prove its trusted host identity (${response.status}).`);
  let body;
  try { body = await response.json(); }
  catch { throw identityError('host_identity_rejected', `The local ${role} supplied an invalid trusted host identity proof.`); }
  const expected = createHmac('sha256', token).update(`tinadec-host-v1\0${role}\0${nonce}`, 'utf8').digest();
  if (body?.role !== role || body.nonce !== nonce || typeof body.proof !== 'string' || !/^[a-f0-9]{64}$/.test(body.proof)
    || !timingSafeEqual(expected, Buffer.from(body.proof, 'hex')))
    throw identityError('host_identity_rejected', `The local ${role} supplied an invalid trusted host identity proof.`);
  return true;
}

async function verifyManagedHost(token, options) {
  await Promise.all([
    verifyHostIdentity('http://127.0.0.1:48731', 'core', token, options),
    verifyHostIdentity('http://127.0.0.1:48730', 'gateway', token, options),
  ]);
  return true;
}

module.exports = { verifyHostIdentity, verifyManagedHost };
