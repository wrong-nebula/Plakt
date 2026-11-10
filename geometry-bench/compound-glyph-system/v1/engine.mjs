/* Compound-glyph silhouettes — type system study after Ryuichi Yamashiro,
 * Shigeo Fukuda, Masuteru Aoba and Shin Matsunaga. A silhouette (an authored
 * vector shape, or a word set in a heavy face) becomes a signed distance field.
 * A density field over it drives seeded blue-noise sampling (random sequential
 * adsorption against a spatial hash), and every sample takes a glyph from an
 * escalation set (木 → 林 → 森, 口 → 吕 → 品, o → oo → ooo, . → : → ∴ …) by
 * local density, depth, size or chance. Size, turn and colour follow controls
 * and an orientation flow (mask gradient, radial, swirl, curl noise). Extends
 * the Swift "Glyph and image density field" recipe (grid rows, one glyph per
 * module, equal ink area) with free placement, glyph escalation and flow.
 */
import {FONTS} from './fonts.mjs';
export const ENGINE='compound-glyph-v1';
export const W=728,H=1030;  // B-series proportion, as Japanese B1 posters
const TAU=Math.PI*2;
export const n=v=>Math.round(v*10)/10;
export const SOURCES=[
 {id:'moma-8384',source:'moma',family:'forest',reads:'a crown of 木 林 森; choice and size follow density, a few large heroes'},
 {id:'moma-7170',source:'moma',family:'alarm',reads:'a skull left open in a field of bombs that follow its outline'},
 {id:'moma-5834',source:'moma',family:'scribe',reads:'a head filled with outlined hand lettering and squiggles'},
 {id:'pgda-14233',source:'pgda',family:'appeal',reads:'a disc of tiny written words fading past its edge'},
 {id:'moma-5008',source:'moma',family:'beach',reads:'a page of tiny figures, turned at random, with one odd element'}
];

// ── Escalation sets. A level lists alternatives (|). Tokens are glyph runs
// in the mark font, compositions (x2: pair, x3: triangle, v2: stack) or
// primitives (@name). The empty levels are filled from the text or custom field.
export const SETS=[
 {id:'forest',name:'木 → 林 → 森',levels:['木','林','森']},
 {id:'mouth',name:'口 → 吕 → 品',levels:['口','吕','品']},
 {id:'sun',name:'日 → 昌 → 晶',levels:['日','昌','晶']},
 {id:'fire',name:'火 → 炎 → 焱',levels:['火','炎','焱']},
 {id:'water',name:'水 → 沝 → 淼',levels:['水','沝','淼']},
 {id:'people',name:'人 → 从 → 众',levels:['人','从','众']},
 {id:'earth',name:'土 → 圭 → 垚',levels:['土','圭','垚']},
 {id:'stone',name:'石 → 砳 → 磊',levels:['石','砳','磊']},
 {id:'cart',name:'車 → 䡛 → 轟',levels:['車','䡛','轟']},
 {id:'count',name:'一 → 二 → 三',levels:['一','二','三']},
 {id:'kana',name:'し → い → あ (stroke count)',levels:['し|つ|く|へ|て|の|ん|そ','い|こ|り|う|と|ら|ち|す','あ|お|ぬ|ね|め|ゆ|を|む']},
 {id:'o',name:'o → oo → ooo',levels:['o','oo','ooo']},
 {id:'dots',name:'. → : → ∴',levels:['@dot1','@dot2','@dot3']},
 {id:'spark',name:'· → + → ✳',levels:['@dot1','@plus','@star']},
 {id:'dashes',name:'— → = → ≡',levels:['@dash','@dash2','@dash3']},
 {id:'shells',name:'Shells, short → long',levels:['@shell:.75','@shell:1','@shell:1.3']},
 {id:'figures',name:'Figure → pair → group',levels:['@fig:0|@fig:1|@fig:2|@fig:3','@figs:2','@figs:3']},
 {id:'scribble',name:'Squiggle → letter → capital',levels:['@sq:0|@sq:1|@sq:2|@sq:3|@sq:4|@sq:5|@sq:6|@sq:7','a|e|o|s|c|u|n|m|r|l|w|g','A|B|C|D|E|F|G|K|M|R|S|W|Y']},
 {id:'letters',name:'Letters of the word',levels:null},
 {id:'word',name:'The word, built up',levels:null},
 {id:'repeat',name:'Repeat: x → xx → x/xx',levels:null},
 {id:'custom',name:'Custom levels',levels:null}
];
export const MASKS=[
 {id:'crown',name:'Crown (Forest)'},{id:'tree',name:'Tree'},{id:'forest',name:'Three conifers'},{id:'head',name:'Head profile'},{id:'skull',name:'Skull'},{id:'disc',name:'Disc'},
 {id:'hand',name:'Open hand'},{id:'wave',name:'Breaking wave'},{id:'fuji',name:'Mountain'},{id:'page',name:'Whole page'},{id:'text',name:'The word'}];
export const LAYOUTS=[{id:'poster',name:'Poster with foot title'},{id:'bleed',name:'Full bleed, small label'},{id:'banner',name:'Silhouette over a big title'},{id:'column',name:'Silhouette and vertical title'},{id:'stamp',name:'Disc and stamp box'}];
export const OPTIONS={mask:MASKS.map(m=>m.id),face:['black','condensed','heavy'],set:SETS.map(s=>s.id),font:['mincho','gothic','maru','script'],level:['density','edge','size','random','cycle'],
 field:['flat','core','edge','radial','vertical','noise','rings'],flow:['none','tangent','normal','radial','swirl','curl'],colorMode:['level','single','random','field'],render:['fill','outline','glow','shadow'],odd:['same','swap','sun','heart','ring'],layout:LAYOUTS.map(l=>l.id)};
export const CONTROLS=[
 {key:'maskScale',label:'Silhouette size',group:'silhouette',min:.4,max:1.2,step:.01,value:1},
 {key:'maskShift',label:'Silhouette offset',group:'silhouette',min:-.3,max:.3,step:.01,value:0},
 {key:'inside',label:'Inside density',group:'silhouette',min:0,max:1,step:.01,value:1},
 {key:'outside',label:'Outside density',group:'silhouette',min:0,max:1,step:.01,value:0},
 {key:'feather',label:'Edge softness',group:'silhouette',min:0,max:1,step:.01,value:0},
 {key:'contour',label:'Edge rows',group:'silhouette',min:0,max:3,step:1,value:1},
 {key:'amount',label:'Field strength',group:'field',min:0,max:1,step:.01,value:.6},
 {key:'curve',label:'Density curve',group:'field',min:.3,max:3,step:.05,value:1},
 {key:'scale',label:'Noise scale',group:'field',min:.5,max:6,step:.1,value:2},
 {key:'size',label:'Mark size',group:'marks',min:5,max:48,step:.5,value:14},
 {key:'gap',label:'Spacing',group:'marks',min:.6,max:2.4,step:.01,value:1},
 {key:'sizeRange',label:'Size follows density',group:'marks',min:0,max:1,step:.01,value:.3},
 {key:'jitter',label:'Size jitter',group:'marks',min:0,max:1,step:.01,value:.2},
 {key:'heroes',label:'Hero marks',group:'marks',min:0,max:16,step:1,value:0},
 {key:'heroScale',label:'Hero scale',group:'marks',min:1.5,max:7,step:.1,value:3.5},
 {key:'balance',label:'Ink balance (em → equal ink)',group:'marks',min:0,max:1,step:.01,value:0},
 {key:'bias',label:'Escalation bias',group:'escalation',min:-1,max:1,step:.01,value:0},
 {key:'mix',label:'Level noise',group:'escalation',min:0,max:1,step:.01,value:.3},
 {key:'strength',label:'Flow strength',group:'flow',min:0,max:1,step:.01,value:0},
 {key:'angle',label:'Base angle',group:'flow',min:-90,max:90,step:1,value:0},
 {key:'spin',label:'Rotation jitter',group:'flow',min:0,max:180,step:1,value:0},
 {key:'odd',label:'Odd ones out',group:'finish',min:0,max:5,step:1,value:0},
 {key:'oddScale',label:'Odd scale',group:'finish',min:1,max:4,step:.05,value:2},
 {key:'weight',label:'Ink weight',group:'finish',min:0,max:2,step:.01,value:.5},
 {key:'glow',label:'Glow / ink bleed',group:'finish',min:0,max:1,step:.01,value:0},
 {key:'seed',label:'Seed',group:'finish',min:1,max:999,step:1,value:7}
];
// When a control has no visible effect, so the editor can disable it.
export function activeControls(s){const p=s.params,set=SETS.find(x=>x.id===s.set),multi=levelsOf(s).length>1;
 const on={maskScale:true,maskShift:s.mask!=='page',inside:true,outside:true,feather:p.inside!==p.outside,contour:true,amount:s.field!=='flat',curve:s.field!=='flat'&&p.amount>0,scale:s.field==='noise'||s.flow==='curl',
  size:true,gap:true,sizeRange:s.field!=='flat'&&p.amount>0||p.inside!==p.outside||p.feather>0,jitter:true,heroes:true,heroScale:p.heroes>0,balance:levelsOf(s).flat().length>1,bias:multi,mix:multi&&s.level!=='cycle',
  strength:s.flow!=='none',angle:s.flow==='none'||p.strength<1,spin:true,odd:true,oddScale:p.odd>0,weight:true,glow:true,seed:true};
 return Object.keys(on).filter(k=>on[k]&&set);}

const shape0={maskScale:1,maskShift:0,inside:1,outside:0,feather:0,contour:1,amount:.6,curve:1,scale:2,size:14,gap:1,sizeRange:.3,jitter:.2,heroes:0,heroScale:3.5,balance:0,bias:0,mix:.3,strength:0,angle:0,spin:0,odd:0,oddScale:2,weight:.5,glow:0,seed:7};
// Palette roles: ground, ink 1–3 (escalation levels), accent (odd ones), line (type and diagrams).
export const FAMILIES=[
 {id:'forest',name:'Forest ink',after:'Ryuichi Yamashiro, Forest, 1954',palette:'Paper / sumi ink / vermilion',colors:['#ece7dc','#171512','#171512','#171512','#c8321e','#171512'],text:'森',custom:'木 林 森',oddToken:'人',
  set:{mask:'crown',face:'heavy',set:'forest',font:'mincho',level:'density',field:'noise',flow:'none',colorMode:'single',render:'fill',odd:'swap',layout:'poster',params:{...shape0,size:15,gap:1.1,sizeRange:.45,jitter:.4,heroes:10,heroScale:4.4,amount:.8,curve:1.15,scale:2.6,mix:.45,bias:-.02,contour:1,glow:.1,weight:.3,seed:54}},
  title:'FOREST',info:'Type system study after Ryuichi Yamashiro / 1954 / 木 → 林 → 森 follow the density of the wood',note:'A crown of trees: sparse ground takes 木, denser ground 林, the thickest 森. A few large heroes set the scale.'},
 {id:'alarm',name:'Alarm shells',after:'Shigeo Fukuda, No More, 1968',palette:'Signal red / black',colors:['#f8234a','#130b0e','#130b0e','#130b0e','#ffffff','#130b0e'],text:'NO',custom:'@shell:.8 @shell:1.2',oddToken:'@ring',
  set:{mask:'skull',face:'black',set:'shells',font:'gothic',level:'density',field:'flat',flow:'tangent',colorMode:'single',render:'fill',odd:'heart',layout:'bleed',params:{...shape0,size:34,gap:1.08,inside:.1,outside:1,contour:2,sizeRange:.2,jitter:.08,strength:.82,angle:90,spin:4,mix:.6,seed:68,maskScale:1.04}},
  title:'NO MORE',info:'After Shigeo Fukuda / 1968',note:'The skull is the gap: shells pack tightly outside and wrap its outline; a few drift inside. Eye sockets and nose fill up.'},
 {id:'scribe',name:'Written head',after:'Masuteru Aoba, Tategumi Yokogumi, 1993',palette:'Stone / taupe tubes',colors:['#e8e5df','#7a6e5f','#7a6e5f','#7a6e5f','#c8321e','#4f463c'],text:'Aa',custom:'@sq:0|@sq:3 a|o|e A|B|M',oddToken:'@star',
  set:{mask:'head',face:'heavy',set:'scribble',font:'script',level:'random',field:'flat',flow:'none',colorMode:'single',render:'outline',odd:'ring',layout:'bleed',params:{...shape0,size:30,gap:.84,contour:1,jitter:.3,sizeRange:0,spin:180,weight:.9,mix:0,seed:93,maskScale:1.06,maskShift:.04}},
  title:'HANDWRITING',info:'After Masuteru Aoba / 1993',note:'A head drawn by hand: squiggles, letters and capitals, each an outlined tube, turned at random.'},
 {id:'appeal',name:'Written disc',after:'Masuteru Aoba, Hiroshima Appeals',palette:'Paper / orange / rose / pink',colors:['#f7f2ee','#f2662d','#e7344f','#f49bb3','#1b1b1b','#2a2626'],text:'peace',custom:'pe pea peace',oddToken:'平',
  set:{mask:'disc',face:'heavy',set:'word',font:'script',level:'random',field:'radial',flow:'none',colorMode:'random',render:'fill',odd:'heart',layout:'stamp',params:{...shape0,size:12,gap:.74,inside:1,outside:.13,feather:.7,contour:0,amount:.12,curve:1,sizeRange:.25,jitter:.25,angle:-6,spin:16,weight:.35,mix:0,bias:.25,seed:85,maskScale:.98}},
  title:'NO/NO/NO',info:'H I R O S H I M A   A P P E A L S   2 0 2 6',note:'Every mark is the word, written small and built up letter by letter. The disc fades into the paper.'},
 {id:'beach',name:'Beach crowd',after:'Shin Matsunaga, Shiseido Sun Oil, 1971',palette:'Sand / skin / swim blue / sun yellow',colors:['#f1ece2','#c46a3c','#83462a','#3c6fb8','#f5c11a','#2a2420'],text:'人',custom:'@fig:0|@fig:2 @figs:2 @figs:3',oddToken:'@ring',
  set:{mask:'page',face:'heavy',set:'figures',font:'gothic',level:'random',field:'noise',flow:'none',colorMode:'random',render:'shadow',odd:'sun',layout:'bleed',params:{...shape0,size:27,gap:.9,contour:0,amount:.3,scale:3,sizeRange:.2,jitter:.25,spin:180,odd:1,oddScale:3.4,mix:0,seed:71,maskScale:1.04}},
  title:'SUMMER',info:'After Shin Matsunaga / 1971',note:'A page of tiny figures alone, in pairs and in groups, turned at random, with one sun among them.'},
 {id:'electro',name:'Electro swarm',after:'new — neon type with marks',palette:'Night / cyan / violet / magenta / acid',colors:['#07060b','#19f0ff','#7a5cff','#ff2bd6','#c6ff3d','#efeaff'],text:'RA/VE',custom:'@dot1 @plus @star',oddToken:'@ring',
  set:{mask:'text',face:'black',set:'spark',font:'gothic',level:'density',field:'edge',flow:'curl',colorMode:'field',render:'glow',odd:'same',layout:'poster',params:{...shape0,size:13,gap:1.04,contour:1,amount:.85,curve:1.2,scale:2.4,sizeRange:.45,jitter:.2,strength:.7,mix:.2,glow:.5,weight:.2,odd:3,oddScale:2.4,seed:12}},
  title:'RAVE 2026',info:'Electro swarm / the word drawn by sparks / dots, crosses, stars by density',note:'A word in a heavy face is the silhouette. Sparks escalate from dots to crosses to stars toward its edges and swirl on curl noise.'},
 {id:'kanji',name:'Kanji in kanji',after:'new — type written with type',palette:'Paper / three greens / vermilion',colors:['#f3f1ea','#8dbb94','#2f7a52','#0e3a2c','#e0452b','#0e3a2c'],text:'森',custom:'木 林 森',oddToken:'人',
  set:{mask:'text',face:'heavy',set:'forest',font:'gothic',level:'edge',field:'core',flow:'none',colorMode:'level',render:'fill',odd:'swap',layout:'banner',params:{...shape0,size:12,gap:1.02,contour:1,amount:.5,sizeRange:.35,jitter:.15,mix:.15,bias:0,odd:1,oddScale:2.2,seed:31,maskScale:1}},
  title:'MORI',info:'Kanji in kanji / 森 written with 木 林 森 / near the edge one tree, deep inside a forest',note:'The big character is the silhouette; the small ones climb from 木 at its edges to 森 at its core.'},
 {id:'halftone',name:'Dot halftone',after:'new — punctuation halftone',palette:'Newsprint / process blue / orange',colors:['#ece8dc','#1f3fbd','#1f3fbd','#1f3fbd','#f05a28','#1f3fbd'],text:'TOUCH',custom:'@dot1 @dot2 @dot3',oddToken:'@ring',
  set:{mask:'hand',face:'heavy',set:'dots',font:'gothic',level:'edge',field:'radial',flow:'normal',colorMode:'single',render:'fill',odd:'same',layout:'column',params:{...shape0,size:18,gap:1.06,contour:1,amount:.55,sizeRange:.5,jitter:.1,strength:1,angle:90,mix:.1,bias:-.05,odd:1,oddScale:2.6,seed:44}},
  title:'TOUCH',info:'Dot halftone / . : ∴ by depth / marks turn with the edge',note:'Punctuation as halftone: one dot near the edge, two inside, three deep in the palm. Marks turn to face the outline.'},
 {id:'riso',name:'Riso wave',after:'new — kana riso print',palette:'Paper / fluorescent pink / violet / blue / yellow',colors:['#f3efe4','#ff48b0','#7a63d6','#0078bf','#ffd400','#0b3a6b'],text:'波',custom:'し|つ い|こ あ|お',oddToken:'人',
  set:{mask:'wave',face:'heavy',set:'kana',font:'maru',level:'edge',field:'core',flow:'tangent',colorMode:'level',render:'fill',odd:'sun',layout:'banner',params:{...shape0,size:15,gap:1.02,contour:2,amount:.4,sizeRange:.3,jitter:.15,strength:.55,mix:.2,bias:.05,odd:1,oddScale:3,seed:23}},
  title:'NAMI 波',info:'Riso wave / kana by stroke count / し つ く at the crest, あ お ぬ deep in the water',note:'Kana sorted by stroke count: simple ones ride the edge of the wave, complex ones fill its body; all follow the outline.'},
 {id:'ember',name:'Ember mountain',after:'new — neon fire',palette:'Night / ember / flame / spark white',colors:['#0b0612','#ff4a1c','#ff9b1f','#ffe18c','#ffffff','#ffd9b0'],text:'火',custom:'火 炎 焱',oddToken:'@star',
  set:{mask:'fuji',face:'heavy',set:'fire',font:'mincho',level:'density',field:'vertical',flow:'curl',colorMode:'field',render:'glow',odd:'same',layout:'poster',params:{...shape0,size:16,gap:1.04,contour:1,amount:.8,curve:1.1,scale:1.6,sizeRange:.5,jitter:.25,heroes:3,heroScale:2.8,strength:.25,spin:10,mix:.2,glow:.4,seed:5,maskScale:1.05}},
  title:'火の山 FIRE',info:'Ember mountain / 火 → 炎 → 焱 rise toward the summit / neon on night',note:'A mountain of fire characters: 火 at the foot, 炎 midway and 焱 at the burning summit, glowing on near-black.'}
];

// ── Random, noise, colour
function seeded(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return ((r^r>>>14)>>>0)/4294967296;};}
const hashText=s=>[...String(s)].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const lattice=(i,j,s)=>{let h=Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(s,1442695041);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;};
function noise(x,y,s){const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,a=u*u*(3-2*u),b=v*v*(3-2*v),l=(p,q)=>lattice(p,q,s);return (l(i,j)*(1-a)+l(i+1,j)*a)*(1-b)+(l(i,j+1)*(1-a)+l(i+1,j+1)*a)*b;}
const fbm=(x,y,s)=>(noise(x,y,s)*.6+noise(x*2.1,y*2.1,s+7)*.28+noise(x*4.3,y*4.3,s+13)*.12);
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
const luminance=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};

// ── Paths: parse (absolute, implicit repeats, relative), map, flatten, write.
function parsePath(d){const t=d.match(/[MmLlHhVvQqCcZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g)||[],out=[];let i=0,cmd='M',x=0,y=0,sx=0,sy=0;const num=()=>+t[i++];
 while(i<t.length){if(/[a-z]/i.test(t[i])){cmd=t[i++];if(cmd==='Z'||cmd==='z'){out.push(['Z']);x=sx;y=sy;continue;}}
  const C=cmd.toUpperCase(),r=cmd!==C;
  if(C==='M'){x=num()+(r?x:0);y=num()+(r?y:0);sx=x;sy=y;out.push(['M',x,y]);cmd=r?'l':'L';}
  else if(C==='L'){x=num()+(r?x:0);y=num()+(r?y:0);out.push(['L',x,y]);}
  else if(C==='H'){x=num()+(r?x:0);out.push(['L',x,y]);}else if(C==='V'){y=num()+(r?y:0);out.push(['L',x,y]);}
  else if(C==='Q'){const a=[num(),num(),num(),num()];if(r){a[0]+=x;a[1]+=y;a[2]+=x;a[3]+=y;}out.push(['Q',...a]);x=a[2];y=a[3];}
  else if(C==='C'){const a=[num(),num(),num(),num(),num(),num()];if(r)for(let k=0;k<6;k+=2){a[k]+=x;a[k+1]+=y;}out.push(['C',...a]);x=a[4];y=a[5];}
  else i++;}
 return out;}
const mapSegs=(segs,f)=>segs.map(s=>{if(s[0]==='Z')return s;const o=[s[0]];for(let k=1;k<s.length;k+=2)o.push(...f(s[k],s[k+1]));return o;});
const segString=segs=>segs.map(s=>s[0]+s.slice(1).map(n).join(' ')).join('');
function flatten(segs,steps=6){const polys=[];let cur=null,x=0,y=0;
 for(const s of segs){const c=s[0];if(c==='M'){if(cur&&cur.length>1)polys.push(cur);cur=[[s[1],s[2]]];x=s[1];y=s[2];continue;}if(c==='Z'){if(cur&&cur.length>1)polys.push(cur);cur=null;continue;}if(!cur)cur=[[x,y]];
  if(c==='L')cur.push([s[1],s[2]]);
  else if(c==='Q')for(let k=1;k<=steps;k++){const u=k/steps,a=(1-u)**2,b=2*u*(1-u),e=u*u;cur.push([a*x+b*s[1]+e*s[3],a*y+b*s[2]+e*s[4]]);}
  else if(c==='C')for(let k=1;k<=steps;k++){const u=k/steps,a=(1-u)**3,b=3*u*(1-u)**2,e=3*u*u*(1-u),g=u**3;cur.push([a*x+b*s[1]+e*s[3]+g*s[5],a*y+b*s[2]+e*s[4]+g*s[6]]);}
  x=s[s.length-2];y=s[s.length-1];}
 if(cur&&cur.length>1)polys.push(cur);return polys;}
const signedArea=p=>p.reduce((s,[x,y],i)=>{const [u,v]=p[(i+1)%p.length];return s+x*v-u*y;},0)/2;
const orient=(p,sign)=>Math.sign(signedArea(p))===sign?p:p.slice().reverse();
const polyString=polys=>polys.map(p=>'M'+p.map(([x,y])=>n(x)+' '+n(y)).join('L')+'Z').join('');
const lineString=lines=>lines.map(p=>'M'+p.map(([x,y])=>n(x)+' '+n(y)).join('L')).join('');
function bounds(pts){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of pts){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return [x0,y0,x1,y1];}

// ── Glyphs. A face that lacks a compound composes it from its radical, the
// way the compounds were made: 沝 = 水 水, 众 = 人 over 人 人.
export const COMPOSE={林:'x2:木',森:'x3:木',吕:'v2:口',品:'x3:口',昌:'v2:日',晶:'x3:日',炎:'v2:火',焱:'x3:火',沝:'x2:水',淼:'x3:水',从:'x2:人',众:'x3:人',圭:'v2:土',垚:'x3:土',砳:'x2:石',磊:'x3:石',䡛:'x2:車',轟:'x3:車',二:'v2:一',三:'x3:一'};
const BOXES={x2:[[.02,0,.5,1],[.5,0,.98,1]],v2:[[.06,0,.94,.5],[.06,.5,.94,1]],x3:[[.25,0,.75,.5],[0,.5,.5,1],[.5,.5,1,1]]};
const glyphCache=new Map();
// Outline of one character in a face (1000 em, y down, baseline 0), with fallbacks.
function glyph(face,ch){const key=face+'|'+ch;if(glyphCache.has(key))return glyphCache.get(key);let g=null;const f=FONTS[face],raw=f.glyphs[ch];
 if(raw)g={segs:parsePath(raw[0]),adv:raw[1],kind:f.kind,face,composed:false};
 else if(COMPOSE[ch]&&f.kind==='fill'){const [k,c]=COMPOSE[ch].split(':'),base=glyph(face,c);if(base){const asc=f.ascent,dsc=-f.descent,adv=base.adv;
   g={segs:BOXES[k].flatMap(([u0,v0,u1,v1])=>mapSegs(base.segs,(x,y)=>[(u0+x/adv*(u1-u0))*adv,-asc+(v0+(y+asc)/(asc+dsc)*(v1-v0))*(asc+dsc)])),adv,kind:'fill',face,composed:true};}}
 // Fallback chain without cycles: mark faces → gothic → heavy (raw only); word faces → heavy → gothic.
 if(!g){const next=face==='heavy'?'gothic':face==='gothic'?null:FONTS[face].role==='mark'?'gothic':'heavy';if(next)g=glyph(next,ch);}
 if(!g&&face==='gothic'&&FONTS.heavy.glyphs[ch])g=glyph('heavy',ch);
 glyphCache.set(key,g);return g;}
export const hasGlyph=(face,ch)=>!!glyph(face,ch);
// A run of characters laid by advance; the script face is used only when it has every character.
function run(face,str){if(face==='script'&&[...str].some(c=>!FONTS.script.glyphs[c]))face='gothic';const segs=[];let x=0,composed=false,kind='fill';
 for(const ch of str){if(ch===' '){x+=300;continue;}const g=glyph(face,ch);if(!g)continue;segs.push(...mapSegs(g.segs,(a,b)=>[a+x,b]));x+=g.adv;composed||=g.composed;kind=g.kind;}
 return {segs,adv:x,kind,composed};}

// ── Primitive marks on a 100-unit em, centred, pointing along +x.
const circle=(cx,cy,r,k=24)=>Array.from({length:k},(_,i)=>{const a=-i/k*TAU;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});
const capsule=(x1,y1,x2,y2,r,k=7)=>{const a=Math.atan2(y2-y1,x2-x1),p=[];for(let i=0;i<=k;i++){const t=a-Math.PI/2-i/k*Math.PI;p.push([x1+r*Math.cos(t),y1+r*Math.sin(t)]);}for(let i=0;i<=k;i++){const t=a+Math.PI/2-i/k*Math.PI;p.push([x2+r*Math.cos(t),y2+r*Math.sin(t)]);}return p;};
const xf=(polys,s,dx,dy)=>polys.map(p=>p.map(([x,y])=>[x*s+dx,y*s+dy]));
function figure(pose){const head=circle(35,0,9.5,16),torso=capsule(-4,0,20,0,11),arm=(a,b,c,d)=>capsule(a,b,c,d,3.6,5),leg=(a,b,c,d)=>capsule(a,b,c,d,5,5);
 const poses=[[arm(18,-12,-6,-16),arm(18,12,-6,16),leg(-8,-5,-46,-6),leg(-8,5,-46,6)],[arm(20,-11,48,-15),arm(20,11,48,15),leg(-8,-5,-46,-7),leg(-8,5,-46,5)],
  [arm(18,-11,34,-33),arm(18,11,34,33),leg(-8,-5,-40,-22),leg(-8,5,-40,22)],[arm(18,-12,0,-24),arm(18,12,32,22),leg(-8,-5,-26,-17),leg(-26,-17,-46,-9),leg(-8,5,-46,9)]];
 return [head,torso,...poses[pose%4]];}
function squiggle(k){const r=seeded(k*7919+11),pts=[];let x=0,y=0,a=r()*TAU,turn=[.45,1.1,1.9,.8][k%4];
 for(let i=0;i<7;i++){pts.push([x,y]);a+=(r()-.5)*2*turn+(k%4===2?1.2:0);x+=Math.cos(a)*18;y+=Math.sin(a)*18;}
 const [x0,y0,x1,y1]=bounds(pts),s=86/Math.max(x1-x0,y1-y0,40),cx=(x0+x1)/2,cy=(y0+y1)/2,P=pts.map(([u,v])=>[(u-cx)*s,(v-cy)*s]),out=[];
 for(let i=0;i<P.length-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];for(let t=0;t<4;t++){const u=t/4,u2=u*u,u3=u2*u;
  out.push([0,1].map(c=>.5*((2*p1[c])+(-p0[c]+p2[c])*u+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*u2+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*u3)));}}
 out.push(P[P.length-1]);return [out];}
const PRIMS={
 dot1:()=>({fill:[circle(0,0,21)]}),dot2:()=>({fill:[circle(0,-24,17),circle(0,24,17)]}),dot3:()=>({fill:[circle(0,-24,17),circle(-26,20,17),circle(26,20,17)]}),
 dash:()=>({fill:[capsule(-46,0,46,0,9)]}),dash2:()=>({fill:[capsule(-46,-13,46,-13,7),capsule(-46,13,46,13,7)]}),dash3:()=>({fill:[capsule(-46,-23,46,-23,6),capsule(-46,0,46,0,6),capsule(-46,23,46,23,6)]}),
 shell:(L=1)=>{const top=[[50,0],[47,-5.5],[41,-9],[33,-10.5],[-26,-10.5],[-34,-8],[-40,-4.5],[-44,-4.5],[-50,-10.5],[-54,-10.5],[-52,-3]];return {fill:[[...top,...top.slice(1).reverse().map(([x,y])=>[x,-y])].map(([x,y])=>[x*L,y])]};},
 plus:()=>({fill:[[[-46,-10],[-10,-10],[-10,-46],[10,-46],[10,-10],[46,-10],[46,10],[10,10],[10,46],[-10,46],[-10,10],[-46,10]]]}),
 star:()=>({fill:[Array.from({length:6},(_,k)=>{const a=k*Math.PI/3,p=(r,b)=>[r*Math.cos(a+b),r*Math.sin(a+b)];return [p(13,-Math.PI/6),p(49,-.13),p(49,.13)];}).flat()]}),
 ring:()=>({fill:[circle(0,0,46,32)],holes:[circle(0,0,30,32)]}),
 heart:()=>({fill:[Array.from({length:40},(_,i)=>{const t=i/40*TAU;return [16*Math.sin(t)**3*2.9,-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*2.9-6];})]}),
 sun:()=>({fill:[circle(0,0,25,28),...Array.from({length:10},(_,k)=>{const a=k*TAU/10,p=(r,b)=>[r*Math.cos(a+b),r*Math.sin(a+b)];return [p(30,-.17),p(49,0),p(30,.17)];})]}),
 fig:(p=0)=>({fill:figure(+p)}),
 figs:(c=2)=>({fill:+c===2?[...xf(figure(0),.78,0,-14),...xf(figure(3),.78,4,14)]:[...xf(figure(1),.62,-4,-26),...xf(figure(0),.62,6,0),...xf(figure(2),.62,-2,26)]}),
 sq:(k=0)=>({line:squiggle(+k)})
};
export const PRIMITIVES=Object.keys(PRIMS);

// ── Tokens: one mark design, centred on its box, as a 100-unit-em path.
const tokenCache=new Map();
export function token(spec,font){const key=font+'|'+spec;if(tokenCache.has(key))return tokenCache.get(key);let t;
 if(spec.startsWith('@')){const [name,arg]=spec.slice(1).split(':'),p=PRIMS[name](arg===undefined?undefined:arg);
  if(p.line){const pts=p.line.flat(),[x0,y0,x1,y1]=bounds(pts),cx=(x0+x1)/2,cy=(y0+y1)/2,lines=p.line.map(l=>l.map(([x,y])=>[x-cx,y-cy]));let len=0;for(const l of lines)for(let i=1;i<l.length;i++)len+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);
   t={d:lineString(lines),kind:'line',w:(x1-x0)/100,h:(y1-y0)/100,area:len*9/1e4,composed:false};}
  else{const polys=[...p.fill.map(q=>orient(q,-1)),...(p.holes??[]).map(q=>orient(q,1))],[x0,y0,x1,y1]=bounds(p.fill.flat()),cx=(x0+x1)/2,cy=(y0+y1)/2,P=polys.map(q=>q.map(([x,y])=>[x-cx,y-cy]));
   t={d:polyString(P),kind:'fill',w:(x1-x0)/100,h:(y1-y0)/100,area:Math.abs(polys.reduce((s,q)=>s+signedArea(q),0))/1e4,composed:false};}}
 else{const [k,c]=/^(x2|x3|v2):/.test(spec)?spec.split(':'):[null,spec],r=k?(()=>{const g=glyph(font==='script'&&!FONTS.script.glyphs[c]?'gothic':font,c);if(!g)return {segs:[],adv:0,kind:'fill'};
   const asc=FONTS[g.face].ascent,dsc=-FONTS[g.face].descent,adv=g.adv;return {segs:BOXES[k].flatMap(([u0,v0,u1,v1])=>mapSegs(g.segs,(x,y)=>[(u0+x/adv*(u1-u0))*adv,-asc+(v0+(y+asc)/(asc+dsc)*(v1-v0))*(asc+dsc)])),kind:g.kind,composed:true};})():run(font,spec);
  const flat=flatten(r.segs),pts=flat.flat(),[x0,y0,x1,y1]=pts.length?bounds(pts):[0,0,1,1],cx=(x0+x1)/2,cy=(y0+y1)/2,segs=mapSegs(r.segs,(x,y)=>[(x-cx)/10,(y-cy)/10]);
  let area=0;if(r.kind==='line'){for(const l of flat)for(let i=1;i<l.length;i++)area+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);area=area/10*9/1e4;}else area=Math.abs(flat.reduce((s,q)=>s+signedArea(q),0))/1e6;
  t={d:segString(segs),kind:r.kind,w:Math.max(.05,(x1-x0)/1000),h:Math.max(.05,(y1-y0)/1000),area:Math.max(.002,area),composed:!!r.composed};}
 tokenCache.set(key,t);return t;}

// ── Text input. The word is the mask (in a heavy face) and the source of the
// letters, word and repeat sets; rows break at '/'.
const MARK_CHARS=new Set([...Object.keys(FONTS.gothic.glyphs),...Object.keys(COMPOSE)]),TEXT_CHARS=new Set([...MARK_CHARS,...Object.keys(FONTS.heavy.glyphs)]);
export function normalizeText(input,fallback){
 const t=String(input??'').normalize('NFKC').replace(/[‘’`´]/g,"'").replace(/[–—]/g,'-').replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim();
 if(!t){if(fallback!==undefined)return fallback;throw new Error('Type at least one character.');}
 const bad=[...t].filter(c=>c!==' '&&c!=='/'&&!TEXT_CHARS.has(c));if(bad.length)throw new Error(`Not in the bundled faces: ${[...new Set(bad)].join(' ')}. Use A–Z, a–z, 0–9, kana or the listed kanji; / starts a new row.`);
 const rows=t.split('/');if(rows.length>3)throw new Error('Use at most three rows.');if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if(t.replace(/[ /]/g,'').length>24)throw new Error('Use at most 24 characters.');return rows.map(r=>r.trim()).join('/');}
// Custom escalation: levels separated by spaces (or →), alternatives by |; @name for primitives.
export function normalizeLevels(input,fallback){
 const t=String(input??'').normalize('NFKC').replace(/→|,/g,' ').replace(/\s*\|\s*/g,'|').replace(/\s+/g,' ').trim();
 if(!t){if(fallback!==undefined)return fallback;throw new Error('Type at least one level, e.g. 木 林 森.');}
 const levels=t.split(' ');if(levels.length>6)throw new Error('Use at most six levels.');
 for(const l of levels){const alts=l.split('|');if(alts.length>12||alts.some(a=>!a))throw new Error('Use up to twelve alternatives per level, separated by |.');
  for(const a of alts){if(a.startsWith('@')){const [name,arg]=a.slice(1).split(':');if(!PRIMS[name]||arg!==undefined&&!/^\d*\.?\d+$/.test(arg))throw new Error(`Unknown mark ${a}. Primitives: ${PRIMITIVES.map(p=>'@'+p).join(' ')}.`);if(name==='shell'&&arg!==undefined&&!(+arg>=.3&&+arg<=2))throw new Error('Shell length runs from .3 to 2.');continue;}
   if([...a].length>8)throw new Error('Keep each mark to eight characters.');const bad=[...a].filter(c=>!MARK_CHARS.has(c));if(bad.length)throw new Error(`Not in the mark faces: ${[...new Set(bad)].join(' ')}.`);}}
 return levels.join(' ');}
// The levels of the active set, each a list of token specs.
export function levelsOf(s){const set=SETS.find(x=>x.id===s.set)??SETS[0],word=s.text.split('/')[0].replace(/ /g,''),chars=[...word];
 if(set.levels)return set.levels.map(l=>l.split('|'));
 if(set.id==='letters')return [[...new Set(chars)]];
 if(set.id==='word'){const k=chars.length;return k<3?[[chars[0]],[word]]:[[chars.slice(0,Math.ceil(k/3)).join('')],[chars.slice(0,Math.ceil(2*k/3)).join('')],[word]];}
 if(set.id==='repeat')return [[chars[0]],['x2:'+chars[0]],['x3:'+chars[0]]];
 return s.custom.split(' ').map(l=>l.split('|'));}

const clampNum=(v,c)=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(+v)?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):c.value;
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,given={...input.params},params={};
 for(const c of CONTROLS)params[c.key]=clampNum(given[c.key]??set.params[c.key],{...c,value:set.params[c.key]??c.value});
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k];let text,custom;try{text=normalizeText(input.text,family.text);}catch{text=family.text;}try{custom=normalizeLevels(input.custom,family.custom);}catch{custom=family.custom;}
 const colors=Array.isArray(input.colors)&&input.colors.length===6&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&"]/g,'').slice(0,max):d;
 const out={engine:ENGINE,family:family.id,text,custom,title:clip(input.title,family.title,40),info:clip(input.info,family.info,140),stage:[1,2,3,4].includes(+input.stage)?+input.stage:4};
 for(const k of Object.keys(OPTIONS))out[k]=pick(k);out.params=params;out.colors=colors;return out;}

// ── Silhouettes: authored shapes in their own box, as ops of polygon groups.
const smoothShape=(pts,k=8)=>{const P=pts.map(p=>[p[0],p[1]]),m=P.length,out=[];
 for(let i=0;i<m;i++){const p0=P[(i-1+m)%m],p1=P[i],p2=P[(i+1)%m],p3=P[(i+2)%m],c1=pts[i][2]?0:1,c2=pts[(i+1)%m][2]?0:1;
  const t1=[(p2[0]-p0[0])/6*c1,(p2[1]-p0[1])/6*c1],t2=[(p3[0]-p1[0])/6*c2,(p3[1]-p1[1])/6*c2],b1=[p1[0]+t1[0],p1[1]+t1[1]],b2=[p2[0]-t2[0],p2[1]-t2[1]];
  for(let s=0;s<k;s++){const u=s/k,a=(1-u)**3,b=3*u*(1-u)**2,c=3*u*u*(1-u),d=u**3;out.push([a*p1[0]+b*b1[0]+c*b2[0]+d*p2[0],a*p1[1]+b*b1[1]+c*b2[1]+d*p2[1]]);}}
 return out;};
const ellipse=(cx,cy,rx,ry,rot=0,k=40)=>Array.from({length:k},(_,i)=>{const a=i/k*TAU,x=rx*Math.cos(a),y=ry*Math.sin(a);return [cx+x*Math.cos(rot)-y*Math.sin(rot),cy+x*Math.sin(rot)+y*Math.cos(rot)];});
const conifer=(cx,b,h,w)=>{const tw=w*.07,R=[[.5,.1],[.2,.36],[.38,.36],[.14,.6],[.26,.6],[0,1]];return [[cx-tw,b],[cx+tw,b],[cx+tw,b-h*.1],...R.map(([x,y])=>[cx+w*x,b-h*y]),...R.slice(0,-1).reverse().map(([x,y])=>[cx-w*x,b-h*y]),[cx-tw,b-h*.1]];};
const SHAPES={
 crown:{box:[100,106],ops:[['add',[[smoothShape([[1,2,1],[25,3.2],[50,1.6],[75,3.4],[99,2,1],[99.4,30],[96.5,54],[89,72],[77,88],[61,100],[45,105],[31,100],[18,88],[8,70],[2,48],[.6,25]])]]]]},
 tree:{box:[100,118],ops:[['add',[...[[50,34,26],[29,43,19],[71,43,19],[35,20,17],[65,20,17],[50,54,19],[22,58,13],[78,58,13],[50,13,15]].map(([x,y,r])=>[ellipse(x,y,r,r)]),[smoothShape([[44,58],[56,58],[57,90],[62,104],[74,114,1],[56,111],[50,104],[44,111],[26,114,1],[38,104],[43,90]])]]]]},
 forest:{box:[100,96],ops:[['add',[[conifer(22,94,60,32)],[conifer(52,96,92,44)],[conifer(81,94,54,30)]]]]},
 head:{box:[100,128],ops:[['add',[[smoothShape([[0,128,1],[0,116],[6,110],[16,104],[22,96],[24,86],[18,76],[13,62],[12,46],[16,30],[25,17],[38,8],[52,4.5],[65,6],[76,12],[84,22],[87,32],[87.5,40],[85.5,44.5],[88,49],[95.5,58.5,1],[92,62],[88,63.2],[89.5,66.5],[91.5,68.5],[88.4,71],[90.5,73.5],[87.4,77],[87.6,81],[85,85],[78,87.5],[68,88.5],[66,95],[68,104],[76,110],[90,115],[100,118],[100,128,1]])]]]]},
 skull:{box:[100,116],ops:[['add',[[smoothShape([[50,1],[68,3],[83,11],[93,24],[98,40],[97,55],[94,64],[91,72],[86,77],[84,85],[81,95],[76,104],[66,111],[50,114],[34,111],[24,104],[19,95],[16,85],[14,77],[9,72],[6,64],[3,55],[2,40],[7,24],[17,11],[32,3]])]]],
  ['sub',[[ellipse(31,56,13.5,12,-.18)],[ellipse(69,56,13.5,12,.18)],[smoothShape([[50,66,1],[56,79],[53.5,84],[50,82.5],[46.5,84],[44,79]])],[smoothShape([[31,95],[50,93.5],[69,95],[69,98.5],[50,97],[31,98.5]])],...[37,44,50,56,63].map(x=>[[[x-1,90],[x+1,90],[x+1,103],[x-1,103]]])]]]},
 disc:{box:[100,100],ops:[['add',[[ellipse(50,50,50,50,0,96)]]]]},
 hand:{box:[100,130],ops:[['add',[[smoothShape([[22,62],[50,58],[78,60],[83,80],[77,104],[67,113],[65,130,1],[34,130,1],[32,113],[24,101],[20,84]])],[capsule(31,66,27,23,7.2)],[capsule(45,62,45,13,7.6)],[capsule(59,62,62,18,7.2)],[capsule(72,68,80,35,6.2)],[capsule(25,88,5,58,7.6)]]]]},
 wave:{box:[100,100],ops:[['add',[[smoothShape([[0,100,1],[0,62],[6,40],[18,22],[34,10],[52,6],[68,9],[81,17],[89,28],[91,39],[87,48],[79,52],[71,50],[67,44],[69,38],[74,36,1],[70,30],[60,26],[48,30],[40,40],[38,54],[44,68],[56,78],[72,84],[88,85],[100,82,1],[100,100,1]])]]]]},
 fuji:{box:[100,62],ops:[['add',[[smoothShape([[0,62,1],[8,56],[22,44],[33,29],[40,17],[44,10,1],[48,11.5],[52,9.5],[56,11,1],[60,17],[67,29],[78,44],[92,56],[100,62,1]])]]]]},
 page:{box:null,ops:[['add',[[[[0,0],[1,0],[1,1],[0,1]]]]]]}
};
// The word in a heavy face: each row justified to the mask box width.
function textPolys(text,face,box){const rows=text.split('/').map(r=>{const segs=[];let x=0;for(const ch of r){if(ch===' '){x+=280;continue;}const g=glyph(face,ch);if(!g)continue;segs.push(mapSegs(g.segs,(a,b)=>[a+x,b]));x+=g.adv+40;}
  const groups=segs.map(s=>flatten(s,5)).filter(g=>g.length),pts=groups.flat(2);return {groups,b:pts.length?bounds(pts):[0,-700,100,0]};}).filter(r=>r.groups.length);
 const bw=box[2]-box[0],bh=box[3]-box[1],ks=rows.map(r=>bw/(r.b[2]-r.b[0])),heights=rows.map((r,i)=>(r.b[3]-r.b[1])*ks[i]),gap=bh*.035,total=heights.reduce((a,b)=>a+b,0)+gap*(rows.length-1),f=Math.min(1,bh/total);
 let y=box[1]+(bh-total*f)/2;const out=[];rows.forEach((r,i)=>{const k=ks[i]*f,x=box[0]+(bw-(r.b[2]-r.b[0])*k)/2;for(const g of r.groups)out.push(g.map(p=>p.map(([u,v])=>[x+(u-r.b[0])*k,y+(v-r.b[1])*k])));y+=heights[i]*f+gap*f;});return out;}
// Each group's largest contour is turned the same way, so groups also union under SVG's nonzero fill.
const orientGroup=g=>{let big=g[0],a=0;for(const q of g){const v=Math.abs(signedArea(q));if(v>a){a=v;big=q;}}return signedArea(big)<0?g:g.map(q=>q.slice().reverse());};
export function maskOps(s,box){return maskOps0(s,box).map(([op,groups])=>[op,groups.map(orientGroup)]);}
function maskOps0(s,box){const p=s.params,bw=box[2]-box[0],bh=box[3]-box[1],k=p.maskScale,cx=(box[0]+box[2])/2,cy=(box[1]+box[3])/2+p.maskShift*bh;
 if(s.mask==='text'){const w=bw*k,h=bh*k;return [['add',textPolys(s.text,s.face,[cx-w/2,cy-h/2,cx+w/2,cy+h/2])]];}
 const sh=SHAPES[s.mask];if(!sh.box){const w=bw*k,h=bh*k;return [['add',[[[[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]]]]];}
 const f=Math.min(bw/sh.box[0],bh/sh.box[1])*k,ox=cx-sh.box[0]*f/2,oy=cy-sh.box[1]*f/2;return sh.ops.map(([op,groups])=>[op,groups.map(g=>g.map(q=>q.map(([x,y])=>[ox+x*f,oy+y*f])))]);}

// ── Raster: nonzero scanline fill of each group, then an exact Euclidean
// distance transform (Felzenszwalb) on both sides gives a signed distance.
const C=2,GW=Math.ceil(W/C),GH=Math.ceil(H/C);
function fillGroup(grid,group,value){const rows=Array.from({length:GH},()=>null);let y0=GH,y1=-1;
 for(const p of group)for(let i=0;i<p.length;i++){const [ax,ay]=p[i],[bx,by]=p[(i+1)%p.length];if(ay===by)continue;const lo=Math.max(0,Math.ceil(Math.min(ay,by)/C-.5)),hi=Math.min(GH-1,Math.ceil(Math.max(ay,by)/C-.5)-1),dir=by>ay?1:-1;
  for(let j=lo;j<=hi;j++){const y=(j+.5)*C;(rows[j]??=[]).push(ax+(y-ay)*(bx-ax)/(by-ay),dir);}if(lo<y0)y0=lo;if(hi>y1)y1=hi;}
 for(let j=Math.max(0,y0);j<=y1;j++){const r=rows[j];if(!r)continue;const idx=[];for(let k=0;k<r.length;k+=2)idx.push(k);idx.sort((a,b)=>r[a]-r[b]);let wind=0;
  let xa=0;for(let m=0;m<idx.length;m++){const before=wind;wind+=r[idx[m]+1];if(before===0&&wind!==0)xa=r[idx[m]];else if(before!==0&&wind===0){const i0=Math.max(0,Math.ceil(xa/C-.5)),i1=Math.min(GW-1,Math.floor(r[idx[m]]/C-.5));for(let i=i0;i<=i1;i++)grid[j*GW+i]=value;}}}}
function edt(target){const INF=1e12,N=GW*GH,out=new Float64Array(N);for(let i=0;i<N;i++)out[i]=target[i]?0:INF;const L=Math.max(GW,GH),f=new Float64Array(L),d=new Float64Array(L),v=new Int32Array(L),z=new Float64Array(L+1);
 const pass=len=>{let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;for(let q=1;q<len;q++){let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}k=0;for(let q=0;q<len;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])**2+f[v[k]];}};
 for(let x=0;x<GW;x++){for(let y=0;y<GH;y++)f[y]=out[y*GW+x];pass(GH);for(let y=0;y<GH;y++)out[y*GW+x]=d[y];}
 for(let y=0;y<GH;y++){for(let x=0;x<GW;x++)f[x]=out[y*GW+x];pass(GW);for(let x=0;x<GW;x++)out[y*GW+x]=d[x];}return out;}
const maskCache=new Map();
function maskField(s,box){const key=JSON.stringify([s.mask,s.text,s.face,box,s.params.maskScale,s.params.maskShift]);if(maskCache.has(key))return maskCache.get(key);
 const ops=maskOps(s,box),ins=new Uint8Array(GW*GH);for(const [op,groups] of ops)for(const g of groups)fillGroup(ins,g,op==='add'?1:0);
 const out=new Uint8Array(GW*GH);let area=0;for(let i=0;i<ins.length;i++){out[i]=ins[i]?0:1;area+=ins[i];}const dOut=edt(out),dIn=edt(ins),sdf=new Float32Array(GW*GH);
 let depth=0;for(let i=0;i<sdf.length;i++){sdf[i]=ins[i]?(Math.sqrt(dOut[i])-.5)*C:-(Math.sqrt(dIn[i])-.5)*C;if(sdf[i]>depth)depth=sdf[i];}
 // depth: the half-width of the silhouette's thickest part (a disc's radius, a letter's half stroke).
 const pts=ops.filter(o=>o[0]==='add').flatMap(o=>o[1].flat(2)),m={ops,ins,sdf,depth,area:area*C*C,bbox:bounds(pts.length?pts:[[0,0],[W,H]])};
 if(maskCache.size>24)maskCache.delete(maskCache.keys().next().value);maskCache.set(key,m);return m;}
// The filled silhouette grid, for checks: 1 inside, 0 outside, on a C-unit grid.
export function maskInside(input){const s=resolve(input),m=maskField(s,layoutOf(s).mask);return {ins:m.ins,cell:C,width:GW,height:GH};}
const sample=(g,x,y)=>{const u=clamp(x/C-.5,0,GW-1.001),v=clamp(y/C-.5,0,GH-1.001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,k=j*GW+i;return (g[k]*(1-a)+g[k+1]*a)*(1-b)+(g[k+GW]*(1-a)+g[k+GW+1]*a)*b;};
const gradient=(g,x,y)=>{const gx=sample(g,x+C,y)-sample(g,x-C,y),gy=sample(g,x,y+C)-sample(g,x,y-C),l=Math.hypot(gx,gy)||1;return [gx/l,gy/l];};

// ── Layout boxes: where the silhouette sits, where marks may go, where type goes.
export function layoutOf(s){const L={
 poster:{mask:[56,56,W-56,H-206],field:[22,22,W-22,H-178]},
 bleed:{mask:[34,38,W-34,H-38],field:[8,8,W-8,H-8]},
 banner:{mask:[40,40,W-40,Math.round(H*.665)],field:[16,16,W-16,Math.round(H*.70)]},
 column:{mask:[30,44,W-170,H-44],field:[12,12,W-150,H-12]},
 stamp:{mask:[52,44,W-52,Math.round(H*.735)],field:[10,10,W-10,H-66]}}[s.layout];const keep=[];
 if(s.layout==='bleed'){const t=titleRun(s.title.replaceAll('/',' '),22),wInfo=Math.max(...s.info.split('/').map(l=>l.trim().length*5.6)),w=Math.max(t.width,wInfo)+28;keep.push([18,H-104,18+Math.min(W*.6,w),H-18]);}
 if(s.layout==='stamp')keep.push([W/2-86,H-322,W/2+86,H-92]);
 return {...L,keep};}

// ── The field: density and flow on a 4-unit grid; then marks.
const F=4,FW=Math.ceil(W/F)+1,FH=Math.ceil(H/F)+1;
// Edge softness is measured against the silhouette's own depth: a disc keeps its wide fade, but a
// word's thin strokes cannot be washed out by a fade wider than the strokes themselves.
const featherOf=(p,m)=>Math.max(C,Math.min(p.feather*140,m.depth*.45));
// An outside halo that is sparser than the inside thins with the silhouette's depth in marks, so thin
// silhouettes (words) stand clear of it; a silhouette sixteen marks deep or more (a disc) keeps the full halo.
const haloOf=(p,m)=>p.outside<p.inside?p.outside*clamp(m.depth/(p.size*16)):p.outside;
const fieldCache=new Map();
function fieldOf(s,m,L){const key=JSON.stringify([s.mask,s.text,s.face,s.layout,s.field,s.flow,['maskScale','maskShift','inside','outside','feather','amount','curve','scale','strength','angle','seed'].map(k=>s.params[k]),s.params.size]);if(fieldCache.has(key))return fieldCache.get(key);
 const f0=fieldOf0(s,m,L);if(fieldCache.size>12)fieldCache.delete(fieldCache.keys().next().value);fieldCache.set(key,f0);return f0;}
function fieldOf0(s,m,L){const p=s.params,[bx0,by0,bx1,by1]=m.bbox,cx=(bx0+bx1)/2,cy=(by0+by1)/2,R=Math.max(bx1-bx0,by1-by0),deep=Math.max(14,.2*Math.min(bx1-bx0,by1-by0)),fe=featherOf(p,m),out=haloOf(p,m),seed=p.seed*31+7;
 const [fx0,fy0,fx1,fy1]=L.field,dens=new Float32Array(FW*FH),flow=new Float32Array(FW*FH*2),ns=p.scale/300,inv=p.inside<p.outside;
 for(let j=0;j<FH;j++)for(let i=0;i<FW;i++){const x=i*F,y=j*F,k=j*FW+i,d=sample(m.sdf,x,y);let base=p.feather>0?out+(p.inside-out)*smooth(-fe,fe*.35,d):d>0?p.inside:out,f=1;
  switch(s.field){case 'core':f=clamp(d/deep);break;case 'edge':f=1-clamp(Math.abs(d)/deep);break;case 'radial':f=1-clamp(Math.hypot(x-cx,y-cy)/(R*.62));break;case 'vertical':f=1-clamp((y-by0)/(by1-by0||1));break;
   case 'noise':f=clamp((fbm(x*ns,y*ns,seed)-.2)/.6);break;case 'rings':f=.5+.5*Math.cos(TAU*Math.abs(d)/(p.size*3.2));break;}
  dens[k]=x<fx0||x>fx1||y<fy0||y>fy1?0:clamp(base*(1-p.amount+p.amount*f**p.curve));
  let a=null;switch(s.flow){case 'tangent':{const g=gradient(m.sdf,x,y);a=Math.atan2(g[0],-g[1]);break;}case 'normal':{const g=gradient(m.sdf,x,y);a=Math.atan2(g[1],g[0]);break;}case 'radial':a=Math.atan2(y-cy,x-cx);break;
   case 'swirl':a=Math.atan2(y-cy,x-cx)+Math.PI/2+.45;break;case 'curl':{const e=1.5,q=(u,v)=>fbm(u*ns,v*ns,seed+3);a=Math.atan2(-(q(x+e,y)-q(x-e,y)),q(x,y+e)-q(x,y-e));break;}}
  const b=p.angle*Math.PI/180;let vx=Math.cos(b),vy=Math.sin(b);if(a!==null){vx=vx*(1-p.strength)+Math.cos(a)*p.strength;vy=vy*(1-p.strength)+Math.sin(a)*p.strength;}flow[k*2]=vx;flow[k*2+1]=vy;}
 const at=(g,x,y)=>{const u=clamp(x/F,0,FW-1.001),v=clamp(y/F,0,FH-1.001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,k=j*FW+i;return (g[k]*(1-a)+g[k+1]*a)*(1-b)+(g[k+FW]*(1-a)+g[k+FW+1]*a)*b;};
 return {dens,flow,inv,deep,density:(x,y)=>at(dens,x,y),angle:(x,y)=>{const i=Math.round(clamp(x/F,0,FW-1)),j=Math.round(clamp(y/F,0,FH-1)),k=j*FW+i;return Math.atan2(flow[k*2+1],flow[k*2]);}};}

// A spatial hash of discs: each disc sits in every cell its box touches.
function discHash(cell){const gw=Math.ceil(W/cell)+2,gh=Math.ceil(H/cell)+2,cells=new Array(gw*gh),X=[],Y=[],R=[];
 const span=(x,y,r,f)=>{const i0=Math.max(0,Math.floor((x-r)/cell)+1),i1=Math.min(gw-1,Math.floor((x+r)/cell)+1),j0=Math.max(0,Math.floor((y-r)/cell)+1),j1=Math.min(gh-1,Math.floor((y+r)/cell)+1);for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(f(j*gw+i))return true;return false;};
 return {hit:(x,y,r)=>span(x,y,r,c=>{const l=cells[c];if(!l)return false;for(const k of l){const dx=X[k]-x,dy=Y[k]-y,rr=R[k]+r;if(dx*dx+dy*dy<rr*rr)return true;}return false;}),
  add:(x,y,r)=>{const k=X.length;X.push(x);Y.push(y);R.push(r);span(x,y,r,c=>{(cells[c]??=[]).push(k);return false;});},count:()=>X.length};}

// Discs that stand in for a mark of a given token, size and turn: a chain along its long axis.
function discs(t,x,y,s,a,pad){const w=t.w*s,h=t.h*s,long=w>=h,L=long?w:h,T=Math.max(long?h:w,s*.12),ax=long?a:a+Math.PI/2,k=Math.max(1,Math.round(L/T)),r=Math.max(T,L/k)/2*pad,out=[];
 for(let i=0;i<k;i++){const o=k===1?0:-(L-T)/2+(L-T)*i/(k-1);out.push([x+Math.cos(ax)*o,y+Math.sin(ax)*o,k===1?Math.max(L,T)/2*pad:r]);}return out;}

export function layout(input){const s=resolve(input),p=s.params,L=layoutOf(s),m=maskField(s,L.mask),fld=fieldOf(s,m,L),levels=levelsOf(s),N=levels.length;
 const rand=seeded(p.seed*977+hashText(s.family+s.set)),hash=discHash(Math.max(6,p.size*.9)),marks=[],pad=p.gap,[fx0,fy0,fx1,fy1]=L.field;
 const tok=spec=>token(spec,s.font),areas=levels.flat().map(sp=>tok(sp).area).sort((a,b)=>a-b),A0=areas[Math.floor(areas.length/2)];
 const inKeep=(x,y,r)=>L.keep.some(([a,b,c,d])=>x>a-r&&x<c+r&&y>b-r&&y<d+r);
 let counter=0,tries=0;
 // Choose the escalation level (and an alternative) for a mark at x, y of size sz.
 const choose=(x,y,d,rel)=>{let v;const sd=sample(m.sdf,x,y);switch(s.level){case 'density':v=d;break;case 'edge':v=clamp((fld.inv?-sd:sd)/Math.min(p.size*3,fld.deep*1.6));break;case 'size':v=rel;break;case 'random':v=rand();break;case 'cycle':v=((counter%N)+.5)/N;break;}
  if(s.level!=='cycle')v=v*(1-p.mix)+rand()*p.mix;const lv=clamp(Math.floor((v+p.bias)*N),0,N-1),alts=levels[lv],alt=s.level==='cycle'?Math.floor(counter/N)%alts.length:Math.floor(rand()*alts.length);return {lv,spec:alts[alt]};};
 // Heroes take the top two levels, as the large 森 and 林 in Yamashiro's Forest.
 const heroPick=()=>{const lv=Math.max(0,N-1-(rand()<.4?1:0)),alts=levels[lv];return {lv,spec:alts[Math.floor(rand()*alts.length)]};};
 const turn=(x,y)=>fld.angle(x,y)+(rand()-.5)*p.spin*Math.PI/180;
 const scaleFor=t=>p.balance?clamp((A0/t.area)**(p.balance/2),.55,1.8):1;
 const tryPlace=(x,y,opt)=>{tries++;if(x<fx0||x>fx1||y<fy0||y>fy1)return false;const d=opt.d??fld.density(x,y);if(d<.02)return false;
  const rel=clamp((d-.02)/.98),j=1+p.jitter*(rand()-.5)*1.3,sz=opt.size??Math.max(2.5,p.size*(1-p.sizeRange*(1-rel))*j);if(inKeep(x,y,sz*.5))return false;
  const spread=Math.min(5,1/Math.sqrt(Math.max(d,.04)));if(hash.hit(x,y,sz*.18*pad))return false;
  const lo=(1-p.sizeRange)*(1-.65*p.jitter),hi=1+.65*p.jitter,rel2=opt.size?1:hi-lo<.05?.5:clamp((sz/p.size-lo)/(hi-lo));
  const pick=opt.spec?{lv:opt.lv??N-1,spec:opt.spec}:opt.kind==='hero'?heroPick():choose(x,y,d,rel2),t=tok(pick.spec),k=sz*scaleFor(t),a=opt.angle??turn(x,y);
  const ds=discs(t,x,y,k,a,pad*(opt.kind==='odd'||opt.kind==='hero'?1.05:1));if(ds.some(([u,v,r])=>u<fx0-r*.3||u>fx1+r*.3||v<fy0-r*.3||v>fy1+r*.3||inKeep(u,v,r*.8)))return false;
  // Sparse ground keeps marks apart with one wider disc at the centre, so long marks thin out as much as round ones.
  if(spread>1.05)ds.push([x,y,Math.max(t.w,t.h)*k/2*pad*spread*.9]);
  for(const [u,v,r] of ds)if(hash.hit(u,v,r))return false;for(const [u,v,r] of ds)hash.add(u,v,r);
  marks.push({x,y,size:k,angle:a,lv:pick.lv,spec:pick.spec,kind:opt.kind??'fill',d,sdf:sample(m.sdf,x,y),odd:opt.kind==='odd',discs:ds});counter++;return true;};
 // 1. Odd ones out and heroes, largest first, deep in the dense side.
 const deepSpot=(r,minD)=>{for(let i=0;i<500;i++){const [bx0,by0,bx1,by1]=s.mask==='page'||fld.inv?L.field:m.bbox,x=bx0+rand()*(bx1-bx0),y=by0+rand()*(by1-by0),sd=sample(m.sdf,x,y);if((fld.inv?-sd:sd)>=r*.55&&fld.density(x,y)>=minD)return [x,y];}return null;};
 const oddSpec={same:levels[N-1][0],swap:FAMILIES.find(f=>f.id===s.family).oddToken,sun:'@sun',heart:'@heart',ring:levels[N-1][0]}[s.odd];
 for(let i=0;i<p.odd;i++)for(let k=0;k<60;k++){const sz=p.size*p.oddScale,at=deepSpot(sz/2,.3);if(at&&tryPlace(at[0],at[1],{size:sz,spec:oddSpec,lv:N-1,kind:'odd'}))break;}
 for(let i=0;i<p.heroes;i++){const sz=p.size*p.heroScale*(1-.55*i/Math.max(1,p.heroes-1));for(let k=0;k<60;k++){const at=deepSpot(sz/2,.25);if(at&&tryPlace(at[0],at[1],{size:sz,kind:'hero'}))break;}}
 // 2. Edge rows: candidates on iso-distance lines just inside the dense side, so the outline reads crisply.
 for(let r=0;r<p.contour;r++){const level=(fld.inv?-1:1)*(r+.55)*p.size*.9*pad,cand=[];
  const e0=Math.abs(level)+8,i0=Math.max(1,Math.floor((m.bbox[0]-e0)/C)),i1=Math.min(GW-2,Math.ceil((m.bbox[2]+e0)/C)),j0=Math.max(1,Math.floor((m.bbox[1]-e0)/C)),j1=Math.min(GH-2,Math.ceil((m.bbox[3]+e0)/C));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const k=j*GW+i;if(Math.abs(m.sdf[k]-level)<C*.75)cand.push(k);}
  for(let i=cand.length-1;i>0;i--){const q=Math.floor(rand()*(i+1)),t=cand[i];cand[i]=cand[q];cand[q]=t;}
  for(const k of cand){let x=(k%GW+.5)*C,y=(Math.floor(k/GW)+.5)*C;const g=gradient(m.sdf,x,y),e=sample(m.sdf,x,y)-level;x-=g[0]*e;y-=g[1]*e;tryPlace(x,y,{kind:'edge'});}}
 // 3. Fill: random sequential adsorption over a shuffled jittered grid.
 const pitch=clamp(p.size*.4,2.5,12),[ax0,ay0,ax1,ay1]=p.outside>0||p.feather>0||s.mask==='page'?L.field:[Math.max(fx0,m.bbox[0]-4),Math.max(fy0,m.bbox[1]-4),Math.min(fx1,m.bbox[2]+4),Math.min(fy1,m.bbox[3]+4)];
 const cols=Math.max(1,Math.ceil((ax1-ax0)/pitch)),rows=Math.max(1,Math.ceil((ay1-ay0)/pitch)),order=new Uint32Array(cols*rows);for(let i=0;i<order.length;i++)order[i]=i;
 for(let i=order.length-1;i>0;i--){const q=Math.floor(rand()*(i+1)),t=order[i];order[i]=order[q];order[q]=t;}
 for(const c of order){const x=ax0+(c%cols+rand())*pitch,y=ay0+(Math.floor(c/cols)+rand())*pitch;tryPlace(x,y,{});}
 return {state:s,L,mask:m,field:fld,marks,levels,tries};}

// ── Drawing
const FONT_STACK="'Hiragino Sans','Hiragino Kaku Gothic ProN','Helvetica Neue',Helvetica,Arial,sans-serif";
// Display type from the bundled gothic outlines, so titles match in every renderer; null if a character is missing.
function titleRun(str,size){const segs=[];let x=0;for(const ch of str){if(ch===' '){x+=280;continue;}const g=glyph('gothic',ch);if(!g)return {d:null,width:str.length*size*.6};segs.push(...mapSegs(g.segs,(a,b)=>[a+x,b]));x+=g.adv+20;}
 const k=size/1000;return {segs,width:Math.max(0,x-20)*k,k};}
function titleSVG(str,size,x,y,fill,anchor='start',maxW=Infinity){let r=titleRun(str,size);if(r.width>maxW){size*=maxW/r.width;r=titleRun(str,size);}const ox=anchor==='middle'?x-r.width/2:anchor==='end'?x-r.width:x;
 if(!r.segs)return {svg:`<text x="${n(x)}" y="${n(y)}" font-family="${FONT_STACK}" font-weight="700" font-size="${n(size)}" text-anchor="${anchor}" fill="${fill}">${str}</text>`,width:r.width,size};
 return {svg:`<path d="${segString(mapSegs(r.segs,(a,b)=>[ox+a*r.k,y+b*r.k]))}" fill="${fill}"/>`,width:r.width,size};}
const infoSVG=(lines,x,y,size,fill,anchor='start',lh=1.38)=>lines.map((l,i)=>`<text x="${n(x)}" y="${n(y+i*size*lh)}" font-family="${FONT_STACK}" font-size="${size}" letter-spacing=".2" text-anchor="${anchor}" fill="${fill}">${l}</text>`).join('');
function typeSVG(s,ink,ground){const L=layoutOf(s),title=s.title.split('/').map(t=>t.trim()).filter(Boolean),info=s.info.split('/').map(t=>t.trim()).filter(Boolean).slice(0,3);let out='';
 if(s.layout==='poster'){const size=title.length>1?40:52;out+=`<path d="M56 ${H-160}H${W-56}" stroke="${ink}" stroke-width="1"/>`;title.forEach((t,i)=>out+=titleSVG(t,size,56,H-114+i*size*1.02-(title.length-1)*size*.5,ink,'start',W-112).svg);out+=infoSVG(info,56,H-52,12.5,ink);}
 else if(s.layout==='bleed'){const [x0,y0,x1,y1]=L.keep[0];out+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${ground}"/>`+titleSVG(title.join(' '),22,x0+14,y0+38,ink,'start',x1-x0-28).svg+infoSVG(info.slice(0,2),x0+14,y0+60,10,ink,'start',1.45);}
 else if(s.layout==='banner'){const lines=title.length?title:[''],size=Math.min(150,(H*.255-34)/lines.length/.9);let y=H*.72+size*.86;for(const t of lines){const r=titleSVG(t,size,W/2,y,ink,'middle',W-80);out+=r.svg;y+=r.size*.98;}out+=infoSVG(info,W/2,H-26-(info.length-1)*16,12,ink,'middle');}
 else if(s.layout==='column'){const size=Math.min(110,(H-88)/Math.max(1,title.join(' ').length*.62));out+=`<g transform="translate(${W-112} 44) rotate(90)">${titleSVG(title.join(' '),size,0,0,ink,'start',H-88).svg}</g><g transform="translate(${W-124} 44) rotate(90)">${infoSVG(info.slice(0,2),0,0,11,ink,'start',1.5)}</g>`;}
 else if(s.layout==='stamp'){const [x0,y0,x1,y1]=L.keep[0],lines=title.length?title:[''],size=Math.min(64,(y1-y0-40)/lines.length);out+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${ink}"/>`;
  lines.forEach((t,i)=>out+=titleSVG(t,size,(x0+x1)/2,y0+(y1-y0-lines.length*size)/2+size*(i+.86),ground,'middle',x1-x0-28).svg);const line=info.join('  ').replace(/\s+/g,' ').split('');
  out+=line.map((c,i)=>`<text x="${n(40+(W-80)*i/Math.max(1,line.length-1))}" y="${H-30}" font-family="${FONT_STACK}" font-size="12" text-anchor="middle" fill="${ink}">${c}</text>`).join('');}
 return out;}

function marchingSegments(field,levels){const segs=[];const v=(i,j)=>field[j*FW+i];
 for(const t of levels)for(let j=0;j<FH-1;j++)for(let i=0;i<FW-1;i++){const a=v(i,j),b=v(i+1,j),c=v(i+1,j+1),d=v(i,j+1),idx=(a>t)|(b>t)<<1|(c>t)<<2|(d>t)<<3;if(idx===0||idx===15)continue;
  const e=[[i+(t-a)/(b-a),j],[i+1,j+(t-b)/(c-b)],[i+(t-d)/(c-d),j+1],[i,j+(t-a)/(d-a)]],P=k=>[e[k][0]*F,e[k][1]*F],pairs={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[0,3]]}[idx];
  for(const [p,q] of pairs)segs.push([P(p),P(q)]);}
 return segs;}
const outlinePath=m=>m.ops.map(([,groups])=>groups.map(g=>polyString(g)).join('')).join('');

function colourOf(s,mk,rand,N){const [ground,a,b,c,accent]=s.colors;if(mk.odd)return accent;let col;
 switch(s.colorMode){case 'single':col=a;break;case 'random':col=[a,b,c][Math.floor(rand()*3)];break;case 'field':col=mk.d<.5?mix(a,b,clamp(mk.d*2)):mix(b,c,clamp(mk.d*2-1));break;default:col=N===1?a:[a,b,c][Math.round(mk.lv/(N-1)*2)];}
 // A soft edge fades tone as well as density, so a feathered silhouette dissolves into the ground.
 return s.params.feather>0&&mk.d<1?mix(ground,col,1-(1-mk.d)*s.params.feather*.8):col;}

export function render(input={}){const state=resolve(input),lay=layout(state),{marks,mask,field}=lay,s=state,p=s.params,[ground,ink1,,,accent,line]=s.colors,ink=line,stage=s.stage,uid=hashText(JSON.stringify(s)).toString(36);
 const defs=[],ids=new Map(),use=spec=>{if(!ids.has(spec)){const t=token(spec,s.font);ids.set(spec,'t'+ids.size);defs.push(`<path id="${uid}-t${ids.size-1}" d="${t.d}"${t.kind==='line'?' fill="none" stroke-linecap="round" stroke-linejoin="round"':''}/>`);}return uid+'-'+ids.get(spec);};
 const parts=[`<rect width="${W}" height="${H}" fill="${ground}"/>`],rand=seeded(p.seed*131+3),feat={marks:marks.length,levels:lay.levels.map(()=>0),heroes:0,odd:0,edge:0,inside:0,outside:0,composed:[]};
 for(const mk of marks){feat.levels[mk.lv]++;if(mk.kind==='hero')feat.heroes++;if(mk.odd)feat.odd++;if(mk.kind==='edge')feat.edge++;if(mk.sdf>0)feat.inside++;else feat.outside++;if(token(mk.spec,s.font).composed&&!feat.composed.includes(mk.spec))feat.composed.push(mk.spec);}
 const outline=outlinePath(mask);
 if(stage===1){const lv=[.12,.3,.5,.7,.88],seg=marchingSegments(field.dens,lv),step=26;let ticks='';
  for(let y=lay.L.field[1]+step/2;y<lay.L.field[3];y+=step)for(let x=lay.L.field[0]+step/2;x<lay.L.field[2];x+=step){const a=field.angle(x,y),d=field.density(x,y),l=4+7*d;ticks+=`M${n(x-Math.cos(a)*l)} ${n(y-Math.sin(a)*l)}L${n(x+Math.cos(a)*l)} ${n(y+Math.sin(a)*l)}`;}
  parts.push(`<path d="${outline}" fill="${ink1}" fill-opacity=".12" fill-rule="nonzero"/><path d="${seg.map(([a,b])=>`M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`).join('')}" stroke="${line}" stroke-opacity=".55" stroke-width=".7" fill="none"/><path d="${ticks}" stroke="${accent===ground?line:accent}" stroke-width="1.3" stroke-linecap="round" fill="none"/><path d="${outline}" fill="none" stroke="${line}" stroke-width="1.4"/>`);}
 else if(stage===2){const cols=lay.levels.map((_,i)=>colourOf({...s,colorMode:'level',params:{...p,feather:0}},{lv:i,d:1},rand,lay.levels.length)),by=new Map();
  for(const mk of marks){const t=token(mk.spec,s.font),c=mk.odd?accent:cols[mk.lv];let d=by.get(c)??'';for(const [x,y,r] of discs(t,mk.x,mk.y,mk.size,mk.angle,1))d+=`M${n(x+r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(-2*r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(2*r)} 0`;by.set(c,d);}
  parts.push(`<path d="${outline}" fill="none" stroke="${line}" stroke-opacity=".35" stroke-width="1" stroke-dasharray="3 3"/>`);for(const [c,d] of by)parts.push(`<path d="${d}" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width=".8"/>`);
  parts.push(`<path d="${marks.map(mk=>`M${n(mk.x)} ${n(mk.y)}h0`).join('')}" stroke="${line}" stroke-width="2.2" stroke-linecap="round"/>`);}
 else{const glow=stage===4?p.glow:0,mode=stage===4?s.render:'fill',groups=new Map(),wF=p.weight*4,wL=7+p.weight*7,tube=mode==='outline';
  for(const mk of marks){const t=token(mk.spec,s.font),c=stage===3?line:colourOf(s,mk,rand,lay.levels.length),ref=use(mk.spec),tf=`translate(${n(mk.x)} ${n(mk.y)}) rotate(${n(mk.angle*180/Math.PI)}) scale(${(mk.size/100).toFixed(4)})`;
   const key=c+'|'+t.kind;let g=groups.get(key);if(!g){g={c,kind:t.kind,items:[]};groups.set(key,g);}g.items.push(`<use href="#${ref}" transform="${tf}"/>`);
   if(mk.odd&&s.odd==='ring'&&stage===4)parts.push(`<circle cx="${n(mk.x)}" cy="${n(mk.y)}" r="${n(mk.size*.72)}" fill="none" stroke="${accent}" stroke-width="${n(Math.max(1.5,mk.size*.06))}"/>`);}
  const attrs=(g,c)=>g.kind==='line'?(tube?`stroke="${c}" stroke-width="${n(wL+9)}"`:`stroke="${c}" stroke-width="${n(wL)}"`):tube?`fill="none" stroke="${c}" stroke-width="${n(3+p.weight*4)}" stroke-linejoin="round"`:`fill="${c}"${wF>0?` stroke="${c}" stroke-width="${n(wF)}" stroke-linejoin="round"`:''}`;
  let body='';
  if(mode==='shadow'){const sh=mix(ground,'#000000',.45);for(const g of groups.values())body+=`<g ${attrs(g,sh)} opacity=".45" transform="translate(${n(p.size*.12)} ${n(p.size*.16)})">${g.items.join('')}</g>`;}
  for(const g of groups.values()){body+=`<g ${attrs(g,g.c)}>${g.items.join('')}</g>`;if(tube&&g.kind==='line')body+=`<g stroke="${ground}" stroke-width="${n(Math.max(2,wL+9-2*(2.6+p.weight*2.2)))}">${g.items.join('')}</g>`;}
  if(glow>0){const sd=mode==='glow'?1.4+glow*5:.4+glow*1.6;defs.push(`<filter id="${uid}-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceGraphic" stdDeviation="${n(sd)}" result="b"/><feComponentTransfer in="b" result="c"><feFuncA type="linear" slope="${n(mode==='glow'?.55+glow*.85:.55+glow*.6)}"/></feComponentTransfer><feMerge><feMergeNode in="c"/>${mode==='glow'?'<feMergeNode in="c"/>':''}<feMergeNode in="SourceGraphic"/></feMerge></filter>`);body=`<g filter="url(#${uid}-glow)">${body}</g>`;}
  if(stage===3)parts.push(`<path d="${outline}" fill="none" stroke="${line}" stroke-opacity=".3" stroke-width="1" stroke-dasharray="3 3"/>`);parts.push(body);
  if(stage===4)parts.push(typeSVG(s,ink,ground));}
 const label={1:'silhouette and density field',2:'blue-noise samples',3:'escalated marks',4:'poster'}[stage],esc=t=>t.replace(/[<>&]/g,'');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(s.text.replaceAll('/',' / '))} — compound-glyph silhouette, ${s.family}, ${label}</title>${defs.length?`<defs>${defs.join('')}</defs>`:''}${parts.join('')}</svg>`;
 return {svg,state,width:W,height:H,features:{...feat,tokens:ids.size,tries:lay.tries,stage,maskArea:Math.round(mask.area),insideShare:+(feat.inside/Math.max(1,marks.length)).toFixed(3)}};}

// Every escalation set in the family's font, colours and finish, plus every silhouette.
export function specimen(input={}){const state=resolve({...input,stage:4}),[ground,a,b,c,accent,line]=state.colors,sets=SETS,cell=92,left=300,w=left+9*cell+40,rowH=112,maskH=170,h=60+sets.length*rowH+maskH+40,parts=[`<rect width="${w}" height="${h}" fill="${ground}"/>`];
 const defs=[],ids=new Map(),uid='sp'+hashText(JSON.stringify(state)).toString(36),tube=state.render==='outline',use=t=>{const key=t.d;if(!ids.has(key)){ids.set(key,ids.size);defs.push(`<path id="${uid}-${ids.size-1}" d="${t.d}"${t.kind==='line'?' fill="none" stroke-linecap="round" stroke-linejoin="round"':''}/>`);}return uid+'-'+ids.get(key);};
 const draw=(t,x,y,size,col)=>{const ref=use(t),tf=`translate(${n(x)} ${n(y)}) scale(${(size/100).toFixed(4)})`,wL=7+state.params.weight*7;
  if(t.kind==='line')return `<use href="#${ref}" transform="${tf}" stroke="${col}" stroke-width="${n(tube?wL+9:wL)}"/>`+(tube?`<use href="#${ref}" transform="${tf}" stroke="${ground}" stroke-width="${n(Math.max(2,wL+9-2*(2.6+state.params.weight*2.2)))}"/>`:'');
  return tube?`<use href="#${ref}" transform="${tf}" fill="none" stroke="${col}" stroke-width="${n(3+state.params.weight*4)}"/>`:`<use href="#${ref}" transform="${tf}" fill="${col}"/>`;};
 parts.push(`<text x="30" y="40" font-family="${FONT_STACK}" font-size="20" font-weight="700" fill="${line}">${FAMILIES.find(f=>f.id===state.family).name} — escalation sets in ${state.font}, word “${state.text.replace(/[<>&]/g,'')}”</text>`);
 sets.forEach((set,r)=>{const y=60+r*rowH+rowH/2,lv=levelsOf({...state,set:set.id});parts.push(`<text x="30" y="${y+6}" font-family="${FONT_STACK}" font-size="17" fill="${line}" data-set="${set.id}">${set.name.replace(/[<>&]/g,'')}</text>`);let x=left+cell/2;
  lv.forEach((alts,i)=>{const col=[a,b,c][Math.round(i/Math.max(1,lv.length-1)*2)];alts.slice(0,i===lv.length-1?4:3).forEach(spec=>{if(x>w-cell/2)return;const t=token(spec,state.font);parts.push(draw(t,x,y,Math.min(cell*.82,cell*.86/Math.max(t.w,t.h)),col));x+=cell;});
   if(i<lv.length-1&&x<w-cell/2){const ax=x-cell/2+6;parts.push(`<path d="M${ax} ${y}h${cell*.3}m-6 -5l6 5l-6 5" stroke="${line}" stroke-opacity=".5" fill="none" stroke-width="1.4"/>`);x+=cell*.45;}});});
 const y0=60+sets.length*rowH+20,mw=(w-60)/MASKS.length;MASKS.forEach((mk,i)=>{const box=[30+i*mw+8,y0+8,30+(i+1)*mw-8,y0+maskH-38],ops=maskOps({...state,mask:mk.id,params:{...state.params,maskScale:1,maskShift:0}},box);
  parts.push(`<path d="${ops.filter(o=>o[0]==='add').map(o=>o[1].map(g=>polyString(g)).join('')).join('')}" fill="${a}"/>${ops.filter(o=>o[0]==='sub').map(o=>`<path d="${o[1].map(g=>polyString(g)).join('')}" fill="${ground}"/>`).join('')}<text x="${n(30+(i+.5)*mw)}" y="${y0+maskH-12}" font-family="${FONT_STACK}" font-size="13" text-anchor="middle" fill="${line}" data-mask="${mk.id}">${mk.name}</text>`);});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs>${parts.join('')}</svg>`;}
