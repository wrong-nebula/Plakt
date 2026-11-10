import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'output/punkt-capsule-study-v2'),captures=path.join(root,'output/playwright/punkt-capsule-system-v2');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true});
const page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
try{
 await page.goto('file://'+path.join(out,'index.html'));assert.deepEqual(errors,[]);await page.locator('#stage svg').waitFor();
 assert.equal(await page.evaluate(()=>window.currentPunkt.features.layout),'source-proportion');
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Text and slider input render on the next animation frame.
 await page.locator('#letters').fill('FU/BU');await page.waitForFunction(()=>window.currentPunkt.glyphs.map(g=>g.character).join('')==='FUBU');
 await page.locator('#p-fusion').focus();await page.locator('#p-fusion').press('End');await page.waitForFunction(()=>window.currentPunkt.state.params.fusion===1);
 await page.locator('#letters').fill('🌺');assert.match(await page.locator('#error').textContent(),/Unsupported/);
 await page.locator('.probe[data-text="PUNKT"]').click();await page.locator('#reset').click();
 const stageHashes=[];for(const stage of [1,2,3,4]){
  await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentPunkt.state.stage===v,stage);
  stageHashes.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex'));
 }assert.equal(new Set(stageHashes).size,4);
 const familyHashes=[];for(const f of ['joined','fluted','waisted']){
  await page.locator('#family').selectOption(f);await page.waitForFunction(v=>window.currentPunkt.state.family===v,f);
  familyHashes.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${f}.png`)})).digest('hex'));
 }assert.equal(new Set(familyHashes).size,3);
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));
 const expected=await page.locator('#stage').innerHTML();await page.locator('#family').selectOption('joined');
 await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Punkt.getState().family==='waisted');assert.equal(expected,await page.locator('#stage').innerHTML());
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));
 const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2004);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('<svg'));
 await page.reload();assert.equal(expected,await page.locator('#stage').innerHTML());
 await page.locator('#layout').selectOption('rows');assert.equal(await page.evaluate(()=>window.currentPunkt.width),700);
 assert(await page.locator('#format-row').isHidden(),'format picker only shows for the fit layout');
 // Fit: the format picker appears, wide formats switch the comparison to a wide grid.
 await page.locator('#layout').selectOption('fit');assert.equal(await page.evaluate(()=>window.currentPunkt.features.layout),'fit');assert(await page.locator('#format-row').isVisible());
 await page.locator('#format').selectOption('billboard');assert.equal(await page.evaluate(()=>window.currentPunkt.width),3000);
 assert(await page.evaluate(()=>document.getElementById('comparison').classList.contains('wide')));await page.screenshot({path:path.join(captures,'fit-billboard.png')});
 const fitPng=page.waitForEvent('download');await page.locator('#save-png').click();const fitDownload=await fitPng;await fitDownload.saveAs(path.join(captures,'ui-fit-export.png'));
 const fitBytes=fs.readFileSync(path.join(captures,'ui-fit-export.png'));assert.equal(fitBytes.readUInt32BE(16),3000);assert.equal(fitBytes.readUInt32BE(20),1000);
 await page.reload();assert.equal(await page.evaluate(()=>window.currentPunkt.state.format),'billboard');
 await page.locator('#format').selectOption('poster');await page.locator('#layout').selectOption('packed');assert.equal(await page.evaluate(()=>window.currentPunkt.width),668);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,checks:['source-proportion preview','text and slider controls','invalid input and recovery','4 distinct visible stages','3 distinct families','saved JSON exact replay','2004 × 3000 PNG download','SVG download','URL reload exact replay','layout switching','fit layout with format picker','3000 × 1000 billboard PNG download','fit format survives reload','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log('PASS: live editor, text/geometry controls, 4 stages, 3 families, saved-rule and URL replay, fit formats, SVG/PNG downloads, desktop/mobile and offline checks.');
}finally{await browser.close();}
