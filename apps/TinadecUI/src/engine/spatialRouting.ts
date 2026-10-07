import type { SpatialItem } from './spatial'

export interface SpatialEdge { id: string; source: string; target: string }
export interface SpatialPoint { x: number; y: number }
export type SpatialSide = 'top' | 'bottom' | 'left' | 'right'
export interface SpatialRoute extends SpatialEdge {
  points: SpatialPoint[]
  path: string
  labelX: number
  labelY: number
  sourceSide: SpatialSide
  targetSide: SpatialSide
  kind: 'forward' | 'feedback' | 'blocked'
  reason?: 'missing-endpoint' | 'invalid-geometry' | 'overlapping-endpoints' | 'no-clear-route'
}

type Rect = SpatialItem & { right: number; bottom: number; cx: number; cy: number }
type Candidate = Pick<SpatialRoute, 'points' | 'sourceSide' | 'targetSide'>
const CLEARANCE = 12
const LANE_GAP = 6
const LIMIT = 12
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const axisKey = (a: SpatialPoint, b: SpatialPoint) => a.x === b.x ? `x:${a.x}` : `y:${a.y}`
const distance = (a: SpatialPoint, b: SpatialPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

function compact(points: SpatialPoint[]): SpatialPoint[] {
  const result: SpatialPoint[] = []
  for (const point of points) {
    if (result.length && distance(result[result.length - 1], point) === 0) continue
    while (result.length > 1) {
      const a = result[result.length - 2], b = result[result.length - 1]
      if (a.x === b.x && b.x === point.x || a.y === b.y && b.y === point.y) result.pop()
      else break
    }
    result.push(point)
  }
  return result
}

function blocked(edge: SpatialEdge, reason: NonNullable<SpatialRoute['reason']>): SpatialRoute {
  return { ...edge, points: [], path: '', labelX: 0, labelY: 0, sourceSide: 'bottom', targetSide: 'top', kind: 'blocked', reason }
}

/** Own boundaries are ports; every other rectangle, including its outline, is an obstacle. */
function intersects(a: SpatialPoint, b: SpatialPoint, box: Rect, own: boolean): boolean {
  const pad = own ? 0 : 0.001
  return a.x === b.x
    ? a.x > box.x - pad && a.x < box.right + pad && Math.max(a.y, b.y) > box.y - pad && Math.min(a.y, b.y) < box.bottom + pad
    : a.y > box.y - pad && a.y < box.bottom + pad && Math.max(a.x, b.x) > box.x - pad && Math.min(a.x, b.x) < box.right + pad
}

function clear(points: SpatialPoint[], boxes: Rect[], edge: SpatialEdge): boolean {
  return points.length > 1 && points.slice(1).every((point, i) =>
    boxes.every(box => !intersects(points[i], point, box, box.id === edge.source || box.id === edge.target)))
}

function nearby(values: number[], preferred: number, limit = LIMIT): number[] {
  return [...new Set(values)].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b).slice(0, limit)
}

function port(box: Rect, side: SpatialSide): SpatialPoint {
  if (side === 'left' || side === 'right') return { x: side === 'left' ? box.x : box.right, y: box.cy }
  return { x: box.cx, y: side === 'top' ? box.y : box.bottom }
}

/**
 * Deterministic bounded orthogonal routing, independent of the renderer's handle/stub geometry.
 * At most 180 candidates per edge, each with at most five segments. O(E log E + E * N log N), O(N + E)
 * space (apart from output); lane counts are constant-time lookups, not pairwise edge scans.
 * ponytail: deliberately no general maze solver. Interlocked manual rectangles may have a path
 * beyond these candidates; report blocked instead of drawing a line through a work card.
 */
export function routeSpatialEdges(items: SpatialItem[], edges: SpatialEdge[]): SpatialRoute[] {
  const boxes: Rect[] = items.map(item => ({ ...item, right: item.x + item.width, bottom: item.y + item.height,
    cx: item.x + item.width / 2, cy: item.y + item.height / 2 })).sort((a, b) => compare(a.id, b.id))
  const byId = new Map(boxes.map(box => [box.id, box]))
  const invalid = byId.size !== boxes.length || boxes.some(box => box.width <= 0 || box.height <= 0
    || ![box.x, box.y, box.right, box.bottom, box.cx, box.cy].every(Number.isFinite))
  const outerLeft = Math.min(...boxes.map(box => box.x)) - CLEARANCE
  const outerRight = Math.max(...boxes.map(box => box.right)) + CLEARANCE
  const xCoordinates = [...new Set(boxes.flatMap(box => [box.x - CLEARANCE, box.right + CLEARANCE]))]
  const yCoordinates = [...new Set(boxes.flatMap(box => [box.y - CLEARANCE, box.bottom + CLEARANCE]))]
  const lanes = new Map<string, number>()
  const freeLane = (axis: 'x' | 'y', coordinate: number, direction: number) => {
    for (let offset = 0; offset < 8; offset++) {
      const candidate = coordinate + direction * LANE_GAP * offset
      if (!lanes.has(`${axis}:${candidate}`)) return candidate
    }
    return coordinate
  }
  const routes: SpatialRoute[] = []
  // Stable edge ordering also makes lane allocation independent of event arrival order.
  for (const edge of [...edges].sort((a, b) => compare(a.id, b.id) || compare(a.source, b.source) || compare(a.target, b.target))) {
    if (invalid) { routes.push(blocked(edge, 'invalid-geometry')); continue }
    const source = byId.get(edge.source), target = byId.get(edge.target)
    if (!source || !target) { routes.push(blocked(edge, 'missing-endpoint')); continue }
    if (source.x < target.right && source.right > target.x && source.y < target.bottom && source.bottom > target.y) {
      routes.push(blocked(edge, 'overlapping-endpoints')); continue
    }
    const forward = source.bottom <= target.y
    // All candidates stay within these vertical bounds (including the sideways fallback).
    // Keep tall boxes crossing the strip; scanning unrelated rows for every candidate is wasteful.
    const top = Math.min(source.y, target.y), bottom = Math.max(source.bottom, target.bottom)
    const obstacles = boxes.filter(box => box.bottom >= top && box.y <= bottom)
    let best: Candidate | undefined
    let bestScore = Infinity
    const consider = (points: SpatialPoint[], sourceSide: SpatialSide, targetSide: SpatialSide) => {
      const path = compact(points)
      if (forward && path.some((point, i) => i > 0 && point.y < path[i - 1].y)) return
      const score = path.slice(1).reduce((sum, point, i) => sum + distance(path[i], point)
        + (i > 0 && i < path.length - 2 ? (lanes.get(axisKey(path[i], point)) ?? 0) * 24 : 0), 0)
        + (path.length - 2) * 24
      if (score >= bestScore || !clear(path, obstacles, edge)) return
      best = { points: path, sourceSide, targetSide }; bestScore = score
    }
    let cachedCorridors: number[] | undefined
    const corridors = () => {
      if (cachedCorridors) return cachedCorridors
      const preferredX = (source.cx + target.cx) / 2
      const xs = nearby(xCoordinates, preferredX, LIMIT - 2)
      xs.push(outerLeft, outerRight)
      // Reused corridors get another lane; retain originals in case the new lane is obstructed.
      return cachedCorridors = [...new Set(xs.flatMap(x => [x, freeLane('x', x, x < preferredX ? -1 : 1)]))]
    }

    if (forward) {
      const start = port(source, 'bottom'), end = port(target, 'top')
      const midY = (start.y + end.y) / 2
      if (start.x === end.x) consider([start, end], 'bottom', 'top')
      if (!best && start.x !== end.x) {
        const ys = nearby([midY, freeLane('y', midY, -1), freeLane('y', midY, 1), ...yCoordinates]
          .filter(y => y >= start.y && y <= end.y), midY)
        for (const y of ys) consider([start, { x: start.x, y }, { x: end.x, y }, end], 'bottom', 'top')
      }
      // Escape/arrival strips come from the actual free vertical rays, so an 8px gap needs no 20px stub.
      if (!best) {
        let exitLimit = end.y, entryLimit = start.y
        for (const box of obstacles) {
          if (box.id === source.id || box.id === target.id) continue
          if (start.x >= box.x && start.x <= box.right && box.bottom > start.y) exitLimit = Math.min(exitLimit, Math.max(start.y, box.y))
          if (end.x >= box.x && end.x <= box.right && box.y < end.y) entryLimit = Math.max(entryLimit, Math.min(end.y, box.bottom))
        }
        const exitYs = [...new Set([start.y + Math.min(CLEARANCE, (exitLimit - start.y) / 2), (start.y + exitLimit) / 2])]
        const entryYs = [...new Set([end.y - Math.min(CLEARANCE, (end.y - entryLimit) / 2), (end.y + entryLimit) / 2])]
        for (const x of corridors()) for (const y1 of exitYs) for (const y2 of entryYs) {
          if (y1 > y2) continue
          consider([start, { x: start.x, y: y1 }, { x, y: y1 }, { x, y: y2 }, { x: end.x, y: y2 }, end], 'bottom', 'top')
        }
      }
    }
    if (!forward && source.cy === target.cy) {
      if (source.right <= target.x) consider([port(source, 'right'), port(target, 'left')], 'right', 'left')
      else if (target.right <= source.x) consider([port(source, 'left'), port(target, 'right')], 'left', 'right')
    }
    // Same-level/backward edges leave sideways. This is also the bounded fallback when a forward
    // endpoint's bottom/top is obstructed; it never adds an initial downward-then-upward hairpin.
    if (!best) {
      for (const side of ['left', 'right'] as const) {
        const start = port(source, side), end = port(target, side)
        for (const x of corridors()) {
          if (side === 'left' ? x >= Math.min(source.x, target.x) : x <= Math.max(source.right, target.right)) continue
          consider([start, { x, y: start.y }, { x, y: end.y }, end], side, side)
        }
      }
      const rightward = source.right <= target.x
      const leftward = target.right <= source.x
      if (rightward || leftward) {
        const sourceSide = rightward ? 'right' : 'left', targetSide = rightward ? 'left' : 'right'
        const start = port(source, sourceSide), end = port(target, targetSide)
        const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x)
        for (const x of nearby([(start.x + end.x) / 2, ...corridors()].filter(x => x >= minX && x <= maxX), (minX + maxX) / 2)) {
          consider([start, { x, y: start.y }, { x, y: end.y }, end], sourceSide, targetSide)
        }
      }
    }
    if (!best) { routes.push(blocked(edge, 'no-clear-route')); continue }
    const chosen = best as Candidate
    let label = chosen.points[0], longest = -1
    for (let i = 1; i < chosen.points.length; i++) {
      const a = chosen.points[i - 1], b = chosen.points[i]
      const length = distance(a, b)
      if (length > longest) { longest = length; label = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
      if (i > 1 && i < chosen.points.length - 1) {
        const key = axisKey(a, b)
        lanes.set(key, (lanes.get(key) ?? 0) + 1)
      }
    }
    routes.push({ ...edge, ...chosen, path: chosen.points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '),
      labelX: label.x, labelY: label.y, kind: forward ? 'forward' : 'feedback' })
  }
  return routes
}
