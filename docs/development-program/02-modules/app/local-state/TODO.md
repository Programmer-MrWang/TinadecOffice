# Desktop / 偏好与布局持久化：TODO

模块ID：`APP-LOCAL-STATE` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-local-state-001"></a>

### APP-LOCAL-STATE-001 完成 Desktop / 偏好与布局持久化 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-LOCAL-STATE
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

- [apps/desktop/electron/layoutStore.cjs](../../../../../apps/desktop/electron/layoutStore.cjs)

<a id="app-local-state-101"></a>

### APP-LOCAL-STATE-101 验收重启、损坏和历史布局的恢复

- 类型：验收
- 状态：未开始
- 优先级：P2
- 主责模块：APP-LOCAL-STATE
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

源码已有持久化与修复；真实旧 chatroom 布局项、坏文件和多个项目重启还原需要产品证据。

**验收条件**

- [ ] 自定义两个项目的 Home/Market 布局，重启后分别还原
- [ ] 损坏文件有可理解降级且不覆盖未损坏布局
- [ ] 带历史 chatroom 条目的真实布局文件不引发路由或渲染错误
- [ ] undo 不跨项目，继承布局未被无意写回成项目自定义

**初始证据**

- [apps/desktop/electron/layoutStore.cjs](../../../../../apps/desktop/electron/layoutStore.cjs)
- [apps/TinadecUI/src/components/useUie.ts](../../../../../apps/TinadecUI/src/components/useUie.ts)

