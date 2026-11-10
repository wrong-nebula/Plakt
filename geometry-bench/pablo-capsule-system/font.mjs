/* Freezes styles of the capsule type as versioned outline files, then builds each OTF,
 * its specimens and the family page from those files alone. Later changes to the live
 * system never alter a frozen version.
 *
 *   node font.mjs                           build every frozen style
 *   node font.mjs --freeze <style> <version>  freeze one style, e.g. --freeze compressed 1.0
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import paper from 'paper';
import opentype from 'opentype.js';
import {Resvg} from '@resvg/resvg-js';
import {GLYPHS,SOURCE,glyphGeometry,advanceOf,cutAdvance,resolve,setLines,specimen,SPECIMEN_TEXT} from './engine.mjs';
import {tubeGlyph,tubeSilhouette,TUBE,TUBE_CHARACTERS} from './tube.mjs';
import {sideWhite,opticalSidebearings} from './spacing.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../..');
const frozenDir=path.join(dir,'fonts'),out=path.join(root,'output/pablo-capsule-study-v1/font');
const UPM=1000,H=700;
// Line metrics per kind. Tube's accents and shadow reach above and below Capsule's.
const METRICS={capsule:{ascender:850,descender:-150},tube:{ascender:930,descender:-240}};
const r3=v=>Math.round(v*1000)/1000,sha=x=>crypto.createHash('sha256').update(x).digest('hex');
// Every style is a frozen construction of the same system.
export const STYLES={
 incised:{family:'PosterLab Capsule',style:'Incised',kind:'capsule',weightClass:800,params:{},note:'Solid parts with hairline seams: the default construction.'},
 compressed:{family:'PosterLab Capsule',style:'Compressed',kind:'capsule',cut:'compressed',weightClass:800,widthClass:3,params:{},note:'64% width; bowls become stadiums with round ends.'},
 split:{family:'PosterLab Capsule',style:'Split',kind:'capsule',weightClass:800,params:{bridge:0,seam:.05},note:'A stencil: seams open into gaps and closed seams lose their bridges.'},
 exploded:{family:'PosterLab Capsule',style:'Exploded',kind:'capsule',weightClass:800,params:{bridge:0,seam:.12},note:'The stencil with wide gaps; each letter falls into its parts.'},
 tube:{family:'PosterLab Capsule Tube',style:'Regular',kind:'tube',weightClass:400,note:'The poster’s outline lettering: an outlined two-lane track.'},
 'tube-shadow':{family:'PosterLab Capsule Tube',style:'Shadow',kind:'tube',weightClass:400,mode:'shadow',note:'The track with its extruded shadow, in one colour.'},
 'tube-fill':{family:'PosterLab Capsule Tube',style:'Fill',kind:'tube',weightClass:800,mode:'fill',note:'The solid tube silhouette: set it under Tube or Tube Shadow of the same version, in a second colour, for filled tubes.'}
};
const NAMES={'0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine','.':'period',',':'comma',':':'colon',';':'semicolon','!':'exclam','?':'question',"'":'quotesingle','"':'quotedbl','-':'hyphen','–':'endash','—':'emdash','/':'slash','(':'parenleft',')':'parenright','[':'bracketleft',']':'bracketright','&':'ampersand','+':'plus','=':'equal','%':'percent','#':'numbersign','*':'asterisk',' ':'space',
 'ä':'adieresis','ö':'odieresis','ü':'udieresis','ë':'edieresis','é':'eacute','è':'egrave','ê':'ecircumflex','à':'agrave','â':'acircumflex','ô':'ocircumflex','û':'ucircumflex','ç':'ccedilla',
 '«':'guillemotleft','»':'guillemotright','×':'multiply','·':'periodcentered','…':'ellipsis','→':'arrowright','←':'arrowleft','€':'Euro','$':'dollar','°':'degree','@':'at'};
// Glyph names must be ASCII; anything unnamed gets its standard uniXXXX name.
const nameOf=ch=>NAMES[ch]??(/^[A-Za-z]$/.test(ch)?ch:'uni'+ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0'));
// Unicase: capitals share the lowercase forms. Capsule keeps separate capital B and D forms.
const EXTRA={"'":[0x2018,0x2019],'"':[0x201C,0x201D],',':[0x201A],'-':[0x2010,0x2011],' ':[0xA0]};
function unicodesOf(ch,{capitalBD=true}={}){
 if(ch==='B'||ch==='D')return [ch.charCodeAt(0)];
 const upper=ch.toUpperCase();
 if(upper!==ch&&upper.length===1&&!(capitalBD&&(ch==='b'||ch==='d')))return [ch.charCodeAt(0),upper.charCodeAt(0)];
 return [ch.charCodeAt(0),...(EXTRA[ch]??[])];
}
const STYLE_OF_FILE=file=>path.basename(file).replace(/^capsule-|-[\d.]+\.json$/g,'');

// Seams are strokes on screen; a font needs them as closed outlines (butt caps, miter joins).
function strokePolygon(pts,width){
 const h=width/2,left=[],right=[],dir=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [dx/l,dy/l];};
 pts.forEach((p,i)=>{
  const a=pts[i-1],b=pts[i+1];let nx,ny,len=h;
  if(!a||!b){const [dx,dy]=b?dir(p,b):dir(a,p);nx=-dy;ny=dx;}
  else{const [d1x,d1y]=dir(a,p),[d2x,d2y]=dir(p,b),mx=-d1y-d2y,my=d1x+d2x,ml=Math.hypot(mx,my);
   if(ml<1e-9){nx=-d1y;ny=d1x;}else{nx=mx/ml;ny=my/ml;len=h/Math.max(nx*-d1y+ny*d1x,.25);}}
  left.push([p[0]+nx*len,p[1]+ny*len]);right.push([p[0]-nx*len,p[1]-ny*len]);
 });
 return [...left,...right.reverse()];
}
const polygonItem=points=>new paper.Path({segments:points,closed:true,insert:false});
// Stencil cuts can isolate fragments too small to print or cut out; those are dropped.
const CRUMB=3000;
// The solid silhouette (parts only, before any seam) as point lists, for spacing.
function silhouette(ch,params,cut){
 const gl=advanceOf(ch)*cutAdvance(ch,cut)*H,geo=glyphGeometry(ch,params,gl,H,cut);
 if(!geo.parts.length)return null;
 let body=null;for(const p of geo.parts){const item=new paper.CompoundPath({pathData:p.d,insert:false});body=body?body.unite(item,{insert:false}):item;}
 body.flatten(1.5);
 return {width:gl,polys:(body.className==='CompoundPath'?body.children:[body]).map(p=>p.segments.map(s=>[s.point.x,s.point.y]))};
}
// Letters and figures are spaced by their measured side white; accented letters take their
// base letter's sidebearings, and punctuation keeps the plain half-gap on each side.
const SPACED=/^[a-z0-9BD]$/;
export function sidebearings(id){
 const style=STYLES[id],tube=style.kind==='tube',params=resolve({params:style.params}).params,cut=style.cut??'regular';
 const chars=tube?TUBE_CHARACTERS:Object.keys(GLYPHS),white=new Map();
 paper.setup(new paper.Size(1,1));
 for(const ch of chars.filter(c=>SPACED.test(c))){
  const s=tube?tubeSilhouette(ch):silhouette(ch,params,cut);
  if(s?.polys.length)white.set(ch,sideWhite(s.polys,s.width,H,tube?80:70));
 }
 const sb=opticalSidebearings(white,{base:tube?TUBE.spacing/2:params.tracking*H/2});
 for(const ch of chars){const base=ch.normalize('NFD')[0];if(base!==ch&&sb.has(base))sb.set(ch,sb.get(base));}
 return sb;
}
// Exact outline of one capsule glyph: the union of its parts minus its seams and aperture notches.
function outline(ch,params,cut='regular',sb=null){
 const gl=advanceOf(ch)*cutAdvance(ch,cut)*H,geo=glyphGeometry(ch,params,gl,H,cut),gap=params.tracking*H,lsb=sb?.lsb??gap/2;
 const glyph={character:ch,name:nameOf(ch),unicodes:unicodesOf(ch),advanceWidth:r3(sb?sb.lsb+gl+sb.rsb:gl+gap),lsb:r3(lsb),path:''};
 if(!geo.parts.length)return glyph;
 let body=null;for(const p of geo.parts){const item=new paper.CompoundPath({pathData:p.d,insert:false});body=body?body.unite(item,{insert:false}):item;}
 const cuts=[...geo.seams.map(s=>strokePolygon(s.flat,params.seam*H)),...geo.notches];
 for(const c of cuts)body=body.subtract(polygonItem(c),{insert:false});
 if(body.className==='CompoundPath'){
  const kids=[...body.children],outer=kids.reduce((a,b)=>Math.abs(b.area)>Math.abs(a.area)?b:a).clockwise;
  for(const k of kids)if(k.clockwise===outer&&Math.abs(k.area)<CRUMB)k.remove();
 }
 // Font coordinates: y up from the baseline, shifted right by the left sidebearing.
 const X=x=>r3(x+lsb),Y=y=>r3(H-y),cmds=[];
 for(const p of body.className==='CompoundPath'?body.children:[body]){
  if(!p.segments.length)continue;cmds.push(`M${X(p.firstSegment.point.x)} ${Y(p.firstSegment.point.y)}`);
  for(const c of p.curves){const a=c.point1.add(c.handle1),b=c.point2.add(c.handle2);cmds.push(c.hasHandles()?`C${X(a.x)} ${Y(a.y)} ${X(b.x)} ${Y(b.y)} ${X(c.point2.x)} ${Y(c.point2.y)}`:`L${X(c.point2.x)} ${Y(c.point2.y)}`);}
  cmds.push('Z');
 }
 glyph.path=cmds.join('');return glyph;
}
// The frozen data for one style as the live system draws it now.
export function frozenData(id,version){
 const style=STYLES[id];if(!style)throw new Error(`Unknown style ${id}. Styles: ${Object.keys(STYLES).join(', ')}`);
 const sb=sidebearings(id),params=resolve({params:style.params}).params,cut=style.cut??'regular';
 const glyphs=style.kind==='tube'
  ?TUBE_CHARACTERS.map(ch=>{const g=tubeGlyph(ch,{mode:style.mode??'regular',...sb.get(ch)});return {character:ch,name:nameOf(ch),unicodes:unicodesOf(ch,{capitalBD:false}),advanceWidth:g.w,lsb:g.lsb??TUBE.spacing/2,path:g.path};})
  :Object.keys(GLYPHS).map(ch=>outline(ch,params,cut,sb.get(ch)));
 return {format:'posterlab-capsule-frozen-font',version,styleId:id,family:style.family,style:style.style,kind:style.kind,cut,frozenOn:new Date().toISOString().slice(0,10),engine:'pablo-capsule-v2',
  note:`Exact outlines, built once from the live system. The OTF and specimens are built from this file only. ${style.note}`,
  credit:`Type system interpreted from a poster credited to ${SOURCE.credit}. Not the designer's original typeface.`,
  unitsPerEm:UPM,glyphHeight:H,...METRICS[style.kind],spacing:'optical',
  fontInfo:{weightClass:style.weightClass,widthClass:style.widthClass??5,useTypoMetrics:true,styleLinking:true},
  construction:style.kind==='tube'?{tube:'see tube.mjs TUBE'}:Object.fromEntries(['seam','bridge','stem','square','aperture','tracking'].map(k=>[k,params[k]])),
  glyphs};
}
function freeze(id,version){
 const file=path.join(frozenDir,`capsule-${id}-${version}.json`);
 if(fs.existsSync(file))throw new Error(`${path.relative(root,file)} already exists. A frozen version is never overwritten; choose a new version number.`);
 const data=frozenData(id,version);
 fs.mkdirSync(frozenDir,{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,1));
 console.log(`Froze ${data.glyphs.length} glyphs as ${path.relative(root,file)}`);
}
function parseCommands(d){return [...d.matchAll(/([MLCZ])([^MLCZ]*)/g)].map(([,cmd,args])=>[cmd,...(args.match(/-?\d*\.?\d+/g)??[]).map(Number)]);}
export function buildFont(frozen,widthClass=5){
 const notdef=new opentype.Path();notdef.moveTo(50,0);notdef.lineTo(50,H);notdef.lineTo(450,H);notdef.lineTo(450,0);notdef.close();notdef.moveTo(100,50);notdef.lineTo(400,50);notdef.lineTo(400,H-50);notdef.lineTo(100,H-50);notdef.close();
 const glyphs=[new opentype.Glyph({name:'.notdef',advanceWidth:500,path:notdef})];
 for(const g of frozen.glyphs){
  const p=new opentype.Path(),R=Math.round;
  for(const [cmd,...v] of parseCommands(g.path)){if(cmd==='M')p.moveTo(R(v[0]),R(v[1]));else if(cmd==='L')p.lineTo(R(v[0]),R(v[1]));else if(cmd==='C')p.curveTo(R(v[0]),R(v[1]),R(v[2]),R(v[3]),R(v[4]),R(v[5]));else p.close();}
  glyphs.push(new opentype.Glyph({name:g.name,unicodes:g.unicodes,advanceWidth:Math.round(g.advanceWidth),path:p}));
 }
 const info=frozen.fontInfo,common={unitsPerEm:frozen.unitsPerEm,ascender:frozen.ascender,descender:frozen.descender,version:`Version ${frozen.version}`,designer:'PosterLab (AI-assisted)',description:frozen.credit,glyphs};
 // Files frozen before fontInfo existed build exactly as they always have.
 if(!info)return new opentype.Font({...common,familyName:frozen.family,styleName:frozen.style,widthClass});
 // Style linking: each style is its own Regular for older apps (name IDs 1/2) and a named
 // style of the family for newer ones (16/17). Typo metrics set the line; win metrics cover every outline.
 const full=`${frozen.family} ${frozen.style}`,linked=frozen.style==='Regular'?frozen.family:full;
 const font=new opentype.Font({...common,familyName:linked,styleName:'Regular',fullName:full,postScriptName:`${frozen.family.replace(/ /g,'')}-${frozen.style}`,manufacturer:'PosterLab',
  weightClass:info.weightClass,widthClass:info.widthClass,fsSelection:64|(info.useTypoMetrics?128:0),createdTimestamp:Math.round(Date.parse(frozen.frozenOn)/1000)});
 for(const p of ['unicode','macintosh','windows'])Object.assign(font.names[p],{preferredFamily:{en:frozen.family},preferredSubfamily:{en:frozen.style},uniqueID:{en:`PosterLab: ${full}: ${frozen.version}`}});
 let top=0,bottom=0;
 for(const g of frozen.glyphs)for(const [,...v] of parseCommands(g.path))for(let i=1;i<v.length;i+=2){top=Math.max(top,v[i]);bottom=Math.min(bottom,v[i]);}
 Object.assign(font.tables.os2,{version:4,sTypoLineGap:0,usWinAscent:Math.max(frozen.ascender,Math.ceil(top)),usWinDescent:Math.max(-frozen.descender,Math.ceil(-bottom))});
 return font;
}
// Set text with the frozen outlines, exactly where the live specimen places its glyphs.
function frozenSpecimen(frozen,text,colors=['#f5f7f8','#111419']){
 const byChar=new Map(frozen.glyphs.map(g=>[g.character,g])),gap=frozen.construction.tracking*frozen.glyphHeight;
 const state=resolve({text,layout:'rows',fit:'even',cut:frozen.cut,params:{tracking:frozen.construction.tracking,width:1,leading:.3}}),rows=state.text.split(/(?<!\\)\//).length;
 const page={width:1100,height:250+(rows-2)*120,margin:18};let s=`<rect width="${page.width}" height="${page.height}" fill="${colors[0]}"/>`;
 for(const line of setLines(state,page))for(const g of line.glyphs){
  const glyph=byChar.get(g.ch)??byChar.get(g.ch.toLowerCase()),k=g.em/frozen.glyphHeight,[x,y]=g.box;
  if(glyph?.path)s+=`<path transform="translate(${x-(glyph.lsb??gap/2)*k} ${y+g.em}) scale(${k} ${-k})" d="${glyph.path}" fill="${colors[1]}"/>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">${s}</svg>`;
}
function inkDifference(a,b,width=2200){
 const ra=new Resvg(a,{fitTo:{mode:'width',value:width}}).render(),rb=new Resvg(b,{fitTo:{mode:'width',value:width}}).render(),pa=ra.pixels,pb=rb.pixels;
 let ink=0,diff=0;for(let i=0;i<pa.length;i+=4){const la=pa[i+1],lb=pb[i+1];if(la<128||lb<128)ink++;if(Math.abs(la-lb)>96)diff++;}
 return {differingPixels:diff,inkPixels:ink,fraction:diff/ink};
}
export function textSample(font,lines,size=150,colors=['#f5f7f8','#111419']){
 const lead=size*(font.ascender-font.descender)/UPM,width=Math.ceil(Math.max(...lines.map(l=>font.getAdvanceWidth(l,size))))+80,height=Math.ceil(lead*lines.length)+60;
 // opentype.js 2.0's toPathData prints some coordinates as NaN, so format the commands here.
 const f=v=>Math.round(v*100)/100,d=lines.map((l,i)=>font.getPath(l,40,30+size*font.ascender/UPM+i*lead,size).commands.map(c=>c.type==='Z'?'Z':c.type==='C'?`C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`:c.type==='Q'?`Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`:`${c.type}${f(c.x)} ${f(c.y)}`).join('')).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${colors[0]}"/><path d="${d}" fill="${colors[1]}"/></svg>`;
}
export const otfName=frozen=>`${frozen.family.replace(/ /g,'')}-${frozen.style}-${frozen.version}.otf`;
// Incised 1.0 was frozen before accents existed; its samples avoid them rather than show empty boxes.
const hasAccents=frozen=>frozen.glyphs.some(g=>g.character==='ü'),hasSymbols=frozen=>frozen.glyphs.some(g=>g.character==='«'),hasASCII=frozen=>frozen.glyphs.some(g=>g.character==='~');
const accentLine=frozen=>hasAccents(frozen)?'Zürich — Genève — Garçon':'Eintritt: 15.-/25.-';
function build(file){
 const frozen=JSON.parse(fs.readFileSync(file,'utf8')),id=frozen.styleId??STYLE_OF_FILE(file),style=STYLES[id];
 // Version 1.0 of Incised predates these fields.
 frozen.cut??='regular';frozen.kind??='capsule';fs.mkdirSync(out,{recursive:true});
 const font=buildFont(frozen,style?.widthClass),otf=Buffer.from(font.toArrayBuffer()),name=otfName(frozen);fs.writeFileSync(path.join(out,name),otf);
 fs.copyFileSync(file,path.join(out,path.basename(file)));
 const parsed=opentype.parse(otf.buffer.slice(otf.byteOffset,otf.byteOffset+otf.byteLength));
 const png=(svg,file,w=2200)=>fs.writeFileSync(path.join(out,file),new Resvg(svg,{fitTo:{mode:'width',value:w}}).render().asPng());
 const record={style:id,version:frozen.version,frozenFile:path.relative(root,file),frozenSHA256:sha(fs.readFileSync(file)),otf:name,otfSHA256:sha(otf),glyphs:parsed.glyphs.length};
 if(frozen.kind==='capsule'){
  const letters=frozenSpecimen(frozen,SPECIMEN_TEXT.letters),figures=frozenSpecimen(frozen,SPECIMEN_TEXT.figures),live={cut:frozen.cut,params:frozen.construction};
  fs.writeFileSync(path.join(out,`${id}-letters.svg`),letters);png(letters,`${id}-letters.png`);
  fs.writeFileSync(path.join(out,`${id}-figures.svg`),figures);png(figures,`${id}-figures.png`);
  record.liveAtBuild={letters:inkDifference(specimen(live),letters),figures:inkDifference(specimen(live,SPECIMEN_TEXT.figures),figures)};
  if(hasSymbols(frozen)){const symbols=frozenSpecimen(frozen,SPECIMEN_TEXT.symbols+(hasASCII(frozen)?'/'+SPECIMEN_TEXT.ascii:''));fs.writeFileSync(path.join(out,`${id}-symbols.svg`),symbols);png(symbols,`${id}-symbols.png`);}
 }else{
  png(textSample(parsed,['abcdefghijklm','nopqrstuvwxyz']),`${id}-letters.png`);
  png(textSample(parsed,['0123456789 &!?','.,:;\'"-–—/()[]+=%#*']),`${id}-figures.png`);
  if(hasSymbols(frozen))png(textSample(parsed,['«»×·…→←°','äöüéèàç',...(hasASCII(frozen)?['$€@'+SPECIMEN_TEXT.ascii]:[])]),`${id}-symbols.png`);
 }
 // Typed through the OTF itself: unicase capitals, figures, punctuation and, where the style has them, accents.
 png(textSample(parsed,['Pablo Nouvelle & Band','Neubad Luzern','2.12.2022 — 21:00',accentLine(frozen)]),`${id}-sample.png`,2400);
 fs.writeFileSync(path.join(out,`build-${id}-${frozen.version}.json`),JSON.stringify(record,null,2));
 const live=record.liveAtBuild?` Frozen vs live: letters ${record.liveAtBuild.letters.differingPixels}, figures ${record.liveAtBuild.figures.differingPixels} differing pixels.`:'';
 console.log(`Built ${name} (${parsed.glyphs.length} glyphs).${live}`);
 return {id,frozen,record,style};
}
const newer=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<Math.max(x.length,y.length);i++)if((x[i]??0)!==(y[i]??0))return (x[i]??0)>(y[i]??0);return false;};
// A specimen page for the family, using the built OTFs through @font-face. Each style
// shows its latest version; earlier frozen versions stay downloadable.
function familyPage(all){
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const built=[],earlier=new Map();
 for(const b of all){const i=built.findIndex(x=>x.id===b.id);if(i<0){built.push(b);continue;}
  const [keep,old]=newer(b.frozen.version,built[i].frozen.version)?[b,built[i]]:[built[i],b];built[i]=keep;earlier.set(b.id,[...(earlier.get(b.id)??[]),old]);}
 const faces=built.map(b=>`@font-face{font-family:"${b.id}";src:url("${b.record.otf}") format("opentype");font-display:block}`).join('');
 const also=b=>(earlier.get(b.id)??[]).map(o=>` Earlier: <a href="${o.record.otf}" download>${esc(o.frozen.version)}</a> (${o.record.glyphs-1} glyphs).`).join('');
 // Fill sits under Tube or Tube Shadow of the same version; show the pair stacked in two colours.
 const stack=b=>{const on=built.filter(o=>o.id!==b.id&&o.frozen.kind==='tube'&&o.frozen.version===b.frozen.version);if(b.id!=='tube-fill'||!on.length)return '';
  return `<div class="stacks">${on.map(o=>`<div class="stack"><span style="font-family:'${b.id}';color:#ff3d7f">Neubad</span><span style="font-family:'${o.id}';color:#ceff00">Neubad</span></div>`).join('')}</div>`;};
 const sections=built.map(b=>`<section><header><h2>${esc(b.frozen.family)} <span>${esc(b.frozen.style)}</span></h2><a href="${b.record.otf}" download>Download OTF</a></header><p class="note">${esc(b.style?.note??'')} Version ${esc(b.frozen.version)}, ${b.record.glyphs-1} glyphs.${also(b)}</p>
 <div class="big" style="font-family:'${b.id}'" contenteditable spellcheck="false">Pablo Nouvelle</div>
 <div class="set" style="font-family:'${b.id}'">abcdefghijklm<br>nopqrstuvwxyz<br>0123456789 &amp;!?<br>${hasAccents(b.frozen)?'äöüéèàçâêôû':'15.-/25.-'} — 2.12 — 21:00${hasSymbols(b.frozen)?'<br>«A × B» · 23:00 → 06:00 …':''}${hasASCII(b.frozen)?'<br>'+esc('$€@ <a|b> {x_y} ~^`\\'):''}</div>${stack(b)}</section>`).join('');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PosterLab Capsule — fonts</title><style>${faces}
*{box-sizing:border-box}body{margin:0;background:#0b0b0f;color:#e9eaf0;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
main{max-width:1200px;margin:auto;padding:32px 20px 60px}h1{font-size:28px;letter-spacing:-.5px;margin:0 0 6px}main>p{color:#9aa0ae;margin:0 0 28px;max-width:720px}
section{border-top:1px solid #2a2b35;padding:26px 0 30px}section header{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}h2{font-size:15px;margin:0;font-weight:600}h2 span{color:#ceff00}
a{color:#ceff00;font-size:13px}.note{color:#9aa0ae;font-size:13px;margin:4px 0 14px}.big{font-size:clamp(56px,13vw,170px);line-height:1.04;outline:none;word-break:break-word}.set{font-size:clamp(26px,5vw,52px);line-height:1.2;margin-top:18px;color:#bcc0cc}
.stacks{display:flex;flex-wrap:wrap;gap:8px 40px;margin-top:22px}.stack{display:grid;font-size:clamp(48px,10vw,120px);line-height:1.1}.stack span{grid-area:1/1}
footer{color:#6b7080;font-size:12px;margin-top:30px}</style>
<main><h1>PosterLab Capsule</h1><p>Seven frozen styles of one type system, after a poster credited to Enea Bortone: Incised, Compressed, Split, Exploded, and the poster's outline lettering as Tube, Tube Shadow and Tube Fill. Type in the large lines to try them. Capitals use the lowercase forms; Capsule keeps capital B and D. Letters and figures are spaced optically by their side white, and Tube, Tube Shadow and Tube Fill of one version share every advance, so they stack.</p>${sections}
<footer>Built from the frozen outline files in geometry-bench/pablo-capsule-system/fonts. Not the designer's original typeface. Made with AI assistance.</footer></main></html>`;
}
export function buildFrozenFonts(){
 const files=fs.existsSync(frozenDir)?fs.readdirSync(frozenDir).filter(f=>/^capsule-.+-[\d.]+\.json$/.test(f)):[];
 if(!files.length)throw new Error('No frozen style yet. Run: node font.mjs --freeze incised 1.0');
 const order=Object.keys(STYLES),built=files.map(f=>build(path.join(frozenDir,f))).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)||(newer(a.frozen.version,b.frozen.version)?1:-1));
 fs.writeFileSync(path.join(out,'index.html'),familyPage(built));
 return built;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const i=process.argv.indexOf('--freeze');if(i>0)freeze(process.argv[i+1],process.argv[i+2]??'1.0');
 buildFrozenFonts();
}
