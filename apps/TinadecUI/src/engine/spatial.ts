/** Session canvas geometry. Business objects remain owned by the runtime. */
export interface SpatialItem {
  id: string
  groupId: string
  x: number
  y: number
  width: number
  height: number
  autoHeight?: boolean
  manualPosition?: boolean
}
export interface SpatialLayout {
  sessionId: string
  items: Record<string, SpatialItem>
  viewport: { x: number; y: number; zoom: number }
}
export type SpatialSeed = Pick<SpatialItem, 'id' | 'groupId'> & { measuredHeight?: number }
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
      width: finite(value.width) ? Math.max(260, Math.min(1400, value.width)) : 420,
      height: finite(value.height) ? Math.max(100, Math.min(1200, value.height)) : 120,
      autoHeight: value.autoHeight ?? value.height === 400, manualPosition: value.manualPosition ?? true }
  }
  const v = s.viewport
  if (v && finite(v.x) && finite(v.y) && finite(v.zoom)) result.viewport = { x: v.x, y: v.y, zoom: Math.max(0.2, Math.min(2, v.zoom)) }
  return result
}

/** Content-driven vertical flow. Explicit user positions and sizes remain authoritative. */
export function syncSpace(space: SpatialLayout, seeds: SpatialSeed[]): SpatialLayout {
  const items = { ...space.items }
  let bottom = 0
  let changed = false
  const active = seeds.filter(seed => validId(seed.id) && validId(seed.groupId))
  const manual = active.map(seed => items[seed.id]).filter(i => i?.manualPosition)
  for (const seed of active) {
    const previous = items[seed.id]
    const item: SpatialItem = previous ? { ...previous, groupId: seed.groupId } : {
      id: seed.id, groupId: seed.groupId, x: 0, y: bottom, width: 420, height: 120, autoHeight: true, manualPosition: false,
    }
    if (item.autoHeight && finite(seed.measuredHeight)) item.height = Math.max(100, Math.min(1200, seed.measuredHeight))
    if (!item.manualPosition) {
      item.y = bottom
      let overlap = manual.filter(i => item.x < i.x + i.width + 24 && item.x + item.width + 24 > i.x && item.y < i.y + i.height + 32 && item.y + item.height + 32 > i.y)
      while (overlap.length) {
        item.y = Math.max(...overlap.map(i => i.y + i.height)) + 32
        overlap = manual.filter(i => item.x < i.x + i.width + 24 && item.x + item.width + 24 > i.x && item.y < i.y + i.height + 32 && item.y + item.height + 32 > i.y)
      }
    }
    bottom = Math.max(bottom, item.y + item.height + 40)
    if (!previous || Object.keys(item).some(key => item[key as keyof SpatialItem] !== previous[key as keyof SpatialItem])) {
      items[item.id] = item
      changed = true
    }
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
      if (finite(n)) next[key] = key === 'width' ? Math.max(260, Math.min(1400, n)) : key === 'height' ? Math.max(100, Math.min(1200, n)) : n
    }
    if (finite(change.x) || finite(change.y)) next.manualPosition = true
    if (finite(change.height)) next.autoHeight = false
    items[item.id] = next
  }
  return { ...space, items }
}
