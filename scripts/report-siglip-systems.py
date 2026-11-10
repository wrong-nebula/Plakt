"""Build the local, reproducible evidence gallery from completed native runs."""
import html
import json
from pathlib import Path
from urllib.parse import unquote, urlparse

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/siglip-system-study-v1"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "images").mkdir(exist_ok=True)


def read(path):
    return json.loads((ROOT / path).read_text())


def path(url):
    return Path(unquote(urlparse(url).path))


def relative(file):
    import os
    return os.path.relpath(file, OUT)


def link(file, label):
    return f'<a href="{html.escape(relative(file))}">{html.escape(label)}</a>'


def font(size):
    return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)


def thumbnail(file, size, bounds=None):
    image = Image.open(file).convert("RGB")
    if bounds:
        w, h = image.size
        x, y, bw, bh = [bounds[k] for k in ("x", "y", "width", "height")]
        image = image.crop((round(x*w), round(y*h), round((x+bw)*w), round((y+bh)*h)))
    return ImageOps.contain(image, size)


def comparison(images, labels, destination):
    canvas = Image.new("RGB", (1500, 680), "#e9e8e2")
    draw = ImageDraw.Draw(canvas)
    for i, ((file, bounds), label) in enumerate(zip(images, labels)):
        thumb = thumbnail(file, (460, 605), bounds)
        canvas.paste(thumb, (i*500+(500-thumb.width)//2, 50+(605-thumb.height)//2))
        draw.text((i*500+20, 16), label, fill="#20251f", font=font(18))
    canvas.save(destination, quality=93)


type_run = read("output/siglip-type-discovery-v1/discovery.json")
shape_run = read("output/siglip-shape-discovery-v1/discovery.json")
catalog = read("Sources/PosterCore/Resources/TypeSystems/catalog.json")
curation = read("library/type-system-curation.json")
semantic = read("output/type-systems-siglip-v1/semantic-index.json")
shape_catalog = read("output/siglip-shape-discovery-v1/shape-catalog.json")
for run in (type_run, shape_run):
    assert run["posterCount"] == 1130
    assert all(p["ranking"]["indexed"] == 1130 and p["ranking"]["missingOrStale"] == 0 for p in run["prompts"])
assert not semantic["failures"]
assert len(semantic["profiles"]) == len(catalog["systems"])

# Rebuild shortlist sheets from the final frozen runs, rather than an earlier live index.
for run in (type_run, shape_run):
    folder = ROOT / f'output/siglip-{run["scope"]}-discovery-v1'
    for page in range((len(run["prompts"])+3)//4):
        prompts = run["prompts"][page*4:page*4+4]
        canvas = Image.new("RGB", (1560, 420*len(prompts)), "#e9e8e2")
        draw = ImageDraw.Draw(canvas)
        for row, prompt in enumerate(prompts):
            draw.text((18, row*420+10), prompt["prompt"]["id"]+" — "+prompt["prompt"]["description"], fill="#20251f", font=font(19))
            for i, hit in enumerate(prompt["ranking"]["hits"][:6]):
                thumb = thumbnail(path(hit["imageURL"]), (240, 325))
                x, y = i*260+(260-thumb.width)//2, row*420+44+(325-thumb.height)//2
                canvas.paste(thumb, (x, y))
                draw.text((i*260+10, row*420+374), hit["posterID"][:18], fill="#20251f", font=font(12))
                draw.text((i*260+10, row*420+392), f'cosine {hit["similarity"]:.4f}', fill="#50554d", font=font(12))
        canvas.save(folder / f"contact-{page+1}.jpg", quality=92)

type_cards = []
for system in [s for s in catalog["systems"] if s["id"].startswith("siglip-discovered-")]:
    operation = system["operation"]
    proof_root = "proofs-v3" if operation == "glyph-grid" else "proofs"
    proof = ROOT / "output/siglip-type-discovery-v1" / proof_root / operation
    image = OUT / "images" / (operation+".jpg")
    comparison([(path(system["sourceImageURL"]), system["sourceBounds"]), (proof / "poster.png", None)],
               ["Source region · proposed bounds", "Native rule with new input"], image)
    # Two columns are intentional for type; omit the unused third panel in the saved image.
    with Image.open(image) as opened:
        opened.crop((0, 0, 1000, 680)).save(image, quality=93)
    verification = ' Title verified against the <a href="https://visarte.ch/wp-content/uploads/2022/08/appel-projets_23-2.pdf">organizer’s brief: Viti Vini Vici</a>.' if operation == "suffix-cycle" else ""
    type_cards.append(f'<article><h3>{html.escape(system["name"])}</h3><img src="images/{operation}.jpg" alt="Source region and editable type adaptation"><p>{html.escape(system["explanation"].split(" Confidence")[0])}{verification}</p><p>{link(proof / "poster.pdf", "Vector PDF")} · {link(proof / "genome.json", "Editable scene")} · {link(proof / "trace.json", "Transformation trace")}</p></article>')

shape_cards = []
montage = Image.new("RGB", (1500, 680*len(shape_catalog["systems"])), "#e9e8e2")
for i, system in enumerate(shape_catalog["systems"]):
    proof = ROOT / "output/siglip-shape-discovery-v1/proofs-v4" / system["id"]
    image = OUT / "images" / (system["id"]+".jpg")
    key = "count" if "count" in system["parameters"] else "rows"
    comparison([(path(system["sourceImageURL"]), system["sourceBounds"]), (proof / "default/poster.png", None), (proof / "variation/poster.png", None)],
               ["Source region · proposed bounds", "Native vector interpretation", f'Variation · {key} + 2'], image)
    with Image.open(image) as opened:
        montage.paste(opened, (0, i*680))
    parameters = ", ".join(f"{k}={v:g}" for k, v in system["parameters"].items())
    shape_cards.append(f'<article><h3>{html.escape(system["name"])}</h3><img loading="lazy" src="images/{system["id"]}.jpg" alt="Source region, vector interpretation and parameter variation"><p>{html.escape(system["explanation"])}</p><p class="small">{html.escape(parameters)}</p><p>{link(proof / "default/poster.pdf", "Vector PDF")} · {link(proof / "default/genome.json", "Editable scene")} · {link(proof / "default/system.json", "Rule and parameters")}</p></article>')
montage.save(ROOT / "output/siglip-shape-discovery-v1/source-rule-variation-v4.jpg", quality=90)

stats = {"postersPerPass":1130, "typePrompts":len(type_run["prompts"]), "shapePrompts":len(shape_run["prompts"]),
         "originalTypeRecords":456, "currentTypeRecords":len(catalog["systems"]), "distinctTypeVariants":curation["distinctSystems"],
         "nearDuplicateAliases":len(curation["aliases"]), "exactProbeDuplicates":curation["exactProbeDuplicates"],
         "typeFamilies":len(set(s["operation"] for s in catalog["systems"])), "shapeInterpretations":len(shape_catalog["systems"]),
         "sourceEmbeddings":len(semantic["profiles"]), "neutralProbeEmbeddings":sum(len(p["probes"]) for p in semantic["profiles"]),
         "modelFingerprint":curation["modelFingerprint"], "reviewer":"coding agent; no independent human validation"}
(OUT / "summary.json").write_text(json.dumps(stats, indent=2)+"\n")
evidence = []
for scope, run in (("type", type_run), ("shape", shape_run)):
    folder = ROOT / f"output/siglip-{scope}-discovery-v1"
    sheets = " · ".join(link(folder / f"contact-{i+1}.jpg", f"Shortlist {i+1}") for i in range((len(run["prompts"])+3)//4))
    evidence.append(f'<li>{scope.title()} pass: {link(folder / "discovery.json", "Full ranked results")} · {sheets}</li>')
pair_sheets = " · ".join(link(ROOT / f"output/type-systems-siglip-v1/pair-review-{i}.jpg", f"Pair review {i}") for i in range(1,5))
document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SigLIP · systems study</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f4ef;color:#222820;font:17px/1.6 system-ui,sans-serif}main{max-width:1140px;margin:auto;padding:54px 24px 90px}h1{font-size:clamp(32px,5vw,60px);line-height:1.08;letter-spacing:-.045em;max-width:850px;margin:16px 0 24px}h2{font-size:30px;letter-spacing:-.025em;margin:64px 0 14px}h3{font-size:23px;letter-spacing:-.02em;margin:0 0 20px}p{max-width:850px}.kicker,.small{font-size:13px;color:#5d6658}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;border-block:1px solid #c7cdbf;padding:24px 0;margin:36px 0}.stats strong{font-size:36px;line-height:1.2;display:block}.stats span{font-size:13px}article{border-top:1px solid #c7cdbf;padding-top:26px;margin-top:36px}img{display:block;width:100%;height:auto;background:#e9e8e2}a{color:#315b33;text-underline-offset:3px}code{font-size:13px;overflow-wrap:anywhere}pre{white-space:pre-wrap;background:#e7ebdf;padding:20px;overflow:auto}li{margin:10px 0}@media(max-width:650px){.stats{grid-template-columns:repeat(2,1fr)}main{padding:32px 18px}h2{margin-top:42px}}</style>
<main><div class="kicker">POSTERLAB · 8 NOVEMBER 2026 · LOCAL CORE ML STUDY</div><h1>Finding reusable systems<br>with SigLIP</h1>
<p>Two collection-wide retrieval passes, followed by source inspection and executable vector rules. The type catalog gains three methods; eight separate shape interpretations keep their geometry and controls.</p>
<div class="stats"><div><strong>1,130</strong><span>posters scored in each pass</span></div><div><strong>448</strong><span>distinct type variants · 459 source records</span></div><div><strong>3</strong><span>new type rules · 14 families total</span></div><div><strong>8</strong><span>editable shape interpretations</span></div></div>
<h2>Improving the existing 456</h2><p>Every original system was encoded as its source crop and two neutral fixed-copy vector specimens. The expanded catalog now has 459 source embeddings and 918 specimen embeddings, with no failures. Related variants in the app blend the normalized operator descriptor (60%) with SigLIP specimen resemblance (40%).</p>
<p>Twenty-eight conservative near-pair proposals were inspected. Eleven close variants from the same poster and operation are grouped under representative IDs. Both probe cosines had to exceed 0.98, normalized layout difference stay below 0.04, and symbolic behavior match. Grouping retains every source record, stable ID and replayable genome. There were <strong>zero exact two-probe pixel duplicates</strong>; the 11 aliases are near repeats, not proven interchangeable rules.</p>
<p>''' + link(ROOT / "library/type-system-curation.json", "Grouping records") + " · " + pair_sheets + '''</p>
<h2>Three additional type rules</h2><p>Sixteen type prompts scored the full frozen collection. These three reviewed examples were turned into native rules and rendered with new input. They are visual annotations; image reconstruction was not fitted.</p>''' + "".join(type_cards) + '''
<h2>A separate pass for shapes</h2><p>Fourteen shape prompts scored the same 1,130 images. These eight vector interpretations use no type geometry. Each comparison shows the proposed source region, a native rendering and a changed count or row parameter. They preserve a transferable relationship rather than reconstructing the original authoring layers.</p>''' + "".join(shape_cards) + '''
<h2>Use the results</h2><p>Open <strong>Explore type systems…</strong> in PosterLab. The three new methods accept fresh copy; <strong>Related variants</strong> uses the new specimen embeddings. The default variant count excludes the eleven aliases. Semantic reference search is under <strong>Review library → Elements &amp; styles → Visual meaning</strong>.</p>
<p>The eight shape studies are available through the CLI, with vector PDF and editable scene output:</p><pre><code>./dist/poster shapes list
./dist/poster shapes render --id shape-wave-lines \\
  --set count=30,amplitude=0.12 --out output/my-wave-system
./dist/poster library discover-systems --library output/siglip-collection-snapshot-v1 \\
  --scope shape --models models/siglip --out output/my-shape-retrieval</code></pre>
<h2>Evidence and limits</h2><p>SigLIP ranks visual affinity. Its scores are not probabilities, verified technique labels or aesthetic judgments. The prompts can retrieve the same visually striking source for different reasons. Only selected high-ranking sources and all proposed duplicate pairs received coding-agent visual review; this is not independent human validation. Source borders remain proposed where unconfirmed. The collection snapshot fixes image bytes and embeddings so later library edits cannot change these run results.</p><ul>''' + "".join(evidence) + '<li>' + link(ROOT / "output/type-systems-siglip-v1/semantic-index.json", "System embeddings and two-probe inputs") + "</li><li>" + link(ROOT / "output/siglip-collection-snapshot-v1/snapshot.json", "Frozen collection provenance") + "</li><li>" + link(OUT / "summary.json", "Machine-readable counts") + '''</li></ul><p class="small">Model: google/siglip-base-patch16-224 · original revision 7fd15f0689c79d79e38b1c2e2e2370a7bf2761ed · original tokenizer and independently checked Core ML conversion. All inference and rendering ran locally.</p></main></html>'''
(OUT / "index.html").write_text(document)
print(json.dumps(stats, indent=2))
