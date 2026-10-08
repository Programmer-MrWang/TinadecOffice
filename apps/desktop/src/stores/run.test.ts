/**
 * The run list is loaded per session, and switching sessions used to leave the previous
 * session's runs — and its selected run id — on screen for the whole round-trip, or forever
 * when the new request failed. These cases pin the read-id guard.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { generatedApi } = vi.hoisted(() => ({
  generatedApi: {
    listRuns: vi.fn(),
    controlRun: vi.fn(),
  },
}))

vi.mock('@/generated/client', () => ({
  generatedApi,
  RUN_STATUSES: ['queued', 'running', 'completed', 'failed', 'cancelled'],
}))

import { useRunStore } from './run'

function run(id: string, sessionId: string) {
  return { id, session_id: sessionId, status: 'running' } as never
}

/** A promise plus the handle to settle it later. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('useRunStore.fetchRuns', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    generatedApi.listRuns.mockReset()
    generatedApi.controlRun.mockReset()
  })

  it('does not let a slow reply for the previous session overwrite the current one', async () => {
    const slow = deferred<never[]>()
    generatedApi.listRuns.mockImplementation((sessionId: string) =>
      sessionId === 'session-a' ? slow.promise : Promise.resolve([run('r-b', 'session-b')]),
    )

    const store = useRunStore()
    const first = store.fetchRuns('session-a')
    await store.fetchRuns('session-b')
    expect(store.runs.map((r) => r.id)).toEqual(['r-b'])

    // Session A finally answers; it must be dropped.
    slow.resolve([run('r-a', 'session-a')])
    await first
    expect(store.runs.map((r) => r.id)).toEqual(['r-b'])
    expect(store.current?.session_id).toBe('session-b')
  })

  it('clears the previous session immediately instead of waiting for the reply', async () => {
    generatedApi.listRuns.mockResolvedValueOnce([run('r-a', 'session-a')])
    const store = useRunStore()
    await store.fetchRuns('session-a')
    expect(store.runs).toHaveLength(1)

    const pending = deferred<never[]>()
    generatedApi.listRuns.mockImplementationOnce(() => pending.promise)
    const switching = store.fetchRuns('session-b')

    // Still in flight, but nothing from session A may be readable.
    expect(store.runs).toEqual([])
    expect(store.current).toBeNull()

    pending.resolve([run('r-b', 'session-b')])
    await switching
    expect(store.runs.map((r) => r.id)).toEqual(['r-b'])
  })

  it('keeps the list while refetching the same session', async () => {
    generatedApi.listRuns.mockResolvedValue([run('r-a', 'session-a')])
    const store = useRunStore()
    await store.fetchRuns('session-a')

    const pending = deferred<never[]>()
    generatedApi.listRuns.mockImplementationOnce(() => pending.promise)
    const refetch = store.fetchRuns('session-a')

    // A same-session refresh (the post-control path) must not blank the panel.
    expect(store.runs.map((r) => r.id)).toEqual(['r-a'])

    pending.resolve([run('r-a', 'session-a')])
    await refetch
    expect(store.runs.map((r) => r.id)).toEqual(['r-a'])
  })
})
