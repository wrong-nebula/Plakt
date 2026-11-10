import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {render,resolve,normalize,fitFrames,FAMILIES,FORMATS,CONTROLS,SOURCE_LAYERS,RECIPES} from './engine.mjs';
import {topology,offset,intersect,area} from './geometry.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pixels=r=>new Resvg(r.svg,{fitTo:{mode:'height',value:400}}).render().asPng();
// No two glyphs come closer than one hairline (with 2% tolerance for arc chords).
function hairline(r){
 const H=r.state.params.seam,grown=r.glyphs.map(g=>offset(g.outline,H*.49));
 for(let i=0;i<grown.length;i++)for(let j=i+1;j<grown.length;j++){
  const overlap=intersect(grown[i],grown[j]).reduce((s,p)=>s+Math.abs(area(p)),0);
  assert(overlap<.5,`${r.glyphs[i].character}/${r.glyphs[j].character} closer than the hairline`);
 }
}
const results=[],shapes=new Set();
for(const f of FAMILIES){
 const input={family:f.id,colors:['#101116','#c0b4e9']},a=render(input);
 render({text:'FU/BU',family:'waisted'});assert.equal(a.svg,render(input).svg,'A/B/A vector replay');
 assert.equal(sha(pixels(a)),sha(pixels(render(JSON.parse(JSON.stringify(a.state))))),'saved-rule pixel replay');
 const hash=sha(pixels(a));assert(!shapes.has(hash),'geometry families differ under a common palette');shapes.add(hash);
 for(const c of CONTROLS){
  const lo=render({...input,params:{[c.key]:c.min}}),hi=render({...input,params:{[c.key]:c.max}});
  assert.notEqual(sha(pixels(lo)),sha(pixels(hi)),`${f.id}.${c.key} changes pixels`);assert(!/NaN|Infinity/.test(lo.svg+hi.svg));
  hairline(lo);hairline(hi);
 }
 const stages=[1,2,3,4].map(stage=>sha(pixels(render({...input,stage}))));assert.equal(new Set(stages).size,4,'four construction stages');
 for(const text of ['FU/BU','TY/PE','JOIN','ABCDEF/GHIJKL/MNOPQR/STUVWX','YZ']){
  const r=render({...input,text});assert.equal(r.glyphs.map(g=>g.character).join(''),text.replaceAll('/',''));assert(pixels(r).length>1000);
 }
 // Source letters: joined and pinched letters are single shapes without holes
 // (the P bowl is solid); flutes may split a letter but leave no specks.
 const topo=a.glyphs.map(g=>({character:g.character,...topology(g.outline)}));
 for(const t of topo){
  if(f.id==='fluted')assert(t.smallestOutline>400,`${f.id} ${t.character} leaves a speck`);
  else{assert.equal(t.outlines,1,`${f.id} ${t.character} is one piece`);assert.equal(t.holes,0,`${f.id} ${t.character} has no hole`);}
 }
 hairline(a);
 const full=new Resvg(a.svg,{fitTo:{mode:'height',value:3000}}).render();assert.equal(full.width,2004);assert.equal(full.height,3000);
 results.push({family:f.id,geometryPixelSHA256:hash,controls:CONTROLS.map(c=>c.key),stages:4,replay:'passed',textTransfer:'A–Z and three word probes',
  sourceTopology:Object.fromEntries(topo.map(t=>[t.character,{outlines:t.outlines,holes:t.holes}]))});
}
assert.equal(SOURCE_LAYERS[0].character,'P');assert.equal(SOURCE_LAYERS[0].cuts.length,0,'source P bowl is solid');
assert.equal(SOURCE_LAYERS.map(l=>l.character).join(''),'PUNKT');
assert(Object.keys(RECIPES).includes('Z'));
for(const bad of ['', '///','A'.repeat(25),'A/B/C/D/E','🌺','2026'])assert.throws(()=>normalize(bad));
assert.equal(normalize('café'),'CAFE');assert.equal(resolve({params:{fusion:Infinity}}).params.fusion,.78);
// v1 rules: seam and fusion changed meaning, so they fall back to the defaults.
const migrated=resolve({engine:'punkt-capsule-v1',params:{seam:.03,fusion:.2,roundness:.3}});
assert.equal(migrated.params.seam,4.2);assert.equal(migrated.params.fusion,.78);assert.equal(migrated.params.roundness,.3);assert.equal(migrated.engine,'punkt-capsule-v2');

// Fit: every format is filled edge to edge; frames stay inside it and cover it.
const fit=[];
for(const format of FORMATS)for(const text of ['PUNKT','TYPE','JOINED','PLAN/FORM','TYPE/LOOP']){
 const r=render({layout:'fit',format:format.id,text}),inner=(format.width-22)*(format.height-22);
 assert.equal(r.width,format.width);assert.equal(r.height,format.height);
 const frames=fitFrames(text,{width:format.width,height:format.height,margin:11});
 for(const f of frames)assert(f.x>=10.99&&f.y>=10.99&&f.x+f.w<=format.width-10.99&&f.y+f.h<=format.height-10.99,`${format.id} ${text} frame inside the format`);
 assert(frames.reduce((s,f)=>s+f.w*f.h,0)>=inner*.999,`${format.id} ${text} frames cover the format`);
 hairline(r);fit.push({format:format.id,text,rows:r.features.rows});
}
const punkt=fitFrames('PUNKT',{width:668,height:1000,margin:11});
assert.deepEqual([...new Set(punkt.map(f=>f.row))].map(row=>punkt.filter(f=>f.row===row).map(f=>f.character).join('')),['PU','N','KT'],'PUNKT breaks PU / N / KT');
assert(punkt[0].h>punkt[1].h*1.5,'P drops its stem into the next row');assert(punkt[2].x>punkt[0].x+1,'N is indented by the P stem');
const lifted=fitFrames('TYPE/LOOP',{width:668,height:1000,margin:11}),L=lifted.find(f=>f.character==='L');
assert(L.y<lifted[0].y+lifted[0].h-1,'L raises its stem into the row above');assert(lifted[0].x>L.x+1,'the row above is indented by the L stem');
assert.notEqual(render({layout:'fit'}).svg,render({}).svg,'fit is opt-in; PUNKT keeps its measured layout by default');

const report={status:'passed',environment:'Node + resvg on this Mac',families:results,fit,
 scope:'Exact SVG/pixel replay; three shape families under identical colours; every control; text transfer; source topology (single solid letters, solid P, no specks); a hairline between every pair of glyphs; fit frames inside and covering six formats with stem drops and rises; v1 rule migration; export size; invalid inputs.'};
fs.writeFileSync(new URL('../../output/punkt-capsule-study-v2/validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log('PASS: 3 families, 12 parameter changes, 4 stages each, replay/text/export checks, source topology, hairlines, fit in 6 formats.');
