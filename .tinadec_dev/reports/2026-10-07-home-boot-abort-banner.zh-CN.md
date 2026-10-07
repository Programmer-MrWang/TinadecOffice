# 首页启动“Cannot connect to backend … signal is aborted without reason”误报诊断（2026-10-07）

**状态**：诊断完成后已在同一工作树实施修复并通过真实 Electron 复验（见「修复（已实施）」与「修复后验证」）。后端/网关本身健康。

**现象**：Desktop 首屏加载后弹出错误通知（标题「加载失败」、正文「加载数据失败」、详情 `Cannot connect to backend (http://127.0.0.1:48730): signal is aborted without reason`、按钮「重试」）；点击「重试」后通知消失且不再出现。

## 结论

这是一次**前端自己取消自己的请求**，被 API 层包装成“连不上后端”后当成真实故障上报：

1. `HomeController.loadInitial()` 在 `HomeController.ts:152` 把 `selectedProjectId` 从 `null` 写成首个项目 id。
2. 该写入触发 `HomeController.ts:812` 的 `watch(selectedProjectId, () => void loadSessions())`；watch 回调在微任务里执行，晚于 `loadInitial` 紧随其后的 `await loadSessions()`（`HomeController.ts:153`）。
3. 于是 `loadSessions()` 第二次进入并在 `HomeController.ts:180` 执行 `sessionListAbort?.abort()`，取消了第一次 `GET /api/v1/sessions`。
4. `api.ts:2541-2556` 的 `requestResult` 用 `catch` 把**任何** fetch 失败重写成 `new Error("Cannot connect to backend (...)")`，丢掉了 `AbortError` 身份。
5. `HomeController.ts:171-174` 的 `isAbortError()` 只认 `name === 'AbortError'`，包装后的普通 `Error` 不匹配 → `HomeController.ts:201-205` 重新抛出 → `loadInitial` 的 `catch`（`HomeController.ts:155-162`）弹出上述通知。
6. 点「重试」时 `selectedProjectId` 已是同一值，Vue 不再触发 watch，只有一次 `loadSessions()`，成功后在 `HomeController.ts:154` 执行 `dismissByKey('home-load')` 清除通知。

即：首次请求被取消是无害的（第二次请求正常装载数据），报错文案与“连接失败”语义都不成立。

## 现场证据

探测脚本与说明：`.tinadec_dev/evidence/2026-10-07-home-boot-abort-banner/`（CDP 9222 + Vite dev 模块图，每次整页重载稳定复现）。

- 网络：一次重载内两个 `GET /api/v1/sessions` 相隔约 1ms；第一个 `net::ERR_ABORTED (canceled=true)`、`AbortError: signal is aborted without reason`，第二个 200。
- 调用栈：第一个 = `loadInitial → loadSessions → api.listSessions → request → requestResult`；第二个位于 Vue `callWithErrorHandling` 内（`watch(selectedProjectId)` 回调）。
- 通知 store（真实模块实例）：`{ key:'home-load', level:'error', title:'加载失败', message:'加载数据失败', details:'Cannot connect to backend (http://127.0.0.1:48730): signal is aborted without reason', kind:'status', count:1 }`。
- 触发通知上的「重试」：恰好 1 次 `/api/v1/sessions` → 200；`items` 清空，条目进入 `history`（即 `dismissByKey` 生效）。
- 后端：Gateway `/api/v1/health` = `{"status":"ok","gateway":"ok","core_status":"ready"}`，Core 同址 `/api/v1/health` = `ok`；`projects=2`、`sessions=1`，控制器 `busy=false`。
- 同一缺陷还有两处复制：`apps/desktop/src/generated/client.ts:98-105`（`req`）与 `:117-124`（`reqWithEtag`），被 `stores/workbench.ts`、`stores/run.ts`、`settings/sections/*` 等使用，同样的取消也会变成“连不上后端”。

## 修复（已实施）

落地了原「修复选项 1 + 2」，并把「选项 3」的语义边界写进 `apps/desktop/AGENTS.md` CONVENTIONS：

1. `apps/desktop/src/lib/isAbortError.ts`（新增）：统一识别取消，同时覆盖 `DOMException` 与普通 `Error` 的 `name === 'AbortError'`（旧实现里 `HomeController` 有一份只看 `Error` 的私有副本，已删除并改用它）。
2. `apps/desktop/src/api.ts` 的 `requestResult()`、`apps/desktop/src/generated/client.ts` 的 `req()`/`reqWithEtag()`：在把 fetch 失败包装成 `Cannot connect to backend (...)` 之前 `if (isAbortError(err)) throw err`，取消不再变成“连不上后端”。
3. `apps/desktop/src/controllers/HomeController.ts`：新增模块级 `suppressProjectSessionsReload`，`loadInitial()` 在写 `selectedProjectId` 并 `await loadSessions()` 期间抑制 `watch(selectedProjectId)` 触发的第二次装载，`finally` 复位；`loadInitial` 捕获到取消时直接返回，不再产出 `home-load` 横幅。真实失败路径（横幅 + 「重试」）保持不变。
4. 回归测试：`api.test.ts`（取消保留原身份 / 真实 `TypeError` 仍包装为连接失败）、`generated/agentPackClient.test.ts`（`req` 与 `reqWithEtag` 的取消语义）、`HomeController.test.ts`（项目 watcher 不得 abort 首个 sessions 请求，且不得触发错误横幅）。

## 修复后验证

同一工作树、同一台机器、真实 Gateway(48730) + Core(48731) + Vite(5173) + Electron(CDP 9222)：

- 定向单测 `npx vitest run src/api.test.ts src/controllers/HomeController.test.ts src/generated/agentPackClient.test.ts` → **3 files / 52 tests passed**。
- 全量 `npx vitest run` → **967 passed / 14 skipped**，1 个失败套件 `src/pages/SpatialPage.test.ts`：本地 `node_modules` 缺 `@vue-flow/node-resizer`（`apps/desktop/package.json` 与根 `package-lock.json` 已声明该依赖，属该工作树既有状态，与本修复无关）。
- `npm run typecheck` → 仅 `src/pages/SpatialPage.vue` 3 处报错（同一缺依赖根因），本修复触及的文件无报错（`vue-tsc` 输出全量错误列表）。
- `probe-boot-race.mjs`（注入 fetch 包装 + 整页重载 12s）：每次重载**只有 1 个** `GET /api/v1/sessions`，`status=200`、`abortAt=null`、`abortedCount=0`、`bannerEpisodes=[]`；栈为 `loadInitial → loadSessions → api.listSessions`（修复前同一探针稳定给出 2 个请求、首个 `net::ERR_ABORTED` + `AbortError`）。输出留档 `.tinadec_dev/evidence/2026-10-07-home-boot-abort-banner/after-fix-boot-race.json`。
- `probe-store-state.mjs`：`items=[]`、`history=[]`、`bodyHasCannotConnect=false`，控制器 `projects=2 / sessions=1 / selectedProjectId` 已选、`busy=false`。留档 `after-fix-store-state.json`。
- 反向验证 `probe-real-failure-banner.mjs`（新增）：只把 `window.fetch` 对 `/api/v1/sessions` 改成立即抛 `TypeError('Failed to fetch')`，其余端点照常。重载后通知 store 仍出现 `{ key:'home-load', level:'error', title:'加载失败', message:'加载数据失败', details:'Cannot connect to backend (http://127.0.0.1:48730): Failed to fetch', kind:'status', actions:['重试'] }` —— 真实断连没有被这次修复吞掉。留档 `after-fix-real-failure.json`。

## 修复选项（历史记录，供后续同类缺陷参考）

1. **保留取消身份**（最小改动）：在 `api.ts` 与 `generated/client.ts` 三处 `catch` 开头 `if (err instanceof Error && err.name === 'AbortError') throw err`（并覆盖 `DOMException`），让 `loadSessions` 现有的 `isAbortError` 静默吞掉取消。
2. **消掉自取消**：初始装载期间抑制 `selectedProjectId` watcher（装载标志 / 先注册 watch 后赋值 / 对相同值短路），或让 `loadSessions` 对“同一视图的并发请求”去重而不是先 abort。
3. **文案与语义分离**：真实断连才用 “Cannot connect to backend”，取消不应产生用户可见错误；顺带把 `requestResult` 的 catch-all 区分为网络错误与解析错误。

注意：`src/generated/schema.d.ts` 由 `npm run generate:client` 生成，`npm run check:drift` 会执行 `git diff --exit-code -- src/generated/`；`client.ts` 是手写文件但位于该目录，改动必须随提交一起落地，否则漂移门会因未提交差异失败。

## 未做 / 边界

- 未跑 Desktop `node --test electron/*.test.cjs` 主进程集、未跑构建/打包与三平台产物；未做真实模型与会话交互复走。
- `SpatialPage.test.ts` 与 `vue-tsc` 的 3 处报错是本机 `node_modules` 与已提交 lockfile 不同步造成的既有阻塞，本轮未执行 `npm install`（`npm install --dry-run` 显示会新增 9 / 移除 65 / 变更 59 个包，属该工作树既有漂移，交由空间工作簇收口）。
- 反向验证用注入的 `TypeError` 模拟断连，没有真停 Gateway；真实网关宕机下的横幅外观沿用原实现（`HomeController` 错误分支未改）。
- 观察窗口内“通知岛（NotificationIslandHost）是否挂载”会影响肉眼可见性（`App.vue:184` 以 `entryReady` 为条件）；因此 DOM 采样偶尔看不到横幅，属探测方式限制，通知 store 才是判定依据。
- 2026-10-05 全局评审已把该包装缺陷登记为“AbortError 包成普通Error已留现场”，本文是首次给出完整启动链路与运行证据。
