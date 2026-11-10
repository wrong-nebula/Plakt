import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,LAYOUTS,PATTERNS,LETTER_SOURCES,ROLES,CHARACTERS,render,specimen,kit,tile,patternPeriod,glyphShape} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
// resvg's native buffers are freed only by garbage collection: run with --expose-gc and collect every 10 rasters.
let rasters=0;const Resvg_=Resvg,rv=(svg,opts)=>{if(++rasters%10===0)globalThis.gc?.();return new Resvg_(svg,opts);};
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/wagara-study-v1');
// The editor embeds the engine (clipper and the prepared outlines included) as one offline script.
// `--editor` re-bundles only the editor, using the references of the last full build.
function writeEditor(references){const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'WagaraEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
 fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LAYOUTS,PATTERNS,LETTER_SOURCES,ROLES,references}));return bundle.length;}
if(process.argv.includes('--editor')){const kb=writeEditor(JSON.parse(fs.readFileSync(path.join(out,'source.json'))).references);console.log(`Rebuilt the editor (${(kb/1024).toFixed(0)} KB engine).`);process.exit(0);}
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','layouts','variations','scales','sources','patterns'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (MoMA and PGDA records), copied with provenance.
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),image=path.join(dir,name),file='references/'+name;fs.copyFileSync(image,path.join(out,file));
 return {...s,file,title:w.title,designer:w.designer,date:w.date,medium:w.medium??'Print',dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,credit:w.credit??null,imageSHA256:hash(fs.readFileSync(image)),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({system:'Wagara window letters (type system 6)',references,fonts:JSON.parse(fs.readFileSync(path.join(here,'font-provenance.json'))),
 basis:'Type system study: heavy letters as clip-path windows into a procedural kit of eighteen tileable wagara (traditional Japanese patterns), each window in its own two inks; the same kit fills bands, fields, seas, frames, discs and emblems. Six styles follow posters by Ikko Tanaka (Poster Nippon, 1972), Tadanori Yokoo (Takeo 1997, Bunraku 1971, 16th JAAC c. 1956–66), Yusaku Kamekura (1981) and Norito Shinmura (MUJI, 2014); three are new. Letterforms, motifs, palettes and layouts are new constructions; nothing is traced. Reference images are kept locally for study only.'},null,2));
// Only the faces the posters name are loaded, so each render skips the system font scan.
const FONT={loadSystemFonts:false,fontFiles:['/System/Library/Fonts/HelveticaNeue.ttc','/System/Library/Fonts/Helvetica.ttc','/System/Library/Fonts/Supplemental/Georgia.ttf','/System/Library/Fonts/Supplemental/Georgia Italic.ttf','/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'].filter(f=>fs.existsSync(f)),defaultFontFamily:'Helvetica Neue'};
const png=(svg,height=3000)=>rv(svg,{font:FONT,fitTo:{mode:'height',value:height}}).render().asPng();
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},height:3000});
 for(const [slug,text] of [['type-system','TYPE/SYSTEM'],['kyoto','KYOTO'],['2026','2026'],['hello','HELLO!']])examples.push({name:`${f.id}-${slug}`,state:{family:f.id,text},height:1500});
 for(const stage of [1,2,3,4])examples.push({name:`stage-${f.id}-${stage}`,state:{family:f.id,stage},height:1200});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),rv(s,{font:FONT,fitTo:{mode:'width',value:2000}}).render().asPng());
 const k=kit({family:f.id});fs.writeFileSync(path.join(out,`kit-${f.id}.svg`),k);fs.writeFileSync(path.join(out,`kit-${f.id}.png`),rv(k,{font:FONT,fitTo:{mode:'width',value:1600}}).render().asPng());}
// Every layout on two styles, one word.
for(const family of ['tanaka','neon'])for(const l of LAYOUTS)examples.push({name:`layouts/${family}-${l.id}`,state:{family,layout:l.id,text:'WA/GARA'},height:1200});
// Legibility across pattern scales (minimum to maximum).
for(const family of ['tanaka','kamekura','neon','aizome'])for(const scale of [10,24,60,160])examples.push({name:`scales/${family}-${scale}`,state:{family,params:{scale}},height:1000});
// Five letter sources in one style.
for(const s of LETTER_SOURCES)examples.push({name:`sources/${s.id}`,state:{family:'tanaka',letters:s.id,text:'WA/GARA'},height:1200});
// Variations on one word: weight, width, turns, anchor, inks, edges, shadows, sequences, grounds.
for(const [slug,state] of [['heavy',{family:'tanaka',params:{weight:.15}}],['light',{family:'tanaka',params:{weight:-.02,gutter:.2}}],['condensed',{family:'bunraku',layout:'stack',params:{width:.62}}],['turned',{family:'neon',params:{rotate:30,rotateStep:15}}],
 ['field-anchor',{family:'tanaka',anchor:'field',assign:'single',pattern:'seigaiha'}],['two-ink',{family:'tanaka',inking:'two-ink'}],['swap',{family:'hinode',inking:'swap',layout:'stack'}],['rim',{family:'tanaka',edge:'rim',params:{keyline:6}}],
 ['double',{family:'neon',edge:'double',shadow:'none'}],['block',{family:'kamekura',shadow:'block',params:{depth:14}}],['glow',{family:'tanaka',shadow:'glow',edge:'keyline',colors:['#06050a','#f2f0ff','#19f0ff','#19f0ff','#ff2bd6','#06050a','#1c1638']}],['shuffle',{family:'aizome',assign:'shuffle'}],
 ['figurative',{family:'kamekura',sequence:['sakura','ume','kiku','sakura','ume','kiku'],inking:'cycle',windows:[['#0d0c0b','#e46aa5'],['#12100e','#f3eadc'],['#0d0c0b','#c99ad8'],['#16130f','#e46aa5'],['#0d0c0b','#f3eadc'],['#12100e','#c99ad8']],params:{scale:40,detail:3}}],
 ['detail',{family:'aizome',params:{detail:4,stroke:1.6}}],['ground-asanoha',{family:'tanaka',groundPattern:'asanoha',params:{groundScale:60}}],['kabuki-frame',{family:'kabuki',layout:'frame',groundPattern:'ichimatsu',params:{bands:2,groundScale:24}}]])
 examples.push({name:`variations/${slug}`,state:{text:'WA/GARA',...state},height:1200});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.height));}
// Pattern tiles: one exact repeat each (SVG), and a 3 × 3 repeat of that tile as evidence that it tiles.
const tileInks={paper:'#1f2d66',ink:'#f1ece0',accent:'#e3402f',cycle:['#f1ece0','#f2b632','#e86aa6']},tiles=[];
for(const p of PATTERNS){const P={s:48,sw:1,d:p.detail[0]===p.detail[1]?1:Math.min(3,p.detail[1])},t=tile(p.id,P,tileInks);fs.writeFileSync(path.join(out,`patterns/${p.id}.svg`),t.svg);
 // Each copy is a nested viewport, as the tile clips when placed elsewhere.
 const k=Math.max(1,Math.ceil(150/Math.min(t.width,t.height))),reps=[];for(let i=0;i<3*k;i++)for(let j=0;j<3*k;j++)reps.push(t.svg.replace('<svg ',`<svg x="${(i*t.width).toFixed(4)}" y="${(j*t.height).toFixed(4)}" `));
 const rep=`<svg xmlns="http://www.w3.org/2000/svg" width="${(3*k*t.width).toFixed(2)}" height="${(3*k*t.height).toFixed(2)}">${reps.join('')}</svg>`;fs.writeFileSync(path.join(out,`patterns/${p.id}-repeat.png`),rv(rep,{font:FONT,fitTo:{mode:'width',value:600}}).render().asPng());
 tiles.push({id:p.id,name:p.name,jp:p.jp,gloss:p.gloss,kind:p.kind,detail:p.detail,params:P,tile:[+t.width.toFixed(3),+t.height.toFixed(3)],period:t.period});}
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,layouts:LAYOUTS,letterSources:LETTER_SOURCES,roles:ROLES,characters:CHARACTERS,patterns:tiles,
 glyphs:LETTER_SOURCES.map(s=>({source:s.id,glyphs:[...CHARACTERS].map(ch=>{const g=glyphShape(s.id,ch,1,0);return {glyph:ch,contours:g.polys.length,points:g.polys.reduce((a,p)=>a+p.length,0),width:+(g.bbox[2]-g.bbox[0]).toFixed(3)};})})),
 palettes:FAMILIES.map(f=>({family:f.id,roles:ROLES,colors:f.colors,windows:f.windows,oklch:f.colors.map(c=>oklch(c)),windowContrast:f.windows.map(([p,i])=>+wcagContrast(p,i).toFixed(2)),windowOnGround:f.windows.map(([p])=>+wcagContrast(p,f.colors[0]).toFixed(2))}))},null,2));
const editorBytes=writeEditor(references);
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} specimens and kit sheets, ${tiles.length} pattern tiles, ${references.length} references and the editor (${(editorBytes/1024).toFixed(0)} KB engine): ${out}`);
