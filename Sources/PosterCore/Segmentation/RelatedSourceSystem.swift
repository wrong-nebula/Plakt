import Foundation

public struct RelatedSourceSystem: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let scope: String
    public let operation: String
    public let sourcePosterID: String
    public let visionDistance: Double
    public let siglipAffinity: Double
    public let rankFusionScore: Double
}

final class SourceSystemMatcher {
    private struct Reference {
        let id: String; let name: String; let scope: String; let operation: String; let source: String
        let vision: VisualEmbedding; let siglip: [Float]
        let visionValues: [Float]
    }
    private let references: [Reference]

    init(encoder: SigLIPEncoder) throws {
        let bank = TypeSystemLibrary.shared
        var loaded: [Reference] = []
        if let index = bank.semanticIndex, index.model.fingerprint == encoder.manifest.fingerprint {
            let profiles = Dictionary(uniqueKeysWithValues: index.profiles.map { ($0.id, $0) })
            for system in bank.distinctSystems {
                if let vision = system.sourceEmbedding, let profile = profiles[system.id] {
                    loaded.append(Reference(id: system.id, name: system.name, scope: "type", operation: system.operation,
                        source: system.sourcePosterID, vision: vision, siglip: try profile.source.values(), visionValues: try vision.values()))
                }
            }
        }
        let visual = LibraryVisualEmbedder()
        for system in ShapeSystemLibrary.systems {
            guard let image = try? LibraryRaster.oriented(system.sourceImageURL), let crop = try? LibraryRaster.crop(image, system.sourceBounds) else { continue }
            let vision = try visual.embed(crop)
            loaded.append(Reference(id: system.id, name: system.name, scope: "shape", operation: system.operation,
                source: system.sourcePosterID, vision: vision, siglip: try encoder.image(crop), visionValues: try vision.values()))
        }
        references = loaded
    }

    func related(vision: VisualEmbedding, context: [Float]) throws -> [RelatedSourceSystem] {
        var result: [RelatedSourceSystem] = []
        let values = try vision.values()
        func distance(_ reference: Reference) throws -> Double {
            guard reference.vision.model == vision.model, reference.vision.revision == vision.revision,
                  reference.vision.preprocessing == vision.preprocessing, reference.visionValues.count == values.count else {
                throw PosterError.invalid("Reference and region Vision feature spaces differ.")
            }
            var sum = 0.0
            for index in values.indices { let difference = Double(values[index] - reference.visionValues[index]); sum += difference * difference }
            return sqrt(sum)
        }
        for scope in ["type", "shape"] {
            let candidates = try references.filter { $0.scope == scope }.map { reference in
                (reference: reference, distance: try distance(reference), affinity: RegionSemanticTagger.cosine(context, reference.siglip))
            }
            let appearance = candidates.sorted { $0.distance == $1.distance ? $0.reference.id < $1.reference.id : $0.distance < $1.distance }
            let semantics = candidates.sorted { $0.affinity == $1.affinity ? $0.reference.id < $1.reference.id : $0.affinity > $1.affinity }
            let a = Dictionary(uniqueKeysWithValues: appearance.enumerated().map { ($0.element.reference.id, $0.offset + 1) })
            let b = Dictionary(uniqueKeysWithValues: semantics.enumerated().map { ($0.element.reference.id, $0.offset + 1) })
            let scored: [RelatedSourceSystem] = candidates.map { value in
                let score = 1 / Double(60 + (a[value.reference.id] ?? 1)) + 1 / Double(60 + (b[value.reference.id] ?? 1))
                return RelatedSourceSystem(id: value.reference.id, name: value.reference.name, scope: scope,
                    operation: value.reference.operation, sourcePosterID: value.reference.source, visionDistance: value.distance,
                    siglipAffinity: value.affinity, rankFusionScore: score)
            }
            let sorted = scored.sorted { $0.rankFusionScore == $1.rankFusionScore ? $0.id < $1.id : $0.rankFusionScore > $1.rankFusionScore }
            result += sorted.prefix(3)
        }
        return result
    }
}
