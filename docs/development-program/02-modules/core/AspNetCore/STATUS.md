# AspNetCore · 可嵌入 HTTP 层：功能与完成情况

模块ID：`CORE-HTTP` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-HTTP-F001 | 可挂载 HTTP 层 | 源码可见 | 本轮静态核对；未做功能验收 | 该工程引用 Runtime，端点实现归属此层，可供其他 ASP.NET Core 宿主挂载。 | [TinadecCore/AspNetCore/TinadecCore.AspNetCore.csproj](../../../../../TinadecCore/AspNetCore/TinadecCore.AspNetCore.csproj)<br>[TinadecCore/AspNetCore/TinadecCoreHttpExtensions.cs](../../../../../TinadecCore/AspNetCore/TinadecCoreHttpExtensions.cs) |
| CORE-HTTP-F002 | 提示词 HTTP 能力仍有占位 | 缺口已确认 | 本轮静态核对；未做功能验收 | clone/rollback/signals/compare/context-preview 返回 501；versions 返回空；effectiveness 返回零占位，不可计为已实现功能。主责任务：[CORE-PROMPTS-101](../Prompts/TODO.md#core-prompts-101)。 | [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs:59](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs#L59) |
| CORE-HTTP-F003 | 部分审批响应未登记类型 schema | 部分实现 | 本轮静态核对；未做功能验收 | 审批列表/详情委托给返回 IResult 的服务，未通过 Produces 登记响应类型；应进一步核查完整内部快照。 | [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs:70](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs#L70)<br>[TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs) |
| CORE-HTTP-F004 | 工作区逐条可用性与统一错误诊断 | 部分实现 | Windows/SQLite 隔离 API 定向；自宿主 HTTP 诊断8/8；冲突/缺目录API1/1；缺默认模式API1/1 | 列表不挂载运行时，坏登记单独返回分类、恢复动作、trace 与配置诊断；数据库错误保留内部原因并与目录丢失区分。显式 ProblemDetails 补齐缺失分类且保留域字段和原trace；缺默认模式创建/清除拒绝提供设置动作并保持原记录。跨平台与全产品仍待验收。唯一任务 [APP-HOME-107](../../app/home/TODO.md#app-home-107)。 | [Scope endpoints](../../../../../TinadecCore/AspNetCore/Endpoints/StorageScopeEndpoints.cs)<br>[Row error](../../../../../TinadecCore/AspNetCore/StorageScopeRowError.cs)<br>[本轮报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md) |

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
