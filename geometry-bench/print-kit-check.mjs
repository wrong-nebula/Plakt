// Checks the print kit in every system that uses it, and draws a board of their riso previews.
//   node geometry-bench/print-kit-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {PRINT_KIT,spotSeparations,risoPreview,inksOf,luminance} from './print-kit.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),report=path.join(root,'output/print-kit-v1');fs.mkdirSync(report,{recursive:true});
const SYSTEMS=[['heavy-dither','output/heavy-dither-study-v1'],['rkc-disc','output/rkc-disc-study-v2'],['darkmatter','output/darkmatter-study-v2'],['plot-slice','output/plot-slice-study-v1'],['tategaki','output/tategaki-study-v1'],['rule-field','output/rule-field-study-v1',true]];
const raster=(svg,w=240)=>new Resvg(svg,{fitTo:{mode:'width',value:w},font:{loadSystemFonts:/<text\b/.test(svg)}}).render();
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),near=(p,i,c,t=18)=>Math.abs(p[i]-c[0])+Math.abs(p[i+1]-c[1])+Math.abs(p[i+2]-c[2])<=t;
const results={},thumbs=[];
for(const [sys,out,own] of SYSTEMS){const E=await import(`./${sys}-system/engine.mjs`),fams=E.FAMILIES,rows=[];
 const html=fs.readFileSync(path.join(root,out,'index.html'),'utf8');assert(html.includes(`<!-- ${PRINT_KIT} -->`)&&html.includes('dialog class="pk"'),`${sys}: editor has no print panel`);
 const index=JSON.parse(fs.readFileSync(path.join(root,out,'print/index.json'),'utf8'));assert.equal(index.styles.length,fams.length,`${sys}: print outputs`);
 for(const f of fams){const r=E.render({family:f.id}),svg=typeof r==='string'?r:r.svg,info=inksOf(svg),seps=own?E.separations({family:f.id}):spotSeparations(svg),riso=risoPreview(seps,{poster:svg});
  // Pure sheets: only black and white paint, no glow or blend left (styles with gradients or transparency are flagged instead).
  for(const s of seps)if(own||!info.impure.length){assert(!/(?:fill|stroke|stop-color)="#(?!000000|ffffff)[0-9a-fA-F]{6}"/.test(s.svg)&&!/mix-blend-mode|filter="url/.test(s.svg),`${sys} ${f.id} ${s.ink}: sheet is not black and white`);}
  assert.equal(riso.inks.length,seps.length+(info.dark&&!seps.some(s=>s.ink==='paper')?1:0),`${sys} ${f.id}: riso layers`);assert(!/NaN|undefined/.test(riso.svg),`${sys} ${f.id}: riso`);
  // Spot sheets match the poster: wherever the poster shows an ink's colour, that ink's sheet is black and every other sheet white.
  // At the poster's own size, so dither cells and hairlines are whole pixels.
  let checked=0,wrong=0;if(!own&&!info.impure.length){const w=+(svg.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)/)?.[1]??728),P=raster(svg,w).pixels,S=seps.map(s=>({c:rgb(s.colour),p:raster(s.svg,w).pixels}));
   for(let i=0;i<P.length;i+=16)for(const s of S)if(near(P,i,s.c)){checked++;if(!S.every(o=>o===s?o.p[i]<80:o.p[i]>175))wrong++;break;}
   assert(checked>200&&wrong/checked<.02,`${sys} ${f.id}: ${wrong} of ${checked} ink pixels do not match their sheets`);}
  rows.push({id:f.id,inks:riso.inks.length,paperPrinted:riso.inks.some(i=>i.ink==='paper'),impure:own?[]:info.impure,checkedPixels:checked,mismatch:checked?+(wrong/checked).toFixed(4):null});
  if(thumbs.filter(t=>t.sys===sys).length<3)thumbs.push({sys,id:f.id,png:raster(riso.svg,260).asPng()});}
 results[sys]={styles:rows.length,ownSeparations:!!own,sheets:rows.reduce((a,r)=>a+r.inks,0),flagged:rows.filter(r=>r.impure.length).map(r=>`${r.id} (${r.impure.join(', ')})`),rows};}
// Board: three riso previews per system.
const cw=260,ch=368,gap=16,cols=6,rowsN=Math.ceil(thumbs.length/cols),W=cols*(cw+gap)+gap,H=rowsN*(ch+40)+60;
const cells=thumbs.map((t,i)=>{const x=gap+(i%cols)*(cw+gap),y=50+Math.floor(i/cols)*(ch+40);return `<image x="${x}" y="${y}" width="${cw}" height="${ch}" preserveAspectRatio="xMidYMin meet" href="data:image/png;base64,${t.png.toString('base64')}"/><text x="${x}" y="${y+ch+22}" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#696a70">${t.sys} · ${t.id}</text>`;});
const board=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ecebe6"/><text x="${gap}" y="32" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="#1e1e22">Print kit: riso previews across systems</text>${cells.join('')}</svg>`;
fs.writeFileSync(path.join(report,'board.png'),new Resvg(board,{fitTo:{mode:'width',value:W}}).render().asPng());
fs.writeFileSync(path.join(report,'validation.json'),JSON.stringify({status:'passed',kit:PRINT_KIT,checks:'per style: separations pure black and white (styles with gradients, transparency or blend modes are flagged instead); spot sheets match the poster (wherever the poster shows an ink, that sheet is black and the others white, within 2% of sampled pixels); one riso layer per ink, paper printed when it is dark or lighter inks sit on it; editor carries the panel; build wrote print outputs',systems:results},null,2));
console.log(`PASS: ${Object.entries(results).map(([s,r])=>`${s} ${r.styles} styles / ${r.sheets} sheets${r.flagged.length?` (${r.flagged.length} flagged)`:''}`).join('; ')}`);
