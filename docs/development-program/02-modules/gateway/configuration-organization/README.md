# Gateway / 配置、市场、治理与组织代理

模块ID：`GW-CONFIG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 配置 / 市场 / 模型

前端配置与市场路由族，包括harness与model-routes；不存在/api/v1/skills字面路由。发布/安装/模型绑定业务规则由Core完成。

- agents / modes / packs / prompts
- model-settings / providers / routes
- market / extensions / MCP / ACP

### 治理 / 组织 / 诊断

组织与 TinaChat 契约分别有同步生成的接口/路由表；审批、拓扑与调试仍是 Core 权威。

- approvals / permission / snapshots
- organization / TinaChat / topology
- debug / memory / evolution

## 源码入口

- [TinadecGateway/src/index.ts](../../../../../TinadecGateway/src/index.ts)
- [TinadecGateway/src/organizationRoutes.ts](../../../../../TinadecGateway/src/organizationRoutes.ts)
- [TinadecGateway/src/marketProxy.test.ts](../../../../../TinadecGateway/src/marketProxy.test.ts)
- [TinadecGateway/src/tinaChatRoutes.ts](../../../../../TinadecGateway/src/tinaChatRoutes.ts)

## 相关模块

- [AgentConfiguration](../../core/AgentConfiguration/README.md)
- [Models · 模型与 Harness](../../core/Models/README.md)
- [Skills · 市场与集成配置](../../core/Skills/README.md)
- [Prompts · 提示词组装与版本](../../core/Prompts/README.md)
- [Governance · 授权与审批](../../core/Governance/README.md)
- [TinaChat · 会话组织通信](../../core/TinaChat/README.md)
- [AgentGraph · 图与资源](../../core/AgentGraph/README.md)
- [Lifecycle · 运行事实与恢复](../../core/Lifecycle/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
