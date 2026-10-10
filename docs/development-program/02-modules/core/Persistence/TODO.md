# Persistence · 公共存储适配：TODO

模块ID：`CORE-PERSISTENCE` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="core-persistence-001"></a>

### CORE-PERSISTENCE-001 完成 Persistence · 公共存储适配 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：CORE-PERSISTENCE
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

- [TinadecCore/Persistence/ServiceCollectionExtensions.cs](../../../../../TinadecCore/Persistence/ServiceCollectionExtensions.cs)

<a id="core-persistence-101"></a>

### CORE-PERSISTENCE-101 修复配置过滤唯一索引与活动版本来源校验

- 类型：实现
- 状态：已完成
- 优先级：P0
- 主责模块：CORE-PERSISTENCE
- 前置依赖：既有EF配置模型、TOML文档与投影事务；接口诊断和重试由APP-PACKS-102持有
- 关联功能：CORE-PERSISTENCE-F003
- 完成证据：[修复报告](../../../../../.tinadec_dev/reports/2026-10-09-graphseed-install-fix.zh-CN.md)、[后端专项](../../../../../.tinadec_dev/reports/2026-10-09-graphseed-configuration-validation-fix.zh-CN.md)

**问题与目的**

TOML预检忽略EF唯一索引过滤条件，将仅草稿名称唯一扩大到已发布资源，导致已有published meeting时GraphSeedPack发布被误拒。独立数据库重建还暴露当前提示词版本所有者键拼错。校验与数据库约束保持一致，失败保留文件/SQL，历史版本不能隐式成为新运行来源。

**验收条件**

- [x] published同名可共存、draft重名拒绝、普通唯一冲突拒绝、软删除名称可复用。
- [x] 未知过滤表达式明确诊断，主键和历史版本不可变规则保留。
- [x] 校验失败原文件字节不变，SQL无部分安装记录。
- [x] 当前提示词版本可编译，缺失当前版本即使历史仍在也拒绝准入。
- [x] GraphSeedPack3.0.1安装、独立数据库投影重建及旧包/历史引用回归通过，制品版本和摘要未修改；Windows专项不代替三平台/PG验收。

