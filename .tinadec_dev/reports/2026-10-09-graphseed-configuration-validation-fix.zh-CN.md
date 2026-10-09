# 2026-10-09 GraphSeed 3.0.1 配置校验修复

## 结论与边界

基线 `d5e6c8d8` 中，配置文件校验将 EF 的带条件唯一索引当作全量唯一索引，导致已有另一个包的 published `meeting` Agent 时，GraphSeed 安装在最终 TOML 保存阶段被拒绝。修复按模型的 `status = 'draft'`、`deleted_at IS NULL` 条件筛选参与唯一性检查的行；无条件唯一索引仍严格校验，未知条件返回 `configuration_unique_filter_unsupported` 明确诊断。

完整安装回归进一步发现当前提示词版本的编辑源检查使用错误所有者键 `pipeline_id`，实际字段为 `prompt_pipeline_id`。修正后，安装与配置编译成功；删除当前版本的编辑源仍被拒绝，SQL 历史版本保留为 retired，不能被新准入隐式复活。

本报告只覆盖后端 Persistence/AgentPackService 公共服务链和 Windows/SQLite 临时作用域。未执行完整 HTTP/Desktop、Linux、PostgreSQL 或全量测试验收；测试隔离、防重复提示及 UI/Gateway 诊断由其他负责人单独记录。没有修改真实用户目录、历史 JSON 冻结事实、GraphSeed manifest 或既有根配置。没有提交、推送或更新快照。

关联模块任务：[CORE-AGENT-CONFIG-001](../../docs/development-program/02-modules/core/AgentConfiguration/TODO.md#core-agent-config-001) 的包服务审计，以及 [CORE-AGENT-CONFIG-002](../../docs/development-program/02-modules/core/AgentConfiguration/TODO.md#core-agent-config-002) 的 TOML 权威保存校验边界。

## 失败证据与调用链

用户 Core 日志中的四次异常均位于 Apply 的最终保存，不是 Preview：

`AgentPackService.ApplyCoreAsync:781` → `ConfigurationProjectionDbContext.SaveChangesAsync:25` → `ConfigurationProjectionCoordinator.PersistChangesAsync:176` → `ScopeConfigurationDocuments.SaveIfMatchAsync:53`。

`AgentConfigurationDbContext:67` 的 `(TenantId, WorkspaceId, Slug)` 唯一索引只约束 `status = 'draft'`，普通 `(TenantId, WorkspaceId, SourceKind, SourceKey)` 唯一索引没有条件。旧 TOML validator 忽略 `GetFilter()`，把两个合法 published Agent 的相同 slug 判为 `configuration_unique`。SQLite 原始 EF 模型在同样记录上实际保存成功，验证器与投影数据库的契约因此不一致。

同类 Skills 索引 `IntegrationDbContext:32` 只约束 `deleted_at IS NULL`，软删除名称也需要按模型条件处理。当前所有配置模型已声明的带条件索引均属于上述两个条件；无法识别的新增条件会在文件提交前明确失败，不能绕过或被当成无条件索引。

活动配置原生 bindings 的 `inherit/all/none/selected` 编码未触发本次异常，用户文件中旧 null 哨兵为零。本次没有改变 bindings 编解码或公开 DTO。

调查还确认用户根已有 `tinadec.tests.bootstrap-pack / tinadec.tests / 0.1.0 / revision 1` 的测试包记录，创建和最后修改时间为 2026-10-09 14:16:05，14 个已发布 Agent、7 个模式。该情况说明此前测试隔离未守住用户根；目前不能仅凭这些记录断定具体写入测试。此次只读取其 TOML 并在临时目录复现，保留原数据。隔离措施及原数据的后续处理由总报告说明。

## 修改文件

- [ConfigurationProjectionDocumentValidator.cs](../../TinadecCore/Persistence/Configuration/ConfigurationProjectionDocumentValidator.cs:42)：读取唯一索引条件，按行应用 draft/live 判定；不识别的条件返回明确诊断。
- [ConfigurationLiveSourceValidation.cs](../../TinadecCore/Persistence/Configuration/ConfigurationLiveSourceValidation.cs:37)：提示词版本所有者键改为 `prompt_pipeline_id`。
- [GraphSeedPackConfigurationTests.cs](../../TinadecCore/tests/TinadecCore.Api.Tests/GraphSeedPackConfigurationTests.cs:17)：七项公有保存/安装/编译回归，全部创建随机临时 scope 和 SQLite 数据库，不创建 WebApplicationFactory，不执行用户 Host 引导。

## 回归结果

初轮带条件索引修复后是 **5 passed / 1 failed / 0 skipped**。完整 GraphSeed 已安装，但 Compile 因提示词版本所有者键错误失败。该失败未被作为完成证据，日志和 TRX 保留为 [初轮日志](../evidence/2026-10-09-graphseed-fix/backend-config-before-prompt-owner-fix.log)、[初轮 TRX](../evidence/2026-10-09-graphseed-fix/graphseed-config-before-prompt-owner-fix.trx)。

修正提示词键并增加缺失版本保护回归后，最终 **7 passed / 0 failed / 0 skipped**，耗时 15 秒，见 [最终日志](../evidence/2026-10-09-graphseed-fix/backend-config-tests.log)、[最终 TRX](../evidence/2026-10-09-graphseed-fix/graphseed-config-fix.trx)。

| 回归场景 | 实际结果 |
| --- | --- |
| 两个已发布 Agent 同 slug、不同 source identity | 保存成功，TOML 校验通过，空 SQL 投影重建保留两个原 ID |
| 两个 draft Agent 同 slug | 提交前拒绝；原 TOML 字节、hash 和 SQL 数量不变 |
| 普通无条件 source identity 重复 | 即使两个 Agent 都已发布，仍拒绝；原文件与 SQL 不变 |
| 已软删除 Skill 和 live Skill 同名 | 允许；第三个 live Skill 同名拒绝，重建保留原删除事实 |
| 未知带条件唯一索引 | `configuration_unique_filter_unsupported`，原文件正文/hash 不变 |
| 正确 prompt_pipeline_id 当前版本与缺失版本 | 正确版本 Compile 成功；删除 editing source 后拒绝，历史 SQL 行仍保留且 retired |
| Bootstrap 包 + GraphSeed 3.0.1 完整 Preview/Apply/Compile/重建 | installed；两包 meeting 共存；旧 Agent/模式/提示词/安装/版本行逐条不变；清空 SQL 和内存内容后仅凭 TOML 重建并再次 Compile，版本和包摘要一致，Preview 为 up_to_date |

最终测试使用独立轻量工程链接上述测试文件并编译生产依赖，未跑整个 Api.Tests 程序集，命令如下：

```powershell
dotnet test .tinadec_dev/tmp/config-file-tests/ConfigFile.Tests.csproj --artifacts-path .tinadec_dev/tmp/config-file-artifacts --filter 'FullyQualifiedName~GraphSeedPackConfigurationTests' --logger 'trx;LogFileName=graphseed-config-fix.trx' --results-directory .tinadec_dev/evidence/2026-10-09-graphseed-fix --nologo -v:minimal /m:1 /nr:false
```

轻量测试程序集：`.tinadec_dev/tmp/config-file-artifacts/bin/ConfigFile.Tests/debug/TinadecCore.Api.Tests.dll`。生产 DLL：`.tinadec_dev/tmp/config-file-artifacts/bin/TinadecCore.Persistence/debug/TinadecCore.Persistence.dll`。

## 真实用户形状的独立临时副本验证

使用更新后的生产 Persistence DLL，对真实 `agents.toml` 的完整临时副本运行公有 Preview/Apply，再执行配置 Compile。probe 没有启动 WAF/用户 factory、没有连接真实用户数据库，内容存储与 SQLite 均独立；所有保存仅在随机临时根。

结果见 [临时副本 probe](../evidence/2026-10-09-graphseed-fix/user-config-copy-probe.log)：原文件 Validate `[]`；额外 published meeting Validate `[]`，SQLite 实际存入两条；额外 draft meeting 仍为 `configuration_unique`；用户形状与空配置均 `Preview=install → Apply=installed → Compile=success`，安装版本 `3.0.1`、manifest envelope digest 一致。用户形状中 published meeting 最终两条。

源文件 147286 字节，读取前后 SHA-256 同为 `01CE2EB13A10856F02CAE063E7D343FB1FBD6C2CAED4DE2151F7BC6ED60176BA`。真实用户目录没有被修改。

GraphSeed manifest 文件版本仍为 `3.0.1`，源文件 SHA-256 为 `E84BD6F3F5F7CFFD97B5C430D6565AF79BC6AA4DA69A9D4A97E6DB2CF86635BB`；完整回归同时校验安装 envelope digest 不变、重建后 digest 不变、源 manifest 原字节不变。测试没有输出凭据值。
