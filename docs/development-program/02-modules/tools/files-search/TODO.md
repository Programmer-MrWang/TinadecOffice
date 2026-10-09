# TinadecTools / 文件与搜索：TODO

模块ID：`TOOLS-FILES` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="tools-files-102"></a>

### TOOLS-FILES-102 文件和搜索共享存储分类

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：TOOLS-FILES
- 关联功能：TOOLS-FILES-F002
- 范围：config/skills可写，runtime禁止，选中包只读，rg正glob不能开放保护根。
- 验收：实际文件副作用、冻结边界、拒绝与取消清理；平台证据独立。
- 完成证据：[实施报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。2026-10-09 Windows Tools实际文件/ACL与上下文回归通过，平台范围独立。

**验收条件**

- [x] 实际文件写入允许 config/skills，拒绝 runtime 和其它scope，选中包只读。
- [x] 记录冻结context/搜索接线及平台验收范围。

<a id="tools-files-001"></a>

### TOOLS-FILES-001 完成 TinadecTools / 文件与搜索 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：TOOLS-FILES
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

- [TinadecTools/Tools/FileRW/FileSystemTools.cs](../../../../../TinadecTools/Tools/FileRW/FileSystemTools.cs)

<a id="tools-files-101"></a>

### TOOLS-FILES-101 核查文件工具边界与跨平台真实操作矩阵

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：TOOLS-FILES
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

功能入口已存在，需按用户操作核对路径边界、冲突处理与失败后的文件内容。

**验收条件**

- [ ] 中文及空格路径、允许根、符号链接越界、过期 hash、并发编辑和二进制操作逐项有结果与证据。
- [ ] 授权和确认不足的写操作不产生副作用；失败与取消后检查实际文件，不能只看 response.success。
- [ ] 搜索对 pin 版 rg 可用及 rg 缺失分别给出预期结果。

**初始证据**

- [TinadecTools/Tools/FileRW/FileWriter.cs](../../../../../TinadecTools/Tools/FileRW/FileWriter.cs)
- [tests/TinadecTools.Tests/FileWriterTests.cs](../../../../../tests/TinadecTools.Tests/FileWriterTests.cs)
- [tests/TinadecTools.Tests/WorkspacePathBoundaryTests.cs](../../../../../tests/TinadecTools.Tests/WorkspacePathBoundaryTests.cs)
- [tests/TinadecTools.Tests/FileSearchTests.cs](../../../../../tests/TinadecTools.Tests/FileSearchTests.cs)
- [TinadecTools/TinadecTools.csproj](../../../../../TinadecTools/TinadecTools.csproj)

