import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkTypePlacement()throws {
        try require(rejected{try TypePlacementSettings(mode:"scattered").validate()} && rejected{try TypePlacementSettings(contrast:"loud").validate()},"Unknown placement modes are accepted")
        func placedText(_ scene:StyleGenome)->[SceneElement]{scene.elements.filter{$0.kind=="text" && $0.typeAnchorID != nil}}
        for id in TypePlacementProof.recipeIDs {
            let recipe=PosterShapeLibrary.recipe(id)!
            var preset=PosterShapePreset(recipe:recipe,seed:817);preset.placement=TypePlacementSettings()
            let scene=try PosterShapeLibrary.scene(preset,pairing:true)
            let anchors=scene.typeAnchors ?? []
            try require(anchors.filter{$0.source==id}.count>=2,"\(id) exposes fewer than two system anchors")
            for a in anchors {
                let f=a.footprint(aspect:scene.aspect)
                try require(f.x >= -0.001 && f.y >= -0.001 && f.x+f.width<=1.001 && f.y+f.height<=1.001 && a.length>0 && a.thickness>0,"\(id) anchor \(a.id) leaves the paper")
            }
            let placed=placedText(scene)
            try require(!placed.isEmpty,"\(id): anchored mode placed no type")
            try require(placed.allSatisfy{p in anchors.contains{$0.id==p.typeAnchorID}},"\(id): type names an anchor that was not saved")
            for (i,a) in placed.enumerated() {for b in placed.dropFirst(i+1) {
                let x=a.bounds.rect.intersection(b.bounds.rect)
                try require(x.isNull || x.width*x.height<0.02*min(a.bounds.area,b.bounds.area),"\(id): anchored type blocks overlap")
            }}
            let first=try rgba(LibrarySceneRenderer.render(scene,width:320))
            let replay=try JSONDecoder().decode(StyleGenome.self,from:JSONEncoder().encode(scene))
            let replayed=try rgba(LibrarySceneRenderer.render(replay,width:320))
            try require(replayed==first,"\(id): placed scene replay changed")
            preset.placement=TypePlacementSettings(mode:"free",contrast:"off")
            let free=try PosterShapeLibrary.scene(preset,pairing:true)
            preset.placement=nil
            let legacy=try PosterShapeLibrary.scene(preset,pairing:true)
            try require(free.elements.map(\.bounds)==legacy.elements.map(\.bounds) && placedText(free).isEmpty,"\(id): free placement moved type")
            let freeBytes=try rgba(LibrarySceneRenderer.render(free,width:320)),legacyBytes=try rgba(LibrarySceneRenderer.render(legacy,width:320))
            try require(freeBytes==legacyBytes,"\(id): free placement without contrast changed the render")
        }

        // A same-colored text crossing a shape edge: invisible on the shape without contrast, cut out of it with contrast.
        let fixture=try PosterShapeLibrary.scene(PosterShapePreset(recipe:PosterShapeLibrary.recipe("survey-sliced-orb")!,seed:817),pairing:true)
        func scene(_ contrast:String,shapeAbove:Bool=false)throws->StyleGenome {
            var s=fixture;s.aspect=1;s.background="#f2eee4";s.font="HelveticaNeue-Bold"
            var block=s.elements[0];block.sourceElementID="art:block";block.kind="shape";block.shape="rectangle";block.geometry=nil;block.clipBounds=nil;block.inks=nil
            block.bounds=UnitBox(x:0,y:0,width:0.5,height:1);block.color="#c8412b";block.zIndex=shapeAbove ? 200:0
            var word=s.elements[1];word.sourceElementID="title:check";word.text="CONTRAST";word.bounds=UnitBox(x:0.1,y:0.4,width:0.8,height:0.2);word.color="#c8412b";word.zIndex=100
            word.fontName="HelveticaNeue-Bold";word.fontProfileID=nil;word.fontAssetID=nil;word.fontAssetSHA256=nil;word.fontVariations=nil
            s.elements=[block,word];s.typePlacement=nil;s.typeAnchors=nil
            try ShapeTypePlacement.declareContrast(&s,settings:TypePlacementSettings(mode:"free",contrast:contrast));return s
        }
        func pixels(_ s:StyleGenome)throws->[UInt8]{try rgba(LibrarySceneRenderer.render(s,width:400))}
        func visibleOnBlock(_ bytes:[UInt8])->Int {
            var count=0
            for y in 160..<240{for x in 40..<196 {let i=(y*400+x)*4;if abs(Int(bytes[i])-0xc8)+abs(Int(bytes[i+1])-0x41)+abs(Int(bytes[i+2])-0x2b)>60{count+=1}}}
            return count
        }
        let off=try pixels(scene("off")),auto=try pixels(scene("auto"))
        try require(visibleOnBlock(off)<20,"Contrast fixture: type should vanish on a same-colored shape without contrast")
        try require(visibleOnBlock(auto)>800,"Overlap contrast did not reveal type on its shape")
        var outside=0;for y in 0..<400{for x in 204..<400{let i=(y*400+x)*4;if off[i] != auto[i] || off[i+1] != auto[i+1]{outside+=1}}}
        try require(outside==0,"Overlap contrast changed type away from the shape")
        let declared=try scene("auto").elements[1].overlapContrast
        try require(declared?.ink=="#f2eee4" && declared?.shapeIDs==["art:block"] && declared?.layer=="inline","Contrast should prefer the paper color as a knockout ink")
        let covered=visibleOnBlock(try pixels(scene("auto",shapeAbove:true))),interlocked=visibleOnBlock(try pixels(scene("interlock",shapeAbove:true)))
        try require(covered<20,"Auto contrast must respect a shape drawn above the type")
        try require(interlocked>800,"Interlock contrast did not cut type through a shape above it")
        let pdf=FileManager.default.temporaryDirectory.appending(path:"poster-contrast-check.pdf")
        try LibrarySceneRenderer.pdf(scene("interlock",shapeAbove:true),to:pdf)
        try require(((try? Data(contentsOf:pdf).count) ?? 0)>1000,"Contrast PDF export failed")

        // Whole-poster weave: type is placed first, then the weave windows follow it.
        var whole=PosterShapePreset(recipe:PosterShapeLibrary.recipe("survey-sliced-orb")!,seed:261108);whole.dominant=DominantShapeSettings();whole.placement=TypePlacementSettings(mode:"mixed",contrast:"interlock")
        let poster=try DominantShapeSystem.scene(whole)
        try require(!(poster.typeAnchors ?? []).isEmpty && !placedText(poster).isEmpty,"Whole-poster system ignored type placement")
        try require(poster.composition?.constraints.contains{$0.type=="shape-type-anchors"}==true,"Composition plan does not record type anchors")
        print("PASS: type anchors for 6 systems, anchored/free/legacy replay, overlap contrast inline/interlock/PDF, whole-poster placement")
    }
}
