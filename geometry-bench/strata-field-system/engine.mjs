/* Strata line fields — shape system study after Kiyoshi Awazu and Kazumasa Nagai.
 * A field is a stack of guide curves — one base curve (noise, a sine, stacked
 * waves, a ridged terrain profile or a drawn curve) displaced a little more or
 * a little differently for every guide — with tween lines interpolated between
 * neighbouring guides. Guides and lines are kept in order by a stack clamp that
 * pushes outward from a pivot, so neighbours never cross unless the fold order
 * asks for it. Five directions map the stack onto the poster: horizontal and
 * vertical (with tilt), radial rays, concentric rings, and contour levels of a
 * height field (level sets, which cannot cross). Ranges are separate offset
 * stacks under terrain profiles that occlude the field; faults translate
 * everything on one side of a seam; a horizon reflects the scene or sets the
 * ranges facing; inlays cut windows into the strata. Seeded throughout, so a
 * saved rule replays exactly. Nothing is traced from the posters.
 */
export const ENGINE='strata-field-v1';
export const W=728,H=1030;
const TAU=Math.PI*2,DELTA=.5,SIMPLIFY=.2;
export const SOURCES=[
 {id:'pgda-7951',source:'pgda',family:'awazu'},{id:'moma-4953',source:'moma',family:'kyoto'},{id:'moma-8813',source:'moma',family:'nagai'},{id:'moma-4948',source:'moma',family:'sculpture'},
 {id:'moma-190196',source:'moma',family:'contour'},{id:'moma-5853',source:'moma',family:'kizashi'},{id:'moma-4943',source:'moma'}];
// Fourteen colour roles: paper (layout), ground (behind the field), ink (outlines and lines over bands), accent (inlays), five field colours, five range colours.
export const ROLES=['Paper','Ground','Ink','Accent','Field 1','Field 2','Field 3','Field 4','Field 5','Range 1','Range 2','Range 3','Range 4','Range 5'];
export const PALETTES=[
 {id:'awazu',name:'Awazu night',colors:['#3c2a52','#10132a','#0c0c14','#f4c534','#2d5fc0','#6a3ea8','#1c8a70','#0e1838','#4799de','#e3372b','#f3832c','#f8cb38','#eb5791','#b51f26']},
 {id:'kyoto',name:'Kyoto dusk',colors:['#dcd5c7','#5f554c','#2b2622','#d4cde6','#8c8193','#5f6c63','#9c8b7b','#7c7499','#4e4947','#a47ccb','#de7fa8','#84b873','#7898db','#e8c27c']},
 {id:'nagai',name:'Nagai spectrum',colors:['#123a86','#0f2f6e','#141414','#f4e9a6','#1d5fb0','#2a9a92','#f2eca2','#f4952c','#d2241c','#1d5fb0','#2a9a92','#f2eca2','#f4952c','#d2241c']},
 {id:'sculpture',name:'Sculpture red',colors:['#1d1a22','#c9282b','#15131a','#f2d33a','#e5362d','#f08a2f','#ea618f','#f6cf3b','#a81d2b','#1c3f90','#1f8a8b','#2f6e3b','#5b3b9b','#26245e']},
 {id:'heat',name:'Contour heat',colors:['#b8302a','#b8302a','#1d1414','#f6d040','#c2378f','#e8672b','#f3b23a','#c42e2a','#73388f','#7c3a8f','#d84a8a','#f0a030','#e86a2a','#3a1a2a']},
 {id:'kizashi',name:'Kizashi sun',colors:['#1d1a1c','#cf2a22','#2a1612','#f5d33c','#f5d33c','#e8822b','#f2e3b0','#e04a7a','#b81f1f','#2a6f7a','#1f3f6e','#3f8a4a','#5a3f8a','#2a9ac8']},
 {id:'survey',name:'Survey tints',colors:['#f3eee1','#eee8d6','#6a4426','#2f74c0','#c9e0bd','#e7e2a6','#e2c591','#c49c74','#f6f2e8','#b7d3e6','#8fb8d8','#c9e0bd','#e2c591','#f6f2e8']},
 {id:'op',name:'Op black',colors:['#f4f2ec','#f4f2ec','#111111','#111111','#111111','#1c1c1c','#111111','#262626','#111111','#111111','#2a2a2a','#111111','#1c1c1c','#111111']},
 {id:'neon',name:'Neon night',colors:['#07060b','#0a0716','#f6f0ff','#ff8a1f','#ff2bd6','#19f0ff','#7a5cff','#c6ff3d','#2b6bff','#ff2bd6','#7a5cff','#19f0ff','#ff5e8a','#c6ff3d']},
 {id:'riso',name:'Riso fluoro',colors:['#f2ead8','#f2ead8','#2a2a6e','#ffe800','#ff48b0','#0078bf','#ffe800','#ff48b0','#00a95c','#00a95c','#ff48b0','#0078bf','#ff6c2f','#ffe800']},
 {id:'pen',name:'Pen on white',colors:['#fbfaf6','#fbfaf6','#1b1b1b','#d8342a','#1b1b1b','#1b1b1b','#2348a8','#1b1b1b','#1b1b1b','#1b1b1b','#2348a8','#1b1b1b','#d8342a','#1b1b1b']},
 {id:'cyan',name:'Cyanotype',colors:['#17357a','#1f4aa0','#e8f0ff','#f2f6ff','#dfe9ff','#9fc0ff','#dfe9ff','#6f9cf0','#c3d6ff','#e8f0ff','#9fc0ff','#c3d6ff','#6f9cf0','#e8f0ff']}];
const p0={lines:160,bands:12,pitchRamp:0,pitchJitter:.2,weight:1.4,weightRamp:0,index:1,wobble:.3,amplitude:.25,frequency:2,octaves:3,drift:.4,ampRamp:0,tilt:0,cx:.5,cy:.5,peaks:2,
 cycle:1,misregister:0,glow:0,faults:0,faultAngle:0,faultShift:.3,ranges:0,rangeHeight:.5,relax:.6,horizon:.5,inlaySize:.18,inlayX:.5,inlayY:.5,inlayAngle:90,inlayCount:1,seed:7};
const o0={direction:'horizontal',displace:'noise',order:'stack',colouring:'steps',render:'lines',mirror:'off',inlay:'none',inlayFill:'solid',inlayLayer:'front',layout:'full'};
const fam=(id,name,after,palette,title,info,opts,params,note,profile=[.1,.45,.3,.85,.5,.7,.2])=>({id,name,after,title,info,note,set:{...o0,...opts,palette,profile,params:{...p0,...params}}});
export const FAMILIES=[
 fam('awazu','Mountain sea','Kiyoshi Awazu, A New Spirit of Japan (1976)','awazu','MOUNTAIN SEA','Strata line fields / offset terrain over a noise sea',
  {colouring:'scatter',layout:'frame'},{lines:150,bands:10,pitchJitter:.35,weight:2.7,wobble:.6,amplitude:.05,frequency:3.5,drift:.7,ranges:5,rangeHeight:.48,relax:.55,seed:11},
  'Warm offset ranges float over a sea of cool horizontal strata; colours scatter line by line and every line trembles a little.'),
 fam('kyoto','Facing horizon','Kiyoshi Awazu, Art Today in Kyoto (1983)','kyoto','SIX ARTISTS','Strata line fields / ranges facing across a horizon',
  {colouring:'steps',mirror:'facing',inlay:'disc',layout:'frame'},{lines:190,bands:16,pitchJitter:.25,weight:1.9,wobble:.4,amplitude:.03,frequency:4,drift:.6,ranges:4,rangeHeight:.62,relax:.75,horizon:.48,inlaySize:.13,inlayX:.5,inlayY:.48,seed:5},
  'Pastel ranges rise from the bottom and hang from the top, meeting across a flat horizon with a moon on it.'),
 fam('nagai','Wave column','Kazumasa Nagai, One-Man Show at Ichibankan Gallery (1968)','nagai','WAVE COLUMN','Strata line fields / stacked waves, compressed and faulted',
  {displace:'waves',colouring:'blend',render:'both',layout:'title'},{lines:230,bands:15,pitchJitter:.15,weight:.85,wobble:0,amplitude:.27,frequency:2.1,octaves:2,drift:.7,ampRamp:.45,cycle:58,faults:2,faultAngle:3,faultShift:.28,seed:3},
  'Fine black lines over one spectrum, displaced by stacked waves; lines pile into dark bands where guides converge and step at two fault seams.'),
 fam('sculpture','Sign axis','Kiyoshi Awazu, Ninth Contemporary Japanese Sculpture (1982)','sculpture','SIGN AXIS','Strata line fields / faulted strata, an axis of signs',
  {colouring:'scatter',inlay:'eye',layout:'full'},{lines:170,bands:12,pitchJitter:.4,weight:2,wobble:.45,amplitude:.04,frequency:5,drift:.8,faults:3,faultShift:.42,ranges:2,rangeHeight:.3,relax:.3,inlaySize:.12,inlayX:.58,inlayY:.08,inlayCount:4,seed:9},
  'Red strata broken by stepped faults, cool ranges crossing below and a vertical axis of inlaid signs — eye, pillar, diamond, disc.'),
 fam('contour','Contour map','Kiyoshi Awazu, Contemporary Japanese Art (1983)','heat','CONTOUR MAP','Strata line fields / levels of a two-peak height field',
  {direction:'contour',render:'both',layout:'full'},{lines:58,bands:8,pitchJitter:.3,weight:1.5,index:1.8,wobble:.5,amplitude:.28,frequency:1.6,octaves:3,drift:.55,cx:.36,cy:.3,peaks:2,seed:4},
  'Contour levels of a two-peak height field with noise; filled bands in heat colours, outlined in ink.'),
 fam('kizashi','Sunrise rays','Kiyoshi Awazu, Exhibition Poster, Kizashi (1975)','kizashi','SUNRISE','Strata line fields / rays, ranges and an eye',
  {direction:'radial',colouring:'scatter',render:'bands',inlay:'eye',layout:'frame'},{lines:120,bands:24,pitchJitter:.5,weight:1,wobble:.2,amplitude:.06,frequency:2,drift:.5,cx:.5,cy:.52,ranges:3,rangeHeight:.4,relax:.45,inlaySize:.34,inlayX:.5,inlayY:.52,seed:6},
  'Coloured wedges fan out from an eye on the horizon; cool ranges roll in across the lower half.'),
 fam('topo','Survey sheet','new — topographic map','survey','SURVEY SHEET','Strata line fields / index contours over hypsometric tints',
  {direction:'contour',colouring:'blend',render:'both',layout:'frame'},{lines:105,bands:21,pitchJitter:0,weight:.6,index:2.8,wobble:.3,amplitude:.42,frequency:2.2,octaves:5,drift:.6,cx:.6,cy:.4,peaks:3,cycle:22,seed:12},
  'Thin brown contours with a heavier index line every fifth level, over tints that climb from green to pale summits.'),
 fam('moire','Op moiré','new — op art','op','INTERFERENCE','Strata line fields / a field laid over itself, slightly turned',
  {displace:'sine',inlay:'disc',inlayFill:'overlay',layout:'full'},{lines:200,bands:10,pitchJitter:0,weight:2.5,wobble:0,amplitude:.035,frequency:2.5,drift:.3,inlaySize:.66,inlayX:.5,inlayY:.55,inlayAngle:8,seed:2},
  'Black lines on white with the same field laid over itself in a disc, turned by a few degrees, so the two gratings beat into moiré fringes.'),
 fam('neon','Neon terrain','new — electro','neon','NEON TERRAIN','Strata line fields / ridged terrain mirrored in a black lake',
  {displace:'terrain',colouring:'blend',mirror:'reflect',inlay:'sun',inlayLayer:'behind',layout:'title'},{lines:120,bands:12,pitchRamp:-.75,pitchJitter:0,weight:1.3,wobble:0,amplitude:.16,frequency:2.4,octaves:4,drift:.25,ampRamp:-.6,cycle:9,glow:.55,ranges:2,rangeHeight:.6,relax:.5,horizon:.6,inlaySize:.42,inlayX:.5,inlayY:.33,seed:8},
  'Glowing magenta and cyan terrain lines on near-black, a slotted sun behind two ranges, everything reflected below the horizon.'),
 fam('riso','Riso bands','new — risograph','riso','RISO BANDS','Strata line fields / vertical waves in fluorescent overprint',
  {direction:'vertical',displace:'waves',render:'bands',inlay:'ring',inlayFill:'rings',layout:'split'},{lines:70,bands:7,pitchJitter:.2,weight:2,wobble:.2,amplitude:.12,frequency:1.6,octaves:2,drift:.5,cycle:5,misregister:4,inlaySize:.34,inlayX:.66,inlayY:.42,seed:14},
  'Broad fluorescent bands on cream, each colour layer printed slightly off register; the lower half turns the field a quarter turn.'),
 fam('plotter','Pen rings','new — pen plotter','pen','PEN RINGS','Strata line fields / concentric waves for a single pen',
  {direction:'concentric',displace:'waves',layout:'diptych'},{lines:95,bands:19,pitchJitter:.2,weight:.8,index:1.6,wobble:.25,amplitude:.16,frequency:3,octaves:2,drift:.4,cx:.82,cy:.42,seed:21},
  'Single-pen concentric rings rippled by stacked waves, book-matched into a diptych like a sliced stone.')];
export const CONTROLS=[
 {key:'lines',label:'Line count',group:'strata',min:16,max:360,step:1},
 {key:'bands',label:'Guides',group:'strata',min:1,max:24,step:1},
 {key:'pitchRamp',label:'Pitch ramp',group:'strata',min:-.9,max:.9,step:.01},
 {key:'pitchJitter',label:'Pitch jitter',group:'strata',min:0,max:1,step:.01},
 {key:'weight',label:'Line weight',group:'strata',min:.2,max:6,step:.05},
 {key:'weightRamp',label:'Weight ramp',group:'strata',min:-1,max:1,step:.01,needs:{render:['lines','both']}},
 {key:'index',label:'Guide weight',group:'strata',min:1,max:4,step:.05,needs:{render:['lines','both']}},
 {key:'wobble',label:'Wobble',group:'strata',min:0,max:1,step:.01},
 {key:'seed',label:'Seed',group:'strata',min:1,max:999,step:1},
 {key:'amplitude',label:'Amplitude',group:'displace',min:0,max:1,step:.005},
 {key:'frequency',label:'Frequency',group:'displace',min:.25,max:12,step:.05},
 {key:'octaves',label:'Octaves',group:'displace',min:1,max:6,step:1,needs:{displace:['noise','waves','terrain']}},
 {key:'drift',label:'Drift',group:'displace',min:0,max:1,step:.01},
 {key:'ampRamp',label:'Amplitude ramp',group:'displace',min:-1,max:1,step:.01},
 {key:'tilt',label:'Tilt',group:'displace',min:-45,max:45,step:1,needs:{direction:['horizontal','vertical']}},
 {key:'cx',label:'Centre across',group:'displace',min:0,max:1,step:.01,needs:{direction:['radial','concentric','contour']}},
 {key:'cy',label:'Centre down',group:'displace',min:0,max:1,step:.01,needs:{direction:['radial','concentric','contour']}},
 {key:'peaks',label:'Peaks',group:'displace',min:1,max:4,step:1,needs:{direction:['contour']}},
 {key:'cycle',label:'Cycle length',group:'colour',min:1,max:80,step:1},
 {key:'misregister',label:'Misregister',group:'colour',min:0,max:10,step:.1},
 {key:'glow',label:'Glow',group:'colour',min:0,max:1,step:.01,needs:{render:['lines','both']}},
 {key:'faults',label:'Faults',group:'faults',min:0,max:6,step:1},
 {key:'faultAngle',label:'Fault angle',group:'faults',min:-60,max:60,step:1,needs:{faults:true}},
 {key:'faultShift',label:'Fault shift',group:'faults',min:-1,max:1,step:.01,needs:{faults:true}},
 {key:'ranges',label:'Ranges',group:'horizon',min:0,max:6,step:1},
 {key:'rangeHeight',label:'Range height',group:'horizon',min:0,max:1,step:.01,needs:{ranges:true}},
 {key:'relax',label:'Relax',group:'horizon',min:0,max:1,step:.01,needs:{ranges:true}},
 {key:'horizon',label:'Horizon',group:'horizon',min:.15,max:.85,step:.01,needs:{mirror:true}},
 {key:'inlaySize',label:'Inlay size',group:'inlay',min:.04,max:.7,step:.01,needs:{inlay:true}},
 {key:'inlayX',label:'Inlay across',group:'inlay',min:0,max:1,step:.01,needs:{inlay:true}},
 {key:'inlayY',label:'Inlay down',group:'inlay',min:0,max:1,step:.01,needs:{inlay:true}},
 {key:'inlayAngle',label:'Inlay line angle',group:'inlay',min:0,max:180,step:1,needs:{inlay:true,inlayFill:['strata','overlay']}},
 {key:'inlayCount',label:'Inlay count',group:'inlay',min:1,max:5,step:1,needs:{inlay:true}}];
export const OPTIONS={direction:['horizontal','vertical','radial','concentric','contour'],displace:['noise','sine','waves','terrain','drawn'],order:['stack','fold'],colouring:['steps','blend','scatter'],render:['lines','bands','both'],
 mirror:['off','reflect','facing'],inlay:['none','disc','ring','sun','eye','diamond','slot','window'],inlayFill:['solid','strata','overlay','rings','void'],inlayLayer:['front','behind'],layout:['full','title','frame','diptych','split'],palette:PALETTES.map(p=>p.id)};
export const OPTION_NEEDS={order:{direction:['horizontal','vertical','radial','concentric']},inlayFill:{inlay:true},inlayLayer:{inlay:true}};
// Whether a control or option applies to a state (the editor disables the rest).
export function active(needs,state){if(!needs)return true;return Object.entries(needs).every(([k,v])=>Array.isArray(v)?v.includes(state[k]):k in state.params?state.params[k]>0:state[k]!=='off'&&state[k]!=='none');}
export const LABELS={direction:{horizontal:'Horizontal',vertical:'Vertical',radial:'Radial rays',concentric:'Concentric rings',contour:'Contour levels'},displace:{noise:'Noise',sine:'Sine',waves:'Stacked waves',terrain:'Terrain profile',drawn:'Drawn curve'},
 order:{stack:'Stack (never cross)',fold:'Fold (may cross)'},colouring:{steps:'Steps',blend:'Blend',scatter:'Scatter'},render:{lines:'Stroked lines',bands:'Filled bands',both:'Bands and lines'},mirror:{off:'Off',reflect:'Reflect below the horizon',facing:'Ranges facing'},
 inlay:{none:'None',disc:'Disc',ring:'Ring',sun:'Slotted sun',eye:'Eye',diamond:'Diamond',slot:'Pillar',window:'Window'},inlayFill:{solid:'Solid',strata:'Second field',overlay:'Overlay (moiré)',rings:'Rings',void:'Void'},inlayLayer:{front:'In front',behind:'Behind ranges'},
 layout:{full:'Full field',title:'Title band',frame:'Framed window',diptych:'Diptych (book-matched)',split:'Split (turned half)'},palette:Object.fromEntries(PALETTES.map(p=>[p.id,p.name]))};

// ── Small helpers ─────────────────────────────────────────────────────────
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},mod=(a,b)=>((a%b)+b)%b,pingpong=x=>1-Math.abs(mod(x,2)-1);
export const hashOf=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const rng=seed=>{let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};};
// Seeded 3D gradient noise (improved Perlin), cached per key.
const NOISE=new Map();
function noiseFor(key){const seed=hashOf(key);if(NOISE.has(seed))return NOISE.get(seed);const r=rng(seed),a=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}const P=new Uint8Array(512);for(let i=0;i<512;i++)P[i]=a[i&255];
 const g=(h,x,y,z)=>{h&=15;const u=h<8?x:y,v=h<4?y:h===12||h===14?x:z;return ((h&1)?-u:u)+((h&2)?-v:v);},f=t=>t*t*t*(t*(t*6-15)+10);
 const n=(x,y,z)=>{const fx=Math.floor(x),fy=Math.floor(y),fz=Math.floor(z),X=fx&255,Y=fy&255,Z=fz&255;x-=fx;y-=fy;z-=fz;const u=f(x),v=f(y),w=f(z),A=P[X]+Y,AA=P[A]+Z,AB=P[A+1]+Z,B=P[X+1]+Y,BA=P[B]+Z,BB=P[B+1]+Z;
  return lerp(lerp(lerp(g(P[AA],x,y,z),g(P[BA],x-1,y,z),u),lerp(g(P[AB],x,y-1,z),g(P[BB],x-1,y-1,z),u),v),lerp(lerp(g(P[AA+1],x,y,z-1),g(P[BA+1],x-1,y,z-1),u),lerp(g(P[AB+1],x,y-1,z-1),g(P[BB+1],x-1,y-1,z-1),u),v),w);};
 if(NOISE.size>96)NOISE.clear();NOISE.set(seed,n);return n;}
// Catmull–Rom through evenly spaced heights, clamped to 0–1.
function catmull(pts,t){const n=pts.length-1,x=clamp(t,0,1)*n,i=Math.min(n-1,Math.floor(x)),u=x-i,p=k=>pts[clamp(k,0,n)],a=p(i-1),b=p(i),c=p(i+1),d=p(i+2);
 return clamp(.5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u),0,1);}
// The drawn curve: 2–16 heights from 0 (low) to 1 (high).
export function normalizeProfile(v){const list=Array.isArray(v)?v:typeof v==='string'?v.trim().split(/[\s,;]+/).filter(Boolean):null;if(!list)throw new Error('Type 2–16 heights between 0 and 1.');
 const nums=list.map(Number);if(nums.length<2||nums.length>16)throw new Error('Use 2 to 16 heights.');if(nums.some(x=>!Number.isFinite(x)))throw new Error('Heights are numbers between 0 and 1.');return nums.map(x=>Math.round(clamp(x,0,1)*1000)/1000);}

// ── Colour ────────────────────────────────────────────────────────────────
const toLin=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4,toGam=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
function oklab(hex){const [r,g,b]=[1,3,5].map(i=>toLin(parseInt(hex.slice(i,i+2),16)/255)),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
function fromLab([L,a,b]){const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 return '#'+[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>Math.round(clamp(toGam(clamp(v,0,1)),0,1)*255).toString(16).padStart(2,'0')).join('');}
const mix=(a,b,t)=>{const A=oklab(a),B=oklab(b);return fromLab(A.map((v,i)=>lerp(v,B[i],t)));};
const lum=h=>{const [r,g,b]=[1,3,5].map(i=>toLin(parseInt(h.slice(i,i+2),16)/255));return .2126*r+.7152*g+.0722*b;};
export const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
export const inkFor=g=>lum(g)>.2?'#141414':'#f6f2ea';
// Line colour: one of five colours per step of `cycle` lines — in order (steps),
// blended in OKLab and swept back and forth (blend), or picked at random without
// repeating (scatter).
function cycler(state,set,key){const c=state.colors,list=set==='F'?c.slice(4,9):c.slice(9,14),L=state.params.cycle,r=rng(hashOf(key+':scatter')),picks=[0],memo=new Map();
 for(let i=1;i<1200;i++)picks.push((picks[i-1]+1+Math.floor(r()*4))%5);
 return i=>{const q=Math.floor(i/L);if(state.colouring==='steps')return list[mod(q,5)];if(state.colouring==='scatter')return list[picks[mod(q,1200)]];
  const x=mod(i/L,8),pos=x<=4?x:8-x,k=Math.min(3,Math.floor(pos)),t=Math.round((pos-k)*12)/12,id=k*13+t*12;if(!memo.has(id))memo.set(id,mix(list[k],list[k+1],t));return memo.get(id);};}

// ── Base curves ───────────────────────────────────────────────────────────
// A displacement shape as a function of the position s along a line (0–1, or a
// turn fraction when periodic) and a guide coordinate z. About −1…1; negative
// values rise, so terrain peaks point up.
function shaper(state,key){const p=state.params,n=noiseFor(key),r=rng(hashOf(key+':phase')),ph=Array.from({length:8},()=>r()*TAU),oy=r()*40+.37,oz=r()*40+.53,f=p.frequency,oct=p.octaves,prof=state.profile;
 return (s,z,periodic)=>{const X=periodic?Math.cos(s*TAU)*f*.32:s*f,Y=(periodic?Math.sin(s*TAU)*f*.32:0)+oy,Z=z+oz,k=v=>periodic?Math.max(1,Math.round(v)):v;
  switch(state.displace){
   case 'sine':return Math.sin(TAU*k(f)*s+ph[0]+z*.6);
   case 'waves':{let v=0,t=0,a=1;for(let o=0;o<oct;o++){v+=a*Math.sin(TAU*k(f*(1+.83*o))*s+ph[o]+z*(.45+.3*o));t+=a;a*=.62;}return 1.15*v/t;}
   case 'terrain':{let v=0,t=0,a=1;for(let o=0;o<oct;o++){const q=1-Math.abs(n(X*2**o,Y+o*1.7,Z*2**o+o*5.1)*1.6);v+=a*q*q;t+=a;a*=.5;}return 1.3-2.5*v/t;}
   case 'drawn':return 1-2*catmull(prof,pingpong(s*Math.max(.25,f)))+.35*n(X*2.3,Y,Z);
   default:{let v=0,t=0,a=1;for(let o=0;o<oct;o++){v+=a*n(X*2**o,Y+o*3.1,Z*2**o+o*7.3);t+=a;a*=.5;}return 1.8*v/t;}}};}

// ── Frames ────────────────────────────────────────────────────────────────
// A frame maps field coordinates (u along a line, v across the stack) to the
// poster: map(u,v) → [x,y]; ev(u,v) is the unit direction of growing v and
// vs(u) the poster length of one v unit.
function frameFor(dir,rect,beta,cx,cy,N){const [x0,y0,x1,y1]=rect,corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
 if(dir==='radial'||dir==='concentric'){const C=[x0+(x1-x0)*cx,y0+(y1-y0)*cy],R=Math.max(...corners.map(q=>Math.hypot(q[0]-C[0],q[1]-C[1])))+6;
  if(dir==='radial'){const rIn=Math.max(10,N*DELTA*1.3/Math.PI),us=[];for(let r=rIn;r<R;r+=3.5)us.push(r);us.push(R);
   return {kind:'radial',C,R,rIn,us,s:u=>(u-rIn)/(R-rIn),map:(u,v)=>[C[0]+u*Math.cos(v),C[1]+u*Math.sin(v)],ev:(u,v)=>[-Math.sin(v),Math.cos(v)],vs:u=>u,len:R};}
  const n=clamp(Math.ceil(TAU*R/4.5),96,1500),us=Array.from({length:n+1},(_,i)=>i/n*TAU);
  return {kind:'concentric',C,R,us,s:u=>u/TAU,map:(u,v)=>[C[0]+v*Math.cos(u),C[1]+v*Math.sin(u)],ev:u=>[Math.cos(u),Math.sin(u)],vs:()=>1,len:R,periodic:true};}
 const mx=(x0+x1)/2,my=(y0+y1)/2,c=Math.cos(beta),s=Math.sin(beta),q=corners.map(([x,y])=>[(x-mx)*c+(y-my)*s,-(x-mx)*s+(y-my)*c]),u0=Math.min(...q.map(a=>a[0]))-6,u1=Math.max(...q.map(a=>a[0]))+6,us=[];
 for(let u=u0;u<u1;u+=3.5)us.push(u);us.push(u1);
 return {kind:'linear',us,u0,u1,v0:Math.min(...q.map(a=>a[1])),v1:Math.max(...q.map(a=>a[1])),s:u=>(u-u0)/(u1-u0),map:(u,v)=>[mx+u*c-v*s,my+u*s+v*c],ev:()=>[-s,c],eu:[c,s],vs:()=>1,len:u1-u0,centre:[mx,my]};}
// Push values outward from a pivot so neighbours keep at least `gap` apart.
function stackClamp(v,gap,pivot){for(let i=pivot+1;i<v.length;i++)if(v[i]<v[i-1]+gap)v[i]=v[i-1]+gap;for(let i=pivot-1;i>=0;i--)if(v[i]>v[i+1]-gap)v[i]=v[i+1]-gap;}
// Douglas–Peucker on a graph v(u): keeps the points needed so that the
// simplified line stays within tol(i) of every sample, measured along v.
function simplifyGraph(us,vs,tol){const n=us.length,keep=new Uint8Array(n);keep[0]=keep[n-1]=1;const stack=[[0,n-1]];
 while(stack.length){const [a,b]=stack.pop();if(b-a<2)continue;let worst=1,wi=-1;const du=us[b]-us[a],dv=vs[b]-vs[a];
  for(let i=a+1;i<b;i++){const d=Math.abs(vs[i]-(vs[a]+dv*(us[i]-us[a])/du))/tol(i);if(d>worst){worst=d;wi=i;}}if(wi>0){keep[wi]=1;stack.push([a,wi],[wi,b]);}}
 const idx=[];for(let i=0;i<n;i++)if(keep[i])idx.push(i);return idx;}
// Douglas–Peucker on a closed poster-space loop, with a tolerance per point;
// points flagged in `keep` (where a loop crosses the field edge) always stay.
function simplifyLoop(pts,tolAt,keepAt){const n=pts.length;if(n<8)return pts;const tols=pts.map(tolAt),keep=new Uint8Array(n);let far=0,fd=-1;for(let i=1;i<n;i++){const d=(pts[i][0]-pts[0][0])**2+(pts[i][1]-pts[0][1])**2;if(d>fd){fd=d;far=i;}}
 keep[0]=keep[far]=1;if(keepAt)for(let i=0;i<n;i++)if(keepAt(i))keep[i]=1;const anchors=[];for(let i=0;i<n;i++)if(keep[i])anchors.push(i);anchors.push(n);
 const stack=anchors.slice(1).map((b,k)=>[anchors[k],b]);while(stack.length){const [i0,i1]=stack.pop();if(i1-i0<2)continue;const [ax,ay]=pts[i0],[bx,by]=pts[i1%n],dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1e-9;let worst=1,wi=-1;
  for(let i=i0+1;i<i1;i++){const d=Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/L/tols[i];if(d>worst){worst=d;wi=i;}}if(wi>0){keep[wi]=1;stack.push([i0,wi],[wi,i1]);}}
 return pts.filter((_,i)=>keep[i]);}

// ── Faults ────────────────────────────────────────────────────────────────
// Seams in poster space. Everything on the + side of a seam moves by s along
// the seam's direction d (a step for lines that cross it).
function faultsFor(state,rect,key,lineDir){const p=state.params,F=p.faults;if(!F)return [];const [x0,y0,x1,y1]=rect,r=rng(hashOf(key+':faults')),a=p.faultAngle*Math.PI/180;
 const base=lineDir??[1,0],d0=[-base[1],base[0]],d=[d0[0]*Math.cos(a)-d0[1]*Math.sin(a),d0[0]*Math.sin(a)+d0[1]*Math.cos(a)],C=[(x0+x1)/2,(y0+y1)/2],span=Math.abs(base[0])*(x1-x0)+Math.abs(base[1])*(y1-y0),out=[];
 for(let k=0;k<F;k++){const t=(k+.5+(r()-.5)*.55)/F-.5,P=[C[0]+base[0]*span*t,C[1]+base[1]*span*t],s=p.faultShift*120*(k%2?-.7:1)*(.75+.5*r());out.push({P,d,n:[d[1],-d[0]],s});}
 return out;}
const faultAt=(faults,x,y)=>{let dx=0,dy=0;for(const f of faults){const t=smooth(.5+((x-f.P[0])*f.n[0]+(y-f.P[1])*f.n[1])/3);dx+=f.s*t*f.d[0];dy+=f.s*t*f.d[1];}return [dx,dy];};

// ── Graph fields: horizontal, vertical, radial, concentric ────────────────
// Guides are base curves displaced per guide; tween lines are interpolated
// between neighbouring guides; faults then move each line point; a final
// stack clamp keeps every neighbour at least DELTA apart (stack order).
function graphField(state,rect,o){const p=state.params,N=o.lines,B=Math.min(p.bands,N),m=Math.max(1,Math.round(N/B)),fr=frameFor(o.dir,rect,o.beta??0,p.cx,p.cy,N),r=rng(hashOf(o.key+':stack')),shape=shaper(state,o.key),wob=noiseFor(o.key+':wobble'),fold=state.order==='fold';
 const Apx=p.amplitude*300*(o.amp??1),shiftPad=p.faults?Math.abs(p.faultShift)*120:0,us=fr.us,nu=us.length,S=us.map(fr.s),periodic=!!fr.periodic;let vA,vB,Gt,visible;
 if(fr.kind==='radial'){vA=r()*TAU;vB=vA+TAU;Gt=B;visible=[vA,vB];}
 else if(fr.kind==='concentric'){const span=fr.R,pad=Math.min(Apx+shiftPad,span*.5);vA=span/N*.8;vB=fr.R+pad;Gt=Math.max(1,Math.ceil(B*(vB-vA)/span));visible=[vA,fr.R];}
 else{const span=fr.v1-fr.v0,pad=Math.min(Apx*(1+Math.abs(p.ampRamp))*1.2+shiftPad+12,span*.9);vA=fr.v0-pad;vB=fr.v1+pad;Gt=Math.max(1,Math.ceil(B*(vB-vA)/span));visible=[fr.v0,fr.v1];}
 // Guide bases: spacing ramps for perspective and jitters per guide.
 const wts=Array.from({length:Gt},(_,k)=>Math.exp(p.pitchRamp*2.2*((k+.5)/Gt-.5)*2)*Math.max(.15,1+p.pitchJitter*(r()-.5)*1.7)),tot=wts.reduce((a,b)=>a+b,0),base=[vA];
 for(let k=0;k<Gt;k++)base.push(base[k]+wts[k]/tot*(vB-vA));
 // Guide curves, as arrays over the u samples.
 const unit=fr.kind==='radial'?.5*fr.R:1,swing=state.displace==='noise'||state.displace==='terrain'?0:p.drift*.9,sp=r()*TAU,guides=base.map((b,k)=>{const kk=fr.kind==='radial'?k%Gt:k,z=kk*p.drift*.45,ramp=t=>Math.max(0,1+p.ampRamp*(2*t-1)),af=1+swing*Math.sin(kk*2.399+sp),out=new Float64Array(nu);
  // Drift decorrelates noise guides; periodic shapes swing their amplitude guide by guide, so neighbours converge into dark bands.
  for(let i=0;i<nu;i++){const A=af*Apx*(fr.kind==='radial'?ramp(S[i]):ramp(k/Gt));let d=A*shape(S[i],z,periodic)/unit;if(fr.kind==='concentric')d*=.9*b*b/(b*b+A*A+1);out[i]=b+d;}return out;});
 if(fr.kind==='radial')guides[Gt]=guides[0].map(v=>v+TAU);
 if(!fold)for(let i=0;i<nu;i++){const col=guides.map(g=>g[i]),gap=m*DELTA/fr.vs(us[i]);if(fr.kind==='radial'){stackClamp(col,gap,0);for(let k=Gt-1;k>0;k--)if(col[k]>col[k+1]-gap)col[k]=col[k+1]-gap;}else stackClamp(col,gap,fr.kind==='concentric'?0:Math.floor(Gt/2));guides.forEach((g,k)=>g[i]=col[k]);}
 // Tween lines with wobble on the tween parameter (never on position).
 const lines=[],count=fr.kind==='radial'?Gt*m:Gt*m+1,wf=fr.len/34;
 for(let L=0;L<count;L++){const k=Math.min(Gt-1,Math.floor(L/m)),j=L-k*m,g0=guides[k],g1=guides[Math.min(Gt,k+1)],v=new Float64Array(nu),bv=lerp(base[k],base[Math.min(Gt,k+1)],j/m);
  for(let i=0;i<nu;i++){let t=j/m;if(j&&p.wobble){const s=S[i],X=periodic?Math.cos(s*TAU)*bv/34:s*wf,Y=periodic?Math.sin(s*TAU)*bv/34:L*.71;t+=p.wobble*.42*wob(X,Y+L*.37,L*.13)/m;}v[i]=k===Gt?g0[i]:lerp(g0[i],g1[i],t);}
  lines.push({index:L,k,j,guide:j===0,base:bv,v});}
 // Faults move every line point in poster space; only the across-line part matters for a graph.
 if(o.faults.length)for(const ln of lines)for(let i=0;i<nu;i++){const [x,y]=fr.map(us[i],ln.v[i]),[dx,dy]=faultAt(o.faults,x,y);if(dx||dy){const e=fr.ev(us[i],ln.v[i]);ln.v[i]+=(dx*e[0]+dy*e[1])/fr.vs(us[i]);}}
 if(!fold)for(let i=0;i<nu;i++){const col=lines.map(l=>l.v[i]),gap=DELTA/fr.vs(us[i]);
  if(fr.kind==='radial'){stackClamp(col,gap,0);const wrap=col[0]+TAU;for(let k=col.length-1;k>0;k--){const next=k===col.length-1?wrap:col[k+1];if(col[k]>next-gap)col[k]=next-gap;}}else stackClamp(col,gap,fr.kind==='concentric'?0:Math.floor(col.length/2));
  if(fr.kind==='concentric')for(let k=0;k<col.length;k++)col[k]=Math.max(col[k],.6+k*gap);lines.forEach((l,k)=>l.v[i]=col[k]);}
 // Simplify each line along v and map it to the poster.
 // Rings close at angle 0; a finer tolerance there keeps their corners from lining up into a visible seam.
 const tol=fr.kind==='radial'?i=>SIMPLIFY/us[i]:periodic?i=>SIMPLIFY*Math.max(.12,Math.min(1,Math.min(us[i],TAU-us[i])/.2)):()=>SIMPLIFY;let top=0;
 for(const ln of lines){const idx=simplifyGraph(us,ln.v,tol);ln.uv=idx.map(i=>[us[i],ln.v[i]]);ln.pts=ln.uv.map(([u,v])=>fr.map(u,v));ln.closed=periodic;delete ln.v;if(ln.base<visible[0])top=ln.index+1;}
 return {kind:fr.kind,frame:fr,lines,m,guides:Gt,top,visibleCount:lines.filter(l=>l.base>=visible[0]&&l.base<=visible[1]).length};}

// ── Contour field: level sets of a height field ───────────────────────────
function heightFn(state,rect,o){const p=state.params,[x0,y0,x1,y1]=rect,w=x1-x0,hh=y1-y0,diag=Math.hypot(w,hh),r=rng(hashOf(o.key+':peaks')),n=noiseFor(o.key),nw=noiseFor(o.key+':warp'),nf=noiseFor(o.key+':fine');
 const lam=w/Math.max(.25,p.frequency),A=p.amplitude*.8,ph=Array.from({length:6},()=>r()*TAU),peaks=[];
 for(let k=0;k<p.peaks;k++)peaks.push({x:k?x0+w*(.12+.76*r()):x0+w*p.cx,y:k?y0+hh*(.1+.8*r()):y0+hh*p.cy,a:k?.7+.3*r():1,R:diag*(k?.38+.3*r():.6)});
 const lobing=state.displace==='sine'||state.displace==='waves',lobes=t=>{if(state.displace==='sine')return Math.sin(Math.max(1,Math.round(p.frequency))*t+ph[0]);if(state.displace!=='waves')return 0;let v=0,s=0,a=1;for(let q=0;q<p.octaves;q++){v+=a*Math.sin(Math.max(1,Math.round(p.frequency*(1+.83*q)))*t+ph[q]);s+=a;a*=.62;}return v/s;};
 return (x,y)=>{if(o.faults.length){let sx=0,sy=0;for(const f of o.faults){const t=smooth(.5+((x-f.P[0])*f.n[0]+(y-f.P[1])*f.n[1])/3);sx+=f.s*t*f.d[0];sy+=f.s*t*f.d[1];}x-=sx;y-=sy;}
  const amp=A*Math.max(0,1+p.ampRamp*(2*(y-y0)/hh-1)),wx=x+p.drift*lam*.3*nw(x/lam,y/lam,1.3),wy=y+p.drift*lam*.3*nw(x/lam+31.7,y/lam,4.1);let sum=0;
  for(const q of peaks){const ex=wx-q.x,ey=wy-q.y;let d=Math.sqrt(ex*ex+ey*ey)/q.R;if(lobing)d*=1+amp*.45*lobes(Math.atan2(ey,ex));const c=state.displace==='drawn'?q.a*catmull(state.profile,clamp(1-d,0,1)):q.a*(1-d);sum+=Math.exp(c*7);}
  let h=Math.log(sum)/7,X=wx/lam,Y=wy/lam;
  if(state.displace==='noise'||state.displace==='drawn'){let v=0,s=0,a=1;for(let q=0;q<p.octaves;q++){v+=a*n(X*2**q,Y*2**q,q*7.7+.5);s+=a;a*=.5;}h+=amp*(state.displace==='drawn'?.3:1)*1.4*v/s;}
  else if(state.displace==='terrain'){let v=0,s=0,a=1;for(let q=0;q<p.octaves;q++){const t=1-Math.abs(n(X*2**q,Y*2**q,q*5.3+.5)*1.6);v+=a*t*t;s+=a;a*=.5;}h+=amp*(v/s-.5)*1.4;}
  return h+p.wobble*.02*nf(x/7,y/7,.37);};}
function contourField(state,rect,o){const p=state.params,[x0,y0,x1,y1]=rect,g=3.2,nx=Math.ceil((x1-x0)/g)+5,ny=Math.ceil((y1-y0)/g)+5,ox=x0-2*g,oy=y0-2*g,h=new Float64Array(nx*ny),fn=heightFn(state,rect,o);let lo=Infinity,hi=-Infinity;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=ox+i*g,y=oy+j*g,edge=!i||!j||i===nx-1||j===ny-1,v=edge?0:fn(x,y);h[j*nx+i]=v;if(!edge&&x>=x0-g&&x<=x1+g&&y>=y0-g&&y<=y1+g){if(v<lo)lo=v;if(v>hi)hi=v;}}
 // The border ring sits just below every level, so all loops close and levels stay apart along it.
 {const floor=lo-(hi-lo)*.25-1e-6;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(!i||!j||i===nx-1||j===ny-1)h[j*nx+i]=Math.min(floor,...[h[j*nx+i]]);for(let q=0;q<nx*ny;q++)if(h[q]<floor)h[q]=floor;}
 // Levels: guide levels (ramped, jittered), tween levels between them.
 const N=o.lines,B=Math.min(p.bands,N),m=Math.max(1,Math.round(N/B)),r=rng(hashOf(o.key+':levels')),span=hi-lo,a=lo+span*.004,b=hi-span*.004,wts=Array.from({length:B},(_,k)=>Math.exp(p.pitchRamp*2.2*((k+.5)/B-.5)*2)*Math.max(.15,1+p.pitchJitter*(r()-.5)*1.7)),tot=wts.reduce((s,v)=>s+v,0),gl=[a];
 for(let k=0;k<B;k++)gl.push(gl[k]+wts[k]/tot*(b-a));const levels=[];for(let k=0;k<B;k++)for(let j=0;j<m;j++)levels.push({L:lerp(gl[k],gl[k+1],j/m),guide:!j,k,j});levels.push({L:gl[B],guide:true,k:B,j:0});
 // Marching squares, all levels in one pass; every edge crossing is keyed by its grid edge.
 const segs=levels.map(()=>[]),Ls=levels.map(l=>l.L);
 for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const q=j*nx+i,A=h[q],Bv=h[q+1],C=h[q+nx+1],D=h[q+nx],mn=Math.min(A,Bv,C,D),mx=Math.max(A,Bv,C,D);if(mx<=Ls[0]||mn>Ls[Ls.length-1])continue;
  let lo2=0,hi2=Ls.length;while(lo2<hi2){const md=(lo2+hi2)>>1;if(Ls[md]<mn)lo2=md+1;else hi2=md;}
  const T=q*2,R=(q+1)*2+1,Bo=(q+nx)*2,Le=q*2+1;
  for(let l=lo2;l<Ls.length&&Ls[l]<mx;l++){const L=Ls[l],c=(A>L?8:0)|(Bv>L?4:0)|(C>L?2:0)|(D>L?1:0),S=segs[l];
   switch(c){case 1:case 14:S.push(Le,Bo);break;case 2:case 13:S.push(Bo,R);break;case 3:case 12:S.push(Le,R);break;case 4:case 11:S.push(T,R);break;case 6:case 9:S.push(T,Bo);break;case 7:case 8:S.push(T,Le);break;
    case 5:if((A+Bv+C+D)/4>L)S.push(T,Le,R,Bo);else S.push(T,R,Le,Bo);break;case 10:if((A+Bv+C+D)/4>L)S.push(T,R,Le,Bo);else S.push(T,Le,R,Bo);break;}}}
 const at=(key,L)=>{const q=key>>1,i=q%nx,j=(q-i)/nx,h0=h[q],h1=key&1?h[q+nx]:h[q+1],t=clamp((L-h0)/(h1-h0),0,1);return key&1?[ox+i*g,oy+(j+t)*g]:[ox+(i+t)*g,oy+j*g];};
 // Inside, simplify within a quarter of the distance to the neighbouring levels (level gap over the steepest nearby slope);
 // outside the field (where loops only run to close) a loose 1.5 px will do; the edge crossings themselves are kept exactly.
 const inside=([x,y])=>x>=x0&&x<=x1&&y>=y0&&y<=y1,tolFor=l=>{const gap=Math.min(l?Ls[l]-Ls[l-1]:Infinity,l<Ls.length-1?Ls[l+1]-Ls[l]:Infinity);return p=>{if(!inside(p))return 1.5;const i0=clamp(Math.round((p[0]-ox)/g),2,nx-3),j0=clamp(Math.round((p[1]-oy)/g),2,ny-3);let sl=0;for(let j=j0-1;j<=j0+1;j++)for(let i=i0-1;i<=i0+1;i++){const q=j*nx+i,gx=(h[q+1]-h[q-1])/(2*g),gy=(h[q+nx]-h[q-nx])/(2*g);sl=Math.max(sl,Math.sqrt(gx*gx+gy*gy),Math.abs(h[q+1]-h[q])/g,Math.abs(h[q+nx]-h[q])/g);}return Math.max(.005,Math.min(.25,sl>0?.25*gap/sl:.25));};};
 // Chain segments into loops. Every crossing has exactly two neighbours (the border ring sits below every level, so all loops close).
 const size=nx*ny*2,nb0=new Int32Array(size),nb1=new Int32Array(size),stamp=new Int32Array(size),seen=new Int32Array(size);
 const lines=levels.map((lv,l)=>{const S=segs[l],loops=[],tag=l+1;for(let s=0;s<S.length;s++){const a2=S[s],b2=S[s^1];if(stamp[a2]!==tag){stamp[a2]=tag;nb0[a2]=b2;nb1[a2]=-1;}else nb1[a2]=b2;}
  for(let s=0;s<S.length;s+=2){const start=S[s];if(seen[start]===tag)continue;const keys=[start];seen[start]=tag;let prev=-1,cur=start;
   for(;;){const next=nb0[cur]!==prev?nb0[cur]:nb1[cur];if(next<0||next===start||seen[next]===tag)break;seen[next]=tag;keys.push(next);prev=cur;cur=next;}
   if(keys.length>2){const pts=keys.map(k=>at(k,lv.L)),ins=pts.map(inside);loops.push(simplifyLoop(pts,tolFor(l),i=>ins[i]!==ins[(i+1)%pts.length]||ins[i]!==ins[(i+pts.length-1)%pts.length]));}}
  return {index:l,k:lv.k,j:lv.j,guide:lv.guide,level:lv.L,loops,closed:true};});
 return {kind:'contour',lines,m,guides:B,top:0,peaks:heightPeaks(state,rect,o),visibleCount:lines.length};}
const heightPeaks=(state,rect,o)=>{const [x0,y0,x1,y1]=rect,r=rng(hashOf(o.key+':peaks')),out=[];for(let k=0;k<state.params.peaks;k++){const x=k?x0+(x1-x0)*(.12+.76*r()):x0+(x1-x0)*state.params.cx,y=k?y0+(y1-y0)*(.1+.8*r()):y0+(y1-y0)*state.params.cy;if(k){r();r();}out.push([x,y]);}return out;};

// ── Ranges: offset stacks under terrain profiles ──────────────────────────
// Each range is a body between a top edge (foot − height × hump × ridges) and a
// bottom edge that relaxes from a parallel offset of the top (relax 0) to a
// flat foot (relax 1). Its lines tween between the two edges.
function rangesFor(state,rect,pitch,key,faults){const p=state.params,R=p.ranges;if(!R)return [];const [x0,y0,x1,y1]=rect,w=x1-x0,hh=y1-y0,r=rng(hashOf(key+':ranges')),n=noiseFor(key+':ridge'),wob=noiseFor(key+':rwobble'),hz=y0+hh*p.horizon,xs=[];
 for(let x=x0-6;x<x1+6;x+=3.5)xs.push(x);xs.push(x1+6);
 const out=[],facing=state.mirror==='facing',reflect=state.mirror==='reflect',hanging=facing?Math.floor(R/2):0,rising=R-hanging;
 for(let q=0;q<R;q++){const hang=q>=rising,rank=hang?q-rising:q,cnt=hang?hanging:rising;
  const foot=reflect?hz-(rank/Math.max(1,cnt))*.05*hh+2:facing?(hang?y0+(hz-y0)*(.18+.62*(rank+.5)/cnt):hz+(y1-hz)*(.3+.7*(rank+.5)/cnt)):y0+hh*(.2+.8*(rank+.55)/cnt);
  const Hpx=p.rangeHeight*hh*.5*(.7+.5*r()),humps=Array.from({length:1+Math.floor(r()*3)},()=>({c:x0+w*(r()*1.3-.15),hw:w*(.22+.38*r()),a:.55+.45*r()})),fz=r()*50,fq=1.6+r()*1.6;
  const E=x=>{let e=0;for(const u of humps){const t=(x-u.c)/u.hw;if(Math.abs(t)<1)e=Math.max(e,u.a*(1-t*t)**1.5);}const s=(x-x0)/w;let v=0,t2=0,a=1;for(let o2=0;o2<4;o2++){v+=a*n(s*fq*2**o2,fz,o2*3.3+.5);t2+=a;a*=.5;}return e*clamp(.72+.6*v/t2,.3,1);};
  const sp=Math.max(pitch*.9,p.weight*1.45*1.55),T=Math.max(sp*7,Hpx*.38+hh*.035),top=xs.map(x=>foot-Hpx*E(x)),bot=xs.map((x,i)=>lerp(top[i]+T,foot+T*(.28+.5*E(x)),p.relax)),thick=Math.max(...bot.map((b,i)=>b-top[i])),m=clamp(Math.round(thick/sp),3,140);
  const lines=[];for(let j=0;j<=m;j++){const v=xs.map((x,i)=>{let t=j/m;if(j&&j<m&&p.wobble)t+=p.wobble*.42*wob(x/34,j*.61+q*9.3,q*.7)/m;return lerp(top[i],bot[i],t);});lines.push(v);}
  // Hanging ranges are built rising and turned over about their foot.
  if(hang)for(const v of lines)for(let i=0;i<v.length;i++)v[i]=2*foot-v[i];
  if(faults.length)for(const v of lines)for(let i=0;i<v.length;i++)v[i]+=faultAt(faults,xs[i],v[i])[1];
  for(let i=0;i<xs.length;i++){const col=lines.map(v=>v[i]);if(hang){col.reverse();stackClamp(col,DELTA,0);col.reverse();}else stackClamp(col,DELTA,0);lines.forEach((v,k)=>v[i]=col[k]);}
  const tol=()=>SIMPLIFY,ls=lines.map((v,j)=>{const idx=simplifyGraph(xs,v,tol);return {index:j,guide:j===0||j===m,uv:idx.map(i=>[xs[i],v[i]]),pts:idx.map(i=>[xs[i],v[i]])};});
  out.push({index:q,hang,foot,m,lines:ls,body:[...ls[0].pts,...[...ls[m].pts].reverse()]});}
 return out.sort((a,b)=>a.hang===b.hang?(a.hang?b.foot-a.foot:a.foot-b.foot):a.hang?-1:1);}

// ── Inlays ────────────────────────────────────────────────────────────────
const SEQUENCE=['eye','slot','diamond','disc','ring','sun','window'];
const dims=(shape,s)=>({disc:[s,s],ring:[s,s],sun:[s,s],eye:[s,s*.52],diamond:[s*.8,s*1.05],slot:[s*.3,s*1.55],window:[s*.9,s*1.2]})[shape];
// Several inlays follow Awazu's axis of signs, downward from the first (upward into the sky when the scene is reflected),
// shrunk if needed (to no less than 35 %) so the axis fits the space it grows into.
export function inlaysFor(state,rect){if(state.inlay==='none')return [];const p=state.params,[x0,y0,x1,y1]=rect,w=x1-x0,start=SEQUENCE.indexOf(state.inlay),y=y0+(y1-y0)*p.inlayY,n=p.inlayCount,shapes=Array.from({length:n},(_,k)=>n>1?SEQUENCE[(Math.max(0,start)+k)%SEQUENCE.length]:state.inlay);
 const dir=state.mirror==='reflect'&&y<y0+(y1-y0)*p.horizon?-1:1,extent=s=>shapes.reduce((t,sh,k)=>t+(k?dims(shapes[k-1],s)[1]/2+dims(sh,s)[1]/2+s*.22:0),0)+dims(shapes[n-1],s)[1]/2,room=Math.max(1,(dir>0?y1-y:y-y0)-8);
 let s=p.inlaySize*w;if(n>1&&extent(s)>room)s*=Math.max(.35,room/extent(s));const out=[];let yy=y;
 shapes.forEach((shape,k)=>{const [sw,sh]=dims(shape,s);if(k)yy+=dir*(dims(shapes[k-1],s)[1]/2+sh/2+s*.22);out.push({shape,x:x0+w*p.inlayX,y:yy,w:sw,h:sh});});return out;}
// The outline of an inlay grown by e on every side, as path data.
function shapeD(q,e=0){const {x,y}=q,w=q.w+2*e,h=q.h+2*e,f=v=>+v.toFixed(2);
 switch(q.shape){case 'disc':case 'sun':case 'ring':{const r=w/2,d=`M${f(x-r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2*r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2*r)} 0z`;if(q.shape!=='ring')return d;const ri=Math.max(.5,q.w*.31-e);return d+`M${f(x-ri)} ${f(y)}a${f(ri)} ${f(ri)} 0 1 1 ${f(2*ri)} 0a${f(ri)} ${f(ri)} 0 1 1 ${f(-2*ri)} 0z`;}
  case 'eye':return `M${f(x-w/2)} ${f(y)}Q${f(x)} ${f(y-h)} ${f(x+w/2)} ${f(y)}Q${f(x)} ${f(y+h)} ${f(x-w/2)} ${f(y)}z`;
  case 'diamond':return `M${f(x)} ${f(y-h/2)}L${f(x+w/2)} ${f(y)}L${f(x)} ${f(y+h/2)}L${f(x-w/2)} ${f(y)}z`;
  case 'slot':{const r=w/2;return `M${f(x-r)} ${f(y-h/2+r)}a${f(r)} ${f(r)} 0 0 1 ${f(w)} 0V${f(y+h/2-r)}a${f(r)} ${f(r)} 0 0 1 ${f(-w)} 0z`;}
  default:return `M${f(x-w/2)} ${f(y-h/2)}h${f(w)}v${f(h)}h${f(-w)}z`;}}

// The slotted sun's cuts: bands across the lower half, each a chord-bounded trapezoid inside the disc.
function sunSlots(q){const r=q.w/2,f=v=>+v.toFixed(2),hw=y=>Math.sqrt(Math.max(0,r*r-(y-q.y)**2));let d='';for(let i=0;i<6;i++){const t=i/6,y0=q.y+r*(.12+t*.82),y1=Math.min(q.y+r*.999,y0+r*(.03+.07*t)),a=hw(y0),b=hw(y1);d+=`M${f(q.x-a)} ${f(y0)}H${f(q.x+a)}L${f(q.x+b)} ${f(y1)}H${f(q.x-b)}z`;}return d;}
const clipD=q=>shapeD(q)+(q.shape==='sun'?sunSlots(q):'');
// ── Path data ─────────────────────────────────────────────────────────────
// Coordinates are written in tenths; relative steps come from rounded absolute
// points, so rounding never drifts along a line.
const num=t=>{const a=t<0?-t:t,i=(a/10)|0,f=a-i*10;return (t<0?'-':'')+(f?(i?i:'')+'.'+f:i);};
function pathD(pts,closed){let s='',px=0,py=0,n=0;for(const [x,y] of pts){const X=Math.round(x*10),Y=Math.round(y*10);if(!n){s+=`M${num(X)} ${num(Y)}`;}else{const dx=X-px,dy=Y-py;if(!dx&&!dy)continue;s+=(n===1?'l':dx<0?'':' ')+num(dx)+(dy<0?'':' ')+num(dy);}px=X;py=Y;n++;}return closed?s+'z':s;}
// Polyline runs inside a box: a segment stays when either end is inside (lines are clipped by the field anyway; this keeps files small and plotters on the paper).
function trim(pts,[x0,y0,x1,y1],m){const ins=pts.map(([x,y])=>x>=x0-m&&x<=x1+m&&y>=y0-m&&y<=y1+m),runs=[];let run=null;for(let i=0;i<pts.length-1;i++){if(ins[i]||ins[i+1]){if(!run){run=[pts[i]];runs.push(run);}run.push(pts[i+1]);}else run=null;}return runs;}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const n1=v=>Math.round(v*100)/100;

// ── State ─────────────────────────────────────────────────────────────────
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS){const v=input.params?.[c.key];params[c.key]=(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(+v)?clamp(c.step>=1?Math.round(+v):+v,c.min,c.max):set.params[c.key];}
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],palette=pick('palette'),base=PALETTES.find(q=>q.id===palette).colors;
 const colors=Array.isArray(input.colors)&&input.colors.length===14&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...base];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&"]/g,'').slice(0,max):d;let profile;try{profile=normalizeProfile(input.profile);}catch{profile=[...set.profile];}
 const out={engine:ENGINE,family:family.id,title:clip(input.title,family.title,40),info:clip(input.info,family.info,120),stage:[1,2,3,4].includes(+input.stage)?+input.stage:4};
 for(const k of Object.keys(OPTIONS))out[k]=pick(k);return {...out,palette,colors,profile,params};}

// ── Layout ────────────────────────────────────────────────────────────────
// Panels: [rect, variant]. Diptych draws the second panel as a mirror of the first.
export function panelsFor(state){switch(state.layout){
 case 'title':return [{rect:[0,190,W,H],key:'a'}];
 case 'frame':return [{rect:[52,52,W-52,H-144],key:'a'}];
 case 'diptych':return [{rect:[26,26,W/2-5,H-158],key:'a'},{rect:[W/2+5,26,W-26,H-158],key:'a',mirror:true}];
 case 'split':return [{rect:[0,0,W,452],key:'a'},{rect:[0,578,W,H],key:'b',turn:true}];
 default:return [{rect:[0,0,W,H],key:'a'}];}}
const TURN={horizontal:'vertical',vertical:'horizontal',radial:'concentric',concentric:'radial',contour:'contour'};

// One panel's geometry: the field, its ranges, faults and inlays.
export function geometry(state,panel){const p=state.params,rect=panel.rect,dir=panel.turn?TURN[state.direction]:state.direction,key=`${p.seed}:${panel.key}:${dir}`,lineDir=dir==='vertical'?[0,1]:dir==='horizontal'?[Math.cos(p.tilt*Math.PI/180),Math.sin(p.tilt*Math.PI/180)]:[1,0];
 const faults=faultsFor(state,rect,key,dir==='vertical'?[Math.cos((90+p.tilt)*Math.PI/180),Math.sin((90+p.tilt)*Math.PI/180)]:lineDir),scale=(rect[3]-rect[1])/H,lines=Math.max(8,Math.round(p.lines*(dir==='radial'||dir==='concentric'||dir==='contour'?1:Math.max(.35,scale))));
 const beta=(dir==='vertical'?90:0)+p.tilt,field=dir==='contour'?contourField(state,rect,{key,lines,faults}):graphField(state,rect,{dir:dir==='vertical'?'horizontal':dir,beta:beta*Math.PI/180,key,lines,faults});
 const pitch=(rect[3]-rect[1])/Math.max(16,p.lines*Math.max(.35,scale));
 return {rect,dir,key,faults,field,ranges:rangesFor(state,rect,pitch,key,faults),inlays:inlaysFor(state,rect),pitch};}

// ── Drawing ───────────────────────────────────────────────────────────────
// Lines are grouped by colour and weight into one path each (pen-plotter friendly).
function strokeGroups(groups,cls=''){let s='';for(const [k,ds] of groups){const [c,w]=k.split('|');s+=`<path${cls} d="${ds.join('')}" stroke="${c}" stroke-width="${w}"/>`;}return s;}
function addTo(map,k,d){if(!d)return;(map.get(k)??map.set(k,[]).get(k)).push(d);}
// Bands between consecutive lines, as [colour, path data] entries. Strips and
// wedges that share a colour merge into one path; contour levels and rings are
// painted in order instead (each region over the last), so every loop is
// written once.
function bandPaths(lines,kind,colourOf,startAt=0,ground){const sorted=[...lines].sort((a,b)=>a.index-b.index),col=l=>colourOf(l.index-startAt);
 // Contour: the region above each level, lowest first; a level that keeps its predecessor's colour adds nothing.
 if(kind==='contour'){const out=[];sorted.forEach((l,i)=>{const c=col(l);if(!i||c!==col(sorted[i-1]))out.push([c,l.loops.map(q=>pathD(q,true)).join(''),1]);});return out;}
 // Rings: discs from the outside in, each in the colour of the band just inside it; the innermost disc returns to ground.
 if(kind==='concentric'){const out=[],n=sorted.length;for(let i=n-1;i>=1;i--){const c=col(sorted[i-1]);if(i===n-1||c!==col(sorted[i]))out.push([c,pathD(sorted[i].pts,true)]);}if(n)out.push([ground,pathD(sorted[0].pts,true)]);return out;}
 const map=new Map();let run=0;for(let i=0;i<sorted.length;i++){const c=col(sorted[i]),next=sorted[i+1];if(next&&col(next)===c)continue;const a=sorted[run],e=next??(kind==='radial'?sorted[0]:null);run=i+1;if(e)addTo(map,c,pathD([...a.pts,...[...e.pts].reverse()],true));}
 return [...map].map(([c,ds])=>[c,ds.join('')]);}
// Contour loops are drawn only inside the field: a loop is opened at a point outside and trimmed.
export function trimLoop(loop,[x0,y0,x1,y1]){const out=loop.findIndex(([x,y])=>x<x0||x>x1||y<y0||y>y1);if(out<0)return [{pts:loop,closed:true}];const r=[...loop.slice(out),...loop.slice(0,out+1)];return trim(r,[x0,y0,x1,y1],0).map(pts=>({pts,closed:false}));}
function linePolys(ln,kind,box,m){if(kind==='contour')return ln.loops.flatMap(l=>trimLoop(l,box));if(kind==='concentric'){const inside=ln.pts.every(([x,y])=>x>=box[0]-m&&x<=box[2]+m&&y>=box[1]-m&&y<=box[3]+m);if(inside)return [{pts:ln.pts,closed:true}];}return trim(ln.pts,box,m).map(pts=>({pts,closed:false}));}

// The whole panel scene (ground, field, ranges, inlays) for one stage.
function sceneSVG(state,G,uid,defs){const p=state.params,st=state.stage,c=state.colors,[paper,ground,ink,accent]=c,rect=G.rect,[x0,y0,x1,y1]=rect,box=rect,field=G.field,kind=field.kind,con=inkFor(ground);
 const wq=v=>Math.max(.1,Math.round(v*20)/20),N=Math.max(1,field.visibleCount),startAt=field.top,ramp=i=>Math.max(.15,1+p.weightRamp*(2*clamp(i/N,0,1)-1));
 let s=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${ground}"/>`;
 const misreg=(col,body)=>{if(st<3||!p.misregister)return body;const a=(hashOf(col+p.seed)%360)*Math.PI/180;return `<g transform="translate(${n1(Math.cos(a)*p.misregister)} ${n1(Math.sin(a)*p.misregister)})">${body}</g>`;};
 const glow=st>=3&&p.glow>0&&state.render!=='bands';if(glow)defs.push(`<filter id="${uid}-glow" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${n1(.8+p.glow*4)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
 const wrapGlow=b=>glow?`<g filter="url(#${uid}-glow)">${b}</g>`:b;
 // Field
 let fieldSVG='';const F=cycler(state,'F',G.key);
 if(st===1){let d='';for(const ln of field.lines)if(ln.guide)for(const q of linePolys(ln,kind,box,4))d+=pathD(q.pts,q.closed);fieldSVG=`<path d="${d}" fill="none" stroke="${con}" stroke-width="1.3" stroke-linejoin="round"/>`;
  if(kind==='contour')for(const [x,y] of field.peaks)fieldSVG+=`<circle cx="${n1(x)}" cy="${n1(y)}" r="5" fill="none" stroke="${accent}" stroke-width="2"/><path d="M${n1(x-9)} ${n1(y)}h18M${n1(x)} ${n1(y-9)}v18" stroke="${accent}" stroke-width="1.2"/>`;
  if(kind==='radial'||kind==='concentric'){const [cx,cy]=field.frame.C;fieldSVG+=`<circle cx="${n1(cx)}" cy="${n1(cy)}" r="5" fill="${accent}"/>`;}}
 else if(st===2){let d='';for(const ln of field.lines)for(const q of linePolys(ln,kind,box,3))d+=pathD(q.pts,q.closed);fieldSVG=`<path d="${d}" fill="none" stroke="${con}" stroke-width=".6" stroke-opacity=".85" stroke-linejoin="round"/>`;}
 else{const bands=state.render!=='lines',lines=state.render!=='bands';
  if(bands)for(const [col,d,eo] of bandPaths(field.lines,kind,F,startAt,ground))fieldSVG+=misreg(col,`<path d="${d}" fill="${col}"${eo?' fill-rule="evenodd"':''}${lines?'':` stroke="${col}" stroke-width=".6"`}/>`);
  if(lines){const groups=new Map();for(const ln of field.lines){const i=ln.index-startAt,col=bands?ink:F(i),w=wq(p.weight*ramp(i)*(ln.guide?p.index:1));for(const q of linePolys(ln,kind,box,w+2))addTo(groups,col+'|'+w,pathD(q.pts,q.closed));}
   let g='';for(const [k,ds] of groups){const [col,w]=k.split('|');g+=misreg(col,`<path d="${ds.join('')}" stroke="${col}" stroke-width="${w}"/>`);}fieldSVG+=wrapGlow(`<g fill="none" stroke-linecap="round" stroke-linejoin="round">${g}</g>`);}}
 // Ranges and inlays
 const halo=Math.max(3,p.weight*2.2);let rangesSVG='';const RB=cycler(state,'B',G.key+':ranges');
 for(const rg of G.ranges){const body=pathD(rg.body,true);
  if(st===1){let d='';for(const ln of rg.lines)if(ln.guide)d+=pathD(ln.pts,false);rangesSVG+=`<path d="${d}" fill="none" stroke="${accent}" stroke-width="1.6"/>`;continue;}
  rangesSVG+=`<path d="${body}" fill="${ground}"/>`;
  if(st===2){rangesSVG+=`<path d="${rg.lines.map(l=>pathD(l.pts,false)).join('')}" fill="none" stroke="${con}" stroke-width=".8"/>`;continue;}
  const off=rg.index*3,col=j=>RB(j+off),bands=state.render!=='lines',lines=state.render!=='bands';
  if(bands)for(const [cc,d] of bandPaths(rg.lines,'linear',col))rangesSVG+=misreg(cc,`<path d="${d}" fill="${cc}"${lines?'':` stroke="${cc}" stroke-width=".6"`}/>`);
  if(lines){const groups=new Map();for(const ln of rg.lines){const w=wq(p.weight*1.45*ramp(ln.index/rg.m*N)*(ln.guide?p.index:1)),cc=bands?ink:col(ln.index);addTo(groups,cc+'|'+w,pathD(ln.pts,false));}
   let g='';for(const [k,ds] of groups){const [cc,w]=k.split('|');g+=misreg(cc,`<path d="${ds.join('')}" stroke="${cc}" stroke-width="${w}"/>`);}rangesSVG+=wrapGlow(`<g fill="none" stroke-linecap="round" stroke-linejoin="round">${g}</g>`);}}
 const inlaySVG=inlayDraw(state,G,uid,defs,halo,con);
 // Faults and horizon (construction passes only)
 let marks='';if(st<=2){for(const f of G.faults){const L=2000;marks+=`<path d="M${n1(f.P[0]-f.d[0]*L)} ${n1(f.P[1]-f.d[1]*L)}L${n1(f.P[0]+f.d[0]*L)} ${n1(f.P[1]+f.d[1]*L)}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="7 5"/>`;}
  if(state.mirror!=='off'){const hz=y0+(y1-y0)*p.horizon;marks+=`<path d="M${x0} ${n1(hz)}H${x1}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="14 4 3 4"/>`;}}
 return s+fieldSVG+(state.inlayLayer==='behind'?inlaySVG+rangesSVG:rangesSVG+inlaySVG)+marks;}

function inlayDraw(state,G,uid,defs,halo,con){if(!G.inlays.length)return '';const p=state.params,st=state.stage,c=state.colors,[,ground,ink,accent]=c,lw=n1(Math.max(1,p.weight*.9));let s='';
 if(st===1)return `<path d="${G.inlays.map(q=>shapeD(q)).join('')}" fill="none" stroke="${accent}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
 const over=state.inlayFill==='overlay',halos=G.inlays.map(q=>shapeD(q,halo)).join(''),outline=G.inlays.map(q=>shapeD(q)).join('');if(!over||st===2)s+=`<path d="${halos}" fill="${ground}" fill-rule="evenodd"/>`;
 if(st===2)return s+`<path d="${outline}" fill="none" stroke="${con}" stroke-width="1.2"/>`;
 const RB=cycler(state,'B',G.key+':inlay'),FB=cycler(state,'F',G.key+':inlay');
 for(const q of G.inlays){const d=shapeD(q),eye=q.shape==='eye',fillCol=eye?c[9]:accent;
  if(state.inlayFill==='solid')s+=`<path d="${d}" fill="${fillCol}" fill-rule="evenodd"/>`;
  else if(state.inlayFill==='rings'){// Nested copies of the shape, shrinking by a few line pitches, painted largest first.
   const ring=q.shape==='ring',step=Math.max(ring?2.5:4,G.pitch*(ring?1.2:2.4)),k=Math.max(1,Math.floor((ring?q.w*.095:Math.min(q.w,q.h)/2)/step));for(let i=0;i<k;i++)s+=`<path d="${shapeD(q,-i*step)}" fill="${RB(i)}" fill-rule="evenodd"/>`;}
  if(q.shape==='sun'&&state.inlayFill!=='strata'&&!over)s+=`<path d="${sunSlots(q)}" fill="${ground}"/>`;}
 // A second field, turned, inside every inlay — on ground, or laid over the strata (overlay) so the two gratings interfere.
 if(state.inlayFill==='strata'||over){const xs=G.inlays.flatMap(q=>[q.x-q.w/2,q.x+q.w/2]),ys=G.inlays.flatMap(q=>[q.y-q.h/2,q.y+q.h/2]),bx=[Math.min(...xs)-4,Math.min(...ys)-4,Math.max(...xs)+4,Math.max(...ys)+4];
  const lines=Math.max(8,Math.round(G.field.kind==='contour'||G.field.kind==='radial'||G.field.kind==='concentric'?(bx[3]-bx[1])/G.pitch:p.lines*(bx[3]-bx[1])/(G.rect[3]-G.rect[1]))),f2=graphField(state,bx,{dir:'horizontal',beta:p.inlayAngle*Math.PI/180,key:G.key+':inlay',lines,faults:[],amp:.5});
  defs.push(`<clipPath id="${uid}-in"><path d="${G.inlays.map(clipD).join('')}" clip-rule="evenodd"/></clipPath>`);
  const groups=new Map(),N=Math.max(1,f2.visibleCount),bands=state.render!=='lines';let b='';
  if(bands)for(const [cc,d] of bandPaths(f2.lines,'linear',i=>FB(i+2),f2.top))b+=`<path d="${d}" fill="${cc}"/>`;
  if(state.render!=='bands'){for(const ln of f2.lines){const w=Math.max(.1,Math.round(p.weight*20*Math.max(.15,1+p.weightRamp*(2*clamp((ln.index-f2.top)/N,0,1)-1)))/20);addTo(groups,(bands?ink:FB(ln.index-f2.top+2))+'|'+w,pathD(ln.pts,false));}b+=`<g fill="none" stroke-linecap="round">${strokeGroups(groups)}</g>`;}
  s+=`<g clip-path="url(#${uid}-in)">${over?'':`<path d="${G.inlays.map(q=>shapeD(q)).join('')}" fill="${ground}" fill-rule="evenodd"/>`}${b}</g>`;}
 // Eye: iris and pupil; every inlay gets an ink outline.
 for(const q of G.inlays)if(q.shape==='eye'){s+=`<circle cx="${n1(q.x)}" cy="${n1(q.y)}" r="${n1(q.w*.2)}" fill="${accent}" stroke="${ink}" stroke-width="${lw}"/><circle cx="${n1(q.x)}" cy="${n1(q.y)}" r="${n1(q.w*.085)}" fill="${ink}"/>`;}
 return over?s:s+`<path d="${outline}" fill="none" stroke="${ink}" stroke-width="${lw}" fill-rule="evenodd"/>`;}

// ── Poster ────────────────────────────────────────────────────────────────
const FONT=`'Helvetica Neue',Helvetica,Arial,sans-serif`;
const fitSize=(text,width,max)=>Math.min(max,width/Math.max(1,[...text].length*.7));
function typeSVG(state){const paper=state.colors[0],t=contrast(state.colors[2],paper)>=4.5?state.colors[2]:inkFor(paper),title=state.title.toUpperCase(),info=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,3),T=(x,y,size,txt,extra='')=>`<text x="${x}" y="${n1(y)}" font-size="${n1(size)}"${extra}>${esc(txt)}</text>`;
 let s='';switch(state.layout){
  case 'title':{const size=fitSize(title,W-72,70);s+=T(36,40+size*.78,size,title,' font-weight="700" letter-spacing="1"')+`<path d="M36 ${n1(56+size*.78)}H${W-36}" stroke="${t}" stroke-width="1.2"/>`+info.map((l,i)=>T(36,82+size*.78+i*20,15,l)).join('');break;}
  case 'frame':{const size=fitSize(title,W-104,46);s+=T(52,H-144+28+size*.78,size,title,' font-weight="700" letter-spacing="1"')+info.map((l,i)=>T(52,H-144+52+size*.78+i*18,13.5,l)).join('');
   const B=state.colors.slice(9,14);for(const x0 of [12,W-42])for(let i=0;i<10;i++)s+=`<rect x="${x0+i*3}" y="52" width="2.4" height="${H-196}" fill="${B[i%5]}"/>`;break;}
  case 'diptych':{const size=fitSize(title,W-52,50);s+=T(26,H-158+26+size*.78,size,title,' font-weight="700" letter-spacing="1"')+info.map((l,i)=>T(26,H-158+50+size*.78+i*18,13.5,l)).join('');break;}
  case 'split':{const size=fitSize(title,W-64,56);s+=`<rect x="0" y="452" width="${W}" height="126" fill="${paper}"/>`+T(32,486+size*.78,size,title,' font-weight="700" letter-spacing="1"')+(info[0]?T(32,560,14,info.join('  ·  ')):'');break;}
  default:{const size=fitSize(title,W*.66,44),tw=Math.min(W*.66,[...title].length*size*.7)+30,lines=info.length,h=size+30+lines*18;s+=`<rect x="22" y="22" width="${n1(Math.max(tw,lines?Math.min(W-44,Math.max(...info.map(l=>l.length))*7.2+28):0))}" height="${n1(h)}" fill="${paper}"/>`+T(36,30+size*.85,size,title,' font-weight="700" letter-spacing="1"')+info.map((l,i)=>T(36,30+size+18+i*18,13,l)).join('');}}
 return `<g font-family="${FONT}" fill="${t}">${s}</g>`;}

const uidOf=state=>'s'+hashOf(JSON.stringify(state)).toString(36);
export function render(input={}){const state=resolve(input),uid=uidOf(state),defs=[],panels=panelsFor(state),feats={lines:0,guides:0,ranges:0,faults:0,inlays:0,panels:panels.length};let body='';const built=new Map();
 for(const [k,panel] of panels.entries()){const [x0,y0,x1,y1]=panel.rect;defs.push(`<clipPath id="${uid}-p${k}"><rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}"/></clipPath>`);
  if(panel.mirror){body+=`<g clip-path="url(#${uid}-p${k})"><use href="#${uid}-scene0" transform="matrix(-1 0 0 1 ${W} 0)"/></g>`;continue;}
  const G=geometry(state,panel);built.set(k,G);feats.lines+=G.field.lines.length+G.ranges.reduce((s,r)=>s+r.lines.length,0);feats.guides+=G.field.guides;feats.ranges+=G.ranges.length;feats.faults+=G.faults.length;feats.inlays+=G.inlays.length;
  let scene=sceneSVG(state,G,`${uid}-${k}`,defs);
  if(state.mirror==='reflect'){const hz=n1(y0+(y1-y0)*state.params.horizon);defs.push(`<clipPath id="${uid}-up${k}"><rect x="${x0}" y="${y0}" width="${x1-x0}" height="${n1(hz-y0)}"/></clipPath><clipPath id="${uid}-dn${k}"><rect x="${x0}" y="${hz}" width="${x1-x0}" height="${n1(y1-hz)}"/></clipPath>`);
   scene=`<g clip-path="url(#${uid}-up${k})"><g id="${uid}-half${k}">${scene}</g></g><g clip-path="url(#${uid}-dn${k})"><use href="#${uid}-half${k}" transform="matrix(1 0 0 -1 0 ${n1(2*hz)})"/></g>`;}
  body+=`<g clip-path="url(#${uid}-p${k})"><g id="${uid}-scene${k}">${scene}</g></g>`;}
 const label={1:'guides',2:'offset lines',3:'strata colour',4:'poster'}[state.stage],fam=FAMILIES.find(f=>f.id===state.family);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(state.title)} — strata line fields, ${esc(fam.name)}, ${label}</title><defs>${defs.join('')}</defs><rect width="${W}" height="${H}" fill="${state.colors[0]}"/>${body}${state.stage===4?typeSVG(state):''}</svg>`;
 return {svg,state,width:W,height:H,features:{...feats,family:state.family,direction:state.direction,stage:state.stage,layout:state.layout,bytes:svg.length,paths:(svg.match(/<path/g)||[]).length},geometry:built};}

// The style across displacements (top row) and directions (bottom row), at stage 3.
export function specimen(input={}){const state=resolve({...input,stage:3,layout:'full'}),tiles=[...OPTIONS.displace.map(d=>({displace:d})),...OPTIONS.direction.map(d=>({direction:d}))],tw=W*.25,th=H*.25,gap=24,w=5*tw+6*gap,h=2*th+3*gap+40;
 const cells=tiles.map((t,i)=>{const r=render({...state,...t,title:'',info:''}),inner=r.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<title>.*?<\/title>/,''),x=gap+(i%5)*(tw+gap),y=gap+Math.floor(i/5)*(th+gap+20);
  return `<g data-tile="${Object.values(t)[0]}"><svg x="${n1(x)}" y="${n1(y)}" width="${n1(tw)}" height="${n1(th)}" viewBox="0 0 ${W} ${H}">${inner}</svg><text x="${n1(x)}" y="${n1(y+th+16)}" font-size="13" font-family="${FONT}" fill="#4a4844">${LABELS[Object.keys(t)[0]][Object.values(t)[0]]}</text></g>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${n1(w)}" height="${n1(h)}" viewBox="0 0 ${n1(w)} ${n1(h)}"><rect width="${n1(w)}" height="${n1(h)}" fill="#efede8"/>${cells.join('')}</svg>`;}
