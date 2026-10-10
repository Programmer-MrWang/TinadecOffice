import { assertHostAccess } from './hostAccess'
/** Scope identity is captured before I/O. A later project selection cannot retarget it. */
import { ref } from 'vue'
export interface StorageRequestOptions extends RequestInit { storageId?: string }
const projects = new Map<string, Set<string>>()
const sessions = new Map<string, Set<string>>()
const runs = new Map<string, Set<string>>()
export const selectedStorage = ref('user')
let callStorage: string | undefined
export function setSelectedStorage(storageId: string) { selectedStorage.value = storageId }
export function selectedStorageId() { return selectedStorage.value }
function register(map: Map<string, Set<string>>, id: string, scope: string) { const scopes = map.get(id) ?? new Set<string>(); scopes.add(scope); map.set(id, scopes) }
export function selectionKey(row: { id: string; storage_id?: unknown }) { return typeof row.storage_id === 'string' && row.storage_id ? `${row.storage_id}::${row.id}` : row.id }
export function selectionIdentity(value: string) { const split = value.indexOf('::'); return split < 0 ? { id: value, storageId: undefined } : { id: value.slice(split + 2), storageId: value.slice(0, split) } }
function resolve(map: Map<string, Set<string>>, value: string, fallback: string) {
  const identity = selectionIdentity(value)
  if (identity.storageId) return identity.storageId
  const candidates = map.get(identity.id)
  return candidates?.has(selectedStorage.value) ? selectedStorage.value : candidates?.values().next().value ?? fallback
}
export function registerProjectStorage(projectId: string, storageId: string) { register(projects, projectId, storageId) }
export function projectStorageId(projectId?: string | null) { return projectId ? resolve(projects, projectId, selectedStorage.value) : 'user' }
export function registerSessionStorage(sessionId: string, storageId: string) { register(sessions, sessionId, storageId) }
export function sessionStorageId(sessionId?: string | null) { return sessionId ? resolve(sessions, sessionId, selectedStorage.value) : selectedStorage.value }
export function runStorageId(runId: string) { return resolve(runs, runId, selectedStorage.value) }

/** Composite UI keys never enter Core's product identifiers. */
export function normalizeStorageRequest(path: string, options?: StorageRequestOptions) {
  const url = new URL(path, 'http://tinadec.local')
  url.pathname = url.pathname.split('/').map(part => {
    const identity = selectionIdentity(decodeURIComponent(part))
    return identity.storageId ? encodeURIComponent(identity.id) : part
  }).join('/')
  for (const [key, value] of url.searchParams) if (key.endsWith('_id') && selectionIdentity(value).storageId) url.searchParams.set(key, selectionIdentity(value).id)
  let body = options?.body
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body)
      for (const key of ['project_id', 'session_id', 'run_id']) if (typeof parsed[key] === 'string') parsed[key] = selectionIdentity(parsed[key]).id
      body = JSON.stringify(parsed)
    } catch { /* plain request text */ }
  }
  return { path: url.pathname + url.search, body }
}

export function captureStorageId(path: string, options?: StorageRequestOptions): string {
  if (options?.storageId) return options.storageId
  if (callStorage) return callStorage
  const url = new URL(path, 'http://tinadec.local')
  const projectId = url.searchParams.get('project_id')
  if (projectId) return projectStorageId(projectId)
  const querySession = url.searchParams.get('session_id')
  if (querySession) return sessionStorageId(querySession)
  const queryRun = url.searchParams.get('run_id')
  if (queryRun) return runStorageId(queryRun)
  const pathProjectId = path.match(/^\/api\/v1\/projects\/([^/?]+)/)?.[1]
  if (pathProjectId) return projectStorageId(decodeURIComponent(pathProjectId))
  const sessionId = path.match(/^\/api\/v1\/sessions\/([^/?]+)/)?.[1]
  if (sessionId) return sessionStorageId(decodeURIComponent(sessionId))
  const runId = path.match(/^\/api\/v1\/runs\/([^/?]+)/)?.[1]
  if (runId) return runStorageId(decodeURIComponent(runId))
  if (typeof options?.body === 'string') {
    try {
      const body = JSON.parse(options.body)
      if (body.project_id) return projectStorageId(body.project_id)
      if (body.session_id) return sessionStorageId(body.session_id)
      if (body.run_id) return runStorageId(body.run_id)
    } catch { /* non JSON payload */ }
  }
  // Unbound rosters default to user; explicit bindings and entity identities always win.
  if (/^\/api\/v1\/(storage\/|projects(?:\?|$)|sessions(?:\?|$))/.test(path) && (!options?.method || options.method === 'GET')) return 'user'
  return selectedStorage.value
}
export function storageHeaders(path: string, options?: StorageRequestOptions): Headers {
  const headers = new Headers(options?.headers)
  headers.set('x-tinadec-storage-id', captureStorageId(path, options))
  return headers
}
export async function storageFetch(input: RequestInfo | URL, options?: StorageRequestOptions): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://tinadec.local')
  const headers = storageHeaders(url.pathname + url.search, options)
  await assertHostAccess(url.pathname + url.search, options?.signal ?? undefined)
  return fetch(input, { ...options, headers })
}
export function rememberStorageResult(path: string, data: unknown, storageId: string) {
  for (const item of Array.isArray(data) ? data : [data]) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const scope = typeof row.storage_id === 'string' ? row.storage_id : storageId
    if (typeof row.project_id === 'string' && typeof row.storage_id === 'string') registerProjectStorage(row.project_id, scope)
    if (typeof row.id === 'string') {
      if (path.startsWith('/api/v1/projects')) registerProjectStorage(row.id, scope)
      else if (path.startsWith('/api/v1/sessions') && !path.includes('/interactions')) registerSessionStorage(row.id, scope)
      else if (path.startsWith('/api/v1/runs')) register(runs, row.id, scope)
    }
    if (typeof row.run_id === 'string') register(runs, row.run_id, scope)
  }
}

/** Wrappers capture the scope at call time; request builders consume it synchronously. */
export function scopedApi<T extends object>(api: T, getStorage: () => string): T {
  return new Proxy(api, { get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver)
    if (typeof value !== 'function') return value
    return (...args: unknown[]) => {
      const previous = callStorage
      callStorage = getStorage()
      try { return Reflect.apply(value, target, args) } finally { callStorage = previous }
    }
  } })
}
