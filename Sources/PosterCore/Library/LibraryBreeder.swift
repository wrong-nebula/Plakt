import Foundation
import CoreGraphics

public struct HybridScene:Codable,Identifiable,Sendable {
    public var id:String;public var seed:UInt64
    public var genome:StyleGenome;public var donorIDs:[String];public var parentID:String?
    public var imageURL:URL
}
public struct HybridRound:Codable,Sendable {
    public var direction:String;public var round:Int;public var donorIDs:[String]
    public var donorCompatibility:Double;public var candidates:[HybridScene]
    public var judging:ExternalEvaluation;public var winnerID:String
    public var weights:[String:Double];public var constructionImages:[URL]
    public var rejectedVisualClones:Int? = nil
    public var minimumVisualDistance:Double? = nil
    public var posterCopy:PosterCopy? = nil
    public var contentBrief:PosterContentBrief? = nil
    public var personalJury:[TasteJuryMember]? = nil
    public var judgingReference:URL? = nil
    public var surrogate:SurrogateFilterLog? = nil
    public var note="Observed source composition inheritance: retain one source anchor graph, transfer coherent local clusters, adapt display typography and source-dependent information zones. Per-element source links and operations are stored in layoutInheritance. Recipe style heads, authored composition prior and generic whitespace priors have zero default voting weight. Borders are still review proposals. Vision affinity and relative Borda consensus are not aesthetic quality measurements."
}

/// What a source study is doing, for a live view. Paths point at files already written.
public enum SourceStudyEvent:Sendable {
    case direction(index:Int,total:Int,name:String,rounds:Int,count:Int,graphic:URL)
    case candidate(direction:String,round:Int,index:Int,id:String,image:URL,modifiers:[String],retained:Bool)
    case judged(direction:String,round:Int,ranking:[SourceStudyVerdict],winnerID:String)
    case directionDone(name:String,winnerID:String)
}
public struct SourceStudyVerdict:Sendable,Identifiable {
    public var id:String;public var rank:Int;public var consensus:Double
    /// The judges that gave this candidate the most weighted points, strongest first.
    public var votes:[(String,Double)]
    public init(id:String,rank:Int,consensus:Double,votes:[(String,Double)]){self.id=id;self.rank=rank;self.consensus=consensus;self.votes=votes}
}

public actor LibraryBreeder {
    private let records:[PosterRecord]
    private let atlas:[String:[String]]
    private let styleBank:StyleJudgeBank
    private let judge:EvolutionEngine
    private let output:URL
    public init(records:[PosterRecord],output:URL)throws {
        self.records=records.filter{$0.genome.elements.count>=3 && $0.elements.contains{$0.kind=="text-line" && $0.reviewStatus != "rejected"} && (0.5...2.2).contains($0.genome.aspect)}
        guard self.records.count>=20 else{throw PosterError.invalid("Need at least 20 indexed poster genomes with text for five-round donor studies.")}
        struct Atlas:Decodable {struct Entry:Decodable{var posterID:String;var styles:[String]};var entries:[Entry]}
        let atlasURL=records.first?.imageURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appending(path:"layout-atlas.json")
        let entries=atlasURL.flatMap{try? Data(contentsOf:$0)}.flatMap{try? JSONDecoder().decode(Atlas.self,from:$0).entries} ?? []
        atlas=Dictionary(uniqueKeysWithValues:entries.map{($0.posterID,$0.styles)})
        self.output=output;styleBank=try StyleJudgeBank();judge=try EvolutionEngine()
    }
    public static func make(records:[PosterRecord],output:URL) async throws->LibraryBreeder {try LibraryBreeder(records:records,output:output)}
    private func affinity(_ record:PosterRecord,_ category:String,_ scores:[String:Double])->Double {
        let active=record.elements.filter{$0.reviewStatus != "rejected" && $0.kind != "word"}
        let lines=active.filter{$0.kind=="text-line"},regions=active.count-lines.count
        let rotation=lines.filter{abs($0.rotation)>10}.count
        let chroma=record.colors?.meanChroma ?? 0
        let measured:Double
        switch category {
        case "halftone":measured=min(1,Double(regions)/4)*0.6+min(1,record.statistics.contrast/0.3)*0.4
        case "guilloche":measured=min(1,record.statistics.edgeDensity*15)*0.7+(chroma<0.08 ? 0.3:0)
        case "color-field":measured=min(1,chroma/0.14)*0.7+min(1,Double(regions)/4)*0.3
        case "kinetic":measured=min(1,Double(rotation)/3)*0.7+min(1,Double(lines.count)/12)*0.3
        case "minimal":measured=exp(-Double(active.count)/12)
        case "abstract":measured=min(1,Double(regions)/5)*0.55+min(1,chroma/0.12)*0.45
        case "bauhaus":measured=min(1,Double(regions)/4)*0.4+min(1,chroma/0.12)*0.4+(lines.count<14 ? 0.2:0)
        case "expressive":measured=min(1,Double(lines.count)/25)*0.5+min(1,Double(rotation)/3)*0.5
        default:measured=min(1,Double(lines.count)/15)*0.5+(rotation==0 ? 0.3:0)+((record.colors?.swatches.count ?? 6)<=4 ? 0.2:0)
        }
        let name=StyleCatalog.categories.first{$0.id==category}!.name
        return measured*0.65+(scores[name] ?? 0)*0.0+record.surfaceConfidence*0.1
    }
    private func compatibility(_ a:PosterRecord,_ b:PosterRecord)throws->Double {
        let visual=exp(-(try a.embedding.distance(to:b.embedding))*1.4)
        let aspect=exp(-abs(log(a.genome.aspect/b.genome.aspect))*2)
        let av=a.colors?.colorEmbedding ?? [],bv=b.colors?.colorEmbedding ?? []
        let palette=av.count==bv.count ? zip(av,bv).reduce(0.0){$0+$1.0*$1.1}:0
        let size=exp(-abs(log(Double(a.genome.elements.count+1)/Double(b.genome.elements.count+1))))
        return SourceLayoutDNA.compatibility(a,b)*0.65+visual*0.1+aspect*0.1+palette*0.1+size*0.05
    }
    /// Rotated ink quad of a text line, or the rotated bounds of a form, in physical units (y × aspect).
    private static func quad(_ e:SceneElement,genome:StyleGenome)->[CGPoint] {
        var x=e.bounds.x,y=e.bounds.y,w=e.bounds.width,h=e.bounds.height
        if e.kind=="text" && e.preserveTypeProportions==true {
            var upright=e;upright.rotation=0
            let ink=CompositionJudges.inkBounds(upright,genome:genome);x=ink.x;y=ink.y;w=ink.width;h=ink.height
        }
        let angle=e.rotation * .pi/180,cx=e.bounds.x+e.bounds.width/2,cy=(e.bounds.y+e.bounds.height/2)*genome.aspect
        return [(x,y),(x+w,y),(x+w,y+h),(x,y+h)].map{p in
            let px=p.0-cx,py=p.1*genome.aspect-cy
            return CGPoint(x:cx+px*cos(angle)-py*sin(angle),y:cy+px*sin(angle)+py*cos(angle))
        }
    }
    private static func inside(_ p:CGPoint,_ q:[CGPoint])->Bool {
        var sign=0.0
        for i in q.indices {
            let a=q[i],b=q[(i+1)%q.count],cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)
            if sign==0{sign=cross}else if cross*sign<0{return false}
        }
        return true
    }
    private static func samples(_ q:[CGPoint])->[CGPoint] {
        var points:[CGPoint]=[]
        for u in stride(from:0.05,through:0.95,by:0.1){for v in stride(from:0.1,through:0.9,by:0.2){
            let top=CGPoint(x:q[0].x+(q[1].x-q[0].x)*u,y:q[0].y+(q[1].y-q[0].y)*u),bottom=CGPoint(x:q[3].x+(q[2].x-q[3].x)*u,y:q[3].y+(q[2].y-q[3].y)*u)
            points.append(CGPoint(x:top.x+(bottom.x-top.x)*v,y:top.y+(bottom.y-top.y)*v))
        }}
        return points
    }
    /// Display lines must not pile into each other (an echo may touch its copies), and no line
    /// may sit on a form of nearly its own colour. Rotation is measured, not boxed.
    static func crowding(_ genome:StyleGenome,echo:Bool)->String? {
        let display=genome.elements.filter{$0.kind=="text" && $0.sourceAnchor != nil}
        let quads=display.map{quad($0,genome:genome)}
        for x in quads.indices {for y in quads.indices where y != x {
            let shared=Double(samples(quads[x]).filter{inside($0,quads[y])}.count)/50
            if shared>(echo ? 0.45:0.08){return "Display lines overlap."}
        }}
        // Display type must leave the information block readable.
        let info=genome.elements.filter{$0.kind=="text" && $0.sourceElementID.hasPrefix("meta:")}.map{quad($0,genome:genome)}
        for q in info {for d in quads where samples(q).filter({inside($0,d)}).count>2 {return "Display type covers the information block."}}
        let forms=genome.elements.filter{$0.kind=="shape" && $0.sourceElementID.hasPrefix("art:")}
        for (e,q) in zip(display,quads) {
            let points=samples(q)
            let hidden=points.filter{p in forms.contains{form in
                guard SourceLayoutDNA.contrast(form.color,e.color)<2 else{return false}
                let fq=quad(form,genome:genome)
                guard inside(p,fq) else{return false}
                guard ["ellipse","disc"].contains(form.shape) else{return true}
                let c=CGPoint(x:(fq[0].x+fq[2].x)/2,y:(fq[0].y+fq[2].y)/2),rx=form.bounds.width/2,ry=form.bounds.height*genome.aspect/2
                return pow((p.x-c.x)/rx,2)+pow((p.y-c.y)/ry,2)<=1
            }}.count
            if Double(hidden)/Double(points.count)>0.2 {return "Display line disappears into a form of its own colour."}
        }
        return nil
    }
    public func run(rounds:Int=5,count:Int=8,seed:UInt64=20261108,copy suppliedCopy:PosterCopy=PosterCopy(),useBriefLibrary:Bool=false,overrideWeights:[String:Double]?=nil,fontProfileID:String?=nil,typeSystem:TypeSystemVariant?=nil,shapePreset:PosterShapePreset?=nil,tasteDirectory:URL?=nil,directions:[String]?=nil,reference:SourceStudyReference?=nil,useModifiers:Bool=false,proposalsPerSlot:Int=1,events:@Sendable(SourceStudyEvent)->Void={_ in},progress:@Sendable(String)->Void={_ in}) async throws {
        guard (1...10).contains(rounds),(4...16).contains(count) else{throw PosterError.invalid("Hybrid studies use 1–10 rounds and 4–16 candidates.")}
        guard (1...8).contains(proposalsPerSlot) else{throw PosterError.invalid("The pre-render filter builds 1–8 proposals per candidate.")}
        let surrogate=proposalsPerSlot>1 ? JurySurrogate.shared:nil
        if proposalsPerSlot>1,surrogate==nil{throw PosterError.invalid("The pre-render filter model could not be loaded.")}
        if let fontProfileID,FontLibrary.shared.profile(fontProfileID)==nil{throw PosterError.invalid("Unknown font style profile: \(fontProfileID)")}
        guard !FileManager.default.fileExists(atPath:output.appending(path:"manifest.json").path) else{throw PosterError.invalid("Hybrid output already exists; choose a new run directory.")}
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        var learned:[String:[String:Double]]=[:]
        for record in records {learned[record.id]=try styleBank.scores(record.embedding,colors:record.colors)}
        let inferredTaste=records.first?.imageURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appending(path:"taste")
        let taste=try TasteJudgeBank(directory:tasteDirectory ?? inferredTaste)
        var summaries:[[String:String]]=[],seenPNGs:Set<String>=[]
        let modifiers=useModifiers ? try ModifierPass():nil
        if let directions {guard !directions.isEmpty,directions.allSatisfy({id in StyleCatalog.categories.contains{$0.id==id}}) else{throw PosterError.invalid("Unknown source-study direction.")}}
        for (directionIndex,category) in StyleCatalog.categories.enumerated() where directions==nil || directions!.contains(category.id) {
            let copy=useBriefLibrary ? ContentBriefLibrary.copy(seed:seed,offset:directionIndex):suppliedCopy
            let selected=records.filter{atlas[$0.id]?.contains(category.id)==true}
            let pool=selected.count>=rounds*2 ? selected:records
            var ranking:[String:Double]=[:]
            for record in pool {
                let hash=record.id.utf8.reduce(UInt64(1469598103934665603)){($0 ^ UInt64($1)) &* 1099511628211}
                var random=SeededRandom(seed:hash ^ seed ^ UInt64(directionIndex*9109))
                // With a judging reference, donors that already look and colour like it lead; less noise.
                let resemblance=try reference.map{try $0.similarity(record.embedding,colors:record.colors)} ?? 0
                ranking[record.id]=affinity(record,category.id,learned[record.id] ?? [:])+resemblance*0.6+random.value(0,reference==nil ? 0.5:0.2)
            }
            let ranked=pool.sorted{let a=ranking[$0.id]!,b=ranking[$1.id]!;return a==b ? $0.id<$1.id:a>b}
            var used:Set<String>=[],champion:HybridScene?,sources:[String:StyleGenome]=[:],imageScores:[String:[String:Double]]=[:]
            let palette=reference?.scenePalette
            // Start-from-image logic. The direction's own forms play the image: rendered once
            // and measured like a photograph (palette, texture, attention, calm space), then each
            // candidate composes inherited display type around it exactly as an image study does,
            // and the stand-in raster is swapped back for the vector forms.
            let directionFolder=output.appending(path:category.id)
            try FileManager.default.createDirectory(at:directionFolder,withIntermediateDirectories:true)
            let graphic=SourceComposition.graphic(category:category.id,seed:seed ^ UInt64(directionIndex*7919),copy:copy,palette:palette)
            let graphicURL=directionFolder.appending(path:"graphic.png")
            try PosterRenderer.png(LibrarySceneRenderer.render(graphic,width:1400,seed:seed),to:graphicURL)
            let profile=try ImageInfluenceAnalyzer.analyze(graphicURL,assets:directionFolder.appending(path:"assets"))
            let hasForms = !graphic.elements.isEmpty
            let total=directions?.count ?? StyleCatalog.categories.count
            events(.direction(index:summaries.count,total:total,name:category.name,rounds:rounds,count:count,graphic:graphicURL))
            // The direction's forms are the graphic; the composer's extra response shape (often
            // multi-ink survey recipes) stays off, so type-only directions remain type-led.
            var settings=ImageInfluenceSettings();settings.shapeFrequency=0
            let top=Array(ranked.prefix(100))
            guard top.count>=2 else{throw PosterError.invalid("Need more independently sourced donor genomes.")}
            var weights:[String:Double]=["Typography":0.4,"Diversity":0.7,"Legibility":1,"Type integrity":0.5,"Hierarchy":1,"Copy completeness":1,"Image breathing room":1,"Image retention":1.2,"Display presence":2,"Reference":reference==nil ? 0:1.5,"Composition":0]
            weights.merge(taste.weights){_,new in new}
            if let overrideWeights {for (key,value) in overrideWeights{weights[key]=value}}
            guard weights.values.allSatisfy({$0.isFinite && (0...10).contains($0)}),weights.contains(where:{$0.value>0 && (!TasteTrainer.isJudge($0.key) || taste.weights[$0.key] != nil)}) else{throw PosterError.invalid("Enable a craft judge or give your taste jurors at least 3 yes and 3 no votes.")}
            func propose(_ itemSeed:UInt64,_ id:String,_ parent:HybridScene?,_ url:URL,strict:Bool)throws->HybridScene {
                var rng=SeededRandom(seed:itemSeed ^ 0x504f4f4c)
                let a=parent?.donorIDs.first.flatMap{id in top.first{$0.id==id}} ?? top[rng.int(top.count)]
                let independent=top.filter{$0.id != a.id && $0.source.postID != a.source.postID}
                let b=independent.isEmpty ? top.first{$0.id != a.id}!:independent[rng.int(independent.count)]
                let source=SourceLayoutDNA.make(a,b,category:category.id,seed:itemSeed,copy:copy,id:id,fontProfileID:fontProfileID,typeSystem:typeSystem,shapePreset:nil,palette:palette)
                let base=parent.flatMap{sources[$0.id]}.map{SourceComposition.cross($0,source,seed:itemSeed,id:id)} ?? source
                let direction:ImageCompositionDirection=hasForms && itemSeed%3==0 ? .imageLed:.typeLed
                // Repetition is an artistic option, not filler: about a third of proposals echo the title.
                let echo=rng.unit()<0.3
                let allocated=ImageCompositionSearch.allocate(base,copy:copy,direction:direction,seed:itemSeed,repetition:echo)
                let composed=try ImagePosterComposer.compose(allocated,profile:profile,settings:settings,seed:itemSeed,copy:copy,donorIDs:[a.id,b.id],shapePreset:shapePreset,direction:direction)
                // Judge the type that is drawn: normalize it before measuring presence.
                let drawn=SourceComposition.normalizeDisplay(composed,category:category.id)
                let genome=SourceComposition.vectorize(drawn,graphic:graphic)
                if let problem=Self.crowding(genome,echo:echo){throw PosterError.invalid(problem)}
                let scores=ImagePosterComposer.scores(drawn)
                // A headline must carry the poster: thin lines of small type are proposed again.
                if (scores["Display presence"] ?? 1)<(strict ? 0.75:0.6) {throw PosterError.invalid("Display type too faint.")}
                imageScores[id]=scores;sources[id]=base
                var final=genome
                // With modifiers on, half the proposals run their display type through 1–2 modifiers,
                // so the jury weighs modified against plain type.
                if let modifiers,rng.unit()<0.5 {
                    final=try modifiers.apply(genome,seed:itemSeed,accent:palette?.accent,to:url.deletingPathExtension().appendingPathExtension("type.pdf")).0
                }
                return HybridScene(id:id,seed:itemSeed,genome:final,donorIDs:[a.id,b.id],parentID:parent?.id,imageURL:url)
            }
            for round in 0..<rounds {
                try Task.checkCancellation()
                let folder=output.appending(path:"\(category.id)/round-\(round)")
                try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                let base=seed &+ UInt64(directionIndex*100000+round*1000)
                var scenes:[HybridScene]=[],samples:[ExternalSample]=[],prints:[VisualEmbedding]=[]
                let embedder=LibraryVisualEmbedder(),minimumDistance=0.045
                var cloneRejections=0,proposalScores:[String:[Double]]=[:]
                for i in 0..<count {
                    let itemSeed=base+UInt64(i*17),id="\(category.id)-r\(round)-c\(i)",url=folder.appending(path:id+".png")
                    var accepted:HybridScene?
                    for attempt in 0..<64 {
                        try Task.checkCancellation()
                        var scene:HybridScene
                        if i==0,attempt==0,let champion {
                            scene=HybridScene(id:id,seed:champion.seed,genome:champion.genome,donorIDs:champion.donorIDs,parentID:champion.id,imageURL:url)
                            imageScores[id]=imageScores[champion.id];sources[id]=sources[champion.id]
                        }else{
                            // As in image studies: half the proposals inherit the champion; every third round starts fresh.
                            let parent=i%2==0 && round%3 != 2 && attempt==0 ? champion:nil
                            let attemptSeed=itemSeed+UInt64(attempt)*100003,strict=attempt<48
                            guard var proposed=try? propose(attemptSeed,id,parent,url,strict:strict) else{continue}
                            if let surrogate {
                                // Pre-render filter: further proposals for this slot, ranked by the jury surrogate before the
                                // full render and judging. Proposal 0 is the unfiltered scene, so a filter of 1 changes nothing.
                                var best=(scene:proposed,seed:attemptSeed,score:try surrogate.score(proposed.genome,direction:category.name)),last=attemptSeed,values=[best.score]
                                for k in 1..<proposalsPerSlot {
                                    let otherSeed=attemptSeed &+ UInt64(k)*7919
                                    guard let other=try? propose(otherSeed,id,parent,url,strict:strict) else{continue}
                                    last=otherSeed
                                    guard CompositionJudges.preflight(other.genome,copy:copy).isEmpty else{continue}
                                    let value=try surrogate.score(other.genome,direction:category.name);values.append(value)
                                    if value>best.score {best=(other,otherSeed,value)}
                                }
                                // A proposal leaves its image scores, source and modified-type file behind under this slot's ID.
                                // If the chosen one was not the last to run, it is proposed again so those belong to it.
                                if last != best.seed {guard let again=try? propose(best.seed,id,parent,url,strict:strict) else{continue};best.scene=again}
                                proposed=best.scene
                                proposalScores[id]=values
                            }
                            scene=proposed
                        }
                        if !CompositionJudges.preflight(scene.genome,copy:copy).isEmpty {continue}
                        let printAccepted=try autoreleasepool {()->VisualEmbedding? in
                            let image=try LibrarySceneRenderer.render(scene.genome,width:700,seed:scene.seed)
                            try PosterRenderer.png(image,to:url)
                            let digest=LibraryRaster.hash(try Data(contentsOf:url))
                            if !(i==0 && champion != nil) && seenPNGs.contains(digest){cloneRejections+=1;return nil}
                            let feature=try embedder.embed(PosterRenderer.load(url))
                            let nearest=try prints.map{try feature.distance(to:$0)}.min() ?? .infinity
                            guard nearest>=minimumDistance else{cloneRejections+=1;return nil}
                            seenPNGs.insert(digest)
                            return feature
                        }
                        if let feature=printAccepted {prints.append(feature);try LibraryRaster.write(feature,to:folder.appending(path:id+"-embedding.json"));accepted=scene;break}
                    }
                    guard let scene=accepted else{throw PosterError.invalid("Could not find a distinct, valid \(category.name) candidate after 64 attempts. Completed rounds are preserved." )}
                    try LibraryRaster.write(scene.genome,to:folder.appending(path:id+"-genome.json"))
                    try scene.genome.composition?.write(to:folder,stem:id+"-composition")
                    scenes.append(scene);used.formUnion(scene.donorIDs)
                    let applied=(scene.genome.layoutInheritance?.operations ?? []).last{$0.hasPrefix("Modifiers on display type: ")}
                        .map{String($0.dropFirst("Modifiers on display type: ".count).prefix{$0 != "("}).trimmingCharacters(in:.whitespaces).components(separatedBy:" + ")} ?? []
                    events(.candidate(direction:category.name,round:round,index:i,id:id,image:url,modifiers:applied,retained:i==0 && champion != nil))
                    samples.append(ExternalSample(id:id,backend:"source-genome-image-logic",seed:scene.seed,generation:round,imageURL:url,parameters:["repetition":0.4]))
                }
                let byID=Dictionary(records.map{($0.id,$0)},uniquingKeysWith:{a,_ in a})
                let roundDonors=Array(Set(scenes.flatMap(\.donorIDs))).sorted()
                let pairs=scenes.compactMap{s->(PosterRecord,PosterRecord)? in guard s.donorIDs.count>=2,let a=byID[s.donorIDs[0]],let b=byID[s.donorIDs[1]] else{return nil};return(a,b)}
                let compatibility=try pairs.map{try self.compatibility($0.0,$0.1)}.reduce(0,+)/Double(max(1,pairs.count))
                var judging=try await judge.judgeExternal(samples,weights:weights)
                for i in judging.results.indices {
                    let scene=scenes.first{$0.id==judging.results[i].id}!
                    let index=scenes.firstIndex{$0.id==scene.id}!,feature=prints[index]
                    let donors=scene.donorIDs.compactMap{byID[$0]}
                    let donorDistance=try donors.map{try feature.distance(to:$0.embedding)}.reduce(0,+)/Double(max(1,donors.count))
                    let nearest=try prints.enumerated().filter{$0.offset != index}.map{try feature.distance(to:$0.element)}.min() ?? .infinity
                    judging.results[i].scores["Diversity"]=min(1,nearest/0.8)
                    // Reference means the studio's judging reference when one is set; otherwise donor resemblance.
                    let resemblance:Double
                    if let reference {
                        let colors=try PosterColorAnalyzer().analyze(PosterRenderer.load(scene.imageURL))
                        resemblance=try reference.similarity(feature,colors:colors)
                    }else{resemblance=exp(-donorDistance*1.4)}
                    judging.results[i].scores["Reference"]=resemblance
                    judging.results[i].measurements.reference=resemblance
                    judging.results[i].measurements.featureDistance=donorDistance
                    let geometry=CompositionJudges.evaluate(scene.genome,measurements:judging.results[i].measurements,copy:copy,style:category.id)
                    judging.results[i].scores.merge(geometry){_,new in new}
                    judging.results[i].scores.merge(imageScores[scene.id] ?? [:]){_,new in new}
                    judging.results[i].scores.merge(try taste.scores(feature)){_,new in new}
                }
                judging.results=Voting.rank(judging.results,weights:weights)
                let winnerID=judging.results.first!.id
                events(.judged(direction:category.name,round:round,ranking:judging.results.map{result in
                    SourceStudyVerdict(id:result.id,rank:result.rank,consensus:result.consensus,votes:result.votes.sorted{$0.value>$1.value}.prefix(4).map{($0.key,$0.value)})},winnerID:winnerID))
                champion=scenes.first{$0.id==winnerID}!
                var stages:[URL]=[]
                for stage in ConstructionStage.allCases {
                    let url=folder.appending(path:"winner-\(stage.rawValue).png")
                    try autoreleasepool{try PosterRenderer.png(LibrarySceneRenderer.render(champion!.genome,width:480,seed:champion!.seed,stage:stage),to:url)}
                    stages.append(url)
                }
                var result=HybridRound(direction:category.name,round:round,donorIDs:roundDonors,donorCompatibility:compatibility,candidates:scenes,judging:judging,winnerID:winnerID,weights:weights,constructionImages:stages)
                result.posterCopy=copy;result.contentBrief=ContentBriefLibrary.brief(copy.briefID);result.personalJury=taste.members;result.judgingReference=reference?.url
                if let surrogate {result.surrogate=SurrogateFilterLog(model:surrogate.version,proposalsPerSlot:proposalsPerSlot,proposals:proposalScores)}
                result.rejectedVisualClones=cloneRejections;result.note="Start-from-image logic: the direction's forms are measured like an image; inherited display type is composed around them as one cluster at a size set by calm space, with information type in a calm island. New donor pair per candidate. "+result.note;result.minimumVisualDistance=minimumDistance
                try LibraryRaster.write(result,to:folder.appending(path:"round.json"))
                progress("\(category.name) \(round+1)/\(rounds): \(roundDonors.count) donors → \(winnerID) · rejected \(cloneRejections) visual clones")
            }
            if let champion {
                let folder=output.appending(path:category.id)
                try LibraryRaster.write(champion,to:folder.appending(path:"winner.json"))
                try champion.genome.composition?.write(to:folder,stem:"winner-composition")
                try PosterRenderer.png(LibrarySceneRenderer.render(champion.genome,width:2200,seed:champion.seed),to:folder.appending(path:"winner.png"))
                try LibrarySceneRenderer.pdf(champion.genome,to:folder.appending(path:"winner.pdf"),seed:champion.seed)
                events(.directionDone(name:category.name,winnerID:champion.id))
                summaries.append(["direction":category.name,"category":category.id,"winnerID":champion.id,"image":folder.appending(path:"winner.png").path,"rounds":String(rounds),"uniqueDonors":String(used.count),"briefID":copy.briefID ?? "custom","title":copy.title.replacingOccurrences(of:"\n",with:" ")])
            }
        }
        try LibraryRaster.write(summaries,to:output.appending(path:"manifest.json"))
    }
}
