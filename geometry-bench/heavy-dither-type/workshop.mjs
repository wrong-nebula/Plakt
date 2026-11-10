// The editor: one offline page with the engine (and its glyph outlines) bundled in.
export function workshopHTML({engine,FAMILIES,CONTROLS,LABELS,fonts}){
const fontNames=Object.values(LABELS.face).join(', ');
const count=FAMILIES.length,groups=[['letters','Letters',['face','construct','warp','case','align']],['relief','Relief and fill',['profile','fill']],['outside','Halo, shadow and extrusion',[]],['tone','Tone',[]],['dither','Dither',['method']],['pixels','Pixels',['mark']],['layout','Layout',['layout','format','palette']]];
const names={face:'Face',construct:'Construction',warp:'Warp',case:'Case',align:'Align',profile:'Profile',fill:'Fill',method:'Method',mark:'Marks',layout:'Layout',format:'Format',palette:'Palette'};
const select=id=>`<label for="${id}">${names[id]}</label><select id="${id}">${Object.entries(LABELS[id]).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>`;
return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Heavy dither type</title><style>
*{box-sizing:border-box}body{margin:0;background:#ecebe6;color:#26272b;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}button,input,select,textarea{font:inherit;color:inherit}button,summary{cursor:pointer}a{color:inherit;text-underline-offset:3px}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #e0185c;outline-offset:3px}
header{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:25px 30px;border-bottom:1px solid #d0cec7}h1{font-size:29px;line-height:1.2;letter-spacing:-.7px;margin:0}header p{font-size:13px;color:#696a70;margin:6px 0 0;max-width:900px}header a{font-size:12px;white-space:nowrap}
.workspace{max-width:1800px;margin:auto;padding:26px 30px 40px;display:grid;grid-template-columns:300px minmax(0,1fr);gap:28px;align-items:start}
label,.label{display:block;font-size:12px;font-weight:600;margin:14px 0 6px}label output{float:right;font-weight:400;color:#696a70;font-variant-numeric:tabular-nums}
input[type=text],textarea,select{width:100%;padding:7px 9px;border:1px solid #bdbcc2;border-radius:4px;background:#fbfbf9}textarea{resize:vertical;min-height:58px}input[type=range]{width:100%;accent-color:#e0185c}input:disabled,select:disabled,textarea:disabled{opacity:.35}label.off{color:#a4a3a9}
.hint{font-size:12px;color:#696a70;margin:7px 0 0}.row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}button.small{background:none;border:1px solid #bdbcc2;border-radius:4px;padding:5px 8px;font-size:12px}
details.group{border-top:1px solid #d0cec7;margin-top:16px;padding-top:2px}details.group>summary{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#696a70;margin:10px 0 0;font-weight:600}
.exports{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:22px}.exports button{background:#e0185c;color:white;border:1px solid #e0185c;padding:8px 10px;border-radius:4px;font-size:12px}.exports button.quiet{background:none;color:#b0124a}input[type=file]{display:block;max-width:100%;font-size:12px;margin-top:10px}
.views{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}.views button{background:none;border:1px solid #bdbcc2;border-radius:4px;padding:7px 10px;font-size:12px}.views button[aria-pressed=true]{background:#fbd9e5;border-color:#e86b96}
.stage{line-height:0;box-shadow:0 8px 24px #26272b14;max-width:640px;margin:auto}.stage svg{width:100%;height:auto;display:block}.caption{font-size:12px;color:#696a70;margin:16px auto 0;max-width:640px}
.gallery{max-width:1800px;margin:auto;border-top:1px solid #d0cec7;padding:35px 30px 45px}.gallery h2{font-size:25px;letter-spacing:-.5px;margin:0 0 8px}
.families{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:20px;margin-top:22px}.families button{all:unset;cursor:pointer;display:block}figure{margin:0;min-width:0}.families img,.sheets img{display:block;width:100%;height:auto;image-rendering:pixelated}.families figcaption,.sheets figcaption{margin-top:9px;font-size:13px}.families p{font-size:12px;color:#696a70;margin:3px 0}
.sheets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:20px}.notes{font-size:13px;line-height:1.6;max-width:980px;color:#5c5d62}.fonts{font-size:13px;columns:3;margin-top:14px}.fonts a{display:block}
@media(max-width:1250px){.families{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1050px){.workspace{grid-template-columns:260px minmax(0,1fr);gap:20px;padding:22px}.families{grid-template-columns:repeat(3,minmax(0,1fr))}header{padding:22px}.gallery{padding:30px 22px}}
@media(max-width:720px){header{display:block;padding:20px 16px}header a{display:inline-block;margin-top:12px}.workspace{display:flex;flex-direction:column;padding:18px 16px}.display{width:100%}aside{order:1;width:100%;border-top:1px solid #d0cec7;padding-top:10px}.gallery{padding:25px 16px}.families,.sheets{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.fonts{columns:1}h1{font-size:26px}}
</style><header><div><h1>Heavy dither type</h1><p>Letters as tone: every stroke measured from its edge, built solid, hollow, as contours, neon tubes, eroded, sliced or melting, bent by a warp, raised into a tube, chisel, pillow or groove, lit, given halos, shadows and extrusions, and dithered on a pixel grid tied to the cap height — from five chunky rows to fine thermal print — into fourteen renderings, from square pixels to text mode, halftone, hatching and knit. Any text in sixteen faces; ${count} styles and an OTF font per style.</p></div><a href="#styles">See the ${count} styles ↓</a></header>
<main><div class="workspace"><aside aria-label="Heavy dither type controls">
<label for="text">Text</label><textarea id="text" maxlength="120" aria-describedby="text-hint"></textarea><p class="hint" id="text-hint">“/” starts a new line.</p>
<label for="caption">Caption</label><input type="text" id="caption" maxlength="80"><p class="hint">Set small at the foot of Stack and Poster layouts; leave empty for none.</p>
<label for="family">Style</label><select id="family">${FAMILIES.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')}</select><p class="hint" id="family-note"></p>
<div class="row"><button class="small" id="reset">Reset style</button>${['RAVE/ON','2026','Fête','BASS/DROP','LAST/CALL'].map(t=>`<button class="small probe" data-text="${t}">${t.replace('/',' / ')}</button>`).join('')}</div>
${groups.map(([id,name,sel],i)=>`<details class="group"${i<2?' open':''}><summary>${name}</summary>${sel.map(select).join('')}<div id="controls-${id}"></div></details>`).join('')}
<div class="exports"><button id="save-svg">SVG</button><button id="save-png">PNG</button><button id="save-rule" class="quiet">Save rule</button><button id="new-seed" class="quiet">New seed</button></div>
<p class="hint" id="status" role="status" aria-live="polite">SVG keeps every pixel as a vector run, one path per ink. PNG exports at a 3000 px long edge.</p>
<details class="hint"><summary>Open a saved rule</summary><input type="file" id="load-rule" accept="application/json,.json" aria-label="Open a saved heavy-dither type rule"></details>
</aside>
<div class="display"><nav class="views" aria-label="Construction step">${Object.entries(LABELS.view).map(([v,l])=>`<button data-view="${v}" aria-pressed="${v==='dither'}">${l}</button>`).join('')}</nav>
<div id="stage" class="stage"></div><p class="caption" id="caption-line"></p></div></div>
<section class="gallery" id="styles"><h2>${count} styles</h2><p class="notes">Photo type stays close to the reference, a dithered photograph in a black frame; the rest are new. Choose one to open it.</p>
<div class="families">${FAMILIES.map((f,i)=>`<figure><button data-family="${f.id}" aria-label="Open ${f.name}"><img src="${f.id}.png" alt="${f.name}: ${f.text.replaceAll('/',' ')}" loading="lazy"></button><figcaption><strong>${String(i+1).padStart(2,'0')} / ${f.name}</strong><p>${f.note}</p></figcaption></figure>`).join('')}</div>
<h2 style="margin-top:40px">Sheets</h2><div class="sheets">${[['renderings','Fourteen renderings'],['constructions','Seven constructions'],['warps','Six warps'],['ladder','One word from five to forty-eight rows per cap'],['methods','One word through all fourteen methods'],['profiles','Six profiles, lit'],['faces','Sixteen faces'],['fills','Six fills'],['alphabets','Every style’s alphabet']].map(([f,c])=>`<figure><a href="sheets/${f}.png"><img src="sheets/${f}.png" alt="${c}" loading="lazy"></a><figcaption>${c}</figcaption></figure>`).join('')}</div>
<h2 style="margin-top:40px">Fonts</h2><p class="notes">Each style as an OTF: every glyph dithered on its own at the style’s rows per cap, halos, shadows and extrusions included. Styles in several inks ship one font per ink; they share advances, so they stack.</p><div class="fonts">${fonts.map(f=>`<a href="${f.file}">${f.name}</a>`).join('')}</div>
<p class="notes">Outlines come from SIL Open Font License faces: ${fontNames}.</p></section></main>
<script>${engine}</script><script>
const H=HeavyDitherType,CONTROLS=${JSON.stringify(CONTROLS)},$=id=>document.getElementById(id);
let state=H.normalize(readHash()||{family:'photo'}),view='dither',queued=0;
function readHash(){try{return location.hash.length>1?JSON.parse(decodeURIComponent(location.hash.slice(1))):null;}catch(e){return null;}}
function draw(){cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{const t0=performance.now(),r=H.render(state,{view});$('stage').innerHTML=r.svg;
 $('caption-line').textContent=r.stats.cells.toLocaleString()+' pixels; '+r.stats.inks.length+' inks; '+Math.round(performance.now()-t0)+' ms';history.replaceState(null,'','#'+encodeURIComponent(JSON.stringify(state)));});}
function range(c){return '<label for="'+c.id+'">'+c.name+' <output id="'+c.id+'-out">'+state.params[c.id]+(c.unit?' '+c.unit:'')+'</output></label><input type="range" id="'+c.id+'" min="'+c.min+'" max="'+c.max+'" step="'+c.step+'" value="'+state.params[c.id]+'">';}
function build(){for(const g of ['letters','relief','outside','tone','dither','pixels','layout']){const list=CONTROLS.filter(c=>c.group===g);$('controls-'+g).innerHTML=list.map(range).join('');
  list.forEach(c=>{const el=$(c.id);el.addEventListener('input',()=>{state.params[c.id]=+el.value;$(c.id+'-out').textContent=el.value+(c.unit?' '+c.unit:'');dim();draw();});});}
 for(const id of ['face','construct','warp','case','align','profile','fill','method','mark','layout','format','palette']){const el=$(id);el.value=state[id];el.onchange=()=>{state[id]=el.value;dim();draw();};}
 $('text').value=state.text;$('caption').value=state.caption;$('family').value=state.family;$('family-note').textContent=(H.FAMILIES.find(f=>f.id===state.family)||{}).note||'';dim();}
function dim(){for(const c of CONTROLS){const el=$(c.id),on=H.applies(c.id,state);el.disabled=!on;el.previousElementSibling.classList.toggle('off',!on);}
 const cap=$('caption'),on=H.applies('caption',state);cap.disabled=!on;cap.previousElementSibling.classList.toggle('off',!on);}
function load(s){state=H.normalize(s);build();draw();}
$('text').oninput=()=>{state.text=$('text').value.replace(/\\n/g,'/');draw();};$('caption').oninput=()=>{state.caption=$('caption').value;draw();};
$('family').onchange=()=>load({family:$('family').value,text:state.text});$('reset').onclick=()=>load({family:state.family});
document.querySelectorAll('.probe').forEach(b=>b.onclick=()=>{state.text=b.dataset.text;$('text').value=state.text;draw();});
$('new-seed').onclick=()=>{state.params.seed=1+Math.floor(Math.random()*99);build();draw();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw();});
document.querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{load({family:b.dataset.family});scrollTo({top:0,behavior:'smooth'});});
const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
$('save-svg').onclick=()=>save(new Blob([H.render(state).svg],{type:'image/svg+xml'}),'heavy-dither-type-'+state.family+'.svg');
$('save-rule').onclick=()=>save(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'heavy-dither-type-'+state.family+'.json');
$('save-png').onclick=()=>{const r=H.render(state),k=3000/Math.max(r.width,r.height),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=Math.round(r.width*k);c.height=Math.round(r.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>save(b,'heavy-dither-type-'+state.family+'.png'));};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(r.svg);};
$('load-rule').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{load(JSON.parse(await f.text()));$('status').textContent='Opened '+f.name+'.';}catch(err){$('status').textContent='That file is not a heavy-dither type rule.';}};
build();draw();
</script></html>`;}
