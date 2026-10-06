import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Read-only product data; only opens/closes the shared search UI and types a query.
const folder=path.resolve('.tinadec_dev/evidence/2026-10-06-search-ui');
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
try{
 await call('Runtime.enable');await call('Page.enable');await call('Page.bringToFront');
 console.log('Connected to running Desktop');
 await evaluate(`document.querySelector('dialog.command-palette[open] [data-testid="palette-close"]')?.click()`);
 await until(`document.querySelectorAll('.window-controls .window-btn,.settings-window-controls .window-btn').length>=4`);
 const chrome=await evaluate(`Array.from(document.querySelectorAll('.window-controls .window-btn,.settings-window-controls .window-btn')).map(e=>{const s=getComputedStyle(e);return{label:e.getAttribute('aria-label'),background:s.backgroundColor,shadow:s.boxShadow,border:s.borderWidth,radius:s.borderRadius,width:s.width,height:s.height}})`);
 if(!chrome.length)throw new Error('Window control strip not mounted');
 assert.ok(chrome.every(c=>c.background==='rgba(0, 0, 0, 0)'&&c.shadow==='none'&&c.border==='0px'));
 await shot('window-chrome');
 console.log('Window chrome styles read');
 await evaluate(`document.querySelector('[data-testid="command-palette-button"]').click()`);
 await until(`!!document.querySelector('dialog.command-palette[open]')&&document.activeElement?.getAttribute('data-testid')==='palette-input'`);
 await until(`document.querySelector('[data-testid="palette-list"]').getAttribute('aria-busy')==='false'`);
 const search=await evaluate(`(()=>{const d=document.querySelector('dialog.command-palette'),s=getComputedStyle(d);return{width:d.getBoundingClientRect().width,height:d.getBoundingClientRect().height,viewport:{width:innerWidth,height:innerHeight},background:s.backgroundColor,shadow:s.boxShadow,inlineInputs:document.querySelectorAll('[data-testid="palette-entry-input"]').length,categoryCount:d.querySelectorAll('.search-category').length,resultIcons:d.querySelectorAll('.search-result-icon').length,windowControls:d.querySelectorAll('.window-controls .window-btn').length,errors:d.querySelectorAll('.search-source-error').length,rows:d.querySelectorAll('[role="option"]').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth}})()`);
 search.defaultFloating=await evaluate(`!document.querySelector('dialog.command-palette').classList.contains('command-palette--fullscreen')`);
 search.inputShadow=await evaluate(`getComputedStyle(document.querySelector('[data-testid="palette-input"]')).boxShadow`);
 assert.ok(search.defaultFloating&&search.width<search.viewport.width&&search.height<search.viewport.height);
 assert.equal(search.inlineInputs,0);
 assert.equal(search.categoryCount,11);
 assert.equal(search.shadow,'none');
 assert.equal(search.inputShadow,'none');
 const more=await evaluate(`(()=>{const b=document.querySelector('[data-testid="palette-more-command"]');if(!b)return{available:false};const before=document.querySelector('[data-testid="palette-kind-command"]').querySelectorAll('[role="option"]').length;b.click();return{available:true,before}})()`);
 if(more.available){
  await delay(100);
  more.expanded=await evaluate(`document.querySelector('[data-testid="palette-more-command"]').getAttribute('aria-expanded')==='true'&&document.querySelector('[data-testid="palette-kind-command"]').querySelectorAll('[role="option"]').length>4`);
  assert.ok(more.expanded);
  await evaluate(`document.querySelector('[data-testid="palette-more-command"]').click()`);
 }
 const fold=await evaluate(`(()=>{const toggle=document.querySelector('[data-testid="palette-toggle-project"]');if(!toggle)return{available:false};const before=document.querySelectorAll('[data-testid^="palette-row-project."]').length;toggle.click();return{available:true,before}})()`);
 if(fold.available){
  await delay(100);
  fold.collapsed=await evaluate(`document.querySelectorAll('[data-testid^="palette-row-project."]').length===0`);
  assert.ok(fold.collapsed);
  await evaluate(`document.querySelector('[data-testid="palette-toggle-project"]').click()`);
 }
 await delay(100);
 await shot('search-floating');
 const query=await evaluate(`(()=>{const row=document.querySelector('[data-testid^="palette-row-project."] .command-palette-label');return row?.textContent?.trim()||'Tinadec'})()`);
 await evaluate(`(()=>{const i=document.querySelector('[data-testid="palette-input"]');i.value=${JSON.stringify(query)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
 await delay(250);
 await until(`document.querySelector('[data-testid="palette-list"]').getAttribute('aria-busy')==='false'`);
 const queried=await evaluate(`({text:document.querySelector('[data-testid="palette-input"]').value,rows:document.querySelectorAll('[role="option"]').length,errors:document.querySelectorAll('.search-source-error').length})`);
 assert.ok(queried.rows>0);
 await evaluate(`document.querySelector('[data-testid="palette-filter-project"]').click()`);
 await delay(100);
 queried.filterProject=await evaluate(`Array.from(document.querySelectorAll('.search-result-group')).every(e=>e.getAttribute('data-testid')==='palette-kind-project')`);
 assert.ok(queried.filterProject);
 await evaluate(`document.querySelector('[data-testid="palette-filter-all"]').click();document.querySelector('[data-testid="palette-input"]').value='';document.querySelector('[data-testid="palette-input"]').dispatchEvent(new Event('input',{bubbles:true}))`);
 await delay(250);
 await until(`document.querySelector('[data-testid="palette-list"]').getAttribute('aria-busy')==='false'`);
 await call('Emulation.setDeviceMetricsOverride',{width:640,height:760,deviceScaleFactor:1,mobile:false});
 await delay(200);
 const narrow=await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,listHeight:document.querySelector('[data-testid="palette-list"]').getBoundingClientRect().height,categoryScrollable:document.querySelector('.search-categories').scrollWidth>document.querySelector('.search-categories').clientWidth})`);
 assert.ok(!narrow.overflow&&narrow.listHeight>0);
 await call('Emulation.clearDeviceMetricsOverride');
 await evaluate(`document.querySelector('[data-testid="palette-fullscreen"]').click()`);
 await delay(100);
 const expanded=await evaluate(`document.querySelector('dialog.command-palette').classList.contains('command-palette--fullscreen')`);
 assert.ok(expanded);
 await evaluate(`document.querySelector('[data-testid="palette-fullscreen"]').click()`);
 await delay(100);
 assert.ok(await evaluate(`!document.querySelector('dialog.command-palette').classList.contains('command-palette--fullscreen')`));
 await evaluate(`document.querySelector('[data-testid="palette-fullscreen"]').click()`);
 await evaluate(`document.querySelector('[data-testid="palette-close"]').click()`);
 await until(`!document.querySelector('dialog.command-palette').open`);
 await evaluate(`document.querySelector('[data-testid="command-palette-button"]').click()`);
 await until(`!!document.querySelector('dialog.command-palette[open]')`);
 const reopenedFloating=await evaluate(`!document.querySelector('dialog.command-palette').classList.contains('command-palette--fullscreen')`);
 assert.ok(reopenedFloating);
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until(`!document.querySelector('dialog.command-palette').open`);
 assert.equal(exceptions.length,0);
 const result={chrome,search,more,fold,queried,narrow,expanded,reopenedFloating,escapeClosed:true,exceptions,captureErrors,scope:'running Electron renderer, current backend read queries; no model interaction or write action'};
 fs.writeFileSync(path.join(folder,'checks.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await evaluate(`document.querySelector('dialog.command-palette[open] [data-testid="palette-close"]')?.click()`).catch(()=>{});await call('Emulation.clearDeviceMetricsOverride').catch(()=>{});ws.close();}
