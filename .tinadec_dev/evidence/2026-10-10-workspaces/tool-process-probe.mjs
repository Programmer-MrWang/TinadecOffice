import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
const repo = resolve(import.meta.dirname, '../../..');
const commands = process.argv.includes('--commands');
const owned = await mkdtemp(join(tmpdir(), 'tinadec-workspace-tools-'));
const a = join(owned, 'first'), b = join(owned, 'second'), outside = join(owned, 'outside');
for (const path of [a, b, outside]) await mkdir(path);
await mkdir(join(a, '.tinadec', 'data'), { recursive: true });
const exe = join(repo, '.tinadec_dev/tmp/workspace-tools/bin/TinadecTools/debug/TinadecTools.exe');
const child = spawn(exe, [], { cwd: a, windowsHide: true, env: { ...process.env, TINADEC_HOME: join(owned, 'user') }, stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map(); let callId = 1000; const events = []; let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });
createInterface({ input: child.stdout }).on('line', line => {
  try { const data = JSON.parse(line); const id = data.call_id; if (pending.has(id) && (data.result || data.error)) { pending.get(id)(data); pending.delete(id); } } catch {}
});
const timeout = setTimeout(() => { child.kill(); console.error('Tool process timed out.'); process.exitCode = 1; }, 150_000);
const roots = [{ id: 'a', path: a }, { id: 'b', path: b }];
const context = { schema_version: 1, run_id: 'frozen-first', storage_id: 'scope-first', storage_root: join(a, '.tinadec'), project_root: a, working_directory: a,
  workspace_roots: roots, primary_root_id: 'a', settings_hash: 'probe', settings: {}, allowed_tool_ids: ['read_file', 'write_file', 'file_search', 'command_run', 'shell'] };
async function call(tool, params, executionContext = context) {
  console.log('Executing ' + tool);
  const id = ++callId; const receipt = new Promise(resolve => pending.set(id, resolve));
  child.stdin.write(JSON.stringify({ tool_id: tool, session_id: 'probe', toolcall_id: id, approved: true, params, execution_context: executionContext }) + '\n');
  let timer; const result = await Promise.race([receipt, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('No response for ' + tool + ': ' + stderr)), 45000); })]).finally(() => clearTimeout(timer));
  const response = result.result ?? { success: false, error: result.error }; events.push({ tool, params, response }); return response;
}
try {
  for (const [path, content] of [[a, 'source-first-marker'], [b, 'source-second-marker']]) {
    const write = await call('write_file', { filepath: join(path, 'same.txt'), content }); assert.equal(write.success, true, JSON.stringify(write));
    const read = await call('read_file', { filepath: join(path, 'same.txt') }); assert.equal(read.success, true, JSON.stringify(read));
    assert.equal(await readFile(join(path, 'same.txt'), 'utf8'), content);
  }
  const search = await call('file_search', { pattern: 'source-', path: '.', fixed_strings: true }); assert.equal(search.success, true, JSON.stringify(search));
  assert.deepEqual([...new Set(search.lines.filter(line => line.is_match).map(line => line.root_id))].sort(), ['a', 'b']);
  const denied = await call('write_file', { filepath: join(outside, 'denied.txt'), content: 'no' }); assert.equal(denied.success, false);
  const protectedWrite = await call('write_file', { filepath: join(a, '.tinadec/data/denied.txt'), content: 'no' }); assert.equal(protectedWrite.success, false);
  const narrow = { ...context, run_id: 'next-run', workspace_roots: [roots[0]] };
  const next = await call('read_file', { filepath: join(b, 'same.txt') }, narrow); assert.equal(next.success, false);
  if (commands) {
  const shell = await call('shell', { command: 'cd', cwd: b, timeout_ms: 30000 });
  assert.equal(shell.success, true, JSON.stringify(shell)); assert.ok(shell.stdout.toLowerCase().includes(b.toLowerCase()), JSON.stringify(shell));
  const init = await call('command_run', { executable: 'git', arguments: ['init', '--quiet'], working_directory: b, timeout_ms: 30000 }); assert.equal(init.success, true, JSON.stringify(init));
  const git = await call('command_run', { executable: 'git', arguments: ['status', '--porcelain'], working_directory: b, timeout_ms: 30000 }); assert.equal(git.success, true, JSON.stringify(git)); assert.match(git.stdout, /same\.txt/);
  }
  await writeFile(join(import.meta.dirname, 'tool-process.json'), JSON.stringify({ accepted: true, platform: process.platform, command_sandbox: commands ? 'accepted' : 'not_attempted_in_this_probe', owned_root: owned, executable: exe, events }, null, 2));
  console.log(JSON.stringify({ accepted: true, events: events.length, platform: process.platform }));
} catch (error) {
  await writeFile(join(import.meta.dirname, 'tool-process-failure.json'), JSON.stringify({ error: error.stack, stderr, events }, null, 2)); console.error(error.stack); process.exitCode = 1;
} finally { clearTimeout(timeout); child.stdin.end(); child.kill(); }
