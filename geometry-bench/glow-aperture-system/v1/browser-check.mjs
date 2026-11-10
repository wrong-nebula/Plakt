import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {FAMILIES as NODE_FAMILIES,render as nodeRender,W,H} from './engine.mjs';
// A watchdog: a hung check must never keep the shared heavy-job lock.
setTimeout(()=>{console.error('browser-check: watchdog timeout after 30 min');process.exit(3);},30*60*1000).unref();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/glow-aperture-study-v1'),captures=path.join(root,'output/playwright/glow-aperture-system');fs.mkdirSync(captures,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:{width:1540,height:1150},deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];context.setDefaultTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));await context.route('https://**',r=>{network.push(r.request().url());r.abort();});await context.route('http://**',r=>{network.push(r.request().url());r.abort();});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),shot=async()=>sha(await page.locator('#stage').screenshot());
const state=()=>page.evaluate(()=>window.Glow.getState()),stageHTML=()=>page.locator('#stage').innerHTML();
const pick=async(id,v)=>{await page.locator('#'+id).selectOption(v);};
try{
 await page.goto('file://'+path.join(out,'index.html'));await page.locator('#stage svg').waitFor();assert.deepEqual(errors,[]);
 assert(await page.locator('#ref-img').evaluate(i=>i.complete&&i.naturalWidth>500),'reference image');
 await page.waitForFunction(()=>document.querySelectorAll('#specimen [data-shape]').length===11);assert.equal(await page.locator('.sources img').count(),7);assert.equal(await page.locator('.families img').count(),13);
 // Gallery images load lazily; bring the first one in and wait (bounded) for it.
 await page.locator('.families img').first().evaluate(i=>{i.loading='eager';});await page.locator('.families img').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.querySelector('.families img');return i.complete&&i.naturalWidth>500;},null,{timeout:60000});await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(captures,'desktop.png')});
 // Copy: title and date line reach the poster.
 await page.locator('#title').fill('OPEN/DOOR');assert.equal((await state()).title,'OPEN/DOOR');assert.match(await stageHTML(),/OPEN/);await page.locator('#info').fill('Saturday / late');assert.match(await stageHTML(),/Saturday/);
 await page.locator('.probe').first().click();assert.equal((await state()).title,'AFTER/HOURS');
 // Every enabled control changes the poster; spacing is off for one aperture, ground off in halo and shadow modes.
 const controls=await page.evaluate(()=>window.Glow.CONTROLS.map(c=>c.key));assert.equal(controls.length,20);let controlChecks=0;
 for(const family of ['halo','shaft','frontier','ember','club']){await pick('family',family);await page.waitForFunction(v=>window.Glow.getState().family===v,family);const s=await state();
  assert.equal(await page.locator('#p-spacing').isDisabled(),s.params.count===1,`${family} spacing enabled state`);assert.equal(await page.locator('#ground').isDisabled(),!['field','beam'].includes(s.mode),`${family} ground enabled state`);
  for(const key of controls){if(await page.locator(`#p-${key}`).isDisabled())continue;const before=await stageHTML();await page.locator(`#p-${key}`).focus();await page.locator(`#p-${key}`).press('End');if(before===await stageHTML())await page.locator(`#p-${key}`).press('Home');assert.notEqual(before,await stageHTML(),`${family} ${key}`);controlChecks++;}
  await page.locator('#stage').screenshot({path:path.join(captures,`controls-${family}.png`)});await page.locator('#reset').click();}
 // Option selects: every value distinct (ground tried in field mode, sparkle styles with sparkles on).
 const options=await page.evaluate(()=>window.Glow.OPTIONS);let optionChecks=0;
 for(const [id,values] of Object.entries(options)){await pick('family','halo');await page.locator('#reset').click();if(id==='ground')await pick('mode','field');const seen=new Set();for(const v of values){await pick(id,v);seen.add(await stageHTML());}assert.equal(seen.size,values.length,id);optionChecks+=values.length;}
 // Ramp: presets, stop counts (resampled), stop colours and positions.
 await pick('family','club');const ramps=await page.evaluate(()=>window.Glow.RAMPS.map(r=>r.id)),rampSeen=new Set();for(const id of ramps){await pick('ramp-preset',id);rampSeen.add(await stageHTML());assert.equal(await page.locator('#ramp-preset').inputValue(),id);}assert.equal(rampSeen.size,ramps.length);
 await pick('ramp-preset','neon');for(const k of ['2','3','4','5']){await pick('stop-count',k);assert.equal((await state()).ramp.length,+k);assert.equal(await page.locator('#stops .stop').count(),+k);}
 let before=await stageHTML();await page.locator('#s1').evaluate(i=>{i.value='#19f0ff';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await state()).ramp[1][0],'#19f0ff');assert.notEqual(before,await stageHTML());assert.equal(await page.locator('#ramp-preset').inputValue(),'');
 before=await stageHTML();await page.locator('#sp2').evaluate(i=>{i.value='0.8';i.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await state()).ramp[2][1],.8);assert.notEqual(before,await stageHTML());
 // Colour roles, each on a style that reads it.
 for(const [i,family] of [[0,'shaft'],[1,'halo'],[2,'club'],[3,'halo']]){await pick('family',family);before=await stageHTML();await page.locator('#c'+i).evaluate(el=>{el.value='#ff2a6d';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await state()).colors[i],'#ff2a6d');assert.notEqual(before,await stageHTML(),`colour ${i}`);}
 // Four passes and thirteen styles, each with its reference or marked new.
 await pick('family','halo');const hashes=[];for(const stage of [1,2,3,4]){await page.locator(`[data-stage="${stage}"]`).click();await page.waitForFunction(v=>window.currentGlow.state.stage===v,stage);hashes.push(await shot());await page.locator('#stage').screenshot({path:path.join(captures,`stage-${stage}.png`)});}assert.equal(new Set(hashes).size,4);
 const refs=Object.fromEntries((await page.evaluate(()=>REFS)).map(r=>[r.family,r.file])),styles=[];
 for(const family of NODE_FAMILIES.map(f=>f.id)){await pick('family',family);await page.waitForFunction(v=>window.currentGlow.state.family===v,family);
  assert.equal(await page.locator('#comparison').evaluate(e=>e.classList.contains('solo')),!refs[family],family);if(refs[family])assert.equal(await page.locator('#ref-img').getAttribute('src'),refs[family]);
  styles.push(sha(await page.locator('#stage').screenshot({path:path.join(captures,`browser-${family}.png`)})));}assert.equal(new Set(styles).size,13);
 await page.locator('.choose-family[data-family="moon"]').click();assert.equal((await state()).family,'moon');
 // Saved rule, downloads and URL replay.
 await page.locator('#p-sparkles').fill('90');await page.locator('#p-sparkles').dispatchEvent('input');await pick('shape','hand');
 const ruleEvent=page.waitForEvent('download');await page.locator('#save-rule').click();await (await ruleEvent).saveAs(path.join(captures,'ui-rule.json'));const expected=await stageHTML();
 await pick('family','club');await page.locator('#load-rule').setInputFiles(path.join(captures,'ui-rule.json'));await page.waitForFunction(()=>window.Glow.getState().family==='moon');assert.equal(expected,await stageHTML());assert.match(await page.locator('#status').textContent(),/Rule opened/);
 fs.writeFileSync(path.join(captures,'not-a-rule.json'),JSON.stringify({engine:'isometric-prism-v2'}));await page.locator('#load-rule').setInputFiles(path.join(captures,'not-a-rule.json'));assert.match(await page.locator('#error').textContent(),/glow aperture rule/);
 const pngEvent=page.waitForEvent('download',{timeout:120000});await page.locator('#save-png').click();await (await pngEvent).saveAs(path.join(captures,'ui-export.png'));const bytes=fs.readFileSync(path.join(captures,'ui-export.png'));assert.equal(bytes.readUInt32BE(16),2120);assert.equal(bytes.readUInt32BE(20),3000);
 const svgEvent=page.waitForEvent('download');await page.locator('#save-svg').click();await (await svgEvent).saveAs(path.join(captures,'ui-export.svg'));assert(fs.readFileSync(path.join(captures,'ui-export.svg'),'utf8').includes('glow apertures'));
 await page.reload();await page.locator('#stage svg').waitFor();assert.equal(expected,await stageHTML());
 const dragMs=await page.evaluate(()=>{const s=window.Glow.getState(),t=performance.now();for(let i=0;i<10;i++)window.render({...s,params:{...s.params,width:20+i*3}});return (performance.now()-t)/10;});

 // resvg against Chrome: the same rule, as SVG from the editor's bundled engine, must equal the Node engine's SVG,
 // and Chrome's screenshot of it must be close to resvg's PNG of it.
 const rules=[...NODE_FAMILIES.map(f=>({family:f.id})),{family:'club',layout:'stacked',params:{count:3}},{family:'moon',sparkle:'petals',params:{sparkles:40}},{family:'window',layout:'bleed'},{family:'aurora',params:{angle:60,rotate:20}},{family:'veil',mode:'halo'},{family:'signal',mode:'field'},{family:'ember',stage:2},{family:'smoke',stage:3},{family:'club',params:{layers:5,balance:-.6}},{family:'vessel',params:{grain:.35}}];
 const cmp=await (await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1})).newPage(),parity=[];
 for(const rule of rules){const svg=await page.evaluate(r=>window.Glow.render(r).svg,rule);assert.equal(svg,nodeRender(rule).svg,`bundle = module for ${JSON.stringify(rule)}`);
  const ref=new Resvg(svg,{fitTo:{mode:'width',value:W}}).render().asPng();await cmp.setContent(`<style>body{margin:0}svg{display:block}</style>${svg}`);const chrome=await cmp.screenshot({clip:{x:0,y:0,width:W,height:H}});
  const d=await cmp.evaluate(async([a,b])=>{const load=async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height).data;};
   const A=await load(a),B=await load(b);let s=0,big=0,m=0;for(let i=0;i<A.length;i+=4)for(let j=0;j<3;j++){const v=Math.abs(A[i+j]-B[i+j]);s+=v;if(v>40)big++;if(v>m)m=v;}const k=A.length/4*3;return {mean:+(s/k).toFixed(2),over40:+(big/k*100).toFixed(3),max:m};},['data:image/png;base64,'+ref.toString('base64'),'data:image/png;base64,'+chrome.toString('base64')]);
  const name=Object.entries(rule).map(([k,v])=>typeof v==='object'?Object.entries(v).map(e=>e.join('')).join('-'):v).join('-');parity.push({rule:name,...d});
  if(['halo','frontier','shaft','club'].includes(name)){fs.writeFileSync(path.join(captures,`parity-${name}-resvg.png`),ref);fs.writeFileSync(path.join(captures,`parity-${name}-chrome.png`),chrome);}
  assert(d.mean<=3,`${name}: mean difference ${d.mean}`);assert(d.over40<=.8,`${name}: ${d.over40}% of channels differ by more than 40`);}
 await cmp.close();

 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(captures,'mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 const worst=parity.reduce((a,b)=>b.mean>a.mean?b:a);
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify({status:'passed',browser:await browser.version(),captures,averageRedrawMs:+dragMs.toFixed(1),
  parity:{method:'Same rule: SVG from the editor’s bundled engine (asserted byte-equal to the Node module’s), rasterised by resvg at 728 × 1030 and screenshotted inline in Chrome at 728 × 1030, device scale 1; mean absolute difference per channel (0–255) and share of channels off by more than 40',thresholds:{mean:3,over40Percent:.8},worst,rules:parity},
  checks:['reference image, 7 reference thumbnails, 13 gallery posters','specimen: 11 shapes','title and date line',`${controlChecks} enabled controls change the poster across five styles; spacing disabled for one aperture, ground disabled in halo and shadow modes`,`${optionChecks} option values distinct`,`${ramps.length} ramp presets distinct; 2–5 stops resample; stop colour and position edits`,'four colour roles','four visible construction passes','13 styles; seven show their source poster, six are marked new','saved-rule exact SVG replay','wrong-engine rule rejected','2120 × 3000 PNG download','SVG download','URL reload exact replay',`${parity.length} rules: editor SVG = Node SVG, and resvg ≈ Chrome (worst mean ${worst.mean})`,'mobile overflow','zero page errors','offline: zero HTTP requests']},null,2));
 console.log(`PASS: ${controlChecks} controls, ${optionChecks} option values, ${ramps.length} ramps, stops, colours, 4 stages, 13 styles and references, rule / URL replay, downloads, mobile, offline. resvg vs Chrome on ${parity.length} rules: worst mean ${worst.mean} (${worst.rule}). Redraw ${dragMs.toFixed(1)} ms.`);
}finally{await browser.close();}
