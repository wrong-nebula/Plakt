import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/darkmatter-study-v2'),captures=path.join(root,'output/playwright/darkmatter-system-v2');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']}),context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const state=()=>page.evaluate(()=>window.DarkMatter.getState()),shot=async name=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot(name?{path:path.join(captures,name)}:{})).digest('hex');
const download=async(button,name)=>{const event=page.waitForEvent('download');await page.locator(button).click();const d=await event;await d.saveAs(path.join(captures,name));return path.join(captures,name);};
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 const inView=()=>page.evaluate(()=>window.rendered.getBoundingClientRect().bottom<=innerHeight+1);assert(await inView(),'source comparison fits the window');assert.equal(await page.locator('.reference img').evaluate(i=>i.naturalWidth),700);await page.screenshot({path:path.join(captures,'desktop.png')});
 // Source collage: format and the measured-contour controls are off below the poster step.
 assert(await page.locator('#format').isDisabled());await page.locator('[data-stage="3"]').click();assert(await page.locator('#p-stem').isDisabled());await page.locator('[data-stage="4"]').click();assert(!(await page.locator('#p-stem').isDisabled()));
 // Any text is packed; '/' starts a line.
 await page.locator('#text').fill('FUBU');assert.equal(await page.evaluate(()=>window.currentDarkMatter.frames.map(g=>g.ch).join('')),'FUBU');assert(await inView(),'packed poster fits the window');assert.equal(await page.evaluate(()=>window.$features.layout),'packed');assert(await page.locator('#comparison.solo').count());
 await page.locator('#text').fill('helsinki / 2026');assert.equal((await state()).text,'HELSINKI/2026');assert.equal(await page.evaluate(()=>window.$features.rows),2);
 await page.locator('#text').fill('blå bær / grüße');assert.equal((await state()).text,'BLÅ BÆR/GRÜSSE');assert.equal(await page.evaluate(()=>window.currentDarkMatter.frames.map(g=>g.ch).join('')),'BLÅBÆRGRÜSSE');
 await page.locator('#text').fill('🌺');assert.match(await page.locator('#error').textContent(),/Use A/);assert.equal(await page.locator('#text').getAttribute('aria-invalid'),'true');
 await page.locator('.probe[data-text="DARK MATTER"]').click();assert.equal(await page.evaluate(()=>window.$features.rows),3);
 // Layouts and formats.
 assert(await page.locator('#p-width').isDisabled());assert(!(await page.locator('#p-interlock').isDisabled()));const locked=await shot();await page.locator('#p-interlock').focus();await page.locator('#p-interlock').press('Home');assert.equal((await state()).params.interlock,0);assert.notEqual(locked,await shot());await page.locator('#p-interlock').press('End');
 await page.locator('#layout').selectOption('rows');assert(!(await page.locator('#p-width').isDisabled()));assert(await page.locator('#p-interlock').isDisabled());const before=await shot();await page.locator('#p-tracking').focus();await page.locator('#p-tracking').press('End');assert.equal((await state()).params.tracking,.3);assert.notEqual(before,await shot());await page.locator('#layout').selectOption('packed');
 const formats={};for(const f of ['story','square','landscape','poster']){await page.locator('#format').selectOption(f);await page.waitForFunction(v=>window.currentDarkMatter.state.format===v,f);formats[f]=await page.evaluate(()=>[window.rendered.getAttribute('width'),window.rendered.getAttribute('height')].map(Number));await shot(`format-${f}.png`);}
 assert.deepEqual(formats,{story:[619,1100],square:[1100,1100],landscape:[1956,1100],poster:[700,1100]});
 // Construction controls and stages on the alphabet.
 await page.locator('#p-stem').focus();await page.locator('#p-stem').press('End');assert.equal((await state()).params.stem,42);await page.locator('#p-fill').focus();await page.locator('#p-fill').press('Home');assert.equal((await state()).params.fill,0);await page.locator('#reset').click();assert.equal((await state()).params.stem,32);assert.equal((await state()).text,'DARK MATTER');
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentDarkMatter.state.stage===v,stage);assert.equal(await page.locator('#p-aperture').isDisabled(),stage<3);hashes.push(await shot());}assert.equal(new Set(hashes).size,4);
 // Six edge systems, each with its own control; choosing one keeps the colours.
 const own={scooped:'bend',stepped:'terrace',faceted:'facets',ogee:'swing',soft:'soften'},colours=(await state()).colors,systems=[];
 for(const family of ['wedges','scooped','faceted','ogee','soft','stepped']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentDarkMatter.state.family===v,family);for(const [f,key] of Object.entries(own))assert.equal(await page.locator('#p-'+key).count(),f===family?1:0,family+' '+key);assert.deepEqual((await state()).colors,colours);systems.push(await shot(`browser-${family}.png`));}assert.equal(new Set(systems).size,6);
 // Treatments: each shows only its own controls and changes the poster.
 const treatments=[];for(const t of ['inline','outline','hatched','sliced','shadow','solid']){await page.locator('#treatment').selectOption(t);await page.waitForFunction(v=>window.currentDarkMatter.state.treatment===v,t);assert.equal(await page.locator('#treatment-head').isHidden(),t==='solid');assert.equal(await page.locator('#p-inset').count(),['inline','outline'].includes(t)?1:0);assert.equal(await page.locator('#p-depth').count(),t==='shadow'?1:0);treatments.push(await shot(`treatment-${t}.png`));}assert.equal(new Set(treatments).size,6);
 // The variations strip: twelve live thumbnails of the current text; choosing one applies it.
 await page.waitForFunction(()=>document.querySelectorAll('.vrow .thumb svg').length===12&&window.variationsReady,null,{timeout:60000});await page.locator('.variations').screenshot({path:path.join(captures,'variations.png')});
 await page.locator('[data-vtreatment="outline"]').click();assert.equal((await state()).treatment,'outline');await page.locator('[data-vfamily="ogee"]').click();assert.equal((await state()).family,'ogee');assert.deepEqual((await state()).colors,colours);
 await page.locator('[data-vtreatment="solid"]').click();await page.locator('#family').selectOption('stepped');await page.waitForFunction(()=>window.currentDarkMatter.state.family==='stepped');
 await page.locator('#p-terrace').focus();await page.locator('#p-terrace').press('End');assert.equal((await state()).params.terrace,30);
 // Palettes and inversion.
 await page.locator('[data-palette="acid"]').click();assert.deepEqual((await state()).colors,['#0d0f10','#d6ff3d','#0d0f10']);assert.equal(await page.locator('[data-palette="acid"]').getAttribute('aria-pressed'),'true');
 const plain=await page.locator('#stage').innerHTML();await page.locator('#invert').click();assert.notEqual(plain,await page.locator('#stage').innerHTML());await page.locator('#invert').click();assert.equal(plain,await page.locator('#stage').innerHTML());
 // Saved rules: v2 replay, and a v1 rule opens as packed text.
 const rule=await download('#save-rule','ui-rule.json'),expected=await page.locator('#stage').innerHTML();await page.locator('#family').selectOption('wedges');await page.locator('#load-rule').setInputFiles(rule);await page.waitForFunction(()=>window.DarkMatter.getState().family==='stepped');assert.equal(expected,await page.locator('#stage').innerHTML());
 await page.locator('#load-rule').setInputFiles(path.join(root,'output/darkmatter-study-v1/scooped-fubu.json'));await page.waitForFunction(()=>window.DarkMatter.getState().text==='FUBU');assert.equal((await state()).engine,'darkmatter-v2');assert.equal(await page.evaluate(()=>window.$features.layout),'packed');
 await page.locator('#load-rule').setInputFiles(rule);await page.waitForFunction(()=>window.DarkMatter.getState().family==='stepped');
 // Exports.
 const pngFile=await download('#save-png','ui-export.png'),bytes=fs.readFileSync(pngFile);assert.equal(bytes.readUInt32BE(16),1909);assert.equal(bytes.readUInt32BE(20),3000);
 await page.locator('#format').selectOption('landscape');const wide=fs.readFileSync(await download('#save-png','ui-export-landscape.png'));assert.equal(wide.readUInt32BE(16),3000);assert.equal(wide.readUInt32BE(20),1687);
 const svg=fs.readFileSync(await download('#save-svg','ui-export.svg'),'utf8');assert(svg.includes('quarter-discs'));assert(!/clipPath|<mask/.test(svg));
 // URL replay, mobile width, offline.
 const current=await page.locator('#stage').innerHTML();await page.reload();await page.locator('#stage svg').waitFor();assert.equal(current,await page.locator('#stage').innerHTML());
 const unshuffled=await state();await page.locator('#shuffle').click();const shuffled=await state();for(const k of ['family','treatment','palette'])assert.notEqual(shuffled[k],unshuffled[k],'shuffle changes '+k);assert.equal(shuffled.text,unshuffled.text);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,checks:['rectified reference image loaded','source collage: format and measured-contour controls disabled where inert','any text packed; / line breaks','Nordic and umlaut input kept','interlock slider: effective on packed, disabled on rows','invalid-input recovery','even rows: setting controls enabled and effective','four formats at their sizes','stem, fill and reset','four visible passes','six edge systems with their own controls, colours kept','six treatments with their own controls','variations strip: twelve live thumbnails, choosing one applies it','shuffle picks another system, treatment and palette','poster fits the window height','terrace slider','palette chips','inversion round trip','saved v2 rule exact replay','v1 rule opens as packed text','1909 × 3000 and 3000 × 1687 PNG downloads','SVG download with plain paths','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log('PASS: text/line input, layouts, formats, controls, 4 stages, 6 systems, 6 treatments, variations strip, palettes, inversion, v1/v2 rules, SVG/PNG downloads, URL replay, mobile and offline.');
}finally{await browser.close();}
