import { LinearFilter, LinearMipmapLinearFilter } from 'three';

// Apply the same sampler policy to artwork, height/color maps and imported masks.
export function filterTexture(texture, maxAnisotropy) {
  texture.minFilter=LinearMipmapLinearFilter;
  texture.magFilter=LinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=Math.max(1,Math.min(16,maxAnisotropy||1));
  texture.needsUpdate=true;
  return texture;
}

export function renderScale(width,height,devicePixelRatio,quality,maxTextureSize) {
  const budget=quality==='high'?4_000_000:2_000_000;
  const desired=Math.max(1,devicePixelRatio||1)*(quality==='high'?1.5:1);
  const ratio=Math.min(desired,quality==='high'?3:2,Math.sqrt(budget/(width*height)),maxTextureSize/width,maxTextureSize/height);
  // Floor once so rounding never exceeds the pixel budget or texture-size limit.
  return {ratio,width:Math.max(1,Math.floor(width*ratio)),height:Math.max(1,Math.floor(height*ratio))};
}
