// Same-machine checks of the Heavy dither type engine and its fonts. Writes output/heavy-dither-type-study-v1/validation.json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import opentype from 'opentype.js';
import * as E from './engine.mjs';
import {FONTS} from './fonts.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(here,'../../output/heavy-dither-type-study-v1');
const results=[];let failed=0;
const check=(name,ok,detail='')=>{results.push({name,ok:!!ok,detail});if(!ok){failed++;console.log('FAIL',name,detail);}};
const clean=s=>!/NaN|Infinity|undefined/.test(s);

// Styles: valid, deterministic, inked in at least two inks, normalization is a fixed point, all three views render.
for(const f of E.FAMILIES){const a=E.render({family:f.id});
 check(`style ${f.id} renders`,clean(a.svg)&&a.svg.includes('<path'));check(`style ${f.id} deterministic`,a.svg===E.render({family:f.id}).svg);
 check(`style ${f.id} normalize fixed point`,JSON.stringify(E.normalize(a.state))===JSON.stringify(a.state));
 check(`style ${f.id} uses two or more inks`,a.stats.counts.filter(c=>c>0).length>=2,a.stats.counts.join(' '));
 for(const v of ['letters','tone'])check(`style ${f.id} ${v} view renders`,clean(E.render({family:f.id},{view:v}).svg));}
// Every option and range end renders on a small square; every face sets the alphabet.
const base={family:'tube',format:'square',text:'Ag/Bé',params:{rows:10}};
for(const [id,opts] of Object.entries(E.OPTIONS))for(const v of opts)check(`option ${id}=${v} renders`,clean(E.render({...base,[id]:v}).svg));
for(const c of E.CONTROLS)for(const v of [c.min,c.max])check(`control ${c.id}=${v} renders`,clean(E.render({...base,params:{...base.params,[c.id]:c.id==='rows'&&v>20?20:v}}).svg));
for(const face of Object.keys(FONTS))check(`face ${face} sets the alphabet`,clean(E.render({family:'chisel',face,layout:'specimen',format:'square',params:{rows:8}}).svg));
// Rows per cap: more rows, more cells; the letters view inks exactly the covered cells.
const cells=r=>E.render({family:'block',params:{rows:r}}).stats.cells;check('more rows per cap, more cells',cells(6)<cells(12)&&cells(12)<cells(24));
{const r=E.render({family:'block',params:{rows:10,extrude:0}},{view:'letters'});check('letters view has two levels',r.stats.counts.filter(c=>c>0).length===2);}
// Constructions change the letters; solid and an unused amount agree; warps move them; none and amount 0 agree.
const word={family:'chisel',format:'square',text:'ABC',layout:'poster',params:{rows:16}},solid=E.render(word).svg;
for(const c of E.OPTIONS.construct.filter(c=>c!=='solid'))check(`construction ${c} changes the letters`,E.render({...word,construct:c}).svg!==solid);
check('construction amount is inert for solid letters',E.render({...word,params:{...word.params,constructAmount:.1}}).svg===solid);
for(const w of E.OPTIONS.warp.filter(w=>w!=='none')){check(`warp ${w} changes the letters`,E.render({...word,warp:w}).svg!==solid);check(`warp ${w} at 0 is identity`,E.render({...word,warp:w,params:{...word.params,warpAmount:0}}).svg===solid);}
check('bounce and spin at 0 are identity',E.render({...word,params:{...word.params,bounce:0,spin:0}}).svg===solid);
check('bounce moves letters',E.render({...word,params:{...word.params,bounce:.8}}).svg!==solid);
// Renderings: every mark draws; bloom adds one filter; misregistration moves inks.
for(const m of E.OPTIONS.mark){const r=E.render({...word,mark:m});check(`rendering ${m} draws marks`,clean(r.svg)&&/<path fill="#[0-9a-f]{6}" d="M/.test(r.svg));}
check('bloom adds a blur under the marks',(E.render({...word,params:{...word.params,bloom:.5}}).svg.match(/feGaussianBlur/g)||[]).length===1);
check('misregistration offsets inks',/transform="translate/.test(E.render({family:'pop',format:'square',text:'AB',params:{rows:10,misregister:.8}}).svg));
// Layouts: panel counts.
check('ladder has five panels',E.render({family:'tube',layout:'ladder'}).stats.panels===5);check('sizes has five panels',E.render({family:'tube',layout:'sizes'}).stats.panels===5);
check('tiles has one panel per distinct letter',E.render({family:'tube',layout:'tiles',text:'ABBA'}).stats.panels===2);
// Dimmed controls are inert.
{const s={family:'block'},a=E.render(s).svg,n=E.normalize(s);
 for(const [id,v] of [['depth',3],['haloWidth',1],['shadowX',.4],['fillAmount',.2],['order',.9],['markSize',.5],['warpAmount',-.8],['constructAmount',.9]])check(`${id} is dimmed and inert for Block`,!E.applies(id,n)&&E.render({...s,params:{[id]:v}}).svg===a);}
// Glyphs on their own: runs sit on the pixel grid of the cap and every ink of a style shares one advance.
{const g=E.glyphPixels({family:'long-shadow'},'A'),ph=700/E.normalize({family:'long-shadow'}).params.rows;
 check('glyph runs lie on the cap grid',g.runs.every(l=>l.runs.every(([x,y,w,h])=>Math.abs(h-ph)<1e-6&&Math.abs(Math.round((-y)/ph)-(-y)/ph)<1e-6)));
 check('glyph has a run per non-page ink',g.runs.length===g.levels-1);}
// Fonts, if built: each parses, maps its characters, and the inks of one style share advances.
const fontDir=path.join(out,'fonts');
if(fs.existsSync(path.join(fontDir,'index.json'))){const index=JSON.parse(fs.readFileSync(path.join(fontDir,'index.json'))),byStyle={};
 for(const f of index){const b=fs.readFileSync(path.join(out,f.file)),font=opentype.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length)),A=font.charToGlyph('A');
  check(`font ${path.basename(f.file)} parses`,font.glyphs.length===f.glyphs+2&&A.index>0&&A.path.commands.length>0);(byStyle[f.style]??=[]).push(font);}
 for(const [style,fonts] of Object.entries(byStyle))if(fonts.length>1)check(`ink fonts of ${style} share advances`,[...'AWg0!'].every(ch=>new Set(fonts.map(f=>f.charToGlyph(ch).advanceWidth)).size===1));}
else check('fonts are built (run build.mjs first)',false);

fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({engine:E.ENGINE,checks:results.length,failed,results},null,2));
console.log(`${results.length-failed}/${results.length} checks passed`);if(failed)process.exitCode=1;
