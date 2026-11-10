/* Skeleton kernel for the P.A.G.E.S. construction kit. Letters, digits and
 * shapes are all centerline skeletons; every construction reads the same runs.
 * Outlines that must interact (overlap lenses, folded sweeps) go through
 * Clipper and come back as plain closed polygons.
 */
import ClipperLib from 'clipper-lib';
const {Clipper,ClipperOffset,ClipType,PolyType,PolyFillType,JoinType,EndType}=ClipperLib;
const K=1000,TOLERANCE=.03*K,ARITY={M:2,L:2,H:1,V:1,C:6,Q:4,Z:0};
const n=x=>+x.toFixed(3);

// Absolute M/L/H/V/C/Q/Z paths with implicit repeats → subpaths of segments.
export function segments(d){
 const tokens=d.match(/[A-Za-z]|-?(?:\d*\.)?\d+(?:e-?\d+)?/g)??[],subpaths=[];let i=0,x=0,y=0,command='M',current=null;
 while(i<tokens.length){
  if(/^[A-Za-z]$/.test(tokens[i]))command=tokens[i++].toUpperCase();
  if(!(command in ARITY))throw new Error('Unsupported path command: '+command);
  const a=tokens.slice(i,i+ARITY[command]).map(Number);i+=ARITY[command];
  if(command==='Z'){if(current){const s=current.start;if(Math.hypot(s[0]-x,s[1]-y)>1e-6)current.segs.push({type:'L',p0:[x,y],p1:[...s]});current.closed=true;[x,y]=s;}command='M';continue;}
  const p=command==='H'?[a[0],y]:command==='V'?[x,a[0]]:a.slice(-2);
  if(command==='M'){current={start:p,segs:[],closed:false};subpaths.push(current);command='L';}
  else if(command==='C')current.segs.push({type:'C',p0:[x,y],c1:a.slice(0,2),c2:a.slice(2,4),p1:p});
  else if(command==='Q')current.segs.push({type:'C',p0:[x,y],c1:[x+(a[0]-x)*2/3,y+(a[1]-y)*2/3],c2:[p[0]+(a[0]-p[0])*2/3,p[1]+(a[1]-p[1])*2/3],p1:p});
  else current.segs.push({type:'L',p0:[x,y],p1:p});
  [x,y]=p;
 }
 return subpaths.filter(s=>s.segs.length);
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],len=v=>Math.hypot(v[0],v[1]);
function tangents(s){
 if(s.type==='L')return [sub(s.p1,s.p0),sub(s.p1,s.p0)];
 const t0=len(sub(s.c1,s.p0))>1e-6?sub(s.c1,s.p0):sub(s.c2,s.p0),t1=len(sub(s.p1,s.c2))>1e-6?sub(s.p1,s.c2):sub(s.p1,s.c1);return [t0,t1];
}
function turn(a,b){const la=len(a),lb=len(b);if(la<1e-9||lb<1e-9)return 0;return Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1])/(la*lb))));}
// Split each subpath at corners sharper than `corner` radians. Smooth closed
// loops stay one closed run, so an O is a ring rather than four arcs.
export function runs(d,corner=.6){
 const out=[];
 for(const sp of segments(d)){
  const segs=sp.segs,count=segs.length,breaks=[];
  for(let k=1;k<count;k++)if(turn(tangents(segs[k-1])[1],tangents(segs[k])[0])>corner)breaks.push(k);
  if(sp.closed){
   const seam=turn(tangents(segs[count-1])[1],tangents(segs[0])[0])>corner;
   if(!breaks.length&&!seam){out.push({segs,closed:true});continue;}
   const first=seam?0:breaks[0],order=[...segs.slice(first),...segs.slice(0,first)],cuts=[...new Set([...(seam?[0]:[]),...breaks].map(k=>(k-first+count)%count))].sort((a,b)=>a-b);
   cuts.forEach((c,j)=>out.push({segs:order.slice(c,cuts[j+1]??count),closed:false}));continue;
  }
  [0,...breaks].forEach((c,j)=>out.push({segs:segs.slice(c,breaks[j]??count),closed:false}));
 }
 return out;
}
// Map run segments through the affine [a b c d e f]: x' = ax+cy+e, y' = bx+dy+f
// (Béziers are affine-invariant, so control points map directly).
export function transformRuns(list,[a,b,c,d,e,f]){const m=p=>[a*p[0]+c*p[1]+e,b*p[0]+d*p[1]+f];return list.map(r=>({closed:r.closed,segs:r.segs.map(s=>s.type==='L'?{type:'L',p0:m(s.p0),p1:m(s.p1)}:{type:'C',p0:m(s.p0),c1:m(s.c1),c2:m(s.c2),p1:m(s.p1)})}));}
export const mapRuns=(list,sx,sy,tx,ty)=>transformRuns(list,[sx,0,0,sy,tx,ty]);
function bezier(s,t){const u=1-t;return [u*u*u*s.p0[0]+3*u*u*t*s.c1[0]+3*u*t*t*s.c2[0]+t*t*t*s.p1[0],u*u*u*s.p0[1]+3*u*u*t*s.c1[1]+3*u*t*t*s.c2[1]+t*t*t*s.p1[1]];}
// Polyline for one run. `facets` fixes the number of straight pieces per curve
// (the lozenge family uses three); otherwise curves follow a chord tolerance.
export function points(run,facets=0){
 const pts=[[...run.segs[0].p0]];
 for(const s of run.segs){
  if(s.type==='L'){pts.push([...s.p1]);continue;}
  const steps=facets||Math.max(6,Math.min(96,Math.ceil((len(sub(s.c1,s.p0))+len(sub(s.c2,s.c1))+len(sub(s.p1,s.c2)))/1.2)));
  for(let k=1;k<=steps;k++)pts.push(bezier(s,k/steps));
 }
 if(run.closed&&len(sub(pts[0],pts[pts.length-1]))<1e-6)pts.pop();
 return pts;
}
export function polyLength(pts,closed=false){let s=0;for(let i=1;i<pts.length;i++)s+=len(sub(pts[i],pts[i-1]));if(closed&&pts.length>1)s+=len(sub(pts[0],pts[pts.length-1]));return s;}
// Evenly spaced stations along a polyline; closed runs do not repeat the seam.
export function stations(pts,count,closed=false){
 const line=closed?[...pts,pts[0]]:pts,total=polyLength(line),result=[],steps=closed?count:Math.max(1,count-1);
 for(let i=0;i<count;i++){const target=total*i/steps;let travel=0;
  for(let j=1;j<line.length;j++){const a=line[j-1],b=line[j],d=len(sub(b,a));if(travel+d>=target-1e-9||j===line.length-1){const f=d?Math.min(1,(target-travel)/d):0;result.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);break;}travel+=d;}}
 return result;
}
export function boundsOf(list){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of list){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}return {x0,y0,x1,y1};}
export function distanceToPolyline(p,pts,closed=false){
 const line=closed?[...pts,pts[0]]:pts;let best=Infinity;if(line.length===1)return len(sub(p,line[0]));
 for(let i=1;i<line.length;i++){const a=line[i-1],ab=sub(line[i],a),t=Math.max(0,Math.min(1,((p[0]-a[0])*ab[0]+(p[1]-a[1])*ab[1])/((ab[0]**2+ab[1]**2)||1)));best=Math.min(best,len([p[0]-a[0]-ab[0]*t,p[1]-a[1]-ab[1]*t]));}
 return best;
}
const toClipper=pts=>pts.map(([x,y])=>({X:Math.round(x*K),Y:Math.round(y*K)}));
// One stroked run as a filled outline. Cap: round | butt | square; join: round | miter | square.
export function strokeOutline(pts,closed,width,{cap='round',join='round'}={}){
 if(pts.length<2&&!closed){pts=[pts[0],[pts[0][0]+1e-3,pts[0][1]]];}
 const o=new ClipperOffset(3,TOLERANCE),out=[];
 o.AddPath(toClipper(pts),{round:JoinType.jtRound,miter:JoinType.jtMiter,square:JoinType.jtSquare}[join],closed?EndType.etClosedLine:{round:EndType.etOpenRound,butt:EndType.etOpenButt,square:EndType.etOpenSquare}[cap]);
 o.Execute(out,width/2*K);return out;
}
function run(type,a,b=[]){const c=new Clipper(),out=[];if(a.length)c.AddPaths(a,PolyType.ptSubject,true);if(b.length)c.AddPaths(b,PolyType.ptClip,true);c.Execute(type,out,PolyFillType.pftNonZero,PolyFillType.pftNonZero);return out;}
export const union=(...shapes)=>run(ClipType.ctUnion,shapes.flat());
export const minus=(a,b)=>!a.length||!b.length?a:run(ClipType.ctDifference,a,b);
export function offset(shape,d){if(!shape.length||Math.abs(d)<1e-3)return shape;const o=new ClipperOffset(2,TOLERANCE),out=[];o.AddPaths(shape,JoinType.jtRound,EndType.etClosedPolygon);o.Execute(out,d*K);return out;}
// Rounds convex corners only: shrink, then grow back with round joins.
export const soften=(shape,r)=>r<.05?shape:offset(offset(shape,-r),r);
// Exact sweep of a polygon set along (dx, dy): both copies plus one quad per edge.
export function sweep(shape,dx,dy){
 const DX=Math.round(dx*K),DY=Math.round(dy*K),pieces=[...shape,...shape.map(p=>p.map(q=>({X:q.X+DX,Y:q.Y+DY})))];
 // Every quad is wound positively so none cancels another under nonzero fill.
 for(const p of shape)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],quad=[a,b,{X:b.X+DX,Y:b.Y+DY},{X:a.X+DX,Y:a.Y+DY}];pieces.push(Clipper.Orientation(quad)?quad:quad.reverse());}
 return union(pieces);
}
export const toPath=shape=>shape.filter(p=>p.length>2).map(p=>'M'+p.map(q=>n(q.X/K)+' '+n(q.Y/K)).join('L')+'Z').join('');
export function area(shape){let s=0;for(const p of shape)s+=Clipper.Area(p);return Math.abs(s)/K/K;}
