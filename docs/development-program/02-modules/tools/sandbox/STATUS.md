# TinadecTools / 平台沙箱：功能与完成情况

模块ID：`TOOLS-SANDBOX` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| TOOLS-SANDBOX-F001 | 三平台命令与流式 shell 沙箱入口 | 源码可见 | 2026-10-09 Linux WSL2 6条真实命令内核回归通过；Windows真实ACL另列 | Linux self-contained Debug managed；NativeAOT、macOS与Windows新账户/UAC未验收。请求线程生命周期和/dev/null修复后正向写、越界拒写、环境及超时终止通过。 | [Linux日志](../../../../../.tinadec_dev/reports/linux-storage-validation/dotnet-tools-final-test.log)<br>[TRX](../../../../../.tinadec_dev/reports/linux-storage-validation/linux-posix-tools-final.trx)<br>[tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs](../../../../../tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs) |
| TOOLS-SANDBOX-F002 | 主要限制写入而非全面隔离 | 范围边界 | 本轮静态核对；未做功能验收 | POSIX 读、执行和网络未全面隔离；sandbox-exec 不是公开稳定 Apple API；Linux 进程组终止与 macOS 的进程树终止实现不同。 | [TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs)<br>[TinadecTools/Runtime/Sandbox/Posix/SeatbeltProfile.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/SeatbeltProfile.cs)<br>[TinadecTools/Runtime/Sandbox/Posix/LandlockApi.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/LandlockApi.cs) |

## 2026-10-09 存储作用域专项

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| TOOLS-SANDBOX-F003 | 存储分类与 scope 沙箱身份 | 源码可见 | 2026-10-09 Windows f8b233d+工作树；Tools定向59/59与最终22/22，Node bwrap staging4/4；Linux27/27（6命令内核、4存储行为、17构造） | 当前用户真实ACL、scope/tier账号身份构造；Linux基本命令边界实测；新账户/UAC、Linux NativeAOT、内部读取屏障完整命令矩阵与macOS仍未验收 | [实施报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md) |

## 状态词汇

2026-10-09追加：独立grant历史移到state原生TOML，Windows定向47/47、禁反射store12/12；Linux libcap2与bwrap/runtime归档检查、小型真实归档Node13/13。发布TOML/作用域门禁已接入代码但未执行CI，packaging依赖检查不等同产品实包或NativeAOT验收，详见[实施报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。

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
