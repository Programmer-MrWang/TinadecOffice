# Gateway / WebSocket 范围与实现

模块ID：`GW-WS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### WebSocket / 当前边界

index.ts 构造上游地址后未建立连接；已有 websocket.ts 代理辅助代码不能作为已接通双向上游的证据。Desktop 用户终端使用 IPC。

- terminal / debug / collaboration
- 已有路由与本地 pub/sub
- 尚未连接上游 WS

## 源码入口

- [TinadecGateway/src/index.ts:2326](../../../../../TinadecGateway/src/index.ts#L2326)
- [TinadecGateway/src/index.ts](../../../../../TinadecGateway/src/index.ts)
- [TinadecGateway/src/websocket.ts](../../../../../TinadecGateway/src/websocket.ts)

## 相关模块

- [Desktop / Electron 原生壳](../../app/desktop-shell/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
