import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCE,FAMILIES,CONTROLS,FORMS,CHARACTERS,SOURCE_ROWS,GLYPH_NOTES,render,specimen,glyphGeometry,resolve} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/more-love-study-v2');fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const recordFile=path.join(root,'library/posters',SOURCE.id,'record.json'),record=JSON.parse(fs.readFileSync(recordFile)),image=fileURLToPath(record.imageURL);
fs.copyFileSync(image,path.join(out,'reference.png'));
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...SOURCE,caption:record.source.caption,sourceImage:image,imageSHA256:hash(fs.readFileSync(image)),recordSHA256:hash(fs.readFileSync(recordFile)),basis:'Type system study: one parametric construction kit (tipped frame, elliptical counter, cuts, notches, stems and bars) for all 26 letters. N E W S T U D I O and their placement follow the reference; other letters, shape families and palettes are new. Original production contours, supporting typeface and photographic texture are not recovered.'},null,2));
const examples=[];for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});for(const [slug,name,first,second] of [['fubu','FUBU','FOR','YOU'],['shape-system','SHAPE/SYSTEM','FORM','PLAY'],['make-it-bold','MAKE IT BOLD','MORE','LOVE'],['2021','2021','MORE','LOVE'],['why-not','WHY NOT?','9.10.–17.10.','LUCERNE']])examples.push({name:`${f.id}-${slug}`,state:{family:f.id,name,first,second}});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:2400}}).render().asPng());}
for(const stage of [1,2,3,4])examples.push({name:`stage-${stage}`,state:{stage}});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),new Resvg(r.svg,{fitTo:{mode:'height',value:3000}}).render().asPng());}
const oklch=converter('oklch'),base=resolve({});
const letters=[...CHARACTERS].map(ch=>{const g=glyphGeometry(ch,base);return {letter:ch,origin:GLYPH_NOTES[ch]??(/\d/.test(ch)?'figure':/[A-Z]/.test(ch)?'extension':'punctuation'),bounds:g.bounds.map(v=>+v.toFixed(2)),contours:g.polys.length};});
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,letterforms:FORMS,characters:CHARACTERS,glyphs:letters,sourceRows:SOURCE_ROWS,palettes:FAMILIES.map(f=>({family:f.id,colors:f.colors,oklch:f.colors.map(c=>oklch(c)),figureGroundContrast:wcagContrast(...f.colors)}))},null,2));
// The editor embeds the engine and its polygon library as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'MoreLoveEngine',minify:true,write:false,platform:'browser',legalComments:'inline'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:'/*! Clipper 6.4.2 polygon booleans, (c) Angus Johnson, Boost Software License 1.0 */\n'+bundle.replaceAll('</script','<\\/script'),FAMILIES,SOURCE}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, three 45-glyph specimens and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
