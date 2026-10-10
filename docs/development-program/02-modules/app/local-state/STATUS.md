# Desktop / 偏好与布局持久化：功能与完成情况

模块ID：`APP-LOCAL-STATE` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-LOCAL-STATE-F001 | 桌面偏好与按项目/页面布局的本地持久化 | 源码可见 | 本轮静态核对；未做功能验收 | 不保存第二份会话、审批或模型路由权威状态；Web 当前未提供 Electron 磁盘 adapter。 | [apps/desktop/electron/layoutStore.cjs](../../../../../apps/desktop/electron/layoutStore.cjs)<br>[apps/TinadecUI/src/components/useUie.ts](../../../../../apps/TinadecUI/src/components/useUie.ts) |

## 状态词汇

- 待核查：尚不能判断是否实现或缺失。
- 源码可见：找到实现路径，仍需验证真实行为。
- 部分实现：已确认目标的一部分存在，剩余范围明确。
- 缺口已确认：当前源码或复现证明缺失；目标与验收见TODO。
- 范围边界：当前平台/产品有意不提供的能力，是否扩展另作范围决策。
- 已验收：有与目标范围相符的运行/测试证据和结果，必须注明提交/环境/日期。
- 不适用：写明原因，不算完成也不算缺陷。

## 下一轮逐功能分析

将聚合行拆成可验收功能，保留旧Feature ID或明确替代关系；为每项记录入口、预期行为、实际行为、成功/失败/权限/取消/恢复场景、对应Task ID。历史报告只写“历史验证，本轮未重跑”。

## 2026-10-10 工作区专项对照

本模块对多文件夹工作区的改动及源码入口见 [README](README.md)。统一功能与任务由 [APP-HOME-F007](../../app/home/STATUS.md) / [APP-HOME-107](../../app/home/TODO.md#app-home-107) 持有；当前专项验证与未验收平台分别见 [本轮报告](../../../../../.tinadec_dev/reports/2026-10-10-sidebar-workspaces.zh-CN.md)。本模块整体初始审计不因专项测试通过改为已完成。

[本模块TODO](TODO.md) · [功能分析模板](../../../05-templates/FEATURE.md)

## 2026-10-10 接口回归专项

浏览器 preview 只使用隔离本机 UI 状态，明确禁用目录、存储和资源安装；本轮未改变用户 TOML、数据库与登记。宿主恢复状态不作为第二份业务数据权威。

统一范围、验收和边界由 [APP-HOME-107](../home/TODO.md#app-home-107) 与 [接口回归报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md) 持有。源码/组件回归、Windows 隔离 Electron 与真实 Core/Gateway 分别记录；完整 App、安装器和非 Windows 平台不因此标完成。
