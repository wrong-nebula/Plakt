"""Type-as-material modes and finishing fields for six survey systems. Run after add-survey-variations.py.
Defaults are off, so the canonical construction and saved genomes are unchanged."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent;path=root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json';recipes=json.loads(path.read_text())
def p(id,label,v,lo,hi,step=.001):return dict(id=id,label=label,value=v,min=lo,max=hi,step=step)
spec={
 'survey-faceted-spire':([p('finType','Title engraved along the fins',0,0,1,1)],
  'Type mode engraves the poster title along both outer fins, letter tops toward the edge, in a lighter or darker tone of the ink.'),
 'survey-sliced-orb':([p('surfaceType','Title printed round the volumes',0,0,1,1)],
  'Type mode prints the title round every slice of the volumes, foreshortened toward the rims like print on a globe, barrel or lens.'),
 'survey-gravity-drips':([p('letters','Pools from the title letters',0,0,1,1)],
  "Type mode replaces the pools with the title's own letters, each bleeding streams from its lower edges in its own ink."),
 'survey-bilateral-soft-cross':([p('outlineType','Title round the outline',0,0,1,1)],
  'Type mode runs the title clockwise just outside the silhouette, tops outward, in the lobe ink.'),
 'survey-portal-type':([p('fade','Depth fade',0,0,1)],
  'Depth fade lets deeper rings recede toward the paper.'),
 'survey-module-substitution':([p('sizeField','Module size: even / photo / radial / diagonal',0,0,3,1)],
  "A size field scales the modules: by a photo's darkness, turning it into a glyph halftone, or by a radial or diagonal ramp."),
}
for r in recipes:
 if r['id'] not in spec:continue
 params,logic=spec[r['id']];ids={x['id'] for x in params}
 r['parameters']=[x for x in r['parameters'] if x['id'] not in ids]+params
 if logic not in r['logic']:r['logic']=r['logic'].rstrip()+' '+logic
 assert all(x['min']<=x['value']<=x['max'] for x in r['parameters']),r['id']
path.write_text(json.dumps(recipes,indent=2,ensure_ascii=False)+'\n')
(root/'output/library-shape-survey-v2/canonical-defaults.json').write_text(json.dumps(dict(policy='Source matching is the default; deformation is opt-in.',recipes=[dict(id=r['id'],canonicalPosterID=r['references'][0]['posterID'],defaults={p['id']:p['value'] for p in r['parameters']},inks=r.get('inks'),logic=r['logic']) for r in recipes]),indent=2,ensure_ascii=False)+'\n')
print('Type and finishing modes for 6 survey systems')
