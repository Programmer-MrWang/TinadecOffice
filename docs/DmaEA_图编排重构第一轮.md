# DmaEA 图编排重构：架构蓝图 + 落地补充文档（Phase 0 = 两份设计文档）

> 目标仓库：`c:\git\agent\TinadecOffice\TinadecCore`（活跃副本；旧副本 `c:\git\agent\TinadecCore` 本次不动，文档需显式标注事实源）。
> 产物是**两份设计文档**供你评审；代码在文档确认后按 Phase 1+ 推进。
> 契约纪律：**始终 v1**——新能力原地加进 `/api/v1` + `tinadec.io/agent-pack/v1alpha1`，不引入 v2/兼容别名；**新增 schema 字段一律 optional**（否则旧包 0.2.4 事实 breaking）；`metadata.version` 与 digest 同步升位（409 `agent_pack_version_hash_conflict`，[AgentPackService.cs:968](file:///c:/git/agent/TinadecOffice/TinadecCore/AgentConfiguration/AgentPackService.cs#L968)）；**任何契约改动同提交再生 contract-as-code 快照**（见 S5）。

## 摘要

把 DmaEA 从"meeting 唯一出口 + 硬编码 Plan→SelectWorker→Supervise 流水线"重构为**权限包络驱动的图编排框架**：复用治理内核、重写调度与配置模型。第一刀是 **3 智能体（会议 + 搜索 + 全域工程）+ 一个 vibe 模式** 的轻量单进程切片。框架**通用、模块化、可伸缩**（Core 定位不变，是 MAF 治理运行时的伸缩形态）。本轮把 Phase 0 从一份文档扩为**两份**：Doc1 蓝图定 WHAT/why，Doc2 落地补充定 HOW，逐项闭合 16 个施工缺口。

## 已锁定的设计决策（评审基准）

- **三层分离**：`AgentTemplate`（职责名/默认职责描述/默认工具/权限上限/提示词管线）→ `ModeBinding`（本模式职责描述文件 + 工具开关 + per-mode 权限包络 + 图节点/边 + 实例命名）→ `RuntimeInstance`（可生成名字 + 父系谱 + 冻结有效权限）。同一模板可并行派生多实例，名字可各自生成，职责描述文件共享。
- **对话身份 ConversationIdentity**：治理层、持对话权限 + 身份标识；会话创建时选定后**不可改、跨模式不变**；可由**共享 `context_revision` + 共享工具的并行实例池**承载。PD-03 泛化为"每会话唯一治理层对话身份"，唯一性不变量保留。**必须统一 projectless 三种编码**（wire `Guid.Empty`/durable `NULL`/policy `IsProjectlessScope`）+ 往返 property test。**存储/API/唯一性三问见 S1；池选择纪律见 S2。**
- **编排语义 = 权限包络决定的连续谱（三档共存）**：无 spawn→按声明节点/边**确定性行走**；受限 spawn→图=允许边+边上数据类型+包络，读关系描述文件**在包络内自派发**；全权限+单节点"总监体"→图退化为提示词素材、**自由搭建**。**三档触发条件可判定 + 确定性档 planner 去留见 S3。**
- **权限包络 = 复用 Governance `AuthorizationBoundary`**（`CapabilityRuleMatcher` 求值，**全 allow 才通过/任一 deny 即拒**的交集，是包络语义地基，直接复用不重写）。
- **operation 禁工具 = deny-by-default 地板**：`operation_layer_cannot_invoke_tools`（[CoreAuthorizationContextResolver.cs:78](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/CoreAuthorizationContextResolver.cs#L78)）是 2026-08-31 双层闭包纵深防御。**地板恒 deny，ModeBinding 包络只能收窄、永不放宽**；检查器第二闸写成硬规则。
- **智能体包（v1 原地演进）= 模板 + 工具 + 模式包**；模式包 = 文件夹（智能体配置 + 图 + 关系描述文件）。**工具入包首版只两档**：① id 引用（**hash-pin 到冻结 manifest 条目**）；② 定义清单（受控导入注册表，**执行绑定见 S4**）。**"可执行实现"档后置/不做**（违反 `IToolProvider` 边界）。徽章两级（已固定/经审查、权限受限/需安装），均以 hash-pin 为前提；完整性**复用 `JsonCanonicalizer`**。**签名 Phase 1 不做、仅 digest（见 S8）。新增字段一律 optional + 缺字段默认语义 + reader 容忍未知字段。**
- **检查器三道闸**：① 包装入闸（徽章+schema+digest/version+可选签名）；② 模式发布闸（先建三命名空间映射；operation 工具地板硬规则；对话身份唯一性 + 对话权限校验；图/描述经映射后 ⊆ 包络）；③ 运行冻结闸（对话身份锁定、实例池共享上下文合法、有效权限交集、`FrozenConfigurationHash` 一致）。**每闸"输入/规则/失败态"统一格式 + 失败码/事件规范见 S7 + pinning 测试见 S15。**
- **图可视化**：声明拓扑底图 + 运行期实例与真实数据流叠加；`/orchestration` 投影返回真图（不再 `graph=null`）。**精确 additive-only DTO 见 S10。**
- **可伸缩性 + 治理地板**：轻量档（单进程/SQLite/少量智能体，甚至单节点总监体）↔ 中量档（单节点 + lanes + 并行实例池）↔ 重量档（多节点，后置）。**治理/PDP/审批/租约/nonce/审计/冻结哈希任何档位不可裁**；可裁的只有 provider 种类与实例数量。轻量档 ≠ 治理旁路。

## 修正与补回 → 文档落点（A-D 保留，E 为本轮新增）

**A. 8 项专家修正**（同前版，摘要如下，全文落 Doc1/Doc2）
1. **自由对话/projectless 专章（最高风险）**：R1-R6 逐条（**R1** 哨兵 5 点须同步翻译，[NormalizeProjectId:1193-1199](file:///c:/git/agent/TinadecOffice/TinadecCore/Lifecycle/ToolApprovalCoordinator.cs#L1193)+:78/:96/:130/:1114/:1166+ToolInvocationScopeResolver+Gateway `sessionMapper.ts:40`；**R2** `create_workspace` 故意不求交→建 Core 保留能力 `IncludesCoreReserved`，[ToolManifestSnapshotResolver.cs:36-56](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolManifestSnapshotResolver.cs#L36)；**R3** `AllowedResources=["workspace"]`×6（FullDuplexRunEngine 1812/3188/3413/3422/3468/4118）→`ToolResourceAllowList` 恒真无路径约束；**R4** Governance 无 path 维度（claim 仅 `tool://<id>`）→**必闭合单一选项，见 S9**；**R5** `FrozenRunConfigurationV1`/`RunRecord` 无 project 字段→加引用改 `ContentHash`→历史 run 失配→schema version+双读；**R6** 对话身份 vs `ModeVersionId` 强弱未定，projectless≠modeless，[FrozenRunConfiguration.cs:143](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L143)）+ H1-H7 空洞。
2. **operation 禁工具**：deny 地板 + 只收窄（纠正"改为包络声明"）。
3. **对账算法**：Ch6 先给三命名空间映射表（capabilities ↔ tool id ↔ `CapabilityClaim("tool.invoke",read|mutate,"tool://<id>")`，[ToolDispatcher.ToolClaim:799-833](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolDispatcher.cs#L799)）。**`agent.create_temporary` 已存在于 spawn 能力路径**（能力门 `HasCapability(parent.Capabilities,"agent.create_temporary")`，[AgentInstanceService.cs:200-206](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/AgentInstanceService.cs#L200)；`agent.spawn` 是别名，[:513-514](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/AgentInstanceService.cs#L513)；`bootstrap-agent-directory.toml:19/73`+多测试已声明）——**是能力声明非 PDP claim 字面、不做字面匹配**；真实 spawn 链路 = 能力门 + `required_tools` + 父 grant 子集(`IsSubset`) + `SpawnAsync` 通配符拒绝 + 预算/深度(`AgentSpawnLimits`)。
4. **工具入包**：首版 id 引用(hash-pin)+定义清单、可执行档后置、optional 字段、digest/version 纪律；**执行绑定见 S4、签名决策见 S8**。
5. **lane vs 边：双写过渡不取代**：新 Resolver 必保 `user_binding>mode_node_override>agent_version` 模型策略栈、prompt hash(`VerifyHash`)、tool_scope override（[FormalModeResolver.cs:76-163](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/FormalModeResolver.cs#L76)）+ lane 的 M5/M6/M8 deferred lane/escalation/`lane_key` 投影/审批 payload。
6. **MVP 工具面对齐**：`browser.*` 未注册→用 `mcp_search`/`mcp_invoke`；`shell` 永不 auto-approve、`git_push` 保护分支守卫→**审批门（awaiting_user 驻留/唤醒）写进验收**；`checkpoint.MeetingAgentId/PlannerAgentId/SupervisorAgentId` 单例（428-429/1019/2372-2373/3402-3403）与并行池冲突→改"身份+池"（**选择纪律见 S2**）。
7. **轻量裁剪治理地板**：见锁定决策；Ch9 明列不可裁地板 vs 可裁项。
8. **定位一句话**：Ch2 声明"通用框架 = Core(MAF 治理运行时)伸缩形态，非第二套定位"。

**B. 4 处必须补回**：9. 权限包络=AuthorizationBoundary 独立锁定句（已补）；10. "重构期冲突以本蓝图+代码为准"（Ch1）；11. Ch6"每闸输入/规则/失败态"格式+"对话身份唯一性"；12. Ch8"SQLite/PostgreSQL 同批迁移"+旧 14/7 过渡。

**C. 3 处建议补回**：13. Ch5 三档触发条件+关系描述文件五字段（职责/输入输出/允许派发目标/成功判据/可生成智能体类型）；14. Ch2 目标/非目标清单；15. Ch9 mock provider 轻量问答档示例+Ch10 卡片字段枚举（工具开关/职责名/名字/层/徽章/对话身份标识）+Ch4 复用 JsonCanonicalizer；16. MVP `task.dispatch` 去向说明。

**D. 前轮更正**：17. `agent.create_temporary` 更正（存在、能力声明非字面）；18. v1 新增字段 optional 纪律；19. R1-R6 展开；20. Phase 1 冻结 hash 收尾顺序。

**E. 本轮新增：Doc2 详细落地补充文档必须闭合的 16 项**（见下 Doc2 章纲 S1-S16）。

## Phase 0：撰写两份设计文档（本次唯一交付物）

### Doc1 架构蓝图 `docs/dmaea-graph-orchestration-architecture.zh-CN.md`（WHAT/why）
1. 文档定位与事实源：与产品定义关系；**重构期冲突以本蓝图+代码为准**；新旧 `TinadecCore` 副本；契约始终 v1；**contract-as-code 管线纪律一行**（openapi.core.json+openapi.external.json+schema.d.ts+check:drift 同提交再生，详见 S5）。
2. 设计目标/非目标：定位句 + 目标/非目标清单（图工程、动态分工、名字与职责解耦、模块化可轻量到集群、个人电脑高效、复用内核不推倒重来）+ 非目标（不引入 v2、首版不做可执行工具入包/签名、不提前拆微服务）。
3. 核心概念模型：三层分离、ConversationIdentity + 并行实例池、命名策略；**点名存储/API/唯一性三问（→S1）与池选择纪律/租赁归属（→S2）**。
4. 智能体包（v1 原地演进）：`resources.{agents(templates),tools,modes(mode-packs)}`；模式包文件夹结构；工具两档(id hash-pin+定义清单)+徽章+**复用 JsonCanonicalizer**+digest/version 纪律+**新字段 optional**；**点名定义清单执行绑定（→S4）与签名二选一决策（→S8）**。
5. 图编排语义连续谱：**三档触发可判定**+**确定性档 planner 去留（→S3）**；激活 `mode_edges`；Resolver 与 lane **双写过渡**+必保行为清单；关系描述文件五字段+**大小上限/prompt 注入点/token 预算（→S11）**。
6. 检查器三道闸：**每闸输入/规则/失败态统一格式**+三命名空间映射表+真实 spawn 链路对账（能力声明非字面）+operation 地板硬规则+**对话身份唯一性/对话权限校验**+**失败码 snake_case+RFC9457 与事件名（→S7）**。
7. 治理与审批复用与改写：复用内核清单；必改耦合点；operation 地板只收窄。
8. 数据模型与迁移：新表 `agent_templates(_versions)`/`mode_bindings`(`IncludesCoreReserved`)/`tool_definitions(_versions)`(hash-pin)；改表 `agent_definitions` 瘦身/`agent_instances` 引用(Template+ModeBinding)/`mode_edges` 激活/checkpoint 单例改身份+池；**SQLite/PostgreSQL 同批迁移**+旧 14/7 过渡；**点名新表规约(Tenant/Workspace+Revision/ETag+Status+draft/publish)与 DbContextSchemaBootstrapper 列对账（→S6）**、**R4 必闭合单一选项（→S9）**、**迁移回滚/备份（→S16）**；**自由对话/projectless 专章**（R1-R6 逐条+H1-H7+哨兵统一+`FrozenConfigurationHash` 双读）。
9. 模块化与可伸缩性：模块化组合边界+按场景裁剪（**含无 Tool provider/mock provider 轻量问答档示例**）+**治理不可裁地板 vs 可裁项**+轻/中/重量档。
10. 图可视化（前端）：声明拓扑+运行数据流叠加+**卡片字段枚举**+**点名精确 additive-only 真图 DTO/哪两个端点/与 replay 一致（→S10）**+会话创建选并锁定对话身份。
11. 3 智能体 vibe MVP 规格（见下）。
12. 分阶段路线图+风险+保留不变量。

### Doc2 详细落地补充文档 `docs/dmaea-graph-orchestration-implementation-supplement.zh-CN.md`（HOW，逐项闭合 16 缺口）
- **S1 ConversationIdentity 存储与 API**：选什么（字段名/模板 id/节点 key/默认对话身份）、存哪（`sessions` 新列 vs 新表）、唯一性强制手段（DB filtered-unique 约束 vs 检查器 gate，scope=tenant/workspace/session）+ 选定/锁定的 API（`POST /sessions` 请求字段）。
- **S2 实例池选择纪律与租赁归属**：池成员存哪（checkpoint 内 Guid 列表 vs 新表）、每轮调度主实例选择规则、并行成员 `context_revision` CAS 冲突仲裁者、实例级并发租赁（run lease 是 per-run，实例级靠什么）。
- **S3 三档触发可判定语义 + 确定性档 planner 去留**：确定性档是跳过 planner 用声明直接生成任务，还是 planner 照调但输出约束到声明节点/边；任务输入如何填充；**须核实现有 `SelectWorker` 对未分类任务强制 `worker.general`（vibe 3 智能体无 `worker.general`）+ 已有 graceful fallback，新派发器保留该语义**。
- **S4 定义清单档执行绑定**：注册到哪（`tool_definitions` 是否即注册表）、谁执行（TinadecTools 子进程 vs Core 内 `IToolProvider`）、执行期 hash 校验点。
- **S5 端点增量清单 + contract-as-code 管线**：受影响端点（pack install、mode publish、`/orchestration`×2、`POST /sessions`、`/replay`）+ 请求/响应新增字段（additive-only）+ 管线纪律（`TinadecCore/tests/__snapshots__/openapi.core.json`、`TinadecGateway/tests/__snapshots__/openapi.external.json`、`apps/desktop/src/generated/schema.d.ts`、`npm run generate:client`/`check:drift` 同提交再生）。
- **S6 新表规约 + bootstrapper 列对账**：Tenant/Workspace+Revision/ETag+Status 同规、是否走 draft/publish、ETag 卡点；`DbContextSchemaBootstrapper`/`DbContextMigrationParticipant` 列对账纪律（引 governance `GovernanceNonceMaterial` 迁移空操作导致 `capability_leases` 漂移的生产事故）。
- **S7 失败码 + 事件分类**：三闸失败态遵循 snake_case + RFC9457（`code`+`trace_id`）；新行为审计事件名（图遍历、gate 判定、身份锁定、实例池调度）。
- **S8 签名信任模型（决策：Phase 1 仅 digest，签名后置）**：Phase 1 不建 `agent_pack_signatures`、digest 已足够；签名信任模型（密钥存 `ISecretStore`、验签点 preview vs install、吊销、失败码）设计移入后续 Phase，避免 buzzword。
- **S9 R4 闭合为单一选项**：资源包络归宿 Phase 1 单选 = `ToolDispatcher` 内 `ToolResourceAllowList` 提升为具名可测步骤（命令式），Governance path-URI-scheme 后置（与 R5 hash 变更同批）；Ch8 标注"R4 必闭合"。
- **S10 可视化投影形状**：两个 `/orchestration` 端点（session 级 + run 级）改哪几个、真图 DTO（声明节点/边 + 实例叠加 + 数据流边来源：事件 vs checkpoint）、与 `/replay` 一致性、**additive-only**。
- **S11 关系描述文件大小上限 + prompt 装配注入点 + token 预算**：大小上限、注入到 prompt 装配哪一段（Core protocol→agent system prompt→PromptPipeline→task evidence→final constraints）、token 预算处理（`default_token_budget=8192`、`context_token_threshold=6000`），防"包络内自派发先撑爆 context"。
- **S12 spawn/并行预算数值来源与优先级**：TOML 现值（`[spawn] depth 2/16 实例/4 并行`、`[scheduling] 活跃 run 2`、`[orchestration] lanes 4/6`）与 ModeBinding 包络优先级（只能收窄）、TOML 是否需新段。
- **S13 定义清单 secret 卫生**：只存名称不存值，沿 `.tinadec/sandbox.json`(gitignored)+`ISecretStore` 引用纪律（库行不存 secret 值）。
- **S14 MAF 隔离 + Architecture 层依赖测试**：MAF 类型不出 DmaEA 适配器；Architecture 层依赖测试对新 Resolver/新表的约束。
- **S15 测试计划**：每闸 ≥1 pinning 测试（成功+失败态各一）、hash-pin 漂移测试、双写漂移检测测试、projectless 哨兵往返 property test、审批门 E2E。
- **S16 迁移回滚/备份故事**：2026-09-04 `.bak` 快照先例、bootstrapper DDL 不可逆 → 备份/回滚策略与双读窗口。

## 复用 vs 重写 vs 新增（代码实体级）

- **直接复用**：`CapabilityRuleMatcher`、`GovernanceService.{EvaluateBoundaries,ValidateLease,ValidateParentGrant,ConsumeLeaseAsync,NewLease}`、`ToolApprovalCoordinator.{TryConsumeApprovalAsync,DecideAsync,NormalizeProjectId}`、`AutoApprovePolicyRules`、`JsonCanonicalizer`+`ValidateEnvelopeCore`、`ToolManifestHasher`、draft/publish/Revision/ETag、`OrchestrationPolicy` lane 基础设施、已入库 `mode_edges`/`SnapshotJson`、`AgentSpawnRequest`/`FrozenAgentTemplate`/spawn 能力门(`HasCapability`)/预算与系谱、`CoreVirtualToolPolicy`/`create_workspace`、`AuthorizationBoundary` 交集语义、`SelectWorker` worker.general fallback。
- **必须重写**：`FormalModeResolver.ResolveRosterAsync`（去 `DirectUserOutput=slug=="meeting"`:170/`ContextAccess`:171/op-exec 计数:191/`LifecycleFor`:319，改按 edges 遍历；双写期保留模型策略栈+prompt hash+tool_scope override）、`FrozenRunConfiguration`（去 `IsMeeting`:236/双 lane；新字段走 schema version+双读）、`CoreAuthorizationContextResolver`（operation 地板保留只收窄）、`AgentConfigurationService.PublishAsync`:74+`AgentPackService.ValidateResources`:1180-1184（去 meeting 强制、加图语义校验）、`AgentInstanceService`:167 种子、`agent_definitions` 宽表拆分、checkpoint 单例→身份+池、6 处 `AllowedResources=["workspace"]`。
- **新增**：`agent_templates(_versions)`、`mode_bindings`、`tool_definitions(_versions)`（均按 S6 表规约）；按图遍历 Resolver（与 lane 双写）；检查器三闸；三命名空间映射表；`AgentPackDtos` 加 `resources.tools`+徽章（optional，签名后置）；orchestration 真图 DTO（additive-only）；ConversationIdentity 存储/API+哨兵统一。

## 3 智能体 vibe MVP 规格（Doc1 Ch11，Phase 1 基准）

- **模板**：`meeting`（operation，职责名=统筹编排，caps=`user.converse`(对应现有 `user.respond`)+`task.dispatch`+受限 spawn(`agent.create_temporary`，含 `agent.spawn` 别名)，对话身份持有者，无直接业务工具，徽章=已固定）；`search`（execution，职责名=检索取证，tools=`mcp_search`/`mcp_invoke`/`read_file`）；`global_engineering`（execution，职责名=全域工程执行，tools=`read_file`/`write_file`/`shell`/`git_*`）。
- **能力去向说明**：`task.dispatch`=会议→执行层派发边+真实 spawn 链路的能力声明（非独立 PDP claim）；`user.converse` 对应现有 `user.respond`；`agent.create_temporary` 已是 spawn 能力门真实能力（含 `agent.spawn` 别名），落地走能力门+`required_tools`+父 grant 子集+`SpawnAsync` 通配符拒绝+预算/深度；三者对账由 Ch6 映射表定义、不做字面匹配。
- **vibe 模式包**：3 节点 + 边（meeting↔search 传 `{query,constraints}`/回 `{evidence,sources}`；meeting↔global_engineering 传 `{task,success_criteria,scope}`/回 `{artifact,verification,risks}`）+ 每节点关系描述文件（五字段，大小上限见 S11）+ 权限包络（meeting 受限 spawn→"包络内自派发"档）。**无 `worker.general`→未分类任务须由新派发器保留 fallback 或保证任务可分类（S3）。**
- **端到端验收（含审批门）**：安装智能体包（v1，digest/version 同步、新字段 optional 不破 0.2.4）→ vibe 图按边遍历（lane 双写期以冻结快照为准）→ 会议智能体包络内派发 → 检查器三闸通过 → `write_file`/`shell`/`git_push` 命中审批门时 run 驻留 `awaiting_user`、批准后唤醒续跑（scripted 模型驱动真实 TinadecTools 子进程）→ 图可视化显示声明拓扑+运行数据流 → 用户只与会议智能体对话（身份锁定）→ projectless 会话仅 `create_workspace` 可用、绑定后下一次交互才拿完整工具面（回归守住）。

## 后续路线图（代码在文档确认后启动）

- **Phase 1（MVP）**：数据模型（Template/ModeBinding/Instance+ConversationIdentity 含哨兵统一）+ 包 v1 原地扩展（tools hash-pin+模式包图+徽章，新字段 optional，**不含签名**）+ 图驱动 Resolver（与 lane 双写）+ 检查器三闸（先建三命名空间映射+每闸输入/规则/失败态+失败码/事件规范）+ 图可视化（additive-only 真图 DTO）+ 3 智能体 vibe 端到端（含审批门 E2E+projectless 回归）；轻量单进程。**内部顺序：先加表/Resolver/检查器，冻结 hash（`FrozenConfigurationHash`/`ContentHash`）变更收尾。**
- **Phase 2（全量迁移）**：旧 14 智能体/7 模式迁到新模型（仍 v1）；补齐"确定性行走"与"自由搭建"档；非对话智能体并行实例池；消化 H1-H7；R4 的 Governance path-URI-scheme 与 R5 hash 变更同批闭合；引入 pack 签名信任模型。
- **Phase 3（集群档，可选）**：治理地板不破前提下落地分布式租约/消息总线/共享上下文存储，多节点部署与高并发压测。

## 风险与保留的不变量

- **保留（不可裁地板）**：权限不可扩大、operation 工具 deny 地板、配置可复现（冻结+hash-pin）、事件可审计、外部副作用不重复、有效权限交集（全 allow/任一 deny）、一次性 nonce/租约过期 fail-closed、治理/PDP/审批/审计任何档位不裁。
- **风险**：① projectless 回归（哨兵 5 点、R1-R6、H1-H7）→专章+往返 property test+现有 projectless 测试门禁；② 引擎重写+checkpoint 单例改池→scripted E2E+现有 lane/审批测试门禁；③ `mode_edges` 激活与 lane 双写漂移→冻结快照为准+Resolver 必保清单+双写漂移检测测试(S15)；④ `FrozenConfigurationHash` 变更冲击历史 run→schema version+双读+Phase 1 收尾做+迁移回滚/备份(S16)；⑤ "自由搭建"档自治边界→检查器+spawn 能力门+预算(TOML 现值)+系谱深度硬上限；⑥ 工具入包→首版仅 hash-pin 的 id 引用/定义清单、新字段 optional、可执行档与签名后置；⑦ 前后端契约漂移→contract-as-code 快照同提交再生+check:drift 门(S5)。

## 假设

- 两份文档用中文、置于 `docs/`、作为产品定义伴生重构文档。
- **不改契约版本**：新能力原地加进 `/api/v1`+`agent-pack/v1alpha1`，不引入 v2；`metadata.version`+digest 同步升位。
- **v1 新增字段一律 optional**：`resources.tools`、徽章、图 data-contracts 等可选 + 缺字段默认语义（tools 缺省=空即纯 id 引用旧行为；templates 由现有 agents 推导；徽章按携带内容推断；data-contracts 缺省不额外约束）+ reader 容忍未知字段，保证旧包 0.2.4 不破。
- **签名 Phase 1 不做**（仅 digest）；工具入包首版只 id 引用(hash-pin)+定义清单，可执行档后置。
- MVP 搜索能力用 `mcp_search`/`mcp_invoke`；browser.* 若要用须先确认 live manifest 注册。
- 契约改动同提交再生 openapi.core.json/openapi.external.json/schema.d.ts 并过 check:drift。
- 首个可运行切片用 scripted 模型验证治理/图遍历/审批门/projectless 链路，不要求真实模型 live smoke。