# Governance · 授权与审批：功能与完成情况

模块ID：`CORE-GOVERNANCE` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-GOVERNANCE-F001 | 授权决策与策略快照 | 源码可见 | 本轮静态核对；未做功能验收 | PDP、authorization service 与 policy snapshot 由 Governance 拥有；模块单独注册时缺可信上下文的默认 resolver fail-closed。 | [TinadecCore/Governance/GovernanceModuleRegistrar.cs](../../../../../TinadecCore/Governance/GovernanceModuleRegistrar.cs) |
| CORE-GOVERNANCE-F002 | 委托审批门与权限检查为不同责任 | 源码可见 | 本轮静态核对；未做功能验收 | 运行时负责门调度与读取，Governance 负责授权；不能把独立模型裁决理解为可绕过权限、风险或人类专用动作。 | [TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs:79](../../../../../TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs#L79)<br>[TinadecCore/tests/TinadecCore.Api.Tests/ApprovalGateServiceTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/ApprovalGateServiceTests.cs) |

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
