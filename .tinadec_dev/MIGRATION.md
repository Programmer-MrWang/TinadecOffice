# 多工具资料整理与输出目录迁移

日期：2026-10-05。代码基线：`ecde49f`，分支 `main`。

## 已完成的整理

- `.claude`、`.catpaw`、`.workbuddy`、`.qoder`、`.opencode`、`.agents`、`.codebuddy`、`.trae`、`.zcode`、`.ponytail`、`.codegraph`、`.mimosa` 等工具目录统一忽略；原已跟踪文件已从 Git 索引移除，本机配置和缓存保留。
- 导入 **365 份工具 Markdown + 4 份根目录计划/报告 + 1 份旧 Claude 指引**。8 份相同 shadcn 镜像合并后，原始导入共有 **362 份唯一 Markdown**。必要 Wiki YAML/元数据和审查 JSON/TSX 一并保留；逐文件来源/原始哈希见 [MIGRATION-MANIFEST.json](MIGRATION-MANIFEST.json)。
- 根目录四份旧计划/研究报告已收进分类目录；本机旧文件同时保存在忽略的 `tmp/ai-workspace-backups/`。旧完整 Claude 指引保存在 `archive/root/`，根 `CLAUDE.md` 收为共享规则入口。
- Ponytail 配置、规则、校验脚本与技能正文改为一份受控内容；npm、安装/检查脚本和当前指引同步到新路径。局部目录链接保留原生发现方式。
- `.github`、Git/npm 项目文件、根 `AGENTS.md`/`CLAUDE.md`、`opencode.jsonc`、`.mcp.json` 等共享项目入口继续纳入版本管理；`.tinadec_dev/tooling/ponytail/config.json` 有显式 ignore 例外。
- 原有 `docs/development-program` 的 **55 模块、97 条初始功能、101 项任务**保持权威位置；本目录提供统一入口，新过程报告链接回对应模块，而不复制第二份 TODO。

导入的旧 Wiki 和 Specs 保留历史警告与原名，不因迁入目录而变成当前源码事实。初始复制逐文件哈希相等；少量当前规则/脚本进行了明确路径修订，原文保留在 Git 历史或本机迁移备份中。

当前生效的 Ponytail 规则同时按源码纠正了旧 `runtime-binding → 404` 描述：该代理和 Core 配置端点仍有效，不能随历史 overview 聚合一起判为删除。

## 实际输出路由

Windows 使用 junction，其他平台使用目录 symlink。只链接文档/技能子目录，保留其余私有配置、会话和缓存。

| 本机原生入口 | 受控目标 |
| --- | --- |
| `.agents/skills` / `.claude/skills` / `.opencode/skills` | `.tinadec_dev/skills`（同一份正文） |
| `.opencode/plans` | `.tinadec_dev/plans/opencode` |
| `.claude/plans` | `.tinadec_dev/plans/claude` |
| `.agent/plans` | `.tinadec_dev/plans/agent` |
| `.codebuddy/plans` | `.tinadec_dev/plans/codebuddy` |
| `.zcode/plans` | `.tinadec_dev/plans/zcode` |
| `.qoder/repowiki` | `.tinadec_dev/wiki/qoder` |
| `.qoder/better-harness` | `.tinadec_dev/reports/qoder/better-harness` |
| `.claude/better-harness` | `.tinadec_dev/reports/claude/better-harness` |
| `.trae/documents` | `.tinadec_dev/reports/trae` |
| `.trae/specs` | `.tinadec_dev/specs/trae` |
| `.workbuddy/memory` | `.tinadec_dev/memory/workbuddy` |
| `.ponytail` | `.tinadec_dev/tooling/ponytail` |

共 **15 个目录入口**。初始化会先保留旧目录，合并缺少的文件；同名差异不会覆盖受控文件，原文留在本机备份。

Claude 的项目/local settings 均设置相对 `plansDirectory`；自动记忆使用 `.tinadec_dev/memory/claude` 的绝对路径，仅写被忽略的本机 settings。原 permissions、MCP、hooks 等字段保留。审计后的 Claude launch 与 Qoder MCP 公共模板只在本地文件缺失时补建。

Codex/Qoder 的普通计划、报告和研究遵循根 `AGENTS.md` 中的输出约定；OpenCode 额外通过 `instructions` 导入 [OUTPUT-POLICY.md](OUTPUT-POLICY.md)，Claude 根入口通过 `@` 导入它。这里区分模型约定与文件系统重定向，不声称存在未支持的通用输出路径设置。

## 新克隆与验证命令

```powershell
npm run ai:workspace:setup
npm run ai:workspace:test
npm run ai:ponytail:validate
node docs/development-program/scripts/reindex.mjs
```

`postinstall`、`predev`、`ai:shadcn:setup` 复用离线初始化，无须重新下载多份技能。

## 本轮实际验证

- 本机 15 个入口已创建；再次初始化 15 个均识别为既有正确链接，没有重写受控正文。
- 独立临时仓库夹具：**7 passed / 1 skipped / 0 failed**。覆盖新克隆离线初始化、重复执行、原生入口写通、同名差异保留、旧 local plansDirectory 更新、permissions/MCP/hooks 保留、外部 source/target 子目录/祖先越界拒绝。
- 唯一跳过是 Windows 当前权限无法建立文件 symlink 的夹具；目录 junction 的越界拒绝实测通过。POSIX/macOS 初始化未在本轮实机执行。
- Ponytail 校验通过；开发工程 reindex **1780 链接 / 198 ID / 0 错误**。
- 本机路径/原文、ignore、公开模板、配置保留等最终检查结果见 [evidence/workspace-routing-verification.json](evidence/workspace-routing-verification.json)。

没有启动外部模型会话、Qoder 原生 Wiki 生成/读取/Git Sync 或重跑产品业务测试。文件系统写入路径已验证；原生工具的完整生成/同步行为仍需各自演练。

## 官方依据

Codex 会读取项目 `AGENTS.md`，且支持链接到共享技能目录：[OpenAI AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)、[OpenAI Skills](https://learn.chatgpt.com/docs/build-skills)。

Claude 字段依据 [Settings reference](https://code.claude.com/docs/en/settings-reference#plansdirectory) 与 [Memory](https://code.claude.com/docs/en/memory#storage-location)；本次调整只使用已核实字段。

OpenCode 的规则导入依据 [Config](https://opencode.ai/docs/config/)；本机 1.18.34 原生 Plan 路径在 [session.ts](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/session.ts#L315) 固定到 `.opencode/plans`，所以使用局部链接。

Qoder 的根指引和 Wiki 路径依据 [Rules](https://docs.qoder.com/user-guide/rules)、[Repo Wiki](https://docs.qoder.com/user-guide/repo-wiki)。更完整的只读核对记录在 [tooling/OUTPUT-REDIRECTION.md](tooling/OUTPUT-REDIRECTION.md)。
