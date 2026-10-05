# Desktop / 本地服务管理：TODO

模块ID：`APP-SERVICES` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-services-001"></a>

### APP-SERVICES-001 完成 Desktop / 本地服务管理 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-SERVICES
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

- [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)

<a id="app-services-101"></a>

### APP-SERVICES-101 定义 App 与 Manager 的运行时发现和归属交接

- 类型：方案
- 状态：待方案
- 优先级：P2
- 主责模块：APP-SERVICES
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

规范中的机器注册交接未落到当前 serviceManager，需先明确运行时选择、版本及进程归属契约。

**验收条件**

- [ ] 形成内置 runtime 与 Manager 管理 runtime 的发现、选择与版本契约
- [ ] 定义运行时不可用、冲突、回落及诊断行为
- [ ] 定义退出时仅停止 App 拥有的进程，且独立部署仍可使用
- [ ] 实现任务在契约确定后按平台拆分

**初始证据**

- [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)

<a id="app-services-102"></a>

### APP-SERVICES-102 实现并验收 Office 对 Manager 机器注册的受控消费

- 类型：实现
- 状态：未开始
- 优先级：P1
- 主责模块：APP-SERVICES
- 前置依赖：[APP-SERVICES-101](TODO.md#app-services-101) 完成运行时选择、版本和进程归属契约
- 关联功能：APP-SERVICES-F002
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

发布契约要求消费机器注册，App启动仍只读内置runtime，模块发布与实际启动之间缺少交接。

**范围与协作**

本任务唯一持有App读取Manager注册及运行时选择实现；X-DELIVERY持有包与catalog，APP-PACKS/CORE-AGENT-CONFIG持有工作区Pack安装。联合验收引用各自任务，机器注册不替代Core安装状态。

**验收条件**

- [ ] 按契约读取注册并验证受控路径、版本、平台及digest；完整注册使用Manager模块，缺失和不完整的回退策略明确。
- [ ] 真实Manager模块启动Office，错误注册/缺失文件/校验失败不破坏原有版本与数据。
- [ ] 注册AgentPack交Core install-preview/install并遵守owner确认、revision/ETag和幂等，不能直接修改Core DB。
- [ ] 保存跨产品交接与失败路径证据，Manager仓库改动单独关联。

**初始证据**

- [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)
- [apps/desktop/electron/serviceManager.test.cjs](../../../../../apps/desktop/electron/serviceManager.test.cjs)
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../../docs/tinadec-office-release-contract.zh-CN.md)

