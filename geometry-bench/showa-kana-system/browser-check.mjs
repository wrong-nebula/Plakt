import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/showa-kana-study-v1'),captures=path.join(root,'output/playwright/showa-kana-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.ShowaKana.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 const glyphCount=await page.evaluate(()=>window.ShowaKana.CHARACTERS.length);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('#specimen [data-glyph]').count(),glyphCount);assert(await page.locator('#pairs [data-glyph]').count()>40);assert.equal(await page.locator('.sources img').count(),10);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Text: kana conversion, lines, romaji, palette and errors.
 await page.locator('#text').fill('でざいん');assert.equal((await state()).text,'デザイン');
 await page.locator('#text').fill('ねおん / とーきょー');assert.equal((await state()).text,'ネオン/トーキョー');assert.equal(await page.evaluate(()=>window.currentKana.features.rows),2);await page.locator('#stage').screenshot({path:path.join(captures,'two-lines.png')});
 await page.locator('#text').fill('ﾃﾞｻﾞｲﾝ');assert.equal((await state()).text,'デザイン');
 await page.locator('#text').fill('漢字');assert.match(await page.locator('#error').textContent(),/“漢” “字”/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');assert.equal((await state()).text,'デザイン');
 await page.locator('#text').fill('A/B/C/D/E');assert.match(await page.locator('#error').textContent(),/at most 4 lines/);
 await page.locator('.probe[data-text="カルピス"]').click();assert.equal((await state()).text,'カルピス');assert.equal(await page.locator('#error').textContent(),'');
 await page.locator('#romaji').check();await page.locator('#text').fill('dezain');assert.equal((await state()).text,'デザイン');await page.locator('#text').fill('xylophone');assert.match(await page.locator('#error').textContent(),/romaji/);await page.locator('#romaji').uncheck();
 await page.locator('#text').fill('');await page.locator('#palette-box summary').click();for(const k of ['ネ','オ','ン','/','東','京'])await page.locator(`.key[data-key="${k}"]`).click();assert.equal((await state()).text,'ネオン/東京');await page.locator('#backspace').click();assert.equal((await state()).text,'ネオン/東');
 await page.locator('#info').fill('東京/1936');assert.equal((await state()).info,'東京/1936');await page.locator('#info').fill('漢');assert.match(await page.locator('#info-error').textContent(),/“漢”/);await page.locator('#info').fill('');assert.equal((await state()).info,'');
 // Reading direction buttons.
 const dirShots=new Set();for(const d of ['ltr','rtl','ttb']){await page.locator(`[data-direction="${d}"]`).click();assert.equal((await state()).direction,d);assert.equal(await page.locator(`[data-direction="${d}"]`).getAttribute('aria-pressed'),'true');dirShots.add(await stageHTML());
  const o=await page.evaluate(()=>window.currentKana.features.order);if(d==='ttb')assert(o[1][1]>o[0][1]);else assert(d==='ltr'?o[1][0]>o[0][0]:o[1][0]<o[0][0],d);await page.locator('#stage').screenshot({path:path.join(captures,`direction-${d}.png`)});}
 assert.equal(dirShots.size,3);
 // Every enabled control changes the poster; layout and surface sliders disable where unused.
 const controls=await page.evaluate(()=>window.ShowaKana.CONTROLS.map(c=>({key:c.key,uses:c.uses})));let controlChecks=0;
 for(const family of ['victrola','design','kyoto','neon','acid']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.ShowaKana.getState().family===v,family);const s=await state();
  for(const {key,uses} of controls){const on=!uses||Object.entries(uses).every(([k,v])=>v.includes(s[k]));assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on)continue;
   if(key==='leading')await page.locator('#text').fill('ニッケ/デザイン');const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Options, construction presets and colours.
 for(const [id,values] of Object.entries(await page.evaluate(()=>window.ShowaKana.OPTIONS))){if(id==='direction')continue;await page.locator('#reset').click();const seen=new Set();
  for(const v of values){await page.locator('#'+id).selectOption(v);seen.add(await stageHTML());if(id==='style'){const p=await page.evaluate(v=>window.ShowaKana.STYLES.find(s=>s.id===v).preset,v),st=await state();for(const [k,val] of Object.entries(p))assert.equal(st.params[k],val,`${v} preset ${k}`);}}
  assert.equal(seen.size,values.length,id);}
 await page.locator('#reset').click();const beforeColor=await stageHTML();await page.locator('#c1').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await stageHTML());assert.equal((await state()).colors[1],'#ff2a6d');
 // Four passes and every family with its reference.
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentKana.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs=await page.evaluate(()=>Object.fromEntries(window.ShowaKana.SOURCES.map(s=>[s.family,s.id]))),families=[];
 for(const family of await page.evaluate(()=>window.ShowaKana.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentKana.state.family===v,family);
  const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);if(refs[family])assert.match(await page.locator('#ref-img').getAttribute('src'),new RegExp(`references/${refs[family]}\\.(jpg|png)`));
  families.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}
 assert.equal(new Set(families).size,families.length);
 await page.locator('.choose-family[data-family="design"]').click();assert.equal((await state()).family,'design');
 // Saved rule, downloads and URL replay.
 await page.locator('#text').fill('デザイン/ショー');await page.locator('[data-direction="ttb"]').click();await page.locator('#p-weight').fill('21');await page.locator('#p-weight').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await page.locator('#family').selectOption('expo');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.ShowaKana.getState().family==='design');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/Shōwa kana rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('Shōwa display kana'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());
 const dragMs=await page.evaluate(()=>{const s=window.ShowaKana.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,text:'日本大博覧会/東京',params:{...s.params,weight:12+i*.4}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#stage svg').waitFor();await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),checks:['reference image loaded',`specimen: ${glyphCount} glyphs; look-alike sheet`,'ten reference thumbnails','hiragana, half-width kana, lines, romaji and named-character error messages','kana palette typing and delete','information line and its errors','three reading-direction buttons, reading order checked',`${controlChecks} enabled controls change the poster across five families; unused layout and surface sliders disabled`,'five option selects, every value distinct; construction presets applied','colour inputs','four visible construction passes','thirteen families; ten show their source poster, three are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: specimen, kana/romaji/palette input and errors, 3 directions, ${controlChecks} controls, options, colours, 4 stages, ${families.length} families and references, saved-rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
