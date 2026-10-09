# TinadecTools / 协议、manifest 与执行宿主：TODO

模块ID：`TOOLS-PROTOCOL` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="tools-protocol-001"></a>

### TOOLS-PROTOCOL-001 完成 TinadecTools / 协议、manifest 与执行宿主 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：TOOLS-PROTOCOL
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

- [TinadecTools/Abstractions/ToolCalling.cs:11](../../../../../TinadecTools/Abstractions/ToolCalling.cs#L11)
- [TinadecTools/Abstractions/ToolRegistry.cs:117](../../../../../TinadecTools/Abstractions/ToolRegistry.cs#L117)

<a id="tools-protocol-101"></a>

### TOOLS-PROTOCOL-101 验收真实工具进程的协议、并发与故障返回

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：TOOLS-PROTOCOL
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

目录握手和调用测试已存在，当前文档工程尚无本轮真实子进程及重启恢复证据。

**验收条件**

- [ ] 从真实 Core provider 启动 Tools，记录 manifest v2、hash、中文参数与正确 call id。
- [ ] 并发只读、两个执行目录写调用和长驻 shell 控制面，响应不串线且控制面可及时返回。
- [ ] 坏 JSON、未知工具、未批准写调用和进程退出产生可理解结果；恢复链路与 Core Tools 模块任务关联。

**初始证据**

- [TinadecTools/Program.cs](../../../../../TinadecTools/Program.cs)
- [TinadecTools/Runtime/ToolDispatchLoop.cs](../../../../../TinadecTools/Runtime/ToolDispatchLoop.cs)
- [tests/TinadecTools.Tests/ToolManifestTests.cs](../../../../../tests/TinadecTools.Tests/ToolManifestTests.cs)
- [tests/TinadecTools.Tests/ToolDispatchLoopTests.cs](../../../../../tests/TinadecTools.Tests/ToolDispatchLoopTests.cs)

<a id="tools-protocol-102"></a>

### TOOLS-PROTOCOL-102 承接 Core 冻结的每调用工具配置

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：TOOLS-PROTOCOL
- 前置依赖：CORE-TOOLS-101
- 关联功能：TOOLS-PROTOCOL-F004
- 范围与验收：独立 execution_context、不可变并发上下文、未传与显式值区分、授权和类别双重限制、窄技能只读根、manifest稳定、只读能力查询及可回收MCP上下文。保存不重启进程，正在执行和待审批命令维持原配置。
- 完成证据：[专项报告](../../../../../.tinadec_dev/reports/2026-10-08-tools-settings.zh-CN.md)、389完整及54最后定向、真实Core进程及命令冻结。平台边界在报告中；整体审计与既有TOOLS-PROTOCOL-101不随之自动完成。

**验收条件**

- [x] 完成任务列出的实现范围及条件保存、冻结配置和资源隔离回归。
- [x] 取得真实 Windows Core/Desktop/Tools 证据；PostgreSQL 及 Linux/macOS 边界单独记录。
- [x] 同步模块说明、API/客户端及共享实施报告，不将专项完成扩大为整体模块验收。
