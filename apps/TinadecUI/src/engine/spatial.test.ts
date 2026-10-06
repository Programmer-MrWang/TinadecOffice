import { describe, expect, it } from 'vitest'
import { emptySpace, moveSpace, repairSpace, syncSpace } from './spatial'
import { createCommandBus } from './commandBus'
import { buildPreset } from './presets'
import { makeRegistry, nextTestId } from './__testUtils'
import { createLayerStore } from './persistence/layerStore'
import { repairLayout } from './repair'

describe('session space', () => {
  it('appends into the same work area without moving manually placed cards', () => {
    const a = syncSpace(emptySpace('session-a'), [{ id: 'meeting', groupId: 'run-a' }, { id: 'plan', groupId: 'run-a' }])
    const moved = moveSpace(a, [{ id: 'plan', x: -125.5, y: 63.25 }])
    const next = syncSpace(moved, [{ id: 'meeting', groupId: 'run-a' }, { id: 'code', groupId: 'run-a' }, { id: 'other', groupId: 'run-b' }])
    expect(next.items.plan).toEqual(moved.items.plan)
    expect(next.items.code.x).toBeGreaterThan(next.items.meeting.x + next.items.meeting.width)
    expect(next.items.other.y).toBeGreaterThan(next.items.meeting.height)
  })
  it('restores negative and fractional world coordinates while rejecting invalid geometry', () => {
    const source = moveSpace(syncSpace(emptySpace('s'), [{ id: 'a', groupId: 'r' }]), [{ id: 'a', x: -33.5, y: -20.25 }])
    expect(repairSpace(JSON.parse(JSON.stringify(source)))?.items.a.x).toBe(-33.5)
    expect(repairSpace({ ...source, items: { invalid: { x: NaN, y: 0 } } })?.items).toEqual({})
    expect(moveSpace(source, [{ id: 'a', x: Infinity, width: -1 }]).items.a).toMatchObject({ x: -33.5, width: 260 })
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
