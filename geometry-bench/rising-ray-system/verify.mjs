import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,LAYOUTS,FORMATS,PALETTES,SPECIMEN_ROWS,render,resolve,rayAngles,origins,normalizeTitle,specimen} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/rising-ray-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect regularly (run with --expose-gc).
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(s,h=420)=>{collect();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const common=PALETTES.find(p=>p.id==='ocean').colors;

// Ten styles under one palette; every control and option visible in every style.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'styles distinct under one palette');
// Each control is tried where it matters: option-gated controls with an enabling option,
// horizon controls with a visible sea, rotation (circular) against a small turn.
const enabling=(f,c)=>{if(!c.when||Object.entries(c.when).some(([k,vs])=>vs.includes(f.set[k])))return {};const [k,vs]=Object.entries(c.when)[0];return {[k]:vs[0]};};
const HORIZON={horizon:.7,waves:3,amplitude:.8};
const CONTEXT={waves:{params:{horizon:.7}},amplitude:{params:HORIZON},frequency:{params:HORIZON},depth:{params:HORIZON},rings:{params:{sun:.15}}};
let controlChecks=0,optionChecks=0;
for(const f of FAMILIES){for(const c of CONTROLS){const ctx={family:f.id,...enabling(f,c),...CONTEXT[c.key]},s=v=>({...ctx,params:{...ctx.params,[c.key]:v}}),[a,b]=c.circular?[0,7]:[c.min,c.max];
  assert.notEqual(pixels(s(a)),pixels(s(b)),`${f.id} ${c.key}`);controlChecks++;}
 const OPT={sunStyle:{params:{sun:.2,rings:3}},waveStyle:{params:HORIZON},bursts:{params:{originX:.25,originY:.4}},outline:{params:{reach:.7}}};
 for(const [k,values] of Object.entries(OPTIONS)){const ctx={family:f.id,...OPT[k]};assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}}
// Layout presets are distinct in every style.
for(const f of FAMILIES)assert.equal(new Set(LAYOUTS.map(l=>pixels({family:f.id,...l.set,params:{...f.set.params,...l.set.params}}))).size,LAYOUTS.length,`${f.id} layouts`);
// Four passes, exact replay, no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,modulation:'random',params:{count:37,rotate:23,seed:77,originX:.3,sun:.2,waves:4,horizon:.7}},a=render(s);render({family:'neon',params:{count:9}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}
// Seeds: the same seed replays, a different seed changes random widths.
assert.equal(render({family:'fancy',params:{seed:5}}).svg,render({family:'fancy',params:{seed:5}}).svg);assert.notEqual(render({family:'fancy',params:{seed:5}}).svg,render({family:'fancy',params:{seed:6}}).svg);

// Ray tiling: for every count, modulation, colour count and several seeds and turns,
// the rays are contiguous, close exactly one turn, alternate colour across the
// closing seam, and none is a sliver (narrower than a fifth of the mean ray).
let tilings=0,narrowest=1;
for(let count=CONTROLS[0].min;count<=CONTROLS[0].max;count++)for(const modulation of OPTIONS.modulation)for(const rays of OPTIONS.rays)for(const [seed,rotate,modulate] of [[1,0,1],[404,-133,1],[999,71,.5]]){
 const {rays:list,N,k}=rayAngles(resolve({modulation,rays,params:{count,seed,rotate,modulate}}),{facing:.7});tilings++;
 assert.equal(N%k,0);assert(N>=2*k);for(let i=0;i<N;i++){const r=list[i],next=list[(i+1)%N];assert(r.a1>r.a0);if(i<N-1)assert.equal(r.a1,next.a0);assert.notEqual(r.c,next.c,`${count} ${modulation} ${rays}: neighbours ${i} share a colour`);
  const rel=(r.a1-r.a0)/(2*Math.PI/N);narrowest=Math.min(narrowest,rel);assert(rel>=.2,`${count} ${modulation} ${rays}: sliver ${rel}`);}
 assert(Math.abs(list[N-1].a1-list[0].a0-2*Math.PI)<1e-12,'closes one turn');}

// Seams: rays drawn alone on a pure green ground, rasterised at non-integer
// scales. Ray centres must show their exact colour; every pixel along a ray
// boundary must be a blend of the two neighbouring ray colours, never ground.
const SEAM=['#00ff00','#e8463b','#2a3d97','#f6c445','#000000','#000000','#000000','#000000','#000000','#000000'],rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const offSegment=(px,a,b)=>{const ab=a.map((v,i)=>b[i]-v),t=Math.max(0,Math.min(1,ab.reduce((s,v,i)=>s+v*(px[i]-a[i]),0)/Math.max(1,ab.reduce((s,v)=>s+v*v,0))));return Math.hypot(...px.map((v,i)=>v-(a[i]+ab[i]*t)));};
let seamProbes=0,centreProbes=0,seamScenes=0,worstSeam=0;
for(const [count,modulation,rays,bursts,format,scale] of [[4,'even','pair','single','poster',1],[12,'alternate','pair','single','poster',1.37],[45,'random','triple','single','square',.81],[96,'taper','pair','single','poster',2.13],[66,'wave','triple','single','landscape',1.5],[30,'random','pair','twin','poster',1.73],[24,'even','triple','stack','banner',1.21],[96,'random','triple','single','poster',.67]]){
 const s={family:'yokoo',stage:2,colors:SEAM,rays,modulation,bursts,format,pattern:'solid',outline:'edge',params:{count,modulate:1,seed:31,sun:0,line:0,rotate:11,originX:bursts==='single'?.43:.2,originY:bursts==='stack'?.3:.61}},r=render(s);collect();
 const img=new Resvg(r.svg,{fitTo:{mode:'zoom',value:scale}}).render(),data=img.pixels,w=img.width,h=img.height,cols=[SEAM[1],SEAM[2],SEAM[3]].map(rgb),st=resolve(s),os=origins(st,r.width,r.height);seamScenes++;
 const at=(x,y)=>{const i=(Math.floor(y*scale)*w+Math.floor(x*scale))*4;return [data[i],data[i+1],data[i+2]];},inside=(x,y,o,k)=>x>3&&y>3&&x<r.width-3&&y<r.height-3&&(st.bursts==='single'||(st.bursts==='twin'?(k?x>r.width/2+3:x<r.width/2-3):(k?y>r.height/2+3:y<r.height/2-3)));
 os.forEach((o,k)=>{const {rays:list,N}=rayAngles(st,{facing:Math.atan2(r.height*.45-os[0][1],r.width/2-os[0][0])});const mirror=st.bursts==='single'||k===0?a=>a:st.bursts==='twin'?a=>Math.PI-a:a=>-a;
  for(let i=0;i<N;i++){const ray=list[i],prev=list[(i+N-1)%N];for(const rad of [24,60,140,300,600,900]){
   const mid=mirror((ray.a0+ray.a1)/2),x=o[0]+rad*Math.cos(mid),y=o[1]+rad*Math.sin(mid),half=(ray.a1-ray.a0)/2*rad*scale;
   if(half>=2.5&&inside(x,y,o,k)){const px=at(x,y);assert(px.every((v,c)=>Math.abs(v-cols[ray.c][c])<=2),`centre of ray ${i} shows ${px}`);centreProbes++;}
   const b=mirror(ray.a0),bx=o[0]+rad*Math.cos(b),by=o[1]+rad*Math.sin(b);if(!inside(bx,by,o,k)||(ray.a1-ray.a0)*rad*scale<3||(prev.a1-prev.a0)*rad*scale<3)continue;
   const px=at(bx,by),d=offSegment(px,cols[prev.c],cols[ray.c]);worstSeam=Math.max(worstSeam,d);assert(d<=10,`${count} ${modulation} ${bursts}: seam pixel ${px} between ${SEAM[prev.c+1]} and ${SEAM[ray.c+1]} (off by ${d.toFixed(1)})`);seamProbes++;}}});
 // Twin and stacked bursts meet on the centre line without a ground seam.
 if(st.bursts!=='single')for(let t=6;t<(st.bursts==='twin'?r.height:r.width)-6;t+=3){const [x,y]=st.bursts==='twin'?[r.width/2,t]:[t,r.height/2];for(const d of [-.6,-.2,.2,.6]){const px=at(st.bursts==='twin'?x+d:x,st.bursts==='twin'?y:y+d),off=Math.min(...[[0,1],[1,2],[0,2]].map(([a,b])=>offSegment(px,cols[a],cols[b])));worstSeam=Math.max(worstSeam,off);assert(off<=10,`ground shows on the ${st.bursts} centre line at ${x},${y}: ${px}`);seamProbes++;}}}

// Every style, layout, format and pass renders cleanly; the kit and every option render.
for(const f of FAMILIES)for(const l of [{id:'own',set:{}},...LAYOUTS])for(const fmt of FORMATS)for(const stage of [1,2,3,4]){const r=render({family:f.id,...l.set,params:{...f.set.params,...l.set.params},format:fmt.id,stage});assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${l.id} ${fmt.id} ${stage}`);assert.equal([r.width,r.height].join(),[fmt.w,fmt.h].join());
 const t=r.features.titleSlot;if(t&&t.kind!=='arch')assert(t.x0>=0&&t.x1<=fmt.w&&t.y0>=0&&t.y1<=fmt.h,`${f.id} ${fmt.id} title slot`);if(t&&t.kind==='arch')assert(t.cy-t.outer>=0,`${f.id} ${fmt.id} arch inside the page`);}
for(const [k,values] of Object.entries(OPTIONS))for(const v of values)for(const stage of [1,4])assert(!/NaN|undefined|Infinity/.test(render({family:'yokoo',[k]:v,stage}).svg),`${k} ${v}`);
for(const f of FAMILIES){const s=specimen({family:f.id});assert(!/NaN|undefined|Infinity/.test(s));assert.equal((s.match(/data-part=/g)||[]).length,SPECIMEN_ROWS.reduce((a,r)=>a+r.tiles.length,0));}
// Extreme controls stay finite.
for(const f of FAMILIES)for(const end of ['min','max'])assert(!/NaN|undefined|Infinity/.test(render({family:f.id,params:Object.fromEntries(CONTROLS.map(c=>[c.key,c[end]]))}).svg),`${f.id} all ${end}`);

// Input handling.
assert.equal(normalizeTitle('Théâtre — of rays'),'THEATRE - OF RAYS');assert.equal(normalizeTitle('<b>hi</b>'),'BHI/B');assert.equal(normalizeTitle('  a   b '),'A B');assert.equal(normalizeTitle('x'.repeat(50)).length,32);assert.equal(normalizeTitle('光'),'');
assert.equal(resolve({title:42}).title,FAMILIES[0].title);assert.equal(resolve({info:'<script>x</script>'}).info,'scriptx/script');assert.equal(resolve({info:'y'.repeat(200)}).info.length,80);
assert.equal(resolve({params:{count:999}}).params.count,96);assert.equal(resolve({params:{count:2.6}}).params.count,4);assert.equal(resolve({params:{count:37.4}}).params.count,37);assert.equal(resolve({params:{sun:NaN}}).params.sun,FAMILIES[0].set.params.sun);assert.equal(resolve({params:{originX:null}}).params.originX,FAMILIES[0].set.params.originX);
assert.equal(rayAngles(resolve({rays:'triple',params:{count:37}})).N,36);assert.equal(rayAngles(resolve({rays:'pair',params:{count:5}})).N,6);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.deepEqual(resolve({palette:'neon'}).colors,PALETTES.find(p=>p.id==='neon').colors);assert.equal(resolve({palette:'bogus',family:'tide'}).palette,'tide');
assert.equal(resolve({panel:'bogus',family:'theatre'}).panel,'proscenium');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({family:'nope'}).family,FAMILIES[0].id);assert.equal(resolve({engine:'x'}).engine,ENGINE);
assert(!render({title:'"><script>'}).svg.includes('<script'),'markup in copy is escaped');
// Exports: poster PNG at 2120 × 3000, other formats at a 3000px long edge.
for(const f of FORMATS){const r=render({family:'opart',format:f.id}),fit=f.w>f.h?{mode:'width',value:3000}:{mode:'height',value:3000};collect();const p=new Resvg(r.svg,{fitTo:fit}).render().asPng();assert.equal(Math.max(p.readUInt32BE(16),p.readUInt32BE(20)),3000);if(f.id==='poster')assert.deepEqual([p.readUInt32BE(16),p.readUInt32BE(20)],[2120,3000]);}
const t0=performance.now();for(let i=0;i<10;i++)render({family:'neon',params:{count:30+i}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteStyles:FAMILIES.length,visibleControlChecks:controlChecks,visibleOptionValues:optionChecks,layouts:`${LAYOUTS.length} distinct presets in each of ${FAMILIES.length} styles`,distinctPassesPerStyle:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON; seeded randomness replays and changes with the seed',
 rayTiling:`${tilings} tilings (counts ${CONTROLS[0].min}–${CONTROLS[0].max} × ${OPTIONS.modulation.length} modulations × 2 colour counts × 3 seeds/turns): contiguous, close one turn, neighbours always differ across the closing seam, narrowest ray ${narrowest.toFixed(2)} × mean`,
 seams:`${seamProbes} boundary and centre-line pixels in ${seamScenes} scenes (single, twin and stacked bursts; zoom 0.67–2.13) are blends of the two neighbouring ray colours, never the ground (worst ${worstSeam.toFixed(1)} RGB units off the blend); ${centreProbes} ray centres show their exact colour`,
 renders:`${FAMILIES.length} styles × ${LAYOUTS.length+1} layouts × ${FORMATS.length} formats × 4 passes, every option value, kit sheets and all-min/all-max controls: no NaN, title slots inside the page`,invalidInputs:'title normalisation and length, info markup and length, parameter, colour, palette, option, stage and family bounds; ray count rounded to the colour count',png:'poster 2120 × 3000; other formats 3000px long edge',averageRenderMs:renderMs},
 limitations:'Checks verify construction, tiling and drawing, not similarity to Yokoo’s posters. Title and date line use system fonts (Impact, Helvetica) with forced glyph advances, so letter shapes vary between machines. Seam probes use a solid fill with no sun or ink lines; patterned fills reuse the same layering.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls, ${optionChecks} option values, layouts, 4 stages, replay, ${tilings} tilings (narrowest ${narrowest.toFixed(2)}), ${seamProbes} seam + ${centreProbes} centre probes in ${seamScenes} scenes (worst ${worstSeam.toFixed(1)}), renders, inputs, exports. Render ${renderMs} ms.`);
