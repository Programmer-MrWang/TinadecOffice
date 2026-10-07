# Markdown 显示修复与岛屿卡片

日期：2026-10-07。基线：`main / 66d103e` + 工作树。主责：[APP-HOME-F004 / APP-HOME-103](../../docs/development-program/02-modules/app/home/TODO.md#app-home-103)。用户确认的组织方式：正文连续，代码、表格、引用各自成卡片。

五项显示缺陷已修复，块级内容复用现有 `UiIslandCard`。Card 的 section 表面、12px 圆角、轻边框和柔和阴影来自现有组件及主题 token；正文与对话列保持透明，卡片继承材质，不新增材质根或背景模糊。未增加依赖。

| 修复项 | 结果与本轮证据 |
| --- | --- |
| 列表标记 | 无序 / 嵌套无序 / 有序分别为 disc / circle / decimal，起始编号 3 保留 |
| 任务列表 | checkbox 从约226×34px恢复为13×13px，checked / disabled状态正确，标签与复选框同排 |
| 表格对齐 | 左 / 中 / 右三列表头 computed 对齐正确 |
| 宽表格 | 320px容器中表格约1164px，滚动限制在约311px的表格区域；消息viewport的clientWidth与scrollWidth均为320 |
| 长URL | 320/520/800px三宽度的消息viewport均不被撑宽，正文可折行 |
| 代码 | 保留缩进和等宽字体，在代码块内部横滚；不撑宽消息区 |
| 材质 | 继承祖先半透明section token；卡片无data-panel-effect，backdrop-filter为none |
| 流式更新 | 不完整围栏可显示、补齐正常；后续正文变化保留已完成代码DOM、表格滚动DOM和表格焦点 |

实现位于 [MarkdownRender.vue](../../apps/desktop/src/components/MarkdownRender.vue) 与 [styles.css](../../apps/desktop/src/styles.css)。整篇 Marked 解析后交 DOMPurify 返回片段，保留引用链接与嵌套语义；随后加命名、可聚焦的表格滚动容器，按顶层块复用岛屿组件或连续正文。内容HTML不变的块不再随其他流式文字更新重建。用户消息显示方式与Core消息/运行所有权未变。

本轮验证：

- 定向6文件41项通过；DOM片段类型调整后Markdown5项复跑通过。
- 标准入口 `npm run test -w @tinadec/desktop`：109文件通过、1文件跳过；**979 passed / 14 skipped**，随后native/scripts **107/107**，退出0。
- `npm run build -w @tinadec/desktop`：类型检查与Vite构建通过。保留现有大chunk与第三方注释提示。
- [本地Electron验证器](../evidence/2026-10-07-markdown-islands/verify.cjs) 与 [checks.json](../evidence/2026-10-07-markdown-islands/checks.json)：passed。真实MarkdownRender/UiIslandCard SFC、当前CSS与Tailwind preflight，复刻消息外层；三宽度九组内容、亮暗主题、材质继承、图片与流式DOM/焦点验证通过，renderer错误0、Core/Gateway请求0。源码哈希随证据保存。
- 首次从仓库根用 `vitest --root apps/desktop` 全量时，945项通过、14跳过，5文件因外部raw资源的 `Denied ID` 未加载；这5文件在Desktop目录复跑34/34，最终标准工作区完整入口全部通过。未修改Vite文件访问保护，也未将该次失败归因给Markdown。

视觉证据：[亮色](../evidence/2026-10-07-markdown-islands/basic-light.png)、[暗色](../evidence/2026-10-07-markdown-islands/basic-dark.png)、[窄代码](../evidence/2026-10-07-markdown-islands/code-320.png)、[窄表格](../evidence/2026-10-07-markdown-islands/table-320.png)、[长URL](../evidence/2026-10-07-markdown-islands/long-link-320.png)。截图等有限CSS动画完成后采集，避免主题过渡的旧帧；材质检查也等待真实transition完成。

范围是本地正文显示与组件集成，没有执行真实供应商模型回合、完整应用会话E2E或Linux/macOS安装包验收。语法高亮、公式、Mermaid、脚注、提示块和外链打开仍按[原核查的范围](2026-10-07-flat-markdown-rendering.zh-CN.md)另行处理；这次没有把显示修复写成扩展语法已实现。

设计依据是项目 [UiIslandCard](../../apps/desktop/src/components/ui/island-card.vue) 与 [视觉规范](../../docs/uie-visual-layer-spec.md)。核对官方 [Card组合说明](https://shadcn-vue.com/docs/components/card) 与 [DOMPurify片段配置](https://github.com/cure53/DOMPurify#can-i-configure-dompurify)，最终使用项目已有的岛屿组件和本机已安装API。
