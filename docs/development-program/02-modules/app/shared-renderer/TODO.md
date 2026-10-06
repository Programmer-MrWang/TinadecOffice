# 共享渲染层 / 路由与 API：TODO

模块ID：`APP-RENDERER` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="app-renderer-001"></a>

### APP-RENDERER-001 完成 共享渲染层 / 路由与 API 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：APP-RENDERER
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

- [apps/desktop/src/main.ts](../../../../../apps/desktop/src/main.ts)
- [docs/tinadec-core-product-definition.zh-CN.md:97](../../../../tinadec-core-product-definition.zh-CN.md#L97)

<a id="app-renderer-101"></a>

### APP-RENDERER-101 复验 API 包装后的取消错误语义

- 类型：核查
- 状态：待核查
- 优先级：P1
- 主责模块：APP-RENDERER
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

历史 eval 记录 AbortError 被包装成普通连接错误；当前 api.ts 的网络 catch 仍创建新 Error，本轮未实际取消请求复现。

**验收条件**

- [ ] 主动取消与切页中断不出现无法连接后端的错误通知
- [ ] 真实网络失败仍展示准确错误
- [ ] 若复现保留原始取消类别/原因，并在真实请求与组件交互中复验

**初始证据**

- [apps/desktop/src/api.ts](../../../../../apps/desktop/src/api.ts)
- [apps/desktop/src/controllers/HomeController.ts](../../../../../apps/desktop/src/controllers/HomeController.ts)

**历史任务映射**

- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：直接观察与代码解释；只作来源，不继承完成勾选

<a id="app-renderer-103"></a>

### APP-RENDERER-103 完成分类搜索浮窗与沉浸式窗口控制专项

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：APP-RENDERER
- 前置依赖：复用现有窗口级命令面板、Gateway/Core目录与工具搜索接口；本专项无未完成任务依赖
- 关联功能：APP-RENDERER-F002
- 完成证据：2026-10-06 Windows当前工作树，窗口/设置专项82/82；本轮整合Desktop914 passed/14 skipped、native/scripts107/107。最终定向48/48、类型/构建和真实Electron浮窗专项通过；不据此关闭其他模块任务。

**问题与目的**

右上窗口控制曾用独立胶囊背景，搜索入口需先展开窄输入再进入面板；结果范围、类型区分和大量结果管理不足。改为纯图标窗口控制，点击搜索直接进入分类浮窗，扩大真实目录范围并使大量结果可预览、展开与折叠。

**验收条件**

- [x] 主界面与设置窗口控制使用ghost、透明背景、零边框/阴影；保留36×32点击区域、读屏名称、键盘焦点及no-drag，三窗口动作仍发送对应IPC。
- [x] 搜索入口直接打开唯一窗口级原生dialog；默认760×590自适应浮窗，可选全屏，不在顶栏生成第二个输入。
- [x] 全部＋10类筛选以图标区分；每组默认4项、可展开更多/收起及整组折叠，长标题与上下文省略，键盘与鼠标激活同一结果动作。
- [x] 搜索命令、项目、跨项目会话、模型、智能体、模式、提示词片段、Core工具目录、设置与当前工作区内容，按来源独立更新；5秒超时/取消不阻塞其他来源。
- [x] 结果通过一次性请求导航并定位Home项目/会话、Code文件与Settings配置；当前工作区内容上限100匹配行，保留服务端截断提示。
- [x] 明确范围：会话检索标题及项目名，文件内容限定当前工作区；不宣称历史消息全文或全磁盘文件名搜索。

**源码与活动测试**

- [本轮最终报告与Electron证据](../../../../../.tinadec_dev/reports/2026-10-06-search-and-window-chrome.zh-CN.md)
- 标签中键关闭定向验证：[BrowserTabBar.test.ts](../../../../../apps/desktop/src/components/BrowserTabBar.test.ts)（3/3）。
- [CommandPaletteButton.vue](../../../../../apps/desktop/src/components/CommandPaletteButton.vue)、[CommandPalette.vue](../../../../../apps/desktop/src/components/CommandPalette.vue)、[spotlight.ts](../../../../../apps/desktop/src/lib/spotlight.ts)、[pageRequests.ts](../../../../../apps/desktop/src/lib/pageRequests.ts)
- [CommandPaletteButton.test.ts](../../../../../apps/desktop/src/components/CommandPaletteButton.test.ts)、[CommandPalette.test.ts](../../../../../apps/desktop/src/components/CommandPalette.test.ts)、[spotlight.test.ts](../../../../../apps/desktop/src/lib/spotlight.test.ts)、[AppHeader.test.ts](../../../../../apps/desktop/src/components/AppHeader.test.ts)

**关联边界**

APP-RENDERER-001逐功能审计、APP-RENDERER-101取消错误分类与APP-RENDERER-102窄宽度发送可用性仍保持原状态；来源5秒取消专项不等于全局API取消语义已修。

<a id="app-renderer-102"></a>

### APP-RENDERER-102 复验窄宽度布局中的发送主操作

- 类型：核查
- 状态：待核查
- 优先级：P1
- 主责模块：APP-RENDERER
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

历史 eval 在 900/1120 渲染宽度观察到右栏遮挡发送控件；本轮未检查当前布局，先复验再决定修复范围。

**验收条件**

- [ ] 在当前 Web 与 Electron 的 900/1120 及最小支持宽度检查发送/附件/权限菜单可用
- [ ] 打开不同右栏、折叠/拖动/切会话后主操作仍可点击和键盘访问
- [ ] 复现时记录尺寸、布局和截图，修复后沿同一配置验收

**初始证据**

- [apps/desktop/src/pages/HomePage.vue](../../../../../apps/desktop/src/pages/HomePage.vue)
- [apps/TinadecUI/src/components/useUie.ts](../../../../../apps/TinadecUI/src/components/useUie.ts)

**历史任务映射**

- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：直接观察与代码解释；只作来源，不继承完成勾选
