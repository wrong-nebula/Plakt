/* PUNKT — joined capsule columns. New vector construction recipes after the
 * visible poster credited to Tanja Krebs, @va_bienne and Anna Tuena.
 * All measurements below are authored study geometry, not recovered layers.
 */
import {rect,roundRect,hourglass,union,minus,intersect,offset,close,open,stroke,bounds,overlaps,area,toPath} from './geometry.mjs';
import {TYPE} from './type-outlines.mjs';
export const ENGINE='punkt-capsule-v2';
export const SOURCE={id:'9fe9752772b71b4693b6dadd-p0',title:'PUNKT exhibition',
 credit:'Tanja Krebs + @va_bienne + Anna Tuena',url:'https://www.instagram.com/p/B1JXcpfCA0y/'};
export const FAMILIES=[
 {id:'joined',name:'Joined capsules',palette:'Sampled violet / ink',colors:['#0b0c0e','#545698'],note:'Source-proportion reconstruction: a solid P bowl, deep U counter, extended K stem and hooked T, separated by one hairline.'},
 {id:'fluted',name:'Fluted columns',palette:'Jade / deep teal',colors:['#153e44','#a9dfcc'],note:'Upright columns split into flutes of one width, so wide bodies get more flutes. Joins, fillets and hairlines stay as in the joined letter.'},
 {id:'waisted',name:'Pinched columns',palette:'Citron / slate',colors:['#29374d','#deea7e'],note:'Upright columns curve in to a waist in proportion to their width. Pieces are pinched before they are joined, so every join stays attached.'}
];
// Lengths are poster units: the poster is 1000 units tall.
export const CONTROLS=[
 {key:'roundness',label:'Cap roundness',min:.08,max:.5,step:.01,value:.46},
 {key:'seam',label:'Hairline',min:1.5,max:9,step:.1,value:4.2},
 {key:'fusion',label:'Join fillet',min:0,max:1,step:.01,value:.78},
 {key:'slot',label:'Counter width',min:.7,max:1.25,step:.01,value:1}
];
// Formats for the fit layout, 1000 units tall so cap radius and hairline keep
// the same physical size in every format.
export const FORMATS=[
 {id:'poster',name:'Poster 2:3',width:668,height:1000},
 {id:'a-series',name:'A series',width:707,height:1000},
 {id:'square',name:'Square',width:1000,height:1000},
 {id:'story',name:'Story 9:16',width:563,height:1000},
 {id:'landscape',name:'Landscape 16:9',width:1778,height:1000},
 {id:'billboard',name:'Billboard 3:1',width:3000,height:1000}
];
const FLUTE=30,PINCH=.18;
const full=()=>[[0,0,.25,1],[.25,0,.5,1],[.75,0,.25,1]];
// [x,y,width,height] in a glyph frame. Open cuts extend outside that frame.
export const RECIPES={
 A:{cuts:[[.32,.16,.36,.24],[.32,.62,.36,.5]]},
 B:{cuts:[[.32,.16,.35,.24],[.32,.60,.35,.24]]},
 C:{cuts:[[.30,.22,.82,.56]]},
 D:{cuts:[[.28,.19,.34,.62]]},
 E:{cuts:[[.30,.23,.82,.18],[.30,.59,.82,.18]]},
 F:{cuts:[[.30,.23,.82,.18],[.30,.59,.82,.52]]},
 G:{cuts:[[.30,.22,.82,.24],[.30,.46,.3,.31]]},
 H:{cuts:[[.30,-.12,.40,.52],[.30,.60,.40,.52]]},
 I:{columns:[[0,0,1,.23],[.32,.16,.36,.68],[0,.77,1,.23]],cuts:[]},
 J:{cuts:[[-.12,-.12,.72,.87]]},
 K:{cuts:[[.27,-.12,.32,.53],[.27,.59,.32,.53],[.68,.39,.44,.22]]},
 L:{cuts:[[.30,-.12,.82,.88]]},
 M:{cuts:[[.23,.33,.18,.79],[.59,.33,.18,.79],[.45,-.12,.1,.50]]},
 N:{cuts:[[.25,-.12,.16,.83],[.59,.29,.16,.83]]},
 O:{cuts:[[.30,.18,.40,.64]]},
 P:{columns:[[0,0,.23,1],[.23,0,.77,.58]],cuts:[[.48,.16,.25,.24]]},
 Q:{cuts:[[.30,.18,.40,.64]],restores:[[.58,.63,.22,.40]]},
 R:{columns:[[0,0,.23,1],[.23,0,.77,.56],[.23,.48,.36,.29],[.56,.67,.44,.33]],cuts:[[.48,.16,.25,.23]]},
 S:{cuts:[[.28,.20,.84,.18],[-.12,.62,.84,.18]]},
 T:{cuts:[[-.12,.28,.46,.84],[.66,.28,.46,.84]]},
 U:{cuts:[[.48,-.12,.26,.91]]},
 V:{cuts:[[.30,-.12,.40,.96],[-.12,.86,.26,.26],[.86,.86,.26,.26]]},
 W:{cuts:[[.22,-.12,.18,.90],[.60,-.12,.18,.90],[.44,.70,.12,.42]]},
 X:{cuts:[[.32,-.12,.36,.51],[.32,.61,.36,.51],[-.12,.44,.48,.12],[.64,.44,.48,.12]]},
 Y:{cuts:[[.30,-.12,.40,.60],[-.12,.57,.46,.55],[.66,.57,.46,.55]]},
 Z:{cuts:[[-.12,.22,.78,.18],[.34,.60,.78,.18]]},
 '-':{columns:[[0,.40,1,.20]],cuts:[]},' ':{columns:[],cuts:[]}
};
const n=v=>Number(v.toFixed(3));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const box=(x,y,w,h,color,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${color}" ${extra}/>`;
const safeColor=(s,f)=>/^#[a-f\d]{6}$/i.test(s??'')?s:f;
export function normalize(input='PUNKT'){
 const text=String(input).normalize('NFKD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\r?\n/g,'/');
 const bad=[...new Set([...text].filter(c=>!/[A-Z /-]/.test(c)))];
 if(bad.length)throw new Error(`Use A–Z, spaces, hyphens and / for a new row. Unsupported: ${bad.join(' ')}`);
 if(!text.replace(/[ /-]/g,''))throw new Error('Enter at least one letter.');
 if(text.replaceAll('/','').length>24||text.split('/').length>4)throw new Error('Use up to 24 characters and four rows.');
 return text;
}
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0];const params={};
 // v1 rules stored seam as a share of column width and fusion as pill size.
 const given={...input.params};if(input.engine==='punkt-capsule-v1'){delete given.seam;delete given.fusion;}
 for(const c of CONTROLS){const v=Number(given[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:c.value));}
 return {version:2,engine:ENGINE,text:normalize(input.text),family:family.id,params,
  colors:family.colors.map((c,i)=>safeColor(input.colors?.[i],c)),invert:!!input.invert,
  layout:['rows','fit'].includes(input.layout)?input.layout:'packed',format:(FORMATS.find(f=>f.id===input.format)??FORMATS[0]).id,
  stage:Math.max(1,Math.min(4,Math.round(Number(input.stage)||4)))};
}
const tokens=p=>({R:74*p.roundness,H:p.seam,F:18*p.fusion});
const upright=([,,w,h])=>h>=w;
// A side is joined when another piece's facing edge is within a seam of it
// along a real share of the shorter piece. Only free sides are pinched, so
// pinching never opens a gap inside a join.
function joinedSide([x,y,w,h],columns,side){
 const edge=side==='left'?x:x+w;
 return columns.some(o=>{const facing=side==='left'?o[0]+o[2]:o[0],shared=Math.min(y+h,o[1]+o[3])-Math.max(y,o[1]);
  return Math.abs(facing-edge)<=8&&shared>.3*Math.min(h,o[3]);});
}
// The family's body for one piece. Flutes are cut after joining, see flute().
function body(c,state,t,columns=[]){
 const [x,y,w,h]=c;
 if(state.family!=='waisted'||!upright(c))return roundRect(x,y,w,h,t.R);
 const others=columns.filter(o=>o!==c),depth=PINCH*w;
 return hourglass(x,y,w,h,t.R,joinedSide(c,others,'left')?0:depth,joinedSide(c,others,'right')?0:depth);
}
function fluteCount(w,t){const count=Math.max(1,Math.round((w+t.H)/(FLUTE+t.H)));return {count,width:(w-(count-1)*t.H)/count};}
function flutes([x,y,w,h],t){
 const {count,width}=fluteCount(w,t);
 return union(...Array.from({length:count},(_,i)=>roundRect(x+i*(width+t.H),y,width,h,t.R)));
}
// Flutes are hairline grooves between equal-width rods, cut through the joined
// letter. A groove stays inside its own piece; rod ends are rounded afterwards.
function flute(solid,columns,t){
 const grooves=[],ends=[];let rho=t.R;
 for(const c of columns){
  const [x,y,w,h]=c,{count,width}=fluteCount(w,t);if(count<2)continue;
  const reach=t.F+2,others=columns.filter(o=>o!==c);
  let lines=union(...Array.from({length:count-1},(_,i)=>{const gx=x+(i+1)*width+(i+.5)*t.H;return stroke([[gx,y-reach],[gx,y+h+reach]],t.H);}));
  lines=intersect(lines,rect(x,y-reach,w,h+2*reach));
  if(others.length)lines=minus(lines,union(...others.map(o=>rect(...o))));
  grooves.push(lines);rho=Math.min(rho,.95*width/2);
  ends.push([x,y-reach,w,reach+1.1*width],[x,y+h-1.1*width,w,reach+1.1*width]);
 }
 if(!grooves.length)return solid;
 return roundMouth(minus(solid,union(...grooves)),ends,rho);
}
// Rounds the corners a cut leaves where it opens onto an edge. Opening also
// erodes any part thinner than 2rho, so only small corner fragments are removed.
function roundMouth(solid,zones,rho){
 const zone=union(...zones.map(z=>rect(...z))),wide=union(...zones.map(([x,y,w,h])=>rect(x-2*rho-1,y-2*rho-1,w+4*rho+2,h+4*rho+2)));
 const part=intersect(solid,wide),removed=intersect(minus(part,open(part,rho)),zone);
 const corners=removed.filter(p=>{const a=area(p);return a>0&&a<.6*rho*rho;});
 return corners.length?minus(solid,corners):solid;
}
// Touching columns with the same top and bottom become one body, so their caps
// do not leave a dip in a shared edge. Slit mouths restore the separate caps.
function merged(columns){
 const out=[];
 for(const c of [...columns].sort((a,b)=>a[0]-b[0])){
  const last=out.find(o=>Math.abs(o[0]+o[2]-c[0])<1&&Math.abs(o[1]-c[1])<.5&&Math.abs(o[3]-c[3])<.5);
  if(last)last[2]=c[0]+c[2]-last[0];else out.push([...c]);
 }
 return out;
}
/* One glyph: bodies + bridges → closing (fillets) → counters → a constant
 * hairline around earlier glyphs → slits → flutes. Input rects are poster units. */
function buildGlyph(g,state,t,earlier){
 const columns=merged(g.columns),capsules=union(...g.columns.map(c=>body(c,state,t,g.columns)),...g.joins.map(j=>rect(...j)));
 const pieces=union(...columns.map(c=>body(c,state,t,columns)),...g.joins.map(j=>rect(...j)));
 const cuts=g.cuts.length?union(...g.cuts.map(c=>roundRect(...c,t.R))):[];
 const restores=g.restores.map(c=>body(c,state,t));
 let solid=minus(close(pieces,t.F),cuts),keepOut=[];
 if(restores.length){
  // A restored piece (the Q tail) meets its counter with the same fillets.
  solid=union(solid,...restores);
  solid=union(solid,intersect(close(solid,t.F),offset(union(...restores),t.F)));
 }
 const here=bounds(solid),near=earlier.filter(e=>overlaps(e.box,here,t.H+1));
 if(near.length){
  keepOut=offset(union(...near.map(e=>e.outline)),t.H);
  solid=minus(solid,keepOut);
  // Carving leaves steps where a neighbour's corner recedes; fill them up to
  // the hairline so the gap stays parallel around the neighbour's curve.
  const band=minus(offset(keepOut,Math.max(t.F,2*t.H)),keepOut);
  solid=union(solid,minus(intersect(close(solid,t.R+t.H),band),cuts));
 }
 const mouths=g.slits.filter(s=>s.mouth).map(s=>s.mouth);
 if(mouths.length){
  // Around a mouth the pieces keep their own caps: only the seam itself is
  // closed, so the slit flares between two rounded corners.
  const raw=minus(union(minus(close(capsules,Math.min(t.F,g.seamClose)),cuts),...restores),keepOut),zone=union(...mouths.map(m=>rect(...m)));
  solid=union(minus(solid,zone),intersect(raw,zone));
 }
 if(g.slits.length)solid=minus(solid,union(...g.slits.map(s=>stroke(s.path,t.H))));
 // Closing an authored seam leaves slivers beside a slit; trim them at the mouth.
 const trims=g.slits.filter(s=>s.trim).map(s=>s.mouth);
 if(trims.length){
  const touching=g.columns.filter(c=>trims.some(m=>overlaps({x:c[0],y:c[1],w:c[2],h:c[3]},{x:m[0],y:m[1],w:m[2],h:m[3]})));
  const rho=Math.min(t.R,...touching.map(c=>.95*Math.min(c[2],c[3])/2));
  if(rho>.5)solid=roundMouth(solid,trims,rho);
 }
 if(state.family==='fluted')solid=flute(solid,columns,t);
 return solid;
}
// Pieces as drawn in the first three construction stages.
function stagePieces(g,state,t){
 return g.columns.map(c=>state.family==='fluted'?flutes(c,t):body(c,state,t,g.columns));
}
function fitRect(r,frame){return [frame.x+r[0]*frame.w,frame.y+r[1]*frame.h,r[2]*frame.w,r[3]*frame.h];}
export function recipeFor(ch){const r=RECIPES[ch]??RECIPES[' '];return {columns:r.columns??full(),cuts:r.cuts,restores:r.restores??[]};}
export function framesFor(text,layout='packed'){
 // Authored interlock: the P stem descends beside N; upper and lower rows share
 // the same right edge. Geometry is newly authored from the source's mechanism.
 if(layout==='packed'&&text==='PUNKT')return [
  {character:'P',x:0,y:0,w:.48,h:.55},
  {character:'U',x:.49,y:0,w:.51,h:.31},
  {character:'N',x:.12,y:.315,w:.88,h:.30},
  {character:'K',x:.12,y:.62,w:.55,h:.38},
  {character:'T',x:.675,y:.62,w:.325,h:.38}
 ];
 let rows=text.split('/');
 if(rows.length===1&&text.length>3){const cols=Math.ceil(Math.sqrt(text.length*.75));rows=text.match(new RegExp(`.{1,${cols}}`,'g'));}
 const rh=1/rows.length,result=[];
 rows.forEach((row,ri)=>{const cw=1/Math.max(1,row.length);[...row].forEach((ch,ci)=>result.push({character:ch,x:ci*cw,y:ri*rh,w:cw*.97,h:rh*.97}));});return result;
}
/* Fit: letters stretch edge to edge to fill a format, as in the source poster.
 * Frames touch; carving each glyph away from earlier ones leaves the hairline.
 * Rows come from '/' or spaces, otherwise a balanced break whose letters come
 * closest to square. Each row is justified by letter weight. A P or F that
 * starts a row drops its stem into the row below (its arms keep the row
 * height), and an L raises its stem into the row above, the way the source P
 * runs down beside the N. The rows they reach are indented by the stem. */
const WEIGHT={I:.5,J:.8,L:.85,F:.85,T:.9,P:.9,E:.9,S:.95,M:1.3,W:1.3,'-':.7,' ':.45};
// arms/bar: share of the frame height holding the rest of the letter; stem: share of its width.
const DROP={P:{arms:.58,stem:.23},F:{arms:.59,stem:.30}},RISE={L:{bar:.24,stem:.30}};
export function fitRows(text,aspect){
 if(text.includes('/'))return text.split('/').filter(r=>r.trim());
 if(text.trim().includes(' '))return text.split(' ').filter(Boolean);
 // Source letters are a little taller than wide; uneven rows cost a little.
 const letters=[...text];let rows=1,score=Infinity;
 for(let r=1;r<=Math.min(4,letters.length);r++){const s=Math.abs(Math.log(aspect*r*r/letters.length/.9))+(letters.length%r?.25:0);if(s<score-1e-9){score=s;rows=r;}}
 // Spare letters go to the outer rows first: PUNKT breaks PU / N / KT.
 const sizes=Array(rows).fill(Math.floor(letters.length/rows));
 for(let i=0;i<letters.length%rows;i++)sizes[i%2?rows-1-Math.floor(i/2):Math.floor(i/2)]++;
 let k=0;return sizes.map(s=>letters.slice(k,k+=s).join(''));
}
export function fitFrames(text,page){
 const m=page.margin,w=page.width-2*m,h=page.height-2*m,rows=fitRows(text,w/h),rh=h/rows.length,last=rows.length-1;
 const indent=rows.map(()=>0),lift=rows.map(()=>0);
 const widths=i=>{const ws=[...rows[i]].map(c=>WEIGHT[c]??1),sum=ws.reduce((a,b)=>a+b,0);return ws.map(v=>v/sum*(w-indent[i]));};
 for(let i=0;i<last;i++){const d=DROP[rows[i][0]];if(d)indent[i+1]=widths(i)[0]*d.stem;}
 for(let i=1;i<=last;i++){
  // A rising stem needs the left of the row above to itself.
  const r=RISE[rows[i][0]];if(!r||indent[i]||indent[i-1]||DROP[rows[i-1][0]])continue;
  lift[i]=.6*rh;indent[i-1]=widths(i)[0]*r.stem;
 }
 const frames=[];
 rows.forEach((row,i)=>{
  const ws=widths(i);let x=m+indent[i];
  [...row].forEach((character,k)=>{
   let y=m+i*rh,fh=rh;
   if(k===0&&i<last&&DROP[character])fh=Math.min(rh/DROP[character].arms,page.height-m-y);
   if(k===0&&lift[i]){y-=lift[i];fh+=lift[i];}
   frames.push({character,row:i,x,y,w:ws[k],h:fh});x+=ws[k];
  });
 });
 return frames;
}
// Transfer letters: touching columns fuse, with a slit from each open end to a
// quarter of their shared height. A slit that would run beside a counter, or
// end against one, is dropped: the counter already separates the columns, and
// the slit would leave a sliver or cut a piece loose. Its mouth zone stops
// short of the next seam, so other seams keep a flat edge.
// Inputs: frame-unit columns, poster-unit cuts.
function slitsFor(columns,cuts,frame,t){
 const slits=[],clear=t.R/2+t.H;
 for(let i=0;i<columns.length;i++)for(let j=i+1;j<columns.length;j++){
  let [l,r]=[columns[i],columns[j]];if(l[0]>r[0])[l,r]=[r,l];
  const edge=l[0]+l[2];if(Math.abs(r[0]-edge)>.025)continue;
  const start=Math.max(l[1],r[1]),end=Math.min(l[1]+l[3],r[1]+r[3]);if(end-start<.08)continue;
  const x=frame.x+edge*frame.w,y0=frame.y+start*frame.h,y1=frame.y+end*frame.h,depth=(y1-y0)/4,tall=Math.min(depth,2.2*t.R);
  // A column narrower than two cap radii has one round cap: take all of it.
  const span=c=>c[2]*frame.w<2*t.R?c[2]*frame.w:.75*c[2]*frame.w,left=x-span(l),width=span(l)+span(r);
  const beside=(a,b)=>cuts.some(([cx,cy,cw,ch])=>cy<b&&cy+ch>a&&cx-clear<x&&cx+cw+clear>x);
  // A mouth must open onto empty space, not onto a third piece fused to the seam.
  const covered=(a,b)=>columns.some(c=>{
   if(c===l||c===r)return false;
   const cx=frame.x+c[0]*frame.w,cy=frame.y+c[1]*frame.h,cw=c[2]*frame.w,ch=c[3]*frame.h,m=2*t.F;
   return cx-m<x&&cx+cw+m>x&&cy-m<b&&cy+ch+m>a;
  });
  if(!beside(y0,y0+depth+clear)&&!covered(y0-1,y0))slits.push({path:[[x,y0-20],[x,y0+depth]],mouth:[left,y0-20,width,20+tall]});
  if(!beside(y1-depth-clear,y1)&&!covered(y1,y1+1))slits.push({path:[[x,y1+20],[x,y1-depth]],mouth:[left,y1-tall,width,20+tall]});
 }
 return slits;
}
// Outlined Barlow Condensed Medium; (x, y) is the start of the baseline.
function type(text,x,y,cap,ink,{rotate=0,anchor='start'}={}){
 const k=cap/TYPE.capHeight;let pen=0,g='';
 for(const c of text){const glyph=TYPE.glyphs[c]??TYPE.glyphs[' '];if(glyph.d)g+=`<path transform="translate(${n(pen)} 0) scale(${n(k)} ${n(-k)})" d="${glyph.d}"/>`;pen+=glyph.advance*k;}
 const shift=anchor==='end'?` translate(${n(-pen)} 0)`:'';
 return `<g fill="${ink}" transform="translate(${n(x)} ${n(y)})${rotate?` rotate(${rotate})`:''}${shift}">${g}</g>`;
}
const measure=(text,cap)=>[...text].reduce((w,c)=>w+(TYPE.glyphs[c]??TYPE.glyphs[' ']).advance,0)*cap/TYPE.capHeight;
// Source-proportion reconstruction study, in a 477 x 714 construction field.
// P deliberately has no closed counter. The K stem starts above its two bowls;
// T is a hooked side stroke. Glyphs are built in this order and each keeps one
// hairline from those before it. Every slit opens onto an edge or void and
// ends in a round terminal; `mouth` is the region whose corners it rounds.
export const SOURCE_LAYERS=[
 {character:'P',columns:[[8,6,52,376],[64,6,161,214]],joins:[[59,112,14,86]],cuts:[],slits:[{path:[[62,-30],[62,112]],mouth:[20,-30,84,90]}]},
 {character:'U',columns:[[228,7,98,215],[376,14,44,208]],joins:[[300,194,98,28]],cuts:[[326,-25,50,242]],slits:[]},
 {character:'N',columns:[[120,224,52,212],[176,224,295,106],[425,224,46,212]],joins:[[169,302,12,35],[176,305,48,50],[399,305,50,50]],cuts:[[172,330,253,145]],slits:[{path:[[174,190],[174,300]],mouth:[134,190,82,90]}]},
 {character:'K',columns:[[64,224,52,484],[176,387,153,214],[176,604,153,104]],joins:[[112,551,88,106]],cuts:[[116,418,60,183],[116,607,60,145]],slits:[{path:[[200,602.5],[360,602.5]],mouth:[285,565,85,75]}]},
 // The T slit hugs the stem: its left edge sits on x=426 for any hairline width.
 {character:'T',columns:[[332,332,94,376],[374,440,97,50],[428,602,43,106]],joins:[[397,680,49,28]],cuts:[],slits:[{path:[[426,560],[426,673]],hug:'left',mouth:[392,560,85,75]}]}
];
const SOURCE_TEXT=[['24.2.',330,52,15],['21.2.–',120,492,15],['2019',428.5,591,15],['PUNKT / CAPSULE STUDY',12,690,4.6]];
const SCALE=1000/714;
function sourceGlyph(layer,state,t){
 const fit=r=>r.map(v=>v*SCALE),slot=state.params.slot;
 // Authored seams are 2–4 field units wide; closing them at a mouth needs ~4.
 return {columns:layer.columns.map(fit),joins:layer.joins.map(fit),restores:[],seamClose:4,
  cuts:layer.cuts.map(c=>fit([c[0]-c[2]*(slot-1)/2,c[1],c[2]*slot,c[3]])),
  slits:layer.slits.map(s=>{const dx=s.hug==='left'?t.H/2:0;return {path:s.path.map(([x,y])=>[x*SCALE+dx,y*SCALE]),mouth:fit(s.mouth),trim:true};})};
}
function draw(glyphs,state,t,ink){
 // Stages 1–2 show the pieces; stage 3 adds the bridges and cuts the counters
 // through them; stage 4 is the complete letter with fillets and hairlines.
 let s='';const built=[];
 for(const g of glyphs){
  if(state.stage===4){const outline=buildGlyph(g.recipe,state,t,built);built.push({outline,box:bounds(outline)});g.outline=outline;s+=`<path d="${toPath(outline)}" fill="${ink}" fill-rule="evenodd" data-glyph="${esc(g.character)}"/>`;continue;}
  const pieces=stagePieces(g.recipe,state,t);
  if(state.stage===1){for(const p of pieces)s+=`<path d="${toPath(p)}" fill="none" stroke="${ink}" stroke-width=".9"/>`;continue;}
  let shape=union(...pieces);
  if(state.stage===3){
   shape=union(shape,...g.recipe.joins.map(j=>rect(...j)));
   if(g.recipe.cuts.length)shape=minus(shape,union(...g.recipe.cuts.map(c=>roundRect(...c,t.R))));
  }
  g.outline=shape;s+=`<path d="${toPath(shape)}" fill="${ink}" fill-rule="evenodd" data-glyph="${esc(g.character)}"/>`;
 }
 return s;
}
function renderSourceField(state){
 const W=668,H=1000,[paper,ink]=state.invert?[state.colors[1],state.colors[0]]:state.colors,t=tokens(state.params);
 const glyphs=SOURCE_LAYERS.map(layer=>({character:layer.character,recipe:sourceGlyph(layer,state,t),sourceField:[477,714],scale:SCALE}));
 let body=box(0,0,W,H,paper)+draw(glyphs,state,t,ink);
 if(state.stage===4)for(const [text,x,y,cap] of SOURCE_TEXT)body+=type(text,(x+cap)*SCALE,y*SCALE,cap*SCALE,ink,{rotate:-90});
 const desc=`PUNKT. ${state.family} columns. Source-proportion construction study, stage ${state.stage}.`;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}"><title>PUNKT — source-proportion study</title><desc>${esc(desc)}</desc>${body}</svg>`,
  state,width:W,height:H,glyphs:glyphs.map(({recipe,...g})=>g),features:{family:state.family,characters:5,stage:state.stage,layout:'source-proportion'}};
}
// A transfer-alphabet glyph stretched to a poster-unit frame.
function transferGlyph(character,frame,state,t){
 const r=recipeFor(character),slot=state.params.slot;
 const cuts=r.cuts.map(c=>fitRect([c[0]-c[2]*(slot-1)/2,c[1],c[2]*slot,c[3]],frame));
 // Transfer columns touch, so their seams need almost no closing at a mouth.
 const recipe={columns:r.columns.map(c=>fitRect(c,frame)),joins:[],restores:r.restores.map(c=>fitRect(c,frame)),cuts,slits:slitsFor(r.columns,cuts,frame,t),seamClose:.5};
 return {character,frame,recipe};
}
const frameLines=(glyphs,ink)=>glyphs.map(g=>box(g.frame.x,g.frame.y,g.frame.w,g.frame.h,'none',`stroke="${ink}" stroke-width=".7" stroke-dasharray="3 4"`)).join('');
// The fit layout has no captions: the letters are the whole poster.
function renderFit(state,page){
 const format=FORMATS.find(f=>f.id===state.format),W=page?.width??format.width,H=page?.height??format.height;
 const [paper,ink]=state.invert?[state.colors[1],state.colors[0]]:state.colors,t=tokens(state.params);
 const frames=fitFrames(state.text,{width:W,height:H,margin:page?.margin??11}),glyphs=frames.map(f=>transferGlyph(f.character,f,state,t));
 let body=box(0,0,W,H,paper);
 if(state.stage===1)body+=frameLines(glyphs,ink);
 body+=draw(glyphs,state,t,ink);
 const desc=`${state.text}. ${state.family} capsule columns fitted to ${page?`${W} × ${H}`:format.name}. Construction stage ${state.stage}. A new interpretation inspired by the PUNKT poster.`;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}" height="${n(H)}" viewBox="0 0 ${n(W)} ${n(H)}" role="img" aria-label="${esc(desc)}"><title>${esc(state.text)} — fitted capsule columns</title><desc>${esc(desc)}</desc>${body}</svg>`,
  state,width:W,height:H,glyphs:glyphs.map(({recipe,...g})=>g),features:{family:state.family,characters:frames.length,stage:state.stage,layout:'fit',format:page?'custom':state.format,rows:Math.max(...frames.map(f=>f.row))+1}};
}
// `page` ({width, height, margin}) overrides the fit layout's format.
export function render(input={},page){
 const state=resolve(input),W=700,H=1000,[paper,ink]=state.invert?[state.colors[1],state.colors[0]]:state.colors;
 if(state.layout==='fit')return renderFit(state,page);
 if(state.text==='PUNKT'&&state.layout==='packed')return renderSourceField(state);
 const t=tokens(state.params),area_={x:27,y:60,w:646,h:886},frames=framesFor(state.text,state.layout);
 const glyphs=frames.map(f=>transferGlyph(f.character,{x:area_.x+f.x*area_.w,y:area_.y+f.y*area_.h,w:f.w*area_.w,h:f.h*area_.h},state,t));
 let body=box(0,0,W,H,paper);
 if(state.stage===1)body+=frameLines(glyphs,ink);
 body+=draw(glyphs,state,t,ink);
 body+=type('COLUMN / CAPSULE',27,36,7,ink)+type(String(FAMILIES.findIndex(f=>f.id===state.family)+1).padStart(2,'0'),673,36,7,ink,{anchor:'end'});
 const rhs=state.text.replaceAll('/',' ');
 body+=type('A JOINED LETTER STUDY',27,976,7,ink)+type(rhs,673,976,Math.min(7,7*300/Math.max(1,measure(rhs,7))),ink,{anchor:'end'});
 const desc=`${state.text}. ${state.family} capsule columns. Construction stage ${state.stage}. A new interpretation inspired by the PUNKT poster.`;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000" viewBox="0 0 700 1000" role="img" aria-label="${esc(desc)}"><title>${esc(state.text)} — capsule columns</title><desc>${esc(desc)}</desc>${body}</svg>`,
  state,width:W,height:H,glyphs:glyphs.map(({recipe,...g})=>g),features:{family:state.family,characters:frames.length,stage:state.stage,layout:'rows'}};
}
export function kit(family='joined',colors,params){
 const state=resolve({family,colors,params}),[paper,ink]=state.colors,t=tokens(state.params);
 const pieces=[
  ['STEM',{columns:[[25,25,65,160]]}],
  ['BROAD BODY',{columns:[[130,25,160,160]]}],
  ['JOIN + FILLET',{columns:[[335,25,65,160],[404,60,150,90]]}],
  ['COUNTER SLOT',{columns:[[600,25,175,160]],cuts:[[657,48,60,118]]}],
  ['HAIRLINE SLIT',{columns:[[825,25,250,78],[825,103,250,82]],slits:[{path:[[1100,103],[905,103]],mouth:[985,60,115,90],trim:true}]}]
 ];
 let s=box(0,0,1100,240,paper);
 for(const [label,g] of pieces){
  const outline=buildGlyph({joins:[],cuts:[],restores:[],slits:[],seamClose:4,...g},state,t,[]);
  s+=`<path d="${toPath(outline)}" fill="${ink}" fill-rule="evenodd"/>`+type(label,g.columns[0][0],222,10,ink);
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="240" viewBox="0 0 1100 240" role="img" aria-label="Capsule construction pieces">${s}</svg>`;
}
