import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Controlled renderer fixtures only; restore live controller, UIE geometry and viewport.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-07-space-layout-ui');
fs.mkdirSync(folder,{recursive:true});
const targets=await(await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(4000)})).json();
const target=targets.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:5173')&&!/\/pet|\/panel/.test(t.url));
if(!target)throw new Error('Running Desktop renderer not found');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r,j)=>{const timer=setTimeout(()=>j(new Error('CDP handshake timeout')),4000);ws.onopen=()=>{clearTimeout(timer);r()};ws.onerror=e=>{clearTimeout(timer);j(e)}});
let serial=0;const pending=new Map(),exceptions=[],captureErrors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(!p)return;m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method))},20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,timeout:5000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);return r.result.value};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await delay(100)}throw new Error('UI did not settle: '+expression+' '+JSON.stringify(await evaluate('document.body.innerText.slice(0,1000)')))}
async function shot(name){try{const r=await call('Page.captureScreenshot',{format:'jpeg',quality:85,fromSurface:true});fs.writeFileSync(path.join(folder,name+'.jpg'),Buffer.from(r.data,'base64'));}catch(error){captureErrors.push({name,error:String(error)});}}

const result={};
const originalHash=await evaluate('location.hash');
try {
 console.log('connect');await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await evaluate("location.hash='/space'");await until("!!document.querySelector('.space-surface')");await delay(700);
 console.log('fixture');await evaluate(`(()=>{let owner=document.querySelector('.space-surface').__vueParentComponent;while(owner&&!owner.setupState?.setViewport)owner=owner.parent;const p=owner.setupState,c=p.c;
 const saved={snapshot:JSON.parse(JSON.stringify(p.uie.snapshot.value)),messages:c.messages.value,queued:c.queuedMessages.value,orchestration:c.orchestration.value,topology:p.topology,focusedRun:p.focusedRun};window.__layoutQa={p,c,saved};
 const tasks=[['a',[]],['b',[]],['c',[]],['d',[]],['e',['a','b']],['f',['c','d']],['g',['e','f']],['h',['a','g']]].map(([id,dependencies])=>({task_id:id,task_key:id,title:({a:'检查界面结构',b:'读取运行事实',c:'验证接口约束',d:'整理验证证据',e:'设计交互',f:'实现数据映射',g:'集成工作界面',h:'最终审查'})[id],status:'running',dependencies,write_scope:[]}));
 const fixture={session_id:p.sessionKey,runs:[{run_id:'layout-qa',status:'running',tasks,instances:[],tasks_truncated:false,instances_truncated:false}],leases:[],members:[],runs_truncated:false,leases_truncated:false,members_truncated:false,generated_at:'2026-10-07T00:00:00Z'};
 window.__layoutQa.fixture=fixture;c.orchestration.value=null;const clean=JSON.parse(JSON.stringify(p.uie.snapshot.value));clean.space.items={};p.uie.restoreSnapshot(clean);
 c.messages.value=[{id:'layout-msg',session_id:p.sessionKey,run_id:'layout-qa',role:'user',content:'可靠布局与连线验证（临时夹具）',created_at:''}];c.queuedMessages.value=[];p.topology=fixture;p.focusedRun='layout-qa';p.syncObjects();})()`);
 await delay(500);await call('Emulation.setDeviceMetricsOverride',{width:1463,height:867,deviceScaleFactor:1,mobile:false});
 await evaluate('window.__layoutQa.p.selectRun()');await delay(450);
 const snapshot=()=>evaluate(`(()=>{const p=window.__layoutQa.p;return {items:p.visibleObjects.map(o=>p.uie.snapshot.value.space.items[o.id]),routes:p.routes,paths:[...document.querySelectorAll('.vue-flow__edge-path')].map(e=>({path:e.getAttribute('d'),stroke:getComputedStyle(e).stroke})),viewport:p.uie.snapshot.value.space.viewport}})()`);
 console.log('layered');result.layered=await snapshot();assert.equal(new Set(result.layered.items.filter(i=>/task:layout-qa:[abcd]$/.test(i.id)).map(i=>i.y)).size,1);
 for(const route of result.layered.routes){assert.notEqual(route.kind,'blocked');assert.ok(route.points.every((pt,i)=>!i||pt.y>=route.points[i-1].y));}
 assert.equal(result.layered.paths.length,result.layered.routes.length);assert.ok(result.layered.paths.every(p=>p.stroke!=='none'));
 await shot('layered');
 const before=JSON.stringify(result.layered.items);
 result.stable=await evaluate(`(async()=>{const {p,fixture}=window.__layoutQa;fixture.runs[0].tasks.reverse();p.topology=structuredClone(fixture);await new Promise(r=>setTimeout(r,80));return p.visibleObjects.map(o=>p.uie.snapshot.value.space.items[o.id])})()`);
 const positions=items=>Object.fromEntries(items.map(i=>[i.id,{x:i.x,y:i.y,width:i.width,height:i.height}]));assert.deepEqual(positions(result.stable),positions(result.layered.items));
 await evaluate(`(()=>{const {p}=window.__layoutQa;const a='task:layout-qa:a',h='task:layout-qa:h';p.commit([{id:a,x:0,y:0},{id:h,x:40,y:194}]);p.locate(h)})()`);await delay(300);
 result.shortGap=await snapshot();const short=result.shortGap.routes.find(r=>r.source==='task:layout-qa:a'&&r.target==='task:layout-qa:h');assert.ok(short);assert.equal(short.kind,'forward');assert.ok(short.points.every((pt,i)=>!i||pt.y>=short.points[i-1].y));await shot('short-gap');
 await evaluate(`(()=>{const {p}=window.__layoutQa;p.commit([{id:'task:layout-qa:h',x:420,y:-300}]);p.locate('task:layout-qa:h')})()`);await delay(300);
 result.feedback=await snapshot();const back=result.feedback.routes.find(r=>r.source==='task:layout-qa:a'&&r.target==='task:layout-qa:h');assert.equal(back.kind,'feedback');assert.ok(['left','right'].includes(back.sourceSide));await shot('feedback');
 await evaluate('window.__layoutQa.p.arrangeCurrent()');await delay(450);result.arranged=await snapshot();assert.ok(result.arranged.routes.every(r=>r.kind==='forward'));await shot('arranged');
 result.exceptions=exceptions;result.captureErrors=captureErrors;fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({layers:result.layered.items.length,edges:result.layered.paths.length,short:short.points,feedback:back.points,arranged:result.arranged.routes.length,exceptions,captureErrors}));
}finally{await evaluate(`(async()=>{const q=window.__layoutQa;if(!q)return;const {p,c,saved}=q;c.messages.value=saved.messages;c.queuedMessages.value=saved.queued;c.orchestration.value=saved.orchestration;p.topology=saved.topology;p.focusedRun=saved.focusedRun;await new Promise(r=>setTimeout(r,100));p.uie.restoreSnapshot(saved.snapshot);p.camera(saved.snapshot.space.viewport);await p.setViewport(saved.snapshot.space.viewport);delete window.__layoutQa})()`).catch(()=>{});await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});await evaluate(`location.hash=${JSON.stringify(originalHash)}`).catch(()=>{});await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();}
