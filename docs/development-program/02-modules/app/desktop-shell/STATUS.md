# Desktop / Electron 原生壳：功能与完成情况

模块ID：`APP-DESKTOP` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-DESKTOP-F001 | Electron Desktop 与三平台辅助资源 | 源码可见 | 本轮静态核对；未做功能验收 | 主进程/原生桥/共享 renderer 已存在；服务冒烟不等于全部原生交互完成。 | [apps/desktop/package.json](../../../../../apps/desktop/package.json)<br>[apps/desktop/electron/preload.cjs](../../../../../apps/desktop/electron/preload.cjs)<br>[apps/desktop/scripts/runtimeTargets.mjs](../../../../../apps/desktop/scripts/runtimeTargets.mjs) |
| APP-DESKTOP-F002 | 受控 preload API 暴露原生能力与用户本地终端 | 源码可见 | 2026-10-06 Windows：AppHeader点击三控制调用对应桥动作；窗口/设置专项82/82；其他原生能力保留初始静态判断 | 窗口、对话框、剪贴板、偏好、宠物与终端由 Electron 提供；业务文件和 Git 操作仍经 Gateway/Core/Tools。纯图标控制视觉由共享渲染层APP-RENDERER-F002持有；组件桥调用测试不等于所有原生窗口行为或三平台验收。 | [apps/desktop/electron/preload.cjs](../../../../../apps/desktop/electron/preload.cjs)<br>[apps/desktop/electron/terminalManager.cjs](../../../../../apps/desktop/electron/terminalManager.cjs)<br>[AppHeader.test.ts](../../../../../apps/desktop/src/components/AppHeader.test.ts)<br>[共享渲染专项](../shared-renderer/STATUS.md) |

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

[本模块TODO](TODO.md) · [功能分析模板](../../../05-templates/FEATURE.md)

## 2026-10-10 接口回归专项

main/preload 使用独立宿主认证状态机。恢复 IPC 依据可信文档身份授权，首次失败与运行中瞬断撤权后仍可恢复；身份拒绝不自动重验，退出防迟到。

统一范围、验收和边界由 [APP-HOME-107](../home/TODO.md#app-home-107) 与 [接口回归报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md) 持有。源码/组件回归、Windows 隔离 Electron 与真实 Core/Gateway 分别记录；完整 App、安装器和非 Windows 平台不因此标完成。

宿主 IPC 跟进：生产 main/preload 的真实缺 handler 调用由共享 renderer helper 识别为需要重启，生产 Banner 到达既有可信 restart IPC。Windows 夹具仅拦截两个状态注册及实际 relaunch/exit；未停止用户桌面，也未新改 main/preload。恢复当前注册后重载得到 ready/connected。[证据与替代边界](../../../../../.tinadec_dev/reports/2026-10-10-host-ipc-mismatch.zh-CN.md)。
