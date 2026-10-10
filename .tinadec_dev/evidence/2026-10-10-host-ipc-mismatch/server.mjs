import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const repo = resolve(import.meta.dirname, '../../..');
const evidence = import.meta.dirname;
const owned = join(repo, '.tinadec_dev/tmp/host-ipc-mismatch/runtime-' + randomBytes(6).toString('hex'));
await mkdir(owned, { recursive: true });
const { build } = await import(pathToFileURL(join(repo, 'node_modules/vite/dist/node/index.js')).href);
const { default: vue } = await import(pathToFileURL(join(repo, 'node_modules/@vitejs/plugin-vue/dist/index.mjs')).href);
for (const development of [false, true]) {
  await build({
    root: join(repo, 'apps/desktop'), configFile: false, mode: 'production', plugins: [vue()],
    resolve: { alias: { '@/components/ui': join(evidence, 'ui-barrel.mjs'), '@': join(repo, 'apps/desktop/src'), vue: join(repo, 'apps/desktop/src/lib/vue-shim.ts') }, dedupe: ['vue', '@vue/reactivity', '@vue/runtime-dom', '@vue/runtime-vapor'] },
    define: { 'import.meta.env.DEV': String(development), 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false', __VUE_I18N_FULL_INSTALL__: 'true', __VUE_I18N_LEGACY_API__: 'false', __INTLIFY_PROD_DEVTOOLS__: 'false' },
    build: { outDir: join(owned, development ? 'development' : 'production'), emptyOutDir: true, minify: false, target: 'chrome140',
      lib: { entry: join(evidence, 'renderer.mjs'), formats: ['es'], fileName: () => 'renderer.js' } },
    logLevel: 'warn',
  });
}
const assets = join(repo, 'apps/desktop/dist/assets');
const css = (await Promise.all((await readdir(assets)).filter(name => name.startsWith('index-') && name.endsWith('.css')).map(async name => ({ name, length: (await stat(join(assets, name))).size })))).sort((a, b) => b.length - a.length)[0].name;
const baseCss = await readFile(join(assets, css), 'utf8');
const fixtureCssName = (await readdir(join(owned, 'production'))).find(name => name.endsWith('.css'));
const fixtureCss = fixtureCssName ? await readFile(join(owned, 'production', fixtureCssName), 'utf8') : '';
const staticServer = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://fixture.invalid');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const script = url.searchParams.get('mode') === 'development' ? 'development.js' : 'production.js';
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>Host IPC mismatch</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script type="module" src="/' + script + '"></script></body></html>');
    } else if (url.pathname === '/production.js' || url.pathname === '/development.js') {
      response.setHeader('content-type', 'text/javascript'); response.end(await readFile(join(owned, url.pathname.startsWith('/development') ? 'development' : 'production', 'renderer.js')));
    } else if (url.pathname === '/fixture.css') {
      response.setHeader('content-type', 'text/css'); response.end(baseCss + '\n' + fixtureCss);
    } else if (/^\/[a-zA-Z0-9_-]+\.woff2$/.test(url.pathname)) {
      response.setHeader('content-type', 'font/woff2'); response.end(await readFile(join(assets, basename(url.pathname))));
    } else { response.statusCode = 404; response.end(); }
  } catch { response.statusCode = 500; response.end(); }
});
await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
const uiUrl = 'http://127.0.0.1:' + staticServer.address().port;
const env = { ...process.env, TINADEC_HOME: join(owned, 'user'), TINADEC_HOST_CONTROL_TOKEN: randomBytes(32).toString('base64url'), TINADEC_GATEWAY_URL: uiUrl, VITE_DEV_SERVER_URL: uiUrl, IPC_FIXTURE_ROOT: owned, IPC_FIXTURE_URL: uiUrl };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(join(repo, 'node_modules/electron/dist/electron.exe'), [join(evidence, 'electron.cjs')], { cwd: repo, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', chunk => output += chunk);
child.stderr.on('data', chunk => output += chunk);
try {
  const code = await new Promise(resolve => child.once('exit', resolve));
  assert.equal(code, 0, output);
  const result = JSON.parse(await readFile(join(evidence, 'electron-acceptance.json'), 'utf8'));
  assert.equal(result.accepted, true);
  console.log('Bounded real Electron IPC mismatch/readiness contract passed.');
} catch (error) {
  await writeFile(join(evidence, 'fixture-failure.log'), error.stack + '\n' + output);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise(resolve => staticServer.close(resolve));
}
