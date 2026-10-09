// Isolated local Core only. Verifies a pending approval and active command keep their admission
// configuration while explicit settings saves change defaults for future calls. Restores defaults.
const fs = require('node:fs/promises');
const base = 'http://127.0.0.1:48881/api/v1';
const project = 'a7061929-b3ae-4ada-9475-3b642dc3c058';
async function api(path, method = 'GET', body, revision) {
  const response = await fetch(base + path, { method, headers: {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(revision === undefined ? {} : { 'If-Match': `"${revision}"` }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
(async () => {
  const original = await api('/tools/settings/defaults');
  let changed = false;
  try {
    const action = await api('/user/tool-actions', 'POST', { project_id: project, tool_id: 'command_run',
      params: { executable: 'node', arguments: ['-e', "setTimeout(()=>console.log('SNAPSHOT-COMMAND-FINISHED'),4000)"] } });
    if (action.status !== 'awaiting_user') throw new Error(`Unexpected initial status: ${action.status}`);
    const first = await api('/tools/settings/defaults', 'PUT', { schema_version: 1,
      settings: { ...original.settings, shell: { ...original.settings.shell, command_timeout_ms: 100 } } }, original.revision);
    changed = true;
    await api(`/governance/permission-requests/${action.permission_request_id}/decision`, 'POST',
      { approve: true, reason: 'Isolated pending command configuration snapshot verification' });
    const gated = await api(`/user/tool-actions/${action.id}`);
    if (gated.status !== 'awaiting_approval') throw new Error(`Unexpected gated status: ${gated.status}`);
    const completion = api(`/approvals/${gated.action_approval_id}/decision`, 'POST',
      { decision: 'approved', reason: 'Isolated command completion across settings saves' });
    let active;
    for (let i = 0; i < 80; i++) {
      active = await api(`/user/tool-actions/${action.id}`);
      if (active.status === 'running') break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (active.status !== 'running') throw new Error(`Command did not enter running: ${active.status}`);
    const second = await api('/tools/settings/defaults', 'PUT', { schema_version: 1,
      settings: { ...original.settings, shell: { ...original.settings.shell, command_timeout_ms: 50 } } }, first.revision);
    await completion;
    const done = await api(`/user/tool-actions/${action.id}`);
    if (done.status !== 'completed' || !done.result?.stdout?.includes('SNAPSHOT-COMMAND-FINISHED'))
      throw new Error(`Original command did not retain its deadline: ${JSON.stringify(done)}`);
    const evidence = { environment: 'isolated Windows Core -> real TinadecTools -> Node',
      pending_approval_kept_original_config: true, save_while_command_running: true,
      original_command_timeout_ms: original.effective_settings.shell.command_timeout_ms,
      saved_pending_timeout_ms: first.effective_settings.shell.command_timeout_ms,
      saved_active_timeout_ms: second.effective_settings.shell.command_timeout_ms,
      status: done.status, result: done.result };
    await fs.writeFile(__dirname + '/command-freeze-result.json', JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
  } finally {
    if (changed) {
      const latest = await api('/tools/settings/defaults');
      await api('/tools/settings/defaults', 'PUT', { schema_version: 1, settings: original.settings }, latest.revision);
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
