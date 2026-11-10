import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import SVGPathCommander from 'svg-path-commander';
import {FAMILIES,CONTROLS,render,resolve,normalizeLetters,organicParts,organicGlyph,perforationNodes,linkedNodes,shapePath} from './engine.mjs';
import {FONT} from '../fonts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/pages-atlas-study-v1'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const raster=svg=>new Resvg(svg,{fitTo:{mode:'height',value:500}}).render().asPng(),pixels=state=>hash(raster(render({stage:3,...state}).svg));
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:['#ffffff','#000000']}))).size,3);
let controls=0;for(const f of FAMILIES)for(const c of CONTROLS){assert.notEqual(pixels({family:f.id,params:{[c.key]:c.min}}),pixels({family:f.id,params:{[c.key]:c.max}}),f.id+'/'+c.key);controls++;}
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4);const state={letters:'SHAPE',family:f.id,invert:true,params:{weight:.9,ribs:4,tails:.6,bevel:.23,nodes:24}},a=render(state);render({letters:'FORMS'});assert.equal(a.svg,render(state).svg);const saved=render(JSON.parse(JSON.stringify(a.state)));assert.equal(a.svg,saved.svg);assert.equal(hash(raster(a.svg)),hash(raster(saved.svg)));}
// Verify actual exclusive-or behavior using independently rasterized components.
const draw=body=>new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="348" viewBox="0 0 100 116"><rect width="100" height="116" fill="white"/>${body}</svg>`).render().pixels;
const xorChecks=[];for(const f of FAMILIES){const state=resolve({family:f.id,stage:3}),parts=organicParts('G',state),individual=parts.map(d=>draw(`<path d="${d}" fill="black" fill-rule="evenodd"/>`)),final=draw(organicGlyph('G',state,'black'));let tested=0,overlaps=0;
 // Erode each binary region by one pixel to exclude antialiased boundaries;
 // separately rasterized paths and a compound path can quantize edges differently.
 for(let y=2;y<346;y++)for(let x=2;x<298;x++){const i=y*300+x,values=individual.map(b=>b[i*4]);if(values.some(v=>v!==0&&v!==255))continue;let interior=true;for(let p=0;p<individual.length;p++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(individual[p][((y+dy)*300+x+dx)*4]!==values[p])interior=false;if(!interior)continue;const occupied=values.filter(v=>v===0).length;if(occupied===2)overlaps++;assert.equal(final[i*4],occupied%2?0:255,'Overlaps must knock out rather than add ink');tested++;}assert(tested>80000);assert(overlaps>1000);xorChecks.push({family:f.id,testedInteriorPixels:tested,twoComponentOverlapPixels:overlaps});}
const dots=perforationNodes('E');assert.equal(dots.length,63);assert.equal(dots.filter(p=>p.active).length,18);assert.equal(dots.filter(p=>p.tail).length,7);assert.equal(linkedNodes('S').length,18);
// Font outlines contain repeated implicit line/quadratic commands. Rewriting
// them into explicit geometry must preserve their bounds in the round family.
for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const original=SVGPathCommander.getPathBBox(FONT.black[ch].d),rewritten=SVGPathCommander.getPathBBox(shapePath(FONT.black[ch].d,resolve()));for(const key of ['x','y','x2','y2'])assert(Math.abs(original[key]-rewritten[key])<.001,'Supporting outline must survive path conversion');}
for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const letters=ch.repeat(5),r=render({letters});assert.equal(r.state.letters,letters);assert(!/NaN|undefined/.test(r.svg));assert(organicParts(ch).length>=3);assert(perforationNodes(ch).some(n=>n.active));assert(linkedNodes(ch).every(n=>n.every(Number.isFinite)));}
for(const letters of ['PAGES','SHAPE','FORMS','PAPER'])assert(render({letters}).features.constructionMethods.length>=6);assert.equal(normalizeLetters('p.a.g.e.s.'),'PAGES');assert.equal(normalizeLetters('shapé'),'SHAPE');for(const bad of ['', 'PLOT','PAGESX','🌷🌷🌷🌷🌷','12345','<html>'])assert.throws(()=>normalizeLetters(bad));assert.equal(resolve({params:{nodes:100,ribs:-1,weight:Infinity}}).params.nodes,28);assert.equal(resolve({params:{ribs:-1}}).params.ribs,2);assert.equal(resolve({params:{weight:Infinity}}).params.weight,1);
const r=render(),ids=[...r.svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);for(const m of r.svg.matchAll(/url\(#([^\)]+)\)/g))assert(ids.includes(m[1]));
const png=new Resvg(r.svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(png.readUInt32BE(16),2721);assert.equal(png.readUInt32BE(20),3000);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteModuleSets:3,visibleParameterChecks:controls,distinctPassesPerFamily:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',exclusiveOr:xorChecks,sourcePerforation:{gridSites:63,activeModules:18,dripTails:7},sourceLinkedModules:18,extensionAlphabet:'A–Z across all constructions; implicit supporting-path commands preserve bounds',inputBounds:'five-letter sets, punctuation normalization, invalid input and numeric limits',gradientIds:'unique and all references resolve',png:[2721,3000]},limitations:'These checks verify construction rules, not exact recovery of Neo Neo’s production files or typefaces.'},null,2));
console.log(`PASS: 3 module sets, ${controls} visible controls, XOR pixels, perforation structure, A–Z transfer, replay and 2721 × 3000 export.`);
