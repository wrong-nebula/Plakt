import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { Path as Pave } from '@baku89/pave';
import paper from 'paper-latest';
import Commander from 'svg-path-commander';
import { svgPathProperties } from 'svg-path-properties';
import * as PathBool from 'path-bool';
import Clipper from 'clipper-lib';
import svgpath from 'svgpath';
import { Bezier } from 'bezier-js';
import {compile,morph} from 'svg-path-morph';
import * as Flo from 'flo-mat';
import JSPath from 'js-svg-path';
import OpenType from 'opentype.js';
import * as Fontkit from 'fontkit';
import Hershey from 'hersheytext';
import Session from 'svg-text-to-path';
import * as PaperClipper from 'paper-clipper';

export const fontPath='/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const bytes=await readFile(fontPath);
export const font=OpenType.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const kit=Fontkit.create(bytes);
paper.setup(new paper.Size(1000,1414));
const raw=(text)=>font.getPath(text,0,0,100).toPathData(5);
export function closeContours(d) {
 const out=[];
 for(const command of Commander.pathToAbsolute(d)) {
   if(command[0]==='M' && out.length && out.at(-1)[0]!=='Z')out.push(['Z']);
   out.push(command);
 }
 if(out.length && out.at(-1)[0]!=='Z')out.push(['Z']);
 return Commander.pathToString(out);
}
export const glyphD=closeContours(raw('C'));
export const textPath=(s)=>raw(s);
export function fit(d,x,y,w,h) {
 const b=Commander.getPathBBox(d); if (!b.width || !b.height) return '';
 return `<g transform="translate(${x} ${y}) scale(${w/b.width} ${h/b.height}) translate(${-b.x} ${-b.y})"><path d="${d}"/></g>`;
}
const wave=(p)=>`M0 100 C${80+p.warp*100} ${-p.warp*180} ${180+p.warp*80} ${260+p.warp*180} 360 100`;
const pointLine=(pts)=>pts.map((p,i)=>`${i?'L':'M'}${p.x??p[0]} ${p.y??p[1]}`).join(' ');
const transform=(d,p)=>svgpath(d).scale(p.stretch,1).rotate(p.tilt).toString();
const normalizedGlyph=(()=>{const b=Commander.getPathBBox(glyphD);return svgpath(glyphD).translate(-b.x,-b.y).scale(300/b.width,300/b.height).toString()})();
const adapters=[];
function add(name,role,pros,cons,make) {adapters.push({name,role,pros,cons,make});}
add('@baku89/pave','curve offset + nonlinear glyph warp','Immutable plain-object paths; native booleans and offsets; preserved circular arcs.','Pave 1.0.1 declares an optional Paper ^0.12.4 peer that conflicts with Paper 0.17.0; use isolated compatibility version.',p=>{
 const original=Pave.fromD(normalizedGlyph);const before=JSON.stringify(original);
 const warped=Pave.distort(original,([x,y])=>[x+Math.sin(y/300*Math.PI*2)*p.warp*55,y]);
 const offset=Pave.offset(warped,p.offset);
 if(JSON.stringify(original)!==before)throw Error('Input mutated');
 return {d:Pave.toD(offset),fill:true};
});
add('paper','curve booleans','Full geometry model, scene graph, mature path booleans; current release works without a Canvas for geometry.','Mutable project/scene state requires cleanup; Paper does not share Pave\'s immutable data contract.',p=>{
 const a=new paper.CompoundPath(normalizedGlyph), b=new paper.Path.Rectangle(new paper.Rectangle(100+p.warp*80,-20,24+p.offset*2,360));
 const out=a.subtract(b);out.scale(p.stretch,1);out.rotate(p.tilt);
 const d=out.pathData; a.remove();b.remove();out.remove();return {d,fill:true};
});
add('svg-path-commander','path transform','Complete path normalization, bounding boxes and 2D/3D transforms; current package imports in Node.','Focused path processor; does not provide the tested boolean/offset workflow.',p=>({d:new Commander(normalizedGlyph).transform({skew:[p.tilt,0],scale:[p.stretch,1],origin:[150,150]}).toString(),fill:true}));
add('svg-path-properties','arc-length sampling','Small no-dependency point/length/tangent API; good for repeat-along curves in Node.','Sampling only; glyph construction and booleans need another library.',p=>{
 const properties=new svgPathProperties(wave(p));const n=36+Math.round(p.repetition*30),len=properties.getTotalLength();
 return {d:pointLine(Array.from({length:n},(_,i)=>properties.getPointAtLength(i/(n-1)*len))),fill:false};
});
add('path-bool','curve booleans','Focused path booleans; arrangement can be reused for several operations; direct SVG-string input.','Explicit fill rules and arrays of result paths; topology needs dedicated fixtures rather than aesthetic judging.',p=>{
 const a=PathBool.pathFromPathData(normalizedGlyph),b=PathBool.pathFromPathData(`M${100+p.warp*80} -20h${24+p.offset*2}v360h-${24+p.offset*2}z`);
 const arrangement=new PathBool.PathBoolean([{path:a,fillRule:PathBool.FillRule.NonZero},{path:b,fillRule:PathBool.FillRule.NonZero}]);
 return {d:arrangement.get(PathBool.PathBooleanOperation.Difference).map(PathBool.pathToPathData).join(' '),fill:true};
});
function polygon(d,count=160) {
 // Flatten each contour independently; joining all contours would destroy glyph counters.
 return Commander.pathToAbsolute(d).reduce((a,c)=>{if(c[0]==='M')a.push([]);a.at(-1)?.push(c);return a},[]).map(commands=>{
 const properties=new svgPathProperties(Commander.pathToString(commands));const len=properties.getTotalLength();
 return Array.from({length:count},(_,i)=>{const pt=properties.getPointAtLength(i/count*len);return {X:Math.round(pt.x*100),Y:Math.round(pt.y*100)}});
 });
}
const poly=polygon(normalizedGlyph);
const polygonsD=(paths)=>paths.map(points=>points.map((p,i)=>`${i?'L':'M'}${p.X/100} ${p.Y/100}`).join(' ')+'Z').join(' ');
add('clipper-lib','polygon offset','Robust integer polygon booleans/offsets; explicit scaling provides numerical control.','Curves must be flattened first; sampled corners and contours can change. Precision and join settings matter.',p=>{
 const offset=new Clipper.ClipperOffset(2,0.25*100);offset.AddPaths(poly,Clipper.JoinType.jtRound,Clipper.EndType.etClosedPolygon);
 const out=new Clipper.Paths();offset.Execute(out,p.offset*100);return {d:polygonsD(out),fill:true};
});
let nativeClipper;
add('paper-clipper','flatten + polygon offset','Convenient Paper bridge to native/Wasm Clipper offsets; simplifies outlines afterward.','Asynchronous initialization, old Paper peer and polygon flattening; requires a second Paper scope.',async p=>{
 nativeClipper??=await PaperClipper.clipperLib.loadNativeClipperLibInstanceAsync(PaperClipper.clipperLib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback);
 const legacy=(await import('paper')).default;legacy.setup(new legacy.Size(400,400));
 const a=new legacy.Path(normalizedGlyph);a.strokeJoin='round';a.strokeCap='round';const results=await PaperClipper.clipperOffset(nativeClipper)(a,{offset:p.offset,tolerance:0.25});
 const paths=Array.isArray(results)?results:[results];const d=paths.map(x=>x.pathData).join(' '); a.remove();paths.forEach(x=>x.remove());return {d,fill:true};
});
add('svgpath','path transform','Compact transform chain; stable SVG serialization; easy Node integration.','No glyph shaping, offset or boolean engine; combine with a font and geometry library.',p=>({d:transform(normalizedGlyph,p),fill:true}));
add('bezier-js','curve offset','Direct Bézier derivative, length, normals and offset curves; useful for ribbons.','Individual curves, not an SVG boolean or text-layout toolkit; offsets may split into multiple curves.',p=>{
 const curve=new Bezier(0,100,80+p.warp*100,-p.warp*180,180+p.warp*80,260+p.warp*180,360,100);
 const curves=curve.offset(p.offset);return {d:curves.map(c=>c.toSVG()).join(' '),fill:false};
});
add('svg-path-morph','same-topology interpolation','Small interpolation API; useful for evolving control points with matched topology.','Requires matching command structure; not a general correspondence or boolean solver.',p=>{
 const target=Commander.pathToString(Commander.pathToAbsolute(normalizedGlyph).map(c=>c.map((v,i)=>i&&typeof v==='number'?v+(i%2?Math.sin(v/60)*40:0):v)));
 return {d:morph(compile([normalizedGlyph,target]),[1-p.warp,p.warp]),fill:true};
});
add('flo-mat','medial-axis skeleton','Specialist skeleton/scale-axis geometry for glyph interiors; enables results unavailable from simple transforms.','Heavier computation and specialized topology; skeleton outputs need strokes and can fragment thin features.',p=>{
 if(!Map.prototype.getOrInsert) Object.defineProperty(Map.prototype,'getOrInsert',{configurable:true,value:function(key,value){if(!this.has(key))this.set(key,value);return this.get(key)}});
 const mats=Flo.findMats(Flo.getPathsFromStr(normalizedGlyph),{applySat:true,satScale:1+p.warp});
 const paths=[];for(const mat of mats)Flo.traverseEdges(mat.cpNode,node=>{for(const curve of Flo.getMatCurveToNext(node))paths.push(Flo.beziersToSvgPathStr([curve]));});
 return {d:paths.join(' '),fill:false};
});
add('js-svg-path','editable point graph','Convenient anchor/handle objects and SVG roundtrip; useful for custom warp code.','Older parser and limited high-level operations; test each command type rather than assuming full SVG support.',p=>{
 const outline=JSPath.parse(svgpath(normalizedGlyph).abs().unshort().toString());
 for(const shape of outline.getShapes())for(const point of shape.points)for(const key of ['main','left','right']){
   const pt=point[key];if(pt){pt.x+=Math.sin(pt.y/300*Math.PI*2)*p.warp*45;pt.x*=p.stretch;}
 }
 return {d:outline.toSVG(),fill:true};
});
add('opentype.js','font outlines','Simple font-to-path API, kerning and font inspection; no browser required.','Outline conversion alone is not a complete complex-script shaping benchmark; this test covers Latin and ligature fixtures.',p=>({d:transform(font.getPath('VC',0,0,100,{kerning:true}).toPathData(5),p),fill:true}));
add('fontkit','shaped font outlines','Layout returns shaped glyph runs and positioning; broad font parsing support; works in Node.','More dependencies; outline coordinates and glyph positions need explicit composition.',p=>{
 const run=kit.layout('VC');let x=0,d='';for(let i=0;i<run.glyphs.length;i++){const pos=run.positions[i];d+=svgpath(run.glyphs[i].path.toSVG()).translate(x+pos.xOffset,pos.yOffset).toString();x+=pos.xAdvance;}
 return {d:transform(svgpath(d).scale(1,-1).toString(),p),fill:true};
});
let typr;
add('typr.js','font outlines (browser wrapper)','Lightweight outline access; original font data can be consumed without a scene graph.','Installed npm wrapper is deprecated and touches window in Node; benchmark isolates a minimal VM window shim.',async p=>{
 if(!typr){const source=await readFile(new URL('./node_modules/typr.js/index.js',import.meta.url),'utf8');const scope={window:{},module:{exports:{}},console,Uint8Array,Uint16Array,Uint32Array,Int16Array,Int32Array,DataView,ArrayBuffer,TextDecoder};vm.runInNewContext(source,scope);typr=scope.module.exports;}
 let f=typr.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));if(Array.isArray(f))f=f[0];
 const d=typr.U.pathToSVG(typr.U.glyphsToPath(f,typr.U.stringToGlyphs(f,'VC')));
 return {d:transform(svgpath(d).scale(1,-1).toString(),p),fill:true};
});
add('svg-text-to-path','existing SVG text conversion','Replaces SVG text/tspan with outlines; local font configuration; handles layout attributes.','Larger conversion stack; use local providers explicitly to avoid hidden font-network dependencies.',async p=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg"><text x="0" y="100" font-family="Bench" font-size="100">VC</text></svg>';
 const session=new Session(svg,{fonts:{Bench:[{source:fontPath}]},providers:[new Session.providers.ConfigProvider({Bench:[{source:fontPath}]})],noFontAction:'error'});
 await session.replaceAll();const result=session.getSvgString();const ds=[...result.matchAll(/\sd="([^"]+)"/g)].map(m=>m[1]);session.destroy();
 if(!ds.length)throw Error('No outline paths produced');return {d:transform(ds.join(' '),p),fill:true};
});
add('hersheytext','single-stroke lettering','Single-line engraving fonts with path data; useful for plotters and light typographic layers.','Single-stroke forms differ from the heavy poster reference; font assets use a separate data provenance.',p=>{
 const chars=Hershey.renderTextArray('VC',{font:'futural'});let x=0,d='';for(const c of chars){d+=svgpath(c.d||'M0 0').translate(x,0).toString();x+=c.width;}
 return {d:transform(d,p),fill:false};
});
add('pathomorph','primitives + connectors','Convenient geometric primitive, connector and fillet constructors; compact API.','Published 0.0.5 imports undeclared vector2 rather than its declared @rawify/vector2; benchmark uses an explicit npm alias.',async p=>{
 const {default:Pathomorph}=await import('pathomorph');
 return {d:Pathomorph.RingSegment({x:150,y:150},130,25+p.offset,0.2,Math.PI*(1.2+p.warp)),fill:true};
});
export {adapters,normalizedGlyph,wave};
