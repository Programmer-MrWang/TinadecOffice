# AgentGraph · 图与资源：功能与完成情况

模块ID：`CORE-AGENT-GRAPH` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-AGENT-GRAPH-F001 | 资源账本、环境登记与审批规则 | 源码可见 | 本轮静态核对；未做功能验收 | 具有写范围租约、失活回收、环境 registry、规则服务与证据索引器注册；登记不等于完整资源隔离。 | [TinadecCore/AgentGraph/AgentGraphModuleRegistrar.cs](../../../../../TinadecCore/AgentGraph/AgentGraphModuleRegistrar.cs) |
| CORE-AGENT-GRAPH-F002 | 证据混合回查与正文上限 | 部分实现 | 本轮静态核对；未做功能验收 | 向量/关键词回查已接，正文默认按 MaxContentChars=64000 截断，完整原文不保证保留。 | [TinadecCore/AgentGraph/EvidenceArchiveService.cs:21](../../../../../TinadecCore/AgentGraph/EvidenceArchiveService.cs#L21)<br>[TinadecCore/AgentGraph/EvidenceArchiveService.cs:89](../../../../../TinadecCore/AgentGraph/EvidenceArchiveService.cs#L89)<br>[TinadecCore/AgentGraph/EvidenceArchiveService.cs:160](../../../../../TinadecCore/AgentGraph/EvidenceArchiveService.cs#L160) |
| CORE-AGENT-GRAPH-F003 | 本地执行根绑定与拒绝不明确目标 | 部分实现 | 本轮静态核对；未做功能验收 | 单一 worktree 或带本地根的 local/test/terminal 环境可绑定 provider；多个未绑定 worktree、多个匹配环境及 remote/cloud 无本地绑定时明确拒绝。 | [TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs:36](../../../../../TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs#L36) |

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
