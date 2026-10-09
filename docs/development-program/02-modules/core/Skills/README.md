# Skills · 市场与集成配置

模块ID：`CORE-SKILLS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 2026-10-09 存储作用域专项

project .tinadec/skills、scope live source；仅选中包冻结、完整旧资产审核与物理删除。源码工作目录与存储根分开；自由源码目录默认 `~/TinadecProjects`。MCP SDK server 自身为可信程序，其进程不继承文件/shell/search 的 OS 沙箱保证。详见[报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Skills · 市场与集成配置

市场目录与受控安装、集成配置已实现；通用 ListSkillsAsync/GetSkillAsync 仍为空实现。实际工作区 SKILL.md 的读取在 Context。

- 市场目录 / 安装 / MCP-ACP 配置
- 通用 ISkillProvider 仍为 skeleton

## 源码入口

- [TinadecCore/Skills/SkillsModuleRegistrar.cs:43](../../../../../TinadecCore/Skills/SkillsModuleRegistrar.cs#L43)
- [TinadecCore/Skills/MarketCatalogService.cs](../../../../../TinadecCore/Skills/MarketCatalogService.cs)
- [TinadecCore/Skills/MarketInstallService.cs](../../../../../TinadecCore/Skills/MarketInstallService.cs)

## 相关模块

- [Context · 本轮输入与补丁](../Context/README.md)
- [Market / 市场](../../app/market/README.md)
- [Tools · 工具治理与适配](../Tools/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-08 Skills资源目录

项目skills文件与Core管理的共享技能包通过同一真实发现服务列出、校验和提供给Agent。共享包保留不可变内容版本，授权限于具体包；项目更新沿用审批与文件哈希。索引来源是当前Agent的准入冻结绑定，不按同项目进程共享。市场MCP安装及卸载进入Core版本化资源库。见[模块说明](../../../../../TinadecCore/Skills/README.md)。
