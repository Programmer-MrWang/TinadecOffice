# Skills 包生命周期实施与验证

日期：2026-10-09。工作树基线：cf5cbf7 + 前序工具设置未提交改动，本批次未提交。关联任务：CORE-SKILLS-102、APP-SETTINGS-103。实施契约：[Skills 包生命周期](../specs/2026-10-09-skills-package-lifecycle.zh-CN.md)。

## 实现

Core 扩展市场提案/安装记录和技能资源 DTO，提供作用域、资源 ID、完整文件清单及包摘要、来源/版本/提交、实际可用状态。资源文件预览由 Core 使用准确 ID 与相对路径校验。SQLite/PostgreSQL 迁移保留旧提案兼容启动顺序。

新增 `skill_git` 来源，通过已有受防护的 #fetch 读取 GitHub 固定提交 Git 树和 blob；拒绝未固定分支、凭据、截断树、链接、子模块、越界路径、文件预算超限及 Git 内容对象 hash 不符。支持仓库根包和子目录包，正文 frontmatter 与技能名一致。

Desktop 设置管理完整包，保留未修改附件，显式完整集合替换；共享 Skills 市场安装可无项目。项目动作轮询并校验对象 epoch；市场 Skill 详情不展示 MCP 运行区。实际可用与动作审批状态分开。

运行时按准确 Agent 工具能力发布索引，无读取工具时省略索引。项目资源 provider 可见性补齐；项目包准入复制完整内容至 Core 保留目录，正文或附件变化生成新摘要，管理仍读取 live 项目目录。工具追加写授权拒绝与冻结技能只读根重叠。

## 验证

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| Core MarketCatalogApiTests | 76/76 通过 | [market-suite-final2.log](../evidence/2026-10-09-skills-management/market-suite-final2.log) |
| Core Market+Skills 复跑 | 103/103 通过 | 本轮终态复跑 |
| Core WorkspaceSkillApiTests | 27/27 通过（含共享写入被拒后不落地回归） | [workspace-skills-final.log](../evidence/2026-10-09-skills-management/workspace-skills-final.log) |
| Core 联合回归（Market + Skills + Settings + OpenAPI） | 116/116 通过 | [skills-round3.log](../evidence/2026-10-09-skills-management/skills-round3.log) |
| Gateway | 88/88 通过 | bun test src |
| Desktop 设置与全量组件 | 设置 160/160；全量 1091 passed / 14 skipped | npx vitest run |
| Desktop 类型检查与生产构建 | vue-tsc 通过；renderer 构建成功 | [desktop-build-final3.log](../evidence/2026-10-09-skills-management/desktop-build-final3.log) |

本轮把本地导入统一进治理链路：`POST /api/v1/tools/skills/import` 与 `PUT /api/v1/tools/skills/{id}` 对共享包返回待审批回执（`user_action_id`、`action_status`、完整包清单与摘要），只有 `skill_resource_update` 动作通过人工审批后才落盘；项目包继续走 `skill_project_package`。审批参数携带 `expected_package_digest` 并在落盘前复核；拒绝审批为终态且不留下任何包目录。共享/项目、市场与本地导入因此共用同一冻结字节与审批语义。

早期 Core 定向批次因新增迁移先于基表创建而启动失败；迁移已调整为可在空 SQLite 库启动。本轮结论以工作树未提交状态为准。

## 边界

当前远程 Git 包适配器支持公开 GitHub HTTPS 固定提交，其他 Git 托管主机尚无适配器。PostgreSQL 迁移已参与编译，未运行真实数据库实例。Linux/macOS 沙箱、路径及安装包未在本机执行。真实供应商模型自主选择技能不属于脚本化工具链回归证据。
