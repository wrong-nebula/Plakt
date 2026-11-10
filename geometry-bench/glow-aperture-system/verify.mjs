import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import * as V1 from './v1/engine.mjs';
import {ENGINE,V1_ENGINE,FAMILIES,CONTROLS,OPTIONS,OPTION_USES,RAMPS,SHAPES,FORMATS,render,resolve,apertures,isV1,specimen,normalizeWord,normalizePath,rampAt,profile} from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/glow-aperture-study-v2'),v1out=path.join(root,'output/glow-aperture-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only released by garbage collection; collect every 25 rasters (run with --expose-gc).
// img.pixels copies the whole buffer on every access, so each raster reads it once.
let rasters=0;const raster=(svg,long=200)=>{if(++rasters%25===0)globalThis.gc?.();const r=new Resvg(svg,{fitTo:{mode:'height',value:long}}).render();return {w:r.width,h:r.height,px:r.pixels};};
const pixels=(s,long)=>hash(raster(render(s).svg,long).px);
const at=(r,x,y)=>{const i=(Math.round(y)*r.w+Math.round(x))*4;return [r.px[i],r.px[i+1],r.px[i+2]];};
const near=(a,b,t)=>a.every((v,k)=>Math.abs(v-b[k])<=t),rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const calm=FAMILIES.filter(f=>f.calm),old=FAMILIES.filter(f=>!f.calm);

// 1. Version 1 stays frozen: its output folder still matches the manifest recorded at the freeze,
//    every saved v1 rule renders byte-identically in v2, and the v2 code path draws v1 states pixel-identically.
const manifest=JSON.parse(fs.readFileSync(path.join(here,'v1/output-manifest.json')));let frozen=0;
for(const [f,h] of Object.entries(manifest.sha256)){assert.equal(hash(fs.readFileSync(path.join(v1out,f))),h,`v1 output changed: ${f}`);frozen++;}
const listed=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true}))e.isDirectory()?walk(path.join(d,e.name)):listed.push(path.relative(v1out,path.join(d,e.name)));};walk(v1out);assert.equal(listed.length,frozen,'v1 output gained or lost files');
let v1Rules=0;
for(const f of listed.filter(f=>f.endsWith('.json')&&!/(^|\/)(catalog|source|validation|browser-validation)\.json$/.test(f))){const rule=JSON.parse(fs.readFileSync(path.join(v1out,f)));assert.equal(rule.engine,V1_ENGINE);
 assert.equal(render(rule).svg,fs.readFileSync(path.join(v1out,f.replace(/\.json$/,'.svg')),'utf8'),`v1 rule ${f} differs in v2`);v1Rules++;}
let continuity=0;for(const f of old)for(const stage of [1,2,3,4]){assert(isV1(resolve({family:f.id,stage})),`${f.id} default should be drawn by v1`);
 assert.equal(hash(raster(V1.render({family:f.id,stage}).svg).px),hash(raster(render({family:f.id,stage},{v2:true}).svg).px),`v2 code path differs from v1: ${f.id} stage ${stage}`);continuity++;}
// A v1 rule opened in v2 becomes a v2 state with every new feature off, and saving it back replays the same picture.
{const r=JSON.parse(fs.readFileSync(path.join(v1out,'club.json'))),s=resolve(r);assert.equal(s.engine,ENGINE);assert(isV1(s));assert.equal(render(JSON.parse(JSON.stringify(s))).svg,render(r).svg);}

// 2. Styles: 21 distinct, every pass renders, formats are the right size.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id}))).size,FAMILIES.length,'styles distinct');
for(const f of FAMILIES)for(const stage of [1,2,3,4]){const r=render({family:f.id,stage});assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${stage}`);assert.deepEqual([r.width,r.height],FORMATS[r.state.format]);}
for(const f of calm)assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);

// 3. Controls: each changes every style wherever it is read, and leaves it unchanged where it is not.
const CTX={spacing:{params:{count:3}},seed:{params:{sparkles:40}},depth:{series:'none',params:{count:3}},slat:{params:{blinds:8}},spread:{mode:'shadow',params:{lights:2}},lights:{mode:'shadow'},rim:{mode:'shadow'},steps:{finish:'steps'},dot:{finish:'halftone'},misregister:{finish:'riso'},phase:{shape:'moon',series:'none'},panels:{series:'turn'}};
const ENDS={angle:[0,180],rotate:[0,45]};const NEW=new Set(['phase','blinds','slat','depth','lights','spread','rim','steps','dot','misregister','paper','panels']);let changed=0,inert=0;
const withCtx=(f,c,v,ctx)=>({family:f.id,...ctx,params:{...(ctx?.params??{}),[c.key]:v}});
// Control checks raster at 320 px: some effects are sub-pixel at 200 (the bloom drift of a 6-unit falloff is under one pixel there).
const CPX=320;
for(const f of FAMILIES)for(const c of CONTROLS){if(!f.calm&&!NEW.has(c.key))continue;const [lo,hi]=ENDS[c.key]??[c.min,c.max];
 const plain=resolve({family:f.id});if(c.uses&&!c.uses(plain)){assert.equal(pixels(withCtx(f,c,lo),CPX),pixels(withCtx(f,c,hi),CPX),`${f.id} ${c.key} should be inert`);inert++;}
 const ctx=CTX[c.key];if(c.uses)assert(c.uses(resolve(withCtx(f,c,hi,ctx))),`${f.id} ${c.key} context`);assert.notEqual(pixels(withCtx(f,c,lo,ctx),CPX),pixels(withCtx(f,c,hi,ctx),CPX),`${f.id} ${c.key}`);changed++;}
// 4. Options: every value distinct (all options on the calm styles, the v2 options and values on the v1 styles); conditional ones inert elsewhere.
const NEWOPT={aperture:null,finish:null,format:null,series:null,lockup:null,type:null,face:null,shape:['rect','moon','stairs','window','tree','mountain','standing','word','custom'],layout:['centred','grid'],sparkle:['dots','dust']};let values=0,inertOpts=0;
for(const f of FAMILIES)for(const [k,all] of Object.entries(OPTIONS)){if(!f.calm&&!(k in NEWOPT))continue;const vals=f.calm?all:(NEWOPT[k]??all);
 const base={family:f.id,...(k==='sparkle'?{params:{sparkles:60}}:{}),...(k==='core'?{colors:[...f.colors.slice(0,2),'#c2412d',f.colors[3]]}:{}),...(k==='ground'?{colors:[f.colors[0],'#7a6a50',...f.colors.slice(2)]}:{}),...(k==='face'?{word:'LIGHT'}:{})};
 const uses=OPTION_USES[k];if(uses&&!uses(resolve(base))){assert.equal(new Set(vals.map(v=>pixels({...base,[k]:v},160))).size,1,`${f.id} ${k} should be inert`);inertOpts++;Object.assign(base,{ground:{mode:'field'},face:{shape:'word',series:'none'},copy:{lockup:'auto',series:'none'},shape:{series:'none'}}[k]);}
 assert.equal(new Set(vals.map(v=>pixels({...base,[k]:v},160))).size,vals.length,`${f.id} ${k}`);values+=vals.length;}
assert.equal(new Set(RAMPS.map(r=>pixels({family:'lantern',ramp:r.stops},160))).size,RAMPS.length,'ramp presets');

// 5. Shapes: the new silhouettes fill their probe points in every layout; words and paths put light inside their boxes.
// Probes sit on the stage-1 mask; only a probe on the light-angle arrow (from the first aperture's centre, up) is nudged aside.
let probes=0;const NEWSHAPES=['moon','stairs','window','tree','mountain','standing'];
for(const shape of NEWSHAPES)for(const layout of OPTIONS.layout)for(const count of [1,3]){const s={family:'phases',series:'none',shape,layout,stage:1,params:{count,angle:90,rotate:0,offset:0,fray:0,layers:1,blinds:0}},img=raster(render(s).svg,1030);
 const aps=apertures(resolve(s)),c0=aps[0].c;for(const a of aps){const [x0,y]=a.probe,x=x0+(Math.abs(x0-c0[0])<5&&y<=c0[1]+4&&y>=c0[1]-100?7:0);if(x<2||x>720||y<2||y>1028)continue;assert(near(at(img,x,y),[255,255,255],1),`${shape} ${layout} ×${count} probe ${at(img,x,y)}`);probes++;}}
for(const s of [{shape:'word',word:'光'},{shape:'word',word:'LIGHT',face:'serif'},{shape:'word',word:'夢/心',face:'gothic'},{shape:'custom',path:'50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38'},{shape:'custom'}]){const st={family:'lantern',stage:1,...s},img=raster(render(st).svg,1030),[a]=apertures(resolve(st)),[x,y,w,h]=a.fit;let lit=0,k=0;
 for(let j=0;j<40;j++)for(let i=0;i<40;i++){if(at(img,x+w*(i+.5)/40,y+h*(j+.5)/40)[0]>200)lit++;k++;}assert(lit/k>.08&&lit/k<.97,`${JSON.stringify(s)} lit ${lit/k}`);probes++;}
assert.equal(normalizeWord('光と影'),'光と');assert.equal(normalizeWord('  light / hours '),'light/hours');assert.equal(normalizeWord('<>'),'');assert.equal(resolve({family:'lantern',word:'💡'}).word,'光');
assert.equal(normalizePath('0,0 10,0 10,10'),'M0 0L10 0 10 10Z');assert.equal(normalizePath('javascript:alert(1)'),null);assert.equal(normalizePath('M0 0L10 0'),null);assert.equal(normalizePath('M0 0 L1 2 Q 3'),null);assert.equal(resolve({family:'lantern',path:'<script>'}).path,resolve({family:'lantern'}).path);

// 6. Finishes: steps posterise, halftone is two inks, riso misregisters, paper adds fibre; the gradient map still ends where v1's does.
const ray=(s,y)=>{const img=raster(render(s).svg,1030),seen=new Set();for(let x=20;x<708;x++)seen.add(at(img,x,y).join());return seen.size;};
{const s={family:'moon',stage:3,shape:'circle',finish:'steps',params:{steps:6,haze:0}};assert(ray(s,500)<=6+4,`steps ${ray(s,500)}`);assert(ray({...s,finish:'smooth'},500)>20,'smooth has many tones');}
{const s={family:'stairs',stage:3,params:{paper:0}},img=raster(render(s).svg,1030),{paper,ink}={paper:'#efeee9',ink:'#2c2b29'};let two=0,k=0;for(let y=300;y<760;y+=3)for(let x=60;x<700;x+=3){const c=at(img,x,y);if(near(c,rgb(paper),24)||near(c,rgb(ink),24))two++;k++;}assert(two/k>.9,`halftone two inks ${two/k}`);}
{const a=raster(render({family:'ridges',stage:3,params:{misregister:0}}).svg,728),b=raster(render({family:'ridges',stage:3,params:{misregister:12}}).svg,728);let d=0;for(let i=0;i<a.px.length;i+=4)if(Math.abs(a.px[i]-b.px[i])>30)d++;assert(d>500,'misregistration moves ink');}
const tex=s=>{const img=raster(render(s).svg,1030);let t=0,k=0;for(let y=60;y<240;y++)for(let x=420;x<700;x++){t+=Math.abs(at(img,x,y)[0]-at(img,x+1,y)[0]);k++;}return t/k;};
{const a=tex({family:'stairs',params:{paper:0,grain:0}}),b=tex({family:'stairs',params:{paper:1,grain:0}});assert(b>a+.15,`paper fibre ${a} ${b}`);}
for(const f of calm.filter(f=>f.set.finish==='smooth'&&f.set.mode==='halo'&&f.set.aperture==='open')){const s={family:f.id,stage:3,shape:'rect',series:'none',params:{width:8,bloom:0,smear:0,offset:0,haze:0,blinds:0,lights:1,balance:0,curve:1,size:.8,x:0,y:0,count:1}},img=raster(render(s).svg,1030),[a]=apertures(resolve(s));
 assert(near(at(img,a.c[0]+30,a.c[1]+20),rampAt(resolve(s).ramp,profile(1,resolve(s).params)).map(v=>Math.round(v*255)),3),`${f.id} inside`);}
// 7. Light model: three lights leave a blue and a sienna shadow; a cut aperture is dark where the shape is.
{const img=raster(render({family:'shadows',stage:3}).svg,880);let blue=0,red=0;for(let y=100;y<800;y+=4)for(let x=40;x<840;x+=4){const [r,,b]=at(img,x,y);if(b>r+18)blue++;if(r>b+18)red++;}assert(blue>200&&red>200,`coloured shadows ${blue} ${red}`);}
{const s={family:'cut',stage:3,word:'I',params:{size:.6}},img=raster(render(s).svg,728),[a]=apertures(resolve(s));assert(at(img,a.c[0],a.c[1])[0]<at(img,40,40)[0]-60,'cut: the word is the dark hole');}
// 8. Series and formats.
for(const series of ['day','turn','phase','shapes'])for(const panels of [2,5]){const r=render({family:'stairs',series,params:{panels}});assert.equal(r.features.panels,panels);assert.equal((r.svg.match(/<svg x=/g)||[]).length,panels);}
for(const [k,[w,h]] of Object.entries(FORMATS)){const p=new Resvg(render({family:'lantern',format:k}).svg,{fitTo:w>=h?{mode:'width',value:3000}:{mode:'height',value:3000}}).render().asPng();globalThis.gc?.();const got=[p.readUInt32BE(16),p.readUInt32BE(20)],want=[w,h].map(v=>v*3000/Math.max(w,h));assert(got.every((v,i)=>Math.abs(v-want[i])<=1),`${k} ${got}`);}
// (story is 612 × 1088: its 3000-px PNG is 1687.5 wide — resvg rounds down, the editor's canvas export rounds up)
// 9. Copy stays crisp and outside every filter, in every lockup and type; no feTurbulence anywhere.
for(const f of calm)for(const lockup of OPTIONS.lockup)for(const type of OPTIONS.type){const svg=render({family:f.id,lockup,type}).svg,i=svg.lastIndexOf('<g font-family'),pre=svg.slice(0,i);assert(i>0,`${f.id} copy`);
 assert.equal((pre.match(/<g[\s>]/g)||[]).length,(pre.match(/<\/g>/g)||[]).length,`${f.id} ${lockup} copy nested`);assert(!/filter=|mask=|opacity=/.test(svg.slice(i)),`${f.id} ${lockup} copy filtered`);assert(!svg.includes('feTurbulence'));}
// 10. Replay, seeds and inputs.
for(const f of calm){const s={family:f.id,shape:'custom',layout:'grid',finish:'riso',params:{count:4,blinds:5,lights:2,rim:.5,paper:.6,sparkles:30}},a=render(s);render({family:'club'});assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);}
assert.notEqual(render({family:'blinds',params:{seed:3}}).svg,render({family:'blinds',params:{seed:4}}).svg);
assert.equal(resolve({family:'bogus'}).family,FAMILIES[0].id);assert.equal(resolve({finish:'neon',family:'phases'}).finish,'steps');assert.equal(resolve({params:{count:12}}).params.count,9);assert.equal(resolve({lightColors:['red','blue']}).lightColors.length,2);assert.equal(resolve({title:'<b>x</b>'}).title,'bx/b');
assert.equal(specimen({family:'lantern'}).match(/data-shape=/g).length,OPTIONS.shape.length);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'blinds',params:{width:6+i}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',rasters,checks:{
 v1Frozen:`${frozen} files in output/glow-aperture-study-v1 unchanged since the freeze (sha-256 manifest)`,v1Rules:`${v1Rules} saved v1 rules render byte-identically in v2`,v2PathContinuity:`${continuity} v1 style × pass states drawn pixel-identically by the v2 code path`,
 styles:`${FAMILIES.length} distinct (${calm.length} calm v2 + ${old.length} v1); every pass renders at its format size`,controls:`${changed} control checks change the poster where read; ${inert} stay inert where not`,options:`${values} option values distinct; ${inertOpts} conditional options inert where not read`,ramps:RAMPS.length,
 shapes:`${probes} probes: six new silhouettes in every layout, words (Mincho, DM Serif, Gothic) and paths light their boxes`,finishes:'steps posterise a ray (≤ steps + 4 tones), halftone is ≥ 90% paper or ink, riso misregisters, paper fibre adds texture, smooth halo interiors reach the last stop',
 light:'three lights leave blue and sienna shadows; a cut aperture is the dark hole',series:'day, turn, phase and shapes give the requested panel count',formats:Object.fromEntries(Object.entries(FORMATS).map(([k,[w,h]])=>[k,[w,h].map(v=>Math.round(v*3000/Math.max(w,h)))])),
 copy:'outside every filter in all lockups and both types',inputs:'family, finish, count, colours, markup, words, paths',averageRenderMs:renderMs},
 limitations:'Checks verify construction, compatibility and determinism, not likeness. Copy uses system fonts; word outlines are Hiragino (local study) and DM Serif (OFL). The resvg-versus-Chrome comparison is in browser-validation.json.'},null,2));
console.log(`PASS: v1 frozen (${frozen} files), ${v1Rules} v1 rules identical, ${continuity} continuity states, ${FAMILIES.length} styles, ${changed}+${inert} controls, ${values}+${inertOpts} options, ${RAMPS.length} ramps, ${probes} shape probes, finishes, lights, series, formats, copy, inputs. ${rasters} rasters; render ${renderMs} ms.`);
