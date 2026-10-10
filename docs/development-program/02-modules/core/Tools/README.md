# Tools · 工具治理与适配

模块ID：`CORE-TOOLS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 2026-10-09 存储作用域专项

登记/安装拆分；固定版本、审批、immutable 包/manifest、pointer、本地复制与旧scope授权拒绝。源码工作目录与存储根分开；自由源码目录默认 `~/TinadecProjects`。MCP SDK server 自身为可信程序，其进程不继承文件/shell/search 的 OS 沙箱保证。详见[报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。

## 2026-10-10 多文件夹工作区

ToolConfigurationResolver 准入冻结完整源目录与主目录，调用在附加源内选择 cwd 不重写冻结根；TinadecToolsProcessManager 按 scope、目录集合与存储写策略复用进程。调用者不能用项目文件或模型参数扩大授权。多源快照保存目录 ID 与相对路径；旧运行沿历史冻结配置。

本专项统一由 [APP-HOME-107](../../app/home/TODO.md#app-home-107) 记账，CORE-TOOLS 保留本模块整体审计；交互与存储契约见 [workspaces.zh-CN.md](../../../../workspaces.zh-CN.md)，本轮证据与平台边界见 [实施报告](../../../../../.tinadec_dev/reports/2026-10-10-sidebar-workspaces.zh-CN.md)。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### Tools · 工具治理与适配

这是 Core 中的工具治理模块，和右侧实际执行产品 TinadecTools 不同。准备/授权/审批/租约/恢复后才向工具提供方发送可信请求。

- 冻结 manifest、scope、dispatcher、terminal registry
- IToolProvider → 本地进程 / 可替换远端 provider

## 源码入口

- [TinadecCore/Tools/ToolsModuleRegistrar.cs:19](../../../../../TinadecCore/Tools/ToolsModuleRegistrar.cs#L19)
- [TinadecCore/Tools/ToolsModuleRegistrar.cs](../../../../../TinadecCore/Tools/ToolsModuleRegistrar.cs)
- [TinadecCore/Tools/ToolDispatcher.cs](../../../../../TinadecCore/Tools/ToolDispatcher.cs)
- [TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs](../../../../../TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs)

## 相关模块

- [Governance · 授权与审批](../Governance/README.md)
- [AgentGraph · 图与资源](../AgentGraph/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。

## 2026-10-08 版本化工具配置

Core持有共享默认、持久Agent覆盖和MCP资源；Desktop经Gateway调用GET/PUT/Schema及资源管理接口。写入必须If-Match。新准入运行冻结所有参与Agent及可派生模板的配置，execution_context与模型params分离。保存不重启宿主；Core与Tools分别校验技能包读取根及路径。见[实施契约](../../../../../.tinadec_dev/specs/2026-10-08-agent-tool-settings.zh-CN.md)。
