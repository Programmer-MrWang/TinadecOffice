# VectorStore · 检索底座

模块ID：`CORE-VECTOR` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### VectorStore · 检索底座

已被AgentGraph证据archive用于向量+关键词混合检索；无embedding可降级关键词。Memory当前仅关键词检索，不能声称长期记忆已接向量。

- embedding / 项目向量索引 / 相似检索
- SQLite sqlite-vec / PostgreSQL pgvector

## 源码入口

- [TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs](../../../../../TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs)
- [TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs:41](../../../../../TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs#L41)
- [TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs:65](../../../../../TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs#L65)
- [TinadecCore/AgentGraph/EvidenceArchiveService.cs:160](../../../../../TinadecCore/AgentGraph/EvidenceArchiveService.cs#L160)

## 相关模块

- [AgentGraph · 图与资源](../AgentGraph/README.md)
- [数据、安全与持久化验收](../../cross-cutting/data-security/README.md)
- [Models · 模型与 Harness](../Models/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
