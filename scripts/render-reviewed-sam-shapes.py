"""Render reviewed recipes, variations and complete source-poster placements."""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path


def circle_fit(points):
    matrix = [[0.0]*4 for _ in range(3)]
    for x,y in points:
        row=[x,y,1];target=-(x*x+y*y)
        for i in range(3):
            for j in range(3):matrix[i][j]+=row[i]*row[j]
            matrix[i][3]+=row[i]*target
    for i in range(3):
        pivot=max(range(i,3),key=lambda k:abs(matrix[k][i]));matrix[i],matrix[pivot]=matrix[pivot],matrix[i]
        divisor=matrix[i][i]
        for j in range(i,4):matrix[i][j]/=divisor
        for k in range(3):
            if k==i:continue
            divisor=matrix[k][i]
            for j in range(i,4):matrix[k][j]-=divisor*matrix[i][j]
    cx,cy=-matrix[0][3]/2,-matrix[1][3]/2
    radius=math.sqrt(cx*cx+cy*cy-matrix[2][3])
    error=math.sqrt(sum((math.hypot(x-cx,y-cy)-radius)**2 for x,y in points)/len(points))/radius
    return cx,cy,radius,error


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--poster",type=Path,default=Path(".build/sam-shape-expansion/.build/release/poster"))
    parser.add_argument("--out",type=Path,default=Path("output/sam-shape-expansion-v1"))
    args=parser.parse_args();out=args.out.resolve();binary=args.poster.resolve()
    digest=hashlib.sha256(binary.read_bytes()).hexdigest();root=out/"renders"
    manifest=root/"manifest.json"
    if root.exists() and manifest.exists():
        old=json.loads(manifest.read_text())
        if old["executableSHA256"]!=digest:
            root.rename(out/("renders-previous-"+old["executableSHA256"][:10]))
    root.mkdir(exist_ok=True)
    catalog=json.loads(Path("Sources/PosterCore/Resources/ShapeLibrary/catalog.json").read_text())
    recipes={r["id"]:r for r in catalog["recipes"] if "sam-reviewed" in r["tags"]}
    options={
        "disc-wreath":[{},dict(count=12,flatten=.65,discRadius=.08,orbitRadius=.36),dict(count=5,orbitRadius=.30,discRadius=.13,phase=.5),dict(count=16,flatten=.8,discRadius=.09)],
        "segmented-ring":[{},dict(count=16,duty=.35,thickness=.3,phase=.18),dict(count=5,duty=.8,thickness=.55),dict(count=12,duty=.65,phase=.4)],
        "polygon-contours":[{},dict(count=1,sides=6,lineWidth=.055,phase=0),dict(count=6,sides=3,phase=-math.pi/2,inset=.75,lineWidth=.012),dict(count=12,sides=8,lineWidth=.006,phase=.1)],
        "star-frame":[{},dict(count=7,depth=.55,aperture=0),dict(count=16,depth=.32,aperture=.75),dict(count=4,depth=.6,aperture=.5)],
        "notched-disc":[{},dict(opening=1.8,depth=1.2,phase=-.8,flatten=.7),dict(opening=.4,depth=.5,phase=1.1),dict(opening=2.4,depth=1.3,phase=2.5)],
        "cellular-disc":[{},dict(rings=4,count=16,gutter=.16,stagger=.75,irregularity=.1),dict(rings=8,count=32,gutter=.08,irregularity=.7),dict(rings=5,count=20,gutter=.06,stagger=0,irregularity=0)],
    }
    parent_path=next(p for p in sorted(Path("output/source-personal-jury-v17/abstract").rglob("*-genome.json"))
                     if any(e["kind"]=="shape" and e["shape"]!="rectangle" and "information-paper" not in e["sourceElementID"] for e in json.loads(p.read_text())["elements"]))
    parent=json.loads(parent_path.read_text());parent_text=[e for e in parent["elements"] if e["kind"]=="text"]
    measurements=[]
    for id,variants in options.items():
        for index,values in enumerate(variants):
            folder=root/id/f"v{index}"
            if not folder.exists():
                command=[str(binary),"shape-library","render","--id",id,"--seed",str(817+(1 if id=="cellular-disc" and index==2 else 0)),"--out",str(folder)]
                if values:command += ["--set",",".join(f"{key}={value}" for key,value in values.items())]
                result=subprocess.run(command,capture_output=True,text=True)
                if result.returncode:raise RuntimeError(result.stderr)
        folder=root/id/"composition"
        if not folder.exists():
            result=subprocess.run([str(binary),"shape-library","render","--id",id,"--seed","817","--scene",str(parent_path),"--out",str(folder)],capture_output=True,text=True)
            if result.returncode:raise RuntimeError(result.stderr)
        child=json.loads((folder/"genome.json").read_text())
        assert [e for e in child["elements"] if e["kind"]=="text"]==parent_text,"Shape insertion changed source typography."
        assert child["background"]==parent["background"],"Shape insertion changed paper."
        assert any(e["shape"]==recipes[id]["renderer"] for e in child["elements"]),"Recipe did not reach the complete composition."
        measurements.append(dict(recipeID=id,variations=4,compositionTextPreserved=True,compositionPaperPreserved=True,sourceComposition=str(parent_path)))
        (root/"manifest.json").write_text(json.dumps(dict(executableSHA256=digest,families=measurements),indent=2)+"\n")
        print("Rendered",id,"with 4 variations and intact composition copy.",flush=True)
    selections=json.loads((out/"source-selections.json").read_text());discs=[s for s in selections if s["family"]=="disc-wreath"]
    width,height=discs[0]["imageWidth"],discs[0]["imageHeight"];aspect=height/width
    points=[(s["centerX"],s["centerY"]*aspect) for s in discs];cx,cy,radius,error=circle_fit(points)
    sizes=[(s["bounds"]["width"]+s["bounds"]["height"]*aspect)/4 for s in discs]
    phase=math.atan2(sum(math.sin(8*math.atan2(y-cy,x-cx)) for x,y in points),sum(math.cos(8*math.atan2(y-cy,x-cx)) for x,y in points))/8
    fitted=dict(count=8,orbitRadius=radius,discRadius=sum(sizes)/len(sizes),flatten=1,phase=phase)
    data=dict(selectedDiscCount=8,centerX=cx,centerY=cy/aspect,parameters=fitted,relativeRadialResidual=error,
              discRadiusVariation=(max(sizes)-min(sizes))/(sum(sizes)/len(sizes)),note="Measurements of independently segmented and locally color-refined source pixels; not an authoring-layer ground truth.")
    (out/"source-measurements.json").write_text(json.dumps(data,indent=2)+"\n")
    # Reuse the native renderer on a bare, source-aspect scene to test the fitted orbit.
    bare=json.loads((root/"disc-wreath/v0/genome.json").read_text());bare["elements"]=[next(e for e in bare["elements"] if e["kind"]=="shape")]
    bare["aspect"]=aspect;bare["background"]="#ffffff";bare["composition"]=None
    field_size=.98
    bare["elements"][0]["bounds"]=dict(x=cx-field_size/2,y=cy/aspect-field_size/2,width=field_size,height=field_size)
    bare["elements"][0]["color"]="#000000";bare["elements"][0]["rotation"]=0
    bare_path=out/"disc-wreath-fit-scene.json";bare_path.write_text(json.dumps(bare,indent=2)+"\n")
    target=root/"disc-wreath/source-fit"
    if not target.exists():
        render_parameters=dict(fitted);render_parameters["orbitRadius"]/=field_size;render_parameters["discRadius"]/=field_size
        result=subprocess.run([str(binary),"shape-library","render","--id","disc-wreath","--seed","817","--set",",".join(f"{key}={value}" for key,value in render_parameters.items()),"--scene",str(bare_path),"--out",str(target)],capture_output=True,text=True)
        if result.returncode:raise RuntimeError(result.stderr)
    from PIL import Image,ImageChops
    combined=Image.new("L",(width,height))
    for s in discs:
        mask=Image.open(out/"sources"/s["id"]/"ink-mask.png").convert("L");combined=ImageChops.lighter(combined,mask)
    rendered=Image.open(target/"poster.png").convert("RGB")
    pixels=rendered.load();prediction=Image.new("L",rendered.size)
    for y in range(rendered.height):
        for x in range(rendered.width):
            if sum(pixels[x,y])<384:prediction.putpixel((x,y),255)
    expected=combined.resize(rendered.size,Image.Resampling.NEAREST)
    intersection=sum(1 for a,b in zip(expected.getdata(),prediction.getdata()) if a and b)
    union=sum(1 for a,b in zip(expected.getdata(),prediction.getdata()) if a or b)
    data["nativeReconstructionMaskIoU"]=intersection/union
    (out/"source-measurements.json").write_text(json.dumps(data,indent=2)+"\n")
    assert data["relativeRadialResidual"]<.025 and data["nativeReconstructionMaskIoU"]>.90,"Orbit reconstruction needs review."
    (out/"source-measurements.json").write_text(json.dumps(data,indent=2)+"\n")
    print(json.dumps(data,indent=2))


if __name__=="__main__":
    main()
