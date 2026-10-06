import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Temporary renderer-only message fixtures; restored in finally, no model request or storage write.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-06-composer-dock-ui');
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
 await call('Page.reload');await delay(2500);
 for(const [mode,route,selector] of [['flat','/','.conversation'],['space','/space','.space-composer-dock']]) {
  await evaluate(`location.hash=${JSON.stringify(route)}`);await until(`!!document.querySelector('${selector}')`);await delay(900);await until(`!!document.querySelector('${selector}')`);
  result[mode]=await evaluate(`(async()=>{
   let owner=document.querySelector('${selector}').__vueParentComponent;
   while(owner && !owner.setupState?.c && !owner.setupState?.homeController) owner=owner.parent;
   const c=owner?.setupState.c ?? owner?.setupState.homeController;
   if(!c) throw new Error('Live controller unavailable');
   const saved=c.messages.value;
   const sleep=ms=>new Promise(r=>setTimeout(r,ms));
   try {
    c.messages.value=[];await sleep(450);
    const box=document.querySelector('${selector} .composer-box');
    const from=box.getBoundingClientRect().top;
    c.messages.value=[{id:'local-animation-fixture',session_id:'animation-fixture-only',role:'user',content:'Animation fixture only',created_at:''}];
    await sleep(40);
    const same=box===document.querySelector('${selector} .composer-box');
    const animations=box.getAnimations().map(a=>({frames:a.effect.getKeyframes(),duration:a.effect.getTiming().duration}));
    const during=box.getBoundingClientRect().top;
    await sleep(400);
    return {same,from,during,to:box.getBoundingClientRect().top,animations,toolbar:!!box.querySelector('.welcome-dialog-toolbar')};
   } finally {c.messages.value=saved;}
  })()`);
  console.log(mode,JSON.stringify(result[mode]));
  assert.ok(result[mode].same);assert.ok(result[mode].to>result[mode].from+20);assert.ok(result[mode].animations.some(a=>a.duration===350));assert.equal(result[mode].toolbar,mode==='flat');
  await delay(450);await shot(mode);
 }
 fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await evaluate(`location.hash=${JSON.stringify(originalHash)}`).catch(()=>{});await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();}
