import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,W,H,render,resolve,normalizeText,glyphFor,oklch,specimen} from './engine.mjs';
import {FONTS} from './fonts.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/spectral-echo-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect regularly (run with --expose-gc).
let rendered=0;const raster=(s,h=420)=>{if(++rendered%25===0)globalThis.gc?.();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();};
const pixels=s=>hash(raster(render(s).svg));
const common=['#15121c','#f2efe8','#3a2a55'];

// Seven styles under one palette; every control and option visible in every style.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length);
// Each control is tried where it applies: band controls in the sliced smear,
// stretch/turn/easing in linear echoes, tracking and row spacing on two-row Latin text.
const CONTEXT={angle:{params:{spread:.5}},stretchX:{mode:'linear'},stretchY:{mode:'linear'},rotate:{mode:'linear'},curve:{mode:'linear',params:{spread:.6,count:8}},slices:{mode:'slices'},smear:{mode:'slices'},waves:{mode:'slices'},tracking:{text:'AB/CD',font:'archivo'},leading:{text:'AB/CD',font:'archivo'},spread:{mode:'linear'}};
let controlChecks=0,optionChecks=0;
// Direction, hue and turn are circular (0° = 360°, −180° = 180°), so they are compared with their midpoint.
for(const f of FAMILIES){for(const c of CONTROLS){const ctx=CONTEXT[c.key]??{},s=v=>({family:f.id,...ctx,params:{...ctx.params,[c.key]:v}}),hi=['angle','hue','rotate'].includes(c.key)?(c.min+c.max)/2:c.max;assert.notEqual(pixels(s(c.min)),pixels(s(hi)),`${f.id} ${c.key}`);controlChecks++;}
 const OPT={anchor:{mode:'linear',text:'AB/CD',font:'archivo',params:{rotate:40,stretchX:.6}},style:{mode:'linear'},font:{text:'AB'},layout:{text:'AB/CD',font:'archivo'},blend:{mode:'linear',params:{opacity:.9,count:8,spread:.5}}};
 for(const [k,values] of Object.entries(OPTIONS)){const ctx={family:f.id,...OPT[k]};assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}}
// Four passes, exact replay, and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'TYPE/光',params:{count:9,spread:.4,angle:33,stretchX:.3,rotate:12,hue:120,range:-200,glow:1.4}},a=render(s);render({family:'smear',text:'NOISE'});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);}

// Drawing order: echoes first, the core last, so copies always sit behind the glyph.
for(const f of FAMILIES.filter(f=>f.set.core!=='none')){const svg=render({family:f.id}).svg,g=svg.lastIndexOf('<g><use');assert(g>0&&svg.slice(0,g).includes('opacity='),f.id);assert(!svg.slice(g).includes('opacity='),`${f.id}: an echo is drawn above the core`);}
// Every glyph of every face renders cleanly; Japanese falls back to Hiragino in Latin faces.
let glyphs=0;for(const [id,font] of Object.entries(FONTS)){const chars=Object.keys(font.glyphs).filter(c=>c!==' ');for(let i=0;i<chars.length;i+=12){const text=chars.slice(i,i+12).join('').replace(/\//g,'');if(!text)continue;
 const r=render({family:'trail',font:id,text,stage:3});assert(!/NaN|undefined|Infinity/.test(r.svg),`${id} ${text}`);glyphs+=[...text].length;}}
assert.equal(glyphFor('光','archivo').font,'hiragino');assert.equal(render({family:'trail',text:'光A'}).features.glyphs,2);
for(const f of FAMILIES)for(const stage of [1,2,3,4])for(const text of ['雨/木','ONE','TYPE/SYSTEM','2026','A/B/C/D/E','東京!'])assert(!/NaN|undefined|Infinity/.test(render({family:f.id,text,stage}).svg),`${f.id} ${text} ${stage}`);
for(const f of FAMILIES)assert(!/NaN|undefined/.test(specimen({family:f.id})));

// Colour: the OKLCH ramp always lands inside sRGB, and a three-copy split at a 360° walk gives red, green and blue.
for(let h=0;h<360;h+=7.5)for(const [L,C] of [[.5,.37],[.72,.2],[.9,.3]])assert.match(oklch(L,C,h),/^#[0-9a-f]{6}$/);
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),primaries=[29,149,269].map(h=>rgb(oklch(.64,.3,h)));assert.deepEqual(primaries.map(c=>c.indexOf(Math.max(...c))),[0,1,2]);

// Input handling.
assert.equal(normalizeText('type / system','archivo'),'type/system');assert.equal(normalizeText('ＡＢ','archivo'),'AB');assert.equal(normalizeText('ﾃｸﾉ','archivo'),'テクノ');assert.equal(normalizeText('it’s','archivo'),"it's");
for(const bad of ['','€uro','A/B/C/D/E/F','A//B','ABCDEFGHIJKLMNOPQRSTUVWXY','<b>'])assert.throws(()=>normalizeText(bad,'archivo'),bad);
assert.equal(resolve({text:'€'}).text,FAMILIES[0].text);assert.equal(resolve({params:{count:999}}).params.count,64);assert.equal(resolve({params:{count:2.6}}).params.count,3);assert.equal(resolve({params:{hue:NaN}}).params.hue,FAMILIES[0].set.params.hue);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({mode:'bogus',family:'split'}).mode,'radial');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'bloom',params:{count:26+i}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteStyles:FAMILIES.length,visibleControlChecks:controlChecks,visibleOptionValues:optionChecks,distinctPassesPerStyle:4,replay:'exact SVG, A/B/A and saved JSON',drawingOrder:'every echo precedes the core glyph',glyphs:`${glyphs} glyphs across ${Object.keys(FONTS).length} faces; Japanese fallback in Latin faces`,colour:'OKLCH ramp in sRGB gamut; three-copy split lands on red, green and blue',invalidInputs:'empty, unsupported characters, markup, six rows, empty rows, 25 characters; parameter, colour, option and stage bounds',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},limitations:'Checks verify construction, order and colour, not similarity to Katsui’s or Sato’s artwork. Header text uses system fonts. Hiragino outlines are a local-study subset.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls, ${optionChecks} option values, 4 stages, replay, drawing order, ${glyphs} glyphs, colour gamut and primaries, inputs, ${Math.round(W*3000/H)} × 3000 export. Render ${renderMs} ms.`);
