# Runtime · 唯一组合根

模块ID：`CORE-RUNTIME` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Runtime · 唯一组合根

负责全模块装配和跨模块适配：身份边界、正式模式、模型策略、用户工具动作、恢复、就绪探针。可选择性装配模块。

- DI 装配 15 个 registrar / 恢复协调
- 模型解析、委托审批、组织唤醒、拓扑

## 源码入口

- [TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs:32](../../../../../TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs#L32)
- [TinadecCore/Runtime/GovernanceActionExecutor.cs:39](../../../../../TinadecCore/Runtime/GovernanceActionExecutor.cs#L39)
- [TinadecCore/Runtime/RecoveryCoordinator.cs](../../../../../TinadecCore/Runtime/RecoveryCoordinator.cs)

## 相关模块

- [Governance · 授权与审批](../Governance/README.md)
- [AgentConfiguration](../AgentConfiguration/README.md)
- [TinaChat · 会话组织通信](../TinaChat/README.md)
- [AgentGraph · 图与资源](../AgentGraph/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
