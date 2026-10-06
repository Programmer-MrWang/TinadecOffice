# 共享渲染层 / 路由与 API：功能与完成情况

模块ID：`APP-RENDERER` · 更新日期：2026-10-06 · 本轮专项基线：905d003 + 当前工作树；F001 保留初始清点判断。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-RENDERER-F001 | App、路由、API、状态与通知组合层 | 源码可见 | 本轮静态核对；未做功能验收 | 展示 Core 返回事实；Home/Market 页面 ready 控制 splash；连接重试不重挂主页面。 | [apps/desktop/src/App.vue](../../../../../apps/desktop/src/App.vue)<br>[apps/desktop/src/router.ts](../../../../../apps/desktop/src/router.ts)<br>[apps/desktop/src/api.ts](../../../../../apps/desktop/src/api.ts) |
| APP-RENDERER-F002 | 分类搜索浮窗与沉浸式窗口控制 | 已验收 | 2026-10-06 Windows组件与自动测试专项：窗口/设置82/82；本轮整合911 passed/14 skipped、native/scripts107/107 | 点击搜索直接打开默认760×590自适应浮窗，可选全屏；10类＋全部、分类/结果图标、每组4项预览、展开/收起与文字省略。窗口控制与搜索入口为ghost纯图标，无背景/阴影，保留焦点与no-drag。范围是当前授权目录；会话按标题与项目名匹配，不检索历史消息全文或全磁盘文件名。最终定向48/48、类型/构建和真实Electron浮窗专项通过；模块整体审计未完成，取消错误与窄宽发送任务未关闭。 | [APP-RENDERER-103](TODO.md#app-renderer-103)<br>[CommandPalette.vue](../../../../../apps/desktop/src/components/CommandPalette.vue)<br>[spotlight.ts](../../../../../apps/desktop/src/lib/spotlight.ts)<br>[pageRequests.ts](../../../../../apps/desktop/src/lib/pageRequests.ts)<br>[CommandPalette.test.ts](../../../../../apps/desktop/src/components/CommandPalette.test.ts)<br>[spotlight.test.ts](../../../../../apps/desktop/src/lib/spotlight.test.ts)<br>[AppHeader.test.ts](../../../../../apps/desktop/src/components/AppHeader.test.ts) |
| APP-RENDERER-F003 | 会话级空间模式与运行事实投影 | 部分实现 | Desktop917/14 skipped、定向组件及Electron专项 | 开关组合执行、完整工作产物与真实模型端到端尚未完成；见APP-RENDERER-104 | [首批报告](../../../../../.tinadec_dev/reports/2026-10-06-spatial-mode-first-slice.zh-CN.md) |

## 2026-10-06 搜索专项范围

本轮完整证据：[搜索浮窗与窗口控制报告](../../../../../.tinadec_dev/reports/2026-10-06-search-and-window-chrome.zh-CN.md)。专项完成不代表模块整体已验收。

补充交互：分类横向滚动指示器已隐藏但仍可滚动；右侧 UIE 标签中键关闭属于同一渲染交互专项，固定 Home 标签不关闭。

- 可搜索命令、活跃项目、全项目活跃会话、模型提供方/配置模型、智能体、模式、提示词片段、工具、设置与当前工作区文件内容。提示词读取实际片段目录；工具匹配交给 Core 搜索接口。
- 各远端来源独立读取，5秒超时并可取消；一个来源失败仍展示其他来源结果与失败提示。当前工作区内容走受治理的 `grepContent`，最多100条匹配行，按文件去重并展示服务端截断提示，不能把行上限描述为100个文件。
- 点击/Enter共用结果动作，通过一次性页面请求定位 Home 项目/会话、Code 文件和 Settings 对应配置项；不再在顶栏展开第二个搜索输入。
- 上述专项验收不代表历史消息全文搜索、全磁盘索引、全部业务链或其他平台交互已完成。

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
