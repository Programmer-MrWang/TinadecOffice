# Debug Studio / 调试界面：TODO

模块ID：`APP-DEBUG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-debug-001"></a>

### APP-DEBUG-001 完成 Debug Studio / 调试界面 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-DEBUG
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

- [apps/desktop/src/pages/DebugStudioPage.vue](../../../../../apps/desktop/src/pages/DebugStudioPage.vue)

<a id="app-debug-101"></a>

### APP-DEBUG-101 完成真实 trace、metrics、diagnostics 数据到界面的闭环

- 类型：实现
- 状态：未开始
- 优先级：P2
- 主责模块：APP-DEBUG
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

Debug UI 已能发请求，但专用后端仍返回空桩，无法靠真实运行定位各阶段故障。

**验收条件**

- [ ] 先确定真实 trace/metrics/diagnostics schema 与数据采集责任
- [ ] 实际 run 生成可关联阶段、时间及失败的 trace/metrics 数据
- [ ] 界面的会话/时间窗筛选、详情与失败定位使用真实数据
- [ ] 模拟写操作和 breakpoint 的产品范围、身份与权限另行明确

**初始证据**

- [TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs](../../../../../TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs)
- [apps/desktop/src/debug/DebugStudio.vue](../../../../../apps/desktop/src/debug/DebugStudio.vue)

