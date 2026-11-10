from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/bead-ray-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];layouts=catalog['layouts'];formats=catalog['formats'];options=catalog['options']
refs={r['family']:r for r in source['references']}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24);tiny=ImageFont.truetype(font,15)
BG='#e7e6e1';INK='#2d2d2a';MUTED='#6c6a62'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90,fonts=(title,small),gap=30):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(gap+cols*(cell[0]+gap),gap+rows*(cell[1]+label_h+gap)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=gap+(i%cols)*(cell[0]+gap);y=gap+(i//cols)*(cell[1]+label_h+gap)
        with Image.open(name) as src:im=fit(src.convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+label_h*.15),label,font=fonts[0],fill=INK);d.text((x,y+cell[1]+label_h*.58),sub,font=fonts[1],fill=MUTED)
    sheet.save(path);return sheet

name={f['id']:f['name'] for f in families}
grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",refs[f['id']]['designer']),(OUT/f"{f['id']}.png",'Preset',f['name'])]],6,(420,594),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",('After '+f['after'].split(',')[0]) if f['kind']=='source' else f['after'].replace('new','New',1)) for i,f in enumerate(families)],5,(520,736),OUT/'presets.png').save(OUT/'presets.jpg',quality=92)
grid([(OUT/f"layouts/{fam}-{l['id']}.png",l['name'],name[fam]) for fam in ['cell','flip','neon'] for l in layouts],5,(420,594),OUT/'layouts.png')
grid([(OUT/f"stages/{fam}-{s}.png",f"{s} / {lab}",name[fam]) for fam in ['cell','petal','flip','scoreboard'] for s,lab in [(1,'construction'),(2,'modules'),(3,'colour'),(4,'poster')]],4,(420,594),OUT/'construction.png')
grid([(OUT/f"sources/{s}.png",s.capitalize(),'Flip source') for s in options['source']],4,(420,594),OUT/'sources.png')
var=[('spiral-twist','Twist 220°','Bead rays, cell palette'),('pulse-lozenge','Pulse curve, lozenges','Neon'),('gaps','Gaps and jitter','Perforated, seeded'),('square-beads','Square beads, 3 layers','Field palette'),
 ('sector-fan','Sector fan 140°','Vault palette'),('petal-scallop','Scalloped petals','12 petals, twist'),('petal-neon','Neon petals','Two layers, glow'),('spikes-neon','Neon spikes','140 spikes, jitter .7'),
 ('egg-field','Egg field','Five blooms of eggs'),('perforated-ring','Ring perforations','24 bars'),('word-tilt','Word, contour axis','BEAD / RAY'),('hand-hex','Hand silhouette','Hex lattice'),
 ('star-flipdot','Star, flip-dots','Scoreboard'),('heart-iris','Heart, iris','Light and vision'),('moon-swing','Moon, swinging axis','Op-art palette'),('image-face','Local image','Sampled luminance grid')]
grid([(OUT/f"variations/{s}.png",l,sub) for s,l,sub in var],4,(420,594),OUT/'variations.png')
grid([(OUT/f"formats/{fam}-{f['id']}.png",f['name'],name[fam]) for fam in ['neon','scoreboard','confetti','petal'] for f in formats],4,(520,520),OUT/'formats.png')
# Phone check: every preset at 390 px wide, the width it is seen at on a phone.
grid([(OUT/f"{f['id']}.png",f['name'],'390 px wide') for f in families],5,(390,552),OUT/'phone.png',label_h=50,fonts=(ImageFont.truetype(font,18),tiny),gap=16)
print('Saved comparison, presets, layouts, construction, sources, variations, formats and phone boards.')
