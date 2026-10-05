# Prompts · 提示词组装与版本：TODO

模块ID：`CORE-PROMPTS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="core-prompts-001"></a>

### CORE-PROMPTS-001 完成 Prompts · 提示词组装与版本 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：CORE-PROMPTS
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

- [TinadecCore/Prompts/PromptsModuleRegistrar.cs](../../../../../TinadecCore/Prompts/PromptsModuleRegistrar.cs)

<a id="core-prompts-101"></a>

### CORE-PROMPTS-101 确定提示词版本与效果管理的正式功能范围

- 类型：方案
- 状态：待方案
- 优先级：P2
- 主责模块：CORE-PROMPTS
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

公开 HTTP 面保留 versions/effectiveness/clone/rollback/signals/compare/context-preview 占位，不能把占位当作事实数据。

**验收条件**

- [ ] 逐端点确定保留并实现、明确不可用或删除的正式契约决定。
- [ ] 保留的 versions 返回真实不可变版本；rollback 行为与版本事实一致。
- [ ] 效果指标和 signals 来自真实运行事实；context preview 使用实际组装链且遵守权限。
- [ ] 契约修改同步唯一 v1 快照和客户端，不建立兼容层。

**初始证据**

- [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs:59](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs#L59)
- [TinadecCore/Prompts/PromptsModuleRegistrar.cs:57](../../../../../TinadecCore/Prompts/PromptsModuleRegistrar.cs#L57)

