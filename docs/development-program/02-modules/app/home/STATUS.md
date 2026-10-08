# Home / 会话、对话与投递：功能与完成情况

模块ID：`APP-HOME` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-HOME-F001 | 项目、会话、附件及 queued/parallel/insert 消息投递协调 | 源码可见 | 本轮静态核对；未做功能验收 | 发送前记录权限；队列晋升保留模式、模型、权限和附件。本轮仅静态核对源码，未运行业务测试或产品验收。 | [apps/desktop/src/controllers/HomeController.ts](../../../../../apps/desktop/src/controllers/HomeController.ts) |
| APP-HOME-F002 | 按 run 归属的活动、首轮 live block、审批与监督裁决入口 | 源码可见 | 本轮静态核对；未做功能验收 | 界面实现存在，真实并行与三个监督决策本轮未验收。 | [apps/desktop/src/controllers/HomeController.ts](../../../../../apps/desktop/src/controllers/HomeController.ts)<br>[apps/desktop/src/components/chat/LiveTurnBlock.vue](../../../../../apps/desktop/src/components/chat/LiveTurnBlock.vue) |
| APP-HOME-F003 | Home 初始布局就绪与 splash 入场同步 | 源码可见 | 本轮静态核对；未做功能验收 | 最新修复已有历史专项验证；本轮未重跑，不重复登记为未修缺陷。 | [apps/desktop/src/pages/HomePage.vue](../../../../../apps/desktop/src/pages/HomePage.vue)<br>[apps/desktop/src/App.vue](../../../../../apps/desktop/src/App.vue)<br>[docs/home-entry-motion-2026-10-05.zh-CN.md](../../../../home-entry-motion-2026-10-05.zh-CN.md) |
| APP-HOME-F004 | AI历史/流式正文的Markdown显示、岛屿卡片与扩展语法 | 已验收 | 2026-10-08：Electron 夹具 passed（真实剪贴板、MathML、Mermaid、三宽度）、定向 23、Desktop 全量 1028 passed/14 skipped、类型检查通过；生产 vite build 本轮未取证 | 岛屿与卡片细节、代码高亮与复制、公式、脚注、提示块、标题锚点、Mermaid 均已接通；非真实模型或完整 App E2E，外链打开仍未处理，Mermaid 未 Worker 化。 | [APP-HOME-103](TODO.md#app-home-103)<br>[APP-HOME-105](TODO.md#app-home-105)<br>[扩展语法报告](../../../../../.tinadec_dev/reports/2026-10-08-markdown-extended-syntax.zh-CN.md) |

## 2026-10-08 输入框命令面板

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-HOME-F005 | +与/统一命令面板及会话运行设置 | 已验收 | Desktop1024/14 skipped、native107、Gateway80、Core存储19与空间脚本API14、真实SFC/Electron与类型/构建 | 本地功能验收；非完整Home审计、外部模型/PG实机或平台安装包验收 | [APP-HOME-104](TODO.md#app-home-104)、[实施记录](../../../../../.tinadec_dev/reports/2026-10-08-command-panel.zh-CN.md) |

2026-10-08命令面板细节修订：选择器图标与权限风险色、紧凑布局、150ms切页过渡、选项/Enter自动关闭和点击外部关闭已修；109项定向、类型检查与实际SFC浏览器验证通过。见[细节修复记录](../../../../../.tinadec_dev/reports/2026-10-08-command-panel-polish.zh-CN.md)。

## 状态词汇

- 待核查：尚不能判断是否实现或缺失。
- 源码可见：找到实现路径，仍需验证真实行为。
- 部分实现：已确认目标的一部分存在，剩余范围明确。
- 缺口已确认：当前源码或复现证明缺失；目标与验收见TODO。
- 范围边界：当前平台/产品有意不提供的能力，是否扩展另作范围决策。
- 已验收：有与目标范围相符的运行/测试证据和结果，必须注明提交/环境/日期。
- 不适用：写明原因，不算完成也不算缺陷。

## 下一轮逐功能分析

将聚合行拆成可验收功能，保留旧Feature ID或明确替代关系；为每项记录入口、预期行为、实际行为、成功/失败/权限/取消/恢复场景、对应Task ID。历史报告只写“历史验证，本轮未重跑”。

[本模块TODO](TODO.md) · [功能分析模板](../../../05-templates/FEATURE.md)
