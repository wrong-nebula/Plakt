import Foundation

public enum ConstructionStage: String, Codable, CaseIterable, Sendable {
    case blockout, primary, secondary, finished
    public var label: String {
        switch self {
        case .blockout: "01 / Large shapes"
        case .primary: "02 / Primary type"
        case .secondary: "03 / Secondary type"
        case .finished: "04 / Repetition + detail"
        }
    }
}

public extension Genome {
    /// A separate random stream keeps the coin independent of other traits.
    var usesStagedConstruction: Bool {
        var coin = SeededRandom(seed: seed ^ 0x434f494e544f5353)
        return coin.next() & 1 == 0
    }
}

/// Staged seeds choose a large-shape plan before any text is placed.
/// This is a geometric mass estimate, not an AI judgment or a proven design optimum.
public struct BlockoutPlan: Codable, Sendable {
    public var scale: Double
    public var distortion: Double
    public var proposal: Int
    public var balanceEstimate: Double
    public static func make(_ g: Genome) -> Self {
        guard g.usesStagedConstruction else { return Self(scale: g.scale, distortion: g.distortion, proposal: 0, balanceEstimate: 0) }
        var random = SeededRandom(seed: g.seed ^ 0x424c4f434b4f5554)
        var best = Self(scale: g.scale, distortion: g.distortion, proposal: 0, balanceEstimate: -Double.infinity)
        // First choose masses. Only after this choice do later passes place text into the same plan.
        for i in 0..<6 {
            let scale = i == 0 ? g.scale : min(1, max(0, g.scale + random.value(-0.28, 0.28)))
            let distortion = i == 0 ? g.distortion : min(1, max(0, g.distortion + random.value(-0.22, 0.22)))
            let top = 330 + distortion * 60, mid = 440 + scale * 65
            let split = g.layout % 2 == 0 ? 435 + scale * 115 : 596
            let leftWeight = g.layout % 2 == 0 ? 0.27 : 0.70
            let rightWeight = g.layout % 2 == 0 ? 0.70 : 0.27
            let topLeft = split * top * leftWeight, topRight = (1000 - split) * top * rightWeight
            let middleLeft = 462 * mid * 0.52, middleRight = 498 * mid * 0.40
            let bottom = max(100, 1414 - 210 - top - mid)
            let bottomMass = bottom * 972 * 0.54
            let total = topLeft + topRight + middleLeft + middleRight + bottomMass
            let cx = (topLeft * split / 2 + topRight * (split + (1000 - split) / 2) + middleLeft * 245 + middleRight * 737 + bottomMass * 500) / total
            let cy = ((topLeft + topRight) * (58 + top / 2) + (middleLeft + middleRight) * (68 + top + mid / 2) + bottomMass * (1414 - bottom / 2)) / total
            let score = 1 - abs(cx - 500) / 500 - abs(cy - 707) / 707
            if score > best.balanceEstimate { best = Self(scale: scale, distortion: distortion, proposal: i, balanceEstimate: score) }
        }
        return best
    }
}
