# Runtime · 唯一组合根：功能与完成情况

模块ID：`CORE-RUNTIME` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-RUNTIME-F001 | 全量模块组合根及跨模块适配 | 源码可见 | 本轮静态核对；未做功能验收 | 装配正式模式、身份边界、模型解析、用户工具动作、恢复、拓扑、唤醒和审批门；也有 Minimal 注册入口。 | [TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs:32](../../../../../TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs#L32) |
| CORE-RUNTIME-F002 | 治理动作执行入口 | 部分实现 | 本轮静态核对；未做功能验收 | 支持 pause/resume/stop run、环境指派和已有 worktree 指派；其他动作返回 action_not_implemented，报告保留未执行。 | [TinadecCore/Runtime/GovernanceActionExecutor.cs:39](../../../../../TinadecCore/Runtime/GovernanceActionExecutor.cs#L39) |
| CORE-RUNTIME-F003 | 启动恢复与持续终态修复 | 源码可见 | 本轮静态核对；未做功能验收 | 区分运行恢复和用户工具动作恢复；源码存在不等于恢复计划 UX 或多宿主恢复完成。 | [TinadecCore/Runtime/RecoveryCoordinator.cs](../../../../../TinadecCore/Runtime/RecoveryCoordinator.cs) |
| CORE-RUNTIME-F004 | 独立存储服务图、原子初始化和宿主登记 | 部分实现 | Windows最终HTTP/日志/向量15/15；真实Electron宿主边界 | 固定scope、全业务API宿主私钥验证、关闭等待租约且可取消、外部模式恢复、实际数据库/host.lock释放；不切换全局当前DB。真实双模型运行与macOS/完整交付矩阵仍待验收。 | [Registry](../../../../../TinadecCore/Runtime/StorageScopeRegistry.cs)<br>[验收账本](../../../../../.tinadec_dev/evidence/2026-10-09-storage/VALIDATION.md) |
| CORE-RUNTIME-F005 | 自由会话转移、关联永久删除和维护编排 | 部分实现 | Windows/Linux配置/迁移、SQLite内容与真实PG预览定向 | 先目标事实后源删除；完整删除journal可恢复；共享grant保留；内容GC/清缓存/删存储独立；SQLite一致备份和PG RepeatableRead行摘要使旧预览失效。硬退出、实际PG销毁/导出与完整业务链未替代。 | [Transfer](../../../../../TinadecCore/Runtime/SessionScopeTransferService.cs)<br>[DataGraph](../../../../../TinadecCore/Runtime/ScopeSessionDataGraph.cs)<br>[平台报告](../../../../../.tinadec_dev/reports/2026-10-09-linux-postgresql-validation.zh-CN.md) |

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
