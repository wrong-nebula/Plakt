import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import * as esbuild from 'esbuild';
import {converter,wcagContrast} from 'culori';
import * as E from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const {SOURCE,FAMILIES,PALETTES,CONTROLS,LAYOUTS,CONSTRUCTIONS,PATTERNS,FORMATS,SHAPES,GROUPS,G_PARTS,S_NODES,render,kit,glyphSVG,aspectOf,resolve}=E;
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/pages-shapes-study-v2');fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),recordFile=path.join(root,'library/posters',SOURCE.id,'record.json'),record=JSON.parse(fs.readFileSync(recordFile)),image=fileURLToPath(record.imageURL);
fs.copyFileSync(image,path.join(out,'reference.png'));fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...SOURCE,caption:record.source.caption,sourceImage:image,imageSHA256:hash(fs.readFileSync(image)),recordSHA256:hash(fs.readFileSync(recordFile)),basis:'Manual construction study of the visible specimen collage. Each construction method is taken from one source letter and generalized to centerline shapes. Original typefaces, production contours, photographic texture and the small source illustration are not recovered; a book-construction diagram replaces that illustration.'},null,2));
fs.copyFileSync(path.join(here,'font-provenance.json'),path.join(out,'supporting-type.json'));
const png=(svg,w,h)=>new Resvg(svg,{fitTo:w>=h?{mode:'width',value:3000}:{mode:'height',value:3000}}).render().asPng();
// The editor's gallery; every card is also a built example.
const gallery=[
 {title:'Three module sets',note:'The shape atlas in each module set and its own palette. The module shape changes; contours, lenses, linked modules, perforations and folds keep their logic.',cards:FAMILIES.map((f,i)=>({id:'atlas-'+f.id,name:`${String(i+1).padStart(2,'0')} / ${f.name}`,sub:PALETTES.find(p=>p.id===f.palette).name,state:{family:f.id}}))},
 {title:'Arrangements',note:'The same kit as a specimen, a composition and a field, beside the source letters it comes from.',cards:[
  {id:'specimen',name:'Shape specimen',sub:'All twenty shapes × eight constructions',state:{layout:'specimen',items:Object.keys(SHAPES),format:'a-series'}},
  {id:'composition-poster',name:'Composition',sub:'Five items, mixed constructions',state:{layout:'composition'}},
  {id:'field-square',name:'Shape field',sub:'Closed forms, mixed constructions',state:{layout:'field',format:'square',items:['ring','petal','drop','diamond','triangle','loop','knot']}},
  {id:'source',name:'Source atlas',sub:'The reference letters',state:{layout:'source'}}]},
 {title:'Items, patterns and palettes',note:'Items carry their own construction, turn and mirror. Field patterns add turns and mirrors per cell; palettes are independent of the module set.',cards:[
  {id:'composition-items',name:'Per-item constructions',sub:'Turned wave, linked knot, mirrored stairs, faceted star',state:{layout:'composition',palette:'newsprint',items:[{shape:'wave',turn:1,construction:'contour'},{shape:'knot',construction:'linked'},{shape:'stairs',flip:true,construction:'folded'},{shape:'star',construction:'facets'}]}},
  {id:'field-turn',name:'Quarter turns',sub:'Stairs as contour bands',state:{layout:'field',format:'square',items:['stairs'],pattern:'turn',construction:'contour'}},
  {id:'field-mirror',name:'Mirror tiles',sub:'Arc and chevron, squeezed heavy, signal orange',state:{layout:'field',format:'square',family:'lozenges',palette:'signal',items:['arc','chevron'],pattern:'mirror',construction:'heavy'}},
  {id:'field-scatter',name:'Scatter',sub:'Dense, oversized, cobalt',state:{layout:'field',format:'square',palette:'cobalt',items:['petal','zigzag'],pattern:'scatter',params:{density:1.6,size:1.15}}}]}
];
const examples=gallery.flatMap(g=>g.cards.map(c=>({name:c.id,state:c.state})));
for(const f of FAMILIES)examples.push({name:'atlas-closed-'+f.id,state:{family:f.id,items:['ring','petal','loop','drop','knot']}});
for(const stage of [1,2,3,4])examples.push({name:`stage-${stage}`,state:{stage}});
examples.push({name:'specimen-crossings',state:{layout:'specimen',family:'lozenges',format:'landscape',items:['cross','star','chevron','lattice','bars'],params:{detail:1}}});
for(const [name,state] of [
 ['composition-square',{layout:'composition',format:'square',items:['knot','meander','drop'],construction:'contour'}],
 ['composition-story',{layout:'composition',format:'story',family:'squares',items:['arch','drop','ring'],construction:'folded'}],
 ['composition-landscape',{layout:'composition',format:'landscape',family:'lozenges',items:['wave','spiral','zigzag','serpent'],construction:'overlap'}],
 ['composition-billboard',{layout:'composition',format:'billboard',palette:'signal',items:['wave','loop','zigzag','ring','serpent','star'],construction:'linked'}],
 ['field-poster',{layout:'field',family:'squares',items:['wave','arc','spiral'],construction:'rails'}],
 ['field-landscape',{layout:'field',format:'landscape',family:'lozenges',items:['cross','star','lattice','chevron'],construction:'facets'}]
])examples.push({name,state});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,r.width,r.height));}
// Kit strips, the shapes × constructions grids and the detail grids.
const ids=Object.keys(SHAPES),cell=120,grid=(state,cols,at,file)=>{let body='';ids.forEach((t,r)=>cols.forEach((col,k)=>{const s=at(state,col),c=s.c,a=aspectOf(c,t,s.state),w=Math.min(cell*.84,cell*.84*a),h=w/a;body+=glyphSVG(c,t,s.state,{x:k*cell+(cell-w)/2,y:r*cell+(cell-h)/2,w,h});}));const W=cols.length*cell,H=ids.length*cell;fs.writeFileSync(path.join(out,file),new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${state.colors[0]}"/>${body}</svg>`).render().asPng());};
for(const f of FAMILIES){const s=kit({family:f.id,items:['knot']});fs.writeFileSync(path.join(out,`kit-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`kit-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:2400}}).render().asPng());
 const state=resolve({family:f.id,stage:3});grid(state,CONSTRUCTIONS.map(c=>c.id),(s,c)=>({state:s,c}),`grid-${f.id}.png`);}
for(const c of ['overlap','contour']){const state=resolve({stage:3});grid(state,[-2,-1,0,1,2],(s,k)=>({state:resolve({...s,params:{...s.params,detail:k}}),c}),`detail-${c}.png`);}
const oklch=converter('oklch');fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({families:FAMILIES,palettes:PALETTES.map(p=>({...p,oklch:p.colors.map(c=>oklch(c)),figureGroundContrast:wcagContrast(...p.colors)})),controls:CONTROLS,layouts:LAYOUTS,patterns:PATTERNS,constructions:CONSTRUCTIONS,formats:FORMATS,groups:GROUPS,shapes:Object.fromEntries(ids.map(id=>[id,{name:SHAPES[id].name,group:SHAPES[id].group,detail:SHAPES[id].count??null,forms:[-2,-1,0,1,2].map(k=>SHAPES[id].make(k))}])),sourceOverlapParts:G_PARTS,sourceLinkedNodes:S_NODES},null,2));
// The editor carries the engine, the Clipper kernel and the supporting outlines.
const engine=(await esbuild.build({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'PagesEngine',minify:true,write:false,platform:'browser',target:'es2020',logLevel:'warning'})).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine,catalog:E,gallery}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, kit strips, three shape grids and two detail grids: ${out}`);
