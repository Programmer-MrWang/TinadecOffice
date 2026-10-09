import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { app } from './index.js';
import { isPublicPath } from './auth.js';

test('public Gateway host challenge binds nonce and role without disclosing its credential', async () => {
  const before = process.env.TINADEC_HOST_CONTROL_TOKEN;
  const key = 'private-fixture-credential'; const nonce = 'a'.repeat(43);
  process.env.TINADEC_HOST_CONTROL_TOKEN = key;
  try {
    assert.equal(isPublicPath('/api/v1/host-challenge'), true);
    const response = await app.handle(new Request(`http://gateway.local/api/v1/host-challenge?nonce=${nonce}`));
    assert.equal(response.status, 200);
    const text = await response.text(); assert.equal(text.includes(key), false);
    const expected = createHmac('sha256', key).update(`tinadec-host-v1\0gateway\0${nonce}`).digest('hex');
    assert.deepEqual(JSON.parse(text), { role: 'gateway', nonce, proof: expected });
    assert.notEqual(expected, createHmac('sha256', key).update(`tinadec-host-v1\0core\0${nonce}`).digest('hex'));
  } finally { if (before === undefined) delete process.env.TINADEC_HOST_CONTROL_TOKEN; else process.env.TINADEC_HOST_CONTROL_TOKEN = before; }
});

test('host challenge rejects missing, repeated or malformed nonce and missing host key', async () => {
  const before = process.env.TINADEC_HOST_CONTROL_TOKEN;
  try {
    for (const query of ['', '?nonce=short', `?nonce=${'a'.repeat(44)}`, `?nonce=${'%20'.repeat(43)}`, `?nonce=${'a'.repeat(43)}&nonce=${'b'.repeat(43)}`])
      assert.equal((await app.handle(new Request(`http://gateway.local/api/v1/host-challenge${query}`))).status, 400);
    delete process.env.TINADEC_HOST_CONTROL_TOKEN;
    const response = await app.handle(new Request(`http://gateway.local/api/v1/host-challenge?nonce=${'a'.repeat(43)}`));
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, 'host_identity_unavailable');
  } finally { if (before === undefined) delete process.env.TINADEC_HOST_CONTROL_TOKEN; else process.env.TINADEC_HOST_CONTROL_TOKEN = before; }
});
