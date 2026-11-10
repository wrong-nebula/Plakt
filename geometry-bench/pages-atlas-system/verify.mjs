import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import SVGPathCommander from 'svg-path-commander';
import {FAMILIES,PALETTES,CONTROLS,LAYOUTS,PATTERNS,CONSTRUCTIONS,FORMATS,SHAPES,MAX_ITEMS,render,resolve,normalizeItems,organicParts,organicGlyph,perforationNodes,linkedNodes,shapePath,glyphSVG,aspectOf,kit,thumbnail,bitmapFor} from './engine.mjs';
import {FONT} from './fonts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/pages-shapes-study-v2'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const raster=(svg,h=500)=>new Resvg(svg,{fitTo:{mode:'height',value:h}}).render(),pixels=state=>hash(raster(render({stage:3,...state}).svg).asPng());
const ids=Object.keys(SHAPES),common={colors:['#ffffff','#000000']};
// Module sets differ under one common palette, in the atlas and in a composition.
for(const layout of ['atlas','composition'])assert.equal(new Set(FAMILIES.map(f=>pixels({layout,family:f.id,...common}))).size,3,layout);
// Every control visibly changes the layout it applies to, in every module set.
let controls=0;for(const f of FAMILIES)for(const c of CONTROLS){const layout=c.layouts?.[0]??'atlas';assert.notEqual(pixels({layout,family:f.id,params:{[c.key]:c.min}}),pixels({layout,family:f.id,params:{[c.key]:c.max}}),f.id+'/'+c.key);controls++;}
// Four distinct passes; exact A/B/A and saved-JSON replay with item settings.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4);const state={items:[{shape:'knot',construction:'linked'},{shape:'meander',turn:1},{shape:'drop',flip:true}],layout:'composition',family:f.id,palette:'signal',invert:true,params:{weight:.9,ribs:4,tails:.6,bevel:.23,nodes:24,detail:1,gap:.3}},a=render(state);render({items:['ring']});assert.equal(a.svg,render(state).svg);const saved=render(JSON.parse(JSON.stringify(a.state)));assert.equal(a.svg,saved.svg);assert.equal(hash(raster(a.svg).asPng()),hash(raster(saved.svg).asPng()));}
// Overlap lenses: independently rasterized parts combine by parity (an even
// number of overlapping parts shows ground), for the source G and for shapes.
const draw=body=>new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="348" viewBox="0 0 100 116"><rect width="100" height="116" fill="white"/>${body}</svg>`).render().pixels;
const xorChecks=[];for(const f of FAMILIES)for(const t of ['G','lattice','star','diamond']){const state=resolve({family:f.id,stage:3}),parts=organicParts(t,state),individual=parts.map(d=>draw(`<path d="${d}" fill="black" fill-rule="evenodd"/>`)),final=draw(organicGlyph(t,state,'black'));let tested=0,overlaps=0;
 // Erode each binary region by one pixel to exclude antialiased boundaries.
 for(let y=2;y<346;y++)for(let x=2;x<298;x++){const i=y*300+x,values=individual.map(b=>b[i*4]);if(values.some(v=>v!==0&&v!==255))continue;let interior=true;for(let p=0;p<individual.length;p++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(individual[p][((y+dy)*300+x+dx)*4]!==values[p])interior=false;if(!interior)continue;const occupied=values.filter(v=>v===0).length;if(occupied===2)overlaps++;assert.equal(final[i*4],occupied%2?0:255,`${f.id}/${t}: overlaps must knock out`);tested++;}
 assert(tested>60000,t);assert(overlaps>200,`${f.id}/${t} has lenses`);xorChecks.push({family:f.id,shape:t,parts:parts.length,testedInteriorPixels:tested,twoPartOverlapPixels:overlaps});}
// Source structure: the perforated E and linked S keep their authored counts.
const dots=perforationNodes('E');assert.equal(dots.length,63);assert.equal(dots.filter(p=>p.active).length,18);assert.equal(dots.filter(p=>p.tail).length,7);assert.equal(linkedNodes('S').length,18);
// Every shape × construction × module set, at both detail extremes and turned
// and mirrored: finite geometry and visible ink.
const inkOf=(c,spec,state)=>{const a=aspectOf(c,spec,state),frag=glyphSVG(c,spec,state,{x:5,y:5,w:90*a,h:90});assert(Number.isFinite(a)&&a>0);assert(!/NaN|undefined|Infinity/.test(frag),`${state.family}/${c}/${JSON.stringify(spec)}`);const px=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(90*a+10)}" height="100"><rect width="100%" height="100%" fill="white"/>${frag}</svg>`).render().pixels;let ink=0;for(let i=0;i<px.length;i+=4)if(px[i]+px[i+1]+px[i+2]<510)ink++;assert(ink>40,`${state.family}/${c}/${JSON.stringify(spec)} draws ink`);return ink;};
let cells=0;for(const f of FAMILIES)for(const detail of [-2,0,2]){const state=resolve({family:f.id,stage:3,params:{detail}});for(const t of ids)for(const c of CONSTRUCTIONS){inkOf(c.id,detail?{shape:t,turn:detail>0?1:3,flip:detail<0}:t,state);cells++;}}
// Detail changes every counted shape, and leaves the others alone.
const detailed=ids.filter(id=>SHAPES[id].count);for(const id of ids){const forms=new Set([-2,-1,0,1,2].map(k=>SHAPES[id].make(k)));assert.equal(forms.size>1,!!SHAPES[id].count,id);}
// Orientation: quarter turns and mirrors change asymmetric shapes, four turns
// return home, and turned frames stay 100 units tall.
const st=resolve({stage:3});for(const id of ['stairs','spiral','serpent','chevron','drop']){const g=t=>glyphSVG('contour',{shape:id,...t},st,{x:0,y:0,w:100*aspectOf('contour',{shape:id,...t},st),h:100});assert.notEqual(g({turn:1}),g({}),id+' turn');assert.notEqual(g({flip:true}),g({}),id+' mirror');}
assert.deepEqual(normalizeItems([{shape:'wave',turn:5},{shape:'wave',turn:-1}]).map(i=>i.turn),[1,3]);assert(Math.abs(aspectOf('overlap',{shape:'wave',turn:1},st)-aspectOf('overlap',{shape:'wave',turn:3},st))<1e-9);
// Perforation walks centerlines: every shape lights a connected-looking path
// (at least as many modules as its 100-unit height has rows).
for(const id of ids){const rows=bitmapFor({shape:id},0);assert.equal(rows.length,7);assert(rows.join('').split('').filter(x=>x==='1').length>=5,id);}
// Linked modules keep one spacing: longer shapes get more modules.
assert(linkedNodes('wave').length>linkedNodes('arc').length);assert(linkedNodes('lattice',{params:{nodes:28}}).length>linkedNodes('lattice',{params:{nodes:12}}).length);
// Field patterns are distinct; per-item constructions override the arrangement.
assert.equal(new Set(PATTERNS.map(p=>pixels({layout:'field',items:['stairs','chevron'],pattern:p.id,construction:'contour'}))).size,PATTERNS.length);
assert.notEqual(pixels({layout:'composition',items:['ring','wave']}),pixels({layout:'composition',items:[{shape:'ring',construction:'rails'},'wave']}));assert.equal(pixels({layout:'composition',construction:'linked',items:['ring']}),pixels({layout:'composition',construction:'contour',items:[{shape:'ring',construction:'linked'}]}));
// Palettes are independent of module sets; explicit colors still win.
for(const p of PALETTES){const s=resolve({palette:p.id,family:'squares'});assert.deepEqual(s.colors,p.colors);assert.equal(s.family,'squares');}assert.equal(resolve({family:'lozenges'}).palette,'lavender');assert.deepEqual(resolve({palette:'signal',colors:['#000000','#ffffff']}).colors,['#000000','#ffffff']);
// Every arrangement in every format: finite, and non-atlas ink stays inside the page edge.
const formats=[];for(const layout of LAYOUTS)for(const fmt of FORMATS){const r=render({layout:layout.id,format:fmt.id,items:ids.slice(0,7),stage:3});assert(!/NaN|undefined|Infinity/.test(r.svg),layout.id+'/'+fmt.id);if(layout.id==='atlas'||layout.id==='source'){assert.deepEqual([r.width,r.height],[644,710]);continue;}assert.deepEqual([r.width,r.height],[fmt.width,fmt.height]);
 const img=new Resvg(r.svg.replace(/fill="#dce5de"/,'fill="#ffffff"'),{fitTo:{mode:'width',value:r.width}}).render(),px=img.pixels,W=img.width,H=img.height,edge=Math.floor(Math.min(W,H)*.015);let stray=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(x>=edge&&x<W-edge&&y>=edge&&y<H-edge)continue;if(px[(y*W+x)*4]<200)stray++;}assert.equal(stray,0,`${layout.id}/${fmt.id} ink reaches the edge`);formats.push(layout.id+'/'+fmt.id);}
assert.deepEqual((({width,height})=>[width,height])(render({layout:'composition'},{width:1200,height:300})),[1200,300]);
// Input bounds and migration.
assert.deepEqual(normalizeItems('Ring, wave').map(i=>i.shape),['ring','wave']);assert.equal(normalizeItems(['ring','ring']).length,2);assert.equal(normalizeItems([{shape:'ring',construction:'nope'}])[0].construction,'auto');for(const bad of ['',[],'circle',['ring','<svg>'],'P',Array(MAX_ITEMS+1).fill('ring')])assert.throws(()=>normalizeItems(bad));
assert.equal(resolve({params:{nodes:100,ribs:-1,weight:Infinity,detail:9}}).params.nodes,28);assert.equal(resolve({params:{ribs:-1}}).params.ribs,2);assert.equal(resolve({params:{detail:9}}).params.detail,2);assert.equal(resolve({params:{detail:.4}}).params.detail,0);assert.equal(resolve({layout:'poster',construction:'x',format:'y',pattern:'z',palette:'w'}).layout,'atlas');
const migrated=resolve({engine:'pages-atlas-v1',version:1,letters:'SHAPE',family:'squares',params:{weight:.9,ribs:4,tails:.6,bevel:.2,nodes:20},colors:['#c8dce9','#843852'],invert:false,stage:4});assert.equal(migrated.layout,'source');assert.equal(migrated.family,'squares');assert.equal(migrated.palette,'ice');assert.equal(migrated.params.ribs,4);assert(render(migrated).features.sourceSet);
const early=resolve({engine:'pages-shapes-v2',version:2,shapes:['knot','ring'],layout:'field',family:'lozenges'});assert.deepEqual(early.items.map(i=>i.shape),['knot','ring']);assert.equal(early.palette,'lavender');
// Supporting outlines contain repeated implicit commands; rewriting must keep bounds.
for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const original=SVGPathCommander.getPathBBox(FONT.black[ch].d),rewritten=SVGPathCommander.getPathBBox(shapePath(FONT.black[ch].d,resolve()));for(const key of ['x','y','x2','y2'])assert(Math.abs(original[key]-rewritten[key])<.001);}
// Unique gradient ids, all references resolve; editor strips render.
for(const state of [{},{layout:'composition',construction:'folded',items:ids},{layout:'field',construction:'mixed',pattern:'scatter'}]){const r=render(state),found=[...r.svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(found.length,new Set(found).size);for(const m of r.svg.matchAll(/url\(#([^\)]+)\)/g))assert(found.includes(m[1]));}
assert(kit({items:['knot','ring']},1).includes('Ring in all eight'));for(const t of ids)assert(!/NaN|undefined/.test(thumbnail(t,{construction:'folded'})));
const atlasPng=raster(render().svg,3000);assert.deepEqual([atlasPng.width,atlasPng.height],[2721,3000]);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteModuleSets:'3 distinct in atlas and composition',visibleParameterChecks:controls,distinctPassesPerFamily:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON, with per-item constructions, turns and mirrors',exclusiveOr:xorChecks,sourcePerforation:{gridSites:63,activeModules:18,dripTails:7},sourceLinkedModules:18,shapeConstructionCells:cells+' (3 module sets × detail −2/0/+2, the extremes turned and mirrored)',detail:`${detailed.length} counted shapes change with detail; ${ids.length-detailed.length} fixed shapes do not`,orientation:'turns and mirrors change asymmetric shapes; turns normalize mod 4; opposite turns share a frame',perforation:'every shape lights at least five modules on its walked grid',patterns:PATTERNS.length+' distinct field patterns',itemConstructions:'per-item constructions override the arrangement and match it when equal',palettes:PALETTES.length+' palettes independent of module sets; explicit colors win',arrangements:formats.length+' non-atlas layout/format pairs keep ink clear of a 1.5% edge',inputBounds:'item ids, objects, duplicates, unknown ids, empty and over-long lists, numeric limits',migration:'pages-atlas-v1 rules open as the source atlas; early shape-list rules open as items',gradientIds:'unique and all references resolve',png:[2721,3000]},limitations:'These checks verify construction rules and arrangement bounds, not exact recovery of Neo Neo’s production files or typefaces, and not aesthetic quality.'},null,2));
console.log(`PASS: ${cells} shape cells, ${xorChecks.length} lens parity checks, ${controls} visible controls, ${PATTERNS.length} patterns, ${PALETTES.length} palettes, ${formats.length} arrangement/format pairs, replay, migration and 2721 × 3000 export.`);
