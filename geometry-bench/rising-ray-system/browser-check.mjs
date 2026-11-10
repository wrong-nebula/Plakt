import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/rising-ray-study-v1'),captures=path.join(root,'output/playwright/rising-ray-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const stage=()=>page.locator('#stage').innerHTML(),shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.RisingRay.getState());
const setRange=async(key,v)=>{await page.locator(`#p-${key}`).fill(String(v));await page.locator(`#p-${key}`).dispatchEvent('input');};
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 await page.waitForFunction(()=>{const i=document.getElementById('ref-img');return i.complete&&i.naturalWidth>400;});const parts=await page.evaluate(()=>window.RisingRay.SPECIMEN_ROWS.reduce((a,r)=>a+r.tiles.length,0));assert.equal(await page.locator('#specimen [data-part]').count(),parts);assert.equal(await page.locator('.sources img').count(),7);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Copy: title normalisation and the date line.
 await page.locator('#title').fill('théâtre <of> rays');assert.equal((await state()).title,'THEATRE OF RAYS');assert.match(await stage(),/>T</);
 await page.locator('#info').fill('8 / 29 · Tokyo');assert.match(await stage(),/8 \/ 29 · Tokyo/);
 // Every enabled control changes the poster; option-gated controls are disabled where they do nothing.
 const controls=await page.evaluate(()=>window.RisingRay.CONTROLS.map(c=>({key:c.key,when:c.when,min:c.min,max:c.max})));assert.equal(controls.length,18);let controlChecks=0,disabledChecks=0;
 for(const family of ['mishima','neon','riso','theatre']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.RisingRay.getState().family===v,family);const s=await state();
  for(const {key,when,min,max} of controls){const on=!when||Object.entries(when).some(([k,vs])=>vs.includes(s[k]));assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const before=await stage();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stage())await page.locator(`#p-${key}`).press('Home');
   if(before===await stage())await setRange(key,+(min+(max-min)*.37).toFixed(2));
   assert.notEqual(before,await stage(),`${family} ${key}`);controlChecks++;await setRange(key,s.params[key]);}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Option selects: every value distinct (twin and stacked bursts need an off-centre origin).
 const options=await page.evaluate(()=>window.RisingRay.OPTIONS);let optionChecks=0;
 for(const [id,values] of Object.entries(options)){await page.locator('#family').selectOption('neon');await page.locator('#reset').click();await setRange('originX',.3);const seen=new Set();for(const v of values){await page.locator('#'+id).selectOption(v);seen.add(await stage());}assert.equal(seen.size,values.length,id);optionChecks+=values.length;}
 await page.locator('#reset').click();assert.equal(await page.locator('#p-reach').isDisabled(),true);await page.locator('#outline').selectOption('star');assert.equal(await page.locator('#p-reach').isDisabled(),false);
 // Palette replaces the colours; a colour input edits one role.
 await page.locator('#palette').selectOption('acid');assert.equal((await state()).colors[2],'#c6ff3d');assert.equal(await page.locator('#c2').inputValue(),'#c6ff3d');
 const beforeColor=await stage();await page.locator('#c1').evaluate(i=>{i.value='#00ffaa';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await stage());assert.equal((await state()).colors[1],'#00ffaa');
 // Layout presets.
 await page.locator('#reset').click();const layouts=await page.evaluate(()=>window.RisingRay.LAYOUTS.map(l=>l.id)),layoutShots=new Set();
 for(const id of layouts){await page.locator(`.layout[data-layout="${id}"]`).click();const set=await page.evaluate(i=>window.RisingRay.LAYOUTS.find(x=>x.id===i).set,id),s=await state();assert.equal(s.bursts,set.bursts);for(const [k,v] of Object.entries(set.params))assert(Math.abs(s.params[k]-v)<1e-9,`${id} ${k}`);layoutShots.add(await stage());await page.locator('#stage').screenshot({path:path.join(captures,`layout-${id}.png`)});}
 assert.equal(layoutShots.size,layouts.length);
 // Four passes and ten styles; four show their source poster.
 await page.locator('#reset').click();const hashes=[];for(const s of [1,2,3,4]){await page.locator(`[data-stage="${s}"]`).click();await page.waitForFunction(v=>window.currentRay.state.stage===v,s);hashes.push(await shot());}assert.equal(new Set(hashes).size,4);
 const refs={yokoo:'moma-7953',mishima:'moma-7955',tide:'moma-7944',fancy:'moma-5092'},styles=[];
 for(const family of await page.evaluate(()=>window.RisingRay.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentRay.state.family===v,family);
  assert.equal(await page.locator('#comparison').evaluate(e=>e.classList.contains('solo')),!refs[family],family);if(refs[family])assert.equal(await page.locator('#ref-img').getAttribute('src'),`references/${refs[family]}.jpg`);
  styles.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(styles).size,10);
 await page.locator('.choose-family[data-family="tide"]').click();assert.equal((await state()).family,'tide');
 // Saved rule, downloads and URL replay.
 await page.locator('#modulation').selectOption('random');await setRange('seed',404);await setRange('count',31);await page.locator('#format').selectOption('square');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stage();
 await page.locator('#family').selectOption('neon');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.RisingRay.getState().family==='tide');assert.equal(expected,await stage());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/rising-ray rule/);
 await page.locator('#format').selectOption('poster');const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('rising-ray stage'));
 const beforeReload=await stage();await page.reload();await page.locator('#stage svg').waitFor();assert.equal(beforeReload,await stage());
 // Slider-drag responsiveness: twenty count changes on the neon stage.
 const dragMs=await page.evaluate(()=>{const s=window.RisingRay.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,family:'neon',params:{...s.params,count:20+i}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),checks:['reference image loaded',`kit: ${parts} parts`,'seven reference thumbnails','title normalisation and date line',`${controlChecks} enabled controls change the poster across four styles; ${disabledChecks} option-gated controls disabled where inert`,`${optionChecks} option values across ${Object.keys(options).length} selects, every value distinct`,'palette replaces colours; colour input edits one role',`${layouts.length} layout presets applied and distinct`,'four visible construction passes','ten styles; four show their source poster, six are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: kit, copy, ${controlChecks} controls (${disabledChecks} disabled), ${optionChecks} option values, palettes, ${layouts.length} layouts, 4 stages, 10 styles and references, saved-rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
