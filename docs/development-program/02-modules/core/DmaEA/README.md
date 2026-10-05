# DmaEA / 双层调用与持久运行引擎

模块ID：`CORE-DMAEA` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 1 受理 / 冻结 / 入队

受理用户消息，创建运行/turn，冻结配置与工作区事实，交给持久引擎。运行过程中不临时重新读可变配置。

- Coordinator · 201 interaction receipt
- 模式、名册、模型、manifest、工作区

### 2 持久运行引擎

推动运行阶段，保存 checkpoint、管理运行租约、处理中断与安全边界上下文补丁。任务级工具并发切片已存在，独立执行子 run 尚未闭环。

- checkpoint / lease / replay / recovery
- queued / parallel / insert · run control

### 3 operation / 计划

按冻结名册和模式职责生成任务图与明确assignee。operation角色可按配置拥有工具面，工具调用仍受manifest、grant及授权约束；不是引擎永久禁止治理层持工具。

- 名册选人、任务 DAG
- 声明边与派发权限

### 4 execution / 执行

执行者按冻结工具与委派包络运行，通过Models调用模型，再使用Core Tools派发工具；可将任务派给许可目标，受深度、预算、资源及权限约束。task_dispatch仍向当前run添加任务。

- 任务、spawn / lineage
- Models→工具回合→证据

### 5 operation / 监督

监督阶段根据事实裁决，重规划继续或升级为 awaiting_user，由用户裁决后恢复。失败任务与未决任务分别记账。

- 检查任务结果与证据
- pass / replan / escalate

### 6 meeting / 最终对话输出

对话身份以执行结果和监督事实形成最终答复。提供方未完成时可先发公开推理/回答预览；正式回答在裁决后落地并替换预览。

- 回答预览 → 正式回答落地
- model.output.* / answer.* → SSE

### 旁路 / 运营与候选演化

运行生命周期在多个anchor触发上下文整理/能力顾问等运营角色，完成阶段可生成记忆/智能体候选。完整演化评估、晋升与canary生命周期未闭环。

- 上下文整理、记忆/智能体候选
- 审查、审计；完整评估/canary 未闭环

## 源码入口

- [TinadecCore/DmaEA/FullDuplexRunCoordinator.cs:241](../../../../../TinadecCore/DmaEA/FullDuplexRunCoordinator.cs#L241)
- [TinadecCore/DmaEA/FullDuplexRunEngine.cs:664](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs#L664)
- [TinadecCore/DmaEA/PlanningAgent.cs](../../../../../TinadecCore/DmaEA/PlanningAgent.cs)
- [TinadecCore/DmaEA/FullDuplexRunEngine.cs](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs)
- [TinadecCore/DmaEA/ModelOutputStream.cs](../../../../../TinadecCore/DmaEA/ModelOutputStream.cs)
- [TinadecCore/DmaEA/DmaEAModuleRegistrar.cs](../../../../../TinadecCore/DmaEA/DmaEAModuleRegistrar.cs)
- [TinadecCore/DmaEA/FullDuplexRunEngine.cs:1541](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1541)
- [TinadecCore/DmaEA/FullDuplexRunEngine.cs:2971](../../../../../TinadecCore/DmaEA/FullDuplexRunEngine.cs#L2971)
- [TinadecCore/DmaEA/RunFreezeGate.cs:24](../../../../../TinadecCore/DmaEA/RunFreezeGate.cs#L24)

## 相关模块

- [AgentConfiguration](../AgentConfiguration/README.md)
- [Models · 模型与 Harness](../Models/README.md)
- [Tools · 工具治理与适配](../Tools/README.md)
- [Context · 本轮输入与补丁](../Context/README.md)
- [Lifecycle · 运行事实与恢复](../Lifecycle/README.md)
- [AgentGraph · 图与资源](../AgentGraph/README.md)
- [TinaChat · 会话组织通信](../TinaChat/README.md)
- [LoopGuard · 防空转与预算](../LoopGuard/README.md)
- [Governance · 授权与审批](../Governance/README.md)
- [Memory · 会话与长期记忆](../Memory/README.md)
- [Gateway / SSE、附件、日志与取消](../../gateway/streaming/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
