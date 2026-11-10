import SwiftUI
import PosterCore

/// What an agent poster window shows: an agent project (followed live as the agent edits it), or a rendered scene / image.
struct StudioAgentItem: Codable, Hashable {
    var project: String?
    var scene: String?
    var image: String?
    var title: String?
    var key: String { project.map { "project:" + $0 } ?? scene.map { "scene:" + $0 } ?? "image:" + (image ?? "") }
    static func == (a: Self, b: Self) -> Bool { a.key == b.key }
    func hash(into h: inout Hasher) { h.combine(key) }
}

/// A revision an agent asked a poster window to show; nil revision = follow the latest.
struct StudioRevisionRequest: Equatable { var revision: Int?; var token: String }

/// One open agent poster window, as the bridge reports it.
@MainActor final class StudioViewerRecord {
    weak var window: NSWindow?
    var item: StudioAgentItem
    var title: String
    var revision: Int?
    var followsLatest = true
    var selected: [Int] = []
    init(item: StudioAgentItem) { self.item = item; title = item.title ?? item.project ?? item.key }
}

/// Lets agents drive the Studio through the watched folder described in PosterCore's StudioBridge.swift:
/// it claims commands, carries them out on the main window or in agent poster windows, replies, and publishes what is on screen.
@MainActor @Observable
final class StudioAgentBridge {
    @ObservationIgnored let inbox: StudioInbox?
    @ObservationIgnored let home: URL?
    @ObservationIgnored private weak var model: StudioModel?
    @ObservationIgnored private var review: LibraryReviewModel?
    @ObservationIgnored private var workspace: () -> StudioWorkspace = { .generate }
    @ObservationIgnored private var setWorkspace: (StudioWorkspace) -> Void = { _ in }
    @ObservationIgnored private var openViewer: (StudioAgentItem) -> Void = { _ in }
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var lastState: Data?
    @ObservationIgnored private var lastPublish = Date.distantPast
    @ObservationIgnored private var handling = false
    /// The shape library was opened on an agent's preset; restore the user's own shape when it closes.
    @ObservationIgnored private var injectedShape = false
    @ObservationIgnored var viewers: [String: StudioViewerRecord] = [:]
    var requests: [String: StudioRevisionRequest] = [:]

    init() {
        home = StudioInbox.studioHome()
        inbox = home.map(StudioInbox.init(home:))
    }

    func attach(model: StudioModel, review: LibraryReviewModel, workspace: @escaping () -> StudioWorkspace, setWorkspace: @escaping (StudioWorkspace) -> Void, openViewer: @escaping (StudioAgentItem) -> Void) {
        self.model = model; self.review = review; self.workspace = workspace; self.setWorkspace = setWorkspace; self.openViewer = openViewer
        guard timer == nil, inbox != nil else { return }
        let t = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.tick() } }
        RunLoop.main.add(t, forMode: .common)
        timer = t
        tick()
    }

    // MARK: Viewer windows report here

    func register(_ item: StudioAgentItem) -> StudioViewerRecord {
        if let r = viewers[item.key] { r.item = item; return r }
        let r = StudioViewerRecord(item: item); viewers[item.key] = r; return r
    }
    func unregister(_ item: StudioAgentItem) { viewers[item.key] = nil; publish(force: true) }
    func changed() { publish(force: true) }

    // MARK: Loop

    private func tick() {
        guard let inbox, let model else { return }
        if injectedShape, model.sheet?.name != "shapeLibrary" {
            injectedShape = false
            model.shapePreset = UserDefaults.standard.data(forKey: "posterlab-shape-preset").flatMap { try? JSONDecoder().decode(PosterShapePreset.self, from: $0) }
        }
        if !handling, let next = inbox.pending().first, inbox.claim(next.id) {
            handling = true
            Task { await self.handle(next); self.handling = false }
        }
        publish(force: false)
    }

    private func publish(force: Bool) {
        guard let inbox, let state = currentState(), let data = try? JSONEncoder().encode(Self.comparable(state)) else { return }
        guard force || data != lastState || Date().timeIntervalSince(lastPublish) > 1.5 else { return }
        try? inbox.publish(state); lastState = data; lastPublish = Date()
    }
    /// The state without its timestamp, to tell real changes from heartbeats.
    private static func comparable(_ s: StudioState) -> StudioState { var c = s; c.updated = 0; return c }

    func currentState() -> StudioState? {
        guard let model, let home else { return nil }
        let viewerWindows = Set(viewers.values.compactMap { $0.window.map(ObjectIdentifier.init) })
        let windows = NSApp.windows.filter { $0.isVisible && $0.frame.width > 80 }.map { w in
            StudioWindowInfo(title: w.title, role: w.isSheet ? "sheet" : viewerWindows.contains(ObjectIdentifier(w)) ? "viewer" : w === mainWindow ? "main" : "other",
                             width: w.frame.width.rounded(), height: w.frame.height.rounded(), key: w.isKeyWindow)
        }
        let views = viewers.values.sorted { $0.item.key < $1.item.key }.map { r in
            StudioViewerState(project: r.item.project, scene: r.item.scene, image: r.item.image, title: r.title, revision: r.revision, followsLatest: r.followsLatest,
                              selected: r.selected, focused: r.window?.isKeyWindow ?? false)
        }
        return StudioState(pid: ProcessInfo.processInfo.processIdentifier, bundleID: Bundle.main.bundleIdentifier ?? "", home: home.path, updated: Date().timeIntervalSince1970,
                           active: NSApp.isActive, workspace: workspace().rawValue, sheet: model.sheet?.name, busy: model.busy, status: model.status, error: model.error,
                           windows: windows, viewers: views, study: model.current.map { $0.directory.appending(path: "generation.json").path }, candidate: model.selectedID,
                           picks: model.picks.sorted(), library: review?.directory?.path, libraryPoster: review?.selectedID, libraryElement: review?.selectedElementID,
                           shapeRecipe: model.shapePreset?.recipe.id, fontProfile: model.fontProfileID, typeSystem: model.typeSystem?.system.name)
    }

    /// The studio window: the first visible window that is neither a sheet nor an agent poster window.
    private var mainWindow: NSWindow? {
        let viewerWindows = Set(viewers.values.compactMap { $0.window.map(ObjectIdentifier.init) })
        return NSApp.windows.first { $0.isVisible && !$0.isSheet && !viewerWindows.contains(ObjectIdentifier($0)) && $0.frame.width > 600 }
    }

    // MARK: Commands

    private func handle(_ c: StudioCommand) async {
        guard let model, let inbox else { return }
        var ok = true, message = "", window: NSWindow?
        func sheetFree(_ name: String) -> Bool {
            guard let open = model.sheet, open.name != name, !c.replace else { return true }
            ok = false; message = "The user has the \(open.name) sheet open. Pass replace=true to close it, or wait."; return false
        }
        switch c.action {
        case "show_project", "show_scene":
            let item = StudioAgentItem(project: c.project, scene: c.scene, image: c.image, title: c.title)
            requests[item.key] = StudioRevisionRequest(revision: c.revision, token: c.id)
            openViewer(item)
            try? await Task.sleep(for: .milliseconds(900))
            window = viewers[item.key]?.window
            if c.focus { window?.makeKeyAndOrderFront(nil) }
            message = c.project.map { "Showing \($0)\(c.revision.map { " r\($0)" } ?? " (following its latest revision)") in an agent poster window." } ?? "Showing \(c.title ?? c.scene ?? c.image ?? "the scene") in an agent poster window."
        case "shape_library":
            guard sheetFree("shapeLibrary") else { break }
            if model.sheet != nil { model.sheet = nil; try? await Task.sleep(for: .milliseconds(400)) }
            if let preset = c.preset { model.shapePreset = preset; injectedShape = true }
            model.sheet = .shapeLibrary
            try? await Task.sleep(for: .milliseconds(3000))
            message = "Shape library open\(c.preset.map { " on \($0.recipe.name)" } ?? ""). The user's own shape choice is restored when it closes unless they pick this one."
        case "open_study":
            guard !model.busy else { ok = false; message = "The Studio is busy (\(model.status)). Try again when it finishes."; break }
            guard let path = c.study else { ok = false; message = "open_study needs a generation.json."; break }
            if model.sheet != nil { guard c.replace else { ok = false; message = "The user has the \(model.sheet!.name) sheet open. Pass replace=true to close it."; break }; model.sheet = nil }
            model.error = nil
            setWorkspace(.generate)
            model.restoreGeneration(URL(fileURLWithPath: path))
            if let e = model.error { ok = false; message = e } else { message = "Opened the study in Generate: \(model.status)." }
            try? await Task.sleep(for: .milliseconds(700))
        case "state", "snapshot":
            message = "Studio state."
        default:
            ok = false; message = "Unknown Studio action '\(c.action)'."
        }
        if ok, c.focus, c.action != "state", c.action != "snapshot" {
            NSApp.activate()
            (window ?? mainWindow)?.makeKeyAndOrderFront(nil)
        }
        var snapshot: String?
        if c.snapshot { snapshot = writeSnapshot(id: c.id, preferred: window, inbox: inbox) }
        publish(force: true)
        try? inbox.answer(StudioReply(id: c.id, ok: ok, message: message, state: currentState(), snapshot: snapshot))
    }

    /// Draws a window into a PNG: the agent poster window a command opened, else the sheet on screen, else the key or studio window.
    private func writeSnapshot(id: String, preferred: NSWindow?, inbox: StudioInbox) -> String? {
        let sheet = NSApp.windows.last { $0.isSheet && $0.isVisible }
        guard let window = preferred ?? sheet ?? NSApp.keyWindow ?? mainWindow, let view = window.contentView,
              let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return nil }
        view.cacheDisplay(in: view.bounds, to: rep)
        try? FileManager.default.createDirectory(at: inbox.snapshots, withIntermediateDirectories: true)
        // Keep the folder small: the newest 40 snapshots.
        let old = ((try? FileManager.default.contentsOfDirectory(at: inbox.snapshots, includingPropertiesForKeys: [.contentModificationDateKey])) ?? [])
            .sorted { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) > ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) }
        for url in old.dropFirst(39) { try? FileManager.default.removeItem(at: url) }
        let url = inbox.snapshots.appending(path: "studio-\(id.prefix(8)).png")
        guard let png = rep.representation(using: .png, properties: [:]), (try? png.write(to: url)) != nil else { return nil }
        return url.path
    }
}

/// Connects the studio window to the bridge. One line in StudioRootView: `.modifier(StudioAgentHook(model:…, review:…, workspace:$workspace))`.
struct StudioAgentHook: ViewModifier {
    let model: StudioModel
    let review: LibraryReviewModel
    @Binding var workspace: StudioWorkspace
    @Environment(StudioAgentBridge.self) private var bridge
    @Environment(\.openWindow) private var openWindow
    func body(content: Content) -> some View {
        let binding = $workspace, open = openWindow
        return content.task {
            bridge.attach(model: model, review: review, workspace: { binding.wrappedValue }, setWorkspace: { binding.wrappedValue = $0 },
                          openViewer: { open(id: StudioAgentViewer.windowID, value: $0) })
        }
    }
}

/// Hands its NSWindow to a closure once the view is in one.
struct WindowReader: NSViewRepresentable {
    let found: (NSWindow) -> Void
    func makeNSView(context: Context) -> NSView { let v = Probe(); v.found = found; return v }
    func updateNSView(_ nsView: NSView, context: Context) {}
    final class Probe: NSView {
        var found: ((NSWindow) -> Void)?
        override func viewDidMoveToWindow() { super.viewDidMoveToWindow(); if let window { found?(window) } }
    }
}
