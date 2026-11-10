import Foundation
import PosterCore

extension PosterChecks {
    static func checkJuryCalibration()throws {
        let metrics=Measurements(coverage:0.5,detail:0.5,balance:0.5,contrast:0.5,readability:0.5,reference:0.5,hierarchy:0.5,repetition:0.5,recognizedWords:5)
        func candidate(_ id:String,_ seed:UInt64,_ scores:[String:Double],folder:URL=URL(fileURLWithPath:"/tmp"))->Candidate{Candidate(id:id,genome:.random(seed:seed),generation:0,imageURL:folder.appending(path:id+".png"),measurements:metrics,scores:scores)}
        let a=candidate("a",1,["Minimal":0.9,"Reference":0.1,"Spacing":1]),b=candidate("b",2,["Minimal":0.1,"Reference":0.9,"Spacing":1])
        let withFlat=Voting.rank([a,b],weights:["Minimal":3,"Reference":0.5,"Spacing":5]),without=Voting.rank([a,b],weights:["Minimal":3,"Reference":0.5])
        try require(withFlat.map(\.id)==without.map(\.id) && withFlat.allSatisfy{$0.votes["Spacing"]==nil} && zip(withFlat,without).allSatisfy{abs($0.consensus-$1.consensus)<1e-9},"A flat judge cast a ballot or moved the consensus")
        let near=[candidate("x",3,["Minimal":0.5]),candidate("y",4,["Minimal":0.505]),candidate("z",5,["Minimal":0.6])]
        let exact=Voting.rank(near),margin=Voting.rank(near,tolerance:0.01)
        try require(exact.first{$0.id=="x"}?.votes["Minimal"]==0 && margin.first{$0.id=="x"}?.votes["Minimal"]==margin.first{$0.id=="y"}?.votes["Minimal"] && margin.first?.id=="z","Tie tolerance is not applied")
        try require(Voting.rank([near[0],near[1]],tolerance:0.01).allSatisfy{$0.votes.isEmpty},"A batch inside the tie margin still voted")

        let directory=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"jury-check-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let round=directory.appending(path:"study/minimal/round-0"),orphan=directory.appending(path:"study/minimal/round-9")
        try FileManager.default.createDirectory(at:round,withIntermediateDirectories:true);try FileManager.default.createDirectory(at:orphan,withIntermediateDirectories:true)
        let scores:[[String:Double]]=[["Minimal":0.9,"Reference":0.1],["Minimal":0.7,"Reference":0.3],["Minimal":0.3,"Reference":0.7],["Minimal":0.1,"Reference":0.9]]
        let stored=Voting.rank(scores.enumerated().map{candidate("c\($0.offset)",UInt64(10+$0.offset),$0.element,folder:round)},weights:["Minimal":1,"Reference":0])
        let results=try JSONSerialization.jsonObject(with:JSONEncoder().encode(stored))
        let manifest:[String:Any]=["direction":"Minimal","round":0,"winnerID":stored[0].id,"weights":["Minimal":1,"Reference":0],"judging":["results":results]]
        try JSONSerialization.data(withJSONObject:manifest).write(to:round.appending(path:"round.json"))
        let embedding=try JSONDecoder().decode(VisualEmbedding.self,from:Data(#"{"model":"fixture","revision":2,"dimensions":0,"scalar":"float32-le","data":"","preprocessing":"fixture"}"#.utf8))
        var archive=TasteArchive();var profile=TasteProfile(id:"fixture",name:"Fixture only")
        for (i,id) in ["c0","c1","c2","c3","lost"].enumerated() {
            let folder=id=="lost" ? orphan:round
            archive.assets.append(TasteAsset(id:"asset-\(id)",imageURL:folder.appending(path:id+".png"),sourceImageURL:folder.appending(path:id+".png"),candidateID:id,study:"study",category:"minimal",title:"TEST ONLY",groupID:id,embedding:embedding,features:[]))
            profile.votes["asset-\(id)"]=try JSONDecoder().decode(TasteVote.self,from:Data(#"{"yes":\#(i<2),"date":0,"origin":"fixture"}"#.utf8))
        }
        archive.profiles=[profile]
        let report=try JuryCalibrator.calibrate(archive:archive,profileID:"fixture")
        try require(report.yes==2 && report.no==2 && report.unmatched==1 && report.rounds==1,"Calibration matched the wrong votes")
        try require(abs(report.stored.auc-1)<1e-9 && report.stored.yesWinners==1 && report.stored.noWinners==0,"Stored ranking agreement is wrong")
        try require(abs(report.replay.auc-report.stored.auc)<1e-9 && report.replay.changedWinners==0,"Replay with stored weights does not reproduce the stored ranking")
        try require(abs((report.judges.first{$0.judge=="Minimal"}?.auc ?? 0)-1)<1e-9 && abs(report.judges.first{$0.judge=="Reference"}?.auc ?? 1)<1e-9,"Per-judge agreement is wrong")
        try require(report.judges.first{$0.judge=="Reference"}?.votingRounds==0,"A zero-weight judge was reported as voting")
        let flipped=try JuryCalibrator.calibrate(archive:archive,profileID:"fixture",mix:["Minimal":0,"Reference":1])
        try require(abs(flipped.replay.auc)<1e-9 && flipped.replay.changedWinners==1 && flipped.replay.noWinners==1,"Mix replay ignored the override weights")
        try require(rejected{_ = try JuryCalibrator.calibrate(archive:archive,profileID:"fixture",mix:["Imaginary":1])},"Calibration accepted an unknown judge")
        let even=JuryCalibrator.auc(yes:[0.5],no:[0.5])
        try require(even?.auc==0.5 && JuryCalibrator.auc(yes:[],no:[1])==nil,"AUC tie or empty-class handling is wrong")
        print("PASS: flat-judge exclusion, tie tolerance, taste-vote calibration, stored-ranking replay and mix replay")
    }
}
