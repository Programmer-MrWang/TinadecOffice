# Home / 会话、对话与投递：TODO

模块ID：`APP-HOME` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-home-001"></a>

### APP-HOME-001 完成 Home / 会话、对话与投递 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-HOME
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

- [apps/desktop/src/controllers/HomeController.ts:22](../../../../../apps/desktop/src/controllers/HomeController.ts#L22)

<a id="app-home-101"></a>

### APP-HOME-101 验收真实消息投递、并行活动与监督决策

- 类型：验收
- 状态：未开始
- 优先级：P1
- 主责模块：APP-HOME
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

源码与组件证据不能替代真实模型下 queued/parallel/insert、审批和监督的产品闭环。

**验收条件**

- [ ] queued 晋升后保留发送时模式、模型、权限及附件
- [ ] 两个 run 同时活动时显示归属正确；切会话迟到事件不覆盖当前会话
- [ ] insert 中断在途请求后读取纠正文本；首轮可查看审批事实并裁决
- [ ] 监督 continue/correct/cancel 均到达对应 Core 状态并清理已回答入口

**初始证据**

- [apps/desktop/src/controllers/HomeController.ts](../../../../../apps/desktop/src/controllers/HomeController.ts)
- [apps/desktop/src/components/chat/LiveTurnBlock.vue](../../../../../apps/desktop/src/components/chat/LiveTurnBlock.vue)

**历史任务映射**

- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：模型中心之外的只读逻辑审查；只作来源，不继承完成勾选

<a id="app-home-102"></a>

### APP-HOME-102 复验首次会话欢迎页附件可用性

- 类型：核查
- 状态：待核查
- 优先级：P1
- 主责模块：APP-HOME
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

历史正式 eval 观察到 welcome 附件置灰；本轮未复现，不能直接声明当前缺陷仍存在。

**验收条件**

- [ ] 在新会话首次发送前确认附件入口的可用条件
- [ ] 记录上传、发送与失败反馈；若复现则保存当前版本及实际错误证据再进入修复

**初始证据**

- [apps/desktop/src/components/WelcomeScreen.vue](../../../../../apps/desktop/src/components/WelcomeScreen.vue)
- [apps/desktop/src/controllers/HomeController.ts](../../../../../apps/desktop/src/controllers/HomeController.ts)

**历史任务映射**

- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：直接观察与代码解释；只作来源，不继承完成勾选

