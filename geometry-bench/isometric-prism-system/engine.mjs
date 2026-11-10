/* Isometric prism letters — type system study after Takenobu Igarashi.
 * Every glyph is a cell skeleton (full cells, half-cell triangles, quarter
 * discs, a pointed tip). Cells are placed in a standing or lying plane, can be
 * widened, slanted, waved and stepped, and are extruded into prisms. Any
 * parallel projection draws them: an orthographic camera (isometric, pixel
 * 2:1, dimetric, trimetric, worm's eye…), planometric or oblique (cabinet,
 * cavalier). Cell columns are disjoint and parallel, so one back-to-front
 * order over columns hides what is behind. New interpretations, not traced.
 */
export const ENGINE='isometric-prism-v2';
export const SOURCES=[
 {id:'moma-190198',title:'12th Summer Jazz Festival',date:'1980',family:'plinth'},
 {id:'moma-190199',title:'14th Summer Jazz Festival',date:'1982',family:'beam'},
 {id:'moma-7783',title:'Zen',date:'1981',family:'voxel'},
 {id:'moma-7779',title:'Noh',date:'1981',family:'monolith'},
 {id:'moma-6666',title:"Expo '85",date:'1982',family:'stripe'},
 {id:'moma-8132',title:'One Man Exhibition by Igarashi',date:'undated'}
];
export const VIEWS=[
 {id:'isometric',name:'Isometric',set:{projection:'axonometric',params:{azimuth:45,elevation:35.26}}},
 {id:'pixel',name:'Pixel 2:1',set:{projection:'axonometric',params:{azimuth:45,elevation:30}}},
 {id:'high',name:'High',set:{projection:'axonometric',params:{azimuth:45,elevation:58}}},
 {id:'low',name:'Low',set:{projection:'axonometric',params:{azimuth:45,elevation:15}}},
 {id:'dimetric',name:'Dimetric',set:{projection:'axonometric',params:{azimuth:20,elevation:24}}},
 {id:'trimetric',name:'Trimetric',set:{projection:'axonometric',params:{azimuth:63,elevation:27}}},
 {id:'worm',name:'Worm’s eye',set:{projection:'axonometric',params:{azimuth:45,elevation:-35.26}}},
 // Planometric keeps plans true, oblique keeps the front true: each turns the letters to match.
 {id:'planometric',name:'Planometric',set:{projection:'planometric',orientation:'lying',params:{azimuth:45,foreshorten:1}}},
 {id:'cabinet',name:'Cabinet',set:{projection:'oblique',orientation:'standing',axis:'fall',params:{recede:45,foreshorten:.5}}},
 {id:'cavalier',name:'Cavalier',set:{projection:'oblique',orientation:'standing',axis:'fall',params:{recede:45,foreshorten:1}}}
];
const iso={azimuth:45,elevation:35.26,recede:45,foreshorten:.5},shape0={step:0,tracking:1,stagger:0,inset:0,width:1,slant:0,wave:0,jitter:0,rods:0,grain:2};
// Palette roles: ground, cap (the letter face), side A, side B, line, accent.
export const FAMILIES=[
 {id:'plinth',name:'Floor plinths',after:'12th Summer Jazz Festival, 1980',palette:'Lemon / grey / green / ultramarine',colors:['#e4dc22','#b8b7b0','#2b3192','#2f9b57','#16171a','#2a8fd6'],text:'JAZZ',
  set:{orientation:'lying',axis:'rise',mode:'solid',texture:'outline',ground:'floor',projection:'axonometric',params:{...shape0,...iso,depth:2.2}},note:'Letters lie on a grid floor and rise as slabs. Grey tops, green and ultramarine sides, fine black creases.'},
 {id:'beam',name:'Speckled beams',after:'14th Summer Jazz Festival, 1982',palette:'Black / vermilion / green / chrome yellow',colors:['#0e0e0f','#d8402c','#21a04c','#f0d23a','#0e0e0f','#f3efe6'],text:'JAZZ',
  set:{orientation:'lying',axis:'rise',mode:'solid',texture:'speckle',ground:'fade',projection:'axonometric',params:{...shape0,...iso,depth:1,tracking:.5,grain:3}},note:'Square-section beams one cell deep. Every face speckled; a speckle fade grounds the poster.'},
 {id:'voxel',name:'Cube walls',after:'Zen, 1981',palette:'Taupe / chalk / teal and grey rods',colors:['#9d948c','#f6f4ee','#ebe8e1','#d9d5cc','#a49e95','#3f8a78'],text:'ZEN',
  set:{orientation:'standing',axis:'rise',mode:'solid',texture:'grid',ground:'plain',projection:'axonometric',params:{...shape0,...iso,depth:2.6,step:.4,tracking:.8,stagger:.9,grain:4,rods:4}},note:'Standing walls of small cubes. Letters step back in depth; rods run through them.'},
 {id:'monolith',name:'Dark monoliths',after:'Noh, 1981',palette:'Stone / charcoal / slate',colors:['#8e8c88','#2c2c2e','#1a1a1c','#424246','#76746f','#d9d5cc'],text:'NOH',
  set:{orientation:'standing',axis:'fall',mode:'solid',texture:'outline',ground:'plain',projection:'axonometric',params:{...shape0,...iso,depth:4.6,step:.6,tracking:.4,stagger:1.5,elevation:42}},note:'Deep charcoal blocks crowded together, each letter pushed further back. Pale creases on dark faces.'},
 {id:'stripe',name:'Striped slabs',after:"Expo '85, 1982",palette:'Cyan / chalk / navy / blush',colors:['#5fb2c9','#f3f0e7','#28358a','#e9b7ad','#28358a','#f1cf45'],text:'EXPO/85',
  set:{orientation:'standing',axis:'rise',mode:'solid',texture:'stripes',ground:'plain',projection:'axonometric',params:{...shape0,...iso,azimuth:27,elevation:27,depth:1.8,step:.3,tracking:.6,stagger:.6,grain:3,rods:3}},note:'Thin standing slabs with striped sides, seen in trimetric, crossed by yellow rods.'},
 {id:'neon',name:'Neon solids',after:'new — electro',palette:'Night / magenta / cyan / violet',colors:['#07060b','#ff2bd6','#19f0ff','#7a5cff','#ff2bd6','#c6ff3d'],text:'RAVE/2026',
  set:{orientation:'standing',axis:'rise',mode:'neon',texture:'flat',ground:'gradient',projection:'axonometric',params:{...shape0,...iso,elevation:30,depth:2.4,tracking:.8,wave:1.2}},note:'Near-black solids with glowing magenta, cyan and violet creases on a violet-lit ground. Letters ride a wave.'},
 {id:'pixel',name:'Pixel relief',after:'new — 2:1 pixel space',palette:'Navy / sun / coral / ocean',colors:['#1b1b3a','#ffd166','#ef476f','#118ab2','#1b1b3a','#06d6a0'],text:'TOKYO',
  set:{orientation:'standing',axis:'fall',mode:'solid',texture:'flat',ground:'plain',projection:'axonometric',params:{...shape0,...iso,azimuth:38,elevation:30,depth:.6,inset:.06,jitter:1.3,tracking:.6}},note:'Every cell a separate block pushed out by a random amount, in 2:1 pixel isometric. Lay it down for a skyline.'},
 {id:'shadow',name:'Cut shadows',after:'new — oblique',palette:'Paper / vermilion / ink',colors:['#f1ece2','#f1ece2','#e3402f','#1d1d1f','#1d1d1f','#e3402f'],text:'CUT/OUT',
  set:{orientation:'standing',axis:'fall',mode:'shadow',texture:'flat',ground:'plain',projection:'oblique',params:{...shape0,...iso,recede:38,foreshorten:.55,depth:1.6,tracking:.7,slant:.18}},note:'Cabinet oblique keeps the letter face true; only the extrusion is drawn, so letters read as cut-outs with red and black shadows.'},
 {id:'blueprint',name:'Blueprint wire',after:'new — planometric',palette:'Prussian blue / white',colors:['#143b8f','#ffffff','#9fc4ff','#6a96e6','#ffffff','#ffd84d'],text:'PLAN/B',
  set:{orientation:'lying',axis:'rise',mode:'wire',texture:'flat',ground:'floor',projection:'planometric',params:{...shape0,...iso,azimuth:60,foreshorten:1,depth:3,step:.6,grain:1}},note:'X-ray wireframes in planometric projection: plans stay true, verticals stay vertical.'}
];
export const CONTROLS=[
 {key:'depth',label:'Extrusion',group:'letters',min:.3,max:8,step:.05,value:2},
 {key:'step',label:'Step per letter',group:'letters',min:-1.5,max:1.5,step:.05,value:0},
 {key:'jitter',label:'Skyline (random cell depth)',group:'letters',min:0,max:4,step:.05,value:0},
 {key:'tracking',label:'Letter gap',group:'letters',min:0,max:3,step:.05,value:1},
 {key:'stagger',label:'Stagger',group:'letters',min:0,max:3,step:.05,value:0},
 {key:'wave',label:'Wave',group:'letters',min:0,max:3,step:.05,value:0},
 {key:'width',label:'Cell width',group:'letters',min:.6,max:1.8,step:.01,value:1},
 {key:'slant',label:'Slant',group:'letters',min:-.6,max:.6,step:.01,value:0},
 {key:'inset',label:'Block gap',group:'letters',min:0,max:.4,step:.01,value:0},
 {key:'rods',label:'Rods',group:'letters',min:0,max:6,step:1,value:0},
 {key:'azimuth',label:'Azimuth',group:'view',min:5,max:85,step:.5,value:45,uses:['axonometric','planometric']},
 {key:'elevation',label:'Elevation',group:'view',min:-70,max:80,step:.5,value:35.26,uses:['axonometric']},
 {key:'recede',label:'Receding angle',group:'view',min:10,max:80,step:.5,value:45,uses:['oblique']},
 {key:'foreshorten',label:'Depth / height scale',group:'view',min:.3,max:1.2,step:.01,value:.5,uses:['oblique','planometric']},
 {key:'grain',label:'Texture grain',group:'surface',min:1,max:6,step:1,value:2}
];
export const OPTIONS={orientation:['standing','lying'],axis:['rise','fall'],projection:['axonometric','planometric','oblique'],mode:['solid','shadow','wire','neon'],texture:['flat','outline','grid','stripes','speckle'],ground:['plain','floor','fade','gradient']};
// Whether a control can change the poster: view sliders only in the projections
// that use them, grain only on textured solid or shadow faces, or on a floor seen from above.
export const active=(key,state)=>{const c=CONTROLS.find(x=>x.key===key);if(c?.uses&&!c.uses.includes(state.projection))return false;
 return key!=='grain'||(['grid','stripes','speckle'].includes(state.texture)&&['solid','shadow'].includes(state.mode))||(state.ground==='floor'&&!(state.projection==='axonometric'&&state.params.elevation<0));};
export const W=728,H=1030;  // B-series proportion, as Japanese B1 posters

// Cell alphabet, 7 rows. # full · ◢◣◤◥ half cells (two side-by-side make a
// 45° stroke) · ╭╮╰╯ quarter discs rounding the named corner · ▼▲ tips.
export const GLYPHS={
 A:['.◢#◣.','◢◤.◥◣','#...#','#####','#...#','#...#','#...#'],
 B:['####╮','#...#','#...#','####.','#...#','#...#','####╯'],
 C:['╭###╮','#....','#....','#....','#....','#....','╰###╯'],
 D:['####╮','#...#','#...#','#...#','#...#','#...#','####╯'],
 E:['#####','#....','#....','####.','#....','#....','#####'],
 F:['#####','#....','#....','####.','#....','#....','#....'],
 G:['╭###╮','#....','#....','#.###','#...#','#...#','╰###╯'],
 H:['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
 I:['###','.#.','.#.','.#.','.#.','.#.','###'],
 J:['....#','....#','....#','....#','#...#','#...#','╰###╯'],
 K:['#..◢◤','#.◢◤.','#◢◤..','##...','#◥◣..','#.◥◣.','#..◥◣'],
 L:['#....','#....','#....','#....','#....','#....','#####'],
 M:['#◣...◢#','#◥◣.◢◤#','#.◥#◤.#','#.....#','#.....#','#.....#','#.....#'],
 N:['#...#','#◣..#','#◥◣.#','#.◥◣#','#..◥#','#...#','#...#'],
 O:['╭###╮','#...#','#...#','#...#','#...#','#...#','╰###╯'],
 P:['####╮','#...#','#...#','####╯','#....','#....','#....'],
 Q:['╭###╮','#...#','#...#','#...#','#◥◣.#','#.◥◣#','╰##◥◣'],
 R:['####╮','#...#','#...#','####╯','#.◥◣.','#..◥◣','#...#'],
 S:['╭###╮','#...#','#....','╰###╮','....#','#...#','╰###╯'],
 T:['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
 U:['#...#','#...#','#...#','#...#','#...#','#...#','╰###╯'],
 V:['#...#','#...#','#...#','#...#','◥◣.◢◤','.◥#◤.','..▼..'],
 W:['#.....#','#.....#','#.....#','#..#..#','#.◢#◣.#','#◢◤.◥◣#','#◤...◥#'],
 X:['#...#','◥◣.◢◤','.◥#◤.','..#..','.◢#◣.','◢◤.◥◣','#...#'],
 Y:['#...#','◥◣.◢◤','.◥#◤.','..#..','..#..','..#..','..#..'],
 Z:['#####','...◢#','..◢◤.','.◢◤..','◢◤...','#....','#####'],
 0:['╭###╮','#...#','#..◢#','#.◢◤#','#◢◤.#','#...#','╰###╯'],
 1:['.◢#..','◢◤#..','..#..','..#..','..#..','..#..','#####'],
 2:['╭###╮','#...#','...◢◤','..◢◤.','.◢◤..','◢◤...','#####'],
 3:['####╮','....#','....#','.####','....#','....#','####╯'],
 4:['...◢#','..◢◤#','.◢◤.#','◢◤..#','#####','....#','....#'],
 5:['#####','#....','#....','####╮','....#','#...#','╰###╯'],
 6:['╭###╮','#....','#....','####╮','#...#','#...#','╰###╯'],
 7:['#####','....#','...◢◤','..◢◤.','.◢◤..','.#...','.#...'],
 8:['╭###╮','#...#','#...#','.###.','#...#','#...#','╰###╯'],
 9:['╭###╮','#...#','#...#','╰####','....#','....#','╰###╯'],
 '.':['.','.','.','.','.','.','#'],
 ',':['.','.','.','.','.','#','◤'],
 ':':['.','.','#','.','.','.','#'],
 '-':['...','...','...','###','...','...','...'],
 '!':['#','#','#','#','#','.','#'],
 '?':['╭###╮','#...#','...◢◤','..#..','..#..','.....','..#..'],
 "'":['#','#','.','.','.','.','.']
};
export const CHARACTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:-!?\'';
const ROWS=7,ROW_GAP=2,SPACE=3,FACETS=8,TAU=Math.PI*2;
const round9=v=>Math.round(v*1e9)/1e9,arc=(cx,cy,a0,a1)=>Array.from({length:FACETS+1},(_,i)=>{const a=a0+(a1-a0)*i/FACETS;return [round9(cx+Math.cos(a)),round9(cy+Math.sin(a))];});
// Cell shapes in cell units (x right, y down) and the sides each fills completely.
const SHAPES={'#':[[0,0],[1,0],[1,1],[0,1]],'◢':[[1,0],[1,1],[0,1]],'◣':[[0,0],[1,1],[0,1]],'◤':[[0,0],[1,0],[0,1]],'◥':[[0,0],[1,0],[1,1]],
 '╭':[[1,1],...arc(1,1,Math.PI,1.5*Math.PI)],'╮':[[0,1],...arc(0,1,1.5*Math.PI,TAU)],'╰':[[1,0],...arc(1,0,.5*Math.PI,Math.PI)],'╯':[[0,0],...arc(0,0,0,.5*Math.PI)],
 '▼':[[0,0],[1,0],[.5,1]],'▲':[[.5,0],[1,1],[0,1]]};
const sideOf=([a,b],[c,d])=>a===c&&(a===0||a===1)&&Math.abs(b-d)===1?(a?'R':'L'):b===d&&(b===0||b===1)&&Math.abs(a-c)===1?(b?'B':'T'):'';
const FULL=Object.fromEntries(Object.entries(SHAPES).map(([k,p])=>[k,new Set(p.map((q,i)=>sideOf(q,p[(i+1)%p.length])).filter(Boolean))]));
const OPPOSITE={L:'R',R:'L',T:'B',B:'T'},STEP={L:[-1,0],R:[1,0],T:[0,-1],B:[0,1]};
export function glyphCells(ch){const g=GLYPHS[ch];if(!g)return {width:SPACE,cells:[]};const cells=[];g.forEach((row,y)=>[...row].forEach((c,x)=>{if(SHAPES[c])cells.push({x,y,c});}));return {width:Math.max(...g.map(r=>[...r].length)),cells};}

// World space: Y is up; the viewer is on the +X/+Z side. The letter plane is
// spanned by U (reading direction) and V (letter up); prisms extrude along E.
// Roles name the colour each axis's faces take.
const AXES={
 'standing-rise':{U:[0,0,-1],V:[0,1,0],E:[-1,0,0],roles:{X:'cap',Y:'a',Z:'b'}},
 'standing-fall':{U:[1,0,0],V:[0,1,0],E:[0,0,-1],roles:{Z:'cap',Y:'a',X:'b'}},
 'lying-rise':{U:[0,0,-1],V:[-1,0,0],E:[0,1,0],roles:{Y:'cap',X:'a',Z:'b'}},
 'lying-fall':{U:[1,0,0],V:[0,0,-1],E:[0,1,0],roles:{Y:'cap',X:'a',Z:'b'}}
};
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/Math.hypot(...a));
export const n=v=>Math.round(v*100)/100;
// Parallel projections as a 2 × 3 matrix (screen x, screen y down) and the
// direction toward the viewer, which decides visibility and drawing order.
// Azimuth is measured from the letter face (0° faces it head-on), so a view
// preset looks the same whichever way the text runs.
function space(state){const ax=AXES[state.orientation+'-'+state.axis],p=state.params,rad=Math.PI/180,az=state.axis==='rise'?90-p.azimuth:p.azimuth;let M,view;
 if(state.projection==='axonometric'){const t=az*rad,e=p.elevation*rad,right=[Math.cos(t),0,-Math.sin(t)],up=[-Math.sin(e)*Math.sin(t),Math.cos(e),-Math.sin(e)*Math.cos(t)];
  M=[right,mul(up,-1)];view=[Math.cos(e)*Math.sin(t),Math.sin(e),Math.cos(e)*Math.cos(t)];}
 else{let X,Y,Z;if(state.projection==='planometric'){const a=az*rad;X=[Math.sin(a),Math.cos(a)];Z=[-Math.cos(a),Math.sin(a)];Y=[0,-p.foreshorten];}
  else{const r=p.recede*rad;X=[1,0];Y=[0,-1];Z=[-Math.cos(r)*p.foreshorten,Math.sin(r)*p.foreshorten];}
  M=[[X[0],Y[0],Z[0]],[X[1],Y[1],Z[1]]];let d=cross(M[0],M[1]);if(d[0]+d[1]+d[2]<0)d=mul(d,-1);view=unit(d);}
 const flat=add(view,mul(ax.E,-dot(view,ax.E)));
 return {...ax,view,flat,project:q=>[dot(M[0],q),dot(M[1],q)],at:(u,v,w)=>add(add(mul(ax.U,u),mul(ax.V,v)),mul(ax.E,w))};}

// Colours
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));
const luminance=h=>{const [r,g,b]=rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
export const inkFor=ground=>luminance(ground)>.22?'#141414':'#f4f1ea';
function seeded(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return ((r^r>>>14)>>>0)/4294967296;};}
const hashText=s=>[...s].reduce((h,ch)=>Math.imul(h^ch.codePointAt(0),16777619)>>>0,2166136261);

// Text input: A–Z, 0–9, . , : - ! ? ' and spaces; '/' breaks up to three rows.
export function normalizeWord(input,fallback){
 const t=String(input??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[‘’`´]/g,"'").replace(/[–—]/g,'-').toUpperCase().replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ').trim();
 if(!t){if(fallback!==undefined)return fallback;throw new Error('Type at least one letter.');}
 if(!/^[A-Z0-9 .,:\-!?'/]+$/.test(t))throw new Error("Use A–Z, 0–9, spaces and . , : - ! ? ' — / starts a new row.");
 const rows=t.split('/');if(rows.length>3)throw new Error('Use at most three rows.');if(rows.some(r=>!r.trim()))throw new Error('Rows cannot be empty.');
 if(t.replace(/[ /]/g,'').length>24)throw new Error('Use at most 24 characters.');return rows.map(r=>r.trim()).join('/');}

const clampNum=(v,c)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.min(c.max,Math.max(c.min,c.step>=1?Math.round(+v):+v)):c.value;
export function resolve(input={}){
 const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],set=family.set,given={...input.params};
 // Version 1 rules stored a symmetric axis angle; the same view is an elevation of asin(tan angle).
 if(given.angle!==undefined&&given.elevation===undefined&&Number.isFinite(+given.angle))given.elevation=Math.asin(Math.min(1,Math.tan(+given.angle*Math.PI/180)))*180/Math.PI;
 const params={};for(const c of CONTROLS)params[c.key]=clampNum(given[c.key]??set.params[c.key],{...c,value:set.params[c.key]});
 const pick=k=>OPTIONS[k].includes(input[k])?input[k]:set[k];let text;try{text=normalizeWord(input.text,family.text);}catch{text=family.text;}
 const colors=Array.isArray(input.colors)&&input.colors.length===6&&input.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))?input.colors.map(c=>c.toLowerCase()):[...family.colors];
 const clip=(v,d,max)=>typeof v==='string'?v.replace(/[<>&]/g,'').slice(0,max):d;
 return {engine:ENGINE,family:family.id,text,title:clip(input.title,'ISOMETRIC PRISM LETTERS',48),info:clip(input.info,'Type system study after Takenobu Igarashi / 1980–1985 / any text, any view',120),
  stage:[1,2,3,4].includes(+input.stage)?+input.stage:4,orientation:pick('orientation'),axis:pick('axis'),projection:pick('projection'),mode:pick('mode'),texture:pick('texture'),ground:pick('ground'),params,colors};}

// Scene: one prism per cell (and per rod segment), in letter-plane units. Each
// cell keeps its own affine map from cell units, so width, slant and wave
// deform the letter plane without breaking the cell grid that textures follow.
export function scene(state){
 const S=space(state),p=state.params,rows=state.text.split('/'),prisms=[],glyphs=[],rand=seeded(hashText(state.text)^0x51ed);
 const advance=g=>g.width*(g.cells.length?p.width:1);
 const widths=rows.map(r=>[...r].reduce((w,ch,i)=>w+advance(glyphCells(ch))+(i?p.tracking:0),0)),maxW=Math.max(...widths);
 rows.forEach((row,r)=>{let u=(maxW-widths[r])/2,k=0;const top=-r*(ROWS+ROW_GAP);
  for(const ch of row){const g=glyphCells(ch);if(g.cells.length){
    const depth=Math.max(.25,p.depth+p.step*k),shift=k%2?p.stagger:0,w0=state.orientation==='standing'?shift:0,dv=(state.orientation==='lying'?-shift:0)+p.wave*Math.sin(k*1.1),gtop=top+dv,base=gtop-ROWS;
    const at=new Map(g.cells.map(c=>[c.x+','+c.y,c.c])),index=glyphs.length,solid=p.inset===0&&p.jitter===0;glyphs.push({ch,row:r,u,top:gtop,width:g.width*p.width,depth,w0});
    for(const cell of g.cells){let local=SHAPES[cell.c].map(([x,y])=>[x,y]);
     const cull=new Set();if(solid)local.forEach((q,i)=>{const side=sideOf(q,local[(i+1)%local.length]);if(!side)return;const [dx,dy]=STEP[side],other=at.get((cell.x+dx)+','+(cell.y+dy));if(other&&FULL[other].has(OPPOSITE[side]))cull.add(i);});
     if(p.inset>0){const cx=local.reduce((s,q)=>s+q[0],0)/local.length,cy=local.reduce((s,q)=>s+q[1],0)/local.length,f=1-2*p.inset;local=local.map(([x,y])=>[cx+(x-cx)*f,cy+(y-cy)*f]);}
     // Skyline jitter grows each cell toward the viewer: standing cells protrude, lying cells rise.
     const ou=u+cell.x*p.width,ov=gtop-cell.y,map=(x,y)=>{const v=ov-y;return [ou+x*p.width+(v-base)*p.slant,v];},j=p.jitter?p.jitter*rand():0,c0=state.orientation==='standing'?w0-j:w0;
     prisms.push({kind:'cell',glyph:index,ch,cell:[cell.x,cell.y],shape:cell.c,origin:[ou,ov],base,map,local,poly:local.map(([x,y])=>map(x,y)),w0:c0,w1:c0+depth+j,cull});}
    k++;}
   u+=advance(g)+p.tracking;}});
 // Rods run along U at evenly spread heights and depths. They are cut where
 // they cross letter-cell edges, so no rod piece half-covers a cell, and the
 // pieces inside a full cell are hidden.
 if(p.rods>0&&glyphs.length){const vs=glyphs.flatMap(g=>[g.top,g.top-ROWS]),vTop=Math.max(...vs),vBottom=Math.min(...vs),dMax=Math.max(...prisms.map(q=>q.w1)),t=.5,cells=prisms.slice();
  for(let j=0;j<p.rods;j++){const v=Math.floor(vBottom+(j+.5)/p.rods*(vTop-vBottom))+.25,w=n(dMax*(.18+.64*((j*.618034+.31)%1))),mid=v+t/2;
   const near=cells.filter(q=>q.origin[1]-1<v+t-1e-9&&q.origin[1]>v+1e-9),span=q=>{const s=(mid-q.base)*p.slant;return [n(q.origin[0]+s),n(q.origin[0]+p.width+s)];},cuts=new Set();
   for(let x=-3;x<=Math.ceil(maxW)+3;x++)cuts.add(x);for(const q of near){const [a,b]=span(q);cuts.add(a);cuts.add(b);}
   const xs=[...cuts].sort((a,b)=>a-b),segs=[];
   for(let i=0;i<xs.length-1;i++){const [x0,x1]=[xs[i],xs[i+1]],cover=near.filter(q=>{const [a,b]=span(q);return a<=x0+1e-9&&b>=x1-1e-9;});
    if(cover.some(q=>q.shape==='#'&&p.inset===0&&q.origin[1]-1<=v&&q.origin[1]>=v+t&&w>=q.w0&&w+t<=q.w1))continue;segs.push([x0,x1]);}
   segs.forEach(([x0,x1],i)=>{const cull=new Set();if(i&&segs[i-1][1]===x0)cull.add(3);if(segs[i+1]?.[0]===x1)cull.add(1);
    prisms.push({kind:'rod',rod:j,poly:[[x0,v+t],[x1,v+t],[x1,v],[x0,v]],w0:w,w1:w+t,cull});});}}
 // Back to front: by column footprint across the view, then along the extrusion.
 const toward=dot(S.view,S.E);for(const q of prisms){const cu=q.poly.reduce((s,z)=>s+z[0],0)/q.poly.length,cv=q.poly.reduce((s,z)=>s+z[1],0)/q.poly.length;q.key=[dot(S.at(cu,cv,0),S.flat),(q.w0+q.w1)/2*toward];}
 prisms.sort((a,b)=>a.key[0]-b.key[0]||a.key[1]-b.key[1]);return {S,prisms,glyphs,rows,maxW};}

// Faces of one prism: visible sides, then the visible end cap. `edges` are the
// creases an outline draws: exposed cap edges, both ends of a side, and
// extrusion edges only where the letter outline turns a corner.
function crease(q,i){const m=q.poly.length,j=(i-1+m)%m;if(q.cull.has(i)||q.cull.has(j))return false;const dir=k=>{const a=q.poly[k],b=q.poly[(k+1)%m];return Math.atan2(b[1]-a[1],b[0]-a[0]);};let d=Math.abs(dir(i)-dir(j))%TAU;d=Math.min(d,TAU-d);return d>.45;}
function faces(q,S){const out=[],{poly,w0,w1}=q,toward=dot(S.view,S.E)>0,capW=toward?w1:w0,capN=mul(S.E,toward?1:-1);
 const P=poly.map(([u,v])=>S.at(u,v,0)),cen=P.reduce((s,z)=>add(s,z),[0,0,0]).map(v=>v/P.length),edge=mul(S.E,w1-w0),m=P.length;
 P.forEach((a,i)=>{if(q.cull.has(i))return;const b=P[(i+1)%m],e=add(b,mul(a,-1));if(Math.hypot(...e)<1e-9)return;let nrm=unit(cross(e,S.E));if(dot(nrm,add(mul(add(a,b),.5),mul(cen,-1)))<0)nrm=mul(nrm,-1);
  if(dot(nrm,S.view)<=1e-9)return;const a0=add(a,mul(S.E,w0)),b0=add(b,mul(S.E,w0)),a1=add(a0,edge),b1=add(b0,edge);
  out.push({type:'side',normal:nrm,pts:[a0,b0,b1,a1],along:e,depth:w1-w0,edges:[[a0,b0],[a1,b1],...(crease(q,i)?[[a0,a1]]:[]),...(crease(q,(i+1)%m)?[[b0,b1]]:[])]});});
 const C=P.map(z=>add(z,mul(S.E,capW)));out.push({type:'cap',normal:capN,pts:C,capW,edges:C.map((a,i)=>[a,C[(i+1)%m]]).filter((_,i)=>!q.cull.has(i))});return out;}
// The whole prism as lines, hidden edges included (wire mode).
function wire(q,S){const P=q.poly.map(([u,v])=>S.at(u,v,0)),m=P.length,A=P.map(z=>add(z,mul(S.E,q.w0))),B=P.map(z=>add(z,mul(S.E,q.w1))),front=[],back=[],posts=[];
 for(let i=0;i<m;i++){if(!q.cull.has(i)){front.push([A[i],A[(i+1)%m]]);back.push([B[i],B[(i+1)%m]]);}if(crease(q,i))posts.push([A[i],B[i]]);}
 return dot(S.view,S.E)>0?{front:back,back:front,posts}:{front,back,posts};}
// Faces take the colour of the axis they face; diagonal and curved faces blend.
function shade(normal,S,cols){let r=0,g=0,b=0,sum=0;
 ['X','Y','Z'].forEach((k,i)=>{const w=normal[i]**2;if(w<1e-9)return;const c=rgb(cols[S.roles[k]]);r+=c[0]*w;g+=c[1]*w;b+=c[2]*w;sum+=w;});return hex([r/sum,g/sum,b/sum]);}

// Texture marks for one face, in world space.
function marks(face,q,state,rand){const p=state.params,step=1/p.grain,out={lines:[],dots:[]};
 if(state.texture==='grid'||state.texture==='stripes'){
  if(face.type==='side'){const L=Math.hypot(...face.along),d=face.depth,ue=mul(face.along,1/L),E=add(face.pts[3],mul(face.pts[0],-1));
   if(state.texture==='grid')for(let k=step;k<d-1e-6;k+=step){const o=mul(E,k/d);out.lines.push([add(face.pts[0],o),add(face.pts[1],o)]);}
   const pitch=state.texture==='grid'?step:step/2;for(let k=pitch;k<L-1e-6;k+=pitch){const o=add(face.pts[0],mul(ue,k));out.lines.push([o,add(o,E)]);}}
  else if(q.local){// Lines follow the cell's own grid, so cubes stay square however the letter is spaced or slanted.
   const clip=(axis,val)=>{const hits=[];q.local.forEach((a,i)=>{const b=q.local[(i+1)%q.local.length],t=(val-a[axis])/(b[axis]-a[axis]);if(a[axis]!==b[axis]&&t>=0&&t<=1)hits.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);});
    if(hits.length<2)return;hits.sort((m,o)=>m[1-axis]-o[1-axis]);const A=hits[0],B=hits[hits.length-1];if(Math.hypot(A[0]-B[0],A[1]-B[1])<1e-6)return;out.lines.push([A,B].map(([x,y])=>{const [u,v]=q.map(x,y);return face.world(u,v);}));};
   for(let k=1;k<p.grain;k++){if(state.texture==='grid')clip(0,k*step);clip(1,k*step);}}}
 if(state.texture==='speckle'){const [a,b,,d]=face.pts,count=Math.round(face.screenArea*.006*p.grain*p.grain);
  for(let i=0;i<count;i++){let pt;if(face.type==='side'){const s=rand(),t=rand();pt=add(add(a,mul(add(b,mul(a,-1)),s)),mul(add(d,mul(a,-1)),t));}
   else{const tri=face.tris[Math.min(face.tris.length-1,Math.floor(rand()*face.tris.length))];let s=rand(),t=rand();if(s+t>1){s=1-s;t=1-t;}pt=add(add(tri[0],mul(add(tri[1],mul(tri[0],-1)),s)),mul(add(tri[2],mul(tri[0],-1)),t));}
   out.dots.push(pt);}}
 return out;}

function fit(points,box,scale){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),[bx0,by0,bx1,by1]=box;
 const k=scale??Math.min((bx1-bx0)/Math.max(1e-6,x1-x0),(by1-by0)/Math.max(1e-6,y1-y0));return {k,map:([x,y])=>[n(bx0+(bx1-bx0-(x1-x0)*k)/2+(x-x0)*k),n(by0+(by1-by0-(y1-y0)*k)/2+(y-y0)*k)],bounds:[x0,y0,x1,y1]};}
const pathD=pts=>'M'+pts.map(p=>p.join(' ')).join('L')+'Z',segD=(segs,P)=>segs.map(([p,r])=>`M${P(p).join(' ')}L${P(r).join(' ')}`).join('');

// Draws the prisms (stages 2–4) or the flat skeleton (stage 1) into a box.
function drawScene(state,box,{scale,uid='s'}={}){const sc=scene(state),{S,prisms}=sc,[ground,cap,a,b,line,accent]=state.colors,cols={cap,a,b},stage=state.stage,rand=seeded(hashText(state.text+state.family+state.texture));
 const out=[],feat={glyphs:sc.glyphs.length,prisms:prisms.length,faces:0,rods:state.params.rods};
 if(stage===1){const cells=prisms.filter(q=>q.kind==='cell'),pts=cells.flatMap(q=>q.poly.map(([u,v])=>[u,-v]));const F=fit(pts,box,scale);
  let grid='';for(const q of cells){const c=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>F.map((([u,v])=>[u,-v])(q.map(x,y))));grid+=pathD(c);}
  out.push(`<path d="${grid}" stroke="${line}" stroke-opacity=".35" stroke-width=".6" fill="none"/><path d="${cells.map(q=>pathD(q.poly.map(([u,v])=>F.map([u,-v])))).join('')}" fill="${state.mode==='shadow'?a:cap}"/>`);return {svg:out.join(''),features:{...feat,scale:n(F.k)}};}
 const all=[];for(const q of prisms)for(const f of faces(q,S))all.push({q,f});
 // Floor: a tiled ground plane under the letters, ruled at the texture grain; skipped when seen from below.
 let floor=null;if(stage===4&&state.ground==='floor'&&S.view[1]>0){const us=prisms.flatMap(q=>q.poly.map(z=>z[0])),vs=prisms.flatMap(q=>q.poly.map(z=>z[1])),u0=Math.floor(Math.min(...us))-1,u1=Math.ceil(Math.max(...us))+1,g=state.params.grain;
  const ruled=(a0,a1,b0,b1,pt)=>[...Array((a1-a0)*g+1).keys()].map(i=>[pt(a0+i/g,b0),pt(a0+i/g,b1)]).concat([...Array((b1-b0)*g+1).keys()].map(j=>[pt(a0,b0+j/g),pt(a1,b0+j/g)]));
  if(state.orientation==='lying'){const v0=Math.floor(Math.min(...vs))-1,v1=Math.ceil(Math.max(...vs))+1,pt=(u,v)=>S.at(u,v,0);floor={corners:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>pt(u,v)),lines:ruled(u0,u1,v0,v1,pt)};}
  else{const v=Math.floor(Math.min(...vs)),w1=Math.ceil(Math.max(...prisms.map(q=>q.w1)))+1,pt=(u,w)=>S.at(u,v,w);floor={corners:[[u0,-1],[u1,-1],[u1,w1],[u0,w1]].map(([u,w])=>pt(u,w)),lines:ruled(u0,u1,-1,w1,pt)};}}
 const projected=all.flatMap(({f})=>f.pts.map(S.project)).concat(floor?floor.corners.map(S.project):[]);const F=fit(projected,box,scale),P=p=>F.map(S.project(p));
 if(floor)out.push(`${state.mode==='wire'||state.mode==='neon'?'':`<path d="${pathD(floor.corners.map(P))}" fill="${mix(ground,'#ffffff',.86)}"/>`}<path d="${segD(floor.lines,P)}" stroke="${state.mode==='wire'||state.mode==='neon'?a:line}" stroke-opacity="${state.mode==='wire'?.35:.55}" stroke-width=".55" fill="none"/>`);
 const mode=stage===2?'projected':state.mode,textured=stage===4&&state.texture!=='flat'&&(mode==='solid'||mode==='shadow'),cubes=textured&&state.texture==='grid',creases=stage>=3&&state.texture==='outline';
 if(mode==='wire'){const lines={front:[],back:[],posts:[]};for(const q of prisms){const w=wire(q,S);for(const k in lines)lines[k].push(...w[k]);}feat.faces=all.length;
  out.push(`<path d="${segD(lines.back,P)}" stroke="${a}" stroke-opacity=".7" stroke-width=".6" fill="none"/><path d="${segD(lines.posts,P)}" stroke="${b}" stroke-width=".6" fill="none"/><path d="${segD(lines.front,P)}" stroke="${cap}" stroke-width="1.1" stroke-linejoin="round" fill="none"/>`);
  return {svg:out.join(''),features:{...feat,scale:n(F.k),bounds:F.bounds.map(n)},sceneData:sc,map:P};}
 const body=[];
 for(const {q,f} of all){const pts=f.pts.map(P);feat.faces++;
  if(mode==='projected'){if(f.type==='cap'){const back=q.poly.map(([u,v])=>P(S.at(u,v,f.capW===q.w0?q.w1:q.w0)));body.push(`<path d="${pathD(back)}${f.pts.map((p,i)=>`M${pts[i].join(' ')}L${back[i].join(' ')}`).join('')}" fill="none" stroke="${line}" stroke-opacity=".6" stroke-width=".5"/><path d="${pathD(pts)}" fill="${q.kind==='rod'?accent:cap}" fill-opacity=".92" stroke="${line}" stroke-width=".5"/>`);}continue;}
  const set=q.kind==='rod'?{cap:q.rod%2?line:accent,a:mix(q.rod%2?line:accent,'#000000',.18),b:mix(q.rod%2?line:accent,'#000000',.36)}:cols,tone=shade(f.normal,S,set);
  if(mode==='neon'){const fill=mix(ground,tone,.13);body.push(`<path d="${pathD(pts)}" fill="${fill}" stroke="${fill}" stroke-width=".5" stroke-linejoin="round"/>`);if(f.edges.length)body.push(`<path d="${segD(f.edges,P)}" stroke="${tone}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`);continue;}
  const cut=mode==='shadow'&&f.type==='cap'&&q.kind==='cell',fill=cut?ground:tone;
  body.push(`<path d="${pathD(pts)}" fill="${fill}" stroke="${cubes&&!cut?line:fill}" stroke-width="${cubes?.45:.5}" stroke-linejoin="round"/>`);
  // Shadow mode leaves the letter face blank; a fine line keeps the cut edge readable.
  if(cut&&f.edges.length)body.push(`<path d="${segD(f.edges,P)}" stroke="${line}" stroke-width=".7" stroke-linecap="round" fill="none"/>`);
  else if(creases&&f.edges.length)body.push(`<path d="${segD(f.edges,P)}" stroke="${line}" stroke-width=".8" stroke-linecap="round" fill="none"/>`);
  if(textured&&q.kind==='cell'&&!(mode==='shadow'&&f.type==='cap')){if(f.type==='cap'){f.world=(u,v)=>S.at(u,v,f.capW);f.tris=f.pts.slice(1,-1).map((p,i)=>[f.pts[0],p,f.pts[i+2]]);}
   f.screenArea=Math.abs(pts.reduce((s,[x,y],i)=>{const [u,v]=pts[(i+1)%pts.length];return s+x*v-u*y;},0))/2;const m=marks(f,q,state,rand);
   if(m.lines.length)body.push(`<path d="${segD(m.lines,P)}" stroke="${line}" stroke-width="${state.texture==='grid'?.4:.5}" stroke-opacity="${state.texture==='grid'?.85:.6}" fill="none"/>`);
   if(m.dots.length)body.push(`<path d="${m.dots.map(p=>{const [x,y]=P(p);return `M${x} ${y}h0`;}).join('')}" stroke="${line}" stroke-width="${n(.9+rand()*.4)}" stroke-linecap="round" fill="none"/>`);}}
 if(mode==='neon')out.push(`<filter id="glow-${uid}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><g filter="url(#glow-${uid})">${body.join('')}</g>`);else out.push(body.join(''));
 return {svg:out.join(''),features:{...feat,scale:n(F.k),bounds:F.bounds.map(n)},sceneData:sc,map:P};}

// Speckle that thickens toward the foot of the poster, as in the 1982 Jazz poster.
function fade(state,ink){const rand=seeded(hashText(state.text)+7),band=H*.3,dots=[];for(let i=0;i<14000;i++){const y=H-rand()*band,x=rand()*W,depth=(y-(H-band))/band;if(rand()<depth**1.7)dots.push(`M${n(x)} ${n(y)}h0`);}
 return `<path d="${dots.join('')}" stroke="${ink}" stroke-width="1.35" stroke-linecap="round" fill="none"/>`;}
function headerSVG(state,ink){const lines=state.info.split('/').map(s=>s.trim()).filter(Boolean).slice(0,3),esc=s=>s.replace(/[<>&]/g,'');
 return `<g font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" fill="${ink}"><text x="44" y="68" font-size="21" letter-spacing=".6">${esc(state.title)}</text><path d="M44 80H${W-44}" stroke="${ink}" stroke-width=".8"/>${lines.map((l,i)=>`<text x="44" y="${102+i*16}" font-size="11.5" letter-spacing=".2">${esc(l)}</text>`).join('')}</g>`;}
const uidOf=state=>hashText(JSON.stringify(state)).toString(36);
const boxFor=stage=>stage===4?[44,184,W-44,H-60]:[44,60,W-44,H-60];

export function render(input={}){const state=resolve(input),[ground,,,,,accent]=state.colors,ink=inkFor(ground),uid=uidOf(state),drawn=drawScene(state,boxFor(state.stage),{uid});
 const parts=[state.stage===4&&state.ground==='gradient'?`<linearGradient id="ground-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ground}"/><stop offset="1" stop-color="${mix(ground,accent===ground?'#ffffff':state.colors[3],.42)}"/></linearGradient><rect width="${W}" height="${H}" fill="url(#ground-${uid})"/>`:`<rect width="${W}" height="${H}" fill="${ground}"/>`];
 if(state.stage===4&&state.ground==='fade')parts.push(fade(state,ink));parts.push(`<g data-stage="${state.stage}">${drawn.svg}</g>`);if(state.stage===4)parts.push(headerSVG(state,ink));
 const label={1:'cell skeleton',2:'projected cells',3:'extruded prisms',4:'poster'}[state.stage];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${state.text.replaceAll('/',' / ')} — isometric prism letters, ${state.family}, ${label}</title>${parts.join('')}</svg>`;
 return {svg,state,width:W,height:H,features:{...drawn.features,rows:state.text.split('/').length,stage:state.stage},rows:state.text.split('/')};}

// Every glyph in the family style: one cell each, all at the scale that fits the widest glyph.
export function specimen(input={}){const state=resolve({...input,stage:3}),cols=11,cw=180,ch=230,w=cols*cw+40,h=Math.ceil(CHARACTERS.length/cols)*ch+40,parts=[`<rect width="${w}" height="${h}" fill="${state.colors[0]}"/>`],uid=uidOf(state);
 const one=(text,box,scale,i)=>drawScene({...state,text,params:{...state.params,step:0,stagger:0,wave:0,rods:0}},box,{scale,uid:uid+'-'+i});
 const box=i=>[20+(i%cols)*cw+12,20+Math.floor(i/cols)*ch+12,20+(i%cols+1)*cw-12,20+(Math.floor(i/cols)+1)*ch-12],scale=one('M',box(0),undefined,'m').features.scale;
 [...CHARACTERS].forEach((c,i)=>parts.push(`<g data-glyph="${c.replace(/["'<>&]/g,m=>'&#'+m.charCodeAt(0)+';')}">${one(c,box(i),scale,i).svg}</g>`));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;}

// Projected centre of every full cell's visible end, for occlusion probes.
export function capCenters(input={}){const state=resolve(input),d=drawScene(state,boxFor(state.stage));if(!d.sceneData)return [];
 return d.sceneData.prisms.filter(q=>q.kind==='cell'&&q.shape==='#').map(q=>{const cu=q.poly.reduce((s,z)=>s+z[0],0)/4,cv=q.poly.reduce((s,z)=>s+z[1],0)/4,toward=dot(d.sceneData.S.view,d.sceneData.S.E)>0;return {ch:q.ch,cell:q.cell,at:d.map(d.sceneData.S.at(cu,cv,toward?q.w1:q.w0))};});}
