import Foundation

public struct SourceFinalist:Codable,Identifiable,Sendable {
    /// Candidate ID from the first round this poster won.
    public var id:String;public var rounds:[Int];public var imageURL:URL
    /// PNG digest; also the poster's taste-deck asset ID.
    public var imageDigest:String
    public var committeeRank:Int;public var consensus:Double;public var votes:[String:Double]
}
public struct SourceFinal:Codable,Sendable {
    public var direction:String;public var category:String;public var finalists:[SourceFinalist]
    public var lastRoundWinnerID:String;public var committeeWinnerID:String
    public var pickedID:String? = nil;public var pickedDate:Date? = nil
    public var weights:[String:Double]
    public var note="Distinct round winners of one direction. The committee order re-ranks them together with the study's own weights, with Diversity measured among the finalists. It does not choose: the pick is yours, and picking records a yes taste vote in the app."
    public var pickedFinalist:SourceFinalist?{finalists.first{$0.id==pickedID}}
}

/// Finalists come from saved rounds, so every existing source study can be judged again without re-running it.
public enum SourceFinals {
    struct StoredRound:Decodable {
        struct Judging:Decodable{var results:[Candidate]}
        var direction:String;var round:Int;var judging:Judging;var winnerID:String;var weights:[String:Double]
    }
    public static func make(directionFolder folder:URL)throws->SourceFinal {
        var rounds:[StoredRound]=[]
        while let data=FileManager.default.contents(atPath:folder.appending(path:"round-\(rounds.count)/round.json").path) {rounds.append(try JSONDecoder().decode(StoredRound.self,from:data))}
        guard let last=rounds.last else{throw PosterError.invalid("No saved rounds in \(folder.lastPathComponent).")}
        var finalists:[SourceFinalist]=[],entrants:[Candidate]=[],prints:[VisualEmbedding?]=[]
        for round in rounds {
            guard let winner=round.judging.results.first(where:{$0.id==round.winnerID}) else{throw PosterError.invalid("Round \(round.round+1) has no judged winner.")}
            let digest=LibraryRaster.hash(try Data(contentsOf:winner.imageURL))
            // A retained champion that wins again is the same poster under a new ID.
            if let i=finalists.firstIndex(where:{$0.imageDigest==digest}){finalists[i].rounds.append(round.round);continue}
            finalists.append(SourceFinalist(id:winner.id,rounds:[round.round],imageURL:winner.imageURL,imageDigest:digest,committeeRank:1,consensus:100,votes:[:]))
            entrants.append(winner)
            prints.append((try? Data(contentsOf:folder.appending(path:"round-\(round.round)/\(winner.id)-embedding.json"))).flatMap{try? JSONDecoder().decode(VisualEmbedding.self,from:$0)})
        }
        let embeddings=prints.compactMap{$0}
        for i in entrants.indices {
            entrants[i].scores["Diversity"]=nil
            guard embeddings.count==entrants.count,entrants.count>1 else{continue}
            let nearest=try embeddings.indices.filter{$0 != i}.map{try embeddings[i].distance(to:embeddings[$0])}.min()!
            entrants[i].scores["Diversity"]=min(1,nearest/0.8)
        }
        if entrants.count>1 {
            for candidate in Voting.rank(entrants,weights:last.weights) {
                let i=finalists.firstIndex{$0.id==candidate.id}!
                finalists[i].committeeRank=candidate.rank;finalists[i].consensus=candidate.consensus;finalists[i].votes=candidate.votes
            }
        }
        let lastDigest=LibraryRaster.hash(try Data(contentsOf:last.judging.results.first{$0.id==last.winnerID}!.imageURL))
        var result=SourceFinal(direction:last.direction,category:folder.lastPathComponent,finalists:finalists,lastRoundWinnerID:finalists.first{$0.imageDigest==lastDigest}!.id,committeeWinnerID:finalists.min{$0.committeeRank<$1.committeeRank}!.id,weights:last.weights)
        if let data=FileManager.default.contents(atPath:folder.appending(path:"final.json").path),let saved=try? JSONDecoder().decode(SourceFinal.self,from:data),let id=saved.pickedID,let picked=saved.pickedFinalist,let current=finalists.first(where:{$0.id==id}),current.imageDigest==picked.imageDigest {
            result.pickedID=id;result.pickedDate=saved.pickedDate
        }
        return result
    }
    /// Records the pick in final.json. Passing nil clears it. Round files and winner exports are never changed.
    @discardableResult public static func pick(_ id:String?,directionFolder folder:URL)throws->SourceFinal {
        var result=try make(directionFolder:folder)
        if let id{guard result.finalists.contains(where:{$0.id==id}) else{throw PosterError.invalid("\(id) is not a finalist of \(result.direction).")}}
        result.pickedID=id;result.pickedDate=id==nil ? nil:Date()
        try LibraryRaster.write(result,to:folder.appending(path:"final.json"))
        return result
    }
}
