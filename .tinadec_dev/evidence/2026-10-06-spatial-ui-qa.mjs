import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Read-only product data; only opens/closes the shared search UI and types a query.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-06-spatial-ui');
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

const checks={}; let original;
const ui=async code=>evaluate('(()=>{const u=document.querySelector(".uie-canvas").__vueParentComponent.setupState.uie;'+code+'})()');
const rect=async selector=>evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()');
const drag=async(x,y,dx,dy,button='left')=>{
 const buttons=button==='middle'?4:1;
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
 await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,buttons,clickCount:1});
 for(let i=1;i<=8;i++)await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/8,y:y+dy*i/8,button,buttons});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button,buttons:0,clickCount:1});
 await delay(180);
};
try {
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await evaluate("location.hash='/space'");
 await until("document.querySelectorAll('.space-flow-area .spatial-work-card').length>=4");
 original=await ui('return JSON.parse(JSON.stringify(u.snapshot.value))');
 checks.session=original.space.sessionId;await evaluate('document.querySelector(".space-controls button:last-child").click()');await delay(350);
 checks.initialCount=await evaluate("document.querySelectorAll('.space-flow-area .spatial-work-card').length");
 const headerRect=await rect('.space-flow-area .space-drag-handle');
 const id=await evaluate("document.querySelector('.space-flow-area .spatial-work-card').dataset.objectId");
 const start=original.space.items[id];
 await drag(headerRect.x+headerRect.width/2,headerRect.y+headerRect.height/2,72,30);
 const moved=await ui('return u.snapshot.value.space.items['+JSON.stringify(id)+']');
 assert.ok(Math.abs(moved.x-start.x)>20);checks.drag=true; console.log('drag verified');
 const handle=await rect('.vue-flow__node.selected .vue-flow__resize-control.bottom.right');
 console.log('resize target',await evaluate('document.elementFromPoint('+ (handle.x+handle.width/2) +','+ (handle.y+handle.height/2) +')?.outerHTML.slice(0,350)'));await drag(handle.x+handle.width/2,handle.y+handle.height/2,48,32);
 const resized=await ui('return u.snapshot.value.space.items['+JSON.stringify(id)+']');
 console.log(JSON.stringify({moved,resized,handle}));assert.ok(resized.width>moved.width+10);assert.ok(resized.height>moved.height+10);checks.resize=true; console.log('resize verified');
 const history=await ui('const id='+JSON.stringify(id)+';const size=u.snapshot.value.space.items[id].width;const a=u.undo(),b=u.redo(),c=u.undo(),d=u.redo();return{a,b,c,d,size,current:u.snapshot.value.space.items[id].width}');
 assert.ok(history.a&&history.b&&history.c&&history.d);assert.equal(history.current,history.size);checks.repeatUndoRedo=true; console.log('history verified');
 const composerBefore=await rect('.space-composer-dock');
 const pane=await rect('.space-flow-area');
 const cameraBefore=await ui('return {...u.snapshot.value.space.viewport}');
 await drag(pane.x+80,pane.y+pane.height-50,60,-25,'middle');
 const cameraAfter=await ui('return {...u.snapshot.value.space.viewport}');
 assert.notEqual(cameraBefore.x,cameraAfter.x);
 const composerAfter=await rect('.space-composer-dock');assert.equal(composerAfter.x,composerBefore.x);assert.equal(composerAfter.y,composerBefore.y);checks.panWithFixedComposer=true; console.log('camera verified');
 const entry=await rect('.space-index-button');
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:entry.x+20,y:entry.y+15});
 await until("!!document.querySelector('.space-peek-content .spatial-work-card')");
 const previewId=await evaluate("document.querySelector('.space-peek-content .spatial-work-card').dataset.objectId");
 assert.equal(await evaluate("document.querySelectorAll('.space-flow-area .spatial-work-card').length"),checks.initialCount);checks.previewIdentity=previewId;
 await shot('hover-preview');
 await evaluate("document.querySelector('.space-locate').click()");await delay(250);
 assert.equal(await evaluate("document.querySelectorAll('.space-peek').length"),0);checks.locate=true; console.log('preview locate verified');
 await delay(600);
 const persisted=await evaluate('window.tinadec.layout.load()');
 assert.equal(persisted.sessionBySessionId[checks.session].space.items[id].width,resized.width);checks.diskPersistence=true; console.log('persistence verified');
 await evaluate("document.querySelector('.sidebar-footer-action[aria-haspopup=dialog]').click()");
 assert.equal(await evaluate("document.querySelector('.sidebar-view-menu').matches(':popover-open')"),true);checks.viewMenu=true;
 await evaluate("document.querySelectorAll('.sidebar-view-menu button')[0].click()");
 await until("!document.querySelector('.space-surface')&&!!document.querySelector('.conversation')");
 await evaluate("document.querySelector('.sidebar-footer-action[aria-haspopup=dialog]').click();document.querySelectorAll('.sidebar-view-menu button')[1].click()");
 await until("document.querySelectorAll('.space-flow-area .spatial-work-card').length>=4");
 assert.equal(await ui('return u.snapshot.value.space.items['+JSON.stringify(id)+'].width'),resized.width);checks.roundTrip=true;await delay(650);await call('Page.reload');await delay(700);await until('document.querySelector(".uie-canvas")?.__vueParentComponent?.setupState.uie.snapshot.value.space?.sessionId==='+JSON.stringify(checks.session));assert.equal(await ui('return u.snapshot.value.space.items['+JSON.stringify(id)+'].width'),resized.width);checks.reloadPersistence=true;
 await shot('space-verified');
 assert.equal(exceptions.length,0);checks.exceptions=exceptions;checks.captureErrors=captureErrors;
 console.log(JSON.stringify(checks));fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(checks,null,2));
} finally {
 if(original)await ui('if(u.snapshot.value.space?.sessionId==='+JSON.stringify(original.space.sessionId)+')u.bus.setSnapshot('+JSON.stringify(original)+');return true').catch(()=>{});
 await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();
}
