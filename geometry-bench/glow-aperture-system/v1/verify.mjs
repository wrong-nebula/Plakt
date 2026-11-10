import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,OPTION_MODES,RAMPS,SHAPES,W,H,render,resolve,apertures,specimen,rampAt,profile} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/glow-aperture-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect every 25 rasters (run with --expose-gc).
// img.pixels copies the whole buffer on every access, so each test reads it exactly once.
let rasters=0;const raster=(svg,h=240)=>{if(++rasters%25===0)globalThis.gc?.();const img=new Resvg(svg,{fitTo:{mode:'height',value:h}}).render();return {w:img.width,h:img.height,px:img.pixels};};
const pixels=(s,h)=>hash(raster(render(s).svg,h).px);
const at=(r,x,y)=>{const i=(Math.round(y)*r.w+Math.round(x))*4;return [r.px[i],r.px[i+1],r.px[i+2]];};
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),near=(a,b,t)=>a.every((v,k)=>Math.abs(v-b[k])<=t),L=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
const common={colors:['#151320','#e04a2a','#0d0d0d','#ffffff'],ramp:RAMPS.find(r=>r.id==='sunrise').stops};

// Thirteen styles stay distinct under one palette and one ramp.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,...common}))).size,FAMILIES.length,'styles under a common palette');
// Every control changes every style (spacing needs several apertures; seed is read through sparkles; 0° = 360°, so angle tries 0° and 180°,
// and a rectangle or slit turned −90° and +90° is the same shape, so turn tries 0° and 45°).
const CONTEXT={spacing:{count:3},seed:{sparkles:40}},ENDS={angle:[0,180],rotate:[0,45]};let controlChecks=0;
for(const f of FAMILIES)for(const c of CONTROLS){const ctx=CONTEXT[c.key]??{},[lo,hi]=ENDS[c.key]??[c.min,c.max],s=v=>({family:f.id,params:{...ctx,[c.key]:v}});assert.notEqual(pixels(s(lo)),pixels(s(hi)),`${f.id} ${c.key}`);controlChecks++;}
// Every option value is distinct in every style; ground is read only by field and beam modes and is inert elsewhere.
let optionChecks=0,inertChecks=0;
// (Core is tried in a colour of its own: several shadow styles set the core to the ramp's last colour on purpose; ground's gradient runs
// toward the frame colour, which some styles set equal to the ground, so ground is tried with a contrasting frame.)
for(const f of FAMILIES)for(const [k,values] of Object.entries(OPTIONS)){const base={family:f.id,...(k==='sparkle'?{params:{sparkles:40}}:{}),...(k==='core'?{colors:[...f.colors.slice(0,2),'#ff2a6d',f.colors[3]]}:{}),...(k==='ground'?{colors:[f.colors[0],'#e04a2a',...f.colors.slice(2)]}:{})},modes=OPTION_MODES[k];
 if(modes&&!modes.includes(resolve(base).mode)){assert.equal(new Set(values.map(v=>pixels({...base,[k]:v}))).size,1,`${f.id} ${k} should be inert`);inertChecks++;Object.assign(base,{mode:modes[0]});}
 assert.equal(new Set(values.map(v=>pixels({...base,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}
// Ramp presets, stop counts and stop positions.
assert.equal(new Set(RAMPS.map(r=>pixels({family:'halo',ramp:r.stops}))).size,RAMPS.length,'ramp presets');
for(const k of [2,3,4,5]){const ramp=Array.from({length:k},(_,i)=>[['#000000','#3a0b63','#ff2bd6','#3df5ff','#ffffff'][i],i/(k-1)]);assert.equal(resolve({ramp}).ramp.length,k);assert(!/NaN/.test(render({family:'club',ramp}).svg));}
const r3=[['#000000',0],['#ff2bd6',.5],['#ffffff',1]];assert.notEqual(pixels({family:'club',ramp:r3}),pixels({family:'club',ramp:[r3[0],['#ff2bd6',.2],r3[2]]}),'stop position');
assert.deepEqual(rampAt([['#ffffff',1],['#000000',0]],0),[0,0,0],'stops sort by position');

// Four distinct passes, exact replay, no state leaking between renders, seeds.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,shape:'hand',layout:'stacked',params:{count:2,width:40,smear:.7,haze:.5,fray:.4,sparkles:30,grain:.12,angle:120,layers:2}},a=render(s);render({family:'shaft',params:{count:5}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);}
const seeded=seed=>render({family:'moon',params:{seed}}).svg;assert.equal(seeded(42),seeded(42));assert.notEqual(seeded(42),seeded(43));
assert.equal(pixels({family:'aurora',params:{seed:9}}),pixels({family:'aurora',params:{seed:9}}),'seeded raster replay');

// Every shape fills its probe point in every layout (stage 1 mask, full size), and the poster corner stays dark.
let probes=0;
for(const shape of OPTIONS.shape)for(const layout of OPTIONS.layout)for(const count of [1,3]){const s={family:'halo',shape,layout,stage:1,params:{count,angle:90,rotate:0,offset:0,fray:0,layers:1}},img=raster(render(s).svg,H);
 for(const a of apertures(resolve(s))){const [x,y]=a.probe;if(x<2||x>W-8||y<2||y>H-2)continue;assert(near(at(img,x+6,y),[255,255,255],1),`${shape} ${layout} ×${count}: probe ${n2(x)},${n2(y)} is ${at(img,x+6,y)}`);probes++;}
 assert(near(at(img,1,1),[0,0,0],1),`${shape} ${layout}: corner`);}
function n2(v){return Math.round(v);}

// Gradient map: with no bloom, smear or haze, deep inside a halo aperture is the last stop and far outside the first.
for(const f of FAMILIES.filter(x=>x.set.mode==='halo')){const s={family:f.id,stage:3,shape:'rect',layout:'centred',core:'none',params:{width:8,bloom:0,smear:0,offset:0,haze:0,fray:0,layers:1,balance:0,curve:1,count:1,rotate:0,x:0,y:0,size:.8}},img=raster(render(s).svg,H),ramp=resolve(s).ramp,[a]=apertures(resolve(s));
 const end=rampAt(ramp,profile(1,resolve(s).params)).map(v=>Math.round(v*255)),start=rampAt(ramp,0).map(v=>Math.round(v*255));
 assert(near(at(img,a.c[0]+40,a.c[1]+20),end,3),`${f.id} inside ${at(img,a.c[0]+40,a.c[1]+20)} vs ${end}`);assert(near(at(img,12,a.c[1]),start,3),`${f.id} outside ${at(img,12,a.c[1])} vs ${start}`);}
// Shadow: the object is crisp in the ramp's last colour; field and beam: the ground shows away from the apertures.
{const s={family:'ember',core:'none',stage:3,params:{haze:0,fray:0}},img=raster(render(s).svg,H),[a]=apertures(resolve(s));assert(near(at(img,a.probe[0],a.probe[1]),rgb(resolve(s).ramp.slice().sort((x,y)=>x[1]-y[1]).at(-1)[0]),2),'shadow object colour');}
{const s={family:'frontier',stage:3,params:{width:6,bloom:0,haze:0}},img=raster(render(s).svg,H);assert(near(at(img,12,400),rgb(resolve(s).colors[0]),2),'field ground');}
{const s={family:'shaft',ground:'plain',stage:3,params:{fray:0,haze:0,bloom:0}},img=raster(render(s).svg,H);assert(near(at(img,40,500),rgb(resolve(s).colors[0]),2),'beam ground');}
// Light falls off: from a halo aperture's centre to the poster edge, brightness never rises (±3 levels).
// Rays start at each shape's probe point (inside it), one aperture, no core drawn over the light.
let rays=0;for(const family of ['halo','club','moon','sunrise']){const s={family,stage:3,layout:'centred',core:'none',params:{haze:0,smear:0,offset:0,layers:1,count:1}},img=raster(render(s).svg,H),[a]=apertures(resolve(s)),[px,py]=a.probe;
 for(const dir of [[-1,0],[0,1]]){let prev=Infinity;for(let t=0;;t+=3){const x=px+dir[0]*t,y=py+dir[1]*t;if(x<4||x>W-4||y>H-60)break;const l=L(at(img,x,y));assert(l<=prev+3,`${family} brightens outward at ${x},${y}`);prev=Math.min(prev,l);}rays++;}
 // and the glow reaches beyond the edge: one falloff width outside, it is still brighter than the far field.
 if(family!=='sunrise'){const edgeX=a.fit[0]-resolve(s).params.width;assert(L(at(img,edgeX,py))>L(at(img,6,py))+12,`${family} glow beyond the edge`);}}

// Copy stays crisp: the title adds hard edges (no filter touches text).
{const s={family:'club'},with_=raster(render(s).svg,H),without=raster(render({...s,title:''}).svg,H);let hard=0;for(let i=0;i<with_.px.length;i+=4)if(Math.abs(with_.px[i]-without.px[i])>150)hard++;assert(hard>400,`title edges ${hard}`);
 // The copy group is a top-level child of the poster (nesting depth 0) and holds no filter, mask or opacity.
 for(const f of FAMILIES)for(const layout of OPTIONS.layout){const svg=render({family:f.id,layout}).svg,at0=svg.indexOf('<g font-family'),pre=svg.slice(0,at0),copy=svg.slice(at0);assert(at0>0,`${f.id} copy`);
  assert.equal((pre.match(/<g[\s>]/g)||[]).length,(pre.match(/<\/g>/g)||[]).length,`${f.id} ${layout} copy nested`);assert(!/filter=|mask=|opacity=/.test(copy),`${f.id} ${layout} copy filtered`);}}
// Grain is a seeded noise tile, never feTurbulence, and it adds texture.
for(const f of FAMILIES)assert(!render({family:f.id,params:{grain:.3}}).svg.includes('feTurbulence'));
// Texture = mean difference between neighbouring pixels (smooth gradients score ≈ 0), on pale paper, near-black and a dark frame.
const grainTex={};for(const [family,[x0,x1,y0,y1]] of [['vessel',[480,680,40,120]],['club',[20,200,600,700]],['frontier',[30,200,880,1000]]]){const tex=g=>{const img=raster(render({family,params:{grain:g,sparkles:0}}).svg,H);let s=0,k=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const a=at(img,x,y),b=at(img,x+1,y);for(let c=0;c<3;c++){s+=Math.abs(a[c]-b[c]);k++;}}return +(s/k).toFixed(2);};
 const t=[0,.05,.3].map(tex);grainTex[family]=t;assert(t[1]>t[0]+.8&&t[2]>t[0]+5,`${family} grain texture ${t}`);}

// All modes × shapes × layouts render without NaN in two styles, and the specimen holds every shape.
let combos=0;for(const family of ['halo','shaft'])for(const mode of OPTIONS.mode)for(const shape of OPTIONS.shape)for(const layout of OPTIONS.layout){const svg=render({family,mode,shape,layout,params:{count:2}}).svg;assert(!/NaN|undefined|Infinity/.test(svg),`${family} ${mode} ${shape} ${layout}`);combos++;}
for(const f of FAMILIES)for(const stage of [1,2,3])assert(!/NaN|undefined|Infinity/.test(render({family:f.id,stage}).svg));
const spec=specimen({family:'club'});assert.equal((spec.match(/data-shape=/g)||[]).length,OPTIONS.shape.length);assert(!/NaN/.test(spec));
// Input handling.
assert.equal(resolve({family:'bogus'}).family,FAMILIES[0].id);assert.equal(resolve({params:{width:Infinity}}).params.width,FAMILIES[0].set.params.width);assert.equal(resolve({params:{width:999}}).params.width,110);assert.equal(resolve({params:{count:2.6}}).params.count,3);assert.equal(resolve({params:{grain:true}}).params.grain,FAMILIES[0].set.params.grain);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.deepEqual(resolve({ramp:[['#fff',0]]}).ramp,FAMILIES[0].ramp);assert.deepEqual(resolve({ramp:[['#ffffff',0],['#000000',2]]}).ramp,[['#ffffff',0],['#000000',1]]);
assert.equal(resolve({mode:'bogus',family:'shaft'}).mode,'beam');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');assert.equal(resolve(null).family,FAMILIES[0].id);assert.equal(resolve({}).engine,ENGINE);
const full=new Resvg(render({family:'club'}).svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'aurora',params:{width:10+i}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',rasters,checks:{stylesUnderCommonPalette:FAMILIES.length,controlChecks,optionValueChecks:optionChecks,inertOptionChecks:`ground leaves ${inertChecks} halo/shadow styles unchanged`,rampPresets:RAMPS.length,stopCounts:'2–5 stops; positions sort; moving a stop changes the poster',passes:'four distinct passes per style',replay:'exact SVG A/B/A and saved JSON; seeded rasters replay; different seeds differ',shapeProbes:`${probes} probe points white in the stage-1 mask (${OPTIONS.shape.length} shapes × ${OPTIONS.layout.length} layouts × 1 and 3 apertures), corners dark`,gradientMap:'halo interiors = last stop and far field = first stop within 3 levels; shadow object = last stop; field and beam grounds show',falloff:`${rays} rays from aperture centres never brighten outward; glow still visible one falloff width beyond the edge`,crispCopy:'title adds >400 hard-edged pixels and sits outside every filter',grain:`seeded PNG noise tile (no feTurbulence); neighbour-pixel texture at grain 0 / .05 / .3: ${Object.entries(grainTex).map(([f,t])=>f+' '+t.join(' / ')).join('; ')}`,combinations:`${combos} mode × shape × layout renders without NaN`,specimen:`${OPTIONS.shape.length} shapes`,invalidInputs:'family, parameter, colour, ramp, mode, stage and markup bounds',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},
 limitations:'Checks verify construction, mapping and determinism, not likeness to Sato’s airbrush. Copy uses system fonts (Helvetica Neue, Hiragino Sans), so its glyphs vary between machines. The resvg-versus-Chrome comparison is in browser-validation.json.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} controls, ${optionChecks} option values (+${inertChecks} inert), ${RAMPS.length} ramps, 4 stages, replay, ${probes} shape probes, gradient map, ${rays} falloff rays, crisp copy, grain, ${combos} combinations, inputs, 2120 × 3000 export. ${rasters} rasters; render ${renderMs} ms.`);
