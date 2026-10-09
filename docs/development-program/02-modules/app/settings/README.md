# Settings / 配置中心

模块ID：`APP-SETTINGS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Settings / 配置中心

编辑 Core 中的草稿与发布版本，管理模型提供方及参数、包与集成。桌面偏好另存本地。

- 模型、智能体、模式、AgentPack
- 提示词、集成、工作区/偏好

## 源码入口

- [apps/desktop/src/pages/SettingsPage.vue](../../../../../apps/desktop/src/pages/SettingsPage.vue)
- [apps/desktop/src/settings/sections/AgentPacksPanel.vue](../../../../../apps/desktop/src/settings/sections/AgentPacksPanel.vue)
- [apps/desktop/src/api.ts](../../../../../apps/desktop/src/api.ts)

## 相关模块

- [AgentConfiguration](../../core/AgentConfiguration/README.md)
- [Models · 模型与 Harness](../../core/Models/README.md)
- [Skills · 市场与集成配置](../../core/Skills/README.md)
- [Desktop / 偏好与布局持久化](../local-state/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-08 工具配置

工具入口提供九个标签、项目/Agent选择、共享默认及稀疏覆盖、MCP/Skills资源绑定与显式保存。tool_scope仍只在AgentCenter编辑。共享总览按各启用Agent的Core有效配置显示使用者，部分读取失败可诊断且切项目的迟到响应不会覆盖新结果；来源未声明时明确显示该状态。参数通过严格JSON高级编辑器校验，过期保存保留草稿；准入运行冻结生效值。Monaco五类Worker使用Vite的`?worker`入口打包，在真实`app://bundle`生产路径校验补全和错误定位。实施契约见[工具配置](../../../../../.tinadec_dev/specs/2026-10-08-agent-tool-settings.zh-CN.md)，验证见[实施报告](../../../../../.tinadec_dev/reports/2026-10-08-tools-settings.zh-CN.md)。
