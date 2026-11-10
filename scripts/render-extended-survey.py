from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parent.parent;out=root/'output/library-shape-survey-v2';binary=root/'.build/image-library/release/poster'
recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json').read_text())
for recipe in recipes:
 for variant in range(4):
  values={}
  if variant:
   for i,p in enumerate(recipe['parameters']):
    fraction=[.28,.68,.46][variant-1] if i%2==0 else [.72,.32,.82][variant-1]
    v=p['min']+(p['max']-p['min'])*fraction
    values[p['id']]=round(v) if p['step']>=1 else v
  folder=out/'specimens'/recipe['id']/f'v{variant}';preset=out/f'.{recipe["id"]}-{variant}.json'
  preset.write_text(json.dumps(dict(version='poster-shape-preset-v1',recipe=recipe,seed=817+variant,parameters=values)))
  if not folder.exists():subprocess.run([str(binary),'shape-library','render','--preset',str(preset),'--out',str(folder)],cwd=root,check=True,stdout=subprocess.DEVNULL)
  preset.unlink()
 print('Rendered',recipe['id'],flush=True)
if not (out/'embeddings').exists():subprocess.run([str(binary),'shape-library','index','--out',str(out/'embeddings')],cwd=root,check=True)
