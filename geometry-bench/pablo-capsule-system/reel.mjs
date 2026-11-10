/* A wordless electro reel of capsule-type posters, cut to one 8-bar phrase at 128 BPM.
 * Portrait 4:5 and big, condensed type so it reads on a phone.
 * Writes PNG frames plus a timing file; reel.py encodes them.
 *
 *   node reel.mjs [--width 1440]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {formatHex,wcagContrast,clampChroma,converter} from 'culori';
import {colornames} from 'color-name-list';
import {generateColorRamp} from 'rampensau';
import {Poline,positionFunctions} from 'poline';
import {ColorPaletteGenerator} from 'pro-color-harmonies';
import {render,advanceOf} from './engine.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/pablo-capsule-study-v1/reel');
const W=1440,H=1800,M=56,size=Number(process.argv[process.argv.indexOf('--width')+1])||W;
fs.rmSync(path.join(out,'frames'),{recursive:true,force:true});fs.mkdirSync(path.join(out,'frames'),{recursive:true});

// ---- Colour: named neons and grounds from meodai's colour names -------------
const toOklch=converter('oklch'),named=new Map(colornames.map(c=>[c.name,c.hex]));
const NEONS=['Volt','Acid Green','Neon Green','Electric Blue','Hyperlink Blue','Electric Indigo','Neon Purple','Electric Orchid','Technolust','Neon Pink','Cyberpink','Red Light Neon','Toxic Orange','High Voltage'].filter(n=>named.has(n)).map(name=>({name,hex:named.get(name),...toOklch(named.get(name))}));
const DARK=['Binary Black','Back in Black','Benthic Black','Abyssopelagic Water'].map(n=>named.get(n)),SILVER=named.get('Artemis Silver')??'#ddddee';
const hueGap=(a,b)=>Math.abs((((a-b)%360)+540)%360-180),nearest=h=>NEONS.reduce((best,c)=>hueGap(c.h,h)<hueGap(best.h,h)?c:best);
const hex=c=>formatHex(clampChroma({mode:'oklch',...c,h:((c.h%360)+360)%360},'oklch'));
// Lift or drop a colour's lightness until it reads against its ground (WCAG ratio).
function readable(color,ground,ratio=4.5){
 let c=toOklch(color);const up=toOklch(ground).l<.5;
 for(let i=0;i<40&&wcagContrast(hex(c),ground)<ratio;i++)c={...c,l:Math.max(.05,Math.min(.98,c.l+(up?.03:-.03)))};
 return hex(c);
}
const inkFor=ground=>wcagContrast(DARK[0],ground)>=wcagContrast(SILVER,ground)?DARK[0]:SILVER;
// One phrase of 32 beats walks the neon wheel (RampenSau hue cycle, snapped to named neons);
// each beat's partner comes from a complementary harmony (pro-color-harmonies, OKLCH).
const BEATS=32,hues=generateColorRamp({total:BEATS,hStart:123,hCycles:1,sRange:[1,1],lRange:[.5,.5]}).map(c=>c[0]);
const palette=beat=>{
 const neon=nearest(hues[((beat%BEATS)+BEATS)%BEATS]),dark=DARK[Math.floor(beat/4)%DARK.length];
 const partner=nearest(ColorPaletteGenerator.generate({l:neon.l,c:neon.c,h:neon.h},'complementary',{style:'diamond'})[1].h);
 return {neon:readable(neon.hex,dark),accent:readable(partner.hex,dark),dark,silver:SILVER};
};

// ---- Time: 128 BPM, frame durations rounded to GIF centiseconds without drift -------
const BEAT=60000/128,frames=[];let clock=0;
const at=(beats,stage,layers)=>{const start=Math.round(clock/10)*10;clock+=beats*BEAT;frames.push({stage,layers,ms:Math.round(clock/10)*10-start});};

// ---- Drawing --------------------------------------------------------------
const strip=svg=>svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>.*?<\/title><desc>.*?<\/desc>/,'');
// A type block without its paper: just ink, so blocks can sit on any ground or each other.
// resvg aborts on duplicate mask ids and on masks with nothing to draw, so each block gets
// its own ids and glyphs wholly off the frame are skipped.
let blocks=0;
function type(text,x,y,w,h,ink,{layout='rows',fit='fill',family='incised',params={},margin=0,stage=4,paper=null}={}){
 const r=render({text,layout,fit,family,params,stage,colors:[paper??'#000000',ink]},{width:w,height:h,margin},{x:-x+1,y:-y+1,width:W-2,height:H-2}),u=`b${blocks++}`;
 let body=(paper?strip(r.svg):strip(r.svg).replace(/^<rect [^>]*\/>/,'')).replace(/(id="|url\(#)(p[0-9a-z]+)-/g,`$1$2${u}-`);
 // Construction drawings get phone-weight lines.
 if(stage<=2)body=body.replace(/stroke-width="([\d.]+)"/g,(m,v)=>`stroke-width="${(+v*3.2).toFixed(2)}"`).replace(/ opacity="\.45"/g,' opacity=".8"');
 return `<g transform="translate(${x} ${y})">${body}</g>`;
}
const box=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const natural=(text,em,tracking=.055)=>em*([...text].reduce((s,ch)=>s+advanceOf(ch),0)+(text.length-1)*tracking);
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const condensed={width:.62},RULE=8;

const HEADS=['acid/house','all/night','b2b','303','rave','sound/system','after/hours','open/air','909','bass/drop','808','neubad','pablo/nouvelle','dance','loop/loop','warm/up'];
const SHORT=['303','rave','acid','909','bass','808','drop','b2b'];
// Lineup posters: three grids with one huge headline, cut on eighth notes; light and dark
// swap every half bar.
function lineup(k,beat){
 const p=palette(beat),dark=Math.floor(beat/2)%2===0,bg=dark?p.dark:p.neon,ink=dark?p.neon:inkFor(p.neon),accent=dark?p.accent:ink,head=HEADS[k%HEADS.length];
 let s=box(0,0,W,H,bg);const cw=W-2*M;
 if(k%3===0){
  // Headline on top, a 2 × 2 information grid below.
  s+=type(head,M,M,cw,1060,ink,{params:condensed})+box(M,M+1100,cw,RULE,ink);
  // A clear gutter and divider so neighbouring cells never read as one word on a phone.
  const gutter=120,cell=(cw-gutter)/2,top=M+1150;s+=box(M+cell+gutter/2-RULE/2,top,RULE,H-M-top,ink);
  [['2.12',ink],['23:00',accent],['live',ink],['b2b',ink]].forEach(([t,c],i)=>{s+=type(t,M+(i%2)*(cell+gutter),top+Math.floor(i/2)*300,cell,250,c,{params:condensed});});
 }else if(k%3===1){
  // Headline as tall columns; the time runs up the side.
  s+=type(head,M,M,cw-330,H-2*M,ink,{layout:'up',params:{width:.8}})+box(W-M-300,M,RULE,H-2*M,ink);
  s+=type('23:00—06:00',W-M-270,M,270,H-2*M,accent,{layout:'up'});
 }else{
  // Giant, condensed and cropped: a short word runs off both edges.
  s+=type(SHORT[k%8],-240,300,W+480,1200,ink,{params:{width:.6}});
  s+=type('live * b2b',M,M,cw,210,accent)+box(M,H-M-250,cw,RULE,ink)+type('all night',M,H-M-210,cw,210,ink);
 }
 return {stage:bg,layers:[s]};
}
// Tickers: four strips scroll in alternating directions, one unit per beat.
function tickers(f,n,beat){
 const p=palette(beat),units=['acid +','all night *','b2b +','128 bpm *'],h=H/4;let s='';
 units.forEach((unit,i)=>{
  const inverted=i%2===1,bg=inverted?(i===3?p.accent:p.neon):p.dark,ink=inverted?inkFor(bg):(i===2?p.accent:p.neon),em=h-56,len=natural(unit,em),period=len+em*(.48+.11);
  const shift=((f/n)*4*period*(i%2?.5:1))*(i%2?-1:1),start=-period+(((shift%period)+period)%period);let row='';
  for(let x=start;x<W;x+=period)if(x+len>1)row+=type(unit,x,i*h+28,len,em,ink,{fit:'even'});
  s+=box(0,i*h,W,h,bg)+row;
 });
 return {stage:p.dark,layers:[s]};
}
// Flex: a giant two-line word on every beat while its construction keeps moving.
function flex(f,n,beat){
 const p=palette(beat),t=f/n,tau=Math.PI*2,b=Math.min(3,Math.floor(4*t)),words=['ac/id','ra/ve','ba/ss','dr/op'];
 const invert=b===2,bg=invert?p.neon:p.dark,ink=invert?inkFor(p.neon):p.neon,family=['incised','twin','offset','incised'][b];
 const params={square:.5+.48*Math.sin(tau*t*2),stem:.5+.12*Math.sin(tau*t*3+1),bridge:Math.max(0,.09+.09*Math.sin(tau*t*2)),offset:.04*Math.abs(Math.sin(tau*t*4)),seam:.022};
 return {stage:bg,layers:[box(0,0,W,H,bg)+type(words[b],M,M,W-2*M,H-2*M,ink,{family,params})]};
}
// Campaign formats: story, poster and billboard share one word.
const FORMATS=(()=>{const top=1000,gap=40,story=top*9/16,poster=top/Math.SQRT2,x0=(W-(story+poster+gap))/2,bw=story+poster+gap,bh=bw/3,y0=(H-(top+gap+bh))/2;
 return [[x0,y0,story,top],[x0+story+gap,y0,poster,top],[x0,y0+top+gap,bw,bh]];})();
function formats(k,beat){
 const p=palette(beat),word=SHORT[k%8];let s=box(0,0,W,H,p.dark);
 FORMATS.forEach(([x,y,w,h],i)=>{
  // Words change on eighths; papers rotate once per beat so large areas never strobe.
  const paper=[p.neon,p.silver,p.accent][(i+Math.floor(k/2))%3],ink=inkFor(paper);
  s+=type(word,x,y,w,h,ink,{layout:w/h<.9?'up':'rows',paper,margin:Math.min(w,h)*.08,params:condensed});
 });
 return {stage:p.dark,layers:[s]};
}
// Build-up and drop: guides, then parts, then solid bodies, then the cut letters on neon.
function buildup(q,beat){
 const p=palette(beat),stage=Math.min(4,1+Math.floor(q/4)),drop=stage===4,bg=drop?p.neon:p.dark,ink=drop?inkFor(p.neon):p.neon;
 const params={...condensed,square:.15+.06*q,stem:.4+.012*q,bridge:.09,seam:.022};
 return {stage:bg,layers:[box(0,0,W,H,bg)+type('bass/drop',M,M,W-2*M,H-2*M,ink,{stage,params})]};
}
// Format morph: one poster flows from billboard to story and opens out to the full frame.
function morph(f,n,beat,ramp){
 const keys=[3,16/9,1,1/Math.SQRT2,9/16,W/H],seg=(keys.length-1)*f/n,i=Math.min(keys.length-2,Math.floor(seg)),e=ease(seg-i);
 const ratio=Math.exp(Math.log(keys[i])+(Math.log(keys[i+1])-Math.log(keys[i]))*e),grow=.82+.18*Math.pow(f/n,3);
 const w=Math.min(W*grow,H*grow*ratio),h=w/ratio,x=(W-w)/2,y=(H-h)/2;
 const glide=ramp[Math.min(ramp.length-1,Math.round((f/n)*(ramp.length-1)))],stage=formatHex({mode:'hsl',h:glide[0],s:glide[1],l:glide[2]});
 const p=palette(beat),paper=p.neon,ink=inkFor(paper);
 return {stage,layers:[box(0,0,W,H,stage)+type('all/night',x,y,w,h,ink,{layout:ratio>1.15?'rows':'up',paper,margin:Math.min(w,h)*.06,params:condensed})]};
}

// ---- The phrase: eight bars ----------------------------------------------------
let beat=0;
for(let k=0;k<16;k++,beat+=.5){const f=lineup(k,Math.floor(beat));at(.5,f.stage,f.layers);}          // bars 1–2
for(let f=0,n=47;f<n;f++){const g=tickers(f,n,Math.floor(beat+4*f/n));at(4/n,g.stage,g.layers);}beat+=4; // bar 3
for(let f=0,n=47;f<n;f++){const g=flex(f,n,Math.floor(beat+4*f/n));at(4/n,g.stage,g.layers);}beat+=4;    // bar 4
for(let k=0;k<8;k++,beat+=.5){const g=formats(k,Math.floor(beat));at(.5,g.stage,g.layers);}       // bar 5
for(let q=0;q<16;q++,beat+=.25){const g=buildup(q,Math.floor(beat));at(.25,g.stage,g.layers);}    // bar 6
{const ramp=new Poline({anchorColors:[[265,.9,.12],[300,.85,.16],[180,.9,.1]],numPoints:24,positionFunctionX:positionFunctions.sinusoidalPosition}).colors;
 for(let f=0,n=47;f<n;f++){const g=morph(f,n,Math.floor(beat+4*f/n),ramp);at(4/n,g.stage,g.layers);}beat+=4;}               // bar 7
for(let k=16;k<24;k++,beat+=.5){const f=lineup(k,Math.floor(beat));at(.5,f.stage,f.layers);}        // bar 8

// ---- Render ---------------------------------------------------------------
const timing=[];
frames.forEach((f,i)=>{
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${f.stage}"/>${f.layers.join('')}</svg>`;
 const name=`frame-${String(i).padStart(4,'0')}.png`;fs.writeFileSync(path.join(out,'frames',name),new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
 timing.push({file:name,ms:f.ms});if(i%25===0)process.stdout.write(`${i}/${frames.length} `);
});
fs.writeFileSync(path.join(out,'frames','timing.json'),JSON.stringify(timing));
console.log(`\nRendered ${frames.length} frames, ${(timing.reduce((s,t)=>s+t.ms,0)/1000).toFixed(2)} s at ${size}px wide.`);
