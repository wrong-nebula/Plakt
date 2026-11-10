import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='output/designer-references',catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
await fs.mkdir(path.join(root,'images'),{recursive:true});
const selected=[];
for(const profile of catalog.profiles){
 const all=catalog.works.filter(w=>w.designerID===profile.id);
 const posters=all.filter(w=>/poster|plakat|affiche/i.test(w.title+' '+w.medium));
 const pool=(posters.length>=12?posters:all).sort((a,b)=>a.date.localeCompare(b.date)||a.workID.localeCompare(b.workID));
 const limit=Math.min(24,pool.length),indices=new Set();
 for(let i=0;i<limit;i++)indices.add(Math.floor(i*(pool.length-1)/Math.max(1,limit-1)));
 selected.push(...[...indices].map(i=>pool[i]));
}
const output=[];let failures=[];
for(const [i,work]of selected.entries()){
 const relative=`images/${work.designerID}/${work.workID}.jpg`,file=path.join(root,relative);await fs.mkdir(path.dirname(file),{recursive:true});
 try{
  let bytes;
  try{bytes=await fs.readFile(file)}catch{
   const response=await fetch(work.imageURL,{headers:{'User-Agent':'PosterLab personal graphic-design study'},signal:AbortSignal.timeout(30000)});
   if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error(`HTTP ${response.status}`);
   bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<1000)throw Error('Image too small');await fs.writeFile(file,bytes);
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  output.push({...work,localImagePath:path.resolve(file),imageSHA256:createHash('sha256').update(bytes).digest('hex')});
 }catch(error){failures.push({workID:work.workID,designer:work.designer,error:error.message})}
 if(i%12===0||i===selected.length-1){console.log(`${i+1}/${selected.length}: ${output.length} downloaded · ${failures.length} failures`);await fs.writeFile(path.join(root,'dataset.json'),JSON.stringify({version:'real-designer-works-v1',metadataSource:catalog.datasetURL,works:output,failures},null,2))}
}
console.log('Complete',output.length,'works',new Set(output.map(w=>w.designerID)).size,'designers');
