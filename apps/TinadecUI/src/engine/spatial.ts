/** Session canvas geometry. Business objects remain owned by the runtime. */
export interface SpatialItem {
  id: string
  groupId: string
  x: number
  y: number
  width: number
  height: number
}
export interface SpatialLayout {
  sessionId: string
  items: Record<string, SpatialItem>
  viewport: { x: number; y: number; zoom: number }
}
export type SpatialSeed = Pick<SpatialItem, 'id' | 'groupId'>
export type SpatialChange = Pick<SpatialItem, 'id'> & Partial<Pick<SpatialItem, 'x' | 'y' | 'width' | 'height'>>
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 500 && !['__proto__', 'constructor', 'prototype'].includes(v)

export function emptySpace(sessionId: string): SpatialLayout {
  return { sessionId, items: {}, viewport: { x: 40, y: 72, zoom: 0.85 } }
}

export function repairSpace(raw: unknown): SpatialLayout | undefined {
  if (!raw || typeof raw !== 'object') return
  const s = raw as Partial<SpatialLayout>
  if (!validId(s.sessionId)) return
  const result = emptySpace(s.sessionId)
  for (const [id, value] of Object.entries(s.items ?? {}).slice(0, 3000)) {
    if (!validId(id) || !value || !validId(value.groupId) || !finite(value.x) || !finite(value.y)) continue
    result.items[id] = { id, groupId: value.groupId, x: value.x, y: value.y,
      width: finite(value.width) ? Math.max(260, Math.min(1400, value.width)) : 325,
      height: finite(value.height) ? Math.max(220, Math.min(1200, value.height)) : 400 }
  }
  const v = s.viewport
  if (v && finite(v.x) && finite(v.y) && finite(v.zoom)) result.viewport = { x: v.x, y: v.y, zoom: Math.max(0.2, Math.min(2, v.zoom)) }
  return result
}

/** Append only: runtime additions never move a user's existing objects. */
export function syncSpace(space: SpatialLayout, seeds: SpatialSeed[]): SpatialLayout {
  const items = { ...space.items }
  let changed = false
  for (const seed of seeds) {
    if (!validId(seed.id) || !validId(seed.groupId) || items[seed.id]) continue
    const all = Object.values(items)
    const group = all.filter(i => i.groupId === seed.groupId)
    const x = group.length ? Math.max(...group.map(i => i.x + i.width)) + 48 : 0
    const y = group.length ? group[0].y : (all.length ? Math.max(...all.map(i => i.y + i.height)) + 112 : 0)
    items[seed.id] = { ...seed, x, y, width: 325, height: 400 }
    changed = true
  }
  return changed ? { ...space, items } : space
}

export function moveSpace(space: SpatialLayout, changes: SpatialChange[]): SpatialLayout {
  const items = { ...space.items }
  for (const change of changes) {
    const item = items[change.id]
    if (!item) continue
    const next = { ...item }
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      const n = change[key]
      if (finite(n)) next[key] = key === 'width' ? Math.max(260, Math.min(1400, n)) : key === 'height' ? Math.max(220, Math.min(1200, n)) : n
    }
    items[item.id] = next
  }
  return { ...space, items }
}
