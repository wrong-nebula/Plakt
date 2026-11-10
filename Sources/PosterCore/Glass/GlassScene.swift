import Foundation

public struct GlassScene: Codable, Equatable, Sendable {
    public static let maximumObjects = 8
    public var objects: [GlassObject] = [GlassObject()]
    public var lightAzimuth = -40.0
    public var lightElevation = 55.0
    public var lightIntensity = 1.0
    public var environment = 1.0
    /// Optional storage keeps projects saved before these controls rendering as they did:
    /// a dark studio and no shadows on the paper.
    public var studioMode: GlassStudio? = .light
    public var shadowAmount: Double? = 0.7
    public var lightSpreadDegrees: Double? = 8
    /// 0 looks straight down; higher values bring the camera closer so solids show their sides.
    public var perspectiveAmount: Double? = 0
    public var studio: GlassStudio {
        get { studioMode ?? .dark }
        set { studioMode = newValue }
    }
    /// Strength of the transparent shadows that physical glass casts on the paper.
    public var shadows: Double {
        get { shadowAmount ?? 0 }
        set { shadowAmount = newValue }
    }
    /// Angular radius of the key light; larger lights soften shadow edges.
    public var lightSpread: Double {
        get { lightSpreadDegrees ?? 8 }
        set { lightSpreadDegrees = newValue }
    }

    public var perspective: Double {
        get { perspectiveAmount ?? 0 }
        set { perspectiveAmount = newValue }
    }

    public init() {}

    public func validate() throws {
        guard objects.count <= Self.maximumObjects,
              Set(objects.map(\.id)).count == objects.count,
              lightAzimuth.isFinite, (-180...180).contains(lightAzimuth),
              lightElevation.isFinite, (5...90).contains(lightElevation),
              lightIntensity.isFinite, (0...3).contains(lightIntensity),
              environment.isFinite, (0...1).contains(environment),
              shadows.isFinite, (0...1).contains(shadows),
              lightSpread.isFinite, (0...30).contains(lightSpread),
              perspective.isFinite, (0...1).contains(perspective) else {
            throw PosterError.invalid("The glass scene contains invalid objects or lighting.")
        }
        for object in objects { try object.validate() }
    }
}
