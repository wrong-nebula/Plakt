import Foundation

/// The rule-field editor is built by geometry-bench/rule-field-system/build-app.mjs and shares the core resource bundle.
public enum RuleFieldResources {
    public static var entryURL: URL? {
        PosterResources.bundle.url(forResource: "index", withExtension: "html", subdirectory: "Resources/RuleField")
    }
}
