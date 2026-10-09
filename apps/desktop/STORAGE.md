# Desktop 存储与配置

## 多文件夹工作区（2026-10-10）

工作区的源文件夹、主要目录、名称、图标和颜色以实际存储根 project.toml 为权威；目录授权归可信宿主登记。原生 select-workspace-folders IPC 返回路径数组，选择与取消不初始化存储。统一窗口确认后只提交一次创建；编辑携带内容摘要 If-Match。创建只在主要目录初始化一份 .tinadec，附加目录不初始化，更换主要目录不改变存储位置。

本机 tinadec.sidebar.workspaces.v1 保存整体/逐工作区折叠、全部显示和手动顺序；tinadec.workspace.context.v1 保存新对话上下文，稳定键为 storage_id::project_id，自由对话为 user::free。这些 UI 偏好不保存权限或替代会话事实。新终端取当前主目录；已经存在的终端保持创建时的 cwd。详见 [工作区契约](../../docs/workspaces.zh-CN.md) 与 [APP-HOME-107](../../docs/development-program/02-modules/app/home/TODO.md#app-home-107)。

路径由 `electron/storagePaths.cjs` 统一解析。用户根默认 `~/.tinadec`；绝对路径 `TINADEC_HOME` 优先且不会递归读取 user_root。稳定 bootstrap `~/.tinadec/config/desktop.toml` 保存 `gateway_url` 与可选绝对 `user_root`；环境覆盖时 bootstrap 位于环境根 config。不会读取、迁移或删除旧平台目录、settings.json 或旧 panel-layout。

“设置 → 关于 → 显示 Debug Studio”默认关闭，写入同一个本机 bootstrap 的 `[developer] debug_studio_enabled = true/false`，不写项目配置。Gateway URL 被环境管理时仍读取此偏好。仅可信主窗口可保存和打开；禁用后广播重新读取并关闭调试浮窗，renderer 路由也拒绝关闭状态的直接链接。常规局部保存保留其他字段及注释，特殊有效 TOML 形状仍按既有序列化器保存字段。裸 Vite 预览使用独立 `tinadec.preview.debug-studio-enabled` 浏览器 UI 状态，不能操作真实 desktop.toml 或代替可信宿主。

| 内容 | 默认位置 | 生命周期 |
|---|---|---|
| 启动配置 | `~/.tinadec/config/desktop.toml` | 权威 TOML、原子保存；环境 source/managed 可见 |
| Electron userData | `~/.tinadec/state/desktop` | UI 状态、preferences、UIE layout、pets |
| Chromium sessionData | `~/.tinadec/cache/desktop` | 浏览器缓存，与状态分开 |
| panel 布局 | `~/.tinadec/state/desktop/panel-layout.json` | 原子保存，不写平台顶层 dotfile |
| Electron/子进程日志 | `~/.tinadec/logs/host` | 默认10 MiB 单文件/整个 logs 200 MiB；读取 logging.toml |
| 自由会话源码目录 | `~/TinadecProjects` | 可配置源码目录，不属于产品存储或缓存 |
| 受管 worktree | `<scope>/worktrees` | 独立工具授权与工作树生命周期 |

Electron 在 ready 前设定 userData/sessionData/logs。Pet registry 与资源通过 userData 自然归属 state/desktop/pets，内存预览缓存保留原容量约束。TOML 使用 smol-toml 完整解析；启动配置错误显示文件后停止启动；Gateway URL 保存保留其他字段，重序列化不保留注释。

打包服务接收 resolved `TINADEC_HOME` 和用户 storage identity，不强制覆盖 TOML backend 或数据库路径。stdout/stderr 进入主进程日志 sink；预算递归统计同用户 logs，淘汰 rotated 文件，保留当前 `.log`。Core runtime 日志参与同一预算，文件消失竞态正常处理。

项目打开使用 Core `storage/scopes/open`。Desktop 保存实体 ID 对应的 scope 集合，界面用 storage_id::entity_id 区分复制项目，线上剥离复合选择键为原实体 ID。每次 HTTP 请求开始前捕获 `X-Tinadec-Storage-Id`；设置项目选择绑定客户端；run/event fetch-SSE 重连沿用原作用域和 replay cursor。聚合项目/会话列表保持 user 宿主来源。浮窗携带 storageId 上下文固定自己的来源，主窗口切换不会改变浮窗请求。

无项目选择的模型、Agent、模式、提示词、Pack、治理和运行管理控件固定 user，标题明确“用户默认配置”，不继承 Home 当前项目。项目模块配置在存储页选择 scope 编辑权威 TOML；Tools/overview/资源/使用者统计绑定其独立项目选择。

“存储与配置”页展示实际路径、外部模式、backend、诊断和分类使用量；支持 root/backend 显式切换、cache/temp/logs 预览清理、模块 TOML 校验与内容 hash CAS 保存。离开时保护草稿，CAS 冲突不覆盖草稿。用户根/backend 成功保存后显示重启要求；用户根变更仅 IPC 写稳定 bootstrap，当前图不即时替换；项目切换由 Core 空闲检查控制，不自动复制/删除旧数据。

Agent 的整项目存储写范围默认关闭。main 生成私有随机 TINADEC_HOST_CONTROL_TOKEN，只传 Core/Gateway 子服务；开发 orchestrator 可在可信启动环境共享同一随机凭据，main 接收后立即从自己的 process.env 删除，后续 Chromium/普通终端不继承。Vite/plugins 启动环境明确剥除此值。token 不进入 renderer/TOML/localStorage；复用既有 Core 若不持有本轮 token 会拒绝请求。

scope-enabled Core 对全部 /api/v1 请求验证私有宿主头；公开 GET health 仅提供最小指纹，GET host-challenge 仅提供角色和随机 nonce 绑定的 HMAC 证明。读取、预览、普通配置、审批、永久删除、打开/关闭/导出与迁移均在此边界内，不能让 Agent shell 利用 localhost HTTP 间接访问受保护 data/state。Gateway 只转发请求携带的凭据，绝不因 local mode 或自身环境存在 token 而替匿名请求签发。

`electron/hostIdentity.cjs` 先验证 Core/Gateway 各自的公开 challenge，nonce 为32随机字节的43字符 base64url，证明为 HMAC-SHA256(token, `tinadec-host-v1\0<role>\0<nonce>`) 的小写hex。请求不发 token、拒绝重定向，角色不可互换，nonce/proof 必须匹配。serviceManager 不能凭 health 指纹复用陌生服务；新启动与复用均须证明身份。main 只有两个端点均验证后才允许网络/敏感IPC/Node动作签发；15秒重新验证失败即撤权，需重启恢复。开发入口不默认开启匿名 CDP 端口；Vite 宿主源码本身仍必须受信任，可被 Agent 改写的宿主开发源码不是产品隔离边界。

`electron/trustedHostRequests.cjs` 在 session.webRequest.onBeforeSendHeaders 为显式登记的 main/panel/debug 窗口签发；每次复核主 frame 仍在 app://bundle/index.html（或启动时固定本地 Vite 入口）、目标为已验证的 HTTP 127.0.0.1:48730/48731且路径为 /api/v1。localhost/IPv6 别名可对应不同监听，不能继承 IPv4 证明或私有头。预览子 frame、worker、pet、未知窗口不签发；导航开始暂停，离开受信入口后停止，销毁即撤登记。所有网络目的地先剥除已有私有头，跨站重定向不能带出凭据。HTTP/fetch-SSE 不需在 JS 中拿 token。维护 storageAction/write-policy/user-root IPC 也复核受信主 frame，不能仅凭同一个 webContents 身份在导航后继续操作。未绑定可信宿主的 Web/远程界面不能读取或操作 scope-enabled Core，返回 host_authorization_required；本地 token 不发送到远程服务。

验证入口：Desktop typecheck/Vitest；Electron appConfig/storagePaths/logSink/hostControl/trustedHostRequests/serviceManager Node tests；`electron/trustedHostRequests.probe.cjs` 为隔离 userData 的真实 Electron HTTP/SSE/frame/导航/重定向夹具，须在48730/48731空闲时单独运行，不加载用户配置或真实服务。

分类清理、未引用正文回收、关闭连接、取消登记、整个项目存储删除分别调用 Core 的独立动作；GC/删除必须复核展示的 preview token，页面显示引用/路径/容量。ZIP 下载保留原存储。自由会话菜单明确选择目标 storage_id，排队消息未排空拒绝；迁移接受后暂停来源 SSE，轮询 user 宿主 receipt，完成后按目标 scope 选择会话。若另一个浮窗仍持有相关 SSE，迁移 worker 等待其关闭。

关闭动作暂停本窗口目标作用域的 session/run SSE，等待既有请求、运行和其他浮窗的连接释放；界面可取消关闭，失败/取消后恢复连接。维护冲突或重复关闭返回409，取消关闭由 Core 恢复运行图可用状态。迁移 worker 为 pending 并重试独占租约；历史配置版本保留 DB。MCP server 本身是用户信任的 OS 进程，不处于 Agent 文件工具沙箱中。

完整产品不变量与动作→写入表以 `docs/tinadec-core-product-definition.zh-CN.md` §21 为准。本文件只解释 Desktop 实现入口。
