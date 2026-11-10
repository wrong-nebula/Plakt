import Foundation

/// A packaged macOS app keeps SwiftPM resources under Contents/Resources.
/// SwiftPM's generated accessor otherwise falls back to the original build folder.
enum PosterResources {
    static let bundle: Bundle = {
        if let resources = Bundle.main.resourceURL,
           let packaged = Bundle(url: resources.appending(path: "PosterLab_PosterCore.bundle")) {
            return packaged
        }
        let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL.deletingLastPathComponent()
        if let adjacent = Bundle(url: executable.appending(path: "PosterLab_PosterCore.bundle")) { return adjacent }
        return Bundle.module
    }()
}
