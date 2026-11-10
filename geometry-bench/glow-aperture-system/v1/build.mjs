import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,OPTION_MODES,RAMPS,SHAPES,SHAPE_NAMES,render,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),out=path.join(root,'output/glow-aperture-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','stages','layouts','modes','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive (MoMA and PGDA records).
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title.replace(/&nbsp;|"|“|”/g,'').trim(),designer:(w.designers||[])[0]||w.designer,date:/\d{4}/.test(w.date||'')?w.date:'',medium:w.medium||'',recordURL:w.recordURL,institution:w.institution,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense||'',imageRights:w.imageRights??w.license};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Koichi Sato','Susumu Endo'],references,basis:'Shape system study: aperture mask → two-scale blurred distance falloff → gradient-map ramp, in halo, soft-shadow, spectral-field and light-beam modes. Seven styles follow the reference posters; six are new. Shapes, silhouettes, ramps and layouts are new drawings; nothing is traced from the posters. References are kept locally for study and are not for publication.'},null,2));
// resvg's native buffers are only released by garbage collection (run with --expose-gc).
let rasters=0;const png=(svg,height)=>{if(++rasters%20===0)globalThis.gc?.();return new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();};
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},h:3000});for(const stage of [1,2,3,4])examples.push({name:`stages/${f.id}-${stage}`,state:{family:f.id,stage},h:1200});}
// Layouts on three styles.
for(const family of ['club','smoke','frontier'])for(const layout of OPTIONS.layout)examples.push({name:`layouts/${family}-${layout}`,state:{family,layout,params:{count:layout==='stacked'?3:layout==='beam'?3:1}},h:1200});
// The four modes on one arch: aurora ramp on near-black, ember ramp on paper.
const ramp=id=>RAMPS.find(r=>r.id===id).stops;
for(const [slug,base] of [['neon',{family:'club',shape:'arch',core:'none',ramp:ramp('aurora'),colors:['#05060c','#14193a','#ffffff','#e8fff4'],params:{smear:.4,offset:0,fray:0}}],['paper',{family:'ember',shape:'arch',core:'none',params:{smear:.6,fray:0}}]])for(const mode of OPTIONS.mode)examples.push({name:`modes/${slug}-${mode}`,state:{...base,mode,layout:mode==='beam'?'beam':'centred',ground:'gradient',...(mode==='beam'?{shape:'slit',params:{...base.params,count:3,fray:.6,width:6}}:{})},h:1200});
// Variations: the shared construction pushed in different directions.
for(const [slug,state] of [['width-tight',{family:'halo',params:{width:6,bloom:.2}}],['width-wide',{family:'halo',params:{width:80}}],['curve-hard',{family:'moon',params:{curve:3}}],['balance-inner',{family:'club',params:{balance:-.8}}],
 ['balance-outer',{family:'club',params:{balance:1}}],['smear-sideways',{family:'smoke',params:{angle:0,smear:1.6}}],['offset-cast',{family:'vessel',params:{offset:120,angle:225}}],['layers-tunnel',{family:'club',shape:'arch',params:{layers:5}}],
 ['stacked-moons',{family:'moon',layout:'stacked',params:{count:3,size:.9}}],['door-row',{family:'club',params:{count:4,size:1.1,layers:1}}],['scribble-field',{family:'frontier',sparkle:'scribbles',params:{sparkles:60}}],['petal-moon',{family:'moon',sparkle:'petals',params:{sparkles:40}}],
 ['grain-heavy',{family:'ember',params:{grain:.32}}],['haze-figure',{family:'veil',params:{haze:.9,fray:1}}],['hand-shadow',{family:'signal',mode:'shadow',core:'none',layout:'centred',ramp:ramp('sepia'),colors:['#e9d9cc','#0b0807','#0b0807','#0b0807'],params:{angle:70,haze:.4}}],['counter-bleed',{family:'window',layout:'bleed',params:{size:.7}}],
 ['ink-beam',{family:'shaft',ramp:ramp('ink'),params:{count:3}}],['orb-field',{family:'frontier',shape:'circle',layout:'centred',params:{size:.8,width:30}}],['two-stop',{family:'halo',ramp:ramp('mono')}],['vase-neon',{family:'vessel',mode:'halo',core:'line',ramp:ramp('neon'),colors:['#06040c','#06040c','#3df5ff','#ffffff']}]])
 examples.push({name:`variations/${slug}`,state,h:1200});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.h));}
for(const f of FAMILIES){const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);globalThis.gc?.();fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:1600}}).render().asPng());}
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,optionModes:OPTION_MODES,ramps:RAMPS,shapes:Object.entries(SHAPES).map(([id,s])=>({id,name:SHAPE_NAMES[id],aspect:s.aspect,probe:s.probe})),poster:{width:728,height:1030,png:[2120,3000]}},null,2));
// The editor embeds the engine (no dependencies) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'GlowEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,RAMPS,SHAPE_NAMES,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
