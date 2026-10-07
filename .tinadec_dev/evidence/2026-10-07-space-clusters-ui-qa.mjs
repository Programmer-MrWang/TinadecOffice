import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Controlled renderer fixtures only; restore live controller, UIE geometry and viewport.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-07-space-clusters-ui');
fs.mkdirSync(folder,{recursive:true});
const targets=await(await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(4000)})).json();
const target=targets.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:5173')&&!/\/pet|\/panel/.test(t.url));
if(!target)throw new Error('Running Desktop renderer not found');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r,j)=>{const timer=setTimeout(()=>j(new Error('CDP handshake timeout')),4000);ws.onopen=()=>{clearTimeout(timer);r()};ws.onerror=e=>{clearTimeout(timer);j(e)}});
let serial=0;const pending=new Map(),exceptions=[],captureErrors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(!p)return;m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method))},8000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,timeout:2000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);return r.result.value};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await delay(100)}throw new Error('UI did not settle: '+expression+' '+JSON.stringify(await evaluate('document.body.innerText.slice(0,1000)')))}
async function shot(name){try{const r=await call('Page.captureScreenshot',{format:'jpeg',quality:85,fromSurface:true});fs.writeFileSync(path.join(folder,name+'.jpg'),Buffer.from(r.data,'base64'));}catch(error){captureErrors.push({name,error:String(error)});}}

const result={};
const originalHash=await evaluate('location.hash');
try {
 await call('Runtime.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await evaluate("location.hash='/space'");await delay(800);await until("!!document.querySelector('.space-surface')");
 await evaluate(`(()=>{let owner=document.querySelector('.space-surface').__vueParentComponent;while(owner&&!owner.setupState?.setViewport)owner=owner.parent;const p=owner.setupState,c=p.c;
 const saved={snapshot:JSON.parse(JSON.stringify(p.uie.snapshot.value)),messages:c.messages.value,queued:c.queuedMessages.value,orchestration:c.orchestration.value,topology:p.topology};
 window.__clusterQa={p,c,saved};
 const fixture={session_id:p.sessionKey,runs:[{run_id:'cluster-qa',status:'running',tasks:[
 {task_id:'a',task_key:'a',title:'调研现有实现',handle:'research#1',worker_instance_id:'agent-a',status:'completed',dependencies:[],write_scope:[],result_summary:'确认可复用的布局、主题与事件投影。'},
 {task_id:'b',task_key:'b',title:'比较设计方案',handle:'design#1',worker_instance_id:'agent-b',status:'awaiting_user',dependencies:[],write_scope:[],result_summary:'等待审批。'},
 {task_id:'c',task_key:'c',title:'整合设计建议',handle:'research#1',worker_instance_id:'agent-a',status:'pending',dependencies:['a','b'],write_scope:[]}],instances:[],tasks_truncated:false,instances_truncated:false}],leases:[],members:[],runs_truncated:false,leases_truncated:false,members_truncated:false,generated_at:'2026-10-07T00:00:00Z'};
 window.__clusterQa.fixture=fixture;c.orchestration.value=null;
 const clean=JSON.parse(JSON.stringify(p.uie.snapshot.value));clean.space.items={};p.uie.restoreSnapshot(clean);
 c.messages.value=[{id:'qa-msg',session_id:p.sessionKey,run_id:'cluster-qa',role:'user',content:'比较方案并给出设计建议',created_at:''}];c.queuedMessages.value=[];p.topology=fixture;p.focusedRun='cluster-qa';p.syncObjects();
 })()`);await delay(400);
 for(const width of [1463,1120,900]) {
  await call('Emulation.setDeviceMetricsOverride',{width,height:867,deviceScaleFactor:1,mobile:false});await delay(350);
  await evaluate('window.__clusterQa.p.selectRun()');await delay(350);
  result[width]=await evaluate(`(()=>{const p=window.__clusterQa.p,items=p.uie.snapshot.value.space.items;const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {nodes:['a','b','c'].map(id=>items['task:cluster-qa:'+id]),edges:document.querySelectorAll('.vue-flow__edge').length,titles:[...document.querySelectorAll('.space-flow-area .spatial-work-card h2')].map(e=>e.textContent),task:rect(document.querySelector('[data-object-id="task:cluster-qa:c"]')),composer:rect(document.querySelector('.composer-box')),surface:rect(document.querySelector('.space-surface'))}})()`);
  assert.equal(await evaluate("document.querySelector('.space-surface').innerText.includes('space.cluster.')"),false);
  const r=result[width];assert.equal(r.nodes[0].y,r.nodes[1].y);assert.ok(r.nodes[2].y>r.nodes[0].y);assert.equal(r.edges,2);assert.ok(r.task.bottom<r.composer.top);
  await shot('cluster-'+width);
  await evaluate("document.querySelector('[data-object-id=\"task:cluster-qa:c\"] .space-open-detail').click();window.__clusterQa.p.locate('task:cluster-qa:c')");await delay(350);
  r.detail=await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}};return{card:rect(document.querySelector('.space-flow-area [data-object-id="task:cluster-qa:c"]')),panel:rect(document.querySelector('.space-detail')),composer:rect(document.querySelector('.composer-box')),relations:document.querySelectorAll('.space-relation-record').length}})()`);
  assert.equal(r.detail.relations,2);assert.ok(r.detail.panel.bottom<r.detail.composer.top);assert.ok(r.detail.card.right<=r.detail.panel.left);
  await shot('detail-'+width);await evaluate('window.__clusterQa.p.closeDetails()');
 }
 result.stability=await evaluate(`(async()=>{const {p,c,fixture}=window.__clusterQa;const before=JSON.stringify(p.uie.snapshot.value.space);fixture.runs[0].tasks.reverse();fixture.runs[0].tasks[0].status='completed';p.topology=structuredClone(fixture);c.messages.value=[...c.messages.value];await new Promise(r=>setTimeout(r,100));return before===JSON.stringify(p.uie.snapshot.value.space)})()`);assert.ok(result.stability);
 result.scale=[];
 for(const count of [30,100,300]) {
  const sample=await evaluate(`(async()=>{const {p,fixture}=window.__clusterQa;const clean=JSON.parse(JSON.stringify(p.uie.snapshot.value));clean.space.items={};p.uie.restoreSnapshot(clean);const sample=structuredClone(fixture);sample.runs[0].tasks=Array.from({length:${count}},(_,i)=>({task_id:'scale-'+i,task_key:'scale-'+i,title:'任务 '+i,status:'pending',dependencies:[],write_scope:[]}));const start=performance.now();p.topology=sample;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {count:${count},settleMs:performance.now()-start,rendered:document.querySelectorAll('.vue-flow__node-work').length,heapBytes:performance.memory?.usedJSHeapSize}})()`);
  result.scale.push(sample);
 }
 result.exceptions=exceptions;result.captureErrors=captureErrors;console.log(JSON.stringify(result));fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));
}finally{
 await evaluate(`(async()=>{const q=window.__clusterQa;if(!q)return;const {p,c,saved}=q;c.messages.value=saved.messages;c.queuedMessages.value=saved.queued;c.orchestration.value=saved.orchestration;p.topology=saved.topology;await new Promise(r=>setTimeout(r,100));p.uie.restoreSnapshot(saved.snapshot);p.camera(saved.snapshot.space.viewport);await p.setViewport(saved.snapshot.space.viewport);delete window.__clusterQa})()`).catch(()=>{});
 await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});await evaluate(`location.hash=${JSON.stringify(originalHash)}`).catch(()=>{});await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();
}
