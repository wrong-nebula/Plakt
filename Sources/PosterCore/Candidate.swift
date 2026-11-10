import Foundation

public struct RecognizedLine:Codable,Sendable {
    public var text:String;public var confidence:Double;public var bounds:UnitBox
    public init(text:String,confidence:Double,bounds:UnitBox){self.text=text;self.confidence=confidence;self.bounds=bounds}
}

public struct Measurements: Codable, Sendable {
    public var coverage: Double
    public var detail: Double
    public var balance: Double
    public var contrast: Double
    public var readability: Double
    public var reference: Double
    public var hierarchy: Double
    public var repetition: Double
    public var recognizedWords: Int
    public var featureDistance: Double?
    public var recognizedText: String? = nil
    public var recognizedLines:[RecognizedLine]? = nil
    public init(coverage: Double, detail: Double, balance: Double, contrast: Double, readability: Double,
                reference: Double, hierarchy: Double, repetition: Double, recognizedWords: Int, featureDistance: Double? = nil, recognizedText:String? = nil,recognizedLines:[RecognizedLine]? = nil) {
        self.coverage = coverage; self.detail = detail; self.balance = balance; self.contrast = contrast
        self.readability = readability; self.reference = reference; self.hierarchy = hierarchy
        self.repetition = repetition; self.recognizedWords = recognizedWords; self.featureDistance = featureDistance;self.recognizedText=recognizedText;self.recognizedLines=recognizedLines
    }
    public var vector: [Double] { [coverage, detail, balance, contrast, readability, reference, hierarchy, repetition] }
}

public struct Candidate: Codable, Identifiable, Sendable {
    public var id: String
    public var genome: Genome
    public var generation: Int
    public var parentID: String?
    public var imageURL: URL
    public var measurements: Measurements
    public var scores: [String: Double]
    public var processURLs: [URL]?
    public var votes: [String: Double] = [:]
    public var consensus: Double = 0
    public var rank: Int = 0
    public init(id: String, genome: Genome, generation: Int, parentID: String? = nil, imageURL: URL,
                measurements: Measurements, scores: [String: Double]) {
        self.id = id; self.genome = genome; self.generation = generation; self.parentID = parentID
        self.imageURL = imageURL; self.processURLs = nil; self.measurements = measurements; self.scores = scores
    }
}

public struct Generation: Codable, Sendable {
    public var number: Int
    public var candidates: [Candidate]
    public var copy: PosterCopy
    public var notes: [String]
    public var appleCritique: String?
    public var selectedParents: [String]
    public var compute: String
    public var model: String
    public var referenceURL: URL
    public var cropReference: Bool
    public var settings: EvolutionSettings
    public var directory: URL
    public var personalJury:[TasteJuryMember]? = nil
}

public struct EvolutionSettings: Codable, Sendable {
    public var seed: UInt64 = 2026
    public var count: Int = 12
    public var mutation: Double = 0.25
    public var width: Int = 900
    public var useAppleIntelligence: Bool = false
    public var judgeWeights: [String:Double]? = nil
    public var styleModelsURL: URL? = nil
    public var tasteDirectory: URL? = nil
    public init() {}
    public func validate() throws {
        if let weights=judgeWeights {guard weights.allSatisfy({StyleCatalog.allJudges.contains($0.key) || $0.key=="Apple Intelligence" || TasteTrainer.isJudge($0.key)}),weights.values.allSatisfy({$0.isFinite && (0...10).contains($0)}),weights.values.contains(where:{$0>0}) else{throw PosterError.invalid("Judge weights must use known judges, be 0–10, and leave at least one enabled.")}}
        guard (4...32).contains(count) else { throw PosterError.invalid("Batch size must be 4–32.") }
        guard (0.05...0.8).contains(mutation), mutation.isFinite else { throw PosterError.invalid("Mutation must be 0.05–0.8.") }
        guard (300...2400).contains(width) else { throw PosterError.invalid("Batch width must be 300–2400. Export winners at larger sizes.") }
    }
}

public enum Voting {
    /// Equal-weight Borda ballots. Ties share the average rank. Stable seed ordering resolves a final tie.
    /// Scores within `tolerance` tie. Wider margins were tested against taste votes and lowered agreement, so the default stays exact.
    public static func rank(_ candidates: [Candidate], weights:[String:Double]? = nil, tolerance:Double = 1e-9) -> [Candidate] {
        guard candidates.count > 1 else { return candidates }
        let judges = candidates.map { Set($0.scores.keys) }.reduce(Set<String>()) { $0.union($1) }.sorted()
        let tolerance = max(1e-9, tolerance.isFinite ? tolerance : 1e-9)
        var result = candidates
        for i in result.indices { result[i].votes = [:] }
        for judge in judges {
            // A failed/missing judge casts no ballot for this batch.
            let weight=weights?[judge] ?? (weights==nil ? 1:0)
            guard weight>0 else{continue}
            guard result.allSatisfy({ $0.scores[judge]?.isFinite == true }) else { continue }
            // A flat judge separates nobody; its ballot would only pull every consensus toward 50.
            let values = result.map { $0.scores[judge]! }
            guard values.max()! - values.min()! > tolerance else { continue }
            for i in result.indices {
                let score = result[i].scores[judge] ?? 0
                let worse = result.filter { ($0.scores[judge] ?? 0) < score - tolerance }.count
                let equal = result.filter { abs(($0.scores[judge] ?? 0) - score) <= tolerance }.count
                result[i].votes[judge] = (Double(worse) + Double(equal - 1) / 2) / Double(result.count - 1)
            }
        }
        for i in result.indices {
            let ballots = result[i].votes
            let total=ballots.keys.reduce(0.0){$0+(weights?[$1] ?? 1)}
            result[i].consensus = total==0 ? 0 : 100 * ballots.reduce(0.0){$0+$1.value*(weights?[$1.key] ?? 1)} / total
        }
        result.sort { abs($0.consensus - $1.consensus) > 1e-9 ? $0.consensus > $1.consensus : $0.genome.seed < $1.genome.seed }
        for i in result.indices { result[i].rank = i + 1 }
        return result
    }
}
