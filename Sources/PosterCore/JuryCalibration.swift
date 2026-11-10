import Foundation

public struct JudgeAgreement:Codable,Sendable {
    public var judge:String;public var auc:Double;public var standardError:Double
    public var votingRounds:Int;public var flatRounds:Int;public var maximumWeight:Double
}
public struct JuryReplay:Codable,Sendable {
    public var label:String;public var auc:Double;public var standardError:Double
    public var yesWinners:Int;public var noWinners:Int;public var changedWinners:Int
}
public struct JuryCalibration:Codable,Sendable {
    public var profileID:String;public var profileName:String
    public var yes:Int;public var no:Int;public var unmatched:Int;public var rounds:Int;public var tolerance:Double
    public var mix:[String:Double]?
    public var stored:JuryReplay;public var replay:JuryReplay;public var judges:[JudgeAgreement]
    public var note="AUC compares your explicit yes/no votes with each ranking: 0.5 is chance, 1 means every yes outranked every no. Committee AUC uses rank inside each round; judge AUC uses raw scores. Replay re-ranks the stored candidates only, so it cannot show how later rounds would have evolved. Taste jurors trained on these same votes inflate agreement."
}

/// Measures how the stored source-study rankings agree with one taste profile's explicit votes.
public enum JuryCalibrator {
    private struct StoredRound:Decodable {
        struct Judging:Decodable{var results:[Candidate]}
        var direction:String;var round:Int;var judging:Judging;var winnerID:String;var weights:[String:Double]
    }
    /// Mann-Whitney AUC with the Hanley-McNeil standard error. Ties count half.
    public static func auc(yes:[Double],no:[Double])->(auc:Double,standardError:Double)? {
        guard !yes.isEmpty,!no.isEmpty else{return nil}
        let wins=yes.reduce(0.0){total,a in total+no.reduce(0.0){$0+(a>$1 ? 1:a==$1 ? 0.5:0)}}
        let a=wins/Double(yes.count*no.count),q1=a/(2-a),q2=2*a*a/(1+a)
        let variance=(a*(1-a)+Double(yes.count-1)*(q1-a*a)+Double(no.count-1)*(q2-a*a))/Double(yes.count*no.count)
        return(a,sqrt(max(0,variance)))
    }
    public static func calibrate(archive:TasteArchive,profileID:String,mix:[String:Double]?=nil,tolerance:Double=1e-9)throws->JuryCalibration {
        guard let profile=archive.profiles.first(where:{$0.id==profileID}) else{throw PosterError.invalid("Taste profile is missing.")}
        if let mix{guard mix.allSatisfy({(StyleCatalog.allJudges.contains($0.key) || TasteTrainer.isJudge($0.key) || $0.key=="Apple Intelligence") && $0.value.isFinite && (0...10).contains($0.value)}) else{throw PosterError.invalid("Calibration mix must use known judges with weights 0–10.")}}
        guard tolerance.isFinite,(0...0.5).contains(tolerance) else{throw PosterError.invalid("Tie tolerance must be 0–0.5.")}
        let assets=Dictionary(archive.assets.map{($0.id,$0)},uniquingKeysWith:{first,_ in first})
        var rounds:[String:StoredRound]=[:],unreadable:Set<String>=[]
        var rows:[(yes:Bool,round:String,id:String)]=[],unmatched=0
        for (assetID,vote) in profile.votes.sorted(by:{$0.key<$1.key}) {
            guard let asset=assets[assetID] else{unmatched+=1;continue}
            let path=asset.sourceImageURL.deletingLastPathComponent().appending(path:"round.json").standardizedFileURL.path
            if rounds[path]==nil && !unreadable.contains(path) {
                if let data=FileManager.default.contents(atPath:path),let round=try? JSONDecoder().decode(StoredRound.self,from:data),round.judging.results.count>1{rounds[path]=round}else{unreadable.insert(path)}
            }
            guard let round=rounds[path],round.judging.results.contains(where:{$0.id==asset.candidateID}) else{unmatched+=1;continue}
            rows.append((vote.yes,path,asset.candidateID))
        }
        guard rows.contains(where:{$0.yes}),rows.contains(where:{!$0.yes}) else{throw PosterError.invalid("Calibration needs at least one yes and one no vote on posters whose round.json is still on disk.")}
        let voted=Set(rows.map{$0.round})
        func weights(_ round:StoredRound)->[String:Double]{round.weights.merging(mix ?? [:]){_,new in new}}
        var replayed:[String:[Candidate]]=[:]
        for path in voted{replayed[path]=Voting.rank(rounds[path]!.judging.results,weights:weights(rounds[path]!),tolerance:tolerance)}
        let changed=voted.filter{replayed[$0]!.first!.id != rounds[$0]!.winnerID}.count
        func summary(_ label:String,changed:Int,_ ranking:(String)->[Candidate])->JuryReplay {
            var yes:[Double]=[],no:[Double]=[],yesWinners=0,noWinners=0
            for row in rows {
                let ranked=ranking(row.round),rank=ranked.first{$0.id==row.id}!.rank
                let place=1-Double(rank-1)/Double(ranked.count-1)
                if row.yes{yes.append(place);if rank==1{yesWinners+=1}}else{no.append(place);if rank==1{noWinners+=1}}
            }
            let result=auc(yes:yes,no:no)!
            return JuryReplay(label:label,auc:result.auc,standardError:result.standardError,yesWinners:yesWinners,noWinners:noWinners,changedWinners:changed)
        }
        let stored=summary("Stored rankings",changed:0){path in rounds[path]!.judging.results}
        let replay=summary(mix==nil ? "Replay with stored weights":"Replay with mix",changed:changed){replayed[$0]!}
        var judges:[JudgeAgreement]=[]
        let names=Set(rows.flatMap{row in rounds[row.round]!.judging.results.first{$0.id==row.id}!.scores.keys})
        for judge in names.sorted() {
            var yes:[Double]=[],no:[Double]=[]
            for row in rows{if let score=rounds[row.round]!.judging.results.first(where:{$0.id==row.id})?.scores[judge]{if row.yes{yes.append(score)}else{no.append(score)}}}
            guard let agreement=auc(yes:yes,no:no) else{continue}
            var votingRounds=0,flatRounds=0,maximum=0.0
            for path in voted {
                let round=rounds[path]!,weight=weights(round)[judge] ?? 0
                guard weight>0,round.judging.results.allSatisfy({$0.scores[judge]?.isFinite==true}) else{continue}
                let values=round.judging.results.map{$0.scores[judge]!}
                votingRounds+=1;maximum=max(maximum,weight)
                if values.max()! - values.min()! <= max(1e-9,tolerance){flatRounds+=1}
            }
            judges.append(JudgeAgreement(judge:judge,auc:agreement.auc,standardError:agreement.standardError,votingRounds:votingRounds,flatRounds:flatRounds,maximumWeight:maximum))
        }
        judges.sort{$0.auc==$1.auc ? $0.judge<$1.judge:$0.auc>$1.auc}
        return JuryCalibration(profileID:profile.id,profileName:profile.name,yes:rows.filter{$0.yes}.count,no:rows.filter{!$0.yes}.count,unmatched:unmatched,rounds:voted.count,tolerance:tolerance,mix:mix,stored:stored,replay:replay,judges:judges)
    }
}
