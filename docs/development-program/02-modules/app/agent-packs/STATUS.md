# App / AgentPack 内容与安装体验：功能与完成情况

模块ID：`APP-PACKS` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| APP-PACKS-F001 | GraphSeedPack 制品与 preview/install/upgrade bootstrap | 源码可见 | 本轮静态核对；未做功能验收 | App 持有制品，Core 拥有安装与不可变版本；preview 身份/digest/action、preview_id、ETag/If-Match 有校验。 | [apps/desktop/src/agentPacks/GraphSeedPack/manifest.json](../../../../../apps/desktop/src/agentPacks/GraphSeedPack/manifest.json)<br>[apps/desktop/src/agentPacks/graphSeedPackBootstrap.ts](../../../../../apps/desktop/src/agentPacks/graphSeedPackBootstrap.ts) |
| APP-PACKS-F002 | 安装配置诊断与失败恢复 | 已验收 | 2026-10-09 Windows隔离专项：Gateway97/97、Desktop89/89、类型检查；真实Core/Gateway与Electron43.3.0最新组件源码验证400诊断→普通reconnect无preview/PUT→显式Retry201→重载inventory | 严格公开诊断投影、失败终态与单次显式重试。用户配置仅复制到owned temp；既有build基础CSS，实际组件由Vite编译。非完整打包App/安装器或三平台验收，不折算为F001全闭环完成。 | [APP-PACKS-102](TODO.md#app-packs-102)<br>[专项验证](../../../../../.tinadec_dev/evidence/2026-10-09-graphseed-fix/VALIDATION.md) |

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

App 仅首次可信业务连接触发 GraphSeedPack 检查；普通重连不重放安装。inventory 逐项结算保留旧状态与完整诊断；安装失败 diagnostics/trace_id 经 Gateway 保留；上游提供 ETag 时透传，本次真实配置400和CAS412未提供ETag。3.0.1版本、摘要、确认与幂等规则不变。

统一范围、验收和边界由 [APP-HOME-107](../home/TODO.md#app-home-107) 与 [接口回归报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md) 持有。源码/组件回归、Windows 隔离 Electron 与真实 Core/Gateway 分别记录；完整 App、安装器和非 Windows 平台不因此标完成。
