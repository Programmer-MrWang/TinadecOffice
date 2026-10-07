import { describe, expect, it } from 'vitest'
import { layoutSpatialGroup, nearestSpatialSlot, overlapsSpatial, SPACE_LAYOUT } from './spatialLayout'
import type { SpatialItem, SpatialSeed } from './spatial'

const task = (id: string, dependencyIds: string[] = []): SpatialSeed => ({ id, groupId: 'g', role: 'task', dependencyIds })
function itemsFor(seeds: SpatialSeed[], sizes: Record<string, Partial<SpatialItem>> = {}): Record<string, SpatialItem> {
  return Object.fromEntries(seeds.map(s => [s.id, { id: s.id, groupId: s.groupId, x: 0, y: 0, width: 360, height: 160, ...sizes[s.id] }]))
}
function expectClear(items: SpatialItem[]) {
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    expect(overlapsSpatial(items[i], items[j]), `${items[i].id} overlaps ${items[j].id}`).toBe(false)
  }
}

describe('spatial graph layout', () => {
  it('keeps six independent branches on the same rank without adding false precedence', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => task(id))
    seeds.push(task('join', ['a', 'b', 'c', 'd', 'e', 'f']))
    const items = itemsFor(seeds), layout = layoutSpatialGroup(items, seeds)
    expect(new Set(seeds.slice(0, 6).map(s => layout.ranks[s.id])).size).toBe(1)
    expect(new Set(seeds.slice(0, 6).map(s => layout.positions[s.id].y)).size).toBe(1)
    expect(layout.positions.join.y).toBe(160 + SPACE_LAYOUT.rankGap)
    expect(layout.width).toBe(6 * 360 + 5 * SPACE_LAYOUT.columnGap)
    expectClear(seeds.map(s => ({ ...items[s.id], ...layout.positions[s.id] })))
  })

  it('centers a diamond using real widths and separates layers by their tallest member', () => {
    const seeds = [task('root'), task('left', ['root']), task('right', ['root']), task('merge', ['left', 'right'])]
    const items = itemsFor(seeds, { root: { width: 500, height: 100 }, left: { width: 280, height: 340 }, right: { width: 620, height: 120 }, merge: { width: 420, height: 200 } })
    const before = structuredClone(items), layout = layoutSpatialGroup(items, seeds)
    expect(items).toEqual(before)
    const center = (id: string) => layout.positions[id].x + items[id].width / 2
    expect(center('root')).toBe(layout.width / 2)
    expect(center('merge')).toBe(center('root'))
    expect(layout.positions.left.y).toBe(layout.positions.right.y)
    expect(layout.positions.left.y - layout.positions.root.y).toBe(items.root.height + SPACE_LAYOUT.rankGap)
    expect(layout.positions.merge.y - layout.positions.left.y).toBe(items.left.height + SPACE_LAYOUT.rankGap)
    expect(layout.height).toBe(items.root.height + items.left.height + items.merge.height + 2 * SPACE_LAYOUT.rankGap)
    expectClear(seeds.map(s => ({ ...items[s.id], ...layout.positions[s.id] })))
  })

  it('orders reversed dependency pairs without their two connecting lines crossing', () => {
    const seeds = [task('a'), task('b'), task('c', ['b']), task('d', ['a'])]
    const items = itemsFor(seeds), layout = layoutSpatialGroup(items, seeds)
    expect((layout.positions.a.x - layout.positions.b.x) * (layout.positions.d.x - layout.positions.c.x)).toBeGreaterThan(0)
    expect(layout.positions.c.y).toBe(layout.positions.d.y)
    expect(layoutSpatialGroup(items, [...seeds].reverse())).toEqual(layout)
  })

  it('condenses only actual cycle members and still layers their successor chain', () => {
    const seeds = [task('root'), task('a', ['root', 'b']), task('b', ['a']), task('c', ['b']), task('d', ['c']), task('self', ['self'])]
    const items = itemsFor(seeds), layout = layoutSpatialGroup(items, seeds)
    expect(layout.cycles.map(c => c.join(',')).sort()).toEqual(['a,b', 'self'])
    expect(layout.ranks.a).toBe(layout.ranks.b)
    expect(layout.ranks.a).toBeGreaterThan(layout.ranks.root)
    expect(layout.ranks.c).toBeGreaterThan(layout.ranks.b)
    expect(layout.ranks.d).toBeGreaterThan(layout.ranks.c)
    expectClear(seeds.map(s => ({ ...items[s.id], ...layout.positions[s.id] })))
  })

  it('preserves every dependency rank across all directed three-task graphs, including self loops', () => {
    const ids = ['a', 'b', 'c']
    for (let mask = 0; mask < 1 << 9; mask++) {
      const reaches = ids.map((_, source) => ids.map((_, target) => Boolean(mask & (1 << (source * 3 + target)))))
      const seeds = ids.map((id, target) => task(id, ids.filter((_, source) => reaches[source][target])))
      for (let through = 0; through < 3; through++) for (let source = 0; source < 3; source++) for (let target = 0; target < 3; target++)
        reaches[source][target] ||= reaches[source][through] && reaches[through][target]
      const layout = layoutSpatialGroup(itemsFor(seeds), seeds)
      const expectedCycles = new Set<string>()
      for (let source = 0; source < 3; source++) {
        if (reaches[source][source]) expectedCycles.add(ids.filter((_, target) => reaches[source][target] && reaches[target][source]).join(','))
        for (let target = 0; target < 3; target++) if (reaches[source][target]) {
          if (reaches[target][source]) expect(layout.ranks[ids[source]], `graph ${mask}: ${ids[source]} and ${ids[target]} share a cycle`).toBe(layout.ranks[ids[target]])
          else expect(layout.ranks[ids[source]], `graph ${mask}: ${ids[source]} precedes ${ids[target]}`).toBeLessThan(layout.ranks[ids[target]])
        }
      }
      expect(layout.cycles.map(c => c.join(',')).sort(), `graph ${mask} cycle diagnostics`).toEqual([...expectedCycles].sort())
    }
  })

  it('reports missing references without discarding the known chain or fabricating a card', () => {
    const seeds = [task('a', ['missing', 'missing']), task('b', ['a', 'a']), task('c', ['b'])]
      .map(s => ({ ...s, dependencyUnverified: true }))
    const layout = layoutSpatialGroup(itemsFor(seeds), seeds)
    expect(layout.missing).toEqual([{ id: 'a', dependency: 'missing' }])
    expect(layout.cycles).toEqual([])
    expect(Object.keys(layout.positions).sort()).toEqual(['a', 'b', 'c'])
    expect(layout.ranks.b).toBeGreaterThan(layout.ranks.a)
    expect(layout.ranks.c).toBeGreaterThan(layout.ranks.b)
  })

  it('is deterministic under seed/dependency permutations and repeated evaluations', () => {
    const seeds: SpatialSeed[] = [{ id: 'goal', groupId: 'g', role: 'anchor' }, task('root'), task('a', ['root']), task('b', ['root']), task('join', ['b', 'a']),
      task('cycle-a', ['cycle-b']), task('cycle-b', ['cycle-a']), task('tail', ['cycle-b']), { id: 'result', groupId: 'g', role: 'result' }]
    const items = itemsFor(seeds, { a: { width: 620, height: 280 }, b: { width: 290, height: 110 } })
    const before = structuredClone({ items, seeds }), layout = layoutSpatialGroup(items, seeds)
    expect(layoutSpatialGroup(items, [...seeds].reverse().map(s => ({ ...s, dependencyIds: s.dependencyIds && [...s.dependencyIds].reverse() })))).toEqual(layout)
    expect(layoutSpatialGroup(items, seeds)).toEqual(layout)
    expect({ items, seeds }).toEqual(before)
  })
})

describe('nearest available canvas slot', () => {
  it('finds adjacent space within a fixed dependency interval instead of pushing below the canvas', () => {
    const items = itemsFor([task('new'), task('blocked'), task('far')], {
      blocked: { x: 0, y: 224 }, far: { x: 10000, y: 224, height: 1000 },
    })
    const point = nearestSpatialSlot(items.new, [items.blocked, items.far], { x: 0, y: 224 }, 224, 224)
    expect(point.y).toBe(224)
    expect(Math.abs(point.x)).toBe(360 + SPACE_LAYOUT.columnGap)
    expect(overlapsSpatial({ ...items.new, ...point }, items.blocked)).toBe(false)
    expect(overlapsSpatial({ ...items.new, ...point }, items.far)).toBe(false)
    expect(nearestSpatialSlot(items.new, [items.far, items.blocked], { x: 0, y: 224 }, 224, 224)).toEqual(point)
  })

  it('uses exact fractional boundaries and prefers the closest free position', () => {
    const items = itemsFor([task('new'), task('other')], { new: { width: 270, height: 100 }, other: { x: -40.5, y: -16.25, width: 290, height: 110 } })
    const desired = { x: -40.5, y: -16.25 }
    const point = nearestSpatialSlot(items.new, [items.other], desired)
    expect(overlapsSpatial({ ...items.new, ...point }, items.other)).toBe(false)
    expect(Math.abs(point.x - desired.x) + Math.abs(point.y - desired.y)).toBe(items.new.height + SPACE_LAYOUT.rankGap)
    expect(nearestSpatialSlot(items.new, [], desired)).toEqual(desired)
  })
})
