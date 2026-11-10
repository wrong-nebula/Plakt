from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/glow-aperture-study-v2'
catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];demos=catalog['demos']
source=json.loads((OUT/'source.json').read_text());refs={r['family']:r for r in source['references'] if r.get('family')}
serif='/System/Library/Fonts/Supplemental/Georgia.ttf';sans='/System/Library/Fonts/Supplemental/Arial.ttf'
title=ImageFont.truetype(serif,34);small=ImageFont.truetype(sans,23)
BG='#ebe8e1';INK='#2a2a28';MUTED='#6a675f'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=90):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(30+cols*(cell[0]+30),30+rows*(cell[1]+label_h+30)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=30+(i%cols)*(cell[0]+30);y=30+(i//cols)*(cell[1]+label_h+30);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+cell[1]-im.height));d.text((x,y+cell[1]+12),label,font=title,fill=INK);d.text((x,y+cell[1]+54),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet
# Phone check: posters as they read on a 390 px wide screen.
def phone(files,path,cols=2,width=390,gap=8):
    cw=(width-gap*(cols+1))//cols;tiles=[fit(Image.open(f).convert('RGB'),cw,round(cw*1.5)) for f in files];rows=[tiles[i:i+cols] for i in range(0,len(tiles),cols)]
    h=gap+sum(max(t.height for t in r)+gap for r in rows);sheet=Image.new('RGB',(width,h),'#1b1b1a');y=gap
    for r in rows:
        for j,t in enumerate(r):sheet.paste(t,(gap+j*(cw+gap),y))
        y+=max(t.height for t in r)+gap
    sheet.save(path)

calm=[f for f in families if f['calm']];old=[f for f in families if not f['calm']];byid={f['id']:f for f in families}
lead=calm+[byid[i] for i in ['halo','vessel','moon']]
grid([(OUT/f"{f['id']}.png",f"{i+1:02} / {f['name']}",f['after'].replace('new — ','New · ') if f['calm'] else 'Version 1 · '+f['after'].split(',')[0].replace('new — ','new ')) for i,f in enumerate(lead)],4,(460,650),OUT/'styles.png').save(OUT/'styles.jpg',quality=93)
grid([(OUT/f"{f['id']}.png",f['name'],'v2 calm' if f['calm'] else 'v1') for f in calm+old],7,(300,424),OUT/'all-styles.png',label_h=80)
for group,cols in [('words',4),('shapes',4),('light',4),('finishes',4),('series',4),('formats',4)]:
    grid([(OUT/f"demos/{group}-{slug}.png",label,slug) for slug,label,_ in demos[group]],cols,(420,594),OUT/f'{group}.png')
grid([(OUT/f"stages/{f}-{s}.png",f"{s} / {n}",byid[f]['name']) for f in ['lantern','ridges','stairs'] for s,n in [(1,'aperture mask'),(2,'falloff field'),(3,'gradient map'),(4,'poster')]],4,(420,594),OUT/'construction.png')
specs=[(f,fit(Image.open(OUT/f"specimen-{f}.png").convert('RGB'),1800,1400)) for f in ['lantern','stairs','fog']]
sheet=Image.new('RGB',(1860,sum(s.height for _,s in specs)+60+len(specs)*80),BG);d=ImageDraw.Draw(sheet);y=30
for f,s in specs:
    d.text((30,y),f"{byid[f]['name']} / nineteen shapes and the ramp",font=small,fill=INK);sheet.paste(s,(30,y+45));y+=s.height+80
sheet.save(OUT/'specimens.png')
grid([item for f in old if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],f"Reference / {refs[f['id']]['date'] or 'undated'}",refs[f['id']]['title'][:34]),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Version 1 style, unchanged')]],4,(420,594),OUT/'comparison.png')
phone([OUT/f"{f['id']}.png" for f in lead],OUT/'phone-styles.png')
phone([OUT/f"demos/{g}-{s}.png" for g,s in [('finishes','steps'),('finishes','halftone'),('finishes','riso'),('light','blinds'),('light','three-shadows'),('words','kanji-moon'),('series','turn'),('formats','story')]],OUT/'phone-features.png')
print('Saved styles, all-styles, words, shapes, light, finishes, series, formats, construction, specimens, comparison and phone-size boards.')
