from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/showa-kana-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];styles=catalog['styles'];options=catalog['options']
refs={r['family']:r for r in source['references'] if r.get('family')}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf',24)  # subtitles carry kana and kanji
BG='#e8e5de';INK='#2d2b27';MUTED='#6d685d'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet
DIR={'ltr':'Left to right','rtl':'Right to left','ttb':'Vertical columns'}
grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",refs[f['id']]['title'][:40]),(OUT/f"{f['id']}.png",f"Study / {f['name']}",f"{DIR[f['set']['direction']]}, {f['set']['style']}")]],4,(520,736),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",('After '+f['after'].split(',')[0]) if not f['after'].startswith('new') else f['after'].replace('new —','New:')) for i,f in enumerate(families)],5,(560,792),OUT/'families.png').save(OUT/'families.jpg',quality=92)
for slug,text in [('tokyo','トーキョー'),('expo','日本大博覧会')]:grid([(OUT/f"{f['id']}-{slug}.png",f['name'],text) for f in families],5,(440,622),OUT/f'text-transfer-{slug}.png')
grid([(OUT/f"directions/{f}-{d}.png",DIR[d],f) for f in ['victrola','design','neon','kyoto'] for d in options['direction']],6,(400,566),OUT/'directions.png')
grid([(OUT/f"layouts/{f}-{l}.png",l.capitalize(),f) for f in ['expo','hanabi'] for l in options['layout']],5,(420,594),OUT/'layouts.png')
grid([(OUT/f"styles/{f}-{s['id']}.png",s['name'],f) for f in ['victrola','riso'] for s in styles]+[(OUT/f"finishes/{x}.png",x.capitalize(),'finish, calpis') for x in options['finish']],7,(380,538),OUT/'constructions-finishes.png')
grid([(OUT/f"stage-{f}-{s}.png",f"{s} / {name}",f) for f in ['victrola','design','kyoto'] for s,name in [(1,'skeleton'),(2,'stroke kit'),(3,'letters'),(4,'poster')]],4,(420,594),OUT/'construction.png')
var=[('light','Weight 8','Gold bars'),('heavy','Weight 24','Wedge brush'),('contrast-zero','Contrast 0','Wedge brush'),('curve-full','Curve 1','Exposition bars'),('corner-round','Corner 1','Block kana'),('slant','Slant .35','Gold bars'),('condensed','Width .66','Slanted gold'),('wide','Width 1.35','Deco inline'),('interlock','Interlock 1','Wedge brush'),
 ('tracking-open','Tracking .5','Neon tubes'),('tilt-steep','Tilt −35°','Acid outline'),('arc-bend','Arch bend 1.6, two rows','Arched stencil'),('romaji','tōkyō / matsuri','romaji input'),('latin','EXPO / 1936','Latin bar alphabet'),('ornament-none','No ornament','Gold bars'),('ornament-triangle','Triangle','Exposition bars'),('ornament-rays','Rays','Neon tubes'),('ornament-band','Band','Fluoro overprint')]
grid([(OUT/f"variations/{s}.png",a,b) for s,a,b in var],6,(380,538),OUT/'variations.png')
specs=[fit(Image.open(OUT/f"specimen-{f}.png").convert('RGB'),1500,2600) for f in ['victrola','design','neon','kyoto']]
sheet=Image.new('RGB',(sum(s.width for s in specs)+30*5,max(s.height for s in specs)+110),BG);d=ImageDraw.Draw(sheet);x=30
for s,st in zip(specs,styles):
    d.text((x,30),f"{st['name']} / the whole kit",font=title,fill=INK);sheet.paste(s,(x,90));x+=s.width+30
sheet.save(OUT/'alphabet.png')
pairs=[fit(Image.open(OUT/f"pairs-{s['id']}.png").convert('RGB'),1400,900) for s in styles]
sheet=Image.new('RGB',(2*1400+90,sum(p.height for p in pairs[::2])+2*90+30),BG);d=ImageDraw.Draw(sheet)
for i,(p,st) in enumerate(zip(pairs,styles)):
    x=30+(i%2)*(1400+30);y=30+(i//2)*(pairs[0].height+90);d.text((x,y),f"{st['name']} / look-alikes",font=title,fill=INK);sheet.paste(p,(x,y+50))
sheet.save(OUT/'lookalikes.png')
# Phone check: every family at 360 px wide, the size it is read at on a phone.
grid([(OUT/f"{f['id']}.png",f['name'],'360 px wide') for f in families],7,(360,509),OUT/'phone-size.png',label_h=70)
print('Saved comparison, families, text transfer, directions, layouts, constructions-finishes, construction, variations, alphabet, look-alikes and phone-size boards.')
