# Comment 5：侧栏显示模式菜单

日期：2026-10-09。负责人范围仅 `AppSidebar.vue`、其既有组件测试；没有修改 GraphSeed、全局样式、locale、HomeController 或 UIE 布局引擎。

## 真正动作

侧栏 footer 第一个“切换显示模式”按钮只打开模式菜单，不直接切换页面。选择“平面模式”或“空间模式”才发出 `change-view`，`apps/TinadecUI/src/components/cards/home/NavCard.vue` 将其转为 `/` 或 `/space` 路由。两个页面 setup 调用 HomeController.setViewMode，切换会话类型、选择该类型自己的会话并加载对应列表。空间里的“会话总览”是另一个入口，与本按钮无关。

Home 已有真实栈入场与退出动画。本轮只处理所选按钮实际打开的菜单；没有给按钮加装饰旋转，也没有引入 RouterView 外层 Transition 或第二套 UIE 几何状态。

## 实现

原生 `popover` 继续负责 top layer、Escape、轻触关闭及默认交互。UiButton 通过 `popovertarget`/`popovertargetaction` 成为原生 invoker，点击处理函数仅先按按钮几何计算菜单位置，避免 JavaScript toggle 和默认 toggle 同时执行。

菜单在真实 `:popover-open` 状态使用 160ms opacity、6px 上移和 0.98→1 缩放；`display`/`overlay allow-discrete` 保留实际关闭动画，`@starting-style` 提供真实首次打开的起点。菜单关闭阶段禁用 pointer events；快速重新打开使用 CSS 过渡的当前状态继续，不等待动画 Promise 或定时器。`prefers-reduced-motion: reduce` 禁用 transition 和位移缩放，菜单开合与真正切换动作仍即时生效。

`beforetoggle` 更新 `aria-expanded`，`aria-controls` 关联 Vue useId 生成的菜单 ID。当前模式选项获得 autofocus。选择后立即 hidePopover、恢复 invoker 焦点并 emit change-view，不等 160ms 才导航。

## 参考来源

已访问 shadcn-vue 官方 Popover 文档入口 `https://www.shadcn-vue.com/docs/components/popover.html`，同时阅读本地官方源码，以实际代码而非网页摘要确认状态驱动的淡入、缩放和定位原点。下列仓库 SHA 固定为本次只读检视 HEAD，没有运行或修改参考项目：

- shadcn-vue `b251d9fd92aa496495e127137a7734704fb34a29`：`apps/v4/content/docs/components/popover.md`，`apps/v4/styles/reka-vega/ui/popover/PopoverContent.vue`。基于打开/关闭状态做 fade/zoom，100ms，Popover transform origin。
- openchamber `74b79d41eac44ff38790c66f238050936083e0bb`：`packages/ui/src/components/ui/dropdown-menu.styles.ts`，150ms opacity/scale 起止状态；`components/layout/Sidebar.tsx` 明确 motion-reduce 禁用布局过渡。
- OpenCodeUI `371cd9cf156280c325f3759972d096c29e6d71d4`：`src/features/chat/sidebar/SidebarFooter.tsx`，真实选中主题状态驱动指示器 transform，普通按钮用 transition-colors。
- dsh-claude-style `bfc60ce7f3f3897a39252d43c0ce2be801a8d593`：`src/theme/sidebar.css` 的持续工作 spinner 特意不随 reduced-motion 停止。该项目的持续运行信号不适用于本菜单，故本轮仍尊重减少动态效果。

## 验证

定向命令：`npx vitest run src/components/AppSidebar.test.ts`，工作目录 `apps/desktop`。最终 12/12 通过，0 skipped，13.77 秒；新增三项覆盖原生 invoker 关联及 aria 状态、开菜单不错误发出视图事件、连续选择立即发出真实 change-view 与恢复焦点、同一 renderer 应用多个侧栏目标 ID 独立。既有九项生命周期管理测试同时通过。

第一次 11/12：新增 ID 测试分别 mount 两个 Vue 应用，两者 useId 均从 v-0 起步；已修为同一 Vue 应用挂两份侧栏，与实际 renderer 结构一致。没有为测试改产品 ID 生成规则。

happy-dom 没有原生 Popover/ToggleEvent；组件测试按浏览器事件字段触发真实 Vue listener，并为选择动作提供 hidePopover seam。这些结果不替代真实 Chromium 的默认 popover 开合、CSS 中间帧和 reduced-motion 验收。主代理负责真实浏览器及统一类型检查，记录应以其实际结果补充；本模块没有执行完整 Vite 构建或安装包构建。
