import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Switch real material settings and restore them in finally; no model requests.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-06-space-material-ui');
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
const saved=await evaluate("localStorage.getItem('tinadec-panel-style')");
async function setMaterial(value) {
 await evaluate(`(()=>{const key='tinadec-panel-style',oldValue=localStorage.getItem(key),newValue=${JSON.stringify(value)};if(newValue===null)localStorage.removeItem(key);else localStorage.setItem(key,newValue);window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:localStorage}));})()`);
 await delay(250);
}
try {
 await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await evaluate("location.hash='/space'");await until("!!document.querySelector('.space-surface[data-panel-effect]')");await delay(800);
 for(const effect of ['opaque','translucent','blur']) {
  await setMaterial(JSON.stringify({effect,opacity:60,blur:20}));
  result[effect]=await evaluate(`(()=>{const root=document.querySelector('.space-surface'),b=root.querySelector('.composer-box'),css=getComputedStyle(b),rs=getComputedStyle(root);return{effect:root.dataset.panelEffect,background:css.backgroundColor,filter:css.backdropFilter,rootBackground:rs.backgroundColor,rootFilter:rs.backdropFilter,controlsFilter:getComputedStyle(root.querySelector('.space-controls')).backdropFilter,cards:[...root.querySelectorAll('.spatial-work-card')].map(card=>({background:getComputedStyle(card).backgroundColor,filter:getComputedStyle(card).backdropFilter,parentBackground:getComputedStyle(card.closest('.vue-flow__node')).backgroundColor}))}})()`);
  assert.equal(result[effect].effect,effect);assert.equal(result[effect].rootFilter,'none');assert.equal(result[effect].rootBackground,'rgba(0, 0, 0, 0)');
  if(effect==='blur'){assert.match(result[effect].filter,/blur\(4px\)/);assert.match(result[effect].background, /0.7\)/);assert.match(result[effect].controlsFilter,/blur\(7px\)/)}else assert.equal(result[effect].filter,'none');
  for(const card of result[effect].cards){assert.equal(card.parentBackground,'rgba(0, 0, 0, 0)');if(effect==='blur')assert.match(card.filter,/blur\(7px\)/);else assert.equal(card.filter,'none')}
  await shot(effect);
 }
 fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await setMaterial(saved).catch(()=>{});await evaluate(`location.hash=${JSON.stringify(originalHash)}`).catch(()=>{});await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();}
