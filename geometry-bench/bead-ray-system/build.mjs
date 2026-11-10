import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,V1_ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,LAYOUTS,FORMATS,render,specimen,series,imageFromLuminance} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
// v2 writes only to its own folder; output/bead-ray-study-v1 stays frozen (its code is in ./v1).
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/bead-ray-study-v2');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','stages','generators','screens','finishes','series','formats'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg frees native buffers only on garbage collection (run with --expose-gc).
let rasters=0;const png=(svg,long,w,h)=>{if(++rasters%10===0)globalThis.gc?.();return new Resvg(svg,{fitTo:w>=h?{mode:'width',value:long}:{mode:'height',value:long}}).render().asPng();};
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title.replace(/&nbsp;|"|“|”/g,'').replace(/\s*\(.*?\)\s*/g,' ').trim(),designer:(w.designers||[])[0]||(w.designer==='永井 一正'?'Kazumasa Nagai':w.designer),date:/\d{4}/.test(w.date||'')?w.date:'',medium:w.medium??'',recordURL:w.recordURL,institution:w.institution,credit:w.credit??null,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights??w.license};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Kazumasa Nagai','Yusaku Kamekura'],references,wordAlphabet:'Word masks, word sources and letter beads use the cell alphabet exported by geometry-bench/isometric-prism-system/engine.mjs (imported read-only).',
 versions:{current:ENGINE,opens:[V1_ENGINE],frozen:'output/bead-ray-study-v1 and geometry-bench/bead-ray-system/v1'},
 basis:'Shape system study, version 2. Adds phyllotaxis and phase-shifted ring generators, vortex bend, more bead shapes with shape and colour stepping, word and silhouette masks for blooms, square, hatch and Truchet screen elements, two-sided coins, triangle, brick and golden-spiral lattices, ordered and error-diffusion dithering, a moiré second screen, riso overprint and paper grain, painted sources, placed field centres and series. Eleven new presets use print palettes. Nothing is traced from the posters.'},null,2));

// Demo image for the image source: a face drawn here and sampled like the editor does (pixels read once).
function demoImage(){const w=56,h=78,svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#000"/><circle cx="28" cy="38" r="24" fill="#fff"/><circle cx="19" cy="31" r="4.5" fill="#000"/><circle cx="37" cy="31" r="4.5" fill="#000"/><path d="M15 44 Q28 58 41 44" stroke="#000" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
 const img=new Resvg(svg).render(),px=img.pixels,vals=new Float32Array(w*h);for(let i=0;i<w*h;i++)vals[i]=(.2126*px[i*4]+.7152*px[i*4+1]+.0722*px[i*4+2])/255;return imageFromLuminance(w,h,vals,'demo-face');}
const face=demoImage();fs.writeFileSync(path.join(out,'demo-image.json'),JSON.stringify(face));

const v2=FAMILIES.filter(f=>f.kind==='v2'),examples=[];
for(const f of FAMILIES)examples.push({name:f.id,state:{family:f.id},long:f.kind==='v2'?3000:1500});
for(const f of v2)for(const stage of [1,2,3,4])examples.push({name:`stages/${f.id}-${stage}`,state:{family:f.id,stage}});
// Generators, beads and masks.
for(const [slug,state] of [['spiral-golden',{family:'sunflower',beadAlt:'none'}],['spiral-near-miss',{family:'sunflower',beadAlt:'none',params:{divergence:137.1}}],['spiral-spokes',{family:'sunflower',beadAlt:'none',params:{divergence:120.3}}],['spiral-scallop',{family:'sunflower',bead:'petal',beadAlt:'none',params:{lengthMod:.8,waves:2.5}}],
 ['rings-0',{family:'tide',params:{phase:0}}],['rings-12',{family:'tide',params:{phase:12}}],['rings-wavy',{family:'tide',params:{lengthMod:.7,waves:3,phase:3}}],['vortex-left',{family:'vortex',params:{bend:-.8,twist:-40}}],
 ['beads-half',{family:'vortex',bead:'half',beadAlt:'none',params:{bend:.3}}],['beads-star',{family:'tide',rayMode:'beads',bead:'star',inkRamp:'steps',params:{rays:30,beads:12,beadSize:1.1}}],['beads-cross',{family:'sunflower',bead:'cross',beadAlt:'none',params:{weight:1.2}}],['beads-glyph',{family:'letter',bloomMask:'none',bead:'glyph',word:'BEADRAY',params:{rays:18,beads:9,beadSize:1.05,spacing:1.1,hub:.12,zoom:1,shiftY:0}}],
 ['mask-word-clip',{family:'letter',maskMode:'clip',params:{beadSize:.8}}],['mask-word-cut',{family:'letter',maskMode:'cut',word:'SUN',params:{rays:120,beads:36,beadSize:.42,shiftY:0,zoom:1.5}}],['mask-heart',{family:'sunflower',bloomMask:'shape',shape:'heart',maskMode:'clip',params:{rays:48,beads:30,zoom:1.4}}],['mask-hand-size',{family:'tide',bloomMask:'shape',shape:'hand',maskMode:'size',params:{zoom:1.5,beads:24,rays:34}}]])
 examples.push({name:`generators/${slug}`,state});
// Screens: elements, lattices, dithering, coins, moiré.
for(const [slug,state] of [['square-tilt',{family:'coin',element:'square',flipMode:'tilt',grid:'square',source:'shape',shape:'star'}],['hatch-face',{family:'hatch',source:'image',image:face,axisMode:'fixed',params:{axis:-30,pitch:12}}],['hatch-eye',{family:'hatch',shape:'eye'}],
 ['truchet-word',{family:'truchet',source:'word',word:'WEAVE',params:{pitch:18,sourceScale:1,sourceAngle:0}}],['truchet-radial-grid',{family:'truchet',grid:'radial',params:{pitch:22}}],
 ['grid-triangle',{family:'coin',grid:'triangle',flipMode:'tilt',shape:'star',params:{pitch:18}}],['grid-brick',{family:'coin',flipMode:'tilt'}],['grid-spiral',{family:'coin',grid:'spiral',flipMode:'tilt',params:{pitch:20}}],
 ['dither-ordered',{family:'dither'}],['dither-diffusion',{family:'dither',dither:'diffusion'}],['dither-face',{family:'dither',source:'image',image:face,dither:'diffusion',params:{pitch:12,soft:.2}}],['dither-hex',{family:'dither',grid:'hex',element:'disc',dither:'diffusion',source:'radial',params:{pitch:14}}],
 ['coin-word',{family:'coin',source:'word',word:'COIN',grid:'square',params:{pitch:20,soft:.5}}],['coin-wave',{family:'coin',source:'wave',grid:'hex',params:{pitch:22,sourceScale:.7,sourceAngle:30}}],
 ['moire-discs',{family:'moire',element:'disc',flipMode:'tilt',params:{pitch:16,moire:7,discSize:.4}}],['moire-wide',{family:'moire',params:{moire:12}}]])
 examples.push({name:`screens/${slug}`,state});
for(const fam of ['sunflower','tide','riso'])for(const finish of OPTIONS.finish)examples.push({name:`finishes/${fam}-${finish}`,state:{family:fam,finish}});
for(const fam of ['sunflower','truchet','letter','coin'])series({family:fam},4).forEach((state,k)=>examples.push({name:`series/${fam}-${k+1}`,state}));
for(const fam of ['sunflower','truchet','tide'])for(const f of FORMATS)examples.push({name:`formats/${fam}-${f.id}`,state:{family:fam,format:f.id}});
const features=[];
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.long??1200,r.width,r.height));
 const {screenArea,blooms,...rest}=r.features;features.push({name:e.name,...rest});}
for(const family of ['sunflower','truchet','neon']){const s=specimen({family});fs.writeFileSync(path.join(out,`specimen-${family}.svg`),s);globalThis.gc?.();fs.writeFileSync(path.join(out,`specimen-${family}.png`),new Resvg(s,{fitTo:{mode:'width',value:2400}}).render().asPng());}
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,opens:[V1_ENGINE],families:FAMILIES,controls:CONTROLS,options:OPTIONS,layouts:LAYOUTS,formats:FORMATS,examples:features,
 palettes:FAMILIES.map(f=>({family:f.id,kind:f.kind,roles:['ground','ground2','ink','ink2','accent','type'],colors:f.colors,oklch:f.colors.map(c=>oklch(c)),inkOnGround:+wcagContrast(f.colors[2],f.colors[0]).toFixed(2),typeOnGround:+wcagContrast(f.colors[5],f.colors[0]).toFixed(2)}))},null,2));
// The editor embeds the engine (and the read-only cell alphabet) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'BeadRayEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LAYOUTS,FORMATS,references}));
const maxBytes=Math.max(...features.map(f=>f.bytes));
console.log(`Built ${examples.length} SVG/PNG/rule examples (largest SVG ${(maxBytes/1024).toFixed(0)} KB), 3 specimens, ${references.length} references and the v2 editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
