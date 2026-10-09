# Core API 测试存储隔离

日期：2026-10-09。本轮修改仅针对测试宿主，不删除或迁移真实用户根中的已有测试数据。生产 GraphSeed 配置校验修复和用户界面验证由同轮其他模块承担。

## 原因和修复

`Api/Program.cs` 在创建 builder 后立即读取 `TinadecStorage:Enabled` 和 `TinadecStorage:UserRoot`，并执行受管根初始化。仅在 `ConfigureAppConfiguration` 中给旧测试设置临时 DataRoot，无法保证这个更早的初始化选择临时用户根。真实用户配置中的测试 fixture 与 `Api.Tests/Fixtures/bootstrap-pack.json` 的资源规模一致，但现有证据不能确定具体是哪次历史测试进程写入。

全部具体 `WebApplicationFactory<Program>` 改为继承 `IsolatedApiFactory`。它的 sealed 配置入口先设置环境 `Testing` 和 `TinadecStorage:Enabled=false`，然后调用各 fixture 的配置逻辑，保留原有数据库、DataRoot、服务替身及业务断言。受管作用域测试显式覆盖 `UsesManagedStorage`、`ManagedUserRoot`，使用 `StorageTesting`，并且必须在 Program 启动前提供本测试进程拥有的绝对临时根。空根、真实用户根、其他进程的临时根、相对路径和隔离设置的提前覆盖均被拒绝。

最终配置检查将已验证的 DataRoot、SQLite DatabasePath 和 DefaultWorkspaceRoot 回写为实际解析后的绝对路径，保持同一物理目录的语义；macOS 系统临时目录的 `/var` → `/private/var` 别名因此不会触发后续生产目录链接拒绝。实际 legacy 启动断言同时检查这三个最终路径。检查产生的独立配置快照会释放，`ConfigurationManager` 返回自身时保持宿主配置存活。

`ApiTestStorage` 的程序集 ModuleInitializer 在默认 persistence options 构造之前，为当前进程设置一次独立 `TINADEC_HOME`。每个 factory 不再切换这个环境变量；不同测试进程的 GUID 根和进程环境彼此独立。默认安全存储和其他隐式路径因此也只能落在测试临时根中。测试程序集已有的 xUnit 顺序集合配置继续保留。宿主认证 token 的既有 fixture 生命周期与这个 HOME 兜底无关。

清理只针对初始化时确定的进程临时根。退出时重新检查绝对路径、实际解析结果、临时目录边界和真实用户根排除规则；如果路径被链接替换，则跳过删除。仅当环境变量仍等于本进程拥有的 HOME 时恢复原值。异常退出或尚未释放的文件句柄可能留下临时目录，不会扩大清理目标。

## 验收入口

新增 `ApiHostIsolationTests`，覆盖实际 legacy / managed HTTP 宿主启动、显式 legacy DataRoot 与数据库保持、scope 配置在声明临时根内初始化、managed 缺少根的提前拒绝、真实根覆盖拒绝、默认 options 的安全兜底，以及运行时枚举所有具体 API factory 的共同基类检查。

真实用户配置检查只读取原 `TINADEC_HOME` 及用户 profile 的 `.tinadec/config` 文件字节，比较文件清单和 SHA256。测试和日志不打印配置正文或密钥。启动用例均在释放宿主之后检查前后哈希。

实现文件：

- `TinadecCore/tests/TinadecCore.Api.Tests/ApiTestStorage.cs`
- `TinadecCore/tests/TinadecCore.Api.Tests/IsolatedApiFactory.cs`
- `TinadecCore/tests/TinadecCore.Api.Tests/ApiHostIsolationTests.cs`
- `TinadecCore/tests/TinadecCore.Api.Tests/StorageScopeApiTests.cs`
- `TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs`

主代理统一初轮 API 定向验证已通过：101/101、0 failed、0 skipped，15 分 56 秒；证据为本目录 `core-final.trx`。该次二进制已包含临时工作目录创建、配置快照释放和 7 项隔离测试，并覆盖 GraphSeed、配置文档、受管作用域、AgentPack、MCP 清单、工具设置、模型查询和 OpenAPI 等选定类。实际宿主进程正常退出，其进程临时根随后已清理；本模块没有终止测试进程。

初轮编译早于最后的 canonical 路径回写及平台声明路径断言。主代理已在独立构建目录重新编译最新源码并复跑隔离测试：7/7、0 failed、0 skipped，32 秒，证据 `core-isolation-final.trx`。两轮分别保留，不将旧 101 项读数冒称为最新 helper 下的整组复跑。隔离用例的真实用户配置只读前后哈希断言通过；本轮整体真实用户根九份 TOML 的最终只读对账由主代理另行记录。

静态 factory 扫描不替代真实宿主验证，也不宣称所有历史 API 测试已完整复跑，或本机 Windows 结果等同 macOS 实机验收。
