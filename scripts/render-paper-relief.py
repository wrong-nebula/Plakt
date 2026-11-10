from pathlib import Path
import json,subprocess,os
root=Path(__file__).resolve().parent.parent;out=root/'output/paper-relief-v1';binary=Path(os.environ.get('POSTER_RELIEF_BINARY',str(root/'.build/image-library/release/poster')))
r=json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/PaperReliefRecipes.json').read_text())[0]
cases=[('neubad-default',817,{},'Paper relief'),('open-flaps',817,{'foldAngle':62,'lift':.04,'shadow':.8},'COMMON GROUND'),('deep-recesses',817,{'recessDepth':.07,'aperture':1.18,'labelScale':1.2},'INTO THE PAPER'),('terraces',901,{'layout':1,'lift':.05,'foldAngle':45,'labelScale':1.4},'OPEN FORMS'),('collage',902,{'layout':2,'overlap':.2,'colorMix':.5,'labelScale':1.3},'SHIFTED PLANES'),('flat-control',817,{'foldAngle':0,'lift':0,'recessDepth':.004,'shadow':0},'PAPER RELIEF')]
for name,seed,values,title in cases:
 folder=out/'specimens'/name
 if folder.exists():continue
 p={'version':'poster-shape-preset-v1','recipe':r,'seed':seed,'parameters':values,'relief':{'version':'paper-relief-customization-v1','title':title}}
 f=out/('.'+name+'.json');f.write_text(json.dumps(p));subprocess.run([str(binary),'shape-library','render','--preset',str(f),'--out',str(folder)],cwd=root,check=True,stdout=subprocess.DEVNULL);f.unlink();print(name,flush=True)
from PIL import Image,ImageDraw
w,h=330,500;im=Image.new('RGB',(w*3,h*2),'#dcd9d1');d=ImageDraw.Draw(im)
for i,(name,_,_,_) in enumerate(cases):
 p=out/'specimens'/name/'poster.png';image=Image.open(p).convert('RGB');image.thumbnail((w-20,h-40));im.paste(image,(i%3*w+(w-image.width)//2,i//3*h+8));d.text((i%3*w+10,i//3*h+h-24),name,fill='black')
im.save(out/'specimens-contact.jpg',quality=95)
