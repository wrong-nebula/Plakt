import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import path from 'node:path';
import opentype from 'opentype.js';
import {render,resolve,normalizeText,splitRows,applies,glyphGeometry,setLines,wordColumn,FAMILIES,CONTROLS,GLYPHS,PAGE} from './engine.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pixels=r=>new Resvg(r.svg,{fitTo:{mode:'height',value:420}}).render().asPng();
const close=(a,b,t=.01)=>Math.abs(a-b)<=t;
const checks=[],seen=new Set();let parameterChecks=0;

// Cutting systems, controls and construction passes
for(const f of FAMILIES){
 const input={family:f.id,colors:['#f5f7f8','#111419']},a=render(input),state=resolve(input);
 render({text:'fubu/studio',family:'offset'});assert.equal(a.svg,render(input).svg,'A/B/A vector replay');
 assert.equal(sha(pixels(a)),sha(pixels(render(JSON.parse(JSON.stringify(a.state))))),'portable pixel replay');
 const hash=sha(pixels(a));assert(!seen.has(hash),'distinct cutting systems under one common palette');seen.add(hash);
 const active=CONTROLS.filter(c=>applies(c.key,state));
 for(const c of active){const lo=render({...input,params:{[c.key]:c.min}}),hi=render({...input,params:{[c.key]:c.max}});
  assert.notEqual(sha(pixels(lo)),sha(pixels(hi)),`${f.id}.${c.key} changes pixels`);assert(!/NaN|Infinity/.test(lo.svg+hi.svg));parameterChecks++;
 }
 assert.equal(new Set([1,2,3,4].map(stage=>sha(pixels(render({...input,stage}))))).size,4,'four actual construction passes');
 const source=render({...input,layout:'source'});assert.equal(new Set([1,2,3,4].map(stage=>sha(pixels(render({...input,layout:'source',stage}))))).size,4,'four passes in the source layout');
 for(const key of ['width','leading']){assert(!applies(key,source.state));assert.equal(sha(pixels(render({...input,layout:'source',params:{[key]:CONTROLS.find(c=>c.key===key).min}}))),sha(pixels(source)),`${key} is inert in the source layout, as the editor shows`);}
 const full=new Resvg(a.svg,{fitTo:{mode:'height',value:3000}}).render();assert.equal(full.width,2139);assert.equal(full.height,3000);
 checks.push({family:f.id,pixelSHA256:hash,controls:active.map(c=>c.key),stages:4,replay:'passed'});
}

// Shared construction: guides, seams and parts
const params=resolve({}).params,em=100;
const geo=(ch,p={},gl=100)=>glyphGeometry(ch,{...params,...p},gl,em);
const stemLetters='abdfhjknpqruBD',fixedLetters='cegilmostvwxyz';
for(const ch of stemLetters)assert.notEqual(JSON.stringify(geo(ch,{stem:.4})),JSON.stringify(geo(ch,{stem:.6})),`stem split moves ${ch}`);
for(const ch of fixedLetters)assert.equal(JSON.stringify(geo(ch,{stem:.4})),JSON.stringify(geo(ch,{stem:.6})),`stem split leaves ${ch}`);
const partsAt=(ch,square)=>JSON.stringify(geo(ch,{square}).parts);
for(const ch of 'abcdeghjmnopqrstuwzBD')assert.notEqual(partsAt(ch,0),partsAt(ch,1),`squareness reshapes ${ch}`);
for(const ch of 'iklvxy')assert.equal(partsAt(ch,0),partsAt(ch,1),`squareness leaves straight-sided ${ch}`);
const o=s=>s.points.map(([,y])=>y);
assert.deepEqual(o(geo('o',{bridge:.09}).seams[0]).map(v=>+v.toFixed(3)),[9,91],'closed seam ends stop one bridge short');
assert.deepEqual(o(geo('o',{bridge:0}).seams[0]).map(v=>+v.toFixed(3)),[0,100],'bridge 0 cuts right through');
assert(geo('n').seams[0].points[1][1]>em,'open seam end exits the letter');
assert.equal(geo('c',{aperture:.2}).notches.length,1);assert.equal(geo('c',{aperture:0}).notches.length,0,'aperture notch only on v ends');
assert.equal(geo('o',{bridge:.2,seam:.04}).seams.length,1);assert.equal(glyphGeometry('l',params,55,100).seams.length,0,'solid unslit l');
for(const ch of Object.keys(GLYPHS).filter(c=>c!==' ')){
 const g=geo(ch,{},GLYPHS[ch]({s:.5,m:.5,d:.22}).advance*100),nums=g.parts.map(p=>p.d).join(' ').match(/-?\d*\.?\d+/g).map(Number);
 assert(g.parts.length>0&&nums.every(Number.isFinite),`${ch} has finite parts`);
}
assert.equal(Object.keys(GLYPHS).filter(c=>/^[a-z]$/.test(c)).length,26);

// Typesetter: orientation, fit and transfer
const page={x:PAGE.margin,y:PAGE.margin,w:PAGE.width-2*PAGE.margin,h:PAGE.height-2*PAGE.margin};
const inside=b=>b[0]>=page.x-.5&&b[1]>=page.y-.5&&b[0]+b[2]<=page.x+page.w+.5&&b[1]+b[3]<=page.y+page.h+.5;
for(const text of ['fubu/studio','shape/system','abcdefghijklmnop/qrstuvwxyz','capsule/type/system','yz/pablo nouvelle','2.12.2022/21:00 (pool)','15.-\\/25.-/[a+b=c] & 50%'])for(const layout of ['up','down','rows'])for(const fit of ['fill','even']){
 const r=render({text,layout,fit}),rows=splitRows(text);
 assert.deepEqual(r.lines.map(l=>l.glyphs.map(g=>g.ch).join('')),rows,'every character set in order');
 assert.equal(new Set(r.lines.map(l=>l.em.toFixed(6))).size,1,'one em across lines');
 for(const l of r.lines)for(const g of l.glyphs)assert(inside(g.box),`${text} ${layout} ${fit} stays inside the page`);
 const first=r.lines[0].glyphs[0].box,second=r.lines[1].glyphs[0].box;
 if(layout==='up'){assert(first[0]<second[0]);const g=r.lines[0].glyphs;assert(g.length<2||g[1].box[1]<g[0].box[1],'reads upward');}
 if(layout==='down'){assert(first[0]>second[0]);const g=r.lines[0].glyphs;assert(g.length<2||g[1].box[1]>g[0].box[1],'reads downward');}
 if(layout==='rows'){assert(first[1]<second[1]);const g=r.lines[0].glyphs;assert(g.length<2||g[1].box[0]>g[0].box[0],'reads rightward');}
 const length=layout==='rows'?page.w:page.h;
 for(const l of r.lines){
  const boxes=l.glyphs.map(g=>g.box),span=layout==='rows'?Math.max(...boxes.map(b=>b[0]+b[2]))-Math.min(...boxes.map(b=>b[0])):Math.max(...boxes.map(b=>b[1]+b[3]))-Math.min(...boxes.map(b=>b[1]));
  if(fit==='fill'&&l.stretch<2.999)assert(close(span,length,.05),'fill runs each line the full length');
  if(fit==='even')assert(close(l.stretch,1,1e-9),'even keeps the set width');
 }
}

// Source layout and input
assert.equal(wordColumn('nouvelle','second').length,8);assert.equal(wordColumn('pablo','first').length,5);
assert.equal(render({layout:'source'}).features.proportions,'source-proportions');assert.equal(render({layout:'source',text:'fubu/studio'}).features.proportions,'transferred-words');
assert.throws(()=>resolve({layout:'source',text:'capsule/type/system'}),/exactly two lines/);
for(const bad of ['','   ','/','a//b','abcdefghijklmnopqrstuvwxy','a/b/c/d/e/f/g/h/i','🌺','pablo§neubad','a¶b','abcdefghijklmnopqrstuvwx/abcdefghijklmnopqrstuvwx/abcdefghijklmnopqrstuvwx'])assert.throws(()=>normalizeText(bad,''),undefined,JSON.stringify(bad));
assert.equal(normalizeText('CAFÉ',''),'café','accents with a glyph are kept');assert.equal(normalizeText('Ñandú',''),'nandu','other accents fall back to the base letter');assert.equal(normalizeText('Pablo\nNouvelle',''),'pablo/nouvelle');assert.equal(normalizeText(' fubu / studio ',''),'fubu/studio');
assert.equal(normalizeText('BAND',''),'BanD','unicase capitals keep the B and D capital forms');assert.equal(normalizeText('a\\b <c> {d|e}/~f^ g_h `i`',''),'a\\b <c> {d|e}/~f^ g_h `i`','all of printable ASCII is accepted');assert.equal(normalizeText('Straße',''),'strasse');
assert.equal(normalizeText('‘21:00’ – “Pool”…',''),'\'21:00\' – "pool"…','the ellipsis has its own glyph');
assert.deepEqual(splitRows(normalizeText('15.-\\/25.-/eintritt','')),['15.-/25.-','eintritt'],'\\/ sets a slash glyph, / starts a line');
assert.equal(resolve({params:{bridge:Infinity}}).params.bridge,.09);
const legacy=resolve({version:1,engine:'pablo-capsule-v1',first:'fubu',second:'studio',family:'twin',params:{slit:.02,depth:1,tracking:1.5,offset:3},colors:['#19384b','#bcdfec'],invert:false,stage:4});
assert.equal(legacy.text,'fubu/studio');assert.equal(legacy.layout,'source');assert.equal(legacy.params.seam,.02);assert(close(legacy.params.tracking,.0825,1e-9));assert.equal(legacy.params.offset,.03);
assert.equal(setLines(resolve({text:'a'})).length,1);

// Cuts and accents
// Length of the straight right side of a disc: the first curve's end to the first V.
const side=d=>{const m=d.match(/C(?:[-\d.]+ ){5}([-\d.]+)V([-\d.]+)/);return +m[2]-+m[1];};
assert(close(side(glyphGeometry('o',params,64,100,'regular').parts[0].d),0,1e-6),'a narrow regular o is an ellipse');
assert(close(side(glyphGeometry('o',params,64,100,'compressed').parts[0].d),100-2*32*1.1,1e-3),'compressed bowls have straight sides between round ends');
const widths=cut=>setLines(resolve({text:'pablo',layout:'rows',fit:'even',cut,params:{width:1}}),{width:4000,height:400,margin:0})[0].glyphs.map(g=>g.gl/g.em);
widths('compressed').forEach((w,i)=>assert(close(w,widths('regular')[i]*.64,1e-9),'compressed is 64% of the regular advance'));
assert.equal(geo('ä').seams.length,geo('a').seams.length+2,'umlaut adds two incisions');
assert.equal(geo('ô').seams.length,1,'circumflex replaces the top-centre seam of o');
assert.deepEqual(render({text:'zürich/genève',layout:'rows'}).lines.map(l=>l.glyphs.map(g=>g.ch).join('')),['zürich','genève']);
assert.equal(normalizeText('«A × B» → 15€ @neubad',''),'«a × B» → 15€ @neubad','poster punctuation is accepted');
const compressedAmp=setLines(resolve({text:'&',layout:'rows',fit:'even',cut:'compressed',params:{width:1}}),{width:4000,height:400,margin:0})[0].glyphs[0];
assert(close(compressedAmp.gl/compressedAmp.em,.94*.82,1e-9),'the compressed ampersand keeps 82% of its width');

// Stencil seams: a seam just inside a part edge moves onto it; centred seams stay; hairlines never move.
const xOf=(ch,p,gl)=>glyphGeometry(ch,{...params,...p},gl,700).seams.map(s=>s.points[0][0]);
const stencil={bridge:0,seam:.12};
assert(close(xOf('j',stencil,560)[0],.45*560,1e-6),'the j seam moves onto the stem edge in Exploded');
assert(close(xOf('j',{},560)[0],.5*560,1e-6),'the j seam stays put at hairline width');
assert(close(glyphGeometry('t',{...params,...stencil},560,700).seams[0].points[0][1],.4*700,1e-6),'the centred t seam is not moved');
assert(close(glyphGeometry('p',{...params,...stencil},700,700).seams[1].points[1][0]-.5*700,Math.max(.04,.12*.6)*700,1e-6),'open ends overshoot by 0.6 seam, not 2 seams');

// Frozen fonts: each OTF is built from its frozen outline file alone and matches it.
const fontsDir=new URL('./fonts/',import.meta.url),fontOut=new URL('../../output/pablo-capsule-study-v1/font/',import.meta.url),fonts=[];
for(const file of fs.readdirSync(fontsDir).filter(f=>/^capsule-.+-[\d.]+\.json$/.test(f))){
 const id=file.replace(/^capsule-|-[\d.]+\.json$/g,''),frozen=JSON.parse(fs.readFileSync(new URL(file,fontsDir))),record=JSON.parse(fs.readFileSync(new URL(`build-${id}-${frozen.version}.json`,fontOut)));
 assert.equal(record.frozenSHA256,sha(fs.readFileSync(new URL(file,fontsDir))),'the OTF was built from this frozen file');
 const bytes=fs.readFileSync(new URL(record.otf,fontOut)),font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.equal(sha(bytes),record.otfSHA256);assert.equal(font.glyphs.length,frozen.glyphs.length+1,'every frozen glyph plus .notdef');
 assert.equal(new Set(frozen.glyphs.map(g=>g.name)).size,frozen.glyphs.length,'glyph names are unique');
 for(const g of frozen.glyphs){
  assert.match(g.name,/^[A-Za-z0-9._]+$/,`${file}: glyph name for ${g.character} is ASCII`);
  for(const u of g.unicodes)assert.equal(font.charToGlyph(String.fromCodePoint(u)).name,g.name,`U+${u.toString(16)} maps to ${g.name}`);
  const otf=font.charToGlyph(String.fromCodePoint(g.unicodes[0]));assert.equal(otf.advanceWidth,Math.round(g.advanceWidth));
  const ours=[...g.path.matchAll(/-?\d*\.?\d+/g)].map(m=>Math.round(+m[0])),theirs=otf.path.commands.flatMap(c=>['x1','y1','x2','y2','x','y'].filter(k=>k in c).map(k=>c[k]));
  assert.deepEqual(theirs,ours,`${g.name} outline matches the frozen file`);
 }
 const tube=(frozen.kind??'capsule')==='tube';
 for(const ch of 'ACEFGHIJKLMNOPQRSTUVWXYZ')assert.equal(font.charToGlyph(ch).name,ch.toLowerCase(),'unicase capitals');
 for(const ch of 'BD')assert.equal(font.charToGlyph(ch).name,tube?ch.toLowerCase():ch,tube?'Tube is fully unicase':'capital B and D forms');
 // Reported, not asserted: the live system may change later; the frozen font does not.
 fonts.push({style:id,version:frozen.version,family:`${frozen.family} ${frozen.style}`,glyphs:frozen.glyphs.length,frozenSHA256:record.frozenSHA256,otfSHA256:record.otfSHA256,
  livePixelsDifferingAtBuild:record.liveAtBuild?{letters:record.liveAtBuild.letters.differingPixels,figures:record.liveAtBuild.figures.differingPixels}:'not applicable (Tube is not drawn by the live engine)'});
}
assert.deepEqual([...new Set(fonts.map(f=>f.style))].sort(),['compressed','exploded','incised','split','tube','tube-fill','tube-shadow'],'all seven frozen styles');
assert.equal(fonts.find(f=>f.style==='incised'&&f.version==='1.0').glyphs,61,'Incised 1.0 is unchanged: 61 glyphs, no accents');
// Incised 1.1 is 1.0 plus the accents: every 1.0 glyph is carried over exactly.
{const read=v=>JSON.parse(fs.readFileSync(new URL(`capsule-incised-${v}.json`,fontsDir))),a=read('1.0'),b=new Map(read('1.1').glyphs.map(g=>[g.character,g]));
 for(const g of a.glyphs)assert.deepEqual(b.get(g.character),g,`Incised 1.1 keeps ${g.name} from 1.0 exactly`);
 assert.equal(b.size,a.glyphs.length+12,'Incised 1.1 adds the twelve accented letters');}
// Version 1.1 of the stencils has no crumbs or slivers: every piece is at least 7000 units² and 45 units across.
{const area=pts=>pts.reduce((s,[x,y],i)=>{const [u,v]=pts[(i+1)%pts.length];return s+x*v-u*y;},0)/2;
 const pieces=d=>d.split('Z').filter(s=>s.trim()).map(s=>{const n=(s.match(/-?\d*\.?\d+/g)||[]).map(Number),pts=[];for(let i=0;i<n.length;i+=2)pts.push([n[i],n[i+1]]);return pts;});
 for(const id of ['split','exploded','compressed']){
  const f=JSON.parse(fs.readFileSync(new URL(`capsule-${id}-1.1.json`,fontsDir)));
  for(const g of f.glyphs.filter(g=>g.path)){
   const cs=pieces(g.path).map(p=>({a:area(p),p})),sign=Math.sign(cs.reduce((m,c)=>Math.abs(c.a)>Math.abs(m.a)?c:m).a);
   for(const c of cs.filter(c=>Math.sign(c.a)===sign)){const xs=c.p.map(p=>p[0]),ys=c.p.map(p=>p[1]);
    assert(Math.abs(c.a)>=7000&&Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))>=45,`${id} 1.1 ${g.name} has no crumb or sliver`);}
  }
 }}
// Version 1.2: optical spacing, all of printable ASCII and real line metrics. Outlines are the
// previous version's moved by the new left sidebearing; no letter or figure side drops below
// half the base gap; the mean letter spacing stays; Tube, Tube Shadow and Tube Fill stack.
const spacing=[];
{const read=(id,v)=>JSON.parse(fs.readFileSync(new URL(`capsule-${id}-${v}.json`,fontsDir)));
 const xs=(g,lsb)=>[...g.path.matchAll(/-?\d*\.?\d+/g)].map((m,i)=>i%2?+m[0]:+m[0]-lsb);
 const otf=f=>{const b=fs.readFileSync(new URL(JSON.parse(fs.readFileSync(new URL(`build-${f.styleId}-${f.version}.json`,fontOut))).otf,fontOut));return opentype.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
 const weight={incised:800,compressed:800,split:800,exploded:800,tube:400,'tube-shadow':400,'tube-fill':800};
 for(const [id,prev] of [['incised','1.1'],['compressed','1.1'],['split','1.1'],['exploded','1.1'],['tube','1.1'],['tube-shadow','1.1'],['tube-fill','1.0']]){
  const a=read(id,prev),b=read(id,'1.2'),base=b.kind==='tube'?30:b.construction.tracking*b.glyphHeight/2,old=new Map(a.glyphs.map(g=>[g.character,g]));
  assert.equal(b.spacing,'optical',`${id} 1.2 is optically spaced`);
  const sides=[];
  for(const g of b.glyphs){
   const o=old.get(g.character);if(!o)continue;
   const p=xs(g,g.lsb),q=xs(o,o.lsb??base);assert(p.length===q.length&&p.every((v,i)=>close(v,q[i],.002)),`${id} 1.2 keeps the ${g.name} outline`);
   if(!/^[a-z0-9BD]$/.test(g.character))continue;
   const rsb=g.advanceWidth-g.lsb-(o.advanceWidth-2*base);sides.push([g.character,g.lsb,rsb]);
   assert(g.lsb>=base/2-1e-6&&rsb>=base/2-.01,`${id} 1.2 ${g.name} keeps at least half the base gap on each side`);
  }
  const letters=sides.filter(([c])=>/^[a-z]$/.test(c)),mean=letters.reduce((s,[,l,r])=>s+l+r,0)/letters.length;
  assert(Math.abs(mean-2*base)<=.01*2*base,`${id} 1.2 keeps the mean letter spacing of 1.1 (within 1%)`);
  const font=otf(b),os2=font.tables.os2,names=font.names.windows;
  for(let c=32;c<127;c++)assert.notEqual(font.charToGlyph(String.fromCharCode(c)).index,0,`${id} 1.2 covers ${JSON.stringify(String.fromCharCode(c))}`);
  let top=-Infinity,bottom=Infinity;for(const g of b.glyphs)for(const [i,v] of [...g.path.matchAll(/-?\d*\.?\d+/g)].map(m=>+m[0]).entries())if(i%2){top=Math.max(top,v);bottom=Math.min(bottom,v);}
  assert(os2.fsSelection&128&&os2.version>=4,`${id} 1.2 uses its typo metrics for line spacing`);
  assert(os2.sTypoAscender===b.ascender&&os2.sTypoDescender===b.descender&&os2.sTypoLineGap===0&&font.tables.hhea.ascender===b.ascender,`${id} 1.2 typo and hhea metrics agree`);
  assert(os2.usWinAscent>=top&&os2.usWinDescent>=-bottom&&b.ascender>=top&&-b.descender>=-bottom,`${id} 1.2 line metrics cover every outline`);
  assert.equal(os2.usWeightClass,weight[id]);
  assert(names.preferredFamily.en===b.family&&names.preferredSubfamily.en===b.style&&names.fontSubfamily.en==='Regular',`${id} 1.2 links as its own Regular inside ${b.family}`);
  spacing.push({style:id,version:'1.2',meanLetterSpacing:Math.round(mean*10)/10,baseGap:2*base,tightestSide:Math.round(sides.reduce((m,s)=>Math.min(m,s[1],s[2]),Infinity)*10)/10,loosestSide:Math.round(sides.reduce((m,s)=>Math.max(m,s[1],s[2]),0)*10)/10,lineHeight:b.ascender-b.descender});
 }
 const [t,s,f]=['tube','tube-shadow','tube-fill'].map(id=>read(id,'1.2'));
 t.glyphs.forEach((g,i)=>assert(s.glyphs[i].character===g.character&&s.glyphs[i].advanceWidth===g.advanceWidth&&f.glyphs[i].advanceWidth===g.advanceWidth&&f.glyphs[i].lsb===g.lsb,`Tube 1.2 ${g.name} stacks with Shadow and Fill`));
}

const report={status:'passed',environment:'Node + resvg on this Mac',engine:'pablo-capsule-v2',checks,parameterChecks,fonts,spacing,
 construction:['stem split moves the 14 stem letters and leaves the 14 others','bowl squareness reshapes disc and bowl parts','closed seam ends stop one bridge short; bridge 0 cuts through','open seam ends exit the letter','aperture notches only on aperture ends','all 26 lowercase plus B/D build finite parts'],
 typesetting:['7 texts (letters, figures, punctuation, escaped slash) × 3 orientations × 2 fits keep every character in order','one shared em per setting','all glyph boxes inside the page margins','columns up: first line left, reading upward; columns down: first line right, reading downward; rows: first line on top, reading rightward','fill runs each line the full length; even keeps the set width'],
 scope:'Three systems compared under an identical palette; four real stages each in the type and source layouts; exact vector/pixel/JSON replay; all applicable controls change pixels and inapplicable ones are inert; shared-part and seam invariants; orientation and fit invariants; source-layout invariants; v1 rule migration; raster size and invalid input checks. Visual quality and resemblance are manually assessed, not scored.'};
fs.writeFileSync(new URL('../../output/pablo-capsule-study-v1/validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log(`PASS: 3 cutting systems, ${parameterChecks} visible control changes, 4 stages each, shared-part invariants, 42 text/orientation/fit settings, source layout, input rules, cuts and accents, v1 migration, ${fonts.length} frozen fonts (${spacing.length} optically spaced with full ASCII and line metrics) and export sizes.`);
