import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const repo = resolve(import.meta.dirname, '../../../..');
const evidence = import.meta.dirname;
const location = JSON.parse(await readFile(join(evidence, 'fixture-location.json'), 'utf8'));
const owned = location.owned_root;
assert.ok(resolve(owned).startsWith(resolve(repo, '.tinadec_dev/tmp/workspace-interface-ui') + '\\'));
const token = randomBytes(32).toString('base64url');
const children = [];
const requests = [];
let core, gateway;
async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
const coreUrl = 'http://127.0.0.1:' + await freePort();
const gatewayUrl = 'http://127.0.0.1:' + await freePort();
const env = { ...process.env, Version: '', 'Ice-Version': '', TINADEC_HOST_CONTROL_TOKEN: token, TINADEC_HOME: join(owned, 'user'), ASPNETCORE_ENVIRONMENT: 'Development', DOTNET_gcServer: '0', Logging__LogLevel__Default: 'Warning', Logging__LogLevel__Microsoft_EntityFrameworkCore: 'Warning' };
function start(command, args, cwd, additions) {
  const child = spawn(command, args, { cwd, env: { ...env, ...additions }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const handle = { child, output: '' };
  children.push(handle);
  child.stdout.on('data', chunk => handle.output += chunk);
  child.stderr.on('data', chunk => handle.output += chunk);
  child.on('error', error => handle.output += error.message);
  return handle;
}
async function waitService(url, handle) {
  for (let i = 0; i < 240; i++) {
    if (handle.child.exitCode !== null) throw new Error('Owned service exited: ' + handle.output);
    try { if ((await fetch(url + '/api/v1/health', { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Owned service startup timed out.');
}
async function startServices() {
  core = start('dotnet', [join(repo, '.tinadec_dev/tmp/workspace-api-trace/bin/TinadecCore.Api/debug/TinadecCore.Api.dll')], join(repo, 'TinadecCore/Api'), { ASPNETCORE_URLS: coreUrl, TinadecStorage__Enabled: 'true', TinadecStorage__UserRoot: join(owned, 'user'), TinadecTools__DefaultWorkspaceRoot: join(owned, 'default') });
  await waitService(coreUrl, core);
  gateway = start('bun', ['src/index.ts'], join(repo, 'TinadecGateway'), { TINADEC_CORE_URL: coreUrl, TINADEC_GATEWAY_PORT: new URL(gatewayUrl).port });
  await waitService(gatewayUrl, gateway);
  for (const [url, role] of [[coreUrl, 'core'], [gatewayUrl, 'gateway']]) {
    const nonce = randomBytes(32).toString('base64url');
    const proof = await (await fetch(url + '/api/v1/host-challenge?nonce=' + nonce)).json();
    assert.equal(proof.proof, createHmac('sha256', token).update('tinadec-host-v1\0' + role + '\0' + nonce).digest('hex'));
  }
}
async function stop(handle) {
  if (!handle || handle.child.exitCode !== null) return;
  const exit = new Promise(resolve => handle.child.once('exit', resolve));
  handle.child.kill();
  await Promise.race([exit, new Promise(resolve => setTimeout(resolve, 10000))]);
}
async function request(path, scope = 'user', method = 'GET', data, extra = {}) {
  const response = await fetch(gatewayUrl + path, { method, headers: { 'x-tinadec-host-control': token, 'x-tinadec-storage-id': scope, 'content-type': 'application/json', ...extra }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(120000) });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  const result = { status: response.status, body, etag: response.headers.get('etag') };
  requests.push({ path, scope, method, status: response.status, body });
  return result;
}
try {
  await startServices();
  console.log('Owned history HTTP services ready.');
  const projects = await request('/api/v1/projects');
  assert.equal(projects.status, 200);
  assert.equal(projects.body.length, 1);
  const project = projects.body[0];
  const scope = project.storage_id;
  assert.ok(scope && scope !== 'user');
  const before = await request('/api/v1/sessions', scope, 'POST', { project_id: project.id, title: 'Before GraphSeed precondition', view_mode: 'flat' });
  assert.equal(before.status, 409);
  assert.equal(before.body.code, 'agent_mode_not_configured');
  await writeFile(join(evidence, 'history-precondition.json'), JSON.stringify({ accepted: true, workspace_restored: true, scope, project_id: project.id, response: before }, null, 2));
  console.log('409 confirmed: empty fixture has no published default Agent Mode.');
  const manifest = JSON.parse(await readFile(join(repo, 'apps/desktop/src/agentPacks/GraphSeedPack/manifest.json'), 'utf8'));
  const source = await readFile(join(repo, 'apps/desktop/src/agentPacks/GraphSeedPack/index.ts'), 'utf8');
  const digest = source.match(/GRAPH_SEED_PACK_DIGEST = '([a-f0-9]+)'/)[1];
  const envelope = { manifest, integrity: { algorithm: 'sha256', digest } };
  const preview = await request('/api/v1/agent-packs/install-preview', scope, 'POST', envelope);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.action, 'install');
  const installed = await request('/api/v1/agent-packs/tinadec.graph.seed-pack', scope, 'PUT', { preview_id: preview.body.preview_id, envelope }, { 'if-match': preview.etag, 'idempotency-key': 'workspace-history-' + randomBytes(12).toString('hex') });
  assert.equal(installed.status, 201);
  const session = await request('/api/v1/sessions', scope, 'POST', { project_id: project.id, title: '接口回归历史会话', view_mode: 'flat' });
  assert.equal(session.status, 201);
  const listed = await request('/api/v1/sessions?project_id=' + project.id, scope);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0].title, '接口回归历史会话');
  console.log('Real session creation and scoped history read passed after explicit owned GraphSeed installation.');
  await stop(gateway);
  await stop(core);
  await startServices();
  const restoredProjects = await request('/api/v1/projects');
  assert.equal(restoredProjects.status, 200);
  assert.equal(restoredProjects.body[0].storage_id, scope);
  const restoredSessions = await request('/api/v1/sessions?project_id=' + project.id, scope);
  assert.equal(restoredSessions.status, 200);
  assert.equal(restoredSessions.body[0].id, session.body.id);
  assert.equal(restoredSessions.body[0].title, '接口回归历史会话');
  await writeFile(join(evidence, 'history-http-acceptance.json'), JSON.stringify({ accepted: true, real_core_gateway: true, existing_owned_root_only: true, random_ports: true, missing_default_mode_precondition: before.body, explicit_graphseed_installation: true, session_creation_status: session.status, history_after_restart: true, requests }, null, 2));
  console.log('Workspace and scoped history restored after owned Core/Gateway restart.');
} catch (error) {
  await writeFile(join(evidence, 'history-http-failure.json'), JSON.stringify({ accepted: false, message: error.message, requests }, null, 2));
  await writeFile(join(evidence, 'history-http-failure.log'), [error.stack, core?.output, gateway?.output].join('\n'));
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const handle of children.reverse()) await stop(handle);
}
