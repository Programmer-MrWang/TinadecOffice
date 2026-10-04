/**
 * The spotlight's item model and its search engine.
 *
 * `appCommands` already answers "what can I do"; the spotlight adds "what can I
 * open": pages, conversations, model providers, settings sections and workspace
 * files, grouped so the list reads as categories instead of one flat soup.
 *
 * The dynamic hosts (sessions, providers, workspace) are read-through snapshots
 * this module caches per query — the palette re-ranks on every keystroke and must
 * never fan a request out per keypress. Staleness is one opened palette long,
 * which is the price of a search that feels instant.
 */
import { api, type ModelProviderInstanceDto, type SessionDto } from '@/api'
import { scoreMatch } from '@/lib/appCommands'
import { searchedFilePaths, toWorkspaceRelative, type FileSearchDataDto } from '@/lib/workspaceSearch'

export type SpotlightKind = 'command' | 'conversation' | 'model' | 'setting' | 'resource'

export interface SpotlightItem {
  id: string
  kind: SpotlightKind
  /** The row's main text. */
  label: string
  /** The row's amber text — a route, a provider driver, a path. */
  detail?: string
  /** Extra lowercase terms the label does not already carry. */
  keywords?: string
  action(): void
}

export interface SpotlightGroup {
  kind: SpotlightKind
  items: SpotlightItem[]
}

/** Order the groups render in. Commands first: an open palette with no query is a launcher. */
export const spotlightKindOrder: readonly SpotlightKind[] = [
  'command',
  'conversation',
  'model',
  'setting',
  'resource',
]

export function spotlightKindLabel(kind: SpotlightKind): string {
  return `palette.kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
}

// ── settings sections ────────────────────────────────────────────────

/**
 * One entry per settings section the spotlight can jump to. `key` and `labelKey`
 * mirror the page's `navItems`; if the page gains a section, a row belongs here
 * too, one keystroke of the same name. The keywords are this module's own — the
 * nav has no use for search terms.
 */
export interface SettingsSectionEntry {
  key: string
  labelKey: string
  keywordKeys: string[]
}

export const settingsSections: readonly SettingsSectionEntry[] = [
  { key: 'personal', labelKey: 'settings.personal', keywordKeys: ['palette.kwPersonal'] },
  { key: 'general', labelKey: 'settings.general', keywordKeys: ['palette.kwGeneral'] },
  { key: 'model', labelKey: 'settings.model', keywordKeys: ['palette.kwModel'] },
  { key: 'agentCenter', labelKey: 'settings.agentCenter', keywordKeys: ['palette.kwAgentCenter'] },
  { key: 'tools', labelKey: 'settings.toolLayer', keywordKeys: ['palette.kwTools'] },
  { key: 'tinachat', labelKey: 'tinaChat.manage', keywordKeys: ['palette.kwTinaChat'] },
  { key: 'archive', labelKey: 'settings.archiveTrash', keywordKeys: ['palette.kwArchive'] },
  { key: 'appearance', labelKey: 'settings.appearance', keywordKeys: ['palette.kwAppearance'] },
  { key: 'pets', labelKey: 'settings.pets', keywordKeys: ['palette.kwPets'] },
  { key: 'language', labelKey: 'settings.language', keywordKeys: ['palette.kwLanguage'] },
  { key: 'apiDocs', labelKey: 'settings.apiDocs', keywordKeys: ['palette.kwApiDocs'] },
  { key: 'about', labelKey: 'settings.about', keywordKeys: ['palette.kwAbout'] },
]

// ── dynamic snapshots ────────────────────────────────────────────────

interface DynamicSnapshot {
  sessions: SessionDto[]
  providers: ModelProviderInstanceDto[]
}

let snapshot: DynamicSnapshot | null = null
let inflight: Promise<DynamicSnapshot> | null = null

/** Visible for tests. */
export function __resetSpotlightForTests(): void {
  snapshot = null
  inflight = null
}

/**
 * Sessions come from the home controller when it has them — opening the palette
 * must not block on the network for state the window already owns. Providers
 * load once per palette open (the snapshot is refreshed by `refreshSpotlight`).
 */
async function loadSnapshot(host: SpotlightHost): Promise<DynamicSnapshot> {
  if (snapshot) return snapshot
  if (inflight) return inflight
  inflight = (async () => {
    const cachedSessions = host.loadedSessions()
    const [sessions, providers] = await Promise.all([
      cachedSessions.length > 0 ? Promise.resolve(cachedSessions) : api.listSessions().catch(() => []),
      api.listModelProviders().catch(() => [] as ModelProviderInstanceDto[]),
    ])
    snapshot = { sessions, providers }
    inflight = null
    return snapshot
  })()
  return inflight
}

/** Drop the cache so the next build re-reads. The palette calls this on open. */
export function refreshSpotlight(): void {
  snapshot = null
}

// ── item builders ────────────────────────────────────────────────────

/**
 * Every host callback the spotlight's actions need, plus the two pieces of
 * already-loaded state a snapshot should reuse instead of re-fetching. The
 * palette component owns the router, the dialog and the controllers; the
 * builders stay free of all three, which is what lets a test run a conversation
 * action without mounting a window or importing a controller's import chain.
 */
export interface SpotlightHost {
  navigate(routeName: string): void
  navigateSettings(section: string): void
  openSession(sessionId: string): void
  selectProvider(providerId: string): void
  openWorkspacePath(path: string): void
  /** Sessions the window already holds; the snapshot's source of truth when non-empty. */
  loadedSessions(): SessionDto[]
  /** Workspace root for the resource leg; empty when no project is open. */
  workspaceRoot(): string
}

function conversationItems(sessions: SessionDto[], host: SpotlightHost, t: (key: string) => string): SpotlightItem[] {
  return sessions
    .filter((session) => (session.lifecycle_status ?? 'active') === 'active')
    .map((session) => ({
      id: `conversation.${session.id}`,
      kind: 'conversation' as const,
      label: session.title || t('palette.untitledSession'),
      detail: new Date(session.updated_at).toLocaleDateString(),
      keywords: '会话 对话 session conversation thread',
      action: () => host.openSession(session.id),
    }))
}

function modelItems(providers: ModelProviderInstanceDto[], host: SpotlightHost, t: (key: string) => string): SpotlightItem[] {
  return providers.map((provider) => ({
    id: `model.${provider.id}`,
    kind: 'model' as const,
    label: provider.display_name || provider.id,
    detail: [provider.driver, provider.status].filter(Boolean).join(' · '),
    keywords: t('palette.kwModelProvider'),
    action: () => host.selectProvider(provider.id),
  }))
}

function settingItems(host: SpotlightHost, t: (key: string) => string): SpotlightItem[] {
  return settingsSections.map((section) => ({
    id: `setting.${section.key}`,
    kind: 'setting' as const,
    label: t(section.labelKey),
    detail: t('palette.inSettings'),
    keywords: section.keywordKeys.map((key) => t(key)).join(' '),
    action: () => host.navigateSettings(section.key),
  }))
}

/**
 * Workspace files are demanded per query rather than held open: a large tree
 * cannot live in the snapshot, and a search that covers only already-visited
 * files is a search that lies. The 200ms debounce in the component is what
 * keeps one request per pause, not per keypress.
 */
async function workspaceItems(query: string, host: SpotlightHost): Promise<SpotlightItem[]> {
  const root = host.workspaceRoot()
  if (!root || !query.trim()) return []
  const result = await api
    .grepContent(root, query, { case_sensitive: false, max_results: 20 })
    .catch(() => null)
  // The tool already deduplicated hit files; its own map keys are the list.
  const paths = searchedFilePaths(result?.data as FileSearchDataDto | undefined, root)
  return paths.slice(0, 8).map((path) => ({
    id: `resource.${path}`,
    kind: 'resource' as const,
    label: path.split('/').pop() ?? path,
    detail: toWorkspaceRelative(path, root),
    keywords: '文件 file 资源 resource',
    action: () => host.openWorkspacePath(path),
  }))
}

// ── ranking / grouping ───────────────────────────────────────────────

interface Scored {
  item: SpotlightItem
  score: number
}

function rank(query: string, items: SpotlightItem[]): SpotlightItem[] {
  const normalized = query.trim().toLowerCase()
  const scored: Scored[] = []
  for (const item of items) {
    // Same haystack grammar appCommands uses: id + label + extras, lowercase.
    const haystack = [item.id, item.label, item.detail ?? '', item.keywords ?? '']
      .filter((part) => part.length > 0)
      .join(' ')
      .toLowerCase()
    const score = scoreMatch(normalized, haystack)
    if (score >= 0) scored.push({ item, score })
  }
  return scored
    .sort((left, right) => left.score - right.score)
    .map((entry) => entry.item)
}

/**
 * Build the grouped result set. Static rows (commands, settings) answer
 * synchronously; the dynamic kinds read the snapshot / workspace and merge in.
 * Commands arrive pre-ranked from `filterCommands` and keep that order inside
 * their group.
 */
export async function searchSpotlight(
  query: string,
  host: SpotlightHost,
  t: (key: string) => string,
  commands: SpotlightItem[],
): Promise<SpotlightGroup[]> {
  const groups = new Map<SpotlightKind, SpotlightItem[]>()
  const push = (kind: SpotlightKind, items: SpotlightItem[]) => {
    if (items.length > 0) groups.set(kind, [...(groups.get(kind) ?? []), ...items])
  }

  if (!query.trim()) {
    push('command', commands)
  } else {
    push('command', rank(query, commands))
    push('setting', rank(query, settingItems(host, t)))
  }

  const snap = await loadSnapshot(host)
  push('conversation', rank(query, snap ? conversationItems(snap.sessions, host, t) : []).slice(0, 6))
  push('model', rank(query, snap ? modelItems(snap.providers, host, t) : []))

  const resources = await workspaceItems(query, host)
  push('resource', resources)

  return spotlightKindOrder
    .filter((kind) => groups.has(kind))
    .map((kind) => ({ kind, items: groups.get(kind)! }))
}
