import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,SETS,MASKS,LAYOUTS,CONTROLS,OPTIONS,PRIMITIVES,COMPOSE,PACKINGS,FORMATS,IMAGES,render,specimen,series,token,levelsOf,resolve,builtinImage} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=here.slice(0,here.indexOf('/geometry-bench/')),out=path.join(root,'output/compound-glyph-study-v2');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','type','stages','packings','fields','layers','sets','formats','narrative','crops','series','images'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),image=path.join(dir,name),file='references/'+name;fs.copyFileSync(image,path.join(out,file));
 return {...s,file,title:w.title,designer:(w.designers??[w.designer])[0],date:w.date,medium:w.medium??'Poster',dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,credit:w.credit??null,imageSHA256:hash(fs.readFileSync(image)),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Ryuichi Yamashiro','Shigeo Fukuda','Masuteru Aoba','Shin Matsunaga'],references,version:2,previous:'output/compound-glyph-study-v1 (frozen; every v1 rule draws identically in v2)',
 basis:'Version 2 of the compound-glyph silhouette system: running text along offset contours, rows and flow lines; grid, hex and phyllotaxis packings; attractor, image and painted density; a second silhouette (own set, hidden word or void) and an outside set; more escalation chains and weighted custom chains; placed odd ones and heroes; gradient maps; story, square and landscape formats; macro crops; a knocked-out title; series. Images used as fields are rendered procedurally here, never the references. Nothing is traced.',
 rights:'Reference images are copyrighted and kept locally for study only.'},null,2));
fs.copyFileSync(path.join(here,'font-provenance.json'),path.join(out,'fonts.json'));
// resvg's native buffers are freed only by GC: run with --expose-gc so rasters do not pile up.
let rasters=0;const png=(svg,opt)=>{if(++rasters%8===0)globalThis.gc?.();return new Resvg(svg,{fitTo:opt}).render().asPng();};
const examples=[];const add=(name,state,h=1200)=>examples.push({name,state,h});
const v2=FAMILIES.slice(10);
for(const f of FAMILIES){add(f.id,{family:f.id},3000);add(`type/${f.id}-type`,{family:f.id,mask:'text',text:'TYPE/WITH/TYPE',params:{size:Math.min(f.set.params.size,15)}},1000);add(`type/${f.id}-kanji`,{family:f.id,mask:'text',text:'水',face:'heavy',params:{size:Math.min(f.set.params.size,22)}},1000);}
for(const f of v2)for(const stage of [1,2,3,4])add(`stages/${f.id}-${stage}`,{family:f.id,stage},1000);
// One silhouette, every packing; running text in two scripts.
for(const p of PACKINGS){add(`packings/${p.id}-kanji`,{family:'kanji',packing:p.id,title:p.name.toUpperCase(),info:'Kanji in kanji / packing: '+p.name},1000);
 add(`packings/${p.id}-script`,{family:'contour',packing:p.id,title:p.name.toUpperCase(),info:'Contour script / packing: '+p.name},1000);}
// Fields: attractors, rendered images, painted density, hidden word and void.
const attract=[[.3,.3,1],[.72,.45,1],[.42,.72,.8]];
add('fields/attract',{family:'forest',field:'attract',attract,params:{amount:1,reach:.16,heroes:4},title:'ATTRACT',info:'Three attractor points draw the wood together / 木 → 林 → 森 by density'},1000);
for(const im of IMAGES)add(`fields/image-${im.id}`,{family:'moon',imageSource:im.id,mask:im.id==='moon'?'disc':'page',title:im.name.toUpperCase().replace(' (RENDERED)',''),info:'Image field / '+im.name},1000);
add('fields/image-paper',{family:'halftone',field:'image',imageSource:'moon',mask:'disc',packing:'hex',params:{amount:1,size:13},title:'MOON ON PAPER',info:'The same moon on paper: density follows darkness'},1000);
const strokes=Array.from({length:40},(_,i)=>[.25+i*.0125,.35+Math.sin(i/6)*.12,.06,.6]).concat(Array.from({length:24},(_,i)=>[.3+i*.017,.7,.05,-.9]));
add('fields/painted',{family:'kanji',mask:'disc',strokes,title:'PAINTED',info:'A brush stroke lifts density and level; a second one erases'},1000);
add('fields/hidden',{family:'hidden'},1000);add('fields/hidden-love',{family:'hidden',text2:'LOVE',set:'people',font:'gothic',mask:'page',title:'HIDDEN',info:'人 → 从 → 众, with LOVE hidden in the crowd'},1000);
add('fields/void',{family:'alarm',mask2:'text',text2:'NO',mode2:'void',params:{scale2:.6,y2:.05},title:'VOID',info:'A second silhouette as a void inside the field'},1000);
// Layers.
add('layers/three',{family:'layers'},1000);add('layers/outside-set',{family:'forest',outSet:'water',params:{outside:.5,heroes:6},colors:['#ece7dc','#171512','#171512','#171512','#c8321e','#171512','#5b8fc9','#c8321e'],title:'MORI TO MIZU',info:'Inside 木 → 林 → 森, outside 水 → 沝 → 淼 in its own ink'},1000);
add('layers/word-in-shape',{family:'riso',mask2:'text',text2:'波',set2:'water',mode2:'set',params:{scale2:.42,x2:-.16,y2:.12},title:'NAMI 波',info:'A second word inside the wave with its own set and ink'},1000);
add('layers/sun-moon',{family:'ember',mask2:'disc',set2:'sun',mode2:'set',params:{scale2:.34,x2:0,y2:.08},title:'HI TO HI',info:'A disc of 日 → 昌 → 晶 set into the fire mountain in its own ink'},1000);
// The new escalation sets, on one tree.
for(const set of SETS.filter(s=>!['forest','mouth','sun','fire','water','people','earth','stone','cart','count','kana','o','dots','spark','dashes','shells','figures','scribble','letters','word','repeat','custom'].includes(s.id)))
 add(`sets/${set.id}`,{family:'kanji',mask:'tree',set:set.id,text:'TREE OF WORDS',layout:'poster',font:'gothic',params:{size:15,contour:1},title:set.name.replaceAll('/',' '),info:'Version 2 escalation set on the tree / levels by depth'},1000);
add('sets/weighted',{family:'kanji',mask:'tree',set:'custom',custom:'木*4 林 森*.4',layout:'poster',params:{size:15},title:'木*4 林 森*.4',info:'A weighted custom chain: mostly 木, a few 森'},1000);
// Formats and crops.
for(const fm of FORMATS)for(const fam of ['electro','layers','flow'])add(`formats/${fam}-${fm.id}`,{family:fam,format:fm.id},1000);
add('crops/forest-macro',{family:'forest',params:{zoom:2.6,panX:-.2,panY:.25,heroes:6},layout:'bleed',title:'FOREST, CLOSE',info:'Macro crop / zoom 2.6'},1000);
add('crops/kanji-macro',{family:'kanji',params:{zoom:2.2,panX:.35,panY:-.4},layout:'bleed',title:'MORI, CLOSE',info:'Macro crop / zoom 2.2'},1000);
add('crops/alarm-macro',{family:'alarm',params:{zoom:2,panY:-.3},title:'NO MORE, CLOSE',info:'Macro crop / zoom 2'},1000);
// Narrative marks and gradient maps.
add('narrative/pins',{family:'kanji',pins:[[.31,.24],[.66,.38],[.47,.55]],params:{odd:0},title:'MORI',info:'Three placed odd ones: 人 where they were put'},1000);
add('narrative/heroes',{family:'forest',heroAt:[[.5,.4],[.3,.62]],params:{heroes:4},title:'FOREST',info:'Two placed heroes and four found ones'},1000);
add('narrative/vertical',{family:'riso',colorMode:'vertical',title:'NAMI',info:'Gradient map, top to bottom'},1000);
add('narrative/depth',{family:'kanji',colorMode:'depth',title:'MORI',info:'Gradient map, edge to core'},1000);
add('narrative/knockout',{family:'beach',layout:'knockout',title:'SUMMER',info:'The title knocked out of the crowd'},1000);
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,{mode:'height',value:e.h}));}
// Series: one silhouette with three sets; one set on three silhouettes.
const seriesList=[['sets-on-tree',{family:'kanji',mask:'tree',text:'TREE',layout:'banner',params:{size:19,odd:0}},[{set:'forest',title:'木 林 森',info:'One silhouette, three sets / 1 of 3'},{set:'fire',title:'火 炎 焱',info:'One silhouette, three sets / 2 of 3',colors:['#f6efe5','#f2a25c','#d9532b','#7a1a12','#1c5b8c','#7a1a12']},{set:'water',title:'水 沝 淼',info:'One silhouette, three sets / 3 of 3',colors:['#eef3f6','#8cc2e3','#2f7fb8','#0d3a66','#e0452b','#0d3a66']}]],['silhouettes',{family:'riso'},[{mask:'wave'},{mask:'hand'},{mask:'head'}]],['finishes',{family:'layers'},[{render:'fill'},{render:'outline'},{render:'glow',colors:['#0b0b14','#9a96b8','#6a6590','#e9e6ff','#ff5a3c','#e9e6ff','#3f8ad6','#ff6a3c']}]]];
for(const [slug,base,vars] of seriesList){const r=series(base,vars);fs.writeFileSync(path.join(out,`series/${slug}.svg`),r.svg);fs.writeFileSync(path.join(out,`series/${slug}.png`),png(r.svg,{mode:'width',value:3000}));}
// The rendered field images themselves.
for(const im of IMAGES){const b=builtinImage(im.id),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${b.w}" height="${b.h}">${Array.from(b.bytes,(v,i)=>`<rect x="${i%b.w}" y="${Math.floor(i/b.w)}" width="1" height="1" fill="rgb(${v},${v},${v})"/>`).join('')}</svg>`;fs.writeFileSync(path.join(out,`images/${im.id}.png`),png(svg,{mode:'width',value:384}));}
for(const f of FAMILIES){const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);if(f.id==='forest'||FAMILIES.indexOf(f)>=10)fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),png(s,{mode:'width',value:1400}));}
const oklch=converter('oklch'),fonts=['mincho','gothic','maru','script'];
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,masks:MASKS,layouts:LAYOUTS,packings:PACKINGS,formats:FORMATS,images:IMAGES,primitives:PRIMITIVES,compose:COMPOSE,v2Families:v2.map(f=>f.id),
 sets:SETS.map(s=>({id:s.id,name:s.name,levels:levelsOf(resolve({family:'kanji',set:s.id,text:'MORI'})),composedIn:Object.fromEntries(fonts.map(f=>[f,levelsOf(resolve({family:'kanji',set:s.id,text:'MORI'})).flat().filter(t=>t!==' '&&token(t,f).composed)]))})),
 series:seriesList.map(([slug,base,vars])=>({slug,base,vars})),
 palettes:FAMILIES.map(f=>({family:f.id,roles:['ground','ink1','ink2','ink3','accent','line','ink4','ink5'],colors:resolve({family:f.id}).colors,oklch:resolve({family:f.id}).colors.map(c=>oklch(c)),inkOnGround:wcagContrast(f.colors[1],f.colors[0]),lineOnGround:wcagContrast(f.colors[5],f.colors[0])}))},null,2));
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'CompoundGlyphEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,SETS,MASKS,LAYOUTS,CONTROLS,OPTIONS,PACKINGS,FORMATS,IMAGES,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${seriesList.length} series, ${FAMILIES.length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
