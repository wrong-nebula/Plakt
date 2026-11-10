import {Path as Pave} from '@baku89/pave';
import paper from 'paper-latest';
import Commander from 'svg-path-commander';
import {svgPathProperties} from 'svg-path-properties';
import * as PathBool from 'path-bool';
import Clipper from 'clipper-lib';
import svgpath from 'svgpath';
import {Bezier} from 'bezier-js';
import {compile,morph} from 'svg-path-morph';
import JSPath from 'js-svg-path';
import {font,textPath,closeContours} from './adapters.mjs';
import * as Fontkit from 'fontkit';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.argv[2]??'output/geometry-comparison');await mkdir(out,{recursive:true});
const awaitBytes=await readFile('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const results=[];
function fixture(name,backend,fn){try{const measurements=fn();results.push({name,backend,status:'pass',measurements})}catch(e){results.push({name,backend,status:'fail',error:e.message})}}
const near=(v,expected,tol=1e-6)=>{if(Math.abs(v-expected)>tol)throw Error(`${v} differs from ${expected} by more than ${tol}`)};
const require=(v,message)=>{if(!v)throw Error(message)};
fixture('line length / normalized point / immutable offset','@baku89/pave',()=>{
 const line=Pave.fromD('M0 0L3 4'),before=JSON.stringify(line);near(Pave.length(line),5);const p=Pave.point(line,.5);near(p[0],1.5);near(p[1],2);
 Pave.offset(line,3);require(JSON.stringify(line)===before,'Offset mutated input');return{length:5,midpoint:p};
});
fixture('boolean hole topology','@baku89/pave',()=>{
 const ring=Pave.subtract(Pave.rect([0,0],[100,100]),[Pave.rect([25,25],[75,75])]);
 require(Pave.contains(ring,[10,10]),'Lost outer region');require(!Pave.contains(ring,[50,50]),'Lost counter');near(Math.abs(Pave.area(ring)),7500,.01);return{area:Math.abs(Pave.area(ring))};
});
fixture('boolean rectangle area / project cleanup','paper',()=>{
 paper.setup(new paper.Size(200,200));const a=new paper.Path.Rectangle(new paper.Rectangle(0,0,100,100));const b=new paper.Path.Rectangle(new paper.Rectangle(25,25,50,50));const c=a.subtract(b);near(Math.abs(c.area),7500,.01);require(!c.contains(new paper.Point(50,50)),'Lost hole');const result={area:c.area,offsetMethod:typeof c.offset};a.remove();b.remove();c.remove();near(paper.project.activeLayer.children.length,0);return result;
});
fixture('transform bounding box','svg-path-commander',()=>{
 const d=new Commander('M0 0H100V50H0Z').transform({scale:[2,3],translate:[10,20],origin:[0,0]}).toString();const b=Commander.getPathBBox(d);near(b.width,200);near(b.height,150);return b;
});
fixture('length / tangent / endpoint','svg-path-properties',()=>{
 const p=new svgPathProperties('M0 0L3 4');near(p.getTotalLength(),5);const t=p.getTangentAtLength(2);near(Math.hypot(t.x,t.y),1);const q=p.getPointAtLength(5);near(q.x,3);near(q.y,4);return{length:5,tangent:t};
});
fixture('boolean hole topology','path-bool',()=>{
 const a=PathBool.pathFromPathData('M0 0H100V100H0Z'),b=PathBool.pathFromPathData('M25 25H75V75H25Z');const arrangement=new PathBool.PathBoolean([{path:a,fillRule:PathBool.FillRule.NonZero},{path:b,fillRule:PathBool.FillRule.NonZero}]);const d=arrangement.get(PathBool.PathBooleanOperation.Difference).map(PathBool.pathToPathData).join(' ');const p=Pave.fromD(closeContours(d));require(Pave.contains(p,[10,10]),'Lost outer region');require(!Pave.contains(p,[50,50]),'Lost hole');near(Math.abs(Pave.area(p)),7500,.01);return{area:Math.abs(Pave.area(p))};
});
fixture('integer polygon offset bounds','clipper-lib',()=>{
 const off=new Clipper.ClipperOffset();off.AddPath([{X:0,Y:0},{X:100,Y:0},{X:100,Y:100},{X:0,Y:100}],Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);const result=[];off.Execute(result,10);const xs=result.flat().map(p=>p.X);near(Math.max(...xs)-Math.min(...xs),120);return{width:120,contours:result.length};
});
fixture('transform roundtrip','svgpath',()=>{
 const d='M0 0H100V50H0Z';const transformed=svgpath(d).scale(2,3).translate(10,20).translate(-10,-20).scale(.5,1/3).toString();const b=Commander.getPathBBox(transformed);near(b.width,100);near(b.height,50);return b;
});
fixture('Bézier length / normal','bezier-js',()=>{
 const line=new Bezier(0,0,1,4/3,2,8/3,3,4);near(line.length(),5,.00001);const normal=line.normal(.5),t=line.derivative(.5);near(normal.x*t.x+normal.y*t.y,0,.00001);return{length:line.length(),normal};
});
fixture('matched-topology interpolation','svg-path-morph',()=>{
 const d=morph(compile(['M0 0L100 0L100 100Z','M0 0L200 0L200 200Z']),[.5,.5]);const b=Commander.getPathBBox(d);near(b.width,150);near(b.height,150);return b;
});
fixture('closed quadratic outline roundtrip','js-svg-path',()=>{
 const d='M0 0Q50 100 100 0L100 100L0 100Z';const returned=JSPath.parse(d).toSVG();require(returned.length>0,'Empty path');const b=Commander.getPathBBox(returned);near(b.width,100);near(b.height,100);return b;
});
fixture('Latin outline + nonzero font metrics','opentype.js',()=>{
 const d=textPath('VISUAL');const b=Commander.getPathBBox(d);require(b.width>0&&b.height>0,'Empty glyphs');require(font.getAdvanceWidth('VISUAL',100)>0,'Invalid advance width');return{bbox:b,advance:font.getAdvanceWidth('VISUAL',100)};
});
fixture('Latin / combining-mark / Arabic shaping observations','fontkit',()=>{
 const f=Fontkit.create(awaitBytes);const records=['VISUAL','A\u0301','العربية'].map(text=>{const run=f.layout(text);return{text,glyphs:run.glyphs.length,missing:run.glyphs.filter(g=>g.id===0).length,advance:run.positions.reduce((n,p)=>n+p.xAdvance,0)}});require(records[0].missing===0&&records[0].advance>0,'Latin shaping failed');return records;
});
await writeFile(path.join(out,'fixtures.json'),JSON.stringify(results,null,2));
for(const r of results)console.log(r.status.toUpperCase(),r.backend,r.name,r.error??'');
if(results.some(r=>r.status==='fail'))process.exitCode=1;
