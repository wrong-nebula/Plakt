import Foundation
import CoreGraphics

/// Tools that drive the running PosterLab Agent Studio through its inbox (see StudioBridge.swift).
extension PosterAgent {
    static let studioViews = ["inspector", "shape_library", "study"]

    static let studioTools: [AgentToolSpec] = [
        AgentToolSpec(name: "open_in_studio", title: "Show in the Studio",
                      description: "Shows something in the user's running PosterLab Agent Studio (starts it if needed): an agent project in a live poster window that follows each new revision you make (view=inspector, the default), the shape library on the project's recipe, or a study (generation.json) in Generate. Returns what the Studio now shows and a PNG of that window. Use it when the user should see or judge your work in the app.",
                      inputSchema: Schema.object([
                        "project": Schema.string("Agent project id (from create_poster or list_projects)."),
                        "revision": Schema.integer("Pin the poster window to this revision; default follows the latest.", min: 1),
                        "path": Schema.string("Instead of a project: a scene JSON or PNG (inspector), or a study's generation.json (study)."),
                        "recipe": Schema.string("view=shape_library: the shape recipe to open (default: the project's recipe)."),
                        "view": Schema.string("Where to show it (default inspector; study for a generation.json).", options: studioViews),
                        "replace": Schema.boolean("Close a sheet the user has open to show this one (default false: report it instead)."),
                        "focus": Schema.boolean("Bring the Studio to the front (default true)."),
                        "launch": Schema.boolean("Start the Studio if it isn't running (default true)."),
                        "snapshot": Schema.boolean("Return a PNG of the Studio window that shows it (default true)."),
                        "wait": Schema.number("Seconds to wait for the Studio to start and answer (default 20).", min: 1, max: 120),
                      ]), readOnly: false),
        AgentToolSpec(name: "studio_state", title: "What the user sees in the Studio",
                      description: "Reads the running Studio: open poster windows (project, revision, and the elements the user selected, as describe_poster rows you can target by index), the main window's workspace and sheet, the study candidate or library poster selected, the current shape/font/type system, and window sizes. snapshot=true adds a PNG of the front window. Says so plainly when the Studio isn't running.",
                      inputSchema: Schema.object(["snapshot": Schema.boolean("Also return a PNG of the front Studio window (default false).")]), readOnly: true),
    ]

    var studioInbox: StudioInbox { StudioInbox(home: environment.home) }

    // MARK: open_in_studio

    func openInStudio(_ a: AgentArguments) async throws -> AgentToolResult {
        let view = try a.string("view")
        if let view, !Self.studioViews.contains(view) { throw AgentError("view must be " + Self.studioViews.joined(separator: ", ") + ".") }
        var command: StudioCommand, label: String
        if let id = try a.string("project") {
            let p = try store.load(id), rev = try store.revision(p, try a.int("revision"))
            label = "\(p.id) r\(rev.number)"
            switch view ?? "inspector" {
            case "inspector":
                command = StudioCommand(action: "show_project", project: p.id, revision: a.has("revision") ? rev.number : nil, title: p.title)
            case "shape_library":
                let recipe = try a.string("recipe") ?? p.origin.recipe
                guard let recipe else { throw AgentError("\(p.id) was made without a shape recipe.", hint: "Pass recipe (see list_shape_recipes), or use a project made with mode=shape or mode=source + recipe.") }
                let origin = AgentArguments(p.origin.arguments ?? .object([:]))
                command = StudioCommand(action: "shape_library", title: p.title, preset: try studioPreset(recipe, origin, seed: p.origin.seed, sameRecipe: recipe == p.origin.recipe))
                label = recipe
            default:
                throw AgentError("view=study shows a study, not a project.", hint: "Pass path to a generation.json (from run_study or inspect_study).")
            }
        } else if let path = try a.string("path") {
            let url = environment.path(path)
            guard FileManager.default.fileExists(atPath: url.path) else { throw AgentError("No file at \(url.path).") }
            let ext = url.pathExtension.lowercased(), name = url.deletingPathExtension().lastPathComponent
            label = url.lastPathComponent
            if url.lastPathComponent == "generation.json" || view == "study" {
                guard url.lastPathComponent == "generation.json" else { throw AgentError("view=study needs a generation.json.", hint: "Studies are folders with generation.json; see run_study / inspect_study.") }
                _ = try EvolutionEngine.load(url)
                guard view == nil || view == "study" else { throw AgentError("A generation.json opens as view=study.") }
                command = StudioCommand(action: "open_study", study: url.path)
            } else if ext == "json" {
                let (scene, seed) = try sceneFile(url)
                let tag = String(format: "%08x", url.path.utf8.reduce(UInt32(2166136261)) { ($0 ^ UInt32($1)) &* 16777619 })
                switch view ?? "inspector" {
                case "inspector":
                    let png = try artwork(scene, seed: seed, to: environment.home.appending(path: "studio/scenes/\(name)-\(tag)-1400.png"), width: 1400)
                    command = StudioCommand(action: "show_scene", scene: url.path, image: png.path, title: scene.posterCopy?.title.replacingOccurrences(of: "\n", with: " ") ?? url.deletingLastPathComponent().lastPathComponent)
                default: throw AgentError("A scene file opens in the inspector.", hint: "For the shape library pass a project or recipe.")
                }
            } else if ["png", "jpg", "jpeg", "tif", "tiff", "heic", "webp"].contains(ext) {
                switch view ?? "inspector" {
                case "inspector": command = StudioCommand(action: "show_scene", image: url.path, title: url.lastPathComponent)
                default: throw AgentError("An image opens in the inspector.")
                }
            } else { throw AgentError("\(url.lastPathComponent) isn't a scene JSON, image or generation.json.") }
        } else if let recipe = try a.string("recipe") {
            guard view == nil || view == "shape_library" else { throw AgentError("recipe alone opens view=shape_library.") }
            command = StudioCommand(action: "shape_library", preset: try studioPreset(recipe, AgentArguments(.object([:])), seed: 817, sameRecipe: false))
            label = recipe
        } else {
            throw AgentError("open_in_studio needs project, path or recipe.", hint: "e.g. {\"project\":\"p-biennale-3fa2\"} or {\"recipe\":\"survey-sliced-orb\"}.")
        }
        command.replace = try a.bool("replace") ?? false
        command.focus = try a.bool("focus") ?? true
        command.snapshot = try a.bool("snapshot") ?? true
        let wait = try a.double("wait", range: 1...120) ?? 20
        let (running, launched) = try await ensureStudio(launch: try a.bool("launch") ?? true, focus: command.focus, wait: wait)
        guard let reply = try await studioInbox.send(command, timeout: launched ? max(wait, 15) : wait) else {
            throw AgentError("The Studio (pid \(running.pid)) didn't answer within the wait.", hint: "It may be showing a dialog or busy on the main thread. Call studio_state, or look at the app.")
        }
        var data: [String: JSONValue] = ["ok": .bool(reply.ok), "message": .string(reply.message), "action": .string(command.action), "launched": .bool(launched), "shown": .string(label)]
        if let s = reply.state { data["state"] = try JSONValue.from(s) }
        if let image = command.image { data["artwork"] = .string(image) }
        var images: [AgentImage] = []
        if let snap = reply.snapshot { data["snapshot"] = .string(snap); images.append(AgentImage(url: URL(fileURLWithPath: snap), caption: "Studio · \(label)")) }
        let summary = (reply.ok ? "" : "Studio declined: ") + reply.message + (launched ? " (Studio started.)" : "")
        return AgentToolResult(summary: summary, data: .object(data), images: images, isError: !reply.ok)
    }

    // MARK: studio_state

    func studioStateTool(_ a: AgentArguments) async throws -> AgentToolResult {
        let inbox = studioInbox
        guard var state = inbox.liveState() else {
            var data: [String: JSONValue] = ["running": false, "inbox": .string(inbox.folder.path)]
            var seen = ""
            if let last = inbox.state() {
                let ago = Int(Date().timeIntervalSince1970 - last.updated)
                data["lastSeenSecondsAgo"] = .number(Double(ago)); seen = " (last seen \(ago) s ago)"
            }
            return AgentToolResult(summary: "PosterLab Agent Studio isn't running\(seen). open_in_studio starts it and shows a poster.", data: .object(data))
        }
        var images: [AgentImage] = [], snapshot: String?
        if try a.bool("snapshot") ?? false {
            guard let reply = try await inbox.send(StudioCommand(action: "snapshot", focus: false, snapshot: true), timeout: 10) else {
                throw AgentError("The Studio (pid \(state.pid)) didn't answer the snapshot request.", hint: "It may be showing a dialog. The state below is from its last heartbeat; call again without snapshot.")
            }
            if let s = reply.state { state = s }
            snapshot = reply.snapshot
            if let snapshot { images.append(AgentImage(url: URL(fileURLWithPath: snapshot), caption: "Studio")) }
        }
        var data = try JSONValue.from(state).object ?? [:]
        data["running"] = true
        if let snapshot { data["snapshot"] = .string(snapshot) }
        var lines: [String] = [], viewers: [JSONValue] = []
        for v in state.viewers {
            var o = try JSONValue.from(v).object ?? [:]
            var picked: [JSONValue] = []
            if let id = v.project, !v.selected.isEmpty, let p = try? store.load(id), let pair = try? store.scene(p, revision: v.revision) {
                let table = AgentScene.describe(pair.0)["elements"]?.array ?? []
                picked = v.selected.compactMap { $0 >= 0 && $0 < table.count ? table[$0] : nil }
                o["selectedElements"] = .array(picked)
            }
            viewers.append(.object(o))
            let what = v.project.map { "\($0)\(v.revision.map { " r\($0)" } ?? "")\(v.followsLatest ? " (following latest)" : " (pinned)")" } ?? v.title
            let sel = picked.isEmpty ? (v.selected.isEmpty ? "nothing selected" : "selected " + v.selected.map { "#\($0)" }.joined(separator: ", "))
                : "selected " + picked.map { e in "#\(e["index"]?.int ?? -1) \(e["role"]?.string ?? "")" + (e["text"]?.string.map { " “\($0)”" } ?? "") }.joined(separator: ", ")
            lines.append("Poster window\(v.focused ? " (front)" : "") \(what): \(sel).")
        }
        data["viewers"] = .array(viewers)
        var head = "Studio running (pid \(state.pid)\(state.active ? ", in front" : ", in the background")). Workspace \(state.workspace)"
        if let s = state.sheet { head += ", \(s) sheet open" }
        head += state.busy ? ", busy: \(state.status)." : "."
        if let c = state.candidate, state.workspace == "generate" { lines.append("Study candidate \(c) selected" + (state.picks.isEmpty ? "." : "; parents " + state.picks.joined(separator: ", ") + ".")) }
        if let p = state.libraryPoster, state.workspace == "review" { lines.append("Library poster \(p)" + (state.libraryElement.map { ", element \($0)" } ?? "") + " selected.") }
        if let e = state.error { lines.append("Studio error: \(e)") }
        return AgentToolResult(summary: ([head] + lines).joined(separator: " "), data: .object(data), images: images)
    }

    // MARK: Helpers

    /// A running Studio's state, starting the app first when allowed.
    func ensureStudio(launch: Bool, focus: Bool, wait: Double) async throws -> (StudioState, Bool) {
        let inbox = studioInbox
        if let s = inbox.liveState() { return (s, false) }
        let app = studioApp()
        guard launch else {
            throw AgentError("PosterLab Agent Studio isn't running.", hint: app.map { "Call again with launch=true, or open \($0.path)." } ?? "Build it with zsh scripts/build-agent-studio.sh.")
        }
        guard let app else { throw AgentError("PosterLab Agent Studio isn't built.", hint: "Build it with zsh scripts/build-agent-studio.sh (or set POSTERLAB_STUDIO_APP to the .app).") }
        let open = Process()
        open.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        open.arguments = (focus ? [] : ["-g"]) + ["-a", app.path, "--env", "POSTERLAB_AGENT_HOME=" + environment.home.path, "--env", "POSTERLAB_ROOT=" + environment.root.path]
        try open.run(); open.waitUntilExit()
        guard open.terminationStatus == 0 else { throw AgentError("Could not start \(app.path) (open exited \(open.terminationStatus)).") }
        let deadline = Date().addingTimeInterval(wait)
        while Date() < deadline {
            try Task.checkCancellation()
            if let s = inbox.liveState() { return (s, true) }
            try await Task.sleep(for: .milliseconds(250))
        }
        throw AgentError("Started \(app.lastPathComponent), but it didn't report in within \(Int(wait)) s.",
                         hint: "It watches \(inbox.folder.path). If it was already open with another agent folder, quit it and call again; or pass a longer wait.")
    }

    /// The Studio app: POSTERLAB_STUDIO_APP, else beside this executable, else PosterLab's dist folder, else the agent copy's.
    func studioApp() -> URL? {
        let fm = FileManager.default
        var candidates: [URL] = []
        if let p = ProcessInfo.processInfo.environment["POSTERLAB_STUDIO_APP"], !p.isEmpty { candidates.append(URL(fileURLWithPath: (p as NSString).expandingTildeInPath)) }
        if let exe = Bundle.main.executableURL?.resolvingSymlinksInPath() { candidates.append(exe.deletingLastPathComponent().appending(path: "PosterLab Agent.app")) }
        candidates.append(environment.root.appending(path: "dist/PosterLab Agent.app"))
        candidates.append(environment.root.appending(path: "workspaces/agent/dist/PosterLab Agent.app"))
        return candidates.first { fm.fileExists(atPath: $0.appending(path: "Contents/MacOS").path) }
    }

    /// A large render for a scene window, cached by path.
    private func artwork(_ scene: StyleGenome, seed: UInt64, to url: URL, width: Int = 2400) throws -> URL {
        if FileManager.default.fileExists(atPath: url.path) { return url }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try PosterRenderer.png(try LibrarySceneRenderer.render(scene, width: width, seed: seed), to: url)
        return url
    }

    /// The shape preset create_poster would have used, from a project's arguments (or a bare recipe).
    private func studioPreset(_ id: String, _ origin: AgentArguments, seed: UInt64, sameRecipe: Bool) throws -> PosterShapePreset {
        guard let recipe = PosterShapeLibrary.recipe(id) else { throw AgentError("Unknown shape recipe '\(id)'.", hint: "Call list_shape_recipes.") }
        var p = PosterShapePreset(recipe: recipe, seed: seed, parameters: [:], fontProfileID: try origin.string("font_profile"))
        guard sameRecipe else { return p }
        var values: [String: Double] = [:]
        if let name = try origin.string("look"), let look = recipe.look(name) { values = look.parameters; p.inks = look.inks; p.paper = look.paper }
        for (k, v) in try origin.numbers("shape_parameters") ?? [:] { values[k] = v }
        p.parameters = values
        if let inks = try origin.strings("inks") { p.inks = inks }
        return p
    }
}
