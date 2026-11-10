import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import * as E from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const {ENGINE,SOURCES,STYLES,PALETTES,CONTROLS,OPTIONS,LABELS,ROLES,PRESETS,PRESET_ORDER,GENERATORS,VOCABS,PRIMS,OVERLAYS,MOODS,render,specimen,normalizeFigure,parsed,generateFamily,imageFigure,series,seriesSheet}=E;
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/primitive-kit-study-v2');
// v2 writes only to its own folder; the frozen v1 study is never touched.
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','figures','generator','families','moods','features','image','finishes','layouts','series','variations','stages'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg frees native buffers only on garbage collection (run with --expose-gc).
let rasters=0;const raster=(svg,fit)=>{if(++rasters%25===0)globalThis.gc?.();return new Resvg(svg,{fitTo:fit}).render();};const DRY=!!process.env.PK_DRY,png=(svg,height)=>DRY?Buffer.alloc(0):raster(svg,{mode:'height',value:height}).asPng();
// References from the local Japanese poster archive, with provenance.
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title,date:s.date,catalogDate:w.date,designer:w.designer,medium:w.medium??null,dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,credit:w.credit??null,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Ikko Tanaka','Koji Kato'],references,basis:'Shape system study, v2. Tanaka’s Nihon Buyo face is a 3 × 4 grid with one primitive per cell; masks, butterflies and portraits come from the same kit, and Kato’s bird is a mosaic of cut squares. v2 extends the kit (twenty primitives, merged cells, a feature library with moods), converts pictures to figures, generates families, adds finishes, wallpaper and crowd layouts and series. The five source figures stay hand-written presets; nothing is traced. The picture → figure demonstrations use scenes drawn for this study, never the references.',localOnly:'Reference images are copyrighted and kept locally for study; do not publish.',v1:'../primitive-kit-study-v1/ (frozen; v1 rules replay identically in v2)'},null,2));
// The editor opens on the strongest calm style (chosen with the taste jury and craft judge).
const DEFAULT_STYLE='sumi';
const examples=[],add=(name,state,h=3000)=>{examples.push({name,state,h});return name;};
// Sixteen styles at their defaults, four passes each.
for(const s of STYLES){add(s.id,{style:s.id});for(const stage of [1,2,3,4])add(`stages/${s.id}-${stage}`,{style:s.id,stage},1000);}
const home={buyo:'buyo',noh:'noh',butterfly:'mori',sharaku:'sharaku',bird:'kato',kumadori:'kabuki',bigcell:'stone',ichi:'sumi',heron:'papercut'};
for(const id of PRESET_ORDER)add(`figures/${id}`,{style:home[id]??'buyo',layout:'hero',bleed:false,cast:[id],copy:'none'},1100);
// Generator: thirteen kinds × six seeds, and grid sizes.
const SEEDS=[3,8,13,21,34,55];for(const g of GENERATORS)for(const seed of SEEDS)add(`generator/${g.id}-${seed}`,{style:'sumi',layout:'hero',cast:[`calm:${g.id}:${seed}:1`],copy:'none',paint:'fill',params:{round:0,gap:0,scale:1}},800);
for(const g of GENERATORS)for(const size of [0,2])add(`generator/${g.id}-size${size}`,{style:'sumi',layout:'hero',cast:[`calm:${g.id}:21:${size}`],copy:'none',paint:'fill',params:{round:0,gap:0,scale:1}},800);
// The expressive option (brows, cheeks, fangs, horns, pupils) on four kinds.
for(const k of ['face','mask','hannya','rabbit'])for(const seed of [3,8,13])add(`generator/expressive-${k}-${seed}`,{style:'sumi',layout:'hero',cast:[`gen:${k}:${seed}:1`],copy:'none',paint:'fill',params:{round:0,gap:0,scale:1}},800);
// Families: one seed, shared palette and proportions, different features.
const FAMS=[['face',12,'sage','row'],['okame',8,'sumi','row'],['mask',21,'stone','row'],['crane',7,'gilt','row'],['fan',4,'cobalt','row'],['lantern',3,'papercut','row']];
for(const [kind,seed,style,layout] of FAMS)add(`families/${kind}-${seed}`,{style,layout,cast:generateFamily(kind,seed,3,1,{calm:true}),title:`${GENERATORS.find(g=>g.id===kind).name} family ${seed}`,info:'One seed / shared palette and proportions',copy:'caption',mood:'none'},1500);
// Moods across four faces.
const MOODED=[['buyo',{style:'buyo',bleed:false}],['ichi',{style:'sumi',cast:['ichi']}],['kumadori',{style:'kabuki'}],['okame',{style:'sage',cast:['calm:okame:8:1'],layout:'hero',paint:'fill'}]];
for(const [n,s] of MOODED)for(const mood of MOODS)add(`moods/${n}-${mood}`,{...s,layout:'hero',copy:'none',mood},800);
// Feature library: three casts of one face with different eyes, mouths and ornaments.
const face=['Q31  S01  S01  S01  S01  Q01','S01  B02/1  B02/1  B02/1  B02/1  S01','S01  S02  S02  S02  S02  S01','B32/1  S02  S02  S02  S02  B12/1','Q22  S02  S02  S02  S02  Q12','.  Q22  S02  S02  Q12  .'];
const fig=(name,over)=>({name,grid:face,over});
const SETS={eyes:['kabuki','almond','round','closed','side','wide','sleepy','slit','dot'].map(v=>fig('eye.'+v,[`eye.${v} 1.9 2.75 r.36 m`,'lip.smile 3 4.35 r.42 c3','brow.arc 1.85 2.05 w.95 t.18 c1 m'])),
 mouths:['bud','noh','bow','smile','open','grin','frown','beak'].map(v=>fig('lip.'+v,['eye.dot 1.9 2.75 r.3 m',`lip.${v} 3 4.25 r.48`,'brow.line 1.85 2.1 w.8 c1 m'])).concat([fig('cheek.swirl',['eye.dot 1.9 2.75 r.3 m','lip.bud 3 4.25 r.25','cheek.swirl 1.75 3.6 r.32 c3 m'])]),
 ornaments:[fig('hair.pin',['hair.pin 4.6 .55 r.5 c6 d3','eye.almond 1.9 2.75 r.4 m','lip.bow 3 4.3 r.4']),fig('hair.comb',['hair.comb 3 .55 r.7 c6 d6','eye.closed 1.9 2.75 r.36 m','lip.bud 3 4.3 r.25']),fig('hair.bun',['hair.bun 3 -.2 r.6 c1','eye.round 1.9 2.75 r.32 m','lip.smile 3 4.3 r.4']),
  fig('mon.tomoe',['mon.tomoe 3 2.1 r.42 c3','eye.slit 1.9 2.85 r.38 m','lip.noh 3 4.3 r.5']),fig('mon.flower',['mon.flower 3 2.1 r.4 c9 d6','eye.side 1.9 2.85 r.36 a0 m','lip.bud 3 4.3 r.25']),fig('mon.wheel',['mon.wheel 3 2.1 r.42 c1 d3','eye.wide 1.9 2.85 r.32 m','lip.open 3 4.3 r.4']),
  fig('kuma.sweep',['kuma.sweep 4.2 2.62 w1.5 a-18 c3 m','eye.almond 1.85 2.72 r.44 m','lip.bow 3 4.4 r.4']),fig('kuma.flame',['kuma.flame 3 1.6 w.8 c3','eye.closed 1.9 2.75 r.36 a180 m','lip.grin 3 4.3 r.5']),fig('cheek.lines',['cheek.lines 1.6 3.55 r.3 c3 m','eye.closed 1.9 2.75 r.36 m','lip.smile 3 4.3 r.4'])]};
for(const [k,list] of Object.entries(SETS))add(`features/${k}`,{style:'kabuki',layout:'cast',cast:list,title:{eyes:'Eyes',mouths:'Mouths',ornaments:'Ornaments'}[k],info:'Primitive kit / feature library / one face, many features',copy:'band'},1500);
// Picture → figure on scenes drawn for this study (never the references).
const SCENES={
 portrait:`<rect width="300" height="400" fill="#2a8f86"/><ellipse cx="150" cy="170" rx="118" ry="132" fill="#18151c"/><ellipse cx="150" cy="205" rx="82" ry="104" fill="#f1d6c2"/><rect x="66" y="330" width="168" height="80" fill="#c8202a"/><path d="M110 330L150 400L190 330Z" fill="#f4f0e6"/><ellipse cx="118" cy="195" rx="14" ry="9" fill="#18151c"/><ellipse cx="182" cy="195" rx="14" ry="9" fill="#18151c"/><ellipse cx="150" cy="262" rx="20" ry="11" fill="#c8202a"/><circle cx="104" cy="232" r="13" fill="#ee9fb0"/><circle cx="196" cy="232" r="13" fill="#ee9fb0"/>`,
 fuji:`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#253c8f"/><stop offset=".7" stop-color="#f2a3b6"/></linearGradient></defs><rect width="300" height="400" fill="url(#sky)"/><circle cx="215" cy="110" r="44" fill="#d9262c"/><path d="M-10 300L150 120L310 300Z" fill="#283a8c"/><path d="M118 156L150 120L182 156L166 150L150 170L134 150Z" fill="#fbf8f1"/><rect y="300" width="300" height="100" fill="#2f7fb8"/><rect y="330" width="300" height="14" fill="#cfe4f0"/><rect y="365" width="300" height="12" fill="#cfe4f0"/>`,
 stilllife:`<rect width="300" height="400" fill="#efe3cf"/><rect y="270" width="300" height="130" fill="#7a4f3a"/><path d="M50 250Q150 360 250 250Z" fill="#2e6e8e"/><circle cx="110" cy="225" r="42" fill="#e1752c"/><circle cx="190" cy="220" r="46" fill="#e0a83a"/><circle cx="150" cy="185" r="38" fill="#c4542c"/><path d="M150 148Q185 110 205 125Q180 150 150 148Z" fill="#4e8a5a"/>`,
 neoncat:`<rect width="300" height="400" fill="#07060c"/><path d="M70 330L70 150L100 80L130 140L170 140L200 80L230 150L230 330Z" fill="#ff2bd6"/><ellipse cx="150" cy="300" rx="100" ry="70" fill="#ff2bd6"/><ellipse cx="118" cy="190" rx="16" ry="20" fill="#19f0ff"/><ellipse cx="182" cy="190" rx="16" ry="20" fill="#19f0ff"/><path d="M140 230L160 230L150 244Z" fill="#f6ff3a"/>`};
const IMG=[['portrait','sumi',{layout:'hero'}],['fuji','cobalt',{}],['stilllife','stone',{}],['neoncat','gilt',{}]];
const imageFigures={};
// resvg returns premultiplied RGBA; the converter (like a browser canvas) expects straight alpha.
const straight=px=>{const o=new Uint8ClampedArray(px.length);for(let i=0;i<px.length;i+=4){const a=px[i+3];o[i+3]=a;if(a)for(let k=0;k<3;k++)o[i+k]=Math.round(px[i+k]*255/a);}return o;};
for(const [name,style,extra] of IMG){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${name==='fuji'?1.5:4}"/></filter></defs><g filter="url(#soft)">${SCENES[name]}</g></svg>`,img=raster(svg,{mode:'width',value:300}),data=straight(img.pixels);
 fs.writeFileSync(path.join(out,`image/${name}-source.png`),img.asPng());const st=E.resolve({style}),f=imageFigure(data,img.width,img.height,{cols:12,rows:16,colors:st.colors,name:name.replace(/^./,c=>c.toUpperCase())});imageFigures[name]=f;
 add(`image/${name}`,{style,layout:'hero',...extra,cast:[f],copy:'caption',title:f.name,info:'Picture → figure / 12 × 16 cells',params:{scale:.9}},1500);}
// Finishes: one figure in all ten paints.
for(const paint of OPTIONS.paint)add(`finishes/${paint}`,{style:'buyo',cast:['kumadori'],layout:'hero',bleed:false,paint,ground:paint==='neon'||paint==='glow'?'gradient':paint==='cutpaper'||paint==='riso'?'grain':'plain',palette:paint==='neon'||paint==='glow'?'neon':paint==='riso'?'riso':paint==='emboss'?'gilt':paint==='quilt'?'sashiko':paint==='mosaic'?'terracotta':'kabuki',copy:'band',title:LABELS.paint[paint],info:'Primitive kit / finishes',params:{gap:paint==='quilt'?.06:0,round:paint==='quilt'?.15:0}},1500);
// Layouts and formats (v1 set plus wallpaper, crowd, half drop, story and banner).
const L=[['crop-sumi',{style:'sumi'}],['hero-heron',{style:'sumi',cast:['heron'],layout:'hero'}],['row-two',{style:'cobalt',layout:'row',cast:['ichi','heron']}],['row-sage',{style:'sage',layout:'row',cast:[0,1,2].map(i=>`calmfam:face:8:${i}:1`)}],
 ['field-halfdrop',{style:'cobalt',layout:'field',pattern:'halfdrop',cast:['heron'],params:{count:3}}],['wallpaper-mirror',{style:'sumi',layout:'wallpaper',pattern:'mirror',cast:['ichi'],copy:'caption',params:{count:4}}],['crowd-sage',{style:'sage',layout:'crowd',cast:[0,1,2,3,4,5].map(i=>`calmfam:face:8:${i}:1`)}],['cast-specimen',{style:'buyo',layout:'cast',copy:'band',bleed:false}],
 ['story-crop',{style:'cobalt',cast:['ichi'],layout:'crop',format:'story',copy:'column'}],['banner-row',{style:'sage',layout:'row',format:'banner',cast:['ichi','heron','noh','calm:okame:8:1']}],['square-heron',{style:'papercut',format:'square'}],['landscape-crop',{style:'noh',format:'landscape'}],
 ['hero-buyo',{style:'buyo'}],['field-buyo',{style:'buyo',layout:'field',pattern:'brick',params:{count:3,aspect:1}}],['crop-buyo',{style:'buyo',layout:'crop',copy:'band'}],['wallpaper-legacy',{style:'acid'}]];
for(const [n,s] of L)add(`layouts/${n}`,s,1400);
// Series: one rule, four posters.
const SERIES=[['buyo',{style:'buyo'}],['sumi',{style:'sumi',layout:'hero',cast:['ichi','heron','noh','calm:okame:8:1']}],['cobalt',{style:'cobalt'}]];
for(const [n,s] of SERIES){series(s,4).forEach((st,i)=>add(`series/${n}-${i+1}`,st,1400));fs.writeFileSync(path.join(out,`series/${n}-sheet.svg`),seriesSheet(s,4));}
// Deformations of the shared construction (v1 set plus v2 options).
const V=[['refine-4',{style:'buyo',params:{refine:2,gap:.06}}],['round',{style:'buyo',params:{round:.45,gap:.05}}],['jitter',{style:'buyo',params:{jitter:.7,gap:.04}}],['warp',{style:'buyo',bleed:false,params:{warp:.9,refine:1}}],['turn-noise',{style:'buyo',params:{turn:.5}}],['mirror-left',{style:'buyo',symmetry:'mirror-left'}],
 ['quad',{style:'sharaku',symmetry:'quad',copy:'none'}],['bird-symmetric',{style:'kato',symmetry:'mirror-right'}],['vocab-extended',{style:'sticker',layout:'hero',cast:['owl'],vocab:'extended',paint:'fill',params:{refine:1}}],['vocab-textile',{style:'sashiko',cast:['owl'],vocab:'textile',paint:'fill'}],['vocab-botanic',{style:'mosaic',cast:['flower'],vocab:'botanic',paint:'fill',params:{refine:1}}],['vocab-pixel',{style:'kato',cast:['owl'],vocab:'pixel',params:{refine:1,warp:.3,gap:.03}}],
 ['merged-bigcell',{style:'buyo',cast:['bigcell'],bleed:false}],['merged-refine',{style:'buyo',cast:['bigcell'],bleed:false,params:{refine:1,gap:.05}}],['merged-mirror',{style:'kato',cast:['bigcell'],symmetry:'mirror-left',params:{warp:.5,gap:.03}}],['merged-jitter',{style:'sticker',layout:'hero',cast:['bigcell'],params:{jitter:.5,round:.3,gap:.06}}],
 ['mood-surprised',{style:'kabuki',mood:'surprised'}],['mood-sleepy',{style:'riso',layout:'cast',mood:'sleepy'}],['image-mirror',{style:'buyo',bleed:false,cast:[imageFigures.portrait],symmetry:'mirror-left'}],['paint-glow-field',{style:'neon',paint:'glow',pattern:'mirror'}]];
for(const [n,s] of V)add(`variations/${n}`,s,1400);
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.h));}
if(!DRY)for(const [n] of SERIES){const svg=fs.readFileSync(path.join(out,`series/${n}-sheet.svg`),'utf8');fs.writeFileSync(path.join(out,`series/${n}-sheet.png`),raster(svg,{mode:'height',value:900}).asPng());}
// Prints at 4240 × 6000 of three v1 variations (read from the frozen v1 rules; they replay identically in v2).
fs.mkdirSync(path.join(out,'hires'),{recursive:true});
for(const n of ['quad','paint-sticker','bird-symmetric']){const st=JSON.parse(fs.readFileSync(path.join(root,'output/primitive-kit-study-v1/variations',n+'.json'))),svg=render(st).svg.replace(/^<svg ([^>]*?)width="\d+" height="\d+"/,'<svg $1width="4240" height="6000" preserveAspectRatio="none"');
 fs.writeFileSync(path.join(out,'hires',n+'.json'),JSON.stringify(st,null,2));if(!DRY){fs.writeFileSync(path.join(out,'hires',n+'-4240x6000.png'),raster(svg,{mode:'original'}).asPng());globalThis.gc?.();}}
const kit=specimen({style:'buyo'});fs.writeFileSync(path.join(out,'kit.svg'),kit);if(!DRY)fs.writeFileSync(path.join(out,'kit.png'),raster(kit,{mode:'width',value:2600}).asPng());
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,primitives:Object.entries(PRIMS).map(([id,p])=>({id,name:p.name,kind:p.kind,v2:!E.ORDER.includes(id)})),vocabularies:VOCABS,overlays:Object.entries(OVERLAYS).map(([id,o])=>({id,name:o.name,variants:o.variants??[],defaults:o.d})),moods:MOODS,
 styles:STYLES.map(({cast,...s})=>({...s,cast})),palettes:PALETTES.map(p=>({...p,roles:ROLES,oklch:p.colors.map(c=>oklch(c)),inkOnGround:+wcagContrast(p.colors[1],p.colors[0]).toFixed(2),lightOnGround:+wcagContrast(p.colors[2],p.colors[0]).toFixed(2)})),controls:CONTROLS,options:OPTIONS,labels:LABELS,generators:GENERATORS,families:FAMS.map(([kind,seed,style,layout])=>({kind,seed,style,layout})),
 figures:PRESET_ORDER.map(id=>{const d=normalizeFigure(id),p=parsed(d);return {id,name:d.name,cols:p.cells[0].length,rows:p.cells.length,cells:p.cells.flat().filter(t=>t.p!=='.'||t.b).length,merged:p.cells.flat().filter(t=>t.k>1).length,overlays:p.over.length,text:E.figureText(d)};}),imageFigures,examples:examples.map(e=>e.name)},null,2));
// Editor gallery.
const card=(id,name,sub)=>({id,name,sub,state:JSON.parse(fs.readFileSync(path.join(out,id+'.json')))});
const gallery=[
 {title:'Styles',note:'Five follow the source posters; eight are new and calm: ink and paper with one accent, one large figure, small tracked type. Each opens in the editor with its figures, layout, paint and palette.',cols:4,cards:STYLES.filter(s=>s.group!=='legacy').map(s=>card(s.id,s.name,s.after.startsWith('new')?s.after.replace('new — ','New: '):'After '+s.after))},
 {title:'Families and moods',note:'Generated families share a palette and proportions and sit in a quiet row; the mood control (opt-in) rewrites every face at once.',cols:4,cards:[...FAMS.slice(0,4).map(([k,s])=>card(`families/${k}-${s}`,`${GENERATORS.find(g=>g.id===k).name} family`,'seed '+s)),...['happy','sad','angry','surprised'].map(m=>card(`moods/kumadori-${m}`,LABELS.mood[m],'Kumadori'))]},
 {title:'Picture → figure',note:'Scenes drawn for this study, each converted to a 12 × 16 grid of kit cells in the nearest palette colours.',cols:4,cards:IMG.map(([n])=>card(`image/${n}`,n.replace(/^./,c=>c.toUpperCase()),'12 × 16 cells'))},
 {title:'Finishes',note:'One kumadori face in each of the ten paints.',cols:5,cards:OPTIONS.paint.map(p=>card(`finishes/${p}`,LABELS.paint[p],'Paint'))},
 {title:'Layouts, formats and series',note:'Hero, field, wallpaper, cast, crowd and cropped giant; poster, square, landscape, story and banner; a series of four from one rule.',cols:4,cards:[...L.slice(0,12).map(([n])=>card('layouts/'+n,n.split('-')[0].replace(/^./,c=>c.toUpperCase()),n.split('-').slice(1).join(' '))),...[1,2,3,4].map(i=>card(`series/sumi-${i}`,`Series ${i} of 4`,'Sumi and vermilion'))]},
 {title:'Generated figures',note:'Thirteen kinds, seed 21, calm by default (expressive features are opt-in). The same seed always returns the same figure.',cols:5,cards:GENERATORS.map(g=>card(`generator/${g.id}-21`,`${g.name} 21`,'Seed 21'))},
 {title:'Legacy styles',note:'Earlier v1 and v2 styles, kept so every saved rule replays. Not part of the showcase.',cols:4,cards:STYLES.filter(s=>s.group==='legacy').map(s=>card(s.id,s.name,'Legacy'))}];
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'PrimitiveKitEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),catalog:E,references,gallery,defaultStyle:DEFAULT_STYLE}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${SERIES.length} series sheets, ${IMG.length} picture conversions, the kit specimen, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
