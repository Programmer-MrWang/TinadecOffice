# TinadecUI — UI Engineering Suite

**Last Updated:** 2026-10-06
**Last Updated By:** 会话单会议队列、紧凑纵向拓扑与自然预览交互。
**Last Verified Commit:** 基线 acb3bd3 + 工作树；UIE148/148、Desktop全量931 passed/14 skipped、类型/构建与Electron紧凑卡片/连线/预览动画/点击定位通过；非真实模型链路验收。
**Branch:** main

### 2026-10-06 紧凑会议队列与纵向拓扑

会议控件按session唯一，用户消息/待投递消息进入其中队列，不再独立成卡。UIE新卡默认420px宽、内容测高、纵向单列；manualPosition/autoHeight保留手动摆放与尺寸，旧布局保留位置。Vue Flow用真实任务依赖连接，跨节点走侧边。预览随内容收缩，160ms淡入淡出/缩放（减少动态效果时禁用），点击直接定位，删除定位提示按钮。证据 `.tinadec_dev/reports/2026-10-06-space-compact-topology.zh-CN.md`；完整空间执行组合仍进行中。

### Conversation families (2026-10-06)

NavCard renders HomeController.visibleSessions, classified by Core view_mode. A session belongs to flat or space at creation; opening the other view selects its own session. Session geometry remains UIE-owned; classification is not inferred from sessionBySessionId or cached canvas visits. [Evidence](../../.tinadec_dev/reports/2026-10-06-session-view-isolation.zh-CN.md).


TinadecUI is the UI-engineering home inside TinadecOffice. Consumers (`apps/desktop`, `apps/web`) import it as `@tinadec/ui` — a registered alias in both packages' `vite.config.ts` and `tsconfig.json` that resolves to `apps/TinadecUI/src/index.ts`. Both consumers also map `@` → `apps/desktop/src`, so TinadecUI files may reference app code via `@/` and it resolves under every consumer. The boundary is a module home + public barrel, not a build-isolated library.

## Standalone display repo (2026-08-28)

The standalone display/distribution surface for external consumers (e.g. the Tinadec official website) is a separate repo whose location is resolved by `scripts/sync-tinadec-ui.mjs` — default target `../TinadecUI` next to this checkout, overridable with `TINADEC_UI_TARGET`. Source of truth stays in TinadecOffice; sync copies the 30 barrel primitives + the ui barrel + `lib/utils.ts` + logo assets, rewriting `@/lib/utils` → `../../lib/utils`. `tokens.css`/`fonts.css` in that repo are curated derivatives of `apps/desktop/src/styles.css` L1-370 + the chat micro-interactions (L4954-5057), adapted to web selectors — edit them by hand after token changes. The standalone repo requires Vue 3.6.0-rc.7 + `vue-shim` + `vaporInteropPlugin` because 5 primitives are Vapor SFCs; see its `README.md`/`design.md`.

## Structure

```
apps/TinadecUI/
├── package.json      # @tinadec/ui (private; no standalone build — consumers resolve @/)
├── tsconfig.json     # mirrors desktop; @/* → ../desktop/src/*
├── AGENTS.md
└── src/
    ├── index.ts      # public barrel — re-export each module's public surface
    ├── engine/       # TinadecUIE — the Engine module (pure-TS layout engine + persistence)
    └── components/   # the Components module — the Vue UI library
```

## Single layout system (2026-09-27)

UIE is the **only** layout system. The legacy panel system (`ContextPanel`/`PanelHome`/`usePanelTabs`, `.float-panel`/`.workspace`/`--chat-*` CSS, `uie-card-fill.css` neutralizers, the PanelType migration and the `browser`↔`preview` alias) is deleted — do not reintroduce a parallel host, tab model or positioning layer.

- **Naming**: everything UIE uses the `uie` prefix — CSS classes `uie-*`, injection keys `uie:*`, instance ids `uie-*`, store variable `const uie = useUie()`. "Workbench" now only means the `/workbench` run page (`WorkbenchPage.vue` + `stores/workbench.ts`), unrelated to UIE.
- **Route entry**: a UIE route calls `useUiePage(pageId)` (`apps/desktop/src/lib/uiEngine.ts`) — init once + `showPage(pageId)` on mount, which restores that page's persisted layout or falls back to its preset. `applyPreset` is a layout *reset*; never call it on navigation. Hydration resolves the page shown *now*, so cold deep links (`#/market`, `#/settings`) keep their own layout.
- **Per-project layouts**: `ensureProductionUie` binds `homeController.selectedProjectId` → `uie.setActiveProjectId` once. Pages in `PROJECT_SCOPED_PAGES` (`engine/scope.ts`, currently only `home`) read/write `workspace-page(project, page)`; a project with no layout of its own inherits the page-wide layout (the one used with no workspace selected) → global → preset, and forks only on its first edit. `market` stays page-wide. Context swaps (page, project, hydration) go through `bus.loadSnapshot`: not persisted back and undo/redo history cleared, so an inherited layout is never silently copied and undo never crosses page/project. Only commands/undo/redo/`applyPreset` persist.
- **Card content** (`AppSidebar` `.sidebar`, `ChatPanel` `.conversation`) is normal-flow content that fills its card; the stack owns position, size and material.
- **Initial readiness**: `UieStore.ready` settles after initial hydrate + restore, including fallback on failure. Consumers can await it before mounting card content to avoid replacing an already-entering default tree with a slow saved layout.
- **Market readiness**: Market selects its target snapshot after `ready` and before creating the canvas; never mount the previously shared Home cards as a temporary Market tree.
- **First activation**: `UieCardHost` creates content when its tab is first active. Thereafter hidden tabs keep the same component and local state, with reactive `uie:active`; do not turn this into destroy-on-every-tab-switch.
- **Detached windows**: the window `type` is the UIE descriptor id; `useDetachedTabs` adds `sessionId`/`projectPath` on detach and strips them on reattach.
- **Feature icons** come only from `cards/home/featureCatalog.ts` (`featureIconFor`).
- **Tab middle-click**: `BrowserTabBar` and `UieStack` close non-pinned tabs on `auxclick` button 1, consume the event on pinned Home, and leave left activation, right detach, and left drag behavior unchanged. The contract is covered by `apps/desktop/src/components/BrowserTabBar.test.ts`.

## The three modules

### Session space (2026-10-06, first delivery)

Desktop `/space` composes UieShell/UieCanvas with a fixed Composer and Vue Flow. The optional snapshot.space branch stores session geometry; `spaceSync/spaceMove/spaceViewport` use the existing bus, and layerStore persists `sessionBySessionId` without cross-session inheritance. New runtime IDs append without moving existing objects; negative coordinates and user sizes survive repair. Non-history runtime additions and camera changes survive undo. `undoStack.popRedo` now restores the undo record; repeated undo/redo is tested. SpatialWorkCard is the 16th registered descriptor and renders through UieCardHost; its preview shares object identity/read data. `instancePool` still does not guarantee cross-container keep-alive. Full execution toggles/live work surfaces remain open; [implementation and evidence](../../.tinadec_dev/reports/2026-10-06-spatial-mode-first-slice.zh-CN.md).

### STREAMING OUTPUT（2026-09-23）

Home `ChatCard.vue` 将 `homeController.agentTurnActivities` 透传给 Desktop `ChatPanel`；活动的 run 分桶与消息归属由 Desktop 呈现层负责，UIE Engine 不接触模型输出或业务状态。验证：随桌面组件与类型门禁。


TinadecUI organizes UI engineering into three modules (the user's framing):

| Module | Role | Location |
|--------|------|----------|
| **Engine (TinadecUIE)** | Deterministic layout authority — the pure-TS, DOM-free layout engine (types/commands/reducer/undoStack/scope/registry/presets/repair/constraints/commandBus/instancePool/dockDrop) + versioned persistence (layerStore/migrate). Owns layout state; all mutations go through `commandBus.dispatch`. | `src/engine/` |
| **Components** | The Vue UI library: render components (`UieShell`/`UieCanvas`/`UieColumn`/`UieStack`/`UieDock`/`UieCardHost`/`UieCardFrame`), the reactive store (`useUie`/`initUie`), and the card registry (`src/components/cards/`). Depends on the engine **one-way**. | `src/components/` |
| **Rendering** | Page/surface rendering & transitions that compose the engine. | future: `src/rendering/` |

## Dock (multi-pane split)

Chatroom（2026-09-18 新增，**2026-10-04 整体删除**：全局聊天室随会话组织方式变化失去意义，`chatroom` 已从 `UiePageId`、`PRESET_BUILDERS`、卡片注册表与 `repair.isValidPageId` 移除；已持久化的 `chatroom` 布局条目因此变成没人读的孤儿，不需要迁移代码）。原描述：新增 `chatroom` pageId/preset，保留左侧 `nav`，中栏 `ChatroomCard` 承载 Desktop 只读观察面板，右栏为空。descriptor不可关闭/拖动，复用现有command bus和版式序列化；repair识别新pageId，无snapshot形状变化。NavCard的会话选择/新建需返回首页，聊天室入口跳 `/chatroom`；Vapor卡片已登记。权限与网络均不进入纯TS Engine。

Terminal layout invariant（2026-09-18）：`terminal` descriptor 必须是 singleton。多 shell 会话由 Desktop `TerminalPanel` 内部 tabs 管理；允许多个 Uie TerminalCard 会让它们争用同一个全局 terminal attachment，最终可释放仍在使用的 xterm renderer。现有 `repairLayout` 的 singleton 去重同时承担旧持久快照修复：若历史布局含多个 terminal card，只保留第一个并正规化 active tab。不要为“多终端”把 descriptor 改回 non-singleton。

The feature/right column supports **dock splits** — recursive binary split trees of panes (`UieColumn.dock`, mutually exclusive with `primary/secondary`). Users drag a tab to a pane edge to split (row/column) or to a pane center to merge; a single collapsed rail collects every pane's feature icons.

- Engine: `engine/types.ts` (`UieDockNode`/`UieDockGeometry`), `engine/reducer.ts` (commands `splitDockPane`/`mergeDockPane`/`mergeDockColumn`/`moveCardToDockPane`/`resizeDockSplit`, tree helpers, `findInstanceLocation` with `paneId`), `engine/constraints.ts` (`flattenDock`), `engine/repair.ts` (`repairDock`), `engine/dockDrop.ts` (drop-zone pure function).
- Components: `components/UieDock.vue` (flat pane/divider/overlay rendering), `UieStack.vue` (`paneId`/`paneMain` + split-pane minimal tab bar + merge button), `BrowserTabBar.vue` (shared drag source via `@/composables/useDockDrag`), `UieColumn.vue` (virtual main-pane drop rect before the first split; collapsed rail collects all dock panes' icons).
- Invariants: exactly one `main` pane hosting `homePicker`; non-main panes are never empty; collapsing to a single main pane normalizes `dock` back to `null` (stacks restored).
- **Window-stacking overlay**: a float right feature column (hosts `homePicker`) wider than the center's comfort width (`MIN_CHAT_COMFORT_WIDTH`, the composer no-wrap threshold) floats over the chat instead of squeezing it — `computeGeometry` marks `degraded.overlayRight` + `ColumnGeometry.overlay`, clamps the panel so `MIN_OVERLAY_STRIP` of chat stays visible, and `UieColumn` renders it at a higher z-index. Drag ceiling is `maxOverlayColumnWidth`. Visual-only, never written back.
- `snapshot.version` stays **1**: `dock` is an optional additive field; old persisted snapshots (no `dock`) load unchanged via `repairLayout`, so no `version` bump is required.

## 2026-10-05 Home UIE renderer stability

真实 Electron 启动后等待连接超时会在 Home UIE Vapor 树挂载时触发 insertBefore on Node，Settings 路由不触发。为保住主界面，UieShell/UieCanvas/UieColumn/UieStack/UieDock/UieCardHost/BrowserTabBar 及 Home cards 19 个 SFC 暂退回 classic template；布局、状态、样式和命令总线不变。apps/desktop/src/vapor/vaporBatch.ts 的 batch1 留空并明确 deferred，VAPOR_OPTED_IN 同步收窄。AppSplash 改为常驻节点的 CSS leaving 状态，根 Transition 不再在同一帧卸载 splash 并挂载 UIE。复验：windowLifecycle + vaporBatch 9/9，vite build 通过，真实 Electron 在无 Gateway 场景等待 45 秒仍可见 Home，无 UI crashed。待 Vue Vapor interop 稳定后再逐层恢复，不要只恢复根组件。

## Module boundary rules

- **Engine core is pure TS and DOM-free.** Do not add Vue/DOM imports to `engine/types/commands/reducer/undoStack/scope/registry/presets/repair/constraints/commandBus/instancePool`.
- **Dependency direction is Components → Engine (one-way).** Components read `useUie()`/types and dispatch commands; the engine never imports Vue components or `useUie`.
- **Persistence** (`engine/persistence/`) is part of the Engine module. `layerStore.ts` stays DOM-free; the Electron adapter currently lives in `persistence/types.ts` and reads `window.tinadec.layout`, then writes through main-process `layoutStore.cjs` → `userData/uie-layout.json`. Do not describe that adapter as DOM-free.
- All layout mutations go through `commandBus.dispatch({ command, source, expectedRevision })`; `ai` source is reserved/rejected.
- Persistence format is versioned; a breaking snapshot-shape change bumps `snapshot.version` and is handled in `repairLayout`. No legacy-format migration shims are kept (the old PanelType migration was removed 2026-09-27).
- Vapor: Home UIE's 19 rendering/card SFCs and the three Market cards currently use classic templates; MarketPage is classic too. Do not restore these boundaries without real-renderer verification. Other opted-in primitives stay registered in `apps/desktop/src/vapor/`; keep the registry consistent when adding/renaming components.
- **Card context injections are reactive contracts.** `UieCardHost` provides `uie:instanceId` (stable value), `uie:cardState` (stable object identity) and `uie:active` (a `ComputedRef`). A Vapor SFC's setup runs once, so providing `props.x` directly freezes it at mount time — which is what made a card mounted behind the active tab report itself hidden forever. Consumers read `uie:active` through `inject<MaybeRefOrGetter<boolean>>` + `toValue`, which also tolerates a host that supplies a plain boolean.

## Adding a new module
1. Create `apps/TinadecUI/src/<module>/`.
2. Export its public surface from `apps/TinadecUI/src/index.ts`.
3. Add a row to the module table and this doc's structure tree.
4. Document the module's `@/` app-code dependencies in this doc.

## Importing TinadecUI
```ts
// desktop or web renderer
import { UieShell, initUie, buildUieRegistry, createLayerStore } from '@tinadec/ui'
```
`@tinadec/ui` is registered in `apps/desktop` and `apps/web` (vite alias + tsconfig paths → `../TinadecUI/src/index.ts`). When a TinadecUI file needs desktop app code (e.g. `@/api`, `@/controllers/*`), it uses `@/` — resolved to `apps/desktop/src` under both consumers. Tests run from `apps/TinadecUI` via `vitest` (see `vitest.config.ts`, which defines the same `@` alias).
