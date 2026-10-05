import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { setupAiWorkspace, developmentBridges } from './setup-ai-workspace.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureParent = path.resolve(here, '../tmp');
fs.mkdirSync(fixtureParent, { recursive: true });
const suiteRoot = fs.mkdtempSync(path.join(fixtureParent, 'ai-workspace-verification-'));
function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}
function fixture(label) {
  const root = path.join(suiteRoot, label);
  fs.mkdirSync(root);
  write(root, '.tinadec_dev/OUTPUT-POLICY.md', '# Fixture policy\n');
  write(root, '.tinadec_dev/skills/shadcn-vue/SKILL.md', '# Fixture skill\n');
  return root;
}
function link(target, source) {
  fs.mkdirSync(path.dirname(source), { recursive: true });
  const kind = fs.statSync(target).isDirectory()
    ? process.platform === 'win32' ? 'junction' : 'dir'
    : 'file';
  fs.symlinkSync(target, source, kind);
}

test('fresh offline setup creates all local bridges, then repeat setup is idempotent', () => {
  const root = fixture('fresh');
  const first = setupAiWorkspace(root);
  assert.equal(first.bridges, developmentBridges.length);
  assert.equal(first.created, developmentBridges.length);
  assert.equal(first.importedFiles, 0);
  for (const [from, to] of developmentBridges) {
    assert.equal(fs.realpathSync(path.join(root, from)), fs.realpathSync(path.join(root, to)));
  }
  const second = setupAiWorkspace(root);
  assert.equal(second.created, 0);
  assert.equal(second.alreadyLinked, developmentBridges.length);
  assert.equal(second.backupRoot, null);
});

test('native plan/wiki/skill paths write through to the canonical tracked tree', () => {
  const root = fixture('write-through');
  setupAiWorkspace(root);
  for (const [from, to] of developmentBridges) {
    const content = `Written via ${from}\n`;
    const file = 'write-through-' + from.replaceAll('/', '-') + '.md';
    write(root, path.join(from, file), content);
    assert.equal(fs.readFileSync(path.join(root, to, file), 'utf8'), content);
  }
});

test('old local documents merge without overwriting canonical text and originals remain in backup', () => {
  const root = fixture('conflicts');
  write(root, '.tinadec_dev/plans/claude/conflict.md', 'canonical\n');
  write(root, '.claude/plans/conflict.md', 'local conflicting draft\n');
  write(root, '.claude/plans/nested/local-only.md', 'local useful plan\n');
  const stats = setupAiWorkspace(root);
  assert.equal(stats.preservedConflicts, 1);
  assert.equal(stats.importedFiles, 1);
  assert.equal(fs.readFileSync(path.join(root, '.tinadec_dev/plans/claude/conflict.md'), 'utf8'), 'canonical\n');
  assert.equal(fs.readFileSync(path.join(root, '.tinadec_dev/plans/claude/nested/local-only.md'), 'utf8'), 'local useful plan\n');
  assert.ok(stats.backupRoot);
  assert.equal(fs.readFileSync(path.join(root, stats.backupRoot, '.claude/plans/conflict.md'), 'utf8'), 'local conflicting draft\n');
  assert.equal(fs.readFileSync(path.join(root, stats.backupRoot, '.claude/plans/nested/local-only.md'), 'utf8'), 'local useful plan\n');
});

test('routing settings preserve existing permissions, hooks and MCP data', () => {
  const root = fixture('permissions');
  const global = { permissions: { allow: ['Read'], deny: ['Bash(rm *)'] }, hooks: { Stop: [{ matcher: '.*' }] }, enabledMcpjsonServers: ['existing'] };
  const local = { plansDirectory: '.claude/old-plans', permissions: { allow: ['Write'] }, env: { EXISTING: 'retained' }, mcpServers: { existing: { command: 'server' } } };
  write(root, '.claude/settings.json', JSON.stringify(global));
  write(root, '.claude/settings.local.json', JSON.stringify(local));
  setupAiWorkspace(root);
  const nextGlobal = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));
  const nextLocal = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.local.json'), 'utf8'));
  assert.deepEqual(nextGlobal, { ...global, plansDirectory: '.tinadec_dev/plans/claude' });
  assert.deepEqual(nextLocal, { ...local, plansDirectory: '.tinadec_dev/plans/claude', autoMemoryDirectory: path.join(root, '.tinadec_dev/memory/claude') });
});

test('an external existing tool-output link is rejected without touching its contents', () => {
  const root = fixture('external-source');
  const outside = path.join(suiteRoot, 'outside-source');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'sentinel.md'), 'external sentinel\n');
  link(outside, path.join(root, '.claude/plans'));
  assert.throws(() => setupAiWorkspace(root), /outside|another location|escapes|link/i);
  assert.deepEqual(fs.readdirSync(outside), ['sentinel.md']);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel.md'), 'utf8'), 'external sentinel\n');
});

test('an external descendant in the canonical target tree is rejected before importing a local file', () => {
  const root = fixture('external-descendant');
  const outside = path.join(suiteRoot, 'outside-descendant');
  fs.mkdirSync(outside);
  fs.mkdirSync(path.join(root, '.tinadec_dev/plans/claude'), { recursive: true });
  link(outside, path.join(root, '.tinadec_dev/plans/claude/nested'));
  write(root, '.claude/plans/nested/draft.md', 'must stay inside repository\n');
  assert.throws(() => setupAiWorkspace(root), /outside|symlink|escapes|link/i);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.readFileSync(path.join(root, '.claude/plans/nested/draft.md'), 'utf8'), 'must stay inside repository\n');
});

test('an external settings-file symlink is rejected without rewriting external settings', (t) => {
  const root = fixture('external-settings');
  const outside = path.join(suiteRoot, 'outside-settings.json');
  const content = JSON.stringify({ permissions: { deny: ['all'] } });
  fs.writeFileSync(outside, content);
  try {
    link(outside, path.join(root, '.claude/settings.json'));
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      t.skip('Windows file symlink creation requires a privilege unavailable in this session');
      return;
    }
    throw error;
  }
  assert.throws(() => setupAiWorkspace(root), /outside|symlink|escapes|link/i);
  assert.equal(fs.readFileSync(outside, 'utf8'), content);
});

test('an external canonical ancestor is rejected before any directory is created outside', () => {
  const root = fixture('external-ancestor');
  const outside = path.join(suiteRoot, 'outside-ancestor');
  fs.mkdirSync(outside);
  link(outside, path.join(root, '.tinadec_dev/plans'));
  assert.throws(() => setupAiWorkspace(root), /outside|symlink|escapes|link/i);
  assert.deepEqual(fs.readdirSync(outside), []);
});

console.log('Fixture artifacts retained:', suiteRoot);
