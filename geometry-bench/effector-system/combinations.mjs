// Exhaustive combination tests: every ordered pair of modifiers, every modifier on every element, every blend of
// two bending modifiers, seeded random stacks with extreme settings, and named edge cases. Writes
// output/effector-study-v1/combinations.json and exits non-zero on any failure.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as E from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(here,'../../output/effector-study-v1');
const MODS=Object.keys(E.MODIFIERS),POINT=MODS.filter(k=>E.MODIFIERS[k].kind==='point');
const GLOBAL=new Set(['weight','round','outline','petal','swirl','zigzag','tiles','dial','burst','repeat','shadow','fold','screen','dither','wave','turbulence','shear','taper','bend','polar','spherize','ribbon','envelope','perspective','melt','roughen','mirror','kaleido','echo','slice','inline']);
const field=type=>GLOBAL.has(type)?{shape:'all',follow:false,radius:.42}:{shape:'radial',radius:.36,softness:1,follow:false};
const mod=(type,o={})=>({type,field:field(type),...o});
const SVG=`<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#f0eee8"/><path fill-rule="evenodd" fill="#d23" d="M20 20H90V100H20ZM40 40H70V80H40Z"/><circle cx="140" cy="60" r="40" fill="#123"/><g transform="rotate(20 150 30)"><rect x="120" y="10" width="60" height="12" fill="#3a3"/></g></svg>`;
const ELEMENTS={grid:{type:'grid',cols:12,shape:'eye'},lines:{type:'lines',direction:'horizontal',count:18,weight:.2,area:'bleed'},dashes:{type:'dashes',rows:16},rings:{type:'rings',count:8,segments:20},
 scatter:{type:'scatter',count:120,size:24,shape:'star',turn:true},text:{type:'text',text:'Ag/Bé'},matrix:{type:'matrix',text:'OK',cols:40},artwork:{type:'artwork',svg:SVG}};
const base=(extra={})=>({recipe:'custom',format:'square',palette:'acid',layers:[{id:'L1',...ELEMENTS.lines},{id:'L2',type:'text',text:'MOD'}],...extra});

const results={pairs:0,elements:0,blends:0,random:0,edges:0},failures=[],slow=[],warnings=[];
// One check: render through the pipeline, then test numbers, ink, budget, orientation and time.
function run(category,name,state,{t=1.3,pointer=null,expectInk=true,deterministic=false}={}){results[category]++;
 let ops,ms;try{const s=E.normalize(state),sc=E.prepare(s),ctx=E.context(s,sc,t,pointer),t0=performance.now();ops=E.compose(sc,s,E.evaluate(sc,s,ctx),ctx);ms=performance.now()-t0;
  if(deterministic){const again=E.compose(sc,s,E.evaluate(sc,s,ctx),ctx);if(JSON.stringify(again)!==JSON.stringify(ops))failures.push({category,name,problem:'not deterministic'});}}
 catch(e){failures.push({category,name,problem:'threw',detail:String(e.stack||e).split('\n').slice(0,3).join(' | ')});return;}
 const st=ops.stats||{},polys=ops.flatMap(o=>o.polys);
 // Colour paint: sorted offsets in [0, 1], hex colours, opacities in range, finite gradient geometry.
 const badPaint=ops.find(o=>!/^#[0-9a-f]{6}$/.test(o.fill)||!(o.a>=0&&o.a<=1)||(o.paint&&(o.paint.stops.length<2||o.paint.stops.some((s,i,a)=>!(s[0]>=0&&s[0]<=1)||(i&&s[0]<a[i-1][0])||!/^#[0-9a-f]{6}$/.test(s[1])||!(s[2]>=0&&s[2]<=1))||Object.values(o.paint).some(v=>typeof v==='number'&&!Number.isFinite(v)))));
 if(badPaint)failures.push({category,name,problem:'invalid paint',detail:JSON.stringify({fill:badPaint.fill,a:badPaint.a,paint:badPaint.paint&&{...badPaint.paint,stops:badPaint.paint.stops.slice(0,4)}})});
 if(st.dropped)failures.push({category,name,problem:'non-finite points',detail:`${st.dropped} polygons dropped`});
 if(expectInk&&!polys.length)failures.push({category,name,problem:'no ink'});
 if(st.points>2e6)failures.push({category,name,problem:'over budget',detail:`${st.points} points`});
 // At default settings no colour may paint a net negative area. Random stacks with extreme settings can tangle
 // outlines into self-crossing loops (a 720° twirl through sharp noise), so there it is only a warning.
 for(const o of ops){const total=o.polys.reduce((a,p)=>a+E.polyArea(p),0);if(total<-1){(category==='random'?warnings:failures).push({category,name,problem:'negative fill (cancelling outlines)',note:`net ${total.toFixed(0)} in ${o.fill}`,detail:`${total.toFixed(0)} in ${o.fill}`});break;}}
 if(st.skipped)warnings.push({category,name,note:`copying skipped ${st.skipped}× at the point budget`});
 if(st.culled>polys.length&&polys.length)warnings.push({category,name,note:`${st.culled} polygons culled off-page`});
 slow.push({category,name,ms:+ms.toFixed(1),points:st.points});if(ms>2000)console.log(`  slow: ${category} ${name} ${ms.toFixed(0)} ms, ${st.points} points`);}
const done=c=>console.log(`${c}: ${results[c]} checked, ${failures.filter(f=>f.category===c).length} failing`);

// 1. Every ordered pair of modifiers (outline modifiers always run first, so their order is the stack order among them).
for(const a of MODS)for(const b of MODS)run('pairs',`${a} → ${b}`,base({modifiers:[mod(a),mod(b)]}),{deterministic:Math.random()<.05});
done('pairs');
// 2. Every modifier on every element type, and every element under a lifting effector plus the modifier.
for(const [en,el] of Object.entries(ELEMENTS))for(const m of MODS){run('elements',`${m} on ${en}`,{recipe:'custom',format:'poster',layers:[{id:'L1',...el}],modifiers:[mod(m)]});
 run('elements',`${m} on lifted ${en}`,{recipe:'custom',format:'poster',layers:[{id:'L1',...el}],effectors:[{type:'pillars',height:60,field:{shape:'all',follow:false}}],modifiers:[mod(m)]});}
done('elements');
// 3. Every ordered pair of bending modifiers blended by Add and by Average, and chained, inside a group.
for(const op of ['add','average','chain'])for(const a of POINT)for(const b of POINT)run('blends',`${op}(${a}, ${b})`,base({modifiers:[{type:'group',op,field:{shape:'all',follow:false},children:[mod(a),mod(b)]}]}));
done('blends');
// 3b. Colour modifiers: every ordered pair, each after every modifier, on every element, and every target with every
// field shape and motion, pointer included.
const COLS=Object.keys(E.COLOURS),col=(type,o={})=>({type,target:'page',field:{...E.COLOURS[type].field,follow:false},...o});
results.colours=0;
for(const a of COLS)for(const b of COLS)run('colours',`${a} → ${b}`,base({colours:[col(a),col(b)]}),{deterministic:Math.random()<.05});
for(const c of COLS)for(const m of MODS)run('colours',`${m} then ${c}`,base({modifiers:[mod(m)],colours:[col(c)]}));
for(const [en,el] of Object.entries(ELEMENTS))for(const c of COLS)run('colours',`${c} on ${en}`,{recipe:'custom',format:'poster',palette:'neon',layers:[{id:'L1',...el}],colours:[col(c,{target:'all'})]});
for(const c of COLS)for(const target of ['all','L1','L2','paper','page'])for(const shape of E.FIELD[0].options.map(o=>o[0]))for(const drive of ['static','orbit','pulse'])
 run('colours',`${c} on ${target}, ${shape} field, ${drive}`,base({colours:[col(c,{target,field:{...E.COLOURS[c].field,shape,drive,follow:drive==='orbit',steps:drive==='pulse'?4:0}})]}),{pointer:drive==='orbit'?{x:.3,y:.7,w:1}:null,expectInk:!(c==='fade'&&shape==='all'&&target!=='paper')});
done('colours');
// 4. Seeded random stacks: random elements, effectors, modifiers, groups, fields, extremes, formats, times and pointers.
const rnd=E.rng(20261108),pick=a=>a[Math.floor(rnd()*a.length)];
const vary=(specs,extreme)=>{const o={};for(const p of specs){if(p.type==='range')o[p.id]=extreme&&rnd()<.5?(rnd()<.5?p.min:p.max):p.min+rnd()*(p.max-p.min);else if(p.type==='select')o[p.id]=pick(p.options)[0];else if(p.type==='toggle')o[p.id]=rnd()<.5;else if(p.type==='colour')o[p.id]=pick(['paper','ink','accent','white','black','#3df5ff']);}return o;};
const randField=()=>({...vary(E.FIELD.filter(p=>p.id!=='follow'),rnd()<.3),follow:rnd()<.2});
for(let i=0;i<1500;i++){const extreme=rnd()<.35,layers=[...Array(1+Math.floor(rnd()*2))].map((_,k)=>({id:'L'+(k+1),...ELEMENTS[pick(Object.keys(ELEMENTS))]}));
 const modifiers=[...Array(1+Math.floor(rnd()*4))].map(()=>{const type=pick(MODS);return {type,...vary(E.MODIFIERS[type].params,extreme),field:randField(),strength:rnd()<.8?1:rnd()};});
 if(rnd()<.3){const kids=modifiers.splice(0,Math.min(3,modifiers.length)).filter(m=>E.MODIFIERS[m.type].kind!=='shape');modifiers.push({type:'group',op:pick(['chain','add','average']),field:randField(),strength:rnd()<.8?1:rnd(),children:kids});}
 const effectors=[...Array(Math.floor(rnd()*3))].map(()=>{const type=pick(Object.keys(E.EFFECTORS));return {type,...vary(E.EFFECTORS[type].params,extreme),field:randField()};});
 const colours=rnd()<.45?[...Array(1+Math.floor(rnd()*3))].map(()=>{const type=pick(COLS);return {type,...vary(E.COLOURS[type].params,extreme),target:pick(['all','page','paper','L1']),field:randField(),strength:rnd()<.8?1:rnd()};}):[];
 run('random',`random #${i}`,{recipe:'custom',format:pick(Object.keys(E.FORMATS)),seed:Math.floor(rnd()*1e5),layers,effectors,modifiers,colours},{t:rnd()*12,pointer:rnd()<.3?{x:rnd()*1.4-.2,y:rnd()*1.4-.2,w:rnd()}:null,expectInk:false,deterministic:rnd()<.05});}
done('random');
// 5. Named edge cases.
const big={id:'L1',type:'text',text:'WWW/MMM',font:'archivo'},EDGE=[
 ['empty stack',{recipe:'custom',layers:[]},{expectInk:false}],
 ['empty text',{recipe:'custom',layers:[{id:'L1',type:'text',text:''}],modifiers:[mod('echo'),mod('kaleido')]},{expectInk:false}],
 ['unsupported characters only',{recipe:'custom',layers:[{id:'L1',type:'text',text:'☃☃'}],modifiers:[mod('dial')]},{expectInk:false}],
 ['garbage artwork',{recipe:'custom',layers:[{id:'L1',type:'artwork',svg:'<svg><path d="M1 2 L nan Z C"/><circle r="-4"/>'}],modifiers:[mod('shatter')]},{expectInk:false}],
 ['background-only artwork',{recipe:'custom',layers:[{id:'L1',type:'artwork',svg:'<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/></svg>'}],modifiers:[mod('tiles')]},{expectInk:false}],
 ['hard tiny field with steps',base({modifiers:[mod('lens',{field:{shape:'radial',radius:.02,softness:0,steps:12,invert:true}})]}),{}],
 ['pointer far outside',base({modifiers:[mod('twirl',{field:{follow:true,radius:.4}})]}),{pointer:{x:-3,y:5,w:1}}],
 ['lens and inverse spherize at extremes',base({modifiers:[mod('lens',{amount:1.5,field:{shape:'all',follow:false}}),mod('spherize',{amount:-1})]}),{}],
 ['perspective at the horizon',base({modifiers:[mod('perspective',{tilt:80,distance:.4}),mod('perspective',{tilt:-80,distance:.4})]}),{expectInk:false}],
 ['bend a full turn twice',base({modifiers:[mod('bend',{angle:360}),mod('bend',{angle:-360,axis:90})]}),{}],
 ['three-turn spiral, both ways',base({modifiers:[mod('polar',{span:1080,spiral:1}),mod('polar',{span:1080,spiral:-1})]}),{}],
 ['growing echoes',{recipe:'custom',layers:[big],modifiers:[mod('echo',{copies:24,scale:1.5,distance:200})]},{}],
 ['copy explosion',{recipe:'custom',layers:[big,{id:'L2',...ELEMENTS.grid}],modifiers:[mod('repeat',{cols:8,rows:8}),mod('kaleido',{segments:24,mode:'copies'}),mod('echo',{copies:24})]},{}],
 ['tiny tiles on big type',{recipe:'custom',layers:[big],modifiers:[mod('tiles',{size:6,offset:200})]},{}],
 ['thin dial rings',{recipe:'custom',layers:[big],modifiers:[mod('dial',{width:6,pattern:'random'})]},{}],
 ['fine zigzag',{recipe:'custom',layers:[big],modifiers:[mod('zigzag',{size:40,spacing:2})]},{}],
 ['weight that erases',{recipe:'custom',layers:[big],modifiers:[mod('weight',{amount:-40})]},{expectInk:false}],
 ['weight, round, outline, inline, screen at extremes',{recipe:'custom',layers:[big],modifiers:[mod('weight',{amount:60}),mod('round',{radius:80,corners:'both'}),mod('outline',{width:60,position:'outside'}),mod('inline',{rings:12,step:1}),mod('screen',{pitch:3,fit:'coverage'})]},{}],
 ['long shadow at full length after a ribbon flip',{recipe:'custom',layers:[big],modifiers:[mod('ribbon',{twist:720}),mod('shadow',{style:'long',length:600})]},{}],
 ['melt and roughen at extremes',{recipe:'custom',layers:[big],modifiers:[mod('melt',{length:600,width:4}),mod('roughen',{amount:40,grain:1})]},{}],
 ['pillars under a fold past 90°',{recipe:'custom',layers:[big],effectors:[{type:'pillars',height:200,field:{shape:'all',follow:false}}],modifiers:[mod('fold',{angle:170})]},{}],
 ['group with no children',base({modifiers:[{type:'group',op:'add',children:[]}]}),{}],
 ['group with outline and nested group children',base({modifiers:[{type:'group',children:[mod('inline'),{type:'group',children:[mod('lens')]},mod('twirl')]}]}),{}],
 ['group at zero strength',base({modifiers:[{type:'group',strength:0,children:[mod('lens'),mod('echo')]}]}),{}],
 ['shrunk-away elements',base({effectors:[{type:'pinch',amount:-1,field:{shape:'all',follow:false}}],modifiers:[mod('echo')]}),{expectInk:false}],
];
// Colour edge cases: everything at once, hard tiny fields, many spectrum bands on noise, after a copy explosion,
// faded to nothing, on an empty page.
const noise={shape:'noise',scale:12,softness:0,follow:false};
EDGE.push(['eight colour modifiers on the whole poster',base({colours:COLS.slice(0,8).map(c=>col(c))}),{}],
 ['hard tiny colour field with steps',base({colours:[col('invert',{field:{shape:'radial',radius:.02,softness:0,steps:12,invert:true}})]}),{}],
 ['six spectrum bands and a spinning hue on noise',base({colours:[col('spectrum',{bands:6,cycles:4,field:noise}),col('hue',{angle:180,cycles:4,field:{...noise,scale:.5}})]}),{}],
 ['colour after a copy explosion',{recipe:'custom',layers:[big,{id:'L2',...ELEMENTS.grid}],modifiers:[mod('repeat',{cols:8,rows:8}),mod('echo',{copies:24})],colours:[col('gradient'),col('tint',{field:{shape:'box',radius:.3,follow:false}})]},{}],
 ['faded to nothing',base({colours:[col('fade',{target:'all',field:{shape:'all',follow:false}})]}),{expectInk:false}],
 ['colour on an empty page',{recipe:'custom',layers:[],colours:[col('gradient',{target:'paper'}),col('posterize',{levels:2})]},{expectInk:false}],
 ['paper only, noise cells, transparent fade',{recipe:'custom',layers:[big],colours:[col('spectrum',{target:'paper',field:noise}),col('fade',{target:'page',amount:.6,field:noise})]},{}]);
for(const f of Object.keys(E.FORMATS))EDGE.push([`every combo on ${f}`,{recipe:'custom',format:f,layers:[{id:'L1',...ELEMENTS.lines},{id:'L2',type:'text',text:'Ag'}],modifiers:Object.values(E.COMBOS).slice(0,8).map(c=>c.group)},{}]);
for(const [name,state,o] of EDGE){const t0=performance.now();run('edges',name,state,{...o,deterministic:true});if(performance.now()-t0>3000)console.log(`  edge case ${name} took ${(performance.now()-t0).toFixed(0)} ms`);}
done('edges');
// A group at strength 0 must equal no modifiers, and a chain group equal its children inline.
{const ops=s=>{const n=E.normalize(s),sc=E.prepare(n),c=E.context(n,sc,1,null);return JSON.stringify(E.compose(sc,n,E.evaluate(sc,n,c),c));};
 if(ops(base({modifiers:[{type:'group',strength:0,children:[mod('lens'),mod('echo')]}]}))!==ops(base()))failures.push({category:'edges',name:'group at zero strength',problem:'not neutral'});
 if(ops(base({modifiers:[{type:'group',op:'chain',field:{shape:'all',follow:false},children:[mod('lens'),mod('echo')]}]}))!==ops(base({modifiers:[mod('lens'),mod('echo')]})))failures.push({category:'edges',name:'chain group',problem:'differs from the same modifiers inline'});
 if(ops(base({modifiers:[{type:'group',op:'add',field:{shape:'all',follow:false},children:[mod('wave')]}]}))!==ops(base({modifiers:[mod('wave')]})))failures.push({category:'edges',name:'add group of one',problem:'differs from the modifier alone'});}

slow.sort((a,b)=>b.ms-a.ms);
const report={engine:E.ENGINE,checks:results,failures,warnings:warnings.slice(0,200),warningCount:warnings.length,slowest:slow.slice(0,25)};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'combinations.json'),JSON.stringify(report,null,1));
const total=Object.values(results).reduce((a,b)=>a+b,0);
console.log(`${total} combinations: ${JSON.stringify(results)}; ${failures.length} failures, ${warnings.length} warnings`);
const byProblem={};for(const f of failures)(byProblem[f.problem]??=[]).push(f.name);for(const [k,v] of Object.entries(byProblem))console.log(`  ${k}: ${v.length} — ${v.slice(0,12).join('; ')}`);
console.log('  slowest:',slow.slice(0,8).map(s=>`${s.name} ${s.ms}ms`).join('; '));
if(failures.length)process.exit(1);
