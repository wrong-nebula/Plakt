/* Hørde DarkMatter — a wedge, quarter-disc and fine-joint type system.
 * After the poster credited to Hørde + Altiplano Typefaces. Every glyph is built
 * from one part: a block whose corners are square, chamfered (a wedge) or rounded
 * (a quarter-disc). Ink blocks are united, counter blocks removed and fine joints
 * cut as hairlines, so the SVG is plain filled paths. A pocket fills an open
 * counter with a 45° wedge of dark matter whose edge runs on through the next
 * stem as a joint, as in the source H. The measured HØR / DE collage is kept as
 * the 'source' layout; the other layouts set any text.
 * v1 (poster contours and a stroke-painted extension alphabet) is engine-v1.mjs.
 */
import ClipperLib from 'clipper-lib';
import {K,union,minus,intersect,offset,open,close,toPath,area} from '../punkt-capsule-system/geometry.mjs';
import {LABELS} from './labels.mjs';
const {ClipperOffset,JoinType,EndType}=ClipperLib;
export const SOURCE={id:'b773e557a16bff5f7e18bda5-p0',title:'Hørde DarkMatter',credit:'Hørde + Altiplano Typefaces',url:'https://www.instagram.com/p/CX242GtsQqm/',quad:[[282,117],[817,161],[817,965],[281,971]],field:[700,1100]};
// Ground / figure / specimen. Source colours are median samples of the rectified photograph.
export const PALETTES=[
 {id:'source',name:'Source yellow / ink',colors:['#fad54d','#222127','#f7f2dc']},
 {id:'ice',name:'Ice blue / midnight',colors:['#c6dbe8','#182b40','#f4f7fa']},
 {id:'lilac',name:'Lilac / aubergine',colors:['#b8aae3','#30243e','#f3eefa']},
 {id:'rose',name:'Rose / oxblood',colors:['#e9acb7','#532c3a','#fff5f4']},
 {id:'acid',name:'Acid / carbon',colors:['#0d0f10','#d6ff3d','#0d0f10']},
 {id:'signal',name:'Signal / black',colors:['#0b0b0c','#ff5b23','#0b0b0c']},
 {id:'mint',name:'Mint / forest',colors:['#bfe3cf','#163a2c','#f2faf5']},
 {id:'sand',name:'Sand / umber',colors:['#e8d5b5','#3b281c','#fbf6ee']},
 {id:'uv',name:'Ultraviolet / ink',colors:['#110d1f','#9d80ff','#110d1f']}
];
export const FAMILIES=[
 {id:'wedges',name:'Wedges & quarter-discs',palette:'ice',note:'Straight wedges and circular quarter-discs meet through fine joints. The closest construction to the reference.'},
 {id:'scooped',name:'Scooped diagonals',palette:'lilac',note:'Every diagonal bends into a concave scoop: wedges, pockets and joints follow the same rule.'},
 {id:'stepped',name:'Terraced quadrants',palette:'rose',note:'Diagonals and arcs become terraces of one module, so every letter steps at the same size.'},
 {id:'faceted',name:'Faceted quarters',palette:'mint',note:'Every quarter-disc is cut into straight facets; at one facet each curve becomes a wedge.'},
 {id:'ogee',name:'Ogee diagonals',palette:'sand',note:'Every diagonal swings into an S-curve. Wedges, pockets, joints and hatching all swing the same way.'},
 {id:'soft',name:'Softened masses',palette:'uv',note:'Every corner of the finished mass is rounded, outside and in, while joints and marks stay sharp.'}
];
// Treatments act on finished letters in every edge system and layout.
export const TREATMENTS=[
 {id:'solid',name:'Solid',note:'Plain masses.'},
 {id:'inline',name:'Inline',note:'A hairline runs inside every mass, parallel to its edge: the fine joint turned into a contour.'},
 {id:'outline',name:'Outline',note:'Only a band along each edge remains; counters, pockets and joints keep their places.'},
 {id:'hatched',name:'45° hatching',note:'Hairlines at 45°, aligned across the whole format, cut every mass. The edge system bends or steps them too.'},
 {id:'sliced',name:'Glitch slices',note:'Each line of letters is cut into horizontal slices that shift sideways in turn.'},
 {id:'shadow',name:'45° shadow',note:'Each mass casts a solid extrusion down and to the right, in a tone between figure and ground.'}
];
export const LAYOUTS=[
 {id:'source',name:'HØR / DE source collage',note:'The measured poster composition for HØRDE. Other text is packed.'},
 {id:'packed',name:'Packed masses',note:'Letters fill the format edge to edge, separated only by the fine joint, as the source masses are.'},
 {id:'rows',name:'Even rows',note:'Letters keep their proportions in centred rows with letter spacing.'}
];
// Every format is 1100 units tall, so joints and terraces keep one physical size.
export const FORMATS=[
 {id:'poster',name:'Source poster 7:11',width:700,height:1100},
 {id:'a-series',name:'A series',width:778,height:1100},
 {id:'square',name:'Square',width:1100,height:1100},
 {id:'story',name:'Story 9:16',width:619,height:1100},
 {id:'landscape',name:'Landscape 16:9',width:1956,height:1100}
];
export const CONTROLS=[
 {key:'stem',group:'construction',label:'Stem weight',min:22,max:42,step:.5,value:32},
 {key:'chamfer',group:'construction',label:'Corner wedge',min:0,max:44,step:.5,value:28},
 {key:'roundness',group:'construction',label:'Quarter-disc fullness',min:.65,max:1.2,step:.01,value:1},
 {key:'aperture',group:'construction',label:'Counter aperture',min:.72,max:1.16,step:.01,value:1},
 {key:'fill',group:'construction',label:'Dark-matter fill',min:0,max:1,step:.01,value:.8},
 {key:'joint',group:'construction',label:'Fine joint width',min:1,max:10,step:.25,value:6},
 {key:'bend',group:'construction',label:'Diagonal scoop',min:.04,max:.22,step:.01,value:.12,family:'scooped'},
 {key:'terrace',group:'construction',label:'Terrace module',min:6,max:30,step:1,value:13,family:'stepped'},
 {key:'facets',group:'construction',label:'Facets per quarter',min:1,max:5,step:1,value:2,family:'faceted'},
 {key:'swing',group:'construction',label:'Ogee swing',min:.03,max:.18,step:.01,value:.09,family:'ogee'},
 {key:'soften',group:'construction',label:'Corner softening',min:.1,max:.6,step:.01,value:.32,family:'soft'},
 {key:'width',group:'setting',label:'Letter width',min:.6,max:1.5,step:.01,value:1},
 {key:'tracking',group:'setting',label:'Letter spacing',min:0,max:.3,step:.005,value:.06},
 {key:'leading',group:'setting',label:'Line gap',min:0,max:.4,step:.01,value:.08},
 {key:'interlock',group:'setting',label:'Interlock',min:0,max:1,step:.01,value:.6},
 {key:'inset',group:'treatment',label:'Line inset',min:3,max:40,step:.5,value:12,treatment:['inline','outline']},
 {key:'pitch',group:'treatment',label:'Hatch spacing',min:10,max:60,step:1,value:24,treatment:['hatched']},
 {key:'slices',group:'treatment',label:'Slices per line',min:2,max:7,step:1,value:3,treatment:['sliced']},
 {key:'shift',group:'treatment',label:'Slice shift',min:4,max:60,step:1,value:20,treatment:['sliced']},
 {key:'depth',group:'treatment',label:'Shadow depth',min:6,max:90,step:1,value:30,treatment:['shadow']}
];
// Whether a control can change the current rendering. The editor disables the rest.
export function applies(key,state){
 const c=CONTROLS.find(c=>c.key===key),source=layoutOf(state)==='source';
 if(c.family&&c.family!==state.family)return false;
 if(c.treatment)return c.treatment.includes(state.treatment)&&state.stage>=3;
 // The source collage keeps its measured contours; only its construction strip follows the alphabet.
 if(key==='stem'||key==='chamfer')return !source||state.stage===4;
 if(key==='fill')return source?state.stage===4:state.stage>=3;
 if(key==='aperture'||key==='joint')return state.stage>=3;
 if(key==='width'||key==='tracking'||key==='leading')return layoutOf(state)==='rows';
 if(key==='interlock')return layoutOf(state)==='packed'&&state.stage>=2;
 return true;
}
export const layoutOf=state=>state.layout==='source'&&!['HØRDE','HORDE'].includes(state.text)?'packed':state.layout;

/* ---- Parts --------------------------------------------------------------
 * Glyphs are drawn in letter units: 100 tall, adv × 100 wide. A corner is a
 * number (a chamfer of that size), {r} (a quarter-disc of that radius) — both in
 * letter-height units, so they stay 45° and circular when a frame is stretched —
 * an [x,y] chamfer in frame units, or 'c' / 'r', a wedge or quarter-disc that
 * spans the whole block. */
const B=(x0,y0,x1,y1,corners={})=>({box:[x0,y0,x1,y1],corners}),P=(...points)=>({points}),rd=r=>({r});
const all=v=>({tl:v,tr:v,br:v,bl:v}),wedgeV=(x0,y0,x1,y1,up)=>{const m=(x0+x1)/2;return up?[B(x0,y0,m,y1,{tl:'c'}),B(m,y0,x1,y1,{tr:'c'})]:[B(x0,y0,m,y1,{bl:'c'}),B(m,y0,x1,y1,{br:'c'})];};
// Pockets: an open counter whose open side is partly filled; the fill rises toward
// the 'from' wall at 45°, and its edge runs on through the opposite stem as a joint.
const pocket=(x0,y0,x1,y1,open,from)=>({box:[x0,y0,x1,y1],open,from});
export function guides(p){return {s:p.stem,b:Math.round(p.stem*.62*2)/2,c:p.chamfer};}
export const GLYPHS={
 A:({s,b})=>({adv:1,ink:[B(0,0,100,100,{tl:44,tr:44})],cut:[...wedgeV(s,22,100-s,58,true),B(s,58+b,100-s,100)]}),
 B:({s,b,c})=>({adv:1,ink:[B(0,0,96,53,{tl:c,tr:rd(40),br:rd(20)}),B(0,47,100,100,{tr:rd(24),br:rd(44)})],cut:[B(s,b,96-s*.86,53-b/2,{tr:'r'}),B(s,53+b/2,100-s*.86,100-b,{tr:'r'})]}),
 C:({s,b,c})=>({adv:.96,ink:[B(0,0,96,100,{tl:rd(48),bl:rd(48),tr:c*.5,br:c*.5})],cut:[B(s,b+4,96,96-b,{tl:rd(22),bl:rd(22)})]}),
 D:({s,b,c})=>({adv:1,ink:[B(0,0,100,100,{tl:c,tr:rd(34),br:rd(58)})],cut:[B(s,0,100-s*.9,100-b,{tr:'r'})]}),
 // E and F arms are pockets too: the fill closes each arm's end and its edge runs on through the bar.
 E:({s,b})=>({adv:.88,ink:[B(0,0,88,100)],cut:[B(80,b,88,100-b)],pocket:[pocket(s+4,b,88,50-b/2,'r','b'),pocket(s+4,50+b/2,88,100-b,'r','t')]}),
 F:({s,b,c})=>({adv:.86,ink:[B(0,0,86,100,{tl:c})],cut:[B(s+4,50+b/2,86,100),B(74,b,86,100)],pocket:[pocket(s+4,b,86,50-b/2,'r','b')]}),
 G:({s,b,c})=>({adv:1,ink:[B(0,0,100,100,{tl:rd(48),bl:rd(48),tr:c*.5})],cut:[B(s,b+4,100,52,{tl:rd(22)}),B(s,51,100-s,96-b,{bl:rd(22)})]}),
 H:({s,b})=>({adv:1,ink:[B(0,0,100,100)],cut:[B(s,0,100-s,26)],pocket:[pocket(s,26+b,100-s,100,'b','r')]}),
 I:({s,b})=>({adv:.64,ink:[B(0,0,64,100)],cut:[B(0,b,32-s/2,100-b),B(32+s/2,b,64,100-b)]}),
 J:({s,b})=>({adv:.88,ink:[B(0,0,88,100,{bl:rd(36),br:rd(44)})],cut:[B(0,0,88-s,94-b,{br:rd(20)})]}),
 K:({s})=>({adv:1,ink:[B(0,0,100,100)],cut:[B(s,0,100-s*.9,46,{br:'c'}),...wedgeH(s+22,22,100,78,'l'),B(s,54,100-s*.9,100,{tr:'c'})]}),
 L:({s,b})=>({adv:.82,ink:[B(0,0,82,100)],cut:[B(s+2,0,82,98-b)]}),
 M:({s})=>({adv:1.24,ink:[B(0,0,124,100)],cut:[...wedgeV(s*.8,0,124-s*.8,52,false),B(s,36,50,100,{tr:'c'}),B(74,36,124-s,100,{tl:'c'})]}),
 N:({s})=>({adv:1,ink:[B(0,0,100,100)],cut:[B(s,0,100-s,62,{bl:'c'}),B(s,38,100-s,100,{tr:'c'})]}),
 O:({s,b})=>({adv:1,ink:[B(0,0,100,100,{tl:rd(58),br:rd(58)})],cut:[B(s,b+4,100-s,96-b,{tl:rd(34),br:rd(34)})]}),
 'Ø':({s})=>({adv:1.04,ink:[B(0,0,104,100)],cut:[B(s*.7,s*.7,104-s*.7-16,100-s*.7-16,{br:'c'}),B(s*.7+16,s*.7+16,104-s*.7,100-s*.7,{tl:'c'})]}),
 P:({s,b,c})=>({adv:.94,ink:[B(0,0,94,64,{tl:c,tr:rd(36),br:rd(28)}),B(0,0,s,100,{tl:c})],cut:[B(s,0,94-s*.85,64-b,{tr:'r'})]}),
 Q:({s,b})=>({adv:1,ink:[B(0,0,100,100,{tl:rd(58)})],cut:[B(s,b+4,100-s,96-b,{tl:rd(34),br:rd(34)})],joint:[[[56,56],[100,100]]]}),
 R:({s,c})=>({adv:1,ink:[B(0,0,s,100,{tl:c}),B(0,0,100,58,{tl:c,tr:rd(44),br:rd(24)}),P([s,58],[100-s*.9,58],[100,100],[66,100])],cut:[B(s,0,100-s*.9,58,{tr:'r'})]}),
 S:({s,b,c})=>({adv:.96,ink:[B(0,0,96,100,{tl:rd(46),br:rd(46),tr:c*.5,bl:c*.5})],cut:[B(s,b,96,52-b/2,{tl:rd(20)}),B(0,48+b/2,96-s,100-b,{br:rd(20)})]}),
 T:({s,b})=>({adv:.96,ink:[B(0,0,96,100)],cut:[B(0,b+4,48-s/2,100),B(48+s/2,b+4,96,100)]}),
 U:({s,b})=>({adv:1,ink:[B(0,0,100,100,{bl:rd(44),br:rd(44)})],cut:[B(s,0,100-s,96-b,{bl:rd(22),br:rd(22)})]}),
 V:({s})=>({adv:1,ink:[P([0,0],[100,0],[64,100],[36,100])],cut:wedgeV(s,0,100-s,66,false)}),
 W:({s})=>({adv:1.28,ink:[B(0,0,128,100,{bl:16,br:16})],cut:[B(s,0,52,64,{br:'c'}),B(76,0,128-s,64,{bl:'c'}),...wedgeV(34,46,94,100,true)]}),
 X:({s})=>({adv:1,ink:[B(0,0,100,100)],cut:[...wedgeV(s*.9,0,100-s*.9,40,false),...wedgeV(s*.9,60,100-s*.9,100,true),...wedgeH(0,s*.9,40,100-s*.9,'r'),...wedgeH(60,s*.9,100,100-s*.9,'l')]}),
 Y:({s})=>({adv:1,ink:[B(0,0,100,100)],cut:[...wedgeV(s*.9,0,100-s*.9,46,false),B(0,58,50-s/2,100,{tr:18}),B(50+s/2,58,100,100,{tl:18})]}),
 Z:({s,b})=>({adv:.96,ink:[B(0,0,96,100)],cut:[B(0,b,96-s*.8,86-b,{br:'c'}),B(s*.8,b+14,96,100-b,{tl:'c'})]}),
 '0':({s,b})=>({adv:.82,ink:[B(0,0,82,100,all(rd(41)))],cut:[B(s,b+2,82-s,98-b,all(rd(14)))]}),
 '1':({s})=>({adv:.62,ink:[B(62-s,0,62,100),B(0,0,62-s,40,{tl:'c'})]}),
 '2':({s,b})=>({adv:.92,ink:[B(0,0,92,100,{tr:rd(40)})],cut:[B(0,b,92-s,58,{tr:'r'}),B(s*.7,46,92,100-b,{tl:'c'})]}),
 '3':({s,b})=>({adv:.9,ink:[B(0,0,90,100,{tr:rd(36),br:rd(40)})],cut:[B(0,b,90-s,50-b/2,{tr:rd(16)}),B(0,50+b/2,90-s,100-b,{br:rd(16)}),B(0,49-b/2,27,51+b/2)]}),
 '4':({s,b})=>({adv:.96,ink:[B(0,0,96,100)],cut:[B(0,0,82-s,60,{br:'c'}),B(24,28,82-s,62,{tl:'c'}),B(0,62+b,82-s,100),B(82,62+b,96,100)]}),
 '5':({s,b})=>({adv:.9,ink:[B(0,0,90,100,{br:rd(40)})],cut:[B(s,b,90,52-b/2),B(0,52+b/2,90-s,100-b,{br:rd(16)})]}),
 '6':({s,b})=>({adv:.92,ink:[B(0,0,92,100,{tl:rd(44),bl:rd(40),br:rd(40)})],cut:[B(s,b,92,44,{tl:rd(16)}),B(s,44+b,92-s,100-b,all(rd(13)))]}),
 '7':({s,b})=>({adv:.88,ink:[P([0,0],[88,0],[88,b+4],[50,100],[50-s,100],[86-s*1.25,b+4],[0,b+4])]}),
 '8':({s,b})=>({adv:.9,ink:[B(0,0,90,100,{tl:rd(30),tr:rd(30),bl:rd(40),br:rd(40)})],cut:[B(s,b,90-s,50-b/2,all(rd(10))),B(s,50+b/2,90-s,100-b,all(rd(14)))]}),
 '9':({s,b})=>({adv:.92,ink:[B(0,0,92,100,{tl:rd(40),tr:rd(40),br:rd(44)})],cut:[B(s,b,92-s,56-b,all(rd(13))),B(0,56,92-s,100-b,{br:rd(16)})]}),
 // Nordic letters. Æ joins the A's diagonal to the E's arms; marks are incised, since every
 // letter fills the full height: umlaut dots are square holes, the ring a cut annulus.
 'Æ':({s,b})=>({adv:1.36,ink:[B(0,0,136,100,{tl:44})],cut:[B(s,22,70,58,{tl:'c'}),B(s,58+b,70,100),B(128,b,136,100-b)],pocket:[pocket(70+s*.75,b,136,50-b/2,'r','b'),pocket(70+s*.75,50+b/2,136,100-b,'r','t')]}),
 'Å':g=>mark(GLYPHS.A(g),ring(50,12,7.5)),
 'Ä':g=>mark(GLYPHS.A(g),dots(42,58,9,7)),
 'Ö':g=>mark(GLYPHS.O(g),dots(38,62,7,8)),
 'Ü':g=>mark(GLYPHS.U(g),dots(g.s/2,100-g.s/2,8,Math.min(8,g.s*.3))),
 '.':()=>({adv:.36,ink:[B(0,64,36,100,{tl:12})]}),
 '-':({s})=>({adv:.6,ink:[B(0,50-s*.36,60,50+s*.36)]}),
 '+':({s})=>({adv:.8,ink:[B(0,50-s*.36,80,50+s*.36),B(40-s*.36,12,40+s*.36,88)]}),
 '!':()=>({adv:.36,ink:[P([0,0],[36,0],[28,68],[8,68]),B(0,78,36,100,{tl:10})]}),
 ' ':()=>({adv:.34,ink:[]})
};
const dots=(x1,x2,y,d)=>({marks:[B(x1-d/2,y,x1+d/2,y+d),B(x2-d/2,y,x2+d/2,y+d)]}),ring=(cx,cy,r,t=2.6)=>({marks:[B(cx-r,cy-r,cx+r,cy+r,all('r'))],inlay:[B(cx-r+t,cy-r+t,cx+r-t,cy+r-t,all('r'))]});
const mark=(glyph,m)=>({...glyph,marks:m.marks,inlay:m.inlay??[]});
// A wedge pointing sideways: two right-angle blocks sharing the mid line, apex 'l' or 'r'.
function wedgeH(x0,y0,x1,y1,apex){const m=(y0+y1)/2;return apex==='l'?[B(x0,y0,x1,m,{tl:'c'}),B(x0,m,x1,y1,{bl:'c'})]:[B(x0,y0,x1,m,{tr:'c'}),B(x0,m,x1,y1,{br:'c'})];}
export const CHARACTERS=Object.keys(GLYPHS).filter(c=>c!==' ');

// Source paths use the rectified photograph's coordinate field. The overlapping
// H / Ø / R masses and the lower D / E have deliberately unequal sizes.
export const SOURCE_GLYPHS=[
 {ch:'H',body:['M16 0H105V131H188V0H275V470H16Z'],cuts:[]},
 {ch:'Ø',body:['M274 16H685V310L604 400L470 543V662H594V744H16V455L274 184Z'],cuts:[{d:'M275 218H427L275 383Z',anchor:[326,273]},{d:'M251 543L470 307V543Z',anchor:[397,464]}]},
 {ch:'R',body:['M480 551L554 469V662H480Z','M554 469L604 400C654 400 691 430 691 480C691 519 674 545 638 555H554Z','M556 555H638L700 813H650Z'],cuts:[{d:'M554 469C602 469 640 507 640 555H554Z',anchor:[554,555]}]},
 {ch:'D',body:['M16 846L106 744H341C359 777 368 813 368 850C368 907 342 957 294 991C284 1042 268 1078 197 1078H16Z'],cuts:[{d:'M106 744C258 744 305 818 305 919C305 945 301 971 294 991H106Z',anchor:[106,991]}]},
 {ch:'E',body:['M369 662H594V744H456V824H583V906H456V991H594V1077H369Z'],cuts:[]}
];
export const SOURCE_JOINTS=[{between:'H / Ø',construction:'One continuous negative pocket ending in a diagonal strip.'},{between:'Ø / R',construction:'Offset the R stem from the shared Ø edge.'}];

/* ---- Geometry ----------------------------------------------------------- */
const n=x=>+x.toFixed(2),KAPPA=.5523;
// A loop is a start point and L / C segments in poster units.
function blockLoop([x0,y0,x1,y1],corners,f,keep=[]){
 const X0=f.ox+x0*f.sx,X1=f.ox+x1*f.sx,Y0=f.oy+y0*f.sy,Y1=f.oy+y1*f.sy,w=X1-X0,h=Y1-Y0,e={};
 if(w<=.01||h<=.01)return null;
 // Softened masses: every square corner becomes a quarter-disc of one radius, except the
 // corners beside a whole-block wedge or disc, and a counter's corners on the letter's edge
 // (rounding those would leave ears at the opening), or corners that sit on another part
 // of the same kind (two wedge halves of one counter would leave a keyhole).
 const at={tl:[X0,Y0],tr:[X1,Y0],br:[X1,Y1],bl:[X0,Y1]},near={tl:['tr','bl'],tr:['tl','br'],br:['tr','bl'],bl:['tl','br']},whole=v=>v==='c'||v==='r';
 const onEdge=([x,y])=>f.frame&&(Math.abs(x-f.frame[0])<.5||Math.abs(x-f.frame[2])<.5||Math.abs(y-f.frame[1])<.5||Math.abs(y-f.frame[3])<.5);
 for(const k of ['tl','tr','br','bl']){const v=!corners[k]&&f.soft&&!keep.includes(k)&&!near[k].some(c=>whole(corners[c]))&&!(f.kind==='cut'&&onEdge(at[k]))?{soft:true}:corners[k];
  e[k]=!v?{x:0,y:0}:v.soft?{x:f.soft,y:f.soft,round:true}:v==='c'?{x:w,y:h}:v==='r'?{x:w,y:h,round:true}:Array.isArray(v)?{x:v[0]*f.sx,y:v[1]*f.sy}:typeof v==='object'?{x:v.r*f.sy,y:v.r*f.sy,round:true}:{x:v*f.sy,y:v*f.sy};
  const k0=Math.min(1,w/(e[k].x||1),h/(e[k].y||1));e[k].x*=k0;e[k].y*=k0;}
 // Two corners on one edge share it; each shrinks evenly, keeping its angle.
 for(const [a,b,d,len] of [['tl','tr','x',w],['bl','br','x',w],['tl','bl','y',h],['tr','br','y',h]]){const sum=e[a][d]+e[b][d];if(sum>len){for(const c of [a,b]){e[c].x*=len/sum;e[c].y*=len/sum;}}}
 const segs=[],start=[X0+e.tl.x,Y0],line=p=>segs.push({t:'L',p}),corner=(c,to,cp)=>{if(!e[c].x&&!e[c].y)return;if(e[c].round){const from=segs.length?segs.at(-1).p:start;segs.push({t:'C',c1:from.map((z,j)=>z+(cp[j]-z)*KAPPA),c2:to.map((z,j)=>z+(cp[j]-z)*KAPPA),p:to});}else line(to);};
 line([X1-e.tr.x,Y0]);corner('tr',[X1,Y0+e.tr.y],[X1,Y0]);line([X1,Y1-e.br.y]);corner('br',[X1-e.br.x,Y1],[X1,Y1]);line([X0+e.bl.x,Y1]);corner('bl',[X0,Y1-e.bl.y],[X0,Y1]);line([X0,Y0+e.tl.y]);corner('tl',[X0+e.tl.x,Y0],[X0,Y0]);
 return {start,segs};
}
function partLoop(part,f,kind){
 if(part.box)return blockLoop(part.box,part.corners,kind?{...f,kind}:{...f,soft:0},part.keep);
 const pts=part.points.map(([x,y])=>[f.ox+x*f.sx,f.oy+y*f.sy]);return {start:pts[0],segs:[...pts.slice(1),pts[0]].map(p=>({t:'L',p}))};
}
function pathLoops(d){
 const tokens=d.match(/[A-Z]|-?(?:\d*\.)?\d+/g),arity={M:2,L:2,H:1,V:1,C:6,Z:0},loops=[];let i=0,x=0,y=0,loop=null;
 while(i<tokens.length){const cmd=tokens[i++],v=tokens.slice(i,i+arity[cmd]).map(Number);i+=arity[cmd];
  if(cmd==='M'){loop={start:[v[0],v[1]],segs:[]};loops.push(loop);[x,y]=v;}
  else if(cmd==='Z'){if(x!==loop.start[0]||y!==loop.start[1])loop.segs.push({t:'L',p:loop.start});[x,y]=loop.start;}
  else if(cmd==='C'){loop.segs.push({t:'C',c1:v.slice(0,2),c2:v.slice(2,4),p:v.slice(4)});[x,y]=v.slice(4);}
  else{const p=cmd==='H'?[v[0],y]:cmd==='V'?[x,v[0]]:v;loop.segs.push({t:'L',p});[x,y]=p;}}
 return loops;
}
// The family rule acts on poster-unit edges: orthogonal edges stay; diagonals are
// straight, scooped, S-curved (ogee) or terraced; arcs are smooth, faceted or
// terraced. Terraces use one module for every edge.
function edge(out,a,s,t){
 const [x,y]=a,[X,Y]=s.p,dx=X-x,dy=Y-y,len=Math.hypot(dx,dy),fam=t.family;
 const stairs=pts=>{for(const q of pts){out.push([q[0],out.at(-1)[1]],q);}};
 if(s.t==='C'){
  const c1=s.c1.map((z,j)=>{const l=a[j]+(s.p[j]-a[j])/3;return l+(z-l)*t.roundness;}),c2=s.c2.map((z,j)=>{const l=a[j]+(s.p[j]-a[j])*2/3;return l+(z-l)*t.roundness;});
  const at=u=>{const v=1-u;return [0,1].map(j=>v*v*v*a[j]+3*v*v*u*c1[j]+3*v*u*u*c2[j]+u*u*u*s.p[j]);};
  if(fam==='stepped'){const k=Math.max(2,Math.round(len*1.15/t.terrace));stairs(Array.from({length:k},(_,i)=>at((i+1)/k)));}
  else if(fam==='faceted'){for(let i=1;i<=t.facets;i++)out.push(at(i/t.facets));}
  else{const k=Math.max(6,Math.ceil(len/4));for(let i=1;i<=k;i++)out.push(at(i/k));}
 }else if(Math.abs(dx)>.5&&Math.abs(dy)>.5&&['scooped','ogee','stepped'].includes(fam)){
  if(fam==='ogee'){const sign=dx>=0?1:-1,nx=-dy*t.swing*sign,ny=dx*t.swing*sign,c1=[x+dx/3+nx,y+dy/3+ny],c2=[x+dx*2/3-nx,y+dy*2/3-ny],k=Math.max(10,Math.ceil(len/4));for(let i=1;i<=k;i++){const u=i/k,v=1-u;out.push([0,1].map(j=>v*v*v*a[j]+3*v*v*u*c1[j]+3*v*u*u*c2[j]+u*u*u*s.p[j]));}}
  else if(fam==='scooped'){const sign=dx>=0?1:-1,cx=(x+X)/2-dy*t.bend*sign,cy=(y+Y)/2+dx*t.bend*sign,k=Math.max(8,Math.ceil(len/4));for(let i=1;i<=k;i++){const u=i/k,v=1-u;out.push([v*v*x+2*v*u*cx+u*u*X,v*v*y+2*v*u*cy+u*u*Y]);}}
  else{const k=Math.max(1,Math.round(Math.max(Math.abs(dx),Math.abs(dy))/t.terrace));stairs(Array.from({length:k},(_,i)=>[x+dx*(i+1)/k,y+dy*(i+1)/k]));}
 }else out.push(s.p);
}
function trace(loop,t){const out=[loop.start];let a=loop.start;for(const s of loop.segs){edge(out,a,s,t);a=s.p;}return out;}
// Paths are oriented positively before any boolean: with nonzero filling, a part
// wound the other way would cancel where it overlaps, leaving slivers.
const clip=pts=>{const p=pts.map(([x,y])=>({X:Math.round(x*K),Y:Math.round(y*K)}));return [area(p)<0?p.reverse():p];};
const solid=(loops,t)=>loops.length?union(...loops.map(l=>clip(trace(l,t)))):[];
// A joint is an open polyline cut as a hairline with square (butt) ends; open ends
// run past the letter so the cut leaves it cleanly.
function band(points,ends,width,t){
 const p=points.map(q=>[...q]),over=width+3,ext=(i,j)=>{const d=Math.hypot(p[i][0]-p[j][0],p[i][1]-p[j][1])||1;p[i]=[p[i][0]+(p[i][0]-p[j][0])/d*over,p[i][1]+(p[i][1]-p[j][1])/d*over];};
 if(ends[0]==='o')ext(0,1);if(ends[1]==='o')ext(p.length-1,p.length-2);
 const line=[p[0]];for(let i=1;i<p.length;i++)edge(line,p[i-1],{t:'L',p:p[i]},t);
 const o=new ClipperOffset(3,.05*K),out=[];o.AddPath(line.map(([x,y])=>({X:Math.round(x*K),Y:Math.round(y*K)})),JoinType.jtMiter,EndType.etOpenButt);o.Execute(out,width/2*K);return out;
}
// Pocket geometry in poster units: u runs across the counter toward the 'from'
// wall, v runs in depth toward the opening. The floor starts on the from-wall at
// depth (1 − fill) and falls at 45°; past the opposite wall it is a joint.
function pocketCut(p,f,fr,t){
 const [x0,y0,x1,y1]=p.box,X0=f.ox+x0*f.sx,X1=f.ox+x1*f.sx,Y0=f.oy+y0*f.sy,Y1=f.oy+y1*f.sy,vert=p.open==='b'||p.open==='t';
 const eu=vert?[p.from==='r'?1:-1,0]:[0,p.from==='b'?1:-1],ev=vert?[0,p.open==='b'?1:-1]:[p.open==='r'?1:-1,0];
 const ox=(eu[0]||ev[0])>0?X0:X1,oy=(eu[1]||ev[1])>0?Y0:Y1,Wn=vert?X1-X0:Y1-Y0,D=vert?Y1-Y0:X1-X0;
 const U=vert?(eu[0]>0?X0-fr.x:fr.x+fr.w-X1):(eu[1]>0?Y0-fr.y:fr.y+fr.h-Y1),at=(u,v)=>[ox+eu[0]*u+ev[0]*v,oy+eu[1]*u+ev[1]*v];
 const vP=D*(1-t.fill),vL=vP+Wn;
 if(t.fill<.02)return {loop:loopOf([at(0,0),at(Wn,0),at(Wn,D),at(0,D)])};
 if(vL>=D-.5)return {loop:loopOf([at(0,0),at(Wn,0),at(Wn,vP),at(Wn-(D-vP),D),at(0,D)])};
 // The joint is only cut where it crosses the whole opposite stem with half a counter-width
 // to spare; one that would leave through the counter's open end would only nick off a
 // sliver of the arm or foot, so the fill stays a plain wedge.
 const open=D-vL+(vert?(p.open==='b'?fr.y+fr.h-Y1:Y0-fr.y):(p.open==='r'?fr.x+fr.w-X1:X0-fr.x));
 if(open<U+Wn/2)return {loop:loopOf([at(0,0),at(Wn,0),at(Wn,vP),at(0,vL)])};
 const reach=U;
 // The joint stops at the from-wall: its square end would otherwise nick that stem.
 return {loop:loopOf([at(0,0),at(Wn,0),at(Wn,vP),at(0,vL)]),joint:{points:[at(Wn,vP),at(0,vL),at(-reach,vL+reach)],ends:'co',limit:loopOf([at(-1e4,-1e4),at(Wn,-1e4),at(Wn,1e4),at(-1e4,1e4)])}};
}
const loopOf=pts=>({start:pts[0],segs:[...pts.slice(1),pts[0]].map(p=>({t:'L',p}))});
// Counters scale about the middle of the edge they open onto, or their centre.
function scaled(part,a,W){
 if(a===1)return part;const bx=part.box??[Math.min(...part.points.map(p=>p[0])),Math.min(...part.points.map(p=>p[1])),Math.max(...part.points.map(p=>p[0])),Math.max(...part.points.map(p=>p[1]))];
 const ax=bx[0]<=0&&bx[2]<W?bx[0]:bx[2]>=W&&bx[0]>0?bx[2]:(bx[0]+bx[2])/2,ay=bx[1]<=0&&bx[3]<100?bx[1]:bx[3]>=100&&bx[1]>0?bx[3]:(bx[1]+bx[3])/2;
 const sx=x=>ax+(x-ax)*a,sy=y=>ay+(y-ay)*a;
 if(part.points)return {...part,points:part.points.map(([x,y])=>[sx(x),sy(y)])};
 const corners=Object.fromEntries(Object.entries(part.corners??{}).map(([k,v])=>[k,typeof v==='number'?v*a:v?.r?{r:v.r*a}:v]));
 return {...part,box:[sx(bx[0]),sy(bx[1]),sx(bx[2]),sy(bx[3])],corners};
}
// Joints and terraces keep one poster size on display letters and shrink with small ones.
const detail=h=>Math.max(.08,Math.min(1,h/200));
export function glyphParts(ch,frame,params,family){
 const g=guides(params),r=GLYPHS[ch](g),W=r.adv*100,f0={ox:frame.x,oy:frame.y,sx:frame.w/W,sy:frame.h/100},k=detail(frame.h);
 const f={...f0,frame:[frame.x,frame.y,frame.x+frame.w,frame.y+frame.h],soft:family==='soft'?params.soften*params.stem*Math.min(f0.sx,f0.sy):0};
 const t={...params,joint:params.joint*k,terrace:params.terrace*k};
 const pockets=(r.pocket??[]).map(p=>pocketCut(scaled(p,params.aperture,W),f,frame,t));
 // Corners of a part that lie on another part of the same list stay square when softened.
 const bound=q=>q.box??[Math.min(...q.points.map(v=>v[0])),Math.min(...q.points.map(v=>v[1])),Math.max(...q.points.map(v=>v[0])),Math.max(...q.points.map(v=>v[1]))];
 const shared=list=>list.map((q,i)=>!q.box?q:{...q,keep:Object.entries({tl:[q.box[0],q.box[1]],tr:[q.box[2],q.box[1]],br:[q.box[2],q.box[3]],bl:[q.box[0],q.box[3]]}).filter(([,[x,y]])=>list.some((o,j)=>{if(j===i)return false;const [a,b,c,d]=bound(o);return x>=a-.01&&x<=c+.01&&y>=b-.01&&y<=d+.01;})).map(([k])=>k)});
 const cuts=shared((r.cut??[]).map(q=>scaled(q,params.aperture,W)));
 return {t,ink:shared(r.ink).map(p=>partLoop(p,f,'ink')).filter(Boolean),marks:(r.marks??[]).map(p=>partLoop(scaled(p,params.aperture,W),f)).filter(Boolean),inlay:(r.inlay??[]).map(p=>partLoop(scaled(p,params.aperture,W),f)).filter(Boolean),cut:cuts.map(p=>partLoop(p,f,'cut')).filter(Boolean),pockets,
  joints:[...(r.joint??[]).map(pts=>({points:pts.map(([x,y])=>[f.ox+x*f.sx,f.oy+y*f.sy]),ends:'oo'})),...pockets.filter(p=>p.joint).map(p=>p.joint)]};
}
// Isolated specks smaller than a few joint widths — or than one terrace step — are
// dropped, never left as crumbs.
function tidy(shape,min){return shape.filter(p=>Math.abs(area(p))>=min);}
const crumb=(t,frame)=>Math.max(3*t.joint*t.joint,t.family==='stepped'?1.5*t.terrace*t.terrace:0,.0015*frame.w*frame.h);
// Counters are cut first; marks and joints after them, sharp in every system.
export function glyphShape(ch,frame,params,family,stage=3){
 const parts=glyphParts(ch,frame,params,family),t={...parts.t,family};let shape=solid(parts.ink,t);
 if(stage<3)return shape;
 const counters=[...parts.cut.map(l=>clip(trace(l,t))),...parts.pockets.map(p=>clip(trace(p.loop,t)))],sharp=[...parts.marks.map(l=>clip(trace(l,t))),...parts.joints.map(j=>j.limit?intersect(band(j.points,j.ends,t.joint,t),clip(trace(j.limit,{family:'wedges'}))):band(j.points,j.ends,t.joint,t))];
 if(counters.length)shape=minus(shape,union(...counters));if(sharp.length)shape=minus(shape,union(...sharp));
 if(parts.inlay.length)shape=union(shape,solid(parts.inlay,t));return tidy(shape,crumb(t,frame));
}

/* ---- State -------------------------------------------------------------- */
export function normalizeText(v,fallback=''){
 const s=String(v??fallback).normalize('NFC').toUpperCase().replace(/ß|ẞ/g,'SS').replace(/[^\x00-\x7FÆØÅÄÖÜ]/g,c=>c.normalize('NFKD').replace(/\p{M}/gu,'')).replace(/\s*\/\s*/g,'/').replace(/\/{2,}/g,'/').replace(/^\/|\/$/g,'').replace(/ +/g,' ').trim();
 if(!s.replace(/[ /]/g,''))throw new Error('Enter at least one letter or number.');
 if(!/^[A-ZÆØÅÄÖÜ0-9 .\-+!/]+$/.test(s))throw new Error('Use A–Z, Æ Ø Å Ä Ö Ü, numbers, spaces and . - + ! — a / starts a new line.');
 if(s.split('/').length>5)throw new Error('Use up to five lines.');
 if(s.replace(/[ /]/g,'').length>36)throw new Error('Keep the text to 36 characters or fewer.');
 return s;
}
const color=(x,f)=>/^#[a-f\d]{6}$/i.test(x??'')?x.toLowerCase():f;
export function resolve(input={}){
 // v1 rules: 'word' becomes text; terraces per edge became an absolute module.
 const v1=input.engine==='darkmatter-v1',family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],params={};
 for(const c of CONTROLS){if(v1&&c.key==='terrace')continue;const v=Number(input.params?.[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:c.value));if(c.step>=1)params[c.key]=Math.round(params[c.key]);}
 for(const c of CONTROLS)if(!(c.key in params))params[c.key]=c.value;
 const text=normalizeText(input.text??input.word,'HØRDE'),canonical=['HØRDE','HORDE'].includes(text);
 const palette=PALETTES.find(p=>p.id===input.palette)?.id??family.palette,base=PALETTES.find(p=>p.id===palette).colors;
 return {engine:'darkmatter-v2',version:2,text,layout:LAYOUTS.some(l=>l.id===input.layout)?input.layout:v1&&!canonical?'packed':'source',format:FORMATS.some(f=>f.id===input.format)?input.format:'poster',
  family:family.id,treatment:TREATMENTS.some(t=>t.id===input.treatment)?input.treatment:'solid',params,palette,colors:base.map((c,i)=>color(input.colors?.[i],c)),invert:!!input.invert,stage:Math.max(1,Math.min(4,Math.round(Number(input.stage)||4)))};
}
export function effectiveColors(state){const inv=c=>'#'+c.slice(1).match(/../g).map(v=>(255-parseInt(v,16)).toString(16).padStart(2,'0')).join('');return state.invert?[state.colors[1],state.colors[0],inv(state.colors[2])]:state.colors;}

/* ---- Setting ------------------------------------------------------------ */
const ADVANCES=Object.fromEntries(Object.entries(GLYPHS).map(([c,g])=>[c,g(guides({stem:32,chamfer:28})).adv])),advance=ch=>ADVANCES[ch];
/* Rows come from '/', otherwise from the best break. Packed rows aim for the
 * source's tall letters (about 0.62 wide per unit of height); even rows aim for
 * the largest letters. Breaking between words is free, inside a word it costs a
 * little; a space inside a row is a gap. */
const rowSum=row=>[...row].reduce((s,c)=>s+advance(c),0);
function partitions(units,r){if(r===1)return [[units]];const out=[];for(let i=1;i<=units.length-r+1;i++)for(const rest of partitions(units.slice(i),r-1))out.push([units.slice(0,i),...rest]);return out;}
export function breakRows(text,aspect,setting){
 if(text.includes('/'))return text.split('/').map(r=>r.trim()).filter(Boolean);
 const chars=[...text],n=chars.length,letters=chars.filter(c=>c!==' ').length;let best=null;
 if(!setting){
  // Packed: each row costs the squared log stretch of its letters from source proportions.
  for(let r=1;r<=Math.min(5,letters);r++){
   const dp=Array.from({length:n+1},()=>Array(r+1).fill(null));dp[0][0]={cost:0,rows:[]};
   for(let i=0;i<n;i++)for(let k=0;k<r;k++){const prev=dp[i][k];if(!prev)continue;
    for(let j=i+1;j<=n;j++){const row=chars.slice(i,j).join('').trim();if(!row)continue;
     const cost=prev.cost+Math.log(aspect*r/rowSum(row)/.62)**2+(j<n&&chars[j]!==' '&&chars[j-1]!==' '?.3:0),next=j<n&&chars[j]===' '?j+1:j;
     if(!dp[next][k+1]||cost<dp[next][k+1].cost)dp[next][k+1]={cost,rows:[...prev.rows,row]};}}
   const done=dp[n][r];if(done){const score=done.cost/r+.03*r;if(!best||score<best.score-1e-9)best={score,rows:done.rows};}
  }
  return best.rows;
 }
 // Even rows: the break that sets the largest letters, between words where there are several.
 const words=text.split(' '),units=words.length>1?words:chars,join=words.length>1?' ':'',inner=words.length>1?0:1;
 for(let r=1;r<=Math.min(5,units.length);r++){
  const options=units.length<=13?partitions(units,r):[Array.from({length:r},(_,i)=>units.slice(Math.round(i*units.length/r),Math.round((i+1)*units.length/r)))];
  for(const p of options){const rows=p.map(u=>u.join(join)),ems=rows.map(row=>rowSum(row)*setting.width+setting.tracking*([...row].length-1)),e=Math.min(aspect/Math.max(...ems),1/(r+(r-1)*setting.leading)),score=-Math.log(e)+inner*.12*(r-1);
   if(!best||score<best.score-1e-9)best={score,rows};}
 }
 return best.rows;
}
/* Optical spacing for even rows. Each letter's ink profile — the distance from each side
 * of its frame to the first ink in 24 bands — comes from the live construction. A pair
 * closes up by part of its average opening, so L|A or T|Y lose the hole between them,
 * but never by more than leaves 35% of the letter spacing at the closest point. */
const profiles=new Map();
function profile(ch,p){
 const key=ch+[p.stem,p.chamfer,p.aperture,p.fill,p.roundness,p.joint].join();if(profiles.has(key))return profiles.get(key);
 const n=24,h=200,w=advance(ch)*h,left=Array(n).fill(Infinity),right=Array(n).fill(Infinity);
 for(const path of glyphShape(ch,{x:0,y:0,w,h},p,'wedges',3))for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];
  for(let k=0;k<n;k++){const y=(k+.5)*h/n*K;if(a.Y===b.Y||(a.Y-y)*(b.Y-y)>0)continue;const x=(a.X+(b.X-a.X)*(y-a.Y)/(b.Y-a.Y))/K;left[k]=Math.min(left[k],x/h);right[k]=Math.min(right[k],(w-x)/h);}}
 if(profiles.size>600)profiles.clear();const out={left,right};profiles.set(key,out);return out;
}
export function kern(a,b,p){
 if(a===' '||b===' ')return 0;const A=profile(a,p),B=profile(b,p),gaps=A.right.map((r,k)=>(r+B.left[k])*p.width),near=Math.min(...gaps);
 const open=gaps.reduce((s,g)=>s+Math.min(g,.35),0)/gaps.length;return Math.min(0,Math.max(-.6*open,-(near+.65*p.tracking)));
}
const BAND=46;
export function pageOf(state){
 const layout=layoutOf(state),format=layout==='source'?FORMATS[0]:FORMATS.find(f=>f.id===state.format);
 return {layout,width:format.width,height:format.height,margin:layout==='rows'?44:16,band:layout==='source'?0:BAND};
}
export function layoutFrames(state,page=pageOf(state)){
 const m=page.margin,W=page.width-2*m,H=page.height-2*m-page.band,p=state.params,rows=breakRows(state.text,W/H,page.layout==='rows'?p:null),frames=[];
 if(page.layout==='packed'){
  const gap=p.joint,rh=(H-gap*(rows.length-1))/rows.length;
  rows.forEach((row,i)=>{const chars=[...row],sum=chars.reduce((s,c)=>s+advance(c),0),unit=(W-gap*(chars.length-1))/sum;let x=m;
   chars.forEach(c=>{const w=advance(c)*unit;if(c!==' ')frames.push({ch:c,row:i,x,y:m+i*(rh+gap),w,h:rh});x+=w+gap;});});
 }else{
  const kerns=rows.map(row=>[...row].map((c,k,a)=>k+1<a.length?kern(c,a[k+1],p):0)),ems=rows.map((row,i)=>[...row].reduce((s,c)=>s+advance(c)*p.width,0)+p.tracking*([...row].length-1)+kerns[i].reduce((s,v)=>s+v,0)),e=Math.min(W/Math.max(...ems),H/(rows.length+(rows.length-1)*p.leading)),top=m+(H-e*(rows.length+(rows.length-1)*p.leading))/2;
  rows.forEach((row,i)=>{let x=m+(W-ems[i]*e)/2;[...row].forEach((c,k)=>{const w=advance(c)*p.width*e;if(c!==' ')frames.push({ch:c,row:i,x,y:top+i*e*(1+p.leading),w,h:e});x+=w+(p.tracking+kerns[i][k])*e;});});
 }
 return frames;
}

/* ---- Interlock ----------------------------------------------------------
 * Neighbours in a packed row meet along a stepped joint, as the source masses do.
 * The boundary between two letters jogs sideways by d at 45°. Each letter's edge
 * ink is extruded into the ground it gains and cut back where it gives ground
 * away. A step is only taken where the ink each letter gives away is a clean slice of
 * a straight stem — shaving a bowl or a chamfer would leave a flat facet — and the
 * ground it gains is filled by a whole stem or not at all. Of three
 * step heights and two directions, the step that removes least ink wins, so a stem
 * steps into a T's or L's empty corner before it cuts a stem. */
const box=(x0,y0,x1,y1)=>clip([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]),sum=shape=>shape.reduce((s,p)=>s+area(p),0);
// A clean slice is a rectangle, less the 45° corner the jog takes when a stem spans it.
const clean=(lost,d)=>lost.every(p=>{const xs=p.map(q=>q.X),ys=p.map(q=>q.Y),bb=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))/K/K;return area(p)>=.98*bb-d*d/8;});
// Straight vertical spans of a letter's side, merged; only stems (over a third of the
// row) count — a bowl's short flat side extruded would read as a tab.
function edgeSpans(shape,x,h){
 const spans=[];for(const p of shape)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(Math.abs(a.X/K-x)<.05&&Math.abs(b.X/K-x)<.05)spans.push([Math.min(a.Y,b.Y)/K,Math.max(a.Y,b.Y)/K]);}
 spans.sort((u,v)=>u[0]-v[0]);const merged=[];for(const s of spans){const last=merged.at(-1);if(last&&s[0]<=last[1]+.05)last[1]=Math.max(last[1],s[1]);else merged.push([...s]);}
 return merged.filter(([y0,y1])=>y1-y0>=h/3);
}
// The ground a letter gains is either left empty or filled by one stem that covers
// all of it, so the stem shifts sideways; anything in between rejects the step.
function gain(spans,[g0,g1]){const hit=spans.filter(([y0,y1])=>y1>g0+1&&y0<g1-1);return !hit.length?[]:hit.length===1&&hit[0][0]<=g0+1&&hit[0][1]>=g1-1?hit:null;}
export function letterShapes(state,frames){
 const p=state.params,shapes=frames.map(fr=>glyphShape(fr.ch,fr,p,state.family,state.stage));
 if(layoutOf(state)!=='packed'||p.interlock<=0)return shapes;
 for(let i=0;i+1<frames.length;i++){
  const a=frames[i],b=frames[i+1];if(a.row!==b.row||b.x-(a.x+a.w)>p.joint*1.5)continue;
  const k=detail(a.h),j=p.joint*k,t={...p,family:state.family,terrace:p.terrace*k},d=p.interlock*p.stem*Math.min(a.w/advance(a.ch),b.w/advance(b.ch))/100;
  if(d<2)continue;
  const xb=(a.x+a.w+b.x)/2,top=a.y,bot=a.y+a.h,A=shapes[i],B=shapes[i+1],areaA=sum(A),areaB=sum(B),spansA=edgeSpans(A,a.x+a.w,a.h),spansB=edgeSpans(B,b.x,a.h);let best=null;
  for(const fy of [.28,.5,.72])for(const sg of [1,-1]){
   const ym=top+a.h*fy,line=[[xb-sg*d/2,top-60],[xb-sg*d/2,ym-d/2],[xb+sg*d/2,ym+d/2],[xb+sg*d/2,bot+60]];
   const left=clip(trace(loopOf([[xb-1e4,top-60],...line,[xb-1e4,bot+60]]),t)),right=clip(trace(loopOf([[xb+1e4,top-60],...line,[xb+1e4,bot+60]]),t)),cut=band(line,'oo',j,t);
   const gA=gain(spansA,sg>0?[ym-d/2,bot]:[top,ym+d/2]),gB=gain(spansB,sg>0?[top,ym+d/2]:[ym-d/2,bot]);if(!gA||!gB)continue;
   const xA=a.x+a.w,xB=b.x,extA=gA.map(([y0,y1])=>box(xA-1,y0,xA+d,y1)).flat(),extB=gB.map(([y0,y1])=>box(xB-d,y0,xB+1,y1)).flat();
   const keptA=intersect(A,left),keptB=intersect(B,right),nextA=minus(intersect(union(A,extA),left),cut),nextB=minus(intersect(union(B,extB),right),cut);
   if(!clean(minus(A,left),d)||!clean(minus(B,right),d))continue;
   const removed=areaA-sum(keptA)+areaB-sum(keptB),gained=sum(nextA)+sum(nextB)-sum(keptA)-sum(keptB);
   // Equal choices alternate along the row, so repeated stems do not all step alike.
   const score=removed-.5*gained+(fy===(i%2?.28:.72)?0:1e-3*a.w*a.h)+(sg===(i%2?-1:1)?0:5e-4*a.w*a.h);
   if(!best||score<best.score)best={score,A:nextA,B:nextB};
  }
  if(!best)continue;const min=crumb({...t,joint:j},a);shapes[i]=tidy(best.A,min);shapes[i+1]=tidy(best.B,min);
 }
 return shapes;
}

/* ---- Treatments ---------------------------------------------------------
 * Applied to each finished letter after interlock (or to the whole source collage).
 * Lengths are poster units, scaled with letter size like the joint. Hatching runs
 * on one 45° grid for the whole format, so its lines continue from letter to letter. */
const moved=(shape,dx,dy)=>shape.map(p=>p.map(q=>({X:q.X+Math.round(dx*K),Y:q.Y+Math.round(dy*K)})));
function inset(shape,d,round){if(d<=0)return shape;const o=new ClipperOffset(4,.05*K),out=[];o.AddPaths(shape,round?JoinType.jtRound:JoinType.jtMiter,EndType.etClosedPolygon);o.Execute(out,-d*K);return out;}
// The swept area of a shape moved along (dx, dy): its start, its end and every edge's path between.
function sweep(shape,dx,dy){const quads=[];for(const p of shape)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];quads.push(clip([[a.X/K,a.Y/K],[b.X/K,b.Y/K],[b.X/K+dx,b.Y/K+dy],[a.X/K+dx,a.Y/K+dy]]));}return union(shape,moved(shape,dx,dy),...quads);}
export function treat(shape,state,frame,page){
 const p=state.params,k=detail(frame.h),t={...p,family:state.family,terrace:p.terrace*k},hair=p.joint*k,area=box(page.margin,page.margin,page.width-page.margin,page.height-page.margin-page.band),round=state.family==='soft';
 if(!shape.length||state.stage<3)return {shape,shadow:[]};
 switch(state.treatment){
  case 'inline':{const d=p.inset*k;return {shape:minus(shape,minus(inset(shape,d,round),inset(shape,d+hair,round))),shadow:[]};}
  case 'outline':return {shape:minus(shape,inset(shape,p.inset*k,round)),shadow:[]};
  case 'hatched':{
   const xs=shape.flatMap(q=>q.map(v=>v.X/K)),ys=shape.flatMap(q=>q.map(v=>v.Y/K)),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),step=p.pitch*k*Math.SQRT2,lines=[];
   for(let c=Math.floor((x0+y0)/step)*step;c<=x1+y1+step;c+=step)lines.push(band([[c-y1-hair,y1+hair],[c-y0+hair,y0-hair]],'oo',hair,t));
   return {shape:tidy(minus(shape,union(...lines)),crumb({...t,joint:hair},frame)),shadow:[]};}
  case 'sliced':{
   const n=p.slices,h=frame.h/n,parts=[];for(let i=0;i<n;i++){const piece=intersect(shape,box(-1e4,frame.y+i*h+(i?hair/2:-1e4),1e4,frame.y+(i+1)*h-(i<n-1?hair/2:-1e4)));parts.push(moved(piece,(i%2?.5:-.5)*p.shift*k,0));}
   return {shape:intersect(union(...parts),area),shadow:[]};}
  case 'shadow':{const d=p.depth*k/Math.SQRT2;return {shape,shadow:intersect(minus(sweep(shape,d,d),shape),area)};}
  default:return {shape,shadow:[]};
 }
}
// The shadow tone sits halfway between figure and ground.
const mix=(a,b,u)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-u)+parseInt(b.slice(i,i+2),16)*u).toString(16).padStart(2,'0')).join('');

/* ---- Drawing ------------------------------------------------------------ */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const rect=(x,y,w,h,c)=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}"/>`;
const fillPath=(shape,c,extra='')=>shape.length?`<path d="${toPath(shape)}" fill="${c}"${extra}/>`:'';
const strokeLoop=(l,t,c,extra='')=>`<path d="${toPath(clip(trace(l,t)))}" fill="none" stroke="${c}" stroke-width=".7"${extra}/>`;
function label(text,x,y,w,h,color){const chars=[...text.toUpperCase()],step=w/Math.max(1,chars.length);return chars.map((ch,i)=>{let d=LABELS[ch];if(ch==='Ø')d=LABELS.O+'M18 100L8 90L82 0L92 10Z';return d?`<g transform="translate(${n(x+i*step)} ${n(y)}) scale(${n(step*.89/100)} ${n(h/100)})"><path d="${d}" fill="${color}" fill-rule="evenodd"/></g>`:'';}).join('');}
// Small glyphs in one line of width w: advances proportional, a thin gap between letters.
function setLine(text,x,y,w,h,state,color){const chars=[...text],sum=chars.reduce((s,c)=>s+advance(c),0),gap=h*.16,unit=(w-gap*(chars.length-1))/sum;let s='',cx=x;for(const c of chars){const gw=advance(c)*unit;if(c!==' ')s+=fillPath(glyphShape(c,{x:cx,y,w:gw,h},state.params,state.family),color);cx+=gw+gap;}return s;}
// The module key: block, wedge, quarter-disc and joint, drawn by the same kernel.
function modules(x,y,size,state,ink){
 const t={...state.params,family:state.family},k={...t,joint:Math.max(1,t.joint*.4),terrace:t.terrace*.3},f=(i)=>({ox:x+(i%2)*(size+9),oy:y+Math.floor(i/2)*(size+9),sx:size/100,sy:size/100});
 const shapes=[solid([blockLoop([0,0,100,100],{},f(0))],k),solid([blockLoop([0,0,100,100],{tr:'c'},f(1))],k),solid([blockLoop([0,0,100,100],{tr:'r'},f(2))],k),minus(solid([blockLoop([0,0,100,100],{},f(3))],k),band([[f(3).ox,f(3).oy+size],[f(3).ox+size,f(3).oy]],'oo',k.joint,k))];
 return shapes.map(s=>fillPath(s,ink)).join('');
}
function sourceScaffold(state,ink,caption){
 let s=label('HØRDE',606,27,76,13,caption);
 s+=label('DARKMATTER',26,676,80,8,caption)+label('ABCDEFGHIJKLMNOPQRSTUVWXYZ',26,694,270,14,caption)+label('HØRDE ALTIPLANO TYPEFACES',26,713,265,12,caption)+label('0123456789',26,730,108,12,caption)+label('CONSTRUCTION',316,676,100,8,caption);
 s+=setLine('ABCDEFGHIJKLMNOPQRSTUVWXYZ',316,692,272,14,state,caption)+setLine('HØRDE ALTIPLANO',316,711,190,13,state,caption)+setLine('0123456789',316,729,128,12,state,caption);
 s+=label('STUDY AFTER',379,1016,124,12,caption)+label('HØRDE + ALTIPLANO',379,1035,198,12,caption)+label('WEDGES AND DISCS',379,1054,181,12,caption)+label('MODULES',607,980,77,7,ink)+modules(607,994,31,state,ink);
 return s;
}
function footer(page,state,ink){const y=page.height-page.margin-page.band+16,h=11;return label('STUDY AFTER HØRDE + ALTIPLANO',page.margin,y+6,Math.min(330,page.width*.5),h,ink)+modules(page.width-page.margin-58,y,12.5,state,ink)+label('MODULES',page.width-page.margin-128,y+8,60,7,ink);}
function sourceShape(state,stage,t){
 const j=state.params.joint;let shape=[];
 for(const original of SOURCE_GLYPHS){
  const body=original.ch==='R'?[`M${n(470+j*1.5)} ${n(543+j*1.3)}L554 469V662H${n(470+j*1.5)}Z`,...original.body.slice(1)]:original.body;
  let g=solid(body.flatMap(pathLoops),t);
  if(stage>=3&&original.cuts.length){const a=state.params.aperture;g=minus(g,union(...original.cuts.flatMap(c=>pathLoops(c.d).map(l=>clip(trace(l,t).map(([x,y])=>[c.anchor[0]+(x-c.anchor[0])*a,c.anchor[1]+(y-c.anchor[1])*a]))))));}
  shape=union(shape,g);
 }
 // Softened: the measured masses are rounded outside only, so the fine gaps never close.
 if(state.family==='soft')shape=open(shape,state.params.soften*60);
 if(stage>=3)shape=minus(shape,clip(trace(pathLoops(`M106 216H188V267L16 ${n(448+j*.7)}V${n(448-j*.7)}L106 350Z`)[0],t)));
 return shape;
}
export function render(input={}){
 const state=resolve(input),page=pageOf(state),[paper,ink,caption]=effectiveColors(state),t={...state.params,family:state.family};let body='',frames=[];
 if(page.layout==='source'){
  if(state.stage===1){for(const g of SOURCE_GLYPHS){for(const d of g.body)for(const l of pathLoops(d))body+=strokeLoop(l,t,ink);for(const c of g.cuts)for(const l of pathLoops(c.d))body+=strokeLoop(l,t,ink,' stroke-dasharray="4 3"');}for(const y of [216,543,744,991])body+=`<path d="M16 ${y}H684" fill="none" stroke="${ink}" stroke-width=".45" opacity=".35"/>`;}
  else{const {shape,shadow}=treat(sourceShape(state,state.stage,t),state,{x:0,y:0,w:700,h:1100},{...page,margin:0});body+=fillPath(shadow,mix(ink,paper,.5))+fillPath(shape,ink);}
  if(state.stage===4)body+=sourceScaffold(state,ink,caption);frames=SOURCE_GLYPHS.map(g=>({ch:g.ch}));
 }else{
  frames=layoutFrames(state,page);
  for(const fr of frames){
   if(state.stage===1){const parts=glyphParts(fr.ch,fr,state.params,state.family),tt={...parts.t,family:state.family};body+=`<rect x="${n(fr.x)}" y="${n(fr.y)}" width="${n(fr.w)}" height="${n(fr.h)}" fill="none" stroke="${ink}" stroke-width=".45" opacity=".35"/>`;
    for(const l of [...parts.ink,...parts.inlay])body+=strokeLoop(l,tt,ink);for(const l of [...parts.cut,...parts.pockets.map(p=>p.loop)])body+=strokeLoop(l,tt,ink,' stroke-dasharray="4 3"');
    for(const j of parts.joints)body+=`<path d="M${j.points.map(p=>p.map(n).join(' ')).join('L')}" fill="none" stroke="${ink}" stroke-width=".7" stroke-dasharray="1.5 2"/>`;}
  }
  if(state.stage>=2){const done=letterShapes(state,frames).map((s,i)=>treat(s,state,frames[i],page));body+=fillPath(union(...done.map(d=>d.shadow)),mix(ink,paper,.5));frames.forEach((fr,i)=>{body+=`<g data-glyph="${esc(fr.ch)}">${fillPath(done[i].shape,ink)}</g>`;});}
  if(state.stage===4)body+=footer(page,state,ink);
 }
 const desc=`${state.text.replaceAll('/',' / ')}. ${FAMILIES.find(f=>f.id===state.family).name}, ${TREATMENTS.find(x=>x.id===state.treatment).name.toLowerCase()}, ${LAYOUTS.find(l=>l.id===page.layout).name.toLowerCase()}. Stage ${state.stage}. Type system after Hørde + Altiplano.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-label="${esc(desc)}"><title>${esc(state.text.replaceAll('/',' '))} — wedges and quarter-discs</title><desc>${esc(desc)}</desc>${rect(0,0,page.width,page.height,paper)}${body}</svg>`;
 return {svg,state,width:page.width,height:page.height,frames,features:{family:state.family,treatment:state.treatment,stage:state.stage,layout:page.layout,format:page.layout==='source'?'poster':state.format,characters:state.text.replace(/[ /]/g,'').length,rows:page.layout==='source'?2:new Set(frames.map(f=>f.row)).size}};
}
// The whole character set at one size, for the editor and the specimen proofs.
export function specimen(input={},lines=['ABCDEFGHIJKLM','NOPQRSTUVWXYZ','ÆØÅÄÖÜ.-+!','0123456789']){
 const state=resolve(input),[paper,ink]=effectiveColors(state),h=110,gap=14,lh=h+26,em=lines.map(l=>[...l].reduce((s,c)=>s+advance(c),0)*h+gap*([...l].length-1)),W=Math.ceil(Math.max(...em))+48,H=lines.length*lh+22;
 const page={width:W,height:H,margin:0,band:0};let s=rect(0,0,W,H,paper),shadows=[];lines.forEach((line,i)=>{let x=24;for(const c of line){const w=advance(c)*h,fr={x,y:24+i*lh,w,h},{shape,shadow}=treat(glyphShape(c,fr,state.params,state.family),state,fr,page);s+=fillPath(shape,ink);shadows.push(shadow);x+=w+gap;}});
 s=s.replace(/(<rect[^>]*\/>)/,'$1'+fillPath(union(...shadows),mix(ink,paper,.5)));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}
