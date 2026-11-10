import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import * as E from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const {ENGINE,SOURCES,STYLES,PALETTES,CONTROLS,OPTIONS,LABELS,ROLES,PRESETS,PRESET_ORDER,GENERATORS,VOCABS,ORDER,PRIMS,OVERLAYS,render,specimen,normalizeFigure,parsed}=E;
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),out=path.join(root,'output/primitive-kit-study-v1');
// v1 is frozen: rebuilding rewrites the same files and never deletes the folder.
for(const dir of ['references','figures','generator','layouts','variations','stages'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg frees native buffers only on garbage collection (run with --expose-gc).
let rasters=0;const png=(svg,height)=>{if(++rasters%25===0)globalThis.gc?.();return new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();};
// References from the local Japanese poster archive, with provenance.
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title,date:s.date,catalogDate:w.date,designer:w.designer,medium:w.medium??null,dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,credit:w.credit??null,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Ikko Tanaka','Koji Kato'],references,basis:'Shape system study. Tanaka’s Nihon Buyo face is a 3 × 4 grid with one primitive per cell; masks, butterflies and portraits come from the same kit, and Kato’s bird is a mosaic of cut squares. This system rebuilds that kit (fourteen cell primitives with turns, colours and backgrounds, plus free overlays) and applies one construction — resolution, vocabulary, symmetry, warp, gap, rounding, jitter, paint, layout — to any figure. The five source figures are hand-written presets; nothing is traced. The Sharaku record is dated “circa” in the archive; its description gives 1995.',localOnly:'Reference images are copyrighted and kept locally for study; do not publish.'},null,2));
const examples=[],add=(name,state,h=3000)=>{examples.push({name,state,h});return name;};
// Nine styles at their defaults, four passes each.
for(const s of STYLES){add(s.id,{style:s.id});for(const stage of [1,2,3,4])add(`stages/${s.id}-${stage}`,{style:s.id,stage},1200);}
// Every preset figure as a hero in its home style (or Buyo flat), copy off.
const home={buyo:'buyo',noh:'noh',butterfly:'mori',sharaku:'sharaku',bird:'kato'};
for(const id of PRESET_ORDER)add(`figures/${id}`,{style:home[id]??'buyo',layout:'hero',bleed:false,cast:[id],copy:'none'},1200);
// The seeded generator: five kinds × six seeds, and three grid sizes.
const SEEDS=[3,8,13,21,34,55];for(const g of GENERATORS)for(const seed of SEEDS)add(`generator/${g.id}-${seed}`,{style:'sticker',layout:'hero',cast:[`gen:${g.id}:${seed}:1`],copy:'none',paint:'fill',params:{round:0,gap:0}},900);
for(const g of GENERATORS)for(const size of [0,2])add(`generator/${g.id}-size${size}`,{style:'sticker',layout:'hero',cast:[`gen:${g.id}:21:${size}`],copy:'none',paint:'fill',params:{round:0,gap:0}},900);
// Layouts and formats.
const L=[['hero-buyo',{style:'buyo'}],['field-buyo',{style:'buyo',layout:'field',pattern:'brick',params:{count:3,aspect:1}}],['cast-buyo',{style:'buyo',layout:'cast',copy:'band',bleed:false}],['crop-buyo',{style:'buyo',layout:'crop',copy:'band'}],
 ['hero-neon',{style:'neon',layout:'hero',cast:['kitsune']}],['field-neon',{style:'neon'}],['cast-neon',{style:'neon',layout:'cast'}],['crop-neon',{style:'neon',layout:'crop',cast:['oni']}],
 ['field-mirror',{style:'indigo'}],['field-turn',{style:'mori',layout:'field',pattern:'turn',params:{count:3}}],['field-scatter',{style:'riso',layout:'field',pattern:'scatter',cast:['cat'],params:{count:3,seed:4}}],['field-colorway',{style:'sticker',layout:'field',pattern:'colorway',cast:['owl'],params:{count:3}}],
 ['square-cast',{style:'riso',format:'square'}],['landscape-cast',{style:'kato',layout:'cast',format:'landscape'}],['square-hero',{style:'mori',format:'square',copy:'band'}],['landscape-crop',{style:'noh',format:'landscape'}]];
for(const [n,s] of L)add(`layouts/${n}`,s,1500);
// Deformations of the shared construction (each one control or option).
const V=[['refine-2',{style:'buyo',params:{refine:1}}],['refine-4',{style:'buyo',params:{refine:2,gap:.06}}],['gap',{style:'buyo',params:{gap:.12}}],['round',{style:'buyo',params:{round:.45,gap:.05}}],['aspect',{style:'mori',params:{aspect:.7}}],['jitter',{style:'buyo',params:{jitter:.7,gap:.04}}],
 ['warp',{style:'buyo',bleed:false,params:{warp:.9,refine:1}}],['turn-noise',{style:'buyo',params:{turn:.5}}],['features',{style:'buyo',params:{features:1.8}}],['vocab-tanaka',{style:'sticker',layout:'hero',cast:['owl'],vocab:'tanaka',paint:'fill'}],['vocab-angular',{style:'sticker',layout:'hero',cast:['owl'],vocab:'angular',paint:'fill'}],['vocab-curved',{style:'sticker',layout:'hero',cast:['owl'],vocab:'curved',paint:'fill'}],
 ['vocab-pixel',{style:'kato',cast:['owl'],vocab:'pixel',params:{refine:1,warp:.3,gap:.03}}],['mirror-left',{style:'buyo',symmetry:'mirror-left'}],['mirror-right',{style:'buyo',symmetry:'mirror-right'}],['flip',{style:'noh',layout:'hero',symmetry:'flip'}],['quad',{style:'sharaku',symmetry:'quad',copy:'none'}],['point',{style:'mori',symmetry:'point'}],
 ['paint-outline',{style:'buyo',paint:'outline',params:{stroke:3}}],['paint-sticker',{style:'buyo',paint:'sticker',params:{gap:.05,round:.25,stroke:4}}],['paint-neon',{style:'buyo',paint:'neon',palette:'neon',ground:'gradient'}],['paint-riso',{style:'buyo',paint:'riso',palette:'riso',ground:'grain',params:{seed:9}}],['bird-symmetric',{style:'kato',symmetry:'mirror-right'}],['noh-refined',{style:'noh',layout:'hero',params:{refine:2,gap:.05,round:.5}}]];
for(const [n,s] of V)add(`variations/${n}`,s,1500);
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.h));}
// The kit specimen.
const kit=specimen({style:'buyo'});fs.writeFileSync(path.join(out,'kit.svg'),kit);fs.writeFileSync(path.join(out,'kit.png'),new Resvg(kit,{fitTo:{mode:'width',value:2400}}).render().asPng());
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,primitives:Object.entries(PRIMS).map(([id,p])=>({id,name:p.name,kind:p.kind})),vocabularies:VOCABS,overlays:Object.entries(OVERLAYS).map(([id,o])=>({id,name:o.name,variants:o.variants??[],defaults:o.d})),
 styles:STYLES.map(({cast,...s})=>({...s,cast})),palettes:PALETTES.map(p=>({...p,roles:ROLES,oklch:p.colors.map(c=>oklch(c)),inkOnGround:+wcagContrast(p.colors[1],p.colors[0]).toFixed(2),lightOnGround:+wcagContrast(p.colors[2],p.colors[0]).toFixed(2)})),controls:CONTROLS,options:OPTIONS,labels:LABELS,generators:GENERATORS,
 figures:PRESET_ORDER.map(id=>{const d=normalizeFigure(id),p=parsed(d);return {id,name:d.name,cols:p.cells[0].length,rows:p.cells.length,cells:p.cells.flat().filter(t=>t.p!=='.'||t.b).length,overlays:p.over.length,text:E.figureText(d)};}),examples:examples.map(e=>e.name)},null,2));
// Editor gallery.
const card=(id,name,sub)=>({id,name,sub,state:JSON.parse(fs.readFileSync(path.join(out,id+'.json')))});
const gallery=[
 {title:'Nine styles',note:'Five follow the source posters; four are new. Each opens in the editor with its figures, layout, paint and palette.',cols:3,cards:STYLES.map(s=>card(s.id,s.name,s.after.startsWith('new')?s.after.replace('new — ','New: '):'After '+s.after))},
 {title:'Layouts and formats',note:'One figure as a hero, a patterned field, a cast of different figures or a cropped giant; poster, square and landscape formats.',cols:4,cards:L.slice(0,12).map(([n])=>card('layouts/'+n,n.split('-')[0].replace(/^./,c=>c.toUpperCase()),n.split('-').slice(1).join(' ')))},
 {title:'Generated figures',note:'Seeded symmetric silhouettes quantised into kit cells, then given eyes, lips, antennae, beaks or stems. The same seed always returns the same figure.',cols:5,cards:GENERATORS.map(g=>card(`generator/${g.id}-21`,`${g.name} 21`,'Seed 21, medium grid'))},
 {title:'Deformations',note:'Each changes one control or option of the shared construction.',cols:4,cards:V.slice(0,16).map(([n])=>card('variations/'+n,n.replace(/-/g,' '),'Variation'))}];
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'PrimitiveKitEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),catalog:E,references,gallery}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, the kit specimen, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
