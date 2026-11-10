import Foundation

/// The one sheet the studio window shows. SwiftUI presents a single sheet per view, so this is
/// one value instead of a flag per sheet that could be set together. A sheet that needs data
/// carries it, so a source study can't open empty.
enum StudioSheet: Identifiable {
    case imageStart, fontLibrary, typeSystems, shapeLibrary, tasteCheck, ruleField, effectors, kerning
    case sourceStudy(URL)

    /// Names for the `-PosterLabSheet` launch argument, in menu order.
    static let names = ["imageStart", "ruleField", "effectors", "kerning", "shapeLibrary", "tasteCheck", "typeSystems", "fontLibrary", "sourceStudy"]

    var name: String {
        switch self {
        case .imageStart: "imageStart"
        case .fontLibrary: "fontLibrary"
        case .typeSystems: "typeSystems"
        case .shapeLibrary: "shapeLibrary"
        case .tasteCheck: "tasteCheck"
        case .ruleField: "ruleField"
        case .effectors: "effectors"
        case .kerning: "kerning"
        case .sourceStudy: "sourceStudy"
        }
    }

    var id: String {
        switch self {
        case .sourceStudy(let url): name + ":" + url.path
        default: name
        }
    }

    /// The sheet `name` refers to, or nil for an unknown name or a source study that doesn't exist yet.
    init?(name: String, sourceStudy: URL?) {
        switch name {
        case "imageStart": self = .imageStart
        case "fontLibrary": self = .fontLibrary
        case "typeSystems": self = .typeSystems
        case "shapeLibrary": self = .shapeLibrary
        case "tasteCheck": self = .tasteCheck
        case "ruleField": self = .ruleField
        case "effectors": self = .effectors
        case "kerning": self = .kerning
        case "sourceStudy": guard let sourceStudy else { return nil }; self = .sourceStudy(sourceStudy)
        default: return nil
        }
    }
}

/// The two halves of the window.
enum StudioWorkspace: String {
    case generate, review
}

/// Launch arguments that open the studio in a given state, for checks, screenshots and agents:
///
///     open dist/PosterLab.app --args -PosterLabWorkspace review -PosterLabSheet tasteCheck
///
/// They are read from the argument domain only, so they never persist between launches.
enum StudioLaunch {
    private static var arguments: [String: Any] { UserDefaults.standard.volatileDomain(forName: UserDefaults.argumentDomain) }
    static var workspace: StudioWorkspace? { (arguments["PosterLabWorkspace"] as? String).flatMap(StudioWorkspace.init(rawValue:)) }
    static var sheet: String? { arguments["PosterLabSheet"] as? String }
    /// Opens the glass window at launch: `-PosterLabOpenGlass YES`.
    static var openGlass: Bool { (arguments["PosterLabOpenGlass"] as? String).map { ["1", "yes", "true"].contains($0.lowercased()) } ?? false }
    /// A scene file for the kerning sheet to open with: `-PosterLabSheet kerning -PosterLabKerningScene genome.json`.
    static var kerningScene: URL? { (arguments["PosterLabKerningScene"] as? String).map { URL(fileURLWithPath: $0) } }
    /// A path prefix: the kerning sheet writes PNGs of itself there (see KerningSnapshot).
    static var kerningSnapshot: String? { arguments["PosterLabKerningSnapshot"] as? String }
    /// Starts a source study at launch: library, judging reference, brief and modifiers.
    static var library: URL? { (arguments["PosterLabLibrary"] as? String).map { URL(fileURLWithPath: $0) } }
    static var reference: URL? { (arguments["PosterLabReference"] as? String).map { URL(fileURLWithPath: $0) } }
    static var brief: String? { arguments["PosterLabBrief"] as? String }
    static var modifiers: Bool { (arguments["PosterLabModifiers"] as? String).map { ["1", "yes", "true"].contains($0.lowercased()) } ?? false }
    static var startSourceStudy: Bool { (arguments["PosterLabStartSourceStudy"] as? String).map { ["1", "yes", "true"].contains($0.lowercased()) } ?? false }
    /// Writes a snapshot of Start from image to this PNG path, then quits (checks without screen capture).
    static var imageStartSnapshot: URL? { (arguments["PosterLabImageStartSnapshot"] as? String).map { URL(fileURLWithPath: $0) } }
    /// Writes a snapshot of a finished study's first winner in the editor, then quits.
    static var editorSnapshot: (study: URL, out: URL)? {
        guard let study = arguments["PosterLabEditorStudy"] as? String, let out = arguments["PosterLabEditorSnapshot"] as? String else { return nil }
        return (URL(fileURLWithPath: study), URL(fileURLWithPath: out))
    }
    /// Opens a finished study straight on its winners.
    static var winners: URL? { (arguments["PosterLabWinners"] as? String).map { URL(fileURLWithPath: $0) } }
    /// Replays a saved source study on the live stage.
    static var liveReplay: URL? { (arguments["PosterLabLiveReplay"] as? String).map { URL(fileURLWithPath: $0) } }
    /// With a replay: writes stage snapshots to this folder, then quits (checks without screen capture).
    static var liveSnapshots: URL? { (arguments["PosterLabLiveSnapshots"] as? String).map { URL(fileURLWithPath: $0) } }
}
