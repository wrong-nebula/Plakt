"""Build an inspectable local gallery from the collection's recorded region evidence."""
import argparse
import collections
import hashlib
import html
import json
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=Path("library"))
    parser.add_argument("--out", type=Path, default=Path("output/multimodal-study-v1"))
    args = parser.parse_args()
    root, out = args.library.resolve(), args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    (out / "images").mkdir(exist_ok=True)
    catalog = json.loads((root / "library.json").read_text())
    entries = {e["id"]: e for e in catalog["posters"]}
    review_file = out / "visual-review.json"
    review_notes = json.loads(review_file.read_text())["notes"] if review_file.exists() else []
    review_by_id = {note["posterID"]: note for note in review_notes}
    def path(url):
        return Path(unquote(urlparse(url).path))

    def rel(file):
        return os.path.relpath(file, out)

    def link(file, label):
        return f'<a href="{html.escape(rel(file))}">{html.escape(label)}</a>'

    def image(file, width=270, height=360):
        return ImageOps.contain(Image.open(file).convert("RGB"), (width, height))

    shortlist_file = out / "family-shortlist.json"
    shortlist_html = ""
    if shortlist_file.exists():
        shortlisted = json.loads(shortlist_file.read_text())
        residual = shortlisted["fittedParameters"]["relativeCircleFitResidual"]
        if shortlisted.get("implementedRecipeID"):
            expansion = out.parent / "sam-shape-expansion-v1"
            overlap = shortlisted["nativeReconstructionMaskIoU"]
            shortlist_html = f'<h2>Six reviewed families added</h2><img src="../sam-shape-expansion-v1/images/overview.jpg" alt="Six executable vector shape families" style="width:100%;height:auto"><p>The disc wreath is now an editable recipe alongside segmented rings, polygon contours, star frames, notched discs and radial cell mosaics. All eight wreath discs were independently refined; their centers have {residual:.2%} relative radial residual. Native reconstruction reaches {overlap:.1%} IoU against the combined saved ink estimates. The shape library contains 45 recipes and 14 source-linked systems.</p><p>{link(expansion / "index.html", "Source comparisons, controls and validation")} · {link(shortlist_file, "Eight-disc fit evidence")}</p>'
        else:
            shortlist_html = f'<h2>A candidate family to develop</h2><h3>Disc wreath</h3><img src="images/candidate-disc-wreath.jpg" alt="Eight-disc source arrangement and four separately segmented discs" style="width:100%;height:auto"><p>Eight separated discs follow a circular orbit. Four SAM regions fit that orbit with {residual:.3%} relative radial residual. This is a fit to sampled mask centers, not a validation of all eight discs. A reusable renderer and full reconstruction checks remain to be implemented.</p><p>{link(shortlist_file, "Fitted candidate and remaining validation")}</p>'

    analyses, missing, stale = [], [], []
    for id, entry in entries.items():
        file = root / f"segmentation/posters/{id}/analysis.json"
        if not file.exists():
            missing.append(id)
            continue
        data = json.loads(file.read_text())
        if hashlib.sha256(path(entry["imageURL"]).read_bytes()).hexdigest() != data["imageHash"]:
            stale.append(id)
            continue
        analyses.append(data)
    regions = [r for a in analyses for r in a["regions"]]
    tag_counts = collections.Counter(t["tag"] for a in analyses for t in a["tags"])
    systems = [(a, s) for a in analyses for s in a["systems"]]
    type_count = sum(s["scope"] == "type" for _, s in systems)
    shape_count = sum(s["scope"] == "shape" for _, s in systems)
    summary = {"posterSurfaces": len(entries), "currentAnalyses": len(analyses), "missing": missing, "stale": stale,
               "postersWithRegions": sum(bool(a["regions"]) for a in analyses), "emptyAnalyses": sum(not a["regions"] for a in analyses),
               "postersWithTagProposals": sum(bool(a["tags"]) for a in analyses), "postersWithSystemCandidates": sum(bool(a["systems"]) for a in analyses),
               "regions": len(regions), "inkRefinedRegions": sum(r["inkRefinement"]["applied"] for r in regions),
               "tagProposals": sum(tag_counts.values()), "tags": dict(tag_counts.most_common()),
               "typeCandidates": type_count, "shapeCandidates": shape_count,
               "crossRegionCandidates": sum("cross-region" in s["status"] for _, s in systems),
               "note": "Predicted regions, uncalibrated tag proposals and system candidates. No confirmed technique labels are created."}
    (out / "coverage.json").write_text(json.dumps(summary, indent=2)+"\n")

    # Contact sheets let reviewers inspect every candidate, including weak or already-known patterns.
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
    for scope in ["type", "shape"]:
        matches = [(a, s) for a, s in systems if s["scope"] == scope]
        for page in range((len(matches)+11)//12):
            subset = matches[page*12:page*12+12]
            sheet = Image.new("RGB", (1440, 430*((len(subset)+3)//4)), "#eeeee8")
            draw = ImageDraw.Draw(sheet)
            for index, (analysis, candidate) in enumerate(subset):
                x, y = (index % 4)*360, (index//4)*430
                thumbnail = image(path(entries[analysis["posterID"]]["imageURL"]), 340, 340)
                sheet.paste(thumbnail, (x+(360-thumbnail.width)//2, y+10+(340-thumbnail.height)//2))
                draw.text((x+10,y+357), candidate["relationship"][:35], font=font, fill="#222b22")
                draw.text((x+10,y+384), analysis["posterID"][:25], font=font, fill="#4c574c")
            sheet.save(out / "images" / f"{scope}-candidates-{page+1}.jpg", quality=90)

    examples = []
    selected = []
    for scope in ["type", "shape"]:
        candidates = [(a, s) for a, s in systems if s["scope"] == scope]
        candidates.sort(key=lambda pair: (-len(pair[1]["regionIDs"]), pair[0]["posterID"]))
        seen = set()
        for analysis, candidate in candidates:
            if analysis["posterID"] in seen:
                continue
            seen.add(analysis["posterID"])
            selected.append((analysis, candidate))
            if len(seen) == 6:
                break
    for index, (analysis, candidate) in enumerate(selected):
        by_id = {r["id"]: r for r in analysis["regions"]}
        region = by_id[candidate["regionIDs"][0]]
        panel = Image.new("RGB", (1440, 620), "#eeeee8")
        draw = ImageDraw.Draw(panel)
        items = [(path(entries[analysis["posterID"]]["imageURL"]), "Poster surface"),
                 (path(region["maskURL"]), "SAM object mask"), (path(region["cutoutURL"]), "Estimated printed ink")]
        for column, (file, title) in enumerate(items):
            opened = Image.open(file).convert("RGBA")
            if column == 2:
                backing = Image.new("RGBA", opened.size, "#eeeee8");backing.alpha_composite(opened);opened = backing
            thumb = ImageOps.contain(opened.convert("RGB"), (440, 550))
            panel.paste(thumb, (column*480+(480-thumb.width)//2, 44+(550-thumb.height)//2))
            draw.text((column*480+18, 14), title, font=font, fill="#222b22")
        destination = out / "images" / f"example-{index+1}.jpg"
        panel.save(destination, quality=92)
        evidence = " ".join(candidate["evidence"])
        related = ", ".join(r["name"] for r in region["relatedSystems"] if r["scope"] == candidate["scope"])
        reviewed = review_by_id.get(analysis["posterID"])
        review_html = f'<p><strong>{html.escape(reviewed["assessment"])}.</strong> {html.escape(reviewed["note"])}</p>' if reviewed else ""
        examples.append(f'<article><h3>{html.escape(candidate["scope"].title()+" · "+candidate["relationship"])}</h3><img src="images/example-{index+1}.jpg" alt="Source surface, SAM object mask and estimated printed ink"><p>{html.escape(evidence)}</p>{review_html}<p class="small">Related saved systems: {html.escape(related)}. These are retrieval leads for review.</p><p>{link(root / ("segmentation/posters/"+analysis["posterID"]+"/analysis.json"), "Full evidence")} · {link(path(region["cutoutURL"]), "Transparent cutout")} · {link(path(region["inkMaskURL"]), "Ink mask")}</p></article>')

    rows = []
    for analysis in sorted(analyses, key=lambda a: (-len(a["systems"]), a["posterID"])):
        id = analysis["posterID"]
        scopes = " ".join(sorted(set(s["scope"] for s in analysis["systems"])))
        tags = ", ".join(t["tag"] for t in analysis["tags"])
        words = " ".join(r["text"] for r in analysis["regions"])
        reviewed = review_by_id.get(id)
        review_text = (reviewed["assessment"]+". "+reviewed["note"]) if reviewed else ""
        search = html.escape((id+" "+tags+" "+words+" "+review_text).lower(), quote=True)
        review_html = f'<div class="small">Review: {html.escape(review_text)}</div>' if reviewed else ""
        thumbnail = out / "images" / f'thumb-{id}-{analysis["imageHash"][:10]}.jpg'
        if not thumbnail.exists():
            image(path(entries[id]["imageURL"]), 140, 200).save(thumbnail, quality=85)
        rows.append(f'<tr data-scope="{scopes}" data-search="{search}"><td><img loading="lazy" class="thumb" src="{html.escape(rel(thumbnail))}" alt="Poster {id}"></td><td>{link(root / f"segmentation/posters/{id}/analysis.json", id)}<div class="small">{html.escape(words[:160])}</div>{review_html}</td><td>{len(analysis["regions"])}</td><td>{html.escape(scopes or "—")}</td><td>{len(analysis["systems"])}</td><td>{html.escape(tags or "—")}</td></tr>')
    contacts = []
    for scope, count in [("type", type_count), ("shape", shape_count)]:
        contacts.append(f'<p>{scope.title()} candidate sheets: '+(" · ".join(link(out / "images" / f"{scope}-candidates-{page+1}.jpg", str(page+1)) for page in range((count+11)//12)) or "none in this pass")+"</p>")
    generated = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m-%d %H:%M JST")
    retrieval_examples = []
    for name, title in [("text", "Text query · concentric circular line pattern"), ("anchor", "Selected region · appearance, meaning and geometry")]:
        hits_file = out / f"{name}-region-hits.json"
        if not hits_file.exists():
            continue
        hits = json.loads(hits_file.read_text())[:12]
        sheet = Image.new("RGB", (1440, 300*((len(hits)+3)//4)), "#eeeee8")
        draw = ImageDraw.Draw(sheet)
        for index, hit in enumerate(hits):
            x, y = (index%4)*360, (index//4)*300
            opened = Image.open(path(hit["imageURL"])).convert("RGBA")
            backing = Image.new("RGBA", opened.size, "#eeeee8"); backing.alpha_composite(opened)
            thumb = ImageOps.contain(backing.convert("RGB"), (330, 220))
            sheet.paste(thumb, (x+(360-thumb.width)//2,y+8+(220-thumb.height)//2))
            draw.text((x+12,y+236), f'{index+1}. {hit["posterID"][:25]}', font=font, fill="#222b22")
            ranks = " · ".join(f'{signal} #{rank}' for signal, rank in sorted(hit["ranks"].items()))
            draw.text((x+12,y+266), ranks, font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12), fill="#4c574c")
        sheet.save(out / "images" / f"{name}-retrieval.jpg", quality=90)
        retrieval_examples.append(f'<article><h3>{html.escape(title)}</h3><img src="images/{name}-retrieval.jpg" alt="Twelve retrieved region cutouts with separate signal ranks"><p>{link(hits_file, "Raw ranks and similarities")}</p></article>')
    document = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source regions and system candidates</title><link rel="icon" href="data:,">
<style>*{box-sizing:border-box}body{margin:0;background:#f6f5f0;color:#222b22;font:16px/1.6 system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:44px 24px 80px}h1{font-size:40px;line-height:1.14;letter-spacing:-.035em;max-width:900px;margin:0 0 22px}h2{font-size:27px;letter-spacing:-.02em;margin:50px 0 16px}h3{font-size:21px;margin:0 0 18px}p{max-width:920px}.small{font-size:12px;color:#53604f}a{color:#315b33;text-underline-offset:3px}article{margin:30px 0 42px;border-top:1px solid #c9cfc2;padding-top:24px}article img{width:100%;height:auto;display:block}label{display:inline-flex;gap:8px;align-items:center;margin:0 20px 18px 0}input,select{font:inherit;padding:7px 9px;border:1px solid #a9b5a3;border-radius:5px;background:#fff;color:inherit}input{width:min(420px,65vw)}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;padding:12px 10px;border-bottom:1px solid #d3d8cd}th{font-weight:600}td a{overflow-wrap:anywhere}.thumb{width:70px;max-height:110px;object-fit:contain}td:nth-child(2){min-width:250px}pre{white-space:pre-wrap;font-size:13px;background:#e9eddf;padding:18px}li{margin:8px 0}@media(max-width:650px){main{padding:28px 16px}h1{font-size:30px}h2{font-size:24px}label{display:flex}input{width:100%}}</style>
<main><h1>Source regions and system candidates</h1><p>SAM 2.1 isolates source regions. Vision compares their appearance; SigLIP compares their meaning. Printed-ink measurements and component layouts provide additional evidence for tags, repetition and geometry.</p>'''
    document += f'<p><strong>{len(analyses)} / {len(entries)} current poster analyses</strong> · {len(regions)} isolated regions · {sum(tag_counts.values())} tag proposals · {type_count} type / {shape_count} shape candidates.</p>'
    if missing or stale:
        document += f'<p>{len(missing)} posters have no completed analysis; {len(stale)} have changed since analysis. This gallery includes current results only.</p>'
    document += '''<p>These are unconfirmed proposals. Original SAM masks and measured ink estimates are retained separately. Source bounds, model estimates and similarities require visual review before becoming trusted labels or reusable vector rules. The corpus pass samples declared prompts; it is not exhaustive layer recovery.</p>
<h2>How the evidence combines</h2><ol><li>Existing OCR and source-region proposals guide SAM alongside a coarse point grid. Interactive selection adds foreground/background marks or a box.</li><li>Local background consistency determines whether printed ink can be estimated inside the SAM object. Separate masks preserve the original model output.</li><li>Isolated regions get typed Vision and SigLIP features. Their positions, components, gaps and circle/grid fits provide geometric evidence.</li><li>Selected-region retrieval combines separate appearance, semantic and geometry rankings. Existing source-linked type and shape systems provide further references.</li><li>Cross-region candidates require agreement across nonoverlapping masks. Explicit review remains the source of confirmed training labels.</li></ol>
'''+shortlist_html+'''<h2>Retrieval examples</h2>'''+"".join(retrieval_examples)+'''<h2>Examples to inspect</h2><p>Visual review found that some repetition comes from adjacent physical poster copies in the photograph. Approximate symmetry also occurs in photographic objects. These cues help source-border or duplicate review, but do not establish a procedural design rule. Review notes below are Codex observations, not confirmed collection labels.</p>'''+"".join(examples)+'''<h2>Every recorded poster</h2><label>Find<input id="query" type="search" placeholder="Poster ID, words or proposed tags"></label><label>Candidates<select id="scope"><option value="">All analyses</option><option value="type">Type</option><option value="shape">Shape / geometry</option></select></label><div class="table-wrap"><table><thead><tr><th>Source</th><th>Poster and observed text</th><th>Regions</th><th>Scope</th><th>Candidates</th><th>Suggested tags</th></tr></thead><tbody>'''+"".join(rows)+'''</tbody></table></div><h2>Candidate contact sheets</h2>'''+"".join(contacts)+'''<h2>Reproduce and inspect</h2><pre>./dist/poster library analyze-regions --library library --grid 2 --max-regions 4
./dist/poster library region-search --library library --query 'concentric circular line pattern'
./dist/poster library region-search --library library --region REGION_ID
./dist/poster library refresh-region-links --library library</pre><p>Open Review library → Elements &amp; styles → Select region… in the native app. Foreground/background marks and model alternatives refine a selection. Using a region stores its provenance; technique suggestions remain unconfirmed.</p><p>'''
    document += link(out / "coverage.json", "Coverage and counts")+" · "+link(root / "segmentation/run.json", "Run checkpoint")+" · "+link(Path("SOURCE-REGIONS.md").resolve(), "Implementation and commands")
    if review_notes:
        document += " · "+link(review_file, "Visual review notes")
    document += f'</p><p class="small">Generated {generated}. All inference ran locally. SAM uses Apple’s pinned SAM 2.1 Tiny Core ML pack, with CPU execution verified against the packaged-model reference. Similarity, estimated IoU and geometry are separate measurements.</p></main><script>const q=document.querySelector("#query"),s=document.querySelector("#scope");function filter(){{const v=q.value.toLowerCase();for(const r of document.querySelectorAll("tbody tr"))r.hidden=!(r.dataset.search.includes(v)&&(!s.value||r.dataset.scope.includes(s.value)));}}q.addEventListener("input",filter);s.addEventListener("change",filter);</script></html>'
    (out / "index.html").write_text(document)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
