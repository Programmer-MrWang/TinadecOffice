# AgentConfiguration：TODO

模块ID：`CORE-AGENT-CONFIG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="core-agent-config-001"></a>

### CORE-AGENT-CONFIG-001 完成 AgentConfiguration 的逐功能审计与模块图精化

- 类型：核查
- 状态：进行中
- 优先级：P2
- 主责模块：CORE-AGENT-CONFIG
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：2026-10-09 已完成配置存储 F002–F004 的定向验证及架构流精化；F005 Linux/真实 PostgreSQL 存储契约已验收；F001 包服务全量审计和 macOS 平台验证尚未完成

**问题与目的**

已有职责投影和初始源码事实，还没有把每个用户/调用场景逐项拆分并完成实现、测试和运行证据对账。

**验收条件**

- [ ] 拆分STATUS.md中的聚合能力，每个功能分配稳定feature id、明确输入/输出、失败与权限边界。
- [ ] 逐条定位实际实现、活动测试和历史报告；把源码可见、历史验证与本轮验收分别记录。
- [ ] 至少明确成功、错误/取消、权限和持久化/恢复场景中哪些适用；未适用的写出理由。
- [ ] 精化ARCHITECTURE.md中的调用/数据流；每个有向关系提供源码依据，职责关联不冒充编译依赖。
- [ ] 将确认缺口登记独立TODO，写明目标行为、范围、前置依赖和可执行验收条件；无证据的保持待核查。

**初始证据**

- [TinadecCore/AgentConfiguration/AgentConfigurationModuleRegistrar.cs](../../../../../TinadecCore/AgentConfiguration/AgentConfigurationModuleRegistrar.cs)

<a id="core-agent-config-002"></a>

### CORE-AGENT-CONFIG-002 将 scope TOML 建立为配置编辑唯一权威

- 类型：实现
- 状态：已完成
- 优先级：P1
- 主责模块：CORE-AGENT-CONFIG
- 前置依赖：scope 目录及独立 DI/数据库连接注册
- 关联功能：CORE-AGENT-CONFIG-F002、F003、F004
- 完成证据：[配置文件契约](../Persistence/CONFIGURATION-FILES.md)、[本轮定向报告及 TRX](../../../../../.tinadec_dev/reports/2026-10-09-configuration-files.zh-CN.md)、[原生绑定最终差分：Windows 19/19、Linux/真实 PG 20/20](../../../../../.tinadec_dev/reports/2026-10-09-native-toml-bindings.zh-CN.md)

**验收条件**

- [x] GUI 配置写入口经过 TOML CAS/原子写入；外部文件编辑成为下次投影和编译的来源。
- [x] 校验语法、字段、逻辑唯一键、不可变正文；保留文件注释，错误和旧摘要不改已保存文件。
- [x] 活动原生 TOML 以 inherit/all/none/selected 明确绑定状态，可选值用命名 mode；拒绝 null 哨兵与旧资源数组形状，GUI 投影回读和既有冻结 JSON 不变。
- [x] 区分可重建的当前编辑投影与 SQL 历史运行事实，不允许新 default/current 从隐藏 SQL 版本取值。
- [x] 项目文件嵌入所引用正文，在目标 scope 内容库物化；既有 immutable identity 与 manifest 语义摘要保持不变。
- [x] 新 run 编译 scope 配置并在 freeze 前复核摘要；storage 与实际 backend/ref 不一致必须阻止准入。

此任务的完成范围不包含 Desktop 交互、完整包安装/清理矩阵、Linux/macOS 或实库 PostgreSQL 验收。

<a id="core-agent-config-003"></a>

### CORE-AGENT-CONFIG-003 完成 Linux 与真实 PostgreSQL 配置 scope 验收

- 类型：验收
- 状态：待验收
- 优先级：P1
- 主责模块：CORE-AGENT-CONFIG
- 前置依赖：CORE-AGENT-CONFIG-002
- 关联功能：CORE-AGENT-CONFIG-F005
- 当前证据：[Linux 实测报告与 TRX](../../../../../.tinadec_dev/reports/2026-10-09-linux-postgresql-validation.zh-CN.md)；Fedora 44 WSL2、固定 SDK 10.0.300、隔离 PostgreSQL 18.6，22/22 定向测试通过；原生 TOML 差分另 20/20 通过且无 skip，包含增强 PG 删除预览 Fact。macOS CI 实际运行结果仍待补充

**验收条件**

- [x] 在隔离测试 PostgreSQL 中为两个 scope 建立随机 schema，十二 DbContext 全部建表成功。
- [x] 相同 session/config ID 在不同 schema 的内容独立；文件投影只改变当前 scope；事务 rollback 不改变其他 scope。
- [x] PostgreSQL 删除预览覆盖实际行事实；插入/修改使旧预览拒绝，原事实与另一 schema 保留，未变数据库摘要稳定。用 stub Registry 禁止实际销毁 schema。
- [x] `TINADEC_TEST_POSTGRES` 未显式启用时真实测试显示 skip；启用而服务不可用时测试失败，禁止静默跳过。
- [x] Linux 使用固定 SDK、隔离 artifacts 跑配置与迁移测试，保存命令、平台和 TRX；使用后停止临时数据库。
- [x] 独立记录 bubblewrap 0.13.0 真正执行 probe，不把 SDK/依赖安装当作系统验收。
- [ ] 保存 macOS CI 的实际运行结果，不能以 Linux 结果代表 macOS。

