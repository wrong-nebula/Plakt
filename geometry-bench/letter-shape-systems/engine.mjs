/* PosterLab — original procedural letter studies.
 * The coarse alphabet below is hand-authored for this experiment.
 * References inform construction principles, not traced source contours.
 */
export const ALPHABET = {
 A:['01110','10001','10001','11111','10001','10001','10001'],
 B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01110'],
 H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 N:['10001','11001','11001','10101','10011','10011','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],
 V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','11011','10001'],
 X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 0:['01110','10001','10011','10101','11001','10001','01110'],
 1:['00100','01100','00100','00100','00100','00100','01110'],
 2:['01110','10001','00001','00010','00100','01000','11111'],
 3:['11110','00001','00001','01110','00001','00001','11110'],
 4:['00010','00110','01010','10010','11111','00010','00010'],
 5:['11111','10000','10000','11110','00001','00001','11110'],
 6:['01111','10000','10000','11110','10001','10001','01110'],
 7:['11111','00001','00010','00100','01000','01000','01000'],
 8:['01110','10001','10001','01110','10001','10001','01110'],
 9:['01110','10001','10001','01111','00001','00001','11110'],
 ' ':['00000','00000','00000','00000','00000','00000','00000'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 '.':['00000','00000','00000','00000','00000','00110','00110']
};

export const SYSTEMS = [
 {id:'scallop',name:'Scalloped boundaries',short:'SCALLOP',number:'01',
  rule:'Join the occupied cells into a letter. Add identical lobes only along exposed edges, including the edges of counters. Shared edges stay smooth.',
  primitives:'Rectangular cell + boundary disc',colors:['#a88bf4','#20211f'],
  controls:[{key:'depth',label:'Lobe depth',min:0.08,max:0.75,step:0.01,value:0.46},{key:'lobes',label:'Lobes per edge',min:1,max:4,step:1,value:2}],
  sources:['6ab7c9955fdcf4ca11eb84a4-p0','5e5b65b8f544582ee0f267dd-p0']},
 {id:'capsules',name:'Capsule columns',short:'CAPSULE',number:'02',
  rule:'Read each letter column from top to bottom. Compress each uninterrupted run into one rounded capsule. A shared seam width separates neighbouring columns.',
  primitives:'One variable-length capsule',colors:['#f2869d','#412027'],
  controls:[{key:'roundness',label:'End roundness',min:0.04,max:0.5,step:0.01,value:0.49},{key:'gap',label:'Column seam',min:0,max:0.22,step:0.005,value:0.025}],
  sources:['9fe9752772b71b4693b6dadd-p0','ab7f2e333f83fb9410cd302d-p0']},
 {id:'quarter',name:'Rotating counter tiles',short:'COUNTER',number:'03',
  rule:'Use one square with a circular bite at its corner. Quarter-turns of that single tile build the letter; the removed quarters create a second rhythm in the counterspace.',
  primitives:'Square minus corner disc; four orientations',colors:['#ed482e','#243ec9'],
  controls:[{key:'bite',label:'Counter cut',min:0.15,max:0.9,step:0.01,value:0.66},{key:'gap',label:'Tile seam',min:0,max:0.16,step:0.005,value:0.012}],
  sources:['1b448f29749cfb8bf715e524-p0','b773e557a16bff5f7e18bda5-p0']},
 {id:'rings',name:'Perforated disc network',short:'POROUS',number:'04',
  rule:'Place a perforated disc at every occupied cell. Bridge horizontal, vertical and necessary diagonal neighbours, then punch each disc again so holes survive every overlap.',
  primitives:'Disc + connecting neck - central hole',colors:['#e4eb7c','#263c31'],
  controls:[{key:'radius',label:'Disc radius',min:0.36,max:0.59,step:0.01,value:0.53},{key:'hole',label:'Perforation',min:0.03,max:0.34,step:0.01,value:0.15}],
  sources:['163ec2ac135da6e8d52f180c-p0','5e5b65b8f544582ee0f267dd-p0']},
 {id:'slices',name:'Displaced horizontal slices',short:'SLICES',number:'05',
  rule:'Intersect the entire handmade letter with evenly pitched horizontal strips. Translate alternate strips left and right; narrow open channels preserve the slicing rhythm.',
  primitives:'Letter region intersected with displaced strip',colors:['#f1efe6','#242421'],
  controls:[{key:'bands',label:'Horizontal slices',min:7,max:35,step:1,value:22},{key:'shift',label:'Displacement',min:0,max:0.6,step:0.01,value:0.18}],
  sources:['3a9c23cb961fc6c772f18d8b-p0','f5042b765fe53291ff2a3618-p0']},
 {id:'hinges',name:'Hinged rails',short:'HINGES',number:'06',
  rule:'Convert neighbouring occupied cells into a graph. Replace every edge with a three-segment bent rail. Diamond joints make each change of direction explicit.',
  primitives:'Bent rail + diamond joint',colors:['#f5ca55','#71384f'],
  controls:[{key:'thickness',label:'Rail width',min:0.14,max:0.85,step:0.01,value:0.51},{key:'kink',label:'Hinge offset',min:0,max:0.42,step:0.01,value:0.21}],
  sources:['b773e557a16bff5f7e18bda5-p0','ab7f2e333f83fb9410cd302d-p0']}
];
const n = v => Number(v.toFixed(4));
const rect = (x,y,w,h,fill,extra='') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra}/>`;
const circle = (x,y,r,fill) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"/>`;
const path = (d,fill,extra='') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const safeColor = (s,fallback) => /^#[\da-f]{6}$/i.test(s ?? '') ? s : fallback;
export function hash32(s) {let h=2166136261; for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0;}
export function normalizeText(value='FU/BU') {
 const text=String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\r?\n/g,'/');
 const unsupported=[...new Set([...text].filter(c=>!/[A-Z0-9 /-]/.test(c)))];
 if(unsupported.length) throw new Error(`Use A-Z, 0-9, spaces, hyphens and / for line breaks. Unsupported: ${unsupported.join(' ')}`);
 const count=[...text.replace(/\//g,'')].length;
 if(!text.replace(/[ /]/g,'')) throw new Error('Enter at least one letter or number.');
 if(count>36) throw new Error('Keep the study to 36 characters or fewer.');
 if(text.split('/').length>8) throw new Error('Use eight rows or fewer.');
 return text;
}
export function resolveState(input={}) {
 const system=SYSTEMS.find(s=>s.id===input.system) ?? SYSTEMS[0];
 const params={};
 for(const c of system.controls){const raw=Number(input.params?.[c.key] ?? c.value);params[c.key]=Math.min(c.max,Math.max(c.min,Number.isFinite(raw)?raw:c.value));if(c.step===1)params[c.key]=Math.round(params[c.key]);}
 return {version:1,system:system.id,text:normalizeText(input.text),seed:String(input.seed??'817').slice(0,64),params,
  colors:[safeColor(input.colors?.[0],system.colors[0]),safeColor(input.colors?.[1],system.colors[1])],invert:!!input.invert};
}
function occupied(a,x,y){return x>=0&&x<5&&y>=0&&y<7&&a[y][x]==='1';}
function cells(a){const out=[];for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(occupied(a,x,y))out.push([x,y]);return out;}
function links(a){const out=[];for(const [x,y] of cells(a))for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){
 if(occupied(a,x+dx,y+dy)&&(!(dx&&dy)||(!occupied(a,x+dx,y)&&!occupied(a,x,y+dy))))out.push([x,y,x+dx,y+dy]);
 }return out;}
function blockGeometry(a){return cells(a).map(([x,y])=>`M${x} ${y}h1v1h-1Z`).join('');}
function tinyText(value,x,y,scale,ink){
 let d='';let col=0;for(const ch of value.toUpperCase()){
 const a=ALPHABET[ch]??ALPHABET[' '];for(const [cx,cy] of cells(a)){const px=n(x+(col+cx)*scale),py=n(y+cy*scale);d+=`M${px} ${py}h${n(scale*.88)}v${n(scale*.88)}h-${n(scale*.88)}Z`;}
 col+=6;}return path(d,ink);
}
function glyphGeometry(ch,id,p,ink,paper,seed,prefix){
 const a=ALPHABET[ch]??ALPHABET[' '], cs=cells(a);let out='';
 if(id==='scallop'){
  out=path(blockGeometry(a),ink);
  for(const [x,y] of cs)for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]])if(!occupied(a,x+dx,y+dy)){
   for(let j=0;j<p.lobes;j++){
    const t=(j+.5)/p.lobes;
    const cx=dx===0?x+t:x+(dx>0?1:0),cy=dy===0?y+t:y+(dy>0?1:0);
    out+=circle(cx,cy,p.depth/p.lobes,ink);
   }
  }
 } else if(id==='capsules'){
  for(let x=0;x<5;x++)for(let y=0;y<7;){
   if(!occupied(a,x,y)){y++;continue;}const start=y;while(y<7&&occupied(a,x,y))y++;
   const gap=p.gap,w=1-gap,h=y-start-gap;
   out+=rect(x+gap/2,start+gap/2,w,h,ink,`rx="${n(Math.min(w/2,p.roundness))}"`);
  }
 } else if(id==='quarter'){
  cs.forEach(([x,y],i)=>{
   const gap=p.gap,g=1-gap,c=(hash32(`${seed}:${x}:${y}`)%4),r=p.bite*g;
   const masks=`${prefix}-t${i}`,cx=x+gap/2+(c%2?g:0),cy=y+gap/2+(c>1?g:0);
   out+=`<defs><mask id="${masks}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="1" height="1">${rect(x,y,1,1,'white')}${circle(cx,cy,r,'black')}</mask></defs>`;
   out+=rect(x+gap/2,y+gap/2,g,g,ink,`mask="url(#${masks})"`);
  });
 } else if(id==='rings'){
  for(const [x,y,xx,yy] of links(a))out+=path(`M${x+.5} ${y+.5}L${xx+.5} ${yy+.5}`,'none',`stroke="${ink}" stroke-width="${n(p.radius*.85)}"`);
  for(const [x,y] of cs)out+=circle(x+.5,y+.5,p.radius,ink);
  for(const [x,y] of cs)out+=circle(x+.5,y+.5,p.hole,paper);
 } else if(id==='slices'){
  const pitch=7/p.bands,channel=pitch*.18;
  out+=`<defs><path id="${prefix}-body" d="${blockGeometry(a)}"/></defs>`;
  for(let row=0;row<p.bands;row++){
   const clip=`${prefix}-s${row}`,y=row*pitch+channel/2;
   out+=`<defs><clipPath id="${clip}">${rect(-1,y,7,pitch-channel,'white')}</clipPath></defs>`;
   const shift=(row%2?1:-1)*p.shift;
   out+=`<g transform="translate(${n(shift)} 0)"><use href="#${prefix}-body" fill="${ink}" clip-path="url(#${clip})"/></g>`;
  }
 } else if(id==='hinges'){
  for(const [x,y,xx,yy] of links(a)){
   const dx=xx-x,dy=yy-y,sign=(hash32(`${seed}:${x}:${y}:${xx}`)&1)?1:-1;
   const mx=(x+xx)/2+.5-dy*p.kink*sign,my=(y+yy)/2+.5+dx*p.kink*sign;
   out+=path(`M${x+.5} ${y+.5}L${n(mx)} ${n(my)}L${xx+.5} ${yy+.5}`,'none',`stroke="${ink}" stroke-width="${n(p.thickness)}" stroke-linejoin="bevel"`);
  }
  const r=p.thickness*.65;
  for(const [x,y] of cs)out+=path(`M${x+.5} ${n(y+.5-r)}l${n(r)} ${n(r)}l-${n(r)} ${n(r)}l-${n(r)} -${n(r)}Z`,ink);
 }
 return out;
}
export function renderPoster(input={}) {
 const state=resolveState(input),system=SYSTEMS.find(s=>s.id===state.system),[paper,ink]=state.colors;
 let rows=state.text.split('/');
 if(rows.length===1&&rows[0].length>1){const columns=Math.max(2,Math.ceil(Math.sqrt(rows[0].length*.8)));rows=rows[0].match(new RegExp(`.{1,${columns}}`,'g'));}
 // Normalised 7:10 poster. The 5 x 7 construction grid deforms with its panel.
 const W=700,H=1000,field={x:18,y:72,w:664,h:836},rowH=field.h/rows.length;
 let svg=rect(0,0,W,H,paper);
 svg+=tinyText('LETTER SHAPE STUDIES',20,20,1.05,ink);
 svg+=tinyText(`${system.number} / 06`,590,20,1.05,ink);
 const offset=(hash32(state.seed)&1)^(state.invert?1:0);let globalIndex=0;const panels=[];
 rows.forEach((row,r)=>{
  const colW=field.w/Math.max(1,row.length);
  [...row].forEach((ch,c)=>{
   const panel={x:field.x+c*colW,y:field.y+r*rowH,w:colW,h:rowH};
   const flip=(r+c+offset)%2===1,bg=flip?ink:paper,fg=flip?paper:ink;
   svg+=rect(panel.x,panel.y,panel.w,panel.h,bg);
   const padX=Math.max(6,panel.w*.078),padY=Math.max(7,panel.h*.055);
   const sx=(panel.w-padX*2)/5,sy=(panel.h-padY*2)/7;
   // Reserve outer breathing room for the largest supported edge lobe/rail.
   const swell=state.system==='scallop'?state.params.depth/state.params.lobes:state.system==='rings'?Math.max(0,state.params.radius-.5):state.system==='slices'?state.params.shift:0;
   const fx=(panel.w-padX*2)/(5+swell*2),fy=(panel.h-padY*2)/(7+swell*2);
   const tx=panel.x+(panel.w-fx*5)/2,ty=panel.y+(panel.h-fy*7)/2;
   svg+=`<g transform="translate(${n(tx)} ${n(ty)}) scale(${n(fx)} ${n(fy)})">${glyphGeometry(ch,state.system,state.params,fg,bg,hash32(`${state.seed}:${globalIndex}`),`s${hash32(JSON.stringify(state))}-g${globalIndex}`)}</g>`;
   panels.push({character:ch,row:r,column:c,frame:panel,scale:[fx,fy],ink:fg,paper:bg});globalIndex++;
  });
 });
 // Fine divider carries the reading, like the source's central event strip.
 if(rows.length>1){const y=field.y+rowH-7;svg+=rect(field.x,y,field.w,14,paper);svg+=tinyText('FOR US BY US',29,y+4,.72,ink);svg+=tinyText(`${system.short} / ${system.number}`,475,y+4,.72,ink);}
 svg+=tinyText(system.short,20,936,2.55,ink);
 svg+=tinyText('A SHAPE BECOMES A LETTER',20,979,.72,ink);
 svg+=tinyText(`STUDY ${system.number}`,555,979,.72,ink);
 const description=`${system.name}. ${system.rule} Input: ${state.text}.`;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="1000" viewBox="0 0 700 1000" role="img" aria-label="${escape(system.name)}"><title>${escape(system.name)}</title><desc>${escape(description)}</desc>${svg}</svg>`,state,panels,features:{system:system.id,characters:panels.length,rows:rows.length,seed:state.seed}};
}

export function renderPrimitive(id,params={},colors){
 const system=SYSTEMS.find(s=>s.id===id)??SYSTEMS[0],state=resolveState({system:system.id,params,colors});
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 7 9" width="140" height="180">${rect(-1,-1,7,9,state.colors[0])}${glyphGeometry('B',state.system,state.params,state.colors[1],state.colors[0],817,'primitive')}</svg>`;
}
