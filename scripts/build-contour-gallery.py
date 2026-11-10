from pathlib import Path
from urllib.parse import urlparse,unquote
import json,os,math
root=Path(__file__).resolve().parent.parent;out=root/'output/contour-systems-v1'
recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/ContourRecipes.json').read_text());lookup={r['id']:r for r in recipes}
def rel(p):return os.path.relpath(p,out)
def local(u):return Path(unquote(urlparse(u).path)) if u.startswith('file:') else Path(u)
items=[];groups={}
for recipe in recipes:
 id=recipe['id'];d=out/'embeddings'
 if (d/(id+'.png')).exists():items.append(dict(kind='default',recipe=id,name=recipe['name'],image=rel(d/(id+'.png')),preset=rel(d/(id+'-preset.json')),genome=rel(d/(id+'-scene.json')),pdf=rel(d/(id+'.pdf')),mode='Source-inspired default',rank=0))
for r in recipes:
 d=out/'source-proofs'/r['id']
 if (d/'poster.png').exists():
  preset=json.loads((out/'embeddings'/(r['id']+'-preset.json')).read_text());preset['contour']=dict(version='contour-customization-v1',secondaryInk='#ed9d7a' if r['id'].endswith('letter-channels') else '#eeeae1');(d/'preset.json').write_text(json.dumps(preset,indent=2)+'\n')
  items.append(dict(kind='proof',recipe=r['id'],name=r['name']+' / color proof',image=rel(d/'poster.png'),preset=rel(d/'preset.json'),genome=rel(d/'genome.json'),pdf=rel(d/'poster.pdf'),mode='Full-poster source proportions',rank=0))
for p in sorted((out/'specimens').glob('*/preset.json')):
 d=json.loads(p.read_text());items.append(dict(kind='specimen',recipe=d['recipe']['id'],name=p.parent.name,image=rel(p.parent/'poster.png'),preset=rel(p),genome=rel(p.parent/'genome.json'),pdf=rel(p.parent/'poster.pdf'),mode='Controlled variant',rank=0))
for p in sorted(list((out/'generations').glob('*/round-*/round.json'))+list((out/'type-refinement').glob('*/round-*/round.json'))):
 d=json.loads(p.read_text());results={x['id']:x for x in d['judging']['results']}
 for c in d['candidates']:
  result=results[c['id']];key=(c['recipeID'],c['mode']);groups.setdefault(key,{})
  item=dict(kind='generation',recipe=c['recipeID'],name=f"Round {d['round']+1} / {c['id']}",mode=c['mode'],rank=result['rank'],winner=c['id']==d['winnerID'],image=rel(local(c['imageURL'])),preset=rel(local(c['presetURL'])),genome=rel(local(c['genomeURL'])),record=rel(p),candidate=c,result=result,weights={k:v for k,v in d['weights'].items() if k!='Diversity'})
  items.append(item)
  if not ((out/'type-refinement/manifest.json').exists() and c['recipeID']=='contour-letter-channels' and p.is_relative_to(out/'generations')):groups[key].setdefault(c['pixelSHA256'],item)
selected=[]
for key,unique in sorted(groups.items()):
 entries=list(unique.values());weights=entries[-1]['weights'];n=len(entries)
 for e in entries:e['ballots']={}
 for judge,weight in weights.items():
  if weight<=0 or not all(math.isfinite(e['result']['scores'].get(judge,float('nan'))) for e in entries):continue
  for e in entries:
   score=e['result']['scores'][judge];worse=sum(x['result']['scores'][judge]<score-1e-9 for x in entries);ties=sum(abs(x['result']['scores'][judge]-score)<1e-9 for x in entries)
   e['ballots'][judge]=(worse+(ties-1)/2)/(n-1) if n>1 else .5
 for e in entries:
  total=sum(weights[k] for k in e['ballots']);e['contextConsensus']=100*sum(v*weights[k] for k,v in e['ballots'].items())/total if total else 0
 entries.sort(key=lambda e:(-e['contextConsensus'],e['candidate']['seed'],e['name']))
 best=dict(entries[0]);best['kind']='context';best['name']=lookup[key[0]]['name'];best['cohortSize']=n;selected.append(best)
items+=selected
(out/'context-winners.json').write_text(json.dumps(dict(note='Borda within each recipe/context after pixel deduplication; Diversity excluded across rounds. Diagnostic ranks, not new taste labels or objective quality.',selections=selected),ensure_ascii=False,indent=2)+'\n')
for item in items:
 r=lookup[item['recipe']];item.update(logic=r['logic'],tags=r['tags'],reference=rel(local(r['references'][0]['evidenceURL'])))
(out/'systems.json').write_text(json.dumps(recipes,ensure_ascii=False,indent=2)+'\n')
(out/'gallery-data.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')
encoded=json.dumps(items,ensure_ascii=False).replace('</','<\\/')
page='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contour systems</title><style>
*{box-sizing:border-box}body{margin:0;color:#202322;background:#e8e4da;font-family:system-ui,sans-serif}header,main,footer{padding:32px 4vw}h1{font-size:clamp(36px,7vw,82px);line-height:1.02;letter-spacing:-.055em;max-width:900px}header p{max-width:850px;line-height:1.6}.controls{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:24px}label{display:grid;gap:6px;font-size:13px}select{font:inherit;padding:10px;background:#f7f3ea;color:inherit;border:1px solid #aaa}#grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}article{background:#f7f3ea;border:1px solid #cdc8bd}.figure{height:500px;background:#ddd9cf;display:grid;place-items:center;padding:16px}.figure img{width:100%;height:100%;object-fit:contain}.body{padding:20px}h2{font-size:20px}p{line-height:1.5}a{color:inherit;text-underline-offset:3px}.links{display:flex;flex-wrap:wrap;gap:14px;font-size:14px}.tag{font-size:12px;color:#666}summary{cursor:pointer}#count{align-self:center;font-size:13px}@media(max-width:1050px){#grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){#grid{grid-template-columns:1fr}header,main,footer{padding:24px}.figure{height:460px}}</style><header><p>Procedural vector systems · RKC / Expérience Collective</p><h1>Letters become channels.<br>Profiles become fields.</h1><p>Two source-inspired defaults, with editable glyphs, protected counters, custom silhouettes and outward expansion. Constant-distance offsets and recursive scaling remain distinct operations.</p><p>Generation runs use existing poster compositions and judges. Rankings are relative preferences; no user taste votes or training labels are created.</p></header><main><div class="controls"><label>Show<select id="view"><option value="curated">Defaults and controlled variants</option><option value="context">Winners by context</option><option value="winners">All round winners</option><option value="all">All generation candidates</option></select></label><label>System<select id="recipe"><option value="">Both systems</option></select></label><span id="count" aria-live="polite"></span></div><div id="grid"></div></main><footer><a href="systems.json">Construction rules</a> · <a href="context-winners.json">Context ballots</a> · <a href="validation.json">Validation</a> · <a href="embeddings/embeddings.json">Native Vision embeddings</a><p>Original source vectors and exact transform values are unknown. Defaults are authored interpretations of the complete references; no source crops appear here.</p></footer><script id="data" type="application/json">'''+encoded+'''</script><script>
const items=JSON.parse(document.getElementById('data').textContent),grid=document.getElementById('grid'),view=document.getElementById('view'),recipe=document.getElementById('recipe');function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n}for(const i of items.filter(x=>x.kind==='default')){const o=node('option',i.name);o.value=i.recipe;recipe.append(o)}function link(label,path){const a=node('a',label);a.href=path;return a}function render(){grid.replaceChildren();const shown=items.filter(x=>(!recipe.value||x.recipe===recipe.value)&&(view.value==='curated'?['default','proof','specimen'].includes(x.kind):view.value==='context'?x.kind==='context':view.value==='winners'?x.kind==='generation'&&x.winner:x.kind==='generation'));document.getElementById('count').textContent=shown.length+' outputs';for(const i of shown){const card=node('article'),figure=node('div');figure.className='figure';const img=node('img');img.src=i.image;img.alt=i.name;img.loading='lazy';figure.append(img);const b=node('div');b.className='body';b.append(node('h2',i.name),node('p',i.mode+(i.kind==='generation'?' · rank '+i.rank:'')));const d=node('details');d.append(node('summary','Construction and reference'),node('p',i.logic),link('Open complete reference',i.reference));b.append(d);const links=node('p');links.className='links';links.append(link('Preset',i.preset),link('Editable genome',i.genome));if(i.pdf)links.append(link('Vector PDF',i.pdf));if(i.record)links.append(link('Round scores',i.record));const tags=node('p',i.tags.join(' · '));tags.className='tag';b.append(links,tags);card.append(figure,b);grid.append(card)}}view.onchange=recipe.onchange=render;render();</script>'''
(out/'gallery.html').write_text(page)
print(len(items),'gallery entries;',len(selected),'context winners')
