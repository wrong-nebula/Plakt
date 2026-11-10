import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import {Resvg} from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fontPath,normalizedGlyph } from './adapters.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
let browser;
const pages=new Map();
async function getPage(name) {
 if(pages.has(name))return pages.get(name);
 browser??=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:500,height:500},deviceScaleFactor:1});
 await page.route('**/*',route=>route.abort());
 const font=await readFile(fontPath);
 await page.setContent(`<style>@font-face{font-family:Bench;src:url(data:font/ttf;base64,${font.toString('base64')})}body{margin:0;background:#080808}svg{font-family:Bench,Arial;font-size:38px;fill:#f0f0f0}*{box-sizing:border-box}</style><canvas id="canvas" width="400" height="400" hidden></canvas><svg id="target" xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"></svg>`);
 await page.evaluate(()=>document.fonts.ready);
 if(name==='plumin.js') await page.addScriptTag({path:path.join(root,'node_modules/plumin.js/dist/plumin.js')});
 else if(name==='svg-text-animate') await page.addScriptTag({path:path.join(root,'node_modules/svg-text-animate/dist/svg-text-animate.js')});
 else {
  const content=name==='typesettable'?`import * as M from 'typesettable';window.BenchLibrary=M;`:`import {Manuscript} from 'khoshnus';import {FONT_MATRIX} from 'khoshnus/initialize.js';window.BenchLibrary={Manuscript,FONT_MATRIX};`;
  const bundle=await build({stdin:{contents:content,resolveDir:root},absWorkingDir:root,bundle:true,write:false,format:'iife',platform:'browser',logLevel:'silent'});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
 }
 pages.set(name,page);return page;
}
async function browserMake(name,p) {
 const page=await getPage(name);
 const result=await page.evaluate(async({name,p,glyph,font})=>{
  const svg=document.querySelector('#target');svg.innerHTML='';svg.setAttribute('viewBox','0 0 400 400');
  if(name==='plumin.js') {
   if(!window.plumin)throw Error('No plumin global');
   plumin.setup(document.querySelector('#canvas'));
   const outline=new plumin.Outline(glyph);outline.scale(p.stretch,1);outline.rotate(p.tilt);
   const combined=outline.combineTo();
   const d=combined.pathData || combined.children.map(c=>c.pathData).join(' ');
   return {d,fill:true};
  }
  if(name==='typesettable') {
   const typesetter=BenchLibrary.Typesetter.svg(svg);
   typesetter.write('VISUAL COMMUNICATION INSTITUTE OF DESIGN',160+p.warp*170,390,{xAlign:'left',yAlign:'top'});
   const texts=[...svg.querySelectorAll('text')];
   if(!texts.length)throw Error('No wrapped text was produced');
   return {markup:svg.innerHTML,texts:texts.length,fill:true};
  }
  if(name==='svg-text-animate') {
   const actor=new SVGTextAnimate('unused-local-font',{duration:1,mode:'sync','fill-mode':'forwards'}, {'stroke':'#f0f0f0','stroke-width':'1px','font-size':150,'fill-color':'#f0f0f0'});
   actor.setFontFromBuffer(new Uint8Array(font).buffer);actor.create('VC','#target');
   document.querySelectorAll('*').forEach(e=>{if(e.style)e.style.animation='none'});
   document.querySelectorAll('path').forEach(e=>{e.style.setProperty('stroke-dashoffset','0','important');e.style.setProperty('fill','#f0f0f0','important');e.style.setProperty('stroke','#f0f0f0','important');e.style.setProperty('opacity','1','important')});
   if(!svg.querySelector('path'))throw Error('No animated glyph paths were produced');
   return {markup:svg.innerHTML,fill:true};
  }
  if(name==='khoshnus') {
   if(!crypto.randomUUID){let id=0;Object.defineProperty(crypto,'randomUUID',{value:()=>`bench-${++id}`})}
   const manuscript=new BenchLibrary.Manuscript({svgId:'target',font:'BlackCherry',fontSize:'100px',durations:{strokeDashoffsetDuration:1,strokeWidthDuration:1,strokeDuration:1,fillDuration:1}});
   manuscript.write('VC',{textElementAttributes:{x:'16',y:'240',fontSize:'150px',textAnchor:'start',dominantBaseline:'alphabetic'},writeConfiguration:{eachLetterDelay:0,delayOperation:0}});
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const texts=[...svg.querySelectorAll('text')];if(!texts.length)throw Error('No SVG text was generated');
   svg.querySelectorAll('text,tspan').forEach(e=>{e.style.fontFamily='Bench';e.style.setProperty('animation','none','important');e.style.setProperty('fill','#f0f0f0','important');e.style.setProperty('stroke','none','important');e.style.setProperty('opacity','1','important')});
   return {markup:svg.innerHTML,fill:true};
  }
 },{name,p,glyph:normalizedGlyph,font:[...await readFile(fontPath)]});
 if(result.d)return result;
 await page.evaluate(()=>{const s=document.createElement('style');s.textContent='#target * {animation:none!important;transition:none!important;opacity:1!important;fill:#f0f0f0!important;fill-opacity:1!important;stroke-opacity:1!important;stroke-dashoffset:0!important;}';document.head.appendChild(s);const svg=document.querySelector('#target');const b=svg.getBBox();if(!(b.width>1&&b.height>1))throw Error('Empty browser motif bounds');svg.setAttribute('viewBox',`${b.x-3} ${b.y-3} ${b.width+6} ${b.height+6}`);svg.setAttribute('preserveAspectRatio','none')});
 // Preserve actual browser wrapping/animation layout as a PNG motif, not invented paths.
 const png=await page.locator('#target').screenshot({animations:'disabled'});
 const check=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><image width="400" height="400" href="data:image/png;base64,${png.toString('base64')}"/></svg>`).render().pixels;
 let foreground=0;for(let i=0;i<check.length;i+=4)if(check[i]>120&&check[i+3]>120)foreground++;
 if(foreground/(check.length/4)<.01)throw Error(`Static browser motif has insufficient visible content: ${foreground} pixels`);
 return {image:png.toString('base64'),fill:true,markup:result.markup};
}
export const browserAdapters=[
 {name:'plumin.js',role:'editable browser glyph outlines',pros:'Combines a font editor model with Paper-style outlines; supports editable contours.',cons:'Legacy browser environment and bundled dependencies; Node import fails. Browser fixture is required.',make:p=>browserMake('plumin.js',p)},
 {name:'typesettable',role:'browser text wrapping',pros:'Measures and wraps text in SVG using the browser; useful for supporting copy.',cons:'Produces laid-out text, not boolean glyph geometry. It requires browser font metrics; raster motif in this experiment.',make:p=>browserMake('typesettable',p)},
 {name:'svg-text-animate',role:'browser text reveal',pros:'Creates glyph paths and stroke reveal animation from a local font buffer.',cons:'A presentation/animation helper, not a geometry replacement. We freeze its output for static-poster judging.',make:p=>browserMake('svg-text-animate',p)},
 {name:'khoshnus',role:'browser text animation',pros:'Convenient SVG text animation sequencing; can be frozen for a static snapshot.',cons:'Node ESM import fails on extensionless internal import; esbuild resolves it. It animates text elements, not arbitrary outlines. Fixture overrides its decorative font with the same local font for comparison.',make:p=>browserMake('khoshnus',p)}
];
export async function closeBrowser(){await browser?.close();browser=undefined;pages.clear()}
