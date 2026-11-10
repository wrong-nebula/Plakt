import Foundation

public struct SeededRandom: RandomNumberGenerator, Sendable {
    private var state: UInt64
    public init(seed: UInt64) { state = seed }
    public mutating func next() -> UInt64 {
        state &+= 0x9e3779b97f4a7c15
        var z = state
        z = (z ^ (z >> 30)) &* 0xbf58476d1ce4e5b9
        z = (z ^ (z >> 27)) &* 0x94d049bb133111eb
        return z ^ (z >> 31)
    }
    public mutating func unit() -> Double { Double(next() >> 11) / 9_007_199_254_740_992 }
    public mutating func value(_ lo: Double, _ hi: Double) -> Double { lo + unit() * (hi - lo) }
    public mutating func int(_ count: Int) -> Int { Int(next() % UInt64(max(1, count))) }
}

public struct PosterCopy: Codable, Hashable, Sendable {
    public var title: String
    public var subtitle: String
    public var institution: String
    public var footer: String
    public var briefID:String? = nil
    public var displayPhrases:[String]? = nil
    public init(title: String = "VISUAL\nCOMMUNICATION", subtitle: String = "Institute of Design",
                institution: String = "Visual Communication Institute", footer: String = "FORM / TYPE / SYSTEM • 2026") {
        self.title = title; self.subtitle = subtitle; self.institution = institution; self.footer = footer
    }
    public var words: [String] {
        let parts = title.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        return parts.isEmpty ? ["VISUAL", "DESIGN"] : parts
    }
    public var initials: [String] {
        if briefID != nil {
            let values=words.compactMap{word in word.first(where:{$0.isLetter}).map(String.init)}
            return values.isEmpty ? [String(title.prefix(1))]:values
        }
        return words.map { String($0.prefix(1)) } + ["I", "D"]
    }
    public func validated() throws -> Self {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw PosterError.invalid("Enter a poster title.") }
        guard [title, subtitle, institution, footer].allSatisfy({ $0.count <= 160 }) else {
            throw PosterError.invalid("Each copy field must be 160 characters or fewer.")
        }
        return self
    }
}

public struct Genome: Codable, Hashable, Sendable {
    public var seed: UInt64
    public var density: Double
    public var scale: Double
    public var repetition: Double
    public var distortion: Double
    public var inversion: Double
    public var layout: Int
    public var renderStyle: String? = nil
    public var composition: CompositionPlan? = nil
    public var motifs: [Int]
    public static func random(seed: UInt64) -> Self {
        var r = SeededRandom(seed: seed)
        var genome=Self(seed: seed, density: r.value(0.45, 0.95), scale: r.unit(), repetition: r.value(0.25, 0.9),
                    distortion: r.value(0.1, 0.8), inversion: r.value(0, 0.25), layout: r.int(4),
                    motifs: (0..<24).map { _ in r.int(12) })
        genome.composition=CompositionPlan.procedural(genome);return genome
    }
    public func mutated(seed: UInt64, strength: Double) -> Self {
        var r = SeededRandom(seed: seed)
        func bounded(_ x: Double) -> Double { min(1, max(0, x)) }
        var child = self
        child.seed = seed
        child.density = bounded(density + r.value(-strength, strength))
        child.scale = bounded(scale + r.value(-strength, strength))
        child.repetition = bounded(repetition + r.value(-strength, strength))
        child.distortion = bounded(distortion + r.value(-strength, strength))
        child.inversion = min(0.45, bounded(inversion + r.value(-strength / 2, strength / 2)))
        if r.unit() < strength { child.layout = r.int(4) }
        child.motifs = motifs.map { r.unit() < strength * 0.8 ? r.int(12) : $0 }
        child.composition=CompositionPlan.procedural(child)
        return child
    }
    public static func ==(lhs:Self,rhs:Self)->Bool {
        lhs.seed==rhs.seed && lhs.fingerprint==rhs.fingerprint && lhs.motifs==rhs.motifs && lhs.renderStyle==rhs.renderStyle
    }
    public func hash(into hasher:inout Hasher) {hasher.combine(seed);hasher.combine(fingerprint);hasher.combine(motifs);hasher.combine(renderStyle)}
    public var fingerprint: [Double] { [density, scale, repetition, distortion, inversion, Double(layout) / 3] }
}

public enum PosterError: LocalizedError {
    case invalid(String)
    case render
    case image(String)
    public var errorDescription: String? {
        switch self {
        case .invalid(let text), .image(let text): text
        case .render: "The poster could not be rendered. Try a smaller export size."
        }
    }
}

public enum Resources {
    public static var referenceURL: URL { PosterResources.bundle.url(forResource: "reference", withExtension: "jpg", subdirectory: "Resources")! }
    public static var modelURL: URL? { PosterResources.bundle.url(forResource: "CompositionPrior", withExtension: "mlmodel", subdirectory: "Resources") }
}
