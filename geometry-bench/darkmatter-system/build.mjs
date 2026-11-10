import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {SOURCE,FAMILIES,TREATMENTS,LAYOUTS,FORMATS,PALETTES,CONTROLS,GLYPHS,CHARACTERS,SOURCE_GLYPHS,SOURCE_JOINTS,guides,render,specimen} from './engine.mjs';
import {workshopHTML,FORMAT_PROOFS} from './workshop.mjs';
import {withPrintPanel,printOutputs} from '../print-kit-node.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/darkmatter-study-v2');fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),recordFile=path.join(root,'library/posters',SOURCE.id,'record.json'),record=JSON.parse(fs.readFileSync(recordFile)),image=fileURLToPath(record.imageURL);
fs.copyFileSync(image,path.join(out,'reference.png'));fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...SOURCE,caption:record.source.caption,sourceImage:image,imageSHA256:hash(fs.readFileSync(image)),recordSHA256:hash(fs.readFileSync(recordFile)),basis:'Manually measured and authored poster geometry from a rectified photograph. Rectification is a visual proposal, not a recovered physical page specification. Original font and production outlines are not recovered. The A–Z, Nordic and figure alphabet is a new construction from the source parts. Historical promotion and QR replaced with a study credit and module key.',palette:'Source yellow / ink are median RGB samples of the rectified photograph (ground: luminance > 150, figure: < 70).'},null,2));
const png=svg=>{const r=new Resvg(svg),w=r.width,h=r.height;return new Resvg(svg,{fitTo:w>=h?{mode:'width',value:3000}:{mode:'height',value:3000}}).render().asPng();};
const examples=[];
for(const family of FAMILIES){examples.push({name:family.id,state:{family:family.id}},{name:family.id+'-dark-matter',state:{family:family.id,text:'DARK MATTER',layout:'packed'}});const s=specimen({family:family.id});fs.writeFileSync(path.join(out,`specimen-${family.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${family.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:3000}}).render().asPng());}
for(const stage of [1,2,3,4])examples.push({name:`stage-${stage}`,state:{stage}},{name:`packed-stage-${stage}`,state:{stage,text:'DARK MATTER',layout:'packed'}});
const PROOF_STATES={'format-story-the-unseen':{text:'THE UNSEEN SIDE OF LIGHT',layout:'packed',format:'story',palette:'acid'},'format-square-fubu':{text:'FUBU',layout:'packed',format:'square',palette:'source'},'format-square-bla-baer':{text:'BLÅ BÆR/GRÜN',layout:'packed',format:'square',palette:'signal'},'format-a-series-north-wave':{text:'NORTH/WAVE',layout:'packed',format:'a-series'},'format-landscape-helsinki-2026':{text:'HELSINKI/2026',layout:'packed',format:'landscape',palette:'signal'},'rows-quiz-box-jag':{text:'QUIZ BOX JAG',layout:'rows',format:'square'}};
for(const [name] of FORMAT_PROOFS)examples.push({name,state:PROOF_STATES[name]});
for(const t of TREATMENTS)examples.push({name:'treatment-'+t.id,state:{text:'HØRDE',layout:'packed',treatment:t.id,palette:'source'}});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg));}
const oklch=converter('oklch'),g=guides(Object.fromEntries(CONTROLS.map(c=>[c.key,c.value])));
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:'darkmatter-v2',families:FAMILIES,treatments:TREATMENTS,layouts:LAYOUTS,formats:FORMATS,controls:CONTROLS,guides:g,characters:CHARACTERS.map(ch=>{const r=GLYPHS[ch](g);return {ch,advance:r.adv,ink:r.ink.length,counters:(r.cut??[]).length,pockets:(r.pocket??[]).length,joints:(r.joint??[]).length};}),sourceGlyphs:SOURCE_GLYPHS,joints:SOURCE_JOINTS,
 palettes:PALETTES.map(p=>({...p,oklch:p.colors.map(c=>oklch(c)),figureGroundContrast:wcagContrast(p.colors[0],p.colors[1]),specimenContrast:wcagContrast(p.colors[1],p.colors[2])}))},null,2));
const engine=(await esbuild.build({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'DarkMatterEngine',minify:true,write:false,platform:'browser',target:'es2020',logLevel:'warning'})).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),withPrintPanel(workshopHTML({engine,FAMILIES,TREATMENTS,LAYOUTS,FORMATS,PALETTES,SOURCE})));
// Print outputs from the shared print kit: spot separations and a riso preview for every style.
const print=printOutputs({out,styles:FAMILIES.map(f=>({id:f.id,svg:render({family:f.id}).svg}))});
console.log(`Print kit: ${print.styles} riso previews and ${print.sheets} separation sheets in print/`);
console.log(`Built ${examples.length} SVG/PNG/rule proofs and ${FAMILIES.length} alphabet specimens: ${out}`);
