# 平面/空间会话隔离与单行发送框

源码基线：`acb3bd3` + 共享工作树续改。对应 [APP-RENDERER-104](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-104)，涉及 Core Memory、Gateway session-control 和 UIE NavCard。

## 行为

- Core 创建会话时保存 `view_mode: flat | space`；可空数据库列兼容历史记录，旧记录对外返回 flat。更新会话契约没有此字段，不会把现有会话转换到另一类。独立会话继续使用不同 session ID，消息与上下文沿原有会话边界存取。
- Gateway 映射保留类型，外部 Session schema 和 Desktop 生成类型同步更新。空间创建要求服务明确返回 space；旧服务缺少支持时报告错误，不把返回的平面会话选入空间。
- HomeController 保留全会话目录供全局查找，侧栏只读取 `visibleSessions`。切换平面/空间分别恢复选择，清理草稿和旧订阅；不复用另一类型的空白会话。发送和创建在第一次 await 前捕获类型、会话、项目、权限、模式和附件，迟到结果不会激活另一界面或写入它的消息/运行列表。
- 全局搜索选中空间会话时转到 `/space`；路由离场期间不在平面壳中展示空间内容。
- 用户纠正后：平面模式恢复原有外观、工具栏、停止/发送布局及框内排队管理。两种视图均以消息是否为空决定居中/下沉，已有空会话也不提前下沉；首次消息使用同一输入框节点执行350ms FLIP。空间下沉后单独采用单行加号/输入/发送或停止；首次发送接 handleWelcomeSend。
- 已有会话后续发送采用该会话的 mode_version_id，不接受旧选择器传入的新值；Core 原有执行模式编辑接口仍按其既有契约运行，本批改变的是会话类型与客户端选择行为。

## 验证

- Core：StorageApiTests + CoreOpenApiSnapshotTests **14/14**。新增用例覆盖创建类型、不同会话历史、类型更新不可转换、非法类型、数据库持久值与旧 null 值兼容。
- Gateway：**78/78**，包括真实 app.handle 请求的创建字段转发、返回映射与列表分类。
- Desktop：全量 **924 passed / 14 skipped**；最后补回归后相关定向 **70/70**，覆盖不复用空会话、异步创建跨模式切换、已绑定模式发送、创建失败保留草稿、搜索跳转、单行与单操作按钮。类型/正式构建通过。
- Core/OpenAPI 与 Gateway/OpenAPI 快照的变化只有新增 view_mode；首次漂移触发后复核并重跑通过，Desktop `schema.d.ts` 已重生成。
- 以下为纠正前的历史验证，平面单行截图不再代表目标或当前实现。真实 Electron：单行输入结构、模式切换列表筛选、运行异常 0；见 [检查结果](../evidence/2026-10-06-session-view-ui/checks.json)、[平面截图](../evidence/2026-10-06-session-view-ui/flat-single-row.jpg)、[空间截图](../evidence/2026-10-06-session-view-ui/space-single-row.jpg)。脚本：[CDP](../evidence/2026-10-06-session-view-ui-qa.mjs)、[窗口状态包装](../evidence/2026-10-06-session-view-ui-qa.ps1)。窗口中的既有加载失败通知未被隐藏。

Core 测试使用 `--artifacts-path tmp/session-view-build` 隔离构建，未替换运行服务。原生窗口当前只有旧平面会话；新类型创建的服务链在 Core HTTP 测试和 Gateway HTTP 测试分别验证，未对运行中的用户服务创建测试会话。使用新空间会话需同步更新 Core/Gateway。未跑 PostgreSQL、Core 全量或模型回合；空间的组合执行开关与实时工作画面仍属 APP-RENDERER-104 后续范围。

## 发送框外观与动效纠正

类型检查与生产构建通过。组件定向39/39通过（包括已有空会话仍居中、平面工具栏/双按钮、空间单行）。真实Electron临时内存消息夹具验证两种视图保持同一节点并执行350ms下沉，平面保留工具栏、空间下沉后隐藏；夹具最终恢复，没有发送模型请求。证据：[检查结果](../evidence/2026-10-06-composer-dock-ui/checks.json)、[脚本](../evidence/2026-10-06-composer-dock-ui-qa.mjs)。

用户追加纠正：新空间不生成空会议/计划/Git/审批卡，快捷入口只在有对应对象时出现。投影按运行/任务/计划、实际工具活动与Git信息、当前会话审批请求逐步产生。定向45/45通过；类型检查结果见本轮执行。
