from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/arch-envelope-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families']
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

after=lambda f:f['after'].capitalize() if f['after'].startswith('new') else 'After '+f['after']
grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",refs[f['id']]['title'][:34]),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared envelope system')]],4,(520,736),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",after(f)) for i,f in enumerate(families)],5,(620,877),OUT/'styles.png').save(OUT/'styles.jpg',quality=93)
grid([(OUT/f"texts/{f['id']}-type-system.png",f['name'],'TYPE / SYSTEM') for f in families],5,(520,736),OUT/'text-transfer.png')
grid([(OUT/f"texts/{f['id']}-{slug}.png",f['name'],text) for f in families[:5] for slug,text in [('arch-envelope','ARCH ENVELOPE'),('tokyo','Tokyo 1966'),('hello','Hello, World!')]],6,(400,566),OUT/'text-transfer-more.png')
grid([(OUT/f"envelopes/{e['id']}-{s}.png",e['name'],f"{s} stems") for e in catalog['envelopes'] for s in ['vertical','radial']],6,(420,594),OUT/'envelopes.png')
grid([(OUT/f"fonts/{f['id']}.png",f['name'][:22],'bulge, vanishing extrusion') for f in catalog['fonts']],5,(440,622),OUT/'fonts.png')
grid([(OUT/f"layouts/{l['id']}.png",l['name'],'Gable banner style') for l in catalog['layouts']],6,(440,622),OUT/'layouts.png')
grid([(OUT/f"variations/{v['slug']}.png",v['label'],v['slug']) for v in catalog['variations']],6,(440,622),OUT/'variations.png')
grid([(OUT/f"stages/{f}-{s}.png",f"{s} / {name}",f) for f in ['silver-arch','valley','night-drive'] for s,name in [(1,'setting and envelope'),(2,'warp'),(3,'lettering'),(4,'poster')]],4,(420,594),OUT/'construction.png')
grid([(OUT/f"extremes/{e['id']}-{s}.png",f"{e['name']} at full depth",f"{s} stems") for e in catalog['envelopes'] for s in ['vertical','radial']]+[(OUT/'extremes/coarse-flattening.png','Coarse flattening','6 segments per letter height')],5,(420,594),OUT/'extremes.png')

specs=[fit(Image.open(OUT/f"specimen-{f['id']}.png").convert('RGB'),1800,1400) for f in families]
sheet=Image.new('RGB',(1860,sum(s.height for s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in zip(families,specs):
    d.text((30,y),f"{f['name']} / alphabet, digits, punctuation",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'alphabet.png')
print('Saved comparison, styles, text transfer, envelopes, fonts, layouts, variations, construction, extremes and alphabet boards.')
