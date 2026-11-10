import AppKit
import SwiftUI
import PosterCore

struct GlassPosterCanvas: View {
    @Bindable var model: GlassWorkspaceModel
    @Environment(\.displayScale) private var displayScale
    @State private var showHandles = true
    @State private var zoom = 1.0
    @State private var split = 0.5
    /// The object as it was when the current drag or trackpad gesture began; each gesture is one undo step.
    @State private var gestureStart: GlassObject?
    @State private var tilting = false
    @FocusState private var focused: Bool

    private var displayedImage: NSImage? {
        if model.compare == .original, let artwork = model.artwork { return NSImage(cgImage: artwork, size: .zero) }
        if model.showVectors, let image = model.vectorPreview { return image }
        return model.preview
    }

    private var selected: GlassObject? { model.scene.objects.first { $0.id == model.selectedID && $0.enabled } }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            GeometryReader { proxy in
                if let image = displayedImage, let artwork = model.artwork {
                    let aspect = Double(artwork.height) / Double(artwork.width)
                    let fitted = min(max(1, proxy.size.width - 48), max(1, proxy.size.height - 48) / aspect)
                    let width = fitted * zoom, height = width * aspect
                    // Previews render at the pixels actually shown, in 64 px steps so resizing doesn't re-render constantly.
                    let pixelWidth = min(3200, max(320, Int((width * displayScale / 64).rounded()) * 64))
                    Group {
                        if zoom > 1 {
                            ScrollView([.horizontal, .vertical]) { poster(image, width: width, height: height).padding(24) }
                        } else {
                            poster(image, width: width, height: height).frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                    .onChange(of: pixelWidth, initial: true) { model.previewPixelWidth = pixelWidth }
                } else {
                    ContentUnavailableView("Choose a poster", systemImage: "photo", description: Text("The glass will refract the artwork placed below it."))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
        .background(Color(nsColor: .underPageBackgroundColor))
        .focusable()
        .focused($focused)
        .focusEffectDisabled()
        .onKeyPress(keys: [.leftArrow, .rightArrow, .upArrow, .downArrow]) { press in
            guard model.selectedID != nil, !model.busy else { return .ignored }
            let step = press.modifiers.contains(.shift) ? 0.01 : 0.002
            switch press.key {
            case .leftArrow: model.nudgeSelected(x: -step, y: 0)
            case .rightArrow: model.nudgeSelected(x: step, y: 0)
            case .upArrow: model.nudgeSelected(x: 0, y: -step)
            default: model.nudgeSelected(x: 0, y: step)
            }
            return .handled
        }
        .onKeyPress(keys: [.delete, .deleteForward]) { _ in
            guard model.selectedID != nil, !model.busy else { return .ignored }
            model.remove()
            return .handled
        }
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            Picker("Compare", selection: $model.compare) {
                ForEach(GlassCompare.allCases) { Text($0.label).tag($0) }
            }.pickerStyle(.segmented).labelsHidden().fixedSize()
                .help("Show the glass, a split against the original poster, or the original")
            Toggle("Handles", isOn: $showHandles).toggleStyle(.button)
            if model.vectorResult != nil {
                Toggle("Vector preview", isOn: $model.showVectors).toggleStyle(.button)
            }
            Spacer(minLength: 0)
            Picker("Zoom", selection: $zoom) {
                Text("Fit").tag(1.0); Text("2×").tag(2.0); Text("4×").tag(4.0)
            }.pickerStyle(.segmented).labelsHidden().fixedSize()
                .help("Zoom into the poster; the preview renders at the zoomed resolution")
        }.controlSize(.small).padding(12).disabled(model.busy)
    }

    private func poster(_ image: NSImage, width: Double, height: Double) -> some View {
        ZStack(alignment: .topLeading) {
            Image(nsImage: image).resizable().frame(width: width, height: height)
                .accessibilityLabel(model.compare == .original ? "Original poster" : (model.showVectors && model.vectorResult != nil ? "Vector trace preview" : "Poster refracted through glass"))
            if model.compare == .split, let artwork = model.artwork {
                Image(decorative: artwork, scale: 1).resizable().frame(width: width, height: height)
                    .mask(alignment: .leading) { Rectangle().frame(width: width * split) }
                splitHandle(width: width, height: height)
            }
            if showHandles && model.compare != .original && !model.busy {
                handles(width: width, height: height)
            }
        }
        .frame(width: width, height: height)
        .coordinateSpace(.named("poster"))
        .shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 5)
        .gesture(trackpadGesture)
        .simultaneousGesture(TapGesture().onEnded { focused = true })
    }

    private func splitHandle(width: Double, height: Double) -> some View {
        ZStack {
            Rectangle().fill(.white.opacity(0.9)).frame(width: 2)
            Circle().fill(.white).frame(width: 22, height: 22).shadow(color: .black.opacity(0.3), radius: 2)
                .overlay(Image(systemName: "arrow.left.and.right").font(.system(size: 10, weight: .bold)).foregroundStyle(.black))
        }
        .frame(width: 28, height: height)
        .contentShape(Rectangle())
        .position(x: width * split, y: height / 2)
        .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("poster")).onChanged { value in
            split = min(1, max(0, value.location.x / width))
        })
        .accessibilityLabel("Split between original and glass")
        .accessibilityValue("\(Int(split * 100)) percent original")
    }

    @ViewBuilder
    private func handles(width: Double, height: Double) -> some View {
        if let object = selected {
            let radius = object.size / 2 * width
            Circle().strokeBorder(Color.white.opacity(0.9), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                .shadow(color: .black.opacity(0.5), radius: 1)
                .frame(width: radius * 2, height: radius * 2)
                .position(x: object.x * width, y: object.y * height)
                .allowsHitTesting(false)
            Circle().fill(.white).frame(width: 12, height: 12)
                .overlay(Circle().stroke(Color.accentColor, lineWidth: 2))
                .frame(width: 28, height: 28).contentShape(Rectangle())
                .position(x: object.x * width + radius * 0.7071, y: object.y * height + radius * 0.7071)
                .gesture(DragGesture(coordinateSpace: .named("poster")).onChanged { value in
                    adjust(object.id) { start, object in
                        let dx = Double(value.location.x) - start.x * width, dy = Double(value.location.y) - start.y * height
                        let distance = (dx * dx + dy * dy).squareRoot()
                        object.size = min(1.4, max(0.08, 2 * distance / width))
                    }
                }.onEnded { _ in endGesture() })
                .help("Drag to resize \(object.shape.label). Pinch on the trackpad also resizes.")
                .accessibilityLabel("Resize \(object.shape.label)")
        }
        ForEach(model.scene.objects.filter(\.enabled)) { object in
            Button { model.selectedID = object.id; focused = true } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 20))
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(.white, model.selectedID == object.id ? Color.accentColor : Color.black.opacity(0.65))
                    .frame(width: 32, height: 32)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Select and move \(object.shape.label)")
            .help("Drag to move \(object.shape.label); ⌥-drag to tilt it")
            .position(x: object.x * width, y: object.y * height)
            .simultaneousGesture(DragGesture(minimumDistance: 2)
                .onChanged { value in
                    if gestureStart == nil { tilting = NSEvent.modifierFlags.contains(.option) }
                    adjust(object.id) { start, object in
                        if tilting {
                            // Sideways turns the solid about its vertical axis, up and down about its horizontal one.
                            object.rotationY = Self.wrapped(start.rotationY + value.translation.width * 0.5)
                            object.rotationX = Self.wrapped(start.rotationX - value.translation.height * 0.5)
                        } else {
                            object.x = max(0, min(1, start.x + value.translation.width / width))
                            object.y = max(0, min(1, start.y + value.translation.height / height))
                        }
                    }
                }.onEnded { _ in endGesture() })
        }
    }

    /// Trackpad pinch resizes the selected solid and two-finger rotation turns it.
    private var trackpadGesture: some Gesture {
        MagnifyGesture().simultaneously(with: RotateGesture())
            .onChanged { value in
                guard let id = selected?.id else { return }
                adjust(id) { start, object in
                    if let magnification = value.first?.magnification {
                        object.size = min(1.4, max(0.08, start.size * magnification))
                    }
                    if let rotation = value.second?.rotation {
                        object.rotationZ = Self.wrapped(start.rotationZ - rotation.degrees)
                    }
                }
            }
            .onEnded { _ in endGesture() }
    }

    /// Applies a change relative to the object's state when the gesture began.
    private func adjust(_ id: UUID, _ change: (GlassObject, inout GlassObject) -> Void) {
        guard let index = model.scene.objects.firstIndex(where: { $0.id == id }) else { return }
        if gestureStart == nil {
            gestureStart = model.scene.objects[index]
            model.selectedID = id
            model.beginEdit()
        }
        guard let start = gestureStart else { return }
        var object = model.scene.objects[index]
        change(start, &object)
        if object != model.scene.objects[index] { model.scene.objects[index] = object }
    }

    private func endGesture() {
        gestureStart = nil
        tilting = false
        model.endEdit()
    }

    private static func wrapped(_ degrees: Double) -> Double {
        let turned = (degrees + 180).truncatingRemainder(dividingBy: 360)
        return (turned < 0 ? turned + 360 : turned) - 180
    }
}
