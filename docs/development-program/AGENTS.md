# DEVELOPMENT PROGRAM MEMORY

**Generated:** 2026-10-05
**Last Updated:** 2026-10-08
**Last Updated By:** APP-HOME-104统一命令面板与APP-RENDERER-104空间组合执行；保留已有Markdown/空间专项。
**Last Verified Commit:** 66d103e + 工作树；命令面板分层验证与边界见 .tinadec_dev/reports/2026-10-08-command-panel.zh-CN.md，不将脚本模型/本地SFC验证写成真实外部模型或平台验收。
**Branch:** main

### 2026-10-08 命令面板实施

新增APP-HOME-F005/104，关联APP-RENDERER-104。用户要求统一新契约，不做旧空间执行方式兼容；UI、Core会话配置与运行组合共用同一用户选项。任务验收留在模块TODO，证据在共享报告与evidence，不另建状态库。完整空间工作画面/外部模型/平台等后续目标不因本次命令功能完成而整体勾选。

### 2026-10-07 Markdown 内容岛屿

APP-HOME-F004/103完成本地正文显示专项：正文连续，代码/表格/引用复用UiIslandCard；修复列表标记、checkbox尺寸、表格对齐、宽表格及长URL溢出。整篇消毒后分块，后续流式文字不重建已完成块和表格焦点。模块STATUS/TODO和局部渲染图已更新；报告`.tinadec_dev/reports/2026-10-07-markdown-islands.zh-CN.md`。979/14 skipped、native107、类型/构建及三宽度本地SFC夹具通过，不将模块001整体审计、完整App或真实模型验收标完成。

### 2026-10-07 空间布局与路由

UIE新增spatialLayout/spatialRouting纯函数：SCC/最长路径分层、同层中位排序与居中、尺寸驱动统一间距；新增同级先在本层就近找空位，不让手动远端节点吸走新卡。当前投影外历史几何保留但不撑大布局，主动整理可撤销。正交路由基于矩形边界、有限避障与端口方向，正常下游不纵向折返，逆向走侧面；blocked保留事实关系与原因。页面BaseEdge只渲染计算路径，替代默认smoothstep。详见`.tinadec_dev/reports/2026-10-07-space-layout-routing.zh-CN.md`；旧空间通过“整理本目标”应用新布局，保持用户坐标稳定。

### 2026-10-07 空间目标工作簇接手

依据`.tinadec_dev/plans/claude/piped-sparking-alpaca.md`继续第一阶段：新卡compact默认360×160，按run分区和真实依赖稳定分层；旧位置/尺寸保留，更新不移动旧卡，主动整理可撤销。任务与实例/归属与依赖分开，答案按run归位，未知依赖及受影响后继标待核验。详情/终端按需显示并保活，空间终端按当前会话run过滤，隐藏不响应全局终端快捷键。失败保留旧拓扑、文案/窄宽避让与迟到响应回归通过。报告`.tinadec_dev/reports/2026-10-07-space-clusters-handoff.zh-CN.md`；下列10-06单列420px为历史首版行为，当前默认以此条为准，完整APP-RENDERER-104仍进行中。

### 2026-10-06 紧凑会议队列与纵向拓扑

会议控件按session唯一，用户消息/待投递消息进入其中队列，不再独立成卡。UIE新卡默认420px宽、内容测高、纵向单列；manualPosition/autoHeight保留手动摆放与尺寸，旧布局保留位置。Vue Flow用真实任务依赖连接，跨节点走侧边。预览随内容收缩，160ms淡入淡出/缩放（减少动态效果时禁用），点击直接定位，删除定位提示按钮。证据 `.tinadec_dev/reports/2026-10-06-space-compact-topology.zh-CN.md`；完整空间执行组合仍进行中。

## Scope

本目录是长期模块开发档案。优先读取README、模块索引及目标模块README/ARCHITECTURE/STATUS/TODO，再回到源码和现有测试。原日期架构目录保留快照；此目录是后续讨论和任务更新入口。

## Truth and maintenance

- 模块TODO.md是任务唯一编辑位置，STATUS.md是功能状态唯一编辑位置；全局MASTER-TODO/STATUS/MODULE-INDEX由reindex生成，勿手改后期待保留。
- modules.json只维护目录/ID/节点归属；禁止生成器覆盖手写模块档案。reindex只刷新派生汇总并验证链接、稳定ID和Core24工程覆盖。
- reindex的总STATUS验证边界描述初始建档与后续专项的不同范围，不能硬编码“当前没有已验收/已完成”而否定模块更新。
- 每个Feature/Task有长期稳定ID。删除、合并或不做的条目保留替代/决策指针；同一功能缺口由一个主责模块持有，其它模块交叉引用。
- 区分源码可见、历史验证、本轮验证；只有与目标范围匹配的证据才能标已验收/已完成。禁止用测试数量或目录存在推算完成百分比。
- 未跑测试写待验收，不写未实现；平台限制先记范围边界，不默认开发所有可选能力。
- 任务进入实施前写清问题、目标、触及范围、实际依赖和验收条件。目标与当前行为分开；用户明确授权范围沿会话持续生效，不增设推断审批流程。
- 修改代码后同步受影响模块图、功能状态、任务和证据；跨模块契约变化同步相关模块档案与根AGENTS。
- Mermaid中的无向线是职责关联；有向运行/编译关系必须有源码依据。总图子节点是导航，不应当作独立服务。
- 历史todo/review只作为需求来源，引用必须带文件及章节。N9在两个历史文件中含义不同；不要只写“N9”。
- tests/Tinadec.Contracts.Tests是不可构建的遗留需求证据，不是活动验证入口（该目录README及活动sln可核）。

## Initial scope

55个模块目录，Core24工程逐一覆盖；总图82职责节点按modules.json归属或顶层导航解释。当前仅初始源码清点，模块图为职责投影，完整运行流和逐功能验收留在各模块001任务。
