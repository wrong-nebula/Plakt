import Foundation

public struct GlassObject: Codable, Equatable, Identifiable, Sendable {
    public var id = UUID()
    public var shape: GlassShape = .sphere
    public var enabled = true
    /// Optional storage keeps projects written before glass modes compatible.
    public var materialMode: GlassMaterialMode?
    public var material: GlassMaterialMode {
        get { materialMode ?? .physical }
        set { materialMode = newValue }
    }
    public var x = 0.5
    public var y = 0.5
    /// Diameter relative to poster width; depth is a multiple of diameter.
    public var size = 0.58
    public var depth = 0.8
    public var elevation = 0.035
    public var rotationX = 0.0
    public var rotationY = 0.0
    public var rotationZ = 0.0
    public var ior = 1.5
    public var roughness = 0.015
    public var dispersion = 0.008
    public var absorption = 0.3
    public var tintRed = 0.88
    public var tintGreen = 0.97
    public var tintBlue = 1.0
    /// Edge rounding for cubes, prisms and cylinders, as a fraction of half the solid's smallest extent.
    /// Optional storage keeps projects saved before this control with sharp edges.
    public var edgeRoundingAmount: Double? = 0.12
    public var edgeRounding: Double {
        get { edgeRoundingAmount ?? 0 }
        set { edgeRoundingAmount = newValue }
    }

    public init(shape: GlassShape = .sphere) {
        self.shape = shape
        if shape == .cube { rotationX = 18; rotationY = -24; rotationZ = -12; depth = 0.65 }
        if shape == .prism { rotationY = -16; rotationZ = 18; depth = 0.5 }
        if shape == .cylinder { rotationX = 20; rotationY = -12; depth = 0.5 }
    }

    public func validate() throws {
        let ranges: [(Double, ClosedRange<Double>)] = [
            (x, 0...1), (y, 0...1), (size, 0.08...1.4), (depth, 0.1...2),
            (elevation, 0...1), (rotationX, -180...180), (rotationY, -180...180),
            (rotationZ, -180...180), (ior, 1...2.5), (roughness, 0...0.5),
            (dispersion, 0...0.08), (absorption, 0...10),
            (tintRed, 0...1), (tintGreen, 0...1), (tintBlue, 0...1), (edgeRounding, 0...1)
        ]
        guard ranges.allSatisfy({ $0.0.isFinite && $0.1.contains($0.0) }) else {
            throw PosterError.invalid("Glass controls are outside their supported range.")
        }
    }
}
