// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  api: {
    gatewayUrl: 'http://gateway.test',
    previewAgentPackInstall: vi.fn(),
    installAgentPack: vi.fn(),
  },
}))

import { api, type AgentPackInstallPreviewDto } from '@/api'
import {
  __resetGraphSeedPackBootstrapForTests,
  ensureGraphSeedPack,
  graphSeedPackState,
} from './graphSeedPackBootstrap'
import { GRAPH_SEED_PACK_DIGEST, GRAPH_SEED_PACK_ID, GRAPH_SEED_PACK_VERSION, graphSeedPackEnvelope } from './GraphSeedPack'
import {
  __resetNotificationsForTests,
  resolveConfirmation,
  useNotifications,
} from '@/composables/useNotifications'

const previewMock = vi.mocked(api.previewAgentPackInstall)
const installMock = vi.mocked(api.installAgentPack)

function preview(action: string, overrides: Partial<AgentPackInstallPreviewDto> = {}): AgentPackInstallPreviewDto {
  return {
    action,
    preview_id: '7c3899a5-119d-4e40-b2a4-313a7b13fac0',
    pack_id: GRAPH_SEED_PACK_ID,
    owner: 'tinadec',
    bundled_version: GRAPH_SEED_PACK_VERSION,
    installed_version: null,
    integrity_digest: GRAPH_SEED_PACK_DIGEST,
    revision: 0,
    etag: '"0"',
    expires_at: '2026-08-25T13:00:00Z',
    counts: { agents: 3, prompt_pipelines: 1, modes: 3, created: 7, adopted: 0, reused: 0, updated: 0 },
    required_core_version: '0.1.0',
    current_core_version: '0.1.0',
    warnings: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', undefined)
  __resetNotificationsForTests()
  __resetGraphSeedPackBootstrapForTests()
  previewMock.mockReset()
  installMock.mockReset()
})

afterEach(() => {
  __resetNotificationsForTests()
  __resetGraphSeedPackBootstrapForTests()
  vi.unstubAllGlobals()
})

describe('GraphSeedPack bootstrap', () => {
  it.each(['configuration_invalid', 'conflict'])('preserves a 400 %s with diagnostics without conflict compensation or reconnect retries', async (code) => {
    const details = 'error configuration_unique (12:4): Duplicate draft slug meeting.\ntrace_id: trace-validation'
    previewMock.mockResolvedValue(preview('install'))
    installMock.mockRejectedValue(Object.assign(new Error('Configuration validation failed.'), {
      status: 400, code, trace_id: 'trace-validation',
      diagnostics: [{ code: 'configuration_unique', message: 'Duplicate draft slug meeting.', severity: 'error', line: 12, column: 4 }],
    }))
    const pending = ensureGraphSeedPack()
    await vi.waitFor(() => expect(useNotifications().currentConfirmation.value).not.toBeNull())
    resolveConfirmation(useNotifications().currentConfirmation.value!.id, true)
    await pending
    expect(previewMock).toHaveBeenCalledTimes(1)
    expect(installMock).toHaveBeenCalledTimes(1)
    expect(graphSeedPackState.value).toMatchObject({ phase: 'error', error: 'Configuration validation failed.', error_details: details })
    expect(useNotifications().items.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'graph-seed-pack', details, level: 'error' }),
      expect.objectContaining({ key: 'graph-seed-pack-task', details, level: 'error' }),
    ]))
    await ensureGraphSeedPack()
    expect(graphSeedPackState.value.phase).toBe('error')
    expect(previewMock).toHaveBeenCalledTimes(1)
    expect(installMock).toHaveBeenCalledTimes(1)
    expect(useNotifications().currentConfirmation.value).toBeNull()
  })

  it('an explicit retry gets a new preview and submits once while same-window callers share the pending attempt', async () => {
    previewMock.mockResolvedValueOnce(preview('install')).mockResolvedValueOnce(preview('install', { preview_id: 'fresh-preview' }))
    installMock.mockRejectedValueOnce(Object.assign(new Error('Configuration validation failed.'), { status: 400, code: 'configuration_invalid',
      diagnostics: [{ code: 'configuration_unique', message: 'Duplicate draft slug.', severity: 'error' }] }))
      .mockResolvedValueOnce({ status: 'installed', pack_id: GRAPH_SEED_PACK_ID, owner: 'tinadec', active_version: GRAPH_SEED_PACK_VERSION,
        integrity_digest: GRAPH_SEED_PACK_DIGEST, revision: 1, counts: { agents: 3, prompt_pipelines: 1, modes: 3 },
        installed_at: '2026-10-09T12:00:00Z', updated_at: '2026-10-09T12:00:00Z' })
    const first = ensureGraphSeedPack()
    expect(ensureGraphSeedPack()).toBe(first)
    await vi.waitFor(() => expect(useNotifications().currentConfirmation.value).not.toBeNull())
    resolveConfirmation(useNotifications().currentConfirmation.value!.id, true)
    await first
    const retry = useNotifications().items.value.find((item) => item.key === 'graph-seed-pack')!.action!.run()
    await vi.waitFor(() => expect(useNotifications().currentConfirmation.value).not.toBeNull())
    const shared = ensureGraphSeedPack({ force: true })
    resolveConfirmation(useNotifications().currentConfirmation.value!.id, true)
    await Promise.all([retry, shared])
    expect(previewMock).toHaveBeenCalledTimes(2)
    expect(installMock).toHaveBeenCalledTimes(2)
    expect(installMock.mock.calls[1]?.[1].preview_id).toBe('fresh-preview')
    expect(graphSeedPackState.value.phase).toBe('up_to_date')
    expect(graphSeedPackState.value.error_details).toBeNull()
    expect(useNotifications().items.value.find((item) => item.key === 'graph-seed-pack-task')?.details).toBeUndefined()
  })

  it('broadcasts terminal failure and keeps it in a queued window after acquiring the cross-window lock', async () => {
    let listener!: (event: MessageEvent) => void
    const messages: unknown[] = []
    class Channel {
      addEventListener(_type: string, handler: (event: MessageEvent) => void) { listener = handler }
      postMessage(message: unknown) { messages.push(message) }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', Channel)
    let enterLock!: () => Promise<void>
    const request = vi.fn((_name: string, run: () => Promise<void>) => new Promise<void>((resolve, reject) => {
      enterLock = async () => { try { await run(); resolve() } catch (error) { reject(error) } }
    }))
    vi.stubGlobal('navigator', { locks: { request } })
    const pending = ensureGraphSeedPack()
    const key = `http://gateway.test|user|${GRAPH_SEED_PACK_ID}|${GRAPH_SEED_PACK_VERSION}|${GRAPH_SEED_PACK_DIGEST}`
    listener(new MessageEvent('message', { data: { type: 'handled', key, phase: 'error', active_version: null,
      error: 'Configuration validation failed.', error_details: 'error configuration_unique: Duplicate draft slug.' } }))
    await enterLock()
    await pending
    expect(request).toHaveBeenCalledWith(expect.stringContaining(key), expect.any(Function))
    expect(previewMock).not.toHaveBeenCalled()
    expect(installMock).not.toHaveBeenCalled()
    expect(graphSeedPackState.value).toMatchObject({ phase: 'error', error: 'Configuration validation failed.' })

    previewMock.mockRejectedValue(Object.assign(new Error('Still invalid.'), { status: 400, code: 'configuration_invalid' }))
    const retry = ensureGraphSeedPack({ force: true })
    await enterLock()
    await retry
    expect(previewMock).toHaveBeenCalledTimes(1)
    expect(messages).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'handled', key, phase: 'error', error: 'Still invalid.' })]))
  })

  it('ignores other endpoint failures and does not label host authorization failures as pack-owner failures', async () => {
    let listener!: (event: MessageEvent) => void
    class Channel {
      addEventListener(_type: string, handler: (event: MessageEvent) => void) { listener = handler }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', Channel)
    let enterLock!: () => Promise<void>
    vi.stubGlobal('navigator', { locks: { request: (_name: string, run: () => Promise<void>) => new Promise<void>((resolve) => {
      enterLock = async () => { await run(); resolve() }
    }) } })
    previewMock.mockRejectedValue(Object.assign(new Error('A trusted host is required.'), { status: 403, code: 'host_authorization_required' }))
    const pending = ensureGraphSeedPack()
    listener(new MessageEvent('message', { data: { type: 'handled', key: 'another-gateway', phase: 'error', active_version: null, error: 'Other failure' } }))
    await enterLock()
    await pending
    expect(previewMock).toHaveBeenCalledTimes(1)
    expect(graphSeedPackState.value.phase).toBe('error')
    expect(graphSeedPackState.value.error).toBe('A trusted host is required.')
  })

  it('responds to a newly opened peer with the terminal failure instead of restarting installation', async () => {
    let listener!: (event: MessageEvent) => void
    const messages: unknown[] = []
    class Channel {
      addEventListener(_type: string, handler: (event: MessageEvent) => void) { listener = handler }
      postMessage(message: unknown) { messages.push(message) }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', Channel)
    previewMock.mockRejectedValue(Object.assign(new Error('Invalid configuration.'), { status: 400, code: 'configuration_invalid' }))
    await ensureGraphSeedPack()
    const failure = messages.find((message: any) => message.phase === 'error') as { key: string }
    messages.length = 0
    listener(new MessageEvent('message', { data: { type: 'state_request', key: failure.key } }))
    expect(messages).toEqual([expect.objectContaining({ type: 'handled', key: failure.key, phase: 'error', error: 'Invalid configuration.' })])
    expect(previewMock).toHaveBeenCalledTimes(1)
    expect(installMock).not.toHaveBeenCalled()
  })

  it('keeps a peer failure delivered while preview is in flight instead of overwriting it as deferred', async () => {
    let listener!: (event: MessageEvent) => void
    let key = ''
    class Channel {
      addEventListener(_type: string, handler: (event: MessageEvent) => void) { listener = handler }
      postMessage(message: { type: string; key: string }) { key = message.key }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', Channel)
    let finishPreview!: (value: AgentPackInstallPreviewDto) => void
    previewMock.mockReturnValue(new Promise((resolve) => { finishPreview = resolve }))
    const pending = ensureGraphSeedPack()
    listener(new MessageEvent('message', { data: { type: 'handled', key, phase: 'error', active_version: null,
      error: 'Peer validation failed.', error_details: 'error configuration_unique: Duplicate draft slug.' } }))
    finishPreview(preview('install'))
    await pending
    expect(graphSeedPackState.value.phase).toBe('error')
    expect(graphSeedPackState.value.error).toBe('Peer validation failed.')
    expect(useNotifications().currentConfirmation.value).toBeNull()
    expect(installMock).not.toHaveBeenCalled()
  })

  it('requires confirmation, then installs without If-Match on first install', async () => {
    previewMock.mockResolvedValue(preview('install'))
    installMock.mockResolvedValue({
      status: 'installed',
      pack_id: GRAPH_SEED_PACK_ID,
      owner: 'tinadec',
      active_version: GRAPH_SEED_PACK_VERSION,
      integrity_digest: GRAPH_SEED_PACK_DIGEST,
      revision: 1,
      counts: { agents: 3, prompt_pipelines: 1, modes: 3 },
      installed_at: '2026-08-25T12:00:00Z',
      updated_at: '2026-08-25T12:00:00Z',
    })

    const pending = ensureGraphSeedPack({ force: true })
    await vi.waitFor(() => expect(useNotifications().currentConfirmation.value).not.toBeNull())
    resolveConfirmation(useNotifications().currentConfirmation.value!.id, true)
    await pending

    expect(installMock).toHaveBeenCalledWith(
      GRAPH_SEED_PACK_ID,
      { preview_id: '7c3899a5-119d-4e40-b2a4-313a7b13fac0', envelope: graphSeedPackEnvelope },
      expect.objectContaining({ if_match: null }),
    )
    expect(graphSeedPackState.value.phase).toBe('up_to_date')
    expect(graphSeedPackState.value.active_version).toBe(GRAPH_SEED_PACK_VERSION)
  })

  it('defers a rejected upgrade and rechecks without prompting again in the same app run', async () => {
    previewMock.mockResolvedValue(preview('upgrade', { installed_version: '0.0.9', revision: 3, etag: '"3"' }))

    const first = ensureGraphSeedPack({ force: true })
    await vi.waitFor(() => expect(useNotifications().currentConfirmation.value).not.toBeNull())
    resolveConfirmation(useNotifications().currentConfirmation.value!.id, false)
    await first

    expect(graphSeedPackState.value.phase).toBe('deferred')
    expect(installMock).not.toHaveBeenCalled()
    expect(useNotifications().items.value.some((item) => item.key === 'graph-seed-pack-deferred' && item.persistence === 'sticky')).toBe(true)

    await ensureGraphSeedPack()
    expect(previewMock).toHaveBeenCalledTimes(2)
    expect(useNotifications().currentConfirmation.value).toBeNull()
  })

  it('sends the preview ETag for upgrades', async () => {
    previewMock.mockResolvedValue(preview('upgrade', { installed_version: '0.0.9', revision: 3, etag: '"3"' }))
    installMock.mockResolvedValue({
      status: 'updated',
      pack_id: GRAPH_SEED_PACK_ID,
      owner: 'tinadec',
      active_version: GRAPH_SEED_PACK_VERSION,
      integrity_digest: GRAPH_SEED_PACK_DIGEST,
      revision: 4,
      counts: { agents: 3, prompt_pipelines: 1, modes: 3 },
      installed_at: '2026-08-24T12:00:00Z',
      updated_at: '2026-08-25T12:00:00Z',
    })

    const pending = ensureGraphSeedPack({ force: true })
    await vi.waitFor(() => expect(useNotifications().currentConfirmation.value).not.toBeNull())
    resolveConfirmation(useNotifications().currentConfirmation.value!.id, true)
    await pending

    expect(installMock.mock.calls[0]?.[2].if_match).toBe('"3"')
  })

  it('treats a concurrent installation as success after a 412 re-preview', async () => {
    previewMock
      .mockResolvedValueOnce(preview('install'))
      .mockResolvedValueOnce(preview('up_to_date', { preview_id: null, installed_version: GRAPH_SEED_PACK_VERSION, revision: 1, etag: '"1"' }))
    installMock.mockRejectedValue(Object.assign(new Error('revision conflict'), { status: 412, code: 'conflict' }))

    const pending = ensureGraphSeedPack({ force: true })
    await vi.waitFor(() => expect(useNotifications().currentConfirmation.value).not.toBeNull())
    resolveConfirmation(useNotifications().currentConfirmation.value!.id, true)
    await pending

    expect(graphSeedPackState.value.phase).toBe('up_to_date')
    expect(graphSeedPackState.value.active_version).toBe(GRAPH_SEED_PACK_VERSION)
    expect(useNotifications().items.value.some((item) => item.key === 'graph-seed-pack')).toBe(false)
  })

  it('reports owner-required without prompting or attempting installation on 403', async () => {
    previewMock.mockRejectedValue(Object.assign(new Error('forbidden'), {
      status: 403,
      code: 'agent_pack_management_forbidden',
    }))

    await ensureGraphSeedPack({ force: true })

    expect(graphSeedPackState.value.phase).toBe('owner_required')
    expect(graphSeedPackState.value.error).toBe('agentPack.ownerRequiredMessage')
    expect(installMock).not.toHaveBeenCalled()
    expect(useNotifications().currentConfirmation.value).toBeNull()
    expect(useNotifications().items.value).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'graph-seed-pack',
        kind: 'status',
        level: 'warning',
        persistence: 'source',
      }),
    ]))
  })

  it.each([
    ['pack_id', { pack_id: 'another.pack' }],
    ['owner', { owner: 'another.owner' }],
    ['bundled_version', { bundled_version: '9.9.9' }],
  ])('rejects a preview with a mismatched %s before confirmation', async (_field, overrides) => {
    previewMock.mockResolvedValue(preview('install', overrides))

    await ensureGraphSeedPack({ force: true })

    expect(graphSeedPackState.value.phase).toBe('error')
    expect(graphSeedPackState.value.error).toBe('agentPack.previewIdentityMismatch')
    expect(installMock).not.toHaveBeenCalled()
    expect(useNotifications().currentConfirmation.value).toBeNull()
  })
})
