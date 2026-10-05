# SHARED DEVELOPMENT FILES

**Generated:** 2026-10-05
**Last Updated:** 2026-10-06
**Last Updated By:** dotfiles整理、共享输出路由与推送
**Last Verified Commit:** 提交前工作树 `ecde49f`；386来源文件、15入口、54 ignore探针、7 passed/1 Windows权限skip初始化夹具通过；未重跑业务测试
**Branch:** main

Follow the root `AGENTS.md` and [OUTPUT-POLICY.md](OUTPUT-POLICY.md). This directory is tracked; native tool state is ignored.

- Keep the original source/provenance for imported plans, reports and wiki pages. Preserve history without treating it as current product truth.
- Existing module architecture/status/tasks remain authoritative in `../docs/development-program/`; new process artifacts live here and link to the relevant module or Task ID.
- Skills are maintained only in `skills/`. Native `.agents/skills`, `.claude/skills` and `.opencode/skills` are local links to that directory.
- `MIGRATION-MANIFEST.json` records this import's source and original hashes, including duplicate shadcn resources. Do not silently overwrite history when two files have the same name.
- `scripts/setup-ai-workspace.mjs` preserves old local directories under ignored `tmp/ai-workspace-backups/` and creates only document/skill-directory links. Do not link an entire private tool configuration/cache folder into this tracked directory.
