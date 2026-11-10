import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {chromium} from 'playwright-core';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,LABELS,GATES,OUTPUTS,OUTPUT_KEYS,FONT_LIST,FORMATS,render,separations,seeds} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/shock-burst-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','variations','formats','stages','texts','seeds','phone','outputs/plotter','outputs/separations','outputs/pdf','outputs/riso','outputs/realistic'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References are the library surfaces; credits and links follow the archived captions (census v3 manifest).
const manifest=JSON.parse(fs.readFileSync(path.join(root,'output/archive-census-v3/manifest.json')));
const references=SOURCES.map(s=>{const m=manifest[s.index],dir=path.join(root,'library/posters',s.id);if(m.id!==s.id)throw new Error(`census ${s.index} is ${m.id}, not ${s.id}`);
 const record=JSON.parse(fs.readFileSync(path.join(dir,'record.json'))),name=['poster.jpg','poster.png'].find(n=>fs.existsSync(path.join(dir,n))),file=`references/${String(s.index).padStart(4,'0')}-${s.family}${path.extname(name)}`;
 fs.copyFileSync(path.join(dir,name),path.join(out,file));return {...s,file,postURL:record.source?.postURL??m.post,caption:m.caption,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),recordSHA256:hash(fs.readFileSync(path.join(dir,'record.json')))};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({references,fonts:FONT_LIST,basis:'Shape system study: irregular spike bursts with seeded length, width, lean, valley and curvature, nested, layered or split into mirrored or free parts, holding or covering copy. One style stays close to its source poster; the rest are new, five on a construction taken from one of the other sources. Nothing is traced from the posters.'},null,2));
// The posters carry no live text, so resvg skips loading system fonts (a few hundred milliseconds per call).
const png=(svg,o)=>new Resvg(svg,{fitTo:o,font:{loadSystemFonts:false}}).render().asPng(),H=v=>({mode:'height',value:v});
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},fit:H(3000)});
 for(const [slug,text,sheetText] of [['boom','BOOM/BOX','BOOM/BOX'],['2026','2026','20/26']])examples.push({name:`texts/${f.id}-${slug}`,state:{family:f.id,text,sheetText}});
 const s=seeds({family:f.id});fs.writeFileSync(path.join(out,`seeds/${f.id}.svg`),s);fs.writeFileSync(path.join(out,`seeds/${f.id}.png`),png(s,{mode:'width',value:1600}));}
for(const id of ['twin','quadrant','shard','bubble','splash','scrawl','sun','vortex','kaleido','needle'])for(const stage of [1,2,3,4])examples.push({name:`stages/${id}-${stage}`,state:{family:id,stage}});
for(const [fmt,family,state] of [['a','comic',{}],['poster','shard',{}],['story','neon',{}],['square','quadrant',{}],['wide','twin',{sheetText:'SOLOTHURNER/FILMTAGE/JOURNÉES/DE SOLEURE'}]])examples.push({name:`formats/${fmt}-${family}`,state:{family,format:fmt,...state}});
// Variations: modules swapped between styles, to show they combine. regular-star sets every jitter to zero: what a regular star frame does.
for(const [slug,state] of [
 ['regular-star',{family:'twin',params:{length:0,width:0,lean:0,valley:0}}],['twin-quadrants',{family:'twin',split:'quadrants'}],['twin-spread-type',{family:'twin',sheet:'spread',sheetFit:'rows',sheetText:'SOLO/THURNER/FILM/TAGE'}],
 ['quadrant-pinwheel',{family:'quadrant',split:'pinwheel'}],['quadrant-combs',{family:'quadrant',motif:'comb'}],['shard-mirrored',{family:'shard',split:'quadrants'}],['shard-gap',{family:'shard',params:{gap:30}}],
 ['bubble-stretch',{family:'bubble',fit:'stretch'}],['bubble-swirl',{family:'bubble',params:{swirl:.5}}],['splash-neon',{family:'splash',fill:'none',params:{outline:2.5,glow:2}}],['scrawl-radial',{family:'scrawl',fill:'radial',colors:['#ff4a12','#ffe600','#0b0b0b','#0b0b0b']}],
 ['neon-orbit',{family:'neon',layout:'orbit',copy:'none',sheet:'split',sheetText:'AFTER/DARK',params:{count:5,size:.5,nest:3,spread:.75}}],['rave-row',{family:'rave',layout:'row'}],['sun-halves',{family:'sun',split:'halves',parts:'invert'}],['pinwheel-mixed',{family:'pinwheel',motif:'mixed'}],
 ['ice-glow',{family:'ice',params:{glow:2}}],['halo-inward',{family:'halo',params:{nestStep:.78,size:1.05}}],['comic-stack',{family:'comic',layout:'stack',params:{count:3,spread:.6}}],['flare-linear',{family:'flare',fill:'linear',params:{gradAngle:270}}],
 ['glitch-shards',{family:'glitch',split:'shards'}],['comic-outliers',{family:'comic',params:{outlier:1}}],['comic-bend',{family:'comic',params:{bend:.8}}],['comic-forks',{family:'comic',params:{fork:.9}}],['comic-teeth',{family:'comic',params:{teeth:.8}}],
 ['rave-union',{family:'rave',merge:'union'}],['cluster-interference',{family:'cluster',merge:'interference',params:{spread:.6}}],['neon-six-way',{family:'neon',symmetry:'m6',params:{teeth:.4}}],['stamp-ring',{family:'stamp',copy:'ring',text:'LAST/CALL'}],
 ['quadrant-across',{family:'quadrant',copy:'across',text:'GUIDE',crossing:'paper'}],['twin-crossing',{family:'twin',sheetLayer:'over',crossing:'paper'}],['pow-corner',{family:'comic',copy:'none',sheet:'bottom',sheetText:'POW/WOW',params:{cx:-.05,cy:-.05,size:2.2,margin:30}}],['chrome-swirl',{family:'chrome',params:{swirl:.5,nestTwist:8}}],['vortex-outline',{family:'vortex',echo:'outline'}],['stamp-tips',{family:'stamp',params:{tip:.6,jag:0}}],['cluster-column',{family:'cluster',layout:'column',params:{count:3,size:.42,spread:.62}}]])
 examples.push({name:`variations/${slug}`,state});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.fit??H(1500)));}
// Phone proofs: every style at 390 px wide, the width the posters must read at.
for(const f of FAMILIES)fs.writeFileSync(path.join(out,`phone/${f.id}.png`),png(render({family:f.id}).svg,{mode:'width',value:390}));
// Output types for every style: plotter lines, ink separations, a riso preview and a vector PDF printed by Chrome.
const outputs=[];for(const f of FAMILIES){const p=render({family:f.id},{output:'plotter'});fs.writeFileSync(path.join(out,`outputs/plotter/${f.id}.svg`),p.svg);fs.writeFileSync(path.join(out,`outputs/plotter/${f.id}.png`),png(p.svg,H(1500)));
 const seps=separations({family:f.id});seps.forEach((s,i)=>{const name=`outputs/separations/${f.id}-${String(i+1).padStart(2,'0')}-${s.ink}`;fs.writeFileSync(path.join(out,name+'.svg'),s.svg);if(seps.length<=4)fs.writeFileSync(path.join(out,name+'.png'),png(s.svg,H(1000)));});
 const riso=render({family:f.id},{output:'riso'});fs.writeFileSync(path.join(out,`outputs/riso/${f.id}.svg`),riso.svg);fs.writeFileSync(path.join(out,`outputs/riso/${f.id}.png`),png(riso.svg,H(1500)));
 outputs.push({family:f.id,plotter:`outputs/plotter/${f.id}.svg`,separations:seps.map((s,i)=>({ink:s.ink,colour:s.colour,file:`outputs/separations/${f.id}-${String(i+1).padStart(2,'0')}-${s.ink}.svg`})),riso:`outputs/riso/${f.id}.svg`,pdf:`outputs/pdf/${f.id}.pdf`});}
// The realistic output options side by side: outline width in pen passes and crosshatching for the plotter; two-ink tints and
// halftone dots for separations; misregistration and grain for the riso preview.
const realistic=[['comic-plotter-centrelines',{family:'comic'},'plotter'],['comic-plotter-passes',{family:'comic',plotEdges:'passes'},'plotter'],['twin-plotter-crosshatch',{family:'twin',plotEdges:'passes',hatchStyle:'cross',params:{hatch:6}},'plotter'],
 ['vortex-riso-spot',{family:'vortex'},'riso'],['vortex-riso-tints',{family:'vortex',sepMode:'tints'},'riso'],['twin-riso-dots',{family:'twin',screenShape:'dots',params:{screen:4}},'riso'],['rave-riso-rough',{family:'rave',params:{misregister:4,grain:.8}},'riso']];
for(const [name,state,output] of realistic){const r=render(state,{output});fs.writeFileSync(path.join(out,`outputs/realistic/${name}.svg`),r.svg);fs.writeFileSync(path.join(out,`outputs/realistic/${name}.png`),png(r.svg,H(1500)));}
for(const [name,state] of [['vortex-tints',{family:'vortex',sepMode:'tints'}],['twin-dots',{family:'twin',screenShape:'dots',params:{screen:4}}]])separations(state).forEach((s,i)=>{const f=`outputs/realistic/${name}-sep-${i+1}-${s.ink}`;fs.writeFileSync(path.join(out,f+'.svg'),s.svg);fs.writeFileSync(path.join(out,f+'.png'),png(s.svg,H(1000)));});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--force-color-profile=srgb']});
try{const page=await browser.newPage();for(const f of FAMILIES){const r=render({family:f.id});await page.setContent(`<!doctype html><style>@page{size:${r.width}px ${r.height}px;margin:0}html,body{margin:0}svg{display:block}</style>${r.svg}`);
 await page.pdf({path:path.join(out,`outputs/pdf/${f.id}.pdf`),width:`${r.width}px`,height:`${r.height}px`,printBackground:true,pageRanges:'1'});}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'outputs/index.json'),JSON.stringify(outputs,null,2));
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,gates:GATES,labels:LABELS,outputs:OUTPUTS,outputSettings:OUTPUT_KEYS,formats:FORMATS,fonts:FONT_LIST},null,2));
// The editor embeds the engine and its outlines as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'ShockBurst',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LABELS,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} seed sheets, ${FAMILIES.length} phone proofs, ${FAMILIES.length} plotter files, separations, riso previews and PDFs, ${realistic.length} realistic-output examples, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
