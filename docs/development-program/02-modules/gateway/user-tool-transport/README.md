# Gateway / 用户工具传输与可选读面

模块ID：`GW-TOOLS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 工具传输 / Core-owned

当前 code/tools execute 代理 Core 的 tools execute。用户写动作走 Core UserToolActionService；智能体写走冻结 run 的 dispatcher。

- code/tools 读执行 → Core
- user/tool-actions 受治理写 → Core
- agent tools → run-scoped Core

### 可选独立 Tool Runtime

仅显式配置时这三个只读接口转独立服务。未配置时health/tools回Core，manifest返回501。执行接口始终经Core；本机Tools由Core stdio子进程承载。

- health / manifest / tools 读代理
- 默认 URL 空；执行仍转 Core
- 不是本机主执行链

## 源码入口

- [TinadecGateway/src/index.ts:1200](../../../../../TinadecGateway/src/index.ts#L1200)
- [TinadecGateway/src/config.ts:74](../../../../../TinadecGateway/src/config.ts#L74)
- [TinadecGateway/src/index.ts](../../../../../TinadecGateway/src/index.ts)
- [TinadecGateway/src/config.ts](../../../../../TinadecGateway/src/config.ts)
- [TinadecGateway/src/toolRuntimeClient.ts](../../../../../TinadecGateway/src/toolRuntimeClient.ts)

## 相关模块

- [Tools · 工具治理与适配](../../core/Tools/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
