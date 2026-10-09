# TinadecTools / 平台沙箱：TODO

模块ID：`TOOLS-SANDBOX` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="tools-sandbox-102"></a>

### TOOLS-SANDBOX-102 存储分类与 scope 沙箱身份

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：TOOLS-SANDBOX
- 关联功能：TOOLS-SANDBOX-F003
- 范围：Windows scope/tier账号与并发ACL；Linux固定bwrap+Landlock；macOS逐保护根；永久host域拒绝。
- 验收：实际文件副作用、冻结边界、拒绝与取消清理；平台证据独立。
- 完成证据：[实施报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。2026-10-09 Windows Tools真实文件/ACL、scope身份与策略构造回归及Node staging4/4；Linux WSL2 self-contained Debug managed最终27/27（6命令内核、4存储行为、17构造），不扩大为NativeAOT/macOS或全部存储读取命令验收。

**验收条件**

- [x] Windows 真实文件/ACL、scope身份与POSIX策略构造定向回归通过。
- [x] 记录 Core 冻结身份接线与固定bubblewrap打包入口；Linux/macOS内核验收独立标明。

<a id="tools-sandbox-001"></a>

### TOOLS-SANDBOX-001 完成 TinadecTools / 平台沙箱 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：TOOLS-SANDBOX
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

已有职责投影和初始源码事实，还没有把每个用户/调用场景逐项拆分并完成实现、测试和运行证据对账。

**验收条件**

- [ ] 拆分STATUS.md中的聚合能力，每个功能分配稳定feature id、明确输入/输出、失败与权限边界。
- [ ] 逐条定位实际实现、活动测试和历史报告；把源码可见、历史验证与本轮验收分别记录。
- [ ] 至少明确成功、错误/取消、权限和持久化/恢复场景中哪些适用；未适用的写出理由。
- [ ] 精化ARCHITECTURE.md中的调用/数据流；每个有向关系提供源码依据，职责关联不冒充编译依赖。
- [ ] 将确认缺口登记独立TODO，写明目标行为、范围、前置依赖和可执行验收条件；无证据的保持待核查。

**初始证据**

- [TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs:19](../../../../../TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs#L19)

<a id="tools-sandbox-101"></a>

### TOOLS-SANDBOX-101 复验三平台真实内核沙箱与缺失机制行为

- 类型：验收
- 状态：待验收
- 优先级：P1
- 主责模块：TOOLS-SANDBOX
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：Linux部分：[最终日志](../../../../../.tinadec_dev/reports/linux-storage-validation/dotnet-tools-final-test.log)、[TRX](../../../../../.tinadec_dev/reports/linux-storage-validation/linux-posix-tools-final.trx)；三平台任务未整体完成。

**问题与目的**

Linux WSL2 基本命令内核行为已实测，Windows 新账户/UAC 与 macOS 内核仍需实机；必须区分写限制与全面隔离。

**验收条件**

- [ ] 三平台一次性与长驻 shell 均证明允许目录可写、越界写被拒和环境变量过滤。
- [ ] 限制机制不可用时明确失败，禁止悄悄退为不受约束执行。
- [x] Linux 验证超时终止实际宿主子进程，区分 PID 命名空间和 zombie 状态。
- [ ] macOS 和 Windows 各自验证子孙进程清理，单列尚未覆盖范围。
- [ ] 报告清晰列出读/执行/网络的实际边界，Windows 首次账户设置与重置另有实机结果。

**初始证据**

- [TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs](../../../../../TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs)
- [tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs](../../../../../tests/TinadecTools.Tests/PosixSandboxIntegrationTests.cs)
- [tests/TinadecTools.Tests/PosixSandboxTests.cs](../../../../../tests/TinadecTools.Tests/PosixSandboxTests.cs)
- [tests/TinadecTools.Tests/SandboxRuntimeTests.cs](../../../../../tests/TinadecTools.Tests/SandboxRuntimeTests.cs)

