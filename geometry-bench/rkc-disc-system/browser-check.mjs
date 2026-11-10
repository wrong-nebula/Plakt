import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'output/rkc-disc-study-v2'),captures=path.join(root,'output/playwright/rkc-disc-system-v2');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true});
const page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const hash=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const features=()=>page.evaluate(()=>window.currentRKC.features);
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 const start=await features();assert.deepEqual([start.layout,start.format,start.cols,start.fieldRows],['fit','december',5,7],'starts on the source 5 × 7 field');
 assert.equal(await page.locator('#study-name').textContent(),'December rule');
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Text and slider input render on the next animation frame.
 await page.locator('#letters').fill('FU/BU');await page.waitForFunction(()=>window.currentRKC.glyphs.map(g=>g.character).join('')==='FUBU');
 await page.locator('#p-neck').focus();await page.locator('#p-neck').press('End');await page.waitForFunction(()=>window.currentRKC.state.params.neck===1);
 await page.locator('#letters').fill('🍒');assert.match(await page.locator('#error').textContent(),/Unsupported/);
 await page.locator('.probe[data-text="R"]').click();await page.locator('#reset').click();
 // The December rule has no bonds, so its bond pass equals the ink field; Solid uses every pass.
 await page.locator('.preset[data-preset="solid"]').click();await page.waitForFunction(()=>window.currentRKC.state.figure==='both');
 const stages=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentRKC.state.stage===v,stage);stages.push(await hash());}
 assert.equal(new Set(stages).size,4,'four visible stages');await page.locator('.preset[data-preset="december"]').click();
 const families=[];for(const f of ['disc','pillow','facet']){await page.locator('#family').selectOption(f);await page.waitForFunction(v=>window.currentRKC.state.family===v,f);
  families.push(await hash());await page.locator('#stage').screenshot({path:path.join(captures,`browser-${f}.png`)});}
 assert.equal(new Set(families).size,3,'three visible families');await page.locator('#family').selectOption('disc');
 // Bonds and backing are live; the rule name follows the controls.
 const bonds=[await hash()];
 await page.locator('#figure').selectOption('both');await page.waitForFunction(()=>window.currentRKC.state.figure==='both');bonds.push(await hash());
 await page.locator('#ground').selectOption('down');await page.waitForFunction(()=>window.currentRKC.state.ground==='down');bonds.push(await hash());
 assert.equal(await page.locator('#study-name').textContent(),'Solid rule');
 await page.locator('#backing').uncheck();await page.waitForFunction(()=>!window.currentRKC.state.backing);bonds.push(await hash());
 assert.equal(new Set(bonds).size,4,'bond and backing changes are visible');assert.equal(await page.locator('#study-name').textContent(),'Custom rule');
 await page.locator('.preset[data-preset="night"]').click();await page.waitForFunction(()=>window.currentRKC.state.family==='facet'&&window.currentRKC.state.colors[1]==='#e3ff3d');
 assert.equal(await page.evaluate(()=>window.currentRKC.state.text),'R','a rule keeps the text');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();await (await ruleEvent).saveAs(path.join(captures,'ui-rule.json'));
 const expected=await page.locator('#stage').innerHTML();await page.locator('.preset[data-preset="december"]').click();assert.notEqual(expected,await page.locator('#stage').innerHTML());
 await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.RKC.getState().family==='facet');assert.equal(expected,await page.locator('#stage').innerHTML());
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();await (await pngEvent).saveAs(path.join(captures,'ui-export.png'));
 const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2160);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();await (await svgEvent).saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').startsWith('<svg'));
 await page.reload();assert.equal(expected,await page.locator('#stage').innerHTML(),'URL replay');
 await page.locator('#layout').selectOption('field');assert.equal(await page.evaluate(()=>window.currentRKC.width),530);assert(await page.locator('#format-row').isHidden(),'format picker only shows for fit');
 await page.locator('#layout').selectOption('fit');await page.locator('#letters').fill('DECEMBER');await page.waitForFunction(()=>window.currentRKC.state.text==='DECEMBER');
 await page.locator('#format').selectOption('billboard');assert.equal(await page.evaluate(()=>window.currentRKC.width),3000);assert.equal((await features()).rowsText.join('/'),'DECEMBER');
 assert(await page.evaluate(()=>document.getElementById('comparison').classList.contains('wide')));await page.screenshot({path:path.join(captures,'fit-billboard.png')});
 const fitPng=page.waitForEvent('download');await page.locator('#save-png').click();await (await fitPng).saveAs(path.join(captures,'ui-fit-export.png'));
 const fitBytes=fs.readFileSync(path.join(captures,'ui-fit-export.png'));assert.equal(fitBytes.readUInt32BE(16),3000);assert.equal(fitBytes.readUInt32BE(20),1000);
 await page.reload();assert.equal(await page.evaluate(()=>window.currentRKC.state.format),'billboard');
 await page.locator('.use-preset[data-preset="woven"]').click();await page.waitForFunction(()=>window.currentRKC.state.ground==='down'&&window.currentRKC.state.figure==='across');
 await page.locator('#format').selectOption('december');await page.locator('.probe[data-text="R"]').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no horizontal scroll on a phone');
 await page.locator('#presets').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(captures,'mobile-rules.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,checks:['starts on the December 5 × 7 field','text and slider controls','invalid input and recovery','4 distinct visible stages','3 distinct families','letter/counter bonds and backing are live','rule name follows the controls','named rules keep the text','saved JSON exact replay','2160 × 3000 PNG download','SVG download','URL reload exact replay','natural field layout','fit layout with format picker','3000 × 1000 billboard PNG download','fit format survives reload','gallery “Use this rule”','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log('PASS: live editor, text/geometry controls, 4 stages, 3 families, bonds and rules, saved-rule and URL replay, fit formats, SVG/PNG downloads, desktop/mobile and offline checks.');
}finally{await browser.close();}
