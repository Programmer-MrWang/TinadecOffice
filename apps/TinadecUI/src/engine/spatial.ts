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

/** Stable dependency layers; unresolved nodes stay together, not claimed to all be cyclic. */
function seedRows(seeds: SpatialSeed[]): SpatialSeed[][] {
  const sorted = [...seeds].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  if (!sorted.some(seed => seed.role)) return sorted.map(seed => [seed])
  const rows: SpatialSeed[][] = []
  const append = (layer: SpatialSeed[]) => {
    for (let i = 0; i < layer.length; i += 3) rows.push(layer.slice(i, i + 3))
  }
  append(sorted.filter(seed => seed.role === 'anchor'))
  let pending = sorted.filter(seed => seed.role === 'task')
  const placed = new Set<string>()
  while (pending.length) {
    const ready = pending.filter(seed => !seed.dependencyUnverified && (seed.dependencyIds ?? []).every(id => placed.has(id)))
    if (!ready.length) { append(pending); break }
    append(ready)
    for (const seed of ready) placed.add(seed.id)
    pending = pending.filter(seed => !placed.has(seed.id))
  }
  append(sorted.filter(seed => seed.role === 'result'))
  append(sorted.filter(seed => seed.role === 'activity' || !seed.role))
  append(sorted.filter(seed => seed.role === 'shared'))
  return rows
}

function groupOrigin(group: SpatialItem[], occupied: SpatialItem[]) {
  return group.length
    ? { x: Math.min(...group.map(item => item.x)), y: Math.min(...group.map(item => item.y)) }
    : { x: 0, y: Math.max(0, ...occupied.map(item => item.y + item.height + 80)) }
}

/** Include retained geometry without inventing its missing role/dependencies. */
function groupSeeds(items: SpatialItem[], seeds: SpatialSeed[], groupId: string): SpatialSeed[] {
  const hints = new Map(seeds.filter(seed => seed.groupId === groupId).map(seed => [seed.id, seed]))
  return items.filter(item => item.groupId === groupId).map(item => hints.get(item.id) ?? { id: item.id, groupId })
}

/** Shared initial/explicit layout. Fixed rectangles include inactive and other-group cards. */
function placeGroup(items: Record<string, SpatialItem>, seeds: SpatialSeed[], fixed: SpatialItem[], origin: { x: number; y: number }): SpatialItem[] {
  const fixedIds = new Set(fixed.map(item => item.id))
  const occupied = [...fixed]
  const placed: SpatialItem[] = []
  let y = origin.y
  // ponytail: bounded canvas-sized scans; use a spatial index only if measured large layouts need it.
  for (const row of seedRows(seeds)) {
    const peers = row.filter(seed => fixedIds.has(seed.id)).map(seed => items[seed.id])
    let x = peers.length ? Math.max(origin.x, ...peers.map(item => item.x + item.width + 32)) : origin.x
    if (peers.length) y = Math.max(y, Math.min(...peers.map(item => item.y)))
    const additions = row.filter(seed => !fixedIds.has(seed.id)).map(seed => {
      const item = { ...items[seed.id], x, y }
      x += item.width + 32
      return item
    })
    // Shift the whole row together so collision avoidance cannot mix dependency layers.
    while (additions.length) {
      const overlaps = occupied.filter(other => additions.some(item =>
        item.x < other.x + other.width + 32 && item.x + item.width + 32 > other.x &&
        item.y < other.y + other.height + 40 && item.y + item.height + 40 > other.y))
      if (!overlaps.length) break
      y = Math.max(...overlaps.map(item => item.y + item.height + 40))
      for (const item of additions) item.y = y
    }
    placed.push(...additions)
    occupied.push(...additions)
    y = Math.max(y, ...[...peers, ...additions].map(item => item.y + item.height + 40))
  }
  return placed
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
  const occupied = Object.values(items).filter(item => !added.has(item.id))
  const existingGroups = new Set(occupied.map(item => item.groupId))
  const groups = [...new Set(active.filter(seed => added.has(seed.id)).map(seed => seed.groupId))].sort()
  for (const groupId of [...groups.filter(id => existingGroups.has(id)), ...groups.filter(id => !existingGroups.has(id))]) {
    const group = occupied.filter(item => item.groupId === groupId)
    const automatic = group.filter(item => !item.manualPosition)
    const placed = placeGroup(items, groupSeeds(Object.values(items), active, groupId), occupied, groupOrigin(automatic.length ? automatic : group, occupied))
    for (const item of placed) items[item.id] = item
    occupied.push(...placed)
  }
  return changed ? { ...space, items } : space
}

/** A single spaceMove applies/undoes these positions, including manually placed group members. */
export function arrangeSpace(space: SpatialLayout, seeds: SpatialSeed[], groupId: string): SpatialChange[] {
  if (!validId(groupId)) return []
  const items = Object.values(space.items)
  const group = items.filter(item => item.groupId === groupId)
  if (!group.length) return []
  const fixed = items.filter(item => item.groupId !== groupId)
  return placeGroup(space.items, groupSeeds(items, seeds, groupId), fixed, groupOrigin(group, fixed))
    .map(({ id, x, y }) => ({ id, x, y }))
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
