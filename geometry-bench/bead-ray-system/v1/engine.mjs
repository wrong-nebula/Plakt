/* Bead-ray blooms and flip-disc screens — shape system study after Kazumasa
 * Nagai and Yusaku Kamekura. Two generators share one palette, layout and
 * control set:
 *  Bloom  — rays from a centre, each a run of beads whose size follows a curve
 *           and whose spacing follows a ramp. Rays twist into spirals, are cut
 *           as perforated bars (The Cell), drawn as tapered spikes (atomic
 *           burst) or fanned into petals of N fine lines (Expo '70). Bead rings
 *           fill the hub; layers repeat the bloom smaller and turned.
 *  Screen — a lattice (square, hex, radial) of discs, each tilted about an axis
 *           so it reads as an ellipse, opened like an iris or turned like a
 *           flip-dot. The flip comes from a source field (gradient, wave,
 *           whirl, interference, a built-in silhouette, a word in the
 *           isometric-prism cell alphabet — imported read-only — or a luminance
 *           grid sampled from a local image), so a hidden image appears.
 * Randomness (gaps, jitter, field placement) is seeded: a saved rule replays
 * exactly. New vector interpretations; nothing is traced from the posters.
 */
import {GLYPHS} from '../../isometric-prism-system/engine.mjs';
export const ENGINE='bead-ray-v1';
export const W=728,H=1030;  // B-series proportion
const TAU=Math.PI*2,D2R=Math.PI/180,SQ3=Math.sqrt(3);
export const SOURCES=[
 {id:'moma-8811',family:'cell'},{id:'moma-8814',family:'egg'},{id:'moma-8815',family:'vision'},{id:'moma-8816',family:'flip'},
 {id:'pgda-12308',family:'petal'},{id:'moma-8782',family:'burst'},{id:'pgda-20080',family:'vault'}
];
export const FORMATS=[{id:'poster',name:'Poster B · 728 × 1030',width:728,height:1030},{id:'square',name:'Square',width:900,height:900},{id:'story',name:'Story 9:16',width:608,height:1080},{id:'landscape',name:'Landscape 16:9',width:1280,height:720}];
export const LAYOUTS=[{id:'bloom',name:'Centred bloom'},{id:'field',name:'Bloom field'},{id:'screen',name:'Screen, full bleed'},{id:'overlay',name:'Screen with bloom overlay'},{id:'crop',name:'Cropped giant bloom'}];
export const OPTIONS={layout:LAYOUTS.map(l=>l.id),format:FORMATS.map(f=>f.id),rayMode:['beads','perforated','spikes','petals'],bead:['disc','ring','square','lozenge','chevron','egg'],curve:['grow','shrink','pulse','swell','even'],
 inkRamp:['flat','radial','vertical','alternate'],emblem:['none','disc','ring','flower','gear'],grid:['square','hex','radial'],flipMode:['tilt','iris','flipdot'],axisMode:['fixed','swing','contour','radial'],
 source:['linear','radial','wave','whirl','interference','shape','word','image'],shape:['circle','eye','star','hand','heart','moon'],tint:['none','source']};
export const CONTROLS=[
 {key:'rays',label:'Ray count',group:'bloom',min:3,max:144,step:1,value:36},
 {key:'beads',label:'Beads per ray',group:'bloom',min:1,max:48,step:1,value:12},
 {key:'beadSize',label:'Bead size',group:'bloom',min:.2,max:4,step:.01,value:1},
 {key:'sizeRange',label:'Size range (small ÷ large)',group:'bloom',min:0,max:1,step:.01,value:.35},
 {key:'waves',label:'Pulse / modulation waves',group:'bloom',min:.5,max:8,step:.5,value:2},
 {key:'spacing',label:'Spacing ramp',group:'bloom',min:.4,max:2.5,step:.01,value:1},
 {key:'hub',label:'Hub radius',group:'bloom',min:0,max:.7,step:.01,value:.18},
 {key:'rings',label:'Hub rings',group:'bloom',min:0,max:14,step:1,value:0},
 {key:'twist',label:'Twist',group:'bloom',min:-360,max:360,step:1,value:0},
 {key:'sector',label:'Sector',group:'bloom',min:20,max:360,step:1,value:360},
 {key:'turn',label:'Turn',group:'bloom',min:-180,max:180,step:1,value:-90},
 {key:'jitter',label:'Length jitter',group:'bloom',min:0,max:1,step:.01,value:0},
 {key:'lengthMod',label:'Length modulation',group:'bloom',min:0,max:1,step:.01,value:0},
 {key:'dropout',label:'Gaps',group:'bloom',min:0,max:.9,step:.01,value:0},
 {key:'layers',label:'Layers',group:'bloom',min:1,max:4,step:1,value:1},
 {key:'lines',label:'Lines per petal',group:'bloom',min:2,max:90,step:1,value:36},
 {key:'petalWidth',label:'Petal / spike width',group:'bloom',min:.05,max:3,step:.01,value:.7},
 {key:'weight',label:'Line weight',group:'bloom',min:.2,max:5,step:.05,value:1},
 {key:'squash',label:'Squash',group:'bloom',min:.3,max:1,step:.01,value:1},
 {key:'tilt',label:'Tilt',group:'bloom',min:-90,max:90,step:1,value:0},
 {key:'pitch',label:'Disc pitch',group:'screen',min:12,max:72,step:1,value:38},
 {key:'discSize',label:'Disc size',group:'screen',min:.25,max:.7,step:.01,value:.46},
 {key:'contrast',label:'Flip contrast',group:'screen',min:.2,max:3,step:.01,value:1},
 {key:'gamma',label:'Flip gamma',group:'screen',min:.3,max:3,step:.01,value:1},
 {key:'axis',label:'Flip axis',group:'screen',min:-90,max:90,step:1,value:0},
 {key:'swing',label:'Axis swing',group:'screen',min:0,max:1,step:.01,value:.5},
 {key:'hinge',label:'Hinge offset',group:'screen',min:0,max:1,step:.01,value:0},
 {key:'socket',label:'Socket',group:'screen',min:0,max:1,step:.01,value:.4},
 {key:'sourceScale',label:'Source scale',group:'screen',min:.3,max:4,step:.01,value:1},
 {key:'sourceAngle',label:'Source angle',group:'screen',min:-180,max:180,step:1,value:0},
 {key:'soft',label:'Source softness',group:'screen',min:0,max:1,step:.01,value:.12},
 {key:'zoom',label:'Bloom zoom',group:'layout',min:.3,max:3,step:.01,value:1},
 {key:'shiftX',label:'Shift across',group:'layout',min:-.6,max:.6,step:.01,value:0},
 {key:'shiftY',label:'Shift down',group:'layout',min:-.6,max:.6,step:.01,value:0},
 {key:'blooms',label:'Blooms in field',group:'layout',min:2,max:24,step:1,value:7},
 {key:'groundRamp',label:'Ground ramp, top → bottom',group:'layout',min:0,max:1,step:.01,value:0},
 {key:'rampMid',label:'Ramp light band',group:'layout',min:0,max:1,step:.01,value:0},
 {key:'glow',label:'Glow',group:'layout',min:0,max:6,step:.1,value:0},
 {key:'seed',label:'Seed',group:'layout',min:0,max:9999,step:1,value:1}
];
const P0=Object.fromEntries(CONTROLS.map(c=>[c.key,c.value]));
const O0={layout:'bloom',format:'poster',rayMode:'beads',bead:'disc',curve:'grow',inkRamp:'flat',emblem:'none',grid:'square',flipMode:'tilt',axisMode:'fixed',source:'radial',shape:'circle',tint:'none',invert:false};
const fam=(o,params)=>({...O0,...o,params:{...P0,...params}});
// Palette roles: ground, ground 2 (ramp end), ink, ink 2 (second bead colour; disc socket and back), accent (emblem, egg cores; second disc colour), type.
export const FAMILIES=[
 {id:'cell',name:'Cell bloom',after:'Kazumasa Nagai, The Cell, 1966',kind:'source',colors:['#0e1012','#0b2a3d','#aadbe9','#1a6fb8','#63b6dc','#e8eef0'],word:'CELL',title:'CELL',info:'Bead-ray bloom / after Kazumasa Nagai, 1966',
  set:fam({layout:'bloom',rayMode:'perforated',bead:'disc',curve:'swell',inkRamp:'radial'},{rays:36,beads:12,beadSize:.56,sizeRange:.7,spacing:1,hub:.34,rings:6,zoom:1.04,shiftY:.03}),
  note:'Thirty-six perforated bars grow from a disc of hub rings. Beads are punched through as holes; the bars shade from a pale tip to deep blue at the hub.'},
 {id:'egg',name:'Egg cascade',after:'Kazumasa Nagai, Imabashi Gallery (green), 1969',kind:'source',colors:['#1fe01f','#14c814','#fbf8ea','#9debab','#ffa31a','#fbf8ea'],word:'EGG',title:'NAGAI',info:'Cropped giant bloom / rows of eggs growing toward the eye',
  set:fam({layout:'crop',rayMode:'beads',bead:'egg',curve:'grow',inkRamp:'flat'},{rays:21,beads:20,beadSize:1.4,sizeRange:.06,spacing:1.5,hub:.02,sector:96,turn:90,lengthMod:.8,waves:1,zoom:1.12,shiftY:-.2}),
  note:'A fan of rays from a centre far above the poster. Each bead is a stacked egg — halo, white, offset yolk — growing down the rays; length modulation cuts the fan into a triangle.'},
 {id:'vision',name:'Light and vision screen',after:'Kazumasa Nagai, Light and Vision, 1969',kind:'source',colors:['#ff1d25','#f6f02a','#fff6df','#ffffff','#ff1d25','#e8141c'],word:'LIGHT',title:'LIGHT AND VISION',info:'Iris screen / dot size follows a whirl',
  set:fam({layout:'screen',flipMode:'iris',grid:'square',source:'whirl'},{pitch:38,discSize:.47,contrast:1.3,gamma:1.7,socket:.42,sourceScale:.42,sourceAngle:20,groundRamp:1,rampMid:.95}),
  note:'Pale sockets on a red-to-yellow ramp with a white band. Each disc opens an iris whose size follows a slow whirl.'},
 {id:'flip',name:'Flip-disc screen',after:'Kazumasa Nagai, Imabashi Gallery (red), 1969',kind:'source',colors:['#ff2121','#e8121a','#f2ebe0','#ffffff','#ff2121','#f4ece2'],word:'FLIP',title:'KAZUMASA NAGAI EXHIBITION',info:'Flip-disc screen / axis swings with a diagonal wave',
  set:fam({layout:'screen',flipMode:'tilt',grid:'square',source:'wave',axisMode:'swing'},{pitch:38,discSize:.47,contrast:1.1,gamma:2.2,socket:.36,sourceScale:.8,sourceAngle:38,axis:-20,swing:1,hinge:.3}),
  note:'Every disc is tilted about an axis; a diagonal wave sets both the tilt and the axis, so narrow upright ellipses gather into bands.'},
 {id:'petal',name:'Petal flower',after:"Yusaku Kamekura, Japan World Exposition '70, 1967",kind:'source',colors:['#0c0b0a','#1a1510','#c9a46c','#ead2a4','#e8392f','#e8392f'],word:'EXPO',title:'PROGRESS AND HARMONY',info:'Petal bloom / 8 petals × 44 fine lines',
  set:fam({layout:'bloom',rayMode:'petals',inkRamp:'radial',emblem:'flower'},{rays:8,lines:44,petalWidth:.78,weight:.85,hub:.17,zoom:1.02,shiftY:-.06,turn:-90}),
  note:'Eight petals, each a fan of fine lines from a rounded base to an outer circle. Near the base the lines merge into a solid cap.'},
 {id:'burst',name:'Spike burst',after:'Yusaku Kamekura, Peacefully Use Atomic Energy, 1956',kind:'source',colors:['#22404f','#183240','#dbe24a','#1ba7e4','#f4f4f0','#a6adb1'],word:'ATOM',title:'ATOMS FOR PEACE',info:'Spike burst / 110 tapered rays, squashed and tilted',
  set:fam({layout:'bloom',rayMode:'spikes',inkRamp:'alternate',emblem:'gear'},{rays:110,petalWidth:2.2,hub:.17,jitter:.42,squash:.56,tilt:52,zoom:1.4,shiftX:-.1,shiftY:-.04,turn:0}),
  note:'Tapered spikes of random length alternate yellow and blue round a squashed blue hub; the whole burst is tilted on a diagonal.'},
 {id:'vault',name:'Chevron vault',after:'Kazumasa Nagai, retrospective of plastic arts, 2001',kind:'source',colors:['#f3f1f4','#ddd9e6','#655db3','#b9b3de','#2b44c9','#c03a31'],word:'VAULT',title:'PLASTIC ARTS',info:'Cropped bloom / 72 rays of chevrons',
  set:fam({layout:'crop',rayMode:'beads',bead:'chevron',curve:'grow',inkRamp:'radial',emblem:'disc'},{rays:64,beads:40,beadSize:1.05,sizeRange:.4,spacing:1.2,hub:.09,zoom:1,shiftY:.42,weight:1.2,groundRamp:.6}),
  note:'A centre a third of the way down; seventy-two rays of small chevrons run past every edge like the ribs of a vault.'},
 {id:'neon',name:'Neon bloom',after:'new — electro',kind:'new',colors:['#07060b','#170a2c','#ff2bd6','#19f0ff','#c6ff3d','#f4f1ff'],word:'NEON',title:'NEON BLOOM',info:'Twisted bead rays / pulse curve, two layers, glow',
  set:fam({layout:'bloom',rayMode:'beads',bead:'ring',curve:'pulse',inkRamp:'radial',emblem:'ring'},{rays:42,beads:17,beadSize:1.05,sizeRange:.12,waves:2.5,spacing:.9,hub:.1,rings:3,twist:130,layers:2,weight:1.2,glow:2.4,groundRamp:1,zoom:1.02}),
  note:'Ring beads pulse in size along spiralling rays; a second layer turns half a step inside the first. Magenta to cyan, with glow on near-black.'},
 {id:'scoreboard',name:'Flip-dot scoreboard',after:'new — LED flip-dot board',kind:'new',colors:['#0b0b0c','#121214','#ffd60a','#2c2c31','#ff3b30','#ffd60a'],word:'FLIP/DOT',title:'FLIP-DOT SCOREBOARD',info:'Word mask / yellow front, dark back',
  set:fam({layout:'screen',flipMode:'flipdot',grid:'square',source:'word'},{pitch:17,discSize:.46,contrast:1.6,socket:.7,soft:.05,hinge:.15,glow:1.2}),
  note:'A word set in a cell alphabet flips yellow fronts up; the board stays dark wherever the word is not. Half-turned discs show as thin ellipses at the edges.'},
 {id:'opart',name:'Op-art pulse',after:'new — interference',kind:'new',colors:['#0d0d0d','#0d0d0d','#f4f2ec','#3a3a3a','#ff3b2f','#f4f2ec'],word:'PULSE',title:'OP / PULSE',info:'Hex screen / two interfering ripples, axis along the contours',
  set:fam({layout:'screen',flipMode:'tilt',grid:'hex',source:'interference',axisMode:'contour',tint:'source'},{pitch:21,discSize:.5,contrast:1.5,socket:0,sourceScale:.9}),
  note:'Two ripples interfere. Discs flatten on the crests and turn edge-on in the troughs, always tilting along the ripple contours.'},
 {id:'eye',name:'Eye screen',after:'new — hidden silhouette',kind:'new',colors:['#101a5c','#0a1240','#f6f1e4','#4f63d6','#ff5a3c','#f6f1e4'],word:'SEE',title:'THE HIDDEN EYE',info:'Radial screen / a silhouette sets the tilt',
  set:fam({layout:'screen',flipMode:'tilt',grid:'radial',source:'shape',shape:'eye',axisMode:'radial'},{pitch:22,discSize:.47,contrast:1.8,socket:.5,soft:.08,sourceScale:1.2,hinge:.2}),
  note:'A built-in eye silhouette tilts discs edge-on outside the almond and in the iris; a highlight flips back flat.'},
 {id:'sunrise',name:'Sun over sea',after:'new — overlay',kind:'new',colors:['#0c1a3e','#ff6a3d','#ffd84a','#ff8a3d','#fff1c2','#fff1c2'],word:'SUN',title:'SUN OVER SEA',info:'Wave screen with a spike-burst overlay',
  set:fam({layout:'overlay',flipMode:'tilt',grid:'square',source:'wave',axisMode:'fixed',rayMode:'spikes',inkRamp:'alternate',emblem:'disc'},{pitch:24,discSize:.44,contrast:1.4,socket:.25,sourceScale:2.2,sourceAngle:90,axis:0,rays:72,petalWidth:1.1,hub:.24,jitter:.35,zoom:.95,shiftY:-.1,groundRamp:1,rampMid:.25}),
  note:'A screen of horizontal waves reads as water under a spike-burst sun; the ground ramps from night blue to orange.'},
 {id:'confetti',name:'Bloom field',after:'new — field',kind:'new',colors:['#1d2bd9','#10168f','#f6f2e8','#ff7ad9','#d7ff3d','#f6f2e8'],word:'FIELD',title:'BLOOM FIELD',info:'Nine seeded blooms / shrinking beads, two layers',
  set:fam({layout:'field',rayMode:'beads',bead:'disc',curve:'shrink',inkRamp:'flat',emblem:'disc'},{rays:22,beads:9,beadSize:2.3,sizeRange:.2,spacing:.85,hub:.16,layers:2,blooms:9,seed:7,zoom:1.15}),
  note:'Nine blooms packed by a seeded scatter. Each picks its own turn and colour from the palette; beads shrink toward the tips.'}
];

// Which controls and options change the picture for a state (editor enables, tests probe).
const isBloom=s=>s.layout!=='screen',isScreen=s=>s.layout==='screen'||s.layout==='overlay',beadish=s=>s.rayMode==='beads'||s.rayMode==='perforated',ringed=s=>s.params.rings>0&&s.params.hub>0;
const usesBeads=s=>isBloom(s)&&(beadish(s)||ringed(s)),flips=s=>isScreen(s)&&s.flipMode!=='iris';
const APPLIES={rays:isBloom,beads:s=>isBloom(s)&&beadish(s),beadSize:usesBeads,sizeRange:s=>usesBeads(s)&&s.curve!=='even',waves:s=>isBloom(s)&&((usesBeads(s)&&s.curve==='pulse')||s.params.lengthMod>0),
 spacing:s=>isBloom(s)&&beadish(s),hub:isBloom,rings:s=>isBloom(s)&&s.params.hub>0,twist:isBloom,sector:isBloom,turn:isBloom,jitter:isBloom,lengthMod:isBloom,dropout:isBloom,layers:isBloom,
 lines:s=>isBloom(s)&&s.rayMode==='petals',petalWidth:s=>isBloom(s)&&(s.rayMode==='petals'||s.rayMode==='spikes'),weight:s=>isBloom(s)&&(s.rayMode==='petals'||(usesBeads(s)&&['ring','chevron'].includes(s.bead))),squash:isBloom,tilt:isBloom,
 pitch:isScreen,discSize:isScreen,contrast:isScreen,gamma:isScreen,axis:s=>flips(s)&&['fixed','swing'].includes(s.axisMode),swing:s=>flips(s)&&s.axisMode==='swing',hinge:flips,socket:isScreen,
 sourceScale:isScreen,sourceAngle:s=>isScreen(s)&&s.source!=='radial'&&!(s.source==='shape'&&s.shape==='circle'),soft:s=>isScreen(s)&&['shape','word','image'].includes(s.source),
 zoom:isBloom,shiftX:s=>['bloom','crop','overlay'].includes(s.layout),shiftY:s=>['bloom','crop','overlay'].includes(s.layout),blooms:s=>s.layout==='field',
 groundRamp:s=>s.colors[0]!==s.colors[1]||s.params.rampMid>0,rampMid:s=>s.params.groundRamp>0,glow:()=>true,seed:s=>isBloom(s)&&(s.params.jitter>0||s.params.dropout>0||s.layout==='field'),
 layout:()=>true,format:()=>true,rayMode:isBloom,bead:usesBeads,curve:usesBeads,inkRamp:s=>isBloom(s)||s.tint==='none',emblem:isBloom,grid:isScreen,flipMode:isScreen,axisMode:flips,source:isScreen,shape:s=>isScreen(s)&&s.source==='shape',tint:isScreen,invert:isScreen,word:s=>isScreen(s)&&s.source==='word',image:s=>isScreen(s)&&s.source==='image'};
export const applies=(key,state)=>!!APPLIES[key]?.(state);

// Colour, numbers, seeded random
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
export const luminance=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
export const n=v=>Math.round(v*100)/100;const m1=v=>Math.round(v*10)/10,clamp01=v=>Math.max(0,Math.min(1,v));
function seeded(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return ((r^r>>>14)>>>0)/4294967296;};}
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]);

// Inputs: a word for the word source (cell alphabet, '/' breaks rows) and a luminance grid for the image source.
export function normalizeWord(input,fallback){
 const t=String(input??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[‘’`´]/g,"'").replace(/[–—]/g,'-').toUpperCase().replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim();
 if(!t){if(fallback!==undefined)return fallback;throw new Error('Type at least one letter.');}
 if(!/^[A-Z0-9 .,:\-!?'/]+$/.test(t))throw new Error("Use A–Z, 0–9, spaces and . , : - ! ? ' — / starts a new row.");
 const rows=t.split('/');if(rows.length>3)throw new Error('Use at most three rows.');if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if(t.replace(/[ /]/g,'').length>18)throw new Error('Use at most 18 characters.');return rows.map(r=>r.trim()).join('/');}
export function normalizeImage(im){if(!im||typeof im!=='object')return null;const w=Math.round(+im.w),h=Math.round(+im.h);if(!(w>=4&&w<=128&&h>=4&&h<=128))return null;
 const data=String(im.data??'').toLowerCase();if(data.length!==w*h*2||!/^[0-9a-f]*$/.test(data))return null;return {w,h,data,name:typeof im.name==='string'?im.name.replace(/[<>&"]/g,'').slice(0,60):''};}
// Luminance values 0–1, row by row → the stored image form (two hex digits per sample).
export const imageFromLuminance=(w,h,values,name='')=>({w,h,name,data:Array.from(values,v=>Math.round(clamp01(v)*255).toString(16).padStart(2,'0')).join('')});

const clampNum=(v,c,d)=>typeof v!=='boolean'&&v!==null&&v!==''&&Number.isFinite(+v)?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):d;
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,given=input.params??{},params={};
 for(const c of CONTROLS)params[c.key]=clampNum(given[c.key],c,set.params[c.key]);
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k];let word;try{word=normalizeWord(input.word,family.word);}catch{word=family.word;}
 const image=normalizeImage(input.image),colors=Array.isArray(input.colors)&&input.colors.length===6&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&"]/g,'').slice(0,max):d;let source=pick('source');if(source==='image'&&!image)source=set.source==='image'?'radial':set.source;
 return {engine:ENGINE,family:family.id,stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,layout:pick('layout'),format:pick('format'),rayMode:pick('rayMode'),bead:pick('bead'),curve:pick('curve'),inkRamp:pick('inkRamp'),emblem:pick('emblem'),
  grid:pick('grid'),flipMode:pick('flipMode'),axisMode:pick('axisMode'),source,shape:pick('shape'),tint:pick('tint'),invert:typeof input.invert==='boolean'?input.invert:set.invert,word,image,
  title:clip(input.title,family.title,48),info:clip(input.info,family.info,140),params,colors};}

// Path pieces (merged per colour, coordinates to 0.1 unit).
const circ=(x,y,r)=>{r=m1(r);return `M${m1(x-r)} ${m1(y)}a${r} ${r} 0 1 0 ${m1(2*r)} 0a${r} ${r} 0 1 0 ${m1(-2*r)} 0Z`;};
const circRev=(x,y,r)=>{r=m1(r);return `M${m1(x-r)} ${m1(y)}a${r} ${r} 0 1 1 ${m1(2*r)} 0a${r} ${r} 0 1 1 ${m1(-2*r)} 0Z`;};
const ell=(x,y,rx,ry,a)=>{const c=Math.cos(a)*rx,s=Math.sin(a)*rx,R=`${m1(rx)} ${Math.max(.1,m1(ry))} ${m1(a/D2R)} 1 0 `;return `M${m1(x+c)} ${m1(y+s)}A${R}${m1(x-c)} ${m1(y-s)}A${R}${m1(x+c)} ${m1(y+s)}Z`;};
const poly=pts=>'M'+pts.map(([x,y])=>m1(x)+' '+m1(y)).join('L')+'Z';
// A collector of path data grouped by attributes, so thousands of marks become a few paths.
function ink(){const g=new Map();return {add(attrs,d){let e=g.get(attrs);if(!e)g.set(attrs,e=[]);e.push(d);},svg:()=>[...g].map(([a,d])=>`<path ${a} d="${d.join('')}"/>`).join(''),size:()=>g.size};}
const LAYERS=['guide','sock','disc','halo','body','holes','under','marks','over'];
function scene(state,stage,uid,box){const L={};for(const k of LAYERS)L[k]=ink();let left=60000;const ids=new Set();
 return {state,stage,uid,box,defs:[],L,count:{rays:0,beads:0,lines:0,spikes:0,discs:0,blooms:0},capped:false,take(){if(left-->0)return true;this.capped=true;return false;},once(id,def){if(!ids.has(id)){ids.add(id);this.defs.push(def);}}};}

// Bead shapes in poster space; a is the ray direction (beads point outward).
function beadPath(shape,x,y,r,a,weight){const c=Math.cos(a),s=Math.sin(a),P=(u,v)=>[x+u*r*c-v*r*s,y+u*r*s+v*r*c];
 switch(shape){case 'ring':return circ(x,y,r)+circRev(x,y,r*Math.max(.08,1-.3*weight));
  case 'square':{const h=.886;return poly([P(h,h),P(-h,h),P(-h,-h),P(h,-h)]);}
  case 'lozenge':return poly([P(1.45,0),P(0,.78),P(-1.45,0),P(0,-.78)]);
  case 'chevron':{const t=Math.min(.95,.42*weight);return poly([P(.65,0),P(-.45,.95),P(-.45+t,.95),P(.65-t*1.15,0),P(-.45+t,-.95),P(-.45,-.95)]);}
  default:return circ(x,y,r);}}

// ——— Bloom generator ———
const CURVES={grow:(f,lo)=>lo+(1-lo)*f,shrink:(f,lo)=>1-(1-lo)*f,pulse:(f,lo,w)=>lo+(1-lo)*(.5+.5*Math.cos(TAU*w*f)),swell:(f,lo)=>lo+(1-lo)*Math.sin(Math.PI*f),even:()=>1};
function drawBloom(sc,pl){
 const {state,stage,L,uid}=sc,p=state.params,[,,ink1,ink2,accent]=state.colors,rand=seeded(Math.imul(p.seed+1,2654435761)^Math.imul(pl.idx+1,40503)),full=p.sector>=359.5;
 const nR=pl.rays??p.rays,nB=pl.beads??p.beads,sec=p.sector*D2R,tw=p.twist*D2R,ct=Math.cos(p.tilt*D2R),st=Math.sin(p.tilt*D2R),sq=p.squash,unitS=pl.R/330,size=CURVES[state.curve];
 const map=(x,y)=>{y*=sq;return [pl.cx+x*ct-y*st,pl.cy+x*st+y*ct];},dirOf=(dx,dy)=>{dy*=sq;return Math.atan2(dx*st+dy*ct,dx*ct-dy*st);};
 const rid=`br-${uid}-${pl.idx}`,swap=pl.idx%2===1;
 if(stage>=3&&state.inkRamp==='radial'){const [a,b]=swap?[ink1,ink2]:[ink2,ink1];
  sc.once(rid,`<radialGradient id="${rid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${m1(pl.R)}" gradientTransform="translate(${m1(pl.cx)} ${m1(pl.cy)}) rotate(${n(p.tilt)}) scale(1 ${n(sq)})"><stop offset="0" stop-color="${mix(a,b,.45)}"/><stop offset="${n(Math.min(.9,p.hub+.08))}" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`);}
 // Mark colour: one ink at the modules pass; ramps, alternation and layer colours from the colour pass on.
 if(stage>=3&&state.inkRamp==='vertical')sc.once('bv',`<linearGradient id="bv-${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="${m1(sc.box[1])}" x2="0" y2="${m1(sc.box[3])}"><stop offset="0" stop-color="${ink1}"/><stop offset="1" stop-color="${ink2}"/></linearGradient>`);
 const fill=(j,li)=>{if(stage<3)return ink1;const k=li+pl.idx;switch(state.inkRamp){case 'radial':return `url(#${rid})`;case 'vertical':return `url(#bv-${uid})`;case 'alternate':return (j+k)%2?ink2:ink1;default:return [ink1,ink2,accent][k%3];}};
 const guide=`fill="none" stroke="${ink1}" stroke-opacity=".5" stroke-width="${n(.7*Math.max(.6,unitS))}"`,dot=`fill="${ink1}"`;
 sc.count.blooms++;
 for(let li=0;li<p.layers;li++){
  const R=pl.R*(1-li*.62/p.layers),turn=pl.turn+li*(full?Math.PI/nR:0),unit=R*.028*p.beadSize,hubR=R*p.hub;
  const rayAngle=j=>turn+(full?j/nR*TAU:(nR===1?0:(j/(nR-1)-.5)*sec)),rayT=j=>full?j/nR:(nR===1?.5:j/(nR-1));
  // A bead: a dot on the construction pass, a hole in perforated bars, otherwise a mark.
  const bead=(x,y,r,a,j,perf)=>{if(!sc.take())return;sc.count.beads++;if(stage===1){L.guide.add(dot,circ(x,y,Math.max(.8,unitS*1.3)));return;}
   if(perf){L.holes.add('fill="#000"',state.bead==='egg'?circ(x,y,r)+circ(x-Math.cos(a)*r*.62,y-Math.sin(a)*r*.62,r*.5):beadPath(state.bead,x,y,r,a,p.weight));return;}
   const f=fill(j,li);if(state.bead!=='egg'||stage<3){L.marks.add(`fill="${f}"`,beadPath(state.bead==='egg'?'disc':state.bead,x,y,r,a,p.weight));return;}
   const bx=-Math.cos(a)*r,by=-Math.sin(a)*r;L.halo.add(`fill="${ink2}" fill-opacity=".55"`,circ(x,y,r*1.48));L.marks.add(`fill="${f}"`,circ(x,y,r));
   L.over.add(`fill="${accent}" fill-opacity=".55"`,circ(x+bx*.2,y+by*.2,r*.68));L.over.add(`fill="${accent}"`,circ(x+bx*.34,y+by*.34,r*.47));};
  if(stage===1){L.guide.add(guide,ell(pl.cx,pl.cy,R,R*sq,p.tilt*D2R));if(hubR>0)L.guide.add(guide,ell(pl.cx,pl.cy,hubR,hubR*sq,p.tilt*D2R));}
  // Hub rings: concentric bead rings inside the hub, staggered ring to ring.
  if(p.rings>0&&hubR>0)for(let i=0;i<p.rings;i++){const s=p.hub*(i+.5)/p.rings,f=p.rings===1?1:i/(p.rings-1),r=unit*size(f,p.sizeRange,p.waves)*.9;if(r<=0)continue;
   const arc=R*s*(full?TAU:sec),cnt=Math.max(1,Math.round(arc/Math.max(r*2.5,1)));
   for(let q=0;q<cnt;q++){const th=full?turn+(q+(i%2)*.5)/cnt*TAU+tw*s:turn+(cnt===1?0:(q/(cnt-1)-.5))*sec+tw*s,drop=rand()<p.dropout;if(drop)continue;const [x,y]=map(R*s*Math.cos(th),R*s*Math.sin(th));bead(x,y,r,dirOf(Math.cos(th),Math.sin(th)),i,state.rayMode==='perforated');}}
  const perfBars=[],barW=unit*2*1.9*Math.max(...[0,.25,.5,.75,1].map(f=>size(f,p.sizeRange,p.waves)));
  for(let j=0;j<nR;j++){
   const th0=rayAngle(j),jit=1-p.jitter*rand(),mod=state.rayMode==='petals'?1:1-p.lengthMod*(.5+.5*Math.cos(TAU*p.waves*rayT(j))),L1=Math.max(.02,jit*mod);sc.count.rays++;
   if(state.rayMode==='beads'||state.rayMode==='perforated'){
    const reach=p.hub+(1-p.hub)*L1,pts=[];
    if(stage===1){const g=[];for(let k=0;k<=16;k++){const s=p.hub+(reach-p.hub)*k/16,th=th0+tw*s;g.push(map(R*s*Math.cos(th),R*s*Math.sin(th)));}L.guide.add(guide,'M'+g.map(([x,y])=>m1(x)+' '+m1(y)).join('L'));}
    for(let k=0;k<nB;k++){const u=nB===1?1:k/(nB-1),f=u**p.spacing,s=p.hub+(1-p.hub)*f,drop=rand()<p.dropout;if(s>reach+1e-9)continue;
     const th=th0+tw*s,[x,y]=map(R*s*Math.cos(th),R*s*Math.sin(th)),a=dirOf(Math.cos(th)-s*tw*Math.sin(th),Math.sin(th)+s*tw*Math.cos(th));pts.push([x,y]);
     if(!drop)bead(x,y,unit*size(f,p.sizeRange,p.waves),a,j,state.rayMode==='perforated');}
    if(state.rayMode==='perforated'&&stage>=2&&pts.length){const th=th0+tw*p.hub*.5,start=map(R*p.hub*.5*Math.cos(th),R*p.hub*.5*Math.sin(th));perfBars.push({j,d:'M'+[start,...pts].map(([x,y])=>m1(x)+' '+m1(y)).join('L')});}}
   else if(state.rayMode==='spikes'){if(rand()<p.dropout||!sc.take())continue;sc.count.spikes++;
    const ha=p.petalWidth*(full?Math.PI/nR:sec/2/Math.max(1,nR)),r0=R*Math.max(p.hub*.92,.04),tip=R*Math.max(L1,p.hub+.02);
    const A=map(r0*Math.cos(th0-ha),r0*Math.sin(th0-ha)),B=map(r0*Math.cos(th0+ha),r0*Math.sin(th0+ha)),T=map(tip*Math.cos(th0+tw),tip*Math.sin(th0+tw));
    if(stage===1)L.guide.add(guide,`M${m1(A[0])} ${m1(A[1])}L${m1(T[0])} ${m1(T[1])}L${m1(B[0])} ${m1(B[1])}`);else L.marks.add(`fill="${fill(j,li)}"`,poly([A,T,B]));}
   else{// Petals: N lines from a rounded base, parallel at first, fanning to the outer circle.
    const half=full?Math.PI/nR:sec/2/Math.max(1,nR),ha=p.petalWidth*half,r0=R*Math.max(p.hub,.03),w0=2*r0*Math.sin(Math.min(half,1.2))*.92,nl=p.lines,c=Math.cos(th0),s=Math.sin(th0),rot=(a,b)=>map(a*c-b*s,a*s+b*c);
    const sw=n(Math.max(.15,p.weight*.9*unitS*(R/pl.R))),attrs=`fill="none" stroke="${fill(j,li)}" stroke-width="${sw}" stroke-linecap="round"`;
    for(let i=0;i<nl;i++){const u=nl===1?0:2*i/(nl-1)-1,drop=rand()<p.dropout;if(drop||!sc.take())continue;sc.count.lines++;
     const a0=r0+w0/2*(1-Math.sqrt(Math.max(0,1-u*u))),b0=u*w0/2,ac=r0+w0*1.25,len=Math.max(ac*1.15,R*L1*(1-p.lengthMod*(.5+.5*Math.cos(Math.PI*(u+1)*p.waves)))),phi=th0+u*ha+tw;
     const P0=rot(a0,b0),Pc=rot(ac,b0),P1=map(len*Math.cos(phi),len*Math.sin(phi));
     if(stage===1&&!(i===0||i===nl-1||i===(nl>>1)))continue;
     (stage===1?L.guide:L.marks).add(stage===1?guide:attrs,`M${m1(P0[0])} ${m1(P0[1])}Q${m1(Pc[0])} ${m1(Pc[1])} ${m1(P1[0])} ${m1(P1[1])}`);}}}
  if(perfBars.length){for(const b of perfBars)L.body.add(`fill="none" stroke="${fill(b.j,li)}" stroke-width="${n(barW)}" stroke-linecap="round" stroke-linejoin="round"`,b.d);
   if(hubR>0)L.body.add(`fill="${fill(0,li)}"`,ell(pl.cx,pl.cy,hubR+barW*.15,(hubR+barW*.15)*sq,p.tilt*D2R));}
  if(state.rayMode==='spikes'&&stage>=2&&hubR>0)L.under.add(`fill="${stage<3?ink1:state.inkRamp==='flat'?[ink1,ink2,accent][(li+pl.idx+1)%3]:ink2}"`,ell(pl.cx,pl.cy,hubR,hubR*sq,p.tilt*D2R));}
 if(stage>=3&&state.emblem!=='none')emblem(sc,pl.cx,pl.cy,Math.max(pl.R*Math.max(p.hub,.06)*.48,4),accent);}
// A centre emblem: disc, ring, five-disc flower or gear (round, never squashed).
function emblem(sc,x,y,e,color){const L=sc.L.over,ground=sc.state.colors[0],a=`fill="${color}"`;
 switch(sc.state.emblem){case 'disc':L.add(a,circ(x,y,e));break;case 'ring':L.add(a,circ(x,y,e)+circRev(x,y,e*.62));break;
  case 'flower':for(let k=0;k<5;k++){const t=-Math.PI/2+k*TAU/5;L.add(a,circ(x+Math.cos(t)*e*.64,y+Math.sin(t)*e*.64,e*.34));}L.add(`fill="${ground}"`,[0,1,2,3,4].map(k=>{const t=-Math.PI/2+k*TAU/5+.32;return circ(x+Math.cos(t)*e*.8,y+Math.sin(t)*e*.8,e*.1);}).join(''));L.add(a,circ(x,y,e*.14));break;
  case 'gear':{const pts=[],T=10;for(let k=0;k<T*4;k++){const t=k/(T*4)*TAU,r=(k%4<2)?e:e*.76;pts.push([x+Math.cos(t-TAU/(T*8))*r,y+Math.sin(t-TAU/(T*8))*r]);}L.add(a,poly(pts)+circRev(x,y,e*.38));break;}}}

// ——— Screen generator ———
const len=Math.hypot,smooth=(d,w)=>clamp01(.5-d/w);
const sdCapsule=(px,py,ax,ay,bx,by,r)=>{const pax=px-ax,pay=py-ay,bax=bx-ax,bay=by-ay,h=clamp01((pax*bax+pay*bay)/(bax*bax+bay*bay));return len(pax-bax*h,pay-bay*h)-r;};
const sdBox=(px,py,bx,by,r)=>{const qx=Math.abs(px)-bx+r,qy=Math.abs(py)-by+r;return len(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;};
const sdPoly=(px,py,P)=>{let d=Infinity,s=1;for(let i=0,j=P.length-1;i<P.length;j=i++){const [ax,ay]=P[j],[bx,by]=P[i],ex=bx-ax,ey=by-ay,wx=px-ax,wy=py-ay,h=clamp01((wx*ex+wy*ey)/(ex*ex+ey*ey));d=Math.min(d,len(wx-ex*h,wy-ey*h));const c1=py>=ay,c2=py<by,c3=ex*wy>ey*wx;if((c1&&c2&&c3)||(!c1&&!c2&&!c3))s=-s;}return s*d;};
const STAR=Array.from({length:10},(_,k)=>{const r=k%2?.33:.8,a=-Math.PI/2+k*Math.PI/5;return [r*Math.cos(a),r*Math.sin(a)];}),HEART=[[-.56,-.1],[.56,-.1],[0,.66]];
// Built-in silhouettes as values 0–1 (1 = disc flat) in units of the half screen; w is the edge softness. y points down.
export const SILHOUETTES={
 circle:(x,y,w)=>smooth(len(x,y)-.62,w),
 eye:(x,y,w)=>{const a=smooth(Math.max(len(x,y-.62)-1.02,len(x,y+.62)-1.02),w),i=smooth(len(x,y)-.31,w),h=smooth(len(x+.1,y+.1)-.085,w);return a*(1-i)+i*h;},
 star:(x,y,w)=>smooth(sdPoly(x,y+.06,STAR),w),
 hand:(x,y,w)=>smooth(Math.min(sdBox(x,y-.24,.3,.28,.1),sdCapsule(x,y,-.225,-.02,-.225,-.56,.082),sdCapsule(x,y,-.075,-.02,-.075,-.72,.082),sdCapsule(x,y,.075,-.02,.075,-.68,.082),sdCapsule(x,y,.225,-.02,.225,-.5,.08),sdCapsule(x,y,-.3,.3,-.58,-.02,.09),sdBox(x,y-.64,.21,.2,.04)),w),
 heart:(x,y,w)=>smooth(Math.min(len(x+.28,y+.2)-.31,len(x-.28,y+.2)-.31,sdPoly(x,y,HEART)),w),
 moon:(x,y,w)=>smooth(Math.max(len(x,y)-.64,-(len(x-.3,y+.16)-.52)),w)};
// A word in the isometric-prism cell alphabet (full cells, half triangles, quarter discs, tips) as a coverage function.
const CELL={'#':()=>true,'◢':(x,y)=>x+y>=1,'◣':(x,y)=>y>=x,'◤':(x,y)=>x+y<=1,'◥':(x,y)=>x>=y,'╭':(x,y)=>(x-1)**2+(y-1)**2<=1,'╮':(x,y)=>x*x+(y-1)**2<=1,'╰':(x,y)=>(x-1)**2+y*y<=1,'╯':(x,y)=>x*x+y*y<=1,'▼':(x,y)=>Math.abs(x-.5)<=.5*(1-y),'▲':(x,y)=>Math.abs(x-.5)<=.5*y};
export function wordLayout(word){const rows=word.split('/').map(r=>{let x=0;const letters=[];for(const ch of r){if(ch===' '){x+=3;continue;}const g=(GLYPHS[ch]??[]).map(row=>[...row]),w=Math.max(1,...g.map(row=>row.length));if(letters.length||x)x+=letters.length?1:0;letters.push({ch,x,w,g});x+=w;}return {letters,width:x};});
 return {rows,width:Math.max(...rows.map(r=>r.width)),height:rows.length*7+(rows.length-1)*2};}
function wordCoverage(word,ax,ay){const lay=wordLayout(word),cs=Math.min(2*ax*.88/lay.width,2*ay*.8/lay.height);
 return (u,v)=>{const gx=u/cs+lay.width/2,gy=v/cs+lay.height/2,r=Math.floor(gy/9),ly=gy-r*9;if(r<0||r>=lay.rows.length||ly>=7)return 0;const row=lay.rows[r],lx=gx-(lay.width-row.width)/2;
  for(const l of row.letters){const x=lx-l.x;if(x<0||x>=l.w)continue;const cx=Math.floor(x),cy=Math.floor(ly),c=l.g[cy]?.[cx],t=c&&CELL[c];return t&&t(x-cx,ly-cy)?1:0;}return 0;};}
function decodeImage(im){const L=new Float32Array(im.w*im.h);for(let i=0;i<L.length;i++)L[i]=parseInt(im.data.substr(i*2,2),16)/255;return L;}
// Source field over a screen area: raw value (window-averaged for word and image) and the flip value after invert, gamma and contrast.
export function sourceField(state,area){
 const p=state.params,[x0,y0,x1,y1]=area,cx=(x0+x1)/2,cy=(y0+y1)/2,hw=(x1-x0)/2,hh=(y1-y0)/2,S=Math.min(hw,hh),a=p.sourceAngle*D2R,ca=Math.cos(a),sa=Math.sin(a),k=p.sourceScale;
 const loc=(x,y)=>{const u=(x-cx)/S,v=(y-cy)/S;return [u*ca+v*sa,-u*sa+v*ca];};let raw,win=false;
 switch(state.source){
  case 'linear':{const E=(Math.abs(ca)*hw+Math.abs(sa)*hh)/S;raw=(x,y)=>.5+.5*k*loc(x,y)[0]/E;break;}
  case 'wave':raw=(x,y)=>.5+.5*Math.sin(TAU*k*1.5*loc(x,y)[0]);break;
  case 'whirl':raw=(x,y)=>{const [u,v]=loc(x,y),f=len(u,v)*2.4;return .5+.5*Math.sin(TAU*k*1.4*(u*Math.cos(f)-v*Math.sin(f)));};break;
  case 'interference':raw=(x,y)=>{const [u,v]=loc(x,y);return .5+.25*(Math.sin(TAU*k*3*len(u-.55,v))+Math.sin(TAU*k*3*len(u+.55,v)));};break;
  case 'shape':{const f=SILHOUETTES[state.shape],w=.012+p.soft*.4;raw=(x,y)=>{const [u,v]=loc(x,y);return f(u/k,v/k,w);};break;}
  case 'word':{const cov=wordCoverage(state.word,hw/S,hh/S);raw=(x,y)=>{const [u,v]=loc(x,y);return cov(u/k,v/k);};win=true;break;}
  case 'image':{const im=state.image,Lm=decodeImage(im),sc=Math.min(im.w/(2*hw),im.h/(2*hh));win=true;
   raw=(x,y)=>{const [u,v]=loc(x,y),px=Math.max(0,Math.min(im.w-1,u*S*sc/k+im.w/2-.5)),py=Math.max(0,Math.min(im.h-1,v*S*sc/k+im.h/2-.5)),i=Math.min(im.w-2,Math.floor(px)),j=Math.min(im.h-2,Math.floor(py)),fx=px-i,fy=py-j,at=(q,r)=>Lm[r*im.w+q];
    return (at(i,j)*(1-fx)+at(i+1,j)*fx)*(1-fy)+(at(i,j+1)*(1-fx)+at(i+1,j+1)*fx)*fy;};break;}
  default:raw=(x,y)=>{const [u,v]=loc(x,y);return 1-len(u,v)*k/1.35;};}
 const side=p.pitch*(.75+p.soft*3),sample=win?(x,y)=>{let s=0;for(let i=0;i<4;i++)for(let j=0;j<4;j++)s+=raw(x+((i+.5)/4-.5)*side,y+((j+.5)/4-.5)*side);return s/16;}:raw;
 const post=t=>{t=clamp01(t);if(state.invert)t=1-t;t=t**p.gamma;return clamp01((t-.5)*p.contrast+.5);};
 return {raw:sample,at:(x,y)=>post(sample(x,y)),post};}
// Lattice centres inside an area: square, hex (offset rows) or radial (rings).
export function lattice(grid,area,pitch){const [x0,y0,x1,y1]=area,w=x1-x0,h=y1-y0,out=[];
 if(grid==='radial'){const cx=(x0+x1)/2,cy=(y0+y1)/2,K=Math.ceil(len(w,h)/2/pitch),m=pitch*.45;for(let k=0;k<=K;k++){const r=k*pitch,cnt=k?Math.max(6,Math.round(TAU*r/pitch)):1;
  for(let q=0;q<cnt;q++){const t=(q+(k%2)*.5)/cnt*TAU,x=cx+r*Math.cos(t),y=cy+r*Math.sin(t);if(x>=x0+m&&x<=x1-m&&y>=y0+m&&y<=y1-m)out.push({x,y,i:q,j:k});}}return out;}
 const dy=grid==='hex'?pitch*SQ3/2:pitch,rows=Math.max(1,Math.floor((h-pitch)/dy)+1),cols=Math.max(1,Math.floor(w/pitch)),oy=y0+(h-(rows-1)*dy)/2,ox=x0+(w-(cols-1)*pitch)/2;
 for(let j=0;j<rows;j++){const odd=grid==='hex'&&j%2,c=odd?cols-1:cols;for(let i=0;i<c;i++)out.push({x:ox+i*pitch+(odd?pitch/2:0),y:oy+j*dy,i,j});}return out;}
function drawScreen(sc,area){
 const {state,stage,L,uid}=sc,p=state.params,[ground,,ink1,ink2,accent]=state.colors,F=sourceField(state,area),cells=lattice(state.grid,area,p.pitch),rd=p.pitch*p.discSize,cx=(area[0]+area[2])/2,cy=(area[1]+area[3])/2;
 if(stage>=3&&state.tint==='none'){if(state.inkRamp==='vertical')sc.defs.push(`<linearGradient id="sv-${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="${m1(area[1])}" x2="0" y2="${m1(area[3])}"><stop offset="0" stop-color="${ink1}"/><stop offset="1" stop-color="${accent}"/></linearGradient>`);
  if(state.inkRamp==='radial')sc.defs.push(`<radialGradient id="sr-${uid}" gradientUnits="userSpaceOnUse" cx="${m1(cx)}" cy="${m1(cy)}" r="${m1(len(area[2]-cx,area[3]-cy))}"><stop offset="0" stop-color="${ink1}"/><stop offset="1" stop-color="${accent}"/></radialGradient>`);}
 const fillOf=(v,c)=>{if(stage<3)return ink1;if(state.tint==='source')return mix(accent,ink1,Math.round(v*8)/8);switch(state.inkRamp){case 'vertical':return `url(#sv-${uid})`;case 'radial':return `url(#sr-${uid})`;case 'alternate':return (c.i+c.j)%2?accent:ink1;default:return ink1;}};
 const grad=(x,y)=>{const e=p.pitch*.75,gx=F.raw(x+e,y)-F.raw(x-e,y),gy=F.raw(x,y+e)-F.raw(x,y-e);return len(gx,gy)<1e-4?0:Math.atan2(gy,gx)+Math.PI/2;};
 const sock=`fill="${ink2}" fill-opacity="${n(p.socket)}"`;
 for(const c of cells){if(!sc.take())break;const v=F.at(c.x,c.y);sc.count.discs++;
  if(stage===1){const q=Math.round(v*10)/10,h=p.pitch*.46;L.guide.add(`fill="${mix(ground,ink1,q)}"`,`M${m1(c.x-h)} ${m1(c.y-h)}h${m1(2*h)}v${m1(2*h)}h${m1(-2*h)}Z`);continue;}
  if(stage>=3&&p.socket>0)L.sock.add(sock,circ(c.x,c.y,rd*1.04));
  if(state.flipMode==='iris'){const r=rd*.92*v;if(r>.2)L.disc.add(`fill="${fillOf(v,c)}"`,circ(c.x,c.y,r));continue;}
  const alpha=state.axisMode==='swing'?(p.axis+p.swing*180*v)*D2R:state.axisMode==='contour'?grad(c.x,c.y):state.axisMode==='radial'?Math.atan2(c.y-cy,c.x-cx):p.axis*D2R;
  const phi=state.flipMode==='flipdot'?(1-v)*Math.PI:(1-v)*86*D2R,cs=Math.cos(phi),ry=rd*Math.abs(cs),sh=p.hinge*rd*(1-Math.abs(cs)),x=c.x-Math.sin(alpha)*sh,y=c.y+Math.cos(alpha)*sh;
  if(ry<.12)continue;const front=state.flipMode!=='flipdot'||cs>=0;
  L.disc.add(front?`fill="${fillOf(v,c)}"`:stage<3?`fill="${ink1}" fill-opacity=".3"`:`fill="${ink2}"`,ell(x,y,rd,ry,alpha));}
 return cells;}

// ——— Layout ———
function copySVG(state,Wf,Hf,s){const color=state.colors[5],lines=state.info.split('/').map(t=>t.trim()).filter(Boolean).slice(0,3),font=`font-family="'Helvetica Neue',Helvetica,Arial,sans-serif"`,pad=n(36*s);
 if(state.layout==='screen'||state.layout==='overlay'){const y=n(Hf-22*s);return `<g ${font} fill="${color}"><text x="${pad}" y="${y}" font-size="${n(19*s)}" font-weight="700" letter-spacing="${n(.5*s)}">${esc(state.title)}</text><text x="${n(Wf-36*s)}" y="${y}" font-size="${n(12*s)}" text-anchor="end" letter-spacing="${n(.3*s)}">${esc(lines.join('  ·  '))}</text></g>`;}
 const top=state.layout==='crop'?Hf-(56+lines.length*17)*s:66*s,plate=state.layout==='crop'?`<rect x="${n(22*s)}" y="${n(top-36*s)}" width="${n(Math.max(state.title.length*19,...lines.map(l=>l.length*7))*s+30*s)}" height="${n((54+lines.length*17)*s)}" rx="${n(3*s)}" fill="${state.colors[0]}"/>`:'';
 return `${plate}<g ${font} fill="${color}"><text x="${pad}" y="${n(top)}" font-size="${n(30*s)}" font-weight="700" letter-spacing="${n(-.2*s)}">${esc(state.title)}</text>${lines.map((l,i)=>`<text x="${pad}" y="${n(top+(26+i*17)*s)}" font-size="${n(13*s)}" letter-spacing="${n(.2*s)}">${esc(l)}</text>`).join('')}</g>`;}
// Field: a seeded scatter of blooms that do not overlap much; small blooms carry fewer rays.
function fieldPlaces(state,box,Rref,top){const p=state.params,rand=seeded(Math.imul(p.seed+11,2246822519)),[x0,y0,x1,y1]=box,N=p.blooms,base=Math.sqrt((x1-x0)*(y1-y0)/N)*.62*p.zoom,out=[];
 for(let tries=0,gap=.8;out.length<N&&tries<6000;tries++){if(tries%1500===1499)gap*=.75;const R=base*(.5+.8*rand()),cx=x0+rand()*(x1-x0),cy=y0+rand()*(y1-y0),turn=rand()*TAU+p.turn*D2R;
  if(cy-R*.7>=top&&out.every(q=>len(q.cx-cx,q.cy-cy)>(q.R+R)*gap))out.push({cx,cy,R,turn});}
 out.sort((a,b)=>b.R-a.R);return out.map((q,idx)=>{const k=Math.max(.3,Math.min(1,q.R/Rref));return {...q,idx,rays:Math.max(3,Math.round(p.rays*k)),beads:Math.max(2,Math.round(p.beads*Math.sqrt(k)))};});}

export function geometry(state){const f=FORMATS.find(x=>x.id===state.format),Wf=f.width,Hf=f.height,s=Math.min(Wf,Hf)/728,p=state.params,m=16*s,band=52*s,Rref=Math.min(Wf,Hf)*.46;
 const out={Wf,Hf,s,screen:null,blooms:[]},turn=p.turn*D2R,cyBase=Hf>Wf?.53:.5;
 if(state.layout==='screen'||state.layout==='overlay')out.screen=[m,m,Wf-m,Hf-band];
 if(state.layout==='bloom')out.blooms=[{cx:Wf*(.5+p.shiftX),cy:Hf*(cyBase+p.shiftY),R:Rref*p.zoom,turn,idx:0}];
 if(state.layout==='overlay')out.blooms=[{cx:Wf*(.5+p.shiftX),cy:Hf*(.44+p.shiftY),R:Rref*.62*p.zoom,turn,idx:0}];
 if(state.layout==='crop')out.blooms=[{cx:Wf*(.5+p.shiftX),cy:Hf*(-.12+p.shiftY),R:Math.max(Wf,Hf)*p.zoom,turn,idx:0}];
 if(state.layout==='field')out.blooms=fieldPlaces(state,[m*3,Hf*.2,Wf-m*3,Hf-m*3],Rref,(66+26+3*17)*s);return out;}

const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
function paint(sc){const {L}=sc;let holes='';const body=L.body.svg();
 if(body&&L.holes.size()){holes=`<mask id="holes-${sc.uid}" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000"><rect x="-5000" y="-5000" width="10000" height="10000" fill="#fff"/>${L.holes.svg()}</mask>`;}
 return {defs:sc.defs.join('')+holes,body:L.guide.svg()+L.sock.svg()+L.disc.svg()+L.halo.svg()+(body?(holes?`<g mask="url(#holes-${sc.uid})">${body}</g>`:body):'')+L.under.svg()+L.marks.svg()+L.over.svg()};}

export function render(input={}){
 const state=resolve(input),G=geometry(state),{Wf,Hf,s}=G,p=state.params,[ground,ground2,ink1,ink2]=state.colors,uid=uidOf(state),stage=state.stage,sc=scene(state,stage,uid,[0,0,Wf,Hf]),defs=[];
 let ground$=`<rect width="${Wf}" height="${Hf}" fill="${ground}"/>`;
 if(stage===4&&p.groundRamp>0){const bottom=mix(ground,ground2,p.groundRamp),at=t=>mix(ground,bottom,t),stops=p.rampMid>0?[[0,ground],[.34,at(.34)],[.5,mix(at(.5),'#ffffff',p.rampMid*.9)],[.66,at(.66)],[1,bottom]]:[[0,ground],[1,bottom]];
  defs.push(`<linearGradient id="gr-${uid}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);ground$=`<rect width="${Wf}" height="${Hf}" fill="url(#gr-${uid})"/>`;}
 let screenCells=null;if(G.screen)screenCells=drawScreen(sc,G.screen);
 // The overlay clears a soft pool of ground behind the bloom so both read.
 if(state.layout==='overlay'&&stage===4&&G.blooms[0]){const b=G.blooms[0];const pool=p.groundRamp>0?mix(ground,mix(ground,ground2,p.groundRamp),Math.max(0,Math.min(1,b.cy/Hf))):ground;defs.push(`<radialGradient id="pool-${uid}" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="${pool}" stop-opacity=".92"/><stop offset="1" stop-color="${pool}" stop-opacity="0"/></radialGradient>`);sc.L.halo.add(`fill="url(#pool-${uid})"`,circ(b.cx,b.cy,b.R*1.12));}
 for(const b of G.blooms)drawBloom(sc,b);
 const painted=paint(sc),glow=stage===4&&p.glow>0;
 if(glow)defs.push(`<filter id="glow-${uid}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${n(p.glow*s)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
 const label={1:'construction',2:'modules',3:'colour',4:'poster'}[stage],gen=G.screen&&G.blooms.length?'screen + bloom':G.screen?'flip-disc screen':state.layout==='field'?'bloom field':'bead-ray bloom';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${Wf}" height="${Hf}" viewBox="0 0 ${Wf} ${Hf}"><title>${esc(state.title)} — ${gen}, ${state.family}, ${label}</title><defs>${defs.join('')}${painted.defs}</defs>${ground$}<g data-stage="${stage}"${glow?` filter="url(#glow-${uid})"`:''}>${painted.body}</g>${stage===4?copySVG(state,Wf,Hf,s):''}</svg>`;
 return {svg,state,width:Wf,height:Hf,features:{stage,layout:state.layout,generator:gen,...sc.count,capped:sc.capped,bytes:svg.length,screenArea:G.screen,blooms:G.blooms.map(b=>({cx:n(b.cx),cy:n(b.cy),R:n(b.R)}))},cells:screenCells};}

// Vocabulary sheet: bead shapes, ray modes, size curves, sources, silhouettes, flip modes and grids, in the state's palette.
export function specimen(input={}){const state=resolve({...input,stage:3}),cols=6,cw=200,chh=232,rows=6,w=cols*cw+40,h=rows*chh+40,[ground,,,,,type]=state.colors,parts=[`<rect width="${w}" height="${h}" fill="${ground}"/>`],defs=[];
 const bloomBase={rays:14,beads:6,beadSize:1.7,sizeRange:.3,spacing:1,hub:.16,rings:0,twist:0,sector:360,turn:-90,jitter:0,lengthMod:0,dropout:0,layers:1,lines:16,petalWidth:.65,weight:1,squash:1,tilt:0};
 const screenBase={pitch:13,discSize:.47,contrast:1.4,gamma:1,axis:0,swing:.5,hinge:0,socket:.35,sourceScale:1,sourceAngle:0,soft:.1};
 const tiles=[...OPTIONS.bead.map(b=>['bloom',`bead · ${b}`,{bead:b,rayMode:'beads',curve:'grow'},{}]),
  ...[['beads','rays · beads',{}],['perforated','rays · perforated',{rings:3,hub:.3,beadSize:.8}],['spikes','rays · spikes',{rays:40,jitter:.4}],['petals','rays · petals',{rays:6}],['beads','twist 200°',{twist:200,beads:8}],['beads','layers · 3',{layers:3}]].map(([m,l,pp])=>['bloom',l,{rayMode:m,bead:'disc',curve:'grow'},pp]),
  ...OPTIONS.curve.map(c=>['bloom',`curve · ${c}`,{rayMode:'beads',bead:'disc',curve:c},{beads:9,beadSize:1.5,waves:2}]),['bloom','sector 100°',{rayMode:'beads',bead:'disc',curve:'grow'},{sector:100,rays:9,beads:7,turn:90,hub:.04,beadSize:2.2}],
  ...['linear','radial','wave','whirl','interference','word'].map(src=>['screen',`source · ${src}`,{source:src,flipMode:'tilt',grid:'square',axisMode:'fixed',word:'AB'},{sourceAngle:src==='linear'?90:30}]),
  ...OPTIONS.shape.map(sh=>['screen',`shape · ${sh}`,{source:'shape',shape:sh,flipMode:'tilt',grid:'square',axisMode:'contour'},{}]),
  ...OPTIONS.flipMode.map(f=>['screen',`flip · ${f}`,{source:'shape',shape:'star',flipMode:f,grid:'square',axisMode:'fixed'},{}]),...['hex','radial'].map(g=>['screen',`grid · ${g}`,{source:'shape',shape:'heart',flipMode:'tilt',grid:g,axisMode:'swing'},{}]),
  ['screen','axis · contour',{source:'interference',flipMode:'tilt',grid:'hex',axisMode:'contour'},{sourceScale:.7}]];
 tiles.forEach(([kind,label,opts,pp],i)=>{const x=20+(i%cols)*cw,y=20+Math.floor(i/cols)*chh,st=resolve({...state,...opts,layout:kind==='bloom'?'bloom':'screen',params:{...state.params,...(kind==='bloom'?bloomBase:screenBase),...pp}}),sc=scene(st,3,uidOf(st)+'-'+i,[x,y,x+cw,y+cw]);
  if(kind==='bloom')drawBloom(sc,{cx:x+cw/2,cy:y+cw/2,R:cw*.43,turn:st.params.turn*D2R,idx:0});else drawScreen(sc,[x+8,y+8,x+cw-8,y+cw-8]);
  const pnt=paint(sc);defs.push(pnt.defs);parts.push(`<g data-tile="${esc(label)}">${pnt.body}<text x="${x+10}" y="${y+cw+18}" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="13" fill="${type}">${esc(label)}</text></g>`);});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs>${parts.join('')}</svg>`;}
