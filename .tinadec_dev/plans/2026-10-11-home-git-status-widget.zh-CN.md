# 右栏首页 Git 工作状态卡：开工方案（仅规划）

**日期**：2026-10-11  
**状态**：初始设计方案已实施并按用户追加需求扩充；实际成果、验收与尚未覆盖项见 [实施报告](../reports/2026-10-11-home-git-widget.zh-CN.md)。本文件保留最初设计依据，以下初版取舍以实施报告为准。  
**归属**：APP-UIE-COMPONENTS-F001（右栏 Home 卡片）；工作区上下文与 APP-HOME-107 / APP-HOME-F007 关联。已在 `docs/development-program/02-modules/app/uie-components/TODO.md` 登记独立任务 APP-UIE-COMPONENTS-102，不在本计划维护第二份进度表。

## 结论与对既有视觉提案的修正

- 右栏原为 420px 默认列宽，`HomePickerCard.vue` 中的九项功能卡在双列网格显示；Git 静态卡替换为顶部横跨两列的信息卡，下面保留其余八项。`featureCatalog.ts` 同时供顶栏“+”菜单使用，**不能从目录中删除 Git**；只过滤 Home 网格的静态 Git 卡，完整 Git 页签、UIE 卡型、布局持久化都不变。
- 不把 `GitPanel.vue` 缩小挂载到首页：`useGitOperation.ts:515` 读取差异预览与 push_plan，组件还管理审批/提交等状态。`useSpatialGit.ts` 同样读取完整 diff 和 log。卡片只需要已有的 `git_worktree_manager` `action: status` 单次只读请求（Core `DirectToolEndpoints.cs:124-129` → Tools `GitReadTools.cs:300-307`），不加 Core/Gateway 新接口，也不重新执行 Git 命令或自行绕过宿主。
- 初版拟**不显示最近提交**：`status` 响应没有该字段。用户看过首版真实卡后要求增加内容，实际实施改为另行读取 `log limit:1`（约每分钟或显式刷新），失败不影响状态结论；最新结果见实施报告。
- `↑/↓` 只比较**本机已有的 upstream 跟踪引用**；`status` 不会主动访问远端，也不提供最近 fetch 时间。不能写“远端实时”或伪造“上游数据 N 分钟前”。卡片的“更新于”仅指本次**本地状态读取**；无 upstream 时写“未配置上游”，不显示 `↑0 ↓0`。
- 多目录工作区不等于多仓库聚合：`ProjectDto.path` 是主目录；Core `FindByRootAsync` 依注册项目根精确匹配（`ProjectSessionStore.cs:954-976`），当前 direct-tool 又把 `repository_path` 固定为项目根。首版明确写“主目录 Git”；不要用 `roots[]` 虚构各源目录独立 Git 状态或提供无法工作的仓库切换。
- 既有 `repoSummary` 的 staged/unstaged 使用 `else if`，同一文件暂存后又修改时只能进一侧；卡片应按 `isStagedFile` 和 `isUnstagedFile` **分别**计数，总文件数则按状态行/唯一路径，不将两侧相加；`is_conflicted` 优先。`status=completed` 且 `data.success=true` 才可呈现“干净”。

## 最终 UI / 交互契约

位置：`HomePickerCard` 的标题/上下文说明之后、功能网格之前；独立 `GitStatusWidget.vue`，宽度随右栏填满，常态约 170–190px 高，窄栏压缩而不横向溢出。使用项目既有 `UiIslandCard`、语义色和 Lucide Git 图标；橙色只作识别，正常/提醒/冲突按中性/琥珀/红逐级强调，不加入图表、闪烁或嵌套毛玻璃。键盘按钮有名称与焦点态。

层级：① `Git 版本管理` + `主目录/仓库名 · 分支 → upstream`；② 一句结论（干净 / N 文件有变更 / N 个冲突）；③ 补充数字（已暂存、未跟踪、↑/↓；重叠计数显式区分），末尾单一“打开 Git 版本管理 →”。如果第一版没有可靠的子页签定位，**不承诺**“查看历史 →”可直达历史；复用 Home 现有的 UIE `openCard('git')` 打开既有页签即可。卡片无提交、推送、fetch、暂存、丢弃或审批写入口。

状态覆盖：无项目、主目录不是 Git 仓库、首次加载、干净、有变更、冲突、detached HEAD、无 upstream、受管业务不可用/纯 Vite 预览、读取失败及同仓库最后一次成功数据已过期。失败时旧数据仅可作为灰化的“上次读取结果 + 时间”展示，不继续宣称当前干净；切换工作区立即清空旧仓库事实，不跨项目保留。右栏窄于 420/340px 时减少辅助文案、保持身份/结论/入口可见。

## 数据生命周期与性能

`HomePickerCard` 将当前项目和 `uie:active` 可见性传给小组件；不依赖会话 ID。UIE `UieCardHost.vue` 首次激活后一直挂载、隐藏只靠 CSS，因此只在“Home 实际活跃 + renderer 可见/窗口聚焦 + `useConnection.businessReady`”时读取：首次激活、工作区/host 恢复、窗口回到前台立即读；活跃时约每 20 秒一轮，隐藏或失焦停止，手动刷新可立即读。不重叠、限时、AbortController + 请求代号防旧结果覆盖新仓库；卸载时清理。只读失败卡内提示、不按每次周期向全局通知刷屏。Vue watch 的失效清理须同步注册。

**定时读前置安全条件**：Git 官方文档指出后台 `git status` 默认可能刷新并写索引、与其他进程的锁竞争；当前 Tools `GitReadTools.StatusAsync` 尚未使用 `git --no-optional-locks status`。实施定时读取前，需在该既有只读工具调用处做最小修正并验证既有直接读取/推送准备仍正常；如实施范围明确限制为纯前端，则取消 20 秒轮询，只保留激活/聚焦/手动刷新，不在未经修正的 Git 命令上增加后台频率。不会自行执行 `git fetch`，也不改变 Core 审批闸。

## 预计改动边界（下轮才执行）

1. UIE：`HomePickerCard.vue` 插入卡片、只在网格中过滤 Git；新增 `home/GitStatusWidget.vue`。不改 `featureCatalog.ts` 的九项、`BrowserTabBar.vue`、UIE preset/engine。
2. Desktop：用现有 `api.executeCodeTool` 读取 `action: status`；一个最小纯投影函数可放在 `src/lib/gitStatusSummary.ts` 以测试双侧/冲突/无 upstream；`zh-CN.ts` 与 `en.ts` 增补文案，不引入新依赖、全局 Git store 或新接口。
3. Tools：若启用定时刷新，`GitReadTools.StatusAsync` 加 `--no-optional-locks` 并补现有 GitReadTools 测试。按本仓维护协议同步涉及模块的 TODO/STATUS、AGENTS 与生成索引；本轮不触碰这些源码/状态文件。

## 验收清单

- 单测：`status=completed` 但 `success=false` 不变干净；同一路径既 staged 又 unstaged；冲突、无 upstream/游离 HEAD、非仓库、无项目、host 预览与断线、工作区 A→B 迟到响应/中止、隐藏页签不轮询、返回页签刷新且单飞；点击卡片只打开现有 Git 页签，顶栏“+”仍有 Git、原九项目录不变。
- 视觉：420/340/260px 右栏、1169×719 与常用窗口；长项目/分支名、亮/暗/透明材质、键盘焦点与减少动态效果；八项其余功能入口可见、滚动顺畅。真实 Electron 中确认数据来自当前工作区，不把 Vite 预览当作业务就绪。
- 门禁：UIE 与 Desktop 定向 Vitest、Desktop `typecheck`；若改 Tools 则运行 GitReadTools 定向测试；最后按实际运行范围写证据，不用组件夹具冒充安装包或三平台验收。

**只读基线**：2026-10-11 `5d8096c` + 既有未跟踪 `$null`；Desktop GitPanel/useGitOperation/useSpatialGit 三测试文件 15 passed，UIE featureCatalog 4 passed。本轮没有新增测试、构建或产品改动。
