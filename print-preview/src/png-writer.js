const signature=new Uint8Array([137,80,78,71,13,10,26,10]);
const crcTable=Uint32Array.from({length:256},(_,i)=>{
  let crc=i;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;
});

function chunk(type,data) {
  const bytes=new Uint8Array(data.length+12),view=new DataView(bytes.buffer);
  view.setUint32(0,data.length);
  for(let i=0;i<4;i++)bytes[4+i]=type.charCodeAt(i);
  bytes.set(data,8);
  let crc=0xffffffff;
  for(let i=4;i<bytes.length-4;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
  view.setUint32(bytes.length-4,(crc^0xffffffff)>>>0);
  return bytes;
}

// Encode a PNG a strip at a time: no full-size browser canvas or full-size RGBA allocation.
export class PNGWriter {
  constructor(width,height) {
    if(typeof CompressionStream==='undefined')throw new Error('High-resolution PNG output requires a newer WebKit or browser.');
    this.width=width;this.height=height;this.rows=0;this.bytes=0;this.error=null;
    const header=new Uint8Array(13),view=new DataView(header.buffer);
    view.setUint32(0,width);view.setUint32(4,height);header[8]=8;header[9]=6;
    this.parts=[signature,chunk('IHDR',header),chunk('sRGB',new Uint8Array([0]))];
    const compressor=new CompressionStream('deflate');
    this.writer=compressor.writable.getWriter();
    this.drain=(async()=>{
      const reader=compressor.readable.getReader();
      try {
        for(;;) {
          const {done,value}=await reader.read();if(done)break;
          this.bytes+=value.length;
          if(this.bytes>180*1024*1024)throw new Error('The PNG exceeds the output limit. Choose a smaller render size.');
          this.parts.push(chunk('IDAT',value));
        }
      } finally {reader.releaseLock();}
    })().catch(error=>{this.error=error;return this.writer.abort(error).catch(()=>{});});
  }

  async writeRows(rgba,rows) {
    if(this.error)throw this.error;
    const stride=this.width*4;
    if(rgba.length!==stride*rows||this.rows+rows>this.height)throw new Error('Invalid PNG scanline data.');
    const filtered=new Uint8Array((stride+1)*rows);
    // PNG Sub filtering is effective on gradients, text, flat artwork and opaque alpha.
    for(let y=0;y<rows;y++) {
      const input=y*stride,output=y*(stride+1);filtered[output]=1;
      for(let x=0;x<stride;x++)filtered[output+1+x]=rgba[input+x]-(x<4?0:rgba[input+x-4]);
    }
    await this.writer.write(filtered);this.rows+=rows;
    if(this.error)throw this.error;
  }

  async finish() {
    if(this.rows!==this.height)throw new Error('The rendered PNG is incomplete.');
    await this.writer.close();await this.drain;if(this.error)throw this.error;
    this.parts.push(chunk('IEND',new Uint8Array()));
    const blob=new Blob(this.parts,{type:'image/png'});this.parts=[];return blob;
  }

  async cancel(reason) {await this.writer.abort(reason).catch(()=>{});await this.drain;this.parts=[];}
}
