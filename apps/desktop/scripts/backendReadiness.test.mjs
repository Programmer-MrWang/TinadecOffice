import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { developmentBackendIsReady } from './backendReadiness.mjs';
const setup = (overrides = {}) => ({ gatewayUrl: 'http://127.0.0.1:48730', coreUrl: 'http://127.0.0.1:48731', token: 'a'.repeat(43),
  probeJson: async url => url.includes('48730') ? { status: 200, data: { core_status: 'ready' } } : { status: 200, data: { name: 'tinadec-core' } },
  verifyIdentity: async () => true, ...overrides });
test('ready Core alone cannot claim shared backend readiness while Gateway is unavailable', async () => {
  let proofs = 0;
  const result = await developmentBackendIsReady(setup({ probeJson: async url => url.includes('48730')
    ? { status: 503, data: { core_status: 'unreachable' } } : { status: 200, data: { name: 'tinadec-core' } },
    verifyIdentity: async () => { proofs++; } }));
  assert.equal(result, false); assert.equal(proofs, 0);
});
test('both ready services must prove the same launch key and their respective roles', async () => {
  const proofs = [];
  assert.equal(await developmentBackendIsReady(setup({ verifyIdentity: async (...args) => { proofs.push(args); return true; } })), true);
  assert.deepEqual(proofs.map(x => x.slice(1)), [['core', 'a'.repeat(43)], ['gateway', 'a'.repeat(43)]]);
});
test('temporary challenge failures wait while wrong identity reports an actionable safe failure', async () => {
  assert.equal(await developmentBackendIsReady(setup({ verifyIdentity: async () => { throw new Error('fetch failed'); } })), false);
  await assert.rejects(developmentBackendIsReady(setup({ verifyIdentity: async () => {
    throw Object.assign(new Error('private-key-value'), { code: 'host_identity_rejected' });
  } })), error => error.message.includes('npm run dev') && !error.message.includes('private-key-value'));
});

// Exercise the launcher's actual wait without starting processes or contacting
// a user's services. Main's independent identity gate remains the authority.
async function runLauncherWait({ budget = 50, ready = false } = {}) {
  const source = await readFile(new URL('./dev.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function waitForBackend() {');
  const end = source.indexOf('\nasync function main()', start);
  assert.ok(start >= 0 && end > start);
  const logs = [];
  let clock = 0;
  const execute = new Function('BACKEND_WAIT_MS', 'backendIsReady', 'Date', 'setTimeout', 'console', 'GATEWAY_URL', 'CORE_URL',
    source.slice(start, end) + '\nreturn waitForBackend();');
  const result = await execute(budget, async () => ready, { now: () => clock }, callback => { clock += 1000; callback(); },
    { log: message => logs.push(message), warn: message => logs.push(message) }, 'http://owned.invalid/gateway', 'http://owned.invalid/core');
  return { result, logs };
}

test('launcher timeout opens a recovery interface without claiming backend readiness', async () => {
  const { result, logs } = await runLauncherWait();
  assert.equal(result, false);
  assert.ok(logs.some(message => message.includes('recovery interface') && message.includes('blocks business requests')));
});

test('launcher reports verified readiness and skipped waiting as different decisions', async () => {
  assert.equal((await runLauncherWait({ ready: true })).result, true);
  assert.equal((await runLauncherWait({ budget: 0 })).result, false);
});
