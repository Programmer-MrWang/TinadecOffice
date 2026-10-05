import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const developmentBridges=[
 ['.agents/skills','.tinadec_dev/skills'],
 ['.claude/skills','.tinadec_dev/skills'],
 ['.opencode/skills','.tinadec_dev/skills'],
 ['.opencode/plans','.tinadec_dev/plans/opencode'],
 ['.claude/plans','.tinadec_dev/plans/claude'],
 ['.agent/plans','.tinadec_dev/plans/agent'],
 ['.codebuddy/plans','.tinadec_dev/plans/codebuddy'],
 ['.qoder/repowiki','.tinadec_dev/wiki/qoder'],
 ['.qoder/better-harness','.tinadec_dev/reports/qoder/better-harness'],
 ['.claude/better-harness','.tinadec_dev/reports/claude/better-harness'],
 ['.trae/documents','.tinadec_dev/reports/trae'],
 ['.trae/specs','.tinadec_dev/specs/trae'],
 ['.zcode/plans','.tinadec_dev/plans/zcode'],
 ['.workbuddy/memory','.tinadec_dev/memory/workbuddy'],
 ['.ponytail','.tinadec_dev/tooling/ponytail'],
];
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function inside(root,relative){
 const absolute=path.resolve(root,relative),rel=path.relative(root,absolute);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw new Error('AI workspace path escapes repository: '+relative);
 return absolute;
}
function withinResolvedRoot(root,target){
 const real=fs.realpathSync(target),relative=path.relative(fs.realpathSync(root),real);
 if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('AI workspace parent resolves outside repository: '+target);
}
function existingAncestor(root,target){
 let current=target;
 for(;;){
  try{fs.lstatSync(current);}
  catch(e){if(e.code!=='ENOENT')throw e;const parent=path.dirname(current);if(parent===current)throw new Error('No safe workspace ancestor for '+target);current=parent;continue;}
  // An existing dangling link must fail; it is not a missing ordinary node.
  withinResolvedRoot(root,current);return;
 }
}
function mkdir(root,directory){existingAncestor(root,directory);fs.mkdirSync(directory,{recursive:true});withinResolvedRoot(root,directory);}
function mergeWithoutOverwrite(root,source,target,stats){
 for(const e of fs.readdirSync(source,{withFileTypes:true})){
  const from=path.join(source,e.name),to=path.join(target,e.name);
  if(e.isSymbolicLink())continue; // Its original remains in the local backup.
  existingAncestor(root,to);
  if(e.isDirectory()){
   if(fs.existsSync(to)&&!fs.statSync(to).isDirectory()){stats.preservedConflicts++;continue;}
   mkdir(root,to);mergeWithoutOverwrite(root,from,to,stats);
  }else if(e.isFile()){
   if(!fs.existsSync(to)){fs.copyFileSync(from,to);stats.importedFiles++;}
   else if(!fs.statSync(to).isFile()||digest(from)!==digest(to))stats.preservedConflicts++;
  }
 }
}
function jsonUpdate(root,file,update){
 existingAncestor(root,file);
 if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw new Error('Refusing to modify linked tool settings: '+file);
 const data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 const next={...data,...update};
 if(JSON.stringify(data)!==JSON.stringify(next)){mkdir(root,path.dirname(file));fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');}
}
export function setupAiWorkspace(root=defaultRoot){
 root=path.resolve(root);
 const canonical=inside(root,'.tinadec_dev');
 existingAncestor(root,canonical);
 if(!fs.existsSync(path.join(canonical,'OUTPUT-POLICY.md')))throw new Error('Missing tracked .tinadec_dev/OUTPUT-POLICY.md');
 if(!fs.existsSync(path.join(canonical,'skills/shadcn-vue/SKILL.md')))throw new Error('Missing tracked .tinadec_dev/skills/shadcn-vue');
 const stats={bridges:0,created:0,alreadyLinked:0,importedFiles:0,preservedConflicts:0,backupRoot:null};
 const timestamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
 const backupRoot=inside(root,'tmp/ai-workspace-backups/'+timestamp);
 for(const[from,to]of developmentBridges){
  const source=inside(root,from),target=inside(root,to);
  mkdir(root,path.dirname(source));mkdir(root,target);
  withinResolvedRoot(root,path.dirname(source));withinResolvedRoot(root,target);
  let existing=null;try{existing=fs.lstatSync(source);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(existing?.isSymbolicLink()){
   const actual=fs.realpathSync(source);
   if(path.relative(actual,fs.realpathSync(target))!=='')throw new Error('Existing tool link points to another location: '+from);
   stats.alreadyLinked++;stats.bridges++;continue;
  }
  if(existing){
   if(!existing.isDirectory())throw new Error('Tool output path is not a directory: '+from);
   withinResolvedRoot(root,source);
   mergeWithoutOverwrite(root,source,target,stats);
   const backup=inside(root,path.relative(root,path.join(backupRoot,from)));
   mkdir(root,path.dirname(backup));withinResolvedRoot(root,path.dirname(backup));
   // Both source and backup are checked absolute paths inside this repository.
   // The original is preserved; no recursive delete or shell-composed move.
   fs.renameSync(source,backup);stats.backupRoot=path.relative(root,backupRoot).replaceAll('\\','/');
  }
  fs.symlinkSync(process.platform==='win32'?target:path.relative(path.dirname(source),target),source,process.platform==='win32'?'junction':'dir');
  stats.created++;stats.bridges++;
 }
 // Claude supports these fields. Preserve every existing permissions/MCP/hook field.
 jsonUpdate(root,inside(root,'.claude/settings.json'),{plansDirectory:'.tinadec_dev/plans/claude'});
 const memory=inside(root,'.tinadec_dev/memory/claude');mkdir(root,memory);
 jsonUpdate(root,inside(root,'.claude/settings.local.json'),{plansDirectory:'.tinadec_dev/plans/claude',autoMemoryDirectory:memory});
 const launch=inside(root,'.claude/launch.json'),template=inside(root,'.tinadec_dev/tooling/claude/launch.json');
 existingAncestor(root,launch);existingAncestor(root,template);
 if(!fs.existsSync(launch)&&fs.existsSync(template))fs.copyFileSync(template,launch);
 const qoder=inside(root,'.qoder/mcp.json'),qoderTemplate=inside(root,'.tinadec_dev/tooling/qoder/mcp.json');
 existingAncestor(root,qoder);existingAncestor(root,qoderTemplate);
 if(!fs.existsSync(qoder)&&fs.existsSync(qoderTemplate))fs.copyFileSync(qoderTemplate,qoder);
 return stats;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(setupAiWorkspace()));
