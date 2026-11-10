import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { PNGWriter } from '../src/png-writer.js';
import { outputDimensions } from '../src/high-resolution.js';

test('high-resolution output preserves the view aspect at 4K, 8K and 12K',()=>{
  for(const longEdge of [3840,7680,12288])for(const [w,h] of [[938,784],[390,523]]) {
    const out=outputDimensions(w,h,longEdge);
    assert.equal(Math.max(out.width,out.height),longEdge);
    assert.ok(Math.abs(out.width/out.height-w/h)<0.001);
  }
  for(const value of [Infinity,0,16384])assert.throws(()=>outputDimensions(938,784,value),RangeError);
});

test('streaming PNG scanlines decode exactly across strip and IDAT boundaries',async()=>{
  const width=257,height=5,rgba=Uint8Array.from({length:width*height*4},(_,i)=>i%4===3?255:(i*73+31)%256);
  const writer=new PNGWriter(width,height);
  await writer.writeRows(rgba.subarray(0,width*3*4),3);
  await writer.writeRows(rgba.subarray(width*3*4),2);
  const blob=await writer.finish(),png=new Uint8Array(await blob.arrayBuffer()),view=new DataView(png.buffer);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(view.getUint32(16),width);assert.equal(view.getUint32(20),height);
  const data=[];
  for(let offset=8;offset<png.length;) {
    const length=view.getUint32(offset),type=String.fromCharCode(...png.subarray(offset+4,offset+8));
    if(type==='IDAT')data.push(png.subarray(offset+8,offset+8+length));offset+=length+12;
  }
  const raw=inflateSync(Buffer.concat(data)),decoded=new Uint8Array(rgba.length),stride=width*4;
  assert.equal(raw.length,(stride+1)*height);
  for(let y=0;y<height;y++) {
    assert.equal(raw[y*(stride+1)],1);
    for(let x=0;x<stride;x++)decoded[y*stride+x]=(raw[y*(stride+1)+1+x]+(x<4?0:decoded[y*stride+x-4]))%256;
  }
  assert.deepEqual(decoded,rgba);
});
