from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

OUT=Path(__file__).resolve().parents[2]/'output/pages-shapes-study-v2'
catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families'];palettes={p['id']:p['name'] for p in catalog['palettes']}
font='/System/Library/Fonts/Supplemental/Arial.ttf';title=ImageFont.truetype(font,38);small=ImageFont.truetype(font,27);tiny=ImageFont.truetype(font,20)
INK,SUB,BG='#303b2d','#6e7d64','#e5e7e1'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def row(panels,w,h,name,gap=50,top=30,label_gap=80):
    sheet=Image.new('RGB',(len(panels)*(w+gap)+gap-20,top+h+label_gap+110),BG);d=ImageDraw.Draw(sheet)
    for i,(file,label,sub) in enumerate(panels):
        im=fit(Image.open(OUT/file).convert('RGB'),w,h);x=30+i*(w+gap);sheet.paste(im,(x+(w-im.width)//2,top+h-im.height))
        d.text((x,top+h+label_gap-40),label,font=title,fill=INK);d.text((x,top+h+label_gap+16),sub,font=small,fill=SUB)
    sheet.save(OUT/name)
def labelled(grids,names,heads,cols,name):
    # Grids of shapes (rows) × columns, with row and column labels.
    shapes=list(catalog['shapes'].values());cell=grids[0].width//len(cols);lw=150;gap=40;W=lw+len(grids)*(grids[0].width+gap);H=150+grids[0].height+40
    sheet=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(sheet)
    for i,(g,head) in enumerate(zip(grids,heads)):
        x=lw+i*(g.width+gap);sheet.paste(g,(x,150));d.text((x,20),head,font=small,fill=INK)
        for k,c in enumerate(cols):
            words=c.split(' ');d.text((x+k*cell+6,80),words[0],font=tiny,fill=SUB);d.text((x+k*cell+6,104),' '.join(words[1:]),font=tiny,fill=SUB)
    for r,s in enumerate(shapes):d.text((20,150+r*cell+cell//2-11),s['name'],font=tiny,fill=INK)
    sheet.save(OUT/name)

row([('reference.png','Reference / Neo Neo','P.A.G.E.S., Geneva / 2023'),('source.png','Source atlas','Each letter rebuilt with its construction'),('atlas-discs.png','Shape atlas','The same methods on five shapes')],1000,1100,'comparison.png')
row([(f"atlas-{f['id']}.png",f"{i+1:02} / {f['name']}",palettes[f['palette']]) for i,f in enumerate(families)],660,730,'module-systems.png')
row([(f"atlas-closed-{f['id']}.png",f"{i+1:02} / {f['name']}",'Ring, petal, loop, drop, knot') for i,f in enumerate(families)],660,730,'closed-forms.png')
row([(f'stage-{i+1}.png',f'{i+1} / {name}','') for i,name in enumerate(['components','overlaps','shapes','finished'])],480,530,'construction.png',gap=45)
row([('specimen.png','Shape specimen','20 shapes × 8 constructions'),('composition-poster.png','Composition','Mixed constructions'),('field-square.png','Shape field','Closed forms, mixed'),('field-poster.png','Shape field','Lines as separate rails')],620,880,'arrangements.png')
row([('composition-items.png','Per-item constructions','Newsprint / black'),('field-turn.png','Quarter turns','Stairs, contour bands'),('field-mirror.png','Mirror tiles','Black / signal orange'),('field-scatter.png','Scatter','Cobalt / pale lime, dense')],700,700,'patterns.png')
row([('composition-square.png','Square','Contour bands'),('composition-story.png','Story 9:16','Folded planes'),('composition-landscape.png','Landscape 16:9','Overlap lenses'),('field-landscape.png','Landscape field','Faceted blades')],700,700,'formats.png')
labelled([Image.open(OUT/f"grid-{f['id']}.png").convert('RGB') for f in families],None,[f"{i+1:02} / {f['name']}" for i,f in enumerate(families)],[c['name'] for c in catalog['constructions']],'shape-constructions.png')
labelled([Image.open(OUT/f'detail-{c}.png').convert('RGB') for c in ['overlap','contour']],None,['Overlap lenses','Contour bands'],['Detail −2','Detail −1','Detail 0','Detail +1','Detail +2'],'shape-detail.png')
print('Saved comparison, module-set, closed-form, construction, arrangement, pattern, format, shape × construction and detail boards.')
