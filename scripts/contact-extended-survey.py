from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math
root=Path(__file__).resolve().parent.parent;out=root/'output/library-shape-survey-v2';recipes=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json').read_text())
try:font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
except OSError:font=ImageFont.load_default()
def contact(rows,path,cols=4,cell=(340,390)):
 sheet=Image.new('RGB',(cols*cell[0],math.ceil(len(rows)/cols)*cell[1]),'#dedbd3');draw=ImageDraw.Draw(sheet)
 for n,(image,label) in enumerate(rows):
  im=Image.open(image).convert('RGB');im.thumbnail((cell[0]-20,cell[1]-48));x=n%cols*cell[0]+(cell[0]-im.width)//2;y=n//cols*cell[1];sheet.paste(im,(x,y));draw.text((n%cols*cell[0]+10,y+cell[1]-38),label,fill='#202322',font=font)
 sheet.save(path,quality=92)
if (out/'embeddings/embeddings.json').exists():
 contact([(out/'embeddings'/(r['id']+'.png'),r['name']) for r in recipes],out/'all-systems.jpg',cols=4)
 contact([(out/'embeddings'/(r['id']+'.png'),r['name']) for r in recipes[8:]],out/'six-new-systems.jpg',cols=3,cell=(470,520))
for i in range(0,len(recipes),2):
 rows=[(out/'specimens'/r['id']/f'v{v}'/'poster.png',r['name']+' · v'+str(v)) for r in recipes[i:i+2] for v in range(4)]
 if all(p.exists() for p,_ in rows):contact(rows,out/f'parameters-{i//2+1:02}.jpg')
for study in ['pilot','generations']:
 p=out/study/'manifest.json'
 if p.exists():
  manifest=json.loads(p.read_text());lookup={r['id']:r['name'] for r in recipes}
  contact([(Path(r['image']),lookup[r['recipeID']]) for r in manifest],out/f'{study}-winners.jpg',cols=4,cell=(360,555))
  cases=[]
  for folder in sorted((out/study).glob('survey-*/round-*')):
   p=folder/'round.json'
   if not p.exists():continue
   d=json.loads(p.read_text());score={r['id']:r for r in d['judging']['results']}
   ordered=sorted(d['candidates'],key=lambda c:next(i for i,r in enumerate(d['judging']['results']) if r['id']==c['id']))
   for c in ordered[:1]:cases.append((Path(c['imageURL'].removeprefix('file://')),d['recipeID'].removeprefix('survey-')+' '+str(d['round'])))
  if cases:contact(cases,out/f'{study}-rounds.jpg',cols=7,cell=(220,350))
print('Contact sheets updated')

context=out/'context-winners.json'
if context.exists():
 selections=json.loads(context.read_text())['selections'];names={r['id']:r['name'] for r in recipes}
 for mode in ['source-region','source-dominant','image-interaction']:
  chosen=[r for r in selections if r['mode']==mode]
  rows=[(Path(r['candidate']['imageURL'].removeprefix('file://')),names[r['recipeID']]) for r in chosen]
  contact(rows,out/(mode+'-winners.jpg'),cols=4,cell=(360,555))
