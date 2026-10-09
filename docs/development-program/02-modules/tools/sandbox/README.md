# TinadecTools / 平台沙箱

模块ID：`TOOLS-SANDBOX` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 2026-10-09 存储作用域专项

Windows scope/tier账号与并发ACL；Linux固定bwrap+Landlock；macOS逐保护根；永久host域拒绝。Linux 明确运行 `npm run setup:bwrap` 构建固定源或设置 `TINADEC_TOOLS_BWRAP_PATH`；发布校验0.13.0并复制到Tools同目录，缺失时打包失败。源码工作目录与存储根分开；自由源码目录默认 `~/TinadecProjects`。MCP SDK server 自身为可信程序，其进程不继承文件/shell/search 的 OS 沙箱保证。详见[报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Runtime / Sandbox · 平台执行边界

自动选择平台后端，处理环境清洗、超时与流式命令；取消传播逐平台待验收。Windows 初次低权限账户设置可能需 UAC。不能把不同平台的实现画成同等完整隔离。

- Windows：低权限账户 / ACL / DPAPI / JobObject
- Linux：固定 bubblewrap 0.13.0 + Landlock · macOS：Seatbelt / sandbox-exec
- POSIX 限制写入；读/执行/网络非全面隔离
- Windows 真实 ACL 与 Linux WSL2 命令内核实测见专项证据；新账户/UAC、macOS 与 Linux NativeAOT 仍需独立验收

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

## 2026-10-09 Linux 实机收尾

WSL2 自包含 Debug managed Tools + bwrap 0.13.0 最终 27/27：其中 6 条真实命令内核行为、4 条存储文件行为、17 条策略/载荷构造。修复请求线程退出触发提前 SIGKILL 与普通 bind 使 `/dev/null` 变 nodev；保留精确 grants、PID 隔离及存储分类屏障。终止测试使用实际宿主子进程身份，避免把命名空间 PID 当宿主 PID。[日志](../../../../../.tinadec_dev/reports/linux-storage-validation/dotnet-tools-final-test.log) · [TRX](../../../../../.tinadec_dev/reports/linux-storage-validation/linux-posix-tools-final.trx)。

Linux `.deb`声明`libcap2`并保留Electron依赖；归档检查要求bwrap和运行时的非空x64 ELF字节、执行位与配置资源。小型真实归档专项13/13属于packaging依赖检查，非产品实包验收。Desktop发布每个平台在打包前运行原生TOML/作用域定向测试并上传TRX；本轮仅核查接入代码，未执行CI。

独立Tools持久grant为运行事实，严格原生TOML存放`state/sandbox-grants.toml`，不迁移旧config JSON。受治理调用只使用冻结权限，不能读写或重置此历史。坏文件明确拒绝、链接路径拒绝、原子保存及禁反射source-generation验证见[报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)；完整NativeAOT独立验收。
