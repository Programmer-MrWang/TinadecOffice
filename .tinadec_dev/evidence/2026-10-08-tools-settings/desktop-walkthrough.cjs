// Actual Electron main/preload, bundled or Vite renderer, Gateway and isolated current-source Core.
// This harness only controls the isolated window; no API or component mocks.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '../../..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-tools-settings-qa-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
const errors = [];
let main;
app.on('browser-window-created', (_, win) => {
  if (main) return;
  main = win;
  win.webContents.setBackgroundThrottling(false);
  win.show = () => {};
  win.webContents.openDevTools = () => {};
  win.webContents.on('console-message', event => {
    if (event.level === 'error') errors.push(event.message);
  });
});
require(path.join(root, 'apps/desktop/electron/main.cjs'));
let previousId = null;
let handling = false;
const reply = result => fs.writeFileSync(path.join(__dirname, 'desktop-response.json'), JSON.stringify(result, null, 2));
setInterval(async () => {
  if (handling || !main || main.isDestroyed()) return;
  const commandFile = path.join(__dirname, 'desktop-command.json');
  if (!fs.existsSync(commandFile)) return;
  let command;
  try { command = JSON.parse(fs.readFileSync(commandFile, 'utf8')); } catch { return; }
  if (command.id === previousId) return;
  previousId = command.id; handling = true;
  try {
    let result;
    if (command.action === 'snapshot') {
      const filename = path.basename(command.filename);
      fs.writeFileSync(path.join(__dirname, filename), (await main.webContents.capturePage()).toPNG());
      result = { filename, url: main.webContents.getURL(), bounds: main.getBounds() };
    } else if (command.action === 'resize') {
      main.setMinimumSize(640, 600); main.setContentSize(command.width, command.height);
      result = main.getContentBounds();
    } else if (command.action === 'type') {
      await main.webContents.executeJavaScript("document.querySelector('.monaco-editor .inputarea, .monaco-editor .native-edit-context').focus()");
      main.webContents.debugger.attach('1.3');
      await main.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
      main.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] });
      main.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] });
      await main.webContents.insertText(command.text);
      main.webContents.debugger.detach(); result = { inserted: command.text.length };
    } else if (command.action === 'quit') {
      reply({ id: command.id, errors, result: 'closed' }); app.exit(0); return;
    } else {
      result = await main.webContents.executeJavaScript(command.expression);
    }
    reply({ id: command.id, result, errors });
  } catch (error) { reply({ id: command.id, error: error.stack, errors }); }
  finally { handling = false; }
}, 100);
setTimeout(() => { console.error('Desktop QA deadline reached'); app.exit(1); }, 1200000);
