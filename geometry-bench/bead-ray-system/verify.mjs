import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,V1_ENGINE,V1_OPTION_KEYS,FAMILIES,CONTROLS,OPTIONS,FORMATS,LAYOUTS,W,H,render,resolve,applies,specimen,series,sourceField,lattice,geometry,wordLayout,normalizeWord,normalizeImage,imageFromLuminance,ditherCells,maskOf,maskBox} from './engine.mjs';
import * as V1 from './v1/engine.mjs';
import {GLYPHS} from '../isometric-prism-system/engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/bead-ray-study-v2'),v1out=path.join(root,'output/bead-ray-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect regularly (run with --expose-gc). Pixel buffers are read once per raster.
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(s,h=260)=>{collect();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=(s,h)=>hash(raster(render(s).svg,h));
const strip=svg=>svg.replaceAll(svg.match(/id="[a-z]+-([a-z0-9]+)/)?.[1]??'\u0000','');
const face=JSON.parse(fs.readFileSync(path.join(out,'demo-image.json'),'utf8')),paintGrid=imageFromLuminance(24,32,Array.from({length:24*32},(_,i)=>((i%24)/23)*((i/24|0)%8<4?1:.3)),'painted');
const V2_FAMILIES=FAMILIES.filter(f=>f.kind==='v2'),V2_CONTROLS=CONTROLS.filter(c=>c.v2),V2_KEYS=Object.keys(OPTIONS).filter(k=>!V1_OPTION_KEYS.includes(k));

// 1. Version 1 compatibility: every shipped v1 rule renders as its shipped SVG (ids aside), the frozen v1 engine still replays them byte for byte,
//    and seeded random v1-style rules render the same in both engines.
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name==='references'?[]:walk(path.join(d,e.name))):[path.join(d,e.name)]);
const v1rules=walk(v1out).filter(f=>f.endsWith('.json')&&fs.existsSync(f.replace(/\.json$/,'.svg')));let v1Pixels=0;
for(const f of v1rules){const st=JSON.parse(fs.readFileSync(f,'utf8')),svg=fs.readFileSync(f.replace(/\.json$/,'.svg'),'utf8');assert.equal(st.engine,V1_ENGINE);
 assert.equal(V1.render(st).svg,svg,`frozen v1 engine: ${path.relative(v1out,f)}`);const v2=render(st);assert.equal(strip(v2.svg),strip(svg),`v2 renders v1 rule ${path.relative(v1out,f)}`);
 if(v1Pixels<16&&/\/(cell|flip|scoreboard|petal|neon|sunrise|vault|confetti)\.json$/.test(f)){assert.equal(hash(raster(v2.svg,400)),hash(raster(svg,400)));v1Pixels++;}}
assert(v1rules.length>=120,`v1 rules found: ${v1rules.length}`);
function rng(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return ((r^r>>>14)>>>0)/4294967296;};}
const fuzz=rng(2026),V1F=V1.FAMILIES.map(f=>f.id);let fuzzed=0;
for(let i=0;i<80;i++){const pick=a=>a[Math.floor(fuzz()*a.length)],st={engine:V1_ENGINE,family:pick(V1F),params:{},stage:pick([1,2,3,4])};for(const k of V1_OPTION_KEYS)if(fuzz()<.5)st[k]=pick(V1.OPTIONS[k]);
 for(const c of V1.CONTROLS)if(fuzz()<.35)st.params[c.key]=c.min+(c.max-c.min)*fuzz();if(fuzz()<.3)st.word=pick(['BEAD','RAY/2026','A B']);if(st.source==='image'||fuzz()<.2)st.image=face;
 assert.equal(strip(render(st).svg),strip(V1.render(st).svg),`fuzz ${i}: ${JSON.stringify(st).slice(0,160)}`);fuzzed++;}

// 2. Presets distinct under one palette.
const common=['#f1ebdd','#e4d9c3','#1f1d1a','#8a7f6e','#d6452b','#1f1d1a'];
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'presets distinct under one palette');

// 3. Controls and options: visible exactly where `applies` says so. Every control on the v2 presets; the v2 controls and options on the v1 presets.
const CIRCULAR=['turn','tilt','sourceAngle','axis','twist'],wrap=(c,v)=>v>c.max?v-(c.max-c.min):v;
const lo=(c,f)=>CIRCULAR.includes(c.key)?f.set.params[c.key]:c.min,hi=(c,f)=>CIRCULAR.includes(c.key)?wrap(c,f.set.params[c.key]+(c.max-c.min)*.37):c.max;
// Overlay blooms are small and high on the poster (and their source scale is set for the screen), so their masks are probed in the centred layout at scale 1.
const CENTRAL=['rings','emblem'],offCentre=f=>{const g=geometry(resolve({family:f.id}));return g.blooms.some(b=>b.cx<0||b.cx>g.Wf||b.cy<0||b.cy>g.Hf);};
let visible=0,inert=0,optionChecks=0,inertOptions=0;
for(const f of FAMILIES){const base=resolve({family:f.id,image:face,paint:paintGrid}),screenish=['screen','overlay'].includes(base.layout),lay=k=>(offCentre(f)&&CENTRAL.includes(k))||(base.layout==='overlay'&&['bloomMask','maskMode'].includes(k))?{layout:'bloom',...(base.layout==='overlay'?{params:{sourceScale:1}}:{})}:{};
 for(const c of f.kind==='v2'?CONTROLS:V2_CONTROLS){const s=v=>({family:f.id,image:face,paint:paintGrid,...lay(c.key),params:{[c.key]:v}});
  if(applies(c.key,base)){assert.notEqual(pixels(s(lo(c,f))),pixels(s(hi(c,f))),`${f.id}: ${c.key} should be visible`);visible++;}
  else{const a=render(s(lo(c,f))),b=render(s(hi(c,f)));if(strip(a.svg)!==strip(b.svg))assert.equal(hash(raster(a.svg)),hash(raster(b.svg)),`${f.id}: ${c.key} should not change the picture`);inert++;}}
 // Options in context: silhouettes with the shape source (or as a bloom mask), flip axes against a 30° axis and a 0.3 swing (a 0.5 swing turns
 // binary squares by exactly 90°), second beads after an egg (a second bead equal to the first changes nothing); v1 presets at a larger raster.
 for(const [k,values] of Object.entries(OPTIONS)){if(f.kind!=='v2'&&!V2_KEYS.includes(k))continue;
  const extra=k==='axisMode'?{params:{axis:30,swing:.3}}:k==='beadAlt'?{bead:'egg'}:k==='shape'?(screenish?{source:'shape'}:{bloomMask:'shape'}):k==='maskMode'&&base.bloomMask==='none'&&!screenish?{bloomMask:'shape',shape:'heart'}:{};
  const ctx={family:f.id,image:face,paint:paintGrid,...lay(k),...extra},st=resolve(ctx);
  if(applies(k,st)){const h=f.kind==='v2'?260:400;assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v},h))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}
  else{const svgs=new Set(values.map(v=>strip(render({...ctx,[k]:v}).svg)));if(svgs.size>1)assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,1,`${f.id}: ${k} should be inert`);inertOptions++;}}}
// New values of v1 option keys change v1 presets where they apply.
let newValues=0;for(const f of FAMILIES.filter(f=>f.kind!=='v2')){const base=resolve({family:f.id});for(const k of V1_OPTION_KEYS){if(!applies(k,base))continue;const fresh=OPTIONS[k].filter(v=>!V1.OPTIONS[k].includes(v)&&!(k==='source'&&v==='paint'));
 for(const v of fresh){assert.notEqual(pixels({family:f.id,[k]:v},400),pixels({family:f.id},400),`${f.id} ${k}=${v}`);newValues++;}}}

// 4. Passes, replay, seeds.
for(const f of V2_FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,`${f.id} passes`);
 const s={family:f.id,params:{seed:42,dropout:.15,jitter:.3,bend:.2,pitch:20,contrast:1.3}},a=render(s);render({family:'moire',params:{moire:20}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}
const grainOf=seed=>hash(raster(render({family:'sunflower',params:{seed}}).svg,500));assert.equal(grainOf(3),grainOf(3));assert.notEqual(grainOf(3),grainOf(4));
const painted=render({family:'eye',source:'paint',paint:paintGrid});assert.equal(painted.state.source,'paint');assert.equal(painted.svg,render(JSON.parse(JSON.stringify(painted.state))).svg);
assert.equal(resolve({family:'eye',source:'paint'}).source,'shape');assert.equal(resolve({family:'eye',source:'paint',paint:{w:2,h:2,data:'00'}}).source,'shape');

// 5. Generators: seed and ring counts; spiral and ring geometry is finite at every setting.
{const N=render({family:'sunflower',beadAlt:'none',params:{rays:20,beads:15,dropout:0,jitter:0,lengthMod:0,rings:0}}).features.beads;assert.equal(N,300);
 const p=resolve({family:'tide'}).params,expect=Array.from({length:12},(_,k)=>{const f=(k/11)**1,s0=p.hub+(1-p.hub)*f;return Math.max(3,Math.round(2*18*s0));}).reduce((a,b)=>a+b,0);
 assert.equal(render({family:'tide',params:{rays:18,beads:12,spacing:1,jitter:0,dropout:0,rings:0}}).features.beads,expect);
 for(const rayMode of ['spiral','rings'])for(const bead of OPTIONS.bead)assert(!/NaN|undefined|Infinity/.test(render({family:'sunflower',rayMode,bead,params:{bend:-1,twist:300,lengthMod:1,jitter:1,layers:4}}).svg),`${rayMode} ${bead}`);}
// Letter beads spell the word along each ray.
assert(render({family:'letter',bloomMask:'none',bead:'glyph',word:'AB'}).svg.length>render({family:'letter',bloomMask:'none',bead:'disc',word:'AB'}).svg.length);

// 6. Masks: with "keep" nothing is inked well outside the mask; with "cut" nothing well inside; with "size" the inside carries more ink.
function maskInk(input){const r=render({...input,stage:3}),st=r.state,g=geometry(st),box=maskBox(g.Wf,g.Hf,g.s),M=maskOf(st,box);collect();const img=new Resvg(r.svg).render(),data=img.pixels,w=img.width,bg=[1,3,5].map(i=>parseInt(st.colors[0].slice(i,i+2),16));
 const ink=(x,y)=>{const i=(Math.round(y)*w+Math.round(x))*4;return Math.abs(data[i]-bg[0])+Math.abs(data[i+1]-bg[1])+Math.abs(data[i+2]-bg[2])>40;};const res={inside:[0,0],outside:[0,0]};
 for(let y=box[1]+14;y<box[3]-14;y+=6)for(let x=box[0]+14;x<box[2]-14;x+=6){const near=[-14,0,14].flatMap(dx=>[-14,0,14].map(dy=>M(x+dx,y+dy))),key=near.every(m=>m>.95)?'inside':near.every(m=>m<.05)?'outside':null;if(!key)continue;
  if(Math.hypot(x-g.blooms[0].cx,y-g.blooms[0].cy)<40)continue;res[key][1]++;if(ink(x,y))res[key][0]++;}
 return {inside:res.inside[0]/res.inside[1],outside:res.outside[0]/res.outside[1]};}
// A single letter (H) has strokes wide enough for probes well inside them.
const H1={family:'letter',word:'H',emblem:'none',params:{beadSize:.5}},masks={keep:maskInk({...H1,maskMode:'clip'}),cut:maskInk({...H1,maskMode:'cut'}),size:maskInk({...H1,maskMode:'size'}),heart:maskInk({family:'sunflower',bloomMask:'shape',shape:'heart',maskMode:'clip',params:{rays:48,beads:30,zoom:1.4}})};
assert(masks.keep.outside===0&&masks.keep.inside>.15,JSON.stringify(masks.keep));assert(masks.cut.inside===0&&masks.cut.outside>.15,JSON.stringify(masks.cut));assert(masks.size.inside>masks.size.outside*2,JSON.stringify(masks.size));assert(masks.heart.outside===0,JSON.stringify(masks.heart));

// 7. Lattices and dithering.
const area=[16,16,712,978];for(const grid of OPTIONS.grid)for(const pitch of [12,23,72]){const cells=lattice(grid,area,pitch);assert(cells.length>0,grid);for(const c of cells)assert(c.x>=area[0]&&c.x<=area[2]&&c.y>=area[1]&&c.y<=area[3],`${grid} ${pitch}`);}
for(const grid of ['triangle','brick','spiral']){const cells=lattice(grid,area,24);let minD=Infinity;for(let i=0;i<cells.length;i+=7)for(const q of cells)if(q!==cells[i])minD=Math.min(minD,Math.hypot(q.x-cells[i].x,q.y-cells[i].y));assert(minD>24*.45,`${grid} spacing ${minD}`);}
assert(lattice('triangle',area,24).some(c=>c.up)&&lattice('triangle',area,24).some(c=>!c.up));
const dither={};for(const mode of ['ordered','diffusion'])for(const grid of ['square','hex','radial','spiral'])for(const level of [.1,.3,.5,.8]){const cells=lattice(grid,area,14).map(c=>({...c,v:level}));ditherCells(cells,mode,grid);
 assert(cells.every(c=>c.v===0||c.v===1));const on=cells.filter(c=>c.v===1).length/cells.length;assert(Math.abs(on-level)<(mode==='ordered'?.07:.03),`${mode} ${grid} ${level}: ${on}`);dither[`${mode} ${grid} ${level}`]=+on.toFixed(3);}
// Truchet: a probe on the (+,+) quarter arc is inked exactly where the source value is at least one half.
{const st=resolve({family:'truchet',grid:'square',source:'word',word:'WEAVE',tint:'none',params:{pitch:24,sourceScale:1,sourceAngle:0}}),r=render({...st,stage:3}),g=geometry(st),F=sourceField(st,g.screen),cells=lattice(st.grid,g.screen,24);collect();
 const img=new Resvg(r.svg).render(),data=img.pixels,w=img.width,bg=[1,3,5].map(i=>parseInt(st.colors[0].slice(i,i+2),16));let agree=0;
 for(const c of cells){const x=Math.round(c.x+12*.293),y=Math.round(c.y+12*.293),i=(y*w+x)*4,inked=Math.abs(data[i]-bg[0])+Math.abs(data[i+1]-bg[1])+Math.abs(data[i+2]-bg[2])>60;if(inked===(F.at(c.x,c.y)>=.5))agree++;}
 var truchet=agree/cells.length;assert(truchet>.97,`truchet orientation agreement ${truchet}`);}

// 8. Hidden image: luminance of each element's window follows the source value (Pearson |r|), colour pass, full size and 390 px wide.
//    Coins are tested on a crisp word: their tone is not monotonic in the value (ochre back, ground when half-turned, forest front).
function readability(input,width){const r=render({...input,stage:3}),st=r.state,area=r.features.screenArea,F=sourceField(st,area),cells=lattice(st.grid,area,st.params.pitch),k=width?width/r.width:1;
 const vals=cells.map(c=>({...c,v:F.at(c.x,c.y)}));if(st.dither!=='none')ditherCells(vals,st.dither,st.grid);
 collect();const img=new Resvg(r.svg,{fitTo:{mode:'width',value:Math.round(r.width*k)}}).render(),data=img.pixels,iw=img.width,ih=img.height,half=Math.max(1,st.params.pitch*k*(st.grid==='triangle'?.25:.5));const xs=[],ys=[];
 for(const c of vals){let s=0,m=0;for(let y=Math.max(0,Math.round(c.y*k-half));y<Math.min(ih,Math.round(c.y*k+half));y++)for(let x=Math.max(0,Math.round(c.x*k-half));x<Math.min(iw,Math.round(c.x*k+half));x++){const i=(y*iw+x)*4;s+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];m++;}if(m){xs.push(c.v);ys.push(s/m);}}
 const mean=a=>a.reduce((p,q)=>p+q,0)/a.length,mx=mean(xs),my=mean(ys);let sxy=0,sxx=0,syy=0;xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2;syy+=(ys[i]-my)**2;});return Math.abs(sxy/Math.sqrt(sxx*syy));}
const hidden={};
for(const [name,input] of [['vision (v1)',{family:'vision'}],['flip (v1)',{family:'flip'}],['scoreboard (v1)',{family:'scoreboard'}],['eye (v1)',{family:'eye'}],
 ['hatch hand',{family:'hatch'}],['hatch image',{family:'hatch',source:'image',image:face,axisMode:'fixed',params:{pitch:12}}],['square tilt',{family:'coin',element:'square',flipMode:'tilt',grid:'square',shape:'star'}],
 ['dither board',{family:'dither'}],['diffusion image',{family:'dither',source:'image',image:face,dither:'diffusion',params:{pitch:12,soft:.2}}],['coin heart',{family:'coin'}],['coin word',{family:'coin',source:'word',word:'COIN',grid:'square',params:{pitch:20,soft:0,contrast:3}}],
 ['triangle star',{family:'coin',grid:'triangle',flipMode:'tilt',shape:'star',params:{pitch:18}}],['spiral heart',{family:'coin',grid:'spiral',flipMode:'tilt',params:{pitch:20}}],['painted',{family:'eye',source:'paint',paint:paintGrid,grid:'square',axisMode:'fixed'}]]){
 const full=readability(input),phone=readability(input,390);hidden[name]={full:+full.toFixed(3),phone:+phone.toFixed(3)};assert(full>=.8,`${name}: hidden image correlation ${full}`);assert(phone>=.7,`${name}: phone-width correlation ${phone}`);}

// 9. Finishes, series, placed centres.
{const riso=render({family:'riso'}).svg;assert((riso.match(/<use href="#mk-/g)||[]).length===2&&riso.includes('mix-blend-mode:multiply')&&riso.includes('feTurbulence'));assert(!render({family:'riso',finish:'none'}).svg.includes('feTurbulence'));
 assert.notEqual(pixels({family:'riso'}),pixels({family:'riso',params:{misreg:0}}));}
const ser=series({family:'sunflower'},4);assert.equal(ser.length,4);assert.equal(new Set(ser.map(s=>render(s).svg)).size,4);assert.deepEqual(series({family:'sunflower'},4).map(s=>JSON.stringify(s)),ser.map(s=>JSON.stringify(s)));assert(ser[2].info.endsWith('3 of 4'));assert.equal(new Set(series({family:'letter'},4).map(s=>s.params.sourceAngle)).size,1);
assert.equal(series({family:'coin'},9).length,6);assert.equal(series({family:'coin'},1).length,2);assert.equal(new Set(series({family:'coin'},4).map(s=>s.shape)).size,4);
{const centres=[{x:.3,y:.4,r:.5},{x:.7,y:.7,r:.8}],r=render({family:'seeds',centres});assert.deepEqual(r.features.blooms.map(b=>[b.cx,b.cy]),centres.map(c=>[+(c.x*W).toFixed(2),+(c.y*H).toFixed(2)]));
 assert.equal(resolve({centres:Array.from({length:40},()=>({x:.5,y:.5,r:.5}))}).centres.length,24);assert.deepEqual(resolve({centres:[{x:9,y:-9,r:99},{x:'a'},{x:true,y:1,r:1}]}).centres,[{x:1.2,y:-.2,r:2}]);}

// 10. Sizes and finite output: every preset in every layout and format; the specimen.
let maxBytes=0,combos=0;for(const f of FAMILIES)for(const l of LAYOUTS)for(const fm of FORMATS){const r=render({family:f.id,layout:l.id,format:fm.id});assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${l.id} ${fm.id}`);assert.equal(r.width,fm.width);maxBytes=Math.max(maxBytes,r.svg.length);combos++;}
assert(maxBytes<1.6e6,`largest SVG ${maxBytes}`);for(const f of ['sunflower','truchet'])assert(!/NaN|undefined/.test(specimen({family:f})));assert.equal((specimen({family:'tide'}).match(/data-tile=/g)||[]).length,60);
for(const f of V2_FAMILIES)for(const stage of [1,2,3,4])assert(!/NaN|undefined|Infinity/.test(render({family:f.id,stage}).svg));

// 11. Inputs and export.
assert.equal(normalizeWord('bead / ray'),'BEAD/RAY');for(const bad of ['','A&B','<b>','A/B/C/D','ABCDEFGHIJKLMNOPQRS'])assert.throws(()=>normalizeWord(bad),bad);
assert.equal(resolve({}).family,FAMILIES[0].id);assert.equal(FAMILIES[0].kind,'v2');assert.equal(resolve({params:{moire:99}}).params.moire,45);assert.equal(resolve({params:{bend:true}}).params.bend,FAMILIES[0].set.params.bend);
assert.equal(resolve({family:'coin',element:'bogus',dither:'x',finish:'gold'}).element,'disc');assert.equal(resolve({engine:V1_ENGINE,family:'cell'}).engine,ENGINE);assert.equal(resolve({title:'<script>'}).title,'script');
assert.equal(normalizeImage({w:3,h:3,data:'00'.repeat(9)}),null);
const png=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(png.readUInt32BE(16),Math.round(W*3000/H));assert.equal(png.readUInt32BE(20),3000);
const time=f=>{const t=performance.now();for(let i=0;i<8;i++)render({family:f,params:{seed:i}});return +((performance.now()-t)/8).toFixed(1);},renderMs={moire:time('moire'),truchet:time('truchet'),letter:time('letter'),tide:time('tide')};
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{
 v1Compatibility:{shippedRules:v1rules.length,result:'every shipped v1 rule renders its shipped SVG in v2 (ids aside); the frozen v1 engine in ./v1 replays them byte for byte',pixelSpotChecks:v1Pixels,fuzzedV1Rules:`${fuzzed} seeded random v1-style rules identical in both engines`},
 presetsDistinct:FAMILIES.length,visibleControlChecks:visible,inertControlChecks:inert,visibleOptionValues:optionChecks,inertOptionChecks:inertOptions,newOptionValuesOnV1Presets:newValues,distinctPassesPerV2Preset:4,
 replay:'exact SVG and pixels for every v2 preset, painted sources, seeded grain',generators:'phyllotaxis seed count; ring counts; spiral and ring geometry finite at extreme bend, twist, modulation and jitter for every bead',masks,dither,truchetOrientationAgreement:+truchet.toFixed(3),
 hiddenImage:{metric:'Pearson |r| between source value (after dithering) and mean luminance of each element window, colour pass; full size and 390 px wide',results:hidden},finishes:'riso plate and inks multiplied, grain seeded; misregistration visible',series:'four distinct, deterministic, numbered posters; count clamped to 2–6; silhouettes cycle',centres:'placed field centres honoured, clamped and capped at 24',
 sizes:{combinations:`${combos} preset × layout × format renders, finite, right dimensions`,largestSVGBytes:maxBytes},glyphs:`${Object.keys(GLYPHS).length} cell-alphabet characters available to words, masks and letter beads`,png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},
 limitations:'Checks verify construction, controls, compatibility and legibility of hidden images, not similarity to Nagai’s or Kamekura’s artwork or aesthetic quality. Poster copy uses system fonts. Masks act on mark centres (spikes and petal lines are kept or cut whole). Marks stop at a 60,000-mark budget per render (flagged as capped).'},null,2));
console.log(`PASS: v1 compatibility (${v1rules.length} shipped rules, ${fuzzed} fuzzed), ${FAMILIES.length} presets, ${visible} visible + ${inert} inert control checks, ${optionChecks} option values (${inertOptions} inert, ${newValues} new values on v1 presets), passes, replay, generators, masks ${JSON.stringify(masks.keep)}, dither, truchet ${truchet.toFixed(3)}, hidden image (min full ${Math.min(...Object.values(hidden).map(h=>h.full))}, phone ${Math.min(...Object.values(hidden).map(h=>h.phone))}), finishes, series, centres, ${combos} combos (max ${(maxBytes/1024).toFixed(0)} KB). Render ${JSON.stringify(renderMs)} ms.`);
