# 2026-10-10 工作区真实组件与历史 HTTP 验收

本目录记录分阶段独立证据。Windows Electron 组件初轮确认新建工作区真实请求成功；短链 HTTP 夹具确认同一工作区及真实历史会话在 Core/Gateway 重启后恢复；最后一次 Electron 补验完成已有工作区编辑、明确打开已有、生产 HomeController 创建/重命名及 renderer 重载恢复。保留初轮失败，没有将 HTTP 结果代替组件结果。

## 已完成的真实行为

- Electron 43.3.0 加载生产 `electron/main.cjs`、preload、hostConnection、trustedHostRequests，以及当前源码的 HomeController、AppSidebar、WorkspaceEditorDialog、HostAvailabilityBanner。
- 宿主身份通过真实随机端口 Core/Gateway 的角色、nonce HMAC 验证；真实 WebFrameMain 与 IPC 权限代码执行。
- 点击工作区标题加号，真实对话框选择两个源文件夹。提交前两者均无 `.tinadec`；一次 `POST /api/v1/storage/scopes/open` 返回 200，只有主要文件夹 `first/.tinadec/project.toml` 创建，附加文件夹 `second` 未初始化存储。
- 短链 `history-http.mjs` 复用本轮已经初始化的独立临时用户根与项目，按返回的真实 `storage_id` 发送请求，`GET /projects` 恢复唯一登记工作区，所有源文件夹与存储根正确。
- 明确预览及安装 GraphSeedPack 到这个临时项目作用域后，真实会话创建返回 201；项目作用域历史读取返回 200，标题为“接口回归历史会话”。重启独立 Core/Gateway，再次读取仍为同一工作区、storage identity 和 session，标题保留。

## Electron 后续补验结果

`followup-server.mjs` 在最终 Desktop build 完成后复用本轮已安装 GraphSeedPack 的 owned 根、新分配 Core/Gateway/Vite 端口与 narrow 组件夹具。一次执行通过，见 `followup-desktop-acceptance.json`、`followup-service-acceptance.json`，截图 `followup-workspace-restored.png` 已目视核对：侧栏显示编辑后的工作区与两条真实历史。

| 节点 | 实际操作及结果 |
| --- | --- |
| 启动读取已有历史 | 生产 HomeController 启动；真实项目/会话 GET 200，读取“接口回归历史会话” |
| 编辑工作区 | 直接调用生产 `HomeController.editWorkspace` 打开真实 WorkspaceEditorDialog；填写名称，点击“设为主要”及提交按钮；GET/PUT workspace 均 200 |
| 主要目录与存储 | 实际 TOML 的 primary 指向 `second`，名称为 `Edited workspace UI followup`；数据仍在 `first/.tinadec`，`second/.tinadec` 不存在 |
| 明确打开已有 | 点击侧栏工作区加号、真实组件添加源文件夹按钮与“打开已有工作区”；preview 200、一次 open 200，同 project/storage identity 和编辑后名称保留 |
| 新会话及重命名 | 直接调用生产 `HomeController.createSession`、`renameSession`，经过真实 API、宿主 gate 和 storageScope；POST 201、PATCH 200；这两项不是点击产品会话菜单或重命名对话框的人工验收 |
| renderer 重载 | 真实 `webContents.reload()`；生产组件与控制器重新加载，同工作区、原历史及“UI补验创建并重命名会话”均恢复 |

此补验没有修改产品源码、重新安装 pack 或重新计算用户文件哈希。main/preload 与 native 适配边界同下文；它验证实际组件和控制器的真实业务链，不等同完整生产 App、原生选择器人工操作或安装器。

## 初轮失败及原因

`desktop-failure.json` 保留原请求记录：工作区创建 200 后，组件夹具直接调用 `HomeController.createSession`，真实 `/sessions` 返回 409；随后历史读取均为 200。此夹具没有装载 App，也没有执行 App 的 GraphSeedPack bootstrap，初始用户/项目 TOML 没有已发布默认 Agent Mode。

短链捕获完整公共错误，见 `history-precondition.json`：`code=agent_mode_not_configured`，`category=user_action_required`，`retryable=false`，detail 明确要求配置已发布默认 Agent Mode。显式安装临时作用域的 GraphSeedPack 后，同一 API 成功。这个结果确认原 409 是缺少夹具业务前置条件，不证明产品可以忽略该前置条件。

组件初轮运行期间源码保存触发了 Vite 页面重载；该事实保留在 `electron-progress.json` 与 `failure.log`。实际 409 已独立核查，没有仅以重载解释失败。初轮没有完成后续步骤；补验在前置满足和源码固定后单独完成上述节点，其具体操作方式与边界见结果表。

## 夹具边界

- 所有数据位于 `.tinadec_dev/tmp/workspace-interface-ui/runtime-09c819666a82/`，没有写入、删除或重置真实 `C:/Users/lincu/.tinadec`；端口随机分配，没有访问用户 48730/48731 服务。
- native 文件选择仅模拟返回值，生产选择处理器与宿主权限仍执行；没有人工操作真实原生文件对话框。
- 组件夹具对规范管理端点做映射，仅允许自己随机 Core/Gateway；服务由夹具先启动，因此生命周期使用 no-op adapter。真实 HMAC 请求、Core/Gateway 业务 HTTP 和作用域权限均执行。
- UI 使用现有 dist 基础 CSS，narrow UI barrel 仅重新导出生产 UiButton/UiInput；最小 renderer 不是完整 App、安装器或最终打包构建。图中字体资源相对路径有夹具警告，没有修改生产 CSS。
- 两个初轮冷启动/预算失败分别保留在 `initial-startup-failure.log`、`second-failure.log`；第三轮结果为局部 UI 创建通过，加独立短链历史恢复通过。
- 最后组件补验完成了 narrow 真实 UI 和生产控制器后续链；约四分钟静态模块加载后进入业务，一次成功，无额外重复补验。
- 结束后检查，所有 owned Node/Electron/Core/Gateway/Tools 进程已退出；未按进程名批量终止用户服务。

## 文件索引与复现

| 文件 | 用途 |
| --- | --- |
| `workspace-create.png` | 当前真实创建对话框、两个文件夹及主要目录 |
| `desktop-failure.json` | 真实组件创建成功后的请求状态和未完成节点 |
| `electron-progress.json` | 组件加载、页面重载及 HTTP 状态，不含 token/header |
| `history-precondition.json` | 精确 scope 与缺默认模式错误 |
| `history-http-acceptance.json` | 显式临时 GraphSeedPack 安装、会话创建及服务重启历史恢复 |
| `followup-desktop-acceptance.json` / `followup-service-acceptance.json` | Electron 后续组件/控制器真实链及最终 TOML 落盘检查 |
| `followup-*.png` | 已有历史、编辑窗口、明确已有打开、重命名结果及 renderer 重载 |
| `followup-server.mjs` / `followup-electron.cjs` | 复用已满足前置的 owned 根，仅一次后续组件验收入口 |
| `server.mjs` / `electron.cjs` / `renderer.mjs` | 真实组件验收入口与适配边界 |
| `history-http.mjs` | 复用独立已初始化根的短链 HTTP 验收入口 |

原组件夹具：`node .tinadec_dev/evidence/2026-10-10-interface-regression/workspace-real/server.mjs`，每次创建独立根。短链脚本依据 `fixture-location.json` 复用原有 owned 根；它要求该根尚未安装 GraphSeedPack，因此不能对已经完成本轮安装的根原样重复运行。若需重新验收，应先运行组件夹具创建新的独立根。

后续组件入口：`node .tinadec_dev/evidence/2026-10-10-interface-regression/workspace-real/followup-server.mjs`，复用 `fixture-location.json` 里的 owned 根，并要求初始恰有一条历史、主要目录尚为 first。因此不能对已完成本轮编辑与第二条会话创建的根原样重复运行。

本机结果不替代 Linux/macOS 沙箱、PostgreSQL 实库、完整生产 App 或安装器验收。

三个electron-progress JSON是公开证据投影：保留业务API、全部错误、生命周期及console事件，省略成功的静态资源请求；首条记录保存原始数量、SHA-256与本机忽略的.raw.log位置。原始事件仍在本机，不纳入Git。
