"""Render the frozen visual-survey recipes using the native CLI, never the source pixels."""
from pathlib import Path
import subprocess,json,sys
root=Path(__file__).resolve().parent.parent
binary=Path(sys.argv[1]) if len(sys.argv)>1 else root/'.build/image-library/release/poster'
out=root/'output/library-shape-survey-v1'
recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json').read_text())
variations=[
 [dict(turns=3,thickness=.027,inset=.06),dict(turns=11,thickness=.006,inset=.025)],
 [dict(count=14,recession=.82,focusX=.28,focusY=.72),dict(count=32,recession=.93,focusX=.72,focusY=.3)],
 [dict(branches=3,depth=2,spread=.9,taper=.65,phase=.45),dict(branches=6,depth=4,spread=.5,taper=.55,phase=-.7)],
 [dict(count=5,pinch=.35,bow=.4,lineWidth=.015),dict(count=14,pinch=.63,bow=.9,lineWidth=.005)],
 [dict(rows=13,columns=9,bias=.7,radius=.016,jitter=0),dict(rows=30,columns=21,bias=3.3,radius=.009,jitter=.4)],
 [dict(lobes=5,depth=.045,aperture=.55,phase=.6),dict(lobes=15,depth=.015,aperture=.76,phase=-.4)],
 [dict(count=9,drift=-.35,growth=.8,thickness=.04,angle=.45),dict(count=25,drift=.38,growth=.65,thickness=.012,angle=.23)],
 [dict(thickness=.06,arm=.62,inset=.085,disc=.18),dict(thickness=.018,arm=.84,inset=.04,disc=.32)]
]
for recipe,options in zip(recipes,variations):
 for variant,values in enumerate([{},*options]):
  folder=out/'variants'/recipe['id']/f'v{variant}';preset=out/f".preset-{recipe['id']}-{variant}.json"
  preset.write_text(json.dumps(dict(version='poster-shape-preset-v1',recipe=recipe,seed=817+variant,parameters=values)))
  if not folder.exists():subprocess.run([str(binary),'shape-library','render','--preset',str(preset),'--out',str(folder)],cwd=root,check=True)
  preset.unlink()
 print('Rendered',recipe['id'],flush=True)
index=out/'embeddings'
if not index.exists():subprocess.run([str(binary),'shape-library','index','--out',str(index)],cwd=root,check=True)
