import type { SpatialItem, SpatialSeed } from './spatial'

/** World-space spacing shared by initial layout, insertion and explicit arrange. */
export const SPACE_LAYOUT = { columnGap: 48, rankGap: 64, groupGap: 96 } as const
export interface LayoutPoint { x: number; y: number }
export interface SpatialPlacement {
  positions: Record<string, LayoutPoint>
  ranks: Record<string, number>
  /** Missing references and cycle members are diagnostics, never fabricated tasks. */
  missing: { id: string; dependency: string }[]
  cycles: string[][]
  width: number
  height: number
}
const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
const median = (values: number[], fallback = 0) => {
  if (!values.length) return fallback
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Iterative SCC decomposition: cycles share a rank, their successors still go below. */
function components(ids: string[], next: Map<string, string[]>, prev: Map<string, string[]>) {
  const visited = new Set<string>(), order: string[] = []
  for (const id of ids) {
    if (visited.has(id)) continue
    const stack: [string, boolean][] = [[id, false]]
    while (stack.length) {
      const [node, exit] = stack.pop()!
      if (exit) { order.push(node); continue }
      if (visited.has(node)) continue
      visited.add(node); stack.push([node, true])
      for (const child of next.get(node) ?? []) if (!visited.has(child)) stack.push([child, false])
    }
  }
  visited.clear()
  const groups: string[][] = []
  for (const id of order.reverse()) {
    if (visited.has(id)) continue
    const group: string[] = [], stack = [id]
    while (stack.length) {
      const node = stack.pop()!
      if (visited.has(node)) continue
      visited.add(node); group.push(node)
      for (const parent of prev.get(node) ?? []) if (!visited.has(parent)) stack.push(parent)
    }
    groups.push(group.sort())
  }
  return groups
}

/**
 * Deterministic layered layout, independent of Vue and persistence.
 * Known edges determine longest-path ranks even when some references are missing.
 * Four median-order sweeps reduce crossings; dimensions determine spacing.
 * No fixed column wrapping: independent peers are not given false precedence.
 */
export function layoutSpatialGroup(items: Record<string, SpatialItem>, seeds: SpatialSeed[]): SpatialPlacement {
  const active = [...new Map(seeds.filter(s => items[s.id]).map(s => [s.id, s])).values()].sort(byId)
  const tasks = active.filter(s => s.role === 'task'), taskIds = new Set(tasks.map(s => s.id))
  const prev = new Map<string, string[]>(), next = new Map<string, string[]>()
  const missing: SpatialPlacement['missing'] = []
  for (const task of tasks) {
    const dependencies = [...new Set(task.dependencyIds ?? [])].sort()
    prev.set(task.id, dependencies.filter(id => taskIds.has(id)))
    for (const id of dependencies) {
      if (!taskIds.has(id)) { missing.push({ id: task.id, dependency: id }); continue }
      next.set(id, [...(next.get(id) ?? []), task.id])
    }
  }
  const groups = components(tasks.map(s => s.id), next, prev)
  const owner = new Map(groups.flatMap((group, index) => group.map(id => [id, index] as const)))
  const parents = groups.map(group => new Set(group.flatMap(id => prev.get(id) ?? []).map(id => owner.get(id)!).filter(i => i !== owner.get(group[0]))))
  const rank = new Map<number, number>()
  let pending = groups.map((_, i) => i)
  while (pending.length) {
    const ready = pending.filter(i => [...parents[i]].every(p => rank.has(p)))
    for (const i of ready) rank.set(i, Math.max(-1, ...[...parents[i]].map(p => rank.get(p)!)) + 1)
    pending = pending.filter(i => !rank.has(i))
  }
  const taskRows: SpatialSeed[][] = []
  for (const task of tasks) (taskRows[rank.get(owner.get(task.id)!)!] ??= []).push(task)
  const rowOrder = new Map<string, number>()
  taskRows.forEach(row => row.forEach((s, i) => rowOrder.set(s.id, i)))
  for (let pass = 0; pass < 4; pass++) {
    const rows = pass % 2 ? [...taskRows].reverse() : taskRows
    const neighbors = pass % 2 ? next : prev
    for (const row of rows) {
      const score = (s: SpatialSeed) => median((neighbors.get(s.id) ?? []).map(id => rowOrder.get(id)!), rowOrder.get(s.id))
      row.sort((a, b) => score(a) - score(b) || byId(a, b))
      row.forEach((s, i) => rowOrder.set(s.id, i))
    }
  }
  const rows = active.some(s => s.role) ? [
    active.filter(s => s.role === 'anchor'), ...taskRows,
    active.filter(s => s.role === 'result'), active.filter(s => s.role === 'activity' || !s.role),
    active.filter(s => s.role === 'shared'),
  ].filter(row => row.length) : active.map(s => [s])
  const rowWidth = (row: SpatialSeed[]) => row.reduce((sum, s) => sum + items[s.id].width, 0) + SPACE_LAYOUT.columnGap * (row.length - 1)
  const width = Math.max(0, ...rows.map(rowWidth))
  const positions: SpatialPlacement['positions'] = {}, ranks: SpatialPlacement['ranks'] = {}
  let y = 0
  rows.forEach((row, index) => {
    let x = (width - rowWidth(row)) / 2
    for (const seed of row) {
      positions[seed.id] = { x, y }; ranks[seed.id] = index
      x += items[seed.id].width + SPACE_LAYOUT.columnGap
    }
    y += Math.max(...row.map(s => items[s.id].height)) + SPACE_LAYOUT.rankGap
  })
  return { positions, ranks, width, height: Math.max(0, y - SPACE_LAYOUT.rankGap), missing,
    cycles: groups.filter(g => g.length > 1 || prev.get(g[0])?.includes(g[0])) }
}

export function overlapsSpatial(a: SpatialItem, b: SpatialItem) {
  return a.x < b.x + b.width + SPACE_LAYOUT.columnGap && a.x + a.width + SPACE_LAYOUT.columnGap > b.x
    && a.y < b.y + b.height + SPACE_LAYOUT.rankGap && a.y + a.height + SPACE_LAYOUT.rankGap > b.y
}

/** Closest empty rectangular slot, optionally constrained between dependency ranks. */
export function nearestSpatialSlot(item: SpatialItem, occupied: SpatialItem[], desired: LayoutPoint, minY = -Infinity, maxY = Infinity): LayoutPoint {
  const xs = new Set([desired.x]), ys = new Set([Math.max(minY, Math.min(maxY, desired.y))])
  for (const other of occupied) {
    xs.add(other.x - item.width - SPACE_LAYOUT.columnGap); xs.add(other.x + other.width + SPACE_LAYOUT.columnGap)
    ys.add(other.y - item.height - SPACE_LAYOUT.rankGap); ys.add(other.y + other.height + SPACE_LAYOUT.rankGap)
  }
  const orderedX = [...xs].sort((a, b) => Math.abs(a - desired.x) - Math.abs(b - desired.x) || a - b)
  const orderedY = [...ys].filter(y => y >= minY && y <= maxY).sort((a, b) => Math.abs(a - desired.y) - Math.abs(b - desired.y) || a - b)
  let best: LayoutPoint | undefined, distance = Infinity
  // ponytail: bounded candidate rows, with interval jumps instead of a pixel grid.
  // Each row inspects occupied rectangles; no Cartesian grid is materialized.
  for (const y of orderedY) {
    if (Math.abs(y - desired.y) > distance) break
    const obstacles = occupied.filter(o => y < o.y + o.height + SPACE_LAYOUT.rankGap && y + item.height + SPACE_LAYOUT.rankGap > o.y)
    for (const x of orderedX) {
      const cost = Math.abs(x - desired.x) + Math.abs(y - desired.y)
      if (cost >= distance) break
      if (obstacles.some(o => x < o.x + o.width + SPACE_LAYOUT.columnGap && x + item.width + SPACE_LAYOUT.columnGap > o.x)) continue
      best = { x, y }; distance = cost; break
    }
  }
  // Finite obstacles always have free space at their outer sides on the desired row.
  return best ?? { x: Math.max(desired.x, ...occupied.map(o => o.x + o.width + SPACE_LAYOUT.columnGap)), y: Math.max(minY, Math.min(maxY, desired.y)) }
}
