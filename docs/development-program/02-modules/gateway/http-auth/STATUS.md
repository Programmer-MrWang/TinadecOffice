# Gateway / HTTP、认证与上下文：功能与完成情况

模块ID：`GW-HTTP` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| GW-HTTP-F001 | HTTP JSON/raw 代理及 local/cloud 认证 | 源码可见 | 本轮静态核对；未做功能验收 | 本地跳过认证，云端 API Key/JWT HS256 与租户上下文；Gateway 不持有业务权威状态。本轮仅静态核对源码，未运行业务测试或产品验收。 | [TinadecGateway/src/auth.ts](../../../../../TinadecGateway/src/auth.ts)<br>[TinadecGateway/src/config.ts](../../../../../TinadecGateway/src/config.ts)<br>[TinadecGateway/src/coreClient.ts](../../../../../TinadecGateway/src/coreClient.ts) |
| GW-HTTP-F002 | 规范错误码、诊断与恢复建议的公开投影 | 已验收 | Windows 2026-10-10，真实app.handle路由和窄投影测试；Gateway全量103/103、OpenAPI快照/schema一致 | 合法snake_case码无需白名单；未知字段/枚举不透传，缺码按4xx/5xx兜底。作用域和目录授权仍由Core/可信宿主负责。关联APP-HOME-107，云端认证/整体GW-HTTP-001未验收。 | [总报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md)<br>[Gateway证据](../../../../../.tinadec_dev/evidence/2026-10-10-interface-regression/gateway-validation.json) |

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
