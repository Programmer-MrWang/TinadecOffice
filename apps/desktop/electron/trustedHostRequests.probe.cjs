// Manual lightweight Electron integration check; uses temporary fixture services, never user data.
const { app, BrowserWindow, protocol } = require('electron');
const http = require('node:http');
const assert = require('node:assert/strict');
const { randomBytes, createHmac } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTrustedHostRequests } = require('./trustedHostRequests.cjs');
const { APP_SCHEME_PRIVILEGES } = require('./appBundle.cjs');
const { verifyManagedHost } = require('./hostIdentity.cjs');
const scratch = mkdtempSync(path.join(os.tmpdir(), 'tinadec-host-request-probe-'));
app.setPath('userData', scratch);
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: APP_SCHEME_PRIVILEGES }]);
const token = randomBytes(32).toString('base64url');
let verified = false;
const controller = createTrustedHostRequests({ token, isManagedHost: () => verified });
const services = [];
const received = [];
let previewPort;
function listen(port, handler, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler); services.push(server);
    server.once('error', reject); server.listen(port, host, () => resolve(server.address().port));
  });
}
function fixture(request, response, role) {
  const authorized = request.headers['x-tinadec-host-control'] === token;
  response.setHeader('access-control-allow-origin', request.headers.origin || '*');
  response.setHeader('access-control-allow-headers', request.headers['access-control-request-headers'] || '*');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  if (request.url.startsWith('/api/v1/host-challenge?')) {
    assert.equal(Boolean(request.headers['x-tinadec-host-control']), false);
    const nonce = new URL(request.url, 'http://fixture').searchParams.get('nonce');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ role, nonce, proof: createHmac('sha256', token).update(`tinadec-host-v1\0${role}\0${nonce}`).digest('hex') })); return;
  }
  received.push({ path: request.url, authorized });
  if (request.url === '/api/v1/redirect') { response.writeHead(302, { location: `http://127.0.0.1:${previewPort}/redirect-target` }); response.end(); return; }
  if (request.url === '/api/v1/stream') {
    response.writeHead(authorized ? 200 : 403, { 'content-type': 'text/event-stream' });
    response.end(`data: ${JSON.stringify({ authorized })}\n\n`); return;
  }
  response.writeHead(authorized ? 200 : 403, { 'content-type': 'application/json' }); response.end(JSON.stringify({ authorized }));
}
async function fetchStatus(contents, url = 'http://127.0.0.1:48730/api/v1/probe') {
  return contents.executeJavaScript(`fetch(${JSON.stringify(url)}).then(r => r.status)`);
}
let foreignHeader = false;
const timeout = setTimeout(() => { console.error('Trusted host request probe timed out'); app.exit(1); }, 25_000);
app.whenReady().then(async () => {
  try {
    previewPort = await listen(0, (request, response) => {
      foreignHeader ||= Boolean(request.headers['x-tinadec-host-control']);
      response.setHeader('access-control-allow-origin', '*');
      response.setHeader('content-type', request.url === '/redirect-target' ? 'application/json' : 'text/html');
      if (request.url === '/redirect-target') response.end('{"redirected":true}');
      else response.end(`<script>if(parent!==window)fetch('http://127.0.0.1:48730/api/v1/iframe').then(r=>parent.postMessage({probeStatus:r.status},'*'))</script>`);
    });
    await listen(48730, (request, response) => fixture(request, response, 'gateway'));
    await listen(48731, (request, response) => fixture(request, response, 'core'));
    // A localhost/IPv6 alias is a distinct, unverified endpoint even on the same port.
    await listen(48730, (request, response) => fixture(request, response, 'gateway'), '::1');
    protocol.handle('app', () => new Response('<!doctype html><html><body>Trusted host fixture</body></html>', { headers: { 'content-type': 'text/html' } }));
    const trusted = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    controller.registerWindow(trusted);
    await trusted.loadURL('app://bundle/index.html');
    assert.equal(await fetchStatus(trusted.webContents), 403);
    verified = await verifyManagedHost(token);
    assert.equal(await fetchStatus(trusted.webContents), 200);
    assert.equal(await fetchStatus(trusted.webContents, 'http://127.0.0.1:48731/api/v1/probe'), 200);
    assert.equal(await fetchStatus(trusted.webContents, 'http://localhost:48730/api/v1/alias'), 403);
    assert.equal(await trusted.webContents.executeJavaScript("new Request('http://127.0.0.1:48730/api/v1/probe').headers.has('x-tinadec-host-control')"), false);
    const sse = await trusted.webContents.executeJavaScript("new Promise((resolve,reject)=>{const s=new EventSource('http://127.0.0.1:48730/api/v1/stream');s.onmessage=e=>{s.close();resolve(JSON.parse(e.data).authorized)};s.onerror=()=>{s.close();reject(new Error('SSE rejected'))}})");
    assert.equal(sse, true);
    const iframe = await trusted.webContents.executeJavaScript(`new Promise(resolve=>{window.addEventListener('message',function done(e){if(e.data?.probeStatus){window.removeEventListener('message',done);resolve(e.data.probeStatus)}});const f=document.createElement('iframe');f.src='http://127.0.0.1:${previewPort}/preview';document.body.appendChild(f)})`);
    assert.equal(iframe, 403);
    await trusted.webContents.executeJavaScript("fetch('http://127.0.0.1:48730/api/v1/redirect').then(r=>r.json())");
    assert.equal(foreignHeader, false);
    const unregistered = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await unregistered.loadURL('app://bundle/index.html');
    assert.equal(await fetchStatus(unregistered.webContents), 403);
    unregistered.destroy();
    for (const url of ['app://bundle/index.html?splash=0#/panel/fixture', 'app://bundle/index.html?splash=0#/debug-studio']) {
      const auxiliary = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      controller.registerWindow(auxiliary); await auxiliary.loadURL(url);
      assert.equal(await fetchStatus(auxiliary.webContents), 200); auxiliary.destroy();
    }
    await trusted.loadURL(`http://127.0.0.1:${previewPort}/remote`);
    assert.equal(await fetchStatus(trusted.webContents), 403);
    await trusted.loadURL('app://bundle/index.html');
    verified = false; assert.equal(await fetchStatus(trusted.webContents), 403);
    trusted.destroy();
    console.log(JSON.stringify({ passed: true, electron: process.versions.electron, trusted_core_gateway: true,
      sse: true, renderer_request_headers_private: true, iframe_rejected: true, unregistered_window_rejected: true,
      endpoint_hmac_verified: true, unverified_endpoint_unsigned: true, unverified_alias_unsigned: true, endpoint_revocation: true,
      navigation_revoked: true, panel_debug_routes: true, redirect_credential_removed: true, requests: received.length }));
    clearTimeout(timeout); app.exit(0);
  } catch (error) { console.error(error.stack); clearTimeout(timeout); app.exit(1); }
}).finally(() => {
  for (const server of services) server.close();
  try { rmSync(scratch, { recursive: true, force: true }); } catch { /* Chromium may still own its isolated cache. */ }
});
