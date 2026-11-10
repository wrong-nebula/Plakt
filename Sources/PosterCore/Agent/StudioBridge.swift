import Foundation

// The live bridge between agent tools and a running PosterLab Agent Studio (built by scripts/build-agent-studio.sh).
//
// It is a watched folder, `<agent home>/studio-inbox/`:
//   commands/<id>.json   written by a tool (atomically), claimed and deleted by the Studio
//   replies/<id>.json    written by the Studio when the command has been carried out, deleted by the tool
//   state.json           what the Studio shows and what the user has selected, rewritten on change and every ~1.5 s
//   snapshots/           PNGs the Studio draws of its own windows (no screen-recording permission needed)
// A Studio counts as running while state.json is younger than `StudioInbox.heartbeat` and its pid is alive.

/// One request to the Studio.
public struct StudioCommand: Codable, Sendable {
    public var id: String
    public var created: Double
    /// show_project, show_scene, shape_library, open_study, state, snapshot
    public var action: String
    public var project: String?
    public var revision: Int?
    public var scene: String?
    public var image: String?
    public var title: String?
    public var preset: PosterShapePreset?
    public var study: String?
    /// Close a sheet the user has open to show this one.
    public var replace: Bool
    /// Bring the Studio to the front.
    public var focus: Bool
    /// Reply with a PNG of the window that shows the result.
    public var snapshot: Bool
    public init(action: String, project: String? = nil, revision: Int? = nil, scene: String? = nil, image: String? = nil, title: String? = nil,
                preset: PosterShapePreset? = nil, study: String? = nil, replace: Bool = false, focus: Bool = true, snapshot: Bool = false) {
        id = UUID().uuidString.lowercased(); created = Date().timeIntervalSince1970
        self.action = action; self.project = project; self.revision = revision; self.scene = scene; self.image = image; self.title = title
        self.preset = preset; self.study = study; self.replace = replace; self.focus = focus; self.snapshot = snapshot
    }
}

public struct StudioWindowInfo: Codable, Sendable {
    public var title: String
    /// main, sheet, viewer or other
    public var role: String
    public var width: Double
    public var height: Double
    public var key: Bool
    public init(title: String, role: String, width: Double, height: Double, key: Bool) { self.title = title; self.role = role; self.width = width; self.height = height; self.key = key }
}

/// One agent poster window: which project and revision it shows and which elements the user selected (describe_poster indices).
public struct StudioViewerState: Codable, Sendable {
    public var project: String?
    public var scene: String?
    public var image: String?
    public var title: String
    public var revision: Int?
    public var followsLatest: Bool
    public var selected: [Int]
    public var focused: Bool
    public init(project: String?, scene: String?, image: String?, title: String, revision: Int?, followsLatest: Bool, selected: [Int], focused: Bool) {
        self.project = project; self.scene = scene; self.image = image; self.title = title; self.revision = revision
        self.followsLatest = followsLatest; self.selected = selected; self.focused = focused
    }
}

/// What the Studio shows, and what the user has selected in it.
public struct StudioState: Codable, Sendable {
    public var version = "posterlab-studio-state-v1"
    public var pid: Int32
    public var bundleID: String
    public var home: String
    public var updated: Double
    public var active: Bool
    /// generate or review
    public var workspace: String
    /// The sheet on the main window, if any (StudioSheet names: shapeLibrary, tasteCheck, …).
    public var sheet: String?
    public var busy: Bool
    public var status: String
    public var error: String?
    public var windows: [StudioWindowInfo]
    public var viewers: [StudioViewerState]
    /// Generate workspace: the open study round and the candidate selected in it.
    public var study: String?
    public var candidate: String?
    public var picks: [String]
    /// Review workspace: library folder, selected source poster and element.
    public var library: String?
    public var libraryPoster: String?
    public var libraryElement: String?
    /// The shape, font profile and type system new studies use.
    public var shapeRecipe: String?
    public var fontProfile: String?
    public var typeSystem: String?
    public init(pid: Int32, bundleID: String, home: String, updated: Double, active: Bool, workspace: String, sheet: String?, busy: Bool, status: String, error: String?,
                windows: [StudioWindowInfo], viewers: [StudioViewerState], study: String?, candidate: String?, picks: [String], library: String?, libraryPoster: String?,
                libraryElement: String?, shapeRecipe: String?, fontProfile: String?, typeSystem: String?) {
        self.pid = pid; self.bundleID = bundleID; self.home = home; self.updated = updated; self.active = active; self.workspace = workspace; self.sheet = sheet
        self.busy = busy; self.status = status; self.error = error; self.windows = windows; self.viewers = viewers; self.study = study; self.candidate = candidate
        self.picks = picks; self.library = library; self.libraryPoster = libraryPoster; self.libraryElement = libraryElement; self.shapeRecipe = shapeRecipe
        self.fontProfile = fontProfile; self.typeSystem = typeSystem
    }
}

public struct StudioReply: Codable, Sendable {
    public var id: String
    public var ok: Bool
    public var message: String
    public var state: StudioState?
    public var snapshot: String?
    public init(id: String, ok: Bool, message: String, state: StudioState?, snapshot: String?) { self.id = id; self.ok = ok; self.message = message; self.state = state; self.snapshot = snapshot }
}

/// The watched folder both sides use. Tools post commands and wait for replies; the Studio claims commands, replies and publishes its state.
public struct StudioInbox: Sendable {
    public static let heartbeat: TimeInterval = 6
    public static let bundleID = "studio.posterlab.agent"
    public let folder: URL
    public init(home: URL) { folder = home.appending(path: "studio-inbox", directoryHint: .isDirectory) }
    public var commands: URL { folder.appending(path: "commands", directoryHint: .isDirectory) }
    public var replies: URL { folder.appending(path: "replies", directoryHint: .isDirectory) }
    public var stateURL: URL { folder.appending(path: "state.json") }
    public var snapshots: URL { folder.appending(path: "snapshots", directoryHint: .isDirectory) }

    // MARK: Both sides

    public func state() -> StudioState? { try? JSONDecoder().decode(StudioState.self, from: Data(contentsOf: stateURL)) }
    public static func alive(_ s: StudioState, now: Date = Date()) -> Bool {
        guard now.timeIntervalSince1970 - s.updated < heartbeat, s.pid > 0 else { return false }
        return kill(s.pid, 0) == 0 || errno == EPERM
    }
    /// The state of a running Studio, or nil when none has published lately.
    public func liveState() -> StudioState? { state().flatMap { Self.alive($0) ? $0 : nil } }

    // MARK: Tool side

    public func post(_ command: StudioCommand) throws {
        try FileManager.default.createDirectory(at: commands, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: replies, withIntermediateDirectories: true)
        try Self.encoder.encode(command).write(to: commands.appending(path: command.id + ".json"), options: .atomic)
    }
    /// Waits for the reply to a posted command. On timeout the command is withdrawn so a late Studio won't act on it.
    public func reply(to id: String, timeout: TimeInterval) async throws -> StudioReply? {
        let url = replies.appending(path: id + ".json"), deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            try Task.checkCancellation()
            if let data = try? Data(contentsOf: url), let reply = try? JSONDecoder().decode(StudioReply.self, from: data) {
                try? FileManager.default.removeItem(at: url); return reply
            }
            try await Task.sleep(for: .milliseconds(100))
        }
        withdraw(id)
        return nil
    }
    public func withdraw(_ id: String) { try? FileManager.default.removeItem(at: commands.appending(path: id + ".json")) }
    public func send(_ command: StudioCommand, timeout: TimeInterval) async throws -> StudioReply? {
        try post(command)
        do { return try await reply(to: command.id, timeout: timeout) } catch { withdraw(command.id); throw error }
    }

    // MARK: Studio side

    /// Commands waiting, oldest first. Commands older than `maxAge` and replies nobody collected are deleted.
    public func pending(maxAge: TimeInterval = 120) -> [StudioCommand] {
        let fm = FileManager.default, now = Date().timeIntervalSince1970
        for url in (try? fm.contentsOfDirectory(at: replies, includingPropertiesForKeys: [.contentModificationDateKey])) ?? [] {
            let modified = (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate)?.timeIntervalSince1970 ?? now
            if now - modified > maxAge { try? fm.removeItem(at: url) }
        }
        let files = ((try? fm.contentsOfDirectory(at: commands, includingPropertiesForKeys: nil)) ?? []).filter { $0.pathExtension == "json" && !$0.lastPathComponent.hasPrefix(".") }
        var out: [StudioCommand] = []
        for url in files {
            guard let data = try? Data(contentsOf: url) else { continue }
            guard let c = try? JSONDecoder().decode(StudioCommand.self, from: data) else { try? fm.removeItem(at: url); continue }
            if now - c.created > maxAge { try? fm.removeItem(at: url); continue }
            out.append(c)
        }
        return out.sorted { $0.created < $1.created }
    }
    /// Takes a command off the queue. False if the tool already withdrew it.
    public func claim(_ id: String) -> Bool {
        (try? FileManager.default.removeItem(at: commands.appending(path: id + ".json"))) != nil
    }
    public func answer(_ reply: StudioReply) throws {
        try FileManager.default.createDirectory(at: replies, withIntermediateDirectories: true)
        try Self.encoder.encode(reply).write(to: replies.appending(path: reply.id + ".json"), options: .atomic)
    }
    public func publish(_ state: StudioState) throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Self.encoder.encode(state).write(to: stateURL, options: .atomic)
    }
    /// The Studio's agent home: POSTERLAB_AGENT_HOME, else the app's PosterLabAgentHome, else ROOT/output/agent with ROOT from
    /// POSTERLAB_ROOT or the app's PosterLabProjectRoot.
    public static func studioHome(environment: [String: String] = ProcessInfo.processInfo.environment, info: [String: Any]? = Bundle.main.infoDictionary) -> URL? {
        func url(_ s: String?) -> URL? { s.flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: ($0 as NSString).expandingTildeInPath, isDirectory: true).standardizedFileURL } }
        if let home = url(environment["POSTERLAB_AGENT_HOME"]) ?? url(info?["PosterLabAgentHome"] as? String) { return home }
        return (url(environment["POSTERLAB_ROOT"]) ?? url(info?["PosterLabProjectRoot"] as? String))?.appending(path: "output/agent", directoryHint: .isDirectory)
    }

    static var encoder: JSONEncoder { let e = JSONEncoder(); e.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]; return e }
}

/// Read-only access to agent projects, for the Studio's poster windows.
public struct AgentProjectFiles: Sendable {
    let store: AgentStore
    public init(home: URL) { store = AgentStore(environment: AgentEnvironment(root: home, home: home)) }
    public func project(_ id: String) throws -> AgentProject { try store.load(id) }
    public func scene(_ project: AgentProject, revision: Int?) throws -> (StyleGenome, AgentRevision) { try store.scene(project, revision: revision) }
    public func preview(_ project: AgentProject, _ revision: AgentRevision) -> URL { store.previewURL(project, revision) }
    public func folder(_ id: String) -> URL { store.folder(id) }
    /// project.json's modification date, to notice new revisions.
    public func modified(_ id: String) -> Date? {
        try? store.folder(id).appending(path: "project.json").resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
    }
    /// The role describe_poster gives an element (title, meta, art, …).
    public static func role(_ element: SceneElement) -> String { AgentScene.role(element) }
}
