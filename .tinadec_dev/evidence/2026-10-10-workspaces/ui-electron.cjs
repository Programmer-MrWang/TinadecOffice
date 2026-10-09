const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { join } = require('node:path');
const { writeFileSync, existsSync } = require('node:fs');
const assert = require('node:assert/strict');
const repo = join(__dirname, '../../..'), owned = process.env.WORKSPACE_UI_ROOT, evidence = process.env.WORKSPACE_UI_EVIDENCE, native = process.env.WORKSPACE_NATIVE_PICKER === '1';
app.setPath('userData', join(owned, 'electron-state'));
const { createTrustedHostRequests } = require(join(repo, 'apps/desktop/electron/trustedHostRequests.cjs'));
const { selectWorkspaceFolders } = require(join(repo, 'apps/desktop/electron/workspaceFolders.cjs'));
let window; let picks = 0; const events = [];
const trusted = createTrustedHostRequests({ token: process.env.TINADEC_HOST_CONTROL_TOKEN, devServerUrl: process.env.WORKSPACE_UI_URL });
ipcMain.handle('tinadec:app-config', () => ({ debug_studio_enabled: false }));
ipcMain.handle('tinadec:select-workspace-folders', event => selectWorkspaceFolders(event, { mainWindow: window, trusted: trusted.isTrustedSender, dialog: native ? dialog : { async showOpenDialog() { picks++; return { canceled: false, filePaths: picks === 1 ? [join(owned, 'first'), join(owned, 'second')] : [join(owned, 'first')] }; } } }));
async function wait(expression) { for (let i = 0; i < (native ? 5000 : 720); i++) { if (await window.webContents.executeJavaScript(expression)) return; await new Promise(resolve => setTimeout(resolve, 250)); } throw new Error('UI timeout: ' + expression); }
async function js(expression) { return window.webContents.executeJavaScript(expression); }
async function click(selector) { await js(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function capture(name) {
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await new Promise(resolve => setTimeout(resolve, 500));
  writeFileSync(join(evidence, (process.env.WORKSPACE_UI_SCREENSHOT_PREFIX || '') + name + '.png'), (await window.webContents.capturePage()).toPNG());
}
app.whenReady().then(async () => {
  window = new BrowserWindow({ show: native, width: 1400, height: 920, title: 'TinadecOffice · 工作区隔离验收', webPreferences: { preload: join(repo, 'apps/desktop/electron/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } }); trusted.registerWindow(window);
  try {
    await window.loadURL(process.env.WORKSPACE_UI_URL); if (native) { window.show(); window.focus(); } else window.showInactive(); await wait('window.__workspaceFixture?.c.projects.value.length === 0');
    await click('.workspace-section-add'); await wait('document.querySelector(".workspace-add-folders") !== null');
    await click('.workspace-add-folders'); if (native) console.log('NATIVE_PICKER_WAITING: select first and second fixture folders in ' + owned);
    await wait('document.querySelectorAll(".workspace-source-list li").length === 2');
    if (native) await js('const rows=Array.from(document.querySelectorAll(".workspace-source-list li"));const first=rows.find(row=>row.querySelector("strong").textContent==="first");const setPrimary=Array.from(first.querySelectorAll("button")).find(button=>button.textContent.trim()==="设为主要");if(setPrimary)setPrimary.click();');
    assert.equal(existsSync(join(owned, 'first/.tinadec')), false); assert.equal(existsSync(join(owned, 'second/.tinadec')), false); events.push({ step: 'folder_selection', no_storage_initialized: true, native_picker: native });
    await capture('workspace-create'); await click('.workspace-dialog button[type=submit]');
    await wait('window.__workspaceFixture.c.projects.value.length === 1 && !window.__workspaceFixture.c.workspaceEditor.value.open');
    assert.equal(await js('window.__workspaceFixture.c.selectedSessionId.value'), null); assert.equal(existsSync(join(owned, 'first/.tinadec/project.toml')), true); assert.equal(existsSync(join(owned, 'second/.tinadec')), false);
    events.push({ step: 'created', new_conversation_context: true, secondary_uninitialized: true });
    await new Promise(resolve => setTimeout(resolve, 600)); await js('window.__workspaceFixture.seedConversationRows()');
    await wait('document.querySelectorAll(".session-row").length === 6'); await capture('workspace-recent'); await click('.workspace-show-more'); await wait('document.querySelectorAll(".session-row").length === 9'); await capture('workspace-all'); await click('.workspace-show-more');
    const selected = await js('window.__workspaceFixture.c.selectedStorageId ? window.__workspaceFixture.c.selectedStorageId() : window.__workspaceFixture.selectedStorage.value');
    await click('.project-group:not(.free-conversation-group) .project-row-main'); await wait('document.querySelector(".project-group:not(.free-conversation-group) .project-row-main").getAttribute("aria-expanded") === "false"');
    assert.equal(await js('window.__workspaceFixture.selectedStorage.value'), selected); assert.equal(await js('window.__workspaceFixture.c.selectedSessionId.value'), 'ui-row-0');
    await click('.project-group:not(.free-conversation-group) button[title="新聊天"]'); await wait('window.__workspaceFixture.c.selectedSessionId.value === null');
    assert.equal(await js('document.querySelector(".project-group:not(.free-conversation-group) .project-row-main").getAttribute("aria-expanded")'), 'false'); events.push({ step: 'fold_and_plus', scope_unchanged: true, plus_does_not_fold: true, recent_and_selected_old: true });
    await js('window.__workspaceFixture.c.editWorkspace(window.__workspaceFixture.c.projects.value[0].storage_id + "::" + window.__workspaceFixture.c.projects.value[0].id)');
    await wait('document.querySelectorAll(".workspace-source-list li").length === 2');
    await js('const input=document.querySelector(".workspace-dialog input");input.value="Edited workspace";input.dispatchEvent(new Event("input",{bubbles:true}));');
    await js('Array.from(document.querySelectorAll(".workspace-dialog button")).find(button=>button.textContent.trim()==="设为主要").click()'); await capture('workspace-edit'); await click('.workspace-dialog button[type=submit]');
    await wait('!window.__workspaceFixture.c.workspaceEditor.value.open'); assert.equal(await js('window.__workspaceFixture.c.currentProject.value.path'), join(owned, 'second')); assert.equal(existsSync(join(owned, 'second/.tinadec')), false); events.push({ step: 'edited_primary', storage_unchanged: true, primary_changed: true });
    await capture('workspace-sidebar'); await window.webContents.reload(); await wait('window.__workspaceFixture?.c.projects.value.length === 1');
    assert.equal(await js('window.__workspaceFixture.c.projects.value[0].name'), 'Edited workspace'); assert.equal(await js('document.querySelector(".project-group:not(.free-conversation-group) .project-row-main").getAttribute("aria-expanded")'), 'false'); events.push({ step: 'reload', manifest_and_sidebar_state_restored: true });
    await click('.workspace-section-add'); await wait('document.querySelector(".workspace-add-folders") !== null'); await click('.workspace-add-folders'); if (native) console.log('NATIVE_PICKER_WAITING: select first fixture folder again.');
    await wait('document.querySelector(".workspace-existing") !== null'); assert.equal(await js('document.querySelector(".workspace-dialog button[type=submit]").textContent.trim()'), '打开已有工作区'); await capture('workspace-existing');
    await click('.workspace-dialog button[type=submit]'); await wait('!window.__workspaceFixture.c.workspaceEditor.value.open'); assert.equal(await js('window.__workspaceFixture.c.projects.value.length'), 1); events.push({ step: 'explicit_existing_open', no_overwrite: true });
    writeFileSync(join(evidence, native ? 'desktop-native.json' : 'desktop-ui.json'), JSON.stringify({ accepted: true, electron: process.versions.electron, platform: process.platform, native_picker: native, production_preload_and_picker_handler: true, real_desktop_components: true, real_core_gateway: true, list_rows: 'representative_ui_fixture', events }, null, 2)); console.log(JSON.stringify({ accepted: true, events })); window.destroy(); app.exit(0);
  } catch (error) { console.error(error.stack); await capture('desktop-ui-failure').catch(()=>{}); window.destroy(); app.exit(1); }
});
