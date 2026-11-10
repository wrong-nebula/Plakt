import * as THREE from 'three';
import { paper, widths } from './settings.js';

const fragment = /* glsl */`
uniform float pProcess;
uniform float pInk;
uniform float pRegistration;
uniform float pLines;
uniform float pWear;
uniform float pFinish;
uniform float pAmount;
uniform float pMask;
uniform float pShowMask;
uniform vec3 pStock;
uniform vec3 pSpot;
uniform sampler2D pCustomMask;
uniform sampler2D pGrain;
uniform vec2 pGrainRepeat;
uniform vec2 pSize;
float pSelected = 0.0;
float screenInk(vec2 uv, float coverage, float angle) {
  vec2 pos = uv * pSize * (pLines / 0.0254);
  vec2 cell = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * pos;
  float distanceToDot = length(fract(cell) - 0.5);
  float c = clamp(coverage,0.0,1.0);
  float radius = sqrt(min(c,1.0-c) / 3.14159265);
  vec2 dx=dFdx(cell),dy=dFdy(cell);
  float a=dot(dx,dx),b=dot(dx,dy),d=dot(dy,dy);
  // Major axis of the pixel footprint: grazing views must fade on the compressed axis too.
  float footprint=sqrt(0.5*(a+d+sqrt(max(0.0,(a-d)*(a-d)+4.0*b*b))));
  float aa = max(0.5*fwidth(distanceToDot),0.002);
  float screened = 1.0 - smoothstep(radius-aa, radius+aa, distanceToDot);
  if(c > 0.5) screened = 1.0-screened;
  if(c<0.0001 || c>0.9999) screened=c;
  // Remove screen frequencies approaching Nyquist; retain their mean ink coverage.
  return mix(screened,c,smoothstep(0.30,0.60,footprint));
}
vec3 printedColor(vec2 uv) {
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  vec3 source = textureGrad(map,uv,dx,dy).rgb;
  vec2 delta = vec2(pRegistration * 0.001 / pSize.x, pRegistration * 0.0007 / pSize.y);
  // Mip-filtered density grain replaces a discontinuous per-fragment hash.
  float grain=clamp((textureGrad(pGrain,uv*pGrainRepeat,dx*pGrainRepeat,dy*pGrainRepeat).r-0.46)*1.7+0.5,0.0,1.0);
  float absorb = 0.96 + grain * 0.08;
  vec3 color = source;
  if (pProcess > 0.5) {
    vec3 cmy = 1.0 - source;
    float k = min(cmy.r,min(cmy.g,cmy.b));
    cmy = max(vec3(0.0),(cmy-k) / max(1.0-k,0.001));
    cmy.r = clamp((1.0-textureGrad(map,clamp(uv+delta,0.0,1.0),dx,dy).r-k)/max(1.0-k,0.001),0.0,1.0);
    cmy.b = clamp((1.0-textureGrad(map,clamp(uv-delta,0.0,1.0),dx,dy).b-k)/max(1.0-k,0.001),0.0,1.0);
    float density = pInk * (pProcess > 1.5 ? (0.82 + grain * 0.25) : absorb);
    float lines = pProcess > 1.5 ? 0.65 : 1.0;
    // AM screening at four plate angles; Riso uses coarser, less uniform ink.
    vec2 screenUV = uv * lines;
    cmy = vec3(screenInk(screenUV,cmy.r*density,0.262),screenInk(screenUV,cmy.g*density,1.309),screenInk(screenUV,cmy.b*density,0.0));
    k = screenInk(screenUV,k*density,0.7854);
    color = (1.0-cmy) * (1.0-k);
    if (pProcess > 1.5) color = mix(color, min(vec3(1.0), color*vec3(1.06,0.98,0.94)+0.018),0.65);
  } else { color = 1.0 - (1.0 - color) * pInk; }
  float edge = min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
  float abrasion = pWear * (0.6 + grain*0.4) * (1.0-smoothstep(0.0,0.015,edge));
  color = mix(color,vec3(1.0),abrasion);
  color *= pStock * (0.988 + grain * 0.024);
  float dark = 1.0 - smoothstep(0.08,0.35,dot(source,vec3(0.2126,0.7152,0.0722)));
  float chroma = max(source.r,max(source.g,source.b)) - min(source.r,min(source.g,source.b));
  float accent = smoothstep(0.07,0.3,chroma);
  pSelected = pMask < 0.5 ? dark : pMask < 1.5 ? accent : pMask < 2.5 ? 1.0 : textureGrad(pCustomMask,uv,dx,dy).r;
  pSelected *= pAmount;
  if (pFinish > 0.5 && pFinish < 4.5) {
    vec3 metal = pFinish < 1.5 ? pSpot : pFinish < 2.5 ? vec3(0.83,0.58,0.22) : vec3(0.91,0.92,0.94);
    color = mix(color,metal,pSelected);
  }
  if (pShowMask > 0.5) color = mix(vec3(0.08),vec3(0.92,0.24,0.1),pSelected);
  return clamp(color,0.0,1.0);
}
`;

export function createPrintMaterial(artwork, fiber, emptyMask, settings) {
  const s = settings, stock = paper[s.stock];
  const uniforms = {
    pProcess: { value: 0 }, pInk: { value: 0.9 }, pRegistration: { value: 0 }, pLines: { value: 110 },
    pWear: { value: 0 }, pFinish: { value: 0 }, pAmount: { value: 1 }, pMask: { value: 0 }, pShowMask: { value: 0 },
    pStock: { value: new THREE.Color(stock.color) }, pSpot: { value: new THREE.Color(s.spotColor) },
    pCustomMask: { value: emptyMask }, pGrain: {value:fiber}, pGrainRepeat: {value:fiber.repeat.clone()}, pSize: { value: new THREE.Vector2(0.594,0.841) },
  };
  const material = new THREE.MeshPhysicalMaterial({
    map: artwork, color: 'white', roughness: stock.roughness, bumpMap: fiber, bumpScale: stock.bump,
    side: THREE.FrontSide, metalness: 0, ior: 1.46, clearcoat: 0.001, clearcoatRoughness: 0.18,
    iridescence: 0.001, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 420],
    anisotropy: 0.15, anisotropyRotation: 0.2,
  });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + fragment)
      .replace('#include <map_fragment>', 'diffuseColor *= vec4(printedColor(vMapUv),1.0);')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (pFinish > 0.5) roughnessFactor = mix(roughnessFactor, pFinish < 1.5 ? 0.34 : pFinish < 4.5 ? 0.105 : 0.12, pSelected);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        if (pFinish > 0.5 && pFinish < 4.5) metalnessFactor = pSelected * (pFinish < 1.5 ? 0.72 : 0.98);`)
      .replace('#include <lights_physical_fragment>', `
        vec3 pNormalDx=dFdx(normal),pNormalDy=dFdy(normal);
        float pNormalVariance=min(0.06,0.25*(dot(pNormalDx,pNormalDx)+dot(pNormalDy,pNormalDy)));
        roughnessFactor=sqrt(min(1.0,roughnessFactor*roughnessFactor+pNormalVariance));
        #include <lights_physical_fragment>
        material.clearcoat = pFinish > 4.5 ? pSelected : 0.0;
        material.clearcoatRoughness=sqrt(min(1.0,material.clearcoatRoughness*material.clearcoatRoughness+pNormalVariance));
        material.iridescence = pFinish > 3.5 && pFinish < 4.5 ? pSelected : 0.0;`);
  };
  material.customProgramCacheKey = () => 'posterlab-print-filtered-v2';
  return {
    material, uniforms,
    update(next, customMask, aspect = Math.SQRT2) {
      const stock = paper[next.stock];
      material.roughness = stock.roughness * (1 - next.damp * 0.4);
      material.bumpScale = stock.bump * (next.stock === 'cotton' ? 1.4 : 1);
      uniforms.pProcess.value = ['digital','offset','riso'].indexOf(next.process);
      uniforms.pInk.value = next.ink;
      uniforms.pRegistration.value = next.registration;
      uniforms.pLines.value = next.lpi;
      uniforms.pWear.value = next.wear;
      uniforms.pFinish.value = ['none','metallic','gold','silver','holographic','varnish'].indexOf(next.finish);
      uniforms.pAmount.value = next.finishAmount;
      uniforms.pMask.value = ['dark','accent','all','custom'].indexOf(next.mask);
      uniforms.pShowMask.value = next.showMask ? 1 : 0;
      uniforms.pStock.value.set(stock.color); uniforms.pSpot.value.set(next.spotColor);
      uniforms.pCustomMask.value = customMask || emptyMask;
      uniforms.pSize.value.set(widths[next.size], widths[next.size]*aspect);
      material.envMapIntensity = next.environment === 'gallery' ? 1.05 : 0.85;
      // Refresh custom sampler uniforms alongside built-in physical uniforms on on-demand frames.
      material.needsUpdate=true;
    },
  };
}
