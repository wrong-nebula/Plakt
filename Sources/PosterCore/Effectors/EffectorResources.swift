import Foundation

/// The effector editor is built by geometry-bench/effector-system/build.mjs and shares the core resource bundle.
public enum EffectorResources {
    public static var entryURL: URL? {
        PosterResources.bundle.url(forResource: "index", withExtension: "html", subdirectory: "Resources/Effectors")
    }
}
