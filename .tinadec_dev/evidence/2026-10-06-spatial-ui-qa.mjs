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
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method))},8000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,timeout:2000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await delay(100)}throw new Error('UI did not settle: '+expression)}
async function shot(name){try{const r=await call('Page.captureScreenshot',{format:'jpeg',quality:85,fromSurface:true});fs.writeFileSync(path.join(folder,name+'.jpg'),Buffer.from(r.data,'base64'));}catch(error){captureErrors.push({name,error:String(error)});}}

try {
 await call('Runtime.enable'); await call('Page.enable');
 await evaluate("location.hash = '/space'");
 await until("!!document.querySelector('.space-surface')");
 await delay(1500);
 const state=await evaluate("JSON.stringify({title:document.title,cards:[...document.querySelectorAll('.space-flow-area .spatial-work-card')].map(e=>({id:e.dataset.objectId,text:e.innerText.slice(0,120),rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}})),index:[...document.querySelectorAll('.space-index-button')].map(e=>e.textContent),composer:!!document.querySelector('.space-composer-dock textarea'),rightPanel:!!document.querySelector('.space-surface .uie-column-rail'),errors:[...document.querySelectorAll('vite-error-overlay')].length})");
 console.log(state);
 await shot('space-initial');
 fs.writeFileSync(path.join(folder,'initial.json'),state);
 if(exceptions.length) console.log(JSON.stringify({exceptions}));
} finally { ws.close(); }
