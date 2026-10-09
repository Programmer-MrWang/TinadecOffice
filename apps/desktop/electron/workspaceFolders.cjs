'use strict';

/** Picking is read-only. The Core workspace-confirmation action grants and initializes storage. */
async function selectWorkspaceFolders(event, { mainWindow, trusted, dialog }) {
  if (mainWindow?.webContents !== event.sender || !trusted(event)) throw new Error('Directory selection requires the trusted main host page.');
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'multiSelections'], title: '选择工作区源文件夹' });
  return result.canceled ? [] : result.filePaths;
}
module.exports = { selectWorkspaceFolders };
