from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/glow-aperture-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families']
refs={r['family']:r for r in source['references'] if r.get('family')}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
BG='#e7e6e2';INK='#2b2a2e';MUTED='#6b6970'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet
# Phone check: the poster grid as it reads on a 390 px wide screen (two columns, no labels).
def phone(files,path,cols=2,width=390,gap=8):
    cw=(width-gap*(cols+1))//cols;ch=round(cw*1030/728);rows=(len(files)+cols-1)//cols;sheet=Image.new('RGB',(width,gap+rows*(ch+gap)),'#111')
    for i,f in enumerate(files):sheet.paste(Image.open(f).convert('RGB').resize((cw,ch),Image.Resampling.LANCZOS),(gap+(i%cols)*(cw+gap),gap+(i//cols)*(ch+gap)))
    sheet.save(path)

after=lambda f:f"After {f['after'].split(',')[0]}" if not f['after'].startswith('new') else f['after'].capitalize()
grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date'] or 'undated'}",refs[f['id']]['title'][:34]),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared aperture construction')]],4,(470,665),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",after(f)) for i,f in enumerate(families)],5,(520,736),OUT/'styles.png').save(OUT/'styles.jpg',quality=93)
grid([(OUT/f"layouts/{fam}-{lay}.png",f"{lay.capitalize()}",name) for fam,name in [('club','Neon door'),('smoke','Smoke soles'),('frontier','Spectral field')] for lay in catalog['options']['layout']],5,(420,594),OUT/'layouts.png')
grid([(OUT/f"modes/{row}-{m}.png",m.capitalize(),label) for row,label in [('neon','Aurora ramp, near-black'),('paper','Ember ramp, paper')] for m in catalog['options']['mode']],4,(420,594),OUT/'modes.png')
grid([(OUT/f"stages/{f}-{s}.png",f"{s} / {name}",f) for f in ['halo','smoke','shaft'] for s,name in [(1,'aperture mask'),(2,'falloff field'),(3,'gradient map'),(4,'poster')]],4,(420,594),OUT/'construction.png')
var=[('width-tight','Falloff width 6','Halo window'),('width-wide','Falloff width 80','Halo window'),('curve-hard','Curve 3','Moon gate'),('balance-inner','Inner glow −0.8','Neon door'),('balance-outer','Outer glow +1','Neon door'),
 ('smear-sideways','Smear 1.6 at 0°','Smoke soles'),('offset-cast','Offset 120 at 225°','Ink vessel'),('layers-tunnel','Five nested layers','Neon arch'),('stacked-moons','Three stacked','Moon gate'),('door-row','Four doors','Neon door'),
 ('scribble-field','Scribbles','Spectral field'),('petal-moon','Petals','Moon gate'),('grain-heavy','Grain .32','Ember box'),('haze-figure','Haze .9, fray 1','Shadow veil'),('hand-shadow','Shadow mode, sepia','Backlit hand'),
 ('counter-bleed','Full bleed','Spectrum window'),('ink-beam','Ink ramp, three shafts','Light shaft'),('orb-field','Circle field','Spectral field'),('two-stop','Two-stop ramp','Halo window'),('vase-neon','Halo + neon line','Ink vessel')]
grid([(OUT/f"variations/{s}.png",l,sub) for s,l,sub in var],5,(420,594),OUT/'variations.png')
specs=[(f,fit(Image.open(OUT/f"specimen-{f}.png").convert('RGB'),1800,1500)) for f in ['club','smoke','moon']]
sheet=Image.new('RGB',(1860,sum(s.height for _,s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in specs:
    d.text((30,y),f"{next(x['name'] for x in families if x['id']==f)} / eleven shapes and the ramp",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'shapes.png')
phone([OUT/f"{f['id']}.png" for f in families],OUT/'phone-styles.png')
phone([OUT/f"variations/{s}.png" for s,_,_ in var[:12]],OUT/'phone-variations.png',cols=3)
print('Saved comparison, styles, layouts, modes, construction, variations, shapes and phone-size boards.')
