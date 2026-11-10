import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { materialMaps, brickMaps, wallColor, sampleArtwork } from './textures.js';
import { createPrintMaterial } from './print-material.js';
import { updatePaper } from './paper-mesh.js';
import { solarPosition, widths, sanitize, paperHeight } from './settings.js';
import { filterTexture, renderScale } from './filtering.js';
import { displayFrame, displayDimensions, displayBackdrop, displayEnvironment } from './display-scene.js';
import { renderHighResolution } from './high-resolution.js';
import { StudioSet, studioCenterY, sweeps } from './studio-scene.js';

// Neutral tone mapping keeps artwork hues and paper white; each scene's exposure is matched to its light.
export const sceneExposure = { studio: 1, display: 1, courtyard: 1.2, gallery: 0.85 };
// Share of a lamp's warm tint left after the camera's white balance.
const lampTint = 0.4;

export class PosterPreview {
  constructor(container, settings, onStatus) {
    this.container=container;this.settings=sanitize(settings);this.onStatus=onStatus;
    this.disposed=false;this.frame=0;this.aspect=Math.SQRT2;this.textureSequence=0;this.maskSequence=0;
    RectAreaLightUniformsLib.init();
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label','Three-dimensional poster preview. Drag to orbit, scroll to zoom. Use the view buttons for keyboard access.');
    this.renderer.domElement.setAttribute('role','img');
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!this.disposed)this.onStatus('Graphics paused. Reopen Print preview to restore it.',true);});
    container.append(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(34,1,0.015,150);
    this.maxAnisotropy=Math.max(1,this.renderer.capabilities.getMaxAnisotropy());
    const gl=this.renderer.getContext();
    const samples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
    this.msaaSamples=Math.max(0,...samples.filter(n=>n<=4));
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:this.msaaSamples});
    target.resolveDepthBuffer=false;
    this.composer=new EffectComposer(this.renderer,target);
    // This fixed pass chain draws the scene into readBuffer (rt2); only the scene needs MSAA/depth.
    this.composer.renderTarget1.samples=0;this.composer.renderTarget1.depthBuffer=false;
    this.scenePass=new RenderPass(this.scene,this.camera);this.composer.addPass(this.scenePass);
    this.smaa=new SMAAPass();this.smaa.enabled=false;this.composer.addPass(this.smaa);
    this.outputPass=new OutputPass();this.composer.addPass(this.outputPass);
    this.outputPass.uniforms.pPixelOrigin={value:new THREE.Vector2()};
    this.outputPass.material.fragmentShader=this.outputPass.material.fragmentShader
      .replace('uniform sampler2D tDiffuse;','uniform sampler2D tDiffuse;\n uniform vec2 pPixelOrigin;').replace(
      'gl_FragColor = sRGBTransferOETF( gl_FragColor );',
      `gl_FragColor = sRGBTransferOETF( gl_FragColor );
       gl_FragColor.rgb+=(fract(52.9829189*fract(dot(gl_FragCoord.xy+pPixelOrigin,vec2(0.06711056,0.00583715))))-0.5)/255.0;`
    );
    // SMAA in this pinned Three.js version expects linear HDR before the output transform.
    // Data-URL lookup images load asynchronously; schedule a fresh on-demand frame when ready.
    this.antialiasReady=Promise.all([this.smaa._areaTexture.image,this.smaa._searchTexture.image].map(img=>img.decode()))
      .then(()=>{if(!this.disposed){this.smaa.enabled=true;this.invalidate();}});
    this.renderer.info.autoReset=false;
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=false;this.controls.target.set(0,1.55,0.01);
    this.controls.minDistance=0.10;this.controls.maxDistance=7;this.controls.minPolarAngle=0.12;this.controls.maxPolarAngle=Math.PI*0.78;
    this.controls.minAzimuthAngle=-Math.PI*0.47;this.controls.maxAzimuthAngle=Math.PI*0.47;
    this.controls.addEventListener('change',()=>this.invalidate());
    this.fiber=materialMaps('paper');this.concrete=materialMaps('concrete');this.pasteMap=materialMaps('paste');this.brick=brickMaps();this.wallColor=wallColor();
    for(const texture of [this.fiber,this.concrete,this.pasteMap,this.brick,this.wallColor])filterTexture(texture,this.maxAnisotropy);
    this.artwork=filterTexture(new THREE.CanvasTexture(sampleArtwork()),this.maxAnisotropy);this.artwork.colorSpace=THREE.SRGBColorSpace;
    this.emptyMask=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);this.emptyMask.needsUpdate=true;
    this.print=createPrintMaterial(this.artwork,this.fiber,this.emptyMask,this.settings);
    this.poster=new THREE.Group();this.poster.position.set(0,1.55,0.002);this.scene.add(this.poster);
    this.world=new THREE.Group();this.scene.add(this.world);
    this.backdrop=displayBackdrop();this.scene.add(this.backdrop);
    this.sun=new THREE.DirectionalLight('#fff4df',3.5);this.sun.castShadow=true;
    this.sun.target.position.set(0,1.55,0);this.scene.add(this.sun,this.sun.target);
    Object.assign(this.sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:0.1,far:25});
    this.sun.shadow.bias=-0.00008;this.sun.shadow.normalBias=0.001;this.sun.shadow.radius=3;
    this.fill=new THREE.HemisphereLight('#d9e7ff','#756655',0.5);this.scene.add(this.fill);
    this.area=new THREE.RectAreaLight('white',2.5,2.1,2.5);this.area.position.set(-1.3,2.6,2.2);this.area.lookAt(0,1.5,0);this.scene.add(this.area);
    this.studio=new StudioSet();this.scene.add(this.studio.group);
    this.galleryLamp=new THREE.SpotLight('#fff3df',16,8,Math.PI/3,0.8,2);
    this.galleryLamp.position.set(0.2,3.4,1.25);this.galleryLamp.target.position.copy(this.poster.position);this.galleryLamp.castShadow=true;
    this.galleryLamp.shadow.mapSize.set(1024,1024);this.galleryLamp.shadow.bias=-0.00004;
    this.scene.add(this.galleryLamp,this.galleryLamp.target);
    this.exteriorLamp=new THREE.SpotLight('#ffd0a0',0,8,Math.PI*0.39,0.85,2);
    this.exteriorLamp.position.set(-0.75,2.6,0.65);this.exteriorLamp.target.position.set(0,1.55,0);
    this.exteriorLamp.castShadow=true;this.exteriorLamp.shadow.mapSize.set(1024,1024);
    this.exteriorLamp.shadow.bias=-0.00004;this.scene.add(this.exteriorLamp,this.exteriorLamp.target);
    this.sky=new Sky();this.sky.scale.setScalar(90);this.scene.add(this.sky);
    this.skyScene=new THREE.Scene();this.bakeSky=new Sky();this.bakeSky.scale.setScalar(90);this.skyScene.add(this.bakeSky);
    // Ground in the environment bake prevents the metallic finish reflecting a sky below the wall.
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshBasicMaterial({color:'#666253'}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-0.5;this.skyScene.add(ground);
    this.pmrem=new THREE.PMREMGenerator(this.renderer);
    const room=new RoomEnvironment();this.roomEnvironment=this.pmrem.fromScene(room,0.03);room.dispose();
    this.displayEnvironment=displayEnvironment(this.pmrem);
    this.outdoorEnvironment=null;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.visibility=()=>{if(!document.hidden)this.invalidate();};document.addEventListener('visibilitychange',this.visibility);
    this.update(this.settings,true);this.setView('perspective');this.resize();
  }

  box(w,h,d,x,y,z,material,shadow=true) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);
    mesh.castShadow=shadow;mesh.receiveShadow=true;this.world.add(mesh);return mesh;
  }

  buildWorld() {
    const materials=new Set();
    this.world.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});
    for(const m of materials)m.dispose();this.world.clear();
    const s=this.settings,inside=s.environment==='gallery';
    this.backdrop.visible=s.environment==='display';
    this.poster.position.y=s.environment==='display'?displayDimensions(widths[s.size],widths[s.size]*this.aspect).centerY:s.environment==='studio'?studioCenterY(widths[s.size]*this.aspect):1.55;
    this.sun.target.position.copy(this.poster.position);this.galleryLamp.target.position.copy(this.poster.position);
    if(s.environment==='display') {
      const frame=displayFrame(widths[s.size],widths[s.size]*this.aspect);
      frame.position.copy(this.poster.position);this.world.add(frame);return;
    }
    if(s.environment==='studio') {this.world.add(this.studio.sweep(s.backdrop));return;}
    const surface=inside ? 'plaster' : s.surface;
    const wallMat=new THREE.MeshStandardMaterial({
      color:surface==='brick'?'#ffffff':surface==='plaster'?'#f2eee4':'#d0ccbd',
      map:surface==='brick'?this.brick:this.wallColor,roughness:0.94,bumpMap:this.concrete,bumpScale:surface==='plaster'?0.0006:0.002,
    });
    this.box(7.4,4.3,0.16,0,2.15,-0.08,wallMat,false);
    const floorMat=new THREE.MeshStandardMaterial({color:inside?'#9e8e73':'#777c75',roughness:inside?0.65:0.94,bumpMap:this.concrete,bumpScale:0.002});
    this.box(12,0.12,10,0,-0.06,4,floorMat,false);
    const trimMat=new THREE.MeshStandardMaterial({color:inside?'#d0ccc2':'#77796f',roughness:0.9});
    this.box(7.4,inside?0.075:0.23,0.06,0,inside?0.0375:0.115,0.035,trimMat);
    const jointMat=new THREE.MeshStandardMaterial({color:inside?'#655747':'#555b56',roughness:0.96});
    for(let i=-6;i<=6;i++) this.box(0.003,0.001,8,i*(inside?0.18:0.8),0.001,4,jointMat,false);
    if(!inside) {
      for(let z=0.8;z<8;z+=0.8)this.box(10,0.001,0.004,0,0.001,z,jointMat,false);
      const stone=new THREE.MeshStandardMaterial({color:'#beb9aa',roughness:0.9,bumpMap:this.concrete,bumpScale:0.002});
      this.box(0.15,4.4,0.23,-2,2.2,0.075,stone);
      this.box(0.15,4.4,0.23,2,2.2,0.075,stone);
      this.box(7.6,0.13,0.32,0,3.8,0.08,stone);
      const dark=new THREE.MeshStandardMaterial({color:'#343b37',roughness:0.8});
      this.box(0.065,3.4,0.08,2.45,1.7,0.08,dark);
      // A recessed window and metal mullions cast architectural shadows onto the wall.
      this.box(0.75,1.45,0.05,-2.75,2.15,0.03,dark);
      const glass=new THREE.MeshPhysicalMaterial({color:'#7e9294',metalness:0.45,roughness:0.15});
      this.box(0.64,1.32,0.02,-2.75,2.15,0.065,glass,false);
      this.box(0.04,1.4,0.06,-2.75,2.15,0.09,dark);
      this.box(0.73,0.04,0.06,-2.75,2.15,0.09,dark);
      this.box(0.10,0.20,0.10,-0.75,2.65,0.1,dark);
      this.box(0.055,0.035,0.55,-0.75,2.70,0.36,dark);
      this.box(0.26,0.045,0.18,-0.75,2.65,0.65,dark);
    } else {
      this.box(0.16,3.8,4,-2.8,1.9,1.7,wallMat);
      this.box(0.16,3.8,4,2.8,1.9,1.7,wallMat);
      this.box(5.6,0.12,4,0,3.8,1.6,wallMat);
      const frameMat=new THREE.MeshStandardMaterial({color:'#403e37',roughness:0.6});
      for(let i=0;i<4;i++)this.box(0.035,2.3,0.04,-1.8+i*0.65,2.05,2.85,frameMat);
      this.box(2,0.035,0.04,-0.825,2.05,2.85,frameMat);
    }
  }

  update(next,force=false) {
    const previous=this.settings;this.settings=sanitize(next);const s=this.settings;
    if(force||['environment','surface','size'].some(k=>s[k]!==previous[k])||(s.environment==='studio'&&s.backdrop!==previous.backdrop))this.buildWorld();
    if(force||['environment','size','stock','gsm','mounting','wrinkles','curl','glue','damp'].some(k=>s[k]!==previous[k]))this.rebuildPaper();
    this.print.update(s,this.customMask,this.aspect);
    this.renderer.toneMappingExposure=s.exposure*sceneExposure[s.environment];
    if(force||s.quality!==previous.quality) {
      this.sun.shadow.mapSize.set(s.quality==='high'?2048:1024,s.quality==='high'?2048:1024);
      this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.resize();
    }
    if(force||['hour','latitude','day','cloud','environment','backdrop','indoorTemperature','indoorIntensity','exteriorLight'].some(k=>s[k]!==previous[k]))this.updateLight();
    else if(s.environment==='studio'&&['size','mounting','glue','keyAngle','softness','fillLight'].some(k=>s[k]!==previous[k]))this.updateLight();
    if(s.size!==previous.size||s.environment!==previous.environment)this.setView('perspective');
    this.invalidate();
  }

  rebuildPaper() {updatePaper(this.poster,this.print.material,this.fiber,this.pasteMap,this.settings,this.aspect);}

  updateLight() {
    const s=this.settings,inside=s.environment==='gallery',sun=solarPosition(s.hour,s.latitude,s.day),studio=s.environment==='studio';
    this.studio.group.visible=studio;this.sun.visible=!studio;this.fill.visible=!studio;
    if(studio) {
      const w=widths[s.size],h=w*this.aspect;
      this.sky.visible=false;this.area.visible=false;this.galleryLamp.visible=false;this.exteriorLamp.visible=false;
      this.studio.light(s,this.poster.position,w,h,paperHeight(0.5,0.5,s));
      this.scene.environment=this.studio.environment(this.pmrem,s.backdrop).texture;this.scene.environmentIntensity=1;
      this.scene.background=this.studio.background(s.backdrop);
      const key=Math.round(Math.abs(s.keyAngle));
      this.onStatus(`Studio · ${sweeps[s.backdrop].name} sweep · Key ${key?`${key}° ${s.keyAngle<0?'left':'right'}`:'frontal'} · ${Math.round(w*1000)} × ${Math.round(h*1000)} mm`);
      this.invalidate();return;
    }
    if(s.environment==='display') {
      this.sky.visible=false;this.galleryLamp.visible=false;this.exteriorLamp.visible=false;
      this.sun.position.set(-2.5,4,3.5);this.sun.intensity=1.4;this.sun.color.set('#ffffff');
      this.fill.intensity=0.4;this.fill.color.set('#ffffff');this.fill.groundColor.set('#a9a9a9');
      this.area.visible=true;this.area.intensity=s.indoorIntensity;this.area.color.set('#ffffff');
      this.scene.environment=this.displayEnvironment.texture;this.scene.environmentIntensity=0.8;
      this.scene.background=new THREE.Color({white:'#ffffff',grey:'#3c3c3c',black:'#050505'}[s.backdrop]);
      this.backdrop.material.uniforms.dark.value={white:0,grey:0.5,black:1}[s.backdrop];
      this.onStatus(`City display · ${sweeps[s.backdrop].name} backdrop · ${Math.round(widths[s.size]*1000)} × ${Math.round(widths[s.size]*this.aspect*1000)} mm`);
      this.invalidate();return;
    }
    this.fill.groundColor.set('#756655');
    const daylight=THREE.MathUtils.smoothstep(sun.elevation,-6,8),gold=1-THREE.MathUtils.smoothstep(sun.elevation,0,26);
    const sunVector=new THREE.Vector3(sun.x,Math.max(sun.y,0.001),sun.z).normalize();
    for(const sky of [this.sky,this.bakeSky]) {
      const u=sky.material.uniforms;u.turbidity.value=2+s.cloud*14;u.rayleigh.value=2.2;
      u.mieCoefficient.value=0.004+s.cloud*0.035;u.mieDirectionalG.value=0.8;
      u.sunPosition.value.copy(sunVector);
    }
    this.sky.visible=!inside;
    this.sun.position.copy(sunVector).multiplyScalar(9).add(this.poster.position);
    this.sun.intensity=(inside?1.1:3.5)*daylight*(1-s.cloud*0.85);
    this.sun.color.set('#fff5df').lerp(new THREE.Color('#f7aa65'),gold*0.7);
    this.fill.intensity=inside?0.12:0.13+daylight*0.3;
    this.fill.color.set('#c3dcfa').lerp(new THREE.Color('#9aa3ae'),s.cloud);
    this.area.visible=inside;this.galleryLamp.visible=inside;
    this.exteriorLamp.visible=!inside;this.exteriorLamp.intensity=s.exteriorLight*30*(1-daylight);
    const warm=(6500-s.indoorTemperature)/3800;
    this.area.color.set('#eff5ff').lerp(new THREE.Color('#ffba72'),warm*lampTint);this.area.intensity=s.indoorIntensity;
    this.galleryLamp.color.copy(this.area.color);this.galleryLamp.intensity=s.indoorIntensity*7;
    if(inside) {this.scene.environment=this.roomEnvironment.texture;this.scene.environmentIntensity=0.25+s.indoorIntensity*0.16;}
    else {
      this.outdoorEnvironment?.dispose();
      this.outdoorEnvironment=this.pmrem.fromScene(this.skyScene,0.04,0.1,120);
      this.scene.environment=this.outdoorEnvironment.texture;this.scene.environmentIntensity=0.06+daylight*0.65;
    }
    this.scene.background=inside?new THREE.Color('#d8d4cb'):new THREE.Color('#182334');
    // At night use a dark sky rather than a daytime analytic sky clamped at the horizon.
    if(!inside&&sun.elevation< -4)this.sky.visible=false;
    this.onStatus(`${inside?'Gallery':'Courtyard'} · ${sun.elevation.toFixed(1)}° sun · ${s.size}`);
    this.invalidate();
  }

  setView(view) {
    const w=widths[this.settings.size],target=this.poster.position.clone();
    // A longer studio lens keeps the sheet's edges straight, as in a product photograph.
    const fov=this.settings.environment==='studio'?28:34;
    if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    if(this.settings.environment==='studio'&&view!=='detail') {
      const h=w*this.aspect,usableHeight=Math.max(0.45,1-190/(this.container.clientHeight||850));
      const fit=Math.max(h,w/Math.max(this.camera.aspect,0.4))*1.32/(2*Math.tan(THREE.MathUtils.degToRad(fov/2))*usableHeight);
      if(view==='context'){target.y=Math.max(0.9,target.y*0.78);this.camera.position.copy(target).add(new THREE.Vector3(fit*0.3,0.2,fit*1.8));}
      else {const turn=view==='front'?0:THREE.MathUtils.degToRad(22);this.camera.position.copy(target).add(new THREE.Vector3(Math.sin(turn)*fit,h*0.02,Math.cos(turn)*fit));}
      this.controls.target.copy(target);this.controls.update();this.invalidate();return;
    }
    if(this.settings.environment==='display'&&view!=='detail') {
      const {totalHeight}=displayDimensions(w,w*this.aspect);
      target.y=totalHeight*0.52;
      const usableHeight=Math.max(0.45,1-190/(this.container.clientHeight||850));
      const fitDistance=totalHeight/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*usableHeight);
      const distance=Math.max(fitDistance,totalHeight*(view==='context'?2.45:2.15));
      this.camera.position.copy(target).add(new THREE.Vector3(view==='front'?0:w*0.48,view==='front'?0:totalHeight*0.035,distance));
      this.controls.target.copy(target);this.controls.update();this.invalidate();return;
    }
    if(view==='detail') {target.x=w*0.49;target.y-=w*this.aspect*0.39;this.camera.position.copy(target).add(new THREE.Vector3(w*0.60,w*0.09,w*0.75));}
    else if(view==='front')this.camera.position.copy(target).add(new THREE.Vector3(0,0,w*3.3));
    else if(view==='context')this.camera.position.copy(this.settings.environment==='display'?target.clone().add(new THREE.Vector3(w*0.7,w*0.12,w*4.5)):new THREE.Vector3(1.45,1.65,4.5));
    else this.camera.position.copy(target).add(new THREE.Vector3(w*(this.settings.environment==='display'?0.55:1.1),w*0.18,w*3.2));
    this.controls.target.copy(target);this.controls.update();this.invalidate();
  }

  async setArtwork(dataURL) {
    const sequence=++this.textureSequence;
    const image=await this.loadImage(dataURL);
    if(this.disposed||sequence!==this.textureSequence)return;
    const texture=filterTexture(new THREE.Texture(image),this.maxAnisotropy);texture.colorSpace=THREE.SRGBColorSpace;
    this.artwork.dispose();this.artwork=texture;this.print.material.map=texture;this.print.material.needsUpdate=true;
    this.aspect=image.height/image.width;this.rebuildPaper();if(['display','studio'].includes(this.settings.environment)){this.buildWorld();this.updateLight();}
    this.print.uniforms.pSize.value.set(widths[this.settings.size],widths[this.settings.size]*this.aspect);
    this.setView('perspective');this.invalidate();
  }

  async setMask(dataURL) {
    const sequence=++this.maskSequence,image=await this.loadImage(dataURL);
    if(this.disposed||sequence!==this.maskSequence)return;
    const texture=filterTexture(new THREE.Texture(image),this.maxAnisotropy);
    this.customMask?.dispose();this.customMask=texture;this.print.update(this.settings,texture,this.aspect);this.invalidate();
  }

  loadImage(url) {return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('This image could not be decoded. Try a PNG or JPEG.'));image.src=url;});}

  resize() {
    if(this.disposed||this.exporting)return;const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;
    const scale=renderScale(width,height,window.devicePixelRatio,this.settings.quality,this.renderer.capabilities.maxTextureSize);
    this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(scale.ratio);this.renderer.setSize(width,height,false);
    // Use integer drawing-buffer dimensions for texel-exact SMAA offsets at fractional DPR.
    this.composer.setSize(this.renderer.domElement.width,this.renderer.domElement.height);
    this.invalidate();
  }
  render() {
    // OutputPass also swaps buffers. Reset the roles so initial LUT loading cannot move
    // the next scene into the depthless postprocess target and let the wall overwrite it.
    this.composer.readBuffer=this.composer.renderTarget2;
    this.composer.writeBuffer=this.composer.renderTarget1;
    this.renderer.info.reset();this.composer.render(0);
  }
  invalidate() {if(this.disposed||this.exporting||this.frame||document.hidden)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.render();});}
  snapshot() {this.render();return this.renderer.domElement.toDataURL('image/png');}
  renderImage(longEdge,options) {return renderHighResolution(this,longEdge,options);}
  diagnostics() {return {revision:THREE.REVISION,webgl:this.renderer.capabilities.isWebGL2,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,aspect:this.aspect,camera:this.camera.position.toArray(),target:this.controls.target.toArray(),filtering:{msaaSamples:this.msaaSamples,smaaReady:this.smaa.enabled,anisotropy:this.artwork.anisotropy,mipmapFilter:'trilinear',renderPixels:this.renderer.domElement.width*this.renderer.domElement.height},settings:this.settings};}
  dispose() {
    if(this.disposed)return;
    this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.controls.dispose();
    const materials=new Set(),geometries=new Set();
    this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
    for(const t of [this.fiber,this.concrete,this.pasteMap,this.brick,this.wallColor,this.artwork,this.emptyMask,this.customMask])t?.dispose();
    this.skyScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    this.sun.shadow.dispose();this.galleryLamp.shadow.dispose();this.exteriorLamp.shadow.dispose();this.pmrem.dispose();this.roomEnvironment.dispose();this.displayEnvironment.dispose();this.outdoorEnvironment?.dispose();this.studio.dispose();
    this.smaa.dispose();this.outputPass.dispose();this.composer.dispose();
    this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
  }
}
