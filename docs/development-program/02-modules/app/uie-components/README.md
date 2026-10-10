# TinadecUI / UIE Components

模块ID：`APP-UIE-COMPONENTS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### TinadecUI / components

Vue组件单向依赖engine。16卡型（新增 spatialWork）：nav/chat/homePicker/git/approval/orchestration/organization/events/doctor/browser/agent/terminal/marketFilter/marketCatalog/marketDetail。classic/Vapor是渲染实现细节。

- UieCanvas / Column / Stack
- CardHost、卡片、响应式 store

## 源码入口

- [apps/TinadecUI/src/index.ts:6](../../../../../apps/TinadecUI/src/index.ts#L6)
- [apps/TinadecUI/src/components/cards/index.ts](../../../../../apps/TinadecUI/src/components/cards/index.ts)
- [apps/TinadecUI/src/components/UieCardHost.vue](../../../../../apps/TinadecUI/src/components/UieCardHost.vue)
- [apps/TinadecUI/src/components/useUie.ts](../../../../../apps/TinadecUI/src/components/useUie.ts)

## 相关模块

- [TinadecUI / UIE Engine](../uie-engine/README.md)
- [共享渲染层 / 路由与 API](../shared-renderer/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-09 窗格动作明确性

[APP-UIE-COMPONENTS-F003](STATUS.md) / [APP-UIE-COMPONENTS-101](TODO.md#app-uie-components-101) 将两种合并与面板收起明确区分，任务保持待验收。

| 入口 | 动作与保留状态 | 呈现 |
| --- | --- | --- |
| BrowserTabBar 主面板 | `mergeDockColumn` 把全部窗格合成主面板，保留全部卡片和主面板当前标签 | `PanelsTopLeft`，合并全部窗格 |
| UieStack 分窗格 | `mergeDockPane` 仅把此窗格合回主面板，保留其卡片 | `Combine`，合并此窗格到主面板 |
| BrowserTabBar 收起 | `collapseColumn` 收起整列，保留卡片与分窗布局 | `PanelRightClose`，收起面板（保留窗格布局） |

三个原生按钮使用独立的英中文案、`aria-label`、隐藏装饰图标与28×28点击区域；Tooltip采用精确依赖`reka-ui@2.11.0`的官方Provider/Root/Trigger as-child/Portal/Content，避免旧简易tooltip仅鼠标和被overflow裁剪的问题。布局命令、数据所有者及持久化格式保持原契约。

本轮BrowserTabBar组件3/3、UIE命令24/24和类型检查通过，真实页面已确认三按钮尺寸、aria与图标区别。键盘Tooltip、两个合并动作和收起的真实页面状态验证继续取证，不据定向测试声明完整验收。详见[主报告](../../../../../.tinadec_dev/reports/2026-10-09-ui-comments.zh-CN.md)与[动作/固定参考/定向证据](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments/pane-actions.md)。
