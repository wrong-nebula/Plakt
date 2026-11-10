import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {SYSTEMS,ALPHABET,renderPoster,resolveState,normalizeText} from './engine.mjs';

const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const raster=r=>new Resvg(r.svg,{fitTo:{mode:'width',value:350}}).render().asPng();
const checks=[],seen=new Set();
for(const system of SYSTEMS){
 const input={system:system.id,text:'FU/BU',seed:'817'};
 const a=renderPoster(input);renderPoster({...input,text:'TY/PE',seed:'991'});const again=renderPoster(input);
 assert.equal(a.svg,again.svg,'A/B/A geometry replay');
 assert.equal(sha(raster(a)),sha(raster(again)),'same-machine resvg pixel replay');
 assert.deepEqual(renderPoster(JSON.parse(JSON.stringify(a.state))).state,a.state,'portable state replay');
 const pixelHash=sha(raster(a));assert(!seen.has(pixelHash),'unique system pixels');seen.add(pixelHash);
 const controls=[];
 for(const control of system.controls){
  const lo=renderPoster({...input,params:{[control.key]:control.min}}),hi=renderPoster({...input,params:{[control.key]:control.max}});
  assert.notEqual(sha(raster(lo)),sha(raster(hi)),`${system.id}.${control.key} visibly changes pixels`);
  assert(!/NaN|Infinity/.test(lo.svg+hi.svg),'finite SVG');controls.push(control.key);
 }
 // The whole supported alphabet transfers; rendering is not hard-coded FUBU.
 for(const text of ['ABCDEF/GHIJKL/MNOPQR/STUVWX/YZ0123/456789','TY/PE','A','F U/B U']){
  const r=renderPoster({...input,text});assert.equal(r.panels.map(p=>p.character).join(''),text.replaceAll('/',''));
  assert(!/NaN|Infinity/.test(r.svg));assert(raster(r).length>1000);
 }
 const large=new Resvg(a.svg,{fitTo:{mode:'width',value:1400}}).render();assert.equal(large.width,1400);assert.equal(large.height,2000);
 checks.push({system:system.id,controls,pixelSHA256:pixelHash,replay:'passed',textTransfer:'all A-Z and 0-9 plus spaces',exports:'350px and 1400px rasterised from same vectors'});
}
for(const text of ['', '///','🌸','你好','A'.repeat(37),'A/'+ '/'.repeat(8)])assert.throws(()=>normalizeText(text));
assert.equal(normalizeText('café'),'CAFE');
assert.equal(resolveState({system:'scallop',params:{depth:Infinity}}).params.depth,.46);
for(const [ch,rows] of Object.entries(ALPHABET))assert(rows.length===7&&rows.every(r=>/^[01]{5}$/.test(r)),ch);
const report={scope:'Node + resvg on this Mac. Exact SVG and pixel replay, parameter sensitivity, all supported characters, finite geometry and raster dimensions. No native Swift renderer was changed.',checks,systems:seen.size,controlsChecked:checks.reduce((n,c)=>n+c.controls.length,0),status:'passed'};
fs.writeFileSync(new URL('../../output/experimental-letter-systems-v1/validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log(`PASS: ${seen.size} distinct systems; 12 visible control changes; A/B/A and JSON replay; A-Z/0-9 transfer; size and invalid-input checks.`);
