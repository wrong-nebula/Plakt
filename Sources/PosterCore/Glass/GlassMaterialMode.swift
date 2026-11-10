import Foundation

public enum GlassMaterialMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case physical, simple

    public var id: String { rawValue }
    public var label: String {
        switch self {
        case .physical: "Physical glass"
        case .simple: "Simple refraction"
        }
    }
}
