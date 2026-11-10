import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,LAYOUTS,PATTERNS,PATTERN_IDS,LETTER_SOURCES,CHARACTERS,W,H,render,resolve,specimen,kit,tile,placeText,normalizeWord,glyphShape,patternSVG,patternPeriod,controlActive} from './engine.mjs';
// resvg's native buffers are freed only by garbage collection: run with --expose-gc and collect every 25 rasters.
let rasters=0;const Resvg_=Resvg,rv=(svg,opts)=>{if(++rasters%25===0)globalThis.gc?.();return new Resvg_(svg,opts);};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/wagara-study-v1');
const FONT={loadSystemFonts:false,fontFiles:['/System/Library/Fonts/HelveticaNeue.ttc','/System/Library/Fonts/Supplemental/Georgia.ttf','/System/Library/Fonts/Supplemental/Georgia Italic.ttf'].filter(f=>fs.existsSync(f)),defaultFontFamily:'Helvetica Neue'};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const raster=(svg,h=300)=>rv(svg,{font:FONT,fitTo:{mode:'height',value:h}}).render();
const pixels=s=>hash(raster(render(s).svg).pixels);
const commonColors=['#202630','#e9e4da','#c5402f','#111111','#e0b62e','#2f8f5a','#e9e4da'],commonWindows=[['#e9e4da','#202630'],['#c5402f','#e9e4da'],['#2f8f5a','#e0b62e'],['#e0b62e','#202630'],['#e9e4da','#c5402f'],['#202630','#e0b62e']];

// Nine styles stay distinct under one palette: they differ in construction, not only colour.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:commonColors,windows:commonWindows}))).size,FAMILIES.length);
// Every control changes the poster wherever it is active, and leaves it unchanged where it is not.
const CONTEXT={leading:{layout:'stack'},keyline:{edge:'keyline'},depth:{shadow:'drop'},angle:{shadow:'drop'},groundScale:{groundPattern:'seigaiha'},bands:{layout:'field'}},INERT={leading:{layout:'bands'},keyline:{edge:'none',shadow:'none'},depth:{shadow:'none'},angle:{shadow:'glow'},groundScale:{groundPattern:'none',layout:'stack'},bands:{layout:'stack'}};
let controlChecks=0,inertChecks=0,optionChecks=0;
for(const f of FAMILIES){const base=resolve({family:f.id});
 for(const c of CONTROLS){const ctx={family:f.id,...(controlActive(c.key,base)?{}:CONTEXT[c.key])};assert(controlActive(c.key,resolve(ctx)),`${f.id} ${c.key} context`);
  assert(new Set([c.min,c.max,(c.min+c.max)/2].map(v=>pixels({...ctx,params:{[c.key]:v}}))).size>1,`${f.id} ${c.key}`);controlChecks++;
  if(INERT[c.key]){const off={family:f.id,...INERT[c.key]};assert(!controlActive(c.key,resolve(off)));assert.equal(pixels({...off,params:{[c.key]:c.min}}),pixels({...off,params:{[c.key]:c.max}}),`${f.id} ${c.key} inert`);inertChecks++;}}
 for(const k of ['letters','layout','assign','anchor','inking','edge','shadow']){assert.equal(new Set(OPTIONS[k].map(v=>pixels({family:f.id,[k]:v}))).size,OPTIONS[k].length,`${f.id} ${k}`);optionChecks+=OPTIONS[k].length;}}
for(const family of ['tanaka','neon','aizome']){assert.equal(new Set(OPTIONS.pattern.map(v=>pixels({family,assign:'single',pattern:v}))).size,OPTIONS.pattern.length,`${family} pattern`);
 assert.equal(new Set(OPTIONS.groundPattern.map(v=>pixels({family,groundPattern:v}))).size,OPTIONS.groundPattern.length,`${family} groundPattern`);optionChecks+=OPTIONS.pattern.length+OPTIONS.groundPattern.length;
 const s=resolve({family});for(let i=0;i<6;i++){const seq=[...s.sequence];seq[i]=seq[i]==='ume'?'kanoko':'ume';assert.notEqual(pixels({family,text:'ABCDEF',sequence:seq}),pixels({family,text:'ABCDEF'}),`${family} slot ${i}`);}}
// Four passes, exact replay and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'TYPE/SYSTEM',params:{weight:.07,width:1.2,gutter:.15,scale:30,rotate:20,stroke:1.4,detail:3,rotateStep:9,keyline:3,depth:9,angle:120,groundScale:50,bands:4},edge:'double',shadow:'block',anchor:'field'},a=render(s);render({family:'neon',text:'NOH',params:{weight:.15}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg).pixels),hash(raster(render(a.state).svg).pixels));}

// Patterns tile: shifting the lattice anchor by either period vector (also turned 30°) reproduces the same pixels.
const inks={paper:'#1f2d66',ink:'#f1ece0',accent:'#e3402f',cycle:['#f1ece0','#f2b632','#e86aa6']},S=200;
const swatch=(id,P,anchor,deg=0)=>rv(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${inks.paper}"/>${patternSVG(id,P,[0,0,S,S],anchor,deg,inks).svg}</svg>`,{font:FONT}).render().pixels;
// big: share of channels off by > 40/255 (tile cut lines); gross: > 96/255, beyond anti-aliasing (a misregistered period shows mean differences of 5–20).
const diff=(a,b)=>{let max=0,sum=0,big=0,gross=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d>max)max=d;sum+=d;if(d>40)big++;if(d>96)gross++;}return {max,mean:sum/a.length,big:big/a.length,gross:gross/a.length};};
const periodicity=[],tiles=[];let patternControlChecks=0;
for(const p of PATTERNS){const P={s:44,sw:1.1,d:Math.min(3,p.detail[1])},per=patternPeriod(p.id,P),A=[S/2+.37,S/2-.21];let worst={max:0,mean:0};
 for(const deg of [0,30]){const r=deg*Math.PI/180,R=([x,y])=>[x*Math.cos(r)-y*Math.sin(r),x*Math.sin(r)+y*Math.cos(r)],ref=swatch(p.id,P,A,deg);
  for(const v of [per.a,per.b,per.rect.map((x,i)=>i?0:x),[0,per.rect[1]]]){const [dx,dy]=R(v),d=diff(ref,swatch(p.id,P,[A[0]+dx,A[1]+dy],deg));if(d.max>worst.max)worst.max=d.max;if(d.mean>worst.mean)worst.mean=d.mean;assert(d.mean<.25&&d.gross<.0005,`${p.id} not periodic by ${v} at ${deg}°: ${JSON.stringify(d)}`);}}
 periodicity.push({pattern:p.id,maxChannelDiff:worst.max,meanChannelDiff:+worst.mean.toFixed(4)});
 // The exported tile, repeated, matches the field it was cut from (up to anti-aliasing along the cut lines).
 const t=tile(p.id,P,inks),reps=[];for(let i=0;i*t.width<S;i++)for(let j=0;j*t.height<S;j++)reps.push(t.svg.replace('<svg ',`<svg x="${(i*t.width).toFixed(4)}" y="${(j*t.height).toFixed(4)}" `));
 const comp=rv(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${reps.join('')}</svg>`,{font:FONT}).render().pixels,d=diff(comp,swatch(p.id,P,[0,0]));assert(d.mean<3&&d.big<.03,`${p.id} tile: ${JSON.stringify(d)}`);tiles.push({pattern:p.id,tile:[+t.width.toFixed(2),+t.height.toFixed(2)],meanChannelDiff:+d.mean.toFixed(3)});
 // Scale, rotation, line weight and detail each change the pattern (solid ink has none of them).
 if(p.id!=='sumi'){const base=swatch(p.id,P,A);for(const [k,v] of [['s',70],['sw',2.4],['d',p.detail[0]]]){if(k==='d'&&p.detail[0]===P.d)continue;assert.notEqual(hash(swatch(p.id,{...P,[k]:v},A)),hash(base),`${p.id} ${k}`);patternControlChecks++;}assert.notEqual(hash(swatch(p.id,P,A,37)),hash(base),`${p.id} rotate`);patternControlChecks++;}}

// Every glyph of every letter source builds a closed outline, at both weight extremes and both width extremes.
for(const s of LETTER_SOURCES)for(const ch of CHARACTERS)for(const [w,k] of [[.6,-.03],[1.5,.16],[1,0]]){const g=glyphShape(s.id,ch,w,k);assert(g.polys.length>0,`${s.id} ${ch} ${w} ${k}`);for(const p of g.polys)for(const [x,y] of p)assert(Number.isFinite(x)&&Number.isFinite(y));}
const texts=['ABCDEFGH/IJKLMNOP/QRSTUVWX','YZ012345/6789.,:-/!?\'A','NIP/PON','TAKE/O','NEO/EDO','KYOTO','2026','HELLO!','I','W','M M M','A/B/C','TYPE/SYSTEM'];
for(const text of texts)for(const f of FAMILIES)for(const stage of [1,2,3,4]){const r=render({family:f.id,text,stage});assert.equal(r.state.text,text);assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${text} ${stage}`);}
for(const f of FAMILIES)for(const l of LAYOUTS)for(const s of LETTER_SOURCES)assert(!/NaN|undefined|Infinity/.test(render({family:f.id,layout:l.id,letters:s.id,text:'WA/GARA'}).svg),`${f.id} ${l.id} ${s.id}`);
// Letters stay inside the sheet in every layout.
let marginChecks=0;for(const text of texts)for(const f of FAMILIES)for(const l of LAYOUTS){const pl=placeText(resolve({family:f.id,layout:l.id,text}));for(const g of pl)for(const p of g.polys)for(const [x,y] of p)assert(x>=14&&x<=W-14&&y>=14&&y<=H-14,`${f.id} ${l.id} ${text} out of bounds`);marginChecks++;}

// Legibility at every pattern scale, from the smallest pattern to the largest, against the same
// poster with the letters removed. Each silhouette must be closed: either the inner rim of every
// letter (a 7px band inside its outline) or its drawn keyline (measured on the keyline stroke
// itself) differs from what lies behind it almost everywhere. Letter bodies must differ on average.
const outline=state=>placeText(state).map(g=>g.polys.map(p=>'M'+p.map(q=>q.join(' ')).join('L')+'Z').join('')).join('');
const maskOf=(state,stroke)=>raster(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/><path d="${outline(state)}" fill="${stroke?'none':'#fff'}"${stroke?` stroke="#fff" stroke-width="${stroke}"`:''} fill-rule="evenodd"/></svg>`,800).pixels;
// Pixels the layout covers on purpose with front elements (the bamboo bars) are left out and reported.
const legibility=[];
for(const f of FAMILIES)for(const scale of [10,f.set.params.scale,160]){const s=resolve({family:f.id,params:{scale}}),keyed=s.edge==='keyline'||s.edge==='double',m=maskOf(s),e=maskOf(s,14),kl=keyed?maskOf(s,s.params.keyline):null,a=raster(render(s).svg,800).pixels,b=raster(render(s,{hideLetters:true}).svg,800).pixels,c=raster(render(s,{hideLetters:true,hideFront:true}).svg,800).pixels;
 const body=[0,0,0],rim=[0,0],key=[0,0],cover=[0,0],dAt=i=>(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3,front=i=>Math.abs(b[i]-c[i])+Math.abs(b[i+1]-c[i+1])+Math.abs(b[i+2]-c[i+2])>8;
 for(let i=0;i<m.length;i+=4){if(m[i]>=250){cover[0]++;if(front(i))cover[1]++;}if(front(i))continue;if(kl&&kl[i]>=250){key[0]++;if(dAt(i)>30)key[1]++;}if(m[i]<250)continue;const d=dAt(i);body[0]++;body[1]+=d;if(d>30)body[2]++;if(e[i]>=250){rim[0]++;if(d>30)rim[1]++;}}
 const row={family:f.id,scale,edge:s.edge,coveredByFront:+(cover[1]/cover[0]).toFixed(3),rimChanged:+(rim[1]/rim[0]).toFixed(3),keylineChanged:keyed?+(key[1]/key[0]).toFixed(3):null,bodyChanged:+(body[2]/body[0]).toFixed(3),bodyMeanDiff:+(body[1]/body[0]).toFixed(1)};row.closed=Math.max(row.rimChanged,row.keylineChanged??0);legibility.push(row);
 assert(row.closed>=.85&&row.bodyMeanDiff>=35,`${f.id} scale ${scale} illegible: ${JSON.stringify(row)}`);}

// Sheets: every glyph in the specimen, every pattern in the kit.
for(const f of FAMILIES){assert.equal((specimen({family:f.id}).match(/data-glyph=/g)||[]).length,CHARACTERS.length);assert.equal((kit({family:f.id}).match(/data-pattern=/g)||[]).length,PATTERNS.length);}
// Input handling.
assert.equal(normalizeWord('kyōto'),'KYOTO');assert.equal(normalizeWord('nip / pon'),'NIP/PON');assert.equal(normalizeWord('it’s—ok'),"IT'S-OK");assert.equal(normalizeWord('  a   b '),'A B');
for(const bad of ['','#1','A&B','🌷','<b>','A/B/C/D','A//B','ABCDEFGHIJKLMNOPQRSTUVWXY'])assert.throws(()=>normalizeWord(bad),bad);
assert.equal(resolve({text:'@@'}).text,'NIP/PON');assert.equal(resolve({params:{scale:Infinity}}).params.scale,FAMILIES[0].set.params.scale);assert.equal(resolve({params:{scale:999}}).params.scale,160);assert.equal(resolve({params:{detail:2.6}}).params.detail,3);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.deepEqual(resolve({windows:[['#fff','#000']]}).windows,FAMILIES[0].windows);assert.deepEqual(resolve({sequence:['bogus']}).sequence,FAMILIES[0].set.sequence);
assert.equal(resolve({layout:'bogus',family:'kamekura'}).layout,'bands');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({title:'<script>'}).title,'script');assert.equal(resolve({engine:'other',family:'neon'}).engine,ENGINE);
const full=rv(render().svg,{font:FONT,fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'tanaka',text:'TYPE/SYSTEM',params:{scale:40+i}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
const minLegible=legibility.reduce((m,r)=>r.closed<m.closed?r:m);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{
 commonPaletteStyles:FAMILIES.length,visibleControlChecks:`${controlChecks} (each control changes the poster where active, across ${FAMILIES.length} styles)`,inertControlChecks:`${inertChecks} (row gap, keyline, shadow depth and angle, ground scale and bands leave the poster unchanged where inactive)`,
 visibleOptionValues:`${optionChecks} (letters, layout, assign, anchor, inking, edge and shadow in every style; all 18 patterns and 19 ground patterns in three styles; each of six sequence slots)`,distinctPassesPerStyle:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',
 patternPeriodicity:`${PATTERNS.length} patterns repeat by both period vectors and their rectangular tile, at 0° and 30° (mean channel diff < .25; under .05% of channels off by more than anti-aliasing, 96/255)`,periodicity,tileExports:tiles,patternControls:`${patternControlChecks} scale / line / detail / rotation changes visible`,
 glyphs:`${CHARACTERS.length} glyphs × ${LETTER_SOURCES.length} sources × 3 width/weight extremes`,textProbes:`${texts.length} texts × ${FAMILIES.length} styles × 4 passes; ${FAMILIES.length} styles × ${LAYOUTS.length} layouts × ${LETTER_SOURCES.length} sources; no NaN`,margins:`${marginChecks} text/style/layout placements inside 14px margins`,
 legibility:{rule:'against the same poster without letters, at pattern scales 10, default and 160: ≥ 85% of either the 7px inner rim of the letters or their drawn keyline changes by > 30/255 (closed silhouettes), and the letter bodies change by ≥ 35/255 on average; pixels covered on purpose by front elements (bamboo bars) are excluded and reported as coveredByFront',weakest:minLegible,rows:legibility},
 sheets:`${CHARACTERS.length}-glyph specimen and ${PATTERNS.length}-pattern kit for every style`,invalidInputs:'empty, unsupported characters, markup, four rows, empty rows, 25 characters; parameter, colour, window, sequence, option and stage bounds',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},
 limitations:'Checks verify construction, tiling and contrast, not likeness to the source posters. Legibility is measured as contrast between letters and what lies behind them, not as reading by people. Header and information text use system fonts, so their glyphs vary between machines.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible / ${inertChecks} inert controls, ${optionChecks} option values, 4 stages, replay, ${PATTERNS.length} periodic patterns and tiles, ${patternControlChecks} pattern controls, glyphs, margins, legibility (weakest silhouette ${minLegible.family} @ ${minLegible.scale}: ${minLegible.closed}), sheets, inputs, ${Math.round(W*3000/H)} × 3000 export. Render ${renderMs} ms.`);
