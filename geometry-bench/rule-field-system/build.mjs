import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {chromium} from 'playwright-core';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,LABELS,OUTPUTS,FONT_LIST,FORMATS,render,separations,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
import {withPrintPanel,printOutputs} from '../print-kit-node.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/rule-field-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','variations','formats','stages','texts','outputs/plotter','outputs/separations','outputs/pdf'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References are the rectified library surfaces; credits and links follow the archived captions.
const references=SOURCES.map(s=>{const dir=path.join(root,'library/posters',s.id),record=JSON.parse(fs.readFileSync(path.join(dir,'record.json'))),name=['poster.jpg','poster.png'].find(n=>fs.existsSync(path.join(dir,n))),file=`references/${s.family}${path.extname(name)}`;
 fs.copyFileSync(path.join(dir,name),path.join(out,file));return {...s,file,postURL:record.source.postURL,caption:record.source.caption,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),recordSHA256:hash(fs.readFileSync(path.join(dir,'record.json')))};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({references,fonts:FONT_LIST,basis:'Type system study: letters made only by breaks, shifts, waves, swelling, dashes, dots and crossing in one field of rules, from a glyph mask of any face. Four styles follow the source posters; the rest are new. Nothing is traced from the posters.'},null,2));
const png=(svg,height)=>new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},height:3000});
 for(const [slug,text] of [['latin','TYPE/SYSTEM'],['2026','2026']])examples.push({name:`texts/${f.id}-${slug}`,state:{family:f.id,text}});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:2000}}).render().asPng());}
for(const id of [...SOURCES.map(s=>s.family),'moire','contour','halftone','groove'])for(const stage of [1,2,3,4])examples.push({name:`stages/${id}-${stage}`,state:{family:id,stage}});
for(const [fmt,family,text] of [['a','gap','FU/BU'],['poster','relief','SOUND OF/ARCHI/TEC/TURE/S AM'],['story','moire','AFTER/HOURS'],['square','groove','SPIN'],['wide','prism','SPECTRUM']])examples.push({name:`formats/${fmt}-${family}`,state:{family,format:fmt,text}});
// Variations: modules swapped between styles, to show they combine.
for(const [slug,state] of [
 ['gap-rings',{family:'gap',geometry:'rings'}],['gap-rays',{family:'gap',geometry:'rays',params:{pitch:9}}],['gap-spiral',{family:'gap',geometry:'spiral',params:{arms:3,pitch:11}}],['gap-contour',{family:'gap',geometry:'contour'}],
 ['relief-dome',{family:'relief',profile:'dome',params:{feather:30}}],['relief-slid-ramp',{family:'relief',text:'SOUND/ARCHI/TECT/SLAM',fill:'stretch',band:'bottom',under:'none',profile:'ramp',params:{pitch:5.6,weight:.52,shift:2.4,insideWeight:1,feather:16,pinch:0,frame:0,margin:6,leading:.95}}],
 ['relief-pinch-neon',{family:'relief',colors:['#07060b','#3df5ff','#ff3df2','#3df5ff'],ink:'two-tone',params:{glow:1.5}}],['wobble-neon',{family:'wobble',colors:['#07060b','#3df5ff','#3df5ff','#3df5ff'],params:{glow:2}}],
 ['wobble-barlow',{family:'wobble',font:'barlow',text:'LOUD/ER'}],['trace-connect',{family:'trace',inside:'rules',jogs:'connect',params:{shift:.5}}],['inside-only',{family:'swell',outside:'gap',params:{insideWeight:1.2}}],
 ['moire-contour',{family:'moire',secondField:'contour',params:{cross:0}}],['rings-two-tone',{family:'rings',ink:'two-tone',colors:['#0b0b0b','#3a3a3a','#d7ff3a','#d7ff3a']}],['rings-boxes',{family:'rings',params:{squareness:.6,aspect:.8}}],
 ['dome-rings',{family:'dome',geometry:'rings'}],['hatch-bodoni',{family:'hatch',font:'bodoni',text:'Gra/vure'}],['groove-arms',{family:'groove',params:{arms:4,pitch:9}}],['groove-dots',{family:'groove',pen:'dots',params:{dash:1,insideWeight:1.8}}],
 ['boxes-terrace',{family:'boxes',inside:'rules',under:'none',profile:'terrace',params:{shift:-2,feather:40}}],['contour-dash',{family:'contour',pen:'dash',params:{dash:1.6,duty:.6}}],['drift-dots',{family:'drift',pen:'dots',ink:'solid',params:{dash:1,insideWeight:2.2,feather:14,warp:2.4}}],
 ['halftone-rings',{family:'halftone',geometry:'rings',params:{cy:.45}}],['morse-spiral',{family:'morse',geometry:'spiral',params:{pitch:10}}],['zigzag-saw',{family:'zigzag',wave:'saw'}],['pulse-warp',{family:'pulse',params:{warp:1.6,warpScale:300}}],
 ['prism-rings',{family:'prism',geometry:'rings',params:{cy:.42}}],['lattice-rays',{family:'lattice',geometry:'rays',secondField:'rings',params:{pitch:12}}],['terrace-alternate',{family:'terrace',ink:'alternate',colors:['#f0ebe0','#3b2a1a','#3b2a1a','#d2552c']}]])
 examples.push({name:`variations/${slug}`,state});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.height??1500));}
// Output types for every style: plotter centrelines, ink separations and a vector PDF printed by Chrome.
const outputs=[];for(const f of FAMILIES){const p=render({family:f.id},{output:'plotter'});fs.writeFileSync(path.join(out,`outputs/plotter/${f.id}.svg`),p.svg);fs.writeFileSync(path.join(out,`outputs/plotter/${f.id}.png`),png(p.svg,1500));
 const seps=separations({family:f.id});seps.forEach((s,i)=>{const name=`outputs/separations/${f.id}-${String(i+1).padStart(2,'0')}-${s.ink}`;fs.writeFileSync(path.join(out,name+'.svg'),s.svg);if(seps.length<=4)fs.writeFileSync(path.join(out,name+'.png'),png(s.svg,1000));});
 outputs.push({family:f.id,plotter:`outputs/plotter/${f.id}.svg`,separations:seps.map(s=>({ink:s.ink,colour:s.colour})),pdf:`outputs/pdf/${f.id}.pdf`});}
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
try{const page=await browser.newPage();for(const f of FAMILIES){const r=render({family:f.id});await page.setContent(`<!doctype html><style>@page{size:${r.width}px ${r.height}px;margin:0}html,body{margin:0}svg{display:block}</style>${r.svg}`);
 await page.pdf({path:path.join(out,`outputs/pdf/${f.id}.pdf`),width:`${r.width}px`,height:`${r.height}px`,printBackground:true,pageRanges:'1'});}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'outputs/index.json'),JSON.stringify(outputs,null,2));
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,labels:LABELS,outputs:OUTPUTS,formats:FORMATS,fonts:FONT_LIST},null,2));
// The editor embeds the engine and its outlines as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'RuleField',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),withPrintPanel(workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LABELS,references}),{separations:'()=>RuleField.separations(RuleFieldEditor.getState())'}));
// Print outputs from the shared print kit: spot separations and a riso preview for every style.
const print=printOutputs({out,styles:FAMILIES.map(f=>({id:f.id,svg:render({family:f.id}).svg,separations:separations({family:f.id})}))});
console.log(`Print kit: ${print.styles} riso previews and ${print.sheets} separation sheets in print/`);
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} specimens, ${FAMILIES.length} plotter files, separations and PDFs, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
