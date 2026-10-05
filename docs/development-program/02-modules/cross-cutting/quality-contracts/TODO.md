# 质量、契约与验收门禁：TODO

模块ID：`X-QUALITY` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="x-quality-001"></a>

### X-QUALITY-001 完成 质量、契约与验收门禁 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P1
- 主责模块：X-QUALITY
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

- [TinadecCore/tests/TinadecCore.Architecture.Tests/ArchitectureTests.cs](../../../../../TinadecCore/tests/TinadecCore.Architecture.Tests/ArchitectureTests.cs)

<a id="x-quality-101"></a>

### X-QUALITY-101 建立活动测试与功能验收证据矩阵

- 类型：核查
- 状态：待核查
- 优先级：P1
- 主责模块：X-QUALITY
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

历史全绿、隔离复跑和静态核对不能互相替代；需要按功能与当前版本识别有效验证和空白。

**验收条件**

- [ ] 只列活动测试项目与实际执行命令，旧 Contracts.Tests 标为遗留需求证据。
- [ ] 每模块区分静态、单测、组件、真实端到端、外部模型、平台和后端，记录代码基线、结果及跳过。
- [ ] 发现失败记录原始证据和归因状态，不继承环境抖动标签。
- [ ] 审批schema修复完成后关联 [CORE-HTTP-101](../../core/AspNetCore/TODO.md#core-http-101) 与快照/漂移结果，此处不建立重复实现任务。

**初始证据**

- [TinadecOffice.slnx](../../../../../TinadecOffice.slnx)
- [tests/Tinadec.Contracts.Tests/README.md](../../../../../tests/Tinadec.Contracts.Tests/README.md)
- [.github/workflows/contracts-drift.yml](../../../../../.github/workflows/contracts-drift.yml)
- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)

**历史任务映射**

- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：自动化与协同复验；只作来源，不继承完成勾选
- [docs/whole-product-eval-2026-10-05.zh-CN.md](../../../../whole-product-eval-2026-10-05.zh-CN.md)：尚未覆盖与诚实边界；只作来源，不继承完成勾选

