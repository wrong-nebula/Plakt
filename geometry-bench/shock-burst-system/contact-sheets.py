"""Boards for output/shock-burst-study-v1: comparison, families, construction, formats, variations, seeds, outputs, riso,
realistic, phone.

  python3 -I geometry-bench/shock-burst-system/contact-sheets.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path('output/shock-burst-study-v1')
BG, INK, MUTED = (236, 235, 230), (30, 30, 34), (105, 106, 112)
cat = json.loads((OUT / 'catalog.json').read_text())
refs = json.loads((OUT / 'source.json').read_text())['references']
names = {f['id']: f['name'] for f in cat['families']}


def font(size, bold=False):
    try:
        return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf', size)
    except OSError:
        return ImageFont.load_default()


def board(name, cells, height=760, cols=6, title=None, scale=True):
    """cells: [(image path, caption)] in reading order; each image scaled to one height (or kept at its size)."""
    ims = []
    for p, cap in cells:
        im = Image.open(p).convert('RGB')
        if scale:
            im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
        ims.append((im, cap))
    pad, gap, capH, head = 40, 24, 40, 80 if title else 0
    rows = [ims[k:k + cols] for k in range(0, len(ims), cols)]
    width = max(sum(i.width for i, _ in r) + gap * (len(r) - 1) for r in rows)
    heights = [max(i.height for i, _ in r) for r in rows]
    page = Image.new('RGB', (width + 2 * pad, head + pad * 2 + sum(h + capH + gap for h in heights)), BG)
    d = ImageDraw.Draw(page)
    if title:
        d.text((pad, pad - 6), title, font=font(34, True), fill=INK)
    y = pad + head
    for r, h in zip(rows, heights):
        x = pad
        for im, cap in r:
            page.paste(im, (x, y))
            d.text((x, y + h + 8), cap, font=font(20), fill=MUTED)
            x += im.width + gap
        y += h + capH + gap
    page.save(OUT / f'{name}.png', optimize=True)
    print(name, page.size)


board('comparison', [c for r in refs for c in [(OUT / r['file'], f"Source · {r['title']}"), (OUT / f"{r['family']}.png", f"{'Study' if r['family'] == 'twin' else 'Construction'} · {names[r['family']]}")]], cols=4, title='Sources and the styles that take their construction')
board('families', [(OUT / f"{f['id']}.png", f"{i + 1:02d} {f['name']}") for i, f in enumerate(cat['families'])], cols=8, height=700, title=f"{len(cat['families'])} styles")
stage_names = ['skeleton', 'outline', 'shapes', 'poster']
fams = sorted({p.name.rsplit('-', 1)[0] for p in (OUT / 'stages').glob('*.png')}, key=list(names).index)
board('construction', [(OUT / 'stages' / f'{f}-{s}.png', f'{names[f]} · {s}. {stage_names[s - 1]}') for f in fams for s in (1, 2, 3, 4)], cols=8, height=640, title='Four construction passes')
board('formats', [(p, p.stem) for p in sorted((OUT / 'formats').glob('*.png'))], cols=5, height=640, title='Formats')
board('variations', [(p, p.stem) for p in sorted((OUT / 'variations').glob('*.png'))], cols=9, height=600, title='Variations: modules swapped between styles')
board('seeds', [(OUT / 'seeds' / f'{f}.png', f'{names[f]} · seeds') for f in ('twin', 'splash', 'shard', 'scrawl', 'bubble', 'rave')], cols=3, height=900, title='Eight seeds per rule')
seps = sorted((OUT / 'outputs' / 'separations').glob('*.png'))
board('outputs', [(OUT / 'outputs' / 'plotter' / f'{f}.png', f'{names[f]} · plotter') for f in ('comic', 'quadrant', 'shard', 'twin')] + [(p, p.stem) for p in seps if p.stem.split('-')[0] in ('twin', 'comic', 'ice', 'pinwheel')], cols=6, height=600, title='Outputs: plotter lines and ink separations')
board('riso', [(OUT / 'outputs' / 'riso' / f"{f['id']}.png", f"{f['name']} · riso") for f in cat['families']], cols=8, height=600, title='Riso previews: every separation printed in its ink, multiplied, misregistered and grained')
real = OUT / 'outputs' / 'realistic'
board('realistic', [(real / f'{n}.png', n) for n in ('comic-plotter-centrelines', 'comic-plotter-passes', 'twin-plotter-crosshatch', 'vortex-riso-spot', 'vortex-riso-tints', 'twin-riso-dots', 'rave-riso-rough')] + [(p, p.stem) for p in sorted(real.glob('*-sep-*.png'))], cols=7, height=600, title='Realistic output options: pen passes, crosshatching, two-ink tints, halftone dots, rough riso')
board('phone', [(OUT / 'phone' / f"{f['id']}.png", f"{f['name']} · 390 px") for f in cat['families']], cols=8, scale=False, title='Every style at 390 px wide, actual size')
