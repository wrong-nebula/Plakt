/* The eight constructions. Each takes a spec, a frame {x, y, w, h} and a
 * drawing context, and returns SVG. A spec is an item {shape, turn, flip}, or
 * one of the source letters P, A, G, E, S, which keep their authored drawings.
 */
import {SHAPES} from './shapes.mjs';
import * as G from './geometry.mjs';
import {n,path,line,jitter} from './svg.mjs';
export const G_PARTS=[
 'M25 10C12 5 0 15 0 29V89C0 106 17 112 31 104C45 97 39 85 31 78C20 69 18 63 25 54C35 45 42 37 40 25C38 17 31 11 25 10Z',
 'M51 45C58 45 62 50 68 49C75 48 78 44 84 45C94 46 94 63 84 65C77 67 73 61 66 62C60 63 56 68 48 65C37 62 38 47 51 45Z',
 'M87 38C99 38 99 52 95 61C91 69 99 78 100 86C103 98 90 102 81 104C73 106 67 114 58 110C51 106 46 105 38 108C27 115 19 112 18 103C17 95 25 86 34 86C44 85 48 98 59 96C73 95 83 80 80 65C77 57 73 50 78 43C80 39 83 38 87 38Z'
];
export const S_NODES=[[89,10,9],[72,14,12],[55,10,11],[40,16,11],[24,18,10],[18,29,11],[12,39,10],[21,50,12],[37,58,10],[53,60,11],[68,64,11],[77,75,12],[76,88,10],[67,99,12],[53,103,10],[37,100,12],[24,108,13],[13,108,10]];
// Source letter drawings: the ribbed serif P, the tall S, the split-rail E and
// the perforated E's eighteen active modules.
const RIB_P='M17 17H63C94 17 101 37 101 61V106C101 132 86 144 58 144M58 27V237M12 237H109',TALL_S='M76 28V12C76 4 24 4 24 12V34C24 42 76 62 76 70V91C76 100 24 100 24 91V73',RAIL_E='M0 0H100M0 17L100 86M0 100H100';
const SOURCE_E=['11111','10000','10000','11110','10000','10000','11111'];
const OVERRIDES={contour:{P:RIB_P},heavy:{S:TALL_S},rails:{E:RAIL_E}};
const CX={contour:.55,facets:.9,overlap:.95,linked:.95,folded:.9,rails:.8,heavy:.42};
const PAD={contour:s=>7*s.params.weight+1,facets:s=>(4+36*s.params.bevel)*s.params.weight+2,overlap:s=>13*s.params.weight+1,linked:s=>13*s.params.weight+1,folded:s=>11*s.params.weight+55*s.params.bevel+1,rails:s=>3.5*s.params.weight+1,heavy:s=>9.5*s.params.weight+1};
const isLetter=spec=>typeof spec==='string';
export const keyOf=spec=>isLetter(spec)?spec:`${spec.shape}|${spec.turn??0}|${spec.flip?1:0}`;
// Shapes keep upright, mirrored or quarter-turned. A turned frame is rescaled
// so its new height is 100 again.
function orientation(x0,x1,turn,flip){const cx=(x0+x1)/2,cy=50,w=Math.max(x1-x0,1),q=((turn%4)+4)%4,k=q%2?100/w:1;
 const map=([x,y])=>{let dx=(x-cx)*(flip?-1:1),dy=y-cy;for(let i=0;i<q;i++)[dx,dy]=[-dy,dx];return q%2?[(dx+50)*k,(dy+w/2)*k]:[cx+dx,cy+dy];},o=map([0,0]),ax=map([1,0]),ay=map([0,1]);
 return [ax[0]-o[0],ax[1]-o[1],ay[0]-o[0],ay[1]-o[1],o[0],o[1]];}
// ── Skeletons ────────────────────────────────────────────────────────────
// `runs` split at corners; `whole` keeps each subpath intact so stroked
// outlines keep their joins.
const cache=new Map();
function build(d,fit){let runs=G.runs(d),whole=G.runs(d,4);const b=G.boundsOf(runs.flatMap(r=>G.points(r)));const m=fit(b);if(m){runs=G.transformRuns(runs,m);whole=G.transformRuns(whole,m);}const polys=runs.map(r=>({pts:G.points(r),closed:r.closed})),c=G.boundsOf(polys.flatMap(p=>p.pts));return {runs,whole,polys,x0:c.x0,x1:c.x1};}
export function skeleton(c,spec,detail=0){
 const override=isLetter(spec)?OVERRIDES[c]?.[spec]:null,shape=isLetter(spec)?null:SHAPES[spec.shape],k=shape?.count?detail:0,key=override?spec+'|'+c:keyOf(spec)+'|'+k;
 if(!cache.has(key))cache.set(key,override?build(override,b=>{const s=100/(b.y1-b.y0);return [s,0,0,s,-b.x0*s,-b.y0*s];}):{...build(shape.make(k),b=>spec.turn%4||spec.flip?orientation(b.x0,b.x1,spec.turn??0,spec.flip):null),weight:shape.weight?.(k)??1});
 return cache.get(key);}
const S_K=100/98,S_N=S_NODES.map(([x,y,r])=>[(x-13)*S_K,(y-10)*S_K,r*S_K]),S_LENGTH=G.polyLength(S_N),S_BOX={x0:0,x1:76*S_K};
// Place a skeleton box (x0..x1 × 0..100, padded) in a frame. Frames may be
// stretched: the skeleton stretches, strokes keep the height-based unit u.
export function place(box,f,pad,cx){const bw=Math.max(box.x1-box.x0,1),uy=f.h/(100+2*pad),ux=Math.max(.05*uy,(f.w-2*pad*uy)/bw),u=Math.min(uy,f.w/(bw*cx+2*pad));return {sx:ux,sy:uy,tx:f.x+f.w/2-(box.x0+box.x1)/2*ux,ty:f.y+pad*uy,u};}
const cxOf=(c,spec)=>c==='contour'&&spec==='P'?1:CX[c];
// Stroke weight for a skeleton: the module-weight control times the shape's
// own lightening at high detail.
const wt=(s,sk)=>s.params.weight*(sk.weight??1);
export const mapped=(sk,m,whole)=>G.mapRuns(whole?sk.whole:sk.runs,m.sx,m.sy,m.tx,m.ty);
export function pathOf(rs,family){const q=p=>n(p[0])+' '+n(p[1]);let d='';for(const r of rs){if(family==='lozenges'){d+='M'+G.points(r,3).map(q).join('L')+(r.closed?'Z':'');continue;}d+='M'+q(r.segs[0].p0);for(const s of r.segs)d+=s.type==='L'?'L'+q(s.p1):'C'+q(s.c1)+' '+q(s.c2)+' '+q(s.p1);if(r.closed)d+='Z';}return d;}
// Straight pieces: corners are kept, curves become facets about `step` long
// (in every module set, so finely drawn curves don't shatter into slivers).
function pieces(rs,step){const out=[];for(const r of rs){let pts;if(r.segs.every(s=>s.type==='L'))pts=G.points(r);else{const all=G.points(r),k=Math.max(2,Math.round(G.polyLength(all,r.closed)/step));pts=G.stations(all,r.closed?k:k+1,r.closed);}for(let i=1;i<pts.length;i++)out.push([pts[i-1],pts[i]]);if(r.closed&&pts.length>2)out.push([pts[pts.length-1],pts[0]]);}return out.filter(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1])>1e-3);}
const strokeStyle=f=>f==='lozenges'?{cap:'square',join:'miter'}:f==='squares'?{cap:'square',join:'round'}:{cap:'round',join:'round'};
function outlines(rs,s,width){return rs.map(r=>{const o=G.strokeOutline(G.points(r,s.family==='lozenges'?3:0),r.closed,width,strokeStyle(s.family));return s.family==='squares'?G.soften(o,width*.3):o;});}
// Map simple SVG paths while retaining exact anchors. Lozenge mode changes
// every cubic into three facets, including the organic negative boundaries.
export function shapePath(d,state,sx=1,sy=1,tx=0,ty=0){const tokens=d.match(/[A-Z]|-?(?:\d*\.)?\d+/g),arity={M:2,L:2,H:1,V:1,C:6,Q:4,Z:0};let i=0,x=0,y=0,start=[0,0],out='',command='M';const pp=(a,b)=>`${n(a*sx+tx)} ${n(b*sy+ty)}`;
 while(i<tokens.length){if(/^[A-Z]$/.test(tokens[i]))command=tokens[i++];const cmd=command;if(!(cmd in arity))throw new Error('Unsupported path command: '+cmd);const a=tokens.slice(i,i+arity[cmd]).map(Number);i+=arity[cmd];if(cmd==='Z'){out+='Z';[x,y]=start;continue;}const p=cmd==='H'?[a[0],y]:cmd==='V'?[x,a[0]]:a.slice(-2);
  if(cmd==='M'){out+='M'+pp(...p);start=p;}else if(cmd==='C'||cmd==='Q'){let c1,c2;if(cmd==='C'){c1=a.slice(0,2);c2=a.slice(2,4);}else{c1=[x+(a[0]-x)*2/3,y+(a[1]-y)*2/3];c2=[p[0]+(a[0]-p[0])*2/3,p[1]+(a[1]-p[1])*2/3];}
   if(state.family==='lozenges')for(const t of [1/3,2/3,1]){const u=1-t;out+='L'+pp(u*u*u*x+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*p[0],u*u*u*y+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*p[1]);}else out+='C'+pp(...c1)+' '+pp(...c2)+' '+pp(...p);
  }else out+='L'+pp(...p);[x,y]=p;if(cmd==='M')command='L';
 }return out;
}
export function modulePath(cx,cy,r,state){const p=(x,y)=>`${n(x)} ${n(y)}`;if(state.family==='lozenges'){r*=1.253314;return `M${p(cx,cy-r)}L${p(cx+r,cy)}L${p(cx,cy+r)}L${p(cx-r,cy)}Z`;}
 if(state.family==='squares'){r*=.95;const k=r*.43;return `M${p(cx-r+k,cy-r)}H${n(cx+r-k)}Q${p(cx+r,cy-r)} ${p(cx+r,cy-r+k)}V${n(cy+r-k)}Q${p(cx+r,cy+r)} ${p(cx+r-k,cy+r)}H${n(cx-r+k)}Q${p(cx-r,cy+r)} ${p(cx-r,cy+r-k)}V${n(cy-r+k)}Q${p(cx-r,cy-r)} ${p(cx-r+k,cy-r)}Z`;}
 const k=r*.55228475;return `M${p(cx+r,cy)}C${p(cx+r,cy-k)} ${p(cx+k,cy-r)} ${p(cx,cy-r)}C${p(cx-k,cy-r)} ${p(cx-r,cy-k)} ${p(cx-r,cy)}C${p(cx-r,cy+k)} ${p(cx-k,cy+r)} ${p(cx,cy+r)}C${p(cx+k,cy+r)} ${p(cx+r,cy+k)} ${p(cx+r,cy)}Z`;
}
// ── Perforation ──────────────────────────────────────────────────────────
// Walk each centerline and switch on the nearest grid site at every step, as a
// dot-matrix printer would: lines come out one module thick and unbroken.
export function bitmapFor(spec,detail=0,cols){if(spec==='E')return SOURCE_E;const sk=skeleton('perforated',spec,detail),bw=sk.x1-sk.x0,step=100/6,c=cols??Math.max(1,Math.round(bw/step)+1),pitch=c>1?bw/(c-1):step,on=Array.from({length:7},()=>Array(c).fill(0));
 for(const {pts,closed} of sk.polys){const run=closed?[...pts,pts[0]]:pts;for(let i=0;i<run.length;i++){const a=run[Math.max(0,i-1)],b=run[i],k=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(Math.min(step,pitch)/4)));for(let j=0;j<=k;j++){const x=a[0]+(b[0]-a[0])*j/k,y=a[1]+(b[1]-a[1])*j/k,col=c>1?Math.round((x-sk.x0)/pitch):0,row=Math.round(y/step);if(row>=0&&row<7&&col>=0&&col<c)on[row][col]=1;}}}
 return on.map(r=>r.join(''));}
const tailAt=(pattern,row,c)=>row<6&&c>0&&pattern[row][c-1]==='1'&&pattern[row+1][c]!=='1';
export function perforationNodes(spec,detail=0){const pattern=bitmapFor(spec,detail,5),nodes=[];for(let row=0;row<9;row++)for(let col=0;col<7;col++){const c=col-1,active=row<7&&c>=0&&c<5&&pattern[row][c]==='1',tail=active&&tailAt(pattern,row,c);nodes.push({col,row,active,tail});}return nodes;}
function dot(cx,cy,r,ctx,w){return path(modulePath(cx,cy,r,ctx.state),ctx.state.stage===1?'none':ctx.ink,ctx.state.stage===1?`stroke="${ctx.ink}" stroke-width="${n(w)}"`:'');}
function drip(cx,cy,r,cell,ctx){const s=ctx.state,end=cy+cell*s.params.tails,neck=`M${n(cx-r*.65)} ${n(cy+r*.6)}Q${n(cx)} ${n(cy+r)} ${n(cx-r*.12)} ${n(end)}H${n(cx+r*.12)}Q${n(cx)} ${n(cy+r)} ${n(cx+r*.65)} ${n(cy+r*.6)}Z`;return path(neck,s.stage===1?'none':ctx.ink,s.stage===1?`stroke="${ctx.ink}" stroke-width="${n(ctx.hair*.5)}"`:'')+dot(cx,end,cell*.055,ctx,ctx.hair*.5);}
// The atlas keeps the source's 7 × 9 grid, with a margin column each side.
export function perforatedAtlas(spec,x,y,cell,ctx){const s=ctx.state;let body='';for(const {col,row,active,tail} of perforationNodes(spec,s.params.detail)){const cx=col*cell,cy=row*cell,r=active?cell*.366*s.params.weight:cell*.048;body+=dot(cx,cy,r,ctx,ctx.hair*.55);if(tail&&s.params.tails>0)body+=drip(cx,cy,r,cell,ctx);}
 return `<g transform="translate(${n(x)} ${n(y)})"${s.stage===2?' opacity=".55"':''}>${body}</g>`;}
function perforated(spec,f,ctx){const s=ctx.state,pattern=bitmapFor(spec,s.params.detail),cols=pattern[0].length,cell=Math.min(f.w/cols,f.h/7),ox=f.x+(f.w-cols*cell)/2+cell/2,oy=f.y+(f.h-7*cell)/2+cell/2;let body='';
 for(let row=0;row<7;row++)for(let c=0;c<cols;c++){const active=pattern[row][c]==='1',cx=ox+c*cell,cy=oy+row*cell,r=active?cell*.366*s.params.weight:cell*.048;body+=dot(cx,cy,r,ctx,ctx.hair*.55);if(active&&tailAt(pattern,row,c)&&s.params.tails>0)body+=drip(cx,cy,r,cell,ctx);}
 return s.stage===2?`<g opacity=".55">${body}</g>`:body;}
// ── Stroked constructions ────────────────────────────────────────────────
function contour(spec,f,ctx){const s=ctx.state,sk=skeleton('contour',spec,s.params.detail),m=place(sk,f,PAD.contour(s),cxOf('contour',spec)),d=pathOf(mapped(sk,m,true),s.family),count=s.params.ribs,unit=14*wt(s,sk)*m.u/(count*2-1),style=`stroke-linecap="${s.family==='squares'?'round':'butt'}" stroke-linejoin="${s.family==='lozenges'?'bevel':'round'}"`;
 if(s.stage===1)return line(d,ctx.ink,ctx.hair);if(s.stage===2)return line(d,ctx.ink,(count*2-1)*unit,style+' opacity=".55"');let body='';for(let i=count*2-1;i>=1;i--)body+=line(d,i%2?ctx.ink:ctx.paper,i*unit,style);return body;}
function heavy(spec,f,ctx){const s=ctx.state,sk=skeleton('heavy',spec,s.params.detail),cx=CX.heavy,m=place(sk,f,PAD.heavy(s),cx),d=pathOf(G.mapRuns(sk.whole,m.sx/cx,m.sy,(m.tx-f.x)/cx,m.ty),s.family),style=`stroke-linecap="${s.family==='squares'?'round':'butt'}" stroke-linejoin="${s.family==='lozenges'?'bevel':'round'}"`;
 return `<g transform="translate(${n(f.x)} 0) scale(${cx} 1)">${s.stage===1?line(d,ctx.ink,ctx.hair*1.6):line(d,ctx.ink,19*wt(s,sk)*m.u,style+(s.stage===2?' opacity=".4"':''))}</g>`;}
function rails(spec,f,ctx){const s=ctx.state,sk=skeleton('rails',spec,s.params.detail),m=place(sk,f,PAD.rails(s),CX.rails),list=pieces(mapped(sk,m),26*m.u),width=7*wt(s,sk)*m.u,gap=width*.9+3*m.u,cap=`stroke-linecap="${s.family==='squares'?'round':'butt'}"`,q=p=>n(p[0])+' '+n(p[1]);
 if(s.stage===1)return line(list.map(([a,b])=>'M'+q(a)+'L'+q(b)).join(''),ctx.ink,ctx.hair);
 const joint=(p,i)=>list.some(([a,b],j)=>j!==i&&G.distanceToPolyline(p,[a,b])<.6*m.u);
 const d=list.map(([a,b],i)=>{if(s.stage===2)return 'M'+q(a)+'L'+q(b);const L=Math.hypot(b[0]-a[0],b[1]-a[1]),g=Math.min(gap,L*.3),ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L,ga=joint(a,i)?g:0,gb=joint(b,i)?g:0;return 'M'+q([a[0]+ux*ga,a[1]+uy*ga])+'L'+q([b[0]-ux*gb,b[1]-uy*gb]);}).join('');
 return line(d,ctx.ink,width,cap+(s.stage===2?' opacity=".4"':''));}
// The source A: a lit pyramid with wire edges.
function facetsA(f,ctx){const s=ctx.state,sx=f.w/100,sy=f.h/100,u=Math.min(sx,sy),d=s.params.bevel*35,A=p=>shapePath(p,{family:'discs'},sx,sy,f.x,f.y);
 const wire=line(A(`M5 98L50 0L95 98L50 85ZM50 0L${n(50-d)} 65L5 98M50 0L${n(50+d)} 65L95 98M${n(50-d)} 65H${n(50+d)}M5 98L50 85L95 98`),ctx.ink,s.stage===1?ctx.hair:1.3*u);
 if(s.stage===1)return wire;return wire+path(A(`M50 0L${n(50-d)} 65L5 98Z`),ctx.ink,`opacity="${s.stage===2?.35:.7}"`)+path(A(`M50 0L${n(50+d)} 65L95 98Z`),ctx.ink,`opacity="${s.stage===2?.35:.3}"`);}
// Shapes: every straight piece is a lozenge blade with a ridge. Faces turned
// toward the light are pale, faces turned away are dark.
function facets(spec,f,ctx){if(spec==='A')return facetsA(f,ctx);const s=ctx.state,sk=skeleton('facets',spec,s.params.detail),m=place(sk,f,PAD.facets(s),CX.facets),hwMax=(4+36*s.params.bevel)*wt(s,sk)*m.u,light=[-.6,-.8],q=p=>n(p[0])+' '+n(p[1]);let faces='',wire='',ridge='';
 for(const [a,b] of pieces(mapped(sk,m),30*m.u)){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),hw=Math.min(hwMax,L*.34),nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],l=[mid[0]+nx*hw,mid[1]+ny*hw],r=[mid[0]-nx*hw,mid[1]-ny*hw],lit=nx*light[0]+ny*light[1]>0;
  wire+='M'+[a,l,b,r].map(q).join('L')+'Z';ridge+='M'+q(a)+'L'+q(b);
  if(s.stage>=2)faces+=path('M'+[a,l,b].map(q).join('L')+'Z',ctx.ink,`opacity="${s.stage===2?.35:lit?.28:.74}"`)+path('M'+[a,r,b].map(q).join('L')+'Z',ctx.ink,`opacity="${s.stage===2?.35:lit?.74:.28}"`);}
 return faces+line(wire,ctx.ink,s.stage===1?ctx.hair:Math.max(ctx.hair,1.1*m.u),'stroke-linejoin="round"')+(s.stage===1?'':line(ridge,ctx.ink,Math.max(ctx.hair,1.4*m.u)));}
// ── Overlap lenses ───────────────────────────────────────────────────────
export function overlapParts(spec,f,s){const r=s.params.weight;
 if(spec==='G'){const sx=f.w/100,sy=f.h/116,u=Math.min(sx,sy);return [shapePath(G_PARTS[0],s,sx,sy,f.x,f.y),modulePath(f.x+50*sx,f.y+22*sy,22*r*u,s),shapePath(G_PARTS[1],s,sx,sy,f.x,f.y),shapePath(G_PARTS[2],s,sx,sy,f.x,f.y)];}
 // A stroke that reaches another at an open angle overshoots it by half a
 // width, so the joint becomes a full lens. Strokes meeting at acute or
 // tangent angles, or too short to carry a lens, join into one shape instead.
 const sk=skeleton('overlap',spec,s.params.detail),m=place(sk,f,PAD.overlap(s),CX.overlap),W=26*r*(sk.weight??1)*m.u,polys=mapped(sk,m).map(run=>({pts:[...G.points(run,s.family==='lozenges'?3:0)],closed:run.closed})),group=polys.map((_,i)=>i),root=i=>group[i]===i?i:group[i]=root(group[i]);
 const touch=(p,dir,i)=>{for(const [j,q] of polys.entries()){if(j===i)continue;const run=q.closed?[...q.pts,q.pts[0]]:q.pts;for(let k=1;k<run.length;k++){const a=run[k-1],b=run[k];if(G.distanceToPolyline(p,[a,b])<.8*m.u){const tx=b[0]-a[0],ty=b[1]-a[1];return {j,cos:Math.abs(dir[0]*tx+dir[1]*ty)/((Math.hypot(...dir)*Math.hypot(tx,ty))||1)};}}}return null;};
 polys.forEach(({pts,closed},i)=>{if(closed||pts.length<2)return;for(const [e,o] of [[0,1],[pts.length-1,pts.length-2]]){const dir=[pts[e][0]-pts[o][0],pts[e][1]-pts[o][1]],hit=touch(pts[e],dir,i);if(!hit)continue;if(hit.cos>.62||Math.min(G.polyLength(pts),G.polyLength(polys[hit.j].pts,polys[hit.j].closed))<1.7*W){group[root(i)]=root(hit.j);continue;}const L=Math.hypot(...dir)||1;pts[e]=[pts[e][0]+dir[0]/L*W*.5,pts[e][1]+dir[1]/L*W*.5];}});
 // Merged strokes that meet end to end are chained into one polyline, so the
 // family's join shapes the corner instead of two overlapping caps.
 const groups=new Map();polys.forEach((p,i)=>groups.set(root(i),[...(groups.get(root(i))??[]),p]));
 return [...groups.values()].map(list=>{const o=G.union(...chain(list,.05*m.u).map(({pts,closed})=>G.strokeOutline(pts,closed,W,strokeStyle(s.family))));return G.toPath(s.family==='squares'?G.soften(o,W*.3):o);}).filter(Boolean);}
function chain(list,eps){const open=list.filter(p=>!p.closed).map(p=>[...p.pts]),done=list.filter(p=>p.closed),near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<eps;
 for(let merged=true;merged;){merged=false;for(let i=0;i<open.length&&!merged;i++)for(let j=0;j<open.length&&!merged;j++){if(i===j)continue;const a=open[i],b=open[j];let joined=null;
  if(near(a[a.length-1],b[0]))joined=[...a,...b.slice(1)];else if(near(a[a.length-1],b[b.length-1]))joined=[...a,...[...b].reverse().slice(1)];else if(near(a[0],b[0]))joined=[...[...a].reverse(),...b.slice(1)];
  if(joined){open.splice(Math.max(i,j),1);open.splice(Math.min(i,j),1);open.push(joined);merged=true;}}}
 return [...done,...open.map(pts=>near(pts[0],pts[pts.length-1])&&pts.length>3?{pts:pts.slice(0,-1),closed:true}:{pts,closed:false})];}
export function overlap(spec,f,ctx){const parts=overlapParts(spec,f,ctx.state),s=ctx.state;if(s.stage===1)return parts.map(d=>line(d,ctx.ink,ctx.hair*.8)).join('');if(s.stage===2)return parts.map(d=>path(d,ctx.ink,'opacity=".4"')).join('');return path(parts.join(''),ctx.ink,'fill-rule="evenodd"');}
// ── Linked modules ───────────────────────────────────────────────────────
// Modules keep one spacing, set by the source S's node count, so short
// strokes get fewer modules rather than crowding.
export function nodesFor(spec,count,detail=0){if(spec==='S')return count===18?S_N.map(p=>[...p]):G.stations(S_N.map(p=>p.slice(0,2)),count).map(p=>[...p,11*S_K]);
 const sk=skeleton('linked',spec,detail),spacing=S_LENGTH/(count-1),out=[];for(const {pts,closed} of sk.polys){const L=G.polyLength(pts,closed),k=closed?Math.max(3,Math.round(L/spacing)):Math.max(2,Math.round(L/spacing)+1);for(const p of G.stations(pts,k,closed))if(!out.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<spacing*.45))out.push(p);}
 return out.map((p,i)=>[p[0],p[1],11*(.86+.28*jitter(keyOf(spec)+i))]);}
function linked(spec,f,ctx,small=false){const s=ctx.state,nodes=small?nodesFor(spec,Math.max(7,Math.round(s.params.nodes*.5)),s.params.detail).map(p=>[p[0],p[1],17*S_K]):nodesFor(spec,s.params.nodes,s.params.detail),box=spec==='S'?S_BOX:skeleton('linked',spec,s.params.detail),m=place(box,f,(small?18:13)*s.params.weight+1,CX.linked);
 return nodes.map(([x,y,r])=>path(modulePath(x*m.sx+m.tx,y*m.sy+m.ty,r*s.params.weight*(box.weight??1)*m.u,s),s.stage===1?'none':ctx.ink,s.stage===1?`stroke="${ctx.ink}" stroke-width="${n(ctx.hair*.8)}"`:s.stage===2?'opacity=".4"':'')).join('');}
// ── Folded planes ────────────────────────────────────────────────────────
function gradient(ctx){const id=ctx.uid('fold');return [id,`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ctx.paper}"/><stop offset=".45" stop-color="${ctx.ink}" stop-opacity=".55"/><stop offset="1" stop-color="${ctx.ink}"/></linearGradient></defs>`];}
// The source P: an authored ribbon with its side plane.
function foldedP(f,ctx){const s=ctx.state,depth=s.params.bevel*100,[gid,defs]=gradient(ctx),d=shapePath(`M0 28L${depth} 0H65C101 0 111 22 100 50C91 75 72 91 45 91H${depth}V163L0 181ZM${depth} 24H52C73 24 87 30 81 44C76 57 62 62 44 62H${depth}Z`,s);let body=path(d,s.stage===1?'none':s.stage===2?ctx.ink:`url(#${gid})`,`fill-rule="evenodd"${s.stage===1?` stroke="${ctx.ink}" stroke-width=".6"`:''}`);
 if(s.stage>=2)body+=path(`M0 28L${depth} 0V163L0 181Z`,ctx.ink)+path(`M${depth} 0H65L52 24H${depth}Z`,ctx.ink,'opacity=".25"');return `<g transform="translate(${n(f.x)} ${n(f.y)}) scale(${n(f.w/110)} ${n(f.h/181)})">${defs}${body}</g>`;}
// Shapes: a stroked front face swept down-left into side planes.
function folded(spec,f,ctx){if(spec==='P')return foldedP(f,ctx);const s=ctx.state,sk=skeleton('folded',spec,s.params.detail),m=place(sk,f,PAD.folded(s),CX.folded),depth=55*s.params.bevel*m.u,front=G.union(...outlines(mapped(sk,m),s,22*wt(s,sk)*m.u)),side=G.minus(G.sweep(front,-.62*depth,depth),front),F=G.toPath(front),S=G.toPath(side);
 if(s.stage===1)return line(F+S,ctx.ink,ctx.hair*.8);if(s.stage===2)return path(S,ctx.ink,'opacity=".4"')+path(F,ctx.ink,'opacity=".4"');const [gid,defs]=gradient(ctx);return defs+path(S,ctx.ink)+path(F,`url(#${gid})`)+line(F,ctx.ink,Math.max(ctx.hair,.9*m.u));}
// ── Public entry points ──────────────────────────────────────────────────
const BUILDERS={contour,facets,overlap,perforated,linked,folded,rails,heavy};
export function construct(c,spec,f,ctx,small){return BUILDERS[c](spec,f,ctx,small);}
// Width ÷ height of a spec's natural frame in one construction.
export function aspectOf(c,spec,s){if(c==='perforated')return bitmapFor(spec,s.params.detail)[0].length/7;if(c==='overlap'&&spec==='G')return 100/116;if(c==='facets'&&spec==='A')return .91;if(c==='folded'&&spec==='P')return 110/181;
 const box=c==='linked'&&spec==='S'?S_BOX:skeleton(c,spec,s.params.detail),p=PAD[c](s);return (Math.max(box.x1-box.x0,1)*cxOf(c,spec)+2*p)/(100+2*p);}
// A plain monoline of a shape: the atlas's stand-in for supporting letters.
export function monoline(spec,f,ctx,pad){const s=ctx.state,sk=skeleton('monoline',spec,s.params.detail),m=place(sk,f,pad,1),d=pathOf(mapped(sk,m,true),s.family);return s.stage===1?line(d,ctx.ink,ctx.hair):line(d,ctx.ink,2*pad*m.u,`stroke-linecap="round" stroke-linejoin="round"${s.stage===2?' opacity=".55"':''}`);}
