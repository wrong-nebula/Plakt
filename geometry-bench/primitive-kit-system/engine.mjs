/* Primitive kit — a shape system after Ikko Tanaka's cell-primitive figures
 * (Nihon Buyo 1981, Kanze Noh 1973, Hanae Mori 1977, Sharaku c. 1995) and
 * Koji Kato's cut-paper bird (c. 1960).
 *
 * A figure is a grid where each cell holds one primitive with a quarter turn,
 * a colour and an optional background colour, plus free primitives (discs,
 * rings, eyes, brows, lips…) layered over the grid. Figures are compact text:
 *   grid:  one token per cell — `T21/0` = triangle, turn 2, colour 1, ground
 *          behind; `S01` square; `.` empty; `./3` empty cell filled with 3
 *   over:  one line per overlay — `eye.kabuki 1.11 1.59 r.104 c3 d1 m`
 *          (x y in cells, r w h sizes in cell widths, a angle, c d colours,
 *          m = also draw the mirror image)
 * Every figure then passes through the same global construction:
 * resolution (re-quantise ×2, ×4) → vocabulary (best-fit substitutes) →
 * turn noise → symmetry → lattice warp, gap, rounding, jitter → paint.
 * The quantiser that refines figures also turns any silhouette into kit
 * cells, which is how the seeded generator draws faces, masks, butterflies,
 * birds and flowers. New vector interpretations; nothing is traced.
 */
import {PRESETS,PRESET_ORDER} from './figures.mjs';
export {PRESETS,PRESET_ORDER};
// v2 adds primitives, merged cells, a feature library with moods, image → figure,
// generator kinds and families, finishes, wallpaper/crowd layouts and series.
// Every v1 rule renders exactly as in v1 (validation re-renders the v1 study).
export const ENGINE='primitive-kit-v2',ENGINES=['primitive-kit-v1','primitive-kit-v2'];
export const W=728,H=1030;  // B-series proportion; PNG exports 2120 × 3000
export const SOURCES=[
 {id:'moma-7848',source:'moma',title:'Nihon Buyo',designer:'Ikko Tanaka',date:'1981',style:'buyo',figure:'buyo'},
 {id:'moma-5064',source:'moma',title:'Kanze Noh Play',designer:'Ikko Tanaka',date:'1973',style:'noh',figure:'noh'},
 {id:'moma-8214',source:'moma',title:'Hanae Mori',designer:'Ikko Tanaka',date:'1977',style:'mori',figure:'butterfly'},
 {id:'pgda-17708',source:'pgda',title:'Sharaku 200th Anniversary',designer:'Ikko Tanaka',date:'c. 1995',style:'sharaku',figure:'sharaku'},
 {id:'moma-4993',source:'moma',title:'Mino Shigyo Co., Ltd. Silkscreen Printing',designer:'Koji Kato',date:'c. 1960',style:'kato',figure:'bird'}
];

// ── Numbers, colour and seeded randomness ──────────────────────────────────
const fx=v=>{const s=String(Math.round(v*1000)/1000);return s==='-0'?'0':s;};
export const num=v=>fx(v).replace(/^(-?)0\./,'$1.');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const fnv=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export const rng=seed=>{let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};};
const hr=(...k)=>rng(fnv(k.join(':')))();
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const hex=a=>'#'+a.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
export const lum=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const esc=s=>String(s).replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));

// ── Contours ────────────────────────────────────────────────────────────────
// A contour is a list of nodes: [x,y] (line to a corner) or ['C',x1,y1,x2,y2,x,y].
function arc(cx,cy,r,a0,a1){const out=[],n=Math.max(1,Math.ceil(Math.abs(a1-a0)/90-1e-9)),d=(a1-a0)/n*Math.PI/180,k=4/3*Math.tan(d/4);let a=a0*Math.PI/180;
 for(let i=0;i<n;i++){const b=a+d,x0=cx+r*Math.cos(a),y0=cy+r*Math.sin(a),x1=cx+r*Math.cos(b),y1=cy+r*Math.sin(b);out.push(['C',x0-k*r*Math.sin(a),y0+k*r*Math.cos(a),x1+k*r*Math.sin(b),y1-k*r*Math.cos(b),x1,y1]);a=b;}return out;}
const circle=(cx,cy,r)=>[[cx+r,cy],...arc(cx,cy,r,0,360)];
const mapCt=(cts,f)=>cts.map(ct=>ct.map(n=>n[0]==='C'?['C',...f(n[1],n[2]),...f(n[3],n[4]),...f(n[5],n[6])]:f(n[0],n[1])));
const pathD=cts=>cts.map(ct=>ct.map((n,i)=>n[0]==='C'?'C'+[n[1],n[2],n[3],n[4],n[5],n[6]].map(fx).join(' '):(i?'L':'M')+fx(n[0])+' '+fx(n[1])).join('')+'Z').join('');
function boxOf(cts,b=[1e9,1e9,-1e9,-1e9]){for(const ct of cts)for(const n of ct){const pts=n[0]==='C'?[[n[1],n[2]],[n[3],n[4]],[n[5],n[6]]]:[n];for(const [x,y] of pts){if(x<b[0])b[0]=x;if(y<b[1])b[1]=y;if(x>b[2])b[2]=x;if(y>b[3])b[3]=y;}}return b;}
function flatten(cts){return cts.map(ct=>{const pts=[];let cur=ct[ct.length-1][0]==='C'?ct[ct.length-1].slice(5):ct[ct.length-1];for(const n of ct){if(n[0]==='C'){for(let i=1;i<=10;i++){const t=i/10,m=1-t;pts.push([m*m*m*cur[0]+3*m*m*t*n[1]+3*m*t*t*n[3]+t*t*t*n[5],m*m*m*cur[1]+3*m*m*t*n[2]+3*m*t*t*n[4]+t*t*t*n[6]]);}cur=[n[5],n[6]];}else{pts.push(n);cur=n;}}return pts;});}
function insidePolys(polys,x,y){let c=false;for(const p of polys)for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
// Round every corner between two straight sides; corners next to a curve stay sharp.
function roundCt(ct,rr){if(rr<=0)return ct;const out=[],n=ct.length,end=i=>{const m=ct[(i+n)%n];return m[0]==='C'?[m[5],m[6]]:m;};
 for(let i=0;i<n;i++){const P=ct[i];if(P[0]==='C'||ct[(i+1)%n][0]==='C'){out.push(P);continue;}
  const A=end(i-1),B=ct[(i+1)%n],la=Math.hypot(A[0]-P[0],A[1]-P[1]),lb=Math.hypot(B[0]-P[0],B[1]-P[1]),d=Math.min(rr,la/2,lb/2);if(d<1e-6){out.push(P);continue;}
  const p1=[P[0]+(A[0]-P[0])*d/la,P[1]+(A[1]-P[1])*d/la],p2=[P[0]+(B[0]-P[0])*d/lb,P[1]+(B[1]-P[1])*d/lb];
  out.push(p1,['C',p1[0]+(P[0]-p1[0])*.552,p1[1]+(P[1]-p1[1])*.552,p2[0]+(P[0]-p2[0])*.552,p2[1]+(P[1]-p2[1])*.552,p2[0],p2[1]]);}
 return out;}

// ── The kit ─────────────────────────────────────────────────────────────────
// Unit cell, y down. Turns are clockwise quarter turns. `corner` primitives
// name a corner (turn 0 = bottom left, 1 top left, 2 top right, 3 bottom
// right); `edge` primitives sit on an edge (0 bottom, 1 left, 2 top, 3 right).
export const PRIMS={
 S:{name:'Square',kind:'sym',cts:[[[0,0],[1,0],[1,1],[0,1]]]},
 T:{name:'Half-square triangle',kind:'corner',cts:[[[0,0],[1,1],[0,1]]]},
 Q:{name:'Quarter disc',kind:'corner',cts:[[[0,1],[0,0],...arc(0,1,1,-90,0)]]},
 C:{name:'Cove',kind:'corner',cts:[[[0,0],[1,0],[1,1],...arc(0,1,1,0,-90)]]},
 H:{name:'Half disc',kind:'edge',cts:[[[0,1],...arc(.5,1,.5,180,360)]]},
 N:{name:'Arch',kind:'edge',cts:[[[0,0],[1,0],[1,1],...arc(.5,1,.5,360,180)]]},
 B:{name:'Half square',kind:'edge',cts:[[[0,.5],[1,.5],[1,1],[0,1]]]},
 D:{name:'Disc',kind:'sym',cts:[circle(.5,.5,.5)]},
 O:{name:'Ring',kind:'sym',cts:[circle(.5,.5,.5),circle(.5,.5,.275)]},
 L:{name:'Leaf',kind:'corner',cts:[[[0,1],...arc(0,0,1,90,0),...arc(1,1,1,270,180)]]},
 K:{name:'Diamond',kind:'sym',cts:[[[.5,0],[1,.5],[.5,1],[0,.5]]]},
 W:{name:'Wedge',kind:'edge',cts:[[[.5,0],[1,1],[0,1]]]},
 A:{name:'Quarter ring',kind:'corner',cts:[[[0,0],...arc(0,1,1,-90,0),[.55,1],...arc(0,1,.55,0,-90)]]},
 P:{name:'Dot',kind:'sym',cts:[circle(.5,.5,.22)]},
 // v2 primitives.
 M:{name:'Crescent',kind:'edge',cts:[crescentCt()]},
 X:{name:'Cross',kind:'sym',cts:[[[.32,0],[.68,0],[.68,.32],[1,.32],[1,.68],[.68,.68],[.68,1],[.32,1],[.32,.68],[0,.68],[0,.32],[.32,.32]]]},
 Z:{name:'Stairs',kind:'corner',cts:[[[0,0],[1/3,0],[1/3,1/3],[2/3,1/3],[2/3,2/3],[1,2/3],[1,1],[0,1]]]},
 E:{name:'Stripes',kind:'axis',cts:[[[0,0],[1,0],[1,.2],[0,.2]],[[0,.4],[1,.4],[1,.6],[0,.6]],[[0,.8],[1,.8],[1,1],[0,1]]]},
 G:{name:'Dots',kind:'sym',cts:[circle(.27,.27,.17),circle(.73,.27,.17),circle(.27,.73,.17),circle(.73,.73,.17)]},
 Y:{name:'Petal',kind:'corner',cts:[[[0,1],['C',.05,.45,.25,.05,.62,.05],['C',.9,.05,.95,.1,.95,.38],['C',.95,.75,.55,.95,0,1]]]}
};
// A crescent: the unit disc minus a smaller disc raised inside it; horns up at turn 0.
function crescentCt(){const r1=.5,r2=.42,c2=.28,d=.5-c2,a=(r1*r1-r2*r2+d*d)/(2*d),hy=.5-a,hx=Math.sqrt(r1*r1-a*a),deg=(cy,x,y)=>Math.atan2(y-cy,x-.5)*180/Math.PI,aR2=deg(c2,.5+hx,hy);
 return [[.5-hx,hy],...arc(.5,.5,.5,deg(.5,.5-hx,hy)+360,deg(.5,.5+hx,hy)),...arc(.5,c2,r2,aR2,180-aR2)];}
export const ORDER='STQCHNBDOLKWAP',ORDER2=ORDER+'MXZEGY';
export const VOCABS=[
 {id:'all',name:'Full kit',prims:ORDER,note:'All fourteen primitives.'},
 {id:'tanaka',name:'Tanaka four',prims:'STQDB',note:'Square, half square, triangle, quarter disc and disc — the Nihon Buyo kit.'},
 {id:'angular',name:'Angles only',prims:'STBKW',note:'Straight edges: square, half square, triangle, diamond, wedge.'},
 {id:'curved',name:'Curves only',prims:'SQCHNDOLAP',note:'Every cut is an arc: quarters, coves, halves, arches, discs, rings, leaves.'},
 {id:'pixel',name:'Pixels',prims:'S',note:'Squares only; each cell keeps its majority colour.'},
 {id:'extended',name:'Full kit + v2',prims:ORDER2,note:'All twenty primitives, adding crescent, cross, stairs, stripes, dots and petal.'},
 {id:'textile',name:'Textile cells',prims:'SBEGXOPK',note:'Stripes, dots, crosses, rings and diamonds: a woven or printed-cloth grain.'},
 {id:'botanic',name:'Moons and petals',prims:'SMYLDQH',note:'Crescents, petals, leaves, discs and quarters: soft botanical cuts.'}
];
export const canon=(p,r)=>p==='.'||PRIMS[p].kind==='sym'?0:p==='L'||PRIMS[p].kind==='axis'?((r%2)+2)%2:((r%4)+4)%4;
const rotPt=(x,y,q)=>{for(let i=0;i<q;i++)[x,y]=[1-y,x];return [x,y];};
const GEO={};
function geo(p,r){const k=p+r;if(!GEO[k]){const cts=mapCt(PRIMS[p].cts,(x,y)=>rotPt(x,y,r));GEO[k]={cts,polys:flatten(cts)};}return GEO[k];}
export const insidePrim=(p,r,u,v)=>p!=='.'&&insidePolys(geo(p,canon(p,r)).polys,u,v);
// The turn that draws a primitive's mirror image: across the vertical axis
// ('x'), the horizontal axis ('y') or both (half turn, 'xy').
export function mirrorRot(p,r,axis='x'){if(p==='.')return 0;const k=PRIMS[p].kind;let q=r;
 if(k!=='sym'&&k!=='axis'){if(axis==='x')q=k==='corner'?3-r:(4-r)%4;else if(axis==='y')q=k==='corner'?r^1:(6-r)%4;else q=(r+2)%4;}return canon(p,q);}
const mirrorCell=(t,axis='x')=>({...t,r:mirrorRot(t.p,t.r,axis)});

// ── Cell tokens and figure text ─────────────────────────────────────────────
// `*k` (2–4) makes a cell the top-left of one primitive spanning k × k cells;
// the cells it covers are written `+` (or `.`).
const TOKEN=/^(?:([STQCHNBDOLKWAPMXZEGY])([0-3])?(\d)|(\.)|(\+))(?:\/(\d))?(?:\*([2-4]))?$/;
export function parseToken(s){const m=TOKEN.exec(String(s));if(!m||(m[5]&&(m[6]||m[7]))||(m[4]&&m[7]))throw new Error(`“${String(s).slice(0,12)}” is not a cell. Write a primitive letter (${ORDER2}), a turn 0–3 and a colour 0–9 — e.g. T21 or S03/2, add *2 to span 2 × 2 cells — or “.” for empty.`);
 if(m[5])return {p:'.',r:0,c:0,b:0,cov:1};const t=m[4]?{p:'.',r:0,c:0,b:+(m[6]??0)}:{p:m[1],r:canon(m[1],+(m[2]??0)),c:+m[3],b:+(m[6]??0)};if(m[7])t.k=+m[7];return t;}
export const tokenOf=t=>t.cov?'+':(t.p==='.'?'.':t.p+t.r+t.c)+(t.b?'/'+t.b:'')+(t.k>1?'*'+t.k:'');
export const MAX_GRID=16,MAX_OVER=40,MAX_CAST=9;
function parseGrid(rows){const list=(Array.isArray(rows)?rows:String(rows??'').split('\n')).map(r=>String(r).trim()).filter(Boolean);
 if(!list.length)throw new Error('A figure needs at least one row of cells.');if(list.length>MAX_GRID)throw new Error(`Use up to ${MAX_GRID} rows.`);
 const cells=list.map(row=>row.split(/\s+/).map(parseToken)),w=cells[0].length;if(w>MAX_GRID)throw new Error(`Use up to ${MAX_GRID} cells per row.`);
 cells.forEach((row,i)=>{if(row.length!==w)throw new Error(`Row ${i+1} has ${row.length} cells; row 1 has ${w}.`);});
 // Merged cells: the block must fit and cover only empty cells.
 for(const row of cells)for(const t of row)if(t.cov)delete t.cov;
 cells.forEach((row,r)=>row.forEach((t,c)=>{if(!(t.k>1))return;if(r+t.k>cells.length||c+t.k>w)throw new Error(`The ${t.k} × ${t.k} cell at row ${r+1}, cell ${c+1} runs off the grid.`);
  for(let j=r;j<r+t.k;j++)for(let i=c;i<c+t.k;i++){if(i===c&&j===r)continue;const u=cells[j][i];if(u.cov||u.p!=='.'||u.b||u.k)throw new Error(`Cell ${j+1}, ${i+1} lies under the ${t.k} × ${t.k} cell at row ${r+1}, cell ${c+1}; write it as “+”.`);cells[j][i]={p:'.',r:0,c:0,b:0,cov:1};}}));
 return cells;}
// Overlays. Defaults per kind (and per variant); sizes are in cell widths.
export const OVERLAYS={
 disc:{name:'Disc',d:{r:.3,c:1}},ring:{name:'Ring',d:{r:.3,i:.55,c:1}},half:{name:'Half disc',d:{r:.3,a:0,c:1}},quarter:{name:'Quarter disc',d:{r:.4,a:0,c:1}},
 tri:{name:'Triangle',d:{w:.5,h:.5,a:0,c:1}},rect:{name:'Rectangle',d:{w:.5,h:.3,a:0,c:1}},band:{name:'Blush band',d:{w:1,h:.25,c:9}},
 stripes:{name:'Stripes',d:{w:.8,h:.4,n:3,a:0,c:1}},spike:{name:'Spikes',d:{w:.6,h:.12,n:1,a:0,c:1}},lens:{name:'Lens',d:{w:.3,h:.8,a:0,c:1}},
 line:{name:'Line',d:{t:.04,c:1}},
 eye:{name:'Eye',variants:['kabuki','almond','round','dot','slit','closed','side','wide','sleepy'],d:{r:.15,a:0,c:1,d:2}},
 brow:{name:'Brow',variants:['arc','moth','line','flick'],d:{w:.5,a:0,c:1}},
 lip:{name:'Lips',variants:['bud','noh','bow','smile','beak','open','grin','frown'],d:{r:.15,a:0,c:3}},
 // v2 feature library.
 cheek:{name:'Cheek',variants:['blush','swirl','lines'],d:{r:.2,a:0,c:9}},
 hair:{name:'Hair ornament',variants:['bun','pin','comb','knot'],d:{r:.3,a:0,c:1,d:3}},
 mon:{name:'Crest (mon)',variants:['tomoe','flower','wheel','diamond'],d:{r:.35,a:0,c:1,d:3}},
 kuma:{name:'Kumadori line',variants:['sweep','flame','tear'],d:{w:.8,a:0,c:3}}
};
const VD={'eye.kabuki':{c:3,d:1},'eye.round':{c:2,d:1},'eye.almond':{c:1,d:2},'lip.noh':{c:1},'lip.beak':{c:6},'eye.side':{c:2,d:1},'eye.wide':{c:2,d:1},'eye.sleepy':{c:2,d:1},'lip.open':{d:1},'lip.grin':{c:1,d:2},'hair.pin':{c:6,d:3},'hair.comb':{c:6,d:6},'mon.flower':{c:9,d:6},'cheek.lines':{c:3}};
const OKEYS=['r','w','h','a','i','t','n','e','c','d'];
export function parseOverlay(line){const tok=String(line).trim().split(/\s+/),[kind,variant]=tok[0].split('.'),spec=OVERLAYS[kind];
 if(!spec)throw new Error(`“${tok[0].slice(0,16)}” is not an overlay. Use ${Object.keys(OVERLAYS).join(', ')}.`);
 if(spec.variants?!spec.variants.includes(variant??spec.variants[0]):variant!==undefined)throw new Error(spec.variants?`${kind} comes as ${spec.variants.map(v=>kind+'.'+v).join(', ')}.`:`${kind} has no variants.`);
 const x=+tok[1],y=+tok[2];if(tok.length<3||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>40||Math.abs(y)>40)throw new Error(`“${String(line).slice(0,40)}” needs a position: ${tok[0]} x y …`);
 const o={k:kind,x,y};if(spec.variants)o.v=variant??spec.variants[0];
 for(const t of tok.slice(3)){if(t==='m'){o.m=true;continue;}const key=t[0],val=t.slice(1),bad=()=>new Error(`Can’t read “${t}” in “${String(line).slice(0,40)}”.`);
  if(key==='c'||key==='d'){if(!/^\d$/.test(val))throw bad();o[key]=+val;}
  else if(key==='e'){const [a,b]=val.split(',').map(Number);if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>40||Math.abs(b)>40)throw bad();o.e=[a,b];}
  else if(key==='n'){const v=Math.round(+val);if(!Number.isFinite(v))throw bad();o.n=clamp(v,1,12);}
  else if('rwhit'.includes(key)){const v=+val;if(val===''||!Number.isFinite(v))throw bad();o[key]=key==='i'?clamp(v,.05,.95):clamp(v,.005,20);}
  else if(key==='a'){const v=+val;if(val===''||!Number.isFinite(v))throw bad();o.a=clamp(v,-720,720);}
  else throw new Error(`Unknown option “${t}” in “${String(line).slice(0,40)}”. Options: r w h a i t n e c d m.`);}
 if(o.k==='line'&&!o.e)o.e=[o.x+1,o.y];return o;}
export const overlayText=o=>`${o.k}${o.v?'.'+o.v:''} ${num(o.x)} ${num(o.y)}`+OKEYS.filter(k=>o[k]!==undefined).map(k=>' '+k+(k==='e'?num(o.e[0])+','+num(o.e[1]):num(o[k]))).join('')+(o.m?' m':'');
const cleanName=s=>String(s??'').replace(/[<>&"\n]/g,'').trim().slice(0,32)||'Figure';
const PARSED=new Map();
export function parsed(def){const key=def.grid.join('|')+'#'+def.over.join('|');let v=PARSED.get(key);if(!v){v={cells:parseGrid(def.grid),over:def.over.map(parseOverlay)};if(PARSED.size>300)PARSED.clear();PARSED.set(key,v);}return v;}
// A figure reference is a preset id, 'gen:kind:seed:size', {preset}, {gen, seed, size} or {name, grid, over}.
export function normalizeFigure(x){
 if(typeof x==='string'){if(Object.hasOwn(PRESETS,x))return {...normalizeFigure(PRESETS[x]),from:'preset:'+x};const g=/^gen:(\w+):(\d+)(?::(\d))?$/.exec(x);if(g)return generate(g[1],+g[2],+(g[3]??1));const fm=/^fam:(\w+):(\d+):(\d+)(?::(\d))?$/.exec(x);if(fm)return generateMember(fm[1],+fm[2],+fm[3],+(fm[4]??1));
  const cg=/^calm:(\w+):(\d+)(?::(\d))?$/.exec(x);if(cg)return generate(cg[1],+cg[2],+(cg[3]??1),{calm:true});const cf=/^calmfam:(\w+):(\d+):(\d+)(?::(\d))?$/.exec(x);if(cf)return generateMember(cf[1],+cf[2],+cf[3],+(cf[4]??1),{calm:true});throw new Error(`“${x.slice(0,24)}” is not a preset figure.`);}
 if(x&&typeof x==='object'){if(x.preset)return normalizeFigure(String(x.preset));if(x.gen)return generate(x.gen,x.seed,x.size);
  const cells=parseGrid(x.grid),over=(Array.isArray(x.over)?x.over:String(x.over??'').split('\n')).map(s=>String(s).trim()).filter(Boolean);if(over.length>MAX_OVER)throw new Error(`Use up to ${MAX_OVER} overlays.`);
  const def={name:cleanName(x.name),from:typeof x.from==='string'?x.from.replace(/[<>&"]/g,'').slice(0,40):'custom',grid:cells.map(r=>r.map(tokenOf).join(' ')),over:over.map(l=>overlayText(parseOverlay(l)))};
  if(Array.isArray(x.focus)&&x.focus.length===2&&x.focus.every(Number.isFinite))def.focus=x.focus.map(v=>clamp(+v,-40,40));return def;}
 throw new Error('A figure is a preset name or {name, grid, over}.');}
// Editable text: name, aligned grid rows, one overlay per line.
export function figureText(def){const cells=parsed(def).cells,w=cells[0].map((_,c)=>Math.max(...cells.map(r=>tokenOf(r[c]).length)));
 return `name: ${def.name}\ngrid:\n${cells.map(r=>r.map((t,c)=>tokenOf(t).padEnd(w[c])).join('  ').trimEnd()).join('\n')}\nover:\n${def.over.join('\n')}`;}
export function parseFigureText(text){let name='Custom figure',mode=null;const grid=[],over=[];
 for(const raw of String(text).split('\n')){const l=raw.trim();if(!l||l.startsWith('#'))continue;const m=/^(name|grid|over)\s*:\s*(.*)$/i.exec(l);
  if(m){mode=m[1].toLowerCase();if(mode==='name')name=m[2];else if(m[2])(mode==='grid'?grid:over).push(m[2]);continue;}
  if(mode==='grid')grid.push(l);else if(mode==='over')over.push(l);else throw new Error('Start with “grid:” and write one row of cells per line.');}
 return normalizeFigure({name,grid,over,from:'custom'});}

// ── Quantiser: any painter (x, y → colour or −1) into kit cells ───────────
const QN=10,CANDS={};
function candidates(prims){if(CANDS[prims])return CANDS[prims];const seen=new Set(),list=[];
 for(const p of prims){if(p==='S')continue;for(let r=0;r<4;r++){const q=canon(p,r),mask=new Uint8Array(QN*QN);for(let j=0;j<QN;j++)for(let i=0;i<QN;i++)mask[j*QN+i]=insidePrim(p,q,(i+.5)/QN,(j+.5)/QN)?1:0;
  const key=mask.join('');if(seen.has(key))continue;seen.add(key);list.push({p,r:q,mask,self:mirrorRot(p,q)===q});}}
 return CANDS[prims]=list;}
// One cell: the two-colour primitive that reproduces the most samples.
function fitCell(paint,c,r,cands){const s=new Int8Array(QN*QN),count=new Map();
 for(let j=0;j<QN;j++)for(let i=0;i<QN;i++){const v=paint(c+(i+.5)/QN,r+(j+.5)/QN);s[j*QN+i]=v;count.set(v,(count.get(v)||0)+1);}
 const cols=[...count.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).map(e=>e[0]).slice(0,3),full=t=>t<0?{p:'.',r:0,c:0,b:0}:{p:'S',r:0,c:t,b:0};
 let best=null;for(const f of cols)for(const b of cols){if(f===b||f<0)continue;for(const k of cands){let sc=0;for(let i=0;i<s.length;i++)if((k.mask[i]?f:b)===s[i])sc++;if(!best||sc>best.sc)best={sc,p:k.p,r:k.r,c:f,b:b<0?0:b};}}
 if(!best||count.get(cols[0])>=best.sc)return full(cols[0]);delete best.sc;return best;}
export function quantize(paint,cols,rows,{prims=ORDER,sym=false}={}){const cands=candidates(prims),half=sym?Math.ceil(cols/2):cols,grid=[];
 for(let r=0;r<rows;r++){const row=[];for(let c=0;c<half;c++){const centre=sym&&cols%2===1&&c===(cols-1)/2;row.push(fitCell(paint,c,r,centre?cands.filter(k=>k.self):cands));}
  for(let c=half;c<cols;c++)row.push(mirrorCell(row[cols-1-c]));grid.push(row);}
 return grid;}
export const hasMerge=cells=>cells.some(row=>row.some(t=>t.k>1));
// Which anchor owns each cell of a grid with merged cells.
function owners(cells){const o=cells.map(row=>row.map(()=>null));cells.forEach((row,r)=>row.forEach((t,c)=>{if(t.k>1)for(let j=r;j<r+t.k&&j<cells.length;j++)for(let i=c;i<c+t.k&&i<row.length;i++)o[j][i]=[r,c];}));return o;}
const gridPainter=cells=>{if(!hasMerge(cells))return (x,y)=>{const r=Math.floor(y),c=Math.floor(x),t=cells[r]?.[c];if(!t)return -1;return insidePrim(t.p,t.r,x-c,y-r)?t.c:(t.b||-1);};
 const own=owners(cells);return (x,y)=>{const r=Math.floor(y),c=Math.floor(x);if(!cells[r]?.[c])return -1;const [r0,c0]=own[r][c]??[r,c],t=cells[r0][c0],k=t.k||1;if(t.cov)return -1;return insidePrim(t.p,t.r,(x-c0)/k,(y-r0)/k)?t.c:(t.b||-1);};};
const MEMO=new Map();const remember=(k,f)=>{if(MEMO.has(k))return MEMO.get(k);const v=f();if(MEMO.size>300)MEMO.clear();MEMO.set(k,v);return v;};
// Resolution ×k re-quantises the drawn figure on a finer grid; a vocabulary
// swaps every primitive it lacks for its best-fitting substitute.
function requantize(cells,k,prims){const ok=t=>t.p==='.'||t.p==='S'||prims.includes(t.p);
 if(k===1){if(cells.every(r=>r.every(ok)))return cells;const paint=gridPainter(cells),cands=candidates(prims);
  return cells.map((row,r)=>row.map((t,c)=>{if(ok(t))return t;if(!(t.k>1))return fitCell(paint,c,r,cands);const f=fitCell((x,y)=>paint(c+(x-c)*t.k,r+(y-r)*t.k),c,r,cands);return f.p==='.'?f:{...f,k:t.k};}));}
 const paint=gridPainter(cells);return quantize((x,y)=>paint(x/k,y/k),cells[0].length*k,cells.length*k,{prims});}
// A cell on a symmetry axis becomes its best-fitting self-symmetric primitive.
function selfSym(t,axis,prims){if(t.p==='.'||mirrorRot(t.p,t.r,axis)===t.r)return t;const paint=(x,y)=>insidePrim(t.p,t.r,x,y)?t.c:(t.b||-1);return fitCell(paint,0,0,candidates(prims).filter(k=>mirrorRot(k.p,k.r,axis)===k.r));}
// Grids with merged cells mirror whole blocks: a block centred on the axis is
// refitted as a self-symmetric block, others are kept or mirrored by their centre.
function applySymBlocks(g,mode,prims){const R=g.length,C=g[0].length;let items=[];g.forEach((row,r)=>row.forEach((t,c)=>{if(!t.cov&&(t.p!=='.'||t.b))items.push({r,c,k:t.k||1,t});}));
 const block=(t,axis)=>{const f=selfSym({...t,k:undefined},axis,prims);return t.k>1&&f.p!=='.'?{...f,k:t.k}:{...f,k:undefined};};
 const pass=(axis,keep)=>{const dim=axis==='x'?C:R,mid=dim/2,out=[];for(const it of items){const pos=axis==='x'?it.c:it.r,ctr=pos+it.k/2;
  if(Math.abs(ctr-mid)<1e-9){out.push({...it,t:block(it.t,axis)});continue;}if(keep==='low'?ctr>mid:ctr<mid)continue;out.push(it);const np=dim-pos-it.k,t=mirrorCell(it.t,axis);out.push(axis==='x'?{...it,c:np,t}:{...it,r:np,t});}items=out;};
 if(mode==='mirror-left'||mode==='quad')pass('x','low');if(mode==='mirror-right')pass('x','high');if(mode==='flip'||mode==='quad')pass('y','low');
 if(mode==='point'){const out=[];for(const it of items){const cr=it.r+it.k/2-R/2,cc=it.c+it.k/2-C/2;if(Math.abs(cr)<1e-9&&Math.abs(cc)<1e-9){out.push({...it,t:block(it.t,'xy')});continue;}if(cr>1e-9||(Math.abs(cr)<1e-9&&cc>0))continue;out.push(it);out.push({...it,r:R-it.r-it.k,c:C-it.c-it.k,t:mirrorCell(it.t,'xy')});}items=out;}
 const out=g.map(row=>row.map(()=>({p:'.',r:0,c:0,b:0})));for(const it of items)out[it.r][it.c]={...it.t};
 for(const it of items)if(out[it.r][it.c].k>1)for(let j=it.r;j<it.r+it.k;j++)for(let i=it.c;i<it.c+it.k;i++)if((i!==it.c||j!==it.r)&&out[j][i].p==='.'&&!out[j][i].b&&!out[j][i].k)out[j][i]={p:'.',r:0,c:0,b:0,cov:1};
 return out;}
function applySym(g,mode,prims=ORDER){if(mode!=='none'&&hasMerge(g))return applySymBlocks(g,mode,prims);const R=g.length,C=g[0].length,out=g.map(r=>r.slice());
 if(C%2&&(mode==='mirror-left'||mode==='mirror-right'||mode==='quad'))for(const row of out)row[(C-1)/2]=selfSym(row[(C-1)/2],'x',prims);
 if(R%2&&(mode==='flip'||mode==='quad'))out[(R-1)/2]=out[(R-1)/2].map(t=>selfSym(t,'y',prims));
 if(R%2&&C%2&&mode==='point')out[(R-1)/2][(C-1)/2]=selfSym(out[(R-1)/2][(C-1)/2],'xy',prims);
 if(mode==='mirror-left'||mode==='quad')for(const row of out)for(let c=Math.ceil(C/2);c<C;c++)row[c]=mirrorCell(row[C-1-c]);
 if(mode==='mirror-right')for(const row of out)for(let c=0;c<Math.floor(C/2);c++)row[c]=mirrorCell(row[C-1-c]);
 if(mode==='flip'||mode==='quad')for(let r=Math.ceil(R/2);r<R;r++)out[r]=out[R-1-r].map(t=>mirrorCell(t,'y'));
 if(mode==='point')for(let i=Math.floor(R*C/2)+(R*C)%2;i<R*C;i++){const r=Math.floor(i/C),c=i%C;out[r][c]=mirrorCell(out[R-1-r][C-1-c],'xy');}
 return out;}
const derived=(mode,r,c,R,C)=>mode==='mirror-left'?c>=Math.ceil(C/2):mode==='mirror-right'?c<Math.floor(C/2):mode==='flip'?r>=Math.ceil(R/2):mode==='quad'?c>=Math.ceil(C/2)||r>=Math.ceil(R/2):mode==='point'?r*C+c>=Math.floor(R*C/2)+(R*C)%2:false;
// The cells a state draws for a figure, after resolution, vocabulary, turn noise and symmetry.
export function cellsOf(def,state){const p=state.params,k=2**p.refine,prims=VOCABS.find(v=>v.id===state.vocab).prims,base=parsed(def).cells;
 let g=remember(k+prims+def.grid.join('|'),()=>requantize(base,k,prims));
 if(p.turn>0)g=g.map((row,r)=>row.map((t,c)=>t.p==='.'||PRIMS[t.p].kind==='sym'||hr(p.seed,'t',r,c)>=p.turn?t:{...t,r:canon(t.p,t.r+1+Math.floor(hr(p.seed,'u',r,c)*3))}));
 return applySym(g,state.symmetry,prims);}

// ── Overlays ───────────────────────────────────────────────────────────────
const rotC=(cts,a,dx=0,dy=0)=>{const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);return mapCt(cts,(x,y)=>[dx+x*c-y*s,dy+x*s+y*c]);};
const scaleC=(cts,sx,sy)=>mapCt(cts,(x,y)=>[x*sx,y*sy]);
const rectC=(w,h)=>[[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]];
const halfC=r=>[[[-r,0],...arc(0,0,r,180,360)]];
function capsule(x0,y0,x1,y1,t){const a=Math.atan2(y1-y0,x1-x0)*180/Math.PI,len=Math.hypot(x1-x0,y1-y0),h=t/2;return rotC([[[0,-h],[len,-h],...arc(len,0,h,-90,90),[0,h],...arc(0,0,h,90,270)]],a,x0,y0);}
function crescent(w,th,lift){const top=[],bot=[];for(let i=0;i<=28;i++){const s=i/28,x=(s-.5)*w,b=-lift*4*s*(1-s),k=Math.sin(Math.PI*s)**.65*(1.15-.35*s);top.push([x,b-th*k]);bot.push([x,b]);}return [[...top,...bot.reverse()]];}
// Shapes of one overlay, centred at its position (y scaled by the cell height).
function overlayShapes(o,f,asp){const q={...OVERLAYS[o.k].d,...(VD[o.k+'.'+o.v]??{}),...o},X=o.x,Y=o.y*asp,r=q.r*f,w=q.w*f,h=q.h*f,a=q.a??0,out=[],add=(cts,c,extra)=>out.push({cts:rotC(cts,a,X,Y),c,...extra});
 switch(o.k){
  case 'disc':add([circle(0,0,r)],q.c);break;
  case 'ring':add([circle(0,0,r),circle(0,0,r*q.i)],q.c);if(o.d!==undefined)add([circle(0,0,r*q.i)],q.d);break;
  case 'half':add(halfC(r),q.c);break;
  case 'quarter':add([[[0,0],[r*Math.cos(Math.PI*1.25),r*Math.sin(Math.PI*1.25)],...arc(0,0,r,225,315)]],q.c);break;
  case 'tri':add([[[0,-h/2],[w/2,h/2],[-w/2,h/2]]],q.c);break;
  case 'rect':add(rectC(w,h),q.c);break;
  case 'band':add(rectC(w,h),q.c,{grad:true});break;
  case 'stripes':{const n=q.n,bt=h/(2*n-1);for(let k=0;k<n;k++)add(rotC(rectC(w,bt),0,0,-h/2+bt/2+k*2*bt),q.c);break;}
  case 'spike':{const n=q.n;for(let k=0;k<n;k++){const dx=(k-(n-1)/2)*h*1.7;add([[[dx-h/2,0],[dx,-w],[dx+h/2,0]]],q.c);}break;}
  case 'lens':add([[[0,-h/2],['C',w*.667,-h*.28,w*.667,h*.28,0,h/2],['C',-w*.667,h*.28,-w*.667,-h*.28,0,-h/2]]],q.c);break;
  case 'line':{const ex=X+(o.e[0]-o.x)*f,ey=Y+(o.e[1]-o.y)*asp*f;out.push({cts:capsule(X,Y,ex,ey,q.t*f),c:q.c});break;}
  case 'eye':
   if(o.v==='kabuki'){add([circle(0,0,r)],q.c);add(rotC(halfC(r*1.08),212,r*.22,r*.88),q.d);}
   else if(o.v==='almond'){add([[[-r,.06*r],['C',-.55*r,-.32*r,.45*r,-.3*r,r,0],['C',.55*r,.3*r,-.5*r,.34*r,-r,.06*r]]],q.c);add([circle(.18*r,-.03*r,.075*r)],q.d);}
   else if(o.v==='round'){add([circle(0,0,r)],q.c);add([circle(0,0,r),circle(0,0,r*.84)],q.d);const g=(o.a??0)*Math.PI/180,off=o.a===undefined?0:.3*r;out.push({cts:[circle(X+Math.cos(g)*off,Y+Math.sin(g)*off,r*.42)],c:q.d});}
   else if(o.v==='dot')add([circle(0,0,r*.6)],q.c);
   else if(o.v==='slit')add([[[-r*1.1,0],['C',-.4*r,-.3*r,.4*r,-.3*r,r*1.1,0],['C',.4*r,.3*r,-.4*r,.3*r,-r*1.1,0]]],q.c);
   else if(o.v==='closed')add(crescent(r*2.2,r*.3,r*.55),q.c);
   else if(o.v==='side'){add(scaleC([circle(0,0,1)],r*1.15,r*.72),q.c);const g=(o.a??0)*Math.PI/180;out.push({cts:[circle(X+Math.cos(g)*r*.52,Y+Math.sin(g)*r*.2,r*.44)],c:q.d});}
   else if(o.v==='wide'){add([circle(0,0,r*1.12)],q.c);add([circle(0,0,r*1.12),circle(0,0,r*.98)],q.d);add([circle(0,0,r*.3)],q.d);}
   else{add([circle(0,0,r)],q.c);add([circle(0,r*.22,r*.45)],q.d);add(halfC(r*1.06),q.d);}
   break;
  case 'brow':
   if(o.v==='arc')add(crescent(w,o.t!==undefined?q.t*f:w*.18,w*.2),q.c);
   else if(o.v==='moth')add(scaleC([circle(0,0,1)],w/2,w*.21),q.c);
   else if(o.v==='line')add(capsule(-w/2,0,w/2,0,o.t!==undefined?q.t*f:w*.16),q.c);
   else add(crescent(w,o.t!==undefined?q.t*f:w*.15,0),q.c);
   break;
  case 'lip':
   if(o.v==='bud'){add([circle(0,.34*r,r)],q.c);add([circle(0,-.38*r,.76*r)],q.c);}
   else if(o.v==='noh')add([[[-r,.05*r],['C',-.85*r,-.35*r,-.6*r,-.46*r,-.35*r,-.44*r],['C',-.15*r,-.42*r,-.08*r,-.3*r,0,-.28*r],['C',.08*r,-.3*r,.15*r,-.42*r,.35*r,-.42*r],['C',.6*r,-.44*r,.85*r,-.33*r,r,.02*r],['C',.75*r,.4*r,.35*r,.5*r,0,.5*r],['C',-.35*r,.5*r,-.75*r,.4*r,-r,.05*r]]],q.c);
   else if(o.v==='bow'){add([circle(-.42*r,-.14*r,.55*r)],q.c);add([circle(.42*r,-.14*r,.55*r)],q.c);add(rotC(halfC(.95*r),180,0,-.08*r),q.c);}
   else if(o.v==='smile')add(rotC(halfC(r),180),q.c);
   else if(o.v==='beak')add([[[-r/2,0],[r/2,0],[0,1.7*r]]],q.c);
   else if(o.v==='open'){add([circle(0,0,r*.72)],q.c);add(scaleC([circle(0,0,1)],r*.5,r*.42),q.d);}
   else if(o.v==='grin'){add(rotC(halfC(r*1.05),180,0,-.15*r),q.c);add(rectC(r*1.5,r*.26),q.d,{});out[out.length-1].cts=rotC(rectC(r*1.5,r*.26),a,X,Y-.02*r);}
   else add(halfC(r*.82),q.c);
   break;
  case 'cheek':
   if(o.v==='blush')add([circle(0,0,r)],q.c);else if(o.v==='swirl'){add([circle(0,0,r),circle(0,0,r*.62)],q.c);add([circle(0,0,r*.24)],q.c);}
   else for(let k=0;k<3;k++)add(capsule((k-1)*r*.55-r*.18,r*.45,(k-1)*r*.55+r*.18,-r*.45,r*.16),q.c);
   break;
  case 'hair':
   if(o.v==='bun'){add([circle(0,0,r)],q.c);add([circle(0,-r*1.18,r*.62)],q.c);}
   else if(o.v==='pin'){add(capsule(-r*1.1,r*.7,r*.95,-r*.6,r*.12),q.c);add([circle(r*.95,-r*.6,r*.3)],q.d);for(let k=0;k<3;k++)add([circle(r*(.75+k*.2),-r*.2+k*r*.33,r*.11)],q.d);}
   else if(o.v==='comb'){add(halfC(r),q.c);for(let k=0;k<5;k++)add(rectC(r*.12,r*.45),q.d,{});for(let k=0;k<5;k++)out[out.length-5+k].cts=rotC(rectC(r*.12,r*.42),a,X+((k-2)*r*.36)*Math.cos(a*Math.PI/180),Y+((k-2)*r*.36)*Math.sin(a*Math.PI/180)+r*.2);}
   else{add(rectC(r*.55,r*1.2),q.c);add([circle(0,-r*.75,r*.5)],q.c);}
   break;
  case 'mon':
   if(o.v==='tomoe'){add([circle(0,0,r),circle(0,0,r*.86)],q.c);for(let k=0;k<3;k++){const t0=k*120,pts=[],rr=r*.38;for(let i=0;i<=16;i++){const f=i/16,an=(t0+f*130)*Math.PI/180,rad=rr+r*.16*f,h=r*.2*(1-f);pts.push([Math.cos(an)*(rad+h),Math.sin(an)*(rad+h)]);}for(let i=16;i>=0;i--){const f=i/16,an=(t0+f*130)*Math.PI/180,rad=rr+r*.16*f,h=r*.2*(1-f);pts.push([Math.cos(an)*(rad-h),Math.sin(an)*(rad-h)]);}
    add([pts],q.c);add([circle(Math.cos(t0*Math.PI/180)*rr,Math.sin(t0*Math.PI/180)*rr,r*.22)],q.c);}}
   else if(o.v==='flower'){for(let k=0;k<5;k++){const an=(-90+k*72)*Math.PI/180;add([circle(Math.cos(an)*r*.52,Math.sin(an)*r*.52,r*.4)],q.c);}add([circle(0,0,r*.24)],q.d);}
   else if(o.v==='wheel'){add([circle(0,0,r),circle(0,0,r*.8)],q.c);for(let k=0;k<4;k++)add(rotC(capsule(-r*.82,0,r*.82,0,r*.1),k*45),q.c);add([circle(0,0,r*.22)],q.d);}
   else for(let k=0;k<4;k++){const an=k*90*Math.PI/180,cx=Math.cos(an)*r*.48,cy=Math.sin(an)*r*.48;add([[[cx,cy-r*.42],[cx+r*.3,cy],[cx,cy+r*.42],[cx-r*.3,cy]]],k%2?q.d:q.c);}
   break;
  case 'kuma':{const sweep=(ang)=>{const pts=[],top=[],bot=[];for(let i=0;i<=20;i++){const f=i/20,x=w*.55*f,y=-w*(f*.95-.25*f*f),th=w*.13*(1-f)**.8+.004;top.push([x-th*.6,y-th]);bot.push([x+th*.6,y+th]);}return rotC([[...top,...bot.reverse()]],ang);};
   // The flame is mirror-symmetric: two mirrored sweeps either side of a straight tapered stroke.
   if(o.v==='sweep')add(sweep(0),q.c);else if(o.v==='flame'){add(sweep(24),q.c);add(mapCt(sweep(24),(x,y)=>[-x,y]),q.c);add([[[-w*.08,0],[0,-w*1.02],[w*.08,0]]],q.c);}else add(sweep(160),q.c);break;}}
 return out;}
// Moods rewrite every face's eyes, brows and mouths (birds' beaks stay).
export const MOODS=['none','happy','sad','angry','surprised','sleepy','wink'];
function moodify(o,mood,ex,ax){if(mood==='none')return o;const r=o.r??.15,w=o.w??.5,side=o.x>ax+1e-6?-1:1,dark=['round','wide','side','sleepy','kabuki'].includes(o.v)?(o.d??1):(o.c??1);
 if(o.k==='eye'){const sz=['dot'].includes(o.v)?r*.8:r;
  if(mood==='happy'||(mood==='wink'&&ex>ax+1e-6))return {k:'eye',v:'closed',x:o.x,y:o.y,r:sz,c:dark};
  if(mood==='sleepy')return {k:'eye',v:'closed',x:o.x,y:o.y+sz*.15,r:sz,a:180,c:dark};
  if(mood==='surprised')return {k:'eye',v:'wide',x:o.x,y:o.y,r:sz*1.08,c:2,d:dark};
  if(mood==='sad')return {...o,y:o.y+r*.1,r:r*.9};
  if(mood==='angry')return {k:'eye',v:'slit',x:o.x,y:o.y+r*.08,r:sz,a:side*14,c:dark};
  return o;}
 if(o.k==='brow'){const a=o.a??0;if(mood==='angry')return {...o,a:a+side*24,y:o.y+w*.08};if(mood==='sad')return {...o,a:a-side*22};if(mood==='surprised')return {...o,y:o.y-w*.28,a:a-side*6};if(mood==='happy')return {...o,y:o.y-w*.08};if(mood==='sleepy')return {...o,a:a*.4,y:o.y+w*.06};return o;}
 if(o.k==='lip'&&o.v!=='beak'){const c=o.c??(o.v==='noh'?1:3);
  if(mood==='happy'||mood==='wink')return {k:'lip',v:'smile',x:o.x,y:o.y,r:r*1.2,c};if(mood==='sad')return {k:'lip',v:'frown',x:o.x,y:o.y+r*.3,r:r*.95,c};
  if(mood==='surprised')return {k:'lip',v:'open',x:o.x,y:o.y,r:r*1.05,c:c===1?3:c,d:1};if(mood==='angry')return {k:'lip',v:'grin',x:o.x,y:o.y,r:r*1.15,c:1,d:2};if(mood==='sleepy')return {k:'lip',v:'open',x:o.x,y:o.y,r:r*.6,c:c===1?3:c,d:1};}
 return o;}
// Overlays after the m flag and the symmetry mode, each with its reflections.
function overlayItems(over,mode,ax,ay){let items=[];for(const o of over){items.push({o,fx:false,fy:false});if(o.m)items.push({o,fx:true,fy:false});}
 const ex=it=>it.fx?2*ax-it.o.x:it.o.x,ey=it=>it.fy?2*ay-it.o.y:it.o.y,e=1e-6;
 const mx=(keep)=>{const next=[];for(const it of items){const x=ex(it);if(keep(x)){next.push(it);if(Math.abs(x-ax)>e)next.push({...it,fx:!it.fx});}}items=next;};
 const my=()=>{const next=[];for(const it of items){const y=ey(it);if(y<=ay+e){next.push(it);if(Math.abs(y-ay)>e)next.push({...it,fy:!it.fy});}}items=next;};
 if(mode==='mirror-left'||mode==='quad')mx(x=>x<=ax+e);if(mode==='mirror-right')mx(x=>x>=ax-e);if(mode==='flip'||mode==='quad')my();
 if(mode==='point'){const next=[];for(const it of items){const x=ex(it),y=ey(it);if(y<ay-e||(Math.abs(y-ay)<=e&&x<=ax+e)){next.push(it);if(Math.abs(x-ax)>e||Math.abs(y-ay)>e)next.push({...it,fx:!it.fx,fy:!it.fy});}}items=next;}
 return items;}

// ── Building a figure in local units (one cell = 1 wide, `aspect` tall) ──────
const SYM_X=['mirror-left','mirror-right','quad'];
export function buildFigure(def,state){const p=state.params,asp=p.aspect,src=parsed(def),cells=cellsOf(def,state),R=cells.length,C=cells[0].length,s=1/(2**p.refine),gw=src.cells[0].length,gh=src.cells.length*asp,sym=SYM_X.includes(state.symmetry);
 // Lattice vertices, warped by seeded noise; the warp mirrors with the figure.
 const V=[];for(let j=0;j<=R;j++){const row=[];for(let i=0;i<=C;i++){let x=i*s,y=j*s*asp;
  if(p.warp>0){const ii=sym?Math.min(i,C-i):i,dir=sym&&i>C-i?-1:1;x+=sym&&i*2===C?0:dir*(hr(p.seed,'wx',ii,j)-.5)*p.warp*.46*s;y+=(hr(p.seed,'wy',ii,j)-.5)*p.warp*.46*s*asp;}row.push([x,y]);}V.push(row);}
 const bgs=[],shapes=[],labels=[],rr=p.round*.5,g=p.gap;let box=[0,0,gw,gh];
 cells.forEach((row,r)=>row.forEach((t,c)=>{if(t.cov)return;const k=t.k>1?t.k:1,c1=Math.min(c+k,C),r1=Math.min(r+k,R),[a,b,d,e]=[V[r][c],V[r][c1],V[r1][c],V[r1][c1]],cx=(a[0]+b[0]+d[0]+e[0])/4,cy=(a[1]+b[1]+d[1]+e[1])/4;labels.push({x:cx,y:cy,t:tokenOf(t)});if(t.p==='.'&&!t.b)return;
  let th=0,dx=0,dy=0,sc=1;if(p.jitter>0){const cc=sym?Math.min(c,C-k-c):c,fl=sym&&c>C-k-c?-1:1,centre=sym&&c===C-k-c;th=centre?0:fl*(hr(p.seed,'jr',cc,r)-.5)*p.jitter*40;dx=centre?0:fl*(hr(p.seed,'jx',cc,r)-.5)*p.jitter*.34*s;dy=(hr(p.seed,'jy',cc,r)-.5)*p.jitter*.34*s*asp;sc=1-hr(p.seed,'js',cc,r)*p.jitter*.2;}
  const ct=Math.cos(th*Math.PI/180),st=Math.sin(th*Math.PI/180),map=(u,v)=>{u=.5+(u-.5)*(1-g);v=.5+(v-.5)*(1-g);const x=(1-u)*(1-v)*a[0]+u*(1-v)*b[0]+(1-u)*v*d[0]+u*v*e[0]-cx,y=(1-u)*(1-v)*a[1]+u*(1-v)*b[1]+(1-u)*v*d[1]+u*v*e[1]-cy;return [cx+dx+sc*(x*ct-y*st),cy+dy+sc*(x*st+y*ct)];};
  if(t.b){const cts=mapCt([roundCt(PRIMS.S.cts[0],rr)],map);bgs.push({cts,c:t.b,role:'bg'});boxOf(cts,box);}
  if(t.p!=='.'&&!(t.p==='S'&&t.b===t.c)){const cts=mapCt(geo(t.p,t.r).cts.map(k=>roundCt(k,rr)),map);shapes.push({cts,c:t.c,role:'cell'});boxOf(cts,box);}}));
 const ax=gw/2,ay=src.cells.length/2,overs=[];
 const mood=state.mood??'none';
 for(const it of overlayItems(src.over,state.symmetry,ax,ay))for(const sh of overlayShapes(moodify(it.o,mood,it.fx?2*ax-it.o.x:it.o.x,ax),p.features,asp)){const cts=mapCt(sh.cts,(x,y)=>[it.fx?2*ax-x:x,it.fy?2*ay*asp-y:y]);overs.push({...sh,cts,role:'over'});boxOf(cts,box);}
 const eyes=overlayItems(src.over.filter(o=>o.k==='eye'),state.symmetry,ax,ay).map(it=>[it.fx?2*ax-it.o.x:it.o.x,(it.fy?2*ay-it.o.y:it.o.y)*asp]);
 const focus=def.focus?[def.focus[0],def.focus[1]*asp]:eyes.length?[eyes.reduce((s,e)=>s+e[0],0)/eyes.length,eyes.reduce((s,e)=>s+e[1],0)/eyes.length]:[(box[0]+box[2])/2,(box[1]+box[3])/2];
 // Backgrounds form one layer under the primitives, so no edge of one shows through a neighbour.
 // `ink` is the tight box of what is drawn (v2 layouts); `box` also holds the whole grid (v1 layouts).
 let ink=[1e9,1e9,-1e9,-1e9];for(const sh of [...bgs,...shapes,...overs])boxOf(sh.cts,ink);if(ink[0]>ink[2])ink=[0,0,gw,gh];
 return {cells:[...bgs,...shapes],overs,labels,V,box,ink,gw,gh,cell:s,R,C,grid:cells,focus};}

// ── Palettes, styles, controls ─────────────────────────────────────────────
// Ten colour roles: 0 ground · 1 ink · 2 light · 3 red · 4 blue · 5 green · 6 yellow · 7 sky · 8 violet · 9 pink.
export const ROLES=['Ground','Ink','Light','Red','Blue','Green','Yellow','Sky','Violet','Pink'];
export const PALETTES=[
 {id:'buyo',name:'Buyo flat',colors:['#d9d9d0','#17151c','#eef2e7','#c80b16','#2453c9','#2a917a','#f1c21b','#5ccfe2','#b35fca','#f3a5dc']},
 {id:'gold',name:'Noh gold',colors:['#a9862c','#141110','#ecd263','#b98545','#6e5420','#8f7d2c','#d8b13d','#cdb978','#5c3d22','#c88a56']},
 {id:'confetti',name:'Confetti',colors:['#f2f0eb','#2c2b2e','#ffffff','#ff4a2a','#4470d8','#0aa152','#ffd200','#35bce0','#b583d8','#ff93b5']},
 {id:'sharaku',name:'Sharaku',colors:['#4b4644','#121011','#f5f3ef','#a5521f','#0d6fc0','#64791f','#e3b13a','#7dc8ea','#7c60a9','#e58fa0']},
 {id:'teal',name:'Cut paper',colors:['#106a6c','#252525','#f6f4ef','#f24b37','#0a8fca','#b8d05e','#d6a74a','#c9c9d6','#a4a2b4','#f79c90']},
 {id:'riso',name:'Riso',colors:['#f3eee3','#232a5c','#fffaf0','#ff4f7b','#3463d6','#00a07a','#ffd23f','#6cb6ff','#8b5bd6','#ff9fcb']},
 {id:'neon',name:'Neon',colors:['#07060c','#5a34c4','#f4efff','#ff2a6d','#2f6bff','#3dff8b','#f6ff3a','#19f0ff','#a04dff','#ff4fd8']},
 {id:'pop',name:'Pop',colors:['#ffe8c4','#151515','#ffffff','#ff4133','#2b5cff','#13b37b','#ffd400','#62d4ff','#9163ff','#ff8ad6']},
 {id:'indigo',name:'Indigo',colors:['#1c2a57','#0d1430','#f2eee3','#e0624e','#7d9ad6','#7fb3a8','#ead9a6','#a7c0e6','#a49ee0','#eab7ae']},
 // v2 palettes.
 {id:'kabuki',name:'Kabuki',colors:['#efe9de','#151213','#fbf9f4','#d4261b','#283a8c','#2d7a3c','#d9a521','#86c5d8','#5e2a7e','#e98a9c']},
 {id:'bauhaus',name:'Bauhaus',colors:['#ece5d6','#161616','#fbf8f1','#e1372a','#1f4ea6','#2b7a4b','#f3c22f','#8bb8da','#5a3f8c','#f0a29d']},
 {id:'gilt',name:'Gold on black',colors:['#0c0b0a','#3a2f22','#f4e6c2','#c8a03a','#8c6b2c','#a9873e','#e8c766','#d9c8a0','#7e5f2e','#cf9f6a']},
 {id:'newsprint',name:'Newsprint',colors:['#e7e3d8','#1b1b1b','#f8f6f0','#d12f2a','#4f4f4f','#767676','#a3a3a3','#c2c2c2','#353535','#d8d8d8']},
 {id:'acid',name:'Acid neon',colors:['#040404','#3a2a8c','#f6fff2','#ff2e93','#3d5cff','#b8ff00','#fff200','#00f0ff','#a100ff','#ff6ec7']},
 {id:'sashiko',name:'Sashiko',colors:['#203063','#111a38','#f4efe3','#db5a40','#7f9bd1','#86b4a2','#ead6a2','#b6c9e8','#aaa2da','#efb7ad']},
 {id:'terracotta',name:'Terracotta',colors:['#efe3cf','#2b2522','#fbf6eb','#c4542c','#2e6e8e','#4e8a5a','#e1a93a','#7fc1ca','#7a4f8a','#e4a08b']},
 // Calm print palettes (v2 showcase): ink, paper and one accent.
 {id:'sumi',name:'Sumi and vermilion',colors:['#ebe5d7','#1c1a19','#f7f3ea','#cf3f27','#3b4a63','#5c6b52','#b8a882','#c8cdd0','#6a6460','#d6a493']},
 {id:'cobalt',name:'Ivory and cobalt',colors:['#f1ede2','#17233d','#fbf9f3','#d2452b','#2445a6','#41609e','#c9ba92','#a9bbd9','#5a6478','#d4b1a3']},
 {id:'sage',name:'Sage and forest',colors:['#e7e5da','#263328','#f6f4ec','#c4472d','#3b5756','#8ea283','#c6b88f','#bac5b5','#5a6a53','#d8b39f']},
 {id:'stone',name:'Slate and stone',colors:['#d7d3ca','#2c3034','#efece5','#c3462c','#4b5560','#6e7a6b','#b2a68e','#a8afb4','#77706a','#c8a898']},
 {id:'forest',name:'Forest paper',colors:['#ede7da','#1e3a2d','#f8f4ea','#cc472b','#2f4b62','#557a5b','#c3a76c','#a7beaf','#3e5d4a','#d6a392']}
];
export const CONTROLS=[
 {key:'refine',label:'Grid resolution (×1, ×2, ×4)',min:0,max:2,step:1,value:0,integer:true},
 {key:'gap',label:'Cell gap',min:0,max:.35,step:.005,value:0},
 {key:'round',label:'Corner rounding',min:0,max:.5,step:.01,value:0},
 {key:'aspect',label:'Cell height',min:.6,max:1.6,step:.01,value:1},
 {key:'jitter',label:'Cell jitter',min:0,max:1,step:.01,value:0},
 {key:'warp',label:'Lattice warp (cut paper)',min:0,max:1,step:.01,value:0},
 {key:'turn',label:'Turn noise',min:0,max:1,step:.01,value:0},
 {key:'features',label:'Overlay size',min:.4,max:2.2,step:.01,value:1},
 {key:'scale',label:'Figure scale',min:.4,max:1.8,step:.01,value:1},
 {key:'stroke',label:'Line weight (outline, sticker, neon)',min:.5,max:10,step:.1,value:2.5,paints:['outline','sticker','neon']},
 {key:'count',label:'Field repeats across',min:1,max:8,step:1,value:3,integer:true,layouts:['field','wallpaper']},
 {key:'seed',label:'Seed (jitter, warp, noise, scatter, riso)',min:1,max:999,step:1,value:7,integer:true}
];
export const OPTIONS={layout:['hero','field','cast','crop','wallpaper','crowd','row'],symmetry:['none','mirror-left','mirror-right','flip','quad','point'],vocab:VOCABS.map(v=>v.id),paint:['fill','outline','sticker','neon','riso','cutpaper','mosaic','quilt','emboss','glow'],pattern:['repeat','mirror','brick','turn','scatter','colorway','halfdrop'],ground:['plain','gradient','lattice','grain'],copy:['corner','serif','vertical','band','none','caption','column'],format:['poster','square','landscape','story','banner'],mood:MOODS};
export const LABELS={layout:{hero:'Hero figure',field:'Patterned field',cast:'Cast of figures',crop:'Cropped giant',wallpaper:'Wallpaper (full bleed)',crowd:'Crowd (overlapping rows)',row:'Row (one scale, no captions)'},mood:{none:'As drawn',happy:'Happy',sad:'Sad',angry:'Angry',surprised:'Surprised',sleepy:'Sleepy',wink:'Wink'},symmetry:{none:'As drawn','mirror-left':'Mirror left half','mirror-right':'Mirror right half',flip:'Mirror top half',quad:'Four-way mirror',point:'Half-turn'},
 vocab:Object.fromEntries(VOCABS.map(v=>[v.id,v.name])),paint:{fill:'Flat fill',outline:'Outline',sticker:'Sticker (fill + ink line)',neon:'Neon glow',riso:'Riso overprint',cutpaper:'Cut paper (cast shadows)',mosaic:'Mosaic with grout',quilt:'Quilt stitches',emboss:'Embossed relief',glow:'Glow fill (electro)'},pattern:{repeat:'Repeat',mirror:'Mirror tiles',brick:'Brick offset',turn:'Quarter turns',scatter:'Scatter',colorway:'Colourways',halfdrop:'Half drop'},
 ground:{plain:'Plain',gradient:'Gradient',lattice:'Lattice lines',grain:'Paper grain'},copy:{corner:'Corner block',serif:'Serif title',vertical:'Vertical column',band:'Bottom band',none:'No copy',caption:'Small caps caption',column:'Tategaki column (small)'},format:{poster:'Poster B 728 × 1030',square:'Square',landscape:'Landscape B',story:'Story 9:16',banner:'Banner 5:2'}};
export const FORMATS={poster:[728,1030],square:[880,880],landscape:[1030,728],story:[580,1030],banner:[1030,412]};
const P0={refine:0,gap:0,round:0,aspect:1,jitter:0,warp:0,turn:0,features:1,scale:1,stroke:2.5,count:3,seed:7};
const S0={layout:'hero',bleed:false,symmetry:'none',vocab:'all',paint:'fill',pattern:'repeat',ground:'plain',copy:'band',format:'poster',mood:'none'};
export const STYLES=[
 {id:'buyo',name:'Buyo flat',after:'Ikko Tanaka, Nihon Buyo, 1981',palette:'buyo',cast:['buyo','noh','butterfly','sharaku','owl','cat'],title:'Nihon Buyo',info:'Primitive kit / figure study / after Ikko Tanaka, 1981',
  set:{...S0,bleed:true,copy:'corner',params:{...P0,aspect:1.061}},note:'The source figure fills the page: a 3 × 4 grid of flat cells with a disc sun, kabuki eyes and bud lips.'},
 {id:'noh',name:'Gold Noh',after:'Ikko Tanaka, Kanze Noh, 1973',palette:'gold',cast:['noh','buyo','oni','kitsune','daruma','owl'],title:'Kanze Noh',info:'Primitive kit / mask study / after Ikko Tanaka, 1973',
  set:{...S0,layout:'crop',ground:'grain',copy:'vertical',params:{...P0,scale:.8}},note:'A giant mask cropped by the page: stepped gold planes, almond eyes, Noh lips, paper grain.'},
 {id:'mori',name:'Confetti wings',after:'Ikko Tanaka, Hanae Mori, 1977',palette:'confetti',cast:['butterfly','owl','flower','koi','bird','cat'],title:'HANAE MORI',info:'Primitive kit · wing study after Ikko Tanaka, 1977',
  set:{...S0,copy:'serif',params:{...P0,aspect:1.3}},note:'Black half-square triangles make the 1977 wings, scattered with rings, spikes and stripes.'},
 {id:'sharaku',name:'Nine discs',after:'Ikko Tanaka, Sharaku 200th anniversary, c. 1995',palette:'sharaku',cast:['sharaku','daruma','buyo','noh','oni','cat'],title:'SHARAKU',info:'Primitive kit / disc portrait / after Ikko Tanaka',
  set:{...S0,copy:'vertical',params:{...P0,scale:1.04}},note:'A face from a few cells under large free discs: cap, buns, collar and fan.'},
 {id:'kato',name:'Cut paper',after:'Koji Kato, Mino Shigyo silkscreen, c. 1960',palette:'teal',cast:['bird','owl','koi','flower','butterfly','cat'],title:'GRAND INSATSU',info:'Primitive kit / cut-paper bird / after Koji Kato, c. 1960',
  set:{...S0,copy:'band',params:{...P0,warp:.55,gap:.03,jitter:.08,seed:12}},note:'Paper squares cut by hand: the lattice warps, cells shift, a bird stands on a wire.'},
 {id:'riso',name:'Riso cast',after:'new — riso overprint',palette:'riso',cast:['gen:face:11:1','gen:mask:4:1','gen:face:27:1','gen:mask:19:1','gen:face:3:1','gen:mask:8:1'],title:'Faces & Masks',info:'Six generated figures / seeded, symmetric, one kit',
  set:{...S0,layout:'cast',paint:'riso',ground:'grain',copy:'band',params:{...P0,gap:.02,seed:31}},note:'Six seeded faces and masks in fluoro pink, blue and yellow, misregistered over paper grain.'},
 {id:'neon',name:'Neon masks',after:'new — electro',palette:'neon',cast:['oni','kitsune','owl','cat','gen:mask:2:1','daruma'],title:'NIGHT MASKS',info:'Primitive kit / neon field / 2026',
  set:{...S0,layout:'field',paint:'neon',ground:'gradient',pattern:'colorway',copy:'band',params:{...P0,count:2,stroke:2.2,round:.12,gap:.04}},note:'Masks repeated on near-black, each tile shifted to a new neon colourway and lit with glow.'},
 {id:'sticker',name:'Pop stickers',after:'new — sticker sheet',palette:'pop',cast:['gen:bird:5:1','gen:flower:2:1','gen:butterfly:9:1','gen:face:14:1','gen:flower:21:1','gen:bird:30:1'],title:'Sticker Kit',info:'Generated birds, flowers, butterflies and faces',
  set:{...S0,layout:'cast',paint:'sticker',copy:'band',params:{...P0,round:.32,gap:.07,stroke:3.2}},note:'Seeded figures as die-cut stickers: soft corners, open gaps, a heavy ink line.'},
 {id:'indigo',name:'Indigo repeat',after:'new — textile field',palette:'indigo',cast:['flower','butterfly','kitsune','owl','koi','buyo'],title:'Indigo Repeat',info:'Primitive kit / mirror tiles / line only',
  set:{...S0,layout:'field',paint:'outline',pattern:'mirror',ground:'lattice',copy:'band',params:{...P0,count:3,stroke:2.4,gap:.06}},note:'A flower drawn in line only and mirrored tile by tile, like a stencilled indigo cloth.'},
 // v2 styles.
 {id:'kabuki',name:'Kabuki red',after:'new — kabuki make-up',palette:'kabuki',cast:['kumadori','gen:hannya:7:1','oni','gen:okame:4:1','noh','daruma'],title:'Kabuki',info:'Primitive kit / kumadori / red · black · white',
  set:{...S0,copy:'column',params:{...P0}},note:'A white kabuki face with kumadori sweeps in red, black brows and wig, in three inks.'},
 {id:'bauhaus',name:'Bauhaus family',after:'new — primaries',palette:'bauhaus',cast:[0,1,2,3,4,5].map(i=>`fam:face:12:${i}:1`),title:'Family Portrait',info:'Six faces from one seed / Tanaka four / primaries',
  set:{...S0,layout:'cast',vocab:'tanaka',copy:'band',params:{...P0,gap:.05}},note:'One generated family — shared palette and proportions, different hair, eyes and mouths — in Bauhaus primaries.'},
 {id:'gilt',name:'Gold relief',after:'new — gold on black',palette:'gilt',cast:['sharaku','heron','calm:crane:5:1','calm:fan:3:1','butterfly','ichi'],title:'Sharaku',info:'Primitive kit / embossed relief',
  set:{...S0,paint:'emboss',copy:'caption',params:{...P0,gap:.02}},note:'Sharaku’s face under its large discs, every piece a bevelled gold plate on black.'},
 {id:'newsprint',name:'Newsprint crowd',after:'new — cut newspaper',palette:'newsprint',cast:[0,1,2,3,4,5,6].map(i=>`fam:mask:21:${i}:1`),title:'The Crowd',info:'Seven masks from one seed / cut paper / surprised',
  set:{...S0,layout:'crowd',paint:'cutpaper',ground:'grain',copy:'corner',mood:'surprised',params:{...P0}},note:'A crowd of one mask family cut from newsprint, casting shadows, all surprised at once.'},
 {id:'acid',name:'Acid wallpaper',after:'new — electro',palette:'acid',cast:['gen:rabbit:6:1','gen:lantern:3:1','gen:fox:5:1','cat','gen:crane:2:1','gen:fan:9:1'],title:'ACID BUNNY',info:'Primitive kit / half-drop wallpaper / 2026',
  set:{...S0,layout:'wallpaper',paint:'glow',pattern:'halfdrop',ground:'plain',copy:'band',params:{...P0,count:3,round:.42,gap:.1}},note:'A rabbit of glowing rounded LED tiles, repeated edge to edge in a half-drop on black.'},
 {id:'sashiko',name:'Sashiko quilt',after:'new — stitched indigo',palette:'sashiko',cast:['gen:crane:9:1','koi','flower','gen:fan:11:1','owl','daruma'],title:'Sashiko',info:'Primitive kit / quilted crane / indigo and cream',
  set:{...S0,paint:'quilt',copy:'caption',params:{...P0,gap:.07,round:.18}},note:'A crane pieced like a quilt: rounded patches, open seams and running stitches.'},
 // Calm v2 styles: one figure, large or cropped, ink and paper with one accent, small tracked type.
 {id:'sumi',name:'Sumi and vermilion',after:'new — ink on cream',palette:'sumi',cast:['ichi','heron','noh','calm:face:21:1','buyo','bigcell'],title:'Ichi',info:'Primitive kit / ink, paper, one red',
  set:{...S0,layout:'crop',copy:'column',params:{...P0,scale:.74}},note:'An abstract face of eleven cells in ink and paper, cropped by the page, with one vermilion mouth and a small vertical column.'},
 {id:'cobalt',name:'Ivory and cobalt',after:'new — blue on ivory',palette:'cobalt',cast:['butterfly','heron','ichi','sharaku','noh','calm:fan:8:1'],title:'Hanae Mori',info:'Primitive kit / wing study / cobalt on ivory',
  set:{...S0,copy:'caption',params:{...P0,aspect:1.3,scale:.94}},note:'The 1977 wings in navy on ivory, their confetti reduced to cobalt, slate, sand and one vermilion ring.'},
 {id:'sage',name:'Sage and forest',after:'new — sage and forest',palette:'sage',cast:['calm:okame:8:1','calmfam:okame:8:1:1','calmfam:okame:8:2:1','ichi','heron','sharaku'],title:'Okame',info:'Primitive kit / one face, three colours',
  set:{...S0,layout:'crop',copy:'column',params:{...P0,scale:.85}},note:'A calm okame face — dot eyes, a small mouth, hair parted in two cells — cropped by the page in forest, cream and sage.'},
 {id:'stone',name:'Stone mosaic',after:'new — slate and stone',palette:'stone',cast:['heron','bigcell','ichi','noh','sharaku','buyo'],title:'Heron',info:'Primitive kit / stone tesserae',
  set:{...S0,paint:'mosaic',copy:'column',params:{...P0,scale:.86}},note:'A heron of a few large cells laid in slate and stone tesserae, with one vermilion crown and generous negative space.'},
 {id:'papercut',name:'Paper cut',after:'new — cut paper',palette:'forest',cast:['bird','heron','ichi','butterfly','calm:crane:9:1','sharaku'],title:'Grand Insatsu',info:'Primitive kit / cut paper / forest and cream',
  set:{...S0,paint:'cutpaper',ground:'grain',copy:'caption',params:{...P0,scale:.9,warp:.35,gap:.02,seed:12}},note:'Kato’s bird cut from forest, cream and stone paper, casting soft shadows on grained cream.'},
 {id:'mosaic',name:'Mosaic tiles',after:'new — terracotta mosaic',palette:'terracotta',cast:['bigcell','owl','gen:okame:9:1','koi','buyo','gen:fan:4:1'],title:'Mosaic',info:'Primitive kit / big merged cells / grout',
  set:{...S0,paint:'mosaic',copy:'band',vocab:'extended',params:{...P0}},note:'A figure of big merged primitives laid in terracotta tesserae with grout lines.'}
];
// The showcase leads with the source styles and the calm v2 styles; legacy styles stay for replay.
const LEGACY=['riso','neon','sticker','indigo','bauhaus','newsprint','acid','mosaic'];
for(const s of STYLES)s.group=LEGACY.includes(s.id)?'legacy':['buyo','noh','mori','sharaku','kato'].includes(s.id)?'source':'new';
export const SHOWCASE=STYLES.filter(s=>s.group!=='legacy').map(s=>s.id);
export const FAMILIES=STYLES;

// ── State ──────────────────────────────────────────────────────────────────
const clampNum=(v,c)=>{let x=Number(v);if(!Number.isFinite(x))x=c.value;x=clamp(x,c.min,c.max);return c.integer?Math.round(x):x;};
// Copy is escaped when drawn; cleaning only drops markup characters, so a resolved state resolves to itself.
const cleanText=(v,d,max)=>typeof v==='string'?v.replace(/[<>"]/g,'').slice(0,max):d;
export function resolve(input={}){const style=STYLES.find(s=>s.id===input.style)??STYLES[0],set=style.set,pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],params={};
 for(const c of CONTROLS)params[c.key]=clampNum(input.params?.[c.key]??set.params[c.key]??c.value,{...c,value:set.params[c.key]??c.value});
 let cast;try{cast=(Array.isArray(input.cast)&&input.cast.length?input.cast:style.cast).slice(0,MAX_CAST).map(normalizeFigure);}catch{cast=style.cast.map(normalizeFigure);}
 const palette=PALETTES.some(p=>p.id===input.palette)?input.palette:style.palette,colors=Array.isArray(input.colors)&&input.colors.length===10&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...PALETTES.find(p=>p.id===palette).colors];
 return {engine:ENGINE,style:style.id,cast,active:clamp(Math.round(+input.active||0),0,cast.length-1),layout:pick('layout'),bleed:typeof input.bleed==='boolean'?input.bleed:!!set.bleed,mood:pick('mood'),symmetry:pick('symmetry'),vocab:pick('vocab'),paint:pick('paint'),pattern:pick('pattern'),ground:pick('ground'),copy:pick('copy'),format:pick('format'),
  palette,colors,params,title:cleanText(input.title,style.title,48),info:cleanText(input.info,style.info,140),stage:[1,2,3,4].includes(+input.stage)?+input.stage:4};}

// ── Painting ───────────────────────────────────────────────────────────────
const SANS="'Helvetica Neue',Helvetica,Arial,sans-serif",SERIF="Didot,'Bodoni 72','Bodoni MT','Times New Roman',serif",HEAVY="Futura,'Avenir Next','Helvetica Neue',Arial,sans-serif";
const lineInk=(colors,cmap=colors)=>lum(colors[0])<.25?cmap[2]:cmap[1];
function paintFigure(fig,state,scale,ctx,cmap,stage){const px=1/scale,P=stage===4?state.paint:'fill',p=state.params,ground=state.colors[0],line=lineInk(state.colors,cmap),seam=P==='fill'&&p.gap<.01&&p.jitter<.01;let out='';
 if(stage===1){let d='';for(const row of fig.V)d+='M'+row.map(v=>fx(v[0])+' '+fx(v[1])).join('L');for(let i=0;i<fig.V[0].length;i++)d+='M'+fig.V.map(r=>fx(r[i][0])+' '+fx(r[i][1])).join('L');
  out+=`<path d="${d}" fill="none" stroke="${line}" stroke-opacity=".4" stroke-width="${fx(px)}"/>`;
  for(const sh of fig.cells)out+=`<path d="${pathD(sh.cts)}" fill="${cmap[sh.c]}" fill-opacity="${sh.role==='bg'?.14:.26}" stroke="${sh.c?cmap[sh.c]:line}" stroke-width="${fx(1.5*px)}" fill-rule="evenodd"/>`;
  for(const sh of fig.overs)out+=`<path d="${pathD(sh.cts)}" fill="none" stroke="${sh.c?cmap[sh.c]:line}" stroke-width="${fx(1.3*px)}" stroke-dasharray="${fx(4*px)} ${fx(3*px)}" fill-rule="evenodd"/>`;
  if(fig.cell*scale>=38){const fs=Math.min(12,fig.cell*scale*.17)*px;out+=`<g font-family="${SANS}" font-size="${fx(fs)}" fill="${line}" fill-opacity=".75" text-anchor="middle">${fig.labels.map(l=>`<text x="${fx(l.x)}" y="${fx(l.y+fs*.35)}">${l.t}</text>`).join('')}</g>`;}
  return out;}
 for(const sh of stage===2?fig.cells:[...fig.cells,...fig.overs]){const d=pathD(sh.cts),c=cmap[sh.c];
  if(sh.grad){const id=`${ctx.uid}-fade-${c.slice(1)}`;if(!ctx.fades.has(id)){ctx.fades.add(id);ctx.defs+=`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;}out+=`<path d="${d}" fill="url(#${id})"/>`;continue;}
  if(P==='fill')out+=`<path d="${d}" fill="${c}"${seam&&sh.role!=='over'?` stroke="${c}" stroke-width="${fx(.8*px)}" stroke-linejoin="round"`:''} fill-rule="evenodd"/>`;
  else if(P==='outline')out+=`<path d="${d}" fill="none" stroke="${sh.c?c:line}" stroke-width="${fx(p.stroke*px)}" stroke-linejoin="round" fill-rule="evenodd"/>`;
  else if(P==='sticker')out+=`<path d="${d}" fill="${c}" stroke="${line}" stroke-width="${fx(p.stroke*px)}" stroke-linejoin="round" fill-rule="evenodd"/>`;
  else if(P==='neon')out+=`<path d="${d}" fill="${mix(c,ground,.72)}" stroke="${c}" stroke-width="${fx(p.stroke*px)}" stroke-linejoin="round" fill-rule="evenodd"/>`;
  else if(P==='riso'){const [ox,oy]=ctx.riso[sh.c];out+=`<path d="${d}" fill="${c}" fill-rule="evenodd" transform="translate(${fx(ox*px)} ${fx(oy*px)})"/>`;}
  // v2 finishes. Cut paper: every piece casts a soft shadow on what lies below.
  else if(P==='cutpaper')out+=`<path d="${d}" fill="${mix(ground,'#000000',.6)}" fill-opacity=".38" transform="translate(${fx(3.2*px)} ${fx(4.4*px)})" fill-rule="evenodd"/><path d="${d}" fill="${c}" fill-rule="evenodd"/>`;
  else if(P==='mosaic')out+=`<path d="${d}" fill="${c}" stroke="${ground}" stroke-width="${fx(1.8*px)}" stroke-linejoin="round" fill-rule="evenodd"/>`;
  // Quilt: running stitches on a slightly smaller copy of each patch.
  else if(P==='quilt'){const [x0,y0,x1,y1]=boxOf(sh.cts),cx=(x0+x1)/2,cy=(y0+y1)/2,k=.84;out+=`<path d="${d}" fill="${c}" fill-rule="evenodd"/><path d="${d}" fill="none" stroke="${mix(c,lum(c)>.4?'#000000':'#ffffff',.5)}" stroke-width="${fx(1.3*px/k)}" stroke-dasharray="${fx(5*px/k)} ${fx(4*px/k)}" stroke-linecap="round" transform="translate(${fx(cx)} ${fx(cy)}) scale(${k}) translate(${fx(-cx)} ${fx(-cy)})"/>`;}
  else if(P==='glow')out+=`<path d="${d}" fill="${c}" fill-rule="evenodd"/>`;
  // Emboss: a dark lower-right and a light upper-left copy make each piece a bevelled plate.
  else out+=`<path d="${d}" fill="${mix(c,'#000000',.5)}" transform="translate(${fx(2.4*px)} ${fx(2.8*px)})" fill-rule="evenodd"/><path d="${d}" fill="${mix(c,'#ffffff',.5)}" transform="translate(${fx(-1.3*px)} ${fx(-1.3*px)})" fill-rule="evenodd"/><path d="${d}" fill="${c}" fill-rule="evenodd"/>`;}
 // Mosaic grout: ground-coloured joints across the whole figure split it into tesserae.
 if(P==='mosaic'){const [x0,y0,x1,y1]=fig.box,g=fig.cell/3;let dd='';for(let x=Math.ceil(x0/g)*g;x<x1;x+=g)dd+=`M${fx(x)} ${fx(y0)}V${fx(y1)}`;for(let y=Math.ceil(y0/g)*g;y<y1;y+=g)dd+=`M${fx(x0)} ${fx(y)}H${fx(x1)}`;out+=`<path d="${dd}" stroke="${ground}" stroke-width="${fx(1.5*px)}" fill="none"/>`;}
 return out;}
const margin=(w,h)=>Math.round(Math.min(w,h)*.055);
export function contentBox(state,w,h){const m=margin(w,h),b=[m,m,w-m,h-m];if(state.copy==='corner')b[1]+=130;else if(state.copy==='serif')b[1]+=122;else if(state.copy==='vertical')b[2]-=86;else if(state.copy==='band')b[3]-=92;else if(state.copy==='caption')b[3]-=40;else if(state.copy==='column')b[2]-=44;return b;}
const shift=(colors,k)=>colors.map((c,i)=>i<3?c:colors[3+(i-3+k)%7]);
function fitIn(fig,b,k){const [x0,y0,x1,y1]=fig.box,s=Math.min((b[2]-b[0])/(x1-x0),(b[3]-b[1])/(y1-y0))*k;return {s,tx:(b[0]+b[2])/2-(x0+x1)/2*s,ty:(b[1]+b[3])/2-(y0+y1)/2*s};}
function layoutBody(state,w,h,ctx){const p=state.params;let box=contentBox(state,w,h);const st=state.stage,place=[],put=(fig,t,cmap=state.colors)=>`<g transform="translate(${fx(t.tx)} ${fx(t.ty)}) scale(${fx(t.s)})">${paintFigure(fig,state,t.s,ctx,cmap,st)}</g>`,ink=lineInk(state.colors);let body='',tiles=0,cells=0,overs=0;
 const note=(fig,t,name)=>{cells+=fig.cells.length;overs+=fig.overs.length;place.push({name,box:[t.tx+fig.box[0]*t.s,t.ty+fig.box[1]*t.s,t.tx+fig.box[2]*t.s,t.ty+fig.box[3]*t.s],cell:fig.cell*t.s});};
 if(state.layout==='hero'||state.layout==='crop'){const def=state.cast[state.active],fig=buildFigure(def,state);let t;
  // The giant figure bleeds off three sides; the side that carries the copy stays clear.
  if(state.layout==='crop'){const [x0,y0,x1,y1]=fig.box,c=[0,0,w,h];if(state.copy==='corner'||state.copy==='serif')c[1]=box[1]-14;else if(state.copy==='vertical')c[2]=box[2]+10;else if(state.copy==='band')c[3]=box[3]+10;else if(state.copy==='column')c[2]=box[2]+8;else if(state.copy==='caption')c[3]=box[3]+8;
   const s=Math.min(w/(x1-x0),h/(y1-y0))*1.4*p.scale;t={s,tx:(c[0]+c[2])/2-fig.focus[0]*s,ty:c[1]+(c[3]-c[1])*.46-fig.focus[1]*s};ctx.defs+=`<clipPath id="${ctx.uid}-crop"><rect x="${c[0]}" y="${c[1]}" width="${c[2]-c[0]}" height="${c[3]-c[1]}"/></clipPath>`;body=`<g clip-path="url(#${ctx.uid}-crop)">${put(fig,t)}</g>`;note(fig,t,def.name);return {body,place,tiles,cells,overs,box};}
  else if(state.bleed){const s=Math.max(w/fig.gw,h/fig.gh)*p.scale;t={s,tx:(w-fig.gw*s)/2,ty:(h-fig.gh*s)/2};}else t=fitIn(fig,box,.96*p.scale);
  body=put(fig,t);note(fig,t,def.name);}
 else if(state.layout==='field'||state.layout==='wallpaper'){if(state.layout==='wallpaper')box=[0,0,w,h];const def=state.cast[state.active],fig=buildFigure(def,state),[x0,y0,x1,y1]=fig.box,fw=x1-x0,fh=y1-y0,n=p.count,bw=box[2]-box[0],bh=box[3]-box[1],tw=bw/n,turn=state.pattern==='turn',brick=state.pattern==='brick',drop=state.pattern==='halfdrop';
  const rows=Math.max(1,Math.round(bh/(turn?tw:tw*fh/fw))),th=bh/rows,s=(turn?Math.min(tw,th)/Math.max(fw,fh):Math.min(tw/fw,th/fh))*.88*p.scale,ways=state.pattern==='colorway'?7:1,cx=(x0+x1)/2,cy=(y0+y1)/2;
  for(let k=0;k<ways;k++)ctx.defs+=`<g id="${ctx.uid}-t${k}">${paintFigure(fig,state,s,ctx,k?shift(state.colors,k):state.colors,st)}</g>`;
  ctx.defs+=`<clipPath id="${ctx.uid}-clip"><rect x="${box[0]}" y="${box[1]}" width="${fx(bw)}" height="${fx(bh)}"/></clipPath>`;
  for(let j=drop?-1:0;j<rows;j++)for(let i=0;i<n+(brick&&j%2?1:0);i++){if(drop&&j<0&&i%2===0)continue;const X=box[0]+(i+.5)*tw-(brick&&j%2?tw/2:0),Y=box[1]+(j+.5)*th+(drop&&i%2?th/2:0);let tf=`translate(${fx(X)} ${fx(Y)})`;
   if(state.pattern==='mirror')tf+=` scale(${i%2?-1:1} ${j%2?-1:1})`;else if(turn)tf+=` rotate(${((i+j)%4)*90})`;
   else if(state.pattern==='scatter'){const z=.78+hr(p.seed,'sz',i,j)*.36;tf+=` rotate(${fx((hr(p.seed,'sa',i,j)-.5)*44)}) scale(${fx((hr(p.seed,'sf',i,j)<.5?-1:1)*z)} ${fx(z)})`;}
   tf+=` scale(${fx(s)}) translate(${fx(-cx)} ${fx(-cy)})`;body+=`<use href="#${ctx.uid}-t${state.pattern==='colorway'?(i+2*j)%7:0}" transform="${tf}"/>`;tiles++;}
  body=`<g clip-path="url(#${ctx.uid}-clip)">${body}</g>`;cells=fig.cells.length*tiles;overs=fig.overs.length*tiles;place.push({name:def.name,box,cell:fig.cell*s});}
 // Row: the cast at one common scale on a shared baseline, no captions (two rows from six figures).
 else if(state.layout==='row'){const list=state.cast,n=list.length,figs=list.map(d=>{const f=buildFigure(d,state);return {...f,box:f.ink};}),rowsN=n>5?2:1,per=Math.ceil(n/rowsN),bw=box[2]-box[0],bh=box[3]-box[1],gap=.6;
  const groups=Array.from({length:rowsN},(_,j)=>figs.slice(j*per,(j+1)*per)),widths=groups.map(g=>g.reduce((s,f)=>s+f.box[2]-f.box[0],0)+gap*(g.length-1)),tall=Math.max(...figs.map(f=>f.box[3]-f.box[1]));
  const s=Math.min(bw*.92/Math.max(...widths),bh*(rowsN>1?.4:.62)/tall)*p.scale;
  groups.forEach((g,j)=>{let x=(box[0]+box[2])/2-widths[j]*s/2;const base=rowsN>1?box[1]+bh*(j?.86:.42):box[1]+bh*.72;for(const f of g){const t={s,tx:x-f.box[0]*s,ty:base-f.box[3]*s};body+=put(f,t);note(f,t,list[figs.indexOf(f)].name);x+=(f.box[2]-f.box[0]+gap)*s;}});}
 // Crowd: rows of the cast overlapping, back rows smaller and higher, drawn back to front.
 else if(state.layout==='crowd'){const list=state.cast,n=list.length,rowsN=n<=3?1:n<=7?2:3,bw=box[2]-box[0],bh=box[3]-box[1],sizes=Array.from({length:rowsN},(_,j)=>Math.floor(n/rowsN)+(rowsN-1-j<n%rowsN?1:0));let k=0;
  const most=Math.max(...sizes),slot=Math.min(bw,bw/most*1.5);
  sizes.forEach((cnt,j)=>{const z=rowsN>1?.72+.28*j/(rowsN-1):1,base=rowsN>1?box[1]+bh*(.5+.5*j/(rowsN-1)):box[3],sh=bh*(rowsN>1?.56:1)*z,sw=slot*z;
   for(let i=0;i<cnt;i++,k++){const def=list[k],full=buildFigure(def,state),fig={...full,box:full.ink},cx=cnt>1?box[0]+sw/2+i*(bw-sw)/(cnt-1):(box[0]+box[2])/2,t=fitIn(fig,[cx-sw/2,base-sh,cx+sw/2,base],.96*p.scale);t.ty=base-fig.box[3]*t.s;body+=put(fig,t);note(fig,t,def.name);}});}
 else{const list=state.cast,n=list.length,lab=30,bw0=box[2]-box[0],bh0=box[3]-box[1],
  // v1 formats keep the v1 column rule; story and banner pick the column count that gives the largest slots.
  cols=state.format==='story'||state.format==='banner'?[...Array(n).keys()].map(k=>k+1).reduce((best,c)=>{const r=Math.ceil(n/c),sz=Math.min(bw0/c,bh0/r-lab);return sz>best[1]?[c,sz]:best;},[1,-1])[0]:n<=3?n:n===4?2:3,rows=Math.ceil(n/cols),sw=bw0/cols,sh=bh0/rows;
  list.forEach((def,i)=>{const fig=buildFigure(def,state),c=i%cols,r=Math.floor(i/cols),inRow=Math.min(cols,n-r*cols),ox=(cols-inRow)*sw/2,x0=box[0]+ox+c*sw,y0=box[1]+r*sh,t=fitIn(fig,[x0+sw*.07,y0+sh*.05,x0+sw*.93,y0+sh-lab-sh*.03],.95*p.scale);
   body+=put(fig,t);note(fig,t,def.name);if(st===4)body+=`<text x="${fx(x0+sw/2)}" y="${fx(y0+sh-12)}" text-anchor="middle" font-family="${SANS}" font-size="14" letter-spacing="1.4" fill="${ink}">${esc(def.name.toUpperCase())}</text>`;});}
 return {body,place,tiles,cells,overs,box};}
function copySVG(state,w,h,ink){const m=margin(w,h),lines=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,4).map(esc),t=esc(state.title),fit=(fs,avail,k)=>fx(Math.min(fs,avail/Math.max(1,state.title.length*k)));
 if(state.copy==='corner')return `<g font-family="${SANS}" fill="${ink}"><text x="${m}" y="${m+24}" font-size="${fit(27,w*.6,.56)}" font-weight="600" letter-spacing="-.3">${t}</text>${lines.map((l,i)=>`<text x="${m}" y="${m+58+i*19}" font-size="14.5">${l}</text>`).join('')}</g>`;
 if(state.copy==='serif')return `<g fill="${ink}" text-anchor="middle"><text x="${w/2}" y="${m+62}" font-family="${SERIF}" font-size="${fit(66,w-2*m,.62)}" letter-spacing="1">${t}</text><text x="${w/2}" y="${m+96}" font-family="${SANS}" font-size="12" letter-spacing="2.2">${lines.join(' · ').toUpperCase()}</text></g>`;
 if(state.copy==='vertical')return `<g fill="${ink}" transform="translate(${w-m-34} ${m}) rotate(90)"><text x="0" y="0" font-family="${HEAVY}" font-weight="800" font-size="${fit(44,h-2*m,.66)}" letter-spacing="3">${t}</text>${lines.map((l,i)=>`<text x="0" y="${24+i*17}" font-family="${SANS}" font-size="12.5" letter-spacing=".6">${l}</text>`).join('')}</g>`;
 // v2 restrained copy: a small tracked small-caps caption, or a Tanaka-style vertical column.
 if(state.copy==='caption'){const t2=esc(state.title.toUpperCase());return `<g fill="${ink}" font-family="${SANS}"><text x="${m}" y="${h-m+2}" font-size="12.5" font-weight="500" letter-spacing="2.6">${t2}</text><text x="${w-m}" y="${h-m+2}" font-size="9.5" letter-spacing="1.6" text-anchor="end">${lines.join('  ·  ').toUpperCase()}</text></g>`;}
 if(state.copy==='column'){const t2=esc(state.title.toUpperCase());return `<g fill="${ink}" transform="translate(${w-m-6} ${m}) rotate(90)"><text x="0" y="0" font-family="${SERIF}" font-size="${fit(17,h-2*m,.75)}" letter-spacing="5">${t2}</text>${lines.map((l,i)=>`<text x="0" y="${17+i*13}" font-family="${SANS}" font-size="9" letter-spacing="1.8">${l.toUpperCase()}</text>`).join('')}</g>`;}
 if(state.copy==='band')return `<g fill="${ink}"><text x="${m}" y="${h-m-6}" font-family="${HEAVY}" font-weight="800" font-size="${fit(48,w*.56,.66)}" letter-spacing="-.5">${t}</text><g font-family="${SANS}" font-size="12.5" text-anchor="end">${lines.map((l,i)=>`<text x="${w-m}" y="${h-m-6-(lines.length-1-i)*17}">${l}</text>`).join('')}</g></g>`;
 return '';}
export function render(input={},page){const state=resolve(input),[fw,fh]=FORMATS[state.format],w=page?.width??fw,h=page?.height??fh,uid='pk'+fnv(JSON.stringify(state)+w+'x'+h).toString(36),st=state.stage,colors=state.colors,ink=lineInk(colors),p=state.params;
 const ctx={uid,defs:'',fades:new Set(),riso:colors.map((_,i)=>[(hr(p.seed,'rx',i)-.5)*7,(hr(p.seed,'ry',i)-.5)*7])},lay=layoutBody(state,w,h,ctx);
 let ground=`<rect width="${w}" height="${h}" fill="${colors[0]}"/>`,over='';
 if(st===4&&state.ground==='gradient'){ctx.defs+=`<linearGradient id="${uid}-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${mix(colors[0],colors[8],.42)}"/></linearGradient>`;ground=`<rect width="${w}" height="${h}" fill="url(#${uid}-ground)"/>`;}
 if(st===4&&state.ground==='lattice'){const k=w/14;let d='';for(let x=k;x<w;x+=k)d+=`M${fx(x)} 0V${h}`;for(let y=k;y<h;y+=k)d+=`M0 ${fx(y)}H${w}`;ground+=`<path d="${d}" stroke="${mix(colors[0],ink,.16)}" stroke-width="1" fill="none"/>`;}
 if(st===4&&state.ground==='grain'){const [r,g,b]=rgb(mix(colors[0],ink,.75)).map(v=>fx(v/255));ctx.defs+=`<filter id="${uid}-grain" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="2" seed="${p.seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 3.2 0 0 0 -2"/></filter>`;over=`<rect width="${w}" height="${h}" filter="url(#${uid}-grain)" opacity=".42"/>`;}
 const neon=st===4&&(state.paint==='neon'||state.paint==='glow');if(neon)ctx.defs+=`<filter id="${uid}-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
 // Wallpaper runs under the copy; a ground plate keeps the copy readable.
 if(st===4&&state.layout==='wallpaper'&&state.copy!=='none'){const b=contentBox(state,w,h),m=margin(w,h),plate=state.copy==='band'?[0,b[3]+10,w,h-b[3]-10]:state.copy==='vertical'?[b[2]+6,0,w-b[2]-6,h]:[0,0,w,b[1]-12];over+=`<rect x="${fx(plate[0])}" y="${fx(plate[1])}" width="${fx(plate[2])}" height="${fx(plate[3])}" fill="${colors[0]}"/>`;}
 const names=[...new Set(lay.place.map(x=>x.name))],stageName=['construction grid','kit cells','figure with overlays','poster'][st-1],desc=`${names.join(', ')} — ${LABELS.layout[state.layout].toLowerCase()} in ${STYLES.find(s=>s.id===state.style).name}, ${LABELS.paint[state.paint].toLowerCase()}, ${stageName}. Primitive kit after Ikko Tanaka.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(desc)}"><title>Primitive kit figures — ${esc(names.join(', '))}</title>${ctx.defs?`<defs>${ctx.defs}</defs>`:''}${ground}${neon?`<g filter="url(#${uid}-glow)">${lay.body}</g>`:lay.body}${over}${st===4?copySVG(state,w,h,ink):''}</svg>`;
 const active=buildFigure(state.cast[state.active],state);
 return {svg,state,width:w,height:h,features:{style:state.style,layout:state.layout,paint:state.paint,stage:st,figures:names,shapes:lay.cells,overlays:lay.overs,tiles:lay.tiles,grid:[active.C,active.R],resolution:2**p.refine,symmetry:state.symmetry,vocab:state.vocab,placed:lay.place,box:lay.box}};}

// ── Small views: thumbnails, the editing canvas, the kit specimen ─────────
export function thumbnail(def,state,size=64){const fig=buildFigure(def,{...state,params:{...state.params,jitter:0}}),t=fitIn(fig,[size*.08,size*.08,size*.92,size*.92],1),ctx={uid:'th',defs:'',fades:new Set(),riso:[]};
 const body=paintFigure(fig,state,t.s,ctx,state.colors,3);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true"><rect width="${size}" height="${size}" fill="${state.colors[0]}"/>${ctx.defs?`<defs>${ctx.defs}</defs>`:''}<g transform="translate(${fx(t.tx)} ${fx(t.ty)}) scale(${fx(t.s)})">${body}</g></svg>`;}
// The authored grid of the active figure with hit cells (data-r, data-c) and
// overlay handles (data-o). Cells the symmetry derives are shaded.
export function editorSVG(state,{selected=-1,size=520,region=null}={}){const def=state.cast[state.active],src=parsed(def),R=src.cells.length,C=src.cells[0].length,asp=state.params.aspect;
 const view={...state,vocab:'all',params:{...state.params,refine:0,turn:0,jitter:0,warp:0,gap:0,round:0,features:state.params.features}},fig=buildFigure(def,view),pad=.25;
 const x0=Math.min(fig.box[0],0)-pad,y0=Math.min(fig.box[1],0)-pad,x1=Math.max(fig.box[2],C)+pad,y1=Math.max(fig.box[3],R*asp)+pad,s=size/(x1-x0),ctx={uid:'ed',defs:'',fades:new Set(),riso:[]},ink=lineInk(state.colors);
 let grid='';for(let c=0;c<=C;c++)grid+=`M${c} 0V${fx(R*asp)}`;for(let r=0;r<=R;r++)grid+=`M0 ${fx(r*asp)}H${C}`;let shade='',hits='',handles='';
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){if(derived(state.symmetry,r,c,R,C))shade+=`<rect x="${c}" y="${fx(r*asp)}" width="1" height="${fx(asp)}"/>`;hits+=`<rect class="hit" data-r="${r}" data-c="${c}" x="${c}" y="${fx(r*asp)}" width="1" height="${fx(asp)}"/>`;}
 src.over.forEach((o,i)=>{handles+=`<circle class="handle" data-o="${i}" cx="${fx(o.x)}" cy="${fx(o.y*asp)}" r="${fx(i===selected?.11:.07)}" fill="${i===selected?'#ff2bd6':'#ffffff'}" stroke="#111" stroke-width="${fx(1.5/s)}"/>`;});
 const art=paintFigure(fig,view,s,ctx,state.colors,3);
 const sel=region?(([r0,c0,r1,c1])=>`<rect class="region" x="${Math.min(c0,c1)}" y="${fx(Math.min(r0,r1)*asp)}" width="${Math.abs(c1-c0)+1}" height="${fx((Math.abs(r1-r0)+1)*asp)}" fill="#ff2bd6" fill-opacity=".12" stroke="#ff2bd6" stroke-width="${fx(2.5/s)}" stroke-dasharray="${fx(6/s)} ${fx(4/s)}"/>`)(region):'';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fx(x0)} ${fx(y0)} ${fx(x1-x0)} ${fx(y1-y0)}" width="${size}" height="${Math.round((y1-y0)*s)}" data-aspect="${asp}"><rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(x1-x0)}" height="${fx(y1-y0)}" fill="${state.colors[0]}"/>${ctx.defs?`<defs>${ctx.defs}</defs>`:''}${art}<g fill="${ink}" fill-opacity=".22">${shade}</g><path d="${grid}" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width="${fx(1/s)}"/><g fill="transparent">${hits}</g>${sel}${handles}</svg>`;}
// Every primitive in its four turns, then every overlay.
export function specimen(input={}){const state=resolve({...input,stage:3}),c=state.colors,ink=lineInk(c),cw=104,pad=30,w=pad*2+ORDER2.length*cw,oy=pad+4*cw+70,ow=w-2*pad,kinds=Object.entries(OVERLAYS).flatMap(([k,o])=>o.variants?o.variants.map(v=>k+'.'+v):[k]),per=Math.ceil(kinds.length/2),ocw=ow/per,h=oy+2*(ocw+34)+pad;
 const ctx={uid:'sp',defs:'',fades:new Set(),riso:[]};let body=`<rect width="${w}" height="${h}" fill="${c[0]}"/>`;
 [...ORDER2].forEach((p,i)=>{for(let r=0;r<4;r++){const x=pad+i*cw+12,y=pad+r*cw+12,u=cw-24,q=canon(p,r);body+=`<rect x="${x}" y="${y}" width="${u}" height="${u}" fill="none" stroke="${ink}" stroke-opacity=".25"/><path d="${pathD(mapCt(geo(p,q).cts,(a,b)=>[x+a*u,y+b*u]))}" fill="${c[[1,3,4,5,8,9][i%6]]}" fill-rule="evenodd"/>`;}
  body+=`<text x="${pad+i*cw+cw/2}" y="${pad+4*cw+18}" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="700" fill="${ink}">${p}</text><text x="${pad+i*cw+cw/2}" y="${pad+4*cw+38}" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="${ink}">${PRIMS[p].name}</text>`;});
 kinds.forEach((k,i)=>{const col=i%per,row=Math.floor(i/per),x=pad+col*ocw+ocw/2,y=oy+row*(ocw+34)+ocw/2,line=k==='line'?'line 0 0 e.7,-.5 t.08':k==='band'?'band 0 0 w1 h.4':k.startsWith('lip.beak')?`${k} 0 -.3 r.35`:`${k} 0 0`+(k.startsWith('brow')?' w.9':k.startsWith('eye')||k.startsWith('lip')||k.startsWith('cheek')||k.startsWith('hair')||k.startsWith('mon')?' r.32':k.startsWith('kuma')?' w.8':k==='stripes'?' w.9 h.6':k==='spike'?' w.8 h.2 n2':k==='lens'?' w.4 h.9':k==='tri'||k==='rect'?' w.7 h.7':' r.38'),o=parseOverlay(line),sc=ocw*.62;
  for(const sh of overlayShapes(o,1,1)){const cts=mapCt(sh.cts,(a,b)=>[x+a*sc,y+b*sc]);body+=sh.grad?`<path d="${pathD(cts)}" fill="${c[sh.c]}" fill-opacity=".6"/>`:`<path d="${pathD(cts)}" fill="${c[sh.c]}" fill-rule="evenodd"/>`;}
  body+=`<text x="${x}" y="${y+ocw/2+16}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${ink}">${k}</text>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${fx(h)}" viewBox="0 0 ${w} ${fx(h)}" role="img" aria-label="Primitive kit: twenty primitives in four turns, and the overlay shapes">${body}</svg>`;}

// ── Editing operations (pure; the editor keeps history) ────────────────────
// Painting a cell inside a merged block shrinks the block to its anchor cell.
function dissolveAt(cells,r,c){const own=owners(cells)[r]?.[c];if(!own)return;const [r0,c0]=own,t=cells[r0][c0];for(let j=r0;j<r0+t.k&&j<cells.length;j++)for(let i=c0;i<c0+t.k&&i<cells[0].length;i++)if(cells[j][i].cov)cells[j][i]={p:'.',r:0,c:0,b:0};cells[r0][c0]={...t,k:undefined};}
// `size` 2–4 paints one merged primitive spanning size × size cells; `mirror` mirrors the brush across the vertical axis whatever the symmetry mode.
export function paintCell(def,r,c,token,symmetry='none',{size=1,mirror=false}={}){const cells=parsed(def).cells.map(row=>row.map(t=>({...t}))),R=cells.length,C=cells[0].length,t0=typeof token==='string'?parseToken(token):token,done=new Set(),k=clamp(Math.round(size)||1,1,Math.min(4,R,C)),t={...t0,k:k>1&&t0.p!=='.'?k:undefined},n=t.k||1;
 r=clamp(r,0,R-n);c=clamp(c,0,C-n);
 const set=(rr,cc,x)=>{const key=rr+','+cc;if(rr<0||rr+n>R||cc<0||cc+n>C||done.has(key))return;done.add(key);for(let j=rr;j<rr+n;j++)for(let i=cc;i<cc+n;i++)dissolveAt(cells,j,i);cells[rr][cc]={...x};
  if(n>1)for(let j=rr;j<rr+n;j++)for(let i=cc;i<cc+n;i++)if(i!==cc||j!==rr)cells[j][i]={p:'.',r:0,c:0,b:0,cov:1};};
 set(r,c,t);if(SYM_X.includes(symmetry)||mirror)set(r,C-n-c,mirrorCell(t));if(symmetry==='flip'||symmetry==='quad')set(R-n-r,c,mirrorCell(t,'y'));if(symmetry==='quad'||symmetry==='point')set(R-n-r,C-n-c,mirrorCell(t,'xy'));
 return {...def,from:'custom',grid:cells.map(row=>row.map(tokenOf).join(' '))};}
export const cellAt=(def,r,c)=>parsed(def).cells[r]?.[c];
export function resizeFigure(def,op){const {cells:src,over}=parsed(def),cells=src.map(r=>r.map(t=>({...t}))),R=cells.length,C=cells[0].length,empty={p:'.',r:0,c:0,b:0};
 if(op==='narrow')for(let r=0;r<R;r++){dissolveAt(cells,r,0);dissolveAt(cells,r,C-1);}if(op==='shorter')for(let c=0;c<C;c++)dissolveAt(cells,R-1,c);
 let g=cells.map(r=>r.slice()),dx=0;
 if(op==='widen'&&C+2<=MAX_GRID){g=g.map(r=>[empty,...r,empty]);dx=1;}else if(op==='narrow'&&C>2){g=g.map(r=>r.slice(1,-1));dx=-1;}else if(op==='taller'&&R<MAX_GRID)g.push(Array(C).fill(empty));else if(op==='shorter'&&R>1)g.pop();else if(op==='clear')g=g.map(r=>r.map(()=>empty));else return def;
 return {...def,from:'custom',grid:g.map(r=>r.map(tokenOf).join(' ')),over:op==='clear'?[]:over.map(o=>overlayText({...o,x:o.x+dx,...(o.e?{e:[o.e[0]+dx,o.e[1]]}:{})}))};}

// ── Seeded generator: symmetric silhouettes quantised into kit cells ───────
const inEll=(x,y,cx,cy,rx,ry,a=0)=>{let dx=x-cx,dy=y-cy;if(a){const c=Math.cos(a),s=Math.sin(a);[dx,dy]=[dx*c+dy*s,-dx*s+dy*c];}return (dx/rx)**2+(dy/ry)**2<=1;};
const inPoly=(x,y,pts)=>insidePolys([pts],x,y);
export const GENERATORS=[{id:'face',name:'Face'},{id:'mask',name:'Mask'},{id:'butterfly',name:'Butterfly'},{id:'bird',name:'Bird'},{id:'flower',name:'Flower'},
 {id:'hannya',name:'Hannya mask'},{id:'okame',name:'Okame'},{id:'crane',name:'Crane'},{id:'rabbit',name:'Rabbit'},{id:'lantern',name:'Lantern'},{id:'fan',name:'Fan'},{id:'fox',name:'Fox'},{id:'daruma',name:'Daruma'}];
const KINDS={
 face(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+2,cx=cols/2,skin=pick([2,2,2,6,9,7]),hair=pick([1,1,1,4,8,5]),A=acc([skin,hair]);
  const frx=cols*(.25+.05*g()),fry=rows*(.25+.04*g()),fcy=rows*(.46+.04*g()),sy=fcy+fry*.92,style=pick(['cap','bob','bun','buns','long']),fringe=fcy-fry*(.32+.14*g()),halo=g()<.45,dx=x=>Math.abs(x-cx);
  const hairAt=(x,y)=>{const cap=inEll(x,y,cx,fcy-fry*.12,frx*1.2,fry*1.1)&&y<fcy+fry*.1;return style==='cap'?cap:style==='bob'?inEll(x,y,cx,fcy-fry*.05,frx*1.28,fry*1.12)&&y<fcy+fry*.62:style==='bun'?cap||inEll(x,y,cx,fcy-fry*1.28,frx*.58,frx*.54):style==='buns'?cap||inEll(dx(x),y,frx*.95,fcy-fry*1.02,frx*.5,frx*.5):(inEll(x,y,cx,fcy,frx*1.3,fry*1.15)&&y<fcy)||(dx(x)<frx*1.3&&y>=fcy&&y<sy+fry*.6);};
  const paint=(x,y)=>{if(inEll(x,y,cx,fcy,frx,fry)&&y>=fringe)return skin;if(dx(x)<frx*.36&&y>fcy&&y<sy+.5)return skin;if(hairAt(x,y))return hair;
   if(y>sy&&dx(x)<frx*1.15+(y-sy)*1.1)return dx(x)<(y-sy)*.62+frx*.14&&!CALM?A[1]:A[0];if(halo&&!CALM&&inEll(x,y,cx,fcy-fry*.3,frx*1.75,frx*1.75))return A[2];return -1;};
  const ey=fcy-fry*.04,ex=frx*.45,er=clamp(frx*.2,.12,.4),eye=pick(['kabuki','almond','round','dot','slit']),dark=hair===skin?1:hair,over=[];
  over.push(`eye.${eye} ${num(cx-ex)} ${num(ey)} r${num(er)}`+(eye==='kabuki'?` c3 d${dark}`:eye==='round'?' c2 d1':` c${dark}`)+' m');
  if(eye!=='kabuki'&&g()<.7&&ey-er*2.2>fringe+.12)over.push(`brow.${pick(['arc','moth','line'])} ${num(cx-ex)} ${num(ey-er*2.2)} w${num(er*2.6)} a${num((g()-.5)*24)} c${dark} m`);
  if(g()<.45)over.push(`tri ${num(cx)} ${num(fcy+fry*.22)} w${num(er*.75)} h${num(er*.8)} c${pick([1,3])}`);
  over.push(`lip.${pick(['bud','noh','bow','smile'])} ${num(cx)} ${num(fcy+fry*.56)} r${num(er*.95)} c${skin===9||skin===3?1:pick([3,3,1])}`);
  if(g()<.45)over.push(`disc ${num(cx-frx*.6)} ${num(fcy+fry*.26)} r${num(er*.72)} c${skin===9?3:9} m`);
  if(g()<.35)over.push(`disc ${num(cx-frx*1.04)} ${num(fcy+fry*.38)} r${num(er*.55)} c${A[3]} m`);
  return {cols,rows,paint,over,name:'Face'};},
 mask(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+1,cx=cols/2,face=pick([3,5,4,8,6,2,9]),A=acc([face,1]),top=rows*.24,bot=rows*.96,hw=cols*(.34+.06*g()),mid=rows*(.52+.1*g()),chin=pick(['point','round','square']),crown=pick(['horns','ears','flame','mane']);
  const half=y=>y<mid?hw:chin==='square'?hw*(1-.3*(y-mid)/(bot-mid)):chin==='round'?hw*Math.sqrt(Math.max(0,1-((y-mid)/(bot-mid))**2)):hw*(1-.92*(y-mid)/(bot-mid));
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(y>=top+.7*Math.max(0,dx/hw-.55)&&y<=bot&&dx<=half(y))return face;
   if(CALM)return crown==='mane'&&inEll(x,y,cx,(top+bot)/2,hw*1.32,(bot-top)*.6)?A[0]:-1;
   if(crown==='horns'&&inPoly(dx,y,[[hw*.42,top+.4],[hw*.86,top+.4],[hw*1.02,top-rows*.2]]))return A[0];
   if(crown==='ears'){if(inPoly(dx,y,[[hw*.45,top+.6],[hw*.95,top+.4],[hw*.88,top-rows*.19]]))return inPoly(dx,y,[[hw*.6,top+.4],[hw*.86,top+.3],[hw*.82,top-rows*.08]])?A[0]:face;}
   if(crown==='flame'&&(inPoly(dx,y,[[0,top+.3],[hw*.38,top+.3],[0,top-rows*.22]])||inPoly(dx,y,[[hw*.4,top+.3],[hw*.85,top+.3],[hw*.75,top-rows*.14]])))return A[0];
   if(crown==='mane'&&inEll(x,y,cx,(top+bot)/2,hw*1.32,(bot-top)*.6))return A[0];return -1;};
  const ey=top+(mid-top)*.62,ex=hw*.48,er=clamp(hw*.17,.12,.38),eye=pick(['round','slit','almond','round']),over=[];
  over.push(`eye.${eye} ${num(cx-ex)} ${num(ey)} r${num(er)}`+(eye==='round'?` c${face===6?2:6} d1`:` c${face===1?2:1}`)+' m');
  over.push(`brow.line ${num(cx-ex)} ${num(ey-er*1.9)} w${num(er*2.6)} t${num(er*.55)} a${num(14+g()*14)} c${face===1?2:1} m`);
  const my=bot-(bot-mid)*.45;over.push(`lip.smile ${num(cx)} ${num(my-.18)} r${num(hw*.36)} c${face===1?2:1}`);
  if(g()<.75)over.push(`tri ${num(cx-hw*.22)} ${num(my-.02)} w${num(hw*.14)} h${num(hw*.24)} a180 c2 m`);
  const cheek=pick(['ring','spike','stripes','none']);if(cheek==='ring')over.push(`ring ${num(cx-hw*.62)} ${num(mid+.1)} r${num(er*.9)} i.5 c${A[1]} m`);else if(cheek==='spike')over.push(`spike ${num(cx-hw*.62)} ${num(mid+.25)} w${num(hw*.36)} h${num(er*.4)} n2 a-70 c${A[1]} m`);else if(cheek==='stripes')over.push(`stripes ${num(cx-hw*.62)} ${num(mid+.15)} w${num(hw*.4)} h${num(er*1.2)} n3 a-12 c${A[1]} m`);
  if(g()<.6)over.push(`${pick(['disc','lens','quarter'])} ${num(cx)} ${num(top+.45)} r${num(er*.6)} w${num(er*.5)} h${num(er*1.4)} c${A[2]}`);
  return {cols,rows,paint,over,name:'Mask'};},
 butterfly(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+1,cx=cols/2,wing=pick([1,1,4,8,3,5]),A=acc([wing,1]),U=pick(['tri','round','sail']),Lw=pick(['tri','round']),inner=g()<.6;
  const up=U==='tri'?[[.08,rows*.5],[cols*.48,rows*.04],[cols*.42,rows*.6]]:U==='sail'?[[.08,rows*.46],[cols*.32,rows*.04],[cols*.5,rows*.22],[cols*.44,rows*.56]]:null,low=Lw==='tri'?[[.08,rows*.56],[cols*.38,rows*.6],[cols*.22,rows*.97]]:null;
  const shrink=(pts,k)=>{const mx=pts.reduce((s,p)=>s+p[0],0)/pts.length,my=pts.reduce((s,p)=>s+p[1],0)/pts.length;return pts.map(([x,y])=>[mx+(x-mx)*k,my+(y-my)*k]);};
  const inUp=(dx,y,k=1)=>up?inPoly(dx,y,shrink(up,k)):inEll(dx,y,cols*.27,rows*.3,cols*.23*k,rows*.27*k),inLow=(dx,y,k=1)=>low?inPoly(dx,y,shrink(low,k)):inEll(dx,y,cols*.21,rows*.72,cols*.17*k,rows*.21*k);
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(inUp(dx,y))return inner&&inUp(dx,y,.5)?A[0]:wing;if(inLow(dx,y))return inner&&inLow(dx,y,.45)?A[0]:wing;return -1;};
  const over=[`rect ${num(cx)} ${num(rows*.53)} w.26 h${num(rows*.6)} c1`,`disc ${num(cx)} ${num(rows*.2)} r.2 c1`,`line ${num(cx-.06)} ${num(rows*.18)} e${num(cx-.75)},${num(rows*.03)} t.04 c1 m`,`disc ${num(cx-.75)} ${num(rows*.03)} r.08 c1 m`];
  const spots=[];for(let tries=0;spots.length<3&&tries<200;tries++){const x=g()*cx,y=g()*rows,dx=cx-x;if(dx>.45&&(inUp(dx,y,.8)||inLow(dx,y,.7))&&spots.every(([a,b])=>Math.hypot(a-x,b-y)>.9))spots.push([x,y]);}
  for(const [x,y] of spots){const c=pick(A.slice(1,5)),k=pick(['ring','disc','stripes','spike','rect']);over.push(k==='ring'?`ring ${num(x)} ${num(y)} r.3 i.5 c${c} m`:k==='disc'?`disc ${num(x)} ${num(y)} r.2 c${c} m`:k==='stripes'?`stripes ${num(x)} ${num(y)} w.8 h.32 n3 a${num(20+g()*20)} c${c} m`:k==='spike'?`spike ${num(x)} ${num(y)} w.62 h.14 n2 a${num(-120+g()*60)} c${c} m`:`rect ${num(x)} ${num(y)} w.24 h.24 c${c} m`);}
  return {cols,rows,paint,over,name:'Butterfly'};},
 bird(g,size,pick,acc){const cols=[6,8,10][size],rows=cols,cx=cols/2,body=pick([1,4,8,3,5]),A=acc([body]),chest=pick([2,6,9,7].filter(c=>c!==body)),hy=rows*.2,hrad=cols*.1,tip=g()<.6?rows*.1:rows*.3,band=rows*.1;
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(inEll(x,y,cx,hy,hrad,hrad))return body;if(inEll(x,y,cx,rows*.52,cols*.13,rows*.25))return inEll(x,y,cx,rows*.57,cols*.08,rows*.15)?chest:body;
   for(let k=0;k<3;k++)if(inPoly(dx,y,[[cols*.08,rows*.38+k*band],[cols*.48-k*cols*.05,tip+k*band*.85],[cols*.48-k*cols*.05,tip+(k+1)*band*.85],[cols*.08,rows*.38+(k+1)*band]]))return [A[0],body,A[1]][k];
   if(y>rows*.72&&y<rows*.97&&dx<(y-rows*.72)*.8+.12)return A[0];return -1;};
  const over=[`disc ${num(cx-hrad*.45)} ${num(hy-.05)} r${num(hrad*.2)} c2 m`,`disc ${num(cx-hrad*.45)} ${num(hy-.05)} r${num(hrad*.1)} c1 m`,`lip.beak ${num(cx)} ${num(hy+hrad*.45)} r${num(hrad*.55)} c6`,`line ${num(cx-.22)} ${num(rows*.76)} e${num(cx-.45)},${num(rows*.93)} t.07 c1 m`];
  if(g()<.6)over.push(`tri ${num(cx)} ${num(hy-hrad*1.2)} w${num(hrad*.7)} h${num(hrad*.8)} c${A[2]}`);return {cols,rows,paint,over,name:'Bird'};},
 flower(g,size,pick,acc){const cols=[5,7,9][size],rows=cols+3,cx=cols/2,R=cols*(.14+.03*g()),cy=R*2.9+.15,n=pick([4,5,6,8]),petal=pick([3,9,8,4,7,2]),centre=pick([6,6,3,1].filter(c=>c!==petal)),pot=g()<.5?pick([4,3,8,1].filter(c=>c!==petal)):-1,A=acc([petal,centre,5]);
  const paint=(x,y)=>{if(inEll(x,y,cx,cy,R,R))return centre;for(let k=0;k<n;k++){const a=-Math.PI/2+2*Math.PI*k/n;if(inEll(x,y,cx+Math.cos(a)*R*1.8,cy+Math.sin(a)*R*1.8,R*1.1,R*.75,a))return petal;}
   const dx=Math.abs(x-cx);if(inEll(dx,y,1.05,(cy+R*2.9+rows-2)/2,1,.4,-.5))return 5;if(pot>=0&&y>rows-2&&dx<1.45-(y-rows+2)*.28)return pot;return -1;};
  const stemEnd=pot>=0?rows-2:rows-.1,over=[`rect ${num(cx)} ${num((cy+stemEnd)/2)} w.2 h${num(stemEnd-cy)} c5`,`ring ${num(cx)} ${num(cy)} r${num(R*.62)} i.5 c${A[0]}`];if(g()<.5)over.push(`disc ${num(cx-cols*.38)} ${num(rows*.08)} r.32 c${A[1]} m`);return {cols,rows,paint,over,name:'Flower'};},
 // v2 kinds.
 hannya(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+2,cx=cols/2,face=pick([2,6,5,9,2]),horn=pick([6,2,7].filter(c=>c!==face)),A=acc([face,horn,1]),top=rows*(.26+.04*g()),mid=rows*(.6+.05*g()),bot=rows*.97,hw=cols*(.38+.05*g());
  const half=y=>y<mid?hw:hw*(1-.55*(y-mid)/(bot-mid));
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(y>=top+.6*Math.max(0,dx/hw-.6)/.4&&y<=bot&&dx<=half(y))return face;if(!CALM&&inPoly(dx,y,[[hw*.3,top+.4],[hw*.72,top+.4],[hw*1.12,top-rows*.1],[hw*1.02,top-rows*.24],[hw*.82,top-rows*.04]]))return horn;
   if(inEll(x,y,cx,top+.45,hw*1.12,rows*.17)&&y<top+.9)return 1;return -1;};
  const ey=top+(mid-top)*.48,ex=hw*.44,er=clamp(hw*.19,.14,.42),my=bot-(bot-mid)*.5;
  return {cols,rows,paint,name:'Hannya',over:[`eye.round ${num(cx-ex)} ${num(ey)} r${num(er)} c${horn} d1 m`,`brow.flick ${num(cx-ex)} ${num(ey-er*1.7)} w${num(er*2.8)} t${num(er*.42)} a26 c1 m`,`cheek.swirl ${num(cx-hw*.62)} ${num(mid-.05)} r${num(er*.7)} c${A[0]} m`,
   `lip.grin ${num(cx)} ${num(my-.25)} r${num(hw*.6)} c1 d2`,`tri ${num(cx-hw*.42)} ${num(my-.32)} w${num(hw*.16)} h${num(hw*.3)} a180 c2 m`,`tri ${num(cx-hw*.3)} ${num(my+.18)} w${num(hw*.13)} h${num(hw*.24)} c2 m`,`half ${num(cx)} ${num(ey+er*1.4)} r${num(er*.6)} c1`]};},
 okame(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+1,cx=cols/2,skin=pick([2,2,9,6]),A=acc([skin,1]),fcy=rows*(.56+.03*g()),frx=cols*(.4+.04*g()),fry=rows*(.39+.03*g()),part=.25+.2*g();
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(inEll(x,y,cx,fcy-fry*.35,frx*1.04,fry*.85)&&y<fcy-fry*.45&&dx>(y-(fcy-fry*1.25))*part)return 1;if(inEll(x,y,cx,fcy,frx,fry))return skin;if(y>fcy+fry*.75&&dx<frx*.9)return A[0];return -1;};
  const ey=fcy-fry*.05,ex=frx*.4,er=clamp(frx*.17,.12,.36);
  return {cols,rows,paint,name:'Okame',over:[`eye.${pick(['closed','slit','closed'])} ${num(cx-ex)} ${num(ey)} r${num(er)} c1 m`,`brow.moth ${num(cx-ex*1.05)} ${num(fcy-fry*.42)} w${num(er*2)} c1 m`,`cheek.blush ${num(cx-frx*.58)} ${num(fcy+fry*.22)} r${num(er*1.25)} c${skin===9?3:9} m`,
   `lip.bud ${num(cx)} ${num(fcy+fry*.5)} r${num(er*.6)} c3`,`disc ${num(cx)} ${num(fcy+fry*.2)} r${num(er*.22)} c${skin===9?3:9}`]};},
 crane(g,size,pick,acc){const cols=[6,8,10][size],rows=cols,cx=cols/2,white=pick([2,2,7,6]),tip=pick([1,1,4,8]),A=acc([white,tip]),wy=rows*(.3+.08*g()),span=cols*(.47+.02*g()),lift=g()<.5?rows*.12:0;
  const wing=[[cols*.07,rows*.34],[span,wy-lift],[span*.97,wy-lift+rows*.17],[cols*.08,rows*.64]],trail=(dx,y)=>{const f=(dx-cols*.08)/(span*.97-cols*.08),yb=rows*.64+f*(wy-lift+rows*.17-rows*.64);return y>yb-rows*.07;};
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(inEll(x,y,cx,rows*.15,cols*.08,cols*.08))return white;if(dx<cols*.06&&y>rows*.18&&y<rows*.38)return 1;
   if(inPoly(dx,y,wing))return dx>span*.72||trail(dx,y)?tip:white;if(inEll(x,y,cx,rows*.5,cols*.12,rows*.2))return white;if(inPoly(dx,y,[[0,rows*.64],[cols*.12,rows*.64],[0,rows*.86]]))return tip;return -1;};
  return {cols,rows,paint,name:'Crane',over:[`disc ${num(cx)} ${num(rows*.085)} r${num(cols*.05)} c3`,`lip.beak ${num(cx)} ${num(rows*.19)} r${num(cols*.05)} c${A[0]}`,`disc ${num(cx-cols*.03)} ${num(rows*.145)} r${num(cols*.016)} c1 m`,`line ${num(cx-cols*.04)} ${num(rows*.68)} e${num(cx-cols*.09)},${num(rows*.97)} t.07 c1 m`]};},
 rabbit(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+2,cx=cols/2,fur=pick([2,2,6,7,9]),A=acc([fur,1]),inner=fur===9?3:9,ear=cols*(.15+.03*g()),hy=rows*(.52+.03*g()),pose=pick(['up','splay','short']),bow=g()<.5;
  // Ears stand up, splay outward or stay short; members of a family differ here.
  const ey=pose==='short'?rows*.3:rows*.24,ery=pose==='short'?rows*.12:rows*.18,ea=pose==='splay'?.38:0,ex=pose==='splay'?ear*1.25:ear;
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(inEll(dx,y,ex,ey,cols*.075,ery,ea))return inEll(dx,y,ex,ey+rows*.02,cols*.035,ery*.72,ea)?inner:fur;if(inEll(x,y,cx,hy,cols*.3,rows*.2))return fur;if(inEll(x,y,cx,rows*.86,cols*.36,rows*.16))return y>rows*.9&&dx<cols*.12?A[0]:fur;return -1;};
  return {cols,rows,paint,name:'Rabbit',over:[`eye.dot ${num(cx-cols*.13)} ${num(hy-rows*.03)} r${num(cols*.06)} c${pick([1,3])} m`,`tri ${num(cx)} ${num(hy+rows*.06)} w${num(cols*.07)} h${num(cols*.05)} a180 c${inner}`,`line ${num(cx)} ${num(hy+rows*.08)} e${num(cx-cols*.06)},${num(hy+rows*.12)} t.04 c1 m`,`line ${num(cx-cols*.12)} ${num(hy+rows*.07)} e${num(cx-cols*.38)},${num(hy+rows*.03)} t.03 c1 m`,`cheek.blush ${num(cx-cols*.2)} ${num(hy+rows*.07)} r${num(cols*.045)} c${inner} m`,...(bow?[`tri ${num(cx-cols*.07)} ${num(hy+rows*.2)} w${num(cols*.12)} h${num(cols*.14)} a-90 c${A[1]} m`,`disc ${num(cx)} ${num(hy+rows*.2)} r${num(cols*.035)} c${A[1]}`]:[])]};},
 lantern(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+2,cx=cols/2,body=pick([3,3,6,2,9]),cap=1,A=acc([body,1]),hw=cols*(.4+.04*g()),cy=rows*.5,ry=rows*(.32+.02*g());
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(dx<cols*.24&&((y>cy-ry-rows*.07&&y<cy-ry+rows*.03)||(y>cy+ry-rows*.03&&y<cy+ry+rows*.07)))return cap;if(inEll(x,y,cx,cy,hw,ry))return body;return -1;};
  const over=[];for(let k=-2;k<=2;k++){const y=cy+k*ry*.36,half=hw*Math.sqrt(1-(k*.36)**2)*.96;over.push(`line ${num(cx-half)} ${num(y)} e${num(cx+half)},${num(y)} t.03 c${body===1?2:1}`);}
  over.push(`mon.${pick(['flower','wheel','diamond'])} ${num(cx)} ${num(cy)} r${num(hw*.38)} c${A[0]} d${A[1]}`,`ring ${num(cx)} ${num(cy-ry-rows*.12)} r${num(cols*.06)} i.55 c1`,`tri ${num(cx)} ${num(cy+ry+rows*.13)} w${num(cols*.1)} h${num(rows*.08)} c${A[0]}`);
  return {cols,rows,paint,over,name:'Lantern'};},
 fan(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+1,cx=cols/2,A=acc([1]),sensu=g()<.5,over=[];let paint;
  if(sensu){const py=rows*.88,R2=cols*.5,n=pick([5,7,9]);paint=(x,y)=>{const dx=x-cx,dy=y-py,d=Math.hypot(dx,dy);if(dy<.02&&d<R2)return d>R2*.66?A[0]:d>R2*.3?A[1]:A[2];return -1;};
   for(let k=1;k<n;k++){const an=Math.PI*k/n;over.push(`line ${num(cx)} ${num(py)} e${num(cx+Math.cos(an)*R2*.97)},${num(py-Math.sin(an)*R2*.97)} t.035 c1`);}over.push(`disc ${num(cx)} ${num(py)} r${num(cols*.05)} c1`,`disc ${num(cx)} ${num(py-R2*.5)} r${num(cols*.08)} c3`);}
  else{const cy=rows*.42,R=cols*.44,pat=pick(['waves','sun','split']),sr=R*(.3+.16*g()),sy=cy-R*(.05+.2*g());
   paint=(x,y)=>{if(!inEll(x,y,cx,cy,R,R))return -1;if(inEll(x,y,cx,sy,sr,sr))return 3;return pat==='split'?(y<cy?A[0]:A[1]):pat==='waves'&&y>cy+R*.25?A[1]:A[0];};
   over.push(`rect ${num(cx)} ${num((cy+R+rows)/2)} w.22 h${num(rows-cy-R)} c6`,`ring ${num(cx)} ${num(cy)} r${num(R*1.02)} i.94 c1`);if(pat==='waves')for(let k=0;k<3;k++)over.push(`half ${num(cx-R*.5+k*R*.5)} ${num(cy+R*.5)} r${num(R*.25)} c${A[2]}`);else if(pat==='sun')over.push(`ring ${num(cx)} ${num(sy)} r${num(sr*1.35)} i.88 c${A[2]}`);}
  return {cols,rows,paint,over,name:sensu?'Folding fan':'Round fan'};},
 fox(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+1,cx=cols/2,fur=pick([6,3,6,2]),A=acc([fur,1,2]),top=rows*.3,bot=rows*.95,hw=cols*(.42+.04*g());
  const half=y=>hw*Math.max(0,1-((y-top)/(bot-top))**1.25*.88);
  const paint=(x,y)=>{const dx=Math.abs(x-cx);if(inPoly(dx,y,[[hw*.28,top+.3],[hw*.92,top+.25],[hw*.86,top-rows*.24]]))return inPoly(dx,y,[[hw*.45,top+.2],[hw*.8,top+.15],[hw*.78,top-rows*.12]])?1:fur;
   if(y>=top&&y<=bot&&dx<=half(y))return y>top+(bot-top)*.42+dx*.2?2:fur;return -1;};
  const ey=top+(bot-top)*.32,eye=pick(['slit','almond','closed']),mark=pick(['sweep','flame','tear']);return {cols,rows,paint,name:'Fox',over:[`eye.${eye} ${num(cx-hw*.42)} ${num(ey)} r${num(hw*.2)} a${eye==='slit'?-18:0} c1 m`,`half ${num(cx)} ${num(bot-rows*.04)} r${num(hw*.14)} a180 c1`,mark==='flame'?`kuma.flame ${num(cx)} ${num(top+.5)} w${num(hw*.4)} c${A[0]}`:`kuma.${mark} ${num(cx+hw*.55)} ${num(ey-.1)} w${num(hw*.5)} a${mark==='tear'?160:-30} c${A[0]} m`,`lens ${num(cx)} ${num(top+.35)} w${num(hw*.12)} h${num(hw*.4)} c${A[1]}`]};},
 daruma(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+1,cx=cols/2,body=pick([3,3,1,6,4]),A=acc([body,2,1]),fy=rows*(.38+.07*g()),frx=cols*(.23+.07*g()),fry=rows*(.17+.05*g()),wish=pick(['left','none','both']);
  const paint=(x,y)=>{if(inEll(x,y,cx,fy,frx,fry))return 2;if(inEll(x,y,cx,rows*.55,cols*.46,rows*.44))return body;return -1;};
  // A daruma's eyes are painted in as wishes come true: none, the left one, or both.
  const er=cols*.07,eye=(x,on)=>on?`eye.round ${num(x)} ${num(fy-rows*.02)} r${num(er)} c2 d1`:`ring ${num(x)} ${num(fy-rows*.02)} r${num(er)} i.84 c1`;
  return {cols,rows,paint,name:'Daruma',over:[`brow.arc ${num(cx-cols*.13)} ${num(fy-rows*.1)} w${num(cols*.2)} t${num(er*.9)} a${num(-14+g()*12)} c1 m`,eye(cx-cols*.12,wish!=='none'),eye(cx+cols*.12,wish==='both'),
   `stripes ${num(cx-cols*.17)} ${num(fy+rows*.08)} w${num(cols*.12)} h${num(rows*.1)} n3 a-28 c1 m`,`lip.smile ${num(cx)} ${num(fy+rows*.1)} r${num(er*.7)} c3`,`stripes ${num(cx)} ${num(rows*.83)} w${num(cols*.36)} h${num(rows*.08)} n2 c${A[0]}`]};}
};
// Families share the first draws (palette and proportions) and vary the rest.
const FAMK={face:11,mask:8,butterfly:8,bird:7,flower:3,hannya:7,okame:5,crane:6,rabbit:8,lantern:6,fan:7,fox:7,daruma:1};
// Generated figures avoid the concave cove and arch, the ring, quarter ring and dot: they scallop outlines.
const GEN_PRIMS='STQHBDLKW';
// Calm generation (the v2 default): neutral features — no brows, cheeks, kumadori,
// fangs, noses, whiskers, blush, horns or pupils — and at most three cell colours.
let CALM=false;const FACELIKE=['face','mask','hannya','okame','rabbit','fox','daruma'];
function calmOver(kind,l){const o=parseOverlay(l),face=FACELIKE.includes(kind);if(['brow','cheek','kuma'].includes(o.k)||(o.k==='hair'&&o.v==='pin'))return null;
 if(face&&(['tri','stripes','disc','half','spike'].includes(o.k)||(o.k==='ring'&&kind!=='daruma')||(o.k==='line'&&(o.t??.04)<=.045)))return null;
 if(o.k==='eye'&&o.v==='closed')return overlayText({k:'eye',v:'slit',x:o.x,y:o.y,r:o.r,c:o.c,m:o.m});
 if(o.k==='eye'&&['round','wide','side','sleepy','kabuki'].includes(o.v))return overlayText({k:'eye',v:'dot',x:o.x,y:o.y,r:(o.r??.15)*.8,c:o.v==='kabuki'?(o.d??1):(o.d??1),m:o.m});
 if(o.k==='lip'&&o.v!=='beak')return overlayText({k:'lip',v:'bud',x:o.x,y:o.y,r:Math.min(.24,(o.r??.15)*.6),c:o.c===1?1:3});return l;}
function calmCells(cells){const count=new Map();for(const row of cells)for(const t of row){if(t.p!=='.')count.set(t.c,(count.get(t.c)||0)+1);if(t.b)count.set(t.b,(count.get(t.b)||0)+1);}
 const keep=[...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]),main=keep[0]??1,to=c=>keep.includes(c)?c:main;
 return cells.map(row=>row.map(t=>{const u={...t,c:t.p==='.'?t.c:to(t.c),b:t.b?to(t.b):0};if(u.b&&u.b===u.c&&u.p!=='.')return {p:'S',r:0,c:u.c,b:0,...(t.k?{k:t.k}:{})};return u;}));}
function generateWith(kind,g,size,calm=false){CALM=calm;try{return generateRaw(kind,g,size,calm);}finally{CALM=false;}}
function generateRaw(kind,g,size,calm){const pick=a=>a[Math.floor(g()*a.length)],acc=avoid=>{const a=[3,4,5,6,7,8,9,2].filter(c=>!avoid.includes(c));for(let i=a.length-1;i>0;i--){const j=Math.floor(g()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const f=KINDS[kind](g,size,pick,acc);let cells=quantize(f.paint,f.cols,f.rows,{sym:true,prims:GEN_PRIMS});if(calm)cells=calmCells(cells);
 const over=f.over.map(l=>overlayText(parseOverlay(l)));return {f,grid:cells.map(r=>r.map(tokenOf).join(' ')),over:calm?over.map(l=>calmOver(kind,l)).filter(Boolean):over};}
const genArgs=(kind,seed,size)=>{if(!KINDS[kind])throw new Error(`Generate a ${GENERATORS.map(k=>k.id).join(', ')}.`);return [clamp(Math.round(+seed||1),1,99999),clamp(Math.round(+size),0,2)];};
// `calm` (the editor default) removes cartoon features; the expressive generator keeps the legacy `gen:` references.
export function generate(kind,seed,size=1,{calm=false}={}){[seed,size]=genArgs(kind,seed,size);const {f,grid,over}=generateWith(kind,rng(fnv(kind+':'+seed+':'+size)),size,calm);return {name:`${f.name} ${seed}`,from:`${calm?'calm':'gen'}:${kind}:${seed}:${size}`,grid,over};}
// Member i of the family `seed`: shared palette and proportions, its own features.
export function generateMember(kind,seed,i,size=1,{calm=false}={}){[seed,size]=genArgs(kind,seed,size);i=clamp(Math.round(+i||0),0,99);const f0=rng(fnv(kind+':family:'+seed+':'+size)),m=rng(fnv(kind+':member:'+seed+':'+i+':'+size)),K=FAMK[kind];let n=0;
 const {f,grid,over}=generateWith(kind,()=>n++<K?f0():m(),size,calm);return {name:`${f.name} ${seed}·${i+1}`,from:`${calm?'calmfam':'fam'}:${kind}:${seed}:${i}:${size}`,grid,over};}
export const generateFamily=(kind,seed,count=6,size=1,opts={})=>Array.from({length:clamp(Math.round(count),1,MAX_CAST)},(_,i)=>generateMember(kind,seed,i,size,opts));
// A primitive as a small icon (brush buttons in the editor).
export function primSVG(p,r,fill,bg,size=28){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.08 -.08 1.16 1.16" width="${size}" height="${size}" aria-hidden="true"><rect x="0" y="0" width="1" height="1" fill="${bg}"/>${p==='.'?'':`<path d="${pathD(geo(p,canon(p,r)).cts)}" fill="${fill}" fill-rule="evenodd"/>`}</svg>`;}

// ── Image → figure ─────────────────────────────────────────────────────────
// Each sample takes the palette colour nearest (in OKLab) to the image's mean
// colour over its area; the ground colour reads as empty. The quantiser then
// fits every cell with its best two-colour primitive.
const lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
export function oklab([r,g,b]){r=lin(r);g=lin(g);b=lin(b);const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
export function imageFigure(data,w,h,{cols=8,rows=10,colors=PALETTES[0].colors,use=[0,1,2,3,4,5,6,7,8,9],prims=ORDER,sym=false,name='Image figure'}={}){
 cols=clamp(Math.round(cols),1,MAX_GRID);rows=clamp(Math.round(rows),1,MAX_GRID);const pal=use.map(i=>[i,oklab(rgb(colors[i]))]),bg=rgb(colors[0]),SW=cols*QN,SH=rows*QN,idx=new Int8Array(SW*SH);
 for(let j=0;j<SH;j++)for(let i=0;i<SW;i++){const x0=Math.floor(i*w/SW),x1=Math.max(x0+1,Math.floor((i+1)*w/SW)),y0=Math.floor(j*h/SH),y1=Math.max(y0+1,Math.floor((j+1)*h/SH));let R=0,G=0,B=0,n=0;
  for(let y=y0;y<y1&&y<h;y++)for(let x=x0;x<x1&&x<w;x++){const o=(y*w+x)*4,a=data[o+3]/255;R+=data[o]*a+bg[0]*(1-a);G+=data[o+1]*a+bg[1]*(1-a);B+=data[o+2]*a+bg[2]*(1-a);n++;}
  const lab=oklab([R/n,G/n,B/n]);let best=0,bd=1e9;for(const [k,q] of pal){const d=(lab[0]-q[0])**2+(lab[1]-q[1])**2+(lab[2]-q[2])**2;if(d<bd){bd=d;best=k;}}idx[j*SW+i]=best===0?-1:best;}
 const cells=quantize((x,y)=>idx[Math.min(SH-1,Math.floor(y*QN))*SW+Math.min(SW-1,Math.floor(x*QN))],cols,rows,{prims,sym});
 return {name:cleanName(name),from:'image',grid:cells.map(r=>r.map(tokenOf).join(' ')),over:[]};}
// ── Series: one rule, 2–6 posters ──────────────────────────────────────────
// Each poster stars the next cast figure in the same layout and type, with
// the accent colours turned on by one step and a running number.
export function series(input={},n=4){const base=resolve(input),N=clamp(Math.round(+n||4),2,6),layout=base.layout==='cast'||base.layout==='crowd'?'hero':base.layout;
 return Array.from({length:N},(_,i)=>resolve({...base,layout,active:i%base.cast.length,colors:i?shift(base.colors,i*2):base.colors,info:`${base.info} / ${i+1} of ${N}`.slice(0,140),stage:4}));}
export function seriesSheet(input={},n=4){const list=series(input,n),r0=render(list[0]),gap=Math.round(r0.width*.06),W2=list.length*r0.width+(list.length+1)*gap,H2=r0.height+2*gap;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H2}" viewBox="0 0 ${W2} ${H2}" role="img" aria-label="A series of ${list.length} posters from one rule"><rect width="${W2}" height="${H2}" fill="#e9e8e3"/>${list.map((st,i)=>render(st).svg.replace('<svg ',`<svg x="${gap+i*(r0.width+gap)}" y="${gap}" `)).join('')}</svg>`;}
// ── Editor operations on regions (pure) ────────────────────────────────────
// Fill the 4-connected cells that share the clicked cell's token.
export function fillCells(def,r,c,token,symmetry='none',opts={}){const cells=parsed(def).cells,R=cells.length,C=cells[0].length,target=tokenOf(cells[r]?.[c]??{p:'.',r:0,c:0,b:0}),seen=new Set(),stack=[[r,c]],hit=[];
 while(stack.length){const [y,x]=stack.pop(),k=y+','+x;if(y<0||x<0||y>=R||x>=C||seen.has(k))continue;seen.add(k);const t=cells[y][x];if(tokenOf(t)!==target||t.k>1||t.cov)continue;hit.push([y,x]);stack.push([y+1,x],[y-1,x],[y,x+1],[y,x-1]);}
 let d=def;for(const [y,x] of hit)d=paintCell(d,y,x,token,symmetry,{mirror:opts.mirror});return d;}
const rectOf=([r0,c0,r1,c1],R,C)=>[clamp(Math.min(r0,r1),0,R-1),clamp(Math.min(c0,c1),0,C-1),clamp(Math.max(r0,r1),0,R-1),clamp(Math.max(c0,c1),0,C-1)];
// flipX, flipY, turn (half turn), shuffle (seeded quarter turns), recolour (next colour), clear.
export const REGION_OPS=['flipX','flipY','turn','shuffle','recolour','clear'];
export function regionOp(def,rect,op,{seed=1}={}){const src=parsed(def).cells,cells=src.map(r=>r.map(t=>({...t}))),R=cells.length,C=cells[0].length,[r0,c0,r1,c1]=rectOf(rect,R,C);
 for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)dissolveAt(cells,r,c);const B=[];for(let r=r0;r<=r1;r++)B.push(cells[r].slice(c0,c1+1).map(t=>({...t})));const h=B.length,w=B[0].length;
 for(let i=0;i<h;i++)for(let j=0;j<w;j++){let t;if(op==='flipX')t=mirrorCell(B[i][w-1-j],'x');else if(op==='flipY')t=mirrorCell(B[h-1-i][j],'y');else if(op==='turn')t=mirrorCell(B[h-1-i][w-1-j],'xy');
  else if(op==='shuffle'){const u=B[i][j];t=u.p==='.'?u:{...u,r:canon(u.p,u.r+Math.floor(hr(seed,'sh',i,j)*4))};}else if(op==='recolour'){const u=B[i][j];t=u.p==='.'?{...u,b:u.b?u.b%9+1:0}:{...u,c:u.c%9+1};}else if(op==='clear')t={p:'.',r:0,c:0,b:0};else throw new Error(`Unknown region operation “${op}”.`);
  cells[r0+i][c0+j]=t;}
 return {...def,from:'custom',grid:cells.map(row=>row.map(tokenOf).join(' '))};}
export function copyRegion(def,rect){const cells=parsed(def).cells,[r0,c0,r1,c1]=rectOf(rect,cells.length,cells[0].length);return cells.slice(r0,r1+1).map(row=>row.slice(c0,c1+1).map(t=>tokenOf({...t,k:undefined,cov:undefined})));}
export function pasteRegion(def,r,c,rows){const cells=parsed(def).cells.map(row=>row.map(t=>({...t}))),R=cells.length,C=cells[0].length;
 rows.forEach((row,i)=>row.forEach((tok,j)=>{const y=r+i,x=c+j;if(y<0||x<0||y>=R||x>=C)return;dissolveAt(cells,y,x);const t=parseToken(tok);delete t.k;delete t.cov;cells[y][x]=t;}));
 return {...def,from:'custom',grid:cells.map(row=>row.map(tokenOf).join(' '))};}
