// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertHostAccess, setHostAccessStatus, useHostAccess } from './hostAccess'
const original = window.tinadec
const ready = { state: 'ready' as const, managed: true }
afterEach(() => { Object.defineProperty(window, 'tinadec', { configurable: true, value: original }); setHostAccessStatus(ready) })
describe('host business admission', () => {
  it('permits public probes while refusing business access in preview', async () => {
    const getHostStatus = vi.fn(async () => ({ state: 'preview' as const, managed: false }))
    Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus } })
    await expect(assertHostAccess('/api/v1/health')).resolves.toBeUndefined()
    expect(getHostStatus).not.toHaveBeenCalled()
    await expect(assertHostAccess('/api/v1/storage/scopes/open')).rejects.toMatchObject({ code: 'desktop_host_required', category: 'environment_unavailable', actions: [] })
    expect(useHostAccess().isPreview.value).toBe(true)
  })
  it('does not admit a healthy but unauthenticated host and preserves its actual reason', async () => {
    Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus: async () => ({ state: 'unavailable', managed: true, error: { code: 'host_unavailable', message: 'Gateway has not started' } }) } })
    await expect(assertHostAccess('/api/v1/agent-packs')).rejects.toMatchObject({ message: 'Gateway has not started', actions: ['retry'] })
    expect(useHostAccess().canAccessBackend.value).toBe(false)
    Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus: async () => ready } })
    await expect(assertHostAccess('/api/v1/projects')).resolves.toBeUndefined()
  })
  it('does not allow a late ready read to overwrite a newer revocation', async () => {
    let finish!: (status: typeof ready) => void
    Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus: () => new Promise(resolve => { finish = resolve }) } })
    setHostAccessStatus(ready)
    const check = assertHostAccess('/api/v1/projects')
    const rejected = expect(check).rejects.toMatchObject({ code: 'host_unavailable' })
    setHostAccessStatus({ state: 'unavailable', managed: true, error: { code: 'host_unavailable', message: 'revoked' } })
    finish(ready)
    await rejected
    expect(useHostAccess().canAccessBackend.value).toBe(false)
  })
  it('propagates cancellation after a late status read', async () => {
    const abort = new AbortController()
    Object.defineProperty(window, 'tinadec', { configurable: true, value: { getHostStatus: async () => { abort.abort(); return ready } } })
    await expect(assertHostAccess('/api/v1/projects', abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
