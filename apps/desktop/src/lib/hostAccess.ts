import { computed, shallowRef } from 'vue'
import { ApiError } from './apiError'
import { readHostStatus, type HostConnectionStatus } from './hostConnection'

const status = shallowRef<HostConnectionStatus | null>(null)
let revision = 0
export function setHostAccessStatus(next: HostConnectionStatus): void { revision++; status.value = next }
export function useHostAccess() {
  return {
    status,
    isPreview: computed(() => status.value?.state === 'preview'),
    canAccessBackend: computed(() => !status.value || status.value.state === 'ready'),
    reason: computed(() => status.value?.state === 'preview'
      ? '界面预览不连接用户数据。工作区、存储和资源安装请在桌面应用中操作。'
      : status.value?.error?.message ?? '正在验证桌面宿主，业务操作暂不可用。'),
  }
}

/** Capture the storage identity before awaiting this gate. No credential crosses IPC. */
export async function assertHostAccess(path: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  if (/^\/api\/v1\/(health|host-challenge)(?:[/?]|$)/.test(path)) return
  const host = typeof window === 'undefined' ? undefined : window.tinadec
  // Standalone injected transports have their own authentication; an existing preload does not.
  if (!host) return
  if (status.value?.state === 'restart_required') throwHostUnavailable(status.value)
  const readRevision = revision
  const snapshot = await readHostStatus(host)
  signal?.throwIfAborted()
  if (readRevision === revision) setHostAccessStatus(snapshot)
  const current = status.value ?? snapshot
  if (current.state === 'ready') return
  throwHostUnavailable(current)
}

function throwHostUnavailable(current: HostConnectionStatus): never {
  const preview = current.state === 'preview'
  const code = preview ? 'desktop_host_required' : current.error?.code ?? 'host_unavailable'
  const message = preview ? '此页面是界面预览。请在桌面应用中执行此操作。' : current.error?.message ?? '桌面宿主尚未就绪，请重试连接。'
  throw new ApiError(message, preview ? 403 : 503, {
    code, detail: message, category: 'environment_unavailable', retryable: false,
    actions: preview || current.state === 'restart_required' ? [] : ['retry'],
  })
}
