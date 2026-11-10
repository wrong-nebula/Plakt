import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Poline } from 'poline';
import { generateColorRamp } from 'rampensau';
import { generateRandomColorRamp } from 'fettepalette';
import { ColorPaletteGenerator } from 'pro-color-harmonies';
import { converter, formatHex, clampChroma, wcagContrast } from 'culori';

const argv=process.argv.slice(2),library=path.resolve(argv[0]||'library'),out=path.resolve(argv[1]||'output/color-workshop');
await fs.mkdir(out,{recursive:true});
const index=JSON.parse(await fs.readFile(path.join(library,'library.json'),'utf8'));
const records=[];
for(const entry of index.posters){const r=JSON.parse(await fs.readFile(new URL(entry.recordURL),'utf8'));if(r.colors)records.push(r)}
if(!records.length)throw Error('Run poster library colors first.');
// Bounded, deterministic examples spanning the measured chroma range.
records.sort((a,b)=>a.colors.meanChroma-b.colors.meanChroma||a.id.localeCompare(b.id));
const targets=[records[0],records[Math.floor(records.length/2)],records.at(-1)].filter((r,i,a)=>a.findIndex(v=>v.id===r.id)===i);
const lab=converter('oklab'),lch=converter('oklch'),hsl=converter('hsl');
const distance=(a,b)=>Math.hypot(a.l-b.l,a.a-b.a,a.b-b.b);
function rng(seed){let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
const clamp=x=>Math.min(1,Math.max(0,x)),wrap=x=>(x%360+360)%360;
function propose(tool,target,seed,parent){
 const random=rng(seed),swatches=target.colors.swatches,dominant=swatches.find(c=>c.hue!=null)||swatches[0];
 const ref=parent?.base||{h:dominant.hue??210,c:Math.max(.035,Math.min(.18,dominant.chroma)),l:dominant.lightness};
 const base={h:wrap(ref.h+(random()-.5)*(parent?35:110)),c:Math.max(.02,Math.min(.2,ref.c+(random()-.5)*.05)),l:Math.max(.25,Math.min(.85,ref.l+(random()-.5)*.18))};
 let raw;
 if(tool==='pro-color-harmonies')raw=ColorPaletteGenerator.generate(base,['analogous','complementary','triadic','splitComplementary'][Math.floor(random()*4)],{style:'triangle'}).map(c=>({mode:'oklch',...c}));
 if(tool==='poline'){
   const anchors=swatches.slice(0,2).map(c=>{const h=hsl(c.hex);return[wrap((h.h??base.h)+(random()-.5)*40),h.s,h.l]});
   if(anchors.length<2)anchors.push([base.h,.5,.8]);
   raw=new Poline({anchorColors:anchors,numPoints:6}).colorsCSS.map(c=>hsl(c));
 }
 if(tool==='rampensau')raw=generateColorRamp({total:6,hStart:base.h,hCycles:(random()-.5)*.7,sRange:[.2+random()*.4,.3+random()*.5],lRange:[.08+random()*.15,.85+random()*.12]}).map(([h,s,l])=>({mode:'hsl',h,s,l}));
 if(tool==='fettepalette')raw=generateRandomColorRamp({total:6,centerHue:base.h,hueCycle:random()*.5,curveMethod:'arc',curveAccent:random()*.8,colorModel:'hsl',minSaturationLight:[.1,.08],maxSaturationLight:[.85,.95]}).base.map(([h,s,l])=>({mode:'hsl',h,s,l}));
 if(!raw?.length)throw Error(`Empty palette ${tool}`);
 raw=raw.slice(0,6);const colors=raw.map(c=>formatHex(clampChroma(c,'oklch','rgb')));
 if(colors.some(c=>!/^#[a-f\d]{6}$/i.test(c)))throw Error('Invalid generated color');
 return{tool,seed,base,colors,preMapping:raw.map(c=>lch(c)),gamutMappedCount:raw.filter(c=>distance(lab(c),lab(clampChroma(c,'oklch','rgb')))>1e-5).length};
}
function judge(p,target){
 const labs=p.colors.map(c=>lab(c)),measured=target.colors.swatches.map(c=>({lab:lab(c.hex),weight:c.proportion}));
 const coverage=clamp(1-measured.reduce((s,c)=>s+c.weight*Math.min(...labs.map(v=>distance(c.lab,v))),0)/.45);
 let contrast=1;for(let i=0;i<p.colors.length;i++)for(let j=i+1;j<p.colors.length;j++)contrast=Math.max(contrast,wcagContrast(p.colors[i],p.colors[j]));
 const roleContrast=clamp((contrast-1)/11),unique=new Set(p.colors).size/p.colors.length;
 return{coverage,roleContrast,diversity:unique,maxPairContrast:contrast};
}
function vote(rows){const ballots=['coverage','roleContrast','diversity'];for(const row of rows){row.votes=0;row.ballotRanks={}}for(const metric of ballots){const sorted=[...rows].sort((a,b)=>b.metrics[metric]-a.metrics[metric]||a.seed-b.seed);for(const row of sorted){const better=sorted.filter(x=>x.metrics[metric]>row.metrics[metric]+1e-12).length,equal=sorted.filter(x=>Math.abs(x.metrics[metric]-row.metrics[metric])<=1e-12).length;const rank=better+(equal-1)/2;row.votes+=rows.length-1-rank;row.ballotRanks[metric]=rank+1}}return rows.sort((a,b)=>b.votes-a.votes||a.seed-b.seed)}
const results=[],tools=['poline','rampensau','fettepalette','pro-color-harmonies'];
for(const target of targets){for(const tool of tools){let parent;const history=[];const start=performance.now();for(let generation=0;generation<3;generation++){
 const rows=parent?[{...parent,retained:true}]:[];
 for(let i=0;i<6;i++){const seed=101+generation*100+i*7,p=propose(tool,target,seed,parent);p.generation=generation;p.metrics=judge(p,target);rows.push(p)}
 vote(rows);parent=rows[0];history.push({generation,candidates:rows.map(r=>structuredClone(r)),winnerSeed:parent.seed});
}results.push({posterID:target.id,source:target.imageURL,measured:target.colors,tool,elapsedMs:performance.now()-start,history,winner:parent})}}
const report={schema:'poster-palette-workshop-v1',note:'Generated alternatives, not observed palette metadata. Three deterministic engineering ballots use weighted OKLab source coverage, maximum pair contrast, and unique-color fraction. These are not human aesthetic votes or guarantees of text/background accessibility. The previous winner is included each round; Borda ranks are relative to each pool.',versions:{poline:'0.13.1',rampensau:'2.4.0',fettepalette:'3.3.0','pro-color-harmonies':'0.11.0'},results};
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const swatches=colors=>`<div class="palette">${colors.map(c=>`<div style="background:${esc(c)}"><span>${esc(c)}</span></div>`).join('')}</div>`;
await fs.writeFile(path.join(out,'report.html'),`<!doctype html><meta charset="utf-8"><title>PosterLab · Meodai palette workshop</title><style>body{background:#eeeae3;color:#161616;font:15px system-ui;max-width:1100px;padding:32px;margin:auto}section{background:#faf8f3;padding:20px;margin:20px 0}h1{font-size:36px}.palette{display:flex;height:94px;margin:12px 0}.palette>div{flex:1;position:relative}.palette span{position:absolute;bottom:4px;left:4px;background:#fff;padding:3px;font:11px monospace}small{color:#555}details{margin-top:12px}</style><h1>Meodai palette workshop</h1><p>${esc(report.note)}</p>${results.map(r=>`<section><h2>${esc(r.tool)} <small>v${report.versions[r.tool]}</small></h2><p>${esc(r.posterID)} · 18 proposals, 3 rounds · ${r.elapsedMs.toFixed(1)} ms</p><b>Observed</b>${swatches(r.measured.swatches.map(c=>c.hex))}<b>Selected alternative · seed ${r.winner.seed}</b>${swatches(r.winner.colors)}<p>Coverage ${r.winner.metrics.coverage.toFixed(3)} · contrast ballot ${r.winner.metrics.roleContrast.toFixed(3)} · ${r.winner.metrics.maxPairContrast.toFixed(2)}:1 best pair</p><details><summary>All rounds and candidates</summary>${r.history.map(g=>`<h3>Round ${g.generation+1}</h3>${g.candidates.map(c=>`<p>Seed ${c.seed} · ${c.votes} votes ${c.retained?'· retained':''}</p>${swatches(c.colors)}`).join('')}`).join('')}</details></section>`).join('')}`);
console.log(JSON.stringify({targets:targets.length,tools:tools.length,proposals:results.length*18,rounds:3,report:path.join(out,'report.html')}));
