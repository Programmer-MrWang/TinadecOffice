# TinadecTools / 命令、进程与终端：TODO

模块ID：`TOOLS-COMMAND` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="tools-command-001"></a>

### TOOLS-COMMAND-001 完成 TinadecTools / 命令、进程与终端 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：TOOLS-COMMAND
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

- [TinadecTools/Tools/Command/ShellTool.cs:134](../../../../../TinadecTools/Tools/Command/ShellTool.cs#L134)

<a id="tools-command-101"></a>

### TOOLS-COMMAND-101 验收智能体一次性和长驻命令生命周期

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：TOOLS-COMMAND
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

需从真实工具调用确认及时输出、交互、超时、取消、重放与资源释放，组件存在不足以证明终端可用。

**验收条件**

- [ ] 专门复验POSIX一次性调用取消：当前ExecuteAsync只对timeout token等待，记录调用ct是否能中断实际进程及管道；未取得运行证据前不宣告整链根因。
- [ ] 一次性与长驻命令分别覆盖首帧、stdout/stderr、stdin、状态查询、超时、取消和 kill。
- [ ] Core 记录的终端状态与实际进程相符，重放能关联正确会话与调用。
- [ ] 结束后核查子进程与管道清理；平台沙箱限制由 sandbox 主任务验收。

**初始证据**

- [TinadecTools/Runtime/TerminalSessionRunner.cs](../../../../../TinadecTools/Runtime/TerminalSessionRunner.cs)
- [TinadecTools/Runtime/TerminalRunner.cs](../../../../../TinadecTools/Runtime/TerminalRunner.cs)
- [tests/TinadecTools.Tests/TerminalRunnerTests.cs](../../../../../tests/TinadecTools.Tests/TerminalRunnerTests.cs)
- [tests/TinadecTools.Tests/ShellToolTests.cs](../../../../../tests/TinadecTools.Tests/ShellToolTests.cs)

