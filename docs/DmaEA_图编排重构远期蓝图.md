# DmaEA 图编排重构：架构蓝图（第一交付物 = 设计文档）

> 目标仓库：`c:\git\agent\TinadecOffice\TinadecCore`（活跃副本；仓库内另有旧副本 `c:\git\agent\TinadecCore`，本次重构不动它，文档需显式标注这一事实源）。
> 产物是**一份架构蓝图文档**，供你评审；代码在文档确认后按 Phase 1+ 推进。
> 契约纪律：**始终 v1**——新能力原地加进 `/api/v1` + `tinadec.io/agent-pack/v1alpha1`，不引入 `/api/v2`、不引入 pack v2、不维护兼容别名；**但新增 schema 字段一律 optional**（见 Ch4/假设），否则旧包 0.2.4 事实 breaking、与"始终 v1"自相矛盾；`metadata.version` 与 manifest digest 必须同步升位（否则触发已发生过的 409 `agent_pack_version_hash_conflict`，[AgentPackService.cs:968](file:///c:/git/agent/TinadecOffice/TinadecCore/AgentConfiguration/AgentPackService.cs#L968)；`newer_installed` 见 :964）。

## 摘要

把 DmaEA 从"meeting 唯一出口 + 硬编码 Plan→SelectWorker→Supervise 流水线"重构为**权限包络驱动的图编排框架**。核心策略是**复用治理内核、重写调度与配置模型**：治理/审批/租约/nonce/校验内核几乎零改动复用；真正重写的是把双层不变量写死进代码的耦合点、`agent_definitions` 宽表、以及 checkpoint 的单例智能体字段。本轮更正前两轮"agent.create_temporary 不存在"的硬错误（它确实存在于 spawn 能力路径），并收紧 v1 optional 字段纪律、R1-R6 展开、Phase 1 冻结 hash 收尾顺序。第一刀仍是 **3 智能体（会议 + 搜索 + 全域工程）+ 一个 vibe 模式** 的轻量单进程切片。框架**通用、模块化、可伸缩**：Core 规范定位不变（MAF 治理运行时），"通用智能体框架"是同一事物的伸缩形态，不是第二套定位。

## 已锁定的设计决策（评审基准）

- **三层分离**：`AgentTemplate`（模板：职责名/默认职责描述/默认工具/权限上限/提示词管线）→ `ModeBinding`（模式内：本模式职责描述文件 + 工具开关 + per-mode 权限包络 + 图节点/边 + 实例命名策略）→ `RuntimeInstance`（运行期：可生成名字 + 父系谱 + 冻结有效权限）。同一模板可并行派生多实例，名字可各自生成，职责描述文件共享。
- **对话身份 ConversationIdentity**：治理层、持对话权限 + 身份标识；会话创建时选定后**不可改、跨模式不变**；可由**共享 `context_revision` + 共享工具的并行实例池**承载。PD-03 从"meeting 硬编码唯一出口"泛化为"每会话唯一治理层对话身份"，唯一性不变量保留。**必须统一 projectless 的三种编码**（wire `Guid.Empty` / durable `NULL` / policy `IsProjectlessScope`），自带 `ToWireSentinel`/`FromWireSentinel` + 往返 property test。
- **编排语义 = 权限包络决定的连续谱（三档共存）**：无 spawn 权限→按声明节点/边**确定性行走**；受限 spawn→图=允许通信边+边上数据类型+权限包络，读关系描述文件**在包络内自派发**；全权限+单节点"总监体"→图退化为提示词素材、**自由搭建**（轻量档典型形态）。三档**触发条件由权限包络可判定**（详见 Ch5）。
- **权限包络 = 复用 Governance `AuthorizationBoundary`**（由 `CapabilityRuleMatcher` 求值，语义为**全部 boundary 都 allow 才通过、任一 boundary deny 即拒**的交集；这套"全 allow/任一 deny"正是包络语义地基，直接复用不重写）。
- **operation 禁工具 = deny-by-default 地板（不是"改为包络声明"）**：现有 `operation_layer_cannot_invoke_tools` DenyBoundary（[CoreAuthorizationContextResolver.cs:78](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/CoreAuthorizationContextResolver.cs#L78)）是 2026-08-31 双层闭包的纵深防御（治理通配符有前科）。**地板恒 deny，ModeBinding 包络只能在此之上收窄、永不放宽**；检查器第二闸写成硬规则。
- **智能体包（v1 原地演进）= 模板 + 工具 + 模式包**；模式包 = 一个文件夹（智能体配置 + 图 + 关系描述文件）。**工具入包首版只允许两档**：① 仅工具 id 引用（**必须 hash-pin 到冻结 manifest 条目**——id 解析到 TinadecTools 常驻子进程的活实现，会变，不 pin 不可复现）；② 工具定义清单（受控导入注册表）。**"可执行实现"档后置/不做**（违反"Core 不宿主可执行工具代码、经 `IToolProvider` 治理"边界，属架构反转）。信任徽章两级（"已固定/经审查"、"权限受限/需安装"），均以 hash-pin 为前提；完整性/签名**复用 `JsonCanonicalizer`**（RFC 8785/JCS + SHA-256）。**新增字段一律 optional + 缺字段默认语义 + reader 容忍未知字段**。
- **检查器三道闸**：① 包装入闸（徽章 + schema + digest/version 同步 + 签名）；② 模式发布闸（**先建三命名空间映射**才可对账；operation 工具地板硬规则；**对话身份唯一性 + 对话权限校验**；图/描述声称能力经映射后 ⊆ 权限包络）；③ 运行冻结闸（对话身份锁定、实例池共享上下文合法、有效权限交集、`FrozenConfigurationHash` 一致）。**每闸须以"输入/规则/失败态"统一格式落文档**（Ch6）。
- **图可视化**：声明拓扑作底图 + 运行期实例与真实数据流叠加；`/orchestration` 投影改为返回真图（不再 `graph=null`）。
- **可伸缩性 + 治理地板**：轻量档（单进程/SQLite/少量智能体，甚至单节点总监体）↔ 中量档（单节点 + 完整治理 + lanes + 并行实例池）↔ 重量档（多节点集群，后置 Phase 3）。**治理/PDP/审批/租约/nonce/审计/冻结哈希是任何档位都不可裁的地板**；可裁的只有 provider 种类与实例数量。轻量档 ≠ 治理旁路。

## 修正与补回 → 文档落点（逐条可核对）

**A. 8 项专家修正**

1. **自由对话/projectless 专章（最高风险）**：文档第 7/8 章独立一节。交互风险 **R1-R6 逐条展开**：**R1** 哨兵 `Guid.Empty`↔`NULL` 有 5 处双向翻译点须同步（[NormalizeProjectId:1193-1199](file:///c:/git/agent/TinadecOffice/TinadecCore/Lifecycle/ToolApprovalCoordinator.cs#L1193) 及 :78/:96/:130/:1114/:1166、`ToolInvocationScopeResolver`、Gateway `sessionMapper.ts:40`；漏改→create_workspace 审批门前被拒 / 幂等静默误报）；**R2** `create_workspace` 合成 manifest 故意不与 tool_scope 求交（[ToolManifestSnapshotResolver.cs:36-56](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolManifestSnapshotResolver.cs#L36)）→ ModeBinding 若是包络则出现绕过漏洞（建模为 ModeBinding 之上的 **Core 保留能力**，记 `IncludesCoreReserved`）；**R3** `AllowedResources` 硬编码 `["workspace"]`×6（FullDuplexRunEngine 1812/3188/3413/3422/3468/4118）→ `ToolResourceAllowList` 恒真、当前无路径约束（RuntimeInstance 接管资源包络须同改 6 处 + 注意 `SpawnAsync` `IsSubset` 锁死通配继承）；**R4** Governance 无 path 维度（claim 仅 `tool://<id>`）→ 资源包络须新增 URI scheme 或继续单点命令式检查；**R5** `FrozenRunConfigurationV1`/`RunRecord` 无 project 字段 → 加 RuntimeInstance 引用改 `ContentHash` → 历史 run 失配（需 schema version + 双读窗口）；**R6** 对话身份 vs `session.ModeVersionId` 强弱未定（projectless ≠ modeless，仍强制 ModeVersionId，[FrozenRunConfiguration.cs:143](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/FrozenRunConfiguration.cs#L143)）。附既有空洞 **H1-H7**（UserToolAction 不支持 projectless、无快照/回滚安全网退化为纯审批门、memory NULL 误捞、无"仅自由对话"筛选、SessionLocks 单进程、migrate 不回填历史、create_workspace 先建目录后落库无补偿）。
2. **operation 禁工具**：见锁定决策"deny 地板 + 只收窄"，纠正原"改为包络声明"。
3. **对账算法**：文档第 6 章**先给三命名空间映射表**——capabilities（能力串）↔ tool id ↔ `AuthorizationBoundary` claim（PDP/lease/approval 实际只消费 `CapabilityClaim("tool.invoke", read|mutate, "tool://<id>")`，[ToolDispatcher.ToolClaim:799-833](file:///c:/git/agent/TinadecOffice/TinadecCore/Tools/ToolDispatcher.cs#L799)）。跨空间 ⊆ 无意义，必须先映射。**`agent.create_temporary` 已存在于 spawn 能力路径**（spawn 能力门 `HasCapability(parent.Capabilities,"agent.create_temporary")`，[AgentInstanceService.cs:200-206](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/AgentInstanceService.cs#L200)；`agent.spawn` 是其别名，[:513-514](file:///c:/git/agent/TinadecOffice/TinadecCore/DmaEA/AgentInstanceService.cs#L513)；`bootstrap-agent-directory.toml:19/73` 与多个测试已声明）——**它是能力命名空间声明、不是 PDP claim 字面，对账不做字面匹配**；真实 spawn 链路 = 该能力门 + `required_tools` + 父 grant 子集(`IsSubset`) + `SpawnAsync` 通配符拒绝 + 预算/深度上限(`AgentSpawnLimits`)。（更正前两轮"不存在"口径。）
4. **工具入包**：见锁定决策"首版仅 id 引用(hash-pin)+定义清单、可执行档后置"+ digest/version 纪律 + optional 字段。文档第 4 章明确拍板。
5. **lane vs 边：双写过渡，不"取代"**：文档第 5 章写明"冻结快照为准的双写期" + **新 Resolver 必保行为清单**：`user_binding > mode_node_override > agent_version` 模型策略栈、prompt hash 校验（`VerifyHash`）、tool_scope override（[FormalModeResolver.cs:76-163](file:///c:/git/agent/TinadecOffice/TinadecCore/Runtime/FormalModeResolver.cs#L76)）、以及 lane 承载的 M5/M6/M8 deferred lane、escalation、`lane_key` 投影、审批 payload。
6. **MVP 工具面与审批现实对齐**：`browser.search`/`browser.fetch` **在 TinadecTools 未注册**（真实为 `shell`/`read_file`/`write_file`(审批)/`mcp_search`/`mcp_invoke`(审批)）→ 搜索智能体改用 `mcp_search`/`mcp_invoke`；`global_engineering` 的 `shell` 永不 auto-approve、`git_push` 有保护分支守卫 → **scripted E2E 必须把审批门（awaiting_user 驻留/唤醒）写进验收**；`checkpoint.MeetingAgentId/PlannerAgentId/SupervisorAgentId` 单例（FullDuplexRunEngine 428-429/1019/2372-2373/3402-3403）与并行实例池冲突 → 引擎改动点指名：改为"身份 + 实例池/主实例 + 池"。
7. **轻量裁剪治理地板**：见锁定决策"治理/PDP/审批/租约/nonce/审计/冻结哈希不可裁"。文档第 9 章明列不可裁地板 vs 可裁项。
8. **定位一句话**：文档第 2 章声明"通用智能体框架 = Core（MAF 治理运行时）的伸缩形态，非第二套定位"。

**B. 4 处必须补回**

9. **"权限包络 = 复用 AuthorizationBoundary"独立锁定句**：已在锁定决策清单（`CapabilityRuleMatcher` 全 allow/任一 deny）。
10. **"重构期冲突以本蓝图 + 代码为准"**：补回 Ch1（产品定义与蓝图打架时的仲裁依据）。
11. **Ch6"每闸输入/规则/失败态"统一格式 + "对话身份唯一性"字样**：补回 Ch6 章纲。
12. **Ch8"SQLite/PostgreSQL 同批迁移"**：补回 Ch8；旧 14/7 过渡策略在 Ch8 与 Phase 2 双处保留。

**C. 3 处建议补回**

13. **Ch5"三档触发条件"（可判定语义）+ 关系描述文件五字段枚举**（职责/输入输出/允许派发目标/成功判据/可生成智能体类型）：补回 Ch5。
14. **Ch2 目标/非目标清单**（图工程、动态分工、名字与职责解耦、个人电脑高效、复用内核不推倒重来）：补回 Ch2，与定位句并存。
15. **Ch9"无 Tool provider / mock provider 的轻量问答档"示例 + Ch10 卡片字段枚举（工具开关/职责名/名字/层/徽章/对话身份标识）+ Ch4"复用 JsonCanonicalizer"明示**：逐字补回。
16. **MVP 中 `task.dispatch` 去向说明**：见 MVP 规格。

**D. 本轮更正与收紧**

17. **agent.create_temporary 更正**：改"现实中不存在"为"已存在于 spawn 能力路径（含 `agent.spawn` 别名）、是能力声明非 PDP claim 字面、不做字面匹配"（涉及 A.3、Ch6 章纲、MVP 能力去向、MVP caps 四处；摘要/锁定决策本无此错）。
18. **v1 新增字段 optional 纪律**：Ch4 + 假设明写——`resources.tools`、徽章/签名、图 data-contracts 等新字段全部 optional + 缺字段默认语义（tools 缺省=空→退回纯 id 引用旧行为；templates 由现有 `agents` 推导；徽章缺省=按携带内容推断；data-contracts 缺省=不额外约束）+ reader 容忍未知字段。
19. **R1-R6 展开**：见 A.1（每条一句）。
20. **Phase 1 内部顺序**：先加表/Resolver/检查器，**冻结 hash（`FrozenConfigurationHash`/`ContentHash`）变更收尾**，消解风险④与"Phase 1 含数据模型"的表面张力。

## Phase 0：撰写架构蓝图文档（本次唯一交付物）

新建 `docs/dmaea-graph-orchestration-architecture.zh-CN.md`（产品定义的重构伴生文档，每章落到真实文件/类/表 + mermaid）：

1. **文档定位与事实源**：与现有产品定义的关系；**重构期冲突以本蓝图 + 代码为准**（仲裁规则）；标注 `TinadecOffice/TinadecCore` vs 旧 `TinadecCore` 副本；**契约始终 v1**。
2. **设计目标/非目标**：定位句（通用智能体框架 = MAF 治理运行时的伸缩形态，非第二套定位）+ 目标/非目标清单（图工程、动态分工、名字与职责解耦、模块化可轻量到集群的可伸缩谱系、个人电脑高效、复用治理内核不推倒重来）+ 非目标（不引入 v2、首版不做可执行工具入包、不为智能体数量提前拆微服务）。
3. **核心概念模型**：三层分离（Template/ModeBinding/Instance）、ConversationIdentity + 并行实例池、名字/职责名/职责描述文件与命名策略（固定 vs 生成）。
4. **智能体包（v1 契约原地演进，不升版本）**：`resources.{agents(templates), tools, modes(mode-packs)}` 加进现有 `v1alpha1` schema；模式包文件夹结构（agent-config + graph(nodes/edges/data-contracts) + relationship-description-files）；工具入包首版两档（id 引用 hash-pin + 定义清单）+ 信任徽章 + **复用 `JsonCanonicalizer`** 做完整性/签名 + digest/version 同步纪律；**新增字段全部 optional + 缺字段默认语义 + reader 容忍未知字段**；安装链路改动点。
5. **图编排语义连续谱**：**三档触发条件（由权限包络可判定）**；**激活已入库但未被消费的 `mode_edges`**；新增按边遍历的运行时 Resolver 与 `FormalModeResolver` 的 lane 分流**双写过渡（不取代）** + **新 Resolver 必保行为清单**；关系描述文件结构化契约**五字段枚举（职责/输入输出/允许派发目标/成功判据/可生成智能体类型）**。
6. **检查器（三道闸）**：**每闸的输入/规则/失败态统一格式**；**三命名空间映射表**（capabilities ↔ tool id ↔ `tool.invoke` claim）；真实 spawn 链路对账（`agent.create_temporary`/`agent.spawn` 是能力声明、非 PDP claim 字面，不做字面匹配）；operation 工具 deny 地板硬规则；**对话身份唯一性 + 对话权限校验**；图/描述 ⊆ 权限包络 的对账算法。
7. **治理与审批的复用与改写**：直接复用清单（内核）；必须改写的耦合点；operation 地板保留、包络只收窄。
8. **数据模型与迁移**：新表 `agent_templates(_versions)`、`mode_bindings`（含 `IncludesCoreReserved`）、`tool_definitions(_versions)`（hash-pin）、`agent_pack_signatures`；改表 `agent_definitions` 瘦身、`agent_instances` 引用 (Template+ModeBinding)、`mode_edges` 激活、checkpoint 单例字段改身份+池；**SQLite/PostgreSQL 同批迁移**；**旧 14 智能体/7 模式过渡策略**；**自由对话/projectless 专章**（R1-R6 逐条 + H1-H7 + 哨兵统一 + `FrozenConfigurationHash` 双读窗口）。
9. **模块化与可伸缩性（轻量↔集群）**：通用框架的模块化组合边界与按场景裁剪（**含无 Tool provider / mock provider 的轻量问答档示例**）；**治理不可裁地板 vs 可裁项**；轻量档（单进程/SQLite/少量智能体）；中量档（单节点复用 lanes/`context_revision`/并行 run）；重量档（多节点：消息总线 + 分布式租约 + 共享状态库）后置说明。
10. **图可视化（前端）**：声明拓扑 + 运行数据流叠加；**智能体卡片字段枚举（工具开关/职责名/名字/层/徽章/对话身份标识）**；`/orchestration` 投影契约改造（返回真图）；会话创建时选并锁定对话身份。
11. **3 智能体 vibe MVP 规格**（见下）。
12. **分阶段路线图 + 风险 + 保留的不变量**。

## 复用 vs 重写 vs 新增（代码实体级）

- **直接复用（内核，几乎零改动）**：`CapabilityRuleMatcher`、`GovernanceService.{EvaluateBoundaries,ValidateLease,ValidateParentGrant,ConsumeLeaseAsync,NewLease}`、`ToolApprovalCoordinator.{TryConsumeApprovalAsync,DecideAsync,NormalizeProjectId}`、`AutoApprovePolicyRules`、`JsonCanonicalizer` + `ValidateEnvelopeCore`、`ToolManifestHasher`、draft/publish/Revision/ETag、`OrchestrationPolicy` lane 基础设施、已入库的 `mode_edges`/`SnapshotJson`、`AgentSpawnRequest`/`FrozenAgentTemplate`/spawn 能力门(`HasCapability`)/预算与系谱、`CoreVirtualToolPolicy`/`create_workspace` 通道、`AuthorizationBoundary` 交集语义。
- **必须重写（耦合点）**：`FormalModeResolver.ResolveRosterAsync`（去 `DirectUserOutput=slug=="meeting"`:170 / `ContextAccess`:171 / operation-execution 计数硬校验:191 / `LifecycleFor`:319 slug 硬编码，改按 edges 遍历；**双写期逐条保留模型策略栈 + prompt hash + tool_scope override**）、`FrozenRunConfiguration`（去 `IsMeeting`:236 / 双 lane 硬绑定；新增字段须走 schema version + 双读）、`CoreAuthorizationContextResolver`（operation 地板保留、只收窄）、`AgentConfigurationService.PublishAsync`:74 + `AgentPackService.ValidateResources`:1180-1184（去 meeting 强制、加图语义校验）、`AgentInstanceService`:167 种子去 `seed.Id=="meeting"`、`agent_definitions` 宽表拆分、`checkpoint.MeetingAgentId/PlannerAgentId/SupervisorAgentId` 单例 → 身份+池、6 处 `AllowedResources=["workspace"]`。
- **新增**：`agent_templates(_versions)`、`mode_bindings`（per-mode 权限包络 + 工具开关 + 实例命名 + `IncludesCoreReserved`）、`tool_definitions(_versions)`（hash-pin）、`agent_pack_signatures`；按图遍历的运行时 Resolver（与 lane 双写）；检查器三闸（输入/规则/失败态）；三命名空间映射表；`AgentPackDtos` 加 `resources.tools` + 徽章/签名（optional）；orchestration 投影返回真图；ConversationIdentity 哨兵统一 + 往返 property test。

## 3 智能体 vibe MVP 规格（写入文档第 11 章，Phase 1 实现基准）

- **模板**：`meeting`（会议智能体，operation，职责名=统筹编排，caps=`user.converse`(对应现有 `user.respond`)+`task.dispatch`+受限 spawn(`agent.create_temporary`，含 `agent.spawn` 别名)，对话身份持有者，无直接业务工具，徽章=已固定）；`search`（execution，职责名=检索取证，tools=`mcp_search`/`mcp_invoke`/`read_file`——**不用未注册的 browser.***）；`global_engineering`（execution，职责名=全域工程执行，tools=`read_file`/`write_file`/`shell`/`git_*`）。
- **能力去向说明**：`task.dispatch` 不是独立 PDP claim，而是"会议→执行层派发边 + 真实 spawn 链路"的能力命名空间声明；`user.converse` 对应现有 `user.respond`；`agent.create_temporary` **已是 spawn 能力门的真实能力**（含 `agent.spawn` 别名）、落地走能力门 + `required_tools` + 父 grant 子集 + `SpawnAsync` 通配符拒绝 + 预算/深度。三者对账规则由 Ch6 三命名空间映射表定义、**不做字面匹配**。
- **vibe 模式包**：3 节点 + 边（meeting↔search 传 `{query,constraints}`/回 `{evidence,sources}`；meeting↔global_engineering 传 `{task,success_criteria,scope}`/回 `{artifact,verification,risks}`）+ 每节点关系描述文件（五字段）+ 权限包络（meeting 受限 spawn → 命中"包络内自派发"档）。
- **端到端验收（含审批门）**：安装智能体包（v1，digest/version 同步、新字段 optional 不破 0.2.4）→ vibe 图按边遍历（lane 双写期以冻结快照为准）→ 会议智能体在包络内派发 → 检查器三闸通过 → `write_file`/`shell`/`git_push` 命中审批门时 run 驻留 `awaiting_user`、批准后唤醒续跑（scripted 模型驱动真实 TinadecTools 子进程）→ 图可视化显示声明拓扑 + 运行数据流 → 用户只与会议智能体对话（身份锁定）→ projectless 会话下仅 `create_workspace` 可用、绑定后下一次交互才拿到完整工具面（回归测试守住）。

## 后续路线图（代码在文档确认后启动）

- **Phase 1（MVP）**：数据模型（Template/ModeBinding/Instance + ConversationIdentity 含哨兵统一）+ 智能体包 v1 schema 原地扩展（tools hash-pin + 模式包图 + 徽章，新字段 optional）+ 图驱动 Resolver（与 lane 双写）+ 检查器三闸（先建三命名空间映射 + 每闸输入/规则/失败态）+ 图可视化 + 3 智能体 vibe 端到端（含审批门 E2E + projectless 回归）；轻量单进程。**内部顺序：先加表/Resolver/检查器，冻结 hash（`FrozenConfigurationHash`/`ContentHash`）变更收尾**，避免历史 run 失配阻塞前期。
- **Phase 2（全量迁移）**：旧 14 智能体/7 模式迁到新数据模型（仍 v1）；补齐"确定性行走"与"自由搭建"档；非对话智能体并行实例池；消化 H1-H7 空洞。
- **Phase 3（集群档，可选）**：治理地板不破前提下落地分布式租约/消息总线/共享上下文存储，多节点部署与高并发压测。

## 风险与保留的不变量

- **保留（不可裁地板）**：权限不可扩大、operation 工具 deny 地板、配置可复现（冻结 + hash-pin）、事件可审计、外部副作用不重复、有效权限交集语义（`AuthorizationBoundary` 全 allow/任一 deny）、一次性 nonce/租约过期 fail-closed、治理/PDP/审批/审计任何档位不裁。
- **风险**：① projectless 回归（哨兵 5 点、R1-R6、H1-H7）→ 专章 + 往返 property test + 现有 projectless 测试作门禁；② 引擎调度重写 + checkpoint 单例改池 → scripted E2E + 现有 lane/审批测试门禁；③ `mode_edges` 激活与 lane 双写漂移 → 冻结快照为准 + Resolver 必保清单；④ `FrozenConfigurationHash` 变更冲击历史 run → schema version + 双读窗口、**Phase 1 内收尾做**；⑤ "自由搭建"档自治边界 → 检查器 + spawn 能力门 + 预算 + 系谱深度硬上限；⑥ 工具入包 → 首版仅 hash-pin 的 id 引用/定义清单、新字段 optional，可执行档后置。

## 假设

- 蓝图文档用中文、置于 `docs/`、作为产品定义的伴生重构文档。
- **不改契约版本**：新能力原地加进 `/api/v1` + `agent-pack/v1alpha1`，不引入 `/api/v2` 或"pack v2"；`metadata.version` + digest 同步升位（沿用产品定义 §0）。
- **v1 新增字段一律 optional**：`resources.tools`、徽章/签名、图 data-contracts 等新字段全部可选 + 缺字段默认语义（tools 缺省=空即纯 id 引用旧行为；templates 由现有 agents 推导；徽章按携带内容推断；data-contracts 缺省不额外约束）+ reader 容忍未知字段，保证旧包 0.2.4 在"始终 v1"下不破。
- 工具入包首版**只支持 id 引用(hash-pin) + 定义清单**；可执行实现档后置（不与 `IToolProvider` 边界反转）。
- MVP 搜索能力用 `mcp_search`/`mcp_invoke`；browser.* 若要用须先确认 live manifest 注册。
- 框架**通用、模块化、可伸缩**：轻量档供简单场景/嵌入式，多节点集群是可伸缩谱系高端而非唯一形态；MVP 在轻量单进程验证图模型与治理复用。
- 首个可运行切片用 scripted 模型验证治理/图遍历/审批门/projectless 链路，不要求真实模型 live smoke。