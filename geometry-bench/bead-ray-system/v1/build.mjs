import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {converter,wcagContrast} from 'culori';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,LAYOUTS,FORMATS,render,specimen,imageFromLuminance} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),out=path.join(root,'output/bead-ray-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','stages','layouts','formats','variations','sources'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg frees native buffers only on garbage collection (run with --expose-gc).
let rasters=0;const png=(svg,long,w,h)=>{if(++rasters%10===0)globalThis.gc?.();return new Resvg(svg,{fitTo:w>=h?{mode:'width',value:long}:{mode:'height',value:long}}).render().asPng();};
// References come from the local Japanese poster archive (MoMA and PGDA records).
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title.replace(/&nbsp;|"|“|”/g,'').replace(/\s*\(.*?\)\s*/g,' ').trim(),designer:(w.designers||[])[0]||(w.designer==='永井 一正'?'Kazumasa Nagai':w.designer),date:/\d{4}/.test(w.date||'')?w.date:'',medium:w.medium??'',recordURL:w.recordURL,institution:w.institution,credit:w.credit??null,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),metadataLicense:w.metadataLicense??null,imageRights:w.imageRights??w.license};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Kazumasa Nagai','Yusaku Kamekura'],references,wordAlphabet:'Word masks use the cell alphabet exported by geometry-bench/isometric-prism-system/engine.mjs (imported read-only).',
 basis:'Shape system study: radial bead-ray blooms (bead rays with size curves and spacing ramps, perforated bars, tapered spikes, petals of fine lines, hub rings, layers) and flip-disc screens whose tilt, iris or flip follows a source field. Seven presets follow posters by Nagai (The Cell; the two 1969 Imabashi Gallery posters; Light and Vision; the 2001 retrospective) and Kamekura (Expo ’70; Peacefully Use Atomic Energy); six are new. Note: Light and Vision (moma-8815) is credited to Kazumasa Nagai in the MoMA record. Nothing is traced from the posters.'},null,2));

// A demo image for the image source, drawn here and sampled like the editor does: a face of discs and a smile.
function demoImage(){const w=56,h=78,svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#000"/><circle cx="28" cy="38" r="24" fill="#fff"/><circle cx="19" cy="31" r="4.5" fill="#000"/><circle cx="37" cy="31" r="4.5" fill="#000"/><path d="M15 44 Q28 58 41 44" stroke="#000" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
 const img=new Resvg(svg).render(),px=img.pixels,vals=new Float32Array(w*h);for(let i=0;i<w*h;i++)vals[i]=(.2126*px[i*4]+.7152*px[i*4+1]+.0722*px[i*4+2])/255;return imageFromLuminance(w,h,vals,'demo-face');}
const face=demoImage();fs.writeFileSync(path.join(out,'demo-image.json'),JSON.stringify(face));

const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id},long:3000});for(const stage of [1,2,3,4])examples.push({name:`stages/${f.id}-${stage}`,state:{family:f.id,stage}});}
// Five layouts on three presets (bloom-first, screen-first, electro).
for(const family of ['cell','flip','neon'])for(const l of LAYOUTS)examples.push({name:`layouts/${family}-${l.id}`,state:{family,layout:l.id}});
for(const family of ['neon','scoreboard','confetti','petal'])for(const f of FORMATS)examples.push({name:`formats/${family}-${f.id}`,state:{family,format:f.id,...(family==='scoreboard'&&f.id==='landscape'?{word:'TOKYO/2026'}:{})}});
// Eight flip sources on one screen rule.
for(const source of OPTIONS.source)examples.push({name:`sources/${source}`,state:{family:'opart',source,word:'BEAD/RAY',shape:'hand',image:face,tint:'none',axisMode:'fixed',grid:'square',params:{pitch:18,sourceAngle:source==='linear'?90:25,contrast:1.6,socket:.3}}});
// Variations: the shared construction pushed in different directions.
for(const [slug,state] of [
 ['spiral-twist',{family:'cell',rayMode:'beads',bead:'disc',params:{twist:220,rings:0,beadSize:1.4,beads:16}}],['pulse-lozenge',{family:'neon',bead:'lozenge',curve:'pulse',params:{twist:0,beadSize:1.2}}],['gaps',{family:'cell',params:{dropout:.35,jitter:.3,seed:5}}],
 ['square-beads',{family:'confetti',layout:'bloom',bead:'square',params:{rays:30,beads:14,beadSize:1.3,layers:3,zoom:1}}],['sector-fan',{family:'vault',layout:'bloom',bead:'disc',params:{sector:140,rays:21,beads:16,beadSize:1.6,turn:-90,hub:.05,zoom:1.15}}],
 ['petal-scallop',{family:'petal',params:{rays:12,lines:30,lengthMod:.5,waves:1,petalWidth:.95,twist:40}}],['petal-neon',{family:'petal',colors:['#07060b','#170a2c','#19f0ff','#ff2bd6','#c6ff3d','#f4f1ff'],params:{glow:2,layers:2,rays:10}}],
 ['spikes-neon',{family:'burst',colors:['#07060b','#170a2c','#ff2bd6','#19f0ff','#c6ff3d','#f4f1ff'],params:{glow:2.5,squash:1,rays:140,jitter:.7}}],['egg-field',{family:'egg',layout:'field',params:{rays:14,beads:5,beadSize:3,sizeRange:.5,spacing:1,sector:360,lengthMod:0,blooms:5,seed:3,hub:.28,zoom:1.3}}],
 ['perforated-ring',{family:'cell',bead:'ring',params:{rays:24,beads:10,beadSize:.8,weight:2}}],
 ['word-tilt',{family:'flip',source:'word',word:'BEAD/RAY',axisMode:'contour',params:{pitch:16,contrast:1.8,gamma:1,sourceScale:1,sourceAngle:0,hinge:.2}}],['hand-hex',{family:'eye',source:'shape',shape:'hand',grid:'hex',axisMode:'contour'}],
 ['star-flipdot',{family:'scoreboard',source:'shape',shape:'star',params:{pitch:20}}],['heart-iris',{family:'vision',source:'shape',shape:'heart',params:{pitch:24,contrast:1.6,gamma:1,sourceScale:1,sourceAngle:0}}],
 ['moon-swing',{family:'opart',source:'shape',shape:'moon',axisMode:'swing',tint:'none',params:{pitch:20,swing:.8}}],['image-face',{family:'eye',source:'image',image:face,grid:'square',axisMode:'fixed',params:{pitch:18,contrast:1.4}}]])
 examples.push({name:`variations/${slug}`,state});
const features=[];
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.long??1500,r.width,r.height));
 const {screenArea,blooms,...rest}=r.features;features.push({name:e.name,...rest});}
for(const family of ['cell','neon','flip']){const s=specimen({family});fs.writeFileSync(path.join(out,`specimen-${family}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${family}.png`),new Resvg(s,{fitTo:{mode:'width',value:2400}}).render().asPng());}
const oklch=converter('oklch');
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,layouts:LAYOUTS,formats:FORMATS,examples:features,
 palettes:FAMILIES.map(f=>({family:f.id,roles:['ground','ground2','ink','ink2','accent','type'],colors:f.colors,oklch:f.colors.map(c=>oklch(c)),inkOnGround:+wcagContrast(f.colors[2],f.colors[0]).toFixed(2),typeOnGround:+wcagContrast(f.colors[5],f.colors[0]).toFixed(2)}))},null,2));
// The editor embeds the engine (and the read-only cell alphabet) as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'BeadRayEngine',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LAYOUTS,FORMATS,references}));
const maxBytes=Math.max(...features.map(f=>f.bytes));
console.log(`Built ${examples.length} SVG/PNG/rule examples (largest SVG ${(maxBytes/1024).toFixed(0)} KB), 3 specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
