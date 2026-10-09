const assert = require('node:assert/strict');
const test = require('node:test');
const { createHostControl } = require('./hostControl.cjs');
test('host control uses an opaque token only on the managed loopback request', async () => {
  const calls = [];
  const host = createHostControl({ isTrustedHost: () => true, fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json({ storage_id: '1'.repeat(32), allow_storage_write: true }); } });
  assert.ok(host.serviceToken.length >= 40);
  assert.notEqual(host.serviceToken, createHostControl().serviceToken);
  const result = await host.setStorageWritePolicy('http://localhost:48730', '1'.repeat(32), true);
  assert.equal(result.allow_storage_write, true);
  assert.equal(new Headers(calls[0].init.headers).get('x-tinadec-host-control'), host.serviceToken);
  assert.equal(new Headers(calls[0].init.headers).get('x-tinadec-storage-id'), 'user');
  assert.equal(calls[0].init.redirect, 'error');
  await assert.rejects(host.setStorageWritePolicy('https://gateway.example.com', '1'.repeat(32), true), /managed local/);
  await assert.rejects(host.setStorageWritePolicy('http://localhost:48730', '../user', true), /identity/);
  assert.equal(calls.length, 1);
});
test('maintenance is constrained to validated host actions without accepting arbitrary paths or bodies', async () => {
  const calls = [];
  const host = createHostControl({ isTrustedHost: () => true, fetchImpl: async (url, init) => { calls.push({ url, init }); return init.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ ok: true }); } });
  const storage = 'a'.repeat(32);
  for (const action of ['cleanup', 'content-collect', 'storage-delete']) await host.storageAction('http://127.0.0.1:48730', storage, action, { preview_id: 'a'.repeat(32), path: 'ignored' });
  await host.storageAction('http://127.0.0.1:48730', storage, 'configure', { backend: 'sqlite', storage_root: 'C:/storage', extra: 'ignored' });
  await host.storageAction('http://127.0.0.1:48730', storage, 'unregister');
  assert.equal(calls.length, 5);
  for (const call of calls) assert.equal(new Headers(call.init.headers).get('x-tinadec-host-control'), host.serviceToken);
  assert.deepEqual(JSON.parse(calls[0].init.body), { preview_id: 'a'.repeat(32) });
  assert.deepEqual(JSON.parse(calls[3].init.body), { backend: 'sqlite', storage_root: 'C:/storage' });
  assert.equal(calls[4].init.method, 'DELETE'); assert.equal(calls[4].init.body, undefined);
  await assert.rejects(host.storageAction('http://127.0.0.1:48730', storage, '../delete', {}), /Unknown/);
  await assert.rejects(host.storageAction('http://127.0.0.1:48730', storage, 'cleanup', { preview_id: '../bad' }), /preview/);
  await assert.rejects(host.storageAction('http://127.0.0.1:48730', storage, 'configure', { backend: 'other' }), /backend/);
  await assert.rejects(host.storageAction('https://remote.example', storage, 'cleanup', { preview_id: 'valid' }), /managed local/);
  assert.equal(calls.length, 5);
});

test('a trusted development launch can reuse its opaque credential without exposing arbitrary values', () => {
  const startupToken = 'a'.repeat(43);
  assert.equal(createHostControl({ startupToken }).serviceToken, startupToken);
  for (const invalid of ['', 'short', ' '.repeat(43), 'a\n'.repeat(43), 'a'.repeat(257)])
    assert.throws(() => createHostControl({ startupToken: invalid }), /startup host credential/);
});

test('an unverified or revoked local endpoint never receives a private Node IPC credential', async () => {
  let called = false; let verified = false;
  const host = createHostControl({ isTrustedHost: () => verified, fetchImpl: async () => { called = true; return Response.json({}); } });
  await assert.rejects(host.setStorageWritePolicy('http://127.0.0.1:48730', 'a'.repeat(32), true), /not been verified/);
  assert.equal(called, false);
  verified = true; await host.setStorageWritePolicy('http://127.0.0.1:48730', 'a'.repeat(32), true);
  called = false; verified = false;
  await assert.rejects(host.setStorageWritePolicy('http://127.0.0.1:48730', 'a'.repeat(32), true), /not been verified/);
  assert.equal(called, false);
});
