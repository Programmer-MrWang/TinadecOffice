# TinadecTools / 命令、进程与终端

模块ID：`TOOLS-COMMAND` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Command / Terminal · 命令与进程

一次性与长驻 shell 进入平台沙箱运行时；输出流与终端事件返回 Core，由 Core 投影运行状态。

- command_run / shell / long_lived
- 终端 session / stdin / kill / status / replay
- 超时、取消、输出流与进程状态

## 源码入口

- [TinadecTools/Tools/Command/ShellTool.cs:134](../../../../../TinadecTools/Tools/Command/ShellTool.cs#L134)
- [TinadecTools/Tools/Command/CommandRunner.cs](../../../../../TinadecTools/Tools/Command/CommandRunner.cs)
- [TinadecTools/Tools/Command/ShellTool.cs](../../../../../TinadecTools/Tools/Command/ShellTool.cs)
- [TinadecTools/Runtime/TerminalSessionRunner.cs](../../../../../TinadecTools/Runtime/TerminalSessionRunner.cs)
- [TinadecTools/Runtime/TerminalRunner.cs](../../../../../TinadecTools/Runtime/TerminalRunner.cs)
- [tests/TinadecTools.Tests/ShellToolTests.cs](../../../../../tests/TinadecTools.Tests/ShellToolTests.cs)

## 相关模块

- [TinadecTools / 平台沙箱](../sandbox/README.md)
- [AgentGraph · 图与资源](../../core/AgentGraph/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
