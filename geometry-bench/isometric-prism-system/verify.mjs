import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,VIEWS,CHARACTERS,W,H,render,resolve,scene,capCenters,normalizeWord,glyphCells,active} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/isometric-prism-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect
// regularly (run with --expose-gc) so hundreds of rasters stay within memory.
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(s,h=450)=>{collect();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const common=['#202630','#e9e4da','#c5402f','#2f8f5a','#111111','#e0b62e'];

// Nine systems under one palette; every control and option visible in every family.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length);
// Each control is tried where it applies: view controls in their projection, grain on a textured solid.
const CONTEXT={azimuth:{projection:'axonometric'},elevation:{projection:'axonometric'},recede:{projection:'oblique'},foreshorten:{projection:'oblique'},grain:{mode:'solid',texture:'grid'}};
let controlChecks=0,optionChecks=0;
for(const f of FAMILIES){for(const c of CONTROLS){const ctx={family:f.id,...CONTEXT[c.key]};assert.notEqual(pixels({...ctx,params:{[c.key]:c.min}}),pixels({...ctx,params:{[c.key]:c.max}}),`${f.id} ${c.key}`);controlChecks++;}
 for(const [k,values] of Object.entries(OPTIONS)){const ctx={family:f.id,...(k==='texture'?{mode:'solid'}:{})};assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}}
// View presets are distinct, and the controls they do not use leave them unchanged.
assert.equal(new Set(VIEWS.map(v=>pixels({family:'voxel',...v.set,params:{...v.set.params}}))).size,VIEWS.length);
for(const c of CONTROLS.filter(c=>c.uses))for(const projection of OPTIONS.projection.filter(p=>!c.uses.includes(p)))assert.equal(pixels({family:'plinth',projection,params:{[c.key]:c.min}}),pixels({family:'plinth',projection,params:{[c.key]:c.max}}),`${c.key} should not change ${projection}`);
// The editor disables grain exactly where it cannot change the poster.
// Pixels, not SVG text: element ids hash the whole state, so any parameter changes the markup.
let grainStates=0;const grainCase=s=>{const px=g=>hash(raster(render({...s,params:{...s.params,grain:g}}).svg,300));assert.equal(px(1)!==px(6),active('grain',resolve(s)),`grain ${JSON.stringify(s)}`);grainStates++;};
for(const mode of OPTIONS.mode)for(const texture of OPTIONS.texture)for(const ground of OPTIONS.ground)grainCase({family:'plinth',mode,texture,ground});
for(const elevation of [-40,30])grainCase({family:'plinth',projection:'axonometric',mode:'wire',texture:'flat',ground:'floor',params:{elevation}});
// Four passes, exact replay, and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'TYPE/SYSTEM',params:{depth:3.3,step:.4,tracking:.7,stagger:1.1,inset:.08,width:1.2,slant:.2,wave:.8,jitter:.6,elevation:27,grain:3,rods:2},texture:'stripes'},a=render(s);render({family:'beam',text:'NOH',params:{depth:7}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}

// Every glyph builds cells with finite geometry, and every supported text renders cleanly.
for(const ch of CHARACTERS){const g=glyphCells(ch);assert(g.cells.length>0&&g.width>0,ch);for(const f of FAMILIES){const sc=scene(resolve({family:f.id,text:ch}));assert(sc.prisms.length>0,ch);for(const q of sc.prisms)for(const [u,v] of q.poly)assert(Number.isFinite(u)&&Number.isFinite(v),ch);}}
const texts=['ABCDEFGH/IJKLMNOP/QRSTUVWX','YZ012345/6789.,:-/!?\'A','JAZZ','ZEN','NOH','EXPO/85','TYPE/SYSTEM','KYOTO','2026','HELLO!','I','W','M M M','A/B/C'];
for(const text of texts)for(const f of FAMILIES)for(const stage of [1,2,3,4]){const r=render({family:f.id,text,stage});assert.equal(r.state.text,text);assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${text} ${stage}`);}
for(const v of VIEWS)for(const mode of OPTIONS.mode)assert(!/NaN|undefined|Infinity/.test(render({family:'voxel',mode,...v.set,params:{...v.set.params}}).svg),`${v.id} ${mode}`);

// Occlusion: with no stagger, steps, jitter or rods, nothing may cover a full
// cell's visible end, so the letter-face colour must show at every cap centre.
// This checks visibility and the back-to-front order in every view preset,
// both planes and both reading directions, with width, slant and wave applied.
let probes=0,scenes=0;const rgbOf=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
for(const v of VIEWS)for(const orientation of ['standing','lying'])for(const axis of ['rise','fall'])for(const [text,shape] of [['JAZZ',{}],['ZEN/NOH',{width:1.3,slant:.3}],['KYOTO 85',{wave:1.2,slant:-.25}]]){
 // img.pixels copies the whole buffer on every access, so read it once per scene.
 const s={family:'voxel',text,...v.set,orientation,axis,mode:'solid',stage:3,texture:'flat',params:{...v.set.params,...shape,step:0,stagger:0,jitter:0,rods:0,inset:0,depth:orientation==='lying'?2:3}},r=render(s);collect();const img=new Resvg(r.svg).render(),data=img.pixels,cap=rgbOf(r.state.colors[1]);scenes++;
 for(const {ch,cell,at:[x,y]} of capCenters(s)){const i=(Math.round(y)*img.width+Math.round(x))*4,px=[data[i],data[i+1],data[i+2]];assert(px.every((c,k)=>Math.abs(c-cap[k])<=2),`${v.id} ${orientation}-${axis} ${text}: ${ch} cell ${cell} shows ${px}`);probes++;}}

// Rods hide inside every full cell they pass through and never half-cover a cell.
for(const f of FAMILIES){const sc=scene(resolve({family:f.id,text:'TYPE/SYSTEM',params:{rods:6,stagger:0,slant:0,width:1,jitter:0,inset:0}})),cells=sc.prisms.filter(q=>q.kind==='cell'),rods=sc.prisms.filter(q=>q.kind==='rod');assert(rods.length>0);
 for(const r of rods){const [x0,x1]=[r.poly[0][0],r.poly[1][0]],v=r.poly[2][1];for(const c of cells){const [cu,cv]=c.origin,overlapsU=Math.min(x1,cu+1)-Math.max(x0,cu)>1e-6,overlapsV=cv>v&&cv-1<v+.5;if(!overlapsU||!overlapsV)continue;
  assert(x0>=cu-1e-6&&x1<=cu+1+1e-6,'rod segment straddles a cell edge');if(c.shape==='#'&&cv-1<=v&&cv>=v+.5)assert(!(r.w0>=c.w0&&r.w1<=c.w1),'rod drawn inside a solid cell');}}}

// Everything stays inside the poster margins.
for(const text of texts)for(const f of FAMILIES)for(const stage of [3,4])for(const {at:[x,y]} of capCenters({family:f.id,text,stage}))assert(x>=40&&x<=W-40&&y>=(stage===4?180:56)&&y<=H-56,`${f.id} ${text} out of bounds`);

// Input handling and version 1 rules.
assert.equal(normalizeWord('kyōto'),'KYOTO');assert.equal(normalizeWord('type / system'),'TYPE/SYSTEM');assert.equal(normalizeWord('it’s—ok'),"IT'S-OK");assert.equal(normalizeWord('  a   b '),'A B');
for(const bad of ['','#1','A&B','🌷','<b>','A/B/C/D','A//B','ABCDEFGHIJKLMNOPQRSTUVWXY'])assert.throws(()=>normalizeWord(bad),bad);
assert.equal(resolve({text:'@@'}).text,'JAZZ');assert.equal(resolve({params:{depth:Infinity}}).params.depth,FAMILIES[0].set.params.depth);assert.equal(resolve({params:{depth:99}}).params.depth,8);assert.equal(resolve({params:{rods:2.6}}).params.rods,3);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({texture:'bogus',family:'voxel'}).texture,'grid');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');
assert(Math.abs(resolve({params:{angle:30}}).params.elevation-35.26)<.01,'v1 angle 30° becomes isometric elevation');assert.equal(resolve({engine:'isometric-prism-v1',family:'voxel',text:'ZEN'}).engine,ENGINE);
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'voxel',text:'TYPE/SYSTEM',params:{depth:2+i*.1}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteShapeSystems:FAMILIES.length,visibleControlChecks:controlChecks,visibleOptionValues:optionChecks,viewPresets:`${VIEWS.length} distinct; unused view controls leave other projections unchanged`,grainActive:`grain changes the poster exactly where the editor enables it (${grainStates} mode × texture × ground states)`,distinctPassesPerFamily:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',glyphs:CHARACTERS.length,textProbes:`${texts.length} texts × ${FAMILIES.length} families × 4 passes; ${VIEWS.length} views × ${OPTIONS.mode.length} modes; no NaN`,occlusionProbes:`${probes} full-cell letter faces visible at their centres in ${scenes} scenes (${VIEWS.length} views × standing/lying × rise/fall, with width, slant and wave)`,rods:'hidden inside solid cells, cut at cell edges',margins:'cap centres inside the poster margins',invalidInputs:'empty, unsupported characters, markup, four rows, empty rows, 25 characters; parameter, colour, option and stage bounds; version 1 axis angle',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},limitations:'Checks verify construction and drawing order, not similarity to Igarashi’s own letterforms. Header text uses system fonts, so its glyphs vary between machines. Occlusion probes exclude steps, stagger and skyline jitter, where covering letters is intended.'},null,2));
console.log(`PASS: ${FAMILIES.length} systems, ${controlChecks} visible controls, ${optionChecks} option values, ${VIEWS.length} views, 4 stages, replay, ${CHARACTERS.length} glyphs, ${probes} occlusion probes in ${scenes} scenes, rods, margins, inputs, ${Math.round(W*3000/H)} × 3000 export. Render ${renderMs} ms.`);
