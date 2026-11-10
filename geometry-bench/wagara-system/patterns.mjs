/* Wagara kit — traditional Japanese patterns as procedural vector lattices.
 * Every pattern is a motif repeated on a lattice: gen(P, box, B, inks) draws
 * every motif that can reach `box` (pattern space, origin at the anchor) into
 * a builder, in painting order. Motifs depend only on their lattice index
 * modulo a small period, so each pattern repeats exactly by its period vectors
 * and tiles without seams. P = {s: scale (px per repeat), sw: line weight,
 * d: detail, row: figurative motifs on lattice row 0 only, for crest bands}. Inks = {paper, ink, accent, cycle}: paper is the ground of the
 * window, ink the pattern, accent a third note, cycle the colours figurative
 * motifs take in turn. Nothing is traced; motifs are built from circles,
 * lines and lattices.
 */
export const n=v=>Math.round(v*100)/100;
const TAU=Math.PI*2,R3=Math.sqrt(3),mod=(v,m)=>((v%m)+m)%m,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const P2=(x,y)=>`${n(x)} ${n(y)}`;
export const circle=(x,y,r)=>`M${P2(x-r,y)}a${n(r)} ${n(r)} 0 1 0 ${n(2*r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2*r)} 0Z`;
export const poly=pts=>'M'+pts.map(([x,y])=>P2(x,y)).join('L')+'Z';
const open=pts=>'M'+pts.map(([x,y])=>P2(x,y)).join('L');
const rrect=(x0,y0,x1,y1,r)=>{r=Math.min(r,(x1-x0)/2,(y1-y0)/2);return `M${P2(x0+r,y0)}H${n(x1-r)}A${n(r)} ${n(r)} 0 0 1 ${P2(x1,y0+r)}V${n(y1-r)}A${n(r)} ${n(r)} 0 0 1 ${P2(x1-r,y1)}H${n(x0+r)}A${n(r)} ${n(r)} 0 0 1 ${P2(x0,y1-r)}V${n(y0+r)}A${n(r)} ${n(r)} 0 0 1 ${P2(x0+r,y0)}Z`;};
// Catmull-Rom through samples, as cubic Béziers (wave lines).
const smooth=pts=>{let d='M'+P2(...pts[0]);for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]??pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]??p2;d+=`C${P2(p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6)} ${P2(p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6)} ${P2(...p2)}`;}return d;};
const rot=(pts,a,cx,cy)=>{const c=Math.cos(a),s=Math.sin(a);return pts.map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c]);};
const span=(a,b,step,off=0,m=1)=>{const out=[];for(let i=Math.floor((a-off)/step)-m;i<=Math.ceil((b-off)/step)+m;i++)out.push(i);return out;};

// Paths of one ink and style merge while they are consecutive, so a field of
// thousands of motifs stays a handful of elements in painting order.
export function builder(){const items=[];const push=(k,ink,d,w)=>{if(!d)return;const l=items[items.length-1];if(l&&l.k===k&&l.ink===ink&&l.w===w)l.d+=d;else items.push({k,ink,d,w});};
 return {items,fill:(ink,d)=>push('f',ink,d),stroke:(ink,d,w)=>push('s',ink,d,n(Math.max(.2,w))),fret:(ink,d,w)=>push('q',ink,d,n(Math.max(.2,w))),
  svg:()=>items.map(({k,ink,d,w})=>k==='f'?`<path d="${d}" fill="${ink}"/>`:`<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w}" ${k==='q'?'stroke-linecap="square" stroke-miterlimit="4"':'stroke-linecap="round" stroke-linejoin="round"'}/>`).join('')};}
const cyc=(k,i)=>{const c=k.cycle?.length?k.cycle:[k.ink];return c[mod(i,c.length)];};

export const PATTERNS=[
 // Concentric fans in overlapping rows; each row's paper discs hide the row behind.
 {id:'seigaiha',name:'Seigaiha',jp:'青海波',gloss:'blue-sea waves',kind:'geometric',detail:[1,6,'Rings'],
  period:P=>{const R=P.s/2;return {a:[2*R,0],b:[R,R/2],rect:[2*R,R]};},
  gen(P,[x0,y0,x1,y1],B,k){const R=P.s/2,m=P.d+1,lw=P.sw*R/m*.36,dy=R/2;
   for(let j=Math.floor((y0-R)/dy)-1;j<=Math.ceil((y1+R)/dy);j++){const y=j*dy,o=(j&1)?R:0;let disc='',ring='';
    for(const i of span(x0-R,x1+R,2*R,o)){const x=i*2*R+o;disc+=circle(x,y,R);for(let r=1;r<=m;r++)ring+=circle(x,y,Math.max(lw*.6,R*r/m-(r===m?lw/2:0)));}
    B.fill(k.paper,disc);B.stroke(k.ink,ring,lw);}}},
 // Fish scales: shallow arcs, each row hung from the lowest points of the row above.
 {id:'gyorin',name:'Gyorin',jp:'魚鱗',gloss:'fish scales',kind:'geometric',detail:[1,4,'Echo lines'],
  period:P=>{const R=P.s/2,h=R*.72;return {a:[2*R,0],b:[R,h],rect:[2*R,2*h]};},
  gen(P,[x0,y0,x1,y1],B,k){const R=P.s/2,h=R*.72,lw=P.sw*R*.075;let d='';
   for(let j=Math.floor(y0/h)-2;j<=Math.ceil(y1/h)+1;j++){const y=j*h,o=(j&1)?R:0;for(const i of span(x0,x1,2*R,o)){const x=i*2*R+o;
    for(let e=0;e<P.d;e++){const sg=h*(1-e/P.d*.78),rho=(R*R+sg*sg)/(2*sg);d+=`M${P2(x-R,y)}A${n(rho)} ${n(rho)} 0 0 0 ${P2(x+R,y)}`;}}}
   B.stroke(k.ink,d,lw);}},
 // Hemp leaf: the triangular lattice with every triangle's vertices joined to its centroid.
 {id:'asanoha',name:'Asanoha',jp:'麻の葉',gloss:'hemp leaf',kind:'geometric',detail:[1,3,'Stars (none, ink, accent)'],
  period:P=>{const a=P.s*.55,h=a*R3/2;return {a:[3*a,0],b:[1.5*a,h],rect:[3*a,2*h]};},
  gen(P,[x0,y0,x1,y1],B,k){const a=P.s*.55,h=a*R3/2,lw=P.sw*a*.045,V=(i,j)=>[i*a+j*a/2,j*h],avg=(...p)=>[p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
   const NB=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];let lines='',star='';
   for(const j of span(y0,y1,h)){for(const i of span(x0-j*a/2,x1-j*a/2,a,0,2)){const p=V(i,j),q=V(i+1,j),r=V(i,j+1),s=V(i+1,j+1),cu=avg(p,q,r),cd=avg(q,r,s);
    lines+=open([p,q])+open([p,r])+open([q,r])+open([p,cu,q])+open([cu,r])+open([q,cd,r])+open([cd,s]);
    if(P.d<2)continue;const W=NB.map(([di,dj])=>V(i+di,j+dj)),C=W.map((w,t)=>avg(p,w,W[(t+1)%6]));
    if(mod(i-j,3)===0)star+=poly(W.flatMap((w,t)=>[C[(t+5)%6],w]));}}
   // Detail 2 fills every third star in ink, detail 3 in the accent.
   B.fill(P.d>=3?k.accent:k.ink,star);B.stroke(k.ink,lines,lw);}},
 // Tortoise shell: flat-topped hexagons with nested inner shells.
 {id:'kikko',name:'Kikkō',jp:'亀甲',gloss:'tortoise shell',kind:'geometric',detail:[1,4,'Inner shells'],
  period:P=>{const r=P.s*.5;return {a:[3*r,0],b:[1.5*r,R3*r/2],rect:[3*r,R3*r]};},
  gen(P,[x0,y0,x1,y1],B,k){const r=P.s*.5,lw=P.sw*r*.07,dy=R3*r,hx=(cx,cy,q)=>poly([0,1,2,3,4,5].map(t=>[cx+q*Math.cos(t*Math.PI/3),cy+q*Math.sin(t*Math.PI/3)]));let d='',dots='';
   for(const i of span(x0,x1,1.5*r)){const o=(i&1)?dy/2:0;for(const j of span(y0,y1,dy,o)){const cx=i*1.5*r,cy=j*dy+o;d+=hx(cx,cy,r);for(let e=1;e<P.d;e++)d+=hx(cx,cy,r*(1-e*.24));if(P.d>=4)dots+=circle(cx,cy,r*.09);}}
   B.stroke(k.ink,d,lw);B.fill(k.accent,dots);}},
 // Seven treasures: overlapping circles on two interleaved square lattices; lenses filled from detail 2.
 {id:'shippo',name:'Shippō',jp:'七宝',gloss:'seven treasures',kind:'geometric',detail:[1,3,'Petals, centres'],
  period:P=>{const D=P.s;return {a:[D/2,D/2],b:[D/2,-D/2],rect:[D,D]};},
  gen(P,[x0,y0,x1,y1],B,k){const D=P.s,a=D/2,lw=P.sw*D*.03;let c='',lens='',dot='';
   for(const i of span(x0,x1,D))for(const j of span(y0,y1,D)){const x=i*D,y=j*D;c+=circle(x,y,a)+circle(x+a,y+a,a);
    if(P.d>=2)for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const f=sx*sy>0?1:0;lens+=`M${P2(x+sx*a,y)}A${n(a)} ${n(a)} 0 0 ${f} ${P2(x,y+sy*a)}A${n(a)} ${n(a)} 0 0 ${f} ${P2(x+sx*a,y)}Z`;}
    if(P.d>=3)dot+=circle(x,y,a*.17)+circle(x+a,y+a,a*.17);}
   B.fill(k.ink,lens);B.fill(k.accent,dot);B.stroke(k.ink,c,lw);}},
 // Checks; line weight grows or shrinks the ink squares, detail nests squares inside every check.
 {id:'ichimatsu',name:'Ichimatsu',jp:'市松',gloss:'checks',kind:'geometric',detail:[1,4,'Nested squares'],
  period:P=>{const c=P.s/2;return {a:[2*c,0],b:[c,c],rect:[2*c,2*c]};},
  gen(P,[x0,y0,x1,y1],B,k){const c=P.s/2,g=c*.16*(1-P.sw),cells=[];for(const i of span(x0,x1,c))for(const j of span(y0,y1,c))cells.push([i*c,j*c,(i+j)&1]);
   const sq=(x,y,t)=>poly([[x+t,y+t],[x+c-t,y+t],[x+c-t,y+c-t],[x+t,y+c-t]]);
   B.fill(k.ink,cells.filter(q=>!q[2]).map(([x,y])=>sq(x,y,g)).join(''));
   for(let e=1;e<P.d;e++){const t=c*e/(2*P.d)+Math.max(0,g),odd=e&1;B.fill(odd?k.paper:k.ink,cells.filter(q=>!q[2]).map(([x,y])=>sq(x,y,t)).join(''));B.fill(odd?k.ink:k.paper,cells.filter(q=>q[2]).map(([x,y])=>sq(x,y,t)).join(''));}}},
 // Scales: rows of triangles, apex on the joint below; detail subdivides like Sierpiński.
 {id:'uroko',name:'Uroko',jp:'鱗',gloss:'triangle scales',kind:'geometric',detail:[1,3,'Subdivision'],
  period:P=>{const b=P.s*.6,h=b*R3/2;return {a:[b,0],b:[b/2,h],rect:[b,2*h]};},
  gen(P,[x0,y0,x1,y1],B,k){const b=P.s*.6,h=b*R3/2,f=clamp(1+(P.sw-1)*.22,.5,1.45);let d='';
   const tri=(p,q,r,l)=>{if(l<=1){const c=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3];d+=poly([p,q,r].map(([x,y])=>[c[0]+(x-c[0])*f,c[1]+(y-c[1])*f]));return;}const m=(u,v)=>[(u[0]+v[0])/2,(u[1]+v[1])/2];tri(p,m(p,q),m(p,r),l-1);tri(m(p,q),q,m(q,r),l-1);tri(m(p,r),m(q,r),r,l-1);};
   for(const j of span(y0,y1,h)){const o=(j&1)?b/2:0;for(const i of span(x0,x1,b,o)){const x=i*b+o,y=j*h;tri([x+b/2,y],[x+b,y+h],[x,y+h],P.d);}}
   B.fill(k.ink,d);}},
 // Arrow feathers: columns of chevrons in alternating inks, barbs and shaft in the other ink.
 {id:'yagasuri',name:'Yagasuri',jp:'矢絣',gloss:'arrow feathers',kind:'geometric',detail:[1,5,'Barbs'],
  period:P=>{const w=P.s*.5,fh=w*1.25;return {a:[2*w,0],b:[w,fh],rect:[2*w,2*fh]};},
  gen(P,[x0,y0,x1,y1],B,k){const w=P.s*.5,fh=w*1.25,dd=w*.42,lw=P.sw*w*.04;let ink='',onInk='',onPaper='';
   for(const c of span(x0,x1,w))for(const m of span(y0-dd,y1,fh)){const x=c*w,y=m*fh,dark=!((c+m)&1);if(dark)ink+=poly([[x,y],[x+w/2,y+dd],[x+w,y],[x+w,y+fh],[x+w/2,y+fh+dd],[x,y+fh]]);
    let l='';for(let e=1;e<P.d;e++){const t=fh*e/P.d;l+=open([[x+w*.1,y+t+dd*.2],[x+w/2,y+t+dd],[x+w*.9,y+t+dd*.2]]);}if(P.d>=2)l+=open([[x+w/2,y+dd*1.15],[x+w/2,y+fh+dd*.85]]);if(dark)onInk+=l;else onPaper+=l;}
   B.fill(k.ink,ink);B.stroke(k.paper,onInk,lw);B.stroke(k.ink,onPaper,lw);}},
 // Fawn spots: rounded tie-dye squares on a diagonal grid, each with a paper eye.
 {id:'kanoko',name:'Kanoko',jp:'鹿の子',gloss:'fawn spots',kind:'geometric',detail:[1,3,'Centre'],
  period:P=>{const c=P.s*.25;return {a:[c,c],b:[c,-c],rect:[2*c,2*c]};},
  gen(P,[x0,y0,x1,y1],B,k){const c=P.s*.25,hs=c*.36*clamp(P.sw,.4,2.4),cr=hs*.42;let sp='',eye='',pupil='';
   for(const i of span(x0,x1,c))for(const j of span(y0,y1,c)){if((i+j)&1)continue;const x=i*c,y=j*c;sp+=rrect(x-hs,y-hs,x+hs,y+hs,cr);if(P.d>=2)eye+=circle(x,y,hs*.32);if(P.d>=3)pupil+=circle(x,y,hs*.13);}
   B.fill(k.ink,sp);B.fill(k.paper,eye);B.fill(k.accent,pupil);}},
 // Key fret of linked manji: arms a, hooks b, on the lattice v1 = (a+b, a−b), v2 = v1 turned 90°.
 {id:'sayagata',name:'Sayagata',jp:'紗綾形',gloss:'linked key fret',kind:'geometric',detail:[1,4,'Arm length'],
  period:P=>{const b=P.s*.2,d=P.d,g=d%2?2:1,L=((d+1)**2+(d-1)**2)/g*b;return {a:[(d+1)*b,(d-1)*b],b:[(d-1)*b,-(d+1)*b],rect:[L,L]};},
  gen(P,[x0,y0,x1,y1],B,k){const b=P.s*.2,a=P.d*b,v1=[a+b,a-b],v2=[a-b,-(a+b)],L2=v1[0]**2+v1[1]**2,m=a+b,lw=P.sw*b*.32;
   const cs=[[x0-m,y0-m],[x1+m,y0-m],[x1+m,y1+m],[x0-m,y1+m]],I=cs.map(([x,y])=>(x*v1[0]+y*v1[1])/L2),J=cs.map(([x,y])=>(x*v2[0]+y*v2[1])/L2);let d='';
   for(let i=Math.floor(Math.min(...I));i<=Math.ceil(Math.max(...I));i++)for(let j=Math.floor(Math.min(...J));j<=Math.ceil(Math.max(...J));j++){const x=i*v1[0]+j*v2[0],y=i*v1[1]+j*v2[1];if(x<x0-m||x>x1+m||y<y0-m||y>y1+m)continue;
    d+=open([[x,y],[x+a,y],[x+a,y-b]])+open([[x,y],[x,y-a],[x-b,y-a]])+open([[x,y],[x-a,y],[x-a,y+b]])+open([[x,y],[x,y+a],[x+b,y+a]]);}
   B.fret(k.ink,d,lw);}},
 // Rising steam: paired wavy lines, neighbouring pairs half a wave apart.
 {id:'tatewaku',name:'Tatewaku',jp:'立涌',gloss:'rising steam',kind:'geometric',detail:[1,4,'Lines'],
  period:P=>{const w=P.s*.6,L=w*1.9;return {a:[2*w,0],b:[0,L],rect:[2*w,L]};},
  gen(P,[x0,y0,x1,y1],B,k){const w=P.s*.6,L=w*1.9,A=w*.17,base=w*.25,gap=w*.06,lw=P.sw*w*.035,st=L/12;let d='';
   for(const c of span(x0,x1,w)){const cx=c*w+w/2,ph=(c&1)?Math.PI:0;for(const side of [-1,1])for(let e=0;e<P.d;e++){const pts=[];for(let y=Math.floor((y0-L/4)/st)*st;y<=y1+L/4;y+=st)pts.push([cx+side*(base-e*gap+A*Math.cos(TAU*y/L+ph)),y]);d+=smooth(pts);}}
   B.stroke(k.ink,d,lw);}},
 // Wave lines: parallel sine lines whose phase drifts, gathered into crests.
 {id:'nami',name:'Nami',jp:'波',gloss:'wave lines',kind:'geometric',detail:[1,5,'Lines per crest'],
  period:P=>{const lam=P.s*1.6,g=P.s*.11,m=2*(P.d+1);return {a:[lam,0],b:[0,m*g],rect:[lam,m*g]};},
  gen(P,[x0,y0,x1,y1],B,k){const lam=P.s*1.6,g=P.s*.11,A=P.s*.2,m=2*(P.d+1),lw=P.sw*g*.36,st=lam/12;let d='';
   for(const j of span(y0-A,y1+A,g)){if(mod(j,P.d+1)===P.d)continue;const pts=[];for(let x=Math.floor((x0-lam/4)/st)*st;x<=x1+lam/4;x+=st)pts.push([x,j*g+A*Math.sin(TAU*x/lam+TAU*j/m)]);d+=smooth(pts);}
   B.stroke(k.ink,d,lw);}},
 // Plum blossoms: five round petals on a half-drop lattice, turned and coloured by lattice index.
 {id:'ume',name:'Ume',jp:'梅',gloss:'plum blossom',kind:'figurative',detail:[1,3,'Centre'],
  period:P=>({a:[3*P.s,0],b:[0,1.6*P.s],rect:[3*P.s,1.6*P.s]}),
  gen(P,[x0,y0,x1,y1],B,k){const p=P.s,m=p*.36*clamp(P.sw,.5,1.3),fills={};let ctr='',dot='',stamen='';
   for(const j of span(y0,y1,.8*p)){if(P.row&&j)continue;const o=(j&1)?p/2:0;for(const i of span(x0,x1,p,o)){const x=i*p+o,y=j*.8*p,ci=mod(i,3),a0=(ci*24+(j&1)*36-90)*Math.PI/180,col=cyc(k,ci+3*(j&1));
    fills[col]=(fills[col]??'')+[0,1,2,3,4].map(t=>circle(x+.5*m*Math.cos(a0+t*TAU/5),y+.5*m*Math.sin(a0+t*TAU/5),.5*m)).join('');
    if(P.d>=2){ctr+=circle(x,y,.27*m);dot+=circle(x,y,.1*m);}if(P.d>=3)for(let t=0;t<5;t++){const a=a0+(t+.5)*TAU/5;stamen+=open([[x+.12*m*Math.cos(a),y+.12*m*Math.sin(a)],[x+.4*m*Math.cos(a),y+.4*m*Math.sin(a)]]);}}}
   for(const [c,d] of Object.entries(fills))B.fill(c,d);B.fill(k.paper,ctr);B.stroke(k.accent,stamen,m*.05);B.fill(k.accent,dot);}},
 // Cherry blossoms: five notched petals.
 {id:'sakura',name:'Sakura',jp:'桜',gloss:'cherry blossom',kind:'figurative',detail:[1,3,'Centre'],
  period:P=>({a:[3*P.s,0],b:[0,1.6*P.s],rect:[3*P.s,1.6*P.s]}),
  gen(P,[x0,y0,x1,y1],B,k){const p=P.s,L=p*.4*clamp(P.sw,.5,1.3),fills={};let ctr='',dot='';
   const petal=(x,y,a)=>{const q=rot([[0,-.04*L],[-.46*L,-.28*L],[-.56*L,-.86*L],[-.16*L,-L],[0,-.84*L],[.16*L,-L],[.56*L,-.86*L],[.46*L,-.28*L]],a,x,y);
    return `M${P2(...q[0])}C${P2(...q[1])} ${P2(...q[2])} ${P2(...q[3])}L${P2(...q[4])}L${P2(...q[5])}C${P2(...q[6])} ${P2(...q[7])} ${P2(...q[0])}Z`;};
   for(const j of span(y0,y1,.8*p)){if(P.row&&j)continue;const o=(j&1)?p/2:0;for(const i of span(x0,x1,p,o)){const x=i*p+o,y=j*.8*p,ci=mod(i,3),a0=(ci*24+(j&1)*36)*Math.PI/180,col=cyc(k,ci+3*(j&1));
    fills[col]=(fills[col]??'')+[0,1,2,3,4].map(t=>petal(x,y,a0+t*TAU/5)).join('');if(P.d>=2)ctr+=circle(x,y,.2*L);if(P.d>=3)for(let t=0;t<5;t++){const a=a0+t*TAU/5-Math.PI/2;dot+=circle(x+.32*L*Math.cos(a),y+.32*L*Math.sin(a),.05*L);}if(P.d>=2)dot+=circle(x,y,.08*L);}}
   for(const [c,d] of Object.entries(fills))B.fill(c,d);B.fill(k.paper,ctr);B.fill(k.accent,dot);}},
 // Chrysanthemum crest: radial capsule petals, a second ring behind from detail 3.
 {id:'kiku',name:'Kiku',jp:'菊',gloss:'chrysanthemum crest',kind:'figurative',detail:[1,4,'Petals'],
  period:P=>({a:[4*P.s,0],b:[0,1.8*P.s],rect:[4*P.s,1.8*P.s]}),
  gen(P,[x0,y0,x1,y1],B,k){const p=P.s,m=p*.43*clamp(P.sw,.5,1.2),np=8+4*Math.min(P.d,3),fills={};let back='',ctr='',dot='';
   const petal=(x,y,a,r0,r1)=>{const hw=Math.PI*r1/np*.82,hb=Math.PI*r0/np*.7,pts=[[r0,-hb],[r1-hw,-hw]];for(let t=1;t<8;t++){const u=-Math.PI/2+t*Math.PI/8;pts.push([r1-hw+hw*Math.cos(u),hw*Math.sin(u)]);}pts.push([r1-hw,hw],[r0,hb]);return poly(rot(pts,a,x,y));};
   for(const j of span(y0,y1,.9*p)){if(P.row&&j)continue;const o=(j&1)?p:0;for(const i of span(x0,x1,2*p,o)){const x=i*2*p+o,y=j*.9*p,col=cyc(k,mod(i,2)+2*(j&1));let d='';
    for(let t=0;t<np;t++){d+=petal(x,y,t*TAU/np,.18*m,m);if(P.d>=3)back+=petal(x,y,(t+.5)*TAU/np,.2*m,m*.96);}fills[col]=(fills[col]??'')+d;ctr+=circle(x,y,.24*m);
    if(P.d>=2)for(let t=0;t<8;t++)dot+=circle(x+.14*m*Math.cos(t*TAU/8),y+.14*m*Math.sin(t*TAU/8),.035*m);}}
   B.fill(k.accent,back);for(const [c,d] of Object.entries(fills))B.fill(c,d);B.fill(k.paper,ctr);B.fill(k.ink,dot);}},
 // Bamboo: culms with node ridges and a paper highlight; leaf sprays from alternate nodes.
 {id:'take',name:'Take',jp:'竹',gloss:'bamboo',kind:'figurative',detail:[1,5,'Leaves'],
  period:P=>{const p=P.s*.9,L=p*2.2;return {a:[3*p,0],b:[0,2*L],rect:[3*p,2*L]};},
  gen(P,[x0,y0,x1,y1],B,k){const p=P.s*.9,L=p*2.2,cw=p*.3*clamp(P.sw,.4,2.2),ll=p*.95;let culm='',ridge='',hi='',leaf='';
   for(const c of span(x0-ll,x1+ll,p)){const x=c*p,ph=mod(c,3)*L/3;for(const m of span(y0-ll,y1+ll,L,ph)){const y=m*L+ph,g=cw*.13;
    culm+=rrect(x-cw/2,y+g+cw*.05,x+cw/2,y+L-g-cw*.05,cw*.22);ridge+=rrect(x-cw*.64,y-cw*.06,x+cw*.64,y+cw*.06,cw*.06);hi+=open([[x-cw*.2,y+cw*.5],[x-cw*.2,y+L-cw*.5]]);
    if(P.d>=2&&!((m+mod(c,3))&1)){const s=(m&1)?-1:1;for(let t=0;t<P.d-1;t++){const a=(s>0?-28:208)*Math.PI/180+s*(t-(P.d-2)/2)*.42,w=ll*.17,q=rot([[0,0],[ll*.42,-w],[ll,0],[ll*.42,w]],a,x+s*cw*.4,y);
     leaf+=`M${P2(...q[0])}Q${P2(...q[1])} ${P2(...q[2])}Q${P2(...q[3])} ${P2(...q[0])}Z`;}}}}
   B.fill(k.ink,culm+ridge);B.stroke(k.paper,hi,cw*.09);B.fill(k.ink,leaf);}},
 // Rising sun over two wave mounds, the repeated tile of a 1960s exhibition poster.
 {id:'hinode',name:'Hinode',jp:'日の出',gloss:'rising sun',kind:'figurative',detail:[1,4,'Rays'],
  period:P=>({a:[P.s*1.4,0],b:[0,P.s],rect:[P.s*1.4,P.s]}),
  gen(P,[x0,y0,x1,y1],B,k){const w=P.s*1.4,h=P.s,nr=6+4*P.d,lw=P.sw*h*.025;
   for(const j of span(y0,y1,h)){if(P.row&&j)continue;let rays='',sun='',ring='',strip='',mound='',crest='';for(const i of span(x0,x1,w)){const x=i*w,y=j*h,cx=x+w/2,cy=y+.8*h,R=.69*h;
    for(let t=0;t<nr;t+=2){const a=Math.PI+t*Math.PI/nr,b=Math.PI+(t+1)*Math.PI/nr;rays+=poly([[cx,cy],[cx+R*Math.cos(a),cy+R*Math.sin(a)],[cx+R*Math.cos(b),cy+R*Math.sin(b)]]);}
    ring+=circle(cx,cy,.31*h);sun+=circle(cx,cy,.25*h);strip+=poly([[x,y+.9*h],[x+w,y+.9*h],[x+w,y+h],[x,y+h]]);mound+=circle(x,y+h,.42*h);
    for(const r of [.3,.18])crest+=`M${P2(x-r*h,y+h)}A${n(r*h)} ${n(r*h)} 0 0 1 ${P2(x+r*h,y+h)}`;}
    B.fill(k.accent,rays);B.fill(k.paper,ring);B.fill(k.accent,sun);B.fill(cyc(k,1),strip);B.fill(k.ink,mound);B.stroke(k.paper,crest,lw);}}},
 // Solid ink: the plain window.
 {id:'sumi',name:'Sumi',jp:'墨',gloss:'solid ink',kind:'plain',detail:[1,1,'—'],
  period:P=>({a:[P.s,0],b:[0,P.s],rect:[P.s,P.s]}),
  gen(P,[x0,y0,x1,y1],B,k){B.fill(k.ink,poly([[x0-2,y0-2],[x1+2,y0-2],[x1+2,y1+2],[x0-2,y1+2]]));}}
];
export const PATTERN_IDS=PATTERNS.map(p=>p.id),PATTERN=Object.fromEntries(PATTERNS.map(p=>[p.id,p]));
export const patternP=(id,P)=>{const pat=PATTERN[id];return {s:P.s,sw:P.sw,d:clamp(Math.round(P.d),pat.detail[0],pat.detail[1]),row:!!P.row};};

// One pattern over a poster region: the lattice is anchored at `anchor` and
// turned by `deg`; only motifs that can reach the region are generated.
export function patternSVG(id,P,region,anchor,deg,inks){const pat=PATTERN[id]??PATTERN.seigaiha,Q=patternP(pat.id,P),[ax,ay]=anchor,r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 const pts=[[region[0],region[1]],[region[2],region[1]],[region[2],region[3]],[region[0],region[3]]].map(([x,y])=>{const dx=x-ax,dy=y-ay;return [dx*c+dy*s,-dx*s+dy*c];});
 const box=[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))],B=builder();pat.gen(Q,box,B,{accent:inks.ink,...inks});
 return {svg:`<g transform="translate(${n(ax)} ${n(ay)})${deg?` rotate(${n(deg)})`:''}">${B.svg()}</g>`,elements:B.items.length};}
export const patternPeriod=(id,P)=>PATTERN[id].period(patternP(id,P));
