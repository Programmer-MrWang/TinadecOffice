# TinadecTools / Git：功能与完成情况

模块ID：`TOOLS-GIT` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| TOOLS-GIT-F001 | Git 查询、index、提交、分支、worktree、整合与远端操作 | 源码可见 | 本轮静态核对；未做功能验收 | 查询和写操作具有不同审批、副作用、重试与确认元数据；本轮未执行真实仓库验收。 | [TinadecTools/Tools/Git/GitCli.cs](../../../../../TinadecTools/Tools/Git/GitCli.cs)<br>[tests/TinadecTools.Tests/GitReadToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitReadToolsTests.cs)<br>[tests/TinadecTools.Tests/GitCommitToolTests.cs](../../../../../tests/TinadecTools.Tests/GitCommitToolTests.cs)<br>[tests/TinadecTools.Tests/GitWorktreeToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitWorktreeToolsTests.cs)<br>[tests/TinadecTools.Tests/GitIntegrationToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitIntegrationToolsTests.cs)<br>[tests/TinadecTools.Tests/GitRemoteMutationToolsTests.cs](../../../../../tests/TinadecTools.Tests/GitRemoteMutationToolsTests.cs) |
| TOOLS-GIT-F002 | 保护分支与远端副作用边界 | 范围边界 | 本轮静态核对；未做功能验收 | 存在结构化 Git 与 shell 推送保护；远端 ref 的改变不属于本地工作区快照可保证回滚的范围。 | [TinadecTools/Tools/Command/ProtectedBranchGuard.cs](../../../../../TinadecTools/Tools/Command/ProtectedBranchGuard.cs)<br>[tests/TinadecTools.Tests/ProtectedBranchGuardTests.cs](../../../../../tests/TinadecTools.Tests/ProtectedBranchGuardTests.cs) |

## 状态词汇

- 待核查：尚不能判断是否实现或缺失。
- 源码可见：找到实现路径，仍需验证真实行为。
- 部分实现：已确认目标的一部分存在，剩余范围明确。
- 缺口已确认：当前源码或复现证明缺失；目标与验收见TODO。
- 范围边界：当前平台/产品有意不提供的能力，是否扩展另作范围决策。
- 已验收：有与目标范围相符的运行/测试证据和结果，必须注明提交/环境/日期。
- 不适用：写明原因，不算完成也不算缺陷。

## 下一轮逐功能分析

将聚合行拆成可验收功能，保留旧Feature ID或明确替代关系；为每项记录入口、预期行为、实际行为、成功/失败/权限/取消/恢复场景、对应Task ID。历史报告只写“历史验证，本轮未重跑”。

[本模块TODO](TODO.md) · [功能分析模板](../../../05-templates/FEATURE.md)
