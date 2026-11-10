import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import opentype from 'opentype.js';
import {ENGINE,FAMILIES,CONTROLS,LABELS,OPTIONS,FORMATS,PALETTES,METHODS,MARKS,PROFILES,FILLS,LAYOUTS,CONSTRUCTS,WARPS,FONT_LIST,ALPHABET,render,glyphPixels,normalize,inks} from './engine.mjs';
import {setType} from '../heavy-dither-system/engine.mjs';
import {FONTS} from './fonts.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/heavy-dither-type-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const d of ['references','sheets','stages','phone','layouts','texts','fonts'])fs.mkdirSync(path.join(out,d),{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),png=(svg,fit)=>new Resvg(svg,{fitTo:fit,font:{loadSystemFonts:false}}).render().asPng(),H=v=>({mode:'height',value:v}),Wd=v=>({mode:'width',value:v});
const ref=fs.readFileSync(path.join(root,'geometry-bench/heavy-dither-system/reference/user-reference.png'));fs.writeFileSync(path.join(out,'references/user-reference.png'),ref);
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({reference:{file:'references/user-reference.png',from:'Sent by the user on 8 November 2026',description:'A photograph dithered to coarse 1-bit pixels inside a thin black frame on cream paper.',imageSHA256:sha(ref)},
 fonts:FONT_LIST,basis:'Type system study: glyph outlines measured as a signed distance, raised by a profile, lit, given halos, shadows and extrusions, and dithered on a pixel grid tied to the cap height. Photo type stays close to the reference; the rest are new. Nothing is traced.'},null,2));
const write=(name,r,fit=H(1500))=>{fs.writeFileSync(path.join(out,name+'.svg'),r.svg);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,name+'.png'),png(r.svg,fit));};
for(const f of FAMILIES){const r=render({family:f.id});write(f.id,r);fs.writeFileSync(path.join(out,`phone/${f.id}.png`),png(r.svg,Wd(390)));}
// Construction stages: the letters on the pixel grid, the tone, the dithered poster.
for(const id of ['photo','tube','long-shadow','glow','melt','neon-tube'])for(const [k,v] of [['1-letters','letters'],['2-tone','tone'],['3-dither','dither']])fs.writeFileSync(path.join(out,`stages/${id}-${k}.png`),png(render({family:id},{view:v}).svg,H(1100)));
// Layouts on four styles, and every style with other copy.
for(const id of ['tube','photo','block','electric'])for(const l of OPTIONS.layout)write(`layouts/${id}-${l}`,render({family:id,layout:l}),H(1100));
const TEXTS=[['rave','RAVE/ON/2026'],['fete','Fête/de la/musique'],['bass','BASS/DROP']];
for(const f of FAMILIES)for(const [slug,text] of TEXTS)write(`texts/${f.id}-${slug}`,render({family:f.id,text}),H(900));
// Sheets: nested proofs labelled with outlined type, so no font is needed to rasterize them.
const label=(t,x,y,size,max=Infinity)=>{t=t.replaceAll('×','X');const s=setType(t,'mono',0,0,1e4);let k=size/(s.cap||1);if(s.w*k>max)k=max/s.w;
 return setType(t,'mono',x+s.w*k/2,y-s.cap*k/2,s.w*k).polys.map(q=>'M'+q.map((v,i)=>(i&&!(i%2)?'L':'')+(Math.round(v*10)/10)+(i%2?'':' ')).join('')+'z').join('');};
function sheet(cells,{cols,cell,title}){const pad=28,lab=34,head=90,ratio=cells[0].height/cells[0].width,rows=Math.ceil(cells.length/cols),ch=cell*ratio,W=cols*(cell+pad)+pad,Hh=head+rows*(ch+lab+pad)+pad;
 let body=`<rect width="${W}" height="${Hh}" fill="#ecebe6"/><path d="${label(title,pad,58,30)}" fill="#26272b"/>`;
 cells.forEach((c,i)=>{const x=pad+(i%cols)*(cell+pad),y=head+Math.floor(i/cols)*(ch+lab+pad),inner=c.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  body+=`<svg x="${x}" y="${y}" width="${cell}" height="${ch}" viewBox="0 0 ${c.width} ${c.height}">${inner}</svg><path d="${label(c.label,x,y+ch+24,13,cell)}" fill="#26272b"/>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${body}</svg>`;}
const put=(name,svg,width)=>{fs.writeFileSync(path.join(out,`sheets/${name}.svg`),svg);fs.writeFileSync(path.join(out,`sheets/${name}.png`),png(svg,Wd(width)));};
const word={format:'wide',layout:'poster',text:'DITHER',caption:''};
put('styles',sheet(FAMILIES.map(f=>({...render({family:f.id}),label:f.name.toUpperCase()})),{cols:10,cell:220,title:'HEAVY DITHER TYPE — STYLES'}),2400);
put('ladder',sheet([5,7,9,12,16,22,30,40,48].map(r=>({...render({family:'tube',...word,params:{rows:r}}),label:`${r} ROWS PER CAP`})),{cols:3,cell:560,title:'ROWS PER CAP, HEAVY TO FINE'}),2000);
put('methods',sheet(Object.entries(METHODS).map(([id,m])=>({...render({family:'photo',...word,method:id,params:{frame:0}}),label:m.name.toUpperCase()})),{cols:4,cell:440,title:'ONE WORD, EVERY METHOD'}),2000);
put('profiles',sheet(Object.entries(PROFILES).map(([id,n])=>({...render({family:'tube',...word,profile:id}),label:n.toUpperCase()})),{cols:3,cell:560,title:'PROFILES'}),2000);
put('faces',sheet(Object.entries(FONTS).map(([id,f])=>({...render({family:'chisel',...word,text:'Dither',face:id}),label:f.name.toUpperCase()})),{cols:4,cell:440,title:'FACES'}),2000);
put('renderings',sheet(Object.entries(MARKS).map(([id,n])=>({...render({family:'pop',...word,text:'DOTS',mark:id,params:{rows:14,misregister:0}}),label:n.toUpperCase()})),{cols:4,cell:440,title:'RENDERINGS'}),2000);
put('constructions',sheet(Object.entries(CONSTRUCTS).map(([id,n])=>({...render({family:'contours',...word,text:'SHAPE',construct:id,params:{rows:24}}),label:n.toUpperCase()})),{cols:4,cell:440,title:'CONSTRUCTIONS'}),2000);
put('warps',sheet(Object.entries(WARPS).map(([id,n])=>({...render({family:'wave',...word,text:'WARPED',warp:id,format:'square',params:{warpAmount:.7}}),label:n.toUpperCase()})),{cols:3,cell:440,title:'WARPS'}),1600);
put('marks',sheet(Object.entries(MARKS).map(([id,n])=>({...render({family:'glow',...word,mark:id,params:{rows:14}}),label:n.toUpperCase()})),{cols:3,cell:560,title:'MARKS'}),2000);
put('fills',sheet(Object.entries(FILLS).map(([id,n])=>({...render({family:'chisel',...word,fill:id,params:{fillAmount:.85}}),label:n.toUpperCase()})),{cols:3,cell:560,title:'FILLS'}),2000);
put('alphabets',sheet(FAMILIES.map(f=>({...render({family:f.id,layout:'specimen',format:'square'}),label:f.name.toUpperCase()})),{cols:6,cell:320,title:'ALPHABETS'}),2000);
// Fonts: every glyph of the six faces' shared set, dithered on its own; one OTF per ink that is not the page.
const CHARS=[...new Set(Object.keys(FONTS.archivo.glyphs))].filter(c=>c!==' '),fonts=[];
for(const f of FAMILIES){const s=normalize({family:f.id}),n=s.params.levels,colors=inks(s.palette,n),per={};
 const space=Math.round((FONTS[s.face].glyphs[' ']?.adv??260)*s.params.width*700/FONTS[s.face].capHeight);
 for(const ch of CHARS){const g=glyphPixels({family:f.id},ch);for(const {level,runs} of g.runs){(per[level]??=[]).push({ch,adv:g.adv,runs});}}
 for(const [level,glyphs] of Object.entries(per)){const ink=Object.keys(per).length>1?` Ink ${Number(level)+1}`:'',style=`${f.name}${ink}`,file=`fonts/PosterLabHeavyDither-${f.name.replace(/\W+/g,'')}${ink.replace(/\W+/g,'')}-1.0.otf`;
  const list=[new opentype.Glyph({name:'.notdef',unicode:0,advanceWidth:500,path:new opentype.Path()}),new opentype.Glyph({name:'space',unicode:32,advanceWidth:space,path:new opentype.Path()})];
  for(const {ch,adv,runs} of glyphs){const p=new opentype.Path();for(const [x,y,w,h] of runs){p.moveTo(Math.round(x),Math.round(y));p.lineTo(Math.round(x+w),Math.round(y));p.lineTo(Math.round(x+w),Math.round(y+h));p.lineTo(Math.round(x),Math.round(y+h));p.close();}
   list.push(new opentype.Glyph({name:'uni'+ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0'),unicode:ch.codePointAt(0),advanceWidth:adv,path:p}));}
  const font=new opentype.Font({familyName:'PosterLab Heavy Dither',styleName:style,unitsPerEm:1000,ascender:950,descender:-300,glyphs:list,designer:'PosterLab',description:`${f.note} After the outlines of ${FONTS[s.face].name} (SIL OFL).`,version:'1.0'});
  fs.writeFileSync(path.join(out,file),Buffer.from(font.toArrayBuffer()));fonts.push({style:f.id,name:`PosterLab Heavy Dither ${style}`,file,ink:colors[level],glyphs:glyphs.length});}}
fs.writeFileSync(path.join(out,'fonts/index.json'),JSON.stringify(fonts,null,2));
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,labels:LABELS,options:OPTIONS,formats:FORMATS,palettes:PALETTES,methods:METHODS,marks:MARKS,profiles:PROFILES,fills:FILLS,layouts:LAYOUTS,constructs:CONSTRUCTS,warps:WARPS,fonts:FONT_LIST,alphabet:ALPHABET,otf:fonts},null,2));
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'HeavyDitherType',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,LABELS,fonts}));
console.log(`Built ${FAMILIES.length} styles with phone proofs, 18 stage proofs, ${4*OPTIONS.layout.length} layouts, ${FAMILIES.length*TEXTS.length} text transfers, 12 sheets, ${fonts.length} OTF fonts and the editor (${(bundle.length/1024).toFixed(0)} KB engine): ${out}`);
