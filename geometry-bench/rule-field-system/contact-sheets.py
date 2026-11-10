"""Boards for output/rule-field-study-v1: comparison, families, construction, formats, variations, outputs.

  python3 -I geometry-bench/rule-field-system/contact-sheets.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path('output/rule-field-study-v1')
BG, INK, MUTED = (236, 235, 230), (30, 30, 34), (105, 106, 112)
cat = json.loads((OUT / 'catalog.json').read_text())
refs = json.loads((OUT / 'source.json').read_text())['references']
names = {f['id']: f['name'] for f in cat['families']}


def font(size, bold=False):
    try:
        return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf', size)
    except OSError:
        return ImageFont.load_default()


def board(name, cells, height=760, cols=6, title=None):
    """cells: [(image path, caption)] in reading order; each image scaled to one height."""
    ims = []
    for p, cap in cells:
        im = Image.open(p).convert('RGB')
        im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
        ims.append((im, cap))
    pad, gap, capH, head = 40, 24, 40, 80 if title else 0
    rows, row = [], []
    width = max(sum(i.width for i, _ in ims[k:k + cols]) + gap * (len(ims[k:k + cols]) - 1) for k in range(0, len(ims), cols))
    for k in range(0, len(ims), cols):
        rows.append(ims[k:k + cols])
    page = Image.new('RGB', (width + 2 * pad, head + pad * 2 + len(rows) * (height + capH + gap)), BG)
    d = ImageDraw.Draw(page)
    if title:
        d.text((pad, pad - 6), title, font=font(34, True), fill=INK)
    y = pad + head
    for r in rows:
        x = pad
        for im, cap in r:
            page.paste(im, (x, y))
            d.text((x, y + height + 8), cap, font=font(20), fill=MUTED)
            x += im.width + gap
        y += height + capH + gap
    page.save(OUT / f'{name}.png', optimize=True)
    print(name, page.size)


board('comparison', [c for r in refs for c in [(OUT / r['file'], f"Source · {r['title']}"), (OUT / f"{r['family']}.png", f"Study · {names[r['family']]}")]], cols=4, title='Sources and studies')
board('families', [(OUT / f"{f['id']}.png", f"{i + 1:02d} {f['name']}") for i, f in enumerate(cat['families'])], cols=8, height=700, title=f"{len(cat['families'])} styles")
stage_names = ['letter mask', 'plain field', 'treatment', 'poster']
fams = sorted({p.name.rsplit('-', 1)[0] for p in (OUT / 'stages').glob('*.png')}, key=list(names).index)
board('construction', [(OUT / 'stages' / f'{f}-{s}.png', f'{names[f]} · {s}. {stage_names[s - 1]}') for f in fams for s in (1, 2, 3, 4)], cols=4, height=640, title='Four construction passes')
board('formats', [(p, p.stem) for p in sorted((OUT / 'formats').glob('*.png'))], cols=5, height=640, title='Formats')
board('variations', [(p, p.stem) for p in sorted((OUT / 'variations').glob('*.png'))], cols=9, height=600, title='Variations: modules swapped between styles')
seps = sorted((OUT / 'outputs' / 'separations').glob('*.png'))
board('outputs', [(OUT / 'outputs' / 'plotter' / f'{f}.png', f'{names[f]} · plotter') for f in ('hatch', 'halftone', 'contour', 'groove')] + [(p, p.stem) for p in seps if p.stem.split('-')[0] in ('rays', 'moire', 'lattice', 'boxes')], cols=6, height=600, title='Outputs: plotter centrelines and ink separations')
