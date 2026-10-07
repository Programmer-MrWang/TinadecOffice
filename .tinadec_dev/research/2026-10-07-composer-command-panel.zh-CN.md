# TinadecOffice 输入框命令面板：源码调研与讨论稿

日期：2026-10-07。基线：`66d103e` 加当前工作树。状态：**讨论草案，不是已批准实施规格或功能交付报告**。本轮只读产品源码、查阅竞品源码与官方文档，新增本研究和独立交互草图，没有修改产品代码或运行配置，没有执行产品测试。

实施更新（2026-10-08）：用户已授权落地，并明确要求不考虑旧版本兼容。后续实现统一使用新契约：所有空间会话直接采用可组合编排，不保留旧空间运行方式、旧数据分支或迁移入口。下文调查时的兼容建议不作为实施要求。

关联主任务：[APP-RENDERER-104：空间模式与可组合运行方式](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-104)。关联模块：[Home](../../docs/development-program/02-modules/app/home/README.md)、[DmaEA](../../docs/development-program/02-modules/core/DmaEA/README.md)、[AgentConfiguration](../../docs/development-program/02-modules/core/AgentConfiguration/README.md)。本文件不另建进度数据库。

交互讨论：[独立 HTML 草图](./2026-10-07-command-panel.preview.html)。草图中的值和开关仅演示布局与交互，不能证明后端已实现。

## 1. 从用户原意出发

- 点击发送框左侧 `+` 与输入 `/` 打开同一个命令面板，出现在发送框上方，是独立圆角矩形。
- 图片、文件入口在默认列表顶部。面板还管理模型、模式和会话能力。
- 平面与空间用同一套视觉和交互；空间提供更多可组合功能，用户选择开启哪些能力。
- 空间不要求用户先选择一个决定整套能力的固定模式套餐。后台仍可有运行基础配置，但不把内部拓扑选择当作空间的主要操作。
- 用户补充：计划的具体规则应由我们结合双层架构提出建议，平面与空间可以不同。
- 用户已澄清“激活模式”不是一个需要新增的概念：**平面选预设智能体模式；空间通过选项自定义智能体编排**。不再新增“激活方式/系统模式”占位字段。

## 2. 已有代码的真实状态

以下路径都相对于本仓库。行号是本轮工作树的定位点。

| 源码定位 | 已验证事实 | 对实现的影响 |
| --- | --- | --- |
| `apps/desktop/src/components/ChatPanel.vue:187`；`pages/SpatialPage.vue:430` | 两种界面共用 `ComposerBar` | 应改造共享入口，而不是各写一套面板 |
| `apps/desktop/src/components/ComposerBar.vue:295,553` | `+` 是独立附件菜单 | 可复用上传流程；统一菜单状态和锚点 |
| `apps/desktop/src/lib/appCommands.ts:96` | 已有 `/new /stop /queue /parallel`；Ctrl+K 也用此注册表 | 不是从零新增 slash；扩展现有注册表并选择上下文子集 |
| `apps/desktop/src/components/ComposerBar.vue:692`；`pages/SpatialPage.vue:436` | 空间隐藏模式选择器；capabilities 插槽只有“会议”标签；下沉后工具栏隐藏 | 空间确实缺能力控制面，也需要持续可达的设置入口 |
| `apps/desktop/src/components/ModeSelector.vue:32,107` | 目录来自已发布模式版本，打开时刷新 | 目录动态加载不等于会话设置热切换 |
| `apps/desktop/src/controllers/HomeController.ts:469`；对应测试 `:168` | 已有 session.mode_version_id 优先于 picker 传来的值，测试明确期待忽略新 picker | 必须调整前端会话更新契约，否则新面板切换模式会产生假成功 |
| `apps/desktop/src/controllers/HomeController.ts:75,942` | permission 是模块内存 ref，平面/空间共用，并非会话持久设置 | 必须定义作用域，避免切会话继承无意设置 |
| `apps/desktop/src/components/ComposerBar.vue:404` | welcome-submit 与普通 submit 捕获参数不一致 | 新会话首发、已有会话发送必须共用配置快照流程 |
| `apps/desktop/src/components/ComposerBar.vue:307` | 附件当前需要 session；空欢迎页禁用 | 若首发也可附图，应建立正确类型的草稿会话或新增暂存流程 |
| `apps/desktop/src/components/ComposerBar.vue:432,473,684` | Enter 解析命令，发送按钮直接 submit；未见 isComposing 检查 | 统一提交入口，避免按钮发送原始 `/stop`；保护中文输入法确认 |

### 后端并非没有切换基础

- `TinadecCore/AspNetCore/Endpoints/InteractionsEndpoints.cs:220`：模式解析为显式请求 → 会话绑定 → 工作区默认。Core 能接收以后运行的新模式；前端当前优先级是一个具体障碍。
- `InteractionsEndpoints.cs:257,280`：向运行中任务插入消息不等于重新配置；模型 override 有冻结拒绝；对话身份迁移也有活跃运行兼容检查。
- `TinadecCore/DmaEA/FrozenRunConfiguration.cs:9`：运行准入解析一次；执行不再读取热更新配置。恢复也沿用冻结文档。
- `TinadecCore/DmaEA/AgentRuntimeConfiguration.cs:317`：已有文件监视和有效快照热加载，非法内容保留上一有效配置。但这是服务级 TOML 基线，不是会话控制 API。
- `TinadecCore/Runtime/ApprovalGateService.cs:60`：某些审批选项是构造时读取 `IOptions.Value`，不能宣传所有配置都支持即时热加载。
- `InteractionsEndpoints.cs:465` 与 `HomeController.ts:524,669`：队列保存模式、权限、模型选择；其他基础策略在真正准入时解析。新增能力选择必须明确记录到队列，不能出队时读后来改变的 UI。

### 模型和计划有容易误解的语义

`meeting_model_override` 在 `TinadecCore/Runtime/AgentModelResolver.cs:143` 作用于当前对话身份/根智能体；其他智能体仍可能有自己的模型绑定。面板应写“对话模型”，不能暗示所有智能体都强制使用它。首期若需要按规划/执行角色分别选择模型，应明确作为另一项需求。

`TinadecCore/Memory/ProjectSessionStore.cs:178` 中 null 表示“不更新 override”，不能靠传 null 实现“恢复默认”。需要显式清除语义。

`apps/desktop/src/agentPacks/GraphSeedPack/manifest.json:426,1146` 的现有 Plan 是只读调查/方案模式，确认后人工切 Solo。它不能冒充可组合的“先计划再执行”开关。Solo 本就可能为复杂任务调用 `plan_update`，所以计划关闭应解释为“不主动要求先规划”，不应假装禁止智能体思考或任何计划工具。

## 3. 术语建议：把不同控制分清

| 用户要控制的事情 | 建议表达 | 边界 |
| --- | --- | --- |
| 平面或空间呈现 | 界面/会话类型 | 当前 view_mode 创建后固定；不可悄悄用一个开关改造已有会话类型 |
| 平面已有 Team/Graph/Workflow/Solo/Plan/Review/Spec | 预设模式 | 来自发布目录，不在 UI 再硬编码另一套 mode 枚举 |
| 空间怎样处理任务 | 功能开关 | 可组合，Core 负责解释组合，不要求用户选择完整模式套餐 |
| 哪个模型回答 | 对话模型 | 首期对应根智能体；其他角色继承或绑定应可解释 |
| 哪些动作需要审批 | 权限与审批 | 与计划偏好独立；开启协作不自动扩大权限 |
| 本条消息如何进入运行 | 发送方式 | 排队/并行/插入，与一个任务内部的多智能体并行不同 |

`operation/execution` 是治理层/执行层，不是可切的系统模式。用户已明确的预设/自定义编排表达足够，不再增加一个抽象“激活模式”。

## 4. 竞品调研：借鉴什么

本机源码是当前 checkout 的证据，不保证与各项目最新发布版完全一致。Codex Desktop/Claude 的产品交互用官方文档核验，不把 Codex TUI 源码当 Desktop 源码。

| 项目 | 证据与观察 | 采用建议 |
| --- | --- | --- |
| Codex | [官方 slash 文档](https://learn.chatgpt.com/docs/reference/slash-commands)：输入 `/` 后搜索，模型、计划、推理强度等为不同命令；本地 `../codex/codex-rs/tui/src/slash_command.rs:241` 有忙时可用性判定 | 一个入口发现操作；每项需知道当前是否可执行 |
| Claude Desktop / Code | [官方 Desktop 文档](https://code.claude.com/docs/en/desktop#use-skills)说明 `/` 与 `+ → Slash commands` 可浏览命令；[Research 文档](https://support.claude.com/en/articles/11088861-use-research-on-claude)说明 `+` 开启功能后显示状态标记 | 附件、能力与命令可相邻；开启后留可见状态，不要求用户记住菜单操作 |
| DeepSeek Harness 官方 | [commands 包](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/interaction/commands/README.md)区分人类控制命令与模型消息，含范围和发现变更；[plan-mode 包](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/plan/plan-mode/README.md)持久化 active/pending，在运行步骤边界落地并提供计划审阅 | 设置走结构化控制链；需要区分请求值、实际值及等待生效。其计划主要依靠引导文本，不能当作硬工具限制 |
| OpenCode | `C:/git/agent/opencode/packages/app/src/context/command.tsx:75`、`pages/session/use-composer-commands.tsx:49` 共用命令元数据；`components/prompt-input.tsx:694` 区分内置动作和自定义提示词 | 统一数据源和处理器；不能把所有点击都转换为发给模型的文本。发现独立 slashMenu 搜索分支，但未确认实际按钮开启入口，不声称已实现完整 + / 合一 |
| OpenChamber | `C:/git/agent/openchamber/packages/ui/src/components/chat/CommandAutocomplete.tsx:240,416` 前缀排序、上浮圆角、限高滚动；[官方说明](https://docs.openchamber.dev/commands-snippets/)介绍可复用指令 | 参考紧凑行与搜索；其全局 palette 和 slash 是不同界面 |
| OpenCodeUI | `C:/git/agent/OpenCodeUI/src/features/slash-command/SlashCommandMenu.tsx:64` 计算上方可用高度、监听 visualViewport；`src/api/command.ts:29` 隔离服务器/目录/语言缓存 | 适配窄窗口和虚拟键盘；短 TTL 不能代替配置版本/刷新协议 |
| dsh-TUI | `C:/git/agent/dsh-TUI/src/commands.ts:200` 多级命令补全；`src/dsh-adapter/channel/model-switch.ts:44` 忙时拒绝切模型，空闲时继承日志创建新会话再 adopt；[指南](https://github.com/ccch1mneyyy/dsh-TUI/blob/main/docs/user-guide.md) | 学习子页和当前值显示；不要宣称换模型总能原位即时生效。该项目为第三方前端，不等于官方 Harness |
| Pi | `C:/git/agent/pi/packages/coding-agent/src/core/agent-session.ts:2463,2598,3646`：模型变化记录进会话，persist 才更新默认，推理强度按模型校正，reload 重建扩展；[README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md) | 当前会话与以后新会话默认值分开；模型参数随能力变化。计划是扩展示例，不能当作默认内置功能 |
| Hermes Agent | `C:/git/agent/hermes-agent/hermes_cli/commands.py:43,189` 包含 busy_policy、参数、范围；`apps/desktop/src/lib/desktop-slash-commands.ts:90` 区分 action/picker/rpc/exec/unavailable；[上游源码](https://github.com/NousResearch/hermes-agent/blob/main/hermes_cli/commands.py) | 命令必须标明类型、作用域、生效时间和忙时策略；模型默认只影响会话 |
| Hermes Studio | `C:/git/agent/hermes-studio/packages/client/src/components/hermes/chat/ChatInput.vue:577` slash 补全；server 的 `modules/studio/services/chat-run/session-command.ts:535` 把 plan 作为计划请求 | 一次性“帮我计划”和持续“优先规划”是不同产品语义；本轮未深挖其模型切换 |

用户所写 `hermas` 暂以 Hermes 相关项目做参考，但不替用户确定名称；`perous` 尚未确定具体仓库，不虚构调研结论。

## 5. 面板结构和交互提案

```text
╭────────────────────────────────────╮
│ 搜索命令或功能                      │  + 打开时独立搜索
│ 添加图片                            │
│ 添加文件                            │
│                                    │
│ 对话模型       当前值             › │
│ 预设模式       当前值             › │  平面显示
│ 权限与审批     当前值             › │
│                                    │
│ 空间功能                            │  空间显示
│ 先计划再执行                  开/关 │
│ 规范驱动                      开/关 │
│ 多智能体协作                  开/关 │
│ 工作流                        开/关 │
│ 公告板                        开/关 │
│ 独立 Worktree                 开/关 │
│                                    │
│ 更多会话操作                      › │
╰────────────────────────────────────╯
   对话模型 · 计划优先 · 协作             状态摘要示意
╭────────────────────────────────────╮
│ ＋  输入消息或 / 搜索             ↑ │
╰────────────────────────────────────╯
```

这里的六个空间项目来自 APP-RENDERER-104，**是待设计和实现的候选，不代表已有六个可用 switch**。根层可只露常用项，其余在同框“更多功能”，搜索仍覆盖全部。开关旁应有一行简短行为解释；需要选工作流、确定 Worktree 策略的项目可进入子页，不能强迫复杂状态只有一个布尔值。

交互规则建议：

1. `+` 打开默认完整列表，不修改正文、附件或光标；面板搜索独立保存。输入首段 `/` 打开同一数据源，后续文字筛选；可支持中文名称、英文别名。默认列表附件在顶部，筛选时按查询匹配，避免永远占位。
2. 设置命令直接打开选择或切换状态，不用再发送一条“切模型”给智能体。提示词/Skill 类命令才按声明插入正文或等待提交；未知 `/` 不能静默误发，提供保留原文的明确路径。文件路径/正文中的斜杠不误触发。
3. 模型、权限、平面预设模式用同框子页；返回保留搜索。功能开关操作后留在面板，方便连续配置。
4. 优先显示在整个输入框正上方、左对齐，宽度不超过输入框与视口可用宽度。独立圆角、轻边界和阴影，不推开消息、不跟着空间画布平移。
5. 材质沿 `usePanelStyles`，继承项目 `--surface-section / --surface-raised / --shadow-panel`。Teleport 到 body 时显式传材质属性，不能依赖断开的祖先继承；列表行不重复做 backdrop-filter。
6. 状态摘要显示当前对话模型和少量已开功能，更多折叠；完整值仍在面板。保存中、保存失败、下次任务生效必须有清楚反馈，失败保留用户选择供重试。
7. ↑↓选择、Enter确认、Esc先返回子页再关闭、关闭恢复输入焦点。保护 IME；鼠标发送与键盘提交走同一解析。复合表单/开关不要生硬塞进只有 option 的 listbox；依所用控件提供正确语义和焦点顺序。

## 6. 结合双层架构的推荐语义

### 平面：保留清晰的预设行为

平面 Plan 推荐保持当前“调研、制定方案、等待用户决定执行”。它是用户主动选择的完整预设，和 Solo/Team/Workflow 等执行方式并列；不在平面额外叠一颗含义冲突的计划布尔开关。`/plan` 在平面可打开/选择此预设，但面板文案必须说明“仅制定方案”。真正开始实现通过明确的切换或“按此计划执行”动作，而不是出完方案暗中放开原本受限的工具。

平面已有预设要从已发布目录读取；此建议保持当前 Plan 语义，不要求把其它模式都重新做成开关。

### 空间：计划是可组合的阶段，默认继续执行

空间开启“计划优先”推荐表示：复杂任务先产生可见、可更新的计划，再按任务执行，不额外引入每次都需人工批准的停顿。很短的问答可直接完成，避免所有消息都制造计划卡。若用户明确说“先讨论/只做计划”，该次指令依然优先。

关闭此选项，只取消用户指定的规划优先要求，不停用 Core 必要的任务组织、依赖检查和治理。尤其不能把它映射为“关闭治理层”或“跳过所有 planner”。关闭多智能体协作也不关闭权限/审批等 Core 职责；当前 Solo 可以由根智能体直接工作，并不要求虚构两名物理智能体。

计划选项需要影响真实运行输入与阶段/事件。用户看到“计划优先”后，复杂任务应有可检查的规划产物；不能只在前端创建计划卡，或在某份未被运行读取的配置中写 true。

### 组合优先级

1. 用户本条任务的明确要求，以及授权/资源限制始终有效。
2. 若启用工作流，先选择已发布流程；它限定阶段、声明边和交付物，计划在该边界内细化任务。当前可复用资源是 ModeVersion 的 nodes/edges/bindings，尚无独立流程资源目录，不能把新目录当现成功能。
3. 若启用 Spec，requirements/design/tasks 构成这次规划的主要产物；计划开关复用 tasks，不再并行生成另一份冲突计划。既有 Spec 的阶段确认语义保留，不因单独开启计划增加新的确认门。当前确认纪律主要在提示词中；若展示“阶段已确认”，必须新增文档修订及确认事实，不能从回复文字推断。
4. 未启用 Spec 时，计划优先独立产生轻量规划；不开计划优先则按任务需要使用内部任务分解。
5. 多智能体决定是否允许新的派发；工作流若必须由多个角色执行，应明确提示冲突，不能悄悄重开协作或改成另一种流程。
6. 公告板决定协作消息能力，Worktree 决定执行隔离；二者都不自动决定计划、权限或智能体数量。公告板组织为 session 共享，限制应冻结到单个 run，不能修改组织成员权限而误伤并行任务；用户查看历史和必要治理通道保留。

这是行为顺序提案，不表示当前引擎已有这些可组合阶段。

不要把计划、规范、协作、工作流、公告板、Worktree 的六个旧模式或组件“改成六个 switch”就算完成。需要逐项约定开启后增加什么、关闭后限制什么、怎样验证。

| 功能 | 需要先定义的行为 |
| --- | --- |
| 先计划再执行 | 推荐复杂任务规划后继续执行；简单交流不强制新建计划；关闭不禁用内部规划、不清除已有产物 |
| 规范驱动 | 推荐沿 requirements/design/tasks 与阶段确认；先复用规范产物，再执行，不把完整 Spec 模式和 Plan 模式的提示词机械拼接 |
| 多智能体协作 | 开启表示允许按任务需要派发；关闭应限制新派发，不能仅添加一句提示词；不是多条用户消息 parallel |
| 工作流 | 启用哪个流程、谁负责选择？若需要模板，开关后应能设置模板和展示当前值 |
| 公告板 | 推荐控制智能体读写协作信息的能力；收起卡片另归界面操作，关闭能力不删除历史公告 |
| 独立 Worktree | 推荐首期按任务/run 隔离，不默认每个 worker 一份；仅 Git 项目可用，产物保留供检查，不因任务结束自动删除用户改动或合并 |

补充底层证据：Spec 管线见 `GraphSeedPack/manifest.json:477`；Workflow 声明见 `:853`，graph tier 推导见 `FrozenRunConfiguration.cs:425`，有工具的对话身份可能先被判定为 solo_dispatch，因此开工作流不能只向 Solo 加一个布尔值。公告板是真实组织能力，创建见 `TinadecCore/TinaChat/TinaChatService.Organization.cs:264`，写权限见 `TinaChatService.OrganizationTools.cs:647`。Worktree 已有工具和 run 归属租约，见 `TinadecTools/Tools/Git/GitWorktreeMutationTools.cs:42`、`TinadecCore/Tools/ToolDispatcher.cs:1121`，但缺“开启后自动按策略建立隔离”的完整生命周期。

`TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs:26` 已按 run 的唯一 Worktree 租约选择任务执行根，多份租约会拒绝猜测，支持首期“每个 run 一份”的边界。隔离需在工作启动前建立，失败回报；运行结束释放租约不等于自动删除目录。新冻结字段也需考虑 `FullDuplexRunEngine.cs:450` 的严格 schema 恢复校验。

尚未接通的能力不显示为已生效：可以暂不展示，或在明确的不可用状态下说明缺失条件。所有依赖/组合限制由 Core 反馈，前端不自行猜测“看起来应该能开”。

## 7. 热加载和状态归属提案

建议面板默认调整**当前会话以后提交的任务**。另提供明确的“设为此项目新会话默认”；当前会话操作不偷偷改 TOML 或全局默认。

建议配置合并顺序是基础/工作区默认 → 当前会话选择 → 单次请求覆盖，再受已授权能力、工具和模式边界校验。这里是方案，不是现有接口的完整描述。

```text
命令/开关操作
  → Desktop 经 Gateway 请求 Core
  → Core 校验可用性、兼容性、版本与依赖，保存会话选择
  → 回传已保存值、有效值、来源、不可用原因、生效时间
  → UI 显示当前选择
发送消息
  → 捕获该次设置修订和选项 → 排队载荷持久化
  → Core 准入解析并冻结 → 实际提示词/角色/工具/调度读取同一配置
```

配置回执概念可包括 `requested / effective / source / availability / disabled_reason / effective_from / revision`，确切 API 名称待实施时以 Core 契约为准。命令定义可在现有 AppCommand 上扩展 `action / choice / toggle / submenu`、上下文范围、状态和忙时策略，避免重新造第二套注册表。

空间组合应由 Core 基于已发布、受信任的智能体/提示词/工具/流程资源解析为一致的运行配置和冻结图。前端提交用户选择，不自行拼图或篡改已发布 ModeVersion。六个开关不能简单映射为六个互斥 mode id，也不应为每种组合人工维护一份完整模式。组合的角色集合、派发权限、工具面、阶段规则、预算都要通过准入校验。

生效边界建议：

- **立即**：打开附件选择、导航、停止命令等已有明确动作；保存成功也可立即显示新选择。
- **下一次提交的任务**：计划偏好、模型、能力组合等。运行中的任务仍显示自己的冻结配置。
- **已入队任务**：保留发送当时的用户选择。需要修改已入队内容时应显式编辑并生成新修订。
- **正在运行的任务**：首期不承诺任意设置原位更换。未来若支持步骤边界切换，需要独立 pending/active 事件和引擎保证；普通 insert 消息不能假冒配置变更。
- **新会话或宿主重启**：只有确实要求此边界的选项才这样提示，不能统称“热加载”。

权限收紧、运行取消等即时控制仍走已有治理/取消通道，不借“下一轮生效”延迟用户明确的停止动作。

## 8. 建议实施切片与验收重点

这只是依赖顺序，不是已批准排期：

1. 按已明确的“平面预设/空间自定义编排”，讨论本稿推荐的计划语义、会话作用域及六种空间能力的具体行为。
2. 共用面板与命令定义；接通已有附件、对话模型、权限、平面工作模式，解决会话旧绑定覆盖新选择及模型 reset。
3. 建立 Core 会话能力覆盖和有效配置回执，完整同步 Core DTO → Gateway → OpenAPI →生成客户端。
4. 按六个能力逐项贯通“选择 → 排队 → 冻结 → 真正执行”；不存在有效配置时回报原因，不能静默忽略。

后续实现的验收应覆盖：平面/空间/欢迎页一致；中文输入法、Enter/按钮一致；草稿附件保留；会话隔离与重启恢复；旧会话切换确实影响新任务；队列与运行中修改的边界；模型恢复默认；失效模式/不支持组合的回执；窗口窄宽和空间画布下的锚定；真实运行日志与模型/工具行为验证。纯截图或前端 switch 变色不能证明功能完成。

## 9. 本轮已确定与仍可讨论

用户已明确平面选预设、空间按功能自定义编排，并要求结合双层架构推荐计划行为。推荐为平面 Plan 保留只制定方案，空间计划优先默认规划后继续执行；其与 Spec/工作流的阶段组合见第 6 节。

还可继续讨论的产品选择：是否接受本稿的上下文不同计划语义；面板根层露出全部六项还是折叠低频项；当前会话/下次任务生效是否作为统一默认；工作流模板入口及首期按 run 的 Worktree 生命周期。上述问题不需要用户先解释内部架构。

本轮没有将以上提案写成产品现状，也没有修改已有未提交业务变更。

## 10. 草图验证边界

独立草图由协作审查完成 15 项 happy-dom 交互/文案检查。主审另用本仓现有 Electron 启动隐藏、独立 userData 窗口加载本地 HTML，完成 1160×960 内容视口的平面/空间截图检查；空间面板位于输入框上方且没有越出视口，未记录浏览器控制台错误。本研究中的本地 Markdown 链接已检查存在。

证据：[空间截图](../evidence/2026-10-07-command-panel/space.png)、[平面截图](../evidence/2026-10-07-command-panel/flat.png)、[几何回执](../evidence/2026-10-07-command-panel/checks.json)、[独立浏览器脚本](../evidence/2026-10-07-command-panel/verify.cjs)。这是讨论草图验证，不是正式 Composer、窄窗口、完整应用或真实模型链路验收。
