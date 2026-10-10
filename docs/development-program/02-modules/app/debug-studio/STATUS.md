# Debug Studio / 调试界面：功能与完成情况

模块ID：`APP-DEBUG` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

最近专项：2026-10-09，d5e6c8d8 + 当前工作树；仅默认关闭与可信宿主准入。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-DEBUG-F001 | Debug Studio 前端存在，部分专用后端仍是桩 | 部分实现 | 本轮静态核对；未做功能验收 | MapDebugStubs 的 trace/metrics/diagnostics 返回空集合，trace detail 404，模拟/breakpoint 写返回 501；已有 Core journal/SSE 不等于专用调试后端完成。 | [apps/desktop/src/debug/DebugStudio.vue](../../../../../apps/desktop/src/debug/DebugStudio.vue)<br>[apps/desktop/src/debug/composables/useTraceData.ts](../../../../../apps/desktop/src/debug/composables/useTraceData.ts)<br>[apps/desktop/src/debug/composables/useMetrics.ts](../../../../../apps/desktop/src/debug/composables/useMetrics.ts)<br>[TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs](../../../../../TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs) |

## 2026-10-09 默认关闭与可信宿主准入

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-DEBUG-F002 | 本机开发者开关控制默认隐藏、路由与独立调试窗口准入 | 已验收 | Windows 浏览器 preview；Renderer19/19（实际router守卫/监听）；宿主 VM/Node23/23，包含配置/IPC10项 | 2026-10-09，d5e6c8d8 + 工作树；仅对应APP-DEBUG-102，可信主窗口开关/打开、禁用退出与关闭。尚未真实 native 窗口/安装包验证；APP-DEBUG-F001仍部分实现，101专用后端与001整体审计未完成。 | [本轮报告](../../../../../.tinadec_dev/reports/2026-10-09-ui-comments-2.zh-CN.md)<br>[Renderer证据](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments-2/debug-preference-tests.md)<br>[宿主证据](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments-2/debug-studio-host.md) |

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
