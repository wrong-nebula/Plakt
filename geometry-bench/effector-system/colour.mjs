// Colour modifiers change colour and transparency only, never outlines. Each reads its field, a gradient (linear,
// radial, ring) or a box or noise, either as a mask (how much it acts) or as a ramp position (which colour of a
// ramp lands where). They act on any element, on the paper or on the whole poster, after every effector and
// modifier, in their order.
//
// Shapes keep vector paint. Where every field varies along one axis (parallel linear fields) or one distance
// (radial and ring fields round one centre), each draw operation gets one real gradient sampled along it, with
// hard stops where the colour jumps (stepped fields, Posterize). Otherwise each shape gets its own gradient along the
// field that changes most across it, and large shapes split into cells only where one gradient would be wrong.
// This module does not import the engine; the engine passes in its field and polygon helpers.

const R=(id,name,min,max,step,def,unit='')=>({id,name,type:'range',min,max,step,def,unit});
const S=(id,name,options,def)=>({id,name,type:'select',options,def});
const T=(id,name,def=false)=>({id,name,type:'toggle',def});
const C=(id,name,def)=>({id,name,type:'colour',def});
const clamp01=v=>v<0?0:v>1?1:v,lerp=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2,DEG=Math.PI/180;
// A seeded value in [0, 1) for Aurora's blobs.
const h01=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x);};

// A colour value names a palette role, white or black, or is a hex colour.
export const COLOUR_NAMES=[['paper','Paper'],['ink','Ink'],['accent','Accent'],['white','White'],['black','Black']];
const NAMED=new Set(COLOUR_NAMES.map(c=>c[0]));
export const isColourValue=v=>typeof v==='string'&&(NAMED.has(v)||/^#[0-9a-f]{6}$/i.test(v));
export function colourHex(v,colors){const k=['paper','ink','accent'].indexOf(v);return k>=0?colors[k]:v==='white'?'#ffffff':v==='black'?'#000000':isColourValue(v)?v.toLowerCase():'#ff00ff';}
const rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
const hex=c=>'#'+[0,1,2].map(i=>Math.round(clamp01(c[i])*255).toString(16).padStart(2,'0')).join('');

// Ramps run dark to light, so a gradient map keeps each colour's lightness order. Palette and Duotone follow the
// poster's own colours; Holo loops back to its first colour.
export const RAMPS={
 palette:{name:'Palette'},
 duotone:{name:'Duotone: dark to accent'},
 thermal:{name:'Thermal',stops:['#000004','#320a5e','#781c6d','#bc3754','#ed6925','#fbb61a','#fcffa4']},
 acid:{name:'Acid',stops:['#07070a','#2a0b5c','#ff2bd6','#3df5ff','#d7ff3a']},
 sunset:{name:'Sunset',stops:['#140c2c','#5b1a6e','#c2245f','#ff6a3d','#ffc66d','#fff3d6']},
 chrome:{name:'Chrome',stops:['#0a0b0e','#3c4250','#c9d0db','#ffffff','#6b7484','#e9edf3','#ffffff']},
 ice:{name:'Ice',stops:['#020a2b','#0a3d91','#2fb4ff','#bff6ff','#ffffff']},
 toxic:{name:'Toxic',stops:['#05140a','#0f5d2c','#3cff6e','#e8ff3a']},
 holo:{name:'Holo',stops:['#ff2bd6','#8a5cff','#3df5ff','#5dff7a','#ffe83d','#ff2bd6']},
 fire:{name:'Fire',stops:['#000000','#3b0a00','#a31500','#ff4d00','#ff9a00','#ffe14d','#ffffff']},
 infrared:{name:'Infrared',stops:['#000033','#3b00a0','#c4007a','#ff4f3b','#ffd23f','#ffffff']},
 night:{name:'Night vision',stops:['#000000','#002b10','#00a33c','#3dff7a','#e6ffe9']},
 blueprint:{name:'Blueprint',stops:['#06204f','#0d3f99','#3f78d1','#bcd6ff','#ffffff']},
 vapor:{name:'Vapor',stops:['#1a0033','#5b13b8','#ff2bd6','#ff9ad1','#3df5ff']}
};
const RAMP_OPTIONS=Object.entries(RAMPS).map(([k,r])=>[k,r.name]);
export const BLENDS=[['normal','Normal'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],['colour','Colour (keeps lightness)']];
const SPEED=R('cycles','Speed',0,4,1,0,'per loop');
const ALL={shape:'all',follow:false},SPOT={shape:'radial',radius:.4,softness:1,follow:true};
// uses: 'mask' scales the effect by the field; 'ramp' reads the field as the position along the ramp, so a linear
// field paints a linear gradient and a radial field a radial one, and strength sets its opacity.
export const COLOURS={
 tint:{name:'Tint',uses:'mask',about:'Washes towards one colour where the field is strong.',params:[C('color','Colour','accent'),S('blend','Blend',BLENDS,'normal')],field:SPOT},
 gradient:{name:'Gradient',uses:'ramp',about:'Lays a colour ramp across the field: a linear field gives a linear gradient, a radial or ring field a radial one.',
  params:[S('ramp','Ramp',[['colours','Two colours'],...RAMP_OPTIONS],'holo'),C('from','From','ink'),C('to','To','accent'),T('reverse','Reverse'),S('blend','Blend',BLENDS,'normal')],field:{shape:'linear',angle:90,radius:1.4,softness:1,follow:false}},
 map:{name:'Gradient map',uses:'mask',about:'Maps each colour’s lightness onto a ramp: duotones, heat maps, chrome.',params:[S('ramp','Ramp',[...RAMP_OPTIONS,['colours','Two colours']],'duotone'),C('from','Darks','black'),C('to','Lights','accent'),T('reverse','Reverse')],field:ALL},
 spectrum:{name:'Spectrum',uses:'ramp',about:'Runs the rainbow across the field, like foil or oil on water.',
  params:[R('bands','Bands',.25,6,.05,1),R('offset','Start hue',0,360,1,0,'°'),R('saturation','Saturation',0,1,.01,.9),S('mode','Lightness',[['paint','Full colour'],['keep','Keeps each colour’s']],'paint'),SPEED],field:{shape:'linear',angle:45,radius:1.4,softness:1,follow:false}},
 hue:{name:'Hue shift',uses:'mask',about:'Turns hues round the colour wheel.',params:[R('angle','Turn',-180,180,1,120,'°'),SPEED],field:SPOT},
 saturation:{name:'Saturation',uses:'mask',about:'Drains colour to grey, or pushes it louder.',params:[R('amount','Amount',-1,1,.01,-1)],field:SPOT},
 light:{name:'Light',uses:'mask',about:'Lightens or darkens and sets contrast: glows, vignettes, shading.',params:[R('brightness','Brightness',-1,1,.01,.45),R('contrast','Contrast',0,3,.01,1)],field:{...SPOT,radius:.35}},
 invert:{name:'Invert',uses:'mask',about:'Turns colours to their negative; Lightness only keeps each hue.',params:[S('mode','Invert',[['rgb','Colour'],['lightness','Lightness only']],'rgb')],field:{...SPOT,radius:.3,softness:.1}},
 fade:{name:'Fade',uses:'mask',about:'Fades out, to transparent or into the paper.',params:[R('amount','Amount',0,1,.01,1),S('into','Into',[['clear','Transparent'],['paper','The paper']],'clear')],field:{shape:'linear',angle:90,radius:.7,softness:1,follow:false}},
 posterize:{name:'Posterize',uses:'mask',about:'Snaps colours to a few levels, so smooth gradients print as bands.',params:[R('levels','Levels',2,16,1,5)],field:ALL},
 // The second set.
 stripes:{name:'Stripes',uses:'ramp',about:'Bands that follow the field: straight stripes, target rings, contour lines on noise; they can travel over the loop.',
  params:[R('count','Bands',1,40,1,8),R('width','Band width',.05,.95,.01,.5),R('offset','Offset',0,1,.01,0),S('mode','Bands',[['colour','Colour'],['invert','Invert'],['clear','Transparent'],['paper','Paper']],'invert'),C('color','Colour','accent'),SPEED],
  field:{shape:'radial',radius:.6,softness:1,follow:true}},
 threshold:{name:'Threshold',uses:'ramp',about:'Splits colours into a dark and a light one by lightness; the field moves the level, so a linear field wipes across shapes.',
  params:[R('level','Level',0,1,.01,.5),R('spread','Field moves it',-1,1,.01,.9),C('dark','Dark','black'),C('light','Light','accent')],field:{shape:'linear',angle:0,radius:1.2,softness:1,follow:false}},
 solarize:{name:'Solarize',uses:'mask',about:'Turns only the lightest colours to their negative, like a darkroom solarization.',params:[R('level','Level',.05,.95,.01,.5),S('mode','On',[['rgb','Each channel'],['lightness','Lightness only']],'rgb')],field:{...SPOT,radius:.45}},
 swap:{name:'Channel swap',uses:'mask',about:'Swaps the red, green and blue channels: instant other-worldly colourways.',params:[S('order','Order',[['gbr','Green, blue, red'],['brg','Blue, red, green'],['rbg','Red, blue, green'],['bgr','Blue, green, red'],['grb','Green, red, blue']],'gbr')],field:SPOT},
 splittone:{name:'Split tone',uses:'mask',about:'Tints the darks one colour and the lights another, keeping lightness, as in a toned print.',params:[C('shadows','Darks','#2a0b5c'),C('highlights','Lights','accent'),R('balance','Balance',-1,1,.01,0)],field:ALL},
 palette:{name:'Palette snap',uses:'mask',about:'Snaps every colour to the nearest of the palette or a ramp, and can rotate or swap the palette’s roles.',
  params:[S('to','Snap to',[['palette','Palette'],...RAMP_OPTIONS.filter(o=>RAMPS[o[0]].stops)],'palette'),S('roles','Roles',[['keep','Keep'],['rotate','Rotate'],['inkpaper','Swap ink and paper'],['inkaccent','Swap ink and accent']],'keep')],field:ALL},
 warmth:{name:'Warmth',uses:'mask',about:'Warms colours towards orange or cools them towards blue, keeping lightness.',params:[R('amount','Amount',-1,1,.01,.6)],field:{shape:'linear',angle:90,radius:1.2,softness:1,follow:false}},
 separation:{name:'Separation',uses:'mask',about:'Shows one print plate: how much cyan, magenta, yellow or black each colour holds, in process or fluorescent ink on white.',
  params:[S('plate','Plate',[['c','Cyan'],['m','Magenta'],['y','Yellow'],['k','Black']],'m'),S('ink','Ink',[['process','Process'],['fluo','Fluorescent (Riso)']],'fluo')],field:ALL},
 // The third set.
 shapegradient:{name:'Shape gradient',uses:'mask',about:'A ramp across each shape on its own, not the page: every letter gets its own sunset or chrome.',
  params:[S('ramp','Ramp',[['colours','Two colours'],...RAMP_OPTIONS],'sunset'),C('from','From','accent'),C('to','To','ink'),R('angle','Direction',-180,180,1,90,'°'),T('reverse','Reverse'),S('blend','Blend',BLENDS,'normal')],field:ALL},
 shapecolour:{name:'Shape colour',uses:'ramp',about:'Each shape takes one solid colour from the ramp, wherever the field puts its centre: rainbow letters, colour-coded dots.',
  params:[S('ramp','Ramp',[['colours','Two colours'],...RAMP_OPTIONS],'holo'),C('from','From','ink'),C('to','To','accent'),T('reverse','Reverse'),S('blend','Blend',BLENDS,'normal')],field:{shape:'linear',angle:0,radius:1.2,softness:1,follow:false}},
 aurora:{name:'Aurora',uses:'mask',about:'Soft blobs of colour from a ramp, drifting over the loop and melting into each other, like a mesh gradient.',
  params:[S('ramp','Ramp',RAMP_OPTIONS,'vapor'),R('blobs','Blobs',2,7,1,4),R('size','Size',.08,.8,.01,.3),S('blend','Blend',BLENDS,'normal'),R('cycles','Drift',0,4,1,1,'per loop')],field:ALL},
 corners:{name:'Four corners',uses:'mask',about:'A colour at each corner of the page, blended across it: a four-point mesh gradient.',
  params:[C('tl','Top left','#ff2bd6'),C('tr','Top right','accent'),C('bl','Bottom left','#3df5ff'),C('br','Bottom right','#2a0b5c')],field:ALL},
 pop:{name:'Pop',uses:'mask',about:'Snaps hues to a few vivid steps, pushes saturation and flattens lightness into levels, like a screenprinted portrait.',
  params:[R('hues','Hues',2,12,1,6),R('offset','Hue offset',0,359,1,0,'°'),R('boost','Saturation boost',0,1,.01,.8),R('levels','Lightness levels',0,6,1,3)],field:ALL}
};
// Besides one element or all of them, a colour modifier can act on the paper, or on the paper and every element.
export const COLOUR_TARGETS=[['all','All elements'],['paper','Paper'],['page','Paper and elements']];
export const MAX_COLOURS=8;

// ---------------------------------------------------------------- colour maths (sRGB, 0 to 1)
// Blend lightness and Colour mode follow the W3C compositing definitions.
const lum=c=>.3*c[0]+.59*c[1]+.11*c[2];
function clipColour(c){const l=lum(c),n=Math.min(c[0],c[1],c[2]),x=Math.max(c[0],c[1],c[2]);let r=c;
 if(n<0)r=r.map(v=>l+(v-l)*l/Math.max(l-n,1e-9));if(x>1)r=r.map(v=>l+(v-l)*(1-l)/Math.max(x-l,1e-9));return r;}
const setLum=(c,l)=>{const d=l-lum(c);return clipColour([c[0]+d,c[1]+d,c[2]+d]);};
function toHSL([r,g,b]){const x=Math.max(r,g,b),n=Math.min(r,g,b),l=(x+n)/2,d=x-n;if(d<1e-9)return [0,0,l];
 const s=d/(1-Math.abs(2*l-1)),h=x===r?((g-b)/d+6)%6:x===g?(b-r)/d+2:(r-g)/d+4;return [h*60,s,l];}
function fromHSL(h,s,l){h=((h%360)+360)%360;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
 const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return [r+m,g+m,b+m];}
function blend(b,s,mode){switch(mode){
 case 'multiply':return b.map((v,i)=>v*s[i]);
 case 'screen':return b.map((v,i)=>1-(1-v)*(1-s[i]));
 case 'overlay':return b.map((v,i)=>v<.5?2*v*s[i]:1-2*(1-v)*(1-s[i]));
 case 'colour':return setLum(s,lum(b));
 default:return s;}}
const mixRGB=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
function rampOf(id,colors){const r=RAMPS[id];if(r?.stops)return r.stops.map(rgb);
 const pal=colors.map(rgb).sort((a,b)=>lum(a)-lum(b));
 return id==='duotone'?[lum(rgb(colors[0]))<lum(rgb(colors[1]))?rgb(colors[0]):rgb(colors[1]),rgb(colors[2])]:pal;}
function rampAt(stops,t){const n=stops.length-1,x=clamp01(t)*n,i=Math.min(n-1,Math.floor(x));return mixRGB(stops[i],stops[i+1],x-i);}

// One prepared step per colour modifier: its field and a function from (colour, field value) to colour.
// Colours are [r, g, b, a].
function step(m,colors,ctx,resolveField,S,fieldValue){
 const p=m,k=m.strength,F=resolveField(m.field,ctx),paper=rgb(colors[0]),spin=360*(p.cycles||0)*ctx.phase,with3=(c,v)=>[v[0],v[1],v[2],c[3]],own=F.shape==='all'?[]:[F];let fn,axes=null,perShape=false;
 switch(m.type){
  case 'tint':{const s=rgb(colourHex(p.color,colors));fn=(c,v)=>with3(c,mixRGB(c,blend(c,s,p.blend),v*k));break;}
  case 'gradient':{const stops=p.ramp==='colours'?[rgb(colourHex(p.from,colors)),rgb(colourHex(p.to,colors))]:rampOf(p.ramp,colors);
   fn=(c,v)=>with3(c,mixRGB(c,blend(c,rampAt(stops,p.reverse?1-v:v),p.blend),k));break;}
  case 'map':{const stops=p.ramp==='colours'?[rgb(colourHex(p.from,colors)),rgb(colourHex(p.to,colors))]:rampOf(p.ramp,colors);fn=(c,v)=>{const l=lum(c);return with3(c,mixRGB(c,rampAt(stops,p.reverse?1-l:l),v*k));};break;}
  case 'spectrum':fn=(c,v)=>{const h=p.offset+360*p.bands*v+spin;let s=fromHSL(h,p.saturation,.5);if(p.mode==='keep')s=setLum(s,lum(c));return with3(c,mixRGB(c,s,k));};break;
  case 'hue':fn=(c,v)=>{const w=v*k;if(w<=0)return c;const [h,s,l]=toHSL(c);return with3(c,fromHSL(h+(p.angle+spin)*w,s,l));};break;
  case 'saturation':fn=(c,v)=>{const w=v*k*p.amount;if(!w)return c;const [h,s,l]=toHSL(c);return with3(c,fromHSL(h,clamp01(w>0?s+(1-s)*w:s*(1+w)),l));};break;
  case 'light':fn=(c,v)=>{const w=v*k,b=p.brightness*w,q=1+(p.contrast-1)*w;return with3(c,[0,1,2].map(i=>{let x=b>0?c[i]+(1-c[i])*b:c[i]*(1+b);return clamp01((x-.5)*q+.5);}));};break;
  case 'invert':fn=(c,v)=>{const w=v*k;if(w<=0)return c;const [h,s,l]=toHSL(c),neg=p.mode==='lightness'?fromHSL(h,s,1-l):[1-c[0],1-c[1],1-c[2]];return with3(c,mixRGB(c,neg,w));};break;
  case 'fade':fn=(c,v)=>{const w=v*k*p.amount;return p.into==='paper'?with3(c,mixRGB(c,paper,w)):[c[0],c[1],c[2],c[3]*(1-w)];};break;
  case 'posterize':{const n=p.levels-1;fn=(c,v)=>with3(c,mixRGB(c,[0,1,2].map(i=>Math.round(clamp01(c[i])*n)/n),v*k));break;}
  // Stripes travel a whole number of bands per loop, so the loop is seamless.
  case 'stripes':{const s=rgb(colourHex(p.color,colors)),shift=(p.cycles||0)*ctx.phase;fn=(c,v)=>{const x=v*p.count+p.offset-shift;if(x-Math.floor(x)>=p.width)return c;
   switch(p.mode){case 'invert':return with3(c,mixRGB(c,[1-c[0],1-c[1],1-c[2]],k));case 'clear':return [c[0],c[1],c[2],c[3]*(1-k)];case 'paper':return with3(c,mixRGB(c,paper,k));default:return with3(c,mixRGB(c,s,k));}};break;}
  case 'threshold':{const dark=rgb(colourHex(p.dark,colors)),light=rgb(colourHex(p.light,colors));fn=(c,v)=>with3(c,mixRGB(c,lum(c)<p.level+p.spread*(v-.5)?dark:light,k));break;}
  case 'solarize':{const L=p.level,sol=x=>x>L?L*(1-x)/(1-L):x;fn=(c,v)=>{const w=v*k;if(w<=0)return c;
   if(p.mode==='lightness'){const [h,s,l]=toHSL(c);return with3(c,mixRGB(c,fromHSL(h,s,sol(l)),w));}return with3(c,mixRGB(c,[sol(c[0]),sol(c[1]),sol(c[2])],w));};break;}
  case 'swap':{const o=[...p.order].map(ch=>'rgb'.indexOf(ch));fn=(c,v)=>with3(c,mixRGB(c,[c[o[0]],c[o[1]],c[o[2]]],v*k));break;}
  case 'splittone':{const dk=rgb(colourHex(p.shadows,colors)),lt=rgb(colourHex(p.highlights,colors));
   fn=(c,v)=>{const l=lum(c),t=clamp01(l+p.balance*.5),u=t*t*(3-2*t);return with3(c,mixRGB(c,setLum(mixRGB(dk,lt,u),l),v*k));};break;}
  case 'palette':{const pal=p.to==='palette'?colors.map(rgb):RAMPS[p.to].stops.map(rgb),n=pal.length,role=i=>p.roles==='rotate'?(i+1)%n:p.to!=='palette'?i:p.roles==='inkpaper'?[1,0,2][i]:p.roles==='inkaccent'?[0,2,1][i]:i;
   fn=(c,v)=>{let best=0,d=Infinity;pal.forEach((q,i)=>{const e=(q[0]-c[0])**2+(q[1]-c[1])**2+(q[2]-c[2])**2;if(e<d){d=e;best=i;}});return with3(c,mixRGB(c,pal[role(best)],v*k));};break;}
  case 'warmth':fn=(c,v)=>{const a=p.amount*v*k;if(!a)return c;return with3(c,setLum([c[0]+.22*a,c[1]+.04*a,c[2]-.22*a],lum(c)));};break;
  // Separation: the plate's coverage (CMYK from RGB) printed in its ink on white paper, inks multiplying.
  case 'separation':{const ink=rgb({process:{c:'#00a0e3',m:'#e5007d',y:'#ffed00',k:'#1d1d1b'},fluo:{c:'#0078bf',m:'#ff48b0',y:'#ffe800',k:'#000000'}}[p.ink][p.plate]),white=rgb('#f7f4ec');
   fn=(c,v)=>{const K=1-Math.max(c[0],c[1],c[2]),cov=p.plate==='k'?K:K>=1?0:(1-c['cmy'.indexOf(p.plate)]-K)/(1-K);return with3(c,mixRGB(c,white.map((w,i)=>w*(1-cov*(1-ink[i]))),v*k));};break;}
  // The third set: colour that reads the shape being painted, drifting blobs, four corners and pop hues.
  case 'shapegradient':{const stops=p.ramp==='colours'?[rgb(colourHex(p.from,colors)),rgb(colourHex(p.to,colors))]:rampOf(p.ramp,colors),dx=Math.cos(p.angle*DEG),dy=Math.sin(p.angle*DEG);
   const ext=()=>Math.max((Math.abs(dx)*(S.box[2]-S.box[0])+Math.abs(dy)*(S.box[3]-S.box[1]))/2,1e-6);perShape=true;
   axes=()=>[{shape:'linear',cx:S.cx,cy:S.cy,dx,dy,R:2*ext(),softness:1,steps:0,invert:false,M:ctx.M},...own];
   fn=(c,v,x,y)=>{const u=clamp01(.5+((x-S.cx)*dx+(y-S.cy)*dy)/(2*ext()));return with3(c,mixRGB(c,blend(c,rampAt(stops,p.reverse?1-u:u),p.blend),v*k));};break;}
  case 'shapecolour':{const stops=p.ramp==='colours'?[rgb(colourHex(p.from,colors)),rgb(colourHex(p.to,colors))]:rampOf(p.ramp,colors);perShape=true;axes=()=>[];
   fn=c=>{const t=fieldValue(F,S.cx,S.cy);return with3(c,mixRGB(c,blend(c,rampAt(stops,p.reverse?1-t:t),p.blend),k));};break;}
  case 'aurora':{const stops=rampOf(p.ramp,colors),n=p.blobs,seed=ctx.seed||1,blobs=[...Array(n)].map((_,i)=>{const a=TAU*(h01(seed,i*3+1)+(p.cycles||0)*ctx.phase*(i%2?1:-1)),r=.12+.1*h01(seed,i*3+2);
    return {cx:(.12+.76*h01(seed,i*3)+Math.cos(a)*r)*ctx.W,cy:(.12+.76*h01(seed,i*3+7)+Math.sin(a)*r)*ctx.H,s:p.size*ctx.M*(.6+.8*h01(seed,i*3+5)),col:rampAt(stops,n>1?i/(n-1):.5)};});
   axes=()=>[...blobs.map(b=>({shape:'radial',pseudo:true,cx:b.cx,cy:b.cy,R:b.s*2.6,softness:1,steps:0,invert:false,M:ctx.M})),...own];
   fn=(c,v,x,y)=>{let sw=0,miss=1;const col=[0,0,0];for(const b of blobs){const w=Math.exp(-((x-b.cx)**2+(y-b.cy)**2)/(2*b.s*b.s));sw+=w;miss*=1-w;col[0]+=w*b.col[0];col[1]+=w*b.col[1];col[2]+=w*b.col[2];}
    if(sw<1e-9)return c;return with3(c,mixRGB(c,blend(c,col.map(q=>q/sw),p.blend),v*k*(1-miss)));};break;}
  case 'corners':{const q=[p.tl,p.tr,p.bl,p.br].map(h=>rgb(colourHex(h,colors))),W=ctx.W,H=ctx.H;
   axes=()=>[{shape:'linear',pseudo:true,cx:W/2,cy:H/2,dx:1,dy:0,R:W,softness:1,steps:0,invert:false,M:ctx.M},{shape:'linear',pseudo:true,cx:W/2,cy:H/2,dx:0,dy:1,R:H,softness:1,steps:0,invert:false,M:ctx.M},...own];
   fn=(c,v,x,y)=>{const u=clamp01(x/W),w=clamp01(y/H);return with3(c,mixRGB(c,mixRGB(mixRGB(q[0],q[1],u),mixRGB(q[2],q[3],u),w),v*k));};break;}
  case 'pop':{const hs=360/p.hues;fn=(c,v)=>{const w=v*k;if(w<=0)return c;let [h,s,l]=toHSL(c);if(s>.04)h=Math.round((h-p.offset)/hs)*hs+p.offset;s=s>.04?lerp(s,1,p.boost):s;
   if(p.levels>1)l=Math.min(.85,Math.max(.15,Math.round(l*(p.levels-1))/(p.levels-1)));return with3(c,mixRGB(c,fromHSL(h,s,l),w));};break;}
  default:fn=c=>c;}
 // Detail: how many bands the step lays across its field, so sampling and cell choice can keep up.
 // Axes: the fields along which the step's colour varies, for choosing gradients and cells; perShape steps read the
 // shape being painted (S), so they are always painted shape by shape.
 return {m,F,fn,target:m.target,bands:m.type==='spectrum'?p.bands:m.type==='stripes'?p.count*2:0,axes:axes||(()=>own),perShape};}
const applies=(target,layer)=>target==='page'||(target==='all'?layer!=='paper':target===layer);

// ---------------------------------------------------------------- paint
const jump=(a,b)=>Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]),Math.abs(a[3]-b[3]));
// Samples fn over [0, 1] into gradient stops: uniform samples, a hard stop pair wherever the colour jumps
// (found by bisection), then Douglas–Peucker keeps only the stops needed within about 1/255.
function stopsAlong(fn,n){const T=[],K=[];let pt=0,pc=fn(0);T.push(0);K.push(pc);
 for(let i=1;i<=n;i++){const t=i/n,c=fn(t);
  if(jump(pc,c)>.1){let lo=pt,hi=t,cl=pc,ch=c;for(let s=0;s<8;s++){const m=(lo+hi)/2,cm=fn(m);if(jump(cl,cm)>=jump(cm,ch)){hi=m;ch=cm;}else{lo=m;cl=cm;}}
   if(lo>pt){T.push(lo);K.push(cl);}if(hi<t){T.push(hi);K.push(ch);}}
  T.push(t);K.push(c);pt=t;pc=c;}
 const keep=new Uint8Array(T.length);keep[0]=keep[T.length-1]=1;const stack=[[0,T.length-1]];
 while(stack.length){const [i,j]=stack.pop();let best=0,at=-1;
  for(let k=i+1;k<j;k++){const u=(T[k]-T[i])/Math.max(T[j]-T[i],1e-12),e=jump(K[k],K[i].map((v,q)=>lerp(v,K[j][q],u)));if(e>best){best=e;at=k;}}
  if(at>=0&&best>.006){keep[at]=1;stack.push([i,at],[at,j]);}}
 const out=[];for(let i=0;i<T.length;i++)if(keep[i])out.push([T[i],K[i]]);return out;}
const flatStops=st=>st.every(s=>jump(s[1],st[0][1])<.006);
const toStops=st=>st.map(([o,c])=>[Math.round(clamp01(o)*1e5)/1e5,hex(c),Math.round(clamp01(c[3])*1e3)/1e3]);

// Rewrites draw operations with the colour modifiers' paint. lib carries the engine's helpers.
export function colourPass(ops,state,scene,ctx,lib){
 const {resolveField,fieldValue,clipConvex,bboxOf,polyArea,paintedShapes}=lib;
 // S is the shape being painted, for the steps that read it (Shape gradient, Shape colour).
 const S={cx:0,cy:0,box:[0,0,1,1]},steps=(state.colours||[]).filter(m=>m.on&&m.strength>0&&COLOURS[m.type]).map(m=>step(m,state.colors,ctx,resolveField,S,fieldValue));
 if(!steps.length)return ops;
 const W=scene.W,H=scene.H,out=[],stats={...(ops.stats||{}),paints:0,pieces:0};
 const src=steps.some(s=>s.target==='paper'||s.target==='page')?[{fill:state.colors[0],a:1,polys:[[0,0,W,0,W,H,0,H]],layer:'paper'},...ops]:ops;
 const Q=ctx.draft?DRAFT:FULL,minSide=scene.M*.015,bands=Math.max(1,...steps.map(s=>s.bands));
 // Flat pieces merge into the operation before them when colour, opacity, element and winding (flip) all match:
 // a flipped cell and an unflipped one must not share a path, or their overlap would cancel.
 let lastFlip=false;
 const emit=(op,polys,c,flip=false)=>{const a=Math.round(op.a*clamp01(c[3])*1e3)/1e3;if(a<.002)return;const fill=hex(c),o=out[out.length-1];
  if(o&&!o.paint&&o.fill===fill&&o.a===a&&o.layer===op.layer&&lastFlip===flip)o.polys.push(...polys);else{out.push({fill,a,polys:[...polys],layer:op.layer});lastFlip=flip;}};
 const emitPaint=(op,polys,paint,st,flip=false)=>{if(flatStops(st)){emit(op,polys,st[0][1],flip);return;}const mid=st[Math.floor(st.length/2)][1];
  stats.paints++;lastFlip=null;out.push({fill:hex(mid),a:op.a,polys,layer:op.layer,paint:{...paint,stops:toStops(st)}});};
 for(const op of src){const list=steps.filter(s=>applies(s.target,op.layer));if(!list.length){out.push(op);lastFlip=null;continue;}
  const base=[...rgb(op.fill),1],chain=(x,y)=>{let c=base;for(const s of list)c=s.fn(c,fieldValue(s.F,x,y),x,y);return c;};
  // The axes the colour varies along, weighted by the bands each lays; per shape when a step reads the shape.
  let geo,weight;const analyse=()=>{geo=[];weight=new Map();for(const s of list)for(const F of s.axes()){geo.push(F);weight.set(F,F===s.F?Math.max(1,s.bands):1);}};analyse();
  const needShape=list.some(s=>s.perShape),flat=F=>F.shape==='box'||F.shape==='noise'||F.shape==='conic';
  if(!geo.length&&!needShape){emit(op,op.polys,chain(W/2,H/2));continue;}
  // Box, noise and angle-sweep fields vary in two directions: they have no single axis.
  const flat2=geo.some(flat),axis=geo.find(F=>!flat(F))||geo[0];
  const lin=F=>F.shape==='linear',same=F=>lin(F)===lin(axis)&&(lin(F)?Math.abs(F.dx*axis.dy-F.dy*axis.dx)<1e-6:Math.hypot(F.cx-axis.cx,F.cy-axis.cy)<.01);
  // Every field varies along one axis: one gradient for the whole operation.
  if(!needShape&&!flat2&&geo.every(same)){const [x0,y0,x1,y1]=bboxOf(op.polys),n=Math.min(640,Math.ceil(64*Math.max(1,bands/2)));
   if(lin(axis)){const us=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(([x,y])=>x*axis.dx+y*axis.dy),u0=Math.min(...us),u1=Math.max(...us);
    if(u1-u0<1e-6){emit(op,op.polys,chain((x0+x1)/2,(y0+y1)/2));continue;}
    const st=stopsAlong(t=>{const u=lerp(u0,u1,t);return chain(u*axis.dx,u*axis.dy);},n);
    emitPaint(op,op.polys,{type:'linear',x1:u0*axis.dx,y1:u0*axis.dy,x2:u1*axis.dx,y2:u1*axis.dy},st);}
   else{const {cx,cy}=axis,r1=Math.max(...[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(([x,y])=>Math.hypot(x-cx,y-cy))),r0=Math.hypot(Math.max(x0-cx,0,cx-x1),Math.max(y0-cy,0,cy-y1));
    if(r1<1e-6){emit(op,op.polys,chain(cx,cy));continue;}
    const st=stopsAlong(t=>chain(cx+lerp(r0,r1,t),cy),n).map(([t,c])=>[lerp(r0,r1,t)/r1,c]);
    emitPaint(op,op.polys,{type:'radial',cx,cy,r:r1},st);}
   continue;}
  // Mixed axes, boxes and noise: shape by shape (an outline with its holes). A shape gets one gradient along the field
  // that changes most across it; where that misses the true colour by more than about 2.5%, it splits in four and each
  // quarter tries again. Cells stay large where one gradient is exact (a linear ramp, a round spot's own rings) and
  // grow fine only along edges where fields cross. Opaque cells overlap a unit (still inside their shape) so their joins do not show.
  const e=op.a>=1?1:0;
  // Box, noise and angle-sweep fields have no axis of their own: a cell follows their local slope instead.
  // The principal direction of the colour's change at a point (the structure tensor of the four channels).
  const steepest=(x,y,h)=>{const a1=chain(x+h,y),a0=chain(x-h,y),b1=chain(x,y+h),b0=chain(x,y-h);let a=0,b=0,c=0;
   for(let i=0;i<4;i++){const gx=a1[i]-a0[i],gy=b1[i]-b0[i];a+=gx*gx;b+=gx*gy;c+=gy*gy;}if(a+c<1e-10)return null;const t=.5*Math.atan2(2*b,a-c);return {shape:'linear',dx:Math.cos(t),dy:Math.sin(t)};};
  const slope=(F,x,y,h)=>{const gx=fieldValue(F,x+h,y)-fieldValue(F,x-h,y),gy=fieldValue(F,x,y+h)-fieldValue(F,x,y-h),l=Math.hypot(gx,gy);return l>1e-9?{shape:'linear',dx:gx/l,dy:gy/l}:null;};
  const fit=(x0,y0,x1,y1)=>{const mx=(x0+x1)/2,my=(y0+y1)/2,corners=[[x0,y0],[x1,y0],[x0,y1],[x1,y1],[mx,my]];let A=null,best=1e-4;
   // A field counts by how far its value moves across the cell, times the bands its step lays across it; the samples
   // along the cell's gradient grow with the bands that actually cross it.
   for(const F of geo){const v=corners.map(([x,y])=>fieldValue(F,x,y)),r=(Math.max(...v)-Math.min(...v))*weight.get(F);if(r>best){best=r;A=F;}}
   const n=Math.min(160,Math.ceil((Math.max(x1-x0,y1-y0)<minSide*4?Q.small:Q.big)+6*best));
   // Where no single field is exact (box, noise, angle sweep, or the blended axes of Aurora and Four corners), the cell's
   // gradient follows the direction its colour changes fastest, so neighbouring cells meet without a step.
   const field=A,exact=A&&!flat(A)&&!A.pseudo?A:null;if(A&&!exact){const h=Math.max(x1-x0,y1-y0)/4;A=steepest(mx,my,h)||(flat(A)?slope(A,mx,my,h):A);}
   if(!A){const c=chain(mx,my);return {flat:c,at:()=>c};}
   if(lin(A)){const {dx,dy}=A,us=corners.map(([x,y])=>(x-mx)*dx+(y-my)*dy),u0=Math.min(...us),u1=Math.max(...us),st=stopsAlong(t=>{const u=lerp(u0,u1,t);return chain(mx+u*dx,my+u*dy);},n);
    return {field,exact,paint:{type:'linear',x1:mx+u0*dx,y1:my+u0*dy,x2:mx+u1*dx,y2:my+u1*dy},st,at:(x,y)=>stopAt(st,((x-mx)*dx+(y-my)*dy-u0)/Math.max(u1-u0,1e-9))};}
   const {cx,cy}=A,d=Math.hypot(mx-cx,my-cy),ux=d>1e-6?(mx-cx)/d:1,uy=d>1e-6?(my-cy)/d:0;
   const r1=Math.max(...corners.map(([x,y])=>Math.hypot(x-cx,y-cy))),r0=Math.hypot(Math.max(x0-cx,0,cx-x1),Math.max(y0-cy,0,cy-y1));
   if(r1<1e-6){const c=chain(mx,my);return {flat:c,at:()=>c};}
   const st=stopsAlong(t=>{const r=lerp(r0,r1,t);return chain(cx+r*ux,cy+r*uy);},n);
   return {field,exact,paint:{type:'radial',cx,cy,r:r1},st:st.map(([t,c])=>[lerp(r0,r1,t)/r1,c]),at:(x,y)=>stopAt(st,(Math.hypot(x-cx,y-cy)-r0)/Math.max(r1-r0,1e-9))};};
  const area=b=>Math.max(b[2]-b[0],1)*Math.max(b[3]-b[1],1);
  // A cell whose pieces add up negative (a twisted Ribbon, a Dial ring) is reversed: winding w becomes -w, which
  // nonzero filling paints exactly the same.
  const leaf=(polys,f)=>{stats.pieces++;const flip=polys.reduce((t,q)=>t+polyArea(q),0)<0,ps=flip?polys.map(reverse):polys;if(f.flat)emit(op,ps,f.flat,flip);else emitPaint(op,ps,f.paint,f.st,flip);};
  // A cell is good when its gradient is within tolerance at nine points, and every field that lays many bands
  // (Stripes, Spectrum) stays true: the field the gradient follows must be nearly flat across the cell (its bands
  // nearly straight), unless the gradient follows its own axis exactly; any other must move by under a band.
  const good=(f,x0,y0,x1,y1)=>{const mx=(x0+x1)/2,my=(y0+y1)/2,h=Math.max(x1-x0,y1-y0)/4;let err=0;
   for(const u of [0,.5,1])for(const v of [0,.5,1]){const x=lerp(x0,x1,u),y=lerp(y0,y1,v);err=Math.max(err,jump(chain(x,y),f.at(x,y)));}
   if(err>Q.tol)return false;
   return geo.every(F=>{const w=weight.get(F);if(w<=1||F===f.exact)return true;
    const vc=fieldValue(F,mx,my),gx=F===f.field?(fieldValue(F,mx+h,my)-fieldValue(F,mx-h,my))/(2*h):0,gy=F===f.field?(fieldValue(F,mx,my+h)-fieldValue(F,mx,my-h))/(2*h):0;let off=0;
    for(const u of [0,.5,1])for(const v of [0,.5,1]){const x=lerp(x0,x1,u),y=lerp(y0,y1,v);off=Math.max(off,Math.abs(fieldValue(F,x,y)-vc-gx*(x-mx)-gy*(y-my)));}
    return off*w<=(F===f.field?Q.plane:Q.band);});};
  // Cells refine breadth first within each shape's share of the budget (by its area against the page's), so detail
  // spreads evenly over a shape and over the page; two budgets in all is the frame's hard limit.
  const refine=(shape,x0,y0,x1,y1,budget)=>{const q=[[shape,x0,y0,x1,y1,0]];let used=0;
   for(let i=0;i<q.length;i++){const [polys,a0,b0,a1,b1,depth]=q[i],f=fit(a0,b0,a1,b1);
    if(Math.max(a1-a0,b1-b0)<minSide*Q.min||depth>=Q.depth||used+(q.length-i)+3>budget||stats.pieces>Q.leaves*2||good(f,a0,b0,a1,b1)){leaf(polys,f);used++;continue;}
    const mx=(a0+a1)/2,my=(b0+b1)/2;
    for(const [a,b,c,d] of [[a0,b0,mx,my],[mx,b0,a1,my],[a0,my,mx,b1],[mx,my,a1,b1]]){const rect=[a-e,b-e,c+e,b-e,c+e,d+e,a-e,d+e];
     const parts=polys.map(p=>clipConvex(p,rect)).filter(p=>p&&p.length>=6&&Math.abs(polyArea(p))>.01);if(!parts.length)continue;
     const [px0,py0,px1,py1]=bboxOf(parts);q.push([parts,Math.max(a,px0),Math.max(b,py0),Math.min(c,px1),Math.min(d,py1),depth+1]);}}};
  // Shapes: without holes each outline is one. With holes (letters, or the overlapping pieces of opposite winding that
  // cut modifiers leave) the outlines only add up correctly as one path, so the whole operation is refined into cells
  // instead: a cell clips every outline, each piece keeps its winding, and nonzero filling inside the cell is exactly
  // the path's. Only steps that read the shape need real shapes; for them the painted region is resolved with Clipper,
  // up to 40,000 points.
  const holed=op.polys.some(q=>q.length>=6&&polyArea(q)<0);
  if(holed&&!(needShape&&op.polys.reduce((n,q)=>n+q.length,0)<=8e4)){const b=bboxOf(op.polys);S.box=b;S.cx=(b[0]+b[2])/2;S.cy=(b[1]+b[3])/2;if(needShape)analyse();
   refine(op.polys,...b,Math.max(2,Math.round(Q.leaves*area(b)/(W*H))));continue;}
  const shapes=holed?paintedShapes(op.polys):op.polys.filter(q=>q.length>=6).map(q=>[q]),boxes=shapes.map(sh=>bboxOf(sh));
  shapes.forEach((shape,i)=>{const [x0,y0,x1,y1]=boxes[i];S.box=boxes[i];S.cx=(x0+x1)/2;S.cy=(y0+y1)/2;if(needShape)analyse();
   // Small shapes, and every shape once the frame has spent its cells, take one flat colour at their centre.
   // A shape past 4,000 points (a whole roughened layer merged into one) takes one gradient, not cells.
   if(shape.reduce((n,q)=>n+q.length,0)>8000){leaf(shape,fit(x0,y0,x1,y1));return;}
   if(Math.max(x1-x0,y1-y0)<minSide||stats.pieces>Q.leaves*2){stats.pieces++;emit(op,shape,chain((x0+x1)/2,(y0+y1)/2));return;}
   refine(shape,x0,y0,x1,y1,Math.max(2,Math.round(Q.leaves*area(boxes[i])/(W*H))));});}
 out.stats=stats;return out;}
function reverse(p){const n=p.length,q=new Array(n);for(let i=0;i<n;i+=2){q[n-2-i]=p[i];q[n-1-i]=p[i+1];}return q;}
// The colour of sampled stops at t in [0, 1].
function stopAt(st,t){t=t<0?0:t>1?1:t;if(t<=st[0][0])return st[0][1];for(let i=1;i<st.length;i++)if(t<=st[i][0]){const [a,ca]=st[i-1],[b,cb]=st[i],u=b-a<1e-12?1:(t-a)/(b-a);return ca.map((v,k)=>lerp(v,cb[k],u));}return st[st.length-1][1];}
// Cell precision: exports and proofs use full; the editor's live view asks for draft (ctx.draft), which keeps a
// pointer-following spot over a busy poster interactive. Tolerance is the largest colour error a cell may keep.
const FULL={tol:.008,band:1,plane:.3,min:.35,depth:8,big:16,small:10,leaves:6000},DRAFT={tol:.07,band:2,plane:.6,min:1,depth:5,big:10,small:6,leaves:1500};

// SVG for one paint, placed just before the path that uses it.
export function paintSVG(p,id,fmt){const stops=p.stops.map(([o,c,a])=>`<stop offset="${o}" stop-color="${c}"${a<1?` stop-opacity="${a}"`:''}/>`).join('');
 return p.type==='linear'?`<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(p.x1)}" y1="${fmt(p.y1)}" x2="${fmt(p.x2)}" y2="${fmt(p.y2)}">${stops}</linearGradient></defs>`
  :`<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${fmt(p.cx)}" cy="${fmt(p.cy)}" r="${fmt(p.r)}">${stops}</radialGradient></defs>`;}
