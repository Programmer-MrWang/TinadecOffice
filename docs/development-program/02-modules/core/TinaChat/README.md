# TinaChat · 会话组织通信

模块ID：`CORE-TINACHAT` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### TinaChat · 会话组织通信

每个会话可形成组织，成员通过它沟通。持久唤醒与运行补丁连接执行者/常驻治理角色；全局聊天室 UI 已移除，Core 只读观察 API 保留。

- 成员、房间、公告板、私聊、计划与报告
- durable wake / 提醒 / 意图采纳与执行交接

## 源码入口

- [TinadecCore/TinaChat/TinaChatModuleRegistrar.cs](../../../../../TinadecCore/TinaChat/TinaChatModuleRegistrar.cs)
- [TinadecCore/TinaChat/TinaChatService.Wakes.cs:129](../../../../../TinadecCore/TinaChat/TinaChatService.Wakes.cs#L129)
- [TinadecCore/TinaChat/TinaChatService.Wakes.cs:221](../../../../../TinadecCore/TinaChat/TinaChatService.Wakes.cs#L221)
- [TinadecCore/Runtime/ExecutorMessageWakeSink.cs](../../../../../TinadecCore/Runtime/ExecutorMessageWakeSink.cs)

## 相关模块

- [DmaEA / 双层调用与持久运行引擎](../DmaEA/README.md)
- [Runtime · 唯一组合根](../Runtime/README.md)
- [AgentGraph · 图与资源](../AgentGraph/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
