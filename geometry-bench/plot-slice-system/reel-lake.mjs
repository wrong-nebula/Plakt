/* A reel of letter slices (9:16, or another frame with --frame, e.g. 1080x1080 for X) for LAKE SESSIONS (a concept brief from the app's library: Montreux Jazz Lab,
 * 16–18 July 2027), cut to the hits of a 128 BPM track, in the acid / night pair of the PLOT reel only.
 * Sixteen bars: slice motions between ten poster layouts, each shown once and held still (scaling a poster
 * re-sets its copy every frame, which makes the type jump). Poster copy is set afterwards by
 * output/contour-reels/v3/overlay.py, so each frame records its texts in plan.json.
 *
 *   node reel-lake.mjs --sync sync.json [--width 1080] [--frame 1080x1080 --out reel-lake-x]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg as ResvgBase} from '@resvg/resvg-js';
import {render,slices} from './engine.mjs';
import {pathData} from './kernel.mjs';
// Every SVG here is outlined paths, so skip resvg's system-font scan, which costs about a second per instance.
class Resvg extends ResvgBase{constructor(svg,options={}){super(svg,{...options,font:{loadSystemFonts:false}});}}

const arg=k=>process.argv[process.argv.indexOf(k)+1];
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/plot-slice-study-v1',process.argv.includes('--out')?arg('--out'):'reel-lake');
const SYNC=JSON.parse(fs.readFileSync(arg('--sync'),'utf8'));
const [W,H]=(process.argv.includes('--frame')?arg('--frame'):'1080x1920').split('x').map(Number),size=Number(process.argv.includes('--width')?arg('--width'):W);
fs.rmSync(path.join(out,'frames'),{recursive:true,force:true});fs.mkdirSync(path.join(out,'frames'),{recursive:true});

// ---- Colour: the reference pair and nothing else -----------------------------------------
const NIGHT='#0c0e0b',ACID='#c6f33c';
const pair=(invert=false)=>invert?[ACID,NIGHT]:[NIGHT,ACID];

// ---- Copy: the brief (concept programme at a real venue) and the venue's address ---------
const COPY={kind:'MUSIC FESTIVAL',city:'MONTREUX',title:'LAKE SESSIONS',subtitle:['Three evenings of jazz,','improvisation and new sounds'],
 dates:'16–18 Jul 2027',days:'Fri 16 · Sat 17 · Sun 18 July',time:'From 19:00',venue:'Montreux Jazz Lab',address:['2m2c · Avenue Claude-Nobs 5','1820 Montreux']};

// ---- Time: 128 BPM bars, cuts on the track's hits ----------------------------------------
const BEAT=60000/SYNC.bpm,STEP=BEAT/4,BAR=4*BEAT,placed=[];
const put=(ms,ground,body,texts=[])=>placed.push({ms,ground,body,texts});
const hit=(b,s)=>Math.max(0,b*BAR+s*STEP+(SYNC.offsetMs?.[b*16+s]??0));
function cuts(bar,every=2,strength=.5){
 const a=SYNC.accent.slice(bar*16,bar*16+16),top=Math.max(...a),steps=[0];
 for(let s=1;s<16;s++){const v=a[s],peak=v>=a[s-1]&&v>=(a[s+1]??0);if(peak&&(v>=strength||(v>=.8*top&&v>=.25))&&s-steps.at(-1)>=every)steps.push(s);}
 return steps;
}
// Motion over one bar at 25 fps; progress is warped by the hits so it surges on them.
function flow(bar,draw){
 const a=SYNC.accent.slice(bar*16,bar*16+16),w=a.map(v=>.35+v),cum=[0];w.forEach(v=>cum.push(cum.at(-1)+v));
 const n=Math.round(BAR/40);
 for(let i=0;i<n;i++){const x=i/n*16,k=Math.floor(x);draw(bar*BAR+i*BAR/n,(cum[k]+(x-k)*w[k])/cum[16],i);}
}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,pulse=t=>Math.exp(-5*t);

// ---- Drawing -------------------------------------------------------------------------------
const FORMAT={poster:[700,1000],feed:[800,1000],square:[1000,1000],story:[700,1244],landscape:[1600,900],banner:[1500,500]};
let ids=0;
// One engine page without its paper, scaled to width w at (x, y) in frame pixels; zoom crops it about its centre.
function page(state,x,y,w,{zoom=1,stage=3}={}){
 const r=render({format:'story',scaffold:'none',...state,stage}),u=`f${ids++}`,[pw,ph]=FORMAT[state.format??'story'],k=w/pw;
 let body=r.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>.*?<\/title><desc>.*?<\/desc>/,'').replace(/^<rect [^>]*\/>/,'').replace(/(id="|url\(#)(ps[0-9a-z]+)/g,`$1$2${u}`);
 if(stage<=2)body=body.replace(/stroke-width="([\d.]+)"/g,(m,v)=>`stroke-width="${(+v*7).toFixed(2)}"`).replace(/opacity="0?\.(32|5)"/g,'opacity=".85"');
 return `<g transform="translate(${x+w/2} ${y+ph*k/2}) scale(${k*zoom}) translate(${-pw/2} ${-ph/2})">${body}</g>`;
}
// Full-frame motions lay the word out on the engine format of the frame's shape.
const FULL=H/W>1.5?'story':H/W>.75?'square':'landscape';
const full=(state,opts)=>page({format:FULL,...state},0,0,W,opts);
const box=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;

// ---- Posters: the source poster's 7:10 sheet, whole, on a wall of the other colour -----------
// Layouts work on a 700 × 1000 grid; Sheet maps them into the frame and collects the copy.
const PH=Math.min(Math.round(W*.84*10/7),Math.round(H*.9)),PW=Math.round(PH*.7),PX=(W-PW)/2,PY=(H-PH)/2,PS=PW/700;
class Sheet{
 constructor(invert){[this.paper,this.ink]=pair(invert);this.body=box(0,0,W,H,this.ink)+box(PX,PY,PW,PH,this.paper);this.texts=[];}
 word(state,x,y,w,opts){this.body+=page({...state,colors:[this.paper,this.ink]},PX+x*PS,PY+y*PS,w*PS,opts);}
 fill(x,y,w,h,ink=true){this.body+=box(PX+x*PS,PY+y*PS,w*PS,h*PS,ink?this.ink:this.paper);}
 rule(x,y,w){this.fill(x,y,w,2);}
 text(text,x,y,s,{weight='Medium',family='grotesk',anchor='la',paper=false}={}){this.texts.push({text,x:PX+x*PS,y:PY+y*PS,size:s*PS,weight,family,anchor,color:paper?this.paper:this.ink});}
 lines(lines,x,y,s,lead,o){lines.forEach((l,i)=>this.text(l,x,y+i*lead,s,o));}
 head(y=34){this.text(COPY.kind,30,y,17,{weight:'SemiBold'});this.text(COPY.city,670,y,17,{weight:'SemiBold',anchor:'ra'});this.rule(30,y+30,640);}
 venue(x,y,s=16,lead=21,o={}){this.text(COPY.venue,x,y,s,{weight:'SemiBold',...o});this.lines(COPY.address,x,y+lead,s,lead,o);}
}
const L={
 stack(p){p.head();p.word({word:'Lake / Sessions',format:'feed',params:{rows:9}},30,84,640);
  p.rule(30,890,640);p.text(COPY.dates,30,902,34,{weight:'Bold'});p.text(COPY.time,30,950,16);p.venue(400,902);},
 column(p){p.word({word:'Sessions',format:'story',params:{turn:90,rows:9}},20,20,380);
  p.text(COPY.kind,430,34,15,{weight:'SemiBold'});p.text(COPY.title,430,62,30,{weight:'Bold'});p.lines(COPY.subtitle,430,110,15,20);
  p.rule(430,170,240);p.lines(['Fri 16 July','Sat 17 July','Sun 18 July'],430,186,22,30,{weight:'SemiBold'});p.text(COPY.time,430,282,15);
  p.text('16–18.07',30,735,96,{weight:'Bold'});p.rule(30,880,640);p.venue(30,898);p.text('2027',670,898,16,{anchor:'ra',family:'plex'});},
 header(p){p.fill(0,0,700,300);p.text(COPY.kind,30,30,17,{weight:'SemiBold',paper:true});p.text(COPY.title,30,74,64,{weight:'Bold',paper:true});
  p.lines(COPY.subtitle,30,170,22,28,{paper:true});p.text(COPY.dates,670,250,22,{weight:'SemiBold',anchor:'ra',paper:true});
  p.word({word:'Lake',format:'square',params:{rows:11,slice:180}},70,330,560);p.rule(30,910,640);p.text(COPY.time,30,926,16);p.venue(400,926);},
 wipe(p){p.head();p.word({word:'Lake / Sessions',format:'feed',params:{slice:90,rows:6}},30,84,640);
  p.rule(30,890,640);p.text(COPY.days,30,904,19,{weight:'SemiBold'});p.text(COPY.time,30,934,16);p.venue(400,904);},
 programme(p){p.head();p.word({word:'Lake',format:'square',family:'bowed',params:{rows:12}},30,80,640);
  ['Fri 16 July','Sat 17 July','Sun 18 July'].forEach((d,i)=>{p.rule(30,735+i*52,640);p.text(d,30,747+i*52,24,{weight:'SemiBold'});p.text(COPY.time,670,750+i*52,16,{anchor:'ra'});});
  p.rule(30,891,640);p.venue(30,905);p.text(COPY.title,670,905,16,{weight:'SemiBold',anchor:'ra'});},
 dates(p){p.text(COPY.title,30,34,46,{weight:'Bold'});p.lines(COPY.subtitle,30,96,18,24);
  p.word({word:'16-18 / 07.27',format:'feed',params:{rows:7}},70,180,560);p.rule(30,915,640);p.text(COPY.time,30,930,16);p.venue(400,930,14,18);},
 baseline(p){p.text(COPY.kind,30,34,17,{weight:'SemiBold'});p.lines(COPY.subtitle,30,80,40,48,{weight:'Medium'});p.text(COPY.dates,30,190,26,{weight:'Bold'});
  p.word({word:'Sessions',format:'landscape',params:{slice:180,rows:10}},70,276,560);p.word({word:'Sessions',format:'landscape',family:'bowed',params:{slice:180,rows:10}},70,586,560);
  p.rule(30,912,640);p.venue(30,926,14,18);p.text(COPY.time,670,926,14,{anchor:'ra'});},
 aperture(p){p.head();p.word({word:'Lake',format:'square',family:'aperture',params:{rows:11}},30,90,640);
  p.text(COPY.title,350,760,44,{weight:'Bold',anchor:'ma'});p.text(COPY.subtitle.join(' '),350,822,16,{anchor:'ma'});
  p.rule(30,880,640);p.text(COPY.dates,30,896,22,{weight:'SemiBold'});p.text(COPY.time,30,930,14);p.venue(400,896,14,18);},
 repeat(p){p.head();['windows','shear','bowed','saw'].forEach((f,i)=>p.word({word:'Lake',format:'banner',family:f,params:{rows:7}},30,80+i*196,640));
  p.rule(30,890,640);p.text(COPY.dates,30,902,30,{weight:'Bold'});p.text(COPY.time,30,946,14);p.venue(400,902,14,18);},
 minimal(p){p.word({word:'Lake',format:'square',params:{rows:7}},30,30,200);p.text(COPY.kind,670,34,15,{weight:'SemiBold',anchor:'ra'});
  p.text('16–18',670,640,120,{weight:'Bold',anchor:'ra'});p.text('July 2027',670,790,40,{weight:'Medium',anchor:'ra'});
  p.rule(30,880,640);p.text(COPY.title,30,896,16,{weight:'SemiBold'});p.text(COPY.time,30,920,14);p.venue(400,896,14,18);},
};
const ORDER=['stack','column','header','wipe','programme','dates','baseline','aperture','repeat','minimal'];
function poster(k){const p=new Sheet(k%2===1);L[ORDER[k]](p);return [p.ink,p.body,p.texts];}

// ---- The sixteen bars --------------------------------------------------------------------------
const SYSTEMS=['windows','shear','bowed','strata','saw','aperture','accordion'];
// 1 · Hook: Lake through the slice systems on the hits, the pair flipping on every beat.
cuts(0,2,.3).forEach((s,n)=>{const [g,i]=pair(Math.floor(s/4)%2===1);put(hit(0,s),g,full({word:'Lake',family:SYSTEMS[n%7],colors:[g,i],params:{rows:9}}));});
// 2 · Two posters, one per half bar.
put(hit(1,0),...poster(0));put(hit(1,8),...poster(1));
// 3 · The slice angle turns a quarter on every beat and settles as the beat lands.
flow(2,(ms,t)=>{const b=Math.floor(4*t),slice=((90*(b+ease(4*t-b))+180)%360)-180;put(ms,NIGHT,full({word:'Sessions',colors:pair(),params:{slice,rows:9}}));});
// 4 · Two posters.
put(hit(3,0),...poster(2));put(hit(3,8),...poster(3));
// 5 · Peak: rows multiply on the sixteenths, the pair flipping on each beat.
for(let s=0;s<16;s++){const [g,i]=pair(Math.floor(s/4)%2===1);put(hit(4,s),g,full({word:'Lake',colors:[g,i],params:{rows:5+Math.round(s*7/15)}}));}
// 6 · Tickers: the reveal rows of Sessions slide in alternating directions.
const TICK=slices({word:'Sessions',format:FULL,scaffold:'none',params:{rows:9,slice:180}}),TW=FORMAT[FULL][0],TK=W/TW;
flow(5,(ms,t)=>{let s='';for(const {row,pieces} of TICK.rows){const dir=row.step%2?-1:1,speed=row.step%2?1:2,dx=((dir*t*speed*TW)%TW+TW)%TW;
 for(const k of [-1,0,1])s+=`<path d="${pathData(pieces,(x,y)=>[x+dx+k*TW,y+row.origin])}" fill="${ACID}" fill-rule="evenodd"/>`;}
 put(ms,NIGHT,`<g transform="scale(${TK})">${s}</g>`);});
// 7 · Two posters.
put(hit(6,0),...poster(4));put(hit(6,8),...poster(5));
// 8 · Lighter bar: Jazz cropped giant, its cut edge changing each beat while the depth hits and decays.
const EDGES=['wave','zigzag','steps','bowed'];
flow(7,(ms,t)=>{const b=Math.floor(4*t),bow=.12+.33*pulse(4*t-b);put(ms,ACID,full({word:'Jazz',family:'custom',modules:{edge:EDGES[b]},colors:pair(true),params:{rows:8,bow,period:.32,slice:180}},{zoom:1.3}));});
// 9 · Two posters.
put(hit(8,0),...poster(6));put(hit(8,8),...poster(7));
// 10 · The break: Montreux turns from reading upward to reading downward.
flow(9,(ms,t)=>put(ms,NIGHT,full({word:'Montreux',family:'saw',colors:pair(),params:{turn:-90+180*ease(t),rows:8}})));
// 11 · Still in the break: the construction drawing breathes, guides then outlines, its windows deepening
// and its rows growing with the hits.
flow(10,(ms,t)=>put(ms,NIGHT,full({word:'Lake',colors:pair(),params:{rows:5+Math.round(7*t),growth:.65+.75*ease(t),gap:1.7-1.1*ease(t)}},{stage:t<.5?1:2})));
// 12 · A poster held for the whole bar.
put(hit(11,0),...poster(8));
// 13 · Accordion: each beat the windows spring open from the compressed year.
flow(12,(ms,t)=>{const b=Math.floor(4*t);put(ms,NIGHT,full({word:'2027',family:'accordion',colors:pair(),params:{squash:.2+.8*pulse(4*t-b),rows:9}}));});
// 14 · Build: on every beat Lake bursts into its interlocking strips and pulls back together, each burst wider.
flow(13,(ms,t)=>{const b=Math.floor(4*t),e=pulse(4*t-b)*(.55+.15*b);put(ms,ACID,full({word:'Lake',family:'strata',colors:pair(true),params:{rows:9,offset:.02+.38*e,gap:.6+1.1*e,bow:.12+.3*e}}));});
// 15 · The last poster.
put(hit(14,0),...poster(9));
// 16 · Return: windows, outlines, then rows multiplying on sixteenths, landing on the hook's first frame.
for(let s=0;s<16;s++){const stage=s<4?1:s<8?2:3,rows=s<8?5+s%4*2:5+Math.round((s-8)*4/7);put(hit(15,s),NIGHT,full({word:'Lake',colors:pair(),params:{rows}},{stage}));}

// ---- Render ----------------------------------------------------------------------------------
placed.sort((a,b)=>a.ms-b.ms);
const total=16*BAR,plan={width:W,height:H,frames:[]};
placed.forEach((f,i)=>{
 const end=i+1<placed.length?placed[i+1].ms:total,start=i?Math.round(f.ms/10)*10:0,ms=Math.round(end/10)*10-start;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${box(0,0,W,H,f.ground)}${f.body}</svg>`;
 fs.writeFileSync(path.join(out,'frames',`${String(i).padStart(4,'0')}.png`),new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
 plan.frames.push({duration:ms/1000,texts:f.texts});if(i%50===0)process.stdout.write(`${i}/${placed.length} `);
});
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan));
console.log(`\nRendered ${placed.length} frames, ${(plan.frames.reduce((s,f)=>s+f.duration,0)).toFixed(2)} s at ${size}px wide.`);
