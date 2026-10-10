# Core 工作区接口回归证据（2026-10-10）

唯一任务：[APP-HOME-107](../../../docs/development-program/02-modules/app/home/TODO.md#app-home-107)。统一报告：[接口回归](../../reports/2026-10-10-interface-regression.zh-CN.md)。基线 `a8374926d2746d10e20b5caf28bf373095fb910b` 加本轮工作树。

## 环境与边界

- Windows 本机，.NET SDK 10.0.303、测试运行时 10.0.11。
- API 工厂沿用 `IsolatedApiFactory`、`ApiTestStorage` 和独立临时 UserRoot；自宿主 HTTP 测试只组合 HTTP 层，不启动产品存储。
- 编译输出位于 `.tinadec_dev/tmp/workspace-api-audit` 与 `.tinadec_dev/tmp/workspace-api-trace`，避开用户正在运行的 Core DLL。不杀用户服务，不修改或清理用户 `.tinadec`。
- 未进行本轮 Linux/macOS/PostgreSQL、真实模型、完整 Desktop/安装器验收。
- 下列结果是 tool 返回的实际执行摘要；未附造出的 TRX 或完整控制台日志。

## 实际结果

| 组 | 结果 | 验证内容 |
| --- | --- | --- |
| 前置 API 基线 | 3/3 通过，4m04s | 并发打开幂等、多目录 preview/create、坏登记无需挂载可注销 |
| 初次隔离回归 | 13 例中12通过、1失败，14m16s | 坏登记列表隔离、损坏数据库分类、归档/回收站close及重启历史读取、独立存储切换、坏登记注销、自宿主HTTP诊断 |
| trace 修复后 HTTP 定向 | 8/8 通过，测试执行5s | 原 trace、分类和诊断保留，5xx cause 在 journal、响应不泄漏 driver/SQL；无HTTP注册的组合宿主仍能返回自身错误 |
| 冲突与损坏目录补强 | 1/1 通过，单例1m08s，总1.2865m | 文件冲突和损坏TOML不覆盖原字节；损坏文件保留configuration_invalid/code/category/actions/trace；缺目录preview保留storage_scope_unavailable与environment_unavailable |

初次唯一失败是 `AnExplicitProblemClassificationAndTraceAreNotOverwritten`：预期 `origin-trace`，实际为当前请求trace。ASP.NET Core默认writer在Customize之前覆盖trace；修复增加仅处理已带trace的writer，最终8例定向全部通过。其余5个隔离API用例未因该writer修复变更行为，不重跑全组。按用例去重，本轮16个Core场景各有通过证据；不把重跑8例重复计入总数。

## 执行命令

所有命令先清理继承的 `Version`、`Ice-Version` 环境选项，不调整用户目录或产品状态。

```powershell
Remove-Item Env:Version -ErrorAction SilentlyContinue
Remove-Item Env:Ice-Version -ErrorAction SilentlyContinue
dotnet.exe test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --filter "FullyQualifiedName~ScopeListingIsolatesMissingCorruptAndUnauthorizedWorkspacesAndKeepsDatabaseFailuresDistinct|FullyQualifiedName~HistoricalWorkspaceMountPreservesLifecycleAndSessionsAcrossCloseAndRestart|FullyQualifiedName~ServerFailureJournalTests|FullyQualifiedName~ChangingStorageRoot_CreatesIndependentData_AndRetainsOldStoreAndProjectIdentity|FullyQualifiedName~UnavailableRegisteredWorkspace_CanBeUnregisteredWithoutMounting" --artifacts-path .tinadec_dev/tmp/workspace-api-audit --logger "console;verbosity=minimal" --no-restore

dotnet.exe test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --filter "FullyQualifiedName~ServerFailureJournalTests" --artifacts-path .tinadec_dev/tmp/workspace-api-trace --logger "console;verbosity=minimal"

dotnet.exe test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --filter "FullyQualifiedName~ConflictingOrCorruptStorage_IsReportedAndNeverOverwritten" --artifacts-path .tinadec_dev/tmp/workspace-api-trace --logger "console;verbosity=normal" --no-restore --blame-hang --blame-hang-timeout 3m
```

## 源码修复所对应的断言

- `/storage/scopes` 只读逐条验证，无效workspace为null，健康条可读；坏条提供准确code、分类、actions、trace和配置diagnostics，不伪造lifecycle。
- `/projects` 逐作用域挂载，数据库损坏返回storage_database_error，driver原因进入ServerFailureJournal；其他工作区正常返回。
- Mount查询所有生命周期，归档/回收站项目保持project ID、session ID和状态；重启可读，restore回active。
- JSON条件写入路径继续沿用原契约；Scope configure显式使用HTTP snake_case JsonOptions，避免私有DTO产生PascalCase响应。
- 取消与致命异常不转换成普通坏登记；宿主授权与每作用域数据库边界保持原责任。
- 本轮受影响源码和模块文档的 `git diff --check` 通过。

## 跨层只读审查与小范围补强

沿实际Core DTO → Gateway public projection → Desktop scope/sessionRoster核对：坏项目缺失生命周期由Gateway映射为null，分类/trace/diagnostics保留；scope接口原字节代理，workspace=null进入生成类型。Desktop独立读取scope会话，失败保留旧记录及ErrorState，合并键包含storage ID。设置页保留坏登记的诊断与取消登记入口，禁用依赖挂载的配置维护操作；Core注销调用Close（未挂载直接返回）后移除宿主登记，不初始化或Acquire坏作用域。

身份来源仍是main持有的可信启动凭据、随机nonce HMAC proof和精确127.0.0.1 origin；renderer和项目文件只带storage路由，不授予host-control。请求取消不能成为普通坏项：Core行级catch拒绝取消；Desktop signal与代次守卫拒绝迟到更新。只读审查发现Gateway既有fetch catch将AbortError伪造为502，本轮补强Core五种transport，在signal.aborted/AbortError时原抛，其他网络故障仍返回502。侧栏迁移候选只接受实际active且非error的目标，提交时重新复核候选，防止窗口打开后目标变坏。

- `bun test src/coreClient.test.ts`，TinadecGateway目录：4/4通过（无网络fetch替身；五种transport取消与网络错误）。
- `npx vitest run src/components/AppSidebar.test.ts`，apps/desktop目录：22/22通过（新增坏/未知/归档/回收站迁移候选排除及变坏提交拒绝）。
- HomeController单项重试的真实生命周期刷新与ErrorState保留由root代理独立修复，本文件不重复实施或宣称其验收。
