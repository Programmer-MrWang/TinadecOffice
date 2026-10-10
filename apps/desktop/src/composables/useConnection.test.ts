import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/api', () => ({
  api: {
    health: vi.fn(),
  },
}))

import { api } from '@/api'
import {
  useConnection,
  __resetConnectionForTests,
  CONNECTION_TIMEOUT_MS,
  CONNECTION_POLL_INTERVAL_MS,
  retryConnection,
} from './useConnection'

describe('useConnection', () => {
  let hostListener: ((status: import('@/lib/hostConnection').HostConnectionStatus) => void) | undefined
  let getHostStatus: ReturnType<typeof vi.fn>
  let retryHost: ReturnType<typeof vi.fn>
  beforeEach(() => {
    __resetConnectionForTests()
    vi.useFakeTimers()
    vi.clearAllMocks()
    hostListener = undefined
    getHostStatus = vi.fn().mockResolvedValue({ state: 'ready', managed: true })
    retryHost = vi.fn().mockResolvedValue({ state: 'ready', managed: true })
    vi.stubGlobal('window', { tinadec: {
      getHostStatus,
      retryHostConnection: retryHost,
      onHostStatusChanged: (callback: typeof hostListener) => { hostListener = callback; return () => { hostListener = undefined } },
    } })
  })

  afterEach(() => {
    __resetConnectionForTests()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('starts in connecting state', () => {
    const { connectionState } = useConnection()
    expect(connectionState.value).toBe('connecting')
  })

  it('transitions to connected when first health probe succeeds', async () => {
    vi.mocked(api.health).mockResolvedValue({ status: 'ok' })
    const { connectionState, start } = useConnection()
    await start()
    expect(connectionState.value).toBe('connected')
  })

  it('stays connecting when first probe fails, then connected on retry', async () => {
    let calls = 0
    vi.mocked(api.health).mockImplementation(async () => {
      calls++
      if (calls < 2) throw new Error('Cannot connect to backend')
      return { status: 'ok' }
    })
    const { connectionState, start } = useConnection()
    await start()
    expect(connectionState.value).toBe('connecting')

    // Advance past one poll interval; flush the async probe
    await vi.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL_MS)
    expect(connectionState.value).toBe('connected')
  })

  it('transitions to timeout after 30s of failed probes', async () => {
    vi.mocked(api.health).mockRejectedValue(new Error('Cannot connect to backend'))
    const { connectionState, start } = useConnection()
    await start()
    expect(connectionState.value).toBe('connecting')

    await vi.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS)
    expect(connectionState.value).toBe('timeout')
  })

  it('start() is idempotent (calling twice does not restart polling)', async () => {
    vi.mocked(api.health).mockResolvedValue({ status: 'ok' })
    const { start } = useConnection()
    await start()
    // Second call should be a no-op (started flag guard)
    await start()
    expect(api.health).toHaveBeenCalledTimes(1)
  })

  it('timeout does not override connected state', async () => {
    vi.mocked(api.health).mockResolvedValue({ status: 'ok' })
    const { connectionState, start } = useConnection()
    await start()
    // Already connected; advancing past timeout should not change state
    await vi.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS)
    expect(connectionState.value).toBe('connected')
  })

  it('healthy services do not admit business requests when host authentication is unavailable', async () => {
    getHostStatus.mockResolvedValue({ state: 'unavailable', managed: true, error: { code: 'host_identity_unavailable', message: 'retry' } })
    vi.mocked(api.health).mockResolvedValue({ status: 'ok' })
    const { connectionState, businessReady, start } = useConnection()
    await start()
    expect(connectionState.value).toBe('host_unavailable')
    expect(businessReady.value).toBe(false)
    expect(api.health).not.toHaveBeenCalled()
  })
  it('preview exits the splash without probing user services', async () => {
    getHostStatus.mockResolvedValue({ state: 'preview', managed: false })
    const { connectionState, businessReady, start } = useConnection()
    await start()
    expect(connectionState.value).toBe('preview')
    expect(businessReady.value).toBe(false)
    await vi.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS * 2)
    expect(api.health).not.toHaveBeenCalled()
  })
  it('host recovery event admits work only after public liveness succeeds', async () => {
    getHostStatus.mockResolvedValue({ state: 'unavailable', managed: true })
    vi.mocked(api.health).mockResolvedValue({ status: 'ok' })
    const { connectionState, start } = useConnection()
    await start()
    hostListener?.({ state: 'ready', managed: true })
    await vi.waitFor(() => expect(connectionState.value).toBe('connected'))
    hostListener?.({ state: 'rejected', managed: true })
    expect(connectionState.value).toBe('host_rejected')
  })
  it('manual retry invokes real host recovery once even under repeated clicks', async () => {
    getHostStatus.mockResolvedValue({ state: 'unavailable', managed: true })
    vi.mocked(api.health).mockResolvedValue({ status: 'ok' })
    const { start, businessReady } = useConnection()
    await start()
    const first = retryConnection(); const second = retryConnection()
    expect(first).toBe(second)
    expect(await first).toBe(true)
    expect(retryHost).toHaveBeenCalledTimes(1)
    expect(businessReady.value).toBe(true)
  })
  it('a late readiness read cannot override a newer rejected event', async () => {
    let release!: (value: import('@/lib/hostConnection').HostConnectionStatus) => void
    getHostStatus.mockImplementation(() => new Promise(resolve => { release = resolve }))
    const { start, connectionState } = useConnection()
    const starting = start()
    hostListener?.({ state: 'rejected', managed: true })
    release({ state: 'ready', managed: true })
    await starting
    expect(connectionState.value).toBe('host_rejected')
    expect(api.health).not.toHaveBeenCalled()
  })
  it('a late health response cannot restore a revoked host', async () => {
    let release!: (value: { status: string }) => void
    vi.mocked(api.health).mockImplementation(() => new Promise(resolve => { release = resolve }))
    const { start, connectionState } = useConnection()
    const starting = start()
    await vi.waitFor(() => expect(api.health).toHaveBeenCalled())
    hostListener?.({ state: 'unavailable', managed: true })
    release({ status: 'ok' })
    await starting
    expect(connectionState.value).toBe('host_unavailable')
  })
})
