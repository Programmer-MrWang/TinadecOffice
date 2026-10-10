# TinadecUI / UIE Components：功能与完成情况

模块ID：`APP-UIE-COMPONENTS` · 更新日期：2026-10-09 · F003基线：d5e6c8d8 + 当前工作树；其他功能保持各专项范围。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-UIE-COMPONENTS-F001 | UIE 组件、16 卡型与首次激活挂载 | 源码可见 | 本轮静态核对；未做功能验收 | 组件单向依赖 engine；classic/Vapor 是实现边界；最新 Home/Market classic 规避和 ready 修复有历史专项证据，恢复 Vapor 是后续优化选择，不默认算缺功能。 | [apps/TinadecUI/src/components/cards/index.ts](../../../../../apps/TinadecUI/src/components/cards/index.ts)<br>[apps/TinadecUI/src/components/UieCardHost.vue](../../../../../apps/TinadecUI/src/components/UieCardHost.vue)<br>[apps/TinadecUI/src/components/useUie.ts](../../../../../apps/TinadecUI/src/components/useUie.ts) |
| APP-UIE-COMPONENTS-F002 | 空间卡片宿主与临时预览 | 部分实现 | 真实Electron与定向组件用例 | 已接会议/计划/任务/工具/Git/审批；专用测试、浏览器、Figma实时画面待接入 | [首批报告](../../../../../.tinadec_dev/reports/2026-10-06-spatial-mode-first-slice.zh-CN.md) |
| APP-UIE-COMPONENTS-F003 | 窗格合并与面板收起的动作明确性 | 已验收 | 2026-10-09 Windows1169×719实页键盘/悬停Tooltip、两类合并与收起恢复；组件3/3、命令24/24、类型与独立Vite构建通过 | 三按钮28×28/aria/图标对应实际动作；中文运行与英文资源核对；保留所有卡片和收起dock布局。范围为当前开发页面，不是完整安装器或三平台验收 | [主报告](../../../../../.tinadec_dev/reports/2026-10-09-ui-comments.zh-CN.md)<br>[动作及固定参考](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments/pane-actions.md)<br>[组件3/3](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments/browser-tabbar-final.log)<br>[命令24/24](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments/uie-dock-commandbus.log) |

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

## 2026-10-07 目标工作簇专项

第一阶段实现已接手：Desktop969/14 skipped、UIE156、类型/构建和三宽度Electron夹具验证；完整空间模式仍部分实现，真实模型/平台与工具归属证据后续验收。[范围与证据](../../../../../.tinadec_dev/reports/2026-10-07-space-clusters-handoff.zh-CN.md)。
