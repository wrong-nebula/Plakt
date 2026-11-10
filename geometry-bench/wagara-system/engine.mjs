/* Wagara window letters — type system study after Ikko Tanaka's Poster Nippon
 * (1972) and the pattern posters of Tadanori Yokoo, Yusaku Kamekura and Norito
 * Shinmura. Heavy letters are windows: each is a clip path through which one
 * pattern of the wagara kit shows, in its own two inks. The same kit fills
 * bands, frames, fields, seas and emblems around the letters. Any text, five
 * letter sources, eighteen patterns, eight layouts. New interpretations, not
 * traced.
 */
import {PATTERNS,PATTERN_IDS,PATTERN,patternSVG,patternPeriod,patternP,n,circle,poly} from './patterns.mjs';
import {LETTER_SOURCES,GLYPHS,CHARACTERS,glyphShape,layoutText,offsetPx,extrudePx,polysD,bboxOf} from './letters.mjs';
export {PATTERNS,PATTERN_IDS,LETTER_SOURCES,CHARACTERS,GLYPHS,patternSVG,patternPeriod,glyphShape,n};
export const ENGINE='wagara-window-v1';
export const W=728,H=1030;  // B-series proportion
export const SOURCES=[
 {id:'moma-6066',family:'tanaka',designer:'Ikko Tanaka',title:'Poster Nippon 1955–72',date:'1972'},
 {id:'moma-6130',family:'takeo',designer:'Tadanori Yokoo',title:'Takeo',date:'1997'},
 {id:'moma-8720',family:'bunraku',designer:'Tadanori Yokoo',title:'National Bunraku Theatre',date:'1971'},
 {id:'moma-7942',family:'hinode',designer:'Tadanori Yokoo',title:'16th Exhibition of Japan Advertising Artists Club',date:'c. 1956–66'},
 {id:'moma-7787',family:'kamekura',designer:'Yusaku Kamekura',title:'Classical Performing Arts Friendship Mission of Japan',date:'1981'},
 {id:'pgda-19883',family:'muji',designer:'Norito Shinmura',title:'MUJI New Year Red Sea Bream',date:'2014'}
];
export const LAYOUTS=[
 {id:'nippon',name:'Nippon row',note:'Letters across the middle on a dark ground, a boxed outline title, a small text block (Tanaka).'},
 {id:'stack',name:'Justified stack',note:'Every row stretched to the full width and stacked — the phone-first poster.'},
 {id:'bands',name:'Crest bands',note:'Panels separated by strips of crests; each text row in its own panel (Kamekura).'},
 {id:'field',name:'Pattern field',note:'The whole sheet a repeated tile crossed by stripes; letters on top with a block shadow (Yokoo, 1960s).'},
 {id:'horizon',name:'Sea horizon',note:'A dark-to-bright sky with suns over a patterned sea of rolling crests (Yokoo, Bunraku).'},
 {id:'columns',name:'Bamboo bars',note:'A sky disc behind, vertical bars in front of the letters (Yokoo, Takeo).'},
 {id:'frame',name:'Tenugui frame',note:'A patterned border around a plain field, like a printed hand towel.'},
 {id:'emblem',name:'Scale emblem',note:'One large patterned emblem above the letters (Shinmura, sea bream).'}
];
const base={weight:.04,width:1,gutter:.1,leading:.14,scale:44,rotate:0,stroke:1,detail:2,rotateStep:0,keyline:2.5,depth:10,angle:45,groundScale:40,bands:3};
// Colour roles: ground, text, keyline, shadow, accent, band, band ink. Windows: six [paper, ink] pairs.
export const ROLES=['Ground','Text','Keyline','Shadow','Accent','Band','Band ink'];
export const FAMILIES=[
 {id:'tanaka',name:'Nippon windows',after:'Ikko Tanaka, Poster Nippon, 1972',palette:'Black / six saturated window pairs',text:'NIP/PON',title:'WAGARA',info:'Wagara window letters / after Ikko Tanaka, Poster Nippon 1972 / any text, one pattern per letter',
  set:{letters:'block',layout:'nippon',assign:'sequence',anchor:'letter',inking:'cycle',edge:'none',shadow:'none',pattern:'seigaiha',groundPattern:'none',sequence:['seigaiha','take','hinode','tatewaku','kikko','ume'],face:'sans',params:{...base,weight:.1,width:1.02,gutter:.05,leading:.1,scale:62,stroke:1.2,detail:3}},
  colors:['#141414','#f3f0e8','#f3f0e8','#000000','#e8402c','#262626','#363636'],windows:[['#f2b632','#2b2a78'],['#f5f2ea','#1f9653'],['#e4412d','#2c6cb6'],['#21a05c','#e8d63b'],['#3b2f8c','#6cb04a'],['#a85aa6','#e8432c']],
  note:'Heavy block letters packed edge to edge, each a window into its own motif and inks: waves, bamboo, sunrise, steam, shell, plum.'},
 {id:'takeo',name:'Bamboo bars',after:'Tadanori Yokoo, Takeo, 1997',palette:'Brick / bamboo greens / sky blue / vermilion',text:'TAKE/O',title:'WAGARA WINDOW LETTERS',info:'after Tadanori Yokoo, Takeo 1997 / letters grown from bamboo / any text',
  set:{letters:'round',layout:'columns',assign:'single',anchor:'letter',inking:'cycle',edge:'keyline',shadow:'drop',pattern:'take',groundPattern:'ume',sequence:['take','tatewaku','asanoha','nami','yagasuri','kikko'],face:'sans',params:{...base,weight:.06,gutter:.2,leading:.3,scale:40,stroke:1.5,detail:3,keyline:3,depth:8,angle:35,groundScale:46,bands:3}},
  colors:['#9c3a2a','#f6efe0','#1d4f27','#e2492d','#5cc3e6','#3e9a4c','#1d4f27'],windows:[['#d8edbe','#2e8b40'],['#c3e5a8','#25733a'],['#e1f2cf','#3a9a48'],['#cfe9b6','#1f6a33'],['#d6edbd','#2b8040'],['#c8e7b0','#30914a']],
  note:'Rounded cell letters filled with bamboo culms and leaves; a sky disc of plum blossom behind, bamboo and vermilion bars in front.'},
 {id:'bunraku',name:'Wave horizon',after:'Tadanori Yokoo, National Bunraku Theatre, 1971',palette:'Black / hot pink / cobalt / gold',text:'BUN/RAKU',title:'WAGARA WINDOW LETTERS',info:'after Tadanori Yokoo, Bunraku 1971 / windows into one sea / any text',
  set:{letters:'archivo',layout:'horizon',assign:'sequence',anchor:'field',inking:'cycle',edge:'keyline',shadow:'none',pattern:'seigaiha',groundPattern:'seigaiha',sequence:['seigaiha','nami','gyorin','tatewaku','kikko','uroko'],face:'sans',params:{...base,weight:.012,width:.96,gutter:.07,leading:.12,scale:42,stroke:1.2,detail:3,keyline:2,groundScale:66,bands:3}},
  colors:['#0b0b10','#f4f1ea','#c9a24a','#000000','#ff2f8e','#2f63c8','#c9a24a'],windows:[['#2f63c8','#ff3b6b'],['#2a59b9','#c9a24a'],['#ff2f8e','#2f63c8'],['#2f63c8','#c9a24a'],['#24519f','#ff3b6b'],['#ff2f8e','#14143c']],
  note:'A black sky burning to pink over a cobalt sea of seigaiha in gold; the letters are windows into the same sea, anchored as one field.'},
 {id:'hinode',name:'Sunrise field',after:'Tadanori Yokoo, 16th JAAC exhibition, c. 1956–66',palette:'Chrome yellow / red / green / navy',text:'SUN/RISE',title:'WAGARA WINDOW LETTERS',info:'after Tadanori Yokoo, 16th JAAC / a field of rising suns / any text',
  set:{letters:'anton',layout:'field',assign:'sequence',anchor:'letter',inking:'cycle',edge:'keyline',shadow:'block',pattern:'sayagata',groundPattern:'hinode',sequence:['sayagata','ichimatsu','asanoha','uroko','kikko','shippo'],face:'sans',params:{...base,weight:.02,width:1.08,gutter:.08,leading:.1,scale:34,detail:2,keyline:3,depth:12,angle:40,groundScale:58,bands:3}},
  colors:['#f2b13c','#1d2a6b','#1d2a6b','#1d2a6b','#e2382a','#f2b13c','#1f7a46'],windows:[['#f6e7c2','#e2382a'],['#e2382a','#f6e7c2'],['#2a4fa8','#f2b13c'],['#1f7a46','#f6e7c2'],['#f6e7c2','#2a4fa8'],['#e2382a','#f2b13c']],
  note:'Rows of a sun-over-waves tile cover the sheet, crossed by red stripes; condensed letters on top carry geometric wagara and a navy block shadow.'},
 {id:'kamekura',name:'Gold crest bands',after:'Yusaku Kamekura, Classical Performing Arts Friendship Mission, 1981',palette:'Black / gold / pink / cream',text:'NOH/KABUKI',title:'Wagara Window Letters',info:'after Yusaku Kamekura, 1981 / gold panels, bands of crests / any text',
  set:{letters:'archivo',layout:'bands',assign:'sequence',anchor:'field',inking:'two-ink',edge:'keyline',shadow:'none',pattern:'asanoha',groundPattern:'sakura',sequence:['asanoha','kikko','shippo','sayagata','tatewaku','kanoko'],face:'serif',params:{...base,weight:.01,width:1.04,gutter:.07,scale:48,stroke:.85,detail:2,keyline:2.2,groundScale:44,bands:3}},
  colors:['#0d0c0b','#ece1c9','#0d0c0b','#000000','#e46aa5','#a98a5c','#5fbf4a'],windows:[['#0d0c0b','#caa66c'],['#12100e','#d8b77c'],['#0d0c0b','#b99460'],['#16130f','#e0c48e'],['#0d0c0b','#caa66c'],['#12100e','#d8b77c']],
  note:'Black letters drawn in fine gold lattice and keylined in black on gold panels, between black strips of pink, cream and gold cherry crests.'},
 {id:'muji',name:'Sea bream scales',after:'Norito Shinmura, MUJI New Year, 2014',palette:'Cream / vermilion / gold',text:'NEW/YEAR',title:'WAGARA WINDOW LETTERS',info:'after Norito Shinmura, MUJI 2014 / scales for luck / any text',
  set:{letters:'archivo',layout:'emblem',assign:'single',anchor:'field',inking:'two-ink',edge:'none',shadow:'none',pattern:'gyorin',groundPattern:'gyorin',sequence:['gyorin','seigaiha','uroko','kikko','nami','shippo'],face:'sans',params:{...base,weight:.01,width:1,gutter:.06,leading:.12,scale:30,stroke:1,detail:1,groundScale:40,bands:3}},
  colors:['#ebe2cc','#1a1a1a','#1a1a1a','#c9a35a','#c9a35a','#d6262b','#d2ac62'],windows:[['#d6262b','#d2ac62'],['#c9a35a','#d6262b'],['#d6262b','#ebe2cc'],['#b81f25','#d2ac62'],['#d6262b','#d2ac62'],['#c9a35a','#d6262b']],
  note:'Vermilion letters scaled in gold like the fish above them: one pattern, two inks, on cream.'},
 {id:'neon',name:'Neon wagara',after:'new — electro',palette:'Night / cyan / magenta / acid',text:'NEO/EDO',title:'WAGARA WINDOW LETTERS',info:'new / neon wagara on near-black / any text',
  set:{letters:'rubik',layout:'stack',assign:'sequence',anchor:'letter',inking:'cycle',edge:'keyline',shadow:'glow',pattern:'asanoha',groundPattern:'asanoha',sequence:['asanoha','seigaiha','sayagata','kikko','shippo','tatewaku'],face:'sans',params:{...base,weight:.005,width:.94,gutter:.06,leading:.1,scale:38,stroke:1.1,detail:1,keyline:2.5,depth:12,groundScale:34}},
  colors:['#06050a','#f2f0ff','#ff2bd6','#ff2bd6','#c6ff3d','#06050a','#1c1638'],windows:[['#0d0b18','#19f0ff'],['#130a18','#ff2bd6'],['#0a1210','#c6ff3d'],['#100c1e','#9a7cff'],['#160d0a','#ff8a1f'],['#0b0f1c','#4dffb8']],
  note:'Near-black windows with glowing line patterns — hemp leaf, waves, key fret, shell — magenta keylines and a dim hemp-leaf ground.'},
 {id:'aizome',name:'Indigo cotton',after:'new — tenugui',palette:'Cotton / indigo / madder',text:'AI/ZOME',title:'WAGARA WINDOW LETTERS',info:'new / indigo-dyed cotton, white resist lines / any text',
  set:{letters:'round',layout:'frame',assign:'sequence',anchor:'letter',inking:'two-ink',edge:'rim',shadow:'none',pattern:'asanoha',groundPattern:'seigaiha',sequence:['asanoha','shippo','kanoko','yagasuri','kikko','sayagata'],face:'sans',params:{...base,weight:.08,width:1.04,gutter:.08,leading:.1,scale:36,stroke:1,detail:2,keyline:5,groundScale:32,bands:2}},
  colors:['#eee7d6','#1c2a5e','#1c2a5e','#9fb0d6','#c8452d','#1c2a5e','#eee7d6'],windows:[['#1f2d66','#f1ece0'],['#2a3c7e','#f1ece0'],['#16234f','#e8e2d2'],['#22346f','#f1ece0'],['#1f2d66','#e8e2d2'],['#2a3c7e','#f1ece0']],
  note:'Two inks only: white resist patterns on indigo, an indigo rim around each letter, a seigaiha border like a printed hand towel.'},
 {id:'kabuki',name:'Kabuki checks',after:'new — two-ink',palette:'Paper / sumi / vermilion',text:'KA/BU/KI',title:'WAGARA WINDOW LETTERS',info:'new / two inks swapped letter by letter / any text',
  set:{letters:'anton',layout:'stack',assign:'sequence',anchor:'letter',inking:'swap',edge:'double',shadow:'block',pattern:'ichimatsu',groundPattern:'none',sequence:['ichimatsu','uroko','yagasuri','sayagata','kanoko','asanoha'],face:'sans',params:{...base,weight:.012,width:1.45,gutter:.1,leading:.06,scale:42,detail:1,keyline:2.5,depth:14,angle:30,groundScale:30}},
  colors:['#f1ece1','#141414','#141414','#e3402f','#e3402f','#141414','#e3d9c6'],windows:[['#141414','#f1ece1'],['#e3402f','#f1ece1'],['#f1ece1','#141414'],['#141414','#e3402f'],['#f1ece1','#e3402f'],['#e3402f','#141414']],
  note:'Black and paper swap from letter to letter — checks, scales, arrow feathers, key fret — with double keylines and a vermilion block shadow.'}
];
export const CONTROLS=[
 {key:'weight',label:'Letter weight',group:'letters',min:-.03,max:.16,step:.005,value:.04},
 {key:'width',label:'Width (condense ↔ extend)',group:'letters',min:.6,max:1.5,step:.01,value:1},
 {key:'gutter',label:'Gutter between letters',group:'letters',min:0,max:.6,step:.01,value:.1},
 {key:'leading',label:'Row gap',group:'letters',min:0,max:.6,step:.01,value:.14},
 {key:'scale',label:'Pattern scale',group:'pattern',min:10,max:160,step:1,value:44},
 {key:'rotate',label:'Pattern rotation',group:'pattern',min:-90,max:90,step:1,value:0},
 {key:'stroke',label:'Line weight',group:'pattern',min:.3,max:3,step:.05,value:1},
 {key:'detail',label:'Detail',group:'pattern',min:1,max:6,step:1,value:2},
 {key:'rotateStep',label:'Turn per letter',group:'pattern',min:-45,max:45,step:1,value:0},
 {key:'keyline',label:'Keyline / rim width',group:'edge',min:.5,max:10,step:.25,value:2.5},
 {key:'depth',label:'Shadow depth',group:'edge',min:2,max:40,step:.5,value:10},
 {key:'angle',label:'Shadow angle',group:'edge',min:0,max:359,step:1,value:45},
 {key:'groundScale',label:'Ground pattern scale',group:'ground',min:12,max:120,step:1,value:40},
 {key:'bands',label:'Bands / stripes / bars / frame',group:'ground',min:1,max:6,step:1,value:3}
];
export const OPTIONS={letters:LETTER_SOURCES.map(s=>s.id),layout:LAYOUTS.map(l=>l.id),assign:['sequence','single','shuffle'],anchor:['letter','field'],inking:['cycle','two-ink','swap'],edge:['none','keyline','rim','double'],shadow:['none','drop','block','glow'],pattern:PATTERN_IDS,groundPattern:['none',...PATTERN_IDS]};
const BAND_LAYOUTS=['bands','field','columns','frame','horizon'];
// Which controls change the poster in a given state (the editor disables the rest).
export function controlActive(key,s){switch(key){case 'leading':return s.layout!=='bands'&&s.text.includes('/');case 'keyline':return s.edge!=='none'||s.shadow==='glow';case 'depth':return s.shadow!=='none';case 'angle':return s.shadow==='drop'||s.shadow==='block';case 'groundScale':return s.groundPattern!=='none'||s.layout==='bands'||s.layout==='field';case 'bands':return BAND_LAYOUTS.includes(s.layout);default:return true;}}

// Colours
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
const lum=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
export const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
function seeded(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return ((r^r>>>14)>>>0)/4294967296;};}
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

// Text input: A–Z, 0–9, . , : - ! ? ' and spaces; '/' breaks up to three rows.
export function normalizeWord(input,fallback){
 const t=String(input??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[‘’`´]/g,"'").replace(/[–—]/g,'-').toUpperCase().replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim();
 if(!t){if(fallback!==undefined)return fallback;throw new Error('Type at least one letter.');}
 if(!/^[A-Z0-9 .,:\-!?'/]+$/.test(t))throw new Error("Use A–Z, 0–9, spaces and . , : - ! ? ' — / starts a new row.");
 const rows=t.split('/');if(rows.length>3)throw new Error('Use at most three rows.');if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if(t.replace(/[ /]/g,'').length>24)throw new Error('Use at most 24 characters.');return rows.map(r=>r.trim()).join('/');}
const clampNum=(v,c)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):c.value;
const isHex=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,given={...input.params};
 const params={};for(const c of CONTROLS)params[c.key]=clampNum(given[c.key]??set.params[c.key],{...c,value:set.params[c.key]});
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k];let text;try{text=normalizeWord(input.text,family.text);}catch{text=family.text;}
 const colors=Array.isArray(input.colors)&&input.colors.length===7&&input.colors.every(isHex)?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const windows=Array.isArray(input.windows)&&input.windows.length===6&&input.windows.every(p=>Array.isArray(p)&&p.length===2&&p.every(isHex))?input.windows.map(p=>p.map(c=>c.toLowerCase())):family.windows.map(p=>[...p]);
 const sequence=Array.isArray(input.sequence)&&input.sequence.length===6&&input.sequence.every(id=>PATTERN_IDS.includes(id))?[...input.sequence]:[...set.sequence];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&]/g,'').slice(0,max):d;
 return {engine:ENGINE,family:family.id,text,title:clip(input.title,family.title,48),info:clip(input.info,family.info,140),stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,
  letters:pick('letters'),layout:pick('layout'),assign:pick('assign'),anchor:pick('anchor'),inking:pick('inking'),edge:pick('edge'),shadow:pick('shadow'),pattern:pick('pattern'),groundPattern:pick('groundPattern'),sequence,params,colors,windows};}

// Window k: its pattern, its two inks and its turn. A third note (accent) is
// chosen so it never vanishes into the paper.
function permutation(state){const rand=seeded(hashText(state.text)^0x9e37),p=[0,1,2,3,4,5];for(let i=5;i>0;i--){const j=Math.floor(rand()*(i+1));[p[i],p[j]]=[p[j],p[i]];}if(p.every((v,i)=>v===i))[p[0],p[1]]=[p[1],p[0]];return p;}
export function windowFor(state,L){const seq=state.sequence,id=state.assign==='single'?state.pattern:state.assign==='shuffle'?seq[permutation(state)[L%6]]:seq[L%6];
 let [paper,ink]=state.inking==='cycle'?state.windows[L%6]:state.windows[0];if(state.inking==='swap'&&L%2)[paper,ink]=[ink,paper];
 let accent=ink,cycle=[ink];if(state.inking==='cycle'){accent=[state.colors[4],...state.windows.map(w=>w[1]),state.colors[1]].find(c=>c!==ink&&contrast(c,paper)>=1.7)??ink;cycle=[ink,accent];}
 return {id,inks:{paper,ink,accent,cycle},rot:state.params.rotate+L*state.params.rotateStep};}
// Ground inks; figurative motifs cycle through the palette, skipping colours that would vanish into the paper.
const groundInks=(s,paper,ink)=>{const [,text,keyline,,accent,band,bandInk]=s.colors,p=paper??band,cycle=[...new Set([accent,text,keyline,...s.windows.map(w=>w[1])])].filter(c=>contrast(c,p)>=1.6);return {paper:p,ink:ink??bandInk,accent,cycle:cycle.length?cycle:[ink??bandInk]};};

// Fit: one scale for all rows, each row justified to the width, or one row per box.
function place(rows,fit,state){const w=state.params.weight,hN=1+2*w,lead=state.params.leading,R=rows.length,out=[];let ks,ys,xs;
 if(fit.mode==='boxes'){const k=Math.min(...rows.map((r,i)=>{const [x0,y0,x1,y1]=fit.boxes[i];return Math.min((x1-x0)/r.width,(y1-y0)/hN);}));ks=rows.map(()=>k);
  ys=rows.map((r,i)=>{const [,y0,,y1]=fit.boxes[i];return (y0+y1)/2-hN*k/2;});xs=rows.map((r,i)=>{const [x0,,x1]=fit.boxes[i];return (x0+x1)/2-r.width*k/2;});}
 else{const [x0,y0,x1,y1]=fit.box,bw=x1-x0,bh=y1-y0;
  if(fit.mode==='justify'){ks=rows.map(r=>bw/r.width);const total=ks.reduce((s,k)=>s+k*hN,0)+lead*(R-1)*Math.min(...ks);if(total>bh)ks=ks.map(k=>k*bh/total);}
  else{const k=Math.min(bw/Math.max(...rows.map(r=>r.width)),bh/(R*hN+(R-1)*lead));ks=rows.map(()=>k);}
  const gap=lead*Math.min(...ks),total=ks.reduce((s,k)=>s+k*hN,0)+gap*(R-1);let y=y0+(bh-total)/2;ys=ks.map(k=>{const t=y;y+=k*hN+gap;return t;});xs=rows.map((r,i)=>x0+(bw-r.width*ks[i])/2);}
 rows.forEach((r,i)=>{const k=ks[i],map=([u,v])=>[xs[i]+u*k,ys[i]+(v+w)*k];for(const g of r.glyphs)out.push({ch:g.ch,row:i,k,polys:g.polys.map(p=>p.map(map)),raw:g.raw.map(p=>p.map(map)),line:[ys[i]+w*k,ys[i]+(1+w)*k,xs[i],xs[i]+r.width*k]});});
 return out;}

const rectD=(x0,y0,x1,y1)=>`M${n(x0)} ${n(y0)}H${n(x1)}V${n(y1)}H${n(x0)}Z`;
const SANS="'Helvetica Neue',Helvetica,Arial,sans-serif",SERIF="Georgia,'Times New Roman',serif",JP="'Helvetica Neue',Helvetica,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";
const infoLines=s=>s.info.split('/').map(t=>t.trim()).filter(Boolean).slice(0,3);
function text(str,x,y,size,fill,{anchor='start',face=SANS,italic=false,spacing=.2}={}){return `<text x="${n(x)}" y="${n(y)}" font-family="${face}" font-size="${size}" fill="${fill}" letter-spacing="${spacing}"${anchor!=='start'?` text-anchor="${anchor}"`:''}${italic?' font-style="italic"':''}>${esc(str)}</text>`;}
// Standard header: title and rule on top, information lines at the foot (or under the rule).
function header(s,ink,{x=36,top=58,right=W-36,under=false,foot=H-60}={}){const face=s.family==='kamekura'?SERIF:SANS,lines=infoLines(s);
 return text(s.title,x,top,20,ink,{face,spacing:.6})+`<path d="M${x} ${top+12}H${right}" stroke="${ink}" stroke-width=".8"/>`+lines.map((l,i)=>under?text(l,x,top+34+i*15,11.5,ink):text(l,x,foot+(i-lines.length+1)*15,11.5,ink)).join('');}
function groundFill(ctx,clipD,region,{inks,anchor=[W/2,H/2],scale,row=false}={}){const s=ctx.state;if(s.groundPattern==='none')return `<path d="${clipD}" fill="${(inks??groundInks(s)).paper}"/>`;
 const id=`${ctx.uid}-g${ctx.k++}`,k=inks??groundInks(s);ctx.defs.push(`<clipPath id="${id}"><path d="${clipD}"/></clipPath>`);
 return `<g clip-path="url(#${id})"><path d="${clipD}" fill="${k.paper}"/>${patternSVG(s.groundPattern,{s:scale??s.params.groundScale,sw:s.params.stroke,d:s.params.detail,row},region,anchor,0,k).svg}</g>`;}

// Layouts: where the letters go (fit) and what surrounds them (back, front, header).
const LAYOUT={
 nippon(ctx,rows){const s=ctx.state,[ground,ink]=s.colors;return {fit:{mode:'uniform',box:[30,212,W-30,H-212]},
  back:()=>`<rect width="${W}" height="${H}" fill="${ground}"/>`+(s.groundPattern==='none'?'':groundFill(ctx,rectD(0,0,W,H),[0,0,W,H],{inks:groundInks(s,ground,s.colors[5])})),
  front:()=>'',header:()=>titleBox(ctx)+infoLines(s).map((l,i)=>text(l,W*.43,H-118+i*17,13,ink)).join('')};},
 stack(ctx){const s=ctx.state,[ground,ink]=s.colors;return {fit:{mode:'justify',box:[26,104,W-26,H-96]},
  back:()=>`<rect width="${W}" height="${H}" fill="${ground}"/>`+(s.groundPattern==='none'?'':groundFill(ctx,rectD(0,0,W,H),[0,0,W,H],{inks:groundInks(s,ground,s.colors[6])})),front:()=>'',header:()=>header(s,ink)};},
 bands(ctx,rows){const s=ctx.state,[ground,ink,,,,band,bandInk]=s.colors,R=rows.length,nb=Math.max(s.params.bands,R-1),np=nb+1,y0=36,y1=H-178,bh=Math.min(110,Math.max(26,s.params.groundScale*1.06)),ph=(y1-y0-nb*bh)/np,start=Math.floor((np-R)/2);
  const panel=i=>[36,y0+i*(ph+bh),W-36,y0+i*(ph+bh)+ph];
  return {fit:{mode:'boxes',boxes:rows.map((r,i)=>{const [a,b,c,d]=panel(start+i);return [a+20,b+16,c-20,d-16];})},
   back:()=>`<rect width="${W}" height="${H}" fill="${ground}"/>`+Array.from({length:np},(_,i)=>{const [a,b,c,d]=panel(i);return `<path d="${rectD(a,b,c,d)}" fill="${band}"/>`;}).join('')+
    Array.from({length:nb},(_,i)=>{const t=panel(i)[3],cy=t+bh/2;return groundFill(ctx,rectD(36,t,W-36,t+bh),[36,t,W-36,t+bh],{inks:groundInks(s,ground,bandInk),anchor:[W/2,cy],scale:s.params.groundScale,row:true});}).join(''),
   front:()=>'',header:()=>{const lines=infoLines(s);return text(s.title,W/2,H-118,30,ink,{anchor:'middle',face:SERIF,italic:true,spacing:0})+`<path d="M${W*.22} ${H-100}H${W*.78}" stroke="${band}" stroke-width=".8"/>`+lines.map((l,i)=>text(l,W/2,H-78+i*17,13,i?ink:band,{anchor:'middle',face:SERIF,italic:true})).join('');}};},
 field(ctx){const s=ctx.state,[ground,ink,,,accent,band]=s.colors,g=s.params.groundScale;
  return {fit:{mode:'uniform',box:[34,138,W-34,H-128]},
   back:()=>`<rect width="${W}" height="${H}" fill="${band}"/>`+groundFill(ctx,rectD(0,0,W,H),[0,0,W,H],{anchor:[W/2,0]})+Array.from({length:s.params.bands},(_,i)=>{const y=Math.round((H*(i+1)/(s.params.bands+1))/g)*g;return `<path d="${rectD(0,y-g*.11,W,y+g*.11)}" fill="${accent}"/>`;}).join(''),
   front:()=>'',header:()=>{const lines=infoLines(s);return `<path d="${rectD(0,0,W,94)}${rectD(0,H-80,W,H)}" fill="${ink}"/>`+text(s.title,36,56,20,ground,{spacing:.6})+lines.map((l,i)=>text(l,36,H-52+i*15,11.5,ground)).join('');}};},
 horizon(ctx){const s=ctx.state,[ground,ink,,,accent,band,bandInk]=s.colors,ys=H*.64,N=s.params.bands,A=44,uid=ctx.uid,pts=[];for(let x=-8;x<=W+8;x+=4)pts.push([x,ys-A*Math.abs(Math.sin(Math.PI*N*x/W+.35))]);
  const sea='M'+pts.map(([x,y])=>`${n(x)} ${n(y)}`).join('L')+`L${W+8} ${H+8}L-8 ${H+8}Z`,rand=seeded(hashText(s.text)^77);
  return {fit:{mode:'uniform',box:[40,146,W-40,ys-A-24]},
   back:()=>{ctx.defs.push(`<linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ground}"/><stop offset=".36" stop-color="${ground}"/><stop offset=".5" stop-color="${mix(accent,'#ffffff',.62)}"/><stop offset=".64" stop-color="${accent}"/></linearGradient>`);
    const dots=Array.from({length:16},()=>{const x=30+rand()*(W-60),y=40+rand()*(ys-A-80),r=5+rand()*5;return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${accent}" stroke="${mix(accent,'#000000',.35)}" stroke-width="${n(r*.3)}"/>`;}).join('');
    return `<rect width="${W}" height="${H}" fill="url(#${uid}-sky)"/>${dots}`+groundFill(ctx,sea,[0,ys-A-4,W,H],{anchor:[W/2,ys]})+`<path d="M${pts.map(([x,y])=>`${n(x)} ${n(y)}`).join('L')}" fill="none" stroke="${bandInk}" stroke-width="2.4"/>`;},
   front:()=>'',header:()=>header(s,ink,{under:true})};},
 columns(ctx){const s=ctx.state,[ground,ink,,shade,accent,band,bandInk]=s.colors,N=s.params.bands*2+1,xs=Array.from({length:N},(_,i)=>W*(i+.5)/N),cx=W*.4,cy=H*.3,r=W*.34;
  const bamboo=x=>{let d=rectD(x-8,-4,x+8,H+4),nodes='';for(let y=40+(x*7)%60;y<H;y+=92)nodes+=rectD(x-11,y-3,x+11,y+3);return `<path d="${d}" fill="${band}"/><path d="${nodes}" fill="${bandInk}"/><path d="M${n(x-3.5)} 0V${H}" stroke="${mix(band,'#ffffff',.35)}" stroke-width="2"/>`;};
  return {fit:{mode:'uniform',box:[34,150,W-34,H-110]},
   back:()=>`<rect width="${W}" height="${H}" fill="${ground}"/>`+groundFill(ctx,circle(cx,cy,r),[cx-r,cy-r,cx+r,cy+r],{inks:groundInks(s,accent,ink),anchor:[cx,cy]})+xs.filter((_,i)=>i%2).map(x=>`<path d="${rectD(x-5,0,x+5,H)}" fill="${shade}"/>`).join(''),
   front:()=>xs.filter((_,i)=>!(i%2)).map(bamboo).join(''),header:()=>header(s,ink)};},
 frame(ctx){const s=ctx.state,[ground,ink,keyline]=s.colors,t=22+s.params.bands*16;
  return {fit:{mode:'justify',box:[t+26,t+92,W-t-26,H-t-76]},
   back:()=>`<rect width="${W}" height="${H}" fill="${ground}"/>`+groundFill(ctx,rectD(0,0,W,H)+rectD(t,H-t,W-t,t),[0,0,W,H])+`<path d="${rectD(t+7,t+7,W-t-7,H-t-7)}" fill="none" stroke="${keyline}" stroke-width="1.6"/>`,
   front:()=>'',header:()=>header(s,ink,{x:t+26,top:t+52,right:W-t-26,foot:H-t-26})};},
 emblem(ctx){const s=ctx.state,[ground,ink,,,,,bandInk]=s.colors,cx=W*.5,cy=H*.355,a=H*.24,b=W*.26,turn=112,rho=(a*a+b*b)/(2*b),tr=`translate(${n(cx)} ${n(cy)}) rotate(${turn})`,
   lens=`M${n(-a)} 0A${n(rho)} ${n(rho)} 0 0 1 ${n(a)} 0A${n(rho)} ${n(rho)} 0 0 1 ${n(-a)} 0Z`,id=`${ctx.uid}-lens`;
  return {fit:{mode:'uniform',box:[40,H*.7,W-40,H-74]},
   back:()=>{ctx.defs.push(`<clipPath id="${id}"><path d="${lens}" transform="${tr}"/></clipPath>`);
    const tail=`<path d="M${n(a*.86)} 0L${n(a*1.3)} ${n(-b*.62)}Q${n(a*1.16)} 0 ${n(a*1.3)} ${n(b*.62)}Z" fill="${bandInk}" transform="${tr}"/>`,fin=`<path d="M${n(-a*.1)} ${n(-b*.9)}L${n(a*.38)} ${n(-b*1.18)}L${n(a*.42)} ${n(-b*.82)}Z" fill="${bandInk}" transform="${tr}"/>`;
    const k=groundInks(s),pat=s.groundPattern==='none'?'':patternSVG(s.groundPattern,{s:s.params.groundScale,sw:s.params.stroke,d:s.params.detail},[cx-a-10,cy-a-10,cx+a+10,cy+a+10],[cx,cy],turn-90,k).svg;
    const eye=`<g transform="${tr}"><circle cx="${n(-a*.6)}" cy="${n(-b*.18)}" r="${n(a*.085)}" fill="${ground}"/><circle cx="${n(-a*.6)}" cy="${n(-b*.18)}" r="${n(a*.05)}" fill="${ink}"/></g>`;
    return `<rect width="${W}" height="${H}" fill="${ground}"/>${tail}${fin}<g clip-path="url(#${id})"><path d="${lens}" transform="${tr}" fill="${k.paper}"/>${pat}</g>${eye}`;},
   front:()=>'',header:()=>header(s,ink,{under:true})};}
};
// The Nippon title: the header word built from the same letters, white outlines in a white box.
function titleBox(ctx){const s=ctx.state,[ground,ink]=s.colors,word=s.title.toUpperCase().replace(/[^A-Z0-9 .,:\-!?']/g,' ').replace(/\s+/g,' ').trim()||'WAGARA',rows=layoutText(word,s.letters,{width:1,weight:Math.min(.05,Math.max(0,s.params.weight)),gutter:.1}),r=rows[0];
 const hN=1+2*Math.min(.05,Math.max(0,s.params.weight)),k=Math.min(40,(W*.46)/r.width),pad=9,bw=r.width*k+2*pad,bh=hN*k+2*pad,x0=W-34-bw,y0=40;
 const placed=place(rows,{mode:'boxes',boxes:[[x0+pad,y0+pad,x0+bw-pad,y0+bh-pad]]},{params:{...s.params,weight:Math.min(.05,Math.max(0,s.params.weight)),leading:0}});
 return `<path d="${rectD(x0,y0,x0+bw,y0+bh)}" fill="${ink}"/><path d="${placed.map(g=>polysD(g.polys,n)).join('')}" fill="${ink}" stroke="${ground}" stroke-width="1.6" stroke-linejoin="round" fill-rule="evenodd"/>`;}

// Windows: every letter clips its own pattern. Stage 2 shows the open windows
// (the pattern over each letter's box), stage 3 the clipped letters, stage 4
// adds rims, keylines, outer rings and shadows.
function drawWindows(ctx,placed,choose=L=>windowFor(ctx.state,L)){const s=ctx.state,uid=ctx.uid,p=s.params,[ground,ink,keyline,shade]=s.colors,stage=s.stage,under=[],body=[],over=[];
 const dx=p.depth*Math.cos(p.angle*Math.PI/180),dy=p.depth*Math.sin(p.angle*Math.PI/180),glow=stage===4&&s.shadow==='glow';
 if(glow)ctx.defs.push(`<filter id="${uid}-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${n(p.depth/3)}"/></filter><filter id="${uid}-lit" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
 const ids=[];
 placed.forEach((g,L)=>{const w=choose(L);ids.push(w.id);const d=polysD(g.polys,n),bb=bboxOf(g.polys),pad=p.keyline+4,region=[bb[0]-pad,bb[1]-pad,bb[2]+pad,bb[3]+pad];
  const anchor=s.anchor==='field'?[W/2,H/2]:[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2],P={s:p.scale,sw:p.stroke,d:p.detail},pat=patternSVG(w.id,P,region,anchor,w.rot,w.inks).svg;
  if(stage===2){const cid=`${uid}-b${L}`;ctx.defs.push(`<clipPath id="${cid}"><path d="${rectD(...bb)}"/></clipPath>`);
   body.push(`<g clip-path="url(#${cid})"><path d="${rectD(...bb)}" fill="${w.inks.paper}"/>${pat}</g>`);over.push(`<path d="${rectD(...bb)}" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="3 3"/><path d="${d}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${ground}" stroke-width=".9" stroke-linejoin="round"/>`);return;}
  let clipD=d;const edge=stage===4?s.edge:'none';
  if(edge==='rim'){const inner=offsetPx(g.polys,-p.keyline*1.2);clipD=polysD(inner,n);body.push(`<path d="${d}" fill="${keyline}" fill-rule="evenodd"/>`);}
  const cid=`${uid}-c${L}`;ctx.defs.push(`<clipPath id="${cid}"><path d="${clipD}" clip-rule="evenodd"/></clipPath>`);
  body.push(`<g clip-path="url(#${cid})"><path d="${rectD(...region)}" fill="${w.inks.paper}"/>${glow?`<g filter="url(#${uid}-lit)">${pat}</g>`:pat}</g>`);
  if(edge==='keyline'||edge==='double')over.push(`<path d="${d}" fill="none" stroke="${keyline}" stroke-width="${n(p.keyline)}" stroke-linejoin="round" fill-rule="evenodd"/>`);
  if(edge==='double')over.push(`<path d="${polysD(offsetPx(g.polys,p.keyline*1.6+2.5),n)}" fill="none" stroke="${keyline}" stroke-width="${n(Math.max(.8,p.keyline*.55))}" stroke-linejoin="round"/>`);
  if(stage===4&&s.shadow==='drop')under.push(`<path d="${d}" transform="translate(${n(dx)} ${n(dy)})" fill="${shade}" fill-rule="evenodd"/>`);
  if(stage===4&&s.shadow==='block')under.push(`<path d="${polysD(extrudePx(g.polys,dx,dy),n)}" fill="${shade}" fill-rule="evenodd"/>`);
  if(glow)under.push(`<path d="${d}" fill="none" stroke="${shade}" stroke-width="${n(p.keyline*2+3)}" stroke-linejoin="round"/>`);});
 return {svg:(glow?`<g filter="url(#${uid}-glow)">${under.join('')}</g>`:under.join(''))+body.join('')+(glow?`<g filter="url(#${uid}-lit)">${over.join('')}</g>`:over.join('')),ids};}
// Stage 1: outlines from the source (dashed), condensed and weighted (solid), on the row guides.
function drawSkeleton(ctx,placed){const s=ctx.state,[ground,ink,,,accent]=s.colors,lines=[...new Set(placed.map(g=>g.line.join(',')))].map(l=>l.split(',').map(Number));
 return `<path d="${lines.map(([t,b,x0,x1])=>`M${n(x0-14)} ${n(t)}H${n(x1+14)}M${n(x0-14)} ${n(b)}H${n(x1+14)}`).join('')}" stroke="${ink}" stroke-opacity=".35" stroke-width=".7" stroke-dasharray="5 4"/>`+
  `<path d="${placed.map(g=>polysD(g.polys,n)).join('')}" fill="${mix(ground,ink,.14)}" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round" fill-rule="evenodd"/>`+
  `<path d="${placed.map(g=>polysD(g.raw,n)).join('')}" fill="none" stroke="${accent}" stroke-width="1" stroke-dasharray="3 2"/>`;}

const uidOf=(state,prefix)=>prefix+hashText(JSON.stringify(state)).toString(36);
export function placeText(state){const p=state.params,rows=layoutText(state.text,state.letters,{width:p.width,weight:p.weight,gutter:p.gutter}),ctx={state,uid:'x',defs:[],k:0};return place(rows,LAYOUT[state.layout](ctx,rows).fit,state);}
// hideLetters / hideFront drop the windows or the layout's front layer (verification only).
export function render(input={},{hideLetters=false,hideFront=false}={}){const state=resolve(input),ctx={state,uid:uidOf(state,'w'),defs:[],k:0},p=state.params,[ground]=state.colors;
 const rows=layoutText(state.text,state.letters,{width:p.width,weight:p.weight,gutter:p.gutter}),lay=LAYOUT[state.layout](ctx,rows),placed=place(rows,lay.fit,state),parts=[];
 parts.push(state.stage===4?lay.back():`<rect width="${W}" height="${H}" fill="${ground}"/>`);let ids=[];
 if(!hideLetters){if(state.stage===1)parts.push(drawSkeleton(ctx,placed));else{const d=drawWindows(ctx,placed);parts.push(d.svg);ids=d.ids;}}
 if(state.stage===4)parts.push(hideFront?'':lay.front(),lay.header());
 const label={1:'letter outlines',2:'open windows',3:'clipped windows',4:'poster'}[state.stage];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(state.text.replaceAll('/',' / '))} — wagara window letters, ${state.family}, ${label}</title><defs>${ctx.defs.join('')}</defs><g data-stage="${state.stage}">${parts.join('')}</g></svg>`;
 return {svg,state,width:W,height:H,features:{letters:placed.length,rows:rows.length,stage:state.stage,patterns:[...new Set(ids)],capHeight:n(Math.min(...placed.map(g=>g.k))),layout:state.layout}};}

// Every glyph as a window, the patterns taken in turn, all at one scale.
export function specimen(input={}){const state=resolve({...input,stage:3}),cols=11,cw=150,ch=200,list=PATTERN_IDS.filter(id=>id!=='sumi'),w=cols*cw+40,h=Math.ceil(CHARACTERS.length/cols)*ch+40;
 const p=state.params,hN=1+2*p.weight,widest=Math.max(...[...'MW0'].map(c=>{const g=glyphShape(state.letters,c,p.width,p.weight).bbox;return g[2]-g[0];})),k=Math.min((cw-30)/widest,(ch-44)/hN),uid=uidOf(state,'s'),defs=[];
 const look={...state,stage:4,shadow:'none',edge:state.edge==='double'?'keyline':state.edge,params:{...p,scale:Math.max(10,p.scale*.55)}};
 const cells=[...CHARACTERS].map((c,i)=>{const g=glyphShape(state.letters,c,p.width,p.weight),x=20+(i%cols)*cw+cw/2,y=20+Math.floor(i/cols)*ch+ch/2-12,ox=x-(g.bbox[0]+g.bbox[2])/2*k,oy=y-(.5)*k,id=list[i%list.length];
  const d=drawWindows({state:look,uid:`${uid}-${i}`,defs,k:0},[{ch:c,polys:g.polys.map(q=>q.map(([u,v])=>[ox+u*k,oy+v*k]))}],()=>({...windowFor({...state,inking:'cycle'},i),id,rot:p.rotate}));
  return `<g data-glyph="${esc(c).replace("'",'&#39;')}" data-pattern="${id}">${d.svg}${text(`${c}  ${PATTERN[id].name}`,20+(i%cols)*cw+12,20+Math.floor(i/cols)*ch+ch-16,11,state.colors[1])}</g>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs><rect width="${w}" height="${h}" fill="${state.colors[0]}"/>${cells.join('')}</svg>`;}

// The kit: every pattern as a swatch in the family's inks, with its repeat tile outlined.
export function kit(input={},{cols=6,size=220,scale}={}){const state=resolve(input),p=state.params,gap=24,lh=46,w=cols*(size+gap)+gap,h=Math.ceil(PATTERNS.length/cols)*(size+gap+lh)+gap,uid=uidOf(state,'k'),defs=[],parts=[];
 PATTERNS.forEach((pat,i)=>{const x=gap+(i%cols)*(size+gap),y=gap+Math.floor(i/cols)*(size+gap+lh),inks=windowFor({...state,inking:state.inking==='swap'?'two-ink':state.inking},i),P={s:scale??Math.max(18,Math.min(64,p.scale)),sw:p.stroke,d:p.detail},cx=x+size/2,cy=y+size/2;
  const per=patternPeriod(pat.id,P),r=patternSVG(pat.id,P,[x,y,x+size,y+size],[cx,cy],0,inks.inks);defs.push(`<clipPath id="${uid}-${i}"><rect x="${x}" y="${y}" width="${size}" height="${size}"/></clipPath>`);
  parts.push(`<g data-pattern="${pat.id}" clip-path="url(#${uid}-${i})"><rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${inks.inks.paper}"/>${r.svg}<rect x="${n(cx)}" y="${n(cy)}" width="${n(per.rect[0])}" height="${n(per.rect[1])}" fill="none" stroke="${inks.inks.paper}" stroke-width="3" opacity=".9"/><rect x="${n(cx)}" y="${n(cy)}" width="${n(per.rect[0])}" height="${n(per.rect[1])}" fill="none" stroke="${inks.inks.ink}" stroke-width="1.2" stroke-dasharray="5 3"/></g>`+
   text(`${pat.name}  ${pat.jp}`,x,y+size+20,15,state.colors[1],{face:JP})+text(`${pat.gloss} · ${pat.kind}`,x,y+size+37,11.5,mix(state.colors[1],state.colors[0],.35)));});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs><rect width="${w}" height="${h}" fill="${state.colors[0]}"/>${parts.join('')}</svg>`;}

// One exact repeat of a pattern, for use elsewhere (its period rectangle, lattice origin at the corner).
export function tile(id,P,inks){const per=patternPeriod(id,P),[tw,th]=per.rect,r=patternSVG(id,P,[0,0,tw,th],[0,0],0,inks);
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${n(tw)}" height="${n(th)}" viewBox="0 0 ${n(tw)} ${n(th)}"><rect width="${n(tw)}" height="${n(th)}" fill="${inks.paper}"/>${r.svg}</svg>`,width:tw,height:th,period:per};}
