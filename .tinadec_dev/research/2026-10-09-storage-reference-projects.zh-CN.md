# 工作区同类项目存储审计

日期：2026-10-09。本文依据本地源码，不将这些 checkout 当作产品最新版本；没有读取真实用户凭据、启动竞品或写其工作区。外部 SDK 可能另有副作用，不据扫描器只读推断整个产品不会修改项目。

| 产品 / 仓库 | Git HEAD | 用户根与分类 | 打开项目的已确认影响 |
|---|---|---|---|
| Codex `C:/git/agent/codex` | `822e58cc3d666166c7446c5b1ea2e52f5d09594c` | 默认 `~/.codex`，`CODEX_HOME`；TOML 配置、SQLite 状态、日期 sessions、模型缓存和日志 | loader 发现现存 `.codex` 与祖先资源，按信任加载；rollout 延迟到显式持久化才打开文件 |
| OpenCode `C:/git/agent/opencode` | `f03046d9f558bc54a090363fea48441b05f522bf` | XDG config/data/cache/state；data DB/log/snapshot，cache/bin | 发现现存 `.opencode` 后，配置目录插件安装可写 `.gitignore`、package/lock/node_modules；snapshot 使用外置 gitdir |
| Pi `C:/git/agent/pi` | `28dcce2ba45ce4a9efeb0f5b686f0be830fd89b9` | `~/.pi/agent`，`PI_CODING_AGENT_DIR`；settings/models/auth、cwd 编码 sessions、扩展包和崩溃日志 | 信任通过后资源解析可自动安装缺失包，项目 `.pi/npm`、`.pi/git` 可产生写入 |
| Gemini CLI `C:/git/agent/gemini-cli` | `fb972b2f87fe7d5b06d37eac711490162d98de2c` | `~/.gemini`，`GEMINI_CLI_HOME` 改变 home 基准；projects.json、tmp/history 按稳定项目 id 归档 | `.project_root` 初始化标记在用户 tmp/history；读取已有弃用 workspace settings 时可迁移回写现存文件 |
| Cherry Studio `C:/git/agent/cherry-studio` | `50d69b685697a8c3a634bc8b4f19ce3978768423` | Electron userData 内 Data/Runtime/Toolchain，sessionData 在 Cache；平台 logs；受管 MCP/OAuth/package 分类 | 发现外部 `.claude/skills`/`.agents/skills`，自身 Agent 镜像在 Data/Agents；external 来源不随 owned 清理 |

## MCP、Skills 和 Agent 配置

| 产品 | MCP 配置与程序 | Skills 来源、顺序、安装 | Agent 配置 |
|---|---|---|---|
| Codex | mcp_servers 写 TOML；stdio 按 command/args/env/cwd 启动，HTTP 连接远程；定义存在不代表程序安装完成 | project `.codex/skills`、旧 user `$CODEX_HOME/skills`、user/祖先 `.agents/skills`、系统 `.system`；plugins/cache 是版本化包域，staging 切换 | 配置分层有 origin/fingerprint/disabled reason；roles 支持 config_file 与 agents 目录 |
| OpenCode | command 通常在项目 cwd；OAuth data/mcp-auth.json；配置、进程、依赖三个边界 | `.claude`/`.agents`、config skill/skills、显式 paths/URLs；remote v2 有 staging/backup/rename，不把 v1/v2 当同实现 | config agent/agents 的 Markdown；JSON/JSONC 多层，部分默认用户配置会初始化 |
| Pi | 本地版本已支持 MCP；user mcp.json + 受信 `.pi/mcp.json`；OAuth user mcp-auth.json，项目 HTTP 配置禁止 OAuth 凭据定义 | project `.pi/skills`、user agent/skills、显式路径与包；固定资源优先级，重复 first wins 并诊断；npm/git 包分用户与项目 | settings/resources/extensions 分层；用户 trust.json 独立，资源安装受信任门控 |
| Gemini CLI | settings.mcpServers；mcp add 默认 project，user 需显式指定；保存 definition 不等于统一安装 server | built-in < extension < user `.gemini` < user `.agents` < 受信 project `.gemini` < project `.agents`；install 默认 user，link 显式 symlink | user agents 与 `.gemini/agents` 发现，workspace agents 受 trust 门控 |
| Cherry Studio | SQLite MCP definitions；stdio 优先系统 npx/uvx；MCpb/DXT 是独立受管包安装功能 | Data/Skills owned；外部 Claude/Pi 来源标 external；镜像 Windows copy/POSIX symlink；受管安装 staging/backup/hash/mutation lock | SQLite 保存定义、runtime binding，Data/Agents 归属自身，用户外部 SDK 根单独记录 |

## 日志、清理和恢复

- Codex SQLite 日志按 thread/process 限字节和行数；rollout 明确持久化时机。
- OpenCode snapshot 外置 gitdir 并 prune；remote skills 原子切换。未确认普通文件日志存在统一字节上限。
- Pi MCP 日志 5 MiB 单备份；crash-log 最多 5 条并按时间过期；旧 session 格式加载会回写迁移，未找到通用全数据备份策略。
- Gemini hash→slug 存储迁移 copy 且保留源；会话清理保护 active session，使用 age/count/minimum；损坏日志保留 backup。
- Cherry 日志每文件 10m、90d，清理保护当天当前文件；preboot 数据迁移 copy/switch、目标为空与 owned marker；DB restore 使用离线 snapshot/journal/restart/recovery marker；reset 保留 logs/Crashpad/Runtime/Toolchain。

## 源码证据

下列路径相对表内对应仓库，行号为上述 HEAD 的审计定位；完整文件优先于单行摘要。

| 产品 | 证据 |
|---|---|
| Codex | `codex-rs/utils/home-dir/src/lib.rs:5`（home）；`codex-rs/core/src/config/mod.rs:4095`（目录）；`codex-rs/state/src/sqlite.rs:34`（DB分类）；`codex-rs/rollout/src/recorder.rs:883,1742,1770`（延迟写）；`codex-rs/config/src/loader/README.md:3`（分层）；`codex-rs/ext/skills/src/host_roots.rs:76`、`codex-rs/skills/src/lib.rs:62`（skills）；`codex-rs/cli/src/mcp_cmd.rs:454`、`codex-rs/rmcp-client/src/rmcp_client.rs:493`（MCP）；`codex-rs/agent-roles/src/loader.rs:38,75`（roles）；`codex-rs/state/src/runtime.rs:87`、`codex-rs/state/src/runtime/logs.rs:55`（log budget） |
| OpenCode | `packages/core/src/global.ts:11`（分类）；`packages/core/src/database/database.ts:43`（DB）；`packages/core/src/observability/logging.ts:57`（log）；`packages/opencode/src/config/paths.ts:26`、`packages/opencode/src/config/config.ts:260,309,430`（发现与安装）；`packages/opencode/src/snapshot/index.ts:23,71,305`（外置snapshot/gc）；`packages/opencode/src/mcp/index.ts:342`、`packages/opencode/src/mcp/auth.ts:37`；`packages/opencode/src/skill/index.ts:176`、`packages/core/src/skill/discovery.ts:164`；`packages/opencode/src/config/agent.ts:13` |
| Pi | `packages/coding-agent/src/config.ts:605,619`（home）；`packages/coding-agent/src/core/session-manager.ts:589,599,1092,1160,1187`（session写入/迁移）；`packages/coding-agent/src/core/package-manager.ts:180,1302,2085,2166,2646`（优先级/安装）；`packages/coding-agent/src/core/resource-loader.ts:841`；`packages/coding-agent/src/core/trust-manager.ts:214`；`packages/coding-agent/src/extensions/mcp/config.ts:145,233`、`runtime.ts:98`、`oauth.ts:144`、`log.ts:11`；`packages/coding-agent/src/core/crash-log.ts:19` |
| Gemini CLI | `packages/core/src/utils/paths.ts:13,22`；`packages/core/src/config/storage.ts:49,281`；`packages/core/src/config/projectRegistry.ts:104,163,373`；`packages/cli/src/config/settings.ts:461,479,1017,1237,1258`（已有配置回写）；`packages/core/src/skills/skillManager.ts:50`；`packages/cli/src/commands/skills/install.ts:33`；`packages/cli/src/commands/mcp/add.ts:197`；`packages/core/src/config/storageMigration.ts:18`；`packages/cli/src/utils/sessionCleanup.ts:116,300,346`；`packages/core/src/core/logger.ts:132,148` |
| Cherry Studio | `src/main/core/paths/pathRegistry.ts:46,436`（所有权与ensure）；`src/main/constants.ts:21,109`；`src/main/services/CacheService.ts:208`；`src/main/data/db/schema/agent.ts:7,22`、`mcpServer.ts:14`；`src/main/services/McpPackageService.ts:365,433`；`src/main/services/SkillService.ts:309,620,720`；`src/main/services/LoggerService.ts:157`；`src/shared/types/logger.ts:35`；`src/main/services/cacheCleanup/logs.ts:44`；`src/main/services/CacheCleanupService.ts:25`；`src/main/services/userDataRelocation/README.md:5`；`src/main/data/db/restore/README.md:3`；`src/main/services/dataReset.ts:67` |

## 对 TinadecOffice 的具体建议

1. 统一路径分类与所有权：config/data/state/cache/logs/packages/skills/worktrees；外部路径和受管目录分别记录，避免清理外部来源。
2. 明确项目打开副作用：发现、初始化、依赖安装分开；UI 展示实际根与来源、fallback/外部状态，不能从扫描器只读推断整个打开只读。
3. MCP definition、server program/package、secret/OAuth、process、log 分别建模；可用性必须真实诊断。
4. Skills 固定优先级、重复处理和来源 hash，受管安装 staged/atomic；导入不静默覆盖外部来源。
5. 同作用域日志统一字节预算和单文件轮转，保护当前文件；分类清理必须预览路径/大小/数量/过期时间后再执行。
6. 配置文本是权威、结构编辑复用同校验与 CAS；冲突保留草稿并展示真实版本。
7. 根/backend 切换是显式操作，不顺手搬迁/删除旧数据；迁移另设计副本、验证、切换与恢复。
8. HTTP/SSE 捕获 storage_id，重连沿用；跨作用域列表由宿主汇总，迟到响应不得污染新选择。

本文件是审计证据与设计输入；产品行为以模块文档和实现为准。
