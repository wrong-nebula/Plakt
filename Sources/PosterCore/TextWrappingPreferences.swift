import Foundation

public enum TextWrappingPreferences {
    public static let pretextEnabledKey = "posterlab-pretext-enabled"

    /// An absent setting enables caching. An explicit false must remain false.
    public static func method(in defaults: UserDefaults = .standard) -> TextWrappingMethod {
        let enabled = defaults.object(forKey: pretextEnabledKey) as? Bool ?? true
        return enabled ? .pretext : .previous
    }
}
