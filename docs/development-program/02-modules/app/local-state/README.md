# Desktop / 偏好与布局持久化

模块ID：`APP-LOCAL-STATE` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Desktop 本地持久化

桌面保存本地交互偏好，不承担会话/审批/模型路由的第二份业务权威；Web当前没有磁盘布局adapter。

- uie-layout.json · 按项目布局
- 窗口、主题、桌宠与应用偏好

## 源码入口

- [apps/desktop/electron/layoutStore.cjs](../../../../../apps/desktop/electron/layoutStore.cjs)
- [apps/TinadecUI/src/components/useUie.ts](../../../../../apps/TinadecUI/src/components/useUie.ts)

## 相关模块

- [TinadecUI / UIE Engine](../uie-engine/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
