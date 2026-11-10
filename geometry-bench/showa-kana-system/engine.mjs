/* Shōwa display kana kit — type system study after 1920s–50s Japanese display
 * lettering (Victrola 1930, Calpis 1932, Obata Roppei 1936, Takashi Kono 1955…).
 * Every glyph is a skeleton of strokes (glyphs.mjs). A construction style turns
 * each stroke into an outline: square bars with axis cuts, wedge-brush strokes
 * tapered by brush role and cut by a chisel nib, square-capped tubes, or stencil
 * bars broken where strokes meet. Weight, wedge contrast, curve, corner radius,
 * slant and width act on the shared skeleton. Text reads left to right, right
 * to left (prewar) or in vertical columns with upright glyphs. New
 * interpretations; nothing is traced from the posters.
 */
import {BASE,VERTICAL,DAKU,HANDAKU,SMALL,MARK_STROKES,GROUPS,LOOKALIKES} from './glyphs.mjs';
export {GROUPS,LOOKALIKES};
export const ENGINE='showa-kana-v1';
export const W=728,H=1030;  // B-series proportion
export const CHARACTERS=GROUPS.map(g=>g[1]).join('');
const SUPPORTED=new Set([...CHARACTERS,' ']);
export const SOURCES=[
 {id:'pgda-20129',title:'Victrola. Portable',date:'1930',family:'victrola'},
 {id:'pgda-19952',title:'Exposition of Japan',date:'1936',family:'expo'},
 {id:'moma-190181',title:'Poster for a book on Industrial Design, volume 2',date:'c.1955',family:'design'},
 {id:'moma-190179',title:'MoMA: Family of Man Exhibition',date:'c.1955',family:'family'},
 {id:'vam-O74444',title:'Nikke',date:'ca. 1935',family:'nikke'},
 {id:'pgda-20125',title:'Calpis',date:'1932',family:'calpis'},
 {id:'pgda-19949',title:'Grand Exposition in Commemoration of the Imperial Coronation',date:'1928',family:'kyoto'},
 {id:'pgda-19792',title:'Read the Workers and Farmers Proletarian Newspaper!',date:'1929',family:'proletarian'},
 {id:'pgda-19969',title:'Ten Commandments',date:'1925',family:'cinema'},
 {id:'pgda-19307',title:'Ishi-no-Hana (The Stone Flower)',date:'undated',family:'hanabi'}
];
// Construction styles: how a stroke ends, how joined ends behave, and the look the editor presets.
export const STYLES=[
 {id:'bar',name:'Square bar',cap:'axis',join:'extend',preset:{contrast:0,curve:0,corner:0,slant:0},note:'Even bars, mitred corners, diagonals cut square to the axis.'},
 {id:'wedge',name:'Wedge brush',cap:'chisel',join:'extend',preset:{contrast:.9,curve:1,corner:.15,slant:.16},note:'Each stroke tapers by its brush role and is cut by a 40° chisel nib.'},
 {id:'tube',name:'Neon tube',cap:'square',join:'extend',preset:{contrast:0,curve:.8,corner:1,slant:0},note:'Even tubes with square ends; corner radius turns them round.'},
 {id:'stencil',name:'Stencil cut',cap:'axis',join:'gap',preset:{contrast:0,curve:0,corner:.1,slant:0},note:'Square bars broken wherever one stroke meets another.'}
];
const iso={contrast:0,curve:0,corner:0,slant:0,width:1,tracking:.06,interlock:0,leading:.2,size:1,angle:-14,arc:1,depth:.06,line:.12,glow:.6};
// Palette roles: ground, ink (letters), shade (shadow, second ink), accent (sun, triangle), accent 2 (band, rays, gradient), info.
export const FAMILIES=[
 {id:'victrola',name:'Gold bars at dusk',after:'Victrola portable, 1930',palette:'Teal dusk / gold / sand',colors:['#173f4a','#efb83a','#0a1d23','#e9c27c','#3f7f7b','#efe2c0'],text:'ビクトロラ',info:'ポータブル/金五十円',
  set:{style:'bar',direction:'rtl',layout:'banner',finish:'shadow',ornament:'burst',ground:'gradient',params:{...iso,weight:17,tracking:.08,interlock:.45,depth:.07}},note:'Even square bars with axis-cut diagonals, read right to left like a prewar shop sign; hard shadows over a setting sun.'},
 {id:'expo',name:'Exposition bars',after:'Exposition of Japan, Obata Roppei, 1936',palette:'Vermilion / cream / soot',colors:['#e1432c','#f6dcaa','#2a1c19','#f6efe0','#1d1716','#f6dcaa'],text:'日本大博覧会',info:'大阪/新聞社',
  set:{style:'bar',direction:'rtl',layout:'banner',finish:'solid',ornament:'flag',ground:'plain',params:{...iso,weight:18,width:1.04,tracking:.02,interlock:.25}},note:'Heavy cream kanji on a soot band, right to left, over vermilion with a cream sun.'},
 {id:'design',name:'Wedge brush',after:'Commercial design book poster, Takashi Kono, c.1955',palette:'Paper / ink / vermilion / green',colors:['#ebe6da','#1f1f1f','#2b6a55','#d8402e','#2b6a55','#2b6a55'],text:'デザイン',info:'スタイル・ブック',
  set:{style:'wedge',direction:'ltr',layout:'tilt',finish:'solid',ornament:'triangle',ground:'plain',params:{...iso,weight:17,contrast:.92,curve:1,corner:.15,slant:.16,tracking:-.04,interlock:.5,angle:-12}},note:'Tapered wedge strokes with a forward slant, rising over a red triangle.'},
 {id:'family',name:'Slanted gold bars',after:'The Family of Man, Takashi Kono, c.1955',palette:'White / olive gold / black / blue',colors:['#f1ede3','#a08b55','#2f6aa0','#1f5f93','#141414','#1f5f93'],text:'ザ・ファミリー/オブ・マン',info:'7月17日-29日',
  set:{style:'bar',direction:'ltr',layout:'tilt',finish:'solid',ornament:'band',ground:'plain',params:{...iso,weight:18,slant:.2,width:.86,tracking:.02,interlock:.3,angle:0}},note:'Condensed, slanted heavy bars with small kana, gold on a black band across the middle.'},
 {id:'nikke',name:'Block kana',after:'Nikke, Okuyama Gihachiro, c.1935',palette:'Magenta / chrome yellow / black',colors:['#b0285a','#f3cf20','#151214','#151214','#2f7a3c','#f4efe6'],text:'ニッケ',info:'オーバー',
  set:{style:'bar',direction:'ltr',layout:'fill',finish:'solid',ornament:'sun',ground:'plain',params:{...iso,weight:23,width:1.08,tracking:.02,interlock:.3,leading:.1}},note:'Huge square bars at full weight filling the sheet; a black disc behind.'},
 {id:'calpis',name:'Deco inline',after:'Calpis, 1932',palette:'Navy / yellow / grey / red',colors:['#1d2246','#f4d23c','#8f909b','#c9302c','#f3efe6','#f0e6d6'],text:'カルピス',info:'ハツコイノ/アジ',
  set:{style:'bar',direction:'rtl',layout:'banner',finish:'inline',ornament:'sun',ground:'plain',params:{...iso,weight:20,line:.16,tracking:.04,interlock:.35}},note:'Wide bars split by an inline, right to left, with a red sun.'},
 {id:'kyoto',name:'Arched stencil',after:'Coronation exposition, Kyoto, Nakashima Gorou, 1928',palette:'Cream / black / red / yellow',colors:['#e8dcc3','#1b1a20','#c8372c','#d8402e','#e6b63a','#c8372c'],text:'京都大博覧会',info:'一九二八年',
  set:{style:'stencil',direction:'rtl',layout:'arc',finish:'solid',ornament:'burst',ground:'plain',params:{...iso,weight:17,arc:1}},note:'Stencil-cut kanji around an arch, right to left, over a red sun and yellow rays.'},
 {id:'proletarian',name:'Red columns',after:'Proletarian newspaper poster, Yanase Masamu, 1929',palette:'Cream / red / black',colors:['#ebe2cc','#c8372e','#1c1a1a','#1c1a1a','#c8372e','#1c1a1a'],text:'新聞ヲ/ヨメ!',info:'東京/新聞社',
  set:{style:'wedge',direction:'ttb',layout:'fill',finish:'solid',ornament:'none',ground:'plain',params:{...iso,weight:17,contrast:.7,curve:.8,corner:.1,tracking:.04,leading:.12}},note:'Brushy red wedges in vertical columns, read top to bottom, columns right to left; no ornament.'},
 {id:'cinema',name:'Gold stencil',after:'Ten Commandments, Yamada Shinkichi, 1925',palette:'Slate / amber / red',colors:['#2a2e38','#eaa53a','#c0392b','#c0392b','#1d2028','#eaa53a'],text:'映画/大会',info:'十二月/一日',
  set:{style:'stencil',direction:'rtl',layout:'grid',finish:'shadow',ornament:'triangle',ground:'plain',params:{...iso,weight:18,depth:.035,tracking:.04}},note:'Amber stencil kanji in a giant grid with red shadows on slate, right to left.'},
 {id:'hanabi',name:'Sunburst wedges',after:'Ishi-no-Hana, Shigemi Hijikata',palette:'Teal / red / yellow / ink rays',colors:['#5fb2a3','#d9342b','#f3d23a','#f6efe0','#1f2b2b','#f6efe0'],text:'ハナビ/大会',info:'七月/二十日',
  set:{style:'wedge',direction:'ltr',layout:'fill',finish:'shadow',ornament:'rays',ground:'plain',params:{...iso,weight:18,contrast:.8,curve:1,corner:.2,slant:.06,depth:.05,leading:.15}},note:'Red wedge kana with yellow shadows over a dark sunburst.'},
 {id:'neon',name:'Neon tubes',after:'new — electro',palette:'Night / magenta / cyan / violet',colors:['#07060b','#ff2bd6','#19f0ff','#7a5cff','#3a1d6e','#19f0ff'],text:'ネオン/トーキョー',info:'2026/NIGHT LINE',
  set:{style:'tube',direction:'ltr',layout:'fill',finish:'neon',ornament:'sun',ground:'gradient',params:{...iso,weight:10,curve:.8,corner:1,tracking:.14,line:.14,glow:.7,leading:.3}},note:'Round tubes glowing magenta with cyan cores on near-black; a violet ring rises behind.'},
 {id:'riso',name:'Fluoro overprint',after:'new — risograph',palette:'Paper / fluoro pink / blue / yellow',colors:['#f3efe6','#ff4f9a','#2f58c8','#ffd400','#2f58c8','#2f58c8'],text:'ポスター/ラボ',info:'2026/TOKYO',
  set:{style:'stencil',direction:'ttb',layout:'fill',finish:'riso',ornament:'sun',ground:'plain',params:{...iso,weight:18,depth:.04,tracking:.02}},note:'Stencil columns printed twice, pink over blue, slightly out of register.'},
 {id:'acid',name:'Acid outline',after:'new — club flyer',palette:'Acid lime / black / signal red',colors:['#d7ff3a','#111111','#ff3b1f','#111111','#111111','#111111'],text:'デンキ/ナイト',info:'OPEN 22:00',
  set:{style:'wedge',direction:'ltr',layout:'tilt',finish:'outline',ornament:'band',ground:'plain',params:{...iso,weight:20,contrast:.85,curve:1,corner:.2,slant:.22,line:.11,angle:-18,interlock:.4,tracking:-.02}},note:'Hollow wedge kana on a black band tilted across acid lime.'}
];
export const CONTROLS=[
 {key:'weight',label:'Weight',group:'letters',min:5,max:26,step:.5,value:16},
 {key:'contrast',label:'Wedge contrast',group:'letters',min:0,max:1,step:.01,value:0},
 {key:'curve',label:'Curve',group:'letters',min:0,max:1,step:.01,value:0},
 {key:'corner',label:'Corner radius',group:'letters',min:0,max:1,step:.01,value:0},
 {key:'slant',label:'Slant',group:'letters',min:-.3,max:.5,step:.01,value:0},
 {key:'width',label:'Width',group:'letters',min:.6,max:1.4,step:.01,value:1},
 {key:'tracking',label:'Tracking',group:'spacing',min:-.3,max:.8,step:.01,value:.06},
 {key:'interlock',label:'Interlock',group:'spacing',min:0,max:1,step:.01,value:0,uses:{layout:['banner','fill','grid','tilt']}},
 {key:'leading',label:'Line gap',group:'spacing',min:-.1,max:1,step:.01,value:.2},
 {key:'size',label:'Headline size',group:'layout',min:.4,max:1,step:.01,value:1},
 {key:'angle',label:'Tilt angle',group:'layout',min:-40,max:40,step:.5,value:-14,uses:{layout:['tilt']}},
 {key:'arc',label:'Arch bend',group:'layout',min:.3,max:1.6,step:.01,value:1,uses:{layout:['arc']}},
 {key:'depth',label:'Shadow offset',group:'surface',min:0,max:.3,step:.005,value:.06,uses:{finish:['shadow','riso']}},
 {key:'line',label:'Line width',group:'surface',min:.04,max:.4,step:.01,value:.12,uses:{finish:['inline','outline','neon']}},
 {key:'glow',label:'Glow',group:'surface',min:0,max:1,step:.01,value:.6,uses:{finish:['neon']}}
];
export const OPTIONS={style:STYLES.map(s=>s.id),direction:['ltr','rtl','ttb'],layout:['banner','fill','grid','arc','tilt'],finish:['solid','shadow','inline','outline','neon','riso'],ornament:['none','sun','rays','burst','triangle','band','flag'],ground:['plain','gradient']};
export const controlActive=(c,state)=>!c.uses||Object.entries(c.uses).every(([k,v])=>v.includes(state[k]));

// ——— Skeletons ———
// Brush roles: start and end width for the wedge style (contrast blends toward them).
const KIND={'-':{a:.72,b:1.12,t:'bar'},'|':{a:1.1,b:.88,t:'bar'},'=':{a:1,b:1,t:'bar'},'/':{a:1.15,b:.06,t:'sweep'},r:{a:1.2,b:.1,t:'sweep'},'\\':{a:.5,b:1.28,t:'press'},'.':{a:.42,b:1.3,t:'dot'},k:{a:.85,b:1.05,t:'frame'},j:{a:.85,b:.06,t:'frame'},h:{a:1.08,b:.3,t:'hook'},o:{a:1,b:1,t:'ring'}};
export const PRIMITIVES=['bar','sweep','press','dot','frame','hook','ring'];
export const primitiveOf=kind=>KIND[kind].t;
function parse(src,mark=false){return src.split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const [head,...nums]=s.split(/\s+/),m=/^([-|=/r\\.kjho])(?:@([\d.]+))?$/.exec(head);
 if(!m||nums.length<4||nums.length%2)throw new Error('Bad stroke: '+s);const pts=[];for(let i=0;i<nums.length;i+=2)pts.push([+nums[i].replace('~',''),+nums[i+1],nums[i][0]==='~']);return {kind:m[1],w:m[2]?+m[2]:1,pts,closed:m[1]==='o',mark};});}
const mapStroke=(s,f,ws=1)=>({...s,w:s.w*ws,pts:s.pts.map(([x,y,sm])=>[...f(x,y),sm])});
// Smooth points become quadratic corners whose reach is the Curve control: 0 keeps the corner, 1 runs midpoint to midpoint.
function sample(pts,closed,curve){const n=pts.length,out=[];const push=(x,y,corner)=>{const l=out[out.length-1];if(l&&Math.abs(l.x-x)<1e-7&&Math.abs(l.y-y)<1e-7){l.corner=l.corner||corner;return;}out.push({x,y,corner});};
 for(let i=0;i<n;i++){const [x,y,sm]=pts[i],inner=closed||(i>0&&i<n-1);if(!(sm&&curve>0&&inner)){push(x,y,inner);continue;}
  const a=pts[(i-1+n)%n],b=pts[(i+1)%n],h=curve/2,s=[x+(a[0]-x)*h,y+(a[1]-y)*h],e=[x+(b[0]-x)*h,y+(b[1]-y)*h];
  for(let k=0;k<=12;k++){const t=k/12,u=1-t;push(u*u*s[0]+2*u*t*x+t*t*e[0],u*u*s[1]+2*u*t*y+t*t*e[1],false);}}
 if(closed&&out.length>1){const f=out[0],l=out[out.length-1];if(Math.abs(f.x-l.x)<1e-7&&Math.abs(f.y-l.y)<1e-7)out.pop();}return out;}
function distSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
const distLine=(p,pl,closed)=>{let d=Infinity;for(let i=0;i<pl.length-(closed?0:1);i++)d=Math.min(d,distSeg(p,pl[i],pl[(i+1)%pl.length]));return d;};
// An end that lands on another stroke is a join: 'L' meets another end near square (bars
// extend to fill the corner), 'T' lands on a stroke, 'A' meets an end at a sharp or wide angle.
// Joined ends are cut flat; stencils break short of every join.
function joins(def){const body=def.strokes.filter(s=>!s.mark),paths=body.map(s=>[s.pts.map(p=>[p[0],p[1]]),sample(s.pts,s.closed,1).map(p=>[p.x,p.y])]);
 for(const s of def.strokes){s.join=[null,null];s.flat=[true,true];if(s.closed||s.mark)continue;const m=s.pts.length;
  [0,1].forEach(k=>{const e=s.pts[k?m-1:0],nb=s.pts[k?m-2:1],d=unit(e[0]-nb[0],e[1]-nb[1]);
   body.forEach((o,j)=>{if(o===s||!paths[j].some(pl=>distLine(e,pl,o.closed)<4))return;let type='T';
    let flat=true;if(!o.closed)for(const [q,q2] of [[o.pts[0],o.pts[1]],[o.pts[o.pts.length-1],o.pts[o.pts.length-2]]])if(Math.hypot(q[0]-e[0],q[1]-e[1])<4){const od=unit(q2[0]-q[0],q2[1]-q[1]);type=Math.abs(d[0]*od[0]+d[1]*od[1])<.5?'L':'A';flat=Math.abs(d[0])>=Math.abs(od[0]);}
    if(!s.join[k]||type==='L'){s.join[k]=type;s.flat[k]=flat;}});});}}
// The tightest gap between parallel strokes, per direction (h, v, diagonal). Dense glyphs (kanji) lighten
// strokes running in that direction so counters keep at least 30% of the gap, as heavy gothics thin stacked bars.
function gapOf(def){const segs=[];def.strokes.forEach((s,si)=>{if(s.mark)return;const p=s.pts,m=p.length;for(let i=0;i<m-(s.closed?0:1);i++)segs.push({si,i,m,closed:s.closed,a:p[i],b:p[(i+1)%m]});});const gap={h:Infinity,v:Infinity,d:Infinity};
 for(let x=0;x<segs.length;x++)for(let y=x+1;y<segs.length;y++){const A=segs[x],B=segs[y];if(A.si===B.si&&(Math.abs(A.i-B.i)<=1||(A.closed&&Math.abs(A.i-B.i)===A.m-1)))continue;
  const la=Math.hypot(A.b[0]-A.a[0],A.b[1]-A.a[1]),da=unit(A.b[0]-A.a[0],A.b[1]-A.a[1]),db=unit(B.b[0]-B.a[0],B.b[1]-B.a[1]);if(Math.abs(da[0]*db[1]-da[1]*db[0])>.21)continue;
  const t0=(B.a[0]-A.a[0])*da[0]+(B.a[1]-A.a[1])*da[1],t1=(B.b[0]-A.a[0])*da[0]+(B.b[1]-A.a[1])*da[1];if(Math.min(la,Math.max(t0,t1))-Math.max(0,Math.min(t0,t1))<6)continue;
  const mx=(B.a[0]+B.b[0])/2-A.a[0],my=(B.a[1]+B.b[1])/2-A.a[1],dist=Math.abs(mx*da[1]-my*da[0]),a=Math.atan2(Math.abs(da[1]),Math.abs(da[0]))*180/Math.PI,c=a<22.5?'h':a>67.5?'v':'d';if(dist>2)gap[c]=Math.min(gap[c],dist);}
 return gap;}
const DEFS=new Map();
export function glyphDef(ch,vertical=false){const key=ch+(vertical?'|v':'');if(DEFS.has(key))return DEFS.get(key);let def;
 if(ch===' ')def={adv:50,strokes:[]};
 else if(vertical&&VERTICAL[ch])def={adv:100,strokes:parse(VERTICAL[ch][1])};
 else if(BASE[ch])def={adv:BASE[ch][0],strokes:parse(BASE[ch][1])};
 else if(DAKU[ch]||HANDAKU[ch]){const b=glyphDef(DAKU[ch]??HANDAKU[ch]);def={adv:100,strokes:[...b.strokes.map(s=>mapStroke(s,(x,y)=>[x*.86,12+y*.88])),...parse(MARK_STROKES[DAKU[ch]?'daku':'handaku'],true)]};}
 else if(SMALL[ch]){const b=glyphDef(SMALL[ch]),[ox,oy]=vertical?[28,4]:[10,30];def={adv:100,small:true,strokes:b.strokes.map(s=>mapStroke(s,(x,y)=>[ox+x*.66,oy+y*.66],.8))};}
 else throw new Error(`No glyph for “${ch}”.`);
 def.ch=ch;def.latin=def.adv!==100&&ch!==' ';def.strokes=def.strokes.map((s,i)=>({...s,i}));joins(def);def.gap=gapOf(def);def.wbase=Math.max(0,...def.strokes.filter(s=>!s.mark).map(s=>s.w));DEFS.set(key,def);return def;}

// ——— Outlines ———
const NIB=[Math.cos(-40*Math.PI/180),Math.sin(-40*Math.PI/180)];
const unit=(dx,dy)=>{const l=Math.hypot(dx,dy)||1;return [dx/l,dy/l];};
// Extend (+) or trim (−) a sampled centreline at one end.
function reach(cl,k,amount){if(Math.abs(amount)<1e-9||cl.length<2)return cl;let p=k?cl.slice().reverse():cl.slice();
 if(amount>0){const [a,b]=p,d=unit(a.x-b.x,a.y-b.y);p.unshift({...a,x:a.x+d[0]*amount,y:a.y+d[1]*amount,corner:false});}
 else{let left=-amount;while(p.length>2){const a=p[0],b=p[1],l=Math.hypot(b.x-a.x,b.y-a.y);if(l>left){const t=left/l;p[0]={...a,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,m:a.m+(b.m-a.m)*t};break;}left-=l;p.shift();p[0]={...p[0],corner:false};}}
 return k?p.reverse():p;}
// Variable-width offset with mitred (bevelled past 2.6×) corners and a cap style per end.
function offset(cl,hw,closed,caps){const n=cl.length,L=[],R=[],dir=(i,j)=>unit(cl[j].x-cl[i].x,cl[j].y-cl[i].y);
 for(let i=0;i<n;i++){const p=cl[i],h=hw*p.m,ip=closed?(i-1+n)%n:i-1,inx=closed?(i+1)%n:i+1,din=ip>=0?dir(ip,i):null,dout=inx<n?dir(i,inx):null,d0=din??dout,d1=dout??din;
  const n0=[-d0[1],d0[0]],n1=[-d1[1],d1[0]];let [mx,my]=[n0[0]+n1[0],n0[1]+n1[1]];const ml=Math.hypot(mx,my);if(ml<1e-6)[mx,my]=n1;else{mx/=ml;my/=ml;}
  const sc=1/Math.max(mx*n1[0]+my*n1[1],.2);
  if(p.corner&&sc>2.6){L.push([p.x+n0[0]*h,p.y+n0[1]*h],[p.x+n1[0]*h,p.y+n1[1]*h]);R.push([p.x-n0[0]*h,p.y-n0[1]*h],[p.x-n1[0]*h,p.y-n1[1]*h]);}
  else{L.push([p.x+mx*h*sc,p.y+my*h*sc]);R.push([p.x-mx*h*sc,p.y-my*h*sc]);}}
 if(closed)return [L,R.reverse()];
 const end=k=>{const i=k?n-1:0,p=cl[i],h=hw*p.m,d=k?dir(n-2,n-1):dir(0,1),nn=[-d[1],d[0]],cap=caps[k];
  const cd=cap==='axis'?(Math.abs(d[0])>=Math.abs(d[1])?[0,1]:[1,0]):cap==='chisel'?NIB:nn,den=d[0]*cd[1]-d[1]*cd[0];
  return [1,-1].map(s=>{const o=[p.x+s*nn[0]*h,p.y+s*nn[1]*h];if(Math.abs(den)<.3)return o;const t=Math.max(-1.6*h,Math.min(1.6*h,-((o[0]-p.x)*cd[1]-(o[1]-p.y)*cd[0])/den));return [o[0]+d[0]*t,o[1]+d[1]*t];});};
 [L[0],R[0]]=end(0);[L[L.length-1],R[R.length-1]]=end(1);return [[...L,...R.reverse()]];}
// Rounds every turn sharper than 25° with a quadratic of radius r.
function roundPoly(poly,r){if(r<.05)return poly;const out=[],n=poly.length;
 for(let i=0;i<n;i++){const a=poly[(i-1+n)%n],v=poly[i],b=poly[(i+1)%n],la=Math.hypot(a[0]-v[0],a[1]-v[1]),lb=Math.hypot(b[0]-v[0],b[1]-v[1]);
  if(la<1e-6||lb<1e-6){out.push(v);continue;}const ua=[(a[0]-v[0])/la,(a[1]-v[1])/la],ub=[(b[0]-v[0])/lb,(b[1]-v[1])/lb],turn=Math.PI-Math.acos(Math.max(-1,Math.min(1,ua[0]*ub[0]+ua[1]*ub[1])));
  if(turn<.44){out.push(v);continue;}const c=Math.min(r,la*.48,lb*.48),s=[v[0]+ua[0]*c,v[1]+ua[1]*c],e=[v[0]+ub[0]*c,v[1]+ub[1]*c];
  for(let k=0;k<=5;k++){const t=k/5,u=1-t;out.push([u*u*s[0]+2*u*t*v[0]+t*t*e[0],u*u*s[1]+2*u*t*v[1]+t*t*e[1]]);}}return out;}
const OUT=new Map();
// One glyph in its own units (x from 0 to advance × width, y 0–100): every stroke's outline, centreline and kit role.
export function glyphOutline(ch,P,style='bar',vertical=false){const key=[ch,vertical,style,P.weight,P.contrast,P.curve,P.corner,P.slant,P.width].join('|');if(OUT.has(key))return OUT.get(key);
 const def=glyphDef(ch,vertical),S=STYLES.find(s=>s.id===style)??STYLES[0],tf=(x,y)=>[x*P.width+P.slant*(50-y),y],strokes=[],FIT=Object.fromEntries(['h','v','d'].map(c=>[c,Math.max(.5,Math.min(1,def.gap[c]*.7/(P.weight*(def.wbase||1))))]));
 for(const s of def.strokes){const K=KIND[s.kind],hw=P.weight/2*s.w,pts=s.pts.map(([x,y,sm])=>[...tf(x,y),sm]);let cl=sample(pts,s.closed,P.curve);
  // Brush profile: a single run tapers start→end; a cornered stroke tapers only its first and last runs.
  const Ls=[0];for(let i=1;i<cl.length;i++)Ls.push(Ls[i-1]+Math.hypot(cl[i].x-cl[i-1].x,cl[i].y-cl[i-1].y));
  const cuts=[0,...cl.map((p,i)=>p.corner&&i>0&&i<cl.length-1?i:-1).filter(i=>i>0),cl.length-1];
  for(let q=0;q<cuts.length-1;q++){const i0=cuts[q],i1=cuts[q+1],len=Ls[i1]-Ls[i0]||1;for(let i=i0;i<=i1;i++){const t=(Ls[i]-Ls[i0])/len,single=cuts.length===2;
   const m=s.closed?1:single?K.a+(K.b-K.a)*t:q===0?K.a+(1-K.a)*t:q===cuts.length-2?1+(K.b-1)*t:1;if(i===i0&&q>0)continue;cl[i]={...cl[i],m:1+P.contrast*(m-1)};}}
  // Direction fit: 0° takes the horizontal fit, 45° the diagonal, 90° the vertical, linear between.
  if(!s.mark)cl=cl.map((p,i)=>{const a=cl[Math.max(0,i-1)],b=cl[Math.min(cl.length-1,i+1)],deg=Math.atan2(Math.abs(b.y-a.y),Math.abs(b.x-a.x))*180/Math.PI,f=deg<=45?FIT.h+(FIT.d-FIT.h)*deg/45:FIT.d+(FIT.v-FIT.d)*(deg-45)/45;return {...p,m:p.m*f};});
  const line=cl.map(p=>[p.x,p.y]),total=Ls[Ls.length-1],short=total<hw*2,free=S.cap==='square'||short?'butt':S.cap,caps=[0,1].map(k=>s.join[k]?'butt':free);
  // Very short strokes (dots) stretch into a square as wide as the stroke.
  if(!s.closed&&short&&!s.join[0]&&!s.join[1]){const amt=Math.max(0,(hw*1.9-total)/2);cl=reach(reach(cl,0,amt),1,amt);}
  else if(!s.closed)[0,1].forEach(k=>{const m=cl[k?cl.length-1:0].m,J=s.join[k];
   // Stencils break where a stroke ends on another; at a corner only the flatter stroke breaks, so boxes keep their shape.
   const amt=S.join==='gap'&&J&&!(J==='L'&&!s.flat[k])?-Math.min(total*.4,hw*1.05+P.weight*.32):(J==='L'||(!J&&S.cap==='square')?hw*m:0);cl=reach(cl,k,amt);});
  const polys=offset(cl,hw,s.closed,caps).map(p=>roundPoly(p,P.corner*hw*1.15));
  strokes.push({kind:s.kind,type:K.t,mark:s.mark,closed:s.closed,polys,line,hw,join:s.join,nodes:pts.map(([x,y,sm])=>[x,y,sm]),ms:[cl[0].m,cl[cl.length-1].m]});}
 const all=strokes.flatMap(s=>s.polys),xs=all.flatMap(p=>p.map(q=>q[0])),ys=all.flatMap(p=>p.map(q=>q[1]));
 const out={ch,def,adv:def.adv*P.width,strokes,ink:all.length?[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]:null,bands:{h:bands(all,false),v:bands(all,true)}};
 if(OUT.size>4000)OUT.clear();OUT.set(key,out);return out;}
// Ink profile in 32 bands across the line, for interlocking spacing.
const BANDS=32,B0=-40,B1=140;
function bands(polys,vertical){const mn=Array(BANDS).fill(Infinity),mx=Array(BANDS).fill(-Infinity),st=(B1-B0)/BANDS;
 for(const poly of polys)for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],k=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
  for(let j=0;j<=k;j++){const x=a[0]+(b[0]-a[0])*j/k,y=a[1]+(b[1]-a[1])*j/k,[u,v]=vertical?[y,x]:[x,y],bi=Math.floor((v-B0)/st);if(bi<0||bi>=BANDS)continue;if(u<mn[bi])mn[bi]=u;if(u>mx[bi])mx[bi]=u;}}return {mn,mx};}

// ——— Text ———
const ROMAJI={a:'ア',i:'イ',u:'ウ',e:'エ',o:'オ',ka:'カ',ki:'キ',ku:'ク',ke:'ケ',ko:'コ',sa:'サ',shi:'シ',si:'シ',su:'ス',se:'セ',so:'ソ',ta:'タ',chi:'チ',ti:'チ',tsu:'ツ',tu:'ツ',te:'テ',to:'ト',na:'ナ',ni:'ニ',nu:'ヌ',ne:'ネ',no:'ノ',ha:'ハ',hi:'ヒ',fu:'フ',hu:'フ',he:'ヘ',ho:'ホ',ma:'マ',mi:'ミ',mu:'ム',me:'メ',mo:'モ',ya:'ヤ',yu:'ユ',yo:'ヨ',ra:'ラ',ri:'リ',ru:'ル',re:'レ',ro:'ロ',wa:'ワ',wo:'ヲ',
 ga:'ガ',gi:'ギ',gu:'グ',ge:'ゲ',go:'ゴ',za:'ザ',ji:'ジ',zi:'ジ',zu:'ズ',ze:'ゼ',zo:'ゾ',da:'ダ',di:'ヂ',du:'ヅ',de:'デ',do:'ド',ba:'バ',bi:'ビ',bu:'ブ',be:'ベ',bo:'ボ',pa:'パ',pi:'ピ',pu:'プ',pe:'ペ',po:'ポ',vu:'ヴ',va:'ヴァ',vi:'ヴィ',ve:'ヴェ',vo:'ヴォ',fa:'ファ',fi:'フィ',fe:'フェ',fo:'フォ',she:'シェ',je:'ジェ',che:'チェ',wi:'ウィ',we:'ウェ',ye:'イェ'};
for(const [c,k] of [['ky','キ'],['sh','シ'],['ch','チ'],['ny','ニ'],['hy','ヒ'],['my','ミ'],['ry','リ'],['gy','ギ'],['j','ジ'],['by','ビ'],['py','ピ']])for(const [v,s] of [['a','ャ'],['u','ュ'],['o','ョ']])ROMAJI[c+v]=k+s;
function romajiWord(word){const w=word.toLowerCase().replace(/l/g,'r');let out='',i=0;
 while(i<w.length){const c=w[i];if(c==='-'){out+='ー';i++;continue;}if(c==="'"){i++;continue;}
  if(c==='n'&&(i+1>=w.length||!/[aiueoy]/.test(w[i+1]))){out+='ン';i++;continue;}
  if(/[bcdfghjkmpqrstvwz]/.test(c)&&(w[i+1]===c||(c==='t'&&w[i+1]==='c'))){out+='ッ';i++;continue;}
  const hit=[3,2,1].map(k=>w.slice(i,i+k)).find(s=>ROMAJI[s]);if(!hit)throw new Error(`Can’t read “${word}” as romaji.`);out+=ROMAJI[hit];i+=hit.length;}return out;}
export function romajiToKana(t){return t.replace(/[āīūēō]/gi,m=>m.normalize('NFD')[0]+'-').replace(/[A-Za-z'][A-Za-z'-]*/g,romajiWord);}
// Text input: katakana (hiragana and half-width kana convert), the kanji set, 0–9, A–Z, marks; '/' breaks a line.
export function normalizeText(input,{fallback,romaji=false,maxRows=4,max=32}={}){
 let t=[...String(input??'').normalize('NFKC').replace(/\r?\n/g,'/')].map(ch=>{const c=ch.codePointAt(0);return c>=0x3041&&c<=0x3096?String.fromCodePoint(c+0x60):ch;}).join('');
 t=t.replace(/[‘’`´]/g,"'").replace(/[–‐]/g,'-').replace(/[—―─〜～]/g,'ー').replace(/[･·•]/g,'・').replace(/\s*\/\s*/g,'/').replace(/[ \t]+/g,' ').trim();
 if(romaji)t=romajiToKana(t);
 t=[...t].map(ch=>/[A-Za-zÀ-ɏ]/.test(ch)?ch.normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase():ch).join('');
 if(!t.replace(/[ /]/g,'')){if(fallback!==undefined)return fallback;throw new Error('Type at least one character.');}
 const bad=[...new Set([...t].filter(ch=>ch!=='/'&&!SUPPORTED.has(ch)))];
 if(bad.length)throw new Error(`Not in the kit: ${bad.slice(0,6).map(c=>'“'+c+'”').join(' ')}${bad.length>6?' …':''}. Use katakana (hiragana converts), ー・、。, the listed kanji, 0–9, A–Z and . , : - ! ? ' — / starts a new line.`);
 const rows=t.split('/').map(r=>r.trim());if(rows.length>maxRows)throw new Error(`Use at most ${maxRows} lines.`);if(rows.some(r=>!r))throw new Error('Lines cannot be empty.');
 if(rows.join('').replace(/ /g,'').length>max)throw new Error(`Use at most ${max} characters.`);return rows.join('/');}

const clampNum=(v,c)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.min(c.max,Math.max(c.min,+v)):c.value;
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS){const d=set.params[c.key]??c.value;params[c.key]=clampNum(input.params?.[c.key]??d,{...c,value:d});}
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],romaji=input.romaji===true;let text,info;
 try{text=normalizeText(input.text,{fallback:family.text,romaji});}catch{text=family.text;}
 try{info=input.info===''?'':normalizeText(input.info,{fallback:family.info,romaji,maxRows:3,max:40});}catch{info=family.info;}
 const colors=Array.isArray(input.colors)&&input.colors.length===6&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 return {engine:ENGINE,family:family.id,text,info,romaji,stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,
  style:pick('style'),direction:pick('direction'),layout:pick('layout'),finish:pick('finish'),ornament:pick('ornament'),ground:pick('ground'),params,colors};}

// ——— Setting ———
// Lines become rows (left to right or right to left) or columns (top to bottom, columns right to left).
// Spacing blends the em box (interlock 0) with the ink profile of each neighbour pair (interlock 1);
// the box widens where heavy strokes overrun the em, so neighbours never fuse before tracking.
export function setText(text,state,weightScale=1){const P={...state.params,weight:state.params.weight*weightScale},vertical=state.direction==='ttb',rtl=state.direction==='rtl',glyphs=[];
 const tr=P.tracking*100,fitGap=P.weight*.7,pitch=(vertical?100*P.width:100)+P.leading*100;let order=0;
 text.split('/').forEach((line,r)=>{const chars=[...line].map(ch=>({ch,order:ch===' '?-1:order++}));if(rtl)chars.reverse();let pos=0,prev=null,space=0;const row=[];
  for(const {ch,order:o} of chars){if(ch===' '){space+=50*(vertical?1:P.width);continue;}const g=glyphOutline(ch,P,state.style,vertical),cell=vertical?100:g.adv;
   if(prev){const span=prev.ink&&g.ink?(vertical?prev.ink[3]-g.ink[1]:prev.ink[2]-g.ink[0])+P.weight*.35:0,box=Math.max(vertical?100:prev.adv,span)+tr+space;let fit=box;const A=prev.bands[vertical?'v':'h'],B=g.bands[vertical?'v':'h'];let need=-Infinity;
    for(let b=0;b<BANDS;b++)if(A.mx[b]>-Infinity&&B.mn[b]<Infinity)need=Math.max(need,A.mx[b]-B.mn[b]);
    if(need===-Infinity&&prev.ink&&g.ink)need=vertical?prev.ink[3]-g.ink[1]:prev.ink[2]-g.ink[0];if(need>-Infinity)fit=need+fitGap+tr+space;pos+=box+(fit-box)*P.interlock;}
   row.push({ch,order:o,g,along:pos,cell});prev=g;space=0;}
  const inks=row.filter(e=>e.g.ink),lo=Math.min(...inks.map(e=>e.along+(vertical?e.g.ink[1]:e.g.ink[0]))),hi=Math.max(...inks.map(e=>e.along+(vertical?e.g.ink[3]:e.g.ink[2])));
  for(const e of row){const shift=vertical?-Math.min(0,lo):-(lo+hi)/2;
   if(vertical)glyphs.push({...e,row:r,x:-r*pitch+(100-e.g.adv/P.width)*P.width/2,y:e.along+shift});else glyphs.push({...e,row:r,x:e.along+shift,y:r*pitch});}});
 glyphs.sort((a,b)=>a.order-b.order);
 const boxes=glyphs.filter(e=>e.g.ink).map(e=>[e.x+e.g.ink[0],e.y+e.g.ink[1],e.x+e.g.ink[2],e.y+e.g.ink[3]]);
 return {glyphs,vertical,rtl,pitch,bbox:boxes.length?[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))]:[0,0,1,1]};}

// ——— Affine maps [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f ———
const mul=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
const T=(x,y)=>[1,0,0,1,x,y],Sc=k=>[k,0,0,k,0,0],Rot=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,s,-s,c,0,0];};
const ap=(M,[x,y])=>[M[0]*x+M[2]*y+M[4],M[1]*x+M[3]*y+M[5]];
export const n=v=>Math.round(v*100)/100;
// Fits a set block into a box, optionally rotated, and aligns it (ax, ay: 0 start, .5 centre, 1 end); returns a map per glyph.
function fitBlock(block,box,{rot=0,size=1,maxK=Infinity,ax=.5,ay=.5}={}){const [x0,y0,x1,y1]=block.bbox,cx=(x0+x1)/2,cy=(y0+y1)/2,c=Math.abs(Math.cos(rot)),s=Math.abs(Math.sin(rot)),w=x1-x0,h=y1-y0,bw=w*c+h*s,bh=w*s+h*c;
 const k=Math.min((box[2]-box[0])/Math.max(1,bw),(box[3]-box[1])/Math.max(1,bh),maxK)*size,px=box[0]+(box[2]-box[0]-bw*k)*ax+bw*k/2,py=box[1]+(box[3]-box[1]-bh*k)*ay+bh*k/2,M=mul(mul(mul(T(px,py),Rot(rot)),Sc(k)),T(-cx,-cy));
 return {k,M,maps:block.glyphs.map(e=>mul(M,T(e.x,e.y)))};}
// Arch: rows run over the top of concentric arcs (glyphs turn with the arc); columns run down a
// right-hand arc with glyphs upright. Glyphs are placed by advance along the arc (advance + tracking,
// never closer than a 4-unit gap at the inner edge), so neighbouring em cells sit in disjoint wedges
// and cannot touch. The sweep grows with the word (11° per glyph step × Arch bend) but never passes
// ±ARC_TILT; the radius follows from the sweep, so short words take a flatter, larger arc.
export const ARC_TILT=33;
function arcBlock(block,P,top,bottom,left){const vertical=block.vertical,gap=Math.max(4,P.tracking*100),cross=vertical?100*P.width:100,pitch=Math.max(block.pitch,cross+12),runs=[];
 for(const e of block.glyphs)(runs[e.row]??=[]).push(e);
 const along=e=>vertical?e.y+50:e.x+e.g.adv/2,ext=e=>vertical?100:e.g.adv;
 const rows=runs.filter(Boolean).map(run=>{run.sort((a,b)=>along(a)-along(b));const s=[0];for(let i=1;i<run.length;i++){const a=run[i-1],b=run[i];s.push(s[i-1]+Math.max(along(b)-along(a),(ext(a)+ext(b))/2+gap));}const L=s[s.length-1];return {run,s:s.map(v=>v-L/2),L};});
 const Lmax=Math.max(0,...rows.map(r=>r.L)),sweep=Math.max(1e-3,Math.min(2*ARC_TILT,P.arc*11*Lmax/100)*Math.PI/180),t=sweep/2,maps=new Map(),tilts=new Map();
 let k,r0,C;
 if(vertical){k=Math.min((H-130)/(Lmax+100),(W-230)/(rows.length*pitch+40),1.6)*P.size;let ri=[];
  // Columns go right to left; a column that would touch an earlier one (a bent end beside an upright middle)
  // moves to a smaller radius just far enough to clear it, and the size shrinks if the columns reach the information.
  for(let pass=0;pass<6;pass++){r0=Math.min(6000,Math.max(...rows.map((r,i)=>r.L/2*k/Math.sin(t)+i*pitch*k)));C=[W-46-cross*k/2-r0,H/2];ri=[];const done=[];let shift=0,lo=Infinity;
   rows.forEach((row,i)=>{let r=r0-i*pitch*k-shift;const at=()=>row.s.map(sj=>[C[0]+Math.sqrt(Math.max(0,r*r-sj*k*sj*k)),C[1]+sj*k]);let pts=at(),need=0;
    for(const q of done)for(const a of pts)if(Math.abs(a[1]-q[1])<100*k+1e-6)need=Math.max(need,a[0]-q[0]+cross*k+4*k);
    if(need>0){shift+=need;r-=need;pts=at();}ri.push(r);done.push(...pts);lo=Math.min(lo,...pts.map(p=>p[0]-cross*k/2));});
   if(lo>=left||pass===5)break;k*=Math.max(.6,(W-46-left)/(W-46-lo));}
  rows.forEach((row,i)=>row.run.forEach((e,j)=>{const d=row.s[j]*k;maps.set(e,mul(mul(T(C[0]+Math.sqrt(Math.max(0,ri[i]*ri[i]-d*d)),C[1]+d),Sc(k)),T(-e.g.adv/2,-50)));tilts.set(e,0);}));
  return {k,maps:block.glyphs.map(e=>maps.get(e)),tilts:block.glyphs.map(e=>tilts.get(e)),C,rOut:r0+cross*k/2,rIn:ri[ri.length-1]-cross*k/2,sweep};}
 // Horizontal: fit the chord to the sheet, then shrink until the lowest row clears the information.
 const sinc=Math.sin(t)/t;k=Math.min((W-110)/(Lmax*sinc+100*Math.sin(t)+100*(Math.cos(t)+Math.sin(t))),1.6)*P.size;
 for(let pass=0;pass<6;pass++){r0=Math.min(6000,Math.max(...rows.map((r,i)=>r.L*k/sweep+50*k+i*pitch*k)));const rl=r0-(rows.length-1)*pitch*k,low=top+r0+50*k-(rl-50*k)*Math.cos(t)+50*k*Math.sin(t);if(low<=bottom)break;k*=Math.max(.6,(bottom-top)/(low-top));}
 C=[W/2,top+r0+50*k];
 rows.forEach((row,i)=>{const ri=r0-i*pitch*k,rho=ri-50*k;row.run.forEach((e,j)=>{const phi=rho>1e-6?row.s[j]*k/rho:0;maps.set(e,mul(mul(mul(T(C[0]+ri*Math.sin(phi),C[1]-ri*Math.cos(phi)),Rot(phi)),Sc(k)),T(-e.g.adv/2,-50)));tilts.set(e,phi*180/Math.PI);});});
 return {k,maps:block.glyphs.map(e=>maps.get(e)),tilts:block.glyphs.map(e=>tilts.get(e)),C,rOut:r0+50*k,rIn:r0-(rows.length-1)*pitch*k-50*k,sweep};}

// ——— Colour ———
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
const luminance=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
export const inkFor=g=>luminance(g)>.22?'#1b1b1b':'#f4f1ea';
export const contrast=(a,b)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
export const KIT_COLORS={bar:'#3d4fa0',sweep:'#d8402e',press:'#2f8f5a',dot:'#e0a92e',frame:'#7a4fa0',hook:'#e0702e',ring:'#2a9bb8'};

// ——— Composition ———
// Head and info boxes per layout, horizontal (h) or vertical (v) setting, with the head block's alignment.
const BOXES={
 banner:{h:{head:[40,62,W-40,318],info:[60,H-196,W-60,H-52]},v:{head:[W-262,48,W-40,H-48],info:[38,64,176,H-64],ax:1,ay:0}},
 fill:{h:{head:[38,44,W-38,H-210],info:[60,H-180,W-60,H-52],ay:0},v:{head:[176,40,W-38,H-40],info:[38,64,150,H-64],ax:1,ay:0}},
 grid:{h:{head:[36,40,W-36,H-206],info:[60,H-180,W-60,H-52],ay:0},v:{head:[172,36,W-36,H-36],info:[38,64,150,H-64],ax:1,ay:0}},
 arc:{h:{info:[80,H-196,W-80,H-56]},v:{info:[38,64,150,H-64]}},
 tilt:{h:{head:[30,120,W-30,H-220],info:[60,H-190,W-60,H-52]},v:{head:[160,60,W-30,H-60],info:[38,64,150,H-64]}}
};
const bboxOf=pts=>pts.length?[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]:null;
// Grid: lines wrap into the run length that gives the largest glyphs in the box (rows, or columns when vertical).
function gridText(text,state,box){const lines=text.split('/'),maxLen=Math.max(...lines.map(l=>[...l].length));let best=null;
 for(let c=1;c<=maxLen;c++){const wrapped=lines.flatMap(l=>{const ch=[...l],out=[];for(let i=0;i<ch.length;i+=c)out.push(ch.slice(i,i+c).join('').trim());return out.filter(Boolean);});if(wrapped.length>8)continue;
  const blk=setText(wrapped.join('/'),state),[x0,y0,x1,y1]=blk.bbox,k=Math.min((box[2]-box[0])/Math.max(1,x1-x0),(box[3]-box[1])/Math.max(1,y1-y0));if(!best||k>best.k*1.02)best={k,blk};}
 return best.blk;}
function compose(state){const v=state.direction==='ttb',B=BOXES[state.layout][v?'v':'h'],P=state.params,head=state.layout==='grid'?gridText(state.text,state,B.head):setText(state.text,state.layout==='arc'?{...state,params:{...P,interlock:0}}:state);
 const placed=state.layout==='arc'?arcBlock(head,P,104,v?0:B.info[1]-24,v?B.info[2]+26:0):fitBlock(head,B.head,{rot:state.layout==='tilt'?P.angle*Math.PI/180:0,size:P.size,maxK:state.layout==='banner'?(v?2.2:2.4):Infinity,ax:B.ax??.5,ay:B.ay??.5});
 let info=null;if(state.info){const ib=setText(state.info,{...state,params:{...P,interlock:0}},.82);info={block:ib,...fitBlock(ib,B.info,{maxK:v?.7:.6,ay:v?0:.5})};}
 return {head,placed,info,box:B.head};}
// Every glyph of a block as poster-space polygons (one entry per stroke).
function strokesOf(block,maps){const out=[];block.glyphs.forEach((e,i)=>{const M=maps[i];for(const s of e.g.strokes)out.push({glyph:i,ch:e.ch,type:s.type,mark:s.mark,ring:s.closed,polys:s.polys.map(p=>p.map(q=>ap(M,q))),line:s.line.map(q=>ap(M,q)),hw:s.hw,ms:s.ms,join:s.join,nodes:s.nodes.map(([x,y,sm])=>[...ap(M,[x,y]),sm])});});return out;}
const polyD=polys=>polys.map(p=>'M'+p.map(q=>n(q[0])+' '+n(q[1])).join('L')+'Z').join('');
const lettersSVG=(strokes,fill,extra='')=>`<g fill="${fill}"${extra}>${strokes.map(s=>`<path d="${polyD(s.polys)}"${s.ring?' fill-rule="evenodd"':''}/>`).join('')}</g>`;
// Centrelines for inline and neon cores: free ends pull back inside the stroke, thin tails are dropped.
function coreD(strokes,k){return strokes.map(s=>{let pts=s.line;if(pts.length<2)return '';const pull=s.hw*k*.55;if(!s.ring){const cut=(arr,mEnd,joined)=>{if(joined)return arr;let left=Math.max(pull,mEnd<.6?s.hw*k*1.8:0),p=arr.slice();
  while(p.length>2){const l=Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]);if(l>left){const t=left/l;p[0]=[p[0][0]+(p[1][0]-p[0][0])*t,p[0][1]+(p[1][1]-p[0][1])*t];break;}left-=l;p.shift();}return p;};
  pts=cut(pts,s.ms[0],s.join[0]);pts=cut(pts.slice().reverse(),s.ms[1],s.join[1]).reverse();}
 return 'M'+pts.map(q=>n(q[0])+' '+n(q[1])).join('L')+(s.ring?'Z':'');}).join('');}

// Ornaments fill the field left free between headline and information, or sit behind the text when none is left.
// Flag = band + sun; burst = rays + sun.
export const ORNAMENT_PARTS={none:[],sun:['sun'],rays:['rays'],burst:['rays','sun'],triangle:['triangle'],band:['band'],flag:['band','sun']};
// Largest disc (allowed to bleed past the edge) that clears every glyph and the information.
function freeDisc(obstacles,margin){let best=[W/2,H/2,0];
 for(let gx=0;gx<=16;gx++)for(let gy=0;gy<=22;gy++){const cx=30+gx*(W-60)/16,cy=30+gy*(H-60)/22;let r=Math.min(cx,W-cx,cy,H-cy)*1.4;
  for(const b of obstacles){const dx=Math.max(b[0]-cx,0,cx-b[2]),dy=Math.max(b[1]-cy,0,cy-b[3]);r=Math.min(r,Math.hypot(dx,dy)-margin);}if(r>best[2])best=[cx,cy,r];}return best;}
function ornamentSVG(state,comp,headStrokes,infoStrokes,guide=false){const [,ink,shade,acc,acc2]=state.colors,v=state.direction==='ttb',parts=ORNAMENT_PARTS[state.ornament],neon=state.finish==='neon'&&!guide,out=[],L=state.layout;
 // An ornament that must sit under the letters takes the first palette colour that still separates from them.
 const safe=c=>[c,shade,acc2,acc].find(x=>contrast(x,ink)>=2.2)??c;
 const bx=bboxOf(headStrokes.flatMap(s=>s.polys.flat())),ix=bboxOf(infoStrokes.flatMap(s=>s.polys.flat()));
 const paint=(d,fill,rule='')=>guide?`<path d="${d}" fill="none" stroke="${inkFor(state.colors[0])}" stroke-opacity=".3" stroke-width="1" stroke-dasharray="5 4"/>`:neon?`<path d="${d}" fill="none" stroke="${fill}" stroke-width="2.4" stroke-linejoin="round"/>`:`<path d="${d}" fill="${fill}"${rule}/>`;
 const disc=(cx,cy,r)=>`M${n(cx-r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2*r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2*r)} 0Z`;
 let field=v?[(ix?ix[2]:24)+26,56,bx[0]-30,H-56]:[44,bx[3]+30,W-44,(ix?ix[1]:H-40)-26];const fw=field[2]-field[0],fh=field[3]-field[1],roomy=Math.min(fw,fh)>170&&L!=='tilt'&&L!=='arc';
 let [cx,cy,r]=roomy?[(field[0]+field[2])/2,(field[1]+field[3])/2,Math.min(270,Math.min(fw,fh)*.46)]:v?[W*.4,H*.64,215]:[W*.62,H*.6,235],sunColor=acc;
 if(!roomy){const glyphBoxes=[...new Set(headStrokes.map(s=>s.glyph))].map(g=>bboxOf(headStrokes.filter(s=>s.glyph===g).flatMap(s=>s.polys.flat()))),free=freeDisc([...glyphBoxes,...(ix?[ix]:[])],18);
  if(free[2]>=90)[cx,cy,r]=[free[0],free[1],Math.min(270,free[2])];else sunColor=safe(acc);}
 if(!roomy&&(L!=='arc'||fw<120||fh<120))field=[60,v?60:H*.38,W-60,H-150];
 if(parts.includes('rays')){const N=28,d=[];for(let i=0;i<N;i+=2){const a0=i/N*Math.PI*2,a1=(i+1)/N*Math.PI*2;d.push(`M${n(cx)} ${n(cy)}L${n(cx+1600*Math.cos(a0))} ${n(cy+1600*Math.sin(a0))}L${n(cx+1600*Math.cos(a1))} ${n(cy+1600*Math.sin(a1))}Z`);}out.push(paint(d.join(''),acc2));}
 if(parts.includes('triangle')){const t=L==='tilt'?[[W*.4,170],[W*.97,235],[W*.62,H-170]]:[[field[0],field[1]],[field[2],field[1]],[(field[0]+field[2])/2,field[3]]];out.push(paint('M'+t.map(p=>n(p[0])+' '+n(p[1])).join('L')+'Z',roomy?acc:safe(acc)));}
 if(parts.includes('band')){const pad=Math.max(16,(v?bx[2]-bx[0]:bx[3]-bx[1])*.1);let d;
  if(L==='arc'){const {C,rOut,rIn,k}=comp.placed;d=disc(C[0],C[1],rOut+18*k)+disc(C[0],C[1],Math.max(1,rIn-18*k));}
  else if(L==='tilt'){const M=comp.placed.M,[x0,y0,x1,y1]=comp.head.bbox,p=pad/comp.placed.k,q=v?[[x0-p,y0-4000],[x1+p,y0-4000],[x1+p,y1+4000],[x0-p,y1+4000]]:[[x0-4000,y0-p],[x1+4000,y0-p],[x1+4000,y1+p],[x0-4000,y1+p]];d='M'+q.map(z=>ap(M,z)).map(z=>n(z[0])+' '+n(z[1])).join('L')+'Z';}
  else d=v?`M${n(bx[0]-pad)} 0H${n(bx[2]+pad)}V${H}H${n(bx[0]-pad)}Z`:`M0 ${n(bx[1]-pad)}H${W}V${n(bx[3]+pad)}H0Z`;
  out.push(paint(d,acc2,' fill-rule="evenodd"'));}
 if(parts.includes('sun')){const rr=Math.max(20,parts.includes('rays')?r*.62:r);out.push(paint(disc(cx,cy,rr),sunColor));if(neon)out.push(paint(disc(cx,cy,rr*.8),shade));}
 return out.join('');}

function finishSVG(state,strokes,k,uid,groundPaint){const [ground,ink,shade]=state.colors,P=state.params,f=state.finish,wpx=P.weight*k;
 if(f==='shadow'){const d=n(P.depth*100*k*.75);return `<g transform="translate(${d} ${d})">${lettersSVG(strokes,shade)}</g>`+lettersSVG(strokes,ink);}
 if(f==='inline'){const lw=n(Math.max(.6,P.line*wpx));return lettersSVG(strokes,ink)+`<path d="${coreD(strokes,k)}" fill="none" stroke="${groundPaint}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"/>`;}
 if(f==='outline'){const lw=n(Math.max(.8,P.line*wpx*2));return lettersSVG(strokes,ink,` stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"`)+lettersSVG(strokes,groundPaint);}
 // Neon: bright tubes with a white-hot core, a wide halo and a tight bloom.
 if(f==='neon'){const core=n(Math.max(.6,P.line*wpx)),blur=n(P.glow*wpx*.9+.01),inner=lettersSVG(strokes,ink)+`<path d="${coreD(strokes,k)}" fill="none" stroke="${mix(ink,'#ffffff',.62)}" stroke-width="${core}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return P.glow>0?`<filter id="glow-${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${blur}" result="b"/><feGaussianBlur in="SourceGraphic" stdDeviation="${n(blur*.3)}" result="c"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter><g filter="url(#glow-${uid})">${inner}</g>`:inner;}
 if(f==='riso'){const d=n(P.depth*100*k*.5);return `<g transform="translate(${-d} ${-d})">${lettersSVG(strokes,shade)}</g><g transform="translate(${d} ${d})" style="mix-blend-mode:multiply">${lettersSVG(strokes,ink)}</g>`;}
 return lettersSVG(strokes,ink);}

const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
export function render(input={}){const state=resolve(input),[ground,ink,shade,acc,acc2,infoC]=state.colors,uid=uidOf(state),comp=compose(state),stage=state.stage;
 const head=strokesOf(comp.head,comp.placed.maps),info=comp.info?strokesOf(comp.info.block,comp.info.maps):[],k=comp.placed.k,parts=[],grad=stage===4&&state.ground==='gradient';
 const groundPaint=grad?`url(#ground-${uid})`:ground;
 parts.push(grad?`<linearGradient id="ground-${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="${ground}"/><stop offset="1" stop-color="${mix(ground,acc2,.6)}"/></linearGradient><rect width="${W}" height="${H}" fill="${groundPaint}"/>`:`<rect width="${W}" height="${H}" fill="${ground}"/>`);
 const all=[...head,...info];
 if(stage<3)parts.push(ornamentSVG(state,comp,head,info,true));
 if(stage===1){const line=inkFor(ground),cells=[];
  comp.head.glyphs.forEach((e,i)=>{const M=comp.placed.maps[i],c=[[0,0],[e.g.adv,0],[e.g.adv,100],[0,100]].map(q=>ap(M,q));cells.push('M'+c.map(q=>n(q[0])+' '+n(q[1])).join('L')+'Z');});
  (comp.info?.block.glyphs??[]).forEach((e,i)=>{const M=comp.info.maps[i],c=[[0,0],[e.g.adv,0],[e.g.adv,100],[0,100]].map(q=>ap(M,q));cells.push('M'+c.map(q=>n(q[0])+' '+n(q[1])).join('L')+'Z');});
  parts.push(`<path d="${cells.join('')}" fill="none" stroke="${line}" stroke-opacity=".28" stroke-width=".7" stroke-dasharray="3 3"/>`);
  parts.push(`<path d="${all.map(s=>'M'+s.line.map(q=>n(q[0])+' '+n(q[1])).join('L')+(s.ring?'Z':'')).join('')}" fill="none" stroke="${line}" stroke-width="${n(Math.max(1.5,state.params.weight*k*.1))}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const nodes=all.flatMap(s=>s.nodes);parts.push(`<path d="${nodes.filter(p=>!p[2]).map(([x,y])=>`M${n(x-2.2)} ${n(y-2.2)}h4.4v4.4h-4.4Z`).join('')}" fill="${KIT_COLORS.sweep}"/><path d="${nodes.filter(p=>p[2]).map(([x,y])=>`M${n(x-2.4)} ${n(y)}a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0Z`).join('')}" fill="${KIT_COLORS.ring}"/>`);
  parts.push(`<g font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="11" fill="${line}">${comp.head.glyphs.map((e,i)=>{const [x,y]=ap(comp.placed.maps[i],[4,0]);return `<text x="${n(x)}" y="${n(y-4)}">${e.order+1}</text>`;}).join('')}</g>`);}
 else if(stage===2){parts.push(all.map(s=>`<path d="${polyD(s.polys)}"${s.ring?' fill-rule="evenodd"':''} fill="${KIT_COLORS[s.type]}" fill-opacity=".72" stroke="${inkFor(ground)}" stroke-width=".7" stroke-linejoin="round"/>`).join(''));
  const used=[...new Set(all.map(s=>s.type))],line=inkFor(ground);parts.push(`<g font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="15" fill="${line}">${used.map((t,i)=>`<rect x="${36+i*96}" y="${H-38}" width="14" height="14" fill="${KIT_COLORS[t]}"/><text x="${56+i*96}" y="${H-26}">${t}</text>`).join('')}</g>`);}
 else if(stage===3){const line=inkFor(ground),B=BOXES[state.layout][state.direction==='ttb'?'v':'h'],rect=b=>`M${b[0]} ${b[1]}H${b[2]}V${b[3]}H${b[0]}Z`;
  // Letters set in the layout: head and information boxes (or the arch) as guides.
  const {C,rOut,rIn}=comp.placed,rm=(rOut+rIn)/2,g=state.layout==='arc'?`M${n(C[0]-rm)} ${n(C[1])}a${n(rm)} ${n(rm)} 0 1 0 ${n(2*rm)} 0a${n(rm)} ${n(rm)} 0 1 0 ${n(-2*rm)} 0Z`:rect(B.head);
  parts.push(`<path d="${g}${state.info?rect(B.info):''}" fill="none" stroke="${line}" stroke-opacity=".35" stroke-width="1" stroke-dasharray="6 5"/>`+lettersSVG(head,ink)+lettersSVG(info,infoC));}
 else{parts.push(ornamentSVG(state,comp,head,info));parts.push(finishSVG(state,head,k,uid,groundPaint));if(info.length)parts.push(state.finish==='neon'||state.finish==='riso'||state.finish==='outline'?finishSVG({...state,colors:[ground,infoC,infoC]},info,comp.info.k,uid+'i',groundPaint):lettersSVG(info,infoC));}
 const label={1:'skeleton',2:'stroke kit',3:'letters',4:'poster'}[stage],inkPts=all.flatMap(s=>s.polys.flat());
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${state.text.replaceAll('/',' / ')} — Shōwa display kana, ${state.family}, ${label}</title>${parts.join('')}</svg>`;
 const centers=comp.head.glyphs.map((e,i)=>ap(comp.placed.maps[i],[e.g.adv/2,50]).map(n)),cells=comp.head.glyphs.map((e,i)=>[[0,0],[e.g.adv,0],[e.g.adv,100],[0,100]].map(q=>ap(comp.placed.maps[i],q))),tilts=comp.placed.maps.map(M=>n(Math.atan2(M[1],M[0])*180/Math.PI));
 return {svg,state,width:W,height:H,features:{glyphs:comp.head.glyphs.length,infoGlyphs:comp.info?.block.glyphs.length??0,strokes:all.length,rows:state.text.split('/').length,direction:state.direction,layout:state.layout,style:state.style,stage,scale:n(k),
  order:centers,cells,tilts,bounds:inkPts.length?[n(Math.min(...inkPts.map(p=>p[0]))),n(Math.min(...inkPts.map(p=>p[1]))),n(Math.max(...inkPts.map(p=>p[0]))),n(Math.max(...inkPts.map(p=>p[1])))]:null}};}

// Specimen: every glyph group in the family's style, one em cell each; `pairs` sets look-alikes side by side.
export function specimen(input={},{set='all',cols=12,cell=112}={}){const state=resolve({...input,stage:3}),[ground,ink]=state.colors,P={...state.params},label=inkFor(ground),rows=[];
 // Look-alike groups flow along rows with an empty cell between groups.
 const groups=set==='pairs'?[['Look-alikes',[...LOOKALIKES.reduce((a,p)=>{const used=a.length%cols;if(used&&used+p.length>cols)a.push(...Array(cols-used).fill(' '));a.push(...p);if(a.length%cols)a.push(' ');return a;},[])].join('')]]:GROUPS;let y=24;const parts=[];
 for(const [name,chars] of groups){const list=[...chars];parts.push(`<text x="24" y="${y+14}">${name}</text>`);y+=24;
  list.forEach((ch,i)=>{if(ch===' ')return;const c=i%cols,r=Math.floor(i/cols),g=glyphOutline(ch,P,state.style,state.direction==='ttb'),k=(cell-30)/100,x=24+c*cell+(cell-g.adv*k)/2,yy=y+r*cell+15,M=[k,0,0,k,x,yy];
   parts.push(`<g data-glyph="${ch.replace(/["'<>&]/g,m=>'&#'+m.charCodeAt(0)+';')}" fill="${ink}">${g.strokes.map(s=>`<path d="${polyD(s.polys.map(p=>p.map(q=>ap(M,q))))}"${s.closed?' fill-rule="evenodd"':''}/>`).join('')}</g>`);});
  y+=Math.ceil(list.length/cols)*cell+14;}
 const w=48+cols*cell,h=y+16;return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${ground}"/><g font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="13" fill="${label}">${parts.filter(p=>p.startsWith('<text')).join('')}</g>${parts.filter(p=>!p.startsWith('<text')).join('')}</svg>`;}
