/* Heavy dither type — a type system after the same reference as the Heavy dither shape system
 * (a photograph dithered to coarse 1-bit pixels in a black frame, sent by the user on 8 November 2026).
 * Letters are tone, not outline. Each glyph's outline is measured as a signed distance to its edge;
 * a profile turns that distance into relief (a tube, a chisel, a pillow, a groove), the light shades
 * it, and halos, drop shadows and extrusions spread tone outside the letter. The whole setting is one
 * picture, dithered on a pixel grid tied to the cap height: rows per cap is the system's main axis,
 * from seven chunky rows to fine thermal print. Any text in sixteen SIL OFL faces, seven constructions, six warps, fourteen
 * renderings, thirty-eight styles, six layouts, and OTF fonts per style. Nothing is traced from the reference.
 */
import {METHODS,dither,coverage} from '../heavy-dither-system/dither.mjs';
import {PALETTES,FORMATS,MARKS,SCREENS,inks,markPath,screenLevels,glyphPolys,mixHex} from '../heavy-dither-system/engine.mjs';
import {FONTS} from './fonts.mjs';
export {METHODS,PALETTES,FORMATS,MARKS,inks};
export const ENGINE='heavy-dither-type-v1';
const TAU=Math.PI*2,DEG=Math.PI/180,clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v,mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

// ---------------------------------------------------------------- noise
const PERM=(()=>{let s=1337;const r=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296,p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]];}return Uint8Array.from([...p,...p]);})();
const GRAD=[[1,0],[-1,0],[0,1],[0,-1],[.7071,.7071],[-.7071,.7071],[.7071,-.7071],[-.7071,-.7071]];
function noise2(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,X=xi&255,Y=yi&255;
 const g=(i,j,dx,dy)=>{const v=GRAD[PERM[PERM[X+i]+Y+j]&7];return v[0]*dx+v[1]*dy;};
 const u=xf*xf*xf*(xf*(xf*6-15)+10),v=yf*yf*yf*(yf*(yf*6-15)+10);
 return mix(mix(g(0,0,xf,yf),g(1,0,xf-1,yf),u),mix(g(0,1,xf,yf-1),g(1,1,xf-1,yf-1),u),v)*1.41;}
const fbm=(x,y,o=4)=>{let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*noise2(x*f,y*f);f*=2.03;a*=.5;}return s;};
function hash(a,b,c){let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(c|0,2246822519))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return ((h^(h>>>16))>>>0)/4294967296;}

// ---------------------------------------------------------------- catalogues
export const FONT_LIST=Object.entries(FONTS).map(([id,f])=>({id,name:f.name,license:f.license}));
export const PROFILES={flat:'Flat',tube:'Tube',chisel:'Chisel',pillow:'Pillow',groove:'Groove (inline)',rim:'Rim'};
export const FILLS={solid:'Solid',ramp:'Ramp, each line',sweep:'Sweep across the setting',swirl:'Swirl',cloud:'Cloud',stripes:'Stripes'};
// Constructions decide which part of the distance field is letter; warps bend the set outlines before they are measured.
export const CONSTRUCTS={solid:'Solid',outline:'Outline (hollow)',contours:'Contours',neon:'Neon tube',erode:'Eroded',slices:'Slices',melt:'Melting'};
export const WARPS={none:'None',wave:'Wave',arc:'Arc',perspective:'Floor (perspective)',bulge:'Bulge',zigzag:'Zigzag'};
export const LAYOUTS={stack:'Stack, each line to the width',poster:'Poster, one size',specimen:'Alphabet specimen',sizes:'Sizes',ladder:'Rows ladder, heavy to fine',tiles:'Letter tiles'};
export const VIEWS={letters:'1. Letters on the grid',tone:'2. Tone',dither:'3. Dithered'};
export const LABELS={face:Object.fromEntries(Object.entries(FONTS).map(([k,f])=>[k,f.name])),construct:CONSTRUCTS,warp:WARPS,profile:PROFILES,fill:FILLS,method:Object.fromEntries(Object.entries(METHODS).map(([k,m])=>[k,m.name])),
 mark:MARKS,layout:LAYOUTS,format:Object.fromEntries(Object.entries(FORMATS).map(([k,f])=>[k,f.name])),palette:Object.fromEntries(Object.entries(PALETTES).map(([k,p])=>[k,p.name])),
 case:{upper:'Capitals',typed:'As typed'},align:{center:'Centre',left:'Left',right:'Right'},view:VIEWS};
export const OPTIONS=Object.fromEntries(Object.entries(LABELS).map(([k,v])=>[k,Object.keys(v)]));
// [id, name, group, min, max, step, default, unit]. Lengths in caps are fractions of the cap height.
export const CONTROLS=[
 ['rows','Rows per cap','letters',5,48,1,14,''],['weight','Weight','letters',-.5,.5,.01,0,''],['width','Width','letters',.55,1.6,.01,1,''],['slant','Slant','letters',-.45,.45,.01,0,''],
 ['tracking','Tracking','letters',-.15,.6,.005,.05,''],['leading','Leading','letters',.85,2,.01,1.28,''],
 ['constructAmount','Construction amount','letters',0,1,.01,.5,''],['warpAmount','Warp','letters',-1,1,.01,.5,''],['bounce','Bounce','letters',0,1,.01,0,''],['spin','Spin','letters',0,1,.01,0,''],
 ['depth','Relief','relief',0,4,.05,1.2,''],['letter','Letter tone','relief',0,1,.01,.15,''],['fillAmount','Fill amount','relief',0,1,.01,.7,''],
 ['light','Light from','relief',-180,180,1,-135,'°'],['height','Light height','relief',5,85,1,40,'°'],['ambient','Ambient','relief',0,.8,.01,.1,''],['gloss','Gloss','relief',0,1,.01,.2,''],
 ['halo','Halo','outside',0,1,.01,0,''],['haloWidth','Halo width','outside',.03,1.2,.01,.3,'cap'],
 ['shadow','Shadow','outside',0,1,.01,0,''],['shadowX','Shadow across','outside',-.6,.6,.01,.12,'cap'],['shadowY','Shadow down','outside',-.6,.6,.01,.12,'cap'],['shadowSoft','Shadow softness','outside',0,.4,.01,.06,'cap'],['shadowTone','Shadow tone','outside',0,1,.01,.5,''],
 ['extrude','Extrusion','outside',0,1.6,.01,0,'cap'],['extrudeAngle','Extrusion angle','outside',-180,180,1,45,'°'],['extrudeNear','Extrusion near tone','outside',0,1,.01,.35,''],['extrudeFar','Extrusion far tone','outside',0,1,.01,.85,''],
 ['ground','Ground','tone',0,1,.01,1,''],['ramp','Ground ramp','tone',-1,1,.01,0,''],['brightness','Brightness','tone',-.6,.6,.01,0,''],['contrast','Contrast','tone',.3,4,.05,1.15,''],['gamma','Gamma','tone',.3,3,.01,1,''],['grain','Grain','tone',0,1,.01,.12,''],['invert','Invert','tone',0,1,1,0,''],
 ['levels','Inks','dither',2,4,1,2,''],['order','Ordered checks','dither',0,1,.01,0,''],['seed','Seed','dither',1,99,1,7,''],
 ['aspect','Pixel aspect','pixels',.5,3,.05,1,''],['markSize','Mark size','pixels',.4,1.3,.01,.86,''],['bloom','Bloom','pixels',0,1,.01,0,''],['misregister','Misregistration','pixels',0,1,.01,0,''],
 ['margin','Margin','layout',0,.25,.005,.07,''],['frame','Frame','layout',0,1,1,0,''],['captionSize','Caption size','layout',.05,.6,.01,.22,'']
].map(([id,name,group,min,max,step,def,unit])=>({id,name,group,min,max,step,def,unit}));
const DEFAULTS=Object.fromEntries(CONTROLS.map(c=>[c.id,c.def]));
export function applies(id,s){const p=s.params;
 switch(id){case 'order':return METHODS[s.method].kind==='diffuse';case 'markSize':return s.mark!=='pixel';case 'fillAmount':return s.fill!=='solid';case 'constructAmount':return s.construct!=='solid';case 'warpAmount':return s.warp!=='none';
  case 'depth':case 'light':case 'height':case 'ambient':case 'gloss':return s.profile!=='flat';
  case 'haloWidth':return p.halo>0;case 'shadowX':case 'shadowY':case 'shadowSoft':case 'shadowTone':return p.shadow>0;
  case 'extrudeAngle':case 'extrudeNear':case 'extrudeFar':return p.extrude>0;case 'frame':case 'captionSize':case 'caption':return s.layout==='poster'||s.layout==='stack';
  case 'leading':return s.layout!=='tiles';default:return true;}}

// ---------------------------------------------------------------- styles
const P=(o={})=>o;
export const FAMILIES=[
 {id:'photo',layout:'stack',name:'Photo type',after:'the user’s reference: a dithered photograph in a black frame',palette:'newsprint',face:'archivo',profile:'flat',fill:'swirl',method:'atkinson',mark:'pixel',text:'HEAVY/DITHER',caption:'PRINTED IN BIG PIXELS',
  params:P({rows:24,letter:0,fillAmount:.6,order:.5,contrast:1.3,grain:.25,halo:.45,haloWidth:.16,frame:1,margin:.08,width:.9}),note:'Letters are windows onto an organic swirl, dithered by Atkinson with ordered checks inside a black frame, like the reference.'},
 {id:'tube',layout:'stack',name:'Chrome tube',after:'new',palette:'chrome',face:'mono',profile:'tube',fill:'solid',method:'bayer8',mark:'pixel',text:'TUBE/TYPE',
  params:P({rows:18,levels:4,ground:0,letter:.55,depth:2.2,gloss:.6,ambient:.05,grain:.08}),note:'Every stroke a lit chrome tube on black, four greys through an 8×8 Bayer matrix.'},
 {id:'chisel',name:'Chisel',after:'new',palette:'newsprint',face:'serif',profile:'chisel',fill:'solid',method:'floyd',mark:'pixel',text:'Cut in/Stone',case:'typed',
  params:P({rows:24,letter:.35,depth:1.8,light:-120,contrast:1.25}),note:'Serifs cut as V-chisel facets, lit from the upper left, Floyd–Steinberg.'},
 {id:'glow',layout:'stack',name:'Neon glow',after:'new',palette:'neon',face:'unbounded',profile:'pillow',fill:'solid',method:'blue',mark:'led',text:'AFTER/HOURS',
  params:P({rows:16,levels:3,ground:0,letter:.95,depth:.7,halo:.85,haloWidth:.55,markSize:.8,contrast:1.3}),note:'Light letters with a dithered glow on black, cyan and magenta LEDs through blue noise.'},
 {id:'long-shadow',layout:'stack',name:'Long shadow',after:'new',palette:'signal',face:'archivo',profile:'flat',fill:'solid',method:'atkinson',mark:'pixel',text:'LONG/SHADOW',
  params:P({rows:16,levels:3,letter:.02,extrude:.9,extrudeAngle:45,extrudeNear:.4,extrudeFar:.95}),note:'Solid letters cast a long extrusion that dithers away into the paper.'},
 {id:'drop',layout:'stack',name:'Riso drop',after:'new',palette:'riso',face:'anton',profile:'pillow',fill:'solid',method:'atkinson',mark:'pixel',text:'DROP/SHADOW',
  params:P({rows:20,levels:3,letter:.05,depth:.8,shadow:.95,shadowX:.1,shadowY:.1,shadowSoft:.1,shadowTone:.5,grain:.15}),note:'Blue letters over a soft pink drop shadow, Atkinson in two fluorescent inks.'},
 {id:'fade',layout:'stack',name:'Fade',after:'new',palette:'acid',face:'bebas',profile:'flat',fill:'ramp',method:'bayer4',mark:'pixel',text:'FADE/AWAY',
  params:P({rows:14,ground:0,letter:1,fillAmount:.95,contrast:1.2}),note:'Each line solid at its baseline and dust at its cap, acid on black, Bayer 4×4.'},
 {id:'decay',layout:'stack',name:'Decay',after:'new',palette:'thermal',face:'archivo',profile:'flat',fill:'sweep',method:'white',mark:'pixel',text:'DECAY/DECAY',
  params:P({rows:22,letter:.02,fillAmount:.95,grain:.25}),note:'Letters dissolve from left to right through white-noise thresholds.'},
 {id:'scan',layout:'stack',name:'Scan',after:'new',palette:'ember',face:'anton',profile:'tube',fill:'solid',method:'floyd',mark:'scan',text:'SCAN/LINES',
  params:P({rows:13,levels:3,ground:0,letter:.85,depth:2,light:-90,height:30,markSize:.8,halo:.3,haloWidth:.2}),note:'Tubes lit from above in three embers, drawn as scan lines.'},
 {id:'stitch',layout:'stack',name:'Stitch',after:'new',palette:'blueprint',face:'mono',profile:'pillow',fill:'solid',method:'bayer4',mark:'cross',text:'CROSS/STITCH',
  params:P({rows:12,letter:.1,depth:1.4,markSize:1}),note:'Pillowed letters sewn in blue cross stitches on a 4×4 Bayer grid.'},
 {id:'handheld',layout:'stack',name:'Handheld',after:'new',palette:'handheld',face:'mono',profile:'tube',fill:'solid',method:'bayer4',mark:'pixel',text:'PRESS/START',
  params:P({rows:9,levels:4,ground:.9,letter:.15,depth:1.6,halo:.4,haloWidth:.18}),note:'Nine rows to the cap in four handheld greens.'},
 {id:'receipt',name:'Receipt',after:'new',palette:'thermal',face:'mono',profile:'flat',fill:'cloud',method:'floyd',mark:'pixel',text:'THANK YOU/FOR/VISITING',
  params:P({rows:40,letter:.1,fillAmount:.35,grain:.4,contrast:1.3}),note:'Forty rows to the cap: fine thermal-printer grain in clouded ink.'},
 {id:'press',layout:'stack',name:'Press',after:'new',palette:'newsprint',face:'anton',profile:'pillow',fill:'solid',method:'cluster',mark:'dot',text:'EXTRA/EXTRA',
  params:P({rows:18,letter:.2,depth:1.2,ground:.93,markSize:1.05,shadow:.6,shadowX:.08,shadowY:.08,shadowTone:.55}),note:'A coarse clustered-dot newspaper screen, pillowed letters over a grey shadow.'},
 {id:'inline',layout:'stack',name:'Inline',after:'new',palette:'ultra',face:'unbounded',profile:'groove',fill:'solid',method:'stucki',mark:'pixel',text:'IN/LINE',
  params:P({rows:24,levels:4,ground:.05,letter:.75,depth:2.4,gloss:.4,halo:.3,haloWidth:.3}),note:'A groove runs down every stroke, four ultraviolet inks, Stucki.'},
 {id:'static',layout:'stack',name:'Static',after:'new',palette:'thermal',face:'bebas',profile:'flat',fill:'stripes',method:'white',mark:'pixel',text:'NO/SIGNAL',
  params:P({rows:18,ground:.75,letter:0,fillAmount:.12,grain:.42,contrast:1.5,width:.9}),note:'Letters lost in grey television static.'},
 {id:'block',layout:'stack',name:'Block',after:'new',palette:'signal',face:'archivo',profile:'flat',fill:'solid',method:'bayer2',mark:'pixel',text:'BIG/BITS',
  params:P({rows:7,levels:3,letter:.02,extrude:.45,extrudeAngle:60,extrudeNear:.45,extrudeFar:.7}),note:'Seven rows to the cap, a short red extrusion in 2×2 checks.'},
 // Second set: more faces, constructions, warps and renderings.
 {id:'terminal',layout:'stack',name:'Terminal',after:'new',palette:'acid',face:'plex',profile:'flat',fill:'solid',method:'blue',mark:'ascii',text:'TERMINAL/MODE',
  params:P({rows:12,ground:0,letter:1,halo:.4,haloWidth:.3,bloom:.45,markSize:1,aspect:.7,contrast:1.2}),note:'Letters typed in text-mode characters, denser where the tone is, with a phosphor bloom.'},
 {id:'pop',layout:'stack',name:'Pop halftone',after:'new',palette:'signal',face:'bricolage',profile:'pillow',fill:'solid',method:'atkinson',mark:'halftone',text:'POP/ART!',
  params:P({rows:22,levels:3,letter:.05,depth:1.2,shadow:.9,shadowX:.08,shadowY:.08,shadowTone:.45,misregister:.5,markSize:1.05}),note:'Dots sized by tone, red and black, with the inks a little off register.'},
 {id:'engraving',layout:'stack',name:'Engraving',after:'new',palette:'newsprint',face:'bodoni',profile:'chisel',fill:'solid',method:'floyd',mark:'hatch',text:'Engraved/Letters',case:'typed',
  params:P({rows:26,letter:0,depth:1.8,light:-120,contrast:1.3,markSize:1.15,ambient:.05}),note:'Bodoni chiselled and cut in diagonal hatching that crosses where it is darkest.'},
 {id:'knit',layout:'stack',name:'Knit',after:'new',palette:'signal',face:'barlow',profile:'tube',fill:'solid',method:'bayer4',mark:'knit',text:'WARM/WOOL',
  params:P({rows:16,levels:3,letter:.05,depth:1.6,ground:.97,aspect:.8,markSize:1.1,width:1.05}),note:'Condensed letters knitted stitch by stitch, red on cream with dark shading.'},
 {id:'mosaic',layout:'stack',name:'Mosaic',after:'new',palette:'ice',face:'fraunces',profile:'pillow',fill:'solid',method:'bayer4',mark:'tiles',text:'Mosaic',case:'typed',
  params:P({rows:11,levels:3,ground:.02,letter:.92,depth:1.4,gloss:.4,markSize:.9,halo:.3,haloWidth:.2}),note:'Soft Fraunces laid in rounded tiles, ice blues on navy.'},
 {id:'bubbles',layout:'stack',name:'Bubbles',after:'new',palette:'neon',face:'syne',profile:'pillow',fill:'solid',method:'blue',mark:'rings',text:'BUBBLE/POP',
  params:P({rows:12,levels:3,ground:0,letter:1,depth:.6,halo:.5,haloWidth:.3,markSize:1.05,contrast:1.3}),note:'Every pixel a ring; letters and their glow foam up in cyan and magenta.'},
 {id:'bricks',layout:'stack',name:'Brick wall',after:'new',palette:'ember',face:'archivo',profile:'flat',fill:'solid',method:'bayer2',mark:'bricks',text:'BRICK/WALL',
  params:P({rows:12,levels:3,ground:0,letter:.95,extrude:.45,extrudeAngle:90,extrudeNear:.5,extrudeFar:.12}),note:'Letters laid in staggered bricks with a glowing extrusion below.'},
 {id:'triangles',layout:'stack',name:'Triangles',after:'new',palette:'riso',face:'wide',profile:'flat',fill:'solid',method:'atkinson',mark:'triangles',text:'TRI/ANGLE',
  params:P({rows:14,levels:3,letter:.03,shadow:.9,shadowX:.1,shadowY:.06,shadowTone:.5,markSize:1.05}),note:'An extended grotesque in alternating triangles over a pink shadow.'},
 {id:'electric',layout:'stack',name:'Electric',after:'new',palette:'neon',face:'monoton',profile:'flat',fill:'solid',method:'bayer8',mark:'led',text:'ELEC/TRIC',
  params:P({rows:28,levels:3,ground:0,letter:1,halo:.35,haloWidth:.12,bloom:.7,markSize:.85}),note:'Monoton’s inline tubes as an LED sign, with bloom.'},
 {id:'melt',layout:'stack',name:'Melt',after:'new',palette:'acid',face:'anton',construct:'melt',profile:'flat',fill:'ramp',method:'atkinson',mark:'pixel',text:'MELT/DOWN',
  params:P({rows:18,ground:0,letter:1,constructAmount:.75,fillAmount:.35,order:.3}),note:'Letters drip down the page, each column by its own length.'},
 {id:'wave',layout:'stack',name:'Wave',after:'new',palette:'chrome',face:'barlow',warp:'wave',profile:'tube',fill:'solid',method:'bayer8',mark:'pixel',text:'WAVE/FORM',
  params:P({rows:16,levels:4,ground:0,letter:.55,depth:2,gloss:.6,warpAmount:.8}),note:'Condensed chrome tubes riding a sine wave.'},
 {id:'floor',layout:'stack',name:'Floor',after:'new',palette:'blueprint',face:'wide',warp:'perspective',profile:'flat',fill:'ramp',method:'bayer4',mark:'scan',text:'FLOOR/PLAN',
  params:P({rows:14,letter:.03,warpAmount:.6,fillAmount:.5,markSize:.75,width:.75,margin:.14}),note:'Extended letters laid back on a floor in blue scan lines.'},
 {id:'contours',layout:'stack',name:'Contours',after:'new',palette:'ember',face:'fraunces',construct:'contours',profile:'tube',fill:'solid',method:'jarvis',mark:'pixel',text:'TOPO/GRAPHIC',
  params:P({rows:30,levels:3,ground:0,letter:.95,constructAmount:.35,depth:1.4}),note:'Letters as contour lines inside and around them, like a map.'},
 {id:'eroded',layout:'stack',name:'Eroded',after:'new',palette:'thermal',face:'bebas',construct:'erode',profile:'flat',fill:'cloud',method:'atkinson',mark:'pixel',text:'STAMPED/INK',
  params:P({rows:22,letter:.02,constructAmount:.8,fillAmount:.25,grain:.3}),note:'A rubber stamp: edges eaten by noise, ink clouded.'},
 {id:'neon-tube',layout:'stack',name:'Neon tube',after:'new',palette:'neon',face:'syne',construct:'neon',profile:'tube',fill:'solid',method:'blue',mark:'pixel',text:'OPEN/LATE',
  params:P({rows:22,levels:3,ground:0,letter:1,constructAmount:.3,depth:1.5,halo:.75,haloWidth:.35,bloom:.6}),note:'A lit tube follows each outline, glowing through blue noise.'},
 {id:'slices',layout:'stack',name:'Slices',after:'new',palette:'signal',face:'anton',construct:'slices',profile:'flat',fill:'solid',method:'atkinson',mark:'pixel',text:'SLICED/TYPE',
  params:P({rows:18,levels:3,letter:.02,constructAmount:.35,extrude:.3,extrudeAngle:25,extrudeNear:.45,extrudeFar:.8}),note:'Letters cut into horizontal slices over a short red extrusion.'},
 {id:'bounce',layout:'stack',name:'Bounce',after:'new',palette:'riso',face:'fraunces',profile:'pillow',fill:'solid',method:'atkinson',mark:'pixel',text:'Bounce/Party',case:'typed',
  params:P({rows:18,levels:3,letter:.03,depth:1,bounce:.6,spin:.6,shadow:.9,shadowX:.07,shadowY:.09,shadowTone:.5}),note:'Each soft letter hops and turns on its own, over a pink shadow.'},
 {id:'arc',layout:'stack',name:'Arcade',after:'new',palette:'chrome',face:'wide',warp:'arc',profile:'chisel',fill:'solid',method:'bayer4',mark:'pixel',text:'ARC/ADE',
  params:P({rows:16,levels:4,ground:0,letter:.6,depth:1.8,gloss:.5,warpAmount:.55,extrude:.35,extrudeAngle:90,extrudeNear:.3,extrudeFar:.05}),note:'Chiselled chrome bent into an arch over a dark extrusion.'},
 {id:'bulge',layout:'stack',name:'Bulge',after:'new',palette:'ultra',face:'unbounded',warp:'bulge',profile:'pillow',fill:'solid',method:'stucki',mark:'pixel',text:'BUL/GE',
  params:P({rows:20,levels:4,ground:.05,letter:.85,depth:1.2,gloss:.5,warpAmount:.9}),note:'Wide letters swelling through a fisheye, four ultraviolet inks.'},
 {id:'hollow',layout:'stack',name:'Hollow',after:'new',palette:'blueprint',face:'mono',construct:'outline',profile:'tube',fill:'solid',method:'bayer4',mark:'cross',text:'HOLLOW/TYPE',
  params:P({rows:16,letter:.05,constructAmount:.3,depth:1.4,markSize:1}),note:'Outlined letters stitched in blue, the outline lit as a tube.'},
 {id:'elegance',layout:'stack',name:'Elegance',after:'new',palette:'newsprint',face:'italic',profile:'groove',fill:'swirl',method:'stucki',mark:'pixel',text:'Élégance/nocturne',case:'typed',
  params:P({rows:30,letter:.02,depth:1.6,fillAmount:.3,halo:.25,haloWidth:.12}),note:'An italic Garamond with a groove down every stroke and a faint swirl.'},
 {id:'zigzag',layout:'stack',name:'Zigzag',after:'new',palette:'handheld',face:'grotesk',warp:'zigzag',profile:'tube',fill:'solid',method:'bayer4',mark:'pixel',text:'ZIG/ZAG',
  params:P({rows:12,levels:4,ground:.9,letter:.1,depth:1.5,warpAmount:.9}),note:'A grotesque on a zigzag baseline in four handheld greens.'}
];
const FAMILY=Object.fromEntries(FAMILIES.map(f=>[f.id,f]));

// ---------------------------------------------------------------- state
const num=(v,c)=>{const x=Number(v);return Number.isFinite(x)?clamp(x,c.min,c.max):c.def;};
export function normalize(input={}){const f=FAMILY[input.family]||FAMILIES[0],pick=(k,d)=>OPTIONS[k].includes(input[k])?input[k]:d;
 const params={...DEFAULTS,...f.params,...(input.params||{})};for(const c of CONTROLS)params[c.id]=num(params[c.id],c);for(const k of ['rows','levels','seed','invert','frame'])params[k]=Math.round(params[k]);
 return {family:f.id,text:String(input.text??f.text).slice(0,120),caption:String(input.caption??f.caption??'').slice(0,80),face:pick('face',f.face),construct:pick('construct',f.construct||'solid'),warp:pick('warp',f.warp||'none'),profile:pick('profile',f.profile),fill:pick('fill',f.fill),
  method:pick('method',f.method),mark:pick('mark',f.mark),layout:pick('layout',f.layout||'poster'),format:pick('format',f.format||'a'),palette:pick('palette',f.palette),case:pick('case',f.case||'upper'),
  align:pick('align','center'),view:pick('view','dither'),params};}

// ---------------------------------------------------------------- setting
const glyphOf=(F,ch)=>F.glyphs[ch]||F.glyphs[ch.toUpperCase()]||F.glyphs[ch.toLowerCase()]||null;
const lineAdvance=(F,line,p)=>{let w=0;const chars=[...line];chars.forEach((ch,i)=>{const g=glyphOf(F,ch);w+=(g?g.adv:280)*p.width+(i<chars.length-1?p.tracking*1000:0);});return w;};
// Sets lines (already split) with their cap height `cap` at (x, top); returns outlines and line bands.
// Bounce lifts or drops each glyph and spin turns it about its centre, both seeded per glyph.
function setLines(lines,face,p,{cap,x,top,width,align,first=0}){const F=FONTS[face],k=cap/F.capHeight,pitch=cap*p.leading,polys=[],bands=[];let gi=first;
 lines.forEach((line,i)=>{const w=lineAdvance(F,line,p)*k,base=top+cap+i*pitch;let gx=align==='left'?x:align==='right'?x+width-w:x+(width-w)/2;bands.push({top:base-cap,base,x0:gx,x1:gx+w,cap});
  for(const ch of line){const g=glyphOf(F,ch),adv=((g?g.adv:280)*p.width)*k;gi++;
   if(g){const dy=(hash(p.seed,gi,11)-.5)*p.bounce*cap*.7,an=(hash(p.seed,gi,13)-.5)*p.spin*55*DEG,ca=Math.cos(an),sa=Math.sin(an),cx=gx+adv/2,cy=base-cap/2;
    for(const q of glyphPolys(g.d,1,0,0)){const r=new Array(q.length);for(let j=0;j<q.length;j+=2){const x=gx+(q[j]*p.width-q[j+1]*p.slant)*k-cx,y=base+q[j+1]*k-cy;r[j]=cx+x*ca-y*sa;r[j+1]=cy+x*sa+y*ca+dy;}polys.push(r);}}
   gx+=adv+p.tracking*1000*k;}});
 return {polys,bands};}
// The largest cap height that fits lines in a box, with the pitch a whole number of pixels.
function fitCap(lines,face,p,w,h){const F=FONTS[face],units=Math.max(1,...lines.map(l=>lineAdvance(F,l,p)))/F.capHeight,n=lines.length,slantPad=Math.abs(p.slant);
 return Math.max(4,Math.min(w/(units+slantPad),h/(1+(n-1)*p.leading)));}
const caseOf=(s,t)=>s.case==='upper'?t.toUpperCase():t;
const linesOf=(s,t)=>caseOf(s,t).split('/').map(l=>l.trim()).filter(Boolean);
export const ALPHABET='ABCDEFGHIJKLM/NOPQRSTUVWXYZ/abcdefghijklm/nopqrstuvwxyz/0123456789/.,:;!?&@#%()ÄÖÜÉÈÇß';

// ---------------------------------------------------------------- distance
// Exact squared Euclidean distance transform (Felzenszwalb and Huttenlocher), rows then columns.
const BIG=1e20;
function edt1(f,n,d,v,z){let k=0;v[0]=0;z[0]=-BIG;z[1]=BIG;
 for(let q=1;q<n;q++){let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}k++;v[k]=q;z[k]=s;z[k+1]=BIG;}
 k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])*(q-v[k])+f[v[k]];}}
function edt(feature,W,H){const g=new Float64Array(W*H),n=Math.max(W,H),f=new Float64Array(n),d=new Float64Array(n),v=new Int32Array(n),z=new Float64Array(n+1);
 for(let k=0;k<W*H;k++)g[k]=feature[k]?0:BIG;
 for(let x=0;x<W;x++){for(let y=0;y<H;y++)f[y]=g[y*W+x];edt1(f,H,d,v,z);for(let y=0;y<H;y++)g[y*W+x]=d[y];}
 for(let y=0;y<H;y++){for(let x=0;x<W;x++)f[x]=g[y*W+x];edt1(f,W,d,v,z);for(let x=0;x<W;x++)g[y*W+x]=d[x];}
 return g;}
// Signed distance in samples: positive inside the letters, half a sample either side of the edge.
function signedDistance(cov,W,H){const ins=new Uint8Array(W*H);for(let k=0;k<W*H;k++)ins[k]=cov[k]>=.5?1:0;
 const toIn=edt(ins,W,H),toOut=edt(ins.map(b=>1-b),W,H),sd=new Float32Array(W*H);
 for(let k=0;k<W*H;k++)sd[k]=ins[k]?Math.sqrt(toOut[k])-.5:-(Math.sqrt(toIn[k])-.5);return sd;}

// ---------------------------------------------------------------- tone
// Profiles map depth t (0 at the edge, 1 at the stroke's spine) to a height; their slope is lit.
const PROFILE={flat:t=>t>0?1:0,tube:t=>Math.sqrt(Math.max(0,1-(1-t)**2)),chisel:t=>t,pillow:t=>1-(1-t)**3,groove:t=>Math.sin(Math.PI*Math.min(t,1)),rim:t=>t<.35?t/.35:1-.5*smooth(.35,.7,t)};
function shade(nx,ny,nz,L,p){const d=nx*L[0]+ny*L[1]+nz*L[2],spec=Math.max(0,2*d*nz-L[2]);return p.ambient+(1-p.ambient)*Math.max(0,d)*.68/Math.max(.25,L[2])+p.gloss*spec**28;}
function fillTone(s,x,y,band,block,cap){const p=s.params,a=p.fillAmount,t=s.fill;if(t==='solid')return 0;
 if(t==='ramp'){const f=band?clamp((band.base-y)/band.cap):.5;return a*f;}
 if(t==='sweep'){const f=clamp((x-block.x0)/Math.max(1,block.x1-block.x0));return a*f;}
 const u=x/cap,v=y/cap,sd=p.seed*3.7;
 if(t==='swirl'){const X=u*1.6+sd,Y=v*1.6,qx=fbm(X,Y),qy=fbm(X+5.2,Y+1.3);return a*clamp(.5+fbm(X+3.6*qx,Y+3.6*qy)*1.6);}
 if(t==='cloud')return a*clamp(.5+.9*fbm(u*2.2+sd,v*2.2,5));
 return a*smooth(-.3,.3,Math.sin((v*4+.5*fbm(u*1.5+sd,v*3))*Math.PI)+.4*fbm(u*3,v*5+sd));}
// Constructions: for a sample at distance d (samples, positive inside) give the letter's coverage, its depth t across
// the stroke for the profile (0 at an edge, 1 at the middle) and which way that depth grows along the distance (±1, 0 flat).
function construct(s,d,X,Y,px,py,pn,{capS,Wd,cap,sample}){const a=s.params.constructAmount,in0=smooth(-.5,.5,d);
 switch(s.construct){
  case 'outline':{// The band is a share of the stroke's half width, so the middle of every stroke opens.
   const bw=Math.max(1.5,(.15+a*.5)*Wd),h=bw/2;return [in0*smooth(-.5,.5,bw-d),clamp(Math.min(d,bw-d)/h),d<h?1:-1];}
  case 'contours':{const sp=Math.max(3,(.06+a*.24)*capS);if(d<-2*sp)return [0,0,0];const u=d-Math.floor(d/sp)*sp,h=sp/4;return [smooth(-.5,.5,u)*smooth(-.5,.5,sp/2-u)*(d<0?smooth(-2*sp,-sp,d):1),clamp(Math.min(u,sp/2-u)/h),u<h?1:-1];}
  case 'neon':{const w=Math.max(1.2,(.025+a*.12)*capS);return [smooth(-.5,.5,w-Math.abs(d)),clamp((w-Math.abs(d))/w),d<0?1:-1];}
  case 'erode':{const n=fbm(px/cap*7+s.params.seed,py/cap*7,3)*.8+(hash(X,Y,s.params.seed)-.5)*.5,de=d+n*a*.3*capS;return [smooth(-.5,.5,de),clamp(de/Wd),de<Wd?1:0];}
  case 'slices':{const band=pn.bands.find(b=>py<=b.base+b.cap*.35)||pn.bands[pn.bands.length-1],n=2+Math.round(a*8),v=band?(band.base-py)/band.cap*n:0,f=v-Math.floor(v);return [in0*smooth(.26,.34,f),clamp(d/Wd),d<Wd?1:0];}
  case 'melt':{if(d>-.5)return [in0,clamp(d/Wd),d<Wd?1:0];
   // Columns drip by their own seeded length; a sample is paint if a letter sits above it within that length.
   const col=Math.floor(X/Math.max(1,capS*.07)),r=hash(col,s.params.seed,29),len=r<.35?0:a*capS*(.12+.88*((r-.35)/.65)**2);if(!len||d<-len)return [0,0,0];
   const steps=Math.min(40,Math.ceil(len));for(let k=1;k<=steps;k++)if(sample(X,Y-len*k/steps)>0)return [1,.6,0];return [0,0,0];}
  default:return [in0,clamp(d/Wd),d<Wd?1:0];}}
// One panel: a rectangle with its own setting and pixel. Returns brightness per cell (1 = paper) and the coverage.
function panelTone(s,pn,G,view){const p=s.params,{cols,rows,pw,ph,ox,oy}=G,cap=pn.cap;
 const SS=clamp(Math.floor(Math.sqrt(260000/(cols*rows))),1,4),W=cols*SS,H=rows*SS,sx=pw/SS,sy=ph/SS,unit=Math.min(sx,sy);
 const cov=coverage(pn.polys,W,H,{x0:ox,y0:oy,pw:sx,ph:sy,sub:2}),sd=signedDistance(cov,W,H),wgt=p.weight*cap*.12/unit;
 for(let k=0;k<sd.length;k++)sd[k]+=wgt;
 // The stroke's half width: the deepest point of the setting, a little in, so most stems reach their spine.
 let deep=1;for(const v of sd)if(v>deep)deep=v;const Wd=Math.max(1,deep*.85);
 const at=(x,y)=>sd[clamp(y,0,H-1)*W+clamp(x,0,W-1)],sample=(fx,fy)=>{const x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0;return mix(mix(at(x0,y0),at(x0+1,y0),tx),mix(at(x0,y0+1),at(x0+1,y0+1),tx),ty);};
 const a=p.light*DEG,e=p.height*DEG,L=[Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e)],prof=PROFILE[s.profile],up=shade(0,0,1,L,p);
 const capS=cap/unit,haloW=Math.max(.5,p.haloWidth*capS),soft=Math.max(.5,p.shadowSoft*capS),shx=p.shadowX*cap/sx,shy=p.shadowY*cap/sy;
 const exLen=p.extrude*capS,exSteps=exLen>0?Math.min(48,Math.ceil(exLen)):0,exDx=Math.cos(p.extrudeAngle*DEG)*exLen/Math.max(1,exSteps),exDy=Math.sin(p.extrudeAngle*DEG)*exLen/Math.max(1,exSteps);
 const out=new Float32Array(cols*rows),cells=new Float32Array(cols*rows);
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){let acc=0,inkCov=0;
  for(let yy=0;yy<SS;yy++)for(let xx=0;xx<SS;xx++){const X=i*SS+xx,Y=j*SS+yy,k=Y*W+X,d=sd[k],px=ox+(X+.5)*sx,py=oy+(Y+.5)*sy;
   const [inside,t,sg]=construct(s,d,X,Y,px,py,pn,{capS,Wd,cap,sample});inkCov+=inside;
   if(view==='letters'){acc+=1-inside;continue;}
   let B=clamp(p.ground+p.ramp*((py-pn.rect.y)/pn.rect.h-.5));
   if(p.shadow>0){const a2=smooth(-soft,soft,sample(X-shx,Y-shy))*p.shadow;B=mix(B,p.shadowTone,a2);}
   if(exSteps&&d<.5&&d>-exLen-2){for(let t=1;t<=exSteps;t++)if(sample(X-exDx*t,Y-exDy*t)>0){B=mix(p.extrudeNear,p.extrudeFar,(t-1)/Math.max(1,exSteps-1));break;}}
   if(p.halo>0&&d<0)B=mix(B,p.letter,p.halo*Math.exp(d/haloW));
   if(inside>0){const band=pn.bands.find(b=>py<=b.base+b.cap*.35)||pn.bands[pn.bands.length-1];let Lb=mix(p.letter,1-p.letter,fillTone(s,px,py,band,pn.block,cap));
    if(s.profile!=='flat'&&p.depth>0&&sg){const h1=prof(Math.min(1,t+.04)),h0=prof(Math.max(0,t-.04)),slope=(h1-h0)/.08*sg*p.depth*.5;
     const gx=(at(X+1,Y)-at(X-1,Y))/2,gy=(at(X,Y+1)-at(X,Y-1))/2,nx=-gx*slope,ny=-gy*slope,n=Math.hypot(nx,ny,1);Lb=clamp(Lb+shade(nx/n,ny/n,1/n,L,p)-up);}
    B=mix(B,Lb,inside);}
   acc+=B;}
  let B=acc/(SS*SS);cells[j*cols+i]=inkCov/(SS*SS);
  if(view!=='letters'){B=clamp((B+p.brightness-.5)*p.contrast+.5)**p.gamma;
   if(p.grain){const gx=Math.round(ox/pw)+i,gy=Math.round(oy/ph)+j;B+=p.grain*((hash(gx,gy,p.seed)-.5)*.5+fbm(gx*.21,gy*.21+p.seed,2)*.45);}
   if(p.invert)B=1-B;}
 out[j*cols+i]=clamp(B);}
 return {B:out,cells};}

// ---------------------------------------------------------------- layouts
// Each layout gives panels: a rectangle, its outlines and line bands, its cap height and rows.
function layout(s,W,H){const p=s.params,M=Math.min(W,H),m=p.margin*M,panels=[],orn=[],rect=(x,y,w,h)=>({x,y,w,h});
 const block=(lines,cap,x,top,w,face=s.face,align=s.align)=>{const set=setLines(lines,face,p,{cap,x,top,width:w,align});return {...set,block:{x0:Math.min(...set.bands.map(b=>b.x0)),x1:Math.max(...set.bands.map(b=>b.x1))}};};
 switch(s.layout){
  case 'specimen':{const lines=ALPHABET.split('/'),cap=fitCap(lines,s.face,p,W-2*m,H-2*m)*.96,h=cap*(1+(lines.length-1)*p.leading);
   panels.push({rect:rect(0,0,W,H),cap,rows:p.rows,...block(lines,cap,m,(H-h)/2,W-2*m,s.face,'left')});break;}
  case 'sizes':{const line=linesOf(s,s.text)[0]||'A',scales=[1,.62,.4,.26,.17],c0=fitCap([line],s.face,p,W-2*m,1e9),sum=scales.reduce((a,b)=>a+b,0),cap0=Math.min(c0,(H-2*m)/(sum*1.45));let y=m;
   for(const k of scales){const cap=cap0*k,h=cap*1.45;panels.push({rect:rect(0,y,W,h),cap,rows:p.rows,...block([line],cap,m,y+(h-cap)/2,W-2*m,s.face,'left')});y+=h;}break;}
  case 'ladder':{const line=linesOf(s,s.text)[0]||'A',steps=[6,9,14,22,34],h=(H-2*m)/steps.length,cap=Math.min(fitCap([line],s.face,p,W-2*m,1e9),h/1.4);
   steps.forEach((r,k)=>{const y=m+k*h;panels.push({rect:rect(0,y,W,h),cap,rows:r,...block([line],cap,m,y+(h-cap)/2,W-2*m)});});break;}
  case 'tiles':{const chars=[...new Set([...caseOf(s,s.text).replace(/[\s/]/g,'')])].slice(0,12);if(!chars.length)chars.push('A');
   let best=1,size=0;for(let c=1;c<=chars.length;c++){const r=Math.ceil(chars.length/c),z=Math.min((W-2*m)/c,(H-2*m)/r);if(z>size){size=z;best=c;}}
   const r=Math.ceil(chars.length/best),gx=(W-best*size)/2,gy=(H-r*size)/2;
   chars.forEach((ch,k)=>{const x=gx+(k%best)*size,y=gy+Math.floor(k/best)*size,cap=size*.58;panels.push({rect:rect(x,y,size,size),cap,rows:p.rows,...block([ch],cap,x,y+(size-cap)/2-cap*.05,size,s.face,'center')});});break;}
  case 'stack':{const lines=linesOf(s,s.text);if(!lines.length)lines.push(' ');const fr=p.frame?M*.012:0,inset=m+(fr?fr+M*.03:0),capH=s.caption?p.captionSize:0;
   if(fr)orn.push({x:m,y:m,w:W-2*m,h:H-2*m,t:fr});
   // Each line takes the cap that fills the width; if the stack is too tall, every line shrinks alike.
   const boxW=W-2*inset,boxH=(H-2*inset)*(1-(capH?.14:0)),caps=lines.map(l=>fitCap([l],s.face,p,boxW,1e9)),tall=caps.reduce((a,c,i)=>a+c*(i<caps.length-1?p.leading:1),0),k=Math.min(1,boxH/tall)*.98;
   let y=inset+(boxH-tall*k)/2;const polys=[],bands=[];
   lines.forEach((l,i)=>{const cap=caps[i]*k,set=setLines([l],s.face,p,{cap,x:inset,top:y,width:boxW,align:s.align,first:i*40});polys.push(...set.polys);bands.push(...set.bands);y+=cap*p.leading;});
   // The pixel comes from the smallest line, so every line gets at least its rows per cap.
   const cap=Math.min(...caps)*k;panels.push({rect:rect(0,0,W,H),cap,rows:p.rows,polys,bands,block:{x0:Math.min(...bands.map(b=>b.x0)),x1:Math.max(...bands.map(b=>b.x1))}});
   if(capH){const cl=linesOf(s,s.caption),cc=Math.min(fitCap(cl,s.face,p,boxW*.8,1e9),cap*capH),ch=cc*(1+(cl.length-1)*p.leading),cy=H-inset-ch-cc*.4;
    panels.push({rect:rect(inset,cy-cc*.5,boxW,ch+cc),cap:cc,rows:Math.max(5,Math.round(p.rows*.6)),...block(cl,cc,inset,cy,boxW)});}
   break;}
  default:{const lines=linesOf(s,s.text);if(!lines.length)lines.push(' ');const fr=p.frame?M*.012:0,inset=m+(fr?fr+M*.03:0),capH=s.caption?p.captionSize:0;
   if(fr)orn.push({x:m,y:m,w:W-2*m,h:H-2*m,t:fr});
   const boxW=W-2*inset,boxH=(H-2*inset)*(1-(capH?.16:0)),cap=fitCap(lines,s.face,p,boxW,boxH)*.98,h=cap*(1+(lines.length-1)*p.leading),top=inset+(boxH-h)/2;
   panels.push({rect:rect(0,0,W,H),cap,rows:p.rows,...block(lines,cap,inset,top,boxW)});
   if(capH){const cl=linesOf(s,s.caption),cc=Math.min(fitCap(cl,s.face,p,boxW*.8,1e9),cap*capH),ch=cc*(1+(cl.length-1)*p.leading),cy=H-inset-ch-cc*.4;
    panels.push({rect:rect(inset,cy-cc*.5,boxW,ch+cc),cap:cc,rows:Math.max(5,Math.round(p.rows*.6)),...block(cl,cc,inset,cy,boxW)});}}}
 return {panels,orn};}
// Warps move every outline point of a panel's setting, measured against its block: edges are resampled first so they bend.
function resample(q,step){const out=[],n=q.length;for(let i=0;i<n;i+=2){const j=i+2<n?i+2:0,ax=q[i],ay=q[i+1],bx=q[j],by=q[j+1],m=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/step));for(let k=0;k<m;k++)out.push(ax+(bx-ax)*k/m,ay+(by-ay)*k/m);}return out;}
function warp(pn,kind,a){if(kind==='none'||!a||!pn.bands.length)return pn;const x0=pn.block.x0,x1=pn.block.x1,y0=pn.bands[0].top,y1=pn.bands[pn.bands.length-1].base,cx=(x0+x1)/2,cy=(y0+y1)/2,hw=Math.max(1,(x1-x0)/2),hh=Math.max(1,(y1-y0)/2),cap=pn.cap,R=Math.max(hw,hh);
 const f=(x,y)=>{switch(kind){
  case 'wave':return [x,y+a*cap*.32*Math.sin((x-x0)/(cap*2.4)*TAU)];
  case 'arc':{const t=(x-cx)/hw;return [x,y-a*cap*1.1*(1-t*t)];}
  case 'perspective':{const k=1+a*.55*(y-cy)/hh;return [cx+(x-cx)*k,y];}
  case 'bulge':{const dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy)/R,k=1+a*.45*Math.max(0,1-r*r);return [cx+dx*k,cy+dy*k];}
  default:{const u=(x-x0)/(cap*.9),tri=Math.abs(u-Math.floor(u)-.5)*2;return [x,y+a*cap*.28*(tri-.5)];}}};
 const step=cap/14;return {...pn,polys:pn.polys.map(q=>{const r=resample(q,step);for(let i=0;i<r.length;i+=2){const [x,y]=f(r[i],r[i+1]);r[i]=x;r[i+1]=y;}return r;})};}
// The pixel grid of a panel: one pixel per cap/rows, aligned so the first line's cap top sits on a pixel edge.
function panelGrid(pn,aspect){const ph=pn.cap/pn.rows,pw=ph*aspect,top=pn.bands.length?pn.bands[0].top:pn.rect.y,left=pn.block.x0;
 const oy=top-Math.ceil((top-pn.rect.y)/ph-1e-9)*ph,ox=left-Math.ceil((left-pn.rect.x)/pw-1e-9)*pw;
 return {cols:Math.max(1,Math.floor((pn.rect.x+pn.rect.w-ox)/pw)),rows:Math.max(1,Math.floor((pn.rect.y+pn.rect.h-oy)/ph)),pw,ph,ox,oy};}

// ---------------------------------------------------------------- render
const f2=v=>{const r=Math.round(v*100)/100;return Object.is(r,-0)?'0':String(r);};
export function render(input,{view}={}){const s=normalize(input),{w:W,h:H}=FORMATS[s.format],p=s.params,v=view||s.view,n=p.levels,colors=inks(s.palette,n);
 const pal=PALETTES[s.palette],dark=pal.page==='dark',pageLevel=dark?n-1:0,page=colors[pageLevel],ornament=dark?colors[0]:colors[n-1];
 const laid=layout(s,W,H),orn=laid.orn,panels=laid.panels.map(pn=>warp(pn,s.warp,p.warpAmount)),counts=new Array(n).fill(0);let body='',cells=0;
 // The page's own ground is dithered too, so panels sit in one continuous picture: a backdrop panel fills the page first.
 const backdrop=panels[0]&&panels[0].rect.w===W&&panels[0].rect.h===H?[]:[{rect:{x:0,y:0,w:W,h:H},cap:panels[0]?.cap||100,rows:p.rows,polys:[],bands:[],block:{x0:0,x1:W}}];
 let drawn=0,minP=Infinity;for(const pn of [...backdrop,...panels]){const G=panelGrid(pn,p.aspect),{B}=panelTone(s,pn,G,v);cells+=G.cols*G.rows;
  // A panel drawn over another covers it with the page colour first.
  if(drawn++)body+=`<rect x="${f2(G.ox)}" y="${f2(G.oy)}" width="${f2(G.cols*G.pw)}" height="${f2(G.rows*G.ph)}" fill="${page}"/>`;
  if(v==='tone'){const steps=24,q=new Uint8Array(B.length);for(let k=0;k<B.length;k++)q[k]=Math.round((1-B[k])*(steps-1));
   for(let l=0;l<steps;l++){const d=markPath(q,l,G,'pixel',1);if(d){const t=l/(steps-1)*(colors.length-1),a=Math.floor(t);body+=`<path fill="${a>=colors.length-1?colors[colors.length-1]:mixHex(colors[a],colors[a+1],t-a)}" d="${d}"/>`;}}continue;}
  const ink=new Float32Array(B.length);for(let k=0;k<B.length;k++)ink[k]=1-B[k];
  const strength=pageLevel?ink.map(x=>1-x):ink,dq=v==='letters'?ink.map(x=>x>=.5?n-1:0):dither(ink,G.cols,G.rows,{method:s.method,levels:n,order:p.order,seed:p.seed}),q=v!=='letters'&&SCREENS.has(s.mark)?screenLevels(dq,strength,pageLevel,n):dq;
  if(v==='letters'&&dark)for(let k=0;k<q.length;k++)q[k]=n-1-q[k];
  for(const l of q)counts[l]++;
  // Misregistration slides each ink by its own seeded offset, up to most of a pixel.
  for(let l=0;l<n;l++){if(l===pageLevel)continue;const d=markPath(q,l,G,v==='letters'?'pixel':s.mark,p.markSize,strength);if(!d)continue;
   const mx=p.misregister?(hash(l,p.seed,41)-.5)*1.8*p.misregister*G.pw:0,my=p.misregister?(hash(l,p.seed,43)-.5)*1.8*p.misregister*G.ph:0;
   body+=`<path fill="${colors[l]}"${mx||my?` transform="translate(${f2(mx)} ${f2(my)})"`:''} d="${d}"/>`;}
  minP=Math.min(minP,G.ph);}
 let ornD='';for(const r of orn){const t=r.t;ornD+=`M${f2(r.x)} ${f2(r.y)}h${f2(r.w)}v${f2(r.h)}h${f2(-r.w)}zM${f2(r.x+t)} ${f2(r.y+t)}v${f2(r.h-2*t)}h${f2(r.w-2*t)}v${f2(-(r.h-2*t))}z`;}
 // Bloom lays a blurred copy of the marks beneath them, like light spilling from LEDs.
 if(p.bloom>0&&v!=='letters'&&Number.isFinite(minP)){// Ids carry a hash of the state, so posters nested in one sheet never borrow each other's marks.
  let h=2166136261;for(const c of JSON.stringify(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;const id=h.toString(36);
  body=`<defs><filter id="bloom-${id}" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${f2(minP*1.1)}"/></filter></defs><use href="#marks-${id}" filter="url(#bloom-${id})" opacity="${f2(p.bloom)}"/><g id="marks-${id}">${body}</g>`;}
 if(ornD)body+=`<path fill="${ornament}" d="${ornD}"/>`;
 const fam=FAMILY[s.family],esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const desc=esc(`“${s.text.replaceAll('/',' / ')}” in ${FONTS[s.face].name}, ${PROFILES[s.profile].toLowerCase()} profile, ${p.rows} rows to the cap; ${METHODS[s.method].name}, ${n} inks, ${MARKS[s.mark].toLowerCase()}.`);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${desc}"><title>${esc(fam.name)} — heavy dither type</title><desc>${desc}</desc><rect width="${W}" height="${H}" fill="${page}"/>${body}</svg>`;
 return {svg,state:s,width:W,height:H,stats:{panels:panels.length,cells,counts,inks:colors,page}};}

// ---------------------------------------------------------------- font
// One glyph dithered on its own, at the style's rows, in font units (cap = 700, y up). Returns runs per ink level,
// the advance, and the page level. Halos, shadows and extrusions are kept, so they may reach past the advance.
export function glyphPixels(input,ch,{cap=700}={}){const s0=normalize(input),s={...s0,warp:'none',params:{...s0.params,bounce:0,spin:0}},p=s.params,F=FONTS[s.face],g=glyphOf(F,ch),adv=Math.round(((g?g.adv:280)*p.width+p.tracking*1000)*cap/F.capHeight);
 const pad=cap*(.15+Math.max(p.halo>0?p.haloWidth*1.5:0,p.shadow>0?Math.hypot(p.shadowX,p.shadowY)+p.shadowSoft:0,p.extrude)),x0=-pad,y0=-cap-pad;
 const set=setLines([ch],s.face,p,{cap,x:0,top:-cap,width:adv,align:'left'}),pn={rect:{x:x0,y:y0,w:adv+2*pad,h:cap*1.45+2*pad},cap,rows:p.rows,...set,block:{x0:0,x1:adv}};
 const dark=PALETTES[s.palette].page==='dark',G=panelGrid(pn,p.aspect),{B}=panelTone({...s,params:{...p,ground:dark?0:1,ramp:0}},pn,G,'dither'),ink=new Float32Array(B.length);for(let k=0;k<B.length;k++)ink[k]=1-B[k];
 const n=p.levels,q=dither(ink,G.cols,G.rows,{method:s.method,levels:n,order:p.order,seed:p.seed}),pageLevel=dark?n-1:0,runs=[];
 for(let l=0;l<n;l++){if(l===pageLevel)continue;const r=[];for(let j=0;j<G.rows;j++)for(let i=0;i<G.cols;){if(q[j*G.cols+i]!==l){i++;continue;}let e=i;while(e<G.cols&&q[j*G.cols+e]===l)e++;
   // y up in font units: the cell's top edge is -(oy + j·ph).
   r.push([G.ox+i*G.pw,-(G.oy+(j+1)*G.ph),(e-i)*G.pw,G.ph]);i=e;}runs.push({level:l,runs:r});}
 return {adv,runs,pageLevel,levels:n};}
