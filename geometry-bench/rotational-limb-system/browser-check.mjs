import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/rotational-limb-study-v1'),captures=path.join(root,'output/playwright/rotational-limb-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.RotLimb.getState()),html=()=>page.locator('#stage').innerHTML();
const choose=async id=>{await page.locator('#family').selectOption(id);await page.waitForFunction(v=>window.RotLimb.getState().family===v,id);};
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('.sources img').count(),5);assert.equal(await page.locator('#specimen [data-kit]').count(),26);assert.equal(await page.locator('.families figure').count(),12);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Every enabled control changes the poster; controls that do not apply are disabled.
 let controlChecks=0,disabledChecks=0;
 for(const family of ['legs','spiral','trefoil','neon','weave','tangle','handshake','field']){await choose(family);
  const controls=await page.evaluate(()=>window.RotLimb.CONTROLS.map(c=>({key:c.key,on:window.RotLimb.applies(c.when,window.RotLimb.getState())})));
  for(const {key,on} of controls){assert.equal(await page.locator(`#p-${key}`).isDisabled(),!on,`${family} ${key} enabled state`);if(!on){disabledChecks++;continue;}
   const before=await html();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await html())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await html(),`${family} ${key}`);controlChecks++;await page.locator('#reset').click();}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});}
 // Options: every value distinct where it applies; limb options disabled for knots and knot options for limbs.
 const OPT={generator:'legs',limb:'legs',end:'flower',ends:'legs',mirror:'legs',order:'legs',hub:'legs',knot:'trefoil',crossing:'tangle',colour:'flower',layout:'legs',format:'trefoil',finish:'legs',ground:'neon'};let optionChecks=0;
 for(const [id,family] of Object.entries(OPT)){await choose(family);const values=await page.evaluate(k=>window.RotLimb.OPTIONS[k],id),seen=new Set();for(const v of values){await page.locator('#'+id).selectOption(v);seen.add(await html());}assert.equal(seen.size,values.length,id);optionChecks+=values.length;}
 await choose('trefoil');for(const id of ['limb','end','endAlt','ends','mirror','order','hub'])assert(await page.locator('#'+id).isDisabled(),`${id} disabled for knots`);assert(await page.locator('#group-limb').isHidden());
 await choose('legs');for(const id of ['knot','crossing'])assert(await page.locator('#'+id).isDisabled(),`${id} disabled for limbs`);assert(await page.locator('#group-knot').isHidden());
 // Colours.
 const beforeColor=await html();await page.locator('#c1').evaluate(i=>{i.value='#00a36c';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.notEqual(beforeColor,await html());assert.equal((await state()).colors[1],'#00a36c');await page.locator('#reset').click();
 // Limb handles: mouse drag and arrow keys reshape the limb; points can be added and removed.
 await choose('legs');const n0=(await state()).points.length;assert.equal(await page.locator('#overlay .handle').count(),n0-1);
 const h=page.locator('#overlay .handle').last();await h.scrollIntoViewIfNeeded();const box=await h.boundingBox(),before=await html(),p0=(await state()).points[n0-1];
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+12,{steps:5});await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+25,{steps:5});await page.mouse.up();
 let s=await state();assert.equal(s.limb,'custom');assert.notDeepEqual(s.points[n0-1],p0);assert.notEqual(before,await html());assert.equal(await page.locator('#limb').inputValue(),'custom');
 // The handle ends under the pointer (no curl on this check).
 await page.locator('#p-curl').fill('0');await page.locator('#p-curl').dispatchEvent('input');const h2=page.locator('#overlay .handle').first();await h2.scrollIntoViewIfNeeded();const b2=await h2.boundingBox();await page.mouse.move(b2.x+b2.width/2,b2.y+b2.height/2);await page.mouse.down();await page.mouse.move(b2.x+b2.width/2+40,b2.y+b2.height/2-30,{steps:6});
 // Measured while the pointer is down: the figure keeps its fit during a drag and refits on release.
 const b3=await page.locator('#overlay .handle').first().boundingBox();await page.mouse.up();const overshoot=Math.hypot(b3.x+b3.width/2-(b2.x+b2.width/2+40),b3.y+b3.height/2-(b2.y+b2.height/2-30));assert(overshoot<3,`handle follows the pointer (${overshoot.toFixed(2)} px)`);
 await page.locator('#stage').screenshot({path:path.join(captures,'dragged-limb.png')});
 const pk=(await state()).points[1].slice();await page.locator('#overlay .handle').first().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowUp');assert.notDeepEqual((await state()).points[1],pk);
 await page.locator('#add-point').click();assert.equal((await state()).points.length,n0+1);await page.locator('#remove-point').click();await page.locator('#remove-point').click();assert.equal((await state()).points.length,n0-1);
 // Seed dice for random knots.
 await choose('tangle');const seed0=(await state()).params.seed,beforeSeed=await html();await page.locator('#dice').click();assert.notEqual((await state()).params.seed,seed0);assert.notEqual(beforeSeed,await html());
 // Four passes and twelve presets; five show their source poster.
 await choose('legs');const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentFig.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs=await page.evaluate(()=>Object.fromEntries(window.RotLimb.SOURCES.flatMap(s=>s.families.map(f=>[f,s.id])))),presets=[];
 for(const family of await page.evaluate(()=>window.RotLimb.FAMILIES.map(f=>f.id))){await choose(family);const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);if(refs[family])assert.match(await page.locator('#ref-img').getAttribute('src'),new RegExp(`references/${refs[family]}\\.`));
  presets.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}assert.equal(new Set(presets).size,12);
 await page.locator('.choose-family[data-family="riso"]').click();assert.equal((await state()).family,'riso');
 // Saved rule, downloads and URL replay (a dragged limb included).
 await choose('flower');const hh=page.locator('#overlay .handle').nth(1);await hh.scrollIntoViewIfNeeded();const hb=await hh.boundingBox();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2-25,hb.y+hb.height/2+30,{steps:4});await page.mouse.up();
 await page.locator('#p-arms').fill('7');await page.locator('#p-arms').dispatchEvent('input');const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await html();
 await choose('trefoil');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.RotLimb.getState().family==='flower');assert.equal(expected,await html());assert.match(await page.locator('#status').textContent(),/Rule opened/);assert.equal((await state()).limb,'custom');
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));await page.waitForFunction(()=>/rotational limb rule/.test(document.getElementById('error').textContent));
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('rotational limbs and knots'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await html());
 // Redraw time while dragging a slider: twenty twist changes on the pinwheel and twenty seeds on the tangle.
 const dragMs=await page.evaluate(()=>{const t=performance.now();for(let i=0;i<20;i++)window.render({family:'legs',params:{twist:10+i}});return (performance.now()-t)/20;});
 const knotMs=await page.evaluate(()=>{const t=performance.now();for(let i=0;i<10;i++)window.render({family:'tangle',params:{seed:100+i}});return (performance.now()-t)/10;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:{limbs:+dragMs.toFixed(1),seededKnot:+knotMs.toFixed(1)},checks:['reference image loaded','five reference thumbnails','kit sheet: 26 cells','twelve preset cards',`${controlChecks} enabled controls change the poster across eight presets; ${disabledChecks} controls disabled where they do not apply`,`${optionChecks} option values distinct where they apply; limb and knot options disabled for the other generator`,'colour inputs','limb handles: mouse drag reshapes the limb and the handle stays under the pointer; arrow keys move a focused handle; add and remove points','seed dice','four visible construction passes','twelve presets; five show their source poster, seven are marked new','saved-rule exact SVG replay with a dragged limb','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: references, kit, ${controlChecks} controls (${disabledChecks} disabled), ${optionChecks} option values, colours, handle drag and keys, seed, 4 stages, 12 presets, rule / URL replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms (limbs), ${knotMs.toFixed(1)} ms (seeded knot).`);
}finally{await browser.close();}
