/* Hørde DarkMatter v1 — kept for reference; output/darkmatter-study-v1 was built with it.
 * Manual poster contours after Hørde + Altiplano, not the original font files.
 */
import {LABELS} from './labels.mjs';
export const SOURCE={id:'b773e557a16bff5f7e18bda5-p0',title:'Hørde DarkMatter',credit:'Hørde + Altiplano Typefaces',url:'https://www.instagram.com/p/CX242GtsQqm/',quad:[[282,117],[817,161],[817,965],[281,971]],field:[700,1100]};
export const FAMILIES=[
 {id:'wedges',name:'Wedges & quarter-discs',palette:'Ice blue / midnight',colors:['#c6dbe8','#182b40','#f4f7fa'],note:'Straight wedges and curved sectors meet through thin cuts. The closest construction to the reference.'},
 {id:'scooped',name:'Scooped diagonals',palette:'Lilac / aubergine',colors:['#b8aae3','#30243e','#f3eefa'],note:'Bend each diagonal into a concave scoop. Counter shapes and fine joints follow the same bending rule.'},
 {id:'stepped',name:'Terraced quadrants',palette:'Rose / oxblood',colors:['#e9acb7','#532c3a','#fff5f4'],note:'Replace sloping edges and circular arcs with terraces. Shared anchors preserve the original mass and counter relationships.'}
];
export const CONTROLS=[
 {key:'aperture',label:'Counter aperture',min:.72,max:1.16,step:.01,value:1},
 {key:'roundness',label:'Quarter-disc fullness',min:.65,max:1.2,step:.01,value:1},
 {key:'joint',label:'Fine joint width',min:1,max:10,step:.25,value:6},
 {key:'bend',label:'Diagonal scoop',min:.04,max:.22,step:.01,value:.12,family:'scooped'},
 {key:'steps',label:'Terraces per edge',min:3,max:9,step:1,value:5,family:'stepped'}
];
// Source-specific paths use the rectified photograph's coordinate field. The
// overlapping H / Ø / R masses and lower D / E have deliberately unequal sizes.
export const SOURCE_GLYPHS=[
 {ch:'H',body:['M16 0H105V131H188V0H275V470H16Z'],cuts:[]},
 {ch:'Ø',body:['M274 16H685V310L604 400L470 543V662H594V744H16V455L274 184Z'],cuts:[{d:'M275 218H427L275 383Z',anchor:[326,273]},{d:'M251 543L470 307V543Z',anchor:[397,464]}]},
 {ch:'R',body:['M480 551L554 469V662H480Z','M554 469L604 400C654 400 691 430 691 480C691 519 674 545 638 555H554Z','M556 555H638L700 813H650Z'],cuts:[{d:'M554 469C602 469 640 507 640 555H554Z',anchor:[554,555]}]},
 {ch:'D',body:['M16 846L106 744H341C359 777 368 813 368 850C368 907 342 957 294 991C284 1042 268 1078 197 1078H16Z'],cuts:[{d:'M106 744C258 744 305 818 305 919C305 945 301 971 294 991H106Z',anchor:[106,991]}]},
 {ch:'E',body:['M369 662H594V744H456V824H583V906H456V991H594V1077H369Z'],cuts:[]}
];
export const SOURCE_JOINTS=[{between:'H / Ø',construction:'One continuous negative pocket ending in a diagonal strip.'},{between:'Ø / R',construction:'Offset the R stem from the shared Ø edge.'}];
const ringBody='M0 0H100V100H0Z',triA={d:'M22 22H63L22 63Z',anchor:[36,36]},triB={d:'M37 78L78 37V78Z',anchor:[64,64]};
const disc='M0 0H50C78 0 100 22 100 50C100 78 78 100 50 100H0Z';
const quarter={d:'M28 0C75 0 84 25 84 52C84 67 82 72 80 74H28Z',anchor:[28,74]};
export const GLYPHS={
 H:{body:['M0 0H34V30H66V0H100V100H66V50H34V77L0 100Z'],cuts:[],joints:['M0 100L66 50']},
 O:{body:[ringBody],cuts:[triA,triB]},'Ø':{body:[ringBody],cuts:[triA,triB]},
 R:{body:['M0 27L28 0H54C80 0 100 18 100 43C100 58 91 65 79 68L100 100H70L43 49H28V100H0Z'],cuts:[{d:'M28 0C52 0 66 17 66 39H28Z',anchor:[28,39]}],joints:['M0 29L28 1']},
 D:{body:['M0 30L28 0H94C98 10 100 20 100 32C100 49 92 64 80 74C77 90 71 100 53 100H0Z'],cuts:[quarter]},
 E:{body:['M0 0H100V20H37V40H93V60H37V80H100V100H0Z'],cuts:[]},
 A:{body:[ringBody],cuts:[{d:'M22 74L50 14L78 74Z',anchor:[50,54]}],joints:['M15 89L50 14','M29 67H71']},
 B:{body:['M0 0H57C83 0 100 16 100 31C100 43 90 48 76 50C91 52 100 62 100 75C100 91 83 100 57 100H0Z'],cuts:[{d:'M30 13C59 13 72 23 72 37H30Z',anchor:[30,37]},{d:'M30 59C59 59 72 69 72 85H30Z',anchor:[30,85]}]},
 C:{body:[ringBody],cuts:[{d:'M31 20H100L31 80Z',anchor:[54,40]}]},
 F:{body:['M0 0H100V22H36V43H88V64H36V100H0Z'],cuts:[],joints:['M0 100L36 64']},
 G:{body:[ringBody],cuts:[{d:'M25 20H79L25 79Z',anchor:[43,40]}],joints:['M55 60H100']},
 I:{body:['M0 0H100V22H66V78H100V100H0V78H34V22H0Z'],cuts:[]},
 J:{body:['M64 0H100V67C100 89 80 100 50 100H0V68L34 45V76H64Z'],cuts:[]},
 K:{body:['M0 0H33V48L72 0H100L60 50L100 100H68L33 59V100H0Z'],cuts:[],joints:['M33 50L92 0']},
 L:{body:['M0 0H36V78H100V100H0Z'],cuts:[],joints:['M0 100L36 78']},
 M:{body:[ringBody],cuts:[{d:'M22 100V20L50 66L78 20V100Z',anchor:[50,60]}]},
 N:{body:[ringBody],cuts:[{d:'M22 78V22L59 78Z',anchor:[34,59]},{d:'M78 22V78L41 22Z',anchor:[66,41]}]},
 P:{body:['M0 27L28 0H54C80 0 100 18 100 43C100 63 80 71 54 71H28V100H0Z'],cuts:[{d:'M28 0C52 0 66 17 66 39H28Z',anchor:[28,39]}]},
 Q:{body:[ringBody,'M63 75H82L100 100H80Z'],cuts:[triA,triB],joints:['M63 75L100 100']},
 S:{body:[ringBody],cuts:[{d:'M24 20H100L24 50Z',anchor:[49,30]},{d:'M0 50L76 80H0Z',anchor:[25,70]}]},
 T:{body:['M0 0H100V25H67V100H33V25H0Z'],cuts:[],joints:['M0 25L33 0']},
 U:{body:[disc],cuts:[{d:'M28 0H74V73H28Z',anchor:[28,73]}]},
 V:{body:['M0 0H100L68 100H32Z'],cuts:[{d:'M28 0H72L50 65Z',anchor:[50,22]}]},
 W:{body:[ringBody],cuts:[{d:'M20 0H80V80L50 36L20 80Z',anchor:[50,40]}]},
 X:{body:['M0 0H34L50 30L66 0H100L68 50L100 100H66L50 70L34 100H0L32 50Z'],cuts:[],joints:['M4 0L96 100']},
 Y:{body:['M0 0H100V45L67 67V100H33V67L0 45Z'],cuts:[{d:'M24 0H76L50 44Z',anchor:[50,15]}]},
 Z:{body:[ringBody],cuts:[{d:'M0 20H65L0 76Z',anchor:[22,39]},{d:'M35 80L100 24V80Z',anchor:[78,61]}]},
 '0':{body:[ringBody],cuts:[triA,triB]},'1':{body:['M15 23L55 0H80V100H42V30L15 48Z'],cuts:[]},
 '2':{body:[ringBody],cuts:[{d:'M0 25H67L0 77Z',anchor:[22,42]},{d:'M37 80L100 25V80Z',anchor:[79,62]}]},
 '3':{body:[disc],cuts:[{d:'M0 24H65L0 49Z',anchor:[22,32]},{d:'M0 53L65 80H0Z',anchor:[22,71]}]},
 '4':{body:['M60 0H87V61H100V83H87V100H60V83H0V57Z'],cuts:[{d:'M25 61L60 20V61Z',anchor:[48,47]}]},
 '5':{body:[ringBody],cuts:[{d:'M31 21H100L31 48Z',anchor:[54,30]},{d:'M0 55L68 80H0Z',anchor:[23,72]}]},
 '6':{body:[disc],cuts:[{d:'M25 15H100L25 60Z',anchor:[50,30]},{d:'M30 61C61 61 72 71 72 84H30Z',anchor:[30,84]}]},
 '7':{body:['M0 0H100V23L55 100H17L64 24H0Z'],cuts:[]},
 '8':{body:[disc],cuts:[{d:'M30 12C61 12 72 22 72 36H30Z',anchor:[30,36]},{d:'M30 61C61 61 72 71 72 85H30Z',anchor:[30,85]}]},
 '9':{body:[disc],cuts:[{d:'M30 12C61 12 72 22 72 36H30Z',anchor:[30,36]},{d:'M0 55H74L0 100Z',anchor:[25,70]}]},' ':{body:[],cuts:[]}
};
const n=x=>+x.toFixed(5),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const path=(d,c,e='')=>`<path d="${d}" fill="${c}" ${e}/>`;
const rect=(x,y,w,h,c)=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}"/>`;
export function normalizeWord(v,fallback=''){
 const s=String(v??fallback).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim().replace(/ +/g,' ');
 if(!s)throw new Error('Enter at least one letter or number.');if(!/^[A-ZØ0-9 ]+$/.test(s))throw new Error('Use A–Z, Ø, numbers and spaces.');if(s.length>12)throw new Error('Keep the word to 12 characters or fewer.');return s;
}
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family)??FAMILIES[0],params={};for(const c of CONTROLS){const v=Number(input.params?.[c.key]??c.value);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:c.value));if(c.key==='steps')params[c.key]=Math.round(params[c.key]);}const color=(x,f)=>/^#[a-f\d]{6}$/i.test(x??'')?x:f;return {engine:'darkmatter-v1',version:1,word:normalizeWord(input.word,'HØRDE'),family:family.id,params,colors:family.colors.map((c,i)=>color(input.colors?.[i],c)),invert:!!input.invert,stage:Math.max(1,Math.min(4,Math.round(Number(input.stage)||4)))};}
export function familyPath(d,state){
 const tokens=d.match(/[A-Z]|-?(?:\d*\.)?\d+/g),arity={M:2,L:2,H:1,V:1,C:6,Q:4,Z:0};let i=0,x=0,y=0,sx=0,sy=0,out='';const pp=(a,b)=>`${n(a)} ${n(b)}`;
 const diagonal=(a,b)=>{if(state.family==='scooped'&&Math.abs(a-x)>1&&Math.abs(b-y)>1){const dx=a-x,dy=b-y,sign=dx>=0?1:-1;return 'Q'+pp((a+x)/2-dy*state.params.bend*sign,(b+y)/2+dx*state.params.bend*sign)+' '+pp(a,b);}if(state.family==='stepped'&&Math.abs(a-x)>1&&Math.abs(b-y)>1){let s='';for(let k=1;k<=state.params.steps;k++)s+=`H${n(x+(a-x)*k/state.params.steps)}V${n(y+(b-y)*k/state.params.steps)}`;return s;}return 'L'+pp(a,b);};
 while(i<tokens.length){const cmd=tokens[i++],v=tokens.slice(i,i+arity[cmd]).map(Number);i+=arity[cmd];if(cmd==='Z'){out+=diagonal(sx,sy)+'Z';x=sx;y=sy;continue;}const [a,b]=cmd==='H'?[v[0],y]:cmd==='V'?[x,v[0]]:v.slice(-2);
  if(cmd==='M'){out+='M'+pp(a,b);sx=a;sy=b;}else if(cmd==='C'||cmd==='Q'){
   let c1,c2;if(cmd==='C'){c1=v.slice(0,2);c2=v.slice(2,4);}else{c1=[x+(v[0]-x)*2/3,y+(v[1]-y)*2/3];c2=[a+(v[0]-a)*2/3,b+(v[1]-b)*2/3];}
   c1=c1.map((z,j)=>{const line=[x,y][j]+([a,b][j]-[x,y][j])/3;return line+(z-line)*state.params.roundness;});c2=c2.map((z,j)=>{const line=[x,y][j]+([a,b][j]-[x,y][j])*2/3;return line+(z-line)*state.params.roundness;});
   if(state.family==='stepped')for(let k=1;k<=state.params.steps;k++){const t=k/state.params.steps,u=1-t;out+=`H${n(u*u*u*x+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*a)}V${n(u*u*u*y+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*b)}`;}else out+='C'+pp(...c1)+' '+pp(...c2)+' '+pp(a,b);
  }else out+=diagonal(a,b);x=a;y=b;
 }return out;
}
function fingerprint(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function cutShapes(g,state,paper){return g.cuts.map(c=>`<g transform="translate(${c.anchor[0]} ${c.anchor[1]}) scale(${state.params.aperture}) translate(${-c.anchor[0]} ${-c.anchor[1]})">${path(familyPath(c.d,state),paper)}</g>`).join('');}
function piece(g,state,id,ink,paper,sw=state.params.joint/2){const bodies=g.body.map(d=>path(familyPath(d,state),state.stage===1?'none':ink,state.stage===1?`stroke="${ink}" stroke-width=".6"`:'')).join('');let result=bodies;
 if(state.stage>=3){result+=`<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse">${g.body.map(d=>path(familyPath(d,state),'white')).join('')}</clipPath></defs><g clip-path="url(#${id})">${cutShapes(g,state,paper)}</g>`;if(state.family!=='stepped')for(const d of g.joints??[])result+=path(familyPath(d,state),'none',`stroke="${paper}" stroke-width="${n(sw)}" stroke-linecap="butt" stroke-linejoin="miter"`);}
 return result;
}
export function wordFrames(word){const letters=[...word.replaceAll(' ','')],rowCount=Math.min(3,Math.max(1,Math.ceil(letters.length/3))),rows=[];let offset=0;for(let j=0;j<rowCount;j++){const count=Math.ceil((letters.length-offset)/(rowCount-j)),row=letters.slice(offset,offset+count),em=Math.min(265,646/(count+Math.max(0,count-1)*.045)),width=count*em+Math.max(0,count-1)*em*.045,start=(700-width)/2;rows.push(...row.map((ch,k)=>[ch,start+k*em*1.045,[60,355,758][j],em,j===2?205:265]));offset+=count;}return rows;}
function label(text,x,y,w,h,color){const chars=[...text.toUpperCase()],step=w/Math.max(1,chars.length);return chars.map((ch,i)=>{let d=LABELS[ch];if(ch==='Ø')d=LABELS.O+'M18 100L8 90L82 0L92 10Z';return `<g transform="translate(${n(x+i*step)} ${y}) scale(${n(step*.89/100)} ${n(h/100)})">${path(d??'',color,'fill-rule="evenodd"')}</g>`;}).join('');}
function samples(state,id,caption,ink,paper){let s=label('DARKMATTER',26,676,80,8,caption);s+=label('ABCDEFGHIJKLMNOPQRSTUVWXYZ',26,694,270,14,caption)+label('HØRDE ALTIPLANO TYPEFACES',26,713,265,12,caption)+label('0123456789',26,730,108,12,caption);s+=label('CONSTRUCTION',316,676,100,8,caption);
 for(const [word,y] of [['ABCDEFGHIJKLMNOPQRSTUVWXYZ',694],['HØRDE ALTIPLANO',713],['0123456789',730]]){const step=275/word.length;[...word].forEach((ch,i)=>{s+=`<g transform="translate(${n(316+i*step)} ${y}) scale(${n(step*.85/100)} .12)">${piece(GLYPHS[ch],{...state,stage:3},id+'-s'+y+'-'+i,caption,ink,.85)}</g>`;});}return s;}
function legend(state,x,y,ink,paper,id){let s='';for(const [i,ch] of [...'DØRA'].entries())s+=`<g transform="translate(${x+i%2*40} ${y+Math.floor(i/2)*40}) scale(.31)">${piece(GLYPHS[ch],{...state,stage:3},id+'-legend'+i,ink,paper,2)}</g>`;return s;}
export function effectiveColors(state){const invert=c=>'#'+c.slice(1).match(/../g).map(v=>(255-parseInt(v,16)).toString(16).padStart(2,'0')).join('');return state.invert?[state.colors[1],state.colors[0],invert(state.colors[2])]:state.colors;}
export function render(input={}){
 const state=resolve(input),[paper,ink,caption]=effectiveColors(state),id='dm'+fingerprint(JSON.stringify(state)),canonical=['HØRDE','HORDE'].includes(state.word);let body='';
 if(canonical){for(const [i,original] of SOURCE_GLYPHS.entries()){const g=original.ch==='R'?{...original,body:[`M${n(470+state.params.joint*1.5)} ${n(543+state.params.joint*1.3)}L554 469V662H${n(470+state.params.joint*1.5)}Z`,...original.body.slice(1)]}:original;body+=piece(g,state,id+'-c'+i,ink,paper,state.params.joint);}if(state.stage>=3)body+=path(familyPath(`M106 216H188V267L16 ${n(448+state.params.joint*.7)}V${n(448-state.params.joint*.7)}L106 350Z`,state),paper);}
 else for(const [i,[ch,x,y,w,h]] of wordFrames(state.word).entries())body+=`<g data-glyph="${ch}" transform="translate(${n(x)} ${n(y)}) scale(${n(w/100)} ${n(h/100)})">${piece(GLYPHS[ch],state,id+'-g'+i,ink,paper)}</g>`;
 if(state.stage===1){for(const y of [216,543,744,991])body+=path(`M16 ${y}H684`,'none',`stroke="${ink}" stroke-width=".45" opacity=".35"`);}
 if(state.stage===4){if(!canonical)body+=rect(16,662,578,82,ink)+rect(369,991,225,86,ink);body+=label('HØRDE',606,27,76,13,caption)+samples(state,id,caption,ink,paper);body+=label('STUDY AFTER',379,1016,124,12,caption)+label('HØRDE + ALTIPLANO',379,1035,198,12,caption)+label('WEDGES AND DISCS',379,1054,181,12,caption)+label('MODULES',607,980,77,7,ink)+legend(state,607,994,ink,paper,id);}
 const desc=`${state.word}. ${state.family} wedge and quarter-disc construction. Stage ${state.stage}. Manual vector study after Hørde + Altiplano.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1100" viewBox="0 0 700 1100" role="img" aria-label="${esc(desc)}"><title>${esc(state.word)} — wedges and quarter-discs</title><desc>${esc(desc)}</desc>${rect(0,0,700,1100,paper)}${body}</svg>`;
 return {svg,state,width:700,height:1100,frames:canonical?SOURCE_GLYPHS.map(g=>g.ch):wordFrames(state.word),features:{family:state.family,stage:state.stage,layout:canonical?'source-collage':'transferred-word',characters:state.word.replaceAll(' ','').length}};
}
export function specimen(input={}){const state=resolve(input),[paper,ink]=effectiveColors(state),id='dms'+fingerprint(JSON.stringify(state));let s=rect(0,0,1120,180,paper);[...'HØRDEFUB'].forEach((ch,i)=>{s+=`<g transform="translate(${20+i*140} 27) scale(1.1 1.25)">${piece(GLYPHS[ch],{...state,stage:3},id+i,ink,paper)}</g>`;});return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="180" viewBox="0 0 1120 180">${s}</svg>`;}
