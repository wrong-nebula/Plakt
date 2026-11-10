/* Shared construction geometry for the reciprocal module system.
 * Primitives are authored as cubic path strings, so each shape family can
 * transform their curve handles. Booleans then build one ink region per glyph
 * and a single corner pass rounds convex corners and fillets joins.
 */
import ClipperLib from 'clipper-lib';

export const n=v=>+(+v).toFixed(3);
const SCALE=1000,K=.5523;

// Closed rectangle, clockwise on screen.
export const rectD=(x1,y1,x2,y2)=>`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y1)}L${n(x2)} ${n(y2)}L${n(x1)} ${n(y2)}Z`;
// Rounded box whose corners are elliptical quarters. With full radii it is an ellipse.
export function slotD(x1,y1,x2,y2,rx=(x2-x1)/2,ry=(y2-y1)/2){
 rx=Math.min(rx,(x2-x1)/2);ry=Math.min(ry,(y2-y1)/2);const kx=K*rx,ky=K*ry;
 return `M${n(x1+rx)} ${n(y1)}L${n(x2-rx)} ${n(y1)}C${n(x2-rx+kx)} ${n(y1)} ${n(x2)} ${n(y1+ry-ky)} ${n(x2)} ${n(y1+ry)}L${n(x2)} ${n(y2-ry)}C${n(x2)} ${n(y2-ry+ky)} ${n(x2-rx+kx)} ${n(y2)} ${n(x2-rx)} ${n(y2)}L${n(x1+rx)} ${n(y2)}C${n(x1+rx-kx)} ${n(y2)} ${n(x1)} ${n(y2-ry+ky)} ${n(x1)} ${n(y2-ry)}L${n(x1)} ${n(y1+ry)}C${n(x1)} ${n(y1+ry-ky)} ${n(x1+rx-kx)} ${n(y1)} ${n(x1+rx)} ${n(y1)}Z`;
}
export const pillD=(x1,y1,x2,y2)=>slotD(x1,y1,x2,y2,Math.min(x2-x1,y2-y1)/2,Math.min(x2-x1,y2-y1)/2);

// One concave shoulder pair between two corners, reaching `reach` along the
// outward normal at the midpoint. Each shoulder is the parabola measured on
// the reference N (outward = reach·(s/half)²): it leaves the corner along the
// side and flares into the tip. Negative reach makes a notch.
function shoulders(a,b,out,reach){
 const u=[(b[0]-a[0])/2,(b[1]-a[1])/2],p=(s,r)=>`${n(a[0]+u[0]*s+out[0]*r)} ${n(a[1]+u[1]*s+out[1]*r)}`;
 return `C${p(1/3,0)} ${p(2/3,reach/3)} ${p(1,reach)}C${p(4/3,reach/3)} ${p(5/3,0)} ${p(2,0)}`;
}
// Body box with an optional tip on each side: {T,R,B,L} -> reach.
export function frameD([x0,y0,x1,y1],tips={}){
 const sides=[[[x0,y0],[x1,y0],[0,-1],tips.T],[[x1,y0],[x1,y1],[1,0],tips.R],[[x1,y1],[x0,y1],[0,1],tips.B],[[x0,y1],[x0,y0],[-1,0],tips.L]];
 return `M${n(x0)} ${n(y0)}`+sides.map(([a,b,out,r])=>r?shoulders(a,b,out,r):`L${n(b[0])} ${n(b[1])}`).join('')+'Z';
}
// Region removed from a side: the inverse of a tip, centred at `at`.
export function notchD(side,[x0,y0,x1,y1],at,half,depth){
 const o={T:[0,-1],R:[1,0],B:[0,1],L:[-1,0]}[side],edge={T:y0,R:x1,B:y1,L:x0}[side],h=side==='T'||side==='B';
 const a=h?[at-half,edge]:[edge,at-half],b=h?[at+half,edge]:[edge,at+half],far=4;
 return `M${n(a[0]+o[0]*far)} ${n(a[1]+o[1]*far)}L${n(a[0])} ${n(a[1])}`+shoulders(a,b,o,-depth)+`L${n(b[0]+o[0]*far)} ${n(b[1]+o[1]*far)}Z`;
}

// Transform every curve with the family's rule. Quadratics are promoted to
// cubics first, so no family leaves hidden circular remnants.
export function familyPath(d,family,fullness){
 const tokens=d.match(/[A-Z]|-?(?:\d*\.)?\d+/g),arity={M:2,L:2,H:1,V:1,C:6,Q:4,Z:0};let i=0,x=0,y=0,sx=0,sy=0,out='';
 const pp=(a,b)=>`${n(a)} ${n(b)}`,full=fullness*(family==='lens'?.2:1);
 while(i<tokens.length){const cmd=tokens[i++],a=tokens.slice(i,i+arity[cmd]).map(Number);i+=arity[cmd];if(cmd==='Z'){out+='Z';x=sx;y=sy;continue;}
  const p=cmd==='H'?[a[0],y]:cmd==='V'?[x,a[0]]:[a.at(-2),a.at(-1)];
  if(cmd==='M'){out+='M'+pp(...p);[sx,sy]=p;}
  else if(cmd==='C'||cmd==='Q'){
   let c1,c2;if(cmd==='C'){c1=[a[0],a[1]];c2=[a[2],a[3]];}else{c1=[x+(a[0]-x)*2/3,y+(a[1]-y)*2/3];c2=[p[0]+(a[0]-p[0])*2/3,p[1]+(a[1]-p[1])*2/3];}
   c1=c1.map((v,j)=>{const z=[x,y][j]+(p[j]-[x,y][j])/3;return z+(v-z)*full;});c2=c2.map((v,j)=>{const z=[x,y][j]+(p[j]-[x,y][j])*2/3;return z+(v-z)*full;});
   if(family==='chamfer')for(const t of [.25,.75,1]){const u=1-t;out+='L'+pp(u*u*u*x+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*p[0],u*u*u*y+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*p[1]);}
   else out+='C'+pp(...c1)+' '+pp(...c2)+' '+pp(...p);
  }else out+='L'+pp(...p);[x,y]=p;
 }return out;
}
// Flatten M/L/C/Z paths into closed polygons.
export function flatten(d,steps=18){
 const tokens=d.match(/[A-Z]|-?(?:\d*\.)?\d+/g),arity={M:2,L:2,C:6,Z:0},polys=[];let i=0,cur=null,x=0,y=0;
 while(i<tokens.length){const cmd=tokens[i++],a=tokens.slice(i,i+arity[cmd]).map(Number);i+=arity[cmd];
  if(cmd==='M'){cur=[[a[0],a[1]]];polys.push(cur);[x,y]=a;}
  else if(cmd==='L'){cur.push([a[0],a[1]]);[x,y]=a;}
  else if(cmd==='C'){for(let s=1;s<=steps;s++){const t=s/steps,u=1-t;cur.push([u*u*u*x+3*u*u*t*a[0]+3*u*t*t*a[2]+t*t*t*a[4],u*u*u*y+3*u*u*t*a[1]+3*u*t*t*a[3]+t*t*t*a[5]]);}[x,y]=[a[4],a[5]];}
 }return polys;
}
const toClip=polys=>polys.map(p=>p.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)})));
function boolean(type,subject,clip){
 const c=new ClipperLib.Clipper(),out=new ClipperLib.Paths();
 if(subject.length)c.AddPaths(subject,ClipperLib.PolyType.ptSubject,true);if(clip.length)c.AddPaths(clip,ClipperLib.PolyType.ptClip,true);
 c.Execute(type,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);return out;
}
// Apply ['+'|'-', d] operations in order and return integer clipper paths.
export function build(ops,shape){
 let ink=[];for(const [op,d] of ops){const paths=toClip(flatten(shape(d)));ink=boolean(op==='+'?ClipperLib.ClipType.ctUnion:ClipperLib.ClipType.ctDifference,ink,paths);}
 return ClipperLib.Clipper.CleanPolygons(ink,.04*SCALE).filter(p=>p.length>2&&Math.abs(ClipperLib.Clipper.Area(p))>.5*SCALE*SCALE);
}

// Polygon outline of the overlap of two closed paths (construction guides).
export function intersect(a,b){
 const out=boolean(ClipperLib.ClipType.ctIntersection,toClip(flatten(a)),toClip(flatten(b)));
 return polyD(out.map(p=>p.map(q=>[q.X/SCALE,q.Y/SCALE])));
}

// Round every corner sharper than `threshold` degrees. Convex corners use
// `convex`, concave joins use `fillet`; each radius is limited so that it
// never consumes more than half of the run to the neighbouring corner.
function smoothRing(pts,convex,fillet,threshold){
 const m=pts.length,turn=[],corner=[];
 for(let i=0;i<m;i++){const a=pts[(i-1+m)%m],b=pts[i],c=pts[(i+1)%m],v=[b[0]-a[0],b[1]-a[1]],w=[c[0]-b[0],c[1]-b[1]];
  turn[i]=Math.atan2(v[0]*w[1]-v[1]*w[0],v[0]*w[0]+v[1]*w[1]);if(Math.abs(turn[i])>threshold)corner.push(i);}
 if(!corner.length)return pts;
 const ring=[...pts.slice(corner[0]),...pts.slice(0,corner[0])],first=corner[0],idx=corner.map(i=>(i-first+m)%m),cum=[0];
 for(let i=1;i<=m;i++){const a=ring[i-1],b=ring[i%m];cum[i]=cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]);}
 const L=cum[m],at=s=>{s=((s%L)+L)%L;let lo=0,hi=m;while(hi-lo>1){const mid=(lo+hi)>>1;if(cum[mid]<=s)lo=mid;else hi=mid;}const a=ring[lo],b=ring[(lo+1)%m],t=(s-cum[lo])/((cum[lo+1]-cum[lo])||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
 const d=idx.map((i,k)=>{const prev=k?cum[i]-cum[idx[k-1]]:L-cum[idx.at(-1)]+cum[i],next=(k<idx.length-1?cum[idx[k+1]]:L)-cum[i],a=turn[(i+first)%m];
  return Math.max(0,Math.min((a>0?convex:fillet)*Math.tan(Math.min(Math.abs(a),2.6)/2),prev*.48,next*.48));});
 const out=[];
 idx.forEach((i,k)=>{const s=cum[i],v=ring[i],A=at(s-d[k]),B=at(s+d[k]);
  if(d[k]<1e-3)out.push(v);else for(let j=0;j<=8;j++){const t=j/8,u=1-t;out.push([u*u*A[0]+2*u*t*v[0]+t*t*B[0],u*u*A[1]+2*u*t*v[1]+t*t*B[1]]);}
  const end=(k<idx.length-1?cum[idx[k+1]]-d[k+1]:L-d[0]);for(let j=i+1;j<m&&cum[j]<end;j++)if(cum[j]>s+d[k])out.push(ring[j]);
 });return out;
}
export function smooth(paths,convex,fillet,thresholdDeg=24){
 return paths.map(p=>smoothRing(p.map(q=>[q.X/SCALE,q.Y/SCALE]),convex,fillet,thresholdDeg*Math.PI/180));
}
export function bounds(polys){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const p of polys)for(const [x,y] of p){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);}return [a,b,c,d];}
export const polyD=polys=>polys.map(p=>'M'+p.map(([x,y])=>`${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L')+'Z').join('');
