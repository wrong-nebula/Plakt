/* RKC — disc field (v2). Original procedural type system after the visible
 * vocabulary of the December RKC poster by Giliane Cachin + Viltė Jurgutytė.
 * One rule draws letter and counter alike: every lattice cell holds a module,
 * and a module flattens each side it shares with a bonded same-ink neighbour.
 * No source contours are traced. v1 (tile kit) lives in engine-v1.mjs.
 */
import {ALPHABET} from '../letter-shape-systems/engine.mjs';
import {K,union,offset,toPath,area} from '../punkt-capsule-system/geometry.mjs';

export const ENGINE='rkc-disc-field-v2';
export const SOURCE={
 id:'5e5b65b8f544582ee0f267dd-p0',
 title:'RKC — December programme',
 credit:'Giliane Cachin + Viltė Jurgutytė',
 url:'https://www.instagram.com/p/CXfo2KfIzF1/',
 basis:'Source credit transcribed from the archived library caption. The module rule is a visual interpretation, not recovered authoring data.'
};
export const FAMILIES=[
 {id:'disc',name:'Discs & half-discs',profile:'arc',radius:.5,note:'Round corners of half a cell: a loose module is a disc, a run end is a half-disc. The source vocabulary.'},
 {id:'pillow',name:'Soft squares',profile:'arc',radius:.28,note:'Smaller corner arcs: loose modules become rounded squares; bonds, fillets and necks follow the same rule.'},
 {id:'facet',name:'Octagons',profile:'chamfer',radius:.3,note:'Every arc becomes a 45° cut, including fillets and necks: the same letters as a faceted face.'}
];
// Which shared sides an ink flattens. Letter and counter each choose one.
export const BONDS=[
 {id:'none',name:'Loose',h:false,v:false},
 {id:'across',name:'Across',h:true,v:false},
 {id:'down',name:'Down',h:false,v:true},
 {id:'both',name:'Both ways',h:true,v:true}
];
// Module lengths are shares of the cell pitch; layout lengths are whole cells.
export const CONTROLS=[
 {key:'seam',label:'Hairline',group:'modules',min:0,max:.12,step:.005,value:.02},
 {key:'fillet',label:'Inner fillet',group:'modules',min:0,max:1,step:.05,value:.7},
 {key:'neck',label:'Diagonal neck',group:'modules',min:0,max:1,step:.05,value:.9},
 {key:'pad',label:'Backing rim',group:'modules',min:0,max:.25,step:.01,value:.08},
 {key:'tracking',label:'Letter gap',group:'layout',min:0,max:3,step:1,value:1},
 {key:'leading',label:'Row gap',group:'layout',min:0,max:3,step:1,value:1},
 {key:'margin',label:'Field margin',group:'layout',min:0,max:4,step:1,value:0},
 {key:'border',label:'Paper border',group:'layout',min:0,max:1,step:.05,value:.15}
];
// Fit formats are 1000 units tall; the field fills each with whole modules.
export const FORMATS=[
 {id:'december',name:'December 5:7',width:720,height:1000},
 {id:'poster',name:'Poster 2:3',width:668,height:1000},
 {id:'a-series',name:'A series',width:707,height:1000},
 {id:'square',name:'Square',width:1000,height:1000},
 {id:'story',name:'Story 9:16',width:563,height:1000},
 {id:'landscape',name:'Landscape 16:9',width:1778,height:1000},
 {id:'billboard',name:'Billboard 3:1',width:3000,height:1000}
];
// Paper (gaps) / letter / counter.
export const PALETTES=[
 {id:'december',name:'December',colors:['#f5221f','#f3e3c7','#6f4c2b'],note:'Medians of sunlit areas of the photographed print'},
 {id:'night',name:'Night',colors:['#0b0b10','#e3ff3d','#2b2a3c'],note:'Neon letter on a dark counter field'},
 {id:'indigo',name:'Indigo',colors:['#3d3fac','#cdbef5','#24263e'],note:'From the v1 colour study'},
 {id:'rose',name:'Rose',colors:['#91275e','#f0b3d3','#43263e'],note:'From the v1 colour study'}
];
export const DEFAULT_COLORS=PALETTES[0].colors;
export const LAYOUTS=[{id:'fit',name:'Fit a format'},{id:'field',name:'Natural field'}];
// Named module rules. They leave text, layout and format alone; the first is
// the engine default and the closest reading of the source.
export const PRESETS=[
 {id:'december',name:'December',note:'Loose letter discs on a counter-ink ribbon, necked along diagonals; loose counter discs leave red stars.',
  state:{family:'disc',figure:'none',ground:'none',backing:true,colors:PALETTES[0].colors}},
 {id:'ribbon',name:'Ribbon',note:'Letters join across into flat bands; stems stay a stack of discs on the ribbon.',
  state:{family:'disc',figure:'across',ground:'none',backing:true,colors:PALETTES[0].colors}},
 {id:'woven',name:'Woven',note:'Letters join across, counters join down: two grains in one field, red only where both round off.',
  state:{family:'disc',figure:'across',ground:'down',backing:false,colors:PALETTES[0].colors}},
 {id:'solid',name:'Solid',note:'Letters join both ways into one filleted shape; counters run down as pills.',
  state:{family:'disc',figure:'both',ground:'down',backing:true,colors:PALETTES[0].colors}},
 {id:'night',name:'Night',note:'Solid octagon letters in neon; counters join down into dark rails.',
  state:{family:'facet',figure:'both',ground:'down',backing:false,colors:PALETTES[1].colors}}
];

// Extra punctuation for programme copy (dates, times, credits).
const EXTRA={
 ':':['00000','00110','00110','00000','00110','00110','00000'],
 '!':['00100','00100','00100','00100','00100','00000','00100'],
 '?':['01110','10001','00001','00110','00100','00000','00100'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 "'":['00100','00100','01000','00000','00000','00000','00000'],
 ',':['00000','00000','00000','00000','00110','00010','00100'],
 '&':['01100','10010','10100','01000','10101','10010','01101']
};
export const GLYPHS={...ALPHABET,...EXTRA};
const SUPPORTED=/[A-Z0-9 .:!?+'&,-]/;
const SPACE=2;

const n=x=>Number(x.toFixed(2));
const safeColor=(x,f)=>/^#[\da-f]{6}$/i.test(x??'')?x.toLowerCase():f;
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function normalize(input='R'){
 const text=String(input).normalize('NFKD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\r?\n/g,'/');
 if(!text.replace(/[ /]/g,''))throw new Error('Enter at least one letter.');
 const bad=[...new Set([...text].filter(c=>c!=='/'&&!SUPPORTED.test(c)))];
 if(bad.length)throw new Error(`Use A–Z, 0–9, . : ! ? + ' & , - or / for a new row. Unsupported: ${bad.join(' ')}`);
 if(text.replaceAll('/','').length>24||text.split('/').length>4)throw new Error('Use up to 24 characters and four rows.');
 return text;
}
export function resolve(input={}){
 const v1=input.engine==='rkc-disc-counter-v1';
 // v1 rules keep their letters, kernel, inks and hairline; its tile-kit controls have no v2 meaning.
 const given=v1?{seam:input.params?.seam}:{...input.params},params={};
 for(const c of CONTROLS){const v=Number(given[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:c.value));if(c.step===1)params[c.key]=Math.round(params[c.key]);}
 const bond=(v,f)=>BONDS.some(b=>b.id===v)?v:f;
 return {version:2,engine:ENGINE,text:normalize(input.text),
  family:(FAMILIES.find(f=>f.id===(input.family??input.kernel))??FAMILIES[0]).id,
  figure:bond(input.figure,v1?'both':'none'),ground:bond(input.ground,'none'),backing:v1?false:input.backing===undefined?true:!!input.backing,
  params,colors:DEFAULT_COLORS.map((c,i)=>safeColor(input.colors?.[i],c)),invert:!!input.invert,
  layout:v1?'field':LAYOUTS.some(l=>l.id===input.layout)?input.layout:'fit',
  format:(FORMATS.find(f=>f.id===input.format)??FORMATS[0]).id,
  stage:Math.min(4,Math.max(1,Math.round(Number(input.stage)||4)))};
}

// A glyph keeps only its occupied columns, so 1 . : ! are narrower than letters.
export function glyphCells(ch){
 const map=GLYPHS[ch]??GLYPHS[' '],cells=[];
 for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(map[y][x]==='1')cells.push([x,y]);
 if(!cells.length)return {width:SPACE,cells};
 const lo=Math.min(...cells.map(c=>c[0])),hi=Math.max(...cells.map(c=>c[0]));
 return {width:hi-lo+1,cells:cells.map(([x,y])=>[x-lo,y])};
}
function block(rows,params){
 const t=params.tracking,measured=rows.map(row=>{let x=0;const glyphs=[...row].map((ch,i)=>{const g=glyphCells(ch);if(i)x+=t;const at=x;x+=g.width;return {character:ch,x:at,...g};});return {width:x,glyphs};});
 const width=Math.max(...measured.map(r=>r.width)),height=rows.length*7+(rows.length-1)*params.leading;
 return {rows,width,height,measured};
}
// Without '/', fit tries every break into up to four rows. Words stay whole;
// a single word never splits inside a number or before punctuation, and no row
// holds fewer than half the letters of the longest.
const PUNCTUATION=/[.,:!?']/;
function rowBreaks(text){
 if(text.includes('/'))return [text.split('/')];
 const words=text.split(' ').filter(Boolean),units=words.length>1?words:[...text],sep=words.length>1?' ':'',out=[];
 const breakable=i=>words.length>1||!(PUNCTUATION.test(units[i])||/\d/.test(units[i-1])&&/\d/.test(units[i]));
 const walk=(start,acc)=>{if(start===units.length){out.push(acc);return;}if(acc.length===4)return;
  for(let end=start+1;end<=units.length;end++)if(end===units.length||breakable(end))walk(end,[...acc,units.slice(start,end).join(sep)]);};
 walk(0,[]);
 const letters=row=>row.replaceAll(' ','').length;
 return out.filter(rows=>{const most=Math.max(...rows.map(letters));return rows.every(r=>letters(r)>=Math.ceil(most/2));});
}
function pitchFor(b,params,W,H){const m=2*params.margin+2*params.border;return Math.min(W/(b.width+m),H/(b.height+m));}
// Largest modules win, but fewer rows are kept unless letters grow by over 5%;
// equal candidates prefer even rows, then the longer row first.
function bestBreak(text,params,W,H){
 const scored=rowBreaks(text).map(rows=>{const b=block(rows,params),widths=b.measured.map(r=>r.width);
  return {b,p:pitchFor(b,params,W,H),rows:rows.length,even:Math.min(...widths)/Math.max(...widths),first:widths[0]};});
 const top=Math.max(...scored.map(s=>s.p)),near=scored.filter(s=>s.p>=top/1.05),fewest=Math.min(...near.map(s=>s.rows));
 return near.filter(s=>s.rows===fewest).sort((a,b)=>b.p-a.p||b.even-a.even||b.first-a.first)[0].b;
}
// The lattice: block of glyph cells centred in a field of counter cells.
export function arrange(input={},page){
 const state=resolve(input),{params}=state,fit=!!page||state.layout==='fit';
 const box=page??FORMATS.find(f=>f.id===state.format);
 const b=fit?bestBreak(state.text,params,box.width,box.height):block(state.text.split('/'),params);
 let p,cols,rows,width,height;
 if(fit){
  p=pitchFor(b,params,box.width,box.height);width=box.width;height=box.height;
  cols=Math.floor((width-2*params.border*p)/p+1e-6);rows=Math.floor((height-2*params.border*p)/p+1e-6);
 }else{
  p=100;cols=b.width+2*params.margin;rows=b.height+2*params.margin;width=(cols+2*params.border)*p;height=(rows+2*params.border)*p;
 }
 const bx=Math.floor((cols-b.width)/2),by=Math.floor((rows-b.height)/2),ox=(width-cols*p)/2,oy=(height-rows*p)/2;
 const owner=new Map(),glyphs=[];
 b.measured.forEach((row,ri)=>{const rx=bx+Math.floor((b.width-row.width)/2),ry=by+ri*(7+params.leading);
  row.glyphs.forEach(g=>{const index=glyphs.length;
   glyphs.push({character:g.character,row:ri,index,frame:{x:n(ox+(rx+g.x)*p),y:n(oy+ry*p),w:n(g.width*p),h:n(7*p)}});
   for(const [x,y] of g.cells)owner.set((ry+y)*cols+rx+g.x+x,index);});});
 return {state,p,cols,rows,width,height,ox,oy,rowsText:b.rows,glyphs,
  inkAt:(c,r)=>c<0||r<0||c>=cols||r>=rows?-1:owner.has(r*cols+c)?1:0,glyphAt:(c,r)=>owner.get(r*cols+c)??-1};
}

// Corners NW, NE, SE, SW; ports N, E, S, W. A corner stays square only when
// one of its two sides is bonded.
const PORTS=[[0,-1],[1,0],[0,1],[-1,0]];
const CORNER_PORTS=[[0,3],[0,1],[2,1],[2,3]];
const toClipper=pts=>{const path=pts.map(([x,y])=>({X:Math.round(x*K),Y:Math.round(y*K)}));return area(path)<0?path.reverse():path;};
function corners(x,y,w,h,round,r,profile){
 const H=Math.PI/2;
 return [[x,y,x+r,y+r,2*H,3*H,[x,y+r],[x+r,y]],[x+w,y,x+w-r,y+r,-H,0,[x+w-r,y],[x+w,y+r]],
  [x+w,y+h,x+w-r,y+h-r,0,H,[x+w,y+h-r],[x+w-r,y+h]],[x,y+h,x+r,y+h-r,H,2*H,[x+r,y+h],[x,y+h-r]]]
  .map(([px,py,cx,cy,a0,a1,from,to],i)=>round[i]&&r>1e-6?{cx,cy,a0,a1,from,to,arc:profile==='arc'}:{from:[px,py],to:[px,py]});
}
function modulePoints(x,y,w,h,round,r,profile,tol){
 const pts=[];
 for(const c of corners(x,y,w,h,round,r,profile)){
  if(!c.arc){pts.push(c.from);if(c.to!==c.from)pts.push(c.to);continue;}
  const steps=Math.max(2,Math.ceil((c.a1-c.a0)/Math.acos(Math.max(-1,1-tol/r))));
  for(let i=0;i<=steps;i++){const a=c.a0+(c.a1-c.a0)*i/steps;pts.push([c.cx+r*Math.cos(a),c.cy+r*Math.sin(a)]);}
 }
 return pts;
}
// Exact SVG for a loose module: true arcs, no polygon approximation.
function moduleD(x,y,w,h,round,r,profile){
 const cs=corners(x,y,w,h,round,r,profile),f=([a,b])=>`${n(a)} ${n(b)}`;
 return 'M'+f(cs[0].from)+cs.map((c,i)=>(c.arc?`A${n(r)} ${n(r)} 0 0 1 ${f(c.to)}`:c.to!==c.from?`L${f(c.to)}`:'')+(i<3?`L${f(cs[i+1].from)}`:'')).join('')+'Z';
}
const insetRadius=(r,s,profile)=>Math.max(0,profile==='arc'?r-s:r-s*(2-Math.SQRT2));
// A concave fillet in the corner of the cell at (V + d), d = (±1, ±1).
function filletPiece(vx,vy,dx,dy,f,profile,tol){
 const local=[[0,0],[f,0]];
 if(profile==='arc'){const steps=Math.max(2,Math.ceil(H2/Math.acos(Math.max(-1,1-tol/f))));
  for(let i=0;i<=steps;i++){const a=-H2-H2*i/steps;local.push([f+f*Math.cos(a),f+f*Math.sin(a)]);}}
 else local.push([0,f]);
 return [toClipper(local.map(([x,y])=>[vx+dx*x,vy+dy*y]))];
}
const H2=Math.PI/2;
// The neck between diagonal round corners, in a frame where V is the origin and
// the two corner arcs (radius R) are centred at (−R,−R) and (R,R). Its sides are
// fillet circles of radius f tangent to both arcs; the chords lie inside the
// modules, so the union with them is seamless.
function neckPoints(R,f,tol){
 const d=Math.sqrt((R+f)**2-2*R*R),pts=[],k=R/(R+f);
 for(const side of [1,-1]){
  const F=[side*d/Math.SQRT2,-side*d/Math.SQRT2],[a,b]=side>0?[[-R,-R],[R,R]]:[[R,R],[-R,-R]];
  const T0=[a[0]+k*(F[0]-a[0]),a[1]+k*(F[1]-a[1])],T1=[b[0]+k*(F[0]-b[0]),b[1]+k*(F[1]-b[1])];
  const a0=Math.atan2(T0[1]-F[1],T0[0]-F[0]),am=Math.atan2(-F[1],-F[0]);
  let sweep=Math.atan2(T1[1]-F[1],T1[0]-F[0])-a0;sweep=Math.atan2(Math.sin(sweep),Math.cos(sweep));
  // Take the side of the fillet circle that faces the vertex.
  const via=Math.atan2(Math.sin(am-a0),Math.cos(am-a0));if(Math.sign(via)!==Math.sign(sweep)||Math.abs(via)>Math.abs(sweep))sweep-=Math.sign(sweep)*2*Math.PI;
  const steps=Math.max(2,Math.ceil(Math.abs(sweep)/Math.acos(Math.max(-1,1-tol/f))));
  for(let i=0;i<=steps;i++){const t=a0+sweep*i/steps;pts.push([F[0]+f*Math.cos(t),F[1]+f*Math.sin(t)]);}
 }
 return pts;
}

// Build every module, bond, fillet, neck and the backing for one lattice.
function construct(state,geo){
 const fam=FAMILIES.find(f=>f.id===state.family),{p,cols,rows,inkAt}=geo,{params}=state,stage=state.stage;
 const R=fam.radius*p,profile=fam.profile,s=params.seam*p/2,tol=Math.max(.02,p*.0015),finish=stage>=4;
 const sets=[BONDS.find(b=>b.id===state.ground),BONDS.find(b=>b.id===state.figure)];
 const X=c=>geo.ox+c*p,Y=r=>geo.oy+r*p,at=(c,r)=>r*cols+c;
 const bondedTo=(c,r,port,set)=>{const [dx,dy]=PORTS[port];return inkAt(c+dx,r+dy)===inkAt(c,r)&&(dx?set.h:set.v);};
 const roundOf=(c,r,set)=>CORNER_PORTS.map(([a,b])=>!(set&&(bondedTo(c,r,a,set)||bondedTo(c,r,b,set))));
 const cells=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const ink=inkAt(c,r);cells.push({c,r,ink,round:roundOf(c,r,stage>=3?sets[ink]:null)});}
 const shapeOf=cell=>[toClipper(modulePoints(X(cell.c),Y(cell.r),p,p,cell.round,R,profile,tol))];
 const parent=cells.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);};
 if(stage>=3)for(const cell of cells)for(const port of [1,2])if(bondedTo(cell.c,cell.r,port,sets[cell.ink]))join(at(cell.c,cell.r),at(cell.c+PORTS[port][0],cell.r+PORTS[port][1]));
 const extras=[],necks=[],backingExtras=[];let fillets=0;
 if(finish){
  const f=params.fillet*R*.995;
  // Necks bridge diagonal letter cells across a vertex the counter ink owns.
  // Their arcs run from first contact, R(√2−1), to tangency with the counter, R.
  const fn=R*(Math.SQRT2-1+params.neck*(2-Math.SQRT2))*.995;
  for(let j=1;j<rows;j++)for(let i=1;i<cols;i++){
   const quad=[[i-1,j-1],[i,j-1],[i,j],[i-1,j]],vx=X(i),vy=Y(j);
   for(const ink of [0,1]){
    const on=quad.map(([c,r])=>inkAt(c,r)===ink);if(on.filter(Boolean).length!==3)continue;
    const m=on.indexOf(false),k=(m+2)%4,[cc,cr]=quad[k],[mc,mr]=quad[m],piece=()=>filletPiece(vx,vy,mc===i?1:-1,mr===j?1:-1,f,profile,tol);
    if(ink===1&&state.backing&&f>0)backingExtras.push(piece());
    // A fillet fills the inside corner of an L whose two arms are both bonded.
    const set=sets[ink];if(f>0&&set.h&&set.v){extras.push({cell:at(cc,cr),shape:piece()});fillets++;}
   }
   const fig=quad.map(([c,r])=>inkAt(c,r)===1);
   if(params.neck>0&&fig.filter(Boolean).length===2&&(fig[0]===fig[2])){
    const [A,B]=fig[0]?[quad[0],quad[2]]:[quad[1],quad[3]],ia=at(...A),ib=at(...B);
    const sx=B[0]>A[0]?1:-1,sy=B[1]>A[1]?1:-1,t=params.neck*R/2,e=.02*p,m=R/2;
    // Facets: a straight bridge between the two facing cuts, narrowed by the neck value.
    const local=profile==='arc'?neckPoints(R,fn,tol):[[-m+t-e,-m-t-e],[m+t+e,m-t+e],[m-t+e,m+t+e],[-m-t-e,-m+t-e]];
    const neck=[toClipper(local.map(([x,y])=>[vx+sx*x,vy+sy*y]))];
    join(ia,ib);extras.push({cell:ia,shape:neck});necks.push(neck);
   }
  }
 }
 const groups=new Map();
 cells.forEach((cell,i)=>{const g=find(i);if(!groups.has(g))groups.set(g,{ink:cell.ink,cells:[],extras:[]});groups.get(g).cells.push(i);});
 for(const e of extras)groups.get(find(e.cell)).extras.push(e.shape);
 for(const g of groups.values()){
  g.glyphs=[...new Set(g.cells.map(i=>geo.glyphAt(cells[i].c,cells[i].r)).filter(x=>x>=0))];
  g.loose=g.cells.length===1&&!g.extras.length;
  g.shape=()=>g.cached??=(()=>{const u=union(...g.cells.map(i=>shapeOf(cells[i])),...g.extras);return s>0?offset(u,-s):u;})();
  g.d=()=>{if(!g.loose)return toPath(g.shape());const cell=cells[g.cells[0]];
   return moduleD(X(cell.c)+s,Y(cell.r)+s,p-2*s,p-2*s,cell.round,insetRadius(R,s,profile),profile);};
 }
 let backing=null;
 if(finish&&state.backing){
  // The backing is the letter joined both ways, in counter ink, grown by the rim.
  const both={h:true,v:true},shapes=cells.filter(c=>c.ink===1).map(c=>[toClipper(modulePoints(X(c.c),Y(c.r),p,p,roundOf(c.c,c.r,both),R,profile,tol))]);
  if(shapes.length){const u=union(...shapes,...backingExtras,...necks);backing=params.pad>0?offset(u,params.pad*p):u;}
 }
 return {cells,groups:[...groups.values()],backing,X,Y,R,s,fillets,necks:necks.length};
}

function paint(state,geo,built){
 const [paper,light,dark]=state.colors,fig=state.invert?dark:light,ground=state.invert?light:dark,{p}=geo;
 if(state.stage===1){
  // Lattice: every position outlined in its ink, letter positions marked.
  const r=p*.47,w=n(p*.04);let outline=['',''],dots='';
  for(const cell of built.cells){const cx=n(built.X(cell.c)+p/2),cy=n(built.Y(cell.r)+p/2);
   outline[cell.ink]+=`M${n(cx-r)} ${cy}a${n(r)} ${n(r)} 0 1 0 ${n(2*r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2*r)} 0Z`;
   if(cell.ink)dots+=`M${n(cx-p*.1)} ${cy}a${n(p*.1)} ${n(p*.1)} 0 1 0 ${n(p*.2)} 0a${n(p*.1)} ${n(p*.1)} 0 1 0 ${n(-p*.2)} 0Z`;}
  return `<path d="${outline[0]}" fill="none" stroke="${ground}" stroke-width="${w}"/><path d="${outline[1]}" fill="none" stroke="${fig}" stroke-width="${w}"/><path d="${dots}" fill="${fig}"/>`;
 }
 const d=['',''];for(const g of built.groups)d[g.ink]+=g.d();
 return (built.backing?`<path d="${toPath(built.backing)}" fill="${ground}"/>`:'')+`<path d="${d[0]}" fill="${ground}"/><path d="${d[1]}" fill="${fig}"/>`;
}

export function render(input={},page){
 const geo=arrange(input,page),{state}=geo,built=construct(state,geo);
 const body=`<rect width="${n(geo.width)}" height="${n(geo.height)}" fill="${state.colors[0]}"/>`+paint(state,geo,built);
 const fam=FAMILIES.find(f=>f.id===state.family),format=page?'custom':state.layout==='fit'?state.format:'field';
 const desc=`${geo.rowsText.join(' / ')}. ${fam.name}; letters ${state.figure}, counters ${state.ground}${state.backing?', on a backing':''}. Stage ${state.stage}. A procedural type system after the RKC December poster.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${n(geo.width)}" height="${n(geo.height)}" viewBox="0 0 ${n(geo.width)} ${n(geo.height)}" role="img" aria-label="${escape(desc)}"><title>${escape(state.text)} — RKC disc field</title><desc>${escape(desc)}</desc>${body}</svg>`;
 const loose=built.groups.filter(g=>g.loose).length;
 return {svg,state,width:n(geo.width),height:n(geo.height),glyphs:geo.glyphs,
  features:{layout:state.layout,format,family:state.family,figure:state.figure,ground:state.ground,rows:geo.rowsText.length,rowsText:geo.rowsText,
   cols:geo.cols,fieldRows:geo.rows,cells:geo.cols*geo.rows,figureCells:built.cells.filter(c=>c.ink===1).length,
   pitch:n(geo.p),shapes:built.groups.length,looseModules:loose,fillets:built.fillets,necks:built.necks,stage:state.stage},
  geometry:()=>({groups:built.groups,backing:built.backing,seam:2*built.s,pitch:geo.p,radius:built.R})};
}

// A tiny 5×7 dot label for the kit sheet.
function label(text,x,y,size,color){
 let d='',col=0;for(const ch of text){const {cells,width}=glyphCells(ch);
  for(const [cx,cy] of cells)d+=`M${n(x+(col+cx)*size)} ${n(y+cy*size)}h${n(size*.86)}v${n(size*.86)}h${n(-size*.86)}Z`;col+=width+1;}
 return `<path d="${d}" fill="${color}"/>`;
}
export const KIT=[
 {id:'disc',name:'LOOSE',map:['000','010','000']},
 {id:'run',name:'RUN',map:['000','111','000']},
 {id:'elbow',name:'ELBOW',map:['000','011','010']},
 {id:'tee',name:'TEE',map:['000','111','010']},
 {id:'neck',name:'NECK',map:['100','010','001']},
 {id:'ring',name:'RING',map:['111','101','111']}
];
// Six neighbourhoods drawn by the live rule, so the kit follows every control.
export function kit(input={}){
 const state=resolve(input),p=50,size=3*p,gap=34,W=KIT.length*(size+gap)+gap,H=size+gap*2+28;
 let body=`<rect width="${W}" height="${H}" fill="${state.colors[0]}"/>`;
 KIT.forEach((piece,i)=>{
  const ox=gap+i*(size+gap),oy=gap,map=piece.map;
  const geo={p,cols:3,rows:3,ox,oy,width:size,height:size,inkAt:(c,r)=>c<0||r<0||c>2||r>2?-1:+map[r][c],glyphAt:()=>-1};
  body+=paint(state,geo,construct(state,geo))+label(piece.name,ox,oy+size+14,2.2,state.invert?state.colors[2]:state.colors[1]);
 });
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Six neighbourhoods of the module rule">${body}</svg>`;
}
