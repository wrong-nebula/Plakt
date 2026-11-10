import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,OPTION_NEEDS,LABELS,PALETTES,ROLES,render,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/strata-field-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','layouts','directions','displacements','variations','seeds'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (MoMA and PGDA records).
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title.replace(/&nbsp;|"|“|”/g,'').trim(),designer:(w.designers||[])[0]||w.designer,date:/\d{4}/.test(w.date||'')?w.date:'',medium:w.medium??null,dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights??w.license};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Kiyoshi Awazu','Kazumasa Nagai'],references,basis:'Shape system study: a stack of guide curves (one base curve displaced per guide by noise, a sine, stacked waves, a ridged terrain profile or a drawn curve) with tween lines between them, kept in order by a stack clamp; five directions (horizontal, vertical, radial, concentric, contour levels), offset ranges under terrain profiles, faults, mirrored horizons, inlaid windows and five layouts. Six styles follow posters by Awazu and Nagai (moma-4943, Noh at UCLA, informs the framed layout’s stripe columns and the eye inlay); five are new. Palettes are new; nothing is traced from the posters.'},null,2));
// resvg's native buffers are only released by garbage collection (run with --expose-gc).
let rasters=0;const png=(svg,height)=>{if(++rasters%20===0)globalThis.gc?.();return new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();};
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},h:3000});for(const stage of [1,2,3,4])examples.push({name:`stage-${f.id}-${stage}`,state:{family:f.id,stage},h:1500});}
// Layouts on three styles, directions and base curves on two, seeds on one.
for(const family of ['awazu','contour','neon'])for(const layout of OPTIONS.layout)examples.push({name:`layouts/${family}-${layout}`,state:{family,layout},h:1500});
for(const family of ['awazu','riso'])for(const direction of OPTIONS.direction)examples.push({name:`directions/${family}-${direction}`,state:{family,direction},h:1500});
for(const family of ['nagai','plotter'])for(const displace of OPTIONS.displace)examples.push({name:`displacements/${family}-${displace}`,state:{family,displace},h:1500});
for(const seed of [3,17,58,101,240,777])examples.push({name:`seeds/awazu-${seed}`,state:{family:'awazu',params:{seed}},h:1500});
const VARIATIONS=[['fold','Fold order, high amplitude',{family:'nagai',order:'fold',params:{amplitude:.5,drift:1}}],['stack','Stack order, same field',{family:'nagai',params:{amplitude:.5,drift:1}}],
 ['tilted','Tilt 24°, faults at 30°',{family:'sculpture',params:{tilt:24,faultAngle:30,faults:4}}],['reflect-rays','Rays reflected at the horizon',{family:'kizashi',mirror:'reflect',params:{horizon:.55,cy:.55}}],
 ['window-field','Sea with a turned window',{family:'awazu',inlay:'window',inlayFill:'strata',params:{inlaySize:.38,inlayY:.4,inlayAngle:90,ranges:3}}],['ring-rings','Ringed inlays on contours',{family:'contour',inlay:'ring',inlayFill:'rings',params:{inlayCount:3,inlaySize:.2,inlayY:.25}}],
 ['perspective','Pitch ramp, weight ramp',{family:'neon',mirror:'off',params:{pitchRamp:-.9,weightRamp:.9,ranges:0}}],['facing-neon','Neon palette, facing ranges',{family:'kyoto',palette:'neon',params:{glow:.5}}],
 ['drawn-terraces','Drawn curve as slopes',{family:'topo',displace:'drawn',profile:[0,.15,.15,.5,.5,.85,.85,1]}],['misregistered','Riso misregister 8, scatter',{family:'riso',colouring:'scatter',params:{misregister:8}}],
 ['cyanotype','Cyanotype rings, faults',{family:'plotter',palette:'cyan',params:{faults:3,faultShift:.5}}],['vertical-nagai','Wave column, vertical',{family:'nagai',direction:'vertical',layout:'frame'}]];
for(const [slug,,state] of VARIATIONS)examples.push({name:`variations/${slug}`,state,h:1500});
const sizes={};
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.h));sizes[e.name]={bytes:r.svg.length,paths:r.features.paths};}
for(const f of FAMILIES){const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:2000}}).render().asPng());globalThis.gc?.();}
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,optionNeeds:OPTION_NEEDS,labels:LABELS,roles:ROLES,variations:VARIATIONS.map(([slug,label,state])=>({slug,label,state})),
 palettes:PALETTES.map(p=>({...p,oklch:p.colors.map(c=>oklch(c)),fieldOnGround:+Math.min(...p.colors.slice(4,9).map(c=>wcagContrast(c,p.colors[1]))).toFixed(2)})),svgSizes:sizes},null,2));
// The editor embeds the engine (no dependencies) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'StrataEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LABELS,ROLES,references}));
const big=Object.entries(sizes).sort((a,b)=>b[1].bytes-a[1].bytes)[0];
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine). Largest SVG: ${big[0]} ${(big[1].bytes/1024).toFixed(0)} KB. ${out}`);
