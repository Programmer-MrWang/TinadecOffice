# DmaEA / 双层调用与持久运行引擎：功能与完成情况

模块ID：`CORE-DMAEA` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| CORE-DMAEA-F001 | 准入冻结及持久运行主链 | 源码可见 | 本轮静态核对；未做功能验收 | 主链包含计划、执行、监督和最终回答；配置冻结与模型输出流已有源码，完整业务验收未重跑。 | [TinadecCore/DmaEA/FullDuplexRunCoordinator.cs:241](../../../../../TinadecCore/DmaEA/FullDuplexRunCoordinator.cs#L241)<br>[TinadecCore/DmaEA/FullDuplexRunEngine.cs](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs) |
| CORE-DMAEA-F002 | 独立工具任务并发推进 | 部分实现 | 本轮静态核对；未做功能验收 | 任务私有 checkpoint 合并与审批过期驻留传播已有，不能据此称执行子 run 已交付。 | [TinadecCore/DmaEA/FullDuplexRunEngine.cs:1541](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1541) |
| CORE-DMAEA-F003 | task_dispatch 当前写入同一 run 任务图 | 缺口已确认 | 本轮静态核对；未做功能验收 | ApplyPendingTaskDispatchesAsync 把任务加入 checkpoint.Tasks；尚未从这条路径创建独立执行子 run。 | [TinadecCore/DmaEA/FullDuplexRunEngine.cs:2971](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs#L2971) |
| CORE-DMAEA-F004 | operation 工具面由模式声明决定 | 源码可见 | 本轮静态核对；未做功能验收 | operation 永久零工具闸已移除，不能沿用旧图的禁工具解释；实际派发仍受声明与授权约束。 | [TinadecCore/DmaEA/RunFreezeGate.cs:24](../../../../../TinadecCore/DmaEA/RunFreezeGate.cs#L24) |

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
