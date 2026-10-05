# Web / 浏览器平台适配

模块ID：`APP-WEB` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### apps/web

Web 使用与 Desktop 相同的业务组件与路由，由 webShim 适配平台契约。目前没有本地PTY、桌宠、分离窗口、原生目录选择，也没有Electron磁盘布局adapter。

- 复用 desktop/src 渲染层
- Vite :5174 · webShim

## 源码入口

- [apps/web/vite.config.ts:10](../../../../../apps/web/vite.config.ts#L10)
- [apps/web/vite.config.ts](../../../../../apps/web/vite.config.ts)
- [apps/web/src/main.ts](../../../../../apps/web/src/main.ts)
- [apps/web/src/platform/webShim.ts](../../../../../apps/web/src/platform/webShim.ts)

## 相关模块

- [共享渲染层 / 路由与 API](../shared-renderer/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
