import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSync} from 'fontkit';
import svgpath from 'svgpath';
const dir=path.dirname(fileURLToPath(import.meta.url)),files={
 condensed:'/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf',
 black:'/System/Library/Fonts/Supplemental/Arial Black.ttf',
 serif:'/System/Library/Fonts/Supplemental/Times New Roman.ttf'
};
const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?+/&–—-’\'()àâçéèêëîïôùûüÉÀ',FONT={},provenance={};
for(const [key,file] of Object.entries(files)){const font=openSync(file),glyphs={};for(const ch of chars){const g=font.glyphForCodePoint(ch.codePointAt(0)),b=g.bbox,width=b.maxX-b.minX,height=b.maxY-b.minY;glyphs[ch]={d:width&&height?svgpath(g.path.toSVG()).translate(-b.minX,-b.maxY).scale(100/width,-100/height).round(5).toString():'',advance:g.advanceWidth,x:b.minX,top:b.maxY,width,height};}FONT[key]=glyphs;provenance[key]={file,family:font.familyName,fullName:font.fullName};}
fs.writeFileSync(path.join(dir,'fonts.mjs'),'// Vector outlines of supporting type; font binaries are not embedded.\nexport const FONT='+JSON.stringify(FONT)+';\n');
fs.writeFileSync(path.join(dir,'font-provenance.json'),JSON.stringify(provenance,null,2));
console.log('Prepared serif, condensed and heavy supporting letter outlines.');
