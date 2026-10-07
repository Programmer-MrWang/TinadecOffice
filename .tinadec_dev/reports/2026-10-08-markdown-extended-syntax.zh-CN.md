# 对话流 Markdown：卡片视觉收口与扩展语法

日期：2026-10-08。基线：`main / 66d103e` + 工作树。本批按阶段提交（岛屿渲染与卡片细节、代码高亮与复制、公式/脚注/提示块/锚点、Mermaid）。主责：[APP-HOME-F004 / 103 / 105](../../docs/development-program/02-modules/app/home/TODO.md#app-home-105)。

用户确认的范围：**视觉观感优先**（表格等要有圆角与卡片外观），扩展语法照做，但**不为它拆分多层**——解析、分块、高亮与块级行为都收在 `MarkdownRender.vue` 一个组件里，样式集中在 `styles.css`，唯一新增的子组件是异步渲染图表的 `MarkdownDiagram.vue`。

## 1. 落点

| 文件 | 职责 |
| --- | --- |
| `apps/desktop/src/components/MarkdownRender.vue` | marked 解析 → DOMPurify 片段消毒 → 可信包装（表格滚动容器、标题锚点、脚注本地化）→ 顶层分块 → 渲染；高亮、复制、提示块、锚点点击都在这里 |
| `apps/desktop/src/components/MarkdownDiagram.vue` | Mermaid 懒加载、主题联动、落定后布局、失败回退源码 |
| `apps/desktop/src/styles.css` | markdown 全部视觉：岛屿细节、代码表头与复制、hljs token 配色、提示块、脚注、锚点、公式与图表容器 |
| `apps/desktop/src/locales/{en,zh-CN}.ts` | 10 个新增文案键，两侧同步 |

渲染入口未变：`MessageItem.vue`（历史消息）、`MessageList.vue`（流式回复）、`SpatialWorkCard.vue`（空间详情）继续共用同一组件。

## 2. 视觉部分

参考同级项目（opencode / OpenCodeUI / openchamber / hermes-agent / hermes-studio）：圆角必须落在**外层包裹**上而不是 `<table>`；复制按钮悬停显现；语言标签按需显示。

- 表格、代码、引用、提示块、图表统一复用既有 `UiIslandCard`（12px 圆角、1px 边框、`--surface-section`、柔和阴影、`overflow:hidden` 裁角）；表格在其内满宽，表头加深分隔、行 hover 提亮、末行去边。
- 行内代码圆角对齐参考项目的 4px。
- 代码岛新增表头：左侧语言标签（`text/plaintext` 等无意义时隐藏），右侧复制按钮（悬停/聚焦显现，成功与失败都在按钮上回报）。
- 高亮配色全部取自现有主题变量（`--accent-recovery/success/warning/danger`、`--text-link`、`--text-muted`），亮暗主题与强调色自动跟随，未引入第二套主题表。

## 3. 扩展语法

| 能力 | 实现要点 |
| --- | --- |
| 代码高亮 | `highlight.js` 核心 + 20 个按需语言；按 `语言+正文` 记忆化，流式重解析不重复计算；未知语言静默退化为纯文本 |
| 块级复制 | `navigator.clipboard.writeText`，失败或不可用时回退旧路径；失败时按钮显示"复制失败"而非假装成功 |
| 数学公式 | `katex@0.18` + `marked-katex-extension`（插件 peer 要求 `<0.19`）；`throwOnError:false`、`strict:'ignore'`，display 公式自带横向滚动容器 |
| 脚注 | `marked-footnote`；脚注区标题与"返回引用 n"读屏文案本地化 |
| 提示块 | 自实现 `> [!NOTE/TIP/IMPORTANT/WARNING/CAUTION]`（支持同行自定义标题）：分类图标 + 标题着色 + 正文按类型淡染；普通引用不受影响 |
| 标题锚点 | 注入 `md-` 前缀 id（避免与 `#app` 等页面元素冲突）、重复标题去重、悬停显现的 `#` |
| 锚点跳转 | 应用是 hash 路由，因此点击在组件内 `preventDefault` + `scrollIntoView` + 短暂高亮，绝不改写 URL hash |
| Mermaid | `mermaid@12` 懒加载（只有真的出现图表围栏才引入），按 `data-theme` 用主题 token 重绘；流式围栏等待 250ms 落定、上限 20000 字符；解析失败回退显示源码并提示 |

## 4. 验证

- 定向：`MarkdownRender.test.ts` 15 项、`MarkdownDiagram.test.ts` 3 项、`i18nParity` 5 项全绿。
- 全量：`vitest run` **1028 passed / 14 skipped**（111 文件，1 文件 skip）。
- `vue-tsc --noEmit`：通过。
- **生产 `vite build` 本轮未取得证据**：首次与全量测试并发运行时进程被杀，重跑未执行；不声明构建通过，Mermaid/KaTeX 的打包只由夹具内部的 Vite 构建间接覆盖。
- Electron 夹具（[verify.cjs](../evidence/2026-10-08-markdown-extended/verify.cjs)、[checks.json](../evidence/2026-10-08-markdown-extended/checks.json)）：`passed`，`failures: []`。用真实来源现场打包 SFC + 当前样式表，在真实 Chromium 上验证布局、MathML、Mermaid 与系统剪贴板：
  - 结构：3 个岛屿、0 个材质根、卡片圆角 12px、表格滚动区 `role=region`、语言标签 `js`、高亮 token 存在、标题 id 与锚点 `#md-…` 一致。
  - 复制：真实用户手势下按钮显示"已复制"，`checks.copy.clipboard` 记录到系统剪贴板内容（Windows 规范化换行）。
  - 公式：2 个 KaTeX、2 个 MathML 分支、display 容器 `overflow-x:auto`；800/520/320 三宽度正文视口 `clientWidth === scrollWidth`。
  - 脚注：2 条、标题"脚注"、"返回引用 1"，引用点击后 hash 不变。
  - 提示块：5 种类型 5 张卡，标题"注意 / 自定义标题 / 重要 / 警告 / 危险"，正文淡染，普通引用保持 1 张普通卡。
  - 锚点：重复标题得到 `md-小节一` 与 `md-小节一-2`，点击不改 hash 并标记落点。
  - 图表：4 个节点、真实尺寸 360×406、`role=img`、内含自身样式表；不可解析的图回退显示源码与"图表渲染失败"。
  - 流式：后续文字更新时已完成代码块 DOM 与表格滚动容器（含焦点）保持不变。
  - 三宽度：正文视口无横向溢出；表格/代码/公式各自在卡片内滚动（320px 下代码 `scrollWidth 702` vs `clientWidth 311`）。
  - 亮色主题：`data-theme=light` 下高亮 token 仍在。
  - 渲染进程 console error：0。
- 视觉截图：[基础暗色](../evidence/2026-10-08-markdown-extended/basics-dark.png)、[基础亮色](../evidence/2026-10-08-markdown-extended/basics-light.png)、[提示块](../evidence/2026-10-08-markdown-extended/callouts-dark.png)、[公式](../evidence/2026-10-08-markdown-extended/maths-dark.png)、[图表](../evidence/2026-10-08-markdown-extended/diagram-dark.png)、[320px 宽内容](../evidence/2026-10-08-markdown-extended/wide-320-dark.png)。

## 5. 边界与未做

- **外链打开仍未处理**（用户本轮明确不做）：正文里的 `http(s)` 链接点击仍走浏览器默认导航，`apps/desktop/electron/main.cjs` 没有 `will-navigate` / `openExternal`。夹具的 `will-navigate` 是夹具自身行为，不代表应用已有保护；这一点在上一轮报告里也标注过。
- Mermaid 只在图表围栏落定后渲染，未做 Worker 化；超长图表直接回退源码。密集图与流式高频更新的性能未测。
- 高亮/公式/Mermaid 都未做真实模型回合与长时间流式压测（夹具为固定输入）。
- 未做平台安装包、完整应用 E2E 与 Web 版验收。

## 6. 依赖与一个必须记住的坑

新增运行时依赖：`highlight.js@11.12`、`katex@0.18.10`、`marked-katex-extension@5.1.13`、`marked-footnote@1.4.0`、`mermaid@12.1.0`。

安装 `mermaid` 时 npm 会把仓库锁定的 **`dompurify` 从 3.4.5 顺带升级到 3.4.16**（mermaid 自身要求 `^3.4.12`）。3.4.16 下 `DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true })` 会把**片段的首个元素标签剥掉**（例如首个 `<pre>`/`<h2>` 变成裸 `code`/文本），导致分块判定与既有测试失效。本轮把应用侧的 `dompurify` 固定回 3.4.5（mermaid 的 3.4.16 留在 root，互不影响）。**后续任何人升级依赖后，必须重新确认 markdown 分块与首块标签仍然正确。**

## 7. 提交序列

1. `feat(desktop): 对话流 Markdown 渲染改为内容岛屿并补齐卡片细节`
2. `feat(desktop): 对话流代码块补上语法高亮与块级复制`
3. `feat(desktop): 对话流支持数学公式、脚注、提示块与标题锚点`
4. `feat(desktop): 对话流支持 Mermaid 图表`
5. 本轮证据、文档与剪贴板兜底修复

命令面板与空间布局/路由两批未提交改动保持原样，未混入本批提交（命令面板与本文档批次共享的 `AGENTS.md` 元数据行无法按行拆分，见下）。

说明：`APP-HOME-104` 已被并行的命令面板批次占用，本批任务登记为 `APP-HOME-105`。根 `AGENTS.md`、`apps/desktop/AGENTS.md`、`docs/development-program/AGENTS.md` 的**元数据行**同时描述两个批次（同一行无法拆分提交），各批次正文小节仍各自保留在工作树。
