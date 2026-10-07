// Markdown acceptance fixture for the extended syntax round.
//
// Run from the repository root with node_modules/electron/dist/electron.exe and
// ELECTRON_RUN_AS_NODE removed from the child environment:
//   apps/desktop/node_modules/electron/dist/electron.exe .tinadec_dev/evidence/2026-10-08-markdown-extended/verify.cjs
//
// It bundles the real MarkdownRender / MarkdownDiagram SFCs (Vite, current
// sources and stylesheet) and drives them in a hidden disposable window, so the
// checks cover shipped code with real Chromium layout, MathML, Mermaid and the
// system clipboard. No Gateway, Core or model calls are made.
const { app, BrowserWindow, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const desktop = path.join(root, 'apps/desktop');
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-md-extended-'));
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'tinadec-md-extended-userdata-')));
app.commandLine.appendSwitch('disable-renderer-backgrounding');
const deadline = setTimeout(() => { console.error('Markdown extended QA deadline exceeded'); app.exit(1); }, 300000);

const failures = [];
const consoleErrors = [];
function expect(label, condition, detail) {
  if (!condition) failures.push(`${label}: ${JSON.stringify(detail)}`);
}

async function buildFixture() {
  const { build } = await import('vite');
  const { default: vue } = await import('@vitejs/plugin-vue');
  const { default: tailwindcss } = await import('@tailwindcss/vite');
  await build({
    root: desktop,
    configFile: false,
    base: './',
    logLevel: 'warn',
    plugins: [vue(), tailwindcss()],
    resolve: { alias: { '@': path.join(desktop, 'src') } },
    build: {
      outDir: outputDir,
      emptyOutDir: true,
      minify: false,
      cssCodeSplit: false,
      rollupOptions: {
        input: path.join(__dirname, 'fixture-entry.ts'),
        output: {
          entryFileNames: 'fixture.js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  });
  const find = extension => {
    const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(extension) ? [full] : [];
    });
    return walk(outputDir);
  };
  const [css = null] = find('.css');
  const html = `<!doctype html><html lang="zh-CN" data-theme="dark"><head><meta charset="UTF-8">
${css ? `<link rel="stylesheet" href="./${path.relative(outputDir, css).split(path.sep).join('/')}">` : ''}
<style>html,body{margin:0;min-width:0;min-height:0;background:var(--bg-primary)}.conversation{height:720px;margin:15px;display:flex;flex-direction:column}.relative{position:relative}.overflow-hidden{overflow:hidden}.h-full{height:100%}.w-full{width:100%}.overflow-auto{overflow:auto}</style>
</head><body><section class="conversation"><div id="messages"></div></section>
<script type="module" src="./fixture.js"></script></body></html>`;
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  return outputDir;
}

app.whenReady().then(async () => {
  const result = { timestamp: new Date().toISOString(), runtime: process.versions, fixture: 'Real MarkdownRender/MarkdownDiagram SFCs bundled from current sources with current stylesheet; mirrored transcript wrappers; no Gateway/Core/model calls.', sourceHashes: {}, checks: {}, failures };
  let win;
  try {
    await buildFixture();
    for (const file of [
      'apps/desktop/src/components/MarkdownRender.vue',
      'apps/desktop/src/components/MarkdownDiagram.vue',
      'apps/desktop/src/components/ui/island-card.vue',
      'apps/desktop/src/components/MessageItem.vue',
      'apps/desktop/src/components/MessageList.vue',
      'apps/desktop/src/styles.css',
    ]) result.sourceHashes[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

    // Shown but parked off-screen: Chromium refuses a clipboard write while the
    // document has no focus, and a hidden window never gets focus.
    win = new BrowserWindow({
      width: 1000, height: 780, x: -2400, y: 0, show: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: false, backgroundThrottling: false },
    });
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(true));
    win.webContents.session.setPermissionCheckHandler(() => true);
    win.webContents.on('console-message', (_event, ...args) => {
      const details = args[0];
      if (details && typeof details === 'object') { if (details.level === 'error') consoleErrors.push(details.message); }
      else if (details === 3) consoleErrors.push(args[1]);
    });
    const evaluate = expression => win.webContents.executeJavaScript(expression);
    /** Chromium only allows a clipboard write from a real user gesture. */
    const evaluateAsUser = expression => win.webContents.executeJavaScript(expression, true);
    const set = (content, width = 800) => evaluate(`qa.set(${JSON.stringify(content)}, ${width})`);
    const theme = value => evaluate(`qa.theme(${JSON.stringify(value)})`);
    const waitFor = async (selector, timeout = 20000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return true;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return false;
    };
    const shot = async name => {
      await evaluate('qa.settled()');
      fs.writeFileSync(path.join(__dirname, `${name}.png`), (await win.webContents.capturePage()).toPNG());
    };

    await win.loadFile(path.join(outputDir, 'index.html'));
    win.show();
    win.focus();
    const bootUntil = Date.now() + 60000;
    while (Date.now() < bootUntil && !await evaluate('!!window.qaReady')) {
      const error = await evaluate('window.qaError');
      if (error) throw new Error(error);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(await evaluate('!!window.qaReady'), 'fixture did not load');

    // ---- structure + cards -------------------------------------------------
    const basics = [
      '## 小节标题',
      '',
      '正文 **加粗**、*斜体*、`inline code`。',
      '',
      '> 普通引用',
      '',
      '```js',
      'const answer = 42;',
      '```',
      '',
      '| 左 | 中 | 右 |',
      '| :--- | :---: | ---: |',
      '| A | B | C |',
    ].join('\n');
    await set(basics);
    result.checks.basics = await evaluate(`(()=>{
      const body=document.querySelector('.markdown-body');
      return {
        islands: document.querySelectorAll('.island-card').length,
        materialRoots: [...document.querySelectorAll('.island-card')].filter(card=>card.hasAttribute('data-panel-effect')).length,
        cardRadius: getComputedStyle(document.querySelector('.markdown-island')).borderRadius,
        prose: !!body.querySelector('.markdown-prose strong'),
        tableRegion: !!body.querySelector('.markdown-table-scroll[role="region"]'),
        codeLanguage: body.querySelector('.markdown-code-lang')?.textContent ?? null,
        highlightTokens: body.querySelectorAll('pre code .hljs-keyword').length,
        headingId: body.querySelector('h2')?.id ?? null,
        anchorHref: body.querySelector('h2 .markdown-anchor')?.getAttribute('href') ?? null,
      };
    })()`);
    expect('islands rendered', result.checks.basics.islands === 3, result.checks.basics);
    expect('island cards are not material roots', result.checks.basics.materialRoots === 0, result.checks.basics);
    expect('island card keeps the 12px surface radius', result.checks.basics.cardRadius === '12px', result.checks.basics);
    expect('prose stays prose', result.checks.basics.prose === true, result.checks.basics);
    expect('table owns a named scroll region', result.checks.basics.tableRegion === true, result.checks.basics);
    expect('code fence keeps its language label', result.checks.basics.codeLanguage === 'js', result.checks.basics);
    expect('code fence is highlighted', result.checks.basics.highlightTokens > 0, result.checks.basics);
    expect('heading gets a prefixed id', String(result.checks.basics.headingId).startsWith('md-'), result.checks.basics);
    expect('heading anchor points at its id', result.checks.basics.anchorHref === `#${result.checks.basics.headingId}`, result.checks.basics);
    await shot('basics-dark');

    // ---- clipboard round trip ---------------------------------------------
    // Diagnostic: records whether the async clipboard itself is usable here.
    result.checks.clipboardProbe = await evaluateAsUser(`(async()=>{
      try { await navigator.clipboard.writeText('probe'); return { ok: true, focused: document.hasFocus() }; }
      catch (error) { return { ok: false, name: error.name, message: error.message, focused: document.hasFocus() }; }
    })()`);
    clipboard.writeText('sentinel');
    result.checks.copy = await evaluateAsUser(`(async()=>{
      const button=document.querySelector('.markdown-copy');
      button.click();
      await new Promise(resolve=>setTimeout(resolve,300));
      return { label: button.textContent.trim(), classes: button.className, clipboardType: typeof navigator.clipboard?.writeText };
    })()`);
    result.checks.copy.clipboard = clipboard.readText();
    // The OS clipboard normalises newlines on Windows, so compare with them normalised.
    expect('copy writes the raw code to the system clipboard', result.checks.copy.clipboard.replace(/\r\n/g, '\n') === 'const answer = 42;\n', result.checks.copy);
    expect('copy button reports success', result.checks.copy.classes.includes('is-copied'), result.checks.copy);

    // ---- maths -------------------------------------------------------------
    await set(['行内公式 $a^2+b^2=c^2$ 结束。', '', '$$', '\\sum_{i=1}^{n} \\frac{1}{i^2} + \\sqrt{x^2+y^2} + \\int_0^1 f(t)\\,dt', '$$'].join('\n'));
    result.checks.maths = await evaluate(`(()=>{
      const body=document.querySelector('.markdown-body');
      const display=body.querySelector('.katex-display');
      const host=document.querySelector('.message-stream > div');
      return {
        katex: body.querySelectorAll('.katex').length,
        mathml: body.querySelectorAll('math').length,
        display: !!display,
        displayOverflow: display ? { clientWidth: display.clientWidth, scrollWidth: display.scrollWidth, overflowX: getComputedStyle(display).overflowX } : null,
        viewport: { clientWidth: host.clientWidth, scrollWidth: host.scrollWidth },
      };
    })()`);
    expect('inline and display maths both render', result.checks.maths.katex >= 2, result.checks.maths);
    expect('MathML branches survive sanitizing', result.checks.maths.mathml >= 2, result.checks.maths);
    expect('display maths own a scroll container', result.checks.maths.displayOverflow?.overflowX === 'auto', result.checks.maths);
    expect('maths do not widen the transcript', result.checks.maths.viewport.clientWidth === result.checks.maths.viewport.scrollWidth, result.checks.maths);
    await shot('maths-dark');

    // ---- footnotes ---------------------------------------------------------
    await set(['脚注引用[^1]，还有第二处[^2]。', '', '正文换行。', '', '[^1]: 第一条脚注正文。', '', '[^2]: 第二条脚注正文。'].join('\n'));
    result.checks.footnotes = await evaluate(`(()=>{
      const section=document.querySelector('.footnotes');
      const host=document.querySelector('.message-stream > div');
      return {
        present: !!section,
        title: section?.querySelector('h2')?.textContent ?? null,
        backrefLabel: section?.querySelector('a[data-footnote-backref]')?.getAttribute('aria-label') ?? null,
        items: section?.querySelectorAll('li').length ?? 0,
        refHref: document.querySelector('a[data-footnote-ref]')?.getAttribute('href') ?? null,
        hashBefore: location.hash,
      };
    })()`);
    expect('footnote section renders both entries', result.checks.footnotes.present && result.checks.footnotes.items === 2, result.checks.footnotes);
    expect('footnote labels are localised', result.checks.footnotes.title === '脚注' && result.checks.footnotes.backrefLabel === '返回引用 1', result.checks.footnotes);
    const footnoteJump = await evaluate(`(async()=>{
      const before=document.querySelector('.message-stream > div').scrollTop;
      document.querySelector('a[data-footnote-ref]').click();
      await new Promise(resolve=>setTimeout(resolve,350));
      return { before, after: document.querySelector('.message-stream > div').scrollTop, hash: location.hash };
    })()`);
    result.checks.footnotes.jump = footnoteJump;
    expect('footnote reference jumps without touching the router hash', footnoteJump.hash === result.checks.footnotes.hashBefore, footnoteJump);

    // ---- callouts ----------------------------------------------------------
    await set([
      '> [!NOTE]',
      '> 一条普通提示。',
      '',
      '> [!TIP] 自定义标题',
      '> 小技巧正文。',
      '',
      '> [!IMPORTANT]',
      '> 重要信息。',
      '',
      '> [!WARNING]',
      '> 警告信息。',
      '',
      '> [!CAUTION]',
      '> 危险信息。',
      '',
      '> 普通引用不应变成提示块。',
    ].join('\n'));
    result.checks.callouts = await evaluate(`(()=>{
      const callouts=[...document.querySelectorAll('.markdown-callout')];
      return {
        count: callouts.length,
        kinds: callouts.map(card=>[...card.classList].find(name=>name.startsWith('is-'))),
        titles: callouts.map(card=>card.querySelector('.markdown-callout-head').textContent.trim()),
        bodies: callouts.map(card=>card.querySelector('.markdown-callout-body').textContent.trim()),
        tinted: callouts.every(card=>getComputedStyle(card.querySelector('.markdown-island-content')).backgroundColor !== 'rgba(0, 0, 0, 0)'),
        plainQuotes: document.querySelectorAll('.markdown-island:not(.markdown-callout) blockquote').length,
      };
    })()`);
    expect('five alert kinds render as five callouts', result.checks.callouts.count === 5, result.checks.callouts);
    expect('callout kinds are typed', result.checks.callouts.kinds.join(',') === 'is-note,is-tip,is-important,is-warning,is-caution', result.checks.callouts);
    expect('callout titles are localised and a custom title wins', result.checks.callouts.titles.join('|') === '注意|自定义标题|重要|警告|危险', result.checks.callouts);
    expect('callout bodies keep their text', result.checks.callouts.bodies[0] === '一条普通提示。', result.checks.callouts);
    expect('callout bodies are tinted by their type', result.checks.callouts.tinted === true, result.checks.callouts);
    expect('ordinary quotes stay plain', result.checks.callouts.plainQuotes === 1, result.checks.callouts);
    await shot('callouts-dark');

    // ---- anchors -----------------------------------------------------------
    await set('## 小节一\n\n正文。\n\n## 小节一\n\n重复标题。');
    const anchorJump = await evaluate(`(async()=>{
      const hashBefore=location.hash;
      const heading=document.querySelectorAll('h2')[1];
      heading.querySelector('.markdown-anchor').click();
      await new Promise(resolve=>setTimeout(resolve,350));
      return {
        ids: [...document.querySelectorAll('h2')].map(node=>node.id),
        hashBefore, hashAfter: location.hash,
        flashed: heading.classList.contains('is-anchor-target'),
      };
    })()`);
    result.checks.anchors = anchorJump;
    expect('duplicate headings get distinct ids', anchorJump.ids.join(',') === 'md-小节一,md-小节一-2', anchorJump);
    expect('anchor jump leaves the router hash alone', anchorJump.hashBefore === anchorJump.hashAfter, anchorJump);
    expect('anchor jump marks the destination', anchorJump.flashed === true, anchorJump);

    // ---- diagrams ----------------------------------------------------------
    await set(['```mermaid', 'graph TD', '  A[开始] --> B{判断}', '  B -->|是| C[执行]', '  B -->|否| D[结束]', '```'].join('\n'));
    const diagramReady = await waitFor('.markdown-diagram-svg svg', 30000);
    expect('mermaid diagram renders', diagramReady, null);
    result.checks.diagram = await evaluate(`(()=>{
      const svg=document.querySelector('.markdown-diagram-svg svg');
      const box=svg?.getBoundingClientRect();
      return {
        nodes: document.querySelectorAll('.markdown-diagram-svg .node').length,
        width: box?.width ?? 0, height: box?.height ?? 0,
        role: document.querySelector('.markdown-diagram-svg')?.getAttribute('role') ?? null,
        inlineStyleSheets: document.querySelectorAll('.markdown-diagram-svg style').length,
      };
    })()`);
    expect('the diagram has nodes and a real box', result.checks.diagram.nodes >= 4 && result.checks.diagram.width > 100, result.checks.diagram);
    expect('the diagram is labelled for assistive tech', result.checks.diagram.role === 'img', result.checks.diagram);
    await shot('diagram-dark');

    await set('```mermaid\nnot a diagram at all\n```');
    const fallbackReady = await waitFor('.markdown-diagram-note', 20000);
    result.checks.diagramFallback = await evaluate(`(()=>{
      const note=document.querySelector('.markdown-diagram-note');
      return {
        note: note?.textContent.trim() ?? null,
        source: document.querySelector('.markdown-diagram-fallback code')?.textContent ?? null,
        svg: !!document.querySelector('.markdown-diagram-svg svg'),
      };
    })()`);
    expect('an unrenderable diagram falls back to its source', fallbackReady && result.checks.diagramFallback.svg === false, result.checks.diagramFallback);
    expect('the fallback explains itself', String(result.checks.diagramFallback.note).includes('图表渲染失败'), result.checks.diagramFallback);

    // ---- streaming keeps finished blocks ----------------------------------
    const streaming = ['```js', 'const answer = 42;', '```', '', '| 列 |', '| --- |', '| 值 |', '', ''].join('\n');
    await set(streaming + '流式文字');
    await evaluate(`(()=>{window.__codeNode=document.querySelector('pre code');window.__tableNode=document.querySelector('.markdown-table-scroll');window.__tableNode.focus();return true})()`);
    await evaluate(`qa.set(${JSON.stringify(streaming + '流式文字继续 **加粗**')})`);
    result.checks.streaming = await evaluate(`(()=>({
      codePreserved: window.__codeNode===document.querySelector('pre code'),
      tablePreserved: window.__tableNode===document.querySelector('.markdown-table-scroll'),
      focusPreserved: document.activeElement===window.__tableNode,
      strong: document.querySelector('.markdown-prose strong')?.textContent ?? null,
    }))()`);
    expect('finished code block DOM is reused', result.checks.streaming.codePreserved === true, result.checks.streaming);
    expect('table scroll container keeps focus', result.checks.streaming.tablePreserved && result.checks.streaming.focusPreserved, result.checks.streaming);
    expect('the new prose still renders', result.checks.streaming.strong === '加粗', result.checks.streaming);

    // ---- width sweep -------------------------------------------------------
    const wide = [
      '| 第一列标题很长 | 第二列 | 第三列 | 第四列 | 第五列 |',
      '| :--- | :---: | ---: | :--- | ---: |',
      '| 内容内容内容内容内容 | b | c | d | e |',
      '| f | g | h | i | j |',
      '',
      '```text',
      'const aVeryLongLineOfCode = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";',
      '```',
      '',
      '$$',
      '\\sum_{i=1}^{n}\\frac{1}{i^2}+\\sqrt{x^2+y^2}+\\int_0^1 f(t)\\,dt = \\alpha\\beta\\gamma\\delta\\epsilon\\zeta\\eta\\theta',
      '$$',
      '',
      'https://example.invalid/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ].join('\n');
    result.checks.widths = [];
    for (const width of [800, 520, 320]) {
      await set(wide, width);
      const metrics = await evaluate(`(()=>{
        const box=element=>element&&({clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,overflowX:getComputedStyle(element).overflowX});
        const viewport=document.querySelector('.message-stream > div');
        return {
          host: box(document.querySelector('.conversation')),
          viewport: box(viewport),
          table: box(document.querySelector('.markdown-table-scroll')),
          code: box(document.querySelector('pre')),
          maths: box(document.querySelector('.katex-display')),
        };
      })()`);
      result.checks.widths.push({ width, ...metrics });
      expect(`width ${width}: transcript does not scroll sideways`, metrics.viewport.clientWidth === metrics.viewport.scrollWidth, metrics);
      if (width === 320) await shot('wide-320-dark');
    }
    const tableScrolls = result.checks.widths.every(entry => entry.table && entry.table.scrollWidth >= entry.table.clientWidth);
    expect('the table keeps its own scroll container at every width', tableScrolls, result.checks.widths);

    // ---- light theme -------------------------------------------------------
    await theme('light');
    await set(basics);
    result.checks.lightTheme = await evaluate(`(()=>({
      theme: document.documentElement.getAttribute('data-theme'),
      background: getComputedStyle(document.body).backgroundColor,
      tokenUsers: document.querySelectorAll('.hljs-keyword').length,
    }))()`);
    expect('light theme still highlights code', result.checks.lightTheme.tokenUsers > 0, result.checks.lightTheme);
    await shot('basics-light');

    expect('renderer logged no console errors', consoleErrors.length === 0, consoleErrors);
    result.status = failures.length === 0 ? 'passed' : 'failed';
    fs.writeFileSync(path.join(__dirname, 'checks.json'), `${JSON.stringify(result, null, 2)}\n`);
    if (failures.length) {
      console.error(JSON.stringify({ status: 'failed', failures }, null, 2));
      app.exit(1);
      return;
    }
    console.log(JSON.stringify({ status: 'passed', checks: result.checks }, null, 2));
    app.exit(0);
  } catch (error) {
    console.error(error.stack);
    console.error(JSON.stringify(consoleErrors));
    app.exit(1);
  } finally {
    clearTimeout(deadline);
    if (win && !win.isDestroyed()) win.destroy();
  }
});
