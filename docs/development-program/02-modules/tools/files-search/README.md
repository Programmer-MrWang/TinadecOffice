# TinadecTools / 文件与搜索

模块ID：`TOOLS-FILES` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### FileRW / Search · 文件与搜索

统一工作区路径解析与允许根，读写与搜索面分明；文件写还受审批与确认字段约束。

- read / write / 行与字节编辑 / ls / stat
- 路径根、符号链接、文件 hash / ripgrep

## 源码入口

- [TinadecTools/Tools/FileRW/FileSystemTools.cs](../../../../../TinadecTools/Tools/FileRW/FileSystemTools.cs)
- [TinadecTools/Tools/FileRW/FileWriter.cs](../../../../../TinadecTools/Tools/FileRW/FileWriter.cs)
- [tests/TinadecTools.Tests/FileSystemToolsTests.cs](../../../../../tests/TinadecTools.Tests/FileSystemToolsTests.cs)
- [tests/TinadecTools.Tests/FileSearchTests.cs](../../../../../tests/TinadecTools.Tests/FileSearchTests.cs)
- [tests/TinadecTools.Tests/WorkspacePathBoundaryTests.cs](../../../../../tests/TinadecTools.Tests/WorkspacePathBoundaryTests.cs)

## 相关模块

- [AgentGraph · 图与资源](../../core/AgentGraph/README.md)
- [三平台交付、Manager 与更新](../../cross-cutting/delivery-manager/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
