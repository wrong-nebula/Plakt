import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/primitive-kit-study-v1'),captures=path.join(root,'output/playwright/primitive-kit-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const errors=[],network=[];
async function open(options){const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true,...options}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();return {context,page};}
const {page}=await open();
const stage=()=>page.locator('#stage').innerHTML(),state=()=>page.evaluate(()=>window.PK.getState()),active=async()=>{const s=await state();return s.cast[s.active];};
const cellLoc=(r,c)=>page.locator(`#canvas [data-r="${r}"][data-c="${c}"]`);
// Click near a cell corner, clear of the overlay handles that sit at cell centres.
const tapCell=(r,c)=>cellLoc(r,c).click({position:{x:4,y:4},force:true});
const token=async(r,c)=>(await active()).grid[r].split(' ')[c];
const tool=id=>page.locator(`[data-tool="${id}"]`).click();
try{
 assert.deepEqual(errors,[]);assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500),'reference image');assert.equal(await page.locator('#presets [data-preset]').count(),12);assert.equal(await page.locator('#cast [data-cast]').count(),6);
 assert(await page.locator('#specimen svg').count()===1);assert.equal(await page.locator('.sources img').count(),5);await page.screenshot({path:path.join(captures,'desktop.png')});
 // Painting: cycle shape, turn, colour and background; brush with a chosen primitive; erase; pick.
 await tool('shape');const t0=await token(0,0);await tapCell(0,0);assert.notEqual(await token(0,0),t0,'shape cycles');
 await tool('turn');const t1=await token(2,0);await tapCell(2,0);assert.equal((await token(2,0))[0],'T');assert.notEqual(await token(2,0),t1,'turn');
 await tool('colour');const t2=await token(1,0);await tapCell(1,0);assert.notEqual(await token(1,0),t2,'colour');
 await tool('back');const t3=await token(2,1);await tapCell(2,1);assert.match(await token(2,1),/\/\d$/,'background');assert.notEqual(await token(2,1),t3);
 await page.locator('[data-prim="D"]').click();await page.locator('[data-fg="3"]').click();await page.locator('[data-bg="7"]').click();assert.equal(await page.locator('#brush-token').textContent(),'Brush token: D03/7');
 await tapCell(3,2);assert.equal(await token(3,2),'D03/7');await page.locator('#canvas').screenshot({path:path.join(captures,'painted.png')});
 // Undo and redo by button and keyboard.
 await page.locator('#undo').click();assert.equal(await token(3,2),'S03');await page.locator('#redo').click();assert.equal(await token(3,2),'D03/7');
 await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('ControlOrMeta+z');assert.equal(await token(3,2),'S03');await page.keyboard.press('ControlOrMeta+Shift+z');assert.equal(await token(3,2),'D03/7');
 await tool('erase');await tapCell(3,2);assert.equal(await token(3,2),'.');await tool('pick');await tapCell(0,1);assert.equal((await page.evaluate(()=>window.PK.getBrush())).p,'S');
 // Dragging the brush paints every cell it crosses.
 await page.locator('[data-prim="Q"]').click();await page.locator('#canvas').scrollIntoViewIfNeeded();const a=await cellLoc(1,0).boundingBox(),b=await cellLoc(1,2).boundingBox();await page.mouse.move(a.x+4,a.y+4);await page.mouse.down();await page.mouse.move(a.x+a.width/2,a.y+6,{steps:4});await page.mouse.move(b.x+b.width-4,b.y+6,{steps:10});await page.mouse.up();
 for(const c of [0,1,2])assert.equal((await token(1,c))[0],'Q',`drag painted cell 1,${c}`);
 // Symmetric painting writes the mirror cell.
 await page.locator('#symmetry').selectOption('mirror-left');await page.locator('[data-prim="T"]').click();await page.locator('[data-fg="5"]').click();await page.locator('[data-bg="0"]').click();await tapCell(0,0);assert.equal(await token(0,0),'T05');assert.equal(await token(0,2),'T35');
 assert(await page.locator('#canvas svg rect:not(.hit)').count()>3,'derived cells shaded');await page.locator('#symmetry').selectOption('none');
 // Overlays: select, edit fields, drag a handle, add, duplicate, delete, undo.
 const overs=(await active()).over.length;await page.locator('[data-over="0"]').click();assert.equal(await page.evaluate(()=>window.PK.getSelected()),0);
 await page.locator('#o-x').fill('2.2');await page.locator('#o-x').dispatchEvent('change');assert.match((await active()).over[0],/^disc 2.2 /);
 await page.locator('#o-size').fill('.3');await page.locator('#o-size').dispatchEvent('change');assert.match((await active()).over[0],/ r\.3/);await page.locator('#o-c').selectOption('3');assert.match((await active()).over[0],/ c3/);
 await page.locator('#canvas').scrollIntoViewIfNeeded();const h=await page.locator('#canvas [data-o="0"]').boundingBox(),before=(await active()).over[0];await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2-60,h.y+h.height/2+40,{steps:6});await page.mouse.up();
 assert.notEqual((await active()).over[0],before,'handle drag moves the overlay');
 await tool('move');await page.locator('#canvas').scrollIntoViewIfNeeded();const cb=await cellLoc(3,0).boundingBox();await page.mouse.click(cb.x+cb.width/2,cb.y+cb.height/2);assert.match((await active()).over[0],/^disc \.\d+ 3\.\d+/,'tap places the overlay');
 await page.locator('#add-kind').selectOption('eye.round');await page.locator('#add-over').click();assert.equal((await active()).over.length,overs+1);assert.match((await active()).over.at(-1),/^eye\.round/);
 await page.locator('#dup-over').click();assert.equal((await active()).over.length,overs+2);await page.locator('#del-over').click();await page.locator('#del-over').click();assert.equal((await active()).over.length,overs);
 await page.locator('#undo').click();assert.equal((await active()).over.length,overs+1);await page.locator('#redo').click();
 await page.locator('#canvas').screenshot({path:path.join(captures,'overlays.png')});
 // Figure text: apply an edit, and report errors.
 await page.locator('#fig-text').fill('name: Test face\ngrid:\nQ31/0  S02  Q01\nS02  S02  S02\nT22  S02  T12\nover:\neye.dot 1 1.4 r.2 c1 m\nlip.bow 1.5 2.3 r.18 c3');await page.locator('#fig-apply').click();
 assert.equal((await active()).name,'Test face');assert.deepEqual((await active()).grid,['Q31 S02 Q01','S02 S02 S02','T22 S02 T12']);
 await page.locator('#fig-text').fill('grid:\nS01 Z9');await page.locator('#fig-apply').click();assert.match(await page.locator('#fig-error').textContent(),/not a cell/);
 // Presets, generator (deterministic seeds), cast, grid size.
 await page.locator('[data-preset="owl"]').click();assert.equal((await active()).name,'Owl');
 await page.locator('#gen-kind').selectOption('mask');await page.locator('#gen-seed').fill('42');await page.locator('#gen').click();const g1=await active();assert.equal(g1.from,'gen:mask:42:1');
 await page.locator('[data-preset="cat"]').click();await page.locator('#gen').click();assert.deepEqual((await active()).grid,g1.grid,'same seed, same figure');
 await page.locator('#gen-new').click();assert.notEqual((await active()).from,'gen:mask:42:1');await page.locator('#stage').screenshot({path:path.join(captures,'generated.png')});
 const n=(await state()).cast.length;await page.locator('#cast-add').click();assert.equal((await state()).cast.length,n+1);await page.locator('[data-cast="0"]').click();assert.equal((await state()).active,0);await page.locator('#cast-remove').click();assert.equal((await state()).cast.length,n);
 const cols=(await active()).grid[0].split(' ').length;await page.locator('[data-resize="widen"]').click();assert.equal((await active()).grid[0].split(' ').length,cols+2);await page.locator('#undo').click();assert.equal((await active()).grid[0].split(' ').length,cols);
 // Every applicable control changes the poster (hero, then field with outline paint).
 let controlChecks=0;for(const [setup,label] of [[{},'hero'],[{layout:'field',paint:'outline'},'field']]){for(const [k,v] of Object.entries(setup))await page.locator('#'+k).selectOption(v);
  for(const key of await page.evaluate(()=>window.PK.CONTROLS.map(c=>c.key))){const row=page.locator(`.control[data-key="${key}"]`);if(await row.isHidden())continue;const el=page.locator('#p-'+key),b4=await stage();await el.focus();await el.press('End');if(b4===await stage())await el.press('Home');assert.notEqual(b4,await stage(),`${label} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${label}.png`)});await page.locator('#reset').click();}
 assert(controlChecks>=21,`controls checked: ${controlChecks}`);
 // Every option value is distinct.
 const OPTIONS=await page.evaluate(()=>window.PK.OPTIONS);for(const [id,values] of Object.entries(OPTIONS)){await page.locator('#reset').click();await page.locator(`[data-preset="${id==='vocab'?'owl':'buyo'}"]`).click();if(id==='pattern')await page.locator('#layout').selectOption('field');const seen=new Set();for(const v of values){await page.locator('#'+id).selectOption(v);seen.add(await stage());}assert.equal(seen.size,values.length,id);}
 await page.locator('#reset').click();await page.locator('#c3').evaluate(i=>{i.value='#00ff88';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await state()).colors[3],'#00ff88');await page.locator('#palette').selectOption('neon');assert.equal((await state()).palette,'neon');
 // Passes and styles; five styles show their reference.
 const hashes=[];for(const s of [1,2,3,4]){await page.locator(`[data-stage="${s}"]`).click();hashes.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex'));}assert.equal(new Set(hashes).size,4);
 const styles=await page.evaluate(()=>window.PK.STYLES.map(s=>s.id)),refs=['buyo','noh','mori','sharaku','kato'],shots=new Set();
 for(const s of styles){await page.locator('#style').selectOption(s);await page.waitForFunction(v=>window.PK.getState().style===v,s);assert.equal(await page.locator('#comparison').evaluate(e=>e.classList.contains('solo')),!refs.includes(s),s);
  shots.add(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`style-${s}.png`)})).digest('hex'));}assert.equal(shots.size,styles.length);
 await page.locator('.choose[data-rule="layouts/field-neon"]').click();assert.equal((await state()).layout,'field');
 // Saved rule, downloads, wrong engine, URL replay.
 await page.locator('#style').selectOption('mori');await page.locator('#p-jitter').fill('.4');await page.locator('#p-jitter').dispatchEvent('input');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();await (await ruleEvent).saveAs(path.join(captures,'ui-rule.json'));const expected=await stage();
 await page.locator('#style').selectOption('neon');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.PK.getState().style==='mori');assert.equal(await stage(),expected);assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/primitive kit rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();await (await pngEvent).saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();await (await svgEvent).saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('Primitive kit figures'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(await stage(),expected,'URL replay');
 const redrawMs=await page.evaluate(()=>{const s=window.PK.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,params:{...s.params,gap:i*.01}});return (performance.now()-t)/20;});
 // Phone width: no horizontal overflow, and tapping paints.
 const mobile=await open({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true}),mp=mobile.page;await mp.screenshot({path:path.join(captures,'mobile.png')});assert(await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile overflow');
 await mp.locator('[data-tool="shape"]').tap();const m0=await mp.evaluate(()=>{const s=window.PK.getState();return s.cast[s.active].grid[0];});await mp.locator('#canvas [data-r="0"][data-c="0"]').tap({position:{x:4,y:4},force:true});assert.notEqual(await mp.evaluate(()=>{const s=window.PK.getState();return s.cast[s.active].grid[0];}),m0,'tap paints on a phone');
 await mp.locator('#canvas').screenshot({path:path.join(captures,'mobile-canvas.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+redrawMs.toFixed(1),checks:['reference image, 12 preset thumbnails, 6 cast chips, kit specimen, 5 reference thumbnails','paint tools: cycle shape, turn, colour, background; brush primitive + colour + background; erase; pick','undo / redo by buttons and keyboard','drag painting across cells','mirror painting writes the mirror cell; derived cells shaded','overlays: select, edit x / size / colour, drag a handle, tap to place, add, duplicate, delete, undo','figure text applied; parse errors reported','presets; generator deterministic for a seed; new seed','cast add / select / remove; grid widen and undo',`${controlChecks} visible controls change the poster (hero; field with outline paint)`,'every option value distinct','colour input and palette','four visible passes','nine styles distinct; five show their reference','gallery “Edit this” loads a rule','saved rule exact replay; wrong engine rejected','2120 × 3000 PNG and SVG downloads','URL reload exact replay','390 px phone: no overflow, tap painting','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: painting, undo/redo, drag, mirror paint, overlays, figure text, presets/generator/cast, ${controlChecks} controls, options, passes, ${styles.length} styles, rule/URL replay, downloads, phone and offline. Redraw ${redrawMs.toFixed(1)} ms.`);
}finally{await browser.close();}
