# TinadecOffice 模块化开发工程

这里是围绕项目架构持续分析、规划、实现和验收的工作目录。**一个模块一个文件夹，每个文件夹都有架构图、功能介绍、功能完成情况和TODO。** 当前建立55个模块档案，其中Core24个产品工程单独建档。

本轮完成文档工程初始化与源码基线整理，尚未完成全产品逐功能审计；没有开始批量实现下列待办。

## 从这里进入

1. [总架构图与讲解](00-overview/README.md)：已有高清、SVG和离线交互版全部放在这里。
2. [模块总索引](MODULE-INDEX.md)：按App、Gateway、Core、Tools和横切工程进入各模块。
3. [总TODO](01-program/MASTER-TODO.md)：汇总各模块任务，点击Task ID回到唯一任务正文。
4. [工程状态](01-program/STATUS.md) · [推进阶段](01-program/README.md) · [跨模块依赖](01-program/DEPENDENCIES.md)。
5. [历史任务映射](01-program/LEGACY-BACKLOG-MAP.md)：旧任务是需求/证据来源，未经复核不继承完成勾选。

## 目录结构

```text
development-program/
├─ README.md / AGENTS.md / MODULE-INDEX.md / modules.json
├─ 00-overview/        总图、交互版、高清图、完整讲解、模型与生成源码
├─ 01-program/         总TODO、进度、阶段、依赖与历史映射
├─ 02-modules/
│  ├─ app/             UI与平台模块
│  ├─ gateway/         传输、认证、配置、流与WS
│  ├─ core/            24个Core工程，各自独立
│  ├─ tools/           执行协议、文件、Git、命令、沙箱、MCP、Web、生成器
│  └─ cross-cutting/   数据安全、质量契约、交付
│     └─ <module>/
│        ├─ README.md          功能介绍、源码入口与相关模块
│        ├─ ARCHITECTURE.md    可编辑Mermaid、边界、编译引用
│        ├─ architecture.svg  独立模块职责图
│        ├─ STATUS.md          功能状态和验收证据
│        └─ TODO.md            缺口、核查、方案与验收任务
├─ 03-evidence/        初始静态证据与之后的测试/真实运行记录
├─ 04-decisions/       跨模块或产品范围决定
├─ 05-templates/       模块、功能、任务、审查、证据、决策模板
└─ scripts/           只重建汇总的reindex脚本
```

## 如何一起推进

选一个模块，从README和模块图开始，把STATUS中的聚合能力拆成独立功能，核对源码和实际行为，再决定缺哪些能力、如何实现以及怎样验收。每个任务都有稳定ID，能关联功能、依赖、实现提交和证据。完成一个任务后同步模块图/状态/任务，再刷新总索引。

“源码可见”不等于“已验收”，“未测试”不等于“未实现”；平台有意不支持的能力先记录范围边界。待方案事项是后续讨论入口，不自动扩展产品范围。

任务与功能状态只在模块TODO/STATUS编辑；总TODO与总状态是派生导航。刷新命令：

```powershell
node docs/development-program/scripts/reindex.mjs
```

初始基线：2026-10-05，b6115e6 + 当前工作树。本轮只做文档/图形/引用验证；已有市场等业务改动保持原状，历史报告中的业务测试没有在本轮重跑。
