// Build-side hooks for the print kit: a riso and separations panel appended to a system's offline editor, and print
// outputs (spot separations and a riso preview per style) written next to its other outputs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {Resvg} from '@resvg/resvg-js';
import {PRINT_KIT,spotSeparations,risoPreview,inksOf} from './print-kit.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));

const PANEL=`<style>
.pk-open{position:fixed;right:16px;bottom:16px;z-index:40;background:#e0185c;color:#fff;border:0;border-radius:4px;padding:9px 12px;font:600 12px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 6px 18px #0003;cursor:pointer}
.pk-open.pk-inline{position:static;box-shadow:none;background:none;color:#b0124a;border:1px solid #e0185c;font-weight:400;padding:8px 10px}
dialog.pk{width:min(1100px,96vw);max-height:94vh;border:0;border-radius:6px;padding:0;background:#ecebe6;color:#26272b;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}dialog.pk::backdrop{background:#0009}
.pk-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 18px;border-bottom:1px solid #d0cec7}.pk-head h2{font-size:17px;margin:0}
.pk-body{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:20px;padding:18px;overflow:auto;max-height:calc(94vh - 60px)}.pk-view{line-height:0}.pk-view svg{width:100%;height:auto;display:block;box-shadow:0 8px 24px #26272b22}
.pk label{display:block;font-size:12px;font-weight:600;margin:14px 0 6px}.pk label output{float:right;font-weight:400;color:#696a70}.pk input[type=range]{width:100%;accent-color:#e0185c}
.pk ul{list-style:none;padding:0;margin:8px 0 0;font-size:12px}.pk li{display:flex;gap:8px;align-items:center;margin:4px 0}.pk li i{width:16px;height:16px;border-radius:3px;border:1px solid #0002;display:inline-block}
.pk p{font-size:12px;color:#5c5d62;margin:10px 0 0}.pk p.pk-note{color:#a3341f}.pk-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
.pk button{font:12px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border:1px solid #bdbcc2;background:none;border-radius:4px;padding:8px 10px;cursor:pointer;color:#26272b}.pk button.pk-main{background:#e0185c;border-color:#e0185c;color:#fff}
.pk button:focus-visible,.pk-open:focus-visible{outline:3px solid #e0185c;outline-offset:3px}
@media(max-width:720px){.pk-body{grid-template-columns:1fr}.pk-open{right:12px;bottom:12px}}
</style>
<button class="pk-open" type="button">Riso and separations</button>
<dialog class="pk" aria-labelledby="pk-title"><div class="pk-head"><h2 id="pk-title">Riso preview</h2><button type="button" data-pk="close">Close</button></div>
<div class="pk-body"><div class="pk-view" id="pk-view"></div><div>
<p>Each ink of the poster as its own sheet (black prints, white knocks out), printed in its colour over the stock, slightly out of register, with grain. When the paper is dark, or lighter inks sit on it, the paper prints as an ink on white stock.</p>
<label for="pk-mis">Misregistration <output id="pk-mis-o">1.5</output></label><input id="pk-mis" type="range" min="0" max="6" step="0.1" value="1.5">
<label for="pk-grain">Ink grain <output id="pk-grain-o">0.35</output></label><input id="pk-grain" type="range" min="0" max="1" step="0.01" value="0.35">
<span class="label" style="display:block;font-size:12px;font-weight:600;margin-top:14px">Inks</span><ul id="pk-inks"></ul><p class="pk-note" id="pk-note" role="status"></p>
<div class="pk-actions"><button type="button" class="pk-main" data-pk="seps">Separations (SVG)</button><button type="button" data-pk="png">Riso PNG</button><button type="button" data-pk="svg">Riso SVG</button><button type="button" data-pk="shift">Re-register</button></div>
<p id="pk-status" role="status" aria-live="polite"></p></div></div></dialog>`;
const SCRIPT=`(()=>{const K=PrintKit,d=document.querySelector('dialog.pk'),open=document.querySelector('.pk-open'),$=id=>document.getElementById(id);
 const exports=document.querySelector('.exports');if(exports){open.classList.add('pk-inline');exports.appendChild(open);}
 const poster=()=>{const s=window.rendered&&window.rendered.isConnected?window.rendered:document.querySelector('#stage svg');return s?s.outerHTML:null;};
 let seed=1,last=null,timer=0;
 function refresh(){const svg=poster();if(!svg){$('pk-note').textContent='No poster on the page yet.';return;}const own=typeof window.printSeparations==='function',seps=own?window.printSeparations():K.spotSeparations(svg),info=K.inksOf(svg);
  last={seps,riso:K.risoPreview(seps,{poster:svg,misregister:+$('pk-mis').value,grain:+$('pk-grain').value,seed})};$('pk-view').innerHTML=last.riso.svg;
  $('pk-inks').innerHTML=last.riso.inks.map(i=>'<li><i style="background:'+i.colour+'"></i>'+(i.ink==='paper'?'paper (printed)':i.ink.startsWith('#')?i.ink:i.ink+' '+i.colour)+'</li>').join('');
  $('pk-note').textContent=(!own&&info.impure.length?'This style uses '+info.impure.join(' and ')+', so its separations hold greys: screen them before printing. ':'')+(last.riso.inks.length>4?last.riso.inks.length+' inks means '+last.riso.inks.length+' passes through a riso; most print two to four. ':'');}
 const later=()=>{clearTimeout(timer);timer=setTimeout(refresh,120);};
 for(const id of ['pk-mis','pk-grain'])$(id).addEventListener('input',e=>{$(id+'-o').textContent=e.target.value;later();});
 open.addEventListener('click',()=>{d.showModal();refresh();});
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const base=()=>(document.title||'poster').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'poster',svgBlob=s=>new Blob([s],{type:'image/svg+xml'});
 d.addEventListener('click',async e=>{const b=e.target.closest('[data-pk]');if(!b)return;const k=b.dataset.pk;
  if(k==='close')d.close();if(!last)return;
  if(k==='shift'){seed++;refresh();}
  if(k==='svg')download(svgBlob(last.riso.svg),base()+'-riso.svg');
  if(k==='seps'){last.seps.forEach((s,i)=>setTimeout(()=>download(svgBlob(s.svg),base()+'-sep-'+(i+1)+'-'+String(s.ink).replace('#','')+'.svg'),i*250));$('pk-status').textContent='Saving '+last.seps.length+' separations.';}
  if(k==='png'){try{$('pk-status').textContent='Rendering PNG…';const url=URL.createObjectURL(svgBlob(last.riso.svg));try{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas'),s=2400/Math.max(last.riso.width,last.riso.height);c.width=Math.round(last.riso.width*s);c.height=Math.round(last.riso.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,'image/png'));download(blob,base()+'-riso.png');$('pk-status').textContent='Saved '+c.width+' × '+c.height+' PNG.';}finally{URL.revokeObjectURL(url);}}catch(err){$('pk-status').textContent=err.message;}}});
})();`;
// Appends the panel to an editor page. separations: a JavaScript function expression, for systems with separations of their own.
export function withPrintPanel(html,{separations}={}){const kit=buildSync({entryPoints:[path.join(here,'print-kit.mjs')],bundle:true,format:'iife',globalName:'PrintKit',minify:true,write:false,platform:'browser'}).outputFiles[0].text.replaceAll('</script','<\\/script');
 const add=`<!-- ${PRINT_KIT} -->${PANEL}<script>${kit}</script>${separations?`<script>window.printSeparations=${separations};</script>`:''}<script>${SCRIPT}</script>`;
 return /<\/html>\s*$/.test(html)?html.replace(/<\/html>\s*$/,add+'</html>'):html+add;}
// Print outputs for every style: print/separations/<id>-NN-<ink>.svg, print/riso/<id>.svg and .png, and print/index.json.
export function printOutputs({out,styles,height=1500}){const dir=path.join(out,'print');fs.rmSync(dir,{recursive:true,force:true});for(const d of ['separations','riso'])fs.mkdirSync(path.join(dir,d),{recursive:true});
 const index=styles.map(({id,svg,separations})=>{const seps=separations??spotSeparations(svg),riso=risoPreview(seps,{poster:svg}),info=inksOf(svg),text=/<text\b/.test(svg);
  const files=seps.map((s,i)=>{const f=`print/separations/${id}-${String(i+1).padStart(2,'0')}-${String(s.ink).replace('#','')}.svg`;fs.writeFileSync(path.join(out,f),s.svg);return f;});
  fs.writeFileSync(path.join(dir,`riso/${id}.svg`),riso.svg);fs.writeFileSync(path.join(dir,`riso/${id}.png`),new Resvg(riso.svg,{fitTo:{mode:'height',value:height},font:{loadSystemFonts:text}}).render().asPng());
  return {id,inks:riso.inks,impure:separations?[]:info.impure,ownSeparations:!!separations,separations:files,riso:`print/riso/${id}.svg`};});
 fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify({kit:PRINT_KIT,styles:index},null,2));return {styles:index.length,sheets:index.reduce((a,s)=>a+s.separations.length,0)};}
