// Re-render the existing three R constructions with independent colour harmonies.
// Shape geometry and construction parameters are preserved exactly.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast,displayable} from 'culori';
import {render,DEFAULT_COLORS} from './engine-v1.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'output/rkc-color-study-v1');fs.mkdirSync(out,{recursive:true});
const oklch=converter('oklch');
const canonical=(svg,colors)=>colors.reduce((s,c,i)=>s.replaceAll(c,`__INK_${i}__`),svg);
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const studies=[
 {id:'01-disc-indigo',kernel:'disc',title:'Discs and half-discs',palette:'Indigo / lilac / midnight',
  colors:['#3d3fac','#cdbef5','#24263e'],harmony:'Analogous indigo and violet, with a darker blue-violet counter.'},
 {id:'02-pillow-mint',kernel:'pillow',title:'Soft-square modules',palette:'Mint / forest / lavender',
  colors:['#a8d4b5','#234b3b','#dad5f2'],harmony:'Related greens balanced by a low-chroma violet complement; dark figure over light counters.'},
 {id:'03-facet-rose',kernel:'facet',title:'Faceted modules',palette:'Rose / pink / aubergine',
  colors:['#91275e','#f0b3d3','#43263e'],harmony:'Analogous rose and red-violet, separated through lightness and chroma.'}
];
assert.equal(new Set(studies.flatMap(s=>s.colors)).size,9,'Nine independent swatches');
for(const study of studies){
 assert(study.colors.every(c=>!DEFAULT_COLORS.includes(c)),'No original inks');
 assert(study.colors.every(displayable),'sRGB gamut');
 const r=render({text:'R',kernel:study.kernel,colors:study.colors});
 const base=render({text:'R',kernel:study.kernel});
 assert.equal(canonical(r.svg,study.colors),canonical(base.svg,DEFAULT_COLORS),'Only colours change');
 const figureContrast=wcagContrast(study.colors[1],study.colors[2]);
 const captionContrast=wcagContrast(study.colors[1],study.colors[0]);
 assert(figureContrast>=4.5&&captionContrast>=4.5,'Distinct ink roles and caption contrast');
 const scale=3000/Math.max(r.width,r.height),width=Math.round(r.width*scale);
 const png=new Resvg(r.svg,{fitTo:{mode:'width',value:width}}).render();
 fs.writeFileSync(path.join(out,study.id+'.svg'),r.svg);
 fs.writeFileSync(path.join(out,study.id+'.png'),png.asPng());
 fs.writeFileSync(path.join(out,study.id+'.json'),JSON.stringify(r.state,null,2));
 Object.assign(study,{state:r.state,width:png.width,height:png.height,geometrySHA256:digest(canonical(r.svg,study.colors)),
  swatches:study.colors.map((hex,i)=>({role:['gap','letter','counter'][i],hex,oklch:oklch(hex)})),
  contrast:{method:'WCAG relative luminance',figureCounter:figureContrast,captionBackground:captionContrast}});
}
fs.writeFileSync(path.join(out,'colors.json'),JSON.stringify({studies,verification:'All three colour-normalised SVGs exactly match the original geometry. All nine swatches are sRGB and distinct; original palette omitted.'},null,2));

const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RKC — three colour harmonies</title><style>
*{box-sizing:border-box}body{margin:0;background:#e2e4e9;color:#29313f;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{max-width:1600px;margin:auto;padding:28px}h1{font-size:28px;letter-spacing:-.7px;margin:0 0 22px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px}figure{margin:0}img{display:block;width:100%;height:auto}h2{font-size:16px;margin:15px 0 3px;font-weight:600}p{font-size:13px;margin:4px 0;color:#647082}a{color:inherit;text-underline-offset:3px}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:13px}.swatches{display:flex;gap:6px;margin:11px 0}.swatch{height:15px;width:32px;border-radius:2px;box-shadow:inset 0 0 0 1px #0001}.board{margin-top:30px}@media(max-width:650px){main{padding:18px}.grid{grid-template-columns:1fr;gap:28px}figure{max-width:500px;margin:auto}}
</style><main><h1>Three colour harmonies</h1><div class="grid">${studies.map(s=>`<figure><a href="${s.id}.png"><img src="${s.id}.png" alt="${s.title} in ${s.palette}"></a><figcaption><h2>${s.id.slice(0,2)} / ${s.title}</h2><p>${s.palette}</p><div class="swatches">${s.colors.map(c=>`<span class="swatch" style="background:${c}" title="${c}"></span>`).join('')}</div><div class="links"><a href="${s.id}.png">PNG</a><a href="${s.id}.svg">SVG</a><a href="${s.id}.json">Saved rule</a><a href="../rkc-disc-study-v1/index.html?rule=${encodeURIComponent(JSON.stringify(s.state))}">Edit this palette</a></div></figcaption></figure>`).join('')}</div><p class="board"><a href="color-triptych.png">Full comparison board</a> · <a href="colors.json">Palette values</a></p></main></html>`;
fs.writeFileSync(path.join(out,'index.html'),html);
console.log('Rendered three palettes; exact geometry preserved; no original inks; all swatches in gamut.');
console.log(studies.map(s=>`${s.palette}: ${s.colors.join(' / ')}`).join('\n'));
