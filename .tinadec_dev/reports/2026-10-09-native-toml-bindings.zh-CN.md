# 2026-10-09 活动 TOML 原生绑定补正

本差分纠正先前配置形状边界：活动文件原先以 `__tinadec_null` 表达 JSON null，虽能保持“缺省继承 / null 全部 / [] 空绑定 / UUID 显式绑定”的 JSON 投影语义，却没有满足原生明确字段要求。旧 Windows 19 项与 Linux 22 项结果不能证明这一新增形状已经实现。

现在活动 `tool_settings.settings.mcp.binding` / `skills.binding` 使用 `mode = "inherit" | "all" | "none" | "selected"`；缺省为 inherit，只有 selected 可以并且必须携带非空、唯一、非零 UUID `ids`。all 主动覆盖共享选择，none 为空集合，selected 精确身份，enabled 门保持独立。活动文件拒绝旧 JSON null 哨兵、旧 resource_ids 字段、非法 mode 或矛盾 ids，失败不改原字节。

可选字段明确为 `read/write.max_file_bytes = { mode = "unlimited" }`、`search.timeout_ms = { mode = "outer_deadline" }`、`search.rg_path = { mode = "host_search" }`；具体值写标量，缺省继承。Agent unlimited 不能移除共享数字上限。其他活动对象的 null 字段省略继承；没有域含义的 null 数组元素拒绝。历史版本冻结 JSON 字符串、内容寻址正文与既有运行事实保持原字节。

公开 GUI/API JSON DTO 保留现有契约，统一 codec 在 TOML 编辑权威与 JSON 投影之间适配；这不是对 DTO null 意义的重新定义，也没有让旧 SQL 成为配置来源。

源码：

- [ConfigurationTomlValues](../../TinadecCore/Persistence/Configuration/ConfigurationTomlValues.cs)：原生编解码与强校验。
- [ConfigurationProjectionCoordinator](../../TinadecCore/Persistence/Configuration/ConfigurationProjectionCoordinator.cs)：当前配置使用 codec，历史 JSON 直存，投影写入错误转字段 diagnostic。
- [ToolSettingsDocumentValidator](../../TinadecCore/Tools/ToolSettingsDocumentValidator.cs)：使用同一 native adapter，保留共享/Agent 限额验证。
- [ConfigurationDocumentTests](../../TinadecCore/tests/TinadecCore.Api.Tests/ConfigurationDocumentTests.cs)：新增三项专项与原有配置回归。

Windows x64 / .NET 10 / 隔离 SQLite：新增专项 **3/3**，最新含投影 diagnostic 包装的全部配置测试 **19/19，0 failed、0 skipped、15 秒**。证据：[最终 TRX](configuration-and-transfer-tests/configuration-native-final-with-diagnostics.trx)、[最终构建/测试日志](configuration-native-final-test.log)、[首次三项专项 TRX](configuration-and-transfer-tests/native-bindings.trx)。GUI 保存后原生 mode 正确；手改四态与缺省后 Compile/回读正确；共享选择、显式 all、none、selected 不混淆；注释 CAS 保留；已冻 JSON 不变；错误 mode/ids/旧形状/投影输入和越过限额均拒绝且不改文件。

```powershell
dotnet test .tinadec_dev/tmp/config-file-tests/ConfigFile.Tests.csproj `
  --artifacts-path .tinadec_dev/tmp/config-file-artifacts `
  --filter 'FullyQualifiedName~ConfigurationDocumentTests' `
  --logger 'trx;LogFileName=configuration-native-final-with-diagnostics.trx' `
  --results-directory .tinadec_dev/reports/configuration-and-transfer-tests
```

最终 Linux / PostgreSQL 差分在 Fedora 44 WSL2 x64、固定 SDK 10.0.300、隔离 PostgreSQL 18.6 上实际执行 **20/20，0 failed、0 skipped、37 秒**：19 项配置与 1 项真实 PG。证据：[最终 Linux TRX](linux-storage-validation/linux-native-configuration-postgresql.trx)、[构建/测试日志](linux-storage-validation/dotnet-native-configuration-postgresql-test.log)。同一 PG Fact 同时验证十二 DbContext 双 schema、当前 TOML 投影、事务 rollback 和删除预览行事实变化门禁。脚本 `.tinadec_dev/tmp/linux-native-configuration-run.sh` 使用独立 artifacts，退出时临时 PG fast stop 成功。未重复 5 项迁移或 27 项 Tools；本差分取代旧 19/22 读数中的活动配置形状边界，不把旧结果算作新 codec 证据。

契约与模块入口：[配置文件契约](../../docs/development-program/02-modules/core/Persistence/CONFIGURATION-FILES.md)、[AgentConfiguration STATUS](../../docs/development-program/02-modules/core/AgentConfiguration/STATUS.md)。
