# 搜索浮窗遮罩与全局材质：只读核查

归档说明：本文件为实施前核查，归入独立2026-10-09搜索材质专项。主任务之后已完成源码与Windows1169×719实页验收、4文件50项定向回归及类型检查；最终结论见`.tinadec_dev/reports/2026-10-09-search-material.zh-CN.md`。下文“未改/待确认”描述核查时点，不代表当前仍未实现。

日期：2026-10-09。对应唯一模块任务 APP-RENDERER-107 / APP-RENDERER-F006。本记录为实施前源码核查与最小建议，未改生产源码、测试或用户偏好，不能据此宣称材质已验收。

## 实际路径

- `apps/desktop/src/components/CommandPalette.vue:194-212` 在 open/ref watcher 中执行 `HTMLDialogElement.showModal()`，关闭或卸载调用 close；`@cancel.prevent` / `@close` 回到同一个 closePalette。
- `CommandPalette.vue:235-246` 原生 dialog 没有 usePanelStyles 的 `:style` 或 `data-panel-effect` 绑定。
- `CommandPalette.vue:268-272/386-387` 的 fullscreen 仅切换 class、尺寸和 AppHeader，不调用 Fullscreen API，不改变 showModal/modal 生命周期。
- `CommandPalette.vue:381/384` 根背景使用 `--surface-section`，但根未绑定 material attribute；原生 `::backdrop` 只提供16%主题色，无 backdrop-filter。
- `CommandPalette.vue:421` 活动搜索行直接使用 `--bg-hover`，绕过材质表面的透明度映射。
- `apps/desktop/src/composables/usePanelStyles.ts` 已提供统一 getPanelStyle / getPanelDataAttributes，opaque 为普通背景，translucent 为全局 opacity 的 rgba，blur 增加全局 blur 和派生过滤；style getter与data getter须均经 computed读取响应式设置。
- `apps/desktop/src/styles.css:4820-4900` 明确根绑定 data-panel-effect 后后代继承 `--surface-*` 材质映射。根和内部状态都应沿该端口，不创建第二份搜索材质存储。

## 最小建议

在 CommandPalette 导入 usePanelStyles，直接给原 dialog 绑定 computed(getPanelStyle()) 与 computed(getPanelDataAttributes())，保留原 opaque `--surface-section` 兜底。原生 `::backdrop` 增加标准和WebKit backdrop-filter:blur(6px)，让背景遮罩模糊与面板全局材质的effect/opacity/blur独立。活动结果背景改 `--surface-hover` 可保持opaque现有视觉，同时随材质映射；若产品需要强调当前选择，已有 `--surface-selected`，无须新颜色。

只改绑定与叶层CSS；showModal、搜索、键盘、取消、焦点和fullscreen结构保持现有契约。不开第二个modal或body/filter遮罩。

## 原生遮罩范围

只读获取CSSWG官方草案CSS Positioned Layout4 §3.2：`::backdrop` 独立绘制在其top-layer元素下方，默认position:fixed / inset:0，覆盖视口而非只覆盖dialog外部。Filter Effects2指出backdrop-filter对其border box内的背景图像过滤；当背后的元素带opacity/filter等Backdrop Root触发条件时采样有边界。

因此原生遮罩并不存在“必定只模糊dialog外部”的结构限制；透明搜索面板内仍应显示其下方的已模糊内容。但浏览器合成、透明材质和fullscreen实际结果仍须由主任务取证，不能把规范描述替代视觉验收。

实际读取：PowerShell Invoke-WebRequest 对 `https://drafts.csswg.org/css-position-4/` 与 `https://drafts.csswg.org/filter-effects-2/` 成功，提取对应规范条款。现有 CommandPalette / usePanelStyles 测试仅作为入口核查，没有本轮新增材质测试或重跑。

## 待主任务确认

源码真实绑定、根材质与活动表面 token；三种材质（opacity/blur变化）在默认浮窗和fullscreen中的表现；native::backdrop固定6px；关闭恢复、Escape/搜索回归、类型与浏览器结果，以及检查后恢复原用户材质偏好。
