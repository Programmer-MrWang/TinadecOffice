import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer as createViteServer, loadConfigFromFile } from '../../../node_modules/vite/dist/node/index.js';
const repo = resolve(import.meta.dirname, '../../..'), evidence = import.meta.dirname;
const owned = join(repo, '.tinadec_dev/tmp/workspace-ui-' + randomBytes(5).toString('hex'));
for (const folder of ['user', 'first', 'second', 'default']) await mkdir(join(owned, folder), { recursive: true });
const token = randomBytes(32).toString('base64url'), children = [], requests = []; let vite;
async function freePort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
const coreUrl = 'http://127.0.0.1:' + await freePort(), gatewayUrl = 'http://127.0.0.1:' + await freePort(), uiUrl = 'http://127.0.0.1:' + await freePort();
function start(command, args, cwd, env) { const childEnv = { ...process.env, ...env }; delete childEnv.ELECTRON_RUN_AS_NODE; const nativeElectron = process.env.WORKSPACE_NATIVE_PICKER === '1' && command.endsWith('electron.exe'); const child = spawn(command, args, { cwd, windowsHide: !nativeElectron, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child); let output = ''; child.stdout.on('data', text => { output += text; if (nativeElectron) process.stdout.write(text); }); child.stderr.on('data', text => output += text); child.on('error', error => output += error.stack); return { child, output: () => output }; }
async function waitService(url, process) { for (let i = 0; i < 600; i++) { if (process.child.exitCode !== null) throw new Error(process.output()); try { if ((await fetch(url + '/api/v1/health')).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 300)); } throw new Error('Service unavailable: ' + process.output()); }
let core, gateway, electron;
try {
  const env = { TINADEC_HOST_CONTROL_TOKEN: token, TINADEC_HOME: join(owned, 'user'), ASPNETCORE_ENVIRONMENT: 'Development', DOTNET_gcServer: '0' };
  core = start('dotnet', [join(repo, '.tinadec_dev/tmp/workspace-build/bin/TinadecCore.Api/debug/TinadecCore.Api.dll')], join(repo, 'TinadecCore/Api'), { ...env, ASPNETCORE_URLS: coreUrl, TinadecStorage__Enabled: 'true', TinadecStorage__UserRoot: join(owned, 'user'), TinadecTools__DefaultWorkspaceRoot: join(owned, 'default') }); await waitService(coreUrl, core);
  gateway = start('bun', ['src/index.ts'], join(repo, 'TinadecGateway'), { ...env, TINADEC_CORE_URL: coreUrl, TINADEC_GATEWAY_PORT: new URL(gatewayUrl).port, TINADEC_GATEWAY_CORS_ORIGINS: uiUrl }); await waitService(gatewayUrl, gateway);
  for (const [url, role] of [[coreUrl, 'core'], [gatewayUrl, 'gateway']]) { const nonce = randomBytes(32).toString('base64url'); const proof = await (await fetch(url + '/api/v1/host-challenge?nonce=' + nonce)).json(); if (proof.proof !== createHmac('sha256', token).update(`tinadec-host-v1\0${role}\0${nonce}`).digest('hex')) throw new Error('Owned service proof failed.'); }
  const config = await loadConfigFromFile({ command: 'serve', mode: 'development' }, join(repo, 'apps/desktop/vite.config.ts'));
  vite = await createViteServer({ ...config.config, root: join(repo, 'apps/desktop'), configFile: false, cacheDir: join(owned, 'vite-cache'),
    optimizeDeps: { entries: [], noDiscovery: true, include: ['pinia', 'vue-router', 'vue-i18n', '@vue/runtime-dom', '@vue/runtime-vapor', '@lucide/vue', 'reka-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'] },
    plugins: [...config.config.plugins.flat(Infinity).filter(plugin => !plugin?.name?.includes('mcp')), {
      name: 'owned-workspace-fixture', configureServer(server) { server.middlewares.use(async (request, response, next) => {
        if (request.url === '/' || request.url === '/index.html') { response.setHeader('content-type', 'text/html'); response.end(`<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>TinadecOffice · 工作区隔离验收</title></head><body><div id="app"></div><script type="module" src="/@fs/${join(evidence, 'ui-renderer.mjs').replaceAll('\\', '/')}"></script></body></html>`); return; }
        if (!request.url?.startsWith('/api/v1/')) { next(); return; }
        try {
          const chunks = []; for await (const chunk of request) chunks.push(chunk);
          const headers = new Headers({ 'x-tinadec-host-control': token, 'x-tinadec-storage-id': request.headers['x-tinadec-storage-id'] || 'user' });
          for (const key of ['content-type', 'if-match']) if (request.headers[key]) headers.set(key, request.headers[key]);
          const upstream = await fetch(gatewayUrl + request.url, { method: request.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}), redirect: 'manual' }); const bytes = Buffer.from(await upstream.arrayBuffer());
          requests.push({ method: request.method, path: request.url, status: upstream.status });
          response.statusCode = upstream.status; for (const key of ['content-type', 'etag']) if (upstream.headers.has(key)) response.setHeader(key, upstream.headers.get(key)); response.end(bytes);
        } catch (error) { response.statusCode = 500; response.end(JSON.stringify({ message: error.message })); }
      }); },
    }], server: { host: '127.0.0.1', port: Number(new URL(uiUrl).port), strictPort: true, fs: { allow: [repo] } },
  }); await vite.listen();
  await writeFile(join(evidence, 'fixture-location.json'), JSON.stringify({ owned_root: owned, ui_url: uiUrl, native_picker: process.env.WORKSPACE_NATIVE_PICKER === '1' }, null, 2));
  electron = start(join(repo, 'node_modules/electron/dist/electron.exe'), [join(evidence, 'ui-electron.cjs')], repo, { ...env, WORKSPACE_UI_URL: uiUrl, WORKSPACE_UI_ROOT: owned, WORKSPACE_UI_EVIDENCE: evidence, TINADEC_RESOLVED_GATEWAY_URL: uiUrl });
  const code = await new Promise(resolve => electron.child.on('exit', resolve)); if (code !== 0) throw new Error(electron.output());
  const opens = requests.filter(request => request.method === 'POST' && request.path === '/api/v1/storage/scopes/open');
  if (opens.length !== 2 || !opens.every(request => request.status === 200)) throw new Error('Expected exactly one creation and one explicit existing open.');
  if (requests.filter(request => request.method === 'PUT' && request.path.endsWith('/workspace')).length !== 1) throw new Error('Workspace edit submit was duplicated.');
  const manifest = await readFile(join(owned, 'first/.tinadec/project.toml'), 'utf8'); if (!manifest.includes('Edited workspace')) throw new Error('Real manifest did not retain edited name.');
  await writeFile(join(evidence, process.env.WORKSPACE_NATIVE_PICKER === '1' ? 'desktop-native-http.json' : 'desktop-http.json'), JSON.stringify({ accepted: true, native_picker: process.env.WORKSPACE_NATIVE_PICKER === '1', owned_root: owned, requests, manifest }, null, 2)); console.log(electron.output());
} catch (error) { await writeFile(join(owned, 'failure.log'), [error.stack, core?.output(), gateway?.output(), electron?.output()].join('\n')); console.error(error.message); process.exitCode = 1; }
finally { await vite?.close(); for (const child of children) child.kill(); }
