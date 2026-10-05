## TL;DR

- 这一轮不能判定整条链路通过：六个隔离用户场景中四个因实际 Gateway 进程崩溃而未能交付，浏览器、测试代理和 Core 仍在（case-b/c/d/f；各实例 gateway.stderr.log）。
- 前端有可复现的主操作阻塞：900 和 1120 宽度下右侧浮动面板盖住发送按钮，打开普通文本文件又触发整个界面的错误遮罩，后者在真实 Electron 中同样复现（QA operate-056/059；native-qa/code-view-crash.png）。
- 两个成功场景保住了现有价值，但也暴露绕路：反馈摘要靠粘贴代替附件，指定评审角色要从 Team 切到 Review 才真正被派发（case-a step 3/7；case-e step 10–13）。
- 模型渠道的两个真实逻辑问题已交回负责智能体并通过独立自动化复验：取消后子进程残留、ACP 完成回执与 idle watchdog 竞争；最终 AgentFramework 626/626，但这不代表真实外部 CLI 账号回合已验证（6d4af02；agentframework-after-acp-fix.log）。
- 自动化套件最终均跑过，动画流畅性仍没有通过证据：三次录制都报编码器积压，保存了性能记录与失败原件，不能用配置的 60fps 冒充实际帧率（motion-and-worker-diagnostics.json）。

## 版本、范围与真实入口

正式用户场景和主体自动化固定在提交 **2aae779cd9bbb71a77eceb0aa2e9c14a8100d139**，从短路径 detached worktree 构建；不会混入模型中心施工中的半成品。模型渠道复验另外记录 **cf7e2b6** 与 **6d4af02c6e5e0f57b2f0dcb3228266be0f3845ef**，补丁见 `versions/peer-channel-fixes.patch`。

文中相对证据路径均以 `C:/Users/lincu/.mirasim/eval/sessions/261005-0231-tinadec-office-full` 为根；独立产品实例已经停止，本地查看页仍可复核轨迹、截图与报告。

六个用户分别使用独立浏览器、Core、Gateway、SQLite、文件目录和无历史账户。入口是实际 web 客户端，它复用 Desktop 渲染层，后面接真实 Gateway、Core、TinadecTools 和 AMD/DeepSeek-V4-Flash。供应商配置由产品 API 写入，模型应答没有替身。子代理只收到自己的材料、人物、任务、入口和记录合同；隔离是目录/账号/进程隔离加提示白名单，宿主不能硬性限制其所有文件读取，因此也审计了工具轨迹。

原生桌面另由主代理启动一份自己的 Electron 43.3.0，独立 userData，加载真实 main/preload/构建 renderer；没有替换 IPC 桥。窗口隐藏用于观察，禁用后台节流以让过渡正常推进。它是专项 QA，不冒充六位用户都操作了原生桌面。所有记录只在本地，不上传。

最初跨施工快照、过长 worktree 路径、Vite 依赖 junction 的允许路径与配置文件模块格式问题，均在用户派发前或工程准备中发现；保留了原件，不把这些准备失败计为产品缺陷。桌面测试使用外置 Vite 配置，仅允许只读依赖真实路径，最终从正确的 desktop 工作目录运行。

## 实际用户路径

| 用户与用途 | 真实落点 | 摩擦与证据 |
|---|---|---|
| 林洁：产品试用反馈摘要 | succeeded，分类数量正确，离开设置后能找回原文和结果 | 上传不可用，粘贴 CSV 才完成；因此附件成功条件没有完成。持续显示假的后端连接错误。`case-a` step 2–7，operate-008/016/037 |
| 陈南：订单金额错误修复与人工审批 | abandoned，没有交付修复或测试结果 | Gateway 崩溃；Core 诊断仍停在工具授权等待。不能声称审批 UI 已被完整走通。`case-b` step 5–6，operate-015 |
| 何铭：自主检查服务并写交接报告 | abandoned，没有可见 handoff.md | 发送前已选完全访问；追加 production 限制失败，草稿清空且留下消息气泡，是否送达不明确。Core 后续为监督待审，这不等同于工具权限没放行。`case-c` step 2–4，operate-014/017 |
| 周悦：分开讨论、保留草稿与归档 | abandoned，第二个讨论创建失败 | 自定标题在首次发送后被正文改写；Gateway 崩溃后无法继续。Core 的首个任务后来完成，不等于用户看到了结果。`case-d` step 6–7，operate-024/028 |
| 乔言：输出偏好、角色模型来源与只读审查 | succeeded，4096 保存后重新打开仍在，Review 中实际 reviewer#1 完成审查 | Team 首次选择 search，用户核对后切 Review；可见工具仅 read_file/stat。成功覆盖这些设置，不扩展为所有参数和所有供应商均通过。`case-e` step 4/6/10–13，operate-017/026/057/062 |
| 刘琪：键盘、窄窗口、客户答复 | abandoned，没有得到可复制答复 | 外观切换、搜索返回和草稿保留走通；用 Enter 发送，主动折叠右栏腾出阅读空间，随后 Gateway 崩溃。`case-f` step 6–9，operate-039/043、observe-error |

六份 trace 合计 **209 条浏览器命令、100 次实际 UI 操作**，每个操作截图都存在，动作、退出状态与 trace 引用已逐项核对；主代理另检查了关键真实像素和输出。工具成功点击但产品随后报错的操作仍保留 `ok=true`，产品失败写在观察里。b/c/d/f 起初把代理连接失败归为装置 error，查明产品 Gateway 已崩溃后只核正归因为 abandoned，原始动作和观察没有改写。

## 直接观察与代码解释

**Gateway 进程崩溃（高优先级，已观察，根因未闭合）。** b/c/d/f 的真实 Bun v1.3.14 Gateway 都留下 `panic(main thread): Internal assertion failure`，相同 crash signature。相应浏览器和网页代理仍活着，Core 仍推进：b 等工具授权、c 等监督裁决、d 最终 completed。薄测试代理显示 `eval_proxy_unavailable / ECONNREFUSED` 是产品进程消失后的结果。流完成/中止生命周期值得继续缩小，但尚未证明具体触发函数，也未证明原生发布版和其他 Bun/平台会同样崩溃。源码 `proxySse` 返回真实 upstream Response；现有 mock 测试不覆盖这次操作系统级崩溃。

**浮动右栏遮住发送（高优先级，已观察）。** 在 900×640 和 1120×720 渲染视口，真实 hit-test 报发送按钮被 `.panel-home-card` 盖住，截图里箭头和部分工具选择被右栏遮挡。折叠右栏后同一条输入可以发送。1120 对应桌面声明的最小宽度附近；它是渲染视口复验，不是原生窗口管理器缩放测试。证据：`case-qa/operate-056.png`、`operate-059.png`、`operate-060.png`、`first-send-after-collapse.png`。

**代码文件打开导致界面错误（高优先级，已观察且有构建证据）。** 创建自己的 33 字节 qa-note.txt，正常打开 CodePage 并选文件，web 与 Electron 都显示“应用界面出现错误 / UI crashed / [object Event]”；错误遮罩挡住 Edit。console 先提示 worker 无法创建。构建产物 `monaco.config-IGvRAbqT.js` 把通用 worker 内联为 data URI，其正文仍有 `../common/initialize.js`、`./editor.worker.start.js` 的相对 import。源码用先生成 URL、再从变量构造 Worker 的形式，没有让 Vite 把 worker 依赖作为完整入口构建。需要修 worker 构建以及局部失败边界；尚未完成修复后实操。证据：`native-qa/code-view-crash.png`、`case-qa/code-view-crash.png`、`motion-and-worker-diagnostics.json`。

**取消请求被当成断网（中优先级，已观察，代码解释明确）。** healthy 后端下仍出现 `Cannot connect to backend: signal is aborted without reason`。`api.ts:2518` 将 fetch 的 AbortError 包成普通 Error；HomeController 的 abort 守卫于是认不出来。通知始终占着主界面，真实任务却能完成。证据：case-a operate-016；原生启动也看到相同“加载失败”。

**第一份材料不能直接附上（中优先级，已观察）。** welcome 状态的附件按钮置灰，原生 Electron 也如此，并非仅 web shim 不支持。`ComposerBar.vue:306` 的 canAttach 只看 sessionId；用户尚未发送就没有可上传的会话。用户任务要求先交 CSV，结果要自己想到粘贴或另建空会话。`case-a/operate-008.png`、`native-qa/operate-006.png`。

**自定标题覆盖与角色作用范围（中优先级，已观察）。** d 已命名的讨论首次发送后被整段请求替换，削弱多讨论辨认；e 的模型覆盖保存成功，但 Team 的执行名册与 Review 不同，配置角色不代表该角色会被实际选为执行者。应在提交前让作用范围可以判断，不只在完成后靠编排追认。

## 模型中心之外的只读逻辑审查

完整源码调用链与复验条件在 `analysis/logic-review.md`，指纹在 `analysis/source-fingerprints.json`。以下是静态确认的控制流问题；除 R1 的失败输入现象外，本轮未把它们都动态复现，不写成已经验证过的跨会话事故或攻击。

| 项 | 代码断点与后果 | 优先级 |
|---|---|---|
| R1 | 校验/POST 前清空 draft，失败不恢复；乐观气泡可能还在 | 高；c 的补充发送失败有相符现场 |
| R2 | 排队晋升先 await cancel，再读全局 selectedSessionId，A 的内容可能 POST 到 B | 高 |
| R3 | cancel 成功、重新 POST 失败不原子，UI 卡还像排队，Core directive 已取消 | 高 |
| R4 | ReassignInteraction 只记事件并报成功，没有驱动执行迁移；真正排队 ID 还会 404 | 高 |
| R5 | CancelInteraction 的 queued fallback 未按 tenant/workspace 过滤读取与更新，且无全局 EF 过滤器 | 高；未做跨租户动态演练 |
| R6 | 会话切换清空 queue cards，REST/重放不重建，durable 队列还会执行 | 中 |
| R7 | 在途回执 attachRun 读取当前选择，把旧运行 UI/错误挂到新会话 | 中；后端原 POST 仍属 A |
| R8 | 资源搜索带来的路径被 CommandPalette 忽略，只导航代码页 | 中 |
| R9 | CodeController 切项目不清旧 session/patch，审批归属可能错位 | 中；不据此断言文件写错项目 |
| R10 | ack 的瘦对象强转 RunDto，控制后刷新可构造 `/sessions//runs` | 中 |
| R11 | CodeViewer emit(path, content)，页面 `$event` 却把 path 当正文；initialContent 路径又没有首次读取 hash | 高；保存保护仍会拒绝无 hash 覆盖，不能删守卫来修 |

代码页还有显示项目 GUID、英文按钮与中文界面混用的呈现问题（原生 CodePage 截图），应与上下文归属一起处理。

## 自动化与协同复验

| 检查 | 本轮结果与版本 | 原始记录 |
|---|---|---|
| Core API 全量 | **689/689**，2aae779，19m29s | final-api-full.log、trx/api/full-api.trx |
| Governance | **88/88**，2aae779 | final-governance.log |
| Architecture | **18/18**，2aae779 | final-architecture.log |
| AgentFramework | 基线 625/626，取消后目录残留；cf7e2b6 取消转绿但 ACP 空 diff 完成竞争红；6d4af02 独立全量 **626/626** | final-agentframework.log、agentframework-after-peer-fix.log、agentframework-after-acp-fix.log |
| TinadecTools | 首次 **353/354**，WebFetch timeout 用例错误地返回 Success；隔离 **1/1**，释放准备资源后全量 **354/354**，原因尚未定性 | final-tools.log、final-webfetch-isolated.log、tools-reduced-load.log |
| Desktop Vitest | 正确 cwd 下完整 **870 passed / 14 skipped** | final-desktop-correct-cwd-full.log |
| Desktop native/scripts | **107/107** | final-native-test.log |
| TinadecUIE | **140/140** | final-uie-test.log |
| Gateway | **76/76** | final-gateway-test.log |
| 构建与类型 | .NET solution、Gateway、web、desktop 构建与 vue-tsc 通过 | final-*-build.log、final-desktop-typecheck.log |
| Desktop client drift | 通过 | final-drift.log |
| TinaChat/organization contract check | 两个原检查都失败；诊断确认只有 CRLF/LF 差异，JSON 完全相等，是 Windows 原始字节比较守卫的问题 | final-*-contract.log、contract-diagnostics.json |

没有只拿同行回执当自己的实测。模型中心两项红测已带日志交回会话 `codex:58f77fbe-8947-4de3-93f5-c97980c27210`：`c0489b3/cf7e2b6` 处理取消时的父子进程与读任务收尾；`f4b4f0f/6d4af02` 在 ACP prompt 完成回执后推进 progress，防止 drain 窗口被旧 idle 时钟抢先判死。最后的 626/626 由本会话独立跑出。没有据此声称真实外部 harness 账号的所有渠道已走通。

WebFetch 的首次失败没有被“隔离复跑绿”抹掉。它依赖 CancelAfter 与延迟响应的调度，负载下可能存在取消与成功分类竞争；具体机理仍需取时序证据，不能仅归为环境噪声。

## 一镜到底、排版与动画

有成立的部分：a 的材料和结果离开后可找回，f 的草稿经外观/搜索返回保留，ComposerBar 的节点在主代理首次发送前后仍是同一个，源码有 350ms 的 WAAPI FLIP 和 reduced-motion 守卫；900×640 的抽查无整页横向溢出。减少运动偏好在真实浏览器里设为 reduce 并核实匹配。

仍不成立的部分：右栏盖住主操作，取消请求持续报错，失败发送的草稿/投递身份不明确，静态发现队列/会话归属断点。保持同一个输入节点不能抵消这些上下文断裂；现有三栏是否整体应该重构，尚无对跑证据。

三次标准 agent-browser 录制（60、60、30fps）均因 encoder backlog 失败，部分 webm 不能当成功录像。保留了 49,425 个事件的 Chrome trace，8294 个 RunTask 中 4 个超过 50ms，最长约 502ms；并行负载与录制开销存在，无法归因成产品动画掉帧。Composer 观测只证明节点身份，第二次观测启动曾因变量重复声明失败，因此不把那些 frame 样本当完整下沉动画。**没有给“动画流畅”或“全链一镜到底”通过章。**

可参考 [VS Code 的工作区与界面状态恢复](https://code.visualstudio.com/docs/editing/getting-started/userinterface) 和 [Cursor 的权限运行模式](https://cursor.com/docs/agent/security/run-modes)。这里的设计推断是：先让当前对象、草稿、执行归属和主操作在切换中稳定，再做材质和动画细化；不是照搬另一个软件的面板数量或审批规则。worker 修复还应对照 [Monaco 官方 ESM 集成说明](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md)，验证真实构建入口，不能只用 mock 组件证明可打开。

## 产品新需求

- **需求**：执行真实任务的用户需要在事件流结束、暂停、审批驻留及页面切换时保持服务可用，并能继续取回正在运行的结果。
  **证据**：b/c/d/f 均因实际 Gateway 崩溃离开；d 的 Core 虽完成，界面无法读取。
  **不满足的后果**：用户无法完成任务，重连按钮也恢复不了消失的服务。
  **优先级**：高，四种用途共同阻断关键链路。
- **需求**：在最小支持宽度附近工作的用户需要随时能点击发送、选择审批方式和读取答复，展开辅助区不能盖住主操作。
  **证据**：QA 900/1120 的 hit-test 和截图；f 主动收起右栏。
  **不满足的后果**：必须发现折叠或键盘替代，普通鼠标发送被阻断。
  **优先级**：高，直接挡住开始任务。
- **需求**：需要查看/编辑代码的人应能打开普通本地文件，编辑看到原文，并在审批保存时保留首次读取的冲突保护。
  **证据**：web/原生 worker 错误遮罩；R11 的正文与 hash 接线。
  **不满足的后果**：无法编辑，或修守卫的方法反而造成覆盖风险。
  **优先级**：高，代码主工作流。
- **需求**：在连接失败、队列迁移及跨会话操作时，用户需要知道哪份内容被接收、仍在等待还是需要重试，并保留可恢复原文和明确归属。
  **证据**：c 补充发送失败仍留气泡；R1–R3、R6–R7、R10。
  **不满足的后果**：丢输入、重复提交、操作错会话或无法控制仍在执行的队列。
  **优先级**：高，涉及内容正确性与执行归属。
- **需求**：第一次带文件进来的用户需要在发送文字前交出材料，或看到能理解的准备动作与原因。
  **证据**：a 用粘贴绕过置灰上传；原生 welcome 同样置灰。
  **不满足的后果**：大文件无法绕路，任务入口与用户手上材料不匹配。
  **优先级**：中，首次体验关键摩擦。
- **需求**：保存模型来源和角色偏好的团队用户需要在提交前确认当前模式会派谁、设置影响哪些新运行，保留自己命名的讨论身份。
  **证据**：e 要切 Review 才使用 reviewer；d 的自定标题被替换。
  **不满足的后果**：保存成功仍用错职责，或难以区分多条讨论。
  **优先级**：中，实际任务完成但额外返工。
- **需求**：用户需要只在真正的数据获取失败时看到错误，正常取消与切换不能留下持续的后端故障通知。
  **证据**：a/e 任务成功仍持续“加载失败”；request 的 AbortError 包装。
  **不满足的后果**：错误打断使用，真实故障与正常状态无法区分。
  **优先级**：中，多视角共现。

本轮按用户后续限制做正式验证、只读审查和模型模块协同，没有擅自改其他产品代码，也没有把新布局方案直接替换上线。下一轮实现应先处理服务、发送可达性、文件打开和投递归属；剩余视觉细化才有可信的使用基础。

## 尚未覆盖与诚实边界

这是一轮广度验证，**没有达到整产品通过或持续迭代收敛**。真人不是这些本地子代理；未演练 PostgreSQL、macOS/Linux 真实桌面、所有外部 CLI/ACP/TUI 供应商账号、打包安装/更新、真实跨租户调用、完整队列迁移竞态及全部辅助页写流程。市场与 Debug Studio 做了真实页面呈现/读取抽查，不声称目录安装或所有调试操作闭环。库和构建/原生脚本的自动化覆盖不能代替上述真实业务链路。

最初录制、native 隐藏窗口后台节流、stale ref 及外置测试 cwd 的故障均作为装置问题单独留存。核心四个失败用户场景没有被重置后抹掉，没有让子代理读源码代办。会话中的私密 provider recipe 不进入 manifest/bundle；完整公共 trace、操作日志、截图、源码审查指纹、版本补丁、测试 TRX 和反馈均保留。

本地查看页：<http://127.0.0.1:4970/eval/run/261005-0231-tinadec-office-full>。
