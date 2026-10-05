# 首页入场逐帧分析（2026-10-05）

本轮针对首页“闪现”，诊断基线为 `22c63b4adffbede22d93e99de046cc997b78c323`。修复代码已分阶段提交：UIE 基础 `49684ef`、Desktop 衔接 `76797fc`；在 `72e6d61` 上整理提交时逐项比对 `final-fingerprint.json`，七个产品源码文件与已验证快照的哈希一致。证据位于 `output/home-entry-qa/`；基线相关源码及 SHA-256 已保存在 `baseline-source/fingerprint.json`。这是一轮真实 Electron 渲染与代码时序验证，后端使用独立无模型 fixture，没有调用真实模型或修改业务数据库。

## 分模块、分阶段交付

| 阶段 | 提交 | 范围 |
| --- | --- | --- |
| UIE 基础 | `49684ef` | 初次布局 ready、首次激活挂载、状态保留行为回归、UIE 模块说明。 |
| Desktop 衔接 | `76797fc` | 首页准备/入场/完成、真实动画收尾、启动屏与通知衔接、回归测试、Desktop 模块说明。 |
| 诊断归档 | 本报告所在提交 | 逐帧证据、验证范围和采集限制，刷新项目与模块知识库的实际代码提交号。 |

各阶段包含对应回归测试；验证读数来自提交前的同内容快照，提交整理没有修改产品逻辑或重复宣称一次新的全量测试。

## 已确认的原因

1. **启动层先离场，首页后挂载。** 原 `App.vue` 同时用 `!isConnecting` 触发 splash 离场和首次挂载主界面。它只等待健康检查，不等待首页懒加载、UIE 内容挂载或布局准备。`baseline-clean-r2/frames.json` 显示 splash 离场类比 `home-entering` 早 873.2 ms；`baseline-native` 为 2037.9 ms。600 ms 的 splash 位移、400 ms 的淡出已经基本结束，首页才进入透明起点。
2. **准备态来得晚。** 原 `HomePage.vue` 先挂载整棵 UIE，`onMounted` 后才将 `homeEntering` 设为 true。首轮尺寸测量与响应式更新发生在同一阶段，异步布局恢复还可能换掉实例。浏览器读到动画存在，不能据此断言用户已看到连续的入场帧。
3. **固定 500 ms 清除类可能截断实际动画。** 原代码从 mounted 开始计时，与 CSS 动画创建及每栏延迟并不是同一个时钟。`baseline-native` 记录左/中栏结束，右栏 `animationcancel`，发生在入场类创建后 530.2 ms。`baseline-clean-r2` 则完整结束：该缺陷依赖实际负载，不能说每次都取消。
4. **原曲线将视觉变化集中在开头。** 350 ms 的 `cubic-bezier(.16,1,.3,1)` 在约 50 ms 时已完成约 63%，100 ms 时约 86%。基线左栏透明度从 0.270 跳到 0.984，中/右栏从 0 跳到 0.951/0.864；这两次实际采样之间隔了约 175 ms。
5. **未打开的卡片也在首轮创建内容。** Home 预设有 11 个实例，只有 3 个活动页；旧 `UieCardHost` 给隐藏页加 `display:none`，仍创建其内容，包括终端、图与其他面板。它们属于可以从首次挂载中移出的工作。CPU 采样同时看到尺寸读取、样式/布局与主线程空隙；证据不足以把全部停顿归因于某一张卡片。

## 关键画面

`baseline-clean-r2` 的 `frame-0029.jpg` 只有背景和顶栏；`frame-0030.jpg` 只有淡淡的左栏，中/右栏尚未显现；随后很快到三栏完整态。对应的数据证明确实经历了空画面和少量过渡帧，不是入场 CSS 没有引入。

`t` 是 rAF 提供的时间戳，`sampleAt` 是实际开始读取的时间。主线程阻塞后，两者可能相差数百毫秒；本报告用 class mutation 的实际时刻对齐入场，用 `sampleAt` 解读状态，不把过期 rAF 时间戳当作真实绘制时刻。截图按 screencast 时间标记排序；这类采样并不包含每次屏幕刷新。

## 本轮修复

- `UieStore.ready` 在已保存布局恢复或失败回退后完成；首页此前不创建默认内容再换一次树。
- `useHomeEntrance` 先建立 `preparing` 状态，挂载并测量 UIE、等待字体、留出两次绘制机会，再发出页面 `ready`。`App.vue` 在这个时刻启动常驻 splash 离场，健康成功/超时只负责允许主界面准备。
- 入场不再用 500 ms 计时器清类。只等待 `home-up-enter` 动画的真实 `finished`，忽略无限 spinner；布局替换造成的取消会重新检查新动画；卸载时取消未执行的 rAF，不再发 ready。
- 保留 350 ms 时长和 0/50/100 ms 错峰，将入场曲线改为 `cubic-bezier(.2,0,0,1)`，保留可见的加速段。准备/进入期间在实际材质节点提示合成，完成后释放。折叠侧栏也参与入场。
- 卡片首次激活才挂载内容，访问后隐藏仍保留组件、局部状态、实例身份和响应式 `uie:active`。
- 启动只发生一次；连接状态变化保留已挂载页面，通知在页面准备完之后显示。

HTML 的 `.splash-placeholder` 与 Vue 的 `AppSplash` 确实是两份实现：前者是 JS 执行前的静态占位，`app.mount('#app')` 会替换它；HTML 没有第二套入场关键帧。Vue splash 离场与 Home 入场之前各自触发、缺乏准备衔接，是本轮有证据的时序问题。

## 验证与边界

UIE **142/142**；Desktop 全量线程复跑 **882 passed / 14 skipped**，退出 0；随后补充未解析路由的行为用例，启动衔接定向 **4/4**。正式 `npm run build -w @tinadec/desktop`（含 vue-tsc）退出 0，收尾独立类型检查也退出 0。入场等待布局/字体、真实完成而非计时、替换动画、减少动态效果、卸载清理、卡片首次激活/状态保留、启动衔接/连接重试均有行为回归。

首轮 forks 全量为 870 passed / 14 skipped，另有 `PersonalSection.test.ts` 的 worker 启动超时（尚未进入该文件测试），命令退出 1。该文件与相关新测试隔离复验 24/24；完整 threads 复跑读数如上。日志保留在 `desktop-regression.log`、`recheck.log` 与 `desktop-regression-threads.log`，没有将第一次非零退出记为通过，也没有改产品逻辑或测试断言来掩盖它。

最终正式构建的渲染复验如下；每行均使用独立 Electron profile，没有复用上一次页面状态。完整原始数据与截图对应同名目录。

| 路径 / 记录 | 可观察结果 |
| --- | --- |
| 冷启动 `final-startup-calm` | 三栏实际动画均结束，零取消、零渲染异常、无错误遮罩。 |
| 设置→返回 `final-return` | 经真实设置/返回按钮往返；首次与返回各三处入场结束，共 6 次，splash 只离场一次。 |
| 慢保存布局 `final-saved-layout` | IPC 读取增加 1200 ms，左栏恢复 310 px、右栏为 44 px 折叠侧栏；首个内容样本仍在 preparing、splash opacity=1；两栈加侧栏共三处动画结束。 |
| 减少动态效果 `final-reduced` | 无 Home 动画，页面仍完成准备与进入；没有等待一个永远不会来的 animationend。 |
| 30 秒健康超时 `final-timeout` | 真实等待超时后首页可用，三处动画结束，零 insertBefore/未处理异常/错误遮罩。 |
| 后端立即就绪 `final-immediate` | 健康在导航前即为成功，仍等待实际首页准备；三处动画结束，没有提前退光 splash。 |

补充对照 `final-software-light` 在 12/142/184/223/258/291/328/379/414 ms 等时间点留下真实合成画面，可见 logo 上移淡出、左栏先升、中栏随后出现、右栏最后落定。`final-startup-light` 使用不读布局/动画状态的轻探针；GPU 离屏采集仍可能漏掉中间帧，因此不能只根据完整动画事件声称“全程流畅”。

可用 [逐帧查看器](../output/home-entry-qa/frame-viewer.html) 拖动、逐张翻页或按原始截图间隔播放；基线和修复后并列可选。`final-fingerprint.json` 保存最终产品源码与实际加载的构建 index 哈希。该查看器和原始记录为本机保留的 QA 产物，不在 Git 追踪范围。

测试使用本任务自己的 Electron、独立 profile、52402 fixture 和 52404 静态服务。普通隐藏窗口与离屏合成器都曾采样；减少采样开销也有对照。机器可用内存曾降至约 600 MB，采集存在长帧和漏采，不能由本轮宣称全硬件恒定 60 FPS，也不应把每个长帧都算作产品缺陷。Electron 的默认离屏 GPU 模式存在 GPU→CPU 图像读回开销；本轮软件输出对照采到了更多中间画面，但这不足以给每个长帧确定原因，也没有据此修改产品的 GPU 设置。[Electron 离屏绘制文档](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)

本轮没有重做全业务端到端或真实模型测试，没有改动模型中心。前轮 `insertBefore` 的规避仍在：Home UIE 保持 classic，根 splash 保持常驻 CSS 状态；此前文档对具体 interop 锚点竞态的描述没有完整堆栈证明，本轮不继承为确定机制。
