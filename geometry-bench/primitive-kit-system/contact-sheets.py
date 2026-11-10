from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/primitive-kit-study-v2'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text())
styles=catalog['styles'];figures=catalog['figures'];generators=catalog['generators'];families=catalog['families'];moods=catalog['moods'];paints=catalog['options']['paint']
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
cap=lambda s:s[:1].upper()+s[1:]

refs={r['style']:r for r in source['references']}
grid([item for s in styles if s['id'] in refs for item in [(OUT/refs[s['id']]['file'],f"Reference / {refs[s['id']]['date']}",f"{refs[s['id']]['designer']}, {refs[s['id']]['title'][:34]}"),(OUT/f"{s['id']}.png",f"Study / {s['name']}",'Same kit, source figure as one preset')]],4,(520,736),OUT/'comparison.png')
show=[s for s in styles if s.get('group')!='legacy'];legacy=[s for s in styles if s.get('group')=='legacy']
grid([(OUT/f"{s['id']}.png",f"{i+1:02} / {s['name']}",('New — '+s['after'][6:]) if s['after'].startswith('new') else 'After '+s['after'][:44]) for i,s in enumerate(show)],4,(560,792),OUT/'styles.png').save(OUT/'styles.jpg',quality=92)
grid([(OUT/f"{s['id']}.png",s['name'],'legacy — kept for replay') for s in legacy],4,(420,594),OUT/'legacy.png')
grid([(OUT/f"figures/{f['id']}.png",f['name'],f"{f['cols']} × {f['rows']}"+(f", {f['merged']} merged" if f['merged'] else '')+f", {f['overlays']} overlays") for f in figures],7,(330,467),OUT/'figures.png')
grid([(OUT/f"generator/{g['id']}-{s}.png",f"{g['name']} {s}",'seed '+str(s)) for g in generators for s in [3,8,13,21,34,55]],6,(250,354),OUT/'generator.png',label_h=70)
grid([(OUT/f"generator/expressive-{k}-{s}.png",f"{cap(k)} {s}",'expressive option') for k in ['face','mask','hannya','rabbit'] for s in [3,8,13]],6,(250,354),OUT/'generator-expressive.png',label_h=70)
grid([(OUT/f"families/{f['kind']}-{f['seed']}.png",f"{cap(f['kind'])} family {f['seed']}",f"{f['style']} · {f['layout']}") for f in families],3,(520,736),OUT/'families.png')
grid([(OUT/f"moods/{n}-{m}.png",cap(m),n) for n in ['buyo','ichi','kumadori','okame'] for m in moods],7,(260,368),OUT/'moods.png',label_h=70)
grid([(OUT/f"features/{k}.png",cap(k),'one face, many features') for k in ['eyes','mouths','ornaments']],3,(560,792),OUT/'features.png')
grid([item for n in ['portrait','fuji','stilllife','neoncat'] for item in [(OUT/f"image/{n}-source.png",'Picture',n),(OUT/f"image/{n}.png",'Figure','12 × 16 cells')]],4,(420,594),OUT/'image-figures.png')
grid([(OUT/f"finishes/{p}.png",cap(p),'paint') for p in paints],5,(420,594),OUT/'finishes.png')
layouts=['crop-sumi','hero-heron','row-two','row-sage','field-halfdrop','wallpaper-mirror','crowd-sage','cast-specimen','story-crop','banner-row','square-heron','landscape-crop','hero-buyo','field-buyo','crop-buyo','wallpaper-legacy']
grid([(OUT/f"layouts/{n}.png",n.split('-')[0].capitalize(),' '.join(n.split('-')[1:])) for n in layouts],4,(460,650),OUT/'layouts.png')
grid([(OUT/f"series/{n}-sheet.png",f"Series / {n}",'one rule, four posters') for n in ['buyo','sumi','cobalt']],1,(2000,700),OUT/'series.png')
var=['refine-4','round','jitter','warp','turn-noise','mirror-left','quad','bird-symmetric','vocab-extended','vocab-textile','vocab-botanic','vocab-pixel','merged-bigcell','merged-refine','merged-mirror','merged-jitter','mood-surprised','mood-sleepy','image-mirror','paint-glow-field']
grid([(OUT/f"variations/{n}.png",n.replace('-',' ').capitalize(),'one control or option') for n in var],5,(360,509),OUT/'variations.png',label_h=70)
grid([(OUT/f"stages/{s}-{k}.png",f"{k} / {name}",s) for s in ['buyo','sumi','cobalt','papercut'] for k,name in [(1,'grid & tokens'),(2,'kit cells'),(3,'figure + overlays'),(4,'poster')]],4,(420,594),OUT/'construction.png')
# Phone check: showcase posters at the width a phone shows them (390 px).
phone=['sumi','cobalt','sage','stone','papercut','gilt','kabuki','sashiko','families/okame-8','image/fuji','layouts/hero-heron','series/sumi-2']
grid([(OUT/f"{n}.png",n.split('/')[-1],'390 px wide') for n in phone],6,(390,552),OUT/'phone.png',label_h=64,gap=20)
print('Saved comparison, styles, figures, generator, families, moods, features, image-figures, finishes, layouts, series, variations, construction and phone boards.')
