# Tenancy · 身份与隔离：功能与完成情况

模块ID：`CORE-TENANCY` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-TENANCY-F001 | 租户范围存储与 context accessor | 源码可见 | 本轮静态核对；未做功能验收 | 开发 identity 仅在 EnableDevelopmentIdentity 时返回固定范围；否则缺验证上下文明确拒绝。生产身份注入及跨租户黑盒验收需另记。 | [TinadecCore/Tenancy/TenancyModuleRegistrar.cs](../../../../../TinadecCore/Tenancy/TenancyModuleRegistrar.cs)<br>[TinadecCore/Tenancy/DevelopmentTenantContextAccessor.cs:15](../../../../../TinadecCore/Tenancy/DevelopmentTenantContextAccessor.cs#L15) |

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
