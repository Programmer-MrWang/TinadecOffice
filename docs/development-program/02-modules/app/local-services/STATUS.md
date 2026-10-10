# Desktop / 本地服务管理：功能与完成情况

模块ID：`APP-SERVICES` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-SERVICES-F001 | 读取内置 runtime 并管理本地 Core/Gateway | 源码可见 | 本轮静态核对；未做功能验收 | 仅 packaged 且 Gateway 配置为符合规范且可规范化的本地URL（http localhost/127.0.0.1:48730，允许尾斜杠）时拥有服务；Tools 进程归 Core；已按平台处理数据根与进程树。 | [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs) |
| APP-SERVICES-F002 | Manager 机器注册交接尚未接通 | 缺口已确认 | 本轮静态核对；未做功能验收 | 当前实现只读取 resources/runtime；Manager 是仓库外消费者，不应默认成为强制产品依赖。主责任务：[APP-SERVICES-101](TODO.md#app-services-101) → [APP-SERVICES-102](TODO.md#app-services-102)。 | [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)<br>[docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md) |

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

dev 启动必须 Core、Gateway 和身份验证共同就绪，移除仅 Core 健康的回退。认证重验不自动停止未知服务，也不据健康超时重复启动受管服务；本地服务意外退出的自动拉起仍属独立生命周期范围。

统一范围、验收和边界由 [APP-HOME-107](../home/TODO.md#app-home-107) 与 [接口回归报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md) 持有。源码/组件回归、Windows 隔离 Electron 与真实 Core/Gateway 分别记录；完整 App、安装器和非 Windows 平台不因此标完成。

宿主 IPC 跟进：现场旧 main 启动早于新 IPC 源码，Vite 重载不能更新主进程。DEV 恢复指引要求关闭开发进程、从仓库根重新 npm run dev；旧 app.relaunch 会触发 launcher 停止 Vite/同组服务，不作为整链恢复。未改启动器或自动重启用户服务。[源码时间对照与证据](../../../../../.tinadec_dev/reports/2026-10-10-host-ipc-mismatch.zh-CN.md)。
