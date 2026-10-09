const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const evidence = process.env.GRAPHSEED_UI_EVIDENCE;
app.setPath('userData', mkdtempSync(join(tmpdir(), 'tinadec-graphseed-electron-')));
const events = [];
const timeout = setTimeout(() => { console.error('GraphSeed UI acceptance timeout'); app.exit(1); }, 90_000);
async function waitFor(contents, expression) {
  for (let attempt = 0; attempt < 160; attempt++) {
    if (await contents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('UI condition timeout: ' + expression);
}
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1400, height: 1000, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } });
  window.webContents.on('console-message', (_event, _level, message) => { if (/error|failed/i.test(message)) console.error(message); });
  window.webContents.on('did-finish-load', () => console.log('Owned fixture document loaded.'));
  window.webContents.on('did-fail-load', (_event, code, message) => console.error(`Owned fixture load failed: ${code} ${message}`));
  try {
    await window.loadURL(process.env.GRAPHSEED_UI_URL);
    await waitFor(window.webContents, "window.__graphseedFixture?.phase() === 'install'");
    await window.webContents.executeJavaScript("document.querySelector('[data-testid=graph-seed-pack-status] .agent-pack-status-actions button:not([disabled])').click()");
    await waitFor(window.webContents, "document.querySelector('dialog[open] .detail-dialog__primary') !== null");
    await window.webContents.executeJavaScript("document.querySelector('dialog[open] .detail-dialog__primary').click()");
    await waitFor(window.webContents, "window.__graphseedFixture.phase() === 'error'");
    const failed = await window.webContents.executeJavaScript('window.__graphseedFixture.notifications()');
    const error = failed.find(item => item.key === 'graph-seed-pack');
    assert.match(error.details, /configuration_unique/); assert.match(error.details, /agent_definitions/);
    events.push({ step: 'real_core_validation_failure', phase: 'error', diagnostics_visible: true });
    await window.webContents.executeJavaScript('window.__graphseedFixture.showError()');
    await waitFor(window.webContents, "document.querySelector('dialog[open] .detail-dialog__details')?.innerText.includes('configuration_unique')");
    await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await new Promise(resolve => setTimeout(resolve, 700));
    const visibleDetails = await window.webContents.executeJavaScript("document.querySelector('dialog[open] .detail-dialog__details').innerText");
    assert.match(visibleDetails, /configuration_unique/); assert.match(visibleDetails, /agent_definitions/); assert.match(visibleDetails, /trace_id:/);
    events[0].visible_details = visibleDetails;
    writeFileSync(join(evidence, 'desktop-diagnostic.png'), (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript("document.querySelector('dialog[open] .detail-dialog__close').click()");
    await window.webContents.executeJavaScript('Promise.all([window.__graphseedFixture.reconnect(), window.__graphseedFixture.reconnect()])');
    assert.equal(await window.webContents.executeJavaScript('window.__graphseedFixture.phase()'), 'error');
    events.push({ step: 'ordinary_reconnect', phase: 'error', no_auto_install: true });
    await window.webContents.executeJavaScript("document.querySelector('[data-testid=graph-seed-pack-status] .agent-pack-status-actions button:not([disabled])').click()");
    await waitFor(window.webContents, "document.querySelector('dialog[open] .detail-dialog__primary') !== null");
    await window.webContents.executeJavaScript("document.querySelector('dialog[open] .detail-dialog__primary').click()");
    await waitFor(window.webContents, "window.__graphseedFixture.phase() === 'up_to_date'");
    events.push({ step: 'explicit_retry', phase: 'up_to_date' });
    await window.webContents.reload();
    await waitFor(window.webContents, "window.__graphseedFixture?.phase() === 'up_to_date'");
    await waitFor(window.webContents, "document.querySelector('[data-testid=installed-agent-packs]')?.innerText.includes('GraphSeedPack')");
    await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await new Promise(resolve => setTimeout(resolve, 700));
    events.push({ step: 'inventory_content', text: await window.webContents.executeJavaScript("document.querySelector('[data-testid=installed-agent-packs]').innerText") });
    writeFileSync(join(evidence, 'desktop-installed.png'), (await window.webContents.capturePage()).toPNG());
    events.push({ step: 'renderer_reload', phase: 'up_to_date', inventory_restored: true });
    writeFileSync(join(evidence, 'desktop-ui-acceptance.json'), JSON.stringify({ electron: process.versions.electron, real_desktop_components: true, real_core_gateway: true, isolated_user_copy: true, events }, null, 2));
    console.log(JSON.stringify({ accepted: true, events: events.length, electron: process.versions.electron }));
    clearTimeout(timeout); window.destroy(); app.exit(0);
  } catch (error) {
    console.error(error.stack);
    try { writeFileSync(join(evidence, 'desktop-failure.png'), (await window.webContents.capturePage()).toPNG()); } catch {}
    clearTimeout(timeout); window.destroy(); app.exit(1);
  }
});
