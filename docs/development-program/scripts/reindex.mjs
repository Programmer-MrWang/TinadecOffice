import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read editable module documents; only rewrite derived global navigation.
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(base,'../..');
const registry=JSON.parse(fs.readFileSync(path.join(base,'modules.json'),'utf8'));
const errors=[],tasks=[],features=[],moduleStats=[];
const groups=registry.groups;
const states=['待核查','未开始','待方案','进行中','阻塞','待验收','已完成','不做','已被替代'];
const featureStates=['待核查','源码可见','部分实现','缺口已确认','范围边界','已验收','不适用'];
const ids=new Set(),nodeOwners=new Set();
const slash=s=>s.replaceAll('\\','/');
const escape=s=>String(s).replaceAll('|','\\|').replaceAll('\n',' ');
const toLink=(from,target)=>slash(path.relative(path.join(base,from),path.join(base,target)));
const add=(file,message)=>errors.push({file,message});
for(const m of registry.modules){
 const dir=path.join(base,m.path);
 for(const f of ['README.md','ARCHITECTURE.md','architecture.svg','STATUS.md','TODO.md'])if(!fs.existsSync(path.join(dir,f)))add(m.path,'Missing '+f);
 for(const id of m.nodeIds){if(nodeOwners.has(id))add(m.path,'Duplicate node owner '+id);nodeOwners.add(id);}
 const statusPath=m.path+'/STATUS.md',todoPath=m.path+'/TODO.md';
 if(!fs.existsSync(path.join(base,statusPath))||!fs.existsSync(path.join(base,todoPath)))continue;
 const status=fs.readFileSync(path.join(base,statusPath),'utf8');
 const ff=[];
 for(const row of status.split('\n').filter(s=>s.startsWith('| '+m.id+'-F'))){
  const parts=row.split(/(?<!\\)\|/).slice(1,-1).map(s=>s.trim());
  const [id,name,state,validation,boundary,evidence]=parts;
  if(ids.has(id))add(statusPath,'Duplicate feature ID '+id);ids.add(id);
  if(!featureStates.includes(state))add(statusPath,'Unknown feature state '+state);
  if(state==='已验收'&&(/未做|未跑|待验收|本轮静态/.test(validation)||!evidence||!evidence.includes('](')))add(statusPath,'Accepted feature lacks matching verification evidence '+id);
  const f={id,name,state,validation,boundary,module:m.id};features.push(f);ff.push(f);
 }
 if(!ff.length)add(statusPath,'No feature inventory');
 const text=fs.readFileSync(path.join(base,todoPath),'utf8');
 const matches=[...text.matchAll(/^### ([A-Z][A-Z0-9-]+-\d{3}) (.+)$/gm)];
 const tt=[];
 for(let i=0;i<matches.length;i++){
  const hit=matches[i],block=text.slice(hit.index,matches[i+1]?.index??text.length);
  const field=name=>block.match(new RegExp('^- '+name+'：(.+)$','m'))?.[1].trim();
  const t={id:hit[1],title:hit[2],type:field('类型'),state:field('状态'),priority:field('优先级'),owner:field('主责模块'),proof:field('完成证据'),file:todoPath,module:m.id};
  if(!t.id.startsWith(m.id+'-'))add(todoPath,'Wrong task prefix '+t.id);
  if(ids.has(t.id))add(todoPath,'Duplicate task ID '+t.id);ids.add(t.id);
  if(!states.includes(t.state))add(todoPath,'Unknown task state '+t.state);
  if(!['核查','实现','方案','验收'].includes(t.type))add(todoPath,'Unknown task type '+t.type);
  if(!['P0','P1','P2','P3'].includes(t.priority))add(todoPath,'Unknown priority '+t.priority);
  if(t.owner!==m.id)add(todoPath,'Task has wrong owner '+t.id);
  if(!block.includes('**验收条件**')||!/- \[[ x]\] /m.test(block))add(todoPath,'Missing acceptance criteria '+t.id);
  if(t.state==='已完成'&&(!t.proof||/未产生|待补|未填写/.test(t.proof)))add(todoPath,'Completed task lacks evidence '+t.id);
  if(t.state==='已完成'&&/- \[ \] /m.test(block))add(todoPath,'Completed task has unchecked acceptance criteria '+t.id);
  if(!text.includes('id="'+t.id.toLowerCase()+'"'))add(todoPath,'Missing stable task anchor '+t.id);
  tasks.push(t);tt.push(t);
 }
 if(!tt.length)add(todoPath,'No module tasks');
 moduleStats.push({module:m,features:ff,tasks:tt,review:status.match(/\*\*审计阶段：(.+?)。\*\*/)?.[1]??'待核查'});
}
const coreProjects=fs.readdirSync(path.join(repo,'TinadecCore'),{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='tests').flatMap(d=>fs.readdirSync(path.join(repo,'TinadecCore',d.name)).filter(f=>/\.(cs|fs)proj$/.test(f)).map(()=>d.name)).sort();
const coreModules=registry.modules.filter(m=>m.group==='core').map(m=>m.coreProject).sort();
if(JSON.stringify(coreProjects)!==JSON.stringify(coreModules))add('modules.json','Core project inventory differs: '+JSON.stringify({coreProjects,coreModules}));
const graph=JSON.parse(fs.readFileSync(path.join(base,'00-overview/architecture-model.json'),'utf8'));
for(const n of graph.nodes)if(!nodeOwners.has(n.id)&&!registry.nodeNavigation[n.id])add('modules.json','Architecture node unaccounted '+n.id);

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f];});}
const markdownFiles=walk(base).filter(f=>f.endsWith('.md'));
let links=0;
for(const f of markdownFiles){
 const text=fs.readFileSync(f,'utf8');
 for(const hit of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  let target=hit[1].trim().replace(/^<|>$/g,'');
  if(/^(?:https?:|mailto:|data:)/i.test(target))continue;
  const [resource,fragment]=target.split('#');
  if(!resource)continue;
  try{target=decodeURI(resource);}catch{add(slash(path.relative(base,f)),'Bad link '+resource);continue;}
  const resolved=path.resolve(path.dirname(f),target);links++;
  const derived=['MODULE-INDEX.md','01-program/MASTER-TODO.md','01-program/STATUS.md','03-evidence/2026-10-05-initial-source/documentation-checks.json'];
  if(!fs.existsSync(resolved)&&!derived.includes(slash(path.relative(base,resolved))))add(slash(path.relative(base,f)),'Broken link '+resource);
  else if(fragment&&/^[a-z0-9-]+-\d{3}$/.test(fragment)&&resolved.endsWith('TODO.md')&&!fs.readFileSync(resolved,'utf8').includes('id="'+fragment+'"'))add(slash(path.relative(base,f)),'Broken task anchor '+fragment);
 }
}
// Initial source inventories use repo paths and may include :line suffixes.
for(const f of walk(path.join(base,'03-evidence')).filter(f=>f.endsWith('-seeds.json'))){
 const input=JSON.parse(fs.readFileSync(f,'utf8'));
 for(const s of Object.values(input))for(const rec of [...(s.facts??[]),...(s.tasks??[])]){
  for(const evidence of rec.evidence??[])if(!fs.existsSync(path.join(repo,evidence.replace(/:\d+$/,''))))add(slash(path.relative(base,f)),'Missing evidence '+evidence);
  for(const legacy of rec.legacy??[])if(!fs.existsSync(path.join(repo,legacy.file)))add(slash(path.relative(base,f)),'Missing historical source '+legacy.file);
 }
}
if(errors.length){console.error(JSON.stringify({errors},null,2));process.exitCode=1;}
else{
 const counts=Object.fromEntries(states.map(s=>[s,tasks.filter(t=>t.state===s).length]));
 const featureCounts=Object.fromEntries(featureStates.map(s=>[s,features.filter(f=>f.state===s).length]));
 let index='# 模块总索引\n\n由模块STATUS/TODO生成；修改这些源文件后执行 `node docs/development-program/scripts/reindex.mjs` 刷新。模块目录是长期入口，完成情况只按证据记录，当前不计算完成百分比。\n\n';
 for(const [group,label]of Object.entries(groups)){
  index+='## '+label+'\n\n| 模块ID | 模块档案 | 初始/当前审计阶段 | 功能条目 | 已验收 | TODO |\n| --- | --- | --- | --- | --- | --- |\n';
  for(const s of moduleStats.filter(s=>s.module.group===group)){const m=s.module;index+='| '+m.id+' | ['+escape(m.title)+']('+m.path+'/README.md) | '+escape(s.review)+' | '+s.features.length+' | '+s.features.filter(f=>f.state==='已验收').length+' | ['+s.tasks.length+'项]('+m.path+'/TODO.md) |\n';}
  index+='\n';
 }
 fs.writeFileSync(path.join(base,'MODULE-INDEX.md'),index);
 let todo='# 总TODO / 唯一任务正文的导航\n\n本文件由各模块TODO.md生成，不在这里编辑任务状态。每个Task ID链接回主责模块；缺口由一个模块拥有，其它模块引用。\n\n';
 todo+='| 状态 | 数量 |\n| --- | --- |\n'+states.map(s=>'| '+s+' | '+counts[s]+' |').join('\n')+'\n\n';
 todo+='## 当前任务\n\n| Task ID | 任务 | 类型 | 状态 | 优先级 | 主责 |\n| --- | --- | --- | --- | --- | --- |\n';
 const sorted=[...tasks].sort((a,b)=>a.priority.localeCompare(b.priority)||a.module.localeCompare(b.module)||a.id.localeCompare(b.id));
 todo+=sorted.map(t=>'| ['+t.id+']('+toLink('01-program',t.file)+'#'+t.id.toLowerCase()+') | '+escape(t.title)+' | '+t.type+' | '+t.state+' | '+t.priority+' | '+t.owner+' |').join('\n')+'\n';
 fs.writeFileSync(path.join(base,'01-program/MASTER-TODO.md'),todo);
 let status='# 工程状态 / 按证据记录\n\n本文件从模块STATUS/TODO派生；模块源码可见不等于功能完成。初始清点只证明找到了实现/边界/缺口，完整逐功能审计与真实运行验收尚未完成。\n\n';
 status+='- 模块档案：'+registry.modules.length+'。\n- Core工程覆盖：'+coreModules.length+'/'+coreProjects.length+'。\n- 已登记功能条目：'+features.length+'（部分仍是聚合能力，后续拆分）。\n- 已登记任务：'+tasks.length+'。\n- 总图节点归属/导航：'+graph.nodes.length+'/'+graph.nodes.length+'。\n\n';
 status+='## 功能判断分布\n\n| 判断 | 数量 |\n| --- | --- |\n'+featureStates.map(s=>'| '+s+' | '+featureCounts[s]+' |').join('\n')+'\n\n';
 status+='## 任务状态分布\n\n| 状态 | 数量 |\n| --- | --- |\n'+states.map(s=>'| '+s+' | '+counts[s]+' |').join('\n')+'\n\n';
 status+='## 验证边界\n\n本轮文档工程只核对源码/工程引用/历史报告与文档、图形；业务功能没有在本轮重跑验收。历史测试结果仅作为来源记录。没有将任何初始功能直接标为已验收，也没有把初始任务标为已完成。后续每次更新均以模块正文和明确证据为准。\n\n[模块索引](../MODULE-INDEX.md) · [总TODO](MASTER-TODO.md) · [初始证据](../03-evidence/2026-10-05-initial-source/README.md)\n';
 fs.writeFileSync(path.join(base,'01-program/STATUS.md'),status);
 const report={baseline:registry.baseline,moduleCount:registry.modules.length,coreProjectCoverage:{expected:coreProjects.length,actual:coreModules.length},architectureNodeCoverage:{expected:graph.nodes.length,actual:graph.nodes.length},featureCount:features.length,taskCount:tasks.length,markdownFiles:markdownFiles.length,checkedLinks:links,uniqueIdCount:ids.size,errors:[],scope:'documentation/source checks only; no product tests rerun'};
 fs.writeFileSync(path.join(base,'03-evidence/2026-10-05-initial-source/documentation-checks.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
