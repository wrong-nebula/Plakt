import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,OPTION_KEYS,ENVELOPES,FONT_LIST,CHARACTERS,W,H,render,resolve,normalizeText,applies,envelope,geometry,frameRect,displayText} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/arch-envelope-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by GC: collect every 25 rasters (run with node --expose-gc).
let rasters=0;const raster=(s,h=300)=>{if(++rasters%25===0)globalThis.gc?.();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const common=['#efe9dc','#2a3140','#c5402f','#e9e4da','#2f8f5a','#111111','#e0b62e','#111111','#3d6fd0'];

// Ten styles under one palette stay distinct.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'styles under a common palette');
// Each control is tried where it applies (the context switches on what it needs) and must be inert where it does not.
const CONTEXT={amount:{envelope:'arch'},tilt:{envelope:'arch'},waves:{envelope:'wave'},phase:{envelope:'wave'},perspective:{envelope:'keystone'},leading:{text:'TYPE/SYSTEM'},pad:{banner:'solid'},tail:{banner:'solid',ends:'fold'},
 depth:{extrude:'block'},angle:{extrude:'block'},steps:{extrude:'stepped'},stroke:{face:'outlined'},rays:{ground:'rays'},ratio:{ground:'rays'},origin:{ground:'rays'},sun:{ground:'sunburst'}};
let controlChecks=0,inertChecks=0,optionChecks=0;
for(const f of FAMILIES){for(const c of CONTROLS){const ctx=applies(c.key,resolve({family:f.id}))?{family:f.id}:{family:f.id,...CONTEXT[c.key]};assert(applies(c.key,resolve(ctx)),`${f.id} ${c.key} context`);
  assert.notEqual(pixels({...ctx,params:{[c.key]:c.min}}),pixels({...ctx,params:{[c.key]:c.max}}),`${f.id} ${c.key} visible`);controlChecks++;
  if(!applies(c.key,resolve({family:f.id}))){assert.equal(pixels({family:f.id,params:{[c.key]:c.min}}),pixels({family:f.id,params:{[c.key]:c.max}}),`${f.id} ${c.key} should be inert`);inertChecks++;}}
 for(const k of OPTION_KEYS){const s0=resolve({family:f.id}),ctx={family:f.id,...(k==='ends'&&s0.banner==='none'?{banner:'solid'}:{}),...(k==='rowmode'||k==='rowfit'?{text:'TYPE/SYSTEMS 26'}:{}),...(k==='case'?{text:'Type System',font:'dmserif'}:{})};
  assert.equal(new Set(OPTIONS[k].map(v=>pixels({...ctx,[k]:v}))).size,OPTIONS[k].length,`${f.id} ${k} values distinct`);optionChecks+=OPTIONS[k].length;}}
// Four passes, exact replay, and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'TYPE/SYSTEM',params:{amount:.7,tilt:.6,taper:.2,slant:.1,depth:.3,detail:60}},a=render(s);render({family:'acid',text:'NOH',params:{amount:1}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}

// Every character in every typeface warps to finite outlines; supported texts render without NaN in every style and pass.
let glyphProbes=0;for(const font of FONT_LIST)for(const ch of CHARACTERS){const [pl]=geometry({family:'silver-arch',font:font.id,text:ch,case:'mixed',stage:3});const pts=pl.glyphs.flatMap(g=>g.polys.flat());
 assert(pl.glyphs.length===1&&pts.length>8&&pts.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)),`${font.id} ${ch}`);glyphProbes++;}
const texts=['ABCDEFGHIJKLM/NOPQRSTUVWXYZ/0123456789','abcdefghijklm/nopqrstuvwxyz','.,:;!?\'"-&()+@#*%$','TADANORI YOKOO','KOSHIMAKI-OSEN','LaChapelle Land','Hello, World!','I','W','MM MM','A/B/C','Tokyo 1966','OKABE SILKSCREEN STUDIO 1997'];
for(const text of texts)for(const f of FAMILIES)for(const stage of [1,2,3,4]){const r=render({family:f.id,text,stage});assert.equal(r.state.text,text);assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${text} ${stage}`);}

// Envelopes never fold: on a grid across and up, every cell keeps the same orientation, at full depth, any stem tilt and taper, for a one-row and a three-row band.
let foldCells=0,foldEnvelopes=0;
for(const e of ENVELOPES)for(const amount of [.5,1])for(const tilt of [0,.5,1])for(const taper of [-.8,0,.8])for(const [EW,EH] of [[640,140],[640,380]]){const st=resolve({envelope:e.id,params:{amount,tilt,taper,waves:e.id==='rising'?1:2}}),E=envelope(st,EW,EH),g=Array.from({length:61},(_,i)=>Array.from({length:9},(_,j)=>E.at(i/60,j/8)));let sign=0;
 for(let i=0;i<60;i++)for(let j=0;j<8;j++){const [a,b,c,d]=[g[i][j],g[i+1][j],g[i+1][j+1],g[i][j+1]],ar=((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))+((c[0]-a[0])*(d[1]-a[1])-(d[0]-a[0])*(c[1]-a[1]));assert(Math.abs(ar)>1e-6,`${e.id} degenerate cell`);
  if(!sign)sign=Math.sign(ar);assert.equal(Math.sign(ar),sign,`${e.id} folds at amount ${amount} tilt ${tilt} taper ${taper} band ${EH}`);foldCells++;}foldEnvelopes++;}
// Warp smoothness: straight outline segments stay smooth after warping (turning per subdivision), at default flattening, for every envelope at half and full depth and three stem tilts.
let maxBend=0,worst='';for(const e of ENVELOPES)for(const amount of [.5,1])for(const tilt of [0,.5,1]){const b=render({family:'silver-arch',stage:3,text:'MOVE/ENVELOPE',rowmode:'block',envelope:e.id,params:{amount,tilt}}).features.maxBend;
 assert(b<(e.id==='gable'?11:8),`${e.id} ${amount} ${tilt} bends ${b}°`);if(b>maxBend){maxBend=b;worst=`${e.id} ${amount} ${tilt}`;}}
const bends=[6,12,24,44,90].map(detail=>render({family:'silver-arch',stage:3,params:{detail}}).features.maxBend);assert(bends.every((b,i)=>!i||b<bends[i-1]),'finer flattening bends less');
// Letters fill the envelope: with no banner, every capital H touches both edges; radial arch letters widen toward the top (reshaped), rigid letters on a path do not.
const dist=(q,pl)=>Math.min(...pl.slice(1).map((b,i)=>{const a=pl[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);}));
let fillProbes=0;for(const e of ENVELOPES)for(const tilt of [0,1]){const [pl]=geometry({family:'silver-arch',banner:'none',stage:3,envelope:e.id,text:'HHHHHH',params:{amount:.8,tilt,taper:.3}}),b=pl.bands[0];
 for(const g of pl.glyphs){const pts=g.polys.flat();assert(Math.min(...pts.map(q=>dist(q,b.top)))<1.5&&Math.min(...pts.map(q=>dist(q,b.bottom)))<1.5,`${e.id} tilt ${tilt}: H does not fill the band`);fillProbes++;}}
const widths=fit=>{const [pl]=geometry({family:'silver-arch',banner:'none',stage:3,envelope:'arch',text:'HHHHHHH',params:{amount:.6,tilt:1,fit,size:1.6}}),b=pl.bands[0],pts=pl.glyphs[3].polys.flat(),c=[0,1].map(i=>pts.reduce((s,q)=>s+q[i],0)/pts.length);
 // The letter's own axis: the band's stem nearest its centre; widths are measured across it in the top and bottom 5%.
 let k=0,best=Infinity;b.top.forEach((t,i)=>{const d=Math.hypot((t[0]+b.bottom[i][0])/2-c[0],(t[1]+b.bottom[i][1])/2-c[1]);if(d<best){best=d;k=i;}});
 const l=Math.hypot(b.top[k][0]-b.bottom[k][0],b.top[k][1]-b.bottom[k][1]),ax=[(b.top[k][0]-b.bottom[k][0])/l,(b.top[k][1]-b.bottom[k][1])/l],v=pts.map(q=>(q[0]-c[0])*ax[0]+(q[1]-c[1])*ax[1]),u=pts.map(q=>(q[0]-c[0])*ax[1]-(q[1]-c[1])*ax[0]);
 // Outer corners are the extreme points along the letter's diagonals (u and v normalised to its extents).
 const ur=Math.max(...u)-Math.min(...u),vr=Math.max(...v)-Math.min(...v),corner=(a,b)=>pts[u.reduce((m,_,i)=>a*u[i]/ur+b*v[i]/vr>a*u[m]/ur+b*v[m]/vr?i:m,0)],gap=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
 return gap(corner(-1,1),corner(1,1))/gap(corner(-1,-1),corner(1,-1));};
const reshaped=widths(1),rigid=widths(0);assert(reshaped>1.08,`radial arch H should widen upward (${reshaped})`);assert(Math.abs(rigid-1)<.02,`rigid H keeps its width (${rigid})`);

// Everything stays inside the frame (vanishing extrusions excepted, they run to the origin).
for(const text of texts)for(const f of FAMILIES){const st=resolve({family:f.id,text}),R=frameRect(st);for(const pl of geometry(st)){const [x0,y0,x1,y1]=pl.bbox;assert(x0>=R[0]-.5&&y0>=R[1]-.5&&x1<=R[2]+.5&&y1<=R[3]+.5,`${f.id} ${text} outside the frame`);}}

// Input handling.
assert.equal(normalizeText('kyōto'),'kyoto');assert.equal(normalizeText('type / system'),'type/system');assert.equal(normalizeText('it’s—ok'),"it's-ok");assert.equal(normalizeText('  a   b '),'a b');
for(const bad of ['','{x}','<b>','🌷','A/B/C/D','A//B','A'.repeat(29),'ü€'])assert.throws(()=>normalizeText(bad),bad);
assert.equal(displayText(resolve({text:'Type',case:'upper'})),'TYPE');assert.equal(displayText(resolve({text:'Type',case:'mixed'})),'Type');
assert.equal(resolve({text:'<<'}).text,FAMILIES[0].text);assert.equal(resolve({params:{amount:Infinity}}).params.amount,FAMILIES[0].set.params.amount);assert.equal(resolve({params:{amount:9}}).params.amount,1);assert.equal(resolve({params:{steps:2.6}}).params.steps,3);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({family:'acid',envelope:'bogus'}).envelope,'pinch');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'SCRIPT');
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'silver-arch',text:'TYPE/SYSTEM',params:{amount:.4+i*.03}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{
 commonPaletteStyles:FAMILIES.length,visibleControlChecks:controlChecks,inertControlChecks:`${inertChecks} controls that do not apply leave the poster unchanged`,visibleOptionValues:optionChecks,distinctPassesPerStyle:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',
 glyphs:`${glyphProbes} warps (${CHARACTERS.length} characters × ${FONT_LIST.length} typefaces), finite`,textProbes:`${texts.length} texts × ${FAMILIES.length} styles × 4 passes; no NaN`,
 noFolding:`${foldEnvelopes} envelopes (12 presets × depth .5/1 × tilt 0/.5/1 × taper −.8/0/.8 × one- and three-row bands), ${foldCells} grid cells, one orientation each`,
 smoothness:`max turn per subdivision of a straight outline segment ${maxBend}° (${worst}); gable’s softened ridge < 11°, all others < 8°; flattening 6→90 segments: ${bends.join('° → ')}°`,
 fillsEnvelope:`${fillProbes} capitals touch both envelope edges (12 presets × vertical/radial, with taper)`,reshaped:`radial arch H top/bottom width ${reshaped.toFixed(3)}; rigid letter on a path ${rigid.toFixed(3)}`,
 margins:'lettering bounding boxes inside the frame for every style and probe text',invalidInputs:'empty, unsupported characters, markup, four rows, empty rows, 29-character rows; parameter, colour, option and stage bounds; kicker sanitising',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},
 limitations:'Checks verify construction (fill, folding, smoothness, drawing order inputs), not similarity to Yokoo’s hand-drawn lettering. Extrusion side faces are ordered back to front by their front edges, which is exact for convex runs and an approximation where far-apart faces overlap. Supporting plates use the same outline fonts, so no system fonts are needed.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls, ${inertChecks} inert controls, ${optionChecks} option values, 4 passes, replay, ${glyphProbes} glyph warps, ${foldCells} fold cells, max bend ${maxBend}°, ${fillProbes} fill probes, reshape ${reshaped.toFixed(2)} vs ${rigid.toFixed(2)}, margins, inputs, 2120 × 3000 export. Render ${renderMs} ms.`);
