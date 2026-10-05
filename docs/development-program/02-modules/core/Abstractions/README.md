# Abstractions · 跨模块端口

模块ID：`CORE-ABSTRACTIONS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Abstractions · 跨模块端口

跨模块端口是编译边界。模块间运行时调用存在，但不通过互相引用具体实现完成。Abstractions 引用 Contracts。

- 接口、Core 领域类型、模块注册协议
- 业务模块通过接口协作

## 源码入口

- [TinadecCore/Abstractions/TinadecCore.Abstractions.csproj](../../../../../TinadecCore/Abstractions/TinadecCore.Abstractions.csproj)
- [TinadecCore/Abstractions/RunStatus/RunStatusMachine.cs](../../../../../TinadecCore/Abstractions/RunStatus/RunStatusMachine.cs)
- [TinadecCore/Abstractions/RunStatus/RecoveryPolicy.cs](../../../../../TinadecCore/Abstractions/RunStatus/RecoveryPolicy.cs)

## 相关模块

- [Contracts · 对外契约类型](../Contracts/README.md)
- [Runtime · 唯一组合根](../Runtime/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
