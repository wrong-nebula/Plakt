import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,ENVELOPES,LAYOUTS,FONT_LIST,ROLES,CHARACTERS,render,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/arch-envelope-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','stages','envelopes','fonts','layouts','variations','extremes','texts'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive; they stay local, with provenance.
const archive=path.join(root,'output/japanese-posters'),catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(archive,'catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(archive,'images',s.source),name=fs.readdirSync(dir).find(f=>f.replace(/\.[^.]+$/,'')===s.id),ext=path.extname(name),file='references/'+s.id+ext;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title,date:w.date,designer:w.designer,medium:w.medium??null,dimensions:w.dimensions??null,recordURL:w.recordURL,institution:w.institution,imageURL:w.imageURL,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designer:'Tadanori Yokoo',references,basis:'Type system study: a headline set from open-licence outlines, flattened and warped to fill an envelope between two curves (arch, inverted arch, bridge, gable, valley, bulge, pinch, wave, flag, keystone, rising ribbon), with stems held vertical or turned radially, a banner with folded ends, extrusions, strokes and Yokoo grounds. Six styles follow the referenced posters (1965–1997); four are new. Letterforms come from OFL fonts (font-provenance.json); palettes and layouts are new interpretations; nothing is traced from the posters. Reference images are copyrighted and kept locally for study only.'},null,2));
fs.copyFileSync(path.join(here,'font-provenance.json'),path.join(out,'font-provenance.json'));
// resvg's native buffers are only released by GC: collect every 20 rasters (run with node --expose-gc).
let rasters=0;const png=(svg,height)=>{if(++rasters%20===0)globalThis.gc?.();return new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();};
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},size:3000});
 for(const [slug,text] of [['type-system','TYPE/SYSTEM'],['arch-envelope','ARCH ENVELOPE'],['tokyo','Tokyo 1966'],['hello','Hello, World!']])examples.push({name:`texts/${f.id}-${slug}`,state:{family:f.id,text}});
 for(const stage of [1,2,3,4])examples.push({name:`stages/${f.id}-${stage}`,state:{family:f.id,stage}});}
// Every envelope with vertical and radial stems, on one neutral style.
for(const e of ENVELOPES)for(const [slug,tilt] of [['vertical',0],['radial',1]])examples.push({name:`envelopes/${e.id}-${slug}`,state:{family:'silver-arch',layout:'center',ground:'plain',frame:'none',banner:'ruled',text:'ARCH/ENVELOPE',rowmode:'block',envelope:e.id,params:{tilt,amount:e.id==='arch'||e.id==='smile'?.5:.7,pad:.1}}});
for(const f of FONT_LIST)examples.push({name:`fonts/${f.id}`,state:{family:'vanishing',layout:'center',font:f.id,text:'Headline/Type 1966',case:'mixed',rowmode:'block',envelope:'bulge',params:{amount:.4,depth:.3,size:1}}});
for(const l of LAYOUTS)examples.push({name:`layouts/${l.id}`,state:{family:'gable',layout:l.id,text:'Envelope/Type',params:{size:1}}});
const variations=[
 ['stems-vertical','Arch, vertical stems',{family:'silver-arch',params:{tilt:0}}],
 ['stems-radial','Arch, radial stems',{family:'silver-arch',params:{tilt:1}}],
 ['fit-stepped','Stepped letter fit',{family:'silver-arch',params:{tilt:0,fit:0}}],
 ['fit-path','Fit 0 + radial = text on a path',{family:'silver-arch',params:{tilt:1,fit:0}}],
 ['taper','Height taper .4',{family:'valley',layout:'center',params:{taper:.4,amount:.5}}],
 ['keystone','Keystone perspective',{family:'rising',envelope:'keystone',params:{amount:.85,tilt:0,slant:0}}],
 ['flag','Flag, two waves',{family:'night-drive',envelope:'flag',params:{waves:2,amount:.7}}],
 ['ends-fold','Banner with folded ends',{family:'gable',banner:'solid',ends:'fold',params:{tail:.9}}],
 ['ends-notch','Swallowtail ends',{family:'silver-arch',ends:'notch',params:{tail:.9}}],
 ['ends-point','Pointed ends',{family:'revue',banner:'ruled',ends:'point',params:{pad:.14}}],
 ['face-inline','Inline face',{family:'gable',face:'inline',params:{stroke:.02}}],
 ['face-outline','Outline face',{family:'vanishing',face:'outline',extrude:'none',params:{stroke:.03}}],
 ['extrude-drop','Drop shadow',{family:'valley',layout:'center',extrude:'drop',params:{depth:.12,angle:30}}],
 ['extrude-block','Block extrusion',{family:'silver-arch',extrude:'block',params:{depth:.18,angle:70}}],
 ['extrude-stepped','Stepped extrusion',{family:'gable',extrude:'stepped',params:{depth:.3,steps:5,angle:110}}],
 ['extrude-vanish','Vanishing extrusion',{family:'riso-bulge',extrude:'vanish',params:{depth:.35}}],
 ['rows-block','Three rows in one block',{family:'acid',rowmode:'block',envelope:'bulge',text:'ONE/TWO/THREE'}],
 ['rows-shared','Rows at shared scale',{family:'groovy',rowfit:'shared',text:'Groovy/Sunday/Roller Disco'}],
 ['ground-horizon','Horizon ground',{family:'groovy',ground:'horizon',params:{sun:.3}}],
 ['ground-grid','Grid ground',{family:'acid',ground:'grid',layout:'center',params:{sun:.18}}],
 ['ground-rings','Rings ground',{family:'revue',ground:'rings',params:{rays:30}}],
 ['frame-stripes','Stripe frame',{family:'silver-arch',frame:'stripes'}],
 ['neon-arch','Neon face in an arch',{family:'silver-arch',face:'neon',colors:FAMILIES.find(f=>f.id==='night-drive').colors,ground:'rays',banner:'outline'}],
 ['mixed-case','Mixed case in a wave',{family:'groovy',envelope:'wave',text:'Wavelength',params:{amount:.6,waves:1}}]
];
for(const [slug,,state] of variations)examples.push({name:`variations/${slug}`,state:{text:'TYPE/SYSTEM',...state}});
// Extremes: every envelope at full depth, vertical and radial, plus a coarse flattening.
for(const e of ENVELOPES)for(const tilt of [0,1])examples.push({name:`extremes/${e.id}-${tilt?'radial':'vertical'}`,state:{family:'silver-arch',layout:'center',ground:'plain',frame:'none',banner:'none',text:'MOVE/ENVELOPE',rowmode:'block',envelope:e.id,params:{amount:1,tilt,taper:e.id==='straight'?.8:0,waves:e.id==='rising'?1:1.5}}});
examples.push({name:'extremes/coarse-flattening',state:{family:'silver-arch',layout:'center',ground:'plain',frame:'none',text:'MOVE/ENVELOPE',rowmode:'block',envelope:'arch',params:{amount:.6,tilt:1,detail:6}}});
const stats=[];
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.size??1500));stats.push({name:e.name,...r.features});}
for(const f of FAMILIES){const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:2000}}).render().asPng());}
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,envelopes:ENVELOPES,layouts:LAYOUTS,fonts:FONT_LIST,characters:CHARACTERS,variations:variations.map(([slug,label])=>({slug,label})),examples:stats,
 palettes:FAMILIES.map(f=>({family:f.id,roles:ROLES,colors:f.colors,oklch:f.colors.map(c=>oklch(c)),letterOnGround:+wcagContrast(f.colors[3],f.colors[1]).toFixed(2)}))},null,2));
// The editor embeds the engine and the prepared outlines as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'ArchEnvelopeEngine',minify:true,write:false,platform:'browser',target:'es2020'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,ENVELOPES,LAYOUTS,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
