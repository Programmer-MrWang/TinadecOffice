# TinadecTools / 协议、manifest 与执行宿主：功能与完成情况

模块ID：`TOOLS-PROTOCOL` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| TOOLS-PROTOCOL-F001 | UTF-8 JSON Lines 工具宿主与 manifest v2 | 源码可见 | 本轮静态核对；未做功能验收 | 宿主先取目录与 manifest_hash，再按 call id 关联响应；本轮只核对源码，未复跑真实 Core 子进程链路。 | [TinadecTools/Program.cs](../../../../../TinadecTools/Program.cs)<br>[TinadecTools/Abstractions/ToolCalling.cs](../../../../../TinadecTools/Abstractions/ToolCalling.cs)<br>[TinadecTools/Abstractions/ToolRegistry.cs](../../../../../TinadecTools/Abstractions/ToolRegistry.cs)<br>[tests/TinadecTools.Tests/ToolManifestTests.cs](../../../../../tests/TinadecTools.Tests/ToolManifestTests.cs) |
| TOOLS-PROTOCOL-F002 | 工具控制面与按执行目标分片的写调用串行 | 源码可见 | 本轮静态核对；未做功能验收 | #manifest/#terminal 和只读工具并发，写调用按显式 cwd/worktree key 串行；它与 Core 资源租约和跨进程冲突裁决是不同机制。 | [TinadecTools/Runtime/ToolDispatchLoop.cs](../../../../../TinadecTools/Runtime/ToolDispatchLoop.cs)<br>[tests/TinadecTools.Tests/ToolDispatchLoopTests.cs](../../../../../tests/TinadecTools.Tests/ToolDispatchLoopTests.cs) |
| TOOLS-PROTOCOL-F003 | 可信宿主批准与 Tools 二次约束 | 范围边界 | 本轮静态核对；未做功能验收 | Tools 接收宿主 approved 后继续检查确认字段、路径、保护分支及沙箱，不读取 Core 数据库或独立裁决 Core 用户权限。 | [TinadecTools/Abstractions/ToolRegistry.cs](../../../../../TinadecTools/Abstractions/ToolRegistry.cs)<br>[TinadecTools/Tools/ToolConfirmations.cs](../../../../../TinadecTools/Tools/ToolConfirmations.cs) |

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
