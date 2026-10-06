# DEVELOPMENT PROGRAM MEMORY

**Generated:** 2026-10-05
**Last Updated:** 2026-10-06
**Last Updated By:** 分类搜索浮窗/沉浸式窗口控制专项登记，补充共享渲染与Desktop桥运行流
**Last Verified Commit:** 提交3be8368；新增APP-RENDERER-F002/103，整体逐功能审计及原取消/窄宽发送任务仍未完成。Windows窗口/设置专项82/82、Desktop914 passed/14 skipped、native/scripts107/107；最终定向48/48、类型/构建和真实Electron浮窗专项通过。reindex：55模块/98功能/102任务、Core24/24/总图82/82、1823链接/200ID/0错误，重跑哈希一致；原ae97e96图形门禁仅历史证据
**Branch:** main

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
