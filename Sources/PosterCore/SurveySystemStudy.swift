import Foundation
import ImageIO
import UniformTypeIdentifiers

public struct SurveyStudyItem:Codable,Sendable {
    public var id:String;public var recipeID:String;public var seed:UInt64;public var parentID:String?
    public var mode:String;public var donors:[String];public var parameters:[String:Double]
    public var imageURL:URL;public var genomeURL:URL;public var presetURL:URL;public var pixelSHA256:String;public var changedPixelFraction:Double
    public var placement:String?=nil
}
public struct SurveyStudyRound:Codable,Sendable {
    public var recipeID:String;public var round:Int;public var candidates:[SurveyStudyItem]
    public var judging:ExternalEvaluation;public var weights:[String:Double];public var winnerID:String
    public var note="Diagnostic shape coverage study: every recipe is exercised deliberately. This does not change global shape frequency or user taste votes. Borda ranks and learned affinities are relative preferences, not objective aesthetic grades."
}

public actor SurveySystemStudy {
    public init(){}
    private struct Draft {
        var id:String;var preset:PosterShapePreset;var base:StyleGenome;var scene:StyleGenome
        var mode:String;var donors:[String];var parentID:String?
    }
    /// `placements` cycles type placement modes across fresh candidates; nil keeps the legacy unplaced composition.
    public func run(records:[PosterRecord],imageScenes:[StyleGenome]=[],output:URL,seed:UInt64=20261108,rounds:Int=8,count:Int=6,tasteDirectory:URL?=nil,recipeIDs:[String]?=nil,placements:[String]?=TypePlacementSettings.modes,contrast:String="auto",progress:@Sendable(String)->Void={_ in})async throws {
        guard (2...10).contains(rounds),(4...12).contains(count),!FileManager.default.fileExists(atPath:output.path) else{throw PosterError.invalid("Choose a new survey output, 2–10 rounds and 4–12 candidates.")}
        if let placements{guard !placements.isEmpty else{throw PosterError.invalid("Choose at least one type placement mode.")};for mode in placements{try TypePlacementSettings(mode:mode,contrast:contrast).validate()}}
        let sources=records.filter{$0.reviewStatus != "rejected" && (0.6...1.8).contains($0.genome.aspect) && $0.elements.filter{$0.kind=="text-line" && $0.reviewStatus != "rejected"}.count>=3}.sorted{$0.id<$1.id}
        guard sources.count>=30 else{throw PosterError.invalid("Need at least 30 source compositions for this survey.")}
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        let engine=try EvolutionEngine(),styleBank=try StyleJudgeBank(),taste=try TasteJudgeBank(directory:tasteDirectory)
        var summaries:[[String:String]]=[]
        let categories=["abstract","optical","color-field","swiss","expressive","minimal"]
        let studyRecipes=PosterShapeLibrary.surveyRecipes+PosterShapeLibrary.contourRecipes+PosterShapeLibrary.paperReliefRecipes
        if let recipeIDs {guard !recipeIDs.isEmpty,recipeIDs.allSatisfy({id in studyRecipes.contains{$0.id==id}})else{throw PosterError.invalid("Choose study recipe IDs from shape-library list.")}}
        for (recipeIndex,recipe) in studyRecipes.enumerated() where recipeIDs==nil || recipeIDs!.contains(recipe.id) {
            var parents:[Draft]=[],seen:Set<String>=[]
            let category=categories[recipeIndex%categories.count]
            for round in 0..<rounds {
                let folder=output.appending(path:recipe.id+"/round-\(round)")
                try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                var drafts:[Draft]=[],items:[SurveyStudyItem]=[],samples:[ExternalSample]=[],features:[String:VisualEmbedding]=[:]
                for i in 0..<count {
                    let childSeed=seed &+ UInt64(recipeIndex*1_000_000+round*1000+i*31),id="r\(round)-c\(i)"
                    var rng=SeededRandom(seed:childSeed),draft:Draft
                    if round>0,i<3,!parents.isEmpty {
                        draft=parents[min(i,parents.count-1)];draft.parentID=draft.id;draft.id=id
                        if i>0 {
                            draft.preset.seed=childSeed
                            for p in recipe.parameters {
                                let old=draft.preset.parameters[p.id] ?? p.value,radius=(p.max-p.min)*0.14
                                let value=min(p.max,max(p.min,old+rng.value(-radius,radius)))
                                draft.preset.parameters[p.id]=p.step>=1 ? value.rounded():value
                            }
                            draft.scene=try Self.place(draft.preset,in:draft.base,mode:draft.mode)
                        }
                    }else{
                        let a=sources[Int(childSeed%UInt64(sources.count))],b=sources[Int((childSeed &+ 7919)%UInt64(sources.count))]
                        let candidates=PosterShapeLibrary.suggestedFonts(recipe,limit:8)
                        let font=ContourSystems.isTextRecipe(recipe.id) && !candidates.isEmpty ? candidates[Int(childSeed%UInt64(candidates.count))].0:FontLibrary.shared.choose(category:category,seed:childSeed)
                        var preset=PosterShapePreset(recipe:recipe,seed:childSeed,fontProfileID:font?.id)
                        if let placements{preset.placement=TypePlacementSettings(mode:placements[(round*count+i)%placements.count],contrast:contrast)}
                        // Small nudges never leave a discrete mode's default, so modes are also drawn from their full range.
                        var modes=SeededRandom(seed:childSeed ^ 0x4d4f444553)
                        for p in recipe.parameters where !(round==0 && i==0) {
                            let radius=(p.max-p.min)*0.22,value=min(p.max,max(p.min,p.value+rng.value(-radius,radius)))
                            preset.parameters[p.id]=p.step>=1 ? value.rounded():value
                            if p.step>=1,p.max-p.min<=7,modes.unit()<0.3{preset.parameters[p.id]=(p.min+Double(modes.int(Int(p.max-p.min)+1))).rounded()}
                        }
                        if recipe.id==PaperReliefSystems.recipeID{preset.parameters["layout"]=Double((round+i)%3)}
                        let useImage = !imageScenes.isEmpty && (i+round)%3==2
                        let mode=useImage ? "image-interaction":(i+round)%2==0 ? "source-region":"source-dominant"
                        let base:StyleGenome
                        if useImage {base=imageScenes[Int(childSeed%UInt64(imageScenes.count))]}
                        else {base=SourceLayoutDNA.make(a,b,category:category,seed:childSeed,copy:ContentBriefLibrary.copy(seed:seed,offset:recipeIndex*3+round),id:recipe.id+"-"+id,fontProfileID:font?.id)}
                        draft=Draft(id:id,preset:preset,base:base,scene:try Self.place(preset,in:base,mode:mode),mode:mode,donors:useImage ? (base.imageInfluence?.donorIDs ?? []):[a.id,b.id],parentID:nil)
                    }
                    let image=try LibrarySceneRenderer.render(draft.scene,width:640)
                    let control=try LibrarySceneRenderer.render(Self.withoutSurveyArt(draft.scene),width:640)
                    let changed=try Self.changedShare(image,control)
                    let url=folder.appending(path:id+".jpg")
                    try Self.jpeg(image,to:url)
                    let hash=LibraryRaster.hash(try Data(contentsOf:url));seen.insert(hash)
                    let genomeURL=folder.appending(path:id+"-genome.json"),presetURL=folder.appending(path:id+"-preset.json")
                    try LibraryRaster.write(Self.lean(draft.scene),to:genomeURL);try LibraryRaster.write(draft.preset,to:presetURL)
                    items.append(SurveyStudyItem(id:id,recipeID:recipe.id,seed:draft.preset.seed,parentID:draft.parentID,mode:draft.mode,donors:draft.donors,parameters:try recipe.values(draft.preset.parameters),imageURL:url,genomeURL:genomeURL,presetURL:presetURL,pixelSHA256:hash,changedPixelFraction:changed,placement:draft.preset.placement?.mode))
                    samples.append(ExternalSample(id:id,backend:"survey-systems-v2",seed:draft.preset.seed,generation:round,imageURL:url,parameters:["repetition":0.4]))
                    features[id]=try LibraryRaster.embedding(image);drafts.append(draft)
                }
                var weights=["System presence":1.2,"Typography":0.6,"Legibility":1.0,"Hierarchy":1.0,"Type integrity":0.8,"Copy completeness":1.2,"Diversity":0.5,"Ink contrast":0.25,"Optical balance":0.5]
                if let categoryName=StyleCatalog.categories.first(where:{$0.id==category})?.name{weights[categoryName]=0.5}
                weights.merge(taste.weights){_,new in new}
                var judging=try await engine.judgeExternal(samples)
                for j in judging.results.indices {
                    let result=judging.results[j],index=items.firstIndex{$0.id==result.id}!,scene=drafts[index].scene
                    let copy=scene.posterCopy ?? PosterCopy()
                    let target=max(0.015,(recipe.traits["mass"] ?? 0.4)*0.1)
                    judging.results[j].scores["System presence"]=min(1,items[index].changedPixelFraction/target)
                    judging.results[j].scores.merge(CompositionJudges.evaluate(scene,measurements:result.measurements,copy:copy,style:category)){_,new in new}
                    judging.results[j].scores.merge(try styleBank.scores(features[result.id]!,colors:nil)){_,new in new}
                    judging.results[j].scores.merge(try taste.scores(features[result.id]!)){_,new in new}
                }
                judging.results=Voting.rank(judging.results,weights:weights)
                let winner=judging.results[0],best=drafts.first{$0.id==winner.id}!
                parents=judging.results.prefix(3).compactMap{result in drafts.first{$0.id==result.id}}
                try LibraryRaster.write(SurveyStudyRound(recipeID:recipe.id,round:round,candidates:items,judging:judging,weights:weights,winnerID:best.id),to:folder.appending(path:"round.json"))
                progress("\(recipe.id) \(round+1)/\(rounds) · \(best.mode) · \(seen.count) unique previews")
                if round==rounds-1 {
                    let winnerFolder=output.appending(path:recipe.id)
                    try PosterRenderer.png(LibrarySceneRenderer.render(best.scene,width:1600),to:winnerFolder.appending(path:"winner.png"))
                    try LibrarySceneRenderer.pdf(best.scene,to:winnerFolder.appending(path:"winner.pdf"))
                    try LibraryRaster.write(Self.lean(best.scene),to:winnerFolder.appending(path:"winner-genome.json"))
                    try LibraryRaster.write(best.preset,to:winnerFolder.appending(path:"winner-preset.json"))
                    let clean=Self.withoutSurveyArt(best.base)
                    try Self.jpeg(LibrarySceneRenderer.render(clean,width:640),to:winnerFolder.appending(path:"control.jpg"))
                    for stage in ConstructionStage.allCases {try Self.jpeg(LibrarySceneRenderer.render(best.scene,width:640,stage:stage),to:winnerFolder.appending(path:"stage-\(stage.rawValue).jpg"))}
                    summaries.append(["recipeID":recipe.id,"winnerID":best.id,"mode":best.mode,"rounds":String(rounds),"candidates":String(rounds*count),"uniquePreviews":String(seen.count),"image":winnerFolder.appending(path:"winner.png").path])
                }
            }
        }
        try LibraryRaster.write(summaries,to:output.appending(path:"manifest.json"))
    }
    private static func withoutSurveyArt(_ source:StyleGenome)->StyleGenome {
        var scene=source
        scene.elements.removeAll{PosterShapeLibrary.recipeID($0) != nil || $0.geometry?["dominantObject"] != nil}
        return scene
    }
    static func place(_ preset:PosterShapePreset,in source:StyleGenome,mode:String)throws->StyleGenome {
        let oldArt=source.elements.first{PosterShapeLibrary.recipeID($0) != nil}
        var scene=withoutSurveyArt(source)
        if let id=preset.fontProfileID,let profile=FontLibrary.shared.profile(id){FontLibrary.apply(profile,to:&scene)}
        let semantic=["survey-portal-type","survey-module-substitution","survey-scalloped-frame"].contains(preset.recipe.id) || ContourSystems.isTextRecipe(preset.recipe.id) || preset.recipe.id==PaperReliefSystems.recipeID
        if mode=="source-dominant",!semantic {
            var p=preset,s=DominantShapeSettings();s.depth=preset.seed.isMultiple(of:3) ? "weave":"behind";s.framing=preset.seed.isMultiple(of:4) ? "offset":"span";s.displacement=preset.seed.isMultiple(of:2) ? 0.22:0;p.dominant=s
            try DominantShapeSystem.apply(to:&scene,preset:p)
        }else{
            var field=oldArt?.bounds ?? UnitBox(x:0.04,y:0.18,width:0.92,height:0.68)
            if field.area<0.25 || semantic {field=UnitBox(x:0.045,y:0.19,width:0.91,height:0.65)}
            let profile=preset.fontProfileID.flatMap{FontLibrary.shared.profile($0)}
            let choice=PosterShapeLibrary.choose(seed:preset.seed,profile:profile,field:field,posterAspect:scene.aspect,category:scene.styleCategory ?? "abstract",textDensity:0.2,preset:preset)!
            let display=scene.elements.filter{$0.kind=="text" && !$0.sourceElementID.hasPrefix("meta:")}.max{$0.bounds.area<$1.bounds.area}
            var element=PosterShapeLibrary.element(choice,field:field,color:oldArt?.color ?? display?.color ?? "#141718",seed:preset.seed,background:scene.background)
            element.zIndex=semantic ? 80:0;element.fontName=profile?.postscriptName;element.fontVariations=profile?.variations;element.fontProfileID=profile?.id;element.fontAssetID=profile?.assetID;element.fontAssetSHA256=profile?.assetSHA256
            if ["survey-portal-type","survey-scalloped-frame"].contains(preset.recipe.id) || ContourSystems.isTextRecipe(preset.recipe.id) || preset.recipe.id==PaperReliefSystems.recipeID {scene.elements.removeAll{$0.kind=="text" && !$0.sourceElementID.hasPrefix("meta:") && $0.bounds.area>0.025}}
            if preset.recipe.id=="survey-module-substitution",preset.seed.isMultiple(of:3),let asset=scene.elements.first(where:{$0.kind=="image"})?.rasterAsset {element.rasterAsset=asset}
            scene.elements.append(element)
        }
        PosterShapeLibrary.resolveSurveyContent(in:&scene)
        // The whole-poster path places type inside DominantShapeSystem.apply, before its weave windows.
        if let placement=preset.placement,!(mode=="source-dominant" && !semantic){try ShapeTypePlacement.apply(to:&scene,settings:placement)}
        scene.composition=CompositionPlan.scene(scene,origin:"survey-system-generation",style:scene.styleCategory)
        scene.composition?.description=preset.recipe.logic+" Source layout: "+(source.layoutInheritance?.skeletonPosterID ?? source.posterID)+"; study mode "+mode+"."
        return scene
    }
    private static func lean(_ source:StyleGenome)->StyleGenome {var scene=source;scene.imageInfluence?.profile.cells=[];scene.imageInfluence?.profile.embedding=nil;return scene}
    private static func changedShare(_ a:CGImage,_ b:CGImage)throws->Double {
        guard a.width==b.width,a.height==b.height else{throw PosterError.render}
        func pixels(_ image:CGImage)throws->[UInt8] {
            var data=[UInt8](repeating:0,count:image.width*image.height*4)
            let ok=data.withUnsafeMutableBytes{buffer->Bool in
                guard let context=CGContext(data:buffer.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
                context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height));return true
            }
            guard ok else{throw PosterError.render};return data
        }
        let x=try pixels(a),y=try pixels(b)
        var changed=0
        for i in stride(from:0,to:x.count,by:4) {
            let delta=abs(Int(x[i])-Int(y[i]))+abs(Int(x[i+1])-Int(y[i+1]))+abs(Int(x[i+2])-Int(y[i+2]))
            if delta>6{changed+=1}
        }
        return Double(changed)/Double(a.width*a.height)
    }
    private static func jpeg(_ image:CGImage,to url:URL)throws {guard let target=CGImageDestinationCreateWithURL(url as CFURL,UTType.jpeg.identifier as CFString,1,nil)else{throw PosterError.render};CGImageDestinationAddImage(target,image,[kCGImageDestinationLossyCompressionQuality:0.94] as CFDictionary);guard CGImageDestinationFinalize(target)else{throw PosterError.render}}
}
