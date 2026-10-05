# Gateway / 项目、会话与运行控制

模块ID：`GW-SESSIONS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 项目 / 会话 / run

会话与运行控制 API 代理 Core。interaction 受理返回 JSON；客户端另订阅 run SSE。

- projects / sessions / interactions
- runs / stream / events / attachments
- 取消、暂停、恢复、上下文补丁

## 源码入口

- [TinadecGateway/src/index.ts](../../../../../TinadecGateway/src/index.ts)
- [TinadecGateway/src/coreClient.ts](../../../../../TinadecGateway/src/coreClient.ts)

## 相关模块

- [DmaEA / 双层调用与持久运行引擎](../../core/DmaEA/README.md)
- [Lifecycle · 运行事实与恢复](../../core/Lifecycle/README.md)
- [Context · 本轮输入与补丁](../../core/Context/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
