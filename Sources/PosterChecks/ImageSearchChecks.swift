import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkImageSearch()throws {
        func verify(_ value:Bool,_ message:String)throws{if !value{throw CheckFailure(message)}}
        let defaults=ImageInfluenceSettings()
        try verify(!defaults.useGeneratedTypeJudging && !defaults.useDiverseFinalists && !defaults.useCompositionDirections,"Optional experiments are enabled by default")
        let root=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"poster-search-check-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:root)}
        guard let system=TypeSystemLibrary.shared.systems.first(where:{$0.operation=="repeat-field"}) else{throw PosterError.render}
        let bank=try TypeSystemEngine.scene(system,input:"BANK",overrides:["count":1])
        let photo=root.appending(path:"lettering-in-photo.png");try PosterRenderer.png(LibrarySceneRenderer.render(bank,width:400),to:photo)
        let profile=try ImageInfluenceAnalyzer.analyze(photo,assets:root.appending(path:"assets"))
        let base=try TypeSystemEngine.scene(system,input:"OPEN FORMS",overrides:["count":2])
        let copy=PosterCopy(title:"OPEN FORMS",subtitle:"Print and sound",institution:"Museum für Gestaltung Zürich",footer:"Concept programme · 2027")
        let settings=ImageInfluenceSettings()
        var scenes:[StyleGenome]=[]
        for direction in ImageCompositionDirection.allCases {
            let scene=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:44,copy:copy,donorIDs:[],direction:direction)
            scenes.append(scene)
            try verify(scene.imageInfluence?.hypothesis==direction.rawValue,"Direction was not codified")
        }
        try verify(scenes[0].elements.first{$0.kind=="image"}!.bounds != scenes[1].elements.first{$0.kind=="image"}!.bounds,"Image-led and type-led fields are identical")
        for kind in ["offset","zoom"] {
            let controls=try ImageCompositionSearch.matched(base,profile:profile,settings:settings,direction:.interaction,seed:44,copy:copy,donorIDs:[],shapePreset:nil,third:kind)
            try verify(controls.count==3,"Missing matched variants")
            let fixed=try controls.map{try ImageCompositionSearch.invariantDigest($0.1)}
            try verify(Set(fixed).count==1,"Matched experiment changes fixed typography, image, crop or colors")
            try verify(!controls[0].1.elements.contains{PosterShapeLibrary.recipeID($0) != nil},"No-shape control contains decoration")
            let a=controls[1].1.elements.first{PosterShapeLibrary.recipeID($0) != nil}!,b=controls[2].1.elements.first{PosterShapeLibrary.recipeID($0) != nil}!
            if kind=="offset"{try verify(a.bounds.width==b.bounds.width && a.bounds.height==b.bounds.height && a.bounds.x != b.bounds.x,"Offset control changes size or does not move")}
            else{try verify(b.bounds.width>a.bounds.width,"Zoom control does not enlarge the shape")}
        }
        let assessment=try GeneratedTypographyJudge.evaluate(scenes[0])
        try verify(!assessment.lines.contains{$0.text.uppercased().contains("BANK")},"Photograph lettering earns generated-typography credit")
        try verify(GeneratedTypographyJudge.typeScene(scenes[0]).elements.allSatisfy{$0.kind=="text"},"Type-only OCR layer includes photo or graphics")
        var articleBase=base
        for i in articleBase.elements.indices {articleBase.elements[i].sourceAnchor=articleBase.elements[i].bounds;articleBase.elements[i].typeSystemID=nil;articleBase.elements[i].text="THE"}
        let article=ImageCompositionSearch.allocate(articleBase,copy:copy,direction:.typeLed,seed:2)
        try verify(article.elements.contains{$0.text=="THE"},"Artistic article emphasis was removed")
        var candidates:[ImagePosterCandidate]=[],results:[Candidate]=[]
        let neutral=Measurements(coverage:0,detail:0,balance:0,contrast:0,readability:0,reference:0,hierarchy:0,repetition:0,recognizedWords:0)
        for i in 0..<6 {
            let d=ImageCompositionDirection.allCases[i/2],id="fixture-\(i)"
            var c=ImagePosterCandidate(id:id,seed:UInt64(i),parentID:nil,donorIDs:[],genome:scenes[i/2],sourceGenome:base,imageURL:photo);c.hypothesis=d.rawValue;candidates.append(c)
            var rank=Candidate(id:id,genome:.random(seed:UInt64(i)),generation:0,imageURL:photo,measurements:neutral,scores:["Test":1-Double(i)/10]);rank.rank=i+1;results.append(rank)
        }
        let finalists=ImageCompositionSearch.finalists(candidates,ranking:results)
        try verify(finalists.count==3 && Set(finalists.compactMap{id in candidates.first{$0.id==id}?.hypothesis}).count==3,"Finalists collapse into one composition direction")
        let controls=try ImageCompositionSearch.matched(base,profile:profile,settings:settings,direction:.imageLed,seed:45,copy:copy,donorIDs:[],shapePreset:nil,third:"zoom")
        var matched:[ImagePosterCandidate]=[],ballots:[Candidate]=[]
        for (i,pair) in controls.enumerated(){let id="control-\(i)";var c=ImagePosterCandidate(id:id,seed:45,parentID:nil,donorIDs:[],genome:pair.1,sourceGenome:base,imageURL:photo);c.matchedGroup="group";c.control=pair.0;matched.append(c);ballots.append(.init(id:id,genome:.random(seed:UInt64(i)),generation:0,imageURL:photo,measurements:neutral,scores:["Shape lover":Double(i)/2,"Quiet lover":1-Double(i)/2,"Flat":0.5]))}
        let learned=ImageShapeJury.updateMatched(ImageShapeJury.initial(weights:["Shape lover":1,"Quiet lover":1,"Flat":1]),candidates:matched,results:ballots)
        try verify(learned.first{$0.judge=="Shape lover"}!.probability>0.25 && learned.first{$0.judge=="Quiet lover"}!.probability<0.25,"Matched evidence does not steer jurors independently")
        try verify(learned.first{$0.judge=="Flat"}!.evidenceRounds==0,"Flat matched comparisons add preference evidence")
        print("PASS: independent composition directions, fixed-layout shape/offset/zoom controls, photo-lettering exclusion, artistic THE emphasis, diverse finalists and matched juror updates")
    }
}
