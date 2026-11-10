import { chromium } from 'playwright-core';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const output=fileURLToPath(new URL('../output/print-preview/high-resolution/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.POSTER_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:1240,height:850},deviceScaleFactor:1,acceptDownloads:true});
  page.setDefaultTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(new URL('../Sources/PosterCore/Resources/PrintPreview/index.html',import.meta.url).href);
  await page.waitForFunction(()=>window.posterPreview&&document.querySelector('#loading').hidden);
  const original=await page.evaluate(()=>window.posterPreview.diagnostics());
  const report=[];
  for(const [size,longEdge] of [['4k',3840],['12k',12288]]) {
    await page.getByLabel('Output resolution',{exact:true}).selectOption(size);
    const start=Date.now(),downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Render PNG…',exact:true}).click();
    await page.locator('#render-progress').waitFor({state:'visible'});
    await page.screenshot({path:output+`rendering-${size}.png`});
    const download=await downloadPromise,file=output+`studio-${size}.png`;await download.saveAs(file);
    await page.locator('#render-progress').waitFor({state:'hidden'});
    const png=await readFile(file),width=png.readUInt32BE(16),height=png.readUInt32BE(20);
    assert.equal(Math.max(width,height),longEdge);
    const after=await page.evaluate(()=>window.posterPreview.diagnostics());
    assert.deepEqual(after.camera,original.camera);assert.deepEqual(after.target,original.target);
    assert.equal(after.filtering.renderPixels,original.filtering.renderPixels);
    report.push({size,width,height,bytes:png.length,milliseconds:Date.now()-start});
    console.log(report.at(-1));
  }
  await page.getByRole('button',{name:'Render PNG…',exact:true}).click();
  await page.locator('#render-progress').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('#render-progress').waitFor({state:'hidden'});
  assert.equal(await page.getByRole('button',{name:'Render PNG…',exact:true}).isEnabled(),true);
  assert.equal(await page.locator('#render-hold').isVisible(),false);
  await page.screenshot({path:output+'preview-restored.png'});
  assert.deepEqual(errors,[]);
  await writeFile(output+'report.json',JSON.stringify({exports:report,cancelled:true,errors},null,2));
  console.log('High-resolution PNG, cancellation and preview restoration checks passed');
} finally {await browser.close();}
