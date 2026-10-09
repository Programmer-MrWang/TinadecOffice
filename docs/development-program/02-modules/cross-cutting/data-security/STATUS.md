# 数据、安全与持久化验收：功能与完成情况

模块ID：`X-DATA` · 清点日期：2026-10-05 · 基线：b6115e6 + 当前工作树。

**审计阶段：初始源码清点；逐功能审计未完成。** 不报告完成百分比，也不把历史全量绿或源码存在折算为功能完成。

| Feature ID | 功能/能力 | 实现判断 | 本轮验证层级 | 边界与剩余问题 | 证据 |
| --- | --- | --- | --- | --- | --- |
| X-DATA-F001 | SQLite 与 PostgreSQL 领域存储 | 源码可见 | 本轮静态核对；未做功能验收 | 默认 SQLite，可选 Npgsql/pgvector 及各自迁移；领域 DbContext 分区不代表独立数据库；CI PostgreSQL storage 定向配置不能替代全业务整链验收。 | [TinadecCore/Persistence/TinadecDatabaseConfigurer.cs](../../../../../TinadecCore/Persistence/TinadecDatabaseConfigurer.cs)<br>[TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj](../../../../../TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj)<br>[TinadecCore/Storage.Migrations.PostgreSql/TinadecCore.Storage.Migrations.PostgreSql.csproj](../../../../../TinadecCore/Storage.Migrations.PostgreSql/TinadecCore.Storage.Migrations.PostgreSql.csproj)<br>[.github/workflows/core-storage-postgres.yml](../../../../../.github/workflows/core-storage-postgres.yml) |
| X-DATA-F002 | 内容寻址文件与 Core 数据根 | 源码可见 | 本轮静态核对；未做功能验收 | 内容经 SHA256、临时文件、flush 与 move 保存，支持并发同内容去重；引用带tenant/workspace范围且禁止逃逸根；不能推断文件与数据库跨资源事务已闭环。 | [TinadecCore/Persistence/LocalFileContentStore.cs](../../../../../TinadecCore/Persistence/LocalFileContentStore.cs)<br>[TinadecCore/Persistence/StoragePaths.cs](../../../../../TinadecCore/Persistence/StoragePaths.cs) |
| X-DATA-F003 | 平台默认加密密钥存储与受校验引用 | 源码可见 | 本轮静态核对；未做功能验收 | Windows 默认 DPAPI，POSIX 默认 AES-GCM 文件；environment 可选且只读；secret reference 不可目录逃逸。 | [TinadecCore/Persistence/SecretStoreFactory.cs](../../../../../TinadecCore/Persistence/SecretStoreFactory.cs)<br>[TinadecCore/Persistence/EncryptedFileSecretStore.cs](../../../../../TinadecCore/Persistence/EncryptedFileSecretStore.cs)<br>[TinadecCore/tests/TinadecCore.Governance.Tests/SecretStorePlatformTests.cs](../../../../../TinadecCore/tests/TinadecCore.Governance.Tests/SecretStorePlatformTests.cs) |
| X-DATA-F004 | 用户/项目存储隔离与初始化 | 部分实现 | Windows最终作用域/日志/向量15/15；Linux真实PG双schema和十二context | 打开即初始化、外部登记恢复、scope header、移动/副本登记；实际关闭释放数据库/host.lock；真实双模型运行与只读自动回退仍需验收。 | [验收账本](../../../../../.tinadec_dev/evidence/2026-10-09-storage/VALIDATION.md) |
| X-DATA-F005 | TOML 唯一配置源与宿主权限上限 | 部分实现 | 文件/CAS/编译/转移、Linux内核27/27、真实Electron宿主签发边界 | 新运行冻结；全部受管业务API校验宿主私钥/HMAC端点身份，普通Agent子进程不能冒用loopback；密钥仅用户安全库；MCP/harness原生能力和可写开发宿主源码不宣称封闭隔离。 | [配置报告](../../../../../.tinadec_dev/reports/2026-10-09-configuration-files.zh-CN.md)<br>[资源报告](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)<br>[Desktop证据](../../../../../.tinadec_dev/evidence/storage-desktop-validation.md) |
| X-DATA-F006 | 有界日志、清理预览、引用回收和完整永久删除 | 部分实现 | 真实内容/SQLite恢复；真实PG删除预览插入/更新失效 | 读写流租约与活动运行阻止维护；共享授权和内容保留；PG预览摘要读取实际owned schema，尚未实际销毁PG项目；硬退出与完整跨平台/业务验收仍未完成。 | [Runtime 对账](../../../../../.tinadec_dev/reports/2026-10-09-storage-reconstruction.zh-CN.md)<br>[平台报告](../../../../../.tinadec_dev/reports/2026-10-09-linux-postgresql-validation.zh-CN.md) |

## 状态词汇

- 待核查：尚不能判断是否实现或缺失。
- 源码可见：找到实现路径，仍需验证真实行为。
- 部分实现：已确认目标的一部分存在，剩余范围明确。
- 缺口已确认：当前源码或复现证明缺失；目标与验收见TODO。
- 范围边界：当前平台/产品有意不提供的能力，是否扩展另作范围决策。
- 已验收：有与目标范围相符的运行/测试证据和结果，必须注明提交/环境/日期。
- 不适用：写明原因，不算完成也不算缺陷。

## 下一轮逐功能分析

将聚合行拆成可验收功能，保留旧Feature ID或明确替代关系；为每项记录入口、预期行为、实际行为、成功/失败/权限/取消/恢复场景、对应Task ID。历史报告只写“历史验证，本轮未重跑”。

[本模块TODO](TODO.md) · [功能分析模板](../../../05-templates/FEATURE.md)
