"""Build candidate pools for labelling poster techniques, as a fixed evaluation set for semantic search.

Each technique pools SigLIP's top hits, posters where region analysis already suggests the tag, and random
posters for the base rate. The page shows them shuffled, without their source, so labels don't favour either
method. Labels are stored separately (judgments.json); no library record is changed.

python3 scripts/build-technique-review.py --poster .build/region-rerun-v4/poster
"""
import argparse
import json
import random
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]

# (taxonomy name, SigLIP description, definition shown while labelling)
TECHNIQUES = [
    ("concentric-shapes", "concentric rings with a shared center", "Several rings, circles or outlines nested around one shared center."),
    ("outline-text", "outlined hollow letters", "Letters drawn as outlines only, with hollow insides."),
    ("halftone", "halftone dot shading", "Tone built from a visible pattern of dots or lines that vary in size."),
    ("gradient", "a smooth color gradient", "A smooth blend from one color or tone into another."),
    ("circular-text", "letters arranged around a circle", "Text set along a circle or ring."),
    ("text-on-path", "words arranged along a curved path", "Text following a curved or wavy line that is not a full circle."),
    ("grid", "a regular grid of repeated shapes", "Shapes, images or type arranged in regular rows and columns."),
    ("geometric-shapes", "abstract geometric shapes", "Prominent abstract geometric forms: circles, squares, triangles, bars."),
    ("offset-replication", "offset copies forming a trail", "The same shape or word repeated with a small offset, like a trail or echo."),
    ("reflection", "lettering repeated upside down as a reflected mirror image", "Type or shapes mirrored, as if reflected."),
    ("photography", "a large photograph", "A photograph is a major visual element."),
    ("dense-typography", "dense experimental typography", "Type fills most of the poster: many lines, sizes or layers of text."),
    ("vertical-type", "vertical lettering running sideways", "Lines of text rotated 90° or stacked to read vertically."),
    ("scale-ramp", "a sequence of shapes growing progressively larger", "Repeated elements that step up or down in size in sequence."),
    ("overlap", "several overlapping abstract shapes", "Shapes or letters overlapping each other, often with transparency or overprint."),
    ("modular-tiles", "a repeating pattern of geometric tiles", "A surface built from repeated modular tiles."),
    ("curved-line-field", "a field of parallel curved lines", "Many parallel curved or wavy lines filling an area."),
    ("extrusion", "three-dimensional extruded letters", "Letters or shapes with drawn 3D depth (extrusion)."),
    ("collage", "a collage of cut-out images", "Several cut-out images or fragments combined into one picture."),
    ("perforated-shapes", "a shape containing many circular holes", "A solid shape punched through with holes."),
]
PROMPT = "a graphic design poster with "


def path(url):
    return Path(unquote(urlparse(url).path))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=ROOT / "library")
    parser.add_argument("--poster", type=Path, required=True, help="poster CLI binary used for SigLIP rankings")
    parser.add_argument("--models", type=Path, default=ROOT / "models/siglip")
    parser.add_argument("--out", type=Path, default=ROOT / "output/technique-review-v1")
    parser.add_argument("--siglip", type=int, default=12, help="top SigLIP hits per technique")
    parser.add_argument("--suggested", type=int, default=6, help="posters with a region-analysis suggestion")
    parser.add_argument("--size", type=int, default=20, help="pool size; random posters fill the rest")
    parser.add_argument("--seed", type=int, default=9)
    args = parser.parse_args()
    out = args.out.resolve()
    if (out / "judgments.json").exists():
        raise SystemExit(f"{out}/judgments.json exists; rebuilding would change the pools it refers to. Use a new --out.")
    (out / "rankings").mkdir(parents=True, exist_ok=True)
    (out / "thumbs").mkdir(exist_ok=True)
    rng = random.Random(args.seed)
    catalog = json.loads((args.library / "library.json").read_text())
    posters = {entry["id"]: entry for entry in catalog["posters"]}
    suggested = {}
    for entry in catalog["posters"]:
        record = json.loads(path(entry["recordURL"]).read_text())
        for tag in record.get("tags", []):
            if tag.get("origin") == "sam-siglip-vision-v1" and tag["state"] == "suggested":
                suggested.setdefault(tag["name"], []).append(entry["id"])
    pools = []
    for name, description, definition in TECHNIQUES:
        ranking_file = out / "rankings" / f"{name}.json"
        subprocess.run([str(args.poster), "library", "semantic-search", "--library", str(args.library), "--models", str(args.models),
                        "--query", PROMPT + description, "--limit", "200", "--out", str(ranking_file)], check=True, capture_output=True)
        ranking = [hit["posterID"] for hit in json.loads(ranking_file.read_text())["hits"]]
        sources = {}
        for rank, poster in enumerate(ranking[:args.siglip], 1):
            sources.setdefault(poster, []).append(f"siglip:{rank}")
        holders = sorted(set(suggested.get(name, [])) - set(sources))
        for poster in rng.sample(holders, min(args.suggested, len(holders))):
            sources.setdefault(poster, []).append("sam-suggested")
        others = sorted(set(posters) - set(sources))
        for poster in rng.sample(others, max(2, args.size - len(sources))):
            sources.setdefault(poster, []).append("random")
        order = sorted(sources)
        rng.shuffle(order)
        pools.append({"technique": name, "description": description, "definition": definition,
                      "suggestedPosters": len(suggested.get(name, [])), "candidates": [{"posterID": p, "sources": sources[p]} for p in order]})
        print(f"{name}: {len(order)} candidates ({len(holders)} other suggestion holders)", flush=True)
    needed = {c["posterID"] for pool in pools for c in pool["candidates"]}
    for poster in sorted(needed):
        thumb = out / "thumbs" / f"{poster}.jpg"
        if not thumb.exists():
            image = ImageOps.exif_transpose(Image.open(path(posters[poster]["imageURL"]))).convert("RGB")
            image.thumbnail((520, 520), Image.Resampling.LANCZOS)
            image.save(thumb, quality=86)
    (out / "pools.json").write_text(json.dumps({"version": 1, "seed": args.seed, "prompt": PROMPT, "pools": pools}, indent=2) + "\n")
    print(f"{sum(len(p['candidates']) for p in pools)} judgments across {len(pools)} techniques; {len(needed)} posters", flush=True)


if __name__ == "__main__":
    main()
