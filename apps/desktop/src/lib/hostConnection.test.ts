import { describe, expect, it, vi } from 'vitest'
import { hostBridgeFailure, readHostStatus, retryHostStatus } from './hostConnection'

describe('local host bridge contract', () => {
  it.each(['status', 'retry'])('classifies the real missing %s IPC without exposing raw details', async channel => {
    const error = new Error(`Error invoking remote method 'tinadec:host-${channel}': Error: No handler registered for 'tinadec:host-${channel}'`)
    const invoke = vi.fn().mockRejectedValue(error)
    const snapshot = channel === 'status'
      ? await readHostStatus({ getHostStatus: invoke }) : await retryHostStatus({ retryHostConnection: invoke })
    expect(snapshot).toMatchObject({ state: 'restart_required', managed: true, error: { code: 'desktop_restart_required' } })
    expect(snapshot.error?.message).not.toContain('No handler')
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('keeps permission refusals and other missing channels distinct from version mismatch', () => {
    for (const message of ['Host status requires a trusted host page.', "No handler registered for 'terminal:create'", 'private-error-value']) {
      expect(hostBridgeFailure(new Error(message))).toMatchObject({ state: 'unavailable', error: { code: 'host_bridge_unavailable' } })
      expect(hostBridgeFailure(new Error(message)).error?.message).not.toContain(message)
    }
  })
  it('requires restart for an older preload but treats an absent bridge as browser preview', async () => {
    expect(await readHostStatus({})).toMatchObject({ state: 'restart_required' })
    expect(await retryHostStatus({})).toMatchObject({ state: 'restart_required' })
    expect(await readHostStatus()).toEqual({ state: 'preview', managed: false })
  })
})
