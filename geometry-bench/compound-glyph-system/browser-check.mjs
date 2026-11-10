import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=here.slice(0,here.indexOf('/geometry-bench/')),out=path.join(root,'output/compound-glyph-study-v2'),v1out=path.join(root,'output/compound-glyph-study-v1'),captures=path.join(root,'output/playwright/compound-glyph-system-v2');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
page.setDefaultTimeout(60000);
page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>{network.push(r.request().url());r.abort();});await page.route('http://**',r=>{network.push(r.request().url());r.abort();});
const shot=async()=>crypto.createHash('sha256').update(await page.locator('#stage').screenshot()).digest('hex');
const state=()=>page.evaluate(()=>window.Compound.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
const norm=svg=>{const m=svg.match(/id="([a-z0-9]+)-(t\d+|glow)"/);return m?svg.split(m[1]).join('U'):svg;};
const setState=x=>page.evaluate(x=>{const s=window.Compound.getState();window.render({...s,...x,params:{...s.params,...x.params}});},x);
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 const nSets=await page.evaluate(()=>window.Compound.SETS.length),nFam=await page.evaluate(()=>window.Compound.FAMILIES.length);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500));assert.equal(await page.locator('#specimen [data-set]').count(),nSets);assert.equal(await page.locator('#specimen [data-mask]').count(),11);assert.equal(await page.locator('.sources img').count(),5);assert.equal(await page.locator('.families figure').count(),nFam);
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // A saved version 1 rule opens and draws exactly as its version 1 SVG.
 for(const name of ['forest','kanji','type/appeal-type','variations/fire-kanji']){const rule=path.join(v1out,name+'.json');await page.locator('#load-rule').setInputFiles(rule);await page.waitForFunction(()=>/Version 1 rule/.test(document.getElementById('status').textContent));
  // The v1 file goes through the same DOM serialisation as the stage before comparing.
  const v1html=await page.evaluate(t=>{const d=document.createElement('div');d.innerHTML=t;return d.innerHTML;},fs.readFileSync(path.join(v1out,name+'.svg'),'utf8'));
  assert.equal(norm(await stageHTML()),norm(v1html),`v1 rule ${name}`);await page.locator('#status').evaluate(e=>e.textContent='');}
 // Words, second word, custom chain with weights.
 await page.locator('#family').selectOption('hidden');await page.locator('#text2').fill('ＬＯＶＥ');assert.equal((await state()).text2,'LOVE');await page.locator('#text2').fill('§');assert.match(await page.locator('#text2-error').textContent(),/Not in the bundled faces/);
 await page.locator('#custom').fill('木*3 → 林 → 森*.5');let s=await state();assert.equal(s.custom,'木*3 林 森*.5');assert.equal(s.set,'custom');await page.locator('#custom').fill('木*0');assert.match(await page.locator('#custom-error').textContent(),/weights/);
 // Every enabled control changes the poster; disabled states match the engine.
 const keys=await page.evaluate(()=>window.Compound.CONTROLS.map(c=>c.key));let controlChecks=0;
 for(const family of ['forest','contour','layers','sunflower']){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.Compound.getState().family===v,family);
  const active=new Set(await page.evaluate(()=>window.Compound.activeControls(window.Compound.getState())));
  for(const key of keys){assert.equal(await page.locator(`#p-${key}`).isDisabled(),!active.has(key),`${family} ${key} enabled state`);if(!active.has(key))continue;
   const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');
   assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;await page.locator('#reset').click();}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});}
 // Option selects: every value distinct, with the context each needs.
 const options=await page.evaluate(()=>window.Compound.OPTIONS);let optionChecks=0;
 for(const [id,values] of Object.entries(options)){await page.locator('#family').selectOption('layers');await page.locator('#reset').click();
  // The same contexts as verify.mjs: each option is tried where it has a visible effect.
  const setup={face:{mask:'text',text:'TYPE'},odd:{params:{odd:2}},font:{set:'o'},level:{set:'forest',params:{mix:0}},flow:{packing:'poisson',params:{strength:.85}},colorMode:{set:'forest'},render:{params:{glow:.5}},set:{text:'MORI',custom:'o|O 日|月 森'},
   imageSource:{field:'image'},field:{params:{amount:.85},attract:[[.4,.4,1]]},mask:{text:'MORI'},set2:{set:'o',text:'TOOT',custom:'o|O 日|月 森',params:{scale2:.8}},outSet:{packing:'poisson',set:'o',text:'TOOT',custom:'o|O 日|月 森',params:{outside:.5}}}[id];
  if(setup)await setState(setup);const seen=new Set();let tried=0;for(const v of values){if(id==='imageSource'&&v==='upload')continue;if(['set2','outSet'].includes(id)&&v==='o')continue;if(await page.locator('#'+id).isDisabled())break;await page.locator('#'+id).selectOption(v);seen.add(await stageHTML());tried++;}
  assert(tried>0||id==='face',`${id}: no values tried`);assert.equal(seen.size,tried,id);optionChecks+=tried;}
 // Formats change the poster's size.
 for(const f of await page.evaluate(()=>window.Compound.FORMATS)){await page.locator('#format').selectOption(f.id);const svg=await page.locator('#stage svg').evaluate(e=>[e.getAttribute('width'),e.getAttribute('height')]);assert.deepEqual(svg.map(Number),[f.w,f.h]);if(f.id!=='poster')await page.locator('#stage').screenshot({path:path.join(captures,`format-${f.id}.png`)});}
 await page.locator('#format').selectOption('poster');
 // Pointer tools: paint, attractor, odd one, hero; clear. Choosing a tool can scroll the controls, so the stage is re-measured after each choice.
 await page.locator('#family').selectOption('forest');const tool=async v=>{await page.locator(`input[name=tool][value=${v}]`).check();await page.locator('#stage').scrollIntoViewIfNeeded();const b=await page.locator('#stage svg').boundingBox();assert(b.y>=0&&b.y+b.height*.75<=1150,'stage in view');return (u,v)=>[b.x+b.width*u,b.y+b.height*v];};
 const beforePaint=await stageHTML();let P=await tool('denser');await page.mouse.move(...P(.3,.3));await page.mouse.down();for(let i=1;i<=12;i++)await page.mouse.move(...P(.3+i*.03,.3+i*.01));await page.mouse.up();
 await page.waitForTimeout(150);s=await state();assert(s.strokes.length>=4,'brush dabs recorded');assert(s.strokes.every(([,,,v])=>v>0));assert.notEqual(beforePaint,await stageHTML());await page.locator('#stage').screenshot({path:path.join(captures,'tool-paint.png')});
 P=await tool('sparser');await page.mouse.move(...P(.5,.5));await page.mouse.down();await page.mouse.move(...P(.55,.5));await page.mouse.up();await page.waitForTimeout(150);assert((await state()).strokes.some(([,,,v])=>v<0));
 P=await tool('attract');await page.mouse.click(...P(.7,.3));s=await state();assert.equal(s.attract.length,1);assert.equal(s.field,'attract');assert(Math.abs(s.attract[0][0]-.7)<.01&&Math.abs(s.attract[0][1]-.3)<.01);
 P=await tool('pin');await page.mouse.click(...P(.45,.4));P=await tool('hero');await page.mouse.click(...P(.55,.6));s=await state();assert.equal(s.pins.length,1);assert.equal(s.heroAt.length,1);
 assert(await page.evaluate(()=>window.$features.odd>=1&&window.$features.heroes>=1));await page.locator('#stage').screenshot({path:path.join(captures,'tool-pins.png')});
 for(const b of ['clear-strokes','clear-attract','clear-pins'])await page.locator('#'+b).click();s=await state();assert.equal(s.strokes.length+s.attract.length+s.pins.length+s.heroAt.length,0);await page.locator('input[name=tool][value=none]').check();
 // Image upload becomes a luminance field kept in the rule.
 await page.locator('#upload').setInputFiles(path.join(out,'images/dunes.png'));await page.waitForFunction(()=>window.Compound.getState().imageSource==='upload');s=await state();assert.equal(s.field,'image');assert(s.image&&s.image.w>=8&&s.image.data.length>100);await page.locator('#stage').screenshot({path:path.join(captures,'image-upload.png')});
 // Set library and triptych.
 await page.locator('#custom').fill('日 昌*2 晶');const setEvent=page.waitForEvent('download');await page.locator('#save-set').click();const setFile=await setEvent;await setFile.saveAs(path.join(captures,'set.json'));
 await page.locator('#custom').fill('木 林 森');await page.locator('#load-set').setInputFiles(path.join(captures,'set.json'));await page.waitForFunction(()=>window.Compound.getState().custom==='日 昌*2 晶');
 const triEvent=page.waitForEvent('download');await page.locator('#save-series').click();const tri=await triEvent;await tri.saveAs(path.join(captures,'triptych.svg'));const triSvg=fs.readFileSync(path.join(captures,'triptych.svg'),'utf8');assert.equal((triSvg.match(/<svg /g)||[]).length,4);
 // Four passes and every style; five show their source poster.
 const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentCompound.state.stage===v,stage);hashes.push(await shot());}assert.equal(new Set(hashes).size,4);
 const refs={forest:'moma-8384',alarm:'moma-7170',scribe:'moma-5834',appeal:'pgda-14233',beach:'moma-5008'},styles=[];
 for(const family of await page.evaluate(()=>window.Compound.FAMILIES.map(f=>f.id))){await page.locator('#family').selectOption(family);await page.waitForFunction(v=>window.currentCompound.state.family===v,family);
  const solo=await page.locator('#comparison').evaluate(e=>e.classList.contains('solo'));assert.equal(solo,!refs[family],family);styles.push(crypto.createHash('sha256').update(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})).digest('hex'));}
 assert.equal(new Set(styles).size,nFam);
 // Saved rule, downloads and URL replay (with placed points and an image in the rule).
 await page.locator('#family').selectOption('moon');await setState({pins:[[.4,.4]],strokes:[[.6,.5,.06,.6]]});
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();const rule=await ruleEvent;await rule.saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await page.locator('#family').selectOption('forest');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Compound.getState().family==='moon');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/compound-glyph rule/);
 const pngEvent=page.waitForEvent('download');await page.locator('#save-png').click();const png=await pngEvent;await png.saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();const svg=await svgEvent;await svg.saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('compound-glyph silhouette'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());
 const dragMs=await page.evaluate(()=>{const s=window.Compound.getState(),t=performance.now();for(let i=0;i<20;i++)window.render({...s,params:{...s.params,size:12+i*.2}});return (performance.now()-t)/20;});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});await page.locator('#stage').screenshot({path:path.join(captures,'mobile-stage.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),note:'Machine shared with other jobs; redraw timing is indicative.',checks:[`specimen: ${nSets} escalation sets and 11 silhouettes`,'five reference thumbnails',`${nFam} styles in the gallery`,'four saved v1 rules open and draw exactly as their v1 SVGs','second word input and errors','weighted custom chains and their errors',`${controlChecks} enabled controls change the poster across four styles; disabled states match the engine`,`${optionChecks} option values across ${Object.keys(options).length} selects, every value distinct`,'four formats at their sizes','brush paints denser and sparser; attractor, odd-one and hero placement; clear','image upload becomes a luminance field in the rule','set library save and open','triptych download','four visible construction passes','every style distinct; five show their source poster','saved-rule exact SVG replay with placed points','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay','mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: v1 rules, specimen, words and chains, ${controlChecks} controls, ${optionChecks} option values, formats, tools, image upload, set library, triptych, 4 stages, ${nFam} styles, replay, downloads, mobile and offline checks. Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
