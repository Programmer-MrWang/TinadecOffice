# TinadecOffice Claude Guidance

@AGENTS.md
@.tinadec_dev/OUTPUT-POLICY.md

The shared project rules are in AGENTS.md. Useful development plans, reports,
specs, research and project memory go to .tinadec_dev/.

Run npm run ai:workspace:setup after cloning or changing tool routing. It links
native plan/wiki/skill directories to the tracked shared tree and preserves
existing local permissions/MCP settings. Claude plans use
.tinadec_dev/plans/claude; project auto-memory uses
.tinadec_dev/memory/claude through an absolute path in local settings.

## Ponytail Integration

The canonical skill is .tinadec_dev/skills/ponytail/SKILL.md; project rules are
.tinadec_dev/tooling/ponytail/rules.md. .claude/skills is a local discovery link
to the shared skills. Optional plugin installation is documented in
.tinadec_dev/tooling/claude/ponytail-plugin-install.md.

The module architecture/status/TODO program remains in
docs/development-program/README.md. Previous Claude guidance is archived in
.tinadec_dev/archive/root/CLAUDE-before-consolidation.md; use current source and
shared project rules for product facts.
