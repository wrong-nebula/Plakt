/* End shapes and hubs built from a few primitives: circles, round-capped
 * strokes, smooth or straight closed areas and rings. End shapes live in a
 * local frame (wrist at the origin, x along the limb, y toward the thumb or
 * toe, one unit = the limb's stroke weight). A part is a list of primitives
 * with one fill role, drawn in a layer:
 *   base   merged with the limb: its outline is drawn under the limb's fill
 *   over   drawn after the limb, each part with its own outline (fingers, mugs, beaks)
 *   detail lines and dots in the outline colour, no outline of their own
 */
import {catmullRom,r1,r3} from './geometry.mjs';
export const END_SHAPES=['none','disc','hand','foot','heel','cup','beak','arrow'];
export const HUBS=['none','disc','ring','flower','star','polygon'];
const line=(pts,w)=>({k:'line',pts,w}),area=pts=>({k:'area',pts}),poly=pts=>({k:'poly',pts}),circle=(c,r)=>({k:'circle',c,r}),ring=(c,r,w)=>({k:'ring',c,r,w});
const part=(layer,role,...prims)=>({layer,role,prims});
// Fingers fan slightly; drawn little to index so the index finger sits on top.
const FINGERS=[[[.6,-.36],[1.06,-.43],.2],[[.66,-.12],[1.32,-.16],.21],[[.66,.12],[1.4,.12],.21],[[.6,.36],[1.24,.4],.2]];
export function endParts(kind){switch(kind){
 case 'disc':return [part('base','end',circle([.28,0],.74))];
 case 'hand':return [part('base','end',area([[-.32,-.5],[.3,-.56],[.74,-.46],[.84,0],[.76,.46],[.36,.56],[-.32,.5]])),...FINGERS.map(([a,b,w])=>part('over','end',line([a,b],w))),part('over','end',line([[.16,.4],[.5,.66],[.86,.74]],.22)),part('detail','line',line([[.2,-.05],[.42,.08]],.05))];
 case 'foot':return [part('base','end',area([[-.3,-.5],[.24,-.66],[.66,-.52],[.82,-.08],[.84,.62],[.76,1.28],[.5,1.6],[.26,1.48],[.14,1.06],[-.14,.62],[-.3,.5]])),part('detail','line',line([[.66,-.38],[.7,.4],[.62,1.34]],.07)),part('detail','line',line([[.06,.62],[.3,.62]],.06),line([[.1,.86],[.36,.86]],.06))];
 case 'heel':return [part('base','end',area([[-.28,-.46],[.3,-.56],[.56,-.3],[.6,.2],[.9,.92],[1.02,1.36],[.84,1.56],[.56,1.24],[.22,.76],[-.28,.46]])),part('over','end',line([[.52,-.32],[1.08,-.4]],.11)),part('detail','line',line([[.42,.56],[.7,1.18]],.06))];
 case 'cup':return [part('base','end',area([[-.3,-.5],[.36,-.58],[.74,-.4],[.8,.2],[.62,.56],[-.3,.5]])),part('over','accent',ring([.86,.02],.24,.12)),part('over','accent',area([[1.0,-.62],[1.92,-.56],[1.86,.66],[1.04,.7]])),part('detail','line',area([[1.78,-.5],[1.98,-.46],[1.92,.56],[1.74,.6]])),part('detail','line',line([[.32,-.2],[.62,-.24]],.05),line([[.34,.1],[.64,.08]],.05))];
 case 'beak':return [part('base','end',circle([.42,0],.66)),part('over','accent',poly([[.84,.3],[1.86,.04],[.84,-.24]])),part('detail','line',circle([.5,.26],.11))];
 case 'arrow':return [part('base','end',poly([[-.12,.86],[1.36,0],[-.12,-.86]]))];
 default:return [];}}
// Hubs in figure units: radius h, n = arm count.
export function hubParts(kind,h,n){const N=Math.max(3,n),P=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];switch(kind){
 case 'disc':return [part('base','accent',circle([0,0],h))];
 case 'ring':return [part('base','accent',ring([0,0],h*.8,h*.36))];
 case 'flower':return [part('base','accent',...Array.from({length:N},(_,i)=>circle(P(h*.6,i*2*Math.PI/N),h*Math.min(.46,1.6/N+.12)))),part('over','end',circle([0,0],h*.46))];
 case 'star':{const k=Math.max(5,n);return [part('base','accent',poly(Array.from({length:2*k},(_,i)=>P(i%2?h*.48:h,i*Math.PI/k-Math.PI/2))))];}
 case 'polygon':return [part('base','accent',poly(Array.from({length:N},(_,i)=>P(h,i*2*Math.PI/N-Math.PI/2))))];
 default:return [];}}
// Extent of a part list from the origin, in local units.
export function partsRadius(parts){let r=0;for(const p of parts)for(const q of p.prims)r=Math.max(r,q.k==='circle'||q.k==='ring'?Math.hypot(...q.c)+q.r+(q.w||0)/2:Math.max(...q.pts.map(v=>Math.hypot(...v)))+(q.w||0)/2);return r;}
const P=(f,[x,y])=>f(x)+' '+f(y);
// Path data of a primitive; `f` rounds coordinates (3 decimals in local frames, 1 in figure units).
export function primD(q,f=r3){if(q.k==='circle'||q.k==='ring')return `M${f(q.c[0]-q.r)} ${f(q.c[1])}a${f(q.r)} ${f(q.r)} 0 1 0 ${f(2*q.r)} 0a${f(q.r)} ${f(q.r)} 0 1 0 ${f(-2*q.r)} 0Z`;
 if(q.k==='line')return 'M'+q.pts.map(p=>P(f,p)).join('L');const pts=q.k==='area'?catmullRom(q.pts,6,true):q.pts;return 'M'+pts.map(p=>P(f,p)).join('L')+'Z';}
const stroked=q=>q.k==='line'||q.k==='ring';
// Outline layer of a primitive (its fill grown by o), and its fill layer.
export function outerSVG(q,o,col,f=r3){const d=primD(q,f);return stroked(q)?`<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(q.w+2*o)}" stroke-linecap="round" stroke-linejoin="round"/>`:o>0?`<path d="${d}" fill="${col}" stroke="${col}" stroke-width="${f(2*o)}" stroke-linejoin="round"/>`:'';}
export function innerSVG(q,col,f=r3){const d=primD(q,f);return stroked(q)?`<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(q.w)}" stroke-linecap="round" stroke-linejoin="round"/>`:`<path d="${d}" fill="${col}"/>`;}
// Hairline drawing of a primitive for the construction passes.
export function wireSVG(q,col,w,f=r3){const d=primD(q,f);return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(stroked(q)?Math.max(w,q.w*.08):w)}"${stroked(q)?` stroke-opacity=".7"`:''}/>`;}
export {r1};
