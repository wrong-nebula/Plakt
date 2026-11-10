from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/rising-ray-study-v1'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text())
families=catalog['families'];layouts=catalog['layouts'];formats=catalog['formats'];variations=catalog['variations']
refs={r['family']:r for r in source['references'] if r.get('family')}
font='/System/Library/Fonts/Supplemental/Arial.ttf';bold='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
BG='#e9e8e3';INK='#2b2a27';MUTED='#6b685f'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
# Labels scale with the cell so boards still read when downscaled to phone width.
def clip(text,f,width):
    while text and f.getlength(text)>width:text=text[:-2].rstrip()+'…' if not text.endswith('…') else text[:-2].rstrip()+'…'
    return text
def grid(items,cols,cell,path,gap=30):
    t=ImageFont.truetype(bold,max(26,cell[0]//13));s=ImageFont.truetype(font,max(20,cell[0]//18));label_h=t.size+s.size+28
    rows=(len(items)+cols-1)//cols;sheet=Image.new('RGB',(gap+cols*(cell[0]+gap),gap+rows*(cell[1]+label_h+gap)),BG);d=ImageDraw.Draw(sheet)
    for i,(name,label,sub) in enumerate(items):
        x=gap+(i%cols)*(cell[0]+gap);y=gap+(i//cols)*(cell[1]+label_h+gap);im=fit(Image.open(name).convert('RGB'),*cell)
        sheet.paste(im,(x+(cell[0]-im.width)//2,y+(cell[1]-im.height)//2));d.text((x,y+cell[1]+12),clip(label,t,cell[0]),font=t,fill=INK);d.text((x,y+cell[1]+18+t.size),clip(sub,s,cell[0]),font=s,fill=MUTED)
    sheet.save(path);return sheet
def phone(sheet,name):
    # The phone check: every board downscaled to 390 px wide, as on a phone screen.
    (OUT/'phone').mkdir(exist_ok=True);fit(sheet,390,100000).save(OUT/'phone'/name)

name=lambda f:f"After {f['after'].split(',')[0]}" if not f['after'].startswith('new') else f['after'].replace('new — ','New · ')
b=grid([item for f in families if f['id'] in refs for item in [(OUT/refs[f['id']]['file'],'Reference',f"{refs[f['id']]['date']} · {refs[f['id']]['title'][:40]}"),(OUT/f"{f['id']}.png",f"Study / {f['name']}",'Shared ray construction')]],4,(520,736),OUT/'comparison.png');phone(b,'comparison.png')
b=grid([(OUT/f"{f['id']}.png",f"{i+1:02} {f['name']}",name(f)) for i,f in enumerate(families)],5,(560,792),OUT/'styles.png');b.save(OUT/'styles.jpg',quality=92);phone(b,'styles.png')
# Showcase: six styles two across, sized to read on a phone.
b=grid([(OUT/f"{f['id']}.png",f['name'],name(f)) for k in ['yokoo','neon','sunset','comic','theatre','opart'] for f in families if f['id']==k],2,(720,1019),OUT/'showcase.png');phone(b,'showcase.png')
b=grid([(OUT/'layouts'/f"{f}-{l['id']}.png",l['name'],fam['name']) for f in ['yokoo','neon','riso','theatre'] for fam in [next(x for x in families if x['id']==f)] for l in layouts],5,(420,594),OUT/'layouts.png');phone(b,'layouts.png')
b=grid([(OUT/'formats'/f"{f}-{fmt['id']}.png",fmt['name'],f) for f in ['yokoo','neon','sunset','comic'] for fmt in formats],4,(560,560),OUT/'formats.png');phone(b,'formats.png')
b=grid([(OUT/'variations'/f"{v['slug']}.png",v['label'],next(x['name'] for x in families if x['id']==v['state']['family'])) for v in variations],4,(480,679),OUT/'variations.png');phone(b,'variations.png')
b=grid([(OUT/f"stage-{f}-{s}.png",f"{s} / {n}",f) for f in ['yokoo','neon','theatre'] for s,n in [(1,'construction lines'),(2,'ray burst'),(3,'stage'),(4,'poster')]],4,(420,594),OUT/'construction.png');phone(b,'construction.png')
specs=[fit(Image.open(OUT/f"specimen-{f}.png").convert('RGB'),1100,100000) for f in ['yokoo','neon']]
sheet=Image.new('RGB',(sum(s.width for s in specs)+30*(len(specs)+1),max(s.height for s in specs)+60),BG);x=30
for s in specs:sheet.paste(s,(x,30));x+=s.width+30
sheet.save(OUT/'kit.png');phone(sheet,'kit.png')
print('Saved comparison, styles, showcase, layouts, formats, variations, construction and kit boards, plus 390 px phone copies.')
