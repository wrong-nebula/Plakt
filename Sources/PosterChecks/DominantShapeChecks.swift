import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkDominantShapes()throws {
        let recipe=PosterShapeLibrary.recipe("poster-helix")!
        var p=PosterShapePreset(recipe:recipe,seed:12345)
        var s=DominantShapeSettings();s.depth="weave";p.dominant=s
        let a=try DominantShapeSystem.scene(p)
        let decoded=try JSONDecoder().decode(PosterShapePreset.self,from:JSONEncoder().encode(p))
        let b=try DominantShapeSystem.scene(decoded)
        let first=try rgba(LibrarySceneRenderer.render(a,width:320)),again=try rgba(LibrarySceneRenderer.render(b,width:320))
        try require(first==again,"Dominant preset replay differs")
        let backs=a.elements.filter{$0.geometry?["dominantDepth"]==0},fronts=a.elements.filter{$0.geometry?["dominantDepth"]==1}
        try require(backs.count==1 && !fronts.isEmpty,"Logical object or front pass missing")
        for front in fronts {
            try require(front.bounds==backs[0].bounds && front.shape==backs[0].shape,"Front pass moved the underlying object")
            try require(front.geometry?["shapeSeed"]==backs[0].geometry?["shapeSeed"] && front.clipBounds != nil,"Front pass seed/clip lost")
        }
        s.count=2;s.secondRecipeID="tone-torus";p.dominant=s
        let two=try DominantShapeSystem.scene(p)
        try require(two.elements.filter{$0.geometry?["dominantDepth"]==0}.count==2,"Two objects not represented")
        s.count=1;s.depth="behind";p.dominant=s
        let behind=try rgba(LibrarySceneRenderer.render(DominantShapeSystem.scene(p),width:320))
        try require(behind != first,"Weave does not change the rendered text crossing")
        s.depth="front";p.dominant=s
        let front=try rgba(LibrarySceneRenderer.render(DominantShapeSystem.scene(p),width:320))
        try require(front != behind && front != first,"Front/behind/weave render identically")
        var hashes:Set<Data>=[]
        for framing in DominantShapeSystem.framings {
            s.framing=framing;p.dominant=s
            let scene=try DominantShapeSystem.scene(p)
            let pixels=Data(try rgba(LibrarySceneRenderer.render(scene,width:260)))
            try require(hashes.insert(pixels).inserted,"Framing does not affect pixels")
            let m=try DominantShapeMeasurements.evaluate(scene,settings:s)
            try require(m.scores.values.allSatisfy{(0...1).contains($0)},"Invalid dominant judge value")
        }
        s.framing="span";s.displacement=1;p.dominant=s
        let nudged=try DominantShapeSystem.scene(p)
        let moved=nudged.elements.filter{abs($0.geometry?["nudgeY"] ?? 0)+abs($0.geometry?["nudgeX"] ?? 0)>0.001}
        try require(!moved.isEmpty,"Shape does not displace any display blocks")
        try require(moved.allSatisfy{$0.sourceAnchor != nil && $0.geometry?["anchorY"] != nil},"Displacement provenance missing")
        for id in DominantShapeSystem.recipeIDs {
            var crop=PosterShapePreset(recipe:PosterShapeLibrary.recipe(id)!,seed:817)
            var controls=DominantShapeSettings();controls.framing="corner";controls.reveal=0.015;crop.dominant=controls
            let cropped=try DominantShapeSystem.scene(crop)
            let m=try DominantShapeMeasurements.evaluate(cropped,settings:controls)
            try require(m.inkCoverage>0.0005,"Auto-reveal left a wholly absent shape: \(id)")
            try require(cropped.elements.contains{$0.geometry?["cropRevealTarget"] != nil},"Crop fitting provenance missing")
        }
        s.count=3;try require(rejected{try s.validate()},"Three logical objects accepted")
        s.count=1;s.scale = .nan;try require(rejected{try s.validate()},"Non-finite scale accepted")
        // A mask near the top of a normalized poster must occupy that same top area.
        var fixture=a
        var rectangle=backs[0]
        rectangle.bounds=UnitBox(x:0,y:0,width:1,height:0.2);rectangle.shape="rectangle";rectangle.geometry=nil;rectangle.rotation=0;rectangle.clipBounds=nil;rectangle.color="#ffffff"
        rectangle.zIndex=0;fixture.elements=[rectangle];fixture.background="#000000"
        let metrics=try LibrarySceneRenderer.render(fixture,width:240)
        let bytes=try rgba(metrics)
        let top=bytes[(12*240+120)*4],bottom=bytes[((metrics.height-12)*240+120)*4]
        try require(top>200 && bottom<50,"Raster mask canvas direction changed")
        print("PASS: dominant shape ownership, exact front/back/weave pixels, 1–2 objects, five crop framings, saved replay, displacement vectors and canvas-space masks")
    }
}
