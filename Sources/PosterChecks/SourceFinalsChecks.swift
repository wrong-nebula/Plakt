import Foundation
import PosterCore

extension PosterChecks {
    static func checkSourceFinals()throws {
        let root=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"finals-check-\(UUID().uuidString)"),direction=root.appending(path:"minimal")
        defer{try? FileManager.default.removeItem(at:root)}
        let metrics=Measurements(coverage:0.5,detail:0.5,balance:0.5,contrast:0.5,readability:0.5,reference:0.5,hierarchy:0.5,repetition:0.5,recognizedWords:5)
        var seed:UInt64=900
        func poster(_ round:Int,_ index:Int,copying source:URL?=nil)throws->URL {
            let folder=direction.appending(path:"round-\(round)"),id="minimal-r\(round)-c\(index)",url=folder.appending(path:id+".png")
            try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
            if let source {try FileManager.default.copyItem(at:source,to:url)}else{seed+=1;try PosterRenderer.png(StylePosterRenderer.render(style:"minimal",seed:seed,width:240),to:url)}
            try LibraryRaster.write(LibraryRaster.embedding(PosterRenderer.load(url)),to:folder.appending(path:id+"-embedding.json"))
            return url
        }
        // Round winners: c1, then the retained champion c0 again, then a new c2.
        let minimal:[[Double]]=[[0.2,0.9,0.1],[0.9,0.3,0.2],[0.4,0.1,0.5]],stale:[[Double]]=[[0.5,0.1,0.6],[0.1,0.5,0.6],[0.1,0.4,1]]
        var champion:URL?
        for round in 0..<3 {
            var results:[Candidate]=[]
            for index in 0..<3 {
                let url=try poster(round,index,copying:index==0 ? champion:nil)
                results.append(Candidate(id:"minimal-r\(round)-c\(index)",genome:.random(seed:UInt64(round*10+index)),generation:round,imageURL:url,measurements:metrics,scores:["Minimal":minimal[round][index],"Diversity":stale[round][index]]))
            }
            let winner=["minimal-r0-c1","minimal-r1-c0","minimal-r2-c2"][round]
            if round==0{champion=results[1].imageURL}
            let manifest:[String:Any]=["direction":"Minimal","round":round,"winnerID":winner,"weights":["Minimal":1,"Diversity":3],"judging":["results":try JSONSerialization.jsonObject(with:JSONEncoder().encode(results))]]
            try JSONSerialization.data(withJSONObject:manifest).write(to:direction.appending(path:"round-\(round)/round.json"))
        }
        let roundFiles=try (0..<3).map{try Data(contentsOf:direction.appending(path:"round-\($0)/round.json"))}
        let final=try SourceFinals.make(directionFolder:direction)
        try require(final.finalists.map(\.id)==["minimal-r0-c1","minimal-r2-c2"] && final.finalists.map(\.rounds)==[[0,1],[2]],"A retained champion was counted as a second finalist")
        let digest=LibraryRaster.hash(try Data(contentsOf:final.finalists[0].imageURL))
        try require(final.finalists[0].imageDigest==digest,"Finalist digest does not match its PNG and taste asset ID")
        try require(final.lastRoundWinnerID=="minimal-r2-c2" && final.committeeWinnerID=="minimal-r0-c1" && final.pickedID==nil,"Committee and last-round winners are wrong")
        try require(final.finalists.allSatisfy{$0.votes["Diversity"]==nil},"The final reused round-relative Diversity instead of measuring the finalists")
        let picked=try SourceFinals.pick("minimal-r2-c2",directionFolder:direction),reopened=try SourceFinals.make(directionFolder:direction)
        try require(picked.pickedID=="minimal-r2-c2" && picked.pickedDate != nil && reopened.pickedID=="minimal-r2-c2","The pick was not saved")
        let after=try (0..<3).map{try Data(contentsOf:direction.appending(path:"round-\($0)/round.json"))}
        try require(after==roundFiles,"Picking changed a saved round")
        try require(rejected{try SourceFinals.pick("minimal-r1-c1",directionFolder:direction)},"A non-finalist was accepted as a pick")
        try SourceFinals.pick(nil,directionFolder:direction)
        let cleared=try SourceFinals.make(directionFolder:direction)
        try require(cleared.pickedID==nil,"Clearing the pick did not persist")
        try SourceFinals.pick("minimal-r2-c2",directionFolder:direction)
        try PosterRenderer.png(StylePosterRenderer.render(style:"minimal",seed:999,width:240),to:direction.appending(path:"round-2/minimal-r2-c2.png"))
        let replaced=try SourceFinals.make(directionFolder:direction)
        try require(replaced.pickedID==nil,"A pick survived its poster being replaced")
        print("PASS: source finalists, retained-champion dedupe, finalist Diversity, blind pick persistence, stale-pick rejection and untouched rounds")
    }
}
