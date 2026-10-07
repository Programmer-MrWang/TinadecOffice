# 输入框命令面板与空间编排实施记录

日期：2026-10-08。起始源码基线：`66d103e`；实施期间用户并行Markdown工作将HEAD经`5c506ea`推进至`5520821`，本功能仍在工作树中。各验证结果按日志时间和限定范围记录，不将并行修改自动算作已验证。关联：[APP-HOME-104](../../docs/development-program/02-modules/app/home/TODO.md#app-home-104)、[APP-RENDERER-104](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-104)。

用户已授权实施，并明确要求不考虑旧版本兼容。实现采用统一新契约：平面选择已发布预设，空间直接按六项功能组合运行；没有“沿用旧运行方式”或启用新编排的过渡入口。原始讨论见[调研稿](../research/2026-10-07-composer-command-panel.zh-CN.md)。

## 界面与会话控制

- `ComposerBar` 的 `+`、`/`、原工具栏设置入口统一打开 `ComposerCommandPanel`，位于输入框上方；图片/文件在默认列表顶部。
- 目录读取真实 provider 与已发布模式，模型覆盖作用于对话根智能体。模式/模型/权限在同框子页选择；空间提供计划、规范、协作、工作流、公告板、Worktree。工作流选择具体已发布图。
- 支持中英文搜索、精确命令优先、IME、键盘选择、Esc返回/关闭、焦点恢复与未知 slash 显式作为正文发送。Portal显式获取材质，ResizeObserver跟随输入框宽度，限高列表支持窄窗口。
- HomeController统一拥有当前会话选择，保存到Core并显示pending/error。保存回执与标题更新共用写入顺序和revision；较旧回执不覆盖新选择。
- 会话首发、普通发送和全局命令入口均使用同一设置；队列晋升保留提交时的模式、权限、模型（包括明确无覆盖）及空间选项。异步取消/晋升/插入绑定来源会话，不重读后来选中的会话。
- 首条消息附件先建立带所选设置的草稿会话；创建/上传期间禁止发送，避免附件和正文分属不同会话。

源码：`apps/desktop/src/components/{ComposerBar,ComposerCommandPanel,ChatPanel,CommandPalette}.vue`，`lib/{composerCommands,composerSettings}.ts`，`controllers/HomeController.ts`；平面UIE ChatCard与SpatialPage传递同一控制器设置。

## 新契约与持久化

会话新增 `permission_mode`、`space_options`、`settings_revision`。PATCH允许 `expected_settings_revision`，冲突返回 `session_settings_conflict`；完整校验后一次保存，不产生部分更新。

`clear_meeting_model_override` 表达恢复默认模型；`clear_mode_version` 绑定当前工作区默认模式的已发布版本。省略PATCH字段表示不修改，这是部分更新语义，不是旧版本兼容逻辑。

空间选项为完整对象：`plan_first`、`spec_enabled`、`multi_agent`、`workflow_mode_version_id`、`bulletin_board`、`worktree`。布尔默认false，工作流默认null。平面不接受空间选项；运行中insert不能重新配置已冻结任务。

Core捕获发送时选择，持久到排队指令并在准入冻结。保存设置不修改运行中任务。Gateway仅透传和规范化会话响应，公开Core拒绝码；Core/OpenAPI、Gateway/OpenAPI与Desktop生成类型同步。

源码：`Contracts/Dtos/StorageRequestDtos.cs`、`Memory/ProjectSessionStore.cs`、`AspNetCore/Endpoints/{Storage,Interactions}Endpoints.cs`，SQLite/PostgreSQL `SessionComposerSettings` 迁移；`TinadecGateway/src/{externalDtoOpenApi,index}.ts`。

## 六项空间能力

| 选项 | 执行行为 |
| --- | --- |
| 计划优先 | 只读调查和简单答复可继续；变更/派发前需要实际持久化的计划，随后继续执行。不是只读Plan预设。 |
| 规范驱动 | requirements→design→tasks逐份提案和人工确认，保存内容、hash与revision；已确认tasks复用为计划。确认不被full-access或委托审批替代。 |
| 多智能体 | 控制新的派发与spawn能力；关闭不停止Core治理。工作流需要执行者时明确拒绝冲突组合，不偷开选项。 |
| 工作流 | 复用所选发布ModeVersion的声明图；准备阶段与正式图分离，不把有工具的根节点误判成普通Solo流程。 |
| 公告板 | 按run收窄公告板访问，不修改整个会话组织成员权限，不删除历史或禁用治理直接通道。 |
| Worktree | 每run准备一个工作树，经正常工具授权/审批，建立租约后才执行工作；失败或租约丢失不回落原目录。不自动合并/删除用户改动。 |

空间以已发布、可直接执行的授权资源为基础，记录来源版本，再收窄/组合实际运行图与工具面。不是把六项开关映射成六个互斥模式。

Spec本轮复用审批参数存储：单文档最多3000字符，完整审核JSON最多3584字符；tasks须为1–20条Markdown任务清单。超限明确拒绝，绝不截断后让用户批准。界面完整显示待审正文，仅允许本次文档批准/拒绝。

源码：`DmaEA/{SpaceCompositionPolicy,FullDuplexRunEngine.Space,FrozenRunConfiguration}.cs`，`Tools/CoreSpecProposalTool.cs`，`Runtime/FormalModeResolver.cs`，工具调用、TinaChat与审批授权接缝。

## 验证记录

本次分层验证：

- Core会话存储/SQLite结构/OpenAPI 19/19；队列解析1/1；模式提交不回写、冻结图投影、租约失效3/3。最终TRX保存于[运行证据目录](../evidence/2026-10-08-command-panel-runtime/)。
- Gateway全量80/80；Desktop最终全量1024 passed、14 skipped（109文件通过、1文件按现有配置跳过），native/scripts107/107，类型/生产构建通过。构建有大chunk提示，不影响成功退出。[日志与摘要](../evidence/2026-10-08-command-panel-validation/checks.json)。外部OpenAPI客户端重复生成SHA256一致。
- 实际命令面板组件Electron：平面/空间三宽度，360×600视口、明暗主题、blur材质、搜索及键盘；[检查记录](../evidence/2026-10-07-command-panel-implementation/checks.json)。这是实际SFC和本地目录夹具，不是完整应用或模型验收。
- Spec实际ApprovalTab SFC：320/520px完整3000字符、可选择/pre-wrap/滚动、无横溢出，只有本次批准/拒绝；[检查记录](../evidence/2026-10-07-command-panel-implementation/spec-checks.json)。
- 空间运行14/14 API集成通过，采用真实Core管线、脚本模型和测试Tool Provider：计划真实门、Spec全访问/委托模式仍逐文档确认、无项目Spec、Spec+工作流完整规范进入规划上下文、工作流冲突、Worktree+工作流实际根、失败/租约失效拒绝回落、公告板按run隔离、空模型捕获与冻结图投影。[最新API TRX](../evidence/2026-10-08-command-panel-runtime/runtime-api-final.trx)。工具Provider为测试替身，不将其等同真实Git进程或外部模型运行。
- 最新源受影响编排/单元回归89/89；[单元TRX](../evidence/2026-10-08-command-panel-runtime/runtime-unit-final.trx)。规划、重规划、执行、监督、收尾均获取已确认规范和实际执行根；API脚本对规划器输入正文及Worktree根有明确断言。`runtime-api-before-planner-context.trx`仅保留修补前记录，最终验收依据带final的文件。
- Core运行专项的来源、覆盖与限制汇总见[summary.json](../evidence/2026-10-08-command-panel-runtime/summary.json)。

未调用付费模型；未验证PostgreSQL实机、三平台安装包或完整应用与外部模型端到端。保留用户并行开发的Markdown/依赖改动；最终类型检查发现MarkdownRender的Element空值收窄遗漏，仅补显式非空判断，不改变渲染行为。全量测试另暴露happy-dom缺少doctype，与实际应用标准模式不一致；在全局测试setup补HTML doctype后，Markdown14项回归通过。没有提交Git。
