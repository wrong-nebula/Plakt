from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import numpy as np

OUT=Path(__file__).resolve().parents[2]/'output/plot-slice-study-v1'
source=json.loads((OUT/'source.json').read_text());families=json.loads((OUT/'catalog.json').read_text())['families']
w,h=source['field'];A=[];b=[]
for (x,y),(u,v) in zip([(0,0),(w,0),(w,h),(0,h)],source['quad']):
    A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);b.extend([u,v])
coefficients=np.linalg.solve(np.array(A),np.array(b))
Image.open(OUT/'reference.jpg').convert('RGB').transform((w,h),Image.Transform.PERSPECTIVE,coefficients,Image.Resampling.BICUBIC).save(OUT/'reference-crop.png')
font='/System/Library/Fonts/Supplemental/Arial.ttf';title=ImageFont.truetype(font,38);small=ImageFont.truetype(font,27)
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)

sheet=Image.new('RGB',(2300,1780),'#e5e7e1');d=ImageDraw.Draw(sheet)
for i,(name,label,sub) in enumerate([('reference-crop.png','Reference / Christian Gautschi','PLOT, f’ar Lausanne / 2019'),('windows.png','Vector construction study','One master / nine progressively taller windows')]):
    im=fit(Image.open(OUT/name).convert('RGB'),1080,1550);x=35+i*1150;sheet.paste(im,(x+(1080-im.width)//2,30));d.text((x,1630),label,font=title,fill='#303b2d');d.text((x,1691),sub,font=small,fill='#6e7d64')
sheet.save(OUT/'comparison.png')
# Systems sit four to a row, so the boards grow with the catalogue.
for suffix,file in [('', 'slice-systems.png'),('-fubu','text-transfer.png')]:
    cols=4;rows=-(-len(families)//cols);sheet=Image.new('RGB',(30+cols*560,rows*960+20),'#e5e7e1');d=ImageDraw.Draw(sheet)
    for i,family in enumerate(families):
        im=fit(Image.open(OUT/(family['id']+suffix+'.png')).convert('RGB'),530,757);x=30+(i%cols)*560;y=25+(i//cols)*960;sheet.paste(im,(x+(530-im.width)//2,y));d.text((x,y+790),f"{i+1:02} / {family['name']}",font=small,fill='#303b2d');d.text((x,y+835),family['palette'] if not suffix else 'Fubu / the same modules',font=ImageFont.truetype(font,22),fill='#6e7d64')
    sheet.save(OUT/file)
sheet=Image.new('RGB',(2100,930),'#e5e7e1');d=ImageDraw.Draw(sheet);label=ImageFont.truetype(font,28)
for i,name in enumerate(['1 / master word','2 / reveal windows','3 / sliced letters','4 / poster']):
    im=fit(Image.open(OUT/f'stage-{i+1}.png').convert('RGB'),480,710);x=20+i*525;sheet.paste(im,(x+(480-im.width)//2,25));d.text((x,790),name,font=label,fill='#303b2d')
sheet.save(OUT/'construction.png')
presets=json.loads((OUT/'catalog.json').read_text())['presets']
boards=[(f"angle-{p['id']}.png",p['name'],f"Slices {p['params']['slice']}° · word {p['params']['turn']}°") for p in presets]+[(f'angle-vertical-slices-{f}.png','Vertical slices',name) for f,name in [('shear','Alternating shear'),('bowed','Bowed windows')]]
sheet=Image.new('RGB',(30+len(boards)*405,700),'#e5e7e1');d=ImageDraw.Draw(sheet);label=ImageFont.truetype(font,25);sub=ImageFont.truetype(font,21)
for i,(name,head,line) in enumerate(boards):
    im=fit(Image.open(OUT/name).convert('RGB'),380,545);x=30+i*405;sheet.paste(im,(x+(380-im.width)//2,25));d.text((x,598),head,font=label,fill='#303b2d');d.text((x,638),line,font=sub,fill='#6e7d64')
sheet.save(OUT/'angles.png')
texts=[('text-shape-system.png','Shape / system','Balanced break, one stem weight'),('text-lausanne-2019.png','Lausanne / 2019','Bowed, signal on black'),('text-plot-atlas-2019.png','Plot / atlas / 2019','Typed lines, acid on night'),('text-forum-vertical.png','Forum 19.09','Vertical slices, shear, ice on ink')]
sheet=Image.new('RGB',(30+len(texts)*545,900),'#e5e7e1');d=ImageDraw.Draw(sheet)
for i,(name,head,line) in enumerate(texts):
    im=fit(Image.open(OUT/name).convert('RGB'),520,745);x=30+i*545;sheet.paste(im,(x+(520-im.width)//2,25));d.text((x,795),head,font=label,fill='#303b2d');d.text((x,838),line,font=sub,fill='#6e7d64')
sheet.save(OUT/'texts.png')
pages=[('format-story.png','Story 9 × 16','Saw drift · f’ar scaffold'),('format-square.png','Square','Aperture · own caption'),('format-landscape.png','Landscape 16 × 9','Accordion · type only'),('format-banner.png','Banner 3 × 1','Exploded strata · own caption')]
sheet=Image.new('RGB',(30+len(pages)*650,880),'#e5e7e1');d=ImageDraw.Draw(sheet)
for i,(name,head,line) in enumerate(pages):
    im=fit(Image.open(OUT/name).convert('RGB'),620,720);x=30+i*650;sheet.paste(im,(x+(620-im.width)//2,25+(720-im.height)//2));d.text((x,775),head,font=label,fill='#303b2d');d.text((x,818),line,font=sub,fill='#6e7d64')
sheet.save(OUT/'formats.png')
print('Saved rectified reference, slice systems, transfer, construction, angle, text and format boards.')
