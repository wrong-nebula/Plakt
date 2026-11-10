import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,SETS,MASKS,LAYOUTS,CONTROLS,OPTIONS,PRIMITIVES,COMPOSE,render,specimen,token,levelsOf,resolve} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=here.slice(0,here.indexOf('/geometry-bench/')),out=path.join(root,'output/compound-glyph-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','type','stages','masks','sets','layouts','options','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (MoMA and PGDA records).
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),image=path.join(dir,name),file='references/'+name;fs.copyFileSync(image,path.join(out,file));
 return {...s,file,title:w.title,designer:(w.designers??[w.designer])[0],date:w.date,medium:w.medium??'Poster',dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,credit:w.credit??null,imageSHA256:hash(fs.readFileSync(image)),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Ryuichi Yamashiro','Shigeo Fukuda','Masuteru Aoba','Shin Matsunaga'],references,
 basis:'Type system study: a silhouette (authored vector shape or a word in a heavy face) becomes a signed distance field; a density field drives seeded blue-noise sampling; each sample takes a glyph from an escalation set (木 → 林 → 森 and others) by density, depth, size or chance, turned by an orientation flow. Five styles follow the referenced posters, five are new. Silhouettes, marks, palettes and layouts are new drawings; nothing is traced. Extends the Swift recipe survey-module-substitution (Glyph and image density field).',
 rights:'Reference images are copyrighted and kept locally for study only.'},null,2));
fs.copyFileSync(path.join(here,'font-provenance.json'),path.join(out,'fonts.json'));
const png=(svg,height)=>new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();
const examples=[];const add=(name,state,h=1500)=>examples.push({name,state,h});
for(const f of FAMILIES){add(f.id,{family:f.id},3000);// Words have thinner parts than shapes, so large-mark styles take smaller marks here.
 add(`type/${f.id}-type`,{family:f.id,mask:'text',text:'TYPE/WITH/TYPE',params:{size:Math.min(f.set.params.size,15)}});add(`type/${f.id}-kanji`,{family:f.id,mask:'text',text:'水',face:'heavy',params:{size:Math.min(f.set.params.size,22)}});
 for(const stage of [1,2,3,4])add(`stages/${f.id}-${stage}`,{family:f.id,stage},1200);
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:1600}}).render().asPng());}
// Every silhouette, every escalation set, every layout.
for(const m of MASKS)add(`masks/${m.id}`,{family:'kanji',mask:m.id,text:'TYPE',layout:'poster',title:m.name.toUpperCase(),info:'Kanji in kanji / silhouette: '+m.name},1200);
for(const set of SETS)add(`sets/${set.id}`,{family:'kanji',mask:'tree',set:set.id,text:'MORI',layout:'poster',font:'gothic',params:{size:15,contour:1},title:set.name.replaceAll('/',' '),info:'Escalation set on the tree silhouette / levels by depth'},1200);
for(const l of LAYOUTS)add(`layouts/${l.id}`,{family:'riso',layout:l.id,mask:l.id==='stamp'?'disc':'wave'},1200);
// One option at a time on a fitting style.
for(const flow of OPTIONS.flow)add(`options/flow-${flow}`,{family:'alarm',flow,title:'FLOW: '+flow.toUpperCase()},1000);
for(const field of OPTIONS.field)add(`options/field-${field}`,{family:'forest',field,mask:'disc',params:{heroes:0,amount:.9},title:'FIELD: '+field.toUpperCase()},1000);
for(const r of OPTIONS.render)add(`options/render-${r}`,{family:'scribe',render:r,params:{glow:r==='glow'?.5:0},colors:r==='glow'?['#0c0a12','#ffb86b','#ffb86b','#ffb86b','#ff5470','#ffe6c7']:undefined,title:'FINISH: '+r.toUpperCase()},1000);
for(const level of OPTIONS.level)add(`options/level-${level}`,{family:'kanji',level,title:'BY '+level.toUpperCase()},1000);
for(const odd of OPTIONS.odd)add(`options/odd-${odd}`,{family:'beach',odd,params:{odd:2,oddScale:3},title:'ODD: '+odd.toUpperCase()},1000);
// New combinations from the shared parts.
const variations=[
 ['neon-skull','Alarm shells in neon glow',{family:'alarm',render:'glow',colors:['#06050a','#ff2bd6','#ff2bd6','#ff2bd6','#19f0ff','#ffd6f5'],params:{glow:.55},title:'NO MORE'}],
 ['fire-kanji','火 written with 火 炎 焱',{family:'kanji',text:'火',set:'fire',colors:['#120806','#ff5a1f','#ff9b1f','#ffe18c','#ffffff','#ffd9b0'],render:'glow',params:{glow:.35},title:'HI 火'}],
 ['water-wave','The wave in 水 沝 淼',{family:'riso',set:'water',font:'mincho',colors:['#f4f1e8','#7fc4e8','#2f86c8','#123d7a','#ff5a1f','#123d7a'],title:'MIZU 水'}],
 ['people-head','A head of 人 从 众',{family:'scribe',set:'people',font:'maru',render:'fill',colorMode:'level',colors:['#efe9df','#c7a27c','#8a6142','#3b2618','#d63a2a','#3b2618'],params:{spin:0,size:20,gap:1},title:'HITO 人'}],
 ['mouth-disc','A sun of 口 吕 品',{family:'appeal',set:'mouth',font:'gothic',colorMode:'field',colors:['#f6f0e8','#f4b06a','#ef6a3a','#c8102e','#1b1b1b','#2a2626'],title:'KUCHI 口'}],
 ['dots-skull','Halftone skull: . : ∴',{family:'halftone',mask:'skull',layout:'poster',params:{size:15},title:'MEMENTO'}],
 ['shells-type','The word left open by shells',{family:'alarm',mask:'text',text:'NO/WAR',face:'black',params:{size:26,maskScale:.95},title:'NO WAR'}],
 ['figures-text','A crowd spelling the word',{family:'beach',mask:'text',text:'SUN',face:'black',layout:'banner',params:{size:18,odd:0,maskScale:.98},title:'SUMMER CROWD'}],
 ['stone-fuji','A mountain of 石 砳 磊',{family:'ember',set:'stone',render:'fill',colors:['#e9e6de','#9a958a','#5c584f','#22201c','#d6452b','#22201c'],params:{glow:0},title:'ISHI 石'}],
 ['cart-forest','Three conifers of 車 䡛 轟',{family:'forest',mask:'forest',set:'cart',font:'gothic',params:{heroes:5},title:'KURUMA 車'}],
 ['o-hand','A hand of o oo ooo',{family:'halftone',set:'o',font:'maru',colors:['#fff4e0','#ff5a5f','#ff5a5f','#ff5a5f','#1f3fbd','#1f3fbd'],title:'OOO'}],
 ['repeat-love','LOVE escalated by repetition',{family:'electro',text:'LOVE',set:'repeat',params:{size:14},title:'LOVE LOVE'}]];
for(const [slug,,state] of variations)add(`variations/${slug}`,state,1200);
// resvg's native buffers are freed only by GC: run with --expose-gc so 3000 px rasters do not pile up.
for(const [i,e] of examples.entries()){if(i%8===0)globalThis.gc?.();const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.h));}
const oklch=converter('oklch'),fonts=['mincho','gothic','maru','script'];
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,masks:MASKS,layouts:LAYOUTS,primitives:PRIMITIVES,compose:COMPOSE,
 sets:SETS.map(s=>({id:s.id,name:s.name,levels:levelsOf(resolve({family:'kanji',set:s.id,text:'MORI'})),composedIn:Object.fromEntries(fonts.map(f=>[f,levelsOf(resolve({family:'kanji',set:s.id,text:'MORI'})).flat().filter(t=>token(t,f).composed)]))})),
 variations:variations.map(([slug,title,state])=>({slug,title,state})),
 palettes:FAMILIES.map(f=>({family:f.id,roles:['ground','ink1','ink2','ink3','accent','line'],colors:f.colors,oklch:f.colors.map(c=>oklch(c)),inkOnGround:wcagContrast(f.colors[1],f.colors[0]),lineOnGround:wcagContrast(f.colors[5],f.colors[0])}))},null,2));
// The editor embeds the engine and the bundled outlines as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'CompoundGlyphEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,SETS,MASKS,LAYOUTS,CONTROLS,OPTIONS,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
