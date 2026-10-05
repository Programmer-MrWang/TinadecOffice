# TinadecTools / 网络抓取

模块ID：`TOOLS-WEB` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Web · 受约束网络抓取

提供受约束的网页抓取工具。它与浏览器渲染/自动化不是同一个能力。

- HTTP(S) / 重定向 / DNS 地址复验
- 体积、内容提取、deadline / 公网地址限制

## 源码入口

- [TinadecTools/Tools/Web/WebFetchGuard.cs](../../../../../TinadecTools/Tools/Web/WebFetchGuard.cs)
- [TinadecTools/Tools/Web/WebFetchTool.cs](../../../../../TinadecTools/Tools/Web/WebFetchTool.cs)
- [tests/TinadecTools.Tests/WebFetchTests.cs](../../../../../tests/TinadecTools.Tests/WebFetchTests.cs)
- [tests/TinadecTools.Tests/RawFetchTests.cs](../../../../../tests/TinadecTools.Tests/RawFetchTests.cs)
- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)

## 相关模块

当前总图未声明额外模块关联；在逐功能审计时补齐实际调用与数据关系。

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
