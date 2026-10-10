# 未提交改动复审：Git 首页卡与样式化下拉更正

**日期**：2026-10-11；**基线**：`5d8096c` + 用户原有未提交工作树；**关联**：APP-UIE-COMPONENTS-102/F004、APP-SETTINGS-102/F002 及共用 Desktop UI。没有创建提交、重启用户开发进程或修改产品数据。

## 复核结论与实际更正

1. **类型检查真实失败**：原工作树 `vue-tsc --noEmit` 在 `PromptEngineeringMerged.vue:234` (`string | null` 模型) 和 `ToolCenterSection.vue:198`（可选 Agent 名称）各报 TS2322。`UiSelectField` 明确接受空值模型，选项名称回退到稳定 Agent ID；更正后类型检查退出 0。
2. **模态遮挡真实存在**：独立 Windows Chromium headless/CDP 以 `showModal()` 打开 `<dialog>`，将 `z-index:999999` 的菜单放在 `body` 时点击命中对话框 (`outsideHit:false`)，移入对话框时命中菜单 (`insideHit:true`)；即使菜单位于对话框可滚区域边界外，固定定位的子级仍命中 (`menuVisible:true`，对话框 `overflow:auto`)。`select-field.vue` 改为就近传送到打开的 `<dialog>`；对话框 close 时清理菜单，普通控件仍传送至 body。组件回归断言菜单 DOM 归属；不把此独立 Chromium 探针冒充运行中完整 Electron 页的业务验收。
3. **浮层定位与旧样式真实不匹配**：原菜单只在开启时定位，外部滚动/窗口缩放后仍留在旧位置；现在这些事件关闭浮层，菜单自身滚动保留。原 `ComposerBar` 外壳高 24px 而触发按钮高 36px；快照、工具目录、环境、调试过滤器、宠物市场等旧 `<select>` 的内边距/边框施加在组件外壳，造成双层边框或额外占位；已改为定位实际 `.ui-select-trigger`，增加组件及 CSS 契约回归。
4. **空仓库与失败分类均被测试复现**：新建 Git 仓库 `git_status` 成功，但 `git_log HEAD` 在原实现失败；损坏仓库索引时 `git_status` 的实际执行失败被写成 `not_a_repo`。`GitReadTools.LogAsync` 只在请求 HEAD 且成功的只读 porcelain status 报 `No commits yet on` 时返回成功空列表，无效显式引用仍失败；status 执行错误/超时用 `git_status_failed`（仅 Git CLI 明确返回 `git_not_found` 时保留该码），真正不是仓库沿用 `not_a_repo`。界面已有成功空历史与普通读取失败分支，无须制造假成功或改 Gateway/Core 契约。
5. **杂散文件**：仓库根未跟踪、零字节的 `$null` 经核对后删除；未触碰其他用户文件。

## 验证与范围

- 先运行回归：`UiSelectField` 的模态与滚动用例失败；`GitReadToolsTests` 的空 HEAD 与损坏索引用例分别失败，确认并非只凭猜测修复。更正后 Git 定向 **13/13**、Desktop 定向（含模态/状态/CSS）通过。
- 最终 Windows Desktop `vue-tsc --noEmit` **通过**；全量 Vitest **1267 passed / 14 skipped**（140 文件通过、1 文件跳过，退出码 0）；TinadecUI Vitest **187/187**；TinadecTools 独立隔离构建目录中的全量 .NET 测试 **420/420**。happy-dom 在全量 teardown 仍输出既有 `AbortError`，不影响退出码；Git 的工具测试没有占用用户在运行服务的默认 bin。
- `git diff --check` 退出 0；开发计划 `reindex.mjs` 校验 55 模块、2241 链接、0 错误。静态结构、独立 Chromium 模态命中和组件/工具回归已覆盖本轮修正；没有重新做完整桌面窗口全部下拉交互、生产 Vite bundle、安装器、macOS/Linux 或真实模型链，不把这几项写为完成。旧首页 Git Electron 窄窗截图仍属于 [原专项](2026-10-11-home-git-widget.zh-CN.md)，不作为此次下拉更正后的截图。

源码：`apps/desktop/src/components/ui/select-field.vue`、`apps/desktop/src/settings/sections/ToolCenterSection.vue`、六处旧 select 样式、`TinadecTools/Tools/Git/GitReadTools.cs`；对应回归在 `apps/desktop/src/components/ui/select-field.test.ts`、`apps/desktop/src/composables/useHomeGitStatus.test.ts`、`apps/desktop/src/settings/settingsCssContract.test.ts`、`tests/TinadecTools.Tests/GitReadToolsTests.cs`。
