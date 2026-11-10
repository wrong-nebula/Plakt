from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/isometric-prism-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];views=catalog['views']
refs={r['family']:r for r in source['references'] if r.get('family')}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
BG='#e7e6e1';INK='#2d2d2a';MUTED='#6c6a62'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet

grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",refs[f['id']]['title']),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared cell alphabet')]],5,(520,736),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",f"After {f['after']}" if not f['after'].startswith('new') else f['after'].capitalize()) for i,f in enumerate(families)],3,(660,934),OUT/'shape-systems.png').save(OUT/'shape-systems.jpg',quality=94)
grid([(OUT/f"{f['id']}-type-system.png",f['name'],'TYPE / SYSTEM') for f in families],3,(560,792),OUT/'text-transfer.png')
for family in ['voxel','plinth']:grid([(OUT/f"views/{family}-{v['id']}.png",v['name'],family) for v in views],5,(420,594),OUT/f'views-{family}.png')
grid([(OUT/f"variations/{slug}.png",label,sub) for slug,label,sub in [('width','Cell width 1.6','Dark monoliths'),('slant','Slant .35','Neon solids'),('wave','Wave 2.2','Speckled beams'),('skyline','Skyline jitter','Pixel relief laid down'),
 ('inset','Block gap .14','Cube walls'),('step','Step 1.2','Cube walls'),('shadow','Cut shadow mode','Floor plinths'),('wire','Wire mode','Striped slabs'),('neon','Neon mode, acid palette','Floor plinths'),('stripes','Stripes, new palette','Dark monoliths'),('grid-floor','Lying on a grid floor','Neon solids'),('cabinet-voxel','Cabinet oblique','Cube walls')]],4,(480,679),OUT/'variations.png')
grid([(OUT/f"stage-{f}-{s}.png",f"{s} / {name}",f) for f in ['plinth','voxel','shadow'] for s,name in [(1,'cell skeleton'),(2,'projected cells'),(3,'extruded prisms'),(4,'poster')]],4,(420,594),OUT/'construction.png')

specs=[fit(Image.open(OUT/f"specimen-{f['id']}.png").convert('RGB'),1800,820) for f in families]
sheet=Image.new('RGB',(1860,sum(s.height for s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in zip(families,specs):
    d.text((30,y),f"{f['name']} / A–Z, 0–9, punctuation",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'alphabet.png')
print('Saved comparison, shape systems, text transfer, views, variations, construction and alphabet boards.')
