import SwiftUI
import PosterCore

/// A window that shows an agent's poster project and follows it live: each new revision the agent writes appears here.
/// Clicking elements selects them (shift/⌘ adds); agents read the selection with `studio_state` and can edit exactly those indices.
struct StudioAgentViewer: View {
    static let windowID = "agent-poster"
    let item: StudioAgentItem
    let model: StudioModel
    @Environment(StudioAgentBridge.self) private var bridge
    @State private var project: AgentProject?
    @State private var shownRevision: AgentRevision?
    @State private var scene: StyleGenome?
    @State private var image: NSImage?
    @State private var sharp: NSImage?
    @State private var follow = true
    @State private var pinned: Int?
    @State private var selection: [Int] = []
    @State private var showBoxes = true
    @State private var problem: String?
    @State private var stamp: Date?
    @State private var record: StudioViewerRecord?

    private var files: AgentProjectFiles? { bridge.home.map(AgentProjectFiles.init(home:)) }

    var body: some View {
        HStack(spacing: 0) {
            canvas.frame(minWidth: 420, maxWidth: .infinity, maxHeight: .infinity).background(Color(white: 0.16))
            Divider()
            inspector.frame(width: 320)
        }
        .frame(minWidth: 900, minHeight: 640)
        .navigationTitle(windowTitle)
        .background(WindowReader { window in let r = bridge.register(item); r.window = window; record = r; bridge.changed() })
        .task(id: item.key) { await watch(item) }
        .onChange(of: bridge.requests[item.key]) { _, request in if let request { apply(request) } }
        .onChange(of: selection) { record?.selected = selection; bridge.changed() }
        .onDisappear { bridge.unregister(item) }
    }

    private var windowTitle: String {
        guard let project else { return "Agent poster · " + (item.title ?? item.project ?? URL(fileURLWithPath: item.scene ?? item.image ?? "").lastPathComponent) }
        return "Agent poster · \(project.title) · r\(shownRevision?.number ?? project.current)"
    }

    // MARK: Canvas

    private var canvas: some View {
        GeometryReader { geo in
            if let shown = sharp ?? image {
                let ratio = shown.size.width / max(1, shown.size.height)
                let width = max(100, min(geo.size.width - 48, (geo.size.height - 48) * ratio)), height = width / ratio
                ZStack(alignment: .topLeading) {
                    Image(nsImage: shown).resizable().interpolation(.high).frame(width: width, height: height)
                        .onTapGesture { selection = [] }
                    if let scene, showBoxes || !selection.isEmpty {
                        ForEach(scene.elements.indices.reversed(), id: \.self) { i in
                            if showBoxes || selection.contains(i) { box(i, scene.elements[i], width: width, height: height) }
                        }
                    }
                }
                .frame(width: width, height: height).shadow(color: .black.opacity(0.35), radius: 14, y: 6)
                .frame(width: geo.size.width, height: geo.size.height)
            } else if let problem {
                ContentUnavailableView("Can’t show this poster", systemImage: "exclamationmark.triangle", description: Text(problem)).frame(width: geo.size.width, height: geo.size.height)
            } else {
                ProgressView().frame(width: geo.size.width, height: geo.size.height)
            }
        }
    }

    private func box(_ i: Int, _ e: SceneElement, width: Double, height: Double) -> some View {
        let b = e.bounds, on = selection.contains(i)
        return Rectangle().fill(Color.accentColor.opacity(on ? 0.14 : 0.001))
            .overlay { Rectangle().stroke(on ? Color.accentColor : Color.white.opacity(0.28), style: StrokeStyle(lineWidth: on ? 2 : 0.75, dash: on ? [] : [3, 3])) }
            .frame(width: max(6, b.width * width), height: max(6, b.height * height))
            .rotationEffect(.degrees(e.rotation))
            .position(x: (b.x + b.width / 2) * width, y: (b.y + b.height / 2) * height)
            .contentShape(Rectangle())
            .onTapGesture { toggle(i) }
            .help("#\(i) · \(AgentProjectFiles.role(e)) · \(e.text ?? e.shape)")
            .accessibilityLabel("Element \(i), \(e.text ?? e.shape)")
    }

    private func toggle(_ i: Int) {
        let flags = NSEvent.modifierFlags
        if flags.contains(.shift) || flags.contains(.command) {
            if let at = selection.firstIndex(of: i) { selection.remove(at: at) } else { selection.append(i) }
        } else { selection = selection == [i] ? [] : [i] }
    }

    // MARK: Inspector

    private var inspector: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text("AGENT POSTER").font(.caption.monospaced().bold()).tracking(1.2); Spacer(); Circle().fill(follow ? Color.green : Color.secondary).frame(width: 7, height: 7).help(follow ? "Following the agent’s latest revision" : "Pinned to one revision") }
                if let project {
                    Text(project.title).font(.title3.bold()).lineLimit(3)
                    Text(project.id).font(.caption.monospaced()).foregroundStyle(.secondary).textSelection(.enabled)
                    Picker("Revision", selection: Binding(get: { follow ? 0 : (pinned ?? project.current) }, set: { pick($0) })) {
                        Text("Latest · r\(project.current) (follow)").tag(0)
                        ForEach(project.revisions.reversed(), id: \.number) { r in Text("r\(r.number) · \(r.note)").lineLimit(1).tag(r.number) }
                    }
                    if let r = shownRevision { Text(r.note).font(.caption).foregroundStyle(.secondary) }
                } else {
                    Text(item.title ?? URL(fileURLWithPath: item.scene ?? item.image ?? "").lastPathComponent).font(.title3.bold())
                    if let path = item.scene ?? item.image { Text(path).font(.caption2.monospaced()).foregroundStyle(.secondary).textSelection(.enabled).lineLimit(4) }
                }
                Toggle("Show element boxes", isOn: $showBoxes).toggleStyle(.switch).controlSize(.small)
                Divider()
                if let scene {
                    selected(scene)
                    Divider()
                    Text("ELEMENTS · \(scene.elements.count)").font(.caption2.monospaced().bold()).foregroundStyle(.secondary)
                    ForEach(scene.elements.indices, id: \.self) { i in
                        let e = scene.elements[i]
                        Button { toggle(i) } label: {
                            HStack(spacing: 6) {
                                Text("#\(i)").font(.caption.monospacedDigit()).foregroundStyle(.secondary).frame(width: 30, alignment: .leading)
                                RoundedRectangle(cornerRadius: 2).fill(Color(hex: e.color)).frame(width: 10, height: 10).overlay { RoundedRectangle(cornerRadius: 2).stroke(.secondary.opacity(0.4)) }
                                Text(AgentProjectFiles.role(e)).font(.caption.weight(.medium))
                                Text(e.text ?? e.shape).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                Spacer(minLength: 0)
                            }.padding(.vertical, 2).padding(.horizontal, 4)
                                .background(selection.contains(i) ? Color.accentColor.opacity(0.18) : .clear, in: RoundedRectangle(cornerRadius: 4))
                                .contentShape(Rectangle())
                        }.buttonStyle(.plain)
                    }
                }
                Divider()
                HStack {
                    if let folder = project.flatMap({ files?.folder($0.id) }) { Button("Reveal", systemImage: "folder") { NSWorkspace.shared.activateFileViewerSelecting([folder]) } }
                }.controlSize(.small)
                Text("Agents see what you select here with studio_state, so you can point at an element and ask for a change.").font(.caption2).foregroundStyle(.secondary)
            }.padding(18)
        }
    }

    @ViewBuilder private func selected(_ scene: StyleGenome) -> some View {
        let picked = selection.filter { $0 < scene.elements.count }
        if picked.isEmpty {
            Text("Click an element to select it.").font(.caption).foregroundStyle(.secondary)
        } else {
            Text("SELECTED · " + picked.map { "#\($0)" }.joined(separator: " ")).font(.caption2.monospaced().bold())
            ForEach(picked, id: \.self) { i in
                let e = scene.elements[i], b = e.bounds
                VStack(alignment: .leading, spacing: 3) {
                    Text("#\(i) · \(e.sourceElementID)").font(.caption.monospaced().bold()).textSelection(.enabled)
                    if let t = e.text { Text(t).font(.callout) }
                    Text("\(AgentProjectFiles.role(e)) · \(e.kind)\(e.kind == "text" ? "" : " · " + e.shape) · \(e.color)").font(.caption)
                    Text(String(format: "x %.3f  y %.3f  w %.3f  h %.3f", b.x, b.y, b.width, b.height) + (e.rotation != 0 ? String(format: "  rot %.1f°", e.rotation) : "")).font(.caption2.monospaced()).foregroundStyle(.secondary)
                    if let f = e.fontProfileID ?? e.fontName, e.kind == "text" { Text(f).font(.caption2).foregroundStyle(.secondary) }
                }
            }
        }
    }

    // MARK: Loading

    private func pick(_ number: Int) {
        if number == 0 { follow = true; pinned = nil } else { follow = false; pinned = number }
        record?.followsLatest = follow
        reload(force: true)
    }

    private func apply(_ request: StudioRevisionRequest) {
        if let r = request.revision { follow = false; pinned = r } else { follow = true; pinned = nil }
        record?.followsLatest = follow
        reload(force: true)
    }

    /// Loads the item, then watches the project for new revisions while the window is open.
    private func watch(_ item: StudioAgentItem) async {
        record = bridge.register(item)
        if let request = bridge.requests[item.key] { apply(request) } else { reload(force: true) }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            if let id = item.project, files?.modified(id) != stamp { reload(force: false) }
        }
    }

    private func reload(force: Bool) {
        problem = nil
        if let id = item.project {
            guard let files else { problem = "This Studio has no agent folder (PosterLabProjectRoot is missing)."; return }
            do {
                let p = try files.project(id)
                stamp = files.modified(id)
                let wanted = follow ? nil : pinned
                let (s, r) = try files.scene(p, revision: wanted)
                let changed = force || r.number != shownRevision?.number || p.id != project?.id
                project = p; record?.title = p.title; record?.revision = r.number
                guard changed else { return }
                shownRevision = r; scene = s
                selection = selection.filter { $0 < s.elements.count }
                image = NSImage(contentsOf: files.preview(p, r)); sharp = nil
                render(s, seed: r.renderSeed, key: "\(p.id)#\(r.number)")
            } catch { problem = error.localizedDescription }
        } else {
            if let path = item.scene, let data = try? Data(contentsOf: URL(fileURLWithPath: path)) { scene = try? JSONDecoder().decode(StyleGenome.self, from: data) }
            image = item.image.flatMap { NSImage(contentsOfFile: $0) }
            if image == nil { problem = "Nothing to show at \(item.image ?? item.scene ?? "?")." }
        }
        bridge.changed()
    }

    /// A sharper render than the 700 px preview, for the window. Discarded if another revision arrives first.
    private func render(_ scene: StyleGenome, seed: UInt64, key: String) {
        let width = Int(min(2000, max(1000, (NSScreen.main?.frame.height ?? 1000) * (NSScreen.main?.backingScaleFactor ?? 2) * 0.75 / max(0.5, scene.aspect))))
        Task {
            let img = await Task.detached(priority: .userInitiated) { try? LibrarySceneRenderer.render(scene, width: width, seed: seed) }.value
            guard let img, "\(project?.id ?? "")#\(shownRevision?.number ?? 0)" == key else { return }
            sharp = NSImage(cgImage: img, size: NSSize(width: img.width, height: img.height))
        }
    }
}

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt64(s.prefix(6), radix: 16) ?? 0
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}
