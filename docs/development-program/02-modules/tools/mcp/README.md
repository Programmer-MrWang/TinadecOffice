# TinadecTools / MCP 扩展

模块ID：`TOOLS-MCP` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### MCP · 外部工具扩展

当前实现是 stdio MCP client。浏览器等工具可由配置的外部 MCP server 提供；此处不假设自带浏览器自动化或 A2A 运行模块。

- server 配置 / stdio 连接池
- list / search / invoke · invoke 审批闸
- 由 Tools 启动/连接外部 MCP server

## 源码入口

- [TinadecTools/Tools/Mcp/McpClientPool.cs:63](../../../../../TinadecTools/Tools/Mcp/McpClientPool.cs#L63)
- [TinadecTools/Tools/Mcp/McpClientPool.cs](../../../../../TinadecTools/Tools/Mcp/McpClientPool.cs)
- [TinadecTools/Tools/Mcp/McpInvokeTool.cs](../../../../../TinadecTools/Tools/Mcp/McpInvokeTool.cs)
- [TinadecTools/Tools/Mcp/McpRuntime.cs](../../../../../TinadecTools/Tools/Mcp/McpRuntime.cs)
- [tests/TinadecTools.Tests/McpPassThroughTests.cs](../../../../../tests/TinadecTools.Tests/McpPassThroughTests.cs)
- [TinadecTools/Tools/Mcp/McpModels.cs](../../../../../TinadecTools/Tools/Mcp/McpModels.cs)

## 相关模块

- [Skills · 市场与集成配置](../../core/Skills/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-08 托管MCP资源

Core管理共享/项目stdio服务器及SecretStore凭据引用，既有文件非破坏导入。ToolHost托管模式只消费每次调用冻结资源。连接按资源、版本、命令及环境指纹复用；当前调用/运行保留旧连接租约，释放后回收。独立Tools仍支持文件配置。市场安装与删除经Core治理动作作用于同一资源库。
