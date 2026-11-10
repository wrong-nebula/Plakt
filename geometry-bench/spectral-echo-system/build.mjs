import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {ENGINE,SOURCES,FAMILIES,CONTROLS,OPTIONS,FONT_LIST,render,specimen} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/spectral-echo-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const dir of ['references','variations'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// References come from the local Japanese poster archive.
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'output/japanese-posters/catalog.json'))).works.map(w=>[w.id,w]));
const references=SOURCES.map(s=>{const w=catalog[s.id],dir=path.join(root,'output/japanese-posters/images',w.source),name=fs.readdirSync(dir).find(f=>f.startsWith(s.id+'.')),file='references/'+name;fs.copyFileSync(path.join(dir,name),path.join(out,file));
 return {...s,file,title:w.title.replace(/&nbsp;|"|“|”/g,'').trim(),designer:(w.designers||[])[0]||w.designer,date:/\d{4}/.test(w.date||'')?w.date:'',recordURL:w.recordURL,institution:w.institution,imageSHA256:hash(fs.readFileSync(path.join(dir,name))),imageRights:w.imageRights??w.license};});
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({designers:['Mitsuo Katsui','Koichi Sato'],references,fonts:FONT_LIST,basis:'Type system study: copies of a glyph moved by one composed transform and coloured along an OKLCH hue walk, in linear, radial, sliced and prism constructions. Three styles follow Katsui and Sato; four are new. Nothing is traced from the posters.'},null,2));
const png=(svg,height=3000)=>new Resvg(svg,{fitTo:{mode:'height',value:height}}).render().asPng();
const examples=[];
for(const f of FAMILIES){examples.push({name:f.id,state:{family:f.id}});
 for(const [slug,text] of [['ja','光/音'],['latin','TYPE/SYSTEM'],['2026','2026']])examples.push({name:`${f.id}-${slug}`,state:{family:f.id,text}});
 for(const stage of [1,2,3,4])examples.push({name:`stage-${f.id}-${stage}`,state:{family:f.id,stage}});
 const s=specimen({family:f.id});fs.writeFileSync(path.join(out,`specimen-${f.id}.svg`),s);fs.writeFileSync(path.join(out,`specimen-${f.id}.png`),new Resvg(s,{fitTo:{mode:'width',value:2400}}).render().asPng());}
// Variations: the same rule pushed in different directions.
for(const [slug,state] of [['beams',{family:'trail',text:'LOUD/ER',params:{angle:270,stretchX:.4}}],['spectrum-ground',{family:'bloom',text:'夢',ground:'spectrum'}],['difference',{family:'split',blend:'difference',ground:'spectrum',text:'GLITCH'}],['line-bloom',{family:'bloom',style:'line',core:'outline',text:'東京',colors:['#07060b','#ffffff','#2a0b45'],blend:'screen',params:{chroma:.24,light:.72,opacity:.8}}],
 ['orbit-wide',{family:'orbit',params:{rotate:-160,count:28}}],['smear-rows',{family:'smear',layout:'rows',text:'WAVE/FORM',params:{smear:.2,waves:2.5}}],['column',{family:'bloom',layout:'column',text:'生かす文字',params:{stretchX:.9,stretchY:0}}],['tunnel-turn',{family:'tunnel',params:{rotate:90,count:30}}],
 ['prism-echo',{family:'prism',mode:'linear',text:'PRISM',params:{count:14,spread:.6,angle:300,opacity:.6}}],['slices-mono',{family:'smear',font:'mono',text:'SCAN',layout:'rows',params:{slices:40,smear:.25,waves:3,glow:2}}],['radial-six',{family:'split',params:{count:6,spread:.2}}],['fade-out',{family:'trail',text:'FADE',params:{count:40,fade:1,spread:1.6,angle:180}}]])
 examples.push({name:`variations/${slug}`,state});
for(const e of examples){const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,e.name+'.png'),png(r.svg,e.name.includes('/')?1500:3000));}
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,options:OPTIONS,fonts:FONT_LIST},null,2));
// The editor embeds the engine and its outlines as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'SpectralEcho',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,FONT_LIST,references}));
console.log(`Built ${examples.length} SVG/PNG/rule examples, ${FAMILIES.length} specimens, ${references.length} references and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
