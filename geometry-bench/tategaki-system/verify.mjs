import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import * as fontkit from 'fontkit';
import {ENGINE,FAMILIES,CONTROLS,OPTIONS,PRESETS,CHARS,FACES,W,H,MIRROR,render,resolve,compose,units,unitColours,specimen,normalizeColumns,parseHeader,parseLatin,verticalForms} from './engine.mjs';
import {glyph,bounds,decode} from './glyphs.mjs';
import {DATA} from './fonts.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),out=path.join(root,'output/tategaki-study-v1');
const prov=JSON.parse(fs.readFileSync(path.join(here,'font-provenance.json')));
// resvg's native buffers are freed only by GC: run with node --expose-gc.
let rasters=0;const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),raster=(s,h=300)=>{if(++rasters%25===0)globalThis.gc?.();return new Resvg(s,{fitTo:{mode:'height',value:h}}).render().asPng();},pixels=s=>hash(raster(render(s).svg));
const common=['#efeae0','#1d1d1f','#c8402e','#2f8f5a','#2f5fc8','#d9a21c','#8a3fb8','#e0567a'];
const CT=PRESETS.find(p=>p.id==='transfer').text,HEAD='東洋唯一の地下鐵道/上野浅草間開通',LAT='TATEGAKI COLOUR COLUMNS';

// ── Styles, controls and options ──────────────────────────────────────
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'styles distinct under one palette');
// Each control is tried where it applies, on copy that has titles, notes, ruby, groups, kana and Latin.
const CONTEXT={gap:{layout:'start'},groupGap:{layout:'start'},rhythm:{layout:'start'},drift:{align:'cascade'},ruby:{ruby:'on'},header:{header:HEAD},band:{latinBand:'end',latin:LAT}};
let controlChecks=0,optionChecks=0;
for(const f of FAMILIES){for(const c of CONTROLS){const ctx={family:f.id,text:CT,...CONTEXT[c.key],...(c.key==='effect'&&f.set.fill==='solid'?{fill:'outline'}:{})};
  assert.notEqual(pixels({...ctx,params:{[c.key]:c.min}}),pixels({...ctx,params:{[c.key]:c.max}}),`${f.id} ${c.key}`);controlChecks++;}
 for(const [k,values] of Object.entries(OPTIONS)){const ctx={family:f.id,text:CT,params:{scale:.62},layout:k==='layout'?undefined:'start',colors:common,...(k==='latinBand'?{latin:LAT}:{}),...(k==='ground'?{params:{scale:.5}}:{})};
  assert.equal(new Set(values.map(v=>pixels({...ctx,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}}
// Four passes, exact replay, and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:CT,header:HEAD,latin:LAT,latinBand:'title',params:{jitter:.4,stagger:1,rhythm:.3,step:.95}},a=render(s);render({family:'neon',text:'東京',params:{scale:.4}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}

// ── Outlines: decoded paths equal the font's own outlines (rounded to units) ──
const ORDER=[...CHARS.kanji+CHARS.kana+CHARS.punct+CHARS.latin];let outlineChecks=0;
for(const [face,p] of Object.entries(prov.faces)){const font=fontkit.openSync(p.path,p.postscriptName),sample=ORDER.filter((_,i)=>i%23===0).concat([...'観鐵ゃー「。A']);
 for(const ch of sample){const mine=glyph(face,ch,'h').cmds.flat(),theirs=font.glyphForCodePoint(ch.codePointAt(0)).path.commands.flatMap(c=>[{moveTo:'M',lineTo:'L',bezierCurveTo:'C',quadraticCurveTo:'Q',closePath:'Z'}[c.command],...c.args.map(v=>Math.round(v)+0)]);
  assert.deepEqual(mine,theirs,`${face} ${ch}`);outlineChecks++;}
 for(const ch of verticalForms(face)){assert.deepEqual(glyph(face,ch,'v').cmds.flat(),font.layout(ch,['vert']).glyphs[0].path.commands.flatMap(c=>[{moveTo:'M',lineTo:'L',bezierCurveTo:'C',quadraticCurveTo:'Q',closePath:'Z'}[c.command],...c.args.map(v=>Math.round(v)+0)]),`${face} vert ${ch}`);outlineChecks++;}}

// ── Vertical forms: placement and turn of every substituted character, every face ──
const STOPS='、。，．',SMALL='ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ',TURNED='ー―〜…‥（）〔〕［］｛｝〈〉「」『』【】';let formChecks=0;
const box=(face,ch,form)=>bounds(glyph(face,ch,form).cmds,[1/1000,0,0,-1/1000,0,.88]);  // cell units, y down from the cell top
for(const face of Object.keys(FACES)){const vf=verticalForms(face);for(const ch of [...STOPS,...'ぁぃぅぇぉっゃゅょァィゥェォッャュョー〜…「」（）'])assert(vf.includes(ch),`${face} lacks a vertical form for ${ch}`);
 for(const ch of vf){const h=box(face,ch,'h'),v=box(face,ch,'v'),cx=b=>(b[0]+b[2])/2,cy=b=>(b[1]+b[3])/2,asp=b=>(b[2]-b[0])/(b[3]-b[1]);
  assert.notDeepEqual(glyph(face,ch,'h').cmds,glyph(face,ch,'v').cmds,`${face} ${ch} unchanged`);
  if(STOPS.includes(ch))assert(cx(v)>.6&&cy(v)<.4,`${face} ${ch} should sit upper right in a column`);
  if(SMALL.includes(ch))assert(cx(v)>cx(h)+.05&&cy(v)<cy(h)-.05,`${face} small ${ch} should move up and right`);
  if(TURNED.includes(ch))assert((asp(h)-1)*(asp(v)-1)<0,`${face} ${ch} should turn`);formChecks++;}}
// The renderer uses them: every substitutable character in a column comes out in its vertical form; rows mirror instead.
for(const face of Object.keys(FACES)){const text='「ちょっと」ーも、/（日）〜…。ぁァ';const r=render({family:'noh',face,text});const want=[...text.replace('/','')].filter(c=>verticalForms(face).includes(c)).length;assert.equal(r.features.verticalForms,want,face);
 const rows=units(compose({family:'noh',face,text,direction:'rtl'}));assert(rows.every(u=>!u.alt||u.flip));assert.equal(rows.filter(u=>u.flip).length,[...text].filter(c=>MIRROR.includes(c)).length);}

// ── Sideways Latin, tate-chū-yoko, upright digits ─────────────────────
const itemsOf=(state,line=0)=>compose(state).lines[line].items;
{const U=units(compose({family:'noh',text:'Type'})),r=U.filter(u=>u.run);assert.equal(r.length,4);for(const u of r){assert(u.mat[0]===0&&u.mat[3]===0&&u.mat[1]>0&&u.mat[2]>0,'sideways Latin: font x runs down, letter tops face right');}
 const ys=r.map(u=>u.mat[5]);assert(ys.every((y,i)=>!i||y>ys[i-1]),'Latin reads downward');
 const h=units(compose({family:'noh',text:'Type',direction:'rtl'})).filter(u=>u.run);assert(h.every(u=>u.mat[0]>0&&u.mat[3]<0),'rows keep Latin upright');}
assert.deepEqual(itemsOf({family:'noh',text:'第35回',numerals:'tcy'}).map(i=>i.t),['c','y','c']);
assert.deepEqual(itemsOf({family:'noh',text:'第35回',numerals:'upright'}).map(i=>i.t),['c','u','u','c']);
assert.deepEqual(itemsOf({family:'noh',text:'第35回',numerals:'sideways'}).map(i=>i.t),['c','r','c']);
assert.deepEqual(itemsOf({family:'noh',text:'2026年5月',numerals:'tcy'}).map(i=>i.t),['r','c','u','c']);
{const t=units(compose({family:'noh',text:'第35回',numerals:'tcy'})).filter(u=>u.tcy);assert.equal(t.length,2);const [a,b]=t.map(u=>bounds(u.gl.cmds,u.mat));assert(a[2]<=b[0]+.5&&a[1]<b[3]&&b[1]<a[3],'two digits side by side in one cell');assert(b[2]-a[0]<=t[0].box[2]-t[0].box[0]+.5);}
assert.deepEqual(itemsOf({family:'noh',text:'Type 縦',latinForm:'upright'}).map(i=>i.t),['u','u','u','u','g','c']);
// ASCII punctuation between CJK characters takes its full-width CJK form; inside Latin it stays.
assert.deepEqual(itemsOf({family:'noh',text:'二十六日(日)!'}).filter(i=>i.t==='c').map(i=>i.ch).join(''),'二十六日（日）！');
assert.deepEqual(itemsOf({family:'noh',text:'No.5 (A)'}).map(i=>i.t+(i.text??'')),['rNo.5 (A)']);

// ── Layout: right-to-left flow, no overlaps, margins, alignment, tiers, ruby ──
let overlapScenes=0,cellPairs=0;
const cellsOf=(g,U)=>U.filter(u=>u.box&&!u.head&&u.role!=='band').map(u=>({u,b:u.box})).concat(g.lines.flatMap(l=>l.items.filter(i=>i.t==='r').map(i=>({u:{line:l.idx,ruby:false},b:i.box}))));
const clash=(a,b)=>Math.min(a[2],b[2])-Math.max(a[0],b[0])>.5&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>.5;
const texts=[...FAMILIES.map(f=>({family:f.id})),...FAMILIES.flatMap(f=>PRESETS.map(p=>({family:f.id,text:p.text})))];
for(const s of texts){const f=FAMILIES.find(x=>x.id===s.family),g=compose({...s,params:{jitter:0,tracking:Math.max(0,f.params.tracking)}}),U=units(g),st=g.state;
 // Lines read right to left: reading-order cross positions only grow.
 const order=g.slots.flatMap(sl=>sl.band?[]:sl.groups.flatMap(gi=>g.groups[gi].lines));for(const gi of g.groups)gi.lines.forEach((l,k)=>{if(k)assert(l.c0>gi.lines[k-1].c0,`${st.family}: column order`);});
 if(st.direction==='vertical')assert(g.slots.every((sl,i)=>!i||sl.c0>g.slots[i-1].c0),'slots flow right to left');
 // Distinct cells never overlap (same item's glyphs share one cell).
 const seen=new Set(),C=cellsOf(g,U).filter(c=>{const k=c.b.map(v=>v.toFixed(3)).join();if(seen.has(k))return false;seen.add(k);return true;});for(let i=0;i<C.length;i++)for(let j=i+1;j<C.length;j++){assert(!clash(C[i].b,C[j].b),`${st.family} ${st.text.slice(0,12)}: cells overlap`);cellPairs++;}
 // Everything is drawn on the poster; base cells keep inside the margins.
 for(const u of U){const b=bounds(u.gl.cmds,u.mat);if(b)assert(b[0]>=-1&&b[1]>=-1&&b[2]<=W+1&&b[3]<=H+1,`${st.family}: glyph off the poster`);}
 for(const {u,b} of C)if(!u.ruby)assert(b[0]>=g.frame[0]-1.5&&b[1]>=g.frame[1]-1.5&&b[2]<=g.frame[2]+1.5&&b[3]<=g.frame[3]+1.5,`${st.family} ${st.text.slice(0,10)}: cell outside the margins`);
 overlapScenes++;}
// Alignment semantics on plain columns.
const A=t=>compose({family:'noh',text:'一二三四五/一二三/一二三四五六七|一二',colors:common,params:{stagger:0,drift:1.5,scale:.7},align:t});
{const g=A('top');assert(g.lines.every(l=>Math.abs(l.m0)<1e-6));}
{const g=A('bottom');assert(g.lines.every(l=>Math.abs(l.m1-g.mainAvail)<1e-6));}
{const g=A('centre');assert(g.lines.every(l=>Math.abs((l.m0+l.m1)/2-g.mainAvail/2)<1e-6));}
{const g=A('cascade');assert(g.lines.every(l=>Math.abs(l.m0-(l.off-g.groups[l.group].lo))<1e-6&&Math.abs(l.off-1.5*g.u*l.idx)<1e-6));}
{const g=A('justify');assert(g.lines.every(l=>Math.abs(l.m0)<1e-6&&Math.abs(l.m1-g.mainAvail)<1e-6));}
const L=t=>compose({family:'noh',text:'一二三四五/一二三|一二',params:{scale:.6},layout:t}),edge=g=>[Math.min(...g.lines.map(l=>l.c0)),Math.max(...g.lines.map(l=>l.c0+l.thick))];
{const [a]=edge(L('start'));assert(Math.abs(a)<1e-6);const [,b]=edge(L('end'));const g=L('end');assert(Math.abs(b-g.crossAvail)<1e-6);const [c,d]=edge(L('centre'));assert(Math.abs(c-(L('centre').crossAvail-d))<1e-6);const [e,f]=edge(L('spread'));assert(Math.abs(e)<1e-6&&Math.abs(f-L('spread').crossAvail)<1e-6);}
// Tiers: groups stacked with || share a slot; the first sits above the second.
{const g=compose({family:'ballet'}),sl=g.slots.find(s=>!s.band);assert.equal(sl.groups.length,3);const ext=sl.groups.map(i=>[Math.min(...g.groups[i].lines.map(l=>l.m0)),Math.max(...g.groups[i].lines.map(l=>l.m1))]);assert(ext.every((e,i)=>!i||e[0]>ext[i-1][1]),'tiers do not overlap');}
// Sizes follow role and step.
{const g=compose({family:'noh',text:'*題/本文/本文|-注',params:{title:2,note:.5,step:.9}});const [t,b1,b2,nt]=g.lines;assert(Math.abs(t.s-2*g.u)<1e-9&&Math.abs(b1.s-g.u*.9)<1e-9&&Math.abs(b2.s-g.u*.81)<1e-9&&Math.abs(nt.s-g.u*.5*.729)<1e-9);}
// Ruby sits right of its base in a column (above it in a row) and centred on it.
for(const direction of ['vertical','rtl']){const g=compose({family:'manuscript',direction,text:'縦組《たてぐみ》の柱'}),U=units(g),base=U.filter(u=>!u.ruby&&u.item<2).map(u=>u.box),rb=U.filter(u=>u.ruby).map(u=>u.box);assert.equal(rb.length,4);
 if(direction==='vertical')assert(rb.every(r=>base.every(b=>r[0]>=b[2]-.5)));else assert(rb.every(r=>base.every(b=>r[3]<=b[1]+.5)));
 const mid=bs=>direction==='vertical'?(Math.min(...bs.map(b=>b[1]))+Math.max(...bs.map(b=>b[3])))/2:(Math.min(...bs.map(b=>b[0]))+Math.max(...bs.map(b=>b[2])))/2;assert(Math.abs(mid(rb)-mid(base))<1);}

// ── Colour: per-character cycle never repeats a neighbour; pixels agree ──
let colourProbes=0;
{const text='■■■■■■/■■■■■■/■■■■■■|■■■■',s={family:'noh',text,colorMode:'character',stage:3,colors:common,params:{scale:.8,stagger:0}},r=render(s),g=compose(s),U=units(g),cols=unitColours(g,U),img=new Resvg(r.svg).render(),rows=new Map();
 U.forEach((u,n)=>{const [x0,y0,x1,y1]=u.box,i=(Math.round((y0+y1)/2)*img.width+Math.round((x0+x1)/2))*4;
  assert.deepEqual([img.pixels[i],img.pixels[i+1],img.pixels[i+2]],[1,3,5].map(k=>parseInt(cols[n].slice(k,k+2),16)),'pixel at cell centre');colourProbes++;(rows.get(u.line)??rows.set(u.line,[]).get(u.line)).push({c:cols[n],y:(y0+y1)/2});});
 for(const [line,cells] of rows){cells.forEach((q,k)=>{if(k)assert.notEqual(q.c,cells[k-1].c,'same colour stacked');const prev=rows.get(line-1);if(prev&&g.lines[line].group===g.lines[line-1].group){const near=prev.reduce((a,b)=>Math.abs(b.y-q.y)<Math.abs(a.y-q.y)?b:a);assert.notEqual(q.c,near.c,'same colour beside');}});}}

// ── Input handling ────────────────────────────────────────────────────
assert.equal(normalizeColumns('東京\n京都\n\n大阪\n||\n名古屋'),'東京/京都|大阪||名古屋');assert.equal(normalizeColumns(' 東京 / 京都 // '),'東京/京都');assert.equal(normalizeColumns('ﾄｳｷｮｳ/ＴＯＫＹＯ２０２６'),'トウキョウ/TOKYO2026');
assert.equal(normalizeColumns('＊題/－注'),'*題/-注');for(const t of [...FAMILIES.map(f=>f.text),...PRESETS.map(p=>p.text)])assert.equal(normalizeColumns(normalizeColumns(t)),normalizeColumns(t));
const err=(f,v,re)=>assert.throws(()=>f(v),re,String(v));
err(normalizeColumns,'',/at least one column/);err(normalizeColumns,'東京/龘',/「龘」/);err(normalizeColumns,'🌷',/prepared character set/);err(normalizeColumns,'あ《い',/Close the ruby/);err(normalizeColumns,'あ《い》',/needs kanji/);err(normalizeColumns,'漢《》',/empty/);
err(normalizeColumns,'*',/cannot be empty/);err(normalizeColumns,Array(25).fill('東').join('/'),/24 columns/);err(normalizeColumns,'東'.repeat(41),/40 characters/);
err(parseHeader,'上|下',/not \|/);err(parseHeader,'一/二/三/四',/three header lines/);err(parseLatin,'TOKYO 東京',/「東」/);err(parseLatin,'A/B/C/D',/three Latin bands/);
assert.equal(normalizeColumns('｜東京《とうきょう》'),'｜東京《とうきょう》');assert.equal(compose({family:'noh',text:'｜東京《とうきょう》は'}).lines[0].rubies[0].b,2);
assert.equal(resolve({text:'龘'}).text,FAMILIES[0].text);assert.equal(resolve({params:{scale:Infinity}}).params.scale,FAMILIES[0].params.scale);assert.equal(resolve({params:{scale:9}}).params.scale,1);assert.equal(resolve({params:{gap:'x'}}).params.gap,FAMILIES[0].params.gap);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({family:'fukuda',align:'sideways'}).align,'bottom');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({family:'prewar',header:''}).header,'');assert.equal(resolve({family:'prewar'}).header,FAMILIES[2].header);
assert(!/<script|NaN|undefined|Infinity/.test(render({family:'noh',text:'<script>/A&B "x"'}).svg));assert.match(render({family:'noh',text:'A&B'}).svg,/A&amp;B/);
for(const f of FAMILIES)for(const stage of [1,2,3,4])for(const direction of OPTIONS.direction)assert(!/NaN|undefined|Infinity/.test(render({family:f.id,stage,direction,text:CT,header:HEAD,latin:LAT,latinBand:'title'}).svg),`${f.id} ${stage} ${direction}`);
assert(specimen({family:'noh'}).split('data-glyph').length-1===verticalForms('mincho').length);
const full=new Resvg(render({family:'neon'}).svg,{fitTo:{mode:'height',value:3000}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'noh',params:{stagger:2+i*.1}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
const vfCounts=Object.fromEntries(Object.keys(FACES).map(f=>[f,verticalForms(f).length]));
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg + fontkit',checks:{
 stylesUnderOnePalette:FAMILIES.length,visibleControlChecks:controlChecks,visibleOptionValues:optionChecks,distinctPassesPerStyle:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',
 outlineFidelity:`${outlineChecks} decoded outlines equal fontkit’s rounded outlines (horizontal sample and every vertical form, five faces)`,
 verticalForms:`${formChecks} substitutions checked: 、。，． sit upper right, small kana move up and right, ー 〜 … ‥ ― and every bracket turn; the renderer uses them in columns and mirrors brackets and stops in right-to-left rows`,verticalFormsPerFace:vfCounts,
 latinAndNumbers:'sideways runs read downward with letter tops to the right, upright in rows; tate-chū-yoko puts two half-width digits side by side in one cell; upright and sideways numbers; ASCII punctuation between CJK becomes full width',
 layout:`${overlapScenes} scenes (10 styles × own text and ${PRESETS.length} presets): columns flow right to left, ${cellPairs} cell pairs never overlap, every glyph on the poster and every cell inside the margins`,alignment:'top, bottom, centre, cascade (drift × column) and justify; start, centre, end and spread block positions; tiers stack without overlap; role and step sizes; ruby beside and centred on its base in columns and rows',
 colourProbes:`${colourProbes} cell centres in per-character mode show their assigned colour; no colour repeats above or beside`,charset:{kanji:[...CHARS.kanji].length,kana:[...CHARS.kana].length,punctuation:[...CHARS.punct].length,latin:[...CHARS.latin].length},
 invalidInputs:'empty, unsupported characters named in the message, emoji, unclosed and baseless ruby, 25 columns, 41-character column, header | and four lines, kana in the Latin band; parameter, colour, option and stage bounds; markup escaped',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},
 limitations:'Checks verify construction, forms and placement, not likeness to the references. Outlines are a bounded character set (kyōiku kanji plus common poster kanji); other kanji are rejected with a message. Kerning, proportional kana (palt) and punctuation compression are not applied.'},null,2));
console.log(`PASS: ${FAMILIES.length} styles, ${controlChecks} visible controls, ${optionChecks} option values, 4 stages, replay, ${outlineChecks} outline checks, ${formChecks} vertical forms, Latin/TCY, ${overlapScenes} layout scenes (${cellPairs} cell pairs), alignment, tiers, ruby, ${colourProbes} colour probes, inputs, ${Math.round(W*3000/H)} × 3000 export. Render ${renderMs} ms.`);
