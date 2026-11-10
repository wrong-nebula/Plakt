/* Capsule Tube — the poster's outline lettering (NEU BAD LUZERN, the date) as a font.
 * Each glyph is a monoline skeleton with filleted corners, drawn as an outlined
 * two-lane track: the outline of a fat stroke plus a centre line. The Shadow style adds
 * the stroke's silhouette, offset down and right, wherever it falls outside the letter.
 * Coordinates are font units, y down while drawing; 700 units tall, like Capsule.
 */
import ClipperLib from 'clipper-lib';

export const TUBE={height:700,stroke:176,outline:22,centre:34,radius:130,shadow:[42,42],spacing:60,mark:{stroke:104,outline:18,centre:22}};
const H=TUBE.height,t=TUBE.stroke/2,T=t,B=H-t,M=H/2;
// A path is a list of [x, y, radius?] vertices; radius 0 keeps a sharp corner.
const P=(...pts)=>({pts,closed:false}),L=(...pts)=>({pts,closed:true});
const box=w=>({l:t,r:w-t,c:w/2});
const dot=(x,y)=>P([x,y],[x,y-1]);
const SKELETONS={
 a:[600,({l,r})=>[P([l,B],[l,T],[r,T],[r,B]),P([l,M+30],[r,M+30])]],
 b:[600,({l,r})=>[P([l,M,0],[l,T,0],[r-40,T],[r-40,M],[l,M,0]),P([l,M,0],[r,M],[r,B],[l,B,0],[l,M,0])]],
 c:[580,({l,r})=>[P([r,T],[l,T],[l,B],[r,B])]],
 d:[600,({l,r})=>[L([l,T,0],[r,T],[r,B],[l,B,0])]],
 e:[580,({l,r})=>[P([r,T],[l,T],[l,B],[r,B]),P([l,M],[r-60,M])]],
 f:[560,({l,r})=>[P([r,T],[l,T],[l,B]),P([l,M],[r-60,M])]],
 g:[600,({l,r,c})=>[P([r,T],[l,T],[l,B],[r,B],[r,M],[c,M])]],
 h:[600,({l,r})=>[P([l,T],[l,B]),P([r,T],[r,B]),P([l,M],[r,M])]],
 i:[176,({c})=>[P([c,T],[c,B])]],
 j:[520,({l,r})=>[P([r,T],[r,B],[l,B],[l,M+60])]],
 k:[600,({l,r})=>[P([l,T],[l,B]),P([r,T,0],[l+10,M,0],[r,B,0])]],
 l:[540,({l,r})=>[P([l,T],[l,B],[r,B])]],
 m:[780,({l,r,c})=>[P([l,B],[l,T],[r,T],[r,B]),P([c,T],[c,B])]],
 n:[620,({l,r})=>[P([l,B],[l,T,0],[r,B,0],[r,T])]],
 o:[620,({l,r})=>[L([l,T],[r,T],[r,B],[l,B])]],
 p:[600,({l,r})=>[P([l,B],[l,T,0],[r,T],[r,M+20],[l,M+20,0])]],
 q:[640,({l,r,c})=>[L([l,T],[r,T],[r,B],[l,B]),P([c+30,M+70,0],[r+40,B+40,0])]],
 r:[600,({l,r,c})=>[P([l,B],[l,T,0],[r,T],[r,M+20],[l,M+20,0]),P([c,M+20,0],[r,B,0])]],
 s:[580,({l,r})=>[P([r,T],[l,T],[l,M],[r,M],[r,B],[l,B])]],
 t:[600,({l,r,c})=>[P([l,T],[r,T]),P([c,T],[c,B])]],
 u:[600,({l,r})=>[P([l,T],[l,B],[r,B],[r,T])]],
 v:[620,({l,r,c})=>[P([l,T,0],[c,B,0],[r,T,0])]],
 w:[780,({l,r,c})=>[P([l,T],[l,B],[r,B],[r,T]),P([c,M-20],[c,B])]],
 x:[600,({l,r})=>[P([l,T,0],[r,B,0]),P([r,T,0],[l,B,0])]],
 y:[600,({l,r,c})=>[P([l,T,0],[c,M,0],[r,T,0]),P([c,M,0],[c,B])]],
 z:[580,({l,r})=>[P([l,T,0],[r,T,0],[l,B,0],[r,B,0])]],
 0:[520,({l,r})=>[L([l,T],[r,T],[r,B],[l,B])]],
 1:[330,({l,r})=>[P([l,T+90,0],[r,T,0],[r,B])]],
 2:[540,({l,r})=>[P([l,T],[r,T],[r,M],[l,M],[l,B],[r,B])]],
 3:[540,({l,r})=>[P([l,T],[r,T],[r,B],[l,B]),P([l+60,M],[r,M])]],
 4:[560,({l,r})=>[P([l,T],[l,M+60],[r,M+60]),P([r-40,T],[r-40,B])]],
 5:[540,({l,r})=>[P([r,T],[l,T,0],[l,M,0],[r,M],[r,B],[l,B])]],
 6:[540,({l,r})=>[P([r,T],[l,T],[l,B],[r,B],[r,M],[l,M])]],
 7:[520,({l,r,c})=>[P([l,T],[r,T,0],[c-20,B,0])]],
 // Two stacked loops, the upper one narrower, so 8 never reads as a boxed bar.
 8:[540,({l,r})=>[L([l+34,T],[r-34,T],[r-34,M],[l+34,M]),L([l,M],[r,M],[r,B],[l,B])]],
 9:[540,({l,r})=>[P([r,M],[l,M],[l,T],[r,T],[r,B],[l,B])]],
 '.':[176,({c})=>[dot(c,B)]],
 ',':[220,({c})=>[P([c,B-1],[c-30,B+70,0])]],
 ':':[176,({c})=>[dot(c,M-30),dot(c,B)]],
 ';':[220,({c})=>[dot(c,M-30),P([c,B-1],[c-30,B+70,0])]],
 '!':[176,({c})=>[P([c,T],[c,B-240]),dot(c,B)]],
 '?':[500,({l,r,c})=>[P([l,T+70],[l,T],[r,T],[r,M],[c,M],[c,M+80]),dot(c,B)]],
 "'":[176,({c})=>[P([c,T],[c,T+110])]],
 '"':[380,({l,r})=>[P([l,T],[l,T+110]),P([r,T],[r,T+110])]],
 '-':[400,({l,r})=>[P([l,M],[r,M])]],
 '–':[580,({l,r})=>[P([l,M],[r,M])]],
 '—':[880,({l,r})=>[P([l,M],[r,M])]],
 '/':[440,({l,r})=>[P([r,T,0],[l,B,0])]],
 '(':[320,({l,r})=>[P([r,T,0],[l,M,1000],[r,B,0])]],
 ')':[320,({l,r})=>[P([l,T,0],[r,M,1000],[l,B,0])]],
 '[':[320,({l,r})=>[P([r,T,0],[l,T,0],[l,B,0],[r,B,0])]],
 ']':[320,({l,r})=>[P([l,T,0],[r,T,0],[r,B,0],[l,B,0])]],
 '&':[640,({l,r,c})=>[P([r,B,0],[l+30,M-30],[l+30,T],[c+70,T],[c+70,M-70],[l,M+110],[l,B],[r-70,B],[r,M+50,0])]],
 '+':[520,({l,r,c})=>[P([l,M],[r,M]),P([c,M-(r-l)/2],[c,M+(r-l)/2])]],
 '=':[520,({l,r})=>[P([l,M-110],[r,M-110]),P([l,M+110],[r,M+110])]],
 '%':[640,({l,r})=>[dot(l,T),dot(r,B),P([r,T,0],[l,B,0])]],
 '#':[640,({l,r})=>[P([l+70,T],[l+70,B]),P([r-70,T],[r-70,B]),P([l,M-110],[r,M-110]),P([l,M+110],[r,M+110])]],
 '*':[460,({l,r,c})=>[P([c,T],[c,M+30]),P([l,T+50,0],[r,M-20,0]),P([r,T+50,0],[l,M-20,0])]],
 '«':[560,({l,r,c})=>[P([c-30,M-140,0],[l,M,0],[c-30,M+140,0]),P([r,M-140,0],[c+30,M,0],[r,M+140,0])]],
 '»':[560,({l,r,c})=>[P([l,M-140,0],[c-30,M,0],[l,M+140,0]),P([c+30,M-140,0],[r,M,0],[c+30,M+140,0])]],
 '×':[500,({l,r,c})=>{const h=(r-l)/2;return [P([l,M-h,0],[r,M+h,0]),P([r,M-h,0],[l,M+h,0])];}],
 '·':[176,({c})=>[dot(c,M)]],
 '…':[600,({l,r,c})=>[dot(l,B),dot(c,B),dot(r,B)]],
 '→':[680,({l,r})=>[P([l,M],[r,M]),P([r-160,M-160,0],[r,M,0],[r-160,M+160,0])]],
 '←':[680,({l,r})=>[P([r,M],[l,M]),P([l+160,M-160,0],[l,M,0],[l+160,M+160,0])]],
 '°':[480,({c})=>[L([c-125,T],[c+125,T],[c+125,T+250],[c-125,T+250])]],
 // € and @ need inner strokes; those are drawn as the thinner accent track so the lanes stay open.
 '$':[580,({l,r,c})=>[P([r,T],[l,T],[l,M],[r,M],[r,B],[l,B]),P([c,T-80],[c,T]),P([c,B],[c,B+80])]],
 '€':[620,({l,r,c})=>({paths:[P([r,T],[l+70,T],[l+70,B],[r,B])],marks:[P([l-20,M-78],[c+60,M-78]),P([l-20,M+78],[c+60,M+78])]})],
 '@':[720,({l,r,c})=>({paths:[P([r,M+70],[r,T],[l,T],[l,B],[r,B])],marks:[L([c-70,M-76],[c+70,M-76],[c+70,M+76],[c-70,M+76])]})],
 // The rest of printable ASCII.
 '<':[440,({l,r})=>[P([r,M-170,0],[l,M,0],[r,M+170,0])]],
 '>':[440,({l,r})=>[P([l,M-170,0],[r,M,0],[l,M+170,0])]],
 '\\':[440,({l,r})=>[P([l,T,0],[r,B,0])]],
 '^':[480,({l,r,c})=>[P([l,M-30,0],[c,T,0],[r,M-30,0])]],
 '_':[580,({l,r})=>[P([l,B],[r,B])]],
 '`':[300,({l,r})=>[P([l,T,0],[r,T+110,0])]],
 '{':[400,({l,r,c})=>[P([r,T],[c,T],[c,M-50],[l,M,0],[c,M+50],[c,B],[r,B])]],
 '}':[400,({l,r,c})=>[P([l,T],[c,T],[c,M-50],[r,M,0],[c,M+50],[c,B],[l,B])]],
 '|':[176,({c})=>[P([c,T-60],[c,B+90])]],
 '~':[560,({l,r})=>[P([l,M+50],[l+90,M-50],[r-90,M+50],[r,M-50])]],
 ' ':[300,()=>[]]
};
// Accents sit above the letters here (an outline has no solid to cut into), drawn as a thinner tube.
const MARKS={
 umlaut:c=>[dot(c-120,-110),dot(c+120,-110)],
 acute:c=>[P([c+60,-160,0],[c-50,-70,0])],
 grave:c=>[P([c-60,-160,0],[c+50,-70,0])],
 circumflex:c=>[P([c-110,-60,0],[c,-160,0],[c+110,-60,0])],
 cedilla:c=>[P([c,H+10],[c,H+100,0],[c-70,H+130,0])]
};
const ACCENTED=[['ä','a','umlaut'],['ö','o','umlaut'],['ü','u','umlaut'],['ë','e','umlaut'],['é','e','acute'],['è','e','grave'],['ê','e','circumflex'],['à','a','grave'],['â','a','circumflex'],['ô','o','circumflex'],['û','u','circumflex'],['ç','c','cedilla']];

// ---- Geometry ---------------------------------------------------------------
const SCALE=10;
// Replace each corner with a quadratic fillet sampled into points; radius 0 stays sharp.
function fillet({pts,closed}){
 const n=pts.length,out=[],at=i=>pts[(i+n)%n];
 for(let i=0;i<n;i++){
  const [x,y,rad=TUBE.radius]=pts[i];
  if(!closed&&(i===0||i===n-1)||rad===0){out.push([x,y]);continue;}
  const [px,py]=at(i-1),[nx,ny]=at(i+1),d1=Math.hypot(x-px,y-py),d2=Math.hypot(nx-x,ny-y);
  if(d1<1e-6||d2<1e-6){out.push([x,y]);continue;}
  const r=Math.min(rad,d1/2,d2/2),a=[x+(px-x)/d1*r,y+(py-y)/d1*r],b=[x+(nx-x)/d2*r,y+(ny-y)/d2*r];
  for(let s=0;s<=12;s++){const u=s/12,v=1-u;out.push([v*v*a[0]+2*v*u*x+u*u*b[0],v*v*a[1]+2*v*u*y+u*u*b[1]]);}
 }
 return out.map(([x,y])=>({X:Math.round(x*SCALE),Y:Math.round(y*SCALE)}));
}
function offset(paths,delta){
 const co=new ClipperLib.ClipperOffset(2,.15*SCALE);
 for(const p of paths)co.AddPath(fillet(p),ClipperLib.JoinType.jtRound,p.closed?ClipperLib.EndType.etClosedLine:ClipperLib.EndType.etOpenRound);
 const out=new ClipperLib.Paths();co.Execute(out,delta*SCALE);return out;
}
function op(type,a,b){
 const c=new ClipperLib.Clipper();c.AddPaths(a,ClipperLib.PolyType.ptSubject,true);c.AddPaths(b,ClipperLib.PolyType.ptClip,true);
 const out=new ClipperLib.Paths();c.Execute(type,out,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);return out;
}
const union=(a,b)=>op(ClipperLib.ClipType.ctUnion,a,b),minus=(a,b)=>op(ClipperLib.ClipType.ctDifference,a,b);
const shift=(paths,[dx,dy])=>paths.map(p=>p.map(({X,Y})=>({X:X+dx*SCALE,Y:Y+dy*SCALE})));
// Outline of the fat stroke plus the centre line: two lanes.
function track(paths,{stroke,outline,centre}){
 const fat=offset(paths,stroke/2);
 return {fat,lanes:union(minus(fat,offset(paths,stroke/2-outline)),offset(paths,centre/2))};
}
function skeletonOf(ch){
 const accent=ACCENTED.find(a=>a[0]===ch),[w,draw]=SKELETONS[accent?accent[1]:ch],drawn=draw(box(w));
 const paths=Array.isArray(drawn)?drawn:drawn.paths,thin=Array.isArray(drawn)?[]:drawn.marks;
 return {w,paths,marks:[...thin,...(accent?MARKS[accent[2]](w/2):[])]};
}
export const TUBE_CHARACTERS=[...Object.keys(SKELETONS),...ACCENTED.map(a=>a[0])];
// The poster's shadow is an extrusion: the silhouette swept along the shadow offset, not a
// copy behind it, so round ends and diagonals stay solid all the way to the letter.
function extrude(paths,[dx,dy]){
 const sweep=ClipperLib.Clipper.MinkowskiSum([{X:0,Y:0},{X:dx*SCALE,Y:dy*SCALE}],paths,true);
 return union(union(paths,sweep),shift(paths,[dx,dy]));
}
function tracks(ch){
 const {w,paths,marks}=skeletonOf(ch);if(!paths.length)return {w};
 let {fat,lanes}=track(paths,TUBE);
 if(marks.length){const m=track(marks,TUBE.mark);lanes=union(lanes,m.lanes);fat=union(fat,m.fat);}
 return {w,fat,lanes};
}
// The solid silhouette as point lists in the glyph box (y down). Every Tube style is spaced
// from it, so Regular, Shadow and Fill share advances and layer exactly.
export function tubeSilhouette(ch){const {w,fat}=tracks(ch);return {width:w,polys:(fat??[]).map(p=>p.map(({X,Y})=>[X/SCALE,Y/SCALE]))};}
// One glyph as font-unit path data (y up, baseline 0) with the given sidebearings.
// Modes: regular (the two-lane track), shadow (track plus extrusion), fill (the solid silhouette).
export function tubeGlyph(ch,{mode='regular',lsb=TUBE.spacing/2,rsb=TUBE.spacing/2}={}){
 const {w,fat,lanes:outline}=tracks(ch);
 if(!fat)return {w:w+TUBE.spacing,path:''};
 let lanes=outline;
 if(mode==='shadow')lanes=union(lanes,minus(extrude(fat,TUBE.shadow),fat));
 if(mode==='fill')lanes=fat;
 const r3=v=>Math.round(v*1000)/1000,d=lanes.filter(p=>p.length>2).map(p=>'M'+p.map(({X,Y})=>`${r3(X/SCALE+lsb)} ${r3(H-Y/SCALE)}`).join('L')+'Z').join('');
 return {w:r3(lsb+w+rsb),path:d,lsb};
}
