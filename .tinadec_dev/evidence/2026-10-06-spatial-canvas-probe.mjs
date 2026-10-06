// Read-only diagnostic for source baseline 46731fd. Run from the repo root:
// node .tinadec_dev/evidence/2026-10-06-spatial-canvas-probe.mjs
// Reports current behavior; it does not assert that a defect is desired.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite')] }))

try {
  const bundled = await esbuild.build({
    stdin: {
      contents: [
        "export { createCommandBus } from './apps/TinadecUI/src/engine/commandBus.ts'",
        "export { createCardRegistry } from './apps/TinadecUI/src/engine/registry.ts'",
        "export { buildPreset } from './apps/TinadecUI/src/engine/presets.ts'",
        "export { computeGeometry } from './apps/TinadecUI/src/engine/constraints.ts'",
        "export { repairLayout } from './apps/TinadecUI/src/engine/repair.ts'",
      ].join('\n'),
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true, platform: 'node', format: 'esm', write: false,
  })
  const engine = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
  let id = 0
  const preset = { nextInstanceId: () => `probe-${++id}` }
  const initial = engine.buildPreset('home', preset)
  const registry = engine.createCardRegistry()
  for (const type of new Set(Object.values(initial.cards).map(card => card.descriptorId))) {
    registry.register({ type, component: {}, minWidth: 120, minHeight: 80, singleton: true, movable: true, closable: true, detachable: false, defaultTitle: type })
  }
  const bus = engine.createCommandBus(initial, { registry })
  const cardId = Object.keys(initial.cards)[0]
  const size = { width: 1440, height: 920 }
  const before = engine.computeGeometry(size, initial)
  const accepted = bus.dispatch({
    command: { type: 'updateCardGrid', scope: { kind: 'page', pageId: 'home' }, instanceId: cardId, x: -300.5, y: -200.5, w: 325, h: 400 },
    source: 'user', expectedRevision: initial.revision,
  })
  const after = engine.computeGeometry(size, bus.getSnapshot())
  const repaired = engine.repairLayout(bus.getSnapshot(), { registry, preset })
  const firstUndo = !!bus.undo()
  const firstRedo = !!bus.redo()
  const canUndoAfterRedo = bus.canUndo()
  const secondUndo = !!bus.undo()
  console.log(JSON.stringify({ gridCommandAccepted: accepted, geometryUnchanged: JSON.stringify(before) === JSON.stringify(after), repairedPosition: { x: repaired.cards[cardId]?.x, y: repaired.cards[cardId]?.y }, firstUndo, firstRedo, canUndoAfterRedo, secondUndo }))
} finally {
  esbuild.stop()
}
