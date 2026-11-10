import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,OPTION_LABELS,LAYOUTS,FORMATS,PALETTES,ROLES,SPECIMEN_ROWS,render,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/rising-ray-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','layouts','formats','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (MoMA and V&A records); kept locally, never published.
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title,designer:(w.designers||[])[0]||w.designer,date:w.date,medium:w.medium,dimensions:w.dimensions,credit:w.credit,recordURL:w.recordURL,institution:w.institution,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designer:'Tadanori Yokoo',references,basis:'Shape system study: a full turn of filled wedge rays round a movable origin, widths modulated and normalised to close 360°, painted in two or three alternating colours and staged with a sun, a horizon with receding wave or floor bands, side panels, edges and a title slot. Four styles follow Yokoo posters (Made in Japan 1965, The Aesthetics of End 1966, the 16th JAAC exhibition, Fancydance 1989); six are new. Shapes, palettes and layouts are new; nothing is traced from the posters.',
 rights:'Reference images are copyrighted and kept locally for study only; do not publish or upload.'},null,2));
// resvg frees its native buffers only on garbage collection (run with --expose-gc).
let rasters=0;const png=(svg,o={mode:'height',value:3000})=>{if(++rasters%25===0)globalThis.gc?.();return new Resvg(svg,{fitTo:o}).render().asPng();};
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});for(const stage of [1,2,3,4])examples.push({name:`stage-${f.id}-${stage}`,state:{family:f.id,stage},h:1500});
 for(const l of LAYOUTS)examples.push({name:`layouts/${f.id}-${l.id}`,state:{family:f.id,...l.set,params:{...f.set.params,...l.set.params}},h:1500});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),png(s,{mode:'width',value:2200}));}
for(const fmt of FORMATS)for(const family of ['yokoo','neon','sunset','comic'])examples.push({name:`formats/${family}-${fmt.id}`,state:{family,format:fmt.id},h:1500});
// Variations: the shared construction pushed along single controls.
const VARIATIONS=[
 ['few-rays','12 rays, wide / narrow',{family:'yokoo',modulation:'alternate',params:{count:12,modulate:.6}}],['many-rays','96 rays',{family:'mishima',params:{count:96}}],
 ['random-widths','Random widths, seed 404',{family:'tide',modulation:'random',outline:'edge',params:{modulate:1,seed:404,count:30}}],['taper','Tapering toward the page',{family:'riso',bursts:'single',modulation:'taper',params:{modulate:1,originX:.5,originY:1.15,count:44}}],
 ['off-canvas','Origin below the page',{family:'sunset',params:{originY:1.25,sun:.45,horizon:1.1,count:24}}],['beside','Origin beside the page',{family:'fancy',params:{originX:-.25,originY:.55,count:48}}],
 ['checker-sunrise','Radial checker sunrise',{family:'yokoo',pattern:'checker',params:{count:32}}],['scallop-ends','Scalloped ray ends',{family:'theatre',outline:'scallop',params:{reach:.62,count:20}}],
 ['stacked','Stacked bursts',{family:'opart',bursts:'stack',pattern:'solid',params:{originY:.25,sun:.08,count:28}}],['glow-acid','Glow fade, acid palette',{family:'neon',palette:'acid',sunStyle:'corona',params:{rings:2}}],
 ['ocean-curl','Ocean palette, curling crests',{family:'mishima',palette:'ocean',params:{waves:5,amplitude:.8,horizon:.72}}],['comic-stage','Comic burst on a floor',{family:'comic',waveStyle:'floor',panel:'proscenium',params:{horizon:.7,waves:6,frequency:7,originY:.7,line:2}}]
];
for(const [slug,,state] of VARIATIONS)examples.push({name:`variations/${slug}`,state,h:1500});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,{mode:r.width>r.height?'width':'height',value:e.h??3000}));}
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,optionLabels:OPTION_LABELS,layouts:LAYOUTS,formats:FORMATS,palettes:PALETTES,roles:ROLES,specimenRows:SPECIMEN_ROWS.map(r=>({name:r.name,tiles:r.tiles.map(t=>t.label)})),variations:VARIATIONS.map(([slug,label,state])=>({slug,label,state}))},null,2));
// The editor embeds the engine (no dependencies) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'RisingRayEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,OPTION_LABELS,LAYOUTS,ROLES,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} kit specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
