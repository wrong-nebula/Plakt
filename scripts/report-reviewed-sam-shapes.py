"""Build the visual review and source-to-vector proof gallery."""
import html
import json
import os
from pathlib import Path
from urllib.parse import unquote, urlparse
from PIL import Image, ImageDraw, ImageFont, ImageOps

def main():
    out=Path("output/sam-shape-expansion-v1").resolve()
    images=out/"images";images.mkdir(exist_ok=True)
    families=json.loads((out/"reviewed-families.json").read_text())["families"]
    leads=[r for r in json.loads(Path("output/multimodal-study-v1/catalog-comparison.json").read_text())["candidates"] if r["scope"]=="shape"]
    decisions=[]
    accepted={f["source"]["posterID"] for f in families}|{"5d12dd24b7681dc52a39e57d-p0"}
    existing={"f3ec7fffbeecd97a1d3bf632-p0":"Perforated modules already have a source-linked recipe.",
              "eb707e2c926e561009f29469-p0":"Satellite-circle clusters already have a source-linked recipe.",
              "8f4f5df02d00dfb9b167d46b-p0":"Plain disc grids are the zero-satellite case of circle-clusters, now exposed as a control extension.",
              "6705055aecf0982f3ff1ef41-p0":"A spiral mark adds no new radial construction.",
              "34ad6baa0765a165da20ef35-p0":"The optical checker field relates to existing checker and line-screen families.",
              "3f2ee6c27214e66b41a7ae64-p0":"The solar roundel combines known discs, annular divisions and radial lines.",
              "780b45caab9a632395f7e22e-p0":"A flat roundel over a photograph is a known primitive.",
              "823039c9b4ed31aacd63ddbc-p0":"Circular photo windows and flat discs are known primitives.",
              "981682b97fa47d2c62297cea-p0":"Repeated discs coexist with a figurative collage; no additional abstract rule is established.",
              "16bb8eb313fff1a8d35d28d2-p0":"Ribbon and looped forms coexist with type; several continuous-curve recipes already exist.",
              "b8d73649935feb0114695f04-p0":"Flat circular collage modules do not establish another geometric system."}
    type_ids={"09c2769f6c6da73486794318-p0","195993d236d1d198e49443dd-p0","1b9b3f0c14ba25254a435081-p0","2b57ace033e8aa479468ed0f-p0","39f5c50554be1f9210973557-p0","3bf03b0519dfd70114af7dcf-p0","564780027ae81dbad069fbc3-p0","59c1af1afee95c1a5a2418fc-p0","5a81b0caa202b0a1c89d971b-p0","6e30298986118b16e4817737-p0","7d75c18b6c257ea904e6eafa-p0","896c633cce30840ba2d412e9-p0","c36098f0b00db9c525a7867c-p0","df6b13559d72b3f2bfb9e1f5-p0","fd96d3426e29d3231426e671-p0","b86bb587c9d5f91abc302a10-p0","4c8b7dffbd7173a52fdc948a-p0"}
    photo_ids={"00965d21564d30c2ff763f5e-p0","11e6de858f1e7b0cd0d8efbe-p0","2baef9834eb4f6d0a57c94c6-p0","49554b85d055fcc865144dda-p0","55a9b312099b26f339733901-p0","86cf39ce3dd4fdd9a7c80559-p0","9ae98b064ca98e2f736a6c52-p0","bd5316d08052a5a30fa4cb9b-p0","d8048dc11c7bef90c2300536-p0","dce307c105770f1ddb209aca-p0","f0db316f55a6e52b67981b40-p0","ff01183d089c85b4ab665032-p0"}
    for lead in leads:
        id=lead["posterID"]
        if id in accepted:
            action,reason="New-family source","Visual inspection and targeted SAM refinement support the new recipes. On FOCUS, neighboring motifs were refined separately from the coarse proposal."
        elif id in existing:
            action,reason="Existing vocabulary / extension",existing[id]
        elif id in type_ids:
            action,reason="Type / figurative context","Dominant lettering or figurative content needs a separate interpretation; sampled symmetry or holes do not establish a new abstract generator."
        elif id in photo_ids:
            action,reason="Photographic / figurative cue","Image content or an approximately round object does not establish a new editable abstract system."
        else:
            action,reason="No additional rule established","A related lattice, image-dependent line field, painterly mark or dense texture needs more evidence before a separate generator is justified."
        decisions.append(dict(posterID=id,samProposal=lead["relationship"],decision=action,reason=reason,scope="Source-level visual review"))
    (out/"visual-review.json").write_text(json.dumps(dict(candidateRelations=len(leads),sourcePosters=len({r["posterID"] for r in leads}),decisions=decisions),indent=2)+"\n")
    font=ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",20)
    overview=Image.new("RGB",(1080,900),"#eeeee8");draw=ImageDraw.Draw(overview)
    comparison=Image.new("RGB",(1440,500*len(families)),"#eeeee8");cd=ImageDraw.Draw(comparison)
    articles=[]
    def link(path,label):
        return '<a href="'+html.escape(os.path.relpath(path,out))+'">'+html.escape(label)+'</a>'
    for i,f in enumerate(families):
        id=f["id"];s=f["source"];b=f["bounds"]
        original=Image.open(unquote(urlparse(s["imageURL"]).path)).convert("RGB")
        source=original.crop((max(0,int(b["x"]*original.width)-3),max(0,int(b["y"]*original.height)-3),min(original.width,int((b["x"]+b["width"])*original.width)+3),min(original.height,int((b["y"]+b["height"])*original.height)+3)))
        source.save(images/(id+"-source.jpg"),quality=92)
        variants=[Image.open(out/f"renders/{id}/v{v}/poster.png").convert("RGB").crop((24,150,576,650)) for v in range(4)]
        tile=ImageOps.contain(variants[0],(320,365));x=(i%3)*360;y=(i//3)*450
        overview.paste(tile,(x+(360-tile.width)//2,y+20+(365-tile.height)//2));draw.text((x+16,y+405),f["name"],font=font,fill="#222b22")
        native=variants[1] if id=="polygon-contours" else variants[0]
        for col,(picture,title) in enumerate([(source,"Source"),(native,"Vector interpretation"),(variants[2],"Parameter variation")]):
            thumb=ImageOps.contain(picture,(440,410));comparison.paste(thumb,(col*480+(480-thumb.width)//2,i*500+50+(410-thumb.height)//2));cd.text((col*480+14,i*500+14),title+" · "+f["name"],font=font,fill="#222b22")
        strip=Image.new("RGB",(1440,350),"#eeeee8")
        for col,picture in enumerate(variants):
            thumb=ImageOps.contain(picture,(340,330));strip.paste(thumb,(col*360+(360-thumb.width)//2,(350-thumb.height)//2))
        strip.save(images/(id+"-variants.jpg"),quality=92)
        composition=Image.open(out/f"renders/{id}/composition/poster.png").convert("RGB")
        ImageOps.contain(composition,(600,850)).save(images/(id+"-composition.jpg"),quality=90)
        links=" · ".join([link(out/f"renders/{id}/v0/preset.json","Openable preset"),link(out/f"renders/{id}/v0/poster.pdf","Vector PDF"),link(out/f"renders/{id}/composition/genome.json","Complete layout"),link(Path(unquote(urlparse(s["evidenceURL"]).path)),"SAM evidence")])
        articles.append(f'<article id="{id}"><h2>{html.escape(f["name"])}</h2><p>{html.escape(f["kind"])}. '+html.escape(" ".join(f["invariants"]))+f'</p><div class="pair"><img src="images/{id}-source.jpg" alt="Source motif"><img src="images/{id}-composition.jpg" alt="New shape in a complete poster"></div><p class="small">Source crop and complete-layout insertion. Original text elements and paper colors are preserved.</p><img src="images/{id}-variants.jpg" alt="Four parameter variations"><p>{links}</p></article>')
    overview.save(images/"overview.jpg",quality=92);comparison.save(images/"source-comparisons.jpg",quality=92)
    m=json.loads((out/"source-measurements.json").read_text())
    rows="".join("<tr><td>"+r["posterID"]+"</td><td>"+html.escape(r["samProposal"])+"</td><td>"+html.escape(r["decision"])+"</td><td>"+html.escape(r["reason"])+"</td></tr>" for r in decisions)
    doc='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Reviewed shape families</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f5f0;color:#222b22;font:16px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:44px 24px 80px}h1{font-size:40px;line-height:1.14;letter-spacing:-.035em;margin:0 0 22px}h2{font-size:27px;margin:44px 0 16px}p{max-width:920px}a{color:#315b33;text-underline-offset:3px}.small{font-size:13px;color:#53604f}img{max-width:100%;height:auto}article{border-top:1px solid #c9cfc2;margin-top:44px;padding-top:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center}.pair img{max-height:540px;object-fit:contain;width:100%}.table{overflow:auto}table{border-collapse:collapse;font-size:13px}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #d3d8cd}td:first-child{overflow-wrap:anywhere;min-width:220px}pre{white-space:pre-wrap;background:#e9eddf;padding:18px;font-size:13px}li{margin:8px 0}@media(max-width:650px){main{padding:28px 16px}h1{font-size:30px}.pair{grid-template-columns:1fr}}</style><main><h1>Reviewed shape families</h1><p>Six editable vector recipes grew from visual review of the SAM shape findings. They reconstruct explicit geometry and relationships.</p><p><strong>45 recipes · 14 source-linked systems · 13 refined SAM selections</strong>. Zero satellites now expose a plain disc grid within the existing cluster family.</p><img src="images/overview.jpg" alt="Six new vector shape families"><h2>Evidence and testing</h2><p>The coarse pass supplied 61 candidate relations. Visual inspection identified useful motifs, including neighboring shapes on flagged posters; additional box prompts refined their masks. Model masks and independent local-paper estimates are retained separately.</p>'''
    doc+=f'<p>All eight wreath discs are selected. Their centers fit a circle with {m["relativeRadialResidual"]:.2%} relative radial residual. A native vector reconstruction overlaps the combined refined masks at {m["nativeReconstructionMaskIoU"]:.1%} IoU. This measures agreement with saved pixel estimates, not recovered authoring layers.</p>'
    doc+='''<ul><li>All 45 default renders are distinct; every advertised control changes pixels and saved presets replay exactly.</li><li>Checks cover physical circles, collision-safe orbits, annular areas, polygon/star apertures, polar-cell separation and seed variation.</li><li>Source systems and native recipes share renderers. Six complete-layout insertions preserve source text and paper.</li><li>New families support whole-poster placement, cropping and depth controls. Existing IDs and valid presets remain supported.</li></ul><p>'''
    doc+=" · ".join([link(images/"source-comparisons.jpg","Source / vector comparison sheet"),link(out/"source-measurements.json","Fit measurements"),link(out/"final-full-checks.log","Native regression checks"),link(out/"final-discovery-checks.log","System checks"),link(out/"visual-review.json","Visual review decisions")])+"</p>"+"".join(articles)
    doc+='''<h2>Every shape lead</h2><p>These are source-level readings of the contact sheets. Repeated relations from one poster remain visible. Photographs, lettering and single roundels do not automatically become new abstract recipes.</p><div class="table"><table><thead><tr><th>Source</th><th>SAM proposal</th><th>Review</th><th>Reason</th></tr></thead><tbody>'''+rows+'''</tbody></table></div><h2>Use and reproduce</h2><p>Open Shape library and search “sam-reviewed”. Edit the controls, save a preset, export vector PDF, or use the recipe in a poster. Whole-poster mode supports the new families.</p><pre>./dist/sam-shapes-preview/poster shape-library render --id disc-wreath --set count=12 --out output/my-wreath
./dist/sam-shapes-preview/poster shapes render --id shape-star-frame --set count=16 --out output/my-star
./dist/sam-shapes-preview/poster shape-library index --out output/my-shape-index
./output/sam-shape-expansion-v1/tools/poster-checks --shape-library-only</pre></main></html>'''
    (out/"index.html").write_text(doc)
    print(json.dumps(dict(newFamilies=len(families),reviewedRelations=len(leads),sourceFit=m),indent=2))

if __name__=="__main__":main()
