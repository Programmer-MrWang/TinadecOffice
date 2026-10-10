/** Public host readiness snapshot. Credentials never cross this boundary. */
export interface HostConnectionStatus {
  state: 'checking' | 'ready' | 'unavailable' | 'rejected' | 'preview' | 'restart_required'
  managed: boolean
  checked_at?: string
  error?: { code: string; message: string }
}

export interface HostStatusBridge {
  getHostStatus?: () => Promise<HostConnectionStatus>
  retryHostConnection?: () => Promise<HostConnectionStatus>
}

function restartRequired(): HostConnectionStatus {
  return { state: 'restart_required', managed: true, error: {
    code: 'desktop_restart_required',
    message: '桌面主进程与界面版本不一致，请重新启动桌面应用。',
  } }
}

/** A missing local IPC contract is not a backend network or identity failure. */
export function hostBridgeFailure(error: unknown): HostConnectionStatus {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/No handler registered for ['"]tinadec:host-(?:status|retry)['"](?:\s|$)/.test(message)) return restartRequired()
  return { state: 'unavailable', managed: true, error: {
    code: 'host_bridge_unavailable', message: '桌面宿主状态接口暂不可用，请重试连接。',
  } }
}

/** Missing methods on an existing preload must fail closed; a bare browser is preview. */
export async function readHostStatus(bridge?: HostStatusBridge): Promise<HostConnectionStatus> {
  if (!bridge) return { state: 'preview', managed: false }
  if (typeof bridge.getHostStatus !== 'function') return restartRequired()
  try { return await bridge.getHostStatus() } catch (error) { return hostBridgeFailure(error) }
}

export async function retryHostStatus(bridge?: HostStatusBridge): Promise<HostConnectionStatus> {
  if (!bridge) return { state: 'preview', managed: false }
  if (typeof bridge.retryHostConnection !== 'function') return restartRequired()
  try { return await bridge.retryHostConnection() } catch (error) { return hostBridgeFailure(error) }
}
