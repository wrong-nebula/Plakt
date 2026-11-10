import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {FAMILIES,RAMPS,render as nodeRender} from './engine.mjs';
import {DEMOS} from './demos.mjs';
// A watchdog: a hung check must never keep the shared heavy-job lock.
setTimeout(()=>{console.error('browser-check: watchdog timeout after 40 min');process.exit(3);},40*60*1000).unref();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/glow-aperture-study-v2'),v1out=path.join(root,'output/glow-aperture-study-v1'),captures=path.join(root,'output/playwright/glow-aperture-system-v2');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];context.setDefaultTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));await context.route('https://**',r=>{network.push(r.request().url());r.abort();});await context.route('http://**',r=>{network.push(r.request().url());r.abort();});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),shot=async()=>sha(await page.locator('#stage').screenshot());
const state=()=>page.evaluate(()=>window.Glow.getState()),stageHTML=()=>page.locator('#stage').innerHTML(),pick=(id,v)=>page.locator('#'+id).selectOption(v);
const asRule=r=>({...r,ramp:typeof r.ramp==='string'?RAMPS.find(x=>x.id===r.ramp).stops:r.ramp});
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage > svg').waitFor();assert.deepEqual(errors,[]);
 assert.equal((await state()).family,'lantern','opens on a calm style');assert.equal(await page.locator('.sources img').count(),7);assert.equal(await page.locator('.families img').count(),FAMILIES.length);
 await page.locator('.families img').first().evaluate(i=>{i.loading='eager';});await page.locator('.families img').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.querySelector('.families img');return i.complete&&i.naturalWidth>500;},null,{timeout:60000});await page.evaluate(()=>window.scrollTo(0,0));
 await page.waitForFunction(()=>document.querySelectorAll('#specimen [data-shape]').length===19,null,{timeout:60000});await page.screenshot({path:path.join(captures,'desktop.png')});
 // Copy, word and path inputs.
 await page.locator('#title').fill('EVENING');assert.match(await stageHTML(),/EVENING/);
 await page.locator('#word').fill('月');assert.equal((await state()).word,'月');await page.locator('.word-chip[data-word="夢/心"]').click();assert.equal((await state()).word,'夢/心');
 await pick('shape','custom');assert(!(await page.locator('#path').isDisabled()));await page.locator('#path').fill('10,10 90,20 50,90');assert.equal((await state()).path,'M10 10L90 20 50 90Z');
 await page.locator('#path').fill('not a path');assert.match(await page.locator('#path-error').textContent(),/Not a usable path/);assert.equal((await state()).path,'M10 10L90 20 50 90Z');
 await page.locator('#editor').scrollIntoViewIfNeeded();const box=await page.locator('#editor').boundingBox();await page.mouse.click(box.x+box.width*.85,box.y+box.height*.85);assert.equal((await state()).path.match(/-?[\d.]+/g).length,8,'click adds a point');
 await page.locator('.path-chip[data-path^="M50 2C"]').click();for(const [fx,fy] of [[.2,.2],[.8,.2],[.5,.8]])await page.mouse.click(box.x+box.width*fx,box.y+box.height*fy);assert.equal((await state()).path.match(/-?[\d.]+/g).length,6,'three clicks make a new polygon');
 await page.locator('#stage').screenshot({path:path.join(captures,'custom-path.png')});
 // Every enabled control changes the poster; controls a state does not read are disabled.
 const controls=await page.evaluate(()=>window.Glow.CONTROLS.map(c=>c.key));assert.equal(controls.length,32);let controlChecks=0,disabledSeen=0;
 for(const family of ['lantern','phases','ridges','stairs','blinds','club']){await pick('family',family);await page.waitForFunction(v=>window.Glow.getState().family===v,family);
  for(const key of controls){if(await page.locator(`#p-${key}`).isDisabled()){disabledSeen++;continue;}const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Option selects: every value distinct (conditional ones made readable first).
 const options=await page.evaluate(()=>window.Glow.OPTIONS);let optionChecks=0;
 for(const [id,values] of Object.entries(options)){await pick('family','vessel');await page.locator('#reset').click();await pick('lockup','auto');if(id==='ground')await pick('mode','field');if(id==='face'){await pick('shape','word');await page.locator('#word').fill('LIGHT');}if(id==='sparkle'){await page.locator('#p-sparkles').fill('60');await page.locator('#p-sparkles').dispatchEvent('input');}
  const seen=new Set();for(const v of values){await pick(id,v);seen.add(await stageHTML());}assert.equal(seen.size,values.length,id);optionChecks+=values.length;}
 // Ramp editor: presets, stop count, add, remove, reverse, colours and positions; light colours.
 await pick('family','vessel');const ramps=await page.evaluate(()=>window.Glow.RAMPS.map(r=>r.id)),rampSeen=new Set();for(const id of ramps){await pick('ramp-preset',id);rampSeen.add(await stageHTML());}assert.equal(rampSeen.size,ramps.length);
 await pick('ramp-preset','fog');for(const k of ['2','3','4','5']){await pick('stop-count',k);assert.equal((await state()).ramp.length,+k);}
 await page.locator('#ramp-remove').click();assert.equal((await state()).ramp.length,4);await page.locator('#ramp-add').click();assert.equal((await state()).ramp.length,5);assert(await page.locator('#ramp-add').isDisabled());
 let before=await stageHTML();await page.locator('#ramp-reverse').click();assert.notEqual(before,await stageHTML());
 before=await stageHTML();await page.locator('#s1').evaluate(i=>{i.value='#3e6aa8';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await state()).ramp[1][0],'#3e6aa8');assert.notEqual(before,await stageHTML());
 await pick('family','shadows');assert(!(await page.locator('#l1').isDisabled()));before=await stageHTML();await page.locator('#l0').evaluate(i=>{i.value='#6a8f5a';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await state()).lightColors[0],'#6a8f5a');assert.notEqual(before,await stageHTML());
 // Four passes; every style distinct, with its reference or marked new.
 await pick('family','lantern');const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentGlow.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs=Object.fromEntries((await page.evaluate(()=>REFS)).map(r=>[r.family,r.file])),styles=[];
 for(const f of FAMILIES){await pick('family',f.id);await page.waitForFunction(v=>window.currentGlow.state.family===v,f.id);assert.equal(await page.locator('#comparison').evaluate(e=>e.classList.contains('solo')),!refs[f.id],f.id);
  assert.equal(await page.evaluate(()=>window.currentGlow.features.engine),f.calm?'glow-aperture-v2':'glow-aperture-v1',`${f.id} engine`);styles.push(sha(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${f.id}.png`)})));}assert.equal(new Set(styles).size,FAMILIES.length);
 // Version 1 rules open unchanged; v2 rules save and replay; downloads; URL replay.
 let v1Checked=0;for(const f of ['club.json','moon.json','variations/vase-neon.json','stages/halo-2.json']){const file=path.join(v1out,f);await page.locator('#load-rule').setInputFiles(file);await page.waitForFunction(()=>/Version 1 rule opened/.test(document.getElementById('status').textContent));
  assert.equal(await page.evaluate(()=>window.Glow.render(window.Glow.getState()).svg),fs.readFileSync(file.replace(/\.json$/,'.svg'),'utf8'),`v1 ${f}`);v1Checked++;await page.locator('#status').evaluate(e=>e.textContent='');}
 await pick('family','ridges');await pick('series','turn');const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();await (await ruleEvent).saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await pick('family','lantern');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Glow.getState().family==='ridges');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/^Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/glow aperture rule/);
 const exports=[];for(const [family,size] of [['stairs',[2120,3000]],['cut',[3000,2120]]]){await pick('family',family);const ev=page.waitForEvent('download',{timeout:180000});await page.locator('#save-png').click();const file=path.join(captures,`ui-export-${family}.png`);await (await ev).saveAs(file);const b=fs.readFileSync(file);assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],size,family);exports.push(size.join('×'));}
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();await (await svgEvent).saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('glow apertures'));
 await pick('family','ridges');await pick('series','turn');const expected2=await stageHTML();await page.reload();await page.locator('#stage > svg').waitFor();assert.equal(expected2,await stageHTML());
 const dragMs=await page.evaluate(()=>{const s=window.Glow.getState(),t=performance.now();for(let i=0;i<10;i++)window.Glow.render({...s,params:{...s.params,width:10+i}});return (performance.now()-t)/10;});

 // resvg against Chrome on every style and every feature demo: the editor's bundled engine must produce the Node module's
 // SVG byte for byte, and Chrome's screenshot of it must be close to resvg's PNG. Hard-edged finishes (steps, halftone)
 // shift band edges by a pixel between renderers, so the outlier share is measured on 4 × 4 block averages.
 const rules=[...FAMILIES.map(f=>({name:f.id,rule:{family:f.id}})),...Object.entries(DEMOS).flatMap(([g,list])=>list.map(([slug,,rule])=>({name:`${g}-${slug}`,rule:asRule(rule)})))],parity=[];
 const cmpCtx=await browser.newContext({deviceScaleFactor:1}),cmp=await cmpCtx.newPage();
 for(const {name,rule} of rules){const svg=await page.evaluate(r=>window.Glow.render(r).svg,rule),r=nodeRender(rule);assert.equal(svg,r.svg,`bundle = module for ${name}`);
  const ref=new Resvg(svg,{fitTo:{mode:'width',value:r.width}}).render().asPng();await cmp.setViewportSize({width:r.width,height:r.height});await cmp.setContent(`<style>body{margin:0}svg{display:block}</style>${svg}`);const chrome=await cmp.screenshot({clip:{x:0,y:0,width:r.width,height:r.height}});
  const d=await cmp.evaluate(async([a,b])=>{const load=async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return {d:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};};
   const A=await load(a),B=await load(b);let s=0,big=0;for(let i=0;i<A.d.length;i+=4)for(let j=0;j<3;j++){const v=Math.abs(A.d[i+j]-B.d[i+j]);s+=v;if(v>40)big++;}
   let bb=0,bn=0;for(let y=0;y+4<=A.h;y+=4)for(let x=0;x+4<=A.w;x+=4)for(let j=0;j<3;j++){let sa=0,sb=0;for(let v=0;v<4;v++)for(let u=0;u<4;u++){const i=((y+v)*A.w+x+u)*4+j;sa+=A.d[i];sb+=B.d[i];}if(Math.abs(sa-sb)/16>40)bb++;bn++;}
   const k=A.d.length/4*3;return {mean:+(s/k).toFixed(2),over40:+(big/k*100).toFixed(3),blockOver40:+(bb/bn*100).toFixed(3)};},['data:image/png;base64,'+ref.toString('base64'),'data:image/png;base64,'+chrome.toString('base64')]);
  parity.push({rule:name,size:[r.width,r.height],engine:r.features.engine,...d});if(['lantern','phases','stairs','ridges','demos'].some(k=>name===k)||['finishes-halftone','finishes-riso','light-three-shadows'].includes(name)){fs.writeFileSync(path.join(captures,`parity-${name}-resvg.png`),ref);fs.writeFileSync(path.join(captures,`parity-${name}-chrome.png`),chrome);}
  assert(d.mean<=3,`${name}: mean difference ${d.mean}`);assert(d.blockOver40<=.8,`${name}: ${d.blockOver40}% of 4×4 blocks differ by more than 40`);}
 await cmpCtx.close();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 const worst=parity.reduce((a,b)=>b.mean>a.mean?b:a),worstBlock=parity.reduce((a,b)=>b.blockOver40>a.blockOver40?b:a);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRenderMs:+dragMs.toFixed(1),
  parity:{method:'Same rule: SVG from the editor’s bundled engine (asserted byte-equal to the Node module’s), rasterised by resvg and screenshotted inline in Chrome at the format’s size, device scale 1. Mean absolute channel difference (0–255); outliers counted on 4 × 4 block averages so one-pixel shifts of hard print edges do not count.',thresholds:{mean:3,blockOver40Percent:.8},worstMean:worst,worstBlocks:worstBlock,rules:parity},
  checks:['opens on a calm style; 7 references; 21 gallery posters; 19-shape specimen','title, word chips, custom path text, point editor (add, new polygon), invalid path message',`${controlChecks} enabled controls change the poster across six styles; ${disabledSeen} disabled where unread`,`${optionChecks} option values distinct`,`${ramps.length} ramp presets; stop counts; add, remove, reverse; stop colour; light colour`,'four passes','21 styles distinct; v1 styles drawn by the frozen v1 engine, calm styles by v2; references shown for the seven source styles',`${v1Checked} saved v1 rules open with the version 1 notice and render byte-identically`,'v2 rule save / load replay; wrong-engine rule rejected',`PNG downloads ${exports.join(', ')}`,'SVG download','URL reload replay',`${parity.length} rules: editor SVG = Node SVG; resvg ≈ Chrome (worst mean ${worst.mean} on ${worst.rule})`,'mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: ${controlChecks} controls (${disabledSeen} disabled), ${optionChecks} option values, ${ramps.length} ramps, word/path editor, 4 stages, ${FAMILIES.length} styles, ${v1Checked} v1 rules, replay, downloads ${exports.join(' ')}, mobile, offline. resvg vs Chrome on ${parity.length} rules: worst mean ${worst.mean} (${worst.rule}), worst block share ${worstBlock.blockOver40}% (${worstBlock.rule}).`);
}finally{await browser.close();}
