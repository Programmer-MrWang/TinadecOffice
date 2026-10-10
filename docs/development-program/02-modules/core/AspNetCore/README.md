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

### 工作区可用性与错误响应（2026-10-10）

作用域列表对每条宿主登记只读检查 manifest 和目录授权，不初始化或挂载运行时。健康条返回 `availability=ready`；坏条保留身份与路径，返回 `availability=error`、空 `workspace`、稳定错误码、分类、恢复动作、trace 和配置诊断。项目聚合挂载时再检测数据库；数据库异常保留服务端 journal，不伪装成目录缺失，也不伪造生命周期。取消请求与致命异常不转成占位条。

`AddTinadecCoreHttp` 为已有 code 的 ProblemDetails 补齐缺失分类，保留域诊断及已给定分类。已带 trace 的 JSON problem 由专用 writer 保留关联身份；未带 trace 的 problem 继续使用框架 writer。接口故障专项沿用 [APP-HOME-107](../../app/home/TODO.md#app-home-107)，Windows 定向证据及未验收边界见 [本轮报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md)。

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
