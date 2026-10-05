# LoopGuard · 防空转与预算

模块ID：`CORE-LOOP-GUARD` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### LoopGuard · 防空转与预算

ILoopGuard判断任务轮数/token/调用数/连错与重复指纹；空响应和run总token预算在引擎。预算耗尽可收走工具并要求总结，目标未完成须保留事实。

- 重复调用 / 连错 / 迭代与调用上限
- 任务 token 预算；配合引擎收尾

## 源码入口

- [TinadecCore/LoopGuard/LoopGuardModuleRegistrar.cs](../../../../../TinadecCore/LoopGuard/LoopGuardModuleRegistrar.cs)
- [TinadecCore/LoopGuard/LoopGuardModuleRegistrar.cs:37](../../../../../TinadecCore/LoopGuard/LoopGuardModuleRegistrar.cs#L37)

## 相关模块

- [DmaEA / 双层调用与持久运行引擎](../DmaEA/README.md)
- [Strategies · F# 纯策略](../Strategies/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
