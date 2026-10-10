# Debug Studio / 调试界面：TODO

模块ID：`APP-DEBUG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

最近专项：2026-10-09，d5e6c8d8 + 当前工作树；仅默认关闭与可信宿主准入。

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

<a id="app-debug-102"></a>

### APP-DEBUG-102 默认关闭 Debug Studio 并限制可信主窗口显式打开

- 类型：实现
- 状态：已完成
- 优先级：P2
- 主责模块：APP-DEBUG
- 前置依赖：[APP-SETTINGS-104](../settings/TODO.md#app-settings-104) 提供同一本机偏好入口；复用既有 Electron 主窗口身份校验。
- 关联功能：APP-DEBUG-F002
- 范围：默认隐藏、直接路由准入、跨窗禁用退出、宿主实时重读、可信主窗口限制和关闭已开调试窗口；不改变调试专用后端或用户数据。
- 完成证据：[本轮报告](../../../../../.tinadec_dev/reports/2026-10-09-ui-comments-2.zh-CN.md)、[Renderer/真实路由定向回归](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments-2/debug-preference-tests.md)、[宿主实际 IPC/Node 证据](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments-2/debug-studio-host.md)。

**问题与目的**

调试页面不应作为默认产品导航常驻。用户需要通过关于设置显式启用，并让页面导航、独立窗口与跨窗变更遵守同一本机开关。

**验收条件**

- [x] 缺省/读取失败隐藏侧栏入口，直接 `/debug-studio` 路由转首页；启用后可进入，跨窗禁用后退出。读取/保存竞态不会让迟到值覆盖新状态。
- [x] Electron 仅可信主窗口主 frame 可以保存或打开；打开实时重读布尔配置，辅助窗口/不可信来源/子 frame 不获准，禁用关闭已开调试窗口。
- [x] 保存发出无 payload 跨窗事件，preload 订阅回调只用于刷新并提供 disposer；TOML 源与注释保存边界同设置端契约。
- [x] Windows 浏览器 preview、Renderer19/19及宿主 VM/Node 回归23/23通过；这是具体开关验收，尚未真实 native 窗口/安装包或全平台验证，APP-DEBUG-101专用后端与001整体审计保持未完成。

