from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import numpy as np

OUT=Path(__file__).resolve().parents[2]/'output/darkmatter-study-v2'
source=json.loads((OUT/'source.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());families=catalog['families']
w,h=source['field'];A=[];b=[]
for (x,y),(u,v) in zip([(0,0),(w,0),(w,h),(0,h)],source['quad']):
    A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);b.extend([u,v])
coefficients=np.linalg.solve(np.array(A),np.array(b))
Image.open(OUT/'reference.png').convert('RGB').transform((w,h),Image.Transform.PERSPECTIVE,coefficients,Image.Resampling.BICUBIC).save(OUT/'reference-crop.png')
font='/System/Library/Fonts/Supplemental/Arial.ttf';title=ImageFont.truetype(font,37);small=ImageFont.truetype(font,27);label=ImageFont.truetype(font,28)
INK,SUB,GROUND='#303b2d','#6e7d64','#e5e7e1'
def fit(image,w,h):
    f=min(w/image.width,h/image.height)
    return image.resize((round(image.width*f),round(image.height*f)),Image.Resampling.LANCZOS)
def load(name): return Image.open(OUT/name).convert('RGB')

sheet=Image.new('RGB',(2300,1780),GROUND);d=ImageDraw.Draw(sheet)
for i,(name,head,sub) in enumerate([('reference-crop.png','Reference / Hørde + Altiplano','DarkMatter / 2021 / rectified photograph'),('wedges.png','Vector construction study','Wedges / quarter-discs / fine diagonal joints')]):
    im=fit(load(name),1080,1550);x=35+i*1150;sheet.paste(im,(x+(1080-im.width)//2,30));d.text((x,1630),head,font=title,fill=INK);d.text((x,1691),sub,font=small,fill=SUB)
sheet.save(OUT/'comparison.png')
# Six systems in two rows of three, as source collage and as packed text.
for suffix,file,sub in [('','shape-systems.png',None),('-dark-matter','text-transfer.png','DARK MATTER / packed masses')]:
    rows=(len(families)+2)//3;sheet=Image.new('RGB',(2160,1190*rows),GROUND);d=ImageDraw.Draw(sheet)
    for i,family in enumerate(families):
        im=fit(load(family['id']+suffix+'.png'),660,990);x=30+i%3*720;y=1190*(i//3);sheet.paste(im,(x+(660-im.width)//2,y+25));d.text((x,y+1040),f"{i+1:02} / {family['name']}",font=title,fill=INK);d.text((x,y+1101),sub or 'HØRDE / source collage',font=small,fill=SUB)
    sheet.save(OUT/file)
treatments=catalog['treatments'];sheet=Image.new('RGB',(2160,1190*2),GROUND);d=ImageDraw.Draw(sheet)
for i,t in enumerate(treatments):
    im=fit(load(f"treatment-{t['id']}.png"),660,990);x=30+i%3*720;y=1190*(i//3);sheet.paste(im,(x+(660-im.width)//2,y+25));d.text((x,y+1040),f"{i+1:02} / {t['name']}",font=title,fill=INK);d.text((x,y+1101),'HØRDE / packed / wedges',font=small,fill=SUB)
sheet.save(OUT/'treatments.png')
sheet=Image.new('RGB',(2100,1760),GROUND);d=ImageDraw.Draw(sheet)
for row,prefix in enumerate(['stage','packed-stage']):
    for i,name in enumerate(['1 / parts','2 / solid masses','3 / counters & joints','4 / poster']):
        im=fit(load(f'{prefix}-{i+1}.png'),480,710);x=20+i*525;y=25+row*870;sheet.paste(im,(x+(480-im.width)//2,y));d.text((x,y+745),name+(' — source collage' if row==0 else ' — alphabet'),font=label,fill=INK)
sheet.save(OUT/'construction.png')
proofs=['format-story-the-unseen','format-a-series-north-wave','format-square-fubu','format-landscape-helsinki-2026']
ims=[fit(load(p+'.png'),10000,900) for p in proofs[:3]];wide=fit(load(proofs[3]+'.png'),2000,900)
total=sum(i.width for i in ims)+30*(len(ims)+1);sheet=Image.new('RGB',(max(total,wide.width+60),900*2+180),GROUND);d=ImageDraw.Draw(sheet);x=30
for im,name in zip(ims,['Story 9:16','A series','Square']):
    sheet.paste(im,(x,25));d.text((x,940),name,font=small,fill=SUB);x+=im.width+30
sheet.paste(wide,(30,1010));d.text((30,1010+wide.height+15),'Landscape 16:9',font=small,fill=SUB)
sheet.save(OUT/'formats.png')
specs=[load(f"specimen-{f['id']}.png") for f in families];W=2400;rows=[fit(s,W-60,10000) for s in specs]
sheet=Image.new('RGB',(W,sum(r.height for r in rows)+95*len(rows)+20),GROUND);d=ImageDraw.Draw(sheet);y=20
for r,family in zip(rows,families):
    d.text((30,y),family['name'],font=small,fill=SUB);sheet.paste(r,(30,y+45));y+=r.height+95
sheet.save(OUT/'alphabet.png')
# Phone check: every packed proof at 390 px wide, the width of a phone screen.
phones=[fit(load(p),390,10000) for p in ['format-story-the-unseen.png','wedges-dark-matter.png','format-square-fubu.png']]
sheet=Image.new('RGB',(sum(p.width for p in phones)+40*4,max(p.height for p in phones)+60),GROUND);x=40
for p in phones: sheet.paste(p,(x,30));x+=p.width+40
sheet.save(OUT/'phone-check.png')
print('Saved rectified reference, comparison, systems, packed text, treatments, construction, formats, alphabet and phone boards.')
