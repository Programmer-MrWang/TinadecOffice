# 三平台交付、Manager 与更新

模块ID：`X-DELIVERY` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### scripts / CI / 三平台制品

原生平台 runner 执行 staging/打包/校验。完整 Office 安装器与独立运行时模块/AgentPack 同时发布，版本和 digest 分别记录。

- win-x64：NSIS + portable
- linux-x64：deb / osx-arm64：dmg
- Core / Gateway / Tools 模块包
- AgentPack / catalog / SHA256

### GitHub Release / Manager

Manager是仓库外消费者。发布产物/模块元数据与catalog已有实现，但当前serviceManager只读内置runtime，未接机器注册；规范中的Office注册交接属于目标。Core NuGet可打包与已发布另行区分。

- 发布 artifacts / channel catalog
- Manager 消费模块与版本契约
- App 读取机器注册仍待接通
- AgentPack 安装仍交由 Core

### native / 平台辅助资源

三平台附带原生搜索及 PTY 相关资源；Windows 另携带 PortableGit，POSIX 使用系统 Git。native/codex-src 当前不是产品运行依赖。

- pin 版 ripgrep、PTY/ConPTY
- Windows PortableGit 随包

## 源码入口

- [.github/workflows/desktop-release.yml:69](../../../../../.github/workflows/desktop-release.yml#L69)
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)
- [apps/desktop/scripts/runtimeTargets.mjs:8](../../../../../apps/desktop/scripts/runtimeTargets.mjs#L8)
- [.github/workflows/desktop-release.yml](../../../../../.github/workflows/desktop-release.yml)
- [apps/desktop/scripts/runtimeTargets.mjs](../../../../../apps/desktop/scripts/runtimeTargets.mjs)
- [apps/desktop/scripts/package-office-channel.mjs](../../../../../apps/desktop/scripts/package-office-channel.mjs)
- [apps/desktop/scripts/verify-office-channel.mjs](../../../../../apps/desktop/scripts/verify-office-channel.mjs)
- [apps/desktop/scripts/merge-office-channel-catalog.mjs](../../../../../apps/desktop/scripts/merge-office-channel-catalog.mjs)
- [apps/desktop/package.json](../../../../../apps/desktop/package.json)
- [apps/desktop/electron/main.cjs](../../../../../apps/desktop/electron/main.cjs)
- [apps/desktop/AGENTS.md](../../../../../apps/desktop/AGENTS.md)
- [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)
- [apps/desktop/electron/serviceManager.test.cjs](../../../../../apps/desktop/electron/serviceManager.test.cjs)
- [scripts/setup-ripgrep.mjs](../../../../../scripts/setup-ripgrep.mjs)
- [scripts/ripgrep-pin.mjs](../../../../../scripts/ripgrep-pin.mjs)
- [apps/desktop/electron/terminalManager.cjs](../../../../../apps/desktop/electron/terminalManager.cjs)
- [apps/desktop/scripts/smoke-packaged-posix.mjs](../../../../../apps/desktop/scripts/smoke-packaged-posix.mjs)

## 相关模块

- [Desktop / 本地服务管理](../../app/local-services/README.md)
- [App / AgentPack 内容与安装体验](../../app/agent-packs/README.md)
- [AgentConfiguration](../../core/AgentConfiguration/README.md)
- [TinadecTools / 文件与搜索](../../tools/files-search/README.md)
- [TinadecTools / Git](../../tools/git/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
