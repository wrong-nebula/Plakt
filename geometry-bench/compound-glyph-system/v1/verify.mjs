import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,SETS,MASKS,CONTROLS,OPTIONS,PRIMITIVES,W,H,render,resolve,layout,layoutOf,levelsOf,token,activeControls,maskInside,normalizeText,normalizeLevels,specimen} from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=here.slice(0,here.indexOf('/geometry-bench/')),out=path.join(root,'output/compound-glyph-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are freed only by GC: run with --expose-gc (and a capped heap) so long runs stay small.
let rasters=0;const raster=(s,h=180)=>{if(++rasters%10===0)globalThis.gc?.();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render();};
const pixels=s=>hash(raster(render(s).svg).asPng()),svgOf=s=>hash(render(s).svg),t00=performance.now();
const step=name=>{globalThis.gc?.();console.log(`… ${name} (${((performance.now()-t00)/1000).toFixed(0)} s, rss ${(process.memoryUsage().rss/2**20).toFixed(0)} MB)`);};
// Pixel checks run on three contrasting styles; SVG checks run on all ten.
const PIXEL_STYLES=['forest','alarm','electro'];
const common=['#f0ece2','#1f2a44','#c4402f','#2f8f5a','#e0b62e','#111111'];

// Ten styles under one palette are still ten different systems.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'styles differ under one palette');
step('styles');
// Every control changes the poster wherever it is active; contexts make it active.
const CONTEXT={maskShift:{mask:'disc'},amount:{field:'radial'},curve:{field:'radial'},scale:{field:'noise'},sizeRange:{field:'radial'},heroScale:{params:{heroes:3}},strength:{flow:'radial'},angle:{params:{strength:.5}},oddScale:{params:{odd:2}}};
let controlChecks=0,pixelControlChecks=0,optionChecks=0,pixelOptionChecks=0;
for(const f of FAMILIES)for(const c of CONTROLS){const ctx=CONTEXT[c.key]??{},base={family:f.id,...ctx,params:{...ctx.params}};
 assert(activeControls(resolve(base)).includes(c.key),`${f.id} ${c.key} should be active in its context`);
 const lo={...base,params:{...base.params,[c.key]:c.min}},hi={...base,params:{...base.params,[c.key]:c.max}};assert.notEqual(svgOf(lo),svgOf(hi),`${f.id} ${c.key} min vs max`);controlChecks++;
 if(PIXEL_STYLES.includes(f.id)){assert.notEqual(pixels(lo),pixels(hi),`${f.id} ${c.key} min vs max pixels`);pixelControlChecks++;}}
step('controls');
// Every option value is distinct in every style (SVG), and in pixels for two styles.
const OCTX={face:{mask:'text',text:'TYPE'},font:{set:'o'},level:{set:'forest',params:{mix:0}},field:{params:{amount:.85}},flow:{params:{strength:.85}},colorMode:{colors:common},odd:{params:{odd:2}},set:{text:'MORI',custom:'o|O 日|月 森'},mask:{text:'MORI'}};
for(const f of FAMILIES)for(const [k,values] of Object.entries(OPTIONS)){const ctx=OCTX[k]??{},seen=new Set(values.map(v=>svgOf({family:f.id,...ctx,[k]:v})));assert.equal(seen.size,values.length,`${f.id} ${k}`);optionChecks+=values.length;
 if(['forest','electro'].includes(f.id)){assert.equal(new Set(values.map(v=>pixels({family:f.id,...ctx,[k]:v}))).size,values.length,`${f.id} ${k} pixels`);pixelOptionChecks+=values.length;}}
step('options');
// Four passes, exact replay, no state leaking between renders, seeds matter.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'TYPE/SYSTEM',mask:'text',params:{size:11,seed:321,heroes:2}},a=render(s);render({family:'beach',text:'NO',params:{size:40}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.notEqual(a.svg,render({...s,params:{...s.params,seed:322}}).svg);}

step('passes and replay');
// Packing: no two marks' discs overlap (blue noise without collisions); centres stay in the field box and out of type boxes.
let discPairs=0,marksChecked=0;
for(const f of FAMILIES)for(const extra of [{},{mask:'text',text:'TYPE/WITH/TYPE',params:{size:12}}]){const s=resolve({family:f.id,...extra}),lay=layout(s),L=layoutOf(s),cell=24,grid=new Map(),discs=[];
 lay.marks.forEach((m,i)=>{marksChecked++;assert(m.x>=L.field[0]&&m.x<=L.field[2]&&m.y>=L.field[1]&&m.y<=L.field[3],`${f.id} mark outside field`);for(const [a,b,c,d] of L.keep)assert(!(m.x>a&&m.x<c&&m.y>b&&m.y<d),`${f.id} mark inside a type box`);for(const q of m.discs)discs.push([...q,i]);});
 for(const [x,y,r,i] of discs){const k0=Math.floor(x/cell),k1=Math.floor(y/cell);for(let u=k0-6;u<=k0+6;u++)for(let v=k1-6;v<=k1+6;v++)for(const [x2,y2,r2,j] of grid.get(u+','+v)??[]){if(i===j)continue;const d=Math.hypot(x-x2,y-y2);assert(d>=r+r2-1e-6,`${f.id} discs of marks ${i} and ${j} overlap by ${(r+r2-d).toFixed(2)}`);discPairs++;}
  const key=k0+','+k1;(grid.get(key)??grid.set(key,[]).get(key)).push([x,y,r,i]);}}
step('packing');
// Escalation is visible: every level is used, and its driver rises with the level.
const escalation={};
for(const f of FAMILIES){const s=resolve({family:f.id}),lay=layout(s),N=levelsOf(s).length,by=Array.from({length:N},()=>[]);for(const m of lay.marks)if(!m.odd&&m.kind!=='hero')by[m.lv].push(m);
 assert(by.every(l=>l.length>0),`${f.id}: every level used (${by.map(l=>l.length)})`);const key={density:'d',edge:'sdf',size:'size'}[s.level];
 if(key){const means=by.map(l=>l.reduce((a,m)=>a+(s.params.inside<s.params.outside&&key==='sdf'?-m[key]:m[key]),0)/l.length);for(let i=1;i<N;i++)assert(means[i]>means[i-1],`${f.id}: mean ${key} rises with level (${means.map(v=>v.toFixed(2))})`);escalation[f.id]={by:s.level,counts:by.map(l=>l.length),means:means.map(v=>+v.toFixed(3))};}
 else escalation[f.id]={by:s.level,counts:by.map(l=>l.length)};}
step('escalation');
// Phone-size reading: at 300 px tall, mean ink inside the silhouette must differ clearly from ink outside it
// (type boxes excluded). Each style's own silhouette, and every style with a word or a kanji as the silhouette,
// as in the text-transfer board: words have thin strokes, so they must clear a higher bar than the presets.
const contrast=s=>{const img=raster(render(s).svg,300),P=img.pixels,M=maskInside(s),G=[1,3,5].map(i=>parseInt(s.colors[0].slice(i,i+2),16)),k=300/H,Lp=layoutOf(s),[x0,y0,x1,y1]=Lp.field;let inI=0,inN=0,outI=0,outN=0;
 for(let py=Math.ceil(y0*k);py<Math.floor(y1*k);py++)for(let px=Math.ceil(x0*k);px<Math.floor(x1*k);px++){if(Lp.keep.some(([a,b,c,d])=>px/k>a&&px/k<c&&py/k>b&&py/k<d))continue;const i=(py*img.width+px)*4,ink=(Math.abs(P[i]-G[0])+Math.abs(P[i+1]-G[1])+Math.abs(P[i+2]-G[2]))/765;
  const gx=Math.min(M.width-1,Math.floor(px/k/M.cell)),gy=Math.min(M.height-1,Math.floor(py/k/M.cell));if(M.ins[gy*M.width+gx]){inI+=ink;inN++;}else{outI+=ink;outN++;}}
 const a=inI/inN,b=outI/outN;return s.params.inside>=s.params.outside?a/Math.max(b,1e-3):b/Math.max(a,1e-3);};
const PHONE_PRESET=3,PHONE_WORD=5,phone={},phoneWords={};
for(const f of FAMILIES){if(f.set.mask!=='page')for(const stage of [3,4]){const r=contrast(resolve({family:f.id,stage}));phone[f.id+'-'+stage]=+r.toFixed(2);assert(r>=PHONE_PRESET,`${f.id} stage ${stage}: silhouette contrast ${r.toFixed(2)} at phone size`);}
 for(const [name,text,cap] of [['type','TYPE/WITH/TYPE',15],['kanji','水',22]]){const r=contrast(resolve({family:f.id,mask:'text',text,...(name==='kanji'?{face:'heavy'}:{}),params:{size:Math.min(f.set.params.size,cap)}}));phoneWords[f.id+'-'+name]=+r.toFixed(2);
  assert(r>=PHONE_WORD,`${f.id} with ${text} as the silhouette: contrast ${r.toFixed(2)} at phone size (needs ${PHONE_WORD})`);}}
step('phone contrast');
// Glyphs: every token of every set builds in every mark face; missing compounds are composed, never blank.
let tokens=0;const composed={};
for(const font of ['mincho','gothic','maru','script'])for(const set of SETS){for(const spec of levelsOf(resolve({family:'kanji',set:set.id,text:'MORI',font})).flat()){const t=token(spec,font);assert(t.d.length>20&&t.w>0&&t.h>0&&t.area>0,`${font} ${spec}`);tokens++;if(t.composed)(composed[font]??=new Set()).add(spec);}}
for(const ch of '吕沝众砳䡛')assert(composed.mincho.has(ch)&&!composed.gothic?.has(ch),`${ch}: composed in mincho, drawn in gothic`);
for(const p of PRIMITIVES)assert(token('@'+p,'gothic').d.length>10,p);
for(const f of FAMILIES)assert.equal(normalizeText(f.text),f.text,`${f.id} default text is valid`),assert.equal(normalizeLevels(f.custom),f.custom,`${f.id} custom levels are valid`);
// Every text and stage renders cleanly.
const texts=['森','RA/VE','TYPE/WITH/TYPE','peace','水','あいう','焱垚','A/B/C','Ｗｉｄｅ','1 2 3'];
for(const text of texts)for(const f of FAMILIES)for(const stage of [1,4]){const r=render({family:f.id,text,mask:'text',stage});assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${text} ${stage}`);assert(r.features.marks>8,`${f.id} ${text}: ${r.features.marks} marks`);}
for(const m of MASKS)for(const layoutId of OPTIONS.layout)assert(!/NaN|undefined|Infinity/.test(render({family:'riso',mask:m.id,layout:layoutId}).svg),`${m.id} ${layoutId}`);
for(const f of FAMILIES)assert(!/NaN|undefined|Infinity/.test(specimen({family:f.id})),`${f.id} specimen`);
step('glyphs and texts');
// Input handling.
assert.equal(normalizeText('type / with'),'type/with');assert.equal(normalizeText('ＲＡＶＥ'),'RAVE');assert.equal(normalizeText('  a   b '),'a b');assert.equal(normalizeText('it’s'),"it's");
for(const bad of ['','§','A<B','🌷','A/B/C/D','A//B','ABCDEFGHIJKLMNOPQRSTUVWXY','漢'])assert.throws(()=>normalizeText(bad),bad);
assert.equal(normalizeLevels('木 → 林 → 森'),'木 林 森');assert.equal(normalizeLevels('し | つ  い'),'し|つ い');assert.equal(normalizeLevels('@shell:1.2 @fig:2'),'@shell:1.2 @fig:2');
for(const bad of ['','@nope','@shell:9','1 2 3 4 5 6 7','abcdefghi','漢','a||b'])assert.throws(()=>normalizeLevels(bad),bad);
assert.equal(resolve({text:'§'}).text,FAMILIES[0].text);assert.equal(resolve({params:{size:Infinity}}).params.size,FAMILIES[0].set.params.size);assert.equal(resolve({params:{size:999}}).params.size,48);assert.equal(resolve({params:{heroes:2.6}}).params.heroes,3);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({mask:'bogus',family:'alarm'}).mask,'skull');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');assert.equal(resolve({engine:'other',family:'riso'}).engine,ENGINE);
globalThis.gc?.();const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'kanji',params:{size:12+i*.1}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg (machine shared with other jobs; timings are indicative)',checks:{commonPaletteStyles:FAMILIES.length,visibleControlChecks:`${controlChecks} (${CONTROLS.length} controls × ${FAMILIES.length} styles, each active in its context, min vs max SVG differ; ${pixelControlChecks} also in pixels for ${PIXEL_STYLES.join(', ')})`,optionValues:`${optionChecks} SVG-distinct across all styles; ${pixelOptionChecks} pixel-distinct in two styles`,distinctPassesPerStyle:4,replay:'exact SVG A/B/A and saved JSON; seed changes the field',packing:`${marksChecked} marks in ${FAMILIES.length*2} layouts; ${discPairs} neighbouring disc pairs, none overlapping; centres inside the field box and outside type boxes`,escalation,phoneSilhouetteContrast:{thresholds:{preset:PHONE_PRESET,word:PHONE_WORD},presets:phone,words:phoneWords},tokens:`${tokens} set tokens in four mark faces; 吕沝众砳䡛 composed from radicals in faces that lack them`,textProbes:`${texts.length} words × ${FAMILIES.length} styles × 2 passes as the silhouette; ${MASKS.length} silhouettes × ${OPTIONS.layout.length} layouts; specimens; no NaN`,invalidInputs:'empty, unsupported characters, markup, four rows, empty rows, 25 characters; custom levels: unknown primitives, bad lengths, seven levels, long tokens, empty alternatives; parameter, colour, option and stage bounds',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},
 limitations:'Checks verify construction, packing and readability proxies, not similarity to the source posters. Header and information lines use system fonts (titles use bundled outlines), so they vary between machines. The phone check measures mean ink contrast, not recognisability.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls (${pixelControlChecks} in pixels), ${optionChecks} option values (${pixelOptionChecks} in pixels), 4 passes, replay, ${marksChecked} marks packed without overlap, escalation, phone contrast ≥ ${Math.min(...Object.values(phone)).toFixed(1)} (presets), ≥ ${Math.min(...Object.values(phoneWords)).toFixed(1)} (word silhouettes), ${tokens} tokens, inputs, export. Render ${renderMs} ms.`);
