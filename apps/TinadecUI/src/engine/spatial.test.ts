import { describe, expect, it } from 'vitest'
import { arrangeSpace, emptySpace, moveSpace, repairSpace, syncSpace, type SpatialLayout, type SpatialSeed } from './spatial'
import { createCommandBus } from './commandBus'
import { buildPreset } from './presets'
import { makeRegistry, nextTestId } from './__testUtils'
import { createLayerStore } from './persistence/layerStore'
import { repairLayout } from './repair'

function expectNoOverlap(space: SpatialLayout) {
  const items = Object.values(space.items)
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
      `${a.id} overlaps ${b.id}`).toBe(true)
  }
}

const branchSeeds: SpatialSeed[] = [
  { id: 'anchor', groupId: 'run-a', role: 'anchor' },
  { id: 'a', groupId: 'run-a', role: 'task' },
  { id: 'b', groupId: 'run-a', role: 'task' },
  { id: 'merge', groupId: 'run-a', role: 'task', dependencyIds: ['a', 'b'] },
  { id: 'result', groupId: 'run-a', role: 'result' },
  { id: 'activity', groupId: 'run-a', role: 'activity' },
]

describe('session space', () => {
  it('appends into the same work area without moving manually placed cards', () => {
    const a = syncSpace(emptySpace('session-a'), [{ id: 'meeting', groupId: 'run-a' }, { id: 'plan', groupId: 'run-a' }])
    const moved = moveSpace(a, [{ id: 'plan', x: -125.5, y: 63.25 }])
    const next = syncSpace(moved, [{ id: 'meeting', groupId: 'run-a' }, { id: 'code', groupId: 'run-a' }, { id: 'other', groupId: 'run-b' }])
    expect(next.items.plan).toEqual(moved.items.plan)
    expect(next.items.code.x).toBe(next.items.meeting.x)
    expect(next.items.code.y).toBeGreaterThan(next.items.meeting.y + next.items.meeting.height)
    expect(next.items.other.y).toBeGreaterThan(next.items.meeting.height)
  })
  it('restores negative and fractional world coordinates while rejecting invalid geometry', () => {
    const source = moveSpace(syncSpace(emptySpace('s'), [{ id: 'a', groupId: 'r' }]), [{ id: 'a', x: -33.5, y: -20.25 }])
    expect(repairSpace(JSON.parse(JSON.stringify(source)))?.items.a.x).toBe(-33.5)
    expect(repairSpace({ ...source, items: { invalid: { x: NaN, y: 0 } } })?.items).toEqual({})
    expect(moveSpace(source, [{ id: 'a', x: Infinity, width: -1 }]).items.a).toMatchObject({ x: -33.5, width: 260 })
  })
  it('updates claimed message ownership without moving it and avoids cards from other groups', () => {
    let s = syncSpace(emptySpace('s'), [{ id: 'message', groupId: 'queued' }, { id: 'foreign', groupId: 'other' }])
    s = moveSpace(s, [{ id: 'message', x: -100, y: 15 }, { id: 'foreign', x: 275, y: 15 }])
    const next = syncSpace(s, [{ id: 'message', groupId: 'run' }, { id: 'worker', groupId: 'run' }])
    expect(next.items.message).toMatchObject({ x: -100, y: 15, groupId: 'run' })
    expect(next.items.worker.y).toBeGreaterThan(next.items.foreign.y + next.items.foreign.height)
    expect(next.items.foreign).toEqual(s.items.foreign)
  })
  it('measures content growth without moving existing cards or overriding manual sizes', () => {
    const seeds = [{ id: 'a', groupId: 's' }, { id: 'b', groupId: 's' }]
    const initial = syncSpace(emptySpace('s'), seeds)
    const grown = syncSpace(initial, [{ ...seeds[0], measuredHeight: 240 }, seeds[1]])
    expect(grown.items.a.height).toBe(240)
    expect(grown.items.b).toEqual(initial.items.b)
    const manual = moveSpace(grown, [{ id: 'b', x: 700, y: 40, height: 160 }])
    const refreshed = syncSpace(manual, [{ ...seeds[0], measuredHeight: 110 }, { ...seeds[1], measuredHeight: 300 }])
    expect(refreshed.items.b).toEqual(manual.items.b)
    expect(repairSpace(JSON.parse(JSON.stringify(refreshed)))?.items.b.autoHeight).toBe(false)
    expect(syncSpace(refreshed, [{ ...seeds[0], measuredHeight: 110 }, seeds[1]])).toBe(refreshed)
  })
  it('places compact branches side by side, their merge below both, then results and activities', () => {
    const space = syncSpace(emptySpace('s'), branchSeeds)
    const { anchor, a, b, merge, result, activity } = space.items
    expect(anchor).toMatchObject({ width: 360, height: 160, compact: true })
    expect(a.y).toBe(b.y)
    expect(b.x).toBeGreaterThan(a.x + a.width)
    expect(a.y).toBeGreaterThan(anchor.y + anchor.height)
    expect(merge.y).toBeGreaterThan(Math.max(a.y + a.height, b.y + b.height))
    expect(result.y).toBeGreaterThan(merge.y + merge.height)
    expect(activity.y).toBeGreaterThan(result.y + result.height)
    expectNoOverlap(space)
    expect(moveSpace(space, arrangeSpace(space, branchSeeds, 'run-a')).items).toEqual(
      Object.fromEntries(Object.entries(space.items).map(([id, item]) => [id, { ...item, manualPosition: true }])))
  })
  it('is stable under input permutations and arranges new groups by ID outside existing occupancy', () => {
    const seeds: SpatialSeed[] = [
      ...branchSeeds,
      { id: 'shared', groupId: 'project', role: 'shared' },
      { id: 'z', groupId: 'run-z', role: 'task' },
    ]
    const first = syncSpace(emptySpace('s'), seeds)
    expect(syncSpace(emptySpace('s'), [...seeds].reverse())).toEqual(first)
    expect(syncSpace(first, [...seeds].reverse())).toBe(first)
    expect(first.items.anchor.y).toBeGreaterThan(first.items.shared.y + first.items.shared.height)
    expect(first.items.z.y).toBeGreaterThan(first.items.activity.y + first.items.activity.height)
    expectNoOverlap(first)
  })
  it('wraps a dependency layer after three columns before starting its successors', () => {
    const roots: SpatialSeed[] = ['a', 'b', 'c', 'd'].map(id => ({ id, groupId: 'g', role: 'task' }))
    const space = syncSpace(emptySpace('s'), [...roots, { id: 'e', groupId: 'g', role: 'task', dependencyIds: ['a'] }])
    expect(space.items.a.y).toBe(space.items.b.y)
    expect(space.items.b.y).toBe(space.items.c.y)
    expect(space.items.d.y).toBeGreaterThan(space.items.c.y + space.items.c.height)
    expect(space.items.e.y).toBeGreaterThan(space.items.d.y + space.items.d.height)
    expectNoOverlap(space)
  })
  it('adds earlier-sorting tasks and descendants without moving old cards, manual cards or the camera', () => {
    let space = syncSpace(emptySpace('s'), branchSeeds)
    space = moveSpace(space, [{ id: 'b', x: -620.5, y: -40.25, width: 530, height: 350 }])
    space.viewport = { x: -420, y: 130, zoom: 0.65 }
    const seeds: SpatialSeed[] = [
      { id: '00-new', groupId: 'run-a', role: 'task' },
      ...branchSeeds,
      { id: 'child', groupId: 'run-a', role: 'task', dependencyIds: ['merge'] },
      { id: 'earlier-group', groupId: '00-run', role: 'anchor' },
    ]
    const next = syncSpace(space, seeds)
    for (const [id, item] of Object.entries(space.items)) expect(next.items[id]).toEqual(item)
    expect(next.viewport).toEqual(space.viewport)
    expect(next.items.child.y).toBeGreaterThan(next.items.merge.y + next.items.merge.height)
    expect(next.items['earlier-group'].y).toBeGreaterThan(Math.max(...Object.values(next.items)
      .filter(item => item.groupId === 'run-a').map(item => item.y + item.height)))
    expectNoOverlap(next)
  })
  it('keeps unknown dependencies and their descendants in the unresolved remainder without looping', () => {
    const seeds: SpatialSeed[] = [
      { id: 'anchor', groupId: 'g', role: 'anchor' },
      { id: 'a', groupId: 'g', role: 'task', dependencyIds: ['missing', 'foreign'] },
      { id: 'b', groupId: 'g', role: 'task' },
      { id: 'c', groupId: 'g', role: 'task', dependencyIds: ['a', 'a'] },
      { id: 'cycle-1', groupId: 'g', role: 'task', dependencyIds: ['cycle-2'] },
      { id: 'cycle-2', groupId: 'g', role: 'task', dependencyIds: ['cycle-1'] },
      { id: 'downstream', groupId: 'g', role: 'task', dependencyIds: ['cycle-1'] },
      { id: 'self', groupId: 'g', role: 'task', dependencyIds: ['self'] },
      { id: 'result', groupId: 'g', role: 'result' },
      { id: 'foreign', groupId: 'other', role: 'task' },
    ]
    const space = syncSpace(emptySpace('s'), seeds)
    expect(Object.keys(space.items)).toHaveLength(seeds.length)
    expect(space.items.a.y).toBeGreaterThan(space.items.b.y + space.items.b.height)
    expect(space.items.c.y).toBe(space.items.a.y)
    expect(space.items['cycle-1'].y).toBeGreaterThanOrEqual(space.items.c.y)
    expect(space.items.result.y).toBeGreaterThan(space.items.self.y + space.items.self.height)
    expect(syncSpace(emptySpace('s'), [...seeds].reverse())).toEqual(space)
    expectNoOverlap(space)
  })
  it('retains old full-card geometry/height policy and persists only explicit compact preferences', () => {
    const legacy = repairSpace({
      sessionId: 's', viewport: { x: -42.5, y: 91.25, zoom: 0.5 },
      items: { a: { groupId: 'run-a', x: -600.5, y: -200.25, width: 720, height: 400 } },
    })!
    const upgraded = syncSpace(legacy, [{ id: 'a', groupId: 'run-a', role: 'task' }, { id: 'b', groupId: 'run-a', role: 'task' }])
    expect(upgraded.items.a).toEqual(legacy.items.a)
    expect(upgraded.items.a).not.toHaveProperty('compact')
    expect(upgraded.items.b).toMatchObject({ compact: true, width: 360, height: 160 })
    expectNoOverlap(upgraded)
    const measured = syncSpace(upgraded, [{ id: 'a', groupId: 'run-a', role: 'task', measuredHeight: 510 }])
    expect(measured.items.a).toMatchObject({ x: -600.5, y: -200.25, width: 720, height: 510, autoHeight: true })
    expect(measured.items.b).toEqual(upgraded.items.b)
    const manual = moveSpace(measured, [{ id: 'a', height: 300 }])
    expect(syncSpace(manual, [{ id: 'a', groupId: 'run-a', role: 'task', measuredHeight: 900 }])).toBe(manual)
    manual.items.b.compact = false
    const restored = repairSpace(JSON.parse(JSON.stringify(manual)))!
    expect(restored).toEqual(manual)
    expect(restored.items.a).not.toHaveProperty('compact')
    expect(restored.items.b.compact).toBe(false)
    const compact = syncSpace(emptySpace('s'), branchSeeds)
    expect(repairSpace(JSON.parse(JSON.stringify(compact)))).toEqual(compact)
  })
  it('arranges only the requested group, respects varied dimensions and avoids retained obstacles', () => {
    const seeds: SpatialSeed[] = [...branchSeeds, { id: 'foreign', groupId: 'other', role: 'shared' }]
    let space = syncSpace(emptySpace('s'), seeds)
    space = moveSpace(space, [
      { id: 'anchor', x: -600.5, y: -200.25, width: 780, height: 260 },
      { id: 'a', x: 1000, y: 100, width: 620, height: 420 },
      { id: 'b', x: 500, y: -100, width: 290, height: 110 },
      { id: 'foreign', x: -650, y: 160, width: 1200, height: 220 },
    ])
    const before = structuredClone(space)
    const changes = arrangeSpace(space, [...branchSeeds].reverse(), 'run-a')
    expect(space).toEqual(before)
    expect(changes).toHaveLength(branchSeeds.length)
    expect(changes.every(change => Object.keys(change).sort().join(',') === 'id,x,y')).toBe(true)
    expect(changes.some(change => change.id === 'foreign')).toBe(false)
    const arranged = moveSpace(space, changes)
    expect(arranged.items.foreign).toEqual(before.items.foreign)
    expect(arranged.viewport).toEqual(before.viewport)
    for (const [id, item] of Object.entries(before.items)) {
      expect(arranged.items[id].width).toBe(item.width)
      expect(arranged.items[id].height).toBe(item.height)
      expect(arranged.items[id].autoHeight).toBe(item.autoHeight)
      expect(arranged.items[id].compact).toBe(item.compact)
    }
    expect(arranged.items.anchor.x).toBe(-600.5)
    expect(arranged.items.a.y).toBe(arranged.items.b.y)
    expect(arranged.items.merge.y).toBeGreaterThan(arranged.items.a.y + arranged.items.a.height)
    expectNoOverlap(arranged)
    expect(arrangeSpace(space, branchSeeds, 'absent')).toEqual([])
  })
  it('undoes an arrange with one spaceMove while retaining later runtime tasks, other groups and the camera', () => {
    const seeds: SpatialSeed[] = [...branchSeeds, { id: 'foreign', groupId: 'other', role: 'shared' }]
    const space = moveSpace(syncSpace(emptySpace('s'), seeds), [
      { id: 'a', x: -530, y: 760, width: 550, height: 280 },
      { id: 'b', x: 940, y: -250 },
    ])
    const initial = { ...buildPreset('home', { nextInstanceId: nextTestId }), space }
    const bus = createCommandBus(initial, { registry: makeRegistry() })
    const scope = { kind: 'page', pageId: 'home' } as const
    const changes = arrangeSpace(space, seeds, 'run-a')
    expect(bus.dispatch({ command: { type: 'spaceMove', scope, changes }, source: 'user', expectedRevision: bus.getSnapshot().revision })).toBe(true)
    const arranged = structuredClone(bus.getSnapshot().space!)
    const runtime: SpatialSeed = { id: 'new-task', groupId: 'run-a', role: 'task', dependencyIds: ['merge'] }
    expect(bus.dispatch({ command: { type: 'spaceSync', scope, seeds: [...seeds, runtime] }, source: 'route', expectedRevision: bus.getSnapshot().revision })).toBe(true)
    const added = structuredClone(bus.getSnapshot().space!.items['new-task'])
    const viewport = { x: -400, y: -80, zoom: 0.5 }
    expect(bus.dispatch({ command: { type: 'spaceViewport', scope, viewport }, source: 'user', expectedRevision: bus.getSnapshot().revision })).toBe(true)
    for (let i = 0; i < 3; i++) {
      const undone = bus.undo()!.space!
      for (const [id, item] of Object.entries(space.items)) expect(undone.items[id]).toEqual(item)
      expect(undone.items['new-task']).toEqual(added)
      expect(undone.viewport).toEqual(viewport)
      expect(bus.canUndo()).toBe(false)
      const redone = bus.redo()!.space!
      for (const [id, item] of Object.entries(arranged.items)) expect(redone.items[id]).toEqual(item)
      expect(redone.items['new-task']).toEqual(added)
      expect(redone.viewport).toEqual(viewport)
    }
  })
  it('preserves canvas data through normal layout repair and session persistence', async () => {
    const snapshot = { ...buildPreset('home', { nextInstanceId: nextTestId }), space: emptySpace('s1') }
    snapshot.space = syncSpace(snapshot.space, [{ id: 'a', groupId: 'r' }])
    const repaired = repairLayout(snapshot, { registry: makeRegistry(), preset: { nextInstanceId: nextTestId } })
    expect(repaired.space).toEqual(snapshot.space)
    const store = createLayerStore({ load: async () => null, save: async () => true })
    await store.hydrate()
    store.saveSnapshot(repaired, 'project')
    expect(store.resolveSpace('s1')?.space).toEqual(snapshot.space)
    expect(store.resolveSpace('s2')).toBeNull()
    expect(store.resolveSnapshot('home', 'project')).toBeNull()
    store.flush()
  })
  it('undo/redo remains repeatable, keeps runtime additions and does not undo camera motion', () => {
    const initial = { ...buildPreset('home', { nextInstanceId: nextTestId }), space: syncSpace(emptySpace('s'), [{ id: 'a', groupId: 'r' }]) }
    const bus = createCommandBus(initial, { registry: makeRegistry() })
    const scope = { kind: 'page', pageId: 'home' } as const
    bus.dispatch({ command: { type: 'spaceMove', scope, changes: [{ id: 'a', x: 170 }] }, source: 'user', expectedRevision: bus.getSnapshot().revision })
    bus.dispatch({ command: { type: 'spaceSync', scope, seeds: [{ id: 'b', groupId: 'r' }] }, source: 'route', expectedRevision: bus.getSnapshot().revision })
    bus.dispatch({ command: { type: 'spaceViewport', scope, viewport: { x: -400, y: -80, zoom: 0.5 } }, source: 'user', expectedRevision: bus.getSnapshot().revision })
    for (let i = 0; i < 3; i++) {
      expect(bus.undo()?.space?.items.a.x).toBe(0)
      expect(bus.getSnapshot().space?.items.b).toBeTruthy()
      expect(bus.getSnapshot().space?.viewport.zoom).toBe(0.5)
      expect(bus.redo()?.space?.items.a.x).toBe(170)
      expect(bus.canUndo()).toBe(true)
    }
    bus.loadSnapshot({ ...initial, space: emptySpace('another') })
    expect(bus.canUndo()).toBe(false)
  })
})
