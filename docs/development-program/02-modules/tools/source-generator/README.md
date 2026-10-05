# TinadecTools.Generators / 构建期生成器

模块ID：`TOOLS-GENERATOR` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### TinadecTools.Generators · 构建期

生成静态工具注册和参数 schema，由 Tools 工程作为 Analyzer 引用。不是运行中的网络服务或单独进程。

- Roslyn 增量 source generator
- [ToolFunction] → 注册与参数 JSON Schema
- TTG001：缺工具描述告警

## 源码入口

- [TinadecTools.Generators/ToolFunctionGenerator.cs:9](../../../../../TinadecTools.Generators/ToolFunctionGenerator.cs#L9)
- [TinadecTools.Generators/ToolFunctionGenerator.cs](../../../../../TinadecTools.Generators/ToolFunctionGenerator.cs)
- [TinadecTools/TinadecTools.csproj](../../../../../TinadecTools/TinadecTools.csproj)
- [tests/TinadecTools.Tests/ToolManifestTests.cs](../../../../../tests/TinadecTools.Tests/ToolManifestTests.cs)

## 相关模块

- [TinadecTools / 协议、manifest 与执行宿主](../protocol-host/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
