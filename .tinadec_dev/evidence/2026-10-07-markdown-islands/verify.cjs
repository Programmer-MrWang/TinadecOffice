// Run from the repository root with node_modules/electron/dist/electron.exe,
// removing ELECTRON_RUN_AS_NODE from the child environment.
// Compiles the real MarkdownRender SFC and loads local browser dependencies in a
// hidden disposable window. Transcript wrappers mirror MessageItem/MessageList;
// styles use current styles.css, MessageList/UiIslandCard CSS and Tailwind preflight.
// No server, Core/Gateway calls or live user/session state are required.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { parse, compileScript, compileStyle } = require('@vue/compiler-sfc');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-markdown-qa-')));
app.commandLine.appendSwitch('disable-renderer-backgrounding');
const deadline = setTimeout(() => { console.error('Markdown QA deadline exceeded'); app.exit(1); }, 120000);
const errors = [], blockedApiRequests = [], preventedNavigations = [];

async function boot(modules) {
  const Vue = await import(modules.vue);
  const { createI18n } = await import(modules.i18n);
  const { default: MarkdownRender } = await import(modules.component);
  const state = Vue.reactive({ messages: [], streamingReply: '' });
  const instance = Vue.createApp({ render: () => {
    const rows = state.messages.map(message => Vue.h('article', { class: 'message-wrapper assistant' },
      Vue.h('div', { class: 'assistant-message-row' }, Vue.h('div', { class: 'message-content assistant' }, Vue.h(MarkdownRender, { content: message.content })))));
    if (state.streamingReply) rows.push(Vue.h('div', { class: 'message-content assistant', 'data-testid': 'chat-streaming-reply' }, Vue.h(MarkdownRender, { content: state.streamingReply })));
    return Vue.h('div', { class: 'message-stream-container' }, Vue.h('div', { class: 'message-stream relative overflow-hidden' },
      Vue.h('div', { class: 'h-full w-full overflow-auto' }, Vue.h('div', { class: 'message-stream-inner' }, rows))));
  } });
  instance.use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': { chat: { markdownTable: 'Markdown 表格' } } } }));
  instance.mount('#messages');
  const host = document.querySelector('.conversation');
  const viewport = () => document.querySelector('.message-stream > div');
  window.qa = {
    async set(content, role = 'assistant', width = 800, stream = '') {
      host.style.width = width + 'px';
      host.className = 'conversation' + (width < 560 ? ' chat-narrow' : '') + (width < 400 ? ' chat-ultra' : '');
      state.messages = content === null ? [] : [{ id: 'qa', session_id: 'qa', role, content, created_at: '' }];
      state.streamingReply = stream;
      await Vue.nextTick();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (viewport()) viewport().scrollTop = 0;
    },
    async stream(content) {
      state.streamingReply = content;
      await Vue.nextTick();
    },
    metrics() {
      const body = document.querySelector('.markdown-body');
      const box = el => el && ({ width: el.getBoundingClientRect().width, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, overflowX: getComputedStyle(el).overflowX });
      return {
        host: box(host), viewport: box(viewport()), body: box(body),
        table: box(body?.querySelector('table')), pre: box(body?.querySelector('pre')),
        tableScroll: box(body?.querySelector('.markdown-table-scroll')),
        cards: [...(body?.querySelectorAll('.island-card') ?? [])].map(el => ({ background: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderRadius, shadow: getComputedStyle(el).boxShadow, materialRoot: el.hasAttribute('data-panel-effect'), filter: getComputedStyle(el).backdropFilter })),
        lists: [...(body?.querySelectorAll('ul,ol') ?? [])].map(el => ({ tag: el.tagName, listStyle: getComputedStyle(el).listStyleType, start: el.getAttribute('start') })),
        cellAlignment: [...(body?.querySelectorAll('th') ?? [])].map(el => ({ align: el.getAttribute('align'), computed: getComputedStyle(el).textAlign })),
      };
    },
  };
  window.qaReady = true;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1000, height: 760, show: false, webPreferences: {
    contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: false, backgroundThrottling: false,
  } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { preventedNavigations.push(url); event.preventDefault(); });
  win.webContents.on('console-message', (_event, ...args) => {
    const details = args[0];
    if (details && typeof details === 'object') { if (details.level === 'error') errors.push(details.message); }
    else if (details === 3) errors.push(args[1]);
  });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:48730/*', 'http://127.0.0.1:48731/*'] }, (details, callback) => {
    blockedApiRequests.push(details.url); callback({ cancel: true });
  });
  const evaluate = expression => win.webContents.executeJavaScript(expression);
  const set = (content, role = 'assistant', width = 800, stream = '') => evaluate(`qa.set(${JSON.stringify(content)},${JSON.stringify(role)},${width},${JSON.stringify(stream)})`);
  const shot = async name => {
    await evaluate('(async()=>{getComputedStyle(document.body).backgroundColor;await Promise.allSettled(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished));await new Promise(resolve=>setTimeout(resolve,150))})()');
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    fs.writeFileSync(path.join(__dirname, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  try {
    const modules = {
      vue: pathToFileURL(require.resolve('vue/dist/vue.esm-browser.js')).href,
      marked: pathToFileURL(path.join(root, 'node_modules/marked/lib/marked.esm.js')).href,
      dompurify: pathToFileURL(path.join(root, 'node_modules/dompurify/dist/purify.es.mjs')).href,
      i18n: pathToFileURL(path.join(root, 'node_modules/vue-i18n/dist/vue-i18n.esm-browser.js')).href,
    };
    const ts = require('typescript');
    const component = file => {
      const descriptor = parse(fs.readFileSync(path.join(root, file), 'utf8')).descriptor;
      const compiled = compileScript(descriptor, { id: 'markdown-qa', inlineTemplate: true }).content;
      const transformed = ts.transpileModule(compiled, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
        .replace(/\bfrom\s+(['"])(vue|marked|dompurify|vue-i18n|\.\/ui\/island-card\.vue)\1/g, (_match, _quote, module) => 'from ' + JSON.stringify(module === 'vue-i18n' ? modules.i18n : module === './ui/island-card.vue' ? modules.card : modules[module]));
      return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(transformed);
    };
    modules.card = component('apps/desktop/src/components/ui/island-card.vue');
    modules.component = component('apps/desktop/src/components/MarkdownRender.vue');
    const globalCss = fs.readFileSync(path.join(root, 'apps/desktop/src/styles.css'), 'utf8').replace(/^@import .*;\r?$/gm, '');
    const preflight = fs.readFileSync(path.join(root, 'node_modules/tailwindcss/preflight.css'), 'utf8');
    const listStyles = parse(fs.readFileSync(path.join(root, 'apps/desktop/src/components/MessageList.vue'), 'utf8')).descriptor.styles
      .map(style => compileStyle({ source: style.content, id: 'markdown-qa', scoped: false }).code).join('\n');
    const cardStyles = parse(fs.readFileSync(path.join(root, 'apps/desktop/src/components/ui/island-card.vue'), 'utf8')).descriptor.styles
      .map(style => compileStyle({ source: style.content, id: 'markdown-card-qa', scoped: false }).code).join('\n');
    const fontCss = pathToFileURL(require.resolve('@fontsource-variable/geist/index.css')).href;
    const importMap = JSON.stringify({ imports: { vue: modules.vue } });
    const html = `<!doctype html><html lang="zh-CN" data-theme="dark"><head><meta charset="UTF-8"><link rel="stylesheet" href="${fontCss}"><script type="importmap">${importMap}</script><style>@layer base{${preflight}}\n${globalCss}\n${listStyles}\n${cardStyles}\n.relative{position:relative}.overflow-hidden{overflow:hidden}.h-full{height:100%}.w-full{width:100%}.overflow-auto{overflow:auto}html,body{margin:0;min-width:0;min-height:0;background:var(--bg-primary)}.conversation{height:730px;margin:15px;display:flex;flex-direction:column}</style></head><body><section class="conversation"><div id="messages" style="height:100%;display:flex;flex-direction:column"></div></section><script type="module">(${boot.toString()})(${JSON.stringify(modules)}).catch(error=>{window.qaError=String(error.stack??error)});</script></body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const until = Date.now() + 45000;
    while (Date.now() < until && !await evaluate('!!window.qaReady')) {
      const error = await evaluate('window.qaError'); if (error) throw new Error(error);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(await evaluate('!!window.qaReady'), 'Vue fixture did not load');
    const result = { timestamp: new Date().toISOString(), runtime: process.versions, fixture: 'Real MarkdownRender SFC; mirrored transcript wrappers; current source styles and Tailwind preflight. No full-app/model/network acceptance.', sourceHashes: {} };
    for (const file of ['apps/desktop/src/components/MarkdownRender.vue', 'apps/desktop/src/components/ui/island-card.vue', 'apps/desktop/src/components/MessageItem.vue', 'apps/desktop/src/components/MessageList.vue', 'apps/desktop/src/styles.css']) {
      result.sourceHashes[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    }
    const basics = '# 一级标题\n\n## 二级标题\n\n### 三级标题\n\n#### 四级标题\n\n##### 五级标题\n\n###### 六级标题\n\n**加粗**、*斜体*、~~删除线~~、`inline code`\n第一行\n第二行\n\n> 引用\n\n- 项目甲\n- 项目乙\n  - 嵌套项目\n\n3. 第三项\n4. 第四项\n\n- [x] 已完成\n- [ ] 待处理\n\n---\n\n| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| A | B | C |\n\n[链接](https://example.invalid/markdown-qa) 和 https://example.invalid/automatic\n\n[引用链接][ref]\n\n[ref]: https://example.invalid/reference\n';
    await set(basics);
    result.basics = await evaluate(`(()=>{const b=document.querySelector('.markdown-body');return {html:b.innerHTML,headings:b.querySelectorAll('h1,h2,h3,h4,h5,h6').length,strong:!!b.querySelector('strong'),em:!!b.querySelector('em'),del:!!b.querySelector('del'),inlineCode:!!b.querySelector('code'),hardBreaks:b.querySelectorAll('br').length,quote:!!b.querySelector('blockquote'),table:!!b.querySelector('table'),hr:!!b.querySelector('hr'),links:b.querySelectorAll('a').length,checkboxes:[...b.querySelectorAll('input')].map(e=>({type:e.type,checked:e.checked,disabled:e.disabled,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,computedWidth:getComputedStyle(e).width,computedHeight:getComputedStyle(e).height})),metrics:qa.metrics()}})()`);
    assert.equal(result.basics.headings, 6);
    for (const key of ['strong', 'em', 'del', 'inlineCode', 'quote', 'table', 'hr']) assert.ok(result.basics[key], key);
    assert.equal(result.basics.links, 3); assert.equal(result.basics.hardBreaks, 2);
    assert.deepEqual(result.basics.checkboxes.map(e => [e.checked, e.disabled]), [[true, true], [false, true]]);
    assert.ok(result.basics.checkboxes.every(e => Math.abs(e.width - 13) < 1 && Math.abs(e.height - 13) < 1));
    assert.deepEqual(result.basics.metrics.lists.map(e => e.listStyle), ['disc', 'circle', 'decimal', 'disc']);
    assert.deepEqual(result.basics.metrics.cellAlignment.map(e => e.computed), ['left', 'center', 'right']);
    assert.equal(result.basics.metrics.cards.length, 2);
    assert.ok(result.basics.metrics.cards.every(card => card.radius === '12px' && !card.materialRoot && card.filter === 'none'));
    await shot('basic-dark');
    await evaluate(`document.documentElement.setAttribute('data-theme','light')`); await shot('basic-light');
    result.lightTheme = await evaluate(`({theme:document.documentElement.dataset.theme,background:getComputedStyle(document.body).backgroundColor,text:getComputedStyle(document.querySelector('.markdown-body')).color})`);
    await evaluate(`document.documentElement.setAttribute('data-theme','dark')`);

    result.layout = [];
    const wideTable = '| ' + Array.from({ length: 8 }, (_, i) => 'Column' + i).join(' | ') + ' |\n| ' + Array(8).fill('---').join(' | ') + ' |\n| ' + Array.from({ length: 8 }, (_, i) => 'LongUnbrokenCellValue_' + i).join(' | ') + ' |';
    for (const [name, content] of [['table', wideTable], ['code', '```javascript\nconst sample = "' + 'A'.repeat(200) + '";\n```'], ['long-link', 'https://example.invalid/' + 'segment'.repeat(45)]]) {
      for (const width of [800, 520, 320]) {
        await set(content, 'assistant', width);
        const metrics = await evaluate('qa.metrics()');
        result.layout.push({ case: name, width, metrics });
        assert.ok(metrics.viewport.scrollWidth <= metrics.viewport.clientWidth + 1, name + ' overflowed transcript at ' + width);
        if (name === 'table') assert.ok(metrics.tableScroll.scrollWidth > metrics.tableScroll.clientWidth);
        if (name === 'code') assert.ok(metrics.pre.scrollWidth > metrics.pre.clientWidth);
        if (width === 320) await shot(name + '-320');
      }
    }
    await set('```javascript\nconst total = 1 + 2;\n```');
    result.code = await evaluate(`(()=>{const c=document.querySelector('pre code');return {className:c.className,tokenElements:c.children.length,text:c.textContent,buttons:document.querySelector('.markdown-body').querySelectorAll('button').length}})()`);
    assert.equal(result.code.className, 'language-javascript');

    const extended = '# 扩展语法\n\n行内公式 $a^2+b^2=c^2$\n\n$$\n\\frac{1}{2}\n$$\n\n```mermaid\ngraph TD\n  A --> B\n```\n\n正文脚注[^1]\n\n[^1]: 脚注文本\n\n> [!NOTE]\n> 提示文本\n\n[跳到标题](#扩展语法)\n\n<details><summary>HTML 折叠内容</summary>普通 HTML 正文</details>\n\n<script type="application/json">{"inert":true}</script>\n';
    await set(extended);
    result.extended = await evaluate(`(()=>{const b=document.querySelector('.markdown-body');return {html:b.innerHTML,mathElements:b.querySelectorAll('.katex,math,.MathJax').length,mermaidCode:!!b.querySelector('code.language-mermaid'),diagramElements:b.querySelectorAll('svg,.mermaid').length,footnoteElements:b.querySelectorAll('sup,[role=doc-noteref]').length,headingId:b.querySelector('h1').id,rawHtmlDetails:!!b.querySelector('details'),scripts:b.querySelectorAll('script').length}})()`);
    assert.equal(result.extended.scripts, 0);
    await shot('extended-dark');
    const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="200"><rect width="1000" height="200" fill="#4389ce"/></svg>').toString('base64');
    await set('![本地图像](' + image + ')', 'assistant', 320);
    result.image = await evaluate(`(async()=>{const image=document.querySelector('.markdown-body img');await image.decode();return {alt:image.alt,naturalWidth:image.naturalWidth,width:image.getBoundingClientRect().width,bodyWidth:image.parentElement.parentElement.getBoundingClientRect().width}})()`);
    assert.ok(result.image.width <= result.image.bodyWidth);
    await set(null, 'assistant', 800, '**流式加粗**\n\n```js\nconst answer =');
    result.streaming = await evaluate(`(()=>{const b=document.querySelector('[data-testid=chat-streaming-reply] .markdown-body');window.qaOldCode=b.querySelector('code');return {strong:!!b.querySelector('strong'),unfinishedCode:b.querySelector('code').textContent}})()`);
    await evaluate(`qa.stream(${JSON.stringify('**流式加粗**\n\n```js\nconst answer = 42;\n```')})`);
    result.streaming.finished = await evaluate(`({text:document.querySelector('pre code').textContent,replacedCodeNode:qaOldCode!==document.querySelector('pre code')})`);
    assert.ok(result.streaming.strong); assert.ok(result.streaming.finished.text.includes('42'));
    const completed = '```js\nconst answer = 42;\n```\n\n| 列 |\n| --- |\n| 值 |\n\n';
    await set(null, 'assistant', 800, completed + '后续正文');
    await evaluate(`window.qaCompletedCode=document.querySelector('pre code');window.qaCompletedTable=document.querySelector('.markdown-table-scroll');qaCompletedTable.focus()`);
    await evaluate(`qa.stream(${JSON.stringify(completed + '后续正文继续 **加粗**')})`);
    result.streaming.completedBlocks = await evaluate(`({codePreserved:qaCompletedCode===document.querySelector('pre code'),tablePreserved:qaCompletedTable===document.querySelector('.markdown-table-scroll'),focusPreserved:document.activeElement===qaCompletedTable})`);
    assert.ok(Object.values(result.streaming.completedBlocks).every(Boolean));
    await set('> 材质继承验证');
    result.material = await evaluate(`(async()=>{const host=document.querySelector('.conversation'),card=document.querySelector('.island-card');host.setAttribute('data-panel-effect','blur');host.style.setProperty('--surface-section','rgba(24,31,39,0.64)');getComputedStyle(card).backgroundColor;await Promise.allSettled(card.getAnimations().map(animation=>animation.finished));return {parentEffect:host.dataset.panelEffect,className:card.className,hostSurface:getComputedStyle(host).getPropertyValue('--surface-section'),cardSurface:getComputedStyle(card).getPropertyValue('--surface-section'),background:getComputedStyle(card).backgroundColor,nestedMaterialRoot:card.hasAttribute('data-panel-effect'),filter:getComputedStyle(card).backdropFilter}})()`);
    console.log('material ' + JSON.stringify(result.material));
    assert.equal(result.material.background, 'rgba(24, 31, 39, 0.64)');
    assert.equal(result.material.nestedMaterialRoot, false); assert.equal(result.material.filter, 'none');
    await evaluate(`document.querySelector('.conversation').style.removeProperty('--surface-section');document.querySelector('.conversation').removeAttribute('data-panel-effect')`);
    await set(null, 'assistant', 800, '计时正文');
    result.performance = [];
    for (const repetitions of [25, 125, 250]) {
      const text = ('## 小节\n\n这是测试正文，带有**粗体**与`code`。\n\n- 列表一\n- 列表二\n\n').repeat(repetitions);
      result.performance.push(await evaluate(`(async()=>{const text=${JSON.stringify(text)},samples=[];for(let i=0;i<5;i++){const start=performance.now();await qa.stream(text+String.fromCharCode(10)+i);samples.push(performance.now()-start)}return {chars:text.length,updateMs:samples}})()`));
    }
    await set('[链接](https://example.invalid/markdown-qa)');
    await evaluate(`document.querySelector('.markdown-body a').click()`);
    await new Promise(resolve => setTimeout(resolve, 100));
    result.preventedNavigations = preventedNavigations;
    result.blockedApiRequests = blockedApiRequests; result.errors = errors;
    assert.deepEqual(blockedApiRequests, [], 'Fixture attempted a backend request');
    assert.deepEqual(errors, [], 'Renderer logged errors');
    result.status = 'passed';
    fs.writeFileSync(path.join(__dirname, 'checks.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'passed', layout: result.layout, lists: result.basics.metrics.lists, cellAlignment: result.basics.metrics.cellAlignment, code: result.code, extended: result.extended, streaming: result.streaming, performance: result.performance, preventedNavigations }));
    app.exit(0);
  } catch (error) { console.error(error.stack); console.error(JSON.stringify(errors)); app.exit(1); }
  finally { clearTimeout(deadline); if (!win.isDestroyed()) win.destroy(); }
});
