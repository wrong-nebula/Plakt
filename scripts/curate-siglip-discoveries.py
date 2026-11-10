"""Materialize visually reviewed candidates from the two recorded SigLIP runs.

These annotations are procedural interpretations. Retrieval scores are retained
as evidence, never converted into detection probabilities or quality scores.
"""
import collections
import json
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "output/siglip-collection-snapshot-v1"
entries = json.loads((SNAPSHOT / "library.json").read_text())["posters"]
resource = ROOT / "Sources/PosterCore/Resources"
base = json.loads((resource / "TypeSystems/catalog.json").read_text())
base["systems"] = [s for s in base["systems"] if not s["id"].startswith("siglip-discovered-")]


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def entry(prefix):
    return next(e for e in entries if e["id"].startswith(prefix))


def similarity(scope, prompt, id):
    run = json.loads((ROOT / f"output/siglip-{scope}-discovery-v1/discovery.json").read_text())
    matches = next(p for p in run["prompts"] if p["prompt"]["id"] == prompt)["ranking"]["hits"]
    return next((h["similarity"] for h in matches if h["posterID"] == id), 0)


type_specs = [
    ("glyph-arc", "Tangential glyph arc", "d99e3b5e", "radial-type", (0.72, 0.04, 0.27, 0.84),
     {"count": 10, "radius": 0.34, "startAngle": -110, "sweep": 330}, {"sourceInput": "OPEN FORMS"},
     ["radial-type", "text-on-path"],
     "The circular name groups on the SALTS source use individually turned letterforms around open centers. The adaptation places input graphemes along a tangent-controlled arc; source names are not transcribed or claimed to be reconstructed.",
     ["Input grapheme order is preserved along the arc.", "Glyphs share one em size and follow the physical tangent."]),
    ("suffix-cycle", "Protected prefix with cycling suffix", "d225ed5e", "progressive-repetition", (0.25, 0.17, 0.50, 0.72),
     {"count": 3}, {"sourceInput": "Vi|ti|ni|ci", "suffixes": "ti|ni|ci"}, ["text-duplication"],
     "Visual inspection resolves the large Viti / Vini / Vici rows that OCR missed. The Vi prefix stays fixed while the terminal group changes. New input uses prefix|suffix|suffix; this is an annotated symbolic rule, not an OCR-derived exact fit.",
     ["The chosen prefix remains identical in every row.", "Suffixes follow the explicit supplied sequence; total length may change."]),
    ("glyph-grid", "Stepped glyph tiles", "157fec1b", "modular-letterforms", (0.19, 0.045, 0.59, 0.87),
     {"columns": 3, "diagonalCycle": 1, "quarterTurn": 0, "shear": 0.55, "scaleY": 0.62, "alternateInk": 0},
     {"sourceInput": "KUNSTKAMMER"}, ["glyph-repetition", "stepped-alignment"],
     "The yellow-and-black source advances KUNSTKAMMER through three recurring tile columns. The adaptation keeps the ordered glyph staircase and a shared affine shear. The photographed projective folds and Q/G branding are not reconstructed.",
     ["One glyph occupies each successive row.", "The column cycles modulo three while input order is retained.", "All cells use the declared common affine treatment."]),
]
feature_names = base["featureNames"][:]
for operation, *_ in type_specs:
    name = "operator:" + operation
    if name not in feature_names:
        feature_names.append(name)
for system in base["systems"]:
    system["semanticEmbedding"] += [0] * (len(feature_names) - len(system["semanticEmbedding"]))
base["featureNames"] = feature_names
new = []
for operation, name, prefix, prompt, bounds, parameters, text_parameters, tags, explanation, invariants in type_specs:
    e = entry(prefix)
    image = Image.open(unquote(urlparse(e["imageURL"]).path))
    frames = []
    if operation == "suffix-cycle":
        frames = [{"sourceElementID": "visual-suffix-" + str(i), "bounds": {"x": 0, "y": i / 3, "width": 1, "height": 0.30}, "rotation": 0} for i in range(3)]
    vector = [0.0] * len(feature_names)
    vector[feature_names.index("operator:" + operation)] = 2
    for tag in tags:
        if "tag:" + tag in feature_names:
            vector[feature_names.index("tag:" + tag)] = 1
    norm = sum(x*x for x in vector)**0.5
    system = {"version": "type-system-genome-v1", "id": "siglip-discovered-" + operation + "-" + e["id"],
        "name": name, "operation": operation, "tags": tags, "parameters": parameters,
        "textParameters": text_parameters, "sourcePosterID": e["id"], "sourceElementIDs": [],
        "sourceImageURL": e["imageURL"], "sourceAspect": image.height/image.width,
        "sourceBounds": dict(zip(["x", "y", "width", "height"], bounds)), "sourceEmbedding": None, "cropURL": None,
        "semanticEmbedding": [x/norm for x in vector], "confidence": 0.8, "status": "visual-annotated", "fitError": 0,
        "invariants": invariants, "explanation": explanation + " Confidence is a qualitative annotation, not a calibrated posterior; fitError is not an image-reconstruction metric.",
        "observations": [], "frames": frames, "indexSchedules": None}
    new.append(system)
draft = {**base, "systems": new, "note": "Three SigLIP-nominated, visually inspected type-rule interpretations. Original source bounds remain proposals. No source text is treated as instructions."}
draft["summary"] = {**base["summary"], "systems": 3, "exactFits": 0, "inferred": 0, "visualAnnotations": 3,
    "operatorCounts": dict(collections.Counter(s["operation"] for s in new))}
write(ROOT / "output/siglip-type-discovery-v1/new-types-draft.json", draft)
write(ROOT / "output/siglip-type-discovery-v1/annotation-evidence.json", [
    {"id": s["id"], "sourcePosterID": s["sourcePosterID"], "promptID": spec[3],
     "retrievalSimilarity": similarity("type", spec[3], s["sourcePosterID"]), "reviewer": "coding agent", "basis": s["explanation"]}
    for s, spec in zip(new, type_specs)])
# Store the padded baseline separately; merge only after native Vision embedding of the new crops.
write(ROOT / "output/siglip-type-discovery-v1/baseline-catalog.json", base)

shape_specs = [
    ("spiral-stack", "Progressively flattened spiral stack", "c5bef00f", "concentric-rings", (0.03,0.0,0.90,0.91),
     {"count":5,"turns":1.7,"growth":0.65,"lineWidth":0.035,"phase":0}, 1.4, "#151515", "#f4f2eb",
     "A shared spiral contour repeats down a column; vertical extent and pitch grow together.", ["Spiral topology remains constant.","Row extents follow a declared geometric progression."]),
    ("wave-lines", "Ordered wave-line field", "12f8c6f6", "moire-lines", (0.11,0.17,0.77,0.63),
     {"count":24,"amplitude":0.18,"frequency":0.8,"phase":0.4,"lineWidth":0.008}, 1.25,"#151515","#f6f5ef",
     "The ECAL source bends an ordered family of lines into a flow field. This prototype preserves shared phase and row order; its printed arrows and exact local flow are not recovered.", ["Every row samples the same smooth displacement field.","Stroke width scales in physical canvas units."]),
    ("mirror-arcs", "Four-way reflected arc bundles", "fac44fee", "radial-repeat", (0.15,0.12,0.70,0.76),
     {"count":6,"bend":0.50,"lineWidth":0.015}, 1.15,"#162b38","#d9e9ee",
     "The VOLUMES reference reflects curved stroke bundles across both axes, producing a central counterform. Smooth opposing arc bundles are a declared interpretation.", ["Four quadrants share one generating curve family.","Horizontal and vertical reflection and bundle count remain explicit."]),
    ("folded-tiles", "Affine zigzag tile field", "39c209ac", "tessellation", (0.04,0.03,0.92,0.93),
     {"rows":8,"columns":5,"slant":0.42}, 1.3,"#141414","#e84c3e",
     "The red-and-black source repeats a slanted tile on a regular lattice. The prototype isolates the affine repeat from photographed shading and wall context.", ["All tiles share a polygon and lattice spacing.","Row and column counts control density independently."]),
    ("circle-clusters", "Repeated satellite-circle clusters", "eb707e2c", "organic-repeat", (0.10,0.08,0.80,0.80),
     {"rows":6,"columns":4,"radius":0.29,"satellite":0.48,"phase":0.2}, 1.4,"#27212a","#eb67b7",
     "The Cully source distributes small circle clusters across a repeated field. This interpretation shares one cluster construction and cycles its orientation.", ["Each cluster contains one body and two attached satellite circles.","Cluster orientation follows a repeatable index cycle."]),
    ("perforated-grid", "Perforated rounded-tile lattice", "f3ec7fff", "concentric-rings", (0.22,0.21,0.60,0.66),
     {"rows":4,"columns":3,"holes":4}, 1.4,"#4d4d54","#edb5df",
     "The Festival de la Cité source combines rounded masses and circular counters on a repeated lattice. The prototype isolates that topology; the full multicolor composition is not reconstructed.", ["Counters remain negative space inside each tile.","Hole count and lattice density are independent controls."]),
    ("radial-spokes", "Equal-angle radial spokes", "02f8efca", "radial-repeat", (0.51,0.07,0.24,0.18),
     {"count":36,"innerRadius":0.025,"outerRadius":0.46,"lineWidth":0.008,"phase":0}, 1,"#292733","#f1eee6",
     "The FOCUS icon sheet contains a radial line motif. The prototype explicitly repeats a segment at equal angular intervals.", ["Angular increments equal 360 degrees divided by spoke count.","Inner and outer radii remain common to every spoke."]),
    ("petal-rosette", "Shared-petal rotational rosette", "02f8efca", "radial-repeat", (0.51,0.58,0.24,0.18),
     {"count":4,"outerRadius":0.46,"petalWidth":0.34,"phase":0.785398}, 1,"#c65d39","#f1eee6",
     "The FOCUS icon sheet repeats four pointed oval petals about one center. A shared closed Bézier petal supplies an editable rotational rule.", ["Every petal is a rigid rotation of one closed path.","Petal count, width and phase remain independent parameters."]),
]
shapes = []
for operation,name,prefix,prompt,bounds,parameters,aspect,ink,paper,explanation,invariants in shape_specs:
    e=entry(prefix)
    shapes.append({"id":"shape-"+operation,"name":name,"operation":operation,"sourcePosterID":e["id"],
        "sourceImageURL":e["imageURL"],"sourceBounds":dict(zip(["x","y","width","height"],bounds)),
        "promptID":prompt,"retrievalSimilarity":similarity("shape",prompt,e["id"]),
        "status":"visually-confirmed pattern; procedural interpretation; source bounds proposed",
        "explanation":explanation,"invariants":invariants,"parameters":parameters,"aspect":aspect,"foreground":ink,"background":paper})
shape_catalog={"version":"shape-system-catalog-v1","systems":shapes,
    "note":"SigLIP shortlisted sources across 1,130 frozen posters. A coding-agent visual review selected eight transferable shape relationships. These are editable vector interpretations, not automatic layer recovery, calibrated detections or exact source reconstructions. No type geometry is used."}
write(resource/"ShapeSystems/catalog.json",shape_catalog)
write(ROOT/"output/siglip-shape-discovery-v1/shape-catalog.json",shape_catalog)
if "--merge-embedded" in sys.argv:
    embedded=json.loads((ROOT/"output/siglip-type-discovery-v1/embedded-new-types/catalog.json").read_text())["systems"]
    combined={**base,"systems":base["systems"]+embedded}
    counts=collections.Counter(s["operation"] for s in combined["systems"])
    combined["summary"]={**base["summary"],"systems":len(combined["systems"]),
        "exactFits":sum(s["status"]=="fitted" for s in combined["systems"]),
        "inferred":sum(s["status"]=="inferred" for s in combined["systems"]),
        "visualAnnotations":sum(s["status"]=="visual-annotated" for s in combined["systems"]),
        "operatorCounts":{key:counts[key] for key in set(base["summary"]["operatorCounts"])|set(counts)}}
    combined["note"]+=" Three visually annotated SigLIP-nominated rules are included; descriptor dimensions include their operator columns. Retrieval affinity is not a detection probability."
    for target in [resource/"TypeSystems/catalog.json",ROOT/"library/type-systems.json",ROOT/"output/siglip-type-discovery-v1/catalog.json"]:
        write(target,combined)
    for target in [resource/"TypeSystems/curation.json",ROOT/"library/type-system-curation.json"]:
        curation=json.loads(target.read_text());curation["sourceSystems"]=len(combined["systems"]);curation["distinctSystems"]=len(combined["systems"])-len(curation["aliases"]);write(target,curation)
print("Prepared",len(new),"type annotations and",len(shapes),"shape-rule interpretations")
