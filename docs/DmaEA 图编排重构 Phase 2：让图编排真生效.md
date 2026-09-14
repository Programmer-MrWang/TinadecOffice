# DmaEA 图编排重构 Phase 2：让图编排真生效

> 目标仓库 `c:\git\agent\TinadecOffice\TinadecCore`（活跃副本，旧 `c:\git\agent\TinadecCore` 不动）。契约始终 v1、新增字段一律 optional、`metadata.version` 与 digest 同步、契约改动同提交再生 openapi.core.json/openapi.external.json/schema.d.ts 并过 check:drift。本计划承接已推送的 Phase 1（`eb82fd2`）+ Phase 1.5（`6d39f78`），把"权限包络决定编排语义"的核心愿景第一次真正落地。

## 摘要

Phase 1/1.5 建好了地基（身份、双闸、包络、真图投影、root 派发、vibe E2E），但图编排"还没真生效"：tier 只是观测标签、三档机制相同、`Graph==null` 仍是 legacy 回退、关系文件五字段被校验却零消费、8 处 `AllowedResources=["workspace"]` 恒真。Phase 2 = 2A 三档真实 enforcement + 2B 解析器图原生重写 + 2C 资源包络接管，并**彻底删除 legacy `Graph==null` 路径、全新重做种子包**。

## 已锁决策（评审基准，全部经本轮问答拍定）

- **范围**：2A + 2B + 2C（不含旧 office 逐模式迁移、非对话实例池、H1-H7、签名——继续后置）。
- **姿态**：重构不减容。老 office 包 + legacy `Graph==null` 引擎路径**直接扔掉重做**，旧版仅当参考蓝本。
- **三档 enforcement 真实差异化**：
  - deterministic = 拓扑焊死（不可发明节点/边/智能体、不可 spawn）+ 总管 LLM 在**已声明边**里选路 + 派发仅限声明边目标（`GraphEdgeAuthority`）。
  - self_dispatch = 拓扑焊死 + 可 spawn **关系文件 `agent_types` 白名单**内的 roster 外新类型；工人工具天花板 = 模板 ∩ ModeBinding `EnvelopeJson` 工具面 ∩ 冻结 manifest，**总管可在天花板内对每任务再收窄**（经任务 `required_tools` 表达、校验 ⊆ 天花板）。
  - free_form = 单节点总监体、全 spawn 权、`agent_types` = 包内全部执行模板、边仅作提示素材、自由搭建。
- **tier 判定可决**：`DeriveGraphTier` 三分支——仅对话节点无派发边 → free_form；有边 + 对话身份持 `create_temporary`/`spawn` 别名 → self_dispatch；有边 + 无 spawn → deterministic。`FrozenGraphTiers.FreeForm` 从此真实落盘。
- **2B**：`FormalModeResolver` 图原生重写、删 `GraphModeResolver` 装饰器 + `GraphResolverModes` shadow/active 开关、`GraphDriftReport.Compare` 降为测试断言。
- **2C**：Governance 加 `resource.access` claim（read|write, `path://<prefix>`）纳入 `AuthorizationBoundary`；8 处 `["workspace"]` 种子换真实 per-instance 路径 grant；projectless `create_workspace` 豁免保留（`IncludesCoreReserved`）。
- **R5 = 干净断裂**：`FrozenRunConfigurationV1.SchemaVersion` bump；旧 schema 的 in-flight run 恢复时 fail-closed 报清晰错误码（`run_schema_superseded`），**不做双读 shim**；旧 completed run 保留为不可变审计记录但不可续跑。
- **新包**：3 模板（meeting/search/global_engineering）+ 3 模式（一档一个）+ 关系文件五字段 + `agent_types` 白名单 + 每模式 `EnvelopeJson`；旧 office 包退役。

## WS-1 冻结层扩结构 + R5 干净断裂（地基，必须最先做）

- `FrozenGraph`（[FrozenRunConfiguration.cs:135](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L135)）扩字段：新增 `SpawnableTemplates`（每条 `slug/tools/caps/version_hash`，由 `agent_types` 在冻结期经 `AgentConfigurationDbContext.AgentTemplates` 解析并 hash-pin）；`FrozenGraphNode`（[:142](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L142)）补关系文件派生的 `AllowedDispatchTargets`；`DeclaredGraphEdge`（[IFormalModeResolver.cs:64](file:///c:/git/agent/TinadecOffice/TinadecCore/Abstractions/Ports/IFormalModeResolver.cs#L64)）补 `DataContract`（把现被丢弃的边 `condition` 冻进来，落地"边上数据类型"）。全部 `JsonIgnore(WhenWritingNull)`，无边/无白名单模式 canonical 字节零变化。
- 冻结构造点（[FrozenRunConfiguration.cs:216-229](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L216)）：`FormalModeResolver` 已持 `IDbContextFactory<AgentConfigurationDbContext>`（[FormalModeResolver.cs:14](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/FormalModeResolver.cs#L14)），在解析 `relational` 时一并读出 `agent_types`→模板集、边 `ConditionJson`（[AgentPackService.cs:861](file:///c:/git/agent/TinadecOffice/TinadecCore/AgentConfiguration/AgentPackService.cs#L861) 已入库）填入冻结体。
- `DeriveGraphTier`（[:300](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L300)）改三分支（见已锁决策），签名扩为接收图形状（节点数/边）+ 对话身份能力。
- `FrozenRunConfigurationV1.SchemaVersion` bump；`RunFreezeGate`（[RunFreezeGate.cs](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/RunFreezeGate.cs)）+ 引擎恢复入口加 schema 版本校验：旧版本 fail-closed 抛 `run_schema_superseded`。
- 迁移回滚/备份：沿 `.bak` 先例（Phase 1 已产 `tinadec.db.bak-20260912-dmaea`），本批迁移前再快照。

## WS-2 三档 enforcement（引擎核心重写，2A 主体）

- **删 legacy 分支**：移除 [FullDuplexRunEngine.cs:1862-1928](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1862) 的 `Graph==null` → `SpawnAsync` 老路径及其 `else` 包裹；`GetOrCreateWorkerAsync`（[:1749](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1749)）此后只走图分支。
- **deterministic**：重写 `EnsureConversationAuthorAsync`（[:3509](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L3509)）作者化语义——任务图目标节点必须 ∈ 声明边目标集，禁止任何 roster 外类型；派发继续过 `GraphEdgeAuthority.IsDispatchAllowed`（[GraphEdgeAuthority.cs:15](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/GraphEdgeAuthority.cs#L15)）；显式断言 tier≠可 spawn，命中 spawn 意图即拒（新错误码 `graph_tier_spawn_denied`）。
- **self_dispatch**：新增 `GraphSpawnAuthority.IsSpawnAllowed(graph, targetSlug)`（白名单 = 冻结 `SpawnableTemplates`，纯函数、负例单测）+ `CreateSpawnedWorkerAsync`：解析目标模板 → 天花板 = 模板 tools ∩ `EnvelopeJson` 工具面 ∩ 冻结 manifest → 交集任务 `required_tools`（总管收窄，校验 ⊆ 天花板）→ root 式创建（权限来自冻结模板、非 parent grant，避开 `SpawnAsync` 层门/子集门）→ 计入 `EnsureGraphWorkerBudget`（[:1947](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1947)）→ 系谱 `agent.created` 事件记 author = 对话身份实例。派发权威 = `GraphEdgeAuthority`（声明边目标）∪ `GraphSpawnAuthority`（白名单新类型）。
- **free_form**：单总监体节点，`SpawnableTemplates` = 包内全部执行模板，无声明边约束（边仅进 prompt 素材）；spawn 走同一 `CreateSpawnedWorkerAsync`，预算同 `EnsureGraphWorkerBudget`。
- **工具地板不破**：operation 层 `operation_layer_cannot_invoke_tools`（[CoreAuthorizationContextResolver.cs:78](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/CoreAuthorizationContextResolver.cs#L78)）恒 deny 保留；总管收窄工人工具是"在 execution 天花板内收窄"，绝不放宽、绝不让 operation 自己持业务工具。

## WS-3 FormalModeResolver 图原生重写（2B）

- 去 meeting 硬编码：`DirectUserOutput=slug=="meeting"`（[FormalModeResolver.cs:170](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/FormalModeResolver.cs#L170)）、`ContextAccess`（:171）、op-exec 计数硬校验（:191）、`LifecycleFor` slug 硬编码（:319）——4 语义全部改为从冻结图 + 对话身份解析派生（对话节点→DirectUserOutput/manage/session；operation 非对话→task；声明边目标→on_demand）。
- 删 `GraphModeResolver` 装饰器（[GraphModeResolver.cs](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/GraphModeResolver.cs)）+ `GraphResolverModes` + `AgentRuntimeConfiguration.GraphResolverMode`（[AgentRuntimeConfiguration.cs:225](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/AgentRuntimeConfiguration.cs#L225)）/`NormalizeGraphResolverMode`（:417）+ TOML `[orchestration] graph_resolver` 键；DI 注册（`TinadecCoreServiceCollectionExtensions`）去掉装饰器包裹。
- `GraphDriftReport.Compare`（[GraphModeResolver.cs:93](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/GraphModeResolver.cs#L93)）逻辑迁入测试，作三档派生语义正确性的永久断言。
- 保留必保清单（逐条不动）：模型策略栈 `user_binding>mode_node_override>agent_version`、prompt hash `VerifyHash`、`tool_scope` override（[FormalModeResolver.cs:76-163](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/FormalModeResolver.cs#L76)）。

## WS-4 资源包络接管（2C）

- Governance 加 `resource.access` claim（read|write, `path://<prefix>`），与现有 `CapabilityClaim("tool.invoke",..., "tool://<id>")`（[ToolDispatcher.cs:799-833](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolDispatcher.cs#L799)）平行；`CapabilityRuleMatcher` 加 path 前缀求值，纳入 `AuthorizationBoundary` 交集（全 allow/任一 deny）。
- 8 处 `AllowedResources=["workspace"]` 种子（FullDuplexRunEngine [1845](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FullDuplexRunEngine.cs#L1845)/1894/3299/3534/3582/3591/3637/4287）→ 真实 per-instance 路径 grant，来源 = ModeBinding/模板资源包络，冻进配置（与 WS-1 同批，触发 hash 变更已由 R5 干净断裂处理）。
- `ToolResourceAllowList`（[ToolResourceAllowList.cs](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolResourceAllowList.cs)）：`IsAllowed([],path)`/`IsAllowed(["workspace"],path)` 恒真的粗 token 语义退役，改为消费真实 grant（或整体由 PDP `resource.access` claim 取代，`ToolInvocationScopeResolver`（[:86](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolInvocationScopeResolver.cs#L86)）改走 PDP）。
- projectless 保留：`create_workspace` 虚拟工具 + `IsProjectlessScope` 豁免建模为 Core 保留能力（`IncludesCoreReserved`），不被资源包络误杀（守住 [ToolManifestSnapshotResolver.cs:36-56](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolManifestSnapshotResolver.cs#L36) 故意不求交的既有语义）。

## WS-5 全新种子包（v1，新字段 optional）

- 3 模板：`meeting`（operation/对话身份/`user.converse`+`task.dispatch`+spawn 权/无业务工具/徽章=已固定）、`search`（execution/`mcp_search`+`mcp_invoke`+`read_file`）、`global_engineering`（execution/`read_file`+`write_file`+`shell`+`git_*`）。
- 每模板关系文件五字段（`duty/inputs_outputs/allowed_dispatch_targets/success_criteria/agent_types`，[GraphValidation.cs:97](file:///c:/git/agent/TinadecOffice/TinadecCore/AgentConfiguration/GraphValidation.cs#L97) 校验、16KB 上限），本批起被 WS-2 真实消费。
- 3 模式（一档一个）：① free_form 总监模式（单 meeting + `agent_types`=全部执行模板 + 全 spawn）② self_dispatch vibe 模式（meeting+search+global_engineering + 声明边 meeting↔search 传 `{query,constraints}`/回 `{evidence,sources}`、meeting↔global_engineering 传 `{task,success_criteria,scope}`/回 `{artifact,verification,risks}` + 受限 spawn）③ deterministic 模式（同三人 + 声明边 + meeting 无 spawn）。每模式 `EnvelopeJson` 包络（只能收窄 TOML 天花板）。
- 携带新字段的包声明 `graph_mode_packs` core capability（[GraphValidation.cs:30](file:///c:/git/agent/TinadecOffice/TinadecCore/AgentConfiguration/GraphValidation.cs#L30)）；digest/version 同步；旧 office 包退役（保留为参考、不再安装）。

## WS-6 测试 + 契约 + 可视化（收口）

- 三档各自 E2E：deterministic（焊死拓扑 + 拒 spawn + 总管选线）、self_dispatch（白名单生成 + 总管收窄工具 + 天花板校验）、free_form（单总监自由搭建）；均含审批门（`write_file`/`shell`/`git_push` 命中时 run 驻留 `awaiting_user`、批准后唤醒续跑，FakeToolProvider harness）。
- `FullDuplexEndpointTests` 45 例随 legacy 删除重写为三档形态；`GraphOrchestrationPhase15Tests`/`VibeGraphPackTests` 升级。
- 新增：`GraphSpawnAuthority` 负例单测、`DeriveGraphTier` 三分支单测、R5 `run_schema_superseded` fail-closed 测试、资源包络 `resource.access` PDP 测试（允许/拒绝/前缀/projectless 豁免）、关系文件 `agent_types`→模板解析测试、`GraphDriftReport` 三档语义断言。
- projectless 回归守住（哨兵往返 property test + `create_workspace` 豁免）。
- 契约三件套再生 + check:drift；Architecture 层依赖测试（[GraphOrchestrationArchitectureTests.cs](file:///c:/git/agent/TinadecOffice/TinadecCore/tests/TinadecCore.Architecture.Tests/GraphOrchestrationArchitectureTests.cs)）扩到 cover 新 spawn 路径/资源 claim 不越层、MAF 不出 DmaEA。
- 可视化：`DeclaredGraphCanvas.vue` 升级显示三档差异（tier 标注 + 声明拓扑 + 运行数据流叠加 + spawn 出的新实例）；`/orchestration` 真图投影（[OrchestrationGraphProjection.cs](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/OrchestrationGraphProjection.cs)）补 tier/spawnable/数据契约字段（additive-only）。

## 排期依赖

WS-1（冻结地基 + R5）→ 可并行 WS-2（三档 enforcement）/ WS-3（解析器图原生）/ WS-4（资源包络）→ WS-5（种子包，依赖 WS-1 冻结字段 + WS-2 消费逻辑）→ WS-6（测试收口）。WS-1 的 FrozenGraph 扩字段是 WS-2 self_dispatch/free_form 的硬前置；WS-4 的 hash 变更与 WS-1 同批冻结。

## 风险与保留不变量

- 保留（不可裁地板）：权限不可扩大、operation 工具 deny 地板、配置可复现（冻结 + hash-pin）、事件可审计、有效权限交集（全 allow/任一 deny）、一次性 nonce/租约 fail-closed、治理/PDP/审批/审计不裁。
- 风险：① 删 legacy + 引擎核心重写回归面大 → 三档 E2E + 重写后的 FullDuplex 套件 + 审批门作门禁；② FrozenGraph 扩字段撞 hash → R5 干净断裂（schema version + `run_schema_superseded`），迁移前 `.bak`；③ 总管收窄工人工具与天花板校验 → `GraphSpawnAuthority` 负例单测 + ⊆ 校验；④ 资源包络 PDP path 维度是 Governance 模型改动 → 平行 claim + 前缀求值单测 + projectless 豁免回归；⑤ 关系文件 `agent_types`→模板解析在冻结期查库 → hash-pin + 解析失败 fail-closed。

## 假设

- "不减容"= 框架能力满（三档 + spawn + 资源包络全实现），种子包从 3 模板精简起步、后续按需加模板；旧 office 14/7 仅参考、不迁移、退役。
- deterministic 的"确定性"= 拓扑焊死不可发明，非零智能路由（总管 LLM 仍按用户请求在声明边里选路）。
- free_form 判定 = 单对话节点无派发边（由权限包络 + 图形状可决，非手动 flag）。
- R5 干净断裂：不保留 in-flight 老任务，旧 completed run 仅作不可变审计、不可续跑。
- 首个可运行切片用 scripted 模型验证三档/审批门/projectless，不要求真实模型 live smoke。