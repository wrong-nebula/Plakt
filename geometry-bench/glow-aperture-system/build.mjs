import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {ENGINE,V1_ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,RAMPS,SHAPES,SHAPE_NAMES,FORMATS,FORMAT_NAMES,render,specimen} from './engine.mjs';
import {DEMOS} from './demos.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/glow-aperture-study-v2');
// Version 2 writes only its own folder; output/glow-aperture-study-v1 is frozen.
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','stages','demos'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title.replace(/&nbsp;|"|“|”/g,'').trim(),designer:(w.designers||[])[0]||w.designer,date:/\d{4}/.test(w.date||'')?w.date:'',medium:w.medium||'',recordURL:w.recordURL,institution:w.institution,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense||'',imageRights:w.imageRights??w.license};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Koichi Sato','Susumu Endo'],references,fonts:JSON.parse(fs.readFileSync(path.join(here,'font-provenance.json'))),
 basis:'Shape system study, version 2: aperture mask → two-scale blurred distance falloff → gradient map, extended with words and kanji, custom paths, new silhouettes, several lights, rim light, blinds, print finishes (screenprint steps, halftone, riso duotone, paper fibre), series and formats. Version 1 rules render byte-identically through the frozen v1 engine. Shapes, silhouettes, ramps and layouts are new drawings; nothing is traced from the posters. References and the Hiragino outlines are kept locally for study and are not for publication.'},null,2));
// resvg's native buffers are only released by garbage collection (run with --expose-gc).
let rasters=0;const png=(r,long)=>{if(++rasters%15===0)globalThis.gc?.();return new Resvg(r.svg,{fitTo:r.width>=r.height?{mode:'width',value:long}:{mode:'height',value:long}}).render().asPng();};
const asRule=r=>({...r,ramp:typeof r.ramp==='string'?RAMPS.find(x=>x.id===r.ramp).stops:r.ramp});
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},long:f.calm?3000:1500});if(f.calm)for(const stage of [1,2,3,4])examples.push({name:`stages/${f.id}-${stage}`,state:{family:f.id,stage},long:1200});}
for(const [group,list] of Object.entries(DEMOS))for(const [slug,,rule] of list)examples.push({name:`demos/${group}-${slug}`,state:asRule(rule),long:1200});
let v1Drawn=0;
for(const e of examples){const r=render(e.state);if(r.features.engine===V1_ENGINE)v1Drawn++;fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r,e.long));}
for(const f of FAMILIES.filter(f=>f.calm)){const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);globalThis.gc?.();fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:1600}}).render().asPng());}
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,reads:[ENGINE,V1_ENGINE],families:FAMILIES.map(f=>({...f,calm:!!f.calm})),demos:DEMOS,
 controls:CONTROLS.map(({uses,...c})=>({...c,conditional:!!uses})),options:OPTIONS,ramps:RAMPS,shapes:Object.entries(SHAPES).map(([id,s])=>({id,name:SHAPE_NAMES[id],aspect:typeof s.aspect==='function'?'from the word or path':s.aspect,probe:s.probe})),formats:Object.fromEntries(Object.entries(FORMATS).map(([k,v])=>[k,{name:FORMAT_NAMES[k],size:v,png:v.map(x=>Math.round(x*3000/Math.max(...v)))}]))},null,2));
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'GlowEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,RAMPS,SHAPE_NAMES,FORMAT_NAMES,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples (${v1Drawn} drawn by the frozen v1 engine), ${FAMILIES.filter(f=>f.calm).length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
