# 存储、配置与资源生命周期：本轮验收账本

日期：2026-10-09。源码基线：`f8b233d41601744258773c090cbaa4bd79f30677` 加本次未提交工作树。任务唯一入口为 [X-DATA-104](../../../docs/development-program/02-modules/cross-cutting/data-security/TODO.md#x-data-104)，规范为 [产品契约 §21](../../../docs/tinadec-core-product-definition.zh-CN.md)。此处记录证据和适用范围，不另建任务状态。

## Windows 与作用域

| 验证范围 | 实际结果 | 证据与限制 |
| --- | --- | --- |
| 作用域 HTTP、初始化、租约、维护、日志与向量 | 主轮15/15，无失败/跳过；末尾API差分4/4 | [TRX](storage-verified.trx)、[末尾TRX](../storage-core-openapi-host/storage-core-openapi-host.trx)；差分包含公开探针、OpenAPI、旧嵌入宿主与关闭拒新SSE |
| 平台密钥存储定向 | 24/24 | [TRX](secrets.trx)；Windows DPAPI 实际运行，不代表 macOS 密钥库验收 |
| 开发宿主启动器 | 2/2 | [日志](dev-launch.log)；每次启动生成独立私钥，公共 Vite 子进程不继承 |
| PowerShell 验收脚本的宿主身份探针 | 5 项断言通过 | [日志](e2e-host-proof.log)；实际 Node HTTP/HMAC 服务与 Windows PowerShell 5：正确证明、错误角色、错误证明、重定向、公开探针不带私钥；未执行完整模型 E2E |
| Tools 路径、MCP、POSIX 构造与真实文件/ACL | 分阶段 65/65、59/59、22/22；Linux 修复后的 Windows 构造 17/17 | [资源报告](../../reports/2026-10-09-storage-resources.zh-CN.md)；这些集合有重叠，不相加；没有新沙箱账户/UAC 安装实测 |

15 项最终测试实际覆盖：两项目独立数据库与未知 scope 拒绝；并发打开及不覆盖配置；损坏/冲突不重建；移动/复制身份；显式外部模式重启恢复；切换存储根保留旧库；关闭等待租约及取消后恢复准入；匿名 loopback 不能读取事实、创建项目或批准动作；公开 HMAC challenge；缓存清理保护事实/配置/凭据；项目删除保留代码；SQLite 事实变化使旧删除预览失效；日志合计预算与轮转；向量读写；并发宿主关闭释放实际文件句柄。

句柄测试用 `FileShare.None` 打开项目数据库、用户数据库和 `state/host.lock`，没有以等待 GC 或删除重试掩盖占锁。较早 TRX 留存：`storage-scopes*.trx`、`storage-host-release.trx`、`storage-final.trx`。这些阶段发现真实缺陷，最终修复共享异步 Dispose/Stop 完成任务、关闭挂载入口、宿主 worker 关闭顺序及 SQLite 连接池，不将较早失败覆盖为成功。

末尾4项实际验证公开challenge不缓存/拒重复nonce、当前OpenAPI快照、旧Testing宿主及关闭/取消；closing阶段迟到控制仍可排空运行，新SSE（含尾斜杠）拒绝新增长租约。

## 配置、资源与生命周期

| 验证范围 | 实际结果 | 证据与限制 |
| --- | --- | --- |
| Windows TOML 文档与会话迁移 | 阶段 19 passed、1 skipped | [报告](../../reports/2026-10-09-configuration-files.zh-CN.md)；当时 PG 未配置，不能计作 PG 通过；最终原生 binding 修订另记差分证据 |
| Windows 原生 TOML 绑定最终差分 | 配置 19/19，0 failed、0 skipped | [最新 TRX](../../reports/configuration-and-transfer-tests/configuration-native-final-with-diagnostics.trx)、[补正报告](../../reports/2026-10-09-native-toml-bindings.zh-CN.md)；新增四态与可选值模式、GUI/手改/编译一致、无效输入与历史字节保留 |
| Runtime 来源选择与既有模块 HTTP | 新来源3/3，原Skills HTTP1/1，无失败/跳过 | [报告](../../reports/2026-10-09-runtime-configuration-source.zh-CN.md)；配置文档端口存在才要求scope runtime，托管缺失仍拒绝；未改旧SkillFactory，不靠转为新作用域掩盖回归 |
| 独立 Tools 已审批 grant 历史 | 定向47/47，显式禁反射后的真实文件12/12 | [资源报告](../../reports/2026-10-09-storage-resources.zh-CN.md)；state/sandbox-grants.toml原子写/强校验；冻结调用不读写此历史，无旧JSON迁移 |
| Linux 打包依赖与真实小型归档 | 定向13/13 | [资源报告](../../reports/2026-10-09-storage-resources.zh-CN.md)；libcap2、实际ELF/x64字节及执行位；不是产品实包/安装验证；tag前TOML/scope门禁仅接入、未执行CI |
| Skills / MCP / 内容 / 快照 / 导出 / GC / purge | 联合 161 项 157 通过、4 失败；修复后定向 50 项 49 通过、1 新失败；该恢复用例最终 1/1；项目 Skill 完整文件卸载另 1/1 | [报告](../../reports/2026-10-09-storage-resources.zh-CN.md)；全部已发现失败均有修复和通过证据，不表述为单次 161 全绿 |

资源测试检查真实文件结果：安装预览不创建包、不可变版本/活跃指针、损坏包拒绝、卸载保留历史、项目 Skill 实际 live 包删除、内容失败/取消无临时文件、config/skills 快照恢复、共享内容引用与打开 stream 阻止 GC、SQLite 备份可重新打开、六模块 session-owned graph 永久删除、部分提交 journal 重放。明确安装使用本地包 fixture；未做真实网络 npm/PyPI 下载验收。包历史目前全部保留，没有宣称包可达性 GC 已实现。

## 实际 Linux 与 PostgreSQL

Fedora 44 WSL2 x64，Linux 6.18.33.2，独立 .NET SDK 10.0.300。PostgreSQL 18.6 仅使用临时 cluster / 数据库和两个随机 schema；测试后已停止，无系统服务 enable。bubblewrap 0.13.0 从固定 commit 与校验 archive 构建，真实 `--unshare-all` probe 通过。

| 验证范围 | 实际结果 | 证据与限制 |
| --- | --- | --- |
| TOML 配置、会话迁移、真实 PG | 22/22，0 failed、0 skipped | [TRX](../../reports/linux-storage-validation/linux-configuration-transfer-postgresql.trx)：16 配置、5 迁移、1 PG |
| PG 删除预览的事实变更检测 | 增强后的同一 PG Fact 单独 1/1，0 skipped | [TRX](../../reports/linux-storage-validation/linux-postgresql-delete-preview.trx)；插入/更新均使旧预览失效，另一 schema 保留；未实际销毁项目，不能另加为一个新独立场景 |
| 原生 binding 新源码的 Linux/PG 最终差分 | 配置19 + 真实PG1，20/20，0 failed、0 skipped | [TRX](../../reports/linux-storage-validation/linux-native-configuration-postgresql.trx)；不重复5迁移或27Tools，也不将先前22项视为新格式验收 |
| Linux Tools 内核和存储边界 | 27/27，0 failed、0 skipped | [TRX](../../reports/linux-storage-validation/linux-posix-tools-final.trx)：6 POSIX 实机命令、4 实际文件/环境边界、17 构造/序列化/权限；过滤非 Linux 早退用例 |

十二 DbContext 的表、两个 schema 的相同记录 ID、scope 内 TOML 投影、事务回滚及模型缓存均实际验证。PG 删除摘要读取实际 owned schema，在 RepeatableRead 中对表与规范化行排序摘要，避免仅凭本地文件批准删除数据库事实。

Linux 实机发现并修复三项产品问题：模型缓存创建期间递归进入 EF 模型；用户存储身份首次发布并发产生多个 UUID；bubblewrap 父线程提前结束和 `/dev/null` 的 nodev 挂载。测试另修正 PID namespace 观测：在命令运行时识别准确宿主 PID 和启动时间，结束后检验相同身份已退出，未放宽存活子进程要求。全部原始失败日志保留。详见 [完整平台报告](../../reports/2026-10-09-linux-postgresql-validation.zh-CN.md)。

## Desktop / Gateway / 宿主边界

以 [Desktop 验证记录](../storage-desktop-validation.md) 的最终差分为准。Vue 全量阶段 1108 passed、14 skipped；后续配置默认设置 199/199、Tools/宿主维护 24/24、关闭/SSE 定向 63/63，集合重叠。最新 Node 全量156 passed、1平台跳过，Gateway95/95；类型检查、OpenAPI 和生成客户端分别记录，不能加成一个总数。Linux真实小型deb归档与损坏例另有实际执行证据，Windows的这一平台跳过不算Linux验收。

真实 Electron 43.3 隐藏窗口 fixture 已验证主窗、面板、debug、SSE；未知窗口、iframe、离开可信入口后的请求拒绝；私钥不进入 renderer Request headers；重定向不携带私钥。后续增加 HMAC 服务身份验证，匿名健康服务不能骗取签发私钥。此验证是实际 Electron 网络/IPC 边界，未替代人工界面流程或真实模型运行。开发服务器源码可写时，开发环境不能宣称具有不可变产品代码的安全边界。

生产 Vite 构建曾通过，冻结后重复构建为释放 Linux/PG 验证内存而停止；保留 dist 与最后两处 Tools 源码变更不一致，不作为发布包。必须从最终冻结源码重建才能发布。未生成 Windows/Linux/macOS 安装包或完整 NativeAOT 交付证据。

## 尚未验收的具体范围

- macOS 实际 Seatbelt、文件权限、桌面/安装包；Linux 完整 NativeAOT 与桌面安装包；新 Windows 沙箱账户/UAC 安装。
- 真实模型双项目并发、切换后的迟到 SSE/审批、运行恢复整链；模拟 fixture/组件测试只证明所断言的边界。
- 不可写项目在当前用户实际 ACL 下自动外部回退；现有测试证明显式外部模式和重启恢复。
- 进程硬终止后的初始化及项目删除恢复；现有 journal/错误注入不代替断电或 kill 验收。
- PG 全业务同场景、完整项目销毁及 pg_dump 导出恢复；当前实际双 schema/事务/投影/删除预览不能替代它们。
- 真实网络依赖安装及第三方 MCP/harness 自身的原生工具行为；它们是用户登记的可信程序，不包含在 TinadecTools 文件/Shell 沙箱保证中。

最终文档 reindex 成功：55 个模块、240 个 Markdown 文件、2010 个链接，检查错误为 0。其范围仅为文档与源码索引，不重新运行产品测试；详见 [门禁日志](documentation-reindex.log)。首次尝试遇到 Windows 文件打开错误，原始日志保存在 [首次尝试](documentation-reindex-first.log)，顺序重试已通过。

旧路径和真实用户密钥未导入、未迁移、未删除。没有运行远程 CI，也没有提交或推送源码。实现基线为 `f8b233d41601744258773c090cbaa4bd79f30677` 加当前工作树；reindex 输出中的历史文档基线不代表本轮实现基线。最终差分格式检查见 [日志](diff-check.log)。
