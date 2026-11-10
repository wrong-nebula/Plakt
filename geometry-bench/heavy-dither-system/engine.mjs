/* Heavy dither — a shape system after a reference from the user (8 November 2026): a photograph
 * dithered to coarse 1-bit pixels inside a black frame, where solid blacks break into checks and
 * noise and soft forms read only through the density of big pixels.
 * Every shape is a tone field: a lit volume (its height lit from one side), a tonal fill (swirl,
 * stripes, rings, clouds…) or soft copy. Items are composed into one continuous picture, toned,
 * grained, and dithered on a coarse pixel grid into marks: square pixels, LEDs, dots, scan lines,
 * diamonds or stitches, in two to four inks. Arrangements set the picture framed, full bleed, over
 * a headline, as a field of shapes, an atlas of every shape, a specimen of every dither method, or
 * in bands that step from heavy pixels to fine. Nothing is traced from the reference.
 */
import {METHODS,dither,blur,coverage} from './dither.mjs';
import {FONTS} from './fonts.mjs';
export {METHODS};
export const ENGINE='heavy-dither-v1';
const TAU=Math.PI*2,DEG=Math.PI/180,clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v,mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

// ---------------------------------------------------------------- noise
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const PERM=(()=>{const r=rng(1337),p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]];}return Uint8Array.from([...p,...p]);})();
const GRAD=[[1,0],[-1,0],[0,1],[0,-1],[.7071,.7071],[-.7071,.7071],[.7071,-.7071],[-.7071,-.7071]];
function noise2(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,X=xi&255,Y=yi&255;
 const g=(i,j,dx,dy)=>{const v=GRAD[PERM[PERM[X+i]+Y+j]&7];return v[0]*dx+v[1]*dy;};
 const u=xf*xf*xf*(xf*(xf*6-15)+10),v=yf*yf*yf*(yf*(yf*6-15)+10);
 return mix(mix(g(0,0,xf,yf),g(1,0,xf-1,yf),u),mix(g(0,1,xf,yf-1),g(1,1,xf-1,yf-1),u),v)*1.41;}
const fbm=(x,y,o=4)=>{let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*noise2(x*f,y*f);f*=2.03;a*=.5;}return s;};
function hash(a,b,c){let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(c|0,2246822519))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return ((h^(h>>>16))>>>0)/4294967296;}

// ---------------------------------------------------------------- catalogues
export const FORMATS={a:{name:'A series',w:728,h:1030},poster:{name:'Poster 2:3',w:700,h:1050},story:{name:'Story 9:16',w:608,h:1080},square:{name:'Square',w:900,h:900},wide:{name:'Wide 16:9',w:1280,h:720}};
export const FONT_LIST=Object.entries(FONTS).map(([id,f])=>({id,name:f.name,license:f.license}));
// Colours run from the picture's lightest value to its darkest. The page takes the light or the dark end.
export const PALETTES={
 newsprint:{name:'Newsprint',colors:['#efece2','#121212'],page:'light'},
 acid:{name:'Night / acid',colors:['#e4ff3a','#08080a'],page:'dark'},
 neon:{name:'Neon',colors:['#3df5ff','#ff2bd6','#07060d'],page:'dark'},
 riso:{name:'Riso pink / blue',colors:['#f4efe6','#ff5fa2','#2b49ff'],page:'light'},
 handheld:{name:'Handheld green',colors:['#c4cfa1','#8b956d','#4d533c','#1f1f1f'],page:'light'},
 thermal:{name:'Thermal',colors:['#f7f6f2','#2a2a2e'],page:'light'},
 blueprint:{name:'Blueprint',colors:['#eef3ff','#1238c8'],page:'light'},
 signal:{name:'Signal red',colors:['#f2efe9','#e8261c','#141414'],page:'light'},
 ultra:{name:'Ultraviolet',colors:['#ffd6f5','#ff3fa4','#5b14ff','#0d0420'],page:'dark'},
 ice:{name:'Ice',colors:['#ffffff','#7fd8ff','#0a2a6b'],page:'dark'},
 chrome:{name:'Chrome',colors:['#ffffff','#b7b7bd','#5d5d66','#101014'],page:'dark'},
 ember:{name:'Ember',colors:['#ffe14d','#ff5a1f','#3a0a00'],page:'dark'}
};
// Shapes. Volumes give a height that the light shades; fills give a tone directly; copy is set type,
// softened and lit like a volume. Masks: disc and box shapes fade at their edge, the shape's own outline otherwise.
export const SHAPES={
 sphere:{name:'Sphere',group:'Volumes',kind:'height'},
 torus:{name:'Torus',group:'Volumes',kind:'height'},
 pyramid:{name:'Pyramid',group:'Volumes',kind:'height'},
 star:{name:'Star',group:'Volumes',kind:'height'},
 blob:{name:'Blob',group:'Volumes',kind:'height'},
 pillow:{name:'Pillow',group:'Volumes',kind:'height'},
 bumps:{name:'Bumps',group:'Volumes',kind:'height'},
 ripple:{name:'Ripple',group:'Volumes',kind:'height'},
 ridges:{name:'Ridges',group:'Volumes',kind:'height'},
 swirl:{name:'Swirl',group:'Fills',kind:'tone'},
 stripes:{name:'Stripes',group:'Fills',kind:'tone'},
 rings:{name:'Rings',group:'Fills',kind:'tone'},
 burst:{name:'Burst',group:'Fills',kind:'tone'},
 glow:{name:'Glow',group:'Fills',kind:'tone'},
 ramp:{name:'Ramp',group:'Fills',kind:'tone'},
 cloud:{name:'Cloud',group:'Fills',kind:'tone'},
 checks:{name:'Checks',group:'Fills',kind:'tone'},
 copy:{name:'Copy',group:'Type',kind:'copy'}
};
export const SHAPE_IDS=Object.keys(SHAPES);
export const MARKS={pixel:'Square pixels',led:'LEDs (gapped)',dot:'Dots',scan:'Scan lines',diamond:'Diamonds',cross:'Stitches',
 halftone:'Halftone (dots sized by tone)',ascii:'Ascii (text mode)',hatch:'Hatching',rings:'Rings',knit:'Knit',tiles:'Mosaic tiles',bricks:'Bricks',triangles:'Triangles'};
export const ARRANGEMENTS={frame:'Framed picture',bleed:'Full bleed',poster:'Picture over a headline',field:'Field of shapes',atlas:'Shape atlas',specimen:'Method specimen',steps:'Steps, heavy to fine'};
export const BLENDS={over:'Over',darken:'Darken',lighten:'Lighten',multiply:'Multiply',screen:'Screen',difference:'Difference'};
export const VIEWS={dither:'Dithered',tone:'Tone before dithering'};
export const LABELS={method:Object.fromEntries(Object.entries(METHODS).map(([k,m])=>[k,m.name])),mark:MARKS,arrangement:ARRANGEMENTS,palette:Object.fromEntries(Object.entries(PALETTES).map(([k,p])=>[k,p.name])),
 format:Object.fromEntries(Object.entries(FORMATS).map(([k,f])=>[k,f.name])),font:Object.fromEntries(Object.entries(FONTS).map(([k,f])=>[k,f.name])),view:VIEWS,
 shape:Object.fromEntries(Object.entries(SHAPES).map(([k,s])=>[k,s.name])),blend:BLENDS};
export const OPTIONS=Object.fromEntries(Object.entries(LABELS).map(([k,v])=>[k,Object.keys(v)]));
// Global controls: [id, name, group, min, max, step, default, unit]. The editor and the verification sweep read this.
export const CONTROLS=[
 ['pixel','Pixel','pixels',2,40,.5,7,'u'],['aspect','Pixel aspect','pixels',.5,3,.05,1,''],['markSize','Mark size','pixels',.4,1.3,.01,.86,''],
 ['levels','Inks','dither',2,4,1,2,''],['order','Ordered checks','dither',0,1,.01,0,''],['seed','Seed','dither',1,99,1,7,''],
 ['light','Light from','light',-180,180,1,-135,'°'],['height','Light height','light',5,85,1,40,'°'],['relief','Relief','light',.2,4,.05,1.4,''],['gloss','Gloss','light',0,1,.01,.25,''],['ambient','Ambient','light',0,.8,.01,.12,''],
 ['ground','Ground','tone',0,1,.01,1,''],['ramp','Ground ramp','tone',-1,1,.01,0,''],['brightness','Brightness','tone',-.6,.6,.01,0,''],['contrast','Contrast','tone',.3,4,.05,1.2,''],['gamma','Gamma','tone',.3,3,.01,1,''],
 ['grain','Grain','tone',0,1,.01,.2,''],['blur','Soften','tone',0,6,.5,0,'px'],['soft','Edge softness','tone',0,.4,.005,.04,''],['spread','Copy softness','tone',0,1,.01,.14,''],
 ['margin','Margin','layout',0,.25,.005,.11,''],['cols','Field columns','layout',1,8,1,3,''],['invert','Invert','tone',0,1,1,0,'']
].map(([id,name,group,min,max,step,def,unit])=>({id,name,group,min,max,step,def,unit}));
const DEFAULTS=Object.fromEntries(CONTROLS.map(c=>[c.id,c.def]));
// Item fields: [id, name, min, max, step, default].
export const ITEM_CONTROLS=[['x','Across',-.2,1.2,.005,.5],['y','Down',-.2,1.2,.005,.5],['size','Size',.05,2.5,.01,.7],['turn','Turn',-180,180,1,0],['aspect','Stretch',.2,6,.01,1],
 ['amount','Amount',0,1,.01,1],['detail','Detail',-2,2,1,0],['seed','Seed',1,99,1,1]].map(([id,name,min,max,step,def])=>({id,name,min,max,step,def}));
const ITEM_DEF={shape:'sphere',blend:'over',invert:false,text:'DITHER',font:'archivo',...Object.fromEntries(ITEM_CONTROLS.map(c=>[c.id,c.def]))};
// Which controls and options matter for a state, so the editor can dim the rest. Scripts get the same answer.
export function applies(id,s){const shapes=s.items.map(it=>SHAPES[it.shape].kind),lit=shapes.includes('height')||shapes.includes('copy');
 switch(id){case 'order':return METHODS[s.method].kind==='diffuse';case 'markSize':return s.mark!=='pixel';
  case 'light':case 'height':case 'relief':case 'gloss':case 'ambient':return lit;case 'spread':return shapes.includes('copy');
  case 'margin':return ['frame','atlas','specimen','poster'].includes(s.arrangement);case 'cols':return s.arrangement==='field';
  case 'title':return s.arrangement==='poster';default:return true;}}

// ---------------------------------------------------------------- styles
const I=(shape,o={})=>({...ITEM_DEF,shape,...o});
// The source composition: an organic swirl filling the frame, tiger stripes along its top, dark blobs inside.
export const FAMILIES=[
 {id:'framed',name:'Framed print',after:'the user’s reference: a dithered photograph in a black frame',palette:'newsprint',arrangement:'frame',method:'atkinson',mark:'pixel',
  params:{pixel:6.5,order:.5,contrast:1.3,grain:.25,ground:.62,relief:1.8,gloss:.1,margin:.11},
  items:[I('swirl',{x:.5,y:.58,size:1.6,aspect:.82,seed:4}),I('stripes',{x:.5,y:.09,size:.36,aspect:3.4,amount:.95,seed:9,detail:2}),
   I('blob',{x:.42,y:.52,size:.55,seed:5,invert:true,blend:'darken',amount:.85}),I('blob',{x:.66,y:.76,size:.42,seed:12,invert:true,blend:'darken',amount:.9}),I('sphere',{x:.62,y:.4,size:.36,blend:'lighten',amount:.7})],
  note:'An organic swirl fills the frame, tiger stripes run along its top and dark blobs sink into it; Atkinson diffusion with ordered checks breaks the blacks into checks and noise.'},
 {id:'moon',name:'Moon',after:'new',palette:'chrome',arrangement:'bleed',method:'bayer8',mark:'pixel',
  params:{pixel:9,levels:4,ground:0,ramp:.25,relief:1.2,gloss:.45,ambient:.04,contrast:1.1,grain:.12},
  items:[I('sphere',{x:.5,y:.46,size:.9}),I('glow',{x:.5,y:.46,size:1.25,blend:'lighten',amount:.35})],
  note:'One lit sphere on black in four chrome greys through an 8×8 Bayer matrix.'},
 {id:'neon',name:'Neon pulse',after:'new',palette:'neon',arrangement:'bleed',method:'blue',mark:'led',
  params:{pixel:8,levels:3,ground:0,contrast:1.35,grain:.1,markSize:.8},
  items:[I('rings',{x:.5,y:.5,size:1.5,detail:1,amount:.85}),I('glow',{x:.5,y:.5,size:1.1,blend:'lighten'}),I('burst',{x:.5,y:.5,size:2.2,blend:'multiply',amount:.4,detail:2})],
  note:'Rings and a glow on black, three inks of cyan and magenta through blue noise, drawn as gapped LEDs.'},
 {id:'handheld',name:'Handheld',after:'new',palette:'handheld',arrangement:'frame',method:'bayer4',mark:'pixel',
  params:{pixel:12,levels:4,ground:.85,relief:1.6,contrast:1.2,grain:0,margin:.08},
  items:[I('bumps',{x:.5,y:.5,size:1.6,aspect:.75,amount:.6}),I('torus',{x:.5,y:.47,size:.8,turn:-20})],
  note:'A torus over an egg-crate field in four handheld greens, chunky 4×4 Bayer pixels.'},
 {id:'riso',name:'Riso blobs',after:'new',palette:'riso',arrangement:'bleed',method:'atkinson',mark:'pixel',
  params:{pixel:6,levels:3,ground:.95,relief:1.5,gloss:.1,grain:.2,ambient:.05},
  items:[I('ramp',{x:.5,y:.5,size:1.7,turn:90,amount:.35}),I('blob',{x:.38,y:.35,size:.6,seed:3}),I('blob',{x:.64,y:.62,size:.7,seed:8}),I('blob',{x:.36,y:.8,size:.4,seed:21})],
  note:'Seeded blobs lit from the upper left in fluorescent pink and blue, Atkinson diffusion.'},
 {id:'scan',name:'Scan terrain',after:'new',palette:'ember',arrangement:'bleed',method:'floyd',mark:'scan',
  params:{pixel:7,levels:3,ground:0,relief:2.4,light:-90,height:25,contrast:1.3,markSize:.8},
  items:[I('ridges',{x:.5,y:.55,size:1.6,aspect:.7,seed:4,detail:1}),I('glow',{x:.5,y:.2,size:.9,blend:'lighten',amount:.6})],
  note:'Lit ridges under a low sun, Floyd–Steinberg in three embers, drawn as scan lines.'},
 {id:'press',name:'Press dots',after:'new',palette:'newsprint',arrangement:'poster',method:'cluster',mark:'dot',
  params:{pixel:9,relief:1.2,gloss:.4,contrast:1.15,markSize:1.05,margin:.06,ambient:.15,light:-120,height:55,ground:.62,ramp:.3},title:'HALF/TONE',font:'anton',
  items:[I('sphere',{x:.42,y:.52,size:.8}),I('sphere',{x:.76,y:.3,size:.32}),I('ramp',{x:.5,y:.5,size:1.7,turn:-90,amount:.25,blend:'multiply'})],
  note:'Spheres as a clustered-dot halftone over a crisp headline, like a coarse newspaper screen.'},
 {id:'stitch',name:'Stitch star',after:'new',palette:'blueprint',arrangement:'frame',method:'bayer4',mark:'cross',
  params:{pixel:11,relief:1.8,contrast:1.3,markSize:.95,margin:.07},
  items:[I('star',{x:.5,y:.5,size:1.05,turn:-18}),I('rings',{x:.5,y:.5,size:1.7,amount:.25,blend:'multiply'})],
  note:'A lit star sewn in blue cross stitches on a 4×4 Bayer grid.'},
 {id:'static',name:'Static',after:'new',palette:'thermal',arrangement:'bleed',method:'white',mark:'pixel',
  params:{pixel:4,ground:.5,contrast:1.4,grain:.5},
  items:[I('cloud',{x:.5,y:.5,size:1.8,seed:6}),I('ramp',{x:.5,y:.5,size:1.8,turn:90,amount:.4,blend:'multiply'})],
  note:'Clouds through white-noise thresholds: television static.'},
 {id:'strata',name:'Strata',after:'new',palette:'signal',arrangement:'frame',method:'jarvis',mark:'pixel',
  params:{pixel:5,levels:3,relief:2,light:-60,contrast:1.4,grain:.15,margin:.09},
  items:[I('ridges',{x:.5,y:.5,size:1.5,aspect:.7,seed:11,detail:2}),I('stripes',{x:.5,y:.5,size:1.5,aspect:.7,turn:90,amount:.35,blend:'multiply',seed:2})],
  note:'Lit strata crossed by stripes in red and black, Jarvis–Judice–Ninke diffusion.'},
 {id:'block',name:'Block pyramid',after:'new',palette:'signal',arrangement:'bleed',method:'bayer2',mark:'pixel',
  params:{pixel:22,levels:3,ground:.5,ramp:-.5,relief:1.2,light:-120,contrast:1.2},
  items:[I('pyramid',{x:.5,y:.5,size:.95})],
  note:'One faceted pyramid in pixels a fiftieth of the page wide.'},
 {id:'ripple',name:'Ripple LED',after:'new',palette:'acid',arrangement:'bleed',method:'bayer8',mark:'led',
  params:{pixel:10,ground:0,relief:2.2,gloss:.6,contrast:1.4,markSize:.78},
  items:[I('ripple',{x:.5,y:.45,size:1.5,detail:1})],
  note:'A water drop lit in acid on black, an LED wall on an 8×8 Bayer grid.'},
 {id:'soft-type',name:'Soft type',after:'new',palette:'acid',arrangement:'bleed',method:'atkinson',mark:'pixel',
  params:{pixel:7,ground:0,relief:1.5,gloss:.5,spread:.1,contrast:1.3,order:.2,ambient:.3,grain:.1},
  items:[I('glow',{x:.5,y:.5,size:1.5,amount:.3}),I('copy',{x:.5,y:.5,size:.9,text:'BIT/CRUSH',font:'anton'})],
  note:'Copy softened and lit like a cushion, then dithered in acid on black.'},
 {id:'receipt',name:'Receipt',after:'new',palette:'thermal',arrangement:'poster',method:'floyd',mark:'pixel',
  params:{pixel:3.5,relief:1.6,gloss:.3,contrast:1.3,grain:.25,margin:.07},title:'PRINTED/HEAT',font:'mono',
  items:[I('sphere',{x:.5,y:.5,size:.75}),I('pillow',{x:.5,y:.5,size:1.4,amount:.3,blend:'multiply'})],
  note:'Fine thermal-printer dots under a mono headline.'},
 {id:'ultra',name:'Ultraviolet',after:'new',palette:'ultra',arrangement:'bleed',method:'stucki',mark:'pixel',
  params:{pixel:6,levels:4,ground:.05,relief:1.8,gloss:.4,contrast:1.2},
  items:[I('rings',{x:.5,y:.5,size:1.6,amount:.4,detail:-1}),I('blob',{x:.5,y:.48,size:.85,seed:14}),I('torus',{x:.5,y:.48,size:1.2,blend:'lighten',amount:.6})],
  note:'A blob in a torus over rings, four ultraviolet inks, Stucki diffusion.'},
 {id:'opart',name:'Op checks',after:'new',palette:'newsprint',arrangement:'bleed',method:'sierra',mark:'pixel',
  params:{pixel:8,contrast:1.6,relief:1.6},
  items:[I('checks',{x:.5,y:.5,size:1.8,seed:4}),I('sphere',{x:.5,y:.5,size:.9,blend:'difference'})],
  note:'Warped checks with a lit sphere subtracted from them, Sierra lite.'},
 {id:'shape-field',name:'Shape field',after:'new',palette:'ice',arrangement:'field',method:'bayer4',mark:'pixel',
  params:{pixel:7,levels:3,ground:0,relief:1.8,gloss:.5,cols:3},
  items:[I('sphere'),I('torus'),I('pyramid',{turn:45}),I('star'),I('pillow'),I('blob',{seed:3})],
  note:'Six volumes in a grid, one picture, three icy inks.'}
];
const FAMILY=Object.fromEntries(FAMILIES.map(f=>[f.id,f]));

// ---------------------------------------------------------------- state
const num=(v,c)=>{const x=Number(v);return Number.isFinite(x)?clamp(x,c.min,c.max):c.def;};
export function normalize(input={}){const f=FAMILY[input.family]||FAMILIES[0],pick=(k,list,d)=>list.includes(input[k])?input[k]:d;
 const params={...DEFAULTS,...f.params,...(input.params||{})};for(const c of CONTROLS)params[c.id]=num(params[c.id],c);params.levels=Math.round(params.levels);params.invert=params.invert>=.5?1:0;params.cols=Math.round(params.cols);
 const items=(Array.isArray(input.items)?input.items:f.items).slice(0,24).map(it=>{const o={...ITEM_DEF,...it};for(const c of ITEM_CONTROLS)o[c.id]=num(o[c.id],c);
  o.shape=SHAPES[o.shape]?o.shape:'sphere';o.blend=BLENDS[o.blend]?o.blend:'over';o.invert=!!o.invert;o.text=String(o.text??'').slice(0,60);o.font=FONTS[o.font]?o.font:'archivo';o.detail=Math.round(o.detail);o.seed=Math.round(o.seed);return o;});
 return {family:f.id,format:pick('format',OPTIONS.format,f.format||'a'),palette:pick('palette',OPTIONS.palette,f.palette),arrangement:pick('arrangement',OPTIONS.arrangement,f.arrangement),
  method:pick('method',OPTIONS.method,f.method),mark:pick('mark',OPTIONS.mark,f.mark),font:pick('font',OPTIONS.font,f.font||'archivo'),view:pick('view',OPTIONS.view,'dither'),
  title:String(input.title??f.title??'HEAVY/DITHER').slice(0,60),params,items};}

// ---------------------------------------------------------------- shape fields
// Local coordinates: radius 1 is half the item's size. Each returns [value, alpha]: a height for volumes, a brightness for fills.
const edge=(d,s)=>smooth(-s,s,d);
function blobBalls(seed,detail){const r=rng(seed*7919+13),n=clamp(5+detail,2,9),b=[];
 for(let k=0;k<n;k++){const a=r()*TAU,d=k?.18+r()*.32:0;b.push([Math.cos(a)*d,Math.sin(a)*d,.26+r()*.16]);}return b;}
const BALLS=new Map();
function field(it,u,v,s){const rho=Math.hypot(u,v),box=Math.max(Math.abs(u),Math.abs(v)),sd=it.seed*17.31,d=it.detail;
 switch(it.shape){
  case 'sphere':return [Math.sqrt(Math.max(0,1-rho*rho)),edge(1-rho,s)];
  case 'torus':{const q=rho-.6,r=.36;return [Math.sqrt(Math.max(0,1-(q/r)**2))*.7,edge(r-Math.abs(q),s)];}
  case 'pyramid':return [1-box,edge(1-box,s)];
  case 'star':{const n=clamp(5+d,3,9),f=((Math.atan2(v,u)/TAU*n+.25)%1+1)%1,tri=Math.abs(f*2-1),rr=mix(.42,1,tri**1.4),h=1-rho/rr;return [Math.max(0,h),edge(h*rr,s)];}
  case 'blob':{const key=it.seed+'|'+d;let b=BALLS.get(key);if(!b){b=blobBalls(it.seed,d);BALLS.set(key,b);}let F=0;for(const [x,y,r] of b)F+=r*r/((u-x)**2+(v-y)**2+1e-4);
   const e=1-1/Math.sqrt(F);return [Math.sqrt(clamp(e*1.6)),edge(e*.4,s)];}
  case 'pillow':{const p=Math.pow(u**4+v**4,.25);return [Math.sqrt(Math.max(0,1-p**5)),edge(1-p,s)];}
  case 'bumps':{const k=3+d;return [.5+.25*(Math.cos(u*k*Math.PI)+Math.cos(v*k*Math.PI)),edge(1-box,s)];}
  case 'ripple':{const k=4+d;return [(.5+.5*Math.cos(rho*k*TAU))*(1-rho)**1.2,edge(1-rho,s)];}
  case 'ridges':{const k=5+d;return [.5+.5*Math.sin((v+.32*fbm(u*1.3+sd,v*1.3))*k*Math.PI),edge(1-box,s)];}
  case 'swirl':{const sc=1.4*2**(d*.35),x=u*sc+sd,y=v*sc,qx=fbm(x,y),qy=fbm(x+5.2,y+1.3),w=fbm(x+3.6*qx,y+3.6*qy);return [clamp(.5+w*1.5),edge(1-box,s)];}
  case 'stripes':{const k=6+d,w=Math.sin((u+.42*fbm(u*.9+sd,v*2.1)+.12*v)*k*Math.PI)+.55*fbm(u*2.2,v*3.1+sd);return [smooth(-.28,.28,w),edge(1-box,s)];}
  case 'rings':{const k=6+d;return [.5+.5*Math.cos(rho*k*TAU),edge(1-rho,s)];}
  case 'burst':{const k=12+2*d;return [.5+.5*Math.cos(Math.atan2(v,u)*k),edge(1-rho,s)*(1-rho*.35)];}
  case 'glow':return [(1-Math.min(1,rho))**1.6,edge(1-rho,s)];
  case 'ramp':return [clamp((u+1)/2),edge(1-box,s)];
  case 'cloud':{const sc=1.8*2**(d*.35);return [clamp(.5+.85*fbm(u*sc+sd,v*sc,5)),edge(1-box,s)];}
  case 'checks':{const k=4+d,w=.28*fbm(u*1.2+sd,v*1.2);return [smooth(-.18,.18,Math.sin((u+w)*k*Math.PI)*Math.sin((v-w)*k*Math.PI)),edge(1-box,s)];}
  default:return [0,0];}}

// ---------------------------------------------------------------- type
// Glyph outlines are stored at 1000 units per em, y down, baseline 0; curves flatten to short segments.
export function glyphPolys(d,k,ox,oy){const out=[];let cur=null,x=0,y=0;const re=/([MLQCZ])([^MLQCZ]*)/g;let m;
 const P=(px,py)=>cur.push(ox+px*k,oy+py*k);
 while((m=re.exec(d))){const c=m[1],a=m[2].trim()?m[2].trim().split(/[\s,]+/).map(Number):[];
  if(c==='M'){if(cur&&cur.length>=6)out.push(cur);cur=[];x=a[0];y=a[1];P(x,y);}
  else if(c==='L'){x=a[0];y=a[1];P(x,y);}
  else if(c==='Q'){for(let t=1;t<=6;t++){const s=t/6,r=1-s;P(r*r*x+2*r*s*a[0]+s*s*a[2],r*r*y+2*r*s*a[1]+s*s*a[3]);}x=a[2];y=a[3];}
  else if(c==='C'){for(let t=1;t<=8;t++){const s=t/8,r=1-s;P(r*r*r*x+3*r*r*s*a[0]+3*r*s*s*a[2]+s*s*s*a[4],r*r*r*y+3*r*r*s*a[1]+3*r*s*s*a[3]+s*s*s*a[5]);}x=a[4];y=a[5];}
  else if(c==='Z'){if(cur&&cur.length>=6)out.push(cur);cur=null;}}
 if(cur&&cur.length>=6)out.push(cur);return out;}
// Sets copy (lines split at "/") so its widest line spans `width`, centred on (cx, cy). Returns polygons and the block size.
export function setType(text,fontId,cx,cy,width,{leading=1.18,maxHeight=Infinity}={}){const F=FONTS[fontId]||FONTS.archivo,lines=String(text).split('/').map(s=>s.trim()).filter(Boolean);
 if(!lines.length)return {polys:[],w:0,h:0,cap:0};
 const adv=ch=>(F.glyphs[ch]||F.glyphs[ch.toUpperCase()]||{adv:300}).adv,wid=l=>[...l].reduce((s,ch)=>s+adv(ch),0),maxW=Math.max(...lines.map(wid),1);
 let k=width/maxW;const pitch=F.capHeight*leading,blockH=l=>F.capHeight*k+(l-1)*pitch*k;if(blockH(lines.length)>maxHeight)k*=maxHeight/blockH(lines.length);
 const h=blockH(lines.length),top=cy-h/2,polys=[];
 lines.forEach((l,i)=>{let x=cx-wid(l)*k/2;const base=top+F.capHeight*k+i*pitch*k;for(const ch of l){const g=F.glyphs[ch]||F.glyphs[ch.toUpperCase()];if(g)polys.push(...glyphPolys(g.d,k,x,base));x+=adv(ch)*k;}});
 return {polys,w:maxW*k,h,cap:F.capHeight*k};}

// ---------------------------------------------------------------- picture
// A panel is a rectangle of the page with its own items, pixel size and method. Its tone is a brightness
// per cell (1 = paper), averaged over 2×2 samples where the grid is small enough.
function panelGrid(rect,P,aspect){const pw=P*aspect,cols=Math.max(1,Math.floor(rect.w/pw)),rows=Math.max(1,Math.floor(rect.h/P));
 return {cols,rows,pw,ph:P,ox:rect.x+(rect.w-cols*pw)/2,oy:rect.y+(rect.h-rows*P)/2};}
function lightVector(p){const a=p.light*DEG,e=p.height*DEG;return [Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e)];}
// A face turned straight up shades to .68 whatever the light's height, so volumes keep mid-tones to dither.
function shade(nx,ny,nz,L,p){const d=nx*L[0]+ny*L[1]+nz*L[2],spec=Math.max(0,2*d*nz-L[2]);return clamp(p.ambient+(1-p.ambient)*Math.max(0,d)*.68/Math.max(.25,L[2])+p.gloss*spec**28);}
function blendTone(B,b,a,mode){if(a<=0)return B;let t;
 switch(mode){case 'darken':t=Math.min(B,b);break;case 'lighten':t=Math.max(B,b);break;case 'multiply':t=B*b;break;case 'screen':t=1-(1-B)*(1-b);break;case 'difference':t=Math.abs(B-b);break;default:t=b;}
 return B+(t-B)*a;}
function tone(state,rect,items,G,draft){const p=state.params,{cols,rows,pw,ph,ox,oy}=G,M=Math.min(rect.w,rect.h),L=lightVector(p),out=new Float32Array(cols*rows);
 // Drafts (while a slider moves) take one sample per cell.
 const ss=!draft&&cols*rows<45000&&ph>=4?2:1,eps=.012;
 // Copy is rasterized once per panel: coverage, softened by the copy softness, lit by its own gradient.
 const prepared=items.map(it=>{const R=it.size*M/2,ca=Math.cos(-it.turn*DEG),sa=Math.sin(-it.turn*DEG),cx=rect.x+it.x*rect.w,cy=rect.y+it.y*rect.h;
  const Ll=[L[0]*ca-L[1]*sa,L[0]*sa+L[1]*ca,L[2]],o={it,R,ca,sa,cx,cy,Ll,kind:SHAPES[it.shape].kind,soft:Math.max(.004,p.soft)};
  if(o.kind==='copy'){const t=setType(it.text,it.font,0,0,2*R);const polys=t.polys.map(q=>{const r=new Array(q.length);for(let i=0;i<q.length;i+=2){const x=q[i]*it.aspect,y=q[i+1];r[i]=cx+x*Math.cos(it.turn*DEG)-y*Math.sin(it.turn*DEG);r[i+1]=cy+x*Math.sin(it.turn*DEG)+y*Math.cos(it.turn*DEG);}return r;});
   const rad=p.spread*t.cap/ph/2,cov=blur(coverage(polys,cols,rows,{x0:ox,y0:oy,pw,ph}),cols,rows,rad);let peak=0;for(const c of cov)if(c>peak)peak=c;
   const sh=new Float32Array(cov.length),at=(i,j)=>cov[clamp(j,0,rows-1)*cols+clamp(i,0,cols-1)]/(peak||1),g=p.relief*(2*Math.round(rad)+1)/2;
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i;if(!cov[k])continue;const nx=-(at(i+1,j)-at(i-1,j))*g,ny=-(at(i,j+1)-at(i,j-1))*g,n=Math.hypot(nx,ny,1);sh[k]=shade(nx/n,ny/n,1/n,L,p);}
   o.cov=cov;o.peak=peak||1;o.sh=sh;}
  return o;});
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){let acc=0;
  for(let sy=0;sy<ss;sy++)for(let sx=0;sx<ss;sx++){const x=ox+(i+(sx+.5)/ss)*pw,y=oy+(j+(sy+.5)/ss)*ph;
   let B=clamp(p.ground+p.ramp*((y-rect.y)/rect.h-.5));
   for(const o of prepared){const it=o.it;let b,a;
    if(o.kind==='copy'){const k=j*cols+i;a=smooth(.12,.55,o.cov[k]/o.peak);if(a<=0)continue;b=o.sh[k];}
    else{const dx=(x-o.cx)/o.R,dy=(y-o.cy)/o.R,u=(dx*o.ca-dy*o.sa)/it.aspect,v=dx*o.sa+dy*o.ca;
     if(Math.abs(u)>1.6||Math.abs(v)>1.6)continue;const f=field(it,u,v,o.soft);a=f[1];if(a<=0)continue;
     if(o.kind==='height'){const hx=(field(it,u+eps,v,o.soft)[0]-field(it,u-eps,v,o.soft)[0])/(2*eps),hy=(field(it,u,v+eps,o.soft)[0]-field(it,u,v-eps,o.soft)[0])/(2*eps);
      const nx=-hx*p.relief*.5,ny=-hy*p.relief*.5,n=Math.hypot(nx,ny,1);b=shade(nx/n,ny/n,1/n,o.Ll,p);}
     else b=f[0];}
    if(it.invert)b=1-b;B=blendTone(B,b,a*it.amount,it.blend);}
   acc+=B;}
  let B=acc/(ss*ss)+p.brightness;B=clamp((B-.5)*p.contrast+.5);B=B**p.gamma;
  if(p.grain){const gx=i0g(ox,i,pw),gy=i0g(oy,j,ph);B+=p.grain*((hash(gx,gy,p.seed)-.5)*.5+fbm(gx*.21,gy*.21+p.seed,2)*.45);}
  if(p.invert)B=1-B;out[j*cols+i]=clamp(B);}
 return out;}
// Grain is keyed by the page pixel, so it holds still as panels are resized.
const i0g=(o,i,P)=>Math.round(o/P)+i;

// ---------------------------------------------------------------- marks
const f2=v=>{const r=Math.round(v*100)/100;return Object.is(r,-0)?'0':String(r);};
// Text-mode glyphs, 3 × 5, from light to dense; Ascii picks one by the cell's strength.
const ASCII=['...........#...','....#.....#....','......###......','....#..###..#..','...###...###...','#.#..#..#..##.#','#.#.#.###.#.#.#','#.####.####.#.#','#####.###.#####'].map(s=>[...s].map(c=>c==='#'));
// Halftone and Ascii are screens, not dithers: they read each cell's strength (its distance from the page tone,
// 0 to 1) rather than its dithered level. screenLevels gives every cell that has any tone a level that is not the page.
export const SCREENS=new Set(['halftone','ascii']);
export function screenLevels(q,strength,pageLevel,n){const out=new Uint8Array(q.length),near=pageLevel===0?1:n-2;
 for(let k=0;k<q.length;k++)out[k]=strength[k]<.04?pageLevel:q[k]===pageLevel?near:q[k];return out;}
// One path of marks for every cell at `level`. `strength` (optional) sizes halftone dots, picks Ascii glyphs and
// crosses dense hatching; without it every marked cell counts as full strength.
export function markPath(q,level,G,mark,size,strength){const {cols,rows,pw,ph,ox,oy}=G,s=Math.min(pw,ph),odd=Math.round(oy/ph);let d='';
 for(let j=0;j<rows;j++){const y=oy+j*ph,row=j*cols;
  if(mark==='pixel'||mark==='scan'){const t=mark==='scan'?ph*clamp(size*.62,.1,1):ph,ya=y+(ph-t)/2;
   for(let i=0;i<cols;){if(q[row+i]!==level){i++;continue;}let e=i;while(e<cols&&q[row+e]===level)e++;d+=`M${f2(ox+i*pw)} ${f2(ya)}h${f2((e-i)*pw)}v${f2(t)}h${f2(-(e-i)*pw)}z`;i=e;}continue;}
  for(let i=0;i<cols;i++){if(q[row+i]!==level)continue;const cx=ox+(i+.5)*pw,cy=y+ph/2,x0=ox+i*pw,x1=x0+pw,y1=y+ph,st=strength?strength[row+i]:1;
   if(mark==='dot'){const r=s/2*size;d+=`M${f2(cx-r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2*r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2*r)} 0z`;}
   else if(mark==='led'){const a=s*size*.5;d+=`M${f2(cx-a)} ${f2(cy-a)}h${f2(2*a)}v${f2(2*a)}h${f2(-2*a)}z`;}
   else if(mark==='diamond'){const a=s*size*.62;d+=`M${f2(cx)} ${f2(cy-a)}l${f2(a)} ${f2(a)}l${f2(-a)} ${f2(a)}l${f2(-a)} ${f2(-a)}z`;}
   else if(mark==='halftone'){const r=s*.72*size*Math.sqrt(clamp(st));if(r>.15)d+=`M${f2(cx-r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2*r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2*r)} 0z`;}
   else if(mark==='ascii'){const g=ASCII[Math.min(ASCII.length-1,Math.floor(clamp(st)*ASCII.length))],cw=pw*.78*size/3,chh=ph*.86*size/5,gx=cx-1.5*cw,gy=cy-2.5*chh;
    for(let r=0;r<5;r++)for(let c=0;c<3;){if(!g[r*3+c]){c++;continue;}let e=c;while(e<3&&g[r*3+e])e++;d+=`M${f2(gx+c*cw)} ${f2(gy+r*chh)}h${f2((e-c)*cw)}v${f2(chh)}h${f2(-(e-c)*cw)}z`;c=e;}}
   else if(mark==='hatch'){// Slashes run corner to corner, so neighbours along a diagonal join into one stroke; dense cells cross.
    const t=pw*clamp(size*.42,.08,.9);d+=`M${f2(x0)} ${f2(y1)}h${f2(t)}L${f2(x1)} ${f2(y)}h${f2(-t)}z`;if(st>.62)d+=`M${f2(x0)} ${f2(y)}h${f2(t)}L${f2(x1)} ${f2(y1)}h${f2(-t)}z`;}
   else if(mark==='rings'){const r=s/2*size,ri=r*.5;d+=`M${f2(cx-r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2*r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2*r)} 0zM${f2(cx-ri)} ${f2(cy)}a${f2(ri)} ${f2(ri)} 0 1 1 ${f2(2*ri)} 0a${f2(ri)} ${f2(ri)} 0 1 1 ${f2(-2*ri)} 0z`;}
   else if(mark==='knit'){// A knitted V: two legs leaning in to meet at the foot of the cell.
    const w=pw*clamp(size,.4,1.3),l=cx-w/2,r=cx+w/2,ya=y+ph*.04,yb=y1-ph*.04;d+=`M${f2(l)} ${f2(ya)}L${f2(l+w*.4)} ${f2(ya)}L${f2(cx+w*.07)} ${f2(yb)}L${f2(cx-w*.1)} ${f2(yb)}zM${f2(r)} ${f2(ya)}L${f2(r-w*.4)} ${f2(ya)}L${f2(cx-w*.07)} ${f2(yb)}L${f2(cx+w*.1)} ${f2(yb)}z`;}
   else if(mark==='tiles'){const a=s*size*.5,k=a*.32,e=2*a-2*k;d+=`M${f2(cx-a+k)} ${f2(cy-a)}h${f2(e)}a${f2(k)} ${f2(k)} 0 0 1 ${f2(k)} ${f2(k)}v${f2(e)}a${f2(k)} ${f2(k)} 0 0 1 ${f2(-k)} ${f2(k)}h${f2(-e)}a${f2(k)} ${f2(k)} 0 0 1 ${f2(-k)} ${f2(-k)}v${f2(-e)}a${f2(k)} ${f2(k)} 0 0 1 ${f2(k)} ${f2(-k)}z`;}
   else if(mark==='bricks'){// Every other row of the page slides half a brick.
    const bw=pw*clamp(size,.4,1.1)*.94,bh=ph*.8,sx=(j+odd)%2?pw/2:0;d+=`M${f2(cx+sx-bw/2)} ${f2(cy-bh/2)}h${f2(bw)}v${f2(bh)}h${f2(-bw)}z`;}
   else if(mark==='triangles'){const a=s*size*.5,up=(i+j+odd+Math.round(ox/pw))%2===0;d+=up?`M${f2(cx-a)} ${f2(cy+a)}h${f2(2*a)}L${f2(cx)} ${f2(cy-a)}z`:`M${f2(cx-a)} ${f2(cy-a)}h${f2(2*a)}L${f2(cx)} ${f2(cy+a)}z`;}
   else{const a=s*size*.5,t=a*.36;d+=`M${f2(cx-t)} ${f2(cy-a)}h${f2(2*t)}v${f2(a-t)}h${f2(a-t)}v${f2(2*t)}h${f2(t-a)}v${f2(a-t)}h${f2(-2*t)}v${f2(t-a)}h${f2(t-a)}v${f2(-2*t)}h${f2(a-t)}z`;}}}
 return d;}
const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export const mixHex=(a,b,t)=>{const A=hexRGB(a),B=hexRGB(b);return '#'+A.map((x,i)=>Math.round(mix(x,B[i],t)).toString(16).padStart(2,'0')).join('');};
// The palette sampled at n inks, light to dark, as a ramp through its stops.
export function inks(palette,n){const c=PALETTES[palette].colors;if(c.length===n)return [...c];
 return Array.from({length:n},(_,k)=>{const t=k/(n-1)*(c.length-1),a=Math.floor(t);return a>=c.length-1?c[c.length-1]:mixHex(c[a],c[a+1],t-a);});}

// ---------------------------------------------------------------- arrangements
// Each arrangement lays out panels (picture rectangles with their items, pixel and method) and crisp ornaments.
function layout(s,W,H){const p=s.params,M=Math.min(W,H),m=p.margin*M,panels=[],orn={rects:[],type:[]},base={P:p.pixel,method:s.method};
 // Tiles take the column count that makes them largest; each square tile has a label below it.
 const grid=(n,x,y,w,h,gap,lab)=>{let best=1,size=0;for(let k=1;k<=n;k++){const r=Math.ceil(n/k),c=Math.min((w-gap*(k-1))/k,(h-gap*(r-1))/r-lab);if(c>size){size=c;best=k;}}
  const cols=best,rows=Math.ceil(n/cols),cw=(w-gap*(cols-1))/cols,ch=(h-gap*(rows-1))/rows-lab,c=Math.min(cw,ch);
  return Array.from({length:n},(_,k)=>{const col=k%cols,row=Math.floor(k/cols);return {x:x+col*(cw+gap)+(cw-c)/2,y:y+row*(ch+lab+gap)+(ch-c)/2,w:c,h:c,label:{x:x+col*(cw+gap)+cw/2,y:y+row*(ch+lab+gap)+(ch+c)/2+lab*.62,h:lab*.42,w:c}};});};
 switch(s.arrangement){
  case 'frame':{const t=Math.max(2,M*.011),g=M*.018,r={x:m,y:m,w:W-2*m,h:H-2*m};orn.rects.push({...r,t});panels.push({rect:{x:r.x+t+g,y:r.y+t+g,w:r.w-2*(t+g),h:r.h-2*(t+g)},items:s.items,...base});break;}
  case 'poster':{const band=H*.26,r={x:0,y:0,w:W,h:H-band};panels.push({rect:r,items:s.items,...base});orn.type.push({text:s.title,font:s.font,x:W/2,y:H-band/2,w:W-2*Math.max(m,M*.04),h:band*.78});break;}
  case 'field':{const cols=p.cols,rows=Math.max(1,Math.round(cols*H/W)),items=[];
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const it=s.items[(r*cols+c)%Math.max(1,s.items.length)];if(!it)continue;items.push({...it,x:(c+.5)/cols,y:(r+.5)/rows,size:Math.min(W/cols,H/rows)/M*.86*clamp(it.size/.7,.4,1.4)});}
   panels.push({rect:{x:0,y:0,w:W,h:H},items,...base});break;}
  case 'atlas':{const cells=grid(SHAPE_IDS.length,m,m,W-2*m,H-2*m,M*.02,M*.045),proto=s.items[0]||ITEM_DEF;
   SHAPE_IDS.forEach((id,k)=>{const own=s.items.find(it=>it.shape===id)||{};panels.push({rect:cells[k],items:[{...proto,...own,shape:id,x:.5,y:.5,size:own.shape?Math.min(own.size,1.2):SHAPES[id].group==='Fills'?1.9:.86,turn:own.turn||0,aspect:own.aspect||1,blend:'over',amount:1,text:own.text||'AB',font:own.font||s.font}],...base,P:Math.max(2,p.pixel*.5)});
    orn.type.push({text:SHAPES[id].name.toUpperCase(),font:'mono',...cells[k].label});});break;}
  case 'specimen':{const ids=Object.keys(METHODS),cells=grid(ids.length,m,m,W-2*m,H-2*m,M*.02,M*.045);
   ids.forEach((id,k)=>{panels.push({rect:cells[k],items:s.items,...base,P:Math.max(2,p.pixel*.6),method:id});orn.type.push({text:METHODS[id].name.toUpperCase().replaceAll('×','X'),font:'mono',...cells[k].label});});break;}
  case 'steps':{const n=4,h=H/n;for(let k=0;k<n;k++)panels.push({rect:{x:0,y:k*h,w:W,h},items:s.items.map(it=>({...it,y:(it.y*H-k*h)/h,size:it.size*M/Math.min(W,h)})),...base,P:Math.max(2,p.pixel*[1,.62,.38,.24][k])});break;}
  default:panels.push({rect:{x:0,y:0,w:W,h:H},items:s.items,...base});}
 return {panels,orn};}

// ---------------------------------------------------------------- render
export function render(input,{view,draft=false}={}){const s=normalize(input),{w:W,h:H}=FORMATS[s.format],p=s.params,v=view||s.view,n=p.levels,colors=inks(s.palette,n);
 const pal=PALETTES[s.palette],page=pal.page==='dark'?colors[n-1]:colors[0],pageLevel=pal.page==='dark'?n-1:0,ornament=pal.page==='dark'?colors[0]:colors[n-1];
 const {panels,orn}=layout(s,W,H),counts=new Array(n).fill(0);let body='',cells=0;
 for(const pn of panels){const G=panelGrid(pn.rect,pn.P,p.aspect),B=tone(s,pn.rect,pn.items,G,draft);cells+=G.cols*G.rows;
  if(v==='tone'){// Brightness in 24 steps, drawn as runs in the palette's ramp from its darkest to its lightest ink.
   const steps=24,q=new Uint8Array(B.length);for(let k=0;k<B.length;k++)q[k]=Math.round((1-B[k])*(steps-1));
   for(let l=0;l<steps;l++){const d=markPath(q,l,G,'pixel',1);if(d){const t=l/(steps-1)*(colors.length-1),a=Math.floor(t);body+=`<path fill="${a>=colors.length-1?colors[colors.length-1]:mixHex(colors[a],colors[a+1],t-a)}" d="${d}"/>`;}}continue;}
  const ink=new Float32Array(B.length);for(let k=0;k<B.length;k++)ink[k]=1-B[k];
  const strength=pageLevel?ink.map(v=>1-v):ink,dq=dither(ink,G.cols,G.rows,{method:pn.method,levels:n,order:p.order,seed:p.seed}),q=SCREENS.has(s.mark)?screenLevels(dq,strength,pageLevel,n):dq;for(const l of q)counts[l]++;
  // Cells at the page's own level stay page; every other level is drawn, and marks that do not fill their cell show the page between them.
  for(let l=0;l<n;l++){if(l===pageLevel)continue;const d=markPath(q,l,G,s.mark,p.markSize,strength);if(d)body+=`<path fill="${colors[l]}" d="${d}"/>`;}}
 let ornD='';for(const r of orn.rects){const t=r.t;ornD+=`M${f2(r.x)} ${f2(r.y)}h${f2(r.w)}v${f2(r.h)}h${f2(-r.w)}zM${f2(r.x+t)} ${f2(r.y+t)}v${f2(r.h-2*t)}h${f2(r.w-2*t)}v${f2(-(r.h-2*t))}z`;}
 for(const t of orn.type){const set=setType(t.text,t.font,t.x,t.y,t.w,{maxHeight:t.h,leading:1.12});for(const q of set.polys){ornD+='M'+f2(q[0])+' '+f2(q[1]);for(let i=2;i<q.length;i+=2)ornD+='L'+f2(q[i])+' '+f2(q[i+1]);ornD+='z';}}
 if(ornD)body+=`<path fill="${ornament}" d="${ornD}"/>`;
 const fam=FAMILY[s.family],title=`${fam.name} — heavy dither`,desc=`${ARRANGEMENTS[s.arrangement]}; ${s.items.map(it=>SHAPES[it.shape].name).join(', ')}; ${METHODS[s.method].name}, ${n} inks, ${MARKS[s.mark].toLowerCase()} of ${p.pixel} units.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${desc}"><title>${title}</title><desc>${desc}</desc><rect width="${W}" height="${H}" fill="${page}"/>${body}</svg>`;
 return {svg,state:s,width:W,height:H,stats:{panels:panels.length,cells,counts,inks:colors,page}};}
// Surprise: 2–4 random shapes, a random method, mark and palette, from a seed.
export function surprise(seed=1){const r=rng(seed*2654435761>>>0||5),pick=a=>a[Math.floor(r()*a.length)],shapes=SHAPE_IDS.filter(x=>x!=='copy');
 const n=2+Math.floor(r()*3),items=Array.from({length:n},(_,k)=>({shape:pick(shapes),x:.3+r()*.4,y:.3+r()*.4,size:k?.35+r()*.6:1+r()*.8,turn:Math.round((r()-.5)*90),blend:k?pick(['over','darken','lighten','multiply','difference']):'over',seed:1+Math.floor(r()*98),detail:Math.floor(r()*3)-1}));
 return normalize({family:pick(FAMILIES).id,palette:pick(OPTIONS.palette),method:pick(OPTIONS.method),mark:r()<.6?'pixel':pick(OPTIONS.mark),arrangement:pick(['bleed','frame','bleed','poster']),
  params:{pixel:4+Math.round(r()*14),levels:2+Math.floor(r()*3),light:Math.round((r()-.5)*360),order:r()<.5?0:r()*.6,grain:r()*.4,ground:r()<.5?0:1},items});}
