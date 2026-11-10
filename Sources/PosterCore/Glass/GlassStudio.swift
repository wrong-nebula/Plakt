import Foundation

/// What escaping rays and reflections see around the glass.
public enum GlassStudio: String, Codable, CaseIterable, Identifiable, Sendable {
    case light, poster, dark

    public var id: String { rawValue }
    public var label: String {
        switch self {
        case .light: "Light studio"
        case .poster: "Poster colors"
        case .dark: "Dark studio"
        }
    }
    var shaderIndex: Float {
        switch self {
        case .dark: 0
        case .light: 1
        case .poster: 2
        }
    }
}
