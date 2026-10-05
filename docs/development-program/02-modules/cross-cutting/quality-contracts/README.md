# 质量、契约与验收门禁

模块ID：`X-QUALITY` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### tests / 契约与架构门禁

活动测试保护模块引用、运行事实、授权、契约和UI；旧tests/Tinadec.Contracts.Tests是不在活动sln且不可构建的遗留需求证据，不能作为当前验收入口。图不代表测试全绿。

- Core 4 套 / Tools / 契约快照
- Gateway Bun / Desktop Vitest
- UIE / Electron / native / scripts
- OpenAPI snapshot / client drift

## 源码入口

- [TinadecCore/tests/TinadecCore.Architecture.Tests/ArchitectureTests.cs](../../../../../TinadecCore/tests/TinadecCore.Architecture.Tests/ArchitectureTests.cs)
- [TinadecOffice.slnx](../../../../../TinadecOffice.slnx)
- [TinadecCore/TinadecCore.slnx](../../../../../TinadecCore/TinadecCore.slnx)
- [TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs)
- [.github/workflows/contracts-drift.yml](../../../../../.github/workflows/contracts-drift.yml)
- [apps/desktop/package.json](../../../../../apps/desktop/package.json)
- [tests/Tinadec.Contracts.Tests/README.md](../../../../../tests/Tinadec.Contracts.Tests/README.md)
- [tests/Tinadec.Contracts.Tests/Tinadec.Contracts.Tests.csproj](../../../../../tests/Tinadec.Contracts.Tests/Tinadec.Contracts.Tests.csproj)
- [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs)
- [TinadecCore/AspNetCore/ControlPlaneService.cs](../../../../../TinadecCore/AspNetCore/ControlPlaneService.cs)
- [apps/desktop/src/generated/schema.d.ts](../../../../../apps/desktop/src/generated/schema.d.ts)

## 相关模块

- [Contracts · 对外契约类型](../../core/Contracts/README.md)
- [Runtime · 唯一组合根](../../core/Runtime/README.md)
- [TinadecTools.Generators / 构建期生成器](../../tools/source-generator/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
