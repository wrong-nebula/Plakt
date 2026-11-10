import SwiftUI
import PosterCore

// Type systems and shape systems in the poster editor: browse them as small previews drawn with
// the poster's own headline and colours, apply one with a click, then tune its parameters.

extension ScenePosterEditorModel {
    /// The words a type system sets: the selected line, or the poster's title.
    var systemInput: String {
        if let s = selected, plain.elements.indices.contains(s), plain.elements[s].kind == "text", let text = plain.elements[s].text, !text.isEmpty { return text }
        return plain.posterCopy?.title.replacingOccurrences(of: "\n", with: " ") ?? plain.elements.first { isDisplay($0) }?.text ?? "TITLE"
    }
    var ink: String { plain.elements.first { isDisplay($0) }?.color ?? "#111111" }
    var accentInk: String { plain.elements.first { isForm($0) }?.color ?? ink }
    var fontProfile: FontStyleProfile? { plain.elements.compactMap(\.fontProfileID).first.flatMap { FontLibrary.shared.profile($0) } }

    /// Replaces the selected line (or the whole headline) with a type system set in its place.
    func applyTypeSystem(_ system: TypeSystemGenome) {
        commit()
        let targets: [Int]
        if let s = selected, plain.elements.indices.contains(s), isDisplay(plain.elements[s]) {
            // A line already set by a type system is replaced together with its siblings.
            if let id = plain.elements[s].typeSystemID { targets = plain.elements.indices.filter { plain.elements[$0].typeSystemID == id } } else { targets = [s] }
        } else {
            targets = plain.elements.indices.filter { isDisplay(plain.elements[$0]) && (plain.elements[$0].minimumStage ?? 0) < 99 }
        }
        let boxes = targets.map { plain.elements[$0].bounds }
        let field: UnitBox
        if let x0 = boxes.map(\.x).min(), let y0 = boxes.map(\.y).min(), let x1 = boxes.map({ $0.x + $0.width }).max(), let y1 = boxes.map({ $0.y + $0.height }).max() {
            field = UnitBox(x: x0, y: y0, width: x1 - x0, height: y1 - y0)
        } else { field = UnitBox(x: 0.06, y: 0.1, width: 0.88, height: 0.5) }
        let input = systemInput, ink = ink, accent = accentInk
        do {
            var (elements, application) = try TypeSystemEngine.elements(system, input: input, field: field, aspect: plain.aspect, profile: fontProfile, foreground: ink, accent: accent, overrides: systemOverrides[system.id] ?? [:])
            for i in elements.indices { elements[i].zIndex = 100 + i; elements[i].minimumStage = 1 }
            for i in targets.sorted(by: >) { plain.elements.remove(at: i) }
            plain.elements.append(contentsOf: elements)
            plain.appliedTypeSystems = (plain.appliedTypeSystems ?? []).filter { $0.genomeID != system.id } + [application]
            selected = plain.elements.firstIndex { $0.typeSystemID == system.id }
            message = nil
        } catch { message = "\(system.name): \(error.localizedDescription)" }
        refresh()
    }

    /// Re-sets a placed type system with new parameter values, in the same field and words.
    func retune(_ systemID: String, _ key: String, _ value: Double) {
        guard let system = TypeSystemLibrary.shared.system(systemID), let application = plain.appliedTypeSystems?.first(where: { $0.genomeID == systemID }) else { return }
        systemOverrides[systemID, default: [:]][key] = value
        let colour = plain.elements.first { $0.typeSystemID == systemID }?.color ?? ink
        guard var (elements, updated) = try? TypeSystemEngine.elements(system, input: application.input, field: application.field, aspect: plain.aspect, profile: fontProfile, foreground: colour, accent: accentInk, overrides: systemOverrides[systemID] ?? [:]) else { return }
        for i in elements.indices { elements[i].zIndex = 100 + i; elements[i].minimumStage = 1 }
        plain.elements.removeAll { $0.typeSystemID == systemID }
        plain.elements.append(contentsOf: elements)
        plain.appliedTypeSystems = (plain.appliedTypeSystems ?? []).filter { $0.genomeID != systemID } + [updated]
        selected = plain.elements.firstIndex { $0.typeSystemID == systemID }
        shown = plain; render()
    }

    /// Adds a library shape in open space, or swaps the selected form for it in the same place.
    func placeShape(_ recipe: PosterShapeRecipe) {
        commit()
        var field = UnitBox(x: 0.2, y: 0.3, width: 0.6, height: 0.6 / max(0.4, recipe.idealAspect) / plain.aspect)
        var colour = accentInk, rotation = 0.0, at: Int?
        if let s = selected, plain.elements.indices.contains(s), isForm(plain.elements[s]) {
            field = plain.elements[s].bounds; colour = plain.elements[s].color; rotation = plain.elements[s].rotation; at = s
        }
        guard let element = ShapeChoices.element(recipe, field: field, colour: colour, background: plain.background, seed: seed) else { return }
        var e = element; e.rotation = rotation; e.zIndex = at.map { plain.elements[$0].zIndex ?? 30 } ?? 30; e.minimumStage = 0; e.allowsBleed = true; e.clipBounds = .full
        if let at { plain.elements[at] = e; selected = at } else { plain.elements.append(e); selected = plain.elements.count - 1 }
        refresh()
    }

    /// Changes one parameter of the selected library shape, keeping its place and colour.
    func reshape(_ index: Int, _ key: String, _ value: Double) {
        guard plain.elements.indices.contains(index) else { return }
        plain.elements[index].geometry?[key] = value
        shown = plain; render()
    }
}

/// Library shapes that draw as shapes. Recipes that turn into lettering are left out: their
/// words are not the poster's.
enum ShapeChoices {
    /// Renderers that turn into lettering (or a raster module) rather than a form.
    static let lettering: Set<String> = ["motif-survey-portal-type", "motif-survey-module-substitution", "motif-survey-scalloped-frame", GravityTypeSystems.shape, ContourSystems.typeShape]
    /// Filtered by renderer name only, so opening the tab builds nothing.
    static let recipes: [PosterShapeRecipe] = PosterShapeLibrary.recipes.filter { !lettering.contains($0.renderer) }
    static func element(_ recipe: PosterShapeRecipe, field: UnitBox, colour: String, background: String, seed: UInt64) -> SceneElement? {
        let preset = PosterShapePreset(recipe: recipe, seed: seed)
        guard let choice = PosterShapeLibrary.choose(seed: seed, profile: nil, field: field, posterAspect: 1.414, category: "abstract", textDensity: 0.2, preset: preset) else { return nil }
        return PosterShapeLibrary.element(choice, field: field, color: colour, seed: seed, sourceID: "editor-\(UUID().uuidString.prefix(4))", background: background)
    }
}

/// Small previews for the Type and Shapes tabs. Shared by every editor, drawn at most three at
/// a time (newest request first, so the tiles in view come before ones scrolled past), and kept
/// on disk so a second visit opens instantly.
@MainActor @Observable
final class SystemPreviews {
    static let shared = SystemPreviews()
    var images: [String: NSImage] = [:]
    /// Previews that could not be drawn; their tiles show the name only.
    var failed: Set<String> = []
    @ObservationIgnored private var pending: Set<String> = []
    @ObservationIgnored private var queue: [(String, @Sendable () -> CGImage?)] = []
    @ObservationIgnored private var running = 0
    nonisolated private static let cache = URL.cachesDirectory.appending(path: "PosterLab/editor-previews", directoryHint: .isDirectory)

    func image(_ key: String, draw: @escaping @Sendable () -> CGImage?) -> NSImage? {
        if let image = images[key] { return image }
        guard pending.insert(key).inserted else { return nil }
        queue.append((key, draw)); pump()
        return nil
    }
    private func pump() {
        while running < 3, let (key, draw) = queue.popLast() {
            running += 1
            let folder = Self.cache, file = folder.appending(path: Self.stableHash(key) + ".png")
            Task {
                let image = await Task.detached(priority: .userInitiated) { () -> CGImage? in
                    if let cached = try? PosterRenderer.load(file) { return cached }
                    guard let drawn = draw() else { return nil }
                    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                    try? PosterRenderer.png(drawn, to: file)
                    return drawn
                }.value
                if let image { images[key] = NSImage(cgImage: image, size: NSSize(width: image.width, height: image.height)) } else { failed.insert(key) }
                running -= 1; pump()
            }
        }
    }
    /// FNV-1a, stable across launches (Swift's hashValue is not).
    nonisolated static func stableHash(_ text: String) -> String {
        var h: UInt64 = 0xcbf29ce484222325
        for byte in text.utf8 { h = (h ^ UInt64(byte)) &* 0x100000001b3 }
        return String(h, radix: 16)
    }
    /// Loads both catalogs off the main thread, so the tabs open without a stall.
    nonisolated static func prewarm() {
        Task.detached(priority: .utility) { _ = TypeSystemsTab.ranked.count; _ = ShapeChoices.recipes.count }
    }
}

struct TypeSystemsTab: View {
    let model: ScenePosterEditorModel
    @State private var search = ""
    private var previews: SystemPreviews { .shared }
    /// Sorted once, not on every redraw.
    nonisolated static let ranked: [TypeSystemGenome] = TypeSystemLibrary.shared.distinctSystems.sorted { $0.representativeScore > $1.representativeScore }
    private var systems: [TypeSystemGenome] {
        let all = Self.ranked
        guard !search.isEmpty else { return all }
        return all.filter { "\($0.name) \($0.operation) \($0.tags.joined(separator: " "))".localizedCaseInsensitiveContains(search) }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let s = model.selected, model.plain.elements.indices.contains(s), let id = model.plain.elements[s].typeSystemID, let system = TypeSystemLibrary.shared.system(id) {
                tuning(system)
                Rectangle().fill(.separator).frame(height: 1)
            }
            Text(model.selected == nil ? "Sets the poster's title. Select a line to set just that line." : "Sets the selected line: \(model.systemInput)")
                .font(.system(size: 11)).foregroundStyle(.secondary)
            TextField("Search systems", text: $search).textFieldStyle(.roundedBorder).controlSize(.small)
            let input = model.systemInput, ink = model.ink, accent = model.accentInk, paper = model.plain.background, font = model.fontProfile?.id
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 10) {
                ForEach(systems.prefix(160), id: \.id) { system in
                    Button { model.applyTypeSystem(system) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            ZStack {
                                Rectangle().fill(Color(editorHex: paper))
                                if let image = previews.image(system.id + input, draw: { Self.preview(system, input: input, font: font, ink: ink, accent: accent, paper: paper) }) {
                                    Image(nsImage: image).resizable().scaledToFit()
                                } else if !previews.failed.contains(system.id + input) { ProgressView().controlSize(.mini) }
                            }
                            .aspectRatio(1 / 1.2, contentMode: .fit).clipped()
                            .overlay { Rectangle().strokeBorder(.separator, lineWidth: 1) }
                            Text(system.name).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(2).multilineTextAlignment(.leading)
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(TilePress())
                    .help(system.explanation)
                }
            }
        }
    }
    private func tuning(_ system: TypeSystemGenome) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(system.name).font(.system(size: 12, weight: .semibold))
            ForEach(system.parameters.keys.sorted().prefix(6), id: \.self) { key in
                let base = system.parameters[key] ?? 0
                let current = model.systemOverrides[system.id]?[key] ?? base
                let range: ClosedRange<Double> = key.lowercased().contains("rotation") ? -180...180 : base == 0 ? -1...1 : min(base * 0.25, base * 2)...max(base * 0.25, base * 2)
                let whole = base == base.rounded() && abs(base) >= 1 && !key.lowercased().contains("rotation")
                VStack(alignment: .leading, spacing: 1) {
                    HStack { Text(key).font(.system(size: 11)); Spacer(); Text(whole ? "\(Int(current))" : String(format: "%.2f", current)).font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary) }
                    Slider(value: Binding(get: { current }, set: { model.retune(system.id, key, whole ? $0.rounded() : $0) }), in: range,
                           onEditingChanged: { editing in if editing { model.commit() } else { model.refresh() } })
                        .controlSize(.mini)
                }
            }
        }
    }
    nonisolated static func preview(_ system: TypeSystemGenome, input: String, font: String?, ink: String, accent: String, paper: String) -> CGImage? {
        guard let scene = try? TypeSystemEngine.scene(system, input: input, profileID: font, foreground: ink, accent: accent, background: paper) else { return nil }
        return try? LibrarySceneRenderer.render(scene, width: 200, seed: 1)
    }
}

struct ShapesTab: View {
    let model: ScenePosterEditorModel
    @State private var group = "All"
    private var previews: SystemPreviews { .shared }
    private var groups: [String] { ["All"] + Array(Set(ShapeChoices.recipes.map(\.group))).sorted() }
    private var recipes: [PosterShapeRecipe] { group == "All" ? ShapeChoices.recipes : ShapeChoices.recipes.filter { $0.group == group } }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let s = model.selected, model.plain.elements.indices.contains(s), let id = PosterShapeLibrary.recipeID(model.plain.elements[s]), let recipe = PosterShapeLibrary.recipe(id) {
                tuning(recipe, index: s)
                Rectangle().fill(.separator).frame(height: 1)
            }
            Text(model.selected.map { model.isForm(model.plain.elements[$0]) } == true ? "Click a shape to swap the selected form for it." : "Click a shape to add it; drag it into place on the poster.")
                .font(.system(size: 11)).foregroundStyle(.secondary)
            Picker("Group", selection: $group) { ForEach(groups, id: \.self) { Text($0).tag($0) } }
                .labelsHidden().controlSize(.small)
            let ink = model.accentInk, paper = model.plain.background
            var template = model.plain
            let _ = { template.elements = []; template.aspect = 1 }()
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 10) {
                ForEach(recipes, id: \.id) { recipe in
                    Button { model.placeShape(recipe) } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            ZStack {
                                Rectangle().fill(Color(editorHex: paper))
                                if let image = previews.image(recipe.id + ink + paper, draw: { [template] in Self.preview(recipe, ink: ink, paper: paper, template: template) }) {
                                    Image(nsImage: image).resizable().scaledToFit().padding(6)
                                } else if !previews.failed.contains(recipe.id + ink + paper) { ProgressView().controlSize(.mini) }
                            }
                            .aspectRatio(1, contentMode: .fit)
                            .overlay { Rectangle().strokeBorder(.separator, lineWidth: 1) }
                            Text(recipe.name).font(.system(size: 9.5)).foregroundStyle(.secondary).lineLimit(1)
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(TilePress())
                    .help(recipe.logic)
                }
            }
        }
    }
    private func tuning(_ recipe: PosterShapeRecipe, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(recipe.name).font(.system(size: 12, weight: .semibold))
            ForEach(recipe.parameters.filter { $0.isActive(in: model.plain.elements[index].geometry ?? [:]) }.prefix(6), id: \.id) { p in
                let current = model.plain.elements[index].geometry?[p.id] ?? p.value
                VStack(alignment: .leading, spacing: 1) {
                    HStack { Text(p.label).font(.system(size: 11)); Spacer(); Text(p.step >= 1 ? "\(Int(current))" : String(format: "%.2f", current)).font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary) }
                    Slider(value: Binding(get: { current }, set: { model.reshape(index, p.id, p.step > 0 ? ($0 / p.step).rounded() * p.step : $0) }), in: p.min...max(p.min + 0.0001, p.max),
                           onEditingChanged: { editing in if editing { model.commit() } else { model.refresh() } })
                        .controlSize(.mini)
                }
            }
        }
    }
    nonisolated static func preview(_ recipe: PosterShapeRecipe, ink: String, paper: String, template: StyleGenome) -> CGImage? {
        guard var e = ShapeChoices.element(recipe, field: UnitBox(x: 0.08, y: 0.08, width: 0.84, height: 0.84), colour: ink, background: paper, seed: 7) else { return nil }
        e.minimumStage = 0
        var scene = template; scene.elements = [e]; scene.aspect = 1; scene.background = paper
        return try? LibrarySceneRenderer.render(scene, width: 200, seed: 7)
    }
}

/// Press feedback for previews.
struct TilePress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.16), value: configuration.isPressed)
    }
}
