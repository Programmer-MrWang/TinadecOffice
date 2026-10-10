'use strict';
const electron = require('electron');
const { app, BrowserWindow } = electron;
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { createHmac, randomBytes } = require('node:crypto');
const repo = path.resolve(__dirname, '../../..');
const desktop = path.join(repo, 'apps/desktop/electron');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-host-readiness-'));
const folder = path.join(home, 'source'); fs.mkdirSync(folder);
process.env.TINADEC_HOME = home;
const token = randomBytes(32).toString('base64url');
process.env.TINADEC_HOST_CONTROL_TOKEN = token;
let mode = 'unavailable'; let proofCalls = 0; let dialogCalls = 0; let actualController; let win; let started = false;
const connection = require(path.join(desktop, 'hostConnection.cjs'));
const identity = require(path.join(desktop, 'hostIdentity.cjs'));
const services = require(path.join(desktop, 'serviceManager.cjs'));
const requests = require(path.join(desktop, 'trustedHostRequests.cjs'));
const fakeFetch = async url => {
  proofCalls++;
  if (mode === 'unavailable') throw new Error('fixture temporary outage');
  const request = new URL(url); const nonce = request.searchParams.get('nonce');
  const role = request.port === '48731' ? 'core' : 'gateway';
  return Response.json({ role, nonce, proof: createHmac('sha256', mode === 'rejected' ? 'different-fixture-key' : token)
    .update('tinadec-host-v1\0' + role + '\0' + nonce).digest('hex') });
};
function FixtureWindow(options) {
  win = new BrowserWindow(options); win.show = () => {}; win.webContents.openDevTools = () => {}; return win;
}
FixtureWindow.getAllWindows = BrowserWindow.getAllWindows;
FixtureWindow.fromId = BrowserWindow.fromId;
FixtureWindow.fromWebContents = BrowserWindow.fromWebContents;
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename === path.join(desktop, 'main.cjs')) {
    if (request === 'electron') return { ...electron, BrowserWindow: FixtureWindow, dialog: { ...electron.dialog,
      showOpenDialog: async () => { dialogCalls++; return { canceled: false, filePaths: [folder] }; } } };
    if (request === './serviceManager.cjs') return { ...services,
      ensureLocalServices: async () => ({ started: false, ownsCore: false, ownsGateway: false }), stopLocalServices: async () => {} };
    if (request === './hostIdentity.cjs') return { ...identity,
      verifyManagedHost: (key, options) => identity.verifyManagedHost(key, { ...options, fetchImpl: fakeFetch }) };
    if (request === './hostConnection.cjs') return { ...connection, createHostConnection: options =>
      connection.createHostConnection({ ...options, retryDelaysMs: [3_000, 4_000], watchIntervalMs: 1_000 }) };
    if (request === './trustedHostRequests.cjs') return { ...requests,
      initializeTrustedHostRequests: options => { actualController = requests.createTrustedHostRequests(options); },
      registerTrustedHostWindow: window => actualController.registerWindow(window),
      isTrustedHostSender: event => { const result = actualController?.isTrustedSender(event) ?? false; console.log('fixture-trust', { result, sender: event.sender.id, frameProcess: event.senderFrame?.processId, mainProcess: event.sender.mainFrame?.processId, frameRouting: event.senderFrame?.routingId, mainRouting: event.sender.mainFrame?.routingId, frameUrl: event.senderFrame?.url, mainUrl: event.sender.getURL(), document: actualController.isTrustedDocumentSender(event) }); return result; },
      isTrustedHostDocumentSender: event => actualController?.isTrustedDocumentSender(event) ?? false,
    };
  }
  return load.call(this, request, parent, isMain);
};
const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'text/html');
  if (request.url.startsWith('/frame')) response.end('<script>window.frameHasBridge=Boolean(window.tinadec)</script>');
  else response.end('<!doctype html><html><body style="background:#20232a;color:#f2f2f2;font-family:system-ui;padding:40px"><h1>TinadecOffice host recovery acceptance</h1><p id="state">Waiting for main/preload</p></body></html>');
});
const execute = code => win.webContents.executeJavaScript(code);
const status = () => execute('window.tinadec.getHostStatus()');
async function waitState(expected) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) { const value = await status(); if (value.state === expected) return value; await new Promise(r => setTimeout(r, 50)); }
  throw new Error('Timed out waiting for safe host state ' + expected);
}
function signed() {
  let result;
  actualController.beforeSendHeaders({ url: 'http://127.0.0.1:48730/api/v1/projects', resourceType: 'xhr',
    webContentsId: win.webContents.id, frame: win.webContents.mainFrame,
    requestHeaders: { accept: 'application/json' } }, value => { result = value.requestHeaders; });
  return result['X-Tinadec-Host-Control'] === token;
}
async function run() {
  await waitState('unavailable'); assert.equal(signed(), false);
  assert.equal(await execute('window.tinadec.selectWorkspaceFolders().then(()=>true,()=>false)'), false);
  await execute('window.hostEvents=[];window.disposeHostListener=window.tinadec.onHostStatusChanged(x=>window.hostEvents.push(x));null');
  mode = 'ready'; await waitState('ready'); assert.equal(signed(), true);
  console.log('fixture-ready', { mainId: require(path.join(desktop,'panelWindow.cjs')).getMainWindow()?.webContents.id, winId: win.webContents.id, trusted: actualController.isTrustedSender({ sender: win.webContents, senderFrame: win.webContents.mainFrame }) });
  assert.deepEqual(await execute('window.tinadec.selectWorkspaceFolders()'), [folder]); assert.equal(dialogCalls, 1);
  assert.equal(await execute("JSON.stringify(window.tinadec).includes('serviceToken')"), false);
  mode = 'unavailable'; await waitState('unavailable'); assert.equal(signed(), false);
  mode = 'ready'; await waitState('ready'); assert.equal(signed(), true);
  mode = 'rejected'; await waitState('rejected'); assert.equal(signed(), false);
  const blockedCalls = proofCalls; await new Promise(r => setTimeout(r, 1_300)); assert.equal(proofCalls, blockedCalls);
  mode = 'ready';
  const retried = await execute('Promise.all([window.tinadec.retryHostConnection(),window.tinadec.retryHostConnection()])');
  assert.equal(retried.every(x=>x.state === 'ready'), true); assert.equal(signed(), true);
  const frame = await execute("new Promise(resolve=>{const f=document.createElement('iframe');f.src='/frame';f.onload=()=>resolve({bridge:!!f.contentWindow.tinadec});document.body.appendChild(f)})");
  assert.equal(frame.bridge, false);
  const child = win.webContents.mainFrame.frames.find(x=>x.parent);
  assert.equal(actualController.isTrustedDocumentSender({sender:win.webContents,senderFrame:child}), false);
  assert.equal(actualController.isTrustedSender({sender:win.webContents,senderFrame:child}), false);
  const changed = await execute('window.hostEvents');
  assert.ok(changed.some(x=>x.state === 'unavailable') && changed.some(x=>x.state === 'ready') && changed.some(x=>x.state === 'rejected'));
  await execute("document.getElementById('state').textContent='Passed: first outage, automatic recovery, revoke and recover, manual retry, folder IPC, private headers and iframe rejection.'");
  fs.writeFileSync(path.join(__dirname, 'host-ready.png'), (await win.webContents.capturePage()).toPNG());
  const evidence = {passed:true,electron:process.versions.electron,isolated_user_root:true,actual_main:true,actual_preload:true,
    actual_host_state_machine:true,actual_identity_hmac:true,mocked_identity_transport:true,mocked_service_lifecycle:true,
    mocked_native_folder_dialog:true,no_user_ports_bound:true,initial_outage_recovered:true,periodic_outage_revoked_and_recovered:true,
    mismatched_identity_rejected:true,manual_retry_restored:true,folder_selection_after_ready:true,
    private_header_authorization_checked_with_real_frame:true,iframe_status_retry_denied:true,preload_status_subscription:true,
    proof_calls:proofCalls,events:changed.map(x=>({state:x.state,code:x.error?.code}))};
  fs.writeFileSync(path.join(__dirname, 'host-readiness.json'), JSON.stringify(evidence,null,2)); console.log(JSON.stringify(evidence));
}
server.listen(0, '127.0.0.1', () => {
  process.env.VITE_DEV_SERVER_URL = 'http://127.0.0.1:' + server.address().port + '/';
  app.on('browser-window-created', () => {
    if (started) return; started = true;
    setTimeout(async () => { try { await run(); server.close(); app.exit(0); } catch(error) { console.error(error.stack); server.close(); app.exit(1); } }, 750);
  });
  require(path.join(desktop, 'main.cjs'));
});
setTimeout(()=>{console.error('Isolated host acceptance timed out');app.exit(1)},30_000).unref();
