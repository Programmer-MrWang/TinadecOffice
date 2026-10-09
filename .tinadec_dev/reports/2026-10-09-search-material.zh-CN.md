# 搜索背景模糊与全局材质修复

日期：2026-10-09。基线：`d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` + 当前工作树。唯一任务：[APP-RENDERER-107 / F006](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-107)。前两批 UI、GraphSeedPack 和存储工作保留各自记录。

## 问题与实现

用户在当前搜索浮窗标注：打开搜索时页面背景需要模糊，搜索面板本身需要跟随材质设置。源码及修复前实页确认，原生 dialog 的 `::backdrop` 只有颜色遮罩；dialog 没有接入 `usePanelStyles`，因此始终使用不透明的 section 背景。

`CommandPalette.vue` 直接复用已有 `usePanelStyles` 的响应式样式和 `data-panel-effect`，采用唯一全局材质来源。原生遮罩增加 6px `backdrop-filter` 及 WebKit 属性。活动结果使用 `--surface-hover`，让内部选中态继承既有材质 token。普通浮窗和全屏继续使用同一个 `showModal()` dialog；关闭时由浏览器移除遮罩，不给应用根节点写 filter。搜索目录、焦点、键盘、请求及宿主授权行为沿用现有逻辑。

复用仓库 shadcn-vue / Ponytail 规则并核对官方原生 dialog/backdrop 文档；本次是现有组件的材质接线，无新增组件依赖。源码审计及规范来源见 [审计记录](../evidence/2026-10-09-search-material/command-palette-material-audit.md)。

## 实际验收

Windows 当前运行的本地浏览器 `http://127.0.0.1:5173/#/`，约 1169×719。通过实际按钮和滑块键盘操作测试，DOM 只用于读取渲染状态。

| 场景 | 实际结果 |
|---|---|
| 不透明搜索 | `:modal=true`，面板实心；遮罩 `blur(6px)`，背景可见模糊 |
| 半透明，46% | 面板背景 `rgba(15,20,26,0.46)`，自身 filter 为 none；遮罩仍 6px，选中行 alpha 为 0.82 |
| 毛玻璃，46% / 14px | 背景 alpha 0.46、面板 `blur(14px)`，内部派生材质及选中行 alpha 0.62 生效 |
| 全屏毛玻璃 | 全屏覆盖视口，仍采用 alpha 0.46 / blur 14px，保留原生 modal |
| 缩回并 Escape 关闭 | `:modal` 数量 0、dialog 关闭、`#app` filter 为 none |
| 恢复用户设置 | 原始不透明 / 80% / 8px 已全部恢复，返回首页，重新打开搜索显示修复效果 |

[实页记录](../evidence/2026-10-09-search-material/browser-checks.json)；[不透明](../evidence/2026-10-09-search-material/search-opaque.jpg)、[半透明](../evidence/2026-10-09-search-material/search-translucent.jpg)、[毛玻璃](../evidence/2026-10-09-search-material/search-blur.jpg)、[全屏](../evidence/2026-10-09-search-material/search-fullscreen.jpg)、[最终效果](../evidence/2026-10-09-search-material/search-final.jpg)。

## 回归与范围

在 `apps/desktop` 运行 `npx vitest run src/components/CommandPalette.test.ts src/composables/usePanelStyles.test.ts src/composables/useCommandPalette.test.ts src/settings/sections/AppearanceSection.test.ts`：4 文件、50 项全部通过，exit 0。新增组件集成回归覆盖材质切换、参数响应、全屏保留和回到不透明时移除旧 filter/token；透明度的实际 CSS 变量解析以浏览器结果验收，避免 Happy DOM 不支持该 CSS 值导致假失败。

`npx vue-tsc --noEmit`：exit 0。原始日志：[定向测试](../evidence/2026-10-09-search-material/targeted-tests.log)、[类型检查](../evidence/2026-10-09-search-material/typecheck.log)。

本次没有重跑全产品生产构建、安装器或 Linux/macOS；专项通过不替代其验收。当前普通浏览器的远端类别保留受管 API 的宿主授权失败提示；未放宽授权、未改后端，也不将材质修复宣称为搜索数据链验收。
