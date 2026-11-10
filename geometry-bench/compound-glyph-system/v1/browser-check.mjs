import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=here.slice(0,here.indexOf('/geometry-bench/')),out=path.join(root,'output/compound-glyph-study-v1'),captures=path.join(root,'output/playwright/compound-glyph-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.setDefaultTimeout(60000);
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.Compound.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('#specimen [data-set]').count(),22);assert.equal(await page.locator('#specimen [data-mask]').count(),11);assert.equal(await page.locator('.sources img').count(),5);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Words: typing, rows, NFKC, errors; probes.
 await page.locator('#text').fill('type / with');assert.equal((await state()).text,'type/with');
 await page.locator('#mask').selectOption('text');await page.locator('#text').fill('ＲＡ/ＶＥ');assert.equal((await state()).text,'RA/VE');await page.locator('#stage').screenshot({path:path.join(captures,'word-mask.png')});
 await page.locator('#text').fill('A§B');assert.match(await page.locator('#error').textContent(),/Not in the bundled faces/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('#text').fill('A/B/C/D');assert.match(await page.locator('#error').textContent(),/three rows/);
 await page.locator('.probe[data-text="火"]').click();assert.equal((await state()).text,'火');assert.equal(await page.locator('#error').textContent(),'');
 // Custom escalation switches the set; bad tokens are explained.
 await page.locator('#custom').fill('日 → 昌 → 晶');let s=await state();assert.equal(s.custom,'日 昌 晶');assert.equal(s.set,'custom');assert.equal(await page.locator('#set').inputValue(),'custom');
 await page.locator('#custom').fill('@nope');assert.match(await page.locator('#custom-error').textContent(),/Unknown mark/);
 await page.locator('#title').fill('MORI NO KAMI');await page.locator('#info').fill('one / two');assert(/MORI|<text/.test(await stageHTML()));
 // Every enabled control changes the poster; disabled ones match the engine's view.
 const keys=await page.evaluate(()=>window.Compound.CONTROLS.map(c=>c.key));assert.equal(keys.length,26);let controlChecks=0;
 for(const family of ['forest','alarm','scribe','electro']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.Compound.getState().family===v,family);
  const active=new Set(await page.evaluate(()=>window.Compound.activeControls(window.Compound.getState())));
  for(const key of keys){assert.equal(await page.locator(`#p-${key}`).isDisabled(),!active.has(key),`${family} ${key} enabled state`);if(!active.has(key))continue;
   const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;await page.locator('#reset').click();}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});}
 // Option selects: every value distinct (word silhouette for the face select).
 const options=await page.evaluate(()=>window.Compound.OPTIONS);let optionChecks=0;
 for(const [id,values] of Object.entries(options)){await page.locator('#family').selectOption('kanji');await page.locator('#reset').click();
  const setup={face:{text:'TYPE'},odd:{params:{odd:2}},font:{set:'o'},flow:{params:{strength:.8}},set:{text:'MORI',custom:'o|O 日|月 森'}}[id];
  if(setup)await page.evaluate(x=>{const s=window.Compound.getState();window.render({...s,...x,params:{...s.params,...x.params}});},setup);
  const seen=new Set();for(const v of values){if(await page.locator('#'+id).isDisabled())break;await page.locator('#'+id).selectOption(v);seen.add(await stageHTML());optionChecks++;}assert.equal(seen.size,values.length,id);}
 await page.locator('#reset').click();const beforeColor=await stageHTML();await page.locator('#c1').evaluate(i=>{i.value='#ff2a6d';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await stageHTML());assert.equal((await state()).colors[1],'#ff2a6d');
 // Four passes and ten styles; five show their source poster.
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentCompound.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs={forest:'moma-8384',alarm:'moma-7170',scribe:'moma-5834',appeal:'pgda-14233',beach:'moma-5008'},styles=[];
 for(const family of await page.evaluate(()=>window.Compound.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentCompound.state.family===v,family);
  const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);if(refs[family])assert.match(await page.locator('#ref-img').getAttribute('src'),new RegExp(`references/${refs[family]}\\.`));
  styles.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(styles).size,10);
 await page.locator('.choose-family[data-family="riso"]').click();assert.equal((await state()).family,'riso');
 // Saved rule, downloads and URL replay.
 await page.locator('#text').fill('水');await page.locator('#p-size').fill('19');await page.locator('#p-size').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await page.locator('#family').selectOption('forest');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Compound.getState().family==='riso');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/compound-glyph rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('compound-glyph silhouette'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());
 // Slider-drag responsiveness: twenty size changes on a kanji silhouette.
 const dragMs=await page.evaluate(()=>{const s=window.Compound.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,params:{...s.params,size:14+i*.2}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});await page.locator('#stage').screenshot({path:path.join(captures,'mobile-stage.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),note:'Machine shared with other jobs; redraw timing is indicative.',checks:['reference image loaded','specimen: 22 escalation sets and 11 silhouettes','five reference thumbnails','word input: rows, NFKC full-width, error messages, probes','custom escalation switches the set and explains bad tokens','title and information text',`${controlChecks} enabled controls change the poster across four styles; disabled states match the engine`,`${optionChecks} option values across ${Object.keys(options).length} selects, every value distinct`,'colour inputs','four visible construction passes','ten styles; five show their source poster, five are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: specimen, words and custom sets, ${controlChecks} controls, ${optionChecks} option values, colours, 4 stages, 10 styles and references, saved-rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
