# Debug Studio / 调试界面

模块ID：`APP-DEBUG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Debug Studio / 诊断

已有调试界面，Core运行journal/SSE和回放机制另有实现；但debug traces/spans/metrics/diagnostics仍为空集合，trace detail 404，模拟/breakpoint写501，不能视作完整调试后端。

- 调试界面、时间线/图/指标
- trace / metrics 后端仍为桩

## 源码入口

- [apps/desktop/src/pages/DebugStudioPage.vue](../../../../../apps/desktop/src/pages/DebugStudioPage.vue)
- [apps/desktop/src/debug/DebugStudio.vue](../../../../../apps/desktop/src/debug/DebugStudio.vue)
- [apps/desktop/src/debug/composables/useTraceData.ts](../../../../../apps/desktop/src/debug/composables/useTraceData.ts)
- [apps/desktop/src/debug/composables/useMetrics.ts](../../../../../apps/desktop/src/debug/composables/useMetrics.ts)
- [TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs](../../../../../TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs)

## 相关模块

- [Lifecycle · 运行事实与恢复](../../core/Lifecycle/README.md)
- [Gateway / 配置、市场、治理与组织代理](../../gateway/configuration-organization/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
