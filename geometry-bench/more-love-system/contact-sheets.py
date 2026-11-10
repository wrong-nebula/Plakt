from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/more-love-study-v2'; V1=ROOT/'output/more-love-study-v1'
source=json.loads((OUT/'source.json').read_text());families=json.loads((OUT/'catalog.json').read_text())['families']
Image.open(OUT/'reference.png').convert('RGB').crop(tuple(source['crop'])).save(OUT/'reference-crop.png')
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,40);small=ImageFont.truetype(font,28)
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def board(items,size,cell,step,path,y_text):
    sheet=Image.new('RGB',size,'#e5e7e1');d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        im=fit(Image.open(name).convert('RGB'),*cell);x=30+i*step
        sheet.paste(im,(x+(cell[0]-im.width)//2,25));d.text((x,y_text),label,font=title,fill='#303b2d');d.text((x,y_text+61),sub,font=small,fill='#6e7d64')
    sheet.save(path);return sheet

board([(OUT/'reference-crop.png','Reference / New Studio','More Love, Weltformat / 2021'),(OUT/'reciprocal.png','Type system study','One construction kit / NEW STUDIO / new palette')],(2300,1780),(1080,1550),1150,OUT/'comparison.png',1630)
s=board([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",f['palette']) for i,f in enumerate(families)],(2160,1190),(660,990),720,OUT/'shape-systems.png',1040);s.save(OUT/'shape-systems.jpg',quality=95)
board([(OUT/f"{f['id']}-make-it-bold.png",f['name'],'MAKE IT BOLD / MORE / LOVE') for f in families],(2160,1190),(660,990),720,OUT/'text-transfer.png',1040)
board([(OUT/f"{f['id']}-2021.png",f['name'],'2021 / MORE / LOVE') for f in families],(2160,1190),(660,990),720,OUT/'figures.png',1040)
board([(OUT/f"{f['id']}-why-not.png",f['name'],'WHY NOT? / 9.10.–17.10. / LUCERNE') for f in families],(2160,1190),(660,990),720,OUT/'punctuation.png',1040)

sheet=Image.new('RGB',(2100,930),'#e5e7e1');d=ImageDraw.Draw(sheet)
for i,name in enumerate(['1 / frame & cuts','2 / solid letters','3 / word bands','4 / poster']):
    im=fit(Image.open(OUT/f'stage-{i+1}.png').convert('RGB'),480,710);x=20+i*525
    sheet.paste(im,(x+(480-im.width)//2,25));d.text((x,790),name,font=small,fill='#303b2d')
sheet.save(OUT/'construction.png')

specs=[fit(Image.open(OUT/f"specimen-{f['id']}.png").convert('RGB'),2200,800) for f in families]
sheet=Image.new('RGB',(2260,sum(s.height for s in specs)+60+len(specs)*90),'#e5e7e1');d=ImageDraw.Draw(sheet);y=30
for f,s in zip(families,specs):
    d.text((30,y),f"{f['name']} / A–Z, 0–9, punctuation",font=small,fill='#303b2d');sheet.paste(s,(30,y+50));y+=s.height+90
sheet.save(OUT/'alphabet.png')

# Version 1 (hand-drawn source letters, scaled extensions) next to version 2.
if (V1/'reciprocal-shape-system.png').exists():
    board([(V1/'reciprocal-shape-system.png','Version 1','Separate drawings, stretched extensions'),(OUT/'reciprocal-shape-system.png','Version 2','One construction kit for every letter'),(OUT/'reciprocal-make-it-bold.png','Version 2','Word-aware rows, shared cap height')],(2160,1190),(660,990),720,OUT/'v1-v2.png',1040)
print('Saved comparison, shape systems, text transfer, figures, punctuation, construction, alphabet and v1/v2 boards.')
