import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSync} from 'fontkit';
const dir=path.dirname(fileURLToPath(import.meta.url));
const files={serif:'/System/Library/Fonts/Supplemental/Times New Roman.ttf',sans:'/System/Library/Fonts/Supplemental/Arial.ttf'};
const fonts=Object.fromEntries(Object.entries(files).map(([key,file])=>[key,openSync(file)]));
const phrases={
 headline:['serif',"PLOT — ATLAS D’UNE PARTICULARITÉ LAUSANNOISE"],
 event:['serif',"FORUM D’ARCHITECTURES LAUSANNE 19.09 — 20.10.19"],
 logo:['sans',"f’ar"],website:['serif','ARCHI-FAR.CH'],
 credit:['sans','CHRISTIAN GAUTSCHI / CONSTRUCTION STUDY'],
 method:['sans','PROGRESSIVE HORIZONTAL LETTER WINDOWS'],
 key:['sans','UNE LETTRE / NEUF RÉVÉLATIONS'],
 date:['sans','PLOT / LAUSANNE / 2019']
};
const TYPE={};for(const [key,[face,text]] of Object.entries(phrases)){const font=fonts[face],run=font.layout(text);let x=0,top=-Infinity,bottom=Infinity,body='';
 for(let i=0;i<run.glyphs.length;i++){const g=run.glyphs[i],p=run.positions[i],xOffset=x+p.xOffset,yOffset=p.yOffset;if(g.path.commands.length){body+=`<g transform="translate(${xOffset} ${yOffset})"><path d="${g.path.toSVG()}"/></g>`;top=Math.max(top,g.bbox.maxY+yOffset);bottom=Math.min(bottom,g.bbox.minY+yOffset);}x+=p.xAdvance;}
 TYPE[key]={text,face,body,width:x,top,bottom};
}
// Single sans glyphs let the footer state the live slice and word angles.
const glyphSet=(font,chars)=>Object.fromEntries([...chars].map(ch=>{const g=font.glyphForCodePoint(ch.codePointAt(0));return [ch,{d:g.path.commands.length?g.path.toSVG():'',adv:g.advanceWidth}];}));
const SANS=glyphSet(fonts.sans,' 0123456789°−/ABCDEFGHIJKLMNOPQRSTUVWXYZ');
// Serif capitals, figures and punctuation set an own caption in the style of the source header.
const SERIF=glyphSet(fonts.serif,' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;–—-/’&()+°!?#ÉÈÊËÀÂÄÇÎÏÔÖÙÛÜ');
fs.writeFileSync(path.join(dir,'type.mjs'),'// Fixed supporting phrases converted to vector paths. No font binary is embedded.\nexport const TYPE='+JSON.stringify(TYPE)+';\nexport const SANS='+JSON.stringify(SANS)+';\nexport const SERIF='+JSON.stringify(SERIF)+';\n');
fs.writeFileSync(path.join(dir,'type-provenance.json'),JSON.stringify({fonts:Object.fromEntries(Object.entries(fonts).map(([k,f])=>[k,{file:files[k],family:f.familyName,fullName:f.fullName,postscriptName:f.postscriptName}])),note:'Only fixed supporting phrases are converted into the poster. Primary P/l/o/t and extension glyphs are authored separately.'},null,2));
console.log('Prepared fixed serif and sans support phrases as vector paths.');
