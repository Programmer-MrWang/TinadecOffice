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
