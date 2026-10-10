# 2026-10-10 宿主 IPC 代际不一致现场核查

用户现场报错：`Error invoking tinadec:host-status: No handler registered`。只读核查没有停止、重启或操作用户 Electron PID 43656，没有读取环境变量、私钥或 token。

实际运行的 TinadecOffice Electron 主进程来自仓库 `node_modules/electron/dist/electron.exe`，入口 `electron .`，PID 43656 于 **2026-10-10 14:45:53（UTC+8）** 启动。Desktop 开发启动器 PID 30752 于 14:43:48 启动，Vite PID 38476 于 14:43:51 启动。

源码时间与进程启动存在明确先后：`preload.cjs` 最后写于 15:26:10、`hostConnection.cjs` 15:28:19、`main.cjs` 15:49:48；新宿主 IPC 注册晚于当前 main 启动。当前 `main.cjs:193` 无条件同步注册 `tinadec:host-status`，`:197` 注册 retry，早于 `:531` 的 `whenReady` 以及 `:592` 的 `createWindow`。当前源码不存在“已打开主窗口但省略这两处理器”的正常路径。

Desktop `scripts/dev.mjs` 只启动一次 Electron，监听退出后结束 Vite，没有 main/preload 文件监测或宿主重新启动；根开发启动器也没有这类监测。源文件保存、Vite 刷新并不能加载新的 Electron main。这与“旧 main 仍运行、重载后的新 preload/renderer 调用新增 IPC”一致。现场错误和启动时间足以构成强证据；本次没有读取进程内已加载 JavaScript 的内存，不将源码时间推断表述为内存快照。

最小产品处理应将缺少宿主契约识别为需要重新启动，而不是认证成功、界面预览或普通网络重连。已有 `tinadec:restart` 入口调用 `app.relaunch()` / `app.exit(0)`；当前开发启动器收到 exit 又会停止 Vite，根 concurrently 会停止同组服务，因此开发态完整启动链需要单独处理。任何重新启动必须继续由可信宿主持有私有启动凭据，不把 token 传给 renderer。

`process-source-snapshot.json` 保存选出的进程身份、启动时间及文件时间，不保存环境或原始命令行。后续独立 Electron 夹具只验证新增 IPC 缺失与现有 restart 入口，不连接用户后端、不使用真实用户根。

## 真实 Electron 契约验收结果

`node .tinadec_dev/evidence/2026-10-10-host-ipc-mismatch/server.mjs` 使用仓库现有 Vite/Vue 插件把最小 renderer 静态构建为两个模式，不安装依赖、不运行完整 App，不启动 Core/Gateway。每次创建独立 `.tinadec_dev/tmp/host-ipc-mismatch/runtime-<随机值>/`，随机静态 UI 端口；Electron 有 60 秒硬预算。

最终 `electron-acceptance.json` 的 `accepted=true`，Windows Electron 43.3.0 实际执行生产 `main.cjs`、`preload.cjs`、`HostAvailabilityBanner.vue`、hostConnection helper、useConnection 和 hostAccess：

1. 只拦截 main 对 `tinadec:host-status`、`tinadec:host-retry` 的注册，模拟旧 main 仍运行。真实 preload/IPC 返回 `No handler registered`，没有模拟 renderer 错误字符串。
2. 生产 `readHostStatus` 与 `retryHostStatus` 都返回 `restart_required / desktop_restart_required`。连接状态为 `host_restart_required`，后端访问关闭，公共 health 调用次数为 0。实际 `assertHostAccess('/api/v1/projects')` 返回结构化 `desktop_restart_required / 503`，没有发送业务 HTTP。
3. 以生产模式构建的真实 Banner 显示“桌面与界面版本不一致”，点击实际 UiButton 后经过真实 preload 与既有 `tinadec:restart` IPC，记录一次 `app.relaunch` 和 `app.exit(0)`。夹具拦截了这两个 app 方法，没有实际重启进程。这只证明入口接通，不证明安装器或完整启动链的重启行为。
4. 以 DEV 模式构建并重载的同一生产 Banner 显示从根目录重新运行 `npm run dev` 的指导，没有重启按钮，没有额外调用 restart IPC。没有宣称开发启动链可自动重启。
5. 在同一个隔离 Electron 中恢复当前 main 原有的两个真实处理器，生产 helper 得到 ready；renderer 重载后连接为 connected，Banner 隐藏。没有通过 renderer 或项目配置自我授予宿主权限。

`production-restart-required.png` 与 `development-restart-guidance.png` 是实际组件截图，已目视核对样式、文字及按钮差异。它们使用现有 dist 基础 CSS 加当前组件静态构建的 scoped CSS，不是完整生产 App 截图。

## 适配边界与保留的失败

- 只使用独立临时 `TINADEC_HOME`，没有读取真实用户配置；自己的随机启动凭据只存在子进程环境，未写入证据。没有读取用户进程环境、打印 token 或停止用户 PID 43656。
- main 的服务启动/停止和身份验证在本夹具被替代为成功；没有任何真实 Core/Gateway，也不连接用户的 48730/48731。API 公共 health 仅在 ready 后由夹具替代，主 frame、IPC、生产 helper 和权限 gate 真实执行。
- `app.relaunch/exit` 被拦截记录；最后用真实 `app.exit` 结束自己的 Electron。所有 owned Node/Electron/静态服务器已退出，用户 PID 43656 仍保持 **14:45:53** 的原启动时间。
- 最初静态 library bundle 未替换 `process.env.NODE_ENV`，renderer 报 `process is not defined`；见 `initial-renderer-env-electron-failure.json` 与对应 log。之后读取 Vue reactive snapshot 作为 executeJavaScript 结果不能克隆；见 `initial-snapshot-clone-electron-failure.json` 与对应 log。这两项是夹具问题，均只修夹具，保留失败记录。
- 第一轮通过时 scoped CSS 文件名读取错误；修正夹具读取真实生成 CSS 后再次快速通过，最终截图为样式修正后的结果。删除了重复“当前失败”文件与失败重复截图，保留上述原始 JSON/log。

目录中的 `server.mjs`、`electron.cjs`、`renderer.mjs`、`ui-barrel.mjs` 可从仓库当前依赖直接复跑；运行会建立自己的新临时根和端口，不依赖本机用户数据或固定凭据。它们不承担完整 App、安装器、真实后端运行或三平台验收。

## 提交前进程观察

末尾只读进程清单中，原 PID 43656 已不存在；仓库 Electron 出现新主进程 PID 7160，启动于 **2026-10-10 17:56:10（UTC+8）**。本次没有替用户执行该重启，也未读取新进程环境或验证其窗口业务。上文“PID 43656 仍保持原启动时间”描述的是隔离夹具结束时的观察，不表示提交时仍在运行；新进程存在不等于宿主已认证或当前窗口恢复。
