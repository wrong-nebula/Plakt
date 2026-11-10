import { PosterPreview } from './renderer.js';
import { defaults, sanitize, restorePreferences, paperThickness } from './settings.js';
import { softboxWidth } from './studio-scene.js';

const $=selector=>document.querySelector(selector);
const native=!!window.webkit?.messageHandlers?.printPreview;
const post=message=>window.webkit?.messageHandlers?.printPreview?.postMessage(message);
let preview,settings={...defaults},timer,noticeTimer,pendingFrame=0,maskLoaded=false,dirty=false;
let renderAbort=null;
const form=$('#settings');

function notify(message) {$('#notice').textContent=message;$('#notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').hidden=true,6000);}
function fatal(error) {$('#loading').hidden=true;$('#error').hidden=false;$('#error-message').textContent=error.message||String(error);$('#export').disabled=true;post({type:'error',message:error.message||String(error)});}

const format=(key,value)=>{
  if(key==='hour'){const minutes=Math.round(value*60);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
  if(key==='gsm')return `${value} g/m² · ${(paperThickness(settings)*1000).toFixed(2)} mm`;
  if(key==='registration')return `${value.toFixed(2)} mm`;
  if(key==='lpi')return `${value} lpi`;
  if(key==='indoorTemperature')return `${value} K`;
  if(key==='indoorIntensity'||key==='exteriorLight')return `${value.toFixed(1)}×`;
  if(key==='latitude')return `${Math.abs(value).toFixed(1)}° ${value<0?'S':'N'}`;
  if(key==='day')return `${value} / 365`;
  if(key==='exposure')return `${value.toFixed(2)}×`;
  if(key==='keyAngle')return value?`${Math.abs(value)}° ${value<0?'left':'right'}`:'Frontal';
  if(key==='softness')return `${Math.round(softboxWidth(value)*100)} cm wide`;
  if(key==='fillLight')return value?`${Math.round(value*100)}% of key`:'Off';
  return `${Math.round(value*100)}%`;
};

function syncControls() {
  for(const [key,value] of Object.entries(settings)) {
    const control=form.elements.namedItem(key);if(!control)continue;
    if(control.type==='checkbox')control.checked=value;else control.value=value;
    const output=$(`[data-output="${key}"]`);if(output)output.textContent=format(key,value);
  }
  for(const button of document.querySelectorAll('[data-environment]'))button.setAttribute('aria-pressed',button.dataset.environment===settings.environment);
  for(const el of document.querySelectorAll('[data-outdoor]'))el.hidden=settings.environment!=='courtyard';
  for(const el of document.querySelectorAll('[data-indoor]'))el.hidden=settings.environment!=='gallery';
  for(const el of document.querySelectorAll('[data-display]'))el.hidden=settings.environment!=='display';
  for(const el of document.querySelectorAll('[data-unframed]'))el.hidden=settings.environment==='display';
  for(const el of document.querySelectorAll('[data-studio]'))el.hidden=settings.environment!=='studio';
  for(const el of document.querySelectorAll('[data-backdrop]'))el.hidden=!['display','studio'].includes(settings.environment);
  for(const el of document.querySelectorAll('[data-natural-light]'))el.hidden=['display','studio'].includes(settings.environment);
  for(const el of document.querySelectorAll('[data-artificial-light]'))el.hidden=settings.environment==='courtyard';
  $('[data-view="context"]').textContent={display:'Full display',studio:'Wide shot'}[settings.environment]||'In context';
  for(const el of document.querySelectorAll('[data-plates]'))el.hidden=settings.process==='digital';
  $('[data-paste]').hidden=settings.mounting!=='paste'||['display','studio'].includes(settings.environment);
  $('[data-finish]').hidden=settings.finish==='none';
  $('[data-custom-mask]').hidden=settings.mask!=='custom';
  $('[data-metallic]').hidden=settings.finish!=='metallic';
}

function flushSettings() {clearTimeout(timer);if(!dirty)return;dirty=false;if(native)post({type:'settings',value:settings});else try{localStorage.setItem('posterlab-print-preview-v1',JSON.stringify(settings));}catch{}}
function persist() {dirty=true;clearTimeout(timer);timer=setTimeout(flushSettings,300);}
function update(patch,persistChange=true) {
  settings=sanitize({...settings,...patch});syncControls();
  // Coalesce slider events to one expensive geometry/environment update per frame.
  if(!pendingFrame)pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;try{preview?.update(settings);}catch(e){fatal(e);}});
  if(persistChange)persist();
}

function snapshot() {
  // A native/offscreen host may suspend rAF; an export must reflect the current controls.
  if(pendingFrame) {cancelAnimationFrame(pendingFrame);pendingFrame=0;preview.update(settings);}
  return preview.snapshot();
}

async function setArtwork(dataURL,name) {
  try {await preview.setArtwork(dataURL);$('#artwork-name').textContent=name||'Untitled artwork';}
  catch(error){notify(error.message);}
}
async function setMask(dataURL,name) {
  try {await preview.setMask(dataURL);maskLoaded=true;$('#mask-name').textContent=name||'Custom mask';update({mask:'custom'});}
  catch(error){notify(error.message);}
}

async function readFile(file,mask=false) {
  if(!file)return;
  if(file.size>40*1024*1024){notify('Choose an image smaller than 40 MB.');return;}
  const reader=new FileReader();reader.onerror=()=>notify('The image could not be read. Try another file.');
  reader.onload=()=>mask?setMask(reader.result,file.name):setArtwork(reader.result,file.name);reader.readAsDataURL(file);
}

function boot() {
  try {
    if(!native)try{settings=restorePreferences(JSON.parse(localStorage.getItem('posterlab-print-preview-v1')||'{}'));}catch{}
    // Custom image masks are session-local; never silently restore an absent mask.
    if(settings.mask==='custom')settings.mask='dark';
    preview=new PosterPreview($('#viewport'),settings,(text,error)=>{if(error)notify(text);else $('#scene-status').textContent=text;});
    preview.renderer.debug.onShaderError=(gl,program,vs,fs)=>{console.error(gl.getShaderInfoLog(fs));fatal(new Error('The material shader failed to compile. '+gl.getProgramInfoLog(program)));};
    syncControls();
    window.posterPreview={
      setArtwork,setMask,
      restore(value,persisted=false){const restored=persisted?restorePreferences(value):sanitize(value);if(restored.mask==='custom'&&!maskLoaded)restored.mask='dark';update(restored,false);},
      diagnostics:()=>preview.diagnostics(), snapshot,
      renderImage:(longEdge,options)=>preview.renderImage(longEdge,options),
      dispose:()=>{flushSettings();preview.dispose();},
    };
    let readySent=false;
    const ready=()=>{if(readySent)return;readySent=true;if($('#error').hidden){$('#loading').hidden=true;$('#export').disabled=false;post({type:'ready'});}};
    requestAnimationFrame(ready);
    // WebKit suspends animation frames in occluded windows; the native bridge must still initialize.
    setTimeout(ready,500);
  } catch(error){fatal(error);}
}

form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',e=>{
  const {name,type,value,checked}=e.target;if(!(name in defaults))return;
  if(name==='mask'&&value==='custom'&&!maskLoaded)notify('Choose a black and white image to define the finish.');
  update({[name]:type==='checkbox'?checked:type==='range'?Number(value):value});
});
for(const button of document.querySelectorAll('[data-environment]'))button.addEventListener('click',()=>update({environment:button.dataset.environment}));
for(const button of document.querySelectorAll('[data-hour]'))button.addEventListener('click',()=>update({hour:Number(button.dataset.hour)}));
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>preview?.setView(button.dataset.view));
$('#import-artwork').addEventListener('click',()=>native?post({type:'chooseArtwork'}):$('#image-file').click());
$('#import-mask').addEventListener('click',()=>native?post({type:'chooseMask'}):$('#mask-file').click());
$('#image-file').addEventListener('change',e=>{readFile(e.target.files[0]);e.target.value='';});
$('#mask-file').addEventListener('change',e=>{readFile(e.target.files[0],true);e.target.value='';});
$('#export').addEventListener('click',async()=>{
  if(!preview||renderAbort)return;
  const size=settings.renderSize,longEdge={viewport:0,'4k':3840,'8k':7680,'12k':12288}[size];
  const disabled=new Map([...document.querySelectorAll('button,input,select')].filter(el=>el.id!=='cancel-render').map(el=>[el,el.disabled]));
  renderAbort=new AbortController();
  try {
    const held=snapshot();$('#render-hold').src=held;$('#render-hold').hidden=false;
    for(const el of disabled.keys())el.disabled=true;
    $('#render-status').textContent='Preparing render…';$('#render-progress').hidden=false;
    let blob;
    if(longEdge)blob=await preview.renderImage(longEdge,{signal:renderAbort.signal,onProgress:({fraction,width,height,stage})=>{
      $('#render-status').textContent=stage==='encode'?'Encoding PNG…':`Rendering ${width} × ${height} · ${Math.round(fraction*100)}%`;
    }});
    else blob=await blobFromDataURL(held);
    if(renderAbort.signal.aborted)throw new DOMException('Render cancelled','AbortError');
    if(native) {
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The PNG could not be prepared for saving.'));reader.readAsDataURL(blob);});
      post({type:'save',data});
    } else {
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`poster-preview-${size}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  } catch(error){notify(error.name==='AbortError'?'Render cancelled.':'The view could not be rendered. '+error.message);}
  finally {
    for(const [el,value] of disabled)el.disabled=value;
    $('#render-progress').hidden=true;$('#render-hold').hidden=true;$('#render-hold').removeAttribute('src');renderAbort=null;
  }
});
// Decode a local data URL without fetch (the offline document deliberately disallows network connections).
function blobFromDataURL(url) {const bytes=atob(url.split(',')[1]);return Promise.resolve(new Blob([Uint8Array.from(bytes,c=>c.charCodeAt(0))],{type:'image/png'}));}
$('#cancel-render').addEventListener('click',()=>renderAbort?.abort());
$('#render-size').addEventListener('input',event=>update({renderSize:event.target.value}));
$('#reset').addEventListener('click',()=>{update({...defaults});preview?.setView('perspective');});
$('#retry').addEventListener('click',()=>location.reload());
$('#viewport').addEventListener('dragover',e=>{if(!native)e.preventDefault();});
$('#viewport').addEventListener('drop',e=>{e.preventDefault();if(!native)readFile(e.dataTransfer.files[0]);});
window.addEventListener('pagehide',()=>{renderAbort?.abort();flushSettings();cancelAnimationFrame(pendingFrame);clearTimeout(noticeTimer);preview?.dispose();});
boot();
