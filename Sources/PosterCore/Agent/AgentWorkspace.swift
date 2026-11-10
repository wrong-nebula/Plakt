import Foundation
import CoreGraphics

/// Where PosterLab's shared folders are, and where agent projects live.
public struct AgentEnvironment: Sendable {
    /// The PosterLab project root: holds `library/`, `taste/`, `output/`.
    public var root: URL
    /// Agent projects: one folder per poster, with every revision.
    public var home: URL
    public init(root: URL, home: URL) { self.root = root; self.home = home }
    public static func resolve() -> AgentEnvironment {
        let env = ProcessInfo.processInfo.environment, fm = FileManager.default
        var root: URL
        if let path = env["POSTERLAB_ROOT"], !path.isEmpty { root = URL(fileURLWithPath: (path as NSString).expandingTildeInPath, isDirectory: true) }
        else {
            root = URL(fileURLWithPath: fm.currentDirectoryPath, isDirectory: true)
            var probe = root
            for _ in 0..<6 {
                if fm.fileExists(atPath: probe.appending(path: "library/library.json").path) { root = probe; break }
                probe = probe.deletingLastPathComponent()
            }
        }
        let home = env["POSTERLAB_AGENT_HOME"].flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: ($0 as NSString).expandingTildeInPath, isDirectory: true) }
            ?? root.appending(path: "output/agent", directoryHint: .isDirectory)
        return AgentEnvironment(root: root.standardizedFileURL, home: home.standardizedFileURL)
    }
    public var library: URL { root.appending(path: "library", directoryHint: .isDirectory) }
    public var taste: URL { root.appending(path: "taste", directoryHint: .isDirectory) }
    /// Resolves a path argument against the project root; absolute and ~ paths stay as they are.
    public func path(_ value: String) -> URL {
        let expanded = (value as NSString).expandingTildeInPath
        return expanded.hasPrefix("/") ? URL(fileURLWithPath: expanded).standardizedFileURL : root.appending(path: expanded).standardizedFileURL
    }

    /// The file an agent tool leaves in a top folder it starts under `output/`, so later calls may add to that folder.
    public static let outputMarker = ".posterlab-agent"
    /// A path as it is on disk: symlinks followed and letter case corrected, for the part that exists.
    static func real(_ url: URL) -> URL {
        var existing = url.standardizedFileURL, tail: [String] = []
        while existing.path != "/", !FileManager.default.fileExists(atPath: existing.path) { tail.insert(existing.lastPathComponent, at: 0); existing.deleteLastPathComponent() }
        existing = existing.resolvingSymlinksInPath()
        let found = (try? existing.resourceValues(forKeys: [.canonicalPathKey]).canonicalPath).map { URL(fileURLWithPath: $0, isDirectory: true) } ?? existing
        // Not standardized again: that drops /private only from paths that exist, so a new folder would stop matching its parent.
        return tail.reduce(found) { $0.appending(path: $1) }
    }
    /// The top folder under `output/` that holds this path, unless it is the agent folder's own or lies elsewhere.
    private func outputTop(_ parts: [String]) -> URL? {
        let output = Self.real(root.appending(path: "output")).pathComponents, agent = Self.real(home).pathComponents
        guard parts.count > output.count, Array(parts.prefix(output.count)) == output, Array(parts.prefix(agent.count)) != agent else { return nil }
        return URL(fileURLWithPath: NSString.path(withComponents: Array(parts.prefix(output.count + 1))), isDirectory: true)
    }
    /// Resolves a folder a tool is asked to write into. Inside the PosterLab folder only `output/` is open, and there only the agent
    /// folder, a top folder that does not exist yet, or one an agent tool started. The library, the taste votes, the sources and other
    /// sessions' studies are refused. Folders outside PosterLab are the caller's choice.
    public func outputFolder(_ value: String, argument: String = "out") throws -> URL {
        let url = Self.real(path(value)), parts = url.pathComponents
        let own = Self.real(root).pathComponents, agent = Self.real(home).pathComponents
        guard Array(parts.prefix(own.count)) == own, Array(parts.prefix(agent.count)) != agent else { return url }
        let hint = "Leave '\(argument)' out to write into the agent folder, or name a new folder: output/<name>, or one outside PosterLab."
        guard let top = outputTop(parts) else {
            throw AgentError("'\(argument)' is \(url.path), inside PosterLab's own folders. Tools write only under output/.", hint: hint)
        }
        let fm = FileManager.default
        guard !fm.fileExists(atPath: top.path) || fm.fileExists(atPath: top.appending(path: Self.outputMarker).path) else {
            throw AgentError("output/\(top.lastPathComponent) already exists and was not started by an agent tool.", hint: hint)
        }
        return url
    }
    /// Creates a folder from `outputFolder` and marks its top folder under `output/` as started by an agent tool.
    public func startOutput(_ url: URL) throws {
        let fm = FileManager.default, top = outputTop(Self.real(url).pathComponents)
        let fresh = top.map { !fm.fileExists(atPath: $0.path) } ?? false
        try fm.createDirectory(at: url, withIntermediateDirectories: true)
        if let top, fresh { try Data("Started by a PosterLab agent tool; agent tools may add to this folder.\n".utf8).write(to: top.appending(path: Self.outputMarker)) }
    }
}

/// How a project's first scene was made, so it can be explained and remade.
public struct AgentOrigin: Codable, Sendable {
    public var mode: String
    public var style: String? = nil
    public var recipe: String? = nil
    public var seed: UInt64
    public var briefID: String? = nil
    public var donors: [String]? = nil
    public var fontProfileID: String? = nil
    public var source: String? = nil
    /// The create_poster arguments, so remake_poster can rerun them with changes.
    public var arguments: JSONValue? = nil
}

public struct AgentRevision: Codable, Sendable {
    public var number: Int
    public var note: String
    public var created: Date
    public var renderSeed: UInt64
    public var parent: Int?
    public var operations: JSONValue?
    public var scene: String { String(format: "scene-r%03d.json", number) }
    public var preview: String { String(format: "preview-r%03d.png", number) }
}

public struct AgentProject: Codable, Sendable {
    public var version = "posterlab-agent-project-v1"
    public var id: String
    public var title: String
    public var created: Date
    public var origin: AgentOrigin
    public var copy: PosterCopy?
    public var revisions: [AgentRevision]
    public var current: Int
    public var group: String? = nil
    public var currentRevision: AgentRevision { revisions.first { $0.number == current } ?? revisions[revisions.count - 1] }
}

/// File-backed project store. Every edit writes a new revision; nothing is overwritten except project.json.
struct AgentStore: Sendable {
    let environment: AgentEnvironment
    var home: URL { environment.home }

    func folder(_ id: String) -> URL { home.appending(path: id, directoryHint: .isDirectory) }

    func newID(title: String) -> String {
        let slug = title.lowercased().unicodeScalars.map { CharacterSet.alphanumerics.contains($0) && $0.isASCII ? String($0) : "-" }.joined()
            .split(separator: "-").prefix(4).joined(separator: "-")
        let base = "p-" + (slug.isEmpty ? "poster" : String(slug.prefix(32)))
        for _ in 0..<64 {
            let id = base + "-" + String(format: "%04x", UInt16.random(in: 0...UInt16.max))
            if !FileManager.default.fileExists(atPath: folder(id).path) { return id }
        }
        return base + "-" + UUID().uuidString.prefix(8).lowercased()
    }

    func load(_ id: String) throws -> AgentProject {
        let clean = id.trimmingCharacters(in: .whitespaces)
        guard !clean.contains("/"), !clean.contains(".."), !clean.isEmpty else { throw AgentError("Invalid project id '\(id)'.", hint: "Use an id from list_projects, e.g. p-biennale-3fa2.") }
        let url = folder(clean).appending(path: "project.json")
        guard FileManager.default.fileExists(atPath: url.path) else { throw AgentError("No project '\(clean)'.", hint: "Call list_projects, or create_poster to start one.") }
        return try decoder.decode(AgentProject.self, from: Data(contentsOf: url))
    }
    func save(_ project: AgentProject) throws {
        let dir = folder(project.id)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try encoder.encode(project).write(to: dir.appending(path: "project.json"), options: .atomic)
    }
    func scene(_ project: AgentProject, revision: Int? = nil) throws -> (StyleGenome, AgentRevision) {
        let rev = try self.revision(project, revision)
        let url = folder(project.id).appending(path: rev.scene)
        return (try JSONDecoder().decode(StyleGenome.self, from: Data(contentsOf: url)), rev)
    }
    func revision(_ project: AgentProject, _ number: Int?) throws -> AgentRevision {
        guard let number else { return project.currentRevision }
        guard let rev = project.revisions.first(where: { $0.number == number }) else {
            throw AgentError("Project \(project.id) has no revision \(number).", hint: "Revisions: " + project.revisions.map { String($0.number) }.joined(separator: ", "))
        }
        return rev
    }
    func previewURL(_ project: AgentProject, _ rev: AgentRevision) -> URL { folder(project.id).appending(path: rev.preview) }

    /// Writes a scene as the project's next revision and renders its preview.
    @discardableResult
    func commit(_ project: inout AgentProject, scene: StyleGenome, renderSeed: UInt64, note: String, operations: JSONValue?, previewWidth: Int) throws -> (AgentRevision, CGImage) {
        let next = (project.revisions.map(\.number).max() ?? 0) + 1
        let rev = AgentRevision(number: next, note: note, created: Date(), renderSeed: renderSeed, parent: project.revisions.isEmpty ? nil : project.current, operations: operations)
        let image = try LibrarySceneRenderer.render(scene, width: previewWidth, seed: renderSeed)
        let dir = folder(project.id)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try LibraryRaster.write(scene, to: dir.appending(path: rev.scene))
        try PosterRenderer.png(image, to: dir.appending(path: rev.preview))
        project.revisions.append(rev); project.current = next
        try save(project)
        return (rev, image)
    }

    func all() -> [AgentProject] {
        guard let items = try? FileManager.default.contentsOfDirectory(at: home, includingPropertiesForKeys: nil) else { return [] }
        return items.compactMap { try? decoder.decode(AgentProject.self, from: Data(contentsOf: $0.appending(path: "project.json"))) }
            .sorted { $0.created > $1.created }
    }

    private var encoder: JSONEncoder { let e = JSONEncoder(); e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]; e.dateEncodingStrategy = .iso8601; return e }
    private var decoder: JSONDecoder { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }
}
