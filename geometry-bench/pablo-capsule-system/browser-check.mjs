import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'output/pablo-capsule-study-v1'),captures=path.join(root,'output/playwright/pablo-capsule-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true});
const page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async(name)=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot(name?{path:path.join(captures,name)}:{})).digest('hex');
const lines=()=>page.evaluate(()=>window.currentPablo.lines.map(l=>l.glyphs.map(g=>g.ch).join('')));
try{
 await page.goto('file://'+path.join(out,'index.html'));assert.deepEqual(errors,[]);await page.locator('#stage svg').waitFor();
 await page.screenshot({path:path.join(captures,'desktop.png')});assert(await page.locator('#p-offset').isDisabled());
 assert.equal(await page.locator('#specimen-figures svg').count(),1,'figures specimen');
 await page.locator('#text').fill('FUBU/STUDIO');assert.deepEqual(await lines(),['fuBu','stuDio'],'unicase capitals keep the B and D capital forms');
 await page.locator('#text').fill('2.12.2022/21:00 (Pool)');assert.deepEqual(await lines(),['2.12.2022','21:00 (pool)'],'figures and punctuation');
 await page.locator('#text').fill('15.-\\/25.-');assert.deepEqual(await lines(),['15.-/25.-'],'escaped slash');
 await page.locator('#p-seam').focus();await page.locator('#p-seam').press('End');assert.equal(await page.evaluate(()=>window.Pablo.getState().params.seam),.14);
 await page.locator('#text').fill('🌺');assert.match(await page.locator('#error').textContent(),/Unsupported/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('.probe[data-text="capsule/type/system"]').click();assert.deepEqual(await lines(),['capsule','type','system']);
 await page.locator('#layout').selectOption('source');assert.match(await page.locator('#error').textContent(),/exactly two lines/);assert.equal(await page.locator('#layout').inputValue(),'up','layout reverts when the text does not fit');
 await page.locator('.probe[data-text="pablo/nouvelle"]').click();await page.locator('#reset').click();
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentPablo.state.stage===v,stage);hashes.push(await shot());}assert.equal(new Set(hashes).size,4);
 const layouts=[];for(const layout of ['up','down','rows','source']){await page.locator('#layout').selectOption(layout);await page.waitForFunction(v=>window.currentPablo.state.layout===v,layout);layouts.push(await shot(`browser-layout-${layout}.png`));}
 assert.equal(new Set(layouts).size,4);assert(await page.locator('#fit').isDisabled());assert(await page.locator('#p-width').isDisabled(),'width is inert in the source layout');
 await page.locator('#layout').selectOption('up');assert(!(await page.locator('#p-width').isDisabled()));
 await page.locator('#fit').selectOption('even');await page.waitForFunction(()=>window.currentPablo.state.fit==='even');const even=await shot();await page.locator('#fit').selectOption('fill');assert.notEqual(even,await shot());
 const systems=[];for(const f of ['incised','twin','offset']){await page.locator('#family').selectOption(f);await page.waitForFunction(v=>window.currentPablo.state.family===v,f);systems.push(await shot(`browser-${f}.png`));}assert.equal(new Set(systems).size,3);assert(!(await page.locator('#p-offset').isDisabled()));
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));
 const expected=await page.locator('#stage').innerHTML();await page.locator('#family').selectOption('incised');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Pablo.getState().family==='offset');assert.equal(expected,await page.locator('#stage').innerHTML());
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2139);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('<svg'));
 await page.reload();assert.equal(expected,await page.locator('#stage').innerHTML());
 const fontHref=await page.locator('#font-family').getAttribute('href');assert(fs.existsSync(path.join(out,fontHref)),'font link points at the family page');
 const before=await shot();await page.locator('#cut').selectOption('compressed');await page.waitForFunction(()=>window.currentPablo.state.cut==='compressed');assert.notEqual(before,await shot('browser-compressed.png'),'compressed cut changes the setting');await page.locator('#cut').selectOption('regular');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 // The family page loads the latest OTF of each of the seven styles through @font-face.
 await page.setViewportSize({width:1280,height:900});await page.goto('file://'+path.join(out,'font/index.html'));
 const faces=await page.evaluate(async()=>{await document.fonts.ready;return [...document.fonts].map(f=>[f.family.replace(/"/g,''),f.status]);});
 assert.equal(faces.length,7);assert(faces.every(([,status])=>status==='loaded'),'every font face loads: '+JSON.stringify(faces));
 // Fill sits exactly under Tube and Tube Shadow of the same version: identical widths in the browser.
 const stacks=await page.evaluate(()=>[...document.querySelectorAll('.stack')].map(s=>[...s.children].map(c=>c.getBoundingClientRect().width)));
 assert.equal(stacks.length,2,'Fill is stacked under Tube and Tube Shadow');assert(stacks.every(([a,b])=>a>0&&Math.abs(a-b)<.01),'stacked layers share every advance: '+JSON.stringify(stacks));
 await page.screenshot({path:path.join(captures,'fonts-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'fonts-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'family page fits a phone');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,checks:['text input with / lines and \\/ slashes','figures and punctuation','invalid-input message','seam slider','source layout refuses three lines and reverts','four visible construction passes','four distinct layouts','fit control and its disabled state in the source layout','three cutting systems','conditional displacement control','saved-rule exact replay','2139 × 3000 PNG download','SVG download','URL reload exact replay','compressed cut','family page: seven fonts load, Fill stacks under Tube and Shadow, fits a phone','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log('PASS: text/figures/punctuation input, controls, 4 stages, 4 layouts, fit, 3 systems, SVG/PNG/rule round trips, compressed cut, family page with seven fonts and stacked Fill, mobile and offline checks.');
}finally{await browser.close();}
