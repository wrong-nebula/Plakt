from pathlib import Path
from urllib.parse import urlparse,unquote
from PIL import Image
from html.parser import HTMLParser
import json,hashlib,math
root=Path(__file__).resolve().parent.parent;out=root/'output/library-shape-survey-v2'
recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json').read_text());ids={r['id'] for r in recipes};assert len(ids)==14
hash_file=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest=json.loads((root/'output/library-shape-survey-v1/manifest.json').read_text());sources={r['id']:r for r in manifest}
for r in recipes:
 ref=r['references'][0];assert hash_file(sources[ref['posterID']]['image'])==ref['sourceImageSHA256']
 assert all(p['min']<=p['value']<=p['max'] for p in r['parameters'])
 for i in range(4):
  folder=out/'specimens'/r['id']/f'v{i}'
  for name in ['poster.png','poster.pdf','genome.json','preset.json']:assert (folder/name).stat().st_size>100
  Image.open(folder/'poster.png').verify()
emb=json.loads((out/'embeddings/survey-embeddings.json').read_text());assert {e['recipeID'] for e in emb}==ids
assert all(e['vision']['dimensions']==768 and len(e['descriptor'])==10 for e in emb)
def local(url):return Path(unquote(urlparse(url).path))
counts={};all_hashes=set();donors=set();changed=[]
for study,expected in [('pilot',112),('generations',672),('echo-refinement',48)]:
 count=0;rounds=0;unique=set()
 for p in sorted((out/study).glob('survey-*/round-*/round.json')):
  d=json.loads(p.read_text());rounds+=1;candidate_ids={c['id'] for c in d['candidates']};assert {c['id'] for c in d['judging']['results']}==candidate_ids
  assert d['winnerID'] in candidate_ids
  for c in d['candidates']:
   image=local(c['imageURL']);Image.open(image).verify();assert hash_file(image)==c['pixelSHA256']
   for key in ['genomeURL','presetURL']:json.loads(local(c[key]).read_text())
   count+=1;unique.add(c['pixelSHA256']);donors.update(c['donors'])
   if 'changedPixelFraction' in c:changed.append(c['changedPixelFraction'])
 assert count==expected,(study,count)
 all_hashes.update(unique);counts[study]=dict(candidateInstances=count,rounds=rounds,uniquePreviewFiles=len(unique))
 for row in json.loads((out/study/'manifest.json').read_text()):assert Path(row['image']).exists()
contexts=json.loads((out/'context-winners.json').read_text())['selections'];assert len(contexts)==42;assert len({(s['recipeID'],s['mode']) for s in contexts})==42
page=(out/'gallery.html').read_text();data=json.loads(page.split('<script type="application/json" id="data">')[1].split('</script>')[0]);assert len(data)==776
for item in data:
 for key in ['image','genome','preset','pdf','reference','record']:
  if key in item:assert (out/unquote(item[key])).exists(),item[key]
 for path in item.get('variantImages',[]):assert (out/path).exists(),path
checks=(out/'full-native-checks.log').read_text();final=(out/'final-shape-checks.log').read_text();assert 'PASS: all 30 check groups' in checks and '53 unique shape renders' in final
base=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/catalog.json').read_text())
validation=dict(version='extended-shape-survey-v3',systems=dict(surveyRecipes=14,newPreviouslyProposedSystems=6,spatialTypographySystems=3,wholePosterGeometrySystems=11,currentSharedBaseRecipes=len(base['recipes']),combinedSharedSourceRecipes=len(base['recipes'])+14,isolatedPreviewRecipes=53),defaultPolicy='Canonical reference topology/proportions first; creative departures require explicit variation.',corrections=['Scalloped poster is editable F U / B U typography, not a generic frame.','Wireframe reference supports broad stacked volumes; displaced slices are an extension disabled by default.'],specimens=dict(sourceAlignedDefaults=14,parameterAndFontPreviews=56,declaredParameters=sum(len(r['parameters']) for r in recipes),sourceHashesVerified=True),generationRuns=counts,totalCandidateInstances=sum(c['candidateInstances'] for c in counts.values()),distinctPreviewHashesAcrossRuns=len(all_hashes),uniqueSourceDonorIDs=len(donors),contextSelections=42,embeddings=dict(shapes=14,visionDimensions=768,descriptorDimensions=10,model='Apple-Vision-image-feature-print revision 2',geometryDescriptors='authored, not trained'),checks=dict(fullNativeSuite='30 groups passed after source-default/FUBU changes',finalShapeSuite='53 unique renders; parameter effects, seed replay, fonts, semantic text, image-module checksums, material staging and whole-poster eligibility passed after the final echo refinement',gallery='776 entries: 14 defaults + 720 generated cases + 42 context selections; local links verified; Node VM filters and variant links passed'),nativeUI=dict(FUBUDefaultVerified=True,scallopDepthIncrementAndReset=[.035,.036,.035],orbDisplacementDefault=0,orbGapDefault=0,orbStackDefault=3,preview='dist/shape-systems-preview/PosterLab Shape Systems.app'),limitations=['Generation juries still favor a few strong input photographs; separate context cohorts expose rather than conceal that bias.','Defaults are visually calibrated procedural interpretations; the original designers algorithms are unknown.','Full native verification uses the isolated stable snapshot and intentionally excludes ongoing SAM/SigLIP code.','Historical pilot/prototype images remain evidence of prior renderer versions; current preset/genome replay is the verified scope.'],preservation=dict(noLibraryRecordWrites=True,noSemanticOrSegmentationWrites=True,noSyntheticTasteVotes=True,noModelTraining=True,mainAppNotReplaced=True,cacheCleanup='Only this session image-module-cache was removed after disk exhaustion; exported source and generated studies retained.'))
(out/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
class StaticLinks(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for key,value in attrs:
   if key in ['src','href'] and value and not value.startswith(('#','https:','http:')):assert (out/unquote(value)).exists(),value
StaticLinks().feed(page)
print(json.dumps(dict(total=validation['totalCandidateInstances'],runs=counts,distinctHashes=len(all_hashes),donors=len(donors),galleryEntries=len(data),verified=True),indent=2))
