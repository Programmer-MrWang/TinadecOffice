# PR 文档：修复首页启动自取消请求导致的连接失败误报

**PR 标题**：`fix(desktop): 修复首页启动自取消请求导致的连接失败误报`
**源分支**：`codex/fix-desktop-home-boot-abort-banner`
**目标分支**：`main`（上游仓库 `Tinadec/TinadecOffice`，注意本地 `upstream` remote 当前指向 fork）
**变更类型**：缺陷修复（Desktop 渲染进程请求层 + 首页控制器启动时序 + 回归测试 + 项目记忆）
**契约影响**：无。不改 Gateway/Core API、不改 OpenAPI 快照、不改生成契约类型。

---

## 一、问题现象

桌面端冷启动进入首页后，界面弹出错误通知：

- 标题：`加载失败`
- 正文：`加载数据失败`
- 详情：`Cannot connect to backend (http://127.0.0.1:48730): signal is aborted without reason`
- 操作：`重试`

点击「重试」后通知立刻消失，且不再复现。同期后端完全健康：Gateway `GET /api/v1/health` 返回 `{"status":"ok","gateway":"ok","core_status":"ready"}`，同址 Core 健康检查为 `ok`，`projects=2`、`sessions=1`。也就是说，用户被引导去排查一个不存在的后端故障。

---

## 二、根因

**前端自己取消了自己的请求，请求层又把这次取消当成「连不上后端」上报。** 完整链路（修复前）：

1. `HomeController.loadInitial()` 把 `selectedProjectId` 由 `null` 写为首个项目 id。
2. 该写入触发 `watch(selectedProjectId, () => void loadSessions())`。watcher 回调在微任务中执行，晚于紧随其后的 `await loadSessions()`。
3. 于是第二次 `loadSessions()` 进入，执行 `sessionListAbort?.abort()`，取消了第一次 `GET /api/v1/sessions`。
4. `api.ts` 的 `requestResult()`（以及同类复制 `generated/client.ts` 的 `req` / `reqWithEtag`）用 catch-all 把任何 `fetch` 失败重写为 `new Error('Cannot connect to backend (…)')`，丢掉了 `AbortError` 身份。
5. `HomeController` 内的取消判断只认 `name === 'AbortError'`，被包装成普通 `Error` 后不再匹配，异常冒泡到 `loadInitial` 的 `catch`，弹出「加载失败」横幅。
6. 点「重试」时 `selectedProjectId` 值未变化，Vue 不再触发 watcher，仅剩一次请求并成功，`dismissByKey('home-load')` 清除通知 —— 这解释了「点一下就消失」的表现。

网络层实测（修复前基线）：一次整页重载出现两个 `GET /api/v1/sessions`，相隔约 1ms；第一个 `net::ERR_ABORTED (canceled=true)` 并伴随 `AbortError: signal is aborted without reason`，第二个 200。第一个请求栈为 `loadInitial → loadSessions → api.listSessions → request → requestResult`；第二个栈位于 Vue `callWithErrorHandling` 内（即 watcher 回调）。

同类缺陷还有两处复制：`generated/client.ts` 的 `req`（约 `:98-105`）与 `reqWithEtag`（约 `:117-124`），被 `stores/workbench.ts`、`stores/run.ts`、`settings/sections/*` 使用；同样的取消在那些调用点也会被伪装成「连不上后端」。

---

## 三、修复内容

分两层落地：先让取消保持自身身份（治所有调用方的通病），再消除首页这次具体的自取消竞态。

### 1. 统一取消识别：新增 `apps/desktop/src/lib/isAbortError.ts`

```ts
export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
  )
}
```

同时覆盖 `DOMException` 与普通 `Error` 两种形态。`HomeController` 中原有的私有副本已删除，改为复用该模块，避免实现再次分叉。

### 2. 请求层放行取消：`apps/desktop/src/api.ts`、`apps/desktop/src/generated/client.ts`

- `api.ts:requestResult()`：在把 `fetch` 失败包装为 `Cannot connect to backend (...)` 之前 `if (isAbortError(err)) throw err`。
- `generated/client.ts` 的 `req()` 与 `reqWithEtag()`：同样处理。

真实网络失败（例如 `TypeError: Failed to fetch`）仍按原行为包装为连接失败，语义不变。

### 3. 消除首页启动自取消：`apps/desktop/src/controllers/HomeController.ts`

新增模块级 `suppressProjectSessionsReload` 标记：`loadInitial()` 在写入 `selectedProjectId` 并 `await loadSessions()` 期间抑制 `watch(selectedProjectId)` 触发的第二次装载，`finally` 复位；`loadInitial` 捕获取消时静默返回，不再产出 `home-load` 横幅。

```ts
// loadInitial owns the first roster read. The selectedProjectId watcher must not
// start a second read and abort that first one before the initial load can finish.
let suppressProjectSessionsReload = false
...
suppressProjectSessionsReload = true
try {
  selectedProjectId.value = projectList[0]?.id ?? null
  await loadSessions()
} finally {
  suppressProjectSessionsReload = false
}
```

### 4. 回归测试

| 文件 | 钉住的行为 |
| --- | --- |
| `apps/desktop/src/api.test.ts` | `AbortError` 原样抛出、不被改写成连接失败；非取消的 `TypeError` 仍包装为 `Cannot connect to backend` |
| `apps/desktop/src/generated/agentPackClient.test.ts` | `req` 与 `reqWithEtag` 两条路径均保留取消身份 |
| `apps/desktop/src/controllers/HomeController.test.ts` | 初始装载期间项目 watcher 不得发起第二次 sessions 读取、不得 abort 首个请求、不得触发错误横幅，且完成后调用 `dismissByKey('home-load')` |

### 5. 项目记忆

`apps/desktop/AGENTS.md`：新增本轮修复条目与两条 CONVENTIONS ——（a）请求包装层必须保留取消身份，取消不等于后端故障；（b）`loadInitial` 拥有首次名册读取权，不得在缺少等价 single-flight 语义时移除抑制标记。

---

## 四、验证证据

环境：真实 Gateway `127.0.0.1:48730` + Core `127.0.0.1:48731` + Vite dev `5173` + Electron（CDP 9222），同一台机器、同一工作树。

### 单元测试

- 定向：`npx vitest run src/api.test.ts src/controllers/HomeController.test.ts src/generated/agentPackClient.test.ts` → **3 files / 52 tests passed**。
- 全量：`npx vitest run` → **967 passed / 14 skipped**。唯一失败套件 `src/pages/SpatialPage.test.ts` 由本机 `node_modules` 缺少 `@vue-flow/node-resizer`（`package.json` 与根 `package-lock.json` 已声明该依赖）导致，属该工作树既有状态，与本修复无关。
- `npm run typecheck`：仅 `src/pages/SpatialPage.vue` 3 处报错（同一缺依赖根因），本次触及文件零报错。

### 真实 Electron 探针

| 探针 | 结果 | 留档 |
| --- | --- | --- |
| `probe-boot-race.mjs`（注入 fetch 包装 + 整页重载） | 每次重载**只有 1 个** `GET /api/v1/sessions`，`status=200`、`abortAt=null`、`abortedCount=0`、`bannerEpisodes=[]`；栈为 `loadInitial → loadSessions → api.listSessions` | `after-fix-boot-race.json` |
| `probe-store-state.mjs`（读真实通知 store 与控制器状态） | `items=[]`、`history=[]`、`bodyHasCannotConnect=false`；控制器 `projects=2 / sessions=1 / selectedProjectId` 已选中、`busy=false` | `after-fix-store-state.json` |
| `probe-real-failure-banner.mjs`（反向验证） | 只让 `/api/v1/sessions` 抛 `TypeError('Failed to fetch')`，通知 store 仍出现 `{ key:'home-load', level:'error', title:'加载失败', details:'Cannot connect to backend (…): Failed to fetch', actions:['重试'] }` | `after-fix-real-failure.json` |

反向验证的意义：证明这次修复只吞掉「自己取消自己」，没有吞掉真实断连 —— 真实失败路径的横幅与「重试」按钮保持原样。

修复前后的对照（同一探针、同一机器）：修复前每次重载稳定复现 2 个请求、首个 `net::ERR_ABORTED` + `AbortError` + 常驻横幅；修复后收敛为 1 个 200 请求、零取消、零横幅。

---

## 五、影响面与风险评估

- **受益范围**：所有经由 `api.ts:requestResult` 与 `generated/client.ts` 的请求。任何调用方对 `AbortSignal` 的正常取消（组件卸载、切换视图、并发请求让位）都不再被误报为后端故障。
- **行为不变**：非取消的 `fetch` 失败仍包装为 `Cannot connect to backend (...)`；`HomeController` 的错误分支、横幅文案、`重试` 动作均未改。
- **风险点**：抑制标记是模块级布尔值，只在 `loadInitial` 的 `try/finally` 窗口内为真；窗口外 `selectedProjectId` 的任何变更照常触发重载。若后续要移除该标记，应改为对名册读取实现等价的 single-flight 语义（已在 `AGENTS.md` CONVENTIONS 中登记）。
- **无契约漂移**：未触碰 `src/generated/schema.d.ts`，`npm run check:drift` 的生成目录约束不受影响（`client.ts` 是生成目录内被跟踪的手写文件，随本次提交一并落地）。

---

## 六、复现与验证步骤（审查者）

1. 在渲染进程网络面板观察：修复前首页每次冷启动出现两个 `GET /api/v1/sessions`（约 1ms 间隔），首个被取消；修复后只有一个且为 200。
2. 起本地 Gateway/Core 后 `npm run dev -w @tinadec/desktop`，确认首屏不再出现「加载失败」通知。
3. 运行 `npx vitest run src/api.test.ts src/controllers/HomeController.test.ts src/generated/agentPackClient.test.ts`。
4. 复跑探针（脚本与前置条件见证据目录 `README.md`）：`node probe-boot-race.mjs`、`node probe-store-state.mjs`、`node probe-real-failure-banner.mjs`。

---

## 七、已知边界（未做项）

- 未运行 Desktop 主进程测试集 `node --test electron/*.test.cjs`，未跑构建/打包与三平台产物。
- 未做真实模型会话交互复走。
- `SpatialPage.test.ts` 与 `vue-tsc` 的 3 处报错是本机 `node_modules` 与已提交 lockfile 不同步造成的既有阻塞，本轮未执行 `npm install`（`npm install --dry-run` 会新增 9 / 移除 65 / 变更 59 个包，属该工作树既有漂移），交由空间工作簇收口。
- 反向验证以注入 `TypeError` 模拟断连，未真实停掉 Gateway；真实网关宕机下的横幅外观沿用原实现。
- 通知可见性受 `App.vue` 中 `NotificationIslandHost` 挂载条件影响，DOM 采样偶尔看不到横幅，因此判定依据是通知 store 而非 DOM 快照。

---

## 八、关联材料

- 完整诊断报告：`.tinadec_dev/reports/2026-10-07-home-boot-abort-banner.zh-CN.md`
- 探针脚本与留档：`.tinadec_dev/evidence/2026-10-07-home-boot-abort-banner/`
- 项目记忆：`apps/desktop/AGENTS.md`（2026-10-07 条目 + 两条 CONVENTIONS）
- 历史线索：2026-10-05 全局正式评审已将「AbortError 被包成普通 Error」登记为待收口现场，本文档是首次给出完整启动链路与运行证据。

---

## 附：提交信息

```text
fix(desktop): 修复首页启动自取消请求导致的连接失败误报

HomeController.loadInitial() 写入首个 selectedProjectId 会触发
selectedProjectId watcher 中的 loadSessions()，在微任务里 abort 掉
loadInitial 自己刚发出的首个 GET /api/v1/sessions；请求层把这次取消
包装成 `Cannot connect to backend (...) : signal is aborted without
reason`，首屏因此常驻「加载失败」横幅，点「重试」后（值未变、
watcher 不再触发）才恢复。

- 新增 src/lib/isAbortError.ts 统一识别取消（DOMException 与 Error
  的 name === 'AbortError'），HomeController 私有副本删除
- api.ts:requestResult 与 generated/client.ts 的 req/reqWithEtag 在
  包装为连接失败前放行取消，真实网络失败语义不变
- loadInitial 用 suppressProjectSessionsReload 抑制自取消，捕获取消
  时静默返回
- 回归测试：api.test.ts、HomeController.test.ts、
  generated/agentPackClient.test.ts；定向 52/52

验证：同一工作树真实 Electron 冷启动每次重载只发 1 次
/api/v1/sessions（200、无取消、无横幅），反向注入真实 TypeError
仍产出 home-load 错误项；全量 vitest 967 passed/14 skipped，唯一
失败 SpatialPage.test.ts 系本机 node_modules 缺
@vue-flow/node-resizer 的既有问题。
```
