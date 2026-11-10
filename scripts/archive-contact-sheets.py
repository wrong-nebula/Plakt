"""Contact and reference sheets for the indexed library posters (Pillow only).

  python3 -I scripts/archive-contact-sheets.py scan --out DIR [--used IDS.txt] [--per 36] [--cols 6]
      Numbered contact sheets of every library surface, plus DIR/manifest.json. Posters listed in
      --used (one ID per line) get an orange frame: they already source a built system.
  python3 -I scripts/archive-contact-sheets.py refs --spec SPEC.json --out DIR
      One reference sheet per proposed system in SPEC.json ({systems: [{key, kind, name, idea, build, refs}]}),
      refs being library poster IDs or unique ID prefixes. Same layout as japanese-poster-sheets.py.
"""
import argparse, json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

FONT, BOLD = '/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
BG, INK, MUTED, CELL_BG = (246, 244, 239), (24, 24, 24), (110, 106, 98), (226, 222, 214)


def font(size, bold=False):
    try:
        return ImageFont.truetype(BOLD if bold else FONT, size)
    except OSError:
        return ImageFont.load_default()


def posters():
    out = []
    for i, p in enumerate(sorted(Path('library/posters').glob('*/record.json'))):
        d = json.loads(p.read_text())
        img = next((p.parent / n for n in ('poster.jpg', 'poster.png') if (p.parent / n).exists()), None)
        caption = (d.get('source') or {}).get('caption') or ''
        credit = re.search(r'(?:design(?:ed)?|poster|by)[^\n]*?(@[\w.]+(?:\s*(?:,|&|and|\+|x)\s*@[\w.]+)*)', caption, re.I)
        out.append({'index': i, 'id': d['id'], 'image': str(img) if img else None,
                    'credit': credit.group(1) if credit else '', 'post': (d.get('source') or {}).get('postURL'),
                    'caption': caption[:300]})
    return out


def thumb(path, size):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        im.thumbnail(size, Image.LANCZOS)
        return im.copy()


def wrap(draw, text, f, width):
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=f) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line] if line else lines


def scan(args):
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    used = set(Path(args.used).read_text().split()) if args.used else set()
    manifest = [{**r, 'used': r['id'] in used} for r in posters()]
    cw, ch, label, cols = 300, 400, 22, args.cols
    rows = (args.per + cols - 1) // cols
    f = font(17, True)
    for s, start in enumerate(range(0, len(manifest), args.per)):
        sheet = Image.new('RGB', (cols * cw, rows * (ch + label)), '#202020')
        dr = ImageDraw.Draw(sheet)
        for n, row in enumerate(manifest[start:start + args.per]):
            x, y = (n % cols) * cw, (n // cols) * (ch + label)
            if row['image']:
                im = thumb(row['image'], (cw - 8, ch - 8))
                sheet.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
            if row['used']:
                dr.rectangle([x + 1, y + 1, x + cw - 2, y + ch - 2], outline='#ff8a00', width=4)
            dr.text((x + 6, y + ch + 1), f"{row['index']:04}  {row['id'][:8]}", fill='#ff8a00' if row['used'] else 'white', font=f)
        sheet.save(out / f'sheet-{s + 1:02}.jpg', quality=88)
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(len(manifest), 'posters,', (len(manifest) + args.per - 1) // args.per, 'sheets,', sum(r['used'] for r in manifest), 'marked used')


def refs(args):
    spec = json.loads(Path(args.spec).read_text())
    allp = posters()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    W, pad, cols = 2000, 48, 4
    cw = (W - 2 * pad) // cols
    ch = int(cw * 1.32)
    title_f, kind_f, body_f, cap_f, cap_s = font(46, True), font(20, True), font(24), font(17, True), font(15)
    per_kind = {}
    for n, system in enumerate(spec['systems'], 1):
        per_kind[system['kind']] = per_kind.get(system['kind'], 0) + 1
        items = []
        for ref in system['refs']:
            hits = [p for p in allp if p['id'].startswith(ref)]
            if len(hits) != 1:
                raise SystemExit(f"{system['key']}: ref {ref} matches {len(hits)} posters")
            items.append(hits[0])
        probe = ImageDraw.Draw(Image.new('RGB', (W, 10)))
        body = []
        for para in [system['idea']] + system.get('build', []):
            body += wrap(probe, para, body_f, W - 2 * pad) + ['']
        head = pad + 30 + 62 + len(body) * 34 + 10
        rows = (len(items) + cols - 1) // cols
        page = Image.new('RGB', (W, head + rows * (ch + 56) + pad), BG)
        draw = ImageDraw.Draw(page)
        draw.text((pad, pad), f"{system['kind'].upper()} SYSTEM {per_kind[system['kind']]}", font=kind_f, fill=MUTED)
        draw.text((pad, pad + 28), system['name'], font=title_f, fill=INK)
        y = pad + 30 + 62
        for line in body:
            draw.text((pad, y), line, font=body_f, fill=INK)
            y += 34
        for i, p in enumerate(items):
            x, y = pad + (i % cols) * cw, head + (i // cols) * (ch + 56)
            draw.rectangle([x + 6, y, x + cw - 6, y + ch], fill=CELL_BG)
            im = thumb(p['image'], (cw - 24, ch - 18))
            page.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
            draw.text((x + 8, y + ch + 8), f"#{p['index']:04}  {p['id'][:8]}", font=cap_f, fill=INK)
            draw.text((x + 8, y + ch + 32), p['credit'] or 'no credit in caption', font=cap_s, fill=MUTED)
        name = f"{n:02d}-{system['key']}.jpg"
        page.save(out / name, quality=90)
        print(f'{name}: {len(items)} refs')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['scan', 'refs'])
    parser.add_argument('--out', required=True)
    parser.add_argument('--spec')
    parser.add_argument('--used')
    parser.add_argument('--per', type=int, default=36)
    parser.add_argument('--cols', type=int, default=6)
    args = parser.parse_args()
    {'scan': scan, 'refs': refs}[args.command](args)


if __name__ == '__main__':
    main()
