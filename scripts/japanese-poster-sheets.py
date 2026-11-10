"""Contact and reference sheets for the Japanese poster archive (needs Pillow, e.g. .build/siglip-venv).

  .build/siglip-venv/bin/python -I scripts/japanese-poster-sheets.py scan --out DIR
      Numbered contact sheets of every downloaded poster, grouped by designer, plus DIR/index.json.
  .build/siglip-venv/bin/python -I scripts/japanese-poster-sheets.py refs --spec SPEC.json --out DIR
      One reference sheet per proposed system in SPEC.json ({systems: [{key, kind, name, idea, refs: [ids]}]}).
"""
import argparse, json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path('output/japanese-posters')
FONT = '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc'
BOLD = '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
BG, INK, MUTED, CELL_BG = (246, 244, 239), (24, 24, 24), (110, 106, 98), (226, 222, 214)


def font(size, bold=False):
    for path in ([BOLD] if bold else []) + [FONT]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def works():
    catalog = {w['id']: w for w in json.loads((ROOT / 'catalog.json').read_text())['works']}
    out = []
    for path in sorted((ROOT / 'images').glob('*/*')):
        if path.suffix.lower() not in ('.jpg', '.png', '.webp', '.gif', '.tif'):
            continue
        w = catalog.get(path.stem)
        if w is None:
            continue  # stale file from a superseded catalog entry
        out.append({**w, 'path': str(path)})
    return out


def year(w):
    m = re.search(r'(1[89]\d\d|20\d\d)', w.get('date') or '')
    return int(m.group(1)) if m else 9999


def who(w):
    return ', '.join(w.get('designers') or []) or (w.get('designer') or 'unknown')


def thumb(path, size):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        im.thumbnail(size, Image.LANCZOS)
        return im.copy()


def clip(draw, text, f, width):
    text = re.sub(r'\s+', ' ', text or '').strip()
    while text and draw.textlength(text, font=f) > width:
        text = text[:-2] + '…' if len(text) > 2 else ''
    return text


def scan(args):
    items = sorted(works(), key=lambda w: (who(w).lower() if w.get('designers') else 'zzz', year(w), w['id']))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cols, rows, cw, ch, label = 8, 5, 240, 300, 34
    per = cols * rows
    small, tiny = font(13, True), font(11)
    index = []
    for sheet in range(0, len(items), per):
        page = Image.new('RGB', (cols * cw, rows * (ch + label)), BG)
        draw = ImageDraw.Draw(page)
        for i, w in enumerate(items[sheet:sheet + per]):
            n = sheet + i + 1
            x, y = (i % cols) * cw, (i // cols) * (ch + label)
            draw.rectangle([x + 4, y + 4, x + cw - 4, y + ch - 4], fill=CELL_BG)
            try:
                im = thumb(w['path'], (cw - 12, ch - 12))
                page.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
            except Exception as error:
                draw.text((x + 10, y + 10), f'unreadable: {error}'[:40], font=tiny, fill=INK)
            draw.text((x + 6, y + ch), clip(draw, f'{n} {who(w)}', small, cw - 10), font=small, fill=INK)
            draw.text((x + 6, y + ch + 17), clip(draw, f"{w.get('date') or ''} · {w['source']}", tiny, cw - 10), font=tiny, fill=MUTED)
            index.append({'n': n, 'sheet': sheet // per + 1, 'id': w['id'], 'designer': who(w), 'title': w.get('title'),
                          'date': w.get('date'), 'source': w['source'], 'path': w['path']})
        page.save(out / f'sheet-{sheet // per + 1:02d}.jpg', quality=88)
    (out / 'index.json').write_text(json.dumps(index, indent=1, ensure_ascii=False))
    print(f'{len(items)} posters on {(len(items) + per - 1) // per} sheets in {out}')


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


def refs(args):
    spec = json.loads(Path(args.spec).read_text())
    by_id = {w['id']: w for w in works()}
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    W, pad, cols = 2000, 48, 5
    cw = (W - 2 * pad) // cols
    ch = int(cw * 1.32)
    title_f, kind_f, body_f, cap_f, cap_s = font(46, True), font(20, True), font(24), font(17, True), font(15)
    made, per_kind = [], {}
    for n, system in enumerate(spec['systems'], 1):
        per_kind[system['kind']] = per_kind.get(system['kind'], 0) + 1
        items = [by_id[i] for i in system['refs'] if i in by_id]
        probe = ImageDraw.Draw(Image.new('RGB', (W, 10)))
        body = []
        for para in [system['idea']] + system.get('build', []):
            body += wrap(probe, para, body_f, W - 2 * pad) + ['']
        head = pad + 30 + 62 + len(body) * 34 + 10
        rows = (len(items) + cols - 1) // cols
        page = Image.new('RGB', (W, head + rows * (ch + 70) + pad), BG)
        draw = ImageDraw.Draw(page)
        draw.text((pad, pad), f"{system['kind'].upper()} SYSTEM {per_kind[system['kind']]}", font=kind_f, fill=MUTED)
        draw.text((pad, pad + 28), system['name'], font=title_f, fill=INK)
        y = pad + 30 + 62
        for line in body:
            draw.text((pad, y), line, font=body_f, fill=INK)
            y += 34
        for i, w in enumerate(items):
            x, y = pad + (i % cols) * cw, head + (i // cols) * (ch + 70)
            draw.rectangle([x + 6, y, x + cw - 6, y + ch], fill=CELL_BG)
            im = thumb(w['path'], (cw - 24, ch - 18))
            page.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
            draw.text((x + 8, y + ch + 8), clip(draw, who(w), cap_f, cw - 16), font=cap_f, fill=INK)
            draw.text((x + 8, y + ch + 32), clip(draw, f"{w.get('title') or ''}", cap_s, cw - 16), font=cap_s, fill=MUTED)
            draw.text((x + 8, y + ch + 50), clip(draw, f"{w.get('date') or ''} · {w['source']}", cap_s, cw - 16), font=cap_s, fill=MUTED)
        name = f"{n:02d}-{system['key']}.jpg"
        page.save(out / name, quality=90)
        made.append(name)
        missing = [i for i in system['refs'] if i not in by_id]
        print(f'{name}: {len(items)} refs' + (f' (missing {missing})' if missing else ''))
    return made


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['scan', 'refs'])
    parser.add_argument('--out', required=True)
    parser.add_argument('--spec')
    args = parser.parse_args()
    {'scan': scan, 'refs': refs}[args.command](args)


if __name__ == '__main__':
    main()
