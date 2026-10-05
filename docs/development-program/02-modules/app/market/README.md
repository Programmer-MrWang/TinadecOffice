# Market / 市场

模块ID：`APP-MARKET` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Market / 市场

市场页面使用 UIE 卡片，目录与安装业务由 Core 的 Skills 市场服务承载。

- 目录、筛选、详情
- 受控安装与安装状态

## 源码入口

- [apps/desktop/src/pages/MarketPage.vue](../../../../../apps/desktop/src/pages/MarketPage.vue)
- [apps/desktop/src/controllers/MarketController.ts](../../../../../apps/desktop/src/controllers/MarketController.ts)
- [docs/market-route-stability-2026-10-05.zh-CN.md](../../../../market-route-stability-2026-10-05.zh-CN.md)

## 相关模块

- [Skills · 市场与集成配置](../../core/Skills/README.md)
- [TinadecUI / UIE Components](../uie-components/README.md)
- [Gateway / 配置、市场、治理与组织代理](../../gateway/configuration-organization/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
