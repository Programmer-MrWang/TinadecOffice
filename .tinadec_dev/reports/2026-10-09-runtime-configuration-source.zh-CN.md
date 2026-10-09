# 2026-10-09 Runtime 配置来源回归

本差分修复嵌入宿主启动回归：Persistence 无论是否启用托管配置，都可以提供 `IScopeStorageLocations`。旧 Testing 宿主未显式配置 Enabled=false 时，单凭 locations 存在把它判断成托管作用域，会在启动时要求一个从未初始化的 `config/runtime.toml` 并报 FileNotFound。不能通过启用新的 scope 或改写旧 fixture 来隐藏这一行为差异。

现在 `AgentRuntimeConfigurationStore` 按 `IScopeConfigurationDocuments` 是否注册选择来源。配置编辑权威存在时，严格读取 `IScopeStorageLocations.Config/runtime.toml`，显式 Profile、打包默认、Enabled=false 都不能绕过缺失文件。编辑权威不存在时，保持显式 `TinadecAgent:ProfileConfigPath` → 随包 `Configuration/default-agent-runtime.toml` 的来源顺序。构造过程不建立 scope 目录、不写用户配置、不发现旧路径或迁移旧文件。文档端口只依赖 locations 和文档 validators，Runtime validator 使用静态解析，不反向依赖 runtime store，未引入 DI 循环。

源码与定向测试：

- [Runtime 来源选择](../../TinadecCore/DmaEA/AgentRuntimeConfiguration.cs)。
- [AgentRuntimeConfigurationSourceTests](../../TinadecCore/tests/TinadecCore.Api.Tests/AgentRuntimeConfigurationSourceTests.cs)：未设置 Enabled 和显式 false 的嵌入宿主；显式 Profile 优先；托管缺失不能回退，显式恢复后读取本 scope。
- [既有 WorkspaceSkillApiTests](../../TinadecCore/tests/TinadecCore.Api.Tests/WorkspaceSkillApiTests.cs)：复用未改动的 SkillFactory，保留 Testing、Enabled=false、独立 DataRoot/DatabasePath 和既有嵌入项目/会话路由语义。

2026-10-09，Windows x64 / .NET 10、隔离临时数据：来源选择 **3/3 passed，0 failed、0 skipped，157 ms**，见 [TRX](configuration-and-transfer-tests/runtime-source-selection.trx)、[构建/测试日志](runtime-source-selection-test.log)。旧 `WorkspaceSkillApiTests.SkillsAreAdvertisedByNameAndDescriptionAndNothingElse` 实际 HTTP **1/1 passed，0 failed、0 skipped，8 秒**，见 [TRX](configuration-and-transfer-tests/legacy-workspace-skill-runtime-source.trx)、[日志](legacy-workspace-skill-runtime-source-test.log)。后者真实创建项目、会话并通过 Context provider 读取独立工作区的 `.tinadec/skills` 索引，确认启动和旧 API 路由可用；没有用空宿主或 mock 替代实际请求。

```powershell
dotnet test .tinadec_dev/tmp/config-file-tests/ConfigFile.Tests.csproj `
  --artifacts-path .tinadec_dev/tmp/config-file-artifacts `
  --filter 'FullyQualifiedName~AgentRuntimeConfigurationSourceTests' `
  --logger 'trx;LogFileName=runtime-source-selection.trx' `
  --results-directory .tinadec_dev/reports/configuration-and-transfer-tests

dotnet test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj `
  --artifacts-path .tinadec_dev/tmp/storage-debug-build --no-build --no-restore `
  --filter 'FullyQualifiedName~WorkspaceSkillApiTests.SkillsAreAdvertisedByNameAndDescriptionAndNothingElse' `
  --logger 'trx;LogFileName=legacy-workspace-skill-runtime-source.trx' `
  --results-directory .tinadec_dev/reports/configuration-and-transfer-tests
```

第二条命令复用同轮 peer 已重新编译的最新 API 产物，包含本差分。该专项不宣称旧 WorkspaceSkills/Market/Tools API 全套已经在最终源码重跑，也不替代独立的 [原生绑定 Linux/真实 PG 差分](2026-10-09-native-toml-bindings.zh-CN.md)。托管缺失文件保护仍由当前专项及 ConfigurationDocumentTests 覆盖。

Peer 另保留旧 Testing 宿主的 `CoreOpenApiSnapshotTests.ScopelessTestingHost_UsesPackagedRuntimeAndPublishesOpenApi`：旧 DataRoot/DatabasePath、未显式 Enabled，确认 locations 存在而配置文档端口缺省，并实际读取 OpenAPI；同轮还执行托管 snapshot、公开 Host challenge、关闭等待/取消恢复，合计 **4/4，0 skipped**，见 [该组 TRX](../evidence/storage-core-openapi-host/storage-core-openapi-host.trx)、[构建/测试日志](../evidence/storage-core-openapi-host.log)。这组独立证据不计入上述 3+1，也不代表 Core HTTP 全套验收。
