# 2026-10-09 配置文件权威与会话迁移验证

范围：当前工作树，Windows x64、.NET 10、SQLite 临时数据库。配置和会话迁移定向验证；完整桌面、PostgreSQL、Linux/macOS 整体交付验收分别记录，不由本报告推断。

实现入口：Abstractions 的 `IScopeConfigurationDocuments`、`IConfigurationProjectionCoordinator`、`ISessionStorageAdmissionGuard`；Persistence 的 `Configuration/`；五个配置 DbContext；DmaEA runtime 文件校验与准入摘要冻结；Runtime 的 `SessionScopeTransferService` 和 `HostSessionWorkspaceBinder`。HTTP 配置端口由 Host 映射，迁移 POST 固定 202 收据，GET 查询进度。

配置契约与历史边界详见 [模块文档](../../docs/development-program/02-modules/core/Persistence/CONFIGURATION-FILES.md)。旧 MCP JSON 自动导入已删除，不读旧路径、不做迁移兼容。配置正文嵌入文件用于项目独立物化，保留原相对不可变内容身份。版本历史继续作为 SQL 事实；当前可编辑投影由 TOML 重建，retired 版本不能被新准入默认隐藏引用。

验证源码：`TinadecCore/tests/TinadecCore.Api.Tests/ConfigurationDocumentTests.cs` 与 `SessionScopeTransferTests.cs`。临时定向测试工程位于 `.tinadec_dev/tmp/config-file-tests`，使用独立 artifacts 避免与其他 agent 的 Windows 构建冲突。命令：

```powershell
dotnet test .tinadec_dev\tmp\config-file-tests\ConfigFile.Tests.csproj --artifacts-path .tinadec_dev\tmp\config-file-artifacts --nologo -v:q --logger 'trx;LogFileName=configuration-and-transfer.trx' --results-directory .tinadec_dev\reports\configuration-and-transfer-tests
```

已覆盖：CAS 过期、语法/字段类型/逻辑唯一键失败不改文件、原文/GUI 注释保留、直接文件编辑投影、旧 GUI 上下文 CAS、防空文件误清除、项目 Provider 与 Agent Pack 正文独立重建、准入摘要变更、storage/logging 校验和连接变更阻准入、retired 文件版本与 SQL 历史边界、六模块迁移事实闭包、附件与嵌套冻结内容、共享身份保留、审计仅所选字节复制、已接受队列排空、运行中 pending 与重启恢复、partial module commit 精确重放、create_workspace 当前运行保持 user scope、完成收据与历史归档 purge。

最终定向测试 **19 passed、1 skipped、0 failed**，见 [最终 TRX](configuration-and-transfer-tests/configuration-and-transfer-final.trx)：14 项配置、5 项迁移通过；1 项真实 PostgreSQL 因未显式配置服务而 skip。新增覆盖缺失已建立配置不从 SQL 复活、重启后拒绝、显式替代文件恢复，以及 runtime/storage/logging 三个 Host 引导点不重新写默认文件；copying 错误阶段的 purge 前置检查也已验证。

较早阶段合并测试 16/16 通过，见 [此前 TRX](configuration-and-transfer-tests/configuration-and-transfer.trx)，随后事实闭包与第三 scope 同 session ID 隔离更新后迁移测试 5/5 通过。新增文件缺失测试曾在源码编辑与构建重叠时读到旧异常代码而失败；重建的单项与上述最终完整定向套件均通过，不使用中途失败报告声明完成。

Runtime 已定向编译成功；既有 EF 原始 SQL 和 nullability 警告仍存在。Linux 与实库 PostgreSQL 的实际能力见 [独立记录](2026-10-09-linux-postgresql-validation.zh-CN.md)。本报告不声称 HTTP/Desktop 端到端或全部测试套件通过。

后续审查确认旧活动 TOML 的 null 哨兵没有满足明确原生绑定要求，已补正为 inherit/all/none/selected 及可选值命名 mode。新增三项专项后，最新 Windows 配置 **19/19**、Linux 配置与真实 PostgreSQL **20/20** 均通过且无 skip，详见 [原生绑定差分与最终证据](2026-10-09-native-toml-bindings.zh-CN.md)。这些新证据取代上述旧读数的活动配置形状边界；旧迁移结果继续保留其独立范围。

Runtime 来源选择另完成 [嵌入宿主回归](2026-10-09-runtime-configuration-source.zh-CN.md)：按配置文档端口存在判断托管编辑权威，避免仅 Persistence locations 使旧宿主要求不存在的 runtime 文件；来源测试 **3/3** 与既有 SkillFactory 真实 HTTP **1/1** 均通过且无 skip。托管 scope 缺失仍严格拒绝，不进行默认回退或用户配置初始化。
