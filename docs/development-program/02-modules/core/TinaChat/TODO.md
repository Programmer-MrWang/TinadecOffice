# TinaChat · 会话组织通信：TODO

模块ID：`CORE-TINACHAT` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="core-tinachat-001"></a>

### CORE-TINACHAT-001 完成 TinaChat · 会话组织通信 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：CORE-TINACHAT
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

- [TinadecCore/TinaChat/TinaChatModuleRegistrar.cs](../../../../../TinadecCore/TinaChat/TinaChatModuleRegistrar.cs)

<a id="core-tinachat-101"></a>

### CORE-TINACHAT-101 设计执行者通讯回执与离线待办协议

- 类型：方案
- 状态：待方案
- 优先级：P2
- 主责模块：CORE-TINACHAT
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

现有消息唤醒接入原 run 的补丁，成员独立持久回合与明确回复确认仍需定义。

**验收条件**

- [ ] 定义来源消息、领取、执行回合、回复回执和完成的持久状态。
- [ ] 失败/取消/崩溃后重试不丢输入，也不重复已有回复副作用。
- [ ] 离线/旧 run 的 inbox 保留，并定义何时移交到新执行回合。
- [ ] 100 条突发提醒可追溯全部消费或显式待处理；权限限制不放宽。

**初始证据**

- [TinadecCore/TinaChat/TinaChatService.Wakes.cs:221](../../../../../TinadecCore/TinaChat/TinaChatService.Wakes.cs#L221)
- [TinadecCore/Runtime/ExecutorMessageWakeSink.cs](../../../../../TinadecCore/Runtime/ExecutorMessageWakeSink.cs)

**历史任务映射**

- [docs/agent-graph/review-2026-10-01.zh-CN.md](../../../../agent-graph/review-2026-10-01.zh-CN.md)：N5：执行者通讯；只作来源，不继承完成勾选
- [docs/agent-graph/todo.zh-CN.md](../../../../agent-graph/todo.zh-CN.md)：O5. 唤醒泛化；只作来源，不继承完成勾选
- [docs/agent-graph/todo.zh-CN.md](../../../../agent-graph/todo.zh-CN.md)：N5. 执行者通讯与治理动作；只作来源，不继承完成勾选

