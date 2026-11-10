from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/bead-ray-study-v2'
catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];formats=catalog['formats'];options=catalog['options']
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24);tiny=ImageFont.truetype(font,15)
BG='#e9e6df';INK='#2d2d2a';MUTED='#6c6a62'
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

v2=[f for f in families if f['kind']=='v2'];name={f['id']:f['name'] for f in families}
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",f['after'].replace('v2 — ','').capitalize()) for i,f in enumerate(v2)],4,(520,736),OUT/'presets-v2.png').save(OUT/'presets-v2.jpg',quality=92)
grid([(OUT/f"{f['id']}.png",f['name'],'Version 1, unchanged') for f in families if f['kind']!='v2'],5,(420,594),OUT/'presets-v1.png')
gen=[('spiral-golden','Golden angle 137.51°','Phyllotaxis'),('spiral-near-miss','Divergence 137.1°','Spiral arms appear'),('spiral-spokes','Divergence 120.3°','Spokes'),('spiral-scallop','Scalloped petals','Length modulation'),
 ('rings-0','Rings, no phase','Concentric'),('rings-12','Ring phase 12°','Curved arms'),('rings-wavy','Wavy rings','Length modulation'),('vortex-left','Vortex, bend −0.8','Bent rays'),
 ('beads-half','Half-discs','Bent rays'),('beads-star','Stars, colour steps','Bead rays'),('beads-cross','Crosses','Phyllotaxis'),('beads-glyph','Letter beads','BEADRAY along each ray'),
 ('mask-word-clip','Word mask, keep','RAY'),('mask-word-cut','Word mask, cut out','SUN'),('mask-heart','Silhouette mask','Heart, phyllotaxis'),('mask-hand-size','Silhouette sizes beads','Hand, rings')]
grid([(OUT/f"generators/{s}.png",l,sub) for s,l,sub in gen],4,(420,594),OUT/'generators.png')
scr=[('square-tilt','Square elements','Star, tilt'),('hatch-face','Hatch strokes','Local image'),('hatch-eye','Hatch along contours','Eye'),('truchet-word','Truchet tiles','Word WEAVE'),
 ('truchet-radial-grid','Truchet on rings','Whirl'),('grid-triangle','Triangle lattice','Star'),('grid-brick','Brick lattice','Heart'),('grid-spiral','Golden-spiral lattice','Heart'),
 ('dither-ordered','Ordered dither','Bayer 4 × 4'),('dither-diffusion','Error diffusion','Floyd–Steinberg'),('dither-face','Diffusion, image','Local image'),('dither-hex','Diffusion, hex discs','Radial'),
 ('coin-word','Two-sided coins','Word COIN'),('coin-wave','Coins on hex','Wave, shaded edges'),('moire-discs','Moiré discs','Second screen 7°'),('moire-wide','Moiré hatch','Second screen 12°')]
grid([(OUT/f"screens/{s}.png",l,sub) for s,l,sub in scr],4,(420,594),OUT/'screens.png')
grid([(OUT/f"finishes/{fam}-{fin}.png",{'none':'No finish','grain':'Paper grain','riso':'Riso overprint'}[fin],name[fam]) for fam in ['sunflower','tide','riso'] for fin in options['finish']],3,(480,679),OUT/'finishes.png')
grid([(OUT/f"series/{fam}-{k}.png",f"{name[fam]} {k} of 4",'One rule, stepped') for fam in ['sunflower','truchet','letter','coin'] for k in [1,2,3,4]],4,(420,594),OUT/'series.png')
grid([(OUT/f"stages/{fam}-{s}.png",f"{s} / {lab}",name[fam]) for fam in ['sunflower','tide','truchet','coin'] for s,lab in [(1,'construction'),(2,'modules'),(3,'colour'),(4,'poster')]],4,(420,594),OUT/'construction.png')
grid([(OUT/f"formats/{fam}-{f['id']}.png",f['name'],name[fam]) for fam in ['sunflower','truchet','tide'] for f in formats],4,(520,520),OUT/'formats.png')
# Phone check: every v2 preset at 390 px wide, the width it is seen at on a phone.
grid([(OUT/f"{f['id']}.png",f['name'],'390 px wide') for f in v2],4,(390,552),OUT/'phone.png',label_h=50,fonts=(ImageFont.truetype(font,18),tiny),gap=16)
print('Saved presets-v2, presets-v1, generators, screens, finishes, series, construction, formats and phone boards.')
