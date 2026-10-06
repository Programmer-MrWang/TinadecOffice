# 空间模式首批落地

日期：2026-10-06。执行期间共享工作树 HEAD 更新到 `acb3bd3`，相关提交包含本任务改动；本记录还包含该基线上的后续修改。没有由本会话执行提交或推送。

关联主责：[APP-RENDERER-104](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-104)。基础研究：[空间画布核查](../research/2026-10-06-spatial-canvas-foundation.zh-CN.md)。本批交付空间 UI 与现有运行事实的投影，不代表整套空间运行模式全部完成。

## 已实现

- 左侧栏底部的显示模式按钮打开原生 popover，选择平面 `/` 或空间 `/space`。左侧资源栏复用原 UIE NavCard；空间页面复用 UieShell/UieCanvas，隐藏中心聊天流与右栏，底部 Composer 固定在画布变换之外。
- Vue Flow 1.48.2 承担平移、缩放、选择、拖动；官方 NodeResizer 1.5.1 承担尺寸手柄。中键平移，滚轮平移，修饰键滚轮/触控板缩放；提供显式缩放、全局视角、撤销重做按钮。
- UIE `space` 是 version 1 布局中的可选分支。`spaceSync/spaceMove/spaceViewport` 统一经过既有命令总线；空间对象几何与业务 DTO 分离。按 sessionId 保存到现有 `uie-layout.json` 的 `sessionBySessionId`，不会继承另一会话布局；draft 不落盘。负数和小数坐标可恢复，尺寸有界。
- 工作对象初次按 run 分组、主线排布；新对象避开既有矩形，不重排用户已经移动的对象。消息后续被认领时可更新所属组且保留位置。当前分组粒度是 run，未完成每支子队伍的嵌套工作区。
- 显示真实用户消息、Core 会话拓扑中的运行和任务、会议摘要/公开回答、按 run 归属的 `plan.updated` Todo 与工具调用。无任务时显示空状态，已删除最初静态示例中的虚构进度/文件/审批。
- 输入框上方规划、计划、更改、审批四个入口支持悬停和键盘聚焦预览，点击定位画布对象；多计划支持堆叠、切换及列表展开。预览共享业务对象 ID，不创建额外领域对象，不重复执行 Git 查询或审批动作。
- 参考 [Figma Taskboard](https://www.figma.com/design/I3eYb0IDAeiYsad9rOOrkM/Tinadec-app?node-id=8-208)、[Git](https://www.figma.com/design/I3eYb0IDAeiYsad9rOOrkM/Tinadec-app?node-id=17-365)、[Approval](https://www.figma.com/design/I3eYb0IDAeiYsad9rOOrkM/Tinadec-app?node-id=17-230) 的 325px 卡片、16px 圆角、24px 标题、列表与辅助文字层级；颜色适配现有主题 token。
- Git 卡及其预览共享一个读取模型：分支、提交、更改文件来自 Core 工具 API。点击文件读取当前前 500 行，复用 `readFileText` 对 `all_contents[].content.Content` 的真实契约解码。它不是历史编辑版本回放。
- 审批使用既有 ApprovalTab 的紧凑布局，保留命令、参数、风险、委托状态和真实批准/拒绝路径。Composer 沿用既有发送/队列/权限/停止通路；空间中不显示传统模式选择器。
- 修复 redo 未恢复 undo 记录的问题。空间对象撤销保留后来出现的运行对象和当前视口，不把相机移动记入对象编辑历史。

## 证据

- UIE 现有与新增用例覆盖坐标修复、会话隔离、增量排布、重复撤销/重做、运行新增对象保留；Desktop 投影用例覆盖空状态、跨会话迟到数据、任务状态更新时 ID 稳定、并行 run 回答归属。
- 本批桌面全量取得 **917 passed / 14 skipped**；随后补充并行回答归属用例，最终定向与构建结果在收尾更新中记录。既有全量输出有 Node/VueUse 警告与 happy-dom 取消日志，测试退出 0。
- 真实 Electron 开发窗口：[交互检查](../evidence/2026-10-06-spatial-ui/checks.json)、[画布截图](../evidence/2026-10-06-spatial-ui/space-verified.jpg)、[悬停预览](../evidence/2026-10-06-spatial-ui/hover-preview.jpg)。实际验证拖动、双向尺寸增加、undo→redo→undo→redo、中键移动且 Composer 坐标固定、预览对象 ID、定位、磁盘保存、显示模式选择框、往返及刷新恢复；捕获运行异常 0。
- [可重跑脚本](../evidence/2026-10-06-spatial-ui-qa.mjs) 与 [Windows 窗口状态包装](../evidence/2026-10-06-spatial-ui-qa.ps1)。脚本在已有窗口操作布局并在结束后恢复原快照；不会提交模型消息。最小化窗口会影响 CDP 输入/尺寸测量，验证中临时启用焦点模拟并在结束后还原。早期脚本的超时回复处理已加 pending guard。
- 单独启动 Electron 验证实例曾被工具策略拒绝，只返回 `blocked by policy`；最终使用已有 Electron 窗口完成验证。首次加载排查使用 `?splash=0`，因此这些截图不证明正常冷启动健康等待时序。

## 尚未完成的产品范围

1. **开关组合执行**：Plan、Spec、工作流、多智能体、公告板认领、Worktree/PR 的独立组合与下条任务冻结仍需 Core 契约和调度实施。当前发送继续使用会话已有冻结模式，没有将功能开关伪装成生效。
2. **完整工作控件**：工具调用、任务、Git 当前文件已可见；逐智能体编辑文件聚合、历史代码版本、专用搜索/测试画面、浏览器/Figma 连续实时画面、模型头像仍需接入真实来源。
3. **运行历史与规模**：拓扑查询采用有界 runs/tasks，工具活动复用现有会话事件投影；没有验收无限历史、嵌套队伍排布、离屏重控件降载或恒定 60 FPS。UIE 实例池仍不构成跨路由组件保活保证。
4. **业务链验收**：本轮没有发送新的真实模型任务、操作审批或 PR 合并；真实运行完整链路、三平台安装包与 Web 布局持久化尚未验收。平面/空间往返与刷新验证的是布局和 UI。

任务和验收状态只维护在上述模块 TODO/STATUS；这里保存本批实现解释与证据。

## 收尾验证

- UIE最终147/147；Desktop全量917 passed/14 skipped后，最终相关定向62/62；layoutStore7/7。
- 类型与正式Vite构建通过；保留已有VueUse注释、UIE循环chunk/大chunk提示，不将编译成功视为跨平台验收。
- 文档reindex：55模块、101功能、103任务、1836链接、204ID、0错误；Core24/24、总图82/82。
- 最后加入的手势保护让新运行事实等待拖动/尺寸手势结束再更新节点几何，卡片内部状态仍可更新；Electron交互/刷新脚本复跑通过。
