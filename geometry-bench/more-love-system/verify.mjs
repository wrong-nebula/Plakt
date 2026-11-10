import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,SOURCE_ROWS,FAMILIES,CONTROLS,CHARACTERS,render,resolve,normalizeWord,splitRows,wordRows,bandCenters,glyphGeometry,metrics} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/more-love-study-v2');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const raster=s=>new Resvg(s,{fitTo:{mode:'height',value:450}}).render().asPng();
const pixels=s=>hash(raster(render(s).svg));

// Three geometries under one palette; every control visible in every family.
const systems=FAMILIES.map(f=>pixels({family:f.id,colors:['#122639','#dab2de']}));assert.equal(new Set(systems).size,3);
let parameterChecks=0;for(const f of FAMILIES)for(const c of CONTROLS){assert.notEqual(pixels({family:f.id,params:{[c.key]:c.min}}),pixels({family:f.id,params:{[c.key]:c.max}}),`${f.id} ${c.key}`);parameterChecks++;}
// Four passes, exact replay, and no cache leakage between families.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4);const s={family:f.id,name:'SHAPE/SYSTEM',first:'FORM',second:'PLAY',params:{curve:.8,reach:1.2,weight:1.1,gap:.7,soft:1.4,tracking:.6,bands:.8},invert:true};const a=render(s);render({family:'lens',first:'CHANGE',params:{curve:.8}});assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}

// Source layout: every measured letter keeps its cell centre and cap top.
const base=resolve({});
wordRows('NEW STUDIO',base).forEach(([ch,x,y,em],i)=>{const [,cx,cy,w,h]=SOURCE_ROWS[i],[a,,b]=glyphGeometry(ch,base).bounds;assert.equal(ch,SOURCE_ROWS[i][0]);assert(Math.abs(x+(a+b)/2*em-(cx+w/2))<1e-6);assert.equal(y,cy);assert.equal(em,h/100);});

// Clean contours for all letters in all families and at control extremes:
// no slivers or nubs, and parts stay inside the cap band unless the letter
// has a tip on that side (or Q's tail).
const area=p=>Math.abs(p.reduce((s,[x,y],i)=>{const [u,v]=p[(i+1)%p.length];return s+x*v-u*y;},0))/2;
const topTip='AESI02389?',bottomTip='ESIUVJQ03568,;';let contours=0,smallest=Infinity;
const extremes=[{},...CONTROLS.flatMap(c=>[{[c.key]:c.min},{[c.key]:c.max}])];
for(const f of FAMILIES)for(const params of extremes)for(const forms of ['source','clear']){const s=resolve({family:f.id,params,forms});for(const ch of forms==='source'?CHARACTERS:'NW'){const g=glyphGeometry(ch,s),[x0,y0,x1,y1]=g.bounds;
 assert(g.polys.length>0&&[x0,y0,x1,y1].every(Number.isFinite),ch);for(const p of g.polys){const a=area(p);smallest=Math.min(smallest,a);contours++;assert(a>=6,`${f.id} ${ch} ${JSON.stringify(params)} sliver ${a.toFixed(2)}`);}
 if(!topTip.includes(ch))assert(y0>=-.5,`${f.id} ${ch} rises above the cap line`);if(!bottomTip.includes(ch))assert(y1<=100.5,`${f.id} ${ch} drops below the baseline`);}}

// Pixel probes in glyph units: cuts never notch bars or stems behind them.
function inkAt(ch,family,points,forms='source'){const s=resolve({family,stage:2,forms}),g=glyphGeometry(ch,s),img=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="-30 -30 160 160"><rect x="-30" y="-30" width="160" height="160" fill="white"/><path d="${g.d}" fill="black"/></svg>`).render();
 return points.map(([x,y])=>img.pixels[(Math.round((y+30)*4)*640+Math.round((x+30)*4))*4]<128);}
const P=metrics(base.params);
for(const f of FAMILIES){
 assert.deepEqual(inkAt('W',f.id,[[41,6],[29+P.g/2+P.s/2,60]]),[false,true],'W: open top, centre stem');
 assert.deepEqual(inkAt('N',f.id,[[41,8],[41+P.g/2+P.s/2,92]]),[false,true],'N: top cut, stem joined at the foot');
 assert.deepEqual(inkAt('B',f.id,[[40,50],[40,8]]),[true,false],'B: crossbar intact under the top cut');
 assert.deepEqual(inkAt('O',f.id,[[41,50],[41,4]]),[true,false],'O: bar intact, top cut open');
 assert.deepEqual(inkAt('I',f.id,[[50,50],[4,50]]),[true,false],'I: pill, open sides');
 assert.deepEqual(inkAt('0',f.id,[[42,50],[4,50],[4,30]]),[false,false,true],'0: no bar, side slits');
 assert.deepEqual(inkAt('8',f.id,[[50,50],[50,32],[50,68]]),[true,false,false],'8: waist bar between two counters');
 assert.deepEqual(inkAt('1',f.id,[[38,60],[60,60]]),[true,false],'1: single stem');
 assert.deepEqual(inkAt('N',f.id,[[29,96],[66,4],[29,10],[66,96]],'clear'),[false,false,true,true],'clear N: counters open below left and above right');
 assert.deepEqual(inkAt('W',f.id,[[29,4],[69,4],[49,10],[49,96]],'clear'),[false,false,false,true],'clear W: two counters open above, short centre leg');
 assert.deepEqual(inkAt('.',f.id,[[11,90],[11,60]]),[true,false],'full stop on the baseline');}

// Rows: source grid, short words, word-aware breaks, explicit '/'.
const split=t=>splitRows(t).map(r=>r.join('')).join('/');
for(const [t,e] of [['2021','20/21'],['NEW STUDIO','NEW/STU/DIO'],['FUBU','FU/BU'],['ZOO','ZOO'],['FOR YOU','FOR/YOU'],['MAKE IT BOLD','MAKE/IT/BOLD'],['WELTFORMAT','WELT/FOR/MAT'],['SHAPE/SYSTEM','SHAPE/SYSTEM']])assert.equal(split(t),e,t);
// Transferred lettering stays inside the field and clear of the bands.
const probes=['FUBU','SHAPE/SYSTEM','MAKE IT BOLD','ABCDEFGHIJKL','MNOPQRSTUVWX','YZ','Q','W/M/Q','2021','0123456789','WELT/2021','8/3/Q','WHY NOT?','9.10.–17.10.',"IT'S A, B; C",'NEW WAVE'];
for(const name of probes)for(const f of FAMILIES)for(const bands of [.65,1,1.35]){const s=resolve({name,family:f.id,params:{bands}}),r=render(s),count=splitRows(s.name).length,h=92*bands,centres=bandCenters(count,s);
 assert.equal(r.rows.map(c=>c[0]).join(''),s.name.replace(/[ /]/g,''));assert(!/NaN|undefined/.test(r.svg));
 for(const [ch,x,y,em] of r.rows){const [a,b,c,d]=glyphGeometry(ch,s).bounds,box=[x+a*em,y+b*em,x+c*em,y+d*em];assert(box[0]>=0&&box[2]<=767,`${name} ${ch} width`);
  for(const cy of centres)assert(box[3]<=cy-h/2-2||box[1]>=cy+h/2+2,`${name} ${ch} touches a band (${f.id}, ${bands})`);assert(box[1]>=30&&box[3]<=1035,`${name} ${ch} height`);}}

assert.equal(normalizeWord('móre'),'MORE');assert.equal(normalizeWord('fu / bu','',{rows:true}),'FU/BU');assert.equal(normalizeWord('2021','',{rows:true}),'2021');assert.equal(normalizeWord('9.10.–17.10.'),'9.10.–17.10.');assert.equal(normalizeWord('it’s — ok'),"IT'S – OK");for(const bad of ['#1','A&B','A/B'])assert.throws(()=>normalizeWord(bad));
for(const bad of ['','🌷','<script>','ABCDEFGHIJKLM'])assert.throws(()=>normalizeWord(bad));for(const bad of ['A/B/C/D','FU/BU'])assert.throws(()=>normalizeWord(bad,'',{rows:bad==='A/B/C/D'}));
assert.equal(resolve({params:{curve:Infinity}}).params.curve,1);assert.equal(resolve({params:{reach:-9}}).params.reach,.5);assert.equal(resolve({params:{bands:99}}).params.bands,1.35);assert.equal(resolve({params:{soft:-1}}).params.soft,0);
// Letterforms: auto uses the source N and W only for NEW STUDIO.
const nOf=(name,forms)=>render({name,forms,stage:2}).svg.match(/data-glyph="N"[^>]*>(<path[^>]*>)/)[1];
assert.equal(nOf('NEW STUDIO','auto'),nOf('NEW STUDIO','source'));assert.equal(nOf('NEW WAVE','auto'),nOf('NEW WAVE','clear'));assert.notEqual(nOf('NEW WAVE','clear'),nOf('NEW WAVE','source'));assert.equal(resolve({forms:'bogus'}).forms,'auto');
const credit=render({first:'9.10.–17.10.',second:'LOVE!'});assert(!/NaN|undefined/.test(credit.svg));
// A version 1 rule still opens: shared text, palette and controls carry over.
const v1=JSON.parse(fs.readFileSync(path.join(root,'output/more-love-study-v1/reciprocal-fubu.json')));const r1=render(v1);assert.equal(r1.state.engine,ENGINE);assert.equal(r1.state.name,v1.name);assert.deepEqual(r1.state.colors,v1.colors);for(const k of Object.keys(v1.params))assert.equal(r1.state.params[k],v1.params[k]);
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),2154);assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(const ch of CHARACTERS)glyphGeometry(ch,resolve({params:{curve:.987}}));const glyphsMs=+(performance.now()-t0).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteShapeSystems:3,visibleParameterChecks:parameterChecks,distinctPassesPerFamily:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',sourceLayout:'nine measured cell centres and cap tops',glyphs:CHARACTERS.length,cleanContours:{contours,families:3,controlSettings:extremes.length,smallestContourArea:+smallest.toFixed(1),minimumAllowed:6},capBand:'parts stay inside the cap band except tips and the Q tail',cutProbes:'W, N, B, O, I, 0, 8, 1, clear N and W, full stop: pixel probes in all families',letterforms:'auto, source and clear N/W',rows:'source grid, FU/BU, word-aware and explicit / breaks',bandClearance:`${probes.length} probes × 3 families × 3 band heights`,invalidInputs:'empty, unsupported (# & and / in bands), oversized, four rows; parameter bounds',v1Rule:'opens with text, palette and controls preserved',png:[2154,3000],glyphGeometryMs:glyphsMs},limitations:'Checks verify construction behaviour, not exact recovery of the original typeface or production contours.'},null,2));
console.log(`PASS: 3 systems, ${parameterChecks} visible controls, 4 stages, replay, source cells, ${contours} clean contours (smallest ${smallest.toFixed(1)}), cut probes, rows, band clearance, v1 rules, 2154 × 3000 export. ${CHARACTERS.length}-glyph geometry in ${glyphsMs} ms.`);
