/* Pablo Nouvelle / Neubad — capsule type system.
 * After the poster credited to Enea Bortone. Each glyph is an assembly of a few
 * shared parts (rounded rectangles and wedges) placed on common guides. Seams are
 * declared lines between parts: closed ends stop short and leave a bridge, open
 * ends run out of the letter, joined ends meet another seam. The measured Neubad
 * composition is kept as the 'source' layout; every other layout sets any text.
 */
export const SOURCE={id:'ab7f2e333f83fb9410cd302d-p0',title:'Pablo Nouvelle / Neubad',credit:'Enea Bortone',url:'https://www.instagram.com/p/Cpmx6fiIHBs/',crop:[278,168,821,930],field:[543,762]};
export const FAMILIES=[
 {id:'incised',name:'Incised capsules',palette:'Cool white / carbon',colors:['#f5f7f8','#111419'],note:'Solid parts with single hairline seams. The closest construction to the reference.'},
 {id:'twin',name:'Twin incisions',palette:'Petrol / ice',colors:['#19384b','#bcdfec'],note:'Each seam becomes a parallel pair. The parts, guides and layout stay the same.'},
 {id:'offset',name:'Offset halves',palette:'Sage / aubergine',colors:['#d1ddd1','#4e2a4c'],note:'Split each finished glyph through its middle and displace the two halves along the line.'}
];
export const LAYOUTS=[
 {id:'up',name:'Columns reading up',note:'Each line becomes a column read from the bottom; the first line sits on the left.'},
 {id:'down',name:'Columns reading down',note:'Each line becomes a column read from the top; the first line sits on the right.'},
 {id:'rows',name:'Rows',note:'Horizontal lines, first line at the top.'},
 {id:'source',name:'Neubad source layout',note:'The measured poster composition. Takes exactly two lines; the date, venue and ornaments stay fixed.'}
];
// A cut re-proportions the alphabet. Compressed narrows every glyph and caps how tall a
// round corner may be relative to its width, so bowls become stadiums with round ends
// instead of pinched ellipses.
export const CUTS=[
 {id:'regular',name:'Regular',advance:1,roundCap:Infinity},
 // The poster's ampersand is a drawing, not parts; squeezed to 64% it collapses, so it keeps more width.
 {id:'compressed',name:'Compressed',advance:.64,roundCap:1.1,keep:{'&':.82}}
];
const cutOf=id=>CUTS.find(c=>c.id===id)??CUTS[0];
export const cutAdvance=(ch,cut)=>{const c=cutOf(cut);return c.keep?.[ch]??c.advance;};
export const FITS=[
 {id:'fill',name:'Fill each line',note:'Letters stretch so every line runs the full length.'},
 {id:'even',name:'Even letter size',note:'Every letter keeps the set width; lines end where their text ends.'}
];
export const CONTROLS=[
 {key:'seam',group:'construction',label:'Seam width',min:.006,max:.14,step:.001,value:.018},
 {key:'bridge',group:'construction',label:'Bridge at closed seams',min:0,max:.2,step:.005,value:.09},
 {key:'stem',group:'construction',label:'Stem / bowl split',min:.36,max:.64,step:.01,value:.5},
 {key:'square',group:'construction',label:'Bowl squareness',min:0,max:1,step:.01,value:.45},
 {key:'aperture',group:'construction',label:'Aperture notch',min:0,max:.3,step:.01,value:.16},
 {key:'width',group:'setting',label:'Letter width',min:.6,max:1.6,step:.01,value:1},
 {key:'tracking',group:'setting',label:'Letter spacing',min:0,max:.2,step:.005,value:.055},
 {key:'leading',group:'setting',label:'Line gap',min:0,max:.5,step:.01,value:.06},
 {key:'offset',group:'setting',label:'Half displacement',min:0,max:.06,step:.001,value:.022}
];
// Whether a control can change the current rendering. The editor disables the rest.
export function applies(key,state){
 if(key==='width'||key==='leading')return state.layout!=='source';
 if(key==='offset')return state.family==='offset'&&state.stage>=4;
 if(key==='seam'||key==='bridge'||key==='aperture')return state.stage>=4;
 if(key==='square')return state.stage>=2;
 return true;
}
// Mid line and ascender/descender depth are fixed; the stem split is the control.
export const GUIDES={m:.5,d:.22};
export function guides(params){return {s:params?.stem??.5,m:GUIDES.m,d:GUIDES.d};}
// Corner values are fractions of the free edge: 1 = fully round, [x,y] = separate extents.
const N=[.12,.06]; // a small rounding that leaves a notch where an arch meets its stem
const R=(x0,y0,x1,y1,corners=[0,0,0,0])=>({kind:'round-rect',box:[x0,y0,x1,y1],corners});
const P=(...points)=>({kind:'polygon',points});
const S=(ends,...points)=>({ends,points});
const Q=(ends,a,control,b)=>({ends,points:[a,control,b],curve:true});
const disc=()=>R(0,0,1,1,[1,1,1,1]),stemBowl=g=>[R(0,0,g.s,1),R(g.s,0,1,1,[0,1,1,0])];
// Seam ends: c = closed (inset by the bridge), o = open (exits the letter),
// v = open with an aperture notch, j = joined (meets another seam exactly).
export const GLYPHS={
 a:g=>({advance:1,parts:[R(0,0,1,g.m,[.35,1,0,0]),R(0,g.m,1-g.s+.1,1,[1,0,0,1]),R(1-g.s,g.m,1,1)],seams:[S('oo',[0,g.m],[1,g.m]),S('cc',[1-g.s,g.m],[1-g.s,1])]}),
 b:g=>({advance:1,parts:[R(0,0,g.s,1),R(g.s,g.d,1,1,[0,1,1,0])],seams:[S('cc',[g.s,g.d],[g.s,1]),Q('cj',[0,g.d+.1],[g.s*.54,g.d-.015],[g.s-.01,g.d+.01])]}),
 c:()=>({advance:1,parts:[disc()],seams:[S('cv',[.34,.5],[1,.5])]}),
 d:g=>({advance:1,parts:stemBowl(g),seams:[S('cc',[g.s,0],[g.s,1])]}),
 e:()=>({advance:1,parts:[disc()],seams:[S('cv',[0,.52],[1,.52]),S('cc',[.5,0],[.5,.52])]}),
 f:g=>({advance:.85,parts:[R(0,0,g.s+.08,1),R(0,0,1,.29),R(g.s+.08,.48,.9,.72)],seams:[S('co',[0,.29],[g.s+.08,.29]),S('cc',[g.s,.48],[g.s,1])]}),
 g:()=>({advance:1,parts:[disc()],seams:[S('cc',[.52,0],[.52,1]),S('jo',[.52,.55],[1,.55]),S('co',[.65,.78],[1,.78])]}),
 h:g=>({advance:1,parts:[R(0,0,g.s,1),R(g.s,g.d+.03,1,1,[N,[.88,.3],0,0])],seams:[S('co',[g.s,g.d+.03],[g.s,1])]}),
 i:g=>({advance:.42,parts:[R(0,0,1,1)],seams:[S('oo',[0,g.d],[1,g.d])]}),
 j:g=>({advance:.8,parts:[R(1-g.s-.05,0,1,1,[0,0,[1,.35],0]),R(0,.65,1-g.s+.1,1)],seams:[S('cc',[1-g.s,0],[1-g.s,.65]),S('cc',[0,.69],[1,.69])]}),
 k:g=>({advance:1,parts:[R(0,0,1,1)],seams:[S('cc',[g.s,0],[g.s,1]),S('jo',[g.s+.03,.49],[1,.06]),S('jo',[g.s+.03,.51],[1,.95])]}),
 l:()=>({advance:.55,parts:[R(0,0,1,1)],seams:[]}),
 m:()=>({advance:1.25,parts:[R(0,0,1/3,1),R(1/3,0,2/3,1,[N,N,0,0]),R(2/3,0,1,1,[N,[.88,.25],0,0])],seams:[S('co',[1/3,0],[1/3,1]),S('co',[2/3,0],[2/3,1])]}),
 n:g=>({advance:1,parts:[R(0,0,g.s,1),R(g.s,0,1,1,[N,[.88,.3],0,0])],seams:[S('co',[g.s,0],[g.s,1])]}),
 o:()=>({advance:1,parts:[disc()],seams:[S('cc',[.5,0],[.5,1])]}),
 p:g=>({advance:1,parts:[R(0,0,g.s,1),R(g.s,0,1,1-g.d,[0,1,1,0])],seams:[S('cc',[g.s,0],[g.s,1-g.d]),S('co',[0,1-g.d],[g.s,1-g.d])]}),
 q:g=>({advance:1,parts:[R(0,0,1,1,[1,[1,.5],0,[.6,1]])],seams:[S('cc',[1-g.s,0],[1-g.s,1]),S('co',[.57,.735],[1,.99])]}),
 r:g=>({advance:.92,parts:[R(0,0,g.s,1),R(g.s,0,1,.59,[N,[.88,.6],0,0])],seams:[S('cc',[g.s,0],[g.s,.59])]}),
 s:()=>({advance:1,parts:[disc()],seams:[S('oc',[0,.34],[.9,.34]),S('co',[.1,.67],[1,.67])]}),
 t:()=>({advance:.8,parts:[R(.16,0,.78,1,[0,0,0,[1,.25]]),R(0,.27,1,.53),R(.6,.82,1,1)],seams:[S('co',[.11,.4],[1,.4]),S('cc',[.52,.49],[.52,1])]}),
 u:g=>({advance:1,parts:[R(0,0,1-g.s,1,[0,0,0,[1,.3]]),R(1-g.s,0,1,1,[0,0,0,N])],seams:[S('oc',[1-g.s,0],[1-g.s,1])]}),
 v:()=>({advance:1,parts:[P([0,0],[1,0],[.93,1],[.07,1])],seams:[S('oc',[.5,0],[.5,1])]}),
 w:()=>({advance:1.25,parts:[R(0,0,.64,1,[0,0,N,[.8,.27]]),R(.62,0,1,1,[0,0,[.8,.27],N])],seams:[S('oc',[1/3,0],[1/3,1]),S('oc',[2/3,0],[2/3,1])]}),
 x:()=>({advance:1,parts:[P([0,0],[.35,0],[.5,.35],[.65,0],[1,0],[.7,.5],[1,1],[.65,1],[.5,.65],[.35,1],[0,1],[.3,.5])],seams:[S('cc',[.03,.03],[.97,.97]),S('cc',[.97,.03],[.03,.97])]}),
 y:()=>({advance:1,parts:[P([0,0],[1,0],[1,.61],[.72,1],[.14,1],[.44,.57],[0,.57])],seams:[S('oj',[.5,0],[.5,.57]),S('jc',[.5,.57],[.2,.98])]}),
 z:()=>({advance:1,parts:[disc()],seams:[S('cc',[.04,.23],[.87,.23],[.16,.78],[.96,.78])]}),
 B:g=>({advance:1,parts:[R(0,0,g.s,1),R(g.s,0,.92,g.m,[0,1,1,0]),R(g.s,g.m,1,1,[0,1,1,0])],seams:[S('cc',[g.s,0],[g.s,g.m]),S('cc',[g.s,g.m],[g.s,1])]}),
 D:g=>({advance:1,parts:stemBowl(g),seams:[S('cc',[g.s,0],[g.s,1])]}),
 // Figures: the same discs, bowls and blocks; open seams mark each counter's opening.
 0:()=>({advance:.84,parts:[disc()],seams:[S('cc',[.86,.06],[.14,.94])]}),
 1:()=>({advance:.62,parts:[R(.38,0,1,1),R(0,0,.38,.38,[1,0,0,0])],seams:[S('co',[.38,0],[.38,.38])]}),
 2:()=>({advance:.9,parts:[R(0,0,1,1,[[1,.5],[1,.5],0,0])],seams:[S('vv',[0,.4],[.66,.4],[.26,.74],[1,.74])]}),
 3:()=>({advance:.9,parts:[R(0,0,.94,.5,[0,1,1,0]),R(0,.5,1,1,[0,1,1,0])],seams:[S('oc',[0,.22],[.58,.22]),S('vc',[0,.5],[.72,.5]),S('oc',[0,.78],[.6,.78])]}),
 4:()=>({advance:.92,parts:[P([.42,0],[1,0],[1,1],[.62,1],[.62,.82],[0,.82],[0,.56])],seams:[S('cc',[.62,0],[.62,.62],[0,.62])]}),
 5:()=>({advance:.9,parts:[R(0,0,1,1,[0,0,[1,.5],[1,.5]])],seams:[S('vc',[1,.3],[.3,.3]),S('vc',[0,.66],[.7,.66])]}),
 6:()=>({advance:.9,parts:[disc()],seams:[S('vc',[1,.38],[.34,.38]),S('jc',[.5,.38],[.5,1])]}),
 7:()=>({advance:.86,parts:[P([0,0],[1,0],[1,.24],[.52,1],[.08,1],[.56,.24],[0,.24])],seams:[S('oc',[.5,.24],[1,.24]),S('jc',[.78,.24],[.3,1])]}),
 8:()=>({advance:.9,parts:[R(.05,0,.95,.5,[1,1,1,1]),R(0,.46,1,1,[1,1,1,1])],seams:[S('cc',[.5,0],[.5,.48]),S('cc',[.5,.48],[.5,1])]}),
 9:()=>({advance:.9,parts:[disc()],seams:[S('vc',[0,.62],[.66,.62]),S('jc',[.5,.62],[.5,0])]}),
 // Punctuation and symbols sit on the same baseline. Dots stay solid so they never read as a small o.
 '.':()=>({advance:.4,parts:[R(0,.62,1,1,[1,1,1,1])],seams:[]}),
 ',':()=>({advance:.4,parts:[R(0,.62,1,1,[1,1,0,1])],seams:[S('co',[.42,.78],[1,1.02])]}),
 ':':()=>({advance:.4,parts:[R(0,.1,1,.48,[1,1,1,1]),R(0,.62,1,1,[1,1,1,1])],seams:[]}),
 ';':()=>({advance:.4,parts:[R(0,.1,1,.48,[1,1,1,1]),R(0,.62,1,1,[1,1,0,1])],seams:[S('co',[.42,.78],[1,1.02])]}),
 '!':()=>({advance:.42,parts:[P([0,0],[1,0],[.8,.5],[.2,.5]),R(0,.62,1,1,[1,1,1,1])],seams:[S('cc',[.5,0],[.5,.5])]}),
 '?':()=>({advance:.82,parts:[R(0,0,1,.52,[1,1,1,0]),R(.24,.62,.76,1,[1,1,1,1])],seams:[S('vc',[0,.28],[.6,.28])]}),
 "'":()=>({advance:.36,parts:[R(0,0,1,.38,[1,1,0,1])],seams:[S('co',[.42,.16],[1,.4])]}),
 '"':()=>({advance:.76,parts:[R(0,0,.44,.38,[1,1,0,1]),R(.56,0,1,.38,[1,1,0,1])],seams:[S('co',[.18,.16],[.44,.4]),S('co',[.74,.16],[1,.4])]}),
 '-':()=>({advance:.62,parts:[R(0,.36,1,.64)],seams:[]}),
 '–':()=>({advance:1,parts:[R(0,.36,1,.64)],seams:[]}),
 '—':()=>({advance:1.5,parts:[R(0,.36,1,.64)],seams:[]}),
 '/':()=>({advance:.7,parts:[P([.58,0],[1,0],[.42,1],[0,1])],seams:[S('cc',[.79,0],[.21,1])]}),
 // Brackets need a real opening: a solid half-disc next to l reads as D.
 '(':()=>({advance:.42,parts:[{kind:'path',d:'M1 0C.3 0 0 .2 0 .5C0 .8 .3 1 1 1V.8C.62 .8 .46 .68 .46 .5C.46 .32 .62 .2 1 .2Z'}],seams:[]}),
 ')':()=>({advance:.42,parts:[{kind:'path',d:'M0 0C.7 0 1 .2 1 .5C1 .8 .7 1 0 1V.8C.38 .8 .54 .68 .54 .5C.54 .32 .38 .2 0 .2Z'}],seams:[]}),
 '[':()=>({advance:.42,parts:[P([0,0],[1,0],[1,.18],[.46,.18],[.46,.82],[1,.82],[1,1],[0,1])],seams:[]}),
 ']':()=>({advance:.42,parts:[P([0,0],[1,0],[1,1],[0,1],[0,.82],[.54,.82],[.54,.18],[0,.18])],seams:[]}),
 // The ampersand is the source poster's own, now set at letter size.
 '&':()=>({advance:.94,parts:AMP_BODY.map(d=>({kind:'path',d})),seams:AMP_CUTS.map(d=>({ends:'jj',d}))}),
 '+':()=>({advance:.9,parts:[R(.32,.1,.68,.9),R(0,.32,1,.68)],seams:[S('cc',[.5,.1],[.5,.9])]}),
 '=':()=>({advance:.9,parts:[R(0,.16,1,.42),R(0,.58,1,.84)],seams:[]}),
 '%':()=>({advance:1,parts:[R(0,0,.4,.4,[1,1,1,1]),R(.6,.6,1,1,[1,1,1,1]),P([.72,0],[1,0],[.28,1],[0,1])],seams:[S('cc',[.2,0],[.2,.4]),S('cc',[.8,.6],[.8,1])]}),
 '#':()=>({advance:1,parts:[R(.18,0,.4,1),R(.6,0,.82,1),R(0,.22,1,.42),R(0,.58,1,.78)],seams:[]}),
 '*':()=>({advance:.7,parts:[R(0,0,1,.62,[1,1,1,1])],seams:[S('cc',[.5,0],[.5,.62]),S('cc',[.07,.13],[.93,.49]),S('cc',[.93,.13],[.07,.49])]}),
 // Poster punctuation: Swiss and French quotes, collaborations, separators, arrows and prices.
 '«':()=>({advance:.9,parts:[P([.42,.18],[.06,.5],[.42,.82],[.62,.82],[.3,.5],[.62,.18]),P([.8,.18],[.44,.5],[.8,.82],[1,.82],[.68,.5],[1,.18])],seams:[]}),
 '»':()=>({advance:.9,parts:[P([.58,.18],[.94,.5],[.58,.82],[.38,.82],[.7,.5],[.38,.18]),P([.2,.18],[.56,.5],[.2,.82],[0,.82],[.32,.5],[0,.18])],seams:[]}),
 '×':()=>({advance:.8,parts:[P(...[[0,0],[.35,0],[.5,.35],[.65,0],[1,0],[.7,.5],[1,1],[.65,1],[.5,.65],[.35,1],[0,1],[.3,.5]].map(([x,y])=>[.06+.88*x,.18+.64*y]))],seams:[]}),
 '·':()=>({advance:.4,parts:[R(0,.34,1,.66,[1,1,1,1])],seams:[]}),
 '…':()=>({advance:1.3,parts:[0,.365,.73].map(x=>R(x,.62,x+.27,1,[1,1,1,1])),seams:[]}),
 '→':()=>({advance:1.1,parts:[R(0,.38,.62,.62),P([.48,.1],[1,.5],[.48,.9])],seams:[S('cc',[.48,.38],[.48,.62])]}),
 '←':()=>({advance:1.1,parts:[R(.38,.38,1,.62),P([.52,.1],[0,.5],[.52,.9])],seams:[S('cc',[.52,.38],[.52,.62])]}),
 '€':()=>({advance:.95,parts:[R(.16,0,1,1,[1,1,1,1]),R(0,.3,.42,.42),R(0,.58,.42,.7)],seams:[S('cv',[.48,.5],[1,.5])]}),
 '$':()=>({advance:1,parts:[disc()],seams:[S('oc',[0,.34],[.9,.34]),S('co',[.1,.67],[1,.67]),S('cc',[.5,0],[.5,1])]}),
 '°':()=>({advance:.5,parts:[R(0,0,1,.4,[1,1,1,1])],seams:[S('cc',[.5,0],[.5,.4])]}),
 '@':()=>({advance:1,parts:[disc()],seams:[S('cv',[.64,.66],[.64,.32],[.3,.32],[.3,.68],[.9,.68],[1,.68])]}),
 // The rest of printable ASCII, so no keystroke falls back to an empty box.
 '<':()=>({advance:.6,parts:[P([1,.12],[0,.5],[1,.88],[1,.66],[.42,.5],[1,.34])],seams:[]}),
 '>':()=>({advance:.6,parts:[P([0,.12],[1,.5],[0,.88],[0,.66],[.58,.5],[0,.34])],seams:[]}),
 '\\':()=>({advance:.7,parts:[P([0,0],[.42,0],[1,1],[.58,1])],seams:[S('cc',[.21,0],[.79,1])]}),
 '^':()=>({advance:.7,parts:[P([0,.5],[.5,0],[1,.5],[.72,.5],[.5,.22],[.28,.5])],seams:[]}),
 '_':()=>({advance:.8,parts:[R(0,.82,1,1)],seams:[]}),
 '`':()=>({advance:.48,parts:[P([0,0],[.52,0],[1,.36],[.48,.36])],seams:[]}),
 '{':()=>({advance:.5,parts:[P([1,0],[.42,0],[.42,.38],[0,.5],[.42,.62],[.42,1],[1,1],[1,.82],[.72,.82],[.72,.57],[.5,.5],[.72,.43],[.72,.18],[1,.18])],seams:[]}),
 '}':()=>({advance:.5,parts:[P([0,0],[.58,0],[.58,.38],[1,.5],[.58,.62],[.58,1],[0,1],[0,.82],[.28,.82],[.28,.57],[.5,.5],[.28,.43],[.28,.18],[0,.18])],seams:[]}),
 '|':()=>({advance:.32,parts:[R(.1,0,.9,1)],seams:[S('cc',[.5,0],[.5,1])]}),
 '~':()=>({advance:.8,parts:[{kind:'path',d:'M0 .62C0 .4 .12 .32 .3 .32C.48 .32 .55 .45 .7 .45C.8 .45 .82 .38 .82 .32H1C1 .55 .88 .64 .7 .64C.52 .64 .45 .51 .3 .51C.2 .51 .18 .58 .18 .62Z'}],seams:[]}),
 ' ':()=>({advance:.48,parts:[],seams:[]})
};
// Accents are incisions: the letters fill the full height, so marks are cut into the top
// (or, for the cedilla, the foot) instead of sitting above.
const MARKS={
 umlaut:[S('oc',[.3,0],[.3,.24]),S('oc',[.7,0],[.7,.24])],
 acute:[S('oc',[.84,0],[.58,.26])],
 grave:[S('oc',[.16,0],[.42,.26])],
 circumflex:[S('cc',[.26,.3],[.5,.07],[.74,.3])],
 cedilla:[S('oc',[.5,1],[.5,.76])]
};
// A circumflex replaces a seam that leaves the top centre, which would otherwise turn it into an arrow.
const fromTopCentre=s=>s.points.some(([x,y])=>Math.abs(x-.5)<.06&&y<.1);
const accented=(base,mark)=>g=>{const r=GLYPHS[base](g);return {...r,seams:[...r.seams.filter(s=>mark!=='circumflex'||!fromTopCentre(s)),...MARKS[mark]]};};
for(const [ch,base,mark] of [['ä','a','umlaut'],['ö','o','umlaut'],['ü','u','umlaut'],['ë','e','umlaut'],['é','e','acute'],['è','e','grave'],['ê','e','circumflex'],['à','a','grave'],['â','a','circumflex'],['ô','o','circumflex'],['û','u','circumflex'],['ç','c','cedilla']])GLYPHS[ch]=accented(base,mark);
export const SOURCE_COLUMNS={
 first:[
  ['p',24,649,111,105],['a',31,556,102,89],['b',9,457,124,96],['l',11,391,121,56],['o',31,320,103,67]
 ],
 second:[
  ['n',142,648,99,101],['o',142,546,99,96],['u',143,434,98,106],['v',144,332,96,96],
  ['e',139,237,103,92],['l',143,174,97,54],['l',143,109,97,59],['e',139,11,102,96]
 ]
};
const n=x=>Number(x.toFixed(4));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const rect=(x,y,w,h,c,e='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}" ${e}/>`;
const path=(d,c,e='')=>`<path d="${d}" fill="${c}" ${e}/>`;
const color=(s,f)=>/^#[a-f\d]{6}$/i.test(s??'')?s:f;
function fingerprint(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
const recipeOf=ch=>GLYPHS[ch]??GLYPHS[ch.toLowerCase()]??GLYPHS.o;
export const advanceOf=ch=>recipeOf(ch)(guides()).advance;
// '/' starts a new line; '\/' sets a slash glyph.
export const splitRows=text=>text.split(/(?<!\\)\//).map(r=>r.replaceAll('\\/','/'));
const FOLD={'‘':"'",'’':"'",'‚':',','“':'"','”':'"','„':'"','ß':'ss','−':'-'};
export function normalizeText(value,fallback='pablo/nouvelle'){
 // Unicase: capitals use the lowercase forms, except B and D, which keep the source's capital forms.
 // Letters with an accent glyph keep it; any other accent falls back to its base letter.
 const s=[...String(value??fallback).normalize('NFC').replace(/[‘’‚“”„ß−]/g,c=>FOLD[c]).replace(/\r?\n/g,'/').replace(/[A-ZÀ-Þ]/g,c=>c==='B'||c==='D'?c:c.toLowerCase())]
  .map(c=>Object.hasOwn(GLYPHS,c)?c:c.normalize('NFKD').replace(/[̀-ͯ]/g,'')).join('');
 const bad=[...new Set([...s.replaceAll('\\/','')].filter(c=>c!==' '&&c!=='/'&&!Object.hasOwn(GLYPHS,c)))];
 if(bad.length)throw new Error(`Use letters, figures and . , : ; ! ? ' " - – — ( ) [ ] & + = % # * « » × · … → ← € $ ° @. Type / for a new line, \\/ for a slash. Unsupported: ${bad.join(' ')}`);
 const rows=splitRows(s).map(r=>r.trim().replace(/ +/g,' '));
 if(rows.some(r=>!r))throw new Error('Each line needs at least one character.');
 if(rows.length>8)throw new Error('Use up to eight lines.');
 if(rows.some(r=>r.length>24)||rows.join('').length>64)throw new Error('Keep each line to 24 characters and the text to 64.');
 return rows.map(r=>r.replaceAll('/','\\/')).join('/');
}
// Rules saved by the first version named two words and always drew the poster.
function migrate(input){
 if(input.engine!=='pablo-capsule-v1'&&(input.first===undefined||input.text!==undefined))return input;
 const p=input.params??{};
 return {...input,text:`${input.first??'pablo'}/${input.second??'nouvelle'}`,layout:'source',
  params:{seam:p.slit,tracking:p.tracking===undefined?undefined:.055*p.tracking,offset:p.offset===undefined?undefined:p.offset/100}};
}
export function resolve(raw={}){
 const input=migrate(raw),family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],params={};
 for(const c of CONTROLS){const v=Number(input.params?.[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:c.value));}
 const text=normalizeText(input.text),layout=LAYOUTS.some(l=>l.id===input.layout)?input.layout:'up';
 if(layout==='source'){const rows=splitRows(text);if(rows.length!==2||rows.some(r=>r.length>12))throw new Error('The Neubad layout sets exactly two lines of up to 12 characters, e.g. pablo/nouvelle.');}
 return {version:2,engine:'pablo-capsule-v2',text,layout,fit:input.fit==='even'?'even':'fill',family:family.id,cut:cutOf(input.cut).id,params,
  colors:family.colors.map((c,i)=>color(input.colors?.[i],c)),invert:!!input.invert,stage:Math.max(1,Math.min(4,Math.round(Number(input.stage)||4)))};
}

// ---- Geometry -------------------------------------------------------------
const kappa=square=>.5523+square*.425;
function roundRect(x0,y0,x1,y1,corners,k,cap=Infinity){
 const w=x1-x0,h=y1-y0,c=corners.map(v=>Array.isArray(v)?v:[v,v]),on=i=>c[i][0]>0&&c[i][1]>0;
 // Order: top-left, top-right, bottom-right, bottom-left. Two round corners on one
 // edge share it; a single round corner may use the whole edge.
 const r=c.map(([fx,fy],i)=>{
  if(!on(i))return [0,0];const hp=[1,0,3,2][i],vp=[3,2,1,0][i];
  return [w*fx/Math.max(1,fx+(on(hp)?c[hp][0]:0)),h*fy/Math.max(1,fy+(on(vp)?c[vp][1]:0))];
 });
 if(cap<Infinity)for(const v of r)v[1]=Math.min(v[1],v[0]*cap);
 const [tl,tr,br,bl]=r,q=1-k;
 let d=`M${n(x0+tl[0])} ${n(y0)}H${n(x1-tr[0])}`;
 if(tr[0])d+=`C${n(x1-tr[0]*q)} ${n(y0)} ${n(x1)} ${n(y0+tr[1]*q)} ${n(x1)} ${n(y0+tr[1])}`;
 d+=`V${n(y1-br[1])}`;
 if(br[0])d+=`C${n(x1)} ${n(y1-br[1]*q)} ${n(x1-br[0]*q)} ${n(y1)} ${n(x1-br[0])} ${n(y1)}`;
 d+=`H${n(x0+bl[0])}`;
 if(bl[0])d+=`C${n(x0+bl[0]*q)} ${n(y1)} ${n(x0)} ${n(y1-bl[1]*q)} ${n(x0)} ${n(y1-bl[1])}`;
 d+=`V${n(y0+tl[1])}`;
 if(tl[0])d+=`C${n(x0)} ${n(y0+tl[1]*q)} ${n(x0+tl[0]*q)} ${n(y0)} ${n(x0+tl[0])} ${n(y0)}`;
 return d+'Z';
}
function polygon(points){
 // Keep every part's winding the same so overlapping parts union under nonzero fill.
 const area=points.reduce((s,[x,y],i)=>{const [u,v]=points[(i+1)%points.length];return s+x*v-u*y;},0);
 const p=area<0?[...points].reverse():points;return 'M'+p.map(([x,y])=>`${n(x)} ${n(y)}`).join('L')+'Z';
}
// Free-form recipe paths use absolute M/L/H/V/C/Q/Z commands in the unit box.
function scalePath(d,X,Y){
 return d.replace(/([MLHVCQZ])([^MLHVCQZ]*)/g,(m,cmd,args)=>{
  const v=(args.match(/-?\d*\.?\d+/g)??[]).map(Number);
  if(cmd==='Z')return 'Z';if(cmd==='H')return 'H'+v.map(x=>n(X(x))).join(' ');if(cmd==='V')return 'V'+v.map(y=>n(Y(y))).join(' ');
  return cmd+v.map((a,i)=>n(i%2?Y(a):X(a))).join(' ');
 });
}
// Give a closed free-form part the same winding as the generated parts, so that
// overlapping parts unite under nonzero fill instead of cancelling.
function orientPath(d){
 const segs=[];let start=null,cur=null;
 for(const [,cmd,args] of d.matchAll(/([MLHVCZ])([^MLHVCZ]*)/g)){
  const v=(args.match(/-?\d*\.?\d+/g)??[]).map(Number);
  if(cmd==='M'){start=cur=[v[0],v[1]];}
  else if(cmd==='L'||cmd==='H'||cmd==='V'){const end=cmd==='L'?[v[0],v[1]]:cmd==='H'?[v[0],cur[1]]:[cur[0],v[0]];segs.push({from:cur,end});cur=end;}
  else if(cmd==='C'){const end=[v[4],v[5]];segs.push({from:cur,c1:[v[0],v[1]],c2:[v[2],v[3]],end});cur=end;}
 }
 const pts=flatten(`M${start.join(' ')}`+segs.map(s=>s.c1?`C${[...s.c1,...s.c2,...s.end].join(' ')}`:`L${s.end.join(' ')}`).join(''),8);
 const area=pts.reduce((sum,[x,y],i)=>{const [u,w]=pts[(i+1)%pts.length];return sum+x*w-u*y;},0);
 if(area>=0)return d;
 const back=[...segs].reverse(),last=segs.at(-1).end;
 let out=`M${n(start[0])} ${n(start[1])}`;if(Math.hypot(last[0]-start[0],last[1]-start[1])>1e-9)out+=`L${n(last[0])} ${n(last[1])}`;
 for(const s of back)out+=s.c1?`C${n(s.c2[0])} ${n(s.c2[1])} ${n(s.c1[0])} ${n(s.c1[1])} ${n(s.from[0])} ${n(s.from[1])}`:`L${n(s.from[0])} ${n(s.from[1])}`;
 return out+'Z';
}
// A seam's centre line as points, for stroking it into an outline (fonts cannot stroke).
function flatten(d,steps=32){
 const pts=[];let cur=[0,0];
 for(const [,cmd,args] of d.matchAll(/([MLCQ])([^MLCQ]*)/g)){
  const v=(args.match(/-?\d*\.?\d+/g)??[]).map(Number);
  if(cmd==='M'||cmd==='L'){for(let i=0;i<v.length;i+=2){cur=[v[i],v[i+1]];pts.push(cur);}continue;}
  const c=cmd==='Q'?[cur,[v[0],v[1]],[v[2],v[3]]]:[cur,[v[0],v[1]],[v[2],v[3]],[v[4],v[5]]];
  for(let s=1;s<=steps;s++){const t=s/steps,u=1-t,w=c.length===3?[u*u,2*u*t,t*t]:[u*u*u,3*u*u*t,3*u*t*t,t*t*t];pts.push([0,1].map(a=>c.reduce((sum,p,i)=>sum+p[a]*w[i],0)));}
  cur=c.at(-1);
 }
 return pts;
}
// Physical geometry of one glyph in its upright local box (gl along the line, em across).
export function glyphGeometry(ch,params,gl,em,cut='regular'){
 const recipe=recipeOf(ch)(guides(params)),k=kappa(params.square),X=x=>x*gl,Y=y=>y*em,cap=cutOf(cut).roundCap;
 const parts=recipe.parts.map(p=>({kind:p.kind,d:p.kind==='path'?orientPath(scalePath(p.d,X,Y)):p.kind==='polygon'?polygon(p.points.map(([x,y])=>[X(x),Y(y)])):roundRect(X(p.box[0]),Y(p.box[1]),X(p.box[2]),Y(p.box[3]),p.corners,k,cap)}));
 // Open ends overshoot just enough to leave the letter; a longer overshoot grooves neighbouring parts.
 const bridge=params.bridge*em,over=Math.max(.04*em,params.seam*em*.6),notch=params.aperture*em,seams=[],notches=[];
 // A seam running just inside a part edge would leave a sliver thinner than the seam, so it
 // moves onto that edge. At hairline widths no seam is that close; wide stencil seams are.
 const boxes=recipe.parts.filter(p=>p.kind==='round-rect').map(p=>[X(p.box[0]),Y(p.box[1]),X(p.box[2]),Y(p.box[3])]),sw=params.seam*em,near=sw/2+Math.max(.5*sw,.02*em);
 const snap=pts=>{
  const [[ax,ay],[bx,by]]=pts,v=Math.abs(ax-bx)<1e-9,h=Math.abs(ay-by)<1e-9;if(!v&&!h)return;
  const c=v?ax:ay,lo=v?Math.min(ay,by):Math.min(ax,bx),hi=v?Math.max(ay,by):Math.max(ax,bx);
  for(const [x0,y0,x1,y1] of boxes){
   const [e0,e1,s0,s1]=v?[x0,x1,y0,y1]:[y0,y1,x0,x1];
   if(c<=e0+1e-6||c>=e1-1e-6||Math.min(hi,s1)-Math.max(lo,s0)<=0)continue;
   // Ties go to the lower edge whatever the scale, so screen and font agree.
   const to=c-e0<=e1-c+1e-6*em?e0:e1;if(Math.abs(c-to)<near){if(v)pts[0][0]=pts[1][0]=to;else pts[0][1]=pts[1][1]=to;return;}
  }
 };
 for(const s of recipe.seams){
  if(s.d){
   // Free-form seams keep their drawn ends exactly ('jj').
   const d=scalePath(s.d,X,Y),flat=flatten(d),a=flat[0],b=flat.at(-1),cl=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
   seams.push({d,ends:s.ends,points:[a,b],normal:[-(b[1]-a[1])/cl,(b[0]-a[0])/cl],flat});continue;
  }
  const pts=s.points.map(([x,y])=>[X(x),Y(y)]),last=pts.length-1,straight=pts.length===2&&!s.curve;
  if(straight)snap(pts);
  const closed=[...s.ends].filter(e=>e==='c').length,length=Math.hypot(pts[last][0]-pts[0][0],pts[last][1]-pts[0][1]);
  if(straight&&length-closed*bridge<=params.seam*em)continue; // the bridges meet: no visible seam
  [[0,1],[last,last-1]].forEach(([i,j],end)=>{
   const e=s.ends[end],[px,py]=pts[i],dx=px-pts[j][0],dy=py-pts[j][1],len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
   if(e==='c'){const t=straight?bridge:Math.min(bridge,len*.45);pts[i]=[px-ux*t,py-uy*t];}
   else if(e==='o'||e==='v'){
    pts[i]=[px+ux*over,py+uy*over];
    if(e==='v'&&notch>0){const half=notch*.75;notches.push([[px-ux*notch,py-uy*notch],[px+ux*over-uy*half,py+uy*over+ux*half],[px+ux*over+uy*half,py+uy*over-ux*half]]);}
   }
  });
  const d=s.curve?`M${n(pts[0][0])} ${n(pts[0][1])}Q${n(pts[1][0])} ${n(pts[1][1])} ${n(pts[2][0])} ${n(pts[2][1])}`:'M'+pts.map(([x,y])=>`${n(x)} ${n(y)}`).join('L');
  const cx=pts[last][0]-pts[0][0],cy=pts[last][1]-pts[0][1],cl=Math.hypot(cx,cy)||1;
  seams.push({d,ends:s.ends,points:pts,normal:[-cy/cl,cx/cl],flat:s.curve?flatten(d):pts});
 }
 return {advance:recipe.advance,parts,seams,notches,recipe};
}
function glyphSVG(ch,gl,em,state,id,ink){
 const geo=glyphGeometry(ch,state.params,gl,em,state.cut);if(!geo.parts.length)return '';
 const body=geo.parts.map(p=>p.d).join(''),hair=n(Math.max(.6,em*.006));
 if(state.stage===1){
  const g=guides(state.params),line=(x1,y1,x2,y2)=>path(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`,'none',`stroke="${ink}" stroke-width="${hair}" opacity=".45"`);
  let s=rect(0,0,gl,em,'none',`stroke="${ink}" stroke-width="${hair}" stroke-dasharray="${n(em*.04)} ${n(em*.04)}"`);
  for(const x of new Set([g.s,1-g.s]))s+=line(x*gl,0,x*gl,em);
  for(const y of [g.d,g.m,1-g.d])s+=line(0,y*em,gl,y*em);
  return s;
 }
 if(state.stage===2)return geo.parts.map(p=>path(p.d,'none',`stroke="${ink}" stroke-width="${hair}"`)).join('');
 if(state.stage===3)return path(body,ink);
 const sw=state.params.seam*em;let cuts='';
 for(const s of geo.seams){
  const stroke=path(s.d,'none',`stroke="black" stroke-width="${n(sw)}" stroke-linecap="butt" stroke-linejoin="miter"`);
  if(state.family==='twin'){const [nx,ny]=s.normal,t=sw*.85;for(const sign of [-1,1])cuts+=`<g transform="translate(${n(nx*t*sign)} ${n(ny*t*sign)})">${stroke}</g>`;}
  else cuts+=stroke;
 }
 for(const t of geo.notches)cuts+=path(polygon(t),'black');
 const pad=em*.3;let out=`<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${n(-pad)}" y="${n(-pad)}" width="${n(gl+2*pad)}" height="${n(em+2*pad)}">${path(body,'white')}${cuts}</mask></defs>${path(body,ink,`mask="url(#${id})"`)}`;
 if(state.family==='offset'&&state.params.offset>0){
  const dx=state.params.offset*em,l=id+'-l',r=id+'-r';
  out=`<defs><clipPath id="${l}">${rect(-pad,-pad,gl/2+pad,em+2*pad,'white')}</clipPath><clipPath id="${r}">${rect(gl/2,-pad,gl/2+pad,em+2*pad,'white')}</clipPath></defs><g transform="translate(${n(-dx)} 0)"><g clip-path="url(#${l})">${out}</g></g><g transform="translate(${n(dx)} 0)"><g clip-path="url(#${r})">${out}</g></g>`;
 }
 return out;
}

// ---- Typesetting ----------------------------------------------------------
export const PAGE={width:713,height:1000,margin:36};
// Lines share one em (their thickness). 'fill' then stretches each line to the full length.
export function setLines(state,page=PAGE){
 const rows=splitRows(state.text),vertical=state.layout!=='rows',{width,tracking,leading}=state.params;
 const A={x:page.margin,y:page.margin,w:page.width-2*page.margin,h:page.height-2*page.margin},length=vertical?A.h:A.w,cross=vertical?A.w:A.h;
 const info=rows.map(text=>{const adv=[...text].map(ch=>advanceOf(ch)*cutAdvance(ch,state.cut));return {text,adv,sum:adv.reduce((a,b)=>a+b,0),gaps:(text.length-1)*tracking};});
 const em=Math.min(cross/(rows.length+(rows.length-1)*leading),...info.map(l=>length/(l.sum*width+l.gaps)));
 const start=(cross-em*(rows.length+(rows.length-1)*leading))/2;
 return info.map((l,i)=>{
  const stretch=state.fit==='fill'?Math.min(width*3,(length-l.gaps*em)/(em*l.sum)):width,c=start+i*em*(1+leading);let cursor=0;
  const glyphs=[...l.text].map((ch,j)=>{
   const gl=l.adv[j]*stretch*em,o=cursor;cursor+=gl+tracking*em;
   if(state.layout==='rows')return {ch,gl,em,transform:`translate(${n(A.x+o)} ${n(A.y+c)})`,box:[A.x+o,A.y+c,gl,em]};
   if(state.layout==='up'){const x=A.x+c,y=A.y+A.h-o;return {ch,gl,em,transform:`translate(${n(x)} ${n(y)}) rotate(-90)`,box:[x,y-gl,em,gl]};}
   const x=A.x+A.w-c-em,y=A.y+o;return {ch,gl,em,transform:`translate(${n(x+em)} ${n(y)}) rotate(90)`,box:[x,y,em,gl]};
  });
  return {text:l.text,em,stretch,glyphs};
 });
}
function sourceColumn(frames,tracking){
 const bottom=frames[0][2]+frames[0][4],top=frames.at(-1)[2],heights=frames.reduce((s,f)=>s+f[4],0);
 const gaps=frames.slice(0,-1).map((f,i)=>Math.max(0,f[2]-(frames[i+1][2]+frames[i+1][4])));
 const factor=(bottom-top)/(heights+gaps.reduce((s,g)=>s+g,0)*tracking);let cursor=bottom;
 return frames.map((f,i)=>{const h=f[4]*factor,w=f[3]*factor,r=[f[0],f[1]+f[3]-w,cursor-h,w,h];cursor-=h+(gaps[i]??0)*tracking*factor;return r;});
}
// Frames inside the Neubad poster columns, in the 543 × 762 source field.
export function wordColumn(word,which,tracking=1){
 if(word===(which==='first'?'pablo':'nouvelle'))return sourceColumn(SOURCE_COLUMNS[which],tracking);
 const field=which==='first'?{right:136,bottom:755,top:319,height:105}:{right:242,bottom:751,top:11,height:100};
 const advance=[...word].map(advanceOf),em=Math.min(field.height,(field.bottom-field.top)/(advance.reduce((a,b)=>a+b,0)+Math.max(0,word.length-1)*.055*tracking));
 let cursor=field.bottom;return [...word].map((ch,i)=>{const h=advance[i]*em,r=[ch,field.right-em,cursor-h,em,h];cursor-=h+.055*em*tracking;return r;});
}

// ---- Neubad source layout scaffold ------------------------------------------
function cutNormal(d){
 if(d.includes('V')&&!/[HLCQ]/.test(d))return [1,0];
 if(d.includes('H')&&!/[VLCQ]/.test(d))return [0,1];
 const a=(d.match(/-?(?:\d*\.?\d+)/g)??[]).map(Number),dx=(a.at(-2)??1)-a[0],dy=(a.at(-1)??0)-a[1],length=Math.hypot(dx,dy)||1;
 return [-dy/length,dx/length];
}
const AMP_BODY=[
 'M.48 .01C.27 -.015 .10 .15 .10 .34C.10 .40 .12 .44 .14 .48L.055 .58C-.065 .73 .005 .96 .22 .99C.37 1.015 .56 .81 .71 .66C.88 .49 .94 .35 .88 .20C.82 .055 .66 .01 .48 .01Z',
 'M.84 .29H.995C.995 .42 .97 .50 .91 .58C.83 .585 .75 .57 .70 .52Z',
 'M.40 .79C.60 .65 .68 .59 .72 .56C.80 .62 .89 .625 .995 .60V.94C.80 1.04 .57 1 .40 .79Z'
];
const AMP_CUTS=['M.12 .47L.57 .135','M.245 .915L.76 .49','M.865 .28C.88 .46 .76 .61 .61 .74','M.40 .79C.57 1 .79 1.035 1.02 .95','M.71 .53C.79 .61 .89 .625 1.02 .595'];
// The ampersand is a one-off ornament of the source layout, not part of the alphabet.
function ampersand(state,id,ink,paper){
 if(state.stage<=2)return AMP_BODY.map(d=>path(d,'none',`stroke="${ink}" stroke-width=".002"`)).join('');
 let body=AMP_BODY.map(d=>path(d,ink)).join('');
 if(state.stage>=4){
  const sw=state.params.seam*.48;let cuts='';
  for(const d of AMP_CUTS){
   const p=path(d,'none',`stroke="${paper}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"`);
   if(state.family==='twin'){const [nx,ny]=cutNormal(d),t=sw*.85;for(const sign of [-1,1])cuts+=`<g transform="translate(${n(nx*t*sign)} ${n(ny*t*sign)})">${p}</g>`;}
   else cuts+=p;
  }
  body+=cuts;
  if(state.family==='offset'&&state.params.offset>0){const dx=state.params.offset/2.85,l=id+'-l',r=id+'-r',b=body;body=`<defs><clipPath id="${l}">${rect(-1,-1,1.5,3,'white')}</clipPath><clipPath id="${r}">${rect(.5,-1,1.5,3,'white')}</clipPath></defs><g transform="translate(${-n(dx)} 0)"><g clip-path="url(#${l})">${b}</g></g><g transform="translate(${n(dx)} 0)"><g clip-path="url(#${r})">${b}</g></g>`;}
 }
 return body;
}
const TUBES={
 N:'M.12 .88V.12L.88 .88V.12',E:'M.86 .12H.12V.88H.86M.12 .50H.73',U:'M.12 .12V.65Q.12 .88 .5 .88Q.88 .88 .88 .65V.12',
 B:'M.12 .88V.12H.54Q.88 .12 .88 .31Q.88 .50 .54 .50H.12M.54 .50Q.88 .50 .88 .69Q.88 .88 .54 .88H.12',
 A:'M.12 .88V.42Q.12 .12 .5 .12Q.88 .12 .88 .42V.88M.12 .57H.88',D:'M.12 .88V.12H.48Q.88 .12 .88 .5Q.88 .88 .48 .88H.12',
 L:'M.12 .12V.88H.88',Z:'M.12 .12H.88L.12 .88H.88',R:'M.12 .88V.12H.54Q.88 .12 .88 .33Q.88 .54 .54 .54H.12M.54 .54L.88 .88',
 0:'M.5 .12Q.12 .12 .12 .40V.60Q.12 .88 .5 .88Q.88 .88 .88 .60V.40Q.88 .12 .5 .12Z',
 1:'M.3 .3L.56 .12V.88',2:'M.12 .26Q.12 .12 .5 .12Q.88 .12 .88 .29Q.88 .46 .5 .5Q.12 .54 .12 .72V.88H.88',
 ':':'M.5 .26V.3M.5 .7V.74'
};
function tubeWord(text,x,y,w,h,ink,paper){
 let s='',advance=w/Math.max(1,text.length);for(let i=0;i<text.length;i++){
  const d=TUBES[text[i].toUpperCase()]??TUBES[0];s+=`<g transform="translate(${n(x+i*advance)} ${n(y)}) scale(${n(advance*.94)} ${n(h)})">`;
  for(const [stroke,width] of [[ink,.26],[paper,.21],[ink,.16],[paper,.11],[ink,.055],[paper,.018]])s+=path(d,'none',`stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`);s+='</g>';
 }return s;
}
function star(cx,cy,r,points=5){let d='';for(let i=0;i<points*2;i++){const a=-Math.PI/2+i*Math.PI/points,rad=i%2?r*.43:r;d+=`${i?'L':'M'}${n(cx+Math.cos(a)*rad)} ${n(cy+Math.sin(a)*rad)}`;}return d+'Z';}
function ornament(ink,paper){
 let s=rect(10,10,106,224,'none',`rx="13" stroke="${ink}" stroke-width=".9"`);
 s+=rect(249,315,151,114,'none',`rx="17" stroke="${ink}" stroke-width="1"`);
 for(let i=14;i>=0;i--)s+=path(star(28+i*7.2,250+i*4.4,23),paper,`stroke="${ink}" stroke-width=".7"`);
 return s;
}
function details(ink,paper){
 let s=tubeWord('2',44,17,40,42,ink,paper)+tubeWord('12',16,69,74,41,ink,paper)+tubeWord('20',16,123,96,41,ink,paper)+tubeWord('22',16,177,96,41,ink,paper);
 for(const [x,y,r] of [[97,61,6],[97,114,6]])s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${paper}" stroke="${ink}" stroke-width=".9"/>`;
 // Rays stop above the LUZERN line instead of crossing it.
 for(let i=0;i<18;i++){const a=-Math.PI*.48+i*Math.PI*.96/17,x=450+Math.cos(a)*68,y=376+Math.sin(a)*68;if(y<426)s+=path(`M450 376L${n(x)} ${n(y)}`,'none',`stroke="${ink}" stroke-width=".8"`);}
 s+=`<circle cx="450" cy="376" r="42" fill="${paper}"/>`+path('M450 358Q452 374 466 376Q452 378 450 393Q448 378 434 376Q448 374 450 358Z','none',`stroke="${ink}" stroke-width=".9"`);
 s+=tubeWord('NEU',252,325,140,42,ink,paper)+tubeWord('BAD',252,378,140,42,ink,paper)+tubeWord('LUZERN',252,432,282,44,ink,paper);
 // Small circular marks and outline numerals echo the secondary print system.
 s+=rect(317,485,214,57,paper,`rx="11" stroke="${ink}" stroke-width=".75"`);
 for(const x of [346,416,486])for(const r of [11,14,18])s+=`<circle cx="${x}" cy="514" r="${r}" fill="none" stroke="${ink}" stroke-width=".7" ${r===18?'stroke-dasharray=".8 1.8"':''}/>`;
 // 21:00, stacked down the column beside the information pill.
 for(const [ch,y,h] of [['2',486,48],['1',540,48],[':',594,38],['0',638,56],['0',700,56]])s+=tubeWord(ch,252,y,53,h,ink,paper);
 // Foreground looping ribbons cross the solid ampersand like the reference.
 for(const d of ['M260 64C325 36 396 28 363 10C332 -8 266 9 261 37C256 62 294 36 280 34','M414 14C466 -15 495 89 457 95C428 98 484 107 513 61C534 29 519 20 507 33']){
  s+=path(d,'none',`stroke="${ink}" stroke-width="6.7" stroke-linecap="round"`)+path(d,'none',`stroke="${paper}" stroke-width="4.8" stroke-linecap="round"`);
 }
 for(const [x,y,r] of [[108,29,15],[129,29,11],[98,25,11],[139,17,8]])s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${paper}" stroke="${ink}" stroke-width=".8"/>`;
 return s;
}
function renderSource(state,paper,ink){
 const W=713,H=1000,scale=1000/762,id='p'+fingerprint(JSON.stringify(state)),[first,second]=splitRows(state.text),factor=state.params.tracking/.055;let body='';
 if(state.stage===4)body+=ornament(ink,paper);
 const words={first:wordColumn(first,'first',factor),second:wordColumn(second,'second',factor)},lines=[];
 let index=0;for(const [key,frames] of Object.entries(words)){
  lines.push({text:key==='first'?first:second,glyphs:frames.map(([ch,x,y,w,h])=>({ch,gl:h,em:w,box:[x*scale,y*scale,w*scale,h*scale]}))});
  for(const [ch,x,y,w,h] of frames)body+=`<g transform="translate(${n(x)} ${n(y+h)}) rotate(-90)">${glyphSVG(ch,h,w,state,id+'-g'+index++,ink)}</g>`;
 }
 body+=`<g transform="translate(250 6) scale(285 304)">${ampersand(state,id+'-amp',ink,paper)}</g>`;
 for(const [ch,x,y,w,h] of [['B',322,544,105,104],['a',432,548,98,100],['n',322,656,105,99],['D',433,656,105,99]])body+=`<g transform="translate(${x} ${y})">${glyphSVG(ch,w,h,state,id+'-b'+index++,ink)}</g>`;
 if(state.stage===4){body+=details(ink,paper)+path('M247 0V762','none',`stroke="${ink}" stroke-width=".8"`);}
 const desc=`${first} ${second}. ${state.family} capsule type in the Neubad source layout. Stage ${state.stage}. Study after Enea Bortone.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}"><title>${esc(first)} ${esc(second)} — Neubad source layout</title><desc>${esc(desc)}</desc>${rect(0,0,W,H,paper)}<g transform="scale(${n(scale)})">${body}</g></svg>`;
 return {svg,state,width:W,height:H,lines,features:{family:state.family,stage:state.stage,layout:'source',fit:'measured',lines:2,characters:first.length+second.length,proportions:first==='pablo'&&second==='nouvelle'?'source-proportions':'transferred-words'}};
}

// ---- Public rendering -------------------------------------------------------
// Any page size works for the type layouts; the source layout keeps its measured poster.
// An optional visible area (page coordinates) skips glyphs that would fall wholly outside it.
export function render(input={},page=PAGE,visible=null){
 const state=resolve(input),[paper,ink]=state.invert?[state.colors[1],state.colors[0]]:state.colors;
 if(state.layout==='source')return renderSource(state,paper,ink);
 const {width:W,height:H}=page,id='p'+fingerprint(JSON.stringify(state)+W+'x'+H),lines=setLines(state,page);let body='',index=0;
 const seen=([x,y,w,h])=>!visible||(x<visible.x+visible.width&&x+w>visible.x&&y<visible.y+visible.height&&y+h>visible.y);
 for(const line of lines)for(const g of line.glyphs){const i=index++;if(seen(g.box))body+=`<g transform="${g.transform}">${glyphSVG(g.ch,g.gl,g.em,state,id+'-g'+i,ink)}</g>`;}
 const label=splitRows(state.text).join(' / '),desc=`${label}. ${state.family} capsule type, ${state.layout} layout, ${state.fit} fit. Stage ${state.stage}. Type system after Enea Bortone.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}"><title>${esc(label)} — capsule type</title><desc>${esc(desc)}</desc>${rect(0,0,W,H,paper)}${body}</svg>`;
 return {svg,state,width:W,height:H,lines,features:{family:state.family,stage:state.stage,layout:state.layout,fit:state.fit,lines:lines.length,characters:splitRows(state.text).join('').length,em:n(lines[0].em)}};
}
export const SPECIMEN_TEXT={letters:'abcdefghijklm/nopqrstuvwxyz',figures:"0123456789/&!?.,:;'\"-–—/\\/()[]+=%#*",symbols:'«»×·…→←/€$°@äöüéèàç',ascii:'<>\\^_`{|}~'};
export function specimen(input={},text=SPECIMEN_TEXT.letters){
 const state=resolve({...input,text,layout:'rows',fit:'even',params:{...input.params,width:1,leading:.3}}),[paper,ink]=state.colors,rows=splitRows(state.text).length;
 const page={width:1100,height:250+(rows-2)*120,margin:18},lines=setLines(state,page);let s=rect(0,0,page.width,page.height,paper),index=0;
 for(const line of lines)for(const g of line.glyphs)s+=`<g transform="${g.transform}">${glyphSVG(g.ch,g.gl,g.em,state,'spec-'+state.family+'-'+index++,ink)}</g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-label="Capsule alphabet a to z, ${state.family} system">${s}</svg>`;
}
