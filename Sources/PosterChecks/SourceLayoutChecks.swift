import Foundation
import PosterCore

extension PosterChecks {
    static func checkSourceLayout(_ record:PosterRecord)throws {
        guard let template=record.elements.first(where:{$0.kind=="text-line"}) else{throw CheckFailure("Missing source-layout fixture")}
        var a=record,b=record
        a.id="source-skeleton";b.id="cluster-donor"
        a.genome.aspect=1.414;b.genome.aspect=1.414
        let anchors=[UnitBox(x:0.04,y:0.06,width:0.82,height:0.16),UnitBox(x:0.24,y:0.32,width:0.72,height:0.19),UnitBox(x:0.04,y:0.65,width:0.87,height:0.22)]
        a.elements=anchors.enumerated().map{i,box in var e=template;e.id="observed-\(i)";e.text=["SOURCE","WORD","STACK"][i];e.bounds=box;e.rotation=0;e.reviewStatus="proposed";return e}
        b.elements=a.elements.map{e in var t=e;t.id="donor-"+e.id;t.bounds.x=0.1;t.bounds.width=0.65;return t}
        let copy=PosterCopy()
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        for seed:UInt64 in 1...24 {
            let genome=SourceLayoutDNA.make(a,b,category:"kinetic",seed:seed,copy:copy,id:"test")
            let again=SourceLayoutDNA.make(a,b,category:"kinetic",seed:seed,copy:copy,id:"test")
            let bytes=try encoder.encode(genome),repeatBytes=try encoder.encode(again)
            try require(bytes==repeatBytes,"Source inheritance is not seed-repeatable")
            let linked=genome.elements.filter{$0.sourcePosterID==a.id}
            try require(linked.count>=2 && linked.allSatisfy{e in anchors.contains(e.sourceAnchor!)},"Actual source anchors were replaced with category coordinates")
            try require(genome.layoutInheritance?.skeletonPosterID==a.id,"Source skeleton provenance lost")
            try require(genome.composition?.grid.type=="observed-source-anchor-graph","Source graph not codified")
            try require(CompositionJudges.preflight(genome,copy:copy).isEmpty,"Source information adaptation violates copy, contrast or print constraints: \(CompositionJudges.preflight(genome,copy:copy))")
            let decoded=try JSONDecoder().decode(StyleGenome.self,from:bytes)
            try require(decoded.layoutInheritance?.informationBounds==genome.layoutInheritance?.informationBounds,"Inheritance/bleed serialization failed")
        }
        let first=SourceLayoutDNA.make(a,b,category:"swiss",seed:51,copy:copy,id:"test")
        var moved=a
        moved.elements[0].bounds.y=0.12;moved.elements[1].bounds.x=0.04
        let changed=SourceLayoutDNA.make(moved,b,category:"swiss",seed:51,copy:copy,id:"test")
        let firstPixels=try rgba(LibrarySceneRenderer.render(first,width:320)),changedPixels=try rgba(LibrarySceneRenderer.render(changed,width:320))
        try require(firstPixels != changedPixels,"Changing source composition does not change rendered placement")
        let title=first.elements.first{$0.kind=="text" && $0.sourcePosterID==a.id}!
        var halftone=first
        let index=halftone.elements.firstIndex{$0.sourceElementID==title.sourceElementID}!
        halftone.elements[index].textTreatment="vector-halftone";halftone.elements[index].geometry=["screen":4,"phase":0.3]
        let screened=try rgba(LibrarySceneRenderer.render(halftone,width:320))
        try require(screened != firstPixels,"Vector glyph screening does not affect pixels")
        var mirrored=first
        mirrored.elements[index].typeTransform=["scaleX":-1]
        let flipped=try rgba(LibrarySceneRenderer.render(mirrored,width:320))
        try require(flipped != firstPixels,"Declared glyph mirroring does not affect pixels")
        for (i,brief) in ContentBriefLibrary.briefs.enumerated() {
            let copy=brief.posterCopy
            let scene=SourceLayoutDNA.make(a,b,category:StyleCatalog.categories[i%StyleCatalog.categories.count].id,seed:UInt64(900+i),copy:copy,id:"content-test")
            try require(CompositionJudges.preflight(scene,copy:copy).isEmpty,"Real content failed source typesetting: \(brief.id) / \(CompositionJudges.preflight(scene,copy:copy))")
            try require(scene.contentBrief?.id==brief.id && scene.posterCopy==copy,"Real-event copy/provenance is not frozen in the genome")
            let hero=scene.elements.filter{$0.sourceAnchor != nil}.max{$0.bounds.area<$1.bounds.area}
            try require(scene.elements.contains{$0.text==brief.displayPhrases.first},"The named headline is absent from display typography")
            _ = hero
            _ = try LibrarySceneRenderer.render(scene,width:320)
            let encoded=try JSONEncoder().encode(scene),decoded=try JSONDecoder().decode(StyleGenome.self,from:encoded)
            try require(decoded.contentBrief==brief && decoded.posterCopy==copy,"Saved scene changed real-event sources or dates")
        }
        if let system=TypeSystemLibrary.shared.systems.first(where:{$0.operation=="grapheme-migration"}) {
            let preview=try TypeSystemEngine.scene(system,input:"horizons")
            let variant=TypeSystemVariant(system:system,input:"horizons",overrides:["movingIndex":1,"maxRows":4,"tracking":2],fontProfileID:nil,foreground:"#191c22",accent:"#3d52b6",background:"#f0eee7",scene:preview)
            let brief=ContentBriefLibrary.briefs.first!
            let transplanted=SourceLayoutDNA.make(a,b,category:"swiss",seed:22,copy:brief.posterCopy,id:"transplant",typeSystem:variant)
            let application=transplanted.appliedTypeSystems?.first
            try require(application?.genomeID==system.id && application?.parameters["tracking"]==2,"Selected type-system controls were not reused in another poster")
            try require(application?.input != variant.input && application?.field.valid==true,"Transplant did not adapt the new brief and source field")
            try require(CompositionJudges.preflight(transplanted,copy:brief.posterCopy).isEmpty,"Type-system transplant lost full brief copy")
            _ = try LibrarySceneRenderer.render(transplanted,width:320)
        }
        print("PASS: all real briefs render with full alphanumeric copy, actual headline phrases and frozen event provenance")
        print("PASS: actual source anchors and moved-source pixels, repeatable inheritance, full copy, declared glyph mirroring/screening (24 seeds)")
    }
}
