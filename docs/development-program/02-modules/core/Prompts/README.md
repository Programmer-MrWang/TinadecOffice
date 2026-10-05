# Prompts · 提示词组装与版本

模块ID：`CORE-PROMPTS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Prompts · 提示词组装与版本

组装系统职责、版本化提示词片段、工作区及任务证据；流水线发布属于AgentConfiguration，本模块消费冻结流水线和版本片段。

- 系统职责、工作区、任务/证据段
- 版本化片段 + 冻结流水线 + 纯策略

## 源码入口

- [TinadecCore/Prompts/PromptsModuleRegistrar.cs](../../../../../TinadecCore/Prompts/PromptsModuleRegistrar.cs)
- [TinadecCore/Prompts/PromptsModuleRegistrar.cs:57](../../../../../TinadecCore/Prompts/PromptsModuleRegistrar.cs#L57)
- [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs:59](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs#L59)

## 相关模块

- [Context · 本轮输入与补丁](../Context/README.md)
- [Strategies · F# 纯策略](../Strategies/README.md)
- [AgentConfiguration](../AgentConfiguration/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
