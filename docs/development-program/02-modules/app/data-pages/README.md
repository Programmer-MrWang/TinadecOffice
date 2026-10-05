# Workbench / 治理与数据页面

模块ID：`APP-DATA` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 运行与治理 / 数据页面

包括正式Workbench运行工作台，展示能力权限、记忆候选、制品与工作区快照/恢复检查。页面存在不表示完整恢复计划 UX 已完成。

- Workbench、治理板、Memory
- Library、快照、恢复检查

## 源码入口

- [apps/desktop/src/router.ts](../../../../../apps/desktop/src/router.ts)
- [apps/desktop/src/pages/WorkbenchPage.vue](../../../../../apps/desktop/src/pages/WorkbenchPage.vue)
- [apps/desktop/src/pages/GovernanceBoardPage.vue](../../../../../apps/desktop/src/pages/GovernanceBoardPage.vue)
- [apps/desktop/src/pages/MemoryPage.vue](../../../../../apps/desktop/src/pages/MemoryPage.vue)
- [apps/desktop/src/pages/SnapshotsPage.vue](../../../../../apps/desktop/src/pages/SnapshotsPage.vue)
- [apps/desktop/src/pages/LibraryPage.vue](../../../../../apps/desktop/src/pages/LibraryPage.vue)
- [apps/desktop/src/pages/RecoveryCheckPage.vue](../../../../../apps/desktop/src/pages/RecoveryCheckPage.vue)
- [docs/architecture-views/overview-2026-10-05/README.zh-CN.md](../../../../architecture-views/overview-2026-10-05/README.zh-CN.md)

## 相关模块

- [Governance · 授权与审批](../../core/Governance/README.md)
- [Memory · 会话与长期记忆](../../core/Memory/README.md)
- [Lifecycle · 运行事实与恢复](../../core/Lifecycle/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
