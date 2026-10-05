# TinadecUI / UIE Engine

模块ID：`APP-UIE-ENGINE` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### TinadecUI / engine

UIE 是唯一工作台布局系统。engine 不依赖 DOM，处理列/栈/卡片模型、命令总线、布局计算与持久化协议。

- 纯 TS · 布局树 / 命令总线
- reducer、undo、修复/序列化

## 源码入口

- [apps/TinadecUI/src/index.ts:4](../../../../../apps/TinadecUI/src/index.ts#L4)
- [apps/TinadecUI/src/engine/commandBus.ts](../../../../../apps/TinadecUI/src/engine/commandBus.ts)
- [apps/TinadecUI/src/engine/constraints.ts](../../../../../apps/TinadecUI/src/engine/constraints.ts)
- [apps/TinadecUI/src/engine/index.ts](../../../../../apps/TinadecUI/src/engine/index.ts)

## 相关模块

- [TinadecUI / UIE Components](../uie-components/README.md)
- [Desktop / 偏好与布局持久化](../local-state/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
