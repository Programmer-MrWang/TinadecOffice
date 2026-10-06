import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Verify bottom canvas hit testing and middle-button panning; restore viewport and route.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-06-space-compact-ui');
fs.mkdirSync(folder,{recursive:true});
const targets=await(await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(4000)})).json();
const target=targets.find(t=>t.type==='page'&&t.url.startsWith('http://127.0.0.1:5173')&&!/\/pet|\/panel/.test(t.url));
if(!target)throw new Error('Running Desktop renderer not found');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r,j)=>{const timer=setTimeout(()=>j(new Error('CDP handshake timeout')),4000);ws.onopen=()=>{clearTimeout(timer);r()};ws.onerror=e=>{clearTimeout(timer);j(e)}});
let serial=0;const pending=new Map(),exceptions=[],captureErrors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(!p)return;m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method))},8000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,timeout:2000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await delay(100)}throw new Error('UI did not settle: '+expression)}
async function shot(name){try{const r=await call('Page.captureScreenshot',{format:'jpeg',quality:85,fromSurface:true});fs.writeFileSync(path.join(folder,name+'.jpg'),Buffer.from(r.data,'base64'));}catch(error){captureErrors.push({name,error:String(error)});}}

const result={};
const originalHash=await evaluate('location.hash');
try {
 await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await evaluate("location.hash='/space'");await call('Page.reload');await delay(2000);await until("!!document.querySelector('.space-surface')");await delay(2000);
 await evaluate(`(()=>{const root=document.querySelector('.space-surface');let owner=root.__vueParentComponent;while(owner&&!owner.setupState?.setViewport)owner=owner.parent;const page=owner.setupState,c=page.c;
 window.__qaCompact={owner,viewport:JSON.parse(JSON.stringify(page.uie.snapshot.value.space.viewport)),snapshot:JSON.parse(JSON.stringify(page.uie.snapshot.value)),messages:c.messages.value,queued:c.queuedMessages.value,topology:page.topology};
 const clean=JSON.parse(JSON.stringify(page.uie.snapshot.value));clean.space.items={};page.uie.restoreSnapshot(clean);page.topology=null;c.queuedMessages.value=[];
 c.messages.value=[{id:'qa-short',session_id:page.sessionKey,role:'user',content:'你好',created_at:''}];
 })()`);await delay(600);
 result.initial=await evaluate(`(()=>{const root=document.querySelector('.space-surface');let owner=root.__vueParentComponent;while(owner&&!owner.setupState?.setViewport)owner=owner.parent;return{objects:owner.setupState.objects.map(o=>({kind:o.kind,id:o.id})),cards:[...root.querySelectorAll('.spatial-work-card')].map(c=>({id:c.dataset.objectId,height:c.offsetHeight,nodeHeight:c.closest('.vue-flow__node').offsetHeight,width:c.offsetWidth,queue:c.querySelectorAll('.space-queue-row').length})),locate:!!document.querySelector('.space-locate')}})()`);
 assert.equal(result.initial.objects.filter(o=>o.kind==='meeting').length,1);assert.equal(result.initial.objects.filter(o=>o.kind==='message').length,0);assert.equal(result.initial.locate,false);
 assert.ok(result.initial.cards[0].width>=400);assert.ok(result.initial.cards[0].height<200);assert.ok(Math.abs(result.initial.cards[0].height-result.initial.cards[0].nodeHeight)<2);assert.ok(result.initial.cards[0].queue>0);
 await shot('compact-meeting');
 result.enter=await evaluate(`(()=>{document.querySelector('.space-index-button').dispatchEvent(new MouseEvent('mouseenter'));return true})()`);await delay(40);
 result.motion=await evaluate(`(()=>{const p=document.querySelector('.space-peek');return{duration:getComputedStyle(p).transitionDuration,transform:getComputedStyle(p).transform,opacity:getComputedStyle(p).opacity,animations:p.getAnimations().length}})()`);
 assert.notEqual(result.motion.duration,'0s');await delay(220);await shot('hover-preview');
 await evaluate("document.querySelector('.space-peek-content').click()");await delay(250);
 result.located=await evaluate(`(()=>{const root=document.querySelector('.space-surface');const c=root.querySelector('.spatial-work-card').getBoundingClientRect(),r=root.getBoundingClientRect();return{peek:!!document.querySelector('.space-peek'),visible:c.bottom>r.top&&c.top<r.bottom&&c.right>r.left&&c.left<r.right}})()`);
 assert.equal(result.located.peek,false);assert.ok(result.located.visible);
 await evaluate(`(()=>{const page=window.__qaCompact.owner.setupState;page.topology={session_id:page.sessionKey,runs:[{run_id:'qa-run',status:'running',tasks:[{task_id:'qa-build',task_key:'build',title:'实现功能',status:'running',dependencies:[],write_scope:[]},{task_id:'qa-test',task_key:'test',title:'验证结果',status:'pending',dependencies:['qa-build'],write_scope:[]}],instances:[],tasks_truncated:false,instances_truncated:false}],leases:[],members:[]}})()`);await delay(700);
 result.topology=await evaluate(`(()=>{const page=window.__qaCompact.owner.setupState;return{edges:document.querySelectorAll('.vue-flow__edge').length,paths:[...document.querySelectorAll('.vue-flow__edge-path')].map(p=>({d:p.getAttribute('d'),stroke:getComputedStyle(p).stroke,visibility:getComputedStyle(p).visibility})),links:page.edges,nodes:page.objects.map(o=>({id:o.id,...page.uie.snapshot.value.space.items[o.id]}))}})()`);
 console.log(JSON.stringify(result.topology));
 assert.ok(result.topology.paths.length>=3);assert.ok(result.topology.paths.every(p=>p.d&&p.visibility==='visible'&&p.stroke!=='none'));
 assert.ok(result.topology.edges>=3);assert.ok(result.topology.links.some(e=>e.source==='task:qa-run:qa-build'&&e.target==='task:qa-run:qa-test'));
 for(let i=1;i<result.topology.nodes.length;i++){const prev=result.topology.nodes[i-1],node=result.topology.nodes[i];assert.equal(node.x,prev.x);assert.ok(node.y>=prev.y+prev.height)}
 await evaluate('window.__qaCompact.owner.setupState.overview()');await delay(400);await shot('vertical-topology-fixture');
 console.log(JSON.stringify(result));fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));
}finally{await evaluate('(async()=>{const state=window.__qaCompact;if(state){const page=state.owner.setupState;page.c.messages.value=state.messages;page.c.queuedMessages.value=state.queued;page.topology=state.topology;await new Promise(r=>setTimeout(r,80));page.uie.restoreSnapshot(state.snapshot);page.uie.dispatch({command:{type:"spaceViewport",scope:page.uie.scope.value,viewport:state.viewport},source:"route",expectedRevision:page.uie.snapshot.value.revision});await page.setViewport(state.viewport);}delete window.__qaCompact})()').catch(()=>{});await evaluate(`location.hash=${JSON.stringify(originalHash)}`).catch(()=>{});await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();}
