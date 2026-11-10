from pathlib import Path
from urllib.parse import urlparse,unquote
import json,math
root=Path(__file__).resolve().parent.parent;out=root/'output/library-shape-survey-v2';groups={}
refined=(out/'echo-refinement/manifest.json').exists()
for study in ['generations','echo-refinement']:
 for p in sorted((out/study).glob('survey-*/round-*/round.json')):
  d=json.loads(p.read_text())
  if refined and study=='generations' and d['recipeID']=='survey-chevron-stack':continue
  scores={r['id']:r for r in d['judging']['results']}
  for c in d['candidates']:
   key=(c['recipeID'],c['mode']);groups.setdefault(key,{})
   groups[key].setdefault(c['pixelSHA256'],dict(candidate=c,result=scores[c['id']],weights={k:v for k,v in d['weights'].items() if k!='Diversity'},roundRecord=str(p.resolve()),study=study))
selected=[]
for (recipe,mode),unique in sorted(groups.items()):
 entries=list(unique.values());weights=entries[-1]['weights'];n=len(entries)
 for e in entries:e['ballots']={}
 for judge,weight in sorted(weights.items()):
  if weight<=0 or not all(math.isfinite(e['result']['scores'].get(judge,float('nan'))) for e in entries):continue
  for e in entries:
   score=e['result']['scores'][judge];worse=sum(x['result']['scores'][judge]<score-1e-9 for x in entries);equal=sum(abs(x['result']['scores'][judge]-score)<1e-9 for x in entries)
   e['ballots'][judge]=(worse+(equal-1)/2)/(n-1) if n>1 else .5
 for e in entries:
  total=sum(weights[k] for k in e['ballots']);e['contextConsensus']=100*sum(v*weights[k] for k,v in e['ballots'].items())/total if total else 0
 entries.sort(key=lambda e:(-e['contextConsensus'],e['candidate']['seed'],e['candidate']['id']))
 winner=entries[0];selected.append(dict(recipeID=recipe,mode=mode,cohortSize=n,consensus=winner['contextConsensus'],candidate=winner['candidate'],roundRecord=winner['roundRecord'],study=winner['study'],ballots=winner['ballots'],weights=weights))
(out/'context-winners.json').write_text(json.dumps(dict(version='survey-context-borda-v1',note='Recomputed Borda within each recipe and context, after removing pixel-identical incumbents. Batch-local Diversity is excluded across rounds. This is a diagnostic selection, not user taste labels or objective aesthetic quality.',selections=selected),indent=2)+'\n')
print('Selected',len(selected),'context winners')
