import { describe, expect, it } from 'vitest'
import type { SpatialItem } from './spatial'
import { routeSpatialEdges, type SpatialEdge, type SpatialRoute } from './spatialRouting'

const box = (id: string, x: number, y: number, width = 100, height = 60): SpatialItem => ({ id, groupId: 'run', x, y, width, height })
const edge = (source = 'a', target = 'b', id = `${source}:${target}`): SpatialEdge => ({ id, source, target })

function expectClear(route: SpatialRoute, items: SpatialItem[]) {
  expect(route.kind).not.toBe('blocked')
  expect(route.points.length).toBeGreaterThan(1)
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i]
    expect(a.x === b.x || a.y === b.y).toBe(true)
    for (const item of items) {
      if (a.x === b.x) {
        if (a.x <= item.x || a.x >= item.x + item.width) continue
        expect(Math.max(a.y, b.y) <= item.y || Math.min(a.y, b.y) >= item.y + item.height, `${route.id} crosses ${item.id}`).toBe(true)
      } else {
        if (a.y <= item.y || a.y >= item.y + item.height) continue
        expect(Math.max(a.x, b.x) <= item.x || Math.min(a.x, b.x) >= item.x + item.width, `${route.id} crosses ${item.id}`).toBe(true)
      }
    }
    if (route.kind === 'forward') expect(b.y).toBeGreaterThanOrEqual(a.y)
  }
}

describe('routeSpatialEdges', () => {
  it.each([8, 34, 80])('connects aligned cards across a %ipx gap with one straight segment', gap => {
    const items = [box('a', 0, 0), box('b', 0, 60 + gap)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.points).toEqual([{ x: 50, y: 60 }, { x: 50, y: 60 + gap }])
    expect(route.sourceSide).toBe('bottom')
    expect(route.targetSide).toBe('top')
    expect(route.labelX).toBe(50)
    expect(route.labelY).toBe(60 + gap / 2)
    expectClear(route, items)
  })

  it.each([8, 34])('never reverses downward flow when a branch has only a %ipx gap', gap => {
    const items = [box('a', 0, 0), box('b', 140, 60 + gap)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.points).toHaveLength(4)
    expect(route.points[1].y).toBeGreaterThan(60)
    expect(route.points[2].y).toBeLessThan(60 + gap)
    expectClear(route, items)
  })

  it('branches from a parent without routing through either sibling', () => {
    const items = [box('a', 100, 0), box('b', 0, 100), box('c', 200, 100)]
    const routes = routeSpatialEdges(items, [edge(), edge('a', 'c')])
    for (const route of routes) {
      expect(route.points.length).toBeLessThanOrEqual(4)
      expectClear(route, items)
    }
    // Separate horizontal lanes keep independent branches readable.
    expect(routes[0].points[1].y).not.toBe(routes[1].points[1].y)
  })

  it('bypasses an intervening layer through a side corridor, with no upward segments', () => {
    const items = [box('a', 0, 0), box('middle', -30, 100, 160, 80), box('b', 0, 220)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.kind).toBe('forward')
    expect(route.points).toHaveLength(6)
    expect(route.points.some(point => point.x < -30 || point.x > 130)).toBe(true)
    expectClear(route, items)
  })

  it('assigns separate vertical corridors to several bypass edges', () => {
    const items = [box('a', 0, 0), box('middle', -30, 100, 160, 80), box('b', 0, 220)]
    const routes = routeSpatialEdges(items, [edge('a', 'b', '1'), edge('a', 'b', '2'), edge('a', 'b', '3')])
    for (const route of routes) expectClear(route, items)
    expect(new Set(routes.map(route => route.points[2].x)).size).toBe(3)
  })

  it('uses facing side ports for cards on the same row', () => {
    const items = [box('a', 0, 0), box('b', 180, 0)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.kind).toBe('feedback')
    expect(route.sourceSide).toBe('right')
    expect(route.targetSide).toBe('left')
    expect(route.points).toEqual([{ x: 100, y: 30 }, { x: 180, y: 30 }])
    expectClear(route, items)
  })

  it('routes backward dependencies from side ports without an initial downward hairpin', () => {
    const items = [box('a', 0, 180), box('obstacle', 0, 90), box('b', 0, 0)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.kind).toBe('feedback')
    expect(['left', 'right']).toContain(route.sourceSide)
    expect(route.targetSide).toBe(route.sourceSide)
    expect(route.points).toHaveLength(4)
    expect(route.points[0].y).toBe(route.points[1].y)
    expectClear(route, items)
  })

  it('can leave sideways when a manually placed card blocks the bottom port', () => {
    const items = [box('a', 0, 0), box('touching', 20, 60, 60, 70), box('b', 0, 180)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.kind).toBe('forward')
    expect(['left', 'right']).toContain(route.sourceSide)
    expectClear(route, items)
  })

  it('returns the same geometry and lane allocation after input reordering, without mutation', () => {
    const items = [box('a', 100, 0), box('b', 0, 100), box('c', 200, 100), box('d', 100, 260)]
    const edges = [edge(), edge('a', 'c'), edge('b', 'd'), edge('c', 'd'), edge('a', 'd'), edge('d', 'a')]
    const original = JSON.stringify({ items, edges })
    const expected = routeSpatialEdges(items, edges)
    expect(routeSpatialEdges([...items].reverse(), [edges[3], edges[5], edges[1], edges[0], edges[4], edges[2]])).toEqual(expected)
    expect(JSON.stringify({ items, edges })).toBe(original)
    for (const route of expected) expectClear(route, items)
  })

  it('finds an outer corridor around densely packed intermediate rows', () => {
    const items = [box('a', 240, 0, 80, 48), box('b', 240, 504, 80, 48)]
    for (let row = 1; row <= 6; row++) for (let col = 0; col < 7; col++) {
      items.push(box(`obstacle:${row}:${col}`, col * 120, row * 72, 80, 48))
    }
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.points.length).toBeLessThanOrEqual(6)
    expectClear(route, items)
  })

  it('supports negative coordinates and nonuniform measured sizes', () => {
    const items = [box('a', -520, -340, 360, 190), box('b', -290, -116, 520, 115)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.points[0]).toEqual({ x: -340, y: -150 })
    expect(route.points.at(-1)).toEqual({ x: -30, y: -116 })
    expectClear(route, items)
  })

  it('keeps tall obstacles that start outside the endpoint rows in collision checks', () => {
    const items = [box('a', 0, 0), box('b', 0, 220), box('middle', -30, 100, 160, 80),
      box('tall-wall', -60, -1000, 20, 2000)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.points.some(point => point.x > 130)).toBe(true)
    expectClear(route, items)
  })

  it('reports an enclosed endpoint as blocked instead of drawing through the enclosing cards', () => {
    const items = [box('a', 0, 0), box('b', 300, 200), box('left', -40, -40, 40, 140),
      box('right', 100, -40, 40, 140), box('top', 0, -40, 100, 40), box('bottom', 0, 60, 100, 40)]
    const [route] = routeSpatialEdges(items, [edge()])
    expect(route.kind).toBe('blocked')
    expect(route.reason).toBe('no-clear-route')
    expect(route.path).toBe('')
    expect(route.points).toEqual([])
  })

  it('exposes missing, invalid and overlapping endpoint diagnostics without SVG artifacts', () => {
    const cases = [
      { items: [box('a', 0, 0)], reason: 'missing-endpoint' },
      { items: [box('a', 0, 0), box('b', 40, 30)], reason: 'overlapping-endpoints' },
      { items: [box('a', 0, 0), box('b', 0, NaN)], reason: 'invalid-geometry' },
    ]
    for (const { items, reason } of cases) {
      const [route] = routeSpatialEdges(items, [edge()])
      expect(route).toMatchObject({ kind: 'blocked', reason, points: [], path: '' })
    }
  })
})
