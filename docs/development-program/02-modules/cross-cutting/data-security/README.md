# 数据、安全与持久化验收

模块ID：`X-DATA` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 关系状态与向量

DbContext：Tenancy、AgentConfiguration、Lifecycle、Governance、Models、Prompts、Memory、Integration、AgentControl、AgentGraph、TinaChat。各自分区，不代表 11 台数据库。

- SQLite 默认 / PostgreSQL 可选
- 11 个领域 DbContext
- 会话、run、版本、审批、组织
- sqlite-vec / pgvector

### 内容、事件与证据文件

Core-owned data root管理sessions/tasks/events/artifacts/content/vectors/harness-workspaces。正文经内容引用连接关系记录，证据与快照各有生命周期。

- sessions / tasks / events / artifacts
- content / vectors / harness scratch
- SHA-256 引用、原子写
- 正文/快照/日志与运行引用

### 密钥与一次性材料

密钥不作为普通业务字段或事件正文导出；动作审批还关联一次性nonce与参数/manifest身份绑定。Windows默认DPAPI，POSIX默认AES-GCM加密文件。

- provider credential 仅存引用
- Windows DPAPI / 加密 SecretStore
- approval nonce：吊销 / 一次消耗
- 与普通事件、提示词分离

## 源码入口

- [TinadecCore/Persistence/TinadecDatabaseConfigurer.cs](../../../../../TinadecCore/Persistence/TinadecDatabaseConfigurer.cs)
- [TinadecCore/Persistence/StoragePaths.cs:24](../../../../../TinadecCore/Persistence/StoragePaths.cs#L24)
- [TinadecCore/Persistence/SecretStoreFactory.cs](../../../../../TinadecCore/Persistence/SecretStoreFactory.cs)
- [TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj](../../../../../TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj)
- [TinadecCore/Storage.Migrations.PostgreSql/TinadecCore.Storage.Migrations.PostgreSql.csproj](../../../../../TinadecCore/Storage.Migrations.PostgreSql/TinadecCore.Storage.Migrations.PostgreSql.csproj)
- [.github/workflows/core-storage-postgres.yml](../../../../../.github/workflows/core-storage-postgres.yml)
- [TinadecCore/Persistence/LocalFileContentStore.cs](../../../../../TinadecCore/Persistence/LocalFileContentStore.cs)
- [TinadecCore/Persistence/StoragePaths.cs](../../../../../TinadecCore/Persistence/StoragePaths.cs)
- [TinadecCore/Persistence/EncryptedFileSecretStore.cs](../../../../../TinadecCore/Persistence/EncryptedFileSecretStore.cs)
- [TinadecCore/tests/TinadecCore.Governance.Tests/SecretStorePlatformTests.cs](../../../../../TinadecCore/tests/TinadecCore.Governance.Tests/SecretStorePlatformTests.cs)

## 相关模块

- [Persistence · 公共存储适配](../../core/Persistence/README.md)
- [VectorStore · 检索底座](../../core/VectorStore/README.md)
- [Storage.Migrations.Sqlite](../../core/Storage.Migrations.Sqlite/README.md)
- [Storage.Migrations.PostgreSql](../../core/Storage.Migrations.PostgreSql/README.md)
- [Memory · 会话与长期记忆](../../core/Memory/README.md)
- [Lifecycle · 运行事实与恢复](../../core/Lifecycle/README.md)
- [AgentGraph · 图与资源](../../core/AgentGraph/README.md)
- [Models · 模型与 Harness](../../core/Models/README.md)
- [Governance · 授权与审批](../../core/Governance/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
