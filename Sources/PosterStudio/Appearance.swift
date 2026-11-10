import AppKit
import SwiftUI

/// The app's light or dark look. Applied to NSApp, so windows, sheets, menus and AppKit
/// controls all follow; the live study stage keeps its own dark paper either way.
enum AppAppearance: String, CaseIterable, Identifiable {
    case system, light, dark
    static let key = "posterlab-appearance"
    var id: String { rawValue }
    var name: String {
        switch self {
        case .system: "Match System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
    @MainActor func apply() {
        switch self {
        case .system: NSApp.appearance = nil
        case .light: NSApp.appearance = NSAppearance(named: .aqua)
        case .dark: NSApp.appearance = NSAppearance(named: .darkAqua)
        }
    }
}

struct AppearancePicker: View {
    @AppStorage(AppAppearance.key) private var appearance = AppAppearance.dark
    var body: some View {
        Picker("Appearance", selection: $appearance) {
            ForEach(AppAppearance.allCases) { Text($0.name).tag($0) }
        }
        .onChange(of: appearance, initial: true) { appearance.apply() }
    }
}
