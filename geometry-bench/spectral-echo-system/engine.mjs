/* Spectral echo glyphs — type system study after Mitsuo Katsui and Koichi Sato.
 * A glyph is repeated N times. Copy t ∈ (0, 1] is the core glyph moved by one
 * composed transform — translate along an angle, rotate, stretch about an
 * anchor — scaled by t^curve, while its colour walks an OKLCH hue ramp and its
 * opacity fades. Radial mode spreads copies round a circle (chromatic split),
 * slice mode cuts the glyph into bands that each shift and take their own hue
 * (Katsui’s smeared ONE), prism mode fills the core with the spectrum (Sato).
 * Outlines come from fonts.mjs; nothing is traced from the posters.
 */
import {FONTS} from './fonts.mjs';
export const ENGINE='spectral-echo-v1';
export const SOURCES=[
 {id:'pgda-18073',family:'bloom'},{id:'pgda-19891',family:'smear'},{id:'moma-5045',family:'prism'},{id:'pgda-12430'}
];
export const W=728,H=1030;
export const FONT_LIST=Object.entries(FONTS).map(([id,f])=>({id,name:f.name,license:f.license}));
const echo0={count:16,spread:0,stretchX:0,stretchY:0,angle:0,rotate:0,curve:1,slices:16,smear:.4,waves:1,hue:200,range:300,chroma:.17,light:.72,opacity:.5,fade:.3,glow:0,size:1,tracking:.02,leading:1};
// Palette roles: ground, ink (the core glyph), accent (gradient ground, prism shadow).
export const FAMILIES=[
 {id:'bloom',name:'Spectral bloom',after:'Mitsuo Katsui, Letters and Life',text:'雨/木',colors:['#f7f6f2','#1d2533','#c9d7ef'],
  set:{mode:'linear',font:'hiragino',layout:'rows',anchor:'alternate',core:'solid',style:'fill',blend:'normal',ground:'plain',params:{...echo0,count:26,stretchX:1.25,stretchY:.22,curve:1.1,hue:195,range:290,chroma:.15,light:.74,opacity:.3,fade:.15,size:1}},
  note:'Every copy stretches wider about the stem — upward from the base on the first row, downward from the top on the next — in translucent spectral layers under a dark core.'},
 {id:'smear',name:'Spectral smear',after:'Mitsuo Katsui, 1: Design for the Next',text:'ONE',colors:['#0b0b0d','#f4f1ea','#3a1d5c'],
  set:{mode:'slices',font:'archivo',layout:'turned',anchor:'center',core:'none',style:'fill',blend:'screen',ground:'plain',params:{...echo0,count:3,spread:.05,angle:0,slices:22,smear:.11,waves:1.2,hue:10,range:320,chroma:.22,light:.66,opacity:.85,fade:.3,glow:.8,size:.92}},
  note:'Letters cut into thin bands; each band shifts sideways on a slow wave and takes the next colour of the spectrum, smearing the word like light through a prism.'},
 {id:'prism',name:'Prism windows',after:'Koichi Sato, The Modern Poster',text:'THE/MOD/ERN/POS/TER',colors:['#ffffff','#121212','#121212'],
  set:{mode:'prism',font:'anton',layout:'grid',anchor:'center',core:'solid',style:'fill',blend:'normal',ground:'plain',params:{...echo0,count:1,spread:.05,angle:45,hue:290,range:-260,chroma:.2,light:.7,opacity:1,fade:0,size:1,tracking:0}},
  note:'Letters spread across a grid as windows onto one spectrum, each with a hard black offset shadow.'},
 {id:'trail',name:'Neon trail',after:'new — electro',text:'RAVE',colors:['#07060b','#fff8ff','#2a0b45'],
  set:{mode:'linear',font:'unbounded',layout:'rows',anchor:'center',core:'solid',style:'line',blend:'screen',ground:'gradient',params:{...echo0,count:18,spread:.9,angle:200,curve:.9,hue:320,range:210,chroma:.25,light:.7,opacity:.9,fade:.55,glow:2.4,size:1}},
  note:'A white-hot core trailing outline echoes that cool from magenta through violet to cyan, with glow.'},
 {id:'split',name:'Chromatic split',after:'new — RGB aberration',text:'SPLIT/SIGNAL',colors:['#000000','#ffffff','#101010'],
  set:{mode:'radial',font:'archivo',layout:'rows',anchor:'center',core:'none',style:'fill',blend:'screen',ground:'plain',params:{...echo0,count:3,spread:.13,angle:90,hue:29,range:360,chroma:.3,light:.64,opacity:1,fade:0,glow:.6,size:1}},
  note:'Three to six copies offset round a small circle in additive primaries — misregistered light that recombines to white where they overlap.'},
 {id:'tunnel',name:'Zoom tunnel',after:'new — vanishing echo',text:'ECHO',colors:['#110a22','#f2ff4d','#3b1670'],
  set:{mode:'linear',font:'mono',layout:'rows',anchor:'center',core:'outline',style:'line',blend:'screen',ground:'gradient',params:{...echo0,count:22,spread:.55,angle:90,stretchX:-.8,stretchY:-.8,curve:.8,hue:300,range:-240,chroma:.22,light:.72,opacity:.95,fade:.6,glow:1.5,size:.95}},
  note:'Each copy smaller and higher, receding to a vanishing point: outline letters falling into a neon tunnel.'},
 {id:'orbit',name:'Orbit fan',after:'new — rotation',text:'SPIN',colors:['#f3eee4','#1a1a1a','#e8d9c4'],
  set:{mode:'linear',font:'anton',layout:'rows',anchor:'bottom',core:'solid',style:'fill',blend:'multiply',ground:'plain',params:{...echo0,count:14,rotate:-70,curve:1,hue:20,range:230,chroma:.16,light:.76,opacity:.42,fade:.25,size:1,tracking:.08}},
  note:'Copies swing round the foot of each letter like a hand fan, warm to cool.'}
];
export const CONTROLS=[
 {key:'count',label:'Copies',group:'echo',min:1,max:64,step:1},
 {key:'spread',label:'Travel',group:'echo',min:0,max:2,step:.01},
 {key:'angle',label:'Direction',group:'echo',min:0,max:360,step:1},
 {key:'stretchX',label:'Stretch across',group:'echo',min:-.95,max:3,step:.01},
 {key:'stretchY',label:'Stretch up',group:'echo',min:-.95,max:2,step:.01},
 {key:'rotate',label:'Turn',group:'echo',min:-180,max:180,step:1},
 {key:'curve',label:'Easing',group:'echo',min:.3,max:3,step:.01},
 {key:'slices',label:'Bands',group:'echo',min:2,max:48,step:1,modes:['slices']},
 {key:'smear',label:'Band shift',group:'echo',min:0,max:1.5,step:.01,modes:['slices']},
 {key:'waves',label:'Band waves',group:'echo',min:0,max:4,step:.05,modes:['slices']},
 {key:'hue',label:'Start hue',group:'colour',min:0,max:360,step:1},
 {key:'range',label:'Hue walk',group:'colour',min:-720,max:720,step:1},
 {key:'chroma',label:'Chroma',group:'colour',min:0,max:.37,step:.005},
 {key:'light',label:'Lightness',group:'colour',min:.2,max:.95,step:.01},
 {key:'opacity',label:'Opacity',group:'colour',min:.03,max:1,step:.01},
 {key:'fade',label:'Fade',group:'colour',min:0,max:1,step:.01},
 {key:'glow',label:'Glow',group:'colour',min:0,max:8,step:.1},
 {key:'size',label:'Letter size',group:'layout',min:.4,max:1.6,step:.01},
 {key:'tracking',label:'Tracking',group:'layout',min:-.1,max:.6,step:.005},
 {key:'leading',label:'Row spacing',group:'layout',min:.6,max:2,step:.01}
];
export const OPTIONS={mode:['linear','radial','slices','prism'],layout:['rows','column','turned','grid'],anchor:['center','top','bottom','left','right','alternate'],core:['solid','outline','none'],style:['fill','line'],blend:['multiply','screen','normal','difference'],ground:['plain','gradient','spectrum'],font:Object.keys(FONTS)};
export const n=v=>Math.round(v*100)/100;

// OKLCH → sRGB hex, reducing chroma until the colour fits the sRGB gamut.
function oklchRGB(L,C,h){const a=C*Math.cos(h*Math.PI/180),b=C*Math.sin(h*Math.PI/180),l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];}
export function oklch(L,C,h){let c=C,rgb=oklchRGB(L,c,h);for(let i=0;i<24&&rgb.some(v=>v<-1e-4||v>1+1e-4);i++){c*=.88;rgb=oklchRGB(L,c,h);}
 return '#'+rgb.map(v=>{v=Math.max(0,Math.min(1,v));v=v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;return Math.round(v*255).toString(16).padStart(2,'0');}).join('');}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),luminance=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
export const inkFor=ground=>luminance(ground)>.22?'#141414':'#f4f1ea';
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);

// Text: any character of the chosen face; Japanese falls back to Hiragino. '/' breaks up to five rows.
export function glyphFor(ch,font){return FONTS[font]?.glyphs[ch]?{font,g:FONTS[font].glyphs[ch]}:FONTS.hiragino.glyphs[ch]?{font:'hiragino',g:FONTS.hiragino.glyphs[ch]}:null;}
export function normalizeText(input,font='archivo',fallback){
 // NFKC folds fullwidth Latin (ＡＢ) and halfwidth katakana into the forms the faces carry.
 const t=String(input??'').normalize('NFKC').replace(/[‘’`´]/g,"'").replace(/\s*\/\s*/g,'/').replace(/[ \t]+/g,' ').trim(),up=FONTS[font]&&!/[a-z]/.test(Object.keys(FONTS[font].glyphs).join(''))?t.toUpperCase():t;
 if(!up){if(fallback!==undefined)return fallback;throw new Error('Type at least one character.');}
 const bad=[...new Set([...up].filter(ch=>ch!=='/'&&ch!==' '&&!glyphFor(ch,font)))];if(bad.length)throw new Error(`Not in ${FONTS[font]?.name??font} or the Japanese set: ${bad.join(' ')}`);
 const rows=up.split('/');if(rows.length>5)throw new Error('Use at most five rows.');if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if([...up.replace(/[ /]/g,'')].length>24)throw new Error('Use at most 24 characters.');return rows.map(r=>r.trim()).join('/');}

const clampNum=(v,c,d)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):d;
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,params={};
 for(const c of CONTROLS)params[c.key]=clampNum(input.params?.[c.key],c,set.params[c.key]);
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k],font=pick('font');let text;try{text=normalizeText(input.text,font,family.text);}catch{text=family.text;}
 const colors=Array.isArray(input.colors)&&input.colors.length===3&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&]/g,'').slice(0,max):d;
 return {engine:ENGINE,family:family.id,text,title:clip(input.title,'SPECTRAL ECHO GLYPHS',48),info:clip(input.info,'Type system study after Mitsuo Katsui and Koichi Sato / copies, transforms and a walking hue',120),
  stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,mode:pick('mode'),font,layout:pick('layout'),anchor:pick('anchor'),core:pick('core'),style:pick('style'),blend:pick('blend'),ground:pick('ground'),params,colors};}

// Layout in glyph units (1000 per em, y down, baseline 0): one entry per glyph with its origin.
export function layout(state){const p=state.params,rows=state.text.split('/'),cap=FONTS[state.font].capHeight||700,items=[],em=1000;
 const line=state.layout==='column'?em*1.04*p.leading:cap*1.42*p.leading;
 if(state.layout==='column'){rows.forEach((row,c)=>{[...row].forEach((ch,i)=>{const f=glyphFor(ch,state.font);if(!f)return;items.push({ch,...f,row:c,x:-c*em*1.15*p.leading-f.g.adv/2,y:i*line,adv:f.g.adv});});});return {items,cap,line};}
 const widths=rows.map(r=>[...r].reduce((w,ch)=>w+(glyphFor(ch,state.font)?.g.adv??0)+p.tracking*em,-p.tracking*em)),maxW=Math.max(...widths);
 // Grid spreads each row's letters across one wide measure, as Sato's letters hold the poster's edges.
 rows.forEach((row,r)=>{const chars=[...row],grid=state.layout==='grid',gap=grid&&chars.length>1?(maxW*1.8-widths[r])/(chars.length-1):0;let x=grid?(chars.length>1?-maxW*.4:(maxW-widths[r])/2):(maxW-widths[r])/2;
  chars.forEach(ch=>{const f=glyphFor(ch,state.font);if(!f)return;if(ch!==' ')items.push({ch,...f,row:r,x,y:r*line*(grid?1.3:1),adv:f.g.adv});x+=f.g.adv+p.tracking*em+gap;});});
 return {items,cap,line};}

// Copies of one glyph: [t, transform about the anchor, hue fraction, band] from back to front.
function copies(state,item,capH){const p=state.params,list=[],a=anchorPoint(state,item,capH),rad=Math.PI/180,count=state.mode==='prism'?Math.min(p.count,8):p.count;
 for(let i=count;i>=1;i--){const t=(i/count)**p.curve;let dx,dy;
  if(state.mode==='radial'){const ang=(p.angle+360*i/count)*rad;dx=Math.cos(ang)*p.spread*capH*.6;dy=Math.sin(ang)*p.spread*capH*.6;}
  else{dx=Math.cos(p.angle*rad)*p.spread*capH*t;dy=-Math.sin(p.angle*rad)*p.spread*capH*t;}
  const sx=state.mode==='radial'?1:1+p.stretchX*t,sy=state.mode==='radial'?1:1+p.stretchY*t,r=state.mode==='radial'?0:p.rotate*t;
  // Radial copies share the hue circle evenly, so three copies at a 360° walk land on red, green and blue.
  list.push({t:state.mode==='radial'?(i-1)/count:t,m:affine(a,dx,dy,r,sx,sy)});}
 return list;}
// Matrix for translate(dx,dy)·rotate(r)·scale(sx,sy) about anchor a, as SVG matrix(a b c d e f).
function affine([ax,ay],dx,dy,r,sx,sy){const c=Math.cos(r*Math.PI/180),s=Math.sin(r*Math.PI/180),A=c*sx,B=s*sx,C=-s*sy,D=c*sy;return [A,B,C,D,ax+dx-(A*ax+C*ay),ay+dy-(B*ax+D*ay)];}
const mat=m=>`matrix(${m.map(v=>n(v*1000)/1000).join(' ')})`;
const box=(m,w,top,bottom)=>[[0,-top],[w,-top],[w,bottom],[0,bottom]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);

function fit(points,bx){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),[bx0,by0,bx1,by1]=bx;
 const k=Math.min((bx1-bx0)/Math.max(1e-6,x1-x0),(by1-by0)/Math.max(1e-6,y1-y0));return {k,x:bx0+(bx1-bx0-(x1-x0)*k)/2-x0*k,y:by0+(by1-by0-(y1-y0)*k)/2-y0*k,bounds:[x0,y0,x1,y1]};}
const boxFor=stage=>stage===4?[44,176,W-44,H-56]:[44,56,W-44,H-56];

// Draws the glyphs and their echoes into the poster box.
function drawText(state,bx,uid){const p=state.params,{items,cap}=layout(state),[ground,ink,accent]=state.colors,stage=state.stage,parts=[],defs=[],feat={glyphs:items.length,copies:0};
 const hueAt=t=>p.hue+p.range*t,colorAt=t=>oklch(p.light,p.chroma,hueAt(t)),opAt=t=>n(Math.max(.02,p.opacity*(1-p.fade*t)));
 // Bounds of every copy, for fitting; a turned layout reads downward, rotated a quarter turn.
 const turn=state.layout==='turned',rot=([x,y])=>turn?[-y,x]:[x,y],pts=[];
 const per=items.map(it=>{const fnt=FONTS[it.font],top=Math.max(fnt.capHeight||cap,cap)*1.02,bottom=Math.max(0,-fnt.descent*.15),cs=copies(state,it,cap);
  pts.push(...box([1,0,0,1,0,0],it.adv,top,bottom).map(([x,y])=>rot([x+it.x,y+it.y])));if(stage>1)for(const c of cs)pts.push(...box(c.m,it.adv,top,bottom).map(([x,y])=>rot([x+it.x,y+it.y])));return {it,cs,top,bottom};});
 // Fit every copy into the box, then scale by Letter size about the box centre.
 const F=fit(pts,bx),cx=(bx[0]+bx[2])/2,cy=(bx[1]+bx[3])/2,place=`translate(${n(cx)} ${n(cy)}) scale(${n(p.size*1000)/1000}) translate(${n(-cx)} ${n(-cy)}) translate(${n(F.x)} ${n(F.y)}) scale(${n(F.k*1000)/1000})${turn?' rotate(90)':''}`;
 const used=new Map();for(const {it} of per){const id=`g${uid}-${used.size}`;if(!used.has(it.font+it.ch)){used.set(it.font+it.ch,id);defs.push(`<path id="${id}" d="${it.g.d}"/>`);}}
 const ref=it=>used.get(it.font+it.ch),blend=stage===4&&state.blend!=='normal'?` style="mix-blend-mode:${state.blend}"`:'',lineW=n(Math.max(6,cap*.012)/Math.max(.2,p.size));
 // Prism: one spectrum runs down the whole text block. A gradient is painted in
 // each glyph's own coordinates, so every glyph gets the segment at its position.
 const [bx0,by0,bx1,by1]=F.bounds,[g0,g1]=turn?[-bx1,-bx0]:[by0,by1],spectrum=it=>{const id=`spec${uid}-${n(it.y)}`;if(!defs.some(d=>d.includes(`id="${id}"`)))defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(g0-it.y)}" x2="0" y2="${n(g1-it.y)}">${Array.from({length:13},(_,i)=>`<stop offset="${n(i/12)}" stop-color="${colorAt(i/12)}"/>`).join('')}</linearGradient>`);return `url(#${id})`;};
 const echo=[],core=[];
 for(const {it,cs,top,bottom} of per){const at=`translate(${n(it.x)} ${n(it.y)})`,id=ref(it);
  if(stage>=2)for(const c of cs){feat.copies++;
   if(stage===2){echo.push(`<use href="#${id}" transform="${at} ${mat(c.m)}" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width="${lineW}"/>`);continue;}
   const col=state.mode==='prism'?accent:colorAt(c.t),op=opAt(c.t),line=state.style==='line';
   if(state.mode==='slices'){const bands=p.slices,h=(top+bottom)/bands;for(let j=0;j<bands;j++){const y=-top+j*h,shift=p.smear*cap*Math.sin((j/bands)*Math.PI*2*p.waves+c.t*Math.PI)*(.35+.65*c.t),bc=colorAt((j/bands+c.t*.35)%1);
     defs.push(`<clipPath id="b${uid}-${feat.copies}-${j}"><rect x="${n(it.x-2000)}" y="${n(it.y+y-.5)}" width="${n(it.adv+4000)}" height="${n(h+1)}"/></clipPath>`);
     echo.push(`<g clip-path="url(#b${uid}-${feat.copies}-${j})"><use href="#${id}" transform="${at} translate(${n(shift)} 0) ${mat(c.m)}" ${line?`fill="none" stroke="${bc}" stroke-width="${lineW}"`:`fill="${bc}"`} opacity="${op}"${blend}/></g>`);}continue;}
   echo.push(`<use href="#${id}" transform="${at} ${mat(c.m)}" ${line&&state.mode!=='prism'?`fill="none" stroke="${col}" stroke-width="${lineW}"`:`fill="${col}"`} opacity="${op}"${blend}/>`);}
  if(state.core!=='none'||stage<3){const fill=state.mode==='prism'&&stage>=3?spectrum(it):ink;core.push(state.core==='outline'&&stage>=3?`<use href="#${id}" transform="${at}" fill="none" stroke="${ink}" stroke-width="${lineW}"/>`:`<use href="#${id}" transform="${at}" fill="${fill}"${stage===1?' fill-opacity=".9"':''}/>`);}
  if(stage===1){const [ax,ay]=anchorPoint(state,it,cap);echo.push(`<circle cx="${n(it.x+ax)}" cy="${n(it.y+ay)}" r="${n(cap*.03)}" fill="#ff3b6b"/>`);}}
 const glow=stage===4&&p.glow>0;if(glow)defs.push(`<filter id="glow${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${n(p.glow*cap*.012)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
 parts.push(`<defs>${defs.join('')}</defs><g transform="${place}"><g${glow?` filter="url(#glow${uid})"`:''}>${echo.join('')}</g><g>${core.join('')}</g></g>`);
 return {svg:parts.join(''),features:{...feat,scale:n(F.k*p.size*1000)/1000}};}
function anchorPoint(state,it,cap){const top=FONTS[it.font].capHeight||cap,w=it.adv,a=state.anchor==='alternate'?(it.row%2?'top':'bottom'):state.anchor;return {center:[w/2,-top/2],top:[w/2,-top],bottom:[w/2,0],left:[0,-top/2],right:[w,-top/2]}[a];}

function headerSVG(state,ink){const lines=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,3),esc=s=>s.replace(/[<>&]/g,'');
 return `<g font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" fill="${ink}"><text x="44" y="68" font-size="21" letter-spacing=".6">${esc(state.title)}</text><path d="M44 80H${W-44}" stroke="${ink}" stroke-width=".8"/>${lines.map((l,i)=>`<text x="44" y="${102+i*16}" font-size="11.5" letter-spacing=".2">${esc(l)}</text>`).join('')}</g>`;}
const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
function groundSVG(state,uid){const [ground,,accent]=state.colors,p=state.params;
 if(state.stage===4&&state.ground==='gradient')return `<linearGradient id="gr${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ground}"/><stop offset="1" stop-color="${accent}"/></linearGradient><rect width="${W}" height="${H}" fill="url(#gr${uid})"/>`;
 if(state.stage===4&&state.ground==='spectrum')return `<linearGradient id="gr${uid}" x1="0" y1="0" x2="0" y2="1">${Array.from({length:13},(_,i)=>`<stop offset="${n(i/12)}" stop-color="${oklch(Math.min(.95,p.light+.12),p.chroma*.75,p.hue+p.range*i/12)}"/>`).join('')}</linearGradient><rect width="${W}" height="${H}" fill="url(#gr${uid})"/>`;
 return `<rect width="${W}" height="${H}" fill="${ground}"/>`;}

export function render(input={}){const state=resolve(input),uid=uidOf(state),drawn=drawText(state,boxFor(state.stage),uid),ink=inkFor(state.colors[0]);
 const label={1:'glyphs and anchors',2:'copy transforms',3:'spectrum',4:'poster'}[state.stage];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${state.text.replaceAll('/',' / ')} — spectral echo glyphs, ${state.family}, ${label}</title>${groundSVG(state,uid)}<g data-stage="${state.stage}">${drawn.svg}</g>${state.stage===4?headerSVG(state,ink):''}</svg>`;
 return {svg,state,width:W,height:H,features:{...drawn.features,rows:state.text.split('/').length,stage:state.stage}};}

// Every glyph of the chosen face in the family style, one cell each at one scale.
export function specimen(input={}){const state=resolve({...input,stage:3}),chars=Object.keys(FONTS[state.font].glyphs).filter(c=>c!==' '&&/[A-Z0-9!?&]/.test(c)).slice(0,40),cols=10,cw=190,ch=250,w=cols*cw+40,h=Math.ceil(chars.length/cols)*ch+40,uid=uidOf(state);
 const cells=chars.map((c,i)=>{const s={...state,text:c,layout:'rows',params:{...state.params,size:1}},bx=[20+(i%cols)*cw+16,20+Math.floor(i/cols)*ch+16,20+(i%cols+1)*cw-16,20+(Math.floor(i/cols)+1)*ch-16];return `<g data-glyph="${c.replace(/["'<>&]/g,m=>'&#'+m.charCodeAt(0)+';')}">${drawText(s,bx,uid+'-'+i).svg}</g>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${state.colors[0]}"/>${cells.join('')}</svg>`;}
