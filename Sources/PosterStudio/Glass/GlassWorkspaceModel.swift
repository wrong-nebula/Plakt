import AppKit
import ImageIO
import Observation
import PosterCore
import UniformTypeIdentifiers

/// What the canvas shows: the glass render, a draggable split against the original, or the original.
enum GlassCompare: String, CaseIterable, Identifiable {
    case glass, split, original
    var id: String { rawValue }
    var label: String {
        switch self {
        case .glass: "Glass"
        case .split: "Split"
        case .original: "Original"
        }
    }
}

@MainActor @Observable
final class GlassWorkspaceModel {
    /// Identifies one preview render: the scene revision, the pixel width shown on screen, and whether
    /// something is being dragged, in which case the preview renders coarse and fast.
    struct PreviewKey: Hashable {
        var revision: Int
        var width: Int
        var coarse: Bool
    }

    /// Long enough for an A4 print export (3508 × 4961 px) without upscaling the poster.
    static let maximumArtworkSide = 5120

    var scene = GlassScene() {
        didSet {
            guard oldValue != scene else { return }
            if !restoringHistory && editBase == nil { recordUndo(oldValue) }
            changed()
        }
    }
    var selectedID: UUID?
    var artwork: CGImage?
    var artworkName = ""
    var preview: NSImage?
    var vectorPreview: NSImage?
    var vectorResult: GlassVectorTrace.Result?
    var compare = GlassCompare.glass
    var showVectors = false
    var vectorColors = 12
    var vectorWidth = 600
    var exportWidth = 2400
    var exportSamples = 48
    var showExportSheet = false
    /// Pixel width the canvas shows the poster at (points × display scale, including zoom).
    var previewPixelWidth = 820
    /// Seconds per pixel-sample measured on the last full-quality preview; drives export estimates.
    private(set) var secondsPerPixelSample: Double?
    var busy = false
    /// Completed fraction of the running export or trace render; nil when the step can't be measured.
    var progress: Double?
    var previewBusy = false
    var error: String?
    var status = "Choose a poster, then add a glass object."
    @ObservationIgnored private var rendererTask: Task<GlassRenderer, Error>?
    private var revision = 0
    private var loaded = false
    private var originalPNG: Data?
    /// The poster's vector PDF, when it came as one.
    private var originalPDF: Data?
    private var undoScenes: [GlassScene] = []
    private var redoScenes: [GlassScene] = []
    private var restoringHistory = false
    /// Scene before the current drag, slider track or colour-panel adjustment.
    private var editBase: GlassScene?
    @ObservationIgnored private var editEnd: Task<Void, Never>?
    @ObservationIgnored private var work: Task<Void, Never>?
    @ObservationIgnored private var artworkLoad: Task<Void, Never>?
    @ObservationIgnored private var autosaveTask: Task<Void, Never>?
    @ObservationIgnored private var artworkNeedsAutosave = false
    var canUndo: Bool { !undoScenes.isEmpty || (editBase.map { $0 != scene } ?? false) }
    var canRedo: Bool { !redoScenes.isEmpty }
    var hasArtwork: Bool { artwork != nil }

    init() { selectedID = scene.objects.first?.id }

    func start(artworkURL: URL?) {
        guard !loaded else { return }
        loaded = true
        warmUpRenderer()
        if let artworkURL { loadArtwork(artworkURL); return }
        if let saved = Self.readAutosave() {
            do {
                try restore(saved.document)
                artworkNeedsAutosave = !saved.fromFiles
                return
            } catch { self.error = error.localizedDescription }
        }
        if let demo = GlassWorkspaceResources.demoURL { loadArtwork(demo, name: "PosterLab · typographic collage") }
    }

    func loadArtwork(_ url: URL, name: String? = nil) {
        artworkLoad?.cancel()
        let maximumSide = Self.maximumArtworkSide
        status = "Loading \(name ?? url.lastPathComponent)…"
        artworkLoad = Task {
            do {
                // Decoding and re-encoding a print-size poster takes about a second; keep it off the main thread.
                let (image, png, pdf) = try await Task.detached(priority: .userInitiated) {
                    // A vector PDF renders at full size here and keeps its vectors for the SVG export.
                    var pdf: Data?
                    if url.pathExtension.lowercased() == "pdf" {
                        let data = try Data(contentsOf: url)
                        guard GlassPosterPDF.isPDF(data), data.count <= 40_000_000 else {
                            throw PosterError.invalid("Choose a PDF poster under 40 MB.")
                        }
                        pdf = data
                    }
                    let image = try pdf.map { try GlassPosterPDF.rasterize($0, maxSide: maximumSide) }
                        ?? LibraryRaster.oriented(url, maxSize: maximumSide)
                    guard image.width >= 32, image.height >= 32 else { throw PosterError.invalid("Choose a poster at least 32 pixels wide and tall.") }
                    return (image, try Self.pngData(image), pdf)
                }.value
                try Task.checkCancellation()
                artwork = image
                artworkName = name ?? url.lastPathComponent
                originalPNG = png
                originalPDF = pdf
                artworkNeedsAutosave = true
                compare = .glass
                changed()
            } catch is CancellationError {
            } catch { self.error = error.localizedDescription }
        }
    }

    func chooseArtwork() {
        let panel = NSOpenPanel()
        panel.title = "Choose the poster below the glass"
        panel.allowedContentTypes = [.pdf, .png, .jpeg, .tiff, .heic, .webP]
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url { loadArtwork(url) }
    }

    func undo() {
        endEdit()
        guard let previous = undoScenes.popLast() else { return }
        redoScenes.append(scene); restoringHistory = true; scene = previous; restoringHistory = false
        repairSelection()
    }

    func redo() {
        endEdit()
        guard let next = redoScenes.popLast() else { return }
        undoScenes.append(scene); restoringHistory = true; scene = next; restoringHistory = false
        repairSelection()
    }

    /// Starts one undo step for a continuous adjustment such as a drag or slider track.
    func beginEdit() {
        if editBase == nil { editBase = scene }
    }

    /// Closes the current continuous adjustment as a single undo step.
    func endEdit() {
        editEnd?.cancel(); editEnd = nil
        guard let base = editBase else { return }
        editBase = nil
        if base != scene { recordUndo(base) }
    }

    /// For controls without an end event, such as the colour panel: the step closes after a pause.
    func continueEdit() {
        beginEdit()
        editEnd?.cancel()
        editEnd = Task {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            endEdit()
        }
    }

    private func recordUndo(_ previous: GlassScene) {
        undoScenes.append(previous)
        if undoScenes.count > 60 { undoScenes.removeFirst() }
        redoScenes.removeAll()
    }

    func add(_ shape: GlassShape) {
        guard scene.objects.count < GlassScene.maximumObjects else { return }
        endEdit()
        var object = GlassObject(shape: shape)
        if !scene.objects.isEmpty {
            object.x = min(0.85, 0.35 + Double(scene.objects.count % 3) * 0.18)
            object.y = min(0.85, 0.35 + Double(scene.objects.count % 4) * 0.14)
            object.size = 0.4
        }
        scene.objects.append(object); selectedID = object.id
        changed()
    }

    func duplicate() {
        guard scene.objects.count < GlassScene.maximumObjects,
              var object = scene.objects.first(where: { $0.id == selectedID }) else { return }
        endEdit()
        object.id = UUID(); object.x = min(1, object.x + 0.07); object.y = min(1, object.y + 0.04)
        scene.objects.append(object); selectedID = object.id; changed()
    }

    func remove() {
        guard let selectedID else { return }
        endEdit()
        scene.objects.removeAll { $0.id == selectedID }
        self.selectedID = scene.objects.last?.id; changed()
    }

    /// Arrow-key nudges; a run of presses is one undo step.
    func nudgeSelected(x dx: Double, y dy: Double) {
        guard let index = scene.objects.firstIndex(where: { $0.id == selectedID }) else { return }
        continueEdit()
        var object = scene.objects[index]
        object.x = min(1, max(0, object.x + dx)); object.y = min(1, max(0, object.y + dy))
        scene.objects[index] = object
    }

    /// Expected PNG export time from the last full-quality preview's speed; nil until one has rendered.
    func exportEstimate(width: Int, samples: Int) -> Double? {
        guard let rate = secondsPerPixelSample, let artwork else { return nil }
        return rate * Double(width) * Double(width) * Double(artwork.height) / Double(artwork.width) * Double(samples)
    }

    /// Later objects take precedence where solids overlap, so list order matters.
    func moveSelected(by offset: Int) {
        guard canMoveSelected(by: offset), let index = scene.objects.firstIndex(where: { $0.id == selectedID }) else { return }
        endEdit()
        scene.objects.swapAt(index, index + offset)
    }

    func canMoveSelected(by offset: Int) -> Bool {
        guard let index = scene.objects.firstIndex(where: { $0.id == selectedID }) else { return false }
        return scene.objects.indices.contains(index + offset)
    }

    func repairSelection() {
        if !scene.objects.contains(where: { $0.id == selectedID }) { selectedID = scene.objects.first?.id }
    }

    func changed() {
        revision += 1
        vectorResult = nil; vectorPreview = nil
        scheduleAutosave()
    }

    var previewKey: PreviewKey {
        PreviewKey(revision: revision, width: previewPixelWidth, coarse: editBase.map { $0 != scene } ?? false)
    }

    /// Renders at the canvas's real pixel width. While a drag or slider is moving, half resolution and two
    /// samples (about 16 times less work) keep up with the pointer; the full preview follows when it stops.
    func renderPreview(_ key: PreviewKey) async {
        guard let artwork else { return }
        let version = revision, snapshot = scene
        let width = max(160, key.coarse ? key.width / 2 : key.width), samples = key.coarse ? 2 : 8
        previewBusy = true
        do {
            try await Task.sleep(for: .milliseconds(key.coarse ? 16 : 90))
            try Task.checkCancellation()
            let clock = ContinuousClock(), started = clock.now
            let image = try await renderer().render(artwork: artwork, scene: snapshot, width: width, samples: samples)
            guard version == revision, !Task.isCancelled else { return }
            if !key.coarse {
                let elapsed = started.duration(to: clock.now)
                let seconds = Double(elapsed.components.seconds) + Double(elapsed.components.attoseconds) * 1e-18
                secondsPerPixelSample = seconds / Double(image.width * image.height * samples)
            }
            preview = NSImage(cgImage: image, size: .zero)
            previewBusy = false
            let visible = snapshot.objects.filter(\.enabled).count
            status = visible == 0 ? "No visible glass objects" : "\(visible) glass object\(visible == 1 ? "" : "s") · live refraction"
        } catch is CancellationError {
            if version == revision { previewBusy = false }
        } catch {
            if version == revision { previewBusy = false; self.error = error.localizedDescription }
        }
    }

    /// Compiling the Metal shader takes about 0.6 s, so it starts in the background when the window opens.
    private func warmUpRenderer() {
        if rendererTask == nil { rendererTask = Task.detached(priority: .userInitiated) { try GlassRenderer() } }
    }

    private func renderer() async throws -> GlassRenderer {
        warmUpRenderer()
        return try await rendererTask!.value
    }

    /// Stops the running export or trace after its current GPU pass.
    func cancelWork() {
        guard let work else { return }
        work.cancel(); status = "Stopping…"
    }

    private func finishWork() { busy = false; progress = nil; work = nil }

    private var reportProgress: @Sendable (Double) -> Void {
        { value in Task { @MainActor in if self.busy { self.progress = value } } }
    }

    func traceVectors() {
        guard let artwork, !busy else { return }
        busy = true; progress = 0; showVectors = true
        status = originalPDF == nil ? "Tracing refracted colors into closed vector paths…" : "Tracing the glass over the vector poster…"
        let snapshot = scene, colors = vectorColors, width = vectorWidth, version = revision, pdf = originalPDF
        work = Task {
            defer { finishWork() }
            do {
                // With a vector poster, the render also reports which pixels the glass changes; only those are traced.
                let glass = try await renderer(), renderWidth = max(1200, width)
                let image: CGImage, poster: GlassVectorTrace.Poster?
                if let pdf {
                    let rendered = try await glass.renderWithCoverage(artwork: artwork, scene: snapshot, width: renderWidth,
                                                                      samples: 24, progress: reportProgress)
                    image = rendered.image
                    poster = GlassVectorTrace.Poster(pdf: pdf, coverage: rendered.coverage)
                } else {
                    image = try await glass.render(artwork: artwork, scene: snapshot, width: renderWidth, samples: 24,
                                                   progress: reportProgress)
                    poster = nil
                }
                progress = nil
                let result = try await Task.detached(priority: .userInitiated) {
                    try GlassVectorTrace.trace(image, width: width, colors: colors, poster: poster)
                }.value
                try Task.checkCancellation()
                guard version == revision else { showVectors = false; return }
                vectorResult = result
                vectorPreview = NSImage(cgImage: result.preview, size: .zero)
                let counts = "\(result.pathCount.formatted()) contours · \(result.colorCount) colors"
                if result.posterVectors {
                    status = "Poster kept as vectors · \(Self.percent(result.tracedShare)) traced under the glass · \(counts) · SVG ready"
                } else {
                    status = (result.note.map { $0 + " " } ?? "") + "\(counts) · SVG ready"
                }
            } catch is CancellationError {
                showVectors = false; status = "Vector conversion cancelled"
            } catch { self.error = error.localizedDescription; showVectors = false }
        }
    }

    func exportPNG() {
        guard let artwork, !busy else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.png]; panel.nameFieldStringValue = "poster-glass.png"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        busy = true; progress = 0; status = "Rendering \(exportWidth) px PNG…"
        let snapshot = scene, width = exportWidth, samples = exportSamples
        work = Task {
            defer { finishWork() }
            do {
                let image = try await renderer().render(artwork: artwork, scene: snapshot, width: width, samples: samples,
                                                      progress: reportProgress)
                try Task.checkCancellation()
                progress = nil; status = "Saving \(url.lastPathComponent)…"
                try await Task.detached(priority: .userInitiated) { try PosterRenderer.png(image, to: url) }.value
                status = "Saved \(url.lastPathComponent) · \(image.width) × \(image.height)"
            } catch is CancellationError {
                status = "PNG export cancelled"
            } catch { self.error = error.localizedDescription }
        }
    }

    func exportSVG() {
        guard let vectorResult else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.svg]; panel.nameFieldStringValue = "poster-glass-vectors.svg"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try vectorResult.svg.write(to: url, atomically: true, encoding: .utf8)
            status = "Saved \(url.lastPathComponent) · paths only" + (vectorResult.posterVectors ? " · poster kept as vectors" : "")
        }
        catch { self.error = error.localizedDescription }
    }

    func saveProject() {
        guard let document = document() else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]; panel.nameFieldStringValue = "poster.glass.json"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(document).write(to: url, options: .atomic)
            status = "Saved editable project with its poster image"
        } catch { self.error = error.localizedDescription }
    }

    func openProject() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.json]; panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size < 110_000_000 else { throw PosterError.invalid("This project is too large. Choose a PosterLab Glass JSON project under 110 MB.") }
            let document = try JSONDecoder().decode(GlassDocument.self, from: Data(contentsOf: url))
            try document.validate(); try restore(document)
        } catch { self.error = error.localizedDescription }
    }

    private func restore(_ document: GlassDocument) throws {
        guard let source = CGImageSourceCreateWithData(document.artworkPNG as CFData, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: Self.maximumArtworkSide
              ] as CFDictionary) else { throw PosterError.invalid("The project’s poster image could not be read.") }
        artworkLoad?.cancel(); endEdit()
        artwork = image; artworkName = document.artworkName; originalPNG = document.artworkPNG; originalPDF = document.artworkPDF
        artworkNeedsAutosave = true
        scene = document.scene; vectorColors = document.vectorColors; vectorWidth = document.vectorWidth
        selectedID = scene.objects.first?.id; undoScenes = []; redoScenes = []
        compare = .glass; showVectors = false; changed()
    }

    private func document() -> GlassDocument? {
        guard let originalPNG else { return nil }
        return GlassDocument(artworkName: artworkName, artworkPNG: originalPNG, artworkPDF: originalPDF, scene: scene,
                             vectorColors: vectorColors, vectorWidth: vectorWidth)
    }

    // MARK: Autosave

    /// The poster is written once per artwork change; every edit only rewrites the small scene file.
    private struct Autosave: Codable, Sendable {
        var artworkName: String
        var scene: GlassScene
        var vectorColors: Int
        var vectorWidth: Int
    }

    private static let legacyAutosaveKey = "glass-autosave"

    private static var autosaveFolder: URL {
        URL.applicationSupportDirectory
            .appending(path: Bundle.main.bundleIdentifier ?? "studio.posterlab.glass")
            .appending(path: "Autosave")
    }

    private static func readAutosave() -> (document: GlassDocument, fromFiles: Bool)? {
        // This app's own autosave first. Until it has one, the last scene of the separate PosterLab Glass app
        // (where glass lived before it joined the main app) is picked up, read only.
        let earlier = URL.applicationSupportDirectory.appending(path: "studio.posterlab.glass/Autosave")
        for folder in [autosaveFolder, earlier] {
            if let state = try? JSONDecoder().decode(Autosave.self, from: Data(contentsOf: folder.appending(path: "scene.json"))),
               let png = try? Data(contentsOf: folder.appending(path: "artwork.png")) {
                let pdf = try? Data(contentsOf: folder.appending(path: "artwork.pdf"))
                let document = GlassDocument(artworkName: state.artworkName, artworkPNG: png, artworkPDF: pdf, scene: state.scene,
                                             vectorColors: state.vectorColors, vectorWidth: state.vectorWidth)
                // Read from the earlier app: report it as not from this app's files, so the artwork is written here too.
                if (try? document.validate()) != nil { return (document, folder == autosaveFolder) }
            }
        }
        // Earlier builds kept the whole project, poster pixels included, in user defaults.
        if let data = UserDefaults.standard.data(forKey: legacyAutosaveKey),
           let document = try? JSONDecoder().decode(GlassDocument.self, from: data),
           (try? document.validate()) != nil { return (document, false) }
        return nil
    }

    private func scheduleAutosave() {
        let previous = autosaveTask
        previous?.cancel()
        autosaveTask = Task {
            try? await Task.sleep(for: .milliseconds(700))
            await previous?.value
            guard !Task.isCancelled else { return }
            await writeAutosave()
        }
    }

    private func writeAutosave() async {
        guard let originalPNG else { return }
        let state = Autosave(artworkName: artworkName, scene: scene, vectorColors: vectorColors, vectorWidth: vectorWidth)
        let png = artworkNeedsAutosave ? originalPNG : nil, pdf = originalPDF
        let folder = Self.autosaveFolder
        artworkNeedsAutosave = false
        do {
            try await Task.detached(priority: .utility) {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                if let png {
                    try png.write(to: folder.appending(path: "artwork.png"), options: .atomic)
                    let vectors = folder.appending(path: "artwork.pdf")
                    if let pdf { try pdf.write(to: vectors, options: .atomic) } else { try? FileManager.default.removeItem(at: vectors) }
                }
                try JSONEncoder().encode(state).write(to: folder.appending(path: "scene.json"), options: .atomic)
            }.value
            UserDefaults.standard.removeObject(forKey: Self.legacyAutosaveKey)
        } catch {
            if png != nil { artworkNeedsAutosave = true }
        }
    }

    static func percent(_ share: Double) -> String {
        share > 0 && share < 0.01 ? "under 1 %" : "\(Int((share * 100).rounded())) %"
    }

    nonisolated private static func pngData(_ image: CGImage) throws -> Data {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else { throw PosterError.render }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { throw PosterError.render }
        return data as Data
    }
}
