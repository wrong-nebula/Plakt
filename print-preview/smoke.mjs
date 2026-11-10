// Independent browser process: never connects to the user's browser or another session.
import { chromium } from 'playwright-core';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const output=fileURLToPath(new URL('../output/print-preview/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.POSTER_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
  const errors=[],requests=[];
  const capture=async name=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:output+'/'+name,fullPage:true});};
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>requests.push(request.url()));
  await page.goto(new URL('../Sources/PosterCore/Resources/PrintPreview/index.html',import.meta.url).href);
  await page.waitForFunction(()=>window.posterPreview&&document.querySelector('#loading').hidden);
  if(await page.locator('#error').isVisible())console.error(await page.locator('#error-message').textContent(),errors);
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal((await page.evaluate(()=>window.posterPreview.diagnostics())).settings.environment,'studio');
  console.log('Initial state',await page.evaluate(()=>window.posterPreview.diagnostics()));
  await capture('desktop.png');
  await page.getByLabel('Backdrop',{exact:true}).selectOption('black');
  await capture('studio-black.png');
  const redPixels=await page.evaluate(async()=>{
    const source=document.querySelector('#viewport canvas'),bitmap=await createImageBitmap(source);
    const c=document.createElement('canvas');c.width=400;c.height=Math.round(400*source.height/source.width);
    const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
    const data=ctx.getImageData(0,0,c.width,c.height).data;let count=0;
    for(let i=0;i<data.length;i+=4)if(data[i]>60&&data[i]>data[i+1]*1.3&&data[i]>data[i+2]*1.4)count++;
    return count;
  });
  assert.ok(redPixels>200,'Artwork disappeared after switching the studio backdrop');
  await page.getByRole('button',{name:'Front',exact:true}).click();
  await capture('studio-front.png');
  await page.getByLabel('Backdrop',{exact:true}).selectOption('white');
  await page.getByRole('button',{name:'City display',exact:true}).click();
  await page.setViewportSize({width:1040,height:740});
  await page.getByRole('button',{name:'Perspective',exact:true}).click();
  await capture('city-compact.png');
  await page.setViewportSize({width:1440,height:960});
  await page.getByRole('button',{name:'Inside',exact:true}).click();
  await page.getByLabel('Special finish').selectOption('gold');
  await page.getByLabel('Apply to').selectOption('accent');
  await page.getByRole('button',{name:'Paper detail',exact:true}).click();
  await page.waitForFunction(()=>window.posterPreview.diagnostics().settings.environment==='gallery');
  await capture('gallery-foil-detail.png');
  for(const process of ['digital','offset','riso']) {
    await page.getByLabel('Process',{exact:true}).selectOption(process);
    await page.getByLabel('Mounting',{exact:true}).selectOption(process==='digital'?'floating':process==='offset'?'paste':'tape');
    await page.getByLabel('Stock',{exact:true}).selectOption(process==='riso'?'newsprint':'cotton');
  }
  for(const finish of ['none','metallic','gold','silver','holographic','varnish'])await page.getByLabel('Special finish').selectOption(finish);
  await page.getByRole('button',{name:'Outside',exact:true}).click();
  await page.getByRole('button',{name:'Night',exact:true}).click();
  await page.getByRole('button',{name:'In context',exact:true}).click();
  await page.waitForFunction(()=>window.posterPreview.diagnostics().settings.hour===22);
  await capture('night-context.png');
  await page.getByRole('button',{name:'Reset materials & light'}).click();
  const artwork=await readFile(new URL('../output/curated/color-field-user-v13/poster.png',import.meta.url));
  await page.evaluate(data=>window.posterPreview.setArtwork(data,'color-field-user-v13.png'),'data:image/png;base64,'+artwork.toString('base64'));
  await page.getByLabel('Special finish').selectOption('metallic');
  await page.getByLabel('Apply to').selectOption('accent');
  await capture('artwork-metallic.png');
  // Exercise the native-callable bridge, including untrusted persisted settings and custom mask import.
  await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=64;c.height=64;
    const ctx=c.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,64,64);ctx.fillStyle='#fff';ctx.fillRect(0,0,32,64);
    await window.posterPreview.setMask(c.toDataURL(),'test-mask.png');
  });
  await page.getByLabel('Show finish selection').check();
  await capture('custom-mask.png');
  await page.getByRole('button',{name:'Reset materials & light'}).click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const exported=await page.evaluate(()=>window.posterPreview.snapshot());
  assert.ok(exported.startsWith('data:image/png;base64,'));
  await writeFile(output+'/export.png',Buffer.from(exported.split(',')[1],'base64'));
  for(let i=0;i<8;i++){await page.getByLabel('Format',{exact:true}).selectOption(i%2?'A1':'A0');await page.getByRole('button',{name:i%2?'Inside':'Outside',exact:true}).click();}
  const diagnostics=await page.evaluate(()=>window.posterPreview.diagnostics());
  assert.ok(diagnostics.geometries<65,'Geometry is retained across rebuilds');
  assert.ok(diagnostics.textures<28,'Texture is retained across environment changes');
  await page.reload();await page.waitForFunction(()=>window.posterPreview&&document.querySelector('#loading').hidden);
  assert.equal(await page.getByRole('button',{name:'Inside',exact:true}).getAttribute('aria-pressed'),'true');
  await page.setViewportSize({width:1040,height:740});
  await capture('compact-desktop.png');
  await page.setViewportSize({width:390,height:844});
  await capture('mobile.png');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(requests.every(url=>url.startsWith('file:')||url.startsWith('data:')),'Preview made an external network request');
  assert.deepEqual(errors,[]);
  await writeFile(output+'/browser-report.json',JSON.stringify({errors,requests,diagnostics},null,2));
  console.log('Browser checks passed; screenshots:',output);
} finally {await browser.close();}
