# Desktop / Electron 原生壳

模块ID：`APP-DESKTOP` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### apps/desktop

Electron main + preload + Vue renderer。桌面独立窗口和桌宠属于本地交互能力。

- Electron 43 + Vue 3.6
- 桌面窗口、分离面板、桌宠

### Electron main ↔ preload ↔ window.tinadec

renderer 通过受控 preload API 使用原生能力。用户打开的本地终端属于桌面功能，与 Core 管理的智能体工具终端是两条路径。

- IPC：窗口/文件对话框/剪贴板/布局/本地终端/服务发现
- 用户终端 → terminalManager → node-pty / ConPTY → 本机 Shell

## 源码入口

- [apps/desktop/package.json](../../../../../apps/desktop/package.json)
- [apps/desktop/electron/preload.cjs](../../../../../apps/desktop/electron/preload.cjs)
- [apps/desktop/scripts/runtimeTargets.mjs](../../../../../apps/desktop/scripts/runtimeTargets.mjs)
- [apps/desktop/electron/terminalManager.cjs](../../../../../apps/desktop/electron/terminalManager.cjs)

## 相关模块

- [共享渲染层 / 路由与 API](../shared-renderer/README.md)
- [Desktop / 本地服务管理](../local-services/README.md)
- [Desktop / 偏好与布局持久化](../local-state/README.md)
- [三平台交付、Manager 与更新](../../cross-cutting/delivery-manager/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
