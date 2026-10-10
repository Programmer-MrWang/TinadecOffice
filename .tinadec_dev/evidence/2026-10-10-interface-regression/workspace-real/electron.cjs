'use strict';
const electron=require('electron'), {app,BrowserWindow}=electron;
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict'), Module=require('node:module');
const repo=path.resolve(__dirname,'../../../..'), desktop=path.join(repo,'apps/desktop/electron');
const owned=process.env.WORKSPACE_UI_ROOT, evidence=__dirname, gateway=process.env.WORKSPACE_GATEWAY_URL, core=process.env.WORKSPACE_CORE_URL, token=process.env.TINADEC_HOST_CONTROL_TOKEN;
const services=require(path.join(desktop,'serviceManager.cjs')), identity=require(path.join(desktop,'hostIdentity.cjs'));
let window,picks=0; const events=[],requests=[],uiEvents=[]; function record(type,value){uiEvents.push({type,value});fs.writeFileSync(path.join(evidence,"electron-progress.json"),JSON.stringify(uiEvents,null,2));}
const load=Module._load;
function FixtureWindow(options) {
 window=new BrowserWindow({...options,show:false,webPreferences:{...options.webPreferences,offscreen:true,backgroundThrottling:false}});
 window.show=()=>{};window.webContents.openDevTools=()=>{}; window.webContents.on("did-start-loading",()=>record("loading",true));window.webContents.on("did-finish-load",()=>record("loaded",true));window.webContents.on("did-fail-load",(_event,code,message)=>record("load_failed",{code,message}));window.webContents.on("console-message",(_event,_level,message)=>record("console",String(message)));
 const webRequest=window.webContents.session.webRequest, originalBefore=webRequest.onBeforeSendHeaders.bind(webRequest);
 webRequest.onBeforeSendHeaders=(filter,callback)=>originalBefore(filter,(details,done)=>{
   const url=new URL(details.url); let mapped=details.url;
   if(url.origin===gateway) mapped='http://127.0.0.1:48730'+url.pathname+url.search;
   else if(url.origin===core) mapped='http://127.0.0.1:48731'+url.pathname+url.search;
   else if(url.port==='48730'||url.port==='48731') mapped='http://unowned.invalid'+url.pathname;
   callback({...details,url:mapped},done);
 });
 webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,done)=>{record('request',{method:details.method,path:new URL(details.url).pathname});done({});});webRequest.onCompleted({urls:['http://*/*','https://*/*']},details=>{record('response',{method:details.method,path:new URL(details.url).pathname,status:details.statusCode});if(new URL(details.url).origin===gateway)requests.push({method:details.method,path:new URL(details.url).pathname+new URL(details.url).search,status:details.statusCode});});webRequest.onErrorOccurred({urls:['http://*/*','https://*/*']},details=>record('network_error',{path:new URL(details.url).pathname,error:details.error}));
 return window;
}
FixtureWindow.getAllWindows=BrowserWindow.getAllWindows; FixtureWindow.fromId=BrowserWindow.fromId; FixtureWindow.fromWebContents=BrowserWindow.fromWebContents;
const realFetch=global.fetch;
Module._load=function(request,parent,isMain){
 if(parent?.filename===path.join(desktop,'main.cjs')){
  if(request==='electron') return {...electron,BrowserWindow:FixtureWindow,dialog:{...electron.dialog,showOpenDialog:async()=>({canceled:false,filePaths:++picks===1?[path.join(owned,'first'),path.join(owned,'second')]:[path.join(owned,'first')]})}};
  if(request==='./serviceManager.cjs')return {...services,canonicalLocalGatewayUrl:url=>url===gateway?gateway:null,ensureLocalServices:async()=>({started:false}),stopLocalServices:async()=>{}};
  if(request==='./hostIdentity.cjs')return {...identity,verifyManagedHost:(key,options)=>identity.verifyManagedHost(key,{...options,fetchImpl:(url,init)=>{
   const parsed=new URL(url);return realFetch((parsed.port==='48731'?core:gateway)+parsed.pathname+parsed.search,init);
  }})};
 }
 return load.call(this,request,parent,isMain);
};
async function js(expression){return window.webContents.executeJavaScript(expression);}
async function wait(expression){for(let i=0;i<400;i++){if(window&&!window.isDestroyed()&&await js(expression))return;await new Promise(r=>setTimeout(r,150));}throw new Error('UI timeout: '+expression);}
async function click(selector){await js('document.querySelector('+JSON.stringify(selector)+').click()');}
async function capture(name){await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await new Promise(r=>setTimeout(r,500));fs.writeFileSync(path.join(evidence,name+'.png'),(await window.webContents.capturePage()).toPNG());}
const timeout=setTimeout(()=>{console.error('Workspace real acceptance timeout');app.exit(1);},360000);
async function run(){
 try{
  record('fixture_loaded',true);await wait('window.__workspaceFixture?.ready===true && !window.__workspaceFixture.c.busy.value');
  assert.equal((await js('window.tinadec.getHostStatus()')).state,'ready');events.push({step:'real_identity_and_preload',ready:true});
  await click('.workspace-section-add');await wait('document.querySelector(".workspace-add-folders")!==null');await click('.workspace-add-folders');
  await wait('document.querySelectorAll(".workspace-source-list li").length===2');
  assert.equal(fs.existsSync(path.join(owned,'first/.tinadec')),false);assert.equal(fs.existsSync(path.join(owned,'second/.tinadec')),false);
  await capture('workspace-create'); await click('.workspace-dialog button[type=submit]');
  await wait('window.__workspaceFixture.c.projects.value.length===1 && !window.__workspaceFixture.c.workspaceEditor.value.open');
  assert.equal(fs.existsSync(path.join(owned,'first/.tinadec/project.toml')),true);assert.equal(fs.existsSync(path.join(owned,'second/.tinadec')),false);
  events.push({step:'created',only_primary_initialized:true,single_submit:true});
  await js('window.__workspaceFixture.createdId=window.__workspaceFixture.c.projects.value[0].id;window.__workspaceFixture.createdStorage=window.__workspaceFixture.c.projects.value[0].storage_id;window.__workspaceFixture.c.createSession(window.__workspaceFixture.selectionKey(window.__workspaceFixture.c.projects.value[0]))');
  await wait('window.__workspaceFixture.c.sessions.value.length===1');
  await js('window.__workspaceFixture.sessionId=window.__workspaceFixture.c.sessions.value[0].id;window.__workspaceFixture.c.renameSession(window.__workspaceFixture.createdStorage+"::"+window.__workspaceFixture.sessionId,"接口回归历史会话")');
  await wait('window.__workspaceFixture.c.sessions.value[0].title==="接口回归历史会话"');
  events.push({step:'real_session_created_and_renamed',persistent_history:true});
  await capture('workspace-created');
  await window.webContents.reload(); await wait('window.__workspaceFixture?.ready===true && window.__workspaceFixture.c.projects.value.length===1 && window.__workspaceFixture.c.sessions.value.length===1 && !window.__workspaceFixture.c.busy.value');
  assert.equal(await js('window.__workspaceFixture.c.sessions.value[0].title'),'接口回归历史会话');
  events.push({step:'renderer_reload',real_workspace_and_history_restored:true});
  await js('window.__workspaceFixture.c.editWorkspace(window.__workspaceFixture.selectionKey(window.__workspaceFixture.c.projects.value[0]))');
  await wait('document.querySelectorAll(".workspace-source-list li").length===2');
  await js('const input=document.querySelector(".workspace-dialog input");input.value="Edited workspace";input.dispatchEvent(new Event("input",{bubbles:true}));');
  await js('Array.from(document.querySelectorAll(".workspace-dialog button")).find(button=>button.textContent.trim()==="设为主要").click()');
  await click('.workspace-dialog button[type=submit]');await wait('!window.__workspaceFixture.c.workspaceEditor.value.open');
  assert.equal(fs.existsSync(path.join(owned,'second/.tinadec')),false);events.push({step:'edited_primary',storage_unchanged:true});
  await click('.workspace-section-add');await wait('document.querySelector(".workspace-add-folders")!==null');await click('.workspace-add-folders');
  await wait('document.querySelector(".workspace-existing")!==null'); await capture('workspace-existing');await click('.workspace-dialog button[type=submit]');
  await wait('!window.__workspaceFixture.c.workspaceEditor.value.open');assert.equal(await js('window.__workspaceFixture.c.projects.value.length'),1);
  events.push({step:'explicit_existing_open',no_overwrite:true});
  await window.webContents.reload(); await wait('window.__workspaceFixture?.ready===true && window.__workspaceFixture.c.projects.value.length===1 && window.__workspaceFixture.c.sessions.value.length===1 && !window.__workspaceFixture.c.busy.value');
  await capture('workspace-restored');
  const output={accepted:true,electron:process.versions.electron,actual_main:true,actual_preload:true,actual_desktop_components:true,real_core_gateway:true,isolated_user_root:true,random_ports:true,native_picker:'mocked_return_values_production_handler',managed_endpoint_adapter:true,externally_started_service_lifecycle:true,events,requests};
  fs.writeFileSync(path.join(evidence,'desktop-acceptance.json'),JSON.stringify(output,null,2));clearTimeout(timeout);app.exit(0);
 }catch(error){console.error(error.stack);await capture('desktop-failure').catch(()=>{});fs.writeFileSync(path.join(evidence,'desktop-failure.json'),JSON.stringify({message:error.message,events,requests},null,2));clearTimeout(timeout);app.exit(1);}
}
app.on('browser-window-created',(_event,win)=>win.webContents.once('did-finish-load',()=>{void run();}));
require(path.join(desktop,'main.cjs'));
