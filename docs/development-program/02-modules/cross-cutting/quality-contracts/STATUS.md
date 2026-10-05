# 质量、契约与验收门禁：功能与完成情况

模块ID：`X-QUALITY` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| X-QUALITY-F001 | 活动测试、架构门禁与契约漂移链 | 源码可见 | 本轮静态核对；未做功能验收 | 活动 .NET 测试是 Core Architecture/AgentFramework/Api/Governance 与 Tools；另有 Gateway/ Desktop/UIE/native/scripts。契约由 Core OpenAPI、Gateway快照和前端生成类型验证；本轮未复跑。 | [TinadecOffice.slnx](../../../../../TinadecOffice.slnx)<br>[TinadecCore/TinadecCore.slnx](../../../../../TinadecCore/TinadecCore.slnx)<br>[TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs)<br>[.github/workflows/contracts-drift.yml](../../../../../.github/workflows/contracts-drift.yml)<br>[apps/desktop/package.json](../../../../../apps/desktop/package.json) |
| X-QUALITY-F002 | 旧 Contracts.Tests 仅作遗留需求证据 | 范围边界 | 本轮静态核对；未做功能验收 | 依赖已删除旧 src，不在活动解决方案且不可构建，不能计入当前活动测试或作验证锚点。 | [tests/Tinadec.Contracts.Tests/README.md](../../../../../tests/Tinadec.Contracts.Tests/README.md)<br>[tests/Tinadec.Contracts.Tests/Tinadec.Contracts.Tests.csproj](../../../../../tests/Tinadec.Contracts.Tests/Tinadec.Contracts.Tests.csproj)<br>[TinadecOffice.slnx](../../../../../TinadecOffice.slnx) |
| X-QUALITY-F003 | 审批响应 schema 登记缺口由 Core AspNetCore 主任务负责 | 缺口已确认 | 本轮静态核对；未做功能验收 | approvals 主端点返回 Task<IResult> 且无 DTO Produces，生成客户端未出现 ApprovalResponseDto；此处仅交叉引用 Core AspNetCore 的实现任务，不复制质量模块任务。 | [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs)<br>[TinadecCore/AspNetCore/ControlPlaneService.cs](../../../../../TinadecCore/AspNetCore/ControlPlaneService.cs)<br>[apps/desktop/src/generated/schema.d.ts](../../../../../apps/desktop/src/generated/schema.d.ts) |

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
