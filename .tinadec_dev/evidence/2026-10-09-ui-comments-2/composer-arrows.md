# Comment 3 / 4：Composer 模式与权限箭头

日期：2026-10-09。范围：模式与权限触发器、两个独立 Selector 的展开指示。项目菜单脚本/结构由资源子任务处理，共享 styles/locales、文档索引和最终真实页面验收由主任务维护。

## 实际调用链与根因

- Welcome / session composer 都进入 `apps/desktop/src/components/ComposerBar.vue` 的模式或权限按钮，调用 `openCommandPanel('mode' | 'permission')`。
- `commandPanelOpen` 由 `showPlusMenu || slashQuery !== null` 决定；`ComposerCommandPanel` 内部的 `page` 由 `selectPage`、Back、Escape、slash 切换维护，并通过 `defineExpose` 暴露。
- `commandPage` 是传入面板的初始页，不能代表面板内部返回后的当前页。原按钮 `aria-expanded` 已正确比较 `commandPanelRef.page`，但 ChevronDown 没有展开状态或旋转规则，所以打开、切页、返回都朝下。
- 本轮新增 `modePanelExpanded` / `permissionPanelExpanded` computed，以 `commandPanelOpen && commandPanelRef.page === 对应页` 同时绑定 `aria-expanded` 与箭头 `is-expanded`。
- 独立的 `ModeSelector.vue` / `PermissionSelector.vue` 当前未被主 Composer 引用；其箭头仍按自身 `showDropdown` 绑定，防止以后复用时状态再次不一致。ModeSelector 同时补齐非提交按钮、dialog 展开声明与 portal 名称。

## 变化与边界

展开旋转 180°，关闭恢复默认方向，仅 transform 160ms ease；`prefers-reduced-motion: reduce` 时 transition 为 none。Chevron 为装饰性图标并设置 `aria-hidden=true`。三 SFC 内局部样式不改变菜单展开行为或共享材料/颜色。

Composer 的模式和权限按钮不是独立 dropdown：同一面板切换到另一个页时，仅当前对应入口展开；返回 root 页时面板仍显示，但两入口都收起。选择完成、外部关闭仍由原面板状态处理。

未改项目 dropdown markup、import、共享 styles.css/locales、路由、AGENTS 或产品模块文档，保留此前工作树修改。

## 实际命令与结果

1. 仓库根：`npx shadcn-vue@latest docs button dropdown-menu collapsible -c apps/desktop`，exit 0，返回三份官方组件文档 URL。`Invoke-WebRequest` 对三页均 HTTP 200；标题/地址记录在 `composer-arrows-shadcn-docs.json`。
2. `apps/desktop`：`npx vitest run src/components/ComposerBar.test.ts src/components/PermissionSelector.test.ts --reporter=verbose`，exit 0，2 文件 / 74 测试通过，无跳过；原始输出 `composer-arrows-tests.log`，21:44:40 开始，Vitest 耗时 7.05s。
3. `git diff --check -- apps/desktop/src/components/ComposerBar.vue apps/desktop/src/components/PermissionSelector.vue apps/desktop/src/components/ModeSelector.vue apps/desktop/src/components/ComposerBar.test.ts apps/desktop/src/components/PermissionSelector.test.ts`，exit 0，仅 Git 的既有 LF/CRLF 规范提示。

既有 toggle/back/page-switch/Escape 测试增加箭头和 aria 同步断言；PermissionSelector 既有 ArrowDown/Home/Escape/焦点恢复用例增加同步断言。不新增镜像测试，不运行整个 Desktop / .NET 构建。

Happy DOM 测试检查实际页面状态和图标 class，不能证明 CSS 最终视觉、过渡时长或系统媒体查询。真实页面的 matrix/aria/reduced-motion 证据由主任务补充，本记录不冒称已完成。

## 固定参考源码

- shadcn-vue：`b251d9fd92aa496495e127137a7734704fb34a29`。`apps/v4/styles/reka-nova/ui/dropdown-menu/DropdownMenuTrigger.vue` 与 `collapsible/CollapsibleTrigger.vue` 转发 ReKa trigger 状态；`apps/v4/components/demo/CollapsibleDemo.vue` 的 `v-model:open` 是同一个可见状态；registry navigation-menu 箭头使用 open 状态旋转。
- OpenCodeUI：`371cd9cf156280c325f3759972d096c29e6d71d4`。`src/features/chat/ModelSelector.tsx:801/806` 的 aria-expanded 与 rotate-180 都由 `isOpen` 决定；`src/features/sessions/ProjectSelector.tsx:111/121` 同理。
- openchamber：`74b79d41eac44ff38790c66f238050936083e0bb`。`packages/ui/src/components/session/SessionSwitcherDropdown.tsx:46/50` 将实际 store 的 isOpen 绑定受控 DropdownMenu；`packages/sdk/src/ui/select.ts:104/115` 随真实关闭/打开同步 aria-expanded。

以上参考用于确认状态来源，不复制对方产品标签或改变 Tinadec ComposerCommandPanel 的页面契约。
