import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,FORMATS,render,resolve,normalizeText,specimen,separations,letterMask,applies} from './engine.mjs';
import {FONTS} from './fonts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/rule-field-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect regularly (run with --expose-gc).
let rendered=0;const raster=(s,h=260)=>{if(++rendered%25===0)globalThis.gc?.();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const common=['#f2efe8','#15121c','#d0263a','#2a6be0'];

// Every style distinct under one palette.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length);
// Each control is tried where it applies, in styles covering every field and pen; circular controls are compared with their midpoint.
const CONTEXT={angle:{geometry:'parallel'},cx:{geometry:'rings'},cy:{geometry:'rings'},arms:{geometry:'spiral'},squareness:{geometry:'rings'},aspect:{geometry:'rings'},
 waveLen:{params:{waveAmp:.5}},wavePhase:{params:{waveAmp:.5}},warpScale:{params:{warp:2}},seed:{params:{warp:2}},pinch:{geometry:'parallel',text:'AB/CD',params:{reach:80}},reach:{geometry:'parallel',text:'AB/CD',params:{pinch:1}},spread:{geometry:'parallel',text:'AB/CD',params:{pinch:1,reach:80}},
 cross:{second:'everywhere',geometry:'parallel'},secondPitch:{second:'everywhere'},insidePhase:{inside:'rules',params:{insideAmp:.5,waveAmp:.5}},insideFreq:{inside:'rules',params:{insideAmp:.5}},insideWeight:{inside:'rules'},insideAmp:{inside:'rules'},shift:{inside:'rules'},
 feather:{inside:'rules',params:{shift:1.5}},dash:{pen:'dash'},duty:{pen:'dash'},tracking:{text:'AB/CD',fill:'fit'},leading:{text:'AB/CD'}};
const CIRCULAR=['angle','wavePhase','insidePhase'],CONTROL_STYLES=['wobble','gap','relief','groove','contour','halftone'];
let controlChecks=0,optionChecks=0;
for(const id of CONTROL_STYLES)for(const c of CONTROLS){const ctx=CONTEXT[c.key]??{},s=v=>({family:id,...ctx,params:{...ctx.params,[c.key]:v}}),hi=CIRCULAR.includes(c.key)?(c.min+c.max)/2:c.max;
 assert(applies(c,resolve(s(c.min))),`${id} ${c.key}: context does not enable the control`);assert.notEqual(pixels(s(c.min)),pixels(s(hi)),`${id} ${c.key}`);controlChecks++;}
// Every module value is visible. The complement field always equals one explicit field, and the edge treatments only show on a shift or a cut.
const OPT={wave:{params:{waveAmp:.5}},profile:{params:{feather:20,shift:1.5},inside:'rules'},pen:{params:{waveAmp:.5}},ink:{colors:common,inside:'rules'},ground:{colors:common},under:{colors:common},fill:{text:'AB/CDE'},font:{text:'AB'},
 second:{inside:'gap'},secondField:{second:'everywhere'},secondInk:{second:'everywhere',colors:common}};
for(const id of ['wobble','gap','rings','moire']){for(const [k,all] of Object.entries(OPTIONS)){if(k==='jogs')continue;const values=k==='secondField'?all.filter(v=>v!=='auto'):all,ctx={family:id,...OPT[k]};
  assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,values.length,`${id} ${k}`);optionChecks+=values.length;}
 const shift={family:id,inside:'rules',params:{shift:.5,feather:0}},cut={family:id,inside:'gap',params:{feather:0}};
 assert.notEqual(pixels({...shift,jogs:'open'}),pixels({...shift,jogs:'connect'}),`${id} connect`);assert.notEqual(pixels({...cut,jogs:'open'}),pixels({...cut,jogs:'ticks'}),`${id} ticks`);optionChecks+=4;}

// Four passes, exact replay, and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'TYPE/42',params:{pitch:9,waveAmp:.2,shift:.4,feather:6,insideWeight:1.5}},a=render(s);render({family:'moire',text:'NOISE'});
 assert.equal(a.svg,render(s).svg,f.id);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg,f.id);}

// Hard cuts sit exactly on the outline: in plotter centrelines (no mask) every point of a cut rule is outside the
// letters by the exact winding test, or has the outside within 1.2 px, and in the poster no rule ink shows inside a cut letter (or outside it, for inside-only fields), across
// fields, faces, pitches and copy.
// Inked pixels and centreline points only count as faults when the exact winding test puts them on the wrong side
// and their exact distance to the outline is over the tolerance (1.5 px for pixels, 1.2 px for centrelines).
const centrelines=svg=>[...svg.matchAll(/<path d="([^"]+)" fill="none" stroke="[^"]*"[^>]*data-ink/g)].flatMap(m=>[...m[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(v=>[+v[1],+v[2]]));
const wrong=(m,x,y,side,tol)=>m.inside(x,y)===(side>0)&&m.distance(x,y)>tol;
const inkInside=(s,side)=>{const t={...s,stage:4,band:'none',under:'none',ink:'solid',ground:'plain',colors:['#ffffff','#ff0000','#ffffff','#ff0000']},m=letterMask(t),img=new Resvg(render(t).svg).render(),px=img.pixels;let bad=0,tot=0;
 for(let y=1;y<img.height;y+=2)for(let x=1;x<img.width;x+=2){const d=m.sd(x+.5,y+.5)*side;if(d>2.5){tot++;if(px[(y*img.width+x)*4+1]<160&&wrong(m,x+.5,y+.5,side,1.5))bad++;}}return {bad,tot};};
const stray=(m,v,side)=>v.filter(([x,y])=>wrong(m,x,y,side,1.2)).length;
let cutCases=0,cutVertices=0,cutPixels=0;
for(const [geometry,extra] of [['parallel',{}],['rings',{}],['rings',{squareness:1,aspect:.7}],['rays',{}],['spiral',{arms:2}]])for(const [font,text] of [['archivo','RULE'],['bodoni','Fête'],['mono','AB/12'],['anton','KM&?']])for(const pitch of [5,13]){
 const s={family:'gap',geometry,font,text,stage:3,params:{pitch,feather:0,...extra}},m=letterMask(s),v=centrelines(render(s,{output:'plotter'}).svg),deep=stray(m,v,1);
 assert(deep===0,`${geometry} ${font} ${text} ${pitch}: ${deep} centreline points more than 1.2 px inside`);const {bad,tot}=inkInside(s,1);assert(bad===0&&tot>500,`${geometry} ${font} ${text} ${pitch}: ${bad} inked pixels inside`);cutCases++;cutVertices+=v.length;cutPixels+=tot;}
for(const geometry of ['parallel','rings','rays','spiral']){const s={family:'swell',geometry,outside:'gap',stage:3,params:{feather:0,insideWeight:1}},m=letterMask(s),v=centrelines(render(s,{output:'plotter'}).svg);
 assert(stray(m,v,-1)===0,`${geometry} inside-only: centreline points more than 1.2 px outside`);const {bad,tot}=inkInside(s,-1);assert(bad===0&&tot>500,`${geometry} inside-only: ${bad} inked pixels outside`);cutCases++;cutPixels+=tot;}
// Unbroken rings stay full rings (each loop spans its radius), and every ring is drawn.
{const r=render({family:'rings',stage:2}),d=r.svg.match(/<path d="([^"]+)" fill/)[1],loops=d.split('M').filter(Boolean).map(s=>{const xs=[...s.matchAll(/(-?[\d.]+) -?[\d.]+/g)].map(m=>+m[1]);return (Math.max(...xs)-Math.min(...xs))/2;});
 assert.equal(loops.length,2*r.features.rules);assert(loops.every(h=>h>=4.5*.5),'collapsed ring');}
// Contour rules lie on their distance levels: every centreline vertex is within 1.6 px of a level (pitch/2 + k·pitch from the outline).
{const s={family:'contour',stage:3,params:{waveAmp:0,shift:0}},m=letterMask(s),P=resolve(s).params.pitch,pts=[...render(s,{output:'plotter'}).svg.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(v=>[+v[1],+v[2]]).filter(([x,y])=>x>8&&y>8&&x<720&&y<930);
 const off=pts.map(([x,y])=>{const t=(m.sd(x,y)-P/2)/P;return Math.abs(t-Math.round(t))*P;});assert(pts.length>500&&Math.max(...off)<1.6,`contour level error ${Math.max(...off).toFixed(2)}`);}
// Dot screens carry the letters by dot size: dots inside the letters are more than twice as large as those outside.
{const s={family:'halftone',stage:3},m=letterMask(s),dots=[...render(s).svg.matchAll(/M(-?[\d.]+) (-?[\d.]+)a([\d.]+)/g)].map(d=>({x:+d[1]+ +d[3],y:+d[2],r:+d[3]})),mean=a=>a.reduce((s,d)=>s+d.r,0)/a.length;
 const inside=dots.filter(d=>m.sd(d.x,d.y)>8),outside=dots.filter(d=>m.sd(d.x,d.y)<-8);assert(inside.length>100&&outside.length>100&&mean(inside)>2*mean(outside),'dot sizes');}
// Separations are pure black on white, one sheet per ink; plotter files are strokes only.
let sepSheets=0;for(const f of FAMILIES){const seps=separations({family:f.id}),r=render({family:f.id});assert.equal(seps.length,r.inks.length,f.id);
 for(const s of seps){assert(!/(fill|stroke)="#(?!000000|ffffff)[0-9a-f]{6}"/.test(s.svg)&&!/url\(#[gi]/.test(s.svg),`${f.id} ${s.ink} has colour`);assert(/fill="#000000"|stroke="#000000"/.test(s.svg),`${f.id} ${s.ink} is empty`);sepSheets++;}
 const p=render({family:f.id},{output:'plotter'}).svg;assert(!/<path[^>]*fill="(?!none)[^"]*"[^>]*data-ink/.test(p)&&/stroke-width/.test(p),`${f.id} plotter`);}

// Every glyph of every face renders cleanly in every field; every style in every format.
let glyphs=0;for(const [id,font] of Object.entries(FONTS)){const chars=Object.keys(font.glyphs).filter(c=>c!==' '&&c!=='/');for(let i=0;i<chars.length;i+=10){const text=chars.slice(i,i+10).join('');
 for(const geometry of OPTIONS.geometry){const r=render({family:'gap',font:id,text,geometry,stage:3});assert(!/NaN|undefined|Infinity/.test(r.svg),`${id} ${text} ${geometry}`);}glyphs+=text.length;}}
for(const f of FAMILIES){assert(!/NaN|undefined/.test(specimen({family:f.id})));for(const format of Object.keys(FORMATS))assert(!/NaN|undefined|Infinity/.test(render({family:f.id,format}).svg),`${f.id} ${format}`);}

// Input handling.
assert.equal(normalizeText('type / system','archivo'),'type/system');assert.equal(normalizeText('ab\ncd','archivo'),'ab/cd');assert.throws(()=>normalizeText('ＡＢ','archivo','x'));assert.equal(normalizeText('','archivo','x'),'x');assert.equal(resolve({text:'ＡＢ'}).text,FAMILIES[0].text);assert.equal(normalizeText('it’s','archivo'),"it's");
for(const bad of ['','€uro','A/B/C/D/E/F/G','A//B','ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNO','<b>'])assert.throws(()=>normalizeText(bad,'archivo'),bad);
assert.equal(resolve({text:'€'}).text,FAMILIES[0].text);assert.equal(resolve({params:{pitch:999}}).params.pitch,90);assert.equal(resolve({params:{margin:2.6}}).params.margin,3);assert.equal(resolve({params:{shift:NaN}}).params.shift,FAMILIES[0].set.params.shift);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({geometry:'bogus',family:'rings'}).geometry,'rings');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');
// Rules saved before the modules existed (v1) still open, with the new modules at their defaults.
const v1={engine:'rule-field-v1',family:'gap',text:'OLD',second:'none',params:{pitch:12}};assert.equal(resolve(v1).params.pitch,12);assert.equal(resolve(v1).pen,'flat');assert(!/NaN/.test(render(v1).svg));
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(728*3000/1030));assert.equal(full.readUInt32BE(20),3000);
const timing={};for(const f of FAMILIES){render({family:f.id});const t0=performance.now();for(let i=0;i<2;i++)render({family:f.id,params:{pitch:f.set.params.pitch+i*.5}});timing[f.id]=+((performance.now()-t0)/2).toFixed(0);}
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteStyles:FAMILIES.length,visibleControlChecks:`${controlChecks} (every control in ${CONTROL_STYLES.length} styles covering every field and pen)`,visibleOptionValues:optionChecks,distinctPassesPerStyle:4,replay:'exact SVG, A/B/A and saved JSON for every style',
 exactCuts:`${cutCases} cut fields (parallel, rings, boxes, rays, spiral; four faces; two pitches; inside-only): ${cutVertices} centreline vertices all outside the letters or within 1.2 px of the outline (exact winding test), and none of ${cutPixels} sampled pixels inside a cut letter shows rule ink more than 1.5 px from the outline (exact winding test)`,rings:'every plain-field ring drawn as a full annulus',contours:'every contour centreline vertex within 1.6 px of its distance level',dots:'halftone dots inside the letters more than twice the size of those outside',
 outputs:`${sepSheets} separation sheets, black on white, one per ink, for ${FAMILIES.length} styles; plotter files are strokes only`,glyphs:`${glyphs} glyphs across ${Object.keys(FONTS).length} faces in all ${OPTIONS.geometry.length} fields`,formats:`${Object.keys(FORMATS).length} formats × ${FAMILIES.length} styles`,
 invalidInputs:'empty, unsupported characters, markup, seven rows, empty rows, 41 characters; parameter, colour, option and stage bounds; v1 rules',png:[Math.round(728*3000/1030),3000],renderMs:timing},
 limitations:'Checks verify construction and edge accuracy, not similarity to the source posters. Information text uses system fonts. Glyph parts thinner than the sampling step can be skipped by a rule. Rainbow inks separate into one sheet per hue step.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls, ${optionChecks} option values, 4 stages, replay, ${cutCases} exact-cut cases (${cutVertices} vertices, ${cutPixels} pixels), rings, contours, dots, ${sepSheets} separations, ${glyphs} glyphs × ${OPTIONS.geometry.length} fields, ${Object.keys(FORMATS).length} formats, inputs, export. Render ms: ${JSON.stringify(timing)}`);
