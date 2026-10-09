# 2026-10-09 UI comments 1/2：窗格合并与面板收起

关联模块：[APP-UIE-COMPONENTS](../../../docs/development-program/02-modules/app/uie-components/README.md)。基线 `d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` + 工作树；本文件仅记录 Comment 1/2 后端无关的 UIE 源码与定向验证，真实页面验收由根任务汇总。

## 动作核查

- `BrowserTabBar.vue` 主面板原双左箭头 emit `restore-dock` → `UieStack.restoreDock` → `mergeDockColumn`，把整列所有分窗合并到主 stack。保留所有卡片，主面板 active tab 不变。
- `UieStack.vue` 非主窗格原双左箭头 → `mergeIntoMain` → `mergeDockPane`，仅把当前窗格的卡片合回主面板。最后一个分窗消失时 dock 规范化为 stack。
- 主面板 `PanelRightClose` → `collapse` → `collapseColumn`，收起整列；原 tab 与 dock 布局保留。

合并全部使用 `PanelsTopLeft`；当前窗格合回使用 `Combine`；收起继续使用 `PanelRightClose`。三个按钮使用各自动作文案作为 `aria-label` 和 Tooltip。native `type="button"` 保留 Enter/Space 原生键盘激活；SVG `aria-hidden`。Tooltip 使用官方 primitive 的 Provider/Root/Trigger as-child/Portal/Content，鼠标悬停与键盘 focus 都可显示，Escape 由 primitive 处理，Portal 避免 stack overflow 裁剪。旧本地 `ui/tooltip.vue` 只有 mouseenter/mouseleave 和绝对定位，不用于这些控件。

单窗格按钮 target 从22×22变为28×28，增加focus-visible轮廓。主面板按钮公共样式、`.uie-action-tooltip`、中英文文案与依赖锁定由 root 统一实现，避免多人编辑 shared CSS/locales。没有修改 engine/reducer 命令或快照格式。

## 固定参考

| 本地仓库 | 固定 HEAD | 读取的实际源码与参考结论 |
| --- | --- | --- |
| `C:/git/agent/shadcn-vue` | `b251d9fd92aa496495e127137a7734704fb34a29` | `apps/v4/content/docs/components/{tooltip,button}.md`；registry/new-york-v4/ui/tooltip/{TooltipTrigger,TooltipContent}.vue 和 button/Button.vue。Tooltip 对 hover/focus 提供提示；as-child 保留单个 semantic button；TooltipPortal 防裁剪。 |
| `C:/git/agent/OpenCodeUI` | `371cd9cf156280c325f3759972d096c29e6d71d4` | `src/features/chat/PaneHeader.tsx:295` 通过 PanelRightIcon + closePanel/openPanel aria 区分面板显示；`src/store/paneLayoutStore.ts:446` exitSplitMode 是独立动作，但该产品只保留focused pane，不能照搬其数据行为。 |
| `C:/git/agent/openchamber` | `74b79d41eac44ff38790c66f238050936083e0bb` | `packages/ui/src/components/layout/Header.tsx:104` HeaderIconActionButton 用 TooltipTrigger asChild + button type/aria；`ContextPanel.tsx:1129` collapse/expand 文案独立。仅采用明确动作、tooltip和button语义，不复制其布局引擎。 |

已读取仓库根/TinadecUI AGENTS 与 `.tinadec_dev/skills/shadcn-vue/SKILL.md` 及 composition/styling/icons 规则。官方 docs CLI 和 HTTP页面读取如下；两页面 Invoke-WebRequest 实际 HTTP200，页面title存在。web查询接口本轮无正文输出，以已固定官方源文档确认 API。

```powershell
npx shadcn-vue@latest docs tooltip button -c apps/desktop
npx shadcn-vue@latest info --json -c apps/desktop
Invoke-WebRequest -Uri https://shadcn-vue.com/docs/components/tooltip -TimeoutSec 25
Invoke-WebRequest -Uri https://shadcn-vue.com/docs/components/button -TimeoutSec 25
```

CLI项目输出见 `shadcn-project-info.json`：Vite/Tailwind4、lucide、Desktop别名映射。实际旧package.json/lock没有reka-ui，不能根据components.json或简易包装器推断依赖已安装。

## 实际执行与边界

```powershell
# cwd apps/desktop
npx vitest run src/components/BrowserTabBar.test.ts --maxWorkers=1 --no-file-parallelism
# cwd apps/TinadecUI
npx vitest run src/engine/reducer-dock.test.ts src/engine/commandBus.test.ts --maxWorkers=1 --no-file-parallelism
```

初轮 BrowserTabBar 导入阶段失败，0项执行：`Failed to resolve import reka-ui`，见 `browser-tabbar-dependency-missing.log`（原文件 `browser-tabbar.log` 保留）。这不是通过结果。Root执行 `npm install reka-ui@2.11.0 --workspace @tinadec/ui --save-exact --ignore-scripts`，将 @tinadec/ui 正式依赖精确锁定为2.11.0；added9 / changed3由root记录，没有由本子任务修改manifest/lock。

依赖完成后使用相同定向命令重跑，最终 BrowserTabBar **3/3通过、0跳过**，见 `browser-tabbar-final.log`，真实SFC/官方Tooltip组件在happy-dom经典组件环境挂载，既有中键/左键/右键/固定Home交互保持。无新增低影响镜像测试。测试日志有既有 Node module.register/localStorage warning，无组件运行异常。

UIE 既有 reducer-dock + commandBus **24/24通过**，见 `uie-dock-commandbus.log`，覆盖分窗合并、全列合并与命令事务；没有新写镜像低影响测试。该结果只证明既有命令行为未回归，hover/focus/Tooltip Portal、窄宽与真实宿主仍由后续组件运行和真实页面取证证明。


## 最终源与验收状态

当前只改 `apps/TinadecUI/src/components/BrowserTabBar.vue` 和 `UieStack.vue`，未动前轮GraphSeed dirty变更、Desktop共享CSS/locales、AGENTS或模块进度文档；依赖与共享材质/英中文案由root统一接入。`git diff --check -- apps/TinadecUI/src/components/BrowserTabBar.vue apps/TinadecUI/src/components/UieStack.vue` 退出0。没有commit/push，没有大构建或全量测试。

经典SFC组件挂载3/3 + 命令24/24是本任务实际结果。既有三项组件测试不覆盖新tooltip的focus/Portal/Escape/尺寸，所以不将该读数写为新交互的完整验收。实际Desktop页面hover/focus、键盘激活、Tooltip不裁剪、窄窗尺寸和两类合并/收起布局行为由root真实页面取证；后续结果在总报告关联。

官方HTTP状态证据：`shadcn-tooltip-http.json`、`shadcn-button-http.json`，官方标题分别Tooltip/Button；CLI上下文 `shadcn-project-info.json`。本地参考HEAD均固定于上表，不随本轮源码变化推断上游当前行为。
