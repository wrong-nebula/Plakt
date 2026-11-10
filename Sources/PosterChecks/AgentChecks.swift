import Foundation
import PosterCore

extension PosterChecks {
    /// The agent tool layer: registry, determinism, revisions, size-keeping text edits and error hints.
    static func checkAgent() async throws {
        let home = FileManager.default.temporaryDirectory.appending(path: "posterlab-agent-checks-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: home) }
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let agent = PosterAgent(environment: AgentEnvironment(root: root, home: home))
        func call(_ name: String, _ args: JSONValue) async -> AgentToolResult { await agent.call(name, arguments: args) }

        let names = PosterAgent.tools.map(\.name)
        try require(Set(names).count == names.count, "Duplicate agent tool names")
        try require(PosterAgent.tools.allSatisfy { $0.inputSchema["type"]?.string == "object" && $0.inputSchema["properties"]?.object != nil }, "A tool schema is not an object schema")
        for name in names where !["run_study", "sketch_variations"].contains(name) {
            let r = await call(name, [:])
            try require(!r.summary.contains("not implemented"), "\(name) is listed but not dispatched")
        }
        let parsed = try JSONDecoder().decode(JSONValue.self, from: Data("{\"a\":[1,true,null,\"x\",2.5]}".utf8))
        try require(JSONValue.number(3).text() == "3" && parsed.text() == "{\"a\":[1,true,null,\"x\",2.5]}", "JSON values do not round-trip")
        print("PASS: \(names.count) agent tools registered with object schemas")

        let unknown = await call("create_poster", ["style": "swiss", "colour": "red"])
        try require(unknown.isError && unknown.summary.contains("colour") && unknown.summary.contains("Accepted"), "Unknown arguments are not named with the accepted list")
        let args: JSONValue = ["style": "swiss", "brief": .string(ContentBriefLibrary.briefs[0].id), "seed": 42]
        let a = await call("create_poster", args), b = await call("create_poster", args)
        try require(!a.isError && !b.isError, "create_poster failed: \(a.summary)")
        guard let sceneA = a.data["scene"]?.string, let sceneB = b.data["scene"]?.string, let previewA = a.data["preview"]?.string, let previewB = b.data["preview"]?.string, let id = a.data["project"]?.string else { throw CheckFailure("create_poster returned no paths") }
        let sa = try Data(contentsOf: URL(fileURLWithPath: sceneA)), sb = try Data(contentsOf: URL(fileURLWithPath: sceneB))
        let pa = try Data(contentsOf: URL(fileURLWithPath: previewA)), pb = try Data(contentsOf: URL(fileURLWithPath: previewB))
        try require(sa == sb && pa == pb, "Same arguments and seed did not give the same scene and preview")
        print("PASS: create_poster is deterministic per seed and rejects unknown arguments")

        let table = await call("describe_poster", ["project": .string(id)])
        guard let elements = table.data["elements"]?.array, let meta = elements.first(where: { $0["role"]?.string == "meta" && ($0["text"]?.string?.count ?? 0) > 12 && ($0["align"]?.string ?? "left") == "left" }), let index = meta["index"]?.int else { throw CheckFailure("No left-aligned meta line to edit") }
        let original = try JSONDecoder().decode(StyleGenome.self, from: sa)
        let before = original.elements[index]
        let bad = await call("edit_poster", ["project": .string(id), "ops": [["op": "set_color", "target": 0, "color": "#c8102e"], ["op": "move", "target": 999, "dx": 0.1]]])
        try require(bad.isError && bad.summary.contains("Operation 1") && bad.summary.contains("out of range"), "A bad operation is not located in the error")
        let revisionsAfterFailure = await call("poster_history", ["project": .string(id)]).data["revisions"]?.array?.count
        try require(revisionsAfterFailure == 1, "A failed edit still wrote a revision")
        let edit = await call("edit_poster", ["project": .string(id), "ops": [["op": "set_text", "target": .number(Double(index)), "text": "Opening"]]])
        try require(!edit.isError, "set_text failed: \(edit.summary)")
        let scene = try JSONDecoder().decode(StyleGenome.self, from: Data(contentsOf: home.appending(path: "\(id)/scene-r002.json")))
        let after = scene.elements[index]
        try require(after.text == "Opening" && after.typeEmSize != nil, "set_text did not fix the type size")
        try require(after.bounds.width < before.bounds.width && abs(after.bounds.x - before.bounds.x) < 1e-9, "The box did not hug the shorter text at its left edge")
        let line = await call("edit_poster", ["project": .string(id), "ops": [["op": "set_text", "target": .number(Double(index)), "text": "A\nB"]]])
        try require(line.isError && line.summary.contains("one line"), "Line breaks in single-line text are not explained")
        let stacked = await call("edit_poster", ["project": .string(id), "ops": [["op": "add_text", "text": "First\nSecond", "x": 0.1, "y": 0.5, "height": 0.02]]])
        try require(stacked.data["added"]?.array?.count == 2, "add_text did not stack two lines")
        let revert = await call("revert_poster", ["project": .string(id), "revision": 1])
        let restored = try JSONDecoder().decode(StyleGenome.self, from: Data(contentsOf: home.appending(path: "\(id)/scene-r004.json")))
        try require(!revert.isError && restored.elements.count == original.elements.count && restored.elements[index].text == before.text, "Revert did not restore revision 1")
        print("PASS: edits are atomic, keep type size, explain line breaks, stack lines and revert as new revisions")

        let missing = await call("describe_poster", ["project": "p-missing-0000"])
        try require(missing.isError && missing.data["hint"] != nil, "Missing projects come without a hint")
        let escape = await call("describe_poster", ["project": "../etc"])
        try require(escape.isError, "Project ids can leave the agent folder")
        print("PASS: errors carry hints; project ids stay inside the agent folder")
        try checkAgentOutputPaths()

        try await checkStudioBridge(agent: agent, home: home, project: id)
    }

    /// open_in_studio / studio_state against a stand-in Studio that speaks the inbox protocol (the real app is checked by hand; see README).
    /// Where export_poster and run_study may write when given `out`.
    static func checkAgentOutputPaths() throws {
        let fm = FileManager.default
        let base = fm.temporaryDirectory.appending(path: "posterlab-agent-paths-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: base) }
        let root = base.appending(path: "posterlab"), environment = AgentEnvironment(root: root, home: root.appending(path: "output/agent"))
        for folder in ["library/posters", "taste", "Sources", "output/agent", "output/glass-study-v1"] { try fm.createDirectory(at: root.appending(path: folder), withIntermediateDirectories: true) }
        for refused in ["library/posters/x", "LIBRARY/x", "taste", "Sources/PosterCore", ".", "output", "output/glass-study-v1/export", "output/agent/../glass-study-v1", root.appending(path: "taste/x").path] {
            do { _ = try environment.outputFolder(refused); throw CheckFailure("out=\(refused) is accepted as a folder to write into") }
            catch let error as AgentError { try require(error.hint?.contains("output/<name>") == true, "The refusal of out=\(refused) names no way out") }
        }
        let outside = base.appending(path: "elsewhere/export")
        let elsewhere = try environment.outputFolder(outside.path)
        try require(elsewhere.lastPathComponent == "export", "A folder outside PosterLab comes back changed")
        _ = try environment.outputFolder("output/agent/p-1/export-wide")
        let first = try environment.outputFolder("output/agent-exports/one")
        try environment.startOutput(first)
        try require(fm.fileExists(atPath: root.appending(path: "output/agent-exports/\(AgentEnvironment.outputMarker)").path), "A new output folder is not marked as agent-made")
        try environment.startOutput(try environment.outputFolder("output/agent-exports/two"))
        try environment.startOutput(root.appending(path: "output/agent/p-1/export-wide"))
        try require(!fm.fileExists(atPath: root.appending(path: "output/agent/\(AgentEnvironment.outputMarker)").path), "The agent folder itself was marked")
        let link = base.appending(path: "shortcut")
        try fm.createSymbolicLink(at: link, withDestinationURL: root.appending(path: "library"))
        try require(rejected { _ = try environment.outputFolder(link.appending(path: "x").path) }, "A symlink into library/ is accepted as a folder to write into")
        print("PASS: export and study folders stay out of library/, taste/, the sources and other sessions' output")
    }

    static func checkStudioBridge(agent: PosterAgent, home: URL, project id: String) async throws {
        func call(_ name: String, _ args: JSONValue) async -> AgentToolResult { await agent.call(name, arguments: args) }
        let inbox = StudioInbox(home: home)
        let idle = await call("studio_state", [:])
        try require(!idle.isError && idle.data["running"]?.bool == false && idle.summary.contains("isn't running"), "studio_state without a Studio is not a plain 'not running'")
        let offline = await call("open_in_studio", ["project": .string(id), "launch": false])
        try require(offline.isError && offline.data["hint"] != nil, "open_in_studio without a Studio gives no hint")
        let badView = await call("open_in_studio", ["project": .string(id), "view": "gallery"])
        try require(badView.isError && badView.summary.contains("view must be"), "An unknown view is not rejected before launching")
        func state(_ updated: Double, viewers: [StudioViewerState] = [], sheet: String? = nil) -> StudioState {
            StudioState(pid: getpid(), bundleID: StudioInbox.bundleID, home: home.path, updated: updated, active: true, workspace: "generate", sheet: sheet, busy: false, status: "Ready",
                        error: nil, windows: [StudioWindowInfo(title: "PosterLab", role: "main", width: 1440, height: 960, key: true)], viewers: viewers, study: nil, candidate: nil,
                        picks: [], library: nil, libraryPoster: nil, libraryElement: nil, shapeRecipe: nil, fontProfile: nil, typeSystem: nil)
        }
        try inbox.publish(state(Date().timeIntervalSince1970 - 60))
        let stale = await call("studio_state", [:])
        try require(stale.data["running"]?.bool == false && stale.summary.contains("last seen"), "A stale heartbeat still counts as running")
        print("PASS: studio tools explain a missing or stale Studio and validate before launching")

        // A stand-in Studio: heartbeats, claims commands, shows projects in a viewer with elements 0 and 1 selected, declines the shape library unless replace=true.
        let fake = FakeStudio()
        try inbox.publish(state(Date().timeIntervalSince1970, sheet: "tasteCheck"))
        let loop = Task {
            while !Task.isCancelled {
                try? inbox.publish(state(Date().timeIntervalSince1970, viewers: fake.viewers, sheet: "tasteCheck"))
                if fake.answering {
                    for c in inbox.pending() where inbox.claim(c.id) {
                        fake.record(c)
                        if c.action == "show_project" { fake.viewers = [StudioViewerState(project: c.project, scene: nil, image: nil, title: c.title ?? "", revision: c.revision, followsLatest: c.revision == nil, selected: [0, 1], focused: true)] }
                        let ok = c.action != "shape_library" || c.replace
                        try? inbox.answer(StudioReply(id: c.id, ok: ok, message: ok ? "Done \(c.action)." : "The user has the tasteCheck sheet open.", state: state(Date().timeIntervalSince1970, viewers: fake.viewers), snapshot: nil))
                    }
                }
                try? await Task.sleep(for: .milliseconds(40))
            }
        }
        defer { loop.cancel() }
        let shown = await call("open_in_studio", ["launch": false, "project": .string(id), "snapshot": false])
        try require(!shown.isError && shown.data["launched"]?.bool == false, "open_in_studio failed against a running Studio: \(shown.summary)")
        try require(shown.data["state"]?["viewers"]?.array?.first?["project"]?.string == id, "The reply's state does not show the project")
        guard let first = fake.commands.first else { throw CheckFailure("The Studio received no command") }
        try require(first.action == "show_project" && first.project == id && first.revision == nil && first.focus && !first.snapshot, "show_project carried the wrong fields")
        let leftovers = ((try? FileManager.default.contentsOfDirectory(atPath: inbox.commands.path)) ?? []) + ((try? FileManager.default.contentsOfDirectory(atPath: inbox.replies.path)) ?? [])
        try require(leftovers.filter { $0.hasSuffix(".json") }.isEmpty, "Commands or replies were left in the inbox: \(leftovers)")
        _ = await call("open_in_studio", ["launch": false, "project": .string(id), "revision": 1, "focus": false])
        try require(fake.commands.last?.revision == 1 && fake.commands.last?.focus == false, "A pinned revision or focus=false did not reach the Studio")
        print("PASS: open_in_studio shows a project in a poster window, pins revisions and leaves the inbox empty")

        let noShape = await call("open_in_studio", ["launch": false, "project": .string(id), "view": "shape_library"])
        try require(noShape.isError && noShape.data["hint"] != nil, "A project without a recipe opened the shape library")
        let recipe = PosterShapeLibrary.recipes[0].id
        let declined = await call("open_in_studio", ["launch": false, "recipe": .string(recipe)])
        try require(declined.isError && declined.summary.contains("declined") && declined.summary.contains("tasteCheck"), "A sheet the user has open was not respected")
        let shape = await call("open_in_studio", ["launch": false, "recipe": .string(recipe), "replace": true])
        try require(!shape.isError && fake.commands.last?.action == "shape_library" && fake.commands.last?.preset?.recipe.id == recipe, "A recipe did not open the shape library on it")
        // The 3D print preview is out of the app for now; the tool says which views exist instead of sending a command nothing answers.
        let sent = fake.commands.count
        let removed = await call("open_in_studio", ["launch": false, "project": .string(id), "view": "print_preview"])
        try require(removed.isError && removed.summary.contains("view must be") && fake.commands.count == sent, "A removed view was not refused before reaching the Studio")
        print("PASS: the shape library opens on a recipe and respects open sheets; a removed view is refused with the list of views")

        let selected = await call("studio_state", [:])
        let rows = selected.data["viewers"]?.array?.first?["selectedElements"]?.array ?? []
        try require(selected.data["running"]?.bool == true && rows.map { $0["index"]?.int } == [0, 1] && rows.allSatisfy { $0["role"]?.string != nil }, "studio_state does not return the selected elements as describe rows")
        try require(selected.summary.contains(id) && selected.summary.contains("#0"), "studio_state's summary does not name the selection: \(selected.summary)")
        fake.answering = false
        let silent = await call("open_in_studio", ["launch": false, "project": .string(id), "wait": 1])
        try require(silent.isError && silent.summary.contains("didn't answer"), "A Studio that doesn't answer did not time out")
        try require(((try? FileManager.default.contentsOfDirectory(atPath: inbox.commands.path)) ?? []).filter { $0.hasSuffix(".json") }.isEmpty, "A timed-out command was not withdrawn")
        print("PASS: studio_state returns the user's selection as element rows; unanswered commands time out and are withdrawn")
    }
}

/// The stand-in Studio's memory, shared between the check and its loop.
final class FakeStudio: @unchecked Sendable {
    private let lock = NSLock()
    private var _commands: [StudioCommand] = [], _viewers: [StudioViewerState] = [], _answering = true
    var commands: [StudioCommand] { lock.withLock { _commands } }
    func record(_ c: StudioCommand) { lock.withLock { _commands.append(c) } }
    var viewers: [StudioViewerState] { get { lock.withLock { _viewers } } set { lock.withLock { _viewers = newValue } } }
    var answering: Bool { get { lock.withLock { _answering } } set { lock.withLock { _answering = newValue } } }
}
