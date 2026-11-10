import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {SOURCE,FAMILIES,CONTROLS,G_PARTS,S_NODES,render,specimen} from './engine.mjs';
import {FONT} from '../fonts.mjs';
import {ALPHABET} from './alphabet.mjs';
import {SKELETONS} from './skeletons.mjs';
import {workshopHTML} from './workshop.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'output/pages-atlas-study-v1');fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),recordFile=path.join(root,'library/posters',SOURCE.id,'record.json'),record=JSON.parse(fs.readFileSync(recordFile)),image=fileURLToPath(record.imageURL);
fs.copyFileSync(image,path.join(out,'reference.png'));fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...SOURCE,caption:record.source.caption,sourceImage:image,imageSHA256:hash(fs.readFileSync(image)),recordSHA256:hash(fs.readFileSync(recordFile)),basis:'Manual construction study of the visible specimen collage. Several source glyph methods are preserved and extended with new modules. Original typefaces, production contours, photographic texture and the small source illustration are not recovered; a book-construction diagram replaces that illustration.'},null,2));
fs.copyFileSync(path.join(root,'geometry-bench/pages-atlas-system/font-provenance.json'),path.join(out,'supporting-type.json'));
const examples=[];for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});for(const letters of ['SHAPE','FORMS'])examples.push({name:f.id+'-'+letters.toLowerCase(),state:{family:f.id,letters}});const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s).render().asPng());}
for(const stage of [1,2,3,4])examples.push({name:`stage-${stage}`,state:{stage}});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),new Resvg(r.svg,{fitTo:{mode:'height',value:3000}}).render().asPng());}
const oklch=converter('oklch');fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({families:FAMILIES,controls:CONTROLS,organicParts:G_PARTS,sourceNodes:S_NODES,perforationAlphabet:ALPHABET,palettes:FAMILIES.map(f=>({family:f.id,colors:f.colors,oklch:f.colors.map(c=>oklch(c)),figureGroundContrast:wcagContrast(...f.colors)}))},null,2));
const engine=`const FONT=${JSON.stringify(FONT)};\nconst ALPHABET=${JSON.stringify(ALPHABET)};\nconst SKELETONS=${JSON.stringify(SKELETONS)};\n`+fs.readFileSync(path.join(root,'geometry-bench/pages-atlas-system/v1/engine.mjs'),'utf8').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine,FAMILIES,SOURCE}));
console.log(`Built ${examples.length} SVG/PNG/rule proofs and three construction strips: ${out}`);
