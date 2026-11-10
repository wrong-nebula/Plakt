import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {SOURCE,FAMILIES,LAYOUTS,FITS,CUTS,CONTROLS,GLYPHS,GUIDES,SOURCE_COLUMNS,guides,render,resolve,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
import {buildFrozenFonts} from './font.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'output/pablo-capsule-study-v1');fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const recordFile=path.join(root,'library/posters',SOURCE.id,'record.json'),record=JSON.parse(fs.readFileSync(recordFile)),image=fileURLToPath(record.imageURL);
fs.copyFileSync(image,path.join(out,'reference.jpg'));
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...SOURCE,caption:record.source.caption,sourceImage:image,imageSHA256:hash(fs.readFileSync(image)),recordSHA256:hash(fs.readFileSync(recordFile)),basis:'Type system interpreted from visible contours, seams and layout. Glyphs are assemblies of shared parts on common guides; original production outlines, exact typeface and photographic texture are not recovered.'},null,2));
const examples=[];for(const f of FAMILIES){
 examples.push({name:f.id,state:{family:f.id}},{name:`${f.id}-source`,state:{family:f.id,layout:'source'}});
 for(const text of ['fubu/studio','shape/system'])examples.push({name:`${f.id}-${text.replace('/','-')}`,state:{family:f.id,text}});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s).render().asPng());
}
for(const [name,state] of [['layout-down',{layout:'down'}],['layout-rows',{text:'capsule/type/system',layout:'rows'}],['layout-even',{text:'fubu/studio',fit:'even'}],['construction-varied',{text:'capsule/type',layout:'rows',params:{stem:.38,square:.95,bridge:.03,aperture:.28}}],['cut-compressed',{cut:'compressed',text:'zürich/genève',layout:'rows'}]])examples.push({name,state});
for(const stage of [1,2,3,4])examples.push({name:`stage-${stage}`,state:{stage}});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),new Resvg(r.svg,{fitTo:{mode:'height',value:3000}}).render().asPng());}
const oklch=converter('oklch'),defaults=resolve({}).params;
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:'pablo-capsule-v2',families:FAMILIES,layouts:LAYOUTS,fits:FITS,cuts:CUTS.map(c=>({...c,roundCap:Number.isFinite(c.roundCap)?c.roundCap:null})),controls:CONTROLS,guides:{...GUIDES,s:defaults.stem,note:'s = stem / bowl split (control), m = mid line, d = ascender / descender depth.'},
 glyphs:Object.fromEntries(Object.entries(GLYPHS).map(([ch,recipe])=>[ch,recipe(guides(defaults))])),sourceColumns:SOURCE_COLUMNS,
 palettes:FAMILIES.map(f=>({family:f.id,colors:f.colors,oklch:f.colors.map(c=>oklch(c)),figurePaperContrast:wcagContrast(...f.colors)}))},null,2));
const engine=fs.readFileSync(path.join(root,'geometry-bench/pablo-capsule-system/engine.mjs'),'utf8').replace(/\bexport /g,'');
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine,FAMILIES,LAYOUTS,FITS,CUTS,SOURCE}));
console.log(`Built ${examples.length} vector/PNG/rule examples and three alphabet specimens: ${out}`);
buildFrozenFonts();
