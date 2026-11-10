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
export const ENGINE='primitive-kit-v1';
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
 P:{name:'Dot',kind:'sym',cts:[circle(.5,.5,.22)]}
};
export const ORDER='STQCHNBDOLKWAP';
export const VOCABS=[
 {id:'all',name:'Full kit',prims:ORDER,note:'All fourteen primitives.'},
 {id:'tanaka',name:'Tanaka four',prims:'STQDB',note:'Square, half square, triangle, quarter disc and disc — the Nihon Buyo kit.'},
 {id:'angular',name:'Angles only',prims:'STBKW',note:'Straight edges: square, half square, triangle, diamond, wedge.'},
 {id:'curved',name:'Curves only',prims:'SQCHNDOLAP',note:'Every cut is an arc: quarters, coves, halves, arches, discs, rings, leaves.'},
 {id:'pixel',name:'Pixels',prims:'S',note:'Squares only; each cell keeps its majority colour.'}
];
export const canon=(p,r)=>p==='.'||PRIMS[p].kind==='sym'?0:p==='L'?((r%2)+2)%2:((r%4)+4)%4;
const rotPt=(x,y,q)=>{for(let i=0;i<q;i++)[x,y]=[1-y,x];return [x,y];};
const GEO={};
function geo(p,r){const k=p+r;if(!GEO[k]){const cts=mapCt(PRIMS[p].cts,(x,y)=>rotPt(x,y,r));GEO[k]={cts,polys:flatten(cts)};}return GEO[k];}
export const insidePrim=(p,r,u,v)=>p!=='.'&&insidePolys(geo(p,canon(p,r)).polys,u,v);
// The turn that draws a primitive's mirror image: across the vertical axis
// ('x'), the horizontal axis ('y') or both (half turn, 'xy').
export function mirrorRot(p,r,axis='x'){if(p==='.')return 0;const k=PRIMS[p].kind;let q=r;
 if(k!=='sym'){if(axis==='x')q=k==='corner'?3-r:(4-r)%4;else if(axis==='y')q=k==='corner'?r^1:(6-r)%4;else q=(r+2)%4;}return canon(p,q);}
const mirrorCell=(t,axis='x')=>({...t,r:mirrorRot(t.p,t.r,axis)});

// ── Cell tokens and figure text ─────────────────────────────────────────────
const TOKEN=/^(?:([STQCHNBDOLKWAP])([0-3])?(\d)|(\.))(?:\/(\d))?$/;
export function parseToken(s){const m=TOKEN.exec(String(s));if(!m)throw new Error(`“${String(s).slice(0,12)}” is not a cell. Write a primitive letter (${ORDER}), a turn 0–3 and a colour 0–9 — e.g. T21 or S03/2 — or “.” for empty.`);
 return m[4]?{p:'.',r:0,c:0,b:+(m[5]??0)}:{p:m[1],r:canon(m[1],+(m[2]??0)),c:+m[3],b:+(m[5]??0)};}
export const tokenOf=t=>(t.p==='.'?'.':t.p+t.r+t.c)+(t.b?'/'+t.b:'');
export const MAX_GRID=16,MAX_OVER=40,MAX_CAST=9;
function parseGrid(rows){const list=(Array.isArray(rows)?rows:String(rows??'').split('\n')).map(r=>String(r).trim()).filter(Boolean);
 if(!list.length)throw new Error('A figure needs at least one row of cells.');if(list.length>MAX_GRID)throw new Error(`Use up to ${MAX_GRID} rows.`);
 const cells=list.map(row=>row.split(/\s+/).map(parseToken)),w=cells[0].length;if(w>MAX_GRID)throw new Error(`Use up to ${MAX_GRID} cells per row.`);
 cells.forEach((row,i)=>{if(row.length!==w)throw new Error(`Row ${i+1} has ${row.length} cells; row 1 has ${w}.`);});return cells;}
// Overlays. Defaults per kind (and per variant); sizes are in cell widths.
export const OVERLAYS={
 disc:{name:'Disc',d:{r:.3,c:1}},ring:{name:'Ring',d:{r:.3,i:.55,c:1}},half:{name:'Half disc',d:{r:.3,a:0,c:1}},quarter:{name:'Quarter disc',d:{r:.4,a:0,c:1}},
 tri:{name:'Triangle',d:{w:.5,h:.5,a:0,c:1}},rect:{name:'Rectangle',d:{w:.5,h:.3,a:0,c:1}},band:{name:'Blush band',d:{w:1,h:.25,c:9}},
 stripes:{name:'Stripes',d:{w:.8,h:.4,n:3,a:0,c:1}},spike:{name:'Spikes',d:{w:.6,h:.12,n:1,a:0,c:1}},lens:{name:'Lens',d:{w:.3,h:.8,a:0,c:1}},
 line:{name:'Line',d:{t:.04,c:1}},
 eye:{name:'Eye',variants:['kabuki','almond','round','dot','slit'],d:{r:.15,a:0,c:1,d:2}},
 brow:{name:'Brow',variants:['arc','moth','line'],d:{w:.5,a:0,c:1}},
 lip:{name:'Lips',variants:['bud','noh','bow','smile','beak'],d:{r:.15,a:0,c:3}}
};
const VD={'eye.kabuki':{c:3,d:1},'eye.round':{c:2,d:1},'eye.almond':{c:1,d:2},'lip.noh':{c:1},'lip.beak':{c:6}};
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
 if(typeof x==='string'){if(Object.hasOwn(PRESETS,x))return {...normalizeFigure(PRESETS[x]),from:'preset:'+x};const g=/^gen:(\w+):(\d+)(?::(\d))?$/.exec(x);if(g)return generate(g[1],+g[2],+(g[3]??1));throw new Error(`“${x.slice(0,24)}” is not a preset figure.`);}
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
const gridPainter=cells=>(x,y)=>{const r=Math.floor(y),c=Math.floor(x),t=cells[r]?.[c];if(!t)return -1;return insidePrim(t.p,t.r,x-c,y-r)?t.c:(t.b||-1);};
const MEMO=new Map();const remember=(k,f)=>{if(MEMO.has(k))return MEMO.get(k);const v=f();if(MEMO.size>300)MEMO.clear();MEMO.set(k,v);return v;};
// Resolution ×k re-quantises the drawn figure on a finer grid; a vocabulary
// swaps every primitive it lacks for its best-fitting substitute.
function requantize(cells,k,prims){const ok=t=>t.p==='.'||t.p==='S'||prims.includes(t.p);
 if(k===1){if(cells.every(r=>r.every(ok)))return cells;const paint=gridPainter(cells),cands=candidates(prims);return cells.map((row,r)=>row.map((t,c)=>ok(t)?t:fitCell(paint,c,r,cands)));}
 const paint=gridPainter(cells);return quantize((x,y)=>paint(x/k,y/k),cells[0].length*k,cells.length*k,{prims});}
// A cell on a symmetry axis becomes its best-fitting self-symmetric primitive.
function selfSym(t,axis,prims){if(t.p==='.'||mirrorRot(t.p,t.r,axis)===t.r)return t;const paint=(x,y)=>insidePrim(t.p,t.r,x,y)?t.c:(t.b||-1);return fitCell(paint,0,0,candidates(prims).filter(k=>mirrorRot(k.p,k.r,axis)===k.r));}
function applySym(g,mode,prims=ORDER){const R=g.length,C=g[0].length,out=g.map(r=>r.slice());
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
   else add([[[-r*1.1,0],['C',-.4*r,-.3*r,.4*r,-.3*r,r*1.1,0],['C',.4*r,.3*r,-.4*r,.3*r,-r*1.1,0]]],q.c);
   break;
  case 'brow':
   if(o.v==='arc')add(crescent(w,o.t!==undefined?q.t*f:w*.18,w*.2),q.c);
   else if(o.v==='moth')add(scaleC([circle(0,0,1)],w/2,w*.21),q.c);
   else add(capsule(-w/2,0,w/2,0,o.t!==undefined?q.t*f:w*.16),q.c);
   break;
  case 'lip':
   if(o.v==='bud'){add([circle(0,.34*r,r)],q.c);add([circle(0,-.38*r,.76*r)],q.c);}
   else if(o.v==='noh')add([[[-r,.05*r],['C',-.85*r,-.35*r,-.6*r,-.46*r,-.35*r,-.44*r],['C',-.15*r,-.42*r,-.08*r,-.3*r,0,-.28*r],['C',.08*r,-.3*r,.15*r,-.42*r,.35*r,-.42*r],['C',.6*r,-.44*r,.85*r,-.33*r,r,.02*r],['C',.75*r,.4*r,.35*r,.5*r,0,.5*r],['C',-.35*r,.5*r,-.75*r,.4*r,-r,.05*r]]],q.c);
   else if(o.v==='bow'){add([circle(-.42*r,-.14*r,.55*r)],q.c);add([circle(.42*r,-.14*r,.55*r)],q.c);add(rotC(halfC(.95*r),180,0,-.08*r),q.c);}
   else if(o.v==='smile')add(rotC(halfC(r),180),q.c);
   else add([[[-r/2,0],[r/2,0],[0,1.7*r]]],q.c);
   break;}
 return out;}
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
 cells.forEach((row,r)=>row.forEach((t,c)=>{const [a,b,d,e]=[V[r][c],V[r][c+1],V[r+1][c],V[r+1][c+1]],cx=(a[0]+b[0]+d[0]+e[0])/4,cy=(a[1]+b[1]+d[1]+e[1])/4;labels.push({x:cx,y:cy,t:tokenOf(t)});if(t.p==='.'&&!t.b)return;
  let th=0,dx=0,dy=0,sc=1;if(p.jitter>0){const cc=sym?Math.min(c,C-1-c):c,fl=sym&&c>C-1-c?-1:1,centre=sym&&c===C-1-c;th=centre?0:fl*(hr(p.seed,'jr',cc,r)-.5)*p.jitter*40;dx=centre?0:fl*(hr(p.seed,'jx',cc,r)-.5)*p.jitter*.34*s;dy=(hr(p.seed,'jy',cc,r)-.5)*p.jitter*.34*s*asp;sc=1-hr(p.seed,'js',cc,r)*p.jitter*.2;}
  const ct=Math.cos(th*Math.PI/180),st=Math.sin(th*Math.PI/180),map=(u,v)=>{u=.5+(u-.5)*(1-g);v=.5+(v-.5)*(1-g);const x=(1-u)*(1-v)*a[0]+u*(1-v)*b[0]+(1-u)*v*d[0]+u*v*e[0]-cx,y=(1-u)*(1-v)*a[1]+u*(1-v)*b[1]+(1-u)*v*d[1]+u*v*e[1]-cy;return [cx+dx+sc*(x*ct-y*st),cy+dy+sc*(x*st+y*ct)];};
  if(t.b){const cts=mapCt([roundCt(PRIMS.S.cts[0],rr)],map);bgs.push({cts,c:t.b,role:'bg'});boxOf(cts,box);}
  if(t.p!=='.'&&!(t.p==='S'&&t.b===t.c)){const cts=mapCt(geo(t.p,t.r).cts.map(k=>roundCt(k,rr)),map);shapes.push({cts,c:t.c,role:'cell'});boxOf(cts,box);}}));
 const ax=gw/2,ay=src.cells.length/2,overs=[];
 for(const it of overlayItems(src.over,state.symmetry,ax,ay))for(const sh of overlayShapes(it.o,p.features,asp)){const cts=mapCt(sh.cts,(x,y)=>[it.fx?2*ax-x:x,it.fy?2*ay*asp-y:y]);overs.push({...sh,cts,role:'over'});boxOf(cts,box);}
 const eyes=overlayItems(src.over.filter(o=>o.k==='eye'),state.symmetry,ax,ay).map(it=>[it.fx?2*ax-it.o.x:it.o.x,(it.fy?2*ay-it.o.y:it.o.y)*asp]);
 const focus=def.focus?[def.focus[0],def.focus[1]*asp]:eyes.length?[eyes.reduce((s,e)=>s+e[0],0)/eyes.length,eyes.reduce((s,e)=>s+e[1],0)/eyes.length]:[(box[0]+box[2])/2,(box[1]+box[3])/2];
 // Backgrounds form one layer under the primitives, so no edge of one shows through a neighbour.
 return {cells:[...bgs,...shapes],overs,labels,V,box,gw,gh,cell:s,R,C,grid:cells,focus};}

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
 {id:'indigo',name:'Indigo',colors:['#1c2a57','#0d1430','#f2eee3','#e0624e','#7d9ad6','#7fb3a8','#ead9a6','#a7c0e6','#a49ee0','#eab7ae']}
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
 {key:'count',label:'Field repeats across',min:1,max:8,step:1,value:3,integer:true,layouts:['field']},
 {key:'seed',label:'Seed (jitter, warp, noise, scatter, riso)',min:1,max:999,step:1,value:7,integer:true}
];
export const OPTIONS={layout:['hero','field','cast','crop'],symmetry:['none','mirror-left','mirror-right','flip','quad','point'],vocab:VOCABS.map(v=>v.id),paint:['fill','outline','sticker','neon','riso'],pattern:['repeat','mirror','brick','turn','scatter','colorway'],ground:['plain','gradient','lattice','grain'],copy:['corner','serif','vertical','band','none'],format:['poster','square','landscape']};
export const LABELS={layout:{hero:'Hero figure',field:'Patterned field',cast:'Cast of figures',crop:'Cropped giant'},symmetry:{none:'As drawn','mirror-left':'Mirror left half','mirror-right':'Mirror right half',flip:'Mirror top half',quad:'Four-way mirror',point:'Half-turn'},
 vocab:Object.fromEntries(VOCABS.map(v=>[v.id,v.name])),paint:{fill:'Flat fill',outline:'Outline',sticker:'Sticker (fill + ink line)',neon:'Neon glow',riso:'Riso overprint'},pattern:{repeat:'Repeat',mirror:'Mirror tiles',brick:'Brick offset',turn:'Quarter turns',scatter:'Scatter',colorway:'Colourways'},
 ground:{plain:'Plain',gradient:'Gradient',lattice:'Lattice lines',grain:'Paper grain'},copy:{corner:'Corner block',serif:'Serif title',vertical:'Vertical column',band:'Bottom band',none:'No copy'},format:{poster:'Poster B 728 × 1030',square:'Square',landscape:'Landscape B'}};
export const FORMATS={poster:[728,1030],square:[880,880],landscape:[1030,728]};
const P0={refine:0,gap:0,round:0,aspect:1,jitter:0,warp:0,turn:0,features:1,scale:1,stroke:2.5,count:3,seed:7};
const S0={layout:'hero',bleed:false,symmetry:'none',vocab:'all',paint:'fill',pattern:'repeat',ground:'plain',copy:'band',format:'poster'};
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
  set:{...S0,layout:'field',paint:'outline',pattern:'mirror',ground:'lattice',copy:'band',params:{...P0,count:3,stroke:2.4,gap:.06}},note:'A flower drawn in line only and mirrored tile by tile, like a stencilled indigo cloth.'}
];
export const FAMILIES=STYLES;

// ── State ──────────────────────────────────────────────────────────────────
const clampNum=(v,c)=>{let x=Number(v);if(!Number.isFinite(x))x=c.value;x=clamp(x,c.min,c.max);return c.integer?Math.round(x):x;};
// Copy is escaped when drawn; cleaning only drops markup characters, so a resolved state resolves to itself.
const cleanText=(v,d,max)=>typeof v==='string'?v.replace(/[<>"]/g,'').slice(0,max):d;
export function resolve(input={}){const style=STYLES.find(s=>s.id===input.style)??STYLES[0],set=style.set,pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],params={};
 for(const c of CONTROLS)params[c.key]=clampNum(input.params?.[c.key]??set.params[c.key]??c.value,{...c,value:set.params[c.key]??c.value});
 let cast;try{cast=(Array.isArray(input.cast)&&input.cast.length?input.cast:style.cast).slice(0,MAX_CAST).map(normalizeFigure);}catch{cast=style.cast.map(normalizeFigure);}
 const palette=PALETTES.some(p=>p.id===input.palette)?input.palette:style.palette,colors=Array.isArray(input.colors)&&input.colors.length===10&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...PALETTES.find(p=>p.id===palette).colors];
 return {engine:ENGINE,style:style.id,cast,active:clamp(Math.round(+input.active||0),0,cast.length-1),layout:pick('layout'),bleed:typeof input.bleed==='boolean'?input.bleed:!!set.bleed,symmetry:pick('symmetry'),vocab:pick('vocab'),paint:pick('paint'),pattern:pick('pattern'),ground:pick('ground'),copy:pick('copy'),format:pick('format'),
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
  else{const [ox,oy]=ctx.riso[sh.c];out+=`<path d="${d}" fill="${c}" fill-rule="evenodd" transform="translate(${fx(ox*px)} ${fx(oy*px)})"/>`;}}
 return out;}
const margin=(w,h)=>Math.round(Math.min(w,h)*.055);
export function contentBox(state,w,h){const m=margin(w,h),b=[m,m,w-m,h-m];if(state.copy==='corner')b[1]+=130;else if(state.copy==='serif')b[1]+=122;else if(state.copy==='vertical')b[2]-=86;else if(state.copy==='band')b[3]-=92;return b;}
const shift=(colors,k)=>colors.map((c,i)=>i<3?c:colors[3+(i-3+k)%7]);
function fitIn(fig,b,k){const [x0,y0,x1,y1]=fig.box,s=Math.min((b[2]-b[0])/(x1-x0),(b[3]-b[1])/(y1-y0))*k;return {s,tx:(b[0]+b[2])/2-(x0+x1)/2*s,ty:(b[1]+b[3])/2-(y0+y1)/2*s};}
function layoutBody(state,w,h,ctx){const p=state.params,box=contentBox(state,w,h),st=state.stage,place=[],put=(fig,t,cmap=state.colors)=>`<g transform="translate(${fx(t.tx)} ${fx(t.ty)}) scale(${fx(t.s)})">${paintFigure(fig,state,t.s,ctx,cmap,st)}</g>`,ink=lineInk(state.colors);let body='',tiles=0,cells=0,overs=0;
 const note=(fig,t,name)=>{cells+=fig.cells.length;overs+=fig.overs.length;place.push({name,box:[t.tx+fig.box[0]*t.s,t.ty+fig.box[1]*t.s,t.tx+fig.box[2]*t.s,t.ty+fig.box[3]*t.s],cell:fig.cell*t.s});};
 if(state.layout==='hero'||state.layout==='crop'){const def=state.cast[state.active],fig=buildFigure(def,state);let t;
  // The giant figure bleeds off three sides; the side that carries the copy stays clear.
  if(state.layout==='crop'){const [x0,y0,x1,y1]=fig.box,c=[0,0,w,h];if(state.copy==='corner'||state.copy==='serif')c[1]=box[1]-14;else if(state.copy==='vertical')c[2]=box[2]+10;else if(state.copy==='band')c[3]=box[3]+10;
   const s=Math.min(w/(x1-x0),h/(y1-y0))*1.4*p.scale;t={s,tx:(c[0]+c[2])/2-fig.focus[0]*s,ty:c[1]+(c[3]-c[1])*.46-fig.focus[1]*s};ctx.defs+=`<clipPath id="${ctx.uid}-crop"><rect x="${c[0]}" y="${c[1]}" width="${c[2]-c[0]}" height="${c[3]-c[1]}"/></clipPath>`;body=`<g clip-path="url(#${ctx.uid}-crop)">${put(fig,t)}</g>`;note(fig,t,def.name);return {body,place,tiles,cells,overs,box};}
  else if(state.bleed){const s=Math.max(w/fig.gw,h/fig.gh)*p.scale;t={s,tx:(w-fig.gw*s)/2,ty:(h-fig.gh*s)/2};}else t=fitIn(fig,box,.96*p.scale);
  body=put(fig,t);note(fig,t,def.name);}
 else if(state.layout==='field'){const def=state.cast[state.active],fig=buildFigure(def,state),[x0,y0,x1,y1]=fig.box,fw=x1-x0,fh=y1-y0,n=p.count,bw=box[2]-box[0],bh=box[3]-box[1],tw=bw/n,turn=state.pattern==='turn',brick=state.pattern==='brick';
  const rows=Math.max(1,Math.round(bh/(turn?tw:tw*fh/fw))),th=bh/rows,s=(turn?Math.min(tw,th)/Math.max(fw,fh):Math.min(tw/fw,th/fh))*.88*p.scale,ways=state.pattern==='colorway'?7:1,cx=(x0+x1)/2,cy=(y0+y1)/2;
  for(let k=0;k<ways;k++)ctx.defs+=`<g id="${ctx.uid}-t${k}">${paintFigure(fig,state,s,ctx,k?shift(state.colors,k):state.colors,st)}</g>`;
  ctx.defs+=`<clipPath id="${ctx.uid}-clip"><rect x="${box[0]}" y="${box[1]}" width="${fx(bw)}" height="${fx(bh)}"/></clipPath>`;
  for(let j=0;j<rows;j++)for(let i=0;i<n+(brick&&j%2?1:0);i++){const X=box[0]+(i+.5)*tw-(brick&&j%2?tw/2:0),Y=box[1]+(j+.5)*th;let tf=`translate(${fx(X)} ${fx(Y)})`;
   if(state.pattern==='mirror')tf+=` scale(${i%2?-1:1} ${j%2?-1:1})`;else if(turn)tf+=` rotate(${((i+j)%4)*90})`;
   else if(state.pattern==='scatter'){const z=.78+hr(p.seed,'sz',i,j)*.36;tf+=` rotate(${fx((hr(p.seed,'sa',i,j)-.5)*44)}) scale(${fx((hr(p.seed,'sf',i,j)<.5?-1:1)*z)} ${fx(z)})`;}
   tf+=` scale(${fx(s)}) translate(${fx(-cx)} ${fx(-cy)})`;body+=`<use href="#${ctx.uid}-t${state.pattern==='colorway'?(i+2*j)%7:0}" transform="${tf}"/>`;tiles++;}
  body=`<g clip-path="url(#${ctx.uid}-clip)">${body}</g>`;cells=fig.cells.length*tiles;overs=fig.overs.length*tiles;place.push({name:def.name,box,cell:fig.cell*s});}
 else{const list=state.cast,n=list.length,cols=n<=3?n:n===4?2:3,rows=Math.ceil(n/cols),lab=30,sw=(box[2]-box[0])/cols,sh=(box[3]-box[1])/rows;
  list.forEach((def,i)=>{const fig=buildFigure(def,state),c=i%cols,r=Math.floor(i/cols),inRow=Math.min(cols,n-r*cols),ox=(cols-inRow)*sw/2,x0=box[0]+ox+c*sw,y0=box[1]+r*sh,t=fitIn(fig,[x0+sw*.07,y0+sh*.05,x0+sw*.93,y0+sh-lab-sh*.03],.95*p.scale);
   body+=put(fig,t);note(fig,t,def.name);if(st===4)body+=`<text x="${fx(x0+sw/2)}" y="${fx(y0+sh-12)}" text-anchor="middle" font-family="${SANS}" font-size="14" letter-spacing="1.4" fill="${ink}">${esc(def.name.toUpperCase())}</text>`;});}
 return {body,place,tiles,cells,overs,box};}
function copySVG(state,w,h,ink){const m=margin(w,h),lines=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,4).map(esc),t=esc(state.title),fit=(fs,avail,k)=>fx(Math.min(fs,avail/Math.max(1,state.title.length*k)));
 if(state.copy==='corner')return `<g font-family="${SANS}" fill="${ink}"><text x="${m}" y="${m+24}" font-size="${fit(27,w*.6,.56)}" font-weight="600" letter-spacing="-.3">${t}</text>${lines.map((l,i)=>`<text x="${m}" y="${m+58+i*19}" font-size="14.5">${l}</text>`).join('')}</g>`;
 if(state.copy==='serif')return `<g fill="${ink}" text-anchor="middle"><text x="${w/2}" y="${m+62}" font-family="${SERIF}" font-size="${fit(66,w-2*m,.62)}" letter-spacing="1">${t}</text><text x="${w/2}" y="${m+96}" font-family="${SANS}" font-size="12" letter-spacing="2.2">${lines.join(' · ').toUpperCase()}</text></g>`;
 if(state.copy==='vertical')return `<g fill="${ink}" transform="translate(${w-m-34} ${m}) rotate(90)"><text x="0" y="0" font-family="${HEAVY}" font-weight="800" font-size="${fit(44,h-2*m,.66)}" letter-spacing="3">${t}</text>${lines.map((l,i)=>`<text x="0" y="${24+i*17}" font-family="${SANS}" font-size="12.5" letter-spacing=".6">${l}</text>`).join('')}</g>`;
 if(state.copy==='band')return `<g fill="${ink}"><text x="${m}" y="${h-m-6}" font-family="${HEAVY}" font-weight="800" font-size="${fit(48,w*.56,.66)}" letter-spacing="-.5">${t}</text><g font-family="${SANS}" font-size="12.5" text-anchor="end">${lines.map((l,i)=>`<text x="${w-m}" y="${h-m-6-(lines.length-1-i)*17}">${l}</text>`).join('')}</g></g>`;
 return '';}
export function render(input={},page){const state=resolve(input),[fw,fh]=FORMATS[state.format],w=page?.width??fw,h=page?.height??fh,uid='pk'+fnv(JSON.stringify(state)+w+'x'+h).toString(36),st=state.stage,colors=state.colors,ink=lineInk(colors),p=state.params;
 const ctx={uid,defs:'',fades:new Set(),riso:colors.map((_,i)=>[(hr(p.seed,'rx',i)-.5)*7,(hr(p.seed,'ry',i)-.5)*7])},lay=layoutBody(state,w,h,ctx);
 let ground=`<rect width="${w}" height="${h}" fill="${colors[0]}"/>`,over='';
 if(st===4&&state.ground==='gradient'){ctx.defs+=`<linearGradient id="${uid}-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${mix(colors[0],colors[8],.42)}"/></linearGradient>`;ground=`<rect width="${w}" height="${h}" fill="url(#${uid}-ground)"/>`;}
 if(st===4&&state.ground==='lattice'){const k=w/14;let d='';for(let x=k;x<w;x+=k)d+=`M${fx(x)} 0V${h}`;for(let y=k;y<h;y+=k)d+=`M0 ${fx(y)}H${w}`;ground+=`<path d="${d}" stroke="${mix(colors[0],ink,.16)}" stroke-width="1" fill="none"/>`;}
 if(st===4&&state.ground==='grain'){const [r,g,b]=rgb(mix(colors[0],ink,.75)).map(v=>fx(v/255));ctx.defs+=`<filter id="${uid}-grain" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="2" seed="${p.seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 3.2 0 0 0 -2"/></filter>`;over=`<rect width="${w}" height="${h}" filter="url(#${uid}-grain)" opacity=".42"/>`;}
 const neon=st===4&&state.paint==='neon';if(neon)ctx.defs+=`<filter id="${uid}-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
 const names=[...new Set(lay.place.map(x=>x.name))],stageName=['construction grid','kit cells','figure with overlays','poster'][st-1],desc=`${names.join(', ')} — ${LABELS.layout[state.layout].toLowerCase()} in ${STYLES.find(s=>s.id===state.style).name}, ${LABELS.paint[state.paint].toLowerCase()}, ${stageName}. Primitive kit after Ikko Tanaka.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(desc)}"><title>Primitive kit figures — ${esc(names.join(', '))}</title>${ctx.defs?`<defs>${ctx.defs}</defs>`:''}${ground}${neon?`<g filter="url(#${uid}-glow)">${lay.body}</g>`:lay.body}${over}${st===4?copySVG(state,w,h,ink):''}</svg>`;
 const active=buildFigure(state.cast[state.active],state);
 return {svg,state,width:w,height:h,features:{style:state.style,layout:state.layout,paint:state.paint,stage:st,figures:names,shapes:lay.cells,overlays:lay.overs,tiles:lay.tiles,grid:[active.C,active.R],resolution:2**p.refine,symmetry:state.symmetry,vocab:state.vocab,placed:lay.place,box:lay.box}};}

// ── Small views: thumbnails, the editing canvas, the kit specimen ─────────
export function thumbnail(def,state,size=64){const fig=buildFigure(def,{...state,params:{...state.params,jitter:0}}),t=fitIn(fig,[size*.08,size*.08,size*.92,size*.92],1),ctx={uid:'th',defs:'',fades:new Set(),riso:[]};
 const body=paintFigure(fig,state,t.s,ctx,state.colors,3);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" aria-hidden="true"><rect width="${size}" height="${size}" fill="${state.colors[0]}"/>${ctx.defs?`<defs>${ctx.defs}</defs>`:''}<g transform="translate(${fx(t.tx)} ${fx(t.ty)}) scale(${fx(t.s)})">${body}</g></svg>`;}
// The authored grid of the active figure with hit cells (data-r, data-c) and
// overlay handles (data-o). Cells the symmetry derives are shaded.
export function editorSVG(state,{selected=-1,size=520}={}){const def=state.cast[state.active],src=parsed(def),R=src.cells.length,C=src.cells[0].length,asp=state.params.aspect;
 const view={...state,vocab:'all',params:{...state.params,refine:0,turn:0,jitter:0,warp:0,gap:0,round:0,features:state.params.features}},fig=buildFigure(def,view),pad=.25;
 const x0=Math.min(fig.box[0],0)-pad,y0=Math.min(fig.box[1],0)-pad,x1=Math.max(fig.box[2],C)+pad,y1=Math.max(fig.box[3],R*asp)+pad,s=size/(x1-x0),ctx={uid:'ed',defs:'',fades:new Set(),riso:[]},ink=lineInk(state.colors);
 let grid='';for(let c=0;c<=C;c++)grid+=`M${c} 0V${fx(R*asp)}`;for(let r=0;r<=R;r++)grid+=`M0 ${fx(r*asp)}H${C}`;let shade='',hits='',handles='';
 for(let r=0;r<R;r++)for(let c=0;c<C;c++){if(derived(state.symmetry,r,c,R,C))shade+=`<rect x="${c}" y="${fx(r*asp)}" width="1" height="${fx(asp)}"/>`;hits+=`<rect class="hit" data-r="${r}" data-c="${c}" x="${c}" y="${fx(r*asp)}" width="1" height="${fx(asp)}"/>`;}
 src.over.forEach((o,i)=>{handles+=`<circle class="handle" data-o="${i}" cx="${fx(o.x)}" cy="${fx(o.y*asp)}" r="${fx(i===selected?.11:.07)}" fill="${i===selected?'#ff2bd6':'#ffffff'}" stroke="#111" stroke-width="${fx(1.5/s)}"/>`;});
 const art=paintFigure(fig,view,s,ctx,state.colors,3);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fx(x0)} ${fx(y0)} ${fx(x1-x0)} ${fx(y1-y0)}" width="${size}" height="${Math.round((y1-y0)*s)}" data-aspect="${asp}"><rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(x1-x0)}" height="${fx(y1-y0)}" fill="${state.colors[0]}"/>${ctx.defs?`<defs>${ctx.defs}</defs>`:''}${art}<g fill="${ink}" fill-opacity=".22">${shade}</g><path d="${grid}" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width="${fx(1/s)}"/><g fill="transparent">${hits}</g>${handles}</svg>`;}
// Every primitive in its four turns, then every overlay.
export function specimen(input={}){const state=resolve({...input,stage:3}),c=state.colors,ink=lineInk(c),cw=104,pad=30,w=pad*2+ORDER.length*cw,oy=pad+4*cw+70,ow=w-2*pad,kinds=Object.entries(OVERLAYS).flatMap(([k,o])=>o.variants?o.variants.map(v=>k+'.'+v):[k]),per=Math.ceil(kinds.length/2),ocw=ow/per,h=oy+2*(ocw+34)+pad;
 const ctx={uid:'sp',defs:'',fades:new Set(),riso:[]};let body=`<rect width="${w}" height="${h}" fill="${c[0]}"/>`;
 [...ORDER].forEach((p,i)=>{for(let r=0;r<4;r++){const x=pad+i*cw+12,y=pad+r*cw+12,u=cw-24,q=canon(p,r);body+=`<rect x="${x}" y="${y}" width="${u}" height="${u}" fill="none" stroke="${ink}" stroke-opacity=".25"/><path d="${pathD(mapCt(geo(p,q).cts,(a,b)=>[x+a*u,y+b*u]))}" fill="${c[[1,3,4,5,8,9][i%6]]}" fill-rule="evenodd"/>`;}
  body+=`<text x="${pad+i*cw+cw/2}" y="${pad+4*cw+18}" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="700" fill="${ink}">${p}</text><text x="${pad+i*cw+cw/2}" y="${pad+4*cw+38}" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="${ink}">${PRIMS[p].name}</text>`;});
 kinds.forEach((k,i)=>{const col=i%per,row=Math.floor(i/per),x=pad+col*ocw+ocw/2,y=oy+row*(ocw+34)+ocw/2,line=k==='line'?'line 0 0 e.7,-.5 t.08':k==='band'?'band 0 0 w1 h.4':k.startsWith('lip.beak')?`${k} 0 -.3 r.35`:`${k} 0 0`+(k.startsWith('brow')?' w.9':k.startsWith('eye')||k.startsWith('lip')?' r.32':k==='stripes'?' w.9 h.6':k==='spike'?' w.8 h.2 n2':k==='lens'?' w.4 h.9':k==='tri'||k==='rect'?' w.7 h.7':' r.38'),o=parseOverlay(line),sc=ocw*.62;
  for(const sh of overlayShapes(o,1,1)){const cts=mapCt(sh.cts,(a,b)=>[x+a*sc,y+b*sc]);body+=sh.grad?`<path d="${pathD(cts)}" fill="${c[sh.c]}" fill-opacity=".6"/>`:`<path d="${pathD(cts)}" fill="${c[sh.c]}" fill-rule="evenodd"/>`;}
  body+=`<text x="${x}" y="${y+ocw/2+16}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${ink}">${k}</text>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${fx(h)}" viewBox="0 0 ${w} ${fx(h)}" role="img" aria-label="Primitive kit: fourteen primitives in four turns, and the overlay shapes">${body}</svg>`;}

// ── Editing operations (pure; the editor keeps history) ────────────────────
export function paintCell(def,r,c,token,symmetry='none'){const cells=parsed(def).cells.map(row=>row.slice()),R=cells.length,C=cells[0].length,t=typeof token==='string'?parseToken(token):token,done=new Set();
 const set=(rr,cc,x)=>{const k=rr+','+cc;if(rr<0||rr>=R||cc<0||cc>=C||done.has(k))return;done.add(k);cells[rr][cc]=x;};set(r,c,t);
 if(SYM_X.includes(symmetry))set(r,C-1-c,mirrorCell(t));if(symmetry==='flip'||symmetry==='quad')set(R-1-r,c,mirrorCell(t,'y'));if(symmetry==='quad'||symmetry==='point')set(R-1-r,C-1-c,mirrorCell(t,'xy'));
 return {...def,from:'custom',grid:cells.map(row=>row.map(tokenOf).join(' '))};}
export const cellAt=(def,r,c)=>parsed(def).cells[r]?.[c];
export function resizeFigure(def,op){const {cells,over}=parsed(def),R=cells.length,C=cells[0].length,empty={p:'.',r:0,c:0,b:0};let g=cells.map(r=>r.slice()),dx=0;
 if(op==='widen'&&C+2<=MAX_GRID){g=g.map(r=>[empty,...r,empty]);dx=1;}else if(op==='narrow'&&C>2){g=g.map(r=>r.slice(1,-1));dx=-1;}else if(op==='taller'&&R<MAX_GRID)g.push(Array(C).fill(empty));else if(op==='shorter'&&R>1)g.pop();else if(op==='clear')g=g.map(r=>r.map(()=>empty));else return def;
 return {...def,from:'custom',grid:g.map(r=>r.map(tokenOf).join(' ')),over:op==='clear'?[]:over.map(o=>overlayText({...o,x:o.x+dx,...(o.e?{e:[o.e[0]+dx,o.e[1]]}:{})}))};}

// ── Seeded generator: symmetric silhouettes quantised into kit cells ───────
const inEll=(x,y,cx,cy,rx,ry,a=0)=>{let dx=x-cx,dy=y-cy;if(a){const c=Math.cos(a),s=Math.sin(a);[dx,dy]=[dx*c+dy*s,-dx*s+dy*c];}return (dx/rx)**2+(dy/ry)**2<=1;};
const inPoly=(x,y,pts)=>insidePolys([pts],x,y);
export const GENERATORS=[{id:'face',name:'Face'},{id:'mask',name:'Mask'},{id:'butterfly',name:'Butterfly'},{id:'bird',name:'Bird'},{id:'flower',name:'Flower'}];
const KINDS={
 face(g,size,pick,acc){const cols=[4,6,8][size],rows=cols+2,cx=cols/2,skin=pick([2,2,2,6,9,7]),hair=pick([1,1,1,4,8,5]),A=acc([skin,hair]);
  const frx=cols*(.25+.05*g()),fry=rows*(.25+.04*g()),fcy=rows*(.46+.04*g()),sy=fcy+fry*.92,style=pick(['cap','bob','bun','buns','long']),fringe=fcy-fry*(.32+.14*g()),halo=g()<.45,dx=x=>Math.abs(x-cx);
  const hairAt=(x,y)=>{const cap=inEll(x,y,cx,fcy-fry*.12,frx*1.2,fry*1.1)&&y<fcy+fry*.1;return style==='cap'?cap:style==='bob'?inEll(x,y,cx,fcy-fry*.05,frx*1.28,fry*1.12)&&y<fcy+fry*.62:style==='bun'?cap||inEll(x,y,cx,fcy-fry*1.28,frx*.58,frx*.54):style==='buns'?cap||inEll(dx(x),y,frx*.95,fcy-fry*1.02,frx*.5,frx*.5):(inEll(x,y,cx,fcy,frx*1.3,fry*1.15)&&y<fcy)||(dx(x)<frx*1.3&&y>=fcy&&y<sy+fry*.6);};
  const paint=(x,y)=>{if(inEll(x,y,cx,fcy,frx,fry)&&y>=fringe)return skin;if(dx(x)<frx*.36&&y>fcy&&y<sy+.5)return skin;if(hairAt(x,y))return hair;
   if(y>sy&&dx(x)<frx*1.15+(y-sy)*1.1)return dx(x)<(y-sy)*.62+frx*.14?A[1]:A[0];if(halo&&inEll(x,y,cx,fcy-fry*.3,frx*1.75,frx*1.75))return A[2];return -1;};
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
  const stemEnd=pot>=0?rows-2:rows-.1,over=[`rect ${num(cx)} ${num((cy+stemEnd)/2)} w.2 h${num(stemEnd-cy)} c5`,`ring ${num(cx)} ${num(cy)} r${num(R*.62)} i.5 c${A[0]}`];if(g()<.5)over.push(`disc ${num(cx-cols*.38)} ${num(rows*.08)} r.32 c${A[1]} m`);return {cols,rows,paint,over,name:'Flower'};}
};
// Generated figures avoid the concave cove and arch, the ring, quarter ring and dot: they scallop outlines.
const GEN_PRIMS='STQHBDLKW';
export function generate(kind,seed,size=1){if(!KINDS[kind])throw new Error(`Generate a ${GENERATORS.map(k=>k.id).join(', ')}.`);seed=clamp(Math.round(+seed||1),1,99999);size=clamp(Math.round(+size),0,2);
 const g=rng(fnv(kind+':'+seed+':'+size)),pick=a=>a[Math.floor(g()*a.length)],acc=avoid=>{const a=[3,4,5,6,7,8,9,2].filter(c=>!avoid.includes(c));for(let i=a.length-1;i>0;i--){const j=Math.floor(g()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const f=KINDS[kind](g,size,pick,acc),cells=quantize(f.paint,f.cols,f.rows,{sym:true,prims:GEN_PRIMS});
 return {name:`${f.name} ${seed}`,from:`gen:${kind}:${seed}:${size}`,grid:cells.map(r=>r.map(tokenOf).join(' ')),over:f.over.map(l=>overlayText(parseOverlay(l)))};}
// A primitive as a small icon (brush buttons in the editor).
export function primSVG(p,r,fill,bg,size=28){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.08 -.08 1.16 1.16" width="${size}" height="${size}" aria-hidden="true"><rect x="0" y="0" width="1" height="1" fill="${bg}"/>${p==='.'?'':`<path d="${pathD(geo(p,canon(p,r)).cts)}" fill="${fill}" fill-rule="evenodd"/>`}</svg>`;}
