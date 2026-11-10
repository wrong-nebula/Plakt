import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import SVGPathCommander from 'svg-path-commander';
import {GLYPHS} from './engine.mjs';
const FIT={};for(const [ch,g] of Object.entries(GLYPHS)){if(!g.d)continue;const b=SVGPathCommander.getPathBBox(g.d);if(b.y<0||b.y2>100){const anchor=/^[a-z]$/.test(ch)&&b.y>=20?28:0,lo=Math.min(0,b.y),hi=Math.max(100,b.y2),scale=(100-anchor)/(hi-anchor-lo),offset=anchor-scale*(anchor+lo);FIT[ch]={scale,offset};}}
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'bounds.mjs'),'// Fit experimental extension outlines inside the final reveal.\nexport const FIT='+JSON.stringify(FIT,null,2)+';\n');
console.log('Prepared extension glyph bounds; source P/l/o/t stay unchanged.');
