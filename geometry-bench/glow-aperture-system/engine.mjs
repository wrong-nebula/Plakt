/* Glow apertures v2 — shape system study after Koichi Sato’s luminous fields (and Susumu Endo’s light shaft).
 * One pipeline, as in v1: aperture mask → distance falloff → gradient map → poster. v2 is additive:
 * – v1 rules (engine glow-aperture-v1) and every v2 state that only uses v1 features are drawn by the frozen v1
 *   engine (./v1/engine.mjs), so they stay byte-identical; v2 features switch to the code below, which draws the
 *   v1 features exactly as v1 did (verify checks both).
 * – Apertures: words and kanji (outlines from other systems' prepared fonts, see fonts.mjs), a custom path or
 *   polygon, moon phases, stairs, window, tree, mountain, standing figure; a grid layout; blinds (shadow bands)
 *   and a cut mode where the shape is the hole in a glowing field.
 * – Light: up to three lights whose tinted fields mix (screen on dark, multiply on paper), rim light, dust motes.
 * – Print finishes: stepped screenprint ramps (discrete tables), halftone dots (field + an feImage dot screen,
 *   thresholded), two-ink riso with misregistration, paper fibre.
 * – Composition: square, story and landscape formats, title lockups, serif copy, and series of panels (time of
 *   day, a turning light, moon phases, or one light across shapes).
 */
import svgpath from 'svgpath';
import * as V1 from './v1/engine.mjs';
import {FACES} from './fonts.mjs';
export const ENGINE='glow-aperture-v2',V1_ENGINE=V1.ENGINE;
export const SOURCES=V1.SOURCES;
export const FORMATS={poster:[728,1030],square:[880,880],story:[612,1088],landscape:[1030,728]};
export const FORMAT_NAMES={poster:'Poster (B, portrait)',square:'Square',story:'Story 9:16',landscape:'Landscape (B)'};
// The drawing size and its scale against the 728-wide poster; set for each render (and each series panel).
let W=728,H=1030,S=1;const setDims=(w,h)=>{W=w;H=h;S=Math.min(w,h)/728;};
export const dims=state=>FORMATS[state?.format]??FORMATS.poster;
export const n=v=>Math.round(v*100)/100;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));

// Calm print ramps lead; the v1 ramps stay for compatibility.
const CALM=[
 {id:'ivoryblue',name:'Blue on ivory',stops:[['#f5f0e3',0],['#d3dbe0',.28],['#7f98b8',.55],['#3a5a8a',.78],['#1d3461',.94]]},
 {id:'fog',name:'Fog',stops:[['#eceeeb',0],['#cfd5d4',.25],['#97a3a6',.5],['#55626a',.76],['#20292e',.96]]},
 {id:'lantern',name:'Lantern',stops:[['#1c2228',0],['#3b3833',.2],['#8a6c4c',.45],['#ddc396',.7],['#f8f0de',.9]]},
 {id:'sage',name:'Sage and forest',stops:[['#f0efe2',0],['#cfd6bb',.28],['#8fa085',.55],['#4d6651',.78],['#233a2c',.96]]},
 {id:'slate',name:'Slate',stops:[['#e9ebec',0],['#b6bec4',.3],['#6e7b85',.62],['#2f3a42',.9]]},
 {id:'stone',name:'Stone',stops:[['#efe9dd',0],['#d9cfbd',.32],['#a99c86',.66],['#5f5647',.95]]},
 {id:'wall',name:'Afternoon wall',stops:[['#c8bea9',0],['#d6ccb7',.3],['#ebe2cd',.58],['#fbf6e9',.86]]},
 {id:'ash',name:'Ash and ink',stops:[['#efeee9',0],['#d2d0c9',.25],['#8f8c86',.58],['#2c2b29',.92]]},
 {id:'dusk',name:'Dusk',stops:[['#f2e7d8',0],['#d8b8a0',.25],['#8f7f98',.52],['#434868',.78],['#1d2138',.96]]},
 {id:'paper',name:'Paper white',stops:[['#f7f3ea',0],['#ece5d5',.4],['#d8cfba',.75],['#bfb39b',1]]},
 {id:'sepialight',name:'Sepia light',stops:[['#2a2420',0],['#6b5445',.25],['#b8946c',.5],['#e8d4b4',.75],['#faf4e6',.95]]}
];
export const RAMPS=[...CALM,...V1.RAMPS];
const R=id=>RAMPS.find(r=>r.id===id).stops.map(s=>[...s]);
export const DEFAULT_PATH='M50 3C66 3 78 15 78 31C78 43 71 52 62 57L71 97H29L38 57C29 52 22 43 22 31C22 15 34 3 50 3Z';
const P0={size:1,x:0,y:0,rotate:0,count:1,spacing:1,layers:1,width:30,curve:1,balance:0,bloom:.5,offset:0,smear:0,angle:90,haze:0,fray:0,grain:.05,sparkles:0,inset:0,seed:1};
// v2 parameters at these values leave a poster exactly as v1 drew it.
const P2={phase:.5,blinds:0,slat:.5,depth:0,lights:1,spread:70,rim:0,steps:6,dot:9,misregister:4,paper:0,panels:4};
const OPT2={aperture:'open',finish:'smooth',format:'poster',series:'none',lockup:'auto',type:'sans',face:'mincho'};
const LIGHTS0=['#3e6aa8','#b4573a'];
const F2=(id,name,after,o)=>({id,name,after,calm:true,word:'光',path:DEFAULT_PATH,lightColors:LIGHTS0,...o,set:{mode:'halo',shape:'rect',layout:'centred',core:'none',sparkle:'dots',ground:'plain',copy:'across',...OPT2,...o.set,params:{...P0,...P2,...o.set.params}}});
// Eight new calm styles lead; the thirteen v1 styles follow unchanged (their v2 settings are all neutral).
export const FAMILIES=[
 F2('lantern','Lantern kanji','new — word of light',{title:'LANTERN',info:'Paper light · ink night',word:'光',colors:['#1c2228','#1c2228','#1c2228','#efe4cc'],ramp:R('lantern'),
  set:{shape:'word',face:'mincho',type:'serif',lockup:'foot',params:{size:.96,y:-.05,width:6,balance:.2,bloom:.8,haze:.15,grain:.06,paper:.3,seed:3110}},
  note:'A kanji of warm paper light whose strokes dissolve into a slate night.'}),
 F2('blinds','Afternoon blinds','new — light through blinds',{title:'AFTERNOON',info:'Light through blinds, four o’clock',colors:['#c8bea9','#c8bea9','#3b352b','#3b352b'],ramp:R('wall'),
  set:{shape:'window',type:'serif',lockup:'spine',params:{size:.9,x:.04,rotate:-16,width:7,bloom:.55,balance:.2,smear:.25,angle:205,blinds:8,slat:.5,grain:.05,paper:.35,sparkles:70,seed:1600}},
  sparkle:'dust',note:'A window of light thrown across a stone wall, striped by blinds, with dust in the air.'}),
 F2('shadows','Coloured shadows','new — three lights',{title:'THREE LIGHTS',info:'Blue and sienna shadows',colors:['#f2ede1','#f2ede1','#2c2c2c','#2c2c2c'],ramp:[['#f2ede1',0],['#d9d2c2',.3],['#8e8a80',.64],['#2b2b2b',.92]],lightColors:['#3e6aa8','#b4573a'],
  set:{mode:'shadow',shape:'standing',format:'square',type:'serif',lockup:'centre',params:{size:.52,y:-.1,width:12,bloom:.35,smear:1.1,angle:270,lights:3,spread:55,offset:18,grain:.05,paper:.25,seed:7070}},
  note:'A standing figure lit from three sides: a grey shadow between a blue and a sienna one.'}),
 F2('phases','Moon phases','new — series',{title:'MOON / PHASES',info:'Six nights, one ink',colors:['#f5f0e3','#f5f0e3','#1d3461','#1d3461'],ramp:R('ivoryblue'),
  set:{shape:'moon',series:'phase',finish:'steps',type:'serif',lockup:'foot',params:{size:1,width:10,bloom:.45,balance:.15,steps:7,panels:6,grain:.05,paper:.3,seed:2828}},
  note:'Six moons in screenprint bands of ink blue on ivory, waxing from crescent to full.'}),
 F2('ridges','Mountain mist','new — riso duotone',{title:'MOUNTAIN MIST',info:'Sage and forest, two inks',colors:['#f0efe2','#f0efe2','#233a2c','#233a2c'],ramp:R('sage'),
  set:{mode:'shadow',shape:'mountain',layout:'stacked',finish:'riso',format:'landscape',type:'serif',lockup:'foot',params:{size:1.05,y:-.04,count:3,spacing:.62,depth:.85,width:14,bloom:.6,smear:.5,haze:.45,steps:5,misregister:5,grain:.09,paper:.35,seed:4747}},
  note:'Three ridges printed in two misregistered inks, mist rising between them.'}),
 F2('stairs','Stair shadow','new — halftone',{title:'STAIRS',info:'One light, late afternoon',colors:['#efeee9','#efeee9','#2c2b29','#2c2b29'],ramp:R('ash'),
  set:{mode:'shadow',shape:'stairs',finish:'halftone',type:'serif',lockup:'spine',params:{size:.58,x:.1,y:.12,width:14,bloom:.55,smear:1.5,angle:150,dot:8,grain:.04,paper:.3,seed:900}},
  note:'A flight of stairs throwing a long shadow, printed as a halftone screen in ink on cream.'}),
 F2('fog','Tree in fog','new — story format',{title:'FOG',info:'A tree, early morning',colors:['#eceeeb','#eceeeb','#20292e','#20292e'],ramp:R('fog'),
  set:{mode:'shadow',shape:'tree',format:'story',type:'serif',lockup:'centre',params:{size:.62,y:.02,width:30,bloom:.7,smear:.75,haze:.75,grain:.07,paper:.3,seed:1212}},
  note:'A tree whose shadow lifts into fog; slate on pale grey, tall story format.'}),
 F2('cut','Cut light','new — type cut from light',{title:'AFTERGLOW',info:'Type cut from a glowing field',word:'GLOW',colors:['#2a2420','#2a2420','#2a2420','#2a2420'],ramp:R('sepialight'),
  set:{shape:'word',face:'serif',aperture:'cut',format:'landscape',type:'serif',lockup:'foot',params:{size:.98,y:-.06,width:5,bloom:.72,balance:.1,grain:.06,paper:.3,seed:4321}},
  note:'Letters cut out of a field of sepia light; the light bleeds into their edges.'}),
 ...V1.FAMILIES.map(f=>({...f,word:'光',path:DEFAULT_PATH,lightColors:LIGHTS0,set:{...f.set,...OPT2,params:{...f.set.params,...P2}}}))
];
// The calm styles carry their sparkle style at the top level for readability; fold it into the set.
for(const f of FAMILIES)if(f.sparkle){f.set.sparkle=f.sparkle;delete f.sparkle;}
const has=(s,k,v)=>v.includes(s[k]);
export const CONTROLS=[
 ...V1.CONTROLS.map(c=>c.key==='count'?{...c,max:9}:c.key==='spacing'?{...c,uses:s=>s.params.count>1}:c),
 {key:'phase',label:'Moon phase',group:'aperture',min:.1,max:1,step:.01,uses:s=>s.shape==='moon'&&s.series!=='phase'},
 {key:'blinds',label:'Blinds',group:'aperture',min:0,max:24,step:1},
 {key:'slat',label:'Blind opening',group:'aperture',min:.15,max:.85,step:.01,uses:s=>s.params.blinds>0},
 {key:'depth',label:'Aerial depth',group:'light',min:0,max:1,step:.01,uses:s=>s.params.count>1&&s.series==='none'},
 {key:'lights',label:'Lights',group:'light',min:1,max:3,step:1,uses:s=>has(s,'mode',['halo','shadow'])},
 {key:'spread',label:'Light spread',group:'light',min:15,max:180,step:1,uses:s=>has(s,'mode',['halo','shadow'])&&s.params.lights>1},
 {key:'rim',label:'Rim light',group:'light',min:0,max:1,step:.01,uses:s=>s.mode==='shadow'||s.core==='solid'},
 {key:'steps',label:'Print steps',group:'print',min:2,max:12,step:1,uses:s=>has(s,'finish',['steps','riso'])},
 {key:'dot',label:'Halftone cell',group:'print',min:4,max:24,step:1,uses:s=>s.finish==='halftone'},
 {key:'misregister',label:'Misregistration',group:'print',min:0,max:14,step:1,uses:s=>s.finish==='riso'},
 {key:'paper',label:'Paper fibre',group:'print',min:0,max:1,step:.01},
 {key:'panels',label:'Panels',group:'composition',min:2,max:6,step:1,uses:s=>s.series!=='none'}
];
export const SHAPE_NAMES={...V1.SHAPE_NAMES,moon:'Moon phase',stairs:'Stairs',window:'Window',tree:'Tree',mountain:'Mountain',standing:'Standing figure',word:'Word',custom:'Custom path'};
export const OPTIONS={mode:V1.OPTIONS.mode,shape:Object.keys(SHAPE_NAMES),layout:[...V1.OPTIONS.layout,'grid'],core:V1.OPTIONS.core,sparkle:[...V1.OPTIONS.sparkle,'dust'],ground:V1.OPTIONS.ground,copy:V1.OPTIONS.copy,
 aperture:['open','cut'],finish:['smooth','steps','halftone','riso'],format:Object.keys(FORMATS),series:['none','day','turn','phase','shapes'],lockup:['auto','foot','centre','spine'],type:['sans','serif'],face:['mincho','gothic','serif']};
// Options read only in some states: the editor disables them elsewhere and verify checks they stay inert.
export const OPTION_USES={ground:s=>has(s,'mode',['field','beam']),face:s=>s.shape==='word'&&s.series!=='phase',copy:s=>s.lockup==='auto'&&s.series==='none',shape:s=>s.series!=='phase'};
export const OPTION_MODES=V1.OPTION_MODES;

// ── Colour: sRGB ↔ OKLab, ramps (as v1) ─────────────────────────────────────
const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const lin=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,gam=v=>v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;
function lab(h){const [r,g,b]=hexRGB(h).map(lin),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
function rgbOf([L,a,b]){const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>clamp(gam(clamp(v))));}
const hexOf=c=>'#'+c.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
const sortStops=ramp=>[...ramp].sort((a,b)=>a[1]-b[1]);
export const rampAt=V1.rampAt;
const lightest=ramp=>[...ramp].sort((a,b)=>lab(b[0])[0]-lab(a[0])[0])[0][0];
const mix=(a,b,f)=>hexOf(hexRGB(a).map((v,i)=>v+(hexRGB(b)[i]-v)*f));
const mixLab=(a,b,f)=>{const A=lab(a),B=lab(b);return hexOf(rgbOf(A.map((v,k)=>v+(B[k]-v)*f)));};
const lum=h=>{const [r,g,b]=hexRGB(h).map(lin);return .2126*r+.7152*g+.0722*b;};

// ── Seeded randomness and noise tiles (as v1) ──
const rng=seed=>{let a=seed>>>0;return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};};
const CRC=(()=>{const t=new Uint32Array(256);for(let k=0;k<256;k++){let c=k;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[k]=c>>>0;}return t;})();
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(b){let s='';for(let i=0;i<b.length;i+=3){const v=(b[i]<<16)|((b[i+1]??0)<<8)|(b[i+2]??0);s+=B64[v>>18&63]+B64[v>>12&63]+(i+1<b.length?B64[v>>6&63]:'=')+(i+2<b.length?B64[v&63]:'=');}return s;}
function pngGray(N,pix){const raw=new Uint8Array((N+1)*N);for(let y=0;y<N;y++)raw.set(pix.subarray(y*N,y*N+N),y*(N+1)+1);
 const blocks=Math.ceil(raw.length/65535),z=new Uint8Array(2+raw.length+blocks*5+4);z[0]=0x78;z[1]=1;let o=2,a=1,b=0;
 for(let i=0;i<blocks;i++){const len=Math.min(65535,raw.length-i*65535);z[o++]=i===blocks-1?1:0;z[o++]=len&255;z[o++]=len>>8;z[o++]=~len&255;z[o++]=(~len>>8)&255;z.set(raw.subarray(i*65535,i*65535+len),o);o+=len;}
 for(const v of raw){a=(a+v)%65521;b=(b+a)%65521;}z[o++]=b>>8;z[o++]=b&255;z[o++]=a>>8;z[o++]=a&255;
 const chunk=(type,data)=>{const c=new Uint8Array(12+data.length),dv=new DataView(c.buffer);dv.setUint32(0,data.length);for(let i=0;i<4;i++)c[4+i]=type.charCodeAt(i);c.set(data,8);let r=~0;for(let i=4;i<8+data.length;i++)r=CRC[(r^c[i])&255]^(r>>>8);dv.setUint32(8+data.length,~r>>>0);return c;};
 const ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,N);dv.setUint32(4,N);ih[8]=8;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',z),chunk('IEND',new Uint8Array(0))],out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let k=0;for(const p of parts){out.set(p,k);k+=p.length;}
 return 'data:image/png;base64,'+base64(out);}
const tiles=new Map();
function tile(kind,seed){const key=kind+seed;if(tiles.has(key))return tiles.get(key);const r=rng(seed*31+(kind==='grain'?7:13)),N=kind==='grain'?128:64,pix=new Uint8Array(N*N);
 if(kind==='grain')for(let i=0;i<pix.length;i++)pix[i]=Math.floor(r()*256);
 else{const acc=new Float32Array(N*N);for(const [rad,amp] of [[7,1],[3,.45],[1,.18]]){let f=Float32Array.from({length:N*N},r);
   for(let pass=0;pass<6;pass++){const g=new Float32Array(N*N),hor=pass%2===0;for(let y=0;y<N;y++)for(let x=0;x<N;x++){let t=0;for(let k=-rad;k<=rad;k++)t+=hor?f[y*N+(x+k+N)%N]:f[((y+k+N)%N)*N+x];g[y*N+x]=t/(2*rad+1);}f=g;}
   let lo=Infinity,hi=-Infinity;for(const v of f){lo=Math.min(lo,v);hi=Math.max(hi,v);}for(let i=0;i<f.length;i++)acc[i]+=amp*(f[i]-lo)/(hi-lo);}
  let lo=Infinity,hi=-Infinity;for(const v of acc){lo=Math.min(lo,v);hi=Math.max(hi,v);}for(let i=0;i<pix.length;i++)pix[i]=Math.round((acc[i]-lo)/(hi-lo)*255);}
 const uri=pngGray(N,pix);if(tiles.size>24)tiles.clear();tiles.set(key,uri);return uri;}

// ── Shapes: v1's eleven plus eight; aspect [min,max] (or a function of the state) limits stretching ─────────
const pt=([x,y])=>`${n(x)} ${n(y)}`;
const poly=ps=>'M'+ps.map(pt).join('L')+'Z';
function smooth(ps){const m=ps.length;let d='M'+pt(ps[0]);for(let i=0;i<m;i++){const a=ps[(i-1+m)%m],b=ps[i],c=ps[(i+1)%m],e=ps[(i+2)%m];d+=`C${pt([b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6])} ${pt([c[0]-(e[0]-b[0])/6,c[1]-(e[1]-b[1])/6])} ${pt(c)}`;}return d+'Z';}
const circle=(cx,cy,r)=>`M${n(cx-r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx+r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx-r)} ${n(cy)}Z`;
const U=(x,y,w,h)=>(u,v)=>[x+u*w,y+v*h];
const mirror=ps=>[...ps,...ps.slice().reverse().map(([u,v])=>[1-u,v])];
// Words: one to three lines ('/'), each character from the chosen face, falling back to the other two. Faces are scaled to one cap height.
const CAP=760,FALLBACK=['mincho','gothic','serif'];
const glyphOf=(ch,face)=>{for(const f of [face,...FALLBACK]){const g=FACES[f]?.glyphs[ch];if(g)return {g,k:CAP/FACES[f].capHeight};}return null;};
export function normalizeWord(input,face='mincho'){const t=String(input??'').normalize('NFKC').replace(/[‘’]/g,"'").replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim();
 const kept=[...t].filter(ch=>ch==='/'||glyphOf(ch,face)).join('').split('/').map(s=>s.trim()).filter(Boolean).slice(0,3).join('/');return [...kept.replace(/\//g,'')].length?[...kept].slice(0,24).join(''):'';}
function wordLayout(state){const lines=(state.word||'光').split('/'),LH=CAP*1.32,items=[];let w=0;
 lines.forEach((line,r)=>{let x=0;for(const ch of line){const f=glyphOf(ch,state.face);if(!f)continue;if(f.g[0])items.push({d:f.g[0],k:f.k,x,y:r*LH});x+=f.g[1]*f.k+(/[　-鿿]/.test(ch)?60:20);}items.filter(it=>it.y===r*LH).forEach(it=>it.line=x);w=Math.max(w,x);});
 for(const it of items)it.x+=(w-it.line)/2;const top=-CAP-110,bottom=(lines.length-1)*LH+170;return {items,w:Math.max(w,1),top,h:bottom-top};}
const wordAspect=state=>{const L=wordLayout(state),a=clamp(L.w/L.h,.08,12);return [a,a];};
function wordParts(x,y,w,h,state){const L=wordLayout(state),k=w/L.w;return L.items.map(it=>({d:svgpath(it.d).scale(it.k*k).translate(x+it.x*k,y+(it.y-L.top)*k).round(2).toString()}));}
// Custom shapes: SVG path data (or bare "x,y x,y …" polygon points) in any box; it is fitted like any shape.
const PATH_CHARS=/^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/;
export function normalizePath(input){let s=String(input??'').trim().slice(0,4000);if(!s)return null;
 if(/^[\d\s.,+-]+$/.test(s)){const v=s.split(/[\s,]+/).filter(Boolean).map(Number);if(v.length<6||v.some(x=>!Number.isFinite(x)))return null;const ps=[];for(let i=0;i+1<v.length;i+=2)ps.push(`${v[i]} ${v[i+1]}`);s=`M${ps.join('L')}Z`;}
 if(!PATH_CHARS.test(s))return null;const p=svgpath(s);if(p.err)return null;const b=pathBox(p.toString());if(!b||b[2]-b[0]<1e-3||b[3]-b[1]<1e-3)return null;return p.round(2).toString();}
function pathBox(d){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;const add=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y))return;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);};
 svgpath(d).abs().unarc().unshort().iterate((seg,i,cx,cy)=>{const c=seg[0];if(c==='H')add(seg[1],cy);else if(c==='V')add(cx,seg[1]);else for(let k=1;k+1<seg.length;k+=2)add(seg[k],seg[k+1]);});return Number.isFinite(x0)?[x0,y0,x1,y1]:null;}
const pathAspect=state=>{const b=pathBox(state.path)??[0,0,1,1],a=clamp((b[2]-b[0])/(b[3]-b[1]),.15,6);return [a,a];};
function pathParts(x,y,w,h,state){const b=pathBox(state.path)??[0,0,1,1],k=w/(b[2]-b[0]);return [{d:svgpath(state.path).translate(-b[0],-b[1]).scale(k).translate(x,y).round(2).toString()}];}
export const SHAPES={...V1.SHAPES,
 moon:{aspect:[1,1],probe:[.96,.5],build:(x,y,w,h,st)=>{const R=w/2,cx=x+R,cy=y+R,p=st?.params?.phase??.5,rx=Math.abs(1-2*p)*R;return [{d:`M${n(cx)} ${n(cy-R)}A${n(R)} ${n(R)} 0 0 1 ${n(cx)} ${n(cy+R)}A${n(rx)} ${n(R)} 0 0 ${p>.5?1:0} ${n(cx)} ${n(cy-R)}Z`}];}},
 stairs:{aspect:[1.1,1.1],probe:[.85,.85],build:(x,y,w,h)=>{const p=U(x,y,w,h),k=6,ps=[p(0,1)];for(let i=0;i<k;i++){ps.push(p(i/k,1-(i+1)/k),p((i+1)/k,1-(i+1)/k));}ps.push(p(1,1));return [{d:poly(ps)}];}},
 window:{aspect:[.66,.66],probe:[.26,.2],build:(x,y,w,h)=>{const m=.06,pw=(1-3*m)/2,ph=(1-4*m)/3,out=[];for(let r=0;r<3;r++)for(let c=0;c<2;c++){const p=U(x,y,w,h),a=p(m+c*(pw+m),m+r*(ph+m)),b=p(m+c*(pw+m)+pw,m+r*(ph+m)+ph);out.push({d:`M${n(a[0])} ${n(a[1])}H${n(b[0])}V${n(b[1])}H${n(a[0])}Z`});}return out;}},
 tree:{aspect:[.74,.74],probe:[.5,.32],build:(x,y,w,h)=>{const p=U(x,y,w,h),c=(u,v,r)=>{const [cx,cy]=p(u,v);return {d:circle(cx,cy,r*w)};};return [{d:poly([p(.45,.55),p(.55,.55),p(.58,1),p(.42,1)])},c(.5,.27,.27),c(.27,.42,.22),c(.73,.42,.22),c(.5,.5,.24),c(.34,.2,.18),c(.66,.22,.18)];}},
 mountain:{aspect:[1.7,1.7],probe:[.5,.75],build:(x,y,w,h)=>{const p=U(x,y,w,h);return [{d:poly([p(0,1),p(0,.74),p(.16,.5),p(.27,.6),p(.47,.1),p(.6,.32),p(.7,.22),p(.86,.5),p(1,.62),p(1,1)])}];}},
 standing:{aspect:[.4,.4],probe:[.5,.55],build:(x,y,w,h)=>{const p=U(x,y,w,h),[hx,hy]=p(.5,.075);return [{d:circle(hx,hy,.19*w)},{d:smooth(mirror([[.12,1],[.2,.72],[.23,.42],[.27,.24],[.38,.16],[.47,.15]]).map(([u,v])=>p(u,v)))}];}},
 word:{aspect:wordAspect,probe:null,build:wordParts},
 custom:{aspect:pathAspect,probe:null,build:pathParts}
};
function fit([x,y,w,h],[a0,a1]){const a=clamp(w/h,a0,a1);let fw=w,fh=h;if(a<w/h)fw=h*a;else fh=w/a;return [x+(w-fw)/2,y+(h-fh)/2,fw,fh];}

// ── Layouts: aperture boxes in the current drawing size (margins scale with S; S = 1 on the poster) ──
function boxesIn(state){const p=state.params,L=state.layout,k=p.count,s=p.size,ins=p.inset;
 const A={centred:[56*S,104*S,W-56*S,H-84*S],stacked:[56*S,104*S,W-56*S,H-84*S],grid:[56*S,104*S,W-56*S,H-84*S],beam:[0,-30*S,W,H+30*S],bleed:[ins+4*S,ins+4*S,W-ins-4*S,H-ins-4*S],band:[44*S,44*S,W-44*S,Math.round(H*.8)-24*S]}[L];
 const cx=(A[0]+A[2])/2+p.x*W,cy=(A[1]+A[3])/2+p.y*H,f=L==='bleed'?1:.86,out=[];let bw=(A[2]-A[0])*f*s,bh=(A[3]-A[1])*f*s;
 if(L==='beam'){bw=W*.16*s;bh=A[3]-A[1];for(let i=0;i<k;i++)out.push([cx+(i-(k-1)/2)*bw*1.5*p.spacing-bw/2,cy-bh/2,bw,bh]);return out;}
 if(L==='stacked'){bw*=.86;const h=bh*.72/(1+(k-1)*p.spacing*.72);const span=h*(1+(k-1)*p.spacing);for(let i=0;i<k;i++)out.push([cx-bw/2,cy-span/2+i*h*p.spacing,bw,h]);return out;}
 // Grid: rows and columns from the count; spacing below 1 lets neighbours overlap so their glows merge.
 if(L==='grid'){const cols=Math.ceil(Math.sqrt(k)),rows=Math.ceil(k/cols),cw=bw/cols,ch=bh/rows,g=Math.min(1.8,.9/p.spacing);for(let i=0;i<k;i++){const c=i%cols,r=Math.floor(i/cols),inRow=Math.min(cols,k-r*cols),ox=(cols-inRow)*cw/2;out.push([cx-bw/2+ox+c*cw+cw*(1-g)/2,cy-bh/2+r*ch+ch*(1-g)/2,cw*g,ch*g]);}return out;}
 const w=bw/(1+(k-1)*p.spacing);for(let i=0;i<k;i++)out.push([cx-bw/2+i*w*p.spacing,cy-bh/2,w,bh]);return out;}
const aspectOf=(sh,state)=>typeof sh.aspect==='function'?sh.aspect(state):sh.aspect;
function aperturesIn(state){const p=state.params,Sh=SHAPES[state.shape],rot=p.rotate+(state.mode==='beam'?90-p.angle:0),asp=aspectOf(Sh,state);
 return boxesIn(state).map(b=>{const f=fit(b,asp),pr=Sh.probe;return {box:b,fit:f,parts:Sh.build(...f,state),c:[f[0]+f[2]/2,f[1]+f[3]/2],rot,probe:pr?[f[0]+pr[0]*f[2],f[1]+pr[1]*f[3]]:null};});}
// Exported helpers measure in the state's own format; inside a render the current (panel) size is used.
const inFormat=(state,fn)=>{const keep=[W,H];setDims(...dims(state));try{return fn();}finally{setDims(...keep);}};
export const layoutBoxes=state=>inFormat(state,()=>boxesIn(state)),apertures=state=>inFormat(state,()=>aperturesIn(state));
const rotT=a=>a.rot?` transform="rotate(${n(a.rot)} ${pt(a.c)})"`:'';
const grey=v=>{const h=Math.round(clamp(v)*255).toString(16).padStart(2,'0');return '#'+h+h+h;};
// Aerial depth: the first apertures drawn are the farthest (top of a stack), so they fade toward the paper.
const far=(p,i,k)=>p.depth>0&&k>1?p.depth*(k-1-i)/(k-1):0;
const dirOf=deg=>[Math.cos(deg*Math.PI/180),-Math.sin(deg*Math.PI/180)];

function strands(state,a,i){const p=state.params,r=rng(p.seed*97+i*13+3),out=[];if(p.fray<=0)return out;const [x,y,w,h]=a.fit;
 if(state.mode==='beam'){const along=w<h,len=along?h:w,th=Math.min(Math.min(w,h)*.45,Math.max(w,h)*.05);for(let k=0,m=Math.round(16+p.fray*90);k<m;k++){const o=(r()*2-1)*th*.95,s=r()*len*.7,e=s+len*(.25+r()*.75),g=.6+r()*.4,sw=1+r()**2*4.5;
  out.push(along?{a:[x+w/2+o,y+s],b:[x+w/2+o,y+Math.min(len,e)],g,sw}:{a:[x+s,y+h/2+o],b:[x+Math.min(len,e),y+h/2+o],g,sw});}return out;}
 const [dx,dy]=dirOf(p.angle+180),ext=Math.abs(dx)*w/2+Math.abs(dy)*h/2,side=Math.abs(dy)*w/2+Math.abs(dx)*h/2;
 for(let k=0,m=Math.round(p.fray*110);k<m;k++){const t=(r()*2-1)*.86,base=[a.c[0]+dx*ext*.86-dy*side*t,a.c[1]+dy*ext*.86+dx*side*t],L=(.04+r()**1.6*.24)*Math.max(w,h)*(1-.5*Math.abs(t));
  out.push({a:base,b:[base[0]+dx*L,base[1]+dy*L],g:.6+r()*.4,sw:.6+r()*2.2});}return out;}
const strandSVG=(ss,col)=>ss.map(s=>`<path d="M${pt(s.a)}L${pt(s.b)}" stroke="${col??grey(s.g)}" stroke-width="${n(s.sw)}" stroke-linecap="round"/>`).join('');
// Blinds: dark slats across the fitted box, drawn in the mask so the falloff softens them into shadow bands.
const blindSVG=(p,a)=>{if(!(p.blinds>0))return '';const [x,y,w,h]=a.fit,pitch=h/p.blinds,bar=pitch*(1-p.slat);return Array.from({length:p.blinds},(_,k)=>`<rect x="${n(x-w*.1)}" y="${n(y+k*pitch+(pitch-bar)/2)}" width="${n(w*1.2)}" height="${n(bar)}" fill="#000"/>`).join('');};

// The mask (v1 plus blinds): everything the falloff is built from, white on black.
function maskGroup(state,aps,uid,{crisp=false}={}){const p=state.params,beam=state.mode==='beam',[ox,oy]=dirOf(p.angle),m=30;let s=`<rect x="${-m}" y="${-m}" width="${W+2*m}" height="${H+2*m}" fill="#000"/>`;
 const cast=(p.offset||0)+(state.mode==='shadow'?p.width*.8:0),shift=!crisp&&cast?` transform="translate(${n(ox*cast)} ${n(oy*cast)})"`:'';s+=`<g${shift}>`;
 aps.forEach((a,i)=>{const body=a.parts.filter(q=>!q.spill),paths=(q,fill)=>q.map(x=>`<path d="${x.d}" fill="${fill??grey(x.shade??1)}"/>`).join('');
  if(!crisp&&p.smear>0){const N=12,len=p.smear*a.fit[3]*.75;for(let k=N;k>=1;k--){const t=k/N,sc=1+.32*p.smear*t;s+=`<g transform="translate(${n(ox*len*t)} ${n(oy*len*t)}) translate(${pt(a.c)}) scale(${n(sc*1000)/1000}) translate(${n(-a.c[0])} ${n(-a.c[1])})"><g${rotT(a)}>${paths(body,grey(.92*(1-t)**1.25))}</g></g>`;}}
  const lay=Array.from({length:p.layers-1},(_,k)=>{const sc=1-.17*(k+1);return `<g transform="translate(${pt(a.c)}) scale(${n(sc)}) translate(${n(-a.c[0])} ${n(-a.c[1])})">${paths(body,(k%2)?'#fff':'#000')}</g>`;}).join('');
  const fd=far(p,i,aps.length),base=beam?paths(body,grey((1-.55*p.fray)*(1-.55*fd))):fd?a.parts.map(x=>`<path d="${x.d}" fill="${grey((x.shade??1)*(1-.55*fd))}"/>`).join(''):paths(a.parts);
  let streak='';if(beam&&(p.fray>0||(!crisp&&p.haze>0))){streak=`<g clip-path="url(#cl${uid}-${i})">${strandSVG(strands(state,a,i))}${!crisp&&p.haze>0?`<rect x="${-m}" y="${-m}" width="${W+2*m}" height="${H+2*m}" fill="url(#hz${p.seed})" opacity="${n(p.haze*.5)}" style="mix-blend-mode:multiply"/>`:''}</g>`;}
  s+=`<g${rotT(a)}>${base}${lay}${blindSVG(p,a)}${streak}${beam?'':strandSVG(strands(state,a,i),'#fff')}</g>`;});
 s+='</g>';
 if(!crisp&&p.haze>0&&!beam)s+=`<rect x="${-m}" y="${-m}" width="${W+2*m}" height="${H+2*m}" fill="url(#hz${p.seed})" opacity="${n(p.haze*.45)}"/>`;
 return s;}
const clipDefs=(state,aps,uid)=>state.mode==='beam'?aps.map((a,i)=>`<clipPath id="cl${uid}-${i}">${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}"/>`).join('')}</clipPath>`).join(''):'';

export const profile=V1.profile;
const TABLE=64;
// The v1 falloff filter, plus: invert (cut apertures: the shape becomes the dark hole and beyond the poster counts as light)
// and steps (a discrete 256-entry table quantised to n bands: screenprint banding).
function falloffBody(p,{invert=false}={}){const m=20,[dx,dy]=dirOf(p.angle),src=invert?'src':'SourceGraphic';
 return `${invert?'<feComponentTransfer in="SourceGraphic" result="src"><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer>':''}<feFlood flood-color="${invert?'#fff':'#000'}" result="k"/><feGaussianBlur in="${src}" stdDeviation="${n(p.width)}" result="a"/><feMerge result="a1"><feMergeNode in="k"/><feMergeNode in="a"/></feMerge><feGaussianBlur in="${src}" stdDeviation="${n(p.width*3)}" result="b0"/><feOffset in="b0" dx="${n(dx*p.width*.8)}" dy="${n(dy*p.width*.8)}" result="b"/><feMerge result="b1"><feMergeNode in="k"/><feMergeNode in="b"/></feMerge><feComposite in="a1" in2="b1" operator="arithmetic" k2="${n(1-p.bloom)}" k3="${n(p.bloom)}" k4="0" result="f"/>`;}
const region=(id,body)=>`<filter id="${id}" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${n(W+40)}" height="${n(H+40)}" color-interpolation-filters="sRGB">${body}</filter>`;
const quant=(t,k)=>k?Math.min(k-1,Math.floor(t*k))/(k-1):t;
function falloffFilter(id,p,map,mode,{invert=false,steps=0}={}){const K=steps?256:TABLE,vals=Array.from({length:K},(_,i)=>map(quant(profile(i/(K-1),p,mode),steps))),ch=k=>vals.map(v=>n(v[k]*1e4)/1e4).join(' '),type=steps?'discrete':'table';
 return region(id,`${falloffBody(p,{invert})}<feComponentTransfer in="f"><feFuncR type="${type}" tableValues="${ch(0)}"/><feFuncG type="${type}" tableValues="${ch(1)}"/><feFuncB type="${type}" tableValues="${ch(2)}"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer>`);}
// Halftone: the field becomes ink coverage, a dot screen (an feImage of a rotated radial-gradient pattern) is added,
// and a steep table thresholds the sum — ink where coverage exceeds the distance from the dot centre.
const halftoneDefs=(uid,cell)=>`<radialGradient id="hg${uid}" cx=".5" cy=".5" r=".7071"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><pattern id="hd${uid}" patternUnits="userSpaceOnUse" width="${cell}" height="${cell}" patternTransform="rotate(45)"><rect width="${cell}" height="${cell}" fill="url(#hg${uid})"/></pattern><rect id="hr${uid}" x="-20" y="-20" width="${n(W+40)}" height="${n(H+40)}" fill="url(#hd${uid})"/>`;
function halftoneFilter(id,uid,p,mode,cov,[paper,ink],{invert=false}={}){const c=Array.from({length:TABLE},(_,i)=>n(clamp(cov(profile(i/(TABLE-1),p,mode)))*1e4)/1e4).join(' '),P=hexRGB(paper),I=hexRGB(ink),out=k=>[P[k],...Array(31).fill(I[k])].map(v=>n(v*1e4)/1e4).join(' ');
 return region(id,`${falloffBody(p,{invert})}<feComponentTransfer in="f" result="c"><feFuncR type="table" tableValues="${c}"/><feFuncG type="table" tableValues="${c}"/><feFuncB type="table" tableValues="${c}"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer><feImage href="#hr${uid}" x="-20" y="-20" width="${n(W+40)}" height="${n(H+40)}" preserveAspectRatio="none" result="d"/><feComposite in="c" in2="d" operator="arithmetic" k2="1" k3="1" k4="-1" result="t"/><feComponentTransfer in="t"><feFuncR type="table" tableValues="${out(0)}"/><feFuncG type="table" tableValues="${out(1)}"/><feFuncB type="table" tableValues="${out(2)}"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer>`);}
const blurFilter=(id,sd,box=[0,0,W,H],kind='opaque',flood='#000')=>`<filter id="${id}" filterUnits="userSpaceOnUse" x="${n(box[0])}" y="${n(box[1])}" width="${n(box[2])}" height="${n(box[3])}" color-interpolation-filters="sRGB">${kind==='opaque'?`<feFlood flood-color="${flood}" result="k"/>`:''}<feGaussianBlur in="SourceGraphic" stdDeviation="${n(sd)}" result="b"/>${{glow:'<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>',opaque:'<feMerge><feMergeNode in="k"/><feMergeNode in="b"/></feMerge>',soft:''}[kind]}</filter>`;
// Paper and ink for single-ink finishes: the lighter end of the ramp is the paper.
function inks(ramp){const a=hexOf(rampAt(ramp,0)),b=hexOf(rampAt(ramp,1)),paperFirst=lab(a)[0]>=lab(b)[0];return {paper:paperFirst?a:b,ink:paperFirst?b:a,mid:hexOf(rampAt(ramp,.5)),dist:t=>paperFirst?t:1-t};}

function lamps(state,box,turn=0){const p=state.params,[x,y,w,h]=box,c=[x+w/2,y+h/2],N=12,mn=Math.min(w,h),out=[];
 for(let k=0;k<N;k++){const t=k/N,ang=(p.angle+turn-360*t)*Math.PI/180;out.push(`<ellipse cx="${n(c[0]+Math.cos(ang)*w*.44)}" cy="${n(c[1]-Math.sin(ang)*h*.44)}" rx="${n(w*.24)}" ry="${n(h*.24)}" fill="${hexOf(rampAt(state.ramp,t,true))}"/>`);}
 const cr=.2*mn*(1+p.balance);if(cr>1)out.push(`<ellipse cx="${n(c[0])}" cy="${n(c[1]+h*.06)}" rx="${n(cr*1.15)}" ry="${n(cr)}" fill="${mix('#ffffff',lightest(state.ramp),.25)}" opacity=".92"/>`);
 return out.join('');}
const meanRamp=ramp=>{const s=[0,0,0];for(let i=0;i<24;i++)rampAt(ramp,i/24,true).forEach((v,k)=>s[k]+=v/24);return hexOf(s);};
const lampBlur=(state,box)=>.13*Math.min(box[2],box[3])*(.7+.6*state.params.bloom);
function groundSVG(state,uid,defs){const [g,fr]=state.colors,p=state.params;
 if(state.ground==='gradient'){const [dx,dy]=dirOf(p.angle),r=Math.abs(dx)*W/2+Math.abs(dy)*H/2;defs.push(`<linearGradient id="gg${uid}" gradientUnits="userSpaceOnUse" x1="${n(W/2-dx*r)}" y1="${n(H/2-dy*r)}" x2="${n(W/2+dx*r)}" y2="${n(H/2+dy*r)}"><stop offset="0" stop-color="${fr}"/><stop offset=".55" stop-color="${mix(fr,g,.75)}"/><stop offset="1" stop-color="${g}"/></linearGradient>`);return `<rect width="${n(W)}" height="${n(H)}" fill="url(#gg${uid})"/>`;}
 if(state.ground==='counter'){const box=[-W*.1,-H*.1,W*1.2,H*1.2];defs.push(blurFilter(`cf${uid}`,lampBlur(state,[0,0,W,H])*1.2,[0,0,W,H],'opaque',meanRamp(state.ramp)));return `<g filter="url(#cf${uid})"><g clip-path="url(#rp${uid})"><rect width="${n(W)}" height="${n(H)}" fill="${meanRamp(state.ramp)}"/>${lamps(state,box,180)}</g></g>`;}
 return `<rect width="${n(W)}" height="${n(H)}" fill="${g}"/>`;}
function rainSVG(state){const p=state.params,r=rng(p.seed*5+11),m=Math.round(p.fray*150);if(state.mode!=='beam'||!m)return '';let s='';
 for(let k=0;k<m;k++){const x=r()*W,y0=r()*H*.9,len=40+r()*H*.5;s+=`<path d="M${n(x)} ${n(y0)}V${n(y0+len)}" stroke="${state.colors[1]}" stroke-opacity="${n(.05+r()*.12)}" stroke-width="${n(.6+r()*1.6)}"/>`;}
 return `<g>${s}</g>`;}
function coreSVG(state,aps,uid,defs){if(state.core==='none')return '';const col=state.colors[2];
 if(state.core==='line'){const outl=aps.map(a=>`<g${rotT(a)}>${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}"/>`).join('')}</g>`).join('');
  defs.push(blurFilter(`ln${uid}`,4,[-20,-20,W+40,H+40],'glow'),`<mask id="lm${uid}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${n(W+40)}" height="${n(H+40)}"><rect x="-20" y="-20" width="${n(W+40)}" height="${n(H+40)}" fill="#fff"/><g fill="#000">${outl}</g></mask>`);
  return `<g mask="url(#lm${uid})"><g filter="url(#ln${uid})" fill="none" stroke="${col}" stroke-width="6.4" stroke-linejoin="round"><g clip-path="url(#rg${uid})">${outl}</g></g></g>`;}
 return `<g>${aps.map((a,i)=>`<g${rotT(a)}>${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}" fill="${col}"${q.shade?` fill-opacity="${q.shade}"`:''}/>`).join('')}${state.mode==='beam'?'':strandSVG(strands(state,a,i),col)}</g>`).join('')}</g>`;}
// Extra lights: the same mask lit from angle ± spread, each field tinted by its light colour and mixed in — screen over a
// dark ground (light adds), multiply on paper (each light leaves its own coloured shadow; where they overlap, darker).
function lightsSVG(state,aps,uid,defs){const p=state.params;if(p.lights<2||!has(state,'mode',['halo','shadow']))return '';
 const dark=state.mode==='halo'&&lum(hexOf(rampAt(state.ramp,0)))<.3,blend=dark?'screen':'multiply',neutral=dark?'#000000':'#ffffff';let s='';
 for(let k=1;k<p.lights;k++){const sk={...state,params:{...p,angle:(p.angle+(k===1?1:-1)*p.spread+360)%360,offset:p.offset+p.width*(state.mode==='shadow'?.6:2.6)}},col=state.lightColors[k-1];
  defs.push(falloffFilter(`lt${k}${uid}`,sk.params,v=>hexRGB(mix(neutral,col,v*.9)),state.mode,{invert:state.aperture==='cut'}));
  s+=`<g style="mix-blend-mode:${blend}"><g filter="url(#lt${k}${uid})"><g clip-path="url(#rg${uid})">${maskGroup(sk,aps,uid)}</g></g></g>`;}
 return s;}
// Rim light: the object in a pale rim colour, then the object again, shifted away from the light and clipped to itself.
function rimSVG(state,aps,uid,defs){const p=state.params;if(!(p.rim>0)||!(state.mode==='shadow'||state.core==='solid'))return '';
 const rw=p.rim*18,[dx,dy]=dirOf(p.angle),base=state.core==='solid'?state.colors[2]:hexOf(rampAt(state.ramp,1)),rimC=mix(lightest(state.ramp),'#ffffff',.25);
 const shapes=fill=>aps.map(a=>a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}"${a.rot?` transform="rotate(${n(a.rot)} ${pt(a.c)})"`:''}${fill?` fill="${fill}"`:''}/>`).join('')).join('');
 defs.push(`<clipPath id="rc${uid}">${shapes('')}</clipPath>`);
 return `<g>${shapes(rimC)}</g><g clip-path="url(#rc${uid})"><g transform="translate(${n(dx*rw)} ${n(dy*rw)})">${shapes(base)}</g></g>`;}
function sparkSVG(state,aps,uid,defs){const p=state.params,k=p.sparkles;if(!k)return '';const r=rng(p.seed*3+1),lite=lightest(state.ramp),ins=p.inset+10,pts=[];
 const inBox=()=>{const a=aps[Math.floor(r()*aps.length)].fit;return [a[0]+a[2]*(.08+r()*.84),a[1]+a[3]*(.06+r()*.88)];},any=()=>[ins+r()*(W-2*ins),ins+r()*(H-2*ins)];
 if(state.sparkle==='petals'){const pal=[...state.ramp.map(s=>s[0]),'#e8433a','#f2c14e','#5a8a4a','#d07aa0','#2a2a2a'];defs.push(blurFilter(`ps${uid}`,2.4,[-10,-10,W+20,H+20],'soft'));
  const sh=[];for(let i=0;i<k;i++){const [x,y]=inBox(),s=3+r()*6.5,a=n(r()*360),c=pal[Math.floor(r()*pal.length)],e=`<ellipse cx="0" cy="0" rx="${n(s*1.7)}" ry="${n(s*.7)}"/>`;
   sh.push(`<g transform="translate(${n(x+2)} ${n(y+3)}) rotate(${a})">${e}</g>`);pts.push(`<g transform="translate(${n(x)} ${n(y)}) rotate(${a})"><g fill="${c}">${e}</g><path d="M${n(s*1.6)} 0l${n(s*1.1)} ${n(-s*.4)}" stroke="${c}" stroke-width=".8"/></g>`);}
  return `<g fill="#000" opacity=".22" filter="url(#ps${uid})"><g clip-path="url(#rg${uid})">${sh.join('')}</g></g><g>${pts.join('')}</g>`;}
 // Dust: motes and a few out-of-focus discs floating in the light of the apertures.
 if(state.sparkle==='dust'){const col=mix(lite,'#ffffff',.45),bk=[];defs.push(blurFilter(`sp${uid}`,1.2,[-20,-20,W+40,H+40],'glow'),blurFilter(`bk${uid}`,3.4,[-20,-20,W+40,H+40],'soft'));
  for(let i=0;i<k;i++){const [x,y]=inBox();if(r()<.14)bk.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(3+r()*7)}" opacity="${n(.1+r()*.14)}"/>`);else pts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(.5+r()**3*2.2)}" opacity="${n(.3+r()*.6)}"/>`);}
  return `<g fill="${col}" filter="url(#bk${uid})"><g clip-path="url(#rg${uid})">${bk.join('')}</g></g><g fill="${col}" filter="url(#sp${uid})"><g clip-path="url(#rg${uid})">${pts.join('')}</g></g>`;}
 defs.push(blurFilter(`sp${uid}`,state.sparkle==='scribbles'?6:2.6,[-20,-20,W+40,H+40],'glow'));
 if(state.sparkle==='scribbles'){for(let i=0,m=Math.max(1,Math.round(k/8));i<m;i++){const a=aps[i%aps.length].fit,x0=a[0]-a[2]*.15+r()*a[2]*1.3,y0=a[1]-a[3]*.12+r()*a[3]*.4,len=a[3]*(.35+r()*.6),q=[];let x=x0;
   for(let y=y0,j=0;y<y0+len;y+=24+r()*14,j++){x+=(j%2?1:-1)*(7+r()*16)+(r()-.5)*6;q.push([x,y]);}if(q.length<3)continue;
   let d='M'+pt(q[0]);for(let j=1;j<q.length-1;j++)d+=`Q${pt(q[j])} ${pt([(q[j][0]+q[j+1][0])/2,(q[j][1]+q[j+1][1])/2])}`;pts.push(`<path d="${d}" fill="none" stroke="${mix(lite,'#ffffff',.65)}" stroke-width="${n(5+r()*4)}" stroke-linecap="round" opacity="${n(.55+r()*.3)}"/>`);}
  return `<g filter="url(#sp${uid})"><g clip-path="url(#rg${uid})">${pts.join('')}</g></g>`;}
 for(let i=0;i<k;i++){const [x,y]=any(),star=state.sparkle==='stars'&&r()<.3,o=n(.55+r()*.45);
  if(star){const s=5+r()*9;pts.push(`<path d="M${n(x)} ${n(y-s)}Q${n(x)} ${n(y)} ${n(x+s*.7)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y+s)}Q${n(x)} ${n(y)} ${n(x-s*.7)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y-s)}Z" fill="${lite}" opacity="${o}"/>`);}
  else pts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(.7+r()**3*2.3)}" fill="${lite}" opacity="${o}"/>`);}
 return `<g filter="url(#sp${uid})"><g clip-path="url(#rg${uid})">${pts.join('')}</g></g>`;}

// ── Copy: v1's layout-driven placement ('auto', scaled with S) and three lockups; sans or serif ──
const FONT=`'Helvetica Neue',Helvetica,Arial,'Hiragino Sans','Hiragino Kaku Gothic ProN',sans-serif`,FONT_JA=`'Hiragino Sans','Hiragino Kaku Gothic ProN','Helvetica Neue',sans-serif`;
const SERIF=`Georgia,'Times New Roman','Hiragino Mincho ProN',serif`,SERIF_JA=`'Hiragino Mincho ProN',Georgia,serif`;
const isJA=t=>/[　-鿿＀-￯]/.test(t);
const esc=s=>String(s).replace(/[<>"]/g,'').replace(/&/g,'&amp;');
const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((u,v)=>v-u);return (x+.05)/(y+.05);};
function copySVG(state){const p=state.params,ink=state.colors[3],fr=state.colors[1],ins=p.inset,L=state.series!=='none'?'centred':state.layout,serif=state.type==='serif',base=serif?SERIF:FONT,
 onFrame=contrast(ink,fr)>=3?ink:lum(fr)>.3?'#111111':'#f4f1ea',F=t=>t.replace('<text ',`<text fill="${onFrame}" `),lines=state.title.split('/').map(s=>s.trim()).filter(Boolean),info=state.info.replace(/[<>"]/g,'');let s='';
 // Serif titles are set lighter (regular weight, no tightening); Japanese copy names its Hiragino face first.
 const T=(x,y,size,txt,anchor='start',weight=700,ls=0,tr='')=>{const w=serif&&weight>=700?400:weight,l=serif?0:ls,fam=isJA(txt)?(serif?SERIF_JA:FONT_JA):(serif?'':'');return `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" font-weight="${w}" text-anchor="${anchor}"${l?` letter-spacing="${l}"`:''}${fam?` font-family="${fam}"`:''}${tr?` transform="${tr}"`:''}>${esc(txt)}</text>`;};
 // Auto places copy by layout, as v1 did; over a series it takes v1's centred placement (title top left, date line bottom left).
 const lock=state.lockup,m=44*S+ins,bandTop=Math.round(H*.8);
 if(lock==='foot'){const size=Math.min(46*S,(W-2*m)*.62/Math.max(1,...lines.map(l=>[...l].length*.62))),base0=H-m-14*S;
  lines.forEach((l,i)=>{s+=T(m,base0-(lines.length-1-i)*size*1.06,size,l,'start',700,-.4);});
  s+=`<path d="M${n(m)} ${n(base0-lines.length*size*1.06-18*S)}H${n(W-m)}" stroke="${ink}" stroke-width="${n(.9*S)}"/>`;
  info.split('/').map(x=>x.trim()).filter(Boolean).slice(0,2).forEach((l,i,a)=>{s+=T(W-m,base0-(a.length-1-i)*19*S,13.5*S,l,'end',400,.3);});}
 else if(lock==='centre'){const size=Math.min(42*S,(W-2*m)/Math.max(1,...lines.map(l=>[...l].length*.66))),y0=H-m-58*S;
  lines.forEach((l,i)=>{s+=T(W/2,y0-(lines.length-1-i)*size*1.08,size,l,'middle',700,1.5);});
  if(info)s+=T(W/2,H-m-24*S,13.5*S,info.split('/').map(x=>x.trim()).filter(Boolean).slice(0,2).join('  ·  '),'middle',400,.6);}
 else if(lock==='spine'){const txt=lines.join(' '),size=Math.min(44*S,(H-2*m)/Math.max(1,[...txt].length*.66));
  s+=T(0,0,size,txt,'start',700,1,`translate(${n(m+size*.8)} ${n(H-m)}) rotate(-90)`);
  info.split('/').map(x=>x.trim()).filter(Boolean).slice(0,2).forEach((l,i,a)=>{s+=T(W-m,H-m-(a.length-1-i)*19*S,13.5*S,l,'end',400,.3);});}
 else{
  if(state.copy==='stacked'){const chars=[...lines.join('')].filter(c=>c!==' ');const size=Math.min(40*S,(L==='band'?bandTop-120*S:H-200*S)/Math.max(1,chars.length)/1.1);chars.forEach((c,i)=>{s+=T(W-50*S-ins,78*S+ins+size*(1+i*1.1),size,c,'middle');});}
  else if(L==='band'){const size=Math.min(44*S,560*S/Math.max(...lines.map(l=>[...l].length),1)*1.15);lines.forEach((l,i)=>{s+=F(T(W/2,bandTop+(H-bandTop)*.42+(i-(lines.length-1)/2)*size*1.02,size,l,'middle',700,-.5));});}
  else if(L==='beam')lines.forEach((l,i)=>{s+=T(40*S+ins,96*S+ins+i*52*S,54*S,l,'start',800,-1);});
  else if(L==='bleed'&&ins>=20*S){const size=Math.min(ins*.62,19*S);s+=F(T(W/2,H-ins/2+size*.36,size,lines.join(' '),'middle',700,.6));}
  else lines.forEach((l,i)=>{s+=T(44*S+ins,80*S+ins+i*38*S,36*S,l,'start',700,-.5);});
  if(info){const lines2=info.split('/').map(x=>x.trim()).filter(Boolean).slice(0,2);
   if(L==='band')s+=F(state.copy==='stacked'?T(W/2,bandTop+(H-bandTop)*.55,17*S,lines2.join('  ·  '),'middle',700,.4):T(W/2,H-24*S-ins,12.5*S,lines2.join('  ·  '),'middle',400,.5));
   else if(L==='bleed'&&ins>=20*S)s+=F(T(ins+8*S,H-ins/2+4*S,10*S,lines2[0],'start',400,.4));
   else if(L==='beam')lines2.forEach((l,i)=>{s+=T(42*S+ins,96*S+ins+lines.length*52*S+i*21*S,17*S,l,'start',700);});
   else lines2.forEach((l,i)=>{s+=T(44*S+ins,(L==='band'?bandTop-34*S:H-50*S-ins)+i*19*S,14*S,l,'start',400,.4);});}}
 return s?`<g font-family="${base}" fill="${ink}">${s}</g>`:'';}

// ── State: v1 rules upgrade with every new feature off; states v1 can express are drawn by the frozen v1 engine ──
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
const clampNum=(v,c,d)=>Number.isFinite(+v)&&v!==null&&v!==''&&typeof v!=='boolean'?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):d;
const isHex=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
const clip=(v,d,max)=>(typeof v==='string'?v:d).replace(/[<>"]/g,'').slice(0,max);
export function resolve(input={}){input=input&&typeof input==='object'?input:{};
 // A version 1 rule resolves exactly as v1 did, then gains the v2 fields at their neutral values.
 if(input.engine===V1_ENGINE){const v=V1.resolve(input),f=FAMILIES.find(x=>x.id===v.family);return finish({...v,engine:ENGINE,...OPT2,word:f.word,path:normalizePath(f.path),lightColors:[...f.lightColors],params:{...v.params,...P2}});}
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS)params[c.key]=clampNum(input.params?.[c.key],c,set.params[c.key]);
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k];
 const colors=Array.isArray(input.colors)&&input.colors.length===4&&input.colors.every(isHex)?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const ramp=Array.isArray(input.ramp)&&input.ramp.length>=2&&input.ramp.length<=5&&input.ramp.every(s=>Array.isArray(s)&&isHex(s[0])&&Number.isFinite(+s[1]))?input.ramp.map(([c,q])=>[c.toLowerCase(),n(clamp(+q)*1000)/1000]):family.ramp.map(s=>[...s]);
 const lightColors=Array.isArray(input.lightColors)&&input.lightColors.length===2&&input.lightColors.every(isHex)?input.lightColors.map(c=>c.toLowerCase()):[...family.lightColors];
 const face=pick('face'),word=typeof input.word==='string'?normalizeWord(input.word,face)||family.word:family.word,path=normalizePath(typeof input.path==='string'?input.path:family.path)??normalizePath(family.path);
 return finish({engine:ENGINE,family:family.id,stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,mode:pick('mode'),shape:pick('shape'),layout:pick('layout'),core:pick('core'),sparkle:pick('sparkle'),ground:pick('ground'),copy:pick('copy'),
  aperture:pick('aperture'),finish:pick('finish'),format:pick('format'),series:pick('series'),lockup:pick('lockup'),type:pick('type'),face,
  title:clip(input.title,family.title,40),info:clip(input.info,family.info,90),word,path,params,colors,ramp,lightColors});}
// One key order for every state, so saved rules and uids are stable.
const finish=s=>({engine:s.engine,family:s.family,stage:s.stage,mode:s.mode,shape:s.shape,layout:s.layout,core:s.core,sparkle:s.sparkle,ground:s.ground,copy:s.copy,aperture:s.aperture,finish:s.finish,format:s.format,series:s.series,lockup:s.lockup,type:s.type,face:s.face,title:s.title,info:s.info,word:s.word,path:s.path,params:s.params,colors:s.colors,ramp:s.ramp,lightColors:s.lightColors});
// The v1 rule a state corresponds to, if v1 can draw it exactly.
export function v1View(s){return {engine:V1_ENGINE,family:s.family,stage:s.stage,mode:s.mode,shape:s.shape,layout:s.layout,core:s.core,sparkle:s.sparkle,ground:s.ground,copy:s.copy,title:s.title,info:s.info,params:Object.fromEntries(V1.CONTROLS.map(c=>[c.key,s.params[c.key]])),colors:s.colors,ramp:s.ramp};}
export function isV1(s){if(!V1.FAMILIES.some(f=>f.id===s.family))return false;for(const [k,v] of Object.entries(OPT2))if(k!=='face'&&s[k]!==v)return false;
 if(s.params.blinds!==0||s.params.depth!==0||s.params.lights!==1||s.params.rim!==0||s.params.paper!==0)return false;for(const k of Object.keys(V1.OPTIONS))if(!V1.OPTIONS[k].includes(s[k]))return false;
 const view=v1View(s);return JSON.stringify(V1.resolve(view))===JSON.stringify(view);}

// Series: the poster split into panels, each the same rule under one change — time of day, a turning light, moon phases or shapes.
const SERIES_SHAPES=['rect','arch','circle','door','moon','window','tree','stairs','vase'];
function panelState(state,i,k){const p=state.params,t=k>1?i/(k-1):0,s={...state,series:'none',title:'',info:'',params:{...p,inset:0}};
 if(state.series==='turn')s.params.angle=n((p.angle+360*i/k)%360);
 if(state.series==='phase'){s.shape='moon';s.params.phase=n(.12+.88*t);}
 if(state.series==='shapes')s.shape=SERIES_SHAPES[i%SERIES_SHAPES.length];
 // Day: the light sweeps from low in the east to low in the west; morning and evening panels sink toward dusk blue.
 if(state.series==='day'){s.params.angle=n(165-150*t);const dusk=(1-Math.sin(Math.PI*(.1+.8*t)))*.75;s.ramp=state.ramp.map(([c,q])=>[mixLab(c,'#1e2638',dusk*(1-q*.35)),q]);}
 return s;}
function seriesGrid(state){const k=state.params.panels,spine=state.lockup==='spine',auto=state.lockup==='auto',copy=!!(state.title||state.info),m=40*S+state.params.inset,top=auto&&copy?m+86*S:m,left=spine?m+70*S:m,bottom=copy&&!spine?H-(auto?70:150)*S-state.params.inset:H-m,right=W-m,g=14*S,aw=right-left,ah=bottom-top;let best;
 for(let c=1;c<=k;c++){const r=Math.ceil(k/c),cw=(aw-(c-1)*g)/c,ch=(ah-(r-1)*g)/r,score=Math.abs(Math.log(cw/ch/.8))+.25*(c*r-k);if(!best||score<best.score)best={c,r,cw,ch,score};}
 const {c,r,cw,ch}=best;return Array.from({length:k},(_,i)=>{const col=i%c,row=Math.floor(i/c),inRow=Math.min(c,k-row*c);return [left+(c-inRow)*(cw+g)/2+col*(cw+g),top+row*(ch+g),cw,ch];});}

function draw(state,uid,opt={}){const p=state.params,st=state.stage;
 if(state.series!=='none'&&!opt.panel)return drawSeries(state,uid);
 const aps=aperturesIn(state),defs=[],parts=[],mode=state.mode,inv=state.aperture==='cut',fin=state.finish,feat={apertures:aps.length,sparkles:0,strands:0,stops:state.ramp.length,mode,finish:fin,panels:0};
 if(p.haze>0&&st>=2)defs.push(`<pattern id="hz${p.seed}" patternUnits="userSpaceOnUse" width="420" height="420" patternTransform="rotate(17)"><image href="${tile('haze',p.seed)}" width="420" height="420" preserveAspectRatio="none"/></pattern>`);
 defs.push(clipDefs(state,aps,uid),`<clipPath id="rg${uid}"><rect x="-20" y="-20" width="${n(W+40)}" height="${n(H+40)}"/></clipPath><clipPath id="rp${uid}"><rect width="${n(W)}" height="${n(H)}"/></clipPath>`);feat.strands=aps.reduce((s,a,i)=>s+strands(state,a,i).length,0);
 const mg=()=>`<g clip-path="url(#rg${uid})">${maskGroup(state,aps,uid)}</g>`;
 if(st===1){
  if(inv)defs.push(`<filter id="iv${uid}" filterUnits="userSpaceOnUse" x="0" y="0" width="${n(W)}" height="${n(H)}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer></filter>`);
  parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${inv?'#fff':'#000'}"/>${inv?`<g filter="url(#iv${uid})">`:''}${maskGroup(state,aps,uid,{crisp:true})}${inv?'</g>':''}`);
  const [dx,dy]=dirOf(p.angle),c=aps[0].c;parts.push(`<g fill="none" stroke="#ff3b6b" stroke-width="1.4">${aps.map(a=>`<rect x="${n(a.box[0])}" y="${n(a.box[1])}" width="${n(a.box[2])}" height="${n(a.box[3])}" stroke-dasharray="5 5" opacity=".7"/>`).join('')}<path d="M${pt(c)}l${n(dx*90*S)} ${n(dy*90*S)}" stroke-width="3"/><circle cx="${n(c[0]+dx*90*S)}" cy="${n(c[1]+dy*90*S)}" r="6" fill="#ff3b6b"/></g>`);}
 else if(st===2){defs.push(falloffFilter(`ff${uid}`,p,v=>[v,v,v],mode,{invert:inv}));parts.push(`<g filter="url(#ff${uid})">${mg()}</g>`);}
 else{
  if(mode==='halo'||mode==='shadow'){
   if(fin==='halftone'){const {paper,ink,dist}=inks(state.ramp);defs.push(halftoneDefs(uid,p.dot),halftoneFilter(`ff${uid}`,uid,p,mode,dist,[paper,ink],{invert:inv}));parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${paper}"/><g filter="url(#ff${uid})">${mg()}</g>`);}
   // Riso: two inks over paper — the first carries the glow, the second the deep core — each posterised, the second misregistered.
   else if(fin==='riso'){const {paper,ink,mid,dist}=inks(state.ramp),q=c=>Math.round(clamp(c)*(p.steps-1))/(p.steps-1),covA=t=>q(dist(t)*1.35),covB=t=>q(clamp((dist(t)-.42)/.58)**1.15);
    defs.push(falloffFilter(`ra${uid}`,p,t=>hexRGB(mix('#ffffff',mid,covA(t)*.94)),mode,{invert:inv}),falloffFilter(`rb${uid}`,p,t=>hexRGB(mix('#ffffff',ink,covB(t)*.94)),mode,{invert:inv}));
    parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${paper}"/><g style="mix-blend-mode:multiply"><g filter="url(#ra${uid})">${mg()}</g></g><g style="mix-blend-mode:multiply"><g transform="translate(${n(p.misregister*.8)} ${n(p.misregister*.55)})"><g filter="url(#rb${uid})">${mg()}</g></g></g>`);}
   else{defs.push(falloffFilter(`ff${uid}`,p,v=>rampAt(state.ramp,v),mode,{invert:inv,steps:fin==='steps'?p.steps:0}));parts.push(`<rect width="${n(W)}" height="${n(H)}" fill="${hexOf(rampAt(state.ramp,0))}"/><g filter="url(#ff${uid})">${mg()}</g>`);}
   parts.push(lightsSVG(state,aps,uid,defs));}
  else{
   // Field and beam: the finish acts on the mask (stepped, or a halftone of light); riso overprints the coloured layer, misregistered.
   if(fin==='halftone')defs.push(halftoneDefs(uid,p.dot),halftoneFilter(`ff${uid}`,uid,p,mode,t=>t,['#000000','#ffffff'],{invert:inv}));else defs.push(falloffFilter(`ff${uid}`,p,v=>[v,v,v],mode,{invert:inv,steps:fin==='steps'||fin==='riso'?p.steps:0}));
   defs.push(`<mask id="mk${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${n(W)}" height="${n(H)}"><g filter="url(#ff${uid})">${mg()}</g></mask>`);
   parts.push(groundSVG(state,uid,defs));let layer;
   if(mode==='field'){const sd=Math.max(...aps.map(a=>lampBlur(state,a.fit)));defs.push(blurFilter(`lp${uid}`,sd,[0,0,W,H],'opaque',meanRamp(state.ramp)));layer=`<g mask="url(#mk${uid})"><g filter="url(#lp${uid})"><g clip-path="url(#rp${uid})"><rect width="${n(W)}" height="${n(H)}" fill="${meanRamp(state.ramp)}"/>${aps.map(a=>lamps(state,a.fit)).join('')}</g></g></g>`;}
   else{const [dx,dy]=dirOf(p.angle),r=Math.abs(dx)*W/2+Math.abs(dy)*H/2;defs.push(`<linearGradient id="bg${uid}" gradientUnits="userSpaceOnUse" x1="${n(W/2-dx*r)}" y1="${n(H/2-dy*r)}" x2="${n(W/2+dx*r)}" y2="${n(H/2+dy*r)}">${Array.from({length:17},(_,i)=>`<stop offset="${n(i/16)}" stop-color="${hexOf(rampAt(state.ramp,i/16))}"/>`).join('')}</linearGradient>`);
    parts.push(rainSVG(state));layer=`<g mask="url(#mk${uid})"><rect width="${n(W)}" height="${n(H)}" fill="url(#bg${uid})"/></g>`;}
   parts.push(layer);if(fin==='riso')parts.push(`<g style="mix-blend-mode:multiply" opacity=".55"><g transform="translate(${n(p.misregister*.8)} ${n(p.misregister*.55)})">${layer}</g></g>`);}
  // Shadow: the crisp object in the ramp's last colour (fading toward the paper with aerial depth); under riso it is printed as misregistered ink.
  if(mode==='shadow'){const end=hexOf(rampAt(state.ramp,1)),pap=hexOf(rampAt(state.ramp,0)),riso=fin==='riso';parts.push(`<g${riso?' style="mix-blend-mode:multiply"':''}>${riso?`<g transform="translate(${n(p.misregister*.8)} ${n(p.misregister*.55)})">`:''}${aps.map((a,i)=>{const c=mix(end,pap,.78*far(p,i,aps.length));return `<g${rotT(a)}>${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}" fill="${c}"/>`).join('')}${strandSVG(strands(state,a,i),c)}</g>`;}).join('')}${riso?'</g>':''}</g>`);}
  parts.push(coreSVG(state,aps,uid,defs),rimSVG(state,aps,uid,defs));
  if(state.layout==='band')parts.push(`<rect y="${Math.round(H*.8)}" width="${n(W)}" height="${n(H-Math.round(H*.8))}" fill="${state.colors[1]}"/>`);
  if(st===3&&!opt.panel){const s=sortStops(state.ramp),x0=44*S,y0=H-34*S,w=220*S;defs.push(`<linearGradient id="rl${uid}">${Array.from({length:17},(_,i)=>`<stop offset="${n(i/16)}" stop-color="${hexOf(rampAt(state.ramp,i/16))}"/>`).join('')}</linearGradient>`);
   parts.push(`<g><rect x="${n(x0-4)}" y="${n(y0-4)}" width="${n(w+8)}" height="${n(22*S)}" fill="#000" opacity=".55"/><rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(10*S)}" fill="url(#rl${uid})"/>${s.map(([c,q])=>`<path d="M${n(x0+q*w)} ${n(y0+10*S)}v${n(6*S)}" stroke="#fff" stroke-width="1.4"/>`).join('')}</g>`);}
  if(st===4){const sp=sparkSVG(state,aps,uid,defs);feat.sparkles=p.sparkles;parts.push(sp);if(!opt.panel)parts.push(...surface(state,defs),copySVG(state));}}
 return {defs:defs.join(''),body:parts.join(''),features:feat};}
// Grain (as v1), paper fibre (a lightened cloud tile, multiplied) and the frame — once per poster, also over a series.
function surface(state,defs){const p=state.params,out=[];
 if(p.grain>0){defs.push(`<pattern id="gn${p.seed}" patternUnits="userSpaceOnUse" width="128" height="128"><image href="${tile('grain',p.seed)}" width="128" height="128"/></pattern>`);out.push(`<rect width="${n(W)}" height="${n(H)}" fill="url(#gn${p.seed})" opacity="${n(p.grain)}" style="mix-blend-mode:overlay"/><rect width="${n(W)}" height="${n(H)}" fill="url(#gn${p.seed})" opacity="${n(p.grain*.15*1000)/1000}"/>`);}
 if(p.paper>0){const id=`pf${p.seed}`;// Fibres: the grain tile stretched four times along one direction, softened, and only its darkest fifth kept.
  defs.push(`<pattern id="pp${p.seed}" patternUnits="userSpaceOnUse" width="512" height="128" patternTransform="rotate(-23)"><image href="${tile('grain',p.seed+5)}" width="512" height="128" preserveAspectRatio="none"/></pattern><filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${n(W)}" height="${n(H)}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation=".45"/><feComponentTransfer><feFuncR type="table" tableValues=".8 .95 1 1 1 1 1 1"/><feFuncG type="table" tableValues=".81 .95 1 1 1 1 1 1"/><feFuncB type="table" tableValues=".83 .96 1 1 1 1 1 1"/></feComponentTransfer></filter>`);
  out.push(`<rect width="${n(W)}" height="${n(H)}" fill="url(#pp${p.seed})" filter="url(#${id})" opacity="${n(p.paper*.85)}" style="mix-blend-mode:multiply"/>`);}
 if(p.inset>0)out.push(`<path d="M0 0H${n(W)}V${n(H)}H0ZM${p.inset} ${p.inset}V${n(H-p.inset)}H${n(W-p.inset)}V${p.inset}Z" fill="${state.colors[1]}" fill-rule="evenodd"/>`);
 return out;}
function drawSeries(state,uid){const cells=seriesGrid(state),[PW,PH]=[W,H],defs=[],seen=new Set(),parts=[`<rect width="${n(W)}" height="${n(H)}" fill="${state.colors[0]}"/>`];let feat;
 cells.forEach((c,i)=>{setDims(c[2],c[3]);const ps=panelState(state,i,cells.length),d=draw(ps,uid+'p'+i,{panel:true});setDims(PW,PH);feat=feat??d.features;
  defs.push(d.defs.replace(/<pattern id="(gn|hz|pp)\d+"[\s\S]*?<\/pattern>/g,m=>{const id=m.match(/id="([^"]+)"/)[1];if(seen.has(id))return '';seen.add(id);return m;}));
  parts.push(`<svg x="${n(c[0])}" y="${n(c[1])}" width="${n(c[2])}" height="${n(c[3])}" viewBox="0 0 ${n(c[2])} ${n(c[3])}" overflow="hidden">${d.body}</svg>`);});
 if(state.stage===4)parts.push(...surface(state,defs),copySVG(state));
 return {defs:defs.join(''),body:parts.join(''),features:{...feat,panels:cells.length}};}

export function render(input={},{v2=false}={}){const state=resolve(input),label={1:'aperture mask',2:'falloff field',3:'gradient map',4:'poster'}[state.stage];
 // States v1 can express are drawn by the frozen v1 engine, byte for byte (pass {v2:true} to force this engine).
 if(!v2&&isV1(state)){const r=V1.render(v1View(state));return {svg:r.svg,state,width:r.width,height:r.height,features:{...r.features,engine:V1_ENGINE}};}
 const [w,h]=dims(state);setDims(w,h);const uid=uidOf(state),d=draw(state,uid);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${esc(state.title.replaceAll('/',' / '))} — glow apertures, ${state.family}, ${label}</title><defs>${d.defs}</defs>${d.body}</svg>`;
 setDims(728,1030);return {svg,state,width:w,height:h,features:{...d.features,stage:state.stage,engine:ENGINE}};}

// Every shape in the chosen style: nineteen small posters (no copy, poster format, no series) and the ramp.
export function specimen(input={}){const state=resolve(input),cols=5,cw=220,chh=311,gap=16,lab=22,shapes=OPTIONS.shape,rows=Math.ceil((shapes.length+1)/cols),w=cols*cw+(cols+1)*gap,h=rows*(chh+lab)+(rows+1)*gap,ink=lum(state.colors[0])>.3?'#222':'#ddd',seen=new Set();let defs='',body='';setDims(728,1030);
 shapes.forEach((sh,i)=>{const s={...state,shape:sh,stage:4,title:'',info:'',format:'poster',series:'none',params:{...state.params,count:['stacked','beam','grid'].includes(state.layout)?state.params.count:1}},uid=uidOf(s)+'s'+i,d=draw(s,uid,{panel:true}),x=gap+(i%cols)*(cw+gap),y=gap+Math.floor(i/cols)*(chh+lab+gap);
  defs+=d.defs.replace(/<pattern id="(gn|hz|pp)\d+"[\s\S]*?<\/pattern>/g,m=>{const id=m.match(/id="([^"]+)"/)[1];if(seen.has(id))return '';seen.add(id);return m;});
  body+=`<g data-shape="${sh}"><svg x="${x}" y="${y}" width="${cw}" height="${chh}" viewBox="0 0 728 1030" overflow="hidden">${d.body}</svg><text x="${x}" y="${y+chh+16}" font-size="13" fill="${ink}" font-family="${FONT}">${SHAPE_NAMES[sh]}</text></g>`;});
 const i=shapes.length,x=gap+(i%cols)*(cw+gap),y=gap+Math.floor(i/cols)*(chh+lab+gap),s=sortStops(state.ramp),gid='spr'+uidOf(state);
 body+=`<g data-ramp="1"><linearGradient id="${gid}" x1="0" y1="1" x2="0" y2="0">${Array.from({length:17},(_,k)=>`<stop offset="${n(k/16)}" stop-color="${hexOf(rampAt(state.ramp,k/16))}"/>`).join('')}</linearGradient><rect x="${x}" y="${y}" width="${cw}" height="${chh}" fill="url(#${gid})"/>${s.map(([c,q])=>`<rect x="${x+cw-46}" y="${n(y+chh-(q*chh)-10)}" width="34" height="20" fill="${c}" stroke="#fff" stroke-width="1.5"/>`).join('')}<text x="${x}" y="${y+chh+16}" font-size="13" fill="${ink}" font-family="${FONT}">Ramp · ${s.length} stops</text></g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${state.colors[0]}"/><defs>${defs}</defs>${body}</svg>`;}
