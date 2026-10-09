const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectWorkspaceFolders } = require('./workspaceFolders.cjs');
test('folder picker returns path arrays and cancellation, only for the trusted main sender', async () => {
  const sender = {}; const window = { webContents: sender }; const event = { sender }; let calls = 0;
  const options = { mainWindow: window, trusted: () => true, dialog: { async showOpenDialog(parent, config) { calls++; assert.equal(parent, window); assert.deepEqual(config.properties, ['openDirectory', 'multiSelections']); return { canceled: false, filePaths: ['C:/a', 'C:/b'] }; } } };
  assert.deepEqual(await selectWorkspaceFolders(event, options), ['C:/a', 'C:/b']);
  await assert.rejects(selectWorkspaceFolders({ sender: {} }, options), /trusted main/);
  await assert.rejects(selectWorkspaceFolders(event, { ...options, trusted: () => false }), /trusted main/); assert.equal(calls, 1);
  assert.deepEqual(await selectWorkspaceFolders(event, { ...options, dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: ['ignored'] }) } }), []);
});
