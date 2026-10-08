// Renderer-only visual QA of the real ComposerCommandPanel SFC and material styles.
// Uses local, explicitly named catalog fixtures. No Gateway/Core, user state or model calls.
// Run with node_modules/electron/dist/electron.exe and ELECTRON_RUN_AS_NODE removed.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { build } = require('node:module').createRequire(require.resolve('vite'))('esbuild');
const { parse, compileScript, compileStyle } = require('@vue/compiler-sfc');
const root = path.resolve(__dirname, '../../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-command-panel-qa-'));
app.setPath('userData', path.join(temporary, 'profile'));
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
const deadline = setTimeout(() => { console.error('Command panel QA deadline exceeded'); app.exit(1); }, 120000);
const errors = [];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1000, height: 820, show: false, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const styles = [];
  const entry = `
    import { createApp, reactive, h, nextTick } from 'vue';
    import { createI18n } from 'vue-i18n';
    import Panel from '${path.join(root, 'apps/desktop/src/components/ComposerCommandPanel.vue').replaceAll('\\', '/')}';
    import zh from '${path.join(root, 'apps/desktop/src/locales/zh-CN.ts').replaceAll('\\', '/')}';
    const state = reactive({ open: false, spatial: false, initialPage: 'root', settingsSaving: false, settingsError: null, permission: 'default', modeVersionId: null, meetingModelOverride: null, spaceOptions: { plan_first: false, spec_enabled: false, multi_agent: false, workflow_mode_version_id: null, bulletin_board: false, worktree: false } });
    const host = { canStop: () => true, draft: () => 'QA fixture draft', setDraft: () => {}, send: () => {}, stopRun: () => {}, newSession: () => {}, navigate: () => {}, routeName: () => null };
    createApp({ render: () => h(Panel, { ...state, anchor: document.querySelector('.composer-box'), canAttach: true, commandHost: host, onClose: () => { state.open = false }, 'onUpdate:spaceOptions': value => { state.spaceOptions = value }, 'onUpdate:permission': value => { state.permission = value }, 'onUpdate:meetingModelOverride': value => { state.meetingModelOverride = value }, 'onUpdate:modeVersionId': value => { state.modeVersionId = value } }) }).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })).mount('#panel');
    window.qa = { state, async show(width, spatial, initialPage = 'root') { state.open = false; await nextTick(); document.querySelector('.composer-box').style.width = width + 'px'; state.spatial = spatial; state.initialPage = initialPage; state.open = true; await nextTick(); await new Promise(resolve => setTimeout(resolve, 220)); }, metrics() { const panel = document.querySelector('.composer-command-panel'), box = panel.getBoundingClientRect(), list = panel.querySelector('.command-panel-list'); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height, scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth, listHeight: list.clientHeight, listScrollHeight: list.scrollHeight, material: panel.dataset.panelEffect, backdropFilter: getComputedStyle(panel).backdropFilter, rows: panel.querySelectorAll('.command-panel-row').length, switches: panel.querySelectorAll('[role=switch]').length }; } };
    window.qaReady = true;
  `;
  try {
    await build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'command-panel-qa.ts', loader: 'ts' }, outfile: path.join(temporary, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', define: { __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false', 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'local-sfc', setup(builder) {
      builder.onResolve({ filter: /^@\/api$/ }, () => ({ path: 'api', namespace: 'qa-fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'qa-fixture' }, () => ({ loader: 'js', contents: `export const api = { listAgentModeTopologies: async () => [{ id: 'qa-solo', slug: 'solo', display_name: 'Solo', description: '由对话智能体直接处理任务', status: 'published', latest_published_mode_version_id: 'qa-solo-v1', nodes: [], edges: [] }, { id: 'qa-workflow', display_name: '产品交付流程', description: '依据设计、开发和验证阶段推进', status: 'published', latest_published_mode_version_id: 'qa-workflow-v1', nodes: [], edges: [{ source: 'a', target: 'b' }] }], listModelProviders: async () => [{ id: 'qa-provider', display_name: '本地 QA 配置目录', connection_kind: 'api-key', enabled: true, model: 'configured-model', models: ['configured-model', 'another-configured-model-with-a-long-name'] }] };` }));
      builder.onResolve({ filter: /^@\// }, args => ({ path: path.join(root, 'apps/desktop/src', args.path.slice(2)) + (path.extname(args.path) ? '' : '.ts') }));
      builder.onLoad({ filter: /\.vue$/ }, args => {
        const descriptor = parse(fs.readFileSync(args.path, 'utf8')).descriptor;
        const script = compileScript(descriptor, { id: 'command-panel-qa', inlineTemplate: true });
        styles.push(...descriptor.styles.map(style => compileStyle({ source: style.content, id: 'command-panel-qa', scoped: false }).code));
        return { contents: script.content, loader: 'ts', resolveDir: path.dirname(args.path) };
      });
    } }] });
    const globals = fs.readFileSync(path.join(root, 'apps/desktop/src/styles.css'), 'utf8').replace(/^@import .*;\r?$/gm, '');
    const preflight = fs.readFileSync(path.join(root, 'node_modules/tailwindcss/preflight.css'), 'utf8');
    const html = `<!doctype html><html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8"><style>@layer base { ${preflight} }\n${globals}\n${styles.join('\n')}\nhtml,body{margin:0;min-width:0;min-height:0;background:var(--bg-primary)}.composer-box{position:fixed;left:30px;bottom:24px;width:800px;padding:16px;display:flex;flex-direction:row;gap:14px;align-items:center}.composer-box input{flex:1;min-width:0;color:var(--text-primary);background:transparent;border:0}.qa-title{position:fixed;left:30px;top:20px;color:var(--text-muted);font-size:12px}</style></head><body><div class="qa-title">真实命令面板组件 · 本地目录夹具 · 无后端写入</div><div class="composer-box welcome-dialog"><span>＋</span><input value="保留中的消息草稿"/><span>↑</span></div><div id="panel"></div><script src="./bundle.js"></script></body></html>`;
    fs.writeFileSync(path.join(temporary, 'index.html'), html);
    await win.loadFile(path.join(temporary, 'index.html'));
    const evaluate = expression => win.webContents.executeJavaScript(expression);
    assert.ok(await evaluate('!!window.qaReady'));
    const sourceHashes = Object.fromEntries(['apps/desktop/src/components/ComposerCommandPanel.vue', 'apps/desktop/src/components/ComposerBar.vue', 'apps/desktop/src/lib/composerCommands.ts', 'apps/desktop/src/styles.css'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
    const result = { timestamp: new Date().toISOString(), scope: 'Actual command panel SFC, fixture catalogs, actual styles/material; no full-app/runtime verification', sourceHashes, cases: [] };
    for (const width of [800, 520, 320]) {
      for (const spatial of [false, true]) {
        await evaluate(`qa.show(${width},${spatial})`);
        const metrics = await evaluate('qa.metrics()');
        assert.ok(metrics.width <= width && metrics.left >= 0 && metrics.right <= 1000 && metrics.top >= 0 && metrics.bottom <= 820, 'panel stays inside viewport');
        assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, 'no horizontal overflow');
        assert.equal(metrics.switches, spatial ? 5 : 0);
        result.cases.push({ width, spatial, metrics });
        fs.writeFileSync(path.join(__dirname, `${spatial ? 'space' : 'flat'}-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
    }
    await evaluate('qa.show(320,true,"model")');
    result.model = await evaluate('qa.metrics()');
    assert.ok(result.model.scrollWidth <= result.model.clientWidth + 1);
    fs.writeFileSync(path.join(__dirname, 'model-320.png'), (await win.webContents.capturePage()).toPNG());
    await evaluate('qa.show(520,true)');
    result.keyboard = await evaluate(`(async()=>{const input=document.querySelector('.command-panel-search input');input.value='plan';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));const rows=document.querySelectorAll('.command-panel-row').length;input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await new Promise(r=>setTimeout(r,30));return{rows,on:qa.state.spaceOptions.plan_first,closed:!document.querySelector('.composer-command-panel')}})()`);
    assert.deepEqual(result.keyboard, { rows: 1, on: true, closed: true });
    await evaluate('qa.show(520,false)');
    result.transition = await evaluate(`(async()=>{const height=qa.metrics().height;document.querySelector('[data-testid="command-panel-model"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const panel=document.querySelector('.composer-command-panel');return{fromHeight:height,currentHeight:panel.getBoundingClientRect().height,page:panel.querySelector('.command-panel-content').dataset.page,opacity:Number(getComputedStyle(panel.querySelector('.command-panel-content')).opacity),running:panel.getAnimations({subtree:true}).filter(a=>a.playState==='running').length,durations:panel.getAnimations({subtree:true}).map(a=>a.effect.getTiming().duration)}})()`);
    assert.equal(result.transition.page, 'model');
    assert.ok(result.transition.running > 0);
    assert.ok(result.transition.opacity >= 0 && result.transition.opacity <= 1);
    assert.ok(result.transition.durations.every(duration => duration === 150));
    await new Promise(resolve => setTimeout(resolve, 180));
    result.transition.completedOpacity = await evaluate('Number(getComputedStyle(document.querySelector(".command-panel-content")).opacity)');
    assert.equal(result.transition.completedOpacity, 1);
    result.risks = {};
    for (const theme of ['dark', 'light']) {
      await evaluate(`document.documentElement.dataset.theme='${theme}'; qa.show(520,false,'permission')`);
      result.risks[theme] = await evaluate(`(()=>{const read=id=>{const icon=document.querySelector('[data-testid="command-panel-'+id+'"] .command-panel-row-icon');const color=getComputedStyle(icon).color;const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,1,1);return{risk:icon.dataset.risk,color,rgb:Array.from(context.getImageData(0,0,1,1).data).slice(0,3)}};return{rows:document.querySelectorAll('.command-panel-row').length,icons:document.querySelectorAll('.command-panel-row .command-panel-row-icon').length,neutral:read('default'),low:read('delegate-reviewer'),medium:read('auto-approve'),high:read('full-access')}})()`);
      const risk = result.risks[theme];
      assert.equal(risk.rows, risk.icons);
      assert.equal(risk.neutral.risk, 'neutral');
      assert.ok(risk.low.rgb[2] > risk.low.rgb[0] && risk.low.rgb[2] > risk.low.rgb[1]);
      assert.ok(risk.medium.rgb[0] > risk.medium.rgb[2] && risk.medium.rgb[1] > risk.medium.rgb[2]);
      assert.ok(risk.high.rgb[0] > risk.high.rgb[1] && risk.high.rgb[0] > risk.high.rgb[2]);
      fs.writeFileSync(path.join(__dirname, `permission-${theme}.png`), (await win.webContents.capturePage()).toPNG());
    }
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
    result.navigation = [];
    for (const key of ['Backspace', 'Delete']) {
      await evaluate('qa.show(520,false,"model")');
      await evaluate(`(()=>{const input=document.querySelector('.command-panel-search input');input.value='abc';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();input.setSelectionRange(${key === 'Backspace' ? 3 : 0},${key === 'Backspace' ? 3 : 0})})()`);
      const code = key === 'Backspace' ? 8 : 46;
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
      const edited = await evaluate(`({value:document.querySelector('.command-panel-search input').value,page:document.querySelector('.command-panel-content').dataset.page})`);
      assert.equal(edited.value, key === 'Backspace' ? 'ab' : 'bc');
      assert.equal(edited.page, 'model');
      await evaluate(`(()=>{const input=document.querySelector('.command-panel-search input');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
      await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
      const returned = await evaluate(`({open:qa.state.open,page:document.querySelector('.command-panel-content').dataset.page})`);
      assert.deepEqual(returned, { open: true, page: 'root' });
      result.navigation.push({ key, edited, returned });
    }
    await evaluate(`document.documentElement.dataset.theme='dark'; qa.show(520,false,'permission')`);
    await evaluate(`document.querySelector('[data-testid="command-panel-full-access"]').focus()`);
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await new Promise(resolve => setTimeout(resolve, 60));
    result.nativeEnter = await evaluate(`({closed:!document.querySelector('.composer-command-panel'),permission:qa.state.permission,draft:document.querySelector('.composer-box input').value})`);
    assert.equal(result.nativeEnter.closed, true);
    assert.equal(result.nativeEnter.permission, 'full-access');
    assert.equal(result.nativeEnter.draft, '保留中的消息草稿');
    await evaluate('qa.show(520,true)');
    await evaluate(`(()=>{const outside=document.createElement('div');outside.id='qa-outside';outside.style='position:fixed;inset:0 0 auto auto;width:60px;height:60px;z-index:10000';for(const name of ['pointerdown','click'])outside.addEventListener(name,event=>event.stopPropagation());document.body.append(outside)})()`);
    win.webContents.sendInputEvent({ type: 'mouseDown', x: 970, y: 30, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', x: 970, y: 30, button: 'left', clickCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 60));
    result.outsideClosed = await evaluate('!document.querySelector(".composer-command-panel")');
    assert.equal(result.outsideClosed, true);
    await evaluate('document.querySelector("#qa-outside").remove()');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate('qa.show(520,false)');
    result.reducedMotion = await evaluate(`(async()=>{document.querySelector('[data-testid="command-panel-model"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return{reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:document.querySelector('.composer-command-panel').getAnimations({subtree:true}).length}})()`);
    assert.deepEqual(result.reducedMotion, { reduced: true, animations: 0 });
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    win.webContents.debugger.detach();
    win.setContentSize(360, 600);
    await evaluate('qa.show(320,true)');
    result.narrowViewport = await evaluate('({...qa.metrics(),viewportWidth:innerWidth,viewportHeight:innerHeight})');
    assert.ok(result.narrowViewport.left >= 0 && result.narrowViewport.top >= 0 && result.narrowViewport.right <= result.narrowViewport.viewportWidth && result.narrowViewport.bottom <= result.narrowViewport.viewportHeight);
    fs.writeFileSync(path.join(__dirname, 'space-viewport-360.png'), (await win.webContents.capturePage()).toPNG());
    win.setContentSize(1000, 820);
    await evaluate(`localStorage.setItem('tinadec-panel-style', JSON.stringify({effect:'blur',opacity:75,blur:12})); location.reload()`);
    await new Promise(resolve => setTimeout(resolve, 350));
    await evaluate('qa.show(520,true)');
    result.blur = await evaluate('qa.metrics()');
    assert.equal(result.blur.material, 'blur');
    assert.equal(result.blur.backdropFilter, 'blur(12px)');
    fs.writeFileSync(path.join(__dirname, 'space-blur.png'), (await win.webContents.capturePage()).toPNG());
    await evaluate(`document.documentElement.dataset.theme='light'; qa.show(520,false)`);
    fs.writeFileSync(path.join(__dirname, 'flat-light.png'), (await win.webContents.capturePage()).toPNG());
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, 'checks.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: true, cases: result.cases.length, directory: __dirname }));
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { clearTimeout(deadline); win.destroy(); app.exit(process.exitCode || 0); }
}).catch(error => { console.error(error); clearTimeout(deadline); app.exit(1); });
