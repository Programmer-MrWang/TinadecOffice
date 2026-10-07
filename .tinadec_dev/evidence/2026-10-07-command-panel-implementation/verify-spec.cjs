// Real ApprovalTab SFC + current CSS, with an explicit 3000-character local proposal.
// No Core, model, approval RPC or user state is read or changed.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { build } = require('node:module').createRequire(require.resolve('vite'))('esbuild');
const { parse, compileScript, compileStyle } = require('@vue/compiler-sfc');
const root = path.resolve(__dirname, '../../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-spec-review-qa-'));
app.setPath('userData', path.join(temporary, 'profile'));
const deadline = setTimeout(() => app.exit(1), 120000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 800, height: 780, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  const errors = [], styles = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  try {
    const source = path.join(root, 'apps/desktop/src/components/ApprovalTab.vue').replaceAll('\\', '/');
    const locale = path.join(root, 'apps/desktop/src/locales/zh-CN.ts').replaceAll('\\', '/');
    await build({ stdin: { resolveDir: root, sourcefile: 'spec-review-qa.ts', loader: 'ts', contents: `
      import { createApp, h } from 'vue'; import { createI18n } from 'vue-i18n';
      import ApprovalTab from '${source}'; import zh from '${locale}';
      const prefix='  # 需求规范\\n\\n完整需求和验收条件，不应截断。\\n';
      const suffix='\\n\\n最后一项验收条件：这里仍必须完整可见。  \\n';
      const document=prefix+'场景：用户先阅读文档，批准此文档后进入下一阶段。\\n'.repeat(150).slice(0,3000-prefix.length-suffix.length)+suffix;
      window.specQa={document,decisions:[]};
      createApp({render:()=>h(ApprovalTab,{compact:true,approvals:[{id:'qa-spec',kind:'permission',tool_id:'spec_propose',summary:'Local specification fixture',arguments:JSON.stringify({stage:'requirements',document}),status:'pending',created_at:''}],shellCommand:'',busy:false,selectedSessionId:'qa-session','onDecide-approval':(...args)=>specQa.decisions.push(args)})}).use(createI18n({legacy:false,locale:'zh-CN',messages:{'zh-CN':zh}})).mount('#app');
    ` }, bundle: true, platform: 'browser', format: 'iife', outfile: path.join(temporary, 'bundle.js'), define: { __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false', 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'local-sfc', setup(builder) {
      builder.onResolve({ filter: /ApprovalGateStatus\.vue$/ }, () => ({ path: 'gate', namespace: 'unused-gate' }));
      builder.onLoad({ filter: /.*/, namespace: 'unused-gate' }, () => ({ contents: 'export default {render:()=>null}', loader: 'js' }));
      builder.onLoad({ filter: /\.vue$/ }, args => {
        const descriptor = parse(fs.readFileSync(args.path, 'utf8')).descriptor;
        styles.push(...descriptor.styles.map(style => compileStyle({ source: style.content, id: 'spec-qa', scoped: false }).code));
        return { contents: compileScript(descriptor, { id: 'spec-qa', inlineTemplate: true }).content, loader: 'ts', resolveDir: path.dirname(args.path) };
      });
    } }] });
    const css = fs.readFileSync(path.join(root,'apps/desktop/src/styles.css'),'utf8').replace(/^@import .*;\r?$/gm,'');
    const preflight = fs.readFileSync(path.join(root,'node_modules/tailwindcss/preflight.css'),'utf8');
    fs.writeFileSync(path.join(temporary,'index.html'),`<!doctype html><html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8"><style>@layer base{${preflight}}${css}\n${styles.join('\n')}\nhtml,body{margin:0;min-width:0;min-height:0;background:var(--bg-primary)}#app{margin:16px;width:520px}</style></head><body><main id="app"></main><script src="./bundle.js"></script></body></html>`);
    await win.loadFile(path.join(temporary,'index.html'));
    const evaluate = expression => win.webContents.executeJavaScript(expression);
    const result = { timestamp: new Date().toISOString(), scope: 'Real ApprovalTab SFC with local document fixture; no actual approval submission', sourceHash: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), cases: [] };
    for (const width of [520,320]) {
      await evaluate(`document.querySelector('#app').style.width='${width}px';new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const metrics = await evaluate(`(()=>{const pre=document.querySelector('.approval-spec-document'),app=document.querySelector('#app'),style=getComputedStyle(pre);const range=document.createRange();range.selectNodeContents(pre);getSelection().removeAllRanges();getSelection().addRange(range);return{length:pre.textContent.length,exact:pre.textContent===specQa.document,selected:getSelection().toString().length,selectedRange:getSelection().getRangeAt(0).toString().length,whiteSpace:style.whiteSpace,userSelect:style.userSelect,scrollable:pre.scrollHeight>pre.clientHeight,within:app.scrollWidth<=app.clientWidth+1,autoGrants:document.querySelectorAll('.always,.approval-rule-request-button').length,buttons:[...document.querySelectorAll('.approval-actions button')].map(b=>b.textContent.trim())}})()`);
      assert.equal(metrics.length,3000);assert.ok(metrics.exact);assert.equal(metrics.selectedRange,3000);assert.equal(metrics.whiteSpace,'pre-wrap');assert.equal(metrics.userSelect,'text');assert.ok(metrics.scrollable);assert.ok(metrics.within);assert.equal(metrics.autoGrants,0);
      result.cases.push({width,metrics});
      await evaluate('getSelection().removeAllRanges()');
      fs.writeFileSync(path.join(__dirname,`spec-review-${width}.png`),(await win.webContents.capturePage()).toPNG());
    }
    await evaluate(`document.querySelector('.approve').click();document.querySelector('.reject').click()`);
    result.decisions=await evaluate('specQa.decisions.map(args=>[args[1],args[2]])');
    assert.deepEqual(result.decisions,[['approved','once'],['rejected','once']]);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'spec-checks.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({passed:true,scope:result.scope,cases:result.cases.length}));
  }catch(error){console.error(error);process.exitCode=1}
  finally{clearTimeout(deadline);win.destroy();app.exit(process.exitCode||0)}
}).catch(error=>{console.error(error);clearTimeout(deadline);app.exit(1)});
