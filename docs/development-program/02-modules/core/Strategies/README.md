# Strategies · F# 纯策略

模块ID：`CORE-STRATEGIES` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Strategies · F# 纯策略

用纯函数表达可单测策略。存在的状态转移函数不能被当作全部 run 引擎状态的唯一执行权威。

- 上下文预算、prompt 选择、记忆评分
- loop 检测、状态转移函数

## 源码入口

- [TinadecCore/Strategies/TinadecCore.Strategies.fsproj](../../../../../TinadecCore/Strategies/TinadecCore.Strategies.fsproj)

## 相关模块

- [Context · 本轮输入与补丁](../Context/README.md)
- [Memory · 会话与长期记忆](../Memory/README.md)
- [Prompts · 提示词组装与版本](../Prompts/README.md)
- [LoopGuard · 防空转与预算](../LoopGuard/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
