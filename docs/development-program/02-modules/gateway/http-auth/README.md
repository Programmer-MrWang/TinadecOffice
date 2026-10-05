# Gateway / HTTP、认证与上下文

模块ID：`GW-HTTP` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### HTTP 门面 / auth / coreClient

云端认证支持API Key/JWT HS256与tenant headers，本地模式跳过认证。coreClient构造上游请求、转发错误，映射器投影前端契约；新增Core字段需同步投影与快照。

- /api/v1 · CORS · tenant headers
- 云模式：API Key / JWT HS256
- snake_case / ProblemDetails
- request id / OpenAPI / Swagger

## 源码入口

- [TinadecGateway/src/auth.ts](../../../../../TinadecGateway/src/auth.ts)
- [TinadecGateway/src/config.ts](../../../../../TinadecGateway/src/config.ts)
- [TinadecGateway/src/coreClient.ts](../../../../../TinadecGateway/src/coreClient.ts)

## 相关模块

- [AspNetCore · 可嵌入 HTTP 层](../../core/AspNetCore/README.md)
- [Tenancy · 身份与隔离](../../core/Tenancy/README.md)
- [Contracts · 对外契约类型](../../core/Contracts/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
