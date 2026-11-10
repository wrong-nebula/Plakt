// Pre-extracts a bounded set of glyph outlines into fonts.mjs, so the engine
// and the offline editor need no font files. Hiragino comes from this Mac
// (local study only); Archivo Black and Anton are OFL; the Hershey script is
// single-stroke centreline data (hersheytext, MIT port of the public Hershey
// fonts). Glyphs a face lacks are not invented here: the engine composes them
// from their radical (水 → 水水 → 淼) and marks them as composed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {openSync} from 'fontkit';
import svgpath from 'svgpath';
const dir=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const OFL='geometry-bench/experiments/native-pretext-20261108/workspace/Sources/PosterCore/Resources/Fonts';
const LATIN='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?-\'&+*#@()';
const KANJI='木林森口吕品日昌晶火炎焱水沝淼人从众土圭垚石砳磊車䡛轟一二三山川月光心愛夢風海波花鳥雨星和平';
const KANA_MARKS='しつくへてのんそいこりうとらちすあおぬねめゆをむ';
const KANA_ALL='あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンー';
const root=dir.slice(0,dir.indexOf('/geometry-bench/')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const FACES={
 mincho:{role:'mark',kind:'fill',file:'/System/Library/Fonts/ヒラギノ明朝 ProN.ttc',ps:'HiraMinProN-W6',chars:LATIN+KANJI+KANA_MARKS,licence:'macOS system font (Hiragino Mincho ProN W6); outlines used for a local study only'},
 gothic:{role:'mark',kind:'fill',file:'/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',ps:'HiraKakuProN-W6',fill:{file:'/System/Library/Fonts/Hiragino Sans GB.ttc',ps:'HiraginoSansGB-W6'},chars:LATIN+KANJI+KANA_MARKS,licence:'macOS system fonts (Hiragino Kaku Gothic ProN W6; Hiragino Sans GB W6 for 吕沝众砳䡛); local study only'},
 maru:{role:'mark',kind:'fill',file:'/System/Library/Fonts/ヒラギノ丸ゴ ProN W4.ttc',ps:'HiraMaruProN-W4',chars:LATIN+KANJI+KANA_MARKS,licence:'macOS system font (Hiragino Maru Gothic ProN W4); local study only'},
 black:{role:'mask',kind:'fill',file:path.join(root,OFL,'archivoblack/ArchivoBlack-Regular.ttf'),chars:LATIN,licence:'SIL Open Font License 1.1 (Archivo Black, Omnibus-Type)'},
 condensed:{role:'mask',kind:'fill',file:path.join(root,OFL,'anton/Anton-Regular.ttf'),chars:LATIN,licence:'SIL Open Font License 1.1 (Anton, Vernon Adams)'},
 heavy:{role:'mask',kind:'fill',file:'/System/Library/Fonts/ヒラギノ角ゴシック W9.ttc',ps:'HiraginoSans-W9',chars:LATIN+KANJI+KANA_ALL,licence:'macOS system font (Hiragino Sans W9); local study only'}
};
const open=(file,ps)=>{const f=openSync(file);return f.fonts?f.fonts.find(x=>x.postscriptName===ps):f;};
// Signed shoelace area of a flattened outline: outer and inner contours cancel, so this is ink area.
function inkArea(d){let area=0,first=null,prev=null;const pts=[];svgpath(d).abs().unarc().unshort().iterate((s,i,x,y)=>{const c=s[0];
  if(c==='M'){if(pts.length)pts.push(null);pts.push([s[1],s[2]]);}else if(c==='L')pts.push([s[1],s[2]]);
  else if(c==='Q'){for(let t=1;t<=8;t++){const u=t/8,a=(1-u)**2,b=2*u*(1-u),e=u*u;pts.push([a*x+b*s[1]+e*s[3],a*y+b*s[2]+e*s[4]]);}}
  else if(c==='C'){for(let t=1;t<=10;t++){const u=t/10,a=(1-u)**3,b=3*u*(1-u)**2,e=3*u*u*(1-u),g=u**3;pts.push([a*x+b*s[1]+e*s[3]+g*s[5],a*y+b*s[2]+e*s[4]+g*s[6]]);}}});
 pts.push(null);for(const p of pts){if(!p){if(prev&&first)area+=prev[0]*first[1]-first[0]*prev[1];first=prev=null;continue;}if(!first)first=p;else area+=prev[0]*p[1]-p[0]*prev[1];prev=p;}return Math.abs(area)/2;}
const FONTS={},provenance={};
for(const [key,face] of Object.entries(FACES)){const font=open(face.file,face.ps),fill=face.fill&&open(face.fill.file,face.fill.ps),glyphs={},filled=[],missing=[];
 for(const ch of new Set(face.chars)){const cp=ch.codePointAt(0);let f=font.hasGlyphForCodePoint(cp)?font:fill&&fill.hasGlyphForCodePoint(cp)?fill:null;if(!f){missing.push(ch);continue;}if(f!==font)filled.push(ch);
  const g=f.glyphForCodePoint(cp),k=1000/f.unitsPerEm,b=g.bbox,abs=svgpath(g.path.toSVG()).scale(k,-k).round(0),d=abs.toString();
  glyphs[ch]=[abs.rel().toString(),Math.round(g.advanceWidth*k),Math.round(b.minX*k),Math.round(-b.maxY*k),Math.round(b.maxX*k),Math.round(-b.minY*k),...(face.role==='mark'?[Math.round(inkArea(d))]:[])];}
 FONTS[key]={kind:face.kind,role:face.role,em:1000,ascent:Math.round(font.ascent*1000/font.unitsPerEm),descent:Math.round(font.descent*1000/font.unitsPerEm),glyphs};
 provenance[key]={file:face.file,postscriptName:font.postscriptName,family:font.familyName,fullName:font.fullName,sha256:sha(face.file),licence:face.licence,glyphs:Object.keys(glyphs).length,...(filled.length?{filledFrom:{file:face.fill.file,postscriptName:fill.postscriptName,glyphs:filled.join('')}}:{}),...(missing.length?{composedInEngine:missing.join('')}:{})};}
// Hershey script: single centreline strokes (baseline at y 22, cap height 21 units), rescaled to the same 1000 em.
const hershey=JSON.parse(fs.readFileSync(require.resolve('hersheytext/hersheytext.json')));
for(const [key,src,name] of [['script','scripts','Hershey Script 1-stroke']]){const glyphs={};
 for(const ch of LATIN){const c=hershey[src].chars[ch.charCodeAt(0)-33];if(!c||!c.d)continue;const p=svgpath(c.d).translate(0,-22).scale(1000/30).round(0);
  const xs=[],ys=[];p.iterate(s=>{for(let i=1;i<s.length;i+=2){xs.push(s[i]);ys.push(s[i+1]);}});let len=0,last=null;p.iterate(s=>{if(s[0]==='L'&&last)len+=Math.hypot(s[1]-last[0],s[2]-last[1]);last=[s[1],s[2]];});len=Math.round(len);
  glyphs[ch]=[p.rel().toString(),Math.round(c.o*2*1000/30),Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys),len];}
 FONTS[key]={kind:'line',role:'mark',em:1000,ascent:690,descent:-310,glyphs};provenance[key]={file:'geometry-bench/node_modules/hersheytext/hersheytext.json',family:name,licence:'Hershey fonts (public, U.S. National Bureau of Standards); JSON port MIT (hersheytext 2.0.0)',sha256:sha(require.resolve('hersheytext/hersheytext.json')),glyphs:Object.keys(glyphs).length,note:'Centreline strokes; the last field is stroke length, not ink area.'};}
fs.writeFileSync(path.join(dir,'fonts.mjs'),'// Bounded glyph outlines (relative SVG paths on a 1000 em, y down): [d, advance, x0, y0, x1, y1, ink area or stroke length].\n// Font binaries are not embedded; see font-provenance.json. Local study only.\nexport const FONTS='+JSON.stringify(FONTS)+';\n');
fs.writeFileSync(path.join(dir,'font-provenance.json'),JSON.stringify(provenance,null,2));
console.log(Object.entries(FONTS).map(([k,f])=>`${k}: ${Object.keys(f.glyphs).length}`).join(', '),`— ${(fs.statSync(path.join(dir,'fonts.mjs')).size/1024).toFixed(0)} KB`);
console.log(Object.entries(provenance).filter(([,p])=>p.composedInEngine||p.filledFrom).map(([k,p])=>`${k}: composed ${p.composedInEngine??'-'} filled ${p.filledFrom?.glyphs??'-'}`).join('\n'));
