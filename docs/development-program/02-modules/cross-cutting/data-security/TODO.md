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

