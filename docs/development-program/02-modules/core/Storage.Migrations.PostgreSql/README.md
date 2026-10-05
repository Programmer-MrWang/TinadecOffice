# Storage.Migrations.PostgreSql

模块ID：`CORE-POSTGRES` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Storage.Migrations.PostgreSql

提供 PostgreSQL 持久化迁移与可选数据库部署。存在 CI 不代表本轮重新验证了真实 PostgreSQL。

- PostgreSQL EF migrations
- 可选部署 / pgvector

## 源码入口

- [TinadecCore/Storage.Migrations.PostgreSql/TinadecCore.Storage.Migrations.PostgreSql.csproj](../../../../../TinadecCore/Storage.Migrations.PostgreSql/TinadecCore.Storage.Migrations.PostgreSql.csproj)
- [TinadecCore/Storage.Migrations.PostgreSql/VectorStorePgVector.cs](../../../../../TinadecCore/Storage.Migrations.PostgreSql/VectorStorePgVector.cs)

## 相关模块

- [数据、安全与持久化验收](../../cross-cutting/data-security/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
