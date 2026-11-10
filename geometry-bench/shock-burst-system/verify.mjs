import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import ClipperLib from 'clipper-lib';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,GATES,OUTPUT_KEYS,FORMATS,LIMITS,render,resolve,normalizeText,separations,seeds,geometry,applies,inside,distance,contrast} from './engine.mjs';
import {FONTS} from './fonts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/shock-burst-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect regularly (run with --expose-gc).
// The posters carry no live text, so resvg skips loading system fonts (a few hundred milliseconds per call).
let rendered=0;const raster=(s,fit={mode:'height',value:220})=>{if(++rendered%25===0)globalThis.gc?.();return new Resvg(s,{fitTo:fit,font:{loadSystemFonts:false}}).render();};
const pixels=s=>hash(raster(render(s).svg).asPng());
const common=['#f2efe8','#15121c','#d0263a','#2a6be0'];
const edges=ring=>{const e=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];e.push(a[0],a[1],b[0],b[1]);}return Float64Array.from(e);};
const edgesOf=rings=>Float64Array.from(rings.flatMap(r=>[...edges(r)]));
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,cv=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))/m;};
const timing={},t0=performance.now();let lap=t0;const section=name=>{const now=performance.now();timing[name]=+((now-lap)/1000).toFixed(1);lap=now;console.error(`${name}: ${timing[name]} s`);};
const isOutput=k=>k in OUTPUT_KEYS;

// Every style distinct under one palette, and every style's own settings within its controls' ranges (so saved rules replay).
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length);
for(const f of FAMILIES)for(const c of CONTROLS)assert(f.set.params[c.key]>=c.min&&f.set.params[c.key]<=c.max,`${f.id} ${c.key} ${f.set.params[c.key]} outside ${c.min}–${c.max}`);
section('styles');
// Each control is tried where it applies, in styles covering whole bursts, every split, gradients, nesting and copy;
// circular controls are compared with their midpoint. Where a control does not apply it must change nothing.
const ON={rotate:{split:'none'},valley:{params:{inner:.5}},sprayAngle:{params:{spray:.6}},count:{split:'none'},spread:{split:'none',params:{count:3}},
 nestStep:{params:{nest:3}},nestTwist:{split:'none',params:{nest:3}},nestSeed:{params:{nest:3}},gap:{split:'quadrants'},echoWeight:{echo:'outline',fill:'solid',params:{nest:3}},gradAngle:{fill:'linear'},
 copySize:{copy:'inside',text:'AB/CD'},pad:{copy:'inside',text:'AB/CD'},tracking:{copy:'inside',text:'AB/CD'},leading:{copy:'inside',text:'AB/CD'},sheetSize:{sheet:'split',sheetText:'AB/CD'},margin:{sheet:'split',sheetText:'AB/CD'},
 infoSize:{infoPlace:'bottom',info:'AB CD/EF'},aspect:{split:'none'},outline:{fill:'solid'},glow:{fill:'solid'}};
const OFF={rotate:{split:'quadrants'},valley:{params:{inner:0}},sprayAngle:{params:{spray:0}},count:{split:'quadrants'},spread:{split:'none',params:{count:1}},nestStep:{params:{nest:1}},nestTwist:{split:'halves',params:{nest:3}},
 nestSeed:{params:{nest:1}},gap:{split:'none'},echoWeight:{echo:'alternate',params:{nest:3}},gradAngle:{fill:'radial'},copySize:{copy:'none'},pad:{copy:'across',text:'AB'},tracking:{copy:'none',sheet:'none',infoPlace:'none'},leading:{copy:'none',sheet:'none',infoPlace:'none'},
 sheetSize:{sheet:'none'},margin:{sheet:'none'},infoSize:{infoPlace:'none'},aspect:{split:'shards',motif:'comb'}};
const CIRCULAR=['rotate','sprayAngle','gradAngle'],CONTROL_STYLES=['twin','quadrant','shard','bubble','comic','flare'];
const withCtx=(id,ctx,key,v)=>({family:id,colors:common,...ctx,params:{...ctx?.params,[key]:v}});
let controlChecks=0,inertChecks=0;
for(const id of CONTROL_STYLES)for(const c of CONTROLS.filter(c=>!isOutput(c.key))){const ctx=ON[c.key]??{},s=v=>withCtx(id,ctx,c.key,v),hi=CIRCULAR.includes(c.key)?(c.min+c.max)/2:c.max;
 assert(applies(c,resolve(s(c.min))),`${id} ${c.key}: context does not enable the control`);assert.notEqual(pixels(s(c.min)),pixels(s(hi)),`${id} ${c.key} has no visible effect`);controlChecks++;
 const off=OFF[c.key];if(off){const t=v=>withCtx(id,off,c.key,v);assert(!applies(c,resolve(t(c.min))),`${id} ${c.key}: off context still enables it`);assert.equal(pixels(t(c.min)),pixels(t(hi)),`${id} ${c.key} changes the poster where it is dimmed`);inertChecks++;}}
section('controls');
// Every option value is visible where it applies, and changes nothing where it is dimmed.
const OPT={split:{params:{outline:2}},motif:{split:'shards'},parts:{split:'quadrants'},symmetry:{split:'none'},layout:{split:'none',params:{count:3}},merge:{split:'none',params:{count:3,spread:.4}},fill:{params:{outline:3}},echo:{fill:'solid',params:{nest:3}},
 copy:{text:'AB'},fit:{copy:'inside',text:'AB/CDEFG'},copyInk:{copy:'inside',colors:common},sheet:{sheetText:'AB/CD/EF'},sheetLayer:{sheet:'split',sheetText:'AB/CD/EF',params:{size:1.6}},sheetFit:{sheet:'split',sheetText:'AB/CDEFGH'},
 sheetInk:{sheet:'split',sheetText:'AB/CD',colors:common},crossing:{copy:'across',copyInk:'line',text:'AB',colors:common,params:{size:1.2}},infoPlace:{info:'AB CD/EF'},font:{copy:'inside',text:'AB'}};
const OPT_OFF={motif:{split:'none'},parts:{split:'none'},symmetry:{split:'quadrants'},layout:{split:'none',params:{count:1}},merge:{split:'none',params:{count:1}},echo:{params:{nest:1}},fit:{copy:'none'},copyInk:{copy:'none'},
 sheetLayer:{sheet:'none'},sheetFit:{sheet:'none'},sheetInk:{sheet:'none',infoPlace:'none'},crossing:{copy:'inside',sheet:'none'},font:{copy:'none',sheet:'none',infoPlace:'none'}};
let optionChecks=0;
// The crossing value equal to the copy ink looks like 'same ink' by design, so it is left out of the distinct set.
const OPT_SKIP={crossing:['line']};
for(const id of ['twin','comic','shard','neon'])for(const [k,all] of Object.entries(OPTIONS)){if(isOutput(k))continue;const ctx={family:id,...OPT[k]},values=all.filter(v=>!OPT_SKIP[k]?.includes(v));
 for(const v of values)assert(applies(k,resolve({...ctx,[k]:v})),`${id} ${k}=${v}: context does not enable the option`);
 assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,values.length,`${id} ${k}`);optionChecks+=values.length;
 if(OPT_OFF[k]){const t={family:id,...OPT[k],...OPT_OFF[k]};assert(!applies(k,resolve(t)),`${id} ${k}: off context still enables it`);assert.equal(new Set(values.map(v=>pixels({...t,[k]:v}))).size,1,`${id} ${k} changes the poster where it is dimmed`);inertChecks++;}}
assert.deepEqual(Object.keys(GATES).filter(k=>!OPT_OFF[k]),[]);
section('options');
// Output settings change their output and never the poster.
const OUTPUT_CTX={plotter:{family:'comic',plotEdges:'passes',params:{outline:7}},separations:{family:'twin'},riso:{family:'rave'}},outputOf=(o,s)=>o==='separations'?separations(s).map(x=>x.svg).join(''):render(s,{output:o}).svg;
const OUT_OPT={sepMode:{family:'vortex'}};let outputChecks=0;
for(const c of CONTROLS.filter(c=>isOutput(c.key))){const o=OUTPUT_KEYS[c.key],s=v=>({...OUTPUT_CTX[o],params:{...OUTPUT_CTX[o].params,[c.key]:v}});
 assert.notEqual(outputOf(o,s(c.min)),outputOf(o,s(c.max)),`${c.key} does not change the ${o} output`);assert.equal(pixels(s(c.min)),pixels(s(c.max)),`${c.key} changes the poster`);outputChecks++;}
for(const [k,values] of Object.entries(OPTIONS).filter(([k])=>isOutput(k))){const o=OUTPUT_KEYS[k],ctx=OUT_OPT[k]??OUTPUT_CTX[o];
 assert.equal(new Set(values.map(v=>hash(outputOf(o,{...ctx,[k]:v})))).size,values.length,`${k} values are not distinct in the ${o} output`);assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,1,`${k} changes the poster`);outputChecks+=values.length;}
section('outputs settings');

// Four passes, exact replay, no state leaking between renders, and every built example replays from its saved rule.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'BOOM/42',params:{seed:321,length:.7,curve:.2}},a=render(s);render({family:'vortex',text:'NOISE'});
 assert.equal(a.svg,render(s).svg,f.id);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg,f.id);}
const saved=['',...['texts','stages','formats','variations'].map(d=>d+'/')].flatMap(d=>fs.readdirSync(path.join(out,d)).filter(n=>n.endsWith('.json')).map(n=>d+n)).filter(n=>!/catalog|source/.test(n));
for(const n of saved)assert.equal(render(JSON.parse(fs.readFileSync(path.join(out,n)))).svg,fs.readFileSync(path.join(out,n.replace(/json$/,'svg')),'utf8'),n);
section('replay');

// Beyond a regular star: with every jitter at zero the spikes share one length at equal angles; with the styles' own jitter
// both the spike lengths and the spike spacing vary, and every seed gives a different burst.
// Spike length: a tip's distance from the centre less the mean of its two valleys'.
const tipStats=s=>{const g=geometry(s),sh=g.shapes.find(x=>x.layer===0&&x.level===0),[cx,cy]=sh.centre,d=([x,y])=>Math.hypot(x-cx,y-cy),v=sh.valleys.map(d),r=sh.tips.map((t,j)=>d(t)-(v[j]+v[(j+1)%v.length])/2),a=sh.tips.map(([x,y])=>Math.atan2(y-cy,x-cx)).sort((p,q)=>p-q),gaps=a.map((v,i)=>((a[(i+1)%a.length]-v)+2*Math.PI)%(2*Math.PI));return {r:cv(r),gap:cv(gaps),lengths:r};};
const zero={length:0,width:0,lean:0,valley:0,spray:0,jag:0,aspect:1,tip:0,outlier:0,bend:0,fork:0,teeth:0};
for(const id of ['twin','comic','stamp','neon']){const z=tipStats({family:id,params:zero});assert(z.r<1e-9&&z.gap<1e-9,`${id} regular star ${JSON.stringify(z)}`);}
const irregular={};for(const f of FAMILIES.filter(f=>f.set.split==='none'&&f.set.symmetry==='none'&&f.set.merge==='none'&&f.set.params.length>=.3&&f.set.params.width>=.3)){const t=tipStats({family:f.id});irregular[f.id]=[+t.r.toFixed(3),+t.gap.toFixed(3)];assert(t.r>.06&&t.gap>.06,`${f.id} not irregular ${JSON.stringify(t)}`);}
for(const id of ['twin','splash','shard','quadrant']){const h=[...Array(8).keys()].map(i=>pixels({family:id,params:{seed:100+i}}));assert.equal(new Set(h).size,8,`${id} seeds`);}
assert.equal(seeds({family:'comic'}),seeds({family:'comic'}));assert.equal((seeds({family:'comic'}).match(/data-seed/g)||[]).length,8);
// Spike character: outliers make the longest spike more than twice the median; teeth and forks add outline points.
const ratio=s=>{const l=tipStats(s).lengths.sort((a,b)=>a-b);return l.at(-1)/l[l.length>>1];},points=s=>geometry(s).shapes[0].ring.length;
const character={outlier:[+ratio({family:'comic',params:{outlier:0}}).toFixed(2),+ratio({family:'comic',params:{outlier:1}}).toFixed(2)],teethPoints:[points({family:'comic'}),points({family:'comic',params:{teeth:1}})],forkPoints:[points({family:'comic'}),points({family:'comic',params:{fork:1}})]};
assert(character.outlier[1]>2&&character.outlier[0]<1.6,`outliers ${character.outlier}`);assert(character.teethPoints[1]>character.teethPoints[0]*1.3,'teeth');assert(character.forkPoints[1]>character.forkPoints[0]*1.3,'forks');
section('irregularity');

// Symmetry: mirrored halves and quadrants map onto themselves by reflection (with aspect, curvature and swirl), pinwheel
// quadrants by a quarter turn, and n-way mirrored bursts (with teeth, forks and bend) by a turn of 1/n and a reflection.
let mirrorPoints=0;const turnBy=(cx,cy,t)=>([x,y])=>[cx+(x-cx)*Math.cos(t)-(y-cy)*Math.sin(t),cy+(x-cx)*Math.sin(t)+(y-cy)*Math.cos(t)];
const SYM=[[{family:'quadrant',parts:'same',params:{aspect:1.4,swirl:.4,curve:.2}},'quad'],[{family:'glitch',parts:'same',params:{gap:0,swirl:.3}},'half'],[{family:'quadrant',split:'halves',parts:'same',params:{seed:77,curve:-.3}},'half'],[{family:'pinwheel',parts:'same',params:{cx:.5,cy:.5}},'turn'],
 ...[3,4,6,8].map(n=>[{family:'neon',symmetry:'m'+n,params:{spikes:24,teeth:.5,fork:.4,bend:.4,nest:1}},n])];
for(const [s,kind] of SYM){const g=geometry(s),sh=g.shapes.find(x=>x.level===0&&x.kind==='burst'),[cx,cy]=sh.centre,E=edges(sh.ring);
 const maps=kind==='turn'?[turnBy(cx,cy,Math.PI/2)]:kind==='quad'?[([x,y])=>[2*cx-x,y],([x,y])=>[x,2*cy-y]]:kind==='half'?[([x,y])=>[2*cx-x,y]]:[turnBy(cx,cy,2*Math.PI/kind),([x,y])=>[x,2*cy-y]];
 for(const f of maps)for(const p of sh.ring){const [x,y]=f(p);assert(distance(E,x,y)<.5,`${s.family} ${s.split??s.symmetry??''} symmetry off by ${distance(E,x,y).toFixed(2)}`);mirrorPoints++;}}
// Merged bursts: one outline per level whose area matches an independent union (nonzero) or even-odd union of the separate bursts.
const CL=ClipperLib,S=100,area=rings=>Math.abs(rings.reduce((a,r)=>a+CL.Clipper.Area(r.map(([x,y])=>({X:Math.round(x*S),Y:Math.round(y*S)}))),0))/S/S;
const merge=(rings,eo)=>{const c=new CL.Clipper(),o=new CL.Paths(),ft=eo?CL.PolyFillType.pftEvenOdd:CL.PolyFillType.pftNonZero;c.AddPaths(rings.map(r=>r.map(([x,y])=>({X:Math.round(x*S),Y:Math.round(y*S)}))),CL.PolyType.ptSubject,true);c.Execute(CL.ClipType.ctUnion,o,ft,ft);return o.map(p=>p.map(q=>[q.X/S,q.Y/S]));};
const merges={};for(const [id,mode] of [['fusion','union'],['phase','interference'],['rave','union'],['cluster','interference']]){const s={family:id,merge:mode},g=geometry(s),sep=geometry({...s,merge:'none'}),levels=new Set(sep.shapes.map(x=>x.level)).size;
 assert.equal(g.shapes.length,levels,`${id}: one merged shape per level`);assert(g.shapes.every(x=>x.members===resolve(s).params.count),`${id} members`);
 const want=area(merge(sep.shapes.filter(x=>x.level===0).map(x=>x.ring),mode==='interference')),got=area(g.shapes.find(x=>x.level===0).rings),sum=sep.shapes.filter(x=>x.level===0).reduce((a,x)=>a+area([x.ring]),0);
 assert(Math.abs(got-want)/want<.005,`${id} ${mode} area ${got} vs ${want}`);assert(mode==='union'?got<sum*.999:got<sum,`${id} ${mode} area not below the sum`);merges[id]={mode,area:+got.toFixed(0),separateSum:+sum.toFixed(0)};}
section('symmetry and merge');

// Copy: inside the burst and round a ring, every glyph outline point lies inside the burst outline and on the sheet and clears
// the outline by the clearance (less 0.5 px), across styles, copy, seeds, fits and formats. Copy across the sheet changes ink
// exactly where it crosses the bursts.
let copyCases=0,copyPoints=0,minClear=Infinity;
const contain=(g,label)=>{const pad=g.state.params.pad,F=g.field;assert(g.copy.length>0,`${label}: no copy fitted`);
 for(const rings of g.copy)for(const r of rings)for(const [x,y] of r){assert(inside(g.containerEdges,x,y)&&x>=F.x&&y>=F.y&&x<=F.x+F.w&&y<=F.y+F.h,`${label}: glyph outside the burst or the sheet`);const d=distance(g.containerEdges,x,y);minClear=Math.min(minClear,d-pad);assert(d>=pad-.5,`${label}: clearance ${d.toFixed(1)} < ${pad}`);copyPoints++;}copyCases++;};
for(const f of FAMILIES.filter(f=>f.set.copy==='inside'))for(const text of ['POW!','SAY IT/LOUDER','AB/CD/EF/GH'])for(const seed of [f.set.params.seed,500])for(const fit of ['fit','stretch'])for(const format of ['a','wide'])contain(geometry({family:f.id,text,fit,format,params:{seed}}),`${f.id} ${text} ${seed} ${fit} ${format}`);
for(const id of ['kaleido','chant','neon','comic','stamp'])for(const text of ['BASS/DROP','LOUDER','2026'])for(const seed of [7,500])contain(geometry({family:id,copy:'ring',text,params:{seed}}),`${id} ring ${text} ${seed}`);
let crossPoints=0;for(const id of ['cross','needle','fusion','quadrant']){const s=id==='quadrant'?{family:id,copy:'across',text:'GUIDE',crossing:'paper'}:{family:id},g=geometry(s),A=edgesOf(g.area);assert(g.items.some(i=>i.cross),`${id}: nothing crosses`);
 for(const it of g.items.filter(i=>i.crossable))for(const r of it.rings)for(const [x,y] of r){const on=distance(A,x,y)<.05;assert(on||inside(A,x,y)===!!it.cross,`${id}: crossing ink off the burst at ${x.toFixed(1)},${y.toFixed(1)}`);crossPoints++;}}
section('copy');

// Readable at 390 px wide: the largest type is at least 22 px tall (cap height) and none under 11 px, info lines included; at
// least 80% of the visible type pixels contrast 3:1 or more with what lies under them (the same poster rendered without type).
const phone={};
for(const f of FAMILIES)for(const format of ['a','story']){const s={family:f.id,format},g=geometry(s),k=390/FORMATS[format].w,caps=[g.copyCap,g.sheetCap,g.infoCap].filter(Boolean).map(v=>v*k);
 assert(Math.max(...caps)>=22&&Math.min(...caps)>=11,`${f.id} ${format} type at 390 px: ${caps.map(v=>v.toFixed(1))}`);
 const A=raster(render(s).svg,{mode:'width',value:390}),B=raster(render({...s,copy:'none',sheet:'none',infoPlace:'none'}).svg,{mode:'width',value:390}),a=A.pixels,b=B.pixels;let n=0,good=0;
 const hex=(p,i)=>'#'+[p[i],p[i+1],p[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');
 for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])<90)continue;n++;if(contrast(hex(a,i),hex(b,i))>=3)good++;}
 assert(n>400&&good/n>=.8,`${f.id} ${format}: ${(100*good/n).toFixed(0)}% of ${n} type pixels at 3:1`);if(format==='a')phone[f.id]={capPx:+Math.max(...caps).toFixed(1),smallestPx:+Math.min(...caps).toFixed(1),contrast3to1:+(good/n).toFixed(3)};}
section('phone');

// Plotter lines never show through a shape that covers them: sampled every 2 px along every line, no point lies more than
// 1.5 px inside a later opaque shape of another ink (exact winding test). Files are strokes only.
let plotSamples=0;
for(const s of [{family:'comic'},{family:'comic',plotEdges:'passes'},{family:'quadrant'},{family:'shard'},{family:'twin'},{family:'fusion'},{family:'cross'},{family:'bubble'}]){const id=s.family+(s.plotEdges?'-passes':''),g=geometry(s),p=render(s,{output:'plotter'}).svg;
 assert(!/<path[^>]*fill="(?!none)[^"]*"[^>]*data-ink/.test(p)&&/stroke-width/.test(p),`${id} plotter has fills`);
 const items=g.items.map(it=>({...it,all:it.rings?.map(edges),inks:new Set([it.fill?.ink,it.fill?.a,it.fill?.b,it.stroke?.ink].filter(Boolean)),box:it.rings?.flat().reduce((b,[x,y])=>[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)],[1e9,1e9,-1e9,-1e9])})).filter(it=>it.fill&&it.all);
 // Top down, the first shape that carries the line's ink (within 1.5 px) or covers the point by more than 1.5 px decides.
 for(const it of items)it.E=it.all.length===1?it.all[0]:Float64Array.from(it.all.flatMap(e=>[...e]));
 const covered=(x,y,ink)=>{for(let i=items.length-1;i>=0;i--){const it=items[i],[x0,y0,x1,y1]=it.box;if(x<x0-2||y<y0-2||x>x1+2||y>y1+2)continue;if(it.clip&&(x<it.clip.x||y<it.clip.y||x>it.clip.x+it.clip.w||y>it.clip.y+it.clip.h))continue;
  const ins=inside(it.E,x,y),d=distance(it.E,x,y);if(it.inks.has(ink)&&(ins||d<=1.5))return null;if(ins&&d>1.5)return it;}return null;};
 for(const m of p.matchAll(/<path d="([^"]+)" fill="none" stroke="[^"]*"[^>]*data-ink="([^"]+)"/g)){const ink=m[2];for(const run of m[1].split('M').filter(Boolean)){const pts=[...run.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(v=>[+v[1],+v[2]]);
  for(let i=0;i<pts.length-1;i++){const [a,b]=[pts[i],pts[i+1]],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<=L;t+=3){const x=a[0]+(b[0]-a[0])*t/(L||1),y=a[1]+(b[1]-a[1])*t/(L||1),c=covered(x,y,ink);
   assert(!c,`${id}: ${ink} line shows through a later ${[...(c?.inks??[])]} shape at ${x.toFixed(1)},${y.toFixed(1)}`);plotSamples++;}}}}}
section('plotter');

// Separations are pure black on white, one sheet per ink (dark paper is an ink of its own), in spot and tint modes and with
// line or dot screens; in Twin shock the fill (blue) sheet is darker over the left burst and the accent (orange) sheet over the
// right one. Tints fold stepped colours into their two inks. The riso preview prints one layer per ink.
let sepSheets=0;const pure=(svg,label)=>{assert(!/(fill|stroke|stop-color)="#(?!000000|ffffff)[0-9a-f]{6}"/.test(svg)&&!/url\(#[gwr]/.test(svg),`${label} has colour`);assert(/fill="#000000"|stroke="#000000"/.test(svg),`${label} is empty`);sepSheets++;};
for(const f of FAMILIES){const seps=separations({family:f.id}),r=render({family:f.id});assert.equal(seps.length,r.inks.length,f.id);for(const s of seps)pure(s.svg,`${f.id} ${s.ink}`);
 const riso=render({family:f.id},{output:'riso'}).svg;assert.equal((riso.match(/mix-blend-mode:multiply/g)||[]).length,r.inks.length,`${f.id} riso layers`);assert(!/NaN|undefined/.test(riso),`${f.id} riso`);}
for(const s of [{family:'vortex',sepMode:'tints'},{family:'kaleido',sepMode:'tints',screenShape:'dots'},{family:'twin',screenShape:'dots'}])for(const x of separations(s))pure(x.svg,`${s.family} ${s.sepMode??''} ${s.screenShape??''} ${x.ink}`);
const tints={spot:separations({family:'vortex'}).map(s=>s.ink),tints:separations({family:'vortex',sepMode:'tints'}).map(s=>s.ink)};assert.deepEqual(tints.tints,['paper','fill','accent','line']);assert(tints.spot.length>tints.tints.length+2,'tints');
{const seps=separations({family:'twin'}),dark=(ink,x0,x1)=>{const img=raster(seps.find(s=>s.ink===ink).svg,{mode:'width',value:364}),p=img.pixels,w=img.width;let s=0,c=0;for(let y=Math.floor(img.height*.4);y<img.height*.6;y++)for(let x=Math.floor(w*x0);x<w*x1;x++){s+=255-p[(y*w+x)*4];c++;}return s/c;};
 assert(dark('fill',.1,.4)>dark('fill',.6,.9)*1.3&&dark('accent',.6,.9)>dark('accent',.1,.4)*1.3,'twin gradient screens do not follow the gradient');}
section('separations and riso');

// Every glyph of every face fits inside a burst; every style in every format, and with every split, part and symmetry.
let glyphs=0;for(const [id,font] of Object.entries(FONTS)){const chars=Object.keys(font.glyphs).filter(c=>c!==' '&&c!=='/');for(let i=0;i<chars.length;i+=8){const text=chars.slice(i,i+8).join('');
 const g=geometry({family:'comic',font:id,text});assert(g.copy.length>0,`${id} ${text}`);assert(!/NaN|undefined|Infinity/.test(render({family:'comic',font:id,text}).svg),`${id} ${text}`);glyphs+=text.length;}}
for(const f of FAMILIES){for(const format of Object.keys(FORMATS))assert(!/NaN|undefined|Infinity/.test(render({family:f.id,format}).svg),`${f.id} ${format}`);
 for(const split of OPTIONS.split)for(const motif of OPTIONS.motif)assert(!/NaN|undefined|Infinity/.test(render({family:f.id,split,motif}).svg),`${f.id} ${split} ${motif}`);
 for(const symmetry of OPTIONS.symmetry)assert(!/NaN|undefined|Infinity/.test(render({family:f.id,split:'none',symmetry}).svg),`${f.id} ${symmetry}`);}
section('coverage');

// Input handling.
assert.equal(normalizeText('pow / wow','archivo'),'pow/wow');assert.equal(normalizeText('ab\ncd','archivo'),'ab/cd');assert.throws(()=>normalizeText('ＡＢ','archivo'));assert.equal(normalizeText('','archivo','x'),'x');assert.equal(normalizeText('it’s','archivo'),"it's");
for(const bad of ['','€uro','A/B/C/D/E','A//B','ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFG','<b>'])assert.throws(()=>normalizeText(bad,'archivo',undefined,LIMITS.text),bad);
assert.equal(normalizeText('','archivo',undefined,LIMITS.sheetText,true),'');assert.equal(resolve({family:'comic',sheetText:''}).sheetText,'');assert.equal(resolve({family:'comic',info:'A—B'}).info,'');assert.equal(resolve({family:'corner'}).info,normalizeText(FAMILIES.find(f=>f.id==='corner').info,'archivo',undefined,LIMITS.info));
assert.equal(resolve({text:'€'}).text,FAMILIES[0].text);assert.equal(resolve({params:{spikes:999}}).params.spikes,72);assert.equal(resolve({params:{spikes:12.6}}).params.spikes,13);assert.equal(resolve({params:{curve:NaN}}).params.curve,FAMILIES[0].set.params.curve);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({split:'bogus',family:'quadrant'}).split,'quadrants');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({params:{seed:true}}).params.seed,FAMILIES[0].set.params.seed);
// Rules saved before spike character, merging, symmetry, copy modes and output settings existed open with those modules off.
const old={engine:'shock-burst-v1',family:'comic',text:'OLD',params:{spikes:12,seed:3}},o=resolve(old);assert(o.params.outlier===0&&o.params.teeth===0&&o.symmetry==='none'&&o.merge==='none'&&o.copy==='inside'&&o.plotEdges==='centre');assert(!/NaN/.test(render(old).svg));
const full=raster(render().svg,{mode:'height',value:3000}).asPng();assert.equal(full.readUInt32BE(16),Math.round(728*3000/1030));assert.equal(full.readUInt32BE(20),3000);
const renderMs={};for(const f of FAMILIES){render({family:f.id});const t=performance.now();for(let i=0;i<2;i++)render({family:f.id,params:{seed:f.set.params.seed+i+1}});renderMs[f.id]=+((performance.now()-t)/2).toFixed(0);}
section('inputs and timing');
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteStyles:FAMILIES.length,
 visibleControlChecks:`${controlChecks} (every poster control in ${CONTROL_STYLES.length} styles: whole bursts, mirrored quadrants, free shards with combs, copy, nesting, gradients)`,inertWhenDimmed:`${inertChecks} controls and options leave the poster pixel-identical where the editor dims them`,visibleOptionValues:optionChecks,
 outputSettings:`${outputChecks} output controls and values change their plotter, separation or riso output and leave the poster pixel-identical`,
 distinctPassesPerStyle:4,replay:`exact SVG, A/B/A and saved JSON for every style; ${saved.length} built examples re-render byte for byte from their saved rules; rules from before the new modules open with them off`,
 irregularity:{regularStar:'with every jitter and spike character at zero, spike lengths and spike spacing are exactly uniform (coefficient of variation < 1e-9)',defaults:irregular,note:'[spike-length CV, spike-spacing CV] for whole-burst styles; both above 0.06',character},seeds:'8 seeds give 8 different posters in four styles; seed sheets replay',
 symmetry:`${mirrorPoints} outline points of mirrored halves, mirrored quadrants, pinwheel quadrants and 3-, 4-, 6- and 8-way mirrored bursts (with aspect, curvature, swirl, teeth, forks and bend) map onto the outline within 0.5 px`,
 merge:{rule:'one outline per level; its area matches an independent nonzero (union) or even-odd (interference) union of the separate bursts within 0.5%',styles:merges},
 copyContainment:`${copyCases} cases inside the burst and round a ring (styles × copies × seeds × fits × formats): ${copyPoints} glyph outline points inside the burst and the sheet, clearing it by the clearance less ${Math.max(0,-minClear).toFixed(2)} px at worst (limit 0.5 px)`,
 crossing:`${crossPoints} outline points of type crossing bursts: the crossing ink lies inside the bursts' union and the base ink outside it (exact to 0.05 px)`,
 phone390:{rule:'at 390 px wide, A and story formats: largest type ≥ 22 px cap height, all type including info lines ≥ 11 px, ≥ 80% of visible type pixels at 3:1 contrast or more',a:phone},
 plotterOcclusion:`${plotSamples} samples along every plotter line in eight cases (outline passes, merged bursts and crossing type included): none lies more than 1.5 px inside a later opaque shape of another ink (exact winding test); files are strokes only`,
 outputs:`${sepSheets} separation sheets, black on white, one per ink, for ${FAMILIES.length} styles plus tint and dot-screen modes; dark paper prints as its own ink; Twin shock's gradient screens are darker on their own side; Vortex needs ${tints.spot.length} sheets in spot mode and ${tints.tints.length} with tints; every riso preview has one layer per ink`,
 glyphs:`${glyphs} glyphs across ${Object.keys(FONTS).length} faces fitted inside a burst`,formats:`${Object.keys(FORMATS).length} formats × ${FAMILIES.length} styles, and every split × part and every symmetry in every style`,
 invalidInputs:'empty, unsupported characters, markup, five rows, empty rows, 33 characters; parameter, colour, option and stage bounds; old rules',png:[Math.round(728*3000/1030),3000],renderMs,sectionSeconds:timing},
 limitations:'Checks verify construction, containment, symmetry, merging, occlusion and contrast, not similarity to the source posters. Copy inside is kept inside the outline of the main burst; other layers and nested levels may cross it. Plotter cover is decided on a 1 px raster, so lines stop within about a pixel of what hides them. The riso preview is a simulation: misregistration is a seeded shift and grain is noise.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls, ${inertChecks} dimmed-and-inert, ${optionChecks} option values, ${outputChecks} output settings, 4 stages, replay (${saved.length} saved), irregularity, seeds, ${mirrorPoints} symmetric points, merges, ${copyCases} copy cases (worst clearance ${minClear.toFixed(2)} px), ${crossPoints} crossing points, phone 390, ${plotSamples} plotter samples, ${sepSheets} separations, riso, ${glyphs} glyphs, formats, inputs. ${((performance.now()-t0)/1000).toFixed(0)} s`);
