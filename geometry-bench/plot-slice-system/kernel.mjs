/* Outline kernel. Authored glyph paths become Clipper outlines at any width with one stem weight, and
 * windows cut them into plain filled pieces. Clipper works in poster units scaled by K.
 */
import ClipperLib from 'clipper-lib';
import {GLYPHS} from './glyphs.mjs';
import {FIT} from './bounds.mjs';
const {Clipper,ClipType,PolyType,PolyFillType}=ClipperLib;
export const K=100,TOL=.08,K_MIN=.45,K_MAX=3;
export const dot=(p,v)=>p[0]*v[0]+p[1]*v[1];
export function clipHalf(poly,u,limit){const out=[],e=1e-9*(1+Math.abs(limit));for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=dot(a,u)-limit,db=dot(b,u)-limit;if(da<=e)out.push(a);if((da<-e&&db>e)||(da>e&&db<-e)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
export function cubic(a,b,c,d){const dd=Math.max(Math.hypot(a[0]-2*b[0]+c[0],a[1]-2*b[1]+c[1]),Math.hypot(b[0]-2*c[0]+d[0],b[1]-2*c[1]+d[1])),steps=Math.max(2,Math.min(64,Math.ceil(Math.sqrt(.75*dd/TOL)))),pts=[];
 for(let i=1;i<=steps;i++){const t=i/steps,v=1-t;pts.push([v*v*v*a[0]+3*v*v*t*b[0]+3*v*t*t*c[0]+t*t*t*d[0],v*v*v*a[1]+3*v*v*t*b[1]+3*v*t*t*c[1]+t*t*t*d[1]]);}return pts;
}
export const toInt=pts=>pts.map(([x,y])=>({X:Math.round(x*K),Y:Math.round(y*K)}));
// Absolute M L H V C Z outlines become point lists, flattened within TOL poster units.
const parsed=new Map();
function contours(d){if(parsed.has(d))return parsed.get(d);const out=[];let cur=null,pen=[0,0];
 for(const [,cmd,body] of d.matchAll(/([MLHVCZ])([^MLHVCZ]*)/g)){const a=(body.match(/-?\d*\.?\d+/g)??[]).map(Number);
  if(cmd==='M'){pen=[a[0],a[1]];cur={start:pen,segs:[]};out.push(cur);for(let i=2;i<a.length;i+=2)cur.segs.push({to:pen=[a[i],a[i+1]]});}
  else if(cmd==='L')for(let i=0;i<a.length;i+=2)cur.segs.push({to:pen=[a[i],a[i+1]]});
  else if(cmd==='H')for(const v of a)cur.segs.push({to:pen=[v,pen[1]]});
  else if(cmd==='V')for(const v of a)cur.segs.push({to:pen=[pen[0],v]});
  else if(cmd==='C')for(let i=0;i<a.length;i+=6)cur.segs.push({c1:[a[i],a[i+1]],c2:[a[i+2],a[i+3]],to:pen=[a[i+4],a[i+5]]});
  else pen=cur.start;}
 parsed.set(d,out);return out;
}
function flatten(list,map){return list.map(({start,segs})=>{let p=start;const pts=[map(p)];for(const s of segs){if(s.c1)pts.push(...cubic(map(p),map(s.c1),map(s.c2),map(s.to)));else pts.push(map(s.to));p=s.to;}return toInt(pts);});}
// Minkowski sum or difference with a horizontal segment: only the strokes' horizontal thickness changes.
function morph(paths,d){const r=Math.round(Math.abs(d)*K/2);if(r<1)return paths;const quads=[];
 for(const p of paths)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(a.Y===b.Y)continue;const q=[{X:a.X-r,Y:a.Y},{X:b.X-r,Y:b.Y},{X:b.X+r,Y:b.Y},{X:a.X+r,Y:a.Y}];if(!Clipper.Orientation(q))q.reverse();quads.push(q);}
 const c=new Clipper(),out=[];c.AddPaths(paths,PolyType.ptSubject,true);c.AddPaths(quads,PolyType.ptClip,true);c.Execute(d>0?ClipType.ctUnion:ClipType.ctDifference,out,PolyFillType.pftEvenOdd,PolyFillType.pftNonZero);return out;
}
// Weight-true widths. A width factor k scales a letter horizontally, then the Minkowski step resets its own stem
// to stem·k^γ of the cap height. Condensed letters lighten (γ .5) as compressed cuts do; extended ones gain a little (γ .3).
const shift=(k,stem)=>stem*(Math.pow(k,k<1?.5:.3)-k);
export const inkWidth=(ch,r,k)=>r*k+(GLYPHS[ch].d?shift(k,stemOf(ch)):0);
export const WIDTH={min:K_MIN,max:K_MAX},glyphWidth=(ch,k)=>inkWidth(ch,GLYPHS[ch].width,k);
const outlines=new Map(),stems=new Map();
// A letter's stem is its thinnest horizontal run through the middle of its ink, in cap heights.
export function stemOf(ch){if(!stems.has(ch)){const paths=outline(ch,0,GLYPHS[ch].width*100,100,1),ys=paths.flat().map(p=>p.Y),top=Math.min(...ys),bottom=Math.max(...ys),runs=[];
 for(const f of [.45,.55,.65]){const y=Math.round(top+(bottom-top)*f)+.5,xs=[];for(const p of paths)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a.Y<y)!==(b.Y<y))xs.push(a.X+(y-a.Y)*(b.X-a.X)/(b.Y-a.Y));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)runs.push((xs[i+1]-xs[i])/K/100);}
 stems.set(ch,Math.max(.08,Math.min(.3,Math.min(...runs))));}return stems.get(ch);
}
// One letter's outline, its ink spanning [x, x + w] at cap height H.
export function outline(ch,x,w,H,k){const g=GLYPHS[ch];if(!g?.d)return [];const key=[ch,x,w,H,k].join('|');if(outlines.has(key))return outlines.get(key);
 const fit=FIT[ch]??{offset:0,scale:1},view=g.view??100,d=k===1?0:shift(k,stemOf(ch))*H,sx=(w-d)/view,sy=H/100,mirror=!!g.transform,
  paths=morph(flatten(contours(g.d),([px,py])=>[x+d/2+sx*(mirror?100-px:px),sy*(fit.offset+fit.scale*py)]),d);
 if(outlines.size>3000)outlines.clear();outlines.set(key,paths);return paths;
}
export const lineOutline=(line,H)=>line.frames.flatMap(([ch,x,w,k])=>outline(ch,x,w,H,k));
export const isIdentity=m=>m[0]===1&&m[1]===0&&m[2]===0&&m[3]===1&&m[4]===0&&m[5]===0;
export const apply=([a,b,c,d,e,f],[x,y])=>[a*x+c*y+e,b*x+d*y+f];
export function affine(paths,m){if(isIdentity(m))return paths;const [a,b,c,d,e,f]=m;return paths.map(p=>p.map(q=>({X:Math.round(a*q.X+c*q.Y+e*K),Y:Math.round(b*q.X+d*q.Y+f*K)})));}
export function intersect(subject,clip){if(!subject.length||!clip.length)return [];const c=new Clipper(),out=[];c.AddPaths(subject,PolyType.ptSubject,true);c.AddPaths(clip,PolyType.ptClip,true);c.Execute(ClipType.ctIntersection,out,PolyFillType.pftEvenOdd,PolyFillType.pftNonZero);return out;}
// Authored outlines keep their own contour directions; a Clipper pass gives holes the opposite orientation.
export function clean(paths){if(!paths.length)return [];const c=new Clipper(),out=[];c.AddPaths(paths,PolyType.ptSubject,true);c.Execute(ClipType.ctUnion,out,PolyFillType.pftEvenOdd,PolyFillType.pftEvenOdd);return out;}
// Net filled area of clean outlines, in square poster units.
export const area=paths=>Math.abs(paths.reduce((a,p)=>a+Clipper.Area(p),0))/(K*K);
export const pathData=(paths,place)=>paths.map(p=>'M'+p.map(q=>place(q.X/K,q.Y/K).map(v=>+v.toFixed(2)).join(' ')).join('L')+'Z').join('');
