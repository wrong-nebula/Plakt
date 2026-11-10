import Foundation

public struct DominantShapeStudyItem:Codable,Sendable {
    public var id:String;public var preset:PosterShapePreset;public var genome:StyleGenome
    public var metrics:DominantShapeMetrics;public var imageURL:URL;public var parentID:String?
}
public struct DominantShapeRound:Codable,Sendable {
    public var framing:String;public var round:Int;public var candidates:[DominantShapeStudyItem]
    public var judging:ExternalEvaluation;public var winnerID:String;public var weights:[String:Double]
    public var personalJury:[TasteJuryMember]
    public var note="Authored geometry/crop/displacement judges measure real native renders. Vision/Core ML and explicit-vote taste jurors supply independent ballots. Preference affinity and batch Borda ranks are not objective quality grades. No synthetic votes or SigLIP training."
}
public actor DominantShapeStudy {
    public init(){}
    public func run(output:URL,seed:UInt64=20261108,rounds:Int=5,count:Int=12,framings:[String]=DominantShapeSystem.framings,tasteDirectory:URL?=nil,copy:PosterCopy?=nil,progress:@Sendable(String)->Void={_ in})async throws {
        guard (1...10).contains(rounds),(4...32).contains(count),!framings.isEmpty,framings.allSatisfy({DominantShapeSystem.framings.contains($0)}) else{throw PosterError.invalid("Use 1–10 rounds, 4–32 candidates, and supported framings.")}
        guard !FileManager.default.fileExists(atPath:output.path) else{throw PosterError.invalid("Choose a fresh study output directory.")}
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        let engine=try await EvolutionEngine.make(),taste=try TasteJudgeBank(directory:tasteDirectory)
        var summary:[[String:String]]=[]
        let recipes=DominantShapeSystem.recipeIDs.compactMap{PosterShapeLibrary.recipe($0)}
        for (framingIndex,framing) in framings.enumerated() {
            var parents:[DominantShapeStudyItem]=[]
            for round in 0..<rounds {
                let folder=output.appending(path:"\(framing)/round-\(round)")
                try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                var items:[DominantShapeStudyItem]=[],samples:[ExternalSample]=[],tasteScores:[String:[String:Double]]=[:]
                let batchCount=round==0 ? max(count,recipes.count):count
                for i in 0..<batchCount {
                    try Task.checkCancellation()
                    let childSeed=seed &+ UInt64(framingIndex*1_000_000+round*1000+i*19)
                    var rng=SeededRandom(seed:childSeed),preset:PosterShapePreset,parentID:String?
                    let explore=round==0 || i>=batchCount*2/3
                    if !explore,let parent=parents.isEmpty ? nil:parents[i%parents.count] {
                        preset=parent.preset;parentID=parent.id
                        // Preserve the exact incumbent as a reference, then mutate the strongest genomes.
                        if i != 0 {
                            preset.seed=childSeed
                            for p in preset.recipe.parameters {
                                let old=preset.parameters[p.id] ?? p.value
                                let radius=(p.max-p.min)*0.12
                                let value=min(p.max,max(p.min,old+rng.value(-radius,radius)))
                                preset.parameters[p.id]=p.step>=1 ? value.rounded():value
                            }
                            var changed=preset.dominant ?? DominantShapeSettings()
                            changed.scale=min(3,max(0.65,changed.scale+rng.value(-0.20,0.20)))
                            let drift:Double=["edge","corner"].contains(framing) ? 0.025:0.12
                            changed.offsetX=min(2,max(-2,changed.offsetX+rng.value(-drift,drift)))
                            changed.offsetY=min(2,max(-2,changed.offsetY+rng.value(-drift,drift)))
                            if let reveal=changed.reveal{changed.reveal=min(0.35,max(0.002,reveal*exp(rng.value(-0.25,0.25))))}
                            changed.crossing=min(0.5,max(0.04,changed.crossing+rng.value(-0.06,0.06)))
                            if rng.unit()<0.3{changed.displacement=rng.unit()}
                            preset.dominant=changed
                        }
                    }else {
                        let recipe=recipes[(i+round*7)%recipes.count]
                        let fonts=PosterShapeLibrary.suggestedFonts(recipe,limit:6)
                        preset=PosterShapePreset(recipe:recipe,seed:childSeed,fontProfileID:fonts[rng.int(fonts.count)].0.id)
                        var values=try recipe.values()
                        for p in recipe.parameters {let radius=(p.max-p.min)*0.14;let value=min(p.max,max(p.min,p.value+rng.value(-radius,radius)));values[p.id]=p.step>=1 ? value.rounded():value}
                        preset.parameters=values
                        var settings=DominantShapeSettings();settings.framing=framing
                        settings.count=i%4==0 ? 2:1
                        settings.secondRecipeID=((recipe.traits["volume"] ?? 0)>0.3 || (recipe.traits["mass"] ?? 0)>0.7) ? "poster-loop":"tone-torus"
                        settings.depth=["weave","behind","front"][i%3]
                        settings.displacement=i%3==0 ? 0.8:0
                        settings.scale=rng.value(0.85,1.2)
                        let drift:Double=["edge","corner"].contains(framing) ? 0.018:0.08
                        settings.offsetX=rng.value(-drift,drift);settings.offsetY=rng.value(-drift,drift)
                        settings.reveal=framing=="corner" ? rng.value(0.008,0.07):rng.value(0.04,0.15)
                        preset.dominant=settings
                    }
                    let id="\(framing)-r\(round)-c\(i)",url=folder.appending(path:id+".png")
                    let scene=try DominantShapeSystem.scene(preset,copy:copy)
                    let metrics=try DominantShapeMeasurements.evaluate(scene,settings:preset.dominant!)
                    let image=try LibrarySceneRenderer.render(scene,width:700)
                    try PosterRenderer.png(image,to:url)
                    tasteScores[id]=try taste.scores(image)
                    let item=DominantShapeStudyItem(id:id,preset:preset,genome:scene,metrics:metrics,imageURL:url,parentID:parentID)
                    items.append(item)
                    samples.append(ExternalSample(id:id,backend:"dominant-shape-v1",seed:preset.seed,generation:round,imageURL:url,parameters:["repetition":0.15]))
                    try LibraryRaster.write(scene,to:folder.appending(path:id+"-genome.json"));try LibraryRaster.write(preset,to:folder.appending(path:id+"-preset.json"))
                }
                var judging=try await engine.judgeExternal(samples)
                for i in judging.results.indices {
                    let result=judging.results[i],item=items.first{$0.id==result.id}!
                    judging.results[i].scores.merge(item.metrics.scores){_,new in new}
                    judging.results[i].scores.merge(tasteScores[result.id] ?? [:]){_,new in new}
                }
                var weights=["Framing intent":3.0,"Controlled crossing":1.1,"Shape visibility":2.0,"Type displacement":0.65,"Typography":0.5,"Diversity":0.6]
                weights.merge(taste.weights){_,new in new}
                judging.results=Voting.rank(judging.results,weights:weights)
                let winner=judging.results[0],best=items.first{$0.id==winner.id}!
                let record=DominantShapeRound(framing:framing,round:round,candidates:items,judging:judging,winnerID:best.id,weights:weights,personalJury:taste.members)
                try LibraryRaster.write(record,to:folder.appending(path:"round.json"))
                parents=judging.results.prefix(4).compactMap{result in items.first{$0.id==result.id}}
                for stage in ConstructionStage.allCases{try PosterRenderer.png(LibrarySceneRenderer.render(best.genome,width:700,stage:stage),to:folder.appending(path:"winner-\(stage.rawValue).png"))}
                progress("\(framing) \(round+1)/\(rounds): \(best.preset.recipe.id) · \(best.preset.dominant!.depth) · coverage \(String(format:"%.3f",best.metrics.inkCoverage)) · nudged \(best.metrics.displacedBlocks) blocks")
                if round==rounds-1 {
                    let winnerFolder=output.appending(path:framing)
                    try LibraryRaster.write(best,to:winnerFolder.appending(path:"winner.json"))
                    try PosterRenderer.png(LibrarySceneRenderer.render(best.genome,width:1800),to:winnerFolder.appending(path:"winner.png"))
                    try LibrarySceneRenderer.pdf(best.genome,to:winnerFolder.appending(path:"winner.pdf"))
                    summary.append(["framing":framing,"winnerID":best.id,"recipe":best.preset.recipe.id,"rounds":String(rounds),"image":winnerFolder.appending(path:"winner.png").path])
                }
            }
        }
        try LibraryRaster.write(summary,to:output.appending(path:"manifest.json"))
    }
}
