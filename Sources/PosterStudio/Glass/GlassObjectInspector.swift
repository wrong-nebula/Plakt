import SwiftUI
import PosterCore

/// Lets controls group a continuous adjustment into one undo step.
struct GlassEditing: Sendable {
    var begin: @MainActor @Sendable () -> Void = {}
    var end: @MainActor @Sendable () -> Void = {}
    /// For controls without an end event; the step closes after a pause.
    var touch: @MainActor @Sendable () -> Void = {}
}

private struct GlassEditingKey: EnvironmentKey {
    static let defaultValue = GlassEditing()
}

extension EnvironmentValues {
    var glassEditing: GlassEditing {
        get { self[GlassEditingKey.self] }
        set { self[GlassEditingKey.self] = newValue }
    }
}

/// Starting points for common materials. Dispersion is half the red-to-blue index spread.
private enum GlassPreset: String, CaseIterable, Identifiable {
    case crown, flint, acrylic, water, diamond, frosted, smoked, amber

    var id: String { rawValue }
    var label: String {
        switch self {
        case .crown: "Crown glass"
        case .flint: "Flint glass"
        case .acrylic: "Acrylic"
        case .water: "Water"
        case .diamond: "Diamond"
        case .frosted: "Frosted glass"
        case .smoked: "Smoked glass"
        case .amber: "Amber glass"
        }
    }

    func apply(to object: inout GlassObject) {
        let (ior, roughness, dispersion, absorption, tint): (Double, Double, Double, Double, (Double, Double, Double)) = switch self {
        case .crown: (1.52, 0.005, 0.004, 0.15, (0.93, 0.98, 0.96))
        case .flint: (1.62, 0.005, 0.010, 0.2, (0.96, 0.97, 0.93))
        case .acrylic: (1.49, 0.002, 0.004, 0.05, (1, 1, 1))
        case .water: (1.33, 0, 0.003, 0.3, (0.85, 0.95, 1))
        case .diamond: (2.42, 0, 0.022, 0, (1, 1, 1))
        case .frosted: (1.5, 0.25, 0.006, 0.2, (0.95, 0.97, 1))
        case .smoked: (1.52, 0.01, 0.004, 2.5, (0.45, 0.45, 0.47))
        case .amber: (1.54, 0.01, 0.005, 1.8, (1, 0.62, 0.2))
        }
        object.material = .physical
        object.ior = ior; object.roughness = roughness; object.dispersion = dispersion; object.absorption = absorption
        (object.tintRed, object.tintGreen, object.tintBlue) = tint
    }
}

struct GlassObjectInspector: View {
    @Binding var object: GlassObject
    @Environment(\.glassEditing) private var editing
    @State private var tint = Color.white

    var body: some View {
        let defaults = GlassObject(shape: object.shape)
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Text(object.shape.label).font(.title3.bold())
                Spacer()
                Toggle("Visible", isOn: $object.enabled).labelsHidden().toggleStyle(.switch).controlSize(.small)
            }
            Picker("Solid", selection: $object.shape) {
                ForEach(GlassShape.allCases) { Text($0.label).tag($0) }
            }
            VStack(alignment: .leading, spacing: 14) {
                Text("Placement").font(.headline)
                GlassSlider("Horizontal", value: $object.x, range: 0...1, reset: defaults.x)
                GlassSlider("Vertical", value: $object.y, range: 0...1, reset: defaults.y)
                GlassSlider("Size", value: $object.size, range: 0.08...1.4, reset: defaults.size)
                GlassSlider("Thickness", value: $object.depth, range: 0.1...2, reset: defaults.depth)
                if object.shape != .sphere {
                    GlassSlider("Edge rounding", value: $object.edgeRounding, range: 0...1, reset: defaults.edgeRounding)
                        .help("Rounds the edges and corners so they catch light like polished glass.")
                }
                GlassSlider("Above paper", value: $object.elevation, range: 0...1, reset: defaults.elevation)
                Text("On the poster: drag the handle to move, ⌥-drag to tilt, drag the ring's dot or pinch to resize, and rotate with two fingers. Arrow keys nudge.")
                    .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            DisclosureGroup("Rotation") {
                VStack(spacing: 14) {
                    GlassSlider("Tilt X", value: $object.rotationX, range: -180...180, unit: "°", decimals: 0, reset: defaults.rotationX)
                    GlassSlider("Tilt Y", value: $object.rotationY, range: -180...180, unit: "°", decimals: 0, reset: defaults.rotationY)
                    GlassSlider("Turn Z", value: $object.rotationZ, range: -180...180, unit: "°", decimals: 0, reset: defaults.rotationZ)
                }.padding(.top, 12)
            }.font(.headline)
            Divider()
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Glass material").font(.headline)
                    Spacer()
                    Menu("Preset") {
                        ForEach(GlassPreset.allCases) { preset in
                            Button(preset.label) { var updated = object; preset.apply(to: &updated); object = updated }
                        }
                    }.menuStyle(.borderlessButton).fixedSize().help("Set refraction, dispersion, roughness and tint for a common material")
                }
                Picker("Glass mode", selection: $object.material) {
                    ForEach(GlassMaterialMode.allCases) { Text($0.label).tag($0) }
                }
                if object.material == .simple {
                    Text("Basic refraction through a clear solid.").font(.caption).foregroundStyle(.secondary)
                }
                GlassSlider("Refraction · IOR", value: $object.ior, range: 1...2.5, reset: defaults.ior)
                    .help("1.0 is air. Typical glass is around 1.5. Higher values bend the poster more.")
                if object.material == .physical {
                GlassSlider("Roughness", value: $object.roughness, range: 0...0.5, decimals: 3, reset: defaults.roughness)
                GlassSlider("Dispersion", value: $object.dispersion, range: 0...0.08, decimals: 3, reset: defaults.dispersion)
                    .help("Separates red, green and blue ray directions to create chromatic edges.")
                ColorPicker("Glass tint", selection: $tint, supportsOpacity: false)
                GlassSlider("Tint absorption", value: $object.absorption, range: 0...10, reset: defaults.absorption)
                Button("Clear glass") {
                    var clear = object
                    clear.ior = 1.5; clear.roughness = 0; clear.dispersion = 0
                    clear.absorption = 0; clear.tintRed = 1; clear.tintGreen = 1; clear.tintBlue = 1
                    object = clear
                    tint = .white
                }
                }
            }
        }
        .id(object.id)
        .onAppear { updateTint() }
        .onChange(of: object.tintRed) { updateTint() }
        .onChange(of: object.tintGreen) { updateTint() }
        .onChange(of: object.tintBlue) { updateTint() }
        .onChange(of: tint) {
            guard let color = NSColor(tint).usingColorSpace(.sRGB) else { return }
            // Ignore colour-space round-trip noise so selecting an object never counts as an edit.
            let channels = [(color.redComponent, object.tintRed), (color.greenComponent, object.tintGreen), (color.blueComponent, object.tintBlue)]
            guard channels.contains(where: { abs($0.0 - $0.1) > 0.5 / 255 }) else { return }
            var colored = object
            colored.tintRed = color.redComponent; colored.tintGreen = color.greenComponent; colored.tintBlue = color.blueComponent
            editing.touch()
            object = colored
        }
    }

    private func updateTint() {
        tint = Color(red: object.tintRed, green: object.tintGreen, blue: object.tintBlue)
    }
}

struct GlassSlider: View {
    let title: String
    @Binding var value: Double
    @Environment(\.glassEditing) private var editing
    let range: ClosedRange<Double>
    var unit = ""
    var decimals = 2
    /// Restored by double-clicking the title.
    var reset: Double?
    @State private var text = ""
    @FocusState private var typing: Bool

    init(_ title: String, value: Binding<Double>, range: ClosedRange<Double>, unit: String = "", decimals: Int = 2, reset: Double? = nil) {
        self.title = title; self._value = value; self.range = range; self.unit = unit; self.decimals = decimals; self.reset = reset
    }

    var body: some View {
        VStack(spacing: 5) {
            HStack(spacing: 2) {
                Text(title).font(.caption)
                    .onTapGesture(count: 2) { if let reset { value = reset } }
                    .help(reset.map { "Double-click to reset to \(formatted($0))\(unit)" } ?? "")
                Spacer()
                TextField(title, text: $text)
                    .labelsHidden()
                    .textFieldStyle(.plain)
                    .multilineTextAlignment(.trailing)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 56)
                    .focused($typing)
                    .onSubmit(commit)
                if !unit.isEmpty { Text(unit).font(.caption).foregroundStyle(.secondary) }
            }
            Slider(value: $value, in: range, onEditingChanged: { started in started ? editing.begin() : editing.end() })
                .labelsHidden().accessibilityLabel(title)
                .accessibilityValue(formatted(value) + unit)
        }
        .fontWeight(.regular)
        .onAppear { text = formatted(value) }
        .onChange(of: value) { if !typing { text = formatted(value) } }
        .onChange(of: typing) { if !typing { commit() } }
    }

    private func formatted(_ number: Double) -> String { String(format: "%.\(decimals)f", number) }

    /// Takes a typed value with a point or comma decimal, clamped to the slider's range.
    private func commit() {
        let typed = text.replacingOccurrences(of: unit, with: "").replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespaces)
        if let number = Double(typed), number.isFinite {
            let clamped = min(range.upperBound, max(range.lowerBound, number))
            if clamped != value { value = clamped }
        }
        text = formatted(value)
    }
}
