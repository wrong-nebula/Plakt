/* A wordless electro reel of PLOT letter slices, cut to one 8-bar phrase at 128 BPM.
 * Portrait 4:5 and giant type so it reads on a phone. The only words are the source poster's own copy.
 * Writes PNG frames plus a timing file; reel.py encodes them.
 *
 *   node reel.mjs [--width 1440]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg as ResvgBase} from '@resvg/resvg-js';
import {wcagContrast} from 'culori';
import {render,slices} from './engine.mjs';
import {pathData} from './kernel.mjs';
// Every SVG here is outlined paths, so skip resvg's system-font scan, which costs about a second per instance.
class Resvg extends ResvgBase{constructor(svg,options={}){super(svg,{...options,font:{loadSystemFonts:false}});}}

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/plot-slice-study-v1/reel');
const W=1440,H=1800,PAGE=[800,1000],K=W/PAGE[0],size=Number(process.argv[process.argv.indexOf('--width')+1])||W;
fs.rmSync(path.join(out,'frames'),{recursive:true,force:true});fs.mkdirSync(path.join(out,'frames'),{recursive:true});

// ---- Colour: neon inks on near-black grounds, one light ground for the drop ------------
const NEON={acid:'#c6f33c',signal:'#ff4b28',ice:'#a6e9ff',pink:'#ff4fb0',lilac:'#b9a8ff',volt:'#eaff2e'},NIGHT=['#0c0e0b','#0e0d0f','#0d1430','#140d24'];
for(const ink of Object.values(NEON))for(const ground of NIGHT)if(wcagContrast(ink,ground)<4.5)throw new Error(`${ink} on ${ground} is too faint for a phone`);

// ---- Time: 128 BPM, frame durations rounded to GIF centiseconds without drift ---------
const BEAT=60000/128,frames=[];let clock=0;
const at=(beats,ground,body)=>{const start=Math.round(clock/10)*10;clock+=beats*BEAT;frames.push({ground,body,ms:Math.round(clock/10)*10-start});};
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,pulse=t=>Math.exp(-5*t);

// ---- Drawing -------------------------------------------------------------------------
// Each frame places one 4:5 page of the engine, without its paper and scaffold, scaled to the frame;
// zoom crops giant type off the edges. Construction drawings get phone-weight lines.
let ids=0;
function page(state,{zoom=1,stage=3}={}){const r=render({format:'feed',scaffold:'none',...state,stage}),u=`f${ids++}`;
 let body=r.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>.*?<\/title><desc>.*?<\/desc>/,'').replace(/^<rect [^>]*\/>/,'').replace(/(id="|url\(#)(ps[0-9a-z]+)/g,`$1$2${u}`);
 if(stage<=2)body=body.replace(/stroke-width="([\d.]+)"/g,(m,v)=>`stroke-width="${(+v*7).toFixed(2)}"`).replace(/opacity="0?\.(32|5)"/g,'opacity=".85"');
 return `<g transform="translate(${W/2} ${H/2}) scale(${K*zoom}) translate(${-PAGE[0]/2} ${-PAGE[1]/2})">${body}</g>`;
}
const ground=c=>`<rect width="${W}" height="${H}" fill="${c}"/>`;

// Bar 1. Seven slice systems cut on eighth notes, one word, dark grounds throughout.
const SYSTEMS=['windows','shear','bowed','strata','saw','aperture','accordion','windows'],CYCLE=[NEON.acid,NEON.signal,NEON.ice,NEON.pink,NEON.lilac,NEON.volt,NEON.acid,NEON.signal];
function systems(k,beat){const g=NIGHT[beat%4],ink=CYCLE[k];return {ground:g,body:page({word:'Plot',family:SYSTEMS[k],colors:[g,ink],params:{rows:9}})};}
// Bar 2. The slice angle turns a quarter on every beat, settling on 0°, 90°, 180° and 270° as each beat lands.
function sweep(f,n){const t=4*f/n,b=Math.floor(t),slice=((90*(b+ease(t-b))+180)%360)-180;return {ground:NIGHT[0],body:page({word:'Plot',colors:[NIGHT[0],NEON.acid],params:{slice,rows:9}})};}
// Bar 3. Tickers: the reveal rows of one word slide like tickers, alternating direction, tiled across the page.
// Lowercase words reveal from the baseline here, so every row carries ink.
const TICK=slices({word:'Atlas',format:'feed',scaffold:'none',params:{rows:9,slice:180}});
function tickers(f,n){const t=f/n,ink=NEON.ice,g=NIGHT[2];let s='';
 for(const {row,pieces} of TICK.rows){const dir=row.step%2?-1:1,speed=row.step%2?1:2,dx=((dir*t*speed*PAGE[0])%PAGE[0]+PAGE[0])%PAGE[0];
  for(const k of [-1,0,1])s+=`<path d="${pathData(pieces,(x,y)=>[x+dx+k*PAGE[0],y+row.origin])}" fill="${ink}" fill-rule="evenodd"/>`;}
 return {ground:g,body:`<g transform="scale(${K})">${s}</g>`};
}
// Bar 4. Cut edges change on every beat while their depth hits on the beat and decays; cropped giant.
const EDGES=['wave','zigzag','steps','bowed'];
function edges(f,n){const t=4*f/n,b=Math.floor(t),bow=.12+.33*pulse(t-b),g=NIGHT[3];return {ground:g,body:page({word:'Lausanne',family:'custom',modules:{edge:EDGES[b]},colors:[g,NEON.pink],params:{rows:8,bow,period:.32,slice:180}},{zoom:1.32})};}
// Bar 5. The whole stack turns from upward-reading through level to downward-reading.
function turn(f,n){const t=f/n,g=NIGHT[1];return {ground:g,body:page({word:'Forum',family:'saw',colors:[g,NEON.signal],params:{turn:-90+180*ease(t),rows:8}})};}
// Bar 6. Build-up on sixteenths: windows, then outlines, then rows multiply; the drop flips to a light ground.
function buildup(q){const g=NIGHT[0];if(q<4)return {ground:g,body:page({word:'Plot',colors:[g,NEON.volt]},{stage:1})};if(q<8)return {ground:g,body:page({word:'Plot',colors:[g,NEON.volt]},{stage:2})};
 if(q<12)return {ground:g,body:page({word:'Plot',colors:[g,NEON.volt],params:{rows:5+2*(q-8)}})};return {ground:NEON.volt,body:page({word:'Plot',colors:[NEON.volt,NIGHT[0]],params:{rows:12}},{zoom:1.18})};}
// Bar 7. Accordion: every beat the windows open from the whole word compressed to plain cuts.
function accordion(f,n){const t=4*f/n,b=Math.floor(t),g=NIGHT[0];return {ground:g,body:page({word:'2019',family:'accordion',colors:[g,NEON.acid],params:{squash:.2+.8*pulse(t-b),rows:9}})};}
// Bar 8. One word explodes into interlocking strips over three beats, then snaps back to the source construction.
function strata(f,n){const t=f/n,g=NIGHT[1],e=ease(Math.min(1,t/.75));return t<.75?{ground:g,body:page({word:'Plot',family:'strata',colors:[g,NEON.signal],params:{rows:9,offset:.02+.3*e,gap:.6+1.1*e,bow:.12+.2*e}})}:{ground:NIGHT[0],body:page({word:'Plot',colors:[NIGHT[0],NEON.acid],params:{rows:9}})};}

// ---- The phrase: eight bars ----------------------------------------------------------
let beat=0;
for(let k=0;k<8;k++,beat+=.5){const f=systems(k,Math.floor(beat));at(.5,f.ground,f.body);}                         // bar 1
for(let f=0,n=47;f<n;f++){const g=sweep(f,n);at(4/n,g.ground,g.body);}beat+=4;                                         // bar 2
for(let f=0,n=47;f<n;f++){const g=tickers(f,n);at(4/n,g.ground,g.body);}beat+=4;                                       // bar 3
for(let f=0,n=47;f<n;f++){const g=edges(f,n);at(4/n,g.ground,g.body);}beat+=4;                                         // bar 4
for(let f=0,n=47;f<n;f++){const g=turn(f,n);at(4/n,g.ground,g.body);}beat+=4;                                          // bar 5
for(let q=0;q<16;q++,beat+=.25){const g=buildup(q);at(.25,g.ground,g.body);}                                           // bar 6
for(let f=0,n=47;f<n;f++){const g=accordion(f,n);at(4/n,g.ground,g.body);}beat+=4;                                     // bar 7
for(let f=0,n=40;f<n;f++){const g=strata(f,n);at(4/n,g.ground,g.body);}beat+=4;                                        // bar 8

// ---- Render ----------------------------------------------------------------------------
const timing=[];
frames.forEach((f,i)=>{
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${ground(f.ground)}${f.body}</svg>`;
 const name=`frame-${String(i).padStart(4,'0')}.png`;fs.writeFileSync(path.join(out,'frames',name),new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
 timing.push({file:name,ms:f.ms});if(i%40===0)process.stdout.write(`${i}/${frames.length} `);
});
fs.writeFileSync(path.join(out,'frames','timing.json'),JSON.stringify(timing));
console.log(`\nRendered ${frames.length} frames, ${(timing.reduce((s,t)=>s+t.ms,0)/1000).toFixed(2)} s at ${size}px wide.`);
