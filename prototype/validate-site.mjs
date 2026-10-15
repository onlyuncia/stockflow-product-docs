import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..'),dist=path.join(here,'dist');
const errors=[];
const files=(directory,extension)=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const filename=path.join(directory,entry.name);
  return entry.isDirectory()?files(filename,extension):filename.endsWith(extension)?[filename]:[];
});
function checkTarget(source,target){
  if(!target||target.startsWith('#')||/^(?:[a-z]+:|\/\/)/i.test(target))return;
  const relative=decodeURIComponent(target.split(/[?#]/,1)[0]);
  if(!relative)return;
  const resolved=path.resolve(path.dirname(source),relative);
  if(!fs.existsSync(resolved))errors.push(`${path.relative(root,source)}: missing ${target}`);
}
for(const source of files(dist,'.html')){
  const html=fs.readFileSync(source,'utf8');
  for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g))checkTarget(source,match[1]);
}
for(const source of [path.join(root,'README.md'),...files(path.join(root,'docs'),'.md')]){
  const markdown=fs.readFileSync(source,'utf8');
  for(const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g))checkTarget(source,match[1]);
}
const api=JSON.parse(fs.readFileSync(path.join(root,'docs','09-OPENAPI.json'),'utf8'));
const operationIds=new Set();
function visit(value){
  if(Array.isArray(value))return value.forEach(visit);
  if(!value||typeof value!=='object')return;
  if(value.$ref?.startsWith('#/')){
    try{
      let pointer=api;
      for(const token of value.$ref.slice(2).split('/')){
        pointer=pointer[token.replace(/~1/g,'/').replace(/~0/g,'~')];
        if(pointer===undefined)throw new Error('Missing pointer');
      }
    }catch{errors.push(`Unresolved OpenAPI reference: ${value.$ref}`);}
  }
  if(value.operationId){
    if(operationIds.has(value.operationId))errors.push(`Duplicate operationId: ${value.operationId}`);
    operationIds.add(value.operationId);
  }
  Object.values(value).forEach(visit);
}
visit(api);
for(const [route,item] of Object.entries(api.paths)){
  const names=[...route.matchAll(/\{([^}]+)\}/g)].map(match=>match[1]);
  for(const method of ['get','post','put','patch','delete']){
    if(!item[method])continue;
    const parameters=[...(item.parameters||[]),...(item[method].parameters||[])].map(parameter=>{
      if(!parameter.$ref)return parameter;
      return api.components.parameters[parameter.$ref.split('/').at(-1)];
    });
    for(const name of names)if(!parameters.some(p=>p?.name===name&&p.in==='path'&&p.required)){
      errors.push(`Missing required path parameter ${name}: ${method} ${route}`);
    }
  }
}
for(const filename of files(path.join(dist,'source','docs'),'.md')){
  if(fs.readFileSync(filename,'utf8')!==fs.readFileSync(path.join(root,'docs',path.basename(filename)),'utf8')){
    errors.push(`Stale document copy: ${path.basename(filename)}`);
  }
}
if(!fs.existsSync(path.join(dist,'assets','case-stockflow.pdf')))errors.push('Public case PDF is missing');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Validated local links, ${operationIds.size} API operations, document copies and public PDF.`);
