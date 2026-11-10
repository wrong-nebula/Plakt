import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
import {ARC_TILT,ENGINE,FAMILIES,STYLES,CONTROLS,OPTIONS,GROUPS,LOOKALIKES,CHARACTERS,W,H,render,resolve,normalizeText,romajiToKana,glyphDef,glyphOutline,specimen,controlActive} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'output/showa-kana-study-v1');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// resvg's native buffers are only freed by GC: run with `node --expose-gc`; collect every 25 rasters.
let rasters=0;const raster=(s,h=450)=>{const out=new Resvg(s,{fitTo:{mode:'height',value:h},font:{loadSystemFonts:false}}).render().asPng();if(++rasters%25===0)globalThis.gc?.();return out;};
const pixels=s=>hash(raster(render(s).svg));
const common=['#ece6d8','#1d1d1f','#c5402f','#2f6f9a','#3a6a4a','#5a4a3a'];

// Thirteen families under one palette; every control and option visible in every family.
assert.equal(new Set(FAMILIES.map(f=>pixels({family:f.id,colors:common}))).size,FAMILIES.length,'families distinct under one palette');
const CONTEXT={interlock:{layout:'banner'},angle:{layout:'tilt'},arc:{layout:'arc'},depth:{finish:'shadow'},line:{finish:'inline'},glow:{finish:'neon'},leading:{text:'ニッケ/デザイン'}};
let controlChecks=0,optionChecks=0,inertChecks=0;
for(const f of FAMILIES){for(const c of CONTROLS){const ctx={family:f.id,...CONTEXT[c.key]};assert.notEqual(pixels({...ctx,params:{[c.key]:c.min}}),pixels({...ctx,params:{[c.key]:c.max}}),`${f.id} ${c.key}`);controlChecks++;}
 for(const [k,values] of Object.entries(OPTIONS)){assert.equal(new Set(values.map(v=>pixels({family:f.id,[k]:v}))).size,values.length,`${f.id} ${k}`);optionChecks+=values.length;}}
// Layout and surface controls leave every layout or finish that does not use them unchanged.
for(const c of CONTROLS.filter(c=>c.uses))for(const [k,used] of Object.entries(c.uses))for(const v of OPTIONS[k].filter(v=>!used.includes(v))){const s={family:'victrola',[k]:v};assert(!controlActive(c,resolve(s)));assert.equal(pixels({...s,params:{[c.key]:c.min}}),pixels({...s,params:{[c.key]:c.max}}),`${c.key} should not change ${k}=${v}`);inertChecks++;}
// Four passes, exact replay, and no state leaking between renders.
for(const f of FAMILIES){assert.equal(new Set([1,2,3,4].map(stage=>pixels({family:f.id,stage}))).size,4,f.id);
 const s={family:f.id,text:'ザ・ファミリー/日本大博覧会',info:'TOKYO/1936',params:{weight:13,contrast:.6,curve:.5,corner:.4,slant:.12,width:1.1,tracking:.1,interlock:.6,leading:.3,size:.9}},a=render(s);render({family:'neon',text:'ネオン',params:{weight:25}});
 assert.equal(a.svg,render(s).svg);assert.equal(a.svg,render(JSON.parse(JSON.stringify(a.state))).svg);assert.equal(hash(raster(a.svg)),hash(raster(render(a.state).svg)));}

// Every glyph builds finite outlines in every construction and stays near its em box.
let outlineChecks=0;
for(const ch of CHARACTERS){const d=glyphDef(ch);assert(d.strokes.length>0&&d.adv>0,ch);
 for(const st of STYLES){const P={...FAMILIES[0].set.params,...st.preset,weight:16,slant:0},g=glyphOutline(ch,P,st.id),pts=g.strokes.flatMap(s=>s.polys.flat());
  assert(pts.length>2&&pts.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x>-26&&x<d.adv+26&&y>-26&&y<126),`${st.id} ${ch} outline`);
  assert.deepEqual(glyphOutline(ch,P,st.id,true).strokes.length,glyphDef(ch,true).strokes.length);outlineChecks++;}}
// Legibility guard: each glyph is rasterised (48 × 48 over the em) and compared by the share
// of differing ink, |A ⊕ B| / smaller ink. Look-alike pairs must differ by at least 15%,
// every pair of kana, voiced, small kana and kanji by at least 7% (dakuten against handakuten).
const N=48,wind=(poly,x,y)=>{let w=0;for(let i=0;i<poly.length;i++){const [ax,ay]=poly[i],[bx,by]=poly[(i+1)%poly.length];if(ay<=y){if(by>y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)>0)w++;}else if(by<=y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)<0)w--;}return w;};
const bitmap=(ch,P,style)=>{const g=glyphOutline(ch,P,style),bits=new Uint8Array(N*N);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=-6+(i+.5)*112/N,y=-6+(j+.5)*112/N;
 bits[j*N+i]=g.strokes.some(s=>s.closed?s.polys.reduce((c,p)=>c+(wind(p,x,y)!==0?1:0),0)%2===1:s.polys.some(p=>wind(p,x,y)!==0))?1:0;}return bits;};
const diff=(a,b)=>{let x=0,na=0,nb=0;for(let k=0;k<a.length;k++){x+=a[k]^b[k];na+=a[k];nb+=b[k];}return x/Math.max(1,Math.min(na,nb));};
const set=GROUPS.filter(([g])=>['Katakana','Dakuten','Handakuten','Small kana','Kanji'].includes(g)).flatMap(([,c])=>[...c]),legibility={};
for(const st of STYLES){const fam=FAMILIES.find(f=>f.set.style===st.id),P={...fam.set.params,...st.preset,weight:16},bm=Object.fromEntries(set.map(ch=>[ch,bitmap(ch,P,st.id)]));
 let closest=['',Infinity],look=['',Infinity];for(let a=0;a<set.length;a++)for(let b=a+1;b<set.length;b++){const v=diff(bm[set[a]],bm[set[b]]);if(v<closest[1])closest=[set[a]+set[b],v];assert(v>=.07,`${st.id}: ${set[a]} and ${set[b]} differ by only ${v.toFixed(3)}`);}
 for(const grp of LOOKALIKES){const c=[...grp];for(let a=0;a<c.length;a++)for(let b=a+1;b<c.length;b++){const v=diff(bm[c[a]],bm[c[b]]);if(v<look[1])look=[c[a]+c[b],v];assert(v>=.15,`${st.id}: look-alikes ${c[a]} ${c[b]} differ by only ${v.toFixed(3)}`);}}
 legibility[st.id]={closestPair:closest[0],closestDiff:+closest[1].toFixed(3),closestLookalike:look[0],lookalikeDiff:+look[1].toFixed(3)};}

// Reading direction: rows run left→right or right→left, columns top→bottom and right→left.
let orderChecks=0;const P0={...FAMILIES[0].set.params};
for(const f of FAMILIES)for(const direction of OPTIONS.direction)for(const layout of OPTIONS.layout){const r=render({family:f.id,direction,layout,text:'デザイン/ネオン'}),o=r.features.order;assert.equal(o.length,7);
 if(layout==='grid')continue;const runs=[o.slice(0,4),o.slice(4)];
 for(const run of runs)for(let i=1;i<run.length;i++){const [a,b]=[run[i-1],run[i]];if(layout==='arc')continue;
  if(direction==='ttb'&&layout!=='tilt')assert(b[1]>a[1],`${f.id} ${layout} ttb down`);else if(direction==='ltr'&&layout!=='tilt')assert(b[0]>a[0],`${f.id} ${layout} ltr`);else if(direction==='rtl'&&layout!=='tilt')assert(b[0]<a[0],`${f.id} ${layout} rtl`);orderChecks++;}
 if(layout==='arc'&&direction!=='ttb'){const s=runs[0];for(let i=1;i<s.length;i++)assert(direction==='ltr'?s[i][0]>s[i-1][0]:s[i][0]<s[i-1][0],`${f.id} arc ${direction}`);orderChecks++;}
 if(direction==='ttb'&&layout!=='tilt'&&layout!=='arc'){assert(runs[1][0][0]<runs[0][0][0],`${f.id} ${layout} columns right to left`);orderChecks++;}}
const ink=(ch,v)=>{const g=glyphOutline(ch,P0,'bar',v),p=g.strokes.flatMap(s=>s.polys.flat()),xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
{const h=ink('ー',false),v=ink('ー',true);assert(h[2]-h[0]>3*(h[3]-h[1])&&v[3]-v[1]>3*(v[2]-v[0]),'long-vowel mark turns in columns');
 for(const ch of 'ァッャ'){const a=ink(ch,false),b=ink(ch,true);assert((b[0]+b[2])/2>(a[0]+a[2])/2+8&&(b[1]+b[3])/2<(a[1]+a[3])/2-8,`${ch} moves to the upper right in columns`);}
 for(const ch of '、。'){const a=ink(ch,false),b=ink(ch,true);assert(b[0]>a[0]+30&&b[1]<a[1]-30,`${ch} moves to the upper right in columns`);}}

// Arch: words of 2–10 glyphs in every family, direction and bend — em cells never intersect
// (separating-axis test on the turned cells) and no glyph tilts past ±ARC_TILT.
const overlap=(A,B)=>{for(const Q of [A,B])for(let i=0;i<4;i++){const [x1,y1]=Q[i],[x2,y2]=Q[(i+1)%4],nx=y1-y2,ny=x2-x1,pa=A.map(p=>p[0]*nx+p[1]*ny),pb=B.map(p=>p[0]*nx+p[1]*ny);if(Math.max(...pa)<=Math.min(...pb)+1e-6||Math.max(...pb)<=Math.min(...pa)+1e-6)return false;}return true;};
const archWords=['東京','日本大','カルピス','デザイン','トーキョー','日本大博覧会','ザ・ファミリー','ネオン・トーキョー','アイウエオカキクケコ','TOKYO 2026','東京/大阪','日本/大博覧会','ザ・ファミリー/オブ・マン'];let archChecks=0,maxTilt=0;
for(const f of FAMILIES)for(const direction of OPTIONS.direction)for(const arc of [.3,1,1.6])for(const text of archWords)for(const tracking of [-.3,.06]){const r=render({family:f.id,layout:'arc',direction,text,params:{arc,tracking}}),{cells,tilts}=r.features;
 for(const t of tilts){assert(Math.abs(t)<=ARC_TILT+.01,`${f.id} ${direction} bend ${arc} ${text}: tilt ${t}`);maxTilt=Math.max(maxTilt,Math.abs(t));}
 for(let a=0;a<cells.length;a++)for(let b=a+1;b<cells.length;b++)assert(!overlap(cells[a],cells[b]),`${f.id} ${direction} bend ${arc} ${text}: glyphs ${a} and ${b} overlap`);archChecks++;}
// Margins: every letter stays on the sheet in every family, layout and direction.
const texts=['ア','ザ・ファミリー・オブ・マン','日本大博覧会/東京/大阪/新聞社','TOKYO 2026','ッ','ー','アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘ','デザイン/ネオン/トーキョー/ナイト'];let marginChecks=0;
for(const f of FAMILIES)for(const layout of OPTIONS.layout)for(const direction of OPTIONS.direction)for(const text of texts){const r=render({family:f.id,layout,direction,text}),[x0,y0,x1,y1]=r.features.bounds;
 assert(!/NaN|undefined|Infinity/.test(r.svg),`${f.id} ${layout} ${direction} ${text}`);assert(x0>=4&&y0>=4&&x1<=W-4&&y1<=H-4,`${f.id} ${layout} ${direction} ${text} out of bounds ${r.features.bounds}`);marginChecks++;}

// Input handling: kana conversion, romaji, limits and messages.
for(const [a,b] of [['でざいん','デザイン'],['ﾃﾞｻﾞｲﾝ','デザイン'],['ＴＯＫＹＯ','TOKYO'],['tokyo','TOKYO'],['ねおん / とーきょー','ネオン/トーキョー'],['Café','CAFE'],['がっこう','ガッコウ'],['ぱぴぷぺぽ','パピプペポ'],['ゔ','ヴ'],['東京―大阪','東京ー大阪'],['a\nb','A/B']])assert.equal(normalizeText(a),b,a);
for(const [a,b] of [['dezain','デザイン'],['tōkyō','トーキョー'],['shinbun','シンブン'],['kitte','キッテ'],['nippon','ニッポン'],['matcha','マッチャ'],['kyōto 2026','キョート 2026'],['raibu','ライブ'],['famirī','ファミリー']])assert.equal(normalizeText(a,{romaji:true}),b,a);
assert.equal(romajiToKana('ja'),'ジャ');
for(const [bad,msg] of [['',/at least one/],['漢字',/“漢” “字”/],['🌷',/Not in the kit/],['<b>',/“<” “>”/],['A/B/C/D/E',/four lines|at most 4 lines/],['A//B',/cannot be empty/],['アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミム',/at most 32/],['ヰ',/“ヰ”/]])assert.throws(()=>normalizeText(bad),msg,bad);
assert.throws(()=>normalizeText('xylophone',{romaji:true}),/Can’t read/);
assert.equal(resolve({text:'@@'}).text,FAMILIES[0].text);assert.equal(resolve({info:''}).info,'');assert.equal(resolve({info:'漢'}).info,FAMILIES[0].info);assert.equal(resolve({params:{weight:Infinity}}).params.weight,FAMILIES[0].set.params.weight);assert.equal(resolve({params:{weight:99}}).params.weight,26);
assert.deepEqual(resolve({colors:['red']}).colors,FAMILIES[0].colors);assert.equal(resolve({finish:'bogus',family:'neon'}).finish,'neon');assert.equal(resolve({stage:9}).stage,4);assert.equal(resolve({direction:'up'}).direction,'rtl');
assert.equal(resolve({text:'dezain',romaji:true}).text,'デザイン');assert.equal(resolve({text:'dezain'}).text,'DEZAIN');
for(const f of FAMILIES){assert.equal(normalizeText(f.text),f.text,f.id);assert.equal(normalizeText(f.info,{maxRows:3,max:40}),f.info,f.id);}
// Specimen covers every glyph once.
assert.equal((specimen({}).match(/data-glyph=/g)||[]).length,CHARACTERS.length);
const full=new Resvg(render().svg,{fitTo:{mode:'height',value:3000},font:{loadSystemFonts:false}}).render().asPng();assert.equal(full.readUInt32BE(16),Math.round(W*3000/H));assert.equal(full.readUInt32BE(20),3000);
const t0=performance.now();for(let i=0;i<10;i++)render({family:'expo',text:'日本大博覧会/東京',params:{weight:14+i*.3}});const renderMs=+((performance.now()-t0)/10).toFixed(1);
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({status:'passed',engine:ENGINE,runtime:process.version,environment:'same-machine Node + resvg',checks:{commonPaletteFamilies:FAMILIES.length,visibleControlChecks:controlChecks,inertControlChecks:inertChecks,visibleOptionValues:optionChecks,distinctPassesPerFamily:4,replay:'exact SVG and resvg pixels, A/B/A and saved JSON',
 glyphs:`${CHARACTERS.length} characters × ${STYLES.length} constructions build finite outlines near the em (${outlineChecks} checks), horizontal and vertical forms`,legibility:{method:'48 × 48 raster per glyph; differing ink |A⊕B| / smaller ink; look-alike pairs ≥ 0.15, all kana, voiced, small kana and kanji pairs ≥ 0.07',perConstruction:legibility},
 arch:`${archChecks} arch renders (${FAMILIES.length} families × 3 directions × 3 bends × ${archWords.length} words of 2–10 glyphs × 2 trackings): no two em cells intersect; largest tilt ${maxTilt.toFixed(1)}° (cap ±${ARC_TILT}°)`,
 readingOrder:`${orderChecks} neighbour checks: rows left→right / right→left, columns top→bottom and right→left, arch runs in reading order; ー turns, small kana and 、。 move to the upper right in columns`,margins:`${marginChecks} renders (${FAMILIES.length} families × ${OPTIONS.layout.length} layouts × 3 directions × ${texts.length} texts) keep all letters on the sheet`,
 inputs:'hiragana, half-width and full-width conversion, accents, romaji (Hepburn, long vowels, ッ, ン, yōon), unsupported characters named in the message, markup, five lines, empty lines, 33 characters; parameter, colour, option and stage bounds; family texts valid',png:[Math.round(W*3000/H),3000],averageRenderMs:renderMs},
 limitations:'Legibility is checked against a pixel-difference threshold and by eye on the specimen and look-alike sheets, not by readers. Kanji are a fixed poster set (36), not a general kanji font; right-to-left rows reverse every character, Latin included, as prewar signs did. Stage labels and specimen captions use system fonts.'},null,2));
console.log(`PASS: ${FAMILIES.length} families, ${controlChecks} visible + ${inertChecks} inert control checks, ${optionChecks} option values, 4 stages, replay, ${CHARACTERS.length} glyphs × ${STYLES.length} constructions, legibility ${JSON.stringify(Object.fromEntries(Object.entries(legibility).map(([k,v])=>[k,v.closestDiff+'/'+v.lookalikeDiff])))}, ${orderChecks} order checks, ${archChecks} arch renders (max tilt ${maxTilt.toFixed(1)}°), ${marginChecks} margin renders, inputs, ${Math.round(W*3000/H)} × 3000 export. Render ${renderMs} ms.`);
