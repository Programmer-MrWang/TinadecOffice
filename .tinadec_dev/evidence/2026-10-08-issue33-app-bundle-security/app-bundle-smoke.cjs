/**
 * App-bundle / local-media smoke probe (evidence for the #33 fix).
 *
 * Run from the repo root, after `apps/desktop` has a built `dist/`:
 *
 *   env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe \
 *     --disable-gpu --no-sandbox --disable-software-rasterizer \
 *     .tinadec_dev/evidence/2026-10-08-issue33-app-bundle-security/app-bundle-smoke.cjs
 *
 * `--disable-gpu` is only needed in a headless/GPU-less environment; ELECTRON_RUN_AS_NODE must
 * be unset or `require('electron')` resolves to a path string instead of the API.
 *
 * It answers four questions against a real Electron:
 *  1. does the packaged renderer load over `app://bundle`, with hashed assets resolving?
 *  2. is the contextBridge still there now that webSecurity is back at its default?
 *  3. can a page from another origin reach that bridge (the first hop of #33's chain)?
 *  4. does a `file://` subresource now fail, and does `tinadec-media://` serve the same file?
 */
const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const DESKTOP = process.env.TINADEC_DESKTOP_DIR
  || path.resolve(__dirname, '..', '..', '..', 'apps', 'desktop');

const {
  APP_SCHEME_PRIVILEGES,
  appBundleUrl,
  registerAppBundleProtocol,
} = require(path.join(DESKTOP, 'electron', 'appBundle.cjs'));
const {
  MEDIA_SCHEME_PRIVILEGES,
  mediaUrlFor,
  registerLocalMediaProtocol,
} = require(path.join(DESKTOP, 'electron', 'localMedia.cjs'));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: APP_SCHEME_PRIVILEGES },
  { scheme: 'tinadec-media', privileges: MEDIA_SCHEME_PRIVILEGES },
]);

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const pngPath = path.join(os.tmpdir(), 'tinadec-smoke-bg.png');
fs.writeFileSync(pngPath, PNG);

/** Cross-origin page that reports whether it can see the host window's contextBridge. */
const PROBE_HTML = `<!doctype html><html><body><script>
  let reach;
  try {
    reach = (window.parent && window.parent.tinadec) ? 'BRIDGE_REACHABLE' : 'parent-readable-no-bridge';
  } catch (error) {
    reach = 'BLOCKED:' + error.name;
  }
  fetch('/probe-result?value=' + encodeURIComponent(reach));
</script></body></html>`;

app.whenReady().then(async () => {
  registerAppBundleProtocol({ protocol, distDir: path.join(DESKTOP, 'dist') });
  registerLocalMediaProtocol({ protocol });

  let iframeVerdict = 'no-report';
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/probe-result')) {
      iframeVerdict = new URL(req.url, 'http://127.0.0.1').searchParams.get('value');
      res.writeHead(200); res.end('ok'); return;
    }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(PROBE_HTML);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(DESKTOP, 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => console.log('SMOKE_FAIL', code, desc, url));

  await win.loadURL(appBundleUrl());

  const page = await win.webContents.executeJavaScript(`(() => ({
    href: location.href,
    origin: location.origin,
    protocol: location.protocol,
    isSecureContext: window.isSecureContext,
    mounted: document.getElementById('app') ? 'app-mounted' : 'no-#app',
    entry: [...document.querySelectorAll('script[type=module]')].map(s => s.src),
    bridge: typeof window.tinadec,
    bridgeTerminal: typeof window.tinadec?.terminal?.getShells,
  }))()`);
  console.log('SMOKE_PAGE', JSON.stringify(page));

  const mediaUrl = mediaUrlFor(pngPath);
  const images = await win.webContents.executeJavaScript(`(() => {
    const load = (src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve('loaded:' + img.naturalWidth + 'x' + img.naturalHeight);
      img.onerror = () => resolve('refused');
      img.src = src;
    });
    return Promise.all([load(${JSON.stringify(mediaUrl)}), load(${JSON.stringify('file:///' + pngPath.replace(/\\/g, '/'))})])
      .then(([media, file]) => ({ media, file }));
  })()`);
  console.log('SMOKE_MEDIA', JSON.stringify({ url: mediaUrl, images }));

  const traversal = await win.webContents.executeJavaScript(
    `fetch('app://bundle/../package.json').then(r => 'status-' + r.status).catch(() => 'rejected')`,
  );
  console.log('SMOKE_TRAVERSAL', traversal);

  // The attack chain from #33: a page from another origin that tries to reach this window's
  // contextBridge.
  await win.webContents.executeJavaScript(`new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.src = 'http://127.0.0.1:${port}/probe.html';
    frame.onload = () => setTimeout(resolve, 300);
    document.body.appendChild(frame);
  })`);
  console.log('SMOKE_CROSS_ORIGIN_BRIDGE', iframeVerdict);

  server.close();
  fs.unlinkSync(pngPath);
  app.exit(0);
});
