# 共享渲染层 / 路由与 API

模块ID：`APP-RENDERER` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### 共享渲染层 / App.vue + Router + API

组合页面、状态、路由、通知与 API 客户端，展示 Core 返回的状态。

- Vue / TypeScript / Pinia / i18n / Monaco / xterm
- 生成的 OpenAPI 类型 + HTTP 请求 + SSE 活动订阅

### 客户端与 Core 的责任交界

四产品可独立版本化和组合。当前桌面/Web 渲染层经 Gateway 使用 Core，不意味着所有产品必须捆绑安装。

- App 表达意图、展示事实；Core 裁决执行和授权
- 独立产品可替换；图上箭头表示当前 Office 集成路径

## 源码入口

- [apps/desktop/src/main.ts](../../../../../apps/desktop/src/main.ts)
- [docs/tinadec-core-product-definition.zh-CN.md:97](../../../../tinadec-core-product-definition.zh-CN.md#L97)
- [apps/desktop/src/App.vue](../../../../../apps/desktop/src/App.vue)
- [apps/desktop/src/router.ts](../../../../../apps/desktop/src/router.ts)
- [apps/desktop/src/api.ts](../../../../../apps/desktop/src/api.ts)

## 相关模块

- [Home / 会话、对话与投递](../home/README.md)
- [Code / 编程工作台](../code/README.md)
- [Workbench / 治理与数据页面](../data-pages/README.md)
- [Settings / 配置中心](../settings/README.md)
- [Market / 市场](../market/README.md)
- [Debug Studio / 调试界面](../debug-studio/README.md)
- [TinadecUI / UIE Engine](../uie-engine/README.md)
- [Gateway / HTTP、认证与上下文](../../gateway/http-auth/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
