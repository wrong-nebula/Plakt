/* Geometry kernel: seeded randomness, centripetal Catmull–Rom splines,
 * arc-length resampling, bending, rope relaxation, self-crossings and the
 * over/under assignment. Pure functions on [x, y] arrays, no dependencies.
 */
import ClipperLib from 'clipper-lib';
const {Clipper,ClipperOffset,ClipType,PolyType,PolyFillType,JoinType,EndType}=ClipperLib;
export const TAU=2*Math.PI;
export const r1=v=>Math.round(v*10)/10,r3=v=>Math.round(v*1000)/1000;
export const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// mulberry32 on a scrambled seed: the same seed always gives the same stream.
export function rng(seed){let a=(Math.floor(Math.abs(seed))*2654435761^0x9e3779b9)>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export const rot=([x,y],a)=>{const c=Math.cos(a),s=Math.sin(a);return [x*c-y*s,x*s+y*c];};

// Centripetal Catmull–Rom through the points (no cusps or loops between close points).
export function catmullRom(P,per=20,closed=false){const n=P.length;if(n<2)return P.map(p=>p.slice());
 const get=i=>closed?P[(i%n+n)%n]:i<0?[2*P[0][0]-P[1][0],2*P[0][1]-P[1][1]]:i>=n?[2*P[n-1][0]-P[n-2][0],2*P[n-1][1]-P[n-2][1]]:P[i],out=[],segs=closed?n:n-1;
 for(let i=0;i<segs;i++){const p0=get(i-1),p1=get(i),p2=get(i+1),p3=get(i+2),tj=(a,b)=>Math.max(1e-4,Math.sqrt(dist(a,b))),t1=tj(p0,p1),t2=t1+tj(p1,p2),t3=t2+tj(p2,p3);
  for(let k=0;k<per;k++){const t=t1+(t2-t1)*k/per,L=(a,b,ta,tb)=>[(a[0]*(tb-t)+b[0]*(t-ta))/(tb-ta),(a[1]*(tb-t)+b[1]*(t-ta))/(tb-ta)],A1=L(p0,p1,0,t1),A2=L(p1,p2,t1,t2),A3=L(p2,p3,t2,t3);out.push(L(L(A1,A2,0,t2),L(A2,A3,t1,t3),t1,t2));}}
 if(!closed)out.push(P[n-1].slice());return out;}

export function cumulative(pts,closed){const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+dist(pts[i-1],pts[i]));return {s,L:closed?s[s.length-1]+dist(pts[pts.length-1],pts[0]):s[s.length-1]};}
// Point at arc length t (wrapping on closed curves).
export function pointAt(pts,cum,closed,t){const {s,L}=cum,m=pts.length;if(closed){t=((t%L)+L)%L;}else t=Math.max(0,Math.min(L,t));
 let lo=0,hi=m-1;if(closed&&t>=s[m-1]){const a=pts[m-1],b=pts[0],u=(t-s[m-1])/Math.max(1e-12,L-s[m-1]);return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];}
 while(hi-lo>1){const mid=(lo+hi)>>1;if(s[mid]<=t)lo=mid;else hi=mid;}const a=pts[lo],b=pts[hi],u=(t-s[lo])/Math.max(1e-12,s[hi]-s[lo]);return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];}
export function resample(pts,count,closed){const cum=cumulative(pts,closed);return Array.from({length:count},(_,i)=>pointAt(pts,cum,closed,closed?cum.L*i/count:cum.L*i/(count-1)));}
// Sub-polyline between arc lengths a < b (b may pass L on closed curves).
export function slice(pts,cum,closed,a,b){const out=[pointAt(pts,cum,closed,a)],{s,L}=cum,m=pts.length;
 if(closed){for(let lap=Math.floor(a/L)*L;lap<b;lap+=L)for(let i=0;i<m;i++){const v=s[i]+lap;if(v>a&&v<b)out.push(pts[i]);}}else for(let i=0;i<m;i++)if(s[i]>a&&s[i]<b)out.push(pts[i]);
 out.push(pointAt(pts,cum,closed,b));
 // Drop vertices within half a unit of the previous one (keeping both ends): near-zero segments
 // would get a meaningless direction (and a turned butt end) once rounded to Clipper's grid.
 const clean=[out[0]];for(let i=1;i<out.length;i++){if(dist(out[i],clean[clean.length-1])>=.5)clean.push(out[i]);else if(i===out.length-1)clean[clean.length-1]=out[i];}if(clean.length<2)clean.push(out[out.length-1]);return clean;}
// Unit tangent at arc length t.
export function tangentAt(pts,cum,closed,t,h){const a=pointAt(pts,cum,closed,t-h),b=pointAt(pts,cum,closed,t+h),d=dist(a,b)||1;return [(b[0]-a[0])/d,(b[1]-a[1])/d];}

// Adds `turn` radians of turning to an equally spaced open polyline: the first
// segment keeps its direction, the last turns by exactly `turn`. `focus` 0
// spreads the turning evenly (a circular arc on a straight limb); 1 adds
// curvature in proportion to length (an Euler spiral curling into the tip).
export const bendAt=(x,focus)=>(1-focus)*x+focus*x*x;
export function bend(pts,turn,focus=0){if(!turn||pts.length<3)return pts.map(p=>p.slice());const m=pts.length,out=[pts[0].slice()];
 for(let i=1;i<m;i++){const [dx,dy]=rot([pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]],turn*bendAt((i-1)/(m-2),focus));out.push([out[i-1][0]+dx,out[i-1][1]+dy]);}return out;}
// Total signed turning of a polyline (radians).
export function turning(pts){let t=0;for(let i=2;i<pts.length;i++){const a=Math.atan2(pts[i-1][1]-pts[i-2][1],pts[i-1][0]-pts[i-2][0]),b=Math.atan2(pts[i][1]-pts[i-1][1],pts[i][0]-pts[i-1][0]);let d=b-a;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;t+=d;}return t;}

// Rope relaxation: strands that run side by side closer than `radius` push
// apart (crossing strands are left alone, so crossings survive), a light
// Laplacian keeps them smooth, and points are re-spaced every pass. Pinned
// ends (open strands) stay fixed with their end tangent. Points stay inside `bound`.
export function relax(strands,{iterations,radius,bound,aspect=1,pin=3}){if(!iterations)return strands;
 const K=strands.length,ms=strands.map(st=>st.pts.length),off=[0];for(const m of ms)off.push(off[off.length-1]+m);const N=off[K],X=new Float64Array(N),Y=new Float64Array(N),TX=new Float64Array(N),TY=new Float64Array(N),FX=new Float64Array(N),FY=new Float64Array(N),SK=new Int32Array(N),IX=new Int32Array(N);
 strands.forEach((st,k)=>st.pts.forEach((q,i)=>{X[off[k]+i]=q[0];Y[off[k]+i]=q[1];SK[off[k]+i]=k;IX[off[k]+i]=i;}));
 const G=Math.ceil(2*bound*Math.max(1,aspect)/radius)+3,cellOf=new Int32Array(N),count=new Int32Array(G*G+1),items=new Int32Array(N),cl=v=>Math.max(0,Math.min(G-1,Math.floor((v+bound*Math.max(1,aspect))/radius)+1));
 const prev=(k,i)=>strands[k].closed?(i-1+ms[k])%ms[k]:Math.max(0,i-1),next=(k,i)=>strands[k].closed?(i+1)%ms[k]:Math.min(ms[k]-1,i+1),fixed=(k,i)=>!strands[k].closed&&(i<pin||i>=ms[k]-pin);
 for(let it=0;it<iterations;it++){
  for(let n=0;n<N;n++){const k=SK[n],i=IX[n],a=off[k]+prev(k,i),b=off[k]+next(k,i),dx=X[b]-X[a],dy=Y[b]-Y[a],d=Math.hypot(dx,dy)||1;TX[n]=dx/d;TY[n]=dy/d;FX[n]=0;FY[n]=0;}
  // Counting sort of points into grid cells.
  count.fill(0);for(let n=0;n<N;n++){cellOf[n]=cl(X[n])*G+cl(Y[n]);count[cellOf[n]+1]++;}for(let c=0;c<G*G;c++)count[c+1]+=count[c];const fill=count.slice();for(let n=0;n<N;n++)items[fill[cellOf[n]]++]=n;
  const skip=strands.map((st,k)=>Math.ceil(radius*1.6/(Math.hypot(X[off[k]+1]-X[off[k]],Y[off[k]+1]-Y[off[k]])||1))+1);
  for(let n=0;n<N;n++){const gx=Math.floor(cellOf[n]/G),gy=cellOf[n]%G,k=SK[n];for(let x=Math.max(0,gx-1);x<=Math.min(G-1,gx+1);x++)for(let y=Math.max(0,gy-1);y<=Math.min(G-1,gy+1);y++){const c=x*G+y;for(let e=count[c];e<count[c+1];e++){const j=items[e];if(j<=n)continue;
   if(SK[j]===k){const d=Math.abs(IX[n]-IX[j]);if(Math.min(d,strands[k].closed?ms[k]-d:d)<skip[k])continue;}
   const dx=X[n]-X[j],dy=Y[n]-Y[j],d=Math.hypot(dx,dy);if(d>=radius||d<1e-9)continue;const align=(Math.abs(TX[n]*TX[j]+TY[n]*TY[j])-.4)/.6;if(align<=0)continue;
   const f=.25*(radius-d)*align/d;FX[n]+=dx*f;FY[n]+=dy*f;FX[j]-=dx*f;FY[j]-=dy*f;}}}
  for(let k=0;k<K;k++){const m=ms[k],o=off[k],x=new Float64Array(m),y=new Float64Array(m);
   for(let i=0;i<m;i++){x[i]=X[o+i]+(fixed(k,i)?0:FX[o+i]);y[i]=Y[o+i]+(fixed(k,i)?0:FY[o+i]);}
   for(let i=0;i<m;i++){if(fixed(k,i))continue;const a=prev(k,i),b=next(k,i);let qx=x[i]+.22*(x[a]+x[b]-2*x[i]),qy=y[i]+.22*(y[a]+y[b]-2*y[i]);const r=Math.hypot(qx,qy/aspect);if(r>bound){qx*=bound/r;qy*=bound/r;}X[o+i]=qx;Y[o+i]=qy;}
   // Re-space the free part at equal arc length (a linear walk).
   const lo=strands[k].closed?0:pin-1,hi=strands[k].closed?m:m-pin,cnt=hi-lo+(strands[k].closed?0:1),px=[],py=[],acc=[0];for(let i=0;i<cnt;i++){const q=o+lo+(i%m);px.push(X[q]);py.push(Y[q]);if(i)acc.push(acc[i-1]+Math.hypot(px[i]-px[i-1],py[i]-py[i-1]));}
   if(strands[k].closed){px.push(px[0]);py.push(py[0]);acc.push(acc[cnt-1]+Math.hypot(px[cnt]-px[cnt-1],py[cnt]-py[cnt-1]));}
   const total=acc[acc.length-1],steps=strands[k].closed?cnt:cnt-1;let seg=0;for(let i=strands[k].closed?0:1;i<(strands[k].closed?cnt:cnt-1);i++){const t=total*i/steps;while(seg<acc.length-2&&acc[seg+1]<t)seg++;const u=(t-acc[seg])/Math.max(1e-12,acc[seg+1]-acc[seg]);X[o+lo+i]=px[seg]+(px[seg+1]-px[seg])*u;Y[o+lo+i]=py[seg]+(py[seg+1]-py[seg])*u;}}}
 return strands.map((st,k)=>({...st,pts:Array.from({length:ms[k]},(_,i)=>[X[off[k]+i],Y[off[k]+i]])}));}

// Every crossing between and within strands ({pts, closed}). Segments go into
// a uniform grid; a pair is tested only in the grid cell holding the low corner
// of the overlap of their boxes, so each pair is tested once. Segments are
// half-open, so a crossing through a shared vertex counts once. Neighbouring
// segments of one strand never cross.
export function findCrossings(strands){const segs=[];
 strands.forEach((st,k)=>{const m=st.pts.length,cnt=st.closed?m:m-1,{s}=cumulative(st.pts,st.closed);for(let i=0;i<cnt;i++){const a=st.pts[i],b=st.pts[(i+1)%m],len=dist(a,b);if(len>1e-9)segs.push({k,i,a,b,s0:s[i],len,cnt,closed:st.closed});}});
 if(!segs.length)return [];let cell=0;for(const g of segs)cell=Math.max(cell,g.len);cell*=1.5;const grid=new Map(),K=(x,y)=>x+':'+y,out=[];
 segs.forEach((g,idx)=>{const x0=Math.floor(Math.min(g.a[0],g.b[0])/cell),x1=Math.floor(Math.max(g.a[0],g.b[0])/cell),y0=Math.floor(Math.min(g.a[1],g.b[1])/cell),y1=Math.floor(Math.max(g.a[1],g.b[1])/cell);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const k=K(x,y);if(!grid.has(k))grid.set(k,{x,y,list:[]});grid.get(k).list.push(idx);}});
 for(const {x,y,list} of grid.values())for(let p=0;p<list.length;p++)for(let q=p+1;q<list.length;q++){const A=segs[list[p]],B=segs[list[q]];
  if(A.k===B.k){const d=Math.abs(A.i-B.i);if(d<=1||A.closed&&d===A.cnt-1)continue;}
  const lx=Math.max(Math.min(A.a[0],A.b[0]),Math.min(B.a[0],B.b[0])),ly=Math.max(Math.min(A.a[1],A.b[1]),Math.min(B.a[1],B.b[1]));if(Math.floor(lx/cell)!==x||Math.floor(ly/cell)!==y)continue;
  const rx=A.b[0]-A.a[0],ry=A.b[1]-A.a[1],sx=B.b[0]-B.a[0],sy=B.b[1]-B.a[1],den=rx*sy-ry*sx;if(Math.abs(den)<1e-12*A.len*B.len)continue;
  const qx=B.a[0]-A.a[0],qy=B.a[1]-A.a[1],t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;if(t<0||t>=1||u<0||u>=1)continue;
  const da=[rx/A.len,ry/A.len],db=[sx/B.len,sy/B.len],cos=Math.abs(da[0]*db[0]+da[1]*db[1]);
  out.push({p:[A.a[0]+rx*t,A.a[1]+ry*t],angle:Math.acos(Math.min(1,cos)),occ:[{strand:A.k,s:A.s0+t*A.len,dir:da},{strand:B.k,s:B.s0+u*B.len,dir:db}]});}
 // Stable order: by the first occurrence along the strands.
 for(const c of out)c.occ.sort((a,b)=>a.strand-b.strand||a.s-b.s);out.sort((a,b)=>a.occ[0].strand-b.occ[0].strand||a.occ[0].s-b.occ[0].s);out.forEach((c,i)=>c.id=i);return out;}

// Removes kinks: a strand that crosses itself and returns within `minLoop`
// draws a loop too small to read as a tube. The loop is cut out at its
// crossing point (a Reidemeister I move), one at a time, until none is left.
export function unkink(strands,minLoop){let S=strands.map(st=>({...st,pts:st.pts.map(p=>p.slice())}));
 for(let pass=0;pass<40;pass++){const cr=findCrossings(S),hit=cr.find(c=>c.occ[0].strand===c.occ[1].strand&&(()=>{const st=S[c.occ[0].strand],L=cumulative(st.pts,st.closed).L,d=c.occ[1].s-c.occ[0].s;return Math.min(d,st.closed?L-d:Infinity)<minLoop;})());if(!hit)break;
  const k=hit.occ[0].strand,st=S[k],{s,L}=cumulative(st.pts,st.closed),a=hit.occ[0].s,b=hit.occ[1].s,m=st.pts.length,inner=b-a<=L-(b-a)||!st.closed;
  const keep=st.pts.filter((_,i)=>inner?s[i]<=a||s[i]>=b:s[i]>a&&s[i]<b),at=inner?keep.findIndex((_,i)=>s[st.pts.indexOf(keep[i])]>=b):keep.length;keep.splice(at<0?keep.length:at,0,hit.p.slice());
  S[k]={...st,pts:smooth(resample(keep,m,st.closed),st.closed,keep.indexOf(hit.p)/keep.length)};}
 return S;}
// Laplacian smoothing around fraction `at` of a strand (where a kink was cut), so no corner is left.
function smooth(pts,closed,at){const m=pts.length,c=Math.round(at*m),w=Math.max(6,Math.round(m*.03));let P=pts.map(p=>p.slice());
 for(let it=0;it<12;it++){const Q=P.map(p=>p.slice());for(let d=-w;d<=w;d++){const i=closed?((c+d)%m+m)%m:c+d;if(i<1||!closed&&i>m-2)continue;const a=P[closed?(i-1+m)%m:i-1],b=P[(i+1)%m];Q[i]=[P[i][0]+.4*(a[0]+b[0]-2*P[i][0]),P[i][1]+.4*(a[1]+b[1]-2*P[i][1])];}P=Q;}return P;}

// Over/under. Each crossing gets one over and one under occurrence.
//  alternate: along every strand the occurrences alternate over, under, over…
//   Solved as parity constraints between crossings (x_c says which occurrence
//   is over); a closed single curve always satisfies them (Gauss), open or
//   several strands may not, and the violated steps are counted as breaks.
//  laid: the later point along the strands lies on top, like rope laid down.
//  depth: the higher z (from the curve's own 3-D lift) is over.
//  seeded: a seeded coin per crossing.
export function assignCrossings(crossings,strands,pattern,{seed=1,z}={}){const occ=[];crossings.forEach((c,ci)=>c.occ.forEach((o,j)=>occ.push({c:ci,j,strand:o.strand,s:o.s})));
 const by=strands.map((_,k)=>occ.filter(o=>o.strand===k).sort((a,b)=>a.s-b.s)),x=new Array(crossings.length).fill(-1);
 if(pattern==='alternate'){const adj=crossings.map(()=>[]);
  by.forEach((L,k)=>{const steps=L.length-1+(strands[k].closed&&L.length>1?1:0);for(let i=0;i<steps;i++){const a=L[i],b=L[(i+1)%L.length];if(a.c===b.c)continue;const parity=1^a.j^b.j;adj[a.c].push([b.c,parity]);adj[b.c].push([a.c,parity]);}});
  const order=by.flat();for(const start of order){if(x[start.c]!==-1)continue;x[start.c]=start.j;const queue=[start.c];while(queue.length){const c=queue.shift();for(const [d,p] of adj[c])if(x[d]===-1){x[d]=x[c]^p;queue.push(d);}}}}
 else if(pattern==='laid')crossings.forEach((c,i)=>x[i]=1);
 else if(pattern==='depth')crossings.forEach((c,i)=>{const [a,b]=c.occ;x[i]=z(a.strand,a.s)>=z(b.strand,b.s)?0:1;});
 else{const R=rng(seed*7+13);crossings.forEach((c,i)=>x[i]=R()<.5?0:1);}
 crossings.forEach((c,i)=>{c.over=x[i];c.occ.forEach((o,j)=>o.role=j===x[i]?'over':'under');});
 // Breaks: consecutive occurrences along a strand with the same role.
 let breaks=0;by.forEach((L,k)=>{const steps=L.length-1+(strands[k].closed&&L.length>1?1:0);for(let i=0;i<steps;i++){const a=L[i],b=L[(i+1)%L.length];if(crossings[a.c].occ[a.j].role===crossings[b.c].occ[b.j].role)breaks++;}});
 return {breaks,byStrand:by.map(L=>L.map(o=>({c:o.c,s:o.s,role:crossings[o.c].occ[o.j].role})))};}

// Colour: hex ↔ OKLab / OKLCH, mixing in OKLab, hue walks clipped into sRGB by chroma.
const lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;},gam=v=>{v=Math.max(0,Math.min(1,v));return Math.round((v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055)*255);};
export const rgbOf=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export function toLab(h){const [r,g,b]=rgbOf(h).map(lin),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
function labRGB([L,a,b]){const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];}
const hex=rgb=>'#'+rgb.map(v=>gam(v).toString(16).padStart(2,'0')).join('');
export const fromLab=lab=>hex(labRGB(lab));
export const mix=(a,b,t)=>{const A=toLab(a),B=toLab(b);return fromLab(A.map((v,i)=>v+(B[i]-v)*t));};
export function hueWalk(base,turn){const [L,a,b]=toLab(base);let C=Math.max(.12,Math.hypot(a,b));const h=Math.atan2(b,a)+turn;let rgb=labRGB([L,C*Math.cos(h),C*Math.sin(h)]);for(let i=0;i<30&&rgb.some(v=>v<-1e-4||v>1+1e-4);i++){C*=.9;rgb=labRGB([L,C*Math.cos(h),C*Math.sin(h)]);}return hex(rgb);}
export const luminance=h=>{const [r,g,b]=rgbOf(h).map(lin);return .2126*r+.7152*g+.0722*b;};
export const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};

// Tube polygons with Clipper (integer coordinates at 1/64 unit): an open
// polyline swept by a disc of radius `half` with butt ends, minus bands (open
// polylines with their own half widths). Returns path data, non-zero fill.
const SC=64,toC=pts=>pts.map(([x,y])=>({X:Math.round(x*SC),Y:Math.round(y*SC)}));
function sweep(pts,half){const co=new ClipperOffset(2,.2*SC),out=[];co.AddPath(toC(pts),JoinType.jtRound,EndType.etOpenButt);co.Execute(out,half*SC);return out;}
// A band with `disc` {c, r} is first clipped to that disc, so a band that follows
// a sharply curving over strand cannot bite the under tube a second time.
function disc({c,r}){return [Array.from({length:72},(_,i)=>({X:Math.round((c[0]+r*Math.cos(i*TAU/72))*SC),Y:Math.round((c[1]+r*Math.sin(i*TAU/72))*SC)}))];}
function bandShape(b){const s=sweep(b.pts,b.half);if(!b.disc)return s;const c=new Clipper(),out=[];c.AddPaths(s,PolyType.ptSubject,true);c.AddPaths(disc(b.disc),PolyType.ptClip,true);c.Execute(ClipType.ctIntersection,out,PolyFillType.pftNonZero,PolyFillType.pftNonZero);return out;}
export function tubeMinus(pts,half,bands){let shape=sweep(pts,half);if(bands.length){const cut=bands.flatMap(bandShape),c=new Clipper(),out=[];c.AddPaths(shape,PolyType.ptSubject,true);c.AddPaths(cut,PolyType.ptClip,true);c.Execute(ClipType.ctDifference,out,PolyFillType.pftNonZero,PolyFillType.pftNonZero);shape=out;}
 return shape.map(r=>'M'+r.map(q=>r1(q.X/SC)+' '+r1(q.Y/SC)).join('L')+'Z').join('');}
