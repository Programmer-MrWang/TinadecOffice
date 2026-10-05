# Models · 模型与 Harness

模块ID：`CORE-MODELS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Models · 模型与 Harness

提供模型实例、路由与能力；协议适配和外部 agent harness 都归 Models。DmaEA 通过 IAgentChatClientFactory 使用它，不持有具体协议传输实现。

- API SDK / 路由 / 参数 / 密钥引用
- ACP / Headless / TUI / ConPTY

## 源码入口

- [TinadecCore/Models/Harness/AgentChatClientFactory.cs:18](../../../../../TinadecCore/Models/Harness/AgentChatClientFactory.cs#L18)
- [TinadecCore/Models/Harness/AgentChatClientFactory.cs:57](../../../../../TinadecCore/Models/Harness/AgentChatClientFactory.cs#L57)
- [TinadecCore/Models/Harness/ConPtyTerminalHost.cs](../../../../../TinadecCore/Models/Harness/ConPtyTerminalHost.cs)
- [TinadecCore/Models/Harness/Tui/TuiHarnessRunner.cs](../../../../../TinadecCore/Models/Harness/Tui/TuiHarnessRunner.cs)

## 相关模块

- [数据、安全与持久化验收](../../cross-cutting/data-security/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
