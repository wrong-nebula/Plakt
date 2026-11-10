import Foundation
import PosterCore

extension PosterChecks {
    /// The jury surrogate is a bundled tree model evaluated in Swift. This checks that it loads, that scoring is
    /// repeatable and reacts to the genome and the direction, and that scores for fixed genomes have not drifted.
    /// The pinned scores change when the model is retrained (scripts/jury-surrogate); parity with LightGBM itself
    /// is checked with `poster library surrogate-score` against scripts/jury-surrogate/parity.py.
    static func checkJurySurrogate() throws {
        guard let surrogate = JurySurrogate.shared else { throw CheckFailure("The jury surrogate model is not in the resource bundle") }
        try require(!surrogate.version.isEmpty, "The jury surrogate has no version")
        // Two genomes that differ where the model looks: element count, ground and ink contrast.
        let orb = try PosterShapeLibrary.scene(PosterShapePreset(recipe: PosterShapeLibrary.recipe("survey-sliced-orb")!, seed: 817), pairing: true)
        var sparse = orb
        sparse.background = "#101010"; sparse.elements = Array(orb.elements.prefix(1)); sparse.textScale = 0.6
        let genomes: [(String, StyleGenome, String)] = [
            ("sliced orb, Optical", orb, "Optical"),
            ("sparse dark orb, Optical", sparse, "Optical"),
            ("sliced orb, Editorial", orb, "Editorial"),
        ]
        var scores: [Double] = []
        for (name, genome, direction) in genomes {
            let score = try surrogate.score(genome, direction: direction), again = try surrogate.score(genome, direction: direction)
            try require(score.isFinite, "The surrogate score for \(name) is not a number")
            try require(again == score, "The surrogate scored \(name) differently the second time")
            scores.append(score)
        }
        try require(scores[0] != scores[1], "The surrogate gave two different genomes the same score")
        try require(scores[0] != scores[2], "The surrogate ignored the direction")
        // An unknown direction is an unseen category, not an error.
        let unseen = try surrogate.score(orb, direction: "No such direction")
        try require(unseen.isFinite, "An unknown direction broke scoring")
        if surrogate.version == pinnedSurrogateVersion {
            for (i, expected) in pinnedSurrogateScores.enumerated() {
                try require(abs(scores[i] - expected) < 1e-9, "The surrogate score for \(genomes[i].0) drifted: \(scores[i]) instead of \(expected)")
            }
        }
        print("PASS: jury surrogate \(surrogate.version) loads, scores repeatably, reacts to genome and direction" + (surrogate.version == pinnedSurrogateVersion ? ", pinned scores hold" : " (pins are for \(pinnedSurrogateVersion); update them)"))
    }
    private static let pinnedSurrogateVersion = "jury-surrogate-lambdarank-v1"
    private static let pinnedSurrogateScores: [Double] = [-2.66574079228141, -2.437534938073058, -2.6860561432902212]
}
