# DmaEA / 双层调用与持久运行引擎：TODO

模块ID：`CORE-DMAEA` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="core-dmaea-001"></a>

### CORE-DMAEA-001 完成 DmaEA / 双层调用与持久运行引擎 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P1
- 主责模块：CORE-DMAEA
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

- [TinadecCore/DmaEA/FullDuplexRunCoordinator.cs:241](../../../../../TinadecCore/DmaEA/FullDuplexRunCoordinator.cs#L241)
- [TinadecCore/DmaEA/FullDuplexRunEngine.cs:664](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs#L664)
- [TinadecCore/DmaEA/PlanningAgent.cs](../../../../../TinadecCore/DmaEA/PlanningAgent.cs)
- [TinadecCore/DmaEA/FullDuplexRunEngine.cs](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs)
- [TinadecCore/DmaEA/ModelOutputStream.cs](../../../../../TinadecCore/DmaEA/ModelOutputStream.cs)
- [TinadecCore/DmaEA/DmaEAModuleRegistrar.cs](../../../../../TinadecCore/DmaEA/DmaEAModuleRegistrar.cs)

<a id="core-dmaea-101"></a>

### CORE-DMAEA-101 把 task_dispatch 接入持久执行子 run

- 类型：实现
- 状态：未开始
- 优先级：P1
- 主责模块：CORE-DMAEA
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

派发当前只追加父 run 的任务图，尚不能提供完整独立执行、审批、取消和恢复容器。

**验收条件**

- [ ] 真实 task_dispatch 产生 parent_run_id、parent_task_id、run_kind 并冻结子执行配置。
- [ ] 子 run 的审批、取消、恢复和资源授权互相隔离，父控制按已定义语义级联。
- [ ] 子结果和失败证据回流父任务，重启后不会重复派发或重复回流。
- [ ] 拓扑能表达父子关系，兄弟 checkpoint 及用量不会互相污染。

**初始证据**

- [TinadecCore/DmaEA/FullDuplexRunEngine.cs:2971](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs#L2971)
- [TinadecCore/Lifecycle/LifecycleModuleRegistrar.cs:81](../../../../../TinadecCore/Lifecycle/LifecycleModuleRegistrar.cs#L81)

**历史任务映射**

- [docs/agent-graph/review-2026-10-01.zh-CN.md](../../../../agent-graph/review-2026-10-01.zh-CN.md)：N4：执行并发与执行子 run；只作来源，不继承完成勾选
- [docs/agent-graph/todo.zh-CN.md](../../../../agent-graph/todo.zh-CN.md)：N4. 执行并发容器与资源所有权；只作来源，不继承完成勾选

