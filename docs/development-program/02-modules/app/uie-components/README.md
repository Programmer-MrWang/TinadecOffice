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
