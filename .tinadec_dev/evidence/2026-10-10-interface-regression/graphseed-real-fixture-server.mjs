import { createServer as createViteServer } from '../../../node_modules/vite/dist/node/index.js';
import vue from '../../../node_modules/@vitejs/plugin-vue/dist/index.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHmac, createHash, randomBytes, randomUUID } from 'node:crypto';
import * as toml from '../../../node_modules/smol-toml/dist/index.js';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const scratch = join(root, '.tinadec_dev', 'tmp', 'graphseed-interface-ui', 'runtime-' + randomBytes(6).toString('hex'));
const evidence = join(root, '.tinadec_dev', 'evidence', '2026-10-10-interface-regression', 'graphseed-real');
const configIds = ['agents', 'models', 'prompts', 'tools', 'mcp', 'skills', 'storage', 'logging', 'runtime'];
async function userHashes() { return Promise.all(configIds.slice().sort().map(async id => { const bytes = await readFile(join(process.env.USERPROFILE, '.tinadec/config', id + '.toml')); return { name: id + '.toml', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; })); }
const beforeUserHashes = await userHashes();
let activeUserRoot = join(scratch, 'user');
const token = randomBytes(32).toString('base64url');
const children = [];
const requests = [];
let injected = false;
let invalidAgentsBytes = null;
let resultCode = 1;
let vite;
let core;
let gateway;
async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function start(command, args, cwd, environment = {}) {
  const child = spawn(command, args, { cwd, windowsHide: true, env: { ...process.env, Version: '', 'Ice-Version': '', ...environment }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  const chunks = [];
  child.stdout.on('data', data => chunks.push(data));
  child.stderr.on('data', data => chunks.push(data));
  child.on('error', error => chunks.push(Buffer.from(error.message)));
  return { child, output: () => Buffer.concat(chunks).toString() };
}
async function waitFor(url, child) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (child.exitCode !== null) throw new Error('Owned service exited before becoming healthy.');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Owned service health timeout.');
}

async function stopOwnedCore() {
  const child = core.child;
  if (child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  await exited;
}
function installationFixture(text) {
  const document = toml.parse(text);
  const installation = document.agent_pack_installations?.find(item => item.pack_id === 'tinadec.graph.seed-pack');
  if (!installation) return { text, removed: {}, existing_pack_preserved: true, fixture: 'current_copy_without_installed_graphseed' };
  const versions = new Set(document.agent_pack_versions.filter(item => item.installation_id === installation.id).map(item => item.id));
  const managed = document.agent_pack_managed_resources.filter(item => item.installation_id === installation.id);
  const idsFor = kind => new Set(managed.filter(item => item.resource_kind === kind).map(item => item.logical_entity_id));
  const agentIds = idsFor('agent'); const modeIds = idsFor('mode'); const promptIds = idsFor('prompt_pipeline');
  const adoption = document.agent_pack_default_adoptions.filter(item => item.installation_id === installation.id).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  if (adoption) for (const row of document.workspace_defaults ?? []) {
    if (row.tenant_id !== adoption.tenant_id || row.workspace_id !== adoption.workspace_id) continue;
    for (const key of ['agent_definition_id', 'agent_version_id', 'agent_mode_id', 'mode_version_id', 'prompt_pipeline_id', 'prompt_version_id']) {
      const old = adoption['previous_' + key];
      if (old !== undefined) row['default_' + key] = old;
      else delete row['default_' + key];
    }
  }
  const selectors = {
    agent_pack_installations: item => item.id === installation.id,
    agent_pack_versions: item => item.installation_id === installation.id,
    agent_pack_managed_resources: item => item.installation_id === installation.id,
    agent_pack_resource_bindings: item => versions.has(item.pack_version_id),
    agent_pack_default_adoptions: item => item.installation_id === installation.id,
    agent_definitions: item => agentIds.has(item.id),
    agent_versions: item => agentIds.has(item.agent_definition_id),
    prompt_pipelines: item => promptIds.has(item.id),
    prompt_versions: item => promptIds.has(item.prompt_pipeline_id),
    prompt_nodes: item => promptIds.has(item.prompt_pipeline_id),
    agent_modes: item => modeIds.has(item.id),
    mode_versions: item => modeIds.has(item.agent_mode_id),
    mode_nodes: item => modeIds.has(item.mode_id),
    mode_edges: item => modeIds.has(item.mode_id),
    canvas_layouts: item => modeIds.has(item.mode_id),
  };
  const removed = {};
  for (const [table, selector] of Object.entries(selectors)) {
    if (!Array.isArray(document[table])) continue;
    const old = document[table]; document[table] = old.filter(item => !selector(item)); removed[table] = old.length - document[table].length;
    if (document[table].length === 0) delete document[table];
  }
  assert.ok(document.agent_definitions.some(item => item.slug === 'meeting' && item.status === 'published'), 'Installation fixture must retain an existing published meeting.');
  assert.ok(document.agent_pack_installations.some(item => item.pack_id === 'tinadec.tests.bootstrap-pack'), 'Existing bootstrap catalog must be preserved.');
  return { text: toml.stringify(document), removed, existing_pack_preserved: true, existing_published_meeting: true, fixture: 'current_copy_graphseed_owned_records_removed_in_scratch_only' };
}

try {
  await mkdir(join(scratch, 'user', 'config'), { recursive: true });
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, 'user-config-before.json'), JSON.stringify({ checked_at: new Date().toISOString(), source: '~/.tinadec/config', files: beforeUserHashes }, null, 2) + '\n');
  for (const id of configIds)
    await copyFile(join(process.env.USERPROFILE, '.tinadec', 'config', id + '.toml'), join(scratch, 'user', 'config', id + '.toml'));
  let agentsPath = join(scratch, 'user', 'config', 'agents.toml');
  let originalAgents = await readFile(agentsPath, 'utf8');
  const tenant = originalAgents.match(/^tenant_id\s*=\s*"([^"]+)"/m)?.[1];
  const workspace = originalAgents.match(/^workspace_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!tenant || !workspace) throw new Error('Copied configuration has no scoped identity.');
  const corePort = await freePort();
  const gatewayPort = await freePort();
  const uiPort = await freePort();
  const coreUrl = `http://127.0.0.1:${corePort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const uiUrl = `http://127.0.0.1:${uiPort}`;
  const serviceEnvironment = { TINADEC_HOST_CONTROL_TOKEN: token, TINADEC_HOME: activeUserRoot, ASPNETCORE_ENVIRONMENT: 'Development' };
  await mkdir(join(scratch, 'workspace'), { recursive: true });
  const startCore = () => start(join(process.env.ProgramFiles, 'dotnet/dotnet.exe'), ['exec', join(root, '.tinadec_dev/tmp/workspace-api-audit/bin/TinadecCore.Api/debug/TinadecCore.Api.dll')], join(root, 'TinadecCore/Api'), { ...serviceEnvironment, TINADEC_HOME: activeUserRoot, ASPNETCORE_URLS: coreUrl, TinadecStorage__Enabled: 'true', TinadecStorage__UserRoot: activeUserRoot, TinadecTools__DefaultWorkspaceRoot: join(scratch, 'workspace') });
  console.log(JSON.stringify({ step: 'exact_user_copy_core_starting', owned: true }));
  core = startCore();
  await waitFor(coreUrl + '/api/v1/health', core.child);
  console.log(JSON.stringify({ step: 'exact_user_copy_core_ready', owned: true }));
  gateway = start('bun', ['src/index.ts'], join(root, 'TinadecGateway'), { ...serviceEnvironment, TINADEC_CORE_URL: coreUrl, TINADEC_GATEWAY_PORT: String(gatewayPort), TINADEC_GATEWAY_CORS_ORIGINS: uiUrl });
  await waitFor(gatewayUrl + '/api/v1/health', gateway.child);
  for (const [url, role] of [[coreUrl, 'core'], [gatewayUrl, 'gateway']]) {
    const nonce = randomBytes(32).toString('base64url');
    const proof = await (await fetch(url + '/api/v1/host-challenge?nonce=' + nonce)).json();
    if (proof.proof !== createHmac('sha256', token).update(`tinadec-host-v1\0${role}\0${nonce}`).digest('hex')) throw new Error('Owned service identity proof failed.');
  }

  // First exercise the exact, read-only current-user copy. No catalog pruning is used here.
  const authorizedHeaders = { 'x-tinadec-host-control': token, 'x-tinadec-storage-id': 'user' };
  const manifest = JSON.parse(await readFile(join(root, 'apps/desktop/src/agentPacks/GraphSeedPack/manifest.json'), 'utf8'));
  const source = await readFile(join(root, 'apps/desktop/src/agentPacks/GraphSeedPack/index.ts'), 'utf8');
  const digest = source.match(/GRAPH_SEED_PACK_DIGEST = '([a-f0-9]+)'/)[1];
  const envelope = { manifest, integrity: { algorithm: 'sha256', digest } };
  const currentResponse = await fetch(gatewayUrl + '/api/v1/agent-packs', { headers: authorizedHeaders });
  assert.equal(currentResponse.status, 200);
  const currentPacks = await currentResponse.json();
  const currentPreviewResponse = await fetch(gatewayUrl + '/api/v1/agent-packs/install-preview', { method: 'POST', headers: { ...authorizedHeaders, 'content-type': 'application/json' }, body: JSON.stringify(envelope) });
  assert.equal(currentPreviewResponse.status, 200);
  const currentPreview = await currentPreviewResponse.json();
  assert.equal(currentPreview.action, 'up_to_date');
  assert.equal(currentPreviewResponse.headers.get('etag'), '"' + currentPreview.revision + '"');
  await writeFile(join(evidence, 'current-config-read.json'), JSON.stringify({ exact_current_user_toml_copy: true, copied_database_or_credentials: false, inventory_status: currentResponse.status, packs: currentPacks.map(pack => ({ pack_id: pack.pack_id, active_version: pack.active_version })), preview_status: currentPreviewResponse.status, preview_action: currentPreview.action, preview_etag: currentPreviewResponse.headers.get('etag'), version: manifest.metadata.version, digest }, null, 2) + '\n');
  // A second owned root provides an explicit pre-install fixture; it never changes the user copy.
  const fixture = installationFixture(originalAgents);
  const fixtureValidationResponse = await fetch(gatewayUrl + '/api/v1/configuration/documents/agents/validate', { method: 'POST', headers: { ...authorizedHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ text: fixture.text }) });
  assert.equal(fixtureValidationResponse.status, 200);
  const fixtureValidation = await fixtureValidationResponse.json();
  assert.deepEqual(fixtureValidation.diagnostics ?? fixtureValidation, [], 'Scratch installation fixture must validate before starting its Core.');
  activeUserRoot = join(scratch, 'installation-user');
  await mkdir(join(activeUserRoot, 'config'), { recursive: true });
  for (const id of configIds) await copyFile(join(scratch, 'user', 'config', id + '.toml'), join(activeUserRoot, 'config', id + '.toml'));
  agentsPath = join(activeUserRoot, 'config/agents.toml'); originalAgents = fixture.text;
  await writeFile(agentsPath, originalAgents);
  await writeFile(join(evidence, 'installation-fixture.json'), JSON.stringify({ fixture: fixture.fixture, removed_in_scratch_only: fixture.removed, existing_pack_preserved: fixture.existing_pack_preserved, existing_published_meeting: fixture.existing_published_meeting, exact_current_copy_separately_verified: true }, null, 2) + '\n');
  console.log(JSON.stringify({ step: 'pre_install_fixture_core_starting', owned: true }));
  await stopOwnedCore(); core = startCore(); await waitFor(coreUrl + '/api/v1/health', core.child);
  console.log(JSON.stringify({ step: 'pre_install_fixture_core_ready', owned: true }));

  const config = { config: { base: './', resolve: { alias: { '@': join(root, 'apps/desktop/src'), '@tinadec/ui': join(root, 'apps/TinadecUI/src/index.ts'), vue: join(root, 'apps/desktop/src/lib/vue-shim.ts'), '@vue/reactivity': join(root, 'node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js'), '@vue/runtime-dom': join(root, 'node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js'), '@vue/runtime-vapor': join(root, 'node_modules/@vue/runtime-vapor/dist/runtime-vapor.esm-bundler.js') }, dedupe: ['vue', '@vue/reactivity', '@vue/runtime-dom', '@vue/runtime-vapor'] }, plugins: [vue()] } };
  const builtIndex = await readFile(join(root, 'apps/desktop/dist/index.html'), 'utf8');
  const cssReferences = [...builtIndex.matchAll(/<link[^>]+href="([^\"]+\.css)"/g)].map(match => match[1]);
  if (!cssReferences.length) throw new Error('Existing Desktop build has no base stylesheet.');
  const baseCss = (await Promise.all(cssReferences.map(path => readFile(resolve(root, 'apps/desktop/dist', path), 'utf8')))).join('\n').replaceAll('url(./', 'url(/dist/assets/');
  vite = await createViteServer({ ...config.config, root: join(root, 'apps/desktop'), configFile: false, cacheDir: join(scratch, 'vite-cache'), optimizeDeps: { noDiscovery: true, entries: [], include: ['pinia', 'vue-router', 'vue-i18n', '@vue/runtime-dom', '@vue/runtime-vapor', '@lucide/vue', 'class-variance-authority', 'clsx', 'tailwind-merge'] }, server: { port: uiPort, host: '127.0.0.1', strictPort: true, preTransformRequests: false, fs: { allow: [root] } }, plugins: [...config.config.plugins.flat(Infinity).filter(plugin => plugin?.name === 'vite:vue'), {
    name: 'owned-graphseed-ui-fixture',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          if (request.url === '/__graphseed_css') { response.setHeader('content-type', 'text/css'); response.end(baseCss); return; }
          if (request.url === '/__graphseed_fixture') {
            const html = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>GraphSeedPack isolated acceptance</title><link rel="stylesheet" href="/__graphseed_css"></head><body><div id="app"></div><script>window.tinadec={gatewayUrl:()=>location.origin}</script><script type="module" src="/@fs/${join(root, '.tinadec_dev/tmp/graphseed-interface-ui/renderer.mjs').replaceAll('\\', '/')}"></script></body></html>`;
            response.setHeader('content-type', 'text/html'); response.end(html); return;
          }
          if (!request.url?.startsWith('/api/v1/')) { next(); return; }
          const isInstall = request.method === 'PUT' && request.url === '/api/v1/agent-packs/tinadec.graph.seed-pack';
          if (isInstall && !injected) {
            injected = true;
            const id = () => randomUUID();
            const duplicate = [1, 2].map(number => `\n[[agent_definitions]]\nid = "${id()}"\ntenant_id = "${tenant}"\nworkspace_id = "${workspace}"\nslug = "isolated-validation-draft"\nstatus = "draft"\nsource_kind = "custom"\nsource_key = "isolated-draft-${number}"\n`).join('');
            invalidAgentsBytes = Buffer.from(originalAgents + duplicate);
            await writeFile(agentsPath, invalidAgentsBytes);
          }
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const headers = new Headers({ accept: request.headers.accept || 'application/json', 'x-tinadec-host-control': token, 'x-tinadec-storage-id': 'user' });
          for (const key of ['content-type', 'if-match', 'idempotency-key']) if (request.headers[key]) headers.set(key, request.headers[key]);
          const upstream = await fetch(gatewayUrl + request.url, { method: request.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}), redirect: 'manual' });
          const bytes = Buffer.from(await upstream.arrayBuffer());
          const record = { method: request.method, path: request.url, status: upstream.status, etag: upstream.headers.get('etag') };
          if (upstream.status >= 400) { const problem = JSON.parse(bytes.toString()); record.code = problem.code; record.category = problem.category; record.retryable = problem.retryable; record.actions = problem.actions; record.diagnostics = problem.diagnostics; record.trace_id_present = typeof problem.trace_id === 'string'; }
          if (isInstall && upstream.status === 400) {
            const problem = JSON.parse(bytes.toString());
            record.code = problem.code; record.diagnostics = problem.diagnostics; record.trace_id_present = typeof problem.trace_id === 'string';
            assert.deepEqual(await readFile(agentsPath), invalidAgentsBytes, 'A validation refusal must not modify authoritative TOML bytes.');
            record.configuration_bytes_unchanged_on_failure = true;
            await writeFile(agentsPath, originalAgents);
            const failedInventoryResponse = await fetch(gatewayUrl + '/api/v1/agent-packs', { headers: { 'x-tinadec-host-control': token, 'x-tinadec-storage-id': 'user' } });
            assert.equal(failedInventoryResponse.status, 200);
            const failedInventory = await failedInventoryResponse.json();
            assert.equal(failedInventory.some(pack => pack.pack_id === 'tinadec.graph.seed-pack'), false);
            record.no_partial_installation_after_failure = true;
          }
          requests.push(record);
          response.statusCode = upstream.status;
          for (const key of ['content-type', 'etag']) if (upstream.headers.has(key)) response.setHeader(key, upstream.headers.get(key));
          response.end(bytes);
        } catch (error) { response.statusCode = 500; response.end(JSON.stringify({ message: error.message })); }
      });
    },
  }] });
  await vite.listen();
  vite.httpServer.on('request', request => { if (request.url?.startsWith('/__graphseed')) console.log(JSON.stringify({ step: 'fixture_http_request', path: request.url })); });
  console.log(JSON.stringify({ step: 'fixture_listening', address: vite.httpServer.address() }));
  const fixtureProbe = await fetch(uiUrl + '/__graphseed_fixture', { signal: AbortSignal.timeout(15000) });
  assert.equal(fixtureProbe.status, 200); assert.match(await fixtureProbe.text(), /GraphSeedPack isolated acceptance/);
  console.log(JSON.stringify({ ready: true, ui_url: uiUrl + '/__graphseed_fixture', isolated: true, real_core: true, real_gateway: true }));
  const electron = start(join(root, 'node_modules/electron/dist/electron.exe'), [join(root, '.tinadec_dev/tmp/graphseed-interface-ui/electron.cjs')], root, { GRAPHSEED_UI_URL: uiUrl + '/__graphseed_fixture', GRAPHSEED_UI_EVIDENCE: evidence });
  resultCode = await new Promise(resolve => electron.child.once('exit', code => resolve(code ?? 1)));
  await writeFile(join(evidence, 'desktop-real-http-requests.json'), JSON.stringify({ isolated: true, real_core: true, real_gateway: true, requests }, null, 2) + '\n');
  await writeFile(join(evidence, 'desktop-electron.log'), electron.output());
  if (resultCode === 0) {
    const headers = { 'x-tinadec-host-control': token, 'x-tinadec-storage-id': 'user' };
    const before = await (await fetch(gatewayUrl + '/api/v1/workspace-defaults', { headers })).json();
    await stopOwnedCore();
    core = startCore();
    await waitFor(coreUrl + '/api/v1/health', core.child);
    const response = await fetch(gatewayUrl + '/api/v1/agent-packs', { headers });
    assert.equal(response.status, 200);
    const packs = await response.json();
    assert.equal(packs.find(pack => pack.pack_id === 'tinadec.graph.seed-pack').active_version, '3.0.1');
    assert.ok(packs.find(pack => pack.pack_id === 'tinadec.tests.bootstrap-pack'));
    const after = await (await fetch(gatewayUrl + '/api/v1/workspace-defaults', { headers })).json();
    assert.deepEqual(after, before);
    const staleDelete = await fetch(gatewayUrl + '/api/v1/agent-packs/tinadec.graph.seed-pack', { method: 'DELETE', headers: { ...headers, 'if-match': '"999999"' } });
    assert.equal(staleDelete.status, 412);
    const staleProblem = await staleDelete.json();
    assert.equal(staleProblem.code, 'agent_pack_revision_conflict');
    const postRefusal = await (await fetch(gatewayUrl + '/api/v1/agent-packs', { headers })).json();
    assert.equal(postRefusal.find(pack => pack.pack_id === 'tinadec.graph.seed-pack').active_version, '3.0.1');
    await writeFile(join(evidence, 'real-cas-refusal.json'), JSON.stringify({ expected_status: 412, observed_status: staleDelete.status, code: staleProblem.code, error_etag: staleDelete.headers.get('etag'), trace_id_present: typeof staleProblem.trace_id === 'string', category: staleProblem.category, retryable: staleProblem.retryable, actions: staleProblem.actions, inventory_preserved_after_refusal: true }, null, 2) + '\n');
    await writeFile(join(evidence, 'desktop-core-restart.json'), JSON.stringify({ real_core_process_restarted: true, isolated: true, read_status: response.status, packs: packs.map(pack => ({ pack_id: pack.pack_id, active_version: pack.active_version })), workspace_defaults_unchanged: true }, null, 2) + '\n');
  }
  if (resultCode !== 0) {
    await writeFile(join(scratch, 'core.log'), core.output()); await writeFile(join(scratch, 'gateway.log'), gateway.output());
    console.error(JSON.stringify({ failed: true, exit_code: resultCode, owned_diagnostics: scratch }));
  }
} catch (error) { resultCode = 1; console.error(error.stack); }
finally {
  const afterUserHashes = await userHashes();
  const unchanged = JSON.stringify(afterUserHashes) === JSON.stringify(beforeUserHashes);
  await writeFile(join(evidence, 'user-config-after.json'), JSON.stringify({ checked_at: new Date().toISOString(), source: '~/.tinadec/config', unchanged, files: afterUserHashes }, null, 2) + '\n');
  if (!unchanged) { resultCode = 1; console.error('Actual user TOML changed while isolated acceptance ran; do not claim preservation without investigation.'); }
  await vite?.close();
  if (resultCode !== 0) {
    if (core) await writeFile(join(scratch, 'core.log'), core.output());
    if (gateway) await writeFile(join(scratch, 'gateway.log'), gateway.output());
    console.error(JSON.stringify({ owned_diagnostics: scratch }));
  }
  for (const child of children.reverse()) if (child.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    else child.kill();
  }
}
process.exit(resultCode);
