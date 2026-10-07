import { createRequire } from 'node:module'
const { build } = createRequire(import.meta.resolve('vite'))('esbuild')
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const out = path.resolve('.tinadec_dev/evidence/2026-10-07-space-layout')
await fs.mkdir(out, { recursive: true })
const bundle = await build({ stdin: { contents: "export * from './apps/TinadecUI/src/engine/spatialLayout'; export * from './apps/TinadecUI/src/engine/spatialRouting'; export * from './apps/TinadecUI/src/engine/spatial'", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' })
const { layoutSpatialGroup, routeSpatialEdges, syncSpace, emptySpace } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const task = (id, dependencyIds = []) => ({ id, groupId: 'example', role: 'task', dependencyIds })
const seeds = [task('A'), task('B'), task('C'), task('D'), task('E', ['A','B']), task('F', ['C','D']), task('G', ['E','F']), task('H', ['A','G'])]
const sample = syncSpace(emptySpace('example'), seeds)
const layout = layoutSpatialGroup(sample.items, seeds)
const items = seeds.map(s => ({ ...sample.items[s.id], ...layout.positions[s.id] }))
const edges = seeds.flatMap(s => s.dependencyIds.map(source => ({ id: source+'->'+s.id, source, target:s.id })))
const routes = routeSpatialEdges(items, edges)
assert.ok(routes.every(r => r.kind === 'forward'))
assert.ok(routes.every(r => r.points.every((p,i) => !i || p.y >= r.points[i-1].y)))
const pathMarkup = routes.map(r => `<path class="connection" d="${r.path}"/><text x="${r.labelX}" y="${r.labelY - 8}">${r.source} → ${r.target}</text>`).join('')
const nodeMarkup = items.map(i => `<g><rect x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}" rx="14"/><text x="${i.x+20}" y="${i.y+32}">${i.id} · task</text><text x="${i.x+20}" y="${i.y+60}">rank ${layout.ranks[i.id]} · ${i.width} × ${i.height}</text></g>`).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -40 ${layout.width+120} ${layout.height+80}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#597a9b"/></marker></defs><style>svg{background:#f7f8fa}.connection{fill:none;stroke:#597a9b;stroke-width:2;marker-end:url(#arrow)}rect{fill:#fff;stroke:#ccd4de}text{font:16px sans-serif;fill:#304256}g text:first-of-type{font-weight:600}</style>${pathMarkup}${nodeMarkup}</svg>`
await fs.writeFile(path.join(out,'layered.svg'),svg)
const metrics = []
for (const count of [100,300]) {
 const boxes=Array.from({length:count},(_,i)=>({id:String(i),groupId:'g',x:(i%5)*408,y:Math.floor(i/5)*224,width:360,height:160}))
 const relations=boxes.slice(10).map((b,i)=>({id:'edge-'+i,source:String(i),target:b.id}))
 const times=[];let blocked=0
 for(let i=0;i<3;i++){const start=performance.now();const r=routeSpatialEdges(boxes,relations);times.push(Math.round((performance.now()-start)*100)/100);blocked=r.filter(e=>e.kind==='blocked').length}
 metrics.push({nodes:count,edges:relations.length,routeMs:times,blocked})
}
await fs.writeFile(path.join(out,'checks.json'),JSON.stringify({layout,items,routes,metrics,scope:'Pure algorithm fixture, not browser/model execution'},null,2))
console.log(JSON.stringify({edges:routes.length,metrics,svg:path.join(out,'layered.svg')}))
