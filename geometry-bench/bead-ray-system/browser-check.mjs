import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/bead-ray-study-v2'),v1out=path.join(root,'output/bead-ray-study-v1'),captures=path.join(root,'output/playwright/bead-ray-system-v2');fs.mkdirSync(captures,{recursive:true});
fs.writeFileSync(path.join(captures,'star.png'),new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"><rect width="200" height="280" fill="#000"/><path d="M100 30 L124 104 L200 104 L138 148 L162 222 L100 176 L38 222 L62 148 L0 104 L76 104Z" fill="#fff"/></svg>`).render().asPng());
const strip=svg=>svg.replaceAll(svg.match(/id="[a-z]+-([a-z0-9]+)/)?.[1]??'\u0000','');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.BeadRay.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
const choose=async id=>{await page.locator('#family').selectOption(id);await page.waitForFunction(v=>window.BeadRay.getState().family===v,id);};
const download=async(button,name)=>{const ev=page.waitForEvent('download');await page.locator(button).click();const d=await ev;await d.saveAs(path.join(captures,name));return fs.readFileSync(path.join(captures,name));};
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 const families=await page.evaluate(()=>window.BeadRay.FAMILIES.map(f=>({id:f.id,kind:f.kind})));assert.equal(families[0].kind,'v2');assert.equal((await state()).family,families[0].id);
 assert.equal(await page.locator('#specimen [data-tile]').count(),60);assert.equal(await page.locator('.sources img').count(),7);assert.equal(await page.locator('.families img').count(),families.length);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Every control is enabled exactly when it changes the picture, and every enabled control changes it.
 const controls=await page.evaluate(()=>window.BeadRay.CONTROLS.map(c=>c.key));let controlChecks=0,disabledChecks=0;
 for(const family of ['sunflower','letter','tide','coin','truchet','riso','seeds']){await choose(family);
  for(const key of controls){const on=await page.evaluate(k=>window.BeadRay.applies(k,window.BeadRay.getState()),key);assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;await page.locator('#reset').click();}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});}
 // Option selects: enabled ones give a distinct picture per value; disabled ones are disabled.
 const options=await page.evaluate(()=>window.BeadRay.OPTIONS);let optionChecks=0;
 for(const family of ['vortex','dither']){await choose(family);for(const [id,values] of Object.entries(options)){await page.locator('#reset').click();if(id==='shape'&&!(await page.locator('#source').isDisabled()))await page.locator('#source').selectOption('shape');if(id==='maskMode'&&!(await page.locator('#bloomMask').isDisabled()))await page.locator('#bloomMask').selectOption('shape');if(id==='beadAlt'&&!(await page.locator('#bead').isDisabled()))await page.locator('#bead').selectOption('egg');
  const on=await page.evaluate(k=>window.BeadRay.applies(k,window.BeadRay.getState()),id);assert.equal(await page.locator('#'+id).isDisabled(),!on,`${family} ${id}`);if(!on)continue;
  const vals=values.filter(v=>v!=='image'&&v!=='paint'),seen=new Set();for(const v of vals){await page.locator('#'+id).selectOption(v);seen.add(await stageHTML());}assert.equal(seen.size,vals.length,`${family} ${id}`);optionChecks+=seen.size;}}
 // Word masks and letter beads.
 await choose('letter');assert(await page.locator('#word-box').isVisible());const w0=await stageHTML();await page.locator('#word').fill('sun');assert.equal((await state()).word,'SUN');assert.notEqual(w0,await stageHTML());
 await page.locator('#word').fill('A&B');assert.match(await page.locator('#word-error').textContent(),/Use A–Z/);await page.locator('#word').fill('ray');await page.locator('#stage').screenshot({path:path.join(captures,'word-mask.png')});
 // Click to place: the bloom centre follows the click; in the field a click adds a bloom and Alt-click removes one.
 await choose('sunflower');let box=await page.locator('#stage svg').boundingBox();await page.mouse.click(box.x+box.width*.3,box.y+box.height*.4);let s=await state();
 assert(Math.abs(s.params.shiftX+.2)<.02&&Math.abs(s.params.shiftY-(.4-.53))<.02,`centre ${s.params.shiftX} ${s.params.shiftY}`);await page.locator('#stage').screenshot({path:path.join(captures,'placed-centre.png')});
 await choose('seeds');const seeded=(await page.evaluate(()=>window.currentRender.features.blooms.length));box=await page.locator('#stage svg').boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.85);
 assert.equal((await state()).centres.length,seeded+1);await page.keyboard.down('Alt');await page.mouse.click(box.x+box.width*.5,box.y+box.height*.85);await page.keyboard.up('Alt');assert.equal((await state()).centres.length,seeded);
 await page.mouse.click(box.x+box.width*.2,box.y+box.height*.3);assert.equal((await state()).centres.length,seeded+1);await page.locator('#stage').screenshot({path:path.join(captures,'placed-field.png')});await page.locator('#clear-centres').click();assert.equal((await state()).centres.length,0);
 // Paint the source: the first stroke samples the current source into a grid; strokes change it.
 await choose('coin');assert.equal(await page.locator('#paint').isDisabled(),false);await page.locator('#paint').click();assert.equal(await page.locator('#paint').getAttribute('aria-pressed'),'true');const p0=await stageHTML();
 box=await page.locator('#stage svg').boundingBox();await page.locator('#brush-tone').selectOption('0');await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();for(let i=0;i<=12;i++)await page.mouse.move(box.x+box.width*(.3+i*.03),box.y+box.height*(.5+Math.sin(i/2)*.05));await page.mouse.up();
 await page.waitForFunction(()=>window.BeadRay.getState().source==='paint');s=await state();assert(s.paint.w>=4&&s.paint.data.length===s.paint.w*s.paint.h*2);assert.notEqual(p0,await stageHTML());assert.match(await page.locator('#status').textContent(),/painted/);
 await page.locator('#stage').screenshot({path:path.join(captures,'painted.png')});await page.locator('#paint').click();assert.equal(await page.locator('#paint').getAttribute('aria-pressed'),'false');
 const src=await download('#save-source','source.png');assert.equal(Math.max(src.readUInt32BE(16),src.readUInt32BE(20)),480);
 // Local image.
 await choose('hatch');await page.locator('#image-file').setInputFiles(path.join(captures,'star.png'));await page.waitForFunction(()=>window.BeadRay.getState().source==='image');assert.equal((await state()).image.w,51);await page.locator('#stage').screenshot({path:path.join(captures,'image-source.png')});
 // Series: four posters from one rule; clicking one opens it.
 await choose('truchet');await page.locator('#make-series').click();await page.waitForFunction(()=>document.querySelectorAll('#series img').length===4);assert(await page.locator('#series img').first().evaluate(i=>i.decode().then(()=>i.naturalWidth>100)));
 await page.locator('#series [data-series="2"]').click();assert.match((await state()).info,/3 of 4$/);await page.locator('.series').screenshot({path:path.join(captures,'series.png')});
 // Colours, passes, saved rules (v2 and v1), downloads and URL replay.
 const c0=await stageHTML();await page.locator('#c2').evaluate(i=>{i.value='#2a7a4f';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(c0,await stageHTML());assert.equal((await state()).colors[2],'#2a7a4f');
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`.stages [data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentRender.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`pass-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 await choose('coin');await page.locator('#source').selectOption('wave');const rule=await download('#save-rule','ui-rule.json'),expected=await stageHTML();assert.equal(JSON.parse(rule).engine,'bead-ray-v2');
 await choose('sunflower');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.BeadRay.getState().family==='coin');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 for(const name of ['cell','scoreboard','layouts/flip-overlay']){await page.locator('#load-rule').setInputFiles(path.join(v1out,name+'.json'));await page.waitForFunction(n=>window.currentRender.state.family===n.split('/').pop().split('-')[0],name);
  assert.match(await page.locator('#status').textContent(),/Version 1 rule opened/);assert.equal(strip(await page.evaluate(()=>window.currentRender.svg)),strip(fs.readFileSync(path.join(v1out,name+'.svg'),'utf8')),`v1 rule ${name}`);}
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#status').textContent(),/bead-ray rule/);
 await choose('riso');const png=await download('#save-png','ui-export.png');assert.equal(png.readUInt32BE(16),2120);assert.equal(png.readUInt32BE(20),3000);const svg=(await download('#save-svg','ui-export.svg')).toString();assert(svg.includes('mix-blend-mode:multiply')&&svg.includes('feTurbulence'));
 const urlExpected=await stageHTML();await page.reload();await page.locator('#stage svg').waitFor();assert.equal(urlExpected,await stageHTML());
 // Presets: each distinct; source presets show their reference, the others stand alone; formats; reseed.
 const refs=await page.evaluate(()=>window.BeadRay.SOURCES.map(s=>s.family)),systems=[];
 for(const {id} of families){await choose(id);await page.locator('.stages [data-stage="4"]').click();const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs.includes(id),id);
  if(!solo)await page.waitForFunction(()=>{const i=document.getElementById('ref-img');return i.complete&&i.naturalWidth>400;},null,{timeout:10000});systems.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`preset-${id}.png`)})).digest('hex'));}
 assert.equal(new Set(systems).size,families.length);
 const sizes=new Set();for(const f of options.format){await page.locator('#format').selectOption(f);sizes.add(await page.evaluate(()=>window.currentRender.width+'x'+window.currentRender.height));}assert.equal(sizes.size,4);
 await page.locator('.choose-family[data-family="seeds"]').click();assert.equal((await state()).family,'seeds');const s0=(await state()).params.seed,f0=await stageHTML();await page.locator('#reseed').click();assert.notEqual((await state()).params.seed,s0);assert.notEqual(f0,await stageHTML());
 const dragMs=await page.evaluate(()=>{const out={};for(const [id,key] of [['moire','pitch'],['letter','rays'],['truchet','sourceScale']]){const s=window.BeadRay.resolve({family:id}),t=performance.now();for(let i=0;i<12;i++)window.render({...s,params:{...s.params,[key]:s.params[key]+(i%3)*(key==='sourceScale'?.05:1)}});out[id]=+((performance.now()-t)/12).toFixed(1);}return out;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.locator('#families').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(captures,'mobile-gallery.png')});assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:dragMs,checks:['v2 preset opens first; 60 vocabulary tiles; seven references; '+families.length+' preset thumbnails',
  `${controlChecks} enabled controls change the poster across seven v2 presets (spiral, word mask, rings, coins, Truchet, riso, field); ${disabledChecks} correctly disabled`,`${optionChecks} option values distinct where enabled; disabled selects match the engine`,
  'word mask: typing and errors','click to place: bloom centre follows the click; field click adds a bloom, Alt-click removes one, clear restores the scatter','paint brush: first stroke samples the source into a grid, strokes change it; saved as the painted source',
  'source PNG export (480 px long edge)','local image source','series of four, click opens one','colour inputs','four construction passes','v2 saved-rule exact replay','v1 rules (cell, scoreboard, flip overlay) open and render their shipped v1 SVGs','wrong-engine rule rejected',
  '2120 × 3000 PNG download; SVG download keeps the riso blend and grain','URL reload exact replay',`${families.length} presets distinct; seven show their source poster`,'four formats','new seed changes the field','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: ${controlChecks} controls (+${disabledChecks} disabled), ${optionChecks} option values, word mask, click-to-place, paint, source export, image, series, passes, v2 and v1 rules, downloads, URL replay, ${families.length} presets, formats, reseed, mobile, offline. Redraw ${JSON.stringify(dragMs)} ms.`);
}finally{await browser.close();}
