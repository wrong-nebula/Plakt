/* Glow apertures — shape system study after Koichi Sato’s luminous fields (and Susumu Endo’s light shaft).
 * One pipeline: aperture mask → distance falloff → gradient map.
 * 1 Mask: shapes are drawn white on black — rectangle, door, arch, circle, slit, crescent and silhouettes
 *   (vase, hand, figure, soles, box) — with grey smear copies along the light angle, nested inner layers,
 *   fray strands and a cloudy haze tile.
 * 2 Falloff: the mask is blurred at two scales (width σ and a 3σ bloom tail) and summed. On a straight edge a
 *   blurred step is the normal CDF of signed distance, so the field is a smooth distance falloff with a long tail.
 * 3 Gradient map: feComponentTransfer tables send the field through a 2–5 stop ramp (OKLab-interpolated; curve
 *   and inner/outer balance are baked into the table). Halo: the aperture is the light. Shadow: the field is cast
 *   toward the light angle and the object stays crisp in the ramp’s last colour. Field mode lights the aperture
 *   with blurred lamps on a ring; beam mode paints the ramp along the light through a streaked mask.
 * 4 Poster: grain (a seeded PNG noise tile: overlay, plus a faint normal copy that dithers the darkest and lightest
 *   tones), sparkles, frame inset and copy, which stays vector and crisp.
 * Only primitives that resvg and Chrome draw alike are used: no feTurbulence, and every backed blur is laid over
 * an feFlood of its background colour (beyond the filter region counts as that colour). Renormalising alpha at
 * the region edge instead would amplify the small differences between the two blur implementations there.
 */
export const ENGINE='glow-aperture-v1';
export const W=728,H=1030;
export const SOURCES=[{id:'moma-8200',family:'halo'},{id:'moma-5396',family:'window'},{id:'moma-5529',family:'ember'},{id:'moma-169638',family:'frontier'},{id:'moma-163990',family:'smoke'},{id:'moma-5039',family:'veil'},{id:'pgda-14229',family:'shaft'}];
export const n=v=>Math.round(v*100)/100;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));

// Ramp library: [colour, position] stops; field and beam modes read the ramp as a cycle / along the light.
export const RAMPS=[
 {id:'iwaki',name:'Halo violet',stops:[['#07060f',0],['#2b1a6e',.22],['#3d63c8',.42],['#86dbe9',.6],['#f7f2d8',.8]]},
 {id:'window',name:'Window spectrum',stops:[['#1fb2e8',0],['#9fe3c4',.2],['#f7ec8a',.4],['#f3608f',.64],['#7b5cd6',.84]]},
 {id:'ember',name:'Ember',stops:[['#dce5e1',0],['#e3b4a3',.2],['#a65a48',.42],['#3a120c',.66],['#0d0403',.88]]},
 {id:'spectral',name:'Spectral wheel',stops:[['#2d6fe0',0],['#11b06a',.2],['#f4e04d',.4],['#f0453a',.62],['#e93fb0',.82]]},
 {id:'sepia',name:'Sepia smoke',stops:[['#e9d9cc',0],['#c9b2a2',.22],['#7d6558',.45],['#2a1d18',.7],['#0b0807',.9]]},
 {id:'umber',name:'Umber veil',stops:[['#f2ede3',0],['#cdbfa9',.2],['#6b4a33',.45],['#24160e',.7],['#0e0806',.9]]},
 {id:'flash',name:'Flash',stops:[['#d93a3a',0],['#ee5a3c',.32],['#f3a23a',.6],['#f2ea5a',.86]]},
 {id:'neon',name:'Neon magenta',stops:[['#06040c',0],['#3a0b63',.18],['#c516d8',.38],['#ff6fd8',.56],['#fff0fb',.78]]},
 {id:'sunrise',name:'Sunrise',stops:[['#140a2c',0],['#5b1a58',.2],['#d8433a',.42],['#ffa23d',.62],['#fff2c8',.85]]},
 {id:'aurora',name:'Aurora',stops:[['#5a2bff',0],['#2a7bff',.25],['#19d6c8',.52],['#7dff9a',.82]]},
 {id:'ink',name:'Ink blue',stops:[['#03060f',0],['#0b1f45',.22],['#2b5aa8',.45],['#a8ccff',.68],['#f4f8ff',.88]]},
 {id:'acid',name:'Acid',stops:[['#040404',0],['#1b0e4a',.2],['#0092ff',.42],['#23f0d0',.6],['#d6ff3a',.8]]},
 {id:'indigo',name:'Indigo paper',stops:[['#eef0ea',0],['#b8c4cf',.2],['#4d6a8c',.45],['#13233d',.7],['#070d18',.9]]},
 {id:'mono',name:'Two-stop',stops:[['#000000',0],['#ffffff',1]]}
];
const R=id=>RAMPS.find(r=>r.id===id).stops.map(s=>[...s]);
const P0={size:1,x:0,y:0,rotate:0,count:1,spacing:1,layers:1,width:30,curve:1,balance:0,bloom:.5,offset:0,smear:0,angle:90,haze:0,fray:0,grain:.05,sparkles:0,inset:0,seed:1};
const F=(id,name,after,o)=>({id,name,after,...o,set:{mode:'halo',shape:'rect',layout:'centred',core:'none',sparkle:'dots',ground:'plain',copy:'across',...o.set,params:{...P0,...o.set.params}}});
// Colour roles: ground (field and beam modes), frame (inset, band, ground gradient), core (crisp silhouette), ink (copy).
export const FAMILIES=[
 F('halo','Halo window','Koichi Sato, The 6th Iwaki Prefecture Art Festival, 1982',{title:'芸術祭',info:'Music · Dance · Theatre · Film / Spring 2027',colors:['#07060f','#e3311d','#0a0a12','#ffffff'],ramp:R('iwaki'),
  set:{sparkle:'petals',copy:'stacked',params:{size:.98,width:30,balance:.1,bloom:.55,haze:.15,grain:.05,sparkles:22,inset:8,seed:8200}},
  note:'A paper-white window whose edge burns through cyan and blue into black, scattered with small petals.'}),
 F('window','Spectrum window','Koichi Sato, Morisawa and Company, 1983',{title:'TYPE & LIGHT',info:'Spectrum window / two fields, one ramp',colors:['#f3608f','#121212','#ffffff','#121212'],ramp:R('window'),
  set:{mode:'field',ground:'counter',sparkle:'scribbles',params:{size:.8,width:3,bloom:0,balance:.2,angle:90,grain:.04,sparkles:48,inset:14,seed:5396}},
  note:'A hard-edged window of one spectrum set into its opposite, crossed by glowing scribbles.'}),
 F('ember','Ember box','Koichi Sato, Dress of Japan “Seisei-an”, 1987',{title:'衣 / DRESS OF JAPAN',info:'A dark box and its rising shadow',colors:['#dce5e1','#3a120c','#0b0504','#3a120c'],ramp:R('ember'),
  set:{mode:'shadow',shape:'box',core:'solid',params:{size:.76,y:.12,width:46,curve:.9,balance:.25,bloom:.6,smear:1.1,haze:.25,grain:.05,seed:5529}},
  note:'A crisp black box whose shadow rises like heat through rust and salmon into pale paper.'}),
 F('frontier','Spectral field','Koichi Sato, Urban Frontier Tokyo ’96, 1993',{title:'URBAN FRONTIER',info:'Tokyo / 24 March – 13 October',colors:['#141414','#161616','#0a0a0a','#f2f2f2'],ramp:R('spectral'),
  set:{mode:'field',layout:'band',params:{size:1,width:20,balance:.35,bloom:.4,grain:.04,inset:22,seed:1693}},
  note:'A rectangle of pure spectrum around a white centre, its edge melting into a black frame.'}),
 F('smoke','Smoke soles','Koichi Sato, Life, 1994',{title:'LIFE',info:'Two soles and their smoke',colors:['#e9d9cc','#0b0807','#0b0807','#0b0807'],ramp:R('sepia'),
  set:{mode:'shadow',shape:'soles',core:'solid',copy:'stacked',params:{size:.62,y:.14,width:40,curve:.85,bloom:.7,smear:1.4,haze:.55,grain:.09,seed:1639}},
  note:'Two black soles under a smoky shadow that drifts upward, grainy as an airbrush.'}),
 F('veil','Shadow veil','Koichi Sato, The Women’s Memorial Service, 1979',{title:'祈り',info:'A figure and the dark around it',colors:['#f2ede3','#e9c75a','#0e0806','#4a2a1a'],ramp:R('umber'),
  set:{mode:'shadow',shape:'figure',core:'solid',copy:'stacked',params:{size:.82,y:.08,width:34,bloom:.6,smear:.5,haze:.2,fray:.75,grain:.06,seed:5039}},
  note:'A long-haired figure in a brown halo of shadow; strands fray from its lower edge.'}),
 F('shaft','Light shaft','Susumu Endo, Hiroshima Appeals “negative flashing light”, 2011',{title:'AFTERLIGHT / 2026',info:'A single shaft of light',colors:['#e6e6e4','#232323','#ffffff','#1b1b1b'],ramp:R('flash'),
  set:{mode:'beam',shape:'slit',layout:'beam',ground:'gradient',params:{size:1,width:3,balance:.3,bloom:.55,fray:.9,haze:.4,grain:.16,seed:1422}},
  note:'One vertical shaft — yellow at the top, red below — streaked like rain over a grey field.'}),
 F('club','Neon door','new — electro',{title:'AFTER / HOURS',info:'Fri 23:00 — late · Basement 2',colors:['#06040c','#ff2bd6','#3df5ff','#ffffff'],ramp:R('neon'),
  set:{shape:'door',core:'line',sparkle:'stars',params:{size:.72,y:.02,width:26,balance:.35,bloom:.75,grain:.06,sparkles:26,seed:2323}},
  note:'A door of magenta light on near-black, a cyan neon tube on its frame, light spilling on the floor.'}),
 F('sunrise','Sunrise slits','new — horizon',{title:'DAYBREAK',info:'Three slits of first light',colors:['#140a2c','#140a2c','#140a2c','#fff2c8'],ramp:R('sunrise'),
  set:{shape:'slit',layout:'stacked',params:{size:.9,count:3,spacing:1.6,width:16,balance:.4,bloom:.6,smear:.25,grain:.07,sparkles:10,seed:605}},
  note:'Horizontal slits glowing from indigo through red and orange to a pale gold line.'}),
 F('aurora','Aurora curtains','new — neon field',{title:'AURORA / FIELD',info:'Five curtains of cold light',colors:['#02040a','#0b1630','#ffffff','#e8fff4'],ramp:R('aurora'),
  set:{mode:'beam',shape:'slit',layout:'beam',ground:'gradient',sparkle:'stars',params:{size:1,count:5,spacing:1.1,width:12,bloom:.85,fray:.7,haze:.8,rotate:-6,grain:.05,sparkles:60,seed:4242}},
  note:'Five streaked curtains of green to violet light hanging in a near-black sky.'}),
 F('moon','Moon gate','new — ink blue',{title:'月見',info:'A crescent and its halo',colors:['#03060f','#03060f','#f4f8ff','#cfe0ff'],ramp:R('ink'),
  set:{shape:'crescent',copy:'stacked',params:{size:.6,y:-.04,width:18,balance:.45,bloom:.8,grain:.05,sparkles:70,seed:1515}},
  note:'A crescent of ink-blue light with a long cold halo, in a field of small stars.'}),
 F('signal','Backlit hand','new — acid electro',{title:'SIGNAL',info:'Club night / every Saturday',colors:['#040404','#d6ff3a','#040404','#040404'],ramp:R('acid'),
  set:{shape:'hand',layout:'band',core:'solid',params:{size:.86,width:24,balance:.6,bloom:.8,smear:.3,grain:.06,sparkles:30,seed:777}},
  note:'A black hand eclipsing a blue-to-acid glow, over a lime title band.'}),
 F('vessel','Ink vessel','new — ink and paper',{title:'VESSEL',info:'Light from the upper right',colors:['#eef0ea','#13233d','#070d18','#13233d'],ramp:R('indigo'),
  set:{mode:'shadow',shape:'vase',core:'solid',params:{size:.7,y:.06,width:30,bloom:.55,smear:.8,angle:60,offset:24,haze:.3,grain:.06,seed:4545}},
  note:'A vase cast as an indigo shadow, thrown up and to the right by a low light.'})
];
export const CONTROLS=[
 {key:'size',label:'Aperture size',group:'aperture',min:.2,max:1.4,step:.01},
 {key:'x',label:'Across',group:'aperture',min:-.4,max:.4,step:.01},
 {key:'y',label:'Up / down',group:'aperture',min:-.4,max:.4,step:.01},
 {key:'rotate',label:'Turn',group:'aperture',min:-90,max:90,step:1},
 {key:'count',label:'Apertures',group:'aperture',min:1,max:6,step:1},
 {key:'spacing',label:'Spacing',group:'aperture',min:.4,max:2,step:.01},
 {key:'layers',label:'Nested layers',group:'aperture',min:1,max:5,step:1},
 {key:'width',label:'Falloff width',group:'falloff',min:2,max:110,step:1},
 {key:'curve',label:'Falloff curve',group:'falloff',min:.3,max:3,step:.01},
 {key:'balance',label:'Inner ↔ outer',group:'falloff',min:-1,max:1,step:.01},
 {key:'bloom',label:'Bloom tail',group:'falloff',min:0,max:1,step:.01},
 {key:'offset',label:'Light offset',group:'falloff',min:0,max:160,step:1},
 {key:'smear',label:'Directional smear',group:'falloff',min:0,max:2,step:.01},
 {key:'angle',label:'Light angle',group:'falloff',min:0,max:360,step:1},
 {key:'haze',label:'Haze',group:'falloff',min:0,max:1,step:.01},
 {key:'fray',label:'Fray / streaks',group:'falloff',min:0,max:1,step:.01},
 {key:'grain',label:'Grain',group:'surface',min:0,max:.4,step:.01},
 {key:'sparkles',label:'Sparkles',group:'surface',min:0,max:120,step:1},
 {key:'inset',label:'Frame inset',group:'surface',min:0,max:80,step:1},
 {key:'seed',label:'Seed',group:'surface',min:1,max:9999,step:1}
];
export const SHAPE_NAMES={rect:'Rectangle',door:'Door',arch:'Arch',circle:'Circle',slit:'Slit',crescent:'Crescent moon',vase:'Vase',hand:'Hand',figure:'Figure',soles:'Soles',box:'Box'};
export const OPTIONS={mode:['halo','shadow','field','beam'],shape:Object.keys(SHAPE_NAMES),layout:['centred','stacked','beam','bleed','band'],core:['none','solid','line'],sparkle:['dots','stars','petals','scribbles'],ground:['plain','gradient','counter'],copy:['across','stacked']};
// Options that only some modes read; the editor disables them elsewhere and verify checks they stay inert.
export const OPTION_MODES={ground:['field','beam']};

// ── Colour: sRGB ↔ OKLab, ramps ─────────────────────────────────────────────
const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const lin=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,gam=v=>v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;
function lab(h){const [r,g,b]=hexRGB(h).map(lin),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];}
function rgbOf([L,a,b]){const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>clamp(gam(clamp(v))));}
const hexOf=c=>'#'+c.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
const sortStops=ramp=>[...ramp].sort((a,b)=>a[1]-b[1]);
// Colour at t ∈ [0,1], interpolated in OKLab between the neighbouring stops; returns sRGB 0–1.
export function rampAt(ramp,t,cyclic=false){const s=sortStops(ramp);
 if(cyclic){const p0=s[0][1];t=((t-p0)%1+1)%1+p0;const ext=[...s,[s[0][0],p0+1]];for(let i=0;i<ext.length-1;i++)if(t<=ext[i+1][1]){const f=(t-ext[i][1])/Math.max(1e-6,ext[i+1][1]-ext[i][1]),A=lab(ext[i][0]),B=lab(ext[i+1][0]);return rgbOf(A.map((v,k)=>v+(B[k]-v)*f));}return hexRGB(s[0][0]);}
 if(t<=s[0][1])return hexRGB(s[0][0]);if(t>=s[s.length-1][1])return hexRGB(s[s.length-1][0]);
 for(let i=0;i<s.length-1;i++)if(t<=s[i+1][1]){const f=(t-s[i][1])/Math.max(1e-6,s[i+1][1]-s[i][1]),A=lab(s[i][0]),B=lab(s[i+1][0]);return rgbOf(A.map((v,k)=>v+(B[k]-v)*f));}}
const lightest=ramp=>[...ramp].sort((a,b)=>lab(b[0])[0]-lab(a[0])[0])[0][0];
const mix=(a,b,f)=>hexOf(hexRGB(a).map((v,i)=>v+(hexRGB(b)[i]-v)*f));
const lum=h=>{const [r,g,b]=hexRGB(h).map(lin);return .2126*r+.7152*g+.0722*b;};

// ── Seeded randomness and the two noise tiles (grain: white noise; haze: smooth tileable value noise) ──
const rng=seed=>{let a=seed>>>0;return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};};
const CRC=(()=>{const t=new Uint32Array(256);for(let k=0;k<256;k++){let c=k;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[k]=c>>>0;}return t;})();
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(b){let s='';for(let i=0;i<b.length;i+=3){const v=(b[i]<<16)|((b[i+1]??0)<<8)|(b[i+2]??0);s+=B64[v>>18&63]+B64[v>>12&63]+(i+1<b.length?B64[v>>6&63]:'=')+(i+2<b.length?B64[v&63]:'=');}return s;}
// 8-bit greyscale PNG with stored (uncompressed) deflate blocks — no zlib needed, so Node and the browser agree byte for byte.
function pngGray(N,pix){const raw=new Uint8Array((N+1)*N);for(let y=0;y<N;y++)raw.set(pix.subarray(y*N,y*N+N),y*(N+1)+1);
 const blocks=Math.ceil(raw.length/65535),z=new Uint8Array(2+raw.length+blocks*5+4);z[0]=0x78;z[1]=1;let o=2,a=1,b=0;
 for(let i=0;i<blocks;i++){const len=Math.min(65535,raw.length-i*65535);z[o++]=i===blocks-1?1:0;z[o++]=len&255;z[o++]=len>>8;z[o++]=~len&255;z[o++]=(~len>>8)&255;z.set(raw.subarray(i*65535,i*65535+len),o);o+=len;}
 for(const v of raw){a=(a+v)%65521;b=(b+a)%65521;}z[o++]=b>>8;z[o++]=b&255;z[o++]=a>>8;z[o++]=a&255;
 const chunk=(type,data)=>{const c=new Uint8Array(12+data.length),dv=new DataView(c.buffer);dv.setUint32(0,data.length);for(let i=0;i<4;i++)c[4+i]=type.charCodeAt(i);c.set(data,8);let r=~0;for(let i=4;i<8+data.length;i++)r=CRC[(r^c[i])&255]^(r>>>8);dv.setUint32(8+data.length,~r>>>0);return c;};
 const ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,N);dv.setUint32(4,N);ih[8]=8;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',z),chunk('IEND',new Uint8Array(0))],out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let k=0;for(const p of parts){out.set(p,k);k+=p.length;}
 return 'data:image/png;base64,'+base64(out);}
const tiles=new Map();
function tile(kind,seed){const key=kind+seed;if(tiles.has(key))return tiles.get(key);const r=rng(seed*31+(kind==='grain'?7:13)),N=kind==='grain'?128:64,pix=new Uint8Array(N*N);
 if(kind==='grain')for(let i=0;i<pix.length;i++)pix[i]=Math.floor(r()*256);
 else{const acc=new Float32Array(N*N);for(const [rad,amp] of [[7,1],[3,.45],[1,.18]]){let f=Float32Array.from({length:N*N},r);
   // Three wrap-around box passes per axis ≈ a Gaussian, so the tile stays seamless and isotropic.
   for(let pass=0;pass<6;pass++){const g=new Float32Array(N*N),hor=pass%2===0;for(let y=0;y<N;y++)for(let x=0;x<N;x++){let t=0;for(let k=-rad;k<=rad;k++)t+=hor?f[y*N+(x+k+N)%N]:f[((y+k+N)%N)*N+x];g[y*N+x]=t/(2*rad+1);}f=g;}
   let lo=Infinity,hi=-Infinity;for(const v of f){lo=Math.min(lo,v);hi=Math.max(hi,v);}for(let i=0;i<f.length;i++)acc[i]+=amp*(f[i]-lo)/(hi-lo);}
  let lo=Infinity,hi=-Infinity;for(const v of acc){lo=Math.min(lo,v);hi=Math.max(hi,v);}for(let i=0;i<pix.length;i++)pix[i]=Math.round((acc[i]-lo)/(hi-lo)*255);}
 const uri=pngGray(N,pix);if(tiles.size>24)tiles.clear();tiles.set(key,uri);return uri;}

// ── Shapes: each builds parts in its fitted box; aspect [min,max] limits stretching ─────────
const pt=([x,y])=>`${n(x)} ${n(y)}`;
const poly=ps=>'M'+ps.map(pt).join('L')+'Z';
// Closed Catmull-Rom spline through the points, as cubic Béziers.
function smooth(ps){const m=ps.length;let d='M'+pt(ps[0]);for(let i=0;i<m;i++){const a=ps[(i-1+m)%m],b=ps[i],c=ps[(i+1)%m],e=ps[(i+2)%m];d+=`C${pt([b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6])} ${pt([c[0]-(e[0]-b[0])/6,c[1]-(e[1]-b[1])/6])} ${pt(c)}`;}return d+'Z';}
const circle=(cx,cy,r)=>`M${n(cx-r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx+r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx-r)} ${n(cy)}Z`;
const capsule=(a,b,r)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L*r,ny=dx/L*r,A=`A${n(r)} ${n(r)} 0 0 0 `;return `M${pt([a[0]+nx,a[1]+ny])}L${pt([b[0]+nx,b[1]+ny])}${A}${pt([b[0]-nx,b[1]-ny])}L${pt([a[0]-nx,a[1]-ny])}${A}${pt([a[0]+nx,a[1]+ny])}Z`;};
function crescent(cx,cy,R){const dx=.4*R,dy=-.22*R,r2=.86*R,d=Math.hypot(dx,dy),a=(R*R-r2*r2+d*d)/(2*d),h=Math.sqrt(R*R-a*a),px=a*dx/d,py=a*dy/d,p1=[px-h*dy/d,py+h*dx/d],p2=[px+h*dy/d,py-h*dx/d],back=Math.atan2(dy,dx)+Math.PI;
 // Each arc runs the way that passes the side facing away from the inner circle.
 const arc=(c,r,from,to)=>{const a1=Math.atan2(from[1]-c[1],from[0]-c[0]),a2=Math.atan2(to[1]-c[1],to[0]-c[0]);let dl=((a2-a1)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);const mid=a1+dl/2,off=Math.abs(((mid-back)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI);if(off>Math.PI/2)dl-=2*Math.PI;return `A${n(r)} ${n(r)} 0 ${Math.abs(dl)>Math.PI?1:0} ${dl>0?1:0} ${pt([cx+to[0],cy+to[1]])}`;};
 return `M${pt([cx+p1[0],cy+p1[1]])}${arc([0,0],R,p1,p2)}${arc([dx,dy],r2,p2,p1)}Z`;}
const U=(x,y,w,h)=>(u,v)=>[x+u*w,y+v*h];
const mirror=ps=>[...ps,...ps.slice().reverse().map(([u,v])=>[1-u,v])];
export const SHAPES={
 rect:{aspect:[.2,5],probe:[.5,.5],build:(x,y,w,h)=>[{d:`M${n(x)} ${n(y)}H${n(x+w)}V${n(y+h)}H${n(x)}Z`}]},
 door:{aspect:[.3,.55],probe:[.5,.5],build:(x,y,w,h)=>{const p=U(x,y,w,h);return [{d:poly([p(0,0),p(1,0),p(1,1),p(0,1)])},{d:poly([p(0,1),p(1,1),p(1.5,1.14),p(-.5,1.14)]),shade:.42,spill:true}];}},
 arch:{aspect:[.3,1.6],probe:[.5,.6],build:(x,y,w,h)=>{const r=Math.min(w/2,h);return [{d:`M${n(x)} ${n(y+h)}V${n(y+r)}A${n(w/2)} ${n(r)} 0 0 1 ${n(x+w)} ${n(y+r)}V${n(y+h)}Z`}];}},
 circle:{aspect:[1,1],probe:[.5,.5],build:(x,y,w)=>[{d:circle(x+w/2,y+w/2,w/2)}]},
 slit:{aspect:[.02,50],probe:[.5,.5],build:(x,y,w,h)=>{const t=Math.min(Math.min(w,h)*.45,Math.max(w,h)*.05),c=[x+w/2,y+h/2];return [{d:w>=h?capsule([x+t,c[1]],[x+w-t,c[1]],t):capsule([c[0],y+t],[c[0],y+h-t],t)}];}},
 crescent:{aspect:[1,1],probe:[.15,.55],build:(x,y,w)=>[{d:crescent(x+w/2,y+w/2,w/2)}]},
 vase:{aspect:[.58,.58],probe:[.5,.55],build:(x,y,w,h)=>{const p=U(x,y,w,h);return [{d:smooth(mirror([[.3,0],[.36,.04],[.39,.14],[.2,.3],[.06,.48],[.04,.62],[.18,.84],[.32,.95],[.3,1]]).map(([u,v])=>p(u,v)))}];}},
 hand:{aspect:[.72,.72],probe:[.5,.72],build:(x,y,w,h)=>{const p=U(x,y,w,h),r=.075*w;return [{d:smooth([[.2,.5],[.82,.48],[.86,.7],[.74,.93],[.3,.95],[.17,.75]].map(([u,v])=>p(u,v)))},{d:poly([p(.32,.88),p(.7,.88),p(.66,1),p(.36,1)])},
  ...[[.26,.55,.2,.12],[.43,.52,.42,.03],[.6,.53,.64,.08],[.75,.56,.84,.22]].map(([u0,v0,u1,v1])=>({d:capsule(p(u0,v0),p(u1,v1),r)})),{d:capsule(p(.24,.8),p(.04,.5),r*1.12)}];}},
 figure:{aspect:[.64,.64],probe:[.5,.7],build:(x,y,w,h)=>{const p=U(x,y,w,h);return [{d:smooth(mirror([[.04,1],[.03,.8],[.08,.6],[.18,.47],[.27,.38],[.26,.22],[.31,.08],[.42,.01]]).map(([u,v])=>p(u,v)))}];}},
 soles:{aspect:[.92,.92],probe:[.27,.5],build:(x,y,w,h)=>{const sole=[[.3,.04],[.62,0],[.9,.1],[.97,.3],[.92,.5],[.84,.7],[.86,.88],[.7,1],[.42,.99],[.3,.86],[.34,.64],[.12,.42],[.07,.2]],L=U(x+w*.07,y,w*.38,h),Rr=U(x+w*.55,y+h*.02,w*.38,h*.98);
  return [{d:smooth(sole.map(([u,v])=>L(1-u,v)))},{d:smooth(sole.map(([u,v])=>Rr(u,v)))}];}},
 box:{aspect:[1.2,1.2],probe:[.5,.75],build:(x,y,w,h)=>{const p=U(x,y,w,h);return [{d:poly([p(0,.42),p(1,.42),p(1,1),p(0,1)])},{d:poly([p(0,.42),p(1,.42),p(.94,.06),p(.08,.08)]),shade:.84}];}}
};
function fit([x,y,w,h],[a0,a1]){const a=clamp(w/h,a0,a1);let fw=w,fh=h;if(a<w/h)fw=h*a;else fh=w/a;return [x+(w-fw)/2,y+(h-fh)/2,fw,fh];}

// ── Layouts: aperture boxes in poster units ────────────────────────────────
export function layoutBoxes(state){const p=state.params,L=state.layout,k=p.count,s=p.size,ins=p.inset;
 const A={centred:[56,104,W-56,H-84],stacked:[56,104,W-56,H-84],beam:[0,-30,W,H+30],bleed:[ins+4,ins+4,W-ins-4,H-ins-4],band:[44,44,W-44,Math.round(H*.8)-24]}[L];
 const cx=(A[0]+A[2])/2+p.x*W,cy=(A[1]+A[3])/2+p.y*H,f=L==='bleed'?1:.86,out=[];let bw=(A[2]-A[0])*f*s,bh=(A[3]-A[1])*f*s;
 if(L==='beam'){bw=W*.16*s;bh=A[3]-A[1];for(let i=0;i<k;i++)out.push([cx+(i-(k-1)/2)*bw*1.5*p.spacing-bw/2,cy-bh/2,bw,bh]);return out;}
 // A stacked column is built from narrower landscape bands, so even one stacked aperture is smaller than a centred one.
 if(L==='stacked'){bw*=.86;const h=bh*.72/(1+(k-1)*p.spacing*.72);const span=h*(1+(k-1)*p.spacing);for(let i=0;i<k;i++)out.push([cx-bw/2,cy-span/2+i*h*p.spacing,bw,h]);return out;}
 const w=bw/(1+(k-1)*p.spacing);for(let i=0;i<k;i++)out.push([cx-bw/2+i*w*p.spacing,cy-bh/2,w,bh]);return out;}
// One entry per aperture: fitted box, parts, rotation about its centre.
export function apertures(state){const p=state.params,S=SHAPES[state.shape],rot=p.rotate+(state.mode==='beam'?90-p.angle:0);
 return layoutBoxes(state).map(b=>{const f=fit(b,S.aspect);return {box:b,fit:f,parts:S.build(...f),c:[f[0]+f[2]/2,f[1]+f[3]/2],rot,probe:[f[0]+S.probe[0]*f[2],f[1]+S.probe[1]*f[3]]};});}
const rotT=a=>a.rot?` transform="rotate(${n(a.rot)} ${pt(a.c)})"`:'';
const grey=v=>{const h=Math.round(clamp(v)*255).toString(16).padStart(2,'0');return '#'+h+h+h;};
const dirOf=deg=>[Math.cos(deg*Math.PI/180),-Math.sin(deg*Math.PI/180)];

// Fray strands hang from each aperture on the side away from the light (beam mode: streaks along the slit).
function strands(state,a,i){const p=state.params,r=rng(p.seed*97+i*13+3),out=[];if(p.fray<=0)return out;const [x,y,w,h]=a.fit;
 if(state.mode==='beam'){const along=w<h,len=along?h:w,th=Math.min(Math.min(w,h)*.45,Math.max(w,h)*.05);for(let k=0,m=Math.round(16+p.fray*90);k<m;k++){const o=(r()*2-1)*th*.95,s=r()*len*.7,e=s+len*(.25+r()*.75),g=.6+r()*.4,sw=1+r()**2*4.5;
  out.push(along?{a:[x+w/2+o,y+s],b:[x+w/2+o,y+Math.min(len,e)],g,sw}:{a:[x+s,y+h/2+o],b:[x+Math.min(len,e),y+h/2+o],g,sw});}return out;}
 const [dx,dy]=dirOf(p.angle+180),ext=Math.abs(dx)*w/2+Math.abs(dy)*h/2,side=Math.abs(dy)*w/2+Math.abs(dx)*h/2;
 for(let k=0,m=Math.round(p.fray*110);k<m;k++){const t=(r()*2-1)*.86,base=[a.c[0]+dx*ext*.86-dy*side*t,a.c[1]+dy*ext*.86+dx*side*t],L=(.04+r()**1.6*.24)*Math.max(w,h)*(1-.5*Math.abs(t));
  out.push({a:base,b:[base[0]+dx*L,base[1]+dy*L],g:.6+r()*.4,sw:.6+r()*2.2});}return out;}
const strandSVG=(ss,col)=>ss.map(s=>`<path d="M${pt(s.a)}L${pt(s.b)}" stroke="${col??grey(s.g)}" stroke-width="${n(s.sw)}" stroke-linecap="round"/>`).join('');

// The mask: everything the falloff is built from, white on black.
function maskGroup(state,aps,uid,{crisp=false}={}){const p=state.params,beam=state.mode==='beam',[ox,oy]=dirOf(p.angle),m=30;let s=`<rect x="${-m}" y="${-m}" width="${W+2*m}" height="${H+2*m}" fill="#000"/>`;
 // Shadow mode casts the whole field 0.8σ toward the light angle, away from the crisp object.
 const cast=(p.offset||0)+(state.mode==='shadow'?p.width*.8:0),shift=!crisp&&cast?` transform="translate(${n(ox*cast)} ${n(oy*cast)})"`:'';s+=`<g${shift}>`;
 aps.forEach((a,i)=>{const body=a.parts.filter(q=>!q.spill),paths=(q,fill)=>q.map(x=>`<path d="${x.d}" fill="${fill??grey(x.shade??1)}"/>`).join('');
  // Smear: grey copies along the light, drawn dimmest first so each pixel keeps its brightest copy (a max).
  if(!crisp&&p.smear>0){const N=12,len=p.smear*a.fit[3]*.75;for(let k=N;k>=1;k--){const t=k/N,sc=1+.32*p.smear*t;s+=`<g transform="translate(${n(ox*len*t)} ${n(oy*len*t)}) translate(${pt(a.c)}) scale(${n(sc*1000)/1000}) translate(${n(-a.c[0])} ${n(-a.c[1])})"><g${rotT(a)}>${paths(body,grey(.92*(1-t)**1.25))}</g></g>`;}}
  const lay=Array.from({length:p.layers-1},(_,k)=>{const sc=1-.17*(k+1);return `<g transform="translate(${pt(a.c)}) scale(${n(sc)}) translate(${n(-a.c[0])} ${n(-a.c[1])})">${paths(body,(k%2)?'#fff':'#000')}</g>`;}).join('');
  const base=beam?paths(body,grey(1-.55*p.fray)):paths(a.parts);
  let streak='';if(beam&&(p.fray>0||(!crisp&&p.haze>0))){streak=`<g clip-path="url(#cl${uid}-${i})">${strandSVG(strands(state,a,i))}${!crisp&&p.haze>0?`<rect x="${-m}" y="${-m}" width="${W+2*m}" height="${H+2*m}" fill="url(#hz${p.seed})" opacity="${n(p.haze*.5)}" style="mix-blend-mode:multiply"/>`:''}</g>`;}
  s+=`<g${rotT(a)}>${base}${lay}${streak}${beam?'':strandSVG(strands(state,a,i),'#fff')}</g>`;});
 s+='</g>';
 if(!crisp&&p.haze>0&&!beam)s+=`<rect x="${-m}" y="${-m}" width="${W+2*m}" height="${H+2*m}" fill="url(#hz${p.seed})" opacity="${n(p.haze*.45)}"/>`;
 return s;}
// clipPath may only hold shapes (no <g>), and its content sits inside the already rotated group, so no transform.
const clipDefs=(state,aps,uid)=>state.mode==='beam'?aps.map((a,i)=>`<clipPath id="cl${uid}-${i}">${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}"/>`).join('')}</clipPath>`).join(''):'';

// Field → ramp position: undo the haze lift, push light out or in (balance), then the curve. Every step keeps a
// bounded slope, so the 8-bit field between filter primitives never turns into visible (or renderer-specific) rings.
export function profile(u,p,mode){const h=mode==='beam'?0:p.haze*.45;u=clamp((u-.5*h)/Math.max(.05,1-h));const g=2**(1.6*Math.abs(p.balance)),c=p.curve;
 u=p.balance>=0?1-(1-u)**g:u**g;
 // Harder (c > 1): a power S-curve, flat at both ends. Softer (c < 1): pushed toward the middle, slope ≤ 1 + 2.5(1 − c).
 return c>=1?(u<.5?.5*(2*u)**c:1-.5*(2-2*u)**c):u+2.5*(1-c)*(u-u*u*(3-2*u));}
const TABLE=64;
function falloffFilter(id,p,map,mode){// map: (u)→[r,g,b]
 const vals=Array.from({length:TABLE},(_,i)=>map(profile(i/(TABLE-1),p,mode))),ch=k=>vals.map(v=>n(v[k]*1e4)/1e4).join(' '),m=20,[dx,dy]=dirOf(p.angle);
 // The bloom tail drifts toward the light by 0.8σ, so a symmetric aperture still shows where the light comes from.
 return `<filter id="${id}" filterUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${W+2*m}" height="${H+2*m}" color-interpolation-filters="sRGB"><feFlood flood-color="#000" result="k"/><feGaussianBlur in="SourceGraphic" stdDeviation="${n(p.width)}" result="a"/><feMerge result="a1"><feMergeNode in="k"/><feMergeNode in="a"/></feMerge><feGaussianBlur in="SourceGraphic" stdDeviation="${n(p.width*3)}" result="b0"/><feOffset in="b0" dx="${n(dx*p.width*.8)}" dy="${n(dy*p.width*.8)}" result="b"/><feMerge result="b1"><feMergeNode in="k"/><feMergeNode in="b"/></feMerge><feComposite in="a1" in2="b1" operator="arithmetic" k2="${n(1-p.bloom)}" k3="${n(p.bloom)}" k4="0" result="f"/><feComponentTransfer in="f"><feFuncR type="table" tableValues="${ch(0)}"/><feFuncG type="table" tableValues="${ch(1)}"/><feFuncB type="table" tableValues="${ch(2)}"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter>`;}
// kind: 'opaque' lays the blur over a flood of the layer's backing colour, 'glow' merges the blur under the source, 'soft' is a plain blur.
const blurFilter=(id,sd,box=[0,0,W,H],kind='opaque',flood='#000')=>`<filter id="${id}" filterUnits="userSpaceOnUse" x="${n(box[0])}" y="${n(box[1])}" width="${n(box[2])}" height="${n(box[3])}" color-interpolation-filters="sRGB">${kind==='opaque'?`<feFlood flood-color="${flood}" result="k"/>`:''}<feGaussianBlur in="SourceGraphic" stdDeviation="${n(sd)}" result="b"/>${{glow:'<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>',opaque:'<feMerge><feMergeNode in="k"/><feMergeNode in="b"/></feMerge>',soft:''}[kind]}</filter>`;

// Field mode: blurred lamps on an elliptical ring, sampled round the ramp as a cycle, with a white centre lamp.
function lamps(state,box,turn=0){const p=state.params,[x,y,w,h]=box,c=[x+w/2,y+h/2],N=12,mn=Math.min(w,h),out=[];
 for(let k=0;k<N;k++){const t=k/N,ang=(p.angle+turn-360*t)*Math.PI/180;out.push(`<ellipse cx="${n(c[0]+Math.cos(ang)*w*.44)}" cy="${n(c[1]-Math.sin(ang)*h*.44)}" rx="${n(w*.24)}" ry="${n(h*.24)}" fill="${hexOf(rampAt(state.ramp,t,true))}"/>`);}
 const cr=.2*mn*(1+p.balance);if(cr>1)out.push(`<ellipse cx="${n(c[0])}" cy="${n(c[1]+h*.06)}" rx="${n(cr*1.15)}" ry="${n(cr)}" fill="${mix('#ffffff',lightest(state.ramp),.25)}" opacity=".92"/>`);
 return out.join('');}
const meanRamp=ramp=>{const s=[0,0,0];for(let i=0;i<24;i++)rampAt(ramp,i/24,true).forEach((v,k)=>s[k]+=v/24);return hexOf(s);};
const lampBlur=(state,box)=>.13*Math.min(box[2],box[3])*(.7+.6*state.params.bloom);

// Ground (field and beam modes): plain colour, a gradient toward the frame colour along the light, or a counter-field.
function groundSVG(state,uid,defs){const [g,fr]=state.colors,p=state.params;
 if(state.ground==='gradient'){const [dx,dy]=dirOf(p.angle),r=Math.abs(dx)*W/2+Math.abs(dy)*H/2;defs.push(`<linearGradient id="gg${uid}" gradientUnits="userSpaceOnUse" x1="${n(W/2-dx*r)}" y1="${n(H/2-dy*r)}" x2="${n(W/2+dx*r)}" y2="${n(H/2+dy*r)}"><stop offset="0" stop-color="${fr}"/><stop offset=".55" stop-color="${mix(fr,g,.75)}"/><stop offset="1" stop-color="${g}"/></linearGradient>`);return `<rect width="${W}" height="${H}" fill="url(#gg${uid})"/>`;}
 if(state.ground==='counter'){const box=[-W*.1,-H*.1,W*1.2,H*1.2];defs.push(blurFilter(`cf${uid}`,lampBlur(state,[0,0,W,H])*1.2,[0,0,W,H],'opaque',meanRamp(state.ramp)));return `<g filter="url(#cf${uid})"><g clip-path="url(#rp${uid})"><rect width="${W}" height="${H}" fill="${meanRamp(state.ramp)}"/>${lamps(state,box,180)}</g></g>`;}
 return `<rect width="${W}" height="${H}" fill="${g}"/>`;}
function rainSVG(state){const p=state.params,r=rng(p.seed*5+11),m=Math.round(p.fray*150);if(state.mode!=='beam'||!m)return '';let s='';
 for(let k=0;k<m;k++){const x=r()*W,y0=r()*H*.9,len=40+r()*H*.5;s+=`<path d="M${n(x)} ${n(y0)}V${n(y0+len)}" stroke="${state.colors[1]}" stroke-opacity="${n(.05+r()*.12)}" stroke-width="${n(.6+r()*1.6)}"/>`;}
 return `<g>${s}</g>`;}

function coreSVG(state,aps,uid,defs){if(state.core==='none')return '';const col=state.colors[2];
 if(state.core==='line'){const outl=aps.map(a=>`<g${rotT(a)}>${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}"/>`).join('')}</g>`).join('');
  // A neon tube on the outline of the union: strokes twice as wide, masked to outside the parts, so overlapping parts (fingers on a palm) leave no inner lines.
  defs.push(blurFilter(`ln${uid}`,4,[-20,-20,W+40,H+40],'glow'),`<mask id="lm${uid}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${W+40}" height="${H+40}"><rect x="-20" y="-20" width="${W+40}" height="${H+40}" fill="#fff"/><g fill="#000">${outl}</g></mask>`);
  return `<g mask="url(#lm${uid})"><g filter="url(#ln${uid})" fill="none" stroke="${col}" stroke-width="6.4" stroke-linejoin="round"><g clip-path="url(#rg${uid})">${outl}</g></g></g>`;}
 return `<g>${aps.map((a,i)=>`<g${rotT(a)}>${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}" fill="${col}"${q.shade?` fill-opacity="${q.shade}"`:''}/>`).join('')}${state.mode==='beam'?'':strandSVG(strands(state,a,i),col)}</g>`).join('')}</g>`;}

// Sparkles: glowing points, four-point stars, petals or Morisawa scribbles, seeded.
function sparkSVG(state,aps,uid,defs){const p=state.params,k=p.sparkles;if(!k)return '';const r=rng(p.seed*3+1),lite=lightest(state.ramp),ins=p.inset+10,pts=[];
 const inBox=()=>{const a=aps[Math.floor(r()*aps.length)].fit;return [a[0]+a[2]*(.08+r()*.84),a[1]+a[3]*(.06+r()*.88)];},any=()=>[ins+r()*(W-2*ins),ins+r()*(H-2*ins)];
 if(state.sparkle==='petals'){const pal=[...state.ramp.map(s=>s[0]),'#e8433a','#f2c14e','#5a8a4a','#d07aa0','#2a2a2a'];defs.push(blurFilter(`ps${uid}`,2.4,[-10,-10,W+20,H+20],'soft'));
  // All petal shadows share one blurred group (one filter pass), then the petals sit on top.
  const sh=[];for(let i=0;i<k;i++){const [x,y]=inBox(),s=3+r()*6.5,a=n(r()*360),c=pal[Math.floor(r()*pal.length)],e=`<ellipse cx="0" cy="0" rx="${n(s*1.7)}" ry="${n(s*.7)}"/>`;
   sh.push(`<g transform="translate(${n(x+2)} ${n(y+3)}) rotate(${a})">${e}</g>`);pts.push(`<g transform="translate(${n(x)} ${n(y)}) rotate(${a})"><g fill="${c}">${e}</g><path d="M${n(s*1.6)} 0l${n(s*1.1)} ${n(-s*.4)}" stroke="${c}" stroke-width=".8"/></g>`);}
  return `<g fill="#000" opacity=".22" filter="url(#ps${uid})"><g clip-path="url(#rg${uid})">${sh.join('')}</g></g><g>${pts.join('')}</g>`;}
 defs.push(blurFilter(`sp${uid}`,state.sparkle==='scribbles'?6:2.6,[-20,-20,W+40,H+40],'glow'));
 if(state.sparkle==='scribbles'){for(let i=0,m=Math.max(1,Math.round(k/8));i<m;i++){const a=aps[i%aps.length].fit,x0=a[0]-a[2]*.15+r()*a[2]*1.3,y0=a[1]-a[3]*.12+r()*a[3]*.4,len=a[3]*(.35+r()*.6),q=[];let x=x0;
   for(let y=y0,j=0;y<y0+len;y+=24+r()*14,j++){x+=(j%2?1:-1)*(7+r()*16)+(r()-.5)*6;q.push([x,y]);}if(q.length<3)continue;
   let d='M'+pt(q[0]);for(let j=1;j<q.length-1;j++)d+=`Q${pt(q[j])} ${pt([(q[j][0]+q[j+1][0])/2,(q[j][1]+q[j+1][1])/2])}`;pts.push(`<path d="${d}" fill="none" stroke="${mix(lite,'#ffffff',.65)}" stroke-width="${n(5+r()*4)}" stroke-linecap="round" opacity="${n(.55+r()*.3)}"/>`);}
  return `<g filter="url(#sp${uid})"><g clip-path="url(#rg${uid})">${pts.join('')}</g></g>`;}
 for(let i=0;i<k;i++){const [x,y]=any(),star=state.sparkle==='stars'&&r()<.3,o=n(.55+r()*.45);
  if(star){const s=5+r()*9;pts.push(`<path d="M${n(x)} ${n(y-s)}Q${n(x)} ${n(y)} ${n(x+s*.7)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y+s)}Q${n(x)} ${n(y)} ${n(x-s*.7)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y-s)}Z" fill="${lite}" opacity="${o}"/>`);}
  else pts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(.7+r()**3*2.3)}" fill="${lite}" opacity="${o}"/>`);}
 return `<g filter="url(#sp${uid})"><g clip-path="url(#rg${uid})">${pts.join('')}</g></g>`;}

const FONT=`'Helvetica Neue',Helvetica,Arial,'Hiragino Sans','Hiragino Kaku Gothic ProN',sans-serif`,FONT_JA=`'Hiragino Sans','Hiragino Kaku Gothic ProN','Helvetica Neue',sans-serif`;
// Japanese copy names Hiragino first, so resvg and Chrome pick the same face and weight.
const fontFor=t=>/[\u3000-\u9fff\uff00-\uffef]/.test(t)?FONT_JA:FONT;
// Copy keeps & (escaped here); markup characters never reach the state (see resolve).
const esc=s=>String(s).replace(/[<>"]/g,'').replace(/&/g,'&amp;');
const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((u,v)=>v-u);return (x+.05)/(y+.05);};
function copySVG(state){const p=state.params,ink=state.colors[3],fr=state.colors[1],ins=p.inset,L=state.layout,
 // Copy set on the band or in the frame takes the ink if it reads there, else black or warm white.
 onFrame=contrast(ink,fr)>=3?ink:lum(fr)>.3?'#111111':'#f4f1ea',F=t=>t.replace('<text ',`<text fill="${onFrame}" `),lines=state.title.split('/').map(s=>s.trim()).filter(Boolean),info=state.info.replace(/[<>"]/g,"");let s='';
 const T=(x,y,size,txt,anchor='start',weight=700,ls=0)=>`<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" font-weight="${weight}" text-anchor="${anchor}"${ls?` letter-spacing="${ls}"`:''}${fontFor(txt)===FONT?'':` font-family="${FONT_JA}"`}>${esc(txt)}</text>`;
 const bandTop=Math.round(H*.8);
 if(state.copy==='stacked'){const chars=[...lines.join('')].filter(c=>c!==' ');const size=Math.min(40,(L==='band'?bandTop-120:H-200)/Math.max(1,chars.length)/1.1);chars.forEach((c,i)=>{s+=T(W-50-ins,78+ins+size*(1+i*1.1),size,c,'middle');});}
 else if(L==='band'){const size=Math.min(44,560/Math.max(...lines.map(l=>[...l].length),1)*1.15);lines.forEach((l,i)=>{s+=F(T(W/2,bandTop+(H-bandTop)*.42+(i-(lines.length-1)/2)*size*1.02,size,l,'middle',700,-.5));});}
 else if(L==='beam')lines.forEach((l,i)=>{s+=T(40+ins,96+ins+i*52,54,l,'start',800,-1);});
 else if(L==='bleed'&&ins>=20){const size=Math.min(ins*.62,19);s+=F(T(W/2,H-ins/2+size*.36,size,lines.join(' '),'middle',700,.6));}
 else lines.forEach((l,i)=>{s+=T(44+ins,80+ins+i*38,36,l,'start',700,-.5);});
 if(info){const lines2=info.split('/').map(x=>x.trim()).filter(Boolean).slice(0,2);
  if(L==='band')s+=F(state.copy==='stacked'?T(W/2,bandTop+(H-bandTop)*.55,17,lines2.join('  ·  '),'middle',700,.4):T(W/2,H-24-ins,12.5,lines2.join('  ·  '),'middle',400,.5));
  else if(L==='bleed'&&ins>=20)s+=F(T(ins+8,H-ins/2+4,10,lines2[0],'start',400,.4));
  else if(L==='beam')lines2.forEach((l,i)=>{s+=T(42+ins,96+ins+lines.length*52+i*21,17,l,'start',700);});
  else lines2.forEach((l,i)=>{s+=T(44+ins,(L==='band'?bandTop-34:H-50-ins)+i*19,14,l,'start',400,.4);});}
 return s?`<g font-family="${FONT}" fill="${ink}">${s}</g>`:'';}

const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);
const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
const clampNum=(v,c,d)=>Number.isFinite(+v)&&v!==null&&v!==''&&typeof v!=='boolean'?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):d;
const isHex=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input?.family)??FAMILIES[0],set=family.set,params={};input=input&&typeof input==='object'?input:{};
 for(const c of CONTROLS)params[c.key]=clampNum(input.params?.[c.key],c,set.params[c.key]);
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k];
 const colors=Array.isArray(input.colors)&&input.colors.length===4&&input.colors.every(isHex)?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const ramp=Array.isArray(input.ramp)&&input.ramp.length>=2&&input.ramp.length<=5&&input.ramp.every(s=>Array.isArray(s)&&isHex(s[0])&&Number.isFinite(+s[1]))?input.ramp.map(([c,q])=>[c.toLowerCase(),n(clamp(+q)*1000)/1000]):family.ramp.map(s=>[...s]);
 // Defaults pass through the same cleaning as input, so a saved state resolves to itself.
 const clip=(v,d,max)=>(typeof v==='string'?v:d).replace(/[<>"]/g,'').slice(0,max);
 return {engine:ENGINE,family:family.id,stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,mode:pick('mode'),shape:pick('shape'),layout:pick('layout'),core:pick('core'),sparkle:pick('sparkle'),ground:pick('ground'),copy:pick('copy'),
  title:clip(input.title,family.title,40),info:clip(input.info,family.info,90),params,colors,ramp};}

// The poster body (no <svg> wrapper) so the specimen can nest it.
function draw(state,uid){const p=state.params,st=state.stage,aps=apertures(state),defs=[],parts=[],mode=state.mode,feat={apertures:aps.length,sparkles:0,strands:0,stops:state.ramp.length,mode};
 if(p.haze>0&&st>=2)defs.push(`<pattern id="hz${p.seed}" patternUnits="userSpaceOnUse" width="420" height="420" patternTransform="rotate(17)"><image href="${tile('haze',p.seed)}" width="420" height="420" preserveAspectRatio="none"/></pattern>`);
 // Filtered groups clip their content to the filter region: Chrome otherwise lets content beyond it feed the blur, resvg does not.
 defs.push(clipDefs(state,aps,uid),`<clipPath id="rg${uid}"><rect x="-20" y="-20" width="${W+40}" height="${H+40}"/></clipPath><clipPath id="rp${uid}"><rect width="${W}" height="${H}"/></clipPath>`);feat.strands=aps.reduce((s,a,i)=>s+strands(state,a,i).length,0);
 if(st===1){parts.push(`<rect width="${W}" height="${H}" fill="#000"/>${maskGroup(state,aps,uid,{crisp:true})}`);
  const [dx,dy]=dirOf(p.angle),c=aps[0].c;parts.push(`<g fill="none" stroke="#ff3b6b" stroke-width="1.4">${aps.map(a=>`<rect x="${n(a.box[0])}" y="${n(a.box[1])}" width="${n(a.box[2])}" height="${n(a.box[3])}" stroke-dasharray="5 5" opacity=".7"/>`).join('')}<path d="M${pt(c)}l${n(dx*90)} ${n(dy*90)}" stroke-width="3"/><circle cx="${n(c[0]+dx*90)}" cy="${n(c[1]+dy*90)}" r="6" fill="#ff3b6b"/></g>`);}
 else if(st===2){defs.push(falloffFilter(`ff${uid}`,p,v=>[v,v,v],mode));parts.push(`<g filter="url(#ff${uid})"><g clip-path="url(#rg${uid})">${maskGroup(state,aps,uid)}</g></g>`);}
 else{
  if(mode==='halo'||mode==='shadow'){defs.push(falloffFilter(`ff${uid}`,p,v=>rampAt(state.ramp,v),mode));parts.push(`<rect width="${W}" height="${H}" fill="${hexOf(rampAt(state.ramp,0))}"/><g filter="url(#ff${uid})"><g clip-path="url(#rg${uid})">${maskGroup(state,aps,uid)}</g></g>`);}
  else{defs.push(falloffFilter(`ff${uid}`,p,v=>[v,v,v],mode),`<mask id="mk${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><g filter="url(#ff${uid})"><g clip-path="url(#rg${uid})">${maskGroup(state,aps,uid)}</g></g></mask>`);
   parts.push(groundSVG(state,uid,defs));
   if(mode==='field'){const sd=Math.max(...aps.map(a=>lampBlur(state,a.fit)));defs.push(blurFilter(`lp${uid}`,sd,[0,0,W,H],'opaque',meanRamp(state.ramp)));parts.push(`<g mask="url(#mk${uid})"><g filter="url(#lp${uid})"><g clip-path="url(#rp${uid})"><rect width="${W}" height="${H}" fill="${meanRamp(state.ramp)}"/>${aps.map(a=>lamps(state,a.fit)).join('')}</g></g></g>`);}
   else{const [dx,dy]=dirOf(p.angle),r=Math.abs(dx)*W/2+Math.abs(dy)*H/2;defs.push(`<linearGradient id="bg${uid}" gradientUnits="userSpaceOnUse" x1="${n(W/2-dx*r)}" y1="${n(H/2-dy*r)}" x2="${n(W/2+dx*r)}" y2="${n(H/2+dy*r)}">${Array.from({length:17},(_,i)=>`<stop offset="${n(i/16)}" stop-color="${hexOf(rampAt(state.ramp,i/16))}"/>`).join('')}</linearGradient>`);
    parts.push(rainSVG(state),`<g mask="url(#mk${uid})"><rect width="${W}" height="${H}" fill="url(#bg${uid})"/></g>`);}}
  if(mode==='shadow'){const end=hexOf(rampAt(state.ramp,1));parts.push(`<g>${aps.map((a,i)=>`<g${rotT(a)}>${a.parts.filter(q=>!q.spill).map(q=>`<path d="${q.d}" fill="${end}"/>`).join('')}${strandSVG(strands(state,a,i),end)}</g>`).join('')}</g>`);}
  parts.push(coreSVG(state,aps,uid,defs));
  if(state.layout==='band')parts.push(`<rect y="${Math.round(H*.8)}" width="${W}" height="${H-Math.round(H*.8)}" fill="${state.colors[1]}"/>`);
  if(st===3){const s=sortStops(state.ramp),x0=44,y0=H-34,w=220;defs.push(`<linearGradient id="rl${uid}">${Array.from({length:17},(_,i)=>`<stop offset="${n(i/16)}" stop-color="${hexOf(rampAt(state.ramp,i/16))}"/>`).join('')}</linearGradient>`);
   parts.push(`<g><rect x="${x0-4}" y="${y0-4}" width="${w+8}" height="22" fill="#000" opacity=".55"/><rect x="${x0}" y="${y0}" width="${w}" height="10" fill="url(#rl${uid})"/>${s.map(([c,q])=>`<path d="M${n(x0+q*w)} ${y0+10}v6" stroke="#fff" stroke-width="1.4"/>`).join('')}</g>`);}
  if(st===4){if(p.grain>0)defs.push(`<pattern id="gn${p.seed}" patternUnits="userSpaceOnUse" width="128" height="128"><image href="${tile('grain',p.seed)}" width="128" height="128"/></pattern>`);
   const sp=sparkSVG(state,aps,uid,defs);feat.sparkles=p.sparkles;parts.push(sp);
   // Overlay grain carries the texture in the mid-tones; a faint normal copy dithers near-black and near-white, where overlay vanishes and banding shows.
   if(p.grain>0)parts.push(`<rect width="${W}" height="${H}" fill="url(#gn${p.seed})" opacity="${n(p.grain)}" style="mix-blend-mode:overlay"/><rect width="${W}" height="${H}" fill="url(#gn${p.seed})" opacity="${n(p.grain*.15*1000)/1000}"/>`);
   if(p.inset>0)parts.push(`<path d="M0 0H${W}V${H}H0ZM${p.inset} ${p.inset}V${H-p.inset}H${W-p.inset}V${p.inset}Z" fill="${state.colors[1]}" fill-rule="evenodd"/>`);
   parts.push(copySVG(state));}}
 return {defs:defs.join(''),body:parts.join(''),features:feat};}

export function render(input={}){const state=resolve(input),uid=uidOf(state),d=draw(state,uid),label={1:'aperture mask',2:'falloff field',3:'gradient map',4:'poster'}[state.stage];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(state.title.replaceAll('/',' / '))} — glow apertures, ${state.family}, ${label}</title><defs>${d.defs}</defs>${d.body}</svg>`;
 return {svg,state,width:W,height:H,features:{...d.features,stage:state.stage}};}

// Every shape in the chosen style: eleven small posters (no copy) and the ramp.
export function specimen(input={}){const state=resolve(input),cols=4,cw=240,chh=340,gap=18,lab=24,shapes=OPTIONS.shape,w=cols*cw+(cols+1)*gap,h=3*(chh+lab)+4*gap,ink=lum(state.colors[0])>.3?'#222':'#ddd',seen=new Set();let defs='',body='';
 shapes.forEach((sh,i)=>{const s={...state,shape:sh,stage:4,title:'',info:'',params:{...state.params,count:state.layout==='stacked'||state.layout==='beam'?state.params.count:1}},uid=uidOf(s)+'s'+i,d=draw(s,uid),x=gap+(i%cols)*(cw+gap),y=gap+Math.floor(i/cols)*(chh+lab+gap);
  // Noise tiles are shared by id across cells.
  defs+=d.defs.replace(/<pattern id="(gn|hz)\d+"[\s\S]*?<\/pattern>/g,m=>{const id=m.match(/id="([^"]+)"/)[1];if(seen.has(id))return '';seen.add(id);return m;});
  body+=`<g data-shape="${sh}"><svg x="${x}" y="${y}" width="${cw}" height="${chh}" viewBox="0 0 ${W} ${H}" overflow="hidden">${d.body}</svg><text x="${x}" y="${y+chh+17}" font-size="13" fill="${ink}" font-family="${FONT}">${SHAPE_NAMES[sh]}</text></g>`;});
 const x=gap+3*(cw+gap),y=gap+2*(chh+lab+gap),s=sortStops(state.ramp);
 body+=`<g data-ramp="1"><linearGradient id="spr${uidOf(state)}" x1="0" y1="1" x2="0" y2="0">${Array.from({length:17},(_,i)=>`<stop offset="${n(i/16)}" stop-color="${hexOf(rampAt(state.ramp,i/16))}"/>`).join('')}</linearGradient><rect x="${x}" y="${y}" width="${cw}" height="${chh}" fill="url(#spr${uidOf(state)})"/>${s.map(([c,q])=>`<rect x="${x+cw-46}" y="${n(y+chh-(q*chh)-10)}" width="34" height="20" fill="${c}" stroke="#fff" stroke-width="1.5"/>`).join('')}<text x="${x}" y="${y+chh+17}" font-size="13" fill="${ink}" font-family="${FONT}">Ramp · ${s.length} stops</text></g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${state.colors[0]}"/><defs>${defs}</defs>${body}</svg>`;}
