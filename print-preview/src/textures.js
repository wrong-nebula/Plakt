import * as THREE from 'three';

export function random(seed = 42) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function noiseGrid(size, rand) { return Float32Array.from({ length: size * size }, rand); }
function noise(grid, n, u, v, m = n) {
  const x = (u % 1 + 1) % 1 * n, y = (v % 1 + 1) % 1 * m;
  const ix = Math.floor(x), iy = Math.floor(y), a = x - ix, b = y - iy;
  const sx = a * a * (3 - 2 * a), sy = b * b * (3 - 2 * b);
  const at = (i, j) => grid[(j % m) * n + i % n];
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), sx), THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
}

export function materialMaps(kind, size = 1024) {
  const rand = random(kind === 'paper' ? 319 : 876);
  const g1 = noiseGrid(16, rand), g2 = noiseGrid(64, rand);
  // Short fibres (about 2 × 0.7 mm on a City sheet) with a slight machine direction; integer periods keep the tile seamless.
  const fibres = kind === 'paper' ? Float32Array.from({ length: 96 * 256 }, rand) : null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'); const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const broad = noise(g1, 16, u, v), fine = noise(g2, 64, u, v);
    const grain = rand();
    let value;
    if (kind === 'paper') {
      // Formation flocs, short fibres and surface tooth, instead of long stretched streaks that read as brushed metal.
      const floc = broad * 0.55 + fine * 0.45, fibre = noise(fibres, 96, u, v, 256);
      value = 120 + (floc - 0.5) * 70 + (fibre - 0.5) * 46 + (grain - 0.5) * 40;
    } else if (kind === 'paste') {
      value = 140 + Math.sin(v * 180 + broad * 8) * 35 + fine * 32 + grain * 15;
    } else {
      value = 110 + (broad - 0.5) * 50 + (fine - 0.5) * 34 + (grain - 0.5) * 28;
      if (grain > 0.992) value -= 55;
    }
    const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = value; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const height = new THREE.CanvasTexture(canvas);
  height.wrapS = height.wrapT = THREE.RepeatWrapping;
  height.repeat.set(kind === 'paper' ? 5 : 4, kind === 'paper' ? 7 : 3);
  height.anisotropy = 8;
  return height;
}

export function brickMaps() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d'), rand = random(108);
  ctx.fillStyle = '#a49d8f'; ctx.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 16; row++) for (let col = -1; col < 5; col++) {
    const x = col * 256 + row % 2 * 128, y = row * 64;
    const tone = 38 + rand() * 9; ctx.fillStyle = `hsl(${15 + rand() * 10} 27% ${tone}%)`;
    ctx.fillRect(x + 4, y + 4, 248, 56);
    for (let p = 0; p < 160; p++) { ctx.fillStyle = rand() > 0.5 ? '#ffffff09' : '#00000010'; ctx.fillRect(x + 6 + rand() * 245, y + 6 + rand() * 52, 2 + rand() * 6, 1 + rand() * 3); }
  }
  const color = new THREE.CanvasTexture(canvas); color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping; color.repeat.set(4, 3); color.anisotropy = 8;
  return color;
}

export function wallColor() {
  const size=1024,rand=random(210),broad=noiseGrid(12,rand),fine=noiseGrid(80,rand);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const n=noise(broad,12,x/size,y/size)*22+noise(fine,80,x/size,y/size)*10+(rand()-0.5)*9;
    const i=(y*size+x)*4,pore=rand()>0.997?35:0;
    image.data[i]=190+n-pore;image.data[i+1]=189+n-pore;image.data[i+2]=184+n-pore;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  // Fine casting marks and the occasional aggregate pore belong to the concrete, not the UI.
  ctx.strokeStyle='#5d5b4f18';ctx.lineWidth=0.6;
  for(let i=0;i<6;i++) {let x=rand()*size,y=rand()*size;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<9;j++){x+=(rand()-0.5)*12;y+=rand()*12;ctx.lineTo(x,y);}ctx.stroke();}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(4,3);map.anisotropy=8;return map;
}

export function sampleArtwork() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 1697;
  const x = c.getContext('2d'); x.fillStyle = '#e8e2d4'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#c53624'; x.fillRect(62, 63, 1076, 22);
  x.fillStyle = '#20221e'; x.font = '500 27px Helvetica, Arial';
  x.fillText('FORM / LAB', 64, 137); x.fillText('MATERIAL STUDY — SAMPLE ARTWORK', 64, 174);
  x.save(); x.beginPath(); x.rect(62, 215, 1076, 1070); x.clip();
  x.fillStyle = '#c53624';
  x.beginPath(); x.arc(600, 735, 450, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(600, 735, 222, 0, Math.PI * 2); x.fill();
  x.restore(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#e8e2d4'; x.fillRect(0, 0, 1200, 1697); x.globalCompositeOperation = 'source-over';
  x.save(); x.translate(640, 720); x.rotate(-Math.PI / 4); x.fillStyle = '#20221e'; x.fillRect(-760, -54, 1520, 108); x.restore();
  x.fillStyle = '#20221e'; x.font = '700 144px Helvetica, Arial'; x.fillText('AFTER', 62, 1438); x.fillText('THE INK.', 62, 1580);
  x.font = '500 23px Helvetica, Arial'; x.fillText('PAPER, LIGHT & THE SPACE BETWEEN.', 66, 1637);
  return c;
}
