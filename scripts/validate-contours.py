from pathlib import Path
from urllib.parse import urlparse,unquote
import json,hashlib,subprocess
root=Path(__file__).resolve().parent.parent;out=root/'output/contour-systems-v1'
evidence=json.loads((out/'source-evidence.json').read_text());sourceChecks=[]
for r in evidence['sources']:
 p=Path(unquote(urlparse(r['evidenceURL']).path));ok=hashlib.sha256(p.read_bytes()).hexdigest()==r['sourceImageSHA256'];assert ok;sourceChecks.append(dict(posterID=r['posterID'],checksumMatches=ok))
recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/ContourRecipes.json').read_text());assert len(recipes)==2 and len(set(r['id'] for r in recipes))==2
emb=json.loads((out/'embeddings/embeddings.json').read_text());assert {e['recipeID'] for e in emb}=={r['id'] for r in recipes}
rounds=[];hashes=set();counts={}
for study in ['generations','type-refinement']:
 for p in sorted((out/study).glob('*/round-*/round.json')):
  d=json.loads(p.read_text());assert len(d['candidates'])==6
  assert set(x['id'] for x in d['candidates'])==set(x['id'] for x in d['judging']['results'])
  assert d['winnerID'] in [x['id'] for x in d['candidates']]
  for c in d['candidates']:
   for key in ['imageURL','genomeURL','presetURL']:assert Path(unquote(urlparse(c[key]).path)).exists()
   assert 0<=c['changedPixelFraction']<=1;hashes.add(c['pixelSHA256'])
  counts[study+'/'+d['recipeID']]=counts.get(study+'/'+d['recipeID'],0)+1;rounds.append(d)
assert all(n==8 for n in counts.values())
ui=json.loads((out/'native-ui-preset.json').read_text());assert ui['contour']['text']=='B8O' and ui['contour']['secondaryInk']=='#efa78b' and ui['parameters']['construction']==0
pdf=[]
for r in recipes:
 p=out/'source-proofs'/r['id']/'poster.pdf';result=subprocess.run(['/opt/local/bin/pdfimages','-list',str(p)],capture_output=True,text=True,check=True)
 images=[l for l in result.stdout.splitlines() if l.strip() and l.split()[0].isdigit()];assert not images;pdf.append(dict(recipeID=r['id'],rasterImages=0))
log=(out/'shape-library-checks-final.log').read_text();assert '55 unique shape renders' in log
full=(out/'full-native-checks-final.log').read_text();assert 'all 30 check groups' in full
value=dict(version='contour-validation-v1',sourceChecks=sourceChecks,recipeCount=2,generationRounds=counts,candidateInstances=sum(len(r['candidates']) for r in rounds),distinctPreviews=len(hashes),nativeShapeChecks=log.strip().splitlines(),fullNativeChecks='All 30 check groups passed',vectorPDFChecks=pdf,nativeUI='Editable B8O, font/reference switch, expansion step, second ink, mode-specific controls, save/reopen verified in separate native preview.',visionEmbeddingCount=len(emb),userTasteVotesCreated=0,note='Baseline type generations exposed source-glyph substitution and arbitrary word breaking; type-refinement exercises their correction. Old presets/genomes remain archived as diagnostic evidence. Source defaults are authored interpretations, not recovered original vectors.')
from PIL import Image
replays=[]
for name,base in [('letter',out/'type-refinement/contour-letter-channels'),('profile',out/'generations/contour-profile-channels')]:
 replay=out/'replay'/(name+'-1600')/'poster.png'
 if replay.exists():
  a=Image.open(base/'winner.png').convert('RGBA');b=Image.open(replay).convert('RGBA');assert a.size==b.size and a.tobytes()==b.tobytes();replays.append(dict(system=name,exactPixelReplay=True,width=a.width,height=a.height))
value['winnerReplayChecks']=replays
if (out/'gallery-data.json').exists():
 items=json.loads((out/'gallery-data.json').read_text())
 for item in items:
  for key in ['image','preset','genome','pdf','record','reference']:
   if key in item:assert (out/item[key]).exists()
 value['galleryEntries']=len(items);value['galleryResourcesResolve']=True
(out/'validation.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');print(json.dumps(value,ensure_ascii=False,indent=2))
