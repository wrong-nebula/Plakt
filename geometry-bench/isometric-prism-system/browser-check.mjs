import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/isometric-prism-study-v1'),captures=path.join(root,'output/playwright/isometric-prism-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.IsoPrism.getState());
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('#specimen [data-glyph]').count(),43);assert.equal(await page.locator('.sources img').count(),6);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Text: typing, rows, normalisation and errors.
 await page.locator('#text').fill('type / system');assert.equal((await state()).text,'TYPE/SYSTEM');assert.equal(await page.evaluate(()=>window.currentIso.features.rows),2);await page.locator('#stage').screenshot({path:path.join(captures,'two-rows.png')});
 await page.locator('#text').fill('kyōto');assert.equal((await state()).text,'KYOTO');
 await page.locator('#text').fill('A&B');assert.match(await page.locator('#error').textContent(),/Use A–Z/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('#text').fill('A/B/C/D');assert.match(await page.locator('#error').textContent(),/three rows/);
 await page.locator('.probe[data-text="ZEN"]').click();assert.equal((await state()).text,'ZEN');assert.equal(await page.locator('#error').textContent(),'');
 await page.locator('#title').fill('SUMMER JAZZ');await page.locator('#info').fill('8 / 29 / Tokyo');assert.match(await page.locator('#stage').innerHTML(),/SUMMER JAZZ/);
 // Every enabled control changes the poster and reaches its maximum; view
 // controls are disabled in projections that do not use them, grain on untextured surfaces.
 const controls=await page.evaluate(()=>window.IsoPrism.CONTROLS.map(c=>({key:c.key})));assert.equal(controls.length,15);let controlChecks=0;
 for(const family of ['plinth','neon','shadow','blueprint']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.IsoPrism.getState().family===v,family);
  for(const {key} of controls){const on=await page.evaluate(k=>window.IsoPrism.active(k,window.IsoPrism.getState()),key);assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on)continue;
   const before=await page.locator('#stage').innerHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await page.locator('#stage').innerHTML()){await page.locator(`#p-${key}`).press('Home');}
   assert.notEqual(before,await page.locator('#stage').innerHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Choosing a texture switches grain on.
 await page.locator('#family').selectOption('shadow');await page.waitForFunction(()=>window.IsoPrism.getState().family==='shadow');assert(await page.locator('#p-grain').isDisabled());await page.locator('#texture').selectOption('grid');assert(!await page.locator('#p-grain').isDisabled(),'grain enabled by a texture');
 {const before=await page.locator('#stage').innerHTML();await page.locator('#p-grain').focus();await page.locator('#p-grain').press('End');assert.notEqual(before,await page.locator('#stage').innerHTML(),'grain after choosing a texture');}
 await page.locator('#family').selectOption('blueprint');await page.waitForFunction(()=>window.IsoPrism.getState().family==='blueprint');await page.locator('#reset').click();
 // View presets, options and colours.
 const views=await page.evaluate(()=>window.IsoPrism.VIEWS.map(v=>v.id)),viewShots=new Set();
 for(const id of views){await page.locator(`.view[data-view="${id}"]`).click();const v=await page.evaluate(i=>window.IsoPrism.VIEWS.find(x=>x.id===i).set,id),s=await state();assert.equal(s.projection,v.projection,id);for(const [k,val] of Object.entries(v.params))assert(Math.abs(s.params[k]-val)<1e-9,`${id} ${k}`);viewShots.add(await page.locator('#stage').innerHTML());}
 assert.equal(viewShots.size,views.length);await page.locator('.view[data-view="cabinet"]').click();await page.locator('#stage').screenshot({path:path.join(captures,'view-cabinet.png')});await page.locator('#reset').click();
 for(const [id,values] of Object.entries(await page.evaluate(()=>window.IsoPrism.OPTIONS))){await page.locator('#reset').click();if(id==='texture')await page.locator('#mode').selectOption('solid');const seen=new Set();for(const v of values){await page.locator('#'+id).selectOption(v);seen.add(await page.locator('#stage').innerHTML());}assert.equal(seen.size,values.length,id);}
 await page.locator('#reset').click();const beforeColor=await page.locator('#stage').innerHTML();await page.locator('#c1').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await page.locator('#stage').innerHTML());assert.equal((await state()).colors[1],'#ff2a6d');
 // Four passes and three systems.
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentIso.state.stage===v,stage);hashes.push(await shot());}assert.equal(new Set(hashes).size,4);
 const refs={plinth:'moma-190198',beam:'moma-190199',voxel:'moma-7783',monolith:'moma-7779',stripe:'moma-6666'},systems=[];
 for(const family of await page.evaluate(()=>window.IsoPrism.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentIso.state.family===v,family);
  const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);if(refs[family])assert.equal(await page.locator('#ref-img').getAttribute('src'),`references/${refs[family]}.jpg`);
  systems.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(systems).size,9);
 await page.locator('.choose-family[data-family="beam"]').click();assert.equal((await state()).family,'beam');
 // Saved rule, downloads and URL replay.
 await page.locator('#text').fill('EXPO/85');await page.locator('#p-depth').fill('5');await page.locator('#p-depth').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await page.locator('#stage').innerHTML();
 await page.locator('#family').selectOption('plinth');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.IsoPrism.getState().family==='beam');assert.equal(expected,await page.locator('#stage').innerHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'v1-rule.json'),JSON.stringify({engine:'isometric-prism-v1',family:'voxel',text:'ZEN',params:{angle:30,depth:2.6}}));await page.locator('#load-rule').setInputFiles(path.join(captures,'v1-rule.json'));await page.waitForFunction(()=>window.IsoPrism.getState().text==='ZEN');assert.match(await page.locator('#status').textContent(),/Version 1/);assert(Math.abs((await state()).params.elevation-35.26)<.01);
 await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.IsoPrism.getState().family==='beam');
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'more-love-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/isometric prism rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('isometric prism letters'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await page.locator('#stage').innerHTML());
 // Slider-drag responsiveness: twenty depth changes on a two-row word.
 const dragMs=await page.evaluate(()=>{const s=window.IsoPrism.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,text:'TYPE/SYSTEM',params:{...s.params,depth:2+i*.1}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),checks:['reference image loaded','specimen: 43 glyphs','six reference thumbnails','text, rows, accents and error messages','header and information text',`${controlChecks} enabled controls change the poster across four systems and all three projections; unused view controls and untextured grain disabled, grain enabled by choosing a texture`,`${views.length} view presets applied and distinct`,'six option selects, every value distinct','colour inputs','four visible construction passes','nine shape systems; five show their source poster, four are marked new','saved-rule exact SVG replay','version 1 rule opens (axis angle → elevation)','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: specimen, text and rows, ${controlChecks} controls, ${views.length} views, options, colours, 4 stages, 9 systems and references, saved-rule / v1 rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
