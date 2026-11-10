import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'output/experimental-letter-systems-v1');
const captures=path.join(root,'output/playwright/letter-shape-systems');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1,acceptDownloads:true});
const page=await context.newPage(),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**',r=>{external.push(r.request().url());r.abort();});
await page.route('http://**',r=>{external.push(r.request().url());r.abort();});
try{
 await page.goto('file://'+path.join(out,'index.html'));
 await page.locator('#stage svg').waitFor();
 assert.equal(await page.locator('.reference-grid figure').count(),10);
 const initial=await page.locator('#stage').innerHTML();
 await page.locator('#word').fill('TY/PE');
 assert.equal(await page.evaluate(()=>window.currentStudy.panels.map(p=>p.character).join('')),'TYPE');
 await page.locator('#system').selectOption('quarter');
 await page.locator('#p-bite').focus();await page.locator('#p-bite').press('Home');
 await page.locator('#p-bite').press('ArrowRight');
 const altered=await page.locator('#stage').innerHTML();assert.notEqual(initial,altered);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 await page.locator('#word').fill('🌸');assert.match(await page.locator('#error').textContent(),/Unsupported/);
 await page.locator('#word').fill('FU/BU');
 // Save and import the same portable rule after changing the current one.
 const ruleDownload=page.waitForEvent('download');await page.locator('#preset-export').click();const rule=await ruleDownload;
 await rule.saveAs(path.join(captures,'ui-saved-rule.json'));
 const before=await page.locator('#stage').innerHTML();
 await page.locator('#system').selectOption('rings');
 await page.locator('#import').setInputFiles(path.join(captures,'ui-saved-rule.json'));
 await page.waitForFunction(()=>window.PosterLetterSystems.getState().system==='quarter');
 assert.equal(before,await page.locator('#stage').innerHTML());
 const pngDownload=page.waitForEvent('download');await page.locator('#png-export').click();const png=await pngDownload;
 await png.saveAs(path.join(captures,'ui-export.png'));
 const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2100);assert.equal(bytes.readUInt32BE(20),3000);
 const svgDownload=page.waitForEvent('download');await page.locator('#svg-export').click();const svg=await svgDownload;
 await svg.saveAs(path.join(captures,'ui-export.svg'));
 assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('<svg'));
 // Reopen the URL with the exact rule, then check the narrow layout.
 const permalink=page.url();await page.reload();assert.equal(before,await page.locator('#stage').innerHTML());
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 // Probe all six in browser; fresh changes must not corrupt inline SVG ids.
 const hashes=[];
 for(const id of ['scallop','capsules','quarter','rings','slices','hinges']){
  await page.locator('#system').selectOption(id);
  await page.waitForFunction(id=>window.currentStudy.state.system===id,id);
  const b=await page.locator('#stage').screenshot({path:path.join(captures,`browser-${id}.png`)});hashes.push(crypto.createHash('sha256').update(b).digest('hex'));
  console.log(id,hashes.at(-1));
 }
 assert.equal(new Set(hashes).size,6);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),viewports:[[1440,1100],[390,844]],checks:['text transfer','geometry slider','unsupported text feedback','JSON save / change / reopen exact replay','2100 x 3000 PNG download','SVG download','URL reload exact replay','six distinct browser renders','no horizontal mobile overflow','zero page errors','offline: zero HTTP requests'],captures,permalink},null,2));
 console.log('PASS: desktop/mobile, six systems, text/slider controls, exact saved rule replay, PNG/SVG downloads, permalink reload and offline operation.');
}finally{await browser.close();}
