/* RKC disc / counter study. Original procedural interpretation of the visible
 * vocabulary in the December RKC poster by Giliane Cachin + Viltė Jurgutytė.
 * No source contours are traced. Colour placement follows an explicit glyph map.
 */
import {ALPHABET as STARTER_ALPHABET} from '../letter-shape-systems/engine.mjs';

export const SOURCE = {
 id:'5e5b65b8f544582ee0f267dd-p0',
 title:'RKC — December programme',
 credit:'Giliane Cachin + Viltė Jurgutytė',
 url:'https://www.instagram.com/p/CXfo2KfIzF1/',
 basis:'Source credit transcribed from the archived library caption. Tile construction is a visual interpretation, not recovered authoring data.'
};
// Preserve the earlier hand-authored alphabet; change the construction algebra.
export const GLYPHS = {...STARTER_ALPHABET};
export const KERNELS=[
 {id:'disc',name:'Discs / half-discs',note:'Circular arcs and D-shaped caps: the closest vocabulary to the reference.'},
 {id:'pillow',name:'Soft square / half-pillow',note:'Replace the circular perimeter with a rounded square; keep the same tile map and connections.'},
 {id:'facet',name:'Octagon / half-octagon',note:'Replace each curved arc with a chamfer; the same rules become a faceted alphabet.'}
];
export const CONTROLS=[
 {key:'seam',label:'Gap between tiles',min:0,max:.18,step:.005,value:.018},
 {key:'join',label:'Counter bridge',min:0,max:.42,step:.01,value:.18},
 {key:'cut',label:'Half-disc cut',min:0,max:.46,step:.01,value:.16},
 {key:'phase',label:'Module phase',min:0,max:2,step:1,value:0}
];
export const DEFAULT_COLORS=['#ed432e','#eee2bc','#696247'];
const n=x=>Number(x.toFixed(5));
const safeColor=(x,f)=>/^#[\da-f]{6}$/i.test(x??'')?x:f;
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra}/>`;
const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function normalize(input='R'){
 const text=String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\r?\n/g,'/');
 if(!text.replace(/[ /]/g,''))throw new Error('Enter at least one letter.');
 const bad=[...new Set([...text].filter(c=>!/[A-Z0-9 /-]/.test(c)))];
 if(bad.length)throw new Error(`Use A–Z, 0–9, spaces or / for a new row. Unsupported: ${bad.join(' ')}`);
 if(text.replaceAll('/','').length>24||text.split('/').length>4)throw new Error('Use up to 24 characters and four rows.');
 return text;
}
export function resolve(input={}){
 const params={};for(const c of CONTROLS){const v=Number(input.params?.[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:c.value));if(c.step===1)params[c.key]=Math.round(params[c.key]);}
 return {version:1,engine:'rkc-disc-counter-v1',text:normalize(input.text),kernel:KERNELS.some(k=>k.id===input.kernel)?input.kernel:'disc',
  params,colors:DEFAULT_COLORS.map((c,i)=>safeColor(input.colors?.[i],c)),invert:!!input.invert,
  stage:Math.min(4,Math.max(1,Math.round(Number(input.stage)||4)))};
}
function on(a,x,y){return x>=0&&x<5&&y>=0&&y<7&&a[y][x]==='1';}
// Ports ordered N/E/S/W. No random module rotations: orientation follows joins.
export function tileMap(character,params={}){
 const a=GLYPHS[character]??GLYPHS[' '],phase=Math.round(params.phase??0),tiles=[];
 for(let y=0;y<7;y++)for(let x=0;x<5;x++){
  const active=on(a,x,y),ports=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>on(a,x+dx,y+dy));
  const count=ports.filter(Boolean).length;let type='disc',rotation=0;
  if(active&&count===1){type='cap';rotation=ports.indexOf(true);}
  else if(active&&count===2&&ports.some((p,i)=>p&&ports[(i+1)%4])){
   type='quarter';rotation=ports.findIndex((p,i)=>p&&ports[(i+1)%4]);
  }else if(active&&count===3){type='counter';rotation=ports.indexOf(false);}
  else if(active&&count===4){type='square';}
  // Two-ended stroke cells stay circular, but regularly split into half-discs.
  else if(active&&count===2&&((x+y+phase)%3===0)){type='split';rotation=ports[0]?0:1;}
  tiles.push({x,y,active,type,rotation,ports});
 }
 return tiles;
}
function rotate(body,degrees){return `<g transform="rotate(${degrees} .5 .5)">${body}</g>`;}
function outline(kernel){
 if(kernel==='facet')return 'M.28 0H.72L1 .28V.72L.72 1H.28L0 .72V.28Z';
 if(kernel==='pillow')return 'M.25 0H.75Q1 0 1 .25V.75Q1 1 .75 1H.25Q0 1 0 .75V.25Q0 0 .25 0Z';
 return 'M.5 0A.5 .5 0 1 1 .5 1A.5 .5 0 1 1 .5 0Z';
}
function cap(kernel){
 // Flat north edge, rounded south edge; rotate to face the joined neighbour.
 if(kernel==='facet')return 'M0 0H1V.72L.72 1H.28L0 .72Z';
 if(kernel==='pillow')return 'M0 0H1V.75Q1 1 .75 1H.25Q0 1 0 .75Z';
 return 'M0 0H1V.5A.5 .5 0 0 1 0 .5Z';
}
function quarter(kernel){
 // Flat north/east edges share the two occupied ports.
 if(kernel==='facet')return 'M0 0H1V1H.56L0 .44Z';
 if(kernel==='pillow')return 'M0 0H1V1H.6Q0 1 0 .4Z';
 return 'M0 0H1V1A1 1 0 0 1 0 0Z';
}
function half(kernel){
 if(kernel==='facet')return 'M0 .5H1V.72L.72 1H.28L0 .72Z';
 if(kernel==='pillow')return 'M0 .5H1V.75Q1 1 .75 1H.25Q0 1 0 .75Z';
 return 'M0 .5H1A.5 .5 0 0 1 0 .5Z';
}
export function primitive(type,kernel='disc',rotation=0,colors=DEFAULT_COLORS,cut=.16){
 const [gap,light,dark]=colors;let s='';
 if(type==='disc')s=path(outline(kernel),light);
 if(type==='cap')s=path(cap(kernel),light);
 if(type==='quarter')s=path(quarter(kernel),light);
 if(type==='counter'){
  // The bite is clipped at the shared boundary rather than protruding outside.
  s=path(outline(kernel),light);
  const d=kernel==='facet'?`M${n(.5-cut)} 0L.5 ${n(cut)}L${n(.5+cut)} 0Z`:
   `M${n(.5-cut)} 0A${n(cut)} ${n(cut)} 0 0 0 ${n(.5+cut)} 0Z`;
  if(cut>0)s+=path(d,dark);
 }
 if(type==='square')s=rect(0,0,1,1,light);
 if(type==='split'){
  s=path(outline(kernel),light);
  // Half-disc shifted by the cut amount reveals a controlled two-ink seam.
  s+=`<g transform="translate(0 ${n(-cut)})">${path(half(kernel),dark)}</g>`;
 }
 return rotate(s,rotation*90);
}
function label(text,x,y,size,color){
 let d='',column=0;for(const c of text.toUpperCase()){
  const a=STARTER_ALPHABET[c]??STARTER_ALPHABET[' '];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(a[row][col]==='1'){
   d+=`M${n(x+(column+col)*size)} ${n(y+row*size)}h${n(size*.86)}v${n(size*.86)}h-${n(size*.86)}Z`;
  }column+=6;
 }return path(d,color);
}
export function render(input={}){
 const state=resolve(input),rows=state.text.split('/'),columns=Math.max(...rows.map(r=>r.length));
 // Whole modules retain square physical cells at every word length.
 const cols=columns*5+(columns-1)*.35,rowUnits=rows.length*7+(rows.length-1)*.35;
 const unit=122,margin=24,top=54,bottom=44,width=cols*unit+margin*2,height=rowUnits*unit+top+bottom;
 const [red,paper,counter]=state.colors,foreground=state.invert?counter:paper,background=state.invert?paper:counter;
 let body=rect(0,0,width,height,red),index=0;const glyphs=[];
 body+=label('DISC / COUNTER',margin,19,1.05,paper);
 body+=label(state.kernel==='disc'?'01':state.kernel==='pillow'?'02':'03',width-margin-20,19,1.05,paper);
 rows.forEach((row,rowIndex)=>[...row].forEach((ch,colIndex)=>{
  const gx=margin+colIndex*5.35*unit,gy=top+rowIndex*7.35*unit;
  const tiles=tileMap(ch,state.params);glyphs.push({character:ch,row:rowIndex,column:colIndex,tiles});
  for(const tile of tiles){
   const x=gx+tile.x*unit,y=gy+tile.y*unit,inner=1-state.params.seam;
   let tileBody='';
   if(state.stage===1){
    tileBody=path(outline(state.kernel),'none',`stroke="${paper}" stroke-width=".009"`);
    tileBody+=rect(.48,.48,.04,.04,paper);
   }else if(state.stage===2){tileBody=path(outline(state.kernel),tile.active?foreground:background);}
   else if(!tile.active){tileBody=path(outline(state.kernel),background);}
   else {
    tileBody=path(outline(state.kernel),background);
    tileBody+=primitive(tile.type,state.kernel,tile.rotation,[red,foreground,background],state.params.cut);
   }
   body+=`<g transform="translate(${n(x+(1-inner)*unit/2)} ${n(y+(1-inner)*unit/2)}) scale(${n(unit*inner)})">${tileBody}</g>`;
  }
  if(state.stage===4&&state.params.join>0){
   // Shared-boundary projections join light cells across their circular tangencies.
   // Paint once per active/active edge; dark counter cells stay intact.
   const radius=state.params.join;
   for(const t of tiles){
    for(const [dx,dy] of [[1,0],[0,1]]){
     const other=tiles.find(o=>o.x===t.x+dx&&o.y===t.y+dy);
     if(!other||!t.active||!other.active)continue;
     const cx=gx+(t.x+.5+dx*.5)*unit,cy=gy+(t.y+.5+dy*.5)*unit;
     body+=`<g transform="translate(${n(cx-radius*unit)} ${n(cy-radius*unit)}) scale(${n(radius*unit*2)})">${path(outline(state.kernel),foreground)}</g>`;
    }
   }
  }
  index++;
 }));
 const footY=height-24;
 body+=label('A MODULAR LETTER STUDY',margin,footY,.76,paper);
 const rhs=state.text.replaceAll('/',' '),small=Math.min(.95,(width/3)/Math.max(1,rhs.length*6));
 body+=label(rhs,width-margin-rhs.length*6*small,footY,small,paper);
 const desc=`${state.text}. ${state.kernel} modules. Stage ${state.stage}. A new procedural interpretation inspired by the RKC December poster.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}" role="img" aria-label="${escape(desc)}"><title>${escape(state.text)} — disc / counter</title><desc>${escape(desc)}</desc>${body}</svg>`;
 return {svg,state,width,height,glyphs,features:{kernel:state.kernel,letters:index,stage:state.stage,tileCount:index*35}};
}
export function kit(kernel='disc',colors=DEFAULT_COLORS){
 const types=['disc','cap','quarter','counter','split','square'],W=1160,H=285;
 let body=rect(0,0,W,H,colors[0]);
 types.forEach((type,i)=>{
  const x=25+i*190;body+=`<g transform="translate(${x} 35) scale(135)">${path(outline(kernel),colors[2])}${primitive(type,kernel,0,colors)}</g>`;
  body+=label(type.toUpperCase(),x,205,1.5,colors[1]);
 });
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Six tile primitives">${body}</svg>`;
}
