import { layoutSpatialGroup, nearestSpatialSlot, SPACE_LAYOUT, type LayoutPoint, type SpatialPlacement } from './spatialLayout'

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
  /** Only new role-aware seeds opt into summary cards; absence keeps legacy full content. */
  compact?: boolean
}
export interface SpatialLayout {
  sessionId: string
  items: Record<string, SpatialItem>
  viewport: { x: number; y: number; zoom: number }
}
export type SpatialSeed = Pick<SpatialItem, 'id' | 'groupId'> & {
  groupOrder?: number
  measuredHeight?: number
  role?: 'anchor' | 'task' | 'result' | 'activity' | 'shared'
  dependencyIds?: string[]
  dependencyUnverified?: boolean
}
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
      width: finite(value.width) ? Math.max(260, Math.min(1400, value.width)) : value.compact === true ? 360 : 420,
      height: finite(value.height) ? Math.max(100, Math.min(1200, value.height)) : value.compact === true ? 160 : 120,
      autoHeight: value.autoHeight ?? value.height === 400, manualPosition: value.manualPosition ?? true,
      ...(typeof value.compact === 'boolean' ? { compact: value.compact } : {}) }
  }
  const v = s.viewport
  if (v && finite(v.x) && finite(v.y) && finite(v.zoom)) result.viewport = { x: v.x, y: v.y, zoom: Math.max(0.2, Math.min(2, v.zoom)) }
  return result
}

const middle = (values: number[], fallback: number) => {
  if (!values.length) return fallback
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function activeSeeds(items: Record<string, SpatialItem>, seeds: SpatialSeed[]) {
  return [...new Map(seeds.filter(s => validId(s.id) && validId(s.groupId) && items[s.id]).map(s => [s.id, s])).values()]
}

/** Anchor placement keeps a distant manually moved peer from pulling a whole group away. */
function groupOrigin(group: SpatialSeed[], items: Record<string, SpatialItem>, plan: SpatialPlacement): LayoutPoint {
  const anchor = group.find(s => s.role === 'anchor' && items[s.id])
  if (anchor) return { x: items[anchor.id].x - plan.positions[anchor.id].x, y: items[anchor.id].y - plan.positions[anchor.id].y }
  const candidates = group.filter(s => items[s.id] && !items[s.id].manualPosition)
  const placed = candidates.length ? candidates : group.filter(s => items[s.id])
  return {
    x: middle(placed.map(s => items[s.id].x - plan.positions[s.id].x), 0),
    y: middle(placed.map(s => items[s.id].y - plan.positions[s.id].y), 0),
  }
}

/** Only new IDs are placed. Measurements may change height, never existing coordinates. */
export function syncSpace(space: SpatialLayout, seeds: SpatialSeed[]): SpatialLayout {
  const items = { ...space.items }
  let changed = false
  const active = [...new Map(seeds.filter(seed => validId(seed.id) && validId(seed.groupId)).map(seed => [seed.id, seed])).values()]
  const added = new Set<string>()
  for (const seed of active) {
    const previous = items[seed.id]
    const item: SpatialItem = previous ? { ...previous, groupId: seed.groupId } : {
      id: seed.id, groupId: seed.groupId, x: 0, y: 0,
      width: seed.role ? 360 : 420, height: seed.role ? 160 : 120,
      autoHeight: true, manualPosition: false, ...(seed.role ? { compact: true } : {}),
    }
    if (!previous) added.add(seed.id)
    if (item.autoHeight && finite(seed.measuredHeight)) item.height = Math.max(100, Math.min(1200, seed.measuredHeight))
    if (!previous || Object.keys(item).some(key => item[key as keyof SpatialItem] !== previous[key as keyof SpatialItem])) {
      items[item.id] = item
      changed = true
    }
  }
  // Retain inactive IDs for restore, but they cannot inflate current layout bounds.
  const occupied = active.filter(s => !added.has(s.id)).map(s => items[s.id])
  const groups = [...new Set(active.filter(s => added.has(s.id)).map(s => s.groupId))].sort((a, b) =>
    Math.min(...active.filter(s => s.groupId === a).map(s => s.groupOrder ?? 1)) - Math.min(...active.filter(s => s.groupId === b).map(s => s.groupOrder ?? 1)) || a.localeCompare(b))
  for (const groupId of groups) {
    const group = active.filter(s => s.groupId === groupId)
    const plan = layoutSpatialGroup(items, group)
    const existing = group.filter(s => !added.has(s.id))
    if (!existing.length) {
      const automatic = occupied.filter(i => !i.manualPosition)
      const desired = { x: 0, y: Math.max(0, ...automatic.map(i => i.y + i.height + SPACE_LAYOUT.groupGap)) }
      const bounds: SpatialItem = { id: groupId, groupId, ...desired, width: plan.width, height: plan.height }
      const origin = nearestSpatialSlot(bounds, occupied, desired)
      for (const seed of group) {
        const point = plan.positions[seed.id]
        items[seed.id] = { ...items[seed.id], x: origin.x + point.x, y: origin.y + point.y }
        occupied.push(items[seed.id])
      }
      continue
    }
    const origin = groupOrigin(existing, items, plan)
    const newcomers = group.filter(s => added.has(s.id)).sort((a, b) => plan.ranks[a.id] - plan.ranks[b.id] || a.id.localeCompare(b.id))
    for (const seed of newcomers) {
      const item = items[seed.id], ideal = plan.positions[seed.id]
      const placed = new Set(occupied.map(i => i.id))
      const peers = group.filter(s => placed.has(s.id) && !items[s.id].manualPosition && plan.ranks[s.id] === plan.ranks[seed.id]).map(s => items[s.id])
      const parents = (seed.dependencyIds ?? []).filter(id => placed.has(id) && items[id].groupId === groupId).map(id => items[id])
      const children = group.filter(s => placed.has(s.id) && s.dependencyIds?.includes(seed.id)).map(s => items[s.id])
      const neighbors = [...parents, ...children].filter(i => !i.manualPosition)
      const desired = {
        x: middle(neighbors.map(i => i.x + i.width / 2 - item.width / 2), middle(peers.map(i => i.x), origin.x + ideal.x)),
        y: middle(peers.map(i => i.y), origin.y + ideal.y),
      }
      const minY = Math.max(-Infinity, ...parents.map(i => i.y + i.height + SPACE_LAYOUT.rankGap))
      const maxY = Math.min(Infinity, ...children.map(i => i.y - item.height - SPACE_LAYOUT.rankGap))
      // If old positions leave no legal rank interval, preserve them; route as a
      // side/feedback connection until the user explicitly arranges this goal.
      const peerRow = peers.length && desired.y >= minY && desired.y <= maxY
      const point = peerRow ? nearestSpatialSlot(item, occupied, desired, desired.y, desired.y)
        : minY <= maxY ? nearestSpatialSlot(item, occupied, desired, minY, maxY)
        : nearestSpatialSlot(item, occupied, desired)
      items[seed.id] = { ...item, ...point }
      occupied.push(items[seed.id])
    }
  }
  return changed ? { ...space, items } : space
}

/** A single spaceMove applies/undoes these positions, including manually placed group members. */
export function arrangeSpace(space: SpatialLayout, seeds: SpatialSeed[], groupId: string): SpatialChange[] {
  if (!validId(groupId)) return []
  const active = activeSeeds(space.items, seeds)
  const group = active.filter(s => s.groupId === groupId)
  if (!group.length) return []
  const plan = layoutSpatialGroup(space.items, group)
  const fixed = active.filter(s => s.groupId !== groupId).map(s => space.items[s.id])
  const desired = groupOrigin(group, space.items, plan)
  const bounds: SpatialItem = { id: groupId, groupId, ...desired, width: plan.width, height: plan.height }
  const origin = nearestSpatialSlot(bounds, fixed, desired)
  return group.map(({ id }) => ({ id, x: origin.x + plan.positions[id].x, y: origin.y + plan.positions[id].y }))
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
