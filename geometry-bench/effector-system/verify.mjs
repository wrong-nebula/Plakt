// Same-machine checks of the effector engine. Writes output/effector-study-v1/validation.json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as E from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(here,'../../output/effector-study-v1');
const results=[];let failed=0;
const check=(name,ok,detail='')=>{results.push({name,ok:!!ok,detail});if(!ok){failed++;console.log('FAIL',name,detail);}};
const svg=(s,o)=>E.render(s,o).svg,ops=(s,o)=>JSON.stringify(E.render(s,o).ops),clean=s=>!/NaN|Infinity/.test(s);
const base={recipe:'custom',format:'square',palette:'paper',layers:[{id:'L1',type:'grid',cols:14,gap:.2},{id:'L2',type:'text',text:'AB'}]};
const still=(o={})=>({shape:'radial',radius:.4,softness:.8,follow:false,...o});

// Recipes: valid, deterministic, seamless over the loop, normalized state is a fixed point.
for(const id of Object.keys(E.RECIPES)){const a=E.render({recipe:id},{t:1.3});
 check(`recipe ${id} renders`,clean(a.svg)&&a.ops.length>0);
 check(`recipe ${id} deterministic`,a.svg===svg({recipe:id},{t:1.3}));
 check(`recipe ${id} seamless loop`,svg({recipe:id},{t:0})===svg({recipe:id},{t:a.state.loop}));
 check(`recipe ${id} normalize fixed point`,JSON.stringify(E.normalize(a.state))===JSON.stringify(a.state));}

// Effectors and modifiers: each changes the picture, strength zero changes nothing, every option renders.
const none=svg(base,{t:1});
for(const [type,def] of Object.entries(E.EFFECTORS)){const field=['wave','jitter','spin','snap','flow','recolour'].includes(type)?{shape:'all',follow:false}:still();
 const extra=type==='snap'?[{type:'twist',mode:'turn',angle:23,field:still()}]:[];
 const s=o=>({...base,effectors:[...extra,{type,field,...o}]});
 check(`effector ${type} changes output`,svg(s({}),{t:1})!==(extra.length?svg({...base,effectors:extra},{t:1}):none));
 check(`effector ${type} strength 0 is identity`,ops(s({strength:0}),{t:1})===ops(extra.length?{...base,effectors:extra}:base,{t:1}));
 for(const p of def.params){const vals=p.type==='select'?p.options.map(o=>o[0]):p.type==='range'?[p.min,p.max]:[];for(const v of vals)check(`effector ${type}.${p.id}=${v} renders`,clean(svg(s({[p.id]:v}),{t:1})));}}
const modBase={...base,layers:[{id:'L1',type:'lines',direction:'horizontal',count:16,weight:.2,area:'bleed'},{id:'L2',type:'text',text:'AB'}]},modNone=svg(modBase,{t:1});
for(const [type,def] of Object.entries(E.MODIFIERS)){const s=o=>({...modBase,modifiers:[{type,field:{shape:'all',follow:false,radius:.42},...o}]});
 check(`modifier ${type} changes output`,svg(s({}),{t:1})!==modNone);
 check(`modifier ${type} keeps ink at its defaults`,E.render(s({}),{t:1}).ops.some(o=>o.polys.length));
 check(`modifier ${type} strength 0 is identity`,ops(s({strength:0}),{t:1})===ops(modBase,{t:1}));
 for(const p of def.params){const vals=p.type==='select'?p.options.map(o=>o[0]):p.type==='range'?[p.min,p.max]:p.type==='toggle'?[true,false]:[];for(const v of vals)check(`modifier ${type}.${p.id}=${v} renders`,clean(svg(s({[p.id]:v}),{t:1})));}}

// Fields: inverting a field gives its complement; every shape and motion renders.
const ctx={W:1000,H:1000,M:1000,phase:.3,pointer:null};
for(const shape of E.FIELD[0].options.map(o=>o[0])){const f=E.normalize({...base,effectors:[{type:'pinch',field:{shape}}]}).effectors[0].field,F=E.resolveField(f,ctx),G=E.resolveField({...f,invert:true},ctx);
 let worst=0;for(let i=0;i<50;i++){const x=(i*137)%1000,y=(i*311)%1000;worst=Math.max(worst,Math.abs(E.fieldValue(F,x,y)+E.fieldValue(G,x,y)-1));}check(`field ${shape} invert is complement`,worst<1e-9,`max error ${worst}`);}
for(const drive of E.FIELD[1].options.map(o=>o[0]))check(`field motion ${drive} seamless`,svg({...base,effectors:[{type:'pinch',field:still({drive})}]},{t:0})===svg({...base,effectors:[{type:'pinch',field:still({drive})}]},{t:6}));

// Pillars: walls plus the lifted face cover exactly the swept square (nonzero fill, sampled on a grid).
{const r=E.render({recipe:'custom',format:'square',layers:[{id:'L1',type:'grid',cols:3,gap:.5,shape:'square'}],effectors:[{type:'pillars',height:100,angle:-60,field:{shape:'all',follow:false}}]});
 const polys=r.ops.flatMap(o=>o.polys);let hit=0;const ex=Math.cos(-60*Math.PI/180)*100,ey=Math.sin(-60*Math.PI/180)*100,cells=r.scene.layers[0].clones,side=cells[0].shape.r*2;
 for(let x=0;x<1000;x+=4)for(let y=0;y<1000;y+=4)if(E.winding(polys,x+2,y+2)!==0)hit++;
 const expect=cells.length*(side*side+side*(Math.abs(ex)+Math.abs(ey)));
 check('pillars sweep area',Math.abs(hit*16-expect)/expect<.03,`sampled ${hit*16}, expected ${expect.toFixed(0)}`);}

// Cut modifiers keep orientation: mirrored and kaleidoscoped copies never cancel under nonzero fill.
for(const type of ['mirror','kaleido','echo','slice','shatter']){const r=E.render({...modBase,modifiers:[{type,field:{shape:'all',follow:false}}]},{t:1});
 const neg=r.ops.flatMap(o=>o.polys).filter(p=>E.polyArea(p)<-1).length,all=r.ops.flatMap(o=>o.polys).length;check(`${type} keeps outer orientation`,neg<all*.5,`${neg} negative of ${all}`);}

// SVG import: transforms, evenodd holes and the background rule.
{const art=`<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffffff"/><g transform="translate(10 10) scale(2)"><path fill-rule="evenodd" fill="#ff0000" d="M0 0H20V20H0ZM5 5H15V15H5Z"/></g><circle cx="80" cy="80" r="10" fill="rgb(0,0,255)"/></svg>`;
 const p=E.parseSVG(art);check('svg import items',p.items.length===3);
 const groups=E.splitContours(p.items[1].polys,p.items[1].rule);check('evenodd hole grouped with its outer',groups.length===1&&groups[0].length===2);
 check('evenodd hole reversed for nonzero',Math.sign(E.polyArea(groups[0][0]))!==Math.sign(E.polyArea(groups[0][1])));
 check('transform applied',Math.abs(E.bboxOf(p.items[1].polys)[2]-50)<1e-6);
 const r=E.render({recipe:'custom',layers:[{id:'L1',type:'artwork',svg:art}]});check('artwork background becomes ground',r.scene.layers[0].ground==='#ffffff'&&r.scene.layers[0].clones.length===2);}

// Seeded per-element values lie in [0, 1) (an XOR once made half of them negative), and Tiles at its default
// recolours nothing.
{const sc=E.prepare(E.normalize({recipe:'custom',layers:[{id:'L1',type:'grid',cols:30}]})),r=sc.layers[0].clones.flatMap(c=>[c.r1,c.r2,c.r3,c.r4]);
 check('seeded values in [0, 1)',r.every(v=>v>=0&&v<1)&&Math.min(...r)<.05&&Math.max(...r)>.95,`${Math.min(...r).toFixed(3)}…${Math.max(...r).toFixed(3)}`);
 const ops=E.render({recipe:'custom',layers:[{id:'L1',type:'text',text:'M'}],modifiers:[{type:'tiles',field:{shape:'all',follow:false}}]}).ops;check('tiles at default keeps one colour',new Set(ops.map(o=>o.fill)).size===1);}

// Colour modifiers: they repaint only (the same outlines come out), their paint is valid, strength zero changes
// nothing, every option, target and field renders, and the paper is a target of its own.
{const cBase={...base,palette:'neon'},plain=E.render(cBase,{t:1}),fx=v=>Number.isFinite(v);
 // Outlines are compared by what they cover (sampled on a grid, per element), since colour cells may split a shape.
 const shapes=ops=>{const by={};for(const o of ops)if(o.layer!=='paper')(by[o.layer]??=[]).push(...o.polys);let k='';for(const l of Object.keys(by).sort()){k+=l+':';for(let i=0;i<48;i++)for(let j=0;j<48;j++)k+=E.winding(by[l],(i+.5)*1000/48,(j+.5)*1000/48)!==0?1:0;}return k;};
 const hexOK=h=>/^#[0-9a-f]{6}$/.test(h),paintOK=ops=>ops.every(o=>hexOK(o.fill)&&o.a>=0&&o.a<=1&&(!o.paint||(o.paint.stops.length>=2&&
  o.paint.stops.every((s,i,a)=>s[0]>=0&&s[0]<=1&&(!i||s[0]>=a[i-1][0])&&hexOK(s[1])&&s[2]>=0&&s[2]<=1)&&['x1','y1','x2','y2','cx','cy','r'].every(k=>!(k in o.paint)||fx(o.paint[k])))));
 const refsOK=svg=>(svg.match(/url\(#p\d+\)/g)||[]).length===(svg.match(/<(linear|radial)Gradient /g)||[]).length;
 for(const [type,def] of Object.entries(E.COLOURS)){const s=o=>({...cBase,colours:[{type,target:'page',field:{...def.field,follow:false},...o}]}),r=E.render(s({}),{t:1});
  check(`colour ${type} changes output`,r.svg!==plain.svg);
  check(`colour ${type} keeps the outlines`,shapes(r.ops)===shapes(plain.ops));
  check(`colour ${type} paint is valid`,paintOK(r.ops)&&refsOK(r.svg)&&clean(r.svg));
  check(`colour ${type} strength 0 is identity`,ops(s({strength:0}),{t:1})===ops(cBase,{t:1}));
  for(const p of def.params){const vals=p.type==='select'?p.options.map(o=>o[0]):p.type==='range'?[p.min,p.max]:p.type==='toggle'?[true,false]:p.type==='colour'?['paper','ink','accent','white','black','#12ab9f']:[];
   for(const v of vals){const q=E.render(s({[p.id]:v}),{t:1});check(`colour ${type}.${p.id}=${v} renders`,clean(q.svg)&&paintOK(q.ops));}}
  for(const target of ['all','L1','L2','paper','page']){const q=E.render(s({target}),{t:1});check(`colour ${type} on ${target} renders`,clean(q.svg)&&paintOK(q.ops)&&refsOK(q.svg));
   if(target==='paper')check(`colour ${type} on the paper leaves the elements`,JSON.stringify(q.ops.filter(o=>o.layer!=='paper'))===JSON.stringify(plain.ops));}
  for(const shape of E.FIELD[0].options.map(o=>o[0])){const q=E.render(s({field:{...def.field,shape,follow:false}}),{t:1});check(`colour ${type} with a ${shape} field renders`,clean(q.svg)&&paintOK(q.ops)&&refsOK(q.svg));}}
 // How paint is chosen: one gradient per operation along a shared axis, shape by shape for mixed axes, cells for noise.
 const kinds=colours=>{const o=E.render({...cBase,colours},{t:1}).ops;return {linear:o.filter(x=>x.paint?.type==='linear').length,radial:o.filter(x=>x.paint?.type==='radial').length,ops:o.length,paper:o.filter(x=>x.layer==='paper').length};};
 const lin={shape:'linear',angle:90,radius:1,softness:1,follow:false},rad={shape:'radial',radius:.4,softness:1,follow:false};
 {const k=kinds([{type:'tint',target:'page',field:lin}]);check('linear field paints one linear gradient per operation',k.linear===k.ops&&k.radial===0,JSON.stringify(k));}
 {const k=kinds([{type:'tint',target:'page',field:rad},{type:'light',target:'page',field:{...rad,radius:.2}}]);check('concentric fields share one radial gradient per operation',k.radial===k.ops,JSON.stringify(k));}
 {const k=kinds([{type:'tint',target:'all',field:lin},{type:'light',target:'all',field:{...rad,x:.2}}]);check('mixed axes paint shape by shape',k.ops>plain.ops.length*3,JSON.stringify(k));}
 {const k=kinds([{type:'spectrum',target:'paper',field:{shape:'noise',follow:false}}]);check('a noise field tiles the paper into cells',k.paper>100,JSON.stringify(k));}
 // Posterize after a gradient leaves hard stops: neighbouring offsets almost equal, colours different.
 {const o=E.render({...cBase,colours:[{type:'gradient',target:'paper',ramp:'holo',field:lin},{type:'posterize',target:'paper',levels:4}]},{t:1}).ops.find(x=>x.paint);
  check('posterize makes hard stops',!!o&&o.paint.stops.some((s,i,a)=>i&&s[0]-a[i-1][0]<.002&&s[1]!==a[i-1][1]));}
 {const o=E.render({...cBase,colours:[{type:'fade',target:'all',field:lin}]},{t:1}).ops;check('fade lowers opacity',o.some(x=>x.paint?.stops.some(s=>s[2]<.5)));}
 {const a=E.render({...cBase,colours:[{type:'hue',target:'page',cycles:1,field:{shape:'all',follow:false}}]},{t:0}).svg,b=E.render({...cBase,colours:[{type:'hue',target:'page',cycles:1,field:{shape:'all',follow:false}}]},{t:6}).svg;check('colour motion is seamless',a===b);}}

// Palettes, shuffles and formats.
for(const [id,p] of Object.entries(E.PALETTES))check(`palette ${id} ink contrast`,E.contrast(p.colors[0],p.colors[1])>=4.5,E.contrast(p.colors[0],p.colors[1]).toFixed(2));
for(let s=1;s<=40;s++){const st=E.shuffle(s);check(`shuffle ${s} renders`,clean(svg(st,{t:1.7})));}
for(const f of Object.keys(E.FORMATS)){const r=E.render({recipe:'ridges',format:f});check(`format ${f} page`,r.svg.includes(`viewBox="0 0 ${E.FORMATS[f].w} ${E.FORMATS[f].h}"`));}

fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({engine:E.ENGINE,checks:results.length,failed,results},null,1));
console.log(`${results.length-failed}/${results.length} checks passed`);if(failed)process.exit(1);
