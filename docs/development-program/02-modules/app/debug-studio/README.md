# Debug Studio / 调试界面

模块ID：`APP-DEBUG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

最近专项：2026-10-09，d5e6c8d8 + 当前工作树；仅默认关闭与可信宿主准入。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Debug Studio / 诊断

已有调试界面，Core运行journal/SSE和回放机制另有实现；但debug traces/spans/metrics/diagnostics仍为空集合，trace detail 404，模拟/breakpoint写501，不能视作完整调试后端。

- 调试界面、时间线/图/指标
- trace / metrics 后端仍为桩

### 2026-10-09 默认关闭与可信宿主准入

Debug Studio 默认隐藏；“设置 → 关于 → 开发者工具”显式启用后才显示侧栏入口。唯一偏好来源是本机稳定 bootstrap `desktop.toml` 的 `[developer] debug_studio_enabled = false`，默认 `~/.tinadec/config/desktop.toml`；`TINADEC_HOME` 可指定 bootstrap 根，不能把它当作项目配置。Gateway 地址由环境变量管理时仍读取这个布尔偏好；非法类型或读取失败保持关闭。

Renderer 使用同一偏好控制侧栏与直接 `/debug-studio` 路由；未启用或读取失败时跳转首页，跨窗口禁用后已在调试页的 Renderer 也退出。Electron `open-debug-studio` 每次重新读取偏好，且只允许可信主窗口的主 frame 发起；未启用或来源不可信返回 false。保存 IPC 同样限制可信主窗口，向存活应用窗口广播无 payload 变更事件；禁用会关闭已打开的 Debug Studio 窗口，preload 订阅提供 disposer。

偏好通过同目录临时文件原子替换保存。常见 table/quoted/dotted/inline 结构局部修改并重新解析核对，保留字段与注释；特殊有效 TOML 形状回退 serializer，保留字段但注释可能丢失。设置端的来源、保存反馈和 pending 状态见 [APP-SETTINGS-104](../settings/TODO.md#app-settings-104)。

[APP-DEBUG-102](TODO.md#app-debug-102)/APP-DEBUG-F002 仅完成上述可见性与准入开关：Windows 浏览器 preview 和宿主 VM/Node 测试已验收，尚未真实 native 窗口或安装包验证。专用调试后端与整体改版继续由 APP-DEBUG-101/001 跟踪；本开关不补齐 trace/metrics 数据。见 [本轮报告](../../../../../.tinadec_dev/reports/2026-10-09-ui-comments-2.zh-CN.md) 与 [宿主证据](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments-2/debug-studio-host.md)。

## 源码入口

- [apps/desktop/src/pages/DebugStudioPage.vue](../../../../../apps/desktop/src/pages/DebugStudioPage.vue)
- [apps/desktop/src/debug/DebugStudio.vue](../../../../../apps/desktop/src/debug/DebugStudio.vue)
- [apps/desktop/src/debug/composables/useTraceData.ts](../../../../../apps/desktop/src/debug/composables/useTraceData.ts)
- [apps/desktop/src/debug/composables/useMetrics.ts](../../../../../apps/desktop/src/debug/composables/useMetrics.ts)
- [TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs](../../../../../TinadecCore/AspNetCore/Endpoints/StubEndpoints.cs)
- [apps/desktop/src/composables/useDebugStudio.ts](../../../../../apps/desktop/src/composables/useDebugStudio.ts)
- [apps/desktop/src/router.ts](../../../../../apps/desktop/src/router.ts)
- [apps/desktop/electron/main.cjs](../../../../../apps/desktop/electron/main.cjs)
- [apps/desktop/electron/appConfig.cjs](../../../../../apps/desktop/electron/appConfig.cjs)

## 相关模块

- [Lifecycle · 运行事实与恢复](../../core/Lifecycle/README.md)
- [Gateway / 配置、市场、治理与组织代理](../../gateway/configuration-organization/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
