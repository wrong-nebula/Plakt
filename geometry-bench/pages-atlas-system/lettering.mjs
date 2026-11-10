// Supporting type from the prepared outlines: exhibition text, captions and
// specimen labels. Shapes never depend on it.
import {FONT} from './fonts.mjs';
import {n,path} from './svg.mjs';
export {FONT};
// Text stretched to exactly w × h (the atlas header's measured boxes).
export function textAt(text,x,y,w,h,ink,face='condensed'){const glyphs=[...text].map(ch=>FONT[face][ch]??FONT[face][' ']),width=glyphs.reduce((s,g)=>s+g.advance,0),visible=glyphs.filter(g=>g.d),top=Math.max(...visible.map(g=>g.top)),bottom=Math.min(...visible.map(g=>g.top-g.height));let cursor=0,body='';for(const g of glyphs){if(g.d)body+=`<g transform="translate(${n(cursor+g.x)} ${g.top}) scale(${n(g.width/100)} ${n(-g.height/100)})">${path(g.d,ink)}</g>`;cursor+=g.advance;}return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(w/width)} ${n(-h/(top-bottom))}) translate(0 ${-top})">${body}</g>`;}
// A label at its natural width; `h` is the cap height. Returns [svg, width].
export function label(text,x,y,h,ink,face='condensed'){const glyphs=[...text].map(ch=>FONT[face][ch]??FONT[face][' ']),cap=FONT[face].H.height,width=glyphs.reduce((s,g)=>s+g.advance,0)*h/cap;return [textAt(text,x,y,width,h*Math.max(...glyphs.filter(g=>g.d).map(g=>g.height))/cap,ink,face),width];}
// A label within `maxW`: one line if it fits, else two, shrinking the cap
// height only if a line is still too wide. `bottom` anchors the last line's
// foot at y; otherwise the block is centered on y.
export function block(text,x,y,maxW,h,ink,bottom){const words=text.split(' '),measure=t=>label(t,0,0,h,ink)[1];let lines=[text];if(measure(text)>maxW&&words.length>1){let best=null;for(let k=1;k<words.length;k++){const pair=[words.slice(0,k).join(' '),words.slice(k).join(' ')],w=Math.max(...pair.map(measure));if(!best||w<best.w)best={pair,w};}lines=best.pair;}
 const size=h*Math.min(1,maxW/Math.max(...lines.map(measure))),lead=size*1.45,y0=bottom?y-size-lead*(lines.length-1):y-(size+lead*(lines.length-1))/2;return lines.map((t,i)=>label(t,x,y0+i*lead,size,ink)[0]).join('');}
// A supporting letter from one of the three faces, stretched into its box.
export function letter(face,ch,x,y,w,h,ctx){const s=ctx.state,g=FONT[face][ch]??FONT[face][ch.toUpperCase()];return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(w/100)} ${n(h/100)})">${path(g.d,s.stage===1?'none':ctx.ink,s.stage===1?`stroke="${ctx.ink}" stroke-width=".6"`:'')}</g>`;}
