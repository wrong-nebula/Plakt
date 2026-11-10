import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/tategaki-study-v1'),captures=path.join(root,'output/playwright/tategaki-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.Tategaki.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
const HEAD='東洋唯一の地下鐵道/上野浅草間開通',LAT='TATEGAKI COLOUR COLUMNS';
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>400));assert.equal(await page.locator('.sources img').count(),7);
 const forms=await page.evaluate(()=>window.Tategaki.verticalForms('mincho').length);assert.equal(await page.locator('#specimen [data-glyph]').count(),forms);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Text: lines, groups, ruby, normalisation and errors in all three fields.
 await page.locator('#text').fill('東京\n京都\n\n大阪');assert.equal((await state()).text,'東京/京都|大阪');assert.equal(await page.evaluate(()=>window.currentTategaki.features.groups),2);
 await page.locator('#text').fill('縦組《たてぐみ》の柱/ＴＯＫＹＯ 2026');assert.equal((await state()).text,'縦組《たてぐみ》の柱/TOKYO 2026');assert.equal(await page.evaluate(()=>window.currentTategaki.features.ruby),4);await page.locator('#stage').screenshot({path:path.join(captures,'ruby.png')});
 await page.locator('#text').fill('東京/龘');assert.match(await page.locator('#error').textContent(),/「龘」/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('#text').fill('あ《い》');assert.match(await page.locator('#error').textContent(),/needs kanji/);
 await page.locator('#header').fill('上|下');assert.match(await page.locator('#error').textContent(),/^Header: /);await page.locator('#latin').fill('TOKYO 東京');assert.match(await page.locator('#error').textContent(),/^Latin band: /);
 await page.locator('.preset[data-preset="transfer"]').click();assert.equal((await state()).text,await page.evaluate(()=>window.Tategaki.PRESETS[0].text));assert.equal(await page.locator('#error').textContent(),'');
 await page.locator('#header').fill(HEAD);await page.locator('#latin').fill(LAT);const s0=await state();assert.equal(s0.header,HEAD);assert.equal(s0.latin,LAT);
 // Every enabled control changes the poster; controls that do not apply are disabled.
 const controls=await page.evaluate(()=>window.Tategaki.CONTROLS.map(c=>({key:c.key,uses:c.uses})));assert.equal(controls.length,18);let controlChecks=0,disabledChecks=0;
 for(const family of ['noh','prewar','ballet','neon']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.Tategaki.getState().family===v,family);
  await page.locator('#layout').selectOption('start');await page.locator('#latinBand').selectOption('end');await page.locator('#ruby').selectOption('on');const s=await state();
  for(const {key,uses} of controls){const on=!uses||Object.entries(uses).every(([k,v])=>v.includes(s[k]));assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();assert.equal((await state()).header,HEAD);}
 // Every option value draws a different poster.
 const options=await page.evaluate(()=>window.Tategaki.OPTIONS);
 for(const [id,values] of Object.entries(options)){await page.locator('#family').selectOption('noh');await page.locator('#reset').click();if(id!=='layout')await page.locator('#layout').selectOption('start');
  await page.locator('#p-scale').fill(id==='ground'?'0.5':'0.62');await page.locator('#p-scale').dispatchEvent('input');if(id!=='latinBand')await page.locator('#latinBand').selectOption('end');
  const seen=new Set();for(const v of values){await page.locator('#'+id).selectOption(v);seen.add(await stageHTML());}assert.equal(seen.size,values.length,id);}
 await page.locator('#reset').click();const beforeColor=await stageHTML();await page.locator('#c1').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await stageHTML());assert.equal((await state()).colors[1],'#ff2a6d');
 // Four passes, ten styles, references.
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentTategaki.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs=Object.fromEntries(await page.evaluate(()=>window.Tategaki.SOURCES.map(s=>[s.family,s.id]))),styles=[];
 for(const family of await page.evaluate(()=>window.Tategaki.FAMILIES.map(f=>f.id))){await page.locator(`.choose-family[data-family="${family}"]`).click();await page.waitForFunction(v=>window.currentTategaki.state.family===v,family);
  const s=await state(),f=await page.evaluate(id=>window.Tategaki.FAMILIES.find(x=>x.id===id),family);assert.equal(s.text,f.text);assert.equal(s.header,f.header);
  const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);if(refs[family])assert.match(await page.locator('#ref-img').getAttribute('src'),new RegExp(`references/${refs[family]}\\.`));
  styles.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(styles).size,10);
 // Saved rule, downloads and URL replay.
 await page.locator('.choose-family[data-family="ballet"]').click();await page.locator('#p-title').fill('1.8');await page.locator('#p-title').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await page.locator('#family').selectOption('noh');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Tategaki.getState().family==='ballet');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/tategaki rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('tategaki colour columns'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());
 const redrawMs=await page.evaluate(()=>{const s=window.Tategaki.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,params:{...s.params,gap:.2+i*.02}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#stage svg').waitFor();await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+redrawMs.toFixed(1),checks:['reference image loaded','seven reference thumbnails',`specimen: ${forms} vertical forms`,'columns, blank-line groups, ruby, full-width normalisation and error messages in columns, header and Latin band fields','text presets',`${controlChecks} enabled controls change the poster across four styles; ${disabledChecks} controls that do not apply are disabled`,'eleven option selects, every value distinct','colour inputs','four visible construction passes','ten styles open with their own text; seven show their source poster, three are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile: no horizontal overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: specimen, text fields and errors, ${controlChecks} controls (${disabledChecks} disabled where they do not apply), options, colours, 4 stages, 10 styles and references, saved rule / URL replay, downloads, mobile and offline checks. Redraw ${redrawMs.toFixed(1)} ms.`);
}finally{await browser.close();}
