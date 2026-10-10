# Runtime · 唯一组合根：TODO

模块ID：`CORE-RUNTIME` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

2026-10-10 历史工作区挂载专项沿用 [APP-HOME-107](../../app/home/TODO.md#app-home-107)，不另建重复主进度。Windows/SQLite 归档及回收站重启恢复的定向证据见 [统一回归报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md)；Linux/macOS/PostgreSQL 和完整产品仍需独立验收。

<a id="core-runtime-001"></a>

### CORE-RUNTIME-001 完成 Runtime · 唯一组合根 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：CORE-RUNTIME
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

- [TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs:32](../../../../../TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs#L32)

<a id="core-runtime-101"></a>

### CORE-RUNTIME-101 确定剩余治理动作的范围与实施顺序

- 类型：方案
- 状态：待方案
- 优先级：P2
- 主责模块：CORE-RUNTIME
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

统一执行入口对改派、串行化等动作尚无 executor，历史项目级治理写面仍未闭环；不能把报告提出建议记作实际执行。

**验收条件**

- [ ] 列出本期支持的动词、执行者与目标状态所有者，逐项确定权限和会话范围。
- [ ] 改派/串行化应有可观察的执行效果、幂等键、审计和未执行原因。
- [ ] 项目级治理若纳入范围，应单独定义跨会话权限与受控写面。

**初始证据**

- [TinadecCore/Runtime/GovernanceActionExecutor.cs:39](../../../../../TinadecCore/Runtime/GovernanceActionExecutor.cs#L39)

**历史任务映射**

- [docs/agent-graph/review-2026-10-01.zh-CN.md](../../../../agent-graph/review-2026-10-01.zh-CN.md)：N9：治理动作与项目级治理；只作来源，不继承完成勾选
- [docs/agent-graph/todo.zh-CN.md](../../../../agent-graph/todo.zh-CN.md)：N5. 执行者通讯与治理动作；只作来源，不继承完成勾选

