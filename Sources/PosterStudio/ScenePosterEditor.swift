import SwiftUI
import PosterCore
import UniformTypeIdentifiers

/// One modifier in the editor's stack. An area modifier acts inside a soft circle placed on the
/// poster (x, y as fractions of the page, radius as a fraction of its width).
struct EditorModifier: Identifiable, Equatable {
    var id = UUID()
    var type: String
    var strength = 1.0
    var area = false
    var x = 0.5
    var y = 0.45
    var radius = 0.28
    var name: String { type.prefix(1).uppercased() + type.dropFirst() }
    var engineJSON: [String: Any] {
        let field: [String: Any] = area
            ? ["shape": "radial", "x": x, "y": y, "radius": radius, "softness": 0.6, "follow": false, "drive": "static"]
            : ["shape": "all", "follow": false, "drive": "static"]
        return ["type": type, "strength": strength, "field": field]
    }
}

/// Edits one finished poster with direct controls: select an element to move, scale or rotate
/// it; place modifiers as circles on the poster. The type stays live: modifiers re-run after
/// each edit, and nothing is a flat image until you export.
@MainActor @Observable
final class ScenePosterEditorModel {
    let original: StyleGenome
    let seed: UInt64
    let folder: URL
    /// The poster with live type; every edit lands here.
    var plain: StyleGenome
    /// Modifiers run on the display type of `plain`.
    var stack: [EditorModifier]
    /// What is drawn and exported: `plain` with the modifier layer.
    var shown: StyleGenome
    var preview: NSImage?
    var selected: Int?
    /// Everything selected; `selected` is the one last clicked.
    var group: Set<Int> = []
    var tweaking = false
    var tweakDone = 0
    var tweakTotal = 0
    /// Outlines of the versions being tried, in page units (x of width, y of height), computed once.
    var ghosts: [TweakGhost] = []
    /// The selection's outline while the jury works, in page units.
    var tweakOutline: [[CGPoint]] = []
    var variations: [TweakVariation] = []
    /// Bumped when a tweak lands, so the preview crossfades instead of cutting.
    var previewVersion = 0
    /// The poster before the last tweak, while its versions are being compared.
    var tweakBase: StyleGenome?
    /// Which judged version is on screen.
    var previewing = 0
    /// Parameter values chosen for each placed type system, by system id.
    var systemOverrides: [String: [String: Double]] = [:]
    var busy = false
    var message: String?
    var history: [(StyleGenome, [EditorModifier])] = []
    var future: [(StyleGenome, [EditorModifier])] = []
    private var renderTask: Task<Void, Never>?
    private let modifierWorker = ModifierWorker()
    @ObservationIgnored private var refreshGeneration = 0

    var canUndo: Bool { !history.isEmpty }
    var canRedo: Bool { !future.isEmpty }

    init(_ winner: StudyWinner) {
        original = winner.genome; seed = winner.seed; folder = winner.folder
        plain = Self.withoutModifiers(winner.genome)
        stack = Self.applied(winner.genome).map { EditorModifier(type: $0) }
        shown = winner.genome
        render()
    }

    static func withoutModifiers(_ g: StyleGenome) -> StyleGenome {
        var g = g
        g.elements.removeAll { $0.kind == "vector" }
        for i in g.elements.indices where g.elements[i].kind == "text" && (g.elements[i].minimumStage ?? 0) >= 99 { g.elements[i].minimumStage = 1 }
        return g
    }
    static func applied(_ g: StyleGenome) -> [String] {
        (g.layoutInheritance?.operations ?? []).last { $0.hasPrefix("Modifiers on display type: ") }
            .map { String($0.dropFirst("Modifiers on display type: ".count).prefix { $0 != "(" }).trimmingCharacters(in: .whitespaces).components(separatedBy: " + ") } ?? []
    }

    // MARK: What can be edited

    func isDisplay(_ e: SceneElement) -> Bool { e.kind == "text" && !e.sourceElementID.hasPrefix("meta:") && !e.sourceElementID.hasPrefix("title:source-info") }
    func isForm(_ e: SceneElement) -> Bool { e.kind == "shape" && (e.sourceElementID.hasPrefix("art:") || e.sourceElementID.contains("image-response")) }
    /// Any visible element except whole-page backgrounds and the modifier layer.
    func selectable(_ e: SceneElement) -> Bool { e.kind != "vector" && (e.minimumStage ?? 0) < 99 && e.bounds.width * e.bounds.height < 0.85 && e.sourceElementID != "graphic:paper" }
    var formIndices: [Int] { plain.elements.indices.filter { isForm(plain.elements[$0]) } }
    var formsVisible: Bool { formIndices.contains { (plain.elements[$0].minimumStage ?? 0) < 99 } }

    // MARK: History

    func commit() {
        // Editing while comparing tweak versions keeps the one on screen.
        if tweakBase != nil { acceptTweak() }
        history.append((plain, stack)); future = []
        if history.count > 80 { history.removeFirst() }
    }
    func undo() { guard let last = history.popLast() else { return }; future.append((plain, stack)); (plain, stack) = last; selected = nil; group = []; refresh() }
    func redo() { guard let next = future.popLast() else { return }; history.append((plain, stack)); (plain, stack) = next; selected = nil; group = []; refresh() }
    func reset() { commit(); plain = Self.withoutModifiers(original); stack = Self.applied(original).map { EditorModifier(type: $0) }; selected = nil; refresh() }

    // MARK: Edits

    /// While dragging, the plain poster is drawn for speed; modifiers re-run when the drag ends.
    func live(_ edit: (inout StyleGenome) -> Void) { edit(&plain); shown = plain; render() }
    func setElement(_ index: Int, _ edit: (inout SceneElement) -> Void) { commit(); edit(&plain.elements[index]); refresh() }
    func toggleForms() {
        commit(); let hide = formsVisible
        for i in formIndices { plain.elements[i].minimumStage = hide ? 99 : 0 }
        if hide, let s = selected, isForm(plain.elements[s]) { selected = nil }
        refresh()
    }

    // Colours: the paper, then each distinct ink of the display type, the forms and the information.
    enum Swatch: Hashable { case paper, display(String), form(String), info(String) }
    var swatches: [Swatch] {
        var list: [Swatch] = [.paper], seen = Set<String>()
        for e in plain.elements where isDisplay(e) && seen.insert("d" + e.color.lowercased()).inserted { list.append(.display(e.color.lowercased())) }
        for e in plain.elements where isForm(e) && seen.insert("f" + e.color.lowercased()).inserted { list.append(.form(e.color.lowercased())) }
        for e in plain.elements where e.kind == "text" && !isDisplay(e) && seen.insert("i" + e.color.lowercased()).inserted { list.append(.info(e.color.lowercased())) }
        return Array(list.prefix(7))
    }
    func hex(_ swatch: Swatch) -> String { switch swatch { case .paper: plain.background; case .display(let h), .form(let h), .info(let h): h } }
    func recolour(_ swatch: Swatch, to new: String) {
        commit()
        switch swatch {
        case .paper:
            let old = plain.background.lowercased(); plain.background = new
            for i in plain.elements.indices where plain.elements[i].kind == "shape" && plain.elements[i].color.lowercased() == old { plain.elements[i].color = new }
        case .display(let old): for i in plain.elements.indices where isDisplay(plain.elements[i]) && plain.elements[i].color.lowercased() == old { plain.elements[i].color = new }
        case .form(let old): for i in formIndices where plain.elements[i].color.lowercased() == old { plain.elements[i].color = new }
        case .info(let old): for i in plain.elements.indices where plain.elements[i].kind == "text" && !isDisplay(plain.elements[i]) && plain.elements[i].color.lowercased() == old { plain.elements[i].color = new }
        }
        refresh()
    }

    // MARK: Modifiers

    func addModifier(_ type: String) {
        commit()
        var m = EditorModifier(type: type)
        // New area modifiers step down the poster so their circles don't stack on one spot.
        m.y = 0.3 + Double(stack.count % 3) * 0.2
        stack.append(m); refresh()
    }
    func removeModifier(_ id: UUID) { commit(); stack.removeAll { $0.id == id }; refresh() }
    func updateModifier(_ id: UUID, commitFirst: Bool = true, refreshAfter: Bool = true, _ edit: (inout EditorModifier) -> Void) {
        guard let i = stack.firstIndex(where: { $0.id == id }) else { return }
        if commitFirst { commit() }
        edit(&stack[i])
        if refreshAfter { refresh() }
    }

    /// Re-runs the modifier stack on the current type and redraws. The engine works off the main
    /// thread; a newer edit supersedes an older run, so only the latest result is shown.
    func refresh() {
        refreshGeneration += 1
        let generation = refreshGeneration
        guard !stack.isEmpty else { shown = plain; render(); return }
        busy = true
        // Plain type shows at once; the modified layer replaces it when ready.
        if shown.elements.contains(where: { $0.kind == "vector" }) == false { shown = plain; render() }
        let displayIDs = Set(plain.elements.filter { isDisplay($0) && ($0.minimumStage ?? 0) < 99 }.map(\.sourceElementID))
        let json = (try? JSONSerialization.data(withJSONObject: stack.map(\.engineJSON))).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        let url = folder.appending(path: "edit-\(UUID().uuidString.prefix(6)).type.pdf")
        let scene = plain, seed = seed, worker = modifierWorker
        Task {
            let result = await worker.apply(scene, stackJSON: json, displayIDs: displayIDs, seed: seed, to: url)
            guard generation == refreshGeneration else { return }
            switch result {
            case .success(let modified): shown = modified; message = nil
            case .failure(let error): shown = scene; message = error.localizedDescription
            }
            busy = false
            render()
        }
    }

    // MARK: Drawing and export

    func render() {
        renderTask?.cancel()
        let scene = shown, seed = seed
        renderTask = Task {
            // Drawn off the main thread; only the finished image comes back.
            let drawn = await Task.detached(priority: .userInitiated) { try? LibrarySceneRenderer.render(scene, width: 1100, seed: seed) }.value
            guard let drawn, !Task.isCancelled else { return }
            preview = NSImage(cgImage: drawn, size: NSSize(width: drawn.width, height: drawn.height))
        }
    }
    func export(pdf: Bool) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [pdf ? .pdf : .png]; panel.nameFieldStringValue = "poster." + (pdf ? "pdf" : "png")
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            if pdf { try LibrarySceneRenderer.pdf(shown, to: url, seed: seed) }
            else { try PosterRenderer.png(LibrarySceneRenderer.render(shown, width: 3000, seed: seed), to: url) }
            message = "Saved \(url.lastPathComponent)"
        } catch { message = error.localizedDescription }
    }
}

// MARK: - View

struct ScenePosterEditor: View {
    @State private var model: ScenePosterEditorModel
    var done: () -> Void = {}
    @State private var gesture: CanvasGesture?
    @State private var tab = PanelTab.edit
    @State private var marquee: CGRect?
    @FocusState private var canvasFocused: Bool
    private let accent = LiveStudyStage.accent
    static let fieldColours: [Color] = [Color(red: 0.24, green: 0.48, blue: 0.96), Color(red: 0.93, green: 0.29, blue: 0.6), Color(red: 0.2, green: 0.72, blue: 0.45), Color(red: 0.96, green: 0.62, blue: 0.1)]

    init(winner: StudyWinner, done: @escaping () -> Void = {}) { _model = State(initialValue: ScenePosterEditorModel(winner)); self.done = done }
    init(model: ScenePosterEditorModel) { _model = State(initialValue: model) }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                label("EDIT POSTER").foregroundStyle(.secondary)
                if model.busy { ProgressView().controlSize(.mini) }
                if let message = model.message { Text(message).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1) }
                Spacer()
                Button(model.tweaking ? "Judging \(model.tweakDone)/\(model.tweakTotal)" : "Tweak") { Task { await model.tweak() } }
                    .keyboardShortcut("t").disabled(model.tweaking).help("Try variations of the selection and keep the jury's pick (⌘T)")
                Button("Undo") { model.undo() }.keyboardShortcut("z").disabled(!model.canUndo)
                Button("Redo") { model.redo() }.keyboardShortcut("z", modifiers: [.command, .shift]).disabled(!model.canRedo)
                Button("Reset") { model.reset() }
                Button("PNG") { model.export(pdf: false) }
                Button("PDF") { model.export(pdf: true) }
                Button("Done", action: done).keyboardShortcut(model.variations.isEmpty ? .cancelAction : nil)
            }
            .buttonStyle(EditorButton()).padding(.horizontal, 20).frame(height: 44)
            Rectangle().fill(.separator).frame(height: 1)
            HStack(spacing: 0) {
                canvas.frame(maxWidth: .infinity, maxHeight: .infinity)
                Rectangle().fill(.separator).frame(width: 1)
                ScrollView { panel.padding(20) }.frame(width: 300)
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear { SystemPreviews.prewarm(); TweakJury.prewarm(); canvasFocused = true }
        // While comparing tweak versions: arrows step through them, Return keeps, Esc reverts.
        .focusable().focusEffectDisabled().focused($canvasFocused)
        .onKeyPress(.leftArrow) { guard !model.variations.isEmpty else { return .ignored }; model.preview(max(0, model.previewing - 1)); return .handled }
        .onKeyPress(.rightArrow) { guard !model.variations.isEmpty else { return .ignored }; model.preview(min(model.variations.count - 1, model.previewing + 1)); return .handled }
        .onKeyPress(.return) { guard !model.variations.isEmpty else { return .ignored }; model.acceptTweak(); return .handled }
        .onKeyPress(.escape) { guard !model.variations.isEmpty else { return .ignored }; model.cancelTweak(); return .handled }
        .onChange(of: model.variations.isEmpty) { _, empty in if !empty { canvasFocused = true } }
    }

    private func label(_ text: String) -> some View {
        Text(text).font(.system(size: 10.5, weight: .semibold, design: .monospaced)).tracking(1.4)
    }

    // MARK: Canvas

    private var canvas: some View {
        GeometryReader { space in
            let aspect = model.plain.aspect
            let height = min(space.size.height - 56, (space.size.width - 56) * aspect)
            let size = CGSize(width: height / aspect, height: height)
            ZStack {
                Color(nsColor: .underPageBackgroundColor)
                ZStack(alignment: .topLeading) {
                    ZStack {
                        if let preview = model.preview {
                            Image(nsImage: preview).resizable().interpolation(.high)
                                .id(model.previewVersion)
                                .transition(.modifier(active: BlurFade(progress: 0), identity: BlurFade(progress: 1)).animation(StageMotion.reveal))
                        } else { Rectangle().fill(.quaternary) }
                    }
                    .frame(width: size.width, height: size.height)
                    .shadow(color: .black.opacity(0.25), radius: 18, y: 8)
                    fieldsLayer(size)
                    TweakGhosts(ghosts: model.ghosts, size: size)
                    selectionLayer(size)
                    if let marquee { Rectangle().fill(accent.opacity(0.06)).overlay { Rectangle().strokeBorder(accent, lineWidth: 1) }
                        .frame(width: marquee.width, height: marquee.height).position(x: marquee.midX, y: marquee.midY).allowsHitTesting(false) }
                }
                .frame(width: size.width, height: size.height)
                .contentShape(.rect)
                .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { drag in handleDrag(drag, size: size) }
                    .onEnded { drag in endDrag(drag, size: size) })
            }
            .overlay(alignment: .bottom) {
                if !model.variations.isEmpty && !model.tweaking {
                    TweakStrip(variations: model.variations, previewing: model.previewing, choose: { model.choose($0) }, accept: { model.acceptTweak() }, cancel: { model.cancelTweak() })
                        .padding(.bottom, 16)
                        .transition(.opacity.combined(with: .offset(y: 10)).animation(StageMotion.enter))
                }
            }
        }
    }

    // Element geometry in view points: the ink box, rotated about the element's centre.
    private func quad(_ e: SceneElement, _ size: CGSize) -> [CGPoint] {
        var box = e.bounds
        if e.kind == "text" && e.preserveTypeProportions == true { var upright = e; upright.rotation = 0; box = CompositionJudges.inkBounds(upright, genome: model.plain) }
        let c = CGPoint(x: (e.bounds.x + e.bounds.width / 2) * size.width, y: (e.bounds.y + e.bounds.height / 2) * size.height)
        let a = e.rotation * .pi / 180
        return [(box.x, box.y), (box.x + box.width, box.y), (box.x + box.width, box.y + box.height), (box.x, box.y + box.height)].map { p in
            let dx = p.0 * size.width - c.x, dy = p.1 * size.height - c.y
            return CGPoint(x: c.x + dx * cos(a) - dy * sin(a), y: c.y + dx * sin(a) + dy * cos(a))
        }
    }
    private func centre(_ e: SceneElement, _ size: CGSize) -> CGPoint { CGPoint(x: (e.bounds.x + e.bounds.width / 2) * size.width, y: (e.bounds.y + e.bounds.height / 2) * size.height) }
    private func rotationHandle(_ q: [CGPoint], _ c: CGPoint) -> CGPoint {
        let mid = CGPoint(x: (q[0].x + q[3].x) / 2, y: (q[0].y + q[3].y) / 2)
        let d = hypot(mid.x - c.x, mid.y - c.y)
        return d < 0.01 ? mid : CGPoint(x: mid.x + (mid.x - c.x) / d * 26, y: mid.y + (mid.y - c.y) / d * 26)
    }
    private static func inside(_ p: CGPoint, _ q: [CGPoint]) -> Bool {
        var sign = 0.0
        for i in q.indices {
            let a = q[i], b = q[(i + 1) % q.count], cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
            if sign == 0 { sign = cross } else if cross * sign < 0 { return false }
        }
        return true
    }

    @ViewBuilder private func selectionLayer(_ size: CGSize) -> some View {
        let members = model.group.filter { model.plain.elements.indices.contains($0) }.sorted()
        if model.tweaking {
            MarchingOutline(quads: model.tweakOutline.map { $0.map { CGPoint(x: $0.x * size.width, y: $0.y * size.height) } })
        } else if members.count > 1 {
            // A group: each member outlined, and their joint bounds dashed.
            let quads = members.map { quad(model.plain.elements[$0], size) }, points = quads.flatMap { $0 }
            Path { p in for q in quads { p.addLines(q); p.closeSubpath() } }.stroke(accent.opacity(0.7), lineWidth: 1)
            if let x0 = points.map(\.x).min(), let x1 = points.map(\.x).max(), let y0 = points.map(\.y).min(), let y1 = points.map(\.y).max() {
                Rectangle().strokeBorder(accent, style: StrokeStyle(lineWidth: 1.2, dash: [5, 4])).frame(width: x1 - x0 + 12, height: y1 - y0 + 12).position(x: (x0 + x1) / 2, y: (y0 + y1) / 2)
            }
        } else if let index = model.selected, model.plain.elements.indices.contains(index) {
            let e = model.plain.elements[index], q = quad(e, size), c = centre(e, size), handle = rotationHandle(q, c)
            let mid = CGPoint(x: (q[0].x + q[3].x) / 2, y: (q[0].y + q[3].y) / 2)
            Path { p in p.addLines(q); p.closeSubpath(); p.move(to: mid); p.addLine(to: handle) }
                .stroke(accent, lineWidth: 1.2)
            ForEach(0..<4, id: \.self) { i in
                Rectangle().fill(.white).frame(width: 8, height: 8).overlay { Rectangle().strokeBorder(accent, lineWidth: 1.2) }
                    .position(q[i])
            }
            Circle().fill(.white).frame(width: 11, height: 11).overlay { Circle().strokeBorder(accent, lineWidth: 1.5) }
                .position(handle)
        }
    }

    // Area modifiers: dashed circles with a label and a centre handle; overlaps are hatched and named.
    private func fieldsLayer(_ size: CGSize) -> some View {
        let fields = Array(model.stack.enumerated().filter { $0.element.area })
        return ZStack(alignment: .topLeading) {
            Canvas { context, _ in
                for (n, a) in fields {
                    for (m, b) in fields where m > n {
                        let ca = CGPoint(x: a.x * size.width, y: a.y * size.height), cb = CGPoint(x: b.x * size.width, y: b.y * size.height)
                        let ra = a.radius * size.width, rb = b.radius * size.width
                        guard hypot(ca.x - cb.x, ca.y - cb.y) < ra + rb else { continue }
                        var lens = context
                        lens.clip(to: Path(ellipseIn: CGRect(x: ca.x - ra, y: ca.y - ra, width: ra * 2, height: ra * 2)))
                        lens.clip(to: Path(ellipseIn: CGRect(x: cb.x - rb, y: cb.y - rb, width: rb * 2, height: rb * 2)))
                        lens.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.white.opacity(0.12)))
                        var hatch = Path()
                        for x in stride(from: -size.height, through: size.width, by: 9) { hatch.move(to: CGPoint(x: x, y: size.height)); hatch.addLine(to: CGPoint(x: x + size.height, y: 0)) }
                        lens.stroke(hatch, with: .color(.white.opacity(0.45)), lineWidth: 1)
                    }
                }
                for (n, m) in fields {
                    let c = CGPoint(x: m.x * size.width, y: m.y * size.height), r = m.radius * size.width
                    let colour = Self.fieldColours[n % Self.fieldColours.count]
                    context.stroke(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(colour), style: StrokeStyle(lineWidth: 1.5, dash: [6, 5]))
                    context.fill(Path(ellipseIn: CGRect(x: c.x - 5, y: c.y - 5, width: 10, height: 10)), with: .color(colour))
                    context.stroke(Path(ellipseIn: CGRect(x: c.x - 5, y: c.y - 5, width: 10, height: 10)), with: .color(.white), lineWidth: 1.5)
                }
            }
            ForEach(fields, id: \.element.id) { item in
                pill(item.element.name, colour: Self.fieldColours[item.offset % Self.fieldColours.count], text: .white)
                    .position(x: item.element.x * size.width, y: max(12, item.element.y * size.height - item.element.radius * size.width))
            }
            ForEach(overlaps(fields.map { $0.element }, size), id: \.id) { lens in
                pill(lens.title, colour: .white, text: .black).position(lens.point)
            }
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }
    private struct Lens: Identifiable { let id: String; let title: String; let point: CGPoint }
    private func overlaps(_ fields: [EditorModifier], _ size: CGSize) -> [Lens] {
        var list: [Lens] = []
        for (i, a) in fields.enumerated() { for b in fields.dropFirst(i + 1) {
            let ca = CGPoint(x: a.x * size.width, y: a.y * size.height), cb = CGPoint(x: b.x * size.width, y: b.y * size.height)
            let ra = a.radius * size.width, rb = b.radius * size.width, d = hypot(ca.x - cb.x, ca.y - cb.y)
            guard d < ra + rb, d > 0.01 else { continue }
            // The middle of the lens: along the line of centres, between the two near edges.
            let t = ((d - rb) + ra) / 2 / d
            list.append(Lens(id: a.id.uuidString + b.id.uuidString, title: "\(a.name) × \(b.name)", point: CGPoint(x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t)))
        } }
        return list
    }
    private func pill(_ title: String, colour: Color, text: Color) -> some View {
        Text(title).font(.system(size: 11, weight: .semibold)).foregroundStyle(text)
            .padding(.horizontal, 10).padding(.vertical, 4).background(colour, in: .capsule)
            .shadow(color: .black.opacity(0.2), radius: 3, y: 1)
    }

    // MARK: Gestures

    enum CanvasGesture {
        case move(Int, SceneElement), groupMove([Int: UnitBox]), marquee(Bool), scale(Int, SceneElement, CGFloat), rotate(Int, SceneElement, CGFloat)
        case field(UUID, EditorModifier), radius(UUID, EditorModifier), none
    }

    private func handleDrag(_ drag: DragGesture.Value, size: CGSize) {
        if gesture == nil { gesture = begin(at: drag.startLocation, size: size) }
        guard let gesture else { return }
        let dx = drag.translation.width, dy = drag.translation.height
        switch gesture {
        case let .move(i, base):
            guard hypot(dx, dy) > 1 else { return }
            model.live { $0.elements[i].bounds.x = base.bounds.x + dx / size.width; $0.elements[i].bounds.y = base.bounds.y + dy / size.height }
        case let .scale(i, base, start):
            let c = centre(base, size), now = hypot(drag.location.x - c.x, drag.location.y - c.y), f = max(0.1, now / max(1, start))
            model.live {
                var b = base.bounds; let cx = b.x + b.width / 2, cy = b.y + b.height / 2
                b = .init(x: cx - b.width * f / 2, y: cy - b.height * f / 2, width: b.width * f, height: b.height * f)
                $0.elements[i].bounds = b
                if let em = base.typeEmSize { $0.elements[i].typeEmSize = em * f }
            }
        case let .rotate(i, base, start):
            let c = centre(base, size), now = atan2(drag.location.y - c.y, drag.location.x - c.x)
            var degrees = base.rotation + (now - start) * 180 / .pi
            // Snap near the square angles, like any drawing tool.
            for snap in stride(from: -180.0, through: 180, by: 45) where abs(degrees - snap) < 3 { degrees = snap }
            model.live { $0.elements[i].rotation = degrees }
        case let .field(id, base):
            model.updateModifier(id, commitFirst: false, refreshAfter: false) { $0.x = min(1, max(0, base.x + dx / size.width)); $0.y = min(1, max(0, base.y + dy / size.height)) }
        case let .radius(id, base):
            let c = CGPoint(x: base.x * size.width, y: base.y * size.height)
            model.updateModifier(id, commitFirst: false, refreshAfter: false) { $0.radius = min(1.2, max(0.04, hypot(drag.location.x - c.x, drag.location.y - c.y) / size.width)) }
        case let .groupMove(bases):
            guard hypot(dx, dy) > 1 else { return }
            model.live { g in for (i, b) in bases { g.elements[i].bounds.x = b.x + dx / size.width; g.elements[i].bounds.y = b.y + dy / size.height } }
        case let .marquee(adding):
            let r = CGRect(x: min(drag.startLocation.x, drag.location.x), y: min(drag.startLocation.y, drag.location.y), width: abs(dx), height: abs(dy))
            marquee = r
            // Everything whose centre falls inside the rectangle joins the selection.
            let inside = Set(model.plain.elements.indices.filter { model.selectable(model.plain.elements[$0]) && r.contains(centre(model.plain.elements[$0], size)) })
            model.group = adding ? model.group.union(inside) : inside
            model.selected = model.group.sorted().last
        case .none: break
        }
    }

    private func begin(at p: CGPoint, size: CGSize) -> CanvasGesture {
        let shift = NSEvent.modifierFlags.contains(.shift)
        if model.tweaking { return .none }
        if model.group.count <= 1, let i = model.selected, model.plain.elements.indices.contains(i) {
            let e = model.plain.elements[i], q = quad(e, size), c = centre(e, size), handle = rotationHandle(q, c)
            if hypot(p.x - handle.x, p.y - handle.y) < 11 { model.commit(); return .rotate(i, e, atan2(p.y - c.y, p.x - c.x)) }
            if q.contains(where: { hypot(p.x - $0.x, p.y - $0.y) < 9 }) { model.commit(); return .scale(i, e, hypot(p.x - c.x, p.y - c.y)) }
        }
        for m in model.stack.reversed() where m.area {
            let c = CGPoint(x: m.x * size.width, y: m.y * size.height), d = hypot(p.x - c.x, p.y - c.y), r = m.radius * size.width
            if d < 11 { model.commit(); return .field(m.id, m) }
            if abs(d - r) < 7 { model.commit(); return .radius(m.id, m) }
        }
        // The topmost selectable element under the pointer.
        let ordered = model.plain.elements.indices.filter { model.selectable(model.plain.elements[$0]) }
            .sorted { (model.plain.elements[$0].zIndex ?? 0) > (model.plain.elements[$1].zIndex ?? 0) }
        if let hit = ordered.first(where: { Self.inside(p, quad(model.plain.elements[$0], size)) }) {
            if shift {
                // Shift-click adds or removes one element.
                if model.group.isEmpty, let s = model.selected { model.group = [s] }
                if model.group.contains(hit) { model.group.remove(hit) } else { model.group.insert(hit) }
                model.selected = model.group.contains(hit) ? hit : model.group.sorted().last
                return .none
            }
            if model.group.count > 1 && model.group.contains(hit) {
                model.commit()
                return .groupMove(Dictionary(uniqueKeysWithValues: model.group.map { ($0, model.plain.elements[$0].bounds) }))
            }
            model.selected = hit; model.group = [hit]; model.commit()
            return .move(hit, model.plain.elements[hit])
        }
        // Empty space: drag to select a region; a click clears the selection.
        if !shift { model.selected = nil; model.group = [] }
        return .marquee(shift)
    }

    private func endDrag(_ drag: DragGesture.Value, size: CGSize) {
        defer { gesture = nil; marquee = nil }
        guard let gesture else { return }
        switch gesture {
        case .none, .marquee: break
        case .groupMove where hypot(drag.translation.width, drag.translation.height) <= 1: break
        case .move where hypot(drag.translation.width, drag.translation.height) <= 1: break
        default: model.refresh()
        }
    }

    // MARK: Panel

    enum PanelTab: String, CaseIterable { case edit = "Edit", type = "Type", shapes = "Shapes", modifiers = "Modifiers" }

    // Four tabs keep the column short: edit what is selected, set type, add shapes, run modifiers.
    private var panel: some View {
        VStack(alignment: .leading, spacing: 18) {
            Picker("Panel", selection: $tab) { ForEach(PanelTab.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                .pickerStyle(.segmented).labelsHidden().controlSize(.small)
            switch tab {
            case .edit: editPanel
            case .type: TypeSystemsTab(model: model)
            case .shapes: ShapesTab(model: model)
            case .modifiers: modifiers
            }
        }
    }

    private var editPanel: some View {
        VStack(alignment: .leading, spacing: 24) {
            section(model.group.count > 1 ? "\(model.group.count) SELECTED" : "TWEAK") {
                Text(model.group.count > 1 || model.selected != nil ? "Tweak tries \(ScenePosterEditorModel.tweakCount) variations of the selection and keeps the jury's pick." : "Select elements (click, shift-click or drag a box), or tweak the headline.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
                Button(model.tweaking ? "Judging \(model.tweakDone)/\(model.tweakTotal)" : "Tweak") { Task { await model.tweak() } }
                    .buttonStyle(EditorButton()).disabled(model.tweaking)
            }
            if model.group.count <= 1, let index = model.selected, model.plain.elements.indices.contains(index) { selection(index) }
            else { Text("Click type or a form to select it. Drag to move, corners to scale, the round handle to rotate.").font(.system(size: 11)).foregroundStyle(.secondary) }
            section("COLOUR") {
                ForEach(model.swatches, id: \.self) { swatch in
                    ColorPicker(name(swatch), selection: Binding(get: { Color(editorHex: model.hex(swatch)) }, set: { model.recolour(swatch, to: $0.hexString) }), supportsOpacity: false)
                        .font(.system(size: 12))
                }
            }
            if !model.formIndices.isEmpty {
                section("FORMS") {
                    Toggle("Show forms", isOn: Binding(get: { model.formsVisible }, set: { _ in model.toggleForms() })).toggleStyle(.checkbox).font(.system(size: 12))
                }
            }
        }
    }

    private func selection(_ index: Int) -> some View {
        let e = model.plain.elements[index]
        return section(e.kind == "text" ? "TYPE" : "FORM") {
            if e.kind == "text" {
                TextField("Text", text: Binding(get: { model.plain.elements[index].text ?? "" },
                                                set: { text in model.setElement(index) { $0.text = text; $0.graphemeIndexMap = nil } }))
                    .textFieldStyle(.roundedBorder).font(.system(size: 12))
            }
            HStack {
                Text("Rotation").font(.system(size: 12)); Spacer()
                TextField("°", value: Binding(get: { (model.plain.elements[index].rotation * 10).rounded() / 10 },
                                               set: { value in model.setElement(index) { $0.rotation = value } }), format: .number)
                    .textFieldStyle(.roundedBorder).frame(width: 64).font(.system(size: 12, design: .monospaced)).multilineTextAlignment(.trailing)
            }
            ColorPicker("Colour", selection: Binding(get: { Color(editorHex: model.plain.elements[index].color) },
                                                     set: { colour in model.setElement(index) { $0.color = colour.hexString } }), supportsOpacity: false)
                .font(.system(size: 12))
            HStack(spacing: 8) {
                Button("Hide") { model.setElement(index) { $0.minimumStage = 99 }; model.selected = nil }
                Button("Deselect") { model.selected = nil }
            }.buttonStyle(EditorButton())
        }
    }

    private var modifiers: some View {
        section("MODIFIERS") {
            ForEach(Array(model.stack.enumerated()), id: \.element.id) { n, m in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Circle().fill(m.area ? Self.fieldColours[n % Self.fieldColours.count] : Color.secondary).frame(width: 8, height: 8)
                        Text(m.name).font(.system(size: 12, weight: .semibold))
                        Spacer()
                        Picker("Where", selection: Binding(get: { m.area }, set: { area in model.updateModifier(m.id) { $0.area = area } })) {
                            Text("All").tag(false); Text("Area").tag(true)
                        }
                        .pickerStyle(.segmented).labelsHidden().frame(width: 92).controlSize(.small)
                        Button { model.removeModifier(m.id) } label: { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)) }
                            .buttonStyle(.plain).foregroundStyle(.secondary).accessibilityLabel("Remove \(m.name)")
                    }
                    HStack {
                        Text("Strength").font(.system(size: 11)).foregroundStyle(.secondary)
                        Slider(value: Binding(get: { m.strength }, set: { v in model.updateModifier(m.id, commitFirst: false, refreshAfter: false) { $0.strength = v } }),
                               in: 0...1, onEditingChanged: { editing in if editing { model.commit() } else { model.refresh() } })
                            .controlSize(.mini)
                    }
                }
                .padding(.vertical, 4)
            }
            Menu("Add modifier") {
                ForEach(ModifierPass.types, id: \.self) { type in Button(type.prefix(1).uppercased() + type.dropFirst()) { model.addModifier(type) } }
            }
            .menuStyle(.button).fixedSize().disabled(model.stack.count >= 4)
            Text(model.stack.contains { $0.area } ? "Drag a circle's dot to move it, its edge to resize it." : "Set a modifier to Area to place it with a circle.")
                .font(.system(size: 11)).foregroundStyle(.tertiary)
        }
    }

    private func name(_ swatch: ScenePosterEditorModel.Swatch) -> String {
        switch swatch { case .paper: "Paper"; case .display: "Headline"; case .form: "Forms"; case .info: "Details" }
    }
    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) { label(title).foregroundStyle(.secondary); content() }
    }
}

private struct EditorButton: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 10.5, weight: .semibold, design: .monospaced)).tracking(1.2).textCase(.uppercase)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .overlay { Rectangle().strokeBorder(.separator, lineWidth: 1) }
            .contentShape(.rect).opacity(enabled ? 1 : 0.4)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.16), value: configuration.isPressed)
    }
}

extension Color {
    init(editorHex: String) {
        let n = Int(editorHex.dropFirst(), radix: 16) ?? 0
        self.init(red: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255)
    }
    var hexString: String {
        let c = NSColor(self).usingColorSpace(.sRGB) ?? .black
        return String(format: "#%02x%02x%02x", Int((c.redComponent * 255).rounded()), Int((c.greenComponent * 255).rounded()), Int((c.blueComponent * 255).rounded()))
    }
}
