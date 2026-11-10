/* PLOT — progressive letter slices, after Christian Gautschi.
 * One master text repeats in rows, and each row's window shows part of it. The construction is modular:
 * modules.mjs holds the axes (sequence, edge, motion, profile, tone, fit, format), kernel.mjs the outline
 * geometry and glyphs.mjs the letters. Source P/l/o/t are manual studies; everything else is a new interpretation.
 */
import {TYPE,SANS,SERIF} from './type.mjs';
import {GLYPHS} from './glyphs.mjs';
import {K_MIN,K_MAX,dot,clipHalf,toInt,inkWidth,lineOutline,apply,affine,intersect,pathData} from './kernel.mjs';
import {SEQUENCES,EDGES,MOTIONS,MODULES,DEFAULT_MODULES,FORMATS,SCAFFOLDS,frameOf,profile,windows,motion,edge,tone,mix} from './modules.mjs';
export {GLYPHS} from './glyphs.mjs';
export {WIDTH,glyphWidth,stemOf,outline,area,clean} from './kernel.mjs';
export {SOURCE_WINDOWS,SEQUENCES,EDGES,MOTIONS,PROFILES,TONES,FITS,ALIGNS,MODULES,DEFAULT_MODULES,FORMATS,SCAFFOLDS,frameOf} from './modules.mjs';
export const SOURCE={id:'3a9c23cb961fc6c772f18d8b-p0',title:'PLOT / f’ar Lausanne',credit:'Christian Gautschi',url:'https://www.instagram.com/p/B3JRdhHCXzg/',quad:[[0,0],[625,0],[630,860],[43,860]],field:[700,1000]};
// Slice systems are named module combinations with their own palettes and parameter defaults. Changing any module makes a custom system.
export const FAMILIES=[
 {id:'windows',name:'Progressive windows',palette:'Cool pearl / royal blue',colors:['#e4e9f1','#264f9c'],modules:{},note:'Repeat one master word in progressively deeper windows. At 0° this is the closest construction to the source.'},
 {id:'shear',name:'Alternating shear',palette:'Pistachio / mulberry',colors:['#d5e3bb','#603954'],modules:{motion:'shear'},note:'Lean neighboring reveals in opposite directions along the slice. The windows keep their rhythm while the strokes change angle.'},
 {id:'bowed',name:'Bowed windows',palette:'Petal / petrol',colors:['#edc7d8','#205d65'],modules:{edge:'bowed'},note:'Scoop each window’s cutting edge beneath the letters. The final row reveals the complete master word.'},
 {id:'strata',name:'Exploded strata',palette:'Bone / oxblood',colors:['#ebe3d3','#7a1f1c'],modules:{sequence:'strips',edge:'wave',motion:'shift'},params:{offset:.05,bow:.22,period:.7},note:'One word cut into progressively thicker strips along a shared wave, then shifted apart. The strips interlock.'},
 {id:'saw',name:'Saw drift',palette:'Graphite / signal',colors:['#151516','#ff5527'],modules:{edge:'zigzag',motion:'drift'},params:{offset:.24,bow:.3,period:.3},note:'Zigzag cuts; each row drifts in from the side until the complete word settles.'},
 {id:'aperture',name:'Aperture',palette:'Lilac / indigo',colors:['#dcd6f2','#25206b'],modules:{sequence:'center',edge:'arc'},note:'Each row opens a wider band around the middle of the letters through arched cuts.'},
 {id:'accordion',name:'Accordion',palette:'Night / acid',colors:['#0c0e0b','#c6f33c'],modules:{edge:'steps',motion:'compress',tone:'fade'},params:{squash:.9,period:.5},note:'Each window holds the whole word, compressed to its depth, with stepped edges fading in.'}
];
export const CONTROLS=[
 {key:'slice',label:'Slice angle',min:-180,max:180,step:1,value:0,unit:'°'},
 {key:'turn',label:'Word angle',min:-90,max:90,step:1,value:0,unit:'°'},
 {key:'rows',label:'Reveal rows',min:5,max:12,step:1,value:9},
 {key:'growth',label:'Reveal progression',min:.65,max:1.4,step:.01,value:1},
 {key:'gap',label:'Row spacing',min:.6,max:1.7,step:.01,value:1},
 {key:'lean',label:'Lean',min:.04,max:.26,step:.01,value:.18,when:{motion:['shear']}},
 {key:'offset',label:'Shift',min:.02,max:.4,step:.01,value:.14,when:{motion:['shift','drift']}},
 {key:'squash',label:'Compression',min:.2,max:1,step:.01,value:.85,when:{motion:['compress']}},
 {key:'bow',label:'Edge depth',min:.1,max:.45,step:.01,value:.32,when:{edge:['bowed','arc','zigzag','wave','steps']}},
 {key:'period',label:'Edge period',min:.12,max:1.2,step:.01,value:.4,when:{edge:['zigzag','wave','steps']}}
];
export const isActive=(control,modules)=>!control.when||Object.entries(control.when).every(([key,ids])=>ids.includes(modules[key]));
export const PRESETS=[
 {id:'horizontal',name:'Horizontal',params:{slice:0,turn:0,rows:9},note:'The source: slices run with the baseline and reveal the letters from their tops.'},
 {id:'vertical-slices',name:'Vertical slices',params:{slice:90,turn:0,rows:6},note:'Slices cross the baseline. Each row wipes the word in from the left.'},
 {id:'vertical-word',name:'Vertical word',params:{slice:0,turn:90,rows:9},note:'The whole stack turns. Columns reveal a word that reads upward.'},
 {id:'baseline',name:'From the baseline',params:{slice:180,turn:0,rows:9},note:'Slices run with the baseline but reveal the letters from below, so the o enters first.'},
 {id:'diagonal',name:'Diagonal',params:{slice:40,turn:0,rows:7},note:'A 40° cut enters at the top-left corner and sweeps across the word.'}
];
// Shared two-color sets. "System colors" keeps each slice system's own pair.
export const PALETTES=[
 {id:'system',name:'System colors'},
 {id:'paper',name:'Paper / black',colors:['#ebeae4','#141414']},
 {id:'acid',name:'Acid / night',colors:['#0c0e0b','#c6f33c']},
 {id:'signal',name:'Signal / black',colors:['#0e0d0f','#ff4b28']},
 {id:'ice',name:'Ice / ink',colors:['#0d1430','#a6e9ff']}
];
export const SOURCE_FRAMES=[['P',27,207],['l',260,48],['o',349,187],['t',563,104]];
export const DEFAULT_CAPTION='LETTER SLICES / ANY TEXT, ANY ANGLE';
const n=v=>+v.toFixed(5),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const rect=(x,y,w,h,c,more='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}" ${more}/>`;
const path=(d,c,more='')=>`<path d="${d}" fill="${c}" ${more}/>`;
function fingerprint(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
// Text is A–Z, 0–9, spaces and . - !, with "/" between up to three lines. The first character is a capital, the rest lowercase.
export function normalizeWord(v,fallback=''){const lines=String(v??fallback).normalize('NFKD').replace(/[̀-ͯ]/g,'').split('/').map(s=>s.trim().replace(/\s+/g,' '));if(lines.every(l=>!l))throw new Error('Enter at least one letter.');const text=lines.join(' / ');if(!/^[A-Za-z0-9 .!\-\/]+$/.test(text))throw new Error('Use A–Z, 0–9, spaces, . - ! and / for a new line.');if(lines.some(l=>!l))throw new Error('Remove the empty line.');if(lines.length>3)throw new Error('Use three lines at most.');if(text.length>36)throw new Error('Keep the text to 36 characters or fewer.');return text[0].toUpperCase()+text.slice(1).toLowerCase();}
// Captions are serif capitals in up to two lines; unsupported accents fall back to their base letters.
export function normalizeCaption(v){const lines=String(v??'').toUpperCase().replace(/['‘]/g,'’').split('/').map(s=>[...s.trim().replace(/\s+/g,' ')].map(ch=>{if(SERIF[ch])return ch;const base=ch.normalize('NFKD').replace(/[̀-ͯ]/g,'');if(base&&[...base].every(b=>SERIF[b]))return base;throw new Error('Use letters, figures and basic punctuation in the caption.');}).join('')).filter(Boolean);if(lines.length>2)throw new Error('Use two caption lines at most.');if(lines.some(l=>l.length>48))throw new Error('Keep each caption line to 48 characters.');return lines.join(' / ');}
export function resolve(input={}){const family=FAMILIES.find(f=>f.id===input.family),base=family??FAMILIES[0],modules={...DEFAULT_MODULES,...base.modules},params={};
 if(input.modules&&typeof input.modules==='object')for(const [key,list] of Object.entries(MODULES))if(list.some(m=>m.id===input.modules[key]))modules[key]=input.modules[key];
 for(const c of CONTROLS){const fallback=base.params?.[c.key]??c.value,v=Number(input.params?.[c.key]??fallback);params[c.key]=Math.max(c.min,Math.min(c.max,Number.isFinite(v)?v:fallback));if(c.key==='rows')params[c.key]=Math.round(params[c.key]);}
 let caption=DEFAULT_CAPTION;try{caption=normalizeCaption(input.caption??DEFAULT_CAPTION);}catch{}
 const color=(c,f)=>/^#[a-f\d]{6}$/i.test(c??'')?c:f;
 return {engine:'plot-slices-v4',version:4,word:normalizeWord(input.word,'Plot'),family:family?family.id:input.family==='custom'?'custom':FAMILIES[0].id,modules,params,format:FORMATS.some(f=>f.id===input.format)?input.format:'poster',scaffold:SCAFFOLDS.some(s=>s.id===input.scaffold)?input.scaffold:'source',caption,colors:base.colors.map((c,i)=>color(input.colors?.[i],c)),invert:!!input.invert,stage:Math.max(1,Math.min(4,Math.round(Number(input.stage)||4)))};
}
const rad=a=>a*Math.PI/180,tidy=v=>Math.abs(v)<1e-12?0:v;
// u is the reveal direction through the letters and c runs along the cut. 0° reveals downward from the letter tops.
export function axes(slice=0){const r=rad(slice);return {u:[tidy(Math.sin(r)),tidy(Math.cos(r))],c:[tidy(Math.cos(r)),tidy(-Math.sin(r))]};}
// A turned stack takes the largest box that fits the field, never more elongated than the field itself.
export function fieldBox(turn=0,field=frameOf({})){const r=rad(turn),a=Math.abs(tidy(Math.cos(r))),b=Math.abs(tidy(Math.sin(r))),{w:W,h:H}=field;if(!b)return [W,H];const lo=Math.min(W/H,H/W),hi=Math.max(W/H,H/W),depth=q=>Math.min(W/(q*a+b),H/(q*b+a)),q0=W*b-H*a;let best=lo,area=-1;
 for(const q of [lo,hi,W/H,a?b/a:hi,a/b,q0?(H*b-W*a)/q0:lo]){const k=Math.max(lo,Math.min(hi,Number.isFinite(q)?q:lo)),s=k*depth(k)**2;if(s>area+1e-9){area=s;best=k;}}
 const d=depth(best);return [best*d,d];
}
// Each row repeats the master line inside its window. Row extents follow what the window can show after the row's
// motion, widened by the bulge of an interlocking strip cut, so rows never overlap.
function reveal(H,L,state,prof,field){const {u,c}=axes(state.params.slice),x0=field.x,box=[[x0,0],[x0+L,0],[x0+L,H],[x0,H]],s=box.map(p=>dot(p,u)),lead=Math.min(...s),extent=Math.max(...s)-lead,spans=windows(state.modules.sequence,prof.depth),n=spans.length,strips=state.modules.sequence==='strips',bow=state.modules.edge==='straight'?0:state.params.bow,thick=spans.map(([a,b])=>(b-a)*extent);let over=0;
 const rows=spans.map(([a,b],i)=>{const lo=lead+a*extent,hi=lead+b*extent,depth=hi-lo,loCut=a>1e-9,hiCut=b<1-1e-9,share=loCut&&hiCut&&!strips?.5:1,
   ampHi=hiCut?bow*share*Math.min(strips?Math.min(thick[i],thick[i+1]):depth,H):0,ampLo=loCut?bow*share*Math.min(strips?Math.min(thick[i],thick[i-1]):depth,H):0,
   M=motion(state,{u,c,lead,extent,lo,hi,H,i,n}),seen=clipHalf(clipHalf(box.map(p=>apply(M,p)),u,hi),[-u[0],-u[1]],-(lo-(strips?ampLo:0))),pts=seen.length?seen:[box[s.indexOf(lead)]],xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
   over=Math.max(over,x0-Math.min(...xs),Math.max(...xs)-x0-L);
   return {lo,hi,depth,loCut,hiCut,full:!loCut&&!hiCut,ampHi,ampLo,M,from:Math.min(...ys),to:Math.max(...ys)};});
 return {lead,extent,over,rows};
}
function lineSpec(text){const chars=[...text];if(text==='Plot')return {text,chars,ratios:SOURCE_FRAMES.map(f=>f[2]/222),gaps:[26,41,27].map(v=>v/222),tail:6/222};return {text,chars,ratios:chars.map(c=>GLYPHS[c].width),gaps:chars.slice(1).map(()=>.12),tail:0};}
function lineWidth(spec,k){return spec.chars.reduce((a,c,i)=>a+inkWidth(c,spec.ratios[i],k),0)+(spec.gaps.reduce((a,b)=>a+b,0)+spec.tail)*Math.sqrt(k);}
// Fill: one width factor per line fills the measure; past K_MAX the line gains at most .35 cap heights of spacing
// per gap, then aligns. Natural: letters keep their drawn width unless the line is too long, then condense.
function fitLine(spec,L,H,x0,fit='fill',align='left'){const target=L/H,solve=(lo,hi)=>{for(let i=0;i<60;i++){const m=(lo+hi)/2;if(lineWidth(spec,m)>target)hi=m;else lo=m;}return (lo+hi)/2;};
 let k=lineWidth(spec,K_MIN)>=target?K_MIN:fit==='natural'?(lineWidth(spec,1)<=target?1:solve(K_MIN,1)):lineWidth(spec,K_MAX)<=target?K_MAX:solve(K_MIN,K_MAX);
 if(Math.abs(k-1)<.004)k=1;const room=Math.max(0,target-lineWidth(spec,k))*H,track=fit==='fill'&&spec.gaps.length?Math.min(.35*H,room/spec.gaps.length):0,rest=room-track*spec.gaps.length;let x=x0+(align==='center'?rest/2:align==='right'?rest:0);
 const frames=spec.chars.map((ch,i)=>{const w=inkWidth(ch,spec.ratios[i],k)*H,f=[ch,n(x),n(w),k];x+=w+(i<spec.gaps.length?spec.gaps[i]*Math.sqrt(k)*H+track:0);return f;});
 return {text:spec.text,k,frames};
}
function splits(words,count){if(count===1)return [[words.join(' ')]];const out=[];for(let i=1;i<=words.length-count+1;i++)for(const rest of splits(words.slice(i),count-1))out.push([words.slice(0,i).join(' '),...rest]);return out;}
// "/" sets lines by hand. Otherwise text with spaces may break into two or three balanced lines.
function candidates(word){const set=word.split(' / ');if(set.length>1)return [set];const words=word.split(' '),out=[[word]];for(let count=2;count<=Math.min(3,words.length);count++){let best=null,widest=Infinity;for(const lines of splits(words,count)){const w=Math.max(...lines.map(l=>lineWidth(lineSpec(l),1)));if(w<widest){widest=w;best=lines;}}out.push(best);}return out;}
export function layout(input={}){const state=resolve(input),field=frameOf(state),[L,T]=fieldBox(state.params.turn,field),prof=profile(state),gapSum=prof.gap.reduce((a,b)=>a+b,0),stackGap=.5*state.params.gap,{fit,align}=state.modules,
 stack=H=>reveal(H,L,state,prof,field).rows.reduce((a,r)=>a+r.to-r.from,0)+gapSum*H,used=(H,m)=>m*stack(H)+(m-1)*stackGap*H,fills=new Map(),
 fill=m=>{if(!fills.has(m)){let lo=0,hi=T;for(let i=0;i<64;i++){const H=(lo+hi)/2;if(used(H,m)>T)hi=H;else lo=H;}fills.set(m,(lo+hi)/2);}return fills.get(m);};
 // Choose the line set whose letters stay closest to their drawn width without shrinking the stack.
 let pick=null;for(const lines of candidates(state.word)){const specs=lines.map(lineSpec),full=fill(lines.length),H=Math.min(full,...specs.map(s=>L/lineWidth(s,K_MIN))),score=specs.reduce((a,s)=>a+Math.abs(Math.log(fitLine(s,L,H,field.x,fit).k)),0)/specs.length+2*Math.log(full/H)+.12*(lines.length-1);if(!pick||score<pick.score-1e-9)pick={specs,H,full,score};}
 // Motion needs side room in proportion to the cap height, so shrink the cap height until the narrowest line fits inside it.
 const {specs}=pick,span=L+2*field.pad,widest=Math.max(...specs.map(s=>lineWidth(s,K_MIN)));let H=pick.H,cut=reveal(H,L,state,prof,field),margin=Math.max(field.pad,12*field.s+cut.over);
 for(let i=0;i<8&&widest*H>span-2*margin+.01;i++){H=(span-2*margin)/widest;cut=reveal(H,L,state,prof,field);margin=Math.max(field.pad,12*field.s+cut.over);}
 const {u,c}=axes(state.params.slice),m=specs.length,lines=specs.map(s=>fitLine(s,span-2*margin,H,margin,fit,align)),rows=[];
 let y=field.y+(T-used(H,m))/2;for(let s=0;s<m;s++)cut.rows.forEach((r,i)=>{rows.push({index:rows.length,line:s,step:i,last:i===cut.rows.length-1,y:n(y),height:n(r.to-r.from),origin:y-r.from,...r});y+=r.to-r.from+(prof.gap[i]??stackGap)*H;});
 const turn=state.params.turn,co=Math.cos(rad(turn)),si=Math.sin(rad(turn)),cx=field.x+L/2,cy=field.y+T/2,page=turn?(x,y)=>[field.cx+(x-cx)*co+(y-cy)*si,field.cy-(x-cx)*si+(y-cy)*co]:(x,y)=>[x,y];
 return {state,field,lines,rows,capHeight:n(H),fullHeight:n(pick.full),top:field.y,bottom:n(field.y+T),length:n(L),depth:n(T),lead:cut.lead,extent:cut.extent,u,c,page,turned:!!turn};
}
// A window is its row band cut along the slice: below the far cut and, for center and strip sequences, above the near one.
// Each cut follows the edge module. Strip cuts bulge where the neighboring strip indents, so the strips interlock.
function windowShape(row,plan,frames,state){const {u,c,field}=plan,H=plan.capHeight,X=plan.length+2*field.pad,band=[[0,row.from],[X,row.from],[X,row.to],[0,row.to]];let win=[toInt(band)];if(row.full)return win;
 const ts=band.map(p=>dot(p,c)),t1=Math.min(...ts)-10,t2=Math.max(...ts)+10,raw=frames.filter(([ch])=>GLYPHS[ch].d).map(([,x,w])=>{const t=[[x,0],[x+w,0],[x+w,H],[x,H]].map(p=>dot(p,c));return [Math.min(...t),Math.max(...t)];}).sort((p,q)=>p[0]-q[0]),spans=[];
 for(const s of raw){const prev=spans.at(-1);if(prev&&s[0]<prev[1])prev[1]=Math.max(prev[1],s[1]);else spans.push([...s]);}
 const ctx={spans,t0:Math.min(...[[field.x,0],[field.x+plan.length,0],[field.x+plan.length,H],[field.x,H]].map(p=>dot(p,c))),period:state.params.period*H},xy=(t,s)=>[t*c[0]+s*u[0],t*c[1]+s*u[1]],
  half=(s0,amp,sign,away)=>toInt([...edge(state.modules.edge,t1,t2,amp,ctx).map(([t,o])=>xy(t,s0+sign*o)),xy(t2,s0+away*4000),xy(t1,s0+away*4000)]);
 if(row.hiCut)win=intersect(win,[half(row.hi,row.ampHi,-1,-1)]);
 if(row.loCut)win=intersect(win,[half(row.lo,row.ampLo,state.modules.sequence==='strips'?-1:1,1)]);
 return win;
}
function cutRows(plan,state){const glyphs=plan.lines.map(l=>lineOutline(l,plan.capHeight));return plan.rows.map(row=>{const win=windowShape(row,plan,plan.lines[row.line].frames,state);return {row,win,master:glyphs[row.line],pieces:state.stage===1?[]:intersect(affine(glyphs[row.line],row.M),win)};});}
// The cut pieces of every row as Clipper outlines in row coordinates, for tools and checks that need geometry rather than SVG.
export function slices(input={}){const state=resolve({...input,stage:3}),plan=layout(state);return {plan,rows:cutRows(plan,state)};}
function typeAt(key,x,y,w,h,ink){const t=TYPE[key];return `<g fill="${ink}" transform="translate(${n(x)} ${n(y)}) scale(${n(w/t.width)} ${n(-h/(t.top-t.bottom))}) translate(0 ${-t.top})">${t.body}</g>`;}
// Set new sans text at the scale of a prepared phrase, so live values sit beside the fixed credit.
function typeLine(key,text,x,y,w,h,ink){const t=TYPE[key];let a=0,body='';for(const ch of text){const g=SANS[ch]??SANS[' '];if(g.d)body+=`<path transform="translate(${a} 0)" d="${g.d}"/>`;a+=g.adv;}return `<g fill="${ink}" transform="translate(${n(x)} ${n(y)}) scale(${n(w/t.width)} ${n(-h/(t.top-t.bottom))}) translate(0 ${-t.top})">${body}</g>`;}
// Caption lines take the source header's size and horizontal stretch, condensing only when a line would overrun.
function serifLine(text,x,y,maxW,h,ink){const t=TYPE.headline,sy=h/(t.top-t.bottom),stretch=(648/t.width)/(18/(t.top-t.bottom)),adv=[...text].reduce((a,ch)=>a+SERIF[ch].adv,0),sx=Math.min(sy*stretch,maxW/Math.max(adv,1));let a=0,body='';for(const ch of text){const g=SERIF[ch];if(g.d)body+=`<path transform="translate(${a} 0)" d="${g.d}"/>`;a+=g.adv;}return `<g fill="${ink}" transform="translate(${n(x)} ${n(y)}) scale(${n(sx)} ${n(-sy)}) translate(0 ${-t.top})">${body}</g>`;}
const degrees=v=>(Math.round(v)<0?'−':'')+Math.abs(Math.round(v))+'°';
const shortName=(list,id)=>list.find(m=>m.id===id).short;
function scaffold(ink,state,field){const {W,H,s}=field,{rows,slice,turn}=state.params,m=state.modules,angled=!!(Math.round(slice)||Math.round(turn)),changed=['sequence','edge','motion'].some(k=>m[k]!==DEFAULT_MODULES[k]),cut=-(slice+turn),
  line=`${shortName(SEQUENCES,m.sequence)} / ${shortName(EDGES,m.edge)} / ${shortName(MOTIONS,m.motion)} / SLICE ${degrees(slice)} / WORD ${degrees(turn)}`,
  bars=x=>{let b='';for(let i=0;i<6;i++){const h=(2+i*2.4)*s,bx=x+i*30*s,by=H-30*s;b+=rect(bx,by,21*s,h,ink,n(cut)?`transform="rotate(${n(cut)} ${n(bx+10.5*s)} ${n(by+h/2)})"`:'');}return b;};
 if(state.scaffold==='source')return typeAt('headline',26*s,s,648*s,18*s,ink)+typeAt('event',26*s,23*s,648*s,18*s,ink)+typeAt('logo',26*s,H-53*s,83*s,47*s,ink)+typeAt('website',W/2,H-52*s,186*s,19*s,ink)+typeAt('credit',W/2,H-22*s,207*s,5.2*s,ink)+(angled||changed?typeLine('method',line,W/2,H-13*s,205*s,5.2*s,ink):typeAt('method',W/2,H-13*s,205*s,5.2*s,ink))+typeAt('date',W-113*s,H-50*s,82*s,5*s,ink)+(rows===9?typeAt('key',134*s,H-50*s,175*s,5.2*s,ink):typeLine('method','PROGRESSIVE LETTER WINDOWS',134*s,H-50*s,175*s,5.2*s,ink))+bars(134*s);
 if(state.scaffold==='caption')return (state.caption?state.caption.split(' / ').map((t,i)=>serifLine(t,26*s,(1+22*i)*s,W-52*s,18*s,ink)).join(''):'')+bars(26*s)+typeLine('method',line,216*s,H-27*s,205*s,5.2*s,ink)+typeLine('method','LETTER SLICES AFTER CHRISTIAN GAUTSCHI',216*s,H-18*s,205*s,5.2*s,ink);
 return '';
}
const colorsOf=state=>state.invert?[state.colors[1],state.colors[0]]:state.colors;
const masterRow=(row,anyFull)=>row.full||(!anyFull&&row.last);
export function render(input={}){const state=resolve(input),[paper,ink]=colorsOf(state),plan=layout(state),{field}=plan,{W,H,s}=field,id='ps'+fingerprint(JSON.stringify(state)),cuts=cutRows(plan,state),anyFull=plan.rows.some(r=>r.full),perStack=plan.rows.length/plan.lines.length,place=row=>(x,y)=>plan.page(x,y+row.origin);let body='',guides='';
 for(const {row,win,pieces} of cuts){const at=place(row),edgeLine=path(pathData(win,at),'none',`stroke="${ink}" stroke-width="${n(.45*s)}" stroke-linejoin="round" opacity="${state.stage===1?.32:.5}"`);
  if(state.stage===1){guides+=edgeLine;continue;}
  if(state.stage===2){guides+=edgeLine;body+=`<path data-row="${row.index}" d="${pathData(pieces,at)}" fill="none" stroke="${ink}" stroke-width="${n(.35*s)}" stroke-linejoin="round"/>`;}
  else body+=`<path data-row="${row.index}" d="${pathData(pieces,at)}" fill="${mix(paper,ink,tone(state.modules.tone,row.step,perStack,masterRow(row,anyFull)))}" fill-rule="evenodd"/>`;
 }
 if(state.stage===1)for(const {row,master} of cuts.filter(x=>masterRow(x.row,anyFull)))body+=`<path d="${pathData(master,place(row))}" fill="${ink}" fill-rule="evenodd"/>`;
 // Construction guides of a turned stack stop short of the header and footer. Letters never need this clip.
 if(guides)body=(plan.turned?`<defs><clipPath id="${id}-field" clipPathUnits="userSpaceOnUse">${rect(0,field.y-16*s,W,field.h+57*s,'#fff')}</clipPath></defs><g clip-path="url(#${id}-field)">${guides}</g>`:guides)+body;
 if(state.stage===4)body+=scaffold(ink,state,field);
 const {slice,turn}=state.params,lines=plan.lines.map(l=>l.text),sys=`${state.modules.sequence}, ${state.modules.edge} edge, ${state.modules.motion} motion`,desc=`${lines.join(' / ')}. ${sys}. ${lines.length>1?lines.length+' lines of ':''}${perStack} reveals, slices at ${degrees(slice)}, word at ${degrees(turn)}. Manual source study after Christian Gautschi.`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}"><title>${esc(state.word)} — progressive letter slices</title><desc>${esc(desc)}</desc>${rect(0,0,W,H,paper)}${body}</svg>`;
 return {svg,state,width:W,height:H,plan,frames:plan.lines.flatMap(l=>l.frames),features:{family:state.family,...state.modules,stage:state.stage,rows:plan.rows.length,lines:lines.length,widths:plan.lines.map(l=>n(l.k)),slice,turn,format:state.format,scaffold:state.scaffold,layout:state.word==='Plot'?'source-master':'extension-text',characters:state.word.replace(/[ /]/g,'').length}};
}
// The complete master lines placed where each stack's master row shows them, without any window.
export function master(input={}){const state=resolve(input),[paper,ink]=colorsOf(state),plan=layout(state),{W,H}=plan.field,anyFull=plan.rows.some(r=>r.full);let body='';for(const row of plan.rows.filter(r=>masterRow(r,anyFull)))body+=`<path d="${pathData(lineOutline(plan.lines[row.line],plan.capHeight),(x,y)=>plan.page(x,y+row.origin))}" fill="${ink}" fill-rule="evenodd"/>`;return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rect(0,0,W,H,paper)}${body}</svg>`;}
export function specimen(input={}){const state=resolve(input),[paper,ink]=colorsOf(state),plan=layout(state),{field}=plan,H=plan.capHeight,W=plan.length+2*field.pad,h=36+plan.lines.length*H+(plan.lines.length-1)*.5*H;let body='';plan.lines.forEach((l,i)=>{const line=fitLine(lineSpec(l.text),plan.length,H,field.pad,state.modules.fit,state.modules.align),dy=18+i*1.5*H;body+=`<path d="${pathData(lineOutline(line,H),(x,y)=>[x,y+dy])}" fill="${ink}" fill-rule="evenodd"/>`;});return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="${n(h*700/W)}" viewBox="0 0 ${n(W)} ${n(h)}">${rect(0,0,W,h,paper)}${body}</svg>`;}
