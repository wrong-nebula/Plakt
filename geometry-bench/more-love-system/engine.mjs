/* More Love / Weltformat — reciprocal module type system.
 * Construction study after New Studio. Every letter, including the measured
 * N E W / S T U / D I O, is built from one shared kit: a body with optional
 * tips or notches, an elliptical counter, straight cuts, and stems or bars.
 * These are new interpretations, not recovered production outlines.
 */
import {n,rectD,slotD,frameD,notchD,familyPath,build,intersect,smooth,bounds,polyD} from './geometry.mjs';

export const ENGINE='more-love-v2';
export const SOURCE={id:'1b448f29749cfb8bf715e524-p0',title:'More Love / Weltformat',credit:'New Studio',url:'https://www.instagram.com/p/CUC3415sU0N/',crop:[328,158,1095,1226],field:[767,1068]};
export const FAMILIES=[
 {id:'reciprocal',name:'Reciprocal arcs',palette:'Cobalt / pale rose',colors:['#2047bd','#f2a6c1'],note:'Concave shoulders and elliptical counters. The closest geometry to the reference.'},
 {id:'lens',name:'Tensioned lenses',palette:'Mulberry / celadon',colors:['#622d52','#c5e4bf'],note:'The same curve handles pulled toward their chords. Counters become taut, pointed lenses.'},
 {id:'chamfer',name:'Chamfered curves',palette:'Lagoon / acid yellow',colors:['#153f46','#e0ed86'],note:'Every shared curve replaced by measured facets. Shoulders and counters change together.'}
];
export const CONTROLS=[
 {key:'curve',label:'Curve fullness',min:.55,max:1.2,step:.01,value:1},
 {key:'reach',label:'Tip reach',min:.5,max:1.4,step:.01,value:1},
 {key:'weight',label:'Frame weight',min:.7,max:1.35,step:.01,value:1},
 {key:'gap',label:'Cut width',min:.4,max:1.8,step:.01,value:1},
 {key:'soft',label:'Corner softness',min:0,max:2,step:.01,value:1},
 {key:'tracking',label:'Letter spacing',min:.4,max:1.7,step:.01,value:1},
 {key:'bands',label:'Band height',min:.65,max:1.35,step:.01,value:1}
];
export const LETTERS_AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ',FIGURES='0123456789',PUNCTUATION=".,:;-–!?'",CHARACTERS=LETTERS_AZ+FIGURES+PUNCTUATION;
export const SOURCE_NAME='NEW STUDIO';
// Measured cells [letter, x, cap top, width, cap height] in the 767 × 1068 field.
export const SOURCE_ROWS=[['N',41,62,245,185],['E',292,62,185,185],['W',479,62,245,185],['S',77,447,185,185],['T',292,447,190,185],['U',504,447,185,185],['D',60,823,215,185],['I',275,823,185,185],['O',460,823,245,185]];
const ROW_TOPS=[62,447,823],CAP=185,FIELD_W=767,FIELD_H=1068;

// Construction kit. Units: cap height = 100. Horizontal frames (tips left and
// right) are 82 wide; vertical frames (tips top and bottom) are 100 wide and
// 74 tall, so their tips reach past the cap line as in the reference.
export function metrics(params){
 const t=20*params.weight,R=26*params.reach;
 return {t,s:18*params.weight,g:8*params.gap,R,e:.35*R,convex:3.2*params.soft,fillet:4.5*params.soft};
}
// `counter` is [x1,y1,x2,y2,rx?,ry?]; omitted radii make an ellipse; false
// means the shape has no counter. A tip pushes the counter past its side into
// the tip, as in the reference.
function kit(P,box,tips='',counter){
 const [x0,y0,x1,y1]=box,reach={},has=s=>tips.includes(s);for(const s of tips)reach[s]=P.R;
 const c=counter===false?null:counter??[has('L')?x0-P.e:x0+P.t,has('T')?y0-P.e:y0+P.t,has('R')?x1+P.e:x1-P.t,has('B')?y1+P.e:y1-P.t];
 const cx=(x0+x1)/2,cy=(y0+y1)/2,far=P.R+8,g=P.g,guides=[['box',rectD(x0,y0,x1,y1)],...(c?[['counter',slotD(...c)]]:[])];
 // Depth of the counter boundary seen from one side at `at`, so a slit stops
 // just inside the counter and never notches a bar or stem behind it.
 const edge=(side,at)=>{if(!c)return null;const [a,b,e,f]=c,h=side==='T'||side==='B',lo=h?a:b,hi=h?e:f,half=(hi-lo)/2,r=(h?c[4]:c[5])??half,q=(h?c[5]:c[4])??(h?(f-b)/2:(e-a)/2);
  if(at<=lo||at>=hi)return null;const d=Math.abs(at-(lo+hi)/2)-(half-r),inset=d<=0?0:q-q*Math.sqrt(Math.max(0,1-(d/r)**2));
  return {T:b+inset+1.5,B:f-inset-1.5,L:a+inset+1.5,R:e-inset-1.5}[side];};
 const cutRect=(side,a,b,deep)=>{const m=deep?null:edge(side,(a+b)/2);
  return side==='T'?rectD(a,y0-far,b,m??cy):side==='B'?rectD(a,m??cy,b,y1+far):side==='L'?rectD(x0-far,a,m??cx,b):rectD(m??cx,a,x1+far,b);};
 return {box,x0,y0,x1,y1,cx,cy,c,P,guides,
  frame:()=>['+',frameD(box,reach)],
  hole:(...q)=>{const d=slotD(...(q.length?q:c));if(q.length)guides.push(['counter',d]);return ['-',d];},
  cut:(side,at)=>{const d=cutRect(side,at-g/2,at+g/2);guides.push(['cut',d]);return ['-',d];},
  open:(side,a,b)=>{const d=cutRect(side,a,b,true);guides.push(['cut',d]);return ['-',d];},
  notch:(side,at,half,depth)=>{const d=notchD(side,box,at,half,depth);guides.push(['cut',d]);return ['-',d];}
 };
}
const H=(P,tips='LR',w=82)=>kit(P,[0,0,w,100],tips),V=(P,tips='TB')=>kit(P,[0,13,100,87],tips);
const add=d=>['+',d],sub=d=>['-',d];

// Each glyph: the shared frame, then cuts and inner parts in order.
const GLYPHS={
 // Measured source letters.
 N:P=>{const k=H(P);return [k,[k.frame(),k.hole(),k.cut('T',41),k.cut('B',41),add(rectD(41+P.g/2,27,41+P.g/2+P.s,99)),add(slotD(24,27,41+P.g/2+P.s,27+2*P.s*.72,P.s*.72,P.s*.72))]];},
 E:P=>{const k=V(P);return [k,[k.frame(),k.hole(),k.cut('L',50),k.open('R',50-P.g/2,72),add(rectD(2,50+P.g/2,72,50+P.g/2+P.s*.8))]];},
 W:P=>{const k=H(P);return [k,[k.frame(),k.hole(),k.cut('B',29),k.open('T',29,55),add(rectD(29+P.g/2,30,29+P.g/2+P.s,99))]];},
 S:P=>{const k=V(P),y=44;return [k,[k.frame(),k.hole(),k.open('L',y-2,62),k.open('R',34,y),add(slotD(22,y,98,y+P.s*.8,P.s*.4,P.s*.4))]];},
 T:P=>{const k=kit(P,[0,0,100,100],'',[P.t,P.t,100-P.t,150]),x=36+P.g/2;return [k,[k.frame(),k.hole(P.t,P.t,100-P.t,150,30,30),sub(rectD(-5,63,105,130)),k.cut('T',36),add(rectD(x,P.t/2,x+P.s,87)),add(rectD(23,86,73,100))]];},
 U:P=>{const k=kit(P,[0,0,100,87],'B',[P.t,-30,100-P.t,87+P.e]);return [k,[k.frame(),k.hole(P.t,-30,100-P.t,87+P.e,50-P.t,40),k.notch('L',38,11,9),k.notch('R',38,11,9),add(rectD(41,0,59,62))]];},
 D:P=>{const k=kit(P,[0,0,88,100],'R',[42,P.t,88+P.e,100-P.t]),st=24;return [k,[k.frame(),k.hole(),sub(rectD(-5,54,st,105)),sub(rectD(st-P.g,P.t,st,54)),sub(rectD(st-P.g,P.t-.5,42.5,P.t+P.g*.75)),k.cut('T',48)]];},
 I:P=>{const k=V(P);return [k,[k.frame(),k.hole(),k.open('L',31,69),k.open('R',31,69),add(rectD(39,17,61,83))]];},
 O:P=>{const k=H(P);return [k,[k.frame(),k.hole(),k.cut('T',41),k.cut('B',41),add(rectD(10,50-P.s/2,72,50+P.s/2))]];},
 // Extensions in the same vocabulary.
 A:P=>{const k=kit(P,[0,13,100,100],'T',[P.t,13-P.e,100-P.t,140,50-P.t,36]);return [k,[k.frame(),k.hole(),add(rectD(8,58,92,58+P.s*.8))]];},
 B:P=>{const k=kit(P,[0,0,80,100],'',[P.t,P.t,80-P.t,50-P.s*.35]),m=50;return [k,[k.frame(),k.notch('R',m,30,13),k.hole(),k.hole(P.t,m+P.s*.35,80-P.t,100-P.t),k.cut('T',40)]];},
 C:P=>{const k=kit(P,[0,0,82,100],'L');return [k,[k.frame(),k.hole(),k.open('R',33,67),k.cut('T',41)]];},
 F:P=>{const k=kit(P,[0,0,78,100],'');return [k,[k.frame(),k.hole(P.t,P.t,150,150,24,24),k.cut('T',40),add(rectD(2,45,62,45+P.s*.85))]];},
 G:P=>{const k=kit(P,[0,0,82,100],'L');return [k,[k.frame(),k.hole(),k.open('R',28,50),k.cut('T',41),add(rectD(42,50,80,50+P.s*.85))]];},
 H:P=>{const k=kit(P,[0,0,82,100],'LR',[P.t,-40,82-P.t,140]);return [k,[k.frame(),k.hole(P.t,-40,82-P.t,140,6,6),add(rectD(8,50-P.s/2,74,50+P.s/2))]];},
 J:P=>{const k=kit(P,[0,0,100,87],'B',[P.t,-30,100-P.t,87+P.e]);return [k,[k.frame(),k.hole(P.t,-30,100-P.t,87+P.e,50-P.t,40),k.open('L',-10,52),k.notch('R',38,11,9)]];},
 // K is the right half of X's four notches, with a stem for its left half.
 K:P=>{const k=kit(P,[0,0,90,100],''),a=P.t+4,b=74;return [k,[k.frame(),k.notch('T',(a+b)/2,(b-a)/2,40),k.notch('B',(a+b)/2,(b-a)/2,40),k.notch('R',50,32,32)]];},
 L:P=>{const k=kit(P,[0,0,72,100],'');return [k,[k.frame(),k.hole(P.t,-40,140,100-P.t,22,22),k.cut('L',30)]];},
 // M takes H's tipped stems under one top bar, with a short centre leg.
 M:P=>{const k=kit(P,[0,0,98,100],'LR',[P.t,P.t,49-P.s/2,150,14,20]),m=49;return [k,[k.frame(),k.hole(),k.hole(m+P.s/2,P.t,98-P.t,150,14,20),sub(rectD(m-P.s/2-1,68,m+P.s/2+1,110))]];},
 P:P=>{const k=kit(P,[0,0,82,64],'R',[P.t,P.t*.8,82+P.e*.8,64-P.t*.8]);return [k,[k.frame(),k.hole(),k.cut('T',41),add(rectD(0,30,P.t,100))]];},
 Q:P=>{const k=H(P);return [k,[k.frame(),k.hole(),k.cut('T',41),k.cut('B',41),add(rectD(41+P.g/2,66,41+P.g/2+P.s,112))]];},
 R:P=>{const k=kit(P,[0,0,82,64],'R',[P.t,P.t*.8,82+P.e*.8,64-P.t*.8]);return [k,[k.frame(),k.hole(),k.cut('T',41),add(rectD(0,30,P.t,100)),add(rectD(46,50,46+P.s,100))]];},
 // V narrows to the bottom tip: one deep notch, where U keeps a round counter and a pill.
 V:P=>{const k=kit(P,[0,0,100,87],'B',false);return [k,[k.frame(),k.notch('T',50,31,86),k.notch('L',30,18,14),k.notch('R',30,18,14)]];},
 X:P=>{const k=kit(P,[0,0,92,100],'');return [k,[k.frame(),k.notch('T',46,30,40),k.notch('B',46,30,40),k.notch('L',50,32,32),k.notch('R',50,32,32)]];},
 Y:P=>{const k=kit(P,[0,0,100,56],'');return [k,[k.frame(),k.notch('T',50,30,42),k.notch('L',56,26,30),k.notch('R',56,26,30),add(rectD(41,38,59,100))]];},
 // Z mirrors S's spine on a flat-sided frame, so the two never share a silhouette.
 Z:P=>{const k=kit(P,[0,0,92,100],'',[P.t,P.t,92-P.t,100-P.t,22,26]),y=43;return [k,[k.frame(),k.hole(),k.open('R',y-2,64),k.open('L',32,y),add(slotD(2,y,70,y+P.s*.8,P.s*.4,P.s*.4))]];},
 // Figures. Each keeps clear of its letter look-alike: 0 is O turned upright
 // (top and bottom tips, side cuts, no bar); 1 carries a tip as its flag; 2
 // has a top tip and a diagonal spine where Z has a flat frame; 7 keeps the
 // source D's hooked top corner; 5 and 6 share
 // a flat top bar over a tipped bowl; 8 is notched at the waist on both sides.
 0:P=>{const k=kit(P,[0,13,84,87],'TB');return [k,[k.frame(),k.hole(),k.cut('L',50),k.cut('R',50)]];},
 1:P=>{const k=kit(P,[0,0,70,100],'',false),x=28;return [k,[add(rectD(x,0,x+P.t,100)),add(frameD([x,0,x+P.t,46],{L:P.R})),add(rectD(8,86,66,100))]];},
 2:P=>{const k=kit(P,[0,13,96,100],'T',[P.t,13-P.e,96-P.t,100-P.t]),b=100-P.t;return [k,[k.frame(),k.hole(),k.open('L',40,b),k.open('R',56,b),add(polyD([[[96-P.t,38],[96,38],[96,58],[P.t+18,b+1],[0,b+1]]]))]];},
 3:P=>{const k=V(P);return [k,[k.frame(),k.hole(),k.open('L',32,68),add(rectD(34,50-P.s*.4,98,50+P.s*.4)),k.notch('R',50,14,9)]];},
 4:P=>{const k=kit(P,[0,0,92,100],'',[P.t,-30,54,56,(54-P.t)/2,20]),y=56,h=P.s*.9;return [k,[k.frame(),k.hole(),sub(rectD(-5,y+h,54,105)),sub(rectD(54+P.t,-5,97,y)),sub(rectD(54+P.t,y+h,97,105))]];},
 5:P=>{const m=40,k=kit(P,[0,0,96,87],'B',[P.t,m+P.s,96-P.t,87+P.e]);return [k,[k.frame(),k.hole(P.t,P.t,140,m,10,10),k.hole(),k.open('L',m+P.s,74)]];},
 6:P=>{const m=40,k=kit(P,[0,0,96,87],'B',[P.t,m+P.s,96-P.t,87+P.e]);return [k,[k.frame(),k.hole(P.t,P.t,140,m,10,10),k.hole(),sub(rectD(62,-5,105,P.t+.5))]];},
 7:P=>{const k=kit(P,[0,0,92,100],'',[P.t,P.t,92-P.t,150,10,10]);return [k,[k.frame(),k.hole(),sub(rectD(-5,38,97,130)),sub(rectD(-5,32,46,130)),add(polyD([[[92-P.t,30],[92,30],[92,38],[30+P.t*1.15,99],[30,99]]]))]];},
 8:P=>{const k=kit(P,[0,13,100,87],'TB',[P.t,13-P.e,100-P.t,50-P.s*.35]);return [k,[k.frame(),k.hole(),k.hole(P.t,50+P.s*.35,100-P.t,87+P.e),k.notch('L',50,14,10),k.notch('R',50,14,10)]];},
 9:P=>{const m=40,k=kit(P,[0,13,96,100],'T',[P.t,13-P.e,96-P.t,100-m-P.s]);return [k,[k.frame(),k.hole(),k.hole(-40,100-m,96-P.t,100-P.t,10,10),sub(rectD(-5,100-P.t-.5,34,105))]];}
};
// Clear alternates for the two source letters that do not read outside the
// source poster. Both take M's tipped stems: N has one counter open below and
// one open above, so its diagonal steps from top left to bottom right; W is
// M turned upside down.
const ALTERNATES={N:'N.clear',W:'W.clear'};
Object.assign(GLYPHS,{
 'N.clear':P=>{const m=48,k=kit(P,[0,0,96,100],'LR',[P.t,P.t+6,m-P.s/2,150,12,18]);return [k,[k.frame(),k.hole(),k.hole(m+P.s/2,-50,96-P.t,94-P.t,12,18)]];},
 'W.clear':P=>{const k=kit(P,[0,0,98,100],'LR',[P.t,-50,49-P.s/2,100-P.t,14,20]),m=49;return [k,[k.frame(),k.hole(),k.hole(m+P.s/2,-50,98-P.t,100-P.t,14,20),sub(rectD(m-P.s/2-1,-10,m+P.s/2+1,32))]];}
});
// Punctuation: square dots the size of the frame weight, hyphen and dash as
// bars with short tips, and a question mark on the 2's tipped arch.
const dot=(P,x,y)=>add(rectD(x,y,x+P.t+2,y+P.t+2)),tail=P=>add(polyD([[[(P.t+2)*.35,99],[P.t+2,99],[(P.t+2)*.5,112],[0,112]]])),bare=P=>kit(P,[0,0,P.t+2,100],'',false);
Object.assign(GLYPHS,{
 '.':P=>[bare(P),[dot(P,0,98-P.t)]],
 ',':P=>[bare(P),[dot(P,0,98-P.t),tail(P)]],
 ':':P=>[bare(P),[dot(P,0,32),dot(P,0,98-P.t)]],
 ';':P=>[bare(P),[dot(P,0,32),dot(P,0,98-P.t),tail(P)]],
 '-':P=>[kit(P,[0,41,44,59],'LR',false),[add(frameD([0,50-P.s/2,44,50+P.s/2],{L:P.R*.45,R:P.R*.45}))]],
 '–':P=>[kit(P,[0,41,74,59],'LR',false),[add(frameD([0,50-P.s/2,74,50+P.s/2],{L:P.R*.45,R:P.R*.45}))]],
 '!':P=>[bare(P),[add(rectD(0,0,P.t+2,64)),dot(P,0,98-P.t)]],
 '?':P=>{const k=kit(P,[0,13,84,62],'T',[P.t,13-P.e,84-P.t,62-P.t*.8]);return [k,[k.frame(),k.hole(),k.open('L',34,80),add(rectD(30,48,30+P.s,70)),add(rectD(30,80,30+P.s,100))]];},
 "'":P=>[bare(P),[add(rectD(0,0,P.t+2,34))]]
});
export const FORMS=[{id:'auto',label:'Auto: source N and W only for NEW STUDIO'},{id:'source',label:'Source N and W'},{id:'clear',label:'Clear N and W'}];
const variant=(ch,state)=>ALTERNATES[ch]&&(state.forms==='clear'||(state.forms!=='source'&&state.name!==SOURCE_NAME))?ALTERNATES[ch]:ch;
export const GLYPH_NOTES={N:'source',E:'source',W:'source',S:'source',T:'source',U:'source',D:'source',I:'source',O:'source'};

const cache=new Map();
// Final ink for one letter: booleans in order, then one corner pass.
export function glyphGeometry(ch,state){
 ch=variant(ch,state);const key=ch+JSON.stringify([state.family,state.params.curve,state.params.reach,state.params.weight,state.params.gap,state.params.soft]);
 if(cache.has(key))return cache.get(key);
 const P=metrics(state.params),[k,ops]=GLYPHS[ch](P),shape=d=>familyPath(d,state.family,state.params.curve);
 const polys=smooth(build(ops,shape),P.convex,P.fillet),[x0,y0,x1,y1]=bounds(polys);
 const frame=shape(k.frame()[1]),result={d:polyD(polys),polys,bounds:[x0,y0,x1,y1],guides:k.guides.map(([kind,d])=>[kind,kind==='box'?shape(d):intersect(shape(d),frame)])};
 if(cache.size>600)cache.clear();cache.set(key,result);return result;
}
export function glyph(ch,state,ink){
 const g=glyphGeometry(ch,state);
 if(state.stage!==1)return `<path d="${g.d}" fill="${ink}"/>`;
 const style={box:`fill="none" stroke="${ink}" stroke-width=".5" opacity=".35"`,counter:`fill="none" stroke="${ink}" stroke-width=".5" stroke-dasharray="2 2" opacity=".55"`,cut:`fill="${ink}" opacity=".16"`};
 return g.guides.map(([kind,d])=>`<path d="${d}" ${style[kind]}/>`).join('')+`<path d="${g.d}" fill="none" stroke="${ink}" stroke-width=".9"/>`;
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const rect=(x,y,w,h,c,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}" ${extra}/>`;
const path=(d,c,extra='')=>`<path d="${d}" fill="${c}" ${extra}/>`;
// Both fields take A–Z, 0–9, spaces and . , : ; - – ! ? '; the display
// lettering also takes '/' for a new row. Curly quotes and the em dash fold to
// their plain forms.
export function normalizeWord(v,fallback='',{rows=false}={}){
 let s=String(v??fallback).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[‘’]/g,"'").replace(/—/g,'–').toUpperCase().trim().replace(/ +/g,' ');
 if(rows)s=s.replace(/ *\/ */g,'/').replace(/^\/+|\/+$/g,'');
 if(!s)throw new Error('Enter at least one letter.');
 if(!(rows?/^[A-Z0-9 .,:;\-–!?'/]+$/:/^[A-Z0-9 .,:;\-–!?']+$/).test(s))throw new Error(rows?"Use A–Z, 0–9, . , : ; - – ! ? ' and / for a new row.":"Use A–Z, 0–9 and . , : ; - – ! ? '.");
 if(s.replace(/[ /]/g,'').length>12)throw new Error('Keep each field to 12 characters or fewer.');
 if(rows&&s.split('/').length>3)throw new Error('Use at most three rows.');
 return s;
}
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],params={};
 for(const c of CONTROLS){const value=Number(input.params?.[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(value)?value:c.value));}
 const color=(x,f)=>/^#[a-f\d]{6}$/i.test(x??'')?x:f;
 return {version:2,engine:ENGINE,forms:FORMS.some(f=>f.id===input.forms)?input.forms:'auto',first:normalizeWord(input.first,'MORE'),second:normalizeWord(input.second,'LOVE'),name:normalizeWord(input.name,SOURCE_NAME,{rows:true}),family:family.id,params,colors:family.colors.map((c,i)=>color(input.colors?.[i],c)),invert:!!input.invert,stage:Math.min(4,Math.max(1,Math.round(Number(input.stage)||4)))};
}
// Split the display lettering into one to three rows. '/' forces breaks.
// Otherwise up to three letters sit on one row, four make two rows (FU / BU),
// and longer lettering is shared evenly over three rows, as NEW / STU / DIO.
// Whole words win when they need at most one more letter per row.
export function splitRows(name){
 if(name.includes('/'))return name.split('/').map(r=>[...r.replaceAll(' ','')]).filter(r=>r.length);
 const letters=[...name.replaceAll(' ','')],count=letters.length<=3?1:letters.length===4?2:3,rows=[];let offset=0;
 for(let j=0;j<count;j++){const take=Math.ceil((letters.length-offset)/(count-j));rows.push(letters.slice(offset,offset+take));offset+=take;}
 const words=name.split(' '),even=Math.max(...rows.map(r=>r.length));let best=null;
 const group=(i,acc)=>{if(i===words.length){const max=Math.max(...acc.map(w=>w.length));if(!best||max<best.max||(max===best.max&&acc.length>best.rows.length))best={max,rows:acc};return;}
  for(let j=i+1;j<=words.length;j++)if(acc.length<3)group(j,[...acc,words.slice(i,j).join('')]);};
 if(words.length>1&&words.length<=12)group(0,[]);
 return best&&best.max<=even+1?best.rows.map(r=>[...r]):rows;
}
// Vertical frame for the rows and the two bands. One and three rows keep the
// source slots (bands at 304 and 682). Two rows pair the bands in the middle
// (row / band / band / row) and let each row grow to fill its half.
export function bandCenters(count,state){
 const h=92*state.params.bands;if(count!==2)return [304+46,682+46];
 const mid=FIELD_H/2;return [mid-h/2-12,mid+h/2+12];
}
// Rows share one cap height. Letters are spaced by their real ink width.
// Two-row layouts fit each row's whole ink, tips included, between the
// bands and the fixed credit lines.
export function wordRows(name,state){
 const space=6*state.params.tracking;
 if(name===SOURCE_NAME)return SOURCE_ROWS.map(([ch,x,y,w,h],i)=>{const [a,,b]=glyphGeometry(ch,state).bounds,em=h/100;return [ch,x+w/2+(i%3-1)*14*(state.params.tracking-1)-(a+b)/2*em,y,em];});
 const rows=splitRows(name),geo=rows.map(r=>r.map(ch=>glyphGeometry(ch,state).bounds)),widths=geo.map(r=>r.reduce((s,[a,,b])=>s+b-a,0)+space*(r.length-1));
 const fitW=Math.min(...widths.map(w=>(FIELD_W-64)/w*100))/100;let em,tops;
 if(rows.length===2){const h=92*state.params.bands,[c1,c2]=bandCenters(2,state),regions=[[40,c1-h/2-22],[c2+h/2+22,1030]],ink=geo.map(r=>[Math.min(...r.map(g=>g[1])),Math.max(...r.map(g=>g[3]))]);
  em=Math.min(fitW,...ink.map(([lo,hi],j)=>(regions[j][1]-regions[j][0])/(hi-lo)));tops=ink.map(([lo,hi],j)=>regions[j][0]+(regions[j][1]-regions[j][0]-(hi-lo)*em)/2-lo*em);}
 else{em=Math.min(CAP/100,fitW);const slots=rows.length===1?[ROW_TOPS[1]]:ROW_TOPS;tops=slots.map(y=>y+(CAP-em*100)/2);}
 return rows.flatMap((row,j)=>{let x=(FIELD_W-widths[j]*em)/2;
  return row.map((ch,i)=>{const [a,,b]=geo[j][i],cell=[ch,x-a*em,tops[j],em];x+=(b-a+space)*em;return cell;});});
}
// Supporting band typography uses clean extended grotesque contours. It is
// deliberately independent of the reciprocal display alphabet.
const SANS={
 A:'M0 100L36 0H64L100 100H74L66 73H34L26 100ZM41 51H59L50 22Z',
 M:'M0 100V0H27L50 63L73 0H100V100H78V32L59 100H41L22 32V100Z',
 O:'M50 0C82 0 100 17 100 50C100 83 82 100 50 100C18 100 0 83 0 50C0 17 18 0 50 0ZM50 24C31 24 25 33 25 50C25 67 31 76 50 76C69 76 75 67 75 50C75 33 69 24 50 24Z',
 R:'M0 100V0H58C87 0 100 13 100 29C100 45 91 53 80 56C97 60 94 83 100 100H73C68 85 76 66 55 66H25V100ZM25 22V43H58C69 43 73 39 73 33C73 26 69 22 58 22Z',
 E:'M0 0H100V22H26V39H82V61H26V78H100V100H0Z',L:'M0 0H28V78H100V100H0Z',
 V:'M0 0H28L50 76L72 0H100L66 100H34Z',
 N:'M0 100V0H27L75 64V0H100V100H74L25 36V100Z',
 W:'M0 0H23L33 70L43 0H59L69 70L79 0H100L83 100H59L50 45L41 100H17Z',
 S:'M98 11L87 32C71 17 23 18 26 34C28 45 100 30 100 69C100 108 25 108 0 87L13 66C32 82 76 84 74 69C73 58 0 71 0 31C0 -3 68 -8 98 11Z',
 U:'M0 0H26V62C26 82 74 82 74 62V0H100V65C100 112 0 112 0 65Z',
 T:'M0 0H100V24H63V100H37V24H0Z',D:'M0 0H48C82 0 100 18 100 50C100 82 82 100 48 100H0ZM26 24V76H48C67 76 75 67 75 50C75 33 67 24 48 24Z',
 I:'M0 0H100V22H65V78H100V100H0V78H35V22H0Z',F:'M0 0H100V24H26V42H84V66H26V100H0Z',
 B:'M0 0H57C102 0 105 36 78 48C110 56 105 100 58 100H0ZM26 22V39H54C75 39 75 22 54 22ZM26 61V78H55C78 78 78 61 55 61Z',
 H:'M0 0H26V38H74V0H100V100H74V63H26V100H0Z',C:'M98 12L85 35C49 7 23 27 23 50C23 73 49 93 85 65L98 88C47 125 0 95 0 50C0 5 47 -25 98 12Z',
 G:'M98 12L85 35C49 7 23 27 23 50C23 80 58 90 77 73V62H52V41H100V86C53 124 0 98 0 50C0 5 47 -25 98 12Z',
 J:'M73 0H100V68C100 112 0 112 0 68V57H27V66C27 83 73 83 73 66Z',K:'M0 0H26V38L68 0H100L50 48L100 100H67L26 60V100H0Z',
 P:'M0 100V0H57C114 0 114 66 57 66H26V100ZM26 23V43H55C78 43 78 23 55 23Z',Q:'M50 0C115 0 115 100 50 100C-15 100 -15 0 50 0ZM50 24C16 24 16 76 50 76C84 76 84 24 50 24ZM58 65H80L100 100H78Z',
 X:'M0 0H29L50 34L71 0H100L66 50L100 100H71L50 66L29 100H0L34 50Z',Y:'M0 0H29L50 39L71 0H100L63 64V100H37V64Z',Z:'M0 0H100V23L35 77H100V100H0V77L65 23H0Z',
 0:'M30 0H70C88 0 100 14 100 34V66C100 86 88 100 70 100H30C12 100 0 86 0 66V34C0 14 12 0 30 0ZM36 24C30 24 26 28 26 36V64C26 72 30 76 36 76H64C70 76 74 72 74 64V36C74 28 70 24 64 24Z',
 1:'M44 0H70V78H96V100H18V78H44V28L16 40V18Z',
 2:'M4 30C8 10 26 0 50 0C78 0 98 12 98 32C98 50 84 58 62 66L36 76V78H100V100H0V72C0 58 16 50 44 40C64 33 72 31 72 30C72 25 66 22 50 22C38 22 30 26 28 34Z',
 3:'M2 28C8 8 28 0 50 0C78 0 98 10 98 28C98 40 90 46 80 50C92 54 100 62 100 74C100 92 80 100 50 100C22 100 4 92 0 70L26 66C28 74 36 78 50 78C66 78 74 74 74 70C74 64 66 61 52 61H38V40H52C64 40 72 37 72 31C72 26 64 22 50 22C38 22 30 26 28 32Z',
 4:'M60 0H86V60H100V82H86V100H60V82H0V60L48 0ZM60 60V26L32 60Z',
 5:'M8 0H96V22H32L30 38C38 34 46 33 56 33C84 33 100 46 100 66C100 88 82 100 52 100C24 100 4 90 0 70L26 66C28 74 38 78 52 78C68 78 74 74 74 66C74 58 66 55 52 55C42 55 34 58 30 62H4Z',
 6:'M96 24C88 8 72 0 52 0C18 0 0 20 0 52C0 84 18 100 52 100C80 100 100 86 100 64C100 44 84 32 58 32C44 32 32 36 26 44C28 28 38 22 52 22C62 22 70 26 74 32ZM52 54C68 54 74 58 74 66C74 74 68 78 52 78C36 78 28 74 28 66C28 58 36 54 52 54Z',
 7:'M0 0H100V22L46 100H16L68 22H0Z',
 8:'M50 0C80 0 98 10 98 28C98 38 92 45 82 49C94 53 100 61 100 73C100 92 80 100 50 100C20 100 0 92 0 73C0 61 6 53 18 49C8 45 2 38 2 28C2 10 20 0 50 0ZM50 20C34 20 28 24 28 30C28 36 34 40 50 40C66 40 72 36 72 30C72 24 66 20 50 20ZM50 59C34 59 26 63 26 70C26 77 34 80 50 80C66 80 74 77 74 70C74 63 66 59 50 59Z',
 '.':'M0 74H26V100H0Z',',':'M0 74H26V100L16 116H0L8 100H0Z',':':'M0 26H26V52H0ZM0 74H26V100H0Z',';':'M0 26H26V52H0ZM0 74H26V100L16 116H0L8 100H0Z',
 '-':'M0 39H60V61H0Z','–':'M0 39H92V61H0Z','!':'M0 0H26V64H0ZM0 74H26V100H0Z',"'":'M0 0H26V34H0Z',
 '?':'M2 30C6 10 24 0 50 0C78 0 98 12 98 30C98 46 84 52 64 58V66H38V44C58 40 72 38 72 30C72 24 64 22 50 22C38 22 30 26 28 34ZM38 74H64V100H38Z'
};
// The band 9 is the 6 turned half a turn. Narrow marks keep narrow advances.
SANS[9]=SANS[6].replace(/([MLC])([^MLCHVZ]+)|([HV])(-?[\d.]+)/g,(m,c,pts,hv,v)=>c?c+pts.trim().split(/\s+/).map(Number).map(x=>100-x).join(' '):hv+(100-Number(v)));
const ADVANCE={' ':60,'.':30,',':30,':':30,';':30,'-':64,'–':96,'!':30,"'":30};
const advance=ch=>ADVANCE[ch]??100;
// Set a line of the band grotesque across width w, keeping each mark's advance.
function sansLine(text,x,y,w,h,gap,ink){const chars=[...text],unit=w/(chars.reduce((s,ch)=>s+advance(ch),0)+gap*Math.max(0,chars.length-1));let at=x;
 return chars.map(ch=>{const g=`<g transform="translate(${n(at)} ${n(y)}) scale(${n(unit)} ${n(h/100)})">${path(SANS[ch]??'',ink,'fill-rule="evenodd"')}</g>`;at+=(advance(ch)+gap)*unit;return g;}).join('');}
const bandText=(text,x,y,w,h,ink)=>sansLine(text,x,y,w,h,8,ink),micro=(text,x,y,w,ink)=>sansLine(text,x,y,w,5.5,25,ink);
export function render(input={}){
 const state=resolve(input),[paper,ink]=state.invert?[state.colors[1],state.colors[0]]:state.colors,W=718,H=1000,scale=1000/1068;let body='';
 const rows=wordRows(state.name,state);
 for(const [ch,x,y,em] of rows)body+=`<g data-glyph="${ch}" transform="translate(${n(x)} ${n(y)}) scale(${n(em)})">${glyph(ch,state,ink)}</g>`;
 const count=state.name===SOURCE_NAME?3:splitRows(state.name).length;
 if(state.stage===1){for(const y of new Set(rows.map(r=>r[2])))body+=path(`M28 ${n(y)}H739M28 ${n(y+rows.find(r=>r[2]===y)[3]*100)}H739`,'none',`stroke="${ink}" stroke-width=".4" opacity=".35"`);}
 if(state.stage>=3)for(const [text,cy] of [state.first,state.second].map((t,i)=>[t,bandCenters(count,state)[i]])){const h=92*state.params.bands;body+=rect(0,cy-h/2,FIELD_W,h,ink)+bandText(text,16,cy-h*.325,735,h*.65,paper);}
 if(state.stage===4){body+=micro('NEW STUDIO',16,18,142,ink)+micro('WELTFORMAT',606,18,142,ink)+micro('ON BEHALF OF WELTFORMAT GRAPHIC DESIGN FESTIVAL, LUCERNE 9.10.–17.10.2021',16,1043,560,ink)+micro('MORE LOVE',612,1043,128,ink);}
 const label=state.name.replaceAll('/',' / '),desc=`${label}. ${state.first} / ${state.second}. ${state.family} reciprocal module system. Stage ${state.stage}. Study after New Studio.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}"><title>${esc(state.first)} / ${esc(state.second)} — reciprocal modules</title><desc>${esc(desc)}</desc>${rect(0,0,W,H,paper)}<g transform="scale(${n(scale)})">${body}</g></svg>`;
 return {svg,state,width:W,height:H,rows,features:{family:state.family,stage:state.stage,primaryCharacters:state.name.replace(/[ /]/g,'').length,rows:splitRows(state.name).length,layout:state.name===SOURCE_NAME?'source-proportions':'transferred-words'}};
}
// A–M, N–Z, then figures, punctuation and the other pair of N and W forms,
// all at one cap height.
export function specimen(input={}){
 const state=resolve(input),[paper,ink]=state.invert?[state.colors[1],state.colors[0]]:state.colors,s2={...state,stage:2},em=.62,gap=7;
 const other={...s2,forms:variant('N',s2)==='N'?'clear':'source'},rows=[[...LETTERS_AZ.slice(0,13)].map(c=>[c,s2]),[...LETTERS_AZ.slice(13)].map(c=>[c,s2]),[...FIGURES+PUNCTUATION].map(c=>[c,s2]).concat([[' '],['N',other],['W',other]])];
 let body='',w=0;rows.forEach((row,j)=>{let x=24;for(const [ch,st] of row){if(!st){x+=24*em;continue;}const g=glyphGeometry(ch,st);body+=`<g transform="translate(${n(x-g.bounds[0]*em)} ${30+j*100}) scale(${em})">${path(g.d,ink)}</g>`;x+=(g.bounds[2]-g.bounds[0]+gap)*em;}w=Math.max(w,x+16);});
 const W=Math.ceil(w),H=40+rows.length*100;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rect(0,0,W,H,paper)}${body}</svg>`;
}
