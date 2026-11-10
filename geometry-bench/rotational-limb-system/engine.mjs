/* Rotational limbs and knots — shape system study after Shigeo Fukuda.
 * Two generators share one palette, one set of end shapes, one layout and
 * one renderer:
 *  limbs  an editable limb (a tapered stroke through a few control points,
 *         bent by curl, ending in a hand, foot, heel, cup, beak, disc or
 *         arrow) repeated N times around a hub with twist, radial offset,
 *         alternating mirror, per-arm colour and a cyclic overlap order.
 *  knot   a closed curve (trefoil, figure-eight, torus p/q, Lissajous a/b,
 *         seeded random) or two open strands ending in hands, drawn as a
 *         tube. All self-crossings are found, ordered along the strands and
 *         given over/under (alternating by default); the under strand is cut
 *         by a gap around the over strand.
 * Geometry is built in figure units (U = 500: a straight limb or the knot's
 * radius) and placed by the layout. New interpretations, nothing traced.
 */
import {TAU,r1,r3,dist,rng,rot,catmullRom,cumulative,pointAt,resample,slice,tangentAt,bend,bendAt,relax,unkink,tubeMinus,findCrossings,assignCrossings,mix,hueWalk,luminance,contrast} from './geometry.mjs';
import {END_SHAPES,HUBS,endParts,hubParts,partsRadius,outerSVG,innerSVG,wireSVG,primD} from './parts.mjs';
export {END_SHAPES,HUBS,findCrossings,assignCrossings};
export const ENGINE='rotational-limb-v1';
export const U=500;
export const SOURCES=[
 {id:'pgda-19163',title:'Images of Illusion',date:'1984',families:['legs']},
 {id:'pgda-14386',title:"UCC Coffee Pavilion at Expo '85",date:'1984',families:['coffee']},
 {id:'pgda-17100',title:"Inter Design '81 (International Design Exhibition)",date:'1981',families:['handshake','trefoil']},
 {id:'moma-7689',title:'Kyogen',date:'1981',families:['spiral']},
 {id:'moma-5943',title:'Look 1',date:'1984',families:[]}
];
export const FORMATS=[{id:'poster',name:'Poster (B)',w:728,h:1030},{id:'square',name:'Square',w:900,h:900},{id:'landscape',name:'Landscape',w:1030,h:728},{id:'story',name:'Story 9:16',w:608,h:1080}];
// Limb shapes: control points in U, root at the origin, reaching along +x.
export const LIMBS=[
 {id:'straight',name:'Straight',points:[[0,0],[.34,0],[.67,0],[1,0]]},
 {id:'bend',name:'Bend',points:[[0,0],[.36,.03],[.68,.13],[.95,.33]]},
 {id:'s-curve',name:'S-curve',points:[[0,0],[.3,.17],[.62,-.1],[.96,.06]]},
 {id:'hook',name:'Hook',points:[[0,0],[.45,0],[.84,.12],[.9,.46]]},
 {id:'knee',name:'Knee',points:[[0,0],[.46,.1],[.64,-.12],[1,-.18]]},
 {id:'wave',name:'Wave',points:[[0,0],[.22,.13],[.45,-.1],[.69,.12],[.94,-.05]]}
];
export const KNOTS=[{id:'trefoil',name:'Trefoil'},{id:'figure8',name:'Figure-eight'},{id:'torus',name:'Torus p/q'},{id:'lissajous',name:'Lissajous a/b'},{id:'random',name:'Seeded random'},{id:'hands',name:'Two hands meeting'}];
// `when(state)` says whether a control or option acts on a state; `scope` says the same in words.
const isL=s=>s.generator==='limbs',isK=s=>s.generator==='knot',kt=(...t)=>s=>isK(s)&&t.includes(s.knot),hands=kt('hands');
const C=(key,label,group,min,max,step,value,when,scope)=>({key,label,group,min,max,step,value,...(when?{when,scope}:{})});
export const CONTROLS=[
 C('arms','Arms','limb',1,16,1,8,isL,'limbs'),C('length','Limb length','limb',.3,3,.01,1,isL,'limbs'),C('twist','Twist','limb',-180,180,1,0,isL,'limbs'),C('radial','Radial offset','limb',0,.8,.01,.08,isL,'limbs'),C('curl','Curl','limb',-720,720,1,0,isL,'limbs'),C('focus','Curl toward tip','limb',0,1,.01,0,s=>isL(s)&&s.params.curl!==0,'limbs with curl'),
 C('taper','Taper','limb',-1,.95,.01,.3,isL,'limbs'),C('swell','Swell','limb',0,1.5,.01,0,isL,'limbs'),C('hub','Hub size','limb',0,.8,.01,.2,s=>isL(s)&&s.hub!=='none','limbs with a hub'),
 C('p','Winds p / Lissajous a','knot',1,9,1,2,kt('torus','lissajous'),'torus and Lissajous knots'),C('q','Lobes q / Lissajous b','knot',1,12,1,3,kt('torus','lissajous'),'torus and Lissajous knots'),
 C('depth','Lobe depth','knot',.1,.95,.01,.5,kt('trefoil','figure8','torus'),'trefoil, figure-eight and torus knots'),C('phase','Phase','knot',0,1,.01,.3,kt('lissajous'),'Lissajous knots'),
 C('complexity','Harmonics / waypoints','knot',2,9,1,4,kt('random','hands'),'random knots and hands'),C('smooth','Smoothness','knot',.5,3,.05,1.6,kt('random','hands'),'random knots and hands'),C('relax','Relax','knot',0,60,1,20,kt('random','hands'),'random knots and hands'),
 C('seed','Seed','knot',0,9999,1,7,s=>kt('random','hands')(s)||isK(s)&&s.crossing==='seeded','random knots, hands and seeded crossings'),C('gap','Crossing gap','knot',0,.08,.002,.02,isK,'knots'),
 C('weight','Stroke weight','shape',.02,.4,.005,.16),C('outline','Outline weight','shape',0,.05,.001,.012),
 C('endSize','End size','shape',.3,2.5,.01,1,s=>isL(s)&&(s.end!=='none'||!['same','none'].includes(s.endAlt))||hands(s)&&s.end!=='none','limbs and hands with an end shape'),C('sleeve','Sleeve length','shape',0,1,.01,1,s=>isL(s)||hands(s),'limbs and hands'),
 C('scale','Scale','layout',.3,3,.01,1),C('x','Position x','layout',-.6,.6,.01,0),C('y','Position y','layout',-.6,.6,.01,0),C('rotate','Rotation','layout',-180,180,1,0),C('density','Field columns','layout',1,6,1,3,s=>s.layout==='field','the field layout')
];
export const OPTIONS={generator:['limbs','knot'],limb:LIMBS.map(l=>l.id),end:END_SHAPES,endAlt:['same',...END_SHAPES],ends:['tip','both','root'],mirror:['off','alternate'],order:['stack','cyclic','counter'],hub:HUBS,
 knot:KNOTS.map(k=>k.id),crossing:['alternate','laid','depth','seeded'],colour:['single','alternate','ramp','spectrum'],layout:['hero','field','crop','pair'],format:FORMATS.map(f=>f.id),finish:['flat','glow','riso','shadow'],ground:['plain','gradient','rays','rings']};
export const OPTION_WHEN={limb:isL,endAlt:isL,ends:isL,mirror:isL,order:isL,hub:isL,end:s=>isL(s)||hands(s),knot:isK,crossing:isK};
export const applies=(when,state)=>!when||when(state);
const P0={length:1,focus:0,arms:8,twist:0,radial:.08,curl:0,taper:.3,swell:0,hub:.2,p:2,q:3,depth:.5,phase:.3,complexity:4,smooth:1.6,relax:20,seed:7,gap:.02,weight:.16,outline:.012,endSize:1,sleeve:1,scale:1,x:0,y:0,rotate:0,density:3};
const O0={generator:'limbs',limb:'bend',end:'none',endAlt:'same',ends:'tip',mirror:'off',order:'stack',hub:'none',knot:'trefoil',crossing:'alternate',colour:'single',layout:'hero',format:'poster',finish:'flat',ground:'plain'};
// Palette roles: ground, figure (limbs, tubes), outline, end (hands, feet), accent (cups, beaks, hub), alt (alternate arms and arcs).
export const ROLES=['ground','figure','outline','end','accent','alt'];
const fam=(id,name,after,palette,colors,title,options,params,note)=>({id,name,after,palette,colors,title,set:{...O0,...options,params:{...P0,...params}},note});
export const FAMILIES=[
 fam('legs','Pinwheel of legs','Images of Illusion, 1984','Red / blue-violet',['#c8374a','#363b8e','#c8374a','#363b8e','#c8374a','#363b8e'],'IMAGES OF ROTATION',
  {limb:'bend',end:'foot',endAlt:'heel',order:'cyclic'},{arms:8,twist:20,radial:.03,curl:30,taper:.38,weight:.27,outline:.007,endSize:.8,sleeve:.9},'Eight legs turn around one centre, each over the next; shoes and heels alternate. Outlines in the ground colour separate the overlapping legs.'),
 fam('coffee','Coffee-cup arms','UCC Coffee Pavilion at Expo ’85, 1984','Ochre / black / cream',['#b9782a','#16130f','#16130f','#c5843a','#f4eee2','#16130f'],'GOOD DAY, NICE FRIENDS',
  {limb:'straight',end:'cup',ends:'both'},{arms:2,twist:90,radial:.3,length:1.1,curl:205,taper:0,swell:1.4,weight:.11,outline:.01,endSize:1.3,sleeve:.62},'Two sleeves bend into one circle; a cuffed hand at each end holds a cup.'),
 fam('trefoil','Trefoil tube','Inter Design ’81, 1981','Vermilion / black',['#d6423a','#1b1716','#d6423a','#d6423a','#f2eee6','#1b1716'],'TREFOIL',
  {generator:'knot',knot:'trefoil'},{weight:.2,outline:.008,gap:.012,depth:.56},'A fat tube tied in a trefoil. Outlines and gaps in the ground colour show which strand passes over.'),
 fam('handshake','Two hands knot','Inter Design ’81, 1981','Vermilion / black',['#d6423a','#1b1716','#d6423a','#d6423a','#f2eee6','#1b1716'],'INTER DESIGN',
  {generator:'knot',knot:'hands',end:'hand'},{weight:.1,outline:.006,gap:.008,complexity:7,smooth:1.4,relax:40,seed:0,sleeve:.5,endSize:1.5},'Two open tubes tangle across the sheet, crossing over and under, and end in two hands meeting at the centre.'),
 fam('spiral','Spiral leg','Kyogen, 1981','Navy / white',['#1c2150','#f3f1ea','#1c2150','#f3f1ea','#e04a2c','#f3f1ea'],'KYOGEN',
  {limb:'straight',end:'foot',ends:'root'},{arms:1,twist:0,radial:0,length:3,curl:640,focus:.85,taper:.55,weight:.4,outline:.008,endSize:.72,rotate:-20},'One leg curls inward into a spiral; the foot hangs from its outer end.'),
 fam('neon','Neon knot','new — electro','Night / magenta / cyan',['#07060b','#ff2bd6','#07060b','#19f0ff','#c6ff3d','#19f0ff'],'NEON KNOT',
  {generator:'knot',knot:'torus',colour:'alternate',finish:'glow',ground:'gradient'},{p:3,q:5,depth:.62,weight:.085,outline:.012,gap:.014},'A torus weave in alternating magenta and cyan arcs, glowing on near-black.'),
 fam('flower','Flower of hands','new','Cream / tomato / green',['#f2ead8','#e8452c','#2a1d1a','#f4b39b','#f2c230','#2f6b4f'],'FLOWER OF HANDS',
  {limb:'bend',end:'hand',mirror:'alternate',hub:'flower',colour:'alternate'},{arms:10,twist:12,radial:.1,taper:.12,weight:.12,outline:.008,hub:.24,sleeve:.66,endSize:1.05},'Ten arms in alternating sleeves, mirrored in pairs, open their hands around a flower hub.'),
 fam('riso','Riso pinwheel','new — risograph','Paper / fluorescent pink / blue',['#f4efe4','#ff48b0','#0078bf','#ff48b0','#ffe800','#0078bf'],'BIRDS OF A FEATHER',
  {limb:'s-curve',end:'beak',order:'cyclic',colour:'alternate',finish:'riso'},{arms:6,twist:48,radial:.06,taper:.5,weight:.2,outline:.009,endSize:1.1},'Six birds on long necks chase one another, each over the next, in two misregistered riso inks.'),
 fam('tangle','Seeded tangle','new','Bone / black / cobalt',['#efe9dc','#1d1b19','#efe9dc','#e2512b','#e2512b','#2d4fa3'],'TANGLE',
  {generator:'knot',knot:'random',colour:'alternate'},{complexity:8,smooth:1,relax:45,seed:12,weight:.085,outline:.008,gap:.012},'A seeded random closed curve, relaxed like rope so no two strands lie on top of each other, then interlaced.'),
 fam('weave','Lissajous weave','new','Linen / cobalt to vermilion',['#e9e3d3','#1f3b8f','#16130f','#e44b2a','#e44b2a','#e44b2a'],'LISSAJOUS',
  {generator:'knot',knot:'lissajous',colour:'ramp',ground:'rings'},{p:3,q:4,phase:.3,weight:.075,outline:.01,gap:.012},'A Lissajous curve woven over and under, its arcs walking from cobalt to vermilion.'),
 fam('kick','Neon kick','new — electro','Night / spectrum',['#08070d','#ff2bd6','#08070d','#19f0ff','#c6ff3d','#7a5cff'],'NEON KICK',
  {limb:'knee',end:'heel',order:'cyclic',colour:'spectrum',finish:'glow',ground:'rays'},{arms:7,twist:24,radial:.05,curl:70,taper:.45,weight:.17,outline:.01,endSize:.95},'Seven high-heeled legs kick around a centre, each a step round the hue circle, glowing on near-black rays.'),
 fam('field','Knot field','new — pattern','Paper / red / blue',['#f1ece2','#e3402f','#1d1d1f','#f1c232','#1d1d1f','#2b59c3'],'KNOT FIELD',
  {generator:'knot',knot:'random',colour:'alternate',layout:'field'},{complexity:4,smooth:1.3,relax:30,seed:3,weight:.12,outline:.014,gap:.016,density:3},'A field of small seeded knots, one seed per cell, red and blue arcs alternating.')
];
export const n2=v=>Math.round(v*100)/100;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),gcd=(a,b)=>b?gcd(b,a%b):a;
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const esc=s=>String(s).replace(/[<>&"]/g,'');
// Limb points: 3–7 finite pairs within ±1.6 U; the root stays at the origin.
export function cleanPoints(pts){if(!Array.isArray(pts)||pts.length<3||pts.length>7||!pts.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='number'&&Number.isFinite(v))))return null;return pts.map((p,i)=>i===0?[0,0]:p.map(v=>r3(clamp(v,-1.6,1.6))));}
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS){const v=input.params?.[c.key],ok=typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.trim()!==''&&Number.isFinite(+v);params[c.key]=ok?clamp(c.step>=1?Math.round(+v):+v,c.min,c.max):set.params[c.key];}
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],opts=Object.fromEntries(Object.keys(OPTIONS).map(k=>[k,pick(k)]));
 const custom=input.limb==='custom'&&cleanPoints(input.points),limb=custom?'custom':opts.limb,points=custom||LIMBS.find(l=>l.id===limb).points.map(p=>p.slice());
 const colors=Array.isArray(input.colors)&&input.colors.length===6&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&"]/g,'').slice(0,max):d;
 return {engine:ENGINE,family:family.id,stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,title:clip(input.title,family.title,40),info:clip(input.info,'Shape system study after Shigeo Fukuda / rotational limbs and interlaced knots',120),...opts,limb,points,params,colors};}

// ── Limbs ────────────────────────────────────────────────────────────────
// The master limb: a centripetal Catmull–Rom through the control points,
// resampled to equal spacing, then bent by `curl` (extra turning spread evenly).
const M=109;
export function limbCurve(state){const p=state.params,P=state.points.map(([x,y])=>[x*U*p.length,y*U*p.length]),per=24,dense=catmullRom(P,per,false),cum=cumulative(dense,false),base=resample(dense,M,false),turn=p.curl*Math.PI/180,pts=bend(base,turn,p.focus);
 const F=(1-p.sleeve)*.5,u0=state.ends!=='tip'?F:0,u1=state.ends!=='root'?1-F:1,hw=pts.map((_,i)=>{const u=i/(M-1),v=clamp((u-u0)/Math.max(1e-6,u1-u0),0,1);return Math.max(1.5,p.weight*U/2*(1-p.taper*u)*(1+p.swell*Math.sin(Math.PI*v)));});
 const handles=P.map((_,j)=>{const f=cum.s[Math.min(dense.length-1,j*per)]/cum.L*(M-1),i0=Math.min(M-2,Math.floor(f)),t=f-i0;return {pos:[pts[i0][0]+(pts[i0+1][0]-pts[i0][0])*t,pts[i0][1]+(pts[i0+1][1]-pts[i0][1])*t],phi:turn*bendAt(clamp((f-1)/(M-2),0,1),p.focus)};});
 return {pts,base,hw,L:cum.L,handles,control:P};}
// Arm i: the master limb turned by `twist` about its root, pushed out by the
// radial offset, mirrored on odd arms (alternate), then turned to its place.
export function armTransform(state,i){const p=state.params,mirror=state.mirror==='alternate'&&i%2===1,th=(p.rotate+i*360/p.arms)*Math.PI/180,tw=p.twist*Math.PI/180;
 return {mirror,angle:th,T:q=>{let v=rot(q,tw);v=[v[0]+p.radial*U,v[1]];if(mirror)v=[v[0],-v[1]];return rot(v,th);}};}
const unit=v=>{const d=Math.hypot(v[0],v[1])||1;return [v[0]/d,v[1]/d];},left=v=>[-v[1],v[0]];
function frame(pos,dir,side,u){const y=left(dir).map(v=>v*side);return `matrix(${[dir[0]*u,dir[1]*u,y[0]*u,y[1]*u,pos[0],pos[1]].map(r3).join(' ')})`;}
// Colour of item i of n (arms or arcs) for the colour mode.
function itemColor(state,role,i,n){const [,fig,,,,alt]=state.colors,base=role==='alt'?alt:fig;switch(state.colour){
 case 'alternate':return i%2?alt:fig;case 'ramp':return n>1?mix(fig,alt,i/(n-1)):fig;case 'spectrum':return hueWalk(fig,TAU*i/Math.max(1,n));default:return base;}}
// An end shape's outline: the outline colour, unless it would vanish against the part.
const edgeFor=(state,fill)=>{const [g,fig,ol]=state.colors;return contrast(fill,ol)>=1.4?ol:contrast(fill,fig)>=1.4?fig:contrast(fill,g)>=1.4?g:ol;};
const roleColor=(state,role,armColor)=>({end:state.colors[3],accent:state.colors[4],line:state.colors[2],figure:armColor}[role]);
// Parts in a frame: base outline + fill go to the arm's passes, over parts and details after.
function placeParts(parts,state,armColor,o,u,at,baseEdge=state.colors[2]){const out={outer:'',inner:'',over:'',detail:''},ou=o/u;
 for(const part of parts){const fill=roleColor(state,part.role,armColor),edge=part.layer==='base'?baseEdge:edgeFor(state,fill);
  if(part.layer==='detail'){out.detail+=part.prims.map(q=>innerSVG(q,edgeFor(state,state.colors[3]))).join('');continue;}
  const o1=part.prims.map(q=>outerSVG(q,ou,edge)).join(''),i1=part.prims.map(q=>innerSVG(q,fill)).join('');
  if(part.layer==='base'){out.outer+=o1;out.inner+=i1;}else out.over+=o1+i1;}
 for(const k in out)if(out[k])out[k]=`<g transform="${at}">${out[k]}</g>`;return out;}
// Sub-polyline between fractional indices.
function sub(pts,f0,f1){const at=f=>{const i=Math.min(pts.length-2,Math.floor(f)),t=f-i;return [pts[i][0]+(pts[i+1][0]-pts[i][0])*t,pts[i][1]+(pts[i+1][1]-pts[i][1])*t];},out=[at(f0)];for(let i=Math.ceil(f0+1e-9);i<f1;i++)out.push(pts[i]);out.push(at(f1));return out;}
const pathD=pts=>'M'+pts.map(([x,y])=>r1(x)+' '+r1(y)).join('L');
// A tapered stroke as short round-capped chunks (exact round joins, no offset loops).
function chunks(pts,hw,f0,f1,grow,col,firstButt,lastButt){if(f1-f0<1e-6)return '';const k=Math.max(1,Math.round((f1-f0)/3)),out=[];
 for(let c=0;c<k;c++){const a=f0+(f1-f0)*c/k,b=f0+(f1-f0)*(c+1)/k,w=2*(hw[Math.round((a+b)/2)]+grow),cap=c===0&&firstButt||c===k-1&&lastButt?'butt':'round';out.push(`<path d="${pathD(sub(pts,a,b))}" stroke="${col}" stroke-width="${r1(w)}" stroke-linecap="${cap}"/>`);}
 return out.join('');}
// A self-overlapping limb is drawn again as short segments from root to tip,
// each with its own outline, so later coils lie over earlier ones. Fills reach
// back over the previous segment; outlines stop at the joint (no seams).
function layered(pts,hw,f0,f1,o,ol,col){if(f1-f0<1e-6)return '';const k=Math.max(1,Math.round((f1-f0)/2)),out=[],step=dist(pts[0],pts[1])||1;
 for(let c=0;c<k;c++){const a=f0+(f1-f0)*c/k,b=f0+(f1-f0)*(c+1)/k,h=hw[Math.round((a+b)/2)],back=c===0?a:Math.max(f0,a-(h+o)/step-.5);
  out.push(`<path d="${pathD(sub(pts,a,b))}" stroke="${ol}" stroke-width="${r1(2*h+2*o)}" stroke-linecap="${c===0?'butt':'round'}"/><path d="${pathD(sub(pts,back,b))}" stroke="${col}" stroke-width="${r1(2*h)}"${c===k-1&&b>=pts.length-1-1e-6?' stroke-linecap="round"':''}/>`);}
 return `<g fill="none" stroke-linecap="butt" stroke-linejoin="round">${out.join('')}</g>`;}
// Whether the master limb overlaps itself (points far apart along it, close in the plane).
function overlapsItself(pts,hw,o){const m=pts.length;for(let i=0;i<m;i++)for(let j=i+4;j<m;j++){const r=hw[i]+hw[j]+o,d=dist(pts[i],pts[j]);if(d<r){let along=0;for(let k=i;k<j;k++)along+=dist(pts[k],pts[k+1]);if(along>r*1.6)return true;}}return false;}
function armParts(state,arm,i,o,armColor){const p=state.params,pts=arm.pts,last=pts.length-1,u=p.weight*U*p.endSize,kind=state.endAlt!=='same'&&i%2===1?state.endAlt:state.end;
 const side=arm.mirror?-1:1,ends=[];if(state.ends!=='root')ends.push({at:frame(pts[last],unit([pts[last][0]-pts[last-2][0],pts[last][1]-pts[last-2][1]]),side,u)});
 if(state.ends!=='tip')ends.push({at:frame(pts[0],unit([pts[0][0]-pts[2][0],pts[0][1]-pts[2][1]]),side,u)});
 return ends.map(e=>placeParts(endParts(kind),state,armColor,o,u,e.at));}
// One arm: outline layer (stroke + base parts), fill layer (sleeve, then cuffed
// forearms), over parts, cuff lines and details.
function drawArm(state,arm,i,o,self=false){const p=state.params,pts=arm.pts,hw=arm.hw,last=pts.length-1,armColor=itemColor(state,'figure',i,p.arms),endColor=state.colors[3],ol=state.colors[2];
 const F=(1-p.sleeve)*.5*last,c0=state.ends!=='tip'?F:0,c1=state.ends!=='root'?last-F:last,parts=armParts(state,arm,i,o,armColor);
 let s=`<g fill="none" stroke-linejoin="round">${chunks(pts,hw,0,last,o,ol)}</g>${parts.map(e=>e.outer).join('')}<g fill="none" stroke-linejoin="round">${chunks(pts,hw,c0,c1,0,armColor)}`;
 if(c0>0)s+=chunks(pts,hw,0,c0,0,endColor,false,true);if(c1<last)s+=chunks(pts,hw,c1,last,0,endColor,true,false);s+='</g>'+parts.map(e=>e.inner).join('');
 if(self)s+=layered(pts,hw,0,c0,o,ol,endColor)+layered(pts,hw,c0,c1,o,ol,armColor)+layered(pts,hw,c1,last,o,ol,endColor)+parts.map(e=>e.inner).join('');
 for(const f of [c0>0?c0:null,c1<last?c1:null])if(f!==null){const a=sub(pts,Math.max(0,f-.5),Math.min(last,f+.5)),d=unit([a[a.length-1][0]-a[0][0],a[a.length-1][1]-a[0][1]]),nv=left(d),h=hw[Math.round(f)]+o*.5,c=sub(pts,f,f)[0];s+=`<path d="M${r1(c[0]-nv[0]*h)} ${r1(c[1]-nv[1]*h)}L${r1(c[0]+nv[0]*h)} ${r1(c[1]+nv[1]*h)}" stroke="${ol}" stroke-width="${r1(Math.max(o,1.5))}"/>`;}
 return s+parts.map(e=>e.over+e.detail).join('');}
function silhouette(state,arm,i,o){const parts=armParts(state,arm,i,o,'#fff');return `<g fill="none" stroke-linejoin="round">${chunks(arm.pts,arm.hw,0,arm.pts.length-1,o,'#fff')}</g>${parts.map(e=>(e.outer+e.over).replace(/(fill|stroke)="#[0-9a-f]{6}"/g,(m,a)=>`${a}="#fff"`)).join('')}`;}
export function limbScene(state){const p=state.params,g=limbCurve(state),arms=[];
 for(let i=0;i<p.arms;i++){const t=armTransform(state,i);arms.push({i,mirror:t.mirror,angle:t.angle,T:t.T,pts:g.pts.map(t.T),hw:g.hw});}
 const o=p.outline*U,u=p.weight*U*p.endSize,ext=i=>partsRadius(endParts(state.endAlt!=='same'&&i%2===1?state.endAlt:state.end))*u,box=[Infinity,Infinity,-Infinity,-Infinity],grow=(q,r)=>{box[0]=Math.min(box[0],q[0]-r);box[1]=Math.min(box[1],q[1]-r);box[2]=Math.max(box[2],q[0]+r);box[3]=Math.max(box[3],q[1]+r);};
 if(state.hub!=='none'&&p.hub>0)grow([0,0],p.hub*U+o);for(const a of arms){a.pts.forEach((q,j)=>grow(q,a.hw[j]+o));const e=ext(a.i)+o,last=a.pts.length-1;if(e>o){if(state.ends!=='root')grow(a.pts[last],e);if(state.ends!=='tip')grow(a.pts[0],e);}}
 const T0=arms[0].T,turn0=(p.rotate+p.twist)*Math.PI/180;return {kind:'limbs',g,arms,o,box,self:overlapsItself(g.pts,g.hw,o),centre:p.arms>1?[0,0]:null,handles:g.handles.map((h,j)=>({j,pos:T0(h.pos),angle:turn0+h.phi}))};}
function drawLimbs(state,sc,uid,px){const p=state.params,{arms,o}=sc,N=arms.length,body=[],defs=[],stage=state.stage,ol=state.colors[2],fig=state.colors[1];
// Construction passes: 1 the master limb (control polygon, spline, bent centreline,
 // handles) with the arm axes; 2 every arm as a translucent silhouette with its centreline.
 const gc=contrast(fig,state.colors[0])>=contrast(ol,state.colors[0])?fig:ol;
 if(stage===1){const T0=arms[0].T,w=r1(px*2);let s=`<g fill="none" stroke="${gc}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">`;for(const a of arms)s+=`<path d="M0 0L${r1(Math.cos(a.angle)*U*.9)} ${r1(Math.sin(a.angle)*U*.9)}" stroke-opacity=".4" stroke-dasharray="${r1(px*6)} ${r1(px*6)}"/>`;
  if(p.radial>0)s+=`<circle r="${r1(p.radial*U)}" stroke-opacity=".55" stroke-dasharray="${r1(px*5)} ${r1(px*5)}"/>`;if(state.hub!=='none'&&p.hub>0)s+=`<circle r="${r1(p.hub*U)}" stroke-opacity=".7"/>`;
  s+=`<path d="${pathD(sc.g.control.map(T0))}" stroke-opacity=".7" stroke-dasharray="${r1(px*8)} ${r1(px*5)}"/><path d="${pathD(sc.g.base.map(T0))}" stroke-opacity=".45"/><path d="${pathD(arms[0].pts)}" stroke-width="${r1(px*5)}"/>`;
  s+=sc.handles.map((h,j)=>`<circle cx="${r1(h.pos[0])}" cy="${r1(h.pos[1])}" r="${r1(px*(j?8:5))}" fill="${j?gc:'none'}" stroke-width="${r1(px*2.5)}"/>`).join('')+'</g>';return {body:s,defs:''};}
 if(stage===2){let s='';for(const a of arms){const col=itemColor(state,'figure',a.i,N);s+=`<g fill="none" stroke-linejoin="round" opacity=".38">${chunks(a.pts,a.hw,0,a.pts.length-1,0,col)}</g>`;
   for(const e of armParts(state,a,a.i,0,col))s+=`<g opacity=".38">${e.outer+e.inner+e.over}</g>`;s+=`<path d="${pathD(a.pts)}" fill="none" stroke="${gc}" stroke-width="${r1(px*3)}" stroke-linecap="round"/>`;}
  return {body:s,defs:''};}
 // Overlap order. stack: later arms on top. cyclic: each arm over the next —
 // drawn last to first, then the last arm is drawn again inside the first
 // arm's silhouette, where the first arm is the only one visible. counter: the reverse.
 const order=state.order==='cyclic'?arms.slice().reverse():arms;for(const a of order)body.push(drawArm(state,a,a.i,o,sc.self));
 if(N>2&&state.order!=='stack'){const [top,under]=state.order==='cyclic'?[arms[N-1],arms[0]]:[arms[0],arms[N-1]];defs.push(`<mask id="ov${uid}">${silhouette(state,under,under.i,o)}</mask>`);body.push(`<g mask="url(#ov${uid})">${drawArm(state,top,top.i,o,sc.self)}</g>`);}
 if(state.hub!=='none'&&p.hub>0){const parts=hubParts(state.hub,p.hub*U,N);for(const part of parts){const fill=roleColor(state,part.role,fig);body.push(part.prims.map(q=>outerSVG(q,o,ol,r1)+innerSVG(q,fill,r1)).join(''));}}
 return {body:body.join(''),defs:defs.join('')};}

// ── Knots ────────────────────────────────────────────────────────────────
// Closed curves and open strands in figure units (radius about U), each with a
// 3-D lift z used by the depth crossing pattern.
// With gcd(p, q) = g the curve is a g-component torus link: parallel copies shifted around the tube.
// They are spaced at 0.9 of the even step; even spacing can make copies coincide (4/6) or share crossings.
function torus(p,q,depth,phase0=0){const g=gcd(p,q),pp=p/g,qq=q/g,k=U/(1+depth);return Array.from({length:g},(_,c)=>({closed:true,f:t=>{const a=qq*t+TAU*c/g*.9,r=1+depth*Math.cos(a);return [r*Math.cos(pp*t+phase0)*k,r*Math.sin(pp*t+phase0)*k,Math.sin(a)];}}));}
// Harmonic k has amplitude (1 + 0.3(k − 1))^−smooth: more harmonics tie more crossings, smoothness rounds them.
function fourier(R,K,smooth){const co=Array.from({length:K},(_,k)=>Array.from({length:6},()=>(R()*2-1)/(1+.3*k)**smooth));
 return t=>{let x=0,y=0,z=0;co.forEach((c,k)=>{const a=(k+1)*t;x+=c[0]*Math.cos(a)+c[1]*Math.sin(a);y+=c[2]*Math.cos(a)+c[3]*Math.sin(a);z+=c[4]*Math.cos(a)+c[5]*Math.sin(a);});return [x,y,z];};}
const sampleClosed=(f,n=1600)=>Array.from({length:n},(_,i)=>f(TAU*i/n));
function normalize(curves){let r=0;for(const c of curves)for(const q of c)r=Math.max(r,Math.hypot(q[0],q[1]));const k=U/(r||1);return curves.map(c=>c.map(q=>[q[0]*k,q[1]*k,q[2]]));}
// Two open strands that wander from free ends inside the field and end at the
// centre facing each other, where the hands meet.
// Two open strands that wander through the field and end at the centre facing
// each other, where the hands meet. Waypoints are stratified over the disc,
// dealt alternately to the two strands, and each strand visits its own with a
// randomised nearest-neighbour walk from its free end: the strands fill the
// field and keep crossing each other. Lower smoothness means more waypoints.
function handStrands(state,R){const p=state.params,n=clamp(Math.round(2*p.complexity*1.6/p.smooth),3,40),g=Math.ceil(Math.sqrt(2*n*1.35)),pool=[];
 for(let i=0;i<g;i++)for(let j=0;j<g;j++){const x=((i+.15+.7*R())/g*2-1)*.9*U,y=((j+.15+.7*R())/g*2-1)*.9*U;if(Math.hypot(x,y)<.92*U&&Math.hypot(x,y)>.18*U)pool.push([x,y]);}
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return [-1,1].map((s,k)=>{let left=pool.filter((_,i)=>i%2===k).slice(0,n);const start=left.reduce((b,q)=>s*(q[0]+q[1])<s*(b[0]+b[1])?q:b,left[0]),way=[start];left=left.filter(q=>q!==start);
  while(left.length){const cur=way[way.length-1];left.sort((a,b)=>dist(a,cur)-dist(b,cur));way.push(left.splice(Math.min(left.length-1,Math.floor(R()*R()*3)),1)[0]);}
  return {closed:false,pts:catmullRom([...way,[s*.52*U,s*-.06*U],[s*.3*U,s*-.045*U],[s*.13*U,s*-.035*U]],40,false)};});}
export function knotScene(state,variant=0,aspect=1){const p=state.params,W=p.weight*U,o=p.outline*U,seed=p.seed+variant*1013,R=rng(seed),type=state.knot,rotA=p.rotate*Math.PI/180;let curves,guide=null,pre=null;
 if(type==='hands'){const hs=handStrands(state,R).map(h=>({...h,pts:h.pts.map(q=>[q[0],q[1]*aspect])}));guide=hs.map(h=>h.pts);curves=hs.map(h=>({closed:false,pts:h.pts}));}
 else{let fs;if(type==='trefoil')fs=torus(2,3,p.depth);else if(type==='figure8')fs=torus(3,2,p.depth);else if(type==='torus')fs=torus(p.p,p.q,p.depth);
  else if(type==='lissajous'){const g=gcd(p.p,p.q),a=p.p/g,b=p.q/g,ph=(.05+.9*p.phase)*Math.PI/b;fs=[{closed:true,f:t=>[Math.cos(a*t+ph)*U,Math.cos(b*t)*U,Math.cos((a+b)*t+ph*.7)]}];}
  else fs=[{closed:true,f:fourier(R,p.complexity,p.smooth)}];
  curves=normalize(fs.map(c=>sampleClosed(c.f))).map(pts=>({closed:true,pts:type==='random'?pts.map(q=>[q[0],q[1]*aspect,q[2]]):pts}));}
 // Resample to about a quarter of the tube width (z rides along as the third coordinate).
 let strands=curves.map(c=>{const L=cumulative(c.pts.map(q=>[q[0],q[1]]),c.closed).L,count=clamp(Math.round(L/Math.max(4,W*.24)),c.closed?160:60,2400);const xy=resample(c.pts.map(q=>[q[0],q[1]]),count,c.closed);
  const zs=c.pts[0].length>2?resample(c.pts.map((q,i)=>[i,q[2]]),count,c.closed).map(q=>q[1]):xy.map(()=>0);return {closed:c.closed,pts:xy.map((q,i)=>rot(q,rotA)),z:zs};});
 if((type==='random'||type==='hands')&&p.relax>0){pre=strands.map(s=>s.pts);const relaxed=relax(strands,{iterations:p.relax,radius:W+2*o+2*p.gap*U+W*.25,bound:U*1.02,aspect,pin:type==='hands'?Math.round(.32*U/Math.max(4,W*.24)):3});strands=relaxed.map((s,k)=>({...strands[k],pts:s.pts}));}
 if(type==='random'||type==='hands')strands=unkink(strands,3.5*(W+2*o)).map((s,k)=>({...strands[k],pts:s.pts}));
 const crossings=findCrossings(strands),cums=strands.map(s=>cumulative(s.pts,s.closed));
 // Depth for the random curves and hands: a seeded smooth lift along each strand.
 const zAt=(k,s)=>{const st=strands[k],L=cums[k].L,i=Math.round(s/L*(st.pts.length-(st.closed?0:1)))%st.pts.length;return type==='random'||type==='hands'?Math.sin(s/L*TAU*(2+k)+seed)+.6*Math.sin(s/L*TAU*(5+k)+seed*1.7):st.z[i];};
 const assign=assignCrossings(crossings,strands,state.crossing,{seed,z:zAt});
 const box=[Infinity,Infinity,-Infinity,-Infinity],e=W/2+o+(type==='hands'&&state.end!=='none'?W*p.endSize*partsRadius(endParts(state.end))*.6:0);for(const st of strands)for(const q of st.pts){box[0]=Math.min(box[0],q[0]-e);box[1]=Math.min(box[1],q[1]-e);box[2]=Math.max(box[2],q[0]+e);box[3]=Math.max(box[3],q[1]+e);}
 return {kind:'knot',strands,cums,crossings,assign,W,o,gap:p.gap*U,box,centre:null,guide,pre};}
// Splits every strand into pieces, each holding at most one crossing
// occurrence: cuts sit halfway between consecutive occurrences, at every
// under occurrence (where an arc ends, hidden in the gap) and at the cuff.
export function knotPieces(state,sc){const p=state.params,out=[];
 sc.strands.forEach((st,k)=>{const {L}=sc.cums[k],occ=sc.assign.byStrand[k],cuts=[],n=occ.length,cuff=state.knot==='hands'&&!st.closed?L-(1-p.sleeve)*.5*U:null;
  for(let i=0;i<n;i++){if(!st.closed&&i===n-1)break;const a=occ[i].s,b=i===n-1?occ[0].s+L:occ[i+1].s;cuts.push(((a+b)/2)%L);}
  for(const o of occ)if(o.role==='under')cuts.push(o.s);if(cuff!==null&&cuff>0)cuts.push(cuff);cuts.sort((a,b)=>a-b);
  const u=cuts.filter((c,i)=>i===0||c-cuts[i-1]>1e-6),ivs=[];
  if(st.closed){if(!u.length)ivs.push([0,L,true]);else u.forEach((c,i)=>ivs.push([c,i===u.length-1?u[0]+L:u[i+1]]));}else{const b=[0,...u.filter(c=>c>1e-6&&c<L-1e-6),L];for(let i=0;i<b.length-1;i++)ivs.push([b[i],b[i+1]]);}
  const unders=occ.filter(o=>o.role==='under').map(o=>o.s),arcs=Math.max(1,unders.length+(st.closed?0:1));
  for(const [a,b,whole] of ivs){const inside=s=>s>a+1e-6&&s<b-1e-6||st.closed&&s+L>a+1e-6&&s+L<b-1e-6,over=occ.find(o=>o.role==='over'&&inside(o.s)),mid=((a+b)/2)%L;
   let arc=unders.filter(s=>s<=mid+1e-9).length;if(st.closed)arc=(arc-1+unders.length)%Math.max(1,unders.length);
   out.push({strand:k,a,b,whole:!!whole,role:over?'over':'under',over,arc,arcs,forearm:cuff!==null&&mid>cuff});}});
 return out;}
function drawKnot(state,sc,uid,px){const p=state.params,{strands,cums,W,o}=sc,stage=state.stage,[,fig,ol,endC]=state.colors,epsO=px,epsI=px*2.6;
 if(stage<=2){const gc=contrast(fig,state.colors[0])>=contrast(ol,state.colors[0])?fig:ol;let s=`<g fill="none" stroke-linejoin="round" stroke-linecap="round">`;
  if(stage===1){if(sc.pre)s+=sc.pre.map((q,k)=>`<path d="${pathD(strands[k].closed?[...q,q[0]]:q)}" stroke="${gc}" stroke-opacity=".45" stroke-width="${r1(px*2)}" stroke-dasharray="${r1(px*6)} ${r1(px*6)}"/>`).join('');
   if(sc.guide)s+=sc.guide.map(g=>g.filter((_,i)=>i%40===0).map(q=>`<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="${r1(px*7)}" fill="${gc}" stroke="none"/>`).join('')).join('');}
  s+=strands.map(st=>`<path d="${pathD(st.closed?[...st.pts,st.pts[0]]:st.pts)}" stroke="${gc}" stroke-width="${r1(px*(stage===1?4:2.5))}"/>`).join('');
  if(stage===2)for(const c of sc.crossings){const o1=c.occ[c.over],u1=c.occ[1-c.over],len=W*.9;s+=`<path d="M${r1(c.p[0]-o1.dir[0]*len)} ${r1(c.p[1]-o1.dir[1]*len)}L${r1(c.p[0]+o1.dir[0]*len)} ${r1(c.p[1]+o1.dir[1]*len)}" stroke="${gc}" stroke-width="${r1(px*9)}"/>`;
   for(const sg of [-1,1])s+=`<circle cx="${r1(c.p[0]+u1.dir[0]*len*sg)}" cy="${r1(c.p[1]+u1.dir[1]*len*sg)}" r="${r1(px*5)}" fill="${contrast(ol,state.colors[0])>1.5?ol:mix(gc,state.colors[0],.45)}" stroke="none"/>`;}
  return {body:s+'</g>',defs:''};}
 const pieces=knotPieces(state,sc),edgeEnd=edgeFor(state,endC),color=pc=>pc.forearm?endC:itemColor(state,'figure',pc.arc,pc.arcs),edge=pc=>pc.forearm?edgeEnd:ol,// Internal joints overlap: fills reach further than outlines, so no anti-aliased seam shows.
 line=(pc,eps)=>{const st=strands[pc.strand],cum=cums[pc.strand],a=st.closed||pc.a>1e-6?pc.a-eps:0,b=st.closed||pc.b<cum.L-1e-6?pc.b+eps:cum.L;return slice(st.pts,cum,st.closed,a,b);},geo=(pc,eps)=>pc.whole?pathD(strands[pc.strand].pts)+'Z':pathD(line(pc,eps));
 const caps=pc=>{const st=strands[pc.strand],cum=cums[pc.strand];if(st.closed)return '';let c='';for(const at of [pc.a<1e-6?0:null,pc.b>cum.L-1e-6?cum.L:null])if(at!==null){const q=pointAt(st.pts,cum,false,at);c+=`<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="${r1(W/2+o)}" fill="${edge(pc)}"/><circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="${r1(W/2)}" fill="${color(pc)}"/>`;}return c;};
 const tube=list=>`<g fill="none" stroke-linecap="butt" stroke-linejoin="round">${o>0?list.map(pc=>`<path d="${geo(pc,epsO)}" stroke="${edge(pc)}" stroke-width="${r1(W+2*o)}"/>`).join(''):''}${list.map(pc=>`<path d="${geo(pc,epsI)}" stroke="${color(pc)}" stroke-width="${r1(W)}"/>`).join('')}</g>${list.map(caps).join('')}`;
 // The gap: each crossing cuts a band W + 2·outline + 2·gap wide around its
 // over strand out of its own under halves only, as far along the over strand
 // as needed to clear the under tube. Cutting per crossing never touches the
 // over strand itself, so neighbouring crossings cannot cut it. The cut halves
 // are plain polygons (Clipper), so posters need no masks.
 const hu=W/2+o,hh=W/2+o+sc.gap,band=new Map();
 for(const c of sc.crossings){const ov=c.occ[c.over],un=c.occ[1-c.over],st=strands[ov.strand],cum=cums[ov.strand],sn=Math.max(Math.sin(c.angle),.17),Lh=(hu+hh*Math.cos(c.angle))/sn+hh*.6,a=st.closed?ov.s-Lh:Math.max(0,ov.s-Lh),b=st.closed?ov.s+Lh:Math.min(cum.L,ov.s+Lh);
  const co=Math.abs(Math.cos(c.angle)),reach=Math.sqrt(hu*hu+hh*hh+2*hu*hh*co)/sn;
  band.set(`${un.strand}:${r3(un.s)}`,{pts:slice(st.pts,cum,st.closed,a,b),half:hh,disc:{c:c.p,r:reach*1.2+hh*.3}});}
 const bandOf=pc=>{if(pc.role!=='under')return null;const L=cums[pc.strand].L;for(const at of [pc.a,pc.b]){const b=band.get(`${pc.strand}:${r3(((at%L)+L)%L)}`);if(b)return b;}return null;};
 let body='';for(const pc of pieces.filter(pc=>pc.role==='under')){const b=bandOf(pc);if(!b){body+=tube([pc]);continue;}body+=(o>0?`<path d="${tubeMinus(line(pc,epsO),W/2+o,[b])}" fill="${edge(pc)}"/>`:'')+`<path d="${tubeMinus(line(pc,epsI),W/2,[b])}" fill="${color(pc)}"/>`+caps(pc);}
 body+=tube(pieces.filter(pc=>pc.role==='over'));const defs=[];
 // Hands at the strand ends.
 if(state.knot==='hands'&&state.end!=='none')strands.forEach((st,k)=>{if(st.closed)return;const cum=cums[k],q=pointAt(st.pts,cum,false,cum.L),d=tangentAt(st.pts,cum,false,cum.L-W*.3,W*.3),u=W*p.endSize,e=placeParts(endParts(state.end),state,fig,o,u,frame(q,d,k?1:-1,u),edgeEnd);body+=e.outer+e.inner+e.over+e.detail;});
 return {body,defs:defs.join('')};}

// ── Scenes, layout and poster ────────────────────────────────────────────
// Random knots and hands stretch to the slot's aspect so they fill the frame.
export const aspectOf=(state,slot)=>state.generator==='knot'&&(state.knot==='random'||state.knot==='hands')?r3(clamp(slot.ry/slot.rx,.6,1.8)):1;
export function figureScene(state,variant=0,aspect=1){return state.generator==='limbs'?limbScene(state):knotScene(state,variant,aspect);}
function drawFigure(state,sc,uid,px){return state.generator==='limbs'?drawLimbs(state,sc,uid,px):drawKnot(state,sc,uid,px);}
export function boxFor(state){const f=FORMATS.find(x=>x.id===state.format),m=Math.round(Math.min(f.w,f.h)*.05);return [m,Math.round(f.h*.105),f.w-m,f.h-Math.round(f.h*.07)];}
// Figure slots for a layout: centre, radius in poster px, mirror, colour swap, variant.
// Figure slots for a layout: centre and half extents (rx, ry) in poster px, mirror, colour swap, variant.
export function slots(state){const p=state.params,[x0,y0,x1,y1]=boxFor(state),bw=x1-x0,bh=y1-y0,cx=(x0+x1)/2+p.x*bw,cy=(y0+y1)/2+p.y*bh,m=Math.min(bw,bh),sl=(cx,cy,rx,ry,mirror=false,swap=false,variant=0)=>({cx,cy,rx:rx*p.scale,ry:ry*p.scale,mirror,swap,variant});
 if(state.layout==='field'){const cols=p.density,rows=Math.max(1,Math.round(cols*bh/bw)),cw=bw/cols,ch=bh/rows,out=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)out.push(sl(x0+cw*(c+.5)+p.x*cw,y0+ch*(r+.5)+p.y*ch,cw/2*.92,ch/2*.92,(r+c)%2===1,r%2===1,r*cols+c));return out;}
 if(state.layout==='crop')return [sl(cx+.2*bw,cy+.14*bh,m*1.15,m*1.15)];
 if(state.layout==='pair')return [sl(x0+bw*.36+p.x*bw,y0+bh*.32+p.y*bh,m*.38,m*.38),sl(x0+bw*.64+p.x*bw,y0+bh*.68+p.y*bh,m*.38,m*.38,true,true,1)];
 return [sl(cx,cy,bw/2*.97,bh/2*.97)];}
// Scale and centre that fit a scene into a slot: rotational figures keep the hub at the slot centre.
export function fitOf(sc,slot){const [x0,y0,x1,y1]=sc.box,c=sc.centre??[(x0+x1)/2,(y0+y1)/2],hx=Math.max(c[0]-x0,x1-c[0],1),hy=Math.max(c[1]-y0,y1-c[1],1),k=Math.min(slot.rx/hx,slot.ry/hy);return {k,c};}
const swapColors=c=>[c[0],c[5],c[2],c[3],c[4],c[1]];
function groundSVG(state,W,H,center,uid){const [g,,ol,,,alt]=state.colors,[cx,cy]=center;if(state.stage<4||state.ground==='plain')return `<rect width="${W}" height="${H}" fill="${g}"/>`;
 if(state.ground==='gradient')return `<linearGradient id="gr${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g}"/><stop offset="1" stop-color="${mix(g,alt,.42)}"/></linearGradient><rect width="${W}" height="${H}" fill="url(#gr${uid})"/>`;
 const tint=mix(g,luminance(g)>.2?ol:alt,luminance(g)>.2?.1:.22),R=Math.hypot(W,H);
 if(state.ground==='rays'){const n=state.generator==='limbs'?Math.max(8,state.params.arms*2):24;let d='';for(let i=0;i<n;i+=2){const a=TAU*i/n+state.params.rotate*Math.PI/180,b=TAU*(i+1)/n+state.params.rotate*Math.PI/180;d+=`M${r1(cx)} ${r1(cy)}L${r1(cx+R*Math.cos(a))} ${r1(cy+R*Math.sin(a))}L${r1(cx+R*Math.cos(b))} ${r1(cy+R*Math.sin(b))}Z`;}return `<rect width="${W}" height="${H}" fill="${g}"/><path d="${d}" fill="${tint}"/>`;}
 const step=Math.min(W,H)*.045;let s=`<rect width="${W}" height="${H}" fill="${g}"/><g fill="none" stroke="${tint}" stroke-width="${r1(step/2)}">`;for(let r=step*.75;r<R;r+=step)s+=`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"/>`;return s+'</g>';}
const inkFor=g=>luminance(g)>.2?'#16130f':'#f4f1ea';
function textSVG(state,W,H){const ink=inkFor(state.colors[0]),m=Math.round(Math.min(W,H)*.05),lines=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,3),size=Math.round(Math.min(W,H)*.044);
 return `<g font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" fill="${ink}"><text x="${m}" y="${m+size*.8}" font-size="${size}" font-weight="700" letter-spacing="${n2(size*.02)}">${esc(state.title)}</text>${lines.map((l,i)=>`<text x="${m}" y="${H-m*.7-(lines.length-1-i)*15}" font-size="11.5" letter-spacing=".2">${esc(l)}</text>`).join('')}<text x="${W-m}" y="${H-m*.7}" font-size="11.5" text-anchor="end" letter-spacing=".2">${state.generator==='limbs'?`${state.params.arms}-fold`:`${state.knot==='hands'?'two strands':KNOTS.find(k=>k.id===state.knot).name.toLowerCase()}`}</text></g>`;}
const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
// `opts.fits` (from a previous render's slots) keeps scale and centre fixed, e.g. while a handle is dragged.
export function render(input={},opts={}){const state=resolve(input),f=FORMATS.find(x=>x.id===state.format),W=f.w,H=f.h,uid=uidOf(state),S=slots(state),scenes=new Map(),defs=[],figs=[],feat={crossings:0,breaks:0,arms:state.generator==='limbs'?state.params.arms:0,strands:0,figures:S.length,slots:[]};
 const stage=state.stage,finish=stage===4?state.finish:'flat',fx=[];
 S.forEach((slot,i)=>{const variant=state.generator==='knot'&&(state.knot==='random'||state.knot==='hands')?slot.variant:0,st=slot.swap?{...state,colors:swapColors(state.colors)}:state;
  const key=variant+':'+aspectOf(state,slot);if(!scenes.has(key))scenes.set(key,figureScene(state,variant,aspectOf(state,slot)));const sc=scenes.get(key),{k,c}=opts.fits?.[i]??fitOf(sc,slot),px=1/k,place=`translate(${r1(slot.cx)} ${r1(slot.cy)}) scale(${r3(slot.mirror?-k:k)} ${r3(k)}) translate(${r1(-c[0])} ${r1(-c[1])})`,id=uid+'-'+i;
  feat.slots.push({cx:slot.cx,cy:slot.cy,k,c,mirror:slot.mirror,variant});if(i===0){feat.crossings=sc.crossings?.length??0;feat.breaks=sc.assign?.breaks??0;feat.strands=sc.strands?.length??0;feat.box=sc.box.map((v,j)=>j%2?slot.cy+(v-c[1])*k:slot.cx+(v-c[0])*k*(slot.mirror?-1:1));}
  const d=drawFigure(st,sc,id,px);defs.push(d.defs);
  if(finish==='shadow'){const sh=contrast(state.colors[2],state.colors[0])>1.5?state.colors[2]:mix(state.colors[0],'#000000',.5),flat={...st,colors:st.colors.map((c,j)=>j?sh:c)},ds=drawFigure(flat,sc,id+'s',px);defs.push(ds.defs);figs.push(`<g transform="translate(${r1(W*.014)} ${r1(W*.014)}) ${place}">${ds.body}</g>`);}
  figs.push(`<g transform="${place}">${d.body}</g>`);});
 let figures=figs.join('');
 if(finish==='glow'){fx.push(`<filter id="glow${uid}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${r1(W*.009)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);figures=`<g filter="url(#glow${uid})">${figures}</g>`;}
 if(finish==='riso'){fx.push(`<filter id="grain${uid}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${state.params.seed%97}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.1"/></filter>`);
  figures=`<g opacity=".88" style="mix-blend-mode:multiply" transform="translate(${r1(W*.007)} ${r1(-W*.004)})">${figures.replace(/id="(gap|ov)/g,'id="r$1').replace(/url\(#(gap|ov)/g,'url(#r$1')}</g><g style="mix-blend-mode:multiply">${figures}</g><rect width="${W}" height="${H}" fill="${state.colors[0]}" filter="url(#grain${uid})" opacity=".35" style="mix-blend-mode:multiply"/>`;
  defs.push(defs.join('').replace(/id="(gap|ov)/g,'id="r$1'));}
 defs.push(...fx);
 const ground=groundSVG(state,W,H,[S[0].cx,S[0].cy],uid),label={1:'skeleton',2:'repeat and crossings',3:'figure',4:'poster'}[stage];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(state.title)} — rotational limbs and knots, ${state.family}, ${label}</title><defs>${defs.join('')}</defs>${ground}<g data-stage="${stage}">${figures}</g>${stage===4?textSVG(state,W,H):''}</svg>`;
 return {svg,state,width:W,height:H,features:{...feat,generator:state.generator,layout:state.layout,format:state.format,stage,handles:handlesFor(state,scenes.values().next().value,feat.slots[0])}};}
// Editor handles: the master arm's control points in poster coordinates, with
// the total turn and scale needed to map a drag back to limb units.
function handlesFor(state,sc,slot){if(state.generator!=='limbs'||!sc||!slot)return [];return sc.handles.slice(1).map(h=>({j:h.j,x:slot.cx+(h.pos[0]-slot.c[0])*slot.k*(slot.mirror?-1:1),y:slot.cy+(h.pos[1]-slot.c[1])*slot.k,angle:h.angle,k:slot.k*U*state.params.length}));}
// Kit sheet: limb shapes, end shapes, hubs and knot types in the state's palette.
export function specimen(input={}){const state=resolve({...input,stage:3}),cell=200,cols=8,rows=[
  LIMBS.map(l=>({generator:'limbs',limb:l.id,points:undefined,params:{...state.params,arms:1,twist:0,radial:0,curl:0,rotate:-90},end:state.end==='none'?'hand':state.end,ends:'tip',mirror:'off',hub:'none',label:l.name})),
  END_SHAPES.map(e=>({generator:'limbs',limb:'straight',params:{...state.params,arms:1,twist:0,radial:0,curl:0,rotate:-90,taper:.2,weight:.22,endSize:1,sleeve:.7},end:e,ends:'tip',mirror:'off',hub:'none',label:e})),
  HUBS.map(h=>({generator:'limbs',limb:'straight',params:{...state.params,arms:6,twist:0,radial:.12,curl:0,taper:.5,weight:.14,hub:.3,rotate:0},end:'disc',ends:'tip',mirror:'off',hub:h,label:'hub '+h})),
  KNOTS.map(k=>({generator:'knot',knot:k.id,end:'hand',params:{...state.params,weight:.11,p:3,q:4,depth:.55,complexity:5,relax:30,sleeve:.6},label:k.name}))];
 let body='';rows.forEach((row,r)=>row.forEach((o,c)=>{const s=resolve({...state,...o,colour:state.colour,colors:state.colors,stage:3,layout:'hero'}),sc=figureScene(s),{k,c:cc}=fitOf(sc,{rx:cell*.42,ry:cell*.42}),d=drawFigure(s,sc,`sp${r}-${c}`,1/k);
  body+=`<g data-kit="${esc(o.label)}"><defs>${d.defs}</defs><g transform="translate(${c*cell+cell/2} ${r*(cell+24)+cell/2+10}) scale(${r3(k)}) translate(${r1(-cc[0])} ${r1(-cc[1])})">${d.body}</g><text x="${c*cell+cell/2}" y="${r*(cell+24)+cell+22}" font-family="Helvetica,Arial,sans-serif" font-size="12" text-anchor="middle" fill="${inkFor(state.colors[0])}">${esc(o.label)}</text></g>`;}));
 const w=cols*cell,h=rows.length*(cell+24)+10;return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${state.colors[0]}"/>${body}</svg>`;}
