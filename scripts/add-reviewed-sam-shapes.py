"""Install the six visually reviewed SAM shape interpretations without changing old recipes."""
import hashlib
import json
import copy
from pathlib import Path


ROOT = Path("output/sam-shape-expansion-v1").resolve()
LIBRARY = Path("Sources/PosterCore/Resources/ShapeLibrary/catalog.json")
SYSTEMS = Path("Sources/PosterCore/Resources/ShapeSystems/catalog.json")


def parameter(id, label, value, low, high, step=.01):
    return dict(id=id, label=label, value=value, min=low, max=high, step=step)


def main():
    sources = json.loads((ROOT/"source-selections.json").read_text())
    by_name = {s["id"]:s for s in sources}
    assert len(sources) == 13 and len({s["samFingerprint"] for s in sources}) == 1
    baseline = ROOT/"catalog-baseline.json"
    if not baseline.exists():
        baseline.write_text(json.dumps({"library":json.loads(LIBRARY.read_text()),"systems":json.loads(SYSTEMS.read_text())},indent=2)+"\n")
    records = [
        dict(id="disc-wreath", name="Disc wreath", group="Radial systems", source="disc-1", kind="arrangement",
             parameters=[parameter("count","Discs",8,3,24,1),parameter("orbitRadius","Orbit radius",.35,.12,.43),parameter("discRadius","Disc radius",.105,.015,.18,.005),parameter("flatten","Orbit height",1,.45,1),parameter("phase","Angular phase",0,-3,3)],
             traits=[0,1,.35,.45,1,.8,0,0], styles=["abstract","optical","editorial"],
             logic="Equal circular modules occupy an elliptical orbit at equal angular intervals. Radius is limited to keep neighboring discs separate and inside the field.",
             invariants=["Centers share one orbit and equal angular spacing.","Module radius stays constant; a chord bound prevents collisions."],
             sourceParameters=dict(count=8,orbitRadius=.363,discRadius=.105,flatten=1,phase=0)),
        dict(id="segmented-ring", name="Segmented ring", group="Radial systems", source="segmented-ring", kind="arrangement",
             parameters=[parameter("count","Arc segments",8,2,32,1),parameter("duty","Segment coverage",.64,.15,.88),parameter("thickness","Band thickness",.18,.06,.65),parameter("phase","Angular phase",0,-3,3)],
             traits=[0,1,.45,.35,1,.95,0,0],styles=["abstract","optical","editorial"],
             logic="Disjoint annular sectors share inner and outer circles. Segment count, angular coverage and band thickness vary independently.",
             invariants=["All sectors share the same two radii.","An angular gap separates every neighboring sector."],
             sourceParameters=dict(count=8,duty=.63,thickness=.18,phase=0)),
        dict(id="polygon-contours", name="Polygon contours", group="Angular contours", source="polygon-frame", kind="primitive and contour system",
             parameters=[parameter("count","Nested contours",9,1,28,1),parameter("sides","Polygon sides",4,3,12,1),parameter("inset","Total inward shrink",.84,.15,.94),parameter("lineWidth","Stroke weight",.009,.002,.06,.001),parameter("phase","Angular phase",.785398,-3,3)],
             traits=[1,0,.8,.25,1,.9,0,0],styles=["abstract","optical","editorial","swiss"],
             logic="A regular polygon supplies one frame or a family of concentric contours. Side count changes the primitive; equal radial steps and capped stroke width preserve nested gaps.",
             invariants=["Every contour shares side count, center and orientation.","Stroke width is capped below the contour separation."],
             sourceParameters=dict(count=1,sides=6,inset=.84,lineWidth=.055,phase=0)),
        dict(id="star-frame", name="Star frame", group="Angular silhouettes", source="star-frame", kind="primitive",
             parameters=[parameter("count","Star points",12,4,24,1),parameter("depth","Point depth",.25,.08,.65),parameter("aperture","Inner star aperture",.58,0,.82),parameter("phase","Angular phase",-1.570796,-3,3)],
             traits=[1,0,.5,.6,1,.75,0,0],styles=["abstract","optical","brutalist"],
             logic="Alternating tip and root radii define an even star. A concentric scaled star is subtracted with even-odd fill; zero aperture produces a solid star.",
             invariants=["Tips repeat at equal angular intervals.","The inner and outer stars are homothetic and never cross."],
             sourceParameters=dict(count=12,depth=.26,aperture=.58,phase=-1.570796)),
        dict(id="notched-disc", name="Notched disc", group="Cut silhouettes", source="notched-disc", kind="primitive",
             parameters=[parameter("opening","Notch angle (radians)",1.0472,.15,2.8),parameter("depth","Notch depth",1,.2,1.3),parameter("flatten","Disc height",1,.45,1),parameter("phase","Orientation",0,-3,3)],
             traits=[.4,.8,.15,.85,1,.5,1,0],styles=["abstract","editorial","brutalist"],
             logic="A triangular wedge removes part of a disc. The cut can reach its center or stop short; orientation and flattening transform the complete cut silhouette.",
             invariants=["One circular boundary and one wedge define the primitive.","Subtraction is clipped to the disc, so no wedge exterior is printed."],
             sourceParameters=dict(opening=1.0472,depth=1,flatten=1,phase=0)),
        dict(id="cellular-disc", name="Radial cell mosaic", group="Cellular systems", source="cellular-disc", kind="polar lattice system",
             parameters=[parameter("rings","Radial bands",6,2,10,1),parameter("count","Outer band cells",24,8,36,1),parameter("gutter","Cell separation",.09,.02,.22),parameter("stagger","Alternate-band stagger",.5,0,.9),parameter("irregularity","Boundary irregularity",.4,0,.8),parameter("phase","Angular phase",0,-3,3)],
             traits=[.5,.5,.9,.65,.6,.6,0,0],styles=["abstract","optical","editorial"],
             logic="Shared concentric band boundaries are partitioned into staggered curved cells. Cell count increases with radius; seeded seam and boundary variations retain the radial organization observed in the source.",
             invariants=["Adjacent bands use the same boundary function.","Cell separation leaves real negative-space gutters.","The declared seed reproduces every irregular boundary."],
             sourceParameters=dict(rings=6,count=24,gutter=.09,stagger=.5,irregularity=.4,phase=0)),
    ]
    measurements = ROOT/"source-measurements.json"
    if measurements.exists():
        records[0]["sourceParameters"] = json.loads(measurements.read_text())["parameters"]
    ids = {r["id"] for r in records}
    catalog = json.loads(LIBRARY.read_text()); system_catalog = json.loads(SYSTEMS.read_text())
    catalog["recipes"] = [r for r in catalog["recipes"] if r["id"] not in ids]
    system_catalog["systems"] = [s for s in system_catalog["systems"] if s["id"] not in {"shape-"+id for id in ids}]
    # A plain disc grid is the zero-satellite case, rather than a duplicate recipe.
    clusters=next(r for r in catalog["recipes"] if r["id"]=="circle-clusters")
    next(p for p in clusters["parameters"] if p["id"]=="satellite")["min"]=0
    if "disc-grid" not in clusters["tags"]:clusters["tags"].append("disc-grid")
    cluster_reference=dict(queryID="sam-visual-review",posterID="8f4f5df02d00dfb9b167d46b-p0",similarity=None)
    if cluster_reference not in clusters["references"]:clusters["references"].append(cluster_reference)
    reviewed = []
    for record in records:
        source = by_name[record["source"]]
        bounds = source["bounds"]
        if record["id"] == "disc-wreath":
            discs = [s["bounds"] for s in sources if s["family"] == "disc-wreath"]
            left=min(b["x"] for b in discs);top=min(b["y"] for b in discs)
            bounds=dict(x=left,y=top,width=max(b["x"]+b["width"] for b in discs)-left,height=max(b["y"]+b["height"] for b in discs)-top)
        reference=dict(queryID="sam-visual-review",posterID=source["posterID"],similarity=None,sourceBounds=bounds,sourceImageSHA256=source["sourceImageSHA256"],evidenceURL=source["evidenceURL"])
        recipe=dict(id=record["id"],name=record["name"],group=record["group"],renderer="motif-"+record["id"],parameters=record["parameters"],
                    traits=dict(zip(["angularity","curvature","detail","mass","regularity","counterform","directionality","volume"],record["traits"])),
                    styles=record["styles"],fontTarget=dict(weight=.48,width=.93,serif=.15,mono=.1,italic=.05),idealAspect=1,
                    tags=["sam-reviewed",record["kind"],record["id"]],logic=record["logic"],references=[reference],
                    basis="SAM source mask and Codex visual review support this authored vector interpretation. Controls and topology are tested; photographic texture and the original authoring layers are not recovered.")
        if record["id"] == "polygon-contours":
            recipe["references"].append(dict(queryID="sam-visual-review",posterID="5d12dd24b7681dc52a39e57d-p0",similarity=None))
        catalog["recipes"].append(recipe)
        system_catalog["systems"].append(dict(id="shape-"+record["id"],name=record["name"],operation=record["id"],sourcePosterID=source["posterID"],
            sourceImageURL=source["imageURL"],sourceBounds=bounds,promptID="sam-visual-review",retrievalSimilarity=None,seed=817,
            evidenceURL=source["evidenceURL"],sourceImageSHA256=source["sourceImageSHA256"],status="SAM-refined source; visually reviewed vector interpretation",
            explanation=record["logic"],invariants=record["invariants"],parameters=record["sourceParameters"],aspect=1,foreground="#253031",background="#eeeee8"))
        reviewed.append(dict(id=record["id"],name=record["name"],kind=record["kind"],source=source,bounds=bounds,invariants=record["invariants"],parameters=record["sourceParameters"],catalogID=record["id"]))
    old=json.loads(baseline.read_text())
    expected_old=copy.deepcopy(old["library"]["recipes"])
    expected_cluster=next(r for r in expected_old if r["id"]=="circle-clusters")
    next(p for p in expected_cluster["parameters"] if p["id"]=="satellite")["min"]=0
    expected_cluster["tags"].append("disc-grid");expected_cluster["references"].append(cluster_reference)
    assert catalog["recipes"][:len(expected_old)] == expected_old
    assert system_catalog["systems"][:len(old["systems"]["systems"])] == old["systems"]["systems"]
    catalog["version"]="poster-shape-library-v3"
    catalog["note"] = old["library"]["note"] + " Six source-reviewed SAM interpretations extend the catalog. Original IDs and valid parameter values remain supported; zero satellites now expose a plain disc grid in the existing cluster family."
    system_catalog["version"]="shape-system-catalog-v2"
    system_catalog["note"] = old["systems"]["note"] + " Six SAM-refined source interpretations share the shape-library vector renderers. SAM model estimates are not detection-accuracy probabilities."
    LIBRARY.write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+"\n");SYSTEMS.write_text(json.dumps(system_catalog,indent=2,ensure_ascii=False)+"\n")
    evidence={"reviewer":"Codex visual inspection of the 61 shape leads and refined source crops","sourceSelectionsSHA256":hashlib.sha256((ROOT/"source-selections.json").read_bytes()).hexdigest(),"families":reviewed,"note":"The cellular source has concentric growth bands and radial seams. Its generator uses a polar lattice, rather than duplicating the existing random Voronoi recipe."}
    (ROOT/"reviewed-families.json").write_text(json.dumps(evidence,indent=2)+"\n")
    Path("Sources/PosterCore/Resources/ShapeLibrary/sam-reviewed-sources.json").write_text(json.dumps(evidence,indent=2)+"\n")
    print(f'Added {len(records)} reviewed families: {len(catalog["recipes"])} recipes; {len(system_catalog["systems"])} source-linked systems.')


if __name__ == "__main__":
    main()
