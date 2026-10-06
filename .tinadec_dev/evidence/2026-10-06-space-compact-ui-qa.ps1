# CDP cannot capture a minimized Electron surface. Preserve the user's window state.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SessionViewQaWindowState {
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string className, string windowName);
 public static IntPtr FindDesktop() { return FindWindow(null,"TinadecOffice"); }
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int mode);
}
'@
$searchQaHandle = [SessionViewQaWindowState]::FindDesktop()
if ($searchQaHandle -eq [IntPtr]::Zero) { throw 'Running Desktop window not found' }
$searchWasMinimized = [SessionViewQaWindowState]::IsIconic($searchQaHandle)
try {
 if ($searchWasMinimized) { [SessionViewQaWindowState]::ShowWindow($searchQaHandle,9) | Out-Null }
 node .tinadec_dev/evidence/2026-10-06-space-compact-ui-qa.mjs
 $searchQaExit = $LASTEXITCODE
} finally {
 if ($searchWasMinimized) { [SessionViewQaWindowState]::ShowWindow($searchQaHandle,6) | Out-Null }
}
exit $searchQaExit
