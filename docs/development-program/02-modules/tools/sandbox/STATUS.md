# TinadecTools / 平台沙箱：功能与完成情况

模块ID：`TOOLS-SANDBOX` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| TOOLS-SANDBOX-F001 | 三平台命令与流式 shell 沙箱入口 | 源码可见 | 本轮静态核对；未做功能验收 | Windows 低权限账户/ACL/DPAPI/JobObject，Linux Landlock，macOS Seatbelt/sandbox-exec；不能沿用 Linux/macOS 未实现的历史标签。 | [TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs](../../../../../TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs)<br>[TinadecTools/Runtime/Sandbox/Windows/WindowsSandboxBackend.cs](../../../../../TinadecTools/Runtime/Sandbox/Windows/WindowsSandboxBackend.cs)<br>[TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs)<br>[tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs](../../../../../tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs) |
| TOOLS-SANDBOX-F002 | 主要限制写入而非全面隔离 | 范围边界 | 本轮静态核对；未做功能验收 | POSIX 读、执行和网络未全面隔离；sandbox-exec 不是公开稳定 Apple API；Linux 进程组终止与 macOS 的进程树终止实现不同。 | [TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs)<br>[TinadecTools/Runtime/Sandbox/Posix/SeatbeltProfile.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/SeatbeltProfile.cs)<br>[TinadecTools/Runtime/Sandbox/Posix/LandlockApi.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/LandlockApi.cs) |

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
