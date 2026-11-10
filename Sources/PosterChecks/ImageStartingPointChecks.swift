import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkImageStartingPoint()throws {
        func verify(_ value:Bool,_ message:String)throws{if !value{throw CheckFailure(message)}}
        let root=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"poster-image-check-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
        defer{try? FileManager.default.removeItem(at:root)}
        guard let ctx=CGContext(data:nil,width:128,height:192,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw PosterError.render}
        ctx.setFillColor(CGColor(red:0.85,green:0.06,blue:0.08,alpha:1));ctx.fill(CGRect(x:0,y:96,width:128,height:96))
        ctx.setFillColor(CGColor(red:0.03,green:0.12,blue:0.72,alpha:1));ctx.fill(CGRect(x:0,y:0,width:128,height:96))
        let source=root.appending(path:"two-color.png");try PosterRenderer.png(ctx.makeImage()!,to:source)
        let profile=try ImageInfluenceAnalyzer.analyze(source,assets:root.appending(path:"assets"))
        try verify(profile.width==128 && profile.height==192,"Image aspect or normalized dimensions changed")
        let top=profile.cells.filter{$0.bounds.y<0.3}.map(\.luminance).reduce(0,+),bottom=profile.cells.filter{$0.bounds.y>0.7}.map(\.luminance).reduce(0,+)
        try verify(top>bottom,"Spatial map is vertically inverted")
        let loaded=try SceneRasterLoader.load(profile.asset)
        try verify(loaded.width==128 && loaded.height==192,"Saved asset was unexpectedly cropped")
        guard let system=TypeSystemLibrary.shared.systems.first(where:{$0.operation=="repeat-field"}) else{throw PosterError.invalid("Missing fixture type system")}
        let base=try TypeSystemEngine.scene(system,input:"OPEN FORMS"),copy=PosterCopy(title:"OPEN FORMS",subtitle:"Print and sound",institution:"Museum für Gestaltung Zürich",footer:"Concept programme · 18–21 June 2027")
        var settings=ImageInfluenceSettings();settings.placement="full-bleed";settings.shapes=0
        let a=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        let b=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:102,copy:copy,donorIDs:[])
        let again=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        let pixels=try rgba(LibrarySceneRenderer.render(a,width:300,seed:101))
        try verify(pixels == rgba(LibrarySceneRenderer.render(again,width:300,seed:101)),"Image-based A/B/A replay differs on this machine")
        try verify(pixels != rgba(LibrarySceneRenderer.render(b,width:300,seed:102)),"Image seeds do not vary the composition")
        var tiny=a
        for i in tiny.elements.indices where tiny.elements[i].kind=="text" && !tiny.elements[i].sourceElementID.hasPrefix("meta:") {
            tiny.elements[i].bounds.width *= 0.1;tiny.elements[i].bounds.height *= 0.1
            if let em=tiny.elements[i].typeEmSize{tiny.elements[i].typeEmSize=em*0.1}
        }
        try verify((ImagePosterComposer.scores(a)["Display presence"] ?? 0) > (ImagePosterComposer.scores(tiny)["Display presence"] ?? 1),"Image jury rewards shrinking display type into insignificance")
        var rasterOnly=a;rasterOnly.elements=a.elements.filter{$0.kind=="image"}
        let raster=try LibrarySceneRenderer.render(rasterOnly,width:256)
        let expected=try LibraryRaster.oriented(source,maxSize:256)
        func channels(_ image:CGImage,_ box:UnitBox)throws->[Double]{let bytes=try rgba(LibraryRaster.crop(image,box));let n=Double(bytes.count/4);return (0..<3).map{channel in stride(from:channel,to:bytes.count,by:4).reduce(0.0){$0+Double(bytes[$1])}/n}}
        let first=try channels(raster,.init(x:0.1,y:0.1,width:0.3,height:0.2)),original=try channels(expected,.init(x:0.1,y:0.1,width:0.3,height:0.2))
        try verify(zip(first,original).allSatisfy{abs($0-$1)<3},"Image renderer flips or changes the source pixels")
        settings.palette=0;let noPalette=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        settings.palette=1;let fullPalette=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        try verify(try rgba(LibrarySceneRenderer.render(noPalette,width:300)) != rgba(LibrarySceneRenderer.render(fullPalette,width:300)),"Palette influence has no pixel effect")
        settings.layout=0;let noLayout=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        settings.layout=1;let fullLayout=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        try verify(noLayout.elements.filter{$0.kind=="text"}.map(\.bounds) != fullLayout.elements.filter{$0.kind=="text"}.map(\.bounds),"Layout influence is inactive")
        settings.shapes=1;settings.shapeFrequency=1;let withShapes=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        try verify(withShapes.elements.contains{PosterShapeLibrary.recipeID($0) != nil} && !a.elements.contains{PosterShapeLibrary.recipeID($0) != nil},"Shape influence endpoints are inactive")
        try verify(withShapes.elements.filter{PosterShapeLibrary.recipeID($0) != nil}.allSatisfy{$0.bounds.width>=0.48},"Image-response shapes are still tiny")
        settings.shapeFrequency=0
        let noAddedShapes=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:101,copy:copy,donorIDs:[])
        try verify(!noAddedShapes.elements.contains{PosterShapeLibrary.recipeID($0) != nil},"Optional shapes cannot be disabled independently")
        var quietProfile=profile,busyProfile=profile
        quietProfile.attention=[];busyProfile.attention=[]
        quietProfile.cells=profile.cells.map{var c=$0;c.edge=0;return c}
        busyProfile.cells=profile.cells.map{var c=$0;c.edge=1;return c}
        let quietScene=try ImagePosterComposer.compose(base,profile:quietProfile,settings:settings,seed:101,copy:copy,donorIDs:[])
        let busyScene=try ImagePosterComposer.compose(base,profile:busyProfile,settings:settings,seed:101,copy:copy,donorIDs:[])
        let quietSize=quietScene.elements.filter{$0.sourceElementID.hasPrefix("meta:image-info:")}.map(\.bounds.height).max() ?? 0
        let busySize=busyScene.elements.filter{$0.sourceElementID.hasPrefix("meta:image-info:")}.map(\.bounds.height).max() ?? 0
        try verify(quietSize>busySize && quietSize>=0.025,"Calm space does not allow larger information type")
        let stylePriors=ImageShapeJury.initial(weights:["Minimal":1,"Abstract":1])
        try verify(stylePriors.first{$0.judge=="Minimal"}!.probability < stylePriors.first{$0.judge=="Abstract"}!.probability,"Juror proposal priors are identical")
        let quietMix=ImageShapeJury.mixture(stylePriors,weights:["Minimal":4,"Abstract":0.1]),shapeMix=ImageShapeJury.mixture(stylePriors,weights:["Minimal":0.1,"Abstract":4])
        try verify(quietMix.probability<shapeMix.probability,"Jury weights do not steer shape frequency")
        var juryCandidates:[ImagePosterCandidate]=[],juryResults:[Candidate]=[]
        let neutral=Measurements(coverage:0,detail:0,balance:0,contrast:0,readability:0,reference:0,hierarchy:0,repetition:0,recognizedWords:0)
        for i in 0..<6 {
            let hasShape=i<3,id="jury-\(i)",genome=hasShape ? withShapes:noAddedShapes
            juryCandidates.append(.init(id:id,seed:UInt64(i),parentID:nil,donorIDs:[],genome:genome,sourceGenome:base,imageURL:source))
            juryResults.append(Candidate(id:id,genome:.random(seed:UInt64(i)),generation:0,imageURL:source,measurements:neutral,scores:["Shape lover":hasShape ? 1:0.1,"Quiet lover":hasShape ? 0.1:1,"Flat":0.5]))
        }
        let juryPrior=ImageShapeJury.initial(weights:["Shape lover":1,"Quiet lover":1,"Flat":1])
        let juryLearned=ImageShapeJury.update(juryPrior,candidates:juryCandidates,results:juryResults)
        try verify(juryLearned.first{$0.judge=="Shape lover"}!.probability>0.25 && juryLearned.first{$0.judge=="Quiet lover"}!.probability<0.25,"Jurors do not adapt independently to their own actual scores")
        try verify(juryLearned.first{$0.judge=="Flat"}!.evidenceRounds==0,"Flat ballots fabricate a shape preference")
        for placement in ["full-bleed","framed","split"] {
            settings.placement=placement
            let genome=try ImagePosterComposer.compose(base,profile:profile,settings:settings,seed:99,copy:copy,donorIDs:[])
            try verify(genome.imageInfluence?.placement==placement,"Image placement selection ignored")
            try verify(genome.elements.allSatisfy{[$0.bounds.x,$0.bounds.y,$0.bounds.width,$0.bounds.height].allSatisfy(\.isFinite) && $0.bounds.width>0 && $0.bounds.height>0},"Image composition has invalid geometry")
            let json=try JSONEncoder().encode(genome),replay=try JSONDecoder().decode(StyleGenome.self,from:json)
            try verify(try rgba(LibrarySceneRenderer.render(genome,width:300))==rgba(LibrarySceneRenderer.render(replay,width:300)),"Image genome JSON replay differs")
        }
        try LibrarySceneRenderer.pdf(a,to:root.appending(path:"poster.pdf"))
        try verify((try Data(contentsOf:root.appending(path:"poster.pdf"))).count>1000,"Image PDF is empty")
        let p=ImagePosterComposer.sourcePoint(0.5,0.5,frame:.init(x:0.2,y:0.1,width:0.6,height:0.8),crop:.init(x:0.1,y:0.2,width:0.8,height:0.5))
        try verify(abs((p?.x ?? 0)-0.5)<0.0001 && abs((p?.y ?? 0)-0.45)<0.0001,"Crop coordinates are inconsistent")
        try Data("changed".utf8).write(to:profile.asset.url)
        try verify(rejected{_ = try SceneRasterLoader.load(profile.asset)},"Changed image asset silently replays")
        settings.palette = .nan
        try verify(rejected{try settings.validate()},"Unsafe influence value accepted")
        print("PASS: upright checksum-bound image assets, spatial coordinates, crop mapping, image-genome replay, live palette/layout/shape controls, three placements, embedded-image PDF, calm-space type sizes, optional large shapes and independent per-juror proposal learning")
    }
}
