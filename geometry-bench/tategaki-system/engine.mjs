/* Tategaki colour columns — vertical Japanese setting as a type system.
 * Text is entered as columns. Columns flow right to left, characters top to
 * bottom; kana and kanji stand upright, punctuation, brackets, ー, 〜, … and
 * small kana take the font's vertical forms, Latin runs turn sideways (or
 * stand upright), two-digit numbers can sit tate-chū-yoko. Columns are sized,
 * grouped, stacked in tiers, aligned, spread and coloured by rules; a header
 * runs right to left in the prewar style; a Latin band runs alongside.
 * One generic line model serves columns (main axis down, lines leftward) and
 * prewar rows (main axis leftward, lines downward).
 */
import {CHARS,FACES,ASC,MID,KANJI_COUNT,kindOf,glyph,hasVert,verticalForms,advance,mul,rotateAbout,pathD,bounds} from './glyphs.mjs';
export {CHARS,FACES,KANJI_COUNT,verticalForms};
export const ENGINE='tategaki-v1';
export const W=728,H=1030;  // B-series proportion
export const SOURCES=[
 {id:'moma-6515',source:'moma',family:'noh',title:'Kanze Noh Play',designer:'Ikko Tanaka',date:'1961',lesson:'Right-to-left columns, a colour per character, rules between groups, two tiers.'},
 {id:'moma-4976',source:'moma',family:'fukuda',title:"On Children's Day",designer:'Shigeo Fukuda',date:'1955',lesson:'Bottom-aligned columns with ragged tops; upright digits; a small note column.'},
 {id:'pgda-6776',source:'pgda',family:'prewar',title:'Honkyo Subway Co. poster',designer:'Hisui Sugiura',date:'1927',lesson:'Right-to-left horizontal header lines above a vertical column.'},
 {id:'vam-O1782505',source:'vam',family:'film',title:'Poster (Merry Christmas, Mr. Lawrence)',designer:'Shochiku Co. Ltd.',date:'1983',lesson:'One heavy katakana column with a gradient fill between photographs.'},
 {id:'pgda-16977',source:'pgda',family:'dream',title:'“Dream Road” Suntory Old',designer:'Katsumi Asaba',date:'1980',lesson:'A sparse, widely tracked title column beside a dark picture field.'},
 {id:'moma-190169',source:'moma',family:'cascade',title:'Kimono Store',designer:'Yoshio Hayakawa',date:'1951',lesson:'Cascading columns of unequal, hand-set characters; small kana.'},
 {id:'vam-O1170855',source:'vam',family:'ballet',title:'Poster (Nureyev and Matsuyama Ballet)',designer:'Unknown',date:'1983',lesson:'A katakana column on a coloured band beside sideways Latin bands.'}
];
const P0={scale:1,step:1,title:1.5,note:.5,kana:1,tracking:.04,gap:.4,rhythm:0,groupGap:1.6,stagger:0,drift:1,jitter:0,ruby:.5,header:1,band:.8,rules:0,effect:.5,margin:48};
const S0={face:'mincho',direction:'vertical',layout:'spread',align:'top',colorMode:'mono',fill:'solid',ground:'plain',numerals:'upright',latinForm:'sideways',latinBand:'none',ruby:'on'};
// Colour roles: ground, ink, accent (rules, bands, effects), colours 1–5. The cycle is ink + colours 1–5.
export const ROLES=['Ground','Ink','Accent','Colour 1','Colour 2','Colour 3','Colour 4','Colour 5'];
export const FAMILIES=[
 {id:'noh',name:'Noh colour columns',after:'Ikko Tanaka, Kanze Noh Play, 1961',palette:'Black / white, red, green, blue, ochre, pink',colors:['#0c0c0e','#f1ede4','#d9d4c8','#e2343c','#2a9a5b','#3a6fd8','#c9a14a','#d9457f'],
  text:'第八回産経観世能|第一部十時始/観世静夫/一角仙人　観世寿夫/梅若泰之/花筐　梅若六郎/-舞囃子　唐船/-橋岡久太郎/安宅　観世喜之||第二部四時始/観世元昭/実盛　観世銕之丞/観世元正/草子洗小町/土蜘蛛　梅若猶義/梅若万三郎|昭和三十六年二月二十六日（日）/大阪産経会館特設能舞台/主催　産経新聞社　大阪新聞社',header:'',latin:'',
  set:{...S0,colorMode:'character',layout:'spread'},params:{...P0,title:1,note:.62,gap:.3,groupGap:1.2,stagger:3.2,rules:.8,tracking:.02},note:'Mincho on black. Every character takes the next colour of a six-colour cycle, never repeating its neighbour. Groups are ruled; the programme stacks in two tiers.'},
 {id:'fukuda',name:'Green bottom line',after:"Shigeo Fukuda, On Children's Day, 1955",palette:'Leaf green / chalk',colors:['#93a76a','#f6f2e6','#d8402f','#f6f2e6','#f6f2e6','#f6f2e6','#f6f2e6','#f6f2e6'],
  text:'5月5日/このいち日だけ/でなく/考えなければ/ならない/子どもたちの/楽しい/遊び場を|-子どもの日に・日本童画会',header:'',latin:'',
  set:{...S0,face:'mincho-bold',align:'bottom',numerals:'upright'},params:{...P0,scale:1,gap:.22,note:.26,tracking:.03,margin:40},note:'Bold mincho in chalk on leaf green. Columns stand on one baseline, so their tops rag; the note keeps to the far edge.'},
 {id:'prewar',name:'Prewar right-to-left',after:'Hisui Sugiura, Honkyo Subway, 1927',palette:'Straw / ivory / indigo / umber',colors:['#e8d9b0','#9a875a','#bba878','#fbf6e8','#2b3a78','#fbf6e8','#2b3a78','#b23a2a'],
  text:'東京地下鐵道株式會社',header:'東洋唯一の地下鐵道/上野浅草間開通',latin:'',
  set:{...S0,face:'gothic',layout:'end',align:'bottom',colorMode:'role',fill:'shadow',ground:'stripes'},params:{...P0,scale:.8,header:1.6,tracking:.25,effect:.45},note:'The header reads right to left in rows, as before the war; the company name stands in one column below. Ceiling stripes, cast shadows.'},
 {id:'film',name:'Gradient title column',after:'Shochiku, film poster, 1983',palette:'White / cobalt to vermilion',colors:['#f3f1ec','#2149c4','#e3322b','#2149c4','#2149c4','#2149c4','#3b3a3a','#2149c4'],
  text:'戦場のメリークリスマス',header:'',latin:'',
  set:{...S0,face:'gothic-heavy',layout:'centre',align:'justify',fill:'gradient',ground:'panels'},params:{...P0,tracking:-.04,effect:.55,margin:36},note:'One heavy column, cobalt running into vermilion with a white halo, between picture panels. ー turns vertical.'},
 {id:'dream',name:'Sparse title',after:'Katsumi Asaba, Dream Road, 1980',palette:'Paper / ink / sepia field',colors:['#f2f0eb','#161513','#161513','#161513','#3d3a36','#161513','#3a2e27','#161513'],
  text:'*夢街道。|-一九八〇年夏、/-オールドの旅は/-夢の街道をゆく。',header:'',latin:'',
  set:{...S0,face:'mincho-bold',layout:'start',align:'top',colorMode:'role',ground:'panels'},params:{...P0,title:4.4,note:1,tracking:.42,groupGap:1.2,margin:44},note:'Four characters tracked wide down the edge; the end mark sits in its own cell. The picture fills what the text leaves.'},
 {id:'cascade',name:'Cascading brush',after:'Yoshio Hayakawa, Kimono Store, 1951',palette:'Cream / ink / vermilion',colors:['#efe6d1','#151414','#c8402e','#151414','#151414','#151414','#151414','#c8402e'],
  text:'小千谷縮と/博多單帯の会|-初夏の/-お化粧品カーニバル',header:'',latin:'',
  set:{...S0,face:'gothic-heavy',layout:'start',align:'cascade'},params:{...P0,kana:.5,jitter:.95,drift:1.4,gap:.5,note:.3,step:.94,tracking:.06},note:'Columns step down to the left; kana shrink beside the kanji and every character is set slightly by hand.'},
 {id:'ballet',name:'Band and Latin',after:'Matsuyama Ballet poster, 1983',palette:'Slate / chalk / vermilion band / lilac',colors:['#2c2f2e','#f4f1ea','#d8432c','#f4f1ea','#f4f1ea','#f4f1ea','#55595a','#b9a8dc'],
  text:'-松山バレエ団/-創立35周年記念/-春季特別公演||*ヌレエフと松山バレエ団||-主催　松山バレエ団/-後援　外務省・文化庁',header:'',latin:'NUREYEV & MATSUYAMA BALLET COMPANY/The Special Spring Performances Celebrating the 35th Anniversary of Matsuyama Ballet Company',
  set:{...S0,face:'gothic',layout:'start',colorMode:'role',ground:'band',numerals:'tcy',latinBand:'start'},params:{...P0,title:1,note:.36,gap:.3,band:.95,tracking:.02,groupGap:1},note:'Katakana title on a vermilion band; notes stack above and below it in tiers; 35 sits tate-chū-yoko. Latin runs sideways in its own lilac band.'},
 {id:'neon',name:'Neon cascade',after:'new — electro',palette:'Night / magenta / cyan / acid / violet',colors:['#07060b','#f4f0ff','#ff2bd6','#ff2bd6','#19f0ff','#c6ff3d','#7a5cff','#19f0ff'],
  text:'*電子音楽祭/夜明けまで踊れ/8月8日（土）23時開演|渋谷・新宿・池袋',header:'',latin:'TOKYO ELECTRONIC NIGHT 2026',
  set:{...S0,face:'gothic-heavy',align:'cascade',colorMode:'column',fill:'glow',ground:'haze',numerals:'tcy',latinBand:'end'},params:{...P0,title:1.25,drift:1.3,gap:.55,band:.5,effect:.6,tracking:.05},note:'Glowing columns on near-black stepping down to the left, each its own colour. 23 sits tate-chū-yoko; the band runs at the far edge.'},
 {id:'riso',name:'Riso overprint',after:'new — two-drum print',palette:'Off-white / fluorescent pink / blue / yellow',colors:['#f3eee3','#ff4f8b','#2a62d6','#2a62d6','#ffb000','#ff4f8b','#2a62d6','#ffb000'],
  text:'まちの/ちいさな/*本の市|古本と珈琲/毎週日曜日/10時から',header:'',latin:'',
  set:{...S0,face:'maru',align:'centre',colorMode:'column',fill:'overprint',numerals:'tcy'},params:{...P0,title:1.35,stagger:1.4,gap:.3,effect:.55,tracking:.08},note:'Rounded gothic in pink, blue and yellow, overprinted and slightly off register; columns alternate high and low.'},
 {id:'manuscript',name:'Manuscript grid',after:'new — genkō yōshi',palette:'Paper / ink / vermilion grid',colors:['#f6f2e7','#1c1b19','#cf5a35','#1c1b19','#1c1b19','#1c1b19','#cf5a35','#1c1b19'],
  text:'吾輩《わがはい》は猫《ねこ》である。/名前《なまえ》はまだ無《な》い。/どこで生《うま》れたかとんと/見当《けんとう》がつかぬ。',header:'',latin:'',
  set:{...S0,colorMode:'role',ground:'grid'},params:{...P0,scale:.94,tracking:.18,gap:.9,ruby:.46},note:'One character per square on vermilion manuscript paper, with furigana beside the kanji. Text: Natsume Sōseki, 1905.'}
];
export const CONTROLS=[
 {key:'scale',label:'Size (share of the fitted size)',group:'size',min:.3,max:1,step:.01},
 {key:'step',label:'Size step per column',group:'size',min:.7,max:1.3,step:.01},
 {key:'title',label:'Title columns (*) ×',group:'size',min:1,max:5,step:.05},
 {key:'note',label:'Note columns (-) ×',group:'size',min:.2,max:1,step:.01},
 {key:'kana',label:'Kana size',group:'size',min:.4,max:1,step:.01},
 {key:'margin',label:'Margin',group:'size',min:20,max:120,step:1},
 {key:'tracking',label:'Character tracking',group:'rhythm',min:-.1,max:1.5,step:.01},
 {key:'gap',label:'Column gap',group:'rhythm',min:0,max:2,step:.01},
 {key:'rhythm',label:'Gap rhythm (wide / narrow)',group:'rhythm',min:0,max:.9,step:.01},
 {key:'groupGap',label:'Group gap',group:'rhythm',min:0,max:5,step:.05},
 {key:'stagger',label:'Stagger (alternate columns)',group:'rhythm',min:0,max:6,step:.05},
 {key:'drift',label:'Cascade drift per column',group:'rhythm',min:-3,max:3,step:.05,uses:{align:['cascade']}},
 {key:'jitter',label:'Hand jitter',group:'rhythm',min:0,max:1,step:.01},
 {key:'ruby',label:'Ruby size',group:'parts',min:.3,max:.7,step:.01,uses:{ruby:['on']}},
 {key:'header',label:'Header size',group:'parts',min:.4,max:3,step:.05},
 {key:'band',label:'Latin band width',group:'parts',min:.2,max:2,step:.05,uses:{latinBand:['start','end','title']}},
 {key:'rules',label:'Rule weight',group:'colour',min:0,max:4,step:.1},
 {key:'effect',label:'Effect strength',group:'colour',min:0,max:1,step:.01,uses:{fill:['outline','gradient','shadow','glow','overprint']}}
];
export const OPTIONS={face:Object.keys(FACES),direction:['vertical','rtl'],layout:['spread','start','centre','end'],align:['top','bottom','centre','cascade','justify'],
 colorMode:['character','column','group','role','mono'],fill:['solid','outline','gradient','shadow','glow','overprint'],ground:['plain','grid','band','panels','stripes','haze'],
 numerals:['upright','tcy','sideways'],latinForm:['sideways','upright'],latinBand:['none','start','end','title'],ruby:['on','off']};
// Sample copy for the editor's chips; any text in the prepared set works.
export const PRESETS=[
 {id:'transfer',label:'縦組の柱',text:'*縦組《たてぐみ》の柱/色は右から左へ。/「ちょっと」ーも/縦のかたちに！|-第26回　Type Study'},
 {id:'haiku',label:'古池や',text:'古池や/蛙飛びこむ/水の音|-松尾芭蕉'},
 {id:'festival',label:'夏祭り',text:'*夏祭り/花火大会/8月15日（土）19時より|-雨天中止　小雨決行'},
 {id:'cities',label:'都市',text:'東京/京都/大阪/名古屋/札幌/福岡'},
 {id:'mixed',label:'Mixed Latin',text:'*TOKYO 2026/東京の夜は/Type and 縦書き/第35回デザイン展'},
 {id:'soseki',label:'吾輩は猫',text:'吾輩《わがはい》は猫《ねこ》である。/名前《なまえ》はまだ無《な》い。'}
];
export const STAGES=['Column grid','Vertical forms','Colour and rules','Poster'];
export const n=v=>Math.round(v*100)/100;
const LIMITS={columns:24,perColumn:40,total:320,header:3,headerChars:24,latin:3,latinChars:96};

// ── Text ────────────────────────────────────────────────────────────────
// Columns: / or a new line starts a column, | a group, || a group stacked
// below the previous one. * opens a title column, - a note column.
// Ruby: 漢字《かんじ》 (the run of kanji before 《), or ｜base《ruby》.
const isAlnum=ch=>/[A-Za-z0-9À-ÿ]/.test(ch),RUBY_BASE=ch=>kindOf(ch)==='kanji'||'々〆〇ヶ'.includes(ch);
const CJK_PUNCT={'(':'（',')':'）','!':'！','?':'？',':':'：',';':'；',',':'、','.':'。','~':'〜','[':'［',']':'］','{':'｛','}':'｝','<':'〈','>':'〉','*':'＊'};
function clean(s){return String(s??'').normalize('NFC').replace(/[｡-ﾟ]+/g,m=>m.normalize('NFKC')).replace(/[０-９Ａ-Ｚａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
 .replace(/～/g,'〜').replace(/／/g,'/').replace(/\r\n?/g,'\n').replace(/\n[ \t]*\n/g,'|').replace(/\n/g,'/').replace(/[\t  - ]/g,' ').replace(/ {2,}/g,' ');}
const unsupported=chars=>new Error(`Not in the prepared character set: ${[...new Set(chars)].slice(0,4).map(c=>'「'+c+'」').join(' ')}. Use kana, Latin, digits, punctuation or one of the ${KANJI_COUNT} common kanji.`);
// One column (or header line) → atoms and ruby spans.
function atomize(src,{ruby=true}={}){const atoms=[],rubies=[],bad=[];let mark=-1;
 for(let i=0;i<src.length;i++){const c=src[i];
  if(c==='｜'&&ruby){mark=atoms.length;continue;}
  if(c==='《'&&ruby){const j=src.indexOf('》',i);if(j<0)throw new Error('Close the ruby with 》.');const text=src.slice(i+1,j);if(!text.trim())throw new Error('Ruby 《》 is empty.');
   const rb=[...text];for(const r of rb)if(!kindOf(r)||'《》｜'.includes(r))bad.push(r);
   let a=mark;if(a<0){a=atoms.length;while(a>0&&RUBY_BASE(atoms[a-1].ch))a--;}
   if(a===atoms.length)throw new Error(`Ruby 《${text}》 needs kanji before it — or mark its base with ｜.`);rubies.push({a,b:atoms.length,text:rb.join('')});mark=-1;i=j;continue;}
  if(c==='》'||c==='《'||c==='｜'){if(ruby)throw new Error('A 》 without 《.');bad.push(c);continue;}
  const k=kindOf(c);if(!k){bad.push(c);continue;}atoms.push({ch:c,k});}
 if(bad.length)throw unsupported(bad);if(!atoms.length)throw new Error('Columns cannot be empty.');return {atoms,rubies};}
export function parseColumns(input){
 const s=clean(input).replace(/ *[\/|][\/| ]*/g,m=>{const bars=(m.match(/\|/g)||[]).length;return bars>1?'||':bars?'|':'/';}).replace(/^(\|\||\||\/)|(\|\||\||\/)$/g,'').trim();if(!s)throw new Error('Type at least one column.');
 const parts=s.split(/(\|\||\||\/)/),columns=[],groups=[];let group={cols:[],below:false},chars=0;
 for(let i=0;i<parts.length;i+=2){let raw=parts[i].trim(),role='body';const sep=parts[i-1];
  if(sep==='|'||sep==='||'){groups.push(group);group={cols:[],below:sep==='||'};}
  if(/^[*＊]/.test(raw)){role='title';raw=raw.slice(1).trim();}else if(/^[-－]/.test(raw)){role='note';raw=raw.slice(1).trim();}
  if(!raw)throw new Error('Columns cannot be empty — remove the extra / or |.');
  const {atoms,rubies}=atomize(raw);if(atoms.length>LIMITS.perColumn)throw new Error(`Keep each column to ${LIMITS.perColumn} characters.`);chars+=atoms.length;
  group.cols.push(columns.length);columns.push({raw,role,atoms,rubies,group:groups.length});}
 groups.push(group);if(columns.length>LIMITS.columns)throw new Error(`Use at most ${LIMITS.columns} columns.`);if(chars>LIMITS.total)throw new Error(`Use at most ${LIMITS.total} characters.`);
 return {columns,groups,text:columns.map((c,i)=>{const sep=i===0?'':groups[c.group].cols[0]===i?(groups[c.group].below?'||':'|'):'/';return sep+(c.role==='title'?'*':c.role==='note'?'-':'')+c.raw;}).join('')};}
export const normalizeColumns=input=>parseColumns(input).text;
// Header: right-to-left rows, / between lines. Latin band: Latin only, / between bands.
export function parseHeader(input){const s=clean(input).replace(/ ?\/ ?/g,'/').trim();if(!s)return {lines:[],text:''};if(/\|/.test(s))throw new Error('The header takes / between lines, not |.');
 const lines=s.split('/');if(lines.length>LIMITS.header)throw new Error('Use at most three header lines.');
 const out=lines.map(l=>{if(!l.trim())throw new Error('Header lines cannot be empty.');const a=atomize(l.trim(),{ruby:false});if(a.atoms.length>LIMITS.headerChars)throw new Error(`Keep header lines to ${LIMITS.headerChars} characters.`);return {raw:l.trim(),role:'header',atoms:a.atoms,rubies:[]};});
 return {lines:out,text:out.map(l=>l.raw).join('/')};}
export function parseLatin(input){const s=String(input??'').normalize('NFC').replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/\s+/g,' ').replace(/ ?\/ ?/g,'/').trim();if(!s)return {lines:[],text:''};
 const lines=s.split('/');if(lines.length>LIMITS.latin)throw new Error('Use at most three Latin bands.');
 for(const l of lines){if(!l.trim())throw new Error('Latin bands cannot be empty.');const bad=[...l].filter(c=>kindOf(c)!=='latin');if(bad.length)throw new Error(`The Latin band takes Latin letters, digits and punctuation — not ${[...new Set(bad)].slice(0,3).map(c=>'「'+c+'」').join(' ')}.`);if(l.length>LIMITS.latinChars)throw new Error(`Keep Latin bands to ${LIMITS.latinChars} characters.`);}
 return {lines:lines.map(l=>l.trim()),text:lines.map(l=>l.trim()).join('/')};}

// Atoms → items. c upright cell · u upright Latin cell · y tate-chū-yoko · r run (sideways in columns, horizontal in rows) · g gap.
function itemize(col,state,dir,seed){const A=col.atoms.map(a=>({...a}));
 // ASCII punctuation between CJK characters becomes its full-width CJK form.
 const near=(i,d)=>{for(let j=i+d;j>=0&&j<A.length;j+=d)if(A[j].ch!==' ')return A[j];return null;};
 A.forEach((a,i)=>{if(a.k==='latin'&&CJK_PUNCT[a.ch]){const p=near(i,-1),q=near(i,1);if(!(p&&p.k==='latin'&&isAlnum(p.ch))&&!(q&&q.k==='latin'&&isAlnum(q.ch))){a.ch=CJK_PUNCT[a.ch];a.k='punct';}}});
 const isL=i=>!!A[i]&&A[i].k==='latin'&&A[i].ch!==' ',latin=i=>isL(i)||(A[i]?.ch===' '&&isL(i-1)&&isL(i+1));
 const items=[],map=[],rand=seeded(hash(col.raw)^seed),p=state.params;
 for(let i=0;i<A.length;){const a=A[i];
  if(a.ch===' '&&!(latin(i-1)&&latin(i+1))){items.push({t:'g',adv:.5});map.push([i,i+1]);i++;continue;}
  if(a.k==='latin'){let j=i;while(j<A.length&&latin(j))j++;const text=A.slice(i,j).map(x=>x.ch).join('').trim(),digits=/^\d+$/.test(text);
   const run=()=>{items.push({t:'r',text,adv:[...text].reduce((s,ch)=>s+advance(state.face,ch),0)/1000});map.push([i,j]);};
   if(dir==='h')run();
   else if(digits&&state.numerals!=='sideways'){if(state.numerals==='tcy'&&text.length===2){items.push({t:'y',text,adv:1});map.push([i,j]);}else if(state.numerals==='tcy'&&text.length>2)run();else [...text].forEach((ch,k)=>{items.push({t:'u',ch,adv:1});map.push([i+k,i+k+1]);});}
   else if(!digits&&state.latinForm==='upright')[...A.slice(i,j)].forEach((x,k)=>{items.push(x.ch===' '?{t:'g',adv:.5}:{t:'u',ch:x.ch,adv:1});map.push([i+k,i+k+1]);});
   else run();i=j;continue;}
  // Upright cells; hand jitter varies size, offset and turn of kana and kanji.
  const r1=rand(),r2=rand(),r3=rand(),kana=a.k==='kana'||a.ch==='ー',hand=(a.k==='kanji'||kana)?p.jitter:0,size=(kana?p.kana:1)*(1+hand*(r1-.5)*.5);
  items.push(a.ch==='　'?{t:'g',adv:1}:{t:'c',ch:a.ch,k:a.k,size,adv:size,shift:hand*(r2-.5)*.24,turn:hand*(r3-.5)*14});map.push([i,i+1]);i++;}
 const at=atom=>map.findIndex(([x,y])=>atom>=x&&atom<y);
 return {items,rubies:col.rubies.map(r=>({a:at(r.a),b:at(r.b-1)+1,text:r.text})).filter(r=>r.a>=0&&r.b>r.a)};}

// ── State ───────────────────────────────────────────────────────────────
function seeded(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return ((r^r>>>14)>>>0)/4294967296;};}
const hash=s=>[...String(s)].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const clampNum=(v,c,d)=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(+v)?Math.min(c.max,Math.max(c.min,+v)):d;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],params={},pick=k=>OPTIONS[k].includes(input[k])?input[k]:family.set[k],given=input.params??{};
 for(const c of CONTROLS)params[c.key]=clampNum(given[c.key],c,family.params[c.key]);
 const tryOr=(f,v,d)=>{if(v===undefined||v===null)return d;try{return f(v);}catch{return d;}};
 const colors=Array.isArray(input.colors)&&input.colors.length===8&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 return {engine:ENGINE,family:family.id,text:tryOr(normalizeColumns,input.text,family.text),header:tryOr(v=>parseHeader(v).text,input.header,family.header),latin:tryOr(v=>parseLatin(v).text,input.latin,family.latin),
  stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,...Object.fromEntries(Object.keys(OPTIONS).map(k=>[k,pick(k)])),params,colors};}

// ── Layout ──────────────────────────────────────────────────────────────
// Sizes scale with one unit u (px per em of a body column). The largest u
// whose block fits the frame is found by bisection; Size scales it down.
function prepare(state){const dir=state.direction==='rtl'?'h':'v',P=parseColumns(state.text),cols=P.columns.map((c,i)=>({...c,idx:i,...itemize(c,state,dir,i*7919)}));
 const head=parseHeader(state.header).lines.map((l,j)=>({...l,idx:j,...itemize(l,state,'h',1e5+j)})),band=state.latinBand==='none'?[]:parseLatin(state.latin).lines;
 // Slots run across the page; a group stacked below (||) shares the previous group's slot.
 const slots=[];P.groups.forEach((g,gi)=>{if(g.below&&slots.length)slots[slots.length-1].groups.push(gi);else slots.push({groups:[gi]});});
 if(band.length){const b={band:true,groups:[]},title=cols.find(c=>c.role==='title')??cols[0],at=state.latinBand==='start'?0:state.latinBand==='end'?slots.length:slots.findIndex(s=>s.groups.includes(title.group))+1;slots.splice(at,0,b);}
 return {dir,cols,groups:P.groups,head,band,slots};}
const sum=a=>a.reduce((s,v)=>s+v,0),lengthOf=(items,s,tr)=>s*(sum(items.map(i=>i.adv))+tr*(items.length-1));
function arrange(state,pre,u){const p=state.params,{dir,cols,groups,head,band,slots}=pre,M=p.margin,fw=W-2*M,fh=H-2*M;
 // Header rows: the first spans the width in spread layouts; later rows are half size.
 const heads=[];let headH=0;head.forEach((h,j)=>{const nat=sum(h.items.map(i=>i.adv)),tr=.3,k=h.items.length,s=Math.min(j?heads[0].s*.5:u*p.header,fw/(nat+tr*(k-1)));heads.push({...h,s,len:lengthOf(h.items,s,tr),tr});headH+=s+(j?heads[0].s*.4:0);});
 if(heads.length)headH+=heads[0].s*.75;
 const mainAvail=dir==='v'?fh-headH:fw,crossAvail=dir==='v'?fw:fh-headH,rubyOn=state.ruby==='on';
 const lines=cols.map(c=>{const s=u*(c.role==='title'?p.title:c.role==='note'?p.note:1)*p.step**c.idx,rs=rubyOn&&c.rubies.length?s*p.ruby:0;return {...c,s,rs,thick:s+rs,len:lengthOf(c.items,s,p.tracking)};});
 const bands=band.map((text,j)=>{const thick=u*p.band*(j?.42:1),adv=sum([...text].map(ch=>advance(state.face,ch)))/1000;return {band:true,text,thick,adv};});
 // Main-axis offsets: stagger alternates within a group, cascade drifts by column.
 // Column gaps alternate wide and narrow (rhythm) and scale with their neighbours.
 let gapNo=0;const gapOf=(a,b)=>p.gap*(1+p.rhythm*(b.gk%2?-1:1))*(a.s+b.s)/2;
 const groupInfo=groups.map(g=>{const ls=g.cols.map(i=>lines[i]);ls.forEach((l,k)=>{l.off=(k%2)*p.stagger*u+(state.align==='cascade'?p.drift*u*l.idx:0);if(k)l.gk=gapNo++;});
  const offs=ls.map(l=>l.off),lo=Math.min(...offs),hi=Math.max(...offs);
  return {lines:ls,lo,hi,extent:Math.max(...ls.map(l=>l.len))+hi-lo,cross:sum(ls.map(l=>l.thick))+sum(ls.slice(1).map((l,k)=>gapOf(ls[k],l)))};});
 const tier=u*(.5+p.groupGap*.5);
 const S=slots.map(s=>s.band?{band:true,lines:bands,cross:sum(bands.map(b=>b.thick))+p.gap*u*.5*(bands.length-1),need:0}:{groups:s.groups,cross:Math.max(...s.groups.map(g=>groupInfo[g].cross)),need:sum(s.groups.map(g=>groupInfo[g].extent))+tier*(s.groups.length-1)});
 const between=S.slice(1).map((s,i)=>s.band||S[i].band?{size:p.gap*u,band:true}:{size:p.groupGap*u,band:false}),crossNeed=sum(S.map(s=>s.cross))+sum(between.map(b=>b.size)),mainNeed=Math.max(...S.map(s=>s.need));
 const fits=crossNeed<=crossAvail+1e-6&&mainNeed<=mainAvail+1e-6&&headH<=fh*.62;
 // Cross placement: spread hands the slack to the group gaps (or, with one
 // group, to the column gaps); start, centre and end shift the whole block.
 const slack=Math.max(0,crossAvail-crossNeed),sg=between.filter(b=>!b.band),text=S.filter(s=>!s.band);let c=0,colSpread=0;
 if(state.layout==='spread'){if(sg.length)sg.forEach(b=>b.size+=slack/sg.length);else{const k=Math.max(0,...text.flatMap(s=>s.groups.map(g=>groupInfo[g].lines.length-1)));if(k)colSpread=slack/k;else c=slack/2;}}
 else c=state.layout==='centre'?slack/2:state.layout==='end'?slack:0;
 const rules=[];
 S.forEach((s,si)=>{if(si)c+=between[si-1].size;s.c0=c;
  if(s.band){let x=c;(si===0&&S.length>1?[...s.lines].reverse():s.lines).forEach(b=>{b.c0=x;b.cc=x+b.thick/2;x+=b.thick+p.gap*u*.5;});c+=s.cross;return;}
  // Groups sharing a slot split the main axis: first on top, last at the bottom.
  const m=s.groups.length,free=mainAvail-s.need;let a=0,wide=0;
  s.groups.forEach(gi=>{const G=groupInfo[gi],A=a,B=a+G.extent+free/m;a=B+tier;G.A=A;G.B=B;let x=c;
   G.lines.forEach((l,k)=>{if(k)x+=gapOf(G.lines[k-1],l)+colSpread;l.c0=x;l.cc=x+l.rs+l.s/2;x+=l.thick;
    let start,end=null;
    if(state.align==='bottom')start=B-l.len+l.off-G.hi;else if(state.align==='centre')start=(A+B)/2-l.len/2+l.off-(G.lo+G.hi)/2;else start=A+l.off-G.lo;
    if(state.align==='justify'){end=B-(G.hi-l.off);if(l.items.length<2){start=(start+end-l.len)/2;end=null;}}
    placeItems(l,start,end,p.tracking);});
   wide=Math.max(wide,x-c);
   if(si&&!S[si-1].band&&p.rules>0)rules.push({c:s.c0-between[si-1].size/2,m0:Math.min(...G.lines.map(l=>l.m0)),m1:Math.max(...G.lines.map(l=>l.m1))});});
  c+=Math.max(s.cross,wide);});
 // Bands run the length of the main axis, shrinking their type when the text is long.
 for(const b of bands){b.f=Math.min(b.thick/.74,mainAvail/b.adv);b.len=b.adv*b.f;b.m0=state.align==='top'||state.align==='cascade'?0:state.align==='bottom'?mainAvail-b.len:(mainAvail-b.len)/2;b.m1=b.m0+b.len;}
 // Header rows sit above the body and read right to left.
 let hy=M;heads.forEach((h,j)=>{if(j)hy+=heads[0].s*.4;h.cc=hy+h.s/2;hy+=h.s;const spread=state.layout==='spread'&&h.items.length>1;
  const start=spread?0:state.layout==='centre'?(fw-h.len)/2:state.layout==='end'?fw-h.len:0;placeItems(h,start,spread?fw:null,h.tr);});
 return {fits,u,dir,M,frame:[M,M,W-M,H-M],R:W-M,T:M+headH,mainAvail,crossAvail,crossNeed,mainNeed,headH,lines,bands,heads,slots:S,groups:groupInfo,rules};}
function placeItems(l,start,end,tr){const k=l.items.length,extra=end===null||end===undefined||k<2?0:(end-start-l.len)/(k-1);let m=start;
 l.items.forEach(it=>{it.m0=m;it.len=it.adv*l.s;m+=it.len+tr*l.s+extra;});l.m0=start;l.m1=m-tr*l.s-extra;}
export function compose(input){const state=resolve(input),pre=prepare(state);
 let lo=0,hi=800;for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(arrange(state,pre,mid).fits)lo=mid;else hi=mid;}
 const g=arrange(state,pre,lo*state.params.scale);g.fitU=lo;g.state=state;return g;}

// ── Units: every drawn glyph with its matrix, colour key and kind ──────
// Right-to-left rows mirror brackets and stops so they open and close toward the reading direction.
export const MIRROR='（）「」『』【】〔〕［］〈〉｛｝、。，．';
const toScreen=(g,m,c)=>g.dir==='v'?[g.R-c,g.T+m]:[g.R-m,g.T+c];
function cellOrigin(g,m,cc,sz,head){return head||g.dir==='h'?[g.R-m-sz,(head?0:g.T)+cc-sz/2]:[g.R-cc-sz/2,g.T+m];}
export function units(geom){const st=geom.state,face=st.face,out=[];
 const cell=(ch,m,cc,sz,form,extra,turn=0,cx=0)=>{const gl=glyph(face,ch,form),[x0,y0]=cellOrigin(geom,m,cc,sz,extra.head),k=sz/1000,off=extra.t==='u'?(1000-gl.adv)/2:0,flip=form==='h'&&(extra.head||geom.dir==='h')&&MIRROR.includes(ch);
  let mat=flip?[-k,0,0,-k,x0+1000*k+cx,y0+ASC*k]:[k,0,0,-k,x0+off*k+cx,y0+ASC*k];if(turn)mat=mul(rotateAbout(turn,x0+sz/2+cx,y0+sz/2),mat);out.push({...extra,ch,gl,mat,alt:gl.alt||flip,flip,box:[x0+cx,y0,x0+cx+sz,y0+sz],sz});};
 const run=(text,m,cc,s,extra,mid=MID,head=false)=>{const k=s/1000,len=[...text].reduce((a,ch)=>a+advance(face,ch),0)*k;let px=0;const vertical=geom.dir==='v'&&!head;
  for(const ch of text){const gl=glyph(face,ch,'h');const mat=vertical?[0,k,k,0,geom.R-cc-mid*k,geom.T+m+px*k]:[k,0,0,-k,geom.R-m-len+px*k,(head?0:geom.T)+cc+mid*k];if(gl.cmds.length)out.push({...extra,ch,gl,mat,run:true});px+=gl.adv;}
  const [a,b]=vertical?[[geom.R-cc-s/2,geom.T+m],[geom.R-cc+s/2,geom.T+m+len]]:[[geom.R-m-len,(head?0:geom.T)+cc-s/2],[geom.R-m,(head?0:geom.T)+cc+s/2]];return [a[0],a[1],b[0],b[1]];};
 const line=(l,base,head=false)=>{const form=geom.dir==='v'&&!head?'v':'h';
  l.items.forEach((it,i)=>{const extra={...base,item:i,t:it.t,head,pos:it.m0+it.len/2};
   if(it.t==='c'){const sz=l.s*it.size;cell(it.ch,it.m0,l.cc+it.shift*l.s,sz,form,extra,it.turn);}
   else if(it.t==='u')cell(it.ch,it.m0,l.cc,l.s,'h',extra);
   else if(it.t==='y'){const sx=Math.min(1,2/it.text.length),k=l.s/1000,[x0,y0]=cellOrigin(geom,it.m0,l.cc,l.s,head),o=(1000-500*it.text.length*sx)/2;
    [...it.text].forEach((d,j)=>{const gl=glyph(face,d,'hw');out.push({...extra,ch:d,gl,mat:[k*sx,0,0,-k,x0+(o+500*j*sx)*k,y0+ASC*k],tcy:true,box:[x0,y0,x0+l.s,y0+l.s]});});}
   else if(it.t==='r')it.box=run(it.text,it.m0,l.cc,l.s,extra,MID,head);});
  // Ruby: kana beside the base (right of a column, above a row), spread over the base when shorter.
  if(!head&&l.rs)for(const r of l.rubies){const a=l.items[r.a],b=l.items[r.b-1],m0=a.m0,m1=b.m0+b.len,rs=l.rs,chars=[...r.text],tot=chars.length*rs,gap=tot<m1-m0?(m1-m0-tot)/chars.length:0,start=tot<m1-m0?m0+gap/2:(m0+m1)/2-tot/2;
   chars.forEach((ch,j)=>cell(ch,start+j*(rs+gap),l.c0+rs/2,rs,kindOf(ch)==='latin'?'h':form,{...base,ruby:true,item:r.a,t:kindOf(ch)==='latin'?'u':'c',pos:a.m0}));}};
 geom.heads.forEach((h,j)=>line(h,{role:'header',line:j,head:true},true));
 geom.lines.forEach(l=>line(l,{role:l.role,line:l.idx,group:l.group}));
 geom.bands.forEach((b,j)=>run(b.text,b.m0,b.cc,b.f,{role:'band',line:j,t:'r'},365));
 return out;}

// ── Colour ─────────────────────────────────────────────────────────────
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
export const luminance=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
// A colour index per unit (0–5 into ink + colours 1–5; 'band' → colour 5).
function paintKeys(geom,U){const st=geom.state,mode=st.colorMode,rand=seeded(hash(st.text+st.header)),key=new Map(),cyc=6;
 const idOf=u=>(u.head?'h':'b')+u.line+':'+u.item;
 // Character mode: a seeded pick from the cycle that differs from the character
 // above and from the nearest character in the column to the right.
 if(mode==='character'){let cur=null,prev=-1,before=[],now=[];
  for(const u of U){if(u.role==='band'||u.ruby)continue;const id=idOf(u);if(key.has(id))continue;const ln=(u.head?'h':'b')+u.line;if(ln!==cur){before=now;now=[];cur=ln;prev=-1;}
   let near=-1,best=Infinity;for(const q of before){const d=Math.abs(q.pos-u.pos);if(d<best){best=d;near=q.k;}}
   const opts=[...Array(cyc).keys()].filter(i=>i!==prev&&i!==near),k=opts[Math.floor(rand()*opts.length)];key.set(id,k);now.push({pos:u.pos,k});prev=k;}}
 const cycle=i=>i%cyc===0?1:2+i%cyc;
 return u=>{if(u.role==='band')return mode==='mono'?1:7;
  if(mode==='mono')return 1;if(mode==='role')return u.ruby?6:u.role==='title'?3:u.role==='note'?4:u.role==='header'?(u.line?6:5):1;
  if(mode==='column')return u.head?cycle(u.line*2+1):cycle(u.line);if(mode==='group')return u.head?cycle(1):cycle(u.group);
  return cycle(key.get(idOf(u))??0);};}

export function unitColours(geom,U){const key=paintKeys(geom,U);return U.map(u=>geom.state.colors[key(u)]);}

// ── Drawing ─────────────────────────────────────────────────────────────
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra?' '+extra:''}/>`;
function crossRect(g,c0,c1,m0,m1){const [a,b]=toScreen(g,m0,c0),[c,d]=toScreen(g,m1,c1);return [Math.min(a,c),Math.min(b,d),Math.abs(c-a),Math.abs(d-b)];}
function groundSVG(g,uid){const st=g.state,C=st.colors,[ground,ink,accent]=C,parts=[rect(0,0,W,H,ground)],u=g.u,p=st.params;
 const block=[...g.lines,...g.bands],c0=Math.min(...block.map(l=>l.c0)),c1=Math.max(...block.map(l=>l.c0+l.thick));
 if(st.ground==='grid'){let d='';for(const l of g.lines){const G=g.groups[l.group],pitch=l.s*(1+Math.max(0,p.tracking));for(let m=l.m0-pitch*Math.floor((l.m0-G.A)/pitch+1e-9);m+l.s<=G.B+1e-6;m+=pitch){const [x,y,w,h]=crossRect(g,l.c0+l.rs,l.c0+l.thick,m,m+l.s);d+=`M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;}}
  const [x,y,w,h]=crossRect(g,c0-u*.4,c1+u*.4,0,g.mainAvail);parts.push(`<path d="${d}" fill="none" stroke="${accent}" stroke-width=".7" stroke-opacity=".75"/>${rect(x,y,w,h,'none',`stroke="${accent}" stroke-width="1.4"`)}`);}
 if(st.ground==='stripes'){let y=0,i=0;const bands=[];while(y<H){const h=10+i*2.2;bands.push(rect(0,y,W,h*.42,mix(ground,accent,.55)));y+=h;i++;}parts.push(bands.join(''));}
 if(st.ground==='haze'){const [cx,cy]=toScreen(g,g.mainAvail*.45,(c0+c1)/2);parts.push(`<radialGradient id="hz1-${uid}" cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.max(W,H)*.62)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${mix(ground,C[3],.42)}"/><stop offset="1" stop-color="${ground}" stop-opacity="0"/></radialGradient><radialGradient id="hz2-${uid}" cx="${n(W-cx*.7)}" cy="${n(H*.86)}" r="${n(W*.7)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${mix(ground,C[4],.34)}"/><stop offset="1" stop-color="${ground}" stop-opacity="0"/></radialGradient>${rect(0,0,W,H,`url(#hz1-${uid})`)}${rect(0,0,W,H,`url(#hz2-${uid})`)}`);}
 if(st.ground==='panels'||st.ground==='band'){const pad=u*.6,regions=[[0,c0-pad],[c1+pad,g.crossAvail]].filter(([a,b])=>b-a>u*2),tone=C[6],one=st.ground==='band';let d='';const defs=`<linearGradient id="pn-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(tone,'#ffffff',.12)}"/><stop offset="1" stop-color="${mix(tone,'#000000',.5)}"/></linearGradient><pattern id="dt-${uid}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.05" fill="${mix(tone,'#ffffff',.22)}"/></pattern>`;
  for(const [a,b] of regions){const k=one?1:Math.max(1,Math.min(3,Math.round(g.mainAvail/((b-a)*2)))),h=(g.mainAvail-pad*(k-1))/k;for(let i=0;i<k;i++){const [x,y,w,hh]=crossRect(g,a,b,i*(h+pad),i*(h+pad)+h);d+=rect(x,y,w,hh,`url(#pn-${uid})`)+rect(x,y,w,hh,`url(#dt-${uid})`,'opacity=".55"');}}
  parts.push(defs+d);}
 if(st.ground==='band'){const t=g.lines.find(l=>l.role==='title')??g.lines[0],[x,y,w,h]=crossRect(g,t.c0-u*.32,t.c0+t.thick+u*.32,-g.T-g.headH-5,H+W);parts.push(g.dir==='v'?rect(x,0,w,H,accent):rect(0,y,W,h,accent));}
 return parts.join('');}
function guides(g,{cells=true,opacity=.45,labels=false,bands=true}={}){const st=g.state,[ground,ink,accent]=st.colors,out=[];let d='',fills='';
 for(const l of [...g.lines,...g.heads.map(h=>({...h,head:true}))]){
  if(bands&&!l.head){const [x,y,w,h]=crossRect(g,l.c0,l.c0+l.thick,l.m0,l.m1);fills+=rect(x,y,w,h,accent,'fill-opacity=".14"');}
  if(cells)for(const it of l.items){if(it.t==='g')continue;const sz=it.t==='c'?l.s*it.size:l.s;let x,y,w,h;
   if(l.head){[x,y]=[g.R-it.m0-it.len,l.cc-l.s/2];w=it.len;h=l.s;}else{[x,y,w,h]=crossRect(g,l.cc-sz/2,l.cc+sz/2,it.m0,it.m0+it.len);}
   d+=`M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;if(it.t==='r')d+=g.dir==='v'&&!l.head?`M${n(x+w/2)} ${n(y)}v${n(h)}`:`M${n(x)} ${n(y+h/2)}h${n(w)}`;if(it.t==='y')d+=`M${n(x+w/2)} ${n(y+h*.2)}v${n(h*.6)}`;}}
 for(const b of g.bands){const [x,y,w,h]=crossRect(g,b.c0,b.c0+b.thick,b.m0,b.m1);fills+=rect(x,y,w,h,st.colors[7],'fill-opacity=".22"');}
 out.push(fills,`<path d="${d}" fill="none" stroke="${ink}" stroke-opacity="${opacity}" stroke-width=".6"/>`);
 if(labels){const lab=[];g.lines.forEach((l,i)=>{const s=Math.max(6,Math.min(14,l.thick*.5)),txt=String(i+1);let px=0;const k=s/1000,[cx,cy]=g.dir==='v'?[g.R-l.cc,g.T-s*.6]:[g.R+s*.6,g.T+l.cc];const w=[...txt].reduce((a,ch)=>a+advance('gothic',ch),0)*k;
   for(const ch of txt){const gl=glyph('gothic',ch,'h');lab.push(pathD(gl.cmds,[k,0,0,-k,cx-w/2+px*k,cy+s*.36],2));px+=gl.adv;}});
  const y=g.M*.45,x0=g.M,x1=W-g.M;out.push(`<path d="${lab.join('')}" fill="${accent}"/><path d="M${x1} ${n(y)}H${x0+10}M${x0+10} ${n(y-4)}L${x0} ${n(y)}L${x0+10} ${n(y+4)}" fill="none" stroke="${accent}" stroke-width="1.2"/>`);}
 return out.join('');}
function rulesSVG(g){const st=g.state,w=st.params.rules;if(!w||!g.rules.length)return '';return `<path d="${g.rules.map(r=>{const [x,y]=toScreen(g,r.m0,r.c),[x2,y2]=toScreen(g,r.m1,r.c);return `M${n(x)} ${n(y)}L${n(x2)} ${n(y2)}`;}).join('')}" stroke="${st.colors[2]}" stroke-width="${w}" fill="none"/>`;}
const dist=(a,b)=>{const x=rgb(a),y=rgb(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);};
export const highlight=C=>[C[2],...C.slice(3)].reduce((best,c)=>Math.min(dist(c,C[0]),dist(c,C[1]))>Math.min(dist(best,C[0]),dist(best,C[1]))?c:best,C[2]);
function glyphsSVG(g,U,stage,uid){const st=g.state,C=st.colors,[ground,ink,accent]=C,u=g.u,e=st.params.effect,digits=u>36?1:2,key=paintKeys(g,U);
 const d=x=>pathD(x.gl.cmds,x.mat,x.sz&&x.sz<24?2:digits);
 if(stage===2){const plain=U.filter(x=>!(x.alt||x.run&&x.role!=='band'||x.tcy)),marked=U.filter(x=>x.alt||x.run&&x.role!=='band'||x.tcy);
  return `<path d="${plain.map(d).join('')}" fill="${ink}"/><path d="${marked.map(d).join('')}" fill="${highlight(C)}"/>`;}
 const by=new Map();for(const x of U){const c=C[key(x)];if(!by.has(c))by.set(c,[]);by.get(c).push(d(x));}
 const solid=(attrs='')=>[...by].map(([c,ds])=>`<path fill="${c}" d="${ds.join('')}"${attrs}/>`).join('');
 if(stage===3||st.fill==='solid')return solid();
 if(st.fill==='outline')return [...by].map(([c,ds])=>`<path fill="none" stroke="${c}" stroke-width="${n(Math.max(.5,e*u*.05))}" stroke-linejoin="round" d="${ds.join('')}"/>`).join('');
 if(st.fill==='shadow'){const o=Math.max(.6,e*u*.07);return `<path fill="${mix(accent,'#000000',.15)}" transform="translate(${n(o)} ${n(o)})" d="${U.map(d).join('')}"/>`+solid();}
 if(st.fill==='glow')return `<filter id="glow-${uid}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${n(.6+e*u*.09)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><g filter="url(#glow-${uid})">${solid()}</g>`;
 if(st.fill==='overprint'){const blend=luminance(ground)>.3?'multiply':'screen',o=e*u*.07,cyc=[1,3,4,5,6,7];const second=[...by].map(([c,ds])=>{const i=C.indexOf(c),next=C[cyc[(cyc.indexOf(i)+1)%6]]??accent;return `<path fill="${next}" style="mix-blend-mode:${blend}" opacity=".9" transform="translate(${n(o)} ${n(-o*.6)})" d="${ds.join('')}"/>`;}).join('');
  return `<g style="isolation:isolate">${second}${solid(` style="mix-blend-mode:${blend}"`)}</g>`;}
 // gradient: a ground-coloured halo, then each column runs from its colour into the accent.
 const halo=`<path fill="none" stroke="${ground}" stroke-width="${n(Math.max(.8,e*u*.16))}" stroke-linejoin="round" d="${U.map(d).join('')}"/>`;let defs='',body='';
 const lineKey=x=>x.role==='band'||x.ruby||x.head?null:x.line;const groups=new Map();for(const x of U){const k=lineKey(x);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);}
 for(const [k,xs] of groups){if(k===null){const m=new Map();for(const x of xs){const c=C[key(x)];m.set(c,(m.get(c)??'')+d(x));}body+=[...m].map(([c,dd])=>`<path fill="${c}" d="${dd}"/>`).join('');continue;}
  const l=g.lines[k],[x1,y1]=toScreen(g,l.m0,l.cc),[x2,y2]=toScreen(g,l.m1,l.cc);defs+=`<linearGradient id="gr-${uid}-${k}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"><stop offset="0" stop-color="${C[key(xs[0])]}"/><stop offset="1" stop-color="${accent}"/></linearGradient>`;body+=`<path fill="url(#gr-${uid}-${k})" d="${xs.map(d).join('')}"/>`;}
 return defs+halo+body;}

export function render(input={}){const geom=compose(input),st=geom.state,U=units(geom),uid=hash(JSON.stringify(st)).toString(36),stage=st.stage,[ground]=st.colors;
 const parts=[stage===4?groundSVG(geom,uid):rect(0,0,W,H,ground)];
 if(stage===1)parts.push(guides(geom,{labels:true}),rulesSVG(geom));
 if(stage===2)parts.push(guides(geom,{opacity:.2,bands:false}),glyphsSVG(geom,U,2,uid));
 if(stage===3)parts.push(guides(geom,{cells:false}),rulesSVG(geom),glyphsSVG(geom,U,3,uid));
 if(stage===4)parts.push(rulesSVG(geom),glyphsSVG(geom,U,4,uid));
 const first=geom.lines.find(l=>l.role==='title')??geom.lines[0],label=first.raw.replace(/《[^》]*》|｜/g,'');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(label)} — tategaki colour columns, ${st.family}, ${STAGES[stage-1].toLowerCase()}</title>${parts.join('')}</svg>`;
 const count=f=>U.filter(f).length;
 return {svg,state:st,width:W,height:H,features:{family:st.family,face:st.face,stage,columns:geom.lines.length,groups:geom.groups.length,slots:geom.slots.filter(s=>!s.band).length,glyphs:U.length,verticalForms:count(x=>x.alt),sideways:count(x=>x.run&&x.role!=='band'&&!x.head),tcy:geom.lines.reduce((s,l)=>s+l.items.filter(i=>i.t==='y').length,0),ruby:count(x=>x.ruby),header:geom.heads.length,bands:geom.bands.length,unit:n(geom.u),fitted:n(geom.fitU)}};}

// Vertical forms of a face: each character in its horizontal and vertical cell, then kana set in columns.
export function specimen(input={}){const st=resolve({...input,stage:4}),face=st.face,[ground,ink,accent]=st.colors,vf=verticalForms(face),cols=15,cs=56,pad=30,rows=Math.ceil(vf.length/cols),w=pad*2+cols*(cs*1.3),top=pad+28;
 const out=[rect(0,0,w,0,ground)],paths={ink:'',accent:'',grid:''};const cellAt=(x,y)=>`M${n(x)} ${n(y)}h${cs}v${cs}h${-cs}Z`,place=(gl,x,y,s=cs)=>pathD(gl.cmds,[s/1000,0,0,-s/1000,x,y+ASC*s/1000],2);
 const groups=vf.map((ch,i)=>{const x=w-pad-(i%cols+1)*cs*1.3,y=top+Math.floor(i/cols)*(cs*2+34);paths.grid+=cellAt(x,y)+cellAt(x,y+cs+6);return `<g data-glyph="${esc(ch)}"><path d="${place(glyph(face,ch,'h'),x,y)}" fill="${ink}"/><path d="${place(glyph(face,ch,'v'),x,y+cs+6)}" fill="${accent}"/></g>`;});
 // Kana in columns, right to left, ten to a column.
 const kana=[...CHARS.kana],ks=26,ky=top+rows*(cs*2+34)+30,kcols=Math.ceil(kana.length/10);let kd='';
 kana.forEach((ch,i)=>{const col=Math.floor(i/10),x=w-pad-(col+1)*ks*1.25,y=ky+(i%10)*ks;kd+=place(glyph(face,ch,'v'),x,y,ks);});
 const h=ky+10*ks+pad;out[0]=rect(0,0,w,h,ground);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(w)} ${n(h)}"><title>${esc(FACES[face].name)} — vertical forms and kana</title>${out[0]}<path d="${paths.grid}" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width=".6"/>${groups.join('')}<path d="${kd}" fill="${ink}"/></svg>`;}
