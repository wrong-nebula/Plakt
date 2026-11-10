"""Assemble local research and procedural proof boards; no source alterations."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/experimental-letter-systems-v1'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
title = ImageFont.truetype(FONT, 18)
small = ImageFont.truetype(FONT, 13)
catalog = json.loads((OUT / 'catalog.json').read_text())

refs = json.loads((OUT / 'references.json').read_text())['references']
sheet = Image.new('RGB', (1500, 1060), '#e4e1d9')
d = ImageDraw.Draw(sheet)
for i, r in enumerate(refs):
    im = Image.open(OUT / r['image']).convert('RGB')
    im.thumbnail((280, 407))
    x, y = i % 5 * 300 + 10, i // 5 * 530 + 10
    sheet.paste(im, (x + (280 - im.width) // 2, y + (407 - im.height) // 2))
    lines = ['']
    for word in r['title'].replace(' — ', ' / ').split():
        if d.textlength(lines[-1] + ' ' + word, font=title) > 275:
            lines.append(word)
        else:
            lines[-1] += (' ' if lines[-1] else '') + word
    for n, line in enumerate(lines):
        d.text((x, y + 419 + n * 23), line, fill='#24251f', font=title)
    d.text((x, y + 480), f"{i + 1:02} / {r['year']}", fill='#686b5f', font=small)
sheet.save(OUT / 'reference-board.jpg', quality=94)

for transfer in [False, True]:
    sheet = Image.new('RGB', (1350, 1400), '#e4e1d9')
    d = ImageDraw.Draw(sheet)
    for i, s in enumerate(catalog['systems']):
        name = f"{s['number']}-{s['id']}{'-TYPE' if transfer else ''}.png"
        im = Image.open(OUT / 'posters' / name).convert('RGB')
        im.thumbnail((416, 595))
        x, y = i % 3 * 450 + 17, i // 3 * 700 + 15
        sheet.paste(im, (x, y))
        d.text((x, y + 610), f"{s['number']}  {s['name']}", fill='#24251f', font=title)
    sheet.save(OUT / ('text-transfer.jpg' if transfer else 'new-systems.jpg'), quality=95)
print('Saved reference, FUBU and TYPE boards.')
