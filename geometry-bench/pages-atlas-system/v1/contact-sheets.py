from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

OUT=Path(__file__).resolve().parents[3]/'output/pages-atlas-study-v1'
families=json.loads((OUT/'catalog.json').read_text())['families']
font='/System/Library/Fonts/Supplemental/Arial.ttf';title=ImageFont.truetype(font,38);small=ImageFont.truetype(font,27)
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)

sheet=Image.new('RGB',(2300,1430),'#e5e7e1');d=ImageDraw.Draw(sheet)
for i,(name,label,sub) in enumerate([('reference.png','Reference / Neo Neo','P.A.G.E.S., Geneva / 2023'),('discs.png','Vector construction study','Mixed methods / overlap lenses / new palette')]):
    im=fit(Image.open(OUT/name).convert('RGB'),1080,1190);x=35+i*1150;sheet.paste(im,(x+(1080-im.width)//2,30));d.text((x,1280),label,font=title,fill='#303b2d');d.text((x,1340),sub,font=small,fill='#6e7d64')
sheet.save(OUT/'comparison.png')
for suffix,file in [('', 'module-systems.png'),('-shape','text-transfer.png')]:
    sheet=Image.new('RGB',(2160,970),'#e5e7e1');d=ImageDraw.Draw(sheet)
    for i,family in enumerate(families):
        im=fit(Image.open(OUT/(family['id']+suffix+'.png')).convert('RGB'),660,730);x=30+i*720;sheet.paste(im,(x+(660-im.width)//2,25));d.text((x,815),f"{i+1:02} / {family['name']}",font=title,fill='#303b2d');d.text((x,876),family['palette'] if not suffix else 'S.H.A.P.E. / new letters, same methods',font=small,fill='#6e7d64')
    sheet.save(OUT/file)
sheet=Image.new('RGB',(2100,740),'#e5e7e1');d=ImageDraw.Draw(sheet);label=ImageFont.truetype(font,28)
for i,name in enumerate(['1 / components','2 / overlaps','3 / glyphs','4 / atlas']):
    im=fit(Image.open(OUT/f'stage-{i+1}.png').convert('RGB'),480,530);x=20+i*525;sheet.paste(im,(x+(480-im.width)//2,25));d.text((x,620),name,font=label,fill='#303b2d')
sheet.save(OUT/'construction.png')
print('Saved reference, module-set, transfer and construction comparisons.')
