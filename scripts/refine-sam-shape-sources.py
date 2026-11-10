"""Refine the visually selected shape sources and retain every SAM alternative.

The color estimate is an independent, local-paper estimate inside SAM support;
it is retained separately from the original model mask. No source record changes.
"""
import argparse
import base64
import hashlib
import json
import math
import statistics
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse

from PIL import Image, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("output/sam-shape-expansion-v1"))
    parser.add_argument("--poster", type=Path, default=Path("output/multimodal-study-v1/tools/poster"))
    args = parser.parse_args()
    out = args.out.resolve(); out.mkdir(parents=True, exist_ok=True)
    entries = {e["id"]: e for e in json.loads(Path("library/library.json").read_text())["posters"]}
    orbit = "a0527f92c47b62fa8918beb0-p0"
    focus = "02f8efca35d0a69f7065e7e8-p0"
    selections = []
    for index in range(8):
        angle = -math.pi / 2 + index * math.pi / 4
        cx, cy = 0.5014 + 0.363 * math.cos(angle), 0.4988 + 0.363 / (727/534) * math.sin(angle)
        selections.append((f"disc-{index+1}", "disc-wreath", orbit, [cx-.12, cy-.09, .24, .18]))
    selections += [
        ("segmented-ring", "segmented-ring", focus, [.255, .58, .25, .19]),
        ("star-frame", "star-frame", focus, [.742, .235, .25, .19]),
        ("polygon-frame", "polygon-contours", focus, [.255, .765, .25, .18]),
        ("notched-disc", "notched-disc", "7ca49ba438265fcaa618783d-p0", [.515, .33, .48, .325]),
        ("cellular-disc", "cellular-disc", "7a78e599fb143d5e5ca6f118-p0", [.10, .265, .25, .53]),
    ]
    results = []
    for name, family, poster_id, box in selections:
        folder = out / "sources" / name
        selected = folder / "selection.json"
        image_path = Path(unquote(urlparse(entries[poster_id]["imageURL"]).path))
        image_hash = hashlib.sha256(image_path.read_bytes()).hexdigest()
        if not selected.exists():
            command = [str(args.poster.resolve()), "library", "segment", "--library", "library", "--poster", poster_id,
                       "--sam-models", "models/sam2", "--box", ",".join(map(str, box)), "--out", str(folder)]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(result.stderr)
            (folder / "native.log").write_text(result.stdout)
        selection = json.loads(selected.read_text())
        assert selection["imageHash"] == image_hash, "Source changed; choose a new evidence output."
        source = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
        alternatives = []
        for candidate in selection["masks"]:
            mask = Image.frombytes("L", (candidate["width"], candidate["height"]), base64.b64decode(candidate["bytes"]))
            bounds = mask.getbbox()
            if bounds is None:
                continue
            normalized = [bounds[0]/mask.width, bounds[1]/mask.height, (bounds[2]-bounds[0])/mask.width, (bounds[3]-bounds[1])/mask.height]
            ratio = normalized[2]*normalized[3]/(box[2]*box[3])
            if .22 < ratio < 2.5:
                score = candidate["predictedIoU"]*candidate["stability"]*min(ratio, 1/ratio)
                alternatives.append((score, candidate, mask))
        if not alternatives:
            raise RuntimeError(f"Inspect {name}: no mask is consistent with its declared source box.")
        _, candidate, original = max(alternatives, key=lambda item:item[0])
        support = original.resize(source.size, Image.Resampling.NEAREST)
        bounds = support.getbbox()
        left, top, right, bottom = bounds
        border = []
        for y in range(max(0, top-4), min(source.height, bottom+4)):
            for x in range(max(0, left-4), min(source.width, right+4)):
                if not (left <= x < right and top <= y < bottom):
                    border.append(source.getpixel((x,y)))
        paper = tuple(statistics.median(p[c] for p in border) for c in range(3))
        threshold = 0.075
        ink = Image.new("L", source.size)
        for y in range(top,bottom):
            for x in range(left,right):
                if support.getpixel((x,y)):
                    pixel = source.getpixel((x,y))
                    distance = math.sqrt(sum(((pixel[c]-paper[c])/255)**2 for c in range(3))/3)
                    if distance > threshold:
                        ink.putpixel((x,y),255)
        ink_bounds = ink.getbbox()
        if ink_bounds is None:
            raise RuntimeError(f"Inspect {name}: color refinement found no printed foreground.")
        original.save(folder/"sam-mask.png"); ink.save(folder/"ink-mask.png")
        rgba = source.convert("RGBA"); rgba.putalpha(ink); rgba.crop(ink_bounds).save(folder/"ink-cutout.png")
        padding = 5
        crop = (max(0,ink_bounds[0]-padding),max(0,ink_bounds[1]-padding),min(source.width,ink_bounds[2]+padding),min(source.height,ink_bounds[3]+padding))
        source.crop(crop).save(folder/"source-crop.png")
        xs, ys = [], []
        for y in range(ink_bounds[1],ink_bounds[3]):
            for x in range(ink_bounds[0],ink_bounds[2]):
                if ink.getpixel((x,y)):xs.append(x+.5);ys.append(y+.5)
        record = {"id":name,"family":family,"posterID":poster_id,"imageURL":image_path.as_uri(),"sourceImageSHA256":image_hash,
                  "samFingerprint":selection["modelFingerprint"],"computeUnits":selection["computeUnits"],"prompts":selection["prompts"],
                  "maskID":candidate["id"],"predictedIoU":candidate["predictedIoU"],"stability":candidate["stability"],
                  "bounds":{"x":ink_bounds[0]/source.width,"y":ink_bounds[1]/source.height,"width":(ink_bounds[2]-ink_bounds[0])/source.width,"height":(ink_bounds[3]-ink_bounds[1])/source.height},
                  "imageWidth":source.width,"imageHeight":source.height,"centerX":statistics.mean(xs)/source.width,"centerY":statistics.mean(ys)/source.height,
                  "refinement":{"method":"RGB distance from median immediate exterior paper inside SAM support","threshold":threshold,"paperRGB":paper,"reviewRequired":True},
                  "evidenceURL":(folder/"evidence.json").as_uri()}
        (folder/"evidence.json").write_text(json.dumps(record,indent=2)+"\n");results.append(record)
        (out/"source-selections.json").write_text(json.dumps(results,indent=2)+"\n")
        print(f'{name}: CPU SAM option {candidate["id"]+1}, IoU estimate {candidate["predictedIoU"]:.3f}',flush=True)


if __name__ == "__main__":
    main()
