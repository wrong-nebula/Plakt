from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/spectral-echo-study-v1'
source=json.loads((OUT/'source.json').read_text());families=json.loads((OUT/'catalog.json').read_text())['families']
refs={r['family']:r for r in source['references'] if r.get('family')}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
BG='#e9e8e4';INK='#2b2a30';MUTED='#6b6a70'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet

grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference",f"{refs[f['id']]['designer']}, {refs[f['id']]['title'][:28]}"),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Any text, any face')]],6,(470,666),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",('After '+f['after'] if not f['after'].startswith('new') else f['after'].capitalize())[:40]) for i,f in enumerate(families)],4,(560,792),OUT/'styles.png').save(OUT/'styles.jpg',quality=94)
grid([(OUT/f"{f['id']}-{slug}.png",f['name'],text) for slug,text in [('ja','光 / 音'),('latin','TYPE / SYSTEM')] for f in families],7,(380,538),OUT/'text-transfer.png')
grid([(OUT/f"variations/{slug}.png",label,sub) for slug,label,sub in [('beams','Beams','Neon trail, downward + stretch'),('spectrum-ground','Spectrum ground','Spectral bloom'),('difference','Difference blend','Chromatic split'),('line-bloom','Outline bloom on night','Spectral bloom'),
 ('orbit-wide','Wide orbit','Orbit fan, 28 copies'),('smear-rows','Smear in rows','Spectral smear'),('column','Vertical column','Spectral bloom'),('tunnel-turn','Turning tunnel','Zoom tunnel'),('prism-echo','Prism with echoes','Prism windows'),('slices-mono','40 bands','Spectral smear, mono face'),('radial-six','Six-way split','Chromatic split'),('fade-out','Long fade','Neon trail, 40 copies')]],4,(480,679),OUT/'variations.png')
grid([(OUT/f"stage-{f}-{s}.png",f"{s} / {name}",f) for f in ['bloom','smear','trail'] for s,name in [(1,'glyphs and anchors'),(2,'copy transforms'),(3,'spectrum'),(4,'poster')]],4,(420,594),OUT/'construction.png')
specs=[fit(Image.open(OUT/f"specimen-{f['id']}.png").convert('RGB'),1800,700) for f in families]
sheet=Image.new('RGB',(1860,sum(s.height for s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in zip(families,specs):
    d.text((30,y),f"{f['name']} / specimen",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'alphabet.png')
print('Saved comparison, styles, text transfer, variations, construction and alphabet boards.')
