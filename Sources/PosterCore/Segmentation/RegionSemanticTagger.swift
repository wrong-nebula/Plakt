import Foundation

/// Contrastive descriptions provide evidence, never probabilities or reviewed training labels.
final class RegionSemanticTagger {
    private struct Prompt {
        let tag: String
        let positive: [Float]
        let contrast: [Float]
    }
    private let prompts: [Prompt]

    init(encoder: SigLIPEncoder) throws {
        let descriptions: [(String, String, String)] = [
            ("geometric-shapes", "abstract geometric shapes", "a landscape photograph"),
            ("shape-replication", "many repeated copies of the same abstract shape", "one single abstract shape"),
            ("text-duplication", "the same word repeated in a pattern", "a single line of text"),
            ("grid", "a regular grid of repeated shapes", "scattered irregularly placed shapes"),
            ("modular-tiles", "a repeating pattern of geometric tiles", "an unstructured painted surface"),
            ("bilateral-symmetry", "a symmetrical abstract shape reflected left and right", "an asymmetrical abstract shape"),
            ("reflection", "lettering repeated upside down as a reflected mirror image", "one line of upright lettering"),
            ("radial-symmetry", "a circular radial arrangement of repeated shapes", "a horizontal row of shapes"),
            ("concentric-shapes", "concentric rings with a shared center", "circles scattered at different positions"),
            ("perforated-shapes", "a shape containing many circular holes", "a solid shape without holes"),
            ("circular-text", "letters arranged around a circle", "letters on a straight horizontal baseline"),
            ("radial-type", "individual letters radiating around a center", "a rectangular paragraph of text"),
            ("text-on-path", "words arranged along a curved path", "words on straight horizontal lines"),
            ("outline-text", "outlined hollow letters", "solid filled letters"),
            ("halftone", "a geometric form shaded with halftone dots", "a geometric form filled with one flat color"),
            ("gradient", "a smooth color gradient", "flat solid colors with hard edges"),
            ("overlap", "several overlapping abstract shapes", "separate shapes that do not touch"),
            ("offset-replication", "offset copies forming a trail", "one isolated shape"),
            ("scale-ramp", "a sequence of shapes growing progressively larger", "shapes all exactly the same size"),
            ("curved-line-field", "a field of parallel curved lines", "a solid filled rectangle")
        ]
        prompts = try descriptions.map { tag, positive, contrast in
            Prompt(tag: tag, positive: try encoder.text("a graphic design poster with " + positive),
                   contrast: try encoder.text("a graphic design poster with " + contrast))
        }
    }

    func tags(vector: [Float], geometry: RegionGeometry?, rejected: Set<String>) -> [RegionTagEvidence] {
        var output: [RegionTagEvidence] = []
        for prompt in prompts where !rejected.contains(prompt.tag) {
            let affinity = Self.cosine(vector, prompt.positive), margin = affinity - Self.cosine(vector, prompt.contrast)
            guard affinity >= -0.05, margin >= 0.025 else { continue }
            let measured: [String]
            if let geometry {
                if ["text-duplication", "circular-text", "radial-type", "text-on-path", "outline-text"].contains(prompt.tag) && geometry.ocrCoverage < 0.45 { continue }
                guard let support = RegionRelationships.evidence(prompt.tag, geometry: geometry) else { continue }
                measured = support
            } else {
                // Geometric labels require an isolated mask, rather than the entire photographed surface.
                guard ["outline-text", "gradient", "text-on-path"].contains(prompt.tag) else { continue }
                measured = []
            }
            output.append(RegionTagEvidence(tag: prompt.tag, affinity: affinity, contrastMargin: margin,
                geometrySupport: measured, explanation: "SigLIP cosine \(affinity); descriptive contrast margin \(margin). Uncalibrated suggestion; not a verified technique label."))
        }
        return Array(output.sorted { $0.contrastMargin == $1.contrastMargin ? $0.tag < $1.tag : $0.contrastMargin > $1.contrastMargin }.prefix(8))
    }

    static func cosine(_ lhs: [Float], _ rhs: [Float]) -> Double {
        guard lhs.count == rhs.count, !lhs.isEmpty else { return -1 }
        return min(1, max(-1, zip(lhs, rhs).reduce(0.0) { $0 + Double($1.0) * Double($1.1) }))
    }

    static func embedding(_ values: [Float], manifest: SigLIPManifest) -> VisualEmbedding {
        var data = Data()
        for value in values { var word = value.bitPattern.littleEndian; withUnsafeBytes(of: &word) { data.append(contentsOf: $0) } }
        return VisualEmbedding(model: manifest.model, revision: 1, dimensions: values.count, scalar: "float32-le", data: data,
                               preprocessing: manifest.preprocessing + "/" + manifest.fingerprint)
    }
}
