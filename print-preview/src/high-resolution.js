import { PNGWriter } from './png-writer.js';

export function outputDimensions(width,height,longEdge) {
  if(!Number.isFinite(longEdge)||longEdge<256||longEdge>12288)throw new RangeError('Render size must be between 256 and 12288 pixels.');
  const scale=Math.round(longEdge)/Math.max(width,height);
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

function yieldToUI() {
  // MessageChannel also progresses in an offscreen native WebKit view, where rAF is suspended.
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
    channel.port2.postMessage(null);
  });
}

export async function renderHighResolution(preview,longEdge,{signal,onProgress=()=>{}}={}) {
  if(preview.exporting)throw new Error('A render is already in progress.');
  const {width:cssWidth,height:cssHeight}=preview.container.getBoundingClientRect();
  const {width,height}=outputDimensions(cssWidth,cssHeight,longEdge);
  const tile=1536,strip=512,padding=32,renderWidth=tile+padding*2,renderHeight=strip+padding*2;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=strip;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('Could not allocate the PNG encoding strip. Try a smaller render.');
  const png=new PNGWriter(width,height);
  const camera=preview.camera.clone(),controlsEnabled=preview.controls.enabled;
  const shadowAutoUpdate=preview.renderer.shadowMap.autoUpdate;
  const shadowSizes=[preview.sun,preview.galleryLamp,preview.exteriorLamp].filter(light=>light.visible&&light.castShadow).map(light=>[light,light.shadow.mapSize.clone()]);
  let complete=false;
  const checkCancel=()=>{if(signal?.aborted||preview.disposed)throw new DOMException('Render cancelled','AbortError');};
  preview.exporting=true;preview.controls.enabled=false;cancelAnimationFrame(preview.frame);preview.frame=0;
  try {
    await preview.antialiasReady;checkCancel();
    preview.scenePass.camera=camera;
    preview.renderer.setPixelRatio(1);preview.renderer.setSize(renderWidth,renderHeight,false);
    preview.composer.setSize(renderWidth,renderHeight);
    for(const [light] of shadowSizes) {
      light.shadow.mapSize.setScalar(Math.min(4096,preview.renderer.capabilities.maxTextureSize));
      light.shadow.map?.dispose();light.shadow.map=null;
    }
    preview.renderer.shadowMap.autoUpdate=false;preview.renderer.shadowMap.needsUpdate=true;
    const total=Math.ceil(width/tile)*Math.ceil(height/strip);let done=0;
    for(let y=0;y<height;y+=strip) {
      const rows=Math.min(strip,height-y);context.clearRect(0,0,width,strip);
      for(let x=0;x<width;x+=tile) {
        checkCancel();
        // Overlapping camera tiles let SMAA read neighbors without visible tile seams.
        camera.setViewOffset(width,height,x-padding,y-padding,renderWidth,renderHeight);
        preview.backdrop.material.uniforms.view.value.set((x-padding)/width,(height-y+padding-renderHeight)/height,renderWidth/width,renderHeight/height);
        preview.outputPass.uniforms.pPixelOrigin.value.set(x-padding,height-y+padding-renderHeight);
        preview.print.material.needsUpdate=true;
        preview.render();
        const columns=Math.min(tile,width-x);
        context.drawImage(preview.renderer.domElement,padding,padding,columns,rows,x,0,columns,rows);
        onProgress({fraction:++done/total,width,height,stage:'render'});
        await yieldToUI();
      }
      await png.writeRows(context.getImageData(0,0,width,rows).data,rows);
    }
    checkCancel();onProgress({fraction:1,width,height,stage:'encode'});
    const result=await png.finish();complete=true;return result;
  } finally {
    if(!complete)await png.cancel(new DOMException('Render cancelled','AbortError'));
    canvas.width=canvas.height=1;
    preview.scenePass.camera=preview.camera;
    preview.backdrop.material.uniforms.view.value.set(0,0,1,1);
    preview.outputPass.uniforms.pPixelOrigin.value.set(0,0);
    for(const [light,size] of shadowSizes) {light.shadow.mapSize.copy(size);light.shadow.map?.dispose();light.shadow.map=null;}
    preview.renderer.shadowMap.autoUpdate=shadowAutoUpdate;preview.renderer.shadowMap.needsUpdate=true;
    preview.controls.enabled=controlsEnabled;preview.exporting=false;
    if(!preview.disposed){preview.resize();cancelAnimationFrame(preview.frame);preview.frame=0;preview.render();}
  }
}
