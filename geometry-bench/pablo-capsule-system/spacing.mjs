/* Optical sidebearings. A glyph that fills its box with a flat side (l, i, the blocks)
 * looks tighter than a round one (o, c, s) at the same distance, because the round one
 * carries white inside its box. Each side's average white is measured across the letter's
 * height, capped at a depth, and the sidebearings even it out around the alphabet's mean.
 */
// polys: point lists in the glyph box, y down; width × height is the box.
export function sideWhite(polys,width,height,depth){
 const rows=48;let left=0,right=0;
 for(let i=0;i<rows;i++){
  const y=height*(.04+.92*(i+.5)/rows),xs=[];
  for(const p of polys)for(let j=0;j<p.length;j++){
   const [x1,y1]=p[j],[x2,y2]=p[(j+1)%p.length];
   if((y1<=y)!==(y2<=y))xs.push(x1+(y-y1)/(y2-y1)*(x2-x1));
  }
  if(!xs.length){left+=depth;right+=depth;continue;}
  left+=Math.min(depth,Math.max(0,Math.min(...xs)));right+=Math.min(depth,Math.max(0,width-Math.max(...xs)));
 }
 return {left:left/rows,right:right/rows};
}
// white: Map character → {left, right}. The lowercase letters set the mean, so letter spacing
// stays as loose on average as before; each side moves by `strength` of its distance from it.
// Without kerning any two glyphs can meet, so no side goes below `min` (half the base by
// default): the closest two extremes ever get is the base gap.
export function opticalSidebearings(white,{base,strength=.65,min=base/2}){
 const letters=[...white].filter(([ch])=>/^[a-z]$/.test(ch)),mean=letters.reduce((s,[,w])=>s+w.left+w.right,0)/(2*letters.length);
 const r3=v=>Math.round(v*1000)/1000;
 const at=b=>new Map([...white].map(([ch,w])=>[ch,{lsb:r3(Math.max(min,b+strength*(mean-w.left))),rsb:r3(Math.max(min,b+strength*(mean-w.right)))}]));
 // The floor lifts a few sides; lower the others until the letters average the base again.
 let b=base;
 for(let i=0;i<12;i++){const sb=at(b),side=letters.reduce((s,[ch])=>s+sb.get(ch).lsb+sb.get(ch).rsb,0)/(2*letters.length);b+=base-side;}
 return at(b);
}
