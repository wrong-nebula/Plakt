import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from 'playwright-core';
import {build} from 'esbuild';
import {makeReport} from './report.mjs';

const exec=promisify(execFile);
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const out=path.resolve(process.argv[2]??path.join(repo,'output/pretext-20261108/final'));
await fs.mkdir(out,{recursive:true});
try {await fs.access(path.join(out,'results.json'));throw Error(`Completed run exists: ${out}; choose a fresh output folder.`);}catch(e){if(e.code!=='ENOENT')throw e;}
const sha=b=>createHash('sha256').update(b).digest('hex');
const productionPath='Sources/PosterCore/Library/SourceLayoutDNA.swift';
const guarded=[productionPath,'Sources/PosterCore/Library/LibrarySceneRenderer.swift','geometry-bench/package.json','geometry-bench/package-lock.json'];
const before=Object.fromEntries(await Promise.all(guarded.map(async p=>[p,sha(await fs.readFile(path.join(repo,p)))])));
const snapshotPath=path.join(here,'source.snapshot.swift');
let snapshot;
try{snapshot=await fs.readFile(snapshotPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;snapshot=await fs.readFile(path.join(repo,productionPath),'utf8');await fs.writeFile(snapshotPath,snapshot,{flag:'wx'});}
const start=snapshot.indexOf('    private static func wrapped('),end=snapshot.indexOf('\n    public static func make(',start);
if(start<0||end<0)throw Error('Cannot locate production wrapping function');
const wrapping=snapshot.slice(start,end);
await fs.writeFile(path.join(out,'current-wrapped.snapshot.txt'),wrapping);
const source=(await fs.readFile(path.join(here,'native-template.swift'),'utf8')).replace('__WRAPPED_FUNCTION__',wrapping.replace('private static func','static func'));
const buildDir=path.join(here,'_build');await fs.mkdir(buildDir,{recursive:true});
const nativeSource=path.join(buildDir,'current.swift'),binary=path.join(buildDir,'current-wrap');
await fs.writeFile(nativeSource,source);
console.log('Compiling standalone Core Text baseline into isolated build folder…');
await exec('/usr/bin/swiftc',['-O','-module-cache-path',path.join(buildDir,'module-cache'),nativeSource,'-o',binary],{maxBuffer:4e6,env:{...process.env,CLANG_MODULE_CACHE_PATH:path.join(buildDir,'module-cache')}});
console.log('Measuring captured Swift wrapper…');
const {stdout}=await exec(binary,[path.join(here,'cases.json')],{maxBuffer:20e6});
const native=JSON.parse(stdout);
await fs.writeFile(path.join(out,'native.json'),JSON.stringify(native,null,2));
const fixtures=JSON.parse(await fs.readFile(path.join(here,'cases.json'),'utf8')).map(f=>({...f,inkTarget:native[f.id].inkTarget,currentEffectiveEm:[...native[f.id].lineMetrics.map(m=>m.effectiveFontSize)].sort((a,b)=>a-b)[Math.floor(native[f.id].lineMetrics.length/2)]}));
const bundle=await build({entryPoints:[path.join(here,'browser.mjs')],bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent'});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-timer-throttling']});
let result;
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  await page.route('**/*',route=>route.abort());
  page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated Pretext experiment</title><body></body></html>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  console.log('Measuring browser controls, Pretext preparation and repeated layout…');
  result=await page.evaluate(fixtures=>window.runExperiment(fixtures),fixtures);
  await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));
  const pretextLines=Object.fromEntries(fixtures.map(f=>[f.id,result.cases[f.id].wrapped.lines.map(l=>l.text)]));
  const preWrapLines=Object.fromEntries(fixtures.map(f=>[f.id,result.cases[f.id].preWrap.lines.map(l=>l.text)]));
  await fs.writeFile(path.join(out,'pretext-lines.json'),JSON.stringify(pretextLines,null,2));
  await fs.writeFile(path.join(out,'prewrap-lines.json'),JSON.stringify(preWrapLines,null,2));
  const pretext=JSON.parse((await exec(binary,[path.join(here,'cases.json'),path.join(out,'pretext-lines.json')],{maxBuffer:20e6})).stdout);
  const preWrap=JSON.parse((await exec(binary,[path.join(here,'cases.json'),path.join(out,'prewrap-lines.json')],{maxBuffer:20e6})).stdout);
  await fs.writeFile(path.join(out,'pretext-native-render.json'),JSON.stringify(pretext,null,2));
  await fs.writeFile(path.join(out,'prewrap-native-render.json'),JSON.stringify(preWrap,null,2));
  const after=Object.fromEntries(await Promise.all(guarded.map(async p=>[p,sha(await fs.readFile(path.join(repo,p)))])));
  const metadata={createdAt:new Date().toISOString(),node:process.version,platform:os.platform(),arch:os.arch(),cpus:os.cpus()[0]?.model,loadavg:os.loadavg(),browser:await browser.version(),pretext:JSON.parse(await fs.readFile(path.join(here,'node_modules/@chenglou/pretext/package.json'),'utf8')).version,sourceSnapshotSHA256:sha(snapshot),wrappingSHA256:sha(wrapping),sharedHashesBefore:before,sharedHashesAfter:after,concurrentChanges:guarded.filter(p=>before[p]!==after[p]),errors};
  const checks=fixtures.flatMap(f=>result.cases[f.id].dom);
  const preWrapChecks=fixtures.flatMap(f=>result.cases[f.id].preWrapDom);
  const compact=s=>s.replace(/\s/gu,'');
  const validation={
    normalHeightMatches:checks.filter(v=>v.match).length,
    preWrapHeightMatches:preWrapChecks.filter(v=>v.match).length,
    exactLineMatches:[...checks,...preWrapChecks].filter(v=>v.exactLinesMatch).length,
    domCheckCount:checks.length+preWrapChecks.length,
    nativeContentPreserved:fixtures.every(f=>native[f.id].byWidth.every(v=>compact(v.lines.join(''))===compact(f.text))),
    pretextContentPreserved:fixtures.every(f=>result.cases[f.id].byWidth.every(v=>compact(v.lines.map(l=>l.text).join(''))===compact(f.text))),
    nativeOutlineOverflows:fixtures.flatMap(f=>native[f.id].lineMetrics.filter(m=>m.width>f.width+.5)).length,
    pretextOutlineOverflows:fixtures.flatMap(f=>pretext[f.id].lineMetrics.filter(m=>m.width>f.width+.5)).length,
    browserControlExactNativeWidths:Object.fromEntries(fixtures.map(f=>[f.id,native[f.id].byWidth.filter((v,i)=>JSON.stringify(v.lines)===JSON.stringify(result.cases[f.id].controls[i].lines)).length]))
  };
  const all={metadata,validation,fixtures,native,browser:result,pretext,preWrap};
  await fs.writeFile(path.join(out,'results.json'),JSON.stringify(all,null,2));
  const {html,markdown,csv}=makeReport(all);
  await fs.writeFile(path.join(out,'report.html'),html);
  await fs.writeFile(path.join(out,'REPORT.md'),markdown);
  await fs.writeFile(path.join(out,'timings.csv'),csv);
  await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  await page.locator('#visual-comparison').screenshot({path:path.join(out,'comparison.png')});
  await page.locator('#performance').screenshot({path:path.join(out,'performance.png')});
  await page.locator('#japanese-paragraphs').screenshot({path:path.join(out,'japanese-paragraphs.png')});
  for(const f of fixtures) {
    await page.locator(`#case-${f.id}`).screenshot({path:path.join(out,`${f.id}.png`)});
    await fs.writeFile(path.join(out,`${f.id}-current.svg`),native[f.id].svg);
    await fs.writeFile(path.join(out,`${f.id}-pretext.svg`),pretext[f.id].svg);
  }
  const qa=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth,missingImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length,svgCount:document.querySelectorAll('svg').length,bodyText:document.body.innerText.length}));
  await fs.writeFile(path.join(out,'visual-qa.json'),JSON.stringify({...qa,validation,errors},null,2));
  console.log(JSON.stringify({out,metadata,qa,validation,summary:fixtures.map(f=>({id:f.id,nativeLines:native[f.id].lines.length,pretextLines:result.cases[f.id].wrapped.lineCount,matchedEmLines:result.cases[f.id].matchedEm.lineCount,domChecks:result.cases[f.id].dom.filter(d=>d.match).length+'/'+f.widths.length,timings:Object.fromEntries(Object.entries(result.cases[f.id].timings).map(([k,v])=>[k,v.medianMs]))}))},null,2));
  if(validation.exactLineMatches!==validation.domCheckCount||!validation.nativeContentPreserved||!validation.pretextContentPreserved||validation.pretextOutlineOverflows||validation.nativeOutlineOverflows||qa.horizontalOverflow||errors.length)throw Error('Experiment validation failed; inspect visual-qa.json.');
} finally {await browser.close();}
