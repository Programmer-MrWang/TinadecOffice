# 平面对话 Markdown 渲染能力核查

日期：2026-10-07。源码基线：`main / 131388a` + 工作树，具体渲染文件 SHA-256 见 [checks.json](../evidence/2026-10-07-flat-markdown/checks.json)。归属：[APP-HOME / APP-HOME-001](../../docs/development-program/02-modules/app/home/TODO.md#app-home-001)、[APP-RENDERER / APP-RENDERER-001](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-001)。本轮是能力分析，未修改业务代码，也未关闭上述模块审计任务。

**结论：AI 回复可以解析和显示基础 Markdown / GFM，但存在五项可复现的样式缺陷，不能将当前状态描述为完整、正常的 Markdown 渲染体验。** 代码高亮、数学公式、Mermaid、脚注、提示块和标题锚点也尚未实现。

实际链路是 `ChatPanel → MessageList → MessageItem → MarkdownRender`；持久化 AI 回复在 [MessageItem.vue:120](../../apps/desktop/src/components/MessageItem.vue#L120) 渲染，流式回复在 [MessageList.vue:92](../../apps/desktop/src/components/MessageList.vue#L92) 渲染。两者共用 [MarkdownRender.vue:11](../../apps/desktop/src/components/MarkdownRender.vue#L11)：`marked.parse(content, { breaks: true, gfm: true }) → DOMPurify.sanitize → v-html`。本机安装版本为 Marked 18.0.4、DOMPurify 3.4.5。单个换行会生成 `<br>`，这是现有聊天配置的行为。

用户消息在 [MessageItem.vue:170](../../apps/desktop/src/components/MessageItem.vue#L170) 使用 Vue 文本插值，**不会解析 Markdown**。思考过程的 description 和工具详情也有自己的纯文本展示，不能将 AI 回答正文的能力泛化到这些区域。

| 语法 / 能力 | 当前实际行为 |
| --- | --- |
| H1–H6、段落、粗体、斜体、删除线、引用、分隔线 | 组件样本正常生成对应元素；基础字号、间距与颜色存在 |
| 行内代码、围栏代码块 | 正常显示与转义；代码块在自身内部横向滚动 |
| 有序、无序、嵌套列表 | DOM 结构正确，**项目符号和编号不显示** |
| GFM 任务列表 | checked / disabled 状态正确，**复选框尺寸和排版异常**；不提供可编辑任务操作 |
| GFM 表格 | 表格可显示，**对齐标记失效、宽表格溢出** |
| 显式链接、裸 URL、引用链接 | 正常生成 `<a>`；**长 URL 不折行**；打开行为另有缺口 |
| Markdown 图片 | 本地内存图像可加载，1000px 图像在 312px 内容区缩到约 312px；未验证远端图床或工作区图片路径 |
| HTML | 允许 DOMPurify 保留的 HTML，例如 `<details>`；不可执行的 JSON script 标签被移除。不是禁用全部 HTML，也不是完整安全审计 |
| 流式未完成围栏 | 可以先显示未完成代码，后续补齐后正常更新 |
| 代码语法高亮 / 代码块复制 | 没有高亮 token 元素或块级按钮；`language-javascript` 仅为类名 |
| 数学公式 | `$…$` / `$$…$$` 显示为普通文字；没有数学渲染元素 |
| Mermaid | 显示为 `code.language-mermaid`，没有图形 |
| 脚注 | 不生成脚注；样本 `[^1]` 被当成引用链接，定义文本被用作链接目标 |
| GitHub 提示块 | `> [!NOTE]` 仍是含 `[!NOTE]` 的普通引用 |
| 标题锚点 | 标题没有自动 `id`，指向标题的 `#…` 链接没有对应目标 |

**五项已确认的显示缺陷：**

1. **列表没有圆点或序号。** 当前 `styles.css` 导入 Tailwind；安装的 `tailwindcss/preflight.css:197–200` 把 `ol/ul/menu` 设置为 `list-style: none`。[Markdown 列表样式](../../apps/desktop/src/styles.css#L2899) 只恢复缩进和间距，没有恢复标记。实际 UL、嵌套 UL、起始为 3 的 OL 的 computed `list-style-type` 全为 `none`。编号结构虽然留在 DOM，用户看不见编号。
2. **任务复选框套用了文本输入框样式。** [全局 input 样式](../../apps/desktop/src/styles.css#L3292) 设置 `width: 100%`，后续 [input 规则](../../apps/desktop/src/styles.css#L3309) 设置 `height: 34px` 和左右 padding。Markdown 没有局部覆盖。样本中每个 checkbox 实测约 `226 × 34px`，标签挤到下一行。这是已复现的排版缺陷，不能仅凭 DOM 有 checkbox 就标为正常支持。
3. **表格列对齐被覆盖。** Marked 正确生成 `align="left/center/right"`；[styles.css:2968](../../apps/desktop/src/styles.css#L2968) 将所有 th/td 设置为 `text-align: left`。实际三个表头 computed 对齐都是 left。
4. **宽表格没有独立滚动区。** [表格样式](../../apps/desktop/src/styles.css#L2957) 只有 `width: 100%`，无法约束单元格的最小内容宽度。320px 容器内，表格实测约 1169px，整个消息 viewport 的 `scrollWidth` 达 1173px；520px 和 800px 同样溢出。内容可借助整个消息区横向滚动访问，不能称为完全无法查看，但滚动并未限制在表格自身，初始画面只显示左侧几列。
5. **长链接及连续长文本缺少折行约束。** Markdown 正文没有 `overflow-wrap` / `word-break`。本地长 URL 样本的正文宽度为 312px，`scrollWidth` 约 2475px，消息 viewport 达 2479px。三个测试宽度均复现。对照代码块时，`pre` 的 `overflow-x: auto` 正常将滚动限制在自身，消息 viewport 不被撑宽。

截图：[基础内容 / 暗色](../evidence/2026-10-07-flat-markdown/basic-dark.png)、[基础内容 / 亮色](../evidence/2026-10-07-flat-markdown/basic-light.png)、[320px 宽表格](../evidence/2026-10-07-flat-markdown/table-320.png)、[320px 代码块](../evidence/2026-10-07-flat-markdown/code-320.png)、[320px 长链接](../evidence/2026-10-07-flat-markdown/long-link-320.png)、[扩展语法](../evidence/2026-10-07-flat-markdown/extended-dark.png)。

**链接打开与流式性能的补充判断：**

- Markdown 生成普通 `<a>`，没有统一外部打开处理。隔离窗口的默认点击触发了 `will-navigate`，验证器及时阻止导航，没有请求示例域名。产品 [主窗 main.cjs:106](../../apps/desktop/electron/main.cjs#L106) 拒绝创建新窗口，文本右键菜单的打开动作却使用 `window.open`。据此推断，左键外链可能离开应用页面，右键打开可能被主进程拒绝；本轮没有在用户真实主窗中实施导航，后续应单独验收打开行为。相对文件链接也没有工作区路径解析或编辑器定位入口。
- 每次 content 更新都重新解析全部内容、消毒并替换整块 HTML。补齐围栏后，原 code DOM 节点确实被替换。选区、块内滚动和图片加载状态的连续性未验收，不将其写成已经复现的缺陷。
- 隔离 SFC 内每个长度做 5 次 prop 更新，计时包含解析、消毒和 DOM 更新到 `nextTick`，不含完整绘制。1125 / 5625 / 11250 字符样本的中位耗时约 6.6 / 17.0 / 31.9ms；最大约 8.4 / 27.5 / 40.5ms。该结果提示长回复高频更新的成本，**不是完整聊天帧率或真实 token 流基准**。

**验证与边界：**

- `node node_modules/vitest/vitest.mjs run --root apps/desktop src/components/MessageList.test.ts src/components/ChatPanel.test.ts --reporter=dot`：2 个文件、18 项通过，退出 0。这些现有用例覆盖会话组件、消息归属、附件和编辑等，不能替代 Markdown 视觉验收。
- [verify.cjs](../evidence/2026-10-07-flat-markdown/verify.cjs)：通过。Electron 43.3.0 / Chromium 150，编译真实 MarkdownRender SFC，使用当前全局 CSS、MessageList CSS、安装的 Tailwind preflight，并复刻无活动消息的外层结构；320 / 520 / 800px 九组宽内容检查、基础元素、扩展语法、图片、流式更新与轻量计时完成。不是完整 App / ChatPanel 的端到端验收。亮色 computed 背景为白色、正文为 `rgb(31,35,40)`。renderer 错误 0，Core/Gateway 请求 0。
- 现有 Vite 5173 和隔离 Vite 尝试均遇到响应超时，因此最终改为纯本地 SFC 验证；超时没有归因给 Markdown。本轮创建的临时服务已停止，用户原有服务未改动。
- 未修改业务代码，未运行真实模型回合、网络图像、Linux/macOS 或安装包验收，未宣称整仓测试通过。工作树中的空间布局改动属于并行工作，不在本核查范围。

**建议修复顺序：先恢复列表和任务复选框样式，再修表格对齐、表格内部滚动及正文折行。** 这五项可以沿用现有解析器，通过局部样式和必要的表格容器解决。随后完善外链打开、按实际内容需求补代码高亮 / 复制、公式与 Mermaid；脚注、提示块和标题锚点分别作为扩展能力验收。扩展时继续保留现有消毒边界，并补流式未闭合输入与窄宽回归。具体任务状态仍以关联模块 TODO 为唯一入口。
