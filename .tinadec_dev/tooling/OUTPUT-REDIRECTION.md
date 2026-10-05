# 开发工具输出目录核对（只读研究，2026-10-05）

统一目录名采用 `.tinadec_dev`。本笔记不修改配置，不复制凭据。

## 可直接落地的入口

| 工具 | 已核对入口 | 建议适配 | 边界 |
| --- | --- | --- | --- |
| Qoder IDE / CLI | 根 `AGENTS.md`，`.qoder/rules/**/*.md` | 根 AGENTS 明确将新 plan/spec/report/research/todo 写进 `.tinadec_dev`；可本地创建 always-on shim | 当前仓库没有 Qoder rules。官方说明 rules 优先于 AGENTS，已有本机 rules 如有冲突须更新 |
| OpenCode | 根 `AGENTS.md`，根 `opencode.jsonc.instructions` | `instructions: [".tinadec_dev/OUTPUT-POLICY.md"]` 加载共享规则；仅 `.opencode/plans` 建本地 junction 指向 `.tinadec_dev/plans/opencode` | `OPENCODE_CONFIG_DIR` 只改变配置发现；不是输出路径开关。1.18.34 的原生 plan 输出硬编码 `.opencode/plans` |
| Claude Code | 根 `CLAUDE.md` 的 `@` 导入，`.claude/settings.json` / local settings | 根 CLAUDE 导入共享规则；`plansDirectory: ".tinadec_dev/plans/claude"`；bootstrap 用绝对路径写本地 `autoMemoryDirectory` | plansDirectory 相对项目根，越界保持默认；autoMemoryDirectory 必须绝对或 `~/`，不能用相对路径。保留现有 local permissions / MCP 字段 |
| Trae / Zcode / CodeBuddy / WorkBuddy | 当前只找到已有文档/plan/memory；Zcode 仅 hooks 配置 | 本地输出子目录 junction 和共享规则；bootstrap 在新 clone 重建 | 未核到这些工具的原生输出路径设置，不应写虚构配置项 |

本机版本：Claude Code `2.1.284`，OpenCode `1.18.34`；Qoder PATH 中是 `C:/Program Files/Qoder IDE/bin/qoder.cmd`。

## 保留工具兼容性的方式

- 整个 `.claude` / `.qoder` / `.opencode` 等目录继续本地存在，但 Git 忽略；不要把整个目录 junction 到可提交目录，因为其中可能有 MCP 认证、会话、插件缓存或机器配置。
- 只重定向已确认有用的子目录：`plans`、`documents`、`specs`、项目 memory、项目 rules、skills。新 clone 通过仓库脚本重新生成本地 shim / junction。
- Qoder RepoWiki 官方路径固定 `.qoder/repowiki`，可只给这个子目录建立 junction，或用显式同步脚本筛选 Markdown 与必要知识索引。官方 `wiki_plan.yaml` 控制内容/范围，不控制输出根。
- Qoder CLI auto-memory 默认 `~/.qoder/projects/<project>/memory/`；本轮未查到可配输出目录，不改用户全局目录。不把跨项目用户 memory 直接纳入仓库。
- OpenCode 原生 plan 的 junction 是实际文件系统重定向；AGENTS/instructions 是模型约定，两者应分别说明，不能把规则写作强制路径配置。

## 共享输出规则建议

1. 新 plan/spec/research/report/todo/verification/memory 等开发产物写入 `.tinadec_dev` 对应类别；产品公开文档、用户说明仍使用现有 `docs`。
2. 多工具共用一个规范和一个开发工程；按工具保留归档来源，避免覆盖原名冲突。
3. 工具强制写固定路径时，只重定向该文档子目录；会话、日志、凭据、缓存留在被忽略的工具目录。
4. 保留原始归档状态，不把历史 plan 完成勾选继承为当前源码已完成。
5. 不建立 `.tindec_dev` 第二目录，不在工具目录创建新的正式项目档案。

## 需要改路径引用的仓库位置

- `package.json:30` 的 `ai:ponytail:validate` 与 `:32` 的 `ai:tools:check`：仍执行 `.ponytail/validate.js`。
- `.ponytail/validate.js`：错误消息指旧配置/规则位置，实际用 `__dirname` 找同目录文件；整体迁移时检查 loader。
- `.claude/skills/ponytail/SKILL.md:27,122`：引用 `.ponytail/rules.md`。
- `CLAUDE.md:185,187`：技能旧路径与安装说明旧路径；可以收成根文件指向共享规则入口。
- `docs/ai-tools-integration-guide.md:51,52`：同上；`docs/ai-tools-{implementation-report,deployment-verification}.md` 和 `docs/architecture-compliance-verification.md` 多处 `.ponytail` 路径。
- `AGENTS.md` / `apps/desktop/AGENTS.md` / `TinadecGateway/AGENTS.md` 里可能有旧工具引用，root 的迁移检查应统一核对。
- 旧 `.trae/specs` 内部相对链接、根 `PR-REPORT-docs-vs-code.md` 的旧文件链接需按迁移映射校验。
- `docs/research/shell-steer-survey-2026-09-28/README.zh-CN.md:20` 的 `.agents/notes/...` 是外部 DeepSeek Harness 引文，不属于本仓库路径，不应机械替换。

## 主源

- Qoder IDE 根 AGENTS 与规则优先级：[Rules](https://docs.qoder.com/user-guide/rules)。
- Qoder CLI 根 AGENTS、规则 frontmatter、`@` imports、auto-memory：[Memory](https://docs.qoder.com/cli/memory)。
- Qoder 固定 RepoWiki 目录与 wiki_plan 的内容范围配置：[Repo Wiki](https://docs.qoder.com/user-guide/repo-wiki)。
- OpenCode 自定义 instructions 与 OPENCODE_CONFIG_DIR：[Config](https://opencode.ai/docs/config/)、[Rules](https://opencode.ai/docs/rules/)、[官方 schema](https://opencode.ai/config.json)。
- OpenCode 1.18.34 plan 固定路径：[session.ts](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/session.ts#L315)。
- Claude plansDirectory / autoMemoryDirectory：[Settings reference](https://code.claude.com/docs/en/settings-reference#plansdirectory)、[Memory](https://code.claude.com/docs/en/memory#storage-location)。官方 reference HTML 过大导致 web reader 失败，本轮另从官方 `https://code.claude.com/docs/en/settings-reference.md` 实际下载核对了两节。
