# 空间模式画布基础核查

日期：2026-10-06。源码基线：`46731fd`，`main`，核查开始时工作树干净。范围：Vue Flow 官方能力、现有 UIE 和卡片宿主；本轮没有实现空间模式。

关联模块：[APP-UIE-ENGINE](../../docs/development-program/02-modules/app/uie-engine/README.md)、[APP-UIE-COMPONENTS](../../docs/development-program/02-modules/app/uie-components/README.md)、[APP-LOCAL-STATE](../../docs/development-program/02-modules/app/local-state/README.md)、[APP-RENDERER](../../docs/development-program/02-modules/app/shared-renderer/README.md)。这是各模块 001 审计任务的一项研究输入，不代表完整逐功能审计完成，也不另建任务数据库。

## 判断

可以基于现有依赖和 UIE 开发“进入一个自由画布，在上面放置、移动、调整真实 Vue 控件”的第一版。Vue Flow 提供交互和视口基础，UIE 已有控件目录、布局命令、撤销与保存。现有三栏布局模型和渲染器需要增加空间分支，不能把 `UieCanvas` 名称或 `x/y/w/h` 字段视为已经完成自由画布。

如果“类似 Figma”进一步包括矢量绘制、文字编辑、设计组件变体、完整图层编辑和多人协同，需要另外实现这些产品能力。第一轮适合先验证业务控件在自由画布上的组织与操作。

## Vue Flow 能提供什么

仓库的 [Desktop package.json](../../apps/desktop/package.json#L139) 和锁文件已声明 `@vue-flow/core ^1.48.2`、`@vue-flow/background ^1.3.2`；本机安装的 core 为 `1.48.2`。这是已使用的依赖，并非拟新增框架。

| 能力 | 可复用基础 | 接入时需要做的事 |
| --- | --- | --- |
| 大范围二维画布 | 视口平移、缩放、适配内容、坐标转换 | 确定鼠标/触控板规则，并保存视口 |
| 放真实控件 | 自定义节点用 Vue 组件或插槽渲染 | 一个空间节点承载 UIE 卡片宿主，复用注册目录 |
| 对象操作 | 拖动、单选、多选、框选、网格吸附 | 将操作转换成 UIE 命令，定义快捷键与选择规则 |
| 调整节点尺寸 | 官方 `@vue-flow/node-resizer` 组件 | 当前未安装；接入尺寸约束和 UIE 提交 |
| 分组与层级 | 父子节点、范围约束、`zIndex` | 分组/解组、图层面板、批量编辑语义仍由产品实现 |
| 可选辅助 UI | Background、MiniMap、Controls、NodeToolbar | 当前只有 Background 已声明，其他插件按实际需求选用 |
| 关系线 | 自定义边、连接事件、连接验证 | 定义线的业务含义，接入业务服务 |

依据：[官方介绍](https://vueflow.dev/guide/)、[配置](https://vueflow.dev/guide/vue-flow/config.html)、[自定义节点](https://vueflow.dev/guide/node.html)、[视口方法](https://vueflow.dev/guide/utils/instance.html)、[节点尺寸](https://vueflow.dev/guide/components/node-resizer.html)、[嵌套节点](https://vueflow.dev/examples/nodes/nesting.html)。

Vue Flow 的导出对象可以包含节点、边和视口，但持久存储要由应用实现，见 [Save & Restore](https://vueflow.dev/examples/save.html)。对齐参考线有 [官方示例](https://vueflow.dev/examples/helper-lines.html)，不等于项目已经接入。撤销/重做、复制粘贴、对齐分布、图层管理、协同等也需产品接入或实现。

节点由 DOM/Vue 渲染，边使用 SVG；这一模型适合承载可操作的业务组件。它本身不构成 Figma 的矢量文档与设计编辑系统。实际业务卡片的数量上限、模糊材质成本和流畅度需真实渲染测量，不能由简单节点示例推算。

本轮还核对了已安装包的 `dist/types/flow.d.ts`、`node.d.ts`、`store.d.ts` 与运行代码：支持 `parentNode`、`dragHandle`、`zIndex`、`onlyRenderVisibleElements`、`screenToFlowCoordinate`、`toObject/fromObject`。不照搬 React Flow 的 `selectionOnDrag` 配置名；本版 Vue Flow 的交互选项应按自身类型定义配置。

## 当前 UIE 的可用基础与具体边界

| 机制 | 当前源码事实 | 对空间模式的意义 |
| --- | --- | --- |
| 卡片注册 | [cards/index.ts](../../apps/TinadecUI/src/components/cards/index.ts) 注册 15 种卡型 | 可以统一承载已有 Git、审批、浏览器、终端、Agent 等组件 |
| 卡片实例 | [types.ts](../../apps/TinadecUI/src/engine/types.ts#L118) 有稳定 ID、descriptorId 与可序列化 state | 空间节点可以引用同一实例契约，组件无需写进快照 |
| 命令与撤销 | [commandBus.ts](../../apps/TinadecUI/src/engine/commandBus.ts)、[undoStack.ts](../../apps/TinadecUI/src/engine/undoStack.ts) 有 revision 校验、gestureId 合并与 50 条历史 | 可以复用手势机制；需扩展空间命令，并修复下述 redo 后不可再 undo 的缺陷 |
| 本地保存 | [layerStore.ts](../../apps/TinadecUI/src/engine/persistence/layerStore.ts)、[layoutStore.cjs](../../apps/desktop/electron/layoutStore.cjs) 有分层解析、400ms 防抖、临时文件写入后 rename | 可以复用保存通路，但空间快照须被存储/修复规则识别 |
| 项目范围 | [scope.ts](../../apps/TinadecUI/src/engine/scope.ts#L22) 当前仅 home 按项目保存 | 空间页面需要显式加入范围规则；多个空间还要设计空间 ID |
| 内容挂载 | [UieCardHost.vue](../../apps/TinadecUI/src/components/UieCardHost.vue#L14) 首次激活才创建，随后隐藏保留 | 已验证同一宿主中的标签切换；没有跨容器/路由保活保证 |
| Vue Flow 实践 | [AgentModeCanvas.vue](../../apps/desktop/src/components/canvas/AgentModeCanvas.vue#L179) 等四处已渲染 Vue Flow | 项目已具备自定义节点、位置与事件接入经验，但未与 UIE 空间布局连通 |

### 不能直接沿用的假设

1. **画布仍是三栏布局。** [UieCanvas.vue](../../apps/TinadecUI/src/components/UieCanvas.vue#L34) 遍历 `columnOrder` 渲染 `UieColumn`；[computeGeometry](../../apps/TinadecUI/src/engine/constraints.ts#L220) 计算列、栈和 dock。没有摄像机/视口坐标或自由节点集合。
2. **坐标字段没有进入显示链。** `x/y/w/h` 的注释定义为网格单位；[updateCardGrid](../../apps/TinadecUI/src/engine/reducer.ts#L1109) 只修改这些字段。目前生产渲染组件不读取卡片上的这四个字段决定位置/大小。
3. **恢复规则会改变空间数据。** [repair.ts](../../apps/TinadecUI/src/engine/repair.ts#L224) 把 x/y 取整并钳到零；空间坐标通常需要负值和小数。其 orphan guard 要求卡片被列栈/dock 引用，纯空间节点会触发预设回退。当前还有 500 张卡片的修复上限和 4MB 磁盘保存上限，不能说无容量约束。
4. **实例池不是已接通的 Vue 保活系统。** [instancePool.ts](../../apps/TinadecUI/src/engine/instancePool.ts) 保存组件定义和元数据；[useUie.ts](../../apps/TinadecUI/src/components/useUie.ts#L93) 创建并暴露它。仓库搜索未找到渲染路径调用 `pool.hydrate/get/destroy`；[UieStack.vue](../../apps/TinadecUI/src/components/UieStack.vue#L380) 直接创建各自的 `UieCardHost`。跨父容器移动可能重建宿主，不能继承实例池注释中的“永不重挂”保证。
5. **卡片多实例和业务上下文不是通用能力。** 注册目录中只有 browser 为非单例。TerminalCard 的单例守卫用于避免多个 xterm 视图争用同一终端；Git、Approval、Agent 等复用全局 HomeController。一个节点各自绑定不同会话/项目，需要扩展上下文与具体组件，不能只改 singleton 标志。
6. **空间入口尚未实现。** [router.ts](../../apps/desktop/src/router.ts) 和 `UiePageId` 没有空间页面；现有路由入场 CSS 里的 spatial 指空间动效，不是自由画布模式。
7. **撤销链尚有真实缺陷。** 只读执行“updateCardGrid → undo → redo → undo”，前两次历史操作返回成功，redo 后 `canUndo=false`，最后一次 undo 返回 undefined。`commandBus.redo` 恢复 after 快照但没有将记录放回 undo 栈，而 `popRedo` 只弹出记录。现有测试通过不代表覆盖了这条闭环；本轮记录缺陷，未修改产品源码。

另外，`LayoutSource = ai` 当前被明确拒绝，见 [commands.ts](../../apps/TinadecUI/src/engine/commands.ts#L116)。若后续要让智能体整理/创建画布对象，应另接受治理的布局命令入口。节点连线也不会自动成为 Core 的执行/派发契约。

## 建议的接法

让 UIE 增加空间布局分支，继续持有控件 ID、对象位置尺寸、层级、编辑历史与保存规则；Vue Flow 作为这个分支的渲染和交互层。

```mermaid
flowchart LR
  A[UIE 空间状态与命令] --> B[Vue Flow 空间渲染器]
  B --> C[UIE 卡片宿主与真实 Vue 控件]
  B -->|交互结果提交| A
  A --> D[现有布局保存通路]
```

- 新布局使用明确的世界坐标与逻辑像素尺寸；与旧网格字段区分，制定快照兼容/迁移。若采用互斥布局形状，须升级 snapshot 版本并处理旧三栏数据。
- 三栏和空间是同一 UIE 权威下的布局分支。空间入口使用现有初始化、ready、页面/项目切换通路。
- 从 UIE 投影节点，交互结束通过命令提交。按 [Controlled Flow](https://vueflow.dev/guide/controlled-flow.html) 接管对象修改，避免 Vue Flow 和 UIE 各自持久化一套布局。拖动过程可以有临时预览，提交/撤销以一次完整手势为单位；多选操作需要批量语义。
- 视口是“看向哪里”，对象坐标是“放在哪里”；视口保存和选择状态应与对象编辑历史分别处理，平移视图不应挤占对象撤销记录。
- 先复用 `UieCardHost` 的内容契约，空间节点的外壳负责移动/选中/尺寸操作。卡片内部的按钮、文字选择和滚动要避开画布手势；现有绝对定位与 pointerdown stop 的 `UieCardFrame` 不能未经检查就直接嵌套。
- 视口裁剪会影响组件挂载，不能直接打开 `onlyRenderVisibleElements` 并保证状态无损。先验证稳定宿主和业务状态归属，再决定离屏降载。
- 新空间宿主保持当前 UIE 的 classic 边界；终端、iframe、编辑器、浮层和材质在缩放下需单独实测。

## 空间工作区域与默认排布

一次用户消息被会议智能体领取后，会形成一个相对集中的工作区域。这个区域包含会议智能体、计划、队伍/执行智能体，以及它们产生的代码编辑、搜索、测试、浏览器、Figma、Git 和审批控件。它们默认沿同一条主线排开，让用户一眼看到“从任务进入到执行产出”的连续过程；智能体派生出的队伍或分支可以从主线继续排开，仍属于这次工作的同一片区域。

这条线是**首次排布规则和阅读顺序**，不是永久布局锁定。用户可以像 Figma 一样自由拖动控件、调整间距和位置；用户改过的位置要持久保存。后续新增控件只自动放到当前区域的合适空位/主线末端，不应重新整理或覆盖用户已经调整的对象。系统需要保存对象的世界坐标、尺寸、所属工作区域和顺序关系；工作区域是运行事实的组织关系，控件坐标是用户的编辑结果，两者不能混为一个自动布局算法。

输入框上方的规划、计划、更改、审批等圆角入口只是当前会话的全局索引。悬停时从画布中临时预览对应工作区域或控件，计划入口可以预览堆叠的多份计划；点击后应把画布视口移动到真实控件的位置，不能创建第二份浮动控件。入口预览、画布对象和运行状态必须引用同一对象 ID。

默认排布的最小规则可以先固定为：消息/会议智能体在起点；计划紧随其后；队伍与执行智能体沿主线继续排列；每个执行控件挂在其负责的智能体或任务附近；代码、搜索、测试、浏览器、Figma、Git、审批等产出控件排在对应执行对象之后。多智能体计划可以形成一组相邻卡片或堆叠预览，但展开后仍定位到画布中的真实卡片。这个规则只负责新工作区域的初始可读性，不能限制用户后续自由调整。

这意味着空间模式的第一版验收不只是“能拖动两个节点”，还要证明：一次派发能生成一片可读的默认区域；新增执行对象不会破坏已调整的布局；入口悬停能预览，点击能定位；会话重开后对象仍在原位置。

## 第一轮应证明什么

讨论中的第一轮目标是：进入空间模式能看到一个可平移缩放的画布；模拟一次会议消息领取，生成会议/计划/执行三个真实控件并沿主线排开；用户移动其中一个控件后再新增一个执行控件，原有位置不变；从入口悬停预览、点击定位；撤销一次位置操作；返回或重启后恢复位置/尺寸/视口。控件中的输入、滚动和按钮仍可用。

可以先用已有 Git/Approval/Browser 中的两个验证宿主和交互。此前 Figma App 页的 Taskboard、TestAgent、Design 等名称未出现在当前 UIE 卡片注册表，不能把设计稿当成已有生产卡型；后续逐个实现或复用实际业务组件。

图层、对齐、分组、关联线及多人协同按后续讨论加入。它们不是这轮基础核查的已授权实施清单。

## 本轮验证与限制

| 验证 | 命令 | 本轮结果 |
| --- | --- | --- |
| UIE 现有机制 | `npm.cmd test -w @tinadec/ui` | 13 文件，142 passed，退出 0 |
| 同宿主首次激活/标签状态 | 在 apps/desktop：`node ../../node_modules/vitest/vitest.mjs run src/components/UieCardHost.test.ts --pool=threads` | 1 文件，2 passed，退出 0 |
| 磁盘布局存取 | `node --test apps/desktop/electron/layoutStore.test.cjs` | 7 passed，退出 0 |
| 坐标与历史链只读探针 | `node .tinadec_dev/evidence/2026-10-06-spatial-canvas-probe.mjs` | 退出 0，行为观察见下；退出成功不等于产品行为正确 |

可重跑的 [探针](../evidence/2026-10-06-spatial-canvas-probe.mjs) 使用现有 Vite 解析到的 esbuild，在内存打包实际 engine 源码，只操作私有预设/registry/bus，不启动服务器、挂载生产卡片或写入真实布局。本轮输出：

```json
{"gridCommandAccepted":true,"geometryUnchanged":true,"repairedPosition":{"x":0,"y":0},"firstUndo":true,"firstRedo":true,"canUndoAfterRedo":false,"secondUndo":false}
```

只验证现有机制。没有运行新增空间模式、真实 Electron 画布操作、跨容器保活、重控件性能、跨平台或协同验收，也没有重跑业务全量。未改变业务源码、依赖或布局数据。
