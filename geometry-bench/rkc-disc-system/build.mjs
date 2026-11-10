import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import * as esbuild from 'esbuild';
import {SOURCE,ENGINE,FAMILIES,BONDS,FORMATS,PALETTES,PRESETS,CONTROLS,KIT,render,kit} from './engine.mjs';
import {withPrintPanel,printOutputs} from '../print-kit-node.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const out=path.join(root,'output/rkc-disc-study-v2');fs.mkdirSync(path.join(out,'bonds'),{recursive:true});
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const recordPath=path.join(root,'library/posters',SOURCE.id,'record.json');
const record=JSON.parse(fs.readFileSync(recordPath)),image=fileURLToPath(record.imageURL);
fs.copyFileSync(image,path.join(out,'reference.png'));
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...SOURCE,caption:record.source.caption,sourceImage:image,
 imageSHA256:sha(fs.readFileSync(image)),recordSHA256:sha(fs.readFileSync(recordPath)),
 crop:[244,128,806,926],lattice:[5,7],
 paletteSamples:[{role:'paper (red)',rectangles:[[468,760,482,772],[560,770,572,780]],median:'#fb1c1d'},
  {role:'letter (cream)',rectangles:[[500,605,560,640],[720,500,770,560]],median:'#f6e3c6'},
  {role:'counter (bronze)',rectangles:[[500,700,540,730],[600,700,640,730],[560,380,600,420]],median:'#734e2b'}],
 basis:'The source is one 5 × 7 field of modules. Palette values are medians of sunlit regions of the photograph, adjusted slightly for print; the module rule is a visual reading, not recovered production files.'},null,2));

const preset=Object.fromEntries(PRESETS.map(p=>[p.id,p.state]));
const examples=[];
// Every named rule on the source's single 5 × 7 field.
for(const p of PRESETS)examples.push({name:p.id,state:{...p.state,text:'R'}});
for(const [name,text,rule,layout] of [['RKC','RKC','december','fit'],['FU-BU','FU/BU','ribbon','field'],['TY-PE','TY/PE','woven','field'],['alphabet','ABCDEF/GHIJKL/MNOPQR/STUVWX','solid','field'],['figures','0123456789/.:!?+&-','solid','field']])
 examples.push({name,state:{...preset[rule],text,layout}});
// Stages under Solid, where every pass changes the field (December has no bonds).
for(const stage of [1,2,3,4])examples.push({name:`stage-${stage}`,state:{...preset.solid,text:'R',stage}});
// Families compared on joined letters, where the corner profile reads best.
for(const f of FAMILIES)examples.push({name:`family-${f.id}`,state:{...preset.solid,family:f.id,text:'R'}});
for(const [format,text,rule] of [['december','RKC','december'],['poster','FU/BU','ribbon'],['a-series','R','solid'],['square','TY/PE','woven'],['story','PUNKT','solid'],['landscape','ROCKING CHAIR','december'],['billboard','DECEMBER','night']])
 examples.push({name:`fit-${format}`,state:{...preset[rule],text,layout:'fit',format}});
const png=(r,edge=3000)=>new Resvg(r.svg,{fitTo:r.width>r.height?{mode:'width',value:edge}:{mode:'height',value:edge}}).render().asPng();
for(const e of examples){
 const r=render(e.state);fs.writeFileSync(path.join(out,e.name+'.svg'),r.svg);fs.writeFileSync(path.join(out,e.name+'.png'),png(r));
 fs.writeFileSync(path.join(out,e.name+'.json'),JSON.stringify({...r.state,source:SOURCE.id},null,2));
}
// The bond matrix: letter bonds × counter bonds on one R, nothing else changed.
for(const f of BONDS)for(const g of BONDS){const r=render({text:'R',figure:f.id,ground:g.id,backing:false});
 fs.writeFileSync(path.join(out,'bonds',`${f.id}-${g.id}.svg`),r.svg);fs.writeFileSync(path.join(out,'bonds',`${f.id}-${g.id}.png`),png(r,900));}
for(const f of FAMILIES){const svg=kit({...preset.solid,family:f.id,backing:false});
 fs.writeFileSync(path.join(out,`kit-${f.id}.svg`),svg);fs.writeFileSync(path.join(out,`kit-${f.id}.png`),new Resvg(svg,{fitTo:{mode:'width',value:2400}}).render().asPng());}
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({engine:ENGINE,families:FAMILIES,bonds:BONDS,controls:CONTROLS,formats:FORMATS,palettes:PALETTES,presets:PRESETS,kit:KIT},null,2));

// The editor embeds the engine, its polygon kernel and the glyph maps as one script, so it works offline.
const engine=(await esbuild.build({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'RkcEngine',minify:true,write:false,platform:'browser',target:'es2020',logLevel:'warning'})).outputFiles[0].text;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=list=>list.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RKC — disc field</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2efe7;color:#292d24;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}button,input,select{font:inherit;color:inherit}button{cursor:pointer}a{color:inherit;text-underline-offset:3px}button,input,select{touch-action:manipulation}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #b2361f;outline-offset:3px}
header{padding:24px 30px;border-bottom:1px solid #d4d1c4;display:flex;justify-content:space-between;align-items:center;gap:25px}h1{font-size:29px;letter-spacing:-.8px;line-height:1.2;margin:0}header p{font-size:13px;color:#707061;margin:6px 0 0}header nav{display:flex;gap:16px;font-size:12px;white-space:nowrap}
.workspace{max-width:1800px;margin:auto;padding:26px 30px 40px;display:grid;grid-template-columns:270px minmax(0,1fr);gap:30px;align-items:start}label,.label{display:block;font-size:12px;font-weight:600;margin:17px 0 7px}input[type=text],select{width:100%;padding:9px 10px;border:1px solid #c5c2b4;background:#fffdf7;border-radius:4px}input[type=range]{width:100%;accent-color:#6c684e}input[type=range]:disabled{opacity:.4}output{float:right;font-variant-numeric:tabular-nums;color:#777566;font-weight:400}.hint{font-size:12px;color:#777666;margin:6px 0}.error{font-size:12px;color:#a93a25;min-height:18px;margin:5px 0}.chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}button.small{padding:5px 8px;background:none;border:1px solid #c5c2b4;border-radius:4px;font-size:12px}.chips button[aria-pressed=true]{background:#e3dfce;border-color:#6b654b}
fieldset{border:0;border-top:1px solid #d4d1c4;margin:20px 0 0;padding:4px 0 0}legend{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#777566;padding:0 8px 0 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pair label{margin-top:12px}.check{display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px;margin-top:14px}
.swatches{display:flex;gap:8px;align-items:center}.swatches input{width:44px;height:30px;background:none;border:1px solid #c5c2b4;padding:2px}.swatches button{margin-left:auto}.exports{display:flex;gap:6px;flex-wrap:wrap;margin-top:21px}.exports button{background:#494c3b;color:#fffdf7;border:1px solid #494c3b;padding:8px 10px;border-radius:4px;font-size:12px}.exports button:last-child{background:none;color:#494c3b}details{font-size:12px;margin-top:16px}summary{cursor:pointer}input[type=file]{display:block;max-width:100%;font-size:12px;margin-top:10px}.rule{border-top:1px solid #d4d1c4;padding-top:15px;margin-top:22px;font-size:12px;color:#5f6252}.rule p{margin:7px 0}
.display{min-width:0}.stages{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}.stages button{background:none;border:1px solid #c5c2b4;border-radius:4px;padding:7px 10px;font-size:12px}.stages button[aria-pressed=true]{background:#e0dccb;border-color:#6b654b}
.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start;max-width:1120px;margin:auto}.comparison.wide{grid-template-columns:minmax(0,1fr) minmax(0,3fr);max-width:1500px}.comparison figure{margin:0;min-width:0}.comparison img{display:block;width:100%;height:auto}.comparison figcaption{font-size:12px;color:#737362;margin-top:10px;line-height:1.5}.comparison figcaption strong{font-weight:600;color:#3d4133}.stage{line-height:0;box-shadow:0 10px 26px #292d241a}.stage svg{width:100%;height:auto;display:block}
.caption{display:flex;justify-content:space-between;align-items:center;gap:18px;font-size:12px;color:#737362;margin:20px 0 25px}.kit{border-top:1px solid #d4d1c4;margin-top:25px;padding-top:17px}.kit h2{font-size:13px;margin:0 0 12px}.kit svg{display:block;width:100%;height:auto}.notes{font-size:13px;line-height:1.6;max-width:960px;color:#66695a}
.gallery{max-width:1800px;margin:auto;border-top:1px solid #d4d1c4;padding:35px 30px 45px}.gallery h2{font-size:25px;letter-spacing:-.5px;margin:0 0 8px}.presets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px;margin-top:22px}.presets figure{margin:0}.presets img{display:block;width:100%;height:auto}.presets figcaption{margin-top:12px;font-size:13px}.presets p{font-size:12px;color:#6c6e5e;margin:4px 0}.filelinks{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:12px;align-items:center}
.matrix{display:grid;grid-template-columns:auto repeat(4,minmax(0,1fr));gap:10px;align-items:center;max-width:1100px;margin-top:22px}.matrix img{display:block;width:100%;height:auto}.matrix .head{font-size:12px;color:#5f6252;font-weight:600}.matrix .side{font-size:12px;color:#5f6252;font-weight:600;writing-mode:vertical-rl;transform:rotate(180deg);text-align:center}.footer{font-size:12px;color:#777566;margin-top:30px}
@media(max-width:1050px){.workspace{grid-template-columns:230px minmax(0,1fr);gap:20px;padding:22px}.stages button{padding:6px;font-size:11px}header{padding:22px}.gallery{padding:30px 22px}.presets{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){header{display:block;padding:20px 16px}header nav{margin-top:13px;flex-wrap:wrap}.workspace{display:flex;flex-direction:column;padding:18px 16px}.display{order:0;width:100%}aside{order:1;width:100%;border-top:1px solid #d4d1c4;padding-top:10px}.comparison,.comparison.wide{gap:10px;grid-template-columns:repeat(2,minmax(0,1fr))}.comparison figcaption{font-size:11px}.gallery{padding:25px 16px}.presets{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.matrix{gap:5px}.matrix .head{font-size:10px}h1{font-size:26px}.caption{align-items:flex-start}.notes{font-size:12px}}
@media print{header,aside,.stages,.reference,.caption,.kit,.notes,.gallery,.comparison figcaption{display:none!important}.workspace{display:block;padding:0}.comparison{display:block}.stage{box-shadow:none;max-width:none}@page{margin:0}}
</style><header><div><h1>RKC — disc field</h1><p>One module rule draws letters and counters alike. A type system after Giliane Cachin + Viltė Jurgutytė.</p></div><nav><a href="#presets">Five rules ↓</a><a href="#bonds">Bond matrix ↓</a></nav></header>
<main><div class="workspace"><aside aria-label="Disc field controls">
<label for="letters">Letters</label><input id="letters" type="text" value="R" maxlength="30" aria-describedby="letter-hint error"><p class="hint" id="letter-hint">A–Z, 0–9 and . : ! ? + ' &amp; , -. Use / for a new row.</p><p class="error" id="error" role="status" aria-live="polite"></p>
<div class="chips" aria-label="Text probes">${['R','K','C','RKC','FU/BU','TY/PE','04.12'].map(t=>`<button class="small probe" data-text="${t}" aria-pressed="${t==='R'}">${t}</button>`).join('')}</div>
<span class="label">Rule</span><div class="chips" aria-label="Named rules">${PRESETS.map(p=>`<button class="small preset" data-preset="${p.id}" aria-pressed="${p.id==='december'}">${esc(p.name)}</button>`).join('')}</div><p class="hint" id="preset-note"></p>
<fieldset><legend>Modules</legend><label for="family">Shape family</label><select id="family">${options(FAMILIES)}</select><p class="hint" id="family-note"></p>
<div class="pair"><div><label for="figure">Letters join</label><select id="figure">${options(BONDS)}</select></div><div><label for="ground">Counters join</label><select id="ground">${options(BONDS)}</select></div></div>
<label class="check"><input type="checkbox" id="backing"> Backing ribbon behind letters</label><div id="controls-modules"></div></fieldset>
<fieldset><legend>Layout</legend><label for="layout">Arrangement</label><select id="layout"><option value="fit">Fit a format</option><option value="field">Natural field</option></select>
<div id="format-row"><label for="format">Format</label><select id="format">${options(FORMATS)}</select></div><div id="controls-layout"></div></fieldset>
<fieldset><legend>Inks</legend><span class="label">Paper / letter / counter</span><div class="swatches"><input type="color" id="paper" aria-label="Paper colour"><input type="color" id="letter" aria-label="Letter colour"><input type="color" id="counter" aria-label="Counter colour"><button class="small" id="invert">Invert</button></div>
<div class="chips" aria-label="Palettes">${PALETTES.map(p=>`<button class="small palette" data-palette="${p.id}" title="${esc(p.note)}">${esc(p.name)}</button>`).join('')}</div></fieldset>
<div class="exports"><button id="save-svg">Save SVG</button><button id="save-png">Save PNG</button><button id="save-rule">Save rule</button></div><p class="hint" id="status" role="status" aria-live="polite">Plain filled SVG outlines. PNG exports at 3000px on its longest edge.</p><details><summary>Open a saved rule</summary><input type="file" id="load-rule" accept="application/json,.json" aria-label="Open saved RKC rule JSON"></details>
<div class="rule"><strong>The rule</strong><p>Every lattice cell holds one module: cream for the letter, bronze for its counters. A module flattens each side it shares with a same-ink neighbour it bonds to and rounds every other corner.</p><p>Inside corners get fillets; diagonal letter cells meet through a neck. Red only shows where both inks round off.</p></div></aside>
<div class="display"><nav class="stages" aria-label="Construction steps">${['Lattice','Two-ink field','Bonds','Fillets & necks'].map((s,i)=>`<button data-stage="${i+1}" aria-pressed="${i===3}">${i+1}. ${s}</button>`).join('')}</nav>
<div class="comparison" id="comparison"><figure class="reference"><a href="reference.png"><img src="reference-crop.png" alt="Photograph of the RKC December poster: cream and bronze circular modules on fluorescent red"></a><figcaption><strong>Reference</strong><br>${esc(SOURCE.credit)} · December programme, 2021 · <a href="reference.png">Full photograph</a> · <a href="${SOURCE.url}" target="_blank" rel="noreferrer">Source ↗</a></figcaption></figure><figure><div class="stage" id="stage"></div><figcaption><strong id="study-name">December rule</strong><br><span id="study-note">The same 5 × 7 field, built by the module rule. New lettering, not a trace.</span></figcaption></figure></div>
<div class="caption"><span id="caption"></span><button class="small" id="reset">Reset geometry</button></div><div class="kit"><h2>Six neighbourhoods under the current rule</h2><div id="kit"></div></div><p class="notes">Letters come from a hand-authored 5 × 7 cell alphabet. The rule decides every outline: which sides go flat, which corners round, where fillets and necks appear. Fit the format picks the row break that gives the largest modules, keeps whole words and numbers together, and fills the rest of the format with counter modules, so every poster is a complete field.</p></div></div>
<section class="gallery" id="presets"><h2>Five rules, one letter</h2><p class="notes">Each rule is a choice of bonds, backing, shape family and inks. They keep your text and format.</p><div class="presets">${PRESETS.map(p=>`<figure><a href="${p.id}.png"><img src="${p.id}.png" alt="R drawn with the ${esc(p.name)} rule" loading="lazy"></a><figcaption><strong>${esc(p.name)}</strong><p>${esc(p.note)}</p><div class="filelinks"><a href="${p.id}.svg">SVG</a><a href="${p.id}.json">Rule</a><button class="small use-preset" data-preset="${p.id}">Use this rule</button></div></figcaption></figure>`).join('')}</div></section>
<section class="gallery" id="bonds"><h2>Bond matrix</h2><p class="notes">Rows set how letter modules join; columns set how counter modules join. Nothing else changes between the sixteen fields.</p><div class="matrix"><span></span>${BONDS.map(b=>`<span class="head">Counters: ${esc(b.name.toLowerCase())}</span>`).join('')}${BONDS.map(f=>`<span class="side">Letters: ${esc(f.name.toLowerCase())}</span>`+BONDS.map(g=>`<a href="bonds/${f.id}-${g.id}.svg"><img src="bonds/${f.id}-${g.id}.png" alt="Letters ${esc(f.name.toLowerCase())}, counters ${esc(g.name.toLowerCase())}" loading="lazy"></a>`).join('')).join('')}</div>
<p class="footer">Source credits follow the archived library caption. The palette is measured from the photographed print. The cell alphabet, module rule and every proof are new and were made with AI assistance; source imagery remains attributed to its designers. <a href="comparison.png">Reference comparison</a> · <a href="presets.png">Rules</a> · <a href="families.png">Shape families</a> · <a href="construction.png">Construction</a> · <a href="bonds.png">Bond matrix</a> · <a href="fit-formats.png">Fit formats</a> · <a href="../rkc-disc-study-v1/index.html">v1 tile study</a></p></section></main>
<script>${engine}
const {render,resolve,normalize,FAMILIES,BONDS,FORMATS,CONTROLS,PRESETS,PALETTES,kit}=RkcEngine,$=id=>document.getElementById(id),bond=id=>BONDS.find(b=>b.id===id).name.toLowerCase();
const START={...PRESETS[0].state,text:'R',layout:'fit',format:'december'};let state=resolve(START);
try{const q=new URLSearchParams(location.search);if(q.has('rule'))state=resolve(JSON.parse(q.get('rule')));}catch{}
const presetOf=s=>PRESETS.find(p=>Object.entries(p.state).every(([k,v])=>JSON.stringify(s[k])===JSON.stringify(v)));
function install(){
 $('letters').value=state.text;$('letters').setAttribute('aria-invalid','false');$('error').textContent='';
 for(const id of ['family','figure','ground','layout','format'])$(id).value=state[id];$('backing').checked=state.backing;
 $('family-note').textContent=FAMILIES.find(f=>f.id===state.family).note;
 for(const group of ['modules','layout'])$('controls-'+group).innerHTML=CONTROLS.filter(c=>c.group===group).map(c=>'<label for="p-'+c.key+'">'+c.label+'<output id="o-'+c.key+'">'+state.params[c.key]+'</output></label><input type="range" id="p-'+c.key+'" min="'+c.min+'" max="'+c.max+'" step="'+c.step+'" value="'+state.params[c.key]+'">').join('');
 for(const c of CONTROLS)$('p-'+c.key).addEventListener('input',e=>{state.params[c.key]=+e.target.value;$('o-'+c.key).textContent=e.target.value;schedule();});
 ['paper','letter','counter'].forEach((id,i)=>$(id).value=state.colors[i]);
}
// Slider input coalesces into one render per frame.
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;draw();});}
function draw(){const r=render(state);state=r.state;$('stage').innerHTML=r.svg;$('kit').innerHTML=kit(state);
 const fit=state.layout==='fit',format=FORMATS.find(f=>f.id===state.format),preset=presetOf(state);
 $('caption').textContent=r.features.rowsText.join(' / ')+' · '+r.features.cols+' × '+r.features.fieldRows+' modules'+(fit?' · '+format.name:' · natural field')+' · letters '+bond(state.figure)+', counters '+bond(state.ground);
 $('study-name').textContent=preset?preset.name+' rule':'Custom rule';$('preset-note').textContent=preset?preset.note:'Edited from a named rule.';
 $('format-row').hidden=!fit;$('comparison').classList.toggle('wide',r.width>r.height*1.2);
 document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.stage===state.stage)));document.querySelectorAll('.probe').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.text===state.text)));document.querySelectorAll('.preset').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===preset?.id)));
 for(const k of ['fillet','neck','pad'])$('p-'+k).disabled=state.stage<4||(k==='pad'&&!state.backing);$('backing').disabled=state.stage<4;
 const q=new URLSearchParams();q.set('rule',JSON.stringify(state));try{history.replaceState(null,'','?'+q+location.hash);}catch{}
 window.currentRKC=r;window.$features=r.features;window.rendered=$('stage').firstElementChild;document.dispatchEvent(new CustomEvent('genart:done'));return r;}
window.RKC={...RkcEngine,getState:()=>JSON.parse(JSON.stringify(state))};window.render=rule=>{state=resolve(typeof rule==='object'?rule:state);install();return draw();};
function usePreset(id){const p=PRESETS.find(x=>x.id===id);state=resolve({...state,...p.state,params:state.params});install();draw();}
$('letters').addEventListener('input',e=>{try{state.text=normalize(e.target.value);$('error').textContent='';e.target.setAttribute('aria-invalid','false');schedule();}catch(err){$('error').textContent=err.message;e.target.setAttribute('aria-invalid','true');}});
document.querySelectorAll('.probe').forEach(b=>b.addEventListener('click',()=>{state.text=b.dataset.text;install();draw();}));
document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>{state.stage=+b.dataset.stage;draw();}));
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>usePreset(b.dataset.preset)));
document.querySelectorAll('.use-preset').forEach(b=>b.addEventListener('click',()=>{usePreset(b.dataset.preset);window.scrollTo({top:0,behavior:'instant'});}));
document.querySelectorAll('.palette').forEach(b=>b.addEventListener('click',()=>{state.colors=[...PALETTES.find(p=>p.id===b.dataset.palette).colors];install();draw();}));
for(const id of ['family','figure','ground','layout','format'])$(id).addEventListener('change',e=>{state[id]=e.target.value;if(id==='family')$('family-note').textContent=FAMILIES.find(f=>f.id===state.family).note;draw();});
$('backing').addEventListener('change',e=>{state.backing=e.target.checked;draw();});
['paper','letter','counter'].forEach((id,i)=>$(id).addEventListener('input',e=>{state.colors[i]=e.target.value;schedule();}));
$('invert').addEventListener('click',()=>{state.invert=!state.invert;draw();});
$('reset').addEventListener('click',()=>{state=resolve({...state,params:undefined,stage:4});install();draw();});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const base=()=>'rkc-'+state.family+'-'+state.text.replaceAll('/','-').replace(/[^A-Z0-9-]/g,'_')+(state.layout==='fit'?'-'+state.format:'')+'-stage'+state.stage;
$('save-svg').addEventListener('click',()=>download(new Blob([render(state).svg],{type:'image/svg+xml'}),base()+'.svg'));
$('save-rule').addEventListener('click',()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),base()+'.json'));
$('save-png').addEventListener('click',async()=>{try{$('status').textContent='Rendering PNG…';const r=render(state),url=URL.createObjectURL(new Blob([r.svg],{type:'image/svg+xml'}));try{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas'),scale=3000/Math.max(r.width,r.height);c.width=Math.round(r.width*scale);c.height=Math.round(r.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export failed.');download(blob,base()+'.png');$('status').textContent='Saved '+c.width+' × '+c.height+' PNG.';}finally{URL.revokeObjectURL(url);}}catch(e){$('status').textContent=e.message;}});
// v1 tile-kit rules replay through this engine with their letters, kernel, inks and hairline.
$('load-rule').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;const data=JSON.parse(await f.text());if(!['rkc-disc-counter-v1','${ENGINE}'].includes(data.engine))throw new Error('Choose a saved RKC disc rule.');state=resolve(data);install();draw();}catch(err){$('error').textContent=err.message;}finally{e.target.value='';}});
install();draw();</script></html>`;
fs.writeFileSync(path.join(out,'index.html'),withPrintPanel(html));
// Print outputs from the shared print kit: spot separations and a riso preview for every style.
const print=printOutputs({out,styles:FAMILIES.map(f=>({id:f.id,svg:render({family:f.id}).svg}))});
console.log(`Print kit: ${print.styles} riso previews and ${print.sheets} separation sheets in print/`);
console.log(`Built ${examples.length} RKC vector/PNG/rule examples, a 16-field bond matrix and three kits in ${out}`);
