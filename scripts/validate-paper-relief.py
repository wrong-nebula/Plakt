from pathlib import Path
from urllib.parse import urlparse,unquote
from PIL import Image
import json,hashlib,subprocess
root=Path(__file__).resolve().parent.parent;out=root/'output/paper-relief-v1'
evidence=json.loads((out/'source-evidence.json').read_text());source=Path(unquote(urlparse(evidence['source']['evidenceURL']).path));assert hashlib.sha256(source.read_bytes()).hexdigest()==evidence['source']['sourceImageSHA256']
recipe=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/PaperReliefRecipes.json').read_text())[0]
scene=json.loads((out/'specimens/neubad-default/genome.json').read_text());parent=next(e for e in scene['elements'] if e.get('paperRelief'));paper=parent['paperRelief'];ids={s['id'] for s in paper['surfaces']};assert len(ids)==len(paper['surfaces'])
assert abs(paper['aspect']-10/7)<1e-10
children=[e for e in scene['elements'] if e.get('paperAttachment')]
assert all(e['paperAttachment']['parentID']==parent['sourceElementID'] and e['paperAttachment']['surfaceID'] in ids for e in children)
kinds={k:sum(s['kind']==k for s in paper['surfaces']) for k in ['panel','flap','recess','hole','disc']};assert all(kinds.values())
counts={};hashes=set();layouts=set();candidates=0
for study in ['generations','proportion-refinement']:
 for p in sorted((out/study).glob('*/round-*/round.json')):
  d=json.loads(p.read_text());assert len(d['candidates'])==6
  assert {c['id'] for c in d['candidates']}=={r['id'] for r in d['judging']['results']}
  assert d['winnerID'] in [c['id'] for c in d['candidates']]
  counts[study]=counts.get(study,0)+1
  for c in d['candidates']:
   candidates+=1;hashes.add(c['pixelSHA256']);layouts.add(int(c['parameters']['layout']))
   for k in ['imageURL','genomeURL','presetURL']:assert Path(unquote(urlparse(c[k]).path)).exists()
assert all(n==8 for n in counts.values()) and layouts=={0,1,2}
full=(out/'full-native-checks-final.log').read_text();assert 'all 30 check groups' in full
shapes=(out/'shape-library-checks-final.log').read_text();assert '56 unique shape renders' in shapes and 'aspect-preserving placement' in shapes
ui=json.loads((out/'native-ui-preset.json').read_text());assert ui['relief']['title']=='CUT / FOLD' and ui['parameters']['layout']==1 and ui['parameters']['foldAngle']==35
pdfs=[]
for p in sorted((out/'specimens').glob('*/poster.pdf')):
 result=subprocess.run(['/opt/local/bin/pdfimages','-list',str(p)],text=True,capture_output=True,check=True)
 assert not [l for l in result.stdout.splitlines() if l.strip() and l.split()[0].isdigit()];pdfs.append(dict(specimen=p.parent.name,rasterImages=0))
emb=json.loads((out/'embeddings/embeddings.json').read_text());assert len(emb)==1 and emb[0]['recipeID']==recipe['id']
items=json.loads((out/'gallery-data.json').read_text())
for item in items:
 for key in ['image','preset','genome','pdf','record','reference']:
  if key in item:assert (out/item[key]).exists()
replays=[]
for name,base in [('current',out/'proportion-refinement/paper-relief-composition'),('legacy',out/'generations/paper-relief-composition')]:
 path=out/'replay'/name/'poster.png'
 if path.exists():
  a=Image.open(base/'winner.png').convert('RGBA');b=Image.open(path).convert('RGBA');assert a.size==b.size and a.tobytes()==b.tobytes(),name
  replays.append(dict(generation=name,exactPixelReplay=True,width=a.width,height=a.height))
value=dict(version='paper-relief-validation-v1',sourceChecksumMatches=True,surfaceKinds=kinds,surfaceCount=len(ids),attachedTextCount=len(children),intrinsicAspect=paper['aspect'],generationRounds=counts,candidateInstances=candidates,distinctPreviews=len(hashes),layoutsExercised=sorted(layouts),nativeChecks=shapes.strip().splitlines(),fullNativeChecks='All 30 check groups passed',nativeUI='Changed surface title, flap angle and layout; confirmed live preview; saved CUT / FOLD preset.',vectorPDFChecks=pdfs,visionEmbeddingDimensions=emb[0]['vision']['dimensions'],galleryEntries=len(items),galleryResourcesResolve=True,winnerReplayChecks=replays,userTasteVotesCreated=0,note='Source geometry is an authored interpretation. The first generation batch exposed field-induced squashing; proportion-refinement preserves intrinsic paper aspect. Legacy genomes retain their original field fit. Jury ranks remain diagnostic preferences.')
value['previewBuild']='development';value['regressionBuild']='release'
if (out/'surface-genomes.json').exists():
 surfaceData=json.loads((out/'surface-genomes.json').read_text());value['surfaceDescriptorCount']=len(surfaceData['surfaces']);value['surfaceDescriptorDimensions']=len(surfaceData['featureNames'])
(out/'validation.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');print(json.dumps(value,ensure_ascii=False,indent=2))
