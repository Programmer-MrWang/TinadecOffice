import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { SessionDto } from '@/api'
import { selectionKey } from '@/lib/storageScope'

export const freeWorkspaceKey = 'user::free'
export const workspaceListStorageKey = 'tinadec.sidebar.workspaces.v1'
const revealEvent = 'tinadec:workspace-reveal'
export function revealWorkspace(key: string) { window.dispatchEvent(new CustomEvent(revealEvent, { detail: key })) }
interface ListState { collapsed: boolean; collapsedKeys: string[]; allKeys: string[]; order: string[] }
const defaults = (): ListState => ({ collapsed: false, collapsedKeys: [], allKeys: [], order: [] })
function read(): ListState {
  try {
    const value = JSON.parse(localStorage.getItem(workspaceListStorageKey) ?? 'null')
    if (!value || typeof value !== 'object') return defaults()
    return { collapsed: value.collapsed === true, ...Object.fromEntries(['collapsedKeys', 'allKeys', 'order'].map(key => [key, Array.isArray(value[key]) ? [...new Set(value[key].filter((item: unknown) => typeof item === 'string'))] : []])) } as ListState
  } catch { return defaults() }
}
export function recentWorkspaceSessions(rows: SessionDto[], selectedKey: string | null, all = false) {
  const sorted = [...rows].sort((a, b) => Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at) || a.id.localeCompare(b.id))
  if (all) return sorted
  const visible = sorted.slice(0, 5)
  const active = sorted.find(row => selectionKey(row) === selectedKey)
  if (active && !visible.includes(active)) visible.push(active)
  return visible
}
export function useWorkspaceList() {
  const state = ref(read())
  const stop = watch(state, value => { try { localStorage.setItem(workspaceListStorageKey, JSON.stringify(value)) } catch { /* Host may refuse local state; interaction remains usable. */ } }, { deep: true, flush: 'sync' })
  function storage(event: StorageEvent) { if (event.key === workspaceListStorageKey) state.value = read() }
  function reveal(event: Event) { const key = (event as CustomEvent<string>).detail; state.value.collapsed = false; state.value.collapsedKeys = state.value.collapsedKeys.filter(value => value !== key) }
  onMounted(() => { window.addEventListener('storage', storage); window.addEventListener(revealEvent, reveal) })
  onUnmounted(() => { stop(); window.removeEventListener('storage', storage); window.removeEventListener(revealEvent, reveal) })
  function reconcile(keys: string[]) {
    if (keys.length === 0) return
    const previous = state.value.order
    const fresh = keys.filter(key => !previous.includes(key))
    state.value.order = [...fresh, ...previous.filter(key => keys.includes(key))]
  }
  function toggle(key: string, field: 'collapsedKeys' | 'allKeys') {
    const values = state.value[field]
    state.value[field] = values.includes(key) ? values.filter(value => value !== key) : [...values, key]
  }
  function move(key: string, before: string) {
    if (key === before || !state.value.order.includes(before)) return
    const order = state.value.order.filter(item => item !== key)
    order.splice(order.indexOf(before), 0, key); state.value.order = order
  }
  function step(key: string, direction: -1 | 1) {
    const order = [...state.value.order], index = order.indexOf(key), target = index + direction
    if (index < 0 || target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target]!, order[index]!]; state.value.order = order
  }
  return { state, reconcile, toggle, move, step }
}
