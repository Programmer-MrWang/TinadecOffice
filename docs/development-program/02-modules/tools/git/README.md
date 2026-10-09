# TinadecTools / Git

模块ID：`TOOLS-GIT` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Git · 仓库操作

用安全参数列表调用 Git，读取与写入各有描述、风险与确认约束。远程副作用不能被普通工作区回滚保证覆盖。

- status / diff / log / blame / ref / history
- index / commit / branch / worktree / merge
- fetch / pull / push / discard / 分支保护

## 源码入口

- [TinadecTools/Tools/Git/GitCli.cs](../../../../../TinadecTools/Tools/Git/GitCli.cs)
- [tests/TinadecTools.Tests/GitReadToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitReadToolsTests.cs)
- [tests/TinadecTools.Tests/GitCommitToolTests.cs](../../../../../tests/TinadecTools.Tests/GitCommitToolTests.cs)
- [tests/TinadecTools.Tests/GitWorktreeToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitWorktreeToolsTests.cs)
- [tests/TinadecTools.Tests/GitIntegrationToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitIntegrationToolsTests.cs)
- [tests/TinadecTools.Tests/GitRemoteMutationToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitRemoteMutationToolsTests.cs)
- [TinadecTools/Tools/Command/ProtectedBranchGuard.cs](../../../../../TinadecTools/Tools/Command/ProtectedBranchGuard.cs)
- [tests/TinadecTools.Tests/ProtectedBranchGuardTests.cs](../../../../../tests/TinadecTools.Tests/ProtectedBranchGuardTests.cs)

## 相关模块

- [AgentGraph · 图与资源](../../core/AgentGraph/README.md)
- [Governance · 授权与审批](../../core/Governance/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-08 工具配置接线

各Git工具 timeout_ms/max_output_chars 可稀疏独立覆盖；git_log 默认50、git_log_list默认100，显式分页参数保留。共享保护分支与预算上限不可被Agent放宽，操作内核的更窄上限仍生效。 验证结果与三平台边界见[专项报告](../../../../../.tinadec_dev/reports/2026-10-08-tools-settings.zh-CN.md)。
