# Context · 本轮输入与补丁

模块ID：`CORE-CONTEXT` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Context · 本轮输入与补丁

准备本轮模型输入，读取项目指令与实际工作区 skill 文件，分配上下文预算并应用安全边界补丁。完整事件驱动压缩尚未闭环。

- 上下文 pack / 项目指令 / SKILL.md
- 预算裁剪、共享与 run-scoped patch

## 源码入口

- [TinadecCore/Context/ContextModuleRegistrar.cs](../../../../../TinadecCore/Context/ContextModuleRegistrar.cs)
- [TinadecCore/Context/ContextModuleRegistrar.cs:57](../../../../../TinadecCore/Context/ContextModuleRegistrar.cs#L57)
- [TinadecCore/Context/ContextModuleRegistrar.cs:242](../../../../../TinadecCore/Context/ContextModuleRegistrar.cs#L242)
- [TinadecCore/Context/ContextModuleRegistrar.cs:526](../../../../../TinadecCore/Context/ContextModuleRegistrar.cs#L526)

## 相关模块

- [Prompts · 提示词组装与版本](../Prompts/README.md)
- [Memory · 会话与长期记忆](../Memory/README.md)
- [Strategies · F# 纯策略](../Strategies/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
