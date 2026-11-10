"""Material and geometry controls for six survey systems. Run after align-survey-defaults.py.
New presets default to the canonical source material; saved genomes without these keys keep their original rendering."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent;path=root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json';recipes=json.loads(path.read_text())
def p(id,label,v,lo,hi,step=.001):return dict(id=id,label=label,value=v,min=lo,max=hi,step=step)
spec={
 'survey-faceted-spire':([p('tipFan','Edge prongs',1,0,1),p('sheen','Metallic sheen',.6,0,1)],None,
  "Edge prongs carry the deeper tiers' wing tips out to the field edge at rising heights, flattening the lower chevrons as in the source; metallic sheen lights each face along the fold and reverses on the far face."),
 'survey-sliced-orb':([p('bleed','Volume overscale',1.35,1,1.7),p('mirror','Mirrored halves',1,0,1,1),p('invert','Light on dark volume',1,0,1,1)],['#1d1f22','#f3f0e8'],
  "The canonical material is light on dark: solid volumes lit by a second ink, halves mirrored about the centre, and overscale that crops the volumes at the field edge so they read wider than the paper."),
 'survey-gravity-drips':([p('streams','Streams per pool',6,1,14,1),p('softness','Pool softness',.6,0,1),p('inkCount','Pigment inks',5,1,5,1),p('scatter','Pool scatter',.6,0,1)],['#ff3d8b','#7b3dff','#20c25b','#ece23a','#2f6cff'],
  "Scattered, soft-edged pools in up to five side-by-side inks shed many thin streams from their lower rims; stream lengths are long-tailed, so a few stop short and the longest leave the field."),
 'survey-bilateral-soft-cross':([p('twoTone','Centre ink glow',1,0,1),p('centre','Centre block',.32,0,.6)],['#f07cc4','#ff4b1f','#1e8b94'],
  "The body glows from a second ink at its core to the first at the lobe tips; a rounded centre block and the stem take a third ink, as in the Victoria Hall source."),
 'survey-portal-type':([p('tiling','Natural word repeats',1,0,1,1)],None,
  "Each wall repeats its word at natural proportions with even spacing instead of stretching one copy; all four walls run along their length."),
 'survey-module-substitution':([p('fuse','Dense-row fusion',1,0,1)],None,
  "Rows too tight for the grid gain columns until their glyphs touch, so the dense end fuses into a solid band of type."),
}
for r in recipes:
 if r['id'] not in spec:continue
 params,inks,logic=spec[r['id']];ids={x['id'] for x in params}
 r['parameters']=[x for x in r['parameters'] if x['id'] not in ids]+params
 if inks:r['inks']=inks
 if logic not in r['logic']:r['logic']=r['logic'].rstrip()+' '+logic
 assert all(x['min']<=x['value']<=x['max'] for x in r['parameters']),r['id']
path.write_text(json.dumps(recipes,indent=2,ensure_ascii=False)+'\n')
(root/'output/library-shape-survey-v2/canonical-defaults.json').write_text(json.dumps(dict(policy='Source matching is the default; deformation is opt-in.',recipes=[dict(id=r['id'],canonicalPosterID=r['references'][0]['posterID'],defaults={p['id']:p['value'] for p in r['parameters']},inks=r.get('inks'),logic=r['logic']) for r in recipes]),indent=2,ensure_ascii=False)+'\n')
print('Material controls for 6 survey systems; 3 with canonical inks')
