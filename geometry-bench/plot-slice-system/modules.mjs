/* Construction modules. A slice system is one choice on each axis: which part of the master each row shows
 * (sequence), the shape of the cut (edge), how letters move inside their window (motion), how depth grows
 * across rows (profile) and how rows are inked (tone). Fit and alignment set the line; formats and
 * scaffolds place the stack on a page.
 */
import {cubic} from './kernel.mjs';
export const SOURCE_WINDOWS=[[68,5],[85,20],[118,25],[159,37],[216,58],[294,67],[384,99],[503,145],[673,222]];
export const SEQUENCES=[
 {id:'grow',name:'Grow from the edge',short:'GROW',note:'Each row reveals the word deeper from its leading edge, as in the source.'},
 {id:'shrink',name:'Shrink to the edge',short:'SHRINK',note:'The complete word comes first; every row after it shows less.'},
 {id:'center',name:'Open from the center',short:'CENTER',note:'Each row opens a wider band around the middle of the letters.'},
 {id:'strips',name:'Exploded strips',short:'STRIPS',note:'Successive strips of one word, spread apart. Their cuts interlock, so together they rebuild the master.'}
];
export const EDGES=[
 {id:'straight',name:'Straight',short:'STRAIGHT'},{id:'bowed',name:'Bowed under letters',short:'BOWED'},{id:'arc',name:'Single arc',short:'ARC'},
 {id:'zigzag',name:'Zigzag',short:'ZIGZAG'},{id:'wave',name:'Wave',short:'WAVE'},{id:'steps',name:'Steps',short:'STEPS'}
];
export const MOTIONS=[
 {id:'none',name:'Still',short:'STILL'},{id:'shear',name:'Alternating lean',short:'LEAN'},{id:'shift',name:'Alternating shift',short:'SHIFT'},
 {id:'drift',name:'Drift into place',short:'DRIFT'},{id:'compress',name:'Compress into the window',short:'COMPRESS'}
];
export const PROFILES=[{id:'source',name:'Measured source'},{id:'linear',name:'Linear'},{id:'geometric',name:'Geometric'}];
export const TONES=[{id:'solid',name:'Solid ink'},{id:'fade',name:'Fade in'},{id:'alternate',name:'Alternate rows'},{id:'master',name:'Master in full ink'}];
export const FITS=[{id:'fill',name:'Fill measure'},{id:'natural',name:'Natural'}];
export const ALIGNS=[{id:'left',name:'Left'},{id:'center',name:'Center'},{id:'right',name:'Right'}];
export const MODULES={sequence:SEQUENCES,edge:EDGES,motion:MOTIONS,profile:PROFILES,tone:TONES,fit:FITS,align:ALIGNS};
export const DEFAULT_MODULES={sequence:'grow',edge:'straight',motion:'none',profile:'source',tone:'solid',fit:'fill',align:'left'};
export const FORMATS=[
 {id:'poster',name:'Poster 7 × 10',size:[700,1000]},{id:'feed',name:'Feed 4 × 5',size:[800,1000]},{id:'square',name:'Square',size:[1000,1000]},{id:'story',name:'Story 9 × 16',size:[700,1244]},
 {id:'landscape',name:'Landscape 16 × 9',size:[1600,900]},{id:'banner',name:'Banner 3 × 1',size:[1500,500]}
];
export const SCAFFOLDS=[{id:'source',name:'f’ar 2019 poster'},{id:'caption',name:'Own caption'},{id:'none',name:'Type only'}];
// The source poster's 27-unit margins, 68-unit header and 105-unit footer, scaled to the format's smaller ratio to 700 × 1000.
export function frameOf(state){const [W,H]=(FORMATS.find(f=>f.id===state.format)??FORMATS[0]).size,s=Math.min(W/700,H/1000),bare=state.scaffold==='none',top=(bare?27:68)*s,bottom=(bare?27:105)*s;
 return {W,H,s,x:27*s,y:top,w:W-54*s,h:H-top-bottom,pad:27*s,cx:W/2,cy:top+(H-top-bottom)/2};
}
function interpolate(a,t){const x=t*(a.length-1),i=Math.floor(x),f=x-i;return a[i]*(1-f)+(a[Math.min(a.length-1,i+1)]??a[i])*f;}
// Depth of each row as a fraction of the master, and the gaps after it in cap heights.
export function profile(state){const count=state.params.rows,kind=state.modules.profile,heights=SOURCE_WINDOWS.map(r=>r[1]),gaps=SOURCE_WINDOWS.slice(1).map((r,i)=>r[0]-SOURCE_WINDOWS[i][0]-SOURCE_WINDOWS[i][1]),even=gaps.reduce((a,b)=>a+b,0)/gaps.length,first=heights[0]/222,depth=[],gap=[];
 for(let i=0;i<count;i++){const t=i/(count-1),base=kind==='linear'?first+(1-first)*t:kind==='geometric'?Math.pow(first,1-t):interpolate(heights,t)/222;depth.push(Math.pow(base,state.params.growth));if(i<count-1)gap.push((kind==='source'?interpolate(gaps,i/(count-2)):even)*state.params.gap/222);}
 return {depth,gap};
}
// Each row's window as [from, to] fractions of the master's extent along the reveal direction.
export function windows(sequence,depth){
 if(sequence==='shrink')return [...depth].reverse().map(f=>[0,f]);
 if(sequence==='center')return depth.map(f=>[(1-f)/2,(1+f)/2]);
 if(sequence==='strips'){const total=depth.reduce((a,b)=>a+b,0);let at=0;return depth.map(f=>{const a=at/total;at+=f;return [a,at/total];});}
 return depth.map(f=>[0,f]);
}
// A row's motion as an affine matrix [a b c d e f] in row coordinates: u runs through the letters, c along the cut.
export function motion(state,{u,c,lead,extent,lo,hi,H,i,n}){const p=state.params;
 switch(state.modules.motion){
  case 'shear':{const k=p.lean*(i%2?-1:1),mid=(lo+hi)/2;return [1+k*c[0]*u[0],k*c[1]*u[0],k*c[0]*u[1],1+k*c[1]*u[1],-k*mid*c[0],-k*mid*c[1]];}
  case 'shift':{const t=p.offset*H*(i%2?-1:1);return [1,0,0,1,t*c[0],t*c[1]];}
  case 'drift':{const t=p.offset*H*(n>1?1-i/(n-1):0);return [1,0,0,1,t*c[0],t*c[1]];}
  // Compress squeezes the master vertically into the window's share of the cap height, counted from the side the
  // reveal enters; squash 1 shows every letter complete. Squeezing along a diagonal u instead would skew the whole
  // word across the page and leave no room to stack rows.
  case 'compress':{const a=(lo-lead)/extent,b=(hi-lead)/extent,q=p.squash,top=u[1]>=0?a*H:H-b*H;return [1,0,0,1-q+q*(b-a),0,q*top];}
  default:return [1,0,0,1,0,0];
 }
}
// A cut's indentation from ta to tb along c, as [t, depth] samples between 0 and amp.
// Bowed scoops under each letter, arc spans the word once, and the periodic edges share one phase across rows.
export function edge(kind,ta,tb,amp,{spans,t0,period}){const dir=tb>ta?1:-1;if(kind==='straight'||amp<=0)return [[ta,0],[tb,0]];
 if(kind==='bowed'||kind==='arc'){const lo=Math.min(ta,tb),hi=Math.max(ta,tb),list=(kind==='arc'&&spans.length?[[spans[0][0],spans.at(-1)[1]]]:spans).map(([a,b])=>[Math.max(lo,a),Math.min(hi,b)]).filter(s=>s[1]-s[0]>=1),out=[[ta,0]];if(dir<0)list.reverse();
  for(const [a,b] of list){const s=dir>0?a:b,e=dir>0?b:a,w=e-s,m=(s+e)/2;out.push([s,0],...cubic([s,0],[s+w*.24,0],[m-w*.2,amp],[m,amp]),...cubic([m,amp],[m+w*.2,amp],[e-w*.24,0],[e,0]));}
  out.push([tb,0]);return out;}
 const P=Math.max(4,period),f=t=>{const x=(((t-t0)/P)%1+1)%1;return kind==='zigzag'?amp*(1-Math.abs(2*x-1)):kind==='wave'?amp*(1-Math.cos(2*Math.PI*x))/2:x<.5?0:amp;},step=kind==='wave'?P/24:P/2,lo=Math.min(ta,tb),hi=Math.max(ta,tb),ts=[];
 for(let j=Math.ceil((lo-t0)/step);j<=Math.floor((hi-t0)/step);j++)ts.push(t0+j*step);if(dir<0)ts.reverse();
 const out=[[ta,f(ta)]];for(const t of ts)if(kind==='steps')out.push([t,f(t-dir*1e-6)],[t,f(t+dir*1e-6)]);else out.push([t,f(t)]);out.push([tb,f(tb)]);return out;
}
// Ink share of each row, mixed toward the paper.
export function tone(kind,i,n,master){if(kind==='fade')return .22+.78*(n>1?i/(n-1):1);if(kind==='alternate')return i%2?.5:1;if(kind==='master')return master?1:.38;return 1;}
export const mix=(paper,ink,t)=>t>=1?ink:'#'+[1,3,5].map(i=>Math.round(parseInt(paper.slice(i,i+2),16)*(1-t)+parseInt(ink.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
