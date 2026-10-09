# Tools · 工具治理与适配：功能与完成情况

模块ID：`CORE-TOOLS` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-TOOLS-F001 | Core 中的工具治理与提供方派发 | 源码可见 | 本轮静态核对；未做功能验收 | 负责可信调用准备、授权、审批、租约及恢复；实际执行产品 TinadecTools 独立。 | [TinadecCore/Tools/ToolsModuleRegistrar.cs](../../../../../TinadecCore/Tools/ToolsModuleRegistrar.cs)<br>[TinadecCore/Tools/ToolDispatcher.cs](../../../../../TinadecCore/Tools/ToolDispatcher.cs) |
| CORE-TOOLS-F002 | 资源账本到本地 provider 根的绑定 | 部分实现 | 本轮静态核对；未做功能验收 | 支持明确本地目标；平台沙箱、远程 provider 与多目标行为由对应模块/跨模块任务验收，不继承历史未实现或全面隔离标签。 | [TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs](../../../../../TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs) |

## 2026-10-08 工具配置专项

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-TOOLS-F003 | 共享/Agent 配置、托管 MCP 资源及运行冻结 | 已验收 | 实际 SQLite、条件保存、SecretStore 版本、一次准入目录、并发上下文、真实 MCP/共享技能/命令冻结 | PostgreSQL 迁移仅编译，Linux/macOS 未实机；完整批次的失败复查透明记录；对应 CORE-TOOLS-101 | [专项报告](../../../../../.tinadec_dev/reports/2026-10-08-tools-settings.zh-CN.md) |

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
