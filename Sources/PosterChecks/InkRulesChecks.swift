import Foundation
import PosterCore

extension PosterChecks {
    static func checkInkRules()throws {
        // Igarashi-style primaries, one mono, beige paper.
        let paper="#efe6d2",black="#151515",lemon="#f4d21f",ultramarine="#2340a8",vermilion="#e2452b",green="#1f8a4c",gray="#8a867e"
        let inks=[paper,lemon,ultramarine,vermilion,green,gray,black]
        try require(InkRules.closest("#7f4dc4",in:inks)==ultramarine,"closest did not snap violet to ultramarine")
        try require(InkRules.closest("#7f4dc4",in:inks,excluding:[ultramarine]) != ultramarine,"closest ignored excluding")
        try require(InkRules.closest(lemon,in:inks,minDistance:0.001) != lemon,"closest ignored minDistance")
        try require(InkRules.closest(lemon,in:inks,readableOn:[paper],ratio:4.5).map{InkRules.ratio($0,paper)>=4.5}==true,"closest returned an unreadable ink")
        try require(InkRules.bestContrastWith([paper],in:inks)==black,"bestContrastWith on paper is not black")
        try require(InkRules.bestContrastWith([paper,lemon],in:inks)==black && InkRules.bestContrastWith([black],in:inks)==paper,"bestContrastWith over several surfaces failed")
        try require(InkRules.bestContrastWith([lemon],in:[paper,lemon],atLeast:4.5)==nil,"bestContrastWith ignored atLeast")
        let caption=InkRules.minContrastWith([paper],in:inks,minContrast:4.5)!
        try require(InkRules.ratio(caption,paper)>=4.5 && caption != black,"minContrastWith did not pick the quietest readable ink: \(caption)")
        let hairline=InkRules.minContrastWith([paper],in:inks,minContrast:1.2)!
        try require(InkRules.ratio(hairline,paper)>=1.2 && InkRules.ratio(hairline,paper)<InkRules.ratio(caption,paper),"hairline is not fainter than caption")
        try require(InkRules.mostVivid(in:inks,lightness:0.4...0.8) != nil && InkRules.leastVivid(in:inks,lightness:0.3...0.8)==gray,"vivid ends wrong")
        try require(InkRules.mostVivid(in:inks,lightness:0.4...0.8,excluding:[vermilion,ultramarine,lemon,green]) != vermilion,"mostVivid ignored excluding")
        try require(InkRules.lightest(in:inks)==paper && InkRules.darkest(in:inks)==black,"lightest/darkest wrong")
        try require(InkRules.lightest(in:inks,readableOn:[paper],ratio:4.5).map{InkRules.ratio($0,paper)>=4.5}==true,"lightest readable failed")
        try require(InkRules.furthestFrom(paper,in:inks)==black,"furthestFrom paper is not black")
        try require(InkRules.furthestFrom(paper,in:inks,maxDistance:0.3).map{InkRules.distance($0,paper)<=0.3}==true,"furthestFrom ignored maxDistance")
        let ramp=["#f5f5f5","#d0d0d0","#a0a0a0","#707070","#404040"]
        try require(InkRules.nth(ramp,0)==ramp[0] && InkRules.nth(ramp,-1)==ramp[4] && InkRules.nth(ramp,0.5)==ramp[2] && InkRules.nth(ramp,1)==ramp[1] && InkRules.nth(ramp,9)==nil,"nth wrong")
        try require(InkRules.sibling(ramp[1],in:ramp,steps:1)==ramp[2] && InkRules.sibling(ramp[4],in:ramp,steps:1)==ramp[4] && InkRules.sibling(ramp[4],in:ramp,steps:1,wrap:true)==ramp[0],"sibling wrong")
        try require(InkRules.sibling(ramp[2],in:ramp,steps:1,toward:ramp[0])==ramp[1],"sibling toward wrong")

        // Overlap repaint: type crossing a similar shape takes the nearest palette ink that reads there (3:1), not off-palette black.
        // Paper (lemon) reads on neither block, so the rule must choose among the poster's own inks.
        func repaint(on blockColor:String)throws->String? {
            var scene=try PosterShapeLibrary.scene(PosterShapePreset(recipe:PosterShapeLibrary.recipe("survey-sliced-orb")!,seed:817),pairing:true)
            scene.aspect=1;scene.background=lemon;scene.font="HelveticaNeue-Bold"
            var block=scene.elements[0];block.sourceElementID="art:block";block.kind="shape";block.shape="rectangle";block.geometry=nil;block.clipBounds=nil;block.inks=nil
            block.bounds=UnitBox(x:0,y:0,width:0.5,height:1);block.color=blockColor;block.zIndex=0
            var text=scene.elements[1];text.sourceElementID="title:zen";text.text="ZEN";text.bounds=UnitBox(x:0.1,y:0.4,width:0.8,height:0.2);text.color=vermilion;text.zIndex=100
            text.fontName="HelveticaNeue-Bold";text.fontProfileID=nil;text.fontAssetID=nil;text.fontAssetSHA256=nil;text.fontVariations=nil
            var note=text;note.sourceElementID="info:date";note.text="1985";note.bounds=UnitBox(x:0.6,y:0.85,width:0.3,height:0.06);note.color=ultramarine
            var mono=note;mono.sourceElementID="info:venue";mono.text="KYOTO";mono.bounds=UnitBox(x:0.6,y:0.75,width:0.3,height:0.06);mono.color=black
            scene.elements=[block,text,note,mono];scene.typePlacement=nil;scene.typeAnchors=nil
            try require(InkRules.worstRatio(lemon,on:[blockColor])<3,"fixture: paper should not read on the block \(blockColor)")
            try ShapeTypePlacement.declareContrast(&scene,settings:TypePlacementSettings(mode:"free",contrast:"auto"))
            return scene.elements[1].overlapContrast?.ink
        }
        // Apricot block: ultramarine and the mono both read; ultramarine is nearer to the vermilion type.
        let apricot="#f08a4b"
        try require(InkRules.ratio(ultramarine,apricot)>=3,"fixture: ultramarine should read on the apricot block")
        let onApricot=try repaint(on:apricot)
        try require(onApricot != nil,"type over a similar shape got no overlap ink")
        try require(onApricot==ultramarine,"overlap ink was not the nearest readable palette ink: \(onApricot ?? "nil")")
        // Vermilion block: ultramarine reaches only 2.4:1 there, so the poster's own mono wins, still not the fixed near-black.
        let onVermilion=try repaint(on:"#e8502f")
        try require(onVermilion==black,"overlap ink left the palette: \(onVermilion ?? "nil")")
        print("PASS: ink rules (closest, furthestFrom, bestContrastWith, minContrastWith, vivid, lightest/darkest, nth, sibling) and palette-first overlap ink")
    }
}
