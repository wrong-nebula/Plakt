import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {buildSync} from 'esbuild';
import {ENGINE,FAMILIES,CONTROLS,ITEM_CONTROLS,SHAPES,LABELS,OPTIONS,FORMATS,PALETTES,METHODS,MARKS,ARRANGEMENTS,FONT_LIST,render,setType} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
import {withPrintPanel,printOutputs} from '../print-kit-node.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/heavy-dither-study-v1');
fs.rmSync(out,{recursive:true,force:true});for(const d of ['references','sheets','stages','phone','formats','variations'])fs.mkdirSync(path.join(out,d),{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),png=(svg,fit)=>new Resvg(svg,{fitTo:fit,font:{loadSystemFonts:false}}).render().asPng(),H=v=>({mode:'height',value:v}),Wd=v=>({mode:'width',value:v});
const ref=fs.readFileSync(path.join(here,'reference/user-reference.png'));fs.writeFileSync(path.join(out,'references/user-reference.png'),ref);
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({reference:{file:'references/user-reference.png',from:'Sent by the user on 8 November 2026',description:'A photograph dithered to coarse 1-bit pixels inside a thin black frame on cream paper: vertical stripes along the top, organic swirling forms, solid blacks breaking into checks and noise.',imageSHA256:sha(ref)},
 fonts:FONT_LIST,basis:'Shape system study: shapes are tone fields (lit volumes, fills, soft copy) composed into one picture and dithered on a coarse pixel grid into marks. One style (Framed print) stays close to the reference; the rest are new. Nothing is traced.'},null,2));
const write=(name,r,fit=H(1500))=>{fs.writeFileSync(path.join(out,name+'.svg'),r.svg);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(r.state,null,2));fs.writeFileSync(path.join(out,name+'.png'),png(r.svg,fit));};
// Styles, each at a 1500 px tall proof plus its rule; phone proofs at 390 px wide, the width the posters must read at.
for(const f of FAMILIES){const r=render({family:f.id});write(f.id,r);fs.writeFileSync(path.join(out,`phone/${f.id}.png`),png(r.svg,Wd(390)));}
// Construction stages: the tone picture before dithering, then the dithered poster.
for(const id of ['framed','moon','riso','soft-type','strata','shape-field']){fs.writeFileSync(path.join(out,`stages/${id}-1-tone.png`),png(render({family:id},{view:'tone'}).svg,H(1200)));fs.writeFileSync(path.join(out,`stages/${id}-2-dither.png`),png(render({family:id}).svg,H(1200)));}
// Formats and variations: modules swapped between styles, to show that they combine.
for(const [fmt,family] of [['poster','framed'],['story','neon'],['square','moon'],['wide','strata'],['a','soft-type']])write(`formats/${fmt}-${family}`,render({family,format:fmt}),H(1000));
for(const [slug,state] of [['framed-steps',{family:'framed',arrangement:'steps'}],['framed-bleed-led',{family:'framed',arrangement:'bleed',mark:'led',palette:'acid'}],['framed-handheld',{family:'framed',palette:'handheld',params:{levels:4}}],
 ['moon-dots',{family:'moon',mark:'dot',method:'cluster'}],['moon-poster',{family:'moon',arrangement:'poster',title:'FULL/MOON',font:'unbounded'}],['neon-scan',{family:'neon',mark:'scan',method:'floyd'}],
 ['riso-field',{family:'riso',arrangement:'field',params:{cols:2}}],['strata-steps',{family:'strata',arrangement:'steps'}],['soft-type-stitch',{family:'soft-type',mark:'cross',palette:'blueprint',params:{pixel:9}}],
 ['ripple-wide-pixels',{family:'ripple',params:{aspect:2.4,pixel:7}}],['static-threshold',{family:'static',method:'threshold',params:{grain:.8}}],['ultra-diamonds',{family:'ultra',mark:'diamond',params:{pixel:9}}],
 ['opart-lines',{family:'opart',method:'lines',params:{pixel:5}}],['shape-field-atlas',{family:'shape-field',arrangement:'atlas'}],['block-ordered',{family:'block',method:'atkinson',params:{order:.8,pixel:14}}]])
 write(`variations/${slug}`,render(state),H(1200));
// Sheets: nested proofs labelled with outlined type, so no font is needed to rasterize them.
// Labels are outlined in Rubik Mono One, shrunk to fit their cell; it has no ×, so Bayer sizes read 2X2.
const label=(t,x,y,size,max=Infinity)=>{t=t.replaceAll('×','X');const s=setType(t,'mono',0,0,1e4);let k=size/(s.cap||1);if(s.w*k>max)k=max/s.w;const polys=setType(t,'mono',x+s.w*k/2,y-s.cap*k/2,s.w*k).polys;return polys.map(q=>'M'+q.map((v,i)=>(i&&!(i%2)?'L':'')+(Math.round(v*10)/10)+(i%2?'':' ')).join('')+'z').join('');};
function sheet(cells,{cols,cell,title}){const pad=28,lab=34,head=90,r0=cells[0],ratio=r0.height/r0.width,rows=Math.ceil(cells.length/cols),ch=cell*ratio,W=cols*(cell+pad)+pad,Hh=head+rows*(ch+lab+pad)+pad;
 let body=`<rect width="${W}" height="${Hh}" fill="#ecebe6"/><path d="${label(title,pad,58,30)}" fill="#26272b"/>`;
 cells.forEach((c,i)=>{const x=pad+(i%cols)*(cell+pad),y=head+Math.floor(i/cols)*(ch+lab+pad),inner=c.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  body+=`<svg x="${x}" y="${y}" width="${cell}" height="${ch}" viewBox="0 0 ${c.width} ${c.height}">${inner}</svg><path d="${label(c.label,x,y+ch+24,13,cell)}" fill="#26272b"/>`;});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${body}</svg>`;}
const putSheet=(name,svg,width)=>{fs.writeFileSync(path.join(out,`sheets/${name}.svg`),svg);fs.writeFileSync(path.join(out,`sheets/${name}.png`),png(svg,Wd(width)));};
putSheet('styles',sheet(FAMILIES.map(f=>({...render({family:f.id}),label:f.name.toUpperCase()})),{cols:6,cell:300,title:'HEAVY DITHER — STYLES'}),2400);
putSheet('methods',sheet(Object.entries(METHODS).map(([id,m])=>({...render({family:'framed',method:id,arrangement:'bleed'}),label:m.name.toUpperCase()})),{cols:7,cell:260,title:'THE SOURCE PICTURE, EVERY METHOD'}),2400);
putSheet('shapes',sheet(Object.entries(SHAPES).map(([id,s])=>({...render({family:'shape-field',arrangement:'bleed',format:'square',items:[{shape:id,x:.5,y:.5,size:s.group==='Fills'?1.9:.86,text:'AB',font:'anton'}],params:{pixel:5}}),label:s.name.toUpperCase()})),{cols:6,cell:260,title:'EVERY SHAPE, ONE CONSTRUCTION'}),2000);
putSheet('marks',sheet(Object.entries(MARKS).map(([id,m])=>({...render({family:'moon',mark:id,format:'square',params:{pixel:14}}),label:m.toUpperCase()})),{cols:3,cell:420,title:'ONE PICTURE, EVERY MARK'}),1800);
putSheet('palettes',sheet(Object.entries(PALETTES).map(([id,p])=>({...render({family:'riso',palette:id,format:'square',params:{levels:p.colors.length}}),label:p.name.toUpperCase()})),{cols:6,cell:260,title:'PALETTES'}),2000);
putSheet('arrangements',sheet(Object.entries(ARRANGEMENTS).map(([id,a])=>({...render({family:'framed',arrangement:id}),label:a.toUpperCase()})),{cols:7,cell:260,title:'ARRANGEMENTS'}),2400);
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,controls:CONTROLS,itemControls:ITEM_CONTROLS,shapes:SHAPES,methods:METHODS,marks:MARKS,arrangements:ARRANGEMENTS,labels:LABELS,options:OPTIONS,formats:FORMATS,palettes:PALETTES,fonts:FONT_LIST},null,2));
// The editor embeds the engine and its outlines as one offline script.
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'HeavyDither',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
fs.writeFileSync(path.join(out,'index.html'),withPrintPanel(workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,SHAPES,LABELS,reference:'references/user-reference.png'})));
// Print outputs from the shared print kit: spot separations and a riso preview for every style.
const print=printOutputs({out,styles:FAMILIES.map(f=>({id:f.id,svg:render({family:f.id}).svg}))});
console.log(`Print kit: ${print.styles} riso previews and ${print.sheets} separation sheets in print/`);
console.log(`Built ${FAMILIES.length} styles with phone proofs, 12 stage proofs, 5 formats, 15 variations, 6 sheets and the editor (${(bundle.length/1024).toFixed(0)} KB engine with outlines): ${out}`);
