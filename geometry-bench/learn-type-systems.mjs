import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const library=path.resolve(process.argv[2]||'library'),out=path.resolve(process.argv[3]||'output/type-systems-v1');await fs.mkdir(out,{recursive:true});
const operations=['grapheme-migration','permutation-sequence','compensated-erosion','repeat-field','paired-columns','staircase','scale-ramp','rotation-field','radial-fan','curved-baseline','word-reflow','tittle-substitution','reflection','alternating-ink'];
const tags=['grapheme-migration','adjacent-transposition','anagram-sequence','compensated-erosion','periodic-insertion','text-duplication','glyph-repetition','paired-column-repetition','staggered-repetition','stepped-alignment','scale-ramp','alternating-rotation','vertical-type','radial-type','text-on-path','word-reflow','tittle-substitution','reflection','color-inversion','alternating-ink'];
const featureNames=[...operations.map(x=>'operator:'+x),...tags.map(x=>'tag:'+x),'row-count','mean-graphemes','field-aspect','rotation-span','step-x','step-y','scale-ratio','ink-period'];
const norm=s=>s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const chars=s=>Array.from(new Intl.Segmenter('und',{granularity:'grapheme'}).segment(s.normalize('NFC')),x=>x.segment);const letters=s=>norm(s).replace(/\p{N}/gu,'');
function union(rows){const x=Math.min(...rows.map(e=>e.bounds.x)),y=Math.min(...rows.map(e=>e.bounds.y)),right=Math.max(...rows.map(e=>e.bounds.x+e.bounds.width)),bottom=Math.max(...rows.map(e=>e.bounds.y+e.bounds.height));return{x,y,width:right-x,height:bottom-y}}
function distance(a,b){a=chars(a);b=chars(b);let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,prev[j+1]+1,prev[j]+(a[i]===b[j]?0:1)));prev=next}return prev[b.length]}
function regression(values){const n=values.length,m=values.reduce((s,x)=>s+x,0)/n,c=(n-1)/2,den=Array.from({length:n},(_,i)=>(i-c)**2).reduce((a,b)=>a+b,0),slope=values.reduce((s,x,i)=>s+(i-c)*(x-m),0)/Math.max(1e-9,den),intercept=m-slope*c,err=values.reduce((s,x,i)=>s+(x-intercept-slope*i)**2,0),total=values.reduce((s,x)=>s+(x-m)**2,0);return{slope,intercept,r2:total<1e-8?1:1-err/total,error:Math.sqrt(err/n)}}
function groupsBy(rows,key){const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row)}return [...map.values()]}
function order(rows){const vertical=rows.filter(e=>Math.abs(Math.sin(e.rotation*Math.PI/180))>.8).length>rows.length/2;return [...rows].sort((a,b)=>vertical?a.bounds.x-b.bounds.x||a.bounds.y-b.bounds.y:a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x)}
const index=JSON.parse(await fs.readFile(path.join(library,'library.json'),'utf8')),systems=[],scanRows=[],seen=new Set();let scannedElements=0,analyzedLines=0,analyzedWords=0;
for(const [posterIndex,entry]of index.posters.entries()){
 const r=JSON.parse(await fs.readFile(fileURLToPath(entry.recordURL),'utf8'));scannedElements+=r.elements.length;
 const active=r.elements.filter(e=>e.reviewStatus!=='rejected'),lines=active.filter(e=>e.kind==='text-line'&&letters(e.text||'').length>0),words=active.filter(e=>e.kind==='word');analyzedLines+=lines.length;analyzedWords+=words.length;
 const major=order(lines.filter(e=>(Math.abs(Math.sin(e.rotation*Math.PI/180))>.8?e.bounds.width/(r.height/r.width):e.bounds.height)>.025));
 const before=systems.length;
 function emit(operation,name,rows,parameters={},textParameters={},methodTags=[],confidence=.95,status='fitted',fitError=0,invariants=[],explanation=''){
  rows=order(rows);if(rows.length===0||rows.length>48)return;const box=union(rows);if(box.width<=0||box.height<=0||box.x<0||box.y<0||box.x+box.width>1.002||box.y+box.height>1.002)return;
  const key=r.id+'|'+operation+'|'+rows.map(e=>e.id).sort().join('|');if(seen.has(key))return;seen.add(key);
  const id=r.id+'-'+operation+'-'+createHash('sha256').update(key).digest('hex').slice(0,12);
  const heights=rows.map(e=>e.bounds.height),sx=regression(rows.map(e=>e.bounds.x)).slope/box.width,sy=regression(rows.map(e=>e.bounds.y)).slope/box.height;
  parameters={count:rows.length,stepX:sx,stepY:sy,...parameters};
  const numeric=[Math.min(1,rows.length/24),Math.min(1,rows.reduce((s,e)=>s+chars(norm(e.text||'')).length,0)/rows.length/30),Math.min(1,box.width/box.height/(r.height/r.width)/5),(Math.max(...rows.map(e=>e.rotation))-Math.min(...rows.map(e=>e.rotation)))/360,Math.max(-1,Math.min(1,sx)),Math.max(-1,Math.min(1,sy)),Math.min(2,parameters.scaleRatio||1)/2,(parameters.inkPeriod||0)/4];
  let vector=[...operations.map(x=>x===operation?2:0),...tags.map(x=>methodTags.includes(x)?1:0),...numeric];const length=Math.hypot(...vector);vector=vector.map(x=>x/length);
  systems.push({version:'type-system-genome-v1',id,name,operation,tags:methodTags,parameters,textParameters,sourcePosterID:r.id,sourceElementIDs:rows.map(e=>e.id),sourceImageURL:r.imageURL,sourceAspect:r.height/r.width,sourceBounds:box,sourceEmbedding:null,cropURL:null,semanticEmbedding:vector,confidence,status,fitError,invariants,explanation,observations:rows.map(e=>({elementID:e.id,text:e.text||'',bounds:e.bounds,rotation:e.rotation,confidence:e.confidence})),frames:rows.map(e=>({sourceElementID:e.id,bounds:{x:(e.bounds.x-box.x)/box.width,y:(e.bounds.y-box.y)/box.height,width:e.bounds.width/box.width,height:e.bounds.height/box.height},rotation:e.rotation})),indexSchedules:null});
 }
 // Exact grapheme multiset / ordered-token fits. Repeated words are handled separately.
 const wordRows=major.filter(e=>{const x=letters(e.text||'');return chars(x).length>=3&&chars(x).length<=30&&!/\s/.test((e.text||'').trim())});
 for(const group of groupsBy(wordRows,e=>chars(letters(e.text||'')).sort().join('')).filter(g=>g.length>=3)){
  const rows=order(group),observed=rows.map(e=>letters(e.text||'')),base=chars(observed[0]);if(new Set(observed).size<3)continue;let fitted=false;
  for(let moving=0;moving<base.length&&!fitted;moving++){
   if(base.filter(x=>x===base[moving]).length!==1)continue;const remainder=base.filter((_,i)=>i!==moving),positions=[];let good=true;
   for(const word of observed){const p=chars(word).indexOf(base[moving]);if(chars(word).filter((_,i)=>i!==p).join('')!==remainder.join('')){good=false;break}positions.push(p)}
   const deltas=positions.slice(1).map((x,i)=>x-positions[i]);if(!good||deltas.some(x=>Math.abs(x)!==1)||!deltas.every(x=>x===deltas[0]))continue;
   emit('grapheme-migration','Single-grapheme migration',rows,{movingIndex:moving,direction:Math.sign(deltas[0]),sourceLength:base.length},{sourceInput:observed[0],caseMode:'lowercase'},['grapheme-migration','adjacent-transposition','text-duplication'],1,'fitted',0,['Each row keeps every original grapheme exactly once.','All non-moving graphemes retain their order.','The selected grapheme advances by one adjacent transposition per row.'],'An exact ordered sequence fit, not an arbitrary shuffle.');fitted=true;
  }
  if(!fitted){emit('permutation-sequence','Conserved-letter permutation sequence',rows,{sourceLength:base.length},{sourceInput:observed[0],caseMode:'lowercase'},['anagram-sequence','text-duplication'],.96,'fitted',0,['Every row is a permutation of the same grapheme multiset.'],'Source index permutations are stored; adaptation resamples their rank order onto the new word.');const last=systems.at(-1);if(last?.operation==='permutation-sequence'){last.indexSchedules=observed.map(word=>{const unused=base.map((_,i)=>i);return chars(word).map(c=>{const k=unused.findIndex(i=>base[i]===c);return unused.splice(k,1)[0]})})}}
 }
 // Compensated erosion: left prefix shrinks, a periodic insertion grows, suffix stays fixed.
 const erosionCandidates=groupsBy(major.filter(e=>{const n=letters(e.text||'').length;return n>=6&&n<=45}),e=>letters(e.text||'').slice(-3));
 for(const group of erosionCandidates.filter(g=>g.length>=3&&g.length<=14)){
  const rows=order(group),texts=rows.map(e=>letters(e.text||''));if(new Set(texts).size<3)continue;const base=chars(texts[0]);let best;
  for(let p=Math.max(2,rows.length-1);p<=base.length-3;p++)for(let period=1;period<=3&&p+period<=base.length-2;period++){
   const prefix=base.slice(0,p),pattern=base.slice(p,p+period),suffix=base.slice(p+period);let error=0;
   for(let step=0;step<texts.length;step++){const inserted=Array.from({length:pattern.length+step},(_,i)=>pattern[i%pattern.length]).join('');const expected=prefix.slice(step).join('')+inserted+suffix.join('');error+=distance(expected,texts[step])/Math.max(1,base.length)}error/=texts.length;
   if(!best||error<best.error)best={p,period,prefix:prefix.join(''),pattern:pattern.join(''),suffix:suffix.join(''),error};
  }
  if(best&&best.error<=.055)emit('compensated-erosion','Prefix erosion with periodic compensation',rows,{prefixLength:best.p,patternLength:best.period,sourceLength:base.length},{sourceInput:texts[0],prefix:best.prefix,pattern:best.pattern,suffix:best.suffix,caseMode:'lowercase'},['compensated-erosion','periodic-insertion','staggered-repetition'],1-best.error,best.error===0?'fitted':'inferred',best.error,['One prefix grapheme is removed at each step.','Exactly one periodic-pattern grapheme is inserted in compensation.','Total grapheme count and the suffix stay constant.'],'The fitted period and protected suffix explain the changing text; source frames retain the observed staircase.');
 }
 // Repetition kernels, including glyph fields. Keep original field positions, not a fixed grid.
 const repeats=groupsBy(major,e=>norm(e.text||''));
 for(const group of repeats.filter(g=>g.length>=2&&g.length<=32)){
  const value=norm(group[0].text||'');if(!value)continue;const rows=order(group),xfit=regression(rows.map(e=>e.bounds.x));
  emit('repeat-field',value.length===1?'Glyph replication field':'Repeated phrase field',rows,{}, {sourceInput:group[0].text,caseMode:group[0].text===group[0].text.toLowerCase()?'lowercase':'keep'},['text-duplication',...(value.length===1?['glyph-repetition']:[]),...(Math.abs(xfit.slope)>.012&&xfit.r2>.9?['staggered-repetition']:[])],.99,'fitted',0,['The same text is repeated across the stored source field.','Relative anchors, rotation and spacing remain a transferable kernel.'],'Observed positions and their repeat count are explicit genome data.');
 }
 // Coupled call-and-response columns. The left/right trajectory may differ.
 for(let i=0;i<repeats.length;i++)for(let j=i+1;j<repeats.length;j++){
  const a=order(repeats[i]),b=order(repeats[j]);if(a.length<3||b.length<3||Math.abs(a.length-b.length)>2)continue;const aa=union(a),bb=union(b);if(Math.abs((aa.y+aa.height/2)-(bb.y+bb.height/2))>.08||Math.abs(aa.x-bb.x)<.22)continue;
  const left=aa.x<bb.x?a:b,right=aa.x<bb.x?b:a;emit('paired-columns','Coupled phrase columns',left.concat(right),{leftCount:left.length,rightCount:right.length,leftStepX:regression(left.map(e=>e.bounds.x)).slope,rightStepX:regression(right.map(e=>e.bounds.x)).slope},{sourceInput:left[0].text+' | '+right[0].text,leftText:left[0].text,rightText:right[0].text},['paired-column-repetition','text-duplication',...(Math.abs(regression(left.map(e=>e.bounds.x)).slope)>.012?['staggered-repetition']:[])],.9,'inferred',0,['Each phrase repeats independently.','The two columns share a vertical rhythm but may have different horizontal trajectories.'],'Two repeated phrase clusters have overlapping vertical ranges and distinct horizontal anchors.');
 }
 // Fitted geometric sequence candidates. Keep proposals distinct from exact text fits.
 let bestStair,bestScale;
 for(let start=0;start<major.length;start++)for(let count=3;count<=Math.min(8,major.length-start);count++){
  const rows=major.slice(start,start+count),h=rows.map(e=>e.bounds.height),x=regression(rows.map(e=>e.bounds.x)),y=regression(rows.map(e=>e.bounds.y));
  if(y.slope<.025||y.slope>.2||y.r2<.94||Math.max(...h)/Math.min(...h)>1.65)continue;
  if(Math.abs(x.slope)>.013&&x.r2>.94&&x.error<.015&&(!bestStair||count>bestStair.rows.length))bestStair={rows,x,y};
  const size=regression(h.map(Math.log));if(Math.abs(size.slope)>Math.log(1.16)&&size.r2>.9&&(!bestScale||count>bestScale.rows.length))bestScale={rows,size};
 }
 if(bestStair)emit('staircase','Progressive baseline staircase',bestStair.rows,{shiftPerStep:bestStair.x.slope,pitch:bestStair.y.slope},{sourceInput:bestStair.rows[0].text},['stepped-alignment','staggered-repetition'],.9,'inferred',1-bestStair.x.r2,['Horizontal displacement follows a fitted linear step.','Baseline pitch remains regular.'],'Linear x/y regression fits an observed type staircase.');
 if(bestScale)emit('scale-ramp','Progressive type-scale ramp',bestScale.rows,{scaleRatio:Math.exp(bestScale.size.slope)},{sourceInput:bestScale.rows[0].text},['scale-ramp'],.82,'inferred',1-bestScale.size.r2,['Approximate observed glyph heights follow a geometric progression.'],'Glyph bounds suggest a scale progression; font ascender differences can confound this proposal.');
 const vertical=major.filter(e=>Math.abs(Math.sin(e.rotation*Math.PI/180))>.94);
 if(vertical.length>=2)emit('rotation-field','Vertical and opposed reading bands',vertical,{baseRotation:vertical[0].rotation,opposed:vertical.some(e=>e.rotation>60)&&vertical.some(e=>e.rotation< -60)?1:0},{sourceInput:vertical[0].text},['vertical-type','alternating-rotation','text-duplication'],.94,'fitted',0,['Stored bands retain physical baseline angles.','Opposed reading directions remain paired.'],'OCR quadrilateral angles identify the vertical reading system.');
 for(const group of repeats.filter(g=>g.length>=2&&g.some(e=>Math.abs(e.rotation)>150)&&g.some(e=>Math.abs(e.rotation)<20)))emit('rotation-field','Half-turn type pairing',group,{opposed:1,baseRotation:0},{sourceInput:group[0].text},['alternating-rotation','text-duplication'],.97,'fitted',0,['A repeated phrase returns through a half turn.'],'The same recognized phrase occurs at approximately 0° and 180°.');
 // Reflow: a complete line also appears split into a compact sequence of lines.
 for(const full of major.filter(e=>letters(e.text||'').length>=8)){
  let found;
  for(let start=0;start<major.length&&!found;start++)for(let n=2;n<=Math.min(5,major.length-start);n++){
   const rows=major.slice(start,start+n);if(rows.includes(full)||union(rows).height>.4||rows.some(e=>Math.abs(e.rotation)>12)||rows.some((e,i)=>i>0&&e.bounds.y-rows[i-1].bounds.y<Math.max(e.bounds.height,rows[i-1].bounds.height)*.48))continue;if(rows.map(e=>letters(e.text||'')).join('')===letters(full.text||'')){found=rows;break}
  }
  if(found)emit('word-reflow','Word-stack reflow',found,{lineCount:found.length},{sourceInput:full.text,lineWordCounts:found.map(e=>(e.text||'').split(/\s+/).length).join(',')},['word-reflow'],.97,'fitted',0,['Word order is retained while line breaks change.'],'An observed line is recovered as an ordered stack elsewhere on the same poster.');
 }
 // Explicitly inspected source evidence that OCR alone cannot establish.
 if(r.id==='b45a978d6dbfc12afd7eccab-p0')emit('reflection','Reflected type group with ink inversion',lines.filter(e=>e.bounds.height>.035),{axisY:.5,invertInk:1},{sourceInput:'HORIZONS | BENOÎT BILLOTTE | MARIE VELARDI',axis:'horizontal'},['reflection','color-inversion','text-duplication'],.97,'visual-annotated',0,['Reflect the complete group about a horizontal axis.','Reverse the group’s vertical order and glyph orientation together.'],'Source inspected visually: the lower group reflects the upper typography, with inverted ink roles. OCR misreads some reflected letters; they are not treated as new words.');
 if(r.id==='69124eff2f134d359b4fc764-p0'){
  const title=lines.find(e=>e.text==='Bibliotopia');if(title)emit('tittle-substitution','Heart tittle substitution',[title],{heartScale:1.5},{sourceInput:'Bibliotopia',target:'last-i'},['tittle-substitution'],.98,'visual-annotated',0,['Replace only the selected i/j tittle, preserving the stem.','The ornament follows glyph position and font size.'],'The final dotted i uses a heart ornament. This is a visually annotated glyph-component rule, not an OCR-only detection.');
  const left=major.filter(e=>norm(e.text||'')==='autour'),right=major.filter(e=>/^de\s+[1l]['’]?\s*amour$/i.test(e.text||''));
  if(left.length>=3&&right.length>=3)emit('paired-columns','Staggered phrase / fixed response columns',left.concat(right),{leftCount:left.length,rightCount:right.length,leftStepX:regression(order(left).map(e=>e.bounds.x)).slope,rightStepX:0},{sourceInput:'autour | de l’amour',leftText:'autour',rightText:'de l’amour',normalizationNote:'OCR 1/l ambiguity checked against source image.'},['paired-column-repetition','staggered-repetition','text-duplication'],.99,'visual-annotated',0,['The left phrase steps right on each baseline.','The right phrase repeats on a fixed alignment.','Both columns retain a coupled vertical rhythm.'],'Source image resolves OCR 1/l ambiguity. The staircase and stationary response are stored separately.');
 }
 // Detect alternating chromatic inks from the measured source scene interpretation.
 const colored=major.map(e=>({e,color:r.genome.elements.find(s=>s.sourceElementID===e.id)?.color})).filter(x=>x.color);
 const hue=hex=>{const n=parseInt(hex.slice(1),16),a=[n>>16&255,n>>8&255,n&255].map(v=>v/255),max=Math.max(...a),min=Math.min(...a),d=max-min;if(d<.12)return null;const h=max===a[0]?(a[1]-a[2])/d:max===a[1]?(a[2]-a[0])/d+2:(a[0]-a[1])/d+4;return((h*60)%360+360)%360};
 if(colored.length>=3&&colored.length<=12){const hs=colored.map(x=>hue(x.color));if(hs.every(x=>x!==null)&&hs.every((x,i)=>i<2||Math.abs(((x-hs[i%2]+540)%360)-180)<25)&&Math.abs(((hs[0]-hs[1]+540)%360)-180)>45)emit('alternating-ink','Alternating ink cycle',colored.map(x=>x.e),{inkPeriod:2},{sourceInput:colored[0].e.text},['alternating-ink'],.84,'inferred',0,['Ink roles alternate with a fitted period.'],'Measured foreground interpretations suggest a two-ink cycle; color extraction is approximate.');}
 scanRows.push({posterID:r.id,elements:r.elements.length,textLines:lines.length,words:words.length,systems:systems.length-before});
 if((posterIndex+1)%100===0)console.log(`Scanned ${posterIndex+1}/${index.posters.length}; ${systems.length} candidate systems`);
}
const summary={scannedPosters:index.posters.length,scannedElements,analyzedLines,analyzedWords,systems:systems.length,exactFits:systems.filter(s=>s.status==='fitted').length,inferred:systems.filter(s=>s.status==='inferred').length,visualAnnotations:systems.filter(s=>s.status==='visual-annotated').length,operatorCounts:Object.fromEntries(operations.map(op=>[op,systems.filter(s=>s.operation===op).length]))};
const catalog={version:'type-system-catalog-v1',createdAt:new Date().toISOString(),featureNames,systems,summary,note:'The entire indexed poster catalog was scanned. Exact text sequence fits, geometric proposals and explicit visual annotations are distinct. These are fitted procedural grammars and descriptive embeddings, not a fine-tuned neural style model. Manual borders and negative labels are preserved.'};
await fs.writeFile(path.join(out,'catalog-draft.json'),JSON.stringify(catalog,null,2)+'\n');await fs.writeFile(path.join(out,'scan-coverage.json'),JSON.stringify(scanRows,null,2)+'\n');await fs.writeFile(path.join(out,'scan-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(summary);
