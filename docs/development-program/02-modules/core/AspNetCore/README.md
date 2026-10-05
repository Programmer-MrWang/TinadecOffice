# AspNetCore · 可嵌入 HTTP 层

模块ID：`CORE-HTTP` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### AspNetCore · 可嵌入 HTTP 层

提供可以挂载到其它 ASP.NET Core 应用的 HTTP 层，引用 Runtime。端点实现现已在此模块。

- AddTinadecCoreHttp / MapTinadecCore
- 端点、DTO、SSE、OpenAPI、控制面

## 源码入口

- [TinadecCore/AspNetCore/TinadecCore.AspNetCore.csproj](../../../../../TinadecCore/AspNetCore/TinadecCore.AspNetCore.csproj)
- [TinadecCore/AspNetCore/TinadecCoreHttpExtensions.cs](../../../../../TinadecCore/AspNetCore/TinadecCoreHttpExtensions.cs)
- [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs:59](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs#L59)
- [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs:70](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs#L70)
- [TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs)

## 相关模块

- [Runtime · 唯一组合根](../Runtime/README.md)
- [DmaEA / 双层调用与持久运行引擎](../DmaEA/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
