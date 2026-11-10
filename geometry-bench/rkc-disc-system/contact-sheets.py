from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

OUT=Path(__file__).resolve().parents[2]/'output/rkc-disc-study-v2'
source=json.loads((OUT/'source.json').read_text())
catalog=json.loads((OUT/'catalog.json').read_text())
crop=Image.open(OUT/'reference.png').convert('RGB').crop(tuple(source['crop']))
crop.save(OUT/'reference-crop.png')
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(FONT,42);small=ImageFont.truetype(FONT,28)
BG='#ebe7dc';INK='#292d24';SOFT='#6c6e5e'

def fit(im,w,h):
    f=min(w/im.width,h/im.height)
    return im.resize((round(im.width*f),round(im.height*f)),Image.Resampling.LANCZOS)

# Source and the December rule, at the same height.
sheet=Image.new('RGB',(2300,1760),BG);d=ImageDraw.Draw(sheet)
for i,(im,label,sub) in enumerate([(crop,'Reference','Giliane Cachin + Viltė Jurgutytė / photographed print'),
    (Image.open(OUT/'december.png').convert('RGB'),'December rule','One 5 × 7 field / loose discs on a backing / measured inks')]):
    im=fit(im,1050,1560);x=40+i*1150;sheet.paste(im,(x+(1050-im.width)//2,35))
    d.text((x,1630),label,fill=INK,font=title);d.text((x,1690),sub,fill=SOFT,font=small)
sheet.save(OUT/'comparison.png');sheet.save(OUT/'comparison.jpg',quality=95)

def row(items,filename,cell=(560,780),gap=40,note=True):
    w=len(items)*(cell[0]+gap)+gap;h=cell[1]+(170 if note else 120)
    sheet=Image.new('RGB',(w,h),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        im=fit(Image.open(OUT/name).convert('RGB'),*cell);x=gap+i*(cell[0]+gap)
        sheet.paste(im,(x+(cell[0]-im.width)//2,30))
        d.text((x,cell[1]+50),label,fill=INK,font=title)
        if sub:d.text((x,cell[1]+108),sub,fill=SOFT,font=small)
    sheet.save(OUT/filename)

bonds={b['id']:b['name'].lower() for b in catalog['bonds']}
row([(p['id']+'.png',f"{i+1:02} / {p['name']}",f"letters {bonds[p['state']['figure']]} · counters {bonds[p['state']['ground']]}") for i,p in enumerate(catalog['presets'])],'presets.png',cell=(520,730))
row([(f"family-{f['id']}.png",f"{i+1:02} / {f['name']}",'Same letter map, bonds and inks') for i,f in enumerate(catalog['families'])],'families.png')
row([(f'stage-{i+1}.png',label,None) for i,label in enumerate(['1 / lattice','2 / two-ink field','3 / bonds','4 / fillets & necks'])],'construction.png',cell=(440,620),note=False)

# Bond matrix: letter bonds down the side, counter bonds across the top.
ids=[b['id'] for b in catalog['bonds']];cw,ch,gap,left,top=430,600,24,90,90
sheet=Image.new('RGB',(left+4*(cw+gap)+gap,top+4*(ch+gap)+gap),BG);d=ImageDraw.Draw(sheet)
for j,g in enumerate(ids):d.text((left+gap+j*(cw+gap),30),'counters '+bonds[g],fill=INK,font=small)
for i,f in enumerate(ids):
    label=Image.new('RGB',(ch,60),BG);ImageDraw.Draw(label).text((0,10),'letters '+bonds[f],fill=INK,font=small)
    sheet.paste(label.rotate(90,expand=True),(18,top+i*(ch+gap)))
    for j,g in enumerate(ids):
        im=fit(Image.open(OUT/'bonds'/f'{f}-{g}.png').convert('RGB'),cw,ch)
        sheet.paste(im,(left+gap+j*(cw+gap)+(cw-im.width)//2,top+i*(ch+gap)))
sheet.save(OUT/'bonds.png')

# Fit: the tall formats in one row, the wide ones stacked beneath.
names={f['id']:f['name'] for f in catalog['formats']}
tall=['december','poster','a-series','square','story'];wide=['landscape','billboard']
sheet=Image.new('RGB',(2400,3200),BG);d=ImageDraw.Draw(sheet);x=30
for fid in tall:
    im=fit(Image.open(OUT/f'fit-{fid}.png').convert('RGB'),440,640);sheet.paste(im,(x,30))
    d.text((x,690),names[fid],font=small,fill=INK);x+=im.width+28
y=760
for fid in wide:
    im=fit(Image.open(OUT/f'fit-{fid}.png').convert('RGB'),2340 if fid=='billboard' else 1000,560)
    sheet.paste(im,(30,y));d.text((30,y+im.height+10),names[fid],font=small,fill=INK);y+=im.height+70
sheet=sheet.crop((0,0,2400,y));sheet.save(OUT/'fit-formats.png')
print('Saved comparison, rules, families, construction, bond matrix and fit-format boards.')
