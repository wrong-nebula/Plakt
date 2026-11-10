from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/strata-field-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];labels=catalog['labels']
refs={r['family']:r for r in source['references'] if r.get('family')}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
BG='#e8e7e2';INK='#2a292e';MUTED='#69686e'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet
# Phone check: the same board at a phone's width.
def phone(sheet,path):sheet.resize((390,round(sheet.height*390/sheet.width)),Image.Resampling.LANCZOS).save(path)
after=lambda f:('After '+f['after'] if not f['after'].startswith('new') else f['after'].capitalize())

phone(grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],'Reference',f"{refs[f['id']]['designer']}, {refs[f['id']]['date']}"),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared strata construction')]],4,(470,666),OUT/'comparison.png'),OUT/'comparison-phone.png')
styles=grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",after(f)[:44]) for i,f in enumerate(families)],4,(540,764),OUT/'styles.png');styles.save(OUT/'styles.jpg',quality=93);phone(styles,OUT/'styles-phone.png')
grid([(OUT/f"stage-{f}-{s}.png",f"{s} / {name}",f) for f in ['awazu','nagai','contour'] for s,name in [(1,'guides'),(2,'offset lines'),(3,'strata colour'),(4,'poster')]],4,(420,594),OUT/'construction.png')
phone(grid([(OUT/f"layouts/{f}-{l}.png",labels['layout'][l],f) for f in ['awazu','contour','neon'] for l in catalog['options']['layout']],5,(400,566),OUT/'layouts.png'),OUT/'layouts-phone.png')
grid([(OUT/f"directions/{f}-{d}.png",labels['direction'][d],f) for f in ['awazu','riso'] for d in catalog['options']['direction']],5,(400,566),OUT/'directions.png')
grid([(OUT/f"displacements/{f}-{d}.png",labels['displace'][d],f) for f in ['nagai','plotter'] for d in catalog['options']['displace']],5,(400,566),OUT/'displacements.png')
grid([(OUT/f"variations/{v['slug']}.png",v['label'],v['state']['family']) for v in catalog['variations']],4,(460,651),OUT/'variations.png')
grid([(OUT/f"seeds/awazu-{s}.png",f"Seed {s}",'Mountain sea') for s in [3,17,58,101,240,777]],6,(360,510),OUT/'seeds.png')
specs=[fit(Image.open(OUT/f"specimen-{f['id']}.png").convert('RGB'),1800,760) for f in families]
sheet=Image.new('RGB',(1860,sum(s.height for s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in zip(families,specs):
    d.text((30,y),f"{f['name']} / base curves and directions",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'specimens.png')
print('Saved comparison, styles, construction, layouts, directions, displacements, variations, seeds and specimen boards, with phone-width versions.')
