import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/arch-envelope-study-v1'),captures=path.join(root,'output/playwright/arch-envelope-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.ArchEnvelope.getState());
const stageHTML=()=>page.locator('#stage').innerHTML();
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500),'reference image');
 const glyphs=await page.locator('#specimen [data-glyph]').count();assert.equal(glyphs,await page.evaluate(()=>window.ArchEnvelope.CHARACTERS.length),'specimen shows every character');
 assert.equal(await page.locator('.sources img').count(),8);assert.equal(await page.locator('.families img').count(),10);assert.equal(await page.locator('.envelopes img').count(),12);
 for(const img of await page.locator('.families img, .envelopes img, .sources img').all()){await img.scrollIntoViewIfNeeded();assert(await img.evaluate(i=>i.complete&&i.naturalWidth>100),'gallery image loads');}
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(captures,'desktop.png')});
 // Headline: typing, rows, normalisation and errors.
 await page.locator('#text').fill('type / system');assert.equal((await state()).text,'type/system');assert.equal(await page.evaluate(()=>window.currentArch.features.rows),2);assert.match(await stageHTML(),/TYPE \/ SYSTEM/);await page.locator('#stage').screenshot({path:path.join(captures,'two-rows.png')});
 await page.locator('#text').fill('kyōto');assert.equal((await state()).text,'kyoto');
 await page.locator('#text').fill('A{B}');assert.match(await page.locator('#error').textContent(),/not in the alphabet/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('#text').fill('A/B/C/D');assert.match(await page.locator('#error').textContent(),/three rows/);
 await page.locator('.probe[data-text="ZEN"]').click();assert.equal((await state()).text,'ZEN');assert.equal(await page.locator('#error').textContent(),'');
 await page.locator('#title').fill('Summer revue');await page.locator('#info').fill('8 / 29 / Tokyo');assert.equal((await state()).title,'SUMMER REVUE');assert.equal((await state()).info,'8 / 29 / TOKYO');
 // Every enabled control changes the poster; disabled controls are exactly those the engine marks as not applying.
 const controls=await page.evaluate(()=>window.ArchEnvelope.CONTROLS.map(c=>c.key));assert.equal(controls.length,23);let controlChecks=0,disabledChecks=0;
 for(const family of ['silver-arch','vanishing','night-drive','acid','groovy']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.ArchEnvelope.getState().family===v,family);await page.locator('.probe[data-text="TYPE/SYSTEM"]').click();
  for(const key of controls){const on=await page.evaluate(k=>window.ArchEnvelope.applies(k,window.ArchEnvelope.getState()),key);assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Options: every value of every select is distinct (on a two-row mixed-case headline with a banner).
 await page.locator('#family').selectOption('gable');await page.locator('#text').fill('Type/Systems 26');
 for(const id of await page.evaluate(()=>window.ArchEnvelope.OPTION_KEYS)){const values=await page.locator(`#${id} option`).evaluateAll(o=>o.map(x=>x.value)),seen=new Set();if(id==='ends')await page.locator('#banner').selectOption('solid');
  for(const v of values){await page.locator('#'+id).selectOption(v);await page.waitForFunction(([k,x])=>window.ArchEnvelope.getState()[k]===x,[id,v]);seen.add(await stageHTML());}assert.equal(seen.size,values.length,id);}
 await page.locator('#reset').click();const beforeColor=await stageHTML();await page.locator('#c3').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await stageHTML());assert.equal((await state()).colors[3],'#ff2a6d');
 // Four passes, the envelope gallery, and ten styles (six with their source poster beside them).
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentArch.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`pass-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 await page.locator('.choose-envelope[data-envelope="flag"]').click();assert.equal((await state()).envelope,'flag');await page.evaluate(()=>window.scrollTo(0,0));await page.locator('#stage').screenshot({path:path.join(captures,'envelope-flag.png')});
 const refs={'silver-arch':'moma-7953','vanishing':'moma-7957','valley':'moma-6096','gable':'moma-6067','revue':'moma-8980','rising':'moma-6102'},styles=[];
 for(const family of await page.evaluate(()=>window.ArchEnvelope.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentArch.state.family===v,family);
  const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);if(refs[family])assert.equal(await page.locator('#ref-img').getAttribute('src'),`references/${refs[family]}.jpg`);
  styles.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(styles).size,10);
 await page.locator('.choose-family[data-family="valley"]').click();assert.equal((await state()).family,'valley');
 // Saved rule, downloads and URL replay.
 await page.locator('#text').fill('OKABE/STUDIO');await page.locator('#p-amount').fill('0.6');await page.locator('#p-amount').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await page.locator('#family').selectOption('acid');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.ArchEnvelope.getState().family==='valley');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/arch-envelope rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('arch-envelope headline'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());
 // Slider-drag responsiveness: twenty envelope-depth changes on a two-row headline.
 const dragMs=await page.evaluate(()=>{const s=window.ArchEnvelope.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,text:'TYPE/SYSTEM',params:{...s.params,amount:.3+i*.03}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile overflow');assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),checks:['reference image and every gallery image loaded',`specimen: ${glyphs} glyphs`,'eight reference thumbnails, ten style cards, twelve envelope cards','headline, rows, accents and error messages','kicker and information text (sanitised to capitals)',`${controlChecks} enabled controls change the poster across five styles; ${disabledChecks} disabled controls match the engine’s applies()`,'twelve option selects, every value distinct','colour inputs','four visible construction passes','envelope gallery applies its envelope','ten styles; six show their source poster, four are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: gallery, specimen (${glyphs}), text and rows, ${controlChecks} controls (${disabledChecks} correctly disabled), options, colours, 4 passes, envelope gallery, 10 styles and references, saved-rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
