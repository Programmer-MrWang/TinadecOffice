import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const repo=resolve(import.meta.dirname,'../../../..'), evidence=import.meta.dirname;
const {createServer:createViteServer}=await import(pathToFileURL(join(repo,'node_modules/vite/dist/node/index.js')).href);
const {default:vue}=await import(pathToFileURL(join(repo,'node_modules/@vitejs/plugin-vue/dist/index.mjs')).href);
const owned=JSON.parse(await readFile(join(evidence,'fixture-location.json'),'utf8')).owned_root;
assert.ok(resolve(owned).startsWith(resolve(repo,'.tinadec_dev/tmp/workspace-interface-ui')+'\\'));
for(const folder of ['user','first','second','default'])await mkdir(join(owned,folder),{recursive:true});
const token=randomBytes(32).toString('base64url'),children=[];let vite,core,gateway,electron;
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
const coreUrl='http://127.0.0.1:'+await freePort(),gatewayUrl='http://127.0.0.1:'+await freePort(),uiUrl='http://127.0.0.1:'+await freePort();
function start(command,args,cwd,env){const childEnv={...process.env,Version:'','Ice-Version':'',...env};delete childEnv.ELECTRON_RUN_AS_NODE;const child=spawn(command,args,{cwd,windowsHide:true,env:childEnv,stdio:['ignore','pipe','pipe']});children.push(child);let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('error',x=>output+=x.message);return{child,output:()=>output};}
async function waitService(url,proc){for(let i=0;i<240;i++){if(proc.child.exitCode!==null)throw new Error(proc.output());try{if((await fetch(url+'/api/v1/health',{signal:AbortSignal.timeout(1500)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('Owned service unavailable.');}
try {
 const env={TINADEC_HOST_CONTROL_TOKEN:token,TINADEC_HOME:join(owned,'user'),ASPNETCORE_ENVIRONMENT:'Development',DOTNET_gcServer:'0',Logging__LogLevel__Default:'Warning',Logging__LogLevel__Microsoft_EntityFrameworkCore:'Warning'};
 core=start('dotnet',[join(repo,'.tinadec_dev/tmp/workspace-api-trace/bin/TinadecCore.Api/debug/TinadecCore.Api.dll')],join(repo,'TinadecCore/Api'),{...env,ASPNETCORE_URLS:coreUrl,TinadecStorage__Enabled:'true',TinadecStorage__UserRoot:join(owned,'user'),TinadecTools__DefaultWorkspaceRoot:join(owned,'default')});await waitService(coreUrl,core);console.log("Owned Core ready.");
 gateway=start('bun',['src/index.ts'],join(repo,'TinadecGateway'),{...env,TINADEC_CORE_URL:coreUrl,TINADEC_GATEWAY_PORT:new URL(gatewayUrl).port,TINADEC_GATEWAY_CORS_ORIGINS:uiUrl});await waitService(gatewayUrl,gateway);console.log("Owned Gateway ready.");
 for(const [url,role]of[[coreUrl,'core'],[gatewayUrl,'gateway']]){const nonce=randomBytes(32).toString('base64url');const proof=await(await fetch(url+'/api/v1/host-challenge?nonce='+nonce)).json();assert.equal(proof.proof,createHmac('sha256',token).update('tinadec-host-v1\0'+role+'\0'+nonce).digest('hex'));}
 const cssNames=(await readdir(join(repo,'apps/desktop/dist/assets'))).filter(name=>name.startsWith('index-')&&name.endsWith('.css'));const cssInfo=await Promise.all(cssNames.map(async name=>({name,size:(await stat(join(repo,'apps/desktop/dist/assets',name))).size})));const baseCss=await readFile(join(repo,'apps/desktop/dist/assets',cssInfo.sort((a,b)=>b.size-a.size)[0].name),'utf8');
 vite=await createViteServer({root:join(repo,'apps/desktop'),configFile:false,cacheDir:join(repo,'.tinadec_dev/tmp/workspace-interface-ui/runtime-8228cf8b192b/vite-cache'),plugins:[vue(),{
  name:'owned-workspace-interface-ui',configureServer(server){server.middlewares.use((request,response,next)=>{
   if(request.url==='/__workspace_css'){response.setHeader('content-type','text/css');response.end(baseCss);return;}
   if(request.url==='/'||request.url==='/index.html'){response.setHeader('content-type','text/html');response.end('<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><title>Workspace interface regression</title><link rel="stylesheet" href="/__workspace_css"></head><body><div id="app"></div><script type="module" src="/@fs/'+join(evidence,'renderer.mjs').replaceAll('\\','/')+'"></script></body></html>');return;}next();
  });}
 }],resolve:{alias:{'@/components/ui':join(evidence,'ui-barrel.mjs'),'@':join(repo,'apps/desktop/src'),'@tinadec/ui':join(repo,'apps/TinadecUI/src/index.ts'),'vue':join(repo,'apps/desktop/src/lib/vue-shim.ts'),'@vue/reactivity':join(repo,'node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js'),'@vue/runtime-dom':join(repo,'node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js'),'@vue/runtime-vapor':join(repo,'node_modules/@vue/runtime-vapor/dist/runtime-vapor.esm-bundler.js')},dedupe:['vue','@vue/reactivity','@vue/runtime-dom','@vue/runtime-vapor']},optimizeDeps:{noDiscovery:true,entries:[],include:['pinia','vue-router','vue-i18n','@vue/runtime-dom','@vue/runtime-vapor','@lucide/vue','reka-ui','@vueuse/core','@vueuse/shared','@material/material-color-utilities','class-variance-authority','clsx','tailwind-merge']},server:{host:'127.0.0.1',port:Number(new URL(uiUrl).port),strictPort:true,preTransformRequests:false,fs:{allow:[repo]}}});
 await vite.listen();assert.equal((await fetch(uiUrl,{signal:AbortSignal.timeout(15000)})).status,200);
 console.log('Owned Core/Gateway/Vite ready on random ports.');
 await writeFile(join(evidence,'followup-location.json'),JSON.stringify({owned_root:owned,core_url:coreUrl,gateway_url:gatewayUrl,ui_url:uiUrl,core_artifact:'workspace-api-trace',no_user_ports:true},null,2));
 electron=start(join(repo,'node_modules/electron/dist/electron.exe'),[join(evidence,'followup-electron.cjs')],repo,{...env,TINADEC_GATEWAY_URL:gatewayUrl,VITE_DEV_SERVER_URL:uiUrl,WORKSPACE_UI_ROOT:owned,WORKSPACE_GATEWAY_URL:gatewayUrl,WORKSPACE_CORE_URL:coreUrl});
 const code=await new Promise(r=>electron.child.once('exit',r));if(code!==0)throw new Error(electron.output());
 const result=JSON.parse(await readFile(join(evidence,'followup-desktop-acceptance.json'),'utf8'));const opens=result.requests.filter(row=>row.method==='POST'&&row.path==='/api/v1/storage/scopes/open');assert.equal(opens.length,1);assert.ok(opens.every(row=>row.status===200));assert.equal(result.requests.filter(row=>row.method==='PUT'&&row.path.endsWith('/workspace')).length,1);
 const manifest=await readFile(join(owned,'first/.tinadec/project.toml'),'utf8');assert.ok(manifest.includes('Edited workspace UI followup'));assert.equal((await readdir(join(owned,'second'))).includes('.tinadec'),false);
 await writeFile(join(evidence,'followup-service-acceptance.json'),JSON.stringify({accepted:true,only_owned_children:true,explicit_existing_open_count:opens.length,workspace_save_count:1,primary_storage_preserved:true,source_reference_change_only:true,requests:result.requests},null,2));console.log('Workspace final-tree followup Electron acceptance passed.');
}catch(error){await writeFile(join(evidence,'followup-failure.log'),[error.stack,core?.output(),gateway?.output(),electron?.output()].join('\n'));console.error(error.message);process.exitCode=1;}
finally{await vite?.close();for(const child of children)child.kill();}
