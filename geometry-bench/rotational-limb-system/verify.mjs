import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,U,FAMILIES,CONTROLS,OPTIONS,OPTION_WHEN,LIMBS,applies,render,resolve,specimen,knotScene,limbScene,limbCurve,cleanPoints,slots,aspectOf,knotPieces} from './engine.mjs';
import {catmullRom,bend,turning,resample,rot,findCrossings,assignCrossings,pointAt,tangentAt} from './geometry.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/rotational-limb-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect
// regularly (run with --expose-gc). Pixel buffers are read once per raster:
// `img.pixels` copies the whole buffer on every access.
let rendered=0;const collect=()=>{if(++rendered%25===0)globalThis.gc?.();};
const raster=(s,h=300)=>{collect();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const fam=id=>FAMILIES.find(f=>f.id===id);
const common=['#efe9dc','#1d1b19','#5a5650','#e2512b','#2d4fa3','#3f8a5a'];

// Every preset sits inside the control bounds, so a saved rule replays it exactly.
for(const f of FAMILIES)for(const c of CONTROLS){const v=f.set.params[c.key];assert(v>=c.min&&v<=c.max&&(c.step<1||Number.isInteger(v)),`${f.id} ${c.key} = ${v} outside the control`);}
// Twelve presets under one palette.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'presets distinct under one palette');

// Every control changes the poster where it applies and nothing where it does not.
// Turns are compared over 37°, which no preset's rotational symmetry maps onto itself.
const CONTEXT={hub:[{family:'legs',hub:'disc'},{family:'flower'}],focus:[{family:'legs'},{family:'spiral'}],p:[{family:'neon'},{family:'weave'}],q:[{family:'neon'},{family:'weave'}],depth:[{family:'trefoil'},{family:'neon'}],phase:[{family:'weave'}],complexity:[{family:'tangle'},{family:'handshake'}],smooth:[{family:'tangle'},{family:'handshake'}],relax:[{family:'tangle'},{family:'handshake'}],
 seed:[{family:'tangle'},{family:'handshake'},{family:'trefoil',crossing:'seeded',knot:'random'}],gap:[{family:'trefoil'},{family:'tangle'}],endSize:[{family:'legs'},{family:'handshake'}],sleeve:[{family:'flower'},{family:'handshake'}],weight:[{family:'legs'},{family:'trefoil'}],outline:[{family:'legs'},{family:'trefoil'}],density:[{family:'field'},{family:'legs',layout:'field'}]};
const INERT={hub:{family:'legs'},focus:{family:'legs',params:{curl:0}},p:{family:'trefoil'},q:{family:'trefoil'},depth:{family:'weave'},phase:{family:'neon'},complexity:{family:'trefoil'},smooth:{family:'neon'},relax:{family:'weave'},seed:{family:'trefoil'},gap:{family:'legs'},endSize:{family:'trefoil'},sleeve:{family:'tangle'},density:{family:'legs'}};
const circular=new Set(['rotate','twist']);let controlChecks=0,inertChecks=0;
for(const c of CONTROLS){const hi=circular.has(c.key)?c.min+37:c.max,ctxs=CONTEXT[c.key]??(c.group==='limb'?[{family:'legs'},{family:'kick'}]:[{family:'legs'},{family:'trefoil'},{family:'handshake'}]);
 for(const ctx of ctxs){const s=v=>({...ctx,params:{...ctx.params,[c.key]:v}});assert(applies(c.when,resolve(s(c.min))),`${c.key} applies in ${ctx.family}`);assert.notEqual(pixels(s(c.min)),pixels(s(hi)),`${c.key} in ${ctx.family}`);controlChecks++;}
 const off=INERT[c.key]??(c.group==='limb'?{family:'trefoil'}:null);if(off){const s=v=>({...off,params:{...off.params,[c.key]:v}});assert(!applies(c.when,resolve(s(c.min))),`${c.key} should not apply`);assert.equal(pixels(s(c.min)),pixels(s(hi)),`${c.key} should be inert in ${off.family}`);inertChecks++;}}
// Every option value is distinct where it applies, and inert where it does not.
const OPT={generator:{family:'legs'},limb:{family:'legs'},end:{family:'flower'},endAlt:{family:'legs',end:'foot'},ends:{family:'legs'},mirror:{family:'legs'},order:{family:'legs'},hub:{family:'legs'},knot:{family:'trefoil'},crossing:{family:'tangle'},colour:{family:'flower'},layout:{family:'legs'},format:{family:'trefoil'},finish:{family:'legs'},ground:{family:'neon'}};
let optionChecks=0;for(const [k,values] of Object.entries(OPTIONS)){const ctx=OPT[k],vals=k==='endAlt'?values.filter(v=>v!==ctx.end):values;assert.equal(new Set(vals.map(v=>pixels({...ctx,[k]:v}))).size,vals.length,k);optionChecks+=vals.length;
 if(k==='endAlt')assert.equal(pixels({...ctx,endAlt:'same'}),pixels({...ctx,endAlt:ctx.end}),'endAlt same = end');
 if(OPTION_WHEN[k]){const off={family:applies(OPTION_WHEN[k],resolve({family:'legs'}))?'trefoil':'legs'};assert.equal(new Set(values.map(v=>pixels({...off,[k]:v}))).size,1,`${k} inert in ${off.family}`);inertChecks++;}}
assert.equal(new Set(OPTIONS.colour.map(colour=>pixels({family:'neon',colour}))).size,OPTIONS.colour.length,'colour modes on knot arcs');optionChecks+=OPTIONS.colour.length;

// Four passes, exact replay, seeds, and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,params:{twist:13,curl:45,seed:77,complexity:5,scale:.9,rotate:20}},a=render(s);render({family:'tangle',params:{seed:3}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}
for(const id of ['tangle','handshake','field'])assert.notEqual(render({family:id,params:{seed:1}}).svg,render({family:id,params:{seed:2}}).svg,`${id} seeds differ`);
assert.equal(render({family:'legs',limb:'custom',points:[[0,0],[.4,.2],[.8,-.1],[1,.3]]}).svg,render(JSON.parse(JSON.stringify(render({family:'legs',limb:'custom',points:[[0,0],[.4,.2],[.8,-.1],[1,.3]]}).state))).svg,'dragged limb replays');

// ── Crossings ────────────────────────────────────────────────────────────
// Closed-form counts: the torus diagram (2 + cos qt)·e^{ipt} has q(p − 1)
// crossings, the Lissajous curve (cos(at + φ), cos bt) has 2ab − a − b.
const gcd=(a,b)=>b?gcd(b,a%b):a;let countChecks=0;
for(let p=1;p<=7;p++)for(let q=2;q<=9;q++){if(gcd(p,q)!==1)continue;const sc=knotScene(resolve({family:'neon',params:{p,q,depth:.55}}));assert.equal(sc.crossings.length,q*(p-1),`torus ${p}/${q}`);assert.equal(sc.assign.breaks,0,`torus ${p}/${q} alternates`);countChecks++;}
for(const [p,q] of [[2,4],[3,6],[4,6],[2,6]]){const g=gcd(p,q),sc=knotScene(resolve({family:'neon',params:{p,q}}));assert.equal(sc.strands.length,g,`torus link ${p}/${q} has ${g} components`);assert.equal(sc.assign.breaks,0,`torus link ${p}/${q} alternates`);countChecks++;}
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){if(gcd(a,b)!==1||a===b)continue;for(const phase of [.1,.3,.77]){const sc=knotScene(resolve({family:'weave',params:{p:a,q:b,phase,weight:.04}}));assert.equal(sc.crossings.length,2*a*b-a-b,`lissajous ${a}/${b} phase ${phase}`);assert.equal(sc.assign.breaks,0);countChecks++;}}
// An independent brute-force pass (every segment pair, closed intervals) finds the same crossings.
function brute(strands){const out=[];const segs=[];strands.forEach((st,k)=>{const m=st.pts.length;for(let i=0;i<(st.closed?m:m-1);i++)segs.push({k,i,a:st.pts[i],b:st.pts[(i+1)%m],m,closed:st.closed});});
 for(let x=0;x<segs.length;x++)for(let y=x+1;y<segs.length;y++){const A=segs[x],B=segs[y];if(A.k===B.k){const d=Math.abs(A.i-B.i);if(d<=1||A.closed&&d===A.m-1)continue;}
  const r=[A.b[0]-A.a[0],A.b[1]-A.a[1]],s=[B.b[0]-B.a[0],B.b[1]-B.a[1]],den=r[0]*s[1]-r[1]*s[0];if(!den)continue;const qx=B.a[0]-A.a[0],qy=B.a[1]-A.a[1],t=(qx*s[1]-qy*s[0])/den,u=(qx*r[1]-qy*r[0])/den;if(t>=0&&t<1&&u>=0&&u<1)out.push([A.a[0]+r[0]*t,A.a[1]+r[1]*t]);}return out;}
const curves=[];for(let seed=0;seed<40;seed++)curves.push(['random',{family:'tangle',params:{seed,complexity:3+seed%6,smooth:.8+(seed%5)*.3,relax:seed%3?30:0}}]);
for(let seed=0;seed<20;seed++)curves.push(['hands',{family:'handshake',params:{seed,complexity:4+seed%5}}]);
for(const f of ['trefoil','neon','weave'])curves.push([f,{family:f}]);
let bruteChecks=0,crossingsSeen=0,closedCurves=0,openAlternating=0,openTotal=0;
for(const [kind,input] of curves){const sc=knotScene(resolve(input)),b=brute(sc.strands);assert.equal(sc.crossings.length,b.length,`${kind} ${JSON.stringify(input.params)}: grid vs brute force`);
 for(const c of sc.crossings)assert(b.some(q=>Math.hypot(q[0]-c.p[0],q[1]-c.p[1])<1e-6),'crossing point matches brute force');bruteChecks++;crossingsSeen+=b.length;
 // Each crossing has exactly one over and one under occurrence.
 for(const c of sc.crossings)assert.deepEqual(c.occ.map(o=>o.role).sort(),['over','under']);
 // Along every strand, alternate occurrences alternate; closed curves always can (Gauss parity).
 const closed=sc.strands.every(s=>s.closed);if(closed){assert.equal(sc.assign.breaks,0,`${kind} closed curve alternates`);closedCurves++;for(const L of sc.assign.byStrand)for(let i=0;i<L.length;i++)assert.notEqual(L[i].role,L[(i+1)%L.length].role);}
 else{openTotal++;if(!sc.assign.breaks)openAlternating++;}}
assert.equal(render({family:'handshake'}).features.breaks,0,'the two-hands preset alternates everywhere');
// Laid: the later point along the strands is always on top; seeded: a fixed coin per seed.
{const sc=knotScene(resolve({family:'tangle',crossing:'laid'}));for(const c of sc.crossings){const [a,b]=c.occ,later=a.strand>b.strand||a.strand===b.strand&&a.s>b.s?a:b;assert.equal(later.role,'over');}
 const s1=knotScene(resolve({family:'tangle',crossing:'seeded'})),s2=knotScene(resolve({family:'tangle',crossing:'seeded'}));assert.deepEqual(s1.crossings.map(c=>c.over),s2.crossings.map(c=>c.over));}
// Torus T(2, q) is alternating: its own 3-D depth gives the same over/under as the alternating rule (or its mirror).
for(const q of [3,5,7]){const a=knotScene(resolve({family:'neon',params:{p:2,q}})),d=knotScene(resolve({family:'neon',crossing:'depth',params:{p:2,q}})),same=a.crossings.filter((c,i)=>c.over===d.crossings[i].over).length;assert(same===0||same===a.crossings.length,`T(2,${q}) depth is alternating`);}

// Pixel probes on rendered knots. With probe colours (ground white, tube red,
// outline blue) every isolated crossing must show: the over tube's outline on
// the over side of its crossing point (blue, not the under tube's red), the gap
// just beyond it inside the under tube (white), and the under tube again past the gap (red).
const PROBE=['#ffffff','#ff0000','#0000ff','#ff0000','#ff0000','#ff0000'],rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));let probes=0,probeScenes=0,skipped=0;
const probeCases=[{knot:'trefoil'},{knot:'figure8'},{knot:'torus',params:{p:3,q:5}},{knot:'torus',params:{p:2,q:5}},{knot:'lissajous',params:{p:3,q:4,weight:.06}},{knot:'lissajous',params:{p:3,q:2}},{knot:'lissajous',params:{p:5,q:4,weight:.045,outline:.01,gap:.02}},{knot:'torus',params:{p:3,q:7,weight:.07}},{knot:'torus',params:{p:4,q:5,weight:.06,outline:.012,gap:.022}},
 ...[1,2,3,4,5,6,7,8].map(seed=>({knot:'random',params:{seed,complexity:4}})),{knot:'random',crossing:'laid',params:{seed:2,complexity:4}},{knot:'random',crossing:'seeded',params:{seed:3,complexity:4}},{knot:'random',crossing:'depth',params:{seed:4,complexity:4}}];
for(const pc of probeCases){const state={family:'trefoil',generator:'knot',stage:3,colour:'single',colors:PROBE,...pc,params:{weight:.1,outline:.016,gap:.03,depth:.55,relax:30,smooth:1.4,...pc.params}},r=render(state),scale=2,img=new Resvg(r.svg,{fitTo:{mode:'width',value:r.width*scale}}).render(),data=img.pixels,W=img.width;collect();probeScenes++;
 const st=r.state,sc=knotScene(st,0,aspectOf(st,slots(st)[0])),{k,c,cx,cy}=r.features.slots[0],toPx=([x,y])=>[(cx+(x-c[0])*k)*scale,(cy+(y-c[1])*k)*scale],at=q=>{const [x,y]=toPx(q),i=(Math.round(y)*W+Math.round(x))*4;return [data[i],data[i+1],data[i+2]];},near=(a,b)=>a.every((v,j)=>Math.abs(v-b[j])<=40);
 const Wt=sc.W,o=sc.o,g=sc.gap,all=sc.strands.flatMap((s,si)=>s.pts.map((q,i)=>({q,si,i})));
 for(const cr of sc.crossings){if(cr.angle<55*Math.PI/180){skipped++;continue;}const ov=cr.occ[cr.over],un=cr.occ[1-cr.over],n=[-ov.dir[1],ov.dir[0]],beyond=(Wt/2+o+g)/Math.sin(cr.angle)+(Wt/2+o)/Math.tan(cr.angle)+Wt*.5,us=sc.strands[un.strand],uc=sc.cums[un.strand];
  // A probe counts only where no other part of the knot reaches it: points farther along the
  // strands than the probes themselves must keep a tube's width (plus the gap) away.
  // Both strands must run nearly straight through the probe span (a strand that curls back over its own gap is crowding, not an error).
  const bendOf=(q,span)=>{const S=sc.strands[q.strand],C=sc.cums[q.strand],t0=tangentAt(S.pts,C,S.closed,q.s,Wt*.2);return Math.max(...[-span,span].filter(d=>S.closed||q.s+d>=0&&q.s+d<=C.L).map(d=>{const t=tangentAt(S.pts,C,S.closed,q.s+d,Wt*.2);return Math.acos(Math.min(1,Math.abs(t[0]*t0[0]+t[1]*t0[1])));}),0);};
  if(bendOf(un,beyond+Wt*.5)>35*Math.PI/180||bendOf(ov,Wt*1.5)>35*Math.PI/180){skipped++;continue;}
  const arc=(e,q)=>{if(q.strand!==e.si)return Infinity;const st2=sc.strands[e.si],sp=sc.cums[e.si].L/(st2.closed?st2.pts.length:st2.pts.length-1),d=Math.abs(e.i*sp-q.s);return st2.closed?Math.min(d,sc.cums[e.si].L-d):d;},expected=e=>arc(e,ov)<=Wt*1.5||arc(e,un)<=beyond+Wt*.5;
  const clear=P=>!all.some(e=>!expected(e)&&Math.hypot(e.q[0]-P[0],e.q[1]-P[1])<Wt/2+o+g+Wt*.3),check=(P,want,what)=>{if(!clear(P)){skipped++;return;}assert(near(at(P),rgb(want)),`${JSON.stringify(pc)}: ${what} at crossing ${cr.id} shows ${at(P)}`);probes++;};
  for(const side of [-1,1]){const P=d=>[cr.p[0]+n[0]*d*side,cr.p[1]+n[1]*d*side];check(P(Wt/2+o*.5),PROBE[2],'over outline');check(P(Wt/2+o+g*.5),PROBE[0],'gap');}
  for(const side of [-1,1]){const at2=un.s+beyond*side;if(!us.closed&&(at2<0||at2>uc.L))continue;check(pointAt(us.pts,uc,us.closed,at2),PROBE[1],'under tube past the gap');}
  check(cr.p,PROBE[1],'over fill');}}
assert(probes>250,`enough crossing probes (${probes})`);
// Open strands (two hands) are too crowded near the centre for clean probes; their cut structure is
// checked instead: every under occurrence ends two under halves (one at a strand end) and lies in no over piece.
let cutChecks=0;for(const seed of [0,35,43,51,79]){const st=resolve({family:'handshake',params:{seed}}),sc=knotScene(st,0,aspectOf(st,slots(st)[0])),pieces=knotPieces(st,sc);
 for(const c of sc.crossings){const un=c.occ[1-c.over],L=sc.cums[un.strand].L,ends=pieces.filter(p=>p.strand===un.strand&&p.role==='under'&&(Math.abs(p.a-un.s)<1e-6||Math.abs(p.b-un.s)<1e-6));assert(ends.length===2||ends.length===1&&(un.s<sc.W||un.s>L-sc.W),`hands ${seed} crossing ${c.id}: under halves`);
  assert(!pieces.some(p=>p.strand===un.strand&&p.role==='over'&&un.s>p.a+1e-6&&un.s<p.b-1e-6),'under occurrence inside an over piece');const ov=c.occ[c.over];assert(pieces.some(p=>p.strand===ov.strand&&p.role==='over'&&p.over?.c===c.id),'over occurrence owns an over piece');cutChecks++;}}

// ── Limbs ────────────────────────────────────────────────────────────────
// N-fold rotation, alternate mirror, the spline through its points, exact curl and taper.
for(const f of FAMILIES.filter(f=>f.set.generator==='limbs')){const st=resolve({family:f.id}),sc=limbScene(st),N=st.params.arms;
 for(const a of sc.arms){const ref=a.mirror?sc.arms[1]:sc.arms[0],turn=2*Math.PI*(a.i-ref.i)/N;a.pts.forEach((q,j)=>{const r=rot(ref.pts[j],turn);assert(Math.hypot(q[0]-r[0],q[1]-r[1])<1e-6,`${f.id} arm ${a.i} is a turned copy`);});}
 if(st.mirror==='alternate'&&N>1){const m=resolve({...st,mirror:'off'}),a1=limbScene(m).arms[1];assert(limbScene(st).arms[1].pts.some((q,j)=>Math.hypot(q[0]-a1.pts[j][0],q[1]-a1.pts[j][1])>1),`${f.id} mirrored arm differs`);}}
for(const l of LIMBS){const P=l.points.map(([x,y])=>[x*U,y*U]),d=catmullRom(P,24,false);P.forEach((p,j)=>assert(Math.hypot(d[j*24][0]-p[0],d[j*24][1]-p[1])<1e-9,`${l.id} passes through point ${j}`));}
for(const curl of [-500,-90,0,45,360,700])for(const focus of [0,.5,1]){const st=resolve({family:'legs',limb:'s-curve',params:{curl,focus}}),g=limbCurve(st),flat=limbCurve(resolve({...st,params:{...st.params,curl:0}}));assert(Math.abs(turning(g.pts)-turning(flat.pts)-curl*Math.PI/180)<1e-9,`curl ${curl} focus ${focus} adds exactly that turning`);}
{const g=limbCurve(resolve({family:'legs',params:{taper:.6,swell:0}}));assert(Math.abs(g.hw[g.hw.length-1]/g.hw[0]-.4)<1e-9,'taper sets the tip width');}
assert(limbScene(resolve({family:'spiral'})).self&&!limbScene(resolve({family:'legs'})).self,'self-overlap detected on the spiral leg only');
assert(render({family:'legs',order:'cyclic'}).svg.includes('<mask')&&!render({family:'legs',order:'stack'}).svg.includes('<mask'),'cyclic order closes the circle with one silhouette mask');
// Editor handles: a drag mapped back through the handle's turn and scale moves the point exactly (no curl).
{const st=resolve({family:'legs',params:{curl:0,twist:33,rotate:-20}}),r=render(st);for(const h of r.features.handles){const dx=17,dy=-9,c=Math.cos(-h.angle),s=Math.sin(-h.angle),p=st.points[h.j],moved=st.points.map((q,i)=>i===h.j?[p[0]+(dx*c-dy*s)/h.k,p[1]+(dx*s+dy*c)/h.k]:q),r2=render({...st,limb:'custom',points:moved}),h2=r2.features.handles.find(x=>x.j===h.j);
  // The fit may rescale when the figure grows: compare in the original scale through the slot.
  const s0=r.features.slots[0],s1=r2.features.slots[0],back=([x,y],sl)=>[(x-sl.cx)/sl.k+sl.c[0],(y-sl.cy)/sl.k+sl.c[1]],a=back([h.x+dx,h.y+dy],s0),b=back([h2.x,h2.y],s1);assert(Math.hypot(a[0]-b[0],a[1]-b[1])<.5,`handle ${h.j} follows the drag`);}}

// Hero figures stay inside the poster margins.
for(const f of FAMILIES)if(f.set.layout==='hero'){const r=render({family:f.id}),[x0,y0,x1,y1]=r.features.box;assert(x0>=20&&y0>=60&&x1<=r.width-20&&y1<=r.height-40,`${f.id} inside margins: ${r.features.box.map(Math.round)}`);}
// Every family, stage, layout and format renders cleanly.
for(const f of FAMILIES)for(const stage of [1,2,3,4])for(const layout of OPTIONS.layout)assert(!/NaN|undefined|Infinity/.test(render({family:f.id,stage,layout}).svg),`${f.id} ${stage} ${layout}`);
for(const f of FAMILIES)for(const format of OPTIONS.format)assert(!/NaN|undefined|Infinity/.test(render({family:f.id,format}).svg));for(const f of ['legs','trefoil','handshake'])assert(!/NaN|undefined/.test(specimen({family:f})));

// Input handling.
assert.equal(resolve({params:{arms:99}}).params.arms,16);assert.equal(resolve({params:{arms:2.6}}).params.arms,3);assert.equal(resolve({params:{curl:NaN}}).params.curl,FAMILIES[0].set.params.curl);assert.equal(resolve({params:{twist:'45'}}).params.twist,45);assert.equal(resolve({params:{twist:true}}).params.twist,FAMILIES[0].set.params.twist);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({knot:'bogus',family:'neon'}).knot,'torus');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');
for(const bad of [[[0,0],[1,1]],Array(8).fill([0,0]),[[0,0],[1,NaN],[2,2]],'x',[[0,0],[1],[2,2]]])assert.equal(cleanPoints(bad),null);assert.deepEqual(resolve({limb:'custom',points:[[.3,.3],[9,-9],[1,0]]}).points,[[0,0],[1.6,-1.6],[1,0]]);assert.equal(resolve({limb:'custom',points:[[0,0]]}).limb,FAMILIES[0].set.limb);
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),2120);assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<6;i++)render({family:i%2?'legs':'trefoil',params:{twist:i}});const renderMs=+((performance.now()-t0)/6).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPalettePresets:FAMILIES.length,visibleControlChecks:controlChecks,inertControlAndOptionChecks:inertChecks,visibleOptionValues:optionChecks,distinctPassesPerPreset:4,replay:'exact SVG and resvg pixels, A/B/A, saved JSON, dragged limbs; seeds differ',
 crossingCounts:`${countChecks} closed curves match closed forms: torus q(p − 1) for coprime p ≤ 7, q ≤ 9; torus links have gcd(p, q) components; Lissajous 2ab − a − b at three phases`,
 bruteForce:`${bruteChecks} curves (40 seeded random, 20 two-hand pairs, 3 presets), ${crossingsSeen} crossings: the grid finder equals an independent all-pairs pass, point for point`,
 alternation:`every crossing has one over and one under; ${closedCurves} closed curves alternate along every strand with zero breaks; ${openAlternating}/${openTotal} random two-strand pairs alternate fully (open strands cannot always); the two-hands preset alternates fully; laid puts the later point on top; T(2, q) depth equals alternation`,
 pixelProbes:`${probes} probes at isolated crossings (angle ≥ 55°, both strands nearly straight through the probe span) in ${probeScenes} renders of closed curves and the laid, seeded and depth patterns: over outline, gap inside the under tube, under tube past the gap, over fill at the point; ${skipped} shallow, curling or crowded crossings and probe points skipped`,openStrandCuts:`${cutChecks} crossings in five two-hand tangles: every under occurrence ends two under halves and none lies inside an over piece`,
 limbs:'N-fold turned copies, alternate mirror, splines through every control point, curl adds exactly its turning (even and tip-focused), taper sets the tip width, self-overlap detection, cyclic order mask, drag mapping of editor handles',
 margins:'hero figures inside the poster margins',invalidInputs:'parameter bounds, NaN, numeric strings, booleans, colours, options, stage, markup, limb points (count, NaN, shape, clamp, root fixed)',png:[2120,3000],averageRenderMs:renderMs},
 limitations:'Checks verify construction, crossing logic and drawing, not similarity to Fukuda’s drawings. Two open strands cannot always alternate at every crossing; the editor reports the count. Crossing probes skip shallow and crowded crossings, where the gap is narrower than a probe. Poster text uses system fonts.'},null,2));
console.log(`PASS: ${FAMILIES.length} presets, ${controlChecks} visible controls, ${inertChecks} inert checks, ${optionChecks} option values, 4 stages, replay, ${countChecks} closed-form crossing counts, ${bruteChecks} brute-force curves (${crossingsSeen} crossings), ${closedCurves} alternating closed curves, ${probes} pixel probes (${skipped} skipped), limbs, margins, inputs, 2120 × 3000 export. Render ${renderMs} ms.`);
