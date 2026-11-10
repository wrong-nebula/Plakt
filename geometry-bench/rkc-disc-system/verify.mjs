import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {render,resolve,normalize,arrange,glyphCells,ENGINE,FAMILIES,BONDS,CONTROLS,FORMATS,PRESETS} from './engine.mjs';
import {union,offset,intersect,area,topology} from '../punkt-capsule-system/geometry.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pixels=r=>new Resvg(r.svg,{fitTo:{mode:'height',value:400}}).render().asPng();
const size=shape=>Math.abs(shape.reduce((s,p)=>s+area(p),0));
function inks(r){const g=r.geometry(),of=ink=>union(...g.groups.filter(x=>x.ink===ink).map(x=>x.shape()));return {...g,ground:of(0),figure:of(1)};}
// Letter and counter ink never overlap and keep at least one hairline apart;
// every lattice cell is drawn exactly once.
function invariants(r,label){
 const k=inks(r),eps=1e-3*k.pitch**2;
 assert(size(intersect(k.figure,k.ground))<eps,`${label}: letter and counter ink overlap`);
 if(k.seam>0){const h=k.seam*.45;assert(size(intersect(offset(k.figure,h),offset(k.ground,h)))<eps,`${label}: inks closer than the hairline`);}
 assert.equal(k.groups.reduce((s,g)=>s+g.cells.length,0),r.features.cells,`${label}: every cell drawn once`);
 assert(k.groups.every(g=>size(g.shape())>0),`${label}: no empty module`);
 assert(!/NaN|Infinity/.test(r.svg),`${label}: finite geometry`);
}
const families=[],seen=new Set();
for(const f of FAMILIES){
 const input={text:'R',family:f.id,figure:'both',ground:'down',colors:['#101010','#f0f0f0','#707070']},a=render(input);
 render({text:'FU/BU',family:'facet'});assert.equal(a.svg,render(input).svg,'A/B/A vector replay');
 assert.equal(sha(pixels(a)),sha(pixels(render(JSON.parse(JSON.stringify(a.state))))),'saved-rule pixel replay');
 const hash=sha(pixels(a));assert(!seen.has(hash),'shape families differ under one rule and palette');seen.add(hash);
 const stages=[1,2,3,4].map(stage=>sha(pixels(render({...input,stage}))));assert.equal(new Set(stages).size,4,`${f.id}: four construction stages`);
 // All sixteen bond pairs, with and without the backing, keep the inks apart.
 const bonds=new Set();
 for(const g of BONDS)for(const h of BONDS)for(const backing of [false,true]){
  const r=render({text:'R',family:f.id,figure:g.id,ground:h.id,backing});invariants(r,`${f.id} ${g.id}/${h.id}`);if(!backing)bonds.add(sha(pixels(r)));}
 assert.equal(bonds.size,16,`${f.id}: sixteen distinct bond fields`);
 // Extremes: tangent necks and fillets, widest and finest hairline.
 for(const params of [{neck:1,fillet:1,seam:.005},{neck:1,fillet:1,seam:.12},{neck:.05,fillet:.05,seam:0}])
  invariants(render({text:'RKC/08&',layout:'field',family:f.id,figure:'both',ground:'none',params}),`${f.id} ${JSON.stringify(params)}`);
 families.push({family:f.id,pixelSHA256:hash,stages:4,bondFields:16,replay:'passed'});
}
// Every control visibly changes a rule where it applies.
const base={text:'RK/C',layout:'field',figure:'both',ground:'none',backing:true};
for(const c of CONTROLS){const lo=render({...base,params:{[c.key]:c.min}}),hi=render({...base,params:{[c.key]:c.max}});
 assert.notEqual(sha(pixels(lo)),sha(pixels(hi)),`${c.key} changes pixels`);}
for(const p of PRESETS)invariants(render({...p.state,text:'RKC'}),`preset ${p.id}`);
assert.equal(new Set(PRESETS.map(p=>sha(pixels(render({...p.state,text:'R'}))))).size,PRESETS.length,'named rules differ');

// Text transfer: every supported glyph, one module per glyph cell.
for(const text of ['ABCDEF/GHIJKL/MNOPQR/STUVWX','YZ0123/456789/.:!?+&,-\'','RKC','FU/BU','TY/PE','04.12']){
 const r=render({text,layout:'field'});assert.equal(r.glyphs.map(g=>g.character).join(''),text.replaceAll('/',''));
 assert.equal(r.features.figureCells,[...text.replaceAll('/','')].reduce((s,ch)=>s+glyphCells(ch).cells.length,0),`${text}: one letter module per glyph cell`);invariants(r,text);
}
assert.equal(glyphCells('1').width,3);assert.equal(glyphCells('.').width,2);assert.equal(glyphCells('R').width,5);
// Joined letters: each glyph is one outline with its own counters; loose letters stay one module per cell.
const expected={I:[1,0],L:[1,0],C:[1,0],K:[1,0],X:[1,0],S:[1,0],O:[1,1],R:[1,1],A:[1,1],B:[1,2],8:[1,2]},topo={};
for(const f of FAMILIES){
 const r=render({text:Object.keys(expected).join(''),layout:'field',family:f.id,figure:'both',ground:'none',backing:false}),g=r.geometry();
 r.glyphs.forEach((glyph,i)=>{const t=topology(union(...g.groups.filter(x=>x.ink===1&&x.glyphs.includes(i)).map(x=>x.shape())));
  assert.deepEqual([t.outlines,t.holes],expected[glyph.character],`${f.id} ${glyph.character} outlines/counters`);topo[glyph.character]=[t.outlines,t.holes];});
}
const loose=render({text:'RKC',layout:'field',figure:'none',params:{neck:0}});
assert.equal(loose.geometry().groups.filter(g=>g.ink===1).length,loose.features.figureCells,'unbonded letters without necks are loose discs');

// Fit: the format is filled with whole modules, the paper border stays between
// one border and half a module more, and row breaks stay readable.
const fit=[];
for(const format of FORMATS)for(const text of ['R','RKC','FU/BU','DECEMBER','04.12','ROCKING CHAIR']){
 const r=render({text,layout:'fit',format:format.id}),geo=arrange({text,layout:'fit',format:format.id}),b=geo.state.params.border*geo.p;
 assert.equal(r.width,format.width);assert.equal(r.height,format.height);
 for(const o of [geo.ox,geo.oy])assert(o>=b-1e-6&&o<b+geo.p/2+1e-6,`${format.id} ${text}: border within half a module`);
 assert(geo.cols*geo.p<=format.width&&geo.rows*geo.p<=format.height,`${format.id} ${text}: field inside the format`);
 invariants(r,`fit ${format.id} ${text}`);fit.push({format:format.id,text,rows:r.features.rowsText,modules:`${r.features.cols}×${r.features.fieldRows}`});
}
const rows=(text,format)=>render({text,layout:'fit',format}).features.rowsText.join('/');
assert.equal(rows('R','december'),'R');assert.equal(render({text:'R'}).features.cols,5);assert.equal(render({text:'R'}).features.fieldRows,7,'R fills the source 5 × 7 field');
assert.equal(rows('DECEMBER','billboard'),'DECEMBER');assert.equal(rows('PUNKT','story'),'PU/N/KT');assert.equal(rows('04.12','december'),'04./12');
assert.equal(rows('ROCKING CHAIR','landscape'),'ROCKING/CHAIR');assert.equal(rows('RKC','december'),'RK/C');
assert.equal(render({text:'RKC'},{width:500,height:500}).width,500,'any box fits');

for(const bad of ['', '////', 'A'.repeat(25), 'A/B/C/D/E', '🍒','A#'])assert.throws(()=>normalize(bad));
assert.equal(normalize('café'),'CAFE');assert.equal(resolve({params:{neck:Infinity}}).params.neck,.9);assert.equal(resolve({params:{tracking:1.6}}).params.tracking,2);
// v1 tile-kit rules keep letters, kernel, inks, inversion and hairline.
const v1=resolve({engine:'rkc-disc-counter-v1',text:'FU/BU',kernel:'facet',params:{seam:.03,join:.2,cut:.1,phase:1},colors:['#ed432e','#eee2bc','#696247'],invert:true});
assert.deepEqual([v1.engine,v1.text,v1.family,v1.params.seam,v1.layout,v1.figure,v1.backing,v1.invert,v1.colors[2]],[ENGINE,'FU/BU','facet',.03,'field','both',false,true,'#696247']);
const full=new Resvg(render({}).svg,{fitTo:{mode:'height',value:3000}}).render();assert.equal(full.width,2160);assert.equal(full.height,3000);

const report={status:'passed',environment:'Node + resvg on this Mac',engine:ENGINE,families,controls:CONTROLS.map(c=>c.key),presets:PRESETS.map(p=>p.id),topology:topo,fit,
 scope:'Exact SVG/pixel replay; three shape families; four stages each; sixteen distinct bond fields per family; letter and counter ink never overlap and keep one hairline apart across every bond pair, backing, preset, extreme and fit format; every lattice cell drawn once; one letter module per glyph cell for all supported characters; joined letters are single outlines with the right counters; fit borders, field placement and row breaks; v1 rule migration; invalid inputs; 2160 × 3000 export.'};
fs.writeFileSync(new URL('../../output/rkc-disc-study-v2/validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log(`PASS: 3 families × 16 bond pairs (± backing) keep inks apart; ${CONTROLS.length} controls; 4 stages; glyph transfer and topology; ${fit.length} fit renders; replay, migration and export checks.`);
