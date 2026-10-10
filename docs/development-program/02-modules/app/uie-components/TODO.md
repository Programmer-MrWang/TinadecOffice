# TinadecUI / UIE Components：TODO

模块ID：`APP-UIE-COMPONENTS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-uie-components-001"></a>

### APP-UIE-COMPONENTS-001 完成 TinadecUI / UIE Components 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-UIE-COMPONENTS
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

- [apps/TinadecUI/src/index.ts:6](../../../../../apps/TinadecUI/src/index.ts#L6)

<a id="app-uie-components-101"></a>

### APP-UIE-COMPONENTS-101 明确窗格合并与面板收起动作

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：APP-UIE-COMPONENTS
- 前置依赖：既有mergeDockColumn/mergeDockPane/collapseColumn布局命令；reka-ui@2.11.0；共享渲染层的tooltip样式与英中文案已接入，不新增Core或Gateway依赖
- 关联功能：APP-UIE-COMPONENTS-F003
- 完成证据：[主报告](../../../../../.tinadec_dev/reports/2026-10-09-ui-comments.zh-CN.md)、[动作与固定参考](../../../../../.tinadec_dev/evidence/2026-10-09-ui-comments/pane-actions.md)；当前仅已通过部分门禁，真实页面交互仍待验收

**问题与目的**

BrowserTabBar与UieStack原双左箭头分别执行全部窗格合并和当前窗格合回，缺少明显区分；旁边的收起按钮又执行独立的隐藏整列动作。用户需要在操作前理解影响范围，键盘用户也需要明确按钮名称与可见提示。

**目标与触及范围**

只调整两SFC按钮图标、aria、原生button和官方Tooltip组合，配合已有英中文案与共享材质。全列合并使用PanelsTopLeft，单窗格合回使用Combine，收起保留PanelRightClose；合并保留卡片，收起保留分窗布局。布局引擎、Core数据、快照版本与运行事实均不新增契约。

**验收条件**

- [x] 三按钮有互不混同的动作图标、英中文案、aria-label和28×28实际点击区域；真实页面已核对。
- [x] 原生type=button保留键盘激活，装饰SVG不进入辅助名称；reka-ui@2.11.0通过as-child保持单按钮DOM，Portal避免stack裁剪。
- [x] 既有BrowserTabBar组件3/3、UIE dock/commandBus24/24、类型检查通过；保留首次缺依赖失败证据，不用新镜像测试替代行为验收。
- [x] 真实页面键盘focus显示Tooltip、Escape关闭、鼠标hover显示且Portal不被overflow裁剪；中文实际提示与英文资源核对。
- [x] 真实页面Enter执行当前窗格合回、Space全部合并，卡片全部保留；收起后展开恢复两窗格布局。
- [x] 主报告记录1169×719 Windows浏览器运行、3/3组件、24/24命令、类型与独立Vite构建；模块001整体审计保持独立。

<a id="app-uie-components-102"></a>

### APP-UIE-COMPONENTS-102 首页 Git 工作状态组件

- 类型：实现
- 状态：已完成
- 优先级：P2
- 主责模块：APP-UIE-COMPONENTS
- 前置依赖：既有 `git` UIE singleton、受管宿主业务准入与 Core Git facade；不引入新 Gateway/Core API
- 关联功能：APP-UIE-COMPONENTS-F004；APP-HOME-107 工作区上下文只作复用
- 完成证据：[实施报告](../../../../../.tinadec_dev/reports/2026-10-11-home-git-widget.zh-CN.md)、[未提交改动复审与边界更正](../../../../../.tinadec_dev/reports/2026-10-11-uncommitted-review-fixes.zh-CN.md)

**验收条件**

- [x] 首页原 Git 静态入口换成独立全宽信息卡，顶栏“+”菜单仍保留 Git，底部入口实际激活原 Git 页签；现有分支/审批/写操作不搬入卡片。
- [x] 只读状态覆盖主目录身份、变更四类、最多三行路径、最近一次提交与本机上游引用；无项目、无仓库、断连/预览、失败、迟到跨项目结果有明确状态，不把未知显示为干净。
- [x] 可见/焦点/宿主准入的单飞限时刷新，历史失败不污染状态；Git 背景读禁止可选索引锁写。定向 Desktop、UIE、Tools 测试与真实 Electron 当前开发态有证据。
复审补充：未诞生 HEAD 返回成功空历史；仓库内 Git status 执行失败不冒充无仓库；原有无项目/断连/过期状态边界保持。`UiSelectField` 原生模态复审归设置共用组件，不扩大本任务范围。
范围边界：亮色/透明材质、260/340px 实际右栏和平台安装包仍待专项验收（1120×720 CSS 窗已实测），不属于本任务 Windows 开发态完成口径。
