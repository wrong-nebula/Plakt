/* Glyph access for the prepared Hiragino outlines (fonts.mjs): character
 * classes, lazy decoding, vertical alternates, half-width digits, and paths
 * written through an affine matrix so every SVG carries plain outlines.
 * Font space: 1000 units per em, y up, ideographic em box x 0–1000, y −120–880.
 */
import {ALPH,CHARS,FACES,DATA} from './fonts.mjs';
export {CHARS,FACES};
export const ASC=880,DESC=-120,MID=380;
const ORDER=[...CHARS.kanji+CHARS.kana+CHARS.punct+CHARS.latin],INDEX=new Map(ORDER.map((c,i)=>[c,i])),LAT_AT=new Map([...CHARS.latin].map((c,i)=>[c,i]));
const SETS=Object.fromEntries(Object.entries(CHARS).map(([k,v])=>[k,new Set(v)]));
export const KANJI_COUNT=SETS.kanji.size;
// kanji · kana · punct (CJK punctuation and symbols, set upright) · latin (set in runs) · null (not prepared)
export const kindOf=ch=>SETS.kanji.has(ch)?'kanji':SETS.kana.has(ch)?'kana':SETS.punct.has(ch)?'punct':SETS.latin.has(ch)?'latin':null;
const VAL={};[...ALPH].forEach((c,i)=>VAL[c]=i);const COUNT={'.':2,',':2,';':6,':':4,'!':0},NAME={'.':'M',',':'L',';':'C',':':'Q'};
// Relative zigzag varints → absolute commands [['M',x,y],['C',x1,y1,x2,y2,x,y],…,['Z']].
export function decode(s){const out=[];let i=0,cmd='',x=0,y=0,sx=0,sy=0;
 const read=()=>{let z=0,shift=0,v;do{v=VAL[s[i++]];z+=(v&31)*2**shift;shift+=5;}while(v>=32);return z%2?-(z+1)/2:z/2;};
 while(i<s.length){const c=s[i];if(c in COUNT){cmd=c;i++;if(c==='!'){out.push(['Z']);x=sx;y=sy;continue;}}else if(cmd==='.')cmd=',';
  const args=[];let px=x,py=y;for(let k=0;k<COUNT[cmd];k+=2){px+=read();py+=read();args.push(px,py);}x=px;y=py;if(cmd==='.'){sx=x;sy=y;}out.push([NAME[cmd],...args]);}
 return out;}
const tables={};
function table(face){const d=DATA[face];if(!d)throw new Error('Unknown face '+face);return tables[face]??={g:d.g.split('~'),v:new Map([...d.vc].map((c,i)=>[c,i])),vs:d.v.split('~'),h:d.h.split('~'),a:d.a,cache:new Map()};}
// form: 'h' horizontal · 'v' vertical alternate where the font has one · 'hw' half-width digit
export function glyph(face,ch,form='h'){const t=table(face),key=form+ch;let g=t.cache.get(key);if(g)return g;let src,alt=false,adv=1000;
 if(form==='hw'){src=t.h['0123456789'.indexOf(ch)];adv=500;}
 else if(form==='v'&&t.v.has(ch)){src=t.vs[t.v.get(ch)];alt=true;}
 else{const i=INDEX.get(ch);if(i===undefined)throw new Error(`No outline for “${ch}”.`);src=t.g[i];if(LAT_AT.has(ch))adv=t.a[LAT_AT.get(ch)];}
 g={cmds:decode(src??''),adv,alt};t.cache.set(key,g);return g;}
export const hasVert=(face,ch)=>table(face).v.has(ch);
export const verticalForms=face=>[...table(face).v.keys()];
export const advance=(face,ch)=>LAT_AT.has(ch)?table(face).a[LAT_AT.get(ch)]:1000;
// Affine matrices [a b c d e f]: X = a·x + c·y + e, Y = b·x + d·y + f.
export const mul=([a,b,c,d,e,f],[A,B,C,D,E,F])=>[a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f];
export const rotateAbout=(deg,x,y)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c,s,-s,c,x-c*x+s*y,y-s*x-c*y];};
export function pathD(cmds,[a,b,c,d,e,f],digits=2){const k=10**digits,r=v=>Math.round(v*k)/k;let s='';
 for(const q of cmds){if(q[0]==='Z'){s+='Z';continue;}s+=q[0];for(let i=1;i<q.length;i+=2){const x=q[i],y=q[i+1];s+=(i>1?' ':'')+r(a*x+c*y+e)+' '+r(b*x+d*y+f);}}return s;}
// Bounds of on-curve and control points (a safe outer box).
export function bounds(cmds,[a,b,c,d,e,f]){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const q of cmds)for(let i=1;i<q.length;i+=2){const X=a*q[i]+c*q[i+1]+e,Y=b*q[i]+d*q[i+1]+f;if(X<x0)x0=X;if(X>x1)x1=X;if(Y<y0)y0=Y;if(Y>y1)y1=Y;}
 return x0===Infinity?null:[x0,y0,x1,y1];}
