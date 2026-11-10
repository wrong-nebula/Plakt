import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/wagara-study-v1'),captures=path.join(root,'output/playwright/wagara-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.Wagara.getState());
const poster=()=>page.locator('#stage').innerHTML();
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('#specimen [data-glyph]').count(),43);assert.equal(await page.locator('#kit [data-pattern]').count(),18);assert.equal(await page.locator('.sources img').count(),6);assert.equal(await page.locator('.layouts img').count(),8);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Text: typing, rows, normalisation and errors; header and information.
 await page.locator('#text').fill('type / system');assert.equal((await state()).text,'TYPE/SYSTEM');assert.equal(await page.evaluate(()=>window.currentWagara.features.rows),2);await page.locator('#stage').screenshot({path:path.join(captures,'two-rows.png')});
 await page.locator('#text').fill('kyōto');assert.equal((await state()).text,'KYOTO');
 await page.locator('#text').fill('A&B');assert.match(await page.locator('#error').textContent(),/Use A–Z/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('#text').fill('A/B/C/D');assert.match(await page.locator('#error').textContent(),/three rows/);
 await page.locator('.probe[data-text="NEO/EDO"]').click();assert.equal((await state()).text,'NEO/EDO');assert.equal(await page.locator('#error').textContent(),'');
 let before=await poster();await page.locator('#title').fill('POSTER');assert.notEqual(before,await poster());assert.equal((await state()).title,'POSTER');await page.locator('#info').fill('8 / 29 / Tokyo');assert.match(await poster(),/Tokyo/);
 // Every enabled control changes the poster; inactive ones are disabled.
 const controls=await page.evaluate(()=>window.Wagara.CONTROLS.map(c=>c.key));assert.equal(controls.length,14);let controlChecks=0,disabledChecks=0;
 for(const family of ['tanaka','neon','kamekura','takeo']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.Wagara.getState().family===v,family);
  for(const key of controls){const on=await page.evaluate(k=>window.Wagara.controlActive(k,window.Wagara.getState()),key);assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const b=await poster();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(b===await poster())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(b,await poster(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 assert(disabledChecks>0);
 // Option selects: every value distinct; the single pattern and the sequence slots.
 await page.locator('#family').selectOption('tanaka');let optionChecks=0;
 for(const id of ['letters','layout','assign','anchor','inking','edge','shadow','groundPattern']){await page.locator('#reset').click();const seen=new Set();for(const v of await page.locator(`#${id} option`).evaluateAll(o=>o.map(x=>x.value))){await page.locator('#'+id).selectOption(v);seen.add(await poster());optionChecks++;}assert.equal(seen.size,await page.locator(`#${id} option`).count(),id);}
 await page.locator('#reset').click();assert(await page.locator('#pattern').isDisabled());assert(!(await page.locator('#slot0').isDisabled()));
 before=await poster();await page.locator('#slot0').selectOption('kanoko');assert.notEqual(before,await poster());assert.equal((await state()).sequence[0],'kanoko');
 await page.locator('#assign').selectOption('single');assert(!(await page.locator('#pattern').isDisabled()));assert(await page.locator('#slot0').isDisabled());
 const patternShots=new Set();for(const v of await page.locator('#pattern option').evaluateAll(o=>o.map(x=>x.value))){await page.locator('#pattern').selectOption(v);patternShots.add(await poster());optionChecks++;}assert.equal(patternShots.size,18);
 await page.locator('#stage').screenshot({path:path.join(captures,'single-pattern.png')});
 // Colours: a role and a window ink.
 await page.locator('#reset').click();before=await poster();await page.locator('#c0').evaluate(i=>{i.value='#22304a';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(before,await poster());assert.equal((await state()).colors[0],'#22304a');
 before=await poster();await page.locator('#w0p').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(before,await poster());assert.equal((await state()).windows[0][0],'#ff2a6d');
 // Four passes; nine styles, six with their source poster.
 await page.locator('#reset').click();const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentWagara.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs={tanaka:'moma-6066',takeo:'moma-6130',bunraku:'moma-8720',hinode:'moma-7942',kamekura:'moma-7787',muji:'pgda-19883'},styles=[];
 for(const family of await page.evaluate(()=>window.Wagara.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentWagara.state.family===v,family);
  const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);if(refs[family]){assert.match(await page.locator('#ref-img').getAttribute('src'),new RegExp(`references/${refs[family]}\\.`));assert(await page.locator('#ref-img').evaluate(i=>i.decode().then(()=>i.naturalWidth>300)));}
  styles.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(styles).size,9);
 await page.locator('.choose-family[data-family="bunraku"]').click();assert.equal((await state()).family,'bunraku');
 // Saved rule, downloads and URL replay.
 await page.locator('#text').fill('WA/GARA');await page.locator('#p-scale').fill('70');await page.locator('#p-scale').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await poster();
 await page.locator('#family').selectOption('tanaka');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Wagara.getState().family==='bunraku');assert.equal(expected,await poster());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/wagara window rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('wagara window letters'));
 const tileEvent=page.waitForEvent('download');await page.locator('#save-tile').click();const tl=await tileEvent;await tl.saveAs(path.join(captures,'ui-tile.svg'));assert.match(fs.readFileSync(path.join(captures,'ui-tile.svg'),'utf8'),/^<svg[^>]+viewBox="0 0 [\d.]+ [\d.]+"/);assert.match(await page.locator('#status').textContent(),/repeat of seigaiha/);
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await poster());
 // Slider-drag responsiveness: twenty pattern-scale changes on a two-row word.
 const dragMs=await page.evaluate(()=>{const s=window.Wagara.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,family:'tanaka',text:'TYPE/SYSTEM',params:{...s.params,scale:40+i}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#stage svg').waitFor();await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),note:'Redraw time includes the poster and the editor UI install; the specimen and kit redraw 220 ms after the last change.',checks:['reference image loaded','specimen: 43 glyph windows','kit: 18 patterns','six reference thumbnails, eight layout thumbnails','text, rows, accents and error messages','header and information text',`${controlChecks} enabled controls change the poster across four styles; ${disabledChecks} inactive controls disabled`,`${optionChecks} option values: letters, layout, assign, anchor, inking, edge, shadow and ground pattern each distinct; 18 single patterns distinct`,'pattern select enabled only for one pattern, sequence slots only otherwise; a slot changes the poster','role and window colour inputs','four visible construction passes','nine styles; six show their source poster, three are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','pattern tile download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: sheets, text and rows, ${controlChecks} controls (${disabledChecks} disabled), ${optionChecks} option values, colours, 4 stages, 9 styles and references, saved-rule / URL replay, PNG / SVG / tile downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
