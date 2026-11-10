// The shape catalog. Each shape is a generator for a centerline skeleton in a
// 100-unit-tall frame. `make(k)` takes the detail offset k (−2…+2): more or
// fewer humps, arms, lines, steps, turns, lobes, sides or nested copies.
// k = 0 is the reference form. Shapes without a count ignore k. Counts stop
// where the heaviest constructions would fill the gaps between strokes, and
// `weight(k)` lightens every construction's strokes as a shape gets denser.
const f=x=>+x.toFixed(3),clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.round(v))),P=(x,y)=>f(x)+' '+f(y);
// Smooth parametric curves as Hermite-matched cubics through `steps` samples.
function curve(at,t0,t1,steps,closed){
 const h=(t1-t0)/steps/3,e=1e-4,D=t=>{const a=at(t-e),b=at(t+e);return [(b[0]-a[0])/(2*e),(b[1]-a[1])/(2*e)];};let d='M'+P(...at(t0));
 for(let k=0;k<steps;k++){const a=t0+(t1-t0)*k/steps,b=t0+(t1-t0)*(k+1)/steps,p0=at(a),p1=at(b),d0=D(a),d1=D(b);d+='C'+[P(p0[0]+d0[0]*h,p0[1]+d0[1]*h),P(p1[0]-d1[0]*h,p1[1]-d1[1]*h),P(...p1)].join(' ');}
 return d+(closed?'Z':'');
}
const polyline=(pts,closed)=>'M'+pts.map(p=>P(...p)).join('L')+(closed?'Z':'');
// Straight lines through the center at n evenly turned angles, the first vertical.
const radial=n=>Array.from({length:n},(_,i)=>{const a=Math.PI*i/n,dx=50*Math.sin(a),dy=50*Math.cos(a);return 'M'+P(50-dx,50-dy)+'L'+P(50+dx,50+dy);}).join('');
// A regular polygon fitted to the 100-unit height. `flat` puts an edge at the base.
function polygon(n,flat){const turn=flat&&n%2===0?Math.PI/n:0,pts=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+turn+2*Math.PI*i/n;return [Math.cos(a),Math.sin(a)];}),y0=Math.min(...pts.map(p=>p[1])),y1=Math.max(...pts.map(p=>p[1])),k=100/(y1-y0);return polyline(pts.map(([x,y])=>[50+x*k,(y-y0)*k]),true);}
function wave(k){const n=clamp(3+k,1,6);let d='M0 50';for(let i=0;i<n;i++){const x=42*i,y=i%2?86:14;d+='C'+[P(x+12,y),P(x+30,y),P(x+42,50)].join(' ');}return d;}
function arch(k){return Array.from({length:clamp(1+k,1,2)},(_,i)=>{const e=30*i,r=50-e,top=e,s=55;return `M${P(e,100)}V${s}C${P(e,s-(s-top)*.6)} ${P(50-r*.56,top)} ${P(50,top)}C${P(50+r*.56,top)} ${P(100-e,s-(s-top)*.6)} ${P(100-e,s)}V100`;}).join('');}
// An Archimedean spiral from r=50 to r=8; turns 0.9–1.7, so even the tightest
// keeps about a stroke's width between turns.
function spiral(k){const turns=1.3+.2*Math.max(-2,Math.min(2,k)),total=turns*2*Math.PI,r=t=>50-42*t/total;return curve(t=>[50+r(t)*Math.cos(t-Math.PI/2),50+r(t)*Math.sin(t-Math.PI/2)],0,total,Math.max(6,Math.round(turns*8)),false);}
function zigzag(k){const peaks=clamp(2+k,1,4);return polyline(Array.from({length:2*peaks+1},(_,i)=>[28*i,i%2?18:82]),false);}
function stairs(k){const s=clamp(4+k,2,6),h=100/s;let d='M0 100';for(let i=1;i<=s;i++)d+=`V${f(100-i*h)}H${f(i*h)}`;return d;}
// A square spiral turning inward with pitch 100/(p+1).
function meander(k){const s=100/(clamp(2+k,1,3)+1);let d='M0 100H100V0H0',L=0,R=100,T=0,B=100;for(let i=0;;i++){const leg=i%4;if(leg===0){B-=s;if(B-T<s/2)break;d+=`V${f(B)}`;}else if(leg===1){R-=s;if(R-L<s/2)break;d+=`H${f(R)}`;}else if(leg===2){T+=s;if(B-T<s/2)break;d+=`V${f(T)}`;}else{L+=s;if(R-L<s/2)break;d+=`H${f(L)}`;}}return d;}
function ring(k){return Array.from({length:clamp(1+k,1,2)},(_,i)=>{const r=50-30*i,c=r*.552;return `M${P(50,50-r)}C${P(50+c,50-r)} ${P(50+r,50-c)} ${P(50+r,50)}C${P(50+r,50+c)} ${P(50+c,50+r)} ${P(50,50+r)}C${P(50-c,50+r)} ${P(50-r,50+c)} ${P(50-r,50)}C${P(50-r,50-c)} ${P(50-c,50-r)} ${P(50,50-r)}Z`;}).join('');}
// One tall lens, or 3 or 5 lenses radiating from the center.
function petal(k){if(k<1)return 'M50 0C94 30 94 70 50 100C6 70 6 30 50 0Z';const n=2*clamp(k,1,2)+1;return Array.from({length:n},(_,i)=>{const a=-Math.PI/2+2*Math.PI*i/n,ux=Math.cos(a),uy=Math.sin(a),px=-uy,py=ux,tip=[50+50*ux,50+50*uy],w=50*.36,c1=[50+ux*18+px*w,50+uy*18+py*w],c2=[50+ux*40+px*w*.7,50+uy*40+py*w*.7],c3=[50+ux*40-px*w*.7,50+uy*40-py*w*.7],c4=[50+ux*18-px*w,50+uy*18-py*w];return `M50 50C${P(...c1)} ${P(...c2)} ${P(...tip)}C${P(...c3)} ${P(...c4)} 50 50Z`;}).join('');}
// A (2, q) torus-knot projection with one lobe at the top: q = 3 or 5. The
// five-lobed knot has shallower lobes so its crossings stay open.
function knot(k){const q=3+2*clamp(k,0,1),R=2.2,rr=q===3?1:.8,at=t=>{const r=R+rr*Math.cos(q*t),a=2*t-Math.PI/2;return [50+r*Math.cos(a)*50/(R+rr),50+r*Math.sin(a)*50/(R+rr)];};return curve(at,0,2*Math.PI,6*q,true);}
function chevron(k){return Array.from({length:clamp(1+k,1,3)},(_,i)=>polyline([[12+30*i,0],[88+30*i,50],[12+30*i,100]],false)).join('');}
function lattice(k){const n=clamp(2+k,1,3),at=i=>f(100*(i+1)/(n+1));return Array.from({length:n},(_,i)=>`M${at(i)} 0V100M0 ${at(i)}H100`).join('');}
function bars(k){const n=clamp(3+k,1,4),gap=n>1?Math.min(32,84/(n-1)):0;return Array.from({length:n},(_,i)=>`M0 ${f(50+(i-(n-1)/2)*gap)}H100`).join('');}
export const GROUPS=[{id:'lines',name:'Lines and curves'},{id:'closed',name:'Closed forms'},{id:'crossings',name:'Crossings'}];
const fixed=d=>()=>d;
export const SHAPES={
 wave:{name:'Wave',group:'lines',make:wave,count:'humps'},
 serpent:{name:'Serpent',group:'lines',make:fixed('M86 8C40 -6 8 14 22 38C34 58 78 46 82 72C86 98 44 108 10 90')},
 arc:{name:'Arc',group:'lines',make:fixed('M70 0C24 22 24 78 70 100')},
 arch:{name:'Arch',group:'lines',make:arch,count:'nested arches',weight:k=>k>0?.7:1},
 spiral:{name:'Spiral',group:'lines',make:spiral,count:'turns',weight:k=>[1,1,1,.8,.62][k+2]},
 zigzag:{name:'Zigzag',group:'lines',make:zigzag,count:'peaks',weight:k=>k>1?.85:1},
 stairs:{name:'Stairs',group:'lines',make:stairs,count:'steps'},
 meander:{name:'Meander',group:'lines',make:meander,count:'inward turns',weight:k=>k>0?.78:1},
 ring:{name:'Ring',group:'closed',make:ring,count:'nested rings',weight:k=>k>0?.7:1},
 petal:{name:'Petal',group:'closed',make:petal,count:'petals',weight:k=>k>0?.85:1},
 drop:{name:'Drop',group:'closed',make:fixed('M50 0C58 18 90 44 90 66C90 88 72 100 50 100C28 100 10 88 10 66C10 44 42 18 50 0Z')},
 diamond:{name:'Diamond',group:'closed',make:k=>polygon(clamp(4+k,3,8),false),count:'sides'},
 triangle:{name:'Triangle',group:'closed',make:k=>k<=0?'M50 0L100 100H0Z':polygon(3+clamp(k,1,2),true),count:'sides'},
 loop:{name:'Loop',group:'closed',make:fixed('M60 50C44 18 26 10 14 18C2 26 2 74 14 82C26 90 44 82 60 50C76 18 94 10 106 18C118 26 118 74 106 82C94 90 76 82 60 50Z')},
 knot:{name:'Knot',group:'closed',make:knot,count:'lobes',weight:k=>k>0?.68:1},
 cross:{name:'Cross',group:'crossings',make:k=>radial(clamp(2+k,1,5)),count:'arms'},
 star:{name:'Star',group:'crossings',make:k=>radial(clamp(3+k,2,6)),count:'arms'},
 chevron:{name:'Chevron',group:'crossings',make:chevron,count:'nested chevrons',weight:k=>[1,1,1,.7,.55][k+2]},
 lattice:{name:'Lattice',group:'crossings',make:lattice,count:'lines',weight:k=>k>0?.78:1},
 bars:{name:'Bars',group:'crossings',make:bars,count:'bars',weight:k=>k>0?.85:1}
};
for(const s of Object.values(SHAPES))s.d=s.make(0);
