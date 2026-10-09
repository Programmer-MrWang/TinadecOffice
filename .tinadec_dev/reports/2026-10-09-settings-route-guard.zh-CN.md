# Settings 路由离开守卫修复

日期：2026-10-09。范围：`apps/desktop/src/pages/SettingsPage.vue` 的离开守卫。

问题是守卫声明为 `async` 后仍把 `next()` 放在 530ms 的 `setTimeout` 回调中。守卫函数的 Promise 会先结束，Vue Router 将其判定为未完成的回调式守卫并抛出 `Invalid navigation guard`。

修复新增 `src/pages/settingsNavigation.ts`，将离开逻辑收敛为返回值形式：工具草稿不能离开时返回 `false`；已经开始退出时返回 `true`；首次离开设置页标记退出并在返回的 Promise 内等待 530ms，完成后返回 `true`。`SettingsPage.vue` 不再在延迟回调中调用 `next()`。

回归测试使用 Vue Router `createMemoryHistory`，不是字符串断言模拟：

- 等待释放前路由仍停留 `/settings`，释放等待后进入 `/`。
- 工具草稿拒绝离开时返回取消结果，路由仍停留 `/settings`。
- SettingsPage smoke 与守卫回归共 10/10 通过。
- `vue-tsc --noEmit` 通过。

证据：[result.json](../evidence/2026-10-09-settings-route-guard/result.json)、[vitest.log](../evidence/2026-10-09-settings-route-guard/vitest.log)、[typecheck.log](../evidence/2026-10-09-settings-route-guard/typecheck.log)。

本次未修改 HomePage 的守卫；该页面仍使用同步回调式 `next()`，不存在本次 SettingsPage 中的 `async` 与延迟 `next()` 混用。
