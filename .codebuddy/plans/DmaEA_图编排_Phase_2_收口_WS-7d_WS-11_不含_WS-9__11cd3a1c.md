---
name: DmaEA 图编排 Phase 2 收口（WS-7d~WS-11，不含 WS-9）
overview: 收口 DmaEA 图编排 Phase 2 未闭合的四类缺口：发布链路（桌面接线收敛 + Core 测试夹具迁移 + 包管理页只读列表与 office 退役引导）、资源包络路径前缀强制（registry + 前缀语义 + 双 claim PDP 全链）、残留 meeting 硬编码清理、回归门禁补 Desktop vitest/vue-tsc 与 live 冒烟。WS-9 lane 模块化本轮不做，留单独一轮。
todos:
  - id: ws7-desktop-packs
    content: 完成 WS-7 桌面收口：设置页已安装包只读列表 + office 退役引导 + locales 修正 + 测试改指
    status: completed
  - id: ws7-core-fixtures
    content: 使用 [subagent:code-explorer] 定位夹具调用点后，完成 WS-7e：ToolChain 内嵌夹具改名、AgentPack/Unattended 迁 GraphSeedPack 并重写断言
    status: completed
  - id: ws8-resource-path
    content: 使用 [subagent:code-explorer] 核对工具参数名与端口调用点后，实现 WS-8 资源路径强制：registry + allowlist 前缀语义 + 双 claim PDP 全链 + 测试
    status: completed
  - id: ws10-hardcoded
    content: 完成 WS-10：引擎两处 meeting 与 AgentInstanceService DirectUserOutput 改为对话身份派生
    status: completed
  - id: ws11-gates
    content: 扩 WS-11 门禁：Desktop vitest 与 vue-tsc 入矩阵、check:drift 核验、Architecture 依赖规则、更新 AGENTS.md
    status: completed
    dependencies:
      - ws7-desktop-packs
      - ws7-core-fixtures
      - ws8-resource-path
      - ws10-hardcoded
  - id: ws11-smoke-commit
    content: 跑全量回归与 live 冒烟（装 GraphSeedPack、三档、退役降级、重启），按工组提交并登记 WS-9 待办
    status: completed
    dependencies:
      - ws11-gates
---

## Product Overview
DmaEA 图编排重构 Phase 2 的收口批次。Phase 2 主体（三档 enforcement 真实差异化、图原生解析器、资源包络接管、GraphSeedPack 种子包、schema v2 干净断裂）已实现但整体未提交。本轮补齐发布链路、资源路径强制、残留硬编码清理与回归门禁，使整批达到可提交、可复现、可审计的收口状态。

## Core Features
- **包发布链路收口**：桌面端以 GraphSeedPack 为唯一随应用发布的内置包（旧 OfficeAgentPack 退役）；Core 测试夹具不再依赖磁盘上的旧包文件，改为内嵌夹具或迁移到 GraphSeedPack。
- **包管理可视化**：设置页新增「已安装包」只读列表；当检测到旧 office 包仍装着时，显示「已退役」提示条并给出安装 GraphSeedPack 的引导入口；任何情况下不得崩溃，必须给出明确提示。
- **资源路径强制**：文件类工具的目标路径进入授权判定——实例只能在其冻结的读/写路径前缀授权范围内操作，前缀外一律拒绝；写授权蕴含读授权；空授权 fail-closed；无单一路径的工具（shell / mcp_* / git_*）与未登记工具维持「仅级别判定」的 fail-safe，不放宽。
- **编排语义去硬编码**：直接面向用户输出、对话身份等语义从冻结图与已解析的对话身份派生，不再字面匹配 "meeting"。
- **回归门禁扩面**：桌面单元测试与类型检查纳入回归矩阵，契约快照零漂移核验，架构层依赖规则扩展覆盖新模块。

## 视觉与交互效果
设置页「包管理」区沿用既有卡片、徽章与按钮样式（视觉一致，不引入新设计语言）：新增一张只读列表卡，逐行展示包标识、版本、状态徽章；旧 office 包行以警示徽章与「已退役」文案标注，并附带「安装 GraphSeedPack」主按钮跳转既有安装流程。

## 范围边界
本轮**不含** WS-9（lane 抽取到 `DmaEA/Orchestration/`，432 处引用），留待单独一轮；本轮完成后登记为待办。


## 技术栈
沿用仓库既有技术栈，不引入新依赖：
- Core：.NET 10 模块单体（MAF 1.18 基线）+ EF Core（SQLite/PostgreSQL 同批）。
- 桌面：Vue 3 + TypeScript + Vite + Vitest + vue-tsc。
- 契约：`openapi.core.json` / `openapi.external.json` / `schema.d.ts` 三件套 + `npm run check:drift`。
- 测试：xUnit（AgentFramework / Api / Governance / Architecture）+ Gateway vitest + Desktop vitest。

## 实现方案

### WS-7 发布链路收口（桌面 + Core 夹具）
1. **桌面（WS-7d 收尾 + WS-7f）**：现状已基本落地（`OfficeAgentPack/` 已删、`graphSeedPackBootstrap.*` 已建、`api.ts`/`App.vue`/`SettingsPage.vue`/locales 已改指、全仓零 OfficeAgentPack 引用）。本轮需：
   - 清理残留文案：`locales/{en,zh-CN}.ts` 的 `agentPack.workspaceDefaultNotice` 仍写「the Office mode becomes the workspace default」，改为 GraphSeedPack 语境（默认激活 `mode:vibe_graph`）。
   - 实现「已安装包」只读列表：复用既有 `api.listAgentPacks()`（`GET /api/v1/agent-packs`）。列表以只读卡片渲染，非内置包行不提供编辑入口。
   - office 退役引导：退役标识常量从 git 历史中的 `HEAD:apps/desktop/src/agentPacks/OfficeAgentPack/manifest.json` 的 `metadata.pack_id` 读取确认（勿凭猜测），命中即渲染「已退役」提示条 + 「安装 GraphSeedPack」按钮，按钮复用 `installOrUpgradeGraphSeedPack()`。
   - 降级不得崩：`listAgentPacks()` 失败时按空列表渲染并保留既有 GraphSeedPack 卡片，不抛出到页面级。
   - 同步 `SettingsPage.agentPack.test.ts` 与 locales 双语文案。
2. **Core 夹具（WS-7e）**：
   - `ToolChainEndpointTests.cs`：内嵌 full-roster 夹具已就位（`ToolChainPackId` + `ToolChainPackManifest()` / `ToolChainPackDigest()` 按 Core DTO 往返重算 digest）；本轮仅将 `InstallOfficeAgentPackAsync` 等 Office 语义命名改为中性/Graph 语义（10 个调用点），并覆盖 `conversation.ask` 模式断言按三档重写。
   - `AgentPackEndpointTests.cs`：`BundledOfficePackVersion()` / `FindOfficeManifestPath()` / 异常文案 / `WriteCanonical` 异常文案迁到 `GraphSeedPack/manifest.json`。
   - `UnattendedLaneEndToEndTests.cs`（类名已是 `UnattendedEndToEndTests`）：`InstallOfficeAgentPackAsync` 与 `FindOfficeManifestPath` 迁 GraphSeedPack。**注意**：该测试是 `[RequiresTinadecToolsFact]` 真实子进程 + 真实临时 git 仓库 E2E，切包后默认模式变为 `mode:vibe_graph`（有边 → self_dispatch 档），任务图派发路径改变，脚本与「feature.txt 存在 + `git log -1 --format=%s` == M8 unattended commit」断言须同批重写并验证。
   - 纪律：**不得先删夹具后修测试**，夹具迁移与断言重写在同一步内完成。
   - 说明：`GraphSeedPack` 的 `global_engineering.tool_scope` 已含 `git_commit`/`git_push`（已核实），本轮**无需**再改 manifest，因此也无需重算 digest/version。

### WS-8 资源路径前缀强制
- 新建 `TinadecCore/Tools/ToolResourcePathRegistry.cs`：纯静态、可单测的工具→路径提取表。**实现前必须先从冻结 manifest 的真实 `InputSchema` 核对每个工具的参数名**（`read_file`→路径参数、`write_file`→`file_path`、`shell`/`mcp_*`/`git_*`→无单一路径、`create_workspace`→Core 保留豁免）。未登记工具返回 `null`（仅级别判定），fail-safe 不放宽。
- `ToolResourceAllowList` 恢复真实前缀语义：签名回到 `Evaluate(IReadOnlyList<string> grants, string? relativePath, bool mutating)`——解析 `read:<prefix>` / `write:<prefix>`，`""` 前缀 = 整库，路径归一为 workspace 相对正斜杠后做前缀匹配；write 蕴含 read；空 grant 列表 = 拒（保持现状）。删除现有「只看有没有 grant」的语义与固化该行为的 `ToolResourceAllowListTests` 三例。
- 把路径送进 PDP：`ToolDispatcher.AuthorizeAsync` 已持 `execution`（含 `ParametersJson`）→ 经 registry 提取相对路径 → 构造第二个 `CapabilityClaim("resource.access", read|mutate, "path://<relative>")`，与现有 `ToolClaim` 并列。
- `ToolAuthorizationCommand`（`IAuthorizationService.cs:399`）扩一个**可选**资源 claim 位（尾参 + 默认 null）：缺省语义 = 不做路径维度，既有调用点与 fake 实现（`ToolDispatcherResilienceTests.cs:636`）零破坏。
- `GovernanceService` 将资源 claim 送入边界求值，保持「全 allow 才通过 / 任一 deny 即拒」的交集语义不变。
- `CoreAuthorizationContextResolver.ResourceRulesAsync` 重写：对资源 claim 用 `ToolResourceAllowList` 按前缀 + 级别匹配实例冻结 grants；无覆盖 grant → deny；`create_workspace` 走既有 `IsCoreReservedClaim` 豁免。`ToolInvocationScopeResolver:86-89` 的廉价前置门**保留作第一道**。
- 测试：前缀内允许 / 前缀外拒、read grant 不能写、`""` = 整库、无路径工具仅级别判定、未登记工具 fail-safe、projectless 豁免、registry 负例。

### WS-10 残留硬编码清理
- `FullDuplexRunEngine.cs:2736` 与 `:3033` 的字面 `RequiredAgent(configuration.OperationAgents, "meeting")` → 改用已存在的 `RequiredConversationAgent(configuration)`（`:3652`，按 `Graph.ConversationTemplateSlug` 解析，字面 meeting 仅作旧冻结体回落）。
- `AgentInstanceService.cs:167` 的 `DirectUserOutput: seed.Id == "meeting"` → 由冻结对话身份派生。
- lane 内的 `RequiredAgent(..., "supervisor"/"task_planner")` 随 WS-9 处理，本轮不动。

### WS-11 门禁与收口
- Desktop vitest + `vue-tsc` 纳入回归矩阵（确保 `apps/desktop` 有可脚本化执行的 test/typecheck 命令），结果写进 `AGENTS.md`。
- `npm run check:drift` 核验契约快照零漂移；若 WS-7f 动了前端类型形状则同提交再生三件套。
- Architecture 测试扩到覆盖 `ToolResourcePathRegistry` 与资源 claim 不越层、MAF 不出 DmaEA。
- live 冒烟：启动本地 Core → 装 GraphSeedPack → 三档各跑一次（含 `write_file`/`shell`/`git_push` 审批门驻留与唤醒）→ 确认 office 退役后包状态页降级正常 → 重启验证链。
- 按工组提交：WS-7 / WS-8 / WS-10 / WS-11 各一个 commit。

## 实现要点与注意事项
- **契约纪律**：始终 v1、新字段一律 optional；`ToolAuthorizationCommand` 新字段必须尾参可选且缺省=不做路径维度。
- **digest/version 纪律**：`GraphSeedPack.test.ts` 的 digest 重算断言是永久闸；任何 manifest 编辑必须同步 `metadata.version` 与 `GRAPH_SEED_PACK_DIGEST`。
- **性能**：路径提取为纯字符串解析（O(路径长度)），不新增 I/O；registry 为静态查表，无分配放大。PDP 已按 instance 读取一次 grants，前缀匹配在内存完成，不引入 N+1。
- **错误处理**：参数 JSON 非法 / 路径缺失 → registry 返回 null（仅级别判定），不抛异常改变既有拒绝语义；PDP 任一 deny 即拒。
- **爆炸半径**：`ToolAuthorizationCommand` 是 Abstractions 端口，波及 Governance 与所有 fake 实现，必须可选默认值保持旧调用不破；`ToolInvocationScopeResolver` 第一道门保留。
- **验证顺序**：WS-8 完成后先跑 AgentFramework + Api + Governance 三个测试项目；WS-10 完成后跑 Api 全量（FullDuplex 套件为 free_form 零变化门禁）。
- **已知环境红**：Api 中 `ApprovalFlowTests.UserToolAction_GitCommit_*` 与 `UnattendedEndToEndTests` 三个 GitCommit 用例依赖沙箱 `git`，基线即红，不计新增失败；仍须确认无新增失败。

## 架构设计
沿用现有分层与模块边界，不引入新架构模式：`ToolResourcePathRegistry` 属 `TinadecCore/Tools`（与 `ToolResourceAllowList` 同层）；资源 claim 走既有 PDP 边界注册点（`CoreAuthorizationContextResolver` 的 `resource_access` 边界），与 `tool.invoke` 平行，交集语义不变；WS-10 属 `DmaEA` 内部解析收敛，不新增端口。

## 目录结构
```
apps/desktop/
├── src/
│   ├── pages/
│   │   ├── SettingsPage.vue                 # [MODIFY] 包管理区：已安装包只读列表 + office 退役提示条与安装引导；listAgentPacks 失败降级不崩
│   │   └── SettingsPage.agentPack.test.ts   # [MODIFY] 断言新增列表、退役提示与引导按钮；修正既有 GraphSeedPack 卡片断言
│   ├── locales/
│   │   ├── en.ts                            # [MODIFY] 修正 workspaceDefaultNotice 文案；新增列表/退役/引导文案键
│   │   └── zh-CN.ts                         # [MODIFY] 同上（中文）
│   └── api.ts                               # [MODIFY] 复用 listAgentPacks；如列表 DTO 形状变动则同步
├── package.json                             # [MODIFY] 如缺，补可脚本化 test/typecheck 入口（供 WS-11 矩阵调用）
└── vite.config.ts                           # [MODIFY] 仅在需要时调整测试配置

TinadecCore/
├── Tools/
│   ├── ToolResourcePathRegistry.cs          # [NEW] 每工具路径提取表（纯静态、可单测）；未登记→null fail-safe；create_workspace 豁免
│   ├── ToolResourceAllowList.cs             # [MODIFY] 恢复 Evaluate(grants, relativePath, mutating) 前缀+级别语义；空表 fail-closed
│   ├── ToolDispatcher.cs                    # [MODIFY] AuthorizeAsync 提取相对路径并构造 resource.access claim，与 ToolClaim 并列
│   └── ToolInvocationScopeResolver.cs       # [MODIFY] 保留廉价前置门作第一道（注释与调用对齐新语义）
├── Abstractions/Ports/
│   └── IAuthorizationService.cs             # [MODIFY] ToolAuthorizationCommand 追加可选资源 claim 位（默认 null = 不做路径维度）
├── Governance/
│   └── GovernanceService.cs                 # [MODIFY] 把可选资源 claim 送入边界求值，保持交集语义
├── Runtime/
│   └── CoreAuthorizationContextResolver.cs  # [MODIFY] ResourceRulesAsync 改为前缀+级别匹配冻结 grants；core-reserved 豁免保留
├── DmaEA/
│   ├── FullDuplexRunEngine.cs               # [MODIFY] :2736/:3033 改用 RequiredConversationAgent(configuration)
│   └── AgentInstanceService.cs              # [MODIFY] :167 DirectUserOutput 由冻结对话身份派生
├── tests/
│   ├── TinadecCore.AgentFramework.Tests/
│   │   ├── ToolResourceAllowListTests.cs    # [MODIFY] 重写三例为前缀/级别/整库/未登记 fail-safe 语义
│   │   └── ToolResourcePathRegistryTests.cs # [NEW] registry 正例/负例/未登记/无路径工具参数核对
│   ├── TinadecCore.Api.Tests/
│   │   ├── ToolChainEndpointTests.cs        # [MODIFY] 内嵌夹具中性命名 + conversation.ask 三档断言重写
│   │   ├── AgentPackEndpointTests.cs        # [MODIFY] 版本/路径/文案迁 GraphSeedPack
│   │   ├── UnattendedLaneEndToEndTests.cs   # [MODIFY] 安装与 manifest 路径迁 GraphSeedPack；脚本与断言按 self_dispatch 重写
│   │   └── (资源 claim PDP 端到端断言)       # [MODIFY] 允许/拒绝/前缀/projectless 豁免
│   └── TinadecCore.Architecture.Tests/
│       └── GraphOrchestrationArchitectureTests.cs # [MODIFY] 扩覆盖 registry 与资源 claim 不越层、MAF 不出 DmaEA

AGENTS.md                                    # [MODIFY] 更新元数据 + 本轮记录 + 回归矩阵（含 Desktop vitest/vue-tsc 实测）
TinadecCore/AGENTS.md                        # [MODIFY] 移除 OfficeAgentPack 指引，改 GraphSeedPack
TinadecCore/docs/tinadec-core-packaging.zh-CN.md # [MODIFY] 打包指引中的 OfficeAgentPack 引用改 GraphSeedPack
```

## 关键代码结构
```csharp
// TinadecCore/Tools/ToolResourcePathRegistry.cs —— 工具参数中的 workspace 相对路径提取（正斜杠归一）
internal static class ToolResourcePathRegistry
{
    /// <returns>该类工具的目标相对路径；null 表示无单一路径（仅级别判定，fail-safe）。</returns>
    public static string? TryExtractRelativePath(string toolId, string parametersJson);
}
```
```csharp
// TinadecCore/Abstractions/Ports/IAuthorizationService.cs —— 端口扩展：尾参可选，缺省=不做路径维度
public sealed record ToolAuthorizationCommand(
    /* 既有参数保持不变 */ ...,
    CapabilityClaim Claim,
    CapabilityClaim? ResourceClaim = null);
```
```csharp
// TinadecCore/Tools/ToolResourceAllowList.cs —— 真实前缀语义（read/write 级别 + 前缀匹配；空表 fail-closed）
internal static class ToolResourceAllowList
{
    public static ResourceAllowDecision Evaluate(
        IReadOnlyList<string> grants, string? relativePath, bool mutating);
}
```


## Agent Extensions
### SubAgent
- **code-explorer**
  - Purpose: 在本批跨文件的定位工作中承担广度搜索——Core 测试夹具的 Office 引用与调用点、资源 claim 端口的全部实现/fake 调用点、`ToolResourcePathRegistry` 需核对的工具参数名与 `InputSchema` 现场。
  - Expected outcome: 产出精确的文件-行号清单（夹具调用点、`AuthorizeToolAsync` 实现与 mock、工具参数名证据），使 WS-7e/WS-8 的改动点零遗漏、无需二次全仓搜索。
