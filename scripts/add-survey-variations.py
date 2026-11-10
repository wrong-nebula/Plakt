"""Variation axes for six survey systems. Run after add-survey-materials.py.
Defaults keep the canonical source construction; saved genomes without these keys render exactly as before."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent;path=root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json';recipes=json.loads(path.read_text())
def p(id,label,v,lo,hi,step=.001):return dict(id=id,label=label,value=v,min=lo,max=hi,step=step)
spec={
 'survey-faceted-spire':([p('direction','Points up / down / left / right',0,0,3,1),p('spires','Spires side by side',1,1,3,1),p('curve','Fin curvature',0,0,1)],
  'Variations turn the spire to point down or sideways, repeat it side by side, or bow its fins inward.'),
 'survey-sliced-orb':([p('primitive','Ellipsoid / barrel / lens',0,0,2,1),p('axis','Stacked vertically / side by side',0,0,1,1),p('twist','Wireframe twist',0,-1,1)],
  'Variations swap the ellipsoid for a barrel or a lens, stack the volumes side by side, or twist the wireframe slice by slice.'),
 'survey-gravity-drips':([p('flow','Flow down / up / right / left',0,0,3,1),p('arrangement','Pools in a row / one dominant / two rows / cloud',0,0,3,1),p('wave','Stream meander',0,0,1)],
  'Variations change which way the pigment runs, gather the pools around one dominant pool, in two rows or as a loose cloud, and let streams meander.'),
 'survey-bilateral-soft-cross':([p('lobes','Lobes',4,3,8,1),p('lobeShape','Lobe squareness',0,0,1),p('spin','Lobe rotation',0,0,.5),p('centreRound','Centre block roundness',.3,0,.5)],
  'Variations set three to eight lobes, square off their crowns, turn them onto the axes and round the centre block into a disc.'),
 'survey-portal-type':([p('sides','Frame sides',4,3,8,1),p('flow','Words per wall / continuous text',0,0,1,1),p('shading','Wall shading',0,0,1)],
  'Variations build the corridor from three- to eight-sided frames, run the title round it as one continuous line, and shade each wall toward the vanishing point.'),
 'survey-module-substitution':([p('direction','Density down / across / radial',0,0,2,1),p('mask','Letter mask off / inside / outside',0,0,2,1)],
  "Variations run the density across the field or out from its centre in rings, keep only the modules inside or outside the title's first letter, and add soft rounded modules."),
}
for r in recipes:
 if r['id'] not in spec:continue
 params,logic=spec[r['id']];ids={x['id'] for x in params}
 r['parameters']=[x for x in r['parameters'] if x['id'] not in ids]+params
 if r['id']=='survey-module-substitution':
  kind=next(x for x in r['parameters'] if x['id']=='moduleKind');kind['max']=2;kind['label']='Glyphs / symbols / soft squares'
 if logic not in r['logic']:r['logic']=r['logic'].rstrip()+' '+logic
 assert all(x['min']<=x['value']<=x['max'] for x in r['parameters']),r['id']
path.write_text(json.dumps(recipes,indent=2,ensure_ascii=False)+'\n')
(root/'output/library-shape-survey-v2/canonical-defaults.json').write_text(json.dumps(dict(policy='Source matching is the default; deformation is opt-in.',recipes=[dict(id=r['id'],canonicalPosterID=r['references'][0]['posterID'],defaults={p['id']:p['value'] for p in r['parameters']},inks=r.get('inks'),logic=r['logic']) for r in recipes]),indent=2,ensure_ascii=False)+'\n')
print('Variation axes for 6 survey systems: '+', '.join(f"{k.removeprefix('survey-')} +{len(v[0])}" for k,v in spec.items()))
