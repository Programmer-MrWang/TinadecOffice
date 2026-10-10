# 侧边栏与多文件夹工作区实施记录

日期：2026-10-10（Asia/Shanghai）。基线：main `d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` + 工作树。用户确认的实施计划为本轮范围；此前 GraphSeedPack、存储与 UI 修订保留，未重置真实用户根、项目配置或测试包。本轮没有生成提交或推送。

正式规则见 [工作区契约](../../docs/workspaces.zh-CN.md)；唯一任务 [APP-HOME-107](../../docs/development-program/02-modules/app/home/TODO.md#app-home-107)，功能状态 APP-HOME-F007。报告是源码与验收证据，不另建任务状态库。

## 最终实现与源码对照

| 范围 | 实现及目的 | 来源 |
| --- | --- | --- |
| 工作区模型 | 稳定目录 ID、完整源集合、主要目录、名称/图标/颜色、配置摘要；独立作用域与存储锚点 | IWorkspaceDefinitionProvider.cs、Runtime/WorkspaceDefinition.cs |
| 目录授权 | 用户宿主登记维护当前/历史 grants；项目文件改变目录集合不能自授予；新建锚点必须为主目录 | StorageScopeRegistry.cs、StorageScopeRegistry.Workspaces.cs |
| 初始化与编辑 | 只初始化创建时的主目录；预览只读、已有显式打开、条件写与文件租约、原子替换、保留未知字段/注释 | StorageScopeInitializer.cs、WorkspaceDefinition.cs |
| 请求与 DTO | preview/read/edit、ETag/If-Match；目录、主要目录、图标/颜色/摘要；Gateway 代理与生成 schema 同步 | StorageScopeEndpoints.cs、StorageEndpoints.cs、Gateway storageRoutes/externalDtoOpenApi/projectMapper、Desktop api/schema |
| 控制器上下文 | 初始自由对话、显式恢复、新聊天沿当前工作区、Composer 切换进入新对话、按作用域独立加载和单项重试 | HomeController.ts |
| 侧边栏 | “工作区”标题（箭头在文字右侧、仅保留一个创建入口）、纯折叠行、加号/菜单/拖动隔离、可排序的自由对话项、最近五条加当前旧会话、显示全部、统一手动顺序与单滚动 | AppSidebar.vue、useWorkspaceList.ts、UIE NavCard.vue |
| 工作区窗口 | ReKa/Ui/材质、原生多选、本机已有目录、主要目录与名称联动、图标颜色、最后/主要项移除约束、单次提交及失败详情 | WorkspaceEditorDialog.vue、workspaceFolders.cjs、main/preload/env/previewShim |
| 新运行范围 | scope、完整 roots、primary、配置摘要与写策略冻结；切换 cwd 不重写冻结根；进程池加入 scope/根集合/策略 | ToolConfigurationResolver.cs、TinadecToolsProcessManager.cs、ToolInvocationScopeResolver.cs |
| 文件/搜索/命令/Git | 多目录读取与写入、搜索 root_id/relative_path、显式 cwd 和 repository_path；保护产品存储；私有 Windows runner 可信源集合 | ToolExecutionContext.cs、FileToolRuntime.cs、FileSearch.cs、SandboxPaths.cs、WindowsSandboxBackend/Runner/AccountManager |
| 引用与快照 | 多目录资源 claim 统一目录 ID，消除主目录子路径与附加根同名冲突；快照 root ID/相对路径与历史授权 | ToolResourcePathRegistry.cs、WorkspaceBundleSnapshotProvider.cs、WorkspaceSnapshotService.cs |
| PostgreSQL 实库修复 | 原始向量连接与 EF 共用作用域 schema；数据库扩展显式命名空间、Npgsql 参数、微秒时间比较；拒绝级联删除数据库扩展 | ServiceCollectionExtensions.cs、PostgresProjectVectorDatabase.cs、VectorStorePgVector.cs、ConfigurationProjectionCoordinator/Validator、StorageMaintenanceService.cs |

工作区行折叠始终留在本机列表，不选择会话、不改 scope、不改页面布局。配置编辑通过明确窗口；归档、回收站、显式会话迁移与存储删除保持各自既有语义。附加源目录不产生第二份 .tinadec，更换主要目录后原存储根保持不变，现有终端和运行继续按原目录绑定。

本机偏好键 `tinadec.sidebar.workspaces.v1` 与 `tinadec.workspace.context.v1` 使用稳定作用域身份；显示顺序不依赖更新时间。窗口目录与权限由可信宿主表达，列表偏好与 project.toml 均不能扩大授权。旧单目录配置只读为单源，显式编辑才保存新字段。

## 设计参考

用户提供的 Qoder 工作区列表、工作区创建及 Codex 项目列表/创建截图，用作“标题分组、会话缩进、独立创建入口、源文件夹列表”的交互参照。截图中的其他产品功能没有被推断为本产品能力。UI 实现读取仓库 shadcn-vue 技能与现有 ReKa/Ui/材质组件，保留 UIE 宿主，不引入另一套布局或无关组件库。

多文件夹配置与授权延续上一轮独立作用域和 TOML 权威契约；没有复制竞品的后端模型。用户指定本轮仅本机已有目录，因此远程主机与多设备创建没有加入窗口。

## Windows 实际交互与工具证据

环境：Windows、Electron 43.3.0、.NET 10，独立随机 UserRoot、源目录和 Core/Gateway 服务。`desktop-native.json` 及 `desktop-native-http.json` 记录真实生产 preload/目录选择处理器与真实业务接口；列表九条会话行是明确的 UI 夹具，未写入业务数据库。

验收动作包括原生目录窗口选择两个源目录、确认创建、近期五条加当前旧对话、显示全部/收起、项目行折叠保持 scope/对话、行加号不触发折叠、编辑主要目录、刷新恢复和明确打开已有工作区。HTTP 记录只有两次 open（一次创建、一次明确打开）与一次 workspace PUT。选择后确认前没有初始化；附加源目录始终未创建 .tinadec；编辑保留原存储根与原有工作区身份。

`tool-process.json` 记录真实 TinadecTools apphost 子进程在两目录的同名文件读写、全源搜索、外部目录/受保护存储拒绝、冻结范围收窄后的旧目录拒绝，共八个工具回执。`MultiFolderToolTests.WindowsCommandAndGitUseAnAuthorizedSecondaryFolder` 真实启动普通用户子进程并在附加目录检查 cwd、执行 Git；该用例验证 runner/cwd，不是低权限账号 ACL 证据。

Windows 低权限 Shell 探针曾等待账号初始化的系统授权，自动化没有接受 UAC，超时结果保留 `tool-process-failure.json`。因此低权限账号 Shell 的完整跨目录写入/拒绝仍待人工或具备授权的测试环境验收。不会把文件工具通过或普通进程 Git 通过写成 OS 权限通过。

原生截图保存为 `workspace-create/edit/sidebar/existing.png`，随后材质主题夹具复用生产 useTheme 的截图使用 `visual-` 前缀，保持原生证据不覆盖。主题夹具实际显示窗口并等待绘制后截图；创建、编辑、近期/全部列表、已存在信息与最终侧栏均已视觉检查。一次冷启动创建超过夹具原先 55 秒等待窗口，失败记录保留；改为 180 秒后真实请求与文件结果通过，未修改产品重试策略或重复提交。该夹具是实际组件连接真实服务，不是完整 App、真实模型、所有 UIE 组合或安装包走查。

## 回归与平台层级

完整命令、逐用例结果和最新去重计数保存在 [证据目录](../evidence/2026-10-10-workspaces/VALIDATION.md) 与 `validation-summary.json`。重复运行同一用例不累计为额外测试。

- Desktop 四个定向文件最终 62/62，无跳过；vue-tsc 通过；原生 IPC 1/1。单项重试既保留其他工作区列表，也在配置恢复后解除该工作区的旧 availability 错误。
- Gateway 存储代理及 external OpenAPI 快照 6/6。Core OpenAPI 首次产生预期契约漂移，审查生成快照后后续回归通过；保留最初 TRX。
- Windows Core 最终去重 63 项：62 通过、1 项 PostgreSQL 未设置环境时明确跳过、0 失败。覆盖初始化/重复打开、外部模式、移动/复制、隔离、冻结、CAS、注释、取消、快照和文件恢复；最后配置与删除保护专项 21/21，已经纳入去重数，不额外相加。首次存储删除预览回归出现一次 500，随后专项复跑正常；保留失败证据并增强测试断言输出响应，不将最初失败抹去或虚称已定位修复。Windows Tools 40/40、资源引用 34/34，平台返回型用例不当作 POSIX 内核证据。
- 新增工作区移动用例最初使用单目录 open 被 403 拒绝，改为真实产品流程“预览完整配置→明确打开完整目录集合”后通过。该修正保留宿主授权边界，未增加自动扩大目录权限的兼容入口。
- Linux 使用本机 Fedora 44 / WSL2、.NET 10.0.300、Bubblewrap 0.13.0 与 Landlock；本轮脚本独立目录、独立 PostgreSQL 集群/数据库和 artifacts。首次 PostgreSQL 挂载因缺 pgvector 失败，补齐测试依赖后继续真实读写。后续发现并修复数据库级 pgvector 扩展与作用域 search_path 不匹配、原始连接未固定 schema、沿用 SQLite 参数前缀，以及 TOML 的 100ns 时间与 PostgreSQL 微秒精度导致发布版本被误判改写。保留 initial、second、third、fourth、fifth 失败记录，各次用例的最终结果由汇总账本记录。
- Linux Core 最终去重 28/28，无跳过；真实 PostgreSQL 18.6 / pgvector 0.8.0 在空库与已有 `vector_dependency` 扩展命名空间两种数据库中都通过同一完整用例，不把重复执行累计。实测包含同域 ID、不同向量维度、会话归属拒绝、TOML 原字节、历史版本改写拒绝、主目录切换、重启及扩展归属删除保护。
- Linux Tools 28/28，无跳过；其中依赖 Linux 内核的用例实际启动了 Bubblewrap/Landlock 子进程，覆盖两源目录同名写入、附加目录 cwd、越界拒绝、环境清理、空设备、请求线程结束后的进程存续和超时终止进程组。macOS 专属分支在 Linux 不执行，不能按总数推断已覆盖 macOS。

Linux 工具验收最初出现测试环境和夹具问题：环境清理后找不到临时 SDK 的运行时，随后主源目录夹具落在被只读绑定的 test apphost 目录内。分别通过临时注册已安装测试 runtime（结束后还原）及将两源目录夹具放在程序目录/隐式临时授权之外处理；未放宽产品授权、保留环境变量或改沙箱保护。`linux-workspace-tools-initial/second.trx` 保留失败，最终文件记录通过；已核对临时注册还原与自有 PG 集群停止。

pgvector 新安装放数据库公共 schema；业务连接始终仅使用本作用域 search_path。已安装扩展按数据库实际命名空间引用，不自动移动现有类型或数据。向量实测在两个工作区使用相同租户/项目/source/model ID、不同维度，验证写入、搜索、删除与重启隔离。历史时间字段仅按 PostgreSQL 实际保存精度比较，不改 TOML 原字节；修改一个完整秒仍被拒绝。若历史扩展放在某工作区 schema 内，删除预览与执行会拒绝级联删除，要求数据库管理员先处理数据库级依赖。

- macOS Seatbelt、macOS Desktop/安装器、本轮 CI、Windows 低权限账号 Shell 与完整真实模型链分别待验收。CI 已包含多目录与 PostgreSQL 用例，但配置存在不代表已运行成功。

生产 Desktop bundle 的本轮构建与最终类型结果分别记录；已有大 chunk 提示属于既有 bundle 边界。本次不改变发布配置、部署或用户服务，不用编译替代实库/内核测试。

## 文档闭环

正式契约提供目录、TOML 与“用户动作→写入”表；Core 产品定义 §21.7 引用该契约。Home README/ARCHITECTURE/STATUS/TODO 持有实施状态；Renderer、本机状态、Persistence、Core Tools、文件搜索、Git、命令终端、沙箱及 Gateway 模块引用同一任务和证据。根与相关 AGENTS 同步，reindex 校验并生成唯一总入口，保留此前专项和整体模块审计。

最终 reindex：55 个模块、24 个 Core 工程、82 个架构节点、138 项功能、129 项任务、240 个 Markdown、2194 条链接，0 错误；该结果仅证明文档与源码索引一致，不替代产品验收。运行中的用户开发服务保持原状态；新 Core 接口需要开发服务正常重启后加载，测试从始至终使用独立 artifacts 与临时根。


## 2026-10-10 侧栏第二轮交互修正

用户回访指出四处问题，均已按统一排序模型修正：

1. 组折叠指示器原先在“工作区”文字左侧；现在紧跟在文字右侧，触发器同时保留可访问名称与真实 aria-expanded。
2. 空列表时另有一个虚线“添加工作区”按钮，与标题行加号重复；已删除该空态按钮，标题行加号成为唯一创建工作区入口。
3. 收起整组时列表容器用 v-show 退出布局，底部工具区因此上浮；现在列表占位保留、只隐藏内容，页脚始终贴住侧栏底部。
4. 自由对话此前被硬编码在首位且不可拖动；现在它与项目工作区共用同一个本机顺序，可用整行拖动（落点上半区放到目标前、下半区放到目标后）、菜单上移/下移或 Alt+方向键重排，无手动顺序时仍默认在前。

组件回归此时 24/24（AppSidebar + useWorkspaceList），类型检查通过；真实预览页已确认箭头位于文字右侧、仅一个创建按钮、折叠时页脚几何位置不变、自由对话行 draggable=true 且带 aria-keyshortcuts。桌面底栏与排序均为本机状态，不改变工作区 TOML、权限或存储位置。
