import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,STYLES,CONTROLS,OPTIONS,GROUPS,LOOKALIKES,CHARACTERS,PRIMITIVES,render,specimen,glyphDef,primitiveOf} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/showa-kana-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','directions','layouts','styles','finishes','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (MoMA, V&A and PGDA records).
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],src=w.id.split('-')[0],ext=['jpg','png'].find(e=>fs.existsSync(path.join(root,'output/japanese-posters/images',src,`${s.id}.${e}`))),image=path.join(root,'output/japanese-posters/images',src,`${s.id}.${ext}`),file=`references/${s.id}.${ext}`;
 fs.copyFileSync(image,path.join(out,file));
 return {...s,file,title:w.title,designer:w.designers?.[0]??w.designer??'designer unknown',date:w.date??s.date,medium:w.medium??null,dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,accession:w.accession??null,imageSHA256:hash(fs.readFileSync(image)),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({references,basis:'Type system study: one kit of stroke skeletons (46 katakana with dakuten, handakuten and small forms, poster kanji, figures and a Latin bar alphabet) drawn in four constructions — square bar, wedge brush, neon tube and stencil — and set left to right, right to left or in vertical columns. Ten families follow posters from 1925 to c.1955; three are new. Letterforms, palettes and layouts are new; nothing is traced from the posters. Reference images are kept locally for study; rights stay with their holders.'},null,2));
// Stage labels and specimen captions need one sans-serif; loading every system font per render is slow.
const FONT={loadSystemFonts:false,fontFiles:['/System/Library/Fonts/Supplemental/Arial.ttf'],defaultFontFamily:'Arial',sansSerifFamily:'Arial'};
// resvg's native buffers are only freed by GC: run with `node --expose-gc` and collect every 25 rasters.
let rasters=0;const raster=(svg,fitTo)=>{const out=new Resvg(svg,{fitTo,font:FONT}).render().asPng();if(++rasters%25===0)globalThis.gc?.();return out;};
const png=(svg,height=3000)=>raster(svg,{mode:'height',value:height});
const examples=[],transfers=[['tokyo','トーキョー'],['design','デザイン'],['expo','日本大博覧会'],['latin','TOKYO/2026']];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});
 for(const [slug,text] of transfers)examples.push({name:`${f.id}-${slug}`,state:{family:f.id,text}});
 for(const stage of [1,2,3,4])examples.push({name:`stage-${f.id}-${stage}`,state:{family:f.id,stage}});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),raster(s,{mode:'width',value:1800}));}
// Look-alike sheets, one per construction.
for(const st of STYLES){const s=specimen({family:{bar:'victrola',wedge:'design',tube:'neon',stencil:'kyoto'}[st.id]},{set:'pairs'});fs.writeFileSync(path.join(out,`pairs-${st.id}.svg`),s);fs.writeFileSync(path.join(out,`pairs-${st.id}.png`),raster(s,{mode:'width',value:1800}));}
// Reading directions, layouts, constructions and finishes on fixed words.
for(const family of ['victrola','design','neon','kyoto'])for(const direction of OPTIONS.direction)examples.push({name:`directions/${family}-${direction}`,state:{family,direction}});
for(const family of ['expo','hanabi'])for(const layout of OPTIONS.layout)examples.push({name:`layouts/${family}-${layout}`,state:{family,layout,text:'東京/ネオン'}});
for(const family of ['victrola','riso'])for(const st of STYLES)examples.push({name:`styles/${family}-${st.id}`,state:{family,style:st.id,params:{...FAMILIES.find(f=>f.id===family).set.params,...st.preset}}});
for(const finish of OPTIONS.finish)examples.push({name:`finishes/${finish}`,state:{family:'calpis',finish,text:'カルピス'}});
for(const [slug,state] of [['light',{family:'victrola',params:{weight:8}}],['heavy',{family:'design',params:{weight:24}}],['contrast-zero',{family:'design',params:{contrast:0}}],['curve-full',{family:'expo',params:{curve:1}}],
 ['corner-round',{family:'nikke',params:{corner:1}}],['slant',{family:'victrola',params:{slant:.35}}],['condensed',{family:'family',params:{width:.66}}],['wide',{family:'calpis',params:{width:1.35}}],
 ['interlock',{family:'design',direction:'ltr',layout:'banner',params:{interlock:1,tracking:-.1}}],['tracking-open',{family:'neon',params:{tracking:.5}}],['tilt-steep',{family:'acid',params:{angle:-35}}],['arc-bend',{family:'kyoto',text:'京都/大博覧会',params:{arc:1.6}}],
 ['romaji',{family:'hanabi',romaji:true,text:'tōkyō/matsuri'}],['latin',{family:'expo',direction:'ltr',text:'EXPO/1936'}],['ornament-none',{family:'victrola',ornament:'none'}],['ornament-triangle',{family:'expo',ornament:'triangle'}],['ornament-rays',{family:'neon',ornament:'rays'}],['ornament-band',{family:'riso',ornament:'band'}]])
 examples.push({name:`variations/${slug}`,state});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.name.includes('/')?1500:3000));}
const oklch=converter('oklch'),groupOf=ch=>GROUPS.find(g=>g[1].includes(ch))[0];
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,styles:STYLES,controls:CONTROLS,options:OPTIONS,characters:CHARACTERS,groups:GROUPS.map(([name,chars])=>({name,count:[...chars].length,chars})),lookalikes:LOOKALIKES,primitives:PRIMITIVES,
 glyphs:[...CHARACTERS].map(ch=>{const d=glyphDef(ch),body=d.strokes.filter(s=>!s.mark);return {glyph:ch,group:groupOf(ch),advance:d.adv,strokes:body.length,marks:d.strokes.length-body.length,primitives:Object.fromEntries(PRIMITIVES.map(p=>[p,body.filter(s=>primitiveOf(s.kind)===p).length]).filter(([,c])=>c)),tightestGap:Object.fromEntries(Object.entries(d.gap).map(([c,g])=>[c,Number.isFinite(g)?+g.toFixed(1):null]))};}),
 palettes:FAMILIES.map(f=>({family:f.id,roles:['ground','ink','shade','accent','accent2','info'],colors:f.colors,oklch:f.colors.map(c=>oklch(c)),inkOnGround:+wcagContrast(f.colors[1],f.colors[0]).toFixed(2)}))},null,2));
// The editor embeds the engine (no dependencies) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'ShowaKanaEngine',minify:true,write:false,platform:'browser',charset:'utf8'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,STYLES,CONTROLS,OPTIONS,GROUPS,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} ${CHARACTERS.length}-glyph specimens, ${STYLES.length} look-alike sheets, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
