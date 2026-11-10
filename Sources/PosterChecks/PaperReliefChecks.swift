import Foundation
import CoreGraphics
import PosterCore
extension PosterChecks {
    static func checkPaperRelief()throws {
        let r=PosterShapeLibrary.recipe(PaperReliefSystems.recipeID)!
        var p=PosterShapePreset(recipe:r,seed:817)
        var scene=try PosterShapeLibrary.scene(p)
        try PaperReliefSystems.validate(scene)
        let parent=scene.elements.first{$0.paperRelief != nil}!,paper=parent.paperRelief!
        try require(Set(paper.surfaces.map(\.kind))==Set(["panel","flap","recess","hole","disc"]),"Relief source missing a construction type")
        try require(scene.elements.filter{$0.paperAttachment != nil}.count>25,"Surface labels missing")
        var wide=parent;wide.bounds=UnitBox(x:0.1,y:0.3,width:0.8,height:0.2)
        try require(paper.aspect==10.0/7.0,"Intrinsic paper aspect missing from the saved surface genome")
        let fit=PaperReliefGeometry.fittedFrame(parent:wide,aspect:1.4)
        try require(abs(fit.height/fit.width-10.0/7.0)<1e-10 && fit.width<0.8 && fit.height<=0.28+1e-10,"Image field squashed the paper assembly")
        wide.paperRelief?.aspect=nil;let legacy=PaperReliefGeometry.fittedFrame(parent:wide,aspect:1.4)
        try require(abs(legacy.width-0.8)<1e-10,"Legacy paper genome field fit changed")
        let flap=paper.surfaces.first{$0.kind=="flap" && $0.hinge==4}!
        var flat=parent,folded=parent;flat.geometry?["foldAngle"]=0;folded.geometry?["foldAngle"]=60
        let a=PaperReliefGeometry.projectedCorners(flap,parent:flat,aspect:1.4),b=PaperReliefGeometry.projectedCorners(flap,parent:folded,aspect:1.4)
        try require(hypot(a[0].x-b[0].x,a[0].y-b[0].y)<1e-8 && hypot(a[2].x-b[2].x,a[2].y-b[2].y)<1e-8 && hypot(a[3].x-b[3].x,a[3].y-b[3].y)>10,"Flap did not rotate about its declared hinge")
        let hole=paper.surfaces.first{$0.kind=="hole"}!,path=PaperReliefGeometry.surfacePath(hole,parent:parent,aspect:1.4),corners=PaperReliefGeometry.projectedCorners(hole,parent:parent,aspect:1.4)
        let center=CGPoint(x:(corners[0].x+corners[2].x)/2,y:(corners[0].y+corners[2].y)/2)
        try require(!path.contains(center,using:.evenOdd),"Cut-through opening is painted as a solid panel")
        func pixels(_ s:StyleGenome,_ stage:ConstructionStage = .finished)throws->Data{Data(try rgba(LibrarySceneRenderer.render(s,width:320,stage:stage)))}
        let first=try pixels(scene),saved=try JSONDecoder().decode(StyleGenome.self,from:JSONEncoder().encode(scene)),again=try pixels(saved)
        try require(first==again,"Surface genome replay changed pixels")
        let labelIndex=scene.elements.firstIndex{$0.paperAttachment != nil}!
        scene.elements[labelIndex].text="EDITABLE";let edited=try pixels(scene);try require(first != edited,"Attached type is not editable")
        let block=try pixels(saved,.blockout),primary=try pixels(saved,.primary),secondary=try pixels(saved,.secondary)
        try require(block != primary && primary != secondary && secondary != first,"Relief construction stages collapsed")
        var invalid=saved;invalid.elements[labelIndex].paperAttachment?.surfaceID="missing"
        try require(rejected{_ = try pixels(invalid)},"Orphan surface text accepted")
        p.relief=PaperReliefCustomization(title:"COMMON GROUND");scene=try PosterShapeLibrary.scene(p);scene.posterCopy=PosterCopy(title:"OTHER TITLE",footer:"12–14.09.2027 · Opening 18:00");PaperReliefSystems.resolve(in:&scene)
        try require(scene.elements.filter{$0.paperAttachment?.role=="title"}.allSatisfy{$0.text=="COMMON GROUND"},"Relief title override lost")
        try require(scene.elements.contains{$0.paperAttachment?.role=="date" && ($0.text ?? "").contains("2027")},"Surface dates ignore the actual brief footer")
        p.parameters=["layout":2];let one=try pixels(PosterShapeLibrary.scene(p));p.seed=818;let two=try pixels(PosterShapeLibrary.scene(p));p.seed=817;let three=try pixels(PosterShapeLibrary.scene(p));try require(one != two && one==three,"Relief collage seed stream not repeatable")
        // Hidden lower type must remain hidden when a higher panel covers it.
        let below=PaperReliefSurface(id:"below",kind:"panel",bounds:UnitBox(x:0.15,y:0.15,width:0.7,height:0.7),level:0.2)
        let above=PaperReliefSurface(id:"above",kind:"panel",bounds:UnitBox(x:0.1,y:0.1,width:0.8,height:0.8),level:1)
        p.relief=PaperReliefCustomization(title:"HIDDEN",surfaces:[below,above]);p.parameters=["labelDensity":1];scene=try PosterShapeLibrary.scene(p)
        for i in scene.elements.indices where scene.elements[i].paperAttachment?.surfaceID=="above"{scene.elements[i].text=nil}
        let hidden=try pixels(scene)
        for i in scene.elements.indices where scene.elements[i].paperAttachment?.surfaceID=="below"{scene.elements[i].text="CHANGED LOWER TEXT"}
        let hiddenAgain=try pixels(scene);try require(hidden==hiddenAgain,"Lower text floats above the covering panel")
        print("PASS: 5 relief constructions, aspect-preserving placement, hinge invariants, real holes, attached editable text and occlusion, genome replay, four stages, title binding, seeded collage and invalid attachment rejection")
    }
}
