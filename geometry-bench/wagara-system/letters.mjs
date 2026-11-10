/* Letter sources for window letters. Every glyph becomes a set of polygons in
 * cap units (cap height 1, y down, baseline at 1), then is condensed, unioned
 * and offset with clipper so weight changes are true outlines, not strokes.
 * Two sources share the 7-row cell alphabet of the isometric prism study
 * (block: square corners; round: corners eased), three are pre-extracted
 * outlines of heavy OFL faces (Archivo Black, Anton, Rubik Mono One).
 */
import ClipperLib from 'clipper-lib';
import {FONTS} from './fonts.mjs';
const CL=ClipperLib;
export const LETTER_SOURCES=[
 {id:'block',name:'Block cells',note:'7-row cell alphabet, square corners'},
 {id:'round',name:'Round cells',note:'Cell alphabet with eased corners'},
 {id:'archivo',name:'Archivo Black',note:'Heavy grotesque (OFL)'},
 {id:'anton',name:'Anton',note:'Condensed display (OFL)'},
 {id:'rubik',name:'Rubik Mono One',note:'Wide rounded mono (OFL)'}
];
// Cell alphabet, 7 rows (shared with geometry-bench/isometric-prism-system).
// # full · ◢◣◤◥ half cells · ╭╮╰╯ quarter discs rounding the named corner · ▼▲ tips.
export const GLYPHS={
 A:['.◢#◣.','◢◤.◥◣','#...#','#####','#...#','#...#','#...#'],B:['####╮','#...#','#...#','####.','#...#','#...#','####╯'],
 C:['╭###╮','#....','#....','#....','#....','#....','╰###╯'],D:['####╮','#...#','#...#','#...#','#...#','#...#','####╯'],
 E:['#####','#....','#....','####.','#....','#....','#####'],F:['#####','#....','#....','####.','#....','#....','#....'],
 G:['╭###╮','#....','#....','#.###','#...#','#...#','╰###╯'],H:['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
 I:['###','.#.','.#.','.#.','.#.','.#.','###'],J:['....#','....#','....#','....#','#...#','#...#','╰###╯'],
 K:['#..◢◤','#.◢◤.','#◢◤..','##...','#◥◣..','#.◥◣.','#..◥◣'],L:['#....','#....','#....','#....','#....','#....','#####'],
 M:['#◣...◢#','#◥◣.◢◤#','#.◥#◤.#','#.....#','#.....#','#.....#','#.....#'],N:['#...#','#◣..#','#◥◣.#','#.◥◣#','#..◥#','#...#','#...#'],
 O:['╭###╮','#...#','#...#','#...#','#...#','#...#','╰###╯'],P:['####╮','#...#','#...#','####╯','#....','#....','#....'],
 Q:['╭###╮','#...#','#...#','#...#','#◥◣.#','#.◥◣#','╰##◥◣'],R:['####╮','#...#','#...#','####╯','#.◥◣.','#..◥◣','#...#'],
 S:['╭###╮','#...#','#....','╰###╮','....#','#...#','╰###╯'],T:['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
 U:['#...#','#...#','#...#','#...#','#...#','#...#','╰###╯'],V:['#...#','#...#','#...#','#...#','◥◣.◢◤','.◥#◤.','..▼..'],
 W:['#.....#','#.....#','#.....#','#..#..#','#.◢#◣.#','#◢◤.◥◣#','#◤...◥#'],X:['#...#','◥◣.◢◤','.◥#◤.','..#..','.◢#◣.','◢◤.◥◣','#...#'],
 Y:['#...#','◥◣.◢◤','.◥#◤.','..#..','..#..','..#..','..#..'],Z:['#####','...◢#','..◢◤.','.◢◤..','◢◤...','#....','#####'],
 0:['╭###╮','#...#','#..◢#','#.◢◤#','#◢◤.#','#...#','╰###╯'],1:['.◢#..','◢◤#..','..#..','..#..','..#..','..#..','#####'],
 2:['╭###╮','#...#','...◢◤','..◢◤.','.◢◤..','◢◤...','#####'],3:['####╮','....#','....#','.####','....#','....#','####╯'],
 4:['...◢#','..◢◤#','.◢◤.#','◢◤..#','#####','....#','....#'],5:['#####','#....','#....','####╮','....#','#...#','╰###╯'],
 6:['╭###╮','#....','#....','####╮','#...#','#...#','╰###╯'],7:['#####','....#','...◢◤','..◢◤.','.◢◤..','.#...','.#...'],
 8:['╭###╮','#...#','#...#','.###.','#...#','#...#','╰###╯'],9:['╭###╮','#...#','#...#','╰####','....#','....#','╰###╯'],
 '.':['.','.','.','.','.','.','#'],',':['.','.','.','.','.','#','◤'],':':['.','.','#','.','.','.','#'],'-':['...','...','...','###','...','...','...'],
 '!':['#','#','#','#','#','.','#'],'?':['╭###╮','#...#','...◢◤','..#..','..#..','.....','..#..'],"'":['#','#','.','.','.','.','.']
};
export const CHARACTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:-!?'";
const arc=(cx,cy,a0,a1)=>Array.from({length:13},(_,i)=>{const a=a0+(a1-a0)*i/12;return [cx+Math.cos(a),cy+Math.sin(a)];}),PI=Math.PI;
const SHAPES={'#':[[0,0],[1,0],[1,1],[0,1]],'◢':[[1,0],[1,1],[0,1]],'◣':[[0,0],[1,1],[0,1]],'◤':[[0,0],[1,0],[0,1]],'◥':[[0,0],[1,0],[1,1]],
 '╭':[[1,1],...arc(1,1,PI,1.5*PI)],'╮':[[0,1],...arc(0,1,1.5*PI,2*PI)],'╰':[[1,0],...arc(1,0,.5*PI,PI)],'╯':[[0,0],...arc(0,0,0,.5*PI)],'▼':[[0,0],[1,0],[.5,1]],'▲':[[.5,0],[1,1],[0,1]]};
function sourcePolys(source,ch){
 if(source==='block'||source==='round'){const g=GLYPHS[ch],out=[];if(!g)return out;g.forEach((row,y)=>[...row].forEach((c,x)=>{if(SHAPES[c])out.push(SHAPES[c].map(([u,v])=>[(x+u)/7,(y+v)/7]));}));return out;}
 return (FONTS[source]?.glyphs[ch]??[]).map(f=>{const p=[];for(let i=0;i<f.length;i+=2)p.push([f[i]/1000,f[i+1]/1000]);return p;});}

// Clipper works on integers: cap units × 1e4 for glyphs, px × 100 on the poster.
const toC=(polys,u)=>polys.map(p=>p.map(([x,y])=>({X:Math.round(x*u),Y:Math.round(y*u)})));
const fromC=(paths,u)=>paths.filter(p=>p.length>2).map(p=>p.map(q=>[q.X/u,q.Y/u]));
function union(paths){const c=new CL.Clipper();c.AddPaths(paths,CL.PolyType.ptSubject,true);const out=new CL.Paths();c.Execute(CL.ClipType.ctUnion,out,CL.PolyFillType.pftNonZero,CL.PolyFillType.pftNonZero);return out;}
function offset(paths,delta,join,tol){if(!delta)return paths;const co=new CL.ClipperOffset(2.4,tol);co.AddPaths(paths,join,CL.EndType.etClosedPolygon);const out=new CL.Paths();co.Execute(out,delta);return out;}
export const bboxOf=polys=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of polys)for(const [x,y] of p){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return [x0,y0,x1,y1];};

// One glyph, condensed by `width` and offset by `weight` (cap units). Block
// and fonts keep mitred corners; round cells are opened first so every convex
// corner is eased, then grown with round joins.
const cache=new Map();
export function glyphShape(source,ch,width=1,weight=0){const key=[source,ch,width,weight].join('|');if(cache.has(key))return cache.get(key);
 const U=1e4,raw=sourcePolys(source,ch).map(p=>p.map(([x,y])=>[x*width,y]));let paths=union(toC(raw,U));
 if(source==='round'){const r=.034*U;paths=offset(offset(paths,-r,CL.JoinType.jtRound,8),r,CL.JoinType.jtRound,8);}
 paths=offset(paths,weight*U,source==='round'?CL.JoinType.jtRound:CL.JoinType.jtMiter,8);
 const polys=fromC(paths,U),out={polys,raw,bbox:polys.length?bboxOf(polys):[0,0,0,0]};if(cache.size>4000)cache.clear();cache.set(key,out);return out;}

// Poster-space operations (px): inner rims, outer rings and extruded shadows.
const PX=100;
export function offsetPx(polys,delta,round=true){return fromC(offset(union(toC(polys,PX)),delta*PX,round?CL.JoinType.jtRound:CL.JoinType.jtMiter,12),PX);}
export function extrudePx(polys,dx,dy){const quads=[];for(const p of polys)p.forEach((a,i)=>{const b=p[(i+1)%p.length];quads.push([a,b,[b[0]+dx,b[1]+dy],[a[0]+dx,a[1]+dy]]);});
 return fromC(union(toC([...polys,...polys.map(p=>p.map(([x,y])=>[x+dx,y+dy])),...quads],PX)),PX);}
export const polysD=(polys,n)=>polys.map(p=>'M'+p.map(([x,y])=>`${n(x)} ${n(y)}`).join('L')+'Z').join('');

// Text in cap units: glyphs placed by their outline boxes with a fixed gutter,
// so letters sit like tiles. Each row reports its width and nominal cap box.
export function layoutText(text,source,{width=1,weight=0,gutter=.1}){const rows=text.split('/').map(row=>{let x=0;const glyphs=[];
  for(const ch of row){if(ch===' '){x+=.34*width;continue;}const g=glyphShape(source,ch,width,weight);if(!g.polys.length)continue;const dx=x-g.bbox[0];
   glyphs.push({ch,polys:g.polys.map(p=>p.map(([u,v])=>[u+dx,v])),raw:g.raw.map(p=>p.map(([u,v])=>[u+dx,v])),bbox:[g.bbox[0]+dx,g.bbox[1],g.bbox[2]+dx,g.bbox[3]]});x+=g.bbox[2]-g.bbox[0]+gutter;}
  return {glyphs,width:Math.max(.01,glyphs.length?glyphs[glyphs.length-1].bbox[2]:0),top:-weight,bottom:1+weight};});
 return rows;}
