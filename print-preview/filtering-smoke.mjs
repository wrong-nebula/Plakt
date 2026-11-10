import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const label=process.argv[2]||'filtered';
const output=fileURLToPath(new URL(`../output/print-preview/filtering/${label}/`,import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.POSTER_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(new URL('../Sources/PosterCore/Resources/PrintPreview/index.html',import.meta.url).href);
  await page.waitForFunction(()=>window.posterPreview&&document.querySelector('#loading').hidden);
  await page.waitForFunction(()=>window.posterPreview.diagnostics().filtering?.smaaReady!==false);
  for(const [name,settings,view] of [
    ['offset',{environment:'courtyard',process:'offset',lpi:180,registration:0,finish:'none'},'perspective'],
    ['riso-detail',{environment:'courtyard',process:'riso',lpi:80,registration:0.5,finish:'none'},'detail'],
    ['foil',{process:'offset',finish:'gold',mask:'accent',environment:'gallery'},'perspective'],
    ['distant',{process:'offset',finish:'none',environment:'courtyard'},'context'],
  ]) {
    await page.evaluate(settings=>window.posterPreview.restore(settings),settings);
    await page.locator(`[data-view="${view}"]`).click();
    await page.evaluate(()=>window.posterPreview.snapshot());
    if(name==='offset') {
      const redPixels=await page.evaluate(async()=>{
        const source=document.querySelector('#viewport canvas');
        const bitmap=await createImageBitmap(source);
        const canvas=document.createElement('canvas');canvas.width=400;canvas.height=Math.round(400*source.height/source.width);
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
        const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0;
        for(let i=0;i<data.length;i+=4)if(data[i]>60&&data[i]>data[i+1]*1.3&&data[i]>data[i+2]*1.4)count++;
        return count;
      });
      assert.ok(redPixels>200,'The artwork disappeared from the filtered render');
    }
    await page.screenshot({path:output+name+'.png'});
  }
  // Explicit gradients/anisotropy are particularly important on the compressed axis of an oblique sheet.
  const canvas=page.locator('#viewport canvas'),bounds=await canvas.boundingBox();
  await page.locator('[data-view="perspective"]').click();
  await page.mouse.move(bounds.x+bounds.width*0.50,bounds.y+bounds.height*0.50);
  await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*0.72,bounds.y+bounds.height*0.52,{steps:12});await page.mouse.up();
  await page.evaluate(()=>window.posterPreview.snapshot());
  await page.screenshot({path:output+'oblique.png'});
  const diagnostics=await page.evaluate(()=>window.posterPreview.diagnostics());
  if(label!=='baseline') {
    assert.ok(diagnostics.filtering.msaaSamples>0);
    assert.equal(diagnostics.filtering.smaaReady,true);
    assert.ok(diagnostics.filtering.anisotropy>=1);
    assert.ok(diagnostics.filtering.renderPixels<=4_000_000);
    assert.equal(diagnostics.filtering.mipmapFilter,'trilinear');
    // A direct export after restoring settings uses the same AA pipeline, including while rAF is pending.
    const result=await page.evaluate(()=>{window.posterPreview.restore({environment:'gallery',finish:'silver',quality:'standard'});return {png:window.posterPreview.snapshot(),state:window.posterPreview.diagnostics()};});
    assert.equal(result.state.settings.finish,'silver');assert.equal(result.state.settings.quality,'standard');
    assert.ok(result.png.startsWith('data:image/png;base64,'));
    await writeFile(output+'export-standard.png',Buffer.from(result.png.split(',')[1],'base64'));
    for(let i=0;i<6;i++)await page.evaluate(i=>{window.posterPreview.restore({quality:i%2?'high':'standard'});window.posterPreview.snapshot();},i);
    assert.ok((await page.evaluate(()=>window.posterPreview.diagnostics())).textures<=diagnostics.textures+2,'Render targets leak across quality changes');
    await page.goto(new URL('src/index.html',import.meta.url).href);
    await page.waitForFunction(()=>window.posterPreview&&document.querySelector('#loading').hidden);
    assert.equal(await page.locator('#error').isVisible(),false,'Source entry cannot load the built viewer');
  }
  assert.deepEqual(errors,[]);
  await writeFile(output+'report.json',JSON.stringify({errors,diagnostics},null,2));
  console.log(`${label}: filtering captures and checks passed`);
} finally {await browser.close();}
