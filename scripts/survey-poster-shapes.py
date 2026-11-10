from PIL import Image,ImageDraw
from pathlib import Path
from urllib.parse import urlparse,unquote
import json,hashlib
out=Path('output/library-shape-survey-v1');manifest=[];files=sorted(Path('library/posters').glob('*/record.json'))
for i,p in enumerate(files):
 d=json.loads(p.read_text());im=Path(unquote(urlparse(d['imageURL']).path));manifest.append({'index':i,'id':d['id'],'image':str(im),'sha256':hashlib.sha256(im.read_bytes()).hexdigest(),'recordSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'tags':[t.get('name') for t in d.get('tags',[])],'text':d.get('textIndex','')})
for start in range(0,len(files),100):
 sheet=Image.new('RGB',(1500,1900),'#dedbd3');dr=ImageDraw.Draw(sheet)
 for n,row in enumerate(manifest[start:start+100]):
  im=Image.open(row['image']).convert('RGB');im.thumbnail((144,166));x=(n%10)*150+(150-im.width)//2;y=(n//10)*190;sheet.paste(im,(x,y));dr.text(((n%10)*150+3,y+169),f"{row['index']:04} {row['id'][:8]}",fill='black')
 sheet.save(out/f'survey-{start//100+1:02}.jpg',quality=86)
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(len(manifest),'posters,',(len(files)+99)//100,'sheets')
