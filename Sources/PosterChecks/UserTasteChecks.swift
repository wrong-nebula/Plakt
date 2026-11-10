import Foundation
import PosterCore

extension PosterChecks {
    static func checkUserTaste()async throws {
        let directory=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"taste-check-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        defer{try? FileManager.default.removeItem(at:directory)}
        var archive=TasteArchive();archive.profiles=[TasteProfile(id:"fixture",name:"Fixture only")]
        for i in 0..<6 {
            let image=try StylePosterRenderer.render(style:i<3 ? "kinetic":"minimal",seed:UInt64(700+i),width:360),url=directory.appending(path:"fixture-\(i).png")
            try PosterRenderer.png(image,to:url)
            let embedding=try LibraryRaster.embedding(image),features=try TasteTrainer.features(embedding),id=try LibraryRaster.hash(Data(contentsOf:url))
            archive.assets.append(TasteAsset(id:id,imageURL:url,sourceImageURL:url,candidateID:"fixture-\(i)",study:"isolated-functional-test",category:i<3 ? "kinetic":"minimal",title:"TEST ONLY",groupID:"fixture-\(i)",embedding:embedding,features:features))
        }
        try LibraryRaster.write(archive,to:directory.appending(path:"taste.json"))
        let store=TasteStore(directory:directory)
        for asset in archive.assets.prefix(3){try await store.vote(profileID:"fixture",assetID:asset.id,yes:true)}
        let early=try await store.train(profileID:"fixture"),earlyBank=try TasteJudgeBank(directory:directory)
        try require(early.positive==3 && early.negative==0 && !early.ready && earlyBank.members.isEmpty,"One-class taste labels cast a fabricated ballot")
        let next=try await store.next(profileID:"fixture",skipped:[archive.assets[3].id])
        try require(next != nil && early.votes[next!.id]==nil && next!.id != archive.assets[3].id,"Taste deck treats unseen/skipped posters as labels or repeats a voted item")
        for asset in archive.assets.suffix(3){try await store.vote(profileID:"fixture",assetID:asset.id,yes:false)}
        let trained=try await store.train(profileID:"fixture"),bank=try TasteJudgeBank(directory:directory)
        try require(trained.ready && trained.training?.trainingRows==6 && trained.training?.balancedAccuracy==nil,"Taste model readiness or small-sample evaluation is misleading")
        let scores=try archive.assets.map{try bank.scores($0.embedding)[trained.judgeName]!}
        try require(scores.allSatisfy{$0.isFinite && (0...1).contains($0)} && scores.prefix(3).reduce(0,+)>scores.suffix(3).reduce(0,+),"Saved Core ML taste classifier does not learn separable fixture votes")
        let asset=archive.assets[0]
        try await store.vote(profileID:"fixture",assetID:asset.id,yes:false)
        let changed=try await store.load().profiles[0]
        try require(changed.votes.count==6 && changed.positive==2 && changed.negative==4 && !changed.ready,"Re-rating duplicates a label or keeps a stale model active")
        let changedBank=try TasteJudgeBank(directory:directory)
        try require(changedBank.members.isEmpty,"Stale taste model still casts votes")
        _ = try await store.undo(profileID:"fixture")
        let restored=try await store.train(profileID:"fixture")
        try require(restored.ready && restored.digest==trained.digest,"Undo did not restore explicit taste labels")
        let second=try await store.createProfile(name:"Second member")
        try require(second.votes.isEmpty,"New taste profiles inherit unrequested labels")
        try await store.configure(profileID:second.id,enabled:false,weight:0)
        let reloaded=try TasteJudgeBank(directory:directory),again=try archive.assets.map{try reloaded.scores($0.embedding)[trained.judgeName]!}
        try require(zip(scores,again).allSatisfy{abs($0-$1)<1e-6},"Taste preference changed after loading the saved classifier")
        var invalid=asset.embedding;invalid.revision=1
        try require(rejected{_ = try TasteTrainer.features(invalid)},"Taste accepts incompatible embedding revisions")
        let engine=try await EvolutionEngine.make(cpuOnly:true)
        var settings=EvolutionSettings();settings.seed=7711;settings.count=4;settings.width=320;settings.tasteDirectory=directory;settings.judgeWeights=[trained.judgeName:1]
        let generation=try await engine.generate(copy:ContentBriefLibrary.copy(),settings:settings,output:directory.appending(path:"generation"))
        try require(generation.personalJury?.count==1 && generation.candidates.allSatisfy{$0.scores[trained.judgeName] != nil && Set($0.votes.keys)==Set([trained.judgeName])},"Personal taste model did not participate in the actual generation jury")
        print("PASS: local explicit-vote Core ML training, one-class exclusion, active deck, re-rating/undo, isolated profiles, persistence, schema validation and real generation ballots (fixture labels only)")
    }
}
