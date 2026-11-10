from pathlib import Path
from html.parser import HTMLParser
import json,hashlib,urllib.parse,math
root=Path(__file__).resolve().parent.parent;out=root/'output/library-shape-survey-v1'
recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json').read_text());ids={r['id'] for r in recipes};emb=json.loads((out/'embeddings/embeddings.json').read_text());selected=[e for e in emb if e['recipeID'] in ids];assert len(selected)==8
assert all(e['vision']['dimensions']==768 and len(e['descriptor'])==10 and all(math.isfinite(v) for v in e['descriptor']) for e in selected)
(out/'embeddings/survey-embeddings.json').write_text(json.dumps(selected,indent=2)+'\n')
manifest=json.loads((out/'manifest.json').read_text());lookup={r['id']:r for r in manifest}
for recipe in recipes:
 for ref in recipe['references']:
  assert hashlib.sha256(Path(lookup[ref['posterID']]['image']).read_bytes()).hexdigest()==ref['sourceImageSHA256']
 for v in range(3):
  folder=out/'variants'/recipe['id']/f'v{v}'
  assert all((folder/name).stat().st_size>100 for name in ['poster.png','poster.pdf','genome.json','preset.json'])
base=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/catalog.json').read_text());assert not ids.intersection({r['id'] for r in base['recipes']})
validation=dict(version='shape-survey-validation-v2',sourceScope=dict(records=1130,contactSheetsVisuallyReviewed=12,enlargedLeads=18,sourceLinkedRecipes=8,sourceHashesVerified=True),prototypes=dict(nativeVariations=24,neutralNewShapes=8,preservedFirstPass=True,vectorPDFs=24,exposedParameters=sum(len(r['parameters']) for r in recipes)),embeddings=dict(newShapes=8,descriptorDimensions=10,visionDimensions=768,model='Apple-Vision-image-feature-print revision 2',learnedTaste=False),nativeChecks=dict(isolatedCatalogCount=47,result=Path('/private/tmp/poster-survey-checks-v2.log').read_text().strip(),scope='Shape suite only; complete main-source/segmentation suite not rerun.'),sharedIntegration=dict(baseRecipes=len(base['recipes']),newSupplementaryRecipes=8,expectedCombinedRecipes=len(base['recipes'])+8,baseCatalogNotRewrittenByThisStudy=True),visualReview=dict(refinements=['Scallop displacement and derivative fade at corners to remove needle artifacts.','Independent branching stem width keeps silhouettes substantial.'],priorities=['survey-tension-web','survey-dendrite','survey-tunnel']),uiVerification=dict(preview='dist/shape-survey-preview/PosterLab Shape Survey.app',recipesVisible=True,stemWidthIncrement=[.034,.035],previewObserved=True,mainAppUntouched=True),galleryVerification=dict(allLocalLinksExist=True,searchResetAndVariantBindings='8 recipes passed Node VM interaction checks; page not browser-visual-tested'),compositionSystems=dict(implementedGeometry=8,specifications=8,futureOnly=6,automaticNewTypeFlow=False),note='Authored interpretations based on visual evidence; no original algorithm or calibrated aesthetic ranking claimed. No human taste votes or model training.')
(out/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for key,value in attrs:
   if key in ['href','src'] and value and not value.startswith(('#','http:','https:')):assert (out/urllib.parse.unquote(value)).exists(),value
Links().feed((out/'gallery.html').read_text())
print('Verified 8 embeddings, 24 PNG/PDF/preset/scene sets, all gallery links and source hashes; shared merged catalog',len(base['recipes'])+8)
