import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {SYSTEMS,renderPoster,renderPrimitive} from './engine.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(project,'output/experimental-letter-systems-v1');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'references'),{recursive:true});fs.mkdirSync(path.join(out,'posters'),{recursive:true});
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const selection=[
 ['6ab7c9955fdcf4ca11eb84a4-p0','FUBU — Giliane Cachin talk','Alicia Maria Godel + Alison Léger','2024','Scalloped boundaries and alternating figure / ground. The supplied anchor.'],
 ['5e5b65b8f544582ee0f267dd-p0','RKC — December programme','Giliane Cachin + Viltė Jurgutytė','2021','Discs, half-discs and their countershapes make monumental RKC lettering.'],
 ['9fe9752772b71b4693b6dadd-p0','PUNKT exhibition','Tanja Krebs + @va_bienne + Anna Tuena','2019','Dense rounded vertical runs join into letters and share the surrounding black field.'],
 ['ab7f2e333f83fb9410cd302d-p0','Pablo Nouvelle — Neubad','Enea Bortone','2023','Heavy capsules and split circular shapes form a consistent geometric display alphabet.'],
 ['1b448f29749cfb8bf715e524-p0','More Love — Weltformat','New Studio','2021','Reciprocal curved modules produce ambiguous glyphs in the orange / blue rows.'],
 ['b773e557a16bff5f7e18bda5-p0','Hørde DarkMatter','Hørde, with Altiplano Typefaces','2021','Rectangles, quarter-discs, wedges and fine joints build extremely reduced letters.'],
 ['3a9c23cb961fc6c772f18d8b-p0','PLOT — f’ar Lausanne','Christian Gautschi','2019','Horizontal slices interrupt otherwise continuous letter shapes.'],
 ['163ec2ac135da6e8d52f180c-p0','P.A.G.E.S. — Geneva book fair','Neo Neo','2023','A specimen-like collection of letter constructions, including linked discs and perforated forms.'],
 ['f5042b765fe53291ff2a3618-p0','RKC — Vivement 2021?','Giliane Cachin','2020','A dot lattice builds and erodes large R, K and C silhouettes.'],
 ['f0a313ec33120a6bf709b853-p0','AHV-Plus campaign','Hubertus Design / Jonas Vœgeli','2016 campaign; archived 2017','Geometric capitals pack into a shared grid; strokes, bowls and counters become a continuous surface.']
];
const refs=selection.map(([id,title,credit,year,rule],index)=>{
 const recordPath=path.join(project,'library/posters',id,'record.json'),data=JSON.parse(fs.readFileSync(recordPath,'utf8'));
 const imagePath=fileURLToPath(data.imageURL),ext=path.extname(imagePath),image=`references/${String(index+1).padStart(2,'0')}-${id}${ext}`;
 fs.copyFileSync(imagePath,path.join(out,image));
 return {id,title,credit,year,rule,image,sourceURL:data.source.postURL,caption:data.source.caption,recordPath,imagePath,
  imageSHA256:digest(fs.readFileSync(imagePath)),recordSHA256:digest(fs.readFileSync(recordPath))};
});
fs.writeFileSync(path.join(out,'references.json'),JSON.stringify({basis:'Credits are transcribed from archived library captions. Rules are visual interpretations; years follow visible event copy or archive dates as specified.',references:refs},null,2));
for(const system of SYSTEMS)for(const id of system.sources)if(!refs.some(r=>r.id===id))throw new Error(`Missing source reference ${id} for ${system.id}`);

for(const system of SYSTEMS){
 const poster=renderPoster({system:system.id,text:'FU/BU',seed:'817'});
 fs.writeFileSync(path.join(out,'posters',`${system.number}-${system.id}.svg`),poster.svg);
 fs.writeFileSync(path.join(out,'posters',`${system.number}-${system.id}.json`),JSON.stringify({...poster.state,rule:system.rule,sourcePosterIDs:system.sources},null,2));
 fs.writeFileSync(path.join(out,'posters',`${system.number}-${system.id}.png`),new Resvg(poster.svg,{fitTo:{mode:'width',value:1400}}).render().asPng());
 // A second word proves the rules can transfer beyond the supplied initials.
 const transfer=renderPoster({system:system.id,text:'TY/PE',seed:'817'});
 fs.writeFileSync(path.join(out,'posters',`${system.number}-${system.id}-TYPE.svg`),transfer.svg);
 fs.writeFileSync(path.join(out,'posters',`${system.number}-${system.id}-TYPE.png`),new Resvg(transfer.svg,{fitTo:{mode:'width',value:700}}).render().asPng());
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicRefs=[
 ['Interlock posters — MuirMcNeil','https://muirmcneil.com/project/interlock-poster/','Letter and background grids interlock through different line densities.'],
 ['Diode — MuirMcNeil + Natasha Lucas','https://muirmcneil.com/project/diode/','Three geometric modules generate reciprocal form and counterform.'],
 ['TenPoint specimens / posters — MuirMcNeil','https://muirmcneil.com/project/tenpoint/','One circular cell with an open counter repeats on a fixed grid.'],
 ['Vormgevers, 1968 — Wim Crouwel','https://www.sfmoma.org/artwork/2015.658/','The same exposed grid determines the lettering and the composition.'],
 ['A Graphic Odyssey, 2011 — Philippe Apeloig','https://www.typographicposters.com/apeloig/681b658bae56c12508def122','Grid gutters generate extended letters with progressively changing heights.']
];
const engine=fs.readFileSync(path.join(project,'geometry-bench/letter-shape-systems/engine.mjs'),'utf8').replace(/\bexport /g,'');
const html=`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Letters from shapes — PosterLab</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f1ec;color:#272821;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select{font:inherit}button,a,input,select{touch-action:manipulation}button{cursor:pointer}a{color:inherit;text-underline-offset:3px}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #6e48cf;outline-offset:3px}header{padding:26px 36px 25px;border-bottom:1px solid #d1cec5;display:flex;justify-content:space-between;align-items:center;gap:25px}h1{font-size:31px;letter-spacing:-1.1px;line-height:1.1;margin:0 0 8px;font-weight:650}header p{margin:0;color:#67685e}header a{white-space:nowrap;font-size:13px}.workshop{max-width:1500px;margin:auto;display:grid;grid-template-columns:295px minmax(300px,1fr) 200px;gap:28px;padding:30px 36px 45px;align-items:start}aside h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 16px;color:#64665a}label{display:block;font-size:13px;margin:20px 0 7px;font-weight:550}input[type=text],input[type=number],select{width:100%;padding:9px 11px;border:1px solid #c4c3b8;border-radius:5px;background:#fffef9;color:#272821}input[type=range]{width:100%;accent-color:#5b5c4b;margin:3px 0 0}input[type=color]{width:43%;height:34px;border:1px solid #c4c3b8;border-radius:4px;background:none;padding:2px}output{float:right;font-variant-numeric:tabular-nums;color:#77786e}.hint{font-size:12px;color:#74766a;margin:6px 0 0}.rule{border-top:1px solid #d1cec5;margin-top:24px;padding-top:18px;font-size:13px}.rule strong{font-weight:600}.rule p{margin:8px 0}.rule ul{padding-left:17px;margin:8px 0}.swatches{display:flex;gap:8px;align-items:center}.swatches button{margin-left:auto}button.secondary{background:transparent;border:1px solid #c4c3b8;border-radius:4px;padding:6px 10px;font-size:12px}.exports{display:flex;flex-wrap:wrap;gap:7px;margin-top:24px}.exports button{border:1px solid #45483b;background:#45483b;color:#fffef9;border-radius:4px;font-size:12px;padding:8px 11px}.exports button:last-of-type{background:transparent;color:#45483b}.stage{max-width:620px;width:100%;margin:auto;box-shadow:0 14px 30px #282c2514;line-height:0}.stage svg{width:100%;height:auto}.stage-wrap{min-width:0}.stage-caption{font-size:12px;color:#6d6f63;margin-top:14px;display:flex;justify-content:space-between}.options{display:grid;gap:12px}.option{padding:0;border:2px solid transparent;border-radius:2px;background:none;text-align:left;color:inherit;position:relative;display:grid;grid-template-columns:60px 1fr;align-items:center;gap:10px}.option svg{display:block;width:60px;height:86px}.option span{font-size:12px;line-height:1.3;display:block}.option small{display:block;color:#727467;font-size:11px;margin-bottom:3px}.option[aria-pressed=true]{border-color:#4c5040;background:#e4e5db}.error{font-size:12px;color:#a23824;min-height:18px;margin-top:6px}section.references{border-top:1px solid #d1cec5;padding:44px 36px 60px;max-width:1500px;margin:auto}.references h2{font-size:27px;letter-spacing:-.7px;margin:0 0 8px}.intro{max-width:740px;color:#66685c;font-size:14px}.reference-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:30px 20px;margin-top:30px}.reference-grid figure{margin:0}.reference-grid .image{height:290px;background:#e4e1d9;display:flex;align-items:center;justify-content:center}.reference-grid img{width:100%;height:100%;object-fit:contain}.reference-grid h3{font-size:14px;line-height:1.4;margin:13px 0 5px}.reference-grid p{font-size:12px;line-height:1.5;margin:5px 0}.credit{color:#77776e}.number{color:#8b8c7f;margin-right:5px;font-weight:400}.public{border-top:1px solid #d1cec5;margin-top:40px;padding-top:20px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px}.public a{font-size:13px;font-weight:550}.public p{font-size:12px;color:#6b6d60}.footer{margin-top:38px;font-size:12px;color:#76776d}details{font-size:12px;margin-top:17px}summary{cursor:pointer}.file-input{max-width:100%;font-size:12px;margin-top:9px}
@media(min-width:1200px){.stage{max-width:570px}}@media(max-width:1050px){.workshop{grid-template-columns:250px minmax(300px,1fr)}.options{grid-column:1/-1;grid-template-columns:repeat(6,1fr)}.option{display:block}.option svg{width:100%;height:auto}.option span{padding:7px;font-size:11px}.option small{display:inline;margin-right:4px}.reference-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.public{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){header{padding:24px 18px;display:block}header a{display:inline-block;margin-top:15px}h1{font-size:27px}.workshop{padding:20px 18px 35px;grid-template-columns:1fr;gap:23px}.stage-wrap{grid-row:1}.options{grid-template-columns:repeat(3,1fr)}aside{grid-row:3}.stage{max-width:430px}.reference-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.reference-grid .image{height:230px}section.references{padding:30px 18px}.public{grid-template-columns:1fr 1fr}}
@media print{header,aside,.options,.stage-caption,.references{display:none!important}.workshop{display:block;padding:0}.stage{max-width:none;box-shadow:none}@page{size:70cm 100cm;margin:0}body{background:white}}
</style>
<header><div><h1>Letters from shapes</h1><p>Six construction rules. One word. A different visual language each time.</p></div><a href="#references">See the 10 reference posters ↓</a></header>
<main><div class="workshop">
<aside aria-label="Letter construction controls"><h2>Construction</h2>
<label for="system">Shape system</label><select id="system">${SYSTEMS.map(s=>`<option value="${s.id}">${s.number} — ${s.name}</option>`).join('')}</select>
<label for="word">Letters</label><input id="word" type="text" value="FU/BU" maxlength="50" aria-describedby="word-hint error"><p class="hint" id="word-hint">A–Z and 0–9. Use / for a new row. Up to 36 characters.</p><p id="error" class="error" role="status" aria-live="polite"></p>
<div id="sliders"></div><label for="seed">Variation seed</label><input id="seed" type="text" value="817" maxlength="64">
<label>Paper / ink</label><div class="swatches"><input type="color" id="paper" aria-label="Paper color"><input type="color" id="ink" aria-label="Ink color"><button class="secondary" id="invert">Invert</button></div>
<div class="exports"><button id="svg-export">Save SVG</button><button id="png-export">Save PNG</button><button id="preset-export">Save rule</button></div><p class="hint" id="export-status" role="status" aria-live="polite">SVG is editable vector. PNG exports at 2100 × 3000.</p>
<details><summary>Open a saved rule</summary><input class="file-input" type="file" id="import" accept="application/json,.json" aria-label="Open saved rule JSON"></details>
<div class="rule"><strong id="rule-name"></strong><p id="rule"></p><p class="hint" id="primitives"></p><strong>Related references</strong><ul id="related"></ul></div>
</aside>
<div class="stage-wrap"><div id="stage" class="stage" aria-live="off"></div><div class="stage-caption"><span id="caption"></span><button class="secondary" id="reset">Reset this system</button></div></div>
<nav class="options" aria-label="Six letter studies">${SYSTEMS.map(s=>`<button class="option" data-system="${s.id}" aria-pressed="${s.id==='scallop'}">${renderPoster({system:s.id}).svg}<span><small>${s.number}</small>${escape(s.name)}</span></button>`).join('')}</nav>
</div>
<section class="references" id="references"><h2>The reference list</h2><p class="intro">These posters share a useful property: a rule does the drawing. Repeated primitives, shared boundaries, cutouts or systematic slices determine the letters. The first poster is your exact reference.</p><p class="intro">Credits below come from the library’s archived captions. Construction descriptions are visual readings, not recovered authoring files. The six studies above are newly coded interpretations of these mechanisms.</p>
<div class="reference-grid">${refs.map((r,i)=>`<figure id="ref-${r.id}"><a class="image" href="${r.image}" aria-label="Enlarge ${escape(r.title)}"><img src="${r.image}" alt="${escape(r.title)} — ${escape(r.rule)}" loading="lazy"></a><figcaption><h3><span class="number">${String(i+1).padStart(2,'0')}</span>${escape(r.title)}</h3><p class="credit">${escape(r.credit)} · ${escape(r.year)}</p><p>${escape(r.rule)}</p><p><a href="${r.sourceURL}" target="_blank" rel="noreferrer">Archived source post ↗</a></p></figcaption></figure>`).join('')}</div>
<div class="public">${publicRefs.map(([title,url,rule])=>`<div><a href="${url}" target="_blank" rel="noreferrer">${escape(title)} ↗</a><p>${escape(rule)}</p></div>`).join('')}</div>
<p class="footer">Local research and AI-assisted procedural studies · 8 November 2026. Poster lettering and small captions use an original 5 × 7 cell alphabet. No font downloads, source tracing or network requests are needed to run the workshop. Original reference imagery stays attributed to its designers.</p>
</section></main>
<script>${engine}
const REFERENCES=${JSON.stringify(refs.map(({id,title})=>({id,title})))};
const $=id=>document.getElementById(id);
let state=resolveState({});
const query=new URLSearchParams(location.search);
if(query.has('rule')){try{state=resolveState(JSON.parse(query.get('rule')));}catch(e){$('error').textContent=e.message;}}
function updateURL(){const q=new URLSearchParams();q.set('rule',JSON.stringify(state));try{history.replaceState(null,'','?'+q+location.hash);}catch{}}
function installControls(){
 $('error').textContent='';$('word').setAttribute('aria-invalid','false');
 const s=SYSTEMS.find(x=>x.id===state.system);$('system').value=s.id;$('word').value=state.text;$('seed').value=state.seed;$('paper').value=state.colors[0];$('ink').value=state.colors[1];
 $('sliders').innerHTML=s.controls.map(c=>'<label for="p-'+c.key+'">'+c.label+'<output id="o-'+c.key+'">'+state.params[c.key]+'</output></label><input type="range" id="p-'+c.key+'" min="'+c.min+'" max="'+c.max+'" step="'+c.step+'" value="'+state.params[c.key]+'">').join('');
 for(const c of s.controls)$('p-'+c.key).addEventListener('input',e=>{state.params[c.key]=+e.target.value;$('o-'+c.key).textContent=e.target.value;draw();});
 $('rule-name').textContent=s.name;$('rule').textContent=s.rule;$('primitives').textContent=s.primitives;
 $('related').innerHTML=s.sources.map(id=>REFERENCES.find(r=>r.id===id)).filter(Boolean).map(r=>'<li><a href="#ref-'+r.id+'">'+r.title+'</a></li>').join('');
 document.querySelectorAll('.option').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.system===state.system)));
}
function draw(){const r=renderPoster(state);state=r.state;$('stage').innerHTML=r.svg;$('caption').textContent=state.text.replaceAll('/',' / ')+' · '+r.features.rows+' rows';window.rendered=$('stage svg');window.$features=r.features;window.currentStudy=r;updateURL();document.dispatchEvent(new CustomEvent('genart:done'));return r;}
function selectSystem(id){state=resolveState({system:id,text:state.text,seed:state.seed});installControls();draw();}
window.render=(seed)=>{state.seed=String(seed);$('seed').value=state.seed;return draw();};
window.PosterLetterSystems={SYSTEMS,ALPHABET,resolveState,renderPoster,renderPrimitive,getState:()=>JSON.parse(JSON.stringify(state))};
document.querySelectorAll('.option').forEach(b=>b.addEventListener('click',()=>selectSystem(b.dataset.system)));
$('system').addEventListener('change',e=>selectSystem(e.target.value));
$('word').addEventListener('input',e=>{try{const text=normalizeText(e.target.value);state.text=text;$('error').textContent='';e.target.setAttribute('aria-invalid','false');draw();}catch(err){$('error').textContent=err.message;e.target.setAttribute('aria-invalid','true');}});
$('seed').addEventListener('input',e=>{state.seed=e.target.value;draw();});
for(const [i,id] of ['paper','ink'].entries())$(id).addEventListener('input',e=>{state.colors[i]=e.target.value;draw();});
$('invert').addEventListener('click',()=>{state.invert=!state.invert;draw();});
$('reset').addEventListener('click',()=>{state=resolveState({system:state.system,text:state.text});installControls();draw();});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const basename=()=>state.system+'-'+state.text.replaceAll('/','-').replaceAll(' ','_')+'-'+state.seed.replace(/[^a-z0-9-]/gi,'_');
$('svg-export').addEventListener('click',()=>download(new Blob([renderPoster(state).svg],{type:'image/svg+xml'}),basename()+'.svg'));
$('preset-export').addEventListener('click',()=>download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),basename()+'.json'));
$('png-export').addEventListener('click',async()=>{
 try{$('export-status').textContent='Rendering PNG…';const svg=renderPoster(state).svg,img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=2100;canvas.height=3000;canvas.getContext('2d').drawImage(img,0,0,2100,3000);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw new Error('PNG export failed.');download(blob,basename()+'.png');$('export-status').textContent='Saved PNG at 2100 × 3000.';}finally{URL.revokeObjectURL(url);}
 }catch(e){$('export-status').textContent=e.message;}
});
$('import').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;const raw=JSON.parse(await file.text());if(!SYSTEMS.some(s=>s.id===raw.system))throw new Error('This file does not name a known letter system.');state=resolveState(raw);$('error').textContent='';installControls();draw();}catch(err){$('error').textContent=err.message;}finally{e.target.value='';}});
installControls();draw();
</script></html>`;
fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({version:1,alphabet:'hand-authored 5 x 7 cells, A-Z / 0-9',systems:SYSTEMS,publicReferences:publicRefs},null,2));
console.log(`Built ${SYSTEMS.length} editable systems, 12 vector proofs and ${refs.length} reference records: ${out}`);
