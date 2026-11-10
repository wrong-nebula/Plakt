from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/wagara-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text())
families=catalog['families'];layouts=catalog['layouts'];patterns=catalog['patterns'];sources=catalog['letterSources']
refs={r['family']:r for r in source['references']}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
BG='#e9e6df';INK='#2b2a27';MUTED='#6b685f'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet
after=lambda f:f['after'][0].upper()+f['after'][1:] if f['after'].startswith('new') else 'After '+f['after'].split(',')[0]

grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",refs[f['id']]['designer']),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared kit, any text')]],4,(520,736),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",after(f)) for i,f in enumerate(families)],3,(660,934),OUT/'styles.png').save(OUT/'styles.jpg',quality=93)
grid([(OUT/f"{f['id']}-type-system.png",f['name'],'TYPE / SYSTEM') for f in families],3,(560,792),OUT/'text-transfer.png')
for family in ['tanaka','neon']:grid([(OUT/f"layouts/{family}-{l['id']}.png",l['name'],family) for l in layouts],4,(480,679),OUT/f'layouts-{family}.png')
grid([(OUT/f"scales/{f}-{s}.png",f"Pattern scale {s}",f) for f in ['tanaka','kamekura','neon','aizome'] for s in [10,24,60,160]],4,(420,594),OUT/'scales.png')
grid([(OUT/f"sources/{s['id']}.png",s['name'],s['note']) for s in sources],5,(420,594),OUT/'letter-sources.png')
grid([(OUT/f"variations/{slug}.png",label,sub) for slug,label,sub in [('heavy','Weight .15','Nippon windows'),('light','Weight −.02, wide gutter','Nippon windows'),('condensed','Width .62, stacked','Wave horizon'),('turned','Rotate 30°, +15° per letter','Neon wagara'),
 ('field-anchor','One seigaiha field behind all','Nippon windows'),('two-ink','Two inks only','Nippon windows'),('swap','Inks swapped per letter','Sunrise field, stacked'),('rim','Rim edge','Nippon windows'),
 ('double','Double keyline','Neon wagara'),('block','Block shadow','Gold crest bands'),('glow','Neon glow','Nippon windows'),('shuffle','Shuffled sequence','Indigo cotton'),
 ('figurative','Crests in the letters','Gold crest bands'),('detail','Detail 4, line 1.6','Indigo cotton'),('ground-asanoha','Asanoha ground','Nippon windows'),('kabuki-frame','Checked frame','Kabuki checks')]],4,(480,679),OUT/'variations.png')
grid([(OUT/f"stage-{f}-{s}.png",f"{s} / {name}",f) for f in ['tanaka','hinode','neon'] for s,name in [(1,'letter outlines'),(2,'open windows'),(3,'clipped windows'),(4,'poster')]],4,(420,594),OUT/'construction.png')
grid([(OUT/f"patterns/{p['id']}-repeat.png",f"{p['name']} {p['tile'][0]:.0f}×{p['tile'][1]:.0f}",f"{p['gloss']} — tile ×9") for p in patterns],6,(360,360),OUT/'tiles.png')
grid([(OUT/f"kit-{f['id']}.png",f['name'],'eighteen patterns in this style’s inks') for f in families[:6]],2,(1200,760),OUT/'kits.png')

specs=[fit(Image.open(OUT/f"specimen-{f['id']}.png").convert('RGB'),1800,760) for f in families]
sheet=Image.new('RGB',(1860,sum(s.height for s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in zip(families,specs):
    d.text((30,y),f"{f['name']} / A–Z, 0–9, punctuation as windows",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'alphabet.png')
print('Saved comparison, styles, text transfer, layouts, scales, letter sources, variations, construction, tiles, kits and alphabet boards.')
