import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,FORMATS,LAYOUTS,W,H,render,resolve,applies,specimen,sourceField,lattice,geometry,wordLayout,normalizeWord,normalizeImage,imageFromLuminance,luminance} from './engine.mjs';
import {GLYPHS} from '../../isometric-prism-system/engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/bead-ray-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect regularly (run with --expose-gc).
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(s,h=260)=>{collect();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const strip=r=>r.svg.replaceAll(r.svg.match(/id="[a-z]+-([a-z0-9]+)/)?.[1]??'\u0000','');
const common=['#15121c','#241d33','#f2efe8','#5ad1ff','#ff4f6d','#f2efe8'];
const face=JSON.parse(fs.readFileSync(path.join(out,'demo-image.json'),'utf8'));
// Values tried for each control: min against max, except circular ones (turn, tilt, angles, twist of straight spikes and petals),
// which compare the preset's own value with a turn of 37% of the range, avoiding symmetric half and full turns.
const CIRCULAR=['turn','tilt','sourceAngle','axis','twist'],wrap=(c,v)=>v>c.max?v-(c.max-c.min):v;
const lo=(c,f)=>CIRCULAR.includes(c.key)?f.set.params[c.key]:c.min,hi=(c,f)=>CIRCULAR.includes(c.key)?wrap(c,f.set.params[c.key]+(c.max-c.min)*.37):c.max;

// Thirteen presets under one palette.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'presets distinct under one palette');
// Every control that applies to a preset changes its picture; every control that does not apply leaves it unchanged.
// A cropped bloom whose centre lies off the poster hides its hub rings and emblem; those are probed in the centred layout.
let visible=0,inert=0,optionChecks=0,inertOptions=0;const CENTRAL=['rings','emblem'],offCentre=f=>{const g=geometry(resolve({family:f.id}));return g.blooms.some(b=>b.cx<0||b.cx>g.Wf||b.cy<0||b.cy>g.Hf);};
for(const f of FAMILIES){const base=resolve({family:f.id,image:face}),lay=k=>offCentre(f)&&CENTRAL.includes(k)?{layout:'bloom'}:{};
 for(const c of CONTROLS){const s=v=>({family:f.id,image:face,...lay(c.key),params:{[c.key]:v}});
  if(applies(c.key,base)){assert.notEqual(pixels(s(lo(c,f))),pixels(s(hi(c,f))),`${f.id}: ${c.key} should be visible`);visible++;}
  else{const a=render(s(lo(c,f))),b=render(s(hi(c,f)));if(strip(a)!==strip(b))assert.equal(hash(raster(a.svg)),hash(raster(b.svg)),`${f.id}: ${c.key} should not change the picture`);inert++;}}
 // Options: in context (silhouettes with the shape source, flip axes against a 30° fixed axis), each value distinct where it applies, inert where it does not.
 for(const [k,values] of Object.entries(OPTIONS)){const ctx={family:f.id,image:face,...lay(k),...(k==='axisMode'?{params:{axis:30}}:{}),...(k==='shape'&&['screen','overlay'].includes(base.layout)?{source:'shape'}:{})},st=resolve(ctx);
  if(applies(k,st)){assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}
  else{const svgs=new Set(values.map(v=>strip(render({...ctx,[k]:v}))));if(svgs.size>1)assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,1,`${f.id}: ${k} should be inert`);inertOptions++;}}
 if(applies('invert',base)){assert.notEqual(pixels({family:f.id,invert:false}),pixels({family:f.id,invert:true}),`${f.id} invert`);optionChecks+=2;}}

// Four distinct passes, exact replay, no state leaking between renders, seeded randomness.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,`${f.id} passes`);
 const s={family:f.id,params:{seed:42,dropout:.2,jitter:.3,twist:40,pitch:30,contrast:1.3}},a=render(s);render({family:'vault',params:{rays:100}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}
const seeded=seed=>render({family:'cell',params:{dropout:.3,jitter:.4,seed}}).svg;assert.equal(seeded(4),seeded(4));assert.notEqual(seeded(4),seeded(5));
assert.notEqual(render({family:'confetti',params:{seed:1}}).svg,render({family:'confetti',params:{seed:2}}).svg);
const withImage=render({family:'eye',source:'image',image:face});assert.equal(withImage.state.source,'image');assert.equal(withImage.svg,render(JSON.parse(JSON.stringify(withImage.state))).svg);

// Bloom geometry: bead, line and spike counts follow the rule; gaps remove about their share.
{const clean={family:'cell',rayMode:'beads',params:{rays:30,beads:11,rings:0,jitter:0,lengthMod:0,dropout:0,layers:1}};assert.equal(render(clean).features.beads,330);
 assert.equal(render({...clean,params:{...clean.params,layers:3}}).features.beads,990);const gappy=render({...clean,params:{...clean.params,dropout:.5}}).features.beads;assert(gappy>330*.35&&gappy<330*.65,`dropout kept ${gappy}`);
 assert.equal(render({family:'petal',params:{rays:8,lines:44,dropout:0}}).features.lines,352);assert.equal(render({family:'burst',params:{rays:90,dropout:0}}).features.spikes,90);
 assert.equal(render({...clean,params:{...clean.params,sector:120}}).features.beads,330);}
// Lattices stay inside their area; hex rows are offset by half a pitch.
for(const grid of OPTIONS.grid)for(const pitch of [12,23,72]){const area=[16,16,712,978],cells=lattice(grid,area,pitch);assert(cells.length>0);for(const c of cells)assert(c.x>=area[0]&&c.x<=area[2]&&c.y>=area[1]&&c.y<=area[3],`${grid} ${pitch}`);
 if(grid==='hex'){const r0=cells.filter(c=>c.j===0),r1=cells.filter(c=>c.j===1);assert(Math.abs(r1[0].x-r0[0].x-pitch/2)<1e-9);}}

// Hidden image: the luminance of each disc's window follows the source value (Pearson |r|), on the colour pass and at phone width.
function readability(input,width){const r=render({...input,stage:3}),st=r.state,area=r.features.screenArea,F=sourceField(st,area),cells=lattice(st.grid,area,st.params.pitch),k=width?width/r.width:1;
 collect();const img=new Resvg(r.svg,{fitTo:{mode:'width',value:Math.round(r.width*k)}}).render(),data=img.pixels,iw=img.width,ih=img.height,half=Math.max(1,st.params.pitch*k*.5);const xs=[],ys=[];
 for(const c of cells){let s=0,m=0;for(let y=Math.max(0,Math.round(c.y*k-half));y<Math.min(ih,Math.round(c.y*k+half));y++)for(let x=Math.max(0,Math.round(c.x*k-half));x<Math.min(iw,Math.round(c.x*k+half));x++){const i=(y*iw+x)*4;s+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];m++;}if(m){xs.push(F.at(c.x,c.y));ys.push(s/m);}}
 const mean=a=>a.reduce((p,q)=>p+q,0)/a.length,mx=mean(xs),my=mean(ys);let sxy=0,sxx=0,syy=0;xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2;syy+=(ys[i]-my)**2;});return Math.abs(sxy/Math.sqrt(sxx*syy));}
const hidden={};
for(const [name,input] of [['vision',{family:'vision'}],['flip',{family:'flip'}],['scoreboard',{family:'scoreboard'}],['opart',{family:'opart'}],['eye',{family:'eye'}],['word tilt',{family:'flip',source:'word',word:'BEAD/RAY',axisMode:'fixed',params:{pitch:18,contrast:1.8}}],
 ['word iris',{family:'vision',source:'word',word:'LIGHT',params:{pitch:18,contrast:1.8,sourceScale:1}}],['image tilt',{family:'eye',source:'image',image:face,grid:'square',axisMode:'fixed',params:{pitch:18,contrast:1.4}}],...OPTIONS.shape.map(sh=>[`shape ${sh}`,{family:'eye',shape:sh,grid:'hex'}])]){
 const full=readability(input),phone=readability(input,390);hidden[name]={full:+full.toFixed(3),phone:+phone.toFixed(3)};assert(full>=.8,`${name}: hidden image correlation ${full}`);assert(phone>=.7,`${name}: phone-width correlation ${phone}`);}
// Every cell-alphabet character becomes a visible mask; words keep their row structure.
for(const ch of Object.keys(GLYPHS)){const st=resolve({family:'scoreboard',word:ch}),area=geometry(st).screen,F=sourceField(st,area);assert(lattice(st.grid,area,st.params.pitch).some(c=>F.raw(c.x,c.y)>.5),`glyph ${ch}`);}
assert.equal(wordLayout('AB/C').rows.length,2);assert.equal(wordLayout('A B').width,14);assert.equal(wordLayout('I').width,3);

// Sizes and finite output: every preset in every layout and format; stress cases stay bounded by the mark budget.
let maxBytes=0,combos=0;for(const f of FAMILIES)for(const l of LAYOUTS)for(const fm of FORMATS){const r=render({family:f.id,layout:l.id,format:fm.id});assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${l.id} ${fm.id}`);assert.equal(r.width,fm.width);assert.equal(r.height,fm.height);maxBytes=Math.max(maxBytes,r.svg.length);combos++;}
assert(maxBytes<1.6e6,`largest SVG ${maxBytes}`);
const stress=[{family:'confetti',params:{blooms:24,rays:144,beads:48,layers:4,zoom:3}},{family:'scoreboard',format:'landscape',params:{pitch:12}},{family:'petal',params:{rays:144,lines:90,layers:4}},{family:'neon',params:{rays:144,beads:48,layers:4,rings:14,hub:.7}}].map(s=>{const r=render(s);assert(!/NaN/.test(r.svg));assert(r.svg.length<4.5e6,`stress ${r.svg.length}`);return {bytes:r.svg.length,capped:r.features.capped};});
for(const f of FAMILIES)for(const stage of [1,2,3,4])assert(!/NaN|undefined|Infinity/.test(render({family:f.id,stage}).svg));for(const f of ['cell','flip'])assert(!/NaN|undefined/.test(specimen({family:f})));
// The centred bloom at zoom 1 sits inside every format with a margin.
for(const fm of FORMATS){const g=geometry(resolve({family:'neon',format:fm.id,params:{zoom:1,shiftX:0,shiftY:0}})),b=g.blooms[0];assert(b.cx-b.R>=16&&b.cx+b.R<=g.Wf-16&&b.cy-b.R>=16&&b.cy+b.R<=g.Hf-16,fm.id);}

// Inputs.
assert.equal(normalizeWord('bead / ray'),'BEAD/RAY');assert.equal(normalizeWord('kyōto'),'KYOTO');assert.equal(normalizeWord('it’s—ok'),"IT'S-OK");
for(const bad of ['','A&B','🌷','<b>','A/B/C/D','A//B','ABCDEFGHIJKLMNOPQRS'])assert.throws(()=>normalizeWord(bad),bad);
assert.equal(resolve({family:'scoreboard',word:'@@'}).word,'FLIP/DOT');assert.equal(resolve({params:{rays:999}}).params.rays,144);assert.equal(resolve({params:{rays:2.6}}).params.rays,3);assert.equal(resolve({params:{rays:true}}).params.rays,FAMILIES[0].set.params.rays);
assert.equal(resolve({params:{pitch:Infinity}}).params.pitch,FAMILIES[0].set.params.pitch);assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({family:'flip',grid:'bogus'}).grid,'square');assert.equal(resolve({stage:9}).stage,4);
assert.equal(resolve({title:'<script>'}).title,'script');assert(!render({title:'A & B "q"'}).svg.includes('A & B'));
assert.equal(normalizeImage({w:3,h:3,data:'00'.repeat(9)}),null);assert.equal(normalizeImage({w:4,h:4,data:'zz'.repeat(16)}),null);assert.equal(normalizeImage({w:4,h:4,data:'00'.repeat(15)}),null);assert.equal(normalizeImage({w:200,h:4,data:'00'.repeat(800)}),null);
assert.equal(resolve({family:'eye',source:'image'}).source,'shape');assert.equal(resolve({family:'eye',source:'image',image:{w:4,h:4,data:'xx'}}).source,'shape');assert.deepEqual(normalizeImage(imageFromLuminance(4,4,new Array(16).fill(.5))).data,'80'.repeat(16));
const png=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(png.readUInt32BE(16),Math.round(W*3000/H));assert.equal(png.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'scoreboard',params:{pitch:17+i}});const screenMs=+((performance.now()-t0)/10).toFixed(1);const t1=performance.now();for(let i=0;i<10;i++)render({family:'vault',params:{rays:64+i}});const bloomMs=+((performance.now()-t1)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPalettePresets:FAMILIES.length,visibleControlChecks:visible,inertControlChecks:inert,visibleOptionValues:optionChecks,inertOptionChecks:inertOptions,
 distinctPassesPerPreset:4,replay:'exact SVG and resvg pixels, A/B/A, saved JSON (including a sampled image grid); seeded gaps, jitter and field scatter',geometry:'bead, line and spike counts; dropout share; lattices inside their area; hex offset',
 hiddenImage:{metric:'Pearson |r| between source value and mean luminance of each disc window, colour pass; full size and 390 px wide',results:hidden},glyphs:`${Object.keys(GLYPHS).length} cell-alphabet characters visible as masks`,
 sizes:{combinations:`${combos} preset × layout × format renders, finite, right dimensions`,largestSVGBytes:maxBytes,stress},margins:'centred bloom inside every format at zoom 1',invalidInputs:'word normalisation and errors; parameter, boolean, option, colour, stage and text bounds; malformed image grids fall back to the preset source',png:[Math.round(W*3000/H),3000],averageRenderMs:{screen:screenMs,bloom:bloomMs}},
 limitations:'Checks verify construction, controls and legibility of hidden images, not similarity to Nagai’s or Kamekura’s artwork. Poster copy uses system fonts, so its glyphs vary between machines. Marks stop at a 60,000-mark budget per render (flagged as capped).'},null,2));
console.log(`PASS: ${FAMILIES.length} presets, ${visible} visible + ${inert} inert control checks, ${optionChecks} option values (${inertOptions} inert), 4 passes, replay, geometry, hidden-image correlation (min full ${Math.min(...Object.values(hidden).map(h=>h.full))}, phone ${Math.min(...Object.values(hidden).map(h=>h.phone))}), ${combos} layout/format combos (max ${(maxBytes/1024).toFixed(0)} KB), inputs, 2120 × 3000 export. Render screen ${screenMs} ms, bloom ${bloomMs} ms.`);
