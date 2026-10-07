# Home / 会话、对话与投递：TODO

模块ID：`APP-HOME` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-home-104"></a>

### APP-HOME-104 统一输入框命令面板与会话运行设置

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：APP-HOME
- 前置依赖：复用Core会话/运行契约与Gateway；空间组合关联APP-RENDERER-104
- 关联功能：APP-HOME-F005
- 完成证据：[实施记录](../../../../../.tinadec_dev/reports/2026-10-08-command-panel.zh-CN.md)

**目标与边界**

平面预设与空间自定义编排共用输入框上方命令面板；+与/同入口，附件顶部，真实目录与模型/权限/模式选择。所有空间使用一套新契约，无旧运行方式兼容分支。配置保存在Core，发送与队列捕获其选择，已运行任务保持冻结。

**验收条件**

- [x] 共享面板、搜索/子页/键盘/IME/草稿和附件，以及真实目录选择的组件回归通过。
- [x] Core配置原子保存、版本冲突、恢复默认、平面/空间边界、SQLite结构与队列解析通过。
- [x] 控制器会话隔离、设置并发、首发命名修订、队列跨会话归属与全局入口回归通过。
- [x] 实际Panel组件三宽度、360×600视口、明暗/模糊材质和键盘Electron夹具通过。
- [x] 最终运行组合14项脚本API、审批全文、Desktop1024/14 skipped、native107、Gateway80及类型/构建通过；外部模型/平台边界见实施报告。

<a id="app-home-103"></a>

### APP-HOME-103 修复 Markdown 显示并应用岛屿卡片视觉

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：APP-HOME
- 前置依赖：无；复用现有 MarkdownRender、DOMPurify 与 UiIslandCard
- 关联功能：APP-HOME-F004
- 完成证据：[修复报告与验证](../../../../../.tinadec_dev/reports/2026-10-07-markdown-islands.zh-CN.md)；Desktop979/14 skipped、native/scripts107、类型/构建与三宽度本地Electron SFC夹具通过，非真实模型/完整App E2E

**问题与目标**

已复现列表标记缺失、任务复选框尺寸异常、表格对齐失效、宽表格及长URL撑宽消息区。恢复正确显示，并让代码、表格、引用使用现有岛屿卡片，正文连续、对话列透明；历史与流式共用渲染和消毒，不增加扩展语法依赖。

**验收条件**

- [x] 列表保留嵌套及有序起始编号，任务checkbox为小尺寸只读显示。
- [x] 表格对齐正确，表格/代码独立横滚，320/520/800px正文和长URL不撑宽消息区。
- [x] 使用UiIslandCard及既有材质token，亮/暗主题可读，无嵌套材质根。
- [x] 引用链接、嵌套HTML、图片与不完整围栏保留；完整文档继续经过DOMPurify。
- [x] 后续流式文字更新不重建已完成代码/表格块，表格可键盘聚焦。
- [x] 组件回归、类型/构建与本地Electron视觉证据通过；真实模型/平台验收边界明确。

<a id="app-home-105"></a>

### APP-HOME-105 对话流 Markdown 扩展语法与卡片细节

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：APP-HOME
- 前置依赖：无；复用现有 MarkdownRender、UiIslandCard 与主题 token；新增 highlight.js、katex、marked-katex-extension、marked-footnote、mermaid
- 关联功能：APP-HOME-F004
- 完成证据：[扩展语法报告](../../../../../.tinadec_dev/reports/2026-10-08-markdown-extended-syntax.zh-CN.md)；Electron 夹具 passed（真实剪贴板、MathML、Mermaid、三宽度）、定向 23 项、Desktop 全量 1028 passed/14 skipped、类型检查通过；生产 vite build 本轮未取得证据

**问题与目标**

上一轮把正文分块为内容岛屿，但代码无高亮与复制、表格卡片细节不足，公式/脚注/提示块/标题锚点/Mermaid 均未接通。用户要求视觉观感优先且不为此拆分多层：全部逻辑收在 `MarkdownRender.vue`，样式集中在 `styles.css`，仅图表新增一个异步子组件。

**验收条件**

- [x] 代码岛有语言标签与悬停/聚焦显现的复制按钮，复制真实写入系统剪贴板，失败在按钮上回报。
- [x] 高亮按需注册语言并记忆化，流式重解析不重复计算；未知语言静默退化为纯文本。
- [x] 行内与块级公式渲染，display 公式自带横向滚动；MathML 分支与内联 style 在消毒后保留。
- [x] 脚注渲染且脚注区标题、返回引用读屏文案本地化。
- [x] `> [!NOTE/TIP/IMPORTANT/WARNING/CAUTION]` 渲染为分类型提示块（支持自定义标题），普通引用不受影响。
- [x] 标题得到 md- 前缀去重 id 与锚点；点击在组件内滚动并标记落点，不改写 URL hash。
- [x] Mermaid 懒加载、跟随主题重绘，解析失败回退显示源码；超长图表不交给 mermaid。
- [x] 表格容器满宽、表头加深、行 hover、末行去边；三宽度下正文视口无横向溢出，表格/代码/公式在卡片内滚动。
- [x] 流式更新不重建已完成代码块 DOM 与表格滚动容器（含焦点）；亮暗主题与强调色跟随。

**边界**

外链打开（`will-navigate`/`openExternal`）按用户本轮决定不做；Mermaid 未 Worker 化，性能未压测；生产构建证据缺失见报告第 4 节。

<a id="app-home-001"></a>

### APP-HOME-001 完成 Home / 会话、对话与投递 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-HOME
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

已有职责投影和初始源码事实，还没有把每个用户/调用场景逐项拆分并完成实现、测试和运行证据对账。

**验收条件**

- [ ] 拆分STATUS.md中的聚合能力，每个功能分配稳定feature id、明确输入/输出、失败与权限边界。
- [ ] 逐条定位实际实现、活动测试和历史报告；把源码可见、历史验证与本轮验收分别记录。
- [ ] 至少明确成功、错误/取消、权限和持久化/恢复场景中哪些适用；未适用的写出理由。
- [ ] 精化ARCHITECTURE.md中的调用/数据流；每个有向关系提供源码依据，职责关联不冒充编译依赖。
- [ ] 将确认缺口登记独立TODO，写明目标行为、范围、前置依赖和可执行验收条件；无证据的保持待核查。

**初始证据**

- [apps/desktop/src/controllers/HomeController.ts:22](../../../../../apps/desktop/src/controllers/HomeController.ts#L22)

<a id="app-home-101"></a>

### APP-HOME-101 验收真实消息投递、并行活动与监督决策

- 类型：验收
- 状态：未开始
- 优先级：P1
- 主责模块：APP-HOME
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

源码与组件证据不能替代真实模型下 queued/parallel/insert、审批和监督的产品闭环。

**验收条件**

- [ ] queued 晋升后保留发送时模式、模型、权限及附件
- [ ] 两个 run 同时活动时显示归属正确；切会话迟到事件不覆盖当前会话
- [ ] insert 中断在途请求后读取纠正文本；首轮可查看审批事实并裁决
- [ ] 监督 continue/correct/cancel 均到达对应 Core 状态并清理已回答入口

**初始证据**

- [apps/desktop/src/controllers/HomeController.ts](../../../../../apps/desktop/src/controllers/HomeController.ts)
- [apps/desktop/src/components/chat/LiveTurnBlock.vue](../../../../../apps/desktop/src/components/chat/LiveTurnBlock.vue)

**历史任务映射**

- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：模型中心之外的只读逻辑审查；只作来源，不继承完成勾选

<a id="app-home-102"></a>

### APP-HOME-102 复验首次会话欢迎页附件可用性

- 类型：核查
- 状态：待核查
- 优先级：P1
- 主责模块：APP-HOME
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

历史正式 eval 观察到 welcome 附件置灰；本轮未复现，不能直接声明当前缺陷仍存在。

**验收条件**

- [ ] 在新会话首次发送前确认附件入口的可用条件
- [ ] 记录上传、发送与失败反馈；若复现则保存当前版本及实际错误证据再进入修复

**初始证据**

- [apps/desktop/src/components/WelcomeScreen.vue](../../../../../apps/desktop/src/components/WelcomeScreen.vue)
- [apps/desktop/src/controllers/HomeController.ts](../../../../../apps/desktop/src/controllers/HomeController.ts)

**历史任务映射**

- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：直接观察与代码解释；只作来源，不继承完成勾选
