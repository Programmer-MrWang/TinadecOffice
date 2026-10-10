import { computed, ref } from 'vue'
import { api } from '@/api'
import { setHostAccessStatus } from '@/lib/hostAccess'
import type { HostConnectionStatus } from '@/lib/hostConnection'

/** Public liveness and private host readiness are separate. Only both admit business work. */
export type ConnectionState = 'connecting' | 'connected' | 'timeout' | 'disconnected' | 'host_unavailable' | 'host_rejected' | 'preview'
export const CONNECTION_TIMEOUT_MS = 30_000
export const CONNECTION_POLL_INTERVAL_MS = 1_500
export const CONNECTION_BANNER_KEY = 'backend-connection'
const connectionState = ref<ConnectionState>('connecting')
const hostStatus = ref<HostConnectionStatus>({ state: 'checking', managed: true })
const businessReady = computed(() => connectionState.value === 'connected' && hostStatus.value.state === 'ready')
let timeoutHandle: ReturnType<typeof setTimeout> | undefined
let pollHandle: ReturnType<typeof setInterval> | undefined
let watchHandle: ReturnType<typeof setInterval> | undefined
let unsubscribeHost: (() => void) | undefined
let pendingProbe: Promise<boolean> | undefined
let pendingRetry: Promise<boolean> | undefined
let started = false
let generation = 0
let hostRevision = 0

function clearStartupTimers() {
  clearTimeout(timeoutHandle); clearInterval(pollHandle)
  timeoutHandle = undefined; pollHandle = undefined
}
function markConnected() {
  connectionState.value = 'connected'
  clearStartupTimers()
  startHealthWatch()
}
function applyHostStatus(next: HostConnectionStatus) {
  hostRevision++
  hostStatus.value = next
  setHostAccessStatus(next)
  if (next.state === 'ready') return
  connectionState.value = next.state === 'preview' ? 'preview'
    : next.state === 'rejected' ? 'host_rejected'
    : next.state === 'unavailable' ? 'host_unavailable'
    : connectionState.value === 'connected' ? 'disconnected' : 'connecting'
  if (next.state !== 'checking') {
    clearStartupTimers()
    if (next.state === 'preview') { clearInterval(watchHandle); watchHandle = undefined }
    else startHealthWatch()
  }
}
function bridge() { return typeof window === 'undefined' ? undefined : window.tinadec }
function probe(refreshHost = true): Promise<boolean> {
  if (pendingProbe) return pendingProbe
  const epoch = generation
  const revision = hostRevision
  pendingProbe = (async () => {
    try {
      const host = bridge()
      if (refreshHost) {
        const next: HostConnectionStatus = host?.getHostStatus
          ? await host.getHostStatus() : { state: 'preview', managed: false }
        if (epoch !== generation) return false
        // A newer main-process event outranks an older IPC read.
        if (revision === hostRevision) applyHostStatus(next)
      }
      if (hostStatus.value.state !== 'ready') return false
      const authenticatedRevision = hostRevision
      await api.health()
      if (epoch !== generation || authenticatedRevision !== hostRevision || hostStatus.value.state !== 'ready') return false
      markConnected()
      return true
    } catch {
      if (epoch === generation && connectionState.value === 'connected') connectionState.value = 'disconnected'
      return false
    }
  })().finally(() => { if (epoch === generation) pendingProbe = undefined })
  return pendingProbe
}
function startHealthWatch() {
  if (watchHandle !== undefined || !started) return
  watchHandle = setInterval(() => { void probe() }, CONNECTION_POLL_INTERVAL_MS * 4)
}
export function retryConnection(): Promise<boolean> {
  if (pendingRetry) return pendingRetry
  const epoch = generation
  pendingRetry = (async () => {
    try {
      const host = bridge()
      if (!host?.retryHostConnection) { applyHostStatus({ state: 'preview', managed: false }); return false }
      const next = await host.retryHostConnection()
      if (epoch !== generation) return false
      applyHostStatus(next)
      // An older public probe must settle before the explicit authenticated retry.
      if (pendingProbe) await pendingProbe
      return await probe(false)
    } catch {
      if (epoch === generation) applyHostStatus({ state: 'unavailable', managed: true,
        error: { code: 'host_connection_unavailable', message: 'The host connection could not be checked. Retry the desktop host.' } })
      return false
    }
  })().finally(() => { if (epoch === generation) pendingRetry = undefined })
  return pendingRetry
}
export function useConnection() {
  async function start() {
    if (started) return
    started = true
    const epoch = generation
    const host = bridge()
    unsubscribeHost = host?.onHostStatusChanged?.(next => {
      if (epoch !== generation) return
      applyHostStatus(next)
      if (next.state === 'ready') {
        // Let any older read settle, then verify public liveness against the new snapshot.
        void (async () => { if (pendingProbe) await pendingProbe; if (epoch === generation) await probe(false) })()
      }
    })
    timeoutHandle = setTimeout(() => {
      if (connectionState.value !== 'connecting') return
      connectionState.value = 'timeout'; clearStartupTimers(); startHealthWatch()
    }, CONNECTION_TIMEOUT_MS)
    await probe()
    if (epoch === generation && connectionState.value === 'connecting') pollHandle = setInterval(() => { void probe() }, CONNECTION_POLL_INTERVAL_MS)
  }
  return { connectionState, hostStatus, businessReady, start, retryConnection }
}
/** Test-only: reset singleton state and invalidate all late reads. */
export function __resetConnectionForTests() {
  generation++
  clearStartupTimers(); clearInterval(watchHandle); watchHandle = undefined
  unsubscribeHost?.(); unsubscribeHost = undefined
  pendingProbe = undefined; pendingRetry = undefined; started = false; hostRevision = 0
  connectionState.value = 'connecting'; hostStatus.value = { state: 'checking', managed: true }
}
