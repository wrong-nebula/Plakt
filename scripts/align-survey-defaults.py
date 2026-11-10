"""Canonical source first; deformations remain explicit parameters and study variants."""
from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent;path=root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json';recipes=json.loads(path.read_text());m=json.loads((root/'output/library-shape-survey-v1/manifest.json').read_text())
def p(id,label,v,lo,hi,step=.001):return dict(id=id,label=label,value=v,min=lo,max=hi,step=step)
def update(r,values):
 for item in r['parameters']:
  if item['id'] in values:item['value']=values[item['id']]
canon={'meander':216,'tunnel':416,'dendrite':608,'tension-web':1105,'density-field':1122,'scalloped-frame':477,'chevron-stack':17,'corner-brackets':841,'faceted-spire':609,'sliced-orb':830,'gravity-drips':1094,'bilateral-soft-cross':1010,'portal-type':1030,'module-substitution':745}
for r in recipes:
 key=r['id'].removeprefix('survey-')
 if key=='meander':
  update(r,dict(turns=2,inset=.055,thickness=.09));next(x for x in r['parameters'] if x['id']=='thickness')['max']=.12
 elif key=='tunnel':
  update(r,dict(count=28,recession=1,focusX=.5,focusY=.5,lineWidth=.005));next(x for x in r['parameters'] if x['id']=='recession')['max']=1
  r['logic']='Nested rectangular frames converge on one focal point. The reference default uses uniform inset spacing and a centered terminal rectangle; recession below 1 produces a geometric spacing variation.'
 elif key=='dendrite':
  update(r,dict(branches=3,depth=1,spread=1.05,taper=.6,phase=.25,thickness=.11));next(x for x in r['parameters'] if x['id']=='thickness')['max']=.14
  r['logic']='Build a low-order, three-armed molecular silhouette with rounded branch junctions. The reference default favors thick connected limbs and only one branching generation; higher recursion is an explicit variation.'
 elif key=='tension-web':
  update(r,dict(count=4,pinch=.5,bow=.92,lineWidth=.032));next(x for x in r['parameters'] if x['id']=='lineWidth')['max']=.045
  r['parameters']=[x for x in r['parameters'] if x['id'] not in ['structure','opening']]+[p('structure','Closed field / open fan',1,0,1,1),p('opening','Central opening',.08,0,.3)]
  r['logic']='Four curved arms fan upward and downward from each shared side anchor, leaving the center open as in VOLUMES. A separate structure control restores the closed eye-like weave as a variation.'
 elif key=='density-field':
  update(r,dict(rows=6,columns=7,bias=1,radius=.045,jitter=.015));next(x for x in r['parameters'] if x['id']=='radius')['max']=.055
  r['parameters']=[x for x in r['parameters'] if x['id']!='module']+[p('module','Discs / rounded squares',1,0,1,1)]
  r['name']='Rounded module field';r['logic']='A regular six-by-seven field of rounded squares follows the light-grid element in the canonical source. Density exponents, circular modules and jitter remain explicit variations.'
 elif key=='scalloped-frame':
  r['name']='Scalloped letter field';r['group']='Modular typography';r['renderer']='motif-survey-scalloped-frame'
  r['parameters']=[p('columns','Letter columns',2,1,4,1),p('lobes','Edge lobes',10,3,18,1),p('depth','Scallop depth',.035,.007,.055),p('phase','Edge phase',0,-1.2,1.2),p('gap','Tile gap',0,0,.08),p('alternation','Alternate figure / ground',1,0,1,1)]
  r['logic']='Shape an editable word into a grid of stretched glyphs, then scallop each outer contour and counter along arc length. The canonical default is F U / B U, two columns and two rows, with alternating figure/ground. This is simultaneously a letter system and a field of shapes; glyph counters remain negative space.'
  r['tags']=['scalloped-type','modular-letterforms','counterforms','figure-ground','editable-text','FUBU'];r['fontTarget']=dict(weight=.95,width=1,serif=0,mono=0,italic=0);r['idealAspect']=.7
 elif key=='chevron-stack':
  update(r,dict(count=32,drift=-.22,growth=.78,thickness=.004,angle=.3));r['parameters']=[x for x in r['parameters'] if x['id']!='symbol']+[p('symbol','Chevron / seven-shaped band',1,0,1,1)]
  next(x for x in r['parameters'] if x['id']=='thickness')['min']=.002
  r['name']='Seven-shaped echo stack';r['logic']='Repeat a bent seven-shaped band with scale and lateral progression, following the angular top bar and long diagonal of the source. Chevron modules are an explicit alternative, rather than the default.'
 elif key=='corner-brackets':
  update(r,dict(thickness=.05,arm=.84,inset=.045,disc=.30));r['parameters']=[x for x in r['parameters'] if x['id'] not in ['outline','lineWidth']]+[p('outline','Solid / outlined brackets',1,0,1,1),p('lineWidth','Outline width',.006,.002,.015)]
 elif key=='faceted-spire':update(r,dict(folds=3,spread=1,notch=.44,spine=.5,facets=.12))
 elif key=='sliced-orb':
  update(r,dict(slices=6,meridians=9,displacement=0,phase=0,gap=0,light=0));next(x for x in r['parameters'] if x['id']=='gap')['min']=0
  r['parameters']=[x for x in r['parameters'] if x['id'] not in ['stack','flatten']]+[p('stack','Stacked volumes',3,1,3,1),p('flatten','Volume height / width',.72,.35,1.2)]
  r['name']='Wireframe volume stack';r['idealAspect']=.7
  r['logic']='The source-aligned default repeats broad shaded wireframe ellipsoids vertically, with one full central volume and neighboring partial volumes. Slice gaps and lateral displacement default to zero. Their controls explicitly enable the displaced-slice extension; that extension is not literally present in the FUBU reference.'
  r['basis']='Canonical source: FUBU, 17.03.2022. Default follows stacked broad wireframe volumes; gaps and displacement are optional authored extensions.'
 elif key=='gravity-drips':update(r,dict(count=24,pool=.16,length=.77,width=.007,wind=0,taper=.45))
 elif key=='bilateral-soft-cross':
  update(r,dict(neck=.16,bulge=.8,stretch=.8,stem=.38,glow=.8));next(x for x in r['parameters'] if x['id']=='stem')['max']=.5
  r['parameters']=[x for x in r['parameters'] if x['id'] not in ['bodyScale','centerY','stemWidth']]+[p('bodyScale','Lobe field scale',1.1,.5,1.2),p('centerY','Body vertical anchor',.4,.28,.6),p('stemWidth','Stem width',.09,.02,.16)]
 elif key=='portal-type':update(r,dict(levels=2,faces=4,depth=.7,focusX=.5,focusY=.5,guides=.05))
 elif key=='module-substitution':
  update(r,dict(rows=40,columns=20,bias=2.5,mass=.75,moduleKind=0,rotation=0));next(x for x in r['parameters'] if x['id']=='rows')['max']=64;next(x for x in r['parameters'] if x['id']=='columns')['max']=32
 r['idealAspect']={'tension-web':.72,'density-field':1.1,'scalloped-frame':.70,'chevron-stack':.68,'faceted-spire':.63,'sliced-orb':.70,'gravity-drips':.67,'bilateral-soft-cross':.74,'portal-type':.70,'module-substitution':.67}.get(key,r['idealAspect'])
 index=canon[key];ref=next((x for x in r['references'] if x['posterID']==m[index]['id']),None)
 if not ref:ref=dict(queryID='canonical-source-visual-review-2026-11-08',posterID=m[index]['id'],sourceImageSHA256=m[index]['sha256'],evidenceURL=(root/'output/library-shape-survey-v1/manifest.json').as_uri());r['references'].append(ref)
 r['references']=[ref]+[x for x in r['references'] if x['posterID']!=ref['posterID']]
 r['defaultPolicy']='Match the first canonical reference as closely as the procedural grammar supports. Creative departures require explicit parameter changes; exact designer algorithms remain unknown.'
 assert all(x['min']<=x['value']<=x['max'] for x in r['parameters']),r['id']
path.write_text(json.dumps(recipes,indent=2,ensure_ascii=False)+'\n')
(root/'output/library-shape-survey-v2/canonical-defaults.json').write_text(json.dumps(dict(policy='Source matching is the default; deformation is opt-in.',recipes=[dict(id=r['id'],canonicalPosterID=r['references'][0]['posterID'],defaults={p['id']:p['value'] for p in r['parameters']},logic=r['logic']) for r in recipes]),indent=2,ensure_ascii=False)+'\n')
print('Aligned defaults for all 14 systems; scalloped FUBU is editable typography')
