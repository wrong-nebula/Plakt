from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

OUT=Path(__file__).resolve().parents[2]/'output/punkt-capsule-study-v2'
source=json.loads((OUT/'source.json').read_text())
crop=Image.open(OUT/'reference.jpg').convert('RGB').crop(tuple(source['crop']))
crop.save(OUT/'reference-crop.png')
catalog=json.loads((OUT/'catalog.json').read_text())
families=catalog['families']
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,42);small=ImageFont.truetype(font,28)

sheet=Image.new('RGB',(2300,1780),'#e2e4e9');d=ImageDraw.Draw(sheet)
for i,(name,label,sub) in enumerate([
 ('reference-crop.png','Reference crop','Tanja Krebs + team / photographed print'),
 ('joined.png','Vector reconstruction','Matched proportions / sampled violet and black')]):
    im=Image.open(OUT/name).convert('RGB');factor=min(1050/im.width,1570/im.height)
    im=im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS)
    x=40+i*1150;y=35;sheet.paste(im,(x+(1050-im.width)//2,y))
    d.text((x,1640),label,fill='#29303e',font=title);d.text((x,1701),sub,fill='#667286',font=small)
sheet.save(OUT/'comparison.png');sheet.save(OUT/'comparison.jpg',quality=95)

sheet=Image.new('RGB',(2160,1190),'#e2e4e9');d=ImageDraw.Draw(sheet)
for i,f in enumerate(families):
    im=Image.open(OUT/(f['id']+'.png')).convert('RGB');im.thumbnail((660,990),Image.Resampling.LANCZOS)
    x=30+i*720;y=30;sheet.paste(im,(x+(660-im.width)//2,y))
    d.text((x,1050),f"{i+1:02} / {f['name']}",fill='#29303e',font=title)
    d.text((x,1110),f['palette'],fill='#667286',font=small)
sheet.save(OUT/'shape-families.png');sheet.save(OUT/'shape-families.jpg',quality=95)

sheet=Image.new('RGB',(2000,900),'#e2e4e9');d=ImageDraw.Draw(sheet)
for i,label in enumerate(['1 / column layout','2 / capsule bodies','3 / joins & counters','4 / fillets & hairlines']):
    im=Image.open(OUT/f'stage-{i+1}.png').convert('RGB');im.thumbnail((460,690),Image.Resampling.LANCZOS)
    x=20+i*500;sheet.paste(im,(x,25));d.text((x,755),label,font=small,fill='#29303e')
sheet.save(OUT/'construction.png')

# Fit: one row of the tall formats, then the wide ones stacked beneath.
names={f['id']:f['name'] for f in catalog['formats']}
tall=['poster','story','square','a-series'];wide=['landscape','billboard']
sheet=Image.new('RGB',(2400,1900),'#e2e4e9');d=ImageDraw.Draw(sheet);x=30
for fid in tall:
    im=Image.open(OUT/f'fit-{fid}.png').convert('RGB');im.thumbnail((560,820),Image.Resampling.LANCZOS)
    sheet.paste(im,(x,30));d.text((x,870),names[fid],font=small,fill='#29303e');x+=im.width+30
y=940
for fid in wide:
    im=Image.open(OUT/f'fit-{fid}.png').convert('RGB');im.thumbnail((2340,420),Image.Resampling.LANCZOS)
    sheet.paste(im,(30,y));d.text((30+im.width+20 if im.width<2000 else 30,y+im.height+8),names[fid],font=small,fill='#29303e');y+=im.height+60
sheet=sheet.crop((0,0,2400,y));sheet.save(OUT/'fit-formats.png')
print('Saved source comparison, shape families, construction and fit-format boards.')
