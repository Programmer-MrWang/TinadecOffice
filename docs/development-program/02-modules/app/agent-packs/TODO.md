# App / AgentPack 内容与安装体验：TODO

模块ID：`APP-PACKS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-packs-102"></a>

### APP-PACKS-102 保留配置校验诊断与 GraphSeedPack 安装失败状态

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：APP-PACKS
- 前置依赖：Core 配置校验遵循过滤唯一索引；测试宿主用户根隔离由 Core 专项负责
- 关联功能：APP-PACKS-F002
- 完成证据：[专项验证](../../../../../.tinadec_dev/evidence/2026-10-09-graphseed-fix/VALIDATION.md)
- 验证边界：实现、传输/状态回归及类型门禁通过；2026-10-09 隔离真实 Core/Gateway + Electron43.3.0 的最新组件源码专项通过，非完整打包 App/安装器验收

**问题与目的**

2026-10-09 用户安装失败四次，Core 日志确认四个实际 PUT 校验失败。Gateway 将 configuration_invalid 改为 conflict 并丢弃 diagnostics；Desktop 仅保留 message/code/status。普通重连还可能将失败覆盖为 deferred，其他窗口无法收到失败终态。目标是保留可操作的诊断，让用户修复原因后显式重试，同时保持 single-flight、跨窗口锁与真实版本冲突恢复。

**触及范围**

Gateway 窄 ProblemDetails 投影及 OpenAPI；Desktop 两个 JSON 请求包装、通知详情与 GraphSeedPack bootstrap。包版本/digest 保持；不清理、覆盖或迁移真实用户根。

**验收条件**

- [x] 配置错误码、类型化 diagnostics 与 trace_id 经实际 Gateway 路由及 Desktop 请求包装保留，未知扩展不进入 UI
- [x] HTTP 400 校验失败不触发安装冲突补偿；普通重连保留 error 且不再次安装
- [x] 显式 Retry 重新预览，并在确认后仅提交一次安装；同窗 pending 请求共享一次尝试
- [x] 跨窗锁后与预览在途收到的失败终态保持，已有窗口向新窗口回传终态
- [x] 原有确认、取消、403 owner、ETag 与 412 并发安装恢复回归通过
- [x] 记录定向测试、类型检查和隔离 UI 验证层级；真实用户数据保持

**最终验收范围（2026-10-09）**

真实 Core/Gateway 使用 owned temp 中的九份用户配置副本。Electron43.3.0运行最新 AgentPacksPanel、NotificationDetailDialog/Island组件源码（Vite编译），沿既有build基础CSS；本任务没有生产样式变更。安装HTTP严格两次PUT：400 configuration_invalid带configuration_unique诊断和trace，修复副本后显式Retry201成功。两次普通reconnect未新增preview/PUT，renderer重载读取GraphSeedPack与原副本中的Bootstrap测试包，不清既有数据。证据为 [UI回执](../../../../../.tinadec_dev/evidence/2026-10-09-graphseed-fix/desktop-ui-acceptance.json)、[真实HTTP序列](../../../../../.tinadec_dev/evidence/2026-10-09-graphseed-fix/desktop-real-http-requests.json) 及专项截图；不据此完成APP-PACKS-001/101、完整App、安装器或三平台验收。

<a id="app-packs-001"></a>

### APP-PACKS-001 完成 App / AgentPack 内容与安装体验 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-PACKS
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

- [apps/desktop/src/agentPacks/GraphSeedPack/manifest.json](../../../../../apps/desktop/src/agentPacks/GraphSeedPack/manifest.json)

<a id="app-packs-101"></a>

### APP-PACKS-101 验收 AgentPack 安装升级与模式切换的真实闭环

- 类型：验收
- 状态：未开始
- 优先级：P2
- 主责模块：APP-PACKS
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

bootstrap 与契约守卫存在，真实多窗口并发、升级冲突和用户自定义保留需产品验收。

**验收条件**

- [ ] 新工作区、重复安装与多窗口/浏览器标签并发安装得到正确幂等结果
- [ ] 延期、新于内置版本、冲突、升级失败均保留准确状态
- [ ] 升级保留用户绑定与不可变发布版本
- [ ] 七模式切换维持同一 meeting 会话身份且冻结配置准确

**初始证据**

- [apps/desktop/src/agentPacks/graphSeedPackBootstrap.ts](../../../../../apps/desktop/src/agentPacks/graphSeedPackBootstrap.ts)
- [apps/desktop/src/agentPacks/GraphSeedPack/manifest.json](../../../../../apps/desktop/src/agentPacks/GraphSeedPack/manifest.json)

