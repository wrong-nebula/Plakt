/* Arch-envelope headlines — type system study after Tadanori Yokoo (1965–97).
 * A headline is set from pre-extracted OFL outlines (fonts.mjs), flattened to
 * polylines — straight segments are subdivided too, so they can bend — and
 * mapped into an envelope between two curves. The envelope is a centre curve
 * with an upper and a lower half-height; stems follow a blend of the vertical
 * and the centre's normal (smoothed over half a band, so they never fold), so
 * every letter is reshaped to fill the band instead of being rotated along a
 * path. Banner ribbons with folded ends, stepped, block or vanishing
 * extrusions, strokes and a Yokoo ground complete the poster.
 */
import {FONTS} from './fonts.mjs';
export const ENGINE='arch-envelope-v1';
export const W=728,H=1030;  // B-series proportion, as Japanese B1 posters
export const ROLES=['paper','ground','ray','letter','extrude','shade','banner','line','accent'];
export const SOURCES=[
 {id:'moma-7953',source:'moma',title:'Made in Japan, Tadanori Yokoo',date:'1965',family:'silver-arch'},
 {id:'moma-7957',source:'moma',title:'Koshimaki-Osen',date:'1966',family:'vanishing'},
 {id:'moma-6096',source:'moma',title:'Okabe Silkscreen Studio',date:'1997',family:'valley'},
 {id:'moma-6067',source:'moma',title:'LaChapelle Land',date:'1996',family:'gable'},
 {id:'moma-8980',source:'moma',title:'Takarazuka, Grand Revue',date:'1966',family:'revue'},
 {id:'moma-6102',source:'moma',title:'Okera Kai',date:'1997',family:'rising'},
 {id:'pgda-19182',source:'pgda',title:'100 Posters of Tadanori Yokoo',date:'1972'},
 {id:'moma-4984',source:'moma',title:'Koshimaki Osen 2',date:'1969'}
];
export const FONT_LIST=Object.entries(FONTS).map(([id,f])=>({id,name:f.name}));
export const ENVELOPES=[
 {id:'arch',name:'Arch',note:'Centre on a circular arc, constant height.'},
 {id:'smile',name:'Inverted arch',note:'The arch turned over.'},
 {id:'bridge',name:'Bridge',note:'Flat foot, the top swells: letters grow toward the middle.'},
 {id:'gable',name:'Gable',note:'Flat foot under a softened peak.'},
 {id:'valley',name:'Valley',note:'Flat top, the foot rises: letters shrink toward the middle.'},
 {id:'bulge',name:'Bulge',note:'Both edges swell outward.'},
 {id:'pinch',name:'Pinch',note:'Both edges squeeze inward.'},
 {id:'wave',name:'Wave',note:'Centre on a sine, constant height.'},
 {id:'flag',name:'Flag',note:'A wave whose height swells at the crests.'},
 {id:'keystone',name:'Keystone',note:'Straight converging edges with foreshortened spacing: one-point perspective.'},
 {id:'rising',name:'Rising ribbon',note:'Climbs and grows from left to right with a gentle S.'},
 {id:'straight',name:'Straight',note:'No warp: the reference setting.'}
];
export const LAYOUTS=[
 {id:'proscenium',name:'Proscenium',note:'Arched headline over a ray stage, side panels and a caption box (Made in Japan, LaChapelle Land).'},
 {id:'masthead',name:'Masthead',note:'Headline across the top, rays from a vanishing point under it, a plate below (Koshimaki-Osen).'},
 {id:'twin',name:'Twin',note:'The headline at top and bottom around a horizon (Okabe Silkscreen Studio).'},
 {id:'center',name:'Centre stage',note:'One headline block in the middle of the ground.'},
 {id:'diagonal',name:'Diagonal',note:'A big headline across the poster, beams from a corner (Okera Kai).'},
 {id:'stack',name:'Stack',note:'Rows fill the poster as a type-only stack.'}
];
export const OPTIONS={envelope:ENVELOPES.map(e=>e.id),layout:LAYOUTS.map(l=>l.id),font:FONT_LIST.map(f=>f.id),banner:['none','solid','ruled','metal','outline'],ends:['flush','fold','notch','point'],
 face:['solid','outlined','inline','outline','neon'],extrude:['none','drop','block','stepped','vanish'],ground:['plain','gradient','rays','sunburst','horizon','grid','rings'],frame:['none','rule','stripes','border'],rowmode:['bands','block'],rowfit:['justify','shared'],case:['upper','mixed']};
export const OPTION_KEYS=Object.keys(OPTIONS);
export const CONTROLS=[
 {key:'amount',label:'Envelope depth',group:'envelope',min:0,max:1,step:.01,value:.5},
 {key:'tilt',label:'Stems: vertical → radial',group:'envelope',min:0,max:1,step:.01,value:0},
 {key:'waves',label:'Waves',group:'envelope',min:.5,max:3,step:.05,value:1.25},
 {key:'phase',label:'Wave phase',group:'envelope',min:0,max:.99,step:.01,value:0},
 {key:'taper',label:'Height taper',group:'envelope',min:-.8,max:.8,step:.01,value:0},
 {key:'perspective',label:'Perspective spacing',group:'envelope',min:0,max:1,step:.01,value:1},
 {key:'fit',label:'Letter fit: stepped → smooth',group:'envelope',min:0,max:1,step:.01,value:1},
 {key:'size',label:'Letter height',group:'letters',min:.4,max:1.6,step:.01,value:1},
 {key:'span',label:'Width',group:'letters',min:.35,max:1,step:.01,value:1},
 {key:'tracking',label:'Tracking',group:'letters',min:-.08,max:.4,step:.005,value:.02},
 {key:'slant',label:'Slant',group:'letters',min:-.4,max:.4,step:.01,value:0},
 {key:'leading',label:'Row gap',group:'letters',min:0,max:.8,step:.01,value:.16},
 {key:'detail',label:'Flattening (segments per letter height)',group:'letters',min:6,max:160,step:1,value:44},
 {key:'pad',label:'Banner padding',group:'banner',min:0,max:.45,step:.01,value:.14},
 {key:'tail',label:'Banner ends',group:'banner',min:.2,max:2,step:.01,value:.8},
 {key:'depth',label:'Extrusion depth',group:'depth',min:.02,max:.8,step:.01,value:.22},
 {key:'angle',label:'Extrusion angle',group:'depth',min:0,max:359,step:1,value:45},
 {key:'steps',label:'Steps',group:'depth',min:2,max:14,step:1,value:6},
 {key:'stroke',label:'Line weight',group:'depth',min:.004,max:.08,step:.001,value:.022},
 {key:'rays',label:'Rays / rings',group:'ground',min:6,max:72,step:1,value:32},
 {key:'ratio',label:'Ray width',group:'ground',min:.15,max:.85,step:.01,value:.5},
 {key:'origin',label:'Origin height',group:'ground',min:-.4,max:.4,step:.01,value:0},
 {key:'sun',label:'Sun size',group:'ground',min:0,max:.4,step:.005,value:.08}
];
const CURVED=['arch','smile','bridge','gable','valley','wave','flag','rising'];
const USES={amount:s=>s.envelope!=='straight',tilt:s=>CURVED.includes(s.envelope),waves:s=>['wave','flag','rising'].includes(s.envelope),phase:s=>['wave','flag','rising'].includes(s.envelope),
 perspective:s=>['keystone','rising'].includes(s.envelope)||s.params.taper!==0,leading:s=>s.text.includes('/'),pad:s=>s.banner!=='none',tail:s=>s.banner!=='none'&&s.ends!=='flush',
 depth:s=>s.extrude!=='none',angle:s=>['drop','block','stepped'].includes(s.extrude),steps:s=>s.extrude==='stepped',stroke:s=>s.face!=='solid'||['ruled','metal','outline'].includes(s.banner)||s.extrude==='stepped',
 rays:s=>['rays','sunburst','grid','rings'].includes(s.ground),ratio:s=>['rays','sunburst','rings'].includes(s.ground),origin:s=>['rays','sunburst','horizon','grid','rings'].includes(s.ground)||s.extrude==='vanish',sun:s=>['sunburst','horizon','grid'].includes(s.ground)};
export const applies=(key,state)=>!USES[key]||USES[key](state);
const P0={amount:.5,tilt:0,waves:1.25,phase:0,taper:0,perspective:1,fit:1,size:1,span:1,tracking:.02,slant:0,leading:.16,detail:44,pad:.14,tail:.8,depth:.22,angle:45,steps:6,stroke:.022,rays:32,ratio:.5,origin:0,sun:.08};
const base={envelope:'arch',layout:'center',font:'anton',banner:'none',ends:'flush',face:'solid',extrude:'none',ground:'rays',frame:'none',rowmode:'bands',rowfit:'justify',case:'upper'};
// Palette roles: paper (margin), ground, ray, letter, extrude, shade, banner, line, accent.
export const FAMILIES=[
 {id:'silver-arch',name:'Silver arch',after:'Made in Japan, 1965',palette:'Sky / vermilion / silver / gold',text:'TADANORI YOKOO',title:'MADE IN JAPAN',info:'HAVING REACHED / A CLIMAX AT THE AGE OF 29 / I WAS DEAD',
  colors:['#ece5d3','#72b6dc','#ec4b44','#1b1a1f','#1b1a1f','#28368c','#b9bcbf','#1b1a1f','#e7b52b'],
  set:{...base,envelope:'arch',layout:'proscenium',font:'anton',banner:'metal',ground:'rays',frame:'rule',params:{...P0,amount:.46,tilt:1,pad:.15,rays:36,tracking:.035}},note:'Black condensed capitals fanned radially in a silver arch with gold and black rules, over vermilion and sky rays from a half sun.'},
 {id:'vanishing',name:'Vanishing masthead',after:'Koshimaki-Osen, 1966',palette:'Vermilion / cobalt / chrome yellow / black',text:'KOSHIMAKI-OSEN',title:'A PLAY IN FIVE SCENES',info:'TOKYO / OCTOBER',
  colors:['#151417','#e13a2c','#2058b5','#f5d12f','#1f62c8','#151417','#cbc8c1','#151417','#ee55a6'],
  set:{...base,envelope:'valley',layout:'masthead',font:'archivoblack',extrude:'vanish',ground:'rays',frame:'border',params:{...P0,amount:.32,depth:.5,rays:30,tracking:0,size:1.05}},note:'Heavy yellow capitals on a flat top whose foot rises to the middle, extruded in cobalt and black toward a vanishing point that also throws the rays.'},
 {id:'valley',name:'Valley stretch',after:'Okabe Silkscreen Studio, 1997',palette:'Gold / silver / black / red',text:'OKABE SILKSCREEN STUDIO',title:'TRADE MARK',info:'SILKSCREEN PRINTING SINCE 1966',
  colors:['#e2302a','#c9ab6c','#e3e2dd','#141316','#d8452b','#2f7ec0','#f2f0e9','#141316','#ef4a23'],
  set:{...base,envelope:'valley',layout:'twin',font:'anton',ground:'horizon',frame:'border',params:{...P0,amount:.9,sun:.36,tracking:.01}},note:'Condensed black capitals stretched tall at both ends and squeezed in the middle, printed twice around a sun on a horizon.'},
 {id:'gable',name:'Gable banner',after:'LaChapelle Land, 1996',palette:'Yellow / red / blue / black',text:'LaChapelle Land',title:'MADE IN U.S.A.',info:'PHOTOGRAPHS BY DAVID LACHAPELLE',
  colors:['#f6f4ef','#ea2f4e','#2a83d6','#16151a','#16151a','#2fae4f','#f8e23a','#e3263f','#f39ac1'],
  set:{...base,envelope:'gable',layout:'proscenium',font:'dmserif',banner:'ruled',ground:'rays',frame:'rule',case:'mixed',params:{...P0,amount:.42,pad:.12,rays:28,tracking:.01}},note:'Mixed-case serif in a yellow band under a peaked roof: letters grow toward the ridge, stems stay upright.'},
 {id:'revue',name:'Inline revue',after:'Takarazuka, Grand Revue, 1966',palette:'Yellow / vermilion / pink / ink violet',text:'TAKARAZUKA',title:'GRAND REVUE',info:'FLOWER TROUPE / TAKARAZUKA GRAND THEATRE',
  colors:['#efe8d8','#efcf45','#e2472e','#2c2459','#e2472e','#2c2459','#f1a2bd','#a6dcf0','#2c2459'],
  set:{...base,envelope:'bulge',layout:'masthead',font:'bodoni',face:'inline',extrude:'drop',ground:'rays',frame:'stripes',params:{...P0,amount:.22,depth:.07,angle:60,stroke:.026,rays:44,ratio:.42,sun:.1,origin:.08,tracking:.03}},note:'Black didone capitals with a pale inline, a slight bulge and a red drop shadow, over a sunburst framed in barber stripes.'},
 {id:'rising',name:'Rising ribbon',after:'Okera Kai, 1997',palette:'Teal / magenta / dusk',text:'OKERA',title:'OKERA KAI',info:'A GATHERING / KYOTO',
  colors:['#f3f1ec','#f3b8d6','#ff5fb4','#16a097','#0d625c','#093f3b','#ffffff','#111113','#ff3d8f'],
  set:{...base,envelope:'rising',layout:'diagonal',font:'barlow',face:'outlined',extrude:'block',ground:'rays',frame:'rule',params:{...P0,size:1.3,amount:.62,tilt:.55,waves:.9,phase:.5,slant:.22,depth:.1,angle:115,stroke:.018,rays:22,ratio:.16,tracking:.04}},note:'Teal capitals climb and grow across the poster, leaning with the ribbon, outlined in black with a dark block extrusion; pink beams from a corner.'},
 {id:'night-drive',name:'Night drive',after:'new — electro',palette:'Night / cyan / magenta / sun',text:'NIGHT/DRIVE',title:'ALL NIGHT LONG',info:'TOKYO / 23:00 - 05:00',
  colors:['#06050b','#0a0720','#ff2bd6','#19f0ff','#7a5cff','#2a1466','#120c2c','#ff2bd6','#ffb400'],
  set:{...base,envelope:'wave',layout:'center',font:'bebas',face:'neon',extrude:'vanish',ground:'grid',rowmode:'block',params:{...P0,amount:.9,tilt:.4,waves:1,phase:.08,depth:.2,stroke:.016,rays:28,sun:.2,origin:.08,leading:.1,tracking:.04}},note:'Cyan neon outlines on a waving block, a violet vanishing extrusion, a striped sun over a magenta grid on near-black.'},
 {id:'acid',name:'Acid pinch',after:'new — rave',palette:'Black / acid / hot pink / blue',text:'RAVE/2026',title:'WAREHOUSE',info:'ALL NIGHT / BRING WATER',
  colors:['#0b0b0c','#0b0b0c','#1d1d22','#c8ff3a','#ff2e88','#2d6bff','#c8ff3a','#0b0b0c','#ff2e88'],
  set:{...base,envelope:'pinch',layout:'stack',font:'unbounded',extrude:'stepped',ground:'rings',params:{...P0,amount:.62,depth:.36,angle:90,steps:7,stroke:.006,rays:26,ratio:.5,leading:.12,tracking:0}},note:'Wide black capitals squeezed at the waist in acid green, with a pink and blue stepped extrusion falling straight down, over dark rings.'},
 {id:'riso-bulge',name:'Riso bulge',after:'new — risograph',palette:'Sun yellow / fluoro pink / blue',text:'FUN/HOUSE',title:'RISOGRAPH PRINT FAIR',info:'SATURDAY / 10 - 18',
  colors:['#f3eee3','#ffd23f','#ff5aa5','#2742c8','#ff5aa5','#1b1b1b','#f3eee3','#1b1b1b','#ff4f2a'],
  set:{...base,envelope:'bulge',layout:'center',font:'rubik',face:'outlined',extrude:'block',ground:'rays',frame:'rule',rowmode:'block',params:{...P0,amount:.75,depth:.14,angle:35,stroke:.012,rays:24,leading:.08,tracking:0}},note:'Rounded monospaced capitals in one fisheye block, outlined in black, pink block extrusion on yellow and pink rays.'},
 {id:'groovy',name:'Groovy smile',after:'new — seventies',palette:'Cream / tangerine / amber / rust',text:'Groovy/Sunday',title:'ROLLER DISCO',info:'EVERY SUNDAY / FROM 4 PM',
  colors:['#f2e4c8','#f2e4c8','#ebcf9d','#fff4e0','#e5532b','#f2a43a','#f8ecd4','#3d1f12','#8e3a1b'],
  set:{...base,envelope:'smile',layout:'center',font:'fraunces',face:'outlined',extrude:'stepped',ground:'sunburst',case:'mixed',params:{...P0,amount:.32,tilt:1,depth:.3,angle:90,steps:6,stroke:.012,rays:30,ratio:.5,sun:.16,origin:.24,leading:.06,tracking:-.01}},note:'Soft black old-style in an inverted arch, cream with a brown line and a stepped tangerine, amber and rust shadow.'}
];

// Text: letters of the headline alphabet, spaces, and / for up to three rows.
const ALPHABET=new Set(Object.keys(FONTS.anton.glyphs));
export const CHARACTERS=[...ALPHABET].join('');
export function normalizeText(input,fallback){
 const t=String(input??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[‘’`´]/g,"'").replace(/[“”„]/g,'"').replace(/[–—]/g,'-').replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim();
 if(!t){if(fallback!==undefined)return fallback;throw new Error('Type at least one letter.');}
 const bad=[...t].find(c=>c!==' '&&c!=='/'&&!ALPHABET.has(c));if(bad)throw new Error(`“${bad}” is not in the alphabet: use A–Z, a–z, 0–9 and . , : ; ! ? ' " - & ( ) + @ # * % $; / starts a new row.`);
 const rows=t.split('/');if(rows.length>3)throw new Error('Use at most three rows.');if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if(rows.some(r=>r.trim().length>28))throw new Error('Use at most 28 characters per row.');return rows.map(r=>r.trim()).join('/');}
const small=(v,d,max)=>typeof v==='string'?v.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[–—]/g,'-').toUpperCase().replace(/[^A-Z0-9 .,:;!?'"\-&()+@#*%$/]/g,'').slice(0,max):d;
const clampNum=(v,c)=>v!==null&&v!==''&&Number.isFinite(+v)?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):c.value;
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,given={...input.params},params={};
 for(const c of CONTROLS)params[c.key]=clampNum(given[c.key],{...c,value:set.params[c.key]});
 let text;try{text=normalizeText(input.text,family.text);}catch{text=family.text;}
 const colors=Array.isArray(input.colors)&&input.colors.length===ROLES.length&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 return {engine:ENGINE,family:family.id,text,title:small(input.title,family.title,40),info:small(input.info,family.info,120),stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,
  ...Object.fromEntries(OPTION_KEYS.map(k=>[k,OPTIONS[k].includes(input[k])?input[k]:set[k]])),params,colors};}
export const displayText=state=>state.case==='upper'?state.text.toUpperCase():state.text;

// Maths and colour
const TAU=Math.PI*2,lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),n1=v=>Math.round(v*10)/10;
export const n=v=>Math.round(v*100)/100;
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=c=>'#'+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
const luminance=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const contrast=(a,b)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const uidOf=v=>hashText(JSON.stringify(v)).toString(36);

// Glyph outlines → segments → polylines. Straight segments are subdivided by
// length (measured with the row's horizontal stretch), curves by length and by
// turning, so warped lines stay smooth and round letters stay round.
const parsed=new Map();
function segments(font,ch){const key=font+'\u0000'+ch;if(parsed.has(key))return parsed.get(key);const out=[];let cur,start;
 for(const m of FONTS[font].glyphs[ch].d.matchAll(/([MLCZ])([^MLCZ]*)/g)){const v=m[2].trim()?m[2].trim().split(/[\s,]+/).map(Number):[];
  if(m[1]==='M'){cur=start=[v[0],v[1]];out.push([]);}else if(m[1]==='L'){out.at(-1).push({L:1,a:cur,b:[v[0],v[1]]});cur=[v[0],v[1]];}
  else if(m[1]==='C'){out.at(-1).push({a:cur,c:[v[0],v[1]],d:[v[2],v[3]],b:[v[4],v[5]]});cur=[v[4],v[5]];}else{if(cur[0]!==start[0]||cur[1]!==start[1])out.at(-1).push({L:1,a:cur,b:start});cur=start;}}
 parsed.set(key,out);return out;}
const cubic=(s,t)=>{const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;return [a*s.a[0]+b*s.c[0]+c*s.d[0]+d*s.b[0],a*s.a[1]+b*s.c[1]+c*s.d[1]+d*s.b[1]];};
function flatten(font,ch,step,sx){return segments(font,ch).map(segs=>{const pts=[],line=[];
 for(const s of segs){const len=(p,q)=>Math.hypot((q[0]-p[0])*sx,q[1]-p[1]);let k;
  if(s.L){const l=len(s.a,s.b);if(l<1e-6)continue;k=Math.ceil(l/step);}
  else{const legs=[[s.a,s.c],[s.c,s.d],[s.d,s.b]].filter(([p,q])=>len(p,q)>1e-6),ang=legs.map(([p,q])=>Math.atan2(q[1]-p[1],(q[0]-p[0])*sx));let turn=0;for(let i=1;i<ang.length;i++){let d=Math.abs(ang[i]-ang[i-1])%TAU;turn+=Math.min(d,TAU-d);}
   const l=(len(s.a,s.b)+legs.reduce((t,[p,q])=>t+len(p,q),0))/2;if(l<1e-6)continue;k=Math.max(2,Math.ceil(l/step),Math.ceil(turn/.085));}
  for(let i=0;i<k;i++){const t=i/k;pts.push(s.L?[lerp(s.a[0],s.b[0],t),lerp(s.a[1],s.b[1],t)]:cubic(s,t));line.push(!!s.L&&i>0);}}
 return {pts,line};}).filter(c=>c.pts.length>2);}
function setRow(font,text,tracking){const F=FONTS[font],out=[];let x=0,prev=null;
 for(const ch of text){if(ch===' '){x+=F.space+tracking*1000;prev=null;continue;}const id=F.glyphs[ch]?ch:F.glyphs[ch.toUpperCase()]?ch.toUpperCase():null;if(!id){x+=F.space;prev=null;continue;}
  if(prev)x+=F.kern[prev+id]??0;out.push({ch,id,x});x+=F.glyphs[id].a+tracking*1000;prev=id;}
 const g0=out[0],g1=out.at(-1);return {glyphs:out,width:out.length?g1.x+F.glyphs[g1.id].x1-(g0.x+F.glyphs[g0.id].x0):1};}

// Envelopes: (σ, {EW, EH, a, w, ph}) → [centre y, upper half-height, lower half-height], y up.
const bump=s=>Math.sin(Math.PI*s),peak=s=>{const k=.16,q=Math.hypot(1,k);return (q-Math.hypot(2*s-1,k))/(q-k);};
const archY=(s,{EW,a})=>{const sag=a*.4*EW;if(sag<1e-6)return 0;const R=(EW*EW/4+sag*sag)/(2*sag),dx=(s-.5)*EW;return Math.sqrt(Math.max(0,R*R-dx*dx))-(R-sag);};
const SHAPES={
 straight:(s,{EH})=>[0,EH/2,EH/2],arch:(s,o)=>[archY(s,o),o.EH/2,o.EH/2],smile:(s,o)=>[-archY(s,o),o.EH/2,o.EH/2],
 bridge:(s,{EH,a})=>{const t=EH*(1+1.3*a*bump(s))/2;return [t,t,t];},gable:(s,{EH,a})=>{const t=EH*(1+1.3*a*peak(s))/2;return [t,t,t];},
 valley:(s,{EH,a})=>{const b=EH*.8*a*bump(s);return [(EH+b)/2,(EH-b)/2,(EH-b)/2];},
 bulge:(s,{EH,a})=>{const h=EH/2*(1+1.2*a*bump(s));return [0,h,h];},pinch:(s,{EH,a})=>{const h=EH/2*(1-.62*a*bump(s));return [0,h,h];},
 wave:(s,{EH,a,w,ph,amp})=>[a*amp*Math.sin(TAU*(w*s+ph)),EH/2,EH/2],
 flag:(s,{EH,a,w,ph,amp})=>{const t=TAU*(w*s+ph),h=EH/2*(1+.34*a*Math.cos(t));return [a*amp*.85*Math.sin(t),h,h];},
 keystone:(s,{EH,a})=>{const h=EH/2*(1-.72*a*(1-s));return [0,h,h];},
 rising:(s,{EW,EH,a,w,ph,amp})=>{const h=EH/2*(1-.5*a*(1-s));return [a*(EW*.3*(s-.5)+Math.min(EH*.45,amp)*Math.sin(TAU*(w*s+ph))),h,h];}
};
// at(s, v) maps a text position s ∈ [0,1] across and v ∈ [0,1] up (0 = foot,
// 1 = top) into the envelope. Spacing can be foreshortened (perspective) and
// follow arc length (radial); stems run along the blended normal.
// Waves are bounded so the slope stays under ~37° and, with radial stems, the
// curvature stays gentle enough for half a band to turn without crushing.
const EDGED=new Set(['bridge','gable','valley']);
export function envelope(state,EW,EH){const p=state.params,k=TAU*p.waves/EW,slope=.75/k,curv=.55/(k*k*EH/2),o={EW,EH,a:p.amount,w:p.waves,ph:p.phase,amp:Math.min(.85*EH,slope,lerp(slope,Math.min(slope,curv),p.tilt))},f=SHAPES[state.envelope];
 const taper=s=>Math.max(.12,1+.8*p.taper*(2*s-1)),raw=s=>{const c=clamp(s,0,1),[y,ht,hb]=f(c,o),k=taper(c);return [y,ht*k,hb*k];};
 const e=1e-4,d0=(f(e,o)[0]-f(0,o)[0])/e,d1=(f(1,o)[0]-f(1-e,o)[0])/e,yc=s=>s<0?f(0,o)[0]+s*d0:s>1?f(1,o)[0]+(s-1)*d1:f(s,o)[0];
 // Normals: tangent angle of the centre, gaussian-smoothed over half a band height or more — widened until
 // the normal turns slowly enough that no stem (up to the largest half-height) can cross its neighbour.
 const b=Math.max(.15,2.2*EH/EW),N=600,S=Array.from({length:N+1},(_,i)=>-b+(1+2*b)*i/N),C=S.map(s=>[s*EW,yc(s)]),L=[0];
 for(let i=1;i<=N;i++)L.push(L[i-1]+Math.hypot(C[i][0]-C[i-1][0],C[i][1]-C[i-1][1]));
 const ang=C.map((_,i)=>{const a=C[Math.max(0,i-1)],z=C[Math.min(N,i+1)];return Math.atan2(z[1]-a[1],z[0]-a[0]);});
 const smooth=sig=>ang.map((_,i)=>{let s=0,w=0;for(let j=i;j>=0&&L[i]-L[j]<3*sig;j--){const g=Math.exp(-(((L[i]-L[j])/sig)**2)/2);s+=g*ang[j];w+=g;}for(let j=i+1;j<=N&&L[j]-L[i]<3*sig;j++){const g=Math.exp(-(((L[j]-L[i])/sig)**2)/2);s+=g*ang[j];w+=g;}return s/w;});
 let sig=.45*EH,theta=smooth(sig);
 if(p.tilt>0){const hmax=Math.max(...Array.from({length:41},(_,i)=>{const [,ht,hb]=raw(i/40);return Math.max(ht,hb);})),i0=Math.round(b/(1+2*b)*N),i1=N-i0;
  for(let it=0;it<7;it++){let rate=0;for(let i=i0+1;i<=i1;i++)rate=Math.max(rate,Math.abs(theta[i]-theta[i-1])/Math.max(1e-9,L[i]-L[i-1]));if(rate*hmax*p.tilt<.8)break;sig*=1.6;theta=smooth(sig);}}
 const normal=s=>{const x=(s+b)/(1+2*b)*N,i=clamp(Math.floor(x),0,N-1),t=lerp(theta[i],theta[i+1],clamp(x-i,0,1)),r=[-Math.sin(t)*p.tilt,lerp(1,Math.cos(t),p.tilt)],m=Math.hypot(...r);return [r[0]/m,r[1]/m];};
 const M=400,Lc=[0];for(let i=1;i<=M;i++)Lc.push(Lc[i-1]+Math.hypot(EW/M,yc(i/M)-yc((i-1)/M)));
 const arcInv=t=>{const target=clamp(t,0,1)*Lc[M];let lo=0,hi=M;while(hi-lo>1){const m=(lo+hi)>>1;if(Lc[m]<target)lo=m;else hi=m;}return (lo+(target-Lc[lo])/Math.max(1e-9,Lc[hi]-Lc[lo]))/M;};
 const [,a0,b0]=raw(0),[,a1,b1]=raw(1),hL=a0+b0,hR=a1+b1,persp=['keystone','rising'].includes(state.envelope)||p.taper!==0,pers=s=>!persp||Math.abs(hR-hL)<1e-6?s:s*hL/(hR-s*(hR-hL));
 const param=s=>{const q=lerp(s,pers(clamp(s,0,1)),p.perspective);return p.tilt>0?lerp(q,arcInv(q),p.tilt):q;};
 // Centre-and-thickness envelopes offset along the stem; edge-defined ones (a flat side against a curved one) run each stem from edge to edge.
 const ey=(q,side)=>{const [y,ht,hb]=raw(q);return side>0?y+ht:y-hb;},ex=(q,side)=>q<0?ey(0,side)+q*(ey(1e-4,side)-ey(0,side))/1e-4:q>1?ey(1,side)+(q-1)*(ey(1,side)-ey(1-1e-4,side))/1e-4:ey(q,side);
 const edge=(C,nx,ny,side,t)=>{const g=u=>C[1]+u*ny-ex((C[0]+u*nx)/EW,side);for(let i=0;i<8;i++){const v=g(t);if(Math.abs(v)<.005)break;const d=(g(t+.25)-v)/.25;if(Math.abs(d)<1e-6)break;t-=v/d;}return t;};
 const edged=EDGED.has(state.envelope)&&p.tilt>0;
 const at=(s,v)=>{const q=param(s),[y,ht,hb]=raw(q),[nx,ny]=normal(q),C=[q*EW,y],t1=edged?edge(C,nx,ny,1,ht/ny):ht,t0=edged?edge(C,nx,ny,-1,-hb/ny):-hb,d=lerp(t0,t1,v);return [C[0]+d*nx,C[1]+d*ny];};
 return {at,EW,EH};}

// Lettering geometry in local screen units (y down), before fitting into a layout box.
function lettering(state,lay,text){
 const p=state.params,rows=text.split('/'),R=rows.length,hN=lay.rowH*p.size,EW=((lay.box??lay.copies[0].box)[2]-(lay.box??lay.copies[0].box)[0])*p.span,pad=state.banner==='none'?0:p.pad;
 const sets=rows.map(r=>setRow(state.font,r,p.tracking)),maxW=Math.max(...sets.map(r=>r.width)),block=state.rowmode==='block'&&R>1;
 const EH=block?hN*(R+(R-1)*p.leading)/(1-2*pad):hN/(1-2*pad),E=envelope(state,EW,EH),m=Math.min(.2,pad*EH/EW),glyphs=[],bands=[];let bend=0,points=0;
 const shift=r=>block?0:r*(EH+p.leading*hN);
 rows.forEach((row,r)=>{const set=sets[r],f=state.rowfit==='shared'?set.width/maxW:1,s0=.5-(.5-m)*f,s1=.5+(.5-m)*f,top=block?1-pad-r*hN*(1+p.leading)/EH:1-pad,v0=top-hN/EH,v1=top,dy=shift(r);
  const sx=((s1-s0)*EW/set.width)/((v1-v0)*EH/1000),step=1000/p.detail,raw=set.glyphs.map(g=>({...g,contours:flatten(state.font,g.id,step,sx).map(c=>({...c,pts:c.pts.map(([x,y])=>[x+g.x+p.slant*y,y])}))}));
  const xs=raw.flatMap(g=>g.contours.flatMap(c=>c.pts.map(q=>q[0]))),xl=Math.min(...xs),xr=Math.max(...xs),toS=x=>s0+(x-xl)/(xr-xl)*(s1-s0),vm=(v0+v1)/2;
  // Rows with descenders fit foot-of-descender to cap height, so a banner holds the whole word.
  const dmin=Math.max(-420,Math.min(0,...raw.flatMap(g=>g.contours.flatMap(c=>c.pts.map(q=>q[1]))))),foot=dmin<-30?dmin:0,toV=y=>v0+(y-foot)/(1000-foot)*(v1-v0);
  for(const g of raw){const gx=g.contours.flatMap(c=>c.pts.map(q=>toS(q[0]))),sa=Math.min(...gx),sb=Math.max(...gx),sc=(sa+sb)/2,A=E.at(sa,vm),B=E.at(sb,vm),kw=Math.hypot(B[0]-A[0],B[1]-A[1])/Math.max(1e-9,sb-sa),T=(()=>{const u=E.at(sc+1e-4,vm),w=E.at(sc-1e-4,vm),l=Math.hypot(u[0]-w[0],u[1]-w[1]);return [(u[0]-w[0])/l,(u[1]-w[1])/l];})();
   // Letter fit: 1 warps every point (smooth); 0 keeps each letter a straight box at its centre's height and normal (stepped).
   const map=([x,y])=>{const s=toS(x),v=toV(y);let q=E.at(s,v);if(p.fit<1){const c=E.at(sc,v),k=(s-sc)*kw;q=[lerp(c[0]+k*T[0],q[0],p.fit),lerp(c[1]+k*T[1],q[1],p.fit)];}return [q[0],-q[1]+dy];};
   const polys=g.contours.map(c=>{const pts=c.pts.map(map);points+=pts.length;
    for(let i=0;i<pts.length;i++)if(c.line[i]){const a=pts[(i-1+pts.length)%pts.length],z=pts[(i+1)%pts.length],q=pts[i],u=Math.atan2(q[1]-a[1],q[0]-a[0]),w=Math.atan2(z[1]-q[1],z[0]-q[0]);let d=Math.abs(u-w)%TAU;bend=Math.max(bend,Math.min(d,TAU-d));}
    return pts;});
   glyphs.push({ch:g.ch,row:r,polys});}
  if(!block||r===0)bands.push(band(E,state,block?0:dy));});
 return {glyphs,bands,EW,EH,hN,E,bend:bend*180/Math.PI,points,rows:R};}
// Banner band between the envelope edges, with its ends: folded ribbon tails, a swallowtail notch or a point.
function band(E,state,dy){const M=140,f=q=>[q[0],-q[1]+dy],top=[],bottom=[];for(let i=0;i<=M;i++){top.push(f(E.at(i/M,1)));bottom.push(f(E.at(i/M,0)));}
 const r=Math.min(.07,state.params.pad*.4),rules=state.banner==='ruled'||state.banner==='metal'||state.banner==='outline'?[0,1].map(v0=>Array.from({length:M+1},(_,i)=>f(E.at(i/M,v0?1-r:r)))):[];
 const end=(i,j)=>{const B=bottom[i],T=top[i],mid=[(B[0]+T[0])/2,(B[1]+T[1])/2],nb=[(bottom[j][0]+top[j][0])/2,(bottom[j][1]+top[j][1])/2],l=Math.hypot(mid[0]-nb[0],mid[1]-nb[1]),t=[(mid[0]-nb[0])/l,(mid[1]-nb[1])/l],h=Math.hypot(T[0]-B[0],T[1]-B[1]),nn=[(T[0]-B[0])/h,(T[1]-B[1])/h];
  return {B,T,t,n:nn,h,Q:(u,w)=>[B[0]+u*t[0]+w*nn[0],B[1]+u*t[1]+w*nn[1]]};};
 const ends=[end(0,1),end(M,M-1)],L=state.params.tail,cap=[],tails=[],folds=[];
 for(const e of ends){const {Q,h}=e;
  if(state.ends==='point')cap.push([Q(L*h*.55,h/2)]);
  else if(state.ends==='notch'){const x=L*h*.6;cap.push([Q(x,h),Q(x-Math.min(.38*h,x*.8),h/2),Q(x,0)]);}
  else cap.push([]);
  if(state.ends==='fold'){const d=.34*h,f=.3*h,len=Math.max(.35*h,L*h);tails.push([Q(0,-d),Q(len,-d),Q(len-.32*h,-d+h/2),Q(len,h-d),Q(0,h-d)]);folds.push([Q(-f,0),Q(0,0),Q(0,-d)]);}}
 // cap points for the left end run top → bottom; the band runs along the top, down the right end, back along the bottom.
 const poly=[...top,...cap[1],...bottom.slice().reverse(),...cap[0].slice().reverse()];
 return {poly,top,bottom,rules,tails,folds};}

// Layouts: headline boxes, row height, ray origin and where the plates go, inside the frame rectangle.
function layoutOf(state,R){const [x0,y0,x1,y1]=R,w=x1-x0,o=state.params.origin*H;
 switch(state.layout){
  case 'proscenium':return {copies:[{box:[x0+12,y0+48,x1-12,y0+.37*H],align:'top'}],rowH:104,origin:[W/2,.865*H+o],kicker:{at:'above'},info:{at:'caption'},panels:'proscenium'};
  case 'masthead':return {copies:[{box:[x0+14,y0+18,x1-14,y0+.3*H],align:'top'}],rowH:132,origin:[W/2,.37*H+o],kicker:{at:'below'},info:{at:'bottom'},panels:'footlights'};
  case 'twin':return {copies:[{box:[x0+12,y0+14,x1-12,.37*H],align:'top'},{box:[x0+12,.63*H,x1-12,y1-14],align:'bottom'}],rowH:170,origin:[W/2,.52*H+o],kicker:{at:'below'},info:{at:'between'}};
  case 'diagonal':return {copies:[{box:[x0+24,y0+.1*H,x1-24,.74*H],align:'center'}],rowH:190,origin:[x0+.05*w,y1-.01*H+o],kicker:{at:'corner'},info:{at:'corner'}};
  case 'stack':return {copies:[{box:[x0+16,y0+64,x1-16,y1-84],align:'center'}],rowH:250,origin:[W/2,.5*H+o],kicker:{at:'top'},info:{at:'bottom'}};
  default:return {copies:[{box:[x0+18,.24*H,x1-18,.76*H],align:'center'}],rowH:170,origin:[W/2,.5*H+o],kicker:{at:'above'},info:{at:'below'}};}}
export const frameRect=state=>({none:[0,0,W,H],rule:[22,22,W-22,H-22],stripes:[28,28,W-28,H-28],border:[30,30,W-30,H-30]})[state.frame];

// Fits the lettering into a box (shrinking only) and moves every shape into poster space.
function place(geo,state,box,align){const p=state.params,o=state.extrude==='drop'||state.extrude==='block'||state.extrude==='stepped'?[Math.cos(p.angle*Math.PI/180)*p.depth*geo.hN,Math.sin(p.angle*Math.PI/180)*p.depth*geo.hN]:[0,0];
 const pts=[...geo.glyphs.flatMap(g=>g.polys.flat()),...geo.bands.flatMap(b=>[...b.poly,...b.tails.flat(),...b.folds.flat()])],gp=geo.glyphs.flatMap(g=>g.polys.flat()).map(q=>[q[0]+o[0],q[1]+o[1]]),all=pts.concat(gp);
 const xs=all.map(q=>q[0]),ys=all.map(q=>q[1]),bx=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],k=Math.min(1,(box[2]-box[0])/(bx[2]-bx[0]),(box[3]-box[1])/(bx[3]-bx[1]));
 const tx=box[0]+((box[2]-box[0])-(bx[2]-bx[0])*k)/2-bx[0]*k,ty=(align==='top'?box[1]:align==='bottom'?box[3]-(bx[3]-bx[1])*k:box[1]+((box[3]-box[1])-(bx[3]-bx[1])*k)/2)-bx[1]*k,T=q=>[tx+q[0]*k,ty+q[1]*k];
 return {glyphs:geo.glyphs.map(g=>({...g,polys:g.polys.map(c=>c.map(T))})),bands:geo.bands.map(b=>({poly:b.poly.map(T),top:b.top.map(T),bottom:b.bottom.map(T),rules:b.rules.map(r=>r.map(T)),tails:b.tails.map(t=>t.map(T)),folds:b.folds.map(t=>t.map(T))})),
  k,hpx:geo.hN*k,o:[o[0]*k,o[1]*k],bbox:[tx+bx[0]*k,ty+bx[1]*k,tx+bx[2]*k,ty+bx[3]*k],geo,T};}

// SVG pieces
const polyD=pts=>'M'+pts.map(q=>n1(q[0])+' '+n1(q[1])).join('L')+'Z',lineD=pts=>'M'+pts.map(q=>n1(q[0])+' '+n1(q[1])).join('L');
const glyphD=gs=>gs.map(g=>g.polys.map(polyD).join('')).join('');
const area=pts=>pts.reduce((s,[x,y],i)=>{const [u,v]=pts[(i+1)%pts.length];return s+x*v-u*y;},0)/2;
const cyc=(c,state)=>[c.extrude,c.shade,c.accent];
// Extrusion behind the faces: a flat drop, stepped layers, or a block / vanishing solid of back face plus visible side strips in two tones.
function extrusion(pl,state,c,vp,ids){const p=state.params,mode=state.extrude,gs=pl.glyphs,lw=Math.max(.5,p.stroke*pl.hpx);if(mode==='none')return '';
 const outlined=state.face==='outlined',neon=state.face==='neon',edge=outlined?` stroke="${c.line}" stroke-width="${n(lw*.8)}" stroke-linejoin="round"`:'';
 if(mode==='drop')return `<path d="${gs.map(g=>g.polys.map(q=>polyD(q.map(([x,y])=>[x+pl.o[0],y+pl.o[1]]))).join('')).join('')}" fill="${neon?mix(c.ground,c.extrude,.35):c.extrude}"${edge}/>`;
 if(mode==='stepped'){const K=p.steps,cols=cyc(c,state),out=[];for(let k=K;k>=1;k--){const dx=pl.o[0]*k/K,dy=pl.o[1]*k/K;out.push(`<path d="${gs.map(g=>g.polys.map(q=>polyD(q.map(([x,y])=>[x+dx,y+dy]))).join('')).join('')}" fill="${neon?mix(c.ground,cols[(k-1)%3],.4):cols[(k-1)%3]}" stroke="${c.line}" stroke-width="${n(Math.max(.4,lw*.6))}" stroke-linejoin="round"/>`);}return out.join('');}
 const depth=p.depth*.9,shift=mode==='vanish'?([x,y])=>[x+(vp[0]-x)*depth,y+(vp[1]-y)*depth]:([x,y])=>[x+pl.o[0],y+pl.o[1]];
 const toneA=neon?mix(c.ground,c.extrude,.42):c.extrude,toneB=neon?mix(c.ground,c.extrude,.22):c.shade,back=neon?mix(c.ground,c.extrude,.15):mix(c.extrude,'#000000',.3),strips=[];
 for(const g of gs){const sgn=Math.sign(g.polys.reduce((s,q)=>s+area(q),0))||1;
  for(const q of g.polys){const m=q.length,Q=q.map(shift),info=q.map((a,i)=>{const b=q[(i+1)%m],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=sgn*dy/l,ny=-sgn*dx/l,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],sh=shift(mid),vis=nx*(sh[0]-mid[0])+ny*(sh[1]-mid[1])>1e-9;return vis?(Math.abs(ny)>=Math.abs(nx)?1:2):0;});
   let s=info.findIndex((t,i)=>t!==info[(i-1+m)%m]);if(s<0){if(info[0])strips.push({tone:info[0],front:q,pts:[...q,q[0],...Q.slice().reverse(),Q[0]]});continue;}
   for(let k=0;k<m;){const i=(s+k)%m,t=info[i];let j=k;while(j<m&&info[(s+j)%m]===t)j++;if(t){const idx=Array.from({length:j-k+1},(_,u)=>(s+k+u)%m);strips.push({tone:t,front:idx.map(u=>q[u]),pts:[...idx.map(u=>q[u]),...idx.slice().reverse().map(u=>Q[u])]});}k=j;}}}
 // Painter's order: where two side faces overlap, the one whose front edge lies nearer the vanishing point (or further along the offset) is in front.
 const key=mode==='vanish'?st=>-st.front.reduce((a,[x,y])=>a+Math.hypot(x-vp[0],y-vp[1]),0)/st.front.length:st=>st.front.reduce((a,[x,y])=>a+x*pl.o[0]+y*pl.o[1],0)/st.front.length;
 strips.sort((a,b)=>key(a)-key(b));
 const backD=gs.map(g=>g.polys.map(q=>polyD(q.map(shift))).join('')).join('');
 return `<path d="${backD}" fill="${back}"${edge}/>`+strips.map(st=>`<path d="${polyD(st.pts)}" fill="${st.tone===1?toneA:toneB}" stroke="${outlined?c.line:st.tone===1?toneA:toneB}" stroke-width="${outlined?n(lw*.8):.6}" stroke-linejoin="round"/>`).join('')+(neon?`<path d="${backD}" fill="none" stroke="${c.extrude}" stroke-width="${n(lw*.7)}" stroke-linejoin="round" filter="url(#${ids.glow})"/>`:'');}
// Letter faces: solid, outlined (line behind), inline (a line inset inside each letter), outline only, or neon.
function faceSVG(gs,state,c,hpx,ids,id){const sw=Math.max(.5,state.params.stroke*hpx),d=glyphD(gs);
 switch(state.face){
  case 'outlined':return `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="${n(sw*2)}" stroke-linejoin="round"/><path d="${d}" fill="${c.letter}"/>`;
  case 'inline':{const inset=Math.max(sw*1.1,hpx*.022);return `<clipPath id="in-${ids.key}-${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${c.letter}"/><g clip-path="url(#in-${ids.key}-${id})" fill="none" stroke-linejoin="miter" stroke-miterlimit="3"><path d="${d}" stroke="${c.line}" stroke-width="${n(2*(inset+sw))}"/><path d="${d}" stroke="${c.letter}" stroke-width="${n(2*inset)}"/></g>`;}
  case 'outline':return `<path d="${d}" fill="none" stroke="${c.letter}" stroke-width="${n(sw)}" stroke-linejoin="round"/>`;
  case 'neon':return `<path d="${d}" fill="${mix(c.ground,c.letter,.1)}" stroke="${c.letter}" stroke-width="${n(sw)}" stroke-linejoin="round" filter="url(#${ids.glow})"/><path d="${d}" fill="none" stroke="${mix(c.letter,'#ffffff',.65)}" stroke-width="${n(sw*.35)}" stroke-linejoin="round"/>`;
  default:return `<path d="${d}" fill="${c.letter}"/>`;}}
function bannerSVG(b,state,c,hpx,ids,i){if(state.banner==='none')return '';const lw=Math.max(.6,state.params.stroke*hpx),dark=mix(c.banner,'#000000',.16),fold=mix(c.banner,'#000000',.42),out=[];
 const ruled=state.banner!=='solid',edge=ruled?` stroke="${c.accent}" stroke-width="${n(lw*1.6)}" stroke-linejoin="round"`:'',fill=state.banner==='outline'?'none':state.banner==='metal'?`url(#metal-${ids.key}-${i})`:c.banner;
 if(b.tails.length)out.push(`<path d="${b.tails.map(polyD).join('')}" fill="${state.banner==='outline'?'none':dark}"${edge}/><path d="${b.folds.map(polyD).join('')}" fill="${fold}"${edge}/>`);
 if(state.banner==='metal'){const ys=b.poly.map(q=>q[1]),y0=Math.min(...ys),y1=Math.max(...ys);out.push(`<linearGradient id="metal-${ids.key}-${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(y0)}" x2="0" y2="${n(y1)}"><stop offset="0" stop-color="${mix(c.banner,'#ffffff',.55)}"/><stop offset=".35" stop-color="${c.banner}"/><stop offset=".62" stop-color="${mix(c.banner,'#000000',.22)}"/><stop offset=".82" stop-color="${mix(c.banner,'#ffffff',.3)}"/><stop offset="1" stop-color="${mix(c.banner,'#000000',.12)}"/></linearGradient>`);}
 out.push(`<path d="${polyD(b.poly)}" fill="${fill}"${edge}/>`);if(b.rules.length)out.push(`<path d="${b.rules.map(lineD).join('')}" fill="none" stroke="${c.line}" stroke-width="${n(lw*.75)}"/>`);return out.join('');}
function headlineSVG(pl,state,c,vp,ids,{groupGlyphs=false}={}){const out=[],rows=[...new Set(pl.glyphs.map(g=>g.row))],bandsFirst=pl.bands.length===1;
 if(bandsFirst)out.push(bannerSVG(pl.bands[0],state,c,pl.hpx,ids,0));
 for(const r of rows){const gs=pl.glyphs.filter(g=>g.row===r);if(!bandsFirst)out.push(bannerSVG(pl.bands[r],state,c,pl.hpx,ids,r));out.push(extrusion({...pl,glyphs:gs},state,c,vp,ids));
  out.push(groupGlyphs?gs.map((g,i)=>`<g data-glyph="${esc(g.ch)}">${faceSVG([g],state,c,pl.hpx,ids,r+'-'+i)}</g>`).join(''):faceSVG(gs,state,c,pl.hpx,ids,r));}
 return out.join('');}
const esc=s=>s.replace(/[&<>"']/g,m=>'&#'+m.charCodeAt(0)+';');

// Supporting type (plates) from the same outlines, unwarped. Returns [svg path d, width].
function textD(str,font,x,y,cap,anchor='middle',track=.08){const F=FONTS[font],k=cap/1000;let cur=0,prev=null;const parts=[];
 for(const ch of str){if(ch===' '||!F.glyphs[ch]){cur+=F.space+track*1000;prev=null;continue;}if(prev)cur+=F.kern[prev+ch]??0;parts.push([ch,cur]);cur+=F.glyphs[ch].a+track*1000;prev=ch;}
 const w=(cur-track*1000)*k,x0=anchor==='middle'?x-w/2:anchor==='end'?x-w:x;
 return [parts.map(([ch,ox])=>F.glyphs[ch].d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,(m,a,b)=>n1(x0+(+a+ox)*k)+' '+n1(y-(+b)*k))).join(''),w];}
function plate(lines,font,cx,cy,sizes,c,{anchor='middle',maxW=W-90}={}){const ink=contrast(c.line,c.banner)>=4.5?c.line:[c.letter,c.shade,c.paper,c.ground,'#141414','#f6f3ec'].sort((a,b)=>contrast(b,c.banner)-contrast(a,c.banner))[0];const scale=Math.min(1,...lines.map((l,i)=>maxW/Math.max(1,textD(l,font,0,0,sizes[i])[1]))),cs=sizes.map(s=>s*scale),lead=cs.map(s=>s*1.75),h=lead.reduce((a,b)=>a+b,0)-lead.at(-1)+cs.at(-1);
 const ws=lines.map((l,i)=>textD(l,font,0,0,cs[i])[1]),w=Math.max(...ws),px=Math.max(...cs)*.9,py=Math.max(...cs)*.75,x0=anchor==='middle'?cx-w/2:anchor==='end'?cx-w:cx,y0=cy-h/2;let y=y0,d='';
 lines.forEach((l,i)=>{d+=textD(l,font,x0+w/2,y+cs[i],cs[i])[0];y+=lead[i];});
 return {svg:`<rect x="${n(x0-px)}" y="${n(y0-py)}" width="${n(w+2*px)}" height="${n(h+2*py)}" fill="${c.banner}" stroke="${ink}" stroke-width="1.3"/><path d="${d}" fill="${ink}"/>`,box:[x0-px,y0-py,x0+w+px,y0+h+py]};}

// Grounds inside the frame rectangle
// Ray wedges from O, one centred straight up. With `up`, wedges are cut to the half above O's horizon
// analytically (angles in [−π, 0]), so no nested clip groups are needed (resvg mis-sizes those).
function wedges(O,count,ratio,up=false){const r=1.3*Math.hypot(W,H),per=TAU/count,a0=-Math.PI/2-ratio*per/2;let d='';
 const fan=(a,b)=>{if(b-a<1e-4)return;const k=Math.max(2,Math.ceil((b-a)/.08)),pts=[O];for(let j=0;j<=k;j++){const t=lerp(a,b,j/k);pts.push([O[0]+r*Math.cos(t),O[1]+r*Math.sin(t)]);}d+=polyD(pts);};
 for(let i=0;i<count;i++){const a=((a0+i*per+Math.PI)%TAU+TAU)%TAU-Math.PI,b=a+ratio*per;if(!up)fan(a,b);else{fan(Math.max(a,-Math.PI),Math.min(b,0));fan(Math.max(a,Math.PI),Math.min(b,TAU));}}return d;}
function waves(x0,x1,y,yEnd,col,sw){let d='';for(let yy=y+7,j=0;yy<yEnd;yy+=11,j++){const pts=[];for(let x=x0;x<=x1+8;x+=8)pts.push([x,yy+2.4*Math.sin((x+j*17)/13)]);d+=lineD(pts);}return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;}
function groundSVG(state,c,R,O,uid){let post='';const p=state.params,[x0,y0,x1,y1]=R,rect=`x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}"`,out=[`<clipPath id="r-${uid}"><rect ${rect}/></clipPath><g clip-path="url(#r-${uid})">`],hz=clamp(O[1],y0,y1),sun=p.sun*W;
 const sky=(a,b)=>`<linearGradient id="sky-${uid}" x1="0" y1="${y0}" x2="0" y2="${n(hz)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><rect x="${x0}" y="${y0}" width="${x1-x0}" height="${n(hz-y0)}" fill="url(#sky-${uid})"/>`;
 const Q=[O[0],hz],dome=(cy,r)=>polyD(Array.from({length:121},(_,i)=>{const a=i/120*TAU;return [O[0]+r*Math.cos(a),Math.min(hz,cy+r*Math.sin(a))];}));
 switch(state.ground){
  case 'gradient':out.push(`<linearGradient id="g-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.ground}"/><stop offset="1" stop-color="${c.ray}"/></linearGradient><rect ${rect} fill="url(#g-${uid})"/>`);break;
  case 'rays':out.push(`<rect ${rect} fill="${c.ground}"/><path d="${wedges(O,p.rays,p.ratio)}" fill="${c.ray}"/>`);break;
  case 'sunburst':out.push(`<rect ${rect} fill="${c.ground}"/><path d="${wedges(Q,p.rays,p.ratio,true)}" fill="${c.ray}"/>${sun>.5?`<path d="${dome(hz,sun)}" fill="${c.accent}"/>`:''}<rect x="${x0}" y="${n(hz)}" width="${x1-x0}" height="${n(y1-hz)}" fill="${c.shade}"/>${waves(x0,x1,hz,y1,mix(c.shade,'#ffffff',.45),1.3)}`);break;
  case 'horizon':{const sea=Math.min(y1,hz+.075*H);out.push(sky(c.ground,mix(c.ground,'#ffffff',.35)),`<linearGradient id="sun-${uid}" x1="0" y1="${n(hz-sun)}" x2="0" y2="${n(hz)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${mix(c.accent,'#ffe03a',.85)}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>${sun>.5?`<path d="${dome(hz,sun)}" fill="url(#sun-${uid})"/>`:''}`,
   `<rect x="${x0}" y="${n(hz)}" width="${x1-x0}" height="${n(sea-hz)}" fill="${c.shade}"/>${waves(x0,x1,hz-2,sea,mix(c.shade,'#ffffff',.7),1.4)}<rect x="${x0}" y="${n(sea)}" width="${x1-x0}" height="${n(y1-sea)}" fill="${c.ray}"/>`);break;}
  case 'grid':{const slit=[],cy=hz-sun*.35;for(let i=0;i<7;i++){const y=cy-sun+2*sun*(.42+i*.085),h=1.2+i*1.5;if(y+h<hz-.5)slit.push(`<rect x="${n(O[0]-sun)}" y="${n(y)}" width="${n(2*sun)}" height="${n(h)}" fill="${c.ground}"/>`);}
   const lines=[],far=y1-hz;for(let i=1;i<=14;i++){const y=hz+far*(i/14)**2.1;lines.push([[x0,y],[x1,y]]);}for(let j=-p.rays;j<=p.rays;j++){const e=[O[0]+j*(x1-x0)/p.rays*2.2,y1],t=Math.min(1,e[0]<x0?(x0-O[0])/(e[0]-O[0]):e[0]>x1?(x1-O[0])/(e[0]-O[0]):1);if(t>.02)lines.push([[O[0],hz],[lerp(O[0],e[0],t),lerp(hz,y1,t)]]);}
   out.push(sky(c.ground,mix(c.ground,c.ray,.32)),`<path d="${wedges(Q,p.rays*2,.08,true)}" fill="${c.ray}" fill-opacity=".28"/>`,`<linearGradient id="sun-${uid}" x1="0" y1="${n(O[1]-sun*1.35)}" x2="0" y2="${n(O[1]+sun*.65)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.ray}"/></linearGradient>`,
    (sun>1&&cy-sun<hz?`<path d="${dome(cy,sun)}" fill="url(#sun-${uid})"/>${slit.join('')}`:'')+`<rect x="${x0}" y="${n(hz)}" width="${x1-x0}" height="${n(y1-hz)}" fill="${mix(c.ground,'#000000',.25)}"/>`,
    );post=`<path d="${lines.map(lineD).join('')}" stroke="${c.ray}" stroke-width="1.3" fill="none" filter="url(#glow-${uid})"/><rect x="${x0}" y="${n(hz-1)}" width="${x1-x0}" height="2" fill="${c.ray}" filter="url(#glow-${uid})"/>`;break;}
  case 'rings':{const step=2*Math.hypot(W,H)/p.rays/2;let d='';out.push(`<rect ${rect} fill="${c.ground}"/>`);for(let i=0;i<p.rays;i++)d+=`<circle cx="${n(O[0])}" cy="${n(O[1])}" r="${n((i+.5)*step)}"/>`;out.push(`<g fill="none" stroke="${c.ray}" stroke-width="${n(step*p.ratio)}">${d}</g>`);break;}
  default:out.push(`<rect ${rect} fill="${c.ground}"/>`);}
 out.push('</g>',post);return out.join('');}
function frameSVG(state,c,R,uid){const [x0,y0,x1,y1]=R,r=(i,col,sw)=>`<rect x="${x0+i}" y="${y0+i}" width="${x1-x0-2*i}" height="${y1-y0-2*i}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
 switch(state.frame){
  case 'rule':return r(0,c.line,2.6)+r(5,c.accent,3.4)+r(9.5,c.line,1.1);
  case 'border':return r(0,c.line,1.4);
  case 'stripes':{let d='';for(let x=-H;x<W+H;x+=26)d+=polyD([[x,0],[x+13,0],[x+13+H,H],[x+H,H]]);return `<clipPath id="f-${uid}"><path d="M0 0H${W}V${H}H0ZM${x0} ${y0}V${y1}H${x1}V${y0}Z" clip-rule="evenodd"/></clipPath><g clip-path="url(#f-${uid})"><rect width="${W}" height="${H}" fill="${c.ray}"/><path d="${d}" fill="${c.accent}"/></g>`+r(0,c.accent,1.6);}
  default:return '';}}
function footlightsSVG(state,c,R,uid){const [x0,y0,x1,y1]=R,cx=W/2,cy=y1+.06*H,cols=[c.shade,c.banner,c.accent,c.ray],w=.028*H;let out='';
 for(let i=4;i>=0;i--)out+=`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(.13*H+i*w)}" fill="${cols[i%4]}" stroke="${c.line}" stroke-width="1.4"/>`;
 return `<clipPath id="fl-${uid}"><rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}"/></clipPath><g clip-path="url(#fl-${uid})">${out}</g>`;}
function panelsSVG(state,c,R,uid){const [x0,y0,x1,y1]=R,w=x1-x0,top=.6*H,pw=.27*w,out=[];
 for(const [i,a,b] of [[0,x0,x0+pw],[1,x1-pw,x1]]){const O=[(a+b)/2,y1],id=`p${i}-${uid}`;
  out.push(`<clipPath id="${id}"><rect x="${n(a)}" y="${n(top)}" width="${n(pw)}" height="${n(y1-top)}"/></clipPath><g clip-path="url(#${id})"><rect x="${n(a)}" y="${n(top)}" width="${n(pw)}" height="${n(y1-top)}" fill="${c.ray}"/><path d="${wedges(O,40,.5)}" fill="${c.shade}"/><circle cx="${n(O[0])}" cy="${n(O[1])}" r="${n(pw*.28)}" fill="${c.accent}"/></g><rect x="${n(a+3)}" y="${n(top+3)}" width="${n(pw-6)}" height="${n(y1-top-6)}" fill="none" stroke="${c.accent}" stroke-width="3.4"/><rect x="${n(a)}" y="${n(top)}" width="${n(pw)}" height="${n(y1-top)}" fill="none" stroke="${c.line}" stroke-width="1.6"/>`);}
 return out.join('');}

// The whole drawing for one state: stage 1 setting and envelope, 2 warp, 3 lettering, 4 poster.
function compose(state){const c=Object.fromEntries(ROLES.map((r,i)=>[r,state.colors[i]])),R=state.stage===4?frameRect(state):[0,0,W,H],uid=uidOf(state),text=displayText(state),lay=layoutOf(state,R);
 // Construction passes show one copy of the lettering, centred, at its poster size.
 if(state.stage<4)lay.copies=[{box:[40,.1*H,W-40,.9*H],align:'center'}];
 const geo=lettering(state,lay,text),placed=lay.copies.map(cp=>place(geo,state,cp.box,cp.align)),O=lay.origin,out=[];
 const info=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,3),infoFont=['dmserif','bodoni','fraunces'].includes(state.font)?state.font:'bebas';
 const feat={glyphs:geo.glyphs.length,points:geo.points,rows:geo.rows,maxBend:n(geo.bend),scale:n(placed[0].k),letterHeight:n(placed[0].hpx),copies:placed.length,envelope:state.envelope,layout:state.layout};
 out.push(`<filter id="glow-${uid}" filterUnits="userSpaceOnUse" x="-60" y="-60" width="${W+120}" height="${H+120}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
 if(state.stage<=2){const paper='#f1efe9',ink='#2b2a2e',hi=[c.accent,c.ray,c.letter,c.extrude,c.shade,c.line].sort((a,b)=>contrast(b,paper)-contrast(a,paper)).find(h=>contrast(h,paper)>=2.4&&Math.max(...rgb(h))-Math.min(...rgb(h))>60)??'#d2452f';c.paper=paper;out.push(`<rect width="${W}" height="${H}" fill="${paper}"/>`);
  placed.forEach((pl,j)=>{const iso=[],fine=[];
   for(const b of pl.bands)iso.push(lineD(b.top),lineD(b.bottom),lineD([b.top[0],b.bottom[0]]),lineD([b.top.at(-1),b.bottom.at(-1)]));
   for(const b0 of geo.bands){const dy=b0.top[0][1]+geo.E.at(0,1)[1],L=q=>pl.T([q[0],-q[1]+dy]);
    for(const v of [.25,.5,.75])fine.push(lineD(Array.from({length:61},(_,i)=>L(geo.E.at(i/60,v)))));
    for(let i=1;i<24;i++)fine.push(lineD(Array.from({length:13},(_,k)=>L(geo.E.at(i/24,k/12)))));}
   if(state.stage===1){const straight={...state,envelope:'straight',params:{...state.params,tilt:0,taper:0,fit:1}},sp=place(lettering(straight,lay,text),straight,lay.copies[j].box,lay.copies[j].align);
    out.push(`<path d="${glyphD(sp.glyphs)}" fill="${mix(c.paper,ink,.16)}"/><path d="${sp.bands.map(b=>polyD([...b.top,...b.bottom.slice().reverse()])).join('')}" fill="none" stroke="${mix(c.paper,ink,.35)}" stroke-width="1" stroke-dasharray="4 4"/>`);}
   out.push(`<path d="${fine.join('')}" fill="none" stroke="${ink}" stroke-opacity=".22" stroke-width=".7"/><path d="${iso.join('')}" fill="none" stroke="${hi}" stroke-width="2"/>`);
   if(state.stage===2){const dots=pl.glyphs.flatMap(g=>g.polys.flatMap(q=>q.filter((_,i)=>i%3===0)));out.push(`<path d="${glyphD(pl.glyphs)}" fill="${mix(c.paper,ink,.07)}" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/><path d="${dots.map(([x,y])=>`M${n1(x)} ${n1(y)}h0`).join('')}" stroke="${hi}" stroke-width="2.6" stroke-linecap="round"/>`);}});
  return {svg:out.join(''),feat};}
 out.push(`<rect width="${W}" height="${H}" fill="${c.paper}"/>`);
 if(state.stage===4){out.push(groundSVG(state,c,R,O,uid));if(lay.panels==='proscenium')out.push(panelsSVG(state,c,R,uid));if(lay.panels==='footlights')out.push(footlightsSVG(state,c,R,uid));}else out.push(`<rect x="${R[0]}" y="${R[1]}" width="${R[2]-R[0]}" height="${R[3]-R[1]}" fill="${c.ground}"/>`);
 const vp=state.extrude==='vanish'?[O[0],clamp(O[1],-H,2*H)]:O;
 placed.forEach((pl,j)=>out.push(headlineSVG(pl,state,c,vp,{glow:'glow-'+uid,key:uid+'-'+j})));
 if(state.stage===4){const bb=placed[0].bbox,[x0,y0,x1,y1]=R,plates=[];
  if(state.title){const k=lay.kicker.at,cy=k==='above'?Math.max(y0+24,bb[1]-22):k==='below'?Math.min(bb[3]+30,y1-60):k==='top'?y0+34:y0+30;plates.push(plate([state.title],infoFont,k==='corner'?x0+28:W/2,cy,[14.5],c,{anchor:k==='corner'?'start':'middle'}));}
  if(info.length){const sizes=info.length===3?[11,18,11]:info.length===2?[17,12]:[16],k=lay.info.at;
   if(k==='caption'){const w=x1-x0,box=[x0+.31*w,.865*H,x1-.31*w,y1-8];out.push(`<rect x="${n(box[0])}" y="${n(box[1])}" width="${n(box[2]-box[0])}" height="${n(box[3]-box[1])}" fill="${c.banner}" stroke="${c.line}" stroke-width="1.6"/>`);
    const P=plate(info,infoFont,W/2,(box[1]+box[3])/2,sizes,{...c,banner:c.banner},{maxW:box[2]-box[0]-30});plates.push({svg:P.svg.replace(/<rect[^>]*\/>/,'')});}
   else{const cy=k==='below'?Math.min(bb[3]+44,y1-50):k==='between'?.585*H:k==='corner'?y1-50:y1-48;plates.push(plate(info,infoFont,k==='corner'?x1-28:W/2,cy,sizes,c,{anchor:k==='corner'?'end':'middle'}));}}
  out.push(plates.map(p=>p.svg).join(''),frameSVG(state,c,R,uid));}
 return {svg:out.join(''),feat};}

export function render(input={}){const state=resolve(input),{svg,feat}=compose(state),label={1:'setting and envelope',2:'warp',3:'lettering',4:'poster'}[state.stage];
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(displayText(state).replaceAll('/',' / '))} — arch-envelope headline, ${state.family}, ${label}</title>${svg}</svg>`,state,width:W,height:H,features:{...feat,stage:state.stage}};}

// Every glyph in the family style: alphabet rows, each in its own envelope.
export function specimen(input={}){const state=resolve({...input,stage:3}),F=FONTS[state.font],lower=state.case==='mixed'||'abcdefghijklmnopqrstuvwxyz'.split('').some(ch=>F.glyphs[ch]&&F.glyphs[ch].d!==F.glyphs[ch.toUpperCase()].d);
 const rows=['ABCDEFGHIJKLM','NOPQRSTUVWXYZ',...(lower?['abcdefghijklm','nopqrstuvwxyz']:[]),'0123456789',CHARACTERS.replace(/[A-Za-z0-9]/g,'')],c=Object.fromEntries(ROLES.map((r,i)=>[r,state.colors[i]])),w=1500,rh=230,h=rows.length*rh+40,uid=uidOf(state)+'s';
 const parts=[`<rect width="${w}" height="${h}" fill="${c.ground}"/><filter id="glow-${uid}" filterUnits="userSpaceOnUse" x="-60" y="-60" width="${w+120}" height="${h+120}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`];
 rows.forEach((row,i)=>{const st={...state,case:'mixed',rowmode:'bands',params:{...state.params,size:1,span:1}},box=[40,20+i*rh+16,w-40,20+(i+1)*rh-16],geo=lettering(st,{box,rowH:120},row),pl=place(geo,st,box,'center');
  const vp=[w/2,box[3]+rh*.3];parts.push(headlineSVG(pl,st,c,vp,{glow:'glow-'+uid,key:uid+'-'+i},{groupGlyphs:true}));});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;}

// Placed lettering (poster space) for checks: one entry per copy, as compose draws it.
export function geometry(input={}){const state=resolve(input),R=state.stage===4?frameRect(state):[0,0,W,H],lay=layoutOf(state,R);if(state.stage<4)lay.copies=[{box:[40,.1*H,W-40,.9*H],align:'center'}];const geo=lettering(state,lay,displayText(state));return lay.copies.map(cp=>place(geo,state,cp.box,cp.align));}
