import Foundation

public enum GlassWorkspaceResources {
    public static var demoURL: URL? {
        PosterResources.bundle.url(forResource: "DemoPoster", withExtension: "png", subdirectory: "Resources/Glass")
    }
}
