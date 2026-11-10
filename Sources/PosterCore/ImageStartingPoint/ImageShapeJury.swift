import Foundation

/// Per-juror proposal preferences. Priors are authored; updates use that juror's
/// actual scores in this run, without changing any trained model or taste vote.
public struct ImageShapeJurorPreference:Codable,Sendable {
    public var judge:String
    public var probability:Double
    public var preferredWidth:Double
    public var evidenceRounds:Int
    public var basis:String
}
public enum ImageShapeJury {
    public static func initial(weights:[String:Double])->[ImageShapeJurorPreference] {
        weights.keys.sorted().filter{(weights[$0] ?? 0)>0}.map {name in
            let lower=name.lowercased(),probability:Double
            if ["minimal","editorial","spacing","legibility","image breathing"].contains(where:{lower.contains($0)}){probability=0.12}
            else if ["abstract","bauhaus","color field","color-field","optical","constructiv"].contains(where:{lower.contains($0)}){probability=0.48}
            else{probability=0.25}
            return .init(judge:name,probability:probability,preferredWidth:lower.contains("minimal") ? 0.96:0.86,evidenceRounds:0,basis:"Authored starting proposal prior; not a trained preference label. Updated only from non-flat, shape/no-shape comparisons scored by this juror.")
        }
    }
    public static func mixture(_ preferences:[ImageShapeJurorPreference],weights:[String:Double])->(probability:Double,width:Double) {
        let total=preferences.reduce(0.0){$0+max(0,weights[$1.judge] ?? 0)}
        guard total>0 else{return(0.25,0.86)}
        let probability=preferences.reduce(0.0){$0+$1.probability*max(0,weights[$1.judge] ?? 0)}/total
        let width=preferences.reduce(0.0){$0+$1.preferredWidth*max(0,weights[$1.judge] ?? 0)}/total
        return(max(0.08,min(0.70,probability)),max(0.60,min(1.3,width)))
    }
    public static func update(_ prior:[ImageShapeJurorPreference],candidates:[ImagePosterCandidate],results:[Candidate])->[ImageShapeJurorPreference] {
        let byID=Dictionary(uniqueKeysWithValues:candidates.map{($0.id,$0)})
        func shapeWidth(_ result:Candidate)->Double?{byID[result.id]?.genome.elements.filter{PosterShapeLibrary.recipeID($0) != nil}.map(\.bounds.width).max()}
        guard results.contains(where:{shapeWidth($0) != nil}),results.contains(where:{shapeWidth($0)==nil}) else{return prior}
        return prior.map {juror in
            let scored=results.filter{$0.scores[juror.judge] != nil}.sorted {a,b in
                let x=a.scores[juror.judge]!,y=b.scores[juror.judge]!
                return x==y ? a.id<b.id:x>y
            }
            guard let top=scored.first?.scores[juror.judge],let bottom=scored.last?.scores[juror.judge],top-bottom>0.015 else{return juror}
            let selected=Array(scored.prefix(max(2,scored.count/3)))
            let liked=Double(selected.filter{shapeWidth($0) != nil}.count)/Double(selected.count)
            var next=juror
            let rate=1/Double(min(10,juror.evidenceRounds+4))
            next.probability=max(0.05,min(0.75,juror.probability*(1-rate)+liked*rate))
            let widths=selected.compactMap{shapeWidth($0)}
            if !widths.isEmpty {let preferred=widths.reduce(0,+)/Double(widths.count);next.preferredWidth=max(0.60,min(1.3,juror.preferredWidth*(1-rate)+preferred*rate))}
            next.evidenceRounds+=1
            next.basis="Run-specific preference inferred from this juror's top-third actual scores. Image, type and shape variables co-vary; this is an adaptive proposal heuristic, not causal learning or a retrained model."
            return next
        }
    }
}

public extension ImageShapeJury {
    static func updateMatched(_ prior:[ImageShapeJurorPreference],candidates:[ImagePosterCandidate],results:[Candidate])->[ImageShapeJurorPreference] {
        let groups=Dictionary(grouping:candidates.filter{$0.matchedGroup != nil},by:{$0.matchedGroup!})
        let scores=Dictionary(uniqueKeysWithValues:results.map{($0.id,$0.scores)})
        return prior.map {juror in
            var next=juror
            for group in groups.keys.sorted() {
                let members=groups[group]!,none=members.first{$0.control=="none"},large=members.first{$0.control=="large"}
                guard let none,let large,let a=scores[none.id]?[juror.judge],let b=scores[large.id]?[juror.judge],abs(a-b)>0.015 else{continue}
                let rate=1/Double(min(14,next.evidenceRounds+5))
                next.probability=max(0.05,min(0.75,next.probability*(1-rate)+(b>a ? 0.9:0.1)*rate));next.evidenceRounds+=1
                if let zoom=members.first(where:{$0.control=="zoom"}),let z=scores[zoom.id]?[juror.judge],abs(z-b)>0.015 {
                    let preferred=(z>b ? zoom:large).genome.elements.filter{PosterShapeLibrary.recipeID($0) != nil}.map(\.bounds.width).max() ?? next.preferredWidth
                    next.preferredWidth=max(0.60,min(1.3,next.preferredWidth*(1-rate)+preferred*rate))
                }
                next.basis="Matched comparisons only: identical image, crop, colors, type and layout. Presence compares none against large; size compares large against a centered zoom of the same shape. Flat comparisons add no evidence. Trained model weights remain unchanged."
            }
            return next
        }
    }
}
