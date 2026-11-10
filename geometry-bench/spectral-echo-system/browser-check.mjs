import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/spectral-echo-study-v1'),captures=path.join(root,'output/playwright/spectral-echo-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.Spectral.getState());
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));await page.locator('#specimen [data-glyph]').first().waitFor();assert(await page.locator('#specimen [data-glyph]').count()>=36);assert.equal(await page.locator('.sources img').count(),4);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Text: Japanese, Latin, rows, fallback and errors.
 await page.locator('#text').fill('光 / 音');assert.equal((await state()).text,'光/音');assert.equal(await page.evaluate(()=>window.currentEcho.features.rows),2);
 await page.locator('#family').selectOption('trail');await page.locator('#text').fill('RAVE 光');assert.equal((await state()).text,'RAVE 光');assert.equal(await page.evaluate(()=>window.currentEcho.features.glyphs),5);
 await page.locator('#text').fill('€uro');assert.match(await page.locator('#error').textContent(),/Not in/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('#text').fill('A/B/C/D/E/F');assert.match(await page.locator('#error').textContent(),/five rows/);
 await page.locator('.probe[data-text="ECHO"]').click();assert.equal((await state()).text,'ECHO');assert.equal(await page.locator('#error').textContent(),'');
 await page.locator('#title').fill('NIGHT SHIFT');assert.match(await page.locator('#stage').innerHTML(),/NIGHT SHIFT/);
 // Every enabled control changes the poster; band controls are only enabled in the sliced smear.
 const controls=await page.evaluate(()=>window.Spectral.CONTROLS.map(c=>({key:c.key,modes:c.modes})));assert.equal(controls.length,20);let controlChecks=0;
 for(const family of ['bloom','smear','trail','split']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.Spectral.getState().family===v,family);await page.locator('#text').fill('AB/CD');if(family==='bloom'){await page.locator('#font').selectOption('archivo');}const mode=(await state()).mode;
  for(const {key,modes} of controls){const on=!modes||modes.includes(mode);assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on)continue;
   const before=await page.locator('#stage').innerHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await page.locator('#stage').innerHTML())await page.locator(`#p-${key}`).press('Home');
   if(before===await page.locator('#stage').innerHTML()){await page.locator(`#p-${key}`).fill(String(await page.evaluate(k=>{const c=window.Spectral.CONTROLS.find(x=>x.key===k);return (c.min+c.max)/2;},key)));await page.locator(`#p-${key}`).dispatchEvent('input');}
   assert.notEqual(before,await page.locator('#stage').innerHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Options and colours.
 for(const [id,values] of Object.entries(await page.evaluate(()=>window.Spectral.OPTIONS))){await page.locator('#family').selectOption('trail');await page.locator('#text').fill('AB/CD');await page.locator('#p-rotate').fill('40');await page.locator('#p-rotate').dispatchEvent('input');await page.locator('#p-stretchX').fill('.6');await page.locator('#p-stretchX').dispatchEvent('input');
  const seen=new Set();for(const v of values){await page.locator('#'+id).selectOption(v);seen.add(await page.locator('#stage').innerHTML());}assert.equal(seen.size,values.length,id);await page.locator('#reset').click();}
 const beforeColor=await page.locator('#stage').innerHTML();await page.locator('#c1').evaluate(i=>{i.value='#00ffaa';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await page.locator('#stage').innerHTML());assert.equal((await state()).colors[1],'#00ffaa');
 // Four passes and seven styles; three show their source poster.
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentEcho.state.stage===v,stage);hashes.push(await shot());}assert.equal(new Set(hashes).size,4);
 const refs={bloom:'pgda-18073',smear:'pgda-19891',prism:'moma-5045'},styles=[];
 for(const family of await page.evaluate(()=>window.Spectral.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentEcho.state.family===v,family);
  assert.equal(await page.locator('#comparison').evaluate(e=>e.classList.contains('solo')),!refs[family],family);if(refs[family])assert.match(await page.locator('#ref-img').getAttribute('src'),new RegExp(refs[family]));
  styles.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(styles).size,7);
 await page.locator('.choose-family[data-family="tunnel"]').click();assert.equal((await state()).family,'tunnel');
 // Saved rule, downloads and URL replay.
 await page.locator('#text').fill('ZOOM');const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await page.locator('#stage').innerHTML();
 await page.locator('#family').selectOption('bloom');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Spectral.getState().family==='tunnel');assert.equal(expected,await page.locator('#stage').innerHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/spectral echo rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('spectral echo glyphs'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await page.locator('#stage').innerHTML());
 const dragMs=await page.evaluate(()=>{const s=window.Spectral.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,params:{...s.params,count:10+i}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),checks:['reference image loaded','specimen glyphs','four reference thumbnails','Japanese, Latin, rows and Hiragino fallback','unsupported-character and row errors','header text',`${controlChecks} enabled controls change the poster across four styles; band controls disabled outside the sliced smear`,'eight option selects, every value distinct','colour inputs','four visible construction passes','seven styles; three show their source poster, four are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: specimen, text and fallback, ${controlChecks} controls, options, colours, 4 stages, 7 styles and references, saved-rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
