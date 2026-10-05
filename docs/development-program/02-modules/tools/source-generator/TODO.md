# TinadecTools.Generators / 构建期生成器：TODO

模块ID：`TOOLS-GENERATOR` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="tools-generator-001"></a>

### TOOLS-GENERATOR-001 完成 TinadecTools.Generators / 构建期生成器 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：TOOLS-GENERATOR
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

- [TinadecTools.Generators/ToolFunctionGenerator.cs:9](../../../../../TinadecTools.Generators/ToolFunctionGenerator.cs#L9)

<a id="tools-generator-101"></a>

### TOOLS-GENERATOR-101 盘点并验收生成器的编译输入与 manifest 语义

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：TOOLS-GENERATOR
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

生成器及 manifest 守卫已存在，需确定复杂参数与诊断的真实覆盖，不能因未找到独立测试项目就宣称无测试。

**验收条件**

- [ ] 列出现有测试覆盖与缺少的有意义边界：嵌套参数、JsonPropertyName、描述、确认字段与错误签名。
- [ ] 必要时用编译夹具验证生成输出和诊断，manifest 可被真实宿主读取。
- [ ] 明确 TTG001 当前告警策略；是否提升严重性作为范围决策，不能默认修改。

**初始证据**

- [TinadecTools.Generators/ToolFunctionGenerator.cs](../../../../../TinadecTools.Generators/ToolFunctionGenerator.cs)
- [tests/TinadecTools.Tests/ToolManifestTests.cs](../../../../../tests/TinadecTools.Tests/ToolManifestTests.cs)
- [TinadecTools/TinadecTools.csproj](../../../../../TinadecTools/TinadecTools.csproj)

