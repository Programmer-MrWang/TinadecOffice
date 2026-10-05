# 三平台交付、Manager 与更新：功能与完成情况

模块ID：`X-DELIVERY` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| X-DELIVERY-F001 | 三平台安装器、模块包与渠道发布 | 源码可见 | 本轮静态核对；未做功能验收 | win-x64 NSIS/portable、linux-x64 deb、osx-arm64 dmg；模块与AgentPack、catalog、SHA256均有实现。Linux CI已配置apt安装和安装版冒烟，macOS挂dmg运行；本轮未重跑。 | [.github/workflows/desktop-release.yml](../../../../../.github/workflows/desktop-release.yml)<br>[apps/desktop/scripts/runtimeTargets.mjs](../../../../../apps/desktop/scripts/runtimeTargets.mjs)<br>[apps/desktop/scripts/package-office-channel.mjs](../../../../../apps/desktop/scripts/package-office-channel.mjs)<br>[apps/desktop/scripts/verify-office-channel.mjs](../../../../../apps/desktop/scripts/verify-office-channel.mjs)<br>[apps/desktop/scripts/merge-office-channel-catalog.mjs](../../../../../apps/desktop/scripts/merge-office-channel-catalog.mjs) |
| X-DELIVERY-F002 | 应用内更新与发布信任链边界 | 缺口已确认 | 本轮静态核对；未做功能验收 | 应用内 autoUpdater/electron-updater 业务接入未实现；macOS为ad-hoc未公证。完整更新所有者与发布者签名信任链需要方案，不能仅凭SHA256宣布身份可信。 | [apps/desktop/package.json](../../../../../apps/desktop/package.json)<br>[apps/desktop/electron/main.cjs](../../../../../apps/desktop/electron/main.cjs)<br>[apps/desktop/AGENTS.md](../../../../../apps/desktop/AGENTS.md)<br>[docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md) |
| X-DELIVERY-F003 | Manager 机器注册交接尚未接入 App | 缺口已确认 | 本轮静态核对；未做功能验收 | serviceManager当前只取resources/runtime；office-runtime.json注册读取与校验、模块优先及AgentPack交接是契约目标。Manager是仓库外消费者，不能将其源码状态由Office配置推断。App读取注册实现由 [APP-SERVICES-102](../../app/local-services/TODO.md#app-services-102) 持有。 | [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)<br>[docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md) |
| X-DELIVERY-F004 | 本地服务拥有条件采用 URL 规范化 | 范围边界 | 本轮静态核对；未做功能验收 | 需packaged且规范本地Gateway URL；canonicalLocalGatewayUrl也接受http://localhost:48730及尾斜杠，归一为127.0.0.1，不能写只接受精确字面字符串。 | [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)<br>[apps/desktop/electron/serviceManager.test.cjs](../../../../../apps/desktop/electron/serviceManager.test.cjs) |
| X-DELIVERY-F005 | 原生搜索、用户PTY与平台Git资源 | 源码可见 | 本轮静态核对；未做功能验收 | Windows随包PortableGit，POSIX使用系统Git；用户PTY与智能体Tools终端分属不同链路。当前产品发布平台为win-x64/linux-x64/osx-arm64，linux-arm64的rg pin不等于发布支持。 | [scripts/setup-ripgrep.mjs](../../../../../scripts/setup-ripgrep.mjs)<br>[scripts/ripgrep-pin.mjs](../../../../../scripts/ripgrep-pin.mjs)<br>[apps/desktop/scripts/runtimeTargets.mjs](../../../../../apps/desktop/scripts/runtimeTargets.mjs)<br>[apps/desktop/electron/terminalManager.cjs](../../../../../apps/desktop/electron/terminalManager.cjs) |
| X-DELIVERY-F006 | 服务冒烟不覆盖真实终端交互 | 范围边界 | 本轮静态核对；未做功能验收 | 服务健康与工具目录不能证明native pty可加载、实际输入、resize、字体、菜单/托盘或Wayland体验。 | [apps/desktop/scripts/smoke-packaged-posix.mjs](../../../../../apps/desktop/scripts/smoke-packaged-posix.mjs)<br>[apps/desktop/electron/terminalManager.cjs](../../../../../apps/desktop/electron/terminalManager.cjs)<br>[apps/desktop/AGENTS.md](../../../../../apps/desktop/AGENTS.md) |

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
