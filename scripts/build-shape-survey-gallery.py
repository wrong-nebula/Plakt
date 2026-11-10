from pathlib import Path
from PIL import Image,ImageDraw
import json,html,os,hashlib
root=Path(__file__).resolve().parent.parent;out=root/'output/library-shape-survey-v1'
recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json').read_text())
manifest=json.loads((out/'manifest.json').read_text());systems=json.loads((out/'systems.json').read_text())
lookup={r['id']:r for r in manifest}
for chunk in range(2):
 sheet=Image.new('RGB',(1440,1680),'#dedbd3');draw=ImageDraw.Draw(sheet)
 for row,r in enumerate(recipes[chunk*4:chunk*4+4]):
  for col in range(3):
   im=Image.open(out/'variants'/r['id']/f'v{col}'/'poster.png').convert('RGB');im.thumbnail((460,380));x=col*480+(480-im.width)//2;y=row*420;sheet.paste(im,(x,y));draw.text((col*480+12,y+385),r['name']+' / '+str(col),fill='black')
 sheet.save(out/f'variation-contact-{chunk+1}.jpg',quality=92)
sheet=Image.new('RGB',(1600,900),'#dedbd3');draw=ImageDraw.Draw(sheet)
for n,r in enumerate(recipes):
 im=Image.open(out/'embeddings'/(r['id']+'.png')).convert('RGB');im.thumbnail((380,380));x=n%4*400+(400-im.width)//2;y=n//4*450;sheet.paste(im,(x,y));draw.text((n%4*400+12,y+390),r['name'],fill='black')
sheet.save(out/'new-shapes.jpg',quality=94)
escape=html.escape
cards=[]
for r,system in zip(recipes,systems['recipes']):
 id=r['id'];images=[f'embeddings/{id}.png']+[f'variants/{id}/v{v}/poster.png' for v in range(3)]
 sources=' · '.join(f'<a href="{escape(os.path.relpath(lookup[ref["posterID"]]["image"],out))}">Poster {lookup[ref["posterID"]]["index"]}</a>' for ref in r['references'])
 opts=''.join(f'<option value="{i}">{escape(label)}</option>' for i,label in enumerate(['Neutral shape','Font pairing · seed 817','Variation · seed 818','Variation · seed 819']))
 parameters=''.join(f'<li>{escape(p["label"])}: {p["min"]}–{p["max"]}</li>' for p in r['parameters'])
 tags=' '.join(r['tags']);search=escape(r['name']+' '+r['group']+' '+tags)
 recommendation=' <span class="pick">Priority to explore</span>' if id in ['survey-tunnel','survey-dendrite','survey-tension-web'] else ''
 cards.append(f'''<article data-search="{search}" data-images='{escape(json.dumps(images),quote=True)}'>
 <div class="figure"><img src="{images[0]}" alt="{escape(r['name'])}, native vector specimen" loading="lazy"></div>
 <div class="body"><p class="group">{escape(r['group'])}{recommendation}</p><h2>{escape(r['name'])}</h2>
 <label>View <select>{opts}</select></label><p>{escape(r['logic'])}</p><p class="tags">{escape(tags)}</p>
 <details><summary>Controls and composition rule</summary><ul>{parameters}</ul><p>Candidate type zones: {escape(', '.join(system['composition']['preferredTypeZones']))}.</p><p>Possible interactions: {escape(', '.join(system['composition']['interactionModes']))}. These are composition specifications, not automatic type-flow behavior.</p></details>
 <p class="links"><a class="preset" href="embeddings/{id}-preset.json">Preset JSON</a> · <a class="pdf" href="variants/{id}/v0/poster.pdf">Vector PDF</a></p>
 <p class="sources">Complete source posters: {sources}</p></div></article>''')
future=''.join(f'<li><strong>{escape(f["id"].replace("-"," ").capitalize())}</strong> — {escape(f["logic"])}</li>' for f in systems['futureSystems'])
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shape systems · Library survey</title>
<style>:root{color-scheme:light;font:16px/1.55 system-ui,sans-serif;color:#252821;background:#e7e5dd}*{box-sizing:border-box}body{margin:0}header,main,footer{max-width:1480px;margin:auto;padding:32px}header{padding-top:64px;max-width:1000px;margin-left:max(0px,calc((100vw - 1480px)/2))}h1{font-size:clamp(36px,5vw,68px);letter-spacing:-.05em;line-height:1.06;margin:16px 0 24px}h2{font-size:24px;letter-spacing:-.025em;margin:4px 0 18px}.eyebrow,.group{font-size:12px;text-transform:uppercase;letter-spacing:.08em}.intro{font-size:20px;max-width:780px}.toolbar{display:flex;align-items:center;gap:20px;margin:0 0 24px;flex-wrap:wrap}input,select{font:inherit;color:inherit;padding:10px 12px;border:1px solid #a5a69d;background:#f4f1e9;border-radius:6px}input{width:min(500px,100%)}input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #315949;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}article{background:#f5f2ea;border:1px solid #d3d1c7;border-radius:10px;overflow:hidden}.figure{background:#eeeae1;aspect-ratio:1;display:grid;place-items:center}.figure img{width:100%;height:100%;object-fit:contain}.body{padding:22px}.body p{font-size:14px}.body .group{font-size:11px}.tags,.sources{color:#606456}.pick{display:block;color:#315949;font-weight:700;margin-top:5px}label{display:block}select{width:100%;margin-top:6px}a{color:#235945;text-underline-offset:3px}summary{cursor:pointer;font-size:14px;font-weight:600}details ul{font-size:13px;padding-left:20px}.future{max-width:900px;margin:60px 0 0}.future li{margin:16px 0}footer{font-size:13px;color:#606456}article[hidden]{display:none}@media(max-width:1050px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){header,main,footer{padding:22px}.grid{grid-template-columns:1fr}.intro{font-size:17px}}</style>
<header><p class="eyebrow">Library study · 8 November 2026</p><h1>Eight new ways<br>to build a shape.</h1><p class="intro">1,130 posters reviewed across 12 contact sheets. 18 leads enlarged. Eight native vector recipes, each with editable controls, source evidence and a reusable construction rule.</p><p>My strongest starting points: the shared-anchor web, branching molecule and perspective tunnel. They offer useful relationships with type, beyond a decorative silhouette.</p><p>These are shape specimens, not finished poster designs. The native Shape library provides live parameter sliders, font pairing, preset saving and generation pinning.</p></header>
<main><div class="toolbar"><label for="search">Find a shape or technique</label><input id="search" type="search" placeholder="Branching, perspective, counterform…"><span id="count" aria-live="polite">8 recipes</span></div><div class="grid">'''+''.join(cards)+'''</div><section class="future"><h2>Six systems worth developing next</h2><p>Source-backed specifications, not implemented generators in this study.</p><ul>'''+future+'''</ul><p><a href="systems.json">Composition specifications and source indices</a> · <a href="manifest.json">Full census and checksums</a> · <a href="validation.json">Verification scope</a></p></section></main><footer>Visual interpretation and authored algorithms; original construction methods are unknown. Descriptors and font targets are authored heuristics. Vision embeddings describe the rendered specimens. No model training, personal votes or source-library writes.</footer>
<script>
const cards=[...document.querySelectorAll('article')];
const search=document.getElementById('search'),count=document.getElementById('count');
search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let total=0;for(const card of cards){card.hidden=!card.dataset.search.toLowerCase().includes(q);if(!card.hidden)total++;}count.textContent=total+' recipe'+(total===1?'':'s');});
for(const card of cards){const select=card.querySelector('select');select.addEventListener('change',()=>{const i=Number(select.value),images=JSON.parse(card.dataset.images);card.querySelector('img').src=images[i];const id=images[0].split('/').pop().replace('.png','');card.querySelector('.preset').href=i===0?'embeddings/'+id+'-preset.json':'variants/'+id+'/v'+(i-1)+'/preset.json';card.querySelector('.pdf').href='variants/'+id+'/v'+Math.max(0,i-1)+'/poster.pdf';});}
</script></html>'''
(out/'gallery.html').write_text(page)
print('Wrote gallery and three contact sheets')
