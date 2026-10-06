import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Verify bottom canvas hit testing and middle-button panning; restore viewport and route.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-06-space-full-canvas-ui');
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
 await evaluate("location.hash='/space'");await call('Page.reload');await delay(1800);await until("!!document.querySelector('.space-surface')");await delay(2500);
 result.before=await evaluate(`(()=>{const root=document.querySelector('.space-surface'),r=root.getBoundingClientRect(),flow=root.querySelector('.vue-flow').getBoundingClientRect(),box=root.querySelector('.composer-box').getBoundingClientRect();let owner=root.__vueParentComponent;while(owner&&!owner.setupState?.setViewport)owner=owner.parent;window.__qaFullCanvas={owner,viewport:JSON.parse(JSON.stringify(owner.setupState.uie.snapshot.value.space.viewport))};const x=r.left+20,y=r.bottom-30;return{bottom:r.bottom,flowBottom:flow.bottom,hint:!!document.querySelector('.space-navigation-hint'),x,y,hit:!!document.elementFromPoint(x,y)?.closest('.vue-flow'),composerY:box.top,transform:root.querySelector('.vue-flow__transformationpane').style.transform}})()`);
 assert.ok(Math.abs(result.before.bottom-result.before.flowBottom)<1);assert.equal(result.before.hint,false);assert.ok(result.before.hit);
 const {x,y}=result.before;
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'middle',buttons:4,clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+55,y:y-45,button:'middle',buttons:4});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+55,y:y-45,button:'middle',buttons:0,clickCount:1});await delay(250);
 result.after=await evaluate(`(()=>{const root=document.querySelector('.space-surface');return{transform:root.querySelector('.vue-flow__transformationpane').style.transform,composerY:root.querySelector('.composer-box').getBoundingClientRect().top}})()`);
 console.log(JSON.stringify(result));
 assert.notEqual(result.before.transform,result.after.transform);assert.ok(Math.abs(result.before.composerY-result.after.composerY)<1);
 await shot('full-canvas');fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await evaluate('(async()=>{const state=window.__qaFullCanvas;if(state)await state.owner.setupState.setViewport(state.viewport);delete window.__qaFullCanvas})()').catch(()=>{});await evaluate(`location.hash=${JSON.stringify(originalHash)}`).catch(()=>{});await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();}
