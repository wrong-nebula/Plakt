import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import esbuild from 'esbuild';
import {Resvg as ResvgBase} from '@resvg/resvg-js';
// Every SVG here is outlined paths, so skip resvg's system-font scan, which costs about a second per instance.
class Resvg extends ResvgBase{constructor(svg,options={}){super(svg,{...options,font:{loadSystemFonts:false}});}}
import {converter,wcagContrast} from 'culori';
import {SOURCE,FAMILIES,CONTROLS,PRESETS,PALETTES,MODULES,DEFAULT_MODULES,FORMATS,SCAFFOLDS,GLYPHS,SOURCE_WINDOWS,SOURCE_FRAMES,render,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
import {withPrintPanel,printOutputs} from '../print-kit-node.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/plot-slice-study-v1');fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),recordFile=path.join(root,'library/posters',SOURCE.id,'record.json'),record=JSON.parse(fs.readFileSync(recordFile)),image=fileURLToPath(record.imageURL);
fs.copyFileSync(image,path.join(out,'reference.jpg'));fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...SOURCE,caption:record.source.caption,sourceImage:image,imageSHA256:hash(fs.readFileSync(image)),recordSHA256:hash(fs.readFileSync(recordFile)),basis:'Manual vector study of a repeated master word clipped by progressively taller top-aligned horizontal windows. Nine reveal heights and glyph frames measured from a rectified photograph. No original production paths or exact typeface recovered. Angled slices, turned stacks, weight-true widths, text lines, figures, construction modules, formats and scaffolds are new extensions of the same reveal rule.'},null,2));
fs.copyFileSync(path.join(here,'type-provenance.json'),path.join(out,'supporting-type.json'));
const examples=[];for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});for(const word of ['Fubu','Shape system'])examples.push({name:f.id+'-'+word.toLowerCase().replaceAll(' ','-'),state:{family:f.id,word}});const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`master-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`master-${f.id}.png`),new Resvg(s).render().asPng());}
for(const stage of [1,2,3,4])examples.push({name:`stage-${stage}`,state:{stage}});
for(const p of PRESETS)examples.push({name:`angle-${p.id}`,state:{params:p.params}});for(const family of ['shear','bowed'])examples.push({name:`angle-vertical-slices-${family}`,state:{family,params:PRESETS[1].params}});
const palette=id=>PALETTES.find(p=>p.id===id).colors;
examples.push(
 {name:'text-shape-system',state:{word:'Shape system'}},
 {name:'text-lausanne-2019',state:{word:'Lausanne 2019',family:'bowed',colors:palette('signal')}},
 {name:'text-plot-atlas-2019',state:{word:'Plot / atlas / 2019',params:{rows:6},colors:palette('acid')}},
 {name:'text-forum-vertical',state:{word:'Forum 19.09',params:{slice:90,rows:6},family:'shear',colors:palette('ice')}}
);
// Each format with a different scaffold and system, so the page proofs also show modules working together.
examples.push(
 {name:'format-story',label:'Story 9 × 16',note:'Saw drift · f’ar scaffold',state:{format:'story',family:'saw',word:'Lausanne 2019'}},
 {name:'format-square',label:'Square',note:'Aperture · own caption',state:{format:'square',scaffold:'caption',family:'aperture',word:'Atlas',caption:'Forum d’architectures / Lausanne 19.09 — 20.10.19'}},
 {name:'format-landscape',label:'Landscape 16 × 9',note:'Accordion · type only',state:{format:'landscape',scaffold:'none',family:'accordion',word:'Plot atlas'}},
 {name:'format-banner',label:'Banner 3 × 1',note:'Exploded strata · own caption',state:{format:'banner',scaffold:'caption',family:'strata',word:'Shape system',caption:'Letter slices / any page'}}
);
const TEXTS=[],FORMAT_EXAMPLES=[];for(const e of examples){const r=render(e.state);if(e.name.startsWith('format-'))FORMAT_EXAMPLES.push({name:e.name,state:r.state,label:e.label,note:e.note});if(e.name.startsWith('text-'))TEXTS.push({name:e.name,state:r.state,label:r.plan.lines.map(l=>l.text).join(' / '),note:`${r.plan.lines.length} line${r.plan.lines.length>1?'s':''} · width ${r.plan.lines.map(l=>Math.round(l.k*100)+'%').join(' / ')}`});fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),new Resvg(r.svg,{fitTo:{mode:'height',value:3000}}).render().asPng());}
const oklch=converter('oklch');fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({families:FAMILIES,modules:MODULES,formats:FORMATS,scaffolds:SCAFFOLDS,controls:CONTROLS,presets:PRESETS,palettes:PALETTES,glyphs:GLYPHS,sourceWindows:SOURCE_WINDOWS,sourceFrames:SOURCE_FRAMES,familyPalettes:FAMILIES.map(f=>({family:f.id,colors:f.colors,oklch:f.colors.map(c=>oklch(c)),figureGroundContrast:wcagContrast(...f.colors)})),sharedPalettes:PALETTES.filter(p=>p.colors).map(p=>({id:p.id,colors:p.colors,figureGroundContrast:wcagContrast(...p.colors)}))},null,2));
// The engine imports Clipper, so the offline editor gets an esbuild bundle rather than inlined source.
const engine=(await esbuild.build({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'PlotEngine',minify:true,write:false,platform:'browser',target:'es2020',logLevel:'warning'})).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),withPrintPanel(workshopHTML({engine,FAMILIES:FAMILIES.map(f=>({...f,summary:['sequence','edge','motion'].map(k=>MODULES[k].find(m=>m.id===(f.modules[k]??DEFAULT_MODULES[k])).name).join(' · ')})),PRESETS,PALETTES,MODULES,FORMATS,SCAFFOLDS,TEXTS,FORMAT_EXAMPLES,SOURCE})));
// Print outputs from the shared print kit: spot separations and a riso preview for every style.
const print=printOutputs({out,styles:FAMILIES.map(f=>({id:f.id,svg:render({family:f.id}).svg}))});
console.log(`Print kit: ${print.styles} riso previews and ${print.sheets} separation sheets in print/`);
console.log(`Built ${examples.length} SVG/PNG/rule proofs and master specimens: ${out}`);
