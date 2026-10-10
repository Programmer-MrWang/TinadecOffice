'use strict';
const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..');
const desktop = path.join(repo, 'apps/desktop/electron');
const evidence = __dirname;
const uiUrl = process.env.IPC_FIXTURE_URL;
const registrations = new Map();
const events = [];
const restart = { relaunch: 0, exit: [] };
let window;
const originalHandle = ipcMain.handle.bind(ipcMain);
const interceptedIpc = new Proxy(ipcMain, { get(target, key) {
  if (key === 'handle') return (channel, handler) => {
    if (channel === 'tinadec:host-status' || channel === 'tinadec:host-retry') { registrations.set(channel, handler); return; }
    return originalHandle(channel, handler);
  };
  const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
} });
const interceptedApp = new Proxy(app, { get(target, key) {
  if (key === 'relaunch') return () => { restart.relaunch++; };
  if (key === 'exit') return code => { restart.exit.push(code); };
  const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
} });
function FixtureWindow(options) {
  window = new BrowserWindow({ ...options, show: false, webPreferences: { ...options.webPreferences, backgroundThrottling: false, offscreen: true } });
  window.show = () => {};
  window.webContents.openDevTools = () => {};
  window.webContents.on('console-message', (_event, _level, message) => {
    events.push({ step: 'renderer_console', message: String(message) });
  });
  window.webContents.on('did-fail-load', (_event, code, message) => events.push({ step: 'renderer_load_failed', code, message }));
  return window;
}
FixtureWindow.getAllWindows = BrowserWindow.getAllWindows;
FixtureWindow.fromWebContents = BrowserWindow.fromWebContents;
FixtureWindow.fromId = BrowserWindow.fromId;
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename === path.join(desktop, 'main.cjs')) {
    if (request === 'electron') return { ...electron, app: interceptedApp, BrowserWindow: FixtureWindow, ipcMain: interceptedIpc };
    if (request === './serviceManager.cjs') return { ...load.call(this, request, parent, isMain), canonicalLocalGatewayUrl: value => value === uiUrl ? uiUrl : null, ensureLocalServices: async () => ({ started: false }), stopLocalServices: async () => {} };
    if (request === './hostIdentity.cjs') return { ...load.call(this, request, parent, isMain), verifyManagedHost: async () => true };
  }
  return load.call(this, request, parent, isMain);
};
async function js(code) { return window.webContents.executeJavaScript(code); }
async function wait(code) {
  for (let i = 0; i < 300; i++) { if (await js(code)) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw new Error('Fixture timeout: ' + code);
}
async function capture(name) {
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  fs.writeFileSync(path.join(evidence, name + '.png'), (await window.webContents.capturePage()).toPNG());
}
async function reload(url) {
  const loaded = new Promise(resolve => window.webContents.once('did-finish-load', resolve));
  if (url) await window.loadURL(url); else window.webContents.reload();
  await loaded;
  await wait('window.__ipcFixture?.ready===true');
}
const timeout = setTimeout(() => { console.error('IPC mismatch fixture 60-second budget exceeded.'); app.exit(1); }, 60000);
async function run() {
  try {
    await wait('window.__ipcFixture?.ready===true');
    assert.equal(registrations.size, 2);
    const raw = await js('window.tinadec.getHostStatus().then(value=>({value})).catch(error=>({message:error.message}))');
    assert.match(raw.message, /No handler registered for ['"]tinadec:host-status['"]/);
    events.push({ step: 'real_preload_missing_status_handler', message: raw.message });
    const status = await js('window.__ipcFixture.read()');
    const retry = await js('window.__ipcFixture.retry()');
    assert.equal(status.state, 'restart_required'); assert.equal(status.error.code, 'desktop_restart_required');
    assert.equal(retry.state, 'restart_required'); assert.equal(retry.error.code, 'desktop_restart_required');
    const blocked = await js('window.__ipcFixture.gate()');
    assert.deepEqual(blocked, { permitted: false, code: 'desktop_restart_required', status: 503 });
    const snapshot = await js('window.__ipcFixture.snapshot()');
    assert.equal(snapshot.can_access_backend, false); assert.equal(snapshot.health_reads, 0);
    assert.match(await js('document.querySelector(".host-availability-banner").innerText'), /桌面与界面版本不一致/);
    await capture('production-restart-required');
    events.push({ step: 'production_helper_and_banner', status, retry, blocked, snapshot });
    await js('document.querySelector(".host-availability-banner button").click()');
    await wait('document.querySelector(".host-availability-banner button")?.disabled===false');
    assert.equal(restart.relaunch, 1); assert.deepEqual(restart.exit, [0]);
    events.push({ step: 'existing_restart_ipc', relaunch_calls: restart.relaunch, exit_codes: restart.exit, actual_process_restart: false });
    await reload(uiUrl + '/?mode=development');
    assert.equal(await js('window.__ipcFixture.development'), true);
    const devText = await js('document.querySelector(".host-availability-banner").innerText');
    assert.match(devText, /npm run dev/);
    assert.equal(await js('document.querySelector(".host-availability-banner button")===null'), true);
    assert.equal(restart.relaunch, 1);
    await capture('development-restart-guidance');
    events.push({ step: 'development_guidance', manual_launcher_restart: true, no_restart_button: true });
    for (const [channel, handler] of registrations) originalHandle(channel, handler);
    const registered = await js('window.__ipcFixture.read()');
    assert.equal(registered.state, 'ready');
    await reload(uiUrl);
    const restored = await js('window.__ipcFixture.snapshot()');
    assert.equal(restored.host.state, 'ready'); assert.equal(restored.can_access_backend, true); assert.equal(restored.connection, 'connected');
    assert.equal(await js('document.querySelector(".host-availability-banner")===null'), true);
    events.push({ step: 'current_production_registration', ready: registered, after_renderer_reload: restored });
    fs.writeFileSync(path.join(evidence, 'electron-acceptance.json'), JSON.stringify({ accepted: true, electron: process.versions.electron, actual_main: true, actual_preload: true, actual_readiness_component: true, actual_bridge_helpers: true, actual_ipc: true, isolated_user_root: true, random_static_ui_port: true, missing_handlers: 'only host-status and host-retry registrations intercepted', service_identity_and_lifecycle: 'substituted; no Core/Gateway launched or queried', public_health: 'substituted after readiness only', process_restart: 'relaunch/exit intercepted and recorded', events }, null, 2));
    clearTimeout(timeout); app.exit(0);
  } catch (error) {
    console.error(error.stack);
    await capture('fixture-failure').catch(() => {});
    fs.writeFileSync(path.join(evidence, 'electron-failure.json'), JSON.stringify({ accepted: false, message: error.message, events }, null, 2));
    clearTimeout(timeout); app.exit(1);
  }
}
app.on('browser-window-created', (_event, created) => created.webContents.once('did-finish-load', () => { void run(); }));
require(path.join(desktop, 'main.cjs'));
