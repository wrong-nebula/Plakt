import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {ENGINE,RECIPES,LAYERS,EFFECTORS,MODIFIERS,MODIFIER_KINDS,COLOURS,RAMPS,FIELD,FORMATS,PALETTES,FONT_LIST,render,labelPolys,polysToD} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
import {EVIDENCE} from './evidence.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/effector-study-v1');
// Only regenerated folders are cleared, so validation.json and combinations.json survive a rebuild.
for(const d of ['recipes','atlas']){fs.rmSync(path.join(out,d),{recursive:true,force:true});fs.mkdirSync(path.join(out,d),{recursive:true});}
const png=(svg,width)=>new Resvg(svg,{fitTo:{mode:'width',value:width},font:{loadSystemFonts:false}}).render().asPng();
// Recipes are proofed a quarter of the way into their loop, with no pointer.
const PROOF_T=s=>s.loop*.25;
const recipeMeta={};
for(const [id,r] of Object.entries(RECIPES)){const res=render({recipe:id},{t:PROOF_T({loop:6})});
 fs.writeFileSync(path.join(out,'recipes',id+'.svg'),res.svg);fs.writeFileSync(path.join(out,'recipes',id+'.json'),JSON.stringify(res.state,null,2));fs.writeFileSync(path.join(out,'recipes',id+'.png'),png(res.svg,1000));
 recipeMeta[id]={name:r.name,about:r.about,modifiers:!!(r.modifiers&&r.modifiers.length),colours:!!(r.colours&&r.colours.length),list:[...(r.effectors||[]).map(e=>EFFECTORS[e.type].name),...(r.modifiers||[]).map(m=>m.type==='group'?'Group':MODIFIERS[m.type].name),...(r.colours||[]).map(c=>COLOURS[c.type].name)].join(' + ')};}

// Sheets are one SVG of nested proofs, labelled with outlined type so no font is needed to rasterize them.
function sheet(cells,{cols,cell,ratio,title}){const pad=24,lab=34,head=title?80:0,rows=Math.ceil(cells.length/cols),cw=cell,ch=cell*ratio,W=cols*(cw+pad)+pad,H=head+rows*(ch+lab+pad)+pad;
 let body=`<rect width="${W}" height="${H}" fill="#ecebe6"/>`;if(title)body+=`<path d="${polysToD(labelPolys(title,{size:34,x:pad,y:56}))}" fill="#26272b"/>`;
 cells.forEach((c,i)=>{const x=pad+(i%cols)*(cw+pad),y=head+pad+Math.floor(i/cols)*(ch+lab+pad),inner=c.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/id="p(\d+)"/g,`id="c${i}p$1"`).replace(/url\(#p(\d+)\)/g,`url(#c${i}p$1)`),vb=c.svg.match(/viewBox="([^"]+)"/)[1];
  body+=`<svg x="${x}" y="${y}" width="${cw}" height="${ch}" viewBox="${vb}" preserveAspectRatio="xMidYMid slice">${inner}</svg><path d="${polysToD(labelPolys(c.label,{size:15,x,y:y+ch+22}))}" fill="#26272b"/>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;}
// Effector atlas: one grid, one effector each, field still at the centre.
const ALL=['wave','jitter','spin','snap','flow','recolour'];
const effCells=Object.entries(EFFECTORS).map(([type,e])=>{const layers=[{id:'L1',type:'grid',cols:16,gap:.22,shape:type==='watch'?'eye':type==='twist'?'pill':type==='pillars'?'circle':'square',aspect:type==='twist'?.4:1}];
 const params=type==='pillars'?{height:70}:type==='settle'?{axis:'both'}:{};
 const field=ALL.includes(type)?{shape:'all',follow:false}:{shape:'radial',radius:.38,softness:.85,follow:false,x:type==='watch'?.75:.5,y:type==='watch'?.3:.5};
 // Snap quantizes what earlier effectors did, so it gets a jittered turn to round off.
 const before=type==='snap'?[{type:'jitter',move:0,turn:40,size:0,field:{shape:'all',follow:false}}]:[];
 return {label:type==='snap'?'Snap (after Jitter)':e.name,svg:render({recipe:'custom',format:'square',palette:'paper',layers,effectors:[...before,{type,...params,field}]},{t:1}).svg};});
fs.writeFileSync(path.join(out,'atlas','effectors.svg'),sheet(effCells,{cols:8,cell:240,ratio:1,title:'Effectors on one grid'}));
fs.writeFileSync(path.join(out,'effectors.png'),png(fs.readFileSync(path.join(out,'atlas','effectors.svg'),'utf8'),2000));
// Modifier atlas: rules and a word, one modifier each.
const GLOBAL=['weight','round','outline','petal','swirl','zigzag','tiles','dial','burst','repeat','shadow','fold','screen','dither','wave','turbulence','shear','taper','bend','polar','spherize','ribbon','envelope','perspective','melt','roughen','mirror','kaleido','echo','slice','inline'];
const modCells=Object.entries(MODIFIERS).map(([type,m])=>{const layers=[{id:'L1',type:'lines',direction:'horizontal',count:22,weight:.14,opacity:.45,area:'bleed'},{id:'L2',type:'text',text:'MOD',font:'archivo'}];
 const field=GLOBAL.includes(type)?{shape:'all',follow:false,radius:.42}:{shape:'radial',radius:.36,softness:1,follow:false};
 return {label:`${m.name} — ${MODIFIER_KINDS[m.kind].toLowerCase()}`,svg:render({recipe:'custom',format:'square',palette:'acid',layers,modifiers:[{type,field}]},{t:1}).svg};});
fs.writeFileSync(path.join(out,'atlas','modifiers.svg'),sheet(modCells,{cols:6,cell:260,ratio:1,title:'Modifiers on rules and a word'}));
fs.writeFileSync(path.join(out,'modifiers.png'),png(fs.readFileSync(path.join(out,'atlas','modifiers.svg'),'utf8'),2000));
// Colour atlas: each colour modifier on paper, rules and a word, with its own default field held still.
// Ramp types paint the elements (on the whole page they would cover everything); Posterize bands a gradient first.
const colourCells=Object.entries(COLOURS).map(([type,c])=>{const layers=[{id:'L1',type:'grid',cols:12,gap:.25,shape:'circle',color:'accent',area:'bleed'},{id:'L2',type:'text',text:'HUE',font:'archivo'}];
 const before=type==='posterize'?[{type:'gradient',ramp:'holo',target:'all',field:{shape:'linear',angle:90,radius:1,softness:1,follow:false}}]:[];
 return {label:type==='posterize'?'Posterize (after Gradient)':`${c.name} — ${c.uses==='ramp'?'ramp':'mask'}`,svg:render({recipe:'custom',format:'square',palette:'neon',layers,colours:[...before,{type,target:c.uses==='ramp'||type==='posterize'?'all':'page',...(type==='palette'?{roles:'rotate'}:{}),field:{...c.field,follow:false}}]},{t:1}).svg};});
fs.writeFileSync(path.join(out,'atlas','colours.svg'),sheet(colourCells,{cols:5,cell:260,ratio:1,title:'Colour modifiers, one each'}));
fs.writeFileSync(path.join(out,'colours.png'),png(fs.readFileSync(path.join(out,'atlas','colours.svg'),'utf8'),2000));
// Recipe and motion sheets: every recipe, then six moments of each loop.
const recipeCells=Object.keys(RECIPES).map(id=>({label:RECIPES[id].name,svg:fs.readFileSync(path.join(out,'recipes',id+'.svg'),'utf8')}));
fs.writeFileSync(path.join(out,'atlas','recipes.svg'),sheet(recipeCells,{cols:7,cell:220,ratio:1.414,title:'Recipes'}));
fs.writeFileSync(path.join(out,'recipes.png'),png(fs.readFileSync(path.join(out,'atlas','recipes.svg'),'utf8'),2000));
const motionIds=['pinch','settle','sunburst','ridges','ribbon','scan','melt','kaleidoscope','flow','fold'],motion=[];
for(const id of motionIds)for(let k=0;k<6;k++)motion.push({label:`${RECIPES[id].name} ${k}/6`,svg:render({recipe:id},{t:6*k/6}).svg});
fs.writeFileSync(path.join(out,'atlas','motion.svg'),sheet(motion,{cols:6,cell:180,ratio:1.414,title:'Six moments of each loop'}));
fs.writeFileSync(path.join(out,'motion.png'),png(fs.readFileSync(path.join(out,'atlas','motion.svg'),'utf8'),1800));

// Artwork samples: small finished SVGs from other systems, if present, so the Artwork element can be tried at once.
const candidates=[['PLOT slices','output/plot-slice-study-v1'],['Isometric prism','output/isometric-prism-study-v1'],['Rule field','output/rule-field-study-v1'],['Wagara','output/wagara-study-v1'],['Tategaki','output/tategaki-study-v1'],['Spectral echo','output/spectral-echo-study-v1']];
const samples=[];
for(const [name,dir] of candidates){const d=path.join(root,dir);if(!fs.existsSync(d))continue;
 const f=fs.readdirSync(d).filter(n=>n.endsWith('.svg')).map(n=>path.join(d,n)).filter(p=>fs.statSync(p).size<160e3).sort()[0];
 if(f)samples.push({name:`${name} · ${path.basename(f,'.svg')}`,svg:fs.readFileSync(f,'utf8'),source:path.relative(root,f)});
 if(samples.length>=4)break;}

fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,layers:LAYERS,effectors:EFFECTORS,modifiers:MODIFIERS,modifierKinds:MODIFIER_KINDS,colours:COLOURS,ramps:RAMPS,field:FIELD,formats:FORMATS,palettes:PALETTES,fonts:FONT_LIST,recipes:recipeMeta,samples:samples.map(s=>({name:s.name,source:s.source}))},null,2));
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({basis:'Survey of all 1,132 PosterLab library posters and 1,399 Japanese archive posters for recurring distortions. Modifiers are new general constructions; nothing is traced.',evidence:EVIDENCE},null,2));
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'Effectors',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
const page={engine:bundle.replaceAll('</script','<\\/script'),recipes:recipeMeta,samples:samples.map(({name,svg})=>({name,svg})),evidence:EVIDENCE.map(e=>[e.modifier,e.seen])};
fs.writeFileSync(path.join(out,'index.html'),workshopHTML(page));
// PosterLab hosts the same editor in app mode: poster in, native save panels out. The main app bundles it, and so
// does the effectors copy while it still exists. An unchanged page keeps its timestamp, so SwiftPM does not rebuild.
const appPage=workshopHTML({...page,app:true});
for(const appResources of [path.join(root,'Sources/PosterCore/Resources'),path.join(root,'workspaces/effectors/Sources/PosterCore/Resources')]){
 if(!fs.existsSync(appResources))continue;
 const target=path.join(appResources,'Effectors/index.html');
 if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')===appPage){console.log(`App page unchanged: ${path.relative(root,target)}`);continue;}
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,appPage);console.log(`App page: ${path.relative(root,target)}`);}
// The same engine without a page, for PosterLab's headless modifier pass (ModifierPass.swift runs it in JavaScriptCore).
// Not minified, so an engine error in a study names a readable function.
const headless=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'Effectors',write:false,platform:'browser'}).outputFiles[0].text;
const headlessTarget=path.join(root,'Sources/PosterCore/Resources/Effectors/effectors-engine.js');
if(fs.existsSync(headlessTarget)&&fs.readFileSync(headlessTarget,'utf8')===headless)console.log(`Headless engine unchanged: ${path.relative(root,headlessTarget)}`);
else{fs.mkdirSync(path.dirname(headlessTarget),{recursive:true});fs.writeFileSync(headlessTarget,headless);console.log(`Headless engine: ${path.relative(root,headlessTarget)}`);}
console.log(`Built${Object.keys(RECIPES).length} recipes, ${effCells.length} effector, ${modCells.length} modifier and ${colourCells.length} colour proofs, ${samples.length} artwork samples and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
