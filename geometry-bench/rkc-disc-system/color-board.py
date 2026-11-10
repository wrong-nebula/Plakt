"""Arrange the three procedural colour renders as a comparison board."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

OUT=Path(__file__).resolve().parents[2]/'output/rkc-color-study-v1'
studies=json.loads((OUT/'colors.json').read_text())['studies']
sheet=Image.new('RGB',(2880,1580),'#e2e4e9')
draw=ImageDraw.Draw(sheet)
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,46)
small=ImageFont.truetype(font,32)
for i,s in enumerate(studies):
    im=Image.open(OUT/(s['id']+'.png')).convert('RGB')
    im.thumbnail((880,1300),Image.Resampling.LANCZOS)
    x=i*960+40;y=40
    sheet.paste(im,(x+(880-im.width)//2,y))
    draw.text((x,y+1340),f"{i+1:02} / {s['title'].lower()}",font=title,fill='#29313f')
    draw.text((x,y+1412),s['palette'],font=small,fill='#647082')
sheet.save(OUT/'color-triptych.png')
sheet.save(OUT/'color-triptych.jpg',quality=96)
print('Saved 2880 × 1580 colour comparison board.')
