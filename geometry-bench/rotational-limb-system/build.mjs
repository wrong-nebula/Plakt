import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,LIMBS,KNOTS,FORMATS,ROLES,render,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/rotational-limb-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','stages','layouts','formats','knots','limbs','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (PGDA and MoMA records).
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,archiveTitle:w.title,designer:'Shigeo Fukuda',recordURL:w.recordURL,institution:w.institution,medium:w.medium??null,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designer:'Shigeo Fukuda',references,basis:'Shape system study: an editable limb (tapered stroke through control points, bent by curl, ending in a primitive-built hand, foot, heel, cup, beak, disc or arrow) repeated N-fold around a hub, and tubes tied into knots whose computed self-crossings alternate over and under. Five presets follow Fukuda posters in spirit (Images of Illusion, UCC Coffee Pavilion, Kyogen, Inter Design ’81 twice); seven are new. Look 1 is kept as a reference for the figure-and-ground illusions; its impossible stairs are not modelled. Nothing is traced from the posters.'},null,2));
// resvg's native buffers are only released by garbage collection (run with --expose-gc).
let rasters=0;const png=(svg,height=3000)=>{if(++rasters%25===0)globalThis.gc?.();return new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();};
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});for(const stage of [1,2,3,4])examples.push({name:`stages/${f.id}-${stage}`,state:{family:f.id,stage}});}
for(const family of ['legs','flower','trefoil','tangle','coffee','neon'])for(const layout of OPTIONS.layout)examples.push({name:`layouts/${family}-${layout}`,state:{family,layout,params:layout==='field'?{density:family==='tangle'||family==='trefoil'?2:3}:{}}});
for(const family of ['kick','weave','handshake'])for(const format of OPTIONS.format)examples.push({name:`formats/${family}-${format}`,state:{family,format}});
// Knot atlas: every curve type, torus and Lissajous counts, seeds and crossing patterns.
for(const [slug,state] of [['trefoil',{knot:'trefoil'}],['figure8',{knot:'figure8'}],['torus-2-5',{knot:'torus',params:{p:2,q:5}}],['torus-3-4',{knot:'torus',params:{p:3,q:4}}],['torus-3-5',{knot:'torus',params:{p:3,q:5}}],['torus-5-3',{knot:'torus',params:{p:5,q:3,depth:.4}}],['torus-link-2-4',{knot:'torus',params:{p:2,q:4}}],
 ['lissajous-3-2',{knot:'lissajous',params:{p:3,q:2}}],['lissajous-3-4',{knot:'lissajous',params:{p:3,q:4}}],['lissajous-5-4',{knot:'lissajous',params:{p:5,q:4,weight:.05}}],['random-1',{knot:'random',params:{seed:1}}],['random-2',{knot:'random',params:{seed:2,complexity:5}}],['random-3',{knot:'random',params:{seed:3,complexity:7,smooth:1.1}}],
 ['hands-35',{knot:'hands',end:'hand',params:{seed:35}}],['laid',{knot:'random',crossing:'laid',params:{seed:2,complexity:5}}],['depth',{knot:'torus',crossing:'depth',params:{p:2,q:5}}],['seeded',{knot:'random',crossing:'seeded',params:{seed:2,complexity:5}}],['no-gap',{knot:'trefoil',params:{gap:0,outline:.02}}]])
 examples.push({name:`knots/${slug}`,state:{family:'trefoil',generator:'knot',title:slug.replace(/-/g,' ').toUpperCase(),colors:['#efe9dc','#1d1b19','#efe9dc','#e2512b','#e2512b','#2d4fa3'],colour:'alternate',...state,params:{weight:.09,outline:.008,gap:.014,relax:40,complexity:6,smooth:1.3,...state.params}}});
// Limb atlas: end shapes on one pinwheel, limb shapes, orders, mirror, curl and hubs.
for(const end of OPTIONS.end)examples.push({name:`limbs/end-${end}`,state:{family:'flower',title:'END: '+end.toUpperCase(),end,mirror:'off',colour:'single',hub:'disc',params:{arms:6,twist:20,sleeve:.7}}});
for(const l of LIMBS)examples.push({name:`limbs/shape-${l.id}`,state:{family:'legs',title:'LIMB: '+l.name.toUpperCase(),limb:l.id,params:{arms:6}}});
for(const [slug,state] of [['order-stack',{family:'legs',order:'stack'}],['order-cyclic',{family:'legs',order:'cyclic'}],['order-counter',{family:'legs',order:'counter'}],['mirror',{family:'kick',mirror:'alternate',params:{arms:8}}],['curl-spiral',{family:'riso',params:{curl:300,focus:1,arms:5}}],['both-ends',{family:'legs',ends:'both',endAlt:'same'}]])
 examples.push({name:`limbs/${slug}`,state:{title:slug.replace(/-/g,' ').toUpperCase(),...state}});
// Variations: the shared construction pushed in other directions.
for(const [slug,state] of [['gear-field',{family:'kick',layout:'field',finish:'flat',ground:'plain',colors:['#f1ece2','#1d1d1f','#f1ece2','#e3402f','#e3402f','#2b59c3'],colour:'alternate',params:{density:3,arms:6}}],['hand-sun',{family:'flower',arms:16,hub:'star',params:{arms:16,length:.8,twist:0,hub:.3}}],
 ['octopus',{family:'neon',generator:'limbs',limb:'wave',end:'none',colour:'spectrum',params:{arms:8,curl:260,focus:1,taper:.85,weight:.22,length:1.4}}],['beak-ring',{family:'riso',params:{arms:12,twist:80,radial:.35,curl:40}}],['coffee-four',{family:'coffee',params:{arms:4,radial:.35,curl:110,length:.8}}],
 ['spiral-pair',{family:'spiral',layout:'pair'}],['torus-shadow',{family:'trefoil',knot:'torus',finish:'shadow',params:{p:3,q:7,weight:.07,depth:.7}}],['lissajous-glow',{family:'neon',knot:'lissajous',colour:'spectrum',params:{p:5,q:4,weight:.05}}],
 ['tangle-riso',{family:'tangle',finish:'riso',colors:['#f4efe4','#ff48b0','#f4efe4','#0078bf','#0078bf','#0078bf']}],['hands-crop',{family:'handshake',layout:'crop',params:{scale:1}}],['legs-rings',{family:'legs',ground:'rings',colour:'ramp',colors:['#f2ead8','#363b8e','#f2ead8','#363b8e','#e8452c','#e8452c']}],['heel-wheel',{family:'kick',end:'heel',endAlt:'foot',params:{arms:12,length:.7,radial:.2}}]])
 examples.push({name:`variations/${slug}`,state:{title:slug.replace(/-/g,' ').toUpperCase(),...state}});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.name.includes('/')?1500:3000));}
for(const f of ['legs','flower','trefoil','neon']){const s=specimen({family:f});fs.writeFileSync(path.join(out,`specimen-${f}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f}.png`),new Resvg(s,{fitTo:{mode:'width',value:2400}}).render().asPng());}
const oklch=converter('oklch'),strip=o=>JSON.parse(JSON.stringify(o));
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:strip(FAMILIES),controls:CONTROLS.map(({when,...c})=>c),options:OPTIONS,limbs:LIMBS,knots:KNOTS,formats:FORMATS,roles:ROLES,
 palettes:FAMILIES.map(f=>({family:f.id,roles:ROLES,colors:f.colors,oklch:f.colors.map(c=>oklch(c)),figureOnGround:+wcagContrast(f.colors[1],f.colors[0]).toFixed(2)})),examples:examples.map(e=>e.name)},null,2));
// The editor embeds the engine (and clipper-lib) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'RotLimbEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LIMBS,KNOTS,FORMATS,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, 4 kit sheets, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
