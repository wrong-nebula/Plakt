import { adapters,fit,textPath,normalizedGlyph,closeContours } from './adapters.mjs';
import { browserAdapters,closeBrowser } from './browser-adapters.mjs';
import { Resvg } from '@resvg/resvg-js';
import Commander from 'svg-path-commander';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {performance} from 'node:perf_hooks';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const exec=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);const option=(key,fallback)=>{const i=argv.indexOf(key);return i<0?fallback:argv[i+1]};
const rounds=Number(option('--rounds',3)),population=Number(option('--population',4));
if(!Number.isInteger(rounds)||rounds<2||rounds>10||!Number.isInteger(population)||population<4||population>8)throw Error('Use 2–10 rounds and 4–8 candidates per backend');
const out=path.resolve(option('--out',path.join(root,'output/geometry-comparison')));
await mkdir(out,{recursive:true});
try{await readFile(path.join(out,'summary.json'));throw Error('Completed comparison exists. Choose a fresh --out folder.')}catch(e){if(e.code!=='ENOENT')throw e}
const registry=JSON.parse(await readFile(path.join(root,'geometry-bench/registry.json')));
const imports=JSON.parse(await readFile(path.join(root,'geometry-bench/imports.json')));
const all=[...adapters,...browserAdapters];
const timing=new Map(),failures=[];
let previous=[],previousSamples=[];
const safe=s=>s.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function random(seed){let state=seed>>>0;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296}}
function initial(seed){const r=random(seed);return{warp:r(),offset:2+r()*11,stretch:.78+r()*.5,tilt:-18+r()*36,repetition:.3+r()*.6}}
function mutate(p,seed){const r=random(seed);return {warp:clamp(p.warp+(r()-.5)*.38,0,1),offset:clamp(p.offset+(r()-.5)*5,1,16),stretch:clamp(p.stretch+(r()-.5)*.25,.65,1.5),tilt:clamp(p.tilt+(r()-.5)*15,-30,30),repetition:clamp(p.repetition+(r()-.5)*.3,.2,1)}}
const title=(s,x,y,w,h)=>fit(textPath(s),x,y,w,h);
function poster(motif,p,seed){
 let content='';
 const add=(s,x,y,w,h)=>content+=title(s,x,y,w,h);
 add('Visual Communication Institute',20,18,470,14);add('FORM / TYPE / SYSTEM',695,18,280,14);
 // Primary text remains identical across libraries for the same parameters.
 for(const [i,s] of ['VISUAL','COMMUNICATION','INSTITUTE','OF DESIGN'].entries())add(s,505,60+i*76,480,70);
 const letters=Array.from('VISUAL COMMUNICATION / DESIGN / ');
 for(let i=0;i<letters.length;i++){const a=i/letters.length*Math.PI*2-.8;content+=`<g transform="translate(${240+160*Math.cos(a)} ${220+160*Math.sin(a)}) rotate(${a*180/Math.PI+90})">${title(letters[i],-10,-24,20,24)}</g>`}
 add('V',175,140,130,165);
 if(motif.image){content+=`<image x="20" y="425" width="470" height="480" preserveAspectRatio="none" href="data:image/png;base64,${motif.image}"/>`}
 else {
  const b=Commander.getPathBBox(motif.d);if(!Number.isFinite(b.width)||!b.width||!b.height)throw Error('Empty/nonfinite motif bounds');
  const attrs=motif.fill?'fill="#f0f0f0"':'fill="none" stroke="#f0f0f0" stroke-width="5"';
  content+=`<g ${attrs}>${fit(motif.d,20,420,470,480)}</g>`;
 }
 for(let col=0;col<2;col++)for(let row=0;row<5;row++){
  const cx=565+col*140,cy=455+row*91,r=39;
  content+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col?'#f0f0f0':'none'}" stroke="#f0f0f0" stroke-width="2"/>`;
  content+=`<g fill="${col?'#080808':'#f0f0f0'}">${title(['V','C','I','D'][row%4],cx-21,cy-26,42,52)}</g>`;
 }
 for(let i=0;i<18;i++){const h=22;add('VISUAL COMMUNICATION'.slice(0,i+1),790,420+i*26,24+i*10,h)}
 for(let i=0;i<8;i++){
  const x=18+i*123;content+=`<path d="M${x} 926h112l-56 84Z"/>`;
  if(i%2)content+=`<circle cx="${x+56}" cy="951" r="21" fill="#080808"/>`;
 }
 add('VISUAL',20,1030,290,52);content+=`<g transform="translate(60 1095) rotate(90)">${title('COMMUNICATION',0,0,260,40)}</g>`;
 add('V',98,1100,200,200);add('DESIGN',90,1320,230,45);
 const repeats=8+Math.round(p.repetition*15);
 for(let row=0;row<4;row++){
  for(let i=0;i<repeats;i++){
   const xx=365+i*(340/(repeats-1));content+=`<ellipse cx="${xx}" cy="${1075+row*87}" rx="49" ry="43" fill="#f0f0f0" stroke="#080808" stroke-width="1.6"/>`;
  }
  content+=`<g fill="#080808">${title(['V','C','I','D'][row],688,1046+row*87,40,55)}</g>`;
 }
 for(let i=0;i<7;i++){
  const yy=1040+i*45;content+=`<rect x="795" y="${yy}" width="180" height="36" rx="18" fill="none" stroke="#f0f0f0" stroke-width="1.6"/>`;
  add(['Institute','of','Design','Visual'][i%4],809,yy+6,150,23);
 }
 add('FORM / TYPE / SYSTEM',20,1390,540,12);add(String(seed),820,1390,155,12);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1414" viewBox="0 0 1000 1414"><rect width="1000" height="1414" fill="#080808"/><g fill="#f0f0f0">${content}</g></svg>`;
}
const history=[];
try{
 for(let generation=0;generation<rounds;generation++){
  const folder=path.join(out,`generation-${generation}`);await mkdir(folder,{recursive:true});
  const samples=[];
  for(const [backendIndex,adapter] of all.entries()){
   const parents=previous.filter(c=>previousSamples.find(s=>s.id===c.id)?.backend===adapter.name).slice(0,2);
   const genes=[];
   for(let i=0;i<population;i++){
    if(generation===0||!parents.length){const seed=2026+i;genes.push({seed,parameters:initial(seed)})}
    else {
     const parent=previousSamples.find(s=>s.id===parents[i%parents.length].id);
     const seed=i===0?parent.seed:(2026+generation*1234567+backendIndex*100003+i*9791)>>>0;
     genes.push({seed,parameters:i===0?parent.parameters:mutate(parent.parameters,seed),parent:parent.id});
    }
   }
   for(const [i,gene] of genes.entries()){
    const id=`${safe(adapter.name)}-g${generation}-s${gene.seed}-i${i}`;
    try{
     const start=performance.now();const motif=await adapter.make(gene.parameters);const operationMs=performance.now()-start;
     if(!motif.image && (!motif.d || /NaN|Infinity/.test(motif.d)))throw Error('Invalid/empty SVG path');
     const svg=poster(motif,gene.parameters,gene.seed);
     const svgPath=path.join(folder,id+'.svg'),pngPath=path.join(folder,id+'.png');
     await writeFile(svgPath,svg);const rasterStart=performance.now();
     const png=new Resvg(svg,{fitTo:{mode:'width',value:700}}).render().asPng();await writeFile(pngPath,png);
     const record={operationMs,rasterMs:performance.now()-rasterStart,pathBytes:motif.d?.length??0,svgBytes:Buffer.byteLength(svg),imageBytes:png.length};
     if(!timing.has(adapter.name))timing.set(adapter.name,[]);timing.get(adapter.name).push(record);
     samples.push({id,backend:adapter.name,seed:gene.seed,generation,imageURL:pathToFileURL(pngPath).href,parameters:gene.parameters});
    }catch(e){failures.push({backend:adapter.name,generation,seed:gene.seed,error:e.message});console.log('FAIL',adapter.name,e.message.split('\n')[0])}
   }
   console.log(`round ${generation} / ${adapter.name}: ${samples.filter(s=>s.backend===adapter.name).length}/${population}`);
  }
  const input=path.join(folder,'samples.json'),report=path.join(folder,'judging.json');await writeFile(input,JSON.stringify(samples,null,2));
  const {stdout}=await exec(path.join(root,'dist/poster'),['judge-images','--input',input,'--out',report],{maxBuffer:4e6,timeout:240000});console.log(stdout.trim());
  const judged=JSON.parse(await readFile(report));previous=judged.results;previousSamples=samples;
  history.push({generation,samples: samples.length,winner:previous[0]?.id,report});
  await writeFile(path.join(out,'progress.json'),JSON.stringify({history,failures},null,2));
 }
}finally{await closeBrowser()}
const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const summary=all.map(a=>{
 const final=previous.filter(c=>previousSamples.find(s=>s.id===c.id)?.backend===a.name);
 const measurements=timing.get(a.name)??[];const info=registry.find(p=>p.name===a.name);
 return {name:a.name,version:info?.version,role:a.role,pros:a.pros,cons:a.cons,attempted:rounds*population,successful:measurements.length,
  meanOperationMs:average(measurements.map(x=>x.operationMs)),meanRasterMs:average(measurements.map(x=>x.rasterMs)),meanPathBytes:average(measurements.map(x=>x.pathBytes)),
  meanFinalConsensus:average(final.map(c=>c.consensus)),best:final[0]??null,importProbe:imports.find(p=>p.name===a.name),
  failures:failures.filter(f=>f.backend===a.name)};
}).sort((a,b)=>(b.meanFinalConsensus??-1)-(a.meanFinalConsensus??-1));
await writeFile(path.join(out,'summary.json'),JSON.stringify({environment:{node:process.version,arch:process.arch,platform:process.platform},rounds,population,
 generated:summary.reduce((n,s)=>n+s.successful,0),history,summary},null,2));
await writeFile(path.join(out,'failures.json'),JSON.stringify(failures,null,2));
console.log(`COMPLETE: ${out}/summary.json`);
