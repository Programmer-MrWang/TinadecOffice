# 数据、安全与持久化验收：TODO

模块ID：`X-DATA` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="x-data-001"></a>

### X-DATA-001 完成 数据、安全与持久化验收 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：X-DATA
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

- [TinadecCore/Persistence/TinadecDatabaseConfigurer.cs](../../../../../TinadecCore/Persistence/TinadecDatabaseConfigurer.cs)
- [TinadecCore/Persistence/StoragePaths.cs:24](../../../../../TinadecCore/Persistence/StoragePaths.cs#L24)
- [TinadecCore/Persistence/SecretStoreFactory.cs](../../../../../TinadecCore/Persistence/SecretStoreFactory.cs)

<a id="x-data-101"></a>

### X-DATA-101 形成 SQLite 与 PostgreSQL 同场景持久化验收矩阵

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：X-DATA
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

两种存储配置与迁移已经存在，当前能力完成判断需要按同一场景核对实际运行，而非用配置文件宣布支持闭环。

**验收条件**

- [ ] 从空库与现有库分别验证启动迁移、写入读取和重启恢复。
- [ ] 对会话/run/审批/组织等选定真实场景比较后端结果，并覆盖并发与身份隔离。
- [ ] 每项记录执行/失败/跳过及原因；迁移模块和业务模块各自的详细任务作为关联项，避免复制。

**初始证据**

- [TinadecCore/Persistence/TinadecDatabaseConfigurer.cs](../../../../../TinadecCore/Persistence/TinadecDatabaseConfigurer.cs)
- [TinadecCore/tests/TinadecCore.Api.Tests/PostgreSqlStorageTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/PostgreSqlStorageTests.cs)
- [TinadecCore/tests/TinadecCore.Api.Tests/StorageApiTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/StorageApiTests.cs)
- [.github/workflows/core-storage-postgres.yml](../../../../../.github/workflows/core-storage-postgres.yml)

<a id="x-data-102"></a>

### X-DATA-102 验收内容文件引用一致性与异常后的真实状态

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：X-DATA
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

存储路径和写文件机制有实现，需确认取消、失败和数据库引用不一致时的可检测与恢复行为。

**验收条件**

- [ ] 覆盖并发同内容、取消、写入失败、非法引用和tenant/workspace越界。
- [ ] 检查实际临时文件与最终文件，不以返回值代替副作用事实。
- [ ] 记录数据库引用缺文件与孤儿文件的现状，确认检测/修复所需能力；发现真实缺口后另立实现任务。

**初始证据**

- [TinadecCore/Persistence/LocalFileContentStore.cs](../../../../../TinadecCore/Persistence/LocalFileContentStore.cs)
- [TinadecCore/Persistence/StoragePaths.cs](../../../../../TinadecCore/Persistence/StoragePaths.cs)
- [TinadecCore/tests/TinadecCore.Api.Tests/StorageApiTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/StorageApiTests.cs)

<a id="x-data-103"></a>

### X-DATA-103 验收平台密钥保存、重启读取与损坏行为

- 类型：验收
- 状态：待核查
- 优先级：P1
- 主责模块：X-DATA
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

平台后端已有源码，密钥存储可用性需实际保存读取证据；备份/迁移/轮换范围尚未逐项审计。

**验收条件**

- [ ] 在相应平台验证保存、读取、重启、文件权限、损坏密文与非法reference。
- [ ] environment 模式拒绝保存时错误可理解；不把只读设计误报为后端不可用。
- [ ] 明确密钥迁移与轮换当前能力及产品范围，有已确认缺口再派生任务。

**初始证据**

- [TinadecCore/Persistence/SecretStoreFactory.cs](../../../../../TinadecCore/Persistence/SecretStoreFactory.cs)
- [TinadecCore/Persistence/EncryptedFileSecretStore.cs](../../../../../TinadecCore/Persistence/EncryptedFileSecretStore.cs)
- [TinadecCore/tests/TinadecCore.Governance.Tests/SecretStorePlatformTests.cs](../../../../../TinadecCore/tests/TinadecCore.Governance.Tests/SecretStorePlatformTests.cs)

<a id="x-data-104"></a>

### X-DATA-104 作用域存储、TOML 配置和资源生命周期重构及平台验收

- 类型：实现
- 状态：进行中
- 优先级：P0
- 主责模块：X-DATA
- 前置依赖：用户已确定目录、配置权威、权限和不迁移旧数据的产品契约；关联 X-DATA-101/102/103 的专项验收，不复制其任务
- 关联功能：X-DATA-F004/005/006；CORE-PERSISTENCE-F002/003、CORE-RUNTIME-F004/005、CORE-MEMORY-F004、CORE-LIFECYCLE-F003
- 完成证据：[源码与验收对账](../../../../../.tinadec_dev/reports/2026-10-09-storage-reconstruction.zh-CN.md)、[产品契约 §21](../../../../tinadec-core-product-definition.zh-CN.md)

**问题与目的**

把每次用户动作的配置、资源、事实、日志和缓存落点统一为稳定产品契约。每个 scope 独立服务图与数据库，配置文件是唯一编辑来源；宿主权限不由项目内容自行授权。源码实施与真实运行验收分别记账。

**验收条件**

- [x] 实现统一目录分类、原子初始化、宿主登记、请求固定作用域及独立 Core 服务图。
- [x] 实现 TOML 校验/诊断、摘要条件保存、数据库投影及新运行配置冻结。
- [x] 分离 MCP 登记/安装/连接/凭据，保留 Skill 历史包；取消 `.tinadec` 整体禁止规则。
- [x] 实现日志容量预算、手动清理预览、内容引用 GC、会话关联删除恢复和安全导出。
- [x] 同步 Desktop 存储设置、Gateway/OpenAPI/客户端和正式产品文档、固定提交同类项目对照。
- [x] 记录并复核 Windows 定向最终测试及真实文件/ACL结果，异常用例不得以编译替代；作用域/日志/向量15/15，密钥24/24，资源差分见[验收账本](../../../../../.tinadec_dev/evidence/2026-10-09-storage/VALIDATION.md)。
- [x] 提供 Linux 内核 Tools27/27、配置/迁移/真实PG22/22与增强PG删除预览1/1证据，明确未实际销毁项目；见[平台报告](../../../../../.tinadec_dev/reports/2026-10-09-linux-postgresql-validation.zh-CN.md)。
- [ ] 提供 macOS 实际内核与各平台完整打包验收，以及PG完整业务/销毁/导出恢复；已有定向证据不折算为这些场景完成。
- [ ] 真实运行覆盖并发双项目、切换后的 SSE/审批、移动/复制、只读外部模式及硬退出恢复；据证据逐项关闭剩余问题。

