// The offline editor: one HTML file with the engine bundled in. Elements, effectors and modifiers stack
// in the panel; fields follow the pointer or move on their own over a seamless loop.
export function workshopHTML({engine,recipes,samples,evidence,app=false}){
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Effectors and modifiers</title><style>
*{box-sizing:border-box}body{margin:0;background:#ecebe6;color:#26272b;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}button,input,select,textarea{font:inherit;color:inherit}button,summary{cursor:pointer}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid #1d3de6;outline-offset:2px}a{color:inherit;text-underline-offset:3px}
header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;padding:22px 28px;border-bottom:1px solid #d0cec7}h1{font-size:27px;line-height:1.15;letter-spacing:-.6px;margin:0}header p{font-size:13px;color:#696a70;margin:6px 0 0;max-width:760px}
.workspace{max-width:1800px;margin:auto;padding:22px 28px 36px;display:grid;grid-template-columns:330px minmax(0,1fr);gap:28px;align-items:start}
.panel{display:flex;flex-direction:column;gap:14px}.section{border-top:1px solid #d0cec7;padding-top:10px}.section>h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#696a70;margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}
.ctl{margin:8px 0}.ctl label{display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:4px}.ctl output{font-weight:400;color:#696a70;font-variant-numeric:tabular-nums}.ctl.check{display:flex;gap:8px;align-items:center}.ctl.check label{margin:0;font-weight:500}
input[type=range]{width:100%;accent-color:#1d3de6;margin:0}select,input[type=text],input[type=number],textarea{width:100%;padding:6px 8px;border:1px solid #bdbcc2;border-radius:4px;background:#fbfbf9}textarea{min-height:70px;font-size:12px;resize:vertical}
.row{display:flex;gap:8px}.row>*{flex:1}.swatches{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.swatches label{font-size:11px;color:#696a70;display:block}.swatches input{display:block;width:100%;height:30px;border:1px solid #bdbcc2;border-radius:4px;padding:2px;background:#fbfbf9}
.pick{display:flex;gap:6px}.pick select{flex:1}.pick input[type=color]{width:44px;height:30px;border:1px solid #bdbcc2;border-radius:4px;padding:2px;background:#fbfbf9;flex:none}
.hint,.about{font-size:12px;color:#696a70;margin:4px 0 0}
details.card{background:#f6f5f1;border:1px solid #d6d4cd;border-radius:6px;margin:6px 0}details.card>summary{list-style:none;display:flex;align-items:center;gap:8px;padding:7px 8px;font-weight:600;font-size:13px}details.card>summary::-webkit-details-marker{display:none}
details.card>summary .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}details.card>summary .tag{font-weight:400;color:#77777c;font-size:11px}details.card[open]>summary{border-bottom:1px solid #e1dfd8}details.card .body{padding:2px 10px 10px}
details.card.off>summary .name{color:#9a9a9f;text-decoration:line-through}.icon{border:0;background:none;padding:2px 5px;border-radius:3px;color:#5c5d62;font-size:13px;line-height:1}.icon:hover{background:#e3e1da}
details.field{border-top:1px dashed #d0cec7;margin-top:8px;padding-top:4px}details.field>summary{font-size:12px;font-weight:600;color:#3b3c41;padding:4px 0}
.add{margin-top:6px}.children{margin:8px 0 4px 4px;padding-left:8px;border-left:2px solid #c9c6bd}details.card.group>summary .name{color:#1d3de6}.buttons{display:flex;flex-wrap:wrap;gap:6px}.buttons button{border:1px solid #bdbcc2;background:#fbfbf9;border-radius:4px;padding:6px 9px;font-size:12px}.buttons button.primary{background:#1d3de6;border-color:#1d3de6;color:#fff}.buttons button:disabled{opacity:.4;cursor:default}
.stagewrap{position:sticky;top:12px;min-width:0}.stage{display:flex;justify-content:center}canvas#stage{display:block;box-shadow:0 8px 28px #26272b22;touch-action:none;cursor:crosshair;max-width:100%}
.caption{display:flex;justify-content:space-between;gap:16px;font-size:12px;color:#696a70;margin:12px auto 0}.transport{display:flex;gap:8px;align-items:center;margin:12px auto 0;flex-wrap:wrap}.transport input[type=range]{flex:1;min-width:120px}.transport button{border:1px solid #bdbcc2;background:#fbfbf9;border-radius:4px;padding:6px 10px;font-size:12px}
.gallery,.notes{max-width:1800px;margin:auto;border-top:1px solid #d0cec7;padding:28px}.gallery h2,.notes h2{font-size:22px;letter-spacing:-.4px;margin:0 0 6px}.recipes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-top:16px}
.recipes button{border:0;padding:0;background:none;text-align:left}.recipes img{display:block;width:100%;aspect-ratio:1000/1414;object-fit:cover;background:#d9d8d2;box-shadow:0 3px 10px #26272b18}.recipes span{display:block;font-size:12px;font-weight:600;margin-top:6px}.recipes small{display:block;font-size:11px;color:#77777c}
.notes{font-size:13px;color:#4d4e53;line-height:1.6}.notes p{max-width:900px}.notes table{border-collapse:collapse;font-size:12px;margin-top:10px;width:100%;max-width:1200px}.notes td,.notes th{text-align:left;border-top:1px solid #d6d4cd;padding:6px 10px 6px 0;vertical-align:top}.notes th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#77777c}
body.app header,body.app .gallery,body.app .notes{display:none}body.app .workspace{padding-top:16px}body.app .stagewrap{top:8px}
@media(max-width:900px){.workspace{grid-template-columns:1fr;padding:16px}.stagewrap{position:static;order:-1}header{padding:18px 16px;flex-direction:column;align-items:flex-start}.gallery,.notes{padding:22px 16px}}
</style>
<body class="${app?'app':''}">
<header><div><h1>Effectors and modifiers</h1><p>Put a field on top of a grid, rules, dashes, rings, type or any SVG. <strong>Effectors</strong> move, scale, turn, lift and colour each element inside the field. <strong>Modifiers</strong> then bend, cut, mirror and repeat the outlines themselves. Fields follow the pointer, or move on their own over a seamless loop.</p></div><a href="#notes">How it works</a></header>
<main class="workspace">
<div class="panel" id="panel"></div>
<div class="stagewrap"><div class="stage" id="stagebox"><canvas id="stage" aria-label="Poster preview"></canvas></div>
<div class="transport"><button id="play" type="button">Pause</button><label for="scrub" class="hint" style="margin:0">Loop</label><input id="scrub" type="range" min="0" max="1" step=".001" value="0" aria-label="Position in the loop"><label class="hint" style="margin:0"><input type="checkbox" id="showfields"> Show fields</label></div>
<div class="caption"><span id="caption"></span><span id="perf"></span></div></div>
</main>
<section class="gallery"><h2>Recipes</h2><p class="hint">Each recipe is a starting stack. Change anything, or press Shuffle for a random one.</p><div class="recipes" id="recipes"></div></section>
<section class="notes" id="notes"><h2>How it works</h2>
<p><strong>Elements</strong> become clones: every cell, rule segment, dash, arc, letter (or word, or line) and SVG shape is one clone with a position, size, rotation, colour and depth. <strong>Effectors</strong> change those per clone, in order, each weighted by its <strong>field</strong>: radial, linear, ring, box, noise or everywhere, soft or hard, inverted or not. A field can follow the pointer, sit still (drag its handle with Show fields on), or orbit, sweep, wander, pulse or rotate. Every motion completes whole cycles in the loop, so the loop repeats seamlessly.</p>
<p><strong>Modifiers</strong> come after the effectors and work on outlines. Bending modifiers move every outline point, so long rules and big letters curve smoothly. Cutting modifiers clip outlines along lines and copy them: mirror, kaleidoscope, echo, slice and shatter. Inline rebuilds each outline as concentric bands before it is placed. Stack them in any order; each can target all elements or one.</p>
<p>The modifier set came from a survey of all 1,132 posters in the PosterLab library and all 1,399 in the Japanese archive, looking for distortions that recur. The examples below are where each one shows up; the modifiers are new general constructions, and nothing is traced.</p>
<table><thead><tr><th>Modifier</th><th>Seen in</th></tr></thead><tbody>${evidence.map(([m,t])=>`<tr><td>${esc(m)}</td><td>${esc(t)}</td></tr>`).join('')}</tbody></table>
<p class="hint">Exports are plain filled outlines (SVG), PNGs at up to 4000 px, or a JSON rule that reopens here. The link in the address bar carries the whole stack except imported artwork.</p></section>
<script>${engine}</script>
<script>
const APP=${app},native=window.webkit?.messageHandlers?.effectors,E=Effectors,RECIPE_META=${JSON.stringify(recipes)},SAMPLES=${JSON.stringify(samples)};
const $=s=>document.querySelector(s),panel=$('#panel'),cv=$('#stage'),g=cv.getContext('2d');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const GLOBAL_FIELD={effectors:['wave','jitter','spin','snap','flow','recolour'],modifiers:['weight','round','outline','petal','swirl','zigzag','tiles','dial','burst','repeat','shadow','fold','screen','dither','wave','turbulence','shear','taper','bend','polar','spherize','ribbon','envelope','perspective','melt','roughen','mirror','kaleido','echo','slice','inline']};
const CATS={layers:E.LAYERS,effectors:E.EFFECTORS,modifiers:E.MODIFIERS,colours:E.COLOURS};
let state=E.normalize({recipe:E.DEFAULT_RECIPE}),scene,open=new Map(),specs=new Map();
// Cards keep their open state by a stable id on each item, so reordering, duplicating and undo keep it.
const rid=()=>'u'+Math.random().toString(36).slice(2,9);
function ensureUids(s){for(const k of ['layers','effectors','modifiers','colours'])for(const it of s[k]||[]){if(!it.uid)it.uid=rid();for(const c of it.children||[])if(!c.uid)c.uid=rid();}}
const getList=path=>path.split('.').reduce((o,k)=>o?.[k],state);
let t=0,last=performance.now(),playing=true,inertia=.35,dirty=true,cur=null,vel=null,lastOps=[],lastCtx=null,showFields=false;
// The live view paints colour cells at draft precision; exports redo the same frame at full precision.
const finalOps=()=>cur&&lastCtx?E.compose(scene,state,cur,{...lastCtx,draft:false}):lastOps;
const ptr={in:false,x:.5,y:.5,sx:.5,sy:.5,w:0,moved:0};let drag=null;

// ------------------------------------------------ state
function readHash(){try{const h=location.hash.slice(1);if(!h)return null;const b=atob(h.replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0))));}catch{return null;}}
let hashTimer=0;function writeHash(){if(APP)return;clearTimeout(hashTimer);hashTimer=setTimeout(()=>{const s={...state,layers:state.layers.map(l=>l.type==='artwork'?{...l,svg:''}:l)};const bytes=new TextEncoder().encode(JSON.stringify(s));let b='';bytes.forEach(v=>b+=String.fromCharCode(v));history.replaceState(null,'','#'+btoa(b).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''));},250);}
function commit(rebuild,restoring){const w=scene?.W,h=scene?.H;ensureUids(state);state=E.normalize(state);scene=E.prepare(state);dirty=true;if(scene.W!==w||scene.H!==h)fit();if(rebuild)buildPanel();writeHash();caption();if(restoring)undoButtons();else if(rebuild)record();else remember();}
function setPath(path,v){const ks=path.split('.');let o=state;for(let i=0;i<ks.length-1;i++)o=o[ks[i]];o[ks[ks.length-1]]=v;}
function custom(path){if(/^(layers|effectors|modifiers|colours)/.test(path)&&state.recipe!=='custom'){state.recipe='custom';const r=$('#recipe');if(r)r.value='custom';}}
function load(next,openFirst=true){ensureUids(next);state=E.normalize(next);open=new Map();if(openFirst)for(const k of ['effectors','modifiers','colours'])if(state[k][0])open.set(state[k][0].uid,true);cur=null;commit(true);}

// ------------------------------------------------ panel
let uid=0;
const unit=s=>s.unit==='u'?' u':s.unit==='per loop'?' / loop':s.unit==='cells'?' cells':s.unit||'';
const fmt=(v,s)=>(s.step>=1?Math.round(v):(+v).toFixed(s.step>=.1?1:2))+unit(s);
function control(s,v,path){const id='c'+uid++;specs.set(path,s);
 if(s.type==='range')return '<div class="ctl"><label for="'+id+'">'+s.name+'<output>'+fmt(v,s)+'</output></label><input id="'+id+'" type="range" min="'+s.min+'" max="'+s.max+'" step="'+s.step+'" value="'+v+'" data-path="'+path+'"></div>';
 if(s.type==='select')return '<div class="ctl"><label for="'+id+'">'+s.name+'</label><select id="'+id+'" data-path="'+path+'">'+s.options.map(([o,l])=>'<option value="'+o+'"'+(o===v?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></div>';
 // A colour is a palette role, white, black or any hex; the swatch picks a custom one.
 if(s.type==='colour'){const named=E.COLOUR_NAMES.some(c=>c[0]===v);return '<div class="ctl"><label for="'+id+'">'+s.name+'</label><div class="pick"><select id="'+id+'" data-path="'+path+'">'+E.COLOUR_NAMES.map(([o,l])=>'<option value="'+o+'"'+(o===v?' selected':'')+'>'+l+'</option>').join('')+'<option value="'+(named?E.colourHex(v,state.colors):v)+'"'+(named?'':' selected')+'>Custom</option></select><input type="color" value="'+E.colourHex(v,state.colors)+'" data-path="'+path+'" aria-label="'+esc(s.name)+', custom colour"></div></div>';}
 if(s.type==='toggle')return '<div class="ctl check"><input id="'+id+'" type="checkbox" data-path="'+path+'"'+(v?' checked':'')+'><label for="'+id+'">'+s.name+'</label></div>';
 return '<div class="ctl"><label for="'+id+'">'+s.name+'</label><input id="'+id+'" type="text" maxlength="'+s.max+'" value="'+esc(v)+'" data-path="'+path+'" spellcheck="false" autocomplete="off"><p class="hint">A slash starts a new line.</p></div>';}
const layerName=(l,i)=>(i+1)+' · '+E.LAYERS[l.type].name+(l.type==='text'||l.type==='matrix'?' “'+l.text.replace(/\\//g,' ').slice(0,14)+'”':l.type==='artwork'&&l.name?' “'+l.name.slice(0,14)+'”':'');
function card(list,i){const items=getList(list),item=items[i],top=list.split('.')[0],isLayer=top==='layers',child=list.endsWith('.children'),isGroup=item.type==='group';
 const def=isGroup?E.GROUP:CATS[top][item.type],p=list+'.'+i,o=open.get(item.uid),btn=(act,label,glyph,title='')=>'<button class="icon" type="button" data-act="'+act+'" data-list="'+list+'" data-index="'+i+'" aria-label="'+label+'"'+(title?' title="'+title+'"':'')+'>'+glyph+'</button>';
 const name=isLayer?esc(layerName(item,i)):isGroup?'Group · '+esc(E.GROUP.params[0].options.find(x=>x[0]===item.op)[1].split(':')[0]):def.name;
 let h='<details class="card'+(item.on?'':' off')+(isGroup?' group':'')+'" data-list="'+list+'" data-index="'+i+'" data-uid="'+item.uid+'"'+(o?' open':'')+'><summary><input type="checkbox" aria-label="'+(isLayer?'Show':'Turn on')+' '+def.name+'" data-path="'+p+'.on"'+(item.on?' checked':'')+'><span class="name">'+name+'</span>';
 if(!isLayer&&!child)h+='<span class="tag">'+(item.target==='all'?'all':item.target==='paper'?'paper':item.target==='page'?'poster':esc(layerName(state.layers.find(l=>l.id===item.target)||{type:'grid'},state.layers.findIndex(l=>l.id===item.target)).split(' · ')[0]))+'</span>';
 h+=btn('dice','Randomize '+def.name,'⚄','Randomize')+btn('dup','Duplicate '+def.name,'⧉','Duplicate')+btn('up','Move up','↑')+btn('down','Move down','↓')+btn('remove','Remove','✕')+'</summary><div class="body"><p class="about">'+esc(def.about)+'</p>';
 if(isLayer){
  for(const s of def.params)if(E.layerRelevant(s.id,item))h+=control(s,item[s.id],p+'.'+s.id);
  if(item.type==='artwork'){h+='<div class="ctl"><label>SVG file</label><input type="file" accept=".svg,image/svg+xml" data-artwork="'+i+'"></div>';
   if(SAMPLES.length)h+='<div class="ctl"><label>Sample from another system</label><select data-sample="'+i+'"><option value="">Choose…</option>'+SAMPLES.map((s,k)=>'<option value="'+k+'">'+esc(s.name)+'</option>').join('')+'</select></div>';
   h+='<div class="ctl"><label>Or paste SVG markup</label><textarea data-paste="'+i+'" placeholder="&lt;svg …"></textarea><div class="buttons" style="margin-top:6px"><button type="button" data-act="paste" data-index="'+i+'">Use pasted SVG</button></div></div><p class="hint">'+(item.svg?esc(item.name||'Imported artwork')+' · '+(scene?.layers[i]?.clones.length??0)+' shapes'+(scene?.layers[i]?.truncated?' (first 4000)':''):'No artwork yet.')+'</p>';}
  for(const s of E.LAYER_COMMON)if(s.id!=='on')h+=control(s,item[s.id],p+'.'+s.id);}
 else{
  if(!child)h+='<div class="ctl"><label>Acts on</label><select data-path="'+p+'.target"><option value="all"'+(item.target==='all'?' selected':'')+'>All elements</option>'+(top==='colours'?E.COLOUR_TARGETS.slice(1).map(([k,l])=>'<option value="'+k+'"'+(item.target===k?' selected':'')+'>'+l+'</option>').join(''):'')+state.layers.map((l,k)=>'<option value="'+l.id+'"'+(item.target===l.id?' selected':'')+'>'+esc(layerName(l,k))+'</option>').join('')+'</select></div>';
  h+=control(E.EFFECT_COMMON[1],item.strength,p+'.strength');
  for(const s of def.params)h+=control(s,item[s.id],p+'.'+s.id);
  // A group lists its children as nested cards; its own field masks all of them.
  if(isGroup)h+='<div class="children">'+(item.children||[]).map((_,k)=>card(p+'.children',k)).join('')+(item.children.length<E.MAX_CHILDREN?addSelect(p+'.children','Add to the group…'):'<p class="hint">A group holds up to '+E.MAX_CHILDREN+' modifiers.</p>')+'<div class="buttons" style="margin-top:6px"><button type="button" data-act="ungroup" data-list="'+list+'" data-index="'+i+'">Ungroup</button></div></div>';
  h+='<details class="field"'+(o==='field'?' open':'')+'><summary>'+(isGroup?'Mask field':top==='colours'&&def.uses==='ramp'?'Ramp field':'Field')+' · '+esc(E.FIELD[0].options.find(x=>x[0]===item.field.shape)[1])+(item.field.follow?', follows pointer':'')+'</summary>';
  for(const s of E.FIELD)if(E.fieldRelevant(s.id,item.field))h+=control(s,item.field[s.id],p+'.field.'+s.id);
  h+='</details>';}
 return h+'</div></details>';}
function addSelect(list,label){let o='<option value="">'+label+'</option>';const top=list.split('.')[0],child=list.endsWith('.children');
 if(top==='modifiers'){for(const [kind,name] of Object.entries(E.MODIFIER_KINDS))if(!(child&&kind==='shape'))o+='<optgroup label="'+name+'">'+Object.entries(E.MODIFIERS).filter(([,m])=>m.kind===kind).map(([k,m])=>'<option value="'+k+'">'+m.name+'</option>').join('')+'</optgroup>';
  if(!child)o+='<optgroup label="Combine"><option value="group">Empty group</option>'+Object.entries(E.COMBOS).map(([k,c])=>'<option value="combo:'+k+'">'+esc(c.name)+'</option>').join('')+'</optgroup>';}
 else o+=Object.entries(CATS[top]).map(([k,m])=>'<option value="'+k+'">'+m.name+'</option>').join('');
 return '<select class="add" data-add="'+list+'" aria-label="'+label+'">'+o+'</select>';}
function posterSection(){if(!APP)return '';const n=scene?.layers.find(l=>l.id==='L99')?.clones.length;
 return '<div class="section"><h2>Poster</h2><p class="about">'+(poster?esc(poster.name)+(n!==undefined?' · '+n+' outlines':''):'No poster. Select a generated poster before opening Effectors, or open an outlined PDF or SVG.')+'</p><div class="buttons" style="margin-top:8px"><button type="button" id="openvector">Open PDF or SVG…</button>'+(poster?'<button type="button" id="backtoposter">Start again from the poster</button>':'')+'</div>'+(poster?'<div class="ctl check"><input id="keepposter" type="checkbox"'+(keepPoster?' checked':'')+'><label for="keepposter">Recipes act on the poster</label></div><div class="ctl check"><input id="withelements" type="checkbox"'+(withElements?' checked':'')+(keepPoster?'':' disabled')+'><label for="withelements">Add the recipe’s own elements too</label></div>':'')+'</div>';}
function buildPanel(){uid=0;specs.clear();const groups={eff:[],mod:[],col:[]};for(const [k,r] of Object.entries(RECIPE_META))(r.colours?groups.col:r.modifiers?groups.mod:groups.eff).push([k,r]);
 const opt=([k,r])=>'<option value="'+k+'"'+(state.recipe===k?' selected':'')+'>'+esc(r.name)+'</option>';
 let h=posterSection()+'<div class="section"><h2>Recipe</h2><div class="row"><select id="recipe" aria-label="Recipe"><option value="custom"'+(state.recipe==='custom'?' selected':'')+'>Custom stack</option><optgroup label="Effectors">'+groups.eff.map(opt).join('')+'</optgroup><optgroup label="Modifiers">'+groups.mod.map(opt).join('')+'</optgroup><optgroup label="Colour">'+groups.col.map(opt).join('')+'</optgroup></select></div>';
 h+='<p class="about">'+esc(RECIPE_META[state.recipe]?.about||'Your own combination.')+'</p><div class="buttons" style="margin-top:8px"><button type="button" id="shuffle">Shuffle</button><button type="button" id="reset">Reset recipe</button><button type="button" id="undo" title="⌘Z"'+(undoLog.past.length?'':' disabled')+'>Undo</button><button type="button" id="redo" title="⇧⌘Z"'+(undoLog.future.length?'':' disabled')+'>Redo</button></div></div>';
 h+='<div class="section"><h2>Page</h2><div class="row">'+control({id:'format',name:'Format',type:'select',options:Object.entries(E.FORMATS).map(([k,f])=>[k,f.name])},state.format,'format')+control({id:'palette',name:'Palette',type:'select',options:[...Object.entries(E.PALETTES).map(([k,p])=>[k,p.name]),['custom','Custom']]},state.palette,'palette')+'</div>';
 h+='<div class="swatches">'+['Paper','Ink','Accent'].map((n,k)=>'<label>'+n+'<input type="color" value="'+state.colors[k]+'" data-color="'+k+'"></label>').join('')+'</div>';
 h+='<div class="row">'+control({id:'loop',name:'Loop',type:'range',min:2,max:20,step:.5,unit:'s'},state.loop,'loop')+'<div class="ctl"><label for="seed">Seed</label><input id="seed" type="number" min="0" max="999999" value="'+state.seed+'" data-path="seed"></div></div></div>';
 for(const [list,title,label] of [['layers','Elements','Add an element…'],['effectors','Effectors','Add an effector…'],['modifiers','Modifiers','Add a modifier…'],['colours','Colour','Add a colour modifier…']]){
  h+='<div class="section"><h2>'+title+'<span class="tag">'+state[list].length+'</span></h2>'+state[list].map((_,i)=>card(list,i)).join('')+addSelect(list,label)+(list==='modifiers'&&state.modifiers.filter(m=>m.type!=='group'&&E.MODIFIERS[m.type].kind!=='shape').length>1?'<div class="buttons" style="margin-top:6px"><button type="button" id="groupall" title="Wrap the bending and cutting modifiers in one group">Group them</button></div><p class="hint">Rebuild-the-outline modifiers always run first, on each element before it is placed.</p>':'')+'</div>';}
 h+='<div class="section"><h2>Motion</h2>'+control({id:'inertia',name:'Inertia',type:'range',min:0,max:.95,step:.01},inertia,'$inertia')+'<p class="hint">Elements spring towards where the effectors put them. Zero follows exactly.</p></div>';
 h+='<div class="section"><h2>Export</h2><div class="buttons"><button class="primary" type="button" id="svg">SVG</button><button class="primary" type="button" id="png">PNG</button><select id="pngsize" aria-label="PNG size" style="width:auto"><option value="2000">2000 px</option><option value="3000" selected>3000 px</option><option value="4000">4000 px</option></select>'+(APP?'<button class="primary" type="button" id="pdf">PDF</button>':'')+'<button type="button" id="json">Rule (JSON)</button>'+(APP?'':'<button type="button" id="link">Copy link</button>')+'</div><div class="ctl"><label for="openjson">Open a saved rule</label><input id="openjson" type="file" accept=".json,application/json"></div></div>';
 const y=window.scrollY;panel.innerHTML=h;window.scrollTo(0,y);}
panel.addEventListener('input',e=>{const el=e.target,path=el.dataset.path;
 if(el.dataset.color!==undefined){state.colors[+el.dataset.color]=el.value;state.palette='custom';commit(false);const ps=panel.querySelector('[data-path=palette]');if(ps)ps.value='custom';return;}
 // A colour modifier's swatch sets a custom hex; its select follows.
 if(el.type==='color'&&path){setPath(path,el.value);custom(path);commit(false);const sel=el.closest('.pick')?.querySelector('select');if(sel){const o=[...sel.options].at(-1);o.value=el.value;sel.value=el.value;}return;}
 if(!path)return;
 if(el.type==='range'){const v=parseFloat(el.value),s=specs.get(path);if(path==='$inertia'){inertia=v;}else{setPath(path,v);custom(path);commit(false);}el.closest('.ctl').querySelector('output').textContent=fmt(v,s);return;}
 if(el.type==='text'){setPath(path,el.value);custom(path);commit(false);const sum=el.closest('details.card')?.querySelector('summary .name');if(sum&&el.closest('[data-list=layers]'))sum.textContent=layerName(state.layers[+el.closest('details.card').dataset.index],+el.closest('details.card').dataset.index);}
 if(el.type==='number'){setPath(path,parseInt(el.value)||0);commit(false);}});
panel.addEventListener('change',e=>{const el=e.target;
 if(el.id==='recipe'){if(el.value!=='custom')applyRecipe(el.value);return;}
 if(el.id==='keepposter'){keepPoster=el.checked;buildPanel();return;}if(el.id==='withelements'){withElements=el.checked;return;}
 if(el.dataset.add){const list=el.dataset.add,top=list.split('.')[0],type=el.value;if(!type)return;let item={type};
  if(type==='group')item={type,op:'chain',field:{shape:'all',follow:false},children:[]};
  else if(type.startsWith('combo:'))item=structuredClone(E.COMBOS[type.slice(6)].group);
  else if(top==='layers'){let n=1;while(state.layers.some(l=>l.id==='L'+n))n++;item.id='L'+n;}else if(top==='colours')item.field={...E.COLOURS[type].field};else item.field=GLOBAL_FIELD[top].includes(type)?{shape:'all',follow:false}:{shape:'radial',follow:true,radius:.3,softness:.85};
  item.uid=rid();getList(list).push(item);open.set(item.uid,true);state.recipe='custom';commit(true);return;}
 if(el.dataset.artwork!==undefined&&el.files[0]){const i=+el.dataset.artwork,f=el.files[0];f.text().then(txt=>{state.layers[i].svg=txt;state.layers[i].name=f.name.replace(/\\.svg$/i,'');state.recipe='custom';commit(true);});return;}
 if(el.dataset.sample!==undefined&&el.value!==''){const i=+el.dataset.sample,s=SAMPLES[+el.value];state.layers[i].svg=s.svg;state.layers[i].name=s.name;state.recipe='custom';commit(true);return;}
 if(el.id==='openjson'&&el.files[0]){el.files[0].text().then(txt=>{try{load(JSON.parse(txt));}catch{alert('That file is not a saved rule.');}});return;}
 const path=el.dataset.path;if(!path)return;
 if(el.type==='checkbox'){setPath(path,el.checked);}else if(el.tagName==='SELECT'){setPath(path,el.value);if(path==='palette'&&E.PALETTES[el.value])state.colors=E.PALETTES[el.value].colors.slice();}else return;
 custom(path);commit(true);});
panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(e.target.closest('summary')&&(b.dataset.act))e.preventDefault();
 if(b.id==='shuffle'){const r=E.shuffle(Math.floor(Math.random()*1e6),state.format);load(onPoster()?{...r,layers:[posterLayer(),...(withElements?r.layers:[])]}:r);return;}
 if(b.id==='reset'){if(E.RECIPES[state.recipe])applyRecipe(state.recipe);return;}
 if(b.id==='groupall'){const keep=state.modifiers.filter(m=>m.type==='group'||E.MODIFIERS[m.type].kind==='shape'),kids=state.modifiers.filter(m=>!keep.includes(m)),g={type:'group',op:'chain',uid:rid(),field:{shape:'all',follow:false},children:kids.slice(0,E.MAX_CHILDREN)};state.modifiers=[...keep,g,...kids.slice(E.MAX_CHILDREN)];open.set(g.uid,true);state.recipe='custom';commit(true);return;}
 if(b.id==='undo'){travel(true);return;}if(b.id==='redo'){travel(false);return;}
 if(b.id==='openvector'){native?.postMessage({type:'openVector'});return;}
 if(b.id==='backtoposter'){startFromPoster();return;}
 if(b.id==='pdf'){save('pdf',E.toSVG(finalOps(),state,scene));return;}
 if(b.id==='svg'){save('svg',E.toSVG(finalOps(),state,scene));return;}
 if(b.id==='png'){exportPNG(+$('#pngsize').value);return;}
 if(b.id==='json'){save('json',JSON.stringify({...state,time:+(t%state.loop).toFixed(3)},null,2));return;}
 if(b.id==='link'){navigator.clipboard?.writeText(location.href).then(()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy link',1400);});return;}
 const {act,list}=b.dataset,i=+b.dataset.index;if(!act)return;
 if(act==='paste'){const txt=panel.querySelector('[data-paste="'+i+'"]').value;if(txt.trim()){state.layers[i].svg=txt;state.layers[i].name='Pasted SVG';state.recipe='custom';commit(true);}return;}
 const arr=getList(list),swap=(a,c)=>{[arr[a],arr[c]]=[arr[c],arr[a]];};
 if(act==='remove')arr.splice(i,1);else if(act==='up'&&i>0)swap(i,i-1);else if(act==='down'&&i<arr.length-1)swap(i,i+1);
 else if(act==='dup'){const c=structuredClone(arr[i]);delete c.uid;for(const k of c.children||[])delete k.uid;if(list==='layers'){let n=1;while(arr.some(l=>l.id==='L'+n))n++;c.id='L'+n;}arr.splice(i+1,0,c);ensureUids(state);open.set(c.uid,true);}
 else if(act==='ungroup'){const g=arr[i];arr.splice(i,1,...(g.children||[]).map(c=>({...c,target:g.target})));}
 else if(act==='dice')randomize(list,i);else return;
 state.recipe='custom';commit(true);});
panel.addEventListener('toggle',e=>{const d=e.target;if(d.matches?.('details.card')){const u=d.dataset.uid;if(d.open)open.set(u,open.get(u)==='field'?'field':true);else open.delete(u);}
 else if(d.matches?.('details.field')){const u=d.closest('details.card').dataset.uid;open.set(u,d.open?'field':true);}},true);
function caption(){$('#caption').textContent=E.describe(state)+' '+E.FORMATS[state.format].name+', '+state.loop+' s loop.';}

// Randomize one card: ranges move around their defaults, selects and toggles are redrawn, fields wander too.
function randomize(list,i){const item=getList(list)[i];if(item.type==='group'){item.op=['chain','add','average'][Math.floor(Math.random()*3)];(item.children||[]).forEach((_,k)=>randomize(list+'.'+i+'.children',k));return;}const def=CATS[list.split('.')[0]][item.type],r=Math.random,vary=(specs,o)=>{for(const p of specs){if(p.type==='range')o[p.id]=Math.min(p.max,Math.max(p.min,p.def+(r()-.5)*(p.max-p.min)*.6));else if(p.type==='select'&&r()<.6)o[p.id]=p.options[Math.floor(r()*p.options.length)][0];else if(p.type==='toggle')o[p.id]=r()<.4?!p.def:p.def;else if(p.type==='colour'&&r()<.6)o[p.id]=E.COLOUR_NAMES[Math.floor(r()*3)][0];}};
 vary(def.params,item);if(!list.startsWith('layers')){const f=item.field,keepAll=f.shape==='all';vary(E.FIELD.filter(p=>!['shape','follow','x','y','invert','steps'].includes(p.id)),f);if(!keepAll&&r()<.4)f.shape=['radial','linear','ring','box','noise'][Math.floor(r()*5)];}}
// Undo history: snapshots of the whole stack, with imported artwork stored once and referenced.
const undoLog={past:[],future:[],last:null,timer:0},svgs=[];
const snapshot=()=>JSON.stringify(state,(k,v)=>k==='svg'&&typeof v==='string'&&v?'@svg'+(svgs.includes(v)?svgs.indexOf(v):svgs.push(v)-1):v);
const unsnap=t=>JSON.parse(t,(k,v)=>k==='svg'&&typeof v==='string'&&v.startsWith('@svg')?svgs[+v.slice(4)]:v);
function record(){clearTimeout(undoLog.timer);undoLog.timer=0;const s=snapshot();if(s===undoLog.last)return;if(undoLog.last){undoLog.past.push(undoLog.last);if(undoLog.past.length>120)undoLog.past.shift();}undoLog.last=s;undoLog.future=[];undoButtons();}
function remember(){clearTimeout(undoLog.timer);undoLog.timer=setTimeout(record,350);}
function travel(back){if(undoLog.timer)record();const from=back?undoLog.past:undoLog.future,to=back?undoLog.future:undoLog.past;if(!from.length)return;to.push(undoLog.last);undoLog.last=from.pop();
 state=unsnap(undoLog.last);cur=null;commit(true,true);}
function undoButtons(){const u=$('#undo'),r=$('#redo');if(u)u.disabled=!undoLog.past.length;if(r)r.disabled=!undoLog.future.length;}
addEventListener('keydown',e=>{if(!(e.metaKey||e.ctrlKey)||e.target.closest('input[type=text],textarea'))return;const k=e.key.toLowerCase();if(k==='z'){e.preventDefault();travel(!e.shiftKey);}else if(k==='y'){e.preventDefault();travel(false);}});
// ------------------------------------------------ recipes gallery
$('#recipes').innerHTML=Object.entries(RECIPE_META).map(([k,r])=>'<button type="button" data-recipe="'+k+'"><img loading="lazy" src="recipes/'+k+'.png" alt=""><span>'+esc(r.name)+'</span><small>'+esc(r.modifiers?'Modifier':'Effector')+' · '+esc(r.list)+'</small></button>').join('');
$('#recipes').addEventListener('click',e=>{const b=e.target.closest('[data-recipe]');if(!b)return;load({recipe:b.dataset.recipe,format:state.format});window.scrollTo({top:0,behavior:'smooth'});});

// ------------------------------------------------ stage
let scale=1;
function fit(){const box=$('#stagebox'),W=scene.W,H=scene.H,maxW=box.clientWidth,maxH=Math.max(320,innerHeight-(innerWidth>900?150:120)),k=Math.min(maxW/W,maxH/H),dpr=Math.min(2,devicePixelRatio||1);
 cv.style.width=Math.round(W*k)+'px';cv.style.height=Math.round(H*k)+'px';cv.width=Math.round(W*k*dpr);cv.height=Math.round(H*k*dpr);scale=cv.width/W;$('.caption').style.maxWidth=cv.style.width;$('.transport').style.maxWidth=cv.style.width;dirty=true;}
new ResizeObserver(()=>fit()).observe($('#stagebox'));
// Colour modifiers' gradients, in page units like the outlines they fill.
function paintStyle(c,p){const gr=p.type==='linear'?c.createLinearGradient(p.x1,p.y1,p.x2,p.y2):c.createRadialGradient(p.cx,p.cy,0,p.cx,p.cy,p.r);
 for(const [o,h,a] of p.stops)gr.addColorStop(o,a<1?'rgba('+parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16)+','+a+')':h);return gr;}
function draw(c,ops,k){c.setTransform(k,0,0,k,0,0);c.globalAlpha=1;c.fillStyle=state.colors[0];c.fillRect(0,0,scene.W,scene.H);
 for(const op of ops){c.globalAlpha=op.a;c.fillStyle=op.paint?paintStyle(c,op.paint):op.fill;c.beginPath();for(const p of op.polys){c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.closePath();}c.fill();}c.globalAlpha=1;}
const lum=h=>{const v=parseInt(h.slice(1),16);return ((v>>16)*.299+((v>>8)&255)*.587+(v&255)*.114)/255;};
function gizmos(ctx){const gz=E.fieldGizmos(state,ctx),dark=lum(state.colors[0])<.5,fg=dark?'#ffffff':'#000000',halo=dark?'#000000aa':'#ffffffaa',px=cv.width/cv.clientWidth/scale;
 g.save();g.lineCap='round';
 const stroke=(fn,dash)=>{for(const [col,w] of [[halo,4],[fg,1.5]]){g.strokeStyle=col;g.lineWidth=w*px;g.setLineDash(dash?[6*px,5*px]:[]);g.beginPath();fn();g.stroke();}};
 for(const f of gz){const dash=f.list==='modifiers',L=Math.hypot(scene.W,scene.H);
  if(f.shape==='radial'||f.shape==='ring'){stroke(()=>g.arc(f.cx,f.cy,f.R,0,7),dash);if(f.softness<1&&f.shape==='radial')stroke(()=>g.arc(f.cx,f.cy,f.R*(1-f.softness),0,7),true);}
  else if(f.shape==='box'){const pts=[[1,1],[-1,1],[-1,-1],[1,-1]].map(([a,b])=>[f.cx+(a*f.dx-b*f.dy)*f.R,f.cy+(a*f.dy+b*f.dx)*f.R]);stroke(()=>{g.moveTo(...pts[3]);for(const q of pts)g.lineTo(...q);},dash);}
  // An angle sweep starts (and wraps) along a ray from its centre.
  else if(f.shape==='conic')stroke(()=>{g.moveTo(f.cx,f.cy);g.lineTo(f.cx+f.dx*L,f.cy+f.dy*L);},false);
  else if(f.shape==='linear'){const w=f.R*Math.max(f.softness,.02)/2;for(const o of [-w,0,w])stroke(()=>{g.moveTo(f.cx+f.dx*o-f.dy*L,f.cy+f.dy*o+f.dx*L);g.lineTo(f.cx+f.dx*o+f.dy*L,f.cy+f.dy*o-f.dx*L);},o!==0);stroke(()=>{g.moveTo(f.cx,f.cy);g.lineTo(f.cx+f.dx*40*px*2,f.cy+f.dy*40*px*2);},false);}
  stroke(()=>{g.moveTo(f.cx+7*px,f.cy);g.arc(f.cx,f.cy,7*px,0,7);},false);
  if(!f.follow&&['radial','ring','box'].includes(f.shape))stroke(()=>{g.moveTo(f.cx+f.R+5*px,f.cy);g.arc(f.cx+f.R,f.cy,5*px,0,7);},false);
  g.font=(12*px)+'px -apple-system,sans-serif';g.lineWidth=3*px;g.strokeStyle=halo;g.fillStyle=fg;const label=f.name+(f.follow?' · pointer':'');g.strokeText(label,f.cx+11*px,f.cy-10*px);g.fillText(label,f.cx+11*px,f.cy-10*px);}
 g.restore();return gz;}
let gz=[];
function pos(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
cv.addEventListener('pointermove',e=>{const p=pos(e);if(drag){const d=drag,f=getList(d.list)[d.index].field;
  if(d.kind==='center'){f.x=Math.min(1,Math.max(0,d.x0+(p.x-d.p.x)));f.y=Math.min(1,Math.max(0,d.y0+(p.y-d.p.y)));}else{f.radius=Math.min(1.5,Math.max(.02,Math.hypot((p.x*scene.W-d.cx),(p.y*scene.H-d.cy))/scene.M));}
  state.recipe='custom';commit(false);syncField(d);return;}
 ptr.in=true;ptr.x=p.x;ptr.y=p.y;ptr.moved=performance.now();
 const hit=hitTest(p);cv.style.cursor=hit?(hit.kind==='center'?'move':'ew-resize'):'crosshair';});
cv.addEventListener('pointerleave',()=>{if(!drag)ptr.in=false;});
cv.addEventListener('pointerdown',e=>{const p=pos(e),hit=showFields&&hitTest(p);if(hit){const f=getList(hit.list)[hit.index].field;drag={...hit,p,x0:f.x,y0:f.y};cv.setPointerCapture(e.pointerId);ptr.in=false;e.preventDefault();return;}
 if(e.pointerType!=='mouse'){ptr.in=true;ptr.x=p.x;ptr.y=p.y;ptr.sx=p.x;ptr.sy=p.y;}});
cv.addEventListener('pointerup',e=>{if(drag){drag=null;buildPanel();}if(e.pointerType!=='mouse')ptr.in=false;});
cv.addEventListener('pointercancel',()=>{drag=null;ptr.in=false;});
function hitTest(p){if(!showFields)return null;const x=p.x*scene.W,y=p.y*scene.H,tol=14/scale*(cv.width/cv.getBoundingClientRect().width);
 for(const f of gz){if(f.follow)continue;if(Math.hypot(x-f.cx,y-f.cy)<tol)return {kind:'center',list:f.list,index:f.index};if(['radial','ring','box'].includes(f.shape)&&Math.hypot(x-f.cx-f.R,y-f.cy)<tol)return {kind:'radius',list:f.list,index:f.index,cx:f.cx,cy:f.cy};}return null;}
function syncField(d){for(const k of ['x','y','radius']){const el=panel.querySelector('[data-path="'+d.list+'.'+d.index+'.field.'+k+'"]');if(el){const v=getList(d.list)[d.index].field[k];el.value=v;const o=el.closest('.ctl').querySelector('output');if(o)o.textContent=fmt(v,specs.get(el.dataset.path));}}}
$('#showfields').addEventListener('change',e=>{showFields=e.target.checked;dirty=true;});
$('#play').addEventListener('click',()=>{playing=!playing;$('#play').textContent=playing?'Pause':'Play';});
$('#scrub').addEventListener('input',e=>{t=+e.target.value*state.loop;dirty=true;if(playing){playing=false;$('#play').textContent='Play';}});
addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;if(e.key===' '){e.preventDefault();$('#play').click();}else if(e.key==='f'){const c=$('#showfields');c.checked=!c.checked;c.dispatchEvent(new Event('change'));}});

// Springs: each attribute chases its target; rotation takes the short way round.
function spring(T,dt){if(!cur||cur.length!==T.length||cur.some((a,i)=>a.length!==T[i].length)){cur=T.map(a=>a.slice());vel=T.map(a=>new Float64Array(a.length));return true;}
 if(inertia<=0){for(let l=0;l<T.length;l++)cur[l].set(T[l]);return true;}
 const k=Math.pow(1-inertia,2)*520+14,c=2*Math.sqrt(k)*(.62+.38*(1-inertia)),steps=Math.ceil(dt/(1/120)),h=dt/steps;let settled=true;
 for(let l=0;l<T.length;l++){const A=cur[l],V=vel[l],G=T[l];for(let i=0;i<A.length;i++){let d=G[i]-A[i];if(i%E.NA===4)d=((d+180)%360+360)%360-180;
   for(let s=0;s<steps;s++){V[i]+=(k*d-c*V[i])*h;A[i]+=V[i]*h;d-=V[i]*h;}if(Math.abs(d)>.02||Math.abs(V[i])>.05)settled=false;}}
 return settled;}
let settled=false,fps=0,frames=0,fpsT=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;
 {
  if(playing){t+=dt;$('#scrub').value=((t%state.loop)/state.loop).toFixed(3);}
  const tw=ptr.in?1:0,before=ptr.w;ptr.w+=(tw-ptr.w)*(1-Math.exp(-dt*6));const e=1-Math.exp(-dt*14);ptr.sx+=(ptr.x-ptr.sx)*e;ptr.sy+=(ptr.y-ptr.sy)*e;
  const moving=Math.abs(ptr.w-before)>1e-4||Math.hypot(ptr.x-ptr.sx,ptr.y-ptr.sy)>1e-4;
  if(playing||dirty||moving||!settled||drag){dirty=false;
   const ctx={...E.context(state,scene,t,ptr.w>.001?{x:ptr.sx,y:ptr.sy,w:ptr.w}:null),draft:true},T=E.evaluate(scene,state,ctx);settled=spring(T,dt);lastCtx=ctx;lastOps=E.compose(scene,state,cur,ctx);draw(g,lastOps,scale);if(showFields)gz=gizmos(ctx);frames++;}}
 if(now-fpsT>1000){fps=frames;frames=0;fpsT=now;const st=lastOps.stats||{};$('#perf').textContent=(st.skipped?'Heavy stack: some copies skipped · ':'')+(fps?fps+' fps':'');}
 requestAnimationFrame(frame);}

// ------------------------------------------------ export
const stem=()=>'effectors-'+(state.recipe==='custom'?(poster?poster.name.replace(/\\W+/g,'-').toLowerCase():'stack'):state.recipe);
// In the app, files go to native save panels; in a browser they download.
function save(format,data){if(APP){native?.postMessage({type:'save',format,data,name:stem()+'.'+format});return;}download(new Blob([data],{type:{svg:'image/svg+xml',json:'application/json'}[format]}),format);}
function download(blob,ext){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=stem()+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
function exportPNG(long){const k=long/Math.max(scene.W,scene.H),c=document.createElement('canvas');c.width=Math.round(scene.W*k);c.height=Math.round(scene.H*k);draw(c.getContext('2d'),finalOps(),k);if(APP)save('png',c.toDataURL('image/png'));else c.toBlob(b=>download(b,'png'),'image/png');}

// ------------------------------------------------ poster (app)
// The app sends the selected poster's outlines as SVG. It becomes an Artwork element; recipes then act on it.
let poster=null,keepPoster=true,withElements=false;
const posterLayer=()=>({id:'L99',type:'artwork',svg:poster.svg,name:poster.name,split:'shapes',colors:'original',ground:true,size:1,area:'bleed'});
const onPoster=()=>APP&&poster&&keepPoster;
function posterFormat(svg){const v=(svg.match(/viewBox="([^"]+)"/)||[])[1]?.split(/[\\s,]+/).map(Number);if(!v||!(v[2]>0&&v[3]>0))return 'poster';const a=v[3]/v[2];return Object.entries(E.FORMATS).sort((x,y)=>Math.abs(Math.log(x[1].h/x[1].w/a))-Math.abs(Math.log(y[1].h/y[1].w/a)))[0][0];}
function applyRecipe(id){if(!onPoster()){load({recipe:id,format:state.format});return;}const r=E.recipeState(id);load({...r,format:state.format,layers:[posterLayer(),...(withElements?r.layers:[])]});}
function startFromPoster(){load({recipe:'custom',palette:state.palette,colors:state.colors,format:posterFormat(poster.svg),layers:[posterLayer()],modifiers:[{type:'lens',amount:.5,field:{radius:.26,softness:1,follow:true,drive:'wander',travel:.2}}]});}
window.effectorStudio={setPoster(svg,name){poster={svg,name};startFromPoster();}};
// ------------------------------------------------ start
const fromHash=APP?null:readHash();if(fromHash)load(fromHash,false);else load({recipe:E.DEFAULT_RECIPE});fit();requestAnimationFrame(frame);native?.postMessage({type:'ready'});
</script></html>`;}
