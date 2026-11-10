from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/rotational-limb-study-v1'
source=json.loads((OUT/'source.json').read_text());families=json.loads((OUT/'catalog.json').read_text())['families']
refs={f:r for r in source['references'] for f in r['families']}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
BG='#e9e7e1';INK='#2b2925';MUTED='#6b685f'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet
# Phone check: each showcase board as it reads on a 390 px wide screen.
def phone(sheet,name):
    (OUT/'phone').mkdir(exist_ok=True);fit(sheet,390,100000).save(OUT/'phone'/name)

after=lambda f:'After '+f['after'] if not f['after'].startswith('new') else f['after'].capitalize()
pairs=[('legs',None),('coffee',None),('spiral',None),('handshake',None),('trefoil',None)]
s=grid([item for fid,_ in pairs for f in [next(x for x in families if x['id']==fid)] for item in [(OUT/refs[fid]['file'],'Reference',f"Fukuda, {refs[fid]['title'][:26]}, {refs[fid]['date']}"),(OUT/f"{fid}.png",f"Study / {f['name']}",'Shared construction')]],4,(470,666),OUT/'comparison.png');phone(s,'comparison.png')
s=grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",after(f)[:42]) for i,f in enumerate(families)],4,(520,736),OUT/'presets.png');s.save(OUT/'presets.jpg',quality=92);phone(s,'presets.png')
s=grid([(OUT/f"stages/{f}-{n}.png",f"{n} / {name}",f) for f in ['legs','spiral','trefoil','handshake'] for n,name in [(1,'skeleton'),(2,'repeat / crossings'),(3,'figure'),(4,'poster')]],4,(420,594),OUT/'construction.png');phone(s,'construction.png')
s=grid([(OUT/f"layouts/{f}-{l}.png",{'hero':'Hero','field':'Field','crop':'Cropped giant','pair':'Pair'}[l],f) for f in ['legs','flower','trefoil','tangle','coffee','neon'] for l in ['hero','field','crop','pair']],4,(420,594),OUT/'layouts.png');phone(s,'layouts.png')
s=grid([(OUT/f"formats/{f}-{x}.png",{'poster':'Poster B','square':'Square','landscape':'Landscape','story':'Story 9:16'}[x],f) for f in ['kick','weave','handshake'] for x in ['poster','square','landscape','story']],4,(480,600),OUT/'formats.png');phone(s,'formats.png')
knots=[('trefoil','Trefoil','torus 2/3, 3 crossings'),('figure8','Figure-eight','torus 3/2, 4 crossings'),('torus-2-5','Torus 2/5','5 crossings'),('torus-3-4','Torus 3/4','8 crossings, alternating weave'),('torus-3-5','Torus 3/5','10 crossings'),('torus-5-3','Torus 5/3','12 crossings'),
 ('torus-link-2-4','Torus link 2/4','two components'),('lissajous-3-2','Lissajous 3/2','7 crossings'),('lissajous-3-4','Lissajous 3/4','17 crossings'),('lissajous-5-4','Lissajous 5/4','31 crossings'),('random-1','Random, seed 1','6 harmonics, relaxed'),('random-2','Random, seed 2','5 harmonics'),
 ('random-3','Random, seed 3','7 harmonics'),('hands-35','Two hands, seed 35','open strands'),('laid','Laid crossings','later on top'),('depth','Depth crossings','torus 2/5, its 3-D lift'),('seeded','Seeded crossings','a coin per crossing'),('no-gap','No gap','outline only')]
s=grid([(OUT/f"knots/{k}.png",a,b) for k,a,b in knots],6,(360,510),OUT/'knots.png');phone(s,'knots.png')
ends=['none','disc','hand','foot','heel','cup','beak','arrow']
s=grid([(OUT/f"limbs/end-{e}.png",f"End: {e}",'flower, 6 arms') for e in ends]+[(OUT/f"limbs/shape-{l}.png",f"Limb: {l}",'pinwheel, 6 arms') for l in ['straight','bend','s-curve','hook','knee','wave']]+
 [(OUT/f"limbs/{k}.png",a,b) for k,a,b in [('order-stack','Order: stacked','legs'),('order-cyclic','Order: each over next','legs'),('order-counter','Order: each under next','legs'),('mirror','Mirror every other arm','neon kick'),('curl-spiral','Curl toward the tip','riso, 5 arms'),('both-ends','Ends at both ends','legs')]],5,(380,538),OUT/'limbs.png');phone(s,'limbs.png')
s=grid([(OUT/f"variations/{k}.png",a,b) for k,a,b in [('gear-field','Gear field','kick, mirrored cells'),('hand-sun','Hand sun','16 hands, star hub'),('octopus','Octopus','curled limbs, spectrum'),('beak-ring','Beak ring','12 birds, radial .35'),('coffee-four','Four cups','coffee, 4 arms'),('spiral-pair','Spiral pair','Kyogen leg, dialogue'),
 ('torus-shadow','Torus 3/7','drop shadow'),('lissajous-glow','Lissajous 5/4','spectrum glow'),('tangle-riso','Riso tangle','two inks'),('hands-crop','Hands, cropped','two strands'),('legs-rings','Legs on rings','ramp colour'),('heel-wheel','Heel wheel','12 legs, foot / heel')]],4,(480,679),OUT/'variations.png');phone(s,'variations.png')
print('Saved comparison, presets, construction, layouts, formats, knots, limbs and variations boards, with 390 px phone previews in phone/.')
