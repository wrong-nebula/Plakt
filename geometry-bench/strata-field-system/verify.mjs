import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,PALETTES,W,H,render,resolve,geometry,panelsFor,normalizeProfile,specimen,active,OPTION_NEEDS,trimLoop} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/strata-field-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect regularly (run with --expose-gc).
// `pixels` copies the whole buffer on every access, so it is read once per raster.
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(s,h=360)=>{collect();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const image=(svg,h=H)=>{collect();const img=new Resvg(svg,{fitTo:{mode:'height',value:h}}).render();return {w:img.width,h:img.height,data:img.pixels};};
const rgbAt=(im,x,y)=>{const i=(Math.round(y)*im.w+Math.round(x))*4;return [im.data[i],im.data[i+1],im.data[i+2]];};
const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const common=['#ece6da','#1d1b26','#121212','#e8b730','#d8452f','#2f7fb8','#e7c94d','#3c9a6a','#8a4fa0','#f08a3a','#4a6fc4','#e46a9a','#7cb36a','#2a2a40'];

// Eleven styles under one palette; every control and option visible in every style, each where it applies.
// The inlay line angle is circular (0° and 180° draw the same orientation), so it is compared with its midpoint.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'styles under one palette');
const linear=f=>['horizontal','vertical'].includes(f.set.direction),centred=f=>['radial','concentric','contour'].includes(f.set.direction);
function context(f,key){const s=f.set,c={params:{}};
 if(key==='tilt'&&!linear(f))c.direction='horizontal';if((key==='cx'||key==='cy')&&!centred(f))c.direction='radial';if(key==='peaks')c.direction='contour';
 if(key==='octaves'&&!['noise','waves','terrain'].includes(s.displace))c.displace='noise';
 if((key==='rangeHeight'||key==='relax')&&!s.params.ranges)c.params.ranges=3;if(key==='horizon'&&s.mirror==='off')c.mirror='reflect';
 if((key==='faultAngle'||key==='faultShift')&&!s.params.faults)c.params.faults=2;
 if(key.startsWith('inlay')&&s.inlay==='none')c.inlay='disc';if(key==='inlayAngle'&&!['strata','overlay'].includes(s.inlayFill))c.inlayFill='strata';
 if(key==='order'){if(s.direction==='contour')c.direction='horizontal';c.params={amplitude:.7,drift:1};}if(key==='mirror')c.params.ranges=3;
 if(key==='inlayLayer'){c.inlay=s.inlay==='none'?'disc':s.inlay;c.params={ranges:5,rangeHeight:.9,inlaySize:.6,inlayY:.5,inlayX:.5,inlayCount:1};}
 if(key==='inlayFill'&&s.inlay==='none')c.inlay='disc';if(['weightRamp','index','glow'].includes(key)&&s.render==='bands')c.render='lines';return c;}
let controlChecks=0,optionChecks=0;
for(const f of FAMILIES){for(const c of CONTROLS){const ctx=context(f,c.key),st=v=>({family:f.id,...ctx,params:{...ctx.params,[c.key]:v}});assert(active(c.needs,resolve(st(c.max))),`${f.id} ${c.key} context`);
  const hi=c.key==='inlayAngle'?(c.min+c.max)/2:c.max;assert.notEqual(pixels(st(c.min)),pixels(st(hi)),`${f.id} ${c.key}`);controlChecks++;}
 for(const [k,values] of Object.entries(OPTIONS)){const ctx=context(f,k);assert(active(OPTION_NEEDS[k],resolve({family:f.id,...ctx})),`${f.id} ${k} context`);assert.equal(new Set(values.map(v=>pixels({family:f.id,...ctx,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}}
// Controls that do not apply leave the drawing unchanged (the editor disables them); ids carry a hash of the state, so they are normalised.
const bare=svg=>{const uid=svg.match(/id="(s[0-9a-z]+)-p0"/)[1];return svg.replaceAll(uid,'ID');};
let inert=0;for(const [key,state] of [['weightRamp',{family:'riso'}],['index',{family:'kizashi'}],['glow',{family:'kizashi'}],['tilt',{family:'contour'}],['cx',{family:'awazu'}],['peaks',{family:'nagai'}],['octaves',{family:'moire'}],['rangeHeight',{family:'nagai'}],['horizon',{family:'awazu'}],['faultShift',{family:'awazu'}],['inlaySize',{family:'awazu'}],['inlayAngle',{family:'kyoto'}]]){
 const c=CONTROLS.find(x=>x.key===key);assert(!active(c.needs,resolve(state)),key);assert.equal(bare(render({...state,params:{[key]:c.min}}).svg),bare(render({...state,params:{[key]:c.max}}).svg),`${key} should be inert in ${state.family}`);inert++;}

// Four passes, seeds, exact replay and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,params:{seed:42,amplitude:.4,faults:2,ranges:2,wobble:.5},inlay:'eye',profile:[.2,.8,.4]},a=render(s);render({family:'nagai',params:{seed:3}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}
const seeds=[1,2,3,50,500,999];assert.equal(new Set(seeds.map(seed=>pixels({family:'awazu',params:{seed}}))).size,seeds.length,'seeds');

// Ordering: neighbours never cross in stack order. Graph lines are checked
// exactly — both simplified polylines evaluated at the union of their
// breakpoints — and every line must advance along u (no self-intersection).
const evalAt=(uv,u)=>{let lo=0,hi=uv.length-1;if(u<=uv[0][0])return uv[0][1];if(u>=uv[hi][0])return uv[hi][1];while(hi-lo>1){const m=(lo+hi)>>1;if(uv[m][0]<=u)lo=m;else hi=m;}const [u0,v0]=uv[lo],[u1,v1]=uv[hi];return v0+(v1-v0)*(u-u0)/(u1-u0);};
let pairChecks=0,minGap=Infinity,crossings=0;
function graphGaps(lines,scale,wrap){const sorted=[...lines].sort((a,b)=>a.index-b.index);let worst=Infinity;
 for(const l of sorted)for(let i=1;i<l.uv.length;i++)assert(l.uv[i][0]>l.uv[i-1][0],'a line turns back on itself');
 const pairs=sorted.slice(1).map((b,i)=>[sorted[i],b,0]);if(wrap)pairs.push([sorted[sorted.length-1],sorted[0],Math.PI*2]);
 for(const [a,b,off] of pairs){const us=[...new Set([...a.uv.map(p=>p[0]),...b.uv.map(p=>p[0])])];for(const u of us){const g=(evalAt(b.uv,u)+off-evalAt(a.uv,u))*scale(u);worst=Math.min(worst,g);pairChecks++;}}
 return worst;}
// Contours: drawn segments (loops trimmed to the field) of neighbouring levels, and of one loop, never intersect.
function contourCrossings(lines,rect){const cell=6;let hits=0;const sorted=[...lines].sort((a,b)=>a.index-b.index),drawn=l=>l.loops.flatMap(loop=>trimLoop(loop,rect));
 for(let k=0;k<sorted.length-1;k++){const grid=new Map(),add=(s)=>{const x0=Math.floor(Math.min(s[0],s[2])/cell),x1=Math.floor(Math.max(s[0],s[2])/cell),y0=Math.floor(Math.min(s[1],s[3])/cell),y1=Math.floor(Math.max(s[1],s[3])/cell);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x*100003+y;(grid.get(key)??grid.set(key,[]).get(key)).push(s);}};
  for(const [li,l] of [[0,sorted[k]],[1,sorted[k+1]]])drawn(l).forEach(({pts,closed},lp)=>{const n=pts.length;for(let i=0;i<(closed?n:n-1);i++){const p=pts[i],q=pts[(i+1)%n];add([p[0],p[1],q[0],q[1],li,lp,i,n]);}});
  for(const list of grid.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(a[4]===b[4]&&a[5]===b[5]&&(Math.abs(a[6]-b[6])<=1||Math.abs(a[6]-b[6])===a[7]-1))continue;if(a[4]===b[4]&&a[5]!==b[5])continue;
   if(intersect(a,b))hits++;}pairChecks+=sorted[k].loops.length;}
 return hits;}
const cross=(ax,ay,bx,by,cx,cy)=>(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
const intersect=(a,b)=>{const d1=cross(b[0],b[1],b[2],b[3],a[0],a[1]),d2=cross(b[0],b[1],b[2],b[3],a[2],a[3]),d3=cross(a[0],a[1],a[2],a[3],b[0],b[1]),d4=cross(a[0],a[1],a[2],a[3],b[2],b[3]);return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));};
function checkOrder(state,label){const s=resolve(state);let worst=Infinity;for(const panel of panelsFor(s)){if(panel.mirror)continue;const G=geometry(s,panel),F=G.field;
  if(F.kind==='contour'){const hits=contourCrossings(F.lines,G.rect);assert.equal(hits,0,`${label}: ${hits} contour crossings`);}
  else if(s.order==='stack'){const scale=F.kind==='radial'?u=>u:()=>1;worst=Math.min(worst,graphGaps(F.lines,scale,F.kind==='radial'));}
  for(const rg of G.ranges){const g=graphGaps(rg.lines.map((l,i)=>({...l,index:rg.hang?-i:i})),()=>1,false);worst=Math.min(worst,g);}}
 if(worst<Infinity){assert(worst>=.05,`${label}: neighbours ${worst.toFixed(3)} px apart`);minGap=Math.min(minGap,worst);}return worst;}
let orderStates=0;
for(const f of FAMILIES){checkOrder({family:f.id},f.id);orderStates++;}
// Stress: every graph direction × base curve at full amplitude, drift, wobble and jitter, with four steep faults and ranges.
const stress={amplitude:1,drift:1,wobble:1,pitchJitter:1,frequency:5,octaves:4,faults:4,faultShift:1,faultAngle:40,ranges:4,rangeHeight:1,relax:.3,lines:240,ampRamp:.6};
for(const direction of ['horizontal','vertical','radial','concentric'])for(const displace of OPTIONS.displace){checkOrder({family:'awazu',direction,displace,params:{...stress,tilt:direction==='horizontal'?25:0}},`${direction} ${displace}`);orderStates++;}
for(const mirror of ['facing','reflect']){checkOrder({family:'kyoto',mirror,params:{...stress}},`ranges ${mirror}`);orderStates++;}
for(const displace of ['noise','waves','terrain']){checkOrder({family:'contour',displace,params:{amplitude:1,faults:3,faultShift:1,wobble:1,lines:90}},`contour ${displace}`);orderStates++;}
// Fold mode really lets neighbours cross at the same settings.
{const s=resolve({family:'nagai',order:'fold',params:{amplitude:1,drift:1}}),G=geometry(s,panelsFor(s)[0]);const sorted=[...G.field.lines].sort((a,b)=>a.index-b.index);
 for(let i=1;i<sorted.length;i++)for(const [u,v] of sorted[i].uv)if(v<evalAt(sorted[i-1].uv,u)-.5)crossings++;assert(crossings>0,'fold mode should let lines cross');}

// Faults step every line by the fault's shift; the stack is untouched elsewhere.
{const s=resolve({family:'nagai',displace:'sine',params:{amplitude:0,wobble:0,pitchJitter:0,faults:1,faultAngle:0,faultShift:.6,ampRamp:0}}),G=geometry(s,panelsFor(s)[0]),f=G.faults[0];let steps=0;
 for(const l of G.field.lines.filter(l=>l.index%7===0)){const left=evalAt(l.uv,f.P[0]-W/2-60),right=evalAt(l.uv,f.P[0]-W/2+60);assert(Math.abs((right-left)-f.s)<.3,`fault step ${right-left} vs ${f.s}`);steps++;}assert(steps>10);}

// Inlays break the strata: a solid disc shows the accent at its centre, a void disc shows ground.
for(const [fill,role] of [['solid',3],['void',1]])for(const family of ['awazu','nagai','kizashi','contour']){const s={family,inlay:'disc',inlayFill:fill,layout:'full',stage:3,params:{inlaySize:.25,inlayX:.4,inlayY:.62,inlayCount:1,misregister:0,glow:0,ranges:0}},r=render(s),im=image(r.svg),want=hexRGB(r.state.colors[role]),px=rgbAt(im,W*.4,H*.62);
 assert(px.every((v,i)=>Math.abs(v-want[i])<=3),`${family} ${fill} inlay shows ${px} not ${want}`);}
// A reflected horizon is a mirror image; a diptych is book-matched.
{const s={family:'neon',layout:'full',stage:3,params:{glow:0,horizon:.5}},im=image(render(s).svg),hz=H/2;let diff=0,n=0;for(let d=6;d<400;d+=9)for(let x=3;x<W;x+=7){const a=rgbAt(im,x,hz-d-1),b=rgbAt(im,x,hz+d);diff+=a.reduce((t,v,i)=>t+Math.abs(v-b[i]),0)/3;n++;}assert(diff/n<1.5,`reflection differs by ${diff/n}`);}
{const s={family:'plotter',layout:'diptych',stage:3},im=image(render(s).svg);let diff=0,n=0;for(let y=40;y<H-170;y+=11)for(let x=30;x<W/2-8;x+=5){const a=rgbAt(im,x,y),b=rgbAt(im,W-1-x,y);diff+=a.reduce((t,v,i)=>t+Math.abs(v-b[i]),0)/3;n++;}assert(diff/n<2,`diptych halves differ by ${diff/n}`);}
// Layout: nothing of the field reaches the title band, frame margin or split gutter.
for(const [layout,box] of [['title',[0,0,W,186]],['frame',[0,0,W,48]],['split',[0,456,W,574]],['diptych',[W/2-3,30,W/2+3,H-170]]])for(const family of ['awazu','nagai','topo']){const r=render({family,layout,stage:3}),im=image(r.svg),paper=hexRGB(r.state.colors[0]);
 for(let y=box[1]+2;y<box[3]-2;y+=5)for(let x=box[0]+2;x<box[2]-2;x+=5){const px=rgbAt(im,x,y);assert(px.every((v,i)=>Math.abs(v-paper[i])<=2),`${family} ${layout}: field ink in the margin at ${x},${y}`);}}

// Files stay small and pen-plotter friendly: lines merge per colour and weight;
// the single-pen style draws only open or closed strokes, no fills.
let largest=0;for(const f of FAMILIES)for(const stage of [1,2,3,4]){const r=render({family:f.id,stage});largest=Math.max(largest,r.svg.length);assert(r.svg.length<620000,`${f.id} ${stage}: ${r.svg.length} bytes`);assert(r.features.paths<180,`${f.id} ${stage}: ${r.features.paths} paths`);}
{const svg=render({family:'plotter',stage:3}).svg,field=svg.slice(svg.indexOf('<g fill="none"'));assert(!/fill="#/.test(field),'plotter strokes only');assert((field.match(/<path/g)||[]).length<=6,'plotter merges strokes');}
for(const f of FAMILIES)for(const stage of [1,2,3,4])for(const layout of OPTIONS.layout)assert(!/NaN|undefined|Infinity/.test(render({family:f.id,stage,layout}).svg),`${f.id} ${stage} ${layout}`);
for(const f of FAMILIES)assert(!/NaN|undefined|Infinity/.test(specimen({family:f.id})),`${f.id} specimen`);

// Input handling.
assert.deepEqual(normalizeProfile('0 .5, 1'),[0,.5,1]);assert.deepEqual(normalizeProfile([2,-1]),[1,0]);for(const bad of ['','1','a b','1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17'])assert.throws(()=>normalizeProfile(bad),bad);
assert.deepEqual(resolve({profile:'x'}).profile,FAMILIES[0].set.profile);assert.equal(resolve({params:{lines:9999}}).params.lines,360);assert.equal(resolve({params:{lines:40.6}}).params.lines,41);assert.equal(resolve({params:{amplitude:NaN}}).params.amplitude,FAMILIES[0].set.params.amplitude);assert.equal(resolve({params:{seed:'12'}}).params.seed,12);assert.equal(resolve({params:{seed:true}}).params.seed,FAMILIES[0].set.params.seed);
assert.deepEqual(resolve({colors:['red']}).colors,PALETTES[0].colors);assert.deepEqual(resolve({palette:'neon'}).colors,PALETTES.find(p=>p.id==='neon').colors);assert.equal(resolve({direction:'diagonal',family:'kizashi'}).direction,'radial');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');assert.equal(resolve({family:'nope'}).family,FAMILIES[0].id);
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const c0=process.cpuUsage();for(let i=0;i<10;i++)render({family:FAMILIES[i%FAMILIES.length].id,params:{seed:i+1}});const c1=process.cpuUsage(c0),renderCpuMs=+((c1.user+c1.system)/10000).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteStyles:FAMILIES.length,visibleControlChecks:controlChecks,visibleOptionValues:optionChecks,inertControls:`${inert} controls leave styles they do not apply to unchanged`,distinctPassesPerStyle:4,seeds:`${seeds.length} seeds distinct`,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',
 ordering:`${orderStates} states (11 styles; 4 graph directions × 5 base curves at full amplitude, drift, wobble, jitter, 4 steep faults and 4 ranges; facing and reflected ranges; contour levels with faults): ${pairChecks} neighbour evaluations, smallest gap ${minGap.toFixed(3)} px, no contour crossings, every line advances along its axis`,fold:`${crossings} crossing points in fold order at the same settings`,faults:'lines step by exactly the fault shift',inlays:'solid and void discs show accent and ground at their centres in four styles',reflection:'mirror image about the horizon',diptych:'book-matched halves',margins:'no field ink in title band, frame margin, split gutter or diptych gutter',
 files:`largest stage SVG ${(largest/1024).toFixed(0)} KB; fewer than 180 path elements; single-pen style strokes only`,invalidInputs:'profile parsing, parameter, option, colour, palette, stage, title and family bounds',png:[Math.round(W*3000/H),3000],averageRenderCpuMs:renderCpuMs},
 limitations:'Checks verify construction, ordering and drawing, not similarity to Awazu’s or Nagai’s own drawings. Poster type uses system fonts, so its glyphs vary between machines. Contour ordering is checked for segment intersections between neighbouring levels after simplification; touching at saddle points is possible in principle.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls, ${optionChecks} option values, ${inert} inert controls, 4 stages, seeds, replay, ordering in ${orderStates} states (${pairChecks} checks, min gap ${minGap.toFixed(3)} px), fold crossings ${crossings}, faults, inlays, reflection, diptych, margins, files ≤ ${(largest/1024).toFixed(0)} KB, inputs, ${Math.round(W*3000/H)} × 3000 export. Render ${renderCpuMs} ms CPU.`);
