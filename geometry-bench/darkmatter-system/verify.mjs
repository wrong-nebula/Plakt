import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {topology,area,offset,intersect} from '../punkt-capsule-system/geometry.mjs';
import {FAMILIES,TREATMENTS,treat,kern,LAYOUTS,FORMATS,CONTROLS,CHARACTERS,applies,render,resolve,normalizeText,layoutFrames,letterShapes,pageOf,glyphShape,breakRows} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/darkmatter-study-v2'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const raster=svg=>new Resvg(svg,{fitTo:{mode:'height',value:450}}).render().asPng(),seen=new Map(),pixels=state=>{const key=JSON.stringify(resolve(state));if(!seen.has(key))seen.set(key,hash(raster(render(state).svg)));return seen.get(key);},plain=['#ffffff','#000000','#ffffff'];
// Shape systems: distinct under one palette, in the source collage and in packed text.
for(const layout of ['source','packed'])assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,layout,text:layout==='source'?'HØRDE':'HEFT QUAD 2',stage:3,colors:plain}))).size,FAMILIES.length,layout);
// Every control changes the picture exactly where applies() says it does, and nowhere else.
// Every control in every system and layout; treatment controls also under each treatment
// (in two systems, since treatments act on finished letters whatever their edges).
const probes=[{layout:'source',text:'HØRDE'},{layout:'packed',text:'HEFT QUAD 2'},{layout:'rows',text:'HEFT QUAD 2',format:'square'}].flatMap(p=>FAMILIES.map(f=>[{...p,family:f.id},CONTROLS])).concat(TREATMENTS.filter(t=>t.id!=='solid').flatMap(t=>['wedges','soft'].map(family=>[{layout:'packed',text:'HEFT QUAD 2',treatment:t.id,family},CONTROLS.filter(c=>c.treatment)])));let active=0,inert=0;
// Identical SVG proves no change without rasterising; differing SVG is compared in pixels.
const svgs=new Map(),svgOf=state=>{const key=JSON.stringify(resolve(state));if(!svgs.has(key))svgs.set(key,render(state).svg);return svgs.get(key);},changes=(x,y)=>x!==y&&hash(raster(x))!==hash(raster(y));
for(const [probe,controls] of probes)for(const c of controls){const s={...probe,stage:4,colors:plain},on=applies(c.key,resolve(s)),moved=changes(svgOf({...s,params:{[c.key]:c.min}}),svgOf({...s,params:{[c.key]:c.max}}));
 if(on){assert(moved,`${probe.family}/${probe.layout}/${probe.treatment??'solid'}/${c.key} should change the poster`);active++;}else{assert(!moved,`${probe.family}/${probe.layout}/${probe.treatment??'solid'}/${c.key} is disabled but changes the poster`);inert++;}}
// Four distinct passes, exact replay through A/B/A and saved JSON.
for(const f of FAMILIES)for(const layout of ['source','packed']){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,layout,text:layout==='source'?'HØRDE':'DARK MATTER',stage}))).size,4);
 const s={text:'DARK/MATTER',layout,family:f.id,treatment:'hatched',invert:true,palette:'acid',params:{aperture:.85,roundness:.8,joint:3,bend:.18,terrace:9,stem:36,fill:.6,facets:3,swing:.12,soften:.4,pitch:18}},a=render(s);render({text:'CHANGE'});assert.equal(a.svg,render(s).svg);const saved=render(JSON.parse(JSON.stringify(a.state)));assert.equal(a.svg,saved.svg);assert.equal(hash(raster(a.svg)),hash(raster(saved.svg)));}
// Saved v1 rules open: their word, family, colours and shared controls carry over.
let migrated=0;for(const file of fs.readdirSync(path.join(root,'output/darkmatter-study-v1')).filter(f=>/^(wedges|scooped|stepped|stage).*\.json$/.test(f))){const v1=JSON.parse(fs.readFileSync(path.join(root,'output/darkmatter-study-v1',file))),s=resolve(v1);
 assert.equal(s.engine,'darkmatter-v2');assert.equal(s.text,v1.word);assert.equal(s.family,v1.family);assert.deepEqual(s.colors,v1.colors);for(const k of ['aperture','roundness','joint','bend'])assert.equal(s.params[k],v1.params[k]);assert.equal(s.layout,['HØRDE','HORDE'].includes(v1.word)?'source':'packed');assert(!/NaN|undefined/.test(render(v1).svg));migrated++;}
assert(migrated>=10);
// Every character: a glyph inside its frame, counters removed, no specks below the crumb size.
const glyphs={};for(const f of FAMILIES)for(const ch of CHARACTERS){const fr={x:20,y:20,w:240,h:300},params=resolve({family:f.id}).params,solid=glyphShape(ch,fr,params,f.id,2),cut=glyphShape(ch,fr,params,f.id,3),t=topology(cut),a=cut.reduce((s,p)=>s+area(p),0),b=solid.reduce((s,p)=>s+area(p),0);
 assert(t.outlines>=1,ch);assert(t.smallestOutline>=Math.max(3*36,f.id==='stepped'?1.5*13*13:0),`${f.id} ${ch} leaves a crumb`);assert(a<=b+1,ch);
 for(const p of cut)for(const q of p){assert(q.X/100>=fr.x-.5&&q.X/100<=fr.x+fr.w+.5&&q.Y/100>=fr.y-.5&&q.Y/100<=fr.y+fr.h+.5,`${f.id} ${ch} leaves its frame`);}
 if(f.id==='wedges')glyphs[ch]={outlines:t.outlines,holes:t.holes,inkShare:+(a/(fr.w*fr.h)).toFixed(3)};}
// Settings: frames stay inside the page; packed rows run margin to margin with one joint between letters.
const texts=['HØRDE','FUBU','DARK MATTER','THE UNSEEN SIDE OF LIGHT','HELSINKI/2026','BLÅ BÆR/GRÜN','A','ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789','ÆØÅÄÖÜ.-+!'];let settings=0;
for(const text of texts)for(const layout of ['packed','rows'])for(const fm of FORMATS){const s=resolve({text,layout,format:fm.id}),page=pageOf(s),frames=layoutFrames(s,page),m=page.margin;
 assert.equal(frames.map(f=>f.ch).join(''),text.replace(/[ /]/g,''));
 for(const f of frames){assert(f.x>=m-1e-6&&f.y>=m-1e-6&&f.x+f.w<=page.width-m+1e-6&&f.y+f.h<=page.height-m-page.band+1e-6,`${text} ${layout} ${fm.id} frame outside page`);}
 for(const row of new Set(frames.map(f=>f.row))){const r=frames.filter(f=>f.row===row);for(let i=1;i<r.length;i++)assert(r[i].x>=r[i-1].x+r[i-1].w-1e-6,'letters overlap');
  if(layout==='packed'){assert(Math.abs(r[0].x-m)<1e-6||text.includes(' '));assert(Math.abs(r.at(-1).x+r.at(-1).w-(page.width-m))<1e-6);}}
 settings++;}
assert.deepEqual(breakRows('HØRDE',668/1022),['HØ','RDE']);assert.deepEqual(breakRows('DARK MATTER',668/1022),['DARK','MAT','TER']);assert.deepEqual(breakRows('HELSINKI/2026',1),['HELSINKI','2026']);
// Plain filled paths: no masks, clips or strokes once counters are cut.
for(const layout of ['source','packed','rows'])for(const stage of [3,4]){const svg=render({layout,text:layout==='source'?'HØRDE':'DARK MATTER',stage}).svg;assert(!/clipPath|<mask|stroke=|url\(#/.test(svg),layout+' stage '+stage);}
// Source junctions (pixels): the touching H/Ø masses are solid across their shared edge, the H counter
// ends cleanly, and the H edge has one clean gap.
for(const f of FAMILIES){const image=new Resvg(render({family:f.id,stage:3,colors:plain}).svg).render(),rgba=image.pixels,red=(x,y)=>rgba[(y*700+x)*4];for(const y of [80,160])for(const x of [273,274,275])assert.equal(red(x,y),0,'No raster crack at H/Ø seam');for(let y=264;y<=270;y++)assert.equal(red(190,y),0,'No nub past the H counter');assert.equal(red(180,250),255,'H counter must remain open');let runs=0,inside=false;for(let y=435;y<=460;y++){const white=red(21,y)>200;if(white&&!inside)runs++;inside=white;}assert.equal(runs,1,'H edge must contain one clean gap');}
// Packed joints are real gaps: sample the ground colour between the first two letters of each row.
{const r=render({text:'DARK MATTER',layout:'packed',stage:3,colors:plain,params:{interlock:0}}),img=new Resvg(r.svg).render(),red=(x,y)=>img.pixels[(Math.round(y)*700+Math.round(x))*4];for(const row of [0,1,2]){const [a]=r.frames.filter(f=>f.row===row);assert.equal(red(a.x+a.w+3,a.y+a.h*.5),255,'joint between letters');}}
// Interlock: neighbours step into each other but never touch — every pair keeps the joint
// width between them — and some steps happen in each system.
let jogs=0,pairs=0;for(const f of FAMILIES)for(const text of ['HØRDE','DARK MATTER','BLÅ BÆR/GRÜN','THE UNSEEN SIDE OF LIGHT','HEFT QUAD 2']){
 const s=resolve({text,layout:'packed',family:f.id,stage:4,params:{interlock:1}}),frames=layoutFrames(s),shapes=letterShapes(s,frames),flat=letterShapes({...s,params:{...s.params,interlock:0}},frames),page=pageOf(s);
 frames.forEach((fr,i)=>{for(const p of shapes[i])for(const q of p)assert(q.X/100>=page.margin-.5&&q.X/100<=page.width-page.margin+.5,'interlock leaves the page');if(JSON.stringify(shapes[i])!==JSON.stringify(flat[i]))jogs++;});
 for(let i=0;i+1<frames.length;i++){if(frames[i].row!==frames[i+1].row)continue;const j=s.params.joint*Math.max(.08,Math.min(1,frames[i].h/200)),touch=intersect(offset(shapes[i],j/2-.3),offset(shapes[i+1],j/2-.3));assert.equal(touch.length,0,`${f.id} ${text}: letters ${i} and ${i+1} touch`);pairs++;}
}
assert(jogs>=20,'interlock steps happen');
// Treatments: each changes the poster in every layout; inline, outline and hatching only take
// ink away; slices stay inside the page; the shadow is the only second tone, drawn behind.
const treated={};for(const t of TREATMENTS){treated[t.id]={};for(const layout of ['source','packed','rows']){const st={text:layout==='source'?'HØRDE':'DARK MATTER',layout,treatment:t.id,colors:plain},svg=render(st).svg;
 if(t.id!=='solid')assert.notEqual(hash(raster(svg)),hash(raster(render({...st,treatment:'solid'}).svg)),`${t.id} ${layout} changes nothing`);assert(!/clipPath|<mask|stroke=|NaN/.test(svg));
 const fills=new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(m=>m[1]));assert.equal(fills.has('#808080'),t.id==='shadow',`${t.id} ${layout} shadow tone`);treated[t.id][layout]=svg.length;}}
for(const f of FAMILIES)for(const t of ['inline','outline','hatched']){const s=resolve({text:'DARK MATTER',layout:'packed',family:f.id,treatment:t}),page=pageOf(s),frames=layoutFrames(s,page),shapes=letterShapes(s,frames);
 frames.forEach((fr,i)=>{const out=treat(shapes[i],s,fr,page).shape,a=out.reduce((v,p)=>v+area(p),0),b=shapes[i].reduce((v,p)=>v+area(p),0);assert(a<=b+1&&a>0,`${f.id} ${t} ${fr.ch}`);});}
{const s=resolve({text:'DARK MATTER',layout:'packed',treatment:'sliced',params:{shift:60}}),page=pageOf(s),frames=layoutFrames(s,page);letterShapes(s,frames).forEach((sh,i)=>{for(const p of treat(sh,s,frames[i],page).shape)for(const q of p)assert(q.X/100>=page.margin-.5&&q.X/100<=page.width-page.margin+.5,'slices stay on the page');});}
// Optical spacing in even rows: stems keep the letter spacing, open pairs close up, and
// kerned neighbours never touch.
{const p=resolve({}).params;assert.equal(kern('H','H',p),0);assert.equal(kern('H','E',p),0);for(const pair of ['LT','TA','AV','Y.'])assert(kern(pair[0],pair[1],p)<-.1,pair+' closes up');
 for(const text of ['LATTE AVAILABLE/TYPOGRAPHY','AVATAR LY. 7A/FAT TYPE']){const s=resolve({text,layout:'rows',format:'landscape',stage:3}),frames=layoutFrames(s),shapes=letterShapes(s,frames);for(let i=0;i+1<frames.length;i++)if(frames[i].row===frames[i+1].row)assert.equal(intersect(shapes[i],shapes[i+1]).length,0,`${text}: ${frames[i].ch}${frames[i+1].ch} collide`);}}
// Input bounds.
assert.equal(normalizeText('Hørde'),'HØRDE');assert.equal(normalizeText('Æsir / Straße'),'ÆSIR/STRASSE');assert.equal(normalizeText('blå bær, grüße'.replace(',','')),'BLÅ BÆR GRÜSSE');assert.equal(normalizeText('Été'),'ETE');assert.equal(normalizeText('  dark   matter '),'DARK MATTER');
for(const bad of ['','/','🌷','<script>','A'.repeat(37),'A/B/C/D/E/F'])assert.throws(()=>normalizeText(bad),bad);
assert.equal(resolve({params:{joint:-1,terrace:100,roundness:Infinity}}).params.joint,1);assert.equal(resolve({params:{terrace:100}}).params.terrace,30);assert.equal(resolve({params:{roundness:Infinity}}).params.roundness,1);
assert.equal(resolve({layout:'nope',format:'nope',palette:'nope'}).layout,'source');assert.equal(render({text:'FUBU',layout:'source'}).features.layout,'packed');
// Export sizes: 3000 px on the long edge in every format.
const exportSizes={};for(const fm of FORMATS){const svg=render({text:'DARK MATTER',layout:'packed',format:fm.id}).svg,r=new Resvg(svg),png=new Resvg(svg,{fitTo:r.width>=r.height?{mode:'width',value:3000}:{mode:'height',value:3000}}).render().asPng();exportSizes[fm.id]=[png.readUInt32BE(16),png.readUInt32BE(20)];assert.equal(Math.max(...exportSizes[fm.id]),3000);}
assert.deepEqual(exportSizes.poster,[1909,3000]);
const t0=performance.now();render({text:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',layout:'packed',family:'stepped',treatment:'shadow'});const slowest=Math.round(performance.now()-t0);assert(slowest<2500,'36 terraced, shadowed letters render in under 2.5 s');
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteShapeSystems:`${FAMILIES.length} distinct in the source collage and in packed text`,treatments:`${TREATMENTS.length - 1} treatments each change the poster in all three layouts; inline, outline and hatching only remove ink in all ${FAMILIES.length} systems; slices stay on the page; only the shadow adds a second tone`,controls:{changesWhereApplicable:active,inertWhereDisabled:inert},distinctPassesPerFamilyAndLayout:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',v1RulesMigrated:migrated,characters:CHARACTERS.length,glyphChecks:'inside frame, counters only remove ink, no outline below 3 joint² (terraced: 1.5 module²) in all three systems',settings:`${settings} text × layout × format combinations: frames inside the page, no overlaps, packed rows margin to margin`,plainPaths:'no clipPath, mask, stroke or url() references at stages 3–4',junctions:'source H/Ø seam, H counter end and single clean H gap; packed joints are ground-coloured gaps',interlock:`${pairs} neighbouring pairs keep the joint between them at full interlock; ${jogs} letters step`,spacing:'even rows: stem pairs keep the letter spacing, L|T, T|A, A|V and Y|. close up, kerned neighbours never touch',inputBounds:'invalid text, line and numeric bounds',exports:exportSizes,slowestRenderMs:slowest},glyphs,limitations:'Engine and replay checks do not measure accuracy against the original font or production files, or legibility.'},null,2));
console.log(`PASS: ${FAMILIES.length} systems, ${TREATMENTS.length} treatments, ${active} active / ${inert} inert control checks, 4 stages × 2 layouts, ${migrated} v1 rules, ${CHARACTERS.length} characters, ${settings} settings, junctions, replay and exports.`);
