/* Arrangements place items in a page: the 2023 collage (with shapes or with
 * the source letters), a specimen table, a composition and a field. Each
 * returns {body, width, height} for engine.mjs to wrap.
 */
import {CONSTRUCTIONS,FAMILIES,PALETTES} from './catalog.mjs';
import {SHAPES} from './shapes.mjs';
import {construct,aspectOf,perforatedAtlas,monoline} from './constructions.mjs';
import {textAt,label,block,letter} from './lettering.mjs';
import {n,path,line,rect,fingerprint} from './svg.mjs';
export const ORDER=CONSTRUCTIONS.map(c=>c.id);
// An item's own construction wins; otherwise the global one, or the mixed
// rotation at `slot`.
export const consFor=(state,item,slot)=>item.construction&&item.construction!=='auto'?item.construction:state.construction==='mixed'?ORDER[slot%ORDER.length]:state.construction;
export const itemName=item=>SHAPES[item.shape].name.toUpperCase()+(item.turn?' '+item.turn*90:'')+(item.flip?' MIRRORED':'');
// ── The 2023 collage ─────────────────────────────────────────────────────
function micro(x,y,w,ink,index){let s=textAt('CONSTRUCTION '+String(index).padStart(2,'0'),x,y,w,2.5,ink);for(let i=0;i<3;i++)s+=rect(x,y+5+i*3,w*(.82-i*.13),.45,ink,'opacity=".65"');return s;}
function book(x,y,w,h,state,ink){const d=state.params.bevel*28;let s=path(`M50 13C35 3 17 5 3 12V84C20 78 37 79 50 91C64 79 81 78 97 84V12C79 5 65 3 50 13ZM50 13V91M3 12L${n(3-d)} 18V91C17 84 35 86 50 98C64 86 81 84 ${n(97+d)} 91V18L97 12M50 98V91`,'none',`stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"`);for(let i=0;i<5;i++)s+=path(`M11 ${24+i*10}Q28 ${18+i*10} 43 ${28+i*10}M57 ${28+i*10}Q73 ${18+i*10} 90 ${24+i*10}`,'none',`stroke="${ink}" stroke-width=".55"`);return `<g transform="translate(${x} ${y}) scale(${n(w/100)} ${n(h/100)})">${s}</g>`;}
function header(ink,study){return textAt('P.A.G.E.S.',10,1,94,19,ink)+textAt('HEAD–Genève',185,34,137,21,ink)+textAt('Salon du livre d’artiste',11,69,224,22,ink)+textAt('et de l’imprimé contemporain',11,97,307,22,ink)+textAt('Geneva Print & Art Book fair',11,125,308,21,ink)+textAt('03–05.02.2023',178,158,145,21,ink)+textAt('www.p-a-g-e-s.ch',10,195,178,21,ink)+textAt('HEAD Genève',253,201,69,6,ink)+textAt(`NEO NEO / ${study} STUDY`,193,212,129,3.2,ink);}
// `five` holds the specs for the P, A, G, E and S positions. With shapes, the
// supporting serif, heavy and condensed letters become monolines at those
// three weights.
export function atlas(state,five,ctx){const [p,a,g,e,s]=five,{ink}=ctx,source=state.layout==='source',lower=t=>typeof t==='string'?t.toLowerCase():t,C=(c,t,x,y,w,h,small)=>construct(c,t,{x,y,w,h},ctx,small);
 const F=(face,t,x,y,w,h)=>typeof t==='string'?letter(face,t,x,y,w,h,ctx):monoline(t,{x,y,w,h},ctx,{serif:4,condensed:7,black:12}[face]);let body='';
 body+=C('contour',p,338,23,111,265)+F('black',lower(a),480,6,153,181)+F('serif',g,462,211,47,47)+C('linked',s,493,257,136,159)+perforatedAtlas(e,351,308,14.2,ctx);
 body+=F('serif',p,38,275,41,51)+F('black',lower(a),15,370,81,71)+C('overlap',g,117,234,166,185)+F('black',lower(e),275,231,48,46)+F('serif',s,292,309,14,21);
 body+=C('folded',p,15,488,110,185)+F('condensed',a,134,461,21,62)+F('black',lower(e),source?56:139,source?618:548,25,24)+C('linked',s,source?116:132,source?600:589,46,62,true);
 five.slice(1).forEach((t,i)=>body+=F('serif',t,184+i*37,631,29,31));
 body+=F('condensed',p,344,492,21,33)+C('facets',a,376,468,70,77)+F('condensed',g,443,459,23,34)+F('black',p,504,470,56,51)+F('serif',a,521,528,39,37)+F('black',g,506,581,56,59)+C('heavy',s,577,464,62,180)+C('rails',e,409,551,72,90)+F('serif',lower(g),347,580,34,62)+F('condensed',lower(e),595,443,10,10);
 // The source photograph crops a continuing specimen grid at the bottom.
 body+=F('serif',a,86,690,33,44)+F('serif',e,134,687,20,34);for(let i=0;i<6;i++){const x=338+i*50;body+=F(i%2?'serif':'black',five[i%5],x+3,687,21,31);body+=F('serif',lower(five[(i+2)%5]),x+27,694,17,24);}
 if(state.stage===1||state.stage===4)body+=line('M334 0V710M0 224H334M0 449H334M0 681H334M334 438H644M334 658H644',ink,.65,`opacity="${state.stage===1?.3:.13}"`);
 if(state.stage===4){body+=header(ink,source?'MODULE':'SHAPE')+book(189,482,118,129,state,ink);for(const [i,[x,y,w]] of [[11,234,65],[345,2,58],[11,459,71],[179,451,53],[342,448,56],[497,441,56],[10,687,56],[179,683,49],[340,670,41],[391,670,41],[441,670,41],[491,670,41],[541,670,41],[591,670,41]].entries())body+=micro(x,y,w,ink,i+1);}
 return {body,width:644,height:710};}
// ── Specimen ─────────────────────────────────────────────────────────────
// Items against constructions; the table turns to keep its cells squarest.
export function specimen(state,ctx,W,H){const list=state.items,m=Math.round(Math.min(W,H)*.045),lh=Math.min(H*.04,34),cap=Math.min(lh*.32,10),top=m+lh*(state.stage===4?2:1),lw=Math.min(W*.17,150),aw=W-2*m-lw,ah=H-top-m;
 const sq=(c,r)=>Math.min(aw/c,ah/r),across=sq(ORDER.length,list.length)>=sq(list.length,ORDER.length),cols=across?ORDER.length:list.length,rows=across?list.length:ORDER.length,cw=aw/cols,ch=ah/rows;let body='';
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const item=list[across?r:c],con=ORDER[across?c:r],a=aspectOf(con,item,state),w=Math.min(cw*.8,ch*.8*a),h=w/a;body+=construct(con,item,{x:m+lw+c*cw+(cw-w)/2,y:top+r*ch+(ch-h)/2,w,h},ctx);}
 const names=[ORDER.map((c,i)=>`${String(i+1).padStart(2,'0')} ${CONSTRUCTIONS[i].name.toUpperCase()}`),list.map(itemName)],colNames=across?names[0]:names[1],rowNames=across?names[1]:names[0];
 colNames.forEach((t,c)=>body+=block(t,m+lw+c*cw+cw*.06,top-lh*.2,cw*.88,cap,ctx.ink,true));rowNames.forEach((t,r)=>body+=block(t,m,top+r*ch+ch/2,lw*.9,cap,ctx.ink,false));
 if(state.stage===1||state.stage===4){let d='';for(let c=0;c<=cols;c++)d+=`M${n(m+lw+c*cw)} ${n(top)}V${n(H-m)}`;for(let r=0;r<=rows;r++)d+=`M${m} ${n(top+r*ch)}H${n(W-m)}`;body+=line(d,ctx.ink,ctx.hair,`opacity="${state.stage===1?.3:.16}"`);}
 if(state.stage===4){const h=Math.min(lh*.42,13),right=`${FAMILIES.find(f=>f.id===state.family).name} / ${PALETTES.find(p=>p.id===state.palette).name}`.toUpperCase();body+=label('P.A.G.E.S. SHAPE KIT',m,m,h,ctx.ink)[0];const [txt,w]=label(right,0,0,h,ctx.ink);body+=`<g transform="translate(${n(W-m-w)} ${m})">${txt}</g>`;}
 return {body,width:W,height:H,grid:[cols,rows]};}
// ── Composition ──────────────────────────────────────────────────────────
// Split items into r rows, spare items going to the outer rows first.
function balanced(items,r){const sizes=Array(r).fill(Math.floor(items.length/r));for(let i=0;i<items.length%r;i++)sizes[i%2?r-1-Math.floor(i/2):Math.floor(i/2)]++;let k=0;return sizes.map(s=>items.slice(k,k+=s));}
// Every item keeps its proportions and one common height. The row count is
// the one that lets that height grow largest inside the format.
export function composition(state,ctx,W,H,margin){const m=margin??Math.round(Math.min(W,H)*.045),aw=W-2*m,ah=H-2*m,gap=state.params.gap,items=state.items.map((item,i)=>({item,c:consFor(state,item,i)}));let best=null;
 for(let r=1;r<=items.length;r++){const rows=balanced(items,r),widths=rows.map(row=>row.reduce((s,{item,c})=>s+aspectOf(c,item,state),0)+gap*(row.length-1)),h=Math.min(aw/Math.max(...widths),ah/(r+gap*(r-1)));if(!best||h>best.h+1e-9)best={rows,widths,h};}
 const {rows,widths,h}=best;let y=m+(ah-h*(rows.length+gap*(rows.length-1)))/2,body='';
 rows.forEach((row,k)=>{let x=m+(aw-widths[k]*h)/2;for(const {item,c} of row){const w=aspectOf(c,item,state)*h;body+=construct(c,item,{x,y,w,h},ctx);x+=w+gap*h;}y+=h*(1+gap);});
 return {body,width:W,height:H,grid:[Math.max(...rows.map(r=>r.length)),rows.length]};}
// ── Field ────────────────────────────────────────────────────────────────
// The field pattern adds a turn or mirror per cell on top of the item's own.
export function patterned(item,r,c,pattern){let turn=item.turn??0,flip=!!item.flip;
 if(pattern==='turn')turn+=r+c;else if(pattern==='mirror'){if(c%2)flip=!flip;if(r%2){turn+=2;flip=!flip;}}else if(pattern==='scatter'){const h=parseInt(fingerprint(`${r}:${c}:${item.shape}`),36);turn+=h%4;if(h>>2&1)flip=!flip;}
 return {...item,turn:turn%4,flip};}
export function field(state,ctx,W,H){const list=state.items,m=Math.round(Math.min(W,H)*.04),aspect=(W-2*m)/(H-2*m),cells=28*state.params.density**2,cols=Math.max(2,Math.min(30,Math.round(Math.sqrt(cells*aspect)))),rows=Math.max(2,Math.round(cols/aspect)),cw=(W-2*m)/cols,ch=(H-2*m)/rows,size=state.params.size;let body='';
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const base=list[(r*cols+c)%list.length],item=patterned(base,r,c,state.pattern),con=consFor(state,base,r+c),a=aspectOf(con,item,state),w=Math.min(cw*size,ch*size*a),h=w/a;body+=construct(con,item,{x:m+c*cw+(cw-w)/2,y:m+r*ch+(ch-h)/2,w,h},ctx);}
 if(state.stage===1||state.stage===4){let d='';for(let c=0;c<=cols;c++)d+=`M${n(m+c*cw)} ${m}V${H-m}`;for(let r=0;r<=rows;r++)d+=`M${m} ${n(m+r*ch)}H${W-m}`;body+=line(d,ctx.ink,ctx.hair,`opacity="${state.stage===1?.3:.13}"`);}
 return {body,width:W,height:H,grid:[cols,rows]};}
// ── Kit strip ────────────────────────────────────────────────────────────
// One item through all eight constructions, labelled.
export function strip(state,item,ctx){let body=rect(0,0,1200,215,ctx.paper);
 ORDER.forEach((c,i)=>{const a=aspectOf(c,item,state),h=Math.min(150,128/a),w=a*h;body+=construct(c,item,{x:i*150+(150-w)/2,y:12+(150-h)/2,w,h},ctx)+`<g transform="translate(${i*150+11} 186)">${label(CONSTRUCTIONS[i].name.toUpperCase(),0,0,7,ctx.ink)[0]}</g>`;});
 return body;}
