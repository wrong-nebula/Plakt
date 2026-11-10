/* Rising-ray stage — shape system study after Tadanori Yokoo’s ray stages (1965–97).
 * One construction: a full turn of filled wedge rays round an origin (on, off or
 * beside the canvas), widths modulated and normalised so they always close the
 * circle, painted in 2–3 alternating colours. The burst is set as a stage: a sun
 * at the origin, a horizon with receding wave or floor bands, side panels,
 * edges and a title slot. Rays are layered (colour A is a full disc, each later
 * colour covers its own wedges and the ones after it in the cycle), so adjacent
 * rays never leave a seam of ground between them. Nothing is traced from the posters.
 */
export const ENGINE='rising-ray-v1';
export const SOURCES=[
 {id:'moma-7953',family:'yokoo'},{id:'moma-7955',family:'mishima'},{id:'moma-7944',family:'tide'},{id:'moma-5092',family:'fancy'},
 {id:'vam-O1192906'},{id:'vam-O692955'},{id:'moma-6016'}
];
export const FORMATS=[{id:'poster',name:'Poster B (728 × 1030)',w:728,h:1030},{id:'square',name:'Square',w:900,h:900},{id:'landscape',name:'Landscape',w:1030,h:728},{id:'banner',name:'Banner',w:420,h:1030}];
export const ROLES=['Ground','Ray A','Ray B','Ray C','Sun','Sea A','Sea B','Panel','Accent','Ink'];
const KEYS=['ground','rayA','rayB','rayC','sun','seaA','seaB','panel','accent','ink'];
export const PALETTES=[
 {id:'yokoo',name:'Silkscreen red / sky',colors:['#efe8d8','#ea4a3e','#6cbbe0','#27399a','#ea4a3e','#27399a','#efe8d8','#c4c3c6','#f2a7c6','#161616']},
 {id:'mishima',name:'Gold / teal',colors:['#efeadf','#c9a352','#2f9ca9','#1b5e6c','#d2ad5b','#f5f2ea','#26398c','#e43b3b','#f4b9cb','#141414']},
 {id:'tide',name:'Yellow / vermilion',colors:['#f2c84a','#f2c84a','#de3b2b','#8e2c55','#de3b2b','#4f9ad2','#5b2547','#3f8f52','#3e77c4','#cf3328']},
 {id:'fancy',name:'Pink / grey / white',colors:['#f1eee8','#f6f4ef','#ec4f9d','#8f9196','#ef6a2c','#7fb1d6','#f6f4ef','#2c2c30','#e8352f','#1c1c1f']},
 {id:'neon',name:'Neon on near-black',colors:['#07060d','#170a30','#ff2bd6','#18e5ff','#fff25c','#0d0a1f','#241046','#120a26','#c6ff3d','#7df9ff']},
 {id:'comic',name:'Comic yellow / orange',colors:['#fff7d6','#ffe03a','#ff8c1a','#ff3d2e','#ffffff','#2f6fe0','#9cc8ff','#2f6fe0','#ff3d2e','#111111']},
 {id:'riso',name:'Riso pink / blue',colors:['#f3eee3','#f3eee3','#ff5aa0','#2b64c6','#2b64c6','#2b64c6','#ff5aa0','#2b64c6','#ff5aa0','#2b64c6']},
 {id:'sunset',name:'Sunset',colors:['#2b1348','#ff8a3d','#ff527e','#9c3aa6','#ffd84d','#3b1a5e','#ff7a59','#1d0d33','#ffd84d','#ffd84d']},
 {id:'opart',name:'Black / white / red',colors:['#f1efe9','#121212','#f1efe9','#e6332a','#e6332a','#121212','#f1efe9','#121212','#e6332a','#121212']},
 {id:'theatre',name:'Velvet / gold',colors:['#16110d','#e8b84a','#b3302d','#6e1d22','#f7e8bd','#5a3822','#7c5131','#a3232b','#e8b84a','#140f0b']},
 {id:'acid',name:'Acid lime / violet',colors:['#0b0f0a','#1a2e12','#c6ff3d','#ff3df2','#ffffff','#0f1a0c','#2a4a17','#101a0d','#ff3df2','#c6ff3d']},
 {id:'ocean',name:'Teal / navy / sun',colors:['#eef5f3','#1f8a8a','#f4fbf8','#0f3d5c','#f6c445','#0f3d5c','#5fb7c9','#0f3d5c','#f6c445','#0b2233']}
];
// `when` lists option values that make a control matter (any match enables it).
export const CONTROLS=[
 {key:'count',label:'Rays per turn',group:'rays',min:4,max:96,step:1},
 {key:'rotate',label:'Rotation',group:'rays',min:-180,max:180,step:1,circular:true},
 {key:'modulate',label:'Width modulation',group:'rays',min:0,max:1,step:.01,when:{modulation:['alternate','taper','wave','random']}},
 {key:'reach',label:'Ray reach',group:'rays',min:.2,max:1,step:.01,when:{outline:['star','fork','scallop','disc']}},
 {key:'seed',label:'Seed',group:'rays',min:1,max:999,step:1,when:{modulation:['random'],texture:['grain'],edge:['clouds','bunting']}},
 {key:'originX',label:'Origin across',group:'origin',min:-.5,max:1.5,step:.01},
 {key:'originY',label:'Origin down',group:'origin',min:-.5,max:1.5,step:.01},
 {key:'sun',label:'Sun size',group:'origin',min:0,max:.5,step:.005},
 {key:'rings',label:'Sun rings',group:'origin',min:0,max:8,step:1},
 {key:'horizon',label:'Horizon (down the page)',group:'horizon',min:.3,max:1.1,step:.005},
 {key:'waves',label:'Wave bands',group:'horizon',min:0,max:8,step:1},
 {key:'amplitude',label:'Wave amplitude',group:'horizon',min:0,max:1.5,step:.01},
 {key:'frequency',label:'Waves across',group:'horizon',min:1,max:16,step:.1},
 {key:'depth',label:'Stage depth',group:'horizon',min:0,max:1,step:.01},
 {key:'panel',label:'Panel width',group:'stage',min:.04,max:.3,step:.005,when:{panel:['proscenium','columns','frame','window']}},
 {key:'line',label:'Ink line',group:'surface',min:0,max:4,step:.1},
 {key:'grain',label:'Texture scale',group:'surface',min:2,max:16,step:.1,when:{texture:['halftone','grain','glow','overprint']}},
 {key:'titleSize',label:'Title size',group:'surface',min:.5,max:1.6,step:.01,when:{band:['arch','straight','plain']}}
];
export const OPTIONS={
 rays:['pair','triple'],modulation:['even','alternate','taper','wave','random'],pattern:['solid','checker','hatch','glow'],outline:['edge','star','fork','scallop','disc'],bursts:['single','twin','stack'],
 sunStyle:['disc','rings','halo','slats','corona'],waveStyle:['sine','scallop','stepped','curl','floor'],panel:['none','proscenium','columns','frame','window'],edge:['none','clouds','scallop','bunting'],
 band:['arch','straight','plain','none'],texture:['flat','halftone','grain','glow','overprint'],format:FORMATS.map(f=>f.id),palette:PALETTES.map(p=>p.id)
};
export const OPTION_LABELS={
 rays:{pair:'Two colours',triple:'Three colours'},modulation:{even:'Even',alternate:'Wide / narrow',taper:'Tapering',wave:'Breathing',random:'Random (seeded)'},pattern:{solid:'Solid',checker:'Radial checker',hatch:'Hatched',glow:'Glow fade'},
 outline:{edge:'To the edges',star:'Star points',fork:'Forked tips',scallop:'Scalloped',disc:'Disc'},bursts:{single:'One burst',twin:'Twin (mirrored)',stack:'Stacked (mirrored)'},
 sunStyle:{disc:'Disc with outer rings',rings:'Target rings',halo:'Halo bands',slats:'Slatted sunset',corona:'Corona star'},waveStyle:{sine:'Sine swell',scallop:'Scallop hills',stepped:'Stepped terraces',curl:'Curling crests',floor:'Stage floor'},
 panel:{none:'None',proscenium:'Proscenium curtains',columns:'Columns',frame:'Frame',window:'Arched window'},edge:{none:'None',clouds:'Clouds',scallop:'Scalloped hem',bunting:'Bunting'},
 band:{arch:'Arched band',straight:'Straight band',plain:'Plain letters',none:'No copy'},texture:{flat:'Flat',halftone:'Halftone dots',grain:'Riso grain',glow:'Neon glow',overprint:'Overprint'},
 format:Object.fromEntries(FORMATS.map(f=>[f.id,f.name])),palette:Object.fromEntries(PALETTES.map(p=>[p.id,p.name]))
};
// Layouts are composition presets: they set the origin, horizon, sun and burst mode.
export const LAYOUTS=[
 {id:'centre',name:'Centre burst',set:{bursts:'single',params:{originX:.5,originY:.5,horizon:1.1,sun:.12}}},
 {id:'low',name:'Low horizon',set:{bursts:'single',params:{originX:.5,originY:.79,horizon:.79,sun:.2,waves:4}}},
 {id:'corner',name:'Corner burst',set:{bursts:'single',params:{originX:.05,originY:.95,horizon:1.1,sun:.32}}},
 {id:'twin',name:'Twin bursts',set:{bursts:'twin',params:{originX:.1,originY:.72,horizon:.72,sun:.13}}},
 {id:'framed',name:'Framed stage',set:{bursts:'single',panel:'window',band:'arch',params:{originX:.5,originY:.83,horizon:.85,sun:.1}}}
];
const P0={count:36,rotate:0,modulate:.5,reach:.7,seed:7,originX:.5,originY:.6,sun:.12,rings:0,horizon:.8,waves:3,amplitude:.6,frequency:4,depth:.5,panel:.1,line:1,grain:6,titleSize:1};
const O0={rays:'pair',modulation:'even',pattern:'solid',outline:'edge',bursts:'single',sunStyle:'disc',waveStyle:'sine',panel:'none',edge:'none',band:'straight',texture:'flat',format:'poster'};
const fam=(id,name,after,title,info,note,set)=>({id,name,after,title,info,note,palette:id,set:{...O0,...set,params:{...P0,...set.params}}});
export const FAMILIES=[
 fam('yokoo','Yokoo stage','Tadanori Yokoo, Made in Japan … (1965)','RISING RAY STAGE','A THEATRE OF RAYS · 29 · 11 · 2026','Forty-four even red and sky-blue rays from a half sun on the floor of an arched window; the side boxes and spandrels carry their own three-colour bursts, clouds sit in the corners.',
  {panel:'window',edge:'clouds',band:'arch',params:{count:44,originY:.845,sun:.08,horizon:.86,waves:0,amplitude:.3,panel:.09,line:1.1}}),
 fam('mishima','Sun and surf','Tadanori Yokoo, Yukio Mishima, The Aesthetics of End (1966)','SUN AND SURF','THE AESTHETICS OF RAYS · 2026','Gold rays a little wider than the teal from a high sun disc, with curling navy crests and white foam rolling in at the foot.',
  {modulation:'alternate',waveStyle:'curl',panel:'frame',edge:'clouds',band:'arch',params:{count:36,modulate:.22,originY:.35,sun:.085,horizon:.84,waves:3,amplitude:1.05,frequency:2.4,depth:.65,panel:.05,line:1.4}}),
 fam('tide','Spike tide','Tadanori Yokoo, 16th Exhibition of Japan Advertising Artists Club (c. 1956–66)','RAYS 16','12 → 17 · AUGUST · STAGE STUDY','Vermilion rays with forked tips on a yellow halftone ground, rising from a big half sun on a flat blue sea under a scalloped hem.',
  {modulation:'alternate',outline:'fork',waveStyle:'scallop',edge:'scallop',band:'plain',texture:'halftone',params:{count:22,modulate:.12,reach:.5,originY:.79,sun:.17,horizon:.79,waves:1,amplitude:.45,frequency:1.5,line:1.6,grain:7,titleSize:1.15}}),
 fam('fancy','Fancy burst','Tadanori Yokoo, Fancydance (1989)','FANCY BURST','ROTATING STAGE · 2026','Sixty-six seeded random rays in pink, grey and white from an off-centre ringed planet; the pink rays are hatched.',
  {rays:'triple',modulation:'random',pattern:'hatch',sunStyle:'rings',band:'plain',params:{count:66,modulate:.6,seed:11,originX:.46,originY:.38,sun:.065,rings:3,horizon:1.1,waves:0,line:0,titleSize:.8}}),
 fam('neon','Neon festival','new — electro stage','NIGHT RAYS','LIVE · 22:00 → 06:00 · MAIN STAGE','Glowing magenta and cyan rays fading into near-black, a haloed sun on a perspective grid floor, neon pylons and festival bunting.',
  {rays:'triple',modulation:'taper',pattern:'glow',sunStyle:'halo',waveStyle:'floor',panel:'columns',edge:'bunting',texture:'glow',params:{count:30,modulate:.55,originY:.6,sun:.16,rings:3,horizon:.6,waves:7,amplitude:.3,frequency:9,depth:.75,panel:.07,line:1.6,grain:5,titleSize:.9}}),
 fam('comic','Comic burst','new — pop art','WHAM!','ISSUE 01 · SHAPE SYSTEM','An off-centre burst of seeded random yellow and orange rays cut to star points round a white corona, with heavy ink and halftone dots.',
  {modulation:'random',outline:'star',sunStyle:'corona',band:'plain',texture:'halftone',params:{count:26,modulate:.85,seed:23,reach:.8,originX:.44,originY:.47,sun:.19,rings:1,horizon:1.1,waves:0,line:3.2,grain:6,titleSize:1.35}}),
 fam('riso','Riso twins','new — two-tone riso','TWIN STAGE','PINK + BLUE · OVERPRINT','Two mirrored bursts in fluorescent pink on paper meet at the centre; a blue sun and stepped terraces overprint the rays.',
  {modulation:'taper',bursts:'twin',waveStyle:'stepped',panel:'frame',texture:'overprint',params:{count:40,modulate:.6,originX:.16,originY:.66,sun:.12,rings:3,horizon:.7,waves:4,amplitude:.8,frequency:3.5,depth:.3,panel:.07,line:0,grain:5,titleSize:.9}}),
 fam('sunset','Sunset horizon','new — retro sunset','SUNSET','LAST LIGHT · OPEN AIR · 2026','A big slatted sun on a low horizon, warm three-colour rays and receding sine swells under riso grain.',
  {rays:'triple',modulation:'alternate',sunStyle:'slats',band:'plain',texture:'grain',params:{count:30,modulate:.35,originY:.55,sun:.26,rings:6,horizon:.63,waves:6,amplitude:.35,frequency:2.2,depth:.8,line:0,grain:4}}),
 fam('opart','Op-art tunnel','new — op art','OPTIC STAGE','BLACK / WHITE / RED','Breathing black and white rays swapped ring by ring into a radial checker that falls into a small red target.',
  {modulation:'wave',pattern:'checker',sunStyle:'rings',panel:'frame',params:{count:40,modulate:.6,originY:.5,sun:.05,rings:2,horizon:1.1,waves:0,panel:.05,line:0,titleSize:.8}}),
 fam('theatre','Showa theatre','new — proscenium','GRAND THEATRE','TONIGHT · CURTAIN 19:30','Gold and crimson rays behind velvet curtains and a swagged valance, a haloed spotlight sun over a receding board floor.',
  {modulation:'alternate',sunStyle:'halo',waveStyle:'floor',panel:'proscenium',band:'arch',texture:'grain',params:{count:28,modulate:.3,originY:.74,sun:.1,rings:3,horizon:.76,waves:6,amplitude:.4,frequency:7,depth:.8,panel:.12,line:1,grain:4,titleSize:.9}})
];
for(const f of FAMILIES)f.colors=PALETTES.find(p=>p.id===f.palette).colors;

const TAU=Math.PI*2,n=v=>Math.round(v*100)/100,P=(x,y)=>n(x)+' '+n(y);
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export function rng(seed){let a=(seed>>>0)||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export function mix(a,b,t){const A=rgb(a),B=rgb(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');}
const lum=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);},readable=(bg,...cs)=>cs.reduce((best,c)=>contrast(bg,c)>contrast(bg,best)?c:best);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const circlePath=([x,y],r)=>`M${P(x-r,y)}A${n(r)} ${n(r)} 0 1 0 ${P(x+r,y)}A${n(r)} ${n(r)} 0 1 0 ${P(x-r,y)}Z`;

// Title copy is set in Impact; glyphs are forced to these advances (em), so fitting is machine-independent.
const IMPACT={"0":.536,"1":.381,"2":.502,"3":.53,"4":.5,"5":.537,"6":.542,"7":.392,"8":.535,"9":.542,A:.508,B:.552,C:.554,D:.553,E:.416,F:.398,G:.551,H:.555,I:.288,J:.331,K:.537,L:.38,M:.717,N:.542,O:.546,P:.502,Q:.546,R:.539,S:.517,T:.461,U:.547,V:.523,W:.814,X:.482,Y:.473,Z:.397," ":.2,".":.185,",":.168,":":.202,";":.202,"!":.27,"?":.525,"-":.294,"'":.185,"&":.576,"/":.396,"#":.626,"+":.533,"(":.313,")":.313,"·":.2,"→":.6};
export function normalizeTitle(s,fallback=''){if(typeof s!=='string')return fallback;return s.normalize('NFKD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[‘’`´]/g,"'").replace(/[–—]/g,'-').replace(/[^A-Z0-9 .,:;!?'&/#+()\-·→]/g,'').replace(/\s+/g,' ').trim().slice(0,32);}
const TITLE_FONT=`Impact,'Arial Narrow','Arial Black',sans-serif`,INFO_FONT=`'Helvetica Neue',Helvetica,Arial,sans-serif`;

export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS){const v=input.params?.[c.key];params[c.key]=v!==null&&v!==''&&v!==undefined&&Number.isFinite(+v)?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):set.params[c.key];}
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],palette=OPTIONS.palette.includes(input.palette)?input.palette:family.palette;
 const colors=Array.isArray(input.colors)&&input.colors.length===ROLES.length&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...PALETTES.find(p=>p.id===palette).colors];
 const out={engine:ENGINE,family:family.id,stage:[1,2,3,4].includes(+input.stage)?+input.stage:4};
 for(const k of Object.keys(O0))out[k]=pick(k);
 return {...out,palette,colors,params,title:normalizeTitle(input.title,family.title),info:typeof input.info==='string'?input.info.replace(/[<>&]/g,'').slice(0,80):family.info};}

// ── Rays ──────────────────────────────────────────────────────────────────
// A full turn of N rays (N a multiple of the colour count, so the cycle closes),
// widths modulated in [0.35, 1.65] of the mean and normalised to exactly 2π.
// Ray 0 is colour A, centred on the rotation angle measured from straight up.
export function rayAngles(state,over={}){const p={...state.params,...over.params},kind=over.rays??state.rays,mod=over.modulation??state.modulation,k=kind==='triple'?3:2,N=Math.max(2*k,Math.round(p.count/k)*k),m=mod==='even'?0:p.modulate,rand=rng(p.seed*7919+N),rot=p.rotate*Math.PI/180,facing=over.facing??-Math.PI/2,w=[];
 for(let i=0;i<N;i++){const c=i%k,phi=-Math.PI/2+rot+TAU*i/N;let v=1;
  if(mod==='alternate')v=c===0?1+.65*m:1-.65*m/(k-1);else if(mod==='taper')v=1+.65*m*Math.cos(phi-facing);else if(mod==='wave')v=1+.65*m*Math.sin(TAU*3*i/N);else if(mod==='random')v=1+.65*m*(2*rand()-1);
  w.push(v);}
 const total=w.reduce((a,b)=>a+b,0),rays=[];let a=-Math.PI/2+rot-w[0]/total*Math.PI;
 for(let i=0;i<N;i++){const d=w[i]/total*TAU;rays.push({a0:a,a1:a+d,c:i%k});a+=d;}
 rays[N-1].a1=rays[0].a0+TAU;return {rays,N,k};}
// A wedge from the origin, its far edge sampled every ≤20° and pushed out so the chord clears radius R.
function wedge([ox,oy],a0,a1,R){const steps=Math.max(1,Math.ceil((a1-a0)/(Math.PI/9))),r=R/Math.cos((a1-a0)/steps/2);let d='M'+P(ox,oy);for(let j=0;j<=steps;j++){const a=a0+(a1-a0)*j/steps;d+='L'+P(ox+r*Math.cos(a),oy+r*Math.sin(a));}return d+'Z';}
// Layered fill: colour 0 is a full disc; layer j covers, in every cycle, its own
// wedge and runs on to the middle of the next colour’s wedge (the last layer
// stops at its own edge). Every boundary is then one edge drawn over the ray
// colour it meets — never over the ground, never two edges at one angle.
function rayLayers(o,{rays,k},R,paint,between=()=>''){let s=`<path d="${circlePath(o,R)}" fill="${paint(0)}"/>`;
 for(let j=1;j<k;j++){let d='';for(let g=0;g<rays.length;g+=k){const r=rays[g+j],nx=rays[g+j+1];d+=wedge(o,r.a0,j<k-1?(nx.a0+nx.a1)/2:r.a1,R);}s+=`<path d="${d}" fill="${paint(j)}"/>`+between(j,d);}
 return s;}
// Ray ends: star points at ray centres, forked (swallowtail) tips, round scallops or a disc.
function outlinePath([ox,oy],{rays},R,kind){const pt=(a,r)=>P(ox+r*Math.cos(a),oy+r*Math.sin(a));if(kind==='disc')return circlePath([ox,oy],R);let d='';
 rays.forEach((r,i)=>{const mid=(r.a0+r.a1)/2,tip=Math.min(R*.42,R*(r.a1-r.a0)*1.15);
  if(kind==='star')d+=(i?'L':'M')+pt(r.a0,R-tip)+'L'+pt(mid,R);
  else if(kind==='fork')d+=(i?'L':'M')+pt(r.a0,R)+'L'+pt(mid,R-tip*.75)+'L'+pt(r.a1,R);
  else d+=(i?'L':'M')+pt(r.a0,R-tip*.55)+'Q'+pt(mid,R+tip*.75)+' '+pt(r.a1,R-tip*.55);});
 return d+'Z';}
const farthest=([x,y],W,H)=>Math.max(...[[0,0],[W,0],[0,H],[W,H]].map(([a,b])=>Math.hypot(a-x,b-y)));

// ── Sun ───────────────────────────────────────────────────────────────────
function sunSVG(state,o,rs,C,geo,id,defs){const p=state.params,[ox,oy]=o,lw=p.line,stroke=lw>0?` stroke="${C.ink}" stroke-width="${n(lw)}"`:'',disc=(r,fill,extra='')=>`<circle cx="${n(ox)}" cy="${n(oy)}" r="${n(r)}" fill="${fill}"${extra}/>`;if(rs<.5)return '';let s='';
 if(state.sunStyle==='disc'){s+=disc(rs,C.sun,stroke);for(let i=1;i<=p.rings;i++)s+=disc(rs*(1+.13*i),'none',` stroke="${C.ink}" stroke-width="${n(Math.max(1.2,lw))}"`);}
 else if(state.sunStyle==='rings'){const k=2*p.rings+1;for(let i=0;i<k;i++)s+=disc(rs*(1-i/k),i%2?C.rayA:C.sun,i===0?stroke:'');}
 else if(state.sunStyle==='halo'){for(let i=p.rings;i>=1;i--)s+=disc(rs*(1+.17*i),i%2?C.rayC:C.accent,stroke);s+=disc(rs,C.sun,stroke);}
 else if(state.sunStyle==='slats'){defs.push(`<linearGradient id="${id}sg" gradientUnits="userSpaceOnUse" x1="0" y1="${n(oy-rs)}" x2="0" y2="${n(oy+rs)}"><stop offset="0" stop-color="${C.sun}"/><stop offset=".55" stop-color="${mix(C.sun,C.rayB,.6)}"/><stop offset="1" stop-color="${C.rayB}"/></linearGradient>`);
  // Gaps thicken downward through the lower part of the disc; the rays show through them.
  const k=p.rings,strips=[];let y=oy-rs-1;for(let j=0;j<k;j++){const c=oy-rs*.2+rs*1.2*(j+.5)/k,t=rs*.04*(1+1.6*j/Math.max(1,k-1));strips.push([y,c-t/2]);y=c+t/2;}strips.push([y,oy+rs+1]);
  defs.push(`<clipPath id="${id}sc"><path d="${strips.map(([a,b])=>`M${P(ox-rs-1,a)}H${n(ox+rs+1)}V${n(b)}H${n(ox-rs-1)}Z`).join('')}"/></clipPath>`);s+=`<g clip-path="url(#${id}sc)">${disc(rs,`url(#${id}sg)`,stroke)}</g>`;}
 else{const pts=geo.rays.map(r=>{const m=(r.a0+r.a1)/2;return [[r.a0,rs],[m,rs*1.3]];}).flat().map(([a,r])=>P(ox+r*Math.cos(a),oy+r*Math.sin(a)));s+=`<path d="M${pts.join('L')}Z" fill="${C.sun}"${stroke} stroke-linejoin="round"/>`;for(let i=1;i<=p.rings;i++)s+=disc(rs*(1-i/(p.rings+1)),i%2?C.rayA:C.sun,stroke);}
 return s;}

// One burst: layered rays (with their pattern and ray ends), ink boundaries and the sun.
function burstSVG(state,o,W,H,C,id,defs,{facing,rays:over,colors,sun=true}={}){const p=state.params,geo=rayAngles(state,{facing,...over}),R=farthest(o,W,H)+4,rs=sun?p.sun*Math.min(W,H):0,pal=colors??[C.rayA,C.rayB,C.rayC];let paint=j=>pal[j],s='';
 const pattern=over?'solid':state.pattern,outline=over?'edge':state.outline;
 if(pattern==='glow'){pal.forEach((c,j)=>defs.push(`<radialGradient id="${id}g${j}" gradientUnits="userSpaceOnUse" cx="${n(o[0])}" cy="${n(o[1])}" r="${n(R)}"><stop offset="0" stop-color="${c}"/><stop offset=".3" stop-color="${mix(c,C.ground,.2)}"/><stop offset="1" stop-color="${mix(c,C.ground,.88)}"/></radialGradient>`));paint=j=>`url(#${id}g${j})`;}
 const hatch=(j,d)=>{if(pattern!=='hatch'||j!==1)return '';const step=Math.min(W,H)*.017;defs.push(`<clipPath id="${id}hc"><path d="${d}"/></clipPath>`);let c='';for(let r=Math.max(step,rs);r<R;r+=step)c+=circlePath(o,r);return `<path d="${c}" fill="none" stroke="${C.accent}" stroke-width="${n(step*.36)}" clip-path="url(#${id}hc)"/>`;};
 let rays=rayLayers(o,geo,R,paint,hatch);
 if(pattern==='checker'){const g=1+TAU/geo.N;let d='';for(let r=4;r<R*g;r*=g)d+=circlePath(o,r);defs.push(`<clipPath id="${id}cc"><path d="${d}" clip-rule="evenodd"/></clipPath>`);rays+=`<g clip-path="url(#${id}cc)">${rayLayers(o,geo,R,j=>paint((j+1)%geo.k))}</g>`;}
 if(p.line>0&&!over){let d='';for(const r of geo.rays)d+=`M${P(o[0]+rs*Math.cos(r.a0),o[1]+rs*Math.sin(r.a0))}L${P(o[0]+R*Math.cos(r.a0),o[1]+R*Math.sin(r.a0))}`;rays+=`<path d="${d}" stroke="${C.ink}" stroke-width="${n(p.line*.55)}" fill="none"/>`;}
 if(outline!=='edge'){const d=outlinePath(o,geo,p.reach*R,outline);defs.push(`<clipPath id="${id}oc"><path d="${d}"/></clipPath>`);rays=`<g clip-path="url(#${id}oc)">${rays}</g>`+(p.line>0?`<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${n(p.line)}" stroke-linejoin="round"/>`:'');}
 return {svg:rays,sun:sun?sunSVG(state,o,rs,C,geo,id,defs):'',geo,R,rs};}

// Origins: one, or two mirrored about the vertical (twin) or horizontal (stack) centre line.
export function origins(state,W,H){const p=state.params,o=[p.originX*W,p.originY*H];return state.bursts==='twin'?[o,[W-o[0],o[1]]]:state.bursts==='stack'?[o,[o[0],H-o[1]]]:[o];}
const facingOf=(o,W,H)=>{const dx=W/2-o[0],dy=H*.45-o[1];return Math.hypot(dx,dy)<Math.min(W,H)*.05?-Math.PI/2:Math.atan2(dy,dx);};
// The second burst is the first drawn mirrored, each clipped to its half; the
// mirrored half overlaps the centre line by a pixel so no ground shows there.
function mirrored(state,W,H,content,id,defs){if(state.bursts==='single')return content;const twin=state.bursts==='twin';
 defs.push(`<clipPath id="${id}half"><rect x="-2" y="-2" width="${twin?W/2+2.6:W+4}" height="${twin?H+4:H/2+2.6}"/></clipPath>`);
 return `<g id="${id}first" clip-path="url(#${id}half)">${content}</g><use href="#${id}first" transform="${twin?`matrix(-1 0 0 1 ${W} 0)`:`matrix(1 0 0 -1 0 ${H})`}"/>`;}

// ── Horizon: flat sea band, then receding wave bands or a perspective floor ──
const PROFILE={sine:u=>-(.5+.5*Math.sin(TAU*u)),scallop:u=>-Math.abs(Math.sin(Math.PI*u)),stepped:u=>-Math.round((.5+.5*Math.sin(TAU*u))*3)/3,
 curl:u=>{const v=u-Math.floor(u);return v<.75?-(Math.sin(Math.PI/2*v/.75)**1.6):v<.8?-1+(v-.75)/.05*.7:-.3*(1-(v-.8)/.2);}};
// Curling crests: the front face drops as a cliff and a lip curls forward over it,
// leaving a hollow that shows the band behind.
function curlPoints(y0,A,period,phase,W){const pts=[],R1=Math.min(A*.4,period*.15),R2=R1*.52,arc=(cx,cy,r,from,to,step)=>{for(let t=from;step>0?t<=to:t>=to;t+=step){const a=t*Math.PI/180;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}};
 let next=(Math.ceil(-4/period+phase-.75)+.75-phase)*period;
 for(let x=-4;x<=W+6;x+=2){while(next<=x){const yc=y0-A;pts.push([next,yc]);arc(next,yc+R1,R1,-90,140,20);arc(next+R1*.12,yc+R1,R2,140,-90,-20);next+=period;}pts.push([x,y0+A*PROFILE.curl(x/period+phase)]);}
 return pts;}
export function bandRows(state,H){const p=state.params,yh=p.horizon*H;if(yh>=H-.5)return null;const nb=state.waveStyle==='floor'?p.waves+2:p.waves+1,q=1+2.2*p.depth,ys=[];
 for(let j=0;j<=nb;j++)ys.push(yh+(H-yh)*(q===1?j/nb:(q**j-1)/(q**nb-1)));return {yh,ys,nb};}
function edgePoints(style,y0,A,period,phase,W){if(style==='curl'&&A>3)return curlPoints(y0,A,period,phase,W);const pts=[];let prev=null;for(let x=-4;x<=W+6;x+=2){const y=y0+A*PROFILE[style](x/period+phase);if(style==='stepped'&&prev!==null&&Math.abs(y-prev)>.01)pts.push([x,prev]);pts.push([x,y]);prev=y;}return pts;}
function horizonSVG(state,W,H,C,vx,id,defs){const p=state.params,rows=bandRows(state,H);if(!rows)return {svg:'',rows:null};const {yh,ys,nb}=rows,lw=p.line,ink=lw>0?` stroke="${C.ink}" stroke-width="${n(lw)}" stroke-linejoin="round"`:'',col=j=>j%2?C.seaB:C.seaA,band=pts=>`M-6 ${H+6}L${pts.map(([x,y])=>P(x,y)).join('L')}L${W+6} ${H+6}Z`;let s='';
 if(state.waveStyle==='floor'){
  // Rows recede toward the horizon; their edges bow forward like a stage apron. Column lines run to (vx, horizon); alternate columns swap the row colours.
  const off=(x,j)=>p.amplitude*(ys[j]-yh)*.35*Math.max(0,1-((x-vx)/(W*.9))**2),row=j=>{const pts=[];for(let x=-6;x<=W+6;x+=6)pts.push([x,ys[j]+off(x,j)]);return pts;},sb=W/p.frequency,ext=H+(H-yh)*.8,far=(xb,t)=>vx+(xb-vx)*t;
  let base='',swap='',cols='',lines='';for(let j=0;j<nb;j++){base+=`<path d="${band(row(j))}" fill="${col(j)}"/>`;swap+=`<path d="${band(row(j))}" fill="${col(j+1)}"/>`;}
  const t=(ext-yh)/(H-yh);for(let k=Math.floor((-W*1.2-vx)/sb);k*sb+vx<W*2.2;k++){const a=vx+k*sb,b=a+sb;if(k%2===0)cols+=`M${P(vx,yh)}L${P(far(a,t),ext)}L${P(far(b,t),ext)}Z`;lines+=`M${P(vx,yh)}L${P(far(a,t),ext)}`;}
  defs.push(`<clipPath id="${id}fc"><path d="${cols}"/></clipPath>`);s=base+`<g clip-path="url(#${id}fc)">${swap}</g>`;
  if(lw>0)s+=`<path d="${lines}${Array.from({length:nb},(_,j)=>'M'+row(j).map(([x,y])=>P(x,y)).join('L')).join('')}" fill="none" stroke="${C.ink}" stroke-width="${n(lw*.8)}"/><rect x="-6" y="${n(yh-lw/2)}" width="${W+12}" height="${n(lw)}" fill="${C.ink}"/>`;
  return {svg:s,rows};}
 s+=`<path d="M-6 ${n(yh)}H${W+6}V${H+6}H-6Z" fill="${C.seaA}"${ink}/>`;const foam=lum(C.seaA)>lum(C.seaB)?C.seaA:C.seaB;
 for(let j=1;j<nb;j++){const A=p.amplitude*(ys[j+1]-ys[j])*.9,period=W/p.frequency*(1-.5*p.depth*(1-j/(nb-1||1))),phase=j*.37,pts=edgePoints(state.waveStyle,ys[j],A,period,phase,W);s+=`<path d="${band(pts)}" fill="${col(j)}"${ink}/>`;
  if(state.waveStyle==='curl'&&A>3){const fc=col(j)===foam?(foam===C.seaA?C.seaB:C.seaA):foam;for(let k=Math.floor(phase-1);(k+.75-phase)*period<W+period;k++){const x=(k+.75-phase)*period,y=ys[j]-A;if(x<-period)continue;s+=[[.45,-.06,.08],[.6,.12,.055],[.7,.32,.04]].map(([dx,dy,r])=>`<circle cx="${n(x+A*dx)}" cy="${n(y+A*dy)}" r="${n(A*r)}" fill="${fc}"/>`).join('');}}}
 return {svg:s,rows};}

// ── Panels: proscenium curtains, columns, frame or arched window ─────────────
export function panelGeom(state,W,H){const p=state.params,pw=p.panel*W,kind=state.panel;
 if(kind==='frame'||kind==='window'){const om=Math.max(6,pw*.45),bt=Math.max(4,pw*.16),i=om+bt;return {kind,om,bt,open:{x0:i,y0:i,x1:W-i,y1:H-i}};}
 if(kind==='proscenium'){const cw=W*(.06+p.panel*.9),vh=H*(.035+p.panel*.3);return {kind,cw,vh,open:{x0:cw*.62,y0:vh,x1:W-cw*.62,y1:H}};}
 if(kind==='columns'){const m=W*.03,cw=W*(.035+p.panel*.45),lh=cw*.7,bh=cw*.6;return {kind,m,cw,lh,bh,open:{x0:m+cw,y0:m+lh,x1:W-m-cw,y1:H}};}
 return {kind:'none',open:{x0:0,y0:0,x1:W,y1:H}};}
const scallopDepth=(W,H)=>Math.min(W,H)*.07;
// Title slot: an arched band (circular, ends cut at the slot sides), a straight band, or plain letters.
export function titleGeom(state,W,H,pg){const p=state.params,o=pg.open,kind=state.band==='none'&&pg.kind==='window'?'arch':state.band;if(kind==='none')return null;
 const bh=Math.min(.1*W,.085*H)*p.titleSize,pad=pg.kind==='window'?0:Math.min(W,H)*.035,x0=o.x0+pad,x1=o.x1-pad,top=o.y0+pad+(state.edge==='scallop'?scallopDepth(W,H)*.85:0);
 if(kind==='arch'){const c=(x1-x0)/2;let s=Math.min(.16*(x1-x0),.13*H),Ro=(c*c+s*s)/(2*s);while(Ro-bh<c*1.04){s*=.85;Ro=(c*c+s*s)/(2*s);}const Ri=Ro-bh,cy=top+Ro,yo=top+s,yi=cy-Math.sqrt(Ri*Ri-c*c),cx=(x0+x1)/2;
  return {kind,bh,cx,cy,Ro,Ri,x0,x1,top,yo,yi,bottom:yi,path:`M${P(x0,yo)}A${n(Ro)} ${n(Ro)} 0 0 1 ${P(x1,yo)}L${P(x1,yi)}A${n(Ri)} ${n(Ri)} 0 0 0 ${P(x0,yi)}Z`};}
 const h=kind==='plain'?bh*1.3:bh;return {kind,bh:h,x0,x1,top,y1:top+h,bottom:top+h,path:`M${P(x0,top)}H${n(x1)}V${n(top+h)}H${n(x0)}Z`};}
function windowBoxes(state,W,H,pg){const o=pg.open,ow=o.x1-o.x0,bw=ow*(.17+state.params.panel*.95),bh=(o.y1-o.y0)*.34,ib=bh*.24;
 return {left:[o.x0,o.y1-bh,o.x0+bw,o.y1],right:[o.x1-bw,o.y1-bh,o.x1,o.y1],info:[o.x0+bw,o.y1-ib,o.x1-bw,o.y1]};}
function panelSVG(state,W,H,C,pg,title,id,defs){const tg=title?.kind==='arch'?title:titleGeom({...state,band:'arch'},W,H,pg),p=state.params,lw=Math.max(.6,p.line),ink=` stroke="${C.ink}" stroke-width="${n(lw)}"`,dark=mix(C.panel,C.ink,.3),light=mix(C.panel,'#ffffff',.18);let s='';
 if(pg.kind==='frame'||pg.kind==='window'){const {om,bt}=pg,i=om+bt,rect=(a,b,c,d)=>`M${P(a,b)}H${n(c)}V${n(d)}H${n(a)}Z`;
  if(pg.kind==='window'){const o=pg.open,boxes=windowBoxes(state,W,H,pg),three=[C.rayA,C.rayB,C.rayC],mini=(box,k)=>{const [a,b,c,d]=box,cid=`${id}w${k}`;defs.push(`<clipPath id="${cid}"><path d="${rect(a,b,c,d)}"/></clipPath>`);
     const bb=burstSVG({...state,bursts:'single'},[(a+c)/2,d],W,H,C,cid+'b',defs,{rays:{rays:'triple',modulation:'even',params:{count:Math.max(18,Math.round(p.count*.8)),rotate:0}},colors:three,sun:false});return `<g clip-path="url(#${cid})">${bb.svg}</g>`;};
   // Spandrels above the arch carry a small burst from the arch’s crown, like the side boxes.
   defs.push(`<clipPath id="${id}sp"><path d="M${P(o.x0,o.y0)}H${n(o.x1)}V${n(tg.yo)}A${n(tg.Ro)} ${n(tg.Ro)} 0 0 0 ${P(o.x0,tg.yo)}Z"/></clipPath>`);
   const crown=burstSVG({...state,bursts:'single'},[tg.cx,tg.top],W,H,C,id+'cr',defs,{rays:{rays:'triple',modulation:'even',params:{count:Math.max(24,p.count),rotate:0}},colors:three,sun:false});
   s+=`<g clip-path="url(#${id}sp)">${crown.svg}</g><path d="M${P(o.x0,o.y0)}H${n(o.x1)}V${n(tg.yo)}A${n(tg.Ro)} ${n(tg.Ro)} 0 0 0 ${P(o.x0,tg.yo)}Z" fill="none"${ink}/>`;
   for(const [k,box] of [['l',boxes.left],['r',boxes.right]])s+=mini(box,k)+`<path d="${rect(...box)}" fill="none" stroke="${C.panel}" stroke-width="${n(lw*3.2)}"/><path d="${rect(...box)}" fill="none"${ink}/>`;
   s+=`<path d="${rect(...boxes.info)}" fill="${C.panel}"${ink}/>`;}
  s=`<path d="${rect(-2,-2,W+2,H+2)}${rect(i,i,W-i,H-i)}" fill="${C.ground}" fill-rule="evenodd"/>`+s+`<path d="${rect(om,om,W-om,H-om)}${rect(i,i,W-i,H-i)}" fill="${C.panel}" fill-rule="evenodd"/><path d="${rect(om,om,W-om,H-om)}${rect(i,i,W-i,H-i)}" fill="none"${ink}/>`;}
 else if(pg.kind==='proscenium'){const {cw,vh}=pg,tie=H*.6,curtain=`M-2 -2H${n(cw)}C${P(cw*1.02,H*.28)} ${P(cw*.4,tie-H*.1)} ${P(cw*.5,tie)}C${P(cw*.6,tie+H*.12)} ${P(cw*1.02,H*.86)} ${P(cw*1.05,H+2)}H-2Z`;
  let folds='';for(let k=1;k<=6;k++){const f=k/7;folds+=`M${P(cw*f,-2)}C${P(cw*f,H*.28)} ${P(cw*.5*f,tie-H*.1)} ${P(cw*.5*f,tie)}C${P(cw*.55*f,tie+H*.12)} ${P(cw*f,H*.86)} ${P(cw*1.05*f,H+2)}`;}
  defs.push(`<clipPath id="${id}cu"><path d="${curtain}"/></clipPath>`);
  const side=`<path d="${curtain}" fill="${C.panel}"/><g clip-path="url(#${id}cu)"><path d="${folds}" fill="none" stroke="${dark}" stroke-width="${n(cw/11)}"/><path d="${folds}" fill="none" stroke="${light}" stroke-width="${n(cw/40)}" transform="translate(${n(cw/18)} 0)"/></g><path d="${curtain}" fill="none"${ink}/><rect x="-4" y="${n(tie-cw*.045)}" width="${n(cw*.6)}" height="${n(cw*.09)}" rx="${n(cw*.04)}" fill="${C.accent}"${ink}/>`;
  // Valance: swags hang between tassels; a gold fringe follows each swag.
  const S=Math.max(3,Math.round(W/(cw*1.6))),sw=W/S,top=vh*.55;let swags='';for(let i=S;i>0;i--)swags+=`Q${P((i-.5)*sw,vh*1.2)} ${P((i-1)*sw,top)}`;
  let tassels='';for(let i=0;i<=S;i++)tassels+=`<path d="M${P(i*sw,top)}l${n(-vh*.08)} ${n(vh*.42)}h${n(vh*.16)}Z" fill="${C.accent}"${ink}/>`;
  s+=side+`<g transform="matrix(-1 0 0 1 ${W} 0)">${side}</g><path d="M-2 -2H${W+2}V${n(top)}${swags}Z" fill="${C.panel}"${ink}/><path d="M${P(W,top)}${swags}" fill="none" stroke="${C.accent}" stroke-width="${n(Math.max(2,vh*.06))}" transform="translate(0 ${n(-vh*.1)})"/>${tassels}`;}
 else if(pg.kind==='columns'){const {m,cw,lh,bh}=pg,col=x=>{const sh=`<rect x="${n(x+cw*.12)}" y="${n(m+lh)}" width="${n(cw*.76)}" height="${n(H-bh-m-lh)}" fill="${C.panel}"${ink}/>`;let fl='';for(let k=1;k<=3;k++)fl+=`M${P(x+cw*(.12+.19*k),m+lh+cw*.35)}V${n(H-bh-cw*.1)}`;
   return sh+`<path d="${fl}" stroke="${dark}" stroke-width="${n(cw*.06)}"/>`+(lw>0?`<path d="${fl}" stroke="${C.ink}" stroke-width="${n(lw*.5)}" transform="translate(${n(cw*.04)} 0)"/>`:'')+`<rect x="${n(x-cw*.06)}" y="${n(m+lh)}" width="${n(cw*1.12)}" height="${n(cw*.26)}" fill="${C.panel}"${ink}/>`+[x,x+cw].map(cx=>`<circle cx="${n(cx)}" cy="${n(m+lh+cw*.26)}" r="${n(cw*.12)}" fill="${C.accent}"${ink}/>`).join('')+`<rect x="${n(x-cw*.08)}" y="${n(H-bh)}" width="${n(cw*1.16)}" height="${n(bh*.45)}" fill="${C.panel}"${ink}/><rect x="${n(x-cw*.16)}" y="${n(H-bh*.55)}" width="${n(cw*1.32)}" height="${n(bh*.6)}" fill="${C.panel}"${ink}/>`;};
  s+=col(m)+col(W-m-cw)+`<rect x="${n(m-cw*.2)}" y="${n(m)}" width="${n(W-2*m+cw*.4)}" height="${n(lh)}" fill="${C.panel}"${ink}/><rect x="${n(m-cw*.2)}" y="${n(m+lh*.62-Math.max(1.5,lh*.08)/2)}" width="${n(W-2*m+cw*.4)}" height="${n(Math.max(1.5,lh*.08))}" fill="${C.accent}"/>`;}
 return s;}

// ── Edges: clouds, a scalloped hem or bunting, inside the panel opening ──────
function edgeSVG(state,W,H,C,pg,tg,id,defs){const p=state.params,o=pg.open,ow=o.x1-o.x0,lw=p.line,rand=rng(p.seed*31+7);let s='';
 if(state.edge==='clouds'){const cloud=(x,y,size,flip)=>{const cs=[[-.42,.05,.2],[-.22,-.06,.26],[0,-.12,.3],[.24,-.04,.25],[.44,.06,.18],[-.12,.12,.2],[.14,.12,.21]].map(([dx,dy,r])=>[x+(flip?-1:1)*dx*size*(1+.1*(rand()-.5)),y+dy*size,r*size*(.9+.2*rand())]);
   return (lw>0?cs.map(([cx,cy,r])=>`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${C.ink}" stroke="${C.ink}" stroke-width="${n(lw*2)}"/>`).join(''):'')+cs.map(([cx,cy,r])=>`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${C.accent}"/>`).join('');};
  const size=ow*.21,y=o.y0+size*.42;s+=cloud(o.x0+size*.5,y,size,false)+cloud(o.x1-size*.5,y,size,true);}
 else if(state.edge==='scallop'){const d=scallopDepth(W,H),k=Math.max(4,Math.round(ow/(d*1.5))),r=ow/k/2,back=mix(C.accent,C.ink,.25);let a=`M${P(o.x0-2,o.y0-2)}H${n(o.x1+2)}V${n(o.y0+d*.45)}`,b=a,dots='';
  for(let i=k;i>0;i--){a+=`A${n(r)} ${n(r)} 0 0 1 ${P(o.x0+(i-1)*ow/k,o.y0+d*.45)}`;}for(let i=k;i>=0;i--){b+=`A${n(r)} ${n(r)} 0 0 1 ${P(Math.max(o.x0,o.x0+(i-1.5)*ow/k),o.y0+d*.7)}`;}
  for(let i=0;i<k;i++)dots+=`<circle cx="${n(o.x0+(i+.5)*ow/k)}" cy="${n(o.y0+d*.5)}" r="${n(r*.22)}" fill="${C.ground}"/>`;
  s+=`<path d="${b}Z" fill="${back}"${lw>0?` stroke="${C.ink}" stroke-width="${n(lw)}"`:''}/><path d="${a}Z" fill="${C.accent}"${lw>0?` stroke="${C.ink}" stroke-width="${n(lw)}"`:''}/>${dots}`;}
 else if(state.edge==='bunting'){const pool=[C.rayB,C.rayC,C.accent,C.sun];let last=-1;const pick=()=>{let i=Math.floor(rand()*(pool.length-(last<0?0:1)));if(last>=0&&i>=last)i++;last=i;return pool[i];},y0=(tg?tg.bottom:o.y0)+H*.03,sp=Math.max(W*.055,ow/18);
  [[0,0],[.5,H*.06]].forEach(([shift,dy],r)=>{const y=y0+dy,sag=H*.045,at=x=>y+sag*(1-((x-(o.x0+o.x1)/2)/(ow/2))**2);let line=`M${P(o.x0,at(o.x0))}`;for(let x=o.x0;x<=o.x1;x+=8)line+=`L${P(x,at(x))}`;s+=`<path d="${line}" fill="none" stroke="${C.ink}" stroke-width="${n(Math.max(1,lw*.7))}"/>`;
   for(let i=0,x=o.x0+sp*(.5+shift);x<o.x1-sp*.4;i++,x+=sp)s+=`<path d="M${P(x-sp*.36,at(x-sp*.36))}L${P(x+sp*.36,at(x+sp*.36))}L${P(x,at(x)+sp*.9)}Z" fill="${pick()}"${lw>0?` stroke="${C.ink}" stroke-width="${n(lw*.7)}" stroke-linejoin="round"`:''}/>`;});}
 if(!s)return s;defs.push(`<clipPath id="${id}oc"><rect x="${n(o.x0)}" y="${n(o.y0)}" width="${n(ow)}" height="${n(o.y1-o.y0)}"/></clipPath>`);return `<g clip-path="url(#${id}oc)">${s}</g>`;}

// ── Copy: title in its slot, information line in a small box ─────────────────
function glyphRun(text){return [...text].map(ch=>[ch,IMPACT[ch]??.55]);}
function titleSVG(state,W,H,C,pg,tg){if(!tg||state.band==='none')return '';const p=state.params,lw=Math.max(.6,p.line),run=glyphRun(state.title),em=run.reduce((a,[,w])=>a+w,0)+.04*Math.max(0,run.length-1);let s='';
 if(tg.kind==='arch'){s+=`<path d="${tg.path}" fill="${C.panel}" stroke="${C.ink}" stroke-width="${n(lw)}"/>`;if(!run.length)return s;
  const fs=tg.bh*.82,cap=fs*.79,rb=tg.Ri+(tg.bh-cap)/2,avail=2*Math.asin(Math.min(1,(tg.x1-tg.x0)/2*.9/rb))*rb,f=Math.min(1,avail/(em*fs));let at=-em*fs*f/2;
  for(const [ch,w] of run){const adv=w*fs*f,phi=-Math.PI/2+(at+adv/2)/rb,x=tg.cx+rb*Math.cos(phi),y=tg.cy+rb*Math.sin(phi);at+=adv+.04*fs*f;if(ch===' ')continue;
   s+=`<text x="${n(-adv/2)}" y="0" transform="translate(${P(x,y)}) rotate(${n(phi*180/Math.PI+90)})" font-family="${TITLE_FONT}" font-size="${n(fs)}" textLength="${n(adv)}" lengthAdjust="spacingAndGlyphs" fill="${readable(C.panel,C.ink,C.ground)}">${esc(ch)}</text>`;}
  return s;}
 const plain=tg.kind==='plain',fs=plain?tg.bh*.92:tg.bh*.8,cap=fs*.79,avail=(tg.x1-tg.x0)*(plain?1:.9),f=Math.min(1,avail/(em*fs)),y=tg.top+(tg.bh+cap)/2;
 if(!plain)s+=`<path d="${tg.path}" fill="${C.panel}" stroke="${C.ink}" stroke-width="${n(lw)}"/>`;
 if(run.length)s+=`<text x="${n((tg.x0+tg.x1)/2)}" y="${n(y)}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="${n(fs)}" textLength="${n(em*fs*f)}" lengthAdjust="spacingAndGlyphs" fill="${plain?C.ink:readable(C.panel,C.ink,C.ground)}"${plain?` stroke="${C.ground}" stroke-width="${n(fs*.09)}" stroke-linejoin="round" paint-order="stroke"`:''}>${esc(state.title)}</text>`;
 return s;}
function infoSVG(state,W,H,C,pg,tg){if(state.band==='none'||!state.info.trim())return '';const p=state.params,o=pg.open,lw=Math.max(.6,p.line);let box;
 if(pg.kind==='window')box=windowBoxes(state,W,H,pg).info;else{const ih=Math.min(W,H)*.05*Math.max(.8,p.titleSize),pad=Math.min(W,H)*.035,bw=Math.min((o.x1-o.x0)*.78,W*.62),cx=(o.x0+o.x1)/2,y1=o.y1-pad-(pg.kind==='columns'?pg.bh:0);box=[cx-bw/2,y1-ih,cx+bw/2,y1];}
 const [a,b,c,d]=box,fs=Math.min((d-b)*.42,15),est=state.info.length*fs*.64,avail=(c-a)*.86,plain=state.band==='plain';
 return (plain?'':`<path d="M${P(a,b)}H${n(c)}V${n(d)}H${n(a)}Z" fill="${C.panel}" stroke="${C.ink}" stroke-width="${n(lw)}"/>`)+`<text x="${n((a+c)/2)}" y="${n((b+d)/2+fs*.36)}" text-anchor="middle" font-family="${INFO_FONT}" font-weight="700" font-size="${n(fs)}" letter-spacing="${n(fs*.06)}"${est>avail?` textLength="${n(avail)}" lengthAdjust="spacingAndGlyphs"`:''} fill="${plain?C.ink:readable(C.panel,C.ink,C.ground)}"${plain?` stroke="${C.ground}" stroke-width="${n(fs*.22)}" stroke-linejoin="round" paint-order="stroke"`:''}>${esc(state.info)}</text>`;}

// ── Textures ──────────────────────────────────────────────────────────────
function textureDefs(state,W,H,C,id,defs){const g=state.params.grain;
 if(state.texture==='halftone')defs.push(`<pattern id="${id}ht" width="${n(g)}" height="${n(g)}" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="${n(g/2)}" cy="${n(g/2)}" r="${n(g*.27)}" fill="${C.ink}"/></pattern>`);
 if(state.texture==='grain'){const t=Math.round(40+g*10),rand=rng(state.params.seed*131+5);let d='';for(let i=0;i<t*1.6;i++){const x=rand()*t,y=rand()*t,r=.35+rand()*.8*g/6;d+=`M${P(x-r,y)}a${n(r)} ${n(r)} 0 1 0 ${n(2*r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2*r)} 0`;}defs.push(`<pattern id="${id}gr" width="${t}" height="${t}" patternUnits="userSpaceOnUse"><path d="${d}" fill="${C.ink}"/></pattern>`);}
 if(state.texture==='glow')defs.push(`<filter id="${id}gl" filterUnits="userSpaceOnUse" x="-20" y="-20" width="${W+40}" height="${H+40}"><feGaussianBlur stdDeviation="${n(g*.8)}"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);}

// ── Composition ───────────────────────────────────────────────────────────
function compose(state,W,H,id){const p=state.params,C=Object.fromEntries(KEYS.map((k,i)=>[k,state.colors[i]])),stage=state.stage,defs=[],pg=panelGeom(state,W,H),tg=titleGeom(state,W,H,pg),os=origins(state,W,H),feat={stage,bursts:os.length,origins:os.map(o=>o.map(n))};
 const ground=`<rect width="${W}" height="${H}" fill="${C.ground}"/>`;let body='';
 const first=burstSVG(state,os[0],W,H,C,id+'b',defs,{facing:facingOf(os[0],W,H)}),rows=bandRows(state,H);
 Object.assign(feat,{rays:first.geo.N,colours:first.geo.k,minRayDeg:n(Math.min(...first.geo.rays.map(r=>r.a1-r.a0))*180/Math.PI),sunRadius:n(first.rs),horizon:rows?n(rows.yh):null,bands:rows?rows.nb:0,panel:pg.kind,opening:Object.fromEntries(Object.entries(pg.open).map(([k,v])=>[k,n(v)]))});
 if(stage===1){C.ink=readable(C.ground,C.ink,C.sun,C.rayA,C.rayB);const g=first.geo,o=os[0],lw=.8;let d='';for(const r of g.rays)d+=`M${P(...o)}L${P(o[0]+first.R*Math.cos(r.a0),o[1]+first.R*Math.sin(r.a0))}`;
  let lines=`<path d="${d}" stroke="${C.ink}" stroke-width="${lw}" opacity=".55" fill="none"/>`;g.rays.forEach(r=>{const m=(r.a0+r.a1)/2,rr=Math.min(W,H)*.2;lines+=`<circle cx="${n(o[0]+rr*Math.cos(m))}" cy="${n(o[1]+rr*Math.sin(m))}" r="3" fill="${[C.rayA,C.rayB,C.rayC][r.c]}" stroke="${C.ink}" stroke-width=".6"/>`;});
  if(state.outline!=='edge')lines+=`<path d="${outlinePath(o,g,p.reach*(first.R-4),state.outline)}" fill="none" stroke="${C.ink}" stroke-width="1" stroke-dasharray="5 4"/>`;
  if(first.rs>.5)lines+=`<circle cx="${n(o[0])}" cy="${n(o[1])}" r="${n(first.rs)}" fill="none" stroke="${C.ink}" stroke-width="1.4" stroke-dasharray="6 4"/>`;
  lines+=`<path d="M${P(o[0]-14,o[1])}h28M${P(o[0],o[1]-14)}v28" stroke="${C.ink}" stroke-width="1.6"/>`;
  body+=ground+mirrored(state,W,H,lines,id+'m',defs);
  if(rows)body+=`<path d="${rows.ys.slice(0,-1).map(y=>`M0 ${n(y)}H${W}`).join('')}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="${rows.ys.length>2?'8 5':'0'}"/><path d="M0 ${n(rows.yh)}H${W}" stroke="${C.ink}" stroke-width="1.8"/>`;
  const o2=pg.open;if(pg.kind!=='none')body+=`<rect x="${n(o2.x0)}" y="${n(o2.y0)}" width="${n(o2.x1-o2.x0)}" height="${n(o2.y1-o2.y0)}" fill="none" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="3 3"/>`;
  if(tg)body+=`<path d="${tg.path}" fill="none" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="7 4"/>`;}
 else{
  // Pass 2 is the rays alone; the sun joins the stage in pass 3. Overprint prints the sun and sea over the rays in multiply, slightly off register.
  const over=stage===4&&state.texture==='overprint';body+=ground+mirrored(state,W,H,first.svg+(over||stage<3?'':first.sun),id+'m',defs);
  if(stage>=3){textureDefs(state,W,H,C,id,defs);const hz=horizonSVG(state,W,H,C,os[0][0],id+'h',defs);let stageArt=hz.svg+(stage===4&&state.texture==='halftone'?`<rect width="${W}" height="${H}" fill="url(#${id}ht)" opacity=".2"/>`:'');
   const edges=edgeSVG(state,W,H,C,pg,tg,id+'e',defs),panels=panelSVG(state,W,H,C,pg,tg,id+'p',defs);
   // A sun wholly outside its (half-)page is dropped: resvg cannot bound an empty clipped group.
   const [hx,hy]=[state.bursts==='twin'?W/2+3:W,state.bursts==='stack'?H/2+3:H],reach=first.rs*(1.4+.17*p.rings),seen=first.sun&&os[0][0]+reach>-2&&os[0][0]-reach<hx&&os[0][1]+reach>-2&&os[0][1]-reach<hy;
   if(over)stageArt=`<g style="mix-blend-mode:multiply" transform="translate(${n(p.grain*.35)} ${n(p.grain*.2)})">${seen?mirrored(state,W,H,first.sun,id+'m3',defs):''}${hz.svg}</g>`;
   const top=(pg.kind==='proscenium'?edges+panels:panels+edges)+(stage===4?titleSVG(state,W,H,C,pg,tg)+infoSVG(state,W,H,C,pg,tg):'');
   body+=stage===4&&state.texture==='glow'?`<g filter="url(#${id}gl)">${stageArt}${top}</g>`:stageArt+top;
   if(stage===4&&state.texture==='grain')body+=`<rect width="${W}" height="${H}" fill="url(#${id}gr)" opacity=".28"/>`;}}
 feat.titleSlot=tg?{kind:tg.kind,path:tg.path,...(tg.kind==='arch'?{cx:n(tg.cx),cy:n(tg.cy),outer:n(tg.Ro),inner:n(tg.Ri)}:{x0:n(tg.x0),y0:n(tg.top),x1:n(tg.x1),y1:n(tg.bottom)})}:null;
 return {body:`<defs>${defs.join('')}</defs>${body}`,features:feat};}

const STAGES={1:'construction lines',2:'ray burst',3:'stage',4:'poster'};
export function canvasSize(state){const f=FORMATS.find(x=>x.id===state.format)??FORMATS[0];return [f.w,f.h];}
// `page` ({width, height}) overrides the format, for tiles and boards.
export function render(input={},page){const state=resolve(input),[fw,fh]=canvasSize(state),W=page?.width??fw,H=page?.height??fh,id='r'+hash(JSON.stringify(state)+W+'x'+H+(page?.id??''))+'-',c=compose(state,W,H,id),name=FAMILIES.find(f=>f.id===state.family).name;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${name}: ${c.features.rays} ${state.rays==='triple'?'three':'two'}-colour rays, ${state.panel} panels, ${STAGES[state.stage]}`)}"><title>${esc(state.title||name)} — rising-ray stage, ${esc(STAGES[state.stage])}</title>${c.body}</svg>`;
 return {svg,state,width:W,height:H,features:c.features};}

// The kit: every part of the construction as small tiles in the family’s style.
export const SPECIMEN_ROWS=[
 {name:'Ray widths',key:'modulation',tiles:OPTIONS.modulation.map(v=>({label:OPTION_LABELS.modulation[v],set:{modulation:v,params:{modulate:.85}}}))},
 {name:'Ray fills',tiles:[...OPTIONS.pattern.map(v=>({label:OPTION_LABELS.pattern[v],set:{pattern:v}})),{label:'Three colours',set:{rays:'triple'}}]},
 {name:'Ray ends',key:'outline',tiles:OPTIONS.outline.map(v=>({label:OPTION_LABELS.outline[v],set:{outline:v,params:{reach:.62,count:20}}}))},
 {name:'Suns',key:'sunStyle',tiles:OPTIONS.sunStyle.map(v=>({label:OPTION_LABELS.sunStyle[v],set:{sunStyle:v,params:{sun:.28,rings:4,originY:.6,horizon:.74}}}))},
 {name:'Horizons',key:'waveStyle',tiles:OPTIONS.waveStyle.map(v=>({label:OPTION_LABELS.waveStyle[v],set:{waveStyle:v,params:{horizon:.55,waves:4,amplitude:.8,frequency:v==='floor'?6:2.5,depth:.5}}}))},
 {name:'Panels',key:'panel',tiles:OPTIONS.panel.map(v=>({label:OPTION_LABELS.panel[v],set:{panel:v,params:{panel:.12}}}))},
 {name:'Origins and edges',tiles:[{label:'Twin bursts',set:{bursts:'twin',params:{originX:.1,originY:.7,horizon:.7}}},{label:'Stacked bursts',set:{bursts:'stack',params:{originX:.5,originY:.18,horizon:1.1}}},{label:'Corner origin',set:{params:{originX:0,originY:1,sun:.4,horizon:1.1}}},{label:'Clouds',set:{edge:'clouds'}},{label:'Bunting',set:{edge:'bunting'}}]}
];
export function specimen(input={}){const base=resolve({...input,stage:4}),tw=200,th=270,lab=34,cols=5,head=40,rowH=th+lab+16,w=cols*(tw+16)+16,h=SPECIMEN_ROWS.length*(rowH+head)+16,ink=lum(base.colors[0])>.3?'#222':'#eee',bg=lum(base.colors[0])>.3?'#f4f3ef':'#141318';let s='';
 SPECIMEN_ROWS.forEach((row,ri)=>{const y=16+ri*(rowH+head);s+=`<text x="16" y="${y+24}" font-family="${INFO_FONT}" font-size="18" font-weight="700" fill="${ink}">${esc(row.name)}</text>`;
  row.tiles.forEach((t,ci)=>{const x=16+ci*(tw+16),st={...base,...t.set,band:'none',params:{...base.params,line:Math.min(base.params.line,1.6),...t.set.params}},r=render(st,{width:tw,height:th,id:`s${ri}-${ci}`});
   s+=`<g data-part="${esc(t.label)}"><svg x="${x}" y="${y+head}" width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}">${r.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</svg><text x="${x}" y="${y+head+th+22}" font-family="${INFO_FONT}" font-size="14" fill="${ink}">${esc(t.label)}</text></g>`;});});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${s}</svg>`;}
