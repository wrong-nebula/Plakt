import test from 'node:test';
import assert from 'node:assert/strict';
import { Texture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping } from 'three';
import { filterTexture, renderScale } from '../src/filtering.js';

test('render resolution respects both pixel budget and hardware size at high DPI',()=>{
  for(const [width,height,dpr,maxSize] of [[978,796,1,16384],[938,784,2,16384],[3840,2160,4,16384],[10000,8000,3,1024]]) {
    for(const quality of ['high','standard']) {
      const result=renderScale(width,height,dpr,quality,maxSize);
      assert.ok(result.width*result.height<=(quality==='high'?4_000_000:2_000_000));
      assert.ok(result.width<=maxSize&&result.height<=maxSize);
      assert.ok(Math.abs(result.width/result.height-width/height)<0.01);
    }
  }
  assert.ok(renderScale(900,700,1,'high',16384).ratio>renderScale(900,700,1,'standard',16384).ratio);
});

test('continuous masks and material data get trilinear mipmaps without changing color interpretation or UVs',()=>{
  const texture=new Texture();texture.wrapS=RepeatWrapping;texture.repeat.set(5,7);
  filterTexture(texture,8);
  assert.equal(texture.minFilter,LinearMipmapLinearFilter);assert.equal(texture.magFilter,LinearFilter);
  assert.equal(texture.generateMipmaps,true);assert.equal(texture.anisotropy,8);
  assert.equal(texture.colorSpace,NoColorSpace);assert.equal(texture.wrapS,RepeatWrapping);
  assert.deepEqual(texture.repeat.toArray(),[5,7]);
  filterTexture(texture,32);assert.equal(texture.anisotropy,16);
  filterTexture(texture,0);assert.equal(texture.anisotropy,1);
  texture.dispose();
});
