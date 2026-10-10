# 右栏首页 Git 工作状态卡：实施与验收

**日期**：2026-10-11；**主责**：APP-UIE-COMPONENTS-102 / F004；**基线**：`5d8096c` + 未提交工作树；**范围**：当前 Windows 开发态 Electron、Desktop/UIE 组件和独立 Tools 测试。

## 本次决策与成果

将首页九宫格中的 Git 静态入口替换为同栏顶部横跨两列的 Git 信息卡，顶栏「+」菜单与完整 Git 页面仍保留原 `git` descriptor。卡片使用既有 `UiIslandCard`、主题 token 与双语资源，不新增 material root、Git store 或新接口。实际内容为主目录/分支/上游、干净/变更/冲突主结论、已暂存/未暂存（不含未跟踪）/未跟踪/冲突四项、最多 3 条实际 Git 状态记录及溢出数、最近一条提交摘要、本机跟踪引用 ↑/↓、读取时间、手动刷新与唯一“打开 Git 版本管理”入口；历史/差异全文与任何 Git 写操作仍在原页面。Git porcelain 可以把未跟踪目录折叠为一个状态行，因此主文案使用“项变更”，不谎称物理文件数。

Git facade `action:status` 获取只读状态、`action:log,limit:1` 获取最近提交；后者失败不改变状态结论。首页激活+窗口可见且聚焦+受管业务就绪时刷新，状态约 20 秒一次、历史约 60 秒一次，重新激活/手动刷新读取两者；同仓库同飞、10 秒截止、请求取消/代号防跨项目旧数据覆盖。失联或读取失败保留灰化旧时间，严禁标为当前干净；多根工作区只描述注册主目录，不假装合并独立仓库。上游数字只来自本机跟踪引用，不主动 fetch，也不声称已确认远端最新。没有会话也可以只读状态。

Tools 现有 `git_status` 统一使用 `git --no-optional-locks status`，避免首页后台读取触发 Git 可选索引写；既有 push readiness 同用该方法。独立测试新增预先老化索引 mtime 后读取不会刷新索引的断言。运行中的旧 Core/Tools 进程不因前端热更新自动替换：当前开发态的这一能力需在用户主动按标准流程重启服务后才加载新 Tools 二进制，本轮未停止用户进程或修改其数据。

## 本轮证据与边界

- UIE 全量 Vitest：187 passed / 16 files；Desktop 8 文件定向 32 passed、全量 Vitest 1256 passed / 14 skipped（140 文件中 1 文件既有 skip）、`vue-tsc --noEmit` 通过；全量退出码 0，happy-dom teardown 出现已有 `AbortError` 日志，不作为测试通过数或实机证据；Tools `GitReadToolsTests` 11 passed，`--artifacts-path tmp/git-widget-dotnet-artifacts` 隔离，未碰运行时默认 bin。
- Windows 真实 Electron 开发态：首页右栏 `Windows-Duo / main → origin/main`、一条目录变更（`.tinadec/`）、计数、最近提交、跟踪引用、入口布局与滚动可见；点击底部入口确实回到原 Git 页签。截图 [home-right-expanded.png](../evidence/2026-10-11-home-git-widget/home-right-expanded.png)。同一 Electron 窗口暂时缩到 1120×720 CSS 后保留完整卡片、其余功能网格与右栏滚动；截图 [narrow-window.png](../evidence/2026-10-11-home-git-widget/narrow-window.png)，完成后已恢复用户原最大化窗口。数据来自现有运行中服务；新的 Tools 可选锁修复只在独立测试验证，不能算当前进程已热更新。
- 主题以当前深色真实窗口与 1120×720 CSS 窗口验证，亮色/透明材质和 260/340px 实际右栏、macOS/Linux、安装器/打包态尚未取得实机验收。UIE 的其他功能入口及 UIE 引擎本次不更改。

来源：`apps/TinadecUI/src/components/cards/home/{HomePickerCard,GitStatusWidget}.vue`，`apps/desktop/src/{composables/useHomeGitStatus,lib/gitStatusSummary}.ts`，`TinadecTools/Tools/Git/GitReadTools.cs`，Core `AspNetCore/Endpoints/DirectToolEndpoints.cs:124-129`，UIE `components/UieCardHost.vue`。

文档索引：运行 `node docs/development-program/scripts/reindex.mjs` 曾发现七处既有且本机不存在的历史 `.log` 链接；仅删除失效的日志链接，保留对应正式报告和其余有效证据，然后复跑 55 模块/2236 链接校验零错误。不存在的日志没有伪造补回。
