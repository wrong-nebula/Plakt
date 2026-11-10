import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/bead-ray-study-v1'),captures=path.join(root,'output/playwright/bead-ray-system');fs.mkdirSync(captures,{recursive:true});
// A local test image for the image source: a pale star on black.
fs.writeFileSync(path.join(captures,'star.png'),new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#000"/><path d="M100 30 L124 104 L200 104 L138 148 L162 222 L100 176 L38 222 L62 148 L0 104 L76 104Z" fill="#fff"/></svg>`).render().asPng());
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.BeadRay.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
const choose=async id=>{await page.locator('#family').selectOption(id);await page.waitForFunction(v=>window.BeadRay.getState().family===v,id);};
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('#specimen [data-tile]').count(),36);assert.equal(await page.locator('.sources img').count(),7);
 const families=await page.evaluate(()=>window.BeadRay.FAMILIES.map(f=>f.id));assert.equal(await page.locator('.families img').count(),families.length);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Every control is enabled exactly when it changes the picture, and every enabled control changes it.
 const controls=await page.evaluate(()=>window.BeadRay.CONTROLS.map(c=>c.key));let controlChecks=0,disabledChecks=0;
 for(const family of ['cell','petal','flip','scoreboard','sunrise','confetti']){await choose(family);
  for(const key of controls){const on=await page.evaluate(k=>window.BeadRay.applies(k,window.BeadRay.getState()),key);assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;await page.locator('#reset').click();}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});}
 // Option selects: enabled ones give a distinct picture per value; disabled ones are disabled.
 const options=await page.evaluate(()=>window.BeadRay.OPTIONS);let optionChecks=0;
 for(const family of ['neon','eye']){await choose(family);for(const [id,values] of Object.entries(options)){await page.locator('#reset').click();if(id==='shape'&&!(await page.locator('#source').isDisabled()))await page.locator('#source').selectOption('shape');
  const on=await page.evaluate(k=>window.BeadRay.applies(k,window.BeadRay.getState()),id);assert.equal(await page.locator('#'+id).isDisabled(),!on,`${family} ${id}`);if(!on)continue;
  const seen=new Set();for(const v of values.filter(v=>v!=='image')){await page.locator('#'+id).selectOption(v);seen.add(await stageHTML());}assert.equal(seen.size,values.filter(v=>v!=='image').length,`${family} ${id}`);optionChecks+=seen.size;}}
 await page.locator('#reset').click();const inv=await stageHTML();await page.locator('#invert').check();assert.notEqual(inv,await stageHTML());assert.equal((await state()).invert,true);
 // Word source: typing, rows, normalisation and errors.
 await choose('scoreboard');await page.locator('#word').fill('bead / ray');assert.equal((await state()).word,'BEAD/RAY');await page.locator('#stage').screenshot({path:path.join(captures,'word.png')});
 await page.locator('#word').fill('A&B');assert.match(await page.locator('#word-error').textContent(),/Use A–Z/);assert.equal(await page.locator('#word').getAttribute('aria-invalid'),'true');
 await page.locator('#word').fill('A/B/C/D');assert.match(await page.locator('#word-error').textContent(),/three rows/);await page.locator('#word').fill('flip');assert.equal(await page.locator('#word-error').textContent(),'');
 // Image source: a local file is sampled to a luminance grid in the page.
 await choose('eye');await page.locator('#source').selectOption('image');assert.equal((await state()).source,'shape');assert.match(await page.locator('#status').textContent(),/Choose an image/);
 const beforeImage=await stageHTML();await page.locator('#image-file').setInputFiles(path.join(captures,'star.png'));await page.waitForFunction(()=>window.BeadRay.getState().source==='image');
 const im=(await state()).image;assert.equal(im.w,51);assert.equal(im.h,72);assert.equal(im.data.length,51*72*2);assert.equal(im.name,'star.png');assert.match(await page.locator('#status').textContent(),/51 × 72/);assert.notEqual(beforeImage,await stageHTML());
 await page.locator('#stage').screenshot({path:path.join(captures,'image-source.png')});
 // Colours and passes.
 const beforeColor=await stageHTML();await page.locator('#c2').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await stageHTML());assert.equal((await state()).colors[2],'#ff2a6d');
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`.stages [data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentRender.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`pass-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 // Saved rule (with the image grid), downloads and URL replay.
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await choose('cell');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.BeadRay.getState().family==='eye');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#status').textContent(),/bead-ray rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('flip-disc screen'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());assert.equal((await state()).source,'image');
 // Presets: each distinct; source presets show their reference, new ones stand alone; layouts and formats.
 const refs=await page.evaluate(()=>window.BeadRay.SOURCES.map(s=>s.family)),systems=[];
 for(const family of families){await choose(family);await page.locator('.stages [data-stage="4"]').click();const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs.includes(family),family);
  if(!solo)assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>400),family);systems.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`preset-${family}.png`)})).digest('hex'));}
 assert.equal(new Set(systems).size,families.length);
 const sizes=new Set();for(const f of options.format){await page.locator('#format').selectOption(f);const r=await page.evaluate(()=>[window.currentRender.width,window.currentRender.height]);sizes.add(r.join('x'));}assert.equal(sizes.size,4);
 await page.locator('.choose-family[data-family="confetti"]').click();assert.equal((await state()).family,'confetti');const s0=(await state()).params.seed,f0=await stageHTML();await page.locator('#reseed').click();assert.notEqual((await state()).params.seed,s0);assert.notEqual(f0,await stageHTML());
 // Slider-drag responsiveness on the densest default screen and bloom.
 const dragMs=await page.evaluate(()=>{const out={};for(const id of ['scoreboard','vault']){const s=window.BeadRay.resolve({family:id}),t=performance.now();for(let i=0;i<20;i++)window.render({...s,params:{...s.params,[id==='vault'?'rays':'pitch']:s.params[id==='vault'?'rays':'pitch']+(i%3)}});out[id]=+((performance.now()-t)/20).toFixed(1);}return out;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.locator('#families').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(captures,'mobile-gallery.png')});assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:dragMs,checks:['reference image loaded','specimen: 36 vocabulary tiles','seven reference thumbnails',`${families.length} preset thumbnails`,
  `${controlChecks} enabled controls change the poster across six presets (bloom, petals, screen, flip-dot, overlay, field); ${disabledChecks} controls correctly disabled`,`${optionChecks} option values distinct where enabled; disabled selects match the engine`,'invert checkbox','word source: rows, normalisation and error messages',
  'image source: local PNG sampled to a 51 × 72 luminance grid in the page, saved with the rule','colour inputs','four visible construction passes',`${families.length} presets distinct; seven show their source poster, six are marked new`,'four formats','saved-rule exact SVG replay including the image grid','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','new seed changes the field','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: ${controlChecks} controls (+${disabledChecks} disabled), ${optionChecks} option values, word and image sources, colours, 4 passes, ${families.length} presets and references, formats, saved-rule / URL replay, downloads, reseed, mobile and offline. Redraw ${JSON.stringify(dragMs)} ms.`);
}finally{await browser.close();}
