import SwiftUI
import PosterCore

struct GlassWorkspaceView: View {
    let artworkURL: URL?
    @State private var model = GlassWorkspaceModel()

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Label("Glass objects", systemImage: "cube.transparent").font(.title2.bold())
                Spacer()
                Button("Open project…", systemImage: "folder") { model.openProject() }
                Button("Save project…", systemImage: "square.and.arrow.down") { model.saveProject() }
                    .disabled(!model.hasArtwork)
                Menu("Export", systemImage: "square.and.arrow.up") {
                    Button("PNG image…") { model.showExportSheet = true }
                    Button("Traced SVG…") { model.exportSVG() }.disabled(model.vectorResult == nil)
                }.fixedSize(horizontal: true, vertical: false).disabled(!model.hasArtwork)
            }.padding(.horizontal, 20).padding(.vertical, 14).disabled(model.busy)
            Divider()
            HSplitView {
                GlassObjectsSidebar(model: model).frame(minWidth: 200, idealWidth: 220, maxWidth: 260)
                GlassPosterCanvas(model: model).frame(minWidth: 400, maxWidth: .infinity, maxHeight: .infinity)
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        ForEach($model.scene.objects) { $object in
                            if object.id == model.selectedID {
                                GlassObjectInspector(object: $object)
                            }
                        }
                        if model.selectedID == nil {
                            ContentUnavailableView("Add a glass object", systemImage: "cube.transparent",
                                description: Text("Choose a solid from the Add object menu."))
                        }
                        Divider()
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Camera").font(.headline)
                            GlassSlider("Perspective", value: $model.scene.perspective, range: 0...1, reset: 0)
                                .help("0 looks straight down. Higher values bring the camera closer, so solids show their sides and flat faces catch reflections. The poster itself stays undistorted.")
                        }
                        Divider()
                        if model.scene.objects.contains(where: { $0.enabled && $0.material == .physical }) {
                            GlassLightingControls(scene: $model.scene)
                            Divider()
                        }
                        GlassVectorControls(model: model)
                    }.padding(20)
                }.frame(minWidth: 290, idealWidth: 310, maxWidth: 360).disabled(model.busy)
            }
            Divider()
            HStack(spacing: 10) {
                if model.busy, let progress = model.progress {
                    ProgressView(value: progress).frame(width: 120)
                        .accessibilityLabel("Render progress")
                } else if model.busy || model.previewBusy {
                    ProgressView().controlSize(.small)
                }
                if model.busy { Button("Cancel") { model.cancelWork() }.controlSize(.small) }
                Text(model.status).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                Spacer()
            }.padding(.horizontal, 20).padding(.vertical, 10)
        }
        .frame(minWidth: 1040, minHeight: 740)
        .tint(Color(red: 0.82, green: 0.22, blue: 0.12))
        .environment(\.glassEditing, editing)
        .task { model.start(artworkURL: artworkURL) }
        .task(id: model.previewKey) { await model.renderPreview(model.previewKey) }
        .focusedSceneValue(\.glassWorkspace, model)
        .sheet(isPresented: $model.showExportSheet) { GlassExportSheet(model: model) }
        .onChange(of: artworkURL) { _, url in if let url { model.loadArtwork(url) } }
        .dropDestination(for: URL.self) { urls, _ in
            guard let url = urls.first, !model.busy else { return false }
            model.loadArtwork(url); return true
        }
        .alert("Glass objects", isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })) {
            Button("OK") { model.error = nil }
        } message: { Text(model.error ?? "") }
    }

    private var editing: GlassEditing {
        let model = model
        return GlassEditing(begin: { model.beginEdit() }, end: { model.endEdit() }, touch: { model.continueEdit() })
    }
}

private struct GlassObjectsSidebar: View {
    @Bindable var model: GlassWorkspaceModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Poster").font(.headline)
            if let artwork = model.artwork {
                Image(decorative: artwork, scale: 1).resizable().scaledToFit().frame(maxHeight: 150)
                    .accessibilityLabel("Original poster")
                Text(model.artworkName).font(.caption).lineLimit(2).textSelection(.enabled)
                Text("\(artwork.width) × \(artwork.height) px").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            Button("Choose poster…", systemImage: "photo") { model.chooseArtwork() }
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Or drop an image into this window.").font(.caption).foregroundStyle(.secondary)
            Divider().padding(.vertical, 4)
            HStack {
                Text("Objects").font(.headline)
                Spacer()
                Text("\(model.scene.objects.count) / 8").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            Menu("Add object", systemImage: "plus") {
                ForEach(GlassShape.allCases) { shape in Button(shape.label) { model.add(shape) } }
            }.disabled(model.scene.objects.count >= GlassScene.maximumObjects)
            ScrollView {
                VStack(spacing: 4) {
                    ForEach(Array(model.scene.objects.enumerated()), id: \.element.id) { index, object in
                        Button { model.selectedID = object.id } label: {
                            HStack {
                                Image(systemName: object.enabled ? "cube.transparent" : "eye.slash").frame(width: 18)
                                Text("\(object.shape.label) \(index + 1)").lineLimit(1)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 10).padding(.vertical, 9)
                            .background(model.selectedID == object.id ? Color.accentColor.opacity(0.13) : .clear,
                                        in: RoundedRectangle(cornerRadius: 6))
                        }.buttonStyle(.plain)
                        .accessibilityAddTraits(model.selectedID == object.id ? .isSelected : [])
                        .contextMenu {
                            Button("Move Up") { model.selectedID = object.id; model.moveSelected(by: -1) }
                                .disabled(index == 0)
                            Button("Move Down") { model.selectedID = object.id; model.moveSelected(by: 1) }
                                .disabled(index == model.scene.objects.count - 1)
                            Divider()
                            Button("Duplicate") { model.selectedID = object.id; model.duplicate() }
                                .disabled(model.scene.objects.count >= GlassScene.maximumObjects)
                            Button("Delete") { model.selectedID = object.id; model.remove() }
                        }
                    }
                }
            }.frame(minHeight: 110)
            if model.scene.objects.count > 1 {
                Text("Where solids overlap, the lower one in the list wins.").font(.caption).foregroundStyle(.secondary)
            }
            HStack {
                Button("Duplicate", systemImage: "plus.square.on.square") { model.duplicate() }
                    .disabled(model.selectedID == nil || model.scene.objects.count >= GlassScene.maximumObjects)
                Spacer(minLength: 0)
                Button("Move up", systemImage: "arrow.up") { model.moveSelected(by: -1) }.labelStyle(.iconOnly)
                    .disabled(!model.canMoveSelected(by: -1)).help("Move the selected object up the list")
                Button("Move down", systemImage: "arrow.down") { model.moveSelected(by: 1) }.labelStyle(.iconOnly)
                    .disabled(!model.canMoveSelected(by: 1)).help("Move the selected object down the list, where it wins in overlaps")
                Button("Delete", systemImage: "trash") { model.remove() }.labelStyle(.iconOnly)
                    .disabled(model.selectedID == nil)
            }
            Divider()
            HStack {
                Button("Undo", systemImage: "arrow.uturn.backward") { model.undo() }.disabled(!model.canUndo)
                    .help("Undo (⌘Z)")
                Button("Redo", systemImage: "arrow.uturn.forward") { model.redo() }.disabled(!model.canRedo)
                    .help("Redo (⇧⌘Z)")
            }
        }.padding(18).disabled(model.busy)
    }
}

private struct GlassLightingControls: View {
    @Binding var scene: GlassScene
    @State private var expanded = true
    var body: some View {
        let defaults = GlassScene()
        DisclosureGroup("Studio lighting", isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 14) {
                Picker("Studio", selection: $scene.studio) {
                    ForEach(GlassStudio.allCases) { Text($0.label).tag($0) }
                }.font(.body)
                GlassSlider("Studio brightness", value: $scene.environment, range: 0...1, reset: defaults.environment)
                    .help("Brightness of the surroundings seen in reflections and at the glass edges.")
                GlassSlider("Paper shadows", value: $scene.shadows, range: 0...1, reset: defaults.shadows)
                    .help("Transparent, tinted shadows that physical glass casts on the poster.")
                GlassSlider("Light spread", value: $scene.lightSpread, range: 0...30, unit: "°", decimals: 0, reset: defaults.lightSpread)
                    .help("Size of the key light. Larger lights give softer shadow edges.")
                GlassSlider("Azimuth", value: $scene.lightAzimuth, range: -180...180, unit: "°", decimals: 0, reset: defaults.lightAzimuth)
                GlassSlider("Elevation", value: $scene.lightElevation, range: 5...90, unit: "°", decimals: 0, reset: defaults.lightElevation)
                GlassSlider("Light intensity", value: $scene.lightIntensity, range: 0...3, reset: defaults.lightIntensity)
            }.padding(.top, 12)
        }.font(.headline)
    }
}

private struct GlassVectorControls: View {
    @Bindable var model: GlassWorkspaceModel
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Vector conversion").font(.headline)
            Text("Trace the refracted image into flat color regions. More colors retain more of the glass shading.")
                .font(.caption).foregroundStyle(.secondary)
            Stepper("\(model.vectorColors) colors", value: $model.vectorColors, in: 2...32)
            Picker("Trace detail", selection: $model.vectorWidth) {
                Text("Low · 320 px").tag(320); Text("Medium · 600 px").tag(600); Text("High · 1000 px").tag(1000)
            }
            Button("Convert to vectors", systemImage: "point.topleft.down.to.point.bottomright.curvepath") {
                model.traceVectors()
            }.disabled(!model.hasArtwork || model.previewBusy)
            if let result = model.vectorResult {
                Text("\(result.pathCount.formatted()) closed contours · \(result.colorCount) colors")
                    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                Button("Export SVG…", systemImage: "square.and.arrow.up") { model.exportSVG() }
            }
            Text("SVG contains editable paths. The live glass remains editable in your saved project.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .onChange(of: model.vectorColors) { model.changed() }
        .onChange(of: model.vectorWidth) { model.changed() }
    }
}

private struct GlassExportSheet: View {
    @Bindable var model: GlassWorkspaceModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Export PNG").font(.title3.bold())
            Picker("Width", selection: $model.exportWidth) {
                Text("1200 px").tag(1200); Text("2400 px").tag(2400)
                Text("3508 px · A4 at 300 dpi").tag(3508); Text("4096 px").tag(4096)
            }
            Picker("Quality", selection: $model.exportSamples) {
                Text("Draft · 16 samples").tag(16); Text("Standard · 48 samples").tag(48); Text("High · 64 samples").tag(64)
            }
            Text(summary).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            HStack {
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }.keyboardShortcut(.cancelAction)
                Button("Export…") {
                    dismiss()
                    Task { model.exportPNG() }
                }.keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 400)
    }

    /// Pixel size and an estimate from how fast the last full-quality preview rendered.
    private var summary: String {
        guard let artwork = model.artwork else { return "" }
        let height = Int((Double(model.exportWidth) * Double(artwork.height) / Double(artwork.width)).rounded())
        let size = "\(model.exportWidth) × \(height) px"
        guard let seconds = model.exportEstimate(width: model.exportWidth, samples: model.exportSamples) else { return size }
        let time = seconds < 1 ? "under a second" : seconds < 90 ? "about \(Int(seconds.rounded())) s" : "about \(Int((seconds / 60).rounded())) min"
        return size + " · " + time
    }
}
