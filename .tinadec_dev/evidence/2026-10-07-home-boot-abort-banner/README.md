# 首页启动自取消请求诊断脚本（2026-10-07）

配套报告：`.tinadec_dev/reports/2026-10-07-home-boot-abort-banner.zh-CN.md`

前置条件（脚本只读探测，不改业务状态；`probe-retry-action.mjs` 会触发首页通知上的“重试”动作）：

- Desktop dev 正在运行，Electron 带 `--remote-debugging-port=9222`，渲染进程为 `http://127.0.0.1:5173/#/`。
- Gateway `127.0.0.1:48730` 与 Core `127.0.0.1:48731` 已启动。

运行：

1. `node probe-boot-race.mjs` — 注入 `fetch` 包装 + 通知 DOM 探测，重载页面 12s，输出两次 `/api/v1/sessions` 请求（含调用栈）、被取消次数、错误横幅 DOM 片段、控制台告警。会额外重载一次以移除注入脚本。
2. `node probe-store-state.mjs` — 通过 Vite dev 模块图 `import()` 读取真实通知 store 与 HomeController 状态；用一条临时通知验证模块实例同一性后自行清除。
3. `node probe-retry-action.mjs` — 调用通知项上的“重试”动作，记录 `/api/v1/sessions` 请求数与结果、动作后 store 是否清空。
4. `probe-real-failure-banner.mjs` — 反向验证：只把 `window.fetch` 对 `/api/v1/sessions` 改成抛 `TypeError('Failed to fetch')`，确认真实断连仍产出 `home-load` 错误项（不吞真实故障）。同样在结束时移除注入脚本并重载。

证据摘要（本机实测）：

- 每次整页重载都会出现两个 `GET /api/v1/sessions`（相隔约 1ms），第一个 `net::ERR_ABORTED (canceled=true)` 且 `AbortError: signal is aborted without reason`，第二个 200。
- 第一个请求栈：`loadInitial → loadSessions → api.listSessions → request → requestResult`；第二个栈位于 Vue 的 `callWithErrorHandling` 中（`watch(selectedProjectId)` 回调）。
- 通知 store 中存在 `{ key: 'home-load', level: 'error', title: '加载失败', message: '加载数据失败', details: 'Cannot connect to backend (http://127.0.0.1:48730): signal is aborted without reason' }`。
- 触发“重试”：恰好 1 次 `/api/v1/sessions` 200，store 清空，条目进入 history。

以上为**修复前**基线。修复后（2026-10-07 复验，同一探针同一机器）：

- `after-fix-boot-race.json`：每次重载只有 1 次 `GET /api/v1/sessions`，`status=200`、`abortAt=null`、`abortedCount=0`、`bannerEpisodes=[]`。
- `after-fix-store-state.json`：`items`/`history` 为空，`bodyHasCannotConnect=false`，控制器 `projects=2 / sessions=1 / busy=false`。
- `after-fix-real-failure.json`：注入真实 `TypeError` 后 store 仍出现 `home-load`（`加载失败` / `Cannot connect to backend (...): Failed to fetch` / `重试`）。
