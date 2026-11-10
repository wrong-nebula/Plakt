/* Polygon kernel for the capsule system. Shapes are Clipper paths in poster
 * units scaled by K; every operation returns plain closed outlines, so the
 * SVG is a list of filled paths with no masks.
 */
import ClipperLib from 'clipper-lib';
const {Clipper,ClipperOffset,ClipType,PolyType,PolyFillType,JoinType,EndType}=ClipperLib;
export const K=100;
const TOLERANCE=.05*K; // chord deviation for round offsets: 0.15px in a 3000px proof

const pt=(x,y)=>({X:Math.round(x*K),Y:Math.round(y*K)});
function arc(points,cx,cy,r,a0,a1){
 const steps=Math.max(2,Math.ceil(Math.abs(a1-a0)/Math.acos(Math.max(-1,1-TOLERANCE/Math.max(r*K,1)))));
 for(let i=0;i<=steps;i++){const a=a0+(a1-a0)*i/steps;points.push(pt(cx+r*Math.cos(a),cy+r*Math.sin(a)));}
}
export function rect(x,y,w,h){return [[pt(x,y),pt(x+w,y),pt(x+w,y+h),pt(x,y+h)]];}
export function roundRect(x,y,w,h,radius){
 const r=Math.max(0,Math.min(radius,w/2,h/2));if(r<.01)return rect(x,y,w,h);
 const p=[],H=Math.PI/2;
 arc(p,x+w-r,y+r,r,-H,0);arc(p,x+w-r,y+h-r,r,0,H);arc(p,x+r,y+h-r,r,H,2*H);arc(p,x+r,y+r,r,2*H,3*H);
 return [p];
}
// A capsule whose long sides curve inward to a waist; the curve leaves each
// corner arc tangentially, so pinched pieces keep the same cap radius.
export function hourglass(x,y,w,h,radius,pinchLeft,pinchRight,waist=y+h/2){
 const r=Math.max(0,Math.min(radius,w/2,h/2)),top=y+r,bottom=y+h-r;
 if(Math.max(pinchLeft,pinchRight)<.01||bottom-top<4)return roundRect(x,y,w,h,radius);
 const wy=Math.max(top+1,Math.min(bottom-1,waist)),smooth=u=>u*u*(3-2*u);
 const bell=t=>smooth(t<wy?(t-top)/(wy-top):(bottom-t)/(bottom-wy));
 const n=Math.max(8,Math.ceil((bottom-top)/2)),ts=[],H=Math.PI/2,p=[];
 for(let i=0;i<=n;i++)ts.push(top+(bottom-top)*i/n);
 arc(p,x+w-r,y+r,r,-H,0);for(const t of ts)p.push(pt(x+w-pinchRight*bell(t),t));
 arc(p,x+w-r,y+h-r,r,0,H);arc(p,x+r,y+h-r,r,H,2*H);
 for(const t of [...ts].reverse())p.push(pt(x+pinchLeft*bell(t),t));
 arc(p,x+r,y+r,r,2*H,3*H);
 return [p];
}
function run(type,a,b=[]){
 const c=new Clipper(),out=[];
 if(a.length)c.AddPaths(a,PolyType.ptSubject,true);
 if(b.length)c.AddPaths(b,PolyType.ptClip,true);
 c.Execute(type,out,PolyFillType.pftNonZero,PolyFillType.pftNonZero);
 return out;
}
export const union=(...shapes)=>run(ClipType.ctUnion,shapes.flat());
export const minus=(a,b)=>!a.length||!b.length?a:run(ClipType.ctDifference,a,b);
export const intersect=(a,b)=>!a.length||!b.length?[]:run(ClipType.ctIntersection,a,b);
export function offset(shape,d){
 if(!shape.length||Math.abs(d)<.001)return shape;
 const o=new ClipperOffset(2,TOLERANCE),out=[];o.AddPaths(shape,JoinType.jtRound,EndType.etClosedPolygon);o.Execute(out,d*K);
 return Clipper.CleanPolygons(out,.02*K)||out;
}
// Closing fills concave corners and gaps narrower than 2r with radius-r fillets.
export const close=(shape,r)=>r<.05?shape:offset(offset(shape,r),-r);
export const open=(shape,r)=>r<.05?shape:offset(offset(shape,-r),r);
// An open polyline stroked with round caps and round turns: the hairline slit.
export function stroke(points,width){
 const o=new ClipperOffset(2,TOLERANCE),out=[];
 o.AddPath(points.map(([x,y])=>pt(x,y)),JoinType.jtRound,EndType.etOpenRound);o.Execute(out,width/2*K);
 return out;
}
export function bounds(shape){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const p of shape)for(const q of p){if(q.X<x0)x0=q.X;if(q.X>x1)x1=q.X;if(q.Y<y0)y0=q.Y;if(q.Y>y1)y1=q.Y;}
 return {x:x0/K,y:y0/K,w:(x1-x0)/K,h:(y1-y0)/K};
}
export const overlaps=(a,b,pad=0)=>a.x-pad<b.x+b.w&&b.x-pad<a.x+a.w&&a.y-pad<b.y+b.h&&b.y-pad<a.y+a.h;
export const area=path=>Clipper.Area(path)/K/K;
// Outer contours have positive area, holes negative (Clipper output orientation).
export function topology(shape){
 const areas=shape.map(area);
 return {outlines:areas.filter(a=>a>0).length,holes:areas.filter(a=>a<0).length,
  smallestOutline:Math.min(...areas.filter(a=>a>0)),smallestHole:Math.min(Infinity,...areas.filter(a=>a<0).map(a=>-a))};
}
export function toPath(shape){
 const f=v=>Number((v/K).toFixed(2));
 return shape.map(p=>'M'+p.map((q,i)=>`${i===1?'L':''}${f(q.X)} ${f(q.Y)}`).join(' ')+'Z').join('');
}
