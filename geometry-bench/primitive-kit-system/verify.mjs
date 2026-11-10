import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import * as E from './engine.mjs';
const {SHOWCASE,ENGINE,STYLES,CONTROLS,OPTIONS,PRESET_ORDER,GENERATORS,VOCABS,ORDER,ORDER2,MOODS,render,resolve,cellsOf,normalizeFigure,parsed,figureText,parseFigureText,parseToken,tokenOf,parseOverlay,overlayText,mirrorRot,insidePrim,generate,generateMember,generateFamily,imageFigure,series,seriesSheet,paintCell,fillCells,regionOp,copyRegion,pasteRegion,resizeFigure,contentBox,FORMATS,OVERLAYS}=E;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/primitive-kit-study-v2'),v1=path.join(root,'output/primitive-kit-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are released only by garbage collection (run with --expose-gc);
// every pixel buffer is read once per image (img.pixels copies on each access).
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(svg,h=360)=>{collect();return new Resvg(svg,{fitTo:{mode:'height',value:h}}).render();};
const pixels=s=>hash(raster(render(s).svg).pixels);
// Measured at scale 1 (728 × 1030): both mirror axes fall exactly on pixel boundaries.
function asymmetry(svg,axis='x',h=1030){const img=raster(svg,h),d=img.pixels,w=img.width,H=img.height;let bad=0,n=0;
 for(let y=0;y<(axis==='y'?H>>1:H);y++)for(let x=0;x<(axis==='x'?w>>1:w);x++){const a=(y*w+x)*4,b=axis==='x'?(y*w+w-1-x)*4:((H-1-y)*w+x)*4;n++;if(Math.abs(d[a]-d[b])+Math.abs(d[a+1]-d[b+1])+Math.abs(d[a+2]-d[b+2])>60)bad++;}return bad/n;}
const common=['#e8e6df','#1b1b1f','#fbfaf6','#d23a2c','#2b56c6','#2f8f62','#e9b824','#6cc3de','#8e62c4','#ee9cc4'];

// 1. Every v1 rule renders exactly as in v1: same SVG (apart from id prefixes) and same pixels.
const v1rules=[];const walk=d=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(f.endsWith('.json'))v1rules.push(p);}};walk(v1);
const norm=s=>s.replace(/pk[0-9a-z]+-/g,'ID-').replace(/id="pk[0-9a-z]+/g,'id="ID').replace(/#pk[0-9a-z]+/g,'#ID');let v1checked=0;
for(const f of v1rules){const st=JSON.parse(fs.readFileSync(f));if(st.engine!=='primitive-kit-v1'||!Array.isArray(st.cast))continue;const svg1=fs.readFileSync(f.replace(/\.json$/,'.svg'),'utf8'),svg2=render(st).svg,name=path.relative(v1,f);
 assert.equal(norm(svg2),norm(svg1),`v1 rule ${name} SVG`);assert.equal(hash(raster(svg2,300).pixels),hash(raster(svg1,300).pixels),`v1 rule ${name} pixels`);v1checked++;}
assert(v1checked>=137,`v1 rules checked: ${v1checked}`);

// 2. Styles distinct at defaults and under one palette; every control and option visible.
assert.equal(new Set(STYLES.map(s=>pixels({style:s.id}))).size,STYLES.length);
assert.equal(new Set(STYLES.map(s=>pixels({style:s.id,colors:common}))).size,STYLES.length,'styles differ beyond palette');
const CONTEXT={refine:{params:{gap:.06}},stroke:{paint:'outline'},count:{layout:'field'},seed:{params:{jitter:.5}},scale:{bleed:false},aspect:{bleed:false}};
let controlChecks=0;
for(const s of STYLES)for(const c of CONTROLS){const ctx={style:s.id,...CONTEXT[c.key],params:{...(CONTEXT[c.key]?.params??{})}};
 assert.notEqual(pixels({...ctx,params:{...ctx.params,[c.key]:c.min}}),pixels({...ctx,params:{...ctx.params,[c.key]:c.max}}),`${s.id} ${c.key}`);controlChecks++;}
const OCTX={layout:{style:'buyo'},symmetry:{style:'buyo',bleed:false,copy:'none'},vocab:{style:'sticker',layout:'hero',cast:['owl'],params:{refine:1}},paint:{style:'buyo'},pattern:{style:'buyo',layout:'field'},ground:{style:'buyo',bleed:false},copy:{style:'mori'},format:{style:'riso'},mood:{style:'kabuki'}};
let optionChecks=0;for(const [k,values] of Object.entries(OPTIONS)){assert.equal(new Set(values.map(v=>pixels({...OCTX[k],[k]:v}))).size,values.length,k);optionChecks+=values.length;}
for(const s of STYLES)assert.equal(new Set([1,2,3,4].map(stage=>pixels({style:s.id,stage}))).size,4,s.id);
for(const s of STYLES){const st={style:s.id,params:{jitter:.4,warp:.5,turn:.3,refine:1,gap:.03,seed:42},symmetry:'mirror-left',mood:'happy'},a=render(st);render({style:'neon',params:{count:5}});
 assert.equal(a.svg,render(st).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg).pixels),hash(raster(render(a.state).svg).pixels));}

// 3. Figure text round trips: presets (with merged cells), generated, family and picture figures.
const families=GENERATORS.flatMap(g=>generateFamily(g.id,5,3,1));
const figures=[...PRESET_ORDER.map(id=>normalizeFigure(id)),...GENERATORS.flatMap(g=>[1,2,3,5,8,13].flatMap(seed=>[0,1,2].map(size=>generate(g.id,seed,size)))),...families];
for(const d of figures){const back=parseFigureText(figureText(d));assert.deepEqual(back.grid,d.grid,d.name);assert.deepEqual(back.over,d.over,d.name);assert.equal(back.name,d.name);for(const l of d.over)assert.equal(overlayText(parseOverlay(l)),l);}
for(const t of ['T21','S03/2','.','./4','Q36/1','L13','Q21/3*2','M27','E13','+'])assert.equal(tokenOf(parseToken(t)),t);assert.equal(tokenOf(parseToken('E33')),'E13');
for(const k of Object.entries(OVERLAYS).flatMap(([k,o])=>o.variants?o.variants.map(v=>k+'.'+v):[k])){const l=overlayText(parseOverlay(k+' 1.5 1.5 m'));assert.equal(overlayText(parseOverlay(l)),l);assert(!/NaN|undefined/.test(render({cast:[{grid:['S02 S02 S02','S02 S02 S02'],over:[l]}],stage:3}).svg),k);}

// 4. Mirror tables for all twenty primitives (off-axis samples), and resolution ×2.
const N=24;let mirrorChecks=0;
for(const p of ORDER2)for(let r=0;r<4;r++)for(const [axis,map] of [['x',(u,v)=>[1-u,v]],['y',(u,v)=>[u,1-v]],['xy',(u,v)=>[1-u,1-v]]]){const q=mirrorRot(p,r,axis);let bad=0;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=(i+.37)/N,v=(j+.71)/N,[a,b]=map(u,v);if(insidePrim(p,r,u,v)!==insidePrim(p,q,a,b))bad++;}assert(bad===0,`${p}${r} mirror ${axis}: ${bad} samples`);mirrorChecks++;}
const agree=(tok,k)=>{const def=normalizeFigure({grid:[tok],over:[]}),st=resolve({cast:[def],vocab:'extended',params:{refine:k}}),g=cellsOf(def,st),n=2**k,S=48;let same=0;
 for(let j=0;j<S;j++)for(let i=0;i<S;i++){const u=(i+.5)/S,v=(j+.5)/S,t=parseToken(tok),a=insidePrim(t.p,t.r,u,v),c=g[Math.floor(v*n)][Math.floor(u*n)],b=insidePrim(c.p,c.r,u*n%1,v*n%1);if(a===b)same++;}return same/(S*S);};
const EXACT='STHNBDOK',refineScores={};for(const p of ORDER2)for(let r=0;r<4;r++){const tok=p+r+'1',s=agree(tok,1);refineScores[tok]=+s.toFixed(3);assert(s>=(EXACT.includes(p)?.995:ORDER.includes(p)?.84:.68),`${tok} at ×2: ${s}`);}

// 5. Merged cells: a block is one primitive over k × k cells; it survives text, symmetry, resolution and vocabularies.
const big=normalizeFigure('bigcell');assert(parsed(big).cells.flat().some(t=>t.k===2));let mergeChecks=0;
// The blush band's fade runs top to bottom in every reflection (as in v1), so the vertical checks drop it.
const bigNoBand={...big,over:big.over.filter(l=>!l.startsWith('band'))};
for(const [mode,axes] of [['mirror-left',['x']],['mirror-right',['x']],['flip',['y']],['quad',['x','y']]]){const st=resolve({style:'buyo',cast:[mode==='flip'||mode==='quad'?bigNoBand:'bigcell'],bleed:false,copy:'none',stage:3,symmetry:mode});
 for(const axis of axes){const a=asymmetry(render(st).svg,axis);assert(a<.004,`bigcell ${mode} ${axis}: ${a}`);mergeChecks++;}}
for(const st of [{params:{refine:1}},{vocab:'angular'},{vocab:'pixel'},{params:{jitter:.5,warp:.5}},{symmetry:'point'}]){const svg=render({cast:['bigcell'],...st}).svg;assert(!/NaN|undefined/.test(svg));mergeChecks++;}
assert.throws(()=>parseFigureText('grid:\nQ31*2 S01\n. .'),/write it as “\+”/);assert.throws(()=>parseFigureText('grid:\nQ31*3 +\n+ +'),/runs off the grid/);assert.throws(()=>parseToken('Q21*5'),/not a cell/);
const p2=paintCell(normalizeFigure('buyo'),2,0,'Q31',undefined,{size:2});assert.equal(parsed(p2).cells[2][0].k,2);assert(parsed(p2).cells[3][1].cov);
const p3=paintCell(p2,3,1,'D01');assert(!parsed(p3).cells[2][0].k,'painting inside a block shrinks it');mergeChecks+=3;

// 6. Symmetry to the pixel for every preset (also with jitter, warp, gap, ×2 and turn noise).
let symChecks=0,worstAsym=0;
for(const id of PRESET_ORDER){const st=resolve({style:'buyo',cast:[id],bleed:false,copy:'none',stage:3,symmetry:'mirror-left'});
 for(const params of [{},{jitter:.6,warp:.6,gap:.04,refine:1,turn:.4}]){const a=asymmetry(render({...st,params:{...st.params,...params}}).svg);worstAsym=Math.max(worstAsym,a);assert(a<.004,`${id} mirror-left ${JSON.stringify(params)}: ${a}`);symChecks++;}}

// 7. Generator: thirteen kinds × ten seeds — deterministic, distinct, mirror-symmetric, figure-like; families share a palette.
let genChecks=0;const fills=[],FACE=['face','mask','hannya','okame','rabbit','fox','daruma'];
for(const g of GENERATORS){const seeds=[1,2,3,5,8,13,21,34,55,89],defs=seeds.map(seed=>generate(g.id,seed,1));assert.equal(new Set(defs.map(d=>JSON.stringify([d.grid,d.over]))).size,defs.length,g.id);
 for(const [i,d] of defs.entries()){assert.deepEqual(d,generate(g.id,seeds[i],1));const cells=parsed(d).cells,flat=cells.flat(),fill=flat.filter(t=>t.p!=='.'||t.b).length/flat.length;fills.push(fill);assert(fill>=.18&&fill<=.92,`${d.name} fill ${fill}`);
  for(const row of cells)for(let c=0;c<row.length;c++)assert.equal(tokenOf(row[row.length-1-c]),tokenOf({...row[c],r:mirrorRot(row[c].p,row[c].r)}),d.name);
  if(FACE.includes(g.id))assert(d.over.some(l=>l.startsWith('eye')||(g.id==='daruma'&&l.startsWith('ring'))),d.name+' has eyes');
  if(i<3){const a=asymmetry(render({style:'sticker',layout:'hero',cast:[d],copy:'none',stage:3,paint:'fill',params:{round:0,gap:0}}).svg);worstAsym=Math.max(worstAsym,a);assert(a<.004,`${d.name} asymmetric ${a}`);}genChecks++;}
 const fam=generateFamily(g.id,9,5,1),used=d=>new Set(parsed(d).cells.flat().flatMap(t=>t.p==='.'?[t.b]:[t.c,t.b]).filter(Boolean));assert(new Set(fam.map(d=>JSON.stringify(d.grid)+d.over.join())).size>=4,`${g.id} family varies`);
 for(const d of fam){const a=used(fam[0]),b=used(d),inter=[...a].filter(x=>b.has(x)).length;assert(inter/new Set([...a,...b]).size>=.4,`${d.name} shares the family palette`);}assert.deepEqual(generateMember(g.id,9,3,1),fam[3]);}
assert.throws(()=>generate('dragon',1),/Generate a/);

// 7b. Calm generation (the default): no brows, cheeks, kumadori, fangs, noses, whiskers, blush, horns or pupils; at most three cell colours.
let calmChecks=0;const FACEK=['face','mask','hannya','okame','rabbit','fox','daruma'];
for(const g of GENERATORS)for(const seed of [1,2,3,5,8,13]){const d=generate(g.id,seed,1,{calm:true});assert.deepEqual(d,generate(g.id,seed,1,{calm:true}));assert.equal(d.from,`calm:${g.id}:${seed}:1`);assert.deepEqual(normalizeFigure(d.from),d);
 const over=d.over.map(parseOverlay),cells=parsed(d).cells;assert(!over.some(o=>['brow','cheek','kuma'].includes(o.k)||(o.k==='eye'&&['round','wide','side','sleepy','kabuki','closed'].includes(o.v))),`${d.name} calm overlays`);
 if(FACEK.includes(g.id))assert(!over.some(o=>['tri','stripes','disc','half','spike'].includes(o.k)||(o.k==='ring'&&g.id!=='daruma')),`${d.name} calm face overlays`);
 const colours=new Set(cells.flat().flatMap(t=>t.p==='.'?[t.b]:[t.c,t.b]).filter(Boolean));assert(colours.size<=3,`${d.name} uses ${colours.size} cell colours`);
 for(const row of cells)for(let c=0;c<row.length;c++)assert.equal(tokenOf(row[row.length-1-c]),tokenOf({...row[c],r:mirrorRot(row[c].p,row[c].r)}),d.name);calmChecks++;}
for(const k of ['mask','hannya']){const calm=generate(k,3,1,{calm:true}),loud=generate(k,3,1);assert.notDeepEqual(calm.grid,loud.grid,k+' loses its horns');}
assert.equal(generateFamily('okame',4,3,1,{calm:true})[2].from,'calmfam:okame:4:2:1');
// 7c. The row layout: one cell scale for every figure, no captions; the showcase leaves the legacy styles out.
for(const st of [{style:'sage'},{style:'cobalt',layout:'row',cast:['ichi','heron','noh']},{style:'buyo',layout:'row',bleed:false}]){const r=render(st),cells=r.features.placed.map(p=>+p.cell.toFixed(6));assert.equal(new Set(cells).size,1,'row scale');
 const r3=render({...st,stage:3});assert(!/<text/.test(r3.svg),'no captions in a row');}
assert(SHOWCASE.length>=12&&STYLES.filter(s=>s.group==='legacy').every(s=>!SHOWCASE.includes(s.id)));for(const id of ['riso','neon','sticker','bauhaus','newsprint','acid'])assert.equal(STYLES.find(s=>s.id===id).group,'legacy');
for(const copy of ['caption','column']){const r=render({style:'sumi',copy});assert(r.svg.includes('<text'));}

// 8. Moods rewrite eyes, brows and mouths of every face; beaks stay.
for(const f of ['buyo','kumadori','gen:okame:8:1','gen:hannya:5:1'])assert.equal(new Set(MOODS.map(mood=>render({cast:[f],mood,stage:3}).svg)).size,MOODS.length,f);
assert.equal(render({cast:['bird'],mood:'happy',stage:3}).svg.replace(/pk[0-9a-z]+/g,''),render({cast:['bird'],stage:3}).svg.replace(/pk[0-9a-z]+/g,''),'a beak has no mood');

// 9. Picture → figure: deterministic, and a drawn figure converts back to (nearly) itself.
const recover={};for(const id of ['owl','buyo','cat','kumadori','bigcell']){const d=normalizeFigure(id),p=parsed(d).cells,C=p[0].length,R=p.length,r=render({cast:[d],layout:'hero',bleed:true,copy:'none',stage:2,params:{aspect:1}},{width:C*60,height:R*60}),img=raster(r.svg,R*60),data=img.pixels;
 const f=imageFigure(data,img.width,img.height,{cols:C,rows:R,colors:r.state.colors});assert.deepEqual(f,imageFigure(data,img.width,img.height,{cols:C,rows:R,colors:r.state.colors}));
 const own=[];for(let i=0;i<R;i++){own.push([]);for(let j=0;j<C;j++)own[i].push(null);}p.forEach((row,i)=>row.forEach((t,j)=>{if(t.k>1)for(let a=i;a<i+t.k;a++)for(let b=j;b<j+t.k;b++)own[a][b]=[i,j];}));
 const src=(x,y)=>{const i=Math.floor(y),j=Math.floor(x),[i0,j0]=own[i][j]??[i,j],t=p[i0][j0],k=t.k||1;return t.cov?0:insidePrim(t.p,t.r,(x-j0)/k,(y-i0)/k)?t.c:(t.b||0);},got=parsed(f).cells,dst=(x,y)=>{const t=got[Math.floor(y)][Math.floor(x)];return insidePrim(t.p,t.r,x%1,y%1)?t.c:(t.b||0);};
 let same=0,n=0;for(let y=0;y<R*8;y++)for(let x=0;x<C*8;x++){n++;if(src((x+.5)/8,(y+.5)/8)===dst((x+.5)/8,(y+.5)/8))same++;}recover[id]=+(same/n).toFixed(3);assert(same/n>=.9,`${id} recovered ${same/n}`);}
const symFig=imageFigure(new Uint8ClampedArray(40*40*4).map((_,i)=>i%4===3?255:(i>>2)%40<12?200:30),40,40,{cols:6,rows:6,sym:true});for(const row of parsed(symFig).cells)for(let c=0;c<6;c++)assert.equal(tokenOf(row[5-c]),tokenOf({...row[c],r:mirrorRot(row[c].p,row[c].r)}));

// 10. Series, region operations and the layouts.
const ser=series({style:'kabuki'},4);assert.equal(ser.length,4);assert.equal(new Set(ser.map(s=>s.active)).size,4);assert(ser.every(s=>s.layout===ser[0].layout&&s.copy===ser[0].copy&&s.style==='kabuki'));assert.equal(new Set(ser.map(s=>pixels(s))).size,4);assert(seriesSheet({style:'buyo'},3).includes('<svg x='));
const b=normalizeFigure('buyo');for(const op of ['flipX','flipY','turn'])assert.deepEqual(regionOp(regionOp(b,[0,0,3,2],op),[0,0,3,2],op).grid,b.grid,op+' twice');
assert.deepEqual(pasteRegion(b,0,0,copyRegion(b,[0,0,3,2])).grid,b.grid);assert.notDeepEqual(regionOp(b,[0,0,3,2],'shuffle',{seed:3}).grid,b.grid);assert.equal(parsed(fillCells(b,0,0,'D03')).cells[0][0].p,'D');
assert.deepEqual(resizeFigure(resizeFigure(b,'widen'),'narrow').grid,b.grid);
let marginChecks=0;
for(const s of STYLES)for(const layout of ['hero','cast','field','crowd','row'])for(const format of OPTIONS.format){const r=render({style:s.id,layout,format,bleed:false}),[w,h]=FORMATS[format],bx=contentBox(r.state,w,h);
 for(const pl of r.features.placed){assert(pl.box[0]>=bx[0]-.5&&pl.box[1]>=bx[1]-.5&&pl.box[2]<=bx[2]+.5&&pl.box[3]<=bx[3]+.5,`${s.id} ${layout} ${format} ${pl.name}`);marginChecks++;}}
for(const id of PRESET_ORDER)for(const layout of OPTIONS.layout)for(const stage of [1,4]){const svg=render({cast:[id],layout,stage,paint:'emboss'}).svg;assert(!/NaN|undefined|Infinity/.test(svg),`${id} ${layout} ${stage}`);}

// 11. Inputs.
for(const [bad,re] of [['grid:\nS01 V9',/not a cell/],['grid:\nS01 S01\nS01',/Row 2 has 1/],['grid:\nS01\nover:\nsparkle 1 1',/not an overlay/],['grid:\nS01\nover:\neye.wink 1 1',/eye comes as/],['grid:\nS01\nover:\ndisc 1',/needs a position/],['grid:\nS01\nover:\ndisc 1 1 q3',/Unknown option/],['S01',/Start with/],['grid:\n'+Array(17).fill('S01').join('\n'),/up to 16 rows/]])assert.throws(()=>parseFigureText(bad),re);
assert.equal(resolve({params:{gap:Infinity}}).params.gap,STYLES[0].set.params.gap);assert.equal(resolve({params:{gap:9}}).params.gap,.35);assert.equal(resolve({mood:'bogus'}).mood,'none');assert.equal(resolve({style:'nope'}).style,'buyo');assert.equal(resolve({engine:'primitive-kit-v1',style:'kato'}).engine,ENGINE);
assert.deepEqual(resolve({colors:['red']}).colors,E.PALETTES[0].colors);assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>x'}).title,'scriptx');assert.equal(resolve({title:'Faces & Masks'}).title,'Faces & Masks');assert.equal(resolve({cast:Array(12).fill('owl')}).cast.length,9);
assert.equal(resolve({cast:[{grid:['V9']}]}).cast[0].name,'Nihon Buyo');assert.equal(resolve({cast:['fam:okame:4:2:1']}).cast[0].from,'fam:okame:4:2:1');
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),2120);assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({style:'kabuki',mood:MOODS[i%7],params:{jitter:.1*i,refine:1}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{v1Replay:`${v1checked} saved v1 rules from output/primitive-kit-study-v1 re-rendered in v2: identical SVG apart from id prefixes, and identical resvg pixels`,
 styles:`${STYLES.length} distinct at defaults and under one shared palette`,visibleControlChecks:controlChecks,visibleOptionValues:optionChecks,distinctPassesPerStyle:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON, with jitter, warp, turn noise, ×2, symmetry and mood on',
 figureText:`${figures.length} preset, generated and family figures round-trip through their text, merged and covered tokens included; all ${Object.values(OVERLAYS).reduce((s,o)=>s+(o.variants?.length??1),0)} overlay variants parse and render`,mirrorTables:`${mirrorChecks} primitive × turn × axis checks over twenty primitives`,
 refine:{exactAtX2:'S T H N B D O K',minimumV1Others:Math.min(...Object.entries(refineScores).filter(([k])=>ORDER.includes(k[0])&&!EXACT.includes(k[0])).map(([,v])=>v)),minimumV2Primitives:Math.min(...Object.entries(refineScores).filter(([k])=>!ORDER.includes(k[0])).map(([,v])=>v))},
 mergedCells:`${mergeChecks} checks: blocks mirror to the pixel under mirror-left/right, flip and quad; survive ×2, vocabularies, jitter, warp and half-turn; painting, shrinking and invalid blocks`,symmetry:`${symChecks} preset renders mirror-symmetric to pixels; worst asymmetry ${worstAsym.toFixed(4)}`,
 calmGenerator:`${calmChecks} calm figures (the default): no brows, cheeks, kumadori, pupils; face-like kinds without fangs, noses, whiskers, blush or horns; at most three cell colours; deterministic and symmetric`,rowLayout:'one cell scale for every figure, no captions',showcase:`${SHOWCASE.length} showcase styles; ${STYLES.filter(s=>s.group==='legacy').length} legacy styles kept for replay`,
 generator:`${GENERATORS.length} kinds × 10 seeds: deterministic, distinct, mirror-symmetric cells and pixels, eyes on face-like kinds; filled share ${Math.min(...fills).toFixed(2)}–${Math.max(...fills).toFixed(2)}; families vary yet share their palette`,moods:`${MOODS.length} distinct moods on four faces; beaks unchanged`,
 pictureToFigure:{deterministic:true,recoveredSampleShare:recover,mirror:'symmetric conversion gives mirror cells'},series:'four posters, same style, layout and copy, four figures; sheet nests posters',regions:'flip/turn twice is identity; copy-paste round trip; shuffle; fill',margins:`${marginChecks} placed figures inside the content box (hero, cast, field, crowd, row × 5 formats)`,
 invalidInputs:'bad tokens, ragged rows, unknown overlays, positions, options, merged blocks off the grid or over cells; parameter, option, mood, colour, stage, title and cast bounds',png:[2120,3000],averageRenderMs:renderMs},
 limitations:'Checks cover construction, symmetry, replay and layout, not likeness to Tanaka’s or Kato’s originals or aesthetic quality. Poster copy uses system fonts. Picture → figure uses the palette’s ten colours and area averages; detail below a cell is lost by design.'},null,2));
console.log(`PASS: ${calmChecks} calm figures, row layout, showcase groups, ${v1checked} v1 rules identical, ${STYLES.length} styles, ${controlChecks} controls, ${optionChecks} option values, 4 passes, replay, ${figures.length} figure texts, ${mirrorChecks} mirror tables, refine, ${mergeChecks} merged-cell checks, ${symChecks} symmetry renders, ${genChecks} generated figures + families, moods, picture → figure, series, regions, ${marginChecks} margins, inputs, 2120 × 3000 export. Render ${renderMs} ms.`);
