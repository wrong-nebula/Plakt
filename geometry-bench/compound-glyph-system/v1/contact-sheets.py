from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/compound-glyph-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families']
refs={r['family']:r for r in source['references']}
# Hiragino Sans GB covers Latin, kana and the rarer compounds (沝 众 吕 砳 䡛) that the Japanese cuts lack.
font='/System/Library/Fonts/Hiragino Sans GB.ttc'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
def clip(d,text,f,w):
    while text and d.textlength(text,font=f)>w:text=text[:-2]+'…' if len(text)>2 else ''
    return text
BG='#e7e6e1';INK='#2d2d2a';MUTED='#6c6a62'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90,heading=None):
    rows=(len(items)+cols-1)//cols;top=70 if heading else 0
    sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+top+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    if heading:d.text((30,24),heading,font=title,fill=INK)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+top+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2))
        if label_h:d.text((x,y+cell[1]+14),clip(d,label,title,cell[0]),font=title,fill=INK);d.text((x,y+cell[1]+54),clip(d,sub,small,cell[0]),font=small,fill=MUTED)
    sheet.save(path);return sheet

grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",f"{refs[f['id']]['designer']}, {refs[f['id']]['title'][:34]}"),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared sampler and sets')]],4,(520,736),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",f"After {f['after']}"[:52] if not f['after'].startswith('new') else f['after'].capitalize()) for i,f in enumerate(families)],5,(560,792),OUT/'shape-systems.png').save(OUT/'shape-systems.jpg',quality=93)
# Phone check: every style at the size a poster takes in a phone feed (about 330 × 467 px), no labels.
grid([(OUT/f"{f['id']}.png",'','') for f in families],5,(330,467),OUT/'phone-check.png',label_h=0,heading='Phone check — each poster at about 330 × 467 px')
grid([(OUT/f"type/{f['id']}-{k}.png",f['name'],sub) for k,sub in [('type','TYPE / WITH / TYPE'),('kanji','水 as the silhouette')] for f in families],5,(440,623),OUT/'text-transfer.png')
grid([(OUT/f"masks/{m['id']}.png",m['name'],'Kanji in kanji style') for m in catalog['masks']],6,(400,566),OUT/'masks.png')
grid([(OUT/f"sets/{s['id']}.png",s['name'][:24],'Tree, levels by depth') for s in catalog['sets']],6,(400,566),OUT/'sets.png')
grid([(OUT/f"layouts/{l['id']}.png",l['name'],'Riso wave style') for l in catalog['layouts']],5,(440,623),OUT/'layouts.png')
opts=[('flow',catalog['options']['flow'],'Alarm shells'),('field',catalog['options']['field'],'Forest ink, disc'),('render',catalog['options']['render'],'Written head'),('level',catalog['options']['level'],'Kanji in kanji'),('odd',catalog['options']['odd'],'Beach crowd')]
grid([(OUT/f"options/{k}-{v}.png",f"{k} / {v}",sub) for k,vals,sub in opts for v in vals],7,(340,481),OUT/'options.png')
grid([(OUT/f"variations/{v['slug']}.png",v['title'][:30],v['state']['family']) for v in catalog['variations']],6,(400,566),OUT/'variations.png')
grid([(OUT/f"stages/{f}-{s}.png",f"{s} / {name}",f) for f in ['alarm','kanji','scribe'] for s,name in [(1,'silhouette, field, flow'),(2,'blue-noise samples'),(3,'escalated marks'),(4,'poster')]],4,(420,594),OUT/'construction.png')
grid([(OUT/f"specimen-{f['id']}.png",f['name'],'Sets and silhouettes') for f in families],5,(560,1320),OUT/'specimens.png')
print('Saved comparison, shape systems, phone check, text transfer, masks, sets, layouts, options, variations, construction and specimen boards.')
