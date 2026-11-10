from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/tategaki-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];variations=catalog['variations']
refs={r['family']:r for r in source['references']}
font='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
BG='#e7e6e1';INK='#2d2d2a';MUTED='#6c6a62'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90,head=None):
    rows=(len(items)+cols-1)//cols;top=70 if head else 0;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+top+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    if head:d.text((30,30),head,font=title,fill=INK)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+top+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2))
        if label_h:d.text((x,y+cell[1]+14),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet

name={f['id']:f['name'] for f in families}
grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",refs[f['id']]['designer']),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared vertical setting')]],4,(520,736),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",f"After {f['after'].split(',')[0]}" if not f['after'].startswith('new') else f['after'].capitalize()) for i,f in enumerate(families)],5,(600,849),OUT/'styles.png').save(OUT/'styles.jpg',quality=92)
for slug,label in [('transfer','縦組の柱 — ruby, brackets, small kana, ー, 26, Latin'),('haiku','古池や — Bashō'),('festival','夏祭り — title, 15 and 19 tate-chū-yoko where set')]:
    grid([(OUT/f"{f['id']}-{slug}.png",f['name'],slug) for f in families],5,(520,736),OUT/f'text-{slug}.png')
by={v['file']:v for v in variations}
def vboard(prefixes,path,cols=6):
    items=[(OUT/v['file'],v['label'],v['style']) for v in variations if any(v['file'].split('/')[1].startswith(p) for p in prefixes)]
    grid(items,cols,(400,566),OUT/path)
vboard(['align-','layout-','rtl-'],'variations-composition.png',6)
vboard(['kana-','jitter','step-','stagger','rhythm','tracking','title'],'variations-rhythm.png',4)
vboard(['colour-','fill-','ground-'],'variations-colour.png',6)
vboard(['numerals-','latin-','ruby-','face-'],'variations-setting.png',6)
grid([(OUT/f"stage-{f}-{s}.png",f"{s} / {n}",name[f]) for f in ['noh','ballet','prewar','manuscript'] for s,n in enumerate(catalog['stages'],1)],4,(420,594),OUT/'construction.png')
# Phone reading check: every style at 390 px wide, the width of a phone screen.
grid([(OUT/f"{f['id']}.png",f['name'],'') for f in families],5,(390,552),OUT/'phone.png',label_h=50)
specs=[(f,fit(Image.open(OUT/f'specimen-{f}.png').convert('RGB'),1800,1400)) for f in catalog['faces']]
sheet=Image.new('RGB',(1860,sum(s.height for _,s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in specs:
    d.text((30,y),f"{catalog['faces'][f]['name']} / {len(catalog['faces'][f]['verticalForms'])} vertical forms: horizontal above, column form below; kana in columns",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'vertical-forms.png')
print('Saved comparison, styles, three text-transfer boards, four variation boards, construction, phone and vertical-forms boards.')
