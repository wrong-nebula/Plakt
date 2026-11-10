import * as Pretext from '@chenglou/pretext';

const canvas=document.createElement('canvas');
const ctx=canvas.getContext('2d');
const graphemes=new Intl.Segmenter('en',{granularity:'grapheme'});
let measurementCalls=0;
// Same control flow and ink-height test as the captured Swift function. Canvas is
// deliberately a separate control, not passed off as the actual native renderer.
function currentWrap(f,width) {
  ctx.font=`${f.weight} 100px "${f.cssFamily}"`;
  const fits=value=>{
    measurementCalls++;
    const m=ctx.measureText(value);
    const h=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
    const w=m.actualBoundingBoxLeft+m.actualBoundingBoxRight;
    return h<=0 || w/h*f.inkTarget<=width;
  };
  const result=[];let current='';
  for(const word of f.text.split(/\s+/u).filter(Boolean)) {
    const next=current ? current+' '+word:word;
    if(fits(next))current=next;
    else {
      if(current){result.push(current);current='';}
      for(const {segment} of graphemes.segment(word)) {
        if(!fits(current+segment)&&current){result.push(current);current='';}
        current+=segment;
      }
    }
  }
  if(current)result.push(current);
  return result;
}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
let checksum=0;
function measureGroup(methods) {
  const output={},names=Object.keys(methods);
  for(const [name,fn]of Object.entries(methods)) {
    for(let i=0;i<4;i++)checksum+=fn()||0;
    let repeats=1,elapsed=0;
    do {
      const t=performance.now();
      for(let i=0;i<repeats;i++)checksum+=fn()||0;
      elapsed=performance.now()-t;
      if(elapsed<3)repeats*=2;
    }while(elapsed<3&&repeats<1024);
    const one=Math.max(.0001,elapsed/(elapsed<3?repeats/2:repeats));
    output[name]={samplesMs:[],iterations:Math.min(3000,Math.max(1,Math.ceil(12/one)))};
  }
  // Rotate method order every trial so concurrent workloads do not always favor
  // the algorithm that happened to run first or last.
  for(let trial=0;trial<21;trial++) {
    for(let j=0;j<names.length;j++) {
      const name=names[(j+trial*5)%names.length],r=output[name],fn=methods[name];
      const start=performance.now();
      for(let i=0;i<r.iterations;i++)checksum+=fn()||0;
      r.samplesMs.push((performance.now()-start)/r.iterations);
    }
  }
  for(const r of Object.values(output))r.medianMs=median(r.samplesMs);
  return output;
}
const noStart=/^[、。，．？！）」』】〕〉》］｝ーぁぃぅぇぉっゃゅょァィゥェォッャュョ]/u;
const noEnd=/[（「『【〔〈《［｛]$/u;
function quality(f,lines) {
  ctx.font=`${f.weight} ${f.fontSize}px "${f.cssFamily}"`;
  const widths=lines.map(s=>ctx.measureText(s).width);
  return {
    lineCount:lines.length,
    overflowLines:widths.filter(w=>w>f.width+.5).length,
    overflowHeight:Math.max(0,lines.length*f.lineHeight-f.height),
    prohibitedStarts:lines.map((s,i)=>({i,text:s})).filter(({text,i})=>i>0&&noStart.test(text)),
    prohibitedEnds:lines.map((s,i)=>({i,text:s})).filter(({text})=>noEnd.test(text)),
    contentPreserved:lines.join('').replace(/\s/gu,'')===f.text.replace(/\s/gu,''),
    widths
  };
}
function domCheck(f,prepared,whiteSpace) {
  const div=document.createElement('div');
  Object.assign(div.style,{position:'absolute',left:'-10000px',font:`${f.weight} ${f.fontSize}px "${f.cssFamily}"`,lineHeight:`${f.lineHeight}px`,whiteSpace,overflowWrap:'break-word',wordBreak:'normal',fontKerning:'auto'});
  div.lang=f.language;div.textContent=f.text;document.body.append(div);
  const checks=f.widths.map(width=>{
    div.style.width=`${width}px`;
    const expected=Pretext.layout(prepared,width,f.lineHeight);
    const actual=div.getBoundingClientRect().height;
    const lineText=[];let lastTop=-Infinity;
    const range=document.createRange();
    for(const {segment,index} of graphemes.segment(f.text)) {
      if(/^\s+$/u.test(segment))continue;
      range.setStart(div.firstChild,index);range.setEnd(div.firstChild,index+segment.length);
      const rect=range.getClientRects()[0];if(!rect)continue;
      if(Math.abs(rect.top-lastTop)>.5){lineText.push('');lastTop=rect.top;}
      lineText[lineText.length-1]+=segment;
    }
    const expectedText=Pretext.layoutWithLines(prepared,width,f.lineHeight).lines.map(l=>l.text.replace(/\s/gu,''));
    return {width,expectedHeight:expected.height,actualHeight:actual,match:Math.abs(actual-expected.height)<.1,exactLinesMatch:JSON.stringify(lineText)===JSON.stringify(expectedText),domLines:lineText,pretextLines:expectedText};
  });
  div.remove();return checks;
}

window.runExperiment=async fixtures=>{
  const output={};
  for(const f of fixtures) {
    document.documentElement.lang=f.language;
    const font=`${f.weight} ${f.fontSize}px "${f.cssFamily}"`;
    await document.fonts.load(font,f.text);await document.fonts.ready;
    Pretext.setLocale(f.language);
    for(let i=0;i<3;i++){Pretext.clearCache();const p=Pretext.prepareWithSegments(f.text,font);checksum+=Pretext.layoutWithLines(p,f.width,f.lineHeight).lineCount;}
    const coldSamples=[],coldTotal=[];
    for(let i=0;i<21;i++) {
      let prep=0,total=0;
      // Aggregate independent cache-cold operations to avoid timer quantization.
      // Cache clearing itself stays outside every timed interval.
      for(let j=0;j<16;j++) {
        Pretext.clearCache();const start=performance.now();
        const p=Pretext.prepareWithSegments(f.text,font);
        prep+=performance.now()-start;
        checksum+=Pretext.layoutWithLines(p,f.width,f.lineHeight).lineCount;
        total+=performance.now()-start;
      }
      coldSamples.push(prep/16);coldTotal.push(total/16);
    }
    const prepared=Pretext.prepareWithSegments(f.text,font);
    const byWidth=f.widths.map(width=>({width,...Pretext.layoutWithLines(prepared,width,f.lineHeight)}));
    const wrapped=Pretext.layoutWithLines(prepared,f.width,f.lineHeight);
    const portLines=currentWrap(f,f.width);
    const controls=f.widths.map(width=>({width,lines:currentWrap(f,width)}));
    measurementCalls=0;for(const width of f.widths)currentWrap(f,width);
    const callsPerSweep=measurementCalls;
    const measured=measureGroup({
      preparedLinesSweep:()=>f.widths.reduce((n,w)=>n+Pretext.layoutWithLines(prepared,w,f.lineHeight).lineCount,0),
      statsSweep:()=>f.widths.reduce((n,w)=>n+Pretext.layout(prepared,w,f.lineHeight).lineCount,0),
      portSweep:()=>f.widths.reduce((n,w)=>n+currentWrap(f,w).length,0),
      onePort:()=>currentWrap(f,f.width).length,
      onePreparedLines:()=>Pretext.layoutWithLines(prepared,f.width,f.lineHeight).lineCount,
      warmPrepareAndOneLayout:()=>{const p=Pretext.prepareWithSegments(f.text,font);return Pretext.layoutWithLines(p,f.width,f.lineHeight).lineCount;}
    });
    const dom=domCheck(f,prepared,'normal');
    const preWrapPrepared=Pretext.prepareWithSegments(f.text,font,{whiteSpace:'pre-wrap'});
    const preWrap=Pretext.layoutWithLines(preWrapPrepared,f.width,f.lineHeight);
    const preWrapDom=domCheck(f,preWrapPrepared,'pre-wrap');
    const matchedFont=`${f.weight} ${f.currentEffectiveEm}px "${f.cssFamily}"`;
    const matchedPrepared=Pretext.prepareWithSegments(f.text,matchedFont);
    const matchedEm={fontSize:f.currentEffectiveEm,...Pretext.layoutWithLines(matchedPrepared,f.width,f.lineHeight)};
    output[f.id]={font,wrapped,byWidth,portLines,controls,callsPerSweep,dom,preWrapDom,preWrap,matchedEm,
      quality:quality(f,wrapped.lines.map(l=>l.text)),portQuality:quality(f,portLines),
      preWrapQuality:quality(f,preWrap.lines.map(l=>l.text)),
      timings:{coldPrepare:{samplesMs:coldSamples,medianMs:median(coldSamples)},coldPrepareAndOneLayout:{samplesMs:coldTotal,medianMs:median(coldTotal)},...measured}};
  }
  return {cases:output,checksum,userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency};
};
