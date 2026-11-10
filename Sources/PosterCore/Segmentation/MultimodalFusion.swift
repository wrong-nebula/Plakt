import Foundation

public struct RegionSearchHit: Codable, Sendable, Identifiable {
    public let id: String
    public let posterID: String
    public let imageURL: URL
    public let text: String
    public let rankFusionScore: Double
    public let ranks: [String: Int]
    public let visionDistance: Double?
    public let siglipAffinity: Double?
    public let geometryDistance: Double?
}

/// Weighted reciprocal-rank fusion keeps incompatible raw feature scales separate.
public enum MultimodalFusion {
    public static func search(regions: [RegionAnalysis], textVector: [Float]?, anchor: RegionAnalysis?, limit: Int = 20) throws -> [RegionSearchHit] {
        guard (1...200).contains(limit), textVector != nil || anchor != nil else { throw PosterError.invalid("Choose a text query or a region to compare.") }
        guard Set(regions.map(\.id)).count == regions.count else { throw PosterError.invalid("Duplicate region IDs in retrieval input.") }
        let semantic = try textVector ?? anchor?.siglip.values()
        var values: [(region: RegionAnalysis, vision: Double?, semantic: Double?, geometry: Double?)] = []
        for region in regions where region.id != anchor?.id {
            if let anchor {
                guard anchor.siglip.model == region.siglip.model, anchor.siglip.revision == region.siglip.revision,
                      anchor.siglip.preprocessing == region.siglip.preprocessing, anchor.siglip.dimensions == region.siglip.dimensions else {
                    throw PosterError.invalid("Region semantic feature spaces differ; refresh their analysis before comparing.")
                }
            }
            let distance = try anchor.map { try $0.vision.distance(to: region.vision) }
            let affinity = try semantic.map { RegionSemanticTagger.cosine($0, try region.siglip.values()) }
            values.append((region, distance, affinity, anchor.map { $0.geometry.distance(to: region.geometry) }))
        }
        var ranks: [String: [String: Int]] = [:]
        func rank(_ signal: String, _ sorted: [(region: RegionAnalysis, vision: Double?, semantic: Double?, geometry: Double?)]) {
            for (index, value) in sorted.enumerated() { ranks[value.region.id, default: [:]][signal] = index + 1 }
        }
        if semantic != nil { rank("SigLIP", values.sorted { $0.semantic == $1.semantic ? $0.region.id < $1.region.id : $0.semantic! > $1.semantic! }) }
        if anchor != nil {
            rank("Vision", values.sorted { $0.vision == $1.vision ? $0.region.id < $1.region.id : $0.vision! < $1.vision! })
            rank("Mask geometry", values.sorted { $0.geometry == $1.geometry ? $0.region.id < $1.region.id : $0.geometry! < $1.geometry! })
        }
        let weights = ["SigLIP": 1.0, "Vision": 1.0, "Mask geometry": 0.7]
        let hits: [RegionSearchHit] = values.map { value -> RegionSearchHit in
            let positions = ranks[value.region.id] ?? [:]
            // Fixed summation order: dictionary order varies per process and changed the last bits of scores.
            let score = positions.keys.sorted().reduce(0.0) { $0 + (weights[$1] ?? 0) / Double(60 + positions[$1]!) }
            return RegionSearchHit(id: value.region.id, posterID: value.region.posterID, imageURL: value.region.cutoutURL,
                text: value.region.text, rankFusionScore: score, ranks: positions, visionDistance: value.vision,
                siglipAffinity: value.semantic, geometryDistance: value.geometry)
        }
        let ordered = hits.sorted { a, b in
            if a.rankFusionScore == b.rankFusionScore { return a.id < b.id }
            return a.rankFusionScore > b.rankFusionScore
        }
        return Array(ordered.prefix(limit))
    }
}
