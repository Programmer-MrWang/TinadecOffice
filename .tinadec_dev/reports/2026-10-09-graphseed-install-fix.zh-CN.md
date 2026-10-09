# GraphSeedPack 安装、诊断与测试隔离修复

2026-10-09 · Windows 本机 · 基线 `d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` + 本次工作树。主责任务 [APP-PACKS-102](../../docs/development-program/02-modules/app/agent-packs/TODO.md#app-packs-102)、[CORE-PERSISTENCE-101](../../docs/development-program/02-modules/core/Persistence/TODO.md#core-persistence-101)。既有用户数据保留，未删除测试包、重置配置或清空用户 `.tinadec`。

## 原因与最终行为

既有 Core 日志确认四次真实安装失败，上海时间为 17:56:08.803、17:56:34.679、17:57:02.434、17:57:04.943。它们经过 `AgentPackService.ApplyCoreAsync → ConfigurationProjectionCoordinator.PersistChangesAsync → ScopeConfigurationDocuments.SaveIfMatchAsync`，被 `configuration_unique` 拒绝：`agent_definitions` 重复 `(TenantId, WorkspaceId, Slug)`。

原 TOML 预检枚举 EF 唯一索引，却忽略 `status = 'draft'`，因而错误地要求已发布 Agent 名称唯一。现有配置包含测试包已发布 `meeting`，GraphSeedPack 发布自己的同名 Agent 被误拒；数据库本来允许两者共存。修复按真实过滤条件决定哪些行参加唯一性检查，同时支持 `deleted_at IS NULL`；普通索引、主键和历史版本不可变检查保持。未知谓词返回 `configuration_unique_filter_unsupported`，不忽略或扩大约束。

完整安装回归又发现 `ConfigurationLiveSourceValidation` 用 `pipeline_id` 检查提示词版本所有者，实际文件字段是 `prompt_pipeline_id`。现已修正，并补充“缺当前文件版本，即使 SQL 留有历史也拒绝准入”的回归。

Gateway 原来丢弃 diagnostics，并将 `configuration_invalid` 映射成 conflict；Desktop 又只留下通用 message。现在 Gateway 保留配置错误码，并投影公开的 code/message/severity/正整数行列；Desktop 两个请求包装共用 `ApiError`，保存 diagnostics 和 trace_id，通知详情显示具体表、属性与已有位置。没有来源位置时不虚构行列，也不保存任意上游扩展或完整错误正文。

安装 400 校验失败结束本次操作；仅真正的 409/412 检查并发安装结果。同窗 Promise 合并和跨窗口锁仍在，终态失败可广播及响应新窗口查询。普通重连不再安装、不把错误改为稍后处理；显式“重试”重新预览、确认后提交一次 PUT。成功重试清理复用任务中的旧错误详情。所有窗口退出后内存失败状态不持久化，安装事实仍由 Core preview 读取。

GraphSeedPack 制品没有变化：版本 `3.0.1`，envelope digest `25d64d688a663243701f168137d74d2f87d20059730b4d9969dd4beca14932ce`。安装沿既有默认采用规则；本轮界面副本保留 BootstrapFixturePack 为工作区默认。

## API 测试污染路径与隔离

用户 agents.toml 中的 `tinadec.tests.bootstrap-pack` 与 `Api.Tests/Fixtures/bootstrap-pack.json` 来源、版本和资源规模一致。测试项目将 fixture 复制为 `Configuration/bootstrap-agent-pack.json`，默认 BootstrapPack 路径再由 DevSeed 读取。旧 WAF 仅晚期配置 DataRoot，Program 更早的受管存储初始化可能选中真实用户根。该来源链已确认，具体哪次历史测试写入无法确定，也不把四次安装请求归因于通知广播。

42 个既有具体 WAF（分布 41 文件）统一继承 `IsolatedApiFactory`。Program 启动前固定 `Testing + Enabled=false`；managed 工厂提前固定本进程拥有的 UserRoot，用 `StorageTesting` 保留受管行为。最终 guard 拒绝隔离决策变化和临时目录越界。程序集一次设置独立临时 TINADEC_HOME，避免默认 persistence、安全库及隐式路径选中真实根，不在并行 factory 之间切换环境变量。

检查后的 DataRoot/DatabasePath/ToolsWorkspaceRoot 回写 canonical 路径，兼顾 macOS `/var` 别名；单独构造的配置 snapshot 会释放，live ConfigurationManager 不释放。退出清理重新确认 owned 路径与链接边界，失败可留下临时目录，不扩大删除目标。详见 [隔离专项](../evidence/2026-10-09-graphseed-fix/api-test-isolation.md)。

## 验收结果

| 验收 | 本轮结果与证据 | 范围 |
| --- | --- | --- |
| 配置保存/安装/编译 | [后端专项](2026-10-09-graphseed-configuration-validation-fix.zh-CN.md) 7/7，0跳过；真实用户 agents.toml 临时副本安装及 Compile 成功 | 独立临时 SQLite/内容存储；旧包及历史行逐条不变；失败 TOML 原字节、SQL不变 |
| API 主程序集定向 | [core-final.trx](../evidence/2026-10-09-graphseed-fix/core-final.trx) 101/101，0跳过，15m56s | AgentPack25、隔离7、配置19、OpenAPI2、GraphSeed7、MCP9、模型查询7、scope13、工具设置12 |
| 最新隔离 helper | [core-isolation-final.trx](../evidence/2026-10-09-graphseed-fix/core-isolation-final.trx) 7/7，0跳过，32s | canonical回写及最终路径断言修改后实际重新构建/启动宿主；未把早期101算成修改后全矩阵复跑 |
| Gateway | [gateway-final.log](../evidence/2026-10-09-graphseed-fix/gateway-final.log) 97/97 | 全量16测试文件；实际Elysia路由的Core响应为替身，另有下述真实HTTP链 |
| Desktop | [desktop-final.log](../evidence/2026-10-09-graphseed-fix/desktop-final.log) 89/89；[最终类型检查](../evidence/2026-10-09-graphseed-fix/desktop-typecheck-final.log) exit0 | 6定向文件，覆盖诊断、400/412、锁/广播/重试与通知；不是Desktop全量 |
| 契约 | 外部OpenAPI snapshot、Desktop生成schema/client同步 | diagnostics line/column为integer，包安装API/ETag/幂等/确认协议沿用 |
| 实际 Desktop 组件 | Electron43.3.0实际AgentPacksPanel、NotificationDetailDialog、NotificationIslandHost，真实Core/Gateway | 最新组件源码经Vite编译，基础CSS使用已有build；隔离副本、随机端口，非完整打包App/安装器 |
| 用户数据保留 | [before](../evidence/2026-10-09-graphseed-fix/user-config-before.json)、[after](../evidence/2026-10-09-graphseed-fix/user-config-after.json)：九份TOML文件清单、字节数、SHA256一致 | 只读hash，不记录正文或密钥；未操作真实用户数据库/安全库/会话，未停止用户服务 |

界面验收在九份当前用户 TOML 的 owned 临时副本中进行，不复制真实数据库或凭据。第一次 PUT 前在副本注入两个重复草稿，触发真实 Core `configuration_invalid`；400 后还原该副本原字节。详情实际显示 `configuration_unique`、`agent_definitions`、`TenantId/WorkspaceId/Slug`、trace_id。两个普通 reconnect 保持失败，不产生 preview/PUT；点击重试重新预览并确认一次 PUT，返回 201。重载 renderer 后同时读取 GraphSeedPack3.0.1 和旧 BootstrapFixturePack0.1.0，原默认保持。

- [真实界面断言及详情原文](../evidence/2026-10-09-graphseed-fix/desktop-ui-acceptance.json)
- [HTTP请求序列](../evidence/2026-10-09-graphseed-fix/desktop-real-http-requests.json)：严格两次PUT，400 → 201
- [HTTP与保留对账](../evidence/2026-10-09-graphseed-fix/desktop-http-verification.json)
- [错误详情截图](../evidence/2026-10-09-graphseed-fix/desktop-diagnostic.png)、[安装后清单截图](../evidence/2026-10-09-graphseed-fix/desktop-installed.png)
- [本轮界面验收夹具及复验前提](../evidence/2026-10-09-graphseed-fix/UI-HARNESS.md)

隔离 Core 进程退出后从同一 owned 存储根冷启动，Gateway重新读取包清单HTTP200；GraphSeedPack3.0.1、BootstrapFixturePack0.1.0及原工作区默认均保持，见 [Core真实进程重启回执](../evidence/2026-10-09-graphseed-fix/desktop-core-restart.json)。renderer重载与Core重启分别取证。

## 构建与证据边界

默认输出构建遇到用户正在运行的 Core PID53904 占用 DLL，未停止用户进程；改用独立 artifacts 输出成功。主 API 命令采用仓库 Windows wrapper，`/m:1` 防止 PowerShell 将 `-m:1`拆成参数。选择类见上表：

```powershell
node scripts/dotnet.mjs test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj /m:1 --artifacts-path .tinadec_dev/tmp/graphseed-api-artifacts --filter "FullyQualifiedName~ApiHostIsolationTests" --logger "trx;LogFileName=core-isolation-final.trx" --results-directory .tinadec_dev/evidence/2026-10-09-graphseed-fix
```

最初配置专项5通过/1失败与提示词键修复后的7通过分别保留。初期类型签名问题、预期OpenAPI漂移、通知任务旧详情回归均有原失败证据及最终通过记录，见 [前端验收账本](../evidence/2026-10-09-graphseed-fix/VALIDATION.md)。界面夹具最初还遇到Windows wrapper冒号参数、Vite扫描已打包HTML与页面加载问题；改用环境配置、明确依赖、关闭额外开发插件后完成验收。截图等待实际绘制，不用提前截图代替DOM断言。

本轮没有跑Linux/macOS实机、PostgreSQL实库、完整Desktop生产构建/安装器、真实多窗口产品并发或外部模型。跨平台路径修复有源码及Windows回归，不能写成macOS通过。X-DATA-104、APP-PACKS-001/101与模块整体审计保持原剩余范围。当前已打开的用户 Core 仍是原进程，加载本修复需要重新启动；本轮没有向真实用户目录安装GraphSeedPack，也没有自动覆盖默认选择。
