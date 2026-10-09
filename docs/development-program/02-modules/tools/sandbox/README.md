# TinadecTools / 平台沙箱

模块ID：`TOOLS-SANDBOX` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Runtime / Sandbox · 平台执行边界

自动选择平台后端，处理环境清洗、超时与流式命令；取消传播逐平台待验收。Windows 初次低权限账户设置可能需 UAC。不能把不同平台的实现画成同等完整隔离。

- Windows：低权限账户 / ACL / DPAPI / JobObject
- Linux：Landlock · macOS：Seatbelt / sandbox-exec
- POSIX 限制写入；读/执行/网络非全面隔离
- 实现与测试代码存在；本轮未做账户/内核实测

## 源码入口

- [TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs:19](../../../../../TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs#L19)
- [TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs](../../../../../TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs)
- [TinadecTools/Runtime/Sandbox/Windows/WindowsSandboxBackend.cs](../../../../../TinadecTools/Runtime/Sandbox/Windows/WindowsSandboxBackend.cs)
- [TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/PosixSandboxBackend.cs)
- [tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs](../../../../../tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs)
- [TinadecTools/Runtime/Sandbox/Posix/SeatbeltProfile.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/SeatbeltProfile.cs)
- [TinadecTools/Runtime/Sandbox/Posix/LandlockApi.cs](../../../../../TinadecTools/Runtime/Sandbox/Posix/LandlockApi.cs)

## 相关模块

- [TinadecTools / 命令、进程与终端](../commands-terminals/README.md)
- [AgentGraph · 图与资源](../../core/AgentGraph/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-08 工具配置接线

平台沙箱能力和解释器可用性通过宿主只读能力查询展示。行为配置不能扩大Core已有资源授权；Tools继续验证实际路径及执行能力。共享技能包只读根不扩展沙箱写入授权。 验证结果与三平台边界见[专项报告](../../../../../.tinadec_dev/reports/2026-10-08-tools-settings.zh-CN.md)。
