# DmaEA 图编排重构 Phase 2 收口：发布链路 + 资源路径强制 + lane 模块化

> 目标仓库 `c:\git\agent\TinadecOffice`。契约始终 v1、additive-only；`metadata.version` 与 digest 同步；契约改动同提交再生 openapi.core.json/openapi.external.json/schema.d.ts 并过 check:drift。本计划收口 Phase 2 未闭合的缺口，工作树当前状态：Phase 2 主体已实现但**全部未提交**（31 改 / 2 删 / 5 新增）。

## 摘要

Phase 2 主体（WS-1 至 WS-6）已落地并核实通过：三档 enforcement 真实差异化、`GraphModeResolver` 已删且 `graph_resolver` 全仓零命中、`FrozenGraph` 扩了 `SpawnableTemplates` 与边 `DataContract`、schema v2 干净断裂（`run_schema_superseded`）、GraphSeedPack 三模板×三模式齐全。但四类缺口未闭合：**发布链路断裂**（老包 digest/version 破裂 + 新包 test-only 未接桌面）、**资源包络只判存在性不判路径**（持任意 grant 即可访问任意路径）、**lane 机械缠在引擎里**（432 处引用，与包零绑定却未模块化）、**回归门禁漏了 Desktop vitest**（GAP-1 因此逃逸）。

## 已核实完成（不要重做）

- WS-1：`FrozenGraph.SpawnableTemplates`（[FrozenRunConfiguration.cs:154](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L154)/:267）、`FrozenSpawnableTemplate`（:164）、边 `DataContract`（[IFormalModeResolver.cs:67](file:///c:/git/agent/TinadecOffice/TinadecCore/Abstractions/Ports/IFormalModeResolver.cs#L67)）、`DeriveGraphTier` 三分支（[:352-364](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L352)）、`CurrentSchemaVersion="frozen-run-configuration/v2"`（:106）、每模式恒冻结 Graph（[:244-278](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L244)）。
- WS-2：legacy `SpawnAsync` 分支已删；[GraphSpawnAuthority.cs](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/GraphSpawnAuthority.cs)（`IsSpawnAllowed`/`SelectSpawnable`/`FindCoverage`）；`graph_tier_spawn_denied`（[FullDuplexRunEngine.cs:1852](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1852)）；总管收窄 + `spawn_tool_ceiling_exceeded`（[:1927-1937](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1927)）；`GraphEdgeAuthority` 已按三档分化（[:23](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/GraphEdgeAuthority.cs#L23) free_form 放行、[:27-29](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/GraphEdgeAuthority.cs#L27) self_dispatch 放行白名单）。
- WS-3：`GraphModeResolver.cs` 已删文件；`FormalModeResolver` 图原生（`ResolveSpawnableTemplatesAsync` [:281](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/FormalModeResolver.cs#L281)）。
- WS-4（部分）：PDP `resource_access` 边界（`CoreAuthorizationContextResolver.ResourceRulesAsync`）、`create_workspace` 豁免、空 grant fail-closed、8 处种子换 `ResourceSeed(...)`。**未完成的一半见 WS-8。**
- WS-5/WS-6：GraphSeedPack 三模板×三模式（`free_director` 单节点无边→free_form；`vibe_graph`/`fixed_pipeline` 各 2 边，后者靠 `envelope.capabilities` 剥掉 spawn 权 + `spawn.max_depth=0` 落 deterministic）；`GraphOrchestrationPhase2Tests` 15 例 + 三档 E2E；投影 `tier` + 前端徽章。

## WS-7 删老包 + GraphSeedPack 成为唯一包并接入桌面

- **删除** `apps/desktop/src/agentPacks/OfficeAgentPack/`（`manifest.json` 54596B、`index.ts` 141 行、`OfficeAgentPack.test.ts` 95 行）。lane 不受影响（已证实两个包 manifest 内 "lane" 命中数为 0）。
- **新建** `apps/desktop/src/agentPacks/GraphSeedPack/index.ts`：类型必须补齐老 `index.ts` 缺失的 v1 新字段——node `relationship`（五字段）、node `config.conversation`、mode `bindings`（`node_key?`/`agent_ref`/`duty_description_ref`/`tool_switches`/`envelope`/`includes_core_reserved`）、`resources.tools`；常量 `GRAPH_SEED_PACK_ID='tinadec.graph.seed-pack'`、`GRAPH_SEED_PACK_VERSION='2.0.0'`、`GRAPH_SEED_PACK_DIGEST=<RFC8785 SHA-256 实算>`；把 RFC 8785 canonicalize/digest 助手抽到共享 `apps/desktop/src/agentPacks/packIntegrity.ts`（不再复制实现）。
- **新建** `GraphSeedPack.test.ts`：digest 重算断言（GAP-1 缺的正是这道闸）+ 结构断言（3 智能体/3 模式；`free_director` 无边、另两模式各 2 边；每节点关系文件五字段齐备；`agent_types` 白名单非空于需 spawn 的模式；operation 层智能体 `tool_scope` 必为空）。
- **接线**：`apps/desktop/src/api.ts:1` 的 `import type { AgentPackEnvelope } from '@/agentPacks/OfficeAgentPack'` 改指 GraphSeedPack；locales `en.ts`/`zh-CN.ts` 约 20 处 OfficeAgentPack 文案（`installTitle`/`upgradeMessage`/`previewDigestMismatch`/`managedReadOnly`/`deferredTitle` 等）改为 GraphSeedPack；安装/升级流与包状态页同步。
- **已装 office 的工作区降级**：包状态流在"已安装的包不再随应用发布"时必须优雅降级（明确提示 + 引导安装 GraphSeedPack），不得崩；已发布资源是 DB 行、不依赖磁盘 manifest。
- **对齐计划规格**：`global_engineering` 的 `tool_scope` 补 `git_commit`/`git_push`（计划写的是 `git_*`，实际只有 `read_file/write_file/shell`），使审批门 E2E 覆盖保护分支工具；改 manifest 后必须重算 digest 并同步 `metadata.version`。
- **迁移 3 个 Core 测试的包夹具**（office → GraphSeedPack，否则删目录即 `FileNotFoundException`）：
  - `ToolChainEndpointTests.cs`：`InstallOfficeAgentPackAsync`（[:1319](file:///c:/git/agent/TinadecOffice/TinadecCore/tests/TinadecCore.Api.Tests/ToolChainEndpointTests.cs#L1319)，路径上溯 :1365）→ GraphSeedPack；**10 个调用点**（:68/:145/:192/:333/:383/:444/:509/:588/:748/:781）；其中 :193 取 `conversation.ask` 模式，GraphSeedPack 无此模式 → 改用 `vibe_graph`/`fixed_pipeline` 并按三档重写断言。
  - `AgentPackEndpointTests.cs`：路径 :716、错误文案 :770 → GraphSeedPack。
  - `UnattendedEndToEndTests.cs`（原 `UnattendedLaneEndToEndTests`，已去 lane）：调用 :152、路径 :281 → GraphSeedPack。

## WS-8 资源包络路径前缀强制（每工具登记提取器）

- **新建** `TinadecCore/Tools/ToolResourcePathRegistry.cs`：每工具路径提取表（纯静态、可单测）。`read_file`→路径参数；`write_file`→`file_path`；`shell`→无单一路径（仅级别判定，作用域=整库）；`mcp_search`/`mcp_invoke`→无路径；`git_commit`/`git_push`→仓库级、无单一路径；`create_workspace`→Core 保留豁免。**未登记工具→无路径（仅级别判定），fail-safe 不放宽。** 实现时须先从冻结 manifest 的真实 `InputSchema` 核对各工具参数名，不凭猜测。
- **`ToolResourceAllowList` 恢复真实前缀语义**：签名回到 `Evaluate(grants, relativePath, level)`——解析 `read:<prefix>`/`write:<prefix>`，`""` 前缀=整库，分隔符归一为 workspace 相对正斜杠，前缀匹配；write 蕴含 read；空 grant 列表=拒（保持现状）。删掉现有"只看有没有 grant"的语义（[:25-31](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolResourceAllowList.cs#L25)）与固化该行为的测试（`ToolResourceAllowListTests` 三例需重写）。
- **把路径送到 PDP**：`ToolDispatcher.AuthorizeAsync`（[:798](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolDispatcher.cs#L798)）已收到 `execution`，其 `ParametersJson`（[IToolDispatcher.cs:286](file:///c:/git/agent/TinadecOffice/TinadecCore/Abstractions/Ports/IToolDispatcher.cs#L286)）即工具参数 → 经 registry 提取相对路径 → 构造 `CapabilityClaim("resource.access", read|write, "path://<relative>")`，与现有 `ToolClaim`（[:829-832](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolDispatcher.cs#L829)）并列。
- **`ToolAuthorizationCommand`**（[IAuthorizationService.cs:399-402](file:///c:/git/agent/TinadecOffice/TinadecCore/Abstractions/Ports/IAuthorizationService.cs#L399)，当前只带单个 `CapabilityClaim Claim`）扩一个可选资源 claim 位；Governance 把它送进边界求值，保持"全 allow 才通过/任一 deny 即拒"的交集语义不变。
- **`CoreAuthorizationContextResolver.ResourceRulesAsync` 重写**：对 `resource.access` claim 用 `ToolResourceAllowList` 按**前缀 + 级别**匹配实例冻结 grants；无覆盖 grant → deny；`create_workspace` 走既有 `IsCoreReservedClaim` 豁免。`ToolInvocationScopeResolver:88` 的"有没有 grant"廉价前置门保留作第一道。
- **测试**：前缀内允许/前缀外拒、read grant 不能写、`""`=整库、无路径工具仅级别判定、未登记工具 fail-safe、projectless 豁免、registry 负例。

## WS-9 lane 独立成模块（不删、不减容、不破契约）

- **依据（已核实）**：lane 与包零绑定——两个包 manifest 内 "lane" 命中 0；开关在 TOML 运行时基线（[default-agent-runtime.toml:25-27](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/Configuration/default-agent-runtime.toml#L25) → [AgentRuntimeConfiguration.cs:391-393](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/AgentRuntimeConfiguration.cs#L391)）；开启协议由**引擎注入**（[FullDuplexRunEngine.cs:2778-2790](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L2778)，`LaneOpenMarker`:2790）+ `run_directives` + `OrchestrationDirectiveValidator`。按"不强绑定包则独立成模块"的原则处理。
- **抽取**：把散在 `FullDuplexRunEngine.cs`（432 处 lane 引用）的 lane 机械抽到 `TinadecCore/DmaEA/Orchestration/`（与既有 `OrchestrationDirectiveValidator.cs` 同目录），引擎经窄接口调用；含 `SuperviseLaneAsync`(:1076)、`RunGateReviewAsync`(:1160)、`EnsureLanePlannerAsync`(:3380)、`PlanLaneTasksAsync`(:3415)、`LANE_OPEN` 指令链(:2778-2893/:3208)、lane 状态机与 `LaneWait` 汇聚。
- **保持不动**：外部契约 `lane_key`/`lanes` 字段、DB 列与索引（`AgentInstanceRecord.LaneKey`、`ToolExecutionRecord.LaneKey`）、`RunLaneCanvas.vue`/`TaskGraphPanel.vue` 等 UI、审批 `lane_key` 耦合——避免 breaking change 与减容。
- **图档与 lane 的关系保持现状**：`RunFreezeGate` 在冻结期拒 `lanes_enabled`（`graph_tier_lanes_unsupported`），`InteractionsEndpoints` 的 `RunAdmissionException`→409 映射保留。
- **文档**：产品定义 §6.4.1 补记模块边界 + 图档冻结期拒 lane 的事实（该节已有"出厂开关（必读）"注记说明 lane 在 Phase 2 之前就无受支持的运行时开启路径）。
- **排序**：本工组是自成一体的大重构、且不阻塞任何在跑功能，建议紧随 WS-7/WS-8 之后单独一轮做；若本轮一并做，须先完成 WS-7/WS-8 并全量回归绿。

## WS-10 残留硬编码清理

- `FullDuplexRunEngine.cs:2736`（`GenerateInteractionResponseAsync`）与 `:3033`（收尾会议响应）的字面 `RequiredAgent(configuration.OperationAgents, "meeting")` → 改用已存在的 `RequiredConversationAgent(configuration)`（[:3554](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L3554)，按 `Graph.ConversationTemplateSlug` 解析、字面 meeting 仅作旧冻结体容忍回落）。
- `AgentInstanceService.cs:167` 的 `DirectUserOutput: seed.Id == "meeting"` → 由冻结对话身份派生（蓝图"必须重写"清单里的一项）。
- lane 内的字面 `RequiredAgent(...,"supervisor")`(:1087)/`"task_planner"`(:1170/:3393/:3424) 随 WS-9 抽取一并处理。

## WS-11 收口门禁

- **Desktop vitest 纳入回归门禁**：GAP-1 逃逸的直接原因是 Phase 2 的 Measured 只跑了 Api/AgentFramework/Governance/Architecture/Gateway/check:drift，没跑 Desktop。本批起回归矩阵必须含 Desktop vitest + `vue-tsc`，并把结果写进 AGENTS.md。
- **live 迁移冒烟**（GAP-5，实现者已登记待办）：装 GraphSeedPack → 三档各跑一次端到端（含 `write_file`/`shell`/`git_push` 审批门驻留与唤醒）→ 确认 office 退役后包状态页降级正常 → 重启验证链。
- **契约核验**：WS-7/WS-8 均为运行时体与前端类型改动，预期 openapi 快照零漂移；仍须跑 `npm run check:drift` 确认，若 `api.ts`/DTO 形状变动则同提交再生三件套。
- **Architecture 层依赖测试**扩到覆盖 `ToolResourcePathRegistry` 与资源 claim 不越层、MAF 不出 DmaEA。
- **提交纪律**：当前工作树 31 改/2 删/5 新增全部未提交；本批完成后按工组提交，迁移前已有 `.bak-20260913-phase2` 快照。

## 排期依赖

WS-7（删包+接线+夹具迁移）与 WS-8（路径强制）可并行，两者都不依赖对方 → WS-10（残留清理）→ WS-11（门禁与冒烟收口）→ WS-9（lane 模块化，单独一轮）。WS-7 的 digest 重算必须晚于 `global_engineering` 补 `git_*`，否则算两次。

## 风险与保留不变量

- 保留（不可裁地板）：权限不可扩大、operation 工具 deny 地板、配置可复现（冻结 + hash-pin）、事件可审计、有效权限交集（全 allow/任一 deny）、一次性 nonce/租约 fail-closed、治理/PDP/审批/审计不裁。
- 风险：① 删老包打断 3 个 Core 测试文件（含 10 个调用点）→ 夹具迁移与断言重写同批做，不得先删后修；② digest/version 纪律重犯（老包已因此破裂）→ `GraphSeedPack.test.ts` 的 digest 重算断言作永久闸，任何 manifest 编辑必须同步 version；③ 路径提取靠 registry，工具改名或新工具漏登记 → 未登记一律 fail-safe 到"仅级别判定"，不放宽；④ `ToolAuthorizationCommand` 是 Abstractions 端口改动，波及 Governance 与所有实现 → 新字段 optional、缺省语义=不做路径维度，保持旧调用不破；⑤ lane 抽取体量大（432 处）→ 独立一轮、抽取前后各跑一次全量回归对账。

## 假设

- "删掉老包"指从桌面发布物中删除 `OfficeAgentPack` 目录；GraphSeedPack 成为唯一随应用发布的包。
- lane 是已发布产品能力（产品定义 §6.4.1）而非 legacy 残留，故本轮只模块化、不删除，契约字段/DB 列/UI 全部保留。
- 资源包络的路径维度以 workspace 相对正斜杠前缀表达，`""` 前缀=整库（沿用已冻结的 `envelope.resources` 约定）。
- 无路径的工具（`shell`/`mcp_*`/`git_*`）本轮只做 read/write 级别判定，不做前缀限定。
- 首个可运行切片仍用 scripted 模型验证三档/审批门/projectless，不要求真实模型 live smoke。