from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

OUT=Path(__file__).resolve().parents[2]/'output/pablo-capsule-study-v1'
source=json.loads((OUT/'source.json').read_text());families=json.loads((OUT/'catalog.json').read_text())['families']
Image.open(OUT/'reference.jpg').convert('RGB').crop(tuple(source['crop'])).save(OUT/'reference-crop.png')
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,42);small=ImageFont.truetype(font,28)
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)

sheet=Image.new('RGB',(2300,1780),'#e2e6eb');d=ImageDraw.Draw(sheet)
for i,(name,label,sub) in enumerate([
 ('reference-crop.png','Reference crop','Enea Bortone / Pablo Nouvelle, Neubad'),
 ('incised-source.png','Capsule type in the Neubad layout','Shared parts / hairline seams / measured columns')]):
    im=fit(Image.open(OUT/name).convert('RGB'),1080,1550);x=35+i*1150
    sheet.paste(im,(x+(1080-im.width)//2,30));d.text((x,1630),label,font=title,fill='#29303d');d.text((x,1691),sub,font=small,fill='#677c93')
sheet.save(OUT/'comparison.png');sheet.save(OUT/'comparison.jpg',quality=95)

sheet=Image.new('RGB',(2160,1190),'#e2e6eb');d=ImageDraw.Draw(sheet)
for i,family in enumerate(families):
    im=fit(Image.open(OUT/(family['id']+'.png')).convert('RGB'),660,990);x=30+i*720
    sheet.paste(im,(x+(660-im.width)//2,25));d.text((x,1040),f"{i+1:02} / {family['name']}",font=title,fill='#29303d');d.text((x,1101),family['palette'],font=small,fill='#677c93')
sheet.save(OUT/'cutting-systems.png');sheet.save(OUT/'cutting-systems.jpg',quality=95)

sheet=Image.new('RGB',(2100,930),'#e2e6eb');d=ImageDraw.Draw(sheet);label=ImageFont.truetype(font,28)
for i,name in enumerate(['1 / frames & guides','2 / parts','3 / solid bodies','4 / seams']):
    im=fit(Image.open(OUT/f'stage-{i+1}.png').convert('RGB'),480,710);x=20+i*525
    sheet.paste(im,(x+(480-im.width)//2,25));d.text((x,790),name,font=label,fill='#29303d')
sheet.save(OUT/'construction.png')

sheet=Image.new('RGB',(2640,930),'#e2e6eb');d=ImageDraw.Draw(sheet)
for i,(name,text) in enumerate([('incised','Columns reading up / fill'),('layout-down','Columns reading down'),('layout-rows','Rows / fill'),('layout-even','Even letter size'),('construction-varied','Stem .38, square .95, bridge .03')]):
    im=fit(Image.open(OUT/f'{name}.png').convert('RGB'),490,710);x=20+i*525
    sheet.paste(im,(x+(490-im.width)//2,25));d.text((x,790),text,font=label,fill='#29303d')
sheet.save(OUT/'layouts.png')
print('Saved reference, cutting-system, construction and layout comparisons.')
