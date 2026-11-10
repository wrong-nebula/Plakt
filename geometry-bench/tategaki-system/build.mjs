import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import * as E from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
import {withPrintPanel,printOutputs} from '../print-kit-node.mjs';
const {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,PRESETS,STAGES,ROLES,CHARS,FACES,KANJI_COUNT,MIRROR,render,specimen,verticalForms}=E;
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/tategaki-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive; images stay local.
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',s.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),image=path.join(dir,name),file='references/'+name;fs.copyFileSync(image,path.join(out,file));
 return {...s,file,catalogTitle:w.title,catalogDesigner:w.designer,date:w.date??s.date,medium:w.medium??null,dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,accession:w.accession??null,imageSHA256:hash(fs.readFileSync(image)),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({system:'Tategaki colour columns (type system 5)',references,basis:'Type system study of vertical Japanese setting. Seven styles follow composition principles of the references (column colour cycles, bottom-aligned ragged columns, right-to-left prewar headers, a gradient title column between pictures, a sparse tracked title, cascading hand-set columns, a title band beside sideways Latin bands); three are new. Glyph outlines come from the macOS Hiragino fonts (see type.json); nothing is traced from the posters. Reference images are copyrighted and kept locally for study only.'},null,2));
fs.copyFileSync(path.join(here,'font-provenance.json'),path.join(out,'type.json'));
const png=(svg,height=3000)=>new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();
const preset=id=>PRESETS.find(p=>p.id===id).text,examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});
 for(const id of ['transfer','haiku','festival'])examples.push({name:`${f.id}-${id}`,state:{family:f.id,text:preset(id),header:'',latin:''}});
 const s=specimen({family:f.id});if(!fs.existsSync(path.join(out,`specimen-${f.set.face}.svg`))){fs.writeFileSync(path.join(out,`specimen-${f.set.face}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.set.face}.png`),new Resvg(s,{fitTo:{mode:'width',value:2000}}).render().asPng());}}
for(const family of ['noh','ballet','prewar','manuscript'])for(const stage of [1,2,3,4])examples.push({name:`stage-${family}-${stage}`,state:{family,stage}});
// Variations: one control or option at a time, on one style and one text.
const T=preset('transfer'),V=[];
for(const align of OPTIONS.align)V.push([`align-${align}`,{family:'fukuda',text:T,align,params:{scale:.72,drift:1}},`Align: ${align}`,'Green bottom line']);
for(const layout of OPTIONS.layout)V.push([`layout-${layout}`,{family:'dream',layout},`Layout: ${layout}`,'Sparse title']);
V.push(['rtl-prewar',{family:'prewar',direction:'rtl',text:T},'Right-to-left rows','Prewar']);V.push(['rtl-noh',{family:'noh',direction:'rtl'},'Right-to-left rows','Noh colour columns']);
for(const colorMode of OPTIONS.colorMode)V.push([`colour-${colorMode}`,{family:'noh',text:T,colorMode},`Colour: ${colorMode}`,'Noh colour columns']);
for(const fill of OPTIONS.fill)V.push([`fill-${fill}`,{family:'neon',fill},`Fill: ${fill}`,'Neon cascade']);
for(const ground of OPTIONS.ground)V.push([`ground-${ground}`,{family:'riso',text:T,ground,layout:'start',params:{scale:.8}},`Ground: ${ground}`,'Riso overprint']);
for(const numerals of OPTIONS.numerals)V.push([`numerals-${numerals}`,{family:'ballet',numerals,text:'*第35回/2026年8月8日/午後7時30分開演'},`Numbers: ${numerals}`,'Band and Latin']);
for(const latinForm of OPTIONS.latinForm)V.push([`latin-${latinForm}`,{family:'neon',latinForm,text:preset('mixed')},`Latin: ${latinForm}`,'Neon cascade']);
for(const ruby of OPTIONS.ruby)V.push([`ruby-${ruby}`,{family:'manuscript',ruby},`Ruby: ${ruby}`,'Manuscript grid']);
for(const face of OPTIONS.face)V.push([`face-${face}`,{family:'cascade',face,text:T},FACES[face].name.replace('Hiragino ',''),'Cascading brush']);
for(const [slug,params,lab] of [['kana-small',{kana:.5},'Kana 0.5'],['jitter',{jitter:1},'Hand jitter 1'],['step-down',{step:.82},'Size step 0.82'],['step-up',{step:1.18},'Size step 1.18'],['stagger',{stagger:3},'Stagger 3'],['rhythm',{rhythm:.8,gap:1},'Gap rhythm 0.8'],['tracking',{tracking:.8},'Tracking 0.8'],['title',{title:2.4},'Title × 2.4']])
 V.push([slug,{family:'noh',text:T,params},lab,'Noh colour columns']);
for(const [slug,state,lab,sub] of V)examples.push({name:`variations/${slug}`,state,label:lab,sub});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.name.includes('/')?1500:3000));}
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,presets:PRESETS,stages:STAGES,
 characterSet:{kanji:KANJI_COUNT,kana:[...CHARS.kana].length,punctuation:[...CHARS.punct].length,latin:[...CHARS.latin].length,chars:CHARS},
 faces:Object.fromEntries(Object.entries(FACES).map(([k,f])=>[k,{...f,verticalForms:verticalForms(k).join('')}])),mirroredInRows:MIRROR,
 variations:V.map(([slug,state,label,sub])=>({file:`variations/${slug}.png`,label,style:sub,state})),
 palettes:FAMILIES.map(f=>({family:f.id,roles:ROLES,colors:f.colors,oklch:f.colors.map(c=>oklch(c)),inkOnGround:+wcagContrast(f.colors[1],f.colors[0]).toFixed(2)}))},null,2));
// The editor embeds the engine and the prepared outlines as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'TategakiEngine',minify:true,write:false,platform:'browser',target:'es2020'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),withPrintPanel(workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),E,references,kanji:KANJI_COUNT})));
// Print outputs from the shared print kit: spot separations and a riso preview for every style.
const print=printOutputs({out,styles:E.FAMILIES.map(f=>({id:f.id,svg:E.render({family:f.id}).svg}))});
console.log(`Print kit: ${print.styles} riso previews and ${print.sheets} separation sheets in print/`);
console.log(`Built ${examples.length} SVG/PNG/rule examples (${V.length} variations), ${Object.keys(FACES).length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
