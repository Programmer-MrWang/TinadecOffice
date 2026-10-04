// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetSpotlightForTests,
  searchSpotlight,
  spotlightKindLabel,
  type SpotlightHost,
  type SpotlightItem,
} from './spotlight'
import en from '@/locales/en'
import zhCN from '@/locales/zh-CN'
import { api, type SessionDto } from '@/api'

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return {
    ...original,
    api: {
      ...original.api,
      listSessions: vi.fn(async () => []),
      listModelProviders: vi.fn(async () => []),
      grepContent: vi.fn(async () => ({
        tool_id: 'file_search',
        status: 'ok',
        summary: '',
        evidence: [],
        requires_approval: false,
        data: { lines: [], file_hashes: {} },
      })),
    },
  }
})

// providerTemplates pulls one `?raw` SVG import per supplier; the spotlight
// never touches that module, because its snapshot takes listModelProviders()
// rows as-is rather than re-aggregating them the way Settings does.

interface HostState {
  sessions?: SessionDto[]
  workspaceRoot?: string
}

function hostWith(state: HostState = {}): SpotlightHost & { calls: string[] } {
  const calls: string[] = []
  const record = (name: string) => (...args: unknown[]) => {
    calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(',')})`)
  }
  return {
    calls,
    navigate: record('navigate') as (routeName: string) => void,
    navigateSettings: record('navigateSettings') as (section: string) => void,
    openSession: record('openSession') as (sessionId: string) => void,
    selectProvider: record('selectProvider') as (providerId: string) => void,
    openWorkspacePath: record('openWorkspacePath') as (path: string) => void,
    loadedSessions: () => state.sessions ?? [],
    workspaceRoot: () => state.workspaceRoot ?? '',
  }
}

const t = (key: string) => key

function commandItem(id: string, label: string): SpotlightItem {
  return { id, kind: 'command', label, action: () => undefined }
}

beforeEach(() => {
  __resetSpotlightForTests()
  vi.mocked(api.listSessions).mockResolvedValue([])
  vi.mocked(api.listModelProviders).mockResolvedValue([])
  vi.mocked(api.grepContent).mockResolvedValue({
    tool_id: 'file_search',
    status: 'ok',
    summary: '',
    evidence: [],
    requires_approval: false,
    data: { lines: [], file_hashes: {} },
  })
})

describe('searchSpotlight', () => {
  it('with no query returns only the command launcher group', async () => {
    const host = hostWith()
    const groups = await searchSpotlight('', host, t, [commandItem('session.new', 'New conversation')])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.kind).toBe('command')
    expect(groups[0]!.items[0]!.label).toBe('New conversation')
  })

  it('a settings label query groups settings and skips unrelated kinds', async () => {
    const host = hostWith()
    const groups = await searchSpotlight('appearance', host, t, [])
    const kinds = groups.map((group) => group.kind)
    expect(kinds).toContain('setting')
    expect(kinds).not.toContain('command')
  })

  it('a session title query matches a conversation whose row opens that session', async () => {
    const sessions: SessionDto[] = [
      {
        id: 's-1',
        project_id: null,
        title: 'pilot launcher seams',
        status: 'idle',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      },
    ]
    const host = hostWith({ sessions })
    const groups = await searchSpotlight('launcher', host, t, [])
    const row = groups.find((group) => group.kind === 'conversation')?.items[0]
    expect(row?.label).toBe('pilot launcher seams')
    row?.action()
    expect(host.calls).toEqual(['openSession("s-1")'])
  })

  it('a provider display-name query matches a model row that selects that provider', async () => {
    vi.mocked(api.listModelProviders).mockResolvedValue([
      {
        id: 'p-9',
        driver: 'anthropic',
        protocol: null,
        channel: null,
        display_name: 'Work Claude',
        connection_kind: 'api-key',
        base_url: 'https://api.anthropic.com',
        model: 'claude-sonnet',
        has_api_key: true,
        capabilities: [],
        enabled: true,
        status: 'ready',
        status_message: 'ready',
        created_at: '',
        updated_at: '',
      },
    ])
    const host = hostWith()
    const groups = await searchSpotlight('claude', host, t, [])
    const row = groups.find((group) => group.kind === 'model')?.items[0]
    expect(row?.label).toBe('Work Claude')
    row?.action()
    expect(host.calls).toEqual(['selectProvider("p-9")'])
  })

  it('a workspace-content query surfaces files as resource rows through the code tool', async () => {
    vi.mocked(api.grepContent).mockResolvedValue({
      tool_id: 'file_search',
      status: 'ok',
      summary: '',
      evidence: [],
      requires_approval: false,
      data: {
        lines: [],
        file_hashes: { 'C:\\ws\\demo\\src\\spotlight.ts': 'x' },
      },
    })
    const host = hostWith({ workspaceRoot: 'C:/ws/demo' })
    const groups = await searchSpotlight('spotlight', host, t, [])
    const kinds = groups.map((group) => group.kind)
    expect(kinds).toContain('resource')
    const row = groups.find((group) => group.kind === 'resource')?.items[0]
    expect(row?.label).toBe('spotlight.ts')
    expect(row?.detail).toBe('src/spotlight.ts')
  })

  it('an empty keyword matches nothing rather than padding the list', async () => {
    const host = hostWith()
    const groups = await searchSpotlight('qqzzxx', host, t, [commandItem('session.new', 'New conversation')])
    expect(groups).toEqual([])
  })
})

describe('spotlight keys', () => {
  it('every kind label and every section keyword resolves in both bundles', () => {
    const bundles = [en, zhCN] as Array<Record<string, unknown>>
    const lookup = (bundle: Record<string, unknown>, dotted: string) =>
      dotted.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object') return (node as Record<string, unknown>)[part]
        return undefined
      }, bundle)
    const missing: string[] = []
    const paletteKeys = [
      'palette.kindCommand',
      'palette.kindConversation',
      'palette.kindModel',
      'palette.kindSetting',
      'palette.kindResource',
      'palette.spotlightPlaceholder',
      'palette.searching',
      'palette.untitledSession',
      'palette.inSettings',
      'palette.kwModelProvider',
      'palette.kwPersonal',
      'palette.kwGeneral',
      'palette.kwModel',
      'palette.kwAgentCenter',
      'palette.kwTools',
      'palette.kwTinaChat',
      'palette.kwArchive',
      'palette.kwAppearance',
      'palette.kwPets',
      'palette.kwLanguage',
      'palette.kwApiDocs',
      'palette.kwAbout',
    ]
    for (const key of paletteKeys) {
      for (const bundle of bundles) {
        const value = lookup(bundle, key)
        if (typeof value !== 'string' || !value.trim()) missing.push(key)
      }
    }
    expect(missing).toEqual([])
  })

  it('kind labels come from the one switch, so a new kind has one place to name itself', () => {
    expect(spotlightKindLabel('command')).toBe('palette.kindCommand')
    expect(spotlightKindLabel('resource')).toBe('palette.kindResource')
  })
})
