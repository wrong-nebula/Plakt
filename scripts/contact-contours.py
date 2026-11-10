from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
root=Path(__file__).resolve().parent.parent;out=root/'output/contour-systems-v1'
paths=sorted((out/'specimens').glob('*/poster.png'))
if not paths:raise SystemExit('No contour specimens yet')
w,h=320,500;canvas=Image.new('RGB',(w*4,h*((len(paths)+3)//4)),'#dedbd3');d=ImageDraw.Draw(canvas)
for i,p in enumerate(paths):
 im=Image.open(p).convert('RGB');im.thumbnail((w-24,h-50));x=(i%4)*w+(w-im.width)//2;y=(i//4)*h+12;canvas.paste(im,(x,y));d.text(((i%4)*w+12,(i//4)*h+h-26),p.parent.name,fill='black')
canvas.save(out/'specimens-contact.jpg',quality=94)
print(out/'specimens-contact.jpg')
