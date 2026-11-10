/* A wordless reel of the PUNKT capsule system: one 8-bar phrase at 128 BPM,
 * 1440 × 1800 so it reads on a phone. Every poster is a live render of the
 * engine with new copy, family, geometry and colour.
 *
 * Colour is built from meodai's tools: named colours (color-name-list) as
 * anchors, polar glides between them (poline), tinted darks and hue walks
 * (rampensau) and a tonal ramp (fettepalette). Each bar is one chapter of
 * colour theory: analogous glide, acid ramp, warm build, triad, monochrome,
 * complements, then a recap of all chapters. culori keeps ink readable.
 *
 * Writes PNG frames plus timing.json; reel.py encodes the GIF and MP4.
 *   node reel.mjs [--width 1440]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {formatHex,wcagContrast,clampChroma,converter} from 'culori';
import {colornames} from 'color-name-list';
import {Poline,positionFunctions} from 'poline';
import {generateColorRamp} from 'rampensau';
import {generateRandomColorRamp} from 'fettepalette';
import {render} from './engine.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/punkt-capsule-study-v2/reel');
const W=1440,H=1800,size=Number(process.argv[process.argv.indexOf('--width')+1])||W;
fs.rmSync(path.join(out,'frames'),{recursive:true,force:true});fs.mkdirSync(path.join(out,'frames'),{recursive:true});

// ---- Colour ------------------------------------------------------------------
const toOklch=converter('oklch'),toHsl=converter('hsl'),named=new Map(colornames.map(c=>[c.name,c.hex]));
const N=name=>{const hex=named.get(name);if(!hex)throw new Error(`No colour named ${name}`);return hex;};
const BLACK=N('Binary Black'),SILVER=N('Artemis Silver');
const hex=c=>formatHex(clampChroma({mode:'oklch',...c,h:(((c.h??0)%360)+360)%360},'oklch'));
const fromHsl=([h,s,l])=>formatHex({mode:'hsl',h,s,l});
// Move a colour's lightness until it reads against its ground (WCAG ratio).
function readable(color,ground,ratio=4.5){
 let c=toOklch(color);const up=toOklch(ground).l<.5;
 for(let i=0;i<50&&wcagContrast(hex(c),ground)<ratio;i++)c={...c,l:Math.max(.04,Math.min(.98,c.l+(up?.025:-.025)))};
 return hex(c);
}
const inkOn=ground=>wcagContrast(BLACK,ground)>=wcagContrast(SILVER,ground)?BLACK:SILVER;
// A poline glide through named anchors, resampled to `count` steps.
function glide(names,count){
 const anchors=names.map(n=>{const c=toHsl(N(n));return [c.h??0,c.s,c.l];}),s=positionFunctions.sinusoidalPosition;
 const colors=new Poline({anchorColors:anchors,numPoints:Math.max(2,Math.ceil(count/(names.length-1))),positionFunctionX:s,positionFunctionY:s,positionFunctionZ:s}).colors;
 return Array.from({length:count},(_,i)=>fromHsl(colors[Math.round(i*(colors.length-1)/Math.max(1,count-1))]));
}
// Tinted near-blacks walking a little way round the wheel (rampensau).
const darks=(count,hStart,hCycles=.12)=>generateColorRamp({total:count,hStart,hCycles,sRange:[.55,.75],lRange:[.06,.13]}).map(fromHsl);
// Complement of a colour, darkened until a neon reads on it.
const deep=(name,ink)=>readable(N(name),ink,5);

// ---- Time: 128 BPM, durations rounded to GIF centiseconds without drift ---------
const BEAT=60000/128,frames=[];let clock=0;
const at=(beats,svg)=>{const start=Math.round(clock/10)*10;clock+=beats*BEAT;frames.push({svg,ms:Math.round(clock/10)*10-start});};

// ---- Drawing -----------------------------------------------------------------------
const box=(fill,x=0,y=0,w=W,h=H)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const strip=svg=>svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>.*?<\/title><desc>.*?<\/desc>/,'');
// Posters keep only their copy: PUNKT keeps its three dates (in the accent),
// word posters lose their captions. Construction lines get phone weight.
function poster(input,accent){
 const r=render(input);let n=0;
 const body=strip(r.svg)
  .replace(/<g fill="[^"]*"( transform="[^"]*">.*?<\/g>)/g,(m,rest)=>r.features.layout==='source-proportion'&&n++<3?`<g fill="${accent??input.colors[1]}"${rest}`:'')
  .replace(/stroke-width="\.9"/g,'stroke-width="4.5"');
 return {body,w:r.width,h:r.height};
}
const place=(p,x,y,s)=>`<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(4)})">${p.body}</g>`;
// Whole poster on a coloured wall; full-width bleed cropped top and bottom;
// a camera centred on poster point (cx, cy).
const framed=(p,ground,pad=.86)=>{const s=Math.min(W*pad/p.w,H*pad/p.h);return box(ground)+place(p,(W-p.w*s)/2,(H-p.h*s)/2,s);};
const bleed=(p,align=.5)=>{const s=W/p.w;return place(p,0,-(p.h*s-H)*align,s);};
const camera=(p,cx,cy,s)=>place(p,W/2-cx*s,H/2-cy*s,s);

const lerp=(a,b,t)=>a+(b-a)*t,ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,wave=t=>.5-.5*Math.cos(2*Math.PI*t);
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const random=rng(1440);
const vary=()=>({roundness:lerp(.14,.5,random()),seam:lerp(2.2,8.5,random()),fusion:lerp(.25,1,random()),slot:lerp(.8,1.18,random())});
const FAMILIES=['joined','fluted','waisted'];
const WORDS=['TYPE','CODE','LOOP','JOIN','BOLD','FLUX','SANS','BYTE','CAPS','PILL','TUBE','DOTS','UNIT','BEAT','FLOW','BLOB'];

// ---- Bars 1–2 · Analogous: violet glides to cyan, one new poster per eighth ------
const A={inks:glide(['Electric Violet','Electric Indigo','Electric Blue'],16),papers:darks(16,255),accent:N('Volt')};
function outputs(k){
 const invert=Math.floor(k/4)%2===1,paper0=A.papers[k],ink0=readable(A.inks[k],paper0);
 const [paper,ink]=invert?[ink0,inkOn(ink0)]:[paper0,ink0],accent=invert?ink:readable(A.accent,paper);
 const p=poster({family:FAMILIES[[0,0,1,0,2,0,1,2][k%8]],params:vary(),colors:[paper,ink]},accent);
 // Downbeats show the whole poster on a wall of its complement; offbeats crop in.
 if(k%2===0)return framed(p,invert?paper0:A.accent);
 return k%4===1?bleed(p,0):bleed(p,1);
}
// ---- Bar 3 · Acid ramp: the geometry breathes while lime glides to spring green ---
const B={inks:glide(['Volt','Acid Green','Spring Green'],47),papers:darks(47,150,.08)};
function breathe(f,n){
 const t=f/n,paper=B.papers[f],ink=readable(B.inks[f],paper);
 const params={roundness:lerp(.08,.5,wave(t)),seam:lerp(1.5,9,wave(t*2)),fusion:lerp(0,1,ease(Math.min(1,t*1.4))),slot:lerp(.78,1.2,wave(t*1.5))};
 // A slow push towards the N counter while the geometry breathes.
 return box(paper)+camera(poster({family:'joined',params,colors:[paper,ink]},ink),lerp(334,360,t),lerp(500,520,t),lerp(1440/668,2.7,ease(t)));
}
// ---- Bar 4 · Warm build: guides, bodies, counters, joins — then the drop ----------
const C={inks:[N('Toxic Orange'),N('Hot Coral'),N('Red Light Neon'),N('Toxic Orange')],paper:N('Dark Matter'),accent:N('Electric Cyan')};
function build(q){
 const b=Math.floor(q/4),stage=q%4+1,drop=stage===4,ink0=readable(C.inks[b],C.paper);
 const paper=drop?ink0:C.paper,ink=drop?inkOn(ink0):ink0;
 const p=poster({family:FAMILIES[b%3],stage,params:{roundness:.3+.06*b,seam:3+b,fusion:.8},colors:[paper,ink]},drop?ink:readable(C.accent,paper));
 return b===3&&drop?bleed(p,.35):framed(p,drop?C.paper:paper,.9);
}
// ---- Bar 5 · Triad: a wall of outputs, 2 × 2 then 3 × 3 -------------------------
const D={triad:['Hot Magenta','Electric Cyan','Volt'].map(N),grounds:[N('Back in Black'),N('Benthic Black'),N('Binary Black')]};
function wall(k){
 const n=k<4?2:3,gap=k<4?28:22,cw=(W-2*48-(n-1)*gap)/n,ch=(H-2*48-(n-1)*gap)/n;let s=box(BLACK);
 for(let i=0;i<n*n;i++){
  const hue=D.triad[(i+k)%3],dark=D.grounds[(i+2*k)%3],solid=(i+k)%2===0;
  const [paper,ink]=solid?[hue,inkOn(hue)]:[dark,readable(hue,dark)];
  const text=i===n*n-1-(k%n)?'PUNKT':WORDS[(i*5+k*3)%WORDS.length];
  const p=poster({text,family:FAMILIES[(i+k)%3],params:vary(),colors:[paper,ink]},ink),sc=Math.min(cw/p.w,ch/p.h);
  const x=48+(i%n)*(cw+gap)+(cw-p.w*sc)/2,y=48+Math.floor(i/n)*(ch+gap)+(ch-p.h*sc)/2;
  s+=box(paper,x,y,p.w*sc,p.h*sc)+place(p,x,y,sc);
 }
 return s;
}
// ---- Bar 6 · Monochrome: one hue family while the camera pulls out of a hairline ---
// fettepalette's ramp sets the hue walk (violet to magenta); lightness and chroma
// are held in OKLCH so the ink stays electric rather than drifting to pastel tints.
const E=generateRandomColorRamp({total:47,centerHue:282,hueCycle:.12,offsetTint:.06,offsetShade:.06,curveAccent:0,tintShadeHueShift:.02,curveMethod:'arc',offsetCurveModTint:.03,offsetCurveModShade:.03,minSaturationLight:[0,0],maxSaturationLight:[1,1],colorModel:'hsl'});
const mono=f=>{const h=E.base[f][0],paper=hex({l:.13+.04*f/46,c:.1,h:h-8});return {paper,ink:readable(hex({l:.66,c:.32,h:h+40}),paper,6)};};
function macro(f,n){
 const t=f/n,{paper,ink}=mono(f);
 const p=poster({family:t<.5?'joined':'waisted',params:{roundness:.46,seam:lerp(2.2,6.5,wave(t)),fusion:lerp(.5,1,t),slot:1},colors:[paper,ink]},ink);
 // From 4.6× on the N/T hairline turn out to the whole poster.
 const e=ease(t),s=Math.exp(lerp(Math.log(4.6),Math.log(1800/1000),e));
 return box(paper)+camera(p,lerp(600,334,e),lerp(612,500,e),s);
}
// ---- Bar 7 · Complements: a neon word on its complement, darkened to read -------
const F=[['Neon Pink','Spring Green'],['Ultramarine','Fluorescent Orange'],['Electric Orchid','Volt'],['Red Light Neon','Electric Cyan']];
function words(k){
 const [g,i]=F[Math.floor(k/2)%4],swap=k%2===1,ink=N(swap?g:i),paper=deep(swap?i:g,ink);
 return bleed(poster({text:['TYPE','CODE','LOOP','BOLD','JOIN','FLUX','SANS','BYTE'][k],family:FAMILIES[k%3],params:vary(),colors:[paper,ink]}),k%2?.2:.8);
}
// ---- Bar 8 · Recap: every chapter on sixteenths, landing where the loop starts ----
function recap(q){
 const chapters=[[A.papers[0],A.inks[0]],[B.papers[20],B.inks[20]],[C.paper,C.inks[0]],[D.grounds[1],D.triad[0]],[mono(30).paper,mono(30).ink],[deep('Ultramarine',N('Fluorescent Orange')),N('Fluorescent Orange')],[deep('Electric Orchid',N('Volt')),N('Volt')],[A.papers[0],A.inks[0]]];
 const [p0,i0]=chapters[Math.min(7,Math.floor(q/2))],ink0=readable(i0,p0),invert=q%2===1&&q<14,[paper,ink]=invert?[ink0,inkOn(ink0)]:[p0,ink0];
 const p=poster({family:FAMILIES[q%3],params:q>=14?{}:vary(),colors:[paper,ink]},invert?ink:readable(A.accent,paper));
 return q>=14?bleed(p,.5):[framed(p,ink0),bleed(p,0),camera(p,334,330,2.6),bleed(p,1)][q%4];
}

// ---- The phrase ----------------------------------------------------------------------
for(let k=0;k<16;k++)at(.5,outputs(k));          // bars 1–2
for(let f=0;f<47;f++)at(4/47,breathe(f,47));     // bar 3
for(let q=0;q<16;q++)at(.25,build(q));           // bar 4
for(let k=0;k<8;k++)at(.5,wall(k));              // bar 5
for(let f=0;f<47;f++)at(4/47,macro(f,47));       // bar 6
for(let k=0;k<8;k++)at(.5,words(k));             // bar 7
for(let q=0;q<16;q++)at(.25,recap(q));           // bar 8

// ---- Render ------------------------------------------------------------------------
const timing=[];
frames.forEach((f,i)=>{
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${box(BLACK)}${f.svg}</svg>`;
 const name=`frame-${String(i).padStart(4,'0')}.png`;fs.writeFileSync(path.join(out,'frames',name),new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
 timing.push({file:name,ms:f.ms});if(i%25===0)process.stdout.write(`${i}/${frames.length} `);
});
fs.writeFileSync(path.join(out,'frames','timing.json'),JSON.stringify(timing));
console.log(`\nRendered ${frames.length} frames, ${(timing.reduce((s,t)=>s+t.ms,0)/1000).toFixed(2)} s at ${size}px wide.`);
