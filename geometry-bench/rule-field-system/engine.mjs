/* Rule-field letters — type system study after RKC (Giliane Cachin, Viltė
 * Jurgutytė), FUBU (@tanjabailiff and others) and Spatial Positions 10 (@heee88).
 * One field of rules covers the sheet. Letters are never drawn. A glyph mask from
 * any face gives every point of every rule an insideness t ∈ [0, 1]: exact on the
 * outline when edges are hard, from a signed distance field and a profile when they
 * are soft. Each rule blends an outside and an inside state by t — offset, wave,
 * weight and visibility — and hard edges cut, jog or tick it exactly on the outline.
 *
 * Everything else is a module: fields (parallel, rings and boxes, rays, spiral,
 * contours of the letters), wave shapes, edge profiles, cut edges, pens (flat,
 * round, dashes, dots), inks and field warps (row pinch, noise). A second layer
 * takes any field. Outputs: poster SVG, plotter centrelines and ink separations.
 * Nothing is traced from the posters.
 */
import {FONTS} from './fonts.mjs';
export const ENGINE='rule-field-v2';
export const SOURCES=[
 {id:'cb3397928a96928071a273f1-p0',family:'wobble',credit:'Giliane Cachin',title:'RKC 2020 programme'},
 {id:'ad881198f18e7f5c03a077cc-p0',family:'gap',credit:'@tanjabailiff, @ladinadoerig, @elia.fidel.piero, @nicolaijaronkager, @tonjique',title:'FUBU'},
 {id:'b20591c26761670febcdbeb8-p0',family:'trace',credit:'Giliane Cachin and Viltė Jurgutytė',title:'RKC autumn programme'},
 {id:'11258727460b8d469bebe0f3-p0',family:'relief',credit:'@heee88',title:'Spatial Positions 10, 2015'}
];
export const FORMATS={a:{name:'A series',w:728,h:1030},poster:{name:'Poster 2:3',w:700,h:1050},story:{name:'Story 9:16',w:608,h:1080},square:{name:'Square',w:900,h:900},wide:{name:'Wide 16:9',w:1280,h:720}};
export const FONT_LIST=Object.entries(FONTS).map(([id,f])=>({id,name:f.name,license:f.license}));
// Module catalogue: every option value with its label. Engines and editor share it.
export const LABELS={
 geometry:{parallel:'Parallel rules',rings:'Rings and boxes',rays:'Rays',spiral:'Spiral',contour:'Contours of the letters'},
 wave:{sine:'Sine',triangle:'Triangle',square:'Square',saw:'Saw'},
 inside:{rules:'Rules',gap:'Gap'},outside:{rules:'Rules',gap:'Gap'},
 profile:{step:'Soft step',ramp:'Ramp',dome:'Dome',terrace:'Terraces'},
 jogs:{open:'Open',connect:'Connect jogs',ticks:'Ticks'},
 pen:{flat:'Flat (thins on bends)',round:'Round',dash:'Dashes',dots:'Dots'},
 second:{none:'None',inside:'Inside the letters',outside:'Outside the letters',everywhere:'Everywhere'},
 secondField:{auto:'Complement',parallel:'Parallel rules',rings:'Rings and boxes',rays:'Rays',spiral:'Spiral',contour:'Contours of the letters'},
 secondInk:{rules:'Rules ink',letters:'Letters ink',accent:'Accent ink'},
 ink:{solid:'One ink',gradient:'Gradient','two-tone':'Two-tone',rainbow:'Rainbow',alternate:'Alternate'},
 ground:{plain:'Plain',gradient:'Gradient'},under:{none:'None',letters:'Letter fill',outline:'Letter outline'},
 fill:{fit:'Fit',rows:'Rows to width',stretch:'Stretch to field',justify:'Justify letters'},band:{bottom:'Bottom band',top:'Top band',sides:'Side bands',none:'Full bleed'},
 format:Object.fromEntries(Object.entries(FORMATS).map(([k,f])=>[k,f.name])),font:Object.fromEntries(Object.entries(FONTS).map(([k,f])=>[k,f.name]))};
export const OPTIONS=Object.fromEntries(Object.entries(LABELS).map(([k,v])=>[k,Object.keys(v)]));
export const OUTPUTS=['poster','plotter'];
const base={pitch:8,weight:.5,angle:90,cx:.5,cy:.5,arms:1,squareness:0,aspect:1,waveAmp:0,waveLen:4,wavePhase:0,warp:0,warpScale:180,seed:7,pinch:0,reach:60,spread:.5,cross:90,secondPitch:1,
 shift:0,insideAmp:0,insidePhase:0,insideFreq:1,insideWeight:1,feather:0,dash:3,duty:.5,size:1,margin:28,frame:0,tracking:0,leading:1,glow:0};
const opts={geometry:'parallel',wave:'sine',inside:'rules',outside:'rules',profile:'step',jogs:'open',pen:'flat',second:'none',secondField:'auto',secondInk:'rules',ink:'solid',ground:'plain',under:'none',fill:'fit',band:'bottom',format:'a',font:'archivo'};
// Palette roles: paper, rules, letters (two-tone rules, fills, outlines), accent (gradients, alternate and second-layer ink).
export const FAMILIES=[
 {id:'wobble',name:'Phase wobble',after:'Giliane Cachin, RKC 2020',text:'RKC',colors:['#f3f2ec','#141414','#141414','#141414'],
  set:{...opts,fill:'stretch',band:'sides',pen:'round',params:{...base,pitch:7,weight:.3,waveAmp:.12,waveLen:1.4,insideAmp:.2,insidePhase:90,insideWeight:2.6,feather:40,margin:10,leading:.9}},
  note:'Every rule trembles with a fine wave and swells inside a blurred letter mask, so the letters appear as soft dark shapes in the grain.'},
 {id:'gap',name:'Cut field',after:'FUBU, @tanjabailiff and others',text:'FU/BU',colors:['#e3271d','#f4efe8','#f4efe8','#e3271d'],
  set:{...opts,inside:'gap',font:'mono',fill:'stretch',params:{...base,pitch:11,weight:.5,margin:0,leading:.7}},
  note:'White rules on red stop exactly at every outline. The letters are just the red that is left.'},
 {id:'trace',name:'Jogged trace',after:'Giliane Cachin and Viltė Jurgutytė, RKC',text:'RKC',colors:['#1d3de6','#f6f7f2','#f6f7f2','#16d68c'],
  set:{...opts,inside:'gap',jogs:'ticks',ground:'gradient',band:'sides',font:'anton',fill:'stretch',params:{...base,pitch:16,weight:.12,margin:40,leading:1.2}},
  note:'Hairlines on a blue-to-green ground stop at every outline and end in a short crossbar, so the letters are drawn by gaps and ticks alone.'},
 {id:'relief',name:'Pinched relief',after:'Spatial Positions 10, @heee88',text:'SOUND OF/ARCHI/TEC/TURE/S AM',title:'SPATIAL POSITIONS 10: 05.09.–18.10.2015',info:'IN KOOPERATION MIT ZEITRÄUME BASEL / SCHWEIZERISCHES ARCHITEKTURMUSEUM / STEINENBERG 7 · BASEL',colors:['#f5f4ef','#121212','#121212','#121212'],
  set:{...opts,fill:'justify',band:'top',under:'outline',font:'archivo',params:{...base,pitch:10,weight:.55,shift:.5,insideWeight:.55,pinch:1,reach:70,spread:.45,frame:22,margin:4,leading:.95}},
  note:'Each row is justified edge to edge; inside the outlined letters the rules jump half a step, and between rows they pinch into fans that meet at the side edges.'},
 {id:'moire',name:'Neon moiré',after:'new — electro',text:'AFTER/HOURS',colors:['#06050a','#3df5ff','#ff3df2','#3df5ff'],
  set:{...opts,second:'everywhere',ink:'two-tone',pen:'round',font:'unbounded',fill:'rows',params:{...base,pitch:6.5,weight:.32,angle:84,shift:.5,cross:7,glow:2.2,margin:30}},
  note:'Two thin fields cross at a shallow angle and beat into moiré; inside the letters both shift half a step and switch to magenta.'},
 {id:'rings',name:'Ring swell',after:'new — concentric',text:'ORBIT',colors:['#0b0b0b','#d7ff3a','#d7ff3a','#d7ff3a'],
  set:{...opts,geometry:'rings',font:'mono',params:{...base,pitch:9,weight:.42,insideWeight:2.2,cx:.5,cy:.42,margin:36}},
  note:'Concentric rings round one centre thicken inside the letters until they nearly close into solid acid type.'},
 {id:'rays',name:'Sun gap',after:'new — radial',text:'SOL/AR',colors:['#ffef3d','#ff2b6e','#1a1a1a','#ff2b6e'],
  set:{...opts,geometry:'rays',inside:'gap',under:'letters',font:'archivo',params:{...base,pitch:14,weight:.5,cx:.5,cy:.45,margin:44}},
  note:'A sunburst of rays breaks off at the letters, which are filled solid underneath.'},
 {id:'swell',name:'Scanline swell',after:'new — barcode',text:'SCAN/LINE',colors:['#0c0a12','#ff4fd8','#ff4fd8','#ffb23d'],
  set:{...opts,ink:'gradient',font:'anton',fill:'rows',params:{...base,pitch:7,weight:.22,angle:0,insideWeight:4,feather:7,margin:30}},
  note:'Horizontal scanlines swell inside the letters until they almost close, under a magenta-to-amber gradient.'},
 {id:'hatch',name:'Cross hatch',after:'new — engraving',text:'CROSS/HATCH',colors:['#f1ece0','#1b2a6b','#1b2a6b','#1b2a6b'],
  set:{...opts,inside:'gap',second:'inside',font:'archivo',fill:'stretch',params:{...base,pitch:7,weight:.38,angle:45,cross:90,insideWeight:1.6,margin:40,leading:1.2}},
  note:'Diagonal rules stop at the letters, and a second field at a right angle fills them, like an engraving.'},
 {id:'dome',name:'Pillow dome',after:'new — inflated',text:'BLOW/UP',colors:['#0e0d1f','#9dfcff','#9dfcff','#ff7ae6'],
  set:{...opts,profile:'dome',ink:'gradient',font:'unbounded',fill:'rows',params:{...base,pitch:7.5,weight:.36,angle:0,shift:-2.6,feather:42,glow:1.6,margin:34}},
  note:'Horizontal rules bulge over a rounded profile inside each letter, so the type looks inflated under a cyan-to-pink sheen.'},
 {id:'tremor',name:'Tremor',after:'new — vibration',text:'SHA/KE',colors:['#f2f0ea','#e8241f','#e8241f','#e8241f'],
  set:{...opts,pen:'round',fill:'rows',params:{...base,pitch:8,weight:.3,insideAmp:.6,insideFreq:2.2,waveLen:5,margin:24,leading:.9}},
  note:'The field stays calm; inside the letters every rule shivers at twice the frequency.'},
 {id:'groove',name:'Spiral groove',after:'new — spiral',text:'GROO/VE',colors:['#101010','#f2eee6','#ff5a1f','#f2eee6'],
  set:{...opts,geometry:'spiral',ink:'two-tone',font:'mono',fill:'rows',params:{...base,pitch:7,weight:.42,shift:.5,cy:.47,margin:40,leading:.9}},
  note:'One spiral groove winds out from the centre like a record; inside the letters it jumps half a turn and turns orange.'},
 {id:'boxes',name:'Box tunnel',after:'new — concentric boxes',text:'WELT/FOR/MAT',colors:['#f3f0ea','#e1251b','#141414','#e1251b'],
  set:{...opts,geometry:'rings',inside:'gap',under:'letters',font:'anton',fill:'rows',params:{...base,pitch:10,weight:.5,squareness:1,aspect:.72,cy:.46,margin:100,leading:1}},
  note:'Concentric boxes the shape of the sheet close in on its centre and stop at the black letters.'},
 {id:'contour',name:'Contour echo',after:'new — contours',text:'ECHO',colors:['#05060a','#7cf7ff','#ffe14d','#7cf7ff'],
  set:{...opts,geometry:'contour',inside:'gap',under:'letters',pen:'round',font:'unbounded',fill:'rows',params:{...base,pitch:9,weight:.4,glow:1.6,margin:50}},
  note:'The field is the letters’ own contour lines, echoing out across the sheet in cyan around solid yellow letters.'},
 {id:'drift',name:'Noise drift',after:'new — flow',text:'DRIFT',colors:['#eeeae0','#1e1e1e','#3f2bff','#1e1e1e'],
  set:{...opts,ink:'two-tone',pen:'round',font:'archivo',fill:'rows',params:{...base,pitch:7,weight:.4,angle:90,warp:3.2,warpScale:240,seed:11,shift:.5,margin:40}},
  note:'Parallel rules bend through a smooth noise field like silk; inside the letters they shift half a step into ultramarine.'},
 {id:'halftone',name:'Dot screen',after:'new — halftone',text:'HALF/TONE',colors:['#f4f1e8','#16a3d9','#16a3d9','#16a3d9'],
  set:{...opts,pen:'dots',font:'archivo',fill:'rows',params:{...base,pitch:9,weight:.3,angle:30,insideWeight:3.2,feather:22,dash:1,margin:36}},
  note:'Rows of dots grow inside a soft letter mask into a halftone screen: the letters are made of dot size alone.'},
 {id:'morse',name:'Dash code',after:'new — dashes',text:'CO/DE',colors:['#0b0b0e','#ff9d00','#fff1d0','#ff9d00'],
  set:{...opts,pen:'dash',ink:'two-tone',font:'mono',fill:'rows',params:{...base,pitch:12,weight:.36,angle:0,dash:2.2,duty:.55,insidePhase:180,insideWeight:1.5,margin:44}},
  note:'Rules broken into dashes; inside the letters the dashes run half a period out of step, thicken and turn pale, so the letters show as a seam in the code.'},
 {id:'zigzag',name:'Zigzag',after:'new — triangle wave',text:'ZIG/ZAG',colors:['#ff3d7f','#14123b','#14123b','#14123b'],
  set:{...opts,wave:'triangle',pen:'round',font:'archivo',fill:'rows',params:{...base,pitch:10,weight:.3,angle:0,insideAmp:.75,insideFreq:1.6,waveLen:3,margin:34}},
  note:'Horizontal rules break into sharp zigzags inside the letters and stay straight outside.'},
 {id:'pulse',name:'Square pulse',after:'new — square wave',text:'PUL/SE',colors:['#0a0c10','#3dff8b','#3dff8b','#3dff8b'],
  set:{...opts,wave:'square',pen:'round',font:'mono',fill:'rows',params:{...base,pitch:12,weight:.22,waveAmp:.2,waveLen:2,insidePhase:180,insideAmp:.2,insideWeight:2,glow:1.4,margin:40}},
  note:'Every rule carries a square pulse; inside the letters the pulse flips, like a signal trace.'},
 {id:'prism',name:'Prism scan',after:'new — rainbow',text:'PRI/SM',colors:['#09080d','#ff3b6b','#ffffff','#ff3b6b'],
  set:{...opts,ink:'rainbow',font:'anton',fill:'rows',params:{...base,pitch:8,weight:.24,angle:0,insideWeight:3.4,feather:6,margin:34}},
  note:'Scanlines walk through the spectrum from top to bottom and swell inside the letters.'},
 {id:'lattice',name:'Lattice hole',after:'new — grid',text:'GR/ID',colors:['#e9e6dc','#121212','#121212','#2e5bff'],
  set:{...opts,inside:'gap',second:'outside',secondField:'parallel',secondInk:'accent',font:'mono',fill:'rows',params:{...base,pitch:9,weight:.36,angle:90,cross:90,secondPitch:1,margin:40}},
  note:'A black and a blue field weave a grid; the letters are holes cut through both.'},
 {id:'terrace',name:'Terraces',after:'new — topography',text:'TER/RA',colors:['#f0ebe0','#3b2a1a','#3b2a1a','#3b2a1a'],
  set:{...opts,profile:'terrace',font:'unbounded',fill:'rows',params:{...base,pitch:6.5,weight:.4,angle:0,shift:-2.4,feather:46,margin:36}},
  note:'Inside the letters the rules step down in terraces, like contour lines on a relief map.'}
];
// Controls that only apply to some modules carry when (all must match) and unless (disabled when all match).
const when=(k,v)=>({[k]:v}),POLAR=['rings','rays','spiral'];
export const CONTROLS=[
 {key:'pitch',label:'Rule pitch',group:'field',min:3,max:90,step:.5},
 {key:'weight',label:'Rule weight',group:'field',min:.02,max:1,step:.01},
 {key:'angle',label:'Direction',group:'field',min:0,max:180,step:1,when:when('geometry',['parallel','rays','spiral','rings'])},
 {key:'cx',label:'Centre across',group:'field',min:0,max:1,step:.01,when:when('geometry',POLAR)},
 {key:'cy',label:'Centre down',group:'field',min:0,max:1,step:.01,when:when('geometry',POLAR)},
 {key:'arms',label:'Spiral arms',group:'field',min:1,max:8,step:1,when:when('geometry',['spiral'])},
 {key:'squareness',label:'Ring squareness',group:'field',min:0,max:1,step:.01,when:when('geometry',['rings'])},
 {key:'aspect',label:'Ring aspect',group:'field',min:.4,max:2.5,step:.01,when:when('geometry',['rings'])},
 {key:'waveAmp',label:'Field wave',group:'field',min:0,max:2,step:.01},
 {key:'waveLen',label:'Wavelength',group:'field',min:1,max:40,step:.1},
 {key:'wavePhase',label:'Wave phase',group:'field',min:0,max:360,step:1},
 {key:'warp',label:'Noise warp',group:'warp',min:0,max:8,step:.05},
 {key:'warpScale',label:'Warp scale',group:'warp',min:40,max:800,step:5},
 {key:'seed',label:'Warp seed',group:'warp',min:0,max:99,step:1},
 {key:'pinch',label:'Row pinch',group:'warp',min:0,max:1,step:.01,when:when('geometry',['parallel'])},
 {key:'reach',label:'Pinch reach',group:'warp',min:5,max:240,step:1,when:when('geometry',['parallel'])},
 {key:'spread',label:'Pinch spread',group:'warp',min:0,max:1,step:.01,when:when('geometry',['parallel'])},
 {key:'cross',label:'Second field turn',group:'second',min:1,max:90,step:1,when:when('second',['inside','outside','everywhere']),unless:{geometry:['rays'],secondField:['auto']}},
 {key:'secondPitch',label:'Second field pitch',group:'second',min:.25,max:4,step:.05,when:when('second',['inside','outside','everywhere'])},
 {key:'shift',label:'Shift inside',group:'letters',min:-3,max:3,step:.01},
 {key:'insideAmp',label:'Wave inside',group:'letters',min:0,max:2,step:.01},
 {key:'insidePhase',label:'Phase inside',group:'letters',min:0,max:360,step:1},
 {key:'insideFreq',label:'Frequency inside',group:'letters',min:.25,max:4,step:.05},
 {key:'insideWeight',label:'Weight inside',group:'letters',min:0,max:4,step:.01},
 {key:'feather',label:'Edge softness',group:'letters',min:0,max:80,step:.5},
 {key:'dash',label:'Dash period',group:'pen',min:.5,max:12,step:.05,when:when('pen',['dash','dots'])},
 {key:'duty',label:'Dash length',group:'pen',min:.1,max:.9,step:.01,when:when('pen',['dash'])},
 {key:'size',label:'Letter size',group:'layout',min:.3,max:1.6,step:.01},
 {key:'margin',label:'Margin',group:'layout',min:0,max:160,step:1},
 {key:'frame',label:'Paper frame',group:'layout',min:0,max:90,step:1},
 {key:'tracking',label:'Tracking',group:'layout',min:-.15,max:.6,step:.005},
 {key:'leading',label:'Row spacing',group:'layout',min:.4,max:3,step:.01},
 {key:'glow',label:'Glow',group:'colour',min:0,max:8,step:.1}
];
export const applies=(c,state)=>(!c.when||Object.entries(c.when).every(([k,v])=>v.includes(state[k])))&&!(c.unless&&Object.entries(c.unless).every(([k,v])=>v.includes(state[k])));
export const n=v=>Math.round(v*100)/100;
const n1=v=>Math.round(v*10)/10,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2,frac=x=>x-Math.floor(x);
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;},luminance=h=>{const [r,g,b]=rgb(h).map(lin);return .2126*r+.7152*g+.0722*b;};
export const inkFor=paper=>luminance(paper)>.22?'#141414':'#f4f1ea';
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const mulberry=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
// OKLCH helpers for the rainbow ink: walk the hue of the rules ink, keeping its lightness.
function toOklch(hex){const [r,g,b]=rgb(hex).map(lin),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 const L=.2104542553*l+.793617785*m-.0040720468*s,A=1.9779984951*l-2.428592205*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.8086757660*s;return [L,Math.hypot(A,B),Math.atan2(B,A)*180/Math.PI];}
function oklch(L,C,h){const rgbOf=c=>{const a=c*Math.cos(h*Math.PI/180),b=c*Math.sin(h*Math.PI/180),l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
  return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];};
 let c=C,v=rgbOf(c);for(let i=0;i<24&&v.some(x=>x<-1e-4||x>1+1e-4);i++){c*=.88;v=rgbOf(c);}
 return '#'+v.map(x=>{x=clamp(x,0,1);x=x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;return Math.round(x*255).toString(16).padStart(2,'0');}).join('');}

// Text: any character of the chosen face. '/' or a line break starts a row (up to six).
export function normalizeText(input,font='archivo',fallback){
 const t=String(input??'').normalize('NFC').replace(/[‘’`´]/g,"'").replace(/\r?\n/g,'/').replace(/\s*\/\s*/g,'/').replace(/[ \t]+/g,' ').trim();
 if(!t){if(fallback!==undefined)return fallback;throw new Error('Type at least one character.');}
 const glyphs=FONTS[font]?.glyphs??{},bad=[...new Set([...t].filter(ch=>ch!=='/'&&!glyphs[ch]))];if(bad.length)throw new Error(`Not in ${FONTS[font]?.name??font}: ${bad.join(' ')}`);
 const rows=t.split('/');if(rows.length>6)throw new Error('Use at most six rows.');if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if([...t.replace(/[ /]/g,'')].length>40)throw new Error('Use at most 40 characters.');return rows.map(r=>r.trim()).join('/');}

const clampNum=(v,c,d)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):d;
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS)params[c.key]=clampNum(input.params?.[c.key],c,set.params[c.key]);
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],font=pick('font');let text;try{text=normalizeText(input.text,font,family.text);}catch{text=family.text;}
 const colors=Array.isArray(input.colors)&&input.colors.length===4&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&]/g,'').slice(0,max):d;
 return {engine:ENGINE,family:family.id,text,title:clip(input.title,family.title??'RULE FIELD LETTERS',48),info:clip(input.info,family.info??'Type system study / letters made only by breaks, shifts and waves in one field of rules',120),
  stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,...Object.fromEntries(Object.keys(OPTIONS).map(k=>[k,pick(k)])),params,colors};}

// Glyph outlines: parsed once per face and character, flattened in font units.
const parsed=new Map();
function contours(font,ch){const key=font+'\u0000'+ch;if(parsed.has(key))return parsed.get(key);
 const tok=FONTS[font].glyphs[ch].d.match(/[MLQCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)||[],list=[];let i=0,cmd=null,cur=null;
 const take=k=>{const a=[];for(let j=0;j<k;j++)a.push([+tok[i+2*j],+tok[i+2*j+1]]);i+=2*k;return a;};
 while(i<tok.length){if(/[MLQCZ]/.test(tok[i]))cmd=tok[i++];else if(!cmd){i++;continue;}
  if(cmd==='M'){cur={start:take(1)[0],segs:[]};list.push(cur);cmd='L';}else if(cmd==='Z')cmd=null;else cur.segs.push([cmd,...take({L:1,Q:2,C:3}[cmd])]);}
 parsed.set(key,list);return list;}
function flatten(c,tol){const pts=[c.start];let p=c.start;
 for(const [k,...q] of c.segs){if(k==='L'){pts.push(q[0]);p=q[0];continue;}
  const P=[p,...q],d2=(a,b,e)=>Math.hypot(a[0]-2*b[0]+e[0],a[1]-2*b[1]+e[1]),dd=k==='Q'?d2(P[0],P[1],P[2]):Math.max(d2(P[0],P[1],P[2]),d2(P[1],P[2],P[3])),m=clamp(Math.ceil(Math.sqrt(dd/(4*tol))),1,48);
  for(let s=1;s<=m;s++){const t=s/m,u=1-t;pts.push(k==='Q'?[0,1].map(a=>u*u*P[0][a]+2*u*t*P[1][a]+t*t*P[2][a]):[0,1].map(a=>u*u*u*P[0][a]+3*u*u*t*P[1][a]+3*u*t*t*P[2][a]+t*t*t*P[3][a]));}
  p=P[P.length-1];}
 return pts;}

// Sets the copy into box B. Fit keeps proportions; rows scale each row to the
// full width; stretch also gives every row the same height (the source posters).
function setText(state,B){const p=state.params,font=FONTS[state.font],cap=font.capHeight;
 const rows=state.text.split('/').map(row=>{let x=0,sp=false;const glyphs=[];for(const ch of row){if(ch!==' '){const cs=contours(state.font,ch).map(c=>({c,pts:flatten(c,.5)})),xs=cs.flatMap(c=>c.pts.map(q=>q[0]));glyphs.push({ch,x,sp,cs,ix0:Math.min(0,...xs),ix1:Math.max(1,...xs)});}sp=ch===' ';x+=font.glyphs[ch].adv+p.tracking*1000;}
  let x0=Infinity,x1=-Infinity,y0=-cap,y1=0;for(const g of glyphs)for(const c of g.cs)for(const [a,b] of c.pts){x0=Math.min(x0,a+g.x);x1=Math.max(x1,a+g.x);y0=Math.min(y0,b);y1=Math.max(y1,b);}
  if(!glyphs.length){x0=0;x1=Math.max(1,x);}return {glyphs,x0,x1,y0,y1,w:Math.max(1,x1-x0),h:y1-y0};});
 const gap=cap*(p.leading-.84),k=rows.length,T=[];
 const g=B.h*.025*(p.leading-.84)/.16,slot=Math.max(4,(B.h-g*(k-1))/k);
 if(state.fill==='stretch')rows.forEach((r,i)=>T.push({sx:B.w/r.w,sy:slot/r.h,tx:B.x-r.x0*B.w/r.w,ty:B.y+i*(slot+g)-r.y0*slot/r.h}));
 // Justify keeps each glyph's shape and spreads the row edge to edge; a word space counts as two gaps. Rows too long for the measure condense.
 else if(state.fill==='justify')rows.forEach((r,i)=>{const sy=slot/r.h,G=r.glyphs,sum=G.reduce((a,q)=>a+q.ix1-q.ix0,0),units=G.reduce((a,q,j)=>a+(j?(q.sp?2:1):0),0),sx=Math.min(sy,(B.w-Math.max(0,p.tracking)*cap*sy*units)/Math.max(1,sum)),gp=units?(B.w-sum*sx)/units:0;
  let x=B.x+(units?0:(B.w-sum*sx)/2);G.forEach((q,j)=>{if(j)x+=gp*(q.sp?2:1);q.x=(x-B.x)/sx-q.ix0;x+=(q.ix1-q.ix0)*sx;});T.push({sx,sy,tx:B.x,ty:B.y+i*(slot+g)-r.y0*sy});});
 else{const ks=rows.map(r=>state.fill==='rows'?B.w/r.w:1),bw=Math.max(...rows.map((r,i)=>r.w*ks[i])),mean=ks.reduce((a,b)=>a+b,0)/k,bh=rows.reduce((s,r,i)=>s+r.h*ks[i],0)+gap*mean*(k-1),f=Math.min(B.w/bw,B.h/bh);
  let y=B.y+(B.h-bh*f)/2;rows.forEach((r,i)=>{const s=ks[i]*f;T.push({sx:s,sy:s,tx:B.x+(B.w-r.w*s)/2-r.x0*s,ty:y-r.y0*s});y+=r.h*s+gap*mean*f;});}
 const cx=B.x+B.w/2,cy=B.y+B.h/2,z=p.size,glyphs=[];
 rows.forEach((r,i)=>{const t=T[i],X=x=>cx+(t.tx+t.sx*x-cx)*z,Y=y=>cy+(t.ty+t.sy*y-cy)*z;
  for(const g of r.glyphs){const rings=g.cs.map(c=>c.pts.map(([a,b])=>[X(a+g.x),Y(b)])),pt=([a,b])=>`${n1(X(a+g.x))} ${n1(Y(b))}`;
   const d=g.cs.map(({c})=>'M'+pt(c.start)+c.segs.map(([k,...q])=>k+q.map(pt).join(' ')).join('')+'Z').join('');
   const edges=[];let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
   for(const ring of rings)for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];edges.push(a[0],a[1],b[0],b[1]);x0=Math.min(x0,a[0]);x1=Math.max(x1,a[0]);y0=Math.min(y0,a[1]);y1=Math.max(y1,a[1]);}
   glyphs.push({ch:g.ch,d,edges:Float64Array.from(edges),x0,y0,x1,y1});}});
 // Pinch lines: above the first row, between rows and below the last.
 const tops=rows.map((r,i)=>cy+(T[i].ty+T[i].sy*r.y0-cy)*z),bots=rows.map((r,i)=>cy+(T[i].ty+T[i].sy*r.y1-cy)*z),gaps=tops.slice(1).map((t,i)=>t-bots[i]),h=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length/2:(bots[0]-tops[0])*.08;
 glyphs.lines=[tops[0]-h,...gaps.map((d,i)=>bots[i]+d/2),bots[k-1]+h];return glyphs;}

// The mask: exact nonzero winding on the flattened outlines, plus a signed
// distance raster (positive inside) for soft edges, contours and quick far-field tests.
function edt1(f,n,d,v,z){let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
 for(let q=1;q<n;q++){let s;do{const r=v[k];s=((f[q]+q*q)-(f[r]+r*r))/(2*q-2*r);}while(s<=z[k]&&--k>=0);k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}
 k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;const r=v[k];d[q]=(q-r)*(q-r)+f[r];}}
function edt(grid,gw,gh){const INF=1e20,out=new Float64Array(gw*gh),f=new Float64Array(Math.max(gw,gh)),d=new Float64Array(f.length),v=new Int32Array(f.length),z=new Float64Array(f.length+1);
 for(let x=0;x<gw;x++){for(let y=0;y<gh;y++)f[y]=grid[y*gw+x]?0:INF;edt1(f,gh,d,v,z);for(let y=0;y<gh;y++)out[y*gw+x]=d[y];}
 for(let y=0;y<gh;y++){for(let x=0;x<gw;x++)f[x]=out[y*gw+x];edt1(f,gw,d,v,z);for(let x=0;x<gw;x++)out[y*gw+x]=d[x];}
 return out;}
function makeMask(glyphs,F){const cs=Math.max(F.w,F.h)/420,pad=6,ox=F.x-pad*cs,oy=F.y-pad*cs,gw=Math.ceil(F.w/cs)+2*pad,gh=Math.ceil(F.h/cs)+2*pad,ins=new Uint8Array(gw*gh);
 const winding=(x,y)=>{let w=0;for(const g of glyphs){if(x<g.x0||x>g.x1||y<g.y0||y>g.y1)continue;const e=g.edges;
  for(let i=0;i<e.length;i+=4){const ax=e[i],ay=e[i+1],bx=e[i+2],by=e[i+3];if(ay<=y){if(by>y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)>0)w++;}else if(by<=y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)<0)w--;}}return w!==0;};
 for(let j=0;j<gh;j++){const y=oy+(j+.5)*cs,xs=[];for(const g of glyphs){if(y<g.y0||y>g.y1)continue;const e=g.edges;
   for(let i=0;i<e.length;i+=4){const ay=e[i+1],by=e[i+3];if((ay<=y)!==(by<=y))xs.push([e[i]+(y-ay)*(e[i+2]-e[i])/(by-ay),by>ay?1:-1]);}}
  xs.sort((a,b)=>a[0]-b[0]);let w=0;for(let m=0;m<xs.length-1;m++){w+=xs[m][1];if(!w)continue;for(let i=Math.max(0,Math.ceil((xs[m][0]-ox)/cs-.5)),e=Math.min(gw-1,Math.floor((xs[m+1][0]-ox)/cs-.5));i<=e;i++)ins[j*gw+i]=1;}}
 const toOut=edt(ins.map(v=>v?0:1),gw,gh),toIn=edt(ins,gw,gh),sdg=new Float32Array(gw*gh);for(let i=0;i<sdg.length;i++)sdg[i]=ins[i]?(Math.sqrt(toOut[i])-.5)*cs:-(Math.sqrt(toIn[i])-.5)*cs;
 const sd=(x,y)=>{const fx=clamp((x-ox)/cs-.5,0,gw-1.001),fy=clamp((y-oy)/cs-.5,0,gh-1.001),i=fx|0,j=fy|0,a=fx-i,b=fy-j,o=j*gw+i;return (sdg[o]*(1-a)+sdg[o+1]*a)*(1-b)+(sdg[o+gw]*(1-a)+sdg[o+gw+1]*a)*b;};
 // Exact distance to the nearest outline edge, for checks.
 const distance=(x,y)=>{let best=Infinity;for(const g of glyphs){if(x<g.x0-best||x>g.x1+best||y<g.y0-best||y>g.y1+best)continue;const e=g.edges;
  for(let i=0;i<e.length;i+=4){const ax=e[i],ay=e[i+1],dx=e[i+2]-ax,dy=e[i+3]-ay,l=dx*dx+dy*dy,t=l?clamp(((x-ax)*dx+(y-ay)*dy)/l,0,1):0;best=Math.min(best,Math.hypot(x-ax-dx*t,y-ay-dy*t));}}return best;};
 return {sd,winding,distance,inside:(x,y,s)=>Math.abs(s)<3*cs?winding(x,y):s>0,cell:cs,grid:{sdg,gw,gh,ox,oy,cs}};}
const EMPTY={sd:()=>-1e9,winding:()=>false,inside:()=>false,cell:1};

// Iso-lines of the distance raster (marching squares), linked into polylines.
function isolines(grid,levels){const {sdg,gw,gh,ox,oy,cs}=grid,byLevel=levels.map(()=>[]),lo=levels[0],step=levels.length>1?levels[1]-levels[0]:1;
 for(let j=0;j<gh-1;j++)for(let i=0;i<gw-1;i++){const o=j*gw+i,a=sdg[o],b=sdg[o+1],c=sdg[o+gw+1],d=sdg[o+gw],mn=Math.min(a,b,c,d),mx=Math.max(a,b,c,d);
  for(let k=Math.max(0,Math.ceil((mn-lo)/step));k<levels.length&&levels[k]<=mx;k++)if(levels[k]>mn)byLevel[k].push(o);}
 return byLevel.map((cells,k)=>{const L=levels[k],pts=new Map(),adj=new Map(),link=(e1,e2)=>{for(const [a,b] of [[e1,e2],[e2,e1]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}};
  // Edge ids: 2·cell for the top edge of a cell, 2·cell+1 for its left edge.
  const point=(id)=>{if(pts.has(id))return pts.get(id);const o=id>>1,i=o%gw,j=(o-i)/gw,h=!(id&1),i2=h?i+1:i,j2=h?j:j+1,va=sdg[o]-L,vb=sdg[j2*gw+i2]-L,t=va/(va-vb),p=[ox+(i+.5+(i2-i)*t)*cs,oy+(j+.5+(j2-j)*t)*cs];pts.set(id,p);return p;};
  for(const o of cells){const v=[sdg[o]-L>0,sdg[o+1]-L>0,sdg[o+gw+1]-L>0,sdg[o+gw]-L>0],T=2*o,R=2*(o+1)+1,B=2*(o+gw),Lf=2*o+1,e=[];
   if(v[0]!==v[1])e.push(T);if(v[1]!==v[2])e.push(R);if(v[2]!==v[3])e.push(B);if(v[3]!==v[0])e.push(Lf);
   if(e.length===2)link(e[0],e[1]);else if(e.length===4){const centre=(sdg[o]+sdg[o+1]+sdg[o+gw]+sdg[o+gw+1])/4-L>0;if(centre===v[0]){link(T,R);link(B,Lf);}else{link(T,Lf);link(R,B);}}}
  const seen=new Set(),lines=[];
  for(const start of adj.keys()){if(seen.has(start))continue;const ends=adj.get(start);let first=start;
   if(ends.length===2){let prev=start,cur=ends[0];while(cur!==undefined&&cur!==start&&adj.get(cur).length===2){const nx=adj.get(cur).find(x=>x!==prev);prev=cur;cur=nx;}if(cur!==undefined&&cur!==start)first=cur;}
   const chain=[first];seen.add(first);let prev=null,cur=first,closed=false;
   for(;;){const nx=(adj.get(cur)||[]).find(x=>x!==prev&&(!seen.has(x)||(x===first&&chain.length>2)));if(nx===undefined)break;if(nx===first){closed=true;break;}chain.push(nx);seen.add(nx);prev=cur;cur=nx;}
   if(chain.length>2)lines.push({pts:chain.map(point),closed});}
  return lines;});}

// Fields: each returns rules — a parameter range, an optional closed flag, a frame
// (point, tangent, normal) per u, and a rainbow fraction.
const FIELDS={
 parallel(F,P,turn,pad){const out=[],corners=[[F.x,F.y],[F.x+F.w,F.y],[F.x,F.y+F.h],[F.x+F.w,F.y+F.h]],a=(P.angle+turn)*Math.PI/180,tx=Math.cos(a),ty=Math.sin(a),nx=-ty,ny=tx,C=[F.x+F.w/2,F.y+F.h/2],us=corners.map(([x,y])=>(x-C[0])*tx+(y-C[1])*ty),vs=corners.map(([x,y])=>(x-C[0])*nx+(y-C[1])*ny);
  const k0=Math.ceil((Math.min(...vs)-pad)/P.pitch),k1=Math.floor((Math.max(...vs)+pad)/P.pitch);
  for(let k=k0;k<=k1;k++){const v=k*P.pitch;out.push({u0:Math.min(...us)-pad,u1:Math.max(...us)+pad,frac:()=>(k-k0)/Math.max(1,k1-k0),at:u=>({x:C[0]+tx*u+nx*v,y:C[1]+ty*u+ny*v,tx,ty,nx,ny})});}return out;},
 // Rings follow a superellipse: squareness 0 is a circle, 1 a box with small rounded corners; aspect stretches them across.
 rings(F,P,turn,pad){const out=[],O=centre(F,P),e=2+18*P.squareness**1.6,ax=Math.sqrt(P.aspect),ay=1/ax,rot=(P.angle-90+turn)*Math.PI/180,cr=Math.cos(rot),sr=Math.sin(rot),R=reach(F,O)/Math.min(ax,ay)+pad;
  // Arc length of the unit shape against its angle parameter, so rules are sampled evenly along their length
  // (a box's angle parameter crowds its corners and leaves the middle of each side bare).
  // The shape is parameterised by its polar angle, which spreads points evenly along flat sides.
  const unit=t=>{const c=Math.cos(t),s=Math.sin(t),q=(Math.abs(c)**e+Math.abs(s)**e)**(-1/e);return [c*q,s*q];},shape=t=>{const [X,Y]=unit(t);return [X*ax,Y*ay];},N=4096,cum=new Float64Array(N+1);
  for(let i=0,p=shape(0);i<N;i++){const q=shape(TAU*(i+1)/N);cum[i+1]=cum[i]+Math.hypot(q[0]-p[0],q[1]-p[1]);p=q;}
  const per=cum[N],angleAt=s=>{let lo=0,hi=N;while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=s)lo=m;else hi=m;}return TAU*(lo+(s-cum[lo])/((cum[hi]-cum[lo])||1))/N;},count=Math.floor((R-P.pitch/2)/P.pitch)+1;
  for(let k=0;k<count;k++){const r=P.pitch/2+k*P.pitch,L=per*r;out.push({closed:true,u0:0,u1:L,frac:()=>k/Math.max(1,count-1),at:u=>{const [X,Y]=unit(angleAt(clamp(u/r,0,per))),x=X*ax*r,y=Y*ay*r;
   let gx=Math.sign(x)*Math.abs(x/(ax*r))**(e-1)/ax,gy=Math.sign(y)*Math.abs(y/(ay*r))**(e-1)/ay;const gl=Math.hypot(gx,gy)||1;gx/=gl;gy/=gl;
   return {x:O[0]+x*cr-y*sr,y:O[1]+x*sr+y*cr,nx:gx*cr-gy*sr,ny:gx*sr+gy*cr,tx:-(gx*sr+gy*cr),ty:gx*cr-gy*sr};}});}return out;},
 rays(F,P,turn,pad){const out=[],O=centre(F,P),R=reach(F,O)+pad,Rref=.42*Math.min(F.w,F.h),m=clamp(Math.round(TAU*Rref/P.pitch),6,900),r0=Math.max(2,P.pitch*P.weight*m/TAU);
  for(let k=0;k<m;k++){const a=TAU*k/m+(P.angle+turn)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);out.push({u0:r0,u1:R,frac:()=>k/m,at:u=>({x:O[0]+u*c,y:O[1]+u*s,tx:c,ty:s,nx:-s,ny:c})});}return out;},
 // Archimedean spiral arms, one pitch apart: r = bθ, parameterised by arc length.
 spiral(F,P,turn,pad){const out=[],O=centre(F,P),R=reach(F,O)+pad,arms=P.arms,b=arms*P.pitch/TAU,s=t=>b/2*(t*Math.sqrt(1+t*t)+Math.asinh(t)),t0=P.pitch/(2*b),t1=R/b;
  const inv=u=>{let t=Math.sqrt(Math.max(2*u/b,t0*t0));for(let i=0;i<4;i++)t-=(s(t)-u)/(b*Math.sqrt(1+t*t));return t;};
  for(let k=0;k<arms;k++){const phase=TAU*k/arms+(P.angle-90+turn)*Math.PI/180;out.push({u0:s(t0),u1:s(t1),frac:u=>clamp(inv(u)/t1,0,1),at:u=>{const t=inv(u),r=b*t,A=t+phase,c=Math.cos(A),si=Math.sin(A);
   let tx=b*c-r*si,ty=b*si+r*c;const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;let nx=ty,ny=-tx;if(nx*c+ny*si<0){nx=-nx;ny=-ny;}return {x:O[0]+r*c,y:O[1]+r*si,tx,ty,nx,ny};}});}return out;},
 // The letters' own contour lines, inside and out, one pitch apart; normals point away from the letters.
 contour(F,P,turn,pad,mask){if(!mask.grid)return FIELDS.parallel(F,P,turn,pad);const g=mask.grid;let mn=Infinity,mx=-Infinity;for(const v of g.sdg){if(v<mn)mn=v;if(v>mx)mx=v;}
  const off=frac(turn/90)*P.pitch,levels=[];for(let L=Math.ceil((mn-off)/P.pitch-.5)*P.pitch+P.pitch/2+off;L<mx;L+=P.pitch)levels.push(L);if(!levels.length)return [];
  const out=[];isolines(g,levels).forEach((lines,k)=>{for(const line of lines){const pts=line.closed?[...line.pts,line.pts[0]]:line.pts,cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
   const L=cum[cum.length-1];if(L<P.pitch)continue;const mid=pts[pts.length>>1],nxt=pts[Math.min(pts.length-1,(pts.length>>1)+1)];let sgn=1;{const tx=nxt[0]-mid[0],ty=nxt[1]-mid[1],l=Math.hypot(tx,ty)||1;if(mask.sd(mid[0]+ty/l*g.cs,mid[1]-tx/l*g.cs)>mask.sd(mid[0],mid[1]))sgn=-1;}
   out.push({closed:line.closed,u0:0,u1:L,frac:()=>k/Math.max(1,levels.length-1),at:u=>{let lo=0,hi=cum.length-1;u=clamp(u,0,L);while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=u)lo=m;else hi=m;}
    const a=pts[lo],b=pts[hi],seg=cum[hi]-cum[lo]||1,t=(u-cum[lo])/seg,tx=(b[0]-a[0])/seg,ty=(b[1]-a[1])/seg;return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,tx,ty,nx:ty*sgn,ny:-tx*sgn};}});}});return out;}
};
const centre=(F,P)=>[F.x+P.cx*F.w,F.y+P.cy*F.h],reach=(F,O)=>Math.max(...[[F.x,F.y],[F.x+F.w,F.y],[F.x,F.y+F.h],[F.x+F.w,F.y+F.h]].map(([x,y])=>Math.hypot(x-O[0],y-O[1])));
// Wave shapes on a phase in radians, all within [-1, 1]; square and saw are softened so sampling holds them.
const WAVES={sine:Math.sin,triangle:x=>2/Math.PI*Math.asin(Math.sin(x)),square:x=>Math.tanh(5*Math.sin(x))/Math.tanh(5),saw:x=>{const f=frac(x/TAU);return f<.9?f/.9*2-1:1-(f-.9)/.1*2;}};
// Edge profiles: insideness from signed distance sd over the edge softness f.
const PROFILES={step:(sd,f)=>{const x=clamp((sd+f/2)/f,0,1);return x*x*(3-2*x);},ramp:(sd,f)=>clamp(sd/f,0,1),dome:(sd,f)=>Math.sqrt(1-(1-clamp(sd/f,0,1))**2),terrace:(sd,f)=>sd<=0?0:Math.min(1,Math.floor(clamp(sd/f,0,.9999)*4+1)/4)};
// Noise warp: a smooth field of a few seeded plane waves, pushed along each rule's normal.
function noiseWarp(P,k){if(!P.warp)return null;const r=mulberry(P.seed*7919+13),comps=Array.from({length:5},()=>{const a=r()*TAU,f=(.55+r()*.9)/(P.warpScale*k);return {kx:Math.cos(a)*f*TAU,ky:Math.sin(a)*f*TAU,ph:r()*TAU,amp:.5+r()*.5};}),norm=comps.reduce((s,c)=>s+c.amp,0);
 return b=>P.warp*P.pitch*1.6*comps.reduce((s,c)=>s+c.amp*Math.sin(c.kx*b.x+c.ky*b.y+c.ph),0)/norm;}

// Ramer–Douglas–Peucker on an open polyline.
function simplify(pts,eps){if(pts.length<3)return pts;const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const stack=[[0,pts.length-1]];
 // A closed loop's chord has zero length; distance to its start point then decides.
 while(stack.length){const [a,b]=stack.pop(),[ax,ay]=pts[a],[bx,by]=pts[b],dx=bx-ax,dy=by-ay,l=Math.hypot(dx,dy);let m=-1,md=eps;
  for(let i=a+1;i<b;i++){const d=l>1e-9?Math.abs((pts[i][0]-ax)*dy-(pts[i][1]-ay)*dx)/l:Math.hypot(pts[i][0]-ax,pts[i][1]-ay);if(d>md){md=d;m=i;}}if(m>0){keep[m]=1;stack.push([a,m],[m,b]);}}
 return pts.filter((_,i)=>keep[i]);}
const area=pts=>{let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;};
const ring=pts=>'M'+pts.map(p=>n1(p[0])+' '+n1(p[1])).join('L')+'Z',line=pts=>'M'+pts.map(p=>n1(p[0])+' '+n1(p[1])).join('L');
const disc=(x,y,r)=>`M${n1(x-r)} ${n1(y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2*r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2*r)} 0Z`;

// One rule: sample, find exact outline crossings, blend the two states, split into runs.
function trace(rule,cfg,mask){const {P,hard,cut,f}=cfg,L=rule.u1-rule.u0,count=Math.max(rule.closed?24:2,Math.ceil(L/cfg.step)),du=L/count,wMin=.08,prof=PROFILES[cfg.profile],shape=WAVES[cfg.wave];
 const tOf=(sd,ins)=>cfg.plain?0:hard?(ins?1:0):prof(sd,f);
 const sample=u=>{const b=rule.at(u),sd=mask.sd(b.x,b.y);return {u,b,sd,ins:!cfg.plain&&mask.inside(b.x,b.y,sd)};};
 const S=[];for(let i=0;i<(rule.closed?count:count+1);i++)S.push(sample(rule.u0+i*du));
 // Points in order; a cut sits between the two copies of an exact outline crossing.
 const pts=[];
 for(let i=0;i<S.length;i++){pts.push(S[i]);if(!cut||(i+1===S.length&&!rule.closed))continue;const a=S[i],b=i+1<S.length?S[i+1]:{...S[0],u:rule.u1};if(a.ins===b.ins)continue;
  let lo=a.u,hi=b.u;for(let k=0;k<14;k++){const mid=(lo+hi)/2,m=rule.at(mid);if(mask.winding(m.x,m.y)===a.ins)lo=mid;else hi=mid;}
  const u=(lo+hi)/2,bm=rule.at(u),s0=mask.sd(bm.x,bm.y);pts.push({u,b:bm,sd:s0,ins:a.ins,edge:true},{u,b:bm,sd:s0,ins:b.ins,edge:true,cut:true});}
 const wave=(u,amp,len,ph)=>amp?amp*P.pitch*shape(TAU*u/(len*P.pitch)+ph*Math.PI/180):0,wOut=cfg.outVis?P.weight*P.pitch:0,wIn=cfg.inVis?P.weight*P.insideWeight*P.pitch:0;
 // Row pinch pulls rules toward the side edges at each pinch line, most near the edges: straight fans meet at the edge.
 const pc=cfg.pinch,pin=b=>{if(!pc)return 0;const s=(b.x-pc.C[0])*b.nx+(b.y-pc.C[1])*b.ny,half=(pc.F.w*Math.abs(b.nx)+pc.F.h*Math.abs(b.ny))/2,a=Math.min(1,Math.abs(s)/half);let k=0;for(const g of pc.lines)k=Math.max(k,1-Math.abs(b.y-g)/pc.reach);return k>0?Math.sign(s)*(half-Math.abs(s))*k*a**pc.curve*pc.amount:0;};
 for(const q of pts){const t=q.edge&&hard?(q.ins?1:0):tOf(q.sd,q.ins);q.t=t;q.d=pin(q.b)+(cfg.warp?cfg.warp(q.b):0)+lerp(wave(q.u,P.waveAmp,P.waveLen,P.wavePhase),P.shift*P.pitch+wave(q.u,P.insideAmp,P.waveLen/P.insideFreq,P.wavePhase+P.insidePhase),t);q.w=lerp(wOut,wIn,t);}
 // Closed rules start at a break, so every run is open; unbroken rings stay closed.
 let seq=pts;if(rule.closed){const j=pts.findIndex(q=>q.cut||q.w<wMin);if(j<0)return {runs:[{pts,closed:true,ink:cfg.twoTone&&pts[0].ins?'in':'out',frac:rule.frac(rule.u0+L/2)}],jogs:[]};seq=[...pts.slice(j),...pts.slice(0,j)];}
 const runs=[],jogs=[];let cur=[];const flush=()=>{if(cur.length>1)runs.push({pts:cur,ink:cfg.twoTone&&cur[0].ins?'in':'out',frac:rule.frac(cur[cur.length>>1].u)});cur=[];};
 for(let i=0;i<seq.length;i++){const q=seq[i];if(q.cut){const a=seq[i-1]??(rule.closed?seq[seq.length-1]:null);flush();
   const b=q.b,bar=(w,lo,hi)=>jogs.push({pts:[[-w/2,lo],[w/2,lo],[w/2,hi],[-w/2,hi]].map(([s,d])=>[b.x+b.tx*s+b.nx*d,b.y+b.ty*s+b.ny*d]),frac:rule.frac(q.u)});
   // Connect joins the two sides of a shift; ticks cap a cut rule with a crossbar most of a pitch long.
   if(cfg.jogs==='connect'&&a&&a.w>=wMin&&q.w>=wMin&&Math.abs(a.d-q.d)>.3){const w=Math.max(a.w,q.w);bar(w,Math.min(a.d,q.d)-w/2,Math.max(a.d,q.d)+w/2);}
   if(cfg.jogs==='ticks'&&a&&(a.w>=wMin)!==(q.w>=wMin)){const e=a.w>=wMin?a:q;bar(e.w,e.d-P.pitch*.42,e.d+P.pitch*.42);}}
  if(q.w<wMin){flush();continue;}cur.push(q);}
 flush();return {runs,jogs};}

// Pens. Flat and round give one filled ribbon per run (flat pens offset along the field
// normal and thin where a rule bends; round pens keep their weight and have round ends).
// Dashes cut runs on a pattern along the rule; dots put one disc per period. Inside the
// letters the pattern moves by the inside phase, so letters can show as a seam.
const centreOf=p=>[p.b.x+p.b.nx*p.d,p.b.y+p.b.ny*p.d];
function ribbon(run,pen){const q=run.pts,m=q.length,C=q.map(centreOf),L=[],R=[],tan=[];
 for(let i=0;i<m;i++){let nx=q[i].b.nx,ny=q[i].b.ny;const a=C[i>0?i-1:run.closed?m-1:i],c=C[i<m-1?i+1:run.closed?0:i];let tx=c[0]-a[0],ty=c[1]-a[1];const l=Math.hypot(tx,ty);if(l>1e-9){tx/=l;ty/=l;}else{tx=q[i].b.tx;ty=q[i].b.ty;}tan.push([tx,ty]);
  if(pen!=='flat'){let mx=-ty,my=tx;if(mx*nx+my*ny<0){mx=-mx;my=-my;}nx=mx;ny=my;}const h=q[i].w/2;L.push([C[i][0]+nx*h,C[i][1]+ny*h]);R.push([C[i][0]-nx*h,C[i][1]-ny*h]);}
 if(run.closed){const a=simplify([...L,L[0]],.12).slice(0,-1),b=simplify([...R,R[0]],.12).slice(0,-1),[o,i]=Math.abs(area(a))>=Math.abs(area(b))?[a,b]:[b,a];return ring(area(o)<0?o.reverse():o)+ring(area(i)>0?i.reverse():i);}
 const cap=(k,dir)=>{if(pen!=='round')return [];const [tx,ty]=tan[k],h=q[k].w/2,out=[],base=Math.atan2(L[k][1]-C[k][1],L[k][0]-C[k][0]),side=Math.sign((Math.cos(base+Math.PI/2)*tx+Math.sin(base+Math.PI/2)*ty)*dir)||1;
  for(let s=1;s<8;s++){const a=base+side*Math.PI*s/8;out.push([C[k][0]+Math.cos(a)*h,C[k][1]+Math.sin(a)*h]);}return dir>0?out:out.reverse();};
 const poly=[...cap(0,-1).reverse(),...simplify(L,.12),...cap(m-1,1),...simplify(R,.12).reverse()];return ring(area(poly)<0?poly.reverse():poly);}
function dashed(run,P){const per=P.dash*P.pitch,on=q=>frac(q.u/per+P.insidePhase/360*q.t)<P.duty,out=[];let cur=[];
 for(const q of run.pts){if(on(q))cur.push(q);else{if(cur.length>1)out.push({...run,pts:cur,closed:false});cur=[];}}if(cur.length>1)out.push({...run,pts:cur,closed:false});return out;}
function dotted(run,P){const per=P.dash*P.pitch,pos=q=>q.u/per+P.insidePhase/360*q.t-.5,q=run.pts,out=[];
 for(let i=1;i<q.length;i++){const a=pos(q[i-1]),b=pos(q[i]);if(a===b)continue;for(let k=Math.floor(Math.min(a,b))+1;k<=Math.floor(Math.max(a,b));k++){const t=(k-a)/(b-a),ca=centreOf(q[i-1]),cb=centreOf(q[i]),w=lerp(q[i-1].w,q[i].w,t);
   if(w>=.15)out.push({x:lerp(ca[0],cb[0],t),y:lerp(ca[1],cb[1],t),r:w/2});}}return out;}

// Inks: each run gets a role (rule, letter, accent) or an exact colour (rainbow).
function inkKey(state,run,layer,rule,stage){if(stage<4)return 'rule';if(layer>0)return state.secondInk==='letters'?'letter':state.secondInk==='accent'?'accent':'rule';
 if(run.ink==='in')return 'letter';if(state.ink==='alternate'&&rule%2)return 'accent';
 if(state.ink==='rainbow'){const [L,C,h]=toOklch(state.colors[1]);return oklch(clamp(L,.55,.85),Math.max(C,.15),h+300*Math.round(run.frac*24)/24);}return 'rule';}

// Draws the field into box F for one stage. Returns path data per ink, as filled
// shapes (poster) or centrelines (plotter).
function field(state,F,glyphs,stage,k=1,output='poster'){const p=state.params,P={...p,pitch:p.pitch*k,feather:p.feather*k};
 const mask=glyphs.length&&(stage!==2||state.geometry==='contour'||state.secondField==='contour')?makeMask(glyphs,F):EMPTY;
 const f=Math.max(P.feather,.01),hard=P.feather<.5,twoTone=stage===4&&state.ink==='two-tone',waves=[P.waveAmp&&P.waveLen*P.pitch,P.insideAmp&&P.waveLen*P.pitch/P.insideFreq].filter(Boolean);
 let step=Math.min(3*k,P.pitch*.75,...waves.map(l=>l/14),hard?3:f/4);if(state.pen==='dash'||state.pen==='dots')step=Math.min(step,P.dash*P.pitch/12);step=clamp(step,.45,6);
 const pad=(Math.abs(P.shift)+Math.max(P.waveAmp,P.insideAmp)+P.weight*Math.max(1,P.insideWeight)+P.warp*1.6)*P.pitch+P.pitch;
 const pinch=state.geometry==='parallel'&&P.pinch>0&&glyphs.lines?{lines:glyphs.lines,C:[F.x+F.w/2,F.y+F.h/2],F,reach:P.reach*k,amount:P.pinch,curve:3-2.5*P.spread}:null;
 const cfg={P,hard,f,profile:state.profile,wave:state.wave,step,cut:stage!==2&&(hard||twoTone),twoTone,plain:stage===2,jogs:state.jogs,pinch,warp:noiseWarp(P,k),outVis:stage===2||state.outside==='rules',inVis:stage===2||state.inside==='rules'};
 const layers=[{geometry:state.geometry,turn:0,P,cfg}];
 if(state.second!=='none'&&stage>2){const g=state.secondField==='auto'?(state.geometry==='rings'?'rays':state.geometry==='rays'?'rings':state.geometry):state.secondField,P2={...P,pitch:P.pitch*P.secondPitch};
  layers.push({geometry:g,turn:P.cross,P:P2,cfg:{...cfg,P:P2,pinch:null,outVis:state.second!=='inside'&&(state.second==='outside'||cfg.outVis),inVis:state.second!=='outside'}});}
 // With a hard gap on one side, first-layer runs are marked '#cut': the renderer masks them with the exact outline,
 // so a rule through a slot narrower than its own weight cannot poke into the letters. Jogs and ticks stay whole.
 const clip=stage>2&&hard&&output==='poster'&&(state.inside==='gap')!==(state.outside==='gap');
 const ink=new Map(),feat={rules:0,runs:0,jogs:0,dots:0},add=(key,d)=>{if(!ink.has(key))ink.set(key,[]);ink.get(key).push(d);};
 layers.forEach((layer,li)=>FIELDS[layer.geometry](F,layer.P,layer.turn,pad,mask).forEach((rule,ri)=>{feat.rules++;const {runs,jogs}=trace(rule,layer.cfg,mask);
  for(const run of runs){const key=inkKey(state,run,li,ri,stage)+(clip&&!li?'#cut':'');
   if(state.pen==='dots'){for(const d of dotted(run,layer.P)){add(key,output==='plotter'?disc(d.x,d.y,Math.max(.4,d.r*.5)):disc(d.x,d.y,d.r));feat.dots++;}continue;}
   for(const part of state.pen==='dash'?dashed(run,layer.P):[run]){feat.runs++;add(key,output==='plotter'?line(simplify(part.pts.map(centreOf),.15))+(part.closed?'Z':''):ribbon(part,state.pen));}}
  for(const j of jogs){feat.jogs++;const key=li?inkKey(state,{},li,ri,stage):state.ink==='rainbow'?inkKey(state,{frac:j.frac},0,ri,stage):'rule';add(key,output==='plotter'?line([[(j.pts[0][0]+j.pts[1][0])/2,(j.pts[0][1]+j.pts[1][1])/2],[(j.pts[2][0]+j.pts[3][0])/2,(j.pts[2][1]+j.pts[3][1])/2]]):ring(area(j.pts)<0?j.pts.reverse():j.pts));}}));
 return {ink,features:feat};}

function boxes(state,W,H){const band=state.band,m=state.params.frame,inset=F=>({F:{x:F.x+m,y:F.y+m,w:Math.max(40,F.w-2*m),h:Math.max(40,F.h-2*m)}});
 if(band==='bottom'){const b=Math.round(H*.085);return inset({x:0,y:0,w:W,h:H-b});}
 if(band==='top'){const b=Math.round(H*.088);return inset({x:0,y:b,w:W,h:H-b});}
 if(band==='sides'){const b=Math.round(Math.min(W,H)*.065);return inset({x:b,y:0,w:W-2*b,h:H});}return inset({x:0,y:0,w:W,h:H});}
const esc=s=>s.replace(/[<>&]/g,'');
function infoSVG(state,W,H,ink){const lines=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,3),fam=`font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" fill="${ink}"`;
 if(state.band==='top'){const b=Math.round(H*.088);return `<g ${fam}>${lines.map((l,i)=>`<text x="${n(22+i*(W-44)/lines.length)}" y="24" font-size="9.5" letter-spacing=".3">${esc(l)}</text>`).join('')}<text x="22" y="${b-8}" font-size="${n(Math.min(30,W/25))}" font-weight="700" letter-spacing=".2">${esc(state.title)}</text></g>`;}
 if(state.band==='sides'){const b=Math.round(Math.min(W,H)*.065),x=n(b*.62);return `<g ${fam}><text transform="translate(${x} ${H-22}) rotate(-90)" font-size="15" letter-spacing=".5">${esc(state.title)}</text><text transform="translate(${n(W-b*.62)} 22) rotate(90)" font-size="11" letter-spacing=".3">${esc(lines.join('  ·  '))}</text></g>`;}
 const b=Math.round(H*.085),y=H-b,fs=n(Math.min(19,(W*.46-22)/(Math.max(1,state.title.length)*.6)));return `<g ${fam}><path d="M22 ${y+12}H${W-22}" stroke="${ink}" stroke-width=".8"/><text x="22" y="${y+38}" font-size="${fs}" letter-spacing=".5">${esc(state.title)}</text>${lines.map((l,i)=>`<text x="${n(W*.48)}" y="${y+33+i*15}" font-size="11" letter-spacing=".2">${esc(l)}</text>`).join('')}</g>`;}
const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
const letterBox=(state,F)=>{const m=state.params.margin;return {x:F.x+m,y:F.y+m,w:Math.max(20,F.w-2*m),h:Math.max(20,F.h-2*m)};};
// The fitted letter mask of a rule, for checks and other systems: exact winding, exact distance to the outline, and the signed distance raster (positive inside).
export function letterMask(input={}){const state=resolve(input),fmt=FORMATS[state.format],{F}=boxes(state,fmt.w,fmt.h),glyphs=setText(state,letterBox(state,F)),m=makeMask(glyphs,F);return {state,field:F,inside:m.winding,sd:m.sd,distance:m.distance,outline:glyphs.map(g=>g.d).join('')};}

// Renders a rule. Options: width/height (any box), output 'poster' (filled shapes) or
// 'plotter' (single-line centrelines, one stroke per rule run, no fills or text).
export function render(input={},o={}){const state=resolve(input),fmt=FORMATS[state.format],W=o.width??fmt.w,H=o.height??fmt.h,uid=uidOf(state),stage=state.stage,output=OUTPUTS.includes(o.output)?o.output:'poster',plot=output==='plotter',sep=o.separate;
 // A separation keeps one ink, in black on white; information text goes with the rules ink.
 const [paper,rule,letter,accent]=sep?['#ffffff','#000000','#000000','#000000']:state.colors,keep=key=>!sep||key===sep;
 const {F}=boxes(state,W,H),B=letterBox(state,F),glyphs=setText(state,B),base=k=>k.replace('#cut','');
 const defs=[`<clipPath id="f${uid}"><rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}"/></clipPath>`],body=[],outline=glyphs.map(g=>g.d).join('');let feat={rules:0,runs:0,jogs:0,dots:0},inks=[];
 const ground=!plot&&!sep&&stage===4&&state.ground==='gradient'?(defs.push(`<linearGradient id="g${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${paper}"/><stop offset="1" stop-color="${accent}"/></linearGradient>`),`url(#g${uid})`):paper;
 if(stage===1)body.push(`<path d="${outline}" fill="${rule}" fill-opacity=".14" stroke="${rule}" stroke-width="1.2"/><rect x="${n(B.x)}" y="${n(B.y)}" width="${n(B.w)}" height="${n(B.h)}" fill="none" stroke="#ff3b6b" stroke-dasharray="6 5"/>`);
 else{const r=field(state,F,glyphs,stage,1,output);feat=r.features;
  const ruleFill=!plot&&!sep&&stage===4&&state.ink==='gradient'?(defs.push(`<linearGradient id="i${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="${F.y}" x2="0" y2="${F.y+F.h}"><stop offset="0" stop-color="${rule}"/><stop offset="1" stop-color="${accent}"/></linearGradient>`),`url(#i${uid})`):rule;
  const glow=!plot&&!sep&&stage===4&&state.params.glow>0;if(glow)defs.push(`<filter id="w${uid}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${n(state.params.glow*2)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  if(stage===4&&state.under==='letters'&&keep('letter'))body.push(plot?`<path d="${outline}" fill="none" stroke="${letter}" stroke-width=".6"/>`:`<path d="${outline}" fill="${letter}"/>`);
  const colorOf=key=>sep?'#000000':key==='rule'?ruleFill:key==='letter'?letter:key==='accent'?accent:key,sw=n(Math.max(.4,state.params.pitch*state.params.weight*.6));
  inks=[...new Set([...r.ink.keys()].map(base)),...(stage===4&&state.under!=='none'&&![...r.ink.keys()].some(k=>base(k)==='letter')?['letter']:[])];
  if([...r.ink.keys()].some(k=>k.endsWith('#cut'))){const gapInside=state.inside==='gap';defs.push(`<mask id="m${uid}" maskUnits="userSpaceOnUse" x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}"><rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" fill="${gapInside?'#fff':'#000'}"/><path d="${outline}" fill="${gapInside?'#000':'#fff'}"/></mask>`);}
  const group=([key,paths])=>{const k=base(key),d=paths.join(''),el=plot?`<path d="${d}" fill="none" stroke="${colorOf(k)}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" data-ink="${k}"/>`:`<path d="${d}" fill="${colorOf(k)}" data-ink="${k}"/>`;return key.endsWith('#cut')?`<g mask="url(#m${uid})">${el}</g>`:el;};
  body.push(`<g${glow?` filter="url(#w${uid})"`:''}${stage===2?' opacity=".5"':''}>${[...r.ink].filter(([key])=>keep(base(key))).map(group).join('')}</g>`);
  // Outline strokes the letters over the field, one rule weight wide, in the letter ink.
  if(stage===4&&state.under==='outline'&&keep('letter'))body.push(`<path d="${outline}" fill="none" stroke="${letter}" stroke-width="${n(plot?.8:state.params.pitch*state.params.weight)}" stroke-linejoin="round" data-ink="letter"/>`);
  if(stage===2)body.push(`<path d="${outline}" fill="none" stroke="#ff3b6b" stroke-width="1.4"/>`);}
 const sheet=plot?'#ffffff':paper;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(state.text.replaceAll('/',' / '))} — rule-field letters, ${state.family}, ${plot?'plotter centrelines':['letter mask','plain field','treatment','poster'][stage-1]}</title><defs>${defs.join('')}</defs><rect width="${W}" height="${H}" fill="${sheet}"/>${ground!==paper?(G=>`<rect x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" fill="${ground}"/>`)(state.band==='sides'&&!state.params.frame?{x:0,y:0,w:W,h:H}:F):''}<g clip-path="url(#f${uid})">${body.join('')}</g>${!plot&&stage===4&&state.band!=='none'&&keep('rule')?infoSVG(state,W,H,sep?'#000000':inkFor(paper)):''}</svg>`;
 return {svg,state,width:W,height:H,output,inks,features:{...feat,glyphs:glyphs.length,rows:state.text.split('/').length,stage,inks:inks.length}};}

// Ink separations for screen or riso printing: one black-on-white sheet per ink of the poster pass.
// Rainbow inks separate per hue step; paper colour and any gradient ground stay with the printer.
export function separations(input={},o={}){const r=render({...input,stage:4},o),c=r.state.colors;
 return r.inks.map(k=>({ink:{rule:'rules',letter:'letters',accent:'accent'}[k]??k.slice(1),colour:{rule:c[1],letter:c[2],accent:c[3]}[k]??k,svg:render({...input,stage:4},{...o,separate:k}).svg}));}

// Every letter and figure of the chosen face in the current rule, one cell each.
export function specimen(input={}){const state=resolve({...input,stage:3}),chars=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&?'].filter(c=>FONTS[state.font].glyphs[c]),cols=10,cw=150,ch=200,w=cols*cw,h=Math.ceil(chars.length/cols)*ch,k=ch/FORMATS[state.format].h*1.6;
 const cells=chars.map((c,i)=>{const F={x:(i%cols)*cw+6,y:Math.floor(i/cols)*ch+6,w:cw-12,h:ch-12},s={...state,text:c,fill:'fit',params:{...state.params,size:1,margin:state.params.margin*k}},B={x:F.x+s.params.margin,y:F.y+s.params.margin,w:F.w-2*s.params.margin,h:F.h-2*s.params.margin},r=field(s,F,setText(s,B),3,k);
  return `<clipPath id="c${i}"><rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}"/></clipPath><g clip-path="url(#c${i})" data-glyph="${c.replace(/[&?]/g,m=>'&#'+m.charCodeAt(0)+';')}">${[...r.ink].map(([key,paths])=>`<path d="${paths.join('')}" fill="${key.startsWith('letter')?state.colors[2]:key.startsWith('accent')?state.colors[3]:state.colors[1]}"/>`).join('')}</g>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${state.colors[0]}"/>${cells.join('')}</svg>`;}
