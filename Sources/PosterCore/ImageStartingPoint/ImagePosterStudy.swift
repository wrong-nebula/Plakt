import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

public struct ImagePosterCandidate:Codable,Identifiable,Sendable {
    public var id:String;public var seed:UInt64;public var parentID:String?
    public var donorIDs:[String];public var genome:StyleGenome;public var sourceGenome:StyleGenome
    public var imageURL:URL
    public var hypothesis:String? = nil
    public var matchedGroup:String? = nil
    public var control:String? = nil
    public var role:String? = nil
    public var visualEmbedding:VisualEmbedding? = nil
    public var generatedType:GeneratedTypeAssessment? = nil
    public init(id:String,seed:UInt64,parentID:String?,donorIDs:[String],genome:StyleGenome,sourceGenome:StyleGenome,imageURL:URL){self.id=id;self.seed=seed;self.parentID=parentID;self.donorIDs=donorIDs;self.genome=genome;self.sourceGenome=sourceGenome;self.imageURL=imageURL}
}
public struct ImagePosterRound:Codable,Sendable {
    public var number:Int;public var candidates:[ImagePosterCandidate];public var judging:ExternalEvaluation
    public var winnerID:String;public var weights:[String:Double]
    public var shapeJury:[ImageShapeJurorPreference]? = nil
    public var directionWinners:[String:String]? = nil
    public var finalistIDs:[String]? = nil
}
public struct ImagePosterStudyResult:Codable,Sendable {
    public var version="image-poster-study-v6"
    public var profile:ImageInfluenceProfile;public var settings:ImageInfluenceSettings
    public var copy:PosterCopy;public var seed:UInt64;public var rounds:[ImagePosterRound]
    public var winner:ImagePosterCandidate;public var directory:URL
    public var finalistIDs:[String]? = nil
    public var note="Optional independent composition pools, generated-type-only judging and diverse finalists; controlled shape experiments. Saved settings record which options were enabled. Relative jury scores are search proxies, not objective aesthetic quality. Source/article emphasis, pale palettes and cropping remain artistic options. Preview JPEGs save disk space; saved genomes and original assets export lossless PNG and vector/raster PDF. No trained model weights, semantic indexes or taste votes are modified."
}

public actor ImagePosterStudy {
    public init(){}
    public func analyze(_ image:URL,assets:URL)throws->ImageInfluenceProfile{try ImageInfluenceAnalyzer.analyze(image,assets:assets)}
    public func run(image:URL,library:URL?,output:URL,settings:ImageInfluenceSettings=ImageInfluenceSettings(),copy:PosterCopy,seed:UInt64=20261108,rounds:Int=10,count:Int=15,fontProfileID:String?=nil,typeSystem:TypeSystemVariant?=nil,shapePreset:PosterShapePreset?=nil,judgeWeights:[String:Double]?=nil,tasteDirectory:URL?=nil,events:@Sendable(SourceStudyEvent)->Void={_ in},progress:@Sendable(String)->Void={_ in})async throws->ImagePosterStudyResult {
        try settings.validate();_ = try copy.validated()
        guard (1...10).contains(rounds),(4...24).contains(count),(!settings.useCompositionDirections || count>=12 && count%3==0) else{throw PosterError.invalid("Use 1–10 rounds and 4–24 candidates; three-direction mode needs 12–24 in multiples of three.")}
        guard !FileManager.default.fileExists(atPath:output.path) else{throw PosterError.invalid("Choose a new image-study folder.")}
        if let fontProfileID,FontLibrary.shared.profile(fontProfileID)==nil{throw PosterError.invalid("Unknown pinned font.")}
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        progress("Measuring image palette, texture, focal regions and open space…")
        let profile=try ImageInfluenceAnalyzer.analyze(image,assets:output.appending(path:"assets"))
        let studyName="Image study"
        events(.direction(index:0,total:1,name:studyName,rounds:rounds,count:count,graphic:profile.asset.url))
        try ImageStudyStorage.write(profile,to:output.appending(path:"image-analysis.json"))
        let records=try await library.map{PosterLibraryEngine(directory:$0)}?.records().filter{$0.reviewStatus != "rejected" && $0.genome.elements.count>=3 && !$0.elements.filter{$0.kind=="text-line" && $0.reviewStatus != "rejected"}.isEmpty} ?? []
        var affinity:[String:Double]=[:]
        for record in records {
            let feature=profile.embedding.flatMap{try? $0.distance(to:record.embedding)}.map{exp(-$0)} ?? 0
            affinity[record.id]=feature*0.4+exp(-abs(log(record.genome.aspect/profile.aspect)))*0.3+exp(-abs(record.statistics.edgeDensity-profile.statistics.edgeDensity)*8)*0.3
        }
        let pool=Array(records.sorted{let a=affinity[$0.id] ?? 0,b=affinity[$1.id] ?? 0;return a==b ? $0.id<$1.id:a>b}.prefix(100))
        let judge=try EvolutionEngine(referenceURL:profile.asset.url,cropReference:false)
        let taste=try TasteJudgeBank(directory:tasteDirectory)
        var weights=judgeWeights ?? ["Typography":0.4,"Diversity":0.7,"Legibility":1,"Type integrity":0.5,"Hierarchy":1,"Copy completeness":1,"Image breathing room":1,"Image retention":1.2,"Display presence":2]
        weights["Display presence"]=weights["Display presence"] ?? 2
        weights["Image breathing room"]=weights["Image breathing room"] ?? 1;weights["Image retention"]=weights["Image retention"] ?? 1.2
        if judgeWeights==nil{weights["Reference"]=0;weights["Composition"]=0}
        weights.merge(taste.weights){old,_ in old}
        guard weights.values.allSatisfy({$0.isFinite && (0...10).contains($0)}),weights.values.contains(where:{$0>0}) else{throw PosterError.invalid("Invalid image-study judge weights.")}
        var shapeJury=ImageShapeJury.initial(weights:weights),completed:[ImagePosterRound]=[],champions:[String:ImagePosterCandidate]=[:]
        let categories=profile.statistics.edgeDensity>0.055 ? ["minimal","editorial","expressive","swiss"]:["kinetic","editorial","color-field","minimal","abstract","optical"]
        let directionKeys=settings.useCompositionDirections ? ImageCompositionDirection.allCases.map(\.rawValue):["free"]
        let perDirection=count/directionKeys.count
        func fresh(_ direction:ImageCompositionDirection?,_ itemSeed:UInt64,_ champion:ImagePosterCandidate?,_ id:String)throws->(StyleGenome,[String]) {
            var rng=SeededRandom(seed:itemSeed),base:StyleGenome,donors:[String]
            let category=categories[rng.int(categories.count)]
            if pool.count>=2 {
                let a=champion?.donorIDs.first.flatMap{id in pool.first{$0.id==id}} ?? pool[rng.int(pool.count)]
                let independent=pool.filter{$0.id != a.id && $0.source.postID != a.source.postID}
                let b=independent.isEmpty ? pool.first{$0.id != a.id}!:independent[rng.int(independent.count)]
                donors=[a.id,b.id]
                let source=SourceLayoutDNA.make(a,b,category:category,seed:itemSeed,copy:copy,id:id,fontProfileID:fontProfileID,typeSystem:typeSystem,shapePreset:nil)
                base=champion.map{SourceComposition.cross($0.sourceGenome,source,seed:itemSeed,id:id)} ?? source
            }else{
                var g=Genome.random(seed:itemSeed);g.renderStyle=category;base=SourceComposition.recipe(g,copy:copy);donors=[]
                if let fontProfileID,let font=FontLibrary.shared.profile(fontProfileID){FontLibrary.apply(font,to:&base)}
                if let typeSystem{_ = try TypeSystemLibrary.shared.transplant(typeSystem,into:&base.elements,aspect:base.aspect,profile:fontProfileID.flatMap{FontLibrary.shared.profile($0)},copy:copy)}
            }
            return (ImageCompositionSearch.allocate(base,copy:copy,direction:direction ?? (itemSeed%3==0 ? .imageLed:.typeLed),seed:itemSeed),donors)
        }
        for round in 0..<rounds {
            try Task.checkCancellation()
            let folder=output.appending(path:"round-\(round)");try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
            var candidates:[ImagePosterCandidate]=[],samples:[ExternalSample]=[],digests:Set<String>=[]
            let mixture=ImageShapeJury.mixture(shapeJury,weights:weights)
            for (directionIndex,directionKey) in directionKeys.enumerated() {
                let direction=ImageCompositionDirection(rawValue:directionKey)
                let directionLabel=direction?.label ?? "Free evolution"
                let champion=champions[directionKey]
                var proposal=settings
                if settings.shapeFrequency==nil{proposal.shapeFrequency=mixture.probability;proposal.shapePreferredWidth=mixture.width}
                let controlsEnabled=settings.shapes>0 && settings.shapeFrequency != 0
                let groupSeed=seed &+ UInt64(round*1009+directionIndex*100003+1777)
                let groupID="r\(round)-\(directionKey)-shape"
                let groupSource=try fresh(direction,groupSeed,round%3==2 ? nil:champion,groupID)
                let controls=controlsEnabled ? try ImageCompositionSearch.matched(groupSource.0,profile:profile,settings:proposal,direction:direction,seed:groupSeed,copy:copy,donorIDs:groupSource.1,shapePreset:shapePreset,third:round%2==0 ? "offset":"zoom"):[]
                for local in 0..<perDirection {
                    try Task.checkCancellation()
                    let index=directionIndex*perDirection+local,itemSeed=seed &+ UInt64(round*1009+directionIndex*100003+local*37),id="image-r\(round)-c\(index)",url=folder.appending(path:id+".jpg")
                    progress("\(directionLabel) · round \(round+1)/\(rounds) · candidate \(local+1)/\(perDirection)")
                    var candidate:ImagePosterCandidate
                    if local==0,let champion {
                        candidate=champion;candidate.id=id;candidate.parentID=champion.id;candidate.imageURL=url;candidate.matchedGroup=nil;candidate.control=nil;candidate.role="retained"
                    }else if controls.count==3,local>=perDirection-3 {
                        let variant=controls[local-(perDirection-3)]
                        candidate = .init(id:id,seed:groupSeed,parentID:champion?.id,donorIDs:groupSource.1,genome:variant.1,sourceGenome:groupSource.0,imageURL:url)
                        candidate.matchedGroup=groupID;candidate.control=variant.0;candidate.role="controlled-experiment"
                    }else{
                        let source=try fresh(direction,itemSeed,local%2==0 ? champion:nil,id)
                        let genome=try ImagePosterComposer.compose(source.0,profile:profile,settings:proposal,seed:itemSeed,copy:copy,donorIDs:source.1,shapePreset:shapePreset,direction:direction)
                        candidate = .init(id:id,seed:itemSeed,parentID:local%2==0 ? champion?.id:nil,donorIDs:source.1,genome:genome,sourceGenome:source.0,imageURL:url);candidate.role="proposal"
                    }
                    candidate.hypothesis=directionKey
                    let rendered=try LibrarySceneRenderer.render(candidate.genome,width:760,seed:candidate.seed)
                    let digest=LibraryRaster.hash(rendered.dataProvider?.data as Data? ?? Data())
                    guard digests.insert(digest).inserted else{throw PosterError.invalid("Identical candidates inside a round; completed rounds are preserved.")}
                    try ImageStudyStorage.preview(rendered,to:url)
                    candidate.visualEmbedding=try LibraryRaster.embedding(rendered)
                    if settings.useGeneratedTypeJudging{candidate.generatedType=try GeneratedTypographyJudge.evaluate(candidate.genome,maskURL:folder.appending(path:id+"-type.png"))}else{candidate.generatedType=nil}
                    candidate.genome.imageInfluence?.analysisURL=output.appending(path:"image-analysis.json")
                    candidate.genome=ImageStudyStorage.lean(candidate.genome)
                    try ImageStudyStorage.write(candidate.genome,to:folder.appending(path:id+"-genome.json"))
                    candidates.append(candidate)
                    events(.candidate(direction:studyName,round:round,index:index,id:id,image:url,modifiers:[],retained:candidate.role=="retained"))
                    samples.append(.init(id:id,backend:"hypothesis-and-matched-shape-search",seed:candidate.seed,generation:round,imageURL:url,parameters:["repetition":0.4]))
                }
            }
            var judging=try await judge.judgeExternal(samples,weights:weights)
            for i in judging.results.indices {
                let c=candidates.first{$0.id==judging.results[i].id}!
                var measured=judging.results[i].measurements
                if let assessment=c.generatedType {
                    judging.results[i].scores["Full-image typography diagnostic"]=judging.results[i].scores["Typography"]
                    measured=GeneratedTypographyJudge.measurements(measured,assessment:assessment)
                    judging.results[i].measurements=measured
                    judging.results[i].scores["Typography"]=assessment.recoveredTitleFraction*0.65+min(1,assessment.displayLetterHeight/0.08)*0.35
                }
                judging.results[i].scores.merge(CompositionJudges.evaluate(c.genome,measurements:measured,copy:copy,style:c.genome.styleCategory)){_,new in new}
                var scoringScene=c.genome;scoringScene.imageInfluence?.profile=profile
                judging.results[i].scores.merge(ImagePosterComposer.scores(scoringScene)){_,new in new}
                judging.results[i].scores.merge(try taste.scores(c.visualEmbedding!)){_,new in new}
            }
            judging.results=Voting.rank(judging.results,weights:weights)
            var directionWinners:[String:String]=[:]
            for key in directionKeys {
                let best=judging.results.first{result in candidates.contains{$0.id==result.id && $0.hypothesis==key}}!
                champions[key]=candidates.first{$0.id==best.id}!
                directionWinners[key]=best.id
            }
            events(.judged(direction:studyName,round:round,ranking:judging.results.map{SourceStudyVerdict(id:$0.id,rank:$0.rank,consensus:$0.consensus,votes:$0.votes.sorted{$0.value>$1.value}.prefix(4).map{($0.key,$0.value)})},winnerID:judging.results.first!.id))
            shapeJury=ImageShapeJury.updateMatched(shapeJury,candidates:candidates,results:judging.results)
            var result=ImagePosterRound(number:round,candidates:candidates,judging:judging,winnerID:judging.results.first!.id,weights:weights)
            result.shapeJury=shapeJury;result.directionWinners=directionWinners;result.finalistIDs=settings.useDiverseFinalists ? ImageCompositionSearch.finalists(candidates,ranking:judging.results):Array(judging.results.prefix(3).map(\.id))
            completed.append(result);try ImageStudyStorage.write(result,to:folder.appending(path:"round.json"))
        }
        let final=completed.last!,winner=final.candidates.first{$0.id==final.winnerID}!
        events(.directionDone(name:studyName,winnerID:winner.id))
        for stage in ConstructionStage.allCases{try PosterRenderer.png(LibrarySceneRenderer.render(winner.genome,width:700,seed:winner.seed,stage:stage),to:output.appending(path:"winner-\(stage.rawValue).png"))}
        try PosterRenderer.png(LibrarySceneRenderer.render(winner.genome,width:2400,seed:winner.seed),to:output.appending(path:"winner.png"))
        try LibrarySceneRenderer.pdf(winner.genome,to:output.appending(path:"winner.pdf"),seed:winner.seed)
        try ImageStudyStorage.write(winner.genome,to:output.appending(path:"winner-genome.json"))
        for (selectionIndex,id) in (final.finalistIDs ?? []).enumerated() {
            let c=final.candidates.first{$0.id==id}!
            let dir=output.appending(path:"finalist-\(selectionIndex+1)");try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
            try PosterRenderer.png(LibrarySceneRenderer.render(c.genome,width:1800,seed:c.seed),to:dir.appending(path:"finalist.png"))
            try LibrarySceneRenderer.pdf(c.genome,to:dir.appending(path:"finalist.pdf"),seed:c.seed)
        }
        var savedSettings=settings;savedSettings.generatedTypeJudging=settings.useGeneratedTypeJudging;savedSettings.diverseFinalists=settings.useDiverseFinalists;savedSettings.compositionDirections=settings.useCompositionDirections
        var result=ImagePosterStudyResult(profile:profile,settings:savedSettings,copy:copy,seed:seed,rounds:completed,winner:winner,directory:output);result.finalistIDs=final.finalistIDs
        try ImageStudyStorage.write(result,to:output.appending(path:"image-study.json"));progress("Complete · \(rounds*count) candidates, \(directionKeys.count) composition pools and matched shape controls")
        return result
    }
}

enum ImageStudyStorage {
    static func lean(_ scene:StyleGenome)->StyleGenome {var copy=scene;copy.imageInfluence?.profile.cells=[];copy.imageInfluence?.profile.embedding=nil;return copy}
    static func write<T:Encodable>(_ value:T,to url:URL)throws {let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys];try encoder.encode(value).write(to:url,options:.atomic)}
    static func preview(_ image:CGImage,to url:URL)throws {
        guard let target=CGImageDestinationCreateWithURL(url as CFURL,UTType.jpeg.identifier as CFString,1,nil) else{throw PosterError.render}
        CGImageDestinationAddImage(target,image,[kCGImageDestinationLossyCompressionQuality:0.96] as CFDictionary)
        guard CGImageDestinationFinalize(target) else{throw PosterError.render}
    }
}
