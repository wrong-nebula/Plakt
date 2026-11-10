/* Print kit — spot separations and a riso preview for any flat-ink poster SVG, shared by the geometry-bench systems.
 * Taken from the shock-burst system's print outputs. A separation keeps one ink as black on white: every fill, stroke and
 * gradient stop of that colour turns black and every other colour white, so later shapes knock out earlier ones exactly
 * where they cover them. Pure white never prints. Paper prints as an ink of its own on white stock when it is dark, or
 * when a lighter ink sits on it (light type on a mid-tone ground); otherwise the paper is the stock. The riso preview prints each separation in its ink, multiplied over the stock, shifted by a seeded
 * misregistration and mottled by grain. Browser-safe: no Node imports.
 */
export const PRINT_KIT='print-kit-v1';
const NAMED={white:'#ffffff',black:'#000000'};
export const normColour=c=>{c=String(c).trim().toLowerCase();if(NAMED[c])return NAMED[c];if(/^#[0-9a-f]{3}$/.test(c))return '#'+[...c.slice(1)].map(x=>x+x).join('');return /^#[0-9a-f]{6}$/.test(c)?c:null;};
const COLOUR=/(\b(?:fill|stroke|stop-color|flood-color)\s*(?:=\s*"|:\s*))(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|white\b|black\b)/g;
const lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
export const luminance=h=>{const [r,g,b]=[1,3,5].map(i=>lin(parseInt(h.slice(i,i+2),16)));return .2126*r+.7152*g+.0722*b;};
const sizeOf=svg=>{const open=svg.match(/<svg\b[^>]*>/)?.[0]??'',vb=open.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/),w=open.match(/\bwidth="([\d.]+)/),h=open.match(/\bheight="([\d.]+)/);
 return {w:+(vb?.[1]??w?.[1]??1000),h:+(vb?.[2]??h?.[1]??1000)};};
// The paper: the fill of the first rect that covers the whole sheet; white if there is none.
export function paperOf(svg){const {w,h}=sizeOf(svg);for(const m of svg.matchAll(/<rect\b[^>]*>/g)){const r=m[0],x=+(r.match(/\bx="([-\d.]+)/)?.[1]??0),y=+(r.match(/\by="([-\d.]+)/)?.[1]??0),rw=r.match(/\bwidth="([^"]+)/)?.[1],rh=r.match(/\bheight="([^"]+)/)?.[1],full=v=>v==='100%';
  if(x<=0&&y<=0&&(full(rw)||+rw>=w-.5)&&(full(rh)||+rh>=h-.5)){const f=normColour(r.match(/\bfill="([^"]+)/)?.[1]??'');if(f)return f;}}return '#ffffff';}
// The inks a poster uses, in order of first use, and what keeps its separations from being pure black and white.
export function inksOf(svg){const paper=paperOf(svg),seen=new Set();
 for(const m of svg.matchAll(COLOUR)){const c=normColour(m[2]);if(c&&c!==paper&&c!=='#ffffff')seen.add(c);}
 const dark=luminance(paper)<.3||[...seen].some(c=>luminance(c)>luminance(paper)+.05);
 const stops=[...svg.matchAll(/<(?:linear|radial)Gradient\b[\s\S]*?<\/(?:linear|radial)Gradient>/g)].filter(g=>new Set([...g[0].matchAll(/stop-color="([^"]+)"/g)].map(s=>normColour(s[1]))).size>1).length;
 const impure=[...(stops?['gradients']:[]),...(/\b(?:fill-)?opacity="(?!1(?:\.0*)?")[\d.]+"/.test(svg)||/\bopacity:\s*0?\.\d/.test(svg)?['transparency']:[]),...(/mix-blend-mode/.test(svg)?['blend modes']:[]),...(/<image\b/.test(svg)?['images']:[])];
 return {paper,dark,inks:[...(dark?['paper']:[]),...seen],impure};} // dark: the paper prints as an ink
// One sheet per ink: that ink black, everything else white; glow filters and blend modes dropped.
export function spotSeparations(svg){const {paper,inks,impure}=inksOf(svg),clean=svg.replace(/\sfilter="url\([^)]*\)"/g,'').replace(/mix-blend-mode:\s*[a-z-]+;?/g,'');
 return inks.map(ink=>{const key=ink==='paper'?paper:ink;return {ink,colour:key,svg:clean.replace(COLOUR,(m,p,c)=>p+(normColour(c)===key?'#000000':'#ffffff')),impure};});}
const rnd=(...k)=>{let h=0x2545f491;for(const v of k){h=Math.imul(h^(v|0),0x9e3779b1);h^=h>>>15;h=Math.imul(h,0x85ebca77);h^=h>>>13;}h=Math.imul(h^h>>>16,0xc2b2ae3d);return ((h^h>>>16)>>>0)/4294967296;};
const n=v=>Math.round(v*100)/100;
// A sheet as a nested layer: its own ids prefixed so layers made from the same poster do not collide.
const asLayer=(svg,i,w,h)=>{const inner=svg.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>[\s\S]*?<\/title>/g,'');
 return `<svg x="0" y="0" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner.replace(/\bid="([^"]+)"/g,(m,id)=>`id="k${i}-${id}"`).replace(/url\(#([^)]+)\)/g,(m,id)=>`url(#k${i}-${id})`).replace(/href="#([^"]+)"/g,(m,id)=>`href="#k${i}-${id}"`)}</svg>`;};
// Riso preview from a poster SVG, or from separations [{ink, colour, svg}] when a system has its own. With its own separations
// on dark paper, the paper sheet is made from them: black wherever no other ink prints.
export function risoPreview(source,o={}){const poster=typeof source==='string'?source:o.poster??source[0]?.svg??'',seps=typeof source==='string'?spotSeparations(source):source;
 const {w,h}=sizeOf(poster||seps[0].svg),paper=normColour(o.paper??'')??paperOf(poster),dark=poster?inksOf(poster).dark:luminance(paper)<.3,mis=o.misregister??1.5,grain=o.grain??.35,seed=o.seed??1;
 const sheets=dark&&!seps.some(s=>s.ink==='paper')?[{ink:'paper',colour:paper,knock:true},...seps]:seps,defs=[],body=[];
 sheets.forEach((s,i)=>{const [r,g,b]=[1,3,5].map(k=>n(parseInt(s.colour.slice(k,k+2),16)/255)),dx=n((rnd(seed,i,401)-.5)*2*mis),dy=n((rnd(seed,i,402)-.5)*2*mis);
  defs.push(`<filter id="kr${i}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} -0.2126 -0.7152 -0.0722 1 0" result="ink"/>`+
   `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${i+1}" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${n(-1.6*grain)} 0 0 0 ${n(1+.55*grain)}" result="mask"/><feComposite in="ink" in2="mask" operator="in"/></filter>`);
  if(s.knock)defs.push(`<mask id="km${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#ffffff"/>${seps.map((x,j)=>`<g style="mix-blend-mode:multiply">${asLayer(x.svg,`${i}m${j}`,w,h)}</g>`).join('')}</mask>`);
  const content=s.knock?`<rect width="${w}" height="${h}" fill="#ffffff"/><rect width="${w}" height="${h}" fill="#000000" mask="url(#km${i})"/>`:asLayer(s.svg,i,w,h);
  body.push(`<g transform="translate(${dx} ${dy})" style="mix-blend-mode:multiply"><g filter="url(#kr${i})">${content}</g></g>`);});
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>Riso preview</title><defs>${defs.join('')}</defs><rect width="${w}" height="${h}" fill="${dark?'#ffffff':paper}"/>${body.join('')}</svg>`,inks:sheets.map(s=>({ink:s.ink,colour:s.colour})),width:w,height:h};}
