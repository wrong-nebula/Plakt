import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/strata-field-study-v1'),captures=path.join(root,'output/playwright/strata-field-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.Strata.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
const pick=async(id,v)=>{await page.locator('#'+id).selectOption(v);await page.waitForFunction(([k,x])=>window.Strata.getState()[k]===x,[id,v]);};
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('.sources img').count(),7);assert.equal(await page.locator('.families img').count(),11);
 await page.waitForFunction(()=>document.querySelectorAll('#specimen [data-tile]').length===10);await page.screenshot({path:path.join(captures,'desktop.png')});
 // Title and information.
 await page.locator('#title').fill('Deep Time');await page.locator('#info').fill('Strata / 12 – 30 May');assert.match(await stageHTML(),/Deep Time/);assert.match(await stageHTML(),/12 – 30 May/);assert.equal((await state()).title,'Deep Time');
 // Every enabled control changes the poster; controls that do not apply are disabled.
 const controls=await page.evaluate(()=>window.Strata.CONTROLS.map(c=>c.key));assert.equal(controls.length,33);let controlChecks=0,disabledChecks=0;
 for(const family of ['awazu','nagai','contour','kizashi','riso']){await pick('family',family);
  for(const key of controls){const on=await page.evaluate(k=>window.Strata.active(window.Strata.CONTROLS.find(c=>c.key===k).needs,window.Strata.getState()),key);assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Options: every value distinct, each in a state where it applies; dependent options disable.
 await pick('family','awazu');const options=await page.evaluate(()=>window.Strata.OPTIONS);let optionChecks=0;
 for(const [id,values] of Object.entries(options)){await page.locator('#reset').click();
  if(['inlayFill','inlayLayer'].includes(id)){await pick('inlay','disc');await page.locator('#p-inlaySize').focus();await page.locator('#p-inlaySize').press('End');}
  if(id==='order')for(const k of ['amplitude','drift']){await page.locator('#p-'+k).focus();await page.locator('#p-'+k).press('End');}
  const seen=new Set();for(const v of values){await pick(id,v);seen.add(await stageHTML());}assert.equal(seen.size,values.length,id);optionChecks+=values.length;}
 await page.locator('#reset').click();assert(await page.locator('#inlayFill').isDisabled());await pick('direction','contour');assert(await page.locator('#order').isDisabled());await page.locator('#reset').click();
 // Colours, palettes and the seed.
 let before=await stageHTML();await page.locator('#c4').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(before,await stageHTML());assert.equal((await state()).colors[4],'#ff2a6d');
 await pick('palette','neon');assert.deepEqual((await state()).colors,await page.evaluate(()=>window.Strata.PALETTES.find(p=>p.id==='neon').colors));assert.equal(await page.locator('#c1').inputValue(),(await state()).colors[1]);
 before=await stageHTML();const seed0=(await state()).params.seed;await page.locator('#shuffle').click();assert.notEqual((await state()).params.seed,seed0);assert.notEqual(before,await stageHTML());await page.locator('#reset').click();
 // The drawn curve: typing, errors, dragging and the keyboard.
 await pick('displace','drawn');assert(!(await page.locator('#profile').isDisabled()));await page.locator('#profile').fill('0 1 0 1');assert.deepEqual((await state()).profile,[0,1,0,1]);
 await page.locator('#profile').fill('0 x');assert.match(await page.locator('#profile-error').textContent(),/numbers/);assert.equal(await page.locator('#profile').getAttribute('aria-invalid'),'true');await page.locator('#profile').fill('.2 .8 .4');
 before=await stageHTML();const handle=page.locator('#profile-svg circle[data-i="1"]'),box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+40,{steps:4});await page.mouse.up();
 const dragged=(await state()).profile[1];assert(dragged<.8,`drag moved the point to ${dragged}`);assert.notEqual(before,await stageHTML());await page.locator('#profile-svg circle[data-i="0"]').focus();await page.keyboard.press('ArrowUp');assert.equal((await state()).profile[0],.25);
 await page.locator('#stage').screenshot({path:path.join(captures,'drawn-curve.png')});await page.locator('#reset').click();assert(await page.locator('#profile').isDisabled());
 // Four passes and eleven styles, with their references.
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentStrata.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs=await page.evaluate(()=>Object.fromEntries(window.Strata.SOURCES.filter(s=>s.family).map(s=>[s.family,s.id]))),systems=[];
 for(const family of await page.evaluate(()=>window.Strata.FAMILIES.map(f=>f.id))){await pick('family',family);const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);
  if(refs[family])assert.match(await page.locator('#ref-img').getAttribute('src'),new RegExp(`references/${refs[family]}\\.`));systems.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}
 assert.equal(new Set(systems).size,11);await page.locator('.choose-family[data-family="neon"]').click();assert.equal((await state()).family,'neon');
 // Saved rule, downloads and URL replay.
 await page.locator('#p-amplitude').fill('0.4');await page.locator('#p-amplitude').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await pick('family','awazu');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Strata.getState().family==='neon');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'spectral-echo-v1'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/strata field rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('strata line fields'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());
 // Slider-drag responsiveness: twenty amplitude changes on the default style.
 const dragMs=await page.evaluate(()=>{const s=window.Strata.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,family:'awazu',params:{...s.params,amplitude:.05+i*.01}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),checks:['reference image loaded','specimen: 10 tiles','seven reference thumbnails and eleven style images','title and information text',`${controlChecks} enabled controls change the poster across five styles; ${disabledChecks} controls disabled where they do not apply`,`${optionChecks} option values distinct (eleven selects); dependent selects disable`,'colour inputs and palette select','seed shuffle','drawn curve: typing, error message, pointer drag and arrow keys','four visible construction passes','eleven styles; six show their source poster, five are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: specimen, text, ${controlChecks} controls (${disabledChecks} disabled), ${optionChecks} option values, colours, palette, seed, drawn curve, 4 stages, 11 styles and references, saved-rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
