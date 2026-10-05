# 三平台交付、Manager 与更新：TODO

模块ID：`X-DELIVERY` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="x-delivery-001"></a>

### X-DELIVERY-001 完成 三平台交付、Manager 与更新 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：X-DELIVERY
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

- [.github/workflows/desktop-release.yml:69](../../../../../.github/workflows/desktop-release.yml#L69)
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)
- [apps/desktop/scripts/runtimeTargets.mjs:8](../../../../../apps/desktop/scripts/runtimeTargets.mjs#L8)

<a id="x-delivery-101"></a>

### X-DELIVERY-101 按真实三平台制品收集安装、启动和退出验收

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：X-DELIVERY
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

三平台CI及历史发布证据存在，当前工程需要绑定实际run和制品，区分包结构、服务冒烟与完整用户体验。

**验收条件**

- [ ] 逐平台记录打包、安装、健康、Tools目录、退出端口/进程释放和可行的卸载结果。
- [ ] catalog资产URL、size/sha、归档格式、机器码、POSIX执行位和模块与内置runtime一致性均有对应证据。
- [ ] Linux安装版与mac挂dmg步骤逐项核对，终端交互由 [APP-DESKTOP-101](../../app/desktop-shell/TODO.md#app-desktop-101) 持有。
- [ ] macOS普通用户Gatekeeper/quarantine首启单列实机体验，不用runner能跑代替。

**初始证据**

- [.github/workflows/desktop-release.yml](../../../../../.github/workflows/desktop-release.yml)
- [apps/desktop/scripts/verify-office-channel.mjs](../../../../../apps/desktop/scripts/verify-office-channel.mjs)
- [apps/desktop/scripts/smoke-packaged-posix.mjs](../../../../../apps/desktop/scripts/smoke-packaged-posix.mjs)
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)

**历史任务映射**

- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)：CI 门禁；只作来源，不继承完成勾选
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)：发布记录与残余边界（2026-10-04）；只作来源，不继承完成勾选

<a id="x-delivery-102"></a>

### X-DELIVERY-102 定义应用整包更新与 Manager 模块更新的职责和交互

- 类型：方案
- 状态：待方案
- 优先级：P2
- 主责模块：X-DELIVERY
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

应用内updater未接入，Manager模块交接又有独立生命周期，需要先确定谁发现、校验、安装与回退，避免两套所有者同时改runtime。

**验收条件**

- [ ] 明确整包、模块与AgentPack更新的所有者、版本来源、用户入口和互斥规则。
- [ ] 列出发现新版、下载中断、校验失败、安装失败、旧版保留、数据兼容与回退的预期行为。
- [ ] 区分SHA256完整性和发布者身份，明确签名/公证适用范围。
- [ ] 方案形成可拆分的后续实现与真实升级验收任务。

**初始证据**

- [apps/desktop/package.json](../../../../../apps/desktop/package.json)
- [apps/desktop/electron/serviceManager.cjs](../../../../../apps/desktop/electron/serviceManager.cjs)
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)

**历史任务映射**

- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)：Manager 与 Office 的交接；只作来源，不继承完成勾选
- [docs/tinadec-office-release-contract.zh-CN.md](../../../../tinadec-office-release-contract.zh-CN.md)：发布记录与残余边界（2026-10-04）；只作来源，不继承完成勾选

<a id="x-delivery-103"></a>

### X-DELIVERY-103 验收三平台搜索、Git与原生依赖制品

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：X-DELIVERY
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

本任务持有搜索、Git与native依赖的制品/环境验收；真实窗口终端、PTY输入/resize/退出由 [APP-DESKTOP-101](../../app/desktop-shell/TODO.md#app-desktop-101) 持有，避免重复任务。

**验收条件**

- [ ] 各支持平台验证pin版rg可执行、版本正确，原生PTY依赖有正确平台机器码/打包路径；实际交互结果引用APP-DESKTOP-101。
- [ ] Windows随包Git和POSIX系统Git分别记录可用及缺失体验，pin版rg可运行。
- [ ] 搜索和Git依赖缺失时的诊断行为有证据；Wayland、菜单/托盘、字体的交互验收引用APP-DESKTOP-101，不在此重复结算。

**初始证据**

- [apps/desktop/electron/terminalManager.cjs](../../../../../apps/desktop/electron/terminalManager.cjs)
- [apps/desktop/electron/terminalManager.test.cjs](../../../../../apps/desktop/electron/terminalManager.test.cjs)
- [apps/desktop/scripts/runtimeTargets.mjs](../../../../../apps/desktop/scripts/runtimeTargets.mjs)
- [apps/desktop/scripts/smoke-packaged-posix.mjs](../../../../../apps/desktop/scripts/smoke-packaged-posix.mjs)

**历史任务映射**

- [apps/desktop/AGENTS.md](../../../../../apps/desktop/AGENTS.md)：POSIX MAIN-PROCESS PORTABILITY（2026-10-03，Phase 4；Phase 5 打包与 Phase 6 冒烟已于 2026-10-04 三腿读数收口）；只作来源，不继承完成勾选

