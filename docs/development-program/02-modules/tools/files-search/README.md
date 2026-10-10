# TinadecTools / 文件与搜索

模块ID：`TOOLS-FILES` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 2026-10-09 存储作用域专项

config/skills可写，runtime禁止，选中包只读，rg正glob不能开放保护根。源码工作目录与存储根分开；自由源码目录默认 `~/TinadecProjects`。MCP SDK server 自身为可信程序，其进程不继承文件/shell/search 的 OS 沙箱保证。详见[报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。

## 2026-10-10 多文件夹工作区

文件读写检查所有冻结源目录与受保护存储分类；搜索缺省遍历完整源集合，结果携带稳定 root_id 和相对路径。同名文件通过目录 ID 区分，越界目录和未授权新根拒绝。工作区快照使用相同目录集合并保留历史授权引用。

本专项统一由 [APP-HOME-107](../../app/home/TODO.md#app-home-107) 记账，TOOLS-FILES 保留本模块整体审计；交互与存储契约见 [workspaces.zh-CN.md](../../../../workspaces.zh-CN.md)，本轮证据与平台边界见 [实施报告](../../../../../.tinadec_dev/reports/2026-10-10-sidebar-workspaces.zh-CN.md)。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### FileRW / Search · 文件与搜索

统一工作区路径解析与允许根，读写与搜索面分明；文件写还受审批与确认字段约束。

- read / write / 行与字节编辑 / ls / stat
- 路径根、符号链接、文件 hash / ripgrep

## 源码入口

- [TinadecTools/Tools/FileRW/FileSystemTools.cs](../../../../../TinadecTools/Tools/FileRW/FileSystemTools.cs)
- [TinadecTools/Tools/FileRW/FileWriter.cs](../../../../../TinadecTools/Tools/FileRW/FileWriter.cs)
- [tests/TinadecTools.Tests/FileSystemToolsTests.cs](../../../../../tests/TinadecTools.Tests/FileSystemToolsTests.cs)
- [tests/TinadecTools.Tests/FileSearchTests.cs](../../../../../tests/TinadecTools.Tests/FileSearchTests.cs)
- [tests/TinadecTools.Tests/WorkspacePathBoundaryTests.cs](../../../../../tests/TinadecTools.Tests/WorkspacePathBoundaryTests.cs)

## 相关模块

- [AgentGraph · 图与资源](../../core/AgentGraph/README.md)
- [三平台交付、Manager 与更新](../../cross-cutting/delivery-manager/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-08 工具配置接线

读取默认150行、目录分页100、搜索50及隐藏/忽略/大小写行为按每次冻结上下文解析，显式false保留。读写字节上限在修改前校验；共享技能仅所选包只读，真实根和链接边界同时校验，文件哈希仍必需。 验证结果与三平台边界见[专项报告](../../../../../.tinadec_dev/reports/2026-10-08-tools-settings.zh-CN.md)。
