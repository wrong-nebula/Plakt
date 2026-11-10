import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import * as E from './engine.mjs';
const {ENGINE,STYLES,CONTROLS,OPTIONS,PRESET_ORDER,GENERATORS,VOCABS,ORDER,PRIMS,render,resolve,cellsOf,normalizeFigure,parsed,figureText,parseFigureText,parseToken,tokenOf,parseOverlay,overlayText,mirrorRot,insidePrim,quantize,generate,paintCell,resizeFigure,contentBox,FORMATS}=E;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/primitive-kit-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are released only by garbage collection (run with --expose-gc).
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(svg,h=360)=>{collect();return new Resvg(svg,{fitTo:{mode:'height',value:h}}).render();};
const pixels=s=>{const img=raster(render(s).svg);return hash(img.pixels);};
// Fraction of pixels that differ from the mirror image (pixel buffer read once).
function asymmetry(svg,h=400){const img=raster(svg,h),d=img.pixels,w=img.width,H=img.height;let bad=0;for(let y=0;y<H;y++)for(let x=0;x<w>>1;x++){const a=(y*w+x)*4,b=(y*w+w-1-x)*4;if(Math.abs(d[a]-d[b])+Math.abs(d[a+1]-d[b+1])+Math.abs(d[a+2]-d[b+2])>60)bad++;}return bad/(H*(w>>1));}
const common=['#e8e6df','#1b1b1f','#fbfaf6','#d23a2c','#2b56c6','#2f8f62','#e9b824','#6cc3de','#8e62c4','#ee9cc4'];

// Styles: distinct at their defaults and under one shared palette.
assert.equal(new Set(STYLES.map(s=>pixels({style:s.id}))).size,STYLES.length);
assert.equal(new Set(STYLES.map(s=>pixels({style:s.id,colors:common}))).size,STYLES.length,'styles differ beyond palette');
// Every control changes every style where it applies.
const CONTEXT={refine:{params:{gap:.06}},stroke:{paint:'outline'},count:{layout:'field'},seed:{params:{jitter:.5}},scale:{bleed:false},aspect:{bleed:false}};
let controlChecks=0;
for(const s of STYLES)for(const c of CONTROLS){const ctx={style:s.id,...CONTEXT[c.key],params:{...(CONTEXT[c.key]?.params??{})}};
 assert.notEqual(pixels({...ctx,params:{...ctx.params,[c.key]:c.min}}),pixels({...ctx,params:{...ctx.params,[c.key]:c.max}}),`${s.id} ${c.key}`);controlChecks++;}
// Every option value is distinct where it applies.
const OCTX={layout:{style:'buyo'},symmetry:{style:'buyo',bleed:false,copy:'none'},vocab:{style:'sticker',layout:'hero',cast:['owl']},paint:{style:'buyo'},pattern:{style:'buyo',layout:'field'},ground:{style:'buyo',bleed:false},copy:{style:'mori'},format:{style:'riso'}};
let optionChecks=0;for(const [k,values] of Object.entries(OPTIONS)){assert.equal(new Set(values.map(v=>pixels({...OCTX[k],[k]:v}))).size,values.length,k);optionChecks+=values.length;}
// Four distinct passes per style.
for(const s of STYLES)assert.equal(new Set([1,2,3,4].map(stage=>pixels({style:s.id,stage}))).size,4,s.id);
// Exact replay: same SVG, JSON round trip, no state leaking between renders, same pixels.
for(const s of STYLES){const st={style:s.id,params:{jitter:.4,warp:.5,turn:.3,refine:1,gap:.03,seed:42},symmetry:'mirror-left'},a=render(st);render({style:'neon',params:{count:5}});
 assert.equal(a.svg,render(st).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg).pixels),hash(raster(render(a.state).svg).pixels));}

// Figure text: every preset and generated figure survives text → figure → text.
const figures=[...PRESET_ORDER.map(id=>normalizeFigure(id)),...GENERATORS.flatMap(g=>[1,2,3,5,8,13,21,34].flatMap(seed=>[0,1,2].map(size=>generate(g.id,seed,size))))];
for(const d of figures){const back=parseFigureText(figureText(d));assert.deepEqual(back.grid,d.grid,d.name);assert.deepEqual(back.over,d.over,d.name);assert.equal(back.name,d.name);for(const l of d.over)assert.equal(overlayText(parseOverlay(l)),l);}
for(const t of ['T21','S03/2','.','./4','Q36/1','L13']){assert.equal(tokenOf(parseToken(t)),t);}assert.equal(tokenOf(parseToken('S3')),'S03');assert.equal(tokenOf(parseToken('D27')),'D07');assert.equal(tokenOf(parseToken('L33')),'L13');

// Mirror tables are geometric: the turn they give draws the mirror image exactly.
// Samples sit off the diagonals and centre lines, where inside/outside is ambiguous.
const N=24;let mirrorChecks=0;
for(const p of ORDER)for(let r=0;r<4;r++)for(const [axis,map] of [['x',(u,v)=>[1-u,v]],['y',(u,v)=>[u,1-v]],['xy',(u,v)=>[1-u,1-v]]]){const q=mirrorRot(p,r,axis);let bad=0;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=(i+.37)/N,v=(j+.71)/N,[a,b]=map(u,v);if(insidePrim(p,r,u,v)!==insidePrim(p,q,a,b))bad++;}assert(bad===0,`${p}${r} mirror ${axis}: ${bad} samples`);mirrorChecks++;}

// Resolution ×2 re-quantises exactly where the kit allows it, and closely elsewhere.
const agree=(tok,k)=>{const def=normalizeFigure({grid:[tok],over:[]}),st=resolve({cast:[def],params:{refine:k}}),g=cellsOf(def,st),n=2**k,S=48;let same=0;
 for(let j=0;j<S;j++)for(let i=0;i<S;i++){const u=(i+.5)/S,v=(j+.5)/S,t=parseToken(tok),a=insidePrim(t.p,t.r,u,v),c=g[Math.floor(v*n)][Math.floor(u*n)],b=insidePrim(c.p,c.r,u*n%1,v*n%1);if(a===b)same++;}return same/(S*S);};
const refineScores={},EXACT='STHNBDOK';for(const p of ORDER)for(let r=0;r<4;r++){const tok=p+r+'1',s=agree(tok,1);refineScores[tok]=+s.toFixed(3);assert(s>=(EXACT.includes(p)?.995:.84),`${tok} at ×2: ${s}`);}
const x4={};for(const p of ORDER){x4[p]=+agree(p+'01',2).toFixed(3);assert(x4[p]>=('STBK'.includes(p)?.995:.88),`${p} at ×4: ${x4[p]}`);}

// Symmetry: derived cells are mirror images, and the drawn figure is mirror-symmetric (also under jitter and warp).
let symChecks=0,worstAsym=0;
for(const id of PRESET_ORDER){const st=resolve({style:'buyo',cast:[id],bleed:false,copy:'none',stage:3,symmetry:'mirror-left'}),g=cellsOf(st.cast[0],st),C=g[0].length;
 for(const row of g)for(let c=0;c<C;c++){const a=row[c],b=row[C-1-c];assert.equal(tokenOf(b),tokenOf({...a,r:mirrorRot(a.p,a.r)}),id);}
 for(const params of [{},{jitter:.6,warp:.6,gap:.04,refine:1,turn:.4}]){const asym=asymmetry(render({...st,params:{...st.params,...params}}).svg);worstAsym=Math.max(worstAsym,asym);assert(asym<.004,`${id} mirror-left ${JSON.stringify(params)}: ${asym}`);symChecks++;}}
for(const mode of ['mirror-right','flip','quad','point']){const g=cellsOf(normalizeFigure('buyo'),resolve({symmetry:mode})),R=g.length,C=g[0].length,m=(t,ax)=>tokenOf({...t,r:mirrorRot(t.p,t.r,ax)});
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){if(mode==='mirror-right'||mode==='quad')assert.equal(tokenOf(g[r][c]),m(g[r][C-1-c],'x'));if(mode==='flip'||mode==='quad')assert.equal(tokenOf(g[r][c]),m(g[R-1-r][c],'y'));if(mode==='point')assert.equal(tokenOf(g[r][c]),m(g[R-1-r][C-1-c],'xy'));}}

// Generator: deterministic, distinct per seed, symmetric, figure-like.
let genChecks=0;const fills=[];
for(const g of GENERATORS){const defs=[1,2,3,5,8,13,21,34,55,89].map(seed=>generate(g.id,seed,1));assert.equal(new Set(defs.map(d=>JSON.stringify([d.grid,d.over]))).size,defs.length,g.id);
 for(const [i,d] of defs.entries()){assert.deepEqual(d,generate(g.id,[1,2,3,5,8,13,21,34,55,89][i],1));const cells=parsed(d).cells,flat=cells.flat(),fill=flat.filter(t=>t.p!=='.'||t.b).length/flat.length;fills.push(fill);assert(fill>=.2&&fill<=.92,`${d.name} fill ${fill}`);
  for(const row of cells)for(let c=0;c<row.length;c++)assert.equal(tokenOf(row[row.length-1-c]),tokenOf({...row[c],r:mirrorRot(row[c].p,row[c].r)}),d.name);
  if(g.id!=='flower'&&g.id!=='butterfly')assert(d.over.some(l=>l.startsWith('eye')||(g.id==='bird'&&l.startsWith('disc'))),d.name+' has eyes');
  if(i<4){const asym=asymmetry(render({style:'sticker',layout:'hero',cast:[d],copy:'none',stage:3,paint:'fill',params:{round:0,gap:0}}).svg);worstAsym=Math.max(worstAsym,asym);assert(asym<.004,`${d.name} asymmetric ${asym}`);}genChecks++;}
 for(const size of [0,1,2]){const d=generate(g.id,7,size);assert(parsed(d).cells[0].length>=4);}}
assert.throws(()=>generate('dragon',1),/Generate a/);
// Vocabularies: every drawn cell uses only the chosen primitives.
for(const v of VOCABS)for(const id of PRESET_ORDER)for(const refine of [0,1]){const st=resolve({cast:[id],vocab:v.id,params:{refine}});for(const t of cellsOf(st.cast[0],st).flat())assert(t.p==='.'||t.p==='S'||v.prims.includes(t.p),`${v.id} ${id} ${tokenOf(t)}`);}

// Layout: figures stay inside the content box (clear of the copy) in hero, cast and field.
let marginChecks=0;
for(const s of STYLES)for(const layout of ['hero','cast','field'])for(const format of OPTIONS.format){const r=render({style:s.id,layout,format,bleed:false}),[w,h]=FORMATS[format],b=contentBox(r.state,w,h);
 for(const p of r.features.placed){assert(p.box[0]>=b[0]-.5&&p.box[1]>=b[1]-.5&&p.box[2]<=b[2]+.5&&p.box[3]<=b[3]+.5,`${s.id} ${layout} ${format} ${p.name}`);marginChecks++;}}
// Every preset in every layout and pass renders cleanly.
for(const id of PRESET_ORDER)for(const layout of OPTIONS.layout)for(const stage of [1,4]){const svg=render({cast:[id],layout,stage}).svg;assert(!/NaN|undefined|Infinity/.test(svg),`${id} ${layout} ${stage}`);}

// Editing operations.
const b=normalizeFigure('buyo'),painted=paintCell(b,0,0,'T13','mirror-left');assert.equal(parsed(painted).cells[0][0].p,'T');assert.equal(tokenOf(parsed(painted).cells[0][2]),'T23');
assert.equal(tokenOf(parsed(paintCell(b,1,1,'T01','mirror-left')).cells[1][1]),'T01','centre column keeps the painted turn');
assert.deepEqual(resizeFigure(resizeFigure(b,'widen'),'narrow').grid,b.grid);assert.deepEqual(resizeFigure(resizeFigure(b,'widen'),'narrow').over,b.over);
// Input handling.
for(const [bad,re] of [['grid:\nS01 X9',/not a cell/],['grid:\nS01 S01\nS01',/Row 2 has 1/],['grid:\nS01\nover:\nsparkle 1 1',/not an overlay/],['grid:\nS01\nover:\neye.wink 1 1',/eye comes as/],['grid:\nS01\nover:\ndisc 1',/needs a position/],['grid:\nS01\nover:\ndisc 1 1 q3',/Unknown option/],['S01',/Start with/],['grid:\n'+Array(17).fill('S01').join('\n'),/up to 16 rows/]])assert.throws(()=>parseFigureText(bad),re);
assert.equal(resolve({params:{gap:Infinity}}).params.gap,STYLES[0].set.params.gap);assert.equal(resolve({params:{gap:9}}).params.gap,.35);assert.equal(resolve({params:{refine:1.6}}).params.refine,2);assert.equal(resolve({layout:'bogus'}).layout,'hero');assert.equal(resolve({style:'nope'}).style,'buyo');
assert.deepEqual(resolve({colors:['red']}).colors,E.PALETTES[0].colors);assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>x'}).title,'scriptx');assert.equal(resolve({cast:Array(12).fill('owl')}).cast.length,9);
assert.equal(resolve({cast:[{grid:['Z9']}]}).cast[0].name,'Nihon Buyo','invalid cast falls back to the style cast');assert.equal(resolve({cast:['gen:face:4:1']}).cast[0].from,'gen:face:4:1');
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),2120);assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({style:'buyo',params:{jitter:.1*i,refine:1}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{styles:`${STYLES.length} distinct at defaults and under one shared palette`,visibleControlChecks:controlChecks,visibleOptionValues:optionChecks,distinctPassesPerStyle:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON, with jitter, warp, turn noise, ×2 resolution and symmetry on',figureText:`${figures.length} preset and generated figures round-trip through their text; token canonicalisation`,mirrorTables:`${mirrorChecks} primitive × turn × axis checks: the mirrored turn draws the exact mirror image (24 × 24 off-axis samples)`,
 refine:{exactAtX2:'S T H N B D O K match the source cell on 48 × 48 samples (S T B K also at ×4)',minimumAgreementOthersAtX2:Math.min(...Object.entries(refineScores).filter(([k])=>!EXACT.includes(k[0])).map(([,v])=>v)),agreementAtX4:x4},symmetry:`${symChecks} preset renders mirror-symmetric to pixels (also with jitter, warp, gap, ×2 and turn noise); mirror-right, flip, quad and point cell relations; worst asymmetry ${worstAsym.toFixed(4)}`,
 generator:`${GENERATORS.length} kinds × 10 seeds: deterministic, distinct, mirror-symmetric cells and pixels, eyes on faces, masks and birds; filled share ${Math.min(...fills).toFixed(2)}–${Math.max(...fills).toFixed(2)}`,vocabularies:`${VOCABS.length} vocabularies × ${PRESET_ORDER.length} presets × ×1/×2: only allowed primitives drawn`,margins:`${marginChecks} placed figures inside the content box, clear of the copy (hero, cast, field × 3 formats)`,
 editing:'mirror painting, centre column, widen/narrow round trip',invalidInputs:'bad tokens, ragged rows, unknown overlays and variants, missing positions, unknown options, too many rows; parameter, option, colour, stage, title and cast bounds',png:[2120,3000],averageRenderMs:renderMs},
 limitations:'Checks cover construction, symmetry, replay and layout, not likeness to Tanaka’s or Kato’s originals or aesthetic quality. Poster copy uses system fonts, so its glyphs vary between machines. Lattice warp and jitter are mirrored only under the left/right/four-way symmetry modes.'},null,2));
console.log(`PASS: ${STYLES.length} styles, ${controlChecks} controls, ${optionChecks} option values, 4 passes, replay, ${figures.length} figure texts, ${mirrorChecks} mirror tables, refine, ${symChecks} symmetry renders, ${genChecks} generated figures, vocabularies, ${marginChecks} margins, editing, inputs, 2120 × 3000 export. Render ${renderMs} ms.`);
