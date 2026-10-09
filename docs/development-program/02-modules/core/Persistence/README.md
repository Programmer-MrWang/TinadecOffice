# Persistence · 公共存储适配

模块ID：`CORE-PERSISTENCE` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

2026-10-09：存储与配置重构已加入作用域路径、独立数据库/schema、TOML 文档权威、投影和历史版本边界。各平台与真实数据库的验收单独记账，见 [本轮报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-reconstruction.zh-CN.md) 和 [X-DATA-104](../../cross-cutting/data-security/TODO.md#x-data-104)。

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [配置文件权威、投影和历史事实](CONFIGURATION-FILES.md)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Persistence · 公共存储适配

公共数据库配置、内容路径/原子写、密钥引用与 nonce 存储；领域各自拥有 DbContext，当前共有 11 个。

- EF Core 配置 / StoragePaths / ContentStore
- SecretStore / nonce / 原子文件写入

## 源码入口

- [TinadecCore/Persistence/ServiceCollectionExtensions.cs](../../../../../TinadecCore/Persistence/ServiceCollectionExtensions.cs)

## 相关模块

- [数据、安全与持久化验收](../../cross-cutting/data-security/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
