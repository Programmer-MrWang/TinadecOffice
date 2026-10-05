# Desktop Home `insertBefore` 复查（2026-10-05）

## 复现

在 Windows Electron 43.3.0 开发启动、Gateway 不可达的情况下，进入主界面并等待连接超时：

1. 启动页保持约 30 秒；
2. `useConnection` 从 `connecting` 变为 `timeout`；
3. Home UIE 首次挂载，同时根 splash `<Transition>` 执行 leave；
4. renderer fallback 显示 `Failed to execute 'insertBefore' on 'Node': parameter 2 is not of type 'Node'`。

Settings 路由在同一环境可以加载，说明错误集中在 Home UIE 的动态 Vapor 树，不是整个 Electron preload 或 Vite 入口失效。

## 根因

HomePage 是 classic SFC，里面动态挂载 `UieShell`。`UieShell`、`UieCanvas`、`UieColumn`、`UieStack`、`UieCardHost`、dock/tab 组件和 Home cards 原本都是 Vapor SFC。连接状态切换时，根 App 又用 classic `<Transition>` 卸载 splash；Vue 3.6 RC 的 classic/Vapor interop leave/insert 锚点在这次同帧挂载中拿到了已移除节点，最终调用 `parentNode.insertBefore` 时第二个参数不是 Node。

这与仓库既有 `VaporExemptions` 对 classic/Vapor leave 路径的警告相符。单独清理 Vite 缓存不能解决这条真实运行时竞态。

## 修复

- AppSplash 保持挂载，只切换 `app-splash--leaving` CSS 状态；删除根 splash Vue Transition，保留向上移动和淡出效果。
- Home UIE 19 个 SFC 暂退 classic template，布局、状态、卡片注册、命令总线和 CSS 均保持不变。
- Vapor batch1 清空并标记 deferred，`VAPOR_OPTED_IN` 同步收窄，避免之后误把这些文件重新加入 Vapor。

## 验证

- `windowLifecycle.test.ts` + `vaporBatch.test.ts`：**9/9**。
- `npm run build -w @tinadec/desktop`：成功。
- 真实 Electron + Vite，Gateway 不可达：进入 Home 后等待 **45 秒**，仍能看到聊天输入框和主布局，没有 `UI crashed`。
- 真实 Settings 路由在同一环境可加载。

后续恢复 Vapor 时应按单个组件树逐层验证，先从 UIE 根、列、栈、卡片宿主到 Home cards 分阶段恢复；不能只把 `UieShell` 单独改回 Vapor。
