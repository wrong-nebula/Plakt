import Foundation

public enum GlassShape: String, Codable, CaseIterable, Identifiable, Sendable {
    case sphere, cube, prism, cylinder

    public var id: String { rawValue }
    public var label: String {
        switch self {
        case .sphere: "Sphere"
        case .cube: "Cube"
        case .prism: "Triangular prism"
        case .cylinder: "Cylinder"
        }
    }
    public var shaderIndex: Float { Float(Self.allCases.firstIndex(of: self)!) }
}
