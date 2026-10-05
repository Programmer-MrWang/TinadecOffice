# Desktop / 本地服务管理

模块ID：`APP-SERVICES` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 本地服务发现与管理

当前实现使用resources/runtime随包路径；只在packaged且Gateway满足规范本地URL时拥有服务，localhost/127.0.0.1:48730及尾斜杠可规范化。未读Manager注册；开发由脚本启动，Tools子进程归Core。

- 内置 runtime / 服务健康探测
- 启动/停止 Core、Gateway

## 源码入口

- [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)

## 相关模块

- [三平台交付、Manager 与更新](../../cross-cutting/delivery-manager/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
