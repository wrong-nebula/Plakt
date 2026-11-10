// Same-machine checks of the dither core and the Heavy dither engine. Writes output/heavy-dither-study-v1/validation.json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {METHODS,dither,blur,coverage,threshold} from './dither.mjs';
import * as E from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(here,'../../output/heavy-dither-study-v1');
const results=[];let failed=0;
const check=(name,ok,detail='')=>{results.push({name,ok:!!ok,detail});if(!ok){failed++;console.log('FAIL',name,detail);}};
const clean=s=>!/NaN|Infinity|undefined/.test(s);

// Dither core: a flat grey keeps its mean ink in every method; a ramp only darkens; 0 and 1 stay exact.
const N=96,mean=q=>q.reduce((s,v)=>s+v,0)/q.length;
// An n×n matrix only has n² steps, so its tolerance is half a step. Atkinson diffuses 6/8 of the error by design:
// it pushes light greys lighter and dark greys darker, which is its heavy look, so it is checked for that instead.
const TOL={bayer2:.126,lines:.126,bayer4:.032,cluster:.032,bayer8:.008,blue:.02,white:.03};
for(const id of Object.keys(METHODS)){const tol=TOL[id]??.012;
 for(const v of [.1,.25,.5,.75,.9]){const q=dither(new Float32Array(N*N).fill(v),N,N,{method:id});const m=mean(q);
  if(id==='atkinson')check(`atkinson pushes ${v} away from mid-grey`,v<.5?m<=v+.01:v>.5?m>=v-.01:Math.abs(m-v)<.02,`mean ${m.toFixed(4)}`);
  else if(id!=='threshold')check(`${id} keeps mean ink ${v}`,Math.abs(m-v)<tol,`mean ${m.toFixed(4)}`);}
 check(`${id} keeps paper and full ink exact`,mean(dither(new Float32Array(400).fill(0),20,20,{method:id}))===0&&mean(dither(new Float32Array(400).fill(1),20,20,{method:id}))===1);
 const ramp=new Float32Array(256*32);for(let j=0;j<32;j++)for(let i=0;i<256;i++)ramp[j*256+i]=i/255;const q=dither(ramp,256,32,{method:id}),col=[0,0,0,0];
 for(let j=0;j<32;j++)for(let i=0;i<256;i++)col[i>>6]+=q[j*256+i];check(`${id} darkens along a ramp`,col[0]<=col[1]&&col[1]<=col[2]&&col[2]<=col[3],col.join(' '));
 for(const n of [3,4]){const q3=dither(new Float32Array(N*N).fill(.4),N,N,{method:id,levels:n}),m3=mean(q3)/(n-1);if(id!=='threshold'&&id!=='atkinson')check(`${id} keeps mean ink at ${n} levels`,Math.abs(m3-.4)<Math.max(tol,.02),`mean ${m3.toFixed(4)}`);check(`${id} stays within ${n} levels`,q3.every(l=>l<n));}}
// Ordered methods read the page index: two neighbouring grids match one grid across both.
for(const id of Object.keys(METHODS).filter(k=>METHODS[k].kind==='ordered')){const v=new Float32Array(64*32).map((_,k)=>(k%64)/64),whole=dither(v,64,32,{method:id});
 const left=dither(v.filter((_,k)=>k%64<32),32,32,{method:id}),right=dither(v.filter((_,k)=>k%64>=32),32,32,{method:id,i0:32});
 check(`${id} pattern continues across grids`,[...whole].every((l,k)=>l===((k%64)<32?left[Math.floor(k/64)*32+k%64]:right[Math.floor(k/64)*32+k%64-32])));}
check('Bayer 8×8 thresholds are a permutation',new Set(Array.from({length:64},(_,k)=>threshold('bayer8',k%8,k>>3))).size===64);
check('order 0 is plain diffusion',dither(new Float32Array(900).fill(.37),30,30,{method:'atkinson'}).join()===dither(new Float32Array(900).fill(.37),30,30,{method:'atkinson',order:0}).join());
// Coverage: exact areas for a square, a square with a reversed hole, and a triangle; blur keeps a flat field flat.
const area=c=>c.reduce((s,v)=>s+v,0);
check('coverage of a square is its area',Math.abs(area(coverage([[2.5,3.25,12.5,3.25,12.5,9.75,2.5,9.75]],16,16,{sub:8}))-65)<.01);
check('coverage subtracts a reversed hole',Math.abs(area(coverage([[1,1,15,1,15,15,1,15],[5,5,5,11,11,11,11,5]],16,16,{sub:8}))-(196-36))<.01);
check('coverage of a triangle is close to its area',Math.abs(area(coverage([[0,0,16,0,0,16]],16,16,{sub:16}))-128)<.6);
check('blur keeps a flat field',blur(new Float32Array(400).fill(.3),20,20,3).every(v=>Math.abs(v-.3)<1e-6));

// Styles: valid, deterministic, inked, normalization is a fixed point; their phone proofs keep ink at 390 px.
for(const f of E.FAMILIES){const a=E.render({family:f.id}),b=E.render({family:f.id});
 check(`style ${f.id} renders`,clean(a.svg)&&a.svg.includes('<path'));check(`style ${f.id} deterministic`,a.svg===b.svg);
 check(`style ${f.id} normalize fixed point`,JSON.stringify(E.normalize(a.state))===JSON.stringify(a.state));
 const used=a.stats.counts.filter(c=>c>0).length;check(`style ${f.id} uses at least two of its ${a.stats.inks.length} inks`,used>=2,a.stats.counts.join(' '));
 check(`style ${f.id} tone view renders`,clean(E.render({family:f.id},{view:'tone'}).svg));}
// Every option and range end renders; every shape renders alone; every arrangement lays out its panels.
const base={family:'riso',format:'square',params:{pixel:10}};
for(const [id,opts] of Object.entries(E.OPTIONS))if(!['shape','blend'].includes(id))for(const v of opts)check(`option ${id}=${v} renders`,clean(E.render({...base,[id]:v}).svg));
for(const c of E.CONTROLS)for(const v of [c.min,c.max])check(`control ${c.id}=${v} renders`,clean(E.render({...base,params:{...base.params,[c.id]:c.id==='pixel'&&v<4?4:v}}).svg));
for(const id of E.SHAPE_IDS)for(const blend of Object.keys(E.BLENDS)){const r=E.render({...base,items:[{shape:'ramp',size:1.8},{shape:id,size:.8,blend,text:'AB'}]});check(`shape ${id} with ${blend} renders`,clean(r.svg)&&r.stats.counts.filter(c=>c).length>=2);}
for(const c of E.ITEM_CONTROLS)for(const v of [c.min,c.max])check(`item ${c.id}=${v} renders`,clean(E.render({...base,items:[{shape:'blob',[c.id]:v}]}).svg));
check('specimen has one panel per method',E.render({family:'framed',arrangement:'specimen'}).stats.panels===Object.keys(METHODS).length);
check('atlas has one panel per shape',E.render({family:'framed',arrangement:'atlas'}).stats.panels===E.SHAPE_IDS.length);
check('steps has four panels',E.render({family:'framed',arrangement:'steps'}).stats.panels===4);
check('no items leaves only the ground',clean(E.render({...base,items:[]}).svg));
// A heavier pixel means fewer cells; the pixel grid fills its panel within one pixel.
const cells=P=>E.render({family:'framed',arrangement:'bleed',params:{pixel:P}}).stats.cells;check('a heavier pixel has fewer cells',cells(4)>cells(8)&&cells(8)>cells(16));
{const r=E.render({family:'moon',format:'square',params:{pixel:9}}),n=Math.floor(900/9);check('the grid fills the page',r.stats.cells===n*n,`${r.stats.cells}`);}
// Inks: the palette ramp has the asked count and keeps its end colours.
for(const [id,p] of Object.entries(E.PALETTES))for(const n of [2,3,4]){const c=E.inks(id,n);check(`palette ${id} at ${n} inks`,c.length===n&&c[0]===p.colors[0]&&c[n-1]===p.colors[p.colors.length-1]);}
// Surprise: twenty seeds render.
for(let k=1;k<=20;k++)check(`surprise ${k} renders`,clean(E.render(E.surprise(k)).svg));
// Applies: dimmed controls leave the poster unchanged.
{const s={family:'moon'},a=E.render(s).svg;check('order is dimmed and inert for ordered methods',!E.applies('order',E.normalize(s))&&E.render({...s,params:{order:.9}}).svg===a);
 check('mark size is dimmed and inert for square pixels',!E.applies('markSize',E.normalize(s))&&E.render({...s,params:{markSize:.5}}).svg===a);
 check('field columns are dimmed and inert outside the field',!E.applies('cols',E.normalize(s))&&E.render({...s,params:{cols:7}}).svg===a);}

fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({engine:E.ENGINE,checks:results.length,failed,results},null,2));
console.log(`${results.length-failed}/${results.length} checks passed`);if(failed)process.exitCode=1;
