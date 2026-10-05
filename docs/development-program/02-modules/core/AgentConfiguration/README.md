# AgentConfiguration

模块ID：`CORE-AGENT-CONFIG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### AgentConfiguration

管理智能体与模式的版本、包归属与启禁、安装预览和清理；正式版本以不可变快照参与运行。

- agent / mode / pack 生命周期
- 草稿→发布版本→run 冻结

## 源码入口

- [TinadecCore/AgentConfiguration/AgentConfigurationModuleRegistrar.cs](../../../../../TinadecCore/AgentConfiguration/AgentConfigurationModuleRegistrar.cs)
- [TinadecCore/Runtime/FormalModeResolver.cs](../../../../../TinadecCore/Runtime/FormalModeResolver.cs)

## 相关模块

- [Runtime · 唯一组合根](../Runtime/README.md)
- [Models · 模型与 Harness](../Models/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
