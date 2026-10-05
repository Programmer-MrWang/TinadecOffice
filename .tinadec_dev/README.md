# TinadecOffice 共享开发资料

这是各编码工具共用、正常纳入 Git 的开发资料目录。新计划、研究、规格、核查报告和项目记忆统一放在这里；[输出约定](OUTPUT-POLICY.md)由根 AGENTS、Claude 和 OpenCode 共同引用。

## 当前开发入口

- [55 个模块的长期开发工程](../docs/development-program/README.md)
- [总架构图](../docs/development-program/00-overview/README.md)
- [模块索引](../docs/development-program/MODULE-INDEX.md) · [总 TODO](../docs/development-program/01-program/MASTER-TODO.md)
- [本次迁移与工具适配](MIGRATION.md) · [逐文件来源与原始哈希](MIGRATION-MANIFEST.json)

## 文件组织

| 目录 | 内容 |
| --- | --- |
| `plans/` | 新计划，以及 Agent / Claude / OpenCode / CodeBuddy / Zcode 原生计划目录 |
| `reports/` | 核查与验收报告、Trae documents、根目录旧报告 |
| `research/` | 研究与技术比较，根目录旧研究报告 |
| `specs/` | 规格与任务清单，含 Trae specs |
| `memory/` | 项目记忆，含 WorkBuddy 与 Claude 的项目 memory |
| `wiki/` | Qoder RepoWiki，保留原有索引、元数据和历史 NOTICE |
| `skills/` | 一份受控技能正文；shadcn-vue 的重复镜像已合并 |
| `tooling/` | 受控工具规则、Ponytail 配置/校验、Claude launch 模板及重定向说明 |
| `archive/` | 保留来源的旧 Claude 入口；旧 Qoder 审查证据在 `reports/qoder/better-harness/` |
| `evidence/` | 有用的长期验证记录；临时日志仍放被忽略的 tmp/logs |

## 本机与新克隆初始化

```powershell
npm run ai:workspace:setup
```

Windows 创建本地目录 junction，其他平台创建目录 symlink。现有目录先保存在被忽略的 `tmp/ai-workspace-backups/`；同名冲突不覆盖受控正文。`npm install` 的 postinstall 和现有 shadcn setup 也会执行初始化。

工具目录继续作为本机入口存在，但不再纳入 Git；它们的文档子目录实际写到本目录。正式产品文档和已有模块台账就地维护，不复制第二份进度。
