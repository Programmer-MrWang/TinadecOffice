# Contracts · 对外契约类型

模块ID：`CORE-CONTRACTS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Contracts · 对外契约类型

承载对外契约与类型，不将 MAF 私有类型泄露到持久化或公共 API。网关映射与生成客户端需要同时维护。

- Core-owned DTO / transport contracts
- OpenAPI → Gateway 快照 → 前端类型

## 源码入口

- [TinadecCore/Contracts/TinadecCore.Contracts.csproj](../../../../../TinadecCore/Contracts/TinadecCore.Contracts.csproj)
- [TinadecCore/Contracts/Events/EventEnvelope.cs](../../../../../TinadecCore/Contracts/Events/EventEnvelope.cs)

## 相关模块

- [Gateway / HTTP、认证与上下文](../../gateway/http-auth/README.md)
- [共享渲染层 / 路由与 API](../../app/shared-renderer/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
