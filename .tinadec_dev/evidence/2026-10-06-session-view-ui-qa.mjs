import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Read-only product data; only opens/closes the shared search UI and types a query.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-06-session-view-ui');
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
try{
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
 await evaluate("location.hash='/space'");await until("!!document.querySelector('.space-composer-dock')");
 result.space=await evaluate("(()=>{const b=document.querySelector('.space-composer-dock .composer-box');const sessions=document.querySelector('.sidebar').__vueParentComponent.props.sessions;return{toolbar:!!b.querySelector('.welcome-dialog-toolbar'),plus:!!b.querySelector('.welcome-dialog-plus'),input:!!b.querySelector('textarea'),actions:b.querySelectorAll('.composer-send-wrapper button').length,sessionTypes:sessions.map(s=>s.view_mode??'flat')}})()");
 assert.equal(result.space.toolbar,false);assert.equal(result.space.actions,1);assert.ok(result.space.plus&&result.space.input);assert.ok(result.space.sessionTypes.every(t=>t==='space'));
 await shot('space-single-row');
 await evaluate("document.querySelector('.sidebar-footer-action[aria-haspopup=dialog]').click();document.querySelectorAll('.sidebar-view-menu button')[0].click()");
 await until("!!document.querySelector('.conversation')");
 result.flat=await evaluate("(()=>{const b=document.querySelector('.conversation .composer-box');const sessions=document.querySelector('.sidebar').__vueParentComponent.props.sessions;return{toolbar:!!b.querySelector('.welcome-dialog-toolbar'),plus:!!b.querySelector('.welcome-dialog-plus'),input:!!b.querySelector('textarea'),actions:b.querySelectorAll('.composer-send-wrapper button').length,sessionTypes:sessions.map(s=>s.view_mode??'flat')}})()");
 assert.equal(result.flat.toolbar,false);assert.equal(result.flat.actions,1);assert.ok(result.flat.sessionTypes.every(t=>t==='flat'));
 await delay(900);await shot('flat-single-row');
 result.exceptions=exceptions;console.log(JSON.stringify(result));fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));
}finally{await call('Emulation.setFocusEmulationEnabled',{enabled:false}).catch(()=>{});ws.close();}
