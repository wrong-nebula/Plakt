// The editor: one offline page with the engine (and its glyph outlines) bundled in.
export function workshopHTML({engine,FAMILIES,CONTROLS,SHAPES,LABELS,reference}){
const count=FAMILIES.length,groups=[['pixels','Pixels',['mark']],['dither','Dither',['method']],['light','Light',[]],['tone','Tone',[]],['layout','Layout',['arrangement','format','palette','font']]];
const select=(id,name)=>`<label for="${id}">${name}</label><select id="${id}">${Object.entries(LABELS[id]).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>`;
const names={mark:'Marks',method:'Method',arrangement:'Arrangement',format:'Format',palette:'Palette',font:'Headline face'};
const shapeOptions=['Volumes','Fills','Type'].map(g=>`<optgroup label="${g}">${Object.entries(SHAPES).filter(([,s])=>s.group===g).map(([k,s])=>`<option value="${k}">${s.name}</option>`).join('')}</optgroup>`).join('');
return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Heavy dither</title><style>
*{box-sizing:border-box}body{margin:0;background:#ecebe6;color:#26272b;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}button,input,select{font:inherit;color:inherit}button,summary{cursor:pointer}a{color:inherit;text-underline-offset:3px}
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #e0185c;outline-offset:3px}
header{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:25px 30px;border-bottom:1px solid #d0cec7}h1{font-size:29px;line-height:1.2;letter-spacing:-.7px;margin:0}header p{font-size:13px;color:#696a70;margin:6px 0 0;max-width:900px}header a{font-size:12px;white-space:nowrap}
.workspace{max-width:1800px;margin:auto;padding:26px 30px 40px;display:grid;grid-template-columns:300px minmax(0,1fr);gap:28px;align-items:start}
label,.label{display:block;font-size:12px;font-weight:600;margin:14px 0 6px}label output{float:right;font-weight:400;color:#696a70;font-variant-numeric:tabular-nums}
input[type=text],select{width:100%;padding:7px 9px;border:1px solid #bdbcc2;border-radius:4px;background:#fbfbf9}input[type=range]{width:100%;accent-color:#e0185c}input:disabled,select:disabled{opacity:.35}label.off{color:#a4a3a9}
.hint{font-size:12px;color:#696a70;margin:7px 0 0}.row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}button.small{background:none;border:1px solid #bdbcc2;border-radius:4px;padding:5px 8px;font-size:12px}
details.group{border-top:1px solid #d0cec7;margin-top:16px;padding-top:2px}details.group>summary{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#696a70;margin:10px 0 0;font-weight:600}
.item{border:1px solid #d0cec7;border-radius:6px;padding:4px 10px 10px;margin-top:10px;background:#f5f4f0}.item summary{font-size:13px;font-weight:600;padding:6px 0}.item .row{margin-top:8px}.item label{margin:10px 0 4px}.check{display:flex;gap:8px;align-items:center;font-weight:400}
.exports{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:22px}.exports button{background:#e0185c;color:white;border:1px solid #e0185c;padding:8px 10px;border-radius:4px;font-size:12px}.exports button.quiet{background:none;color:#b0124a}input[type=file]{display:block;max-width:100%;font-size:12px;margin-top:10px}
.views{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}.views button{background:none;border:1px solid #bdbcc2;border-radius:4px;padding:7px 10px;font-size:12px}.views button[aria-pressed=true]{background:#fbd9e5;border-color:#e86b96}
.comparison{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start;max-width:1180px;margin:auto}.comparison.solo{grid-template-columns:minmax(0,640px);justify-content:center}.comparison.solo .reference{display:none}
figure{margin:0;min-width:0}figure img{display:block;width:100%;height:auto;image-rendering:pixelated}figcaption{font-size:12px;color:#696a70;margin-top:10px}figcaption strong{color:#3b3c41}.stage{line-height:0;box-shadow:0 8px 24px #26272b14}.stage svg{width:100%;height:auto;display:block}
.caption{font-size:12px;color:#696a70;margin:16px auto 0;max-width:1180px}.gallery{max-width:1800px;margin:auto;border-top:1px solid #d0cec7;padding:35px 30px 45px}.gallery h2{font-size:25px;letter-spacing:-.5px;margin:0 0 8px}
.families{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:20px;margin-top:22px}.families button{all:unset;cursor:pointer;display:block}.families img{display:block;width:100%;height:auto;image-rendering:pixelated}.families figcaption{margin-top:9px;font-size:13px}.families p{font-size:12px;color:#696a70;margin:3px 0}.sheets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:20px}.notes{font-size:13px;line-height:1.6;max-width:980px;color:#5c5d62}
@media(max-width:1250px){.families{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1050px){.workspace{grid-template-columns:260px minmax(0,1fr);gap:20px;padding:22px}.families{grid-template-columns:repeat(3,minmax(0,1fr))}header{padding:22px}.gallery{padding:30px 22px}}
@media(max-width:720px){header{display:block;padding:20px 16px}header a{display:inline-block;margin-top:12px}.workspace{display:flex;flex-direction:column;padding:18px 16px}.display{width:100%}aside{order:1;width:100%;border-top:1px solid #d0cec7;padding-top:10px}.comparison{grid-template-columns:minmax(0,1fr)}.gallery{padding:25px 16px}.families,.sheets{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}h1{font-size:26px}}
</style><header><div><h1>Heavy dither</h1><p>Shapes as tone: lit volumes, fills and soft copy composed into one picture and dithered into big pixels, LEDs, dots, scan lines, diamonds or stitches, in two to four inks. After a dithered photograph in a black frame; ${count} styles, fourteen dither methods, seven arrangements, any shapes.</p></div><a href="#styles">See the ${count} styles ↓</a></header>
<main><div class="workspace"><aside aria-label="Heavy dither controls">
<label for="family">Style</label><select id="family">${FAMILIES.map(f=>`<option value="${f.id}">${f.name}</option>`).join('')}</select><p class="hint" id="family-note"></p>
<div class="row"><button class="small" id="surprise">Surprise</button><button class="small" id="reset">Reset style</button></div>
<details class="group" open><summary>Shapes</summary><div id="items"></div><label for="add">Add a shape</label><select id="add"><option value="">Choose…</option>${shapeOptions}</select><p class="hint">Volumes are lit from the light below; fills give tone directly; copy is set type, softened and lit. Items paint in order with their blend.</p></details>
${groups.map(([id,name,sel],i)=>`<details class="group"${i<2?' open':''}><summary>${name}</summary>${sel.map(s=>select(s,names[s])).join('')}<div id="controls-${id}"></div>${id==='layout'?'<label for="title">Headline</label><input type="text" id="title" maxlength="60"><p class="hint">For the picture-over-headline arrangement; “/” starts a new line.</p>':''}</details>`).join('')}
<div class="exports"><button id="save-svg">SVG</button><button id="save-png">PNG</button><button id="save-rule" class="quiet">Save rule</button><button id="new-seed" class="quiet">New seed</button></div>
<p class="hint" id="status" role="status" aria-live="polite">SVG keeps every pixel as a vector run, one path per ink. PNG exports at a 3000 px long edge.</p>
<details class="hint"><summary>Open a saved rule</summary><input type="file" id="load-rule" accept="application/json,.json" aria-label="Open a saved heavy-dither rule"></details>
</aside>
<div class="display"><nav class="views" aria-label="View"><button data-view="dither" aria-pressed="true">Dithered</button><button data-view="tone" aria-pressed="false">Tone before dithering</button></nav>
<div class="comparison" id="comparison"><figure class="reference"><img src="${reference}" alt="The reference: a photograph dithered to coarse black pixels inside a black frame"><figcaption><strong>Reference</strong><br>A dithered photograph in a black frame, from the user. Kept for study; nothing is traced.</figcaption></figure>
<figure><div id="stage" class="stage"></div><figcaption><strong>Shape system study</strong><br><span id="study-note"></span></figcaption></figure></div><p class="caption" id="caption"></p></div></div>
<section class="gallery" id="styles"><h2>${count} styles</h2><p class="notes">One stays close to the reference (Framed print); the rest are new. Choose one to open it.</p>
<div class="families">${FAMILIES.map((f,i)=>`<figure><button data-family="${f.id}" aria-label="Open ${f.name}"><img src="${f.id}.png" alt="${f.name}" loading="lazy"></button><figcaption><strong>${String(i+1).padStart(2,'0')} / ${f.name}</strong><p>${f.note}</p></figcaption></figure>`).join('')}</div>
<h2 style="margin-top:40px">Sheets</h2><div class="sheets"><figure><a href="sheets/methods.png"><img src="sheets/methods.png" alt="The source picture through every dither method" loading="lazy"></a><figcaption>The source picture through all fourteen methods</figcaption></figure><figure><a href="sheets/shapes.png"><img src="sheets/shapes.png" alt="Every shape in the atlas" loading="lazy"></a><figcaption>Every shape, one construction</figcaption></figure><figure><a href="sheets/marks.png"><img src="sheets/marks.png" alt="One picture in every mark" loading="lazy"></a><figcaption>One picture in every mark</figcaption></figure></div>
<p class="notes">Copy and labels use SIL Open Font License faces: Archivo Black, Anton, Bebas Neue, Unbounded Black, Rubik Mono One and DM Serif Display.</p></section></main>
<script>${engine}</script><script>
const H=HeavyDither,CONTROLS=${JSON.stringify(CONTROLS)},$=id=>document.getElementById(id);
let state=H.normalize(readHash()||{family:'framed'}),view='dither',queued=0,seed=1;
function readHash(){try{return location.hash.length>1?JSON.parse(decodeURIComponent(location.hash.slice(1))):null;}catch(e){return null;}}
function draw(draft){cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{const r=H.render(state,{view,draft});$('stage').innerHTML=r.svg;
 $('caption').textContent=r.stats.cells.toLocaleString()+' pixels in '+r.stats.panels+' panel'+(r.stats.panels>1?'s':'')+'; '+r.stats.inks.length+' inks'+(draft?' (draft while dragging)':'');
 if(!draft)history.replaceState(null,'','#'+encodeURIComponent(JSON.stringify(state)));});}
function range(c,value,onInput,prefix=''){const id=prefix+c.id;return {html:'<label for="'+id+'">'+c.name+' <output id="'+id+'-out">'+value+(c.unit||'')+'</output></label><input type="range" id="'+id+'" min="'+c.min+'" max="'+c.max+'" step="'+c.step+'" value="'+value+'">',bind(){const el=$(id),out=$(id+'-out');el.addEventListener('input',()=>{out.textContent=el.value+(c.unit||'');onInput(+el.value,true);});el.addEventListener('change',()=>onInput(+el.value,false));}};}
function buildControls(){for(const g of ['pixels','dither','light','tone','layout']){const list=CONTROLS.filter(c=>c.group===g),parts=list.map(c=>range(c,state.params[c.id],(v,draft)=>{state.params[c.id]=v;dim();draw(draft);}));
  $('controls-'+g).innerHTML=parts.map(p=>p.html).join('');parts.forEach(p=>p.bind());}
 for(const id of ['mark','method','arrangement','format','palette','font']){const el=$(id);el.value=state[id];el.onchange=()=>{state[id]=el.value;dim();draw(false);};}
 $('title').value=state.title;$('title').oninput=()=>{state.title=$('title').value;draw(false);};
 $('family').value=state.family;$('family-note').textContent=(H.FAMILIES.find(f=>f.id===state.family)||{}).note||'';
 $('comparison').classList.toggle('solo',state.family!=='framed');$('study-note').textContent=state.family==='framed'?'The source kept as one style: swirl, stripes and blobs, Atkinson with ordered checks.':(H.FAMILIES.find(f=>f.id===state.family)||{}).note||'';
 buildItems();dim();}
function buildItems(){const host=$('items');host.innerHTML='';state.items.forEach((it,k)=>{const d=document.createElement('details');d.className='item';d.open=state.items.length<=2;
  const sliders=H.ITEM_CONTROLS.map(c=>range(c,it[c.id],(v,draft)=>{state.items[k][c.id]=v;draw(draft);},'i'+k+'-'));
  d.innerHTML='<summary>'+(k+1)+'. '+H.SHAPES[it.shape].name+'</summary><label for="i'+k+'-shape">Shape</label><select id="i'+k+'-shape">'+$('add').innerHTML.replace('<option value="">Choose…</option>','')+'</select>'
   +'<label for="i'+k+'-blend">Blend</label><select id="i'+k+'-blend">'+Object.entries(H.BLENDS).map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select>'
   +'<label class="check"><input type="checkbox" id="i'+k+'-invert"> Invert its tone</label>'
   +(it.shape==='copy'?'<label for="i'+k+'-text">Copy</label><input type="text" id="i'+k+'-text" maxlength="60"><label for="i'+k+'-font">Face</label><select id="i'+k+'-font">'+Object.entries(H.LABELS.font).map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select>':'')
   +sliders.map(s=>s.html).join('')+'<div class="row"><button class="small" data-act="up">↑</button><button class="small" data-act="down">↓</button><button class="small" data-act="dup">Duplicate</button><button class="small" data-act="del">Remove</button></div>';
  host.appendChild(d);sliders.forEach(s=>s.bind());
  const sh=$('i'+k+'-shape');sh.value=it.shape;sh.onchange=()=>{it.shape=sh.value;buildItems();dim();draw(false);};
  const bl=$('i'+k+'-blend');bl.value=it.blend;bl.onchange=()=>{it.blend=bl.value;draw(false);};
  const iv=$('i'+k+'-invert');iv.checked=it.invert;iv.onchange=()=>{it.invert=iv.checked;draw(false);};
  if(it.shape==='copy'){const tx=$('i'+k+'-text');tx.value=it.text;tx.oninput=()=>{it.text=tx.value;draw(false);};const fo=$('i'+k+'-font');fo.value=it.font;fo.onchange=()=>{it.font=fo.value;draw(false);};}
  d.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{const a=b.dataset.act,L=state.items;
   if(a==='up'&&k>0)[L[k-1],L[k]]=[L[k],L[k-1]];else if(a==='down'&&k<L.length-1)[L[k+1],L[k]]=[L[k],L[k+1]];else if(a==='dup'&&L.length<24)L.splice(k+1,0,{...it});else if(a==='del')L.splice(k,1);
   buildItems();dim();draw(false);});});}
function dim(){for(const c of CONTROLS){const el=$(c.id);if(!el)continue;const on=H.applies(c.id,state);el.disabled=!on;el.previousElementSibling.classList.toggle('off',!on);}
 const t=$('title');t.disabled=!H.applies('title',state);t.previousElementSibling.classList.toggle('off',t.disabled);}
function load(s){state=H.normalize(s);buildControls();draw(false);}
$('family').onchange=()=>load({family:$('family').value});$('reset').onclick=()=>load({family:state.family});$('surprise').onclick=()=>load(H.surprise(seed++));
$('new-seed').onclick=()=>{state.params.seed=1+Math.floor(Math.random()*99);state.items.forEach(it=>it.seed=1+Math.floor(Math.random()*99));buildControls();draw(false);};
$('add').onchange=()=>{const v=$('add').value;if(!v)return;if(state.items.length<24)state.items.push({...H.normalize({items:[{shape:v,text:'DITHER'}]}).items[0],size:v==='copy'?.8:.6});$('add').value='';buildItems();dim();draw(false);};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw(false);});
document.querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{load({family:b.dataset.family});scrollTo({top:0,behavior:'smooth'});});
const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
$('save-svg').onclick=()=>save(new Blob([H.render(state).svg],{type:'image/svg+xml'}),'heavy-dither-'+state.family+'.svg');
$('save-rule').onclick=()=>save(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'heavy-dither-'+state.family+'.json');
$('save-png').onclick=()=>{const r=H.render(state),k=3000/Math.max(r.width,r.height),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=Math.round(r.width*k);c.height=Math.round(r.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>save(b,'heavy-dither-'+state.family+'.png'));};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(r.svg);};
$('load-rule').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{load(JSON.parse(await f.text()));$('status').textContent='Opened '+f.name+'.';}catch(err){$('status').textContent='That file is not a heavy-dither rule.';}};
buildControls();draw(false);
</script></html>`;}
