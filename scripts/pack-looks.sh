#!/bin/zsh
# Render every circle-packing look as a specimen with anchored type, plus a contact sheet and a phone-width copy.
# Usage: zsh scripts/pack-looks.sh OUT [poster-binary] [extra render args…]
set -euo pipefail
cd "${0:A:h:h}"
OUT=${1:?output directory}; BIN=${2:-.build/debug/poster}; shift 2 2>/dev/null || shift $#
[[ -e $OUT ]] && { print "Output exists: $OUT"; exit 1 }
mkdir -p $OUT
looks=(${(f)"$(/usr/bin/python3 -I -c 'import json;print("\n".join(l["name"] for r in json.load(open("Sources/PosterCore/Resources/ShapeLibrary/SurveyRecipes.json")) if r["id"]=="survey-circle-pack" for l in r["looks"]))')"})
i=0
for look in $looks; do
  $BIN shape-library render --id survey-circle-pack --look "$look" --placement anchored "$@" --out $OUT/$i >/dev/null
  print -r -- $look > $OUT/$i/label.txt; i=$((i+1))
done
python3 -I - $OUT <<'PY'
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]; tiles = []
for d in sorted((x for x in os.listdir(out) if x.isdigit()), key=int):
    im = Image.open(f'{out}/{d}/poster.png').convert('RGB'); h = 560
    tiles.append((open(f'{out}/{d}/label.txt').read().strip(), im.resize((int(im.width * h / im.height), h))))
w = max(t.width for _, t in tiles); cols = 6; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8), rows * 600), (36, 36, 36)); draw = ImageDraw.Draw(sheet)
for k, (name, im) in enumerate(tiles):
    x, y = (k % cols) * (w + 8), (k // cols) * 600
    sheet.paste(im, (x, y)); draw.text((x + 4, y + 568), name, fill=(255, 255, 255))
sheet.save(f'{out}/looks.jpg', quality=88)
phone = sheet.resize((390 * 2, int(sheet.height * 390 * 2 / sheet.width)))
phone.save(f'{out}/looks-phone.jpg', quality=85)
print(f'{len(tiles)} looks -> {out}/looks.jpg')
PY
