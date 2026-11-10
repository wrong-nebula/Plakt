import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,ENGINES,FAMILIES,SETS,MASKS,CONTROLS,OPTIONS,PRIMITIVES,FORMATS,IMAGES,PACKINGS,W,H,render,resolve,layout,layoutOf,levelsOf,weightsOf,token,activeControls,maskInside,mask2Inside,normalizeText,normalizeLevels,specimen,series,b64,unb64} from './engine.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=here.slice(0,here.indexOf('/geometry-bench/')),out=path.join(root,'output/compound-glyph-study-v2'),v1out=path.join(root,'output/compound-glyph-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are freed only by GC: run with --expose-gc (and a capped heap); pixels are read once per image.
let rasters=0;const raster=(s,h=180)=>{if(++rasters%10===0)globalThis.gc?.();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render();};
// SVGs are compared with their per-render id hash normalised (the id changes with every state, drawing or not).
const norm=svg=>{const m=svg.match(/id="([a-z0-9]+)-(t\d+|glow)"/);return m?svg.split(m[1]).join('U'):svg;};
const pixels=s=>hash(raster(render(s).svg).asPng()),svgOf=s=>hash(norm(render(s).svg)),t00=performance.now();
const step=name=>{globalThis.gc?.();console.log(`… ${name} (${((performance.now()-t00)/1000).toFixed(0)} s, rss ${(process.memoryUsage().rss/2**20).toFixed(0)} MB)`);};
const common=['#f0ece2','#1f2a44','#c4402f','#2f8f5a','#e0b62e','#111111','#5b8fc9','#d0482a'],V2=FAMILIES.slice(10).map(f=>f.id);
const report={};

// 1. Version 1 rules draw exactly as in version 1: every saved v1 rule against its v1 SVG (per-render ids normalised), and a pixel sample.
const v1rules=[];
const walk=d=>{for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(f.endsWith('.json')&&fs.existsSync(p.replace(/\.json$/,'.svg')))v1rules.push(p);}};walk(v1out);
assert(v1rules.length>=140,`found ${v1rules.length} v1 rules`);let pixelSame=0;
v1rules.forEach((f,i)=>{const rule=JSON.parse(fs.readFileSync(f));assert.equal(rule.engine,'compound-glyph-v1');const v1svg=fs.readFileSync(f.replace(/\.json$/,'.svg'),'utf8'),r=render(rule);
 assert.equal(norm(r.svg),norm(v1svg),`v1 rule ${path.relative(v1out,f)} draws differently in v2`);if(i%12===0){assert.equal(hash(raster(r.svg,240).asPng()),hash(raster(v1svg,240).asPng()));pixelSame++;}});
report.v1Compatibility=`${v1rules.length} saved v1 rules redrawn by the v2 engine: SVG identical to the v1 files (per-render ids normalised); ${pixelSame} also pixel-identical`;
step('v1 compatibility');
// 2. Seventeen styles under one palette are seventeen different systems.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'styles differ under one palette');step('styles');
// 3. Every control changes the poster wherever it is active (SVG for all styles; pixels for three).
const CONTEXT={maskShift:{mask:'disc'},amount:{field:'radial'},curve:{field:'radial'},scale:{field:'noise'},sizeRange:{field:'radial'},heroScale:{params:{heroes:3}},strength:{flow:'radial',packing:'poisson'},angle:{packing:'poisson',params:{strength:.5}},bias:{set:'forest',level:'density'},mix:{set:'forest',level:'density'},gap:{params:{contour:1}},oddScale:{params:{odd:2}},
 lead:{packing:'rows'},track:{packing:'rows'},panX:{mask:'disc',params:{zoom:2}},panY:{mask:'disc',params:{zoom:2}},reach:{field:'attract',attract:[[.4,.4,1],[.65,.6,1]]},scale2:{mask2:'disc'},x2:{mask2:'disc',params:{scale2:1}},y2:{mask2:'disc',params:{scale2:1}},outside:{params:{amount:.6,inside:.8}}};
const PIXEL_STYLES=['forest','contour','layers'];let controlChecks=0,pixelControlChecks=0;
for(const f of FAMILIES)for(const c of CONTROLS){const ctx=CONTEXT[c.key]??{},base={family:f.id,...ctx,params:{...ctx.params}};
 assert(activeControls(resolve(base)).includes(c.key),`${f.id} ${c.key} should be active in its context`);
 const lo={...base,params:{...base.params,[c.key]:c.min}},hi={...base,params:{...base.params,[c.key]:c.max}};assert.notEqual(svgOf(lo),svgOf(hi),`${f.id} ${c.key} min vs max`);controlChecks++;
 if(PIXEL_STYLES.includes(f.id)){assert.notEqual(pixels(lo),pixels(hi),`${f.id} ${c.key} pixels`);pixelControlChecks++;}}
step('controls');
// 4. Every option value is distinct (four styles in SVG, one in pixels for the v2 options).
const img={w:16,h:16,data:b64(Uint8Array.from({length:256},(_,i)=>(i%16)*16))};
const OCTX={face:{mask:'text',text:'TYPE'},font:{set:'o'},level:{set:'forest',params:{mix:0}},field:{params:{amount:.85},attract:[[.4,.4,1]]},flow:{packing:'poisson',params:{strength:.85}},colorMode:{set:'forest',colors:common},odd:{params:{odd:2}},set:{text:'MORI',custom:'o|O 日|月 森'},mask:{text:'MORI'},render:{params:{glow:.5}},
 mask2:{mode2:'set'},mode2:{mask2:'disc'},set2:{mask2:'disc',mode2:'set',set:'o',text:'TOOT',custom:'o|O 日|月 森',params:{scale2:.8}},outSet:{packing:'poisson',params:{outside:.5},set:'o',text:'TOOT',custom:'o|O 日|月 森'},imageSource:{field:'image',image:img},packing:{},format:{}};
let optionChecks=0,pixelOptionChecks=0;
for(const id of ['forest','alarm','contour','layers'])for(const [k,values0] of Object.entries(OPTIONS)){const ctx=OCTX[k]??{},values=['set2','outSet'].includes(k)?values0.filter(v=>v!==(ctx.set??'o')):values0;
 assert.equal(new Set(values.map(v=>svgOf({family:id,...ctx,params:{...ctx.params},[k]:v}))).size,values.length,`${id} ${k}`);optionChecks+=values.length;
 if(id==='layers'&&['packing','format','mask2','mode2','imageSource','field','colorMode','layout'].includes(k)){assert.equal(new Set(values.map(v=>pixels({family:id,...ctx,params:{...ctx.params},[k]:v}))).size,values.length,`${id} ${k} pixels`);pixelOptionChecks+=values.length;}}
step('options');
// 5. Four passes, exact replay, seeds; every style in every format.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'TYPE/SYSTEM',mask:'text',params:{size:11,seed:321,heroes:2}},a=render(s);render({family:'beach',text:'NO',params:{size:40}});render({family:'layers',format:'square'});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.notEqual(a.svg,render({...s,params:{...s.params,seed:322}}).svg);
 for(const fm of FORMATS){const r=render({family:f.id,format:fm.id});assert.equal(r.width,fm.w);assert.equal(r.height,fm.h);assert(r.svg.includes(`viewBox="0 0 ${fm.w} ${fm.h}"`)&&!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${fm.id}`);}}
step('passes, replay, formats');
// 6. Packing: no overlapping discs, marks inside the field and out of type boxes and the knocked-out title, in every packing.
let marksChecked=0,discPairs=0;const packCheck=(st,label)=>{const s=resolve(st),lay=layout(s),L=layoutOf(s),cell=24,grid=new Map();
 lay.marks.forEach((m,i)=>{marksChecked++;assert(m.x>=L.field[0]-1e-6&&m.x<=L.field[2]+1e-6&&m.y>=L.field[1]-1e-6&&m.y<=L.field[3]+1e-6,`${label}: mark outside field`);for(const [a,b,c,d] of L.keep)assert(!(m.x>a&&m.x<c&&m.y>b&&m.y<d),`${label}: mark in a type box`);
  for(const [x,y,r] of m.discs){const k0=Math.floor(x/cell),k1=Math.floor(y/cell);for(let u=k0-6;u<=k0+6;u++)for(let v=k1-6;v<=k1+6;v++)for(const [x2,y2,r2,j] of grid.get(u+','+v)??[]){assert(Math.hypot(x-x2,y-y2)>=r+r2-1e-6,`${label}: marks ${i} and ${j} overlap`);discPairs++;}}
  for(const [x,y,r] of m.discs){const key=Math.floor(x/cell)+','+Math.floor(y/cell);(grid.get(key)??grid.set(key,[]).get(key)).push([x,y,r,i]);}});return lay;};
for(const f of FAMILIES)packCheck({family:f.id},f.id);for(const p of PACKINGS)packCheck({family:'kanji',packing:p.id},'kanji '+p.id);
const ko=packCheck({family:'sunflower'},'knockout');for(const m of ko.marks){const k=ko.L.knock;assert(m.x<0||samplePolyInside(k.polys,m.x,m.y)===false,'mark inside the knocked-out title');}
function samplePolyInside(polys,x,y){let w=0;for(const p of polys)for(let i=0;i<p.length;i++){const [ax,ay]=p[i],[bx,by]=p[(i+1)%p.length];if((ay<=y)!==(by<=y)){const t=(y-ay)/(by-ay);if(ax+t*(bx-ax)>x)w+=by>ay?1:-1;}}return w!==0;}
report.packing=`${marksChecked} marks in ${FAMILIES.length+PACKINGS.length+1} layouts; ${discPairs} neighbouring disc pairs, none overlapping; no mark inside the knocked-out title`;step('packing');
// 7. Running text keeps reading order: in rows, the marks spell the text again and again.
for(const packing of ['rows','contours','streams']){const s={family:'contour',packing,text:'READ ME IN ORDER',set:'sentence',level:'cycle'},lay=layout(s),seq=lay.marks.filter(m=>m.kind!=='odd'&&m.kind!=='hero'&&m.kind!=='edge').map(m=>m.spec).join(''),word='READMEINORDER';
 assert(seq.length>40,`${packing}: running text placed`);assert(word.repeat(Math.ceil(seq.length/word.length)+2).includes(seq.slice(0,word.length*3)),`${packing}: marks read the text in order (${seq.slice(0,40)})`);}
// 8. Escalation per style: every level used, and its driver rises with the level.
const escalation={};for(const f of FAMILIES){const s=resolve({family:f.id}),lay=layout(s),N=levelsOf(s).length,by=Array.from({length:N},()=>[]);for(const m of lay.marks)if(!m.odd&&m.kind!=='hero'&&m.region==='main')by[m.lv].push(m);
 if(s.set==='sentence'){escalation[f.id]={by:'reading order'};continue;}assert(by.every(l=>l.length>0)||f.id==='hidden'||f.id==='typeset',`${f.id}: every level used (${by.map(l=>l.length)})`);const key={density:'d',edge:'sdf',size:'size'}[s.level],used=by.filter(l=>l.length>0);
 if(key){const means=used.map(l=>l.reduce((a,m)=>a+(s.params.inside<s.params.outside&&key==='sdf'?-m[key]:m[key]),0)/l.length);for(let i=1;i<means.length;i++)assert(means[i]>means[i-1],`${f.id}: mean ${key} rises with level (${means.map(v=>v.toFixed(2))})`);escalation[f.id]={by:s.level,counts:by.map(l=>l.length),means:means.map(v=>+v.toFixed(3))};}
 else escalation[f.id]={by:s.level,counts:by.map(l=>l.length)};}
report.escalation=escalation;step('escalation');
// 9. v2 fields and layers do what they say.
// On a fixed lattice brightness shows as mark size and level, so compare ink (size² × level) per side.
{const lay=layout({family:'moon'}),[x0,,x1]=lay.mask.bbox,cx=(x0+x1)/2,ink=f=>Math.round(lay.marks.filter(f).reduce((a,m)=>a+m.size*m.size*(m.lv+1),0)/1000),lit=ink(m=>m.x<cx-30),dark=ink(m=>m.x>cx+60);assert(lit>dark*1.5,`moon: the lit side carries more ink (${lit} vs ${dark})`);report.image=`moon: ink ${lit} on the lit side vs ${dark} on the shadow side (size² × level, thousands)`;}
{const at=[[.3,.3,1]],lay=layout({family:'forest',field:'attract',attract:at,params:{amount:1,heroes:0}}),near=lay.marks.filter(m=>Math.hypot(m.x-.3*W,m.y-.3*H)<90).length,far=lay.marks.filter(m=>Math.hypot(m.x-.7*W,m.y-.55*H)<90).length;assert(near>far*2,`attractor draws marks (${near} vs ${far})`);report.attractor=`${near} marks near the attractor vs ${far} far from it`;}
{const st={family:'forest',mask:'disc',params:{heroes:0}},a=layout(st),b=layout({...st,strokes:[[.5,.42,.1,1]]}),c=layout({...st,strokes:[[.5,.42,.1,-1]]}),core=l=>l.marks.filter(m=>Math.hypot(m.x-.5*W,m.y-.42*H)<.05*Math.min(W,H)),ink=l=>Math.round(core(l).reduce((t,m)=>t+m.size*m.size*(m.lv+1),0)/100);
 assert(ink(b)>ink(a)*1.15&&core(c).length<=core(a).length*.25,`painted strokes add and erase (ink ${ink(a)} → ${ink(b)}; marks ${core(a).length} → ${core(c).length})`);report.paint=`brush core: ink ${ink(a)} → ${ink(b)} after a denser dab; ${core(a).length} → ${core(c).length} marks after a sparser dab`;}
{const lay=layout({family:'hidden'}),lv=r=>{const l=lay.marks.filter(m=>m.region===r&&!m.odd);return l.reduce((a,m)=>a+m.lv,0)/l.length;};assert(lv('overlay')>lv('main')+1,`hidden word lifts levels (${lv('overlay').toFixed(2)} vs ${lv('main').toFixed(2)})`);report.hidden=`mean level ${lv('overlay').toFixed(2)} inside the hidden word vs ${lv('main').toFixed(2)} around it`;}
{const st={family:'alarm',mask2:'text',text2:'NO',mode2:'void',params:{scale2:.6}},lay=layout(st),M=mask2Inside(st);let inside=0;for(const m of lay.marks){const gx=Math.floor(m.x/M.cell),gy=Math.floor(m.y/M.cell);let deep=true;for(let u=-4;u<=4;u++)for(let v=-4;v<=4;v++)if(!M.ins[(gy+v)*M.width+gx+u])deep=false;if(deep)inside++;}assert.equal(inside,0,'void stays empty');}
{const lay=layout({family:'layers'}),c=r=>lay.marks.filter(m=>m.region===r).length;assert(c('main')>50&&c('overlay')>20&&c('outside')>200,'three layers populated');const sets={main:new Set(),overlay:new Set(),outside:new Set()};for(const m of lay.marks)if(!m.odd)sets[m.region].add(m.spec);assert(['石','砳','磊'].some(x=>sets.main.has(x))&&['火','炎','焱'].some(x=>sets.overlay.has(x))&&['水','沝','淼'].some(x=>sets.outside.has(x)),'each layer draws its own set');report.layers=`mountain ${c('main')}, sun ${c('overlay')}, water ${c('outside')} marks, each in its own set`;}
{const pins=[[.31,.24],[.66,.38],[.47,.55]],lay=layout({family:'kanji',pins,params:{odd:0}});for(const [x,y] of pins)assert(lay.marks.some(m=>m.odd&&Math.hypot(m.x-x*W,m.y-y*H)<1e-6),'odd one at its pin');const hl=layout({family:'forest',heroAt:[[.5,.4]]});assert(hl.marks.some(m=>m.kind==='hero'&&Math.hypot(m.x-.5*W,m.y-.4*H)<1e-6),'hero at its pin');}
{const s=resolve({family:'kanji',set:'custom',custom:'木*4 林 森*.4',level:'random',params:{mix:0,bias:0}}),w=weightsOf(s),lay=layout(s),c=[0,1,2].map(i=>lay.marks.filter(m=>m.lv===i&&m.kind!=='odd'&&m.kind!=='hero').length);assert(w&&c[0]>c[1]*2&&c[1]>c[2],`weighted chain shares (${c})`);report.weights=`木*4 林 森*.4 gives ${c.join(' / ')} marks`;}
{const r=series({family:'kanji'},[{set:'forest'},{set:'fire'},{format:'square'}]);assert.equal(r.width,728+728+900+56);assert.equal(r.height,1030);assert.equal((r.svg.match(/<svg /g)||[]).length,4);}
{const lay=layout({family:'forest',params:{zoom:2.6,panX:-.2}}),b=lay.mask.bbox;assert(b[2]-b[0]>(W-112)*1.5,'zoom enlarges the silhouette past the page');}
step('fields and layers');
// 10. Phone-size reading at 300 px: presets (≥ 3) and word silhouettes (≥ 5); regional styles by colour difference.
// Type is not part of the field: type boxes and a knocked-out title (with its margin) are left out of the measurement.
const contrast=s=>{const img=raster(render(s).svg,300),P=img.pixels,M=maskInside(s),G=[1,3,5].map(i=>parseInt(s.colors[0].slice(i,i+2),16)),k=300/H,Lp=layoutOf(s),[x0,y0,x1,y1]=Lp.field;let inI=0,inN=0,outI=0,outN=0,inC=[0,0,0],outC=[0,0,0];
 for(let py=Math.ceil(y0*k);py<Math.floor(y1*k);py++)for(let px=Math.ceil(x0*k);px<Math.floor(x1*k);px++){if(Lp.keep.some(([a,b,c,d])=>px/k>a&&px/k<c&&py/k>b&&py/k<d))continue;const i=(py*img.width+px)*4,ink=(Math.abs(P[i]-G[0])+Math.abs(P[i+1]-G[1])+Math.abs(P[i+2]-G[2]))/765;
  const gx=Math.min(M.width-1,Math.floor(px/k/M.cell)),gy=Math.min(M.height-1,Math.floor(py/k/M.cell));if(Lp.knock&&Lp.knock.sdf[gy*M.width+gx]>-Lp.knock.margin)continue;if(M.ins[gy*M.width+gx]){inI+=ink;inN++;for(let c=0;c<3;c++)inC[c]+=P[i+c];}else{outI+=ink;outN++;for(let c=0;c<3;c++)outC[c]+=P[i+c];}}
 const a=inI/inN,b=outI/outN,density=s.params.inside>=s.params.outside?a/Math.max(b,1e-3):b/Math.max(a,1e-3),colour=Math.hypot(...inC.map((v,c)=>v/inN-outC[c]/outN))/441;return {density,colour};};
const phone={},phoneWords={};
for(const f of FAMILIES){const regional=resolve({family:f.id}).outSet!=='same';if(f.set.mask!=='page')for(const stage of [3,4]){const r=contrast(resolve({family:f.id,stage}));phone[f.id+'-'+stage]=regional?{colour:+r.colour.toFixed(3)}:+r.density.toFixed(2);assert(regional?r.colour>=.08:r.density>=3,`${f.id} stage ${stage}: silhouette contrast ${JSON.stringify(r)}`);}
 for(const [name,text,cap] of [['type','TYPE/WITH/TYPE',15],['kanji','水',22]]){const r=contrast(resolve({family:f.id,mask:'text',text,...(name==='kanji'?{face:'heavy'}:{}),params:{size:Math.min(f.set.params.size,cap)}}));phoneWords[f.id+'-'+name]=regional?{colour:+r.colour.toFixed(3)}:+r.density.toFixed(2);
  assert(regional?r.colour>=.08:r.density>=5,`${f.id} with ${text} as the silhouette: ${JSON.stringify(r)}`);}}
report.phone={thresholds:{preset:3,word:5,regionalColour:.08},presets:phone,words:phoneWords};step('phone contrast');
// 11. Glyphs, texts and inputs.
let tokens=0;const composed={};for(const font of ['mincho','gothic','maru','script'])for(const set of SETS)for(const spec of levelsOf(resolve({family:'kanji',set:set.id,text:'MORI',font})).flat()){if(spec===' ')continue;const t=token(spec,font);assert(t.d.length>10&&t.w>0&&t.h>0&&t.area>0,`${font} ${spec}`);tokens++;if(t.composed)(composed[font]??=new Set()).add(spec);}
for(const ch of '吕沝众砳䡛鱻叒')assert(composed.mincho.has(ch)&&!composed.gothic?.has(ch),`${ch}: composed in mincho, drawn in gothic`);for(const p of PRIMITIVES)assert(token('@'+p,'gothic').d.length>10,p);
for(const f of FAMILIES){assert.equal(normalizeText(f.text),f.text,`${f.id} default text`);assert.equal(normalizeLevels(f.custom),f.custom,`${f.id} custom levels`);}
for(const text of ['森','RA/VE','TYPE/WITH/TYPE','あいう','牛犇','Ｗｉｄｅ'])for(const f of FAMILIES)for(const stage of [1,4]){const r=render({family:f.id,text,mask:'text',stage});assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${text} ${stage}`);assert(r.features.marks>8,`${f.id} ${text}: ${r.features.marks} marks`);}
for(const f of FAMILIES)assert(!/NaN|undefined|Infinity/.test(specimen({family:f.id})),`${f.id} specimen`);
assert.equal(normalizeLevels('木*3 → 林 → 森*.5'),'木*3 林 森*.5');for(const bad of ['木*0','木*99','@nope','a||b'])assert.throws(()=>normalizeLevels(bad),bad);
for(const bad of ['','§','A/B/C/D'])assert.throws(()=>normalizeText(bad),bad);assert.equal(resolve({text2:'§'}).text2,'MORI');
const r0=resolve({attract:[[2,-3,9],[.5,.5]],pins:Array.from({length:20},()=>[.5,.5]),strokes:[[.5,.5,9,-9]],image:{w:4,h:4,data:'AAAA'},colors:['#000000','#111111','#222222','#333333','#444444','#555555']});
assert.deepEqual(r0.attract,[[1.2,-.2,2]]);assert.equal(r0.pins.length,12);assert.deepEqual(r0.strokes,[[.5,.5,.3,-1]]);assert.equal(r0.image,null);assert.equal(r0.colors.length,8);assert.equal(resolve({engine:'compound-glyph-v1'}).engine,ENGINE);assert(ENGINES.includes('compound-glyph-v1'));
assert.deepEqual([...unb64(b64(Uint8Array.from([0,1,2,250,251,252,253])))],[0,1,2,250,251,252,253]);
for(const fm of FORMATS){globalThis.gc?.();const r=render({family:'electro',format:fm.id}),p=new Resvg(r.svg,{fitTo:fm.w>=fm.h?{mode:'width',value:3000}:{mode:'height',value:3000}}).render().asPng();assert.equal(Math.max(p.readUInt32BE(16),p.readUInt32BE(20)),3000);}
step('glyphs and inputs');
const t0=performance.now();for(let i=0;i<10;i++)render({family:'contour',params:{size:22+i*.1}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg (machine shared with other jobs; timings are indicative)',checks:{...report,
 visibleControlChecks:`${controlChecks} (${CONTROLS.length} controls × ${FAMILIES.length} styles, each active in its context, min vs max SVG differ; ${pixelControlChecks} also in pixels for ${PIXEL_STYLES.join(', ')})`,optionValues:`${optionChecks} SVG-distinct in four styles; ${pixelOptionChecks} v2 option values pixel-distinct`,
 passes:'four distinct passes per style; exact replay A/B/A and saved JSON; seed changes the field; every style in every format at its size',runningText:'rows, contours and flow lines read the text in order',tokens:`${tokens} set tokens in four mark faces; 吕沝众砳䡛鱻叒 composed from radicals where a face lacks them`,
 inputs:'custom weights, text2, clamped points, strokes and images, eight colours from six, base64 round trip, 3000 px exports in four formats',averageRenderMs:renderMs},
 limitations:'Checks verify construction, packing, ordering and readability proxies, not similarity to the source posters. Header and information lines use system fonts (titles use bundled outlines). The phone check measures mean ink contrast (or colour difference for layered styles), not recognisability.'},null,2));
console.log(`PASS: ${v1rules.length} v1 rules identical, ${FAMILIES.length} styles, ${controlChecks} controls (${pixelControlChecks} in pixels), ${optionChecks} option values (${pixelOptionChecks} in pixels), formats, ${marksChecked} marks packed, running text order, escalation, fields and layers, phone contrast ≥ ${Math.min(...Object.values(phone).filter(v=>typeof v==='number')).toFixed(1)} / words ≥ ${Math.min(...Object.values(phoneWords).filter(v=>typeof v==='number')).toFixed(1)}, ${tokens} tokens, inputs. Render ${renderMs} ms.`);
