from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

HERE=Path(__file__).resolve().parent
ROOT=Path(str(HERE).split('/geometry-bench/')[0])
OUT=ROOT/'output/compound-glyph-study-v2'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];v2=catalog['v2Families']
refs={r['family']:r for r in source['references']}
# Hiragino Sans GB covers Latin, kana and the rarer compounds the Japanese cuts lack.
font='/System/Library/Fonts/Hiragino Sans GB.ttc'
title=ImageFont.truetype(font,34);small=ImageFont.truetype(font,24)
# … but not ◉ ◯ ♡ ♥, which the Japanese cut has: labels with them switch face.
alt='/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc';altTitle=ImageFont.truetype(alt,34);altSmall=ImageFont.truetype(alt,24)
pick=lambda text,f:(altTitle if f is title else altSmall) if any(c in '◉◯♡♥' for c in text) else f
BG='#e7e6e1';INK='#2d2d2a';MUTED='#6c6a62'
def clip(d,text,f,w):
    while text and d.textlength(text,font=f)>w:text=text[:-2]+'…' if len(text)>2 else ''
    return text
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90,heading=None):
    rows=(len(items)+cols-1)//cols;top=70 if heading else 0
    sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+top+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    if heading:d.text((30,24),heading,font=title,fill=INK)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+top+(i//cols)*(cell[1]+label_h+30)
        with Image.open(name) as src:im=fit(src.convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2))
        if label_h:d.text((x,y+cell[1]+14),clip(d,label,pick(label,title),cell[0]),font=pick(label,title),fill=INK);d.text((x,y+cell[1]+54),clip(d,sub,pick(sub,small),cell[0]),font=pick(sub,small),fill=MUTED)
    sheet.save(path);return sheet

name={f['id']:f['name'] for f in families}
grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date']}",f"{refs[f['id']]['designer']}, {refs[f['id']]['title'][:34]}"),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared sampler and sets')]],4,(520,736),OUT/'comparison.png')
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",('v2 · ' if f['id'] in v2 else '')+(f"After {f['after']}" if not f['after'].startswith('new') else f['after'].capitalize())) for i,f in enumerate(families)],6,(460,651),OUT/'shape-systems.png').save(OUT/'shape-systems.jpg',quality=92)
grid([(OUT/f"{f}.png",f"{name[f]}",'New in version 2') for f in v2],4,(560,792),OUT/'v2-styles.png')
grid([(OUT/f"{f['id']}.png",'','') for f in families],6,(300,425),OUT/'phone-check.png',label_h=0,heading='Phone check — every style at about 300 × 425 px')
grid([(OUT/f"type/{f['id']}-{k}.png",f['name'],sub) for k,sub in [('type','TYPE / WITH / TYPE'),('kanji','水 as the silhouette')] for f in families],6,(360,510),OUT/'text-transfer.png')
pk=catalog['packings']
grid([(OUT/f"packings/{p['id']}-{k}.png",p['name'],sub) for k,sub in [('kanji','Kanji in kanji'),('script','Contour script')] for p in pk],7,(360,510),OUT/'packings.png')
fields=['attract','image-moon','image-dunes','image-ripple','image-paper','painted','hidden','hidden-love','void']
grid([(OUT/f"fields/{f}.png",f.replace('-',' '),'Density field') for f in fields],5,(400,566),OUT/'fields.png')
grid([(OUT/f"layers/{f}.png",f.replace('-',' '),'Layers') for f in ['three','outside-set','word-in-shape','sun-moon']]+[(OUT/'fields/hidden.png','hidden word','Second word, dense'),(OUT/'fields/void.png','void','Second word, cut out')],6,(400,566),OUT/'layers.png')
v2sets=[s for s in catalog['sets'] if (OUT/f"sets/{s['id']}.png").exists()]
grid([(OUT/f"sets/{s['id']}.png",s['name'],'New set') for s in v2sets]+[(OUT/'sets/weighted.png','木*4 林 森*.4','Weighted custom chain')],6,(360,510),OUT/'sets.png')
fm=catalog['formats']
grid([(OUT/f"formats/{fam}-{f['id']}.png",f"{f['name']}",name[fam]) for fam in ['electro','layers','flow'] for f in fm],4,(520,520),OUT/'formats.png')
grid([(OUT/f"{n}.png",n.split('/')[1].replace('-',' '),sub) for n,sub in [('narrative/pins','Three placed odd ones'),('narrative/heroes','Placed heroes'),('narrative/vertical','Gradient map, top to bottom'),('narrative/depth','Gradient map, edge to core'),('narrative/knockout','Title knocked out'),('crops/forest-macro','Macro crop'),('crops/kanji-macro','Macro crop'),('crops/alarm-macro','Macro crop')]],4,(440,623),OUT/'narrative.png')
ser=[fit(Image.open(OUT/f"series/{s['slug']}.png").convert('RGB'),2400,1100) for s in catalog['series']]
sheet=Image.new('RGB',(2460,sum(s.height for s in ser)+40+len(ser)*80),BG);d=ImageDraw.Draw(sheet);y=30
for s,meta in zip(ser,catalog['series']):
    d.text((30,y),f"Series / {meta['slug'].replace('-',' ')}",font=title,fill=INK);sheet.paste(s,(30,y+50));y+=s.height+80
sheet.save(OUT/'series.png')
grid([(OUT/f"stages/{f}-{s}.png",f"{s} / {n}",name[f]) for f in ['contour','layers','flow'] for s,n in [(1,'silhouette, field, flow'),(2,'samples'),(3,'escalated marks'),(4,'poster')]],4,(400,566),OUT/'construction.png')
grid([(OUT/f"specimen-{f}.png",name[f],'Sets and silhouettes') for f in v2],4,(520,1500),OUT/'specimens.png')
grid([(OUT/f"images/{i['id']}.png",i['name'],'Rendered here, 96 × 96') for i in catalog['images']],3,(384,384),OUT/'images.png')
print('Saved comparison, shape systems, v2 styles, phone check, text transfer, packings, fields, layers, sets, formats, narrative, series, construction, specimens and images boards.')
