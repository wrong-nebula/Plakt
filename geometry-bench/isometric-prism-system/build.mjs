import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,VIEWS,CHARACTERS,render,specimen,glyphCells} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/isometric-prism-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','views','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (MoMA collection records).
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],image=path.join(root,'output/japanese-posters/images/moma',s.id+'.jpg'),file='references/'+s.id+'.jpg';fs.copyFileSync(image,path.join(out,file));
 return {...s,file,title:w.title,date:w.date,medium:w.medium,dimensions:w.dimensions,recordURL:w.recordURL,institution:w.institution,imageSHA256:hash(fs.readFileSync(image)),metadataLicense:w.metadataLicense,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designer:'Takenobu Igarashi',references,basis:'Type system study: one cell alphabet placed in a standing or lying plane, deformed (width, slant, wave, steps, skyline jitter) and extruded into prisms, drawn in any parallel projection. Five shape systems follow the 1980 and 1982 Summer Jazz Festival posters, Zen, Noh (1981) and Expo ’85; four are new. Letterforms, palettes and layouts are new; nothing is traced from the posters.'},null,2));
const png=(svg,height=3000)=>new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});
 for(const [slug,text] of [['type-system','TYPE/SYSTEM'],['kyoto','KYOTO'],['2026','2026'],['hello','HELLO!']])examples.push({name:`${f.id}-${slug}`,state:{family:f.id,text}});
 for(const stage of [1,2,3,4])examples.push({name:`stage-${f.id}-${stage}`,state:{family:f.id,stage}});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:2400}}).render().asPng());}
// Ten views on two systems.
for(const family of ['voxel','plinth'])for(const v of VIEWS)examples.push({name:`views/${family}-${v.id}`,state:{family,text:'TYPE',...v.set,params:{...v.set.params}}});
// Letter, mode and texture variations on one word.
for(const [slug,state] of [['width',{family:'monolith',params:{width:1.6}}],['slant',{family:'neon',params:{slant:.35}}],['wave',{family:'beam',params:{wave:2.2}}],['skyline',{family:'pixel',orientation:'lying',params:{elevation:50,jitter:2.2}}],
 ['inset',{family:'voxel',params:{inset:.14}}],['step',{family:'voxel',params:{step:1.2}}],['shadow',{family:'plinth',mode:'shadow'}],['wire',{family:'stripe',mode:'wire'}],['neon',{family:'plinth',mode:'neon',ground:'gradient',colors:['#07060b','#c6ff3d','#19f0ff','#ff2bd6','#c6ff3d','#7a5cff']}],
 ['stripes',{family:'monolith',texture:'stripes',colors:['#e9e4da','#26262a','#e3402f','#26262a','#e9e4da','#e3402f']}],['grid-floor',{family:'neon',orientation:'lying',ground:'floor'}],['cabinet-voxel',{family:'voxel',projection:'oblique',axis:'fall',params:{recede:40,foreshorten:.6}}]])
 examples.push({name:`variations/${slug}`,state:{text:'TYPE/SYSTEM',...state}});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.name.includes('/')?1500:3000));}
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,views:VIEWS,characters:CHARACTERS,
 glyphs:[...CHARACTERS].map(ch=>{const g=glyphCells(ch),count=k=>g.cells.filter(c=>k.includes(c.c)).length;return {glyph:ch,width:g.width,cells:g.cells.length,full:count('#'),halves:count('◢◣◤◥'),quarters:count('╭╮╰╯'),tips:count('▼▲')};}),
 palettes:FAMILIES.map(f=>({family:f.id,roles:['ground','cap','sideA','sideB','line','accent'],colors:f.colors,oklch:f.colors.map(c=>oklch(c)),capOnGround:wcagContrast(f.colors[1],f.colors[0])}))},null,2));
// The editor embeds the engine (no dependencies) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'IsoPrismEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,SOURCES,CONTROLS,OPTIONS,VIEWS,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} ${CHARACTERS.length}-glyph specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
