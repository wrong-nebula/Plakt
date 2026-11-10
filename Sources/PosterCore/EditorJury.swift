import Foundation

/// One judged variation: its place in the vote and the weighted consensus behind it.
public struct EditorVerdict: Sendable {
    public let index: Int
    public let rank: Int
    public let consensus: Double
}

extension EvolutionEngine {
    /// Ranks rendered variations of one poster the way studies rank candidates: image judges,
    /// the geometry judges on each scene, and the personal taste jurors, by weighted Borda vote.
    public func rankVariations(_ variations: [(image: URL, scene: StyleGenome)], tasteDirectory: URL? = nil) throws -> [EditorVerdict] {
        let samples = variations.enumerated().map { ExternalSample(id: "v\($0.offset)", backend: "editor-tweak", seed: UInt64($0.offset), generation: 0, imageURL: $0.element.image, parameters: ["repetition": 0.4]) }
        let taste = try TasteJudgeBank(directory: tasteDirectory)
        var weights: [String: Double] = ["Composition": 1, "Typography": 0.8, "Rhythm": 0.6, "Legibility": 1.5, "Hierarchy": 1, "Spacing": 1, "Type integrity": 1,
                                         "Margins": 0.6, "Optical balance": 0.6, "Alignment": 0.4, "Copy completeness": 1, "Negative space": 0.5]
        weights.merge(taste.weights) { old, _ in old }
        var judged = try judgeExternal(samples, weights: weights)
        for i in judged.results.indices {
            guard let n = Int(judged.results[i].id.dropFirst()), variations.indices.contains(n) else { continue }
            let scene = variations[n].scene
            judged.results[i].scores.merge(CompositionJudges.evaluate(scene, measurements: judged.results[i].measurements, copy: scene.posterCopy ?? PosterCopy(), style: scene.styleCategory)) { _, new in new }
            judged.results[i].scores.merge(try taste.scores(PosterRenderer.load(variations[n].image))) { _, new in new }
        }
        return Voting.rank(judged.results, weights: weights).compactMap { result in
            Int(result.id.dropFirst()).map { EditorVerdict(index: $0, rank: result.rank, consensus: result.consensus) }
        }
    }
}
