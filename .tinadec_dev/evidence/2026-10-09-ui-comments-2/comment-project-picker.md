# 项目选择器：长列表与键盘访问

日期：2026-10-09。范围：本轮 Comments 1/2/7 的项目选择器脚本和结构；共享样式与中英文文案由根代理统一维护。

## 根因与修改

原 `UiScrollArea` 外层只有 `max-height`，内层使用 `h-full`。最大高度没有提供确定的父高度，内层会按全部项目内容增长，再被外层 `overflow-hidden` 裁切。项目列表因此没有稳定的可滚动视口。通用 `UiScrollArea` 在其它文件、Git 和消息面板中仍有使用，本轮没有修改其公共行为。

`ComposerBar.vue` 的项目列表改为一个原生 `overflow-y: auto` 容器。定位计算的最大可用高度通过 `--project-menu-max-height` 交给菜单外层，移除定位结果的额外纵向滚动层。菜单头尾和列表按 flex 分配高度；父级样式提供 `min-height: 0`、列表最大高度、隐藏滚动条、行内边距和圆角。项目与自由对话选择仍通过原 `select-project` 事件返回，未改变项目登记行为。

打开菜单后将焦点移到当前选择，并使其进入可见范围。方向键、Home、End 可以访问完整列表与末尾新建入口；Escape、选择项目或自由对话后恢复触发器焦点。快速连续切换会在异步定位和聚焦前复核实际开合状态，避免向已关闭菜单聚焦。触发器的 `aria-expanded` 与旋转箭头使用同一 `showProjectDropdown` 状态。

## 参考

- 按项目 shadcn-vue 技能执行 `npx shadcn-vue@latest docs scroll-area dropdown-menu`，并查看官方 Scroll Area 与 Dropdown Menu 文档。
- 本地上游 `C:/git/agent/shadcn-vue` 固定 commit：`b251d9fd92aa496495e127137a7734704fb34a29`。
- 上游 `apps/v4/components/_internal/sink/ScrollAreaDemo.vue` 使用 `h-72` 确定滚动区高度；`apps/v4/styles/reka-vega/ui/scroll-area/ScrollArea.vue` 的 viewport 使用 `size-full`。本轮采用原生滚动区修复这个局部高度关系，不引入另一套全局滚动组件。

## 本轮验证

- `npx vitest run src/components/ComposerBar.test.ts`：**73/73 通过，0 跳过**，10.64 秒。
- 新增 4 项回归覆盖 45 个项目的完整渲染和末项选择、Arrow/Home/End 访问、Escape 与焦点恢复、快速重复开合。
- 两个改动文件的 `git diff --check` 通过。
- 隔离预览首次构建通过，但浏览器显示空组件：入口的运行时 `template` 与产品 Vue runtime-only 构建不兼容。已将入口根组件改为静态编译 `FixtureRoot.vue`，router 空组件改为 `h()`，并新增入口与异步错误的可见 `#fixture-error` 面板。
- 修复后隔离预览构建：`npx vite build --config ../../.tinadec_dev/tmp/ui-comments-2/vite.config.mjs`，**通过**，5.25 秒。这是独立预览构建，不是完整产品构建或发行验收；单独构建成功不代表浏览器渲染通过。

## 浏览器验收夹具

源文件：`.tinadec_dev/tmp/ui-comments-2/fixture.ts` 与 `FixtureRoot.vue`；临时构建输出：同目录 `dist/`。夹具使用真实 `ComposerBar`、命令面板、全局 CSS 和当前中英文文案，提供 45 个伪项目、较长中英文项目名称、760px / 350px 切换和最后选择标识。

API、会话 controller 与样式持久层分别被独立夹具实现替换；所有 `fetch` 被明确拒绝。夹具没有读取产品 store、凭据，也没有登记或修改真实项目。

通过现有 Vite 开发服务打开：`http://127.0.0.1:5173/@fs/C:/git/agent/TinadecOffice/.tinadec_dev/tmp/ui-comments-2/dist/index.html`。

真实鼠标滚轮、触摸板/触摸、隐藏滚动条效果以及 350px 布局的浏览器测量由根代理集中验收，本文不将单元测试或夹具构建表述为这些交互的实测结果。350px 的现有窄布局缩短项目标签、隐藏模式和权限文字并允许工具栏换行；没有为夹具额外隐藏组件或覆盖产品布局。
