# Comment5：移除已由空间模式取代的指挥中心首页入口

日期：2026-10-09。源码基线 `d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` 加当前工作树；仅记录本轮导航修改，同一工作树已有 UI 修订保持原样。

## 调查与调用链

修改前存在两条实际产品导航链：

| 入口 | 实际调用链 | 处理 |
| --- | --- | --- |
| 侧栏“指挥中心” | `apps/desktop/src/components/AppSidebar.vue:55,269–280` 声明并发出 `go-workbench` → `apps/TinadecUI/src/components/cards/home/NavCard.vue:52` 调用 `router.push('/workbench')` | 删除按钮、事件声明、卡片绑定及只供此按钮使用的 `Terminal` 导入 |
| 全局命令面板“前往 工作台” | `apps/desktop/src/lib/appCommands.ts:145` 的 `view.goWorkbench` → `CommandPalette.vue:79` 将可用命令投影为结果 → `CommandPalette.vue:72` 执行命令 → `CommandPalette.vue:69` 按 `workbench` 路由名导航 | 删除此导航命令；保留会话、代码、快照、治理、记忆、市场、设置命令 |

检索 Desktop 与 TinadecUI 源码的 `goWorkbench`、`go-workbench`、`openWorkbench`、`/workbench` 和 `commandCenter`，未发现其它实际首页入口。中英文旧翻译键仍是静态定义，不会产生导航。`WorkbenchPage`/store、运行事实画布和审批、治理数据服务不属于本轮删除范围。

主任务已决定将直接 `/workbench` 路由重定向到 `/space`，由主任务独占 `router.ts` 实施；本记录对应的子任务没有编辑路由、Debug Studio 段或全局配置。平铺/空间选择仍通过 `NavCard.vue` 的 `change-view` 导向 `/` 或 `/space`。

## 实施与验证

源码修改限于 `AppSidebar.vue`、`NavCard.vue`、`appCommands.ts`。移除过时导航行后，将命令构造器注释中的固定行数改为不依赖数量的说明。

现有 `AppSidebar.test.ts` 的运行中观察者导航用例同时检查指挥中心按钮不存在、空间切换仍存在、市场导航可用；保留此前 popover、焦点和 reduced-motion 相关修改。`appCommands.test.ts` 增加行为断言：可用命令没有 `workbench` 路由，快照/治理/记忆/设置命令仍存在。不新增源码字符串镜像测试。

执行：

```text
node ../../node_modules/vitest/vitest.mjs run src/components/AppSidebar.test.ts src/lib/appCommands.test.ts src/components/CommandPalette.test.ts src/composables/useCommandPalette.test.ts
```

结果：4 个测试文件、55 项测试通过，0 失败、0 跳过；耗时 14.63 秒。原始日志：`comment5-workbench-navigation.log`。所改五个源码/测试文件的 `git diff --check` 通过，只有 Git 的 LF/CRLF 提示。

这是定向源码与导航行为验证，不包含完整 App、打包安装或真实页面截图。未运行大型 Vite 构建，未提交或推送；未修改用户数据。
