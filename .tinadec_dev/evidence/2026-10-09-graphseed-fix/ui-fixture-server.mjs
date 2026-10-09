import { createServer as createViteServer, loadConfigFromFile } from '../../../node_modules/vite/dist/node/index.js';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const scratch = join(root, '.tinadec_dev', 'tmp', 'graphseed-ui', 'runtime-' + randomBytes(6).toString('hex'));
const evidence = join(root, '.tinadec_dev', 'evidence', '2026-10-09-graphseed-fix');
const token = randomBytes(32).toString('base64url');
const children = [];
const requests = [];
let injected = false;
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
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error('Owned service exited before becoming healthy.');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Owned service health timeout.');
}
try {
  await mkdir(join(scratch, 'user', 'config'), { recursive: true });
  await mkdir(evidence, { recursive: true });
  for (const id of ['agents', 'models', 'prompts', 'tools', 'mcp', 'skills', 'storage', 'logging', 'runtime'])
    await copyFile(join(process.env.USERPROFILE, '.tinadec', 'config', id + '.toml'), join(scratch, 'user', 'config', id + '.toml'));
  const agentsPath = join(scratch, 'user', 'config', 'agents.toml');
  const originalAgents = await readFile(agentsPath, 'utf8');
  const tenant = originalAgents.match(/^tenant_id\s*=\s*"([^"]+)"/m)?.[1];
  const workspace = originalAgents.match(/^workspace_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!tenant || !workspace) throw new Error('Copied configuration has no scoped identity.');
  const corePort = await freePort();
  const gatewayPort = await freePort();
  const uiPort = await freePort();
  const coreUrl = `http://127.0.0.1:${corePort}`;
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const uiUrl = `http://127.0.0.1:${uiPort}`;
  const serviceEnvironment = { TINADEC_HOST_CONTROL_TOKEN: token, TINADEC_HOME: join(scratch, 'user'), ASPNETCORE_ENVIRONMENT: 'Development' };
  await mkdir(join(scratch, 'workspace'), { recursive: true });
  const startCore = () => start(process.execPath, [join(root, 'scripts/dotnet.mjs'), 'exec', join(root, '.tinadec_dev/tmp/graphseed-api-artifacts/bin/TinadecCore.Api/debug/TinadecCore.Api.dll')], join(root, 'TinadecCore/Api'), { ...serviceEnvironment, ASPNETCORE_URLS: coreUrl, TinadecStorage__Enabled: 'true', TinadecStorage__UserRoot: join(scratch, 'user'), TinadecTools__DefaultWorkspaceRoot: join(scratch, 'workspace') });
  core = startCore();
  await waitFor(coreUrl + '/api/v1/health', core.child);
  gateway = start('bun', ['src/index.ts'], join(root, 'TinadecGateway'), { ...serviceEnvironment, TINADEC_CORE_URL: coreUrl, TINADEC_GATEWAY_PORT: String(gatewayPort), TINADEC_GATEWAY_CORS_ORIGINS: uiUrl });
  await waitFor(gatewayUrl + '/api/v1/health', gateway.child);
  for (const [url, role] of [[coreUrl, 'core'], [gatewayUrl, 'gateway']]) {
    const nonce = randomBytes(32).toString('base64url');
    const proof = await (await fetch(url + '/api/v1/host-challenge?nonce=' + nonce)).json();
    if (proof.proof !== createHmac('sha256', token).update(`tinadec-host-v1\0${role}\0${nonce}`).digest('hex')) throw new Error('Owned service identity proof failed.');
  }
  const config = await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(root, 'apps/desktop/vite.config.ts'));
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
            const html = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>GraphSeedPack isolated acceptance</title><link rel="stylesheet" href="/__graphseed_css"></head><body><div id="app"></div><script>window.tinadec={gatewayUrl:()=>location.origin}</script><script type="module" src="/@fs/${join(root, '.tinadec_dev/tmp/graphseed-ui/renderer.mjs').replaceAll('\\', '/')}"></script></body></html>`;
            response.setHeader('content-type', 'text/html'); response.end(html); return;
          }
          if (!request.url?.startsWith('/api/v1/')) { next(); return; }
          const isInstall = request.method === 'PUT' && request.url === '/api/v1/agent-packs/tinadec.graph.seed-pack';
          if (isInstall && !injected) {
            injected = true;
            const id = () => randomUUID();
            const duplicate = [1, 2].map(number => `\n[[agent_definitions]]\nid = "${id()}"\ntenant_id = "${tenant}"\nworkspace_id = "${workspace}"\nslug = "isolated-validation-draft"\nstatus = "draft"\nsource_kind = "custom"\nsource_key = "isolated-draft-${number}"\n`).join('');
            await writeFile(agentsPath, originalAgents + duplicate);
          }
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const headers = new Headers({ accept: request.headers.accept || 'application/json', 'x-tinadec-host-control': token, 'x-tinadec-storage-id': 'user' });
          for (const key of ['content-type', 'if-match', 'idempotency-key']) if (request.headers[key]) headers.set(key, request.headers[key]);
          const upstream = await fetch(gatewayUrl + request.url, { method: request.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}), redirect: 'manual' });
          const bytes = Buffer.from(await upstream.arrayBuffer());
          const record = { method: request.method, path: request.url, status: upstream.status };
          if (isInstall && upstream.status === 400) {
            const problem = JSON.parse(bytes.toString());
            record.code = problem.code; record.diagnostics = problem.diagnostics; record.trace_id_present = typeof problem.trace_id === 'string';
            await writeFile(agentsPath, originalAgents);
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
  console.log(JSON.stringify({ ready: true, ui_url: uiUrl + '/__graphseed_fixture', isolated: true, real_core: true, real_gateway: true }));
  const electron = start(join(root, 'node_modules/electron/dist/electron.exe'), [join(root, '.tinadec_dev/tmp/graphseed-ui/electron.cjs')], root, { GRAPHSEED_UI_URL: uiUrl + '/__graphseed_fixture', GRAPHSEED_UI_EVIDENCE: evidence });
  resultCode = await new Promise(resolve => electron.child.once('exit', code => resolve(code ?? 1)));
  await writeFile(join(evidence, 'desktop-real-http-requests.json'), JSON.stringify({ isolated: true, real_core: true, real_gateway: true, requests }, null, 2) + '\n');
  await writeFile(join(evidence, 'desktop-electron.log'), electron.output());
  if (resultCode === 0) {
    const headers = { 'x-tinadec-host-control': token, 'x-tinadec-storage-id': 'user' };
    const before = await (await fetch(gatewayUrl + '/api/v1/workspace-defaults', { headers })).json();
    const stopped = core.child;
    const exited = new Promise(resolve => stopped.once('exit', resolve));
    spawnSync('taskkill.exe', ['/pid', String(stopped.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    await exited;
    core = startCore();
    await waitFor(coreUrl + '/api/v1/health', core.child);
    const response = await fetch(gatewayUrl + '/api/v1/agent-packs', { headers });
    assert.equal(response.status, 200);
    const packs = await response.json();
    assert.equal(packs.find(pack => pack.pack_id === 'tinadec.graph.seed-pack').active_version, '3.0.1');
    assert.ok(packs.find(pack => pack.pack_id === 'tinadec.tests.bootstrap-pack'));
    const after = await (await fetch(gatewayUrl + '/api/v1/workspace-defaults', { headers })).json();
    assert.deepEqual(after, before);
    await writeFile(join(evidence, 'desktop-core-restart.json'), JSON.stringify({ real_core_process_restarted: true, isolated: true, read_status: response.status, packs: packs.map(pack => ({ pack_id: pack.pack_id, active_version: pack.active_version })), workspace_defaults_unchanged: true }, null, 2) + '\n');
  }
  if (resultCode !== 0) {
    await writeFile(join(scratch, 'core.log'), core.output()); await writeFile(join(scratch, 'gateway.log'), gateway.output());
    console.error(JSON.stringify({ failed: true, exit_code: resultCode, owned_diagnostics: scratch }));
  }
} catch (error) { resultCode = 1; console.error(error.stack); }
finally {
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
