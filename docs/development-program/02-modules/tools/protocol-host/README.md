# TinadecTools / 协议、manifest 与执行宿主

模块ID：`TOOLS-PROTOCOL` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### stdio 宿主 / manifest v2 / registry

Core 按 workspace/execution root 管理 Tools 子进程。先取 #manifest 并冻结目录/hash；请求与结果按调用 id 关联，终端事件也走该管道。

- UTF-8 JSON Lines · stdin / stdout · call id
- tool_id / session_id / approved / params
- 工具描述、风险、审批、副作用、重试元数据

### 双层执行约束

工具的 approved 字段来自可信宿主；工具在此基础上检查路径、确认、分支及沙箱约束。两层职责不可混淆。

- Core 授权 → 可信宿主 approved → Tools 校验
- Tools 不读取 Core DB，也不独立裁决 Core 权限

## 源码入口

- [TinadecTools/Abstractions/ToolCalling.cs:11](../../../../../TinadecTools/Abstractions/ToolCalling.cs#L11)
- [TinadecTools/Abstractions/ToolRegistry.cs:117](../../../../../TinadecTools/Abstractions/ToolRegistry.cs#L117)
- [TinadecTools/Program.cs](../../../../../TinadecTools/Program.cs)
- [TinadecTools/Abstractions/ToolCalling.cs](../../../../../TinadecTools/Abstractions/ToolCalling.cs)
- [TinadecTools/Abstractions/ToolRegistry.cs](../../../../../TinadecTools/Abstractions/ToolRegistry.cs)
- [tests/TinadecTools.Tests/ToolManifestTests.cs](../../../../../tests/TinadecTools.Tests/ToolManifestTests.cs)
- [TinadecTools/Runtime/ToolDispatchLoop.cs](../../../../../TinadecTools/Runtime/ToolDispatchLoop.cs)
- [tests/TinadecTools.Tests/ToolDispatchLoopTests.cs](../../../../../tests/TinadecTools.Tests/ToolDispatchLoopTests.cs)
- [TinadecTools/Tools/ToolConfirmations.cs](../../../../../TinadecTools/Tools/ToolConfirmations.cs)

## 相关模块

- [Tools · 工具治理与适配](../../core/Tools/README.md)
- [TinadecTools / 文件与搜索](../files-search/README.md)
- [TinadecTools / Git](../git/README.md)
- [TinadecTools / 命令、进程与终端](../commands-terminals/README.md)
- [TinadecTools / MCP 扩展](../mcp/README.md)
- [TinadecTools / 网络抓取](../web-fetch/README.md)
- [Governance · 授权与审批](../../core/Governance/README.md)
- [TinadecTools / 平台沙箱](../sandbox/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
