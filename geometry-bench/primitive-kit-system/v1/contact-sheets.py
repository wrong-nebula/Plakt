from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/primitive-kit-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text())
styles=catalog['styles'];figures=catalog['figures'];generators=catalog['generators']
font='/System/Library/Fonts/Supplemental/Arial.ttf';bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
title=ImageFont.truetype(bold,30);small=ImageFont.truetype(font,22)
BG='#e9e8e3';INK='#2a2a28';MUTED='#6b6960'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def grid(items,cols,cell,path,label_h=84,gap=28):
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(gap+cols*(cell[0]+gap),gap+rows*(cell[1]+label_h+gap)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=gap+(i%cols)*(cell[0]+gap);y=gap+(i//cols)*(cell[1]+label_h+gap)
        with Image.open(name) as src:im=fit(src.convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+12),label,font=title,fill=INK);d.text((x,y+cell[1]+50),sub,font=small,fill=MUTED)
    sheet.save(path);return sheet

refs={r['style']:r for r in source['references']}
grid([item for s in styles if s['id'] in refs for item in [(OUT/refs[s['id']]['file'],f"Reference / {refs[s['id']]['date']}",f"{refs[s['id']]['designer']}, {refs[s['id']]['title'][:34]}"),(OUT/f"{s['id']}.png",f"Study / {s['name']}",'Same kit, source figure as one preset')]],4,(520,736),OUT/'comparison.png')
grid([(OUT/f"{s['id']}.png",f"{i+1:02} / {s['name']}",('New — '+s['after'][6:]) if s['after'].startswith('new') else 'After '+s['after'][:44]) for i,s in enumerate(styles)],3,(620,877),OUT/'styles.png').save(OUT/'styles.jpg',quality=92)
grid([(OUT/f"figures/{f['id']}.png",f['name'],f"{f['cols']} × {f['rows']} grid, {f['overlays']} overlays") for f in figures],6,(380,537),OUT/'figures.png')
grid([(OUT/f"generator/{g['id']}-{s}.png",f"{g['name']} {s}",'seed '+str(s)) for g in generators for s in [3,8,13,21,34,55]],6,(300,424),OUT/'generator.png',label_h=70)
layouts=['hero-buyo','field-buyo','cast-buyo','crop-buyo','hero-neon','field-neon','cast-neon','crop-neon','field-mirror','field-turn','field-scatter','field-colorway','square-cast','landscape-cast','square-hero','landscape-crop']
grid([(OUT/f"layouts/{n}.png",n.split('-')[0].capitalize(),' '.join(n.split('-')[1:])) for n in layouts],4,(460,650),OUT/'layouts.png')
var=['refine-2','refine-4','gap','round','aspect','jitter','warp','turn-noise','features','vocab-tanaka','vocab-angular','vocab-curved','vocab-pixel','mirror-left','mirror-right','flip','quad','point','paint-outline','paint-sticker','paint-neon','paint-riso','bird-symmetric','noh-refined']
grid([(OUT/f"variations/{n}.png",n.replace('-',' ').capitalize(),'one control or option') for n in var],6,(360,509),OUT/'variations.png',label_h=70)
grid([(OUT/f"stages/{s}-{k}.png",f"{k} / {name}",s) for s in ['buyo','mori','kato','neon'] for k,name in [(1,'grid & tokens'),(2,'kit cells'),(3,'figure + overlays'),(4,'poster')]],4,(420,594),OUT/'construction.png')
# Phone check: showcase posters at the width a phone shows them (390 px).
phone=['buyo','noh','mori','sharaku','kato','riso','neon','sticker','indigo','layouts/field-buyo','layouts/crop-buyo','generator/face-21']
grid([(OUT/f"{n}.png",n.split('/')[-1],'390 px wide') for n in phone],6,(390,552),OUT/'phone.png',label_h=64,gap=20)
print('Saved comparison, styles, figures, generator, layouts, variations, construction and phone boards.')
