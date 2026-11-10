import Foundation

enum CrossRegionRelationships {
    static let revision = "cross-region-agreement-v1"

    static func candidates(_ regions: [RegionAnalysis], posterID: String) -> ([RegionSystemCandidate], [RegionTagEvidence]) {
        func normalized(_ text: String) -> String { text.precomposedStringWithCanonicalMapping.lowercased().filter { $0.isLetter || $0.isNumber } }
        func compatible(_ a: RegionAnalysis, _ b: RegionAnalysis) -> Bool {
            guard a.siglip.model == b.siglip.model, a.siglip.revision == b.siglip.revision,
                  a.siglip.preprocessing == b.siglip.preprocessing, a.bounds.overlap(b.bounds) < 0.2, let distance = try? a.vision.distance(to: b.vision),
                  let av = try? a.siglip.values(), let bv = try? b.siglip.values() else { return false }
            let cosine = RegionSemanticTagger.cosine(av, bv), shape = a.geometry.distance(to: b.geometry)
            let copy = normalized(a.text)
            let sameText = copy.count >= 3 && copy == normalized(b.text)
            return sameText ? (distance < 0.75 && cosine > 0.75 && shape < 0.45) :
                (distance < 0.45 && cosine > 0.93 && shape < 0.32)
        }
        var systems: [RegionSystemCandidate] = [], tags: [RegionTagEvidence] = []
        for scope in ["type", "shape"] {
            let eligible = regions.filter { ($0.geometry.ocrCoverage >= 0.45 ? "type" : "shape") == scope }
                .sorted { $0.bounds.y == $1.bounds.y ? $0.bounds.x < $1.bounds.x : $0.bounds.y < $1.bounds.y }
            var used = Set<String>()
            for seed in eligible where !used.contains(seed.id) {
                var group = [seed]
                for other in eligible where other.id != seed.id && !used.contains(other.id) {
                    if group.allSatisfy({ compatible($0, other) }) { group.append(other) }
                }
                let copies = group.map { normalized($0.text) }
                let sameCopy = copies.count >= 2 && copies[0].count >= 3 && Set(copies).count == 1
                guard group.count >= 3 || (scope == "type" && group.count == 2 && sameCopy) else { continue }
                group.forEach { used.insert($0.id) }
                var affinities: [Double] = [], distances: [Double] = [], shapes: [Double] = []
                for i in group.indices { for j in group.indices where j > i {
                    if let a = try? group[i].siglip.values(), let b = try? group[j].siglip.values() { affinities.append(RegionSemanticTagger.cosine(a, b)) }
                    if let d = try? group[i].vision.distance(to: group[j].vision) { distances.append(d) }
                    shapes.append(group[i].geometry.distance(to: group[j].geometry))
                }}
                let evidence = ["\(group.count) nonoverlapping SAM regions agree on appearance, semantic features and normalized ink geometry.",
                    "Minimum pair SigLIP cosine \(affinities.min() ?? 0); maximum Vision distance \(distances.max() ?? 0); maximum geometry distance \(shapes.max() ?? 0).",
                    sameCopy ? "OCR copies agree after letter/number normalization." : "Related forms require source review; copy equivalence is not asserted.",
                    "Complete-link grouping rejects similarity chains."]
                let name = scope == "type" ? "related-type-sequence" : "repeated-shape-regions"
                systems.append(RegionSystemCandidate(id: posterID + "-joint-" + String(LibraryRaster.hash(Data(group.map(\.id).sorted().joined().utf8)).prefix(12)),
                    scope: scope, relationship: name, regionIDs: group.map(\.id), evidence: evidence,
                    sourceText: group.map(\.text).filter { !$0.isEmpty }.joined(separator: " → "), status: "cross-region candidate; not a fitted procedural rule"))
                if scope == "shape" || sameCopy {
                    tags.append(RegionTagEvidence(tag: scope == "type" ? "text-duplication" : "shape-replication",
                        affinity: affinities.min() ?? 0, contrastMargin: 0, geometrySupport: evidence,
                        explanation: "Cross-region agreement proposal. Feature scores retain separate scales; no text-contrast or probability estimate is assigned."))
                }
            }
        }
        return (systems, tags)
    }
}
